"""artist agent guidance (Step 5)

Revision ID: 0021
Revises: 0020
Create Date: 2026-07-27

Adds `artist_agent_guidances` -- one immutable advisory Artist Agent
iteration guidance for a single Version, produced by the new Artist
Agent's `iteration_guidance` capability (`agent_type=artist_agent`).
Same shape as `vfx_supervisor_reviews`/`cg_supervisor_reviews`: no
PATCH/DELETE, no active/latest pointer, `agent_run_id` unique.

`task_id` and `execution_anchor_revision_id` are both required: `Version`
has no `task_id` of its own (see `versions_and_feedback.models.Version`'s
module docstring), so the caller supplies which Task this guidance is
for at generation time, and generation requires that Task's confirmed
Execution Anchor revision to exist.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artist_agent_guidances",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("task_id", sa.Uuid(as_uuid=True), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column(
            "version_id", sa.Uuid(as_uuid=True), sa.ForeignKey("versions.id"), nullable=False
        ),
        sa.Column(
            "execution_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("execution_anchor_revisions.id"),
            nullable=False,
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
        sa.Column("guidance_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_artist_agent_guidances_shot_id", "artist_agent_guidances", ["shot_id"])
    op.create_index("ix_artist_agent_guidances_task_id", "artist_agent_guidances", ["task_id"])
    op.create_index(
        "ix_artist_agent_guidances_version_id", "artist_agent_guidances", ["version_id"]
    )
    op.create_index(
        "ix_artist_agent_guidances_execution_anchor_revision_id",
        "artist_agent_guidances",
        ["execution_anchor_revision_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_artist_agent_guidances_execution_anchor_revision_id",
        table_name="artist_agent_guidances",
    )
    op.drop_index("ix_artist_agent_guidances_version_id", table_name="artist_agent_guidances")
    op.drop_index("ix_artist_agent_guidances_task_id", table_name="artist_agent_guidances")
    op.drop_index("ix_artist_agent_guidances_shot_id", table_name="artist_agent_guidances")
    op.drop_table("artist_agent_guidances")
