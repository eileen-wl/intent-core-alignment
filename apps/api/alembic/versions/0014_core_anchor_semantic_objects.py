"""core anchor semantic objects (Step 1A)

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-21

Adds five child tables of core_anchor_revisions -- constraints,
variation_zones, drift_risks, anchor_references, open_questions -- each
row belonging to exactly one CoreAnchorRevision. All five are brand-new
tables referencing an already-existing table, so every FK here is
hard-enforced from the start (same reasoning as 0012/0013). No backfill,
no changes to any existing table.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "constraints",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_constraints_core_anchor_revision_id", "constraints", ["core_anchor_revision_id"]
    )

    op.create_table(
        "variation_zones",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_variation_zones_core_anchor_revision_id",
        "variation_zones",
        ["core_anchor_revision_id"],
    )

    op.create_table(
        "drift_risks",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_drift_risks_core_anchor_revision_id", "drift_risks", ["core_anchor_revision_id"]
    )

    op.create_table(
        "anchor_references",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(500), nullable=False),
        sa.Column("uri", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_anchor_references_core_anchor_revision_id",
        "anchor_references",
        ["core_anchor_revision_id"],
    )

    op.create_table(
        "open_questions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_open_questions_core_anchor_revision_id", "open_questions", ["core_anchor_revision_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_open_questions_core_anchor_revision_id", table_name="open_questions")
    op.drop_table("open_questions")

    op.drop_index("ix_anchor_references_core_anchor_revision_id", table_name="anchor_references")
    op.drop_table("anchor_references")

    op.drop_index("ix_drift_risks_core_anchor_revision_id", table_name="drift_risks")
    op.drop_table("drift_risks")

    op.drop_index("ix_variation_zones_core_anchor_revision_id", table_name="variation_zones")
    op.drop_table("variation_zones")

    op.drop_index("ix_constraints_core_anchor_revision_id", table_name="constraints")
    op.drop_table("constraints")
