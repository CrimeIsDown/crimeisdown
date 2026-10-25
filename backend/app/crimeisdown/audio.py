import hashlib
import hmac
import lzma
import math
import shutil
import subprocess
import tempfile
import uuid
from datetime import UTC, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from dateutil.parser import parse
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import func, select, update

from .application import fields, invalid, payload, require_user
from .database import decoded
from .storage import GCSStorage, LocalStorage

LOCAL = ZoneInfo("America/Chicago")
BCFY = [f"zone{i}" for i in range(1, 14) if i != 5]
FEEDS = (
    [f"zone{i}" for i in range(1, 14)]
    + [f"citywide{i}" for i in range(1, 8)]
    + ["fire_main", "fire_englewood", "ems_main", "ems_englewood"]
)


def local_datetime(value: Any) -> Any:
    date = parse(value)
    return date.replace(tzinfo=LOCAL) if date.tzinfo is None else date.astimezone(LOCAL)


def source_prefix(feed: Any, hour: Any, broadcastify: Any) -> Any:
    hour = hour.astimezone(UTC if broadcastify else LOCAL)
    return (
        ("broadcastify/" if broadcastify else "")
        + hour.strftime("%Y/%m/%d/%H/")
        + feed
        + "_"
        + hour.strftime("%Y%m%d_%H")
    )


def buckets(start: Any, end: Any) -> Any:
    cursor = start.astimezone(UTC)
    while cursor < end.astimezone(UTC):
        yield cursor.astimezone(LOCAL)
        cursor += timedelta(hours=1)


def convert(source: Any, target: Any, *, concat: Any = False) -> Any:
    args = ["ffmpeg", "-hide_banner", "-loglevel", "warning", "-y"]
    if concat:
        args.extend(["-f", "concat", "-safe", "0"])
    args.extend(
        [
            "-i",
            str(source),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "9",
            "-ac",
            "1",
            "-ar",
            "16000",
            str(target),
        ]
    )
    subprocess.run(args, check=True, capture_output=True, timeout=3600)
    if not target.exists() or target.stat().st_size < 1024:
        raise RuntimeError("Could not convert recording.")


def download_mp3(storage: Any, source: Any, directory: Any) -> Any:
    path = directory / (uuid.uuid4().hex + "_" + Path(source).name)
    storage.download("recordings", source, path)
    if path.suffix == ".xz":
        output = path.with_suffix("")
        with lzma.open(path, "rb") as reader, output.open("wb") as writer:
            shutil.copyfileobj(reader, writer)
        path.unlink()
        path = output
    if path.suffix != ".mp3":
        output = path.with_suffix(".mp3")
        convert(path, output)
        path.unlink()
        path = output
    return path


class LostExportClaim(Exception):
    """An interrupted attempt cannot overwrite its replacement's result."""


def build_export(db: Any, services: Any, storage: Any, export_id: Any) -> Any:
    with db.session() as session:
        t = db.table("audio_range_exports")
        # Fence every update using the existing error column during processing.
        # Terminal states retain Laravel's original error semantics, without DDL.
        claim = "claim:" + uuid.uuid4().hex
        uploaded = None

        def owned_change(values: Any) -> None:
            values["updated_at"] = services.now().replace(tzinfo=None)
            result = session.execute(
                update(t)
                .where(
                    t.c.id == export_id,
                    t.c.status == "processing",
                    t.c.error_message == claim,
                )
                .values(**db.prepare(t, values))
            )
            if not result.rowcount:
                session.rollback()
                raise LostExportClaim
            session.commit()

        # An atomic claim makes duplicate queue deliveries harmless.
        claimed = session.execute(
            update(t)
            .where(t.c.id == export_id, t.c.status == "queued")
            .values(
                status="processing",
                error_message=claim,
                updated_at=services.now().replace(tzinfo=None),
            )
        )
        session.commit()
        if not claimed.rowcount:
            return
        record = db.get(session, "audio_range_exports", export_id)
        start, end = record["start_at"], record["end_at"]
        if isinstance(start, str):
            start, end = parse(start), parse(end)
        start = start.replace(tzinfo=UTC).astimezone(LOCAL)
        end = end.replace(tzinfo=UTC).astimezone(LOCAL)
        processed, missing = 0, []
        try:
            with tempfile.TemporaryDirectory(prefix="cid-export-") as directory:
                root = Path(directory)
                files = []
                for hour in buckets(start, end):
                    sources = storage.listing(
                        "recordings",
                        source_prefix(record["feed"], hour, record["broadcastify"]),
                    )
                    if not sources:
                        missing.append(hour.isoformat())
                    for source in sources:
                        files.append(download_mp3(storage, source, root))
                    processed += 1
                    owned_change(
                        {"processed_hours": processed, "missing_hours": missing}
                    )
                if not files:
                    raise RuntimeError("No recordings found in requested range.")
                listing = root / "concat.txt"
                listing.write_text(
                    "".join(
                        "file '" + str(file).replace("'", "'\\''") + "'\n"
                        for file in files
                    )
                )
                output = root / "merged.mp3"
                convert(listing, output, concat=True)
                destination = (
                    "ranges/"
                    + services.now().astimezone(LOCAL).strftime("%Y/%m/%d/")
                    + export_id
                    + "/"
                    + claim.removeprefix("claim:")
                    + "/"
                    + record["feed"]
                    + "_"
                    + start.strftime("%Y%m%d_%H")
                    + "_"
                    + end.strftime("%Y%m%d_%H")
                    + ".mp3"
                )
                storage.upload("cache", destination, output)
                uploaded = destination
                owned_change(
                    {
                        "status": "succeeded",
                        "error_message": None,
                        "output_path": destination,
                        "completed_at": services.now().replace(tzinfo=None),
                        "expires_at": (services.now() + timedelta(days=7)).replace(
                            tzinfo=None
                        ),
                    }
                )
                uploaded = None
        except LostExportClaim:
            pass
        except Exception as exc:
            session.rollback()
            services_error = (
                str(exc)
                if isinstance(exc, RuntimeError)
                else "Could not process recordings. Please try again later."
            )
            try:
                owned_change(
                    {
                        "status": "failed",
                        "processed_hours": processed,
                        "missing_hours": missing,
                        "error_message": services_error,
                        "completed_at": services.now().replace(tzinfo=None),
                    }
                )
            except LostExportClaim:
                pass
        finally:
            if uploaded:
                storage.delete("cache", uploaded)


def cleanup(db: Any, services: Any, storage: Any) -> Any:
    count = 0
    with db.session() as session:
        for record in db.rows(session, "audio_range_exports"):
            value = record["expires_at"] or record["created_at"]
            value = parse(value) if isinstance(value, str) else value
            cutoff = (
                services.now()
                if record["expires_at"]
                else services.now() - timedelta(days=7)
            )
            if value.replace(tzinfo=UTC) < cutoff:
                if record["output_path"]:
                    storage.delete("cache", record["output_path"])
                db.remove(session, "audio_range_exports", id=record["id"])
                count += 1
        session.commit()
    return count


def register_audio(app: FastAPI, db: Any, services: Any) -> Any:
    settings = services.settings
    storage = app.state.storage or (
        LocalStorage(settings.archive_local_root, settings)
        if settings.archive_local_root
        else GCSStorage(settings)
    )
    app.state.storage = storage

    @app.get("/recordings/health")
    def health(request: Request) -> Any:
        broadcastify = request.query_params.get("broadcastify", "").lower() in (
            "1",
            "true",
            "on",
            "yes",
        )
        value = request.query_params.get("datetime")
        try:
            hour = (
                local_datetime(value)
                if value
                else services.now().astimezone(LOCAL) - timedelta(hours=1)
            )
        except ValueError, OverflowError:
            raise HTTPException(400, "Invalid datetime") from None
        if not value and hour.minute < 10:
            hour -= timedelta(hours=1)
        feed = request.query_params.get("feed")
        if feed:
            if feed not in (BCFY if broadcastify else FEEDS):
                raise HTTPException(400, "Invalid feed")
            prefix = source_prefix(feed, hour, broadcastify)
        else:
            hour = hour.astimezone(UTC if broadcastify else LOCAL)
            prefix = ("broadcastify/" if broadcastify else "") + hour.strftime(
                "%Y/%m/%d/%H/"
            )
        files = storage.listing("recordings", prefix)
        if not files:
            raise HTTPException(404, "Could not find recording")
        return {"count": len(files), "files": files}

    @app.get("/recordings/download-audio")
    def download(request: Request) -> Any:
        feed = request.query_params.get("feed")
        broadcastify = request.query_params.get("broadcastify", "").lower() in (
            "1",
            "true",
            "on",
            "yes",
        )
        try:
            if feed not in (BCFY if broadcastify else FEEDS):
                raise ValueError()
            hour = local_datetime(request.query_params.get("datetime", ""))
        except ValueError, OverflowError:
            return HTMLResponse(
                "<p>Make sure you have selected a valid feed and datetime.</p>",
                status_code=400,
            )
        user = request.state.user
        limit = services.download_limit(request.state.db, user)
        ident = (
            str(user["id"])
            if user
            else (request.client.host if request.client else "unknown")
        )
        key = "archive-download:" + ident
        used = services.state.get(key) or 0
        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(max(0, limit - used)),
        }
        if used >= limit:
            return HTMLResponse(
                f'<p>You have reached your daily download limit of {limit}.</p><p><a href="https://www.patreon.com/EricTendian">Become a patron</a> or <a href="/auth/redirect">login</a> to increase your limit.</p>',
                status_code=429,
                headers={**headers, "Retry-After": "86400"},
            )
        basename = feed + "_" + hour.astimezone(LOCAL).strftime("%Y%m%d_%H")
        cached = [f for f in storage.listing("cache", basename) if f.endswith(".mp3")]
        hit = bool(cached)
        if cached:
            destination = cached[0]
        else:
            sources = storage.listing(
                "recordings", source_prefix(feed, hour, broadcastify)
            )
            if not sources:
                return HTMLResponse(
                    "<p>Error: No recording found at that time. If this is a very recent recording, it may not have been uploaded yet (it can take up to an hour to upload). Otherwise, please try a different hour.</p>",
                    status_code=404,
                )
            source = sources[0]
            suffix = Path(source).name.split(".")[0][-4:]
            destination = basename + suffix + ".mp3"
            with tempfile.TemporaryDirectory(prefix="cid-download-") as directory:
                output = download_mp3(storage, source, Path(directory))
                storage.upload("cache", destination, output)
        if not hit:
            used = services.state.increment(key, 86400)
        headers.update(
            {
                "X-Cache": "HIT" if hit else "MISS",
                "X-RateLimit-Remaining": str(max(0, limit - used)),
            }
        )
        return RedirectResponse(
            storage.url(destination, services.now()), status_code=302, headers=headers
        )

    @app.post("/api/audio-range-exports")
    async def export(request: Request) -> Any:
        user = require_user(request)
        services.commander(request.state.db, user)
        data = await payload(request)
        fields(
            data,
            required=("feed", "start_datetime", "end_datetime"),
            strings=("feed", "start_datetime", "end_datetime"),
            booleans=("broadcastify",),
        )
        broadcastify = data.get("broadcastify", False)
        if data["feed"] not in (BCFY if broadcastify else FEEDS):
            invalid("feed", "The selected feed is invalid.")
        try:
            start, end = (
                local_datetime(data["start_datetime"]),
                local_datetime(data["end_datetime"]),
            )
        except ValueError, OverflowError:
            invalid("start_datetime", "Could not parse date range.")
        seconds = (end.astimezone(UTC) - start.astimezone(UTC)).total_seconds()
        if seconds <= 0:
            invalid("end_datetime", "end_datetime must be after start_datetime.")
        if start.minute or start.second or end.minute or end.second:
            invalid(
                "start_datetime",
                "start_datetime and end_datetime must be hour-aligned (mm:ss = 00:00).",
            )
        if seconds > 86400:
            invalid("end_datetime", "Time range must be 24 hours or less.")
        hours = math.ceil(seconds / 3600)
        # End the authentication snapshot before taking the reservation lock.
        # MySQL REPEATABLE READ would otherwise let a waiter sum stale charges.
        request.state.db.commit()
        db.get(request.state.db, "users", user["id"], lock=True)
        today = (
            services.now()
            .astimezone(LOCAL)
            .replace(hour=0, minute=0, second=0, microsecond=0)
        )
        tomorrow = today + timedelta(days=1)
        table = db.table("audio_range_exports")
        used = request.state.db.execute(
            select(func.coalesce(func.sum(table.c.charged_hours), 0)).where(
                table.c.user_id == user["id"],
                table.c.created_at >= today.astimezone(UTC).replace(tzinfo=None),
                table.c.created_at < tomorrow.astimezone(UTC).replace(tzinfo=None),
            )
        ).scalar_one()
        limit = services.download_limit(request.state.db, user)
        if used + hours > limit:
            raise HTTPException(
                429,
                f"You have {max(0, limit - used)} archive export hours remaining today.",
            )
        record = db.create(
            request.state.db,
            "audio_range_exports",
            {
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "feed": data["feed"],
                "broadcastify": broadcastify,
                "start_at": start.astimezone(UTC).replace(tzinfo=None),
                "end_at": end.astimezone(UTC).replace(tzinfo=None),
                "requested_hours": hours,
                "processed_hours": 0,
                "charged_hours": hours,
                "status": "queued",
                "missing_hours": [],
            },
            services.now(),
        )
        request.state.db.commit()
        if app.state.enqueue:
            app.state.enqueue(record["id"])
        else:
            from .worker import build_audio_export

            try:
                build_audio_export.delay(record["id"])
            except Exception:
                # The committed queued row is recoverable by the scheduled dispatcher.
                import logging

                logging.getLogger(__name__).exception(
                    "Audio export dispatch failed; queued row retained"
                )
        return JSONResponse(
            {
                "id": record["id"],
                "status": "queued",
                "requested_hours": hours,
                "charged_hours": hours,
                "status_url": settings.app_url.rstrip("/")
                + "/api/audio-range-exports/"
                + record["id"],
            },
            status_code=202,
        )

    @app.get("/api/audio-range-exports/{export_id}")
    def export_status(export_id: str, request: Request) -> Any:
        user = require_user(request)
        services.commander(request.state.db, user)
        record = db.get(request.state.db, "audio_range_exports", export_id)
        if not record:
            raise HTTPException(404, "Not Found")
        if record["user_id"] != user["id"]:
            raise HTTPException(403, "Forbidden")
        result = {
            k: record[k] for k in ("id", "status", "requested_hours", "processed_hours")
        }
        result["missing_hours"] = decoded(record["missing_hours"], [])
        if record["status"] == "succeeded" and record["output_path"]:
            result["download_url"] = storage.url(record["output_path"], services.now())
        if record["status"] == "failed" and record["error_message"]:
            result["error"] = record["error_message"]
        return result

    if isinstance(storage, LocalStorage):

        @app.get("/recordings-temp/{name:path}")
        def local_file(name: str, request: Request) -> Any:
            expires = request.query_params.get("expires", "")
            expected = hmac.new(
                settings.encryption_key(), f"{name}|{expires}".encode(), hashlib.sha256
            ).hexdigest()
            if (
                not expires.isdigit()
                or int(expires) < services.now().timestamp()
                or not hmac.compare_digest(
                    expected, request.query_params.get("signature", "")
                )
            ):
                raise HTTPException(403, "Invalid signature.")
            path = storage.path("cache", name)
            if not path.is_file():
                raise HTTPException(404, "Not Found")
            return FileResponse(path, media_type="audio/mpeg")
