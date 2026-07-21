"""Every mapped ``datetime`` column must be timezone-aware.

Static schema assertion, not a live database roundtrip: this exists to
catch a regression (someone reverting `Base.type_annotation_map`, or
adding a new `Mapped[datetime]` column with an explicit naive
`DateTime()` override) before it can ever reach a real PostgreSQL
database and reproduce the asyncpg `TypeError: can't subtract
offset-naive and offset-aware datetimes` bug fixed by this change. Runs
with no live infra, so it's part of `make test`.
"""

from __future__ import annotations

from intent_core_api import models_registry  # noqa: F401  (populates Base.metadata)
from intent_core_api.db import Base
from sqlalchemy import DateTime


def test_every_datetime_column_is_timezone_aware() -> None:
    naive_columns = [
        f"{table.name}.{column.name}"
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, DateTime) and not column.type.timezone
    ]
    assert naive_columns == [], f"timezone-naive datetime columns found: {naive_columns}"


def test_at_least_one_datetime_column_was_actually_checked() -> None:
    # Guards against the above test passing vacuously (e.g. if
    # models_registry silently failed to populate Base.metadata).
    datetime_columns = [
        f"{table.name}.{column.name}"
        for table in Base.metadata.tables.values()
        for column in table.columns
        if isinstance(column.type, DateTime)
    ]
    assert len(datetime_columns) >= 20
