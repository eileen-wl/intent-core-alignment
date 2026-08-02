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
    # only implemented value until Step 4b, which adds "deepseek" (ADR-0013)
    # -- see agents.core_agent_service / agents.alignment_assessment_service.
    model_provider: str = "deterministic"
    # Only required when model_provider="deepseek" (Step 4b). Blank by
    # default in .env.example, same as model_provider itself.
    model_api_key: str = ""
    model_name: str = ""
    # Step 8C-3 (docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §8,
    # ADR-0014 Decision 3): the shared secret the trusted internal ftrack
    # Version/ReviewNote sync endpoints require via the X-Internal-Sync-
    # Token header. Blank by default (matching model_api_key's own
    # convention) -- intent_core_api.ftrack_version_note_sync.auth fails
    # closed (rejects every request) when this is blank, rather than
    # treating an unconfigured token as "no auth required". Distinct
    # from AUTH_SECRET (reserved for human-facing auth, unrelated and
    # not yet wired to anything): this token grants no ActorContext, no
    # human_role, no permission any require_human_role check recognizes.
    internal_sync_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
