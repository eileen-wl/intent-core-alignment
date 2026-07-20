"""Version, ReviewNote (Step 4a); AlignmentAssessment (Step 4b).

See docs/DOMAIN_MODEL.md §4. Only the smallest slice: a Version belongs
directly to a Shot (no Task linkage yet), and a ReviewNote belongs to a
Version. VersionArtifact/ReviewActionItem/SubmissionRationale/
VersionRelation are out of scope for this slice.

Future ftrack external ids go through integrations.models.ExternalEntityLink,
never a direct external_id column here -- same reasoning ADR-0010 already
applied to Project/Shot/Task, applied a second time.

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

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Version(Base):
    """A recorded iteration of work for a Shot. Immutable, append-only --
    no update endpoint (matches IntentBrief's own convention).
    """

    __tablename__ = "versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    name: Mapped[str] = mapped_column(String(200))
    version_number: Mapped[int | None] = mapped_column(nullable=True)
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
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


class ReviewNote(Base):
    """Original human feedback on a Version. Immutable, append-only --
    AI summaries must never overwrite it (docs/GLOSSARY.md "Review Note").
    """

    __tablename__ = "review_notes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("versions.id"))
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
