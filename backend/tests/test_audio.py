import subprocess
from datetime import datetime, timedelta

import pytest

from app.crimeisdown.audio import LOCAL, buckets, build_export, cleanup, source_prefix

from .conftest import NOW, bearer


def audio_runtime(pair, tmp_path):
    old, app, client, queued, mail = pair
    # Replace route closure's storage with a fresh app using the local archive adapter.
    from fastapi.testclient import TestClient

    from app.crimeisdown.application import create_app

    settings = app.state.settings.model_copy(
        update={"archive_local_root": tmp_path / "audio"}
    )
    app = create_app(
        settings,
        state=app.state.services.state,
        clock=lambda: NOW,
        enqueue=queued.append,
        mailer=lambda *args: mail.append(args),
    )
    return app, TestClient(app, follow_redirects=False)


def fixture_audio(storage, name, tmp_path):
    source = tmp_path / "tone.wav"
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
            str(source),
        ],
        check=True,
    )
    storage.upload("recordings", name, source)


def test_range_creation_matches_original_and_rejects_invalid_ranges(pair, tmp_path):
    app, client = audio_runtime(pair, tmp_path)
    body = {
        "feed": "zone1",
        "start_datetime": "2026-10-20 10:00:00",
        "end_datetime": "2026-10-20 12:00:00",
        "broadcastify": False,
    }
    actual = client.post("/api/audio-range-exports", headers=bearer(2), json=body)
    assert actual.status_code == 202 and actual.json()["requested_hours"] == 2
    assert pair[3] == [actual.json()["id"]]
    assert (
        client.post("/api/audio-range-exports", headers=bearer(), json=body).status_code
        == 403
    )
    for changes in (
        {"feed": "invalid"},
        {"end_datetime": "2026-10-20 09:00:00"},
        {"end_datetime": "2026-10-22 10:00:00"},
        {"start_datetime": "2026-10-20 10:30:00"},
    ):
        assert (
            client.post(
                "/api/audio-range-exports", headers=bearer(2), json={**body, **changes}
            ).status_code
            == 422
        )
    assert (
        client.get(
            "/api/audio-range-exports/" + actual.json()["id"], headers=bearer(3)
        ).status_code
        == 403
    )


def test_real_conversion_export_missing_hour_signed_download_and_cleanup(
    pair, tmp_path
):
    app, client = audio_runtime(pair, tmp_path)
    storage = app.state.storage
    fixture_audio(storage, "2026/10/20/10/zone1_20261020_100000.wav", tmp_path)
    response = client.post(
        "/api/audio-range-exports",
        headers=bearer(2),
        json={
            "feed": "zone1",
            "start_datetime": "2026-10-20 10:00:00",
            "end_datetime": "2026-10-20 12:00:00",
        },
    )
    export_id = response.json()["id"]
    build_export(app.state.db, app.state.services, storage, export_id)
    result = client.get(
        "/api/audio-range-exports/" + export_id, headers=bearer(2)
    ).json()
    assert result["status"] == "succeeded" and result["processed_hours"] == 2
    assert result["missing_hours"] == ["2026-10-20T11:00:00-05:00"]
    download = client.get(result["download_url"])
    assert download.status_code == 200 and len(download.content) > 1024
    assert (
        client.get(
            result["download_url"].replace("signature=", "signature=bad")
        ).status_code
        == 403
    )
    # Duplicate deliveries cannot rebuild a finished export or charge it twice.
    build_export(app.state.db, app.state.services, storage, export_id)
    with app.state.db.session() as session:
        row = app.state.db.get(session, "audio_range_exports", export_id)
        assert row["charged_hours"] == 2
        output = row["output_path"]
        app.state.db.change(
            session,
            "audio_range_exports",
            export_id,
            {"expires_at": (NOW - timedelta(seconds=1)).replace(tzinfo=None)},
            NOW,
        )
        session.commit()
    assert cleanup(app.state.db, app.state.services, storage) == 1
    assert not storage.path("cache", output).exists()


def test_download_cache_hits_and_failures_do_not_consume_limit(pair, tmp_path):
    app, client = audio_runtime(pair, tmp_path)
    storage = app.state.storage
    fixture_audio(storage, "2026/10/20/10/zone1_20261020_100000.wav", tmp_path)
    url = "/recordings/download-audio?feed=zone1&datetime=2026-10-20%2010:00:00"
    first = client.get(url)
    assert first.status_code == 302 and first.headers["x-cache"] == "MISS"
    assert first.headers["x-ratelimit-remaining"] == "4"
    again = client.get(url)
    assert (
        again.headers["x-cache"] == "HIT"
        and again.headers["x-ratelimit-remaining"] == "4"
    )
    assert client.get(url.replace("zone1", "zone2")).status_code == 404
    assert (
        client.get(
            "/recordings/health?feed=zone1&datetime=2026-10-20%2010:00:00"
        ).json()["count"]
        == 1
    )


def test_failed_export_keeps_charged_hours_and_error(pair, tmp_path):
    app, client = audio_runtime(pair, tmp_path)
    response = client.post(
        "/api/audio-range-exports",
        headers=bearer(2),
        json={
            "feed": "zone1",
            "start_datetime": "2026-10-20 10:00:00",
            "end_datetime": "2026-10-20 12:00:00",
        },
    )
    export_id = response.json()["id"]
    build_export(app.state.db, app.state.services, app.state.storage, export_id)
    result = client.get(
        "/api/audio-range-exports/" + export_id, headers=bearer(2)
    ).json()
    assert (
        result["status"] == "failed"
        and result["error"] == "No recordings found in requested range."
    )
    assert result["processed_hours"] == 2
    with app.state.db.session() as session:
        assert (
            app.state.db.get(session, "audio_range_exports", export_id)["charged_hours"]
            == 2
        )


def test_dst_real_hour_buckets_and_broadcastify_utc_paths():
    start = datetime(2026, 11, 1, 0, tzinfo=LOCAL)
    end = datetime(2026, 11, 1, 3, tzinfo=LOCAL)
    hours = list(buckets(start, end))
    assert len(hours) == 4 and hours[1].hour == hours[2].hour == 1
    assert hours[1].utcoffset() != hours[2].utcoffset()
    assert (
        source_prefix("zone1", start, True)
        == "broadcastify/2026/11/01/05/zone1_20261101_05"
    )


def test_reclaimed_export_cannot_be_overwritten_by_original_worker(pair, tmp_path):
    app, client = audio_runtime(pair, tmp_path)
    response = client.post(
        "/api/audio-range-exports",
        headers=bearer(2),
        json={
            "feed": "zone1",
            "start_datetime": "2026-10-20 10:00:00",
            "end_datetime": "2026-10-20 11:00:00",
            "broadcastify": False,
        },
    )
    export_id = response.json()["id"]
    storage = app.state.storage
    original = storage.listing

    def reclaimed(kind, prefix):
        # A suspended attempt resumes after the dispatcher and a new worker.
        with app.state.db.session() as session:
            app.state.db.change(
                session,
                "audio_range_exports",
                export_id,
                {
                    "status": "succeeded",
                    "error_message": None,
                    "processed_hours": 1,
                    "output_path": "replacement-owned.mp3",
                },
                NOW,
            )
            session.commit()
        return original(kind, prefix)

    storage.listing = reclaimed
    build_export(app.state.db, app.state.services, storage, export_id)
    with app.state.db.session() as session:
        record = app.state.db.get(session, "audio_range_exports", export_id)
        assert record["status"] == "succeeded"
        assert record["output_path"] == "replacement-owned.mp3"
        assert record["processed_hours"] == 1 and record["error_message"] is None


def test_xz_recordings_are_decompressed_and_converted(pair, tmp_path):
    import lzma

    from app.crimeisdown.audio import download_mp3

    app, _ = audio_runtime(pair, tmp_path)
    fixture_audio(app.state.storage, "sample.wav", tmp_path)
    source = app.state.storage.path("recordings", "sample.wav")
    app.state.storage.path("recordings", "sample.wav.xz").write_bytes(
        lzma.compress(source.read_bytes())
    )
    output = download_mp3(app.state.storage, "sample.wav.xz", tmp_path)
    assert output.suffix == ".mp3" and output.stat().st_size > 1024


def broadcastify_hour(storage, hour, tmp_path, suffix=".mp3"):
    import lzma

    from app.crimeisdown.audio import convert

    prefix = f"broadcastify/2026/10/31/{hour:02d}/zone7_20261031_{hour:02d}0000"
    fixture_audio(storage, prefix + ".wav", tmp_path)
    wav = storage.path("recordings", prefix + ".wav")
    mp3 = tmp_path / "recording.mp3"
    convert(wav, mp3)
    if suffix.endswith(".xz"):
        compressed = tmp_path / ("recording" + suffix)
        compressed.write_bytes(
            lzma.compress((wav if suffix == ".wav.xz" else mp3).read_bytes())
        )
        storage.upload("recordings", prefix + suffix, compressed)
    else:
        storage.upload("recordings", prefix + suffix, mp3)
    wav.unlink()
    metadata = storage.path("recordings", prefix + ".json")
    metadata.write_text('{"feed": "zone7", "segments": []}')
    metadata.with_suffix(".json.xz").write_bytes(lzma.compress(metadata.read_bytes()))
    return prefix


@pytest.mark.parametrize("hour", [0, 1])
@pytest.mark.parametrize("suffix", [".mp3", ".mp3.xz", ".wav.xz"])
def test_broadcastify_download_ignores_metadata(pair, tmp_path, hour, suffix):
    app, client = audio_runtime(pair, tmp_path)
    prefix = broadcastify_hour(app.state.storage, hour + 5, tmp_path, suffix)
    params = {
        "feed": "zone7",
        "datetime": f"2026-10-31T{hour:02d}:00:00-05:00",
        "broadcastify": "1",
    }
    response = client.get("/recordings/download-audio", params=params)
    assert response.status_code == 302
    assert client.get(response.headers["location"]).status_code == 200
    assert client.get("/recordings/health", params=params).json() == {
        "count": 1,
        "files": [prefix + suffix],
    }


@pytest.mark.parametrize("metadata_only", [False, True])
def test_broadcastify_export_ignores_metadata(pair, tmp_path, metadata_only):
    app, client = audio_runtime(pair, tmp_path)
    for hour in [5, 6]:
        prefix = broadcastify_hour(app.state.storage, hour, tmp_path)
        if metadata_only:
            app.state.storage.delete("recordings", prefix + ".mp3")
    response = client.post(
        "/api/audio-range-exports",
        headers=bearer(2),
        json={
            "feed": "zone7",
            "start_datetime": "2026-10-31 00:00:00",
            "end_datetime": "2026-10-31 02:00:00",
            "broadcastify": True,
        },
    )
    assert response.status_code == 202
    export_id = response.json()["id"]
    build_export(app.state.db, app.state.services, app.state.storage, export_id)
    result = client.get(
        "/api/audio-range-exports/" + export_id, headers=bearer(2)
    ).json()
    assert result["processed_hours"] == 2
    if metadata_only:
        assert result["status"] == "failed"
        assert result["error"] == "No recordings found in requested range."
        assert len(result["missing_hours"]) == 2
        params = {
            "feed": "zone7",
            "datetime": "2026-10-31T00:00:00-05:00",
            "broadcastify": "1",
        }
        assert (
            client.get("/recordings/download-audio", params=params).status_code == 404
        )
        assert client.get("/recordings/health", params=params).status_code == 404
    else:
        assert result["status"] == "succeeded"
        assert result["missing_hours"] == []
        download = client.get(result["download_url"])
        assert download.status_code == 200 and len(download.content) > 1024
