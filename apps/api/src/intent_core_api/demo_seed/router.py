"""Internal generic development seed ensure/resolve endpoint (Step 7C-1).

Mirrors ops.router's `/internal` boundary: not permission- or
network-boundary-protected, acceptable only because this is local/dev
scaffolding on a trusted network -- same caveat as ops.router's own
`ping-worker`/`reconcile-ftrack-shots`. This is a generic development
seed bootstrap endpoint, not production authentication, and must never
be described as enterprise-secure merely because the browser normally
reaches it through a Next.js Server Action rather than directly.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.config import get_settings
from intent_core_api.db import get_session
from intent_core_api.demo_seed.d1_journey import (
    D1JourneyResult,
    inspect_d1_journey,
    load_completed_d1_journey,
    reset_d1_journey,
)
from intent_core_api.demo_seed.d1_scenario import (
    D1_PROJECT_EXTERNAL_ID,
    ensure_d1_scenario,
    reset_cg_demo_task_execution_anchor_state,
    reset_uninitialized_shot_core_anchor_state,
)
from intent_core_api.demo_seed.golden_scenario import cleanup_obsolete_golden_rows

router = APIRouter(prefix="/internal/demo", tags=["demo_seed"])


class D1ScenarioResultRead(BaseModel):
    project_id: UUID
    shot_id: UUID
    task_id: UUID
    version_id: UUID
    core_anchor_revision_id: UUID
    execution_anchor_revision_id: UUID
    cross_role_assessment_id: UUID
    uninitialized_shot_id: UUID
    cg_demo_task_id: UUID
    cg_demo_dependency_id: UUID


@router.post("/ensure-d1-scenario", response_model=D1ScenarioResultRead)
async def ensure_d1_scenario_endpoint(
    session: AsyncSession = Depends(get_session),
) -> D1ScenarioResultRead:
    _require_d1_journey_tools_enabled()
    result = await ensure_d1_scenario(session)
    return D1ScenarioResultRead(
        project_id=result.project_id,
        shot_id=result.shot_id,
        task_id=result.task_id,
        version_id=result.version_id,
        core_anchor_revision_id=result.core_anchor_revision_id,
        execution_anchor_revision_id=result.execution_anchor_revision_id,
        cross_role_assessment_id=result.cross_role_assessment_id,
        uninitialized_shot_id=result.uninitialized_shot_id,
        cg_demo_task_id=result.cg_demo_task_id,
        cg_demo_dependency_id=result.cg_demo_dependency_id,
    )


class ResetUninitializedShotResultRead(BaseModel):
    shot_id: UUID
    intent_url: str


@router.post("/reset-uninitialized-shot", response_model=ResetUninitializedShotResultRead)
async def reset_uninitialized_shot_endpoint(
    session: AsyncSession = Depends(get_session),
) -> ResetUninitializedShotResultRead:
    """Dev-only (Step 7C-2 browser-validation fix #1): puts the seed's
    uninitialized Shot back at Core Anchor lifecycle state 1 (INITIAL
    EMPTY) on demand, so that state stays reliably reachable even after a
    prior browser session has moved it past it (e.g. by starting a
    draft). Never adds a product-facing page -- this is scaffolding at the
    same trust boundary as `/ensure-d1-scenario` (see module docstring)."""
    _require_d1_journey_tools_enabled()
    shot_id = await reset_uninitialized_shot_core_anchor_state(session)
    return ResetUninitializedShotResultRead(
        shot_id=shot_id, intent_url=f"/vfx/shots/{shot_id}/intent"
    )


class ResetCgDemoTaskResultRead(BaseModel):
    task_id: UUID
    execution_url: str


@router.post("/reset-cg-demo-task", response_model=ResetCgDemoTaskResultRead)
async def reset_cg_demo_task_endpoint(
    session: AsyncSession = Depends(get_session),
) -> ResetCgDemoTaskResultRead:
    """Dev-only (Step 7C-4 Execution Anchor workflow fix): puts the CG
    demo Task ("Lighting Pass") back at its coherent, meaningful-draft
    Execution Anchor baseline on demand, so that scenario stays reliably
    reachable even after a prior browser session has moved it past it
    (e.g. by confirming a blank draft). Never adds a product-facing page
    -- this is scaffolding at the same trust boundary as
    `/ensure-d1-scenario`/`/reset-uninitialized-shot` (see module
    docstring)."""
    _require_d1_journey_tools_enabled()
    task_id = await reset_cg_demo_task_execution_anchor_state(session)
    return ResetCgDemoTaskResultRead(
        task_id=task_id, execution_url=f"/cg/tasks/{task_id}/execution"
    )


class D1JourneyResultRead(BaseModel):
    # Legacy three-way compatibility field (reset/completed/mixed).
    # `journey_state` is the full J0-J4 state-machine classification new
    # code should read instead (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_
    # HANDOFF.md §13).
    snapshot: str
    journey_state: str
    project_id: UUID
    shot_id: UUID
    task_ids: list[UUID]
    version_ids: list[UUID]
    counts: dict[str, int]
    assessment_ids: list[UUID]
    proposal_ids: list[UUID]
    proposal_assessment_ids: dict[str, UUID]
    attention_levels: list[str]
    completed_at: str
    project_external_id: str = D1_PROJECT_EXTERNAL_ID


def _d1_journey_result(result: D1JourneyResult) -> D1JourneyResultRead:
    return D1JourneyResultRead(
        snapshot=result.snapshot,
        journey_state=result.journey_state,
        project_id=result.project_id,
        shot_id=result.shot_id,
        task_ids=list(result.task_ids),
        version_ids=list(result.version_ids),
        counts=result.counts,
        assessment_ids=list(result.assessment_ids),
        proposal_ids=list(result.proposal_ids),
        proposal_assessment_ids={
            str(proposal_id): assessment_id
            for proposal_id, assessment_id in result.proposal_assessment_ids.items()
        },
        attention_levels=list(result.attention_levels),
        completed_at=result.completed_at.isoformat(),
    )


def _require_d1_journey_tools_enabled() -> None:
    if get_settings().app_env.lower() in {"production", "prod"}:
        raise HTTPException(
            status_code=404, detail="D1 Journey tools are unavailable in this environment"
        )


@router.post("/d1/reset-journey", response_model=D1JourneyResultRead)
async def reset_d1_journey_endpoint(
    session: AsyncSession = Depends(get_session),
) -> D1JourneyResultRead:
    _require_d1_journey_tools_enabled()
    return _d1_journey_result(await reset_d1_journey(session))


@router.post("/d1/load-completed-journey", response_model=D1JourneyResultRead)
async def load_completed_d1_journey_endpoint(
    session: AsyncSession = Depends(get_session),
) -> D1JourneyResultRead:
    _require_d1_journey_tools_enabled()
    return _d1_journey_result(await load_completed_d1_journey(session))


@router.get("/d1/journey-status", response_model=D1JourneyResultRead | None)
async def d1_journey_status_endpoint(
    session: AsyncSession = Depends(get_session),
) -> D1JourneyResultRead | None:
    _require_d1_journey_tools_enabled()
    result = await inspect_d1_journey(session)
    return _d1_journey_result(result) if result is not None else None


class ObsoleteGoldenCleanupRead(BaseModel):
    removed: bool


@router.post("/obsolete-golden/cleanup", response_model=ObsoleteGoldenCleanupRead)
async def cleanup_obsolete_golden_endpoint(
    session: AsyncSession = Depends(get_session),
) -> ObsoleteGoldenCleanupRead:
    """Developer-only cleanup for the abandoned exact Golden namespace."""
    _require_d1_journey_tools_enabled()
    return ObsoleteGoldenCleanupRead(removed=await cleanup_obsolete_golden_rows(session))
