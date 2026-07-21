"""versions and review notes (Step 4a)

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-22

Adds `versions` (belongs to a Shot) and `review_notes` (belongs to a
Version) -- manual-input only for this slice, no ftrack sync. Both
tables are brand new, so every FK here is hard-enforced from the start
(no retrofit-onto-existing-column situation like 0011's
`created_by_agent_run_id`).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "versions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_by_actor_kind", sa.String(10), nullable=False),
        sa.Column("created_by_actor_id", sa.String(200), nullable=False),
        sa.Column("created_by_human_role", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "review_notes",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "version_id", sa.Uuid(as_uuid=True), sa.ForeignKey("versions.id"), nullable=False
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("created_by_actor_kind", sa.String(10), nullable=False),
        sa.Column("created_by_actor_id", sa.String(200), nullable=False),
        sa.Column("created_by_human_role", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("review_notes")
    op.drop_table("versions")
