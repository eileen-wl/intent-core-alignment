from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.integrations import writeback_service
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.intent.models import CoreAnchorRevision
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import ConflictError
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_and_confirm_revision(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "Keep it quiet", "core_summary": "quiet dread"},
            headers=VFX,
        )
    ).json()
    confirm = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "matches the brief"},
        headers=VFX,
    )
    assert confirm.status_code == 200
    return dict(confirm.json())


async def test_request_core_anchor_writeback_raises_when_shot_not_linked(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    confirmed = await _create_and_confirm_revision(client, shot_id)
    revision = await session.get(CoreAnchorRevision, uuid.UUID(confirmed["id"]))
    assert revision is not None
    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

    with pytest.raises(ConflictError):
        await writeback_service.request_core_anchor_writeback(
            session, actor, revision, rationale="test"
        )


async def test_request_core_anchor_writeback_resolves_target_and_composes_content(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    confirmed = await _create_and_confirm_revision(client, shot_id)
    revision = await session.get(CoreAnchorRevision, uuid.UUID(confirmed["id"]))
    assert revision is not None

    session.add(
        ExternalEntityLink(
            entity_type="shot",
            entity_id=uuid.UUID(shot_id),
            source="ftrack",
            external_id="ftrack-shot-1",
        )
    )
    await session.commit()

    actor = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")
    record = await writeback_service.request_core_anchor_writeback(
        session, actor, revision, rationale="matches the brief"
    )

    assert record.target_external_id == "ftrack-shot-1"
    assert record.status == "pending"
    assert record.source == "ftrack"
    assert "quiet dread" in record.content
    assert "matches the brief" in record.content
    assert record.requested_by_actor_id == "vfx-1"
    assert record.requested_by_human_role == "vfx_supervisor"


async def test_confirm_with_request_write_back_returns_409_when_shot_not_linked(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json={}, headers=VFX)
    ).json()

    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "ok", "request_write_back": True},
        headers=VFX,
    )
    assert response.status_code == 409
