"""End-to-end check of api -> Redis -> worker -> api.

Requires `docker compose -f infra/docker-compose.yml up` (postgres,
redis, api, worker) running first. Not part of `make test` -- run
explicitly:

    uv run --with httpx --with pytest --with pytest-asyncio \\
      pytest tests/integration

Skips itself if the API is not reachable, so accidental discovery
(e.g. a bare `pytest` from the repo root) doesn't fail the suite.
"""

from __future__ import annotations

import asyncio
import os

import httpx
import pytest

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
INTERNAL_HEADERS = {"X-Internal-Sync-Token": os.environ.get("INTERNAL_SYNC_TOKEN", "")}


def _api_reachable() -> bool:
    try:
        response = httpx.get(f"{API_BASE_URL}/health", timeout=1.0)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


pytestmark = pytest.mark.skipif(
    not _api_reachable(), reason="apps/api is not reachable; start docker compose first"
)


async def test_ping_worker_updates_heartbeat() -> None:
    async with httpx.AsyncClient(base_url=API_BASE_URL) as client:
        enqueue_response = await client.post("/internal/ping-worker", headers=INTERNAL_HEADERS)
        assert enqueue_response.status_code == 202

        for _ in range(20):
            read_back = await client.get(
                "/internal/worker-heartbeat/worker-ping", headers=INTERNAL_HEADERS
            )
            if read_back.status_code == 200:
                return
            await asyncio.sleep(0.5)

    pytest.fail("worker did not report back a heartbeat within 10s")
