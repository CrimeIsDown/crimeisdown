"""Loopback-only, isolated API startup demonstration; never a production entrypoint."""

import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def main():
    if os.environ.get("CID_DEMO") != "1":
        raise SystemExit(
            "Explicitly set CID_DEMO=1 to start the isolated local demonstration."
        )
    import httpx
    import uvicorn
    from app.crimeisdown.application import create_app
    from app.crimeisdown.database import Database
    from app.crimeisdown.settings import Settings
    from app.crimeisdown.state import MemoryState
    from app.crimeisdown.storage import LocalStorage

    with tempfile.TemporaryDirectory(prefix="cid-monorepo-demo-") as directory:
        path = Path(directory) / "demo.sqlite"
        with sqlite3.connect(path) as connection:
            connection.executescript(
                (ROOT / "backend/tests/fixtures/schema.sqlite.sql").read_text()
            )
        settings = Settings(
            _env_file=None,
            database_url="sqlite:///" + str(path),
            app_key="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            app_name="CrimeIsDown local demo",
            app_url="http://localhost:8000",
            session_secure_cookie=False,
            session_domain=None,
            legacy_session_redis_url=None,
            legacy_cache_redis_url=None,
            session_files=None,
            cache_files=None,
            google_cloud_key_file=None,
            archive_local_root=None,
            notification_configuration=ROOT
            / "backend/tests/fixtures/notifications.json",
            smtp_host="",
            patreon_client_id="",
            patreon_client_secret="",
            cors_origins="http://localhost:4321,http://127.0.0.1:4321,http://localhost:5173",
        )

        # The demonstration cannot forward requests to live providers.
        def offline(request):
            return httpx.Response(
                503,
                json={
                    "message": "External providers are disabled in the local demonstration."
                },
            )

        with httpx.Client(transport=httpx.MockTransport(offline)) as client:
            database = Database(settings.connection_url())
            app = create_app(
                settings,
                database=database,
                state=MemoryState(),
                http=client,
                storage=LocalStorage(Path(directory) / "audio", settings),
                mailer=lambda *_args: None,
                enqueue=lambda _export_id: None,
            )
            try:
                uvicorn.run(app, host="127.0.0.1", port=8000)
            finally:
                database.engine.dispose()


if __name__ == "__main__":
    main()
