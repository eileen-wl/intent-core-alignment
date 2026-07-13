from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Server-side only. Never exposed to Agents or the frontend
    # (docs/FTRACK_INTEGRATION.md §5, docs/ARCHITECTURE.md §10).
    ftrack_server: str = ""
    ftrack_api_user: str = ""
    ftrack_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
