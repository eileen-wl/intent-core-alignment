"""vfx supervisor review (Step 3)

Revision ID: 0019
Revises: 0018
Create Date: 2026-07-27

Adds `vfx_supervisor_reviews` -- one immutable advisory review of a
single Version, produced by the new VFX Supervisor Agent's
`creative_review` capability (`agent_type=vfx_supervisor_agent`). No
PATCH/DELETE path exists anywhere in the API surface; multiple reviews
may exist for the same Version, and there is no active/latest pointer --
same convention as `context_reconstructions` (migration
`0016_context_reconstruction.py`).

`agent_run_id` is unique (one row per AgentRun, same as
`alignment_assessments`/`context_reconstructions`); `project_id`,
`shot_id`, and `version_id` are all denormalized directly onto this row
(not derived solely via `context_snapshot_id`) so a review remains
queryable by Shot or by Version without joining through ContextSnapshot.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vfx_supervisor_reviews",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "version_id", sa.Uuid(as_uuid=True), sa.ForeignKey("versions.id"), nullable=False
        ),
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
        sa.Column("review_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_vfx_supervisor_reviews_shot_id", "vfx_supervisor_reviews", ["shot_id"])
    op.create_index(
        "ix_vfx_supervisor_reviews_version_id", "vfx_supervisor_reviews", ["version_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_vfx_supervisor_reviews_version_id", table_name="vfx_supervisor_reviews")
    op.drop_index("ix_vfx_supervisor_reviews_shot_id", table_name="vfx_supervisor_reviews")
    op.drop_table("vfx_supervisor_reviews")
