"""external entity links

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-19

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_entity_links",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("external_id", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "source", "external_id", name="uq_external_entity_links_source_external_id"
        ),
        sa.UniqueConstraint(
            "entity_type", "entity_id", "source", name="uq_external_entity_links_entity_source"
        ),
    )


def downgrade() -> None:
    op.drop_table("external_entity_links")
