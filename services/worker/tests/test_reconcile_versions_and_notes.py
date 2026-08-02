from __future__ import annotations

import importlib
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from intent_core_connector.errors import IntegrationAuthenticationError, IntegrationError
from intent_core_connector.version_note_context import (
    AssetVersionContext,
    AssetVersionSweepResult,
    AssetVersionSweepWarning,
    DirectNoteResult,
    NoteContext,
    ReviewSessionObjectNoteResult,
)
from intent_core_worker import tasks


def _version_context(external_id: str, **overrides: Any) -> AssetVersionContext:
    base: dict[str, Any] = {
        "external_id": external_id,
        "shot_external_id": "shot-1",
        "task_external_id": None,
        "name": f"asset_v{external_id}",
        "asset_name": "asset",
        "version_number": 1,
        "comment": "",
        "source_created_at": datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC),
    }
    base.update(overrides)
    return AssetVersionContext(**base)


def _note_context(external_id: str, version_external_id: str, **overrides: Any) -> NoteContext:
    base: dict[str, Any] = {
        "external_id": external_id,
        "version_external_id": version_external_id,
        "content": "note",
        "source_created_at": datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC),
    }
    base.update(overrides)
    return NoteContext(**base)


class _Result:
    """Minimal stand-in for VersionNoteSyncItemResult (no contracts
    dependency needed in this fake -- just the two fields the job
    branches on)."""

    def __init__(self, outcome: str, entity_id: str | None = None) -> None:
        self.outcome = outcome
        self.entity_id = entity_id


class _FakeReconciliationConnector:
    def __init__(
        self,
        *,
        versions_by_shot: dict[str, AssetVersionSweepResult] | None = None,
        direct_notes_by_version: dict[str, DirectNoteResult] | None = None,
        rso_notes_by_version: dict[str, ReviewSessionObjectNoteResult] | None = None,
    ) -> None:
        self._versions_by_shot = versions_by_shot or {}
        self._direct_notes_by_version = direct_notes_by_version or {}
        self._rso_notes_by_version = rso_notes_by_version or {}
        self.connected = False
        self.closed = False
        self.shots_swept: list[str] = []

    def connect(self) -> None:
        self.connected = True

    def close(self) -> None:
        self.closed = True

    def read_asset_versions_for_shot(self, *, shot_external_id: str) -> AssetVersionSweepResult:
        self.shots_swept.append(shot_external_id)
        return self._versions_by_shot.get(shot_external_id, AssetVersionSweepResult())

    def read_direct_notes_for_asset_version(self, *, version_external_id: str) -> DirectNoteResult:
        return self._direct_notes_by_version.get(version_external_id, DirectNoteResult())

    def read_review_session_object_notes_for_asset_version(
        self, *, version_external_id: str
    ) -> ReviewSessionObjectNoteResult:
        return self._rso_notes_by_version.get(version_external_id, ReviewSessionObjectNoteResult())


def _install(
    monkeypatch: pytest.MonkeyPatch,
    *,
    connector: _FakeReconciliationConnector,
    linked_shots: list[dict[str, str]],
    version_outcomes: dict[str, _Result | Exception],
    note_outcomes: dict[str, _Result | Exception],
    call_log: list[str],
    token: str = "test-token",
) -> None:
    monkeypatch.setenv("INTERNAL_SYNC_TOKEN", token)
    tasks.get_settings.cache_clear()
    monkeypatch.setattr(tasks, "FtrackConnector", lambda: connector)

    async def fake_list_linked_shots(
        *, api_base_url: str, internal_sync_token: str
    ) -> list[dict[str, str]]:
        return linked_shots

    async def fake_sync_version(context: AssetVersionContext, **kwargs: Any) -> _Result:
        call_log.append(f"sync_version:{context.external_id}")
        outcome = version_outcomes[context.external_id]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    async def fake_sync_review_note(context: NoteContext, **kwargs: Any) -> _Result:
        call_log.append(f"sync_note:{context.external_id}")
        outcome = note_outcomes[context.external_id]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(tasks, "list_linked_shots", fake_list_linked_shots)
    monkeypatch.setattr(tasks, "sync_version", fake_sync_version)
    monkeypatch.setattr(tasks, "sync_review_note", fake_sync_review_note)


async def test_job_is_registered(monkeypatch: pytest.MonkeyPatch) -> None:
    # worker_settings.py resolves a real RedisSettings at import/reload
    # time -- this repo's real local .env leaves REDIS_URL blank, so a
    # valid DSN must be patched in before the (re)import for this to
    # succeed regardless of local .env state.
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    tasks.get_settings.cache_clear()
    import intent_core_worker.worker_settings as worker_settings_module

    importlib.reload(worker_settings_module)
    names = [f.__name__ for f in worker_settings_module.WorkerSettings.functions]

    assert "reconcile_ftrack_versions_and_notes" in names
    assert "ping" in names
    assert "reconcile_ftrack_shots" in names
    assert "write_back_core_anchor_confirmation" in names


async def test_fails_closed_without_configured_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_SYNC_TOKEN", "")
    tasks.get_settings.cache_clear()

    def _fail_if_called(*args: Any, **kwargs: Any) -> None:
        raise AssertionError("must not attempt any call when the token is unconfigured")

    monkeypatch.setattr(tasks, "FtrackConnector", _fail_if_called)
    monkeypatch.setattr(tasks, "list_linked_shots", _fail_if_called)

    try:
        summary = await tasks.reconcile_ftrack_versions_and_notes({})
    finally:
        tasks.get_settings.cache_clear()

    assert summary == {
        "linked_shots_examined": 0,
        "asset_versions_discovered": 0,
        "asset_versions_skipped": 0,
        "direct_notes_discovered": 0,
        "review_session_object_notes_discovered": 0,
        "review_session_objects_unresolved": 0,
        "write_back_echoes_excluded": 0,
        "api_created": 0,
        "api_already_exists": 0,
        "api_skipped": 0,
        "api_conflicts_or_failures": 0,
    }


async def test_only_linked_shots_are_swept(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector()
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[
            {"shot_id": "internal-1", "shot_external_id": "shot-1"},
            {"shot_id": "internal-2", "shot_external_id": "shot-2"},
        ],
        version_outcomes={},
        note_outcomes={},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert connector.shots_swept == ["shot-1", "shot-2"]
    assert summary["linked_shots_examined"] == 2
    assert connector.connected is True
    assert connector.closed is True


async def test_version_synced_before_its_notes(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={
            "shot-1": AssetVersionSweepResult(versions=[_version_context("v1")]),
        },
        direct_notes_by_version={
            "v1": DirectNoteResult(notes=[_note_context("n1", "v1")]),
        },
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={"n1": _Result("created", "local-n1")},
        call_log=call_log,
    )

    await tasks.reconcile_ftrack_versions_and_notes({})

    assert call_log == ["sync_version:v1", "sync_note:n1"]


async def test_created_version_allows_notes(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])},
        direct_notes_by_version={"v1": DirectNoteResult(notes=[_note_context("n1", "v1")])},
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={"n1": _Result("created", "local-n1")},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert "sync_note:n1" in call_log
    assert summary["api_created"] == 2  # version + note


async def test_already_exists_version_also_allows_notes(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])},
        direct_notes_by_version={"v1": DirectNoteResult(notes=[_note_context("n1", "v1")])},
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("already_exists", "local-v1")},
        note_outcomes={"n1": _Result("created", "local-n1")},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert "sync_note:n1" in call_log
    assert summary["api_already_exists"] == 1
    assert summary["api_created"] == 1


async def test_skipped_version_prevents_its_notes_from_being_submitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])},
        direct_notes_by_version={"v1": DirectNoteResult(notes=[_note_context("n1", "v1")])},
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("skipped")},
        note_outcomes={},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert call_log == ["sync_version:v1"]
    assert summary["api_skipped"] == 1
    assert summary["direct_notes_discovered"] == 0


async def test_failed_version_sync_prevents_its_notes_from_being_submitted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])},
        direct_notes_by_version={"v1": DirectNoteResult(notes=[_note_context("n1", "v1")])},
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={
            "v1": httpx.HTTPStatusError(
                "conflict",
                request=httpx.Request("POST", "http://test"),
                response=httpx.Response(409),
            )
        },
        note_outcomes={},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert call_log == ["sync_version:v1"]
    assert summary["api_conflicts_or_failures"] == 1


async def test_unresolved_review_session_object_does_not_abort_the_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={
            "shot-1": AssetVersionSweepResult(
                versions=[_version_context("v1"), _version_context("v2")]
            )
        },
        rso_notes_by_version={
            "v1": ReviewSessionObjectNoteResult(
                review_session_objects_examined=2, review_session_objects_unresolved=1
            ),
            "v2": ReviewSessionObjectNoteResult(notes=[_note_context("n2", "v2")]),
        },
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={
            "v1": _Result("created", "local-v1"),
            "v2": _Result("created", "local-v2"),
        },
        note_outcomes={"n2": _Result("created", "local-n2")},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert summary["review_session_objects_unresolved"] == 1
    assert summary["review_session_object_notes_discovered"] == 1
    assert "sync_version:v2" in call_log
    assert "sync_note:n2" in call_log


async def test_repeated_run_produces_only_idempotent_already_exists_requests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])},
        direct_notes_by_version={"v1": DirectNoteResult(notes=[_note_context("n1", "v1")])},
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={"n1": _Result("created", "local-n1")},
        call_log=call_log,
    )
    first_summary = await tasks.reconcile_ftrack_versions_and_notes({})
    assert first_summary["api_created"] == 2

    # Second run: the same real ftrack data is re-swept (no cursor), but
    # apps/api now reports both as already-linked.
    call_log.clear()
    version_outcomes_second = {"v1": _Result("already_exists", "local-v1")}
    note_outcomes_second = {"n1": _Result("already_exists", "local-n1")}
    monkeypatch.setattr(
        tasks,
        "sync_version",
        _make_fake_sync(call_log, "sync_version", version_outcomes_second),
    )
    monkeypatch.setattr(
        tasks,
        "sync_review_note",
        _make_fake_sync(call_log, "sync_note", note_outcomes_second),
    )

    second_summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert second_summary["api_already_exists"] == 2
    assert second_summary["api_created"] == 0
    assert call_log == ["sync_version:v1", "sync_note:n1"]


def _make_fake_sync(call_log: list[str], label: str, outcomes: dict[str, _Result]) -> Any:
    async def _fake(context: Any, **kwargs: Any) -> _Result:
        call_log.append(f"{label}:{context.external_id}")
        return outcomes[context.external_id]

    return _fake


async def test_aggregate_counts_are_accurate(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={
            "shot-1": AssetVersionSweepResult(
                versions=[_version_context("v1")],
                warnings=[AssetVersionSweepWarning(external_id="v-bad", reason="malformed_row")],
            )
        },
        direct_notes_by_version={
            "v1": DirectNoteResult(notes=[_note_context("n1", "v1")], write_back_echoes_excluded=1)
        },
        rso_notes_by_version={
            "v1": ReviewSessionObjectNoteResult(
                notes=[_note_context("n2", "v1")],
                review_session_objects_examined=3,
                review_session_objects_unresolved=2,
                write_back_echoes_excluded=1,
            )
        },
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={"n1": _Result("created", "local-n1"), "n2": _Result("skipped")},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert summary == {
        "linked_shots_examined": 1,
        "asset_versions_discovered": 1,
        "asset_versions_skipped": 1,
        "direct_notes_discovered": 1,
        "review_session_object_notes_discovered": 1,
        "review_session_objects_unresolved": 2,
        "write_back_echoes_excluded": 2,
        "api_created": 2,  # version + n1
        "api_already_exists": 0,
        "api_skipped": 1,  # n2
        "api_conflicts_or_failures": 0,
    }


async def test_no_sync_cursor_interaction(monkeypatch: pytest.MonkeyPatch) -> None:
    connector = _FakeReconciliationConnector(
        versions_by_shot={"shot-1": AssetVersionSweepResult(versions=[_version_context("v1")])}
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={},
        call_log=call_log,
    )

    def _fail_if_httpx_client_constructed(*args: Any, **kwargs: Any) -> None:
        raise AssertionError(
            "reconcile_ftrack_versions_and_notes must never touch httpx.AsyncClient "
            "directly (no SyncCursor endpoint call, unlike reconcile_ftrack_shots)"
        )

    monkeypatch.setattr(tasks.httpx, "AsyncClient", _fail_if_httpx_client_constructed)

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert "sync_cursor" not in summary
    assert summary["linked_shots_examined"] == 1


async def test_connect_failure_returns_zero_summary_without_raising(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _FailingConnector(_FakeReconciliationConnector):
        def connect(self) -> None:
            raise IntegrationAuthenticationError("bad credentials")

    connector = _FailingConnector()
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[{"shot_id": "internal-1", "shot_external_id": "shot-1"}],
        version_outcomes={},
        note_outcomes={},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert summary["linked_shots_examined"] == 0
    assert connector.closed is False  # never opened, nothing to close


async def test_one_bad_shot_query_does_not_abort_other_shots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _PartiallyFailingConnector(_FakeReconciliationConnector):
        def read_asset_versions_for_shot(self, *, shot_external_id: str) -> AssetVersionSweepResult:
            self.shots_swept.append(shot_external_id)
            if shot_external_id == "shot-bad":
                raise IntegrationError("boom")
            return self._versions_by_shot.get(shot_external_id, AssetVersionSweepResult())

    connector = _PartiallyFailingConnector(
        versions_by_shot={"shot-good": AssetVersionSweepResult(versions=[_version_context("v1")])}
    )
    call_log: list[str] = []
    _install(
        monkeypatch,
        connector=connector,
        linked_shots=[
            {"shot_id": "internal-bad", "shot_external_id": "shot-bad"},
            {"shot_id": "internal-good", "shot_external_id": "shot-good"},
        ],
        version_outcomes={"v1": _Result("created", "local-v1")},
        note_outcomes={},
        call_log=call_log,
    )

    summary = await tasks.reconcile_ftrack_versions_and_notes({})

    assert summary["linked_shots_examined"] == 2
    assert summary["asset_versions_discovered"] == 1
    assert call_log == ["sync_version:v1"]
