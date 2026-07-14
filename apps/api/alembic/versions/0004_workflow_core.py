"""decisions and workflow transitions (A1 minimal)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-14

`human_gates` does not exist yet (deferred to slice A3), so
`decisions.related_gate_id` is intentionally not part of this table --
it will be added as a real foreign key once `human_gates` exists.

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "decisions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("decision_type", sa.String(50), nullable=False),
        sa.Column("owning_human_role", sa.String(20), nullable=False),
        sa.Column("actor_kind", sa.String(10), nullable=False),
        sa.Column("actor_id", sa.String(200), nullable=False),
        sa.Column("actor_human_role", sa.String(20), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("write_back_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "supersedes_decision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("decisions.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "workflow_transitions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("from_state", sa.String(20), nullable=False),
        sa.Column("to_state", sa.String(20), nullable=False),
        sa.Column("actor_kind", sa.String(10), nullable=False),
        sa.Column("actor_id", sa.String(200), nullable=False),
        sa.Column("actor_human_role", sa.String(20), nullable=True),
        sa.Column("actor_agent_type", sa.String(40), nullable=True),
        sa.Column("actor_agent_run_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column(
            "decision_id", sa.Uuid(as_uuid=True), sa.ForeignKey("decisions.id"), nullable=True
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("workflow_transitions")
    op.drop_table("decisions")
