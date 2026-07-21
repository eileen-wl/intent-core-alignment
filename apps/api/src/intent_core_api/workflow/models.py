"""Decision, WorkflowTransition (A1 minimal slice).

See docs/ARCHITECTURE.md §4, §7 and docs/DOMAIN_MODEL.md §9. HumanGate is
not implemented in A1 (deferred to slice A3); ``Decision.related_gate_id``
will be added as a real foreign key once ``human_gates`` exists (see the
approved WP-A implementation plan, §9/§10).

``entity_type``/``entity_id`` are a deliberately loose (unconstrained)
reference: the set of things a Decision or WorkflowTransition can be about
is open-ended and spans modules (a CoreAnchorRevision today, a Version or
ShotAssembly later) -- an audit/lineage write must never fail because of an
FK mismatch to a not-yet-existing target kind.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Decision(Base):
    """A formal, authoritative human choice. Never created directly by an
    endpoint -- only as a side effect of confirm/reject (A1) or gate
    resolution/supersession (A3). Immutable once created; only ever
    superseded by a new Decision, never edited.
    """

    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    decision_type: Mapped[str] = mapped_column(String(50))
    # Which human role's authority this Decision falls under (A3's
    # domain-restricted supersession checks this, not "VFX or CG generically").
    owning_human_role: Mapped[str] = mapped_column(String(20))
    actor_kind: Mapped[str] = mapped_column(String(10))
    actor_id: Mapped[str] = mapped_column(String(200))
    # Decisions are exclusively human by rule (decision_service asserts this);
    # no actor_agent_type/actor_agent_run_id columns are needed here.
    actor_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    write_back_requested: Mapped[bool] = mapped_column(default=False)
    supersedes_decision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("decisions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class WorkflowTransition(Base):
    """A recorded state change. Only ever created by
    ``transition_service.record_transition`` -- never exposed as a write
    endpoint in WP-A.
    """

    __tablename__ = "workflow_transitions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    from_state: Mapped[str] = mapped_column(String(20))
    to_state: Mapped[str] = mapped_column(String(20))
    actor_kind: Mapped[str] = mapped_column(String(10))
    # Always populated -- never null, even for system-cascaded transitions
    # (actor_id="system" in that case). See workflow.actors.ActorContext.system().
    actor_id: Mapped[str] = mapped_column(String(200))
    actor_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actor_agent_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    actor_agent_run_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("decisions.id"), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(default=_utcnow)
