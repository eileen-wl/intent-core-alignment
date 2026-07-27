from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from intent_core_api.agents.core_agent_service import generate_core_anchor_draft
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.intent.models import CoreAnchorRevision
from intent_core_api.workflow.exceptions import AgentGenerationError
from intent_core_contracts.api.intent import CoreAnchorRevisionDraftCreate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}


async def _create_manual_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_ftrack_shot_with_task(client: AsyncClient) -> dict[str, str]:
    """A Project/Shot/Task set that looks like real WP-C sync output --
    source="ftrack" with a real external_id, exactly what
    RUNBOOK_FTRACK_SYNC_VALIDATION.md's flow would have produced.
    """
    project = (
        await client.post(
            "/projects",
            json={
                "name": "Napo (Animation demo)",
                "source": "ftrack",
                "external_id": "ftrack-project-1",
            },
        )
    ).json()
    shot = (
        await client.post(
            "/shots",
            json={
                "project_id": project["id"],
                "name": "SH010",
                "source": "ftrack",
                "external_id": "ftrack-shot-1",
            },
        )
    ).json()
    task = (
        await client.post(
            "/tasks",
            json={
                "shot_id": shot["id"],
                "name": "Animation",
                "department": "animation",
                "source": "ftrack",
                "external_id": "ftrack-task-1",
            },
        )
    ).json()
    return {"project_id": project["id"], "shot_id": shot["id"], "task_id": task["id"]}


async def _create_brief(client: AsyncClient, shot_id: str, raw_text: str = "Quiet dread.") -> None:
    response = await client.post(
        "/intent/briefs", json={"shot_id": shot_id, "raw_text": raw_text}, headers=VFX
    )
    assert response.status_code == 201


async def test_generate_for_ftrack_sourced_shot_creates_snapshot_and_succeeded_run(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_ftrack_shot_with_task(client)
    await _create_brief(client, ids["shot_id"], "Keep it quiet.")

    response = await client.post(f"/intent/shots/{ids['shot_id']}/core-anchor/generate")
    assert response.status_code == 201
    draft = response.json()

    assert draft["status"] == "draft"
    assert draft["context_snapshot_id"] is not None
    assert draft["created_by_agent_run_id"] is not None

    snapshot_response = await client.get(
        f"/intent/context-snapshots/{draft['context_snapshot_id']}"
    )
    assert snapshot_response.status_code == 200
    snapshot = snapshot_response.json()
    assert snapshot["shot_id"] == ids["shot_id"]

    payload = snapshot["payload"]
    assert payload["shot"] == {
        "id": ids["shot_id"],
        "name": "SH010",
        "source": "ftrack",
        "external_id": "ftrack-shot-1",
    }
    assert payload["project"] == {
        "id": ids["project_id"],
        "name": "Napo (Animation demo)",
        "source": "ftrack",
        "external_id": "ftrack-project-1",
    }
    assert len(payload["tasks"]) == 1
    assert payload["tasks"][0] == {
        "id": ids["task_id"],
        "name": "Animation",
        "source": "ftrack",
        "department": "animation",
        "external_id": "ftrack-task-1",
    }
    assert "Keep it quiet." in payload["intent_brief"]["raw_text"]
    assert "id" in payload["intent_brief"]

    run_response = await client.get(f"/intent/agent-runs/{draft['created_by_agent_run_id']}")
    assert run_response.status_code == 200
    run = run_response.json()
    assert run["status"] == "succeeded"
    assert run["shot_id"] == ids["shot_id"]
    assert run["context_snapshot_id"] == draft["context_snapshot_id"]
    assert run["agent_type"] == "core_agent"
    assert run["capability"] == "core_anchor_drafting"
    assert run["provider"] == "deterministic"
    assert run["result_revision_id"] == draft["id"]
    assert run["error"] is None
    assert run["completed_at"] is not None

    # Exactly one AgentRun and one ContextSnapshot were created.
    all_runs = (await session.execute(select(AgentRun))).scalars().all()
    all_snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(all_runs) == 1
    assert len(all_snapshots) == 1


async def test_generated_draft_does_not_confirm_itself_or_touch_execution_anchors(
    client: AsyncClient,
) -> None:
    ids = await _create_ftrack_shot_with_task(client)
    await _create_brief(client, ids["shot_id"])

    draft = (await client.post(f"/intent/shots/{ids['shot_id']}/core-anchor/generate")).json()

    assert draft["status"] == "draft"
    assert draft["confirmed_at"] is None
    assert draft["confirmed_by_actor_id"] is None

    anchor = (await client.get(f"/intent/shots/{ids['shot_id']}/core-anchor")).json()
    assert anchor["active_revision_id"] is None  # nothing confirmed

    execution_anchor_response = await client.get(f"/intent/tasks/{ids['task_id']}/execution-anchor")
    assert execution_anchor_response.status_code == 404  # untouched


async def test_generating_again_creates_a_new_snapshot_run_and_draft(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_ftrack_shot_with_task(client)
    await _create_brief(client, ids["shot_id"])

    first = (await client.post(f"/intent/shots/{ids['shot_id']}/core-anchor/generate")).json()
    await client.post(f"/intent/core-anchor-revisions/{first['id']}/confirm", json={}, headers=VFX)
    second = (await client.post(f"/intent/shots/{ids['shot_id']}/core-anchor/generate")).json()

    assert second["id"] != first["id"]
    assert second["context_snapshot_id"] != first["context_snapshot_id"]
    assert second["created_by_agent_run_id"] != first["created_by_agent_run_id"]

    all_runs = (await session.execute(select(AgentRun))).scalars().all()
    all_snapshots = (await session.execute(select(ContextSnapshot))).scalars().all()
    assert len(all_runs) == 2
    assert len(all_snapshots) == 2


class _FailingGenerator:
    def generate(self, *, snapshot_payload: dict) -> CoreAnchorRevisionDraftCreate:
        raise RuntimeError("simulated provider timeout")


async def test_agent_failure_leaves_a_failed_run_not_a_false_success(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_ftrack_shot_with_task(client)
    await _create_brief(client, ids["shot_id"])
    shot_uuid = uuid.UUID(ids["shot_id"])

    with pytest.raises(AgentGenerationError):
        await generate_core_anchor_draft(session, shot_uuid, generator=_FailingGenerator())

    runs = (
        (await session.execute(select(AgentRun).where(AgentRun.shot_id == shot_uuid)))
        .scalars()
        .all()
    )
    assert len(runs) == 1
    assert runs[0].status == "failed"
    assert "simulated provider timeout" in (runs[0].error or "")
    assert runs[0].result_revision_id is None
    assert runs[0].completed_at is not None

    # A ContextSnapshot was still created (context capture happens before
    # the provider is called) but no CoreAnchorRevision resulted from it.
    snapshots = (
        (await session.execute(select(ContextSnapshot).where(ContextSnapshot.shot_id == shot_uuid)))
        .scalars()
        .all()
    )
    assert len(snapshots) == 1

    revisions = (
        (
            await session.execute(
                select(CoreAnchorRevision).where(
                    CoreAnchorRevision.context_snapshot_id == snapshots[0].id
                )
            )
        )
        .scalars()
        .all()
    )
    assert revisions == []


async def test_manual_shot_generation_still_works_and_creates_a_snapshot_without_external_ids(
    client: AsyncClient,
) -> None:
    shot_id = await _create_manual_shot(client)
    await _create_brief(client, shot_id, "Second brief, the latest one.")

    response = await client.post(f"/intent/shots/{shot_id}/core-anchor/generate")
    assert response.status_code == 201
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["created_by_actor_kind"] == "agent"
    assert draft["created_by_agent_type"] == "core_agent"
    for field in (
        "shot_objective",
        "emotional_tone",
        "visual_focus",
        "rhythm_intensity",
        "character_relationship",
        "narrative_priority",
        "core_summary",
    ):
        assert "Second brief, the latest one." in draft[field]

    snapshot = (
        await client.get(f"/intent/context-snapshots/{draft['context_snapshot_id']}")
    ).json()
    assert "external_id" not in snapshot["payload"]["shot"]
    assert "external_id" not in snapshot["payload"]["project"]
    assert snapshot["payload"]["tasks"] == []


async def test_get_unknown_context_snapshot_and_agent_run_return_404(client: AsyncClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"
    assert (await client.get(f"/intent/context-snapshots/{unknown}")).status_code == 404
    assert (await client.get(f"/intent/agent-runs/{unknown}")).status_code == 404


async def test_human_authored_draft_has_no_context_snapshot(client: AsyncClient) -> None:
    shot_id = await _create_manual_shot(client)
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"shot_objective": "Human-written objective"},
        headers=VFX,
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["context_snapshot_id"] is None
    assert draft["created_by_agent_run_id"] is None
