from functools import lru_cache
from typing import Any

from celery import Celery
from celery.schedules import crontab

from .settings import Settings

settings = Settings()
celery = Celery("crimeisdown", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.update(
    task_default_queue="cid-audio-exports",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    timezone="America/Chicago",
    task_time_limit=3600,
    task_soft_time_limit=3500,
    broker_transport_options={"visibility_timeout": 7200},
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    beat_schedule={
        "cleanup": {"task": "cid.cleanup", "schedule": crontab(hour=3, minute=15)},
        "dispatch": {"task": "cid.dispatch", "schedule": 60.0},
    },
)


@lru_cache(maxsize=1)
def runtime() -> Any:
    from .application import create_app

    return create_app(settings).state


@celery.task(name="cid.build_export")
def build_audio_export(export_id: Any) -> Any:
    from .audio import build_export

    app = runtime()
    build_export(app.db, app.services, app.storage, export_id)


@celery.task(name="cid.cleanup")
def cleanup_exports() -> Any:
    from .audio import cleanup

    app = runtime()
    return cleanup(app.db, app.services, app.storage)


@celery.task(name="cid.dispatch")
def dispatch_pending() -> Any:
    app = runtime()
    from datetime import UTC, datetime, timedelta

    from sqlalchemy import update

    with app.db.session() as session:
        # Recover an interrupted worker without changing the existing table schema.
        for record in app.db.rows(session, "audio_range_exports", status="processing"):
            modified = record["updated_at"]
            modified = (
                datetime.fromisoformat(modified)
                if isinstance(modified, str)
                else modified
            )
            if modified.replace(tzinfo=UTC) < app.services.now() - timedelta(hours=1):
                table = app.db.table("audio_range_exports")
                # Recheck the observed owner/heartbeat atomically. A worker may
                # have completed or advanced since the dispatcher's stale read.
                session.execute(
                    update(table)
                    .where(
                        table.c.id == record["id"],
                        table.c.status == "processing",
                        table.c.error_message == record["error_message"],
                        table.c.updated_at == record["updated_at"],
                    )
                    .values(
                        status="queued",
                        error_message=None,
                        updated_at=app.services.now().replace(tzinfo=None),
                    )
                )
        session.commit()
        for record in app.db.rows(session, "audio_range_exports", status="queued"):
            build_audio_export.delay(record["id"])
