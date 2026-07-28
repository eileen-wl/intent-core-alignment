"""cross role assessment, re-anchor proposal, intent signal (Step 6)

Revision ID: 0022
Revises: 0021
Create Date: 2026-07-28

Three bounded additions, all immutable, no PATCH/DELETE, no active/
latest pointer, no approval or write-back state:

1. `cross_role_assessments` -- one Core Agent `cross_role_assessment`
   synthesis of the confirmed Core Anchor, confirmed Execution Anchor,
   newest VFX Supervisor Agent review, newest CG Supervisor Agent
   review, and newest Artist Agent guidance for one Version/Task
   context. `agent_run_id` unique.

2. `re_anchor_proposals` -- zero-or-one advisory proposal per
   CrossRoleAssessment (`cross_role_assessment_id` unique). No approval
   status, no HumanGate/Decision linkage, no apply/materialise path.

3. `intent_signals` -- exactly one deterministic attention-level
   projection per CrossRoleAssessment (`cross_role_assessment_id`
   unique), computed from the assessment, not itself an Agent run.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cross_role_assessments",
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
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column(
            "execution_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("execution_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column(
            "vfx_supervisor_review_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("vfx_supervisor_reviews.id"),
            nullable=False,
        ),
        sa.Column(
            "cg_supervisor_review_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("cg_supervisor_reviews.id"),
            nullable=False,
        ),
        sa.Column(
            "artist_agent_guidance_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("artist_agent_guidances.id"),
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
        sa.Column("assessment_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cross_role_assessments_shot_id", "cross_role_assessments", ["shot_id"])
    op.create_index("ix_cross_role_assessments_task_id", "cross_role_assessments", ["task_id"])
    op.create_index(
        "ix_cross_role_assessments_version_id", "cross_role_assessments", ["version_id"]
    )
    op.create_index(
        "ix_cross_role_assessments_core_anchor_revision_id",
        "cross_role_assessments",
        ["core_anchor_revision_id"],
    )
    op.create_index(
        "ix_cross_role_assessments_execution_anchor_revision_id",
        "cross_role_assessments",
        ["execution_anchor_revision_id"],
    )

    op.create_table(
        "re_anchor_proposals",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "cross_role_assessment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("cross_role_assessments.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "current_core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("proposal_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_re_anchor_proposals_shot_id", "re_anchor_proposals", ["shot_id"])

    op.create_table(
        "intent_signals",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "cross_role_assessment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("cross_role_assessments.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("task_id", sa.Uuid(as_uuid=True), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column(
            "version_id", sa.Uuid(as_uuid=True), sa.ForeignKey("versions.id"), nullable=False
        ),
        sa.Column("attention_level", sa.String(length=10), nullable=False),
        sa.Column("signal_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_intent_signals_shot_id", "intent_signals", ["shot_id"])


def downgrade() -> None:
    op.drop_index("ix_intent_signals_shot_id", table_name="intent_signals")
    op.drop_table("intent_signals")

    op.drop_index("ix_re_anchor_proposals_shot_id", table_name="re_anchor_proposals")
    op.drop_table("re_anchor_proposals")

    op.drop_index(
        "ix_cross_role_assessments_execution_anchor_revision_id",
        table_name="cross_role_assessments",
    )
    op.drop_index(
        "ix_cross_role_assessments_core_anchor_revision_id",
        table_name="cross_role_assessments",
    )
    op.drop_index("ix_cross_role_assessments_version_id", table_name="cross_role_assessments")
    op.drop_index("ix_cross_role_assessments_task_id", table_name="cross_role_assessments")
    op.drop_index("ix_cross_role_assessments_shot_id", table_name="cross_role_assessments")
    op.drop_table("cross_role_assessments")
