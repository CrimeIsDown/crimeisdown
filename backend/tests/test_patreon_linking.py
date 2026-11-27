from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from authlib.integrations.httpx_client import OAuth2Client
from pydantic import SecretStr

from .conftest import NOW
from .test_accounts import csrf


@pytest.fixture
def patreon(pair):
    _, app, client, *_ = pair
    services = app.state.services
    services.settings.patreon_client_id = "fixture-client"
    services.settings.patreon_client_secret = SecretStr("fixture-secret")
    services.settings.patreon_redirect_uri = "http://testserver/auth/callback"
    person = {
        "id": "linked-patreon-id",
        "attributes": {"full_name": "Patreon Name", "email": "user1@example.com"},
    }

    def provider(request):
        if request.url.path.endswith("/token"):
            return httpx.Response(
                200,
                json={
                    "access_token": "new-access",
                    "refresh_token": "new-refresh",
                    "token_type": "Bearer",
                },
            )
        return httpx.Response(200, json={"data": person})

    with httpx.Client(transport=httpx.MockTransport(provider)) as http:
        services.http = http
        services.oauth_client_factory = lambda *args, **kwargs: OAuth2Client(
            *args, transport=httpx.MockTransport(provider), **kwargs
        )
        yield app, client, person


def login(client, user=1):
    response = client.post(
        "/login",
        headers=csrf(client),
        json={"email": f"user{user}@example.com", "password": "password123"},
    )
    assert response.status_code == 200


def start(client):
    response = client.get("/auth/redirect", params={"return_to": "/profile"})
    assert response.status_code == 302
    return parse_qs(urlparse(response.headers["location"]).query)["state"][0]


def callback(client, state):
    return client.get("/auth/callback", params={"code": "fixture-code", "state": state})


@pytest.mark.parametrize(
    "email", ["user1@example.com", "patron@example.com", "user2@example.com"]
)
def test_signed_in_user_links_patreon_without_replacing_local_profile(patreon, email):
    app, client, person = patreon
    person["attributes"]["email"] = email
    with app.state.db.session() as session:
        app.state.db.change(
            session, "users", 1, {"email_verified_at": NOW.replace(tzinfo=None)}, NOW
        )
        session.commit()
        original = app.state.db.get(session, "users", 1)
        count = len(app.state.db.rows(session, "users"))
    login(client)
    assert 'href="/auth/redirect?return_to=%2Fprofile"' in client.get("/profile").text
    state = start(client)
    response = callback(client, state)
    assert response.status_code == 302 and response.headers["location"] == "/profile"
    assert client.get("/api/user").json()["id"] == 1
    assert "Link Patreon account" not in client.get("/profile").text
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        assert len(app.state.db.rows(session, "users")) == count
        for field in [
            "name",
            "email",
            "password",
            "email_verified_at",
            "patreon_tier_id_override",
        ]:
            assert user[field] == original[field]
        assert user["patreon_id"] == person["id"]
        assert user["patreon_token"] == "new-access"
        assert user["patreon_refresh_token"] == "new-refresh"
    assert callback(client, state).status_code == 400


def test_matching_email_does_not_link_a_signed_out_user(patreon):
    app, client, _ = patreon
    response = callback(client, start(client))
    assert response.status_code == 409
    assert (
        client.get("/api/user", headers={"Accept": "application/json"}).status_code
        == 401
    )
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", 1)
        assert user["patreon_id"] is None and user["patreon_token"] is None


def test_signed_out_new_patreon_identity_can_still_register(patreon):
    app, client, person = patreon
    person["attributes"]["email"] = "new-patron@example.com"
    assert callback(client, start(client)).status_code == 302
    account = client.get("/api/user").json()
    assert account["id"] > 5
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", account["id"])
        assert user["patreon_id"] == person["id"]
        assert user["email"] == "new-patron@example.com"
        assert user["patreon_token"] == "new-access"


@pytest.mark.parametrize("owner", [1, 2])
def test_linking_cannot_replace_or_take_over_another_patreon_identity(patreon, owner):
    app, client, person = patreon
    with app.state.db.session() as session:
        app.state.db.change(
            session,
            "users",
            owner,
            {
                "patreon_id": "another-patreon-id" if owner == 1 else person["id"],
                "patreon_token": "original-access",
            },
            NOW,
        )
        session.commit()
        original = app.state.db.get(session, "users", owner)
    login(client)
    response = callback(client, start(client))
    assert response.status_code == 409
    assert client.get("/api/user").json()["id"] == 1
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", owner)
        assert user["patreon_id"] == original["patreon_id"]
        assert user["patreon_token"] == "original-access"
        if owner == 2:
            assert app.state.db.get(session, "users", 1)["patreon_id"] is None


def test_link_callback_rejects_an_account_change_during_oauth(patreon):
    app, client, _ = patreon
    login(client)
    state = start(client)
    login(client, 2)
    assert callback(client, state).status_code == 400
    assert client.get("/api/user").json()["id"] == 2
    with app.state.db.session() as session:
        assert all(
            user["patreon_id"] is None for user in app.state.db.rows(session, "users")
        )
