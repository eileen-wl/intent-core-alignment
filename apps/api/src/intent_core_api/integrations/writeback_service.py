"""Create a WritebackRecord for a confirmed CoreAnchorRevision (ADR-0012).

Resolves the target Shot's ExternalEntityLink and composes the Note
content here, at request time -- the worker job that performs the
actual ftrack write never re-derives either.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.integrations.models import ExternalEntityLink, WritebackRecord
from intent_core_api.intent.models import CoreAnchor, CoreAnchorRevision
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ConflictError, InternalConsistencyError

WRITEBACK_CONTENT_MARKER = "[Intent Core Alignment System]"


def _compose_note_content(revision: CoreAnchorRevision, *, rationale: str | None) -> str:
    lines = [
        f"{WRITEBACK_CONTENT_MARKER} Core Anchor confirmed (revision #{revision.revision_number}).",
    ]
    if revision.core_summary:
        lines.append(f"Core summary: {revision.core_summary}")
    lines.append(f"Rationale: {rationale or 'none provided'}")
    return "\n\n".join(lines)


async def request_core_anchor_writeback(
    session: AsyncSession,
    actor: ActorContext,
    revision: CoreAnchorRevision,
    *,
    rationale: str | None,
) -> WritebackRecord:
    anchor = await session.get(CoreAnchor, revision.core_anchor_id)
    if anchor is None:
        raise InternalConsistencyError(
            f"CoreAnchorRevision {revision.id} references a missing CoreAnchor"
        )

    link = await session.scalar(
        select(ExternalEntityLink).where(
            ExternalEntityLink.entity_type == "shot",
            ExternalEntityLink.entity_id == anchor.shot_id,
            ExternalEntityLink.source == "ftrack",
        )
    )
    if link is None:
        raise ConflictError("Shot is not linked to a ftrack record; cannot write back")

    record = WritebackRecord(
        entity_type="core_anchor_revision",
        entity_id=revision.id,
        source="ftrack",
        target_external_id=link.external_id,
        content=_compose_note_content(revision, rationale=rationale),
        status="pending",
        requested_by_actor_kind=actor.actor_kind,
        requested_by_actor_id=actor.actor_id,
        requested_by_human_role=actor.human_role,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record
