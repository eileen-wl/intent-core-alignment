"""Regression test for the asyncpg naive/aware timestamp mismatch.

`POST /projects` previously raised a 500 against a real PostgreSQL
database whose `created_at`/`updated_at` columns were still `TIMESTAMP
WITHOUT TIME ZONE` (asyncpg: "can't subtract offset-naive and
offset-aware datetimes") -- a bug the in-memory SQLite suite in
`apps/api/tests` cannot reproduce, since SQLite has no distinct
naive/aware timestamp storage type. This only catches the bug against a
*real* Postgres, hence living here rather than in `apps/api/tests`.

Requires `docker compose -f infra/docker-compose.yml up` (postgres,
redis, api) running first, with migrations applied (`alembic upgrade
head`). Not part of `make test` -- run explicitly:

    uv run --with httpx --with pytest --with pytest-asyncio \\
      pytest tests/integration

Skips itself if the API is not reachable, so accidental discovery
(e.g. a bare `pytest` from the repo root) doesn't fail the suite.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime

import httpx
import pytest

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")


def _api_reachable() -> bool:
    try:
        response = httpx.get(f"{API_BASE_URL}/health", timeout=1.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _api_reachable(), reason="apps/api is not reachable; start docker compose first"
)


async def test_create_project_succeeds_and_returns_timezone_aware_timestamps() -> None:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        response = await client.post("/projects", json={"name": f"Timestamp check {uuid.uuid4()}"})

    assert response.status_code == 201, response.text
    body = response.json()

    created_at = datetime.fromisoformat(body["created_at"])
    updated_at = datetime.fromisoformat(body["updated_at"])
    assert created_at.tzinfo is not None, (
        f"created_at is not timezone-aware: {body['created_at']!r}"
    )
    assert updated_at.tzinfo is not None, (
        f"updated_at is not timezone-aware: {body['updated_at']!r}"
    )
