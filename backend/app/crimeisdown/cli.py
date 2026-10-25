"""Read-only preflight/data manifest and explicit operational commands."""

import argparse
import hashlib
import json
import sys
from typing import Any

from sqlalchemy import select

from .database import Database, serialized
from .settings import Settings

REQUIRED = {
    "users": {
        "id",
        "name",
        "email",
        "password",
        "remember_token",
        "email_verified_at",
        "patreon_id",
        "patreon_token",
        "patreon_refresh_token",
        "patreon_tier_id_override",
        "created_at",
        "updated_at",
    },
    "personal_access_tokens": {
        "id",
        "tokenable_type",
        "tokenable_id",
        "token",
        "abilities",
        "expires_at",
        "last_used_at",
    },
    "password_resets": {"email", "token", "created_at"},
    "saved_searches": {
        "id",
        "user_id",
        "name",
        "url",
        "is_global",
        "created_at",
        "updated_at",
    },
    "notification_channels": {
        "id",
        "user_id",
        "service",
        "path",
        "created_at",
        "updated_at",
    },
    "transcript_subscriptions": {
        "id",
        "user_id",
        "name",
        "enabled",
        "topic",
        "keywords",
        "ignore_keywords",
        "location",
        "created_at",
        "updated_at",
    },
    "tr_sub_destinations": {
        "id",
        "transcript_subscription_id",
        "notification_channel_id",
        "created_at",
        "updated_at",
    },
    "audio_range_exports": {
        "id",
        "user_id",
        "feed",
        "broadcastify",
        "start_at",
        "end_at",
        "requested_hours",
        "processed_hours",
        "charged_hours",
        "status",
        "missing_hours",
        "output_path",
        "error_message",
        "completed_at",
        "expires_at",
        "created_at",
        "updated_at",
    },
}


def check_schema(db: Database) -> None:
    for name, required in REQUIRED.items():
        table = db.table(name)
        missing = required - set(table.c.keys())
        if missing:
            raise ValueError(f"{name} is missing required columns: {sorted(missing)}")
    # Deliberately no create_all, migration, conversion, seed, or data update.


def manifest(db: Database) -> dict[str, Any]:
    check_schema(db)
    result = {}
    with db.session() as session:
        for name in REQUIRED:
            table = db.table(name)
            digest = hashlib.sha256()
            count = 0
            query = select(table).order_by(*table.primary_key.columns)
            for row in session.execute(
                query.execution_options(yield_per=1000)
            ).mappings():
                digest.update(
                    json.dumps(
                        serialized(dict(row)),
                        sort_keys=True,
                        separators=(",", ":"),
                        default=str,
                    ).encode()
                )
                digest.update(b"\n")
                count += 1
            result[name] = {"rows": count, "sha256": digest.hexdigest()}
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=[
            "check-schema",
            "data-manifest",
            "cleanup-exports",
            "find-search-key-owner",
        ],
    )
    parser.add_argument("key", nargs="?")
    args = parser.parse_args()
    settings = Settings()
    settings.encryption_key()
    db = Database(settings.connection_url())
    if args.command == "check-schema":
        check_schema(db)
        sys.stdout.write(
            "Existing CrimeIsDown schema verified; no data or schema changes made.\n"
        )
    elif args.command == "data-manifest":
        sys.stdout.write(json.dumps(manifest(db), indent=2) + "\n")
    else:
        from .application import create_app

        app = create_app(settings, database=db)
        if args.command == "cleanup-exports":
            from .audio import cleanup

            count = cleanup(db, app.state.services, app.state.storage)
            sys.stdout.write(f"Deleted {count} audio range exports.\n")
        else:
            if not args.key:
                parser.error("A search key is required")
            with db.session() as session:
                for user in db.rows(session, "users"):
                    if (
                        app.state.services.state.get(str(user["id"]) + "_search_key")
                        == args.key
                    ):
                        sys.stdout.write(
                            json.dumps({"id": user["id"], "email": user["email"]})
                            + "\n"
                        )
                        return
            raise SystemExit("Key not found")


if __name__ == "__main__":
    main()
