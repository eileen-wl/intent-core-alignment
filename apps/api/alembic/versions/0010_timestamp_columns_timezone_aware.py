"""convert drifted PostgreSQL timestamp columns to timestamptz

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-20

Root cause: every model's ``Mapped[datetime]`` column relied on
SQLAlchemy's default (timezone-*naive*) type inference instead of
declaring ``DateTime(timezone=True)`` explicitly -- even though every
``_utcnow()`` default already produces a timezone-aware UTC value, and
every migration 0001-0009's ``op.create_table(...)`` DDL already declares
``sa.DateTime(timezone=True)``. A PostgreSQL database that was ever
bootstrapped via ``Base.metadata.create_all()`` (which derives column
types from the ORM model, not from these migration files) instead of a
clean ``alembic upgrade head`` run can therefore end up with genuinely
``TIMESTAMP WITHOUT TIME ZONE`` columns despite what every migration file
says. asyncpg selects its wire-protocol codec from the database's
*actual* column type (via PostgreSQL's own parameter-type inference), not
from SQLAlchemy's Python-side type object, so INSERTing a timezone-aware
value into such a column raises ``TypeError: can't subtract offset-naive
and offset-aware datetimes``. Fixing only the ORM/model side (see
``intent_core_api.db.Base.type_annotation_map``) does not by itself
change an already-existing column's real type -- this migration is the
part that does.

Deliberately defensive rather than assuming every column below is
currently naive: each ``(table, column)`` pair is checked against
``information_schema.columns`` first, and only converted if it is
actually ``timestamp without time zone``. Anything already correct (e.g.
a database that has only ever been built via a clean ``alembic upgrade
head``) is left untouched. ``... AT TIME ZONE 'UTC'`` is the correct
conversion because every writer of these columns has only ever produced
UTC wall-clock values.

No-op on SQLite -- it has no distinct naive/aware timestamp storage type,
so there is nothing to correct there (this is also why
``test_migrations_upgrade_and_downgrade_against_file_based_sqlite``,
which only ever runs against SQLite, is unaffected by this migration).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

# Every timestamp column across migrations 0001-0009, grouped by table.
_TIMESTAMP_COLUMNS: dict[str, tuple[str, ...]] = {
    "projects": ("created_at", "updated_at"),
    "shots": ("created_at", "updated_at"),
    "tasks": ("created_at", "updated_at"),
    "worker_heartbeats": ("last_ping_at",),
    "intent_briefs": ("created_at",),
    "core_anchors": ("created_at", "updated_at"),
    "core_anchor_revisions": ("confirmed_at", "created_at", "updated_at"),
    "decisions": ("created_at",),
    "workflow_transitions": ("occurred_at",),
    "audit_events": ("occurred_at",),
    "execution_anchors": ("created_at", "updated_at"),
    "execution_anchor_revisions": ("confirmed_at", "created_at", "updated_at"),
    "external_entity_links": ("created_at", "updated_at"),
    "sync_cursors": ("last_synced_at", "created_at", "updated_at"),
    "writeback_records": ("created_at", "completed_at"),
}


def _is_naive_timestamp(bind: sa.engine.Connection, table: str, column: str) -> bool:
    data_type = bind.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).scalar()
    return data_type == "timestamp without time zone"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table, columns in _TIMESTAMP_COLUMNS.items():
        for column in columns:
            if _is_naive_timestamp(bind, table, column):
                op.execute(
                    f'ALTER TABLE "{table}" ALTER COLUMN "{column}" '
                    f"TYPE timestamptz USING \"{column}\" AT TIME ZONE 'UTC'"
                )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    # Deliberately unsupported: this migration doesn't track which columns
    # it actually converted (that depended on each database's drifted
    # state at upgrade time), so a blind reversal risks silently
    # discarding UTC-offset information a column may have always had.
    # Revert by hand against the specific database if ever truly needed.
    raise NotImplementedError(
        "0010 does not support downgrade on PostgreSQL -- see module docstring"
    )
