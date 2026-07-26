"""context reconstruction (Step 1C)

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-26

Adds `context_reconstructions` -- one immutable Core Agent output per
generation run, linking a Shot to the ContextSnapshot and AgentRun that
produced it. No PATCH/DELETE path exists anywhere in the API surface for
this table; multiple reconstructions may exist for the same Shot (no
active/latest/selected pointer).

This is an additive migration only -- it does not modify migration 0015
or any existing table.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "context_reconstructions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "context_snapshot_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("context_snapshots.id"),
            nullable=False,
        ),
        sa.Column(
            "agent_run_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("agent_runs.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("reconstructed_context", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_context_reconstructions_shot_id", "context_reconstructions", ["shot_id"])


def downgrade() -> None:
    op.drop_index("ix_context_reconstructions_shot_id", table_name="context_reconstructions")
    op.drop_table("context_reconstructions")
