from __future__ import annotations

import uuid

from httpx import AsyncClient
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent.models import CoreAnchor, ExecutionAnchor
from intent_core_api.versions_and_feedback.models import AlignmentAssessment
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


async def _create_shot_with_confirmed_core_anchor(
    client: AsyncClient, *, suffix: str = "1"
) -> dict[str, str]:
    # /projects and /shots dedupe by (source, external_id) -- each caller
    # that needs a genuinely distinct Shot must pass a distinct suffix.
    project = (
        await client.post(
            "/projects",
            json={
                "name": "Napo (Animation demo)",
                "source": "ftrack",
                "external_id": f"ft-p-{suffix}",
            },
        )
    ).json()
    shot = (
        await client.post(
            "/shots",
            json={
                "project_id": project["id"],
                "name": f"bc00{suffix}",
                "source": "ftrack",
                "external_id": f"ft-s-{suffix}",
            },
        )
    ).json()
    await client.post(
        "/intent/briefs",
        json={"shot_id": shot["id"], "raw_text": "A restrained, cinematic chase."},
        headers=VFX,
    )
    draft = (await client.post(f"/intent/shots/{shot['id']}/core-anchor/generate")).json()
    confirmed = (
        await client.post(
            f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX
        )
    ).json()
    return {"shot_id": shot["id"], "core_anchor_revision_id": confirmed["id"]}


async def _create_version_with_review_note(client: AsyncClient, shot_id: str) -> str:
    version = (
        await client.post(
            "/versions",
            json={
                "shot_id": shot_id,
                "name": "bc0040_render_v002",
                "description": "Increases camera shake and contrast in the final section.",
            },
            headers=VFX,
        )
    ).json()
    await client.post(
        f"/versions/{version['id']}/review-notes",
        json={"content": "The shake feels too aggressive."},
        headers=VFX,
    )
    return str(version["id"])


async def _generate_assessment(client: AsyncClient, version_id: str) -> dict[str, str]:
    response = await client.post(f"/versions/{version_id}/assessments/generate")
    assert response.status_code == 201
    result: dict[str, str] = response.json()
    return result


async def _create_shot_with_assessment(client: AsyncClient) -> dict[str, str]:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])
    assessment = await _generate_assessment(client, version_id)
    return {**ids, "version_id": version_id, "assessment_id": assessment["id"]}


async def test_vfx_supervisor_can_accept_an_assessment(client: AsyncClient) -> None:
    ids = await _create_shot_with_assessment(client)

    response = await client.post(
        f"/assessments/{ids['assessment_id']}/accept",
        json={"rationale": "matches the confirmed tone"},
        headers=VFX,
    )

    assert response.status_code == 201
    decision = response.json()
    assert decision["decision_type"] == "accept_alignment_assessment"
    assert decision["entity_type"] == "alignment_assessment"
    assert decision["entity_id"] == ids["assessment_id"]
    assert decision["owning_human_role"] == "vfx_supervisor"
    assert decision["actor_kind"] == "human"
    assert decision["actor_id"] == "vfx-1"
    assert decision["actor_human_role"] == "vfx_supervisor"
    assert decision["rationale"] == "matches the confirmed tone"
    assert decision["write_back_requested"] is False
    assert decision["supersedes_decision_id"] is None


async def test_vfx_supervisor_can_reject_an_assessment(client: AsyncClient) -> None:
    ids = await _create_shot_with_assessment(client)

    response = await client.post(
        f"/assessments/{ids['assessment_id']}/reject",
        json={"rationale": "shake is too aggressive"},
        headers=VFX,
    )

    assert response.status_code == 201
    decision = response.json()
    assert decision["decision_type"] == "reject_alignment_assessment"
    assert decision["entity_type"] == "alignment_assessment"
    assert decision["rationale"] == "shake is too aggressive"


async def test_decide_leaves_the_assessment_itself_unchanged(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_assessment(client)
    before = (await client.get(f"/assessments/{ids['assessment_id']}")).json()

    await client.post(f"/assessments/{ids['assessment_id']}/accept", json={}, headers=VFX)

    after = (await client.get(f"/assessments/{ids['assessment_id']}")).json()
    assert after == before
    assert len((await session.execute(select(AlignmentAssessment))).scalars().all()) == 1


async def test_deciding_the_same_assessment_twice_returns_conflict_and_no_duplicate(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_assessment(client)
    await client.post(f"/assessments/{ids['assessment_id']}/accept", json={}, headers=VFX)

    response = await client.post(
        f"/assessments/{ids['assessment_id']}/reject", json={}, headers=VFX
    )

    assert response.status_code == 409
    decisions = (
        (
            await session.execute(
                select(Decision).where(Decision.entity_id == uuid.UUID(ids["assessment_id"]))
            )
        )
        .scalars()
        .all()
    )
    assert len(decisions) == 1
    assert decisions[0].decision_type == "accept_alignment_assessment"


async def test_cg_supervisor_and_artist_cannot_decide(client: AsyncClient) -> None:
    ids = await _create_shot_with_assessment(client)

    for headers in (CG, ARTIST):
        response = await client.post(
            f"/assessments/{ids['assessment_id']}/accept", json={}, headers=headers
        )
        assert response.status_code == 403


async def test_missing_or_invalid_actor_headers_are_rejected(client: AsyncClient) -> None:
    ids = await _create_shot_with_assessment(client)

    no_headers = await client.post(f"/assessments/{ids['assessment_id']}/accept", json={})
    assert no_headers.status_code == 401

    invalid_role = await client.post(
        f"/assessments/{ids['assessment_id']}/accept",
        json={},
        headers={"X-Actor-Role": "not_a_role", "X-Actor-Id": "x"},
    )
    assert invalid_role.status_code == 401


async def test_list_decisions_returns_only_this_assessments_decisions(client: AsyncClient) -> None:
    ids = await _create_shot_with_assessment(client)
    await client.post(f"/assessments/{ids['assessment_id']}/accept", json={}, headers=VFX)

    response = await client.get(f"/assessments/{ids['assessment_id']}/decisions")
    assert response.status_code == 200
    decisions = response.json()
    assert len(decisions) == 1
    assert decisions[0]["entity_id"] == ids["assessment_id"]
    assert decisions[0]["entity_type"] == "alignment_assessment"


async def test_supersession_chain_across_assessments_for_the_same_shot(
    client: AsyncClient,
) -> None:
    ids = await _create_shot_with_confirmed_core_anchor(client)
    version_id = await _create_version_with_review_note(client, ids["shot_id"])

    first_assessment = await _generate_assessment(client, version_id)
    first_decision = (
        await client.post(f"/assessments/{first_assessment['id']}/accept", json={}, headers=VFX)
    ).json()
    assert first_decision["supersedes_decision_id"] is None

    second_assessment = await _generate_assessment(client, version_id)
    second_decision = (
        await client.post(f"/assessments/{second_assessment['id']}/reject", json={}, headers=VFX)
    ).json()
    # An accept can be superseded by a reject -- supersession tracks the
    # latest judgment for the Shot, not "latest of the same type".
    assert second_decision["supersedes_decision_id"] == first_decision["id"]

    # The first Decision is untouched and still independently readable.
    first_readback = (await client.get(f"/assessments/{first_assessment['id']}/decisions")).json()
    assert len(first_readback) == 1
    assert first_readback[0] == first_decision

    third_assessment = await _generate_assessment(client, version_id)
    third_decision = (
        await client.post(f"/assessments/{third_assessment['id']}/accept", json={}, headers=VFX)
    ).json()
    # A clean chain: the third Decision supersedes the *second* (the
    # current unsuperseded head), not always the first.
    assert third_decision["supersedes_decision_id"] == second_decision["id"]
    assert third_decision["supersedes_decision_id"] != first_decision["id"]


async def test_decision_on_another_shot_does_not_join_the_supersession_chain(
    client: AsyncClient,
) -> None:
    ids_a = await _create_shot_with_confirmed_core_anchor(client, suffix="a")
    version_a = await _create_version_with_review_note(client, ids_a["shot_id"])
    assessment_a = await _generate_assessment(client, version_a)
    decision_a = (
        await client.post(f"/assessments/{assessment_a['id']}/accept", json={}, headers=VFX)
    ).json()

    ids_b = await _create_shot_with_confirmed_core_anchor(client, suffix="b")
    version_b = await _create_version_with_review_note(client, ids_b["shot_id"])
    assessment_b = await _generate_assessment(client, version_b)

    decision_b = (
        await client.post(f"/assessments/{assessment_b['id']}/reject", json={}, headers=VFX)
    ).json()

    assert decision_b["supersedes_decision_id"] is None
    assert decision_b["supersedes_decision_id"] != decision_a["id"]


async def test_decide_touches_no_other_domain_state(
    client: AsyncClient, session: AsyncSession
) -> None:
    ids = await _create_shot_with_assessment(client)
    snapshots_before = len((await session.execute(select(ContextSnapshot))).scalars().all())
    runs_before = len((await session.execute(select(AgentRun))).scalars().all())

    await client.post(f"/assessments/{ids['assessment_id']}/accept", json={}, headers=VFX)

    assert (await session.execute(select(ExecutionAnchor))).scalars().all() == []
    assert (await session.execute(select(WritebackRecord))).scalars().all() == []
    assert len((await session.execute(select(ContextSnapshot))).scalars().all()) == snapshots_before
    assert len((await session.execute(select(AgentRun))).scalars().all()) == runs_before
    assert len((await session.execute(select(AlignmentAssessment))).scalars().all()) == 1

    anchors = (await session.execute(select(CoreAnchor))).scalars().all()
    assert len(anchors) == 1
    assert str(anchors[0].active_revision_id) == ids["core_anchor_revision_id"]


async def test_decide_for_unknown_assessment_returns_404(client: AsyncClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"
    response = await client.post(f"/assessments/{unknown}/accept", json={}, headers=VFX)
    assert response.status_code == 404
