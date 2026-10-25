import json
import threading
import time
from typing import Any, cast

import redis


class RedisState:
    def __init__(self, url: Any) -> None:
        self.redis = redis.Redis.from_url(url, decode_responses=True)

    def get(self, key: Any) -> Any:
        value = cast(str | None, self.redis.get("cid:" + key))
        return json.loads(value) if value is not None else None

    def set(self, key: Any, value: Any, ttl: Any) -> Any:
        self.redis.set("cid:" + key, json.dumps(value), ex=max(1, int(ttl)))

    def delete(self, key: Any) -> Any:
        self.redis.delete("cid:" + key)

    def increment(self, key: Any, ttl: Any) -> Any:
        return int(
            cast(
                str,
                self.redis.eval(
                    "local v=redis.call('INCR',KEYS[1]); if v==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return v",
                    1,
                    "cid:" + key,
                    str(max(1, int(ttl))),
                ),
            )
        )


class MemoryState:
    """Deterministic test adapter. Production always uses shared Redis."""

    def __init__(self) -> None:
        self.values: dict[str, tuple[float, str]] = {}
        self.lock = threading.RLock()

    def get(self, key: Any) -> Any:
        with self.lock:
            pair = self.values.get(key)
            return json.loads(pair[1]) if pair and pair[0] > time.time() else None

    def set(self, key: Any, value: Any, ttl: Any) -> Any:
        with self.lock:
            self.values[key] = (time.time() + ttl, json.dumps(value))

    def delete(self, key: Any) -> Any:
        with self.lock:
            self.values.pop(key, None)

    def increment(self, key: Any, ttl: Any) -> Any:
        with self.lock:
            value = (self.get(key) or 0) + 1
            expires = self.values.get(key, (time.time() + ttl, ""))[0]
            self.values[key] = (expires, json.dumps(value))
            return value


class LegacyFileState:
    """Share Laravel scalar caches without deserializing PHP objects or executing PHP."""

    def __init__(self, primary: Any, root: Any, clock: Any) -> None:
        self.primary, self.root, self.clock = primary, root, clock

    def legacy_key(self, key: str) -> str | None:
        import hashlib

        if key.startswith("archive-download:"):
            return hashlib.md5(
                ("archive-downloads" + key.split(":", 1)[1]).encode()
            ).hexdigest()
        if key.endswith("_search_key"):
            return key
        return None

    def path(self, key: str) -> Any:
        import hashlib

        digest = hashlib.sha1(key.encode()).hexdigest()
        return self.root / digest[:2] / digest[2:4] / digest

    @staticmethod
    def decode(raw: bytes) -> Any:
        import re

        if re.fullmatch(rb"i:\d+;", raw):
            return int(raw[2:-1])
        match = re.fullmatch(rb's:(\d+):"(.*)";', raw, re.DOTALL)
        if match and len(match[2]) == int(match[1]):
            return match[2].decode()
        return None

    def read(self, key: str) -> Any:
        import fcntl

        try:
            with self.path(key).open("rb") as stream:
                fcntl.flock(stream, fcntl.LOCK_SH)
                raw = stream.read(65536)
            if (
                len(raw) >= 10
                and raw[:10].isdigit()
                and int(raw[:10]) > self.clock().timestamp()
            ):
                return self.decode(raw[10:])
        except OSError, ValueError, UnicodeError:
            pass
        return None

    def get(self, key: str) -> Any:
        legacy_key = self.legacy_key(key)
        if legacy_key:
            value = self.read(legacy_key)
            if value is not None:
                return value
        return self.primary.get(key)

    def set(self, key: str, value: Any, ttl: Any) -> None:
        import fcntl

        legacy_key = self.legacy_key(key)
        if legacy_key and isinstance(value, str):
            path = self.path(legacy_key)
            path.parent.mkdir(parents=True, exist_ok=True)
            encoded = value.encode()
            raw = (
                str(int(self.clock().timestamp() + ttl)).zfill(10).encode()
                + b"s:"
                + str(len(encoded)).encode()
                + b':"'
                + encoded
                + b'";'
            )
            with path.open("wb") as stream:
                fcntl.flock(stream, fcntl.LOCK_EX)
                stream.write(raw)
        self.primary.set(key, value, ttl)

    def increment(self, key: str, ttl: Any) -> int:
        import fcntl

        legacy_key = self.legacy_key(key)
        if not legacy_key:
            return int(self.primary.increment(key, ttl))
        path = self.path(legacy_key)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a+b") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            stream.seek(0)
            raw = stream.read(65536)
            now = int(self.clock().timestamp())
            expiry = int(raw[:10]) if raw[:10].isdigit() else 0
            old = self.decode(raw[10:]) if expiry > now else 0
            value = (old if isinstance(old, int) else 0) + 1
            expiry = expiry if expiry > now else now + int(ttl)
            stream.seek(0)
            stream.truncate()
            stream.write(str(expiry).zfill(10).encode() + f"i:{value};".encode())
        timer_path = self.path(legacy_key + ":timer")
        timer_path.parent.mkdir(parents=True, exist_ok=True)
        with timer_path.open("a+b") as timer:
            fcntl.flock(timer, fcntl.LOCK_EX)
            timer.seek(0)
            existing = timer.read(65536)
            if not existing[:10].isdigit() or int(existing[:10]) <= now:
                timer.seek(0)
                timer.truncate()
                timer.write(str(expiry).zfill(10).encode() + f"i:{expiry};".encode())
        self.primary.set(key, value, max(1, expiry - now))
        return value

    def delete(self, key: str) -> None:
        legacy_key = self.legacy_key(key)
        if legacy_key:
            self.path(legacy_key).unlink(missing_ok=True)
        self.primary.delete(key)


class LegacyRedisState:
    """Share Laravel's scalar Redis quota/search caches across cutover and rollback."""

    def __init__(self, primary: Any, url: str, prefix: str) -> None:
        self.primary, self.prefix = primary, prefix
        self.redis = redis.Redis.from_url(url)

    @staticmethod
    def legacy_key(key: str) -> str | None:
        import hashlib

        if key.startswith("archive-download:"):
            return hashlib.md5(
                ("archive-downloads" + key.split(":", 1)[1]).encode()
            ).hexdigest()
        return key if key.endswith("_search_key") else None

    def get(self, key: str) -> Any:
        mapped = self.legacy_key(key)
        if mapped:
            raw = self.redis.get(self.prefix + mapped)
            if isinstance(raw, bytes):
                # Laravel RedisStore leaves numeric values unserialized.
                if raw.isdigit():
                    return int(raw)
                value = LegacyFileState.decode(raw)
                if value is not None:
                    return value
            # A missing authoritative key means the Laravel budget expired.
            # Never resurrect it from a private cache during a rollback.
            return None
        return self.primary.get(key)

    def set(self, key: str, value: Any, ttl: Any) -> None:
        mapped = self.legacy_key(key)
        if mapped and isinstance(value, str):
            encoded = value.encode()
            raw = b"s:" + str(len(encoded)).encode() + b':"' + encoded + b'";'
            self.redis.set(self.prefix + mapped, raw, ex=max(1, int(ttl)))
            return
        self.primary.set(key, value, ttl)

    def increment(self, key: str, ttl: Any) -> int:
        mapped = self.legacy_key(key)
        if not mapped:
            return int(self.primary.increment(key, ttl))
        # Match Laravel's counter and :timer pair atomically. Keep the original
        # expiration rather than resetting a partly consumed daily budget.
        return int(
            self.redis.eval(
                "local n=redis.call('INCR',KEYS[1]); "
                "if redis.call('TTL',KEYS[1])<0 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; "
                "if redis.call('EXISTS',KEYS[2])==0 then "
                "local now=redis.call('TIME'); local ttl=redis.call('TTL',KEYS[1]); "
                "redis.call('SET',KEYS[2],tonumber(now[1])+ttl,'EX',ttl) end; return n",
                2,
                self.prefix + mapped,
                self.prefix + mapped + ":timer",
                max(1, int(ttl)),
            )
        )

    def delete(self, key: str) -> None:
        mapped = self.legacy_key(key)
        if mapped:
            self.redis.delete(self.prefix + mapped, self.prefix + mapped + ":timer")
        else:
            self.primary.delete(key)
