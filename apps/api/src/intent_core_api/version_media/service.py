"""Version media resolution service (Step 9B-4;
docs/step-9/06_STEP_9B4_REAL_MEDIA_AND_FTRACK_CONTEXT.md).

Read-only end to end: no ``session.add``/``session.commit`` of its own,
no write-capable ftrack call. Every response is built fresh, per
request, from the real, already-persisted ``ExternalEntityLink`` plus a
live, transient ftrack read via ``version_media.resolver`` -- never a
stored field.

Context-scoping (§4 of the locked task, never relaxed):

- VFX: a Version must belong to the Shot supplied in the route.
- CG/Artist: a Version must belong to the Task's own Shot, and must
  satisfy the existing Step 8C-6/8C-7 nullable-``task_id`` compatibility
  rule (``version.task_id == task_id`` or ``version.task_id is None``)
  -- the exact same rule ``department_execution_overview.service``'s
  ``_is_version_in_task_scope`` and the frontend's
  ``@/lib/taskScopedVersions`` already enforce; a Version explicitly
  linked to a *different* Task is rejected.

Every one of the four honest ``media_state`` values is reached only
from a real, independently-meaningful fact -- never fabricated:

- ``"unavailable"`` -- no ``ExternalEntityLink`` at all (a manual/local
  Version), the linked ftrack ``AssetVersion`` no longer exists, or the
  live ftrack read itself failed (auth/connection/query error).
- ``"external_context_only"`` -- ftrack-linked and the ``AssetVersion``
  was found, but no thumbnail resolved to a real URL either.
- ``"thumbnail_only"`` -- a real, safe thumbnail URL resolved; no
  playable Component URL did.
- ``"playable"`` -- both a real thumbnail and a real playable Component
  URL resolved (thumbnail absence alone would not block this state;
  only the playable URL is required). **Not currently reachable**: this
  workspace's ftrack SDK exposes no credential-free Component URL field
  -- the only safe mechanism it exposes (``Location.get_url()``/
  ``get_thumbnail_url()``) embeds this service's own live ftrack API
  user/key directly in the returned URL, which must never be sent to a
  browser (docs/step-9/06_STEP_9B4_...md §5/§15). ``resolver.py``'s
  connector therefore never sets ``playable_url`` today; this branch
  and the contract's ``"playable"`` value are kept for a future
  workspace/SDK version that does expose a safe equivalent, per the
  task's own explicit "downgrade rather than proxy credentials"
  instruction.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from intent_core_connector.errors import IntegrationError
from intent_core_contracts.api.version_media import VersionMediaRead, VersionMediaState
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.integrations.external_link_service import find_external_id_for_entity
from intent_core_api.production_context.models import Shot, Task
from intent_core_api.version_media.resolver import MediaResolver, resolve_media_context
from intent_core_api.versions_and_feedback.models import Version
from intent_core_api.workflow.actors import ActorContext, HumanRole, require_human_role
from intent_core_api.workflow.exceptions import NotFoundError

_VFX_SUPERVISOR: frozenset[HumanRole] = frozenset({"vfx_supervisor"})
_CG_SUPERVISOR: frozenset[HumanRole] = frozenset({"cg_supervisor"})
_ARTIST: frozenset[HumanRole] = frozenset({"artist"})

_ENTITY_TYPE_VERSION = "version"
_SOURCE_FTRACK = "ftrack"

_REASON_NOT_LINKED = "This Version has no linked ftrack record."
_REASON_ENTITY_MISSING = "The linked ftrack record could not be found -- it may have been deleted."
_REASON_SERVICE_UNAVAILABLE = "ftrack could not be reached just now. Try again."


def _is_version_in_task_scope(version: Version, task_id: uuid.UUID) -> bool:
    """Identical rule to ``department_execution_overview.service``'s own
    helper -- a manually-created Version with no Task link belongs to
    every Task under its Shot; a Version explicitly linked to a
    *different* Task is excluded."""
    return version.task_id is None or version.task_id == task_id


async def _build_media_read(
    session: AsyncSession, version: Version, *, resolver: MediaResolver
) -> VersionMediaRead:
    now = datetime.now(UTC)
    external_id = await find_external_id_for_entity(
        session, entity_type=_ENTITY_TYPE_VERSION, entity_id=version.id, source=_SOURCE_FTRACK
    )
    if external_id is None:
        return VersionMediaRead(
            version_id=version.id,
            source=version.source,  # type: ignore[arg-type]
            ftrack_linked=False,
            media_state="unavailable",
            thumbnail_url=None,
            playable_url=None,
            playable_media_type=None,
            playable_component_name=None,
            external_web_url=None,
            resolved_at=now,
            url_expires_at=None,
            unavailable_reason=_REASON_NOT_LINKED,
        )

    try:
        context = await resolver(version_external_id=external_id)
    except IntegrationError:
        return VersionMediaRead(
            version_id=version.id,
            source=version.source,  # type: ignore[arg-type]
            ftrack_linked=True,
            media_state="unavailable",
            thumbnail_url=None,
            playable_url=None,
            playable_media_type=None,
            playable_component_name=None,
            external_web_url=None,
            resolved_at=now,
            url_expires_at=None,
            unavailable_reason=_REASON_SERVICE_UNAVAILABLE,
        )

    if not context.exists:
        return VersionMediaRead(
            version_id=version.id,
            source=version.source,  # type: ignore[arg-type]
            ftrack_linked=True,
            media_state="unavailable",
            thumbnail_url=None,
            playable_url=None,
            playable_media_type=None,
            playable_component_name=None,
            external_web_url=None,
            resolved_at=now,
            url_expires_at=None,
            unavailable_reason=_REASON_ENTITY_MISSING,
        )

    media_state: VersionMediaState
    unavailable_reason: str | None = None
    if context.playable_url is not None:
        media_state = "playable"
    elif context.thumbnail_url is not None:
        media_state = "thumbnail_only"
    else:
        media_state = "external_context_only"
        unavailable_reason = "No thumbnail or playable media is available for this Version."

    return VersionMediaRead(
        version_id=version.id,
        source=version.source,  # type: ignore[arg-type]
        ftrack_linked=True,
        media_state=media_state,
        thumbnail_url=context.thumbnail_url,
        playable_url=context.playable_url,
        playable_media_type=context.playable_media_type,
        playable_component_name=context.playable_component_name,
        # Never proven safe/reliable to construct in this workspace --
        # see docs/step-9/06_STEP_9B4_...md §11. Kept internally distinct
        # from `unavailable_reason`: the Version *is* ftrack-linked, only
        # the deep link itself is withheld.
        external_web_url=None,
        resolved_at=now,
        url_expires_at=None,
        unavailable_reason=unavailable_reason,
    )


async def get_media_for_vfx_shot_version(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    version_id: uuid.UUID,
    *,
    resolver: MediaResolver = resolve_media_context,
) -> VersionMediaRead | None:
    """VFX-Supervisor-only, Shot-scoped. Returns ``None`` only when the
    Shot itself does not exist. Raises ``NotFoundError`` when the
    Version does not exist or belongs to a *different* Shot -- VFX's
    Versions page is Shot-wide, never Task-scoped (Step 8's locked
    page-responsibility split)."""
    require_human_role(actor, _VFX_SUPERVISOR)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        return None

    version = await session.get(Version, version_id)
    if version is None or version.shot_id != shot_id:
        raise NotFoundError("Version not found")

    return await _build_media_read(session, version, resolver=resolver)


async def get_media_for_cg_task_version(
    session: AsyncSession,
    actor: ActorContext,
    task_id: uuid.UUID,
    version_id: uuid.UUID,
    *,
    resolver: MediaResolver = resolve_media_context,
) -> VersionMediaRead | None:
    """CG-Supervisor-only, Task-scoped. Returns ``None`` only when the
    Task itself does not exist. Raises ``NotFoundError`` when the
    Version does not exist, belongs to a different Shot than the Task,
    or is explicitly linked to a *different* Task (the Step 8C-6/8C-7
    nullable-task_id compatibility rule is the only accepted exception)."""
    require_human_role(actor, _CG_SUPERVISOR)

    task = await session.get(Task, task_id)
    if task is None:
        return None

    version = await session.get(Version, version_id)
    if (
        version is None
        or version.shot_id != task.shot_id
        or not _is_version_in_task_scope(version, task_id)
    ):
        raise NotFoundError("Version not found")

    return await _build_media_read(session, version, resolver=resolver)


async def get_media_for_artist_task_version(
    session: AsyncSession,
    actor: ActorContext,
    task_id: uuid.UUID,
    version_id: uuid.UUID,
    *,
    resolver: MediaResolver = resolve_media_context,
) -> VersionMediaRead | None:
    """Artist-only, Task-scoped -- identical context rule to CG's own
    endpoint, distinguished only by the required human role."""
    require_human_role(actor, _ARTIST)

    task = await session.get(Task, task_id)
    if task is None:
        return None

    version = await session.get(Version, version_id)
    if (
        version is None
        or version.shot_id != task.shot_id
        or not _is_version_in_task_scope(version, task_id)
    ):
        raise NotFoundError("Version not found")

    return await _build_media_read(session, version, resolver=resolver)
