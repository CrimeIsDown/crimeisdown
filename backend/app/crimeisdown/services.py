import hashlib
import json
import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from .database import decoded, serialized
from .settings import tier_details


def legacy_json(value: Any) -> Any:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True).replace(
        "/", "\\/"
    )


def php_filter(values: Any) -> Any:
    if values is None:
        return None
    kept = {
        str(i): v
        for i, v in enumerate(values)
        if v not in (None, "", False, 0, "0", [])
    }
    return (
        list(kept.values())
        if list(kept) == [str(i) for i in range(len(kept))]
        else kept
    )


class Services:
    def __init__(
        self,
        settings: Any,
        database: Any,
        state: Any,
        client: Any = None,
        clock: Any = None,
    ) -> None:
        self.settings, self.db, self.state = settings, database, state
        self.http = client or httpx.Client(timeout=30)
        self.now = clock or (lambda: datetime.now(UTC))

    def identity(self, session: Any, user: Any) -> Any:
        token = user.get("patreon_token")
        if not token:
            return {}
        key = "patreon:" + hashlib.sha256(token.encode()).hexdigest()
        cached = self.state.get(key)
        if cached is not None:
            return cached
        params = {
            "include": "memberships.currently_entitled_tiers,memberships.campaign",
            "fields[member]": "currently_entitled_amount_cents,lifetime_support_cents,campaign_lifetime_support_cents,last_charge_status,patron_status,last_charge_date,pledge_relationship_start,pledge_cadence",
            "fields[user]": "email,first_name,full_name,image_url,last_name,thumb_url,url,vanity,is_email_verified",
        }
        url = self.settings.patreon_api_url + "/api/oauth2/v2/identity"
        response = self.http.get(
            url,
            params=params,
            headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
        )
        if response.status_code == 401:
            fresh = self.db.get(session, "users", user["id"], lock=True)
            if fresh["patreon_token"] != token:
                token = fresh["patreon_token"]
            else:
                refresh = self.http.post(
                    self.settings.patreon_api_url + "/api/oauth2/token",
                    data={
                        "grant_type": "refresh_token",
                        "refresh_token": fresh["patreon_refresh_token"],
                        "client_id": self.settings.patreon_client_id,
                        "client_secret": self.settings.patreon_client_secret.get_secret_value(),
                    },
                )
                refresh.raise_for_status()
                tokens = refresh.json()
                token = tokens["access_token"]
                self.db.change(
                    session,
                    "users",
                    user["id"],
                    {
                        "patreon_token": token,
                        "patreon_refresh_token": tokens.get(
                            "refresh_token", fresh["patreon_refresh_token"]
                        ),
                    },
                    self.now(),
                )
                session.commit()
            response = self.http.get(
                url,
                params=params,
                headers={
                    "Authorization": "Bearer " + token,
                    "Accept": "application/json",
                },
            )
        response.raise_for_status()
        identity = response.json()
        self.state.set(key, identity, 300)
        return identity

    def tier(self, session: Any, user: Any) -> Any:
        override = user.get("patreon_tier_id_override")
        if override:
            return tier_details(override, self.settings.membership_tiers)
        for item in self.identity(session, user).get("included", []):
            if (
                item.get("type") == "member"
                and item.get("attributes", {}).get("patron_status") == "active_patron"
            ):
                relationships = item.get("relationships", {})
                if (
                    str(relationships.get("campaign", {}).get("data", {}).get("id"))
                    == self.settings.patreon_campaign_id
                ):
                    tiers = relationships.get("currently_entitled_tiers", {}).get(
                        "data", []
                    )
                    return (
                        tier_details(tiers[0]["id"], self.settings.membership_tiers)
                        if tiers
                        else None
                    )
        return None

    def user_json(self, session: Any, user: Any) -> Any:
        result = serialized(user)
        for key in (
            "password",
            "remember_token",
            "patreon_token",
            "patreon_refresh_token",
        ):
            result.pop(key, None)
        result.update(
            patreon_tier=self.tier(session, user),
            is_admin=str(user.get("patreon_tier_id_override"))
            == self.settings.admin_tier_id,
        )
        return result

    def can_search(self, session: Any, user: Any) -> Any:
        tier = self.tier(session, user)
        return bool(tier and tier["features"]["transcript_search"])

    def commander(self, session: Any, user: Any) -> Any:
        tier = self.tier(session, user)
        if str(
            user.get("patreon_tier_id_override")
        ) != self.settings.admin_tier_id and (not tier or tier["rate"] < 50):
            raise HTTPException(
                403, "Commander tier or higher is required for range exports."
            )

    def download_limit(self, session: Any, user: Any) -> Any:
        tier = self.tier(session, user) if user else None
        return tier["features"]["archive_downloads"] if tier else 5

    def search_key(self, session: Any, user: Any) -> Any:
        if not self.can_search(session, user):
            raise HTTPException(403, "Forbidden")
        cache_key = str(user["id"]) + "_search_key"
        key = self.state.get(cache_key)
        if key:
            return key
        expires = self.now() + timedelta(weeks=1)
        uid = str(uuid.uuid4())
        for host in (
            self.settings.meilisearch_hosts or self.settings.meilisearch_host
        ).split(","):
            response = self.http.post(
                host.rstrip("/") + "/keys",
                headers={
                    "Authorization": "Bearer "
                    + self.settings.meilisearch_key.get_secret_value()
                },
                json={
                    "uid": uid,
                    "description": "Temporary search key for user " + str(user["id"]),
                    "actions": ["search"],
                    "indexes": [self.settings.meilisearch_index + "*"],
                    "expiresAt": expires.isoformat(),
                },
            )
            response.raise_for_status()
            key = response.json()["key"]
        self.state.set(cache_key, key, 604800)
        return key

    def talkgroups(self) -> Any:
        key = "available-talkgroups"
        cached = self.state.get(key)
        if cached is not None:
            return cached
        response = self.http.get(
            self.settings.transcription_base_url.rstrip("/") + "/talkgroups",
            headers={
                "Authorization": "Bearer "
                + self.settings.transcription_key.get_secret_value()
            },
        )
        response.raise_for_status()
        names = {
            "chi_cpd": "Chicago Police Department",
            "chi_cfd": "Chicago Fire Department (conventional P25)",
            "chi_oemc": "Chicago OEMC 800MHz Trunking System",
            "sc21102": "STARCOM21",
            "chisuburbs": "Chicago Suburbs",
            "willco_p25": "Will County (P25)",
        }
        systems: dict[str, dict[str, list[dict[str, Any]]]] = {}
        for tg in response.json()["talkgroups"]:
            system = names.get(tg["short_name"])
            if system:
                systems.setdefault(system, {}).setdefault(
                    tg["talkgroup_group"], []
                ).append(
                    {
                        "label": tg["talkgroup_tag"],
                        "system": system,
                        "value": str(tg["talkgroup"]) + "@" + tg["short_name"],
                    }
                )
        result = []
        for sid, (system, groups) in enumerate(
            sorted(systems.items(), key=lambda x: x[0].lower())
        ):
            children = []
            for gid, (group, talkgroups) in enumerate(
                sorted(groups.items(), key=lambda x: x[0].lower())
            ):
                children.append(
                    {
                        "id": gid,
                        "group": group,
                        "talkgroups": [
                            dict(tg, id=i)
                            for i, tg in enumerate(
                                sorted(talkgroups, key=lambda t: t["label"].lower())
                            )
                        ],
                    }
                )
            result.append({"id": sid, "group": system, "talkgroups": children})
        self.state.set(key, result, 86400)
        return result

    def channel_url(self, channel: Any) -> Any:
        s, base, suffix = channel["service"], "", ""
        c = self.settings
        # Preserve Laravel's effective env() values when its configuration cache
        # differs from .env. Existing delivery URLs must not silently change.
        overrides = json.loads(c.notification_transport_env.get_secret_value() or "{}")

        def configured(name: str) -> str:
            if name in overrides:
                return str(overrides[name])
            value = getattr(c, name)
            return (
                value.get_secret_value()
                if hasattr(value, "get_secret_value")
                else str(value)
            )

        if s == "ntfy":
            s, base, suffix = (
                "ntfys",
                configured("ntfy_token") + "@" + configured("ntfy_domain") + "/",
                "/?priority=min",
            )
        elif s == "tgram":
            base, suffix = "$TELEGRAM_BOT_TOKEN/", "/?content=after"
        elif s == "mailgun":
            base, suffix = (
                "notifications@"
                + configured("mailgun_domain")
                + "/"
                + configured("mailgun_secret")
                + "/",
                "/?name=CrimeIsDown.com",
            )
        elif s == "sns":
            base = (
                "/".join(
                    [
                        configured("aws_access_key_id"),
                        configured("aws_secret_access_key"),
                        configured("aws_default_region"),
                    ]
                )
                + "/+"
            )
        elif s == "ses":
            base = (
                "notifications@crimeisdown.com/"
                + "/".join(
                    [
                        configured("aws_access_key_id"),
                        configured("aws_secret_access_key"),
                        configured("aws_default_region"),
                    ]
                )
                + "/"
            )
            suffix = "/?name=CrimeIsDown.com"
        return s + "://" + base + channel["path"] + suffix

    def notification_config(self, session: Any) -> Any:
        config = json.loads(self.settings.notification_configuration.read_text())
        for sub in self.db.rows(session, "transcript_subscriptions", enabled=True):
            topic = (
                "^"
                + ("(" + sub["topic"] + ")" if "|" in sub["topic"] else sub["topic"])
                + "$"
            )
            entry = config.setdefault(
                topic, {"channels": [], "append_talkgroup": True, "alerts": []}
            )
            links = self.db.rows(
                session, "tr_sub_destinations", transcript_subscription_id=sub["id"]
            )
            channels = [
                self.channel_url(
                    self.db.get(
                        session,
                        "notification_channels",
                        link["notification_channel_id"],
                    )
                )
                for link in links
            ]
            owner = self.db.get(session, "users", sub["user_id"])
            alert = {"channels": channels, "owner": owner["email"]}
            for field in ("keywords", "ignore_keywords"):
                values = decoded(sub[field])
                if values:
                    values = (
                        {k: v for k, v in values.items() if v and v != "0"}
                        if isinstance(values, dict)
                        else php_filter(values)
                    )
                    if values:
                        alert[field] = values
            location = decoded(sub["location"])
            if location and location.get("address") is not None:
                if location.get("travel_time") is not None:
                    seconds = float(location["travel_time"]) * 60
                    location["travel_time"] = (
                        int(seconds) if seconds.is_integer() else seconds
                    )
                alert["location"] = location
            if "keywords" in alert or "location" in alert:
                entry["alerts"].append(alert)
            else:
                entry["channels"].extend(channels)
        return config

    def broadcastify(self, feed_id: Any) -> Any:
        if not str(feed_id).isdigit():
            raise HTTPException(404, "Not Found")
        key = "broadcastify-hls-" + str(feed_id)
        cached = self.state.get(key)
        if cached:
            return cached
        response = self.http.get(
            "https://www.broadcastify.com/listen/feed/" + str(feed_id),
            headers={"User-Agent": "CrimeIsDown/1.0"},
        )
        response.raise_for_status()
        match = re.search(r'hlsUrl:\s*"((?:\\.|[^"\\])+)"', response.text)
        try:
            value = json.loads('"' + match[1] + '"') if match else ""
            parsed = urlparse(value)
            valid = (
                parsed.scheme == "https"
                and (parsed.hostname or "").endswith(".broadcastify.com")
                and parsed.path.endswith(".m3u8")
            )
        except ValueError, AttributeError:
            valid = False
        if not valid:
            raise HTTPException(404, "Could not find Broadcastify stream URL")
        self.state.set(key, value, 3600)
        return value
