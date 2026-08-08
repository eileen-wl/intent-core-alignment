"""Package C journey state-machine regression tests.

Covers CLAUDE_CODE_PACKAGE_C_STATE_MACHINE_REBASE_IMPLEMENTATION.md
Tasks 6-10: referential invariants, the semantic-snapshot read-purity
check, and the J0 -> J1 -> J2 -> J3 transition sequence, all driven
through `demo_seed.d1_journey`'s single canonical graph selector
(`inspect_d1_journey`) and the same real domain actions/endpoints the
product UI itself uses.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import AsyncClient
from intent_core_api.agents import cg_agent_service, model_gateway
from intent_core_api.agents.cross_role_assessment_service import (
    DeterministicCrossRoleAssessmentGenerator,
    generate_cross_role_assessment,
)
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.demo_seed.d1_journey import (
    D1JourneyResult,
    inspect_d1_journey,
    reset_d1_journey,
)
from intent_core_api.demo_seed.d1_scenario import (
    D1_LEGACY_TASK_EXTERNAL_ID,
    DeterministicD1CrossRoleAssessmentGenerator,
    DeterministicD1ExecutionAnchorDraftGenerator,
    ensure_d1_scenario,
    resolve_canonical_d1_assessment_generator,
    resolve_canonical_d1_execution_generator,
)
from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.intent.models import (
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import AgentGenerationError
from intent_core_contracts.api.execution_anchor import ExecutionAnchorRevisionDraftCreate
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

VFX = {"X-Actor-Role": "vfx_supervisor", "X-Actor-Id": "vfx-1"}
CG = {"X-Actor-Role": "cg_supervisor", "X-Actor-Id": "cg-1"}
ARTIST = {"X-Actor-Role": "artist", "X-Actor-Id": "artist-1"}

_SEED_VFX = ActorContext(actor_kind="human", actor_id="test-vfx", human_role="vfx_supervisor")


def _semantic_snapshot(result: D1JourneyResult) -> dict[str, Any]:
    """Stable, comparable journey facts -- everything read-purity must
    leave unchanged. Deliberately excludes `completed_at` (volatile)."""
    return {
        "journey_state": result.journey_state,
        "snapshot": result.snapshot,
        "project_id": result.project_id,
        "shot_id": result.shot_id,
        "task_ids": result.task_ids,
        "version_ids": result.version_ids,
        "counts": dict(result.counts),
        "assessment_ids": result.assessment_ids,
        "proposal_ids": result.proposal_ids,
        "proposal_assessment_ids": dict(result.proposal_assessment_ids),
        "attention_levels": result.attention_levels,
    }


# ---------------------------------------------------------------------------
# Task 8: read-purity regression across every normal GET/page-loader surface
# ---------------------------------------------------------------------------


async def test_read_purity_across_all_normal_pages(
    session: AsyncSession, client: AsyncClient
) -> None:
    reset = await reset_d1_journey(session)
    before = await inspect_d1_journey(session)
    assert before is not None
    snapshot_a = _semantic_snapshot(before)

    animation_task_id, lighting_task_id, comp_task_id = reset.task_ids
    animation_version_id, lighting_version_id, comp_version_id = reset.version_ids

    reads: list[tuple[str, dict[str, str] | None]] = [
        # VFX Home / Inbox / Shots / Shot Overview / Intent / Versions /
        # Alignment / Activity
        ("/vfx/inbox", None),
        (f"/vfx/inbox/{reset.shot_id}", None),
        ("/vfx/anchor-contexts", VFX),
        (f"/vfx/shots/{reset.shot_id}/anchor-context", VFX),
        (f"/vfx/shots/{reset.shot_id}/department-execution-overview", VFX),
        (f"/shots/{reset.shot_id}/versions", None),
        (f"/shots/{reset.shot_id}/activity", None),
        (f"/intent/shots/{reset.shot_id}/core-anchor", None),
        (f"/intent/shots/{reset.shot_id}/core-anchor/revisions", None),
        # Package C owner re-validation correction: the Intent page's
        # dedicated Re-anchor Proposal Review section reads this too.
        (f"/intent/shots/{reset.shot_id}/cross-role-assessments", None),
        # CG Home / Inbox / Tasks / Task Overview / Execution / Version
        # Review / Dependencies / Activity
        ("/cg/inbox", None),
        (f"/cg/inbox/{animation_task_id}", None),
        (f"/cg/inbox/{lighting_task_id}", None),
        (f"/cg/inbox/{comp_task_id}", None),
        ("/cg/anchor-contexts", CG),
        (f"/cg/tasks/{animation_task_id}/anchor-context", CG),
        (f"/cg/tasks/{lighting_task_id}/anchor-context", CG),
        (f"/cg/tasks/{comp_task_id}/anchor-context", CG),
        (f"/intent/tasks/{animation_task_id}/execution-anchor", None),
        (f"/intent/tasks/{lighting_task_id}/execution-anchor", None),
        (f"/intent/tasks/{comp_task_id}/execution-anchor", None),
        (f"/tasks/{animation_task_id}/dependencies", None),
        (f"/tasks/{lighting_task_id}/dependencies", None),
        (f"/tasks/{comp_task_id}/dependencies", None),
        (f"/tasks/{animation_task_id}/activity", None),
        (f"/tasks/{lighting_task_id}/activity", None),
        (f"/tasks/{comp_task_id}/activity", None),
        # Artist Home / Inbox / Tasks / Task Overview / Current Version /
        # Feedback History
        ("/artist/inbox", None),
        (f"/artist/inbox/{animation_task_id}", None),
        (f"/artist/inbox/{lighting_task_id}", None),
        (f"/artist/inbox/{comp_task_id}", None),
        ("/artist/anchor-contexts", ARTIST),
        (f"/artist/tasks/{animation_task_id}/anchor-context", ARTIST),
        (f"/artist/tasks/{lighting_task_id}/anchor-context", ARTIST),
        (f"/artist/tasks/{comp_task_id}/anchor-context", ARTIST),
        (f"/tasks/{animation_task_id}/feedback-history", None),
        (f"/tasks/{lighting_task_id}/feedback-history", None),
        (f"/tasks/{comp_task_id}/feedback-history", None),
        # Shot/Task catalogue + Versions
        ("/projects", None),
        ("/shots", None),
        (f"/shots/{reset.shot_id}", None),
        ("/tasks", None),
        (f"/tasks/{animation_task_id}", None),
        (f"/shots/{reset.shot_id}/tasks", None),
        (f"/versions/{animation_version_id}", None),
        (f"/versions/{lighting_version_id}", None),
        (f"/versions/{comp_version_id}", None),
        (f"/versions/{comp_version_id}/review-notes", None),
        (f"/versions/{comp_version_id}/assessments", None),
        # journey-status itself must be a pure read too
        ("/internal/demo/d1/journey-status", None),
    ]

    for path, headers in reads:
        response = await client.get(path, headers=headers)
        assert response.status_code == 200, f"GET {path} -> {response.status_code}: {response.text}"

    after = await inspect_d1_journey(session)
    assert after is not None
    snapshot_b = _semantic_snapshot(after)

    assert snapshot_a == snapshot_b, "opening normal pages must never advance the D1 Journey"


# ---------------------------------------------------------------------------
# Task 6: referential graph invariants
# ---------------------------------------------------------------------------


async def test_referential_invariants_after_assessment(session: AsyncSession) -> None:
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    assessment = await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "assessment_complete"

    # Every current assessment/proposal/signal id the canonical graph
    # selector reports must be the one just generated -- not some other,
    # noncanonical row.
    assert result.assessment_ids == (assessment.id,)
    assert len(result.proposal_ids) == 1
    proposal_id = result.proposal_ids[0]
    # A Proposal must reference a parent Assessment inside the canonical
    # graph -- never a dangling or foreign one.
    assert result.proposal_assessment_ids[proposal_id] == assessment.id
    assert result.proposal_assessment_ids[proposal_id] in result.assessment_ids

    # Guidance/Review scoping: every current Guidance/CG Review/VFX
    # Review the graph counted must genuinely belong to a canonical Task/
    # Version, confirmed via the real FK-backed rows, not just a count.
    guidance_rows = list(
        (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    )
    assert len(guidance_rows) == result.counts["guidance"]
    assert all(row.version_id in reset.version_ids for row in guidance_rows)

    vfx_review_rows = list(
        (
            await session.scalars(
                select(VFXSupervisorReview).where(
                    VFXSupervisorReview.version_id.in_(reset.version_ids)
                )
            )
        ).all()
    )
    assert len(vfx_review_rows) == result.counts["vfx_reviews"]
    assert all(row.shot_id == reset.shot_id for row in vfx_review_rows)


# ---------------------------------------------------------------------------
# Task 9: J0 -> J1 transition
# ---------------------------------------------------------------------------


def _assert_content_reflects_three_department_conflict(assessment_output: dict[str, Any]) -> None:
    """Package C content-fidelity fix (owner re-validation correction):
    the generated J1 content, not just its counts, must truthfully
    represent the locked Animation + Lighting + Compositing local-
    optimum conflict -- every assertion below reads real generated
    text/evidence, never a hardcoded UI-layer stand-in.
    """
    local_optimum_risks = assessment_output["local_optimum_risks"]
    assert len(local_optimum_risks) >= 1
    risk_text = " ".join(
        item["summary"] + " " + item["why_it_matters"] for item in local_optimum_risks
    )
    for department_label in ("Animation", "Lighting", "Compositing"):
        assert department_label in risk_text, f"{department_label} evidence not represented"

    # The combined restraint -> heroic spectacle conflict, evidenced by
    # all three departments' own Execution Anchor revisions together.
    combined_findings = [
        finding
        for finding in assessment_output["cross_role_tensions"] + local_optimum_risks
        if "spectacle" in finding["summary"].lower()
        or "spectacle" in finding["why_it_matters"].lower()
    ]
    assert combined_findings, "no finding names the combined heroic/theatrical spectacle drift"
    combined_finding = next(
        finding
        for finding in assessment_output["cross_role_tensions"]
        if "Compositing" in finding["summary"]
    )
    execution_evidence_source_ids = {
        ref["source_id"]
        for ref in combined_finding["evidence"]
        if ref["source_type"] == "execution_anchor_revision"
    }
    assert len(execution_evidence_source_ids) == 3, (
        "combined conflict finding must cite all three departments' own Execution Anchor "
        "revisions, not just Compositing's"
    )

    # The Proposal recommends capping the combined intensity of motion
    # acceleration, warm rim/contrast, bloom, particles, and debris.
    proposal = assessment_output["re_anchor_proposal"]
    assert proposal is not None
    proposal_text = " ".join(
        [proposal["reason_for_consideration"]]
        + [field["proposed_direction"] for field in proposal["proposed_fields"]]
    ).lower()
    assert "combined intensity" in proposal_text


async def _assert_reaches_locked_j1_state(
    session: AsyncSession,
    client: AsyncClient,
    *,
    comp_task_id: uuid.UUID,
    comp_version_id: uuid.UUID,
) -> D1JourneyResult:
    response = await client.post(
        f"/intent/versions/{comp_version_id}/cross-role-assessments/generate",
        json={"task_id": str(comp_task_id)},
        headers=VFX,
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    assessment_id = uuid.UUID(payload["id"])
    _assert_content_reflects_three_department_conflict(payload["assessment_output"])

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "assessment_complete"
    # Exactly one canonical current CrossRoleAssessment.
    assert result.assessment_ids == (assessment_id,)
    assert result.counts["assessments"] == 1
    # High attention.
    assert result.attention_levels == ("high",)
    # One ReAnchorProposal linked to that Assessment.
    assert len(result.proposal_ids) == 1
    assert result.proposal_assessment_ids[result.proposal_ids[0]] == assessment_id
    # IntentSignal was created (required by the domain for every
    # CrossRoleAssessment -- verified directly against the DB, since
    # `D1JourneyResult` itself only carries attention levels).
    signal_count = int(
        await session.scalar(
            select(func.count())
            .select_from(IntentSignal)
            .where(IntentSignal.cross_role_assessment_id == assessment_id)
        )
    )
    assert signal_count == 1
    # No Core R2 Draft yet -- the Proposal is advisory only.
    assert result.counts["core_drafts"] == 0
    assert result.counts["core_anchor_confirmed_revisions"] == 1
    assert result.counts["core_anchor_revisions"] == 1
    # J0 baseline otherwise untouched.
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["versions"] == 3
    return result


async def test_j0_to_j1_real_generate_endpoint_reaches_locked_j1_state(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Transition A (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md
    §11), driven through the exact real product action: the same
    `POST /versions/{id}/cross-role-assessments/generate` endpoint the
    real Alignment UI's "Generate Cross-role Assessment" button calls,
    with no `generator=` override and no internal seed helper involved.
    Runs under this environment's default "deterministic" provider.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await _assert_reaches_locked_j1_state(
        session, client, comp_task_id=comp_task_id, comp_version_id=comp_version_id
    )


async def test_j0_to_j1_real_generate_endpoint_reaches_locked_j1_state_under_deepseek(
    session: AsyncSession, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirement 1 + 2 (owner re-validation correction): canonical D1
    is a reproducible demo fixture whose locked J0 -> J1 transition must
    not depend on the ambient configured provider. With the provider
    forced to "deepseek" (no MODEL_API_KEY/MODEL_NAME configured in this
    test environment -- a real fall-through to the generic live-provider
    path would raise `AgentGenerationError` here, not silently succeed),
    the real endpoint still reaches the exact same locked J1 state
    deterministically, with no live network call.
    """
    monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda: "deepseek")

    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await _assert_reaches_locked_j1_state(
        session, client, comp_task_id=comp_task_id, comp_version_id=comp_version_id
    )


async def test_canonical_d1_generator_dispatch_is_scoped_to_exact_identity(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unit-level regression for the dispatch rule itself
    (`demo_seed.d1_scenario.resolve_canonical_d1_assessment_generator`):
    it must fire only for the exact canonical D1 Project/Shot identity
    (matched by real `ExternalEntityLink`, never a guessed/random id or
    a display name) -- checked under both the default provider and a
    forced "deepseek" provider, since identity scoping must hold
    regardless of provider.
    """
    reset = await reset_d1_journey(session)

    for forced_provider in (None, "deepseek"):
        if forced_provider is not None:
            monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda p=forced_provider: p)

        canonical = await resolve_canonical_d1_assessment_generator(
            session, project_id=reset.project_id, shot_id=reset.shot_id
        )
        assert isinstance(canonical, DeterministicD1CrossRoleAssessmentGenerator)

        # Neither a wrong Shot under the real canonical Project, nor a
        # random Project/Shot pair, ever dispatches to the D1-specific
        # generator -- both fall through to `None` untouched, so a
        # noncanonical Shot keeps using whatever provider is actually
        # configured (requirement 3).
        assert (
            await resolve_canonical_d1_assessment_generator(
                session, project_id=reset.project_id, shot_id=uuid.uuid4()
            )
            is None
        )
        assert (
            await resolve_canonical_d1_assessment_generator(
                session, project_id=uuid.uuid4(), shot_id=uuid.uuid4()
            )
            is None
        )


async def test_canonical_d1_generator_dispatch_fires_regardless_of_ambient_provider(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirement 1, at the unit level: the dispatch itself -- not just
    the end-to-end endpoint -- returns the D1-specific generator for the
    canonical identity even when the ambient provider is "deepseek".
    """
    reset = await reset_d1_journey(session)

    monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda: "deepseek")

    result = await resolve_canonical_d1_assessment_generator(
        session, project_id=reset.project_id, shot_id=reset.shot_id
    )
    assert isinstance(result, DeterministicD1CrossRoleAssessmentGenerator)


async def test_ftrack_live_identity_never_intercepted(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirement 4: a real ftrack/live Project and Shot -- which can
    never carry the `source="demo"` ExternalEntityLink identity the
    dispatch matches on -- is never intercepted, under either provider.
    """
    await reset_d1_journey(session)

    live_project = Project(name="Live ftrack Project", source="ftrack")
    session.add(live_project)
    await session.flush()
    await record_external_link(
        session,
        entity_type="project",
        entity_id=live_project.id,
        source="ftrack",
        external_id="ftrack:live-project-9001",
    )
    live_shot = Shot(project_id=live_project.id, name="Live ftrack Shot", source="ftrack")
    session.add(live_shot)
    await session.flush()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=live_shot.id,
        source="ftrack",
        external_id="ftrack:live-shot-9001",
    )
    await session.commit()

    for forced_provider in (None, "deepseek"):
        if forced_provider is not None:
            monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda p=forced_provider: p)
        result = await resolve_canonical_d1_assessment_generator(
            session, project_id=live_project.id, shot_id=live_shot.id
        )
        assert result is None


async def test_explicit_generator_override_wins_over_canonical_dispatch(
    session: AsyncSession,
) -> None:
    """Requirement 5: an explicit `generator=` override always wins,
    even for the canonical D1 identity -- the dispatch only ever fills
    in a *default*, exactly like Reset/Load-Completed already rely on.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicCrossRoleAssessmentGenerator(),
    )

    # The generic generator never proposes a re-anchor or high-priority
    # finding -- proving this assessment was produced by the explicit
    # override, not the D1-specific dispatch generator (which always
    # proposes one and always reaches high attention here). Per the
    # locked spec, an assessment that doesn't reach high attention does
    # not satisfy J1, so `journey_state` honestly stays "mixed".
    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.counts["assessments"] == 1
    assert result.counts["proposals"] == 0
    assert result.attention_levels != ("high",)
    assert result.journey_state == "mixed"


async def test_failed_noncanonical_provider_generation_does_not_mutate_canonical_d1(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirement 6: a Generate attempt for a noncanonical Shot that
    fails under a forced "deepseek" provider (no MODEL_API_KEY/
    MODEL_NAME configured) must not leave any trace on the canonical D1
    Journey graph.
    """
    await reset_d1_journey(session)
    before = await inspect_d1_journey(session)
    assert before is not None

    # A real, fully-formed noncanonical Shot/Task/Version with every
    # Generate prerequisite already met -- `ensure_d1_scenario`'s own
    # legacy fixture (Package C journey rebase retargeted it off the
    # canonical Shot 010 entirely, see D1_LEGACY_SHOT_EXTERNAL_ID).
    legacy = await ensure_d1_scenario(session)
    legacy_task_id = await find_linked_entity_id(
        session, entity_type="task", source="demo", external_id=D1_LEGACY_TASK_EXTERNAL_ID
    )
    assert legacy_task_id is not None
    legacy_version = await session.get(Version, legacy.version_id)
    assert legacy_version is not None

    monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda: "deepseek")

    with pytest.raises(AgentGenerationError):
        await generate_cross_role_assessment(session, _SEED_VFX, legacy_version.id, legacy_task_id)

    after = await inspect_d1_journey(session)
    assert after is not None
    assert _semantic_snapshot(after) == _semantic_snapshot(before)


# ---------------------------------------------------------------------------
# Task 10 (owner re-validation correction): Execution R1 historical
# correctness across a re-anchor -- the combined-intensity ceiling must
# never leak into R1, which is confirmed before the Proposal that
# introduces it exists.
# ---------------------------------------------------------------------------

_FUTURE_R2_PHRASES = ("combined intensity", "combined-intensity ceiling", "ceiling")
_EXECUTION_CONTENT_FIELDS = (
    "technical_boundaries",
    "parameter_ranges",
    "delivery_conditions",
    "production_ready_criteria",
    "downstream_dependencies",
    "publish_requirements",
    "allowed_refinements",
    "escalation_conditions",
)


async def _confirmed_execution_content_by_task(
    session: AsyncSession, task_ids: tuple[uuid.UUID, ...]
) -> dict[uuid.UUID, dict[str, Any]]:
    """The confirmed Execution Anchor revision's own row (id + every
    content field) per canonical Task -- department-agnostic, so the
    same helper checks Animation, Lighting, and Compositing identically.
    """
    result: dict[uuid.UUID, dict[str, Any]] = {}
    for task_id in task_ids:
        execution_anchor = await session.scalar(
            select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
        )
        assert execution_anchor is not None and execution_anchor.active_revision_id is not None
        revision = await session.get(ExecutionAnchorRevision, execution_anchor.active_revision_id)
        assert revision is not None and revision.status == "confirmed"
        result[task_id] = {
            "id": revision.id,
            **{field: getattr(revision, field) for field in _EXECUTION_CONTENT_FIELDS},
        }
    return result


def _assert_no_future_r2_leakage(content_by_task: dict[uuid.UUID, dict[str, Any]]) -> None:
    for task_id, content in content_by_task.items():
        combined_text = " ".join(
            str(content[field]) for field in _EXECUTION_CONTENT_FIELDS if content[field]
        ).lower()
        for phrase in _FUTURE_R2_PHRASES:
            assert phrase not in combined_text, (
                f"Task {task_id}'s confirmed Execution Anchor R1 must not yet know about "
                f"{phrase!r} -- that concept is only introduced by the later Re-anchor "
                "Proposal"
            )


async def _dependency_descriptions(
    session: AsyncSession, task_id: uuid.UUID
) -> dict[uuid.UUID, str]:
    """Every TaskDependency row's own id -> description text targeting
    one Task -- for D1, always Compositing, the Task the cross-
    department dependency evidence points into."""
    rows = (
        await session.scalars(select(TaskDependency).where(TaskDependency.task_id == task_id))
    ).all()
    return {row.id: row.description for row in rows}


async def test_reset_execution_r1_has_no_future_r2_leakage(session: AsyncSession) -> None:
    """Requirement 1 + 7: immediately after Reset (J0), Animation,
    Lighting, and Compositing's confirmed Execution Anchor R1 each
    reflect only Core Anchor R1 -- none of them already contain the
    combined-intensity ceiling the Re-anchor Proposal only introduces
    later.
    """
    reset = await reset_d1_journey(session)
    content_by_task = await _confirmed_execution_content_by_task(session, reset.task_ids)
    assert len(content_by_task) == 3
    _assert_no_future_r2_leakage(content_by_task)

    # Each department's own real local-optimum content is still present
    # (this is not a blanket content wipe -- only the future-R2 concept
    # is absent).
    all_text = " ".join(
        str(value)
        for content in content_by_task.values()
        for value in content.values()
        if isinstance(value, str)
    ).lower()
    for phrase in ("lunge", "warm rim", "bloom"):
        assert phrase in all_text


async def test_reset_task_dependency_has_no_future_r2_leakage(session: AsyncSession) -> None:
    """Requirement 1 (dependency history across re-anchor follow-up):
    immediately after Reset (J0), the cross-department TaskDependency
    evidence into Compositing (from Animation and from Lighting)
    describes only the real R1-era dependency and the shared need for
    controlled, restrained, readable local content -- never the
    combined-intensity ceiling, which does not exist until the
    Re-anchor Proposal and Core Anchor R2.
    """
    reset = await reset_d1_journey(session)
    comp_task_id = reset.task_ids[2]
    descriptions = await _dependency_descriptions(session, comp_task_id)
    assert len(descriptions) == 2
    for description in descriptions.values():
        lowered = description.lower()
        assert "intensity ceiling" not in lowered
        assert "confirmed local range" in lowered


# ---------------------------------------------------------------------------
# Task 10: J1 -> J2 -> J3 transitions
# ---------------------------------------------------------------------------


async def test_j1_to_j2_use_proposal_creates_core_draft(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Transition B (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md
    §11): the Human VFX Supervisor's real "start a new Core Anchor draft
    from the confirmed revision" action -- the same one the Intent
    Workspace's own Core Anchor editor uses to let the Supervisor review
    the Proposal's evidence and begin drafting R2. R1 remains
    authoritative; nothing downstream is auto-rewritten.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    j1 = await inspect_d1_journey(session)
    assert j1 is not None and j1.journey_state == "assessment_complete"

    r1_revisions_before = (
        await client.get(f"/intent/shots/{reset.shot_id}/core-anchor/revisions")
    ).json()
    r1_before = next(r for r in r1_revisions_before if r["status"] == "confirmed")
    r1_constraints_before = [c["content"] for c in r1_before["constraints"]]

    response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert response.status_code == 201, response.text
    draft = response.json()
    assert draft["status"] == "draft"
    assert draft["revision_number"] == 2

    # Proposal -> R2 Draft: R1's own fields not targeted by the Proposal
    # are preserved exactly (owner re-validation correction).
    assert draft["core_summary"] == r1_before["core_summary"]
    assert draft["shot_objective"] == r1_before["shot_objective"]
    assert draft["emotional_tone"] == r1_before["emotional_tone"]
    assert draft["visual_focus"] == r1_before["visual_focus"]
    # Cloned semantic-child rows are new rows with their own id/timestamp
    # -- compare by real content, not identity.
    assert [z["content"] for z in draft["variation_zones"]] == [
        z["content"] for z in r1_before["variation_zones"]
    ]
    assert [d["description"] for d in draft["drift_risks"]] == [
        d["description"] for d in r1_before["drift_risks"]
    ]
    assert [q["question"] for q in draft["open_questions"]] == [
        q["question"] for q in r1_before["open_questions"]
    ]

    # The Proposal's own proposed constraint is applied: R1's existing
    # constraint(s) are preserved, and exactly one new one is appended,
    # sourced from the real, already-persisted Proposal -- never a
    # UI-only string.
    draft_constraints = [c["content"] for c in draft["constraints"]]
    assert draft_constraints[:-1] == r1_constraints_before
    assert len(draft_constraints) == len(r1_constraints_before) + 1
    new_constraint = draft_constraints[-1].lower()
    assert "combined intensity" in new_constraint
    assert "motion acceleration" in new_constraint
    assert "heroic" in new_constraint or "theatrical" in new_constraint

    # The original R1 revision itself is unchanged -- still confirmed,
    # still exactly its own original constraints, never rewritten by
    # creating a Draft.
    r1_after = (await client.get(f"/intent/core-anchor-revisions/{r1_before['id']}")).json()
    assert r1_after["status"] == "confirmed"
    assert [c["content"] for c in r1_after["constraints"]] == r1_constraints_before
    assert r1_after["core_summary"] == r1_before["core_summary"]

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "reanchor_draft"
    # Exactly one Draft exists.
    assert result.counts["core_drafts"] == 1
    assert result.counts["core_anchor_confirmed_revisions"] == 1  # R1 still authoritative
    assert result.counts["core_anchor_revisions"] == 2  # R1 confirmed + R2 draft
    # J1's assessment/proposal remain untouched, immutable historical
    # evidence -- not rewritten by starting a draft.
    assert result.assessment_ids == j1.assessment_ids
    assert result.proposal_ids == j1.proposal_ids
    # Nothing downstream of the Core Anchor was auto-regenerated.
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["versions"] == 3
    assert result.counts["guidance"] == 3
    assert result.counts["cg_reviews"] == 3
    assert result.counts["vfx_reviews"] == 1

    # Opening/reviewing the new Draft is read-only: repeated GETs of the
    # Draft and the canonical graph never change anything.
    before_review = await inspect_d1_journey(session)
    assert before_review is not None
    for _ in range(2):
        review_response = await client.get(f"/intent/core-anchor-revisions/{draft['id']}")
        assert review_response.status_code == 200
        assert review_response.json() == draft
    after_review = await inspect_d1_journey(session)
    assert after_review is not None
    assert _semantic_snapshot(before_review) == _semantic_snapshot(after_review)


async def test_j2_to_j3_confirm_r2_downstream_not_auto_replaced(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Transition C: the Human VFX Supervisor's real "confirm this
    revision" action. R1 becomes historical/superseded; R2 becomes
    current confirmed. Execution Anchors, Reviews, and Guidance are
    *not* silently regenerated against R2 -- they remain the real R1-era
    rows, exactly as §11's "Assert that downstream R1 outputs are not
    silently replaced" requires.
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    before_draft = await inspect_d1_journey(session)
    assert before_draft is not None

    draft_response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert draft_response.status_code == 201, draft_response.text
    draft_id = draft_response.json()["id"]

    r1_execution_confirmed_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ExecutionAnchorRevision).where(
                    ExecutionAnchorRevision.execution_anchor_id.in_(
                        select(ExecutionAnchor.id).where(
                            ExecutionAnchor.task_id.in_(reset.task_ids)
                        )
                    ),
                    ExecutionAnchorRevision.status == "confirmed",
                )
            )
        ).all()
    }
    # Full content, not just ids -- proves R1 is byte-for-byte historical
    # after the re-anchor, and still carries no future-R2 leakage.
    r1_content_before = await _confirmed_execution_content_by_task(session, reset.task_ids)
    _assert_no_future_r2_leakage(r1_content_before)
    # Requirement 2 (dependency history follow-up): the R1-era
    # TaskDependency evidence is also still ceiling-free before the
    # re-anchor.
    dependency_descriptions_before = await _dependency_descriptions(session, comp_task_id)
    assert len(dependency_descriptions_before) == 2
    for description in dependency_descriptions_before.values():
        assert "intensity ceiling" not in description.lower()
    r1_guidance_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    }

    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft_id}/confirm",
        json={"rationale": "Human VFX confirmed Core Anchor R2 after reviewing the Proposal."},
        headers=VFX,
    )
    assert confirm_response.status_code == 200, confirm_response.text
    confirmed = confirm_response.json()
    assert confirmed["status"] == "confirmed"
    assert confirmed["revision_number"] == 2

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.journey_state == "r2_confirmed"
    assert result.counts["core_anchor_revisions"] == 2  # R1 (superseded) + R2 (confirmed)
    assert result.counts["core_anchor_confirmed_revisions"] == 1  # only R2 is "confirmed" now
    assert result.counts["core_drafts"] == 0

    # R1's own revision row (revision_number == 1 for this Shot's Core
    # Anchor) must now report "superseded", never silently deleted or
    # rewritten.
    core_anchor_id = await session.scalar(
        select(CoreAnchor.id).where(CoreAnchor.shot_id == reset.shot_id)
    )
    r1_revision = await session.scalar(
        select(CoreAnchorRevision).where(
            CoreAnchorRevision.core_anchor_id == core_anchor_id,
            CoreAnchorRevision.revision_number == 1,
        )
    )
    assert r1_revision is not None
    assert r1_revision.status == "superseded"

    # Downstream: Execution Anchors, CG/VFX Reviews, Guidance remain the
    # exact real R1-era rows -- not auto-regenerated, not deleted.
    assert result.counts["execution_anchor_confirmed_revisions"] == 3
    assert result.counts["execution_drafts"] == 0
    assert result.counts["guidance"] == 3
    assert result.counts["cg_reviews"] == 3
    assert result.counts["vfx_reviews"] == 1
    current_execution_confirmed_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ExecutionAnchorRevision).where(
                    ExecutionAnchorRevision.execution_anchor_id.in_(
                        select(ExecutionAnchor.id).where(
                            ExecutionAnchor.task_id.in_(reset.task_ids)
                        )
                    ),
                    ExecutionAnchorRevision.status == "confirmed",
                )
            )
        ).all()
    }
    assert current_execution_confirmed_ids == r1_execution_confirmed_ids
    current_guidance_ids = {
        row.id
        for row in (
            await session.scalars(
                select(ArtistAgentGuidance).where(ArtistAgentGuidance.task_id.in_(reset.task_ids))
            )
        ).all()
    }
    assert current_guidance_ids == r1_guidance_ids

    # Requirement 2 + 7: Execution R1's own row ids AND every content
    # field are byte-for-byte unchanged, for all three departments --
    # confirming Core R2 does not mutate Execution R1 to "absorb" it.
    r1_content_after = await _confirmed_execution_content_by_task(session, reset.task_ids)
    assert r1_content_after == r1_content_before
    # Requirement 1 + 7 again, post-J3: still no future-R2 leakage.
    _assert_no_future_r2_leakage(r1_content_after)

    # Requirement 2 (dependency history follow-up): confirming Core R2
    # does not mutate the historical R1-era TaskDependency evidence into
    # R2-aware wording -- same rows, same ceiling-free descriptions.
    dependency_descriptions_after = await _dependency_descriptions(session, comp_task_id)
    assert dependency_descriptions_after == dependency_descriptions_before

    # Requirement 3 + 6: R1 is marked outdated purely because its own
    # `based_on_core_anchor_revision_number` (1) no longer matches the
    # Shot's current confirmed Core Anchor revision (2) -- never because
    # its own content changed, and no Execution R2 exists (Draft or
    # confirmed) for any department.
    for task_id in reset.task_ids:
        context_response = await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)
        assert context_response.status_code == 200, context_response.text
        execution_context = context_response.json()["execution_anchor"]
        assert execution_context["context_state"] == "outdated"
        assert execution_context["confirmed_revision_number"] == 1
        assert execution_context["based_on_core_anchor_revision_number"] == 1
        assert execution_context["draft_revision_number"] is None

    # Requirement 5: opening/reviewing the J3 CG Execution page (its real
    # backend reads) is itself read-only.
    before_review = await inspect_d1_journey(session)
    assert before_review is not None
    for task_id in reset.task_ids:
        for _ in range(2):
            review_response = await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)
            assert review_response.status_code == 200
            execution_response = await client.get(f"/intent/tasks/{task_id}/execution-anchor")
            assert execution_response.status_code == 200
            # Requirement 4 (dependency history follow-up): repeatedly
            # reading a Task's dependency evidence is itself read-only.
            dependencies_response = await client.get(f"/tasks/{task_id}/dependencies")
            assert dependencies_response.status_code == 200
    after_review = await inspect_d1_journey(session)
    assert after_review is not None
    assert _semantic_snapshot(before_review) == _semantic_snapshot(after_review)
    assert (
        await _confirmed_execution_content_by_task(session, reset.task_ids)
    ) == r1_content_before
    assert (await _dependency_descriptions(session, comp_task_id)) == dependency_descriptions_before


# ---------------------------------------------------------------------------
# Package C follow-up: downstream retranslation semantics (J3 -> J4)
# ---------------------------------------------------------------------------


async def _execution_revision_by_number(
    session: AsyncSession, task_id: uuid.UUID, revision_number: int
) -> ExecutionAnchorRevision:
    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
    )
    assert execution_anchor is not None
    revision = await session.scalar(
        select(ExecutionAnchorRevision).where(
            ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id,
            ExecutionAnchorRevision.revision_number == revision_number,
        )
    )
    assert revision is not None
    return revision


async def test_j3_to_downstream_retranslation_state_transitions(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Owner validation follow-up: the real J3 -> J4 downstream-
    retranslation phase (one or more departments actively drafting or
    confirming Execution R2) is a legal intermediate state, never
    `mixed`. Exercises every required transition-coverage point through
    the real formal endpoints -- no internal seed helper, no `generator=`
    override -- reaching each of:

    1. 0 Execution R2 drafts (the exact `r2_confirmed` J3 baseline).
    2. 1 draft (Animation starts retranslating).
    3. Partially confirmed departments (Animation confirms; Lighting/
       Compositing untouched).
    4. 2 drafts / partial progress (Lighting and Compositing both start
       while Animation is already confirmed).
    5. All 3 Execution R2 confirmed, downstream (Versions/Reviews/
       Guidance) not yet regenerated.

    Also proves, at each step, the Part 3 audit's already-real
    guarantees: confirming one department never auto-confirms another;
    a confirmed Execution R2 references the confirmed Core R2 revision;
    the superseded Execution R1 row stays byte-for-byte historical.
    """
    reset = await reset_d1_journey(session)
    animation_task_id, lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    draft_response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert draft_response.status_code == 201, draft_response.text
    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft_response.json()['id']}/confirm",
        json={"rationale": "Human VFX confirmed Core Anchor R2 after reviewing the Proposal."},
        headers=VFX,
    )
    assert confirm_response.status_code == 200, confirm_response.text
    core_r2_id = uuid.UUID(confirm_response.json()["id"])

    r1_content_by_task = await _confirmed_execution_content_by_task(session, reset.task_ids)

    # (1) 0 Execution R2 drafts -- the plain J3 baseline.
    baseline = await inspect_d1_journey(session)
    assert baseline is not None
    assert baseline.journey_state == "r2_confirmed"

    # (2) 1 draft -- Animation starts retranslating via the real
    # "Generate Execution Anchor draft" action, dispatched to the D1-
    # specific generator (no `generator=` override anywhere in this
    # call chain).
    animation_generate = await client.post(
        f"/intent/tasks/{animation_task_id}/execution-anchor/generate"
    )
    assert animation_generate.status_code == 201, animation_generate.text
    animation_draft = animation_generate.json()
    assert animation_draft["core_anchor_revision_id"] == str(core_r2_id)
    animation_text = " ".join(
        str(animation_draft[field]) for field in _EXECUTION_CONTENT_FIELDS if animation_draft[field]
    ).lower()
    for phrase in ("faster motion", "acceleration", "impact timing", "stronger poses"):
        assert phrase in animation_text
    assert "lighting and compositing" in animation_text
    assert "heroic" in animation_text and "theatrical" in animation_text

    during_animation_draft = await inspect_d1_journey(session)
    assert during_animation_draft is not None
    assert during_animation_draft.journey_state == "downstream_retranslation"
    assert during_animation_draft.counts["execution_anchor_revisions"] == 4
    assert during_animation_draft.counts["execution_drafts"] == 1
    assert during_animation_draft.counts["execution_anchor_confirmed_revisions"] == 3
    # Nothing above the Execution Anchor layer moved.
    assert during_animation_draft.counts["versions"] == 3
    assert during_animation_draft.counts["guidance"] == 3
    assert during_animation_draft.counts["cg_reviews"] == 3
    assert during_animation_draft.counts["vfx_reviews"] == 1
    assert during_animation_draft.counts["dependencies"] == 2

    # (3) Partially confirmed departments -- confirming Animation's own
    # draft does not touch Lighting or Compositing at all.
    confirm_animation = await client.post(
        f"/intent/execution-anchor-revisions/{animation_draft['id']}/confirm",
        json={"rationale": "Human CG confirmed Animation's Execution Anchor R2."},
        headers=CG,
    )
    assert confirm_animation.status_code == 200, confirm_animation.text
    animation_confirmed = confirm_animation.json()
    assert animation_confirmed["core_anchor_revision_id"] == str(core_r2_id)
    assert animation_confirmed["revision_number"] == 2

    after_animation_confirmed = await inspect_d1_journey(session)
    assert after_animation_confirmed is not None
    assert after_animation_confirmed.journey_state == "downstream_retranslation"
    assert after_animation_confirmed.counts["execution_anchor_revisions"] == 4
    assert after_animation_confirmed.counts["execution_drafts"] == 0
    assert after_animation_confirmed.counts["execution_anchor_confirmed_revisions"] == 3

    # Lighting and Compositing are still exactly their R1-era selves --
    # confirming Animation's R2 never auto-confirms (or otherwise
    # touches) either sibling department.
    lighting_still_r1 = await _execution_revision_by_number(session, lighting_task_id, 1)
    comp_still_r1 = await _execution_revision_by_number(session, comp_task_id, 1)
    assert lighting_still_r1.status == "confirmed"
    assert comp_still_r1.status == "confirmed"
    for field in _EXECUTION_CONTENT_FIELDS:
        assert getattr(lighting_still_r1, field) == r1_content_by_task[lighting_task_id][field]
        assert getattr(comp_still_r1, field) == r1_content_by_task[comp_task_id][field]

    # Animation's own R1 is now superseded but stays byte-for-byte
    # historical -- confirming R2 never mutates it.
    animation_r1 = await _execution_revision_by_number(session, animation_task_id, 1)
    assert animation_r1.status == "superseded"
    for field in _EXECUTION_CONTENT_FIELDS:
        assert getattr(animation_r1, field) == r1_content_by_task[animation_task_id][field]

    # (4) 2 drafts / partial progress -- Lighting and Compositing both
    # start retranslating while Animation is already confirmed.
    lighting_generate = await client.post(
        f"/intent/tasks/{lighting_task_id}/execution-anchor/generate"
    )
    assert lighting_generate.status_code == 201, lighting_generate.text
    lighting_draft = lighting_generate.json()
    lighting_text = " ".join(
        str(lighting_draft[field]) for field in _EXECUTION_CONTENT_FIELDS if lighting_draft[field]
    ).lower()
    for phrase in ("warm rim", "contrast", "impact accents"):
        assert phrase in lighting_text
    assert "triumphant" in lighting_text and "theatrical" in lighting_text

    comp_generate = await client.post(f"/intent/tasks/{comp_task_id}/execution-anchor/generate")
    assert comp_generate.status_code == 201, comp_generate.text
    comp_draft = comp_generate.json()
    comp_text = " ".join(
        str(comp_draft[field]) for field in _EXECUTION_CONTENT_FIELDS if comp_draft[field]
    ).lower()
    for phrase in ("bloom", "particles", "debris", "saturation"):
        assert phrase in comp_text
    assert "spectacle" in comp_text

    two_drafts = await inspect_d1_journey(session)
    assert two_drafts is not None
    assert two_drafts.journey_state == "downstream_retranslation"
    assert two_drafts.counts["execution_anchor_revisions"] == 6
    assert two_drafts.counts["execution_drafts"] == 2
    assert two_drafts.counts["execution_anchor_confirmed_revisions"] == 3

    # (5) All 3 Execution R2 confirmed, downstream not yet regenerated.
    confirm_lighting = await client.post(
        f"/intent/execution-anchor-revisions/{lighting_draft['id']}/confirm",
        json={"rationale": "Human CG confirmed Lighting's Execution Anchor R2."},
        headers=CG,
    )
    assert confirm_lighting.status_code == 200, confirm_lighting.text
    lighting_confirmed = confirm_lighting.json()
    assert lighting_confirmed["core_anchor_revision_id"] == str(core_r2_id)

    confirm_comp = await client.post(
        f"/intent/execution-anchor-revisions/{comp_draft['id']}/confirm",
        json={"rationale": "Human CG confirmed Compositing's Execution Anchor R2."},
        headers=CG,
    )
    assert confirm_comp.status_code == 200, confirm_comp.text
    comp_confirmed = confirm_comp.json()
    assert comp_confirmed["core_anchor_revision_id"] == str(core_r2_id)

    all_confirmed = await inspect_d1_journey(session)
    assert all_confirmed is not None
    assert all_confirmed.journey_state == "downstream_retranslation"
    assert all_confirmed.counts["execution_anchor_revisions"] == 6
    assert all_confirmed.counts["execution_drafts"] == 0
    assert all_confirmed.counts["execution_anchor_confirmed_revisions"] == 3
    # Still nothing above the Execution Anchor layer moved, even once
    # every department has confirmed -- J4's own regeneration has not
    # run.
    assert all_confirmed.counts["versions"] == 3
    assert all_confirmed.counts["guidance"] == 3
    assert all_confirmed.counts["cg_reviews"] == 3
    assert all_confirmed.counts["vfx_reviews"] == 1
    assert all_confirmed.counts["dependencies"] == 2
    assert all_confirmed.counts["assessments"] == 1
    assert all_confirmed.counts["proposals"] in (0, 1)

    # Every department's own R1 remains historical, whether or not that
    # department has since confirmed R2.
    for task_id in reset.task_ids:
        r1 = await _execution_revision_by_number(session, task_id, 1)
        for field in _EXECUTION_CONTENT_FIELDS:
            assert getattr(r1, field) == r1_content_by_task[task_id][field]

    # Read-purity: opening the J3/J4-in-progress pages repeatedly never
    # advances the journey.
    before_review = await inspect_d1_journey(session)
    assert before_review is not None
    for task_id in reset.task_ids:
        for _ in range(2):
            assert (
                await client.get(f"/cg/tasks/{task_id}/anchor-context", headers=CG)
            ).status_code == 200
            assert (
                await client.get(f"/intent/tasks/{task_id}/execution-anchor")
            ).status_code == 200
    after_review = await inspect_d1_journey(session)
    assert after_review is not None
    assert _semantic_snapshot(before_review) == _semantic_snapshot(after_review)


async def test_canonical_d1_execution_generator_dispatch_is_scoped_to_exact_identity(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unit-level regression for the dispatch rule itself
    (`demo_seed.d1_scenario.resolve_canonical_d1_execution_generator`):
    it must fire only for the exact canonical D1 Project/Shot/Task
    identity (matched by real `ExternalEntityLink`, never a guessed/
    random id or a display name), scoped to the correct department --
    checked under both the default provider and a forced "deepseek"
    provider, since identity scoping must hold regardless of provider.
    """
    reset = await reset_d1_journey(session)
    animation_task_id, lighting_task_id, comp_task_id = reset.task_ids

    for forced_provider in (None, "deepseek"):
        if forced_provider is not None:
            monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda p=forced_provider: p)

        for task_id, expected_department in (
            (animation_task_id, "animation"),
            (lighting_task_id, "lighting"),
            (comp_task_id, "comp"),
        ):
            canonical = await resolve_canonical_d1_execution_generator(
                session, project_id=reset.project_id, shot_id=reset.shot_id, task_id=task_id
            )
            assert isinstance(canonical, DeterministicD1ExecutionAnchorDraftGenerator)
            assert canonical._department == expected_department  # noqa: SLF001

        # Neither a wrong Task under the real canonical Shot, nor a
        # random Project/Shot/Task triple, ever dispatches to the
        # D1-specific generator -- both fall through to `None`
        # untouched, so a noncanonical Task keeps using whatever
        # provider is actually configured.
        assert (
            await resolve_canonical_d1_execution_generator(
                session, project_id=reset.project_id, shot_id=reset.shot_id, task_id=uuid.uuid4()
            )
            is None
        )
        assert (
            await resolve_canonical_d1_execution_generator(
                session, project_id=uuid.uuid4(), shot_id=uuid.uuid4(), task_id=uuid.uuid4()
            )
            is None
        )


async def test_canonical_d1_execution_generator_dispatch_fires_regardless_of_ambient_provider(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Requirement (owner validation, Execution R2 translation follow-
    up), at the unit level: the dispatch itself returns the D1-specific
    generator for the canonical identity even when the ambient provider
    is "deepseek".
    """
    reset = await reset_d1_journey(session)
    _animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids

    monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda: "deepseek")

    result = await resolve_canonical_d1_execution_generator(
        session, project_id=reset.project_id, shot_id=reset.shot_id, task_id=comp_task_id
    )
    assert isinstance(result, DeterministicD1ExecutionAnchorDraftGenerator)


async def test_execution_generator_ftrack_live_identity_never_intercepted(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A real ftrack/live Project, Shot, and Task -- which can never
    carry the `source="demo"` ExternalEntityLink identity the dispatch
    matches on -- is never intercepted, under either provider.
    """
    await reset_d1_journey(session)

    live_project = Project(name="Live ftrack Project", source="ftrack")
    session.add(live_project)
    await session.flush()
    await record_external_link(
        session,
        entity_type="project",
        entity_id=live_project.id,
        source="ftrack",
        external_id="ftrack:live-project-9002",
    )
    live_shot = Shot(project_id=live_project.id, name="Live ftrack Shot", source="ftrack")
    session.add(live_shot)
    await session.flush()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=live_shot.id,
        source="ftrack",
        external_id="ftrack:live-shot-9002",
    )
    live_task = Task(shot_id=live_shot.id, name="Live ftrack Task", source="ftrack")
    session.add(live_task)
    await session.flush()
    await record_external_link(
        session,
        entity_type="task",
        entity_id=live_task.id,
        source="ftrack",
        external_id="ftrack:live-task-9002",
    )
    await session.commit()

    for forced_provider in (None, "deepseek"):
        if forced_provider is not None:
            monkeypatch.setattr(model_gateway, "resolve_provider_name", lambda p=forced_provider: p)
        result = await resolve_canonical_d1_execution_generator(
            session, project_id=live_project.id, shot_id=live_shot.id, task_id=live_task.id
        )
        assert result is None


class _OverrideExecutionAnchorDraftGenerator:
    """Minimal explicit-override stand-in -- proves the canonical D1
    dispatch only ever fills in a default, never overriding a caller-
    supplied `generator=`."""

    def __init__(self) -> None:
        self.called = False

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ExecutionAnchorRevisionDraftCreate:
        self.called = True
        return ExecutionAnchorRevisionDraftCreate(
            technical_boundaries="Override technical boundaries",
            parameter_ranges="Override parameter ranges",
            delivery_conditions="Override delivery conditions",
            production_ready_criteria="Override production-ready criteria",
            downstream_dependencies="Override downstream dependencies",
            publish_requirements="Override publish requirements",
            allowed_refinements="Override allowed refinements",
            escalation_conditions="Override escalation conditions",
        )


async def test_explicit_execution_generator_override_wins_over_canonical_dispatch(
    session: AsyncSession, client: AsyncClient
) -> None:
    """An explicit `generator=` override always wins, even for the
    canonical D1 identity -- the dispatch only ever fills in a
    *default*, exactly like the Cross-role Assessment dispatch already
    guarantees.
    """
    reset = await reset_d1_journey(session)
    animation_task_id, _lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    draft_response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert draft_response.status_code == 201, draft_response.text
    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft_response.json()['id']}/confirm",
        json={"rationale": "Human VFX confirmed Core Anchor R2 after reviewing the Proposal."},
        headers=VFX,
    )
    assert confirm_response.status_code == 200, confirm_response.text

    override_generator = _OverrideExecutionAnchorDraftGenerator()
    revision = await cg_agent_service.generate_execution_anchor_draft(
        session, animation_task_id, generator=override_generator
    )
    assert override_generator.called
    # The D1-specific translation phrases are absent -- proving this
    # draft came from the explicit override, not the canonical dispatch.
    combined = " ".join(
        str(getattr(revision, field))
        for field in _EXECUTION_CONTENT_FIELDS
        if getattr(revision, field)
    ).lower()
    assert "faster motion" not in combined
    assert "override" in combined


async def test_resolved_cross_role_assessment_after_all_departments_confirm_r2(
    session: AsyncSession, client: AsyncClient
) -> None:
    """Part 3 audit follow-up: once all three departments have actually
    confirmed their own Execution Anchor R2, the real "Generate Cross-
    role Assessment" action -- called again with no override, exactly
    as the real UI would -- produces a truthfully lower-attention,
    proposal-free read (no new unresolved Re-anchor Proposal), while
    the historical J1 high-attention Assessment and Proposal remain
    untouched.
    """
    reset = await reset_d1_journey(session)
    animation_task_id, lighting_task_id, comp_task_id = reset.task_ids
    _animation_version_id, _lighting_version_id, comp_version_id = reset.version_ids

    j1_assessment = await generate_cross_role_assessment(
        session,
        _SEED_VFX,
        comp_version_id,
        comp_task_id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )
    j1_assessment_id = j1_assessment.id
    j1_signal_id = j1_assessment.intent_signal.id
    assert j1_assessment.intent_signal.attention_level == "high"
    assert j1_assessment.re_anchor_proposal is not None
    j1_proposal_id = j1_assessment.re_anchor_proposal.id

    draft_response = await client.post(
        f"/intent/shots/{reset.shot_id}/core-anchor/drafts/from-confirmed", headers=VFX
    )
    assert draft_response.status_code == 201, draft_response.text
    confirm_response = await client.post(
        f"/intent/core-anchor-revisions/{draft_response.json()['id']}/confirm",
        json={"rationale": "Human VFX confirmed Core Anchor R2 after reviewing the Proposal."},
        headers=VFX,
    )
    assert confirm_response.status_code == 200, confirm_response.text

    for task_id in (animation_task_id, lighting_task_id, comp_task_id):
        generate_response = await client.post(f"/intent/tasks/{task_id}/execution-anchor/generate")
        assert generate_response.status_code == 201, generate_response.text
        draft = generate_response.json()
        confirm = await client.post(
            f"/intent/execution-anchor-revisions/{draft['id']}/confirm",
            json={"rationale": "Human CG confirmed the department's Execution Anchor R2."},
            headers=CG,
        )
        assert confirm.status_code == 200, confirm.text
        # A real, already-formal, already-wired capability (Part 3
        # audit): generating a new CG Supervisor Review for the just-
        # confirmed Execution R2 revision requires no new Version at
        # all -- it is keyed purely by the confirmed revision id.
        review_response = await client.post(
            f"/intent/execution-anchor-revisions/{confirm.json()['id']}/cg-supervisor-reviews/generate",
            headers=CG,
        )
        assert review_response.status_code == 201, review_response.text

    all_confirmed = await inspect_d1_journey(session)
    assert all_confirmed is not None
    assert all_confirmed.counts["execution_anchor_revisions"] == 6
    assert all_confirmed.counts["execution_drafts"] == 0

    # The real endpoint the VFX Supervisor's "Generate Cross-role
    # Assessment" action calls -- no `generator=` override, dispatched
    # to the canonical D1 generator purely by identity.
    resolved_response = await client.post(
        f"/intent/versions/{comp_version_id}/cross-role-assessments/generate",
        json={"task_id": str(comp_task_id)},
        headers=VFX,
    )
    assert resolved_response.status_code == 201, resolved_response.text
    resolved = resolved_response.json()

    assert resolved["re_anchor_proposal"] is None
    assert resolved["intent_signal"]["attention_level"] == "medium"
    assert (
        resolved["intent_signal"]["attention_level"] != j1_assessment.intent_signal.attention_level
    )
    resolved_output = resolved["assessment_output"]
    findings = resolved_output["local_optimum_risks"] + resolved_output["cross_role_tensions"]
    combined_text = " ".join(
        finding["summary"] + " " + finding["why_it_matters"] for finding in findings
    ).lower()
    assert all(finding["priority"] != "high" for finding in findings)
    assert "confirmed" in combined_text

    # The historical J1 Assessment, Proposal, and IntentSignal are
    # untouched -- J4 preserves them, it never overwrites or deletes
    # them.
    j1_after = await session.get(CrossRoleAssessment, j1_assessment_id)
    assert j1_after is not None
    j1_signal_after = await session.get(IntentSignal, j1_signal_id)
    assert j1_signal_after is not None
    assert j1_signal_after.attention_level == "high"
    j1_proposal_after = await session.get(ReAnchorProposal, j1_proposal_id)
    assert j1_proposal_after is not None

    result = await inspect_d1_journey(session)
    assert result is not None
    assert result.counts["assessments"] == 2
    assert j1_assessment_id in result.assessment_ids
