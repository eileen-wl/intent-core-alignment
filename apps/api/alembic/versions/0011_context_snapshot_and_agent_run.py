"""context snapshots and agent runs (WP-B1.5)

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-21

Adds `context_snapshots` (immutable, JSON payload) and `agent_runs`
(one row per Core Agent execution), plus a new nullable
`context_snapshot_id` FK column on `core_anchor_revisions`.

`core_anchor_revisions.created_by_agent_run_id` (existing since 0003) is
deliberately NOT given a hard FK to `agent_runs.id` here: that column
predates this migration and B1 only ever wrote an opaque `uuid4()` into
it, so an environment with pre-WP-B1.5 agent-authored revisions could
already hold values that don't resolve to any real `agent_runs` row --
adding a strict FK would fail to apply against such data. It remains a
loose reference, same pattern as `workflow.models.Decision.entity_id`
and `integrations.models.ExternalEntityLink.entity_id`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "context_snapshots",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "agent_runs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "context_snapshot_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("context_snapshots.id"),
            nullable=False,
        ),
        sa.Column("agent_type", sa.String(40), nullable=False),
        sa.Column("capability", sa.String(50), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="running"),
        sa.Column(
            "result_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=True,
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    with op.batch_alter_table("core_anchor_revisions") as batch_op:
        batch_op.add_column(sa.Column("context_snapshot_id", sa.Uuid(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_core_anchor_revisions_context_snapshot_id",
            "context_snapshots",
            ["context_snapshot_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("core_anchor_revisions") as batch_op:
        batch_op.drop_constraint("fk_core_anchor_revisions_context_snapshot_id", type_="foreignkey")
        batch_op.drop_column("context_snapshot_id")
    op.drop_table("agent_runs")
    op.drop_table("context_snapshots")
