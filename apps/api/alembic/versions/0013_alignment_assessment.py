"""alignment assessments (Step 4b)

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-20

Adds `alignment_assessments` only. Does not alter `context_snapshots` or
`agent_runs` (both from 0011) -- Step 4b reuses them unmodified. This is
a brand-new table referencing four already-existing tables, so every FK
here is hard-enforced from the start, matching 0012's own reasoning.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alignment_assessments",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "version_id", sa.Uuid(as_uuid=True), sa.ForeignKey("versions.id"), nullable=False
        ),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column(
            "context_snapshot_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("context_snapshots.id"),
            nullable=False,
        ),
        sa.Column(
            "agent_run_id", sa.Uuid(as_uuid=True), sa.ForeignKey("agent_runs.id"), nullable=False
        ),
        sa.Column("alignment_state", sa.String(30), nullable=False),
        sa.Column("envelope", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("alignment_assessments")
