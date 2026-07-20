"""Push a real Shot's context (Project -> Shot -> Task) to apps/api.

ADR-0008: this service never writes to Postgres directly -- it calls
the same production_context endpoints a manual client would use
(docs/PRODUCT_SCOPE.md §15: both paths produce the same internal
object types), with source="ftrack" and external_id set so the
receiving endpoint upserts idempotently instead of duplicating on a
repeat sync (ADR-0010). No request body is built from an
intent_core_contracts schema here -- same convention as
services/worker's tasks.py, which posts a plain dict rather than
adding a cross-package dependency for one outbound call shape.
"""

from __future__ import annotations

import httpx
from pydantic import BaseModel

from intent_core_connector.config import get_settings
from intent_core_connector.shot_context import ShotContext


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
