"""intent decomposition (Step 1B)

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-26

Adds `intent_decompositions` -- one immutable Core Agent output per
generation run, linking a Shot/IntentBrief pair to the ContextSnapshot
and AgentRun that produced it. No PATCH/DELETE path exists anywhere in
the API surface for this table; multiple decompositions may exist for
the same Shot/IntentBrief (no active/latest pointer).

Also adds a nullable `source_intent_decomposition_id` lineage column to
the already-existing `core_anchor_revisions` table, set only when a
draft was created via the new "apply decomposition" action -- every
historical and directly-generated revision keeps this null. This is an
additive column on an existing table, not a rewrite of migration 0014.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intent_decompositions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "intent_brief_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("intent_briefs.id"),
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
        sa.Column("core_intent_summary", sa.Text(), nullable=False),
        sa.Column("anchor_relevant_content", sa.Text(), nullable=False),
        sa.Column("dimensions", sa.JSON(), nullable=False),
        sa.Column("candidate_constraints", sa.JSON(), nullable=False),
        sa.Column("candidate_variation_zones", sa.JSON(), nullable=False),
        sa.Column("contextual_information", sa.JSON(), nullable=False),
        sa.Column("uncertainties", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_intent_decompositions_shot_id", "intent_decompositions", ["shot_id"])
    op.create_index(
        "ix_intent_decompositions_intent_brief_id",
        "intent_decompositions",
        ["intent_brief_id"],
    )

    # SQLite cannot ALTER a constraint directly -- `batch_alter_table` is
    # this repository's established pattern for adding an FK column to an
    # existing table (see 0011's `context_snapshot_id` addition to this
    # same table).
    with op.batch_alter_table("core_anchor_revisions") as batch_op:
        batch_op.add_column(
            sa.Column("source_intent_decomposition_id", sa.Uuid(as_uuid=True), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_core_anchor_revisions_source_intent_decomposition_id",
            "intent_decompositions",
            ["source_intent_decomposition_id"],
            ["id"],
        )
    op.create_index(
        "ix_core_anchor_revisions_source_intent_decomposition_id",
        "core_anchor_revisions",
        ["source_intent_decomposition_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_core_anchor_revisions_source_intent_decomposition_id",
        table_name="core_anchor_revisions",
    )
    with op.batch_alter_table("core_anchor_revisions") as batch_op:
        batch_op.drop_constraint(
            "fk_core_anchor_revisions_source_intent_decomposition_id", type_="foreignkey"
        )
        batch_op.drop_column("source_intent_decomposition_id")

    op.drop_index("ix_intent_decompositions_intent_brief_id", table_name="intent_decompositions")
    op.drop_index("ix_intent_decompositions_shot_id", table_name="intent_decompositions")
    op.drop_table("intent_decompositions")
