"""ftrack version and review note sync metadata (Step 8C-1)

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-02

Adds the additive, nullable columns the locked ftrack Version/ReviewNote
sync contract (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §13,
ADR-0014) requires before any sync logic can be built (a later slice --
not this one):

- `versions.task_id`: nullable FK to `tasks.id`, `ondelete="SET NULL"` --
  a ftrack-sourced Version's originating Task, resolved via
  ExternalEntityLink at sync time (not implemented here). Null for every
  existing manual Version, preserving the module's existing "a Shot may
  have several Tasks and several Versions with no join between them"
  convention for manual rows unchanged. `SET NULL` on Task deletion, not
  `CASCADE`: a Version is production history and must survive its
  originating Task being deleted or detached, per the contract's
  explicit "deleting or losing a Task must not delete a Version"
  requirement -- unlike `projects.shots`/`shots.tasks`, which do cascade,
  because those are structural containment relationships, not historical
  evidence.
- `versions.source_created_at` / `review_notes.source_created_at`:
  nullable, timezone-aware -- the real external ftrack creation
  timestamp, kept structurally separate from `created_at` (which keeps
  its existing ICAS-ingestion-time meaning, unchanged for every row).
- `versions.external_author_id` / `review_notes.external_author_id`:
  nullable -- the real external ftrack stable author id (never a
  username, email, or display name -- ADR-0014 Decision 2).
- `versions.external_author_name` / `review_notes.external_author_name`:
  nullable -- display-only author provenance fallback. Neither author
  field grants any ICAS human role or authority.

No column has a default that rewrites any existing row -- every existing
`versions`/`review_notes` row remains valid with all new columns NULL,
no backfill performed or required (matches 0018's own precedent for
`agent_runs.model_name`/`prompt_version`). `source` already exists on
both tables (0012) and is unchanged here.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite cannot ALTER a table directly -- `batch_alter_table` is this
    # repository's established pattern (0003/0011/0015/0018/0020) for
    # adding columns, with or without a new FK, to an existing table.
    with op.batch_alter_table("versions") as batch_op:
        batch_op.add_column(sa.Column("task_id", sa.Uuid(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_versions_task_id",
            "tasks",
            ["task_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.add_column(
            sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(sa.Column("external_author_id", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("external_author_name", sa.String(length=200), nullable=True))
    op.create_index("ix_versions_task_id", "versions", ["task_id"])

    with op.batch_alter_table("review_notes") as batch_op:
        batch_op.add_column(
            sa.Column("source_created_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(sa.Column("external_author_id", sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column("external_author_name", sa.String(length=200), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("review_notes") as batch_op:
        batch_op.drop_column("external_author_name")
        batch_op.drop_column("external_author_id")
        batch_op.drop_column("source_created_at")

    op.drop_index("ix_versions_task_id", table_name="versions")
    with op.batch_alter_table("versions") as batch_op:
        batch_op.drop_column("external_author_name")
        batch_op.drop_column("external_author_id")
        batch_op.drop_column("source_created_at")
        batch_op.drop_constraint("fk_versions_task_id", type_="foreignkey")
        batch_op.drop_column("task_id")
