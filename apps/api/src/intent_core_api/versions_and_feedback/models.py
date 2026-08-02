"""Version, ReviewNote (Step 4a); AlignmentAssessment (Step 4b).

See docs/DOMAIN_MODEL.md §4. Only the smallest slice: a Version belongs
directly to a Shot, and a ReviewNote belongs to a Version.
VersionArtifact/ReviewActionItem/SubmissionRationale/VersionRelation are
out of scope for this slice.

Future ftrack external ids go through integrations.models.ExternalEntityLink,
never a direct external_id column here -- same reasoning ADR-0010 already
applied to Project/Shot/Task, applied a second time.

Step 8C-1 (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §13,
ADR-0014) adds `Version.task_id` (nullable -- a Shot may still have
several Tasks and several manually-created Versions with no join between
them; this only ever gets populated for a ftrack-sourced Version, by
sync logic that is a later slice, not this one) plus
`source_created_at`/`external_author_id`/`external_author_name` on both
`Version` and `ReviewNote`. No `relationship()` object is added alongside
`task_id`: this module has never used SQLAlchemy `relationship()`
objects, not even for the existing `shot_id`, so a bare FK column is the
consistent choice here too.

``AlignmentAssessment`` (Step 4b) is produced by the Core Agent's
``alignment_assessment`` capability (``agents.alignment_assessment_service``,
mirroring where ``agents.core_agent_service`` produces a
``CoreAnchorRevision`` defined in ``intent.models``) but lives here
because it is fundamentally about a Version -- immutable, append-only,
no update or delete path anywhere in the API surface. It carries no
human review/accept/reject state: that arrives in Step 4c as a
supersedable ``Decision``, not as a mutable field on this row.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Version(Base):
    """A recorded iteration of work for a Shot. Immutable, append-only --
    no update endpoint (matches IntentBrief's own convention).
    """

    __tablename__ = "versions"
    __table_args__ = (Index("ix_versions_task_id", "task_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    # Nullable: null for every manually-created Version (unchanged
    # existing behavior); populated only by future ftrack sync logic,
    # resolved via ExternalEntityLink, never by Task-name matching.
    # ondelete="SET NULL", not CASCADE -- a Version is production
    # history and must outlive its originating Task (Step 8C-1).
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200))
    version_number: Mapped[int | None] = mapped_column(nullable=True)
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    # Real external ftrack creation time, distinct from `created_at`
    # (ICAS ingestion time, unchanged meaning). Null for manual rows.
    source_created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # Real external ftrack stable author id -- never username/email/
    # display name (ADR-0014 Decision 2). Grants no ICAS human role.
    external_author_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Display-only author provenance fallback.
    external_author_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AlignmentAssessment(Base):
    """One immutable advisory judgement of how well a Version (its
    description + Review Notes) aligns with the Shot's currently
    confirmed Core Anchor revision. Every FK is hard-enforced: all four
    referenced tables (versions, core_anchor_revisions, context_snapshots,
    agent_runs) already exist, so there is no retrofit-onto-existing-data
    situation like 0011's ``created_by_agent_run_id``.
    """

    __tablename__ = "alignment_assessments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id")
    )
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("context_snapshots.id"))
    agent_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_runs.id"))
    # One of AlignmentState's three locked values; stored as a plain
    # string, same pattern as agents.models.AgentRun.agent_type -- this
    # table has no dependency on the contracts Literal.
    alignment_state: Mapped[str] = mapped_column(String(30))
    envelope: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class VFXSupervisorReview(Base):
    """One immutable, advisory VFX Supervisor Agent review of a single
    Version (Step 3, ``agent_type=vfx_supervisor_agent``,
    ``capability=creative_review``) -- a high-level creative/intent-
    preservation read, never an authoritative Decision, never a
    HumanGate resolution, never a confirm/reject/pass/fail of the
    Version itself (see ``agents.vfx_supervisor_review_service``'s
    module docstring). Lives here, not in ``intent.models``, for the
    same reason ``AlignmentAssessment`` does: it is fundamentally about
    a Version. No update or delete path exists anywhere in the API
    surface; multiple reviews may exist for one Version, with no
    active/latest pointer -- same convention as ``ContextReconstruction``.
    """

    __tablename__ = "vfx_supervisor_reviews"
    __table_args__ = (
        Index("ix_vfx_supervisor_reviews_shot_id", "shot_id"),
        Index("ix_vfx_supervisor_reviews_version_id", "version_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("context_snapshots.id"))
    agent_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_runs.id"), unique=True)
    review_output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class ArtistAgentGuidance(Base):
    """One immutable, advisory Artist Agent iteration guidance for a
    single Version (Step 5, ``agent_type=artist_agent``,
    ``capability=iteration_guidance``) -- Artist-facing translation of
    upstream creative/technical intent and existing feedback, never an
    authoritative Decision, never a HumanGate resolution, never a
    confirm/reject/approve/rank of the Version itself (see
    ``agents.artist_guidance_service``'s module docstring). Lives here,
    not in ``intent.models``, for the same reason ``VFXSupervisorReview``
    does: it is fundamentally about a Version. ``task_id`` and
    ``execution_anchor_revision_id`` record which Task's confirmed
    Execution Anchor this guidance was generated against -- supplied by
    the caller at generation time, since ``Version`` itself has no
    ``task_id`` (see ``Version``'s own module docstring). No update or
    delete path exists anywhere in the API surface; multiple guidance
    records may exist for one Version, with no active/latest pointer --
    same convention as ``VFXSupervisorReview``/``CGSupervisorReview``.
    """

    __tablename__ = "artist_agent_guidances"
    __table_args__ = (
        Index("ix_artist_agent_guidances_shot_id", "shot_id"),
        Index("ix_artist_agent_guidances_task_id", "task_id"),
        Index("ix_artist_agent_guidances_version_id", "version_id"),
        Index(
            "ix_artist_agent_guidances_execution_anchor_revision_id",
            "execution_anchor_revision_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id"))
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    execution_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("execution_anchor_revisions.id")
    )
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("context_snapshots.id"))
    agent_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_runs.id"), unique=True)
    guidance_output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class CrossRoleAssessment(Base):
    """One immutable Core Agent ``cross_role_assessment`` synthesis of
    the complete recorded evidence chain for one Version/Task context
    (Step 6, ``agent_type=core_agent``, ``capability=cross_role_assessment``)
    -- confirmed Core Anchor, confirmed Execution Anchor, the newest VFX
    Supervisor Agent review, the newest CG Supervisor Agent review, and
    the newest Artist Agent guidance. Never an authoritative Decision,
    never a HumanGate resolution, never an automatic Core Anchor edit
    (see ``agents.cross_role_assessment_service``'s module docstring).
    Lives here, not in ``intent.models``, for the same reason
    ``VFXSupervisorReview``/``ArtistAgentGuidance`` do: it is
    fundamentally about a Version. ``task_id`` is supplied by the caller
    at generation time, since ``Version`` itself has no ``task_id`` (see
    ``Version``'s own module docstring). No update or delete path exists
    anywhere in the API surface; multiple assessments may exist for one
    Version/Task context, with no active/latest pointer -- same
    convention as the three Role Agent capabilities.
    """

    __tablename__ = "cross_role_assessments"
    __table_args__ = (
        Index("ix_cross_role_assessments_shot_id", "shot_id"),
        Index("ix_cross_role_assessments_task_id", "task_id"),
        Index("ix_cross_role_assessments_version_id", "version_id"),
        Index("ix_cross_role_assessments_core_anchor_revision_id", "core_anchor_revision_id"),
        Index(
            "ix_cross_role_assessments_execution_anchor_revision_id",
            "execution_anchor_revision_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id"))
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id")
    )
    execution_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("execution_anchor_revisions.id")
    )
    vfx_supervisor_review_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vfx_supervisor_reviews.id")
    )
    cg_supervisor_review_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cg_supervisor_reviews.id")
    )
    artist_agent_guidance_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("artist_agent_guidances.id")
    )
    context_snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("context_snapshots.id"))
    agent_run_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("agent_runs.id"), unique=True)
    assessment_output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class ReAnchorProposal(Base):
    """Zero-or-one immutable, advisory Re-anchor Proposal attached to one
    ``CrossRoleAssessment`` (Step 6) -- bounded evidence for the Human
    VFX Supervisor to consider, never an instruction, never a Decision,
    never a ``CoreAnchorRevision``, never an automatic write. No
    approval state, no HumanGate or Decision linkage, no apply/
    materialise endpoint anywhere in the API surface (see
    ``agents.cross_role_assessment_service``'s
    ``_validate_re_anchor_proposal`` for the evidence-diversity rules
    that gate whether one is ever persisted at all).
    """

    __tablename__ = "re_anchor_proposals"
    __table_args__ = (Index("ix_re_anchor_proposals_shot_id", "shot_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cross_role_assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cross_role_assessments.id"), unique=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    current_core_anchor_revision_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("core_anchor_revisions.id")
    )
    proposal_output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class IntentSignal(Base):
    """Exactly one deterministic, explainable attention-level projection
    derived from one ``CrossRoleAssessment`` (Step 6) -- never an
    alignment verdict, a quality score, a Decision, or an approval
    recommendation. Not an Agent and does not itself create an
    ``AgentRun``: it is computed purely from the already-validated
    ``CrossRoleAssessmentOutput`` (see
    ``agents.cross_role_assessment_service``'s ``derive_intent_signal``).
    """

    __tablename__ = "intent_signals"
    __table_args__ = (Index("ix_intent_signals_shot_id", "shot_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    cross_role_assessment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cross_role_assessments.id"), unique=True
    )
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id"))
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    attention_level: Mapped[str] = mapped_column(String(10))
    signal_output: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class ReviewNote(Base):
    """Original human feedback on a Version. Immutable, append-only --
    AI summaries must never overwrite it (docs/GLOSSARY.md "Review Note").
    """

    __tablename__ = "review_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    # Real external ftrack creation time, distinct from `created_at`
    # (ICAS ingestion time, unchanged meaning). Null for manual rows.
    source_created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # Real external ftrack stable author id -- never username/email/
    # display name (ADR-0014 Decision 2). Grants no ICAS human role.
    external_author_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Display-only author provenance fallback.
    external_author_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
