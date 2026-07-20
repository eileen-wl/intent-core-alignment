"""Version, ReviewNote (Step 4a).

See docs/DOMAIN_MODEL.md §4. Only the smallest slice: a Version belongs
directly to a Shot (no Task linkage yet), and a ReviewNote belongs to a
Version. VersionArtifact/ReviewActionItem/SubmissionRationale/
VersionRelation are out of scope for this slice.

Future ftrack external ids go through integrations.models.ExternalEntityLink,
never a direct external_id column here -- same reasoning ADR-0010 already
applied to Project/Shot/Task, applied a second time.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text
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
