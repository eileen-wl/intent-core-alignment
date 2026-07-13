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


@lru_cache
def get_settings() -> Settings:
    return Settings()
