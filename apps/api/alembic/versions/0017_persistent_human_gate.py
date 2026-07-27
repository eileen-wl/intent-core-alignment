"""persistent human gate (Step 1D)

Revision ID: 0017
Revises: 0016
Create Date: 2026-07-27

Adds `human_gates` -- a first-class, minimal persistent record of the
human review requirement opened by a CoreAnchorRevision draft, and how it
was resolved. Exactly one HumanGate per CoreAnchorRevision
(`core_anchor_revision_id` unique). No PATCH/DELETE path exists anywhere
in the API surface; a pending gate is resolved only as a side effect of
the existing Core Anchor confirm/reject flow (see
intent.human_gate_service / intent.core_anchor_service).

`decision_id` is nullable + unique: null while pending, populated with
the authoritative Decision's id exactly once, at resolution.

Historical CoreAnchorRevision rows created before this migration have no
HumanGate row -- this migration does not backfill them (see the module
docstring on intent.human_gate_service for the legacy-compatibility path
that creates-and-immediately-resolves a gate the first time such a
revision is confirmed or rejected).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "human_gates",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column(
            "core_anchor_revision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("core_anchor_revisions.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("gate_type", sa.String(length=50), nullable=False),
        sa.Column("required_role", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by_actor_id", sa.String(length=200), nullable=True),
        sa.Column("resolved_by_role", sa.String(length=20), nullable=True),
        sa.Column("resolved_by_actor_type", sa.String(length=10), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column(
            "decision_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("decisions.id"),
            nullable=True,
            unique=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_human_gates_shot_id", "human_gates", ["shot_id"])


def downgrade() -> None:
    op.drop_index("ix_human_gates_shot_id", table_name="human_gates")
    op.drop_table("human_gates")
