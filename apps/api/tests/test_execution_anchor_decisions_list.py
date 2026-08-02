"""Step 9B-1: `GET /intent/execution-anchor-revisions/{id}/decisions` --
the Execution Anchor analogue of the existing Core Anchor endpoint
(`test_core_anchor_decisions_list.py`), added so CG's Current Execution
Direction summary can honestly show the real confirm/reject rationale.
Reuses `decision_service.list_decisions_for_entity` unchanged -- no new
service logic, no migration, no mutation.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> None:
    # A prerequisite `execution_anchor_service.create_draft_revision`
    # itself enforces (409 without it) -- not this test's own concern,
    # just real setup.
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={"core_summary": "A quiet, controlled chase."},
            headers=VFX,
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Lighting Pass") -> str:
    task = (
        await client.post(
            "/tasks", json={"shot_id": shot_id, "name": name, "department": "lighting"}
        )
    ).json()
    return str(task["id"])


async def _create_execution_draft(
    client: AsyncClient, task_id: str, **content: str
) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts", json=content, headers=CG
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_list_decisions_is_empty_for_a_draft_with_no_decision_yet(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_execution_draft(client, task_id)

    response = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}/decisions")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_decisions_is_empty_for_an_unknown_revision(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000/decisions"
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_list_decisions_returns_the_confirm_decision_with_full_provenance(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_execution_draft(
        client, task_id, technical_boundaries="24fps, no motion blur."
    )

    confirm = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
        json={"rationale": "matches the confirmed Core Anchor"},
        headers=CG,
    )
    assert confirm.status_code == 200

    response = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}/decisions")
    assert response.status_code == 200
    decisions = response.json()
    assert len(decisions) == 1
    decision = decisions[0]
    # Actor and human-role provenance retained exactly.
    assert decision["decision_type"] == "confirm_execution_anchor"
    assert decision["owning_human_role"] == "cg_supervisor"
    assert decision["actor_kind"] == "human"
    assert decision["actor_id"] == "cg-1"
    assert decision["actor_human_role"] == "cg_supervisor"
    assert decision["rationale"] == "matches the confirmed Core Anchor"
    assert decision["entity_type"] == "execution_anchor_revision"
    assert decision["entity_id"] == draft["id"]
    # No write/mutation side effect from this read: the revision itself
    # is unchanged by calling the decisions endpoint a second time.
    revision_after = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}")
    assert revision_after.json()["status"] == "confirmed"


async def test_list_decisions_returns_the_reject_decision_with_rationale(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_execution_draft(client, task_id)

    reject = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/reject",
        json={"rationale": "does not match the confirmed Core Anchor"},
        headers=CG,
    )
    assert reject.status_code == 200

    response = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}/decisions")
    decisions = response.json()
    assert len(decisions) == 1
    assert decisions[0]["decision_type"] == "reject_execution_anchor"
    assert decisions[0]["rationale"] == "does not match the confirmed Core Anchor"


async def test_list_decisions_does_not_leak_decisions_from_an_unrelated_revision(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task1_id = await _create_task(client, shot_id, name="Lighting Pass")
    task2_id = await _create_task(client, shot_id, name="Compositing")

    draft1 = await _create_execution_draft(client, task1_id, technical_boundaries="v1")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft1['id']}/confirm", json={}, headers=CG
    )
    draft2 = await _create_execution_draft(client, task2_id, technical_boundaries="v2")
    await client.post(
        f"/intent/execution-anchor-revisions/{draft2['id']}/reject",
        json={"rationale": "v2 rejected"},
        headers=CG,
    )

    draft1_decisions = (
        await client.get(f"/intent/execution-anchor-revisions/{draft1['id']}/decisions")
    ).json()
    draft2_decisions = (
        await client.get(f"/intent/execution-anchor-revisions/{draft2['id']}/decisions")
    ).json()

    assert len(draft1_decisions) == 1
    assert draft1_decisions[0]["decision_type"] == "confirm_execution_anchor"
    assert draft1_decisions[0]["entity_id"] == draft1["id"]
    assert len(draft2_decisions) == 1
    assert draft2_decisions[0]["decision_type"] == "reject_execution_anchor"
    assert draft2_decisions[0]["entity_id"] == draft2["id"]


async def test_list_decisions_retains_the_superseded_revisions_original_decision(
    client: AsyncClient,
) -> None:
    """A later confirmed revision must never erase or mutate the prior
    (now-superseded) revision's own confirm Decision -- real history,
    per `CLAUDE.md`'s "confirmed records must be versioned; do not
    overwrite history"."""
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    first_draft = await _create_execution_draft(
        client, task_id, technical_boundaries="first revision"
    )
    first_confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{first_draft['id']}/confirm",
            json={"rationale": "first confirmation"},
            headers=CG,
        )
    ).json()
    assert first_confirmed["status"] == "confirmed"

    from_confirmed = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed", headers=CG
    )
    assert from_confirmed.status_code == 201
    second_draft = from_confirmed.json()
    second_confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{second_draft['id']}/confirm",
            json={"rationale": "second confirmation"},
            headers=CG,
        )
    ).json()
    assert second_confirmed["status"] == "confirmed"
    assert second_confirmed["supersedes_revision_id"] == first_draft["id"]

    first_decisions = (
        await client.get(f"/intent/execution-anchor-revisions/{first_draft['id']}/decisions")
    ).json()
    second_decisions = (
        await client.get(f"/intent/execution-anchor-revisions/{second_draft['id']}/decisions")
    ).json()

    assert len(first_decisions) == 1
    assert first_decisions[0]["rationale"] == "first confirmation"
    assert len(second_decisions) == 1
    assert second_decisions[0]["rationale"] == "second confirmation"
