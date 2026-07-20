from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from intent_core_connector import sync_client
from intent_core_connector.shot_context import ProjectContext, ShotContext, TaskContext
from intent_core_connector.sync_client import sync_shot_context


def _install_fake_transport(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(sync_client.httpx, "AsyncClient", client_factory)


def _context_with_task() -> ShotContext:
    return ShotContext(
        external_id="shot-1",
        name="bc0030",
        project=ProjectContext(external_id="proj-1", name="sync", full_name="Sync (VFX demo)"),
        task=TaskContext(external_id="task-1", name="Compositing", department="Compositing"),
    )


async def test_sync_shot_context_posts_project_shot_task_in_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        calls.append({"path": request.url.path, "body": body})
        if request.url.path == "/projects":
            return httpx.Response(201, json={"id": "internal-project-1", **body})
        if request.url.path == "/shots":
            return httpx.Response(201, json={"id": "internal-shot-1", **body})
        if request.url.path == "/tasks":
            return httpx.Response(201, json={"id": "internal-task-1", **body})
        raise AssertionError(f"Unexpected path: {request.url.path}")

    _install_fake_transport(monkeypatch, handler)

    result = await sync_shot_context(_context_with_task(), api_base_url="http://test")

    assert [c["path"] for c in calls] == ["/projects", "/shots", "/tasks"]
    assert calls[0]["body"] == {"name": "sync", "source": "ftrack", "external_id": "proj-1"}
    assert calls[1]["body"] == {
        "project_id": "internal-project-1",
        "name": "bc0030",
        "source": "ftrack",
        "external_id": "shot-1",
    }
    assert calls[2]["body"] == {
        "shot_id": "internal-shot-1",
        "name": "Compositing",
        "department": "Compositing",
        "source": "ftrack",
        "external_id": "task-1",
    }
    assert result.project_id == "internal-project-1"
    assert result.shot_id == "internal-shot-1"
    assert result.task_id == "internal-task-1"


async def test_sync_shot_context_skips_task_post_when_no_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        body = json.loads(request.content)
        return httpx.Response(201, json={"id": f"internal-{request.url.path.strip('/')}", **body})

    _install_fake_transport(monkeypatch, handler)

    context = ShotContext(
        external_id="shot-1",
        name="bc0030",
        project=ProjectContext(external_id="proj-1", name="sync", full_name="Sync (VFX demo)"),
        task=None,
    )

    result = await sync_shot_context(context, api_base_url="http://test")

    assert calls == ["/projects", "/shots"]
    assert result.task_id is None


async def test_sync_shot_context_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "boom"})

    _install_fake_transport(monkeypatch, handler)

    with pytest.raises(httpx.HTTPStatusError):
        await sync_shot_context(_context_with_task(), api_base_url="http://test")
