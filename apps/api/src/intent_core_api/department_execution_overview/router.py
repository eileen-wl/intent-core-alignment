"""GET /vfx/shots/{shot_id}/department-execution-overview (Step 9B-3).

Read-only, VFX-Supervisor-only. Requires the same real
``ActorContext``/``X-Actor-Role``/``X-Actor-Id`` header mechanism every
other role-gated endpoint in this codebase uses -- never relies only on
frontend middleware for authorization (CLAUDE.md, docs/ROLE_PERMISSIONS.md).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.department_execution_overview import (
    DepartmentExecutionOverviewRead,
)
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.db import get_session
from intent_core_api.department_execution_overview import service
from intent_core_api.workflow.actors import ActorContext, get_current_actor
from intent_core_api.workflow.exceptions import NotFoundError

router = APIRouter(prefix="/vfx", tags=["department_execution_overview"])


@router.get(
    "/shots/{shot_id}/department-execution-overview",
    response_model=DepartmentExecutionOverviewRead,
)
async def get_department_execution_overview(
    shot_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> DepartmentExecutionOverviewRead:
    overview = await service.get_department_execution_overview(session, actor, shot_id)
    if overview is None:
        raise NotFoundError("Shot not found")
    return overview
