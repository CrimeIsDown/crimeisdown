import json
from datetime import timedelta

import httpx

from .conftest import NOW, bearer
from .test_resources import request_json


def transport(app, handler):
    app.state.services.http = httpx.Client(transport=httpx.MockTransport(handler))


def test_notification_configuration_includes_authorized_subscriptions(pair):
    channel = request_json(
        pair, "POST", "/api/notificationChannels", {"service": "tgram", "path": "123"}
    )
    request_json(
        pair,
        "POST",
        "/api/transcriptSubscriptions",
        {
            "name": "Geo",
            "enabled": True,
            "topic": "1|2",
            "keywords": ["fire"],
            "ignore_keywords": ["test"],
            "location": {"address": "Chicago", "travel_time": 10},
            "notification_channels": [channel["id"]],
        },
    )
    result = request_json(pair, "GET", "/api/config/notifications.json", user=3)
    assert result["^(1|2)$"]["alerts"][0]["location"]["travel_time"] == 600
    assert (
        pair[2].get("/api/config/notifications.json", headers=bearer()).status_code
        == 403
    )


def test_search_keys_permissions_multihost_expiry_and_cache(pair):
    _, app, client, *_ = pair
    calls = []

    def upstream(request):
        calls.append(request)
        return httpx.Response(201, json={"key": "scoped-key"})

    transport(app, upstream)
    app.state.services.settings.meilisearch_hosts = "http://search-a,http://search-b"
    assert client.get("/api/search-key", headers=bearer(4)).status_code == 403
    assert not calls
    result = client.get("/api/search-key", headers=bearer())
    assert result.json() == {"meilisearch": "scoped-key"}
    assert len(calls) == 2
    bodies = [json.loads(r.content) for r in calls]
    assert bodies[0]["uid"] == bodies[1]["uid"]
    assert bodies[0]["actions"] == ["search"] and bodies[0]["indexes"] == ["calls*"]
    assert bodies[0]["expiresAt"] == (NOW + timedelta(weeks=1)).isoformat()
    assert (
        client.get("/api/search-key", headers={**bearer(), "Accept": "text/plain"}).text
        == "scoped-key"
    )
    assert len(calls) == 2


def test_patreon_refresh_preserves_account_and_entitlements(pair):
    _, app, client, *_ = pair
    db = app.state.db
    with db.session() as session:
        db.change(
            session,
            "users",
            1,
            {
                "patreon_tier_id_override": None,
                "patreon_id": "old-id",
                "patreon_token": "expired",
                "patreon_refresh_token": "refresh",
            },
            NOW,
        )
        session.commit()
    app.state.services.settings.patreon_campaign_id = "campaign"
    calls = []

    def upstream(req):
        calls.append(req)
        if req.url.path.endswith("/token"):
            assert b"refresh_token=refresh" in req.content
            return httpx.Response(
                200,
                json={"access_token": "renewed", "refresh_token": "renewed-refresh"},
            )
        if req.headers["Authorization"] == "Bearer expired":
            return httpx.Response(401)
        return httpx.Response(
            200,
            json={
                "included": [
                    {
                        "type": "member",
                        "attributes": {"patron_status": "active_patron"},
                        "relationships": {
                            "campaign": {"data": {"id": "campaign"}},
                            "currently_entitled_tiers": {
                                "data": [{"id": "demo-commander"}]
                            },
                        },
                    }
                ]
            },
        )

    transport(app, upstream)
    result = client.get("/api/user", headers=bearer()).json()
    assert (
        result["id"] == 1
        and result["patreon_id"] == "old-id"
        and result["patreon_tier"]["name"] == "Commander"
    )
    with db.session() as session:
        user = db.get(session, "users", 1)
        assert (
            user["patreon_token"] == "renewed"
            and user["patreon_refresh_token"] == "renewed-refresh"
        )
    assert "patreon_token" not in result


def test_talkgroups_and_health(pair):
    _, app, client, *_ = pair

    def upstream(req):
        if req.url.path == "/talkgroups":
            return httpx.Response(
                200,
                json={
                    "talkgroups": [
                        {
                            "short_name": "chi_cpd",
                            "talkgroup_group": "CPD",
                            "talkgroup_tag": "Zone 2",
                            "talkgroup": 2,
                        },
                        {
                            "short_name": "chi_cpd",
                            "talkgroup_group": "CPD",
                            "talkgroup_tag": "Zone 1",
                            "talkgroup": 1,
                        },
                    ]
                },
            )
        if req.url.host == "api.openmhz.com":
            return httpx.Response(
                200,
                json={"calls": [{"time": (NOW - timedelta(minutes=20)).isoformat()}]},
            )
        if req.url.host == "www.youtube.com":
            return httpx.Response(
                200,
                text='<link rel="canonical" href="https://www.youtube.com/watch?v=live123">',
            )
        if req.url.host == "www.googleapis.com":
            return httpx.Response(
                200, json={"items": [{"snippet": {"liveBroadcastContent": "live"}}]}
            )
        return httpx.Response(200, json={"estimatedTotalHits": 42})

    transport(app, upstream)
    result = client.get("/api/searchTalkgroups", headers=bearer()).json()
    assert result[0]["talkgroups"][0]["talkgroups"][0]["value"] == "1@chi_cpd"
    assert client.get("/api/search-health?engine=meilisearch").text == "42"
    assert client.get("/api/openmhz-health/chi_cpd").status_code == 404
    assert client.get("/api/livestream-health").text == "Livestream online"


def test_oauth_rejects_forged_state(pair):
    _, _, client, *_ = pair
    assert client.get("/auth/callback?state=forged&code=anything").status_code == 400


def test_cross_user_channel_cannot_be_attached(pair):
    _, _, client, *_ = pair
    channel = client.post(
        "/api/notificationChannels",
        json={"service": "tgram", "path": "123"},
        headers=bearer(2),
    ).json()
    result = client.post(
        "/api/transcriptSubscriptions",
        json={
            "name": "Attack",
            "enabled": True,
            "topic": "1",
            "notification_channels": [channel["id"]],
        },
        headers=bearer(),
    )
    assert result.status_code == 422


def test_health_failure_modes_and_channel_transports(pair):
    _, app, client, *_ = pair
    assert client.get("/api/healthz").json() == {"status": "ok"}
    assert client.get("/api/search-health").status_code == 500
    transport(app, lambda req: httpx.Response(503))
    assert (
        client.get("/api/openmhz-health/system").text == "Got server error, assuming OK"
    )
    transport(app, lambda req: httpx.Response(200, json={"calls": []}))
    assert client.get("/api/openmhz-health/system").status_code == 404
    transport(app, lambda req: httpx.Response(200, text="no canonical link"))
    assert client.get("/api/livestream-health").status_code == 400

    def quota(req):
        return (
            httpx.Response(
                200,
                text='<link rel="canonical" href="https://www.youtube.com/watch?v=x">',
            )
            if req.url.host == "www.youtube.com"
            else httpx.Response(403)
        )

    transport(app, quota)
    assert client.get("/api/livestream-health").text == "Skipped check, hit API quota"
    for service, expected in [
        ("ntfy", "ntfys://@/topic/?priority=min"),
        ("tgram", "tgram://$TELEGRAM_BOT_TOKEN/topic/?content=after"),
        ("mailgun", "mailgun://notifications@//topic/?name=CrimeIsDown.com"),
        ("sns", "sns:////us-east-1/+topic"),
        (
            "ses",
            "ses://notifications@crimeisdown.com///us-east-1/topic/?name=CrimeIsDown.com",
        ),
    ]:
        assert (
            app.state.services.channel_url({"service": service, "path": "topic"})
            == expected
        )


def test_notification_travel_time_accepts_null_and_numeric_strings(pair):
    channel = request_json(
        pair, "POST", "/api/notificationChannels", {"service": "tgram", "path": "123"}
    )
    for name, value in (("Null travel", None), ("String travel", "10")):
        request_json(
            pair,
            "POST",
            "/api/transcriptSubscriptions",
            {
                "name": name,
                "enabled": True,
                "topic": name,
                "keywords": ["fire"],
                "location": {"address": "Chicago", "travel_time": value},
                "notification_channels": [channel["id"]],
            },
        )
    result = request_json(pair, "GET", "/api/config/notifications.json", user=3)
    assert result["^Null travel$"]["alerts"][0]["location"]["travel_time"] is None
    assert result["^String travel$"]["alerts"][0]["location"]["travel_time"] == 600


def test_notification_effective_laravel_environment_is_preserved(pair):
    from pydantic import SecretStr

    _, app, *_ = pair
    settings = app.state.settings
    settings.ntfy_token = SecretStr("new-env-token")
    settings.ntfy_domain = "new-env-domain"
    settings.notification_transport_env = SecretStr(
        json.dumps(
            {
                "ntfy_token": "",
                "ntfy_domain": "",
                "aws_access_key_id": "",
                "aws_secret_access_key": "",
                "aws_default_region": "",
            }
        )
    )
    assert (
        app.state.services.channel_url({"service": "ntfy", "path": "topic"})
        == "ntfys://@/topic/?priority=min"
    )
    assert (
        app.state.services.channel_url({"service": "ses", "path": "owner@example.com"})
        == "ses://notifications@crimeisdown.com////owner@example.com/?name=CrimeIsDown.com"
    )
