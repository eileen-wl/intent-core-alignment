"""ExternalEntityLink (ADR-0010).

See docs/ARCHITECTURE.md §4, docs/GLOSSARY.md ("External Entity
Link"). entity_type/entity_id are a deliberately loose (unconstrained)
reference -- same pattern as workflow.models.Decision -- since the set
of linkable entity types is open-ended and this table must not fail on
an FK mismatch to a not-yet-existing target kind.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class ExternalEntityLink(Base):
    """Connects one internal Project/Shot/Task to the external (ftrack)
    record it was synced from.

    Created only as a side effect of an idempotent-upsert create call
    in production_context.router (source != "manual" with an
    external_id) -- never exposed as its own write endpoint.
    """

    __tablename__ = "external_entity_links"
    __table_args__ = (
        UniqueConstraint(
            "source", "external_id", name="uq_external_entity_links_source_external_id"
        ),
        UniqueConstraint(
            "entity_type", "entity_id", "source", name="uq_external_entity_links_entity_source"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    source: Mapped[str] = mapped_column(String(20))
    external_id: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class SyncCursor(Base):
    """Last successful sync point for one named reconciliation process
    (ADR-0011), e.g. "ftrack_shot_reconciliation". `key` names the
    process rather than being a UUID -- this is a small, fixed set of
    named cursors, not a per-entity table.
    """

    __tablename__ = "sync_cursors"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    last_synced_at: Mapped[datetime] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class WritebackRecord(Base):
    """Tracks one outbound ftrack operation (ADR-0012).

    `target_external_id` is resolved once, at creation time (the
    ExternalEntityLink lookup happens in integrations.writeback_service,
    not here and not in the worker) -- the worker job only reads this
    record and performs the write, it never re-derives the target.
    `entity_type`/`entity_id` describe what internal record the
    write-back is *for* (a loose reference, same pattern as
    ExternalEntityLink/workflow.models.Decision), not the ftrack target.
    """

    __tablename__ = "writeback_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    source: Mapped[str] = mapped_column(String(20))
    target_external_id: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    external_note_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by_actor_kind: Mapped[str] = mapped_column(String(10))
    requested_by_actor_id: Mapped[str] = mapped_column(String(200))
    requested_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
