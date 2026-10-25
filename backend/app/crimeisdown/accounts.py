import hashlib
import hmac
import secrets
import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from html import escape
from typing import Any
from urllib.parse import quote, urlencode, urlparse

from authlib.integrations.httpx_client import OAuth2Client
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import insert
from sqlalchemy.exc import IntegrityError

from .application import fields, invalid, payload, require_user
from .security import LOGIN_KEY, REMEMBER_COOKIE, password_hash, password_valid


def page(request: Any, title: Any, content: Any) -> Any:
    token = escape(request.state.session["_token"], quote=True)
    notice = request.state.session.pop("_cid_notice", None)
    if notice:
        content = (
            '<p class="message" role="status">' + escape(notice) + "</p>" + content
        )
    content = content.replace(
        "<!--csrf-->", f'<input type="hidden" name="_token" value="{token}">'
    )
    user = request.state.user
    logo = '<img src="https://avatars.githubusercontent.com/u/12685745" alt="CrimeIsDown.com">'
    if user:
        navigation = (
            '<nav><div class="navigation"><a href="/dashboard">'
            + logo
            + '</a><a href="/dashboard">Dashboard</a><details><summary>'
            + escape(user["name"])
            + '</summary><div class="menu"><a href="/profile">Profile</a><form method="post" action="/logout">'
            + f'<input type="hidden" name="_token" value="{token}">'
            + '<button>Log out</button></form></div></details></div></nav><header class="page-title"><h1>'
            + escape(title)
            + "</h1></header>"
        )
        body_class = ""
        heading = ""
    else:
        navigation = '<a class="logo" href="https://crimeisdown.com">' + logo + "</a>"
        body_class = "guest"
        heading = "<h1>" + escape(title) + "</h1>"
    # Profile sections follow the existing account layout; all fields remain native.
    if title == "Profile":
        content = content.replace(
            "<h2>Update password", "</section><section><h2>Update password"
        ).replace("<h2>Delete account", "</section><section><h2>Delete account")
    return HTMLResponse(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<meta name="csrf-token" content="'
        + token
        + '"><title>'
        + escape(title)
        + " — CrimeIsDown.com</title>"
        + '<link rel="stylesheet" href="https://fonts.bunny.net/css2?family=Nunito:wght@400;600;700&display=swap">'
        + '<link rel="stylesheet" href="/account-assets/accounts.css"></head><body class="'
        + body_class
        + '">'
        + navigation
        + "<main><section>"
        + heading
        + content
        + "</section></main></body></html>",
        headers={"Cache-Control": "no-store"},
    )


def input_field(
    name: Any, label: Any, type: Any = "text", value: Any = "", required: Any = True
) -> Any:
    return f'<label>{escape(label)}<input name="{name}" type="{type}" value="{escape(str(value or ""), quote=True)}" {"required" if required else ""}></label>'


def send_mail(app: Any, to: Any, subject: Any, body: Any) -> Any:
    if app.state.mailer:
        app.state.mailer(to, subject, body)
        return
    settings = app.state.settings
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = (
        settings.emails_from_email,
        to,
        subject,
    )
    message.set_content(body)
    cls = smtplib.SMTP_SSL if settings.smtp_ssl else smtplib.SMTP
    with cls(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        if settings.smtp_tls and not settings.smtp_ssl:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password.get_secret_value())
        smtp.send_message(message)


def safe_return_url(value: Any, settings: Any, default: str = "/dashboard") -> str:
    if not isinstance(value, str) or "\\" in value or any(ord(c) < 32 for c in value):
        return default
    parsed = urlparse(value)
    if value.startswith("/") and not value.startswith("//"):
        return value
    allowed = [v.strip().rstrip("/") for v in settings.cors_origins.split(",")]
    return (
        value
        if parsed.scheme in ("http", "https")
        and parsed.scheme + "://" + parsed.netloc in allowed
        else default
    )


def register_accounts(app: FastAPI, db: Any, services: Any, sessions: Any) -> Any:
    s = services.settings
    from pathlib import Path

    from starlette.staticfiles import StaticFiles

    app.mount(
        "/account-assets",
        StaticFiles(directory=Path(__file__).parent / "account_assets"),
        name="account-assets",
    )

    def email_check(data: Any) -> Any:
        from email_validator import EmailNotValidError, validate_email

        try:
            validate_email(
                data.get("email", ""), check_deliverability=False, test_environment=True
            )
        except EmailNotValidError:
            invalid("email", "The email field must be a valid email address.")
        if len(data["email"]) > 255:
            invalid("email", "The email field must not be greater than 255 characters.")

    def new_password(data: Any) -> Any:
        password = data.get("password")
        if not isinstance(password, str) or len(password) < 8:
            invalid("password", "The password field must be at least 8 characters.")
        if len(password.encode()) > 72:
            invalid("password", "The password must not exceed 72 bytes.")
        if password != data.get("password_confirmation"):
            invalid("password", "The password field confirmation does not match.")
        return password

    def login_user(request: Any, user: Any) -> Any:
        sessions.rotate(request)
        request.state.session[LOGIN_KEY] = user["id"]
        request.state.user = user

    def done(request: Any, location: Any, message: Any = None) -> Any:
        if "json" in request.headers.get("accept", ""):
            return JSONResponse({"message": message or "OK"})
        if message:
            request.state.session["_cid_notice"] = message
        return RedirectResponse(location, status_code=302)

    @app.get("/login")
    def login_form(request: Request) -> Any:
        if request.state.user:
            return RedirectResponse("/dashboard", status_code=302)
        return page(
            request,
            "Log in",
            '<form method="post"><!--csrf-->'
            + input_field("email", "Email", "email")
            + input_field("password", "Password", "password")
            + '<label class="remember"><input type="checkbox" name="remember" value="1">Remember me</label><div class="actions"><a href="/forgot-password">Forgot your password?</a><button>Log in</button></div><a class="patreon" href="/auth/redirect"><img src="/account-assets/login-with-patreon.png" alt="Log in with Patreon" width="272" height="42"></a></form>',
        )

    @app.post("/login")
    async def login(request: Request) -> Any:
        data = await payload(request)
        fields(data, required=("email", "password"), strings=("email", "password"))
        email_check(data)
        throttle = (
            "login:"
            + hashlib.sha256(
                (
                    data["email"].lower()
                    + "|"
                    + (request.client.host if request.client else "unknown")
                ).encode()
            ).hexdigest()
        )
        if (services.state.get(throttle) or 0) >= 5:
            invalid("email", "Too many login attempts. Please try again in 60 seconds.")
        user = db.get(request.state.db, "users", data["email"], "email")
        if not user or not password_valid(data["password"], user["password"]):
            services.state.increment(throttle, 60)
            invalid("email", "These credentials do not match our records.")
        services.state.delete(throttle)
        login_user(request, user)
        response = done(request, "/dashboard")
        if data.get("remember") in (True, 1, "1", "on"):
            token = user.get("remember_token") or secrets.token_hex(30)
            db.change(
                request.state.db,
                "users",
                user["id"],
                {"remember_token": token},
                services.now(),
            )
            response.set_cookie(
                REMEMBER_COOKIE,
                quote(
                    sessions.cookies.encrypt(
                        REMEMBER_COOKIE,
                        str(user["id"]) + "|" + token + "|" + user["password"],
                    ),
                    safe="",
                ),
                max_age=157680000,
                httponly=True,
                secure=s.session_secure_cookie,
                domain=s.session_domain,
                samesite="lax",
            )
        return response

    @app.get("/logout")
    def logout_form(request: Request) -> Any:
        require_user(request)
        destination = safe_return_url(
            request.query_params.get("return_to") or request.headers.get("referer", ""),
            s,
            "/",
        )
        return page(
            request,
            "Log out",
            '<p>Are you sure you want to log out?</p><form method="post"><!--csrf--><input type="hidden" name="return_to" value="'
            + escape(destination, quote=True)
            + '"><button>Log out</button></form>',
        )

    @app.post("/logout")
    async def logout(request: Request) -> Any:
        user = require_user(request)
        data = await payload(request)
        destination = safe_return_url(data.get("return_to"), s, "/")
        if user.get("remember_token"):
            db.change(
                request.state.db,
                "users",
                user["id"],
                {"remember_token": secrets.token_hex(30)},
                services.now(),
            )
        sessions.rotate(request)
        request.state.session = {"_token": secrets.token_hex(20)}
        response = done(request, destination)
        response.delete_cookie(REMEMBER_COOKIE, domain=s.session_domain)
        return response

    @app.get("/register")
    def registration_form(request: Request) -> Any:
        return page(
            request,
            "Register",
            '<form method="post"><!--csrf-->'
            + input_field("name", "Name")
            + input_field("email", "Email", "email")
            + input_field("password", "Password", "password")
            + input_field("password_confirmation", "Confirm password", "password")
            + "<button>Register</button></form>",
        )

    @app.post("/register")
    async def register(request: Request) -> Any:
        data = await payload(request)
        fields(
            data,
            required=("name", "email", "password"),
            strings=("name", "email", "password"),
        )
        email_check(data)
        if len(data["name"]) > 255:
            invalid("name", "The name field must not be greater than 255 characters.")
        password = new_password(data)
        if db.get(request.state.db, "users", data["email"], "email"):
            invalid("email", "The email has already been taken.")
        try:
            user = db.create(
                request.state.db,
                "users",
                {
                    "name": data["name"],
                    "email": data["email"],
                    "password": password_hash(password),
                },
                services.now(),
            )
        except IntegrityError:
            invalid("email", "The email has already been taken.")
        login_user(request, user)
        return done(request, "/dashboard")

    @app.get("/dashboard")
    def dashboard(request: Request) -> Any:
        user = require_user(request)
        tier = services.tier(request.state.db, user)
        content = (
            "<p>You're logged in!</p><p>"
            + escape(user["name"])
            + (
                "</p><p>Your Patreon tier: " + escape(tier["name"])
                if tier
                else "</p><p>You are not currently a Patron."
            )
            + '</p><p><a href="/profile">Edit profile</a></p><form method="post" action="/logout"><!--csrf--><button>Log out</button></form>'
        )
        return page(request, "Dashboard", content)

    @app.get("/profile")
    def profile(request: Request) -> Any:
        user = require_user(request)
        content = (
            '<h2>Profile information</h2><p>Update your account&#39;s profile information and email address.</p><form method="post" action="/profile"><!--csrf-->'
            + input_field("name", "Name", value=user["name"])
            + input_field("email", "Email", "email", user["email"])
            + '<button>Save</button></form><h2>Update password</h2><p>Ensure your account is using a long, random password to stay secure.</p><form method="post" action="/password"><!--csrf-->'
        )
        if user["password"]:
            content += input_field("current_password", "Current password", "password")
        content += (
            input_field("password", "New password", "password")
            + input_field("password_confirmation", "Confirm password", "password")
            + '<button>Save password</button></form><h2>Delete account</h2><p>Once your account is deleted, all of its resources and data will be permanently deleted.</p><button class="danger" type="button" onclick="document.getElementById(&quot;delete-account&quot;).showModal()">Delete account</button><dialog id="delete-account"><h2>Are you sure you want to delete your account?</h2><p>Please enter your password to confirm you would like to permanently delete your account.</p><form method="post" action="/profile/delete"><!--csrf-->'
            + input_field("password", "Password", "password")
            + '<div class="actions"><button class="cancel" type="button" onclick="document.getElementById(&quot;delete-account&quot;).close()">Cancel</button><button class="danger">Delete account</button></div></form></dialog>'
        )
        return page(request, "Profile", content)

    @app.api_route("/profile", methods=["PATCH", "POST"])
    async def change_profile(request: Request) -> Any:
        user = require_user(request)
        data = await payload(request)
        fields(data, strings=("name", "email"))
        changes = {k: v for k, v in data.items() if k in ("name", "email")}
        if "email" in changes:
            email_check(changes)
            duplicate = db.get(request.state.db, "users", changes["email"], "email")
            if duplicate and duplicate["id"] != user["id"]:
                invalid("email", "The email has already been taken.")
            if changes["email"] != user["email"]:
                changes["email_verified_at"] = None
        if "name" in changes and len(changes["name"]) > 255:
            invalid("name", "The name field must not be greater than 255 characters.")
        db.change(request.state.db, "users", user["id"], changes, services.now())
        return done(request, "/profile", "Profile updated.")

    @app.api_route("/password", methods=["PUT", "POST"])
    async def change_password(request: Request) -> Any:
        user = require_user(request)
        data = await payload(request)
        if user["password"] or not user.get("patreon_id"):
            if not password_valid(data.get("current_password"), user["password"]):
                invalid("current_password", "The password is incorrect.")
        db.change(
            request.state.db,
            "users",
            user["id"],
            {"password": password_hash(new_password(data))},
            services.now(),
        )
        return done(request, "/profile", "Password updated.")

    async def delete_profile(request: Request) -> Any:
        user = require_user(request)
        data = await payload(request)
        if not password_valid(data.get("password"), user["password"]):
            invalid("password", "The password is incorrect.")
        session = request.state.db
        for sub in db.rows(session, "transcript_subscriptions", user_id=user["id"]):
            db.remove(
                session, "tr_sub_destinations", transcript_subscription_id=sub["id"]
            )
        for table in (
            "transcript_subscriptions",
            "notification_channels",
            "saved_searches",
            "audio_range_exports",
        ):
            db.remove(session, table, user_id=user["id"])
        db.remove(
            session,
            "personal_access_tokens",
            tokenable_type="App\\Models\\User",
            tokenable_id=user["id"],
        )
        db.remove(session, "password_resets", email=user["email"])
        db.remove(session, "users", id=user["id"])
        sessions.rotate(request)
        request.state.session = {"_token": secrets.token_hex(20)}
        response = done(request, "/")
        response.delete_cookie(REMEMBER_COOKIE, domain=s.session_domain)
        return response

    app.add_api_route("/profile", delete_profile, methods=["DELETE"])
    app.add_api_route("/profile/delete", delete_profile, methods=["POST"])

    @app.get("/forgot-password")
    def forgot_form(request: Request) -> Any:
        return page(
            request,
            "Forgot your password?",
            '<p>Enter your email and we will send a password reset link.</p><form method="post"><!--csrf-->'
            + input_field("email", "Email", "email")
            + "<button>Email password reset link</button></form>",
        )

    @app.post("/forgot-password")
    async def forgot(request: Request) -> Any:
        data = await payload(request)
        fields(data, required=("email",), strings=("email",))
        email_check(data)
        user = db.get(request.state.db, "users", data["email"], "email")
        if not user:
            invalid("email", "We can't find a user with that email address.")
        old = db.get(request.state.db, "password_resets", user["email"], "email")
        now = services.now().replace(tzinfo=None)
        if old:
            created = old["created_at"]
            created = (
                datetime.fromisoformat(created) if isinstance(created, str) else created
            )
            if created and (now - created).total_seconds() < 60:
                invalid("email", "Please wait before retrying.")
        token = secrets.token_hex(32)
        db.remove(request.state.db, "password_resets", email=user["email"])
        request.state.db.execute(
            insert(db.table("password_resets")).values(
                email=user["email"], token=password_hash(token), created_at=now
            )
        )
        link = (
            s.app_url.rstrip("/")
            + "/reset-password/"
            + token
            + "?"
            + urlencode({"email": user["email"]})
        )
        send_mail(
            app,
            user["email"],
            "Reset Password Notification",
            "Reset your password: " + link + "\nThis link expires in 60 minutes.",
        )
        return done(
            request, "/forgot-password", "We have emailed your password reset link."
        )

    @app.get("/reset-password/{token}")
    def reset_form(token: str, request: Request) -> Any:
        return page(
            request,
            "Reset password",
            '<form method="post" action="/reset-password"><!--csrf--><input type="hidden" name="token" value="'
            + escape(token, quote=True)
            + '">'
            + input_field(
                "email", "Email", "email", request.query_params.get("email", "")
            )
            + input_field("password", "Password", "password")
            + input_field("password_confirmation", "Confirm password", "password")
            + "<button>Reset password</button></form>",
        )

    @app.post("/reset-password")
    async def reset(request: Request) -> Any:
        data = await payload(request)
        fields(
            data,
            required=("email", "token", "password"),
            strings=("email", "token", "password"),
        )
        email_check(data)
        password = new_password(data)
        reset = db.get(request.state.db, "password_resets", data["email"], "email")
        created = reset.get("created_at") if reset else None
        created = (
            datetime.fromisoformat(created) if isinstance(created, str) else created
        )
        if (
            not reset
            or not created
            or created.replace(tzinfo=UTC) + timedelta(minutes=60) < services.now()
            or not password_valid(data["token"], reset["token"])
        ):
            invalid("email", "This password reset token is invalid.")
        user = db.get(request.state.db, "users", data["email"], "email")
        if not user:
            invalid("email", "We can't find a user with that email address.")
        db.change(
            request.state.db,
            "users",
            user["id"],
            {
                "password": password_hash(password),
                "remember_token": secrets.token_hex(30),
            },
            services.now(),
        )
        db.remove(request.state.db, "password_resets", email=data["email"])
        return done(request, "/login", "Your password has been reset.")

    @app.get("/confirm-password")
    def confirm_form(request: Request) -> Any:
        require_user(request)
        return page(
            request,
            "Confirm password",
            '<form method="post"><!--csrf-->'
            + input_field("password", "Password", "password")
            + "<button>Confirm</button></form>",
        )

    @app.post("/confirm-password")
    async def confirm(request: Request) -> Any:
        user = require_user(request)
        data = await payload(request)
        if not password_valid(data.get("password"), user["password"]):
            invalid("password", "The provided password is incorrect.")
        request.state.session["auth.password_confirmed_at"] = int(
            services.now().timestamp()
        )
        return done(request, "/dashboard")

    @app.get("/verify-email")
    def verify_form(request: Request) -> Any:
        user = require_user(request)
        if user.get("email_verified_at"):
            return RedirectResponse("/dashboard", status_code=302)
        return page(
            request,
            "Verify email",
            '<p>Check your email for a verification link.</p><form method="post" action="/email/verification-notification"><!--csrf--><button>Resend verification email</button></form>',
        )

    def signed_link(user: Any) -> Any:
        path = (
            "/verify-email/"
            + str(user["id"])
            + "/"
            + hashlib.sha1(user["email"].encode()).hexdigest()
        )
        link = (
            s.app_url.rstrip("/")
            + path
            + "?"
            + urlencode(
                {"expires": int((services.now() + timedelta(hours=1)).timestamp())}
            )
        )
        signature = hmac.new(
            s.app_key.get_secret_value().encode(), link.encode(), hashlib.sha256
        ).hexdigest()
        return link + "&signature=" + signature

    @app.post("/email/verification-notification")
    def verification_email(request: Request) -> Any:
        user = require_user(request)
        if services.state.increment("verify:" + str(user["id"]), 60) > 6:
            raise HTTPException(429, "Too Many Attempts.")
        if not user.get("email_verified_at"):
            send_mail(
                app,
                user["email"],
                "Verify Email Address",
                "Verify your email: " + signed_link(user),
            )
        return done(request, "/verify-email", "verification-link-sent")

    @app.get("/verify-email/{user_id}/{email_hash}")
    def verify(user_id: int, email_hash: str, request: Request) -> Any:
        user = require_user(request)
        if user_id != user["id"] or not hmac.compare_digest(
            email_hash, hashlib.sha1(user["email"].encode()).hexdigest()
        ):
            raise HTTPException(403, "Forbidden")
        query = [
            (k, v) for k, v in request.query_params.multi_items() if k != "signature"
        ]
        url = s.app_url.rstrip("/") + request.url.path + "?" + urlencode(query)
        expected = hmac.new(
            s.app_key.get_secret_value().encode(), url.encode(), hashlib.sha256
        ).hexdigest()
        expires = request.query_params.get("expires", "")
        if (
            not expires.isdigit()
            or int(expires) < services.now().timestamp()
            or not hmac.compare_digest(
                expected, request.query_params.get("signature", "")
            )
        ):
            raise HTTPException(403, "Invalid signature.")
        db.change(
            request.state.db,
            "users",
            user_id,
            {"email_verified_at": services.now().replace(tzinfo=None)},
            services.now(),
        )
        return RedirectResponse("/dashboard?verified=1", status_code=302)

    @app.get("/auth/redirect")
    def patreon_redirect(request: Request) -> Any:
        if not s.patreon_client_id or not s.patreon_redirect_uri:
            raise HTTPException(503, "Patreon login is not configured.")
        state = secrets.token_urlsafe(32)
        request.state.session["state"] = state
        referer = request.query_params.get("return_to") or request.headers.get(
            "referer", ""
        )
        request.state.session["redirect_url"] = safe_return_url(referer, s)
        return RedirectResponse(
            s.patreon_authorize_url
            + "?"
            + urlencode(
                {
                    "response_type": "code",
                    "client_id": s.patreon_client_id,
                    "redirect_uri": s.patreon_redirect_uri,
                    "scope": "campaigns identity identity[email]",
                    "state": state,
                }
            ),
            status_code=302,
        )

    @app.get("/auth/callback")
    def patreon_callback(request: Request) -> Any:
        state = request.query_params.get("state", "")
        expected = request.state.session.pop("state", "")
        if (
            not expected
            or not hmac.compare_digest(state, expected)
            or not request.query_params.get("code")
        ):
            raise HTTPException(400, "Invalid OAuth state.")
        # OAuth token exchange uses the maintained Authlib implementation.
        factory = getattr(services, "oauth_client_factory", OAuth2Client)
        with factory(
            s.patreon_client_id,
            s.patreon_client_secret.get_secret_value(),
            token_endpoint_auth_method="client_secret_post",
            timeout=30,
        ) as client:
            tokens = client.fetch_token(
                s.patreon_api_url + "/api/oauth2/token",
                code=request.query_params["code"],
                redirect_uri=s.patreon_redirect_uri,
            )
        identity = services.http.get(
            s.patreon_api_url + "/api/oauth2/v2/identity",
            headers={"Authorization": "Bearer " + tokens["access_token"]},
            params={"fields[user]": "full_name,email"},
        )
        identity.raise_for_status()
        person = identity.json()["data"]
        attrs = person["attributes"]
        user = db.get(request.state.db, "users", person["id"], "patreon_id")
        changes = {
            "name": attrs["full_name"],
            "email": attrs["email"],
            "patreon_token": tokens["access_token"],
            "patreon_refresh_token": tokens.get("refresh_token"),
        }
        try:
            user = (
                db.change(
                    request.state.db, "users", user["id"], changes, services.now()
                )
                if user
                else db.create(
                    request.state.db,
                    "users",
                    dict(changes, patreon_id=person["id"]),
                    services.now(),
                )
            )
        except IntegrityError:
            raise HTTPException(
                409,
                "An account with this email already exists. Sign in to that account before linking Patreon.",
            ) from None
        login_user(request, user)
        destination = safe_return_url(
            request.state.session.pop("redirect_url", "/dashboard"), s
        )
        return RedirectResponse(destination, status_code=302)

    app.state.forms = {
        "/login": login_form,
        "/register": registration_form,
        "/profile": profile,
        "/profile/delete": profile,
        "/password": profile,
        "/forgot-password": forgot_form,
        "/reset-password": lambda request: reset_form(
            getattr(request.state, "form_data", {}).get("token", ""), request
        ),
        "/confirm-password": confirm_form,
    }
    for old, new in (
        ("/settings", "/profile"),
        ("/signup", "/register"),
        ("/recover-password", "/forgot-password"),
    ):

        def alias(destination: str = new) -> RedirectResponse:
            return RedirectResponse(destination, status_code=302)

        app.add_api_route(old, alias, methods=["GET"])
