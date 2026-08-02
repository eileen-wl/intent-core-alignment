from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# services/worker/src/intent_core_worker/config.py -> repo root is 4
# parents up. An absolute path (not the cwd-relative default) so this
# resolves to the same root .env regardless of which documented
# command starts the service (`uv run --project services/worker ...`
# from the repo root, or `cd services/worker && uv run ...`).
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    api_base_url: str = "http://localhost:8000"
    redis_url: str = "redis://localhost:6379/0"

    # Step 8C-4/8C-5: shared secret required by apps/api's trusted
    # internal ftrack Version/ReviewNote sync endpoints
    # (X-Internal-Sync-Token header). Blank by default --
    # reconcile_ftrack_versions_and_notes fails closed (performs no ICAS
    # write) rather than calling those endpoints unauthenticated.
    internal_sync_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
