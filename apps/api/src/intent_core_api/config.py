from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# apps/api/src/intent_core_api/config.py -> repo root is 4 parents up.
# An absolute path (not the cwd-relative default) so this resolves to
# the same root .env regardless of which documented command starts
# the service (`uv run --project apps/api ...` from the repo root, or
# `cd apps/api && uv run ...`).
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    app_env: str = "development"
    app_base_url: str = "http://localhost:3000"
    database_url: str = "sqlite+aiosqlite:///./dev.db"
    redis_url: str = "redis://localhost:6379/0"
    # Core Agent model-provider selection (B1). "deterministic" is the
    # only implemented value -- see agents.core_agent_service for what
    # connecting a real provider (MODEL_PROVIDER/MODEL_API_KEY/MODEL_NAME
    # in .env.example) would require.
    model_provider: str = "deterministic"


@lru_cache
def get_settings() -> Settings:
    return Settings()
