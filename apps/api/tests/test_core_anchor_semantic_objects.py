"""Core Anchor semantic-child objects (Step 1A): Constraint/
VariationZone/DriftRisk/AnchorReference/OpenQuestion.

Compact, representative coverage -- not an enterprise-scale permutation
matrix (see docs/STEP_1A_PLAN.md). Existing Core Anchor lifecycle/
concurrency/locking/staleness tests already prove no regression
separately; this file only proves the new behaviour.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.audit.models import AuditEvent
from intent_core_api.integrations.models import WritebackRecord
from intent_core_api.intent import core_anchor_service
from intent_core_api.intent.models import (
    AnchorReference,
    Constraint,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    OpenQuestion,
    VariationZone,
)
from intent_core_api.production_context.models import Project, Shot
from intent_core_api.workflow.actors import ActorContext, build_agent_actor
from intent_core_api.workflow.exceptions import ForbiddenActionError
from intent_core_api.workflow.models import Decision
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")

_ALL_COLLECTIONS_PAYLOAD: dict[str, Any] = {
    "constraints": [{"content": "Preserve restrained movement"}],
    "variation_zones": [{"content": "Camera angle may vary"}],
    "drift_risks": [{"description": "Over-lit interpretation"}],
    "references": [{"label": "Ref board", "uri": "https://example.com/board", "note": "mood"}],
    "open_questions": [{"question": "Is the door open or closed?"}],
}


async def _create_shot(client: AsyncClient) -> str:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (await client.post("/shots", json={"project_id": project["id"], "name": "SH010"})).json()
    return str(shot["id"])


async def _create_draft(client: AsyncClient, shot_id: str, **extra: Any) -> dict[str, Any]:
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"shot_objective": "Keep the dread quiet", **extra},
        headers=VFX,
    )
    assert response.status_code == 201
    result: dict[str, Any] = response.json()
    return result


async def test_vfx_can_create_draft_with_all_five_collections(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, **_ALL_COLLECTIONS_PAYLOAD)

    assert [c["content"] for c in draft["constraints"]] == ["Preserve restrained movement"]
    assert [c["content"] for c in draft["variation_zones"]] == ["Camera angle may vary"]
    assert [d["description"] for d in draft["drift_risks"]] == ["Over-lit interpretation"]
    assert draft["references"][0]["label"] == "Ref board"
    assert draft["references"][0]["uri"] == "https://example.com/board"
    assert [q["question"] for q in draft["open_questions"]] == ["Is the door open or closed?"]
    all_collections = (
        "constraints",
        "variation_zones",
        "drift_risks",
        "references",
        "open_questions",
    )
    for collection in all_collections:
        for item in draft[collection]:
            assert item["order_index"] == 0
            uuid.UUID(item["id"])
            assert item["created_at"]


async def test_update_replaces_one_collection_others_unchanged(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(
        client,
        shot_id,
        constraints=[{"content": "a"}],
        variation_zones=[{"content": "b"}],
    )

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "c1"}, {"content": "c2"}]},
        headers=VFX,
    )
    assert response.status_code == 200
    updated = response.json()
    assert [c["content"] for c in updated["constraints"]] == ["c1", "c2"]
    # Omitted collection is untouched.
    assert [v["content"] for v in updated["variation_zones"]] == ["b"]


async def test_explicit_empty_list_clears_only_that_collection(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(
        client,
        shot_id,
        drift_risks=[{"description": "risk"}],
        open_questions=[{"question": "q?"}],
    )

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"drift_risks": []},
        headers=VFX,
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["drift_risks"] == []
    assert [q["question"] for q in updated["open_questions"]] == ["q?"]


async def test_input_array_order_becomes_order_index(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(
        client,
        shot_id,
        constraints=[{"content": "first"}, {"content": "second"}, {"content": "third"}],
    )
    assert [(c["content"], c["order_index"]) for c in draft["constraints"]] == [
        ("first", 0),
        ("second", 1),
        ("third", 2),
    ]


async def test_blank_required_value_rejected(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    response = await client.post(
        f"/intent/shots/{shot_id}/core-anchor/drafts",
        json={"constraints": [{"content": "   "}]},
        headers=VFX,
    )
    assert response.status_code == 422


async def test_cg_supervisor_cannot_modify_core_anchor_semantics(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "hijacked"}]},
        headers=CG,
    )
    assert response.status_code == 403


async def test_artist_cannot_modify_core_anchor_semantics(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "hijacked"}]},
        headers=ARTIST,
    )
    assert response.status_code == 403


async def test_agent_actor_can_carry_semantic_collections_without_confirm_authority(
    session: AsyncSession,
) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()

    agent = build_agent_actor("core_agent", uuid.uuid4())
    revision = await core_anchor_service.create_draft_revision(
        session, agent, shot.id, {"constraints": [{"content": "agent-supplied"}]}
    )
    assert [c.content for c in revision.constraints] == ["agent-supplied"]

    with pytest.raises(ForbiddenActionError):
        await core_anchor_service.confirm_revision(session, agent, revision.id)


async def test_confirmed_revision_semantics_cannot_change(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, constraints=[{"content": "locked"}])
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/confirm", json={}, headers=VFX)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "hijacked"}]},
        headers=VFX,
    )
    assert response.status_code == 409

    revision = (await client.get(f"/intent/core-anchor-revisions/{draft['id']}")).json()
    assert [c["content"] for c in revision["constraints"]] == ["locked"]


async def test_rejected_revision_semantics_cannot_change(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, constraints=[{"content": "locked"}])
    await client.post(f"/intent/core-anchor-revisions/{draft['id']}/reject", json={}, headers=VFX)

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "hijacked"}]},
        headers=VFX,
    )
    assert response.status_code == 409

    revision = (await client.get(f"/intent/core-anchor-revisions/{draft['id']}")).json()
    assert [c["content"] for c in revision["constraints"]] == ["locked"]


async def test_superseded_revision_semantics_cannot_change(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, constraints=[{"content": "v1"}])
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)
    draft2 = await _create_draft(client, shot_id, constraints=[{"content": "v2"}])
    await client.post(f"/intent/core-anchor-revisions/{draft2['id']}/confirm", json={}, headers=VFX)

    revision1 = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    assert revision1["status"] == "superseded"

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft1['id']}",
        json={"constraints": [{"content": "hijacked"}]},
        headers=VFX,
    )
    assert response.status_code == 409
    revision1_after = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    assert [c["content"] for c in revision1_after["constraints"]] == ["v1"]


async def test_new_revision_does_not_mutate_or_share_older_semantic_rows(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    draft1 = await _create_draft(client, shot_id, constraints=[{"content": "v1"}])
    await client.post(f"/intent/core-anchor-revisions/{draft1['id']}/confirm", json={}, headers=VFX)
    draft2 = await _create_draft(client, shot_id, constraints=[{"content": "v2"}])

    revision1 = (await client.get(f"/intent/core-anchor-revisions/{draft1['id']}")).json()
    revision2 = (await client.get(f"/intent/core-anchor-revisions/{draft2['id']}")).json()
    assert [c["content"] for c in revision1["constraints"]] == ["v1"]
    assert [c["content"] for c in revision2["constraints"]] == ["v2"]
    assert revision1["constraints"][0]["id"] != revision2["constraints"][0]["id"]


async def test_existing_revision_with_no_children_reads_as_empty_arrays(
    client: AsyncClient, session: AsyncSession
) -> None:
    """Simulates a pre-Step-1A revision (created directly at the model
    layer, bypassing the service, the way test_core_anchor_concurrency.py
    already does for other invariant tests)."""
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    from intent_core_api.intent.models import CoreAnchor

    anchor = CoreAnchor(shot_id=shot.id)
    session.add(anchor)
    await session.flush()
    revision = CoreAnchorRevision(
        core_anchor_id=anchor.id,
        revision_number=1,
        status="draft",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
    )
    session.add(revision)
    await session.commit()

    response = await client.get(f"/intent/core-anchor-revisions/{revision.id}")
    assert response.status_code == 200
    body = response.json()
    all_collections = (
        "constraints",
        "variation_zones",
        "drift_risks",
        "references",
        "open_questions",
    )
    for collection in all_collections:
        assert body[collection] == []


async def test_get_and_list_endpoints_return_all_five_collections(client: AsyncClient) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, **_ALL_COLLECTIONS_PAYLOAD)

    single = (await client.get(f"/intent/core-anchor-revisions/{draft['id']}")).json()
    listed = (await client.get(f"/intent/shots/{shot_id}/core-anchor/revisions")).json()
    assert len(listed) == 1
    for body in (single, listed[0]):
        assert [c["content"] for c in body["constraints"]] == ["Preserve restrained movement"]
        assert body["references"][0]["label"] == "Ref board"


async def test_semantic_collection_change_appears_in_audit_event(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, constraints=[{"content": "before-value"}])

    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "after-value-1"}, {"content": "after-value-2"}]},
        headers=VFX,
    )
    assert response.status_code == 200

    events = (
        (
            await session.execute(
                select(AuditEvent).where(
                    AuditEvent.entity_id == uuid.UUID(draft["id"]),
                    AuditEvent.action == "core_anchor_revision.updated",
                )
            )
        )
        .scalars()
        .all()
    )
    assert len(events) == 1
    diff = events[0].source_context["changed_fields"]["constraints"]
    assert diff == {"before": ["before-value"], "after": ["after-value-1", "after-value-2"]}


async def test_failed_replacement_is_atomic(session: AsyncSession) -> None:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()

    revision = await core_anchor_service.create_draft_revision(
        session, VFX_ACTOR, shot.id, {"constraints": [{"content": "original"}]}
    )
    # Captured before the failing call below: a rollback expires every
    # attribute on every object already in the session, so `revision.id`
    # itself would need an await to re-read afterward.
    revision_id = revision.id

    # A malformed item (missing the required "content" key) is not
    # reachable through the HTTP contract (pydantic would reject it
    # before the service ever sees it) but proves the replace helper
    # itself is atomic when something does go wrong mid-collection.
    with pytest.raises(KeyError):
        await core_anchor_service.update_draft_revision(
            session,
            VFX_ACTOR,
            revision_id,
            {"constraints": [{"content": "ok"}, {"not_content": "bad"}]},
        )

    rows = (
        (
            await session.execute(
                select(Constraint).where(Constraint.core_anchor_revision_id == revision_id)
            )
        )
        .scalars()
        .all()
    )
    assert [row.content for row in rows] == ["original"]


async def test_editing_semantic_content_does_not_touch_other_entities(
    client: AsyncClient, session: AsyncSession
) -> None:
    shot_id = await _create_shot(client)
    draft = await _create_draft(client, shot_id, constraints=[{"content": "v1"}])

    async def _count(model_cls: Any) -> int:
        return len((await session.execute(select(model_cls))).scalars().all())

    async def _counts() -> dict[str, int]:
        return {
            "execution_anchor": await _count(ExecutionAnchor),
            "execution_anchor_revision": await _count(ExecutionAnchorRevision),
            "decision": await _count(Decision),
            "agent_run": await _count(AgentRun),
            "context_snapshot": await _count(ContextSnapshot),
            "writeback_record": await _count(WritebackRecord),
        }

    before = await _counts()
    response = await client.patch(
        f"/intent/core-anchor-revisions/{draft['id']}",
        json={"constraints": [{"content": "v2"}]},
        headers=VFX,
    )
    assert response.status_code == 200
    after = await _counts()
    assert (
        before
        == after
        == {
            "execution_anchor": 0,
            "execution_anchor_revision": 0,
            "decision": 0,
            "agent_run": 0,
            "context_snapshot": 0,
            "writeback_record": 0,
        }
    )


async def test_variation_zone_and_open_question_and_anchor_reference_models_persist(
    session: AsyncSession,
) -> None:
    """Direct model-layer smoke test: each of the five ORM classes is a
    real, independently queryable table (not just a contract shape)."""
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()

    revision = await core_anchor_service.create_draft_revision(
        session,
        VFX_ACTOR,
        shot.id,
        {
            "variation_zones": [{"content": "vz"}],
            "open_questions": [{"question": "oq?"}],
            "references": [{"label": "lbl", "uri": None, "note": None}],
        },
    )

    vz_rows = (
        (
            await session.execute(
                select(VariationZone).where(VariationZone.core_anchor_revision_id == revision.id)
            )
        )
        .scalars()
        .all()
    )
    oq_rows = (
        (
            await session.execute(
                select(OpenQuestion).where(OpenQuestion.core_anchor_revision_id == revision.id)
            )
        )
        .scalars()
        .all()
    )
    ref_rows = (
        (
            await session.execute(
                select(AnchorReference).where(
                    AnchorReference.core_anchor_revision_id == revision.id
                )
            )
        )
        .scalars()
        .all()
    )
    assert [r.content for r in vz_rows] == ["vz"]
    assert [r.question for r in oq_rows] == ["oq?"]
    assert [r.label for r in ref_rows] == ["lbl"]
    assert ref_rows[0].uri is None
    assert ref_rows[0].note is None
