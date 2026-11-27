"""Disposable loopback API and synthetic accounts/archive for Playwright tests."""

import sqlite3
import subprocess
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    import httpx
    import uvicorn
    from app.crimeisdown.application import create_app
    from app.crimeisdown.audio import build_export
    from app.crimeisdown.database import Database
    from app.crimeisdown.security import password_hash
    from app.crimeisdown.settings import TIERS, Settings
    from app.crimeisdown.state import MemoryState
    from app.crimeisdown.storage import LocalStorage
    from fastapi.responses import FileResponse

    with tempfile.TemporaryDirectory(prefix="cid-site-e2e-") as directory:
        root = Path(directory)
        database_path = root / "test.sqlite"
        with sqlite3.connect(database_path) as connection:
            connection.executescript(
                (ROOT / "backend/tests/fixtures/schema.sqlite.sql").read_text()
            )
        settings = Settings(
            _env_file=None,
            database_url="sqlite:///" + str(database_path),
            app_key="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            app_url="http://127.0.0.1:8765",
            membership_tiers=dict(TIERS),
            session_secure_cookie=False,
            session_domain=None,
            legacy_session_redis_url=None,
            legacy_cache_redis_url=None,
            session_files=None,
            cache_files=None,
            notification_configuration=ROOT
            / "backend/tests/fixtures/notifications.json",
            cors_origins="http://127.0.0.1:4331",
        )
        db = Database(settings.connection_url())
        now = datetime(2026, 10, 31, 12, tzinfo=UTC)
        with db.session() as session:
            db.create(
                session,
                "users",
                {
                    "id": 1,
                    "name": "Audio Test User",
                    "email": "audio@example.test",
                    "password": password_hash("audio-e2e-password"),
                    "patreon_tier_id_override": "demo-commander",
                },
                now,
            )
            session.commit()
        storage = LocalStorage(root / "audio", settings)
        tone = root / "tone.mp3"
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=1",
                "-c:a",
                "libmp3lame",
                str(tone),
            ],
            check=True,
        )
        for hour in [5, 6]:
            prefix = f"broadcastify/2026/10/31/{hour:02d}/zone7_20261031_{hour:02d}0000"
            storage.upload("recordings", prefix + ".mp3", tone)
            storage.path("recordings", prefix + ".json").write_text('{"segments": []}')

        # External providers and delivery services are never contacted.
        def provider(request):
            if request.url.path == "/keys":
                return httpx.Response(201, json={"key": "e2e-search-key"})
            if request.url.path == "/talkgroups":
                return httpx.Response(
                    200,
                    json={
                        "talkgroups": [
                            {
                                "short_name": "chi_cpd",
                                "talkgroup_group": "Police",
                                "talkgroup_tag": "Chi PD Zone 7",
                                "talkgroup": 7,
                            }
                        ]
                    },
                )
            return httpx.Response(503)

        with httpx.Client(transport=httpx.MockTransport(provider)) as http:
            app = create_app(
                settings,
                database=db,
                state=MemoryState(),
                clock=lambda: now,
                http=http,
                storage=storage,
                mailer=lambda *_args: None,
            )
            # Run the real export processor inline; Redis/Celery are unnecessary here.
            app.state.enqueue = lambda export_id: build_export(
                db, app.state.services, storage, export_id
            )

            @app.get("/e2e/recording.mp3")
            def fixture_recording():
                return FileResponse(tone, media_type="audio/mpeg")

            try:
                uvicorn.run(app, host="127.0.0.1", port=8765)
            finally:
                db.engine.dispose()


if __name__ == "__main__":
    main()
