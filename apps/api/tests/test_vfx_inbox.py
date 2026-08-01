"""GET /vfx/inbox and GET /vfx/inbox/{shot_id} (Step 7C-1).

Builds real prerequisite chains through the real HTTP endpoints (same
pattern as test_cross_role_assessment.py's `_build_ready_shot`) rather
than raw model construction, so these tests exercise the same code path
the VFX Inbox service itself reads from.
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def _create_brief(client: AsyncClient, shot_id: str) -> None:
    response = await client.post(
        "/intent/briefs",
        json={"shot_id": shot_id, "raw_text": "A restrained, cinematic chase scene."},
        headers=VFX,
    )
    assert response.status_code == 201


async def _create_draft_core_anchor(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"core_summary": "A quiet, controlled chase."},
        headers=VFX,
    )
    assert response.status_code == 201
    return response.json()


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> dict[str, Any]:
    draft = await _create_draft_core_anchor(client, shot_id)
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Compositing") -> str:
    task = (
        await client.post("/tasks", json={"shot_id": shot_id, "name": name, "department": "comp"})
    ).json()
    return str(task["id"])


async def _create_confirmed_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
    draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts",
            json={"technical_boundaries": "24fps, no motion blur."},
            headers=CG,
        )
    ).json()
    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm", json={}, headers=CG
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return confirmed


async def _create_version(client: AsyncClient, shot_id: str, name: str = "SH010_v001") -> str:
    version = (
        await client.post(
            "/versions",
            json={"shot_id": shot_id, "name": name, "description": "First pass."},
            headers=VFX,
        )
    ).json()
    return str(version["id"])


async def _create_review_note(client: AsyncClient, version_id: str) -> None:
    response = await client.post(
        f"/versions/{version_id}/review-notes",
        json={"content": "Tighten the timing on the push-in."},
        headers=VFX,
    )
    assert response.status_code == 201


async def _generate_vfx_review(client: AsyncClient, version_id: str) -> None:
    response = await client.post(
        f"/intent/versions/{version_id}/vfx-supervisor-reviews/generate", headers=VFX
    )
    assert response.status_code == 201


async def _generate_cg_review(client: AsyncClient, revision_id: str) -> None:
    response = await client.post(
        f"/intent/execution-anchor-revisions/{revision_id}/cg-supervisor-reviews/generate",
        headers=CG,
    )
    assert response.status_code == 201


async def _generate_artist_guidance(client: AsyncClient, version_id: str, task_id: str) -> None:
    response = await client.post(
        f"/intent/versions/{version_id}/artist-guidances/generate",
        json={"task_id": task_id},
        headers=ARTIST,
    )
    assert response.status_code == 201


async def _build_ready_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str, str, str]:
    _project_id, shot_id = await _create_project_and_shot(client, shot_name)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    confirmed_revision = await _create_confirmed_execution_anchor(client, task_id)
    version_id = await _create_version(client, shot_id)
    await _generate_vfx_review(client, version_id)
    await _generate_cg_review(client, confirmed_revision["id"])
    await _generate_artist_guidance(client, version_id, task_id)
    return shot_id, task_id, confirmed_revision["id"], version_id


async def _generate_assessment(
    client: AsyncClient, version_id: str, task_id: str
) -> dict[str, Any]:
    response = await client.post(
        f"/intent/versions/{version_id}/cross-role-assessments/generate",
        json={"task_id": task_id},
        headers=VFX,
    )
    assert response.status_code == 201
    return response.json()


async def test_empty_inbox_is_honest(client: AsyncClient) -> None:
    response = await client.get("/vfx/inbox")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert "generated_at" in body


async def test_shot_with_no_core_anchor_is_focus_none(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)

    response = await client.get("/vfx/inbox")
    body = response.json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["shot_id"] == shot_id
    assert item["current_focus"]["focus_type"] == "none"
    assert item["current_focus"]["actionable"] is False
    assert item["core_anchor_state"] == "none"


async def test_pending_core_anchor_gate_is_top_focus(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _create_brief(client, shot_id)
    draft = await _create_draft_core_anchor(client, shot_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    assert response.status_code == 200
    item = response.json()
    assert item["current_focus"]["focus_type"] == "core_anchor_gate_pending"
    assert item["pending_human_gate_id"] is not None
    assert item["core_anchor_state"] == "draft_pending"
    assert item["active_core_anchor_revision_id"] is None
    assert draft["status"] == "draft"


async def test_confirmed_core_anchor_no_assessment_yet_shows_source_and_summary(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _create_brief(client, shot_id)
    confirmed = await _confirm_core_anchor(client, shot_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["core_anchor_state"] == "confirmed"
    assert item["active_core_anchor_revision_id"] == confirmed["id"]
    assert item["active_core_anchor_summary"] == "A quiet, controlled chase."
    assert item["shot_source"] == "manual"


async def test_independent_task_version_display_before_any_assessment(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id, name="Lighting")
    version_id = await _create_version(client, shot_id, name="SH010_v001")

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    # Independent facts, never implied as an established pairing.
    assert item["pairing_established"] is False
    assert item["relevant_task_id"] == task_id
    assert item["relevant_version_id"] == version_id


async def test_zero_task_zero_version_is_honest_absence(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["relevant_task_id"] is None
    assert item["relevant_task_name"] is None
    assert item["relevant_version_id"] is None
    assert item["relevant_version_name"] is None
    assert item["pairing_established"] is False


async def test_assessment_generation_available_focus(client: AsyncClient) -> None:
    shot_id, _task_id, _revision_id, _version_id = await _build_ready_shot(client)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["current_focus"]["focus_type"] == "assessment_generation_available"


async def test_generation_ready_pair_is_the_real_qualifying_task_and_version(
    client: AsyncClient,
) -> None:
    shot_id, task_id, _revision_id, version_id = await _build_ready_shot(client)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    # Distinct from relevant_task_id/relevant_version_id (independently
    # "latest") -- this is the one real pair generation would actually
    # succeed against.
    assert item["generation_ready_task_id"] == task_id
    assert item["generation_ready_version_id"] == version_id


async def test_generation_ready_pair_absent_once_an_assessment_exists(
    client: AsyncClient,
) -> None:
    shot_id, task_id, _revision_id, version_id = await _build_ready_shot(client)
    await _generate_assessment(client, version_id, task_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["generation_ready_task_id"] is None
    assert item["generation_ready_version_id"] is None


async def test_generation_ready_pair_absent_when_prerequisites_are_not_met(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _create_brief(client, shot_id)
    await _confirm_core_anchor(client, shot_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["generation_ready_task_id"] is None
    assert item["generation_ready_version_id"] is None


async def test_latest_version_without_review_is_honestly_flagged(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_version(client, shot_id, name="SH010_v001")

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["latest_version_without_review_id"] == version_id
    assert item["latest_version_without_review_name"] == "SH010_v001"


async def test_latest_version_without_review_clears_once_a_review_note_exists(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    version_id = await _create_version(client, shot_id, name="SH010_v001")
    await _create_review_note(client, version_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["latest_version_without_review_id"] is None
    assert item["latest_version_without_review_name"] is None


async def test_latest_version_without_review_absent_for_a_shot_with_no_versions(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["latest_version_without_review_id"] is None


async def test_latest_version_without_review_only_considers_the_newest_version(
    client: AsyncClient,
) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)
    older_version_id = await _create_version(client, shot_id, name="SH010_v001")
    await _create_review_note(client, older_version_id)
    newer_version_id = await _create_version(client, shot_id, name="SH010_v002")

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    # The older, already-reviewed Version never re-surfaces once a newer
    # Version exists -- only the Shot's real latest Version is checked.
    assert item["latest_version_without_review_id"] == newer_version_id


async def test_explicit_assessment_pairing_after_generation(client: AsyncClient) -> None:
    shot_id, task_id, _revision_id, version_id = await _build_ready_shot(client)
    assessment = await _generate_assessment(client, version_id, task_id)

    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["pairing_established"] is True
    assert item["relevant_task_id"] == task_id
    assert item["relevant_version_id"] == version_id
    assert item["latest_assessment_id"] == assessment["id"]
    assert item["latest_signal_attention_level"] in ("low", "medium", "high")
    assert item["latest_signal_summary"]
    # Predicate correction: once a successful CrossRoleAssessment exists
    # for this Shot, `assessment_generation_available` can never be the
    # outcome -- that type's eligibility requires no Assessment to exist
    # yet (see current_focus.py's `_eligible_focus_candidates`).
    assert item["current_focus"]["focus_type"] in (
        "alignment_not_followed_by_anchor_action",
        "re_anchor_proposal_present",
        "none",
    )


async def test_no_duplicate_shot_rows(client: AsyncClient) -> None:
    await _create_project_and_shot(client, "SH010")
    await _create_project_and_shot(client, "SH020")

    response = await client.get("/vfx/inbox")
    body = response.json()
    shot_ids = [item["shot_id"] for item in body["items"]]
    assert len(shot_ids) == len(set(shot_ids))
    assert len(shot_ids) == 2


async def test_sort_precedence_pending_gate_before_none(client: AsyncClient) -> None:
    _project_id, plain_shot_id = await _create_project_and_shot(client, "SH_PLAIN")
    _project_id2, gated_shot_id = await _create_project_and_shot(client, "SH_GATED")
    await _create_brief(client, gated_shot_id)
    await _create_draft_core_anchor(client, gated_shot_id)

    response = await client.get("/vfx/inbox")
    body = response.json()
    shot_ids_in_order = [item["shot_id"] for item in body["items"]]
    assert shot_ids_in_order.index(gated_shot_id) < shot_ids_in_order.index(plain_shot_id)


async def test_unknown_shot_returns_404(client: AsyncClient) -> None:
    response = await client.get("/vfx/inbox/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


async def test_domain_source_never_shows_demo(client: AsyncClient) -> None:
    """Even if a Shot were seed-resolved via a "demo"-sourced
    ExternalEntityLink, RecordSource itself must stay manual/ftrack --
    this test constructs a plain manual Shot (the only path available
    through this router today) and asserts the Inbox never invents a
    third value.
    """
    _project_id, shot_id = await _create_project_and_shot(client)
    response = await client.get(f"/vfx/inbox/{shot_id}")
    item = response.json()
    assert item["shot_source"] in ("manual", "ftrack")
