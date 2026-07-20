"""IntentBrief, CoreAnchor, CoreAnchorRevision, ExecutionAnchor,
ExecutionAnchorRevision (WP-A slices A1/A2).

See docs/DOMAIN_MODEL.md §5-6. Constraint/VariationZone/DriftRisk/
Reference/OpenQuestion belong to slice A4 and are not defined here.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class IntentBrief(Base):
    """Original creative/production direction text. Immutable, append-only
    -- no update endpoint. A1 implements manual creation only (VFX
    Supervisor); the attribution columns are generalized so a future
    ftrack-ingestion path never needs a fabricated human role.
    """

    __tablename__ = "intent_briefs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    raw_text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class CoreAnchor(Base):
    """Primary Anchor identity -- one per Shot. ``active_revision_id`` is a
    stored pointer, updated only inside the same transaction that confirms
    a revision (see intent.core_anchor_service).
    """

    __tablename__ = "core_anchors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"), unique=True)
    active_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class CoreAnchorRevision(Base):
    """One draft/confirmed/superseded/rejected revision of a CoreAnchor.

    ``UNIQUE(core_anchor_id, revision_number)`` makes concurrent
    revision-number allocation safe (a losing concurrent insert fails with
    an IntegrityError the service maps to 409). The partial unique index
    below is the database-level invariant that at most one revision per
    CoreAnchor can ever have status='confirmed' -- this is the primary
    protection against two different drafts being confirmed concurrently;
    re-fetching state in the service (core_anchor_service.confirm_revision)
    reduces the chance of hitting it, but this index is what makes the
    invariant hold even if that re-check is imperfect (e.g. no row-level
    locking available, as on SQLite).
    """

    __tablename__ = "core_anchor_revisions"
    __table_args__ = (
        UniqueConstraint(
            "core_anchor_id", "revision_number", name="uq_core_anchor_revisions_anchor_number"
        ),
        Index(
            "uq_core_anchor_revisions_one_confirmed_per_anchor",
            "core_anchor_id",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
            sqlite_where=text("status = 'confirmed'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("core_anchors.id"))
    revision_number: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="draft")

    shot_objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotional_tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    visual_focus: Mapped[str | None] = mapped_column(Text, nullable=True)
    rhythm_intensity: Mapped[str | None] = mapped_column(Text, nullable=True)
    character_relationship: Mapped[str | None] = mapped_column(Text, nullable=True)
    narrative_priority: Mapped[str | None] = mapped_column(Text, nullable=True)
    core_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_by_agent_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # Points at agents.models.AgentRun.id when created_by_actor_kind ==
    # "agent" (WP-B1.5 populates this with a real AgentRun.id; B1 only
    # ever wrote an opaque uuid4() here, since agent_runs didn't exist
    # yet). Deliberately not a hard FK: this column predates agent_runs,
    # so an environment with pre-WP-B1.5 agent-authored revisions could
    # already hold values that don't resolve to any real row -- same
    # loose-reference pattern already used for workflow.models.Decision
    # .entity_id and integrations.models.ExternalEntityLink.entity_id.
    created_by_agent_run_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    # Points at agents.models.ContextSnapshot.id when this revision was
    # agent-generated (WP-B1.5); null for human-authored drafts.
    context_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("context_snapshots.id"), nullable=True
    )

    # Confirmation/rejection is exclusively human by rule (service-enforced) --
    # no kind/agent-type columns are stored here, only the human identity.
    confirmed_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confirmed_by_actor_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    supersedes_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class ExecutionAnchor(Base):
    """Secondary Execution Anchor identity -- one per Task. Same shape as
    ``CoreAnchor``: ``active_revision_id`` is a stored pointer, updated
    only inside the transaction that confirms a revision. ``is_stale`` is
    stored, never manually toggled -- it is set only by the CoreAnchor
    confirm stale cascade and cleared only by confirming a new
    ExecutionAnchorRevision (see intent.core_anchor_service /
    intent.execution_anchor_service).
    """

    __tablename__ = "execution_anchors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id"), unique=True)
    active_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("execution_anchor_revisions.id"), nullable=True
    )
    is_stale: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class ExecutionAnchorRevision(Base):
    """One draft/confirmed/superseded/rejected revision of an
    ExecutionAnchor. ``core_anchor_revision_id`` records the exact
    CoreAnchorRevision this translates (never null, never a draft Core
    revision -- enforced in intent.execution_anchor_service).

    Same ``UNIQUE(execution_anchor_id, revision_number)`` +
    partial-unique-confirmed-index pattern as ``CoreAnchorRevision``.
    """

    __tablename__ = "execution_anchor_revisions"
    __table_args__ = (
        UniqueConstraint(
            "execution_anchor_id",
            "revision_number",
            name="uq_execution_anchor_revisions_anchor_number",
        ),
        Index(
            "uq_execution_anchor_revisions_one_confirmed_per_anchor",
            "execution_anchor_id",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
            sqlite_where=text("status = 'confirmed'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    execution_anchor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("execution_anchors.id"))
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id")
    )
    revision_number: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="draft")

    technical_boundaries: Mapped[str | None] = mapped_column(Text, nullable=True)
    parameter_ranges: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    production_ready_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    downstream_dependencies: Mapped[str | None] = mapped_column(Text, nullable=True)
    publish_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    allowed_refinements: Mapped[str | None] = mapped_column(Text, nullable=True)
    escalation_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_by_agent_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_by_agent_run_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)

    # Confirmation/rejection is exclusively human by rule (service-enforced) --
    # no kind/agent-type columns are stored here, only the human identity.
    confirmed_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confirmed_by_actor_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    supersedes_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("execution_anchor_revisions.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)
