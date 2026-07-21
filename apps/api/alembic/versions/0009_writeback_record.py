"""writeback records

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-20

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "writeback_records",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("target_external_id", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("external_note_id", sa.String(200), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("requested_by_actor_kind", sa.String(10), nullable=False),
        sa.Column("requested_by_actor_id", sa.String(200), nullable=False),
        sa.Column("requested_by_human_role", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("writeback_records")
