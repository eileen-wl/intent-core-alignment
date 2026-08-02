"""Step 9B-1: `GET /intent/execution-anchor-revisions/{id}/decisions` --
the Execution Anchor analogue of the existing Core Anchor endpoint
(`test_core_anchor_decisions_list.py`), added so CG's Current Execution
Direction summary can honestly show the real confirm/reject rationale.
Reuses `decision_service.list_decisions_for_entity` unchanged -- no new
service logic, no migration, no mutation.

Step 9B-1 correction: this endpoint is role-gated
(`docs/ROLE_PERMISSIONS.md` §2's "Read Secondary Execution Anchor" row
grants both CG Supervisor and VFX Supervisor an unconditional "Yes") --
`test_authorization_*` below covers the allowed/rejected/missing/invalid
role matrix. The Core Anchor decisions endpoint this one mirrors is
deliberately left unguarded (an existing, already-named characteristic,
out of this narrow correction's scope).
"""

from __future__ import annotations

from typing import Any

from httpx import AsyncClient

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}


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


async def _confirmed_revision(client: AsyncClient, **content: str) -> tuple[str, str]:
    """Returns (task_id, revision_id) for a real confirmed Execution
    Anchor revision, real Core Anchor prerequisite included. A default
    non-empty `technical_boundaries` is supplied when the caller passes
    no content -- an all-blank draft is real, existing, correctly
    rejected content (422) at confirm time, unrelated to this file's
    own authorization concern."""
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    if not content:
        content = {"technical_boundaries": "24fps, no motion blur."}
    draft = await _create_execution_draft(client, task_id, **content)
    confirmed = (
        await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "matches the confirmed Core Anchor"},
            headers=CG,
        )
    ).json()
    assert confirmed["status"] == "confirmed"
    return task_id, draft["id"]


async def test_list_decisions_is_empty_for_a_draft_with_no_decision_yet(
    client: AsyncClient,
) -> None:
    shot_id = await _create_shot(client)
    await _confirm_core_anchor(client, shot_id)
    task_id = await _create_task(client, shot_id)
    draft = await _create_execution_draft(client, task_id)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/decisions", headers=CG
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_list_decisions_is_empty_for_an_unknown_revision(client: AsyncClient) -> None:
    response = await client.get(
        "/intent/execution-anchor-revisions/00000000-0000-0000-0000-000000000000/decisions",
        headers=CG,
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

    response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/decisions", headers=CG
    )
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
    assert decision["supersedes_decision_id"] is None
    # No write/mutation side effect from this read: the revision itself
    # is unchanged by calling the decisions endpoint a second time.
    revision_after = await client.get(f"/intent/execution-anchor-revisions/{draft['id']}")
    assert revision_after.json()["status"] == "confirmed"
    repeat = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/decisions", headers=CG
    )
    assert repeat.json() == decisions


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

    response = await client.get(
        f"/intent/execution-anchor-revisions/{draft['id']}/decisions", headers=CG
    )
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
        await client.get(f"/intent/execution-anchor-revisions/{draft1['id']}/decisions", headers=CG)
    ).json()
    draft2_decisions = (
        await client.get(f"/intent/execution-anchor-revisions/{draft2['id']}/decisions", headers=CG)
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
        await client.get(
            f"/intent/execution-anchor-revisions/{first_draft['id']}/decisions", headers=CG
        )
    ).json()
    second_decisions = (
        await client.get(
            f"/intent/execution-anchor-revisions/{second_draft['id']}/decisions", headers=CG
        )
    ).json()

    assert len(first_decisions) == 1
    assert first_decisions[0]["rationale"] == "first confirmation"
    assert len(second_decisions) == 1
    assert second_decisions[0]["rationale"] == "second confirmation"


# --- Step 9B-1 correction: authorization matrix -----------------------------


async def test_authorization_allows_cg_supervisor(client: AsyncClient) -> None:
    """CG Supervisor is the primary, required reader -- the existing CG
    Task Overview's Current Execution Direction summary depends on it."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions", headers=CG
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


async def test_authorization_allows_vfx_supervisor(client: AsyncClient) -> None:
    """VFX Supervisor is intentionally allowed: `docs/ROLE_PERMISSIONS.md`
    §2's "Read Secondary Execution Anchor" row grants VFX Supervisor an
    unconditional "Yes" (the same unconditional grant CG Supervisor has)
    -- reading this Decision is reading part of the Execution Anchor's
    own real confirmation provenance, not a separate CG-only concept.
    Unlike Artist's conditional "Yes, when relevant" row, VFX's grant is
    unconditional, so no additional Task-relevance scoping is required
    to honour it here."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions", headers=VFX
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


async def test_authorization_rejects_artist(client: AsyncClient) -> None:
    """Artist's own row is conditional ("Yes, when relevant"), which this
    endpoint cannot evaluate without Task-relevance context this narrow
    fix does not add -- Artist must not gain unrestricted access, so
    Artist is rejected outright rather than given a blanket grant."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions", headers=ARTIST
    )
    assert response.status_code == 403


async def test_authorization_rejects_missing_role_header(client: AsyncClient) -> None:
    """Matches the repository's existing convention exactly:
    `get_current_actor` raises 401 (not 403) when `X-Actor-Role` is
    absent -- this is an identity failure, not a permission decision."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(f"/intent/execution-anchor-revisions/{revision_id}/decisions")
    assert response.status_code == 401


async def test_authorization_rejects_invalid_role_header(client: AsyncClient) -> None:
    """A role string outside the real `HumanRole` literal set is treated
    identically to a missing one -- 401, per `get_current_actor`'s own
    existing check, never silently coerced or ignored."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions",
        headers={"X-Actor-Role": "producer", "X-Actor-Id": "someone-1"},
    )
    assert response.status_code == 401


async def test_authorization_rejects_missing_actor_id_with_a_valid_role(
    client: AsyncClient,
) -> None:
    """A syntactically valid role with no actor id is still an identity
    failure -- 401, matching `get_current_actor`'s own existing check."""
    _task_id, revision_id = await _confirmed_revision(client)

    response = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions",
        headers={"X-Actor-Role": "cg_supervisor"},
    )
    assert response.status_code == 401


async def test_authorization_rejection_creates_no_row_and_leaks_no_content(
    client: AsyncClient,
) -> None:
    """A rejected (403) request must have no side effect at all -- no
    Decision row created or mutated, and the real Decision content is
    not present anywhere in the 403 response body."""
    _task_id, revision_id = await _confirmed_revision(client, technical_boundaries="secret plan")

    rejected = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions", headers=ARTIST
    )
    assert rejected.status_code == 403
    assert "matches the confirmed Core Anchor" not in rejected.text

    # The real Decision is still exactly one row, unchanged, when read
    # by an authorised role afterward -- the rejected attempt created
    # nothing and mutated nothing.
    allowed = await client.get(
        f"/intent/execution-anchor-revisions/{revision_id}/decisions", headers=CG
    )
    assert len(allowed.json()) == 1
