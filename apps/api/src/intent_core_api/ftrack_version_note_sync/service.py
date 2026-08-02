"""Sync logic for the trusted internal ftrack Version/ReviewNote sync
endpoints (Step 8C-3; docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md
§3-§5/§13, ADR-0014).

Idempotency is keyed entirely by ``ExternalEntityLink`` -- a repeat
request for the same ``external_id`` returns ``outcome="already_exists"``
and never mutates the already-linked row (``Version``/``ReviewNote`` are
immutable/append-only by existing product rule; a sync is a true no-op
on repeat, never an update, deliberately diverging from
``production_context``'s Project/Shot/Task upsert-with-update pattern --
ADR-0014 Decision 3). All lineage resolution goes through
``ExternalEntityLink``, never through a name or content match.
"""

from __future__ import annotations

import uuid

from intent_core_contracts.api.ftrack_version_note_sync import (
    ReviewNoteSyncCreate,
    VersionNoteSyncItemResult,
    VersionSyncCreate,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.versions_and_feedback.models import ReviewNote, Version
from intent_core_api.workflow.exceptions import ConflictError

_ACTOR_KIND = "system"
_ACTOR_ID = "ftrack-sync"


async def sync_version(
    session: AsyncSession, payload: VersionSyncCreate
) -> VersionNoteSyncItemResult:
    # A. Idempotency: an already-linked AssetVersion is a true no-op.
    existing_id = await find_linked_entity_id(
        session, entity_type="version", source="ftrack", external_id=payload.external_id
    )
    if existing_id is not None:
        return VersionNoteSyncItemResult(
            outcome="already_exists", entity_id=existing_id, external_id=payload.external_id
        )

    # B. Resolve Shot lineage -- never by name.
    shot_id = await find_linked_entity_id(
        session, entity_type="shot", source="ftrack", external_id=payload.shot_external_id
    )
    if shot_id is None:
        return VersionNoteSyncItemResult(
            outcome="skipped", external_id=payload.external_id, reason="shot_not_linked"
        )

    # C. Resolve optional Task lineage -- Shot resolving is sufficient to
    # create the Version; an unresolved Task only clears task_id, never
    # blocks creation (Step 8B §13).
    task_id: uuid.UUID | None = None
    if payload.task_external_id is not None:
        task_id = await find_linked_entity_id(
            session, entity_type="task", source="ftrack", external_id=payload.task_external_id
        )

    # D. Create the Version and its ExternalEntityLink atomically.
    version = Version(
        shot_id=shot_id,
        task_id=task_id,
        name=payload.name,
        version_number=payload.version_number,
        description=payload.description,
        source="ftrack",
        source_created_at=payload.source_created_at,
        external_author_id=payload.external_author_id,
        external_author_name=payload.external_author_name,
        created_by_actor_kind=_ACTOR_KIND,
        created_by_actor_id=_ACTOR_ID,
        created_by_human_role=None,
    )
    session.add(version)
    try:
        await session.flush()
        await record_external_link(
            session,
            entity_type="version",
            entity_id=version.id,
            source="ftrack",
            external_id=payload.external_id,
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(
            f"Concurrent sync conflict for AssetVersion {payload.external_id!r}"
        ) from None
    await session.refresh(version)

    reason = "task_not_linked" if payload.task_external_id is not None and task_id is None else None
    return VersionNoteSyncItemResult(
        outcome="created", entity_id=version.id, external_id=payload.external_id, reason=reason
    )


async def sync_review_note(
    session: AsyncSession, payload: ReviewNoteSyncCreate
) -> VersionNoteSyncItemResult:
    # A. Idempotency: an already-linked Note is a true no-op.
    existing_id = await find_linked_entity_id(
        session, entity_type="review_note", source="ftrack", external_id=payload.external_id
    )
    if existing_id is not None:
        return VersionNoteSyncItemResult(
            outcome="already_exists", entity_id=existing_id, external_id=payload.external_id
        )

    # B. Resolve Version lineage -- never by name, version number, or
    # content.
    version_id = await find_linked_entity_id(
        session,
        entity_type="version",
        source="ftrack",
        external_id=payload.version_external_id,
    )
    if version_id is None:
        return VersionNoteSyncItemResult(
            outcome="skipped", external_id=payload.external_id, reason="version_not_linked"
        )

    # C. Create the ReviewNote and its ExternalEntityLink atomically.
    note = ReviewNote(
        version_id=version_id,
        content=payload.content,
        source="ftrack",
        source_created_at=payload.source_created_at,
        external_author_id=payload.external_author_id,
        external_author_name=payload.external_author_name,
        created_by_actor_kind=_ACTOR_KIND,
        created_by_actor_id=_ACTOR_ID,
        created_by_human_role=None,
    )
    session.add(note)
    try:
        await session.flush()
        await record_external_link(
            session,
            entity_type="review_note",
            entity_id=note.id,
            source="ftrack",
            external_id=payload.external_id,
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(f"Concurrent sync conflict for Note {payload.external_id!r}") from None
    await session.refresh(note)

    return VersionNoteSyncItemResult(
        outcome="created", entity_id=note.id, external_id=payload.external_id
    )
