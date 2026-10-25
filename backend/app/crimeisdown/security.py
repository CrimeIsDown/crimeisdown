import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote

import bcrypt
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

GUARD_HASH = hashlib.sha1(b"Illuminate\\Auth\\SessionGuard").hexdigest()
LOGIN_KEY = "login_web_" + GUARD_HASH
REMEMBER_COOKIE = "remember_web_" + GUARD_HASH


class LaravelCookies:
    """Laravel Encrypter AES-256-CBC envelope and CookieValuePrefix, not custom crypto."""

    def __init__(self, key: Any) -> None:
        self.key = key

    def prefix(self, name: Any) -> Any:
        return (
            hmac.new(self.key, (name + "v2").encode(), hashlib.sha1).hexdigest() + "|"
        )

    def encrypt(self, name: Any, value: Any) -> Any:
        iv = os.urandom(16)
        padder = padding.PKCS7(128).padder()
        plaintext = (self.prefix(name) + value).encode()
        padded = padder.update(plaintext) + padder.finalize()
        encryptor = Cipher(algorithms.AES(self.key), modes.CBC(iv)).encryptor()
        iv64 = base64.b64encode(iv).decode()
        value64 = base64.b64encode(
            encryptor.update(padded) + encryptor.finalize()
        ).decode()
        mac = hmac.new(self.key, (iv64 + value64).encode(), hashlib.sha256).hexdigest()
        return base64.b64encode(
            json.dumps(
                {"iv": iv64, "value": value64, "mac": mac, "tag": ""},
                separators=(",", ":"),
            ).encode()
        ).decode()

    def decrypt(self, name: Any, value: Any) -> Any:
        try:
            data = json.loads(base64.b64decode(unquote(value)))
            mac = hmac.new(
                self.key, (data["iv"] + data["value"]).encode(), hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(mac, data["mac"]):
                return None
            decryptor = Cipher(
                algorithms.AES(self.key), modes.CBC(base64.b64decode(data["iv"]))
            ).decryptor()
            padded = (
                decryptor.update(base64.b64decode(data["value"])) + decryptor.finalize()
            )
            unpadder = padding.PKCS7(128).unpadder()
            text = (unpadder.update(padded) + unpadder.finalize()).decode()
            return (
                text[41:] if hmac.compare_digest(text[:41], self.prefix(name)) else None
            )
        except ValueError, KeyError, TypeError, UnicodeError:
            return None


def password_hash(value: Any) -> Any:
    # Laravel's bcrypt format remains readable by both runtimes. bcrypt's byte limit
    # is explicit instead of silently changing a long password's meaning.
    return (
        bcrypt.hashpw(value.encode()[:72], bcrypt.gensalt(rounds=12))
        .decode()
        .replace("$2b$", "$2y$", 1)
    )


def password_valid(value: Any, hashed: Any) -> Any:
    if not hashed or not isinstance(value, str):
        return False
    try:
        return bcrypt.checkpw(value.encode()[:72], hashed.encode())
    except ValueError:
        return False


class Sessions:
    def __init__(self, settings: Any, state: Any) -> None:
        self.settings, self.state = settings, state
        self.cookies = LaravelCookies(settings.encryption_key())
        self.legacy_redis = None
        if settings.legacy_session_redis_url:
            import redis

            self.legacy_redis = redis.Redis.from_url(settings.legacy_session_redis_url)

    @property
    def ttl(self) -> Any:
        return self.settings.session_lifetime * 60

    def read(self, session_id: Any) -> Any:
        if not session_id or not re.fullmatch("[A-Za-z0-9]{40}", session_id):
            return None
        if self.legacy_redis is not None:
            from .state import LegacyFileState

            try:
                raw = self.legacy_redis.get(
                    self.settings.legacy_session_redis_prefix + session_id
                )
                if not isinstance(raw, bytes):
                    return None
                value = LegacyFileState.decode(raw)
                return json.loads(value) if isinstance(value, str) else None
            except ValueError, UnicodeError:
                return None
        if self.settings.session_files:
            path = self.settings.session_files / session_id
            try:
                if path.stat().st_mtime < time.time() - self.ttl:
                    return None
                return json.loads(path.read_text())
            except OSError, ValueError:
                return None
        return self.state.get("session:" + session_id)

    def save(self, session_id: Any, data: Any) -> Any:
        if self.legacy_redis is not None:
            encoded = json.dumps(data, separators=(",", ":")).encode()
            raw = b"s:" + str(len(encoded)).encode() + b':"' + encoded + b'";'
            self.legacy_redis.set(
                self.settings.legacy_session_redis_prefix + session_id, raw, ex=self.ttl
            )
            return
        if self.settings.session_files:
            root: Path = self.settings.session_files
            root.mkdir(mode=0o700, parents=True, exist_ok=True)
            temporary = root / ("." + secrets.token_hex(16))
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as stream:
                json.dump(data, stream, separators=(",", ":"))
            os.replace(temporary, root / session_id)
        else:
            self.state.set("session:" + session_id, data, self.ttl)

    def delete(self, session_id: Any) -> Any:
        if self.legacy_redis is not None:
            self.legacy_redis.delete(
                self.settings.legacy_session_redis_prefix + session_id
            )
        elif self.settings.session_files:
            (self.settings.session_files / session_id).unlink(missing_ok=True)
        self.state.delete("session:" + session_id)

    def open(self, request: Any) -> Any:
        cookie = request.cookies.get(self.settings.session_cookie, "")
        session_id = (
            self.cookies.decrypt(self.settings.session_cookie, cookie)
            if cookie
            else None
        )
        data = self.read(session_id)
        if isinstance(data, dict):
            data.setdefault("_token", secrets.token_hex(20))
        return (
            (session_id, data)
            if data is not None
            else (secrets.token_hex(20), {"_token": secrets.token_hex(20)})
        )

    def rotate(self, request: Any) -> Any:
        self.delete(request.state.session_id)
        request.state.session_id = secrets.token_hex(20)

    def attach(self, response: Any, session_id: Any, data: Any) -> Any:
        self.save(session_id, data)
        args = {
            "domain": self.settings.session_domain,
            "path": "/",
            "secure": self.settings.session_secure_cookie,
            "samesite": "lax",
            "max_age": self.ttl,
        }
        response.set_cookie(
            self.settings.session_cookie,
            quote(
                self.cookies.encrypt(self.settings.session_cookie, session_id), safe=""
            ),
            httponly=True,
            **args,
        )
        response.set_cookie(
            "XSRF-TOKEN",
            quote(self.cookies.encrypt("XSRF-TOKEN", data["_token"]), safe=""),
            httponly=False,
            **args,
        )
