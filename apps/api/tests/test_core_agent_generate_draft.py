from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from intent_core_api.agents import core_agent_service
from intent_core_api.agents.core_agent_service import (
    CoreAnchorDraftGenerator,
    DeterministicCoreAnchorDraftGenerator,
    generate_core_anchor_draft,
)
from intent_core_api.workflow.exceptions import AgentGenerationError, ConflictError, NotFoundError
from intent_core_contracts.api.intent import CoreAnchorRevisionDraftCreate
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}

CORE_ANCHOR_FIELDS = (
    "shot_objective",
    "emotional_tone",
    "visual_focus",
    "rhythm_intensity",
    "character_relationship",
    "narrative_priority",
    "core_summary",
)


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_brief(client: AsyncClient, shot_id: str, raw_text: str = "Quiet dread.") -> None:
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": raw_text}, headers=VFX
    )
    assert response.status_code == 201


# --- HTTP-level tests (router + service, real DeterministicCoreAnchorDraftGenerator) ---


async def test_generate_creates_a_draft_from_the_latest_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id, "First brief, superseded.")
    await _create_brief(client, shot_id, "Second brief, the latest one.")

    response = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert response.status_code == 201
    draft = response.json()

    assert draft["status"] == "draft"
    assert draft["revision_number"] == 1
    assert draft["created_by_actor_kind"] == "agent"
    assert draft["created_by_agent_type"] == "core_agent"
    assert draft["created_by_human_role"] is None
    assert draft["created_by_agent_run_id"] is not None
    assert draft["confirmed_by_human_role"] is None
    assert draft["confirmed_at"] is None

    for field in CORE_ANCHOR_FIELDS:
        assert draft[field] is not None
        assert "Second brief, the latest one." in draft[field]
        assert "First brief, superseded." not in draft[field]

    anchor = (await client.get(f"/intent/shots/{shot_id}/core-anchor")).json()
    # a draft is never made active -- only confirming does that.
    assert anchor["active_revision_id"] is None


async def test_generate_returns_404_for_unknown_shot(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/shots/00000000-0000-0000-0000-000000000000/core-anchor/generate"
    )
    assert response.status_code == 404
    assert "Shot not found" in response.json()["detail"]


async def test_generate_returns_404_when_shot_has_no_brief(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)

    response = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert response.status_code == 404
    assert "Intent Brief" in response.json()["detail"]


async def test_generate_returns_409_when_an_editable_draft_already_exists(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json={}, headers=VFX)

    response = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


async def test_generate_returns_409_when_a_previously_agent_generated_draft_is_still_pending(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)

    first = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert first.status_code == 201

    second = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert second.status_code == 409


async def test_generate_succeeds_again_after_the_existing_draft_is_confirmed(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)

    first = (await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")).json()
    confirm = await client.post(
        f"/intent/core-anchor-revisions/{first['id']}/confirm", json={}, headers=VFX
    )
    assert confirm.status_code == 200

    second = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert second.status_code == 201
    assert second.json()["revision_number"] == 2


# --- Service-level tests (direct call -- injected generator or monkeypatched
# settings, no HTTP round trip needed for the failure paths) ---


class _FailingGenerator:
    def generate(self, *, shot_name: str, brief_text: str) -> CoreAnchorRevisionDraftCreate:
        raise RuntimeError("simulated provider timeout")


async def test_generate_wraps_a_generator_failure_as_agent_generation_error(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)

    with pytest.raises(AgentGenerationError) as excinfo:
        await generate_core_anchor_draft(session, uuid.UUID(shot_id), generator=_FailingGenerator())
    assert "simulated provider timeout" in str(excinfo.value)


async def test_generate_returns_agent_generation_error_for_an_unsupported_model_provider(
    client: AsyncClient, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)

    class _FakeSettings:
        model_provider = "some-unconfigured-vendor"

    monkeypatch.setattr(core_agent_service, "get_settings", lambda: _FakeSettings())

    with pytest.raises(AgentGenerationError) as excinfo:
        await generate_core_anchor_draft(session, uuid.UUID(shot_id))
    assert "not implemented" in str(excinfo.value)


async def test_generate_raises_not_found_for_unknown_shot_at_service_level(
    session: AsyncSession,
) -> None:
    with pytest.raises(NotFoundError):
        await generate_core_anchor_draft(session, uuid.uuid4())


async def test_generate_raises_conflict_directly_when_draft_already_exists(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    await _create_brief(client, shot_id)
    await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts", json={}, headers=VFX)

    with pytest.raises(ConflictError):
        await generate_core_anchor_draft(session, uuid.UUID(shot_id))


def test_deterministic_generator_is_pure_and_repeatable() -> None:
    generator: CoreAnchorDraftGenerator = DeterministicCoreAnchorDraftGenerator()
    first = generator.generate(shot_name="SH010", brief_text="Quiet dread.")
    second = generator.generate(shot_name="SH010", brief_text="Quiet dread.")
    assert first == second
    for field in CORE_ANCHOR_FIELDS:
        assert "Quiet dread." in getattr(first, field)
    assert "SH010" in first.shot_objective
