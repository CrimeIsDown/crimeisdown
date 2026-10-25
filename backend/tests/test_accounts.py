from datetime import timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import insert

from app.crimeisdown.security import (
    LOGIN_KEY,
    password_hash,
    password_valid,
)

from .conftest import NOW, bearer


def csrf(client):
    assert client.get("/sanctum/csrf-cookie").status_code == 204
    return {
        "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
        "Accept": "application/json",
    }


def test_login_csrf_rotation_profile_password_and_logout(pair):
    _, app, client, *_ = pair
    headers = csrf(client)
    old_session = app.state.sessions.cookies.decrypt(
        app.state.settings.session_cookie,
        client.cookies.get(app.state.settings.session_cookie),
    )
    assert (
        client.post(
            "/login",
            json={"email": "user1@example.com", "password": "password123"},
            headers={"Accept": "application/json"},
        ).status_code
        == 419
    )
    login = client.post(
        "/login",
        json={"email": "user1@example.com", "password": "password123"},
        headers=headers,
    )
    assert login.status_code == 200
    new_session = app.state.sessions.cookies.decrypt(
        app.state.settings.session_cookie,
        client.cookies.get(app.state.settings.session_cookie),
    )
    assert new_session != old_session and app.state.sessions.read(old_session) is None
    assert client.get("/api/user").json()["id"] == 1
    headers = {
        "Accept": "application/json",
        "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
    }
    assert (
        client.patch(
            "/profile",
            json={"name": "Updated", "email": "new@example.com"},
            headers=headers,
        ).status_code
        == 200
    )
    assert client.get("/api/user").json()["name"] == "Updated"
    assert (
        client.put(
            "/password",
            json={
                "current_password": "wrong",
                "password": "next-password",
                "password_confirmation": "next-password",
            },
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/password",
            json={
                "current_password": "password123",
                "password": "next-password",
                "password_confirmation": "next-password",
            },
            headers=headers,
        ).status_code
        == 200
    )
    with app.state.db.session() as session:
        assert password_valid(
            "next-password", app.state.db.get(session, "users", 1)["password"]
        )
    assert client.post("/logout", headers=headers).status_code == 200
    assert (
        client.get("/api/user", headers={"Accept": "application/json"}).status_code
        == 401
    )


def test_registration_and_password_reset_share_existing_tables(pair):
    _, app, client, _, mail = pair
    headers = csrf(client)
    response = client.post(
        "/register",
        headers=headers,
        json={
            "name": "New User",
            "email": "new@example.com",
            "password": "password456",
            "password_confirmation": "password456",
        },
    )
    assert response.status_code == 200
    user = client.get("/api/user").json()
    assert isinstance(user["id"], int) and user["id"] > 5
    headers["X-XSRF-TOKEN"] = client.cookies.get("XSRF-TOKEN")
    assert (
        client.post(
            "/forgot-password", headers=headers, json={"email": "new@example.com"}
        ).status_code
        == 200
    )
    link = mail[-1][2].split("Reset your password: ")[1].split("\n")[0]
    token = urlparse(link).path.rsplit("/", 1)[1]
    assert (
        client.post(
            "/reset-password",
            headers=headers,
            json={
                "email": "new@example.com",
                "token": token,
                "password": "new-password",
                "password_confirmation": "new-password",
            },
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/reset-password",
            headers=headers,
            json={
                "email": "new@example.com",
                "token": token,
                "password": "another-pass",
                "password_confirmation": "another-pass",
            },
        ).status_code
        == 422
    )
    with app.state.db.session() as session:
        assert password_valid(
            "new-password", app.state.db.get(session, "users", user["id"])["password"]
        )


def test_existing_reset_token_is_accepted_and_credentials_preserved(pair):
    _, app, client, *_ = pair
    with app.state.db.session() as session:
        session.execute(
            insert(app.state.db.table("password_resets")).values(
                email="user1@example.com",
                token=password_hash("old-reset-token"),
                created_at=NOW.replace(tzinfo=None),
            )
        )
        session.commit()
    assert (
        client.post(
            "/reset-password",
            headers=csrf(client),
            json={
                "email": "user1@example.com",
                "token": "old-reset-token",
                "password": "replacement-pass",
                "password_confirmation": "replacement-pass",
            },
        ).status_code
        == 200
    )
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        assert user["patreon_tier_id_override"] == "demo-sergeant"
        assert password_valid("replacement-pass", user["password"])


def test_csrf_blocks_untrusted_origin_and_expired_tokens(pair):
    _, app, client, *_ = pair
    headers = csrf(client)
    headers["Origin"] = "https://attacker.example"
    assert (
        client.post(
            "/login",
            headers=headers,
            json={"email": "user1@example.com", "password": "password123"},
        ).status_code
        == 419
    )
    with app.state.db.session() as session:
        app.state.db.change(
            session,
            "personal_access_tokens",
            1,
            {"expires_at": (NOW - timedelta(seconds=1)).replace(tzinfo=None)},
            NOW,
        )
        session.commit()
    assert client.get("/api/user", headers=bearer()).status_code == 401


def test_remember_me_reauthenticates_without_session_cookie(pair):
    _, app, client, *_ = pair
    headers = csrf(client)
    response = client.post(
        "/login",
        headers=headers,
        json={
            "email": "user1@example.com",
            "password": "password123",
            "remember": True,
        },
    )
    assert response.status_code == 200
    from app.crimeisdown.security import REMEMBER_COOKIE

    remembered = client.cookies.get(REMEMBER_COOKIE)
    assert remembered
    client.cookies.delete(app.state.settings.session_cookie)
    assert client.get("/api/user").json()["id"] == 1
    assert (
        client.post(
            "/logout",
            headers={
                "Accept": "application/json",
                "X-XSRF-TOKEN": client.cookies.get("XSRF-TOKEN"),
            },
        ).status_code
        == 200
    )
    client.cookies.set(REMEMBER_COOKIE, remembered)
    assert (
        client.get("/api/user", headers={"Accept": "application/json"}).status_code
        == 401
    )


def test_password_confirmation_verification_and_profile_deletion(pair):
    _, app, client, _, mail = pair
    headers = csrf(client)
    assert (
        client.post(
            "/login",
            headers=headers,
            json={"email": "user1@example.com", "password": "password123"},
        ).status_code
        == 200
    )
    headers["X-XSRF-TOKEN"] = client.cookies.get("XSRF-TOKEN")
    assert client.get("/dashboard").status_code == 200
    assert client.get("/confirm-password").status_code == 200
    assert (
        client.post(
            "/confirm-password", headers=headers, json={"password": "wrong"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/confirm-password", headers=headers, json={"password": "password123"}
        ).status_code
        == 200
    )
    assert client.get("/verify-email").status_code == 200
    assert (
        client.post("/email/verification-notification", headers=headers).status_code
        == 200
    )
    assert mail[-1][0] == "user1@example.com"
    link = mail[-1][2].split("Verify your email: ")[1]
    assert client.get(link.replace("signature=", "signature=bad")).status_code == 403
    assert client.get(link).status_code == 302
    assert client.get("/verify-email").status_code == 302
    assert (
        client.post("/email/verification-notification", headers=headers).status_code
        == 200
    )
    assert len(mail) == 1
    assert (
        client.patch(
            "/profile", headers=headers, json={"email": "user2@example.com"}
        ).status_code
        == 422
    )
    saved = client.post(
        "/api/savedSearches",
        headers=headers,
        json={"name": "Before delete", "url": "/search"},
    )
    assert saved.status_code == 200
    assert (
        client.request(
            "DELETE", "/profile", headers=headers, json={"password": "wrong"}
        ).status_code
        == 422
    )
    assert (
        client.request(
            "DELETE", "/profile", headers=headers, json={"password": "password123"}
        ).status_code
        == 200
    )
    assert (
        client.get("/api/user", headers={"Accept": "application/json"}).status_code
        == 401
    )
    with app.state.db.session() as session:
        assert app.state.db.get(session, "users", 1) is None
        assert app.state.db.get(session, "users", 2) is not None
        assert app.state.db.rows(session, "saved_searches", user_id=1) == []


def test_account_validation_lockout_and_reset_throttle(pair):
    _, app, client, *_ = pair
    headers = csrf(client)
    assert client.get("/register").status_code == 200
    assert client.get("/forgot-password").status_code == 200
    assert (
        client.get("/reset-password/token?email=user1@example.com").status_code == 200
    )
    assert (
        client.post(
            "/register",
            headers=headers,
            json={
                "name": "Name",
                "email": "user1@example.com",
                "password": "password123",
                "password_confirmation": "password123",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/register",
            headers=headers,
            json={
                "name": "Name",
                "email": "bad",
                "password": "short",
                "password_confirmation": "different",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/register",
            headers=headers,
            json={
                "name": "Name",
                "email": "new@example.com",
                "password": "password123",
                "password_confirmation": "different",
            },
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/forgot-password", headers=headers, json={"email": "missing@example.com"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/forgot-password", headers=headers, json={"email": "user1@example.com"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/forgot-password", headers=headers, json={"email": "user1@example.com"}
        ).status_code
        == 422
    )
    for _ in range(5):
        assert (
            client.post(
                "/login",
                headers=headers,
                json={"email": "user1@example.com", "password": "wrong"},
            ).status_code
            == 422
        )
    blocked = client.post(
        "/login",
        headers=headers,
        json={"email": "user1@example.com", "password": "password123"},
    )
    assert blocked.status_code == 422 and "Too many login attempts" in blocked.text


def test_patreon_only_account_can_set_password_and_unverify_changed_email(pair):
    _, app, client, *_ = pair
    with app.state.db.session() as session:
        app.state.db.change(
            session,
            "users",
            1,
            {
                "password": None,
                "patreon_id": "only-patreon",
                "email_verified_at": NOW.replace(tzinfo=None),
            },
            NOW,
        )
        session.commit()
    headers = csrf(client)
    sid = app.state.sessions.cookies.decrypt(
        app.state.settings.session_cookie,
        client.cookies.get(app.state.settings.session_cookie),
    )
    state = app.state.sessions.read(sid)
    state[LOGIN_KEY] = 1
    app.state.sessions.save(sid, state)
    assert client.get("/profile").status_code == 200
    assert (
        client.put(
            "/password",
            headers=headers,
            json={
                "password": "added-password",
                "password_confirmation": "added-password",
            },
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/profile", headers=headers, json={"email": "changed@example.com"}
        ).status_code
        == 200
    )
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        assert password_valid("added-password", user["password"])
        assert (
            user["email_verified_at"] is None and user["patreon_id"] == "only-patreon"
        )


def test_patreon_oauth_preserves_account_and_rejects_replay(pair):
    import httpx
    from authlib.integrations.httpx_client import OAuth2Client

    _, app, client, *_ = pair
    service = app.state.services
    service.settings.patreon_client_id = "client"
    from pydantic import SecretStr

    service.settings.patreon_client_secret = SecretStr("secret")
    service.settings.patreon_redirect_uri = "http://testserver/auth/callback"
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        original_hash = user["password"]
        app.state.db.change(session, "users", 1, {"patreon_id": "existing-id"}, NOW)
        session.commit()

    def upstream(request):
        if request.url.path.endswith("/token"):
            assert b"code=valid-code" in request.content
            return httpx.Response(
                200,
                json={
                    "access_token": "access",
                    "refresh_token": "refresh",
                    "token_type": "Bearer",
                },
            )
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "existing-id",
                    "attributes": {
                        "full_name": "Patreon Name",
                        "email": "user1@example.com",
                    },
                }
            },
        )

    service.http = httpx.Client(transport=httpx.MockTransport(upstream))
    service.oauth_client_factory = lambda *args, **kw: OAuth2Client(
        *args, transport=httpx.MockTransport(upstream), **kw
    )
    redirect = client.get(
        "/auth/redirect", headers={"referer": "https://attacker.example/path"}
    )
    state = parse_qs(urlparse(redirect.headers["location"]).query)["state"][0]
    callback = client.get(
        "/auth/callback", params={"state": state, "code": "valid-code"}
    )
    assert callback.status_code == 302 and callback.headers["location"] == "/dashboard"
    assert client.get("/api/user").json()["id"] == 1
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        assert user["name"] == "Patreon Name" and user["password"] == original_hash
        assert (
            user["patreon_token"] == "access"
            and user["patreon_refresh_token"] == "refresh"
        )
    assert (
        client.get(
            "/auth/callback", params={"state": state, "code": "valid-code"}
        ).status_code
        == 400
    )
