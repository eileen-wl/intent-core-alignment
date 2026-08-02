"""GET /vfx/shots/{shot_id}/department-execution-overview (Step 9B-3).

Most behaviour is exercised through the real HTTP endpoints (matching
test_vfx_inbox.py's `_build_ready_shot` pattern). A few deterministic
selection rules -- `source_created_at` ordering, a Version explicitly
linked to a different Task, a legacy draft-without-gate revision --
are not reachable through any public API (the public `/versions` create
endpoint never accepts `task_id`/`source_created_at`; every real draft
always opens a HumanGate atomically), so those are exercised at the
model/service layer directly, matching the existing precedent in
test_version_note_sync_metadata.py for exactly this situation.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from httpx import AsyncClient
from intent_core_api.department_execution_overview.service import (
    get_department_execution_overview,
)
from intent_core_api.intent.models import ExecutionAnchor, ExecutionAnchorRevision
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import Version
from intent_core_api.workflow.actors import ActorContext
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_VFX_ACTOR = ActorContext(actor_kind="human", actor_id="vfx-1", human_role="vfx_supervisor")


async def _create_project_and_shot(
    client: AsyncClient, shot_name: str = "SH010"
) -> tuple[str, str]:
    project = (await client.post("/projects", json={"name": "Demo Project"})).json()
    shot = (
        await client.post("/shots", json={"project_id": project["id"], "name": shot_name})
    ).json()
    return str(project["id"]), str(shot["id"])


async def _confirm_core_anchor(client: AsyncClient, shot_id: str) -> None:
    await client.post(
        "/intent/briefs",
        json={"shot_id": shot_id, "raw_text": "A restrained, cinematic chase scene."},
        headers=VFX,
    )
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


async def _create_task(client: AsyncClient, shot_id: str, name: str = "Compositing") -> str:
    task = (
        await client.post("/tasks", json={"shot_id": shot_id, "name": name, "department": "comp"})
    ).json()
    return str(task["id"])


async def _create_execution_anchor_draft(client: AsyncClient, task_id: str) -> dict[str, Any]:
    response = await client.post(
        f"/intent/tasks/{task_id}/execution-anchor/drafts",
        json={"technical_boundaries": "24fps, no motion blur."},
        headers=CG,
    )
    assert response.status_code == 201
    return response.json()


async def _confirm_execution_anchor(client: AsyncClient, task_id: str) -> dict[str, Any]:
    draft = await _create_execution_anchor_draft(client, task_id)
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


async def _build_ready_shot_with_task(client: AsyncClient) -> tuple[str, str]:
    _project_id, shot_id = await _create_project_and_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    return shot_id, task_id


# --- Authorization -----------------------------------------------------


async def test_vfx_supervisor_can_read_overview(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    assert response.status_code == 200
    body = response.json()
    assert body["shot_id"] == shot_id
    assert len(body["tasks"]) == 1
    assert body["tasks"][0]["task_id"] == task_id
    assert "generated_at" in body


async def test_cg_supervisor_is_rejected(client: AsyncClient) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=CG)

    assert response.status_code == 403


async def test_artist_is_rejected(client: AsyncClient) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(
        f"/vfx/shots/{shot_id}/department-execution-overview", headers=ARTIST
    )

    assert response.status_code == 403


async def test_missing_identity_is_rejected(client: AsyncClient) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview")

    assert response.status_code == 401


async def test_invalid_role_is_rejected(client: AsyncClient) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(
        f"/vfx/shots/{shot_id}/department-execution-overview",
        headers={"X-Actor-Role": "not_a_real_role", "X-Actor-Id": "x-1"},
    )

    assert response.status_code == 401


# --- Shot scoping and honest empty/missing states -----------------------


async def test_missing_shot_returns_not_found(client: AsyncClient) -> None:
    response = await client.get(
        f"/vfx/shots/{uuid.uuid4()}/department-execution-overview", headers=VFX
    )

    assert response.status_code == 404


async def test_valid_shot_with_no_tasks_returns_empty_list(client: AsyncClient) -> None:
    _project_id, shot_id = await _create_project_and_shot(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    assert response.status_code == 200
    assert response.json()["tasks"] == []


async def test_only_tasks_for_requested_shot_are_returned(client: AsyncClient) -> None:
    shot_a, task_a = await _build_ready_shot_with_task(client)
    project_b = (await client.post("/projects", json={"name": "Other Project"})).json()
    shot_b_resp = (
        await client.post("/shots", json={"project_id": project_b["id"], "name": "SH020"})
    ).json()
    shot_b = str(shot_b_resp["id"])
    task_b = await _create_task(client, shot_b, name="Lighting")

    response_a = await client.get(f"/vfx/shots/{shot_a}/department-execution-overview", headers=VFX)
    task_ids_a = {task["task_id"] for task in response_a.json()["tasks"]}
    assert task_ids_a == {task_a}
    assert task_b not in task_ids_a

    response_b = await client.get(f"/vfx/shots/{shot_b}/department-execution-overview", headers=VFX)
    task_ids_b = {task["task_id"] for task in response_b.json()["tasks"]}
    assert task_ids_b == {task_b}


async def test_read_only_no_mutation(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)

    first = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    second = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    first_task, second_task = first.json()["tasks"][0], second.json()["tasks"][0]
    assert first_task == second_task

    tasks_response = await client.get(f"/shots/{shot_id}/tasks")
    assert [task["id"] for task in tasks_response.json()] == [task_id]


# --- Execution Anchor state selection ------------------------------------


async def test_no_execution_anchor_state(client: AsyncClient) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["execution_anchor_state"] == "none"
    assert row["execution_anchor_revision_number"] is None


async def test_awaiting_confirmation_execution_anchor_state(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    await _create_execution_anchor_draft(client, task_id)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["execution_anchor_state"] == "awaiting_confirmation"
    assert row["execution_anchor_revision_number"] == 1


async def test_confirmed_execution_anchor_state_is_distinct_from_draft(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    confirmed = await _confirm_execution_anchor(client, task_id)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["execution_anchor_state"] == "confirmed"
    assert row["execution_anchor_revision_number"] == confirmed["revision_number"]
    assert row["execution_anchor_summary"] == "24fps, no motion blur."


async def test_rejected_execution_anchor_state(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    draft = await _create_execution_anchor_draft(client, task_id)
    rejected = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/reject",
            json={"rationale": "Not aligned with the confirmed Core Anchor."},
            headers=CG,
        )
    ).json()
    assert rejected["status"] == "rejected"

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["execution_anchor_state"] == "rejected"


async def test_superseded_revision_is_never_shown_as_current(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    first_confirmed = await _confirm_execution_anchor(client, task_id)

    new_draft = (
        await client.post(
            f"/intent/tasks/{task_id}/execution-anchor/drafts/from-confirmed",
            json={},
            headers=CG,
        )
    ).json()
    second_confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{new_draft['id']}/confirm",
            json={},
            headers=CG,
        )
    ).json()
    assert second_confirmed["status"] == "confirmed"
    assert second_confirmed["revision_number"] != first_confirmed["revision_number"]

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["execution_anchor_state"] == "confirmed"
    assert row["execution_anchor_revision_number"] == second_confirmed["revision_number"]
    assert row["execution_anchor_revision_number"] != first_confirmed["revision_number"]


# --- Current focus: real discriminator, never conflated with escalation ---


async def test_current_focus_type_is_none_when_nothing_needs_cg_action(
    client: AsyncClient,
) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["current_focus_type"] == "none"
    assert row["current_focus_actionable"] is False


async def test_current_focus_type_reflects_the_real_gate_pending_state(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    await _create_execution_anchor_draft(client, task_id)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["current_focus_type"] == "execution_anchor_gate_pending"
    assert row["current_focus_actionable"] is True


async def test_current_focus_type_is_independent_of_escalation_and_advisory_concern(
    client: AsyncClient,
) -> None:
    """A real, persisted escalation must never be inferred from Current
    focus (a CG-owned, unrelated concept) -- and Current focus being
    ``none`` must not be read as "no open escalation" either. Both stay
    real, independently-sourced facts on the same row."""
    shot_id, task_id = await _build_ready_shot_with_task(client)
    await client.post(
        f"/tasks/{task_id}/escalate",
        json={"description": "Lighting cannot proceed without a revised Core Anchor."},
        headers=CG,
    )

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["current_focus_type"] == "none"
    assert row["current_focus_actionable"] is False
    assert row["open_escalation"] is True


# --- Dependencies and escalation ------------------------------------------


async def test_open_dependency_is_reported_and_resolved_dependency_is_not(
    client: AsyncClient,
) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    dependency = (
        await client.post(
            f"/tasks/{task_id}/dependencies",
            json={"kind": "dependency", "description": "Waiting on Layout.", "severity": "high"},
            headers=CG,
        )
    ).json()

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    row = response.json()["tasks"][0]
    assert row["open_dependency_count"] == 1
    assert row["top_open_dependency_description"] == "Waiting on Layout."
    assert row["top_open_dependency_severity"] == "high"

    await client.post(f"/tasks/{task_id}/dependencies/{dependency['id']}/resolve", headers=CG)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    row = response.json()["tasks"][0]
    assert row["open_dependency_count"] == 0
    assert row["top_open_dependency_description"] is None


async def test_real_escalation_is_reported_and_never_inferred(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    row = response.json()["tasks"][0]
    assert row["open_escalation"] is False
    assert row["open_escalation_summary"] is None

    await client.post(
        f"/tasks/{task_id}/escalate",
        json={"description": "Lighting cannot proceed without a revised Core Anchor."},
        headers=CG,
    )

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    row = response.json()["tasks"][0]
    assert row["open_escalation"] is True
    assert (
        row["open_escalation_summary"] == "Lighting cannot proceed without a revised Core Anchor."
    )
    # An escalation is a real TaskDependency, never counted as an open
    # dependency/conflict.
    assert row["open_dependency_count"] == 0


# --- Alignment concern: advisory only -------------------------------------


async def test_alignment_concern_absent_by_default_never_implies_confirmed_alignment(
    client: AsyncClient,
) -> None:
    shot_id, _task_id = await _build_ready_shot_with_task(client)

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)

    row = response.json()["tasks"][0]
    assert row["alignment_concern_summary"] is None
    assert row["alignment_concern_attention_level"] is None


# --- No raw ids leaking into text fields -----------------------------------


async def test_no_raw_uuid_in_visible_summary_fields(client: AsyncClient) -> None:
    shot_id, task_id = await _build_ready_shot_with_task(client)
    await _confirm_execution_anchor(client, task_id)
    await client.post(
        f"/tasks/{task_id}/dependencies",
        json={"kind": "dependency", "description": "Waiting on Layout.", "severity": "low"},
        headers=CG,
    )

    response = await client.get(f"/vfx/shots/{shot_id}/department-execution-overview", headers=VFX)
    row = response.json()["tasks"][0]

    text_fields = [
        row["task_name"],
        row["execution_anchor_summary"],
        row["top_open_dependency_description"],
    ]
    for value in text_fields:
        if value is not None:
            assert str(uuid.UUID(task_id)) not in value
            assert str(uuid.UUID(shot_id)) not in value


# --- Deterministic selection rules only reachable at the model layer ------


async def _create_project_shot(session: AsyncSession) -> Shot:
    project = Project(name="Demo")
    session.add(project)
    await session.flush()
    shot = Shot(project_id=project.id, name="SH010")
    session.add(shot)
    await session.flush()
    return shot


def _version_kwargs(shot_id: uuid.UUID, **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "shot_id": shot_id,
        "name": "v1",
        "version_number": 1,
        "description": "desc",
        "source": "manual",
        "created_by_actor_kind": "human",
        "created_by_actor_id": "vfx-1",
        "created_by_human_role": "vfx_supervisor",
    }
    base.update(overrides)
    return base


async def test_source_created_at_ordering_wins_over_created_at(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    task = Task(shot_id=shot.id, name="Compositing")
    session.add(task)
    await session.flush()

    now = datetime.now(UTC)
    # Ingested recently (created_at is new) but really an old source row
    # (no source_created_at -- a manual row) -- its effective timestamp
    # is just its own `created_at`.
    recent_ingest = Version(
        **_version_kwargs(shot.id, name="Recently ingested", task_id=task.id, created_at=now)
    )
    # Ingested long ago (created_at is old) but the real ftrack source row
    # is genuinely newer than `recent_ingest`'s own `created_at` -- a
    # backfill-synced Version whose `source_created_at` must win.
    backfilled_but_newer = Version(
        **_version_kwargs(
            shot.id,
            name="Backfilled but newer",
            task_id=task.id,
            source="ftrack",
            created_at=now - timedelta(days=30),
            source_created_at=now + timedelta(hours=1),
        )
    )
    session.add_all([recent_ingest, backfilled_but_newer])
    await session.commit()

    overview = await get_department_execution_overview(session, _VFX_ACTOR, shot.id)
    assert overview is not None
    row = overview.tasks[0]
    assert row.latest_version_name == "Backfilled but newer"
    # source_created_at ordering is unaffected by, and independent of, the
    # Version-scope correction: both candidates are Task-linked here.
    assert row.latest_version_scope == "task"


async def test_version_linked_to_a_different_task_is_excluded(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    task_a = Task(shot_id=shot.id, name="Compositing")
    task_b = Task(shot_id=shot.id, name="Lighting")
    session.add_all([task_a, task_b])
    await session.flush()

    version_for_b = Version(**_version_kwargs(shot.id, name="Only for Lighting", task_id=task_b.id))
    session.add(version_for_b)
    await session.commit()

    overview = await get_department_execution_overview(session, _VFX_ACTOR, shot.id)
    assert overview is not None
    row_a = next(row for row in overview.tasks if row.task_id == task_a.id)
    row_b = next(row for row in overview.tasks if row.task_id == task_b.id)
    assert row_a.latest_version_id is None
    assert row_a.latest_version_scope is None
    assert row_b.latest_version_id == version_for_b.id
    assert row_b.latest_version_scope == "task"


async def test_nullable_task_id_version_is_shared_across_tasks(session: AsyncSession) -> None:
    shot = await _create_project_shot(session)
    task_a = Task(shot_id=shot.id, name="Compositing")
    task_b = Task(shot_id=shot.id, name="Lighting")
    session.add_all([task_a, task_b])
    await session.flush()

    shared_manual_version = Version(**_version_kwargs(shot.id, name="Shared manual Version"))
    session.add(shared_manual_version)
    await session.commit()

    overview = await get_department_execution_overview(session, _VFX_ACTOR, shot.id)
    assert overview is not None
    for row in overview.tasks:
        assert row.latest_version_id == shared_manual_version.id
        # A nullable-task_id fallback must be visibly distinguished from a
        # real Task link -- never reported as `"task"` scope.
        assert row.latest_version_scope == "shot_unscoped"


async def test_version_scope_does_not_depend_on_version_name(session: AsyncSession) -> None:
    """Scope must come only from the real `Version.task_id` column --
    never inferred from a name that happens to look Task- or Shot-
    specific (owner-observed example: `bc0040_comp_v003` naming pattern
    must not imply a Task link it does not actually have)."""
    shot = await _create_project_shot(session)
    task = Task(shot_id=shot.id, name="Tracking")
    session.add(task)
    await session.flush()

    unlinked_but_task_shaped_name = Version(
        **_version_kwargs(shot.id, name="bc0040_comp_v003", source="ftrack")
    )
    session.add(unlinked_but_task_shaped_name)
    await session.commit()

    overview = await get_department_execution_overview(session, _VFX_ACTOR, shot.id)
    assert overview is not None
    row = overview.tasks[0]
    assert row.latest_version_name == "bc0040_comp_v003"
    assert row.latest_version_scope == "shot_unscoped"


async def test_legacy_draft_without_gate_reports_draft_state(session: AsyncSession) -> None:
    """Historical revisions created before the HumanGate migration have no
    gate row at all (intent.models.HumanGate's own module docstring) --
    the one `draft` (as opposed to `awaiting_confirmation`) state this
    aggregate can report, not reachable through the live draft-creation
    API since every real draft always opens a gate atomically."""
    shot = await _create_project_shot(session)
    task = Task(shot_id=shot.id, name="Compositing")
    session.add(task)
    await session.flush()

    anchor = ExecutionAnchor(task_id=task.id)
    session.add(anchor)
    await session.flush()
    revision = ExecutionAnchorRevision(
        execution_anchor_id=anchor.id,
        core_anchor_revision_id=uuid.uuid4(),
        revision_number=1,
        status="draft",
        technical_boundaries="Legacy content, predates HumanGate.",
        created_by_actor_kind="human",
        created_by_actor_id="cg-1",
        created_by_human_role="cg_supervisor",
    )
    session.add(revision)
    await session.commit()

    overview = await get_department_execution_overview(session, _VFX_ACTOR, shot.id)
    assert overview is not None
    row = overview.tasks[0]
    assert row.execution_anchor_state == "draft"
    assert row.execution_anchor_revision_number == 1
