"""Package A role-scoped Anchor Context read model."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

from httpx import AsyncClient
from intent_core_api.anchor_context import service as anchor_context_service
from intent_core_contracts.api.anchor_context import AnchorAttentionContextRead

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _project_shot_task(client: AsyncClient) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Anchor context"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    task = (
        await client.post(
            "/tasks",
            json={"shot_id": shot["id"], "name": "Lighting", "department": "lighting"},
        )
    ).json()
    return str(shot["id"]), str(task["id"])


async def _confirm_core(
    client: AsyncClient, shot_id: str, summary: str = "Restrained dusk"
) -> dict:
    draft = (
        await client.post(
            f"/intent/shots/{shot_id}/core-anchor/drafts",
            json={
                "core_summary": summary,
                "constraints": [{"content": "Keep the confrontation restrained."}],
                "variation_zones": [{"content": "Local exposure may vary."}],
            },
            headers=VFX,
        )
    ).json()
    response = await client.post(
        f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
    )
    assert response.status_code == 200
    return response.json()


async def _confirm_execution(client: AsyncClient, task_id: str) -> dict:
    draft_response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={
            "technical_boundaries": "Keep faces readable without a heroic lift.",
            "production_ready_criteria": "Exposure remains inside the approved range.",
            "allowed_refinements": "Refine local fill only.",
        },
        headers=CG,
    )
    assert draft_response.status_code == 201
    draft = draft_response.json()
    response = await client.post(
        f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
    )
    assert response.status_code == 200
    return response.json()


async def test_role_scoped_endpoints_reject_wrong_roles(client: AsyncClient) -> None:
    shot_id, task_id = await _project_shot_task(client)

    assert (await client.get(f"/vfx/shots/{shot_id}/anchor-context", headers=CG)).status_code == 403
    assert (
        await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=ARTIST)
    ).status_code == 403
    assert (
        await client.get(f"/artist/tasks/{task_id}/anchor-context", headers=VFX)
    ).status_code == 403
    assert (await client.get(f"/vfx/shots/{shot_id}/anchor-context")).status_code == 401


async def test_vfx_missing_anchor_and_signal_are_honest(client: AsyncClient) -> None:
    shot_id, _task_id = await _project_shot_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/anchor-context", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["core_anchor"]["lifecycle_state"] == "missing"
    assert body["core_anchor"]["confirmed_revision_number"] is None
    assert body["attention"]["level"] == "not_assessed"
    assert body["open_vfx_escalation"] is False
    assert body["next_action"]["title"] == "Create the Core Anchor"
    assert body["next_action"]["executable"] is True


async def test_confirmed_authority_remains_current_when_newer_draft_exists(
    client: AsyncClient,
) -> None:
    shot_id, _task_id = await _project_shot_task(client)
    confirmed = await _confirm_core(client, shot_id)
    draft = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX)
    ).json()

    response = await client.get(f"/vfx/shots/{shot_id}/anchor-context", headers=VFX)

    core = response.json()["core_anchor"]
    assert core["confirmed_revision_id"] == confirmed["id"]
    assert core["confirmed_revision_number"] == 1
    assert core["direction_summary"] == "Restrained dusk"
    assert core["must_preserve"] == "Keep the confrontation restrained."
    assert core["allowed_variation"] == "Local exposure may vary."
    assert core["newer_draft_exists"] is True
    assert core["draft_revision_number"] == draft["revision_number"]
    assert core["pending_human_gate_exists"] is True


async def test_cg_context_proves_execution_upstream_revision(client: AsyncClient) -> None:
    shot_id, task_id = await _project_shot_task(client)
    confirmed_core = await _confirm_core(client, shot_id)
    confirmed_execution = await _confirm_execution(client, task_id)

    response = await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)

    assert response.status_code == 200
    body = response.json()
    assert body["core_anchor"]["confirmed_revision_number"] == 1
    execution = body["execution_anchor"]
    assert execution["confirmed_revision_id"] == confirmed_execution["id"]
    assert execution["confirmed_revision_number"] == 1
    assert execution["based_on_core_anchor_revision_id"] == confirmed_core["id"]
    assert execution["based_on_core_anchor_revision_number"] == 1
    assert execution["upstream_relationship_available"] is True
    assert execution["context_state"] == "current"
    assert execution["execution_boundary"] == "Exposure remains inside the approved range."
    assert body["attention"]["level"] == "not_assessed"


async def test_cg_separates_no_role_action_from_pending_vfx_review(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _project_shot_task(client)
    await _confirm_core(client, shot_id)
    await _confirm_execution(client, task_id)
    await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX)

    response = await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)

    assert response.status_code == 200
    body = response.json()
    assert body["next_action"]["title"] == "No immediate CG action"
    assert body["next_action"]["executable"] is False
    assert body["core_anchor"]["pending_human_gate_exists"] is True

    summaries = (await client.get("/cg/anchor-contexts?scope=waiting&limit=5", headers=CG)).json()
    summary = next(item for item in summaries["items"] if item["task_id"] == task_id)
    assert summary["readiness_state"] == "waiting_upstream"
    assert "VFX review" in summary["readiness_detail"]


async def test_artist_high_attention_pause_overrides_continue_action(
    client: AsyncClient, monkeypatch
) -> None:
    shot_id, task_id = await _project_shot_task(client)
    await _confirm_core(client, shot_id)
    await _confirm_execution(client, task_id)

    async def high_attention(*_args, **_kwargs) -> AnchorAttentionContextRead:
        return AnchorAttentionContextRead(
            level="high",
            summary="The current pass may break the restrained intent.",
            review_requirement="Pause this direction and request supervisor clarification.",
            source_assessment_id=None,
            source_signal_id=None,
            assessed_at=None,
            link_target=None,
        )

    async def current_guidance_item(*_args, **_kwargs):
        return SimpleNamespace(
            task_id=uuid.UUID(task_id),
            guidance_state="current",
            latest_version_id=None,
            latest_version_name=None,
            latest_version_number=None,
            current_focus=SimpleNamespace(
                focus_type="none",
                title="Nothing requires your attention on this Task right now",
                explanation="Nothing requires your attention on this Task right now.",
                target_route=f"/artist/tasks/{task_id}",
                primary_action_label=None,
                actionable=False,
            ),
        )

    monkeypatch.setattr(anchor_context_service, "_attention_context", high_attention)
    monkeypatch.setattr(
        anchor_context_service.artist_inbox_service,
        "get_inbox_item_for_task",
        current_guidance_item,
    )

    response = await client.get(f"/artist/tasks/{task_id}/anchor-context", headers=ARTIST)

    assert response.status_code == 200
    action = response.json()["next_action"]
    assert action["title"] == "Pause and request CG clarification"
    assert action["executable"] is False
    assert "break the restrained intent" in action["why_now"]
    assert "Continue" not in action["title"]


async def test_artist_context_marks_old_execution_after_core_revision(client: AsyncClient) -> None:
    shot_id, task_id = await _project_shot_task(client)
    await _confirm_core(client, shot_id)
    await _confirm_execution(client, task_id)
    revision_two = (
        await client.post(f"/intent/shots/{shot_id}/core-anchor/drafts/from-confirmed", headers=VFX)
    ).json()
    await client.post(
        f"/intent/core-anchor-revisions/{revision_two['id']}/confirm",
        json={},
        headers=VFX,
    )

    response = await client.get(f"/artist/tasks/{task_id}/anchor-context", headers=ARTIST)

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "artist"
    assert body["execution_anchor"]["context_state"] == "outdated"
    assert body["guidance_state"] == "missing"
    assert body["attention"]["level"] == "not_assessed"
    assert body["core_anchor"]["confirmed_revision_number"] == 2


async def test_cg_context_reports_only_real_open_vfx_escalation(
    client: AsyncClient,
) -> None:
    _shot_id, task_id = await _project_shot_task(client)
    escalation = await client.post(
        f"/tasks/{task_id}/escalate",
        json={"description": "VFX intent clarification is required."},
        headers=CG,
    )
    assert escalation.status_code == 201

    response = await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)

    assert response.status_code == 200
    assert response.json()["open_vfx_escalation"] is True


async def test_missing_objects_return_not_found(client: AsyncClient) -> None:
    missing = uuid.uuid4()
    assert (
        await client.get(f"/vfx/shots/{missing}/anchor-context", headers=VFX)
    ).status_code == 404
    assert (await client.get(f"/cg/tasks/{missing}/anchor-context", headers=CG)).status_code == 404


async def test_compact_summary_is_bounded_and_preserves_backend_order(
    client: AsyncClient,
) -> None:
    await _project_shot_task(client)
    await _project_shot_task(client)
    await _project_shot_task(client)
    inbox = (await client.get("/vfx/inbox")).json()["items"]

    response = await client.get("/vfx/anchor-contexts?limit=2&scope=all", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 2
    assert body["total_count"] == 3
    assert len(body["items"]) == 2
    assert [item["shot_id"] for item in body["items"]] == [item["shot_id"] for item in inbox[:2]]
    assert "must_preserve" not in body["items"][0]


async def test_compact_summary_endpoints_enforce_role_scope(client: AsyncClient) -> None:
    await _project_shot_task(client)

    assert (await client.get("/vfx/anchor-contexts", headers=CG)).status_code == 403
    assert (await client.get("/cg/anchor-contexts", headers=ARTIST)).status_code == 403
    assert (await client.get("/artist/anchor-contexts", headers=VFX)).status_code == 403
    assert (await client.get("/artist/anchor-contexts")).status_code == 401


async def test_artist_summary_separates_waiting_from_attention(
    client: AsyncClient,
) -> None:
    _shot_id, task_id = await _project_shot_task(client)

    response = await client.get("/artist/anchor-contexts?limit=5&scope=waiting", headers=ARTIST)

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["task_id"] == task_id
    assert item["attention_level"] == "not_assessed"
    assert item["readiness_state"] == "waiting_upstream"
    assert item["next_action"]["title"] == "Core Anchor confirmation is required"
    assert "Nothing requires your attention" not in item["readiness_detail"]
