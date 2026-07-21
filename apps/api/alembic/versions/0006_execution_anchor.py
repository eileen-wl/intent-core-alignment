"""execution anchors and revisions

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-14

Same structure as ``0003_core_anchor.py``: create ``execution_anchors``
WITHOUT ``active_revision_id`` first, then ``execution_anchor_revisions``
(which references both ``execution_anchors.id`` and
``core_anchor_revisions.id``), then add ``active_revision_id`` + its FK to
``execution_anchors`` afterwards via ``batch_alter_table`` -- this breaks
the circular-FK ordering problem the same way ``0003`` does.

The partial unique index below is the database-level invariant that at
most one revision per ExecutionAnchor can have status='confirmed' at a
time, symmetric with ``0003``'s index for CoreAnchorRevision.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "execution_anchors",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "task_id", sa.Uuid(as_uuid=True), sa.ForeignKey("tasks.id"), nullable=False, unique=True
        ),
        sa.Column("is_stale", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "execution_anchor_revisions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "execution_anchor_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("execution_anchors.id"),
            nullable=False,
        ),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("technical_boundaries", sa.Text(), nullable=True),
        sa.Column("parameter_ranges", sa.Text(), nullable=True),
        sa.Column("delivery_conditions", sa.Text(), nullable=True),
        sa.Column("production_ready_criteria", sa.Text(), nullable=True),
        sa.Column("downstream_dependencies", sa.Text(), nullable=True),
        sa.Column("publish_requirements", sa.Text(), nullable=True),
        sa.Column("allowed_refinements", sa.Text(), nullable=True),
        sa.Column("escalation_conditions", sa.Text(), nullable=True),
        sa.Column("created_by_actor_kind", sa.String(10), nullable=False),
        sa.Column("created_by_actor_id", sa.String(200), nullable=False),
        sa.Column("created_by_human_role", sa.String(20), nullable=True),
        sa.Column("created_by_agent_type", sa.String(40), nullable=True),
        sa.Column("created_by_agent_run_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("confirmed_by_human_role", sa.String(20), nullable=True),
        sa.Column("confirmed_by_actor_id", sa.String(200), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "supersedes_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("execution_anchor_revisions.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "execution_anchor_id",
            "revision_number",
            name="uq_execution_anchor_revisions_anchor_number",
        ),
    )

    op.create_index(
        "uq_execution_anchor_revisions_one_confirmed_per_anchor",
        "execution_anchor_revisions",
        ["execution_anchor_id"],
        unique=True,
        postgresql_where=sa.text("status = 'confirmed'"),
        sqlite_where=sa.text("status = 'confirmed'"),
    )

    with op.batch_alter_table("execution_anchors") as batch_op:
        batch_op.add_column(sa.Column("active_revision_id", sa.Uuid(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_execution_anchors_active_revision_id",
            "execution_anchor_revisions",
            ["active_revision_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("execution_anchors") as batch_op:
        batch_op.drop_constraint("fk_execution_anchors_active_revision_id", type_="foreignkey")
        batch_op.drop_column("active_revision_id")
    op.drop_index(
        "uq_execution_anchor_revisions_one_confirmed_per_anchor",
        table_name="execution_anchor_revisions",
    )
    op.drop_table("execution_anchor_revisions")
    op.drop_table("execution_anchors")
