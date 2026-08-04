"""Associate CG Supervisor reviews with the reviewed Production Version."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("cg_supervisor_reviews") as batch_op:
        batch_op.add_column(sa.Column("version_id", sa.Uuid(as_uuid=True), nullable=True))
        batch_op.create_foreign_key(
            "fk_cg_supervisor_reviews_version_id", "versions", ["version_id"], ["id"]
        )
        batch_op.create_index("ix_cg_supervisor_reviews_version_id", ["version_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("cg_supervisor_reviews") as batch_op:
        batch_op.drop_index("ix_cg_supervisor_reviews_version_id")
        batch_op.drop_constraint("fk_cg_supervisor_reviews_version_id", type_="foreignkey")
        batch_op.drop_column("version_id")
