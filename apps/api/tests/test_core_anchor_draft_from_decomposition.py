from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents.core_agent_service import create_core_anchor_draft_from_decomposition
from intent_core_api.workflow.actors import build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot_with_decomposition(
    client: AsyncClient, raw_text: str = "Quiet."
) -> dict[str, Any]:
    """Uses a deliberately short brief so the resulting decomposition has
    at least one uncertainty -- exercising the uncertainties -> OpenQuestion
    mapping, not just the always-populated constraint/variation-zone lists.
    """
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    await client.post(
        "/intent/briefs", json={"shot_id": shot["id"], "raw_text": raw_text}, headers=VFX
    )
    decomposition = (
        await client.post(f"/intent/shots/{shot['id']}/intent-decompositions/generate", headers=VFX)
    ).json()
    return {"shot_id": shot["id"], "decomposition": decomposition}


async def test_apply_creates_draft_with_correct_scalar_mapping(client: AsyncClient) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    response = await client.post(
        f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
        json={},
        headers=VFX,
    )
    assert response.status_code == 201
    draft = response.json()

    assert draft["status"] == "draft"
    assert draft["shot_objective"] == decomposition["anchor_relevant_content"]
    assert draft["emotional_tone"] == decomposition["dimensions"]["emotional_tone"]["summary"]
    assert draft["visual_focus"] == decomposition["dimensions"]["visual_focus"]["summary"]
    assert (
        draft["rhythm_intensity"] == decomposition["dimensions"]["rhythm_and_intensity"]["summary"]
    )
    assert (
        draft["character_relationship"]
        == decomposition["dimensions"]["character_relationships"]["summary"]
    )
    assert (
        draft["narrative_priority"] == decomposition["dimensions"]["narrative_priority"]["summary"]
    )
    assert draft["core_summary"] == decomposition["core_intent_summary"]
    assert draft["source_intent_decomposition_id"] == decomposition["id"]


async def test_apply_creates_semantic_children_from_candidates_with_new_ids(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]
    assert decomposition["uncertainties"], "fixture must exercise a non-empty uncertainties list"

    draft = (
        await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
    ).json()

    assert [c["content"] for c in draft["constraints"]] == decomposition["candidate_constraints"]
    assert [v["content"] for v in draft["variation_zones"]] == decomposition[
        "candidate_variation_zones"
    ]
    assert [q["question"] for q in draft["open_questions"]] == decomposition["uncertainties"]
    assert draft["drift_risks"] == []
    assert draft["references"] == []

    # Fresh server-generated ids -- not copied from the decomposition (the
    # decomposition itself has no per-item ids to copy from; this proves
    # the semantic rows are genuinely new CoreAnchorRevision children).
    for item in draft["constraints"] + draft["variation_zones"] + draft["open_questions"]:
        uuid.UUID(item["id"])
        assert item["order_index"] == 0


async def test_apply_creates_succeeded_agent_run_with_core_anchor_drafting_capability(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    draft = (
        await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
    ).json()

    run = (await client.get(f"/intent/agent-runs/{draft['created_by_agent_run_id']}")).json()
    assert run["status"] == "succeeded"
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "core_anchor_drafting"
    assert run["provider"] == "deterministic"
    assert run["result_revision_id"] == draft["id"]

    assert draft["created_by_actor_kind"] == "agent"
    assert draft["created_by_agent_type"] == "core_agent"


async def test_apply_conflicts_when_a_draft_already_exists_and_does_not_overwrite_it(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_decomposition(client)
    shot_id = ids["shot_id"]
    decomposition = ids["decomposition"]

    existing = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"shot_objective": "Manually authored draft"},
            headers=VFX,
        )
    ).json()

    response = await client.post(
        f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
        json={},
        headers=VFX,
    )
    assert response.status_code == 409

    revisions = (await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")).json()
    assert len(revisions) == 1
    assert revisions[0]["id"] == existing["id"]
    assert revisions[0]["shot_objective"] == "Manually authored draft"
    assert revisions[0]["source_intent_decomposition_id"] is None


async def test_apply_does_not_call_deepseek_even_when_configured_as_the_default_provider(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The application step is a deterministic transform, not a second
    model call -- it must succeed even with MODEL_PROVIDER=deepseek and no
    API key configured, proving it never reaches the DeepSeek adapter."""
    from intent_core_api.config import get_settings

    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    get_settings.cache_clear()
    monkeypatch.setenv("MODEL_PROVIDER", "deepseek")
    monkeypatch.setenv("MODEL_API_KEY", "")
    monkeypatch.setenv("MODEL_NAME", "")
    get_settings.cache_clear()
    try:
        response = await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
        assert response.status_code == 201
    finally:
        monkeypatch.delenv("MODEL_PROVIDER", raising=False)
        monkeypatch.delenv("MODEL_API_KEY", raising=False)
        monkeypatch.delenv("MODEL_NAME", raising=False)
        get_settings.cache_clear()


async def test_human_cg_supervisor_and_artist_cannot_apply(client: AsyncClient) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=headers,
        )
        assert response.status_code == 403


async def test_agent_actor_cannot_apply_at_service_level(session: AsyncSession) -> None:
    agent = build_agent_actor("core_agent", uuid.uuid4())
    with pytest.raises(ForbiddenActionError):
        await create_core_anchor_draft_from_decomposition(session, agent, uuid.uuid4())


async def test_apply_unknown_decomposition_returns_404(client: AsyncClient) -> None:
    response = await client.post(
        "/intent/intent-decompositions/00000000-0000-0000-0000-000000000000/core-anchor-draft",
        json={},
        headers=VFX,
    )
    assert response.status_code == 404


async def test_apply_creates_no_decision_and_does_not_confirm(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    draft = (
        await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
    ).json()

    assert draft["status"] == "draft"
    assert draft["confirmed_at"] is None
    assert (await session.execute(select(Decision))).scalars().all() == []


async def test_human_may_edit_the_resulting_draft_using_the_existing_service(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_decomposition(client)
    decomposition = ids["decomposition"]

    draft = (
        await client.post(
            f"/intent/intent-decompositions/{decomposition['id']}/core-anchor-draft",
            json={},
            headers=VFX,
        )
    ).json()

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={
            "shot_objective": "Edited after applying the decomposition",
            "constraints": [{"content": "A human-edited constraint"}],
        },
        headers=VFX,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["shot_objective"] == "Edited after applying the decomposition"
    assert [c["content"] for c in updated["constraints"]] == ["A human-edited constraint"]
    # Editing does not clear the decomposition lineage pointer.
    assert updated["source_intent_decomposition_id"] == decomposition["id"]
