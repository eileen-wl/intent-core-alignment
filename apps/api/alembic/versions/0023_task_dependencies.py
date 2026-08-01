"""task dependencies / conflicts / escalations (Step 7C-4)

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-01

One new table, `task_dependencies`, the first real persistence of the
Cross-department Conflict / Escalation concepts already named in
docs/GLOSSARY.md (confirmed absent from the domain model before this
migration -- see intent_core_api.cross_department's own reserved-but-
unimplemented module docstring). `kind` discriminates dependency /
conflict / escalation rows; `status` tracks open / acknowledged /
resolved. No PATCH of description/kind -- immutable creation, mutable
only via status/resolved_* fields (acknowledge/resolve).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id", sa.Uuid(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False
        ),
        sa.Column("shot_id", sa.Uuid(as_uuid=True), sa.ForeignKey("shots.id"), nullable=False),
        sa.Column("task_id", sa.Uuid(as_uuid=True), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column(
            "related_version_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("versions.id"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=10), nullable=True),
        sa.Column("escalated_to_role", sa.String(length=20), nullable=True),
        sa.Column("created_by_actor_kind", sa.String(length=10), nullable=False),
        sa.Column("created_by_actor_id", sa.String(length=200), nullable=False),
        sa.Column("created_by_human_role", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_by_actor_id", sa.String(length=200), nullable=True),
        sa.Column("resolved_by_human_role", sa.String(length=20), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "related_cross_role_assessment_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("cross_role_assessments.id"),
            nullable=True,
        ),
    )
    op.create_index("ix_task_dependencies_task_id", "task_dependencies", ["task_id"])
    op.create_index("ix_task_dependencies_shot_id", "task_dependencies", ["shot_id"])
    op.create_index("ix_task_dependencies_status", "task_dependencies", ["status"])


def downgrade() -> None:
    op.drop_index("ix_task_dependencies_status", table_name="task_dependencies")
    op.drop_index("ix_task_dependencies_shot_id", table_name="task_dependencies")
    op.drop_index("ix_task_dependencies_task_id", table_name="task_dependencies")
    op.drop_table("task_dependencies")
