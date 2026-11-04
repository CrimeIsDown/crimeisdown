import re
from html import unescape
from urllib.parse import parse_qs, urlparse

import pytest

from .test_accounts import csrf

RETURN = "/auth/sirens/authorize?state=example-state&code_challenge=example-pkce&method=email"


def test_password_login_returns_to_sirens_and_preserves_registration_link(pair):
    _, _, client, *_ = pair
    form = client.get("/login", params={"return_to": RETURN})
    assert form.status_code == 200
    assert 'name="password"' in form.text
    fields = {
        name: unescape(value)
        for name, value in re.findall(r'name="([^"]+)" value="([^"]*)"', form.text)
    }
    assert fields["return_to"] == RETURN
    link = unescape(re.search(r'href="(/register\?[^"]+)"', form.text)[1])
    assert parse_qs(urlparse(link).query)["return_to"] == [RETURN]
    response = client.post(
        "/login",
        data={
            "email": "user4@example.com",
            "password": "password123",
            "return_to": RETURN,
            "_token": fields["_token"],
        },
    )
    assert response.status_code == 302
    assert response.headers["location"] == RETURN
    assert (
        client.get("/login", params={"return_to": RETURN}).headers["location"] == RETURN
    )
    assert client.get("/api/user").json()["id"] == 4


def test_registration_returns_to_sirens_without_creating_a_patreon_identity(pair):
    _, app, client, *_ = pair
    form = client.get("/register", params={"return_to": RETURN})
    fields = {
        name: unescape(value)
        for name, value in re.findall(r'name="([^"]+)" value="([^"]*)"', form.text)
    }
    assert fields["return_to"] == RETURN
    response = client.post(
        "/register",
        data={
            "name": "Direct Buyer",
            "email": "direct-buyer@example.com",
            "password": "example-password",
            "password_confirmation": "example-password",
            "return_to": RETURN,
            "_token": fields["_token"],
        },
    )
    assert response.status_code == 302
    assert response.headers["location"] == RETURN
    with app.state.db.session() as session:
        user = app.state.db.get(session, "users", "direct-buyer@example.com", "email")
        assert not user.get("patreon_id")
    assert (
        client.get("/register", params={"return_to": RETURN}).headers["location"]
        == RETURN
    )


@pytest.mark.parametrize(
    "destination",
    [
        "https://attacker.example/",
        "//attacker.example/",
        "/\\attacker.example/",
        "javascript:alert(1)",
        "/bad\nlocation",
    ],
)
@pytest.mark.parametrize("path", ["/login", "/register"])
def test_account_returns_reject_open_redirects(pair, destination, path):
    _, _, client, *_ = pair
    headers = {**csrf(client), "Accept": "text/html"}
    data = {
        "email": "user4@example.com",
        "password": "password123",
        "return_to": destination,
    }
    if path == "/register":
        data.update(
            name="Buyer",
            email="another-buyer@example.com",
            password_confirmation="password123",
        )
    response = client.post(path, json=data, headers=headers)
    assert response.status_code == 302
    assert response.headers["location"] == "/dashboard"
