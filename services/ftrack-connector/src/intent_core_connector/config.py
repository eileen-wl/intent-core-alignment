from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# services/ftrack-connector/src/intent_core_connector/config.py ->
# repo root is 4 parents up. An absolute path (not the cwd-relative
# default) so this resolves to the same root .env regardless of which
# documented command starts the service (`uv run --project
# services/ftrack-connector ...` from the repo root, or `cd
# services/ftrack-connector && uv run ...`).
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_REPO_ROOT / ".env", extra="ignore")

    # Server-side only. Never exposed to Agents or the frontend
    # (docs/FTRACK_INTEGRATION.md §5, docs/ARCHITECTURE.md §10).
    ftrack_server: str = ""
    ftrack_api_user: str = ""
    ftrack_api_key: str = ""

    # ADR-0008: this service never writes to Postgres directly -- it
    # calls apps/api over HTTP, same pattern as services/worker.
    api_base_url: str = "http://localhost:8000"

    # Step 8C-4/8C-5: shared secret required by apps/api's trusted
    # internal ftrack Version/ReviewNote sync endpoints
    # (X-Internal-Sync-Token header, apps/api's own
    # intent_core_api.config.Settings.internal_sync_token). Blank by
    # default -- sync_client.py fails closed (raises before sending any
    # request) rather than calling those endpoints unauthenticated.
    internal_sync_token: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
