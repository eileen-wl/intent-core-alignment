from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from intent_core_connector.errors import IntegrationAuthenticationError, IntegrationError
from intent_core_connector.shot_context import ProjectContext, ShotContext, TaskContext
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


class _FakeFtrackConnector:
    def __init__(
        self,
        *,
        contexts: list[ShotContext] | None = None,
        connect_error: Exception | None = None,
    ) -> None:
        self._contexts = contexts or []
        self._connect_error = connect_error
        self.connected = False
        self.closed = False
        self.since_requested: datetime | None = None

    def connect(self) -> None:
        if self._connect_error is not None:
            raise self._connect_error
        self.connected = True

    def read_shot_contexts_with_new_tasks(
        self, *, since: datetime, limit: int = 20
    ) -> list[ShotContext]:
        self.since_requested = since
        return self._contexts

    def close(self) -> None:
        self.closed = True


def _shot_context(external_id: str) -> ShotContext:
    return ShotContext(
        external_id=external_id,
        name=f"sh-{external_id}",
        project=ProjectContext(external_id="proj-1", name="sync", full_name="Sync (VFX demo)"),
        task=TaskContext(external_id=f"task-{external_id}", name="Comp"),
    )


def _install_cursor_transport(
    monkeypatch: pytest.MonkeyPatch,
    *,
    existing_cursor: str | None,
    captured: dict[str, Any],
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path.startswith("/integrations/sync-cursor/"):
            if existing_cursor is None:
                return httpx.Response(404, json={"detail": "No sync cursor recorded yet"})
            return httpx.Response(
                200,
                json={
                    "key": "ftrack_shot_reconciliation",
                    "last_synced_at": existing_cursor,
                    "updated_at": existing_cursor,
                },
            )
        if request.method == "PUT" and request.url.path.startswith("/integrations/sync-cursor/"):
            captured["put_body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "key": "ftrack_shot_reconciliation",
                    **json.loads(request.content),
                    "updated_at": json.loads(request.content)["last_synced_at"],
                },
            )
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(tasks.httpx, "AsyncClient", client_factory)


async def test_reconcile_ftrack_shots_defaults_lookback_when_no_cursor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_cursor_transport(monkeypatch, existing_cursor=None, captured=captured)

    fake_connector = _FakeFtrackConnector(contexts=[_shot_context("shot-1")])
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    synced: list[ShotContext] = []

    async def fake_sync(context: ShotContext, *, api_base_url: str) -> None:
        synced.append(context)

    monkeypatch.setattr(tasks, "sync_shot_context", fake_sync)

    before = datetime.now(UTC)
    await tasks.reconcile_ftrack_shots({})
    after = datetime.now(UTC)

    assert fake_connector.connected is True
    assert fake_connector.closed is True
    assert fake_connector.since_requested is not None
    # default lookback is ~24h; just assert it's meaningfully in the past,
    # not exactly "now" (bounded first-run window, not "everything ever")
    assert fake_connector.since_requested < before
    assert [c.external_id for c in synced] == ["shot-1"]
    assert "put_body" in captured
    put_last_synced = datetime.fromisoformat(captured["put_body"]["last_synced_at"])
    assert before <= put_last_synced <= after


async def test_reconcile_ftrack_shots_uses_existing_cursor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_cursor_transport(
        monkeypatch, existing_cursor="2026-07-01T00:00:00+00:00", captured=captured
    )

    fake_connector = _FakeFtrackConnector(contexts=[])
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)
    monkeypatch.setattr(tasks, "sync_shot_context", lambda *a, **k: None)

    await tasks.reconcile_ftrack_shots({})

    assert fake_connector.since_requested == datetime.fromisoformat("2026-07-01T00:00:00+00:00")


async def test_reconcile_ftrack_shots_leaves_cursor_untouched_on_connect_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_cursor_transport(monkeypatch, existing_cursor=None, captured=captured)

    fake_connector = _FakeFtrackConnector(
        connect_error=IntegrationAuthenticationError("bad credentials")
    )
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    sync_calls: list[Any] = []
    monkeypatch.setattr(tasks, "sync_shot_context", lambda *a, **k: sync_calls.append(a))

    await tasks.reconcile_ftrack_shots({})

    assert "put_body" not in captured
    assert sync_calls == []


async def test_reconcile_ftrack_shots_closes_connector_even_when_sync_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_cursor_transport(monkeypatch, existing_cursor=None, captured=captured)

    fake_connector = _FakeFtrackConnector(contexts=[_shot_context("shot-1")])
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    async def failing_sync(context: ShotContext, *, api_base_url: str) -> None:
        raise RuntimeError("sync failed")

    monkeypatch.setattr(tasks, "sync_shot_context", failing_sync)

    with pytest.raises(RuntimeError):
        await tasks.reconcile_ftrack_shots({})

    assert fake_connector.closed is True


class _FakeWritebackConnector:
    def __init__(
        self,
        *,
        note_id: str | None = None,
        connect_error: Exception | None = None,
        write_error: Exception | None = None,
    ) -> None:
        self._note_id = note_id
        self._connect_error = connect_error
        self._write_error = write_error
        self.closed = False
        self.write_calls: list[dict[str, str]] = []

    def connect(self) -> None:
        if self._connect_error is not None:
            raise self._connect_error

    def write_note_to_shot(self, *, shot_external_id: str, content: str) -> str:
        self.write_calls.append({"shot_external_id": shot_external_id, "content": content})
        if self._write_error is not None:
            raise self._write_error
        assert self._note_id is not None
        return self._note_id

    def close(self) -> None:
        self.closed = True


def _install_writeback_transport(
    monkeypatch: pytest.MonkeyPatch, *, record: dict[str, Any], captured: dict[str, Any]
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and request.url.path.startswith(
            "/integrations/writeback-records/"
        ):
            return httpx.Response(200, json=record)
        if request.method == "PATCH" and request.url.path.startswith(
            "/integrations/writeback-records/"
        ):
            captured["patch_body"] = json.loads(request.content)
            return httpx.Response(200, json={**record, **json.loads(request.content)})
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient

    def client_factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(tasks.httpx, "AsyncClient", client_factory)


def _writeback_record() -> dict[str, Any]:
    return {
        "id": "record-1",
        "entity_type": "core_anchor_revision",
        "entity_id": "revision-1",
        "source": "ftrack",
        "target_external_id": "shot-external-1",
        "content": "[Intent Core Alignment System] Core Anchor confirmed.",
        "status": "pending",
        "external_note_id": None,
        "error": None,
        "created_at": "2026-07-20T00:00:00+00:00",
        "completed_at": None,
    }


async def test_write_back_core_anchor_confirmation_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_writeback_transport(monkeypatch, record=_writeback_record(), captured=captured)

    fake_connector = _FakeWritebackConnector(note_id="note-1")
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    await tasks.write_back_core_anchor_confirmation({}, "record-1")

    assert fake_connector.write_calls == [
        {
            "shot_external_id": "shot-external-1",
            "content": "[Intent Core Alignment System] Core Anchor confirmed.",
        }
    ]
    assert fake_connector.closed is True
    assert captured["patch_body"] == {"status": "succeeded", "external_note_id": "note-1"}


async def test_write_back_core_anchor_confirmation_reports_connect_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_writeback_transport(monkeypatch, record=_writeback_record(), captured=captured)

    fake_connector = _FakeWritebackConnector(
        connect_error=IntegrationAuthenticationError("bad credentials")
    )
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    await tasks.write_back_core_anchor_confirmation({}, "record-1")

    assert captured["patch_body"]["status"] == "failed"
    assert "bad credentials" in captured["patch_body"]["error"]
    assert fake_connector.write_calls == []


async def test_write_back_core_anchor_confirmation_reports_write_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}
    _install_writeback_transport(monkeypatch, record=_writeback_record(), captured=captured)

    fake_connector = _FakeWritebackConnector(write_error=IntegrationError("note create failed"))
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: fake_connector)

    await tasks.write_back_core_anchor_confirmation({}, "record-1")

    assert captured["patch_body"]["status"] == "failed"
    assert "note create failed" in captured["patch_body"]["error"]
    assert fake_connector.closed is True
