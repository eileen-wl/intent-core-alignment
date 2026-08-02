from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from intent_core_connector import sync_client
from intent_core_connector.errors import IntegrationError
from intent_core_connector.shot_context import ProjectContext, ShotContext, TaskContext
from intent_core_connector.sync_client import (
    list_linked_shots,
    sync_review_note,
    sync_shot_context,
    sync_version,
)
from intent_core_connector.version_note_context import AssetVersionContext, NoteContext


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


# --- Step 8C-4/8C-5: list_linked_shots / sync_version / sync_review_note ---

TOKEN = "test-token-value"


def _version_context(**overrides: Any) -> AssetVersionContext:
    base: dict[str, Any] = {
        "external_id": "ftrack-version-1",
        "shot_external_id": "ftrack-shot-1",
        "task_external_id": "ftrack-task-1",
        "name": "bc0040_comp_v001",
        "asset_name": "bc0040_comp",
        "version_number": 1,
        "comment": "",
        "source_created_at": datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC),
        "external_author_id": "ftrack-user-42",
        "external_author_name": "Jane Reviewer",
    }
    base.update(overrides)
    return AssetVersionContext(**base)


def _note_context(**overrides: Any) -> NoteContext:
    base: dict[str, Any] = {
        "external_id": "ftrack-note-1",
        "version_external_id": "ftrack-version-1",
        "content": "note content",
        "source_created_at": datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC),
        "external_author_id": "ftrack-author-7",
        "external_author_name": "Mrs. Client",
    }
    base.update(overrides)
    return NoteContext(**base)


def _sync_result_json(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "outcome": "created",
        "entity_id": "11111111-1111-1111-1111-111111111111",
        "external_id": "ftrack-version-1",
        "reason": None,
    }
    base.update(overrides)
    return base


async def test_list_linked_shots_sends_token_header_and_returns_body(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["header"] = request.headers.get("x-internal-sync-token")
        return httpx.Response(
            200, json=[{"shot_id": "internal-shot-1", "shot_external_id": "ftrack-shot-1"}]
        )

    _install_fake_transport(monkeypatch, handler)

    result = await list_linked_shots(api_base_url="http://test", internal_sync_token=TOKEN)

    assert captured["path"] == "/internal/sync/linked-shots"
    assert captured["header"] == TOKEN
    assert result == [{"shot_id": "internal-shot-1", "shot_external_id": "ftrack-shot-1"}]


async def test_list_linked_shots_fails_closed_without_token() -> None:
    with pytest.raises(IntegrationError):
        await list_linked_shots(api_base_url="http://test", internal_sync_token="")


async def test_sync_version_posts_correct_endpoint_and_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        captured["header"] = request.headers.get("x-internal-sync-token")
        return httpx.Response(201, json=_sync_result_json())

    _install_fake_transport(monkeypatch, handler)

    result = await sync_version(
        _version_context(), api_base_url="http://test", internal_sync_token=TOKEN
    )

    assert captured["path"] == "/internal/sync/versions"
    assert captured["header"] == TOKEN
    assert captured["body"] == {
        "external_id": "ftrack-version-1",
        "shot_external_id": "ftrack-shot-1",
        "task_external_id": "ftrack-task-1",
        "name": "bc0040_comp_v001",
        "version_number": 1,
        "description": "",
        "source_created_at": "2025-05-13T13:40:52Z",
        "external_author_id": "ftrack-user-42",
        "external_author_name": "Jane Reviewer",
    }
    assert result.outcome == "created"


async def test_sync_version_fails_closed_without_token() -> None:
    with pytest.raises(IntegrationError):
        await sync_version(_version_context(), api_base_url="http://test", internal_sync_token="")


async def test_sync_version_token_never_appears_in_raised_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Invalid internal sync token"})

    _install_fake_transport(monkeypatch, handler)

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await sync_version(
            _version_context(), api_base_url="http://test", internal_sync_token=TOKEN
        )

    assert TOKEN not in str(exc_info.value)


@pytest.mark.parametrize("outcome", ["created", "already_exists", "skipped"])
async def test_sync_version_retains_api_outcome(
    monkeypatch: pytest.MonkeyPatch, outcome: str
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json=_sync_result_json(outcome=outcome, entity_id=None))

    _install_fake_transport(monkeypatch, handler)

    result = await sync_version(
        _version_context(), api_base_url="http://test", internal_sync_token=TOKEN
    )

    assert result.outcome == outcome


@pytest.mark.parametrize("status_code", [401, 409, 422, 500])
async def test_sync_version_raises_http_status_error_on_non_success(
    monkeypatch: pytest.MonkeyPatch, status_code: int
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"detail": "error"})

    _install_fake_transport(monkeypatch, handler)

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await sync_version(
            _version_context(), api_base_url="http://test", internal_sync_token=TOKEN
        )

    assert exc_info.value.response.status_code == status_code


async def test_sync_review_note_posts_correct_endpoint_and_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        captured["header"] = request.headers.get("x-internal-sync-token")
        return httpx.Response(201, json=_sync_result_json(external_id="ftrack-note-1"))

    _install_fake_transport(monkeypatch, handler)

    result = await sync_review_note(
        _note_context(), api_base_url="http://test", internal_sync_token=TOKEN
    )

    assert captured["path"] == "/internal/sync/review-notes"
    assert captured["header"] == TOKEN
    assert captured["body"] == {
        "external_id": "ftrack-note-1",
        "version_external_id": "ftrack-version-1",
        "content": "note content",
        "source_created_at": "2025-05-20T09:56:12Z",
        "external_author_id": "ftrack-author-7",
        "external_author_name": "Mrs. Client",
    }
    assert result.outcome == "created"


async def test_sync_review_note_fails_closed_without_token() -> None:
    with pytest.raises(IntegrationError):
        await sync_review_note(_note_context(), api_base_url="http://test", internal_sync_token="")


async def test_sync_review_note_raises_http_status_error_on_conflict(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "conflict"})

    _install_fake_transport(monkeypatch, handler)

    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await sync_review_note(
            _note_context(), api_base_url="http://test", internal_sync_token=TOKEN
        )

    assert exc_info.value.response.status_code == 409
