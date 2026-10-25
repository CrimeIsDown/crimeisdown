import shutil
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.crimeisdown.application import create_app
from app.crimeisdown.database import Database
from app.crimeisdown.security import password_hash
from app.crimeisdown.settings import Settings
from app.crimeisdown.state import MemoryState

NOW = datetime(2026, 10, 21, 12, tzinfo=UTC)


@pytest.fixture(scope="session")
def base_schema(tmp_path_factory):
    root = tmp_path_factory.mktemp("cid-parity")
    path = root / "base.sqlite"
    path.touch()
    import sqlite3

    with sqlite3.connect(path) as connection:
        connection.executescript(
            (Path(__file__).parent / "fixtures/schema.sqlite.sql").read_text()
        )
    db = Database("sqlite:///" + str(path))
    with db.session() as session:
        for i, tier in [
            (1, "demo-sergeant"),
            (2, "demo-commander"),
            (3, "demo-admin"),
            (4, None),
            (5, "demo-lieutenant"),
        ]:
            db.create(
                session,
                "users",
                {
                    "id": i,
                    "name": f"User {i}",
                    "email": f"user{i}@example.com",
                    "password": password_hash("password123"),
                    "patreon_tier_id_override": tier,
                },
                NOW,
            )
        import hashlib

        for i in range(1, 6):
            db.create(
                session,
                "personal_access_tokens",
                {
                    "id": i,
                    "tokenable_type": "App\\Models\\User",
                    "tokenable_id": i,
                    "name": "fixture",
                    "token": hashlib.sha256(f"token-{i}".encode()).hexdigest(),
                    "abilities": '["*"]',
                },
                NOW,
            )
        session.commit()
    db.engine.dispose()
    return path


@pytest.fixture
def pair(base_schema, tmp_path):
    old, new = tmp_path / "old.sqlite", tmp_path / "new.sqlite"
    shutil.copyfile(base_schema, old)
    shutil.copyfile(base_schema, new)
    settings = Settings(
        CID_DATABASE_URL="sqlite:///" + str(new),
        APP_KEY="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        session_secure_cookie=False,
        app_url="http://testserver",
        google_cloud_storage_bucket="example-recordings",
        cache_bucket="example-exports",
        notification_configuration=Path(__file__).parent
        / "fixtures/notifications.json",
    )
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json={}))
    mail = []
    queued = []
    app = create_app(
        settings,
        state=MemoryState(),
        http=httpx.Client(transport=transport),
        clock=lambda: NOW,
        enqueue=queued.append,
        mailer=lambda *args: mail.append(args),
    )
    with TestClient(app, follow_redirects=False) as client:
        yield old, app, client, queued, mail
    app.state.db.engine.dispose()


def bearer(user=1):
    return {
        "Authorization": f"Bearer {user}|token-{user}",
        "Accept": "application/json",
    }
