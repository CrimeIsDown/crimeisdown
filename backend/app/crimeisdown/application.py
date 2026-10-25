import hashlib
import hmac
import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import parse_qs

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import (
    JSONResponse,
    PlainTextResponse,
    RedirectResponse,
)
from starlette.middleware.cors import CORSMiddleware

from .database import Database, decoded, serialized
from .security import (
    LOGIN_KEY,
    REMEMBER_COOKIE,
    Sessions,
)
from .services import Services, legacy_json, php_filter
from .settings import Settings
from .state import LegacyFileState, LegacyRedisState, RedisState

log = logging.getLogger(__name__)


class InvalidInput(Exception):
    def __init__(self, errors: Any) -> None:
        self.errors = errors


def invalid(field: Any, message: Any) -> Any:
    raise InvalidInput({field: [message]})


def clean(value: Any) -> Any:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, dict):
        return {
            key: clean(v)
            if key not in ("password", "current_password", "password_confirmation")
            else v
            for key, v in value.items()
        }
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


async def payload(request: Request) -> Any:
    try:
        if "application/json" in request.headers.get("content-type", ""):
            value = await request.json()
        else:
            value = dict(await request.form())
    except ValueError, UnicodeError:
        raise HTTPException(400, "Invalid request body") from None
    if not isinstance(value, dict):
        raise HTTPException(422, "Expected an object")
    request.state.form_data = clean(value)
    return request.state.form_data


def fields(data: Any, required: Any = (), strings: Any = (), booleans: Any = ()) -> Any:
    errors = {}
    for key in dict.fromkeys([*required, *strings, *booleans]):
        label = key.replace("_", " ")
        if key in required and data.get(key) in (None, "", []):
            errors[key] = [f"The {label} field is required."]
        elif key in strings and key in data and not isinstance(data[key], str):
            errors[key] = [f"The {label} must be a string."]
        elif key in booleans and key in data:
            if data[key] not in (True, False, 0, 1, "0", "1"):
                errors[key] = [f"The {label} field must be true or false."]
            else:
                data[key] = data[key] in (True, 1, "1")
    if errors:
        raise InvalidInput(errors)


def require_user(request: Request) -> Any:
    user = request.state.user
    if not user:
        raise HTTPException(401, "Unauthenticated.")
    return user


def create_app(
    settings: Any = None,
    *,
    database: Any = None,
    state: Any = None,
    http: Any = None,
    clock: Any = None,
    storage: Any = None,
    enqueue: Any = None,
    mailer: Any = None,
) -> FastAPI:
    settings = settings or Settings()
    db = database or Database(settings.connection_url())
    state = state or RedisState(settings.redis_url)
    if settings.cache_files:
        state = LegacyFileState(
            state, settings.cache_files, clock or (lambda: datetime.now(UTC))
        )
    if settings.legacy_cache_redis_url:
        state = LegacyRedisState(
            state, settings.legacy_cache_redis_url, settings.legacy_cache_redis_prefix
        )
    sessions = Sessions(settings, state)
    services = Services(settings, db, state, client=http, clock=clock)
    app = FastAPI(title="CrimeIsDown", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.services, app.state.db, app.state.sessions = services, db, sessions
    app.state.storage, app.state.enqueue, app.state.mailer = storage, enqueue, mailer
    app.state.settings = settings
    origins = [
        s.strip().rstrip("/") for s in settings.cors_origins.split(",") if s.strip()
    ]

    @app.exception_handler(InvalidInput)
    async def input_error(request: Request, exc: Any) -> Any:
        messages = [message for values in exc.errors.values() for message in values]
        summary = messages[0]
        if len(messages) > 1:
            summary += f" (and {len(messages) - 1} more error" + (
                "s)" if len(messages) > 2 else ")"
            )
        if "json" not in request.headers.get(
            "accept", ""
        ) and not request.url.path.startswith("/api/"):
            import re
            from html import escape

            from fastapi.responses import HTMLResponse

            from .accounts import page

            forms = getattr(app.state, "forms", {})
            render = forms.get(request.url.path)
            response = (
                render(request)
                if render
                else page(request, "Please check your information", "")
            )
            content = response.body.decode()
            notice = (
                '<div class="message" role="alert"><ul>'
                + "".join("<li>" + escape(message) + "</li>" for message in messages)
                + "</ul></div>"
            )
            content = content.replace("</h1>", "</h1>" + notice, 1)
            form_data = getattr(request.state, "form_data", {})
            for name in ("name", "email"):
                if isinstance(form_data.get(name), str):

                    def preserve_value(match: re.Match[str], field: str = name) -> str:
                        return match[1] + escape(form_data[field], quote=True)

                    content = re.sub(
                        r'(name="' + name + r'"[^>]*value=")[^"]*',
                        preserve_value,
                        content,
                    )

            return HTMLResponse(
                content, status_code=422, headers={"Cache-Control": "no-store"}
            )
        return JSONResponse({"message": summary, "errors": exc.errors}, status_code=422)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: Any) -> Any:
        if exc.status_code == 401 and "json" not in request.headers.get("accept", ""):
            return RedirectResponse("/login", status_code=302)
        return JSONResponse(
            {"message": exc.detail}, status_code=exc.status_code, headers=exc.headers
        )

    @app.exception_handler(httpx.HTTPError)
    async def upstream_error(_request: Any, exc: Any) -> Any:
        log.error("Upstream service failed: %s", type(exc).__name__)
        return JSONResponse(
            {"message": "An upstream service is unavailable. Please try again later."},
            status_code=502,
        )

    @app.middleware("http")
    async def context(request: Request, call_next: Any) -> Any:
        session_id, data = sessions.open(request)
        request.state.session_id, request.state.session = session_id, data
        request.state.user, request.state.bearer = None, False
        with db.session() as connection:
            request.state.db = connection
            try:
                if data.get(LOGIN_KEY):
                    request.state.user = db.get(connection, "users", data[LOGIN_KEY])
                recaller = request.cookies.get(REMEMBER_COOKIE)
                if not request.state.user and recaller:
                    value = sessions.cookies.decrypt(REMEMBER_COOKIE, recaller)
                    parts = value.split("|") if value else []
                    if len(parts) == 3 and parts[0].isdigit() and parts[1]:
                        user = db.get(connection, "users", int(parts[0]))
                        if user and hmac.compare_digest(
                            user.get("remember_token") or "", parts[1]
                        ):
                            request.state.user = user
                            sessions.rotate(request)
                            data[LOGIN_KEY] = user["id"]
                authorization = request.headers.get("authorization", "")
                if not request.state.user and authorization.startswith("Bearer "):
                    token = authorization[7:]
                    if "|" in token:
                        token_id, secret = token.split("|", 1)
                        record = (
                            db.get(connection, "personal_access_tokens", int(token_id))
                            if token_id.isdigit()
                            else None
                        )
                    else:
                        secret = token
                        record = db.get(
                            connection,
                            "personal_access_tokens",
                            hashlib.sha256(secret.encode()).hexdigest(),
                            "token",
                        )
                    if (
                        record
                        and hmac.compare_digest(
                            record["token"], hashlib.sha256(secret.encode()).hexdigest()
                        )
                        and record["tokenable_type"] == "App\\Models\\User"
                    ):
                        expires = record.get("expires_at")
                        expires = (
                            datetime.fromisoformat(expires)
                            if isinstance(expires, str)
                            else expires
                        )
                        if not expires or expires.replace(tzinfo=UTC) > services.now():
                            request.state.user = db.get(
                                connection, "users", record["tokenable_id"]
                            )
                            request.state.bearer = request.state.user is not None
                            db.change(
                                connection,
                                "personal_access_tokens",
                                record["id"],
                                {"last_used_at": services.now().replace(tzinfo=None)},
                                services.now(),
                            )
                if request.method not in ("GET", "HEAD", "OPTIONS") and not (
                    request.url.path.startswith("/api/") and request.state.bearer
                ):
                    origin = request.headers.get("origin")
                    expected_origin = str(request.base_url).rstrip("/")
                    if origin and origin.rstrip("/") not in [*origins, expected_origin]:
                        return JSONResponse(
                            {"message": "CSRF token mismatch."}, status_code=419
                        )
                    csrf_token = request.headers.get("x-csrf-token")
                    encrypted = request.headers.get("x-xsrf-token")
                    if encrypted:
                        csrf_token = sessions.cookies.decrypt("XSRF-TOKEN", encrypted)
                    if not csrf_token:
                        body = await request.body()
                        if "application/json" in request.headers.get(
                            "content-type", ""
                        ):
                            try:
                                csrf_token = json.loads(body).get("_token")
                            except ValueError, AttributeError:
                                pass
                        elif "application/x-www-form-urlencoded" in request.headers.get(
                            "content-type", ""
                        ):
                            csrf_token = parse_qs(body.decode()).get("_token", [None])[
                                0
                            ]
                    if not isinstance(csrf_token, str) or not hmac.compare_digest(
                        csrf_token, data["_token"]
                    ):
                        return JSONResponse(
                            {"message": "CSRF token mismatch."}, status_code=419
                        )
                response = await call_next(request)
                if response.status_code < 400:
                    connection.commit()
                else:
                    connection.rollback()
                if not request.state.bearer or not request.url.path.startswith("/api/"):
                    sessions.attach(
                        response, request.state.session_id, request.state.session
                    )
                if request.state.user:
                    response.headers.setdefault("Cache-Control", "private, no-store")
                response.headers.setdefault("X-Content-Type-Options", "nosniff")
                response.headers.setdefault(
                    "Referrer-Policy", "strict-origin-when-cross-origin"
                )
                response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
                return response
            except Exception:
                connection.rollback()
                raise

    # CORS must wrap the session/CSRF middleware: preflights must not create
    # sessions, and rejected writes must still expose their status to the frontend.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Authorization",
            "Content-Type",
            "X-CSRF-TOKEN",
            "X-XSRF-TOKEN",
            "X-Requested-With",
        ],
    )

    @app.get("/sanctum/csrf-cookie")
    def csrf_cookie() -> Any:
        return PlainTextResponse(
            "", status_code=204, headers={"Cache-Control": "no-store"}
        )

    @app.get("/api/user")
    def current_user(request: Request) -> Any:
        return JSONResponse(
            services.user_json(request.state.db, require_user(request)),
            headers={"Cache-Control": "private, max-age=30"},
        )

    @app.get("/api/search-key")
    def search_key(request: Request) -> Any:
        key = services.search_key(request.state.db, require_user(request))
        headers = {"Cache-Control": "private, max-age=60"}
        return (
            PlainTextResponse(key, headers=headers)
            if request.headers.get("accept") == "text/plain"
            else JSONResponse({"meilisearch": key}, headers=headers)
        )

    @app.get("/api/searchTalkgroups")
    def talkgroups(request: Request) -> Any:
        require_user(request)
        return services.talkgroups()

    @app.get("/api/config/notifications.json")
    def configuration(request: Request) -> Any:
        user = require_user(request)
        if str(user.get("patreon_tier_id_override")) != "demo-admin":
            raise HTTPException(403, "Forbidden")
        return services.notification_config(request.state.db)

    def resource(kind: Any, url: Any) -> Any:
        def present(row: Any, listing: Any = False) -> Any:
            result = serialized(row)
            if kind == "transcript_subscriptions":
                for field in ("keywords", "ignore_keywords", "location"):
                    if result.get(field) is not None:
                        value = decoded(result[field])
                        result[field] = (
                            value
                            if field == "location" and listing
                            else legacy_json(value)
                        )
            return result

        def owned(request: Request, key: Any) -> Any:
            user = require_user(request)
            row = db.get(request.state.db, kind, key)
            if not row or row["user_id"] != user["id"]:
                raise HTTPException(404, "Not Found")
            return row

        def validate(request: Request, data: Any, creating: Any) -> Any:
            allowed = {
                "notification_channels": ("service", "path"),
                "saved_searches": ("name", "url"),
                "transcript_subscriptions": (
                    "name",
                    "enabled",
                    "topic",
                    "keywords",
                    "ignore_keywords",
                    "location",
                    "notification_channels",
                ),
            }[kind]
            strings = (
                ("name", "topic") if kind == "transcript_subscriptions" else allowed
            )
            required = (
                ("name", "enabled", "topic", "notification_channels")
                if kind == "transcript_subscriptions"
                else allowed
            )
            fields(
                data,
                required=required if creating else (),
                strings=strings,
                booleans=("enabled",) if kind == "transcript_subscriptions" else (),
            )
            data = {k: v for k, v in data.items() if k in allowed}
            if kind == "transcript_subscriptions":
                for key in ("keywords", "ignore_keywords"):
                    if data.get(key) is not None and not isinstance(data[key], list):
                        invalid(key, f"The {key} field must be an array.")
                    if creating and key in data:
                        data[key] = php_filter(data[key])
                location = data.get("location")
                if location is not None and (
                    not isinstance(location, dict)
                    or set(location) - {"address", "radius", "travel_time", "geo"}
                ):
                    invalid(
                        "location",
                        "The location field must be an array containing only address, radius, travel_time, geo.",
                    )
                if creating and any(
                    r["name"] == data["name"]
                    for r in db.rows(
                        request.state.db, kind, user_id=request.state.user["id"]
                    )
                ):
                    invalid("name", "The name has already been taken.")
                if "notification_channels" in data:
                    ids = data["notification_channels"]
                    if not isinstance(ids, list) or not ids:
                        invalid(
                            "notification_channels",
                            "The notification channels field must have a value.",
                        )
                    for channel_id in ids:
                        if not str(channel_id).isdigit():
                            invalid(
                                "notification_channels", "Invalid notification channel."
                            )
                        channel = db.get(
                            request.state.db, "notification_channels", int(channel_id)
                        )
                        if (
                            not channel
                            or channel["user_id"] != request.state.user["id"]
                        ):
                            invalid(
                                "notification_channels", "Invalid notification channel."
                            )
                    data["notification_channels"] = list(
                        dict.fromkeys(int(i) for i in ids)
                    )
            return data

        def destinations(request: Request, row: Any, ids: Any) -> Any:
            if ids is None:
                return
            db.remove(
                request.state.db,
                "tr_sub_destinations",
                transcript_subscription_id=row["id"],
            )
            for channel_id in ids:
                db.create(
                    request.state.db,
                    "tr_sub_destinations",
                    {
                        "transcript_subscription_id": row["id"],
                        "notification_channel_id": channel_id,
                    },
                    services.now(),
                )

        def listing(request: Request) -> Any:
            user = require_user(request)
            if not services.can_search(request.state.db, user):
                raise HTTPException(403, "You do not have access to transcript search.")
            rows = db.rows(request.state.db, kind, user_id=user["id"])
            if kind == "saved_searches":
                rows = list(
                    {
                        r["id"]: r
                        for r in [
                            *rows,
                            *db.rows(request.state.db, kind, is_global=True),
                        ]
                    }.values()
                )
            result = []
            for row in rows:
                item = present(row, listing=True)
                if kind == "transcript_subscriptions":
                    item["notification_channels"] = [
                        r["notification_channel_id"]
                        for r in db.rows(
                            request.state.db,
                            "tr_sub_destinations",
                            transcript_subscription_id=row["id"],
                        )
                    ]
                result.append(item)
            return result

        async def store(request: Request) -> Any:
            user = require_user(request)
            if not services.can_search(request.state.db, user):
                raise HTTPException(403, "You do not have access to transcript search.")
            data = validate(request, await payload(request), True)
            ids = data.pop("notification_channels", None)
            data["user_id"] = user["id"]
            row = db.create(request.state.db, kind, data, services.now())
            if kind == "transcript_subscriptions":
                destinations(request, row, ids)
            return present(
                {
                    k: v
                    for k, v in row.items()
                    if k in {*data, "id", "created_at", "updated_at"}
                }
            )

        def show(id: int, request: Request) -> Any:
            return present(owned(request, id))

        async def change(id: int, request: Request) -> Any:
            owned(request, id)
            data = validate(request, await payload(request), False)
            ids = data.pop("notification_channels", None)
            row = db.change(request.state.db, kind, id, data, services.now())
            if kind == "transcript_subscriptions":
                destinations(request, row, ids)
            result = present(row)
            if kind == "transcript_subscriptions":
                result.update(
                    {
                        k: v
                        for k, v in data.items()
                        if k in ("keywords", "ignore_keywords", "location")
                    }
                )
            return result

        def destroy(id: int, request: Request) -> Any:
            row = owned(request, id)
            if kind == "notification_channels":
                db.remove(
                    request.state.db, "tr_sub_destinations", notification_channel_id=id
                )
                for sub in db.rows(
                    request.state.db, "transcript_subscriptions", user_id=row["user_id"]
                ):
                    if not db.rows(
                        request.state.db,
                        "tr_sub_destinations",
                        transcript_subscription_id=sub["id"],
                    ):
                        db.remove(
                            request.state.db, "transcript_subscriptions", id=sub["id"]
                        )
            elif kind == "transcript_subscriptions":
                db.remove(
                    request.state.db,
                    "tr_sub_destinations",
                    transcript_subscription_id=id,
                )
            db.remove(request.state.db, kind, id=id)
            return present(row)

        for suffix, endpoint, methods in [
            ("", listing, ["GET"]),
            ("", store, ["POST"]),
            ("/{id}", show, ["GET"]),
            ("/{id}", change, ["PUT", "PATCH"]),
            ("/{id}", destroy, ["DELETE"]),
        ]:
            app.add_api_route(
                "/api/" + url + suffix,
                cast(Callable[..., Any], endpoint),
                methods=methods,
            )

    resource("saved_searches", "savedSearches")
    resource("notification_channels", "notificationChannels")
    resource("transcript_subscriptions", "transcriptSubscriptions")

    from .accounts import register_accounts
    from .audio import register_audio
    from .health import register_health

    register_accounts(app, db, services, sessions)
    register_audio(app, db, services)
    register_health(app, services)

    if settings.frontend_dir.is_dir():
        app.frontend("/", directory=settings.frontend_dir)
    return app
