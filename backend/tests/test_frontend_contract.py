"""Contract expectations taken from the deployed Ember and Astro session clients."""

import re
from urllib.parse import parse_qs, urlparse

import pytest

from app.crimeisdown.accounts import safe_return_url

from .conftest import bearer
from .test_accounts import csrf


def test_explicit_frontend_return_url_and_cors(pair):
    _, app, client, *_ = pair
    settings = app.state.settings
    settings.patreon_client_id = "client"
    settings.patreon_redirect_uri = "http://testserver/auth/callback"
    destination = (
        "https://crimeisdown.com/transcripts/search?calls_2026_10%5Bquery%5D=dispatch"
    )
    response = client.get("/auth/redirect", params={"return_to": destination})
    sid = app.state.sessions.cookies.decrypt(
        settings.session_cookie, client.cookies.get(settings.session_cookie)
    )
    assert app.state.sessions.read(sid)["redirect_url"] == destination
    response = client.get(
        "/api/user", headers={**bearer(), "Origin": "https://crimeisdown.com"}
    )
    assert response.headers["access-control-allow-origin"] == "https://crimeisdown.com"
    assert response.headers["access-control-allow-credentials"] == "true"
    denied = client.get(
        "/api/user", headers={**bearer(), "Origin": "https://attacker.example"}
    )
    assert "access-control-allow-origin" not in denied.headers


@pytest.mark.parametrize(
    "destination",
    [
        "https://attacker.example/path",
        "//attacker.example/path",
        "/\\attacker.example/path",
        "javascript:alert(1)",
        "/\nattacker",
    ],
)
def test_oauth_and_logout_reject_unsafe_return_urls(pair, destination):
    assert safe_return_url(destination, pair[1].state.settings) == "/dashboard"


def test_ember_logout_link_requires_confirmation_and_csrf(pair):
    _, app, client, *_ = pair
    headers = csrf(client)
    assert (
        client.post(
            "/login",
            headers=headers,
            json={"email": "user1@example.com", "password": "password123"},
        ).status_code
        == 200
    )
    response = client.get(
        "/logout", params={"return_to": "https://crimeisdown.com/transcripts/search"}
    )
    assert response.status_code == 200 and '<form method="post"' in response.text
    assert client.get("/api/user").json()["id"] == 1
    assert client.post("/logout").status_code == 419
    token = re.search(r'name="_token" value="([^"]+)"', response.text)[1]
    result = client.post(
        "/logout",
        data={
            "_token": token,
            "return_to": "https://crimeisdown.com/transcripts/search",
        },
    )
    assert (
        result.status_code == 302
        and result.headers["location"] == "https://crimeisdown.com/transcripts/search"
    )
    assert (
        client.get("/api/user", headers={"Accept": "application/json"}).status_code
        == 401
    )


def test_browser_preflight_does_not_create_sessions_and_csrf_errors_keep_cors(pair):
    _, _, client, *_ = pair
    origin = "https://crimeisdown.com"
    response = client.options(
        "/api/savedSearches",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-xsrf-token",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "set-cookie" not in response.headers
    failed = client.post(
        "/api/savedSearches",
        headers={"Origin": origin, "Accept": "application/json"},
        json={},
    )
    assert failed.status_code == 419
    assert failed.headers["access-control-allow-origin"] == origin
    assert failed.headers["access-control-allow-credentials"] == "true"


def test_xsrf_cookie_survives_the_deployed_ember_cookie_parser(pair):
    from urllib.parse import unquote

    _, app, client, *_ = pair
    response = client.get("/sanctum/csrf-cookie")
    header = next(
        value
        for value in response.headers.get_list("set-cookie")
        if value.startswith("XSRF-TOKEN=")
    )
    # application.js uses document.cookie.split('; ').find(...).split('=')[1].
    # Laravel URL-encodes cookie values; raw/quoted base64 loses its '=' padding.
    document_cookie = header.split(";", 1)[0]
    token = unquote(document_cookie.split("=")[1])
    assert not token.startswith('"')
    sid = app.state.sessions.cookies.decrypt(
        app.state.settings.session_cookie,
        client.cookies.get(app.state.settings.session_cookie),
    )
    assert (
        app.state.sessions.cookies.decrypt("XSRF-TOKEN", token)
        == app.state.sessions.read(sid)["_token"]
    )


def test_patreon_login_requests_identity_and_membership_scopes(pair):
    _, app, client, *_ = pair
    app.state.settings.patreon_client_id = "example-client"
    app.state.settings.patreon_redirect_uri = "http://testserver/auth/callback"
    query = parse_qs(urlparse(client.get("/auth/redirect").headers["location"]).query)
    assert set(query["scope"][0].split()) == {
        "identity",
        "identity[email]",
        "campaigns",
    }
