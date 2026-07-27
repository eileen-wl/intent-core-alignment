"""cg supervisor review and execution anchor human gate (Step 4)

Revision ID: 0020
Revises: 0019
Create Date: 2026-07-27

Two bounded additions:

1. Adds `cg_supervisor_reviews` -- one immutable advisory review of a
   single `ExecutionAnchorRevision`, produced by the new CG Supervisor
   Agent's `execution_review` capability (`agent_type=cg_supervisor_agent`).
   Same shape as `vfx_supervisor_reviews` (migration
   `0019_vfx_supervisor_review.py`): no PATCH/DELETE, no active/latest
   pointer, `agent_run_id` unique.

2. Extends the existing `human_gates` table (migration
   `0017_persistent_human_gate.py`) to also support an
   `ExecutionAnchorRevision` gate, without introducing a generic
   `target_type`/`target_id` polymorphism:
   - `core_anchor_revision_id` becomes nullable (a NULL there means this
     gate targets an Execution Anchor revision instead);
   - a new nullable, unique, indexed `execution_anchor_revision_id`
     column is added;
   - a CHECK constraint enforces that exactly one of the two target
     columns is populated on every row.

   Existing Core Anchor gate rows are unaffected -- each already has a
   real `core_anchor_revision_id` and a NULL `execution_anchor_revision_id`,
   which satisfies the new constraint without any data migration.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None

_CHECK_CONSTRAINT_NAME = "ck_human_gates_exactly_one_target"


def upgrade() -> None:
    op.create_table(
        "cg_supervisor_reviews",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("task_id", sa.Uuid(as_uuid=True), sa.ForeignKey("tasks.id"), nullable=False),
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
        sa.Column("review_output", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_cg_supervisor_reviews_shot_id", "cg_supervisor_reviews", ["shot_id"])
    op.create_index("ix_cg_supervisor_reviews_task_id", "cg_supervisor_reviews", ["task_id"])
    op.create_index(
        "ix_cg_supervisor_reviews_execution_anchor_revision_id",
        "cg_supervisor_reviews",
        ["execution_anchor_revision_id"],
    )

    # SQLite cannot ALTER a constraint directly -- `batch_alter_table` is
    # this repository's established pattern for changes to an existing
    # table (see 0011/0015/0017's own additions).
    with op.batch_alter_table("human_gates") as batch_op:
        batch_op.alter_column(
            "core_anchor_revision_id", existing_type=sa.Uuid(as_uuid=True), nullable=True
        )
        batch_op.add_column(
            sa.Column("execution_anchor_revision_id", sa.Uuid(as_uuid=True), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_human_gates_execution_anchor_revision_id",
            "execution_anchor_revisions",
            ["execution_anchor_revision_id"],
            ["id"],
        )
        batch_op.create_unique_constraint(
            "uq_human_gates_execution_anchor_revision_id", ["execution_anchor_revision_id"]
        )
        batch_op.create_check_constraint(
            _CHECK_CONSTRAINT_NAME,
            "(core_anchor_revision_id IS NOT NULL) != (execution_anchor_revision_id IS NOT NULL)",
        )
    op.create_index(
        "ix_human_gates_execution_anchor_revision_id",
        "human_gates",
        ["execution_anchor_revision_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_human_gates_execution_anchor_revision_id", table_name="human_gates")
    with op.batch_alter_table("human_gates") as batch_op:
        batch_op.drop_constraint(_CHECK_CONSTRAINT_NAME, type_="check")
        batch_op.drop_constraint("uq_human_gates_execution_anchor_revision_id", type_="unique")
        batch_op.drop_constraint("fk_human_gates_execution_anchor_revision_id", type_="foreignkey")
        batch_op.drop_column("execution_anchor_revision_id")
        batch_op.alter_column(
            "core_anchor_revision_id", existing_type=sa.Uuid(as_uuid=True), nullable=False
        )

    op.drop_index(
        "ix_cg_supervisor_reviews_execution_anchor_revision_id",
        table_name="cg_supervisor_reviews",
    )
    op.drop_index("ix_cg_supervisor_reviews_task_id", table_name="cg_supervisor_reviews")
    op.drop_index("ix_cg_supervisor_reviews_shot_id", table_name="cg_supervisor_reviews")
    op.drop_table("cg_supervisor_reviews")
