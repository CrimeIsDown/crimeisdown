import hashlib

from app.crimeisdown.cli import check_schema, manifest
from app.crimeisdown.state import LegacyFileState, MemoryState

from .conftest import NOW


def test_schema_check_and_manifest_are_read_only(pair):
    _, app, *_ = pair
    before = manifest(app.state.db)
    check_schema(app.state.db)
    assert manifest(app.state.db) == before
    assert before["users"]["rows"] == 5


def test_legacy_scalar_caches_preserve_search_keys_and_download_budgets(tmp_path):
    state = LegacyFileState(MemoryState(), tmp_path, lambda: NOW)
    key = hashlib.md5(b"archive-downloads1").hexdigest()
    path = state.path(key)
    path.parent.mkdir(parents=True)
    expiry = int(NOW.timestamp()) + 3600
    path.write_bytes(str(expiry).encode() + b"i:3;")
    assert state.get("archive-download:1") == 3
    assert state.increment("archive-download:1", 86400) == 4
    assert path.read_bytes() == str(expiry).encode() + b"i:4;"
    state.set("1_search_key", "existing-search-key", 3600)
    assert state.read("1_search_key") == "existing-search-key"
    assert state.decode(b'O:1:"A":0:{}') is None


def test_browser_validation_retains_form_and_nonsecret_values(pair):
    _, _, client, *_ = pair
    import re

    login = client.get("/login")
    token = re.search(r'name="_token" value="([^"]+)"', login.text)[1]
    failed = client.post(
        "/login",
        data={"email": "user1@example.com", "password": "wrong", "_token": token},
        headers={"Accept": "text/html"},
    )
    assert failed.status_code == 422
    assert "<form" in failed.text and 'value="user1@example.com"' in failed.text
    assert "These credentials do not match our records." in failed.text
    assert 'value="wrong"' not in failed.text


def test_worker_recovers_interrupted_exports_and_cleans_expired_rows(pair, monkeypatch):
    import uuid
    from datetime import timedelta

    from app.crimeisdown import worker

    _, app, *_ = pair
    db = app.state.db
    export_id = str(uuid.uuid4())
    with db.session() as session:
        db.create(
            session,
            "audio_range_exports",
            {
                "id": export_id,
                "user_id": 2,
                "feed": "zone1",
                "broadcastify": False,
                "start_at": NOW.replace(tzinfo=None),
                "end_at": (NOW + timedelta(hours=1)).replace(tzinfo=None),
                "requested_hours": 1,
                "charged_hours": 1,
                "processed_hours": 0,
                "status": "processing",
                "missing_hours": [],
                "updated_at": (NOW - timedelta(hours=2)).replace(tzinfo=None),
            },
            NOW,
        )
        session.commit()
    called = []
    monkeypatch.setattr(worker, "runtime", lambda: app.state)
    monkeypatch.setattr(worker.build_audio_export, "delay", called.append)
    worker.dispatch_pending.run()
    assert called == [export_id]
    with db.session() as session:
        assert db.get(session, "audio_range_exports", export_id)["status"] == "queued"
        db.change(
            session,
            "audio_range_exports",
            export_id,
            {"expires_at": (NOW - timedelta(seconds=1)).replace(tzinfo=None)},
            NOW,
        )
        session.commit()
    assert worker.cleanup_exports.run() == 1


def test_operational_cli_is_read_only_and_finds_existing_search_keys(
    pair, monkeypatch, capsys
):
    import sys

    from app.crimeisdown import application, cli

    _, app, *_ = pair
    monkeypatch.setattr(cli, "Settings", lambda: app.state.settings)
    monkeypatch.setattr(cli, "Database", lambda _: app.state.db)
    monkeypatch.setattr(application, "create_app", lambda *args, **kw: app)
    for command in ("check-schema", "data-manifest"):
        monkeypatch.setattr(sys, "argv", ["cid", command])
        cli.main()
        assert capsys.readouterr().out
    app.state.services.state.set("1_search_key", "key-to-find", 3600)
    monkeypatch.setattr(sys, "argv", ["cid", "find-search-key-owner", "key-to-find"])
    cli.main()
    assert "user1@example.com" in capsys.readouterr().out


def test_cloud_storage_preserves_bucket_keys_and_signing_contract(pair, tmp_path):
    from datetime import timedelta
    from unittest.mock import MagicMock

    from app.crimeisdown.storage import GCSStorage

    _, app, *_ = pair
    storage = GCSStorage(app.state.settings)
    storage._client = MagicMock()
    client = storage.client

    def blob(name):
        return type("Blob", (), {"name": name})()

    client.list_blobs.return_value = [
        blob("2026/01/01/10/zone1_a.wav"),
        blob("2026/01/01/10/zone2_a.wav"),
    ]
    assert storage.listing("recordings", "2026/01/01/10/zone1_") == [
        "2026/01/01/10/zone1_a.wav"
    ]
    client.bucket.assert_called_with(app.state.settings.google_cloud_storage_bucket)
    client.list_blobs.assert_called_with(
        client.bucket.return_value, prefix="2026/01/01/10/", delimiter="/"
    )
    target = tmp_path / "recording.wav"
    storage.download("recordings", "old-key.wav", target)
    client.bucket.return_value.blob.assert_called_with("old-key.wav")
    client.bucket.return_value.blob.return_value.download_to_filename.assert_called_with(
        target
    )
    storage.upload("cache", "ranges/id/output.mp3", target)
    client.bucket.assert_called_with(app.state.settings.cache_bucket)
    client.bucket.return_value.blob.return_value.upload_from_filename.assert_called_with(
        target, content_type="audio/mpeg"
    )
    storage.url("existing-output.mp3", NOW)
    client.bucket.return_value.blob.assert_called_with("existing-output.mp3")
    client.bucket.return_value.blob.return_value.generate_signed_url.assert_called_with(
        expiration=timedelta(days=1), version="v4", method="GET"
    )
    storage.delete("cache", "existing-output.mp3")
    client.bucket.return_value.blob.return_value.delete.assert_called_once()


def test_smtp_transport_uses_tls_and_existing_sender(pair, monkeypatch):
    from unittest.mock import MagicMock

    from pydantic import SecretStr

    from app.crimeisdown.accounts import send_mail

    _, app, *_ = pair
    app.state.mailer = None
    settings = app.state.settings
    settings.smtp_host = "smtp.example.com"
    settings.smtp_user = "user"
    settings.smtp_password = SecretStr("password")
    smtp = MagicMock()
    monkeypatch.setattr("app.crimeisdown.accounts.smtplib.SMTP", smtp)
    send_mail(app, "user@example.com", "Reset Password Notification", "Reset link")
    smtp.assert_called_once_with("smtp.example.com", 587, timeout=30)
    connection = smtp.return_value.__enter__.return_value
    connection.starttls.assert_called_once()
    connection.login.assert_called_once_with("user", "password")
    message = connection.send_message.call_args.args[0]
    assert message["From"] == settings.emails_from_email
    assert message["To"] == "user@example.com"
    assert "Reset link" in message.get_content()


def test_dispatcher_cannot_requeue_a_worker_that_just_completed(pair, monkeypatch):
    import uuid
    from datetime import timedelta

    from app.crimeisdown import worker

    _, app, *_ = pair
    db = app.state.db
    export_id = str(uuid.uuid4())
    with db.session() as session:
        db.create(
            session,
            "audio_range_exports",
            {
                "id": export_id,
                "user_id": 2,
                "feed": "zone1",
                "broadcastify": False,
                "start_at": NOW.replace(tzinfo=None),
                "end_at": NOW.replace(tzinfo=None),
                "requested_hours": 1,
                "charged_hours": 1,
                "processed_hours": 0,
                "status": "processing",
                "error_message": "claim:old",
                "missing_hours": [],
                "updated_at": (NOW - timedelta(hours=2)).replace(tzinfo=None),
            },
            NOW,
        )
        session.commit()
    original = db.rows

    def rows(session, table, **where):
        result = original(session, table, **where)
        if where.get("status") == "processing":
            db.change(
                session,
                table,
                export_id,
                {
                    "status": "succeeded",
                    "error_message": None,
                    "processed_hours": 1,
                    "output_path": "completed.mp3",
                },
                NOW,
            )
            session.commit()
        return result

    monkeypatch.setattr(db, "rows", rows)
    monkeypatch.setattr(worker, "runtime", lambda: app.state)
    queued = []
    monkeypatch.setattr(worker.build_audio_export, "delay", queued.append)
    worker.dispatch_pending.run()
    assert queued == []
    with db.session() as session:
        record = db.get(session, "audio_range_exports", export_id)
        assert (
            record["status"] == "succeeded" and record["output_path"] == "completed.mp3"
        )
