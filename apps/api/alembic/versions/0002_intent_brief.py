"""intent briefs

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-14

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intent_briefs",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_by_actor_kind", sa.String(10), nullable=False),
        sa.Column("created_by_actor_id", sa.String(200), nullable=False),
        sa.Column("created_by_human_role", sa.String(20), nullable=True),
        sa.Column("source_external_id", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("intent_briefs")
