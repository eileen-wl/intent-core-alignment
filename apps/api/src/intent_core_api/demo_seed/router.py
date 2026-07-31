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

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.demo_seed.d1_scenario import (
    ensure_d1_scenario,
    reset_uninitialized_shot_core_anchor_state,
)

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


@router.post("/ensure-d1-scenario", response_model=D1ScenarioResultRead)
async def ensure_d1_scenario_endpoint(
    session: AsyncSession = Depends(get_session),
) -> D1ScenarioResultRead:
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
    shot_id = await reset_uninitialized_shot_core_anchor_state(session)
    return ResetUninitializedShotResultRead(
        shot_id=shot_id, intent_url=f"/vfx/shots/{shot_id}/intent"
    )
