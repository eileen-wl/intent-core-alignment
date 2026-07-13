from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from intent_core_worker.config import get_settings


async def ping(ctx: dict[str, Any], heartbeat_name: str) -> None:
    """Prove the api -> Redis -> worker -> api async job path works.

    Not a real Agent capability -- see docs/AGENT_CONTRACTS.md for what
    a real capability's contract looks like. This only calls back to
    the api's ops heartbeat endpoint (intent_core_api.ops.router),
    which is the only place that writes to Postgres for this proof of
    wiring; the worker itself stays stateless.
    """
    settings = get_settings()
    async with httpx.AsyncClient(base_url=settings.api_base_url) as client:
        response = await client.post(
            "/internal/worker-heartbeat",
            json={
                "name": heartbeat_name,
                "pinged_at": datetime.now(UTC).isoformat(),
            },
        )
        response.raise_for_status()
