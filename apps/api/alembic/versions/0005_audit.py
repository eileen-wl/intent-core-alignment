"""audit events

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("actor_kind", sa.String(10), nullable=False),
        sa.Column("actor_id", sa.String(200), nullable=False),
        sa.Column("actor_human_role", sa.String(20), nullable=True),
        sa.Column("actor_agent_type", sa.String(40), nullable=True),
        sa.Column("actor_agent_run_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("source_context", sa.JSON(), nullable=False),
        sa.Column("related_entity_type", sa.String(50), nullable=True),
        sa.Column("related_entity_id", sa.Uuid(as_uuid=True), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
