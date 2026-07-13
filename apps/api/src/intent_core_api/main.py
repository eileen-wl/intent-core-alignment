from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from intent_core_api.config import get_settings
from intent_core_api.ops.router import router as ops_router
from intent_core_api.production_context.router import router as production_context_router

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
