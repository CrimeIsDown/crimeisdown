"""Public API contracts using a synthetic database, without a private implementation oracle."""

from .conftest import bearer


def request_json(pair, method, path, body=None, user=1, status=200):
    response = pair[2].request(method, path, json=body, headers=bearer(user))
    assert response.status_code == status, response.text
    return response.json()


def test_saved_search_create_update_read_delete_and_ownership(pair):
    row = request_json(
        pair,
        "POST",
        "/api/savedSearches",
        {"name": "Example", "url": "/transcripts/search?q=fire", "user_id": 2},
    )
    assert row["user_id"] == 1
    path = f"/api/savedSearches/{row['id']}"
    assert request_json(pair, "GET", path)["name"] == "Example"
    assert request_json(pair, "PATCH", path, {"name": "Edited"})["name"] == "Edited"
    request_json(pair, "GET", path, user=2, status=404)
    request_json(pair, "DELETE", path)
    assert request_json(pair, "GET", "/api/savedSearches") == []


def test_subscription_lifecycle_and_channel_cleanup(pair):
    channel = request_json(
        pair,
        "POST",
        "/api/notificationChannels",
        {"service": "tgram", "path": "example-topic"},
    )
    row = request_json(
        pair,
        "POST",
        "/api/transcriptSubscriptions",
        {
            "name": "Example",
            "topic": "test-radio",
            "enabled": True,
            "keywords": ["fire"],
            "notification_channels": [channel["id"]],
        },
    )
    path = f"/api/transcriptSubscriptions/{row['id']}"
    assert request_json(pair, "PATCH", path, {"enabled": False})["enabled"] == 0
    request_json(pair, "GET", path, user=2, status=404)
    request_json(pair, "DELETE", f"/api/notificationChannels/{channel['id']}")
    assert request_json(pair, "GET", "/api/transcriptSubscriptions") == []


def test_user_response_hides_credentials_and_preserves_membership(pair):
    for user in (1, 2, 3, 5):
        data = request_json(pair, "GET", "/api/user", user=user)
        assert data["id"] == user and data["patreon_tier"] is not None
        assert not {
            "password",
            "remember_token",
            "patreon_token",
            "patreon_refresh_token",
        }.intersection(data)
    assert request_json(pair, "GET", "/api/user", user=4)["patreon_tier"] is None


def test_validation_rejects_invalid_fields_and_unauthenticated_writes(pair):
    request_json(pair, "POST", "/api/savedSearches", {}, status=422)
    request_json(
        pair,
        "POST",
        "/api/notificationChannels",
        {"service": 123, "path": None},
        status=422,
    )
    assert pair[2].post(
        "/api/savedSearches",
        json={"name": "Denied"},
        headers={"Accept": "application/json"},
    ).status_code in (401, 419)


def test_non_member_identity_does_not_contact_patreon(pair):
    _, app, client, *_ = pair
    import httpx

    def reject(_request):
        raise AssertionError(
            "An account without a provider identity must not call Patreon"
        )

    app.state.services.http = httpx.Client(transport=httpx.MockTransport(reject))
    assert client.get("/api/user", headers=bearer(4)).json()["patreon_tier"] is None


def test_unconfigured_provider_tier_does_not_grant_paid_access(pair):
    _, app, client, *_ = pair
    with app.state.db.session() as session:
        app.state.db.change(
            session,
            "users",
            1,
            {"patreon_tier_id_override": "not-configured"},
            app.state.services.now(),
        )
        session.commit()
    assert client.get("/api/user", headers=bearer()).json()["patreon_tier"] is None
    assert client.get("/api/search-key", headers=bearer()).status_code == 403


def test_membership_and_admin_bindings_are_configurable(pair):
    _, app, client, *_ = pair
    app.state.settings.membership_tiers = {
        "example-staff": ("Example staff", 0, 1000, True, True, True)
    }
    app.state.settings.admin_tier_id = "example-staff"
    with app.state.db.session() as session:
        app.state.db.change(
            session,
            "users",
            1,
            {"patreon_tier_id_override": "example-staff"},
            app.state.services.now(),
        )
        session.commit()
    user = client.get("/api/user", headers=bearer()).json()
    assert user["is_admin"] is True
    assert user["patreon_tier"]["name"] == "Example staff"
    assert (
        client.get("/api/config/notifications.json", headers=bearer()).status_code
        == 200
    )
