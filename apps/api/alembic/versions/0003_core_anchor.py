"""core anchors and revisions

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-14

Migration order (see the approved WP-A implementation plan §9-10):
create `core_anchors` WITHOUT `active_revision_id` first, then
`core_anchor_revisions` (which references `core_anchors.id`), then add
`active_revision_id` + its FK to `core_anchors` afterwards via
`batch_alter_table` -- this breaks the circular-FK ordering problem and
uses batch mode because SQLite cannot `ALTER TABLE ADD CONSTRAINT`
directly (batch mode recreates the table transparently on SQLite while
emitting a plain `ALTER TABLE` on Postgres).

The partial unique index below is the database-level invariant that at
most one revision per CoreAnchor can have status='confirmed' at a time --
it is created as a plain `CREATE INDEX` (no batch mode needed, since the
table was just created in this same migration, not altered).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "core_anchors",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False, unique=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "core_anchor_revisions",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "core_anchor_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchors.id"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("shot_objective", sa.Text(), nullable=True),
        sa.Column("emotional_tone", sa.Text(), nullable=True),
        sa.Column("visual_focus", sa.Text(), nullable=True),
        sa.Column("rhythm_intensity", sa.Text(), nullable=True),
        sa.Column("character_relationship", sa.Text(), nullable=True),
        sa.Column("narrative_priority", sa.Text(), nullable=True),
        sa.Column("core_summary", sa.Text(), nullable=True),
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
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "core_anchor_id", "revision_number", name="uq_core_anchor_revisions_anchor_number"
        ),
    )

    op.create_index(
        "uq_core_anchor_revisions_one_confirmed_per_anchor",
        "core_anchor_revisions",
        ["core_anchor_id"],
        unique=True,
        postgresql_where=sa.text("status = 'confirmed'"),
        sqlite_where=sa.text("status = 'confirmed'"),
    )

    with op.batch_alter_table("core_anchors") as batch_op:
        batch_op.add_column(sa.Column("active_revision_id", sa.Uuid(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_core_anchors_active_revision_id",
            "core_anchor_revisions",
            ["active_revision_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("core_anchors") as batch_op:
        batch_op.drop_constraint("fk_core_anchors_active_revision_id", type_="foreignkey")
        batch_op.drop_column("active_revision_id")
    op.drop_index(
        "uq_core_anchor_revisions_one_confirmed_per_anchor", table_name="core_anchor_revisions"
    )
    op.drop_table("core_anchor_revisions")
    op.drop_table("core_anchors")
