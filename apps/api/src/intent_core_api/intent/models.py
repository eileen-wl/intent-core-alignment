"""IntentBrief, CoreAnchor, CoreAnchorRevision, ExecutionAnchor,
ExecutionAnchorRevision (WP-A slices A1/A2); Constraint/VariationZone/
DriftRisk/AnchorReference/OpenQuestion (Step 1A).

See docs/DOMAIN_MODEL.md §5-6.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


class Constraint(Base):
    """Semantic child of exactly one ``CoreAnchorRevision`` (Step 1A) --
    a boundary the revision's content must respect. Provenance is
    inherited from the parent revision (see intent/README.md); no actor/
    source columns are duplicated onto this row.
    """

    __tablename__ = "constraints"
    __table_args__ = (Index("ix_constraints_core_anchor_revision_id", "core_anchor_revision_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class VariationZone(Base):
    """Semantic child of exactly one ``CoreAnchorRevision`` (Step 1A) --
    where interpretation is deliberately allowed to vary. Same provenance
    rule as ``Constraint``.
    """

    __tablename__ = "variation_zones"
    __table_args__ = (
        Index("ix_variation_zones_core_anchor_revision_id", "core_anchor_revision_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column()
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class DriftRisk(Base):
    """Semantic child of exactly one ``CoreAnchorRevision`` (Step 1A) --
    a named risk of drifting away from this anchor. Same provenance rule
    as ``Constraint``.
    """

    __tablename__ = "drift_risks"
    __table_args__ = (Index("ix_drift_risks_core_anchor_revision_id", "core_anchor_revision_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column()
    description: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AnchorReference(Base):
    """Semantic child of exactly one ``CoreAnchorRevision`` (Step 1A) --
    a supporting reference (e.g. a link or note pointing at prior art).
    Named ``AnchorReference`` rather than the generic ``Reference`` to
    avoid ambiguity with unrelated uses of that word elsewhere in the
    codebase. Same provenance rule as ``Constraint``.
    """

    __tablename__ = "anchor_references"
    __table_args__ = (
        Index("ix_anchor_references_core_anchor_revision_id", "core_anchor_revision_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column()
    label: Mapped[str] = mapped_column(String(500))
    uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class OpenQuestion(Base):
    """Semantic child of exactly one ``CoreAnchorRevision`` (Step 1A) --
    an unresolved question this revision leaves open. Same provenance
    rule as ``Constraint``.
    """

    __tablename__ = "open_questions"
    __table_args__ = (
        Index("ix_open_questions_core_anchor_revision_id", "core_anchor_revision_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column()
    question: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class IntentDecomposition(Base):
    """One immutable Core Agent ``intent_decomposition`` capability run
    (Step 1B) -- structures an ``IntentBrief`` into the seven Design
    Concept dimensions plus candidate Anchor content, for Human VFX
    Supervisor review *before* Core Anchor drafting. No PATCH/DELETE path
    exists anywhere in the API surface. Multiple decompositions may exist
    for the same Shot/IntentBrief; there is no active/latest pointer --
    the caller always names an exact decomposition id.

    ``dimensions`` is a JSON object with exactly the seven keys
    (``emotional_tone``, ``visual_focus``, ``rhythm_and_intensity``,
    ``character_relationships``, ``narrative_priority``,
    ``technical_execution_requirements``, ``visual_detail_constraints``),
    each a ``{"summary": ..., "rationale": ...}`` object -- validated at
    the contract layer (``intent_core_contracts.api.intent_decomposition``),
    not by a database constraint. The four candidate/uncertainty columns
    are plain JSON lists of strings.
    """

    __tablename__ = "intent_decompositions"
    __table_args__ = (
        Index("ix_intent_decompositions_shot_id", "shot_id"),
        Index("ix_intent_decompositions_intent_brief_id", "intent_brief_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"), nullable=False)
    intent_brief_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("intent_briefs.id"), nullable=False
    )
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("context_snapshots.id"), nullable=False
    )
    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_runs.id"), nullable=False, unique=True
    )
    core_intent_summary: Mapped[str] = mapped_column(Text)
    anchor_relevant_content: Mapped[str] = mapped_column(Text)
    dimensions: Mapped[dict[str, Any]] = mapped_column(JSON)
    candidate_constraints: Mapped[list[str]] = mapped_column(JSON, default=list)
    candidate_variation_zones: Mapped[list[str]] = mapped_column(JSON, default=list)
    contextual_information: Mapped[list[str]] = mapped_column(JSON, default=list)
    uncertainties: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class ContextReconstruction(Base):
    """One immutable Core Agent ``context_reconstruction`` capability run
    (Step 1C) -- a model-generated interpretation of the exact local
    production facts recorded in one ``ContextSnapshot``, answering "why
    are we doing it this way?" for downstream humans and future Role
    Agents. No PATCH/DELETE path exists anywhere in the API surface.
    Multiple reconstructions may exist for the same Shot; there is no
    active/latest/selected pointer -- the caller always names an exact
    reconstruction id.

    ``reconstructed_context`` is a JSON object matching
    ``intent_core_contracts.api.context_reconstruction.ContextReconstructionOutput``
    exactly -- validated at the contract layer, not by a database
    constraint (same convention as ``IntentDecomposition.dimensions``).
    """

    __tablename__ = "context_reconstructions"
    __table_args__ = (Index("ix_context_reconstructions_shot_id", "shot_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"), nullable=False)
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("context_snapshots.id"), nullable=False
    )
    agent_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("agent_runs.id"), nullable=False, unique=True
    )
    reconstructed_context: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


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

    # Step 1B: set only when this draft was created via the explicit
    # "apply decomposition" action (core_agent_service
    # .create_core_anchor_draft_from_decomposition); null for every
    # directly-generated or human-authored draft, and for every revision
    # that predates Step 1B.
    source_intent_decomposition_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("intent_decompositions.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)

    # Step 1A semantic children: ordered, revision-owned, draft-only-
    # editable collections. `lazy="selectin"` is required, not cosmetic --
    # this app uses AsyncSession throughout, and a bare `lazy="select"`
    # (the default) would raise MissingGreenlet the first time response
    # serialization touches one of these attributes outside an awaited
    # call. `cascade="all, delete-orphan"` matches the existing
    # Project.shots/Shot.tasks convention even though nothing in this
    # codebase deletes a CoreAnchorRevision today.
    constraints: Mapped[list[Constraint]] = relationship(
        order_by="Constraint.order_index", cascade="all, delete-orphan", lazy="selectin"
    )
    variation_zones: Mapped[list[VariationZone]] = relationship(
        order_by="VariationZone.order_index", cascade="all, delete-orphan", lazy="selectin"
    )
    drift_risks: Mapped[list[DriftRisk]] = relationship(
        order_by="DriftRisk.order_index", cascade="all, delete-orphan", lazy="selectin"
    )
    # Attribute named `references` (not `anchor_references`) so it lines
    # up 1:1 with the `references` field name used on the
    # CoreAnchorRevisionDraftCreate/Update/Read contracts -- the model
    # class is still `AnchorReference`, per the Step 1A requirement to
    # avoid the generic class name `Reference`.
    references: Mapped[list[AnchorReference]] = relationship(
        order_by="AnchorReference.order_index", cascade="all, delete-orphan", lazy="selectin"
    )
    open_questions: Mapped[list[OpenQuestion]] = relationship(
        order_by="OpenQuestion.order_index", cascade="all, delete-orphan", lazy="selectin"
    )


class HumanGate(Base):
    """Step 1D: a first-class, minimal persistent record of the human
    review requirement opened by a ``CoreAnchorRevision`` draft, and how
    it was resolved. Exactly one ``HumanGate`` per revision
    (``core_anchor_revision_id`` unique) -- created in the same
    transaction as the draft (``core_anchor_service.create_draft_revision``)
    and resolved only as a side effect of the existing confirm/reject
    flow (``core_anchor_service.confirm_revision`` /
    ``.reject_revision``, via ``intent.human_gate_service``). No
    PATCH/DELETE path exists anywhere in the API surface -- a resolved
    gate is immutable.

    This is not an Agent and does not itself decide anything: ``Decision``
    remains the authoritative human decision record, referenced here via
    ``decision_id`` once resolution completes. Historical revisions
    created before this migration have no row here -- see
    ``intent.human_gate_service`` for the legacy-compatibility path.
    """

    __tablename__ = "human_gates"
    __table_args__ = (Index("ix_human_gates_shot_id", "shot_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"), nullable=False)
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id"), nullable=False, unique=True
    )
    # "core_anchor_confirmation" today -- a plain bounded string, not a
    # generic polymorphic target_type/target_id framework (Step 1D scope
    # is Core Anchor review only; see module docstring).
    gate_type: Mapped[str] = mapped_column(String(50))
    required_role: Mapped[str] = mapped_column(String(20))
    # "pending" | "confirmed" | "rejected" -- validated at the contract/
    # service layer (same convention as CoreAnchorRevision.status), not
    # by a database CHECK constraint.
    status: Mapped[str] = mapped_column(String(20), default="pending")
    opened_at: Mapped[datetime] = mapped_column(default=_utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
    resolved_by_actor_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    resolved_by_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolved_by_actor_type: Mapped[str | None] = mapped_column(String(10), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Nullable + unique: null while pending, populated with the
    # authoritative Decision's id exactly once, at resolution.
    decision_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("decisions.id"), nullable=True, unique=True
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
