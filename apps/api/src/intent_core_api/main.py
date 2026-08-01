from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from intent_core_api.activity.router import router as activity_router
from intent_core_api.artist_feedback_history.router import router as artist_feedback_history_router
from intent_core_api.artist_inbox.router import router as artist_inbox_router
from intent_core_api.cg_inbox.router import router as cg_inbox_router
from intent_core_api.config import get_settings
from intent_core_api.cross_department.router import router as cross_department_router
from intent_core_api.demo_seed.router import router as demo_seed_router
from intent_core_api.integrations.router import router as integrations_router
from intent_core_api.intent.router import router as intent_router
from intent_core_api.ops.router import router as ops_router
from intent_core_api.production_context.router import router as production_context_router
from intent_core_api.task_activity.router import router as task_activity_router
from intent_core_api.versions_and_feedback.router import router as versions_and_feedback_router
from intent_core_api.vfx_inbox.router import router as vfx_inbox_router
from intent_core_api.workflow.exceptions import (
    AgentGenerationError,
    ConflictError,
    ForbiddenActionError,
    NotFoundError,
    ValidationError,
)

app = FastAPI(title="Intent Core Alignment API", version="0.1.0")

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.app_base_url],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(production_context_router)
app.include_router(demo_seed_router)
app.include_router(ops_router)
app.include_router(intent_router)
app.include_router(integrations_router)
app.include_router(versions_and_feedback_router)
app.include_router(vfx_inbox_router)
app.include_router(activity_router)
app.include_router(cg_inbox_router)
app.include_router(cross_department_router)
app.include_router(task_activity_router)
app.include_router(artist_inbox_router)
app.include_router(artist_feedback_history_router)


@app.exception_handler(ForbiddenActionError)
async def _forbidden_action_handler(request: Request, exc: ForbiddenActionError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def _conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(NotFoundError)
async def _not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(AgentGenerationError)
async def _agent_generation_handler(request: Request, exc: AgentGenerationError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(ValidationError)
async def _validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
