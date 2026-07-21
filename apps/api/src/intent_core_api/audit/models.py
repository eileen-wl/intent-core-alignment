"""AuditEvent: immutable, append-only record of significant activity.

See docs/DOMAIN_MODEL.md §9, §11 rule 9 ("every authoritative workflow
change has an authorised actor and Audit Event"). No update/delete path
exists anywhere in the API surface for this table.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column()
    action: Mapped[str] = mapped_column(String(100))
    actor_kind: Mapped[str] = mapped_column(String(10))
    actor_id: Mapped[str] = mapped_column(String(200))
    actor_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    actor_agent_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    actor_agent_run_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    source_context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(default=_utcnow)
