"""Push real ftrack context to apps/api.

ADR-0008: this service never writes to Postgres directly -- it calls
the same endpoints a manual/trusted client would use, with
source="ftrack" set (Project/Shot/Task: ADR-0010's idempotent-upsert
`external_id`; Version/ReviewNote: the Step 8C-3 trusted internal sync
endpoints, ADR-0014) so the receiving endpoint upserts idempotently
instead of duplicating on a repeat sync.

`sync_shot_context`'s request body is a plain dict, not an
intent_core_contracts schema -- the original, deliberate choice to
avoid a cross-package dependency for that one simple outbound shape.
`sync_version`/`sync_review_note` (Step 8C-4/8C-5) depart from that:
they import and construct the real `VersionSyncCreate`/
`ReviewNoteSyncCreate` contracts directly, because those payloads are
materially stricter (`extra="forbid"`, `AwareDatetime`) and getting
that validation for free at the connector/worker boundary -- catching
a malformed outbound payload before it ever reaches apps/api -- is a
concrete benefit the simple ShotContext case never had. This is a
deliberate, one-time addition of `intent-core-contracts` as a real
dependency of `services/ftrack-connector`, not an accidental drift from
the original convention.
"""

from __future__ import annotations

import httpx
from intent_core_contracts.api.ftrack_version_note_sync import (
    ReviewNoteSyncCreate,
    VersionNoteSyncItemResult,
    VersionSyncCreate,
)
from pydantic import BaseModel

from intent_core_connector.config import get_settings
from intent_core_connector.errors import IntegrationError
from intent_core_connector.shot_context import ShotContext
from intent_core_connector.version_note_context import AssetVersionContext, NoteContext

_INTERNAL_SYNC_TOKEN_HEADER = "X-Internal-Sync-Token"


class ShotSyncResult(BaseModel):
    project_id: str
    shot_id: str
    task_id: str | None = None


async def sync_shot_context(
    context: ShotContext, *, api_base_url: str | None = None
) -> ShotSyncResult:
    base_url = api_base_url or get_settings().api_base_url
    async with httpx.AsyncClient(base_url=base_url) as client:
        project_response = await client.post(
            "/projects",
            json={
                "name": context.project.name,
                "source": "ftrack",
                "external_id": context.project.external_id,
            },
        )
        project_response.raise_for_status()
        project_id = project_response.json()["id"]

        shot_response = await client.post(
            "/shots",
            json={
                "project_id": project_id,
                "name": context.name,
                "source": "ftrack",
                "external_id": context.external_id,
            },
        )
        shot_response.raise_for_status()
        shot_id = shot_response.json()["id"]

        task_id: str | None = None
        if context.task is not None:
            task_response = await client.post(
                "/tasks",
                json={
                    "shot_id": shot_id,
                    "name": context.task.name,
                    "department": context.task.department,
                    "source": "ftrack",
                    "external_id": context.task.external_id,
                },
            )
            task_response.raise_for_status()
            task_id = task_response.json()["id"]

    return ShotSyncResult(project_id=project_id, shot_id=shot_id, task_id=task_id)


def _resolve_internal_sync_token(internal_sync_token: str | None) -> str:
    """Fails closed: never falls through to calling apps/api
    unauthenticated when no token is configured either explicitly or
    via settings (Step 8B §8's trusted-boundary decision, mirrored on
    the sending side)."""
    if internal_sync_token is not None:
        token = internal_sync_token
    else:
        token = get_settings().internal_sync_token
    if not token:
        raise IntegrationError(
            "INTERNAL_SYNC_TOKEN is not configured; refusing to call the internal sync API"
        )
    return token


async def list_linked_shots(
    *, api_base_url: str | None = None, internal_sync_token: str | None = None
) -> list[dict[str, str]]:
    """Every already-linked ftrack Shot (Step 8C-4/8C-5's safe boundary
    for enumerating what to sweep) -- `GET /internal/sync/linked-shots`,
    never a direct database query and never a guess from ftrack Shot
    names."""
    base_url = api_base_url or get_settings().api_base_url
    token = _resolve_internal_sync_token(internal_sync_token)
    async with httpx.AsyncClient(base_url=base_url) as client:
        response = await client.get(
            "/internal/sync/linked-shots", headers={_INTERNAL_SYNC_TOKEN_HEADER: token}
        )
        response.raise_for_status()
        result: list[dict[str, str]] = response.json()
        return result


async def sync_version(
    context: AssetVersionContext,
    *,
    api_base_url: str | None = None,
    internal_sync_token: str | None = None,
) -> VersionNoteSyncItemResult:
    """POST one real AssetVersion to `/internal/sync/versions`. Raises
    `httpx.HTTPStatusError` on any non-2xx response (401/409/422/5xx
    included) -- never silently reinterpreted as any particular
    outcome; the caller (the worker job) decides how to count/react to
    each distinct failure. A successful response's `outcome` (created /
    already_exists / skipped) is returned exactly as apps/api reported
    it."""
    base_url = api_base_url or get_settings().api_base_url
    token = _resolve_internal_sync_token(internal_sync_token)
    payload = VersionSyncCreate(
        external_id=context.external_id,
        shot_external_id=context.shot_external_id,
        task_external_id=context.task_external_id,
        name=context.name,
        version_number=context.version_number,
        description=context.comment,
        source_created_at=context.source_created_at,
        external_author_id=context.external_author_id,
        external_author_name=context.external_author_name,
    )
    async with httpx.AsyncClient(base_url=base_url) as client:
        response = await client.post(
            "/internal/sync/versions",
            json=payload.model_dump(mode="json"),
            headers={_INTERNAL_SYNC_TOKEN_HEADER: token},
        )
        response.raise_for_status()
        return VersionNoteSyncItemResult.model_validate(response.json())


async def sync_review_note(
    context: NoteContext,
    *,
    api_base_url: str | None = None,
    internal_sync_token: str | None = None,
) -> VersionNoteSyncItemResult:
    """POST one real Note to `/internal/sync/review-notes`. Same
    error-surfacing contract as `sync_version` above."""
    base_url = api_base_url or get_settings().api_base_url
    token = _resolve_internal_sync_token(internal_sync_token)
    payload = ReviewNoteSyncCreate(
        external_id=context.external_id,
        version_external_id=context.version_external_id,
        content=context.content,
        source_created_at=context.source_created_at,
        external_author_id=context.external_author_id,
        external_author_name=context.external_author_name,
    )
    async with httpx.AsyncClient(base_url=base_url) as client:
        response = await client.post(
            "/internal/sync/review-notes",
            json=payload.model_dump(mode="json"),
            headers={_INTERNAL_SYNC_TOKEN_HEADER: token},
        )
        response.raise_for_status()
        return VersionNoteSyncItemResult.model_validate(response.json())
