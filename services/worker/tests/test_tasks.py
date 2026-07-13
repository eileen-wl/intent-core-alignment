from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from intent_core_worker import tasks


async def test_ping_calls_worker_heartbeat_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200, json={"name": "worker-ping", "last_ping_at": "2026-07-13T00:00:00Z"}
        )

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(tasks.httpx, "AsyncClient", client_factory)

    await tasks.ping({}, "worker-ping")

    assert captured["url"].endswith("/internal/worker-heartbeat")
    assert captured["body"]["name"] == "worker-ping"
    assert "pinged_at" in captured["body"]
