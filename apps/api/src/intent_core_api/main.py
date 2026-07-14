from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from intent_core_api.config import get_settings
from intent_core_api.intent.router import router as intent_router
from intent_core_api.ops.router import router as ops_router
from intent_core_api.production_context.router import router as production_context_router
from intent_core_api.workflow.exceptions import ConflictError, ForbiddenActionError, NotFoundError

app = FastAPI(title="Intent Core Alignment API", version="0.1.0")

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_settings.app_base_url],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(production_context_router)
app.include_router(ops_router)
app.include_router(intent_router)


@app.exception_handler(ForbiddenActionError)
async def _forbidden_action_handler(request: Request, exc: ForbiddenActionError) -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def _conflict_handler(request: Request, exc: ConflictError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(NotFoundError)
async def _not_found_handler(request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
