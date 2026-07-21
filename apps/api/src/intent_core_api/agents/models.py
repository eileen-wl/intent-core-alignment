"""ContextSnapshot, AgentRun (WP-B1.5).

See docs/AGENT_CONTRACTS.md §2 ("Common Agent Run contract") and §4
("Context Reconstruction"). This is a minimal slice of both concepts,
scoped to exactly what ``agents.core_agent_service``'s Core Anchor
drafting flow needs -- not a generic agent-runtime framework. Only one
capability (Core Anchor drafting) produces these rows today.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ContextSnapshot(Base):
    """An immutable record of exactly what local (already-synced) context
    a Core Agent run was given. Never updated after creation -- no
    update path exists anywhere in the API surface for this table.

    ``payload`` is a compact JSON blob (Shot/Project/Task/IntentBrief
    fields plus any known ftrack external ids) rather than a normalized
    set of tables, per WP-B1.5's explicit scope -- this is a point-in-
    time copy for traceability, not a queryable secondary model of the
    domain.
    """

    __tablename__ = "context_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AgentRun(Base):
    """One execution of a Core Agent capability. Created with
    status="running" before the provider is called, then updated exactly
    once to a terminal status ("succeeded" or "failed") -- see
    ``agents.core_agent_service.generate_core_anchor_draft``.
    """

    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("context_snapshots.id"))
    # Mirrors intent_core_contracts.api.intent.AgentType's values, but
    # stored as a plain string here (same pattern as
    # intent.models.CoreAnchorRevision.created_by_agent_type) -- this
    # table has no dependency on that contracts enum.
    agent_type: Mapped[str] = mapped_column(String(40))
    capability: Mapped[str] = mapped_column(String(50))
    provider: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="running")
    result_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
