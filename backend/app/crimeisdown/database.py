import json
from datetime import UTC, datetime
from threading import Lock
from typing import Any

from sqlalchemy import MetaData, create_engine, delete, insert, select, update
from sqlalchemy.orm import Session


class Database:
    """Reflect, never create/migrate, the existing schema. Preserve unknown columns."""

    def __init__(self, url: Any) -> None:
        self.engine = create_engine(
            url,
            pool_pre_ping=True,
            **(
                {"connect_args": {"check_same_thread": False}}
                if url.startswith("sqlite")
                else {}
            ),
        )
        self.metadata = MetaData()
        self.lock = Lock()

    def table(self, name: Any) -> Any:
        with self.lock:
            if name not in self.metadata.tables:
                self.metadata.reflect(self.engine, only=[name], resolve_fks=False)
        return self.metadata.tables[name]

    def session(self) -> Any:
        return Session(self.engine, expire_on_commit=False)

    def get(
        self,
        session: Any,
        table: Any,
        value: Any,
        column: Any = "id",
        lock: Any = False,
    ) -> Any:
        t = self.table(table)
        q = select(t).where(t.c[column] == value)
        if lock:
            q = q.with_for_update()
        row = session.execute(q).mappings().first()
        return dict(row) if row else None

    def rows(self, session: Any, table: Any, **where: Any) -> Any:
        t = self.table(table)
        q = select(t)
        for key, value in where.items():
            q = q.where(t.c[key] == value)
        return [dict(row) for row in session.execute(q).mappings()]

    def create(self, session: Any, name: Any, values: Any, now: Any) -> Any:
        t = self.table(name)
        values = dict(values)
        for column in ("created_at", "updated_at"):
            if column in t.c:
                values.setdefault(column, now.replace(tzinfo=None))
        result = session.execute(insert(t).values(**self.prepare(t, values)))
        key = values.get("id", result.inserted_primary_key[0])
        session.flush()
        return self.get(session, name, key)

    def change(self, session: Any, name: Any, key: Any, values: Any, now: Any) -> Any:
        t = self.table(name)
        values = dict(values)
        if "updated_at" in t.c:
            values["updated_at"] = now.replace(tzinfo=None)
        session.execute(
            update(t).where(t.c.id == key).values(**self.prepare(t, values))
        )
        return self.get(session, name, key)

    @staticmethod
    def prepare(table: Any, values: Any) -> Any:
        from sqlalchemy import JSON, null

        result = {}
        for key, value in values.items():
            if key not in table.c:
                raise ValueError(f"Unknown {table.name} column: {key}")
            if value is None and isinstance(table.c[key].type, JSON):
                value = null()
            if isinstance(value, (dict, list)) and not isinstance(
                table.c[key].type, JSON
            ):
                value = json.dumps(value, separators=(",", ":"), ensure_ascii=False)
            result[key] = value
        return result

    def remove(self, session: Any, name: Any, **where: Any) -> Any:
        t = self.table(name)
        q = delete(t)
        for key, value in where.items():
            q = q.where(t.c[key] == value)
        session.execute(q)


def timestamp(value: Any) -> Any:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value
    if isinstance(value, datetime):
        return (
            value.replace(tzinfo=value.tzinfo or UTC)
            .astimezone(UTC)
            .isoformat(timespec="microseconds")
            .replace("+00:00", "Z")
        )
    return value


def serialized(row: Any) -> Any:
    return {k: timestamp(v) if k.endswith("_at") else v for k, v in row.items()}


def decoded(value: Any, default: Any = None) -> Any:
    return (
        json.loads(value)
        if isinstance(value, str)
        else (value if value is not None else default)
    )
