"""agent runtime metadata (Step 2)

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-27

Adds two nullable traceability columns to the existing `agent_runs`
table, introduced alongside the shared Agent Runtime (`agents.runtime`):

- `model_name`: the real model identifier used for this run, when the
  run actually executed a model-backed provider (currently: DeepSeek).
  Null for a deterministic run or a purely deterministic transform
  (e.g. the decomposition-to-Core-Anchor mapping).
- `prompt_version`: the registered prompt registry version label (e.g.
  `"intent_decomposition.v1"`) actually used for this run. Null under
  the same conditions as `model_name`.

Existing `agent_runs` rows (all created before this migration, all
either deterministic or the decomposition-to-Core-Anchor deterministic
transform) remain valid with both columns null -- no backfill is
performed or required.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite cannot ALTER a table directly -- `batch_alter_table` is this
    # repository's established pattern for adding columns to an existing
    # table (see 0011/0015's own additions to agent_runs/core_anchor_revisions).
    with op.batch_alter_table("agent_runs") as batch_op:
        batch_op.add_column(sa.Column("model_name", sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column("prompt_version", sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("agent_runs") as batch_op:
        batch_op.drop_column("prompt_version")
        batch_op.drop_column("model_name")
