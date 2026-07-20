from datetime import UTC, datetime
from typing import Any

import pytest
from intent_core_connector.errors import IntegrationError
from intent_core_connector.shot_context import (
    read_one_shot_context,
    read_shot_contexts_with_new_tasks_since,
)


class _FakeSession:
    def __init__(
        self,
        shot_rows: list[dict[str, Any]],
        task_rows: list[dict[str, Any]],
        raise_on_shot_query: Exception | None = None,
        raise_on_task_query: Exception | None = None,
    ) -> None:
        self._shot_rows = shot_rows
        self._task_rows = task_rows
        self._raise_on_shot_query = raise_on_shot_query
        self._raise_on_task_query = raise_on_task_query

    def query(self, expression: str) -> list[dict[str, Any]]:
        if "from Shot" in expression:
            if self._raise_on_shot_query is not None:
                raise self._raise_on_shot_query
            return self._shot_rows
        if "from Task" in expression:
            if self._raise_on_task_query is not None:
                raise self._raise_on_task_query
            return self._task_rows
        raise AssertionError(f"Unexpected query expression: {expression!r}")


def test_read_one_shot_context_returns_full_context() -> None:
    session = _FakeSession(
        shot_rows=[
            {
                "id": "shot-1",
                "name": "bc0030",
                "project": {"id": "proj-1", "name": "sync", "full_name": "Sync (VFX demo)"},
            }
        ],
        task_rows=[{"id": "task-1", "name": "Compositing", "type": {"name": "Compositing"}}],
    )

    context = read_one_shot_context(session)

    assert context is not None
    assert context.external_id == "shot-1"
    assert context.project.full_name == "Sync (VFX demo)"
    assert context.task is not None
    assert context.task.department == "Compositing"


def test_read_one_shot_context_handles_shot_with_no_tasks() -> None:
    session = _FakeSession(
        shot_rows=[
            {
                "id": "shot-1",
                "name": "bc0030",
                "project": {"id": "proj-1", "name": "sync", "full_name": "Sync (VFX demo)"},
            }
        ],
        task_rows=[],
    )

    context = read_one_shot_context(session)

    assert context is not None
    assert context.task is None


def test_read_one_shot_context_returns_none_when_no_shots_exist() -> None:
    session = _FakeSession(shot_rows=[], task_rows=[])

    assert read_one_shot_context(session) is None


def test_read_one_shot_context_wraps_shot_query_failure() -> None:
    session = _FakeSession(shot_rows=[], task_rows=[], raise_on_shot_query=RuntimeError("boom"))

    with pytest.raises(IntegrationError):
        read_one_shot_context(session)


def test_read_one_shot_context_wraps_task_query_failure() -> None:
    session = _FakeSession(
        shot_rows=[
            {
                "id": "shot-1",
                "name": "bc0030",
                "project": {"id": "proj-1", "name": "sync", "full_name": "Sync (VFX demo)"},
            }
        ],
        task_rows=[],
        raise_on_task_query=RuntimeError("boom"),
    )

    with pytest.raises(IntegrationError):
        read_one_shot_context(session)


def _new_task_row(
    *, task_id: str, shot_id: str, shot_name: str, parent_type: str = "Shot"
) -> dict[str, Any]:
    return {
        "id": task_id,
        "name": "Compositing",
        "type": {"name": "Comp"},
        "parent": {"id": shot_id, "name": shot_name, "object_type": {"name": parent_type}},
        "project": {"id": "proj-1", "name": "sync", "full_name": "Sync (VFX demo)"},
    }


def test_read_shot_contexts_with_new_tasks_since_returns_one_context_per_shot() -> None:
    session = _FakeSession(
        shot_rows=[],
        task_rows=[
            _new_task_row(task_id="task-1", shot_id="shot-1", shot_name="bc0030"),
            _new_task_row(task_id="task-2", shot_id="shot-1", shot_name="bc0030"),
            _new_task_row(task_id="task-3", shot_id="shot-2", shot_name="bc0040"),
        ],
    )

    contexts = read_shot_contexts_with_new_tasks_since(session, since=datetime.now(UTC))

    assert [c.external_id for c in contexts] == ["shot-1", "shot-2"]
    # first new Task found per Shot is kept, not the later duplicate
    assert contexts[0].task is not None
    assert contexts[0].task.external_id == "task-1"


def test_read_shot_contexts_with_new_tasks_since_skips_non_shot_parents() -> None:
    session = _FakeSession(
        shot_rows=[],
        task_rows=[
            _new_task_row(
                task_id="task-1", shot_id="seq-1", shot_name="SEQ010", parent_type="Sequence"
            )
        ],
    )

    contexts = read_shot_contexts_with_new_tasks_since(session, since=datetime.now(UTC))

    assert contexts == []


def test_read_shot_contexts_with_new_tasks_since_respects_limit() -> None:
    session = _FakeSession(
        shot_rows=[],
        task_rows=[
            _new_task_row(task_id=f"task-{i}", shot_id=f"shot-{i}", shot_name=f"sh{i}")
            for i in range(5)
        ],
    )

    contexts = read_shot_contexts_with_new_tasks_since(session, since=datetime.now(UTC), limit=2)

    assert len(contexts) == 2


def test_read_shot_contexts_with_new_tasks_since_wraps_query_failure() -> None:
    session = _FakeSession(shot_rows=[], task_rows=[], raise_on_task_query=RuntimeError("boom"))

    with pytest.raises(IntegrationError):
        read_shot_contexts_with_new_tasks_since(session, since=datetime.now(UTC))
