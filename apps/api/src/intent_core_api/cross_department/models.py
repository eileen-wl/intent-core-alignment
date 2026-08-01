"""TaskDependency (Step 7C-4): the first real persistence of the
Cross-department Conflict / Escalation concepts already named in
docs/GLOSSARY.md -- confirmed absent from the domain model before this
slice (this package's own module docstring reserved the concept without
implementing it).

One table backs three real CG Supervisor surfaces with a `kind`
discriminator:

- "dependency": an external decision, input, or cross-role issue that
  could block or distort a Task (docs/PRODUCT_SCOPE.md §10's "downstream
  risks", §12's "cross-department conflict").
- "conflict": a cross-role/cross-department incompatibility, same shape,
  distinct label for the Dependencies page's "Cross-role conflicts"
  section.
- "escalation": a CG Supervisor's real persisted request for VFX
  Supervisor attention (docs/GLOSSARY.md "Escalation") -- the record the
  VFX Review Inbox's new escalation work item is sourced from.

Immutable creation, mutable only via `status`/`resolved_*` (acknowledge/
resolve) -- no PATCH of `description`/`kind` anywhere in the API surface,
matching ReviewNote's own append-only precedent.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from intent_core_api.db import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        Index("ix_task_dependencies_task_id", "task_id"),
        Index("ix_task_dependencies_shot_id", "shot_id"),
        Index("ix_task_dependencies_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    shot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shots.id"))
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id"))
    related_version_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("versions.id"), nullable=True
    )
    # "dependency" | "conflict" | "escalation"
    kind: Mapped[str] = mapped_column(String(20))
    # "open" | "acknowledged" | "resolved"
    status: Mapped[str] = mapped_column(String(20), default="open")
    description: Mapped[str] = mapped_column(Text)
    # "low" | "medium" | "high" -- nullable, only ever set when a real
    # severity was supplied; never defaulted to a fabricated value.
    severity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Set only when kind="escalation" -- which human role's attention is
    # being requested. Always "vfx_supervisor" today (the only escalation
    # target this Step defines), kept as a real column rather than a
    # hard-coded constant so a future escalation target is additive.
    escalated_to_role: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_by_actor_kind: Mapped[str] = mapped_column(String(10))
    created_by_actor_id: Mapped[str] = mapped_column(String(200))
    created_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    resolved_by_actor_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    resolved_by_human_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)

    related_cross_role_assessment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cross_role_assessments.id"), nullable=True
    )
