from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from intent_core_connector.errors import IntegrationError
from intent_core_connector.version_note_context import (
    WRITE_BACK_MARKER,
    read_asset_versions_for_shot,
    read_direct_notes_for_asset_version,
    read_review_session_object_notes_for_asset_version,
)

_DEFAULT = object()  # sentinel: distinguishes "not passed" from "explicitly None"


def _extract_quoted_after(expression: str, marker: str) -> str | None:
    start = expression.find(marker)
    if start == -1:
        return None
    start += len(marker)
    end = expression.find('"', start)
    return expression[start:end]


class _FakeSession:
    """Matches test_shot_context.py's `_FakeSession` convention
    (`.query(expression) -> list[dict]`, dispatched by substring), with
    explicit no-write traps so any accidental `create`/`commit`/`delete`
    call fails loudly rather than silently no-op-ing."""

    def __init__(self) -> None:
        self.asset_version_rows: dict[str, list[dict[str, Any]]] = {}
        self.asset_version_error: dict[str, Exception] = {}
        self.direct_note_rows: dict[str, list[dict[str, Any]]] = {}
        self.rso_rows: dict[str, list[dict[str, Any]]] = {}
        self.rso_note_rows: dict[str, list[dict[str, Any]]] = {}
        self.rso_note_error: dict[str, Exception] = {}
        self.queries: list[str] = []

    def query(self, expression: str) -> list[dict[str, Any]]:
        self.queries.append(expression)
        if "from AssetVersion" in expression:
            shot_id = _extract_quoted_after(expression, 'asset.parent.id is "')
            if shot_id in self.asset_version_error:
                raise self.asset_version_error[shot_id]
            return self.asset_version_rows.get(shot_id or "", [])
        if "from ReviewSessionObject" in expression:
            version_id = _extract_quoted_after(expression, 'asset_version.id is "')
            return self.rso_rows.get(version_id or "", [])
        if "from Note" in expression and 'parent_type is "asset_version"' in expression:
            version_id = _extract_quoted_after(expression, 'parent_id is "')
            return self.direct_note_rows.get(version_id or "", [])
        if "from Note" in expression and 'parent_type is "review_session_object"' in expression:
            rso_id = _extract_quoted_after(expression, 'parent_id is "')
            if rso_id in self.rso_note_error:
                raise self.rso_note_error[rso_id]
            return self.rso_note_rows.get(rso_id or "", [])
        raise AssertionError(f"Unexpected query expression: {expression!r}")

    def create(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.create must never be called (read-only)")

    def create_note(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.create_note must never be called (read-only)")

    def commit(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.commit must never be called (read-only)")

    def delete(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.delete must never be called (read-only)")

    def update(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.update must never be called (read-only)")


def _av_row(
    *,
    id: str,
    version: int,
    asset_name: str = "bc0040_comp",
    task_id: str | None = "task-1",
    task_parent_id: str | None = "shot-1",
    comment: str = "",
    date: datetime | None = None,
    user: Any = _DEFAULT,
) -> dict[str, Any]:
    task: dict[str, Any] | None = None
    if task_id is not None:
        task = {"id": task_id}
        if task_parent_id is not None:
            task["parent"] = {"id": task_parent_id}
    return {
        "id": id,
        "version": version,
        "asset": {"name": asset_name},
        "task": task,
        "comment": comment,
        "date": date or datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC),
        "user": {"id": "u1", "username": "jane"} if user is _DEFAULT else user,
    }


def _note_row(
    *,
    id: str,
    content: str = "note content",
    date: datetime | None = None,
    author: Any = _DEFAULT,
) -> dict[str, Any]:
    return {
        "id": id,
        "content": content,
        "date": date or datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC),
        "author": {"id": "a1", "username": "jane"} if author is _DEFAULT else author,
    }


# --- read_asset_versions_for_shot ------------------------------------------


def test_exact_per_shot_asset_version_targeting() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [_av_row(id="v1", version=1)]
    session.asset_version_rows["shot-2"] = [_av_row(id="v2", version=1, task_parent_id="shot-2")]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    assert [v.external_id for v in result.versions] == ["v1"]
    assert any('asset.parent.id is "shot-1"' in q for q in session.queries)


def test_no_arbitrary_sample_cap() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        _av_row(id=f"v{i}", version=1, task_id=None) for i in range(50)
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    assert len(result.versions) == 50


def test_derived_version_name_uses_locked_contract() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        _av_row(id="v1", version=3, asset_name="bc0040_comp", task_id=None)
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    assert result.versions[0].name == "bc0040_comp_v003"


def test_shot_and_task_external_ids_preserved() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        _av_row(id="v1", version=1, task_id="task-99", task_parent_id="shot-1")
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    version = result.versions[0]
    assert version.external_id == "v1"
    assert version.shot_external_id == "shot-1"
    assert version.task_external_id == "task-99"


def test_shot_lineage_disagreement_is_skipped_not_guessed() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        _av_row(id="v-bad", version=1, task_id="task-1", task_parent_id="shot-OTHER"),
        _av_row(id="v-good", version=2, task_id="task-2", task_parent_id="shot-1"),
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    assert [v.external_id for v in result.versions] == ["v-good"]
    assert result.warnings == [_warning_for("v-bad", "shot_lineage_disagreement", result)]


def _warning_for(external_id: str, reason: str, result: Any) -> Any:
    (warning,) = [w for w in result.warnings if w.external_id == external_id]
    assert warning.reason == reason
    return warning


def test_optional_missing_author_data_is_tolerated() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        _av_row(id="v-no-author", version=1, task_id=None, user=None),
        _av_row(
            id="v-fallback",
            version=2,
            task_id=None,
            user={"id": "u2", "username": None, "first_name": "Jane", "last_name": "Doe"},
        ),
        _av_row(id="v-username", version=3, task_id=None, user={"id": "u3", "username": "jdoe"}),
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")
    by_id = {v.external_id: v for v in result.versions}

    assert by_id["v-no-author"].external_author_id is None
    assert by_id["v-no-author"].external_author_name is None
    assert by_id["v-fallback"].external_author_id == "u2"
    assert by_id["v-fallback"].external_author_name == "Jane Doe"
    assert by_id["v-username"].external_author_id == "u3"
    assert by_id["v-username"].external_author_name == "jdoe"


def test_one_malformed_asset_version_row_does_not_abort_the_sweep() -> None:
    session = _FakeSession()
    session.asset_version_rows["shot-1"] = [
        {
            "id": "v-bad",
            "version": None,
            "asset": None,
            "task": None,
            "comment": "",
            "date": "not-a-date",
            "user": None,
        },
        _av_row(id="v-good", version=1, task_id=None),
    ]

    result = read_asset_versions_for_shot(session, shot_external_id="shot-1")

    assert [v.external_id for v in result.versions] == ["v-good"]
    bad_warnings = [w for w in result.warnings if w.external_id == "v-bad"]
    assert len(bad_warnings) == 1
    assert bad_warnings[0].reason.startswith("malformed_row")


def test_asset_version_query_failure_wraps_in_integration_error() -> None:
    session = _FakeSession()
    session.asset_version_error["shot-1"] = RuntimeError("boom")

    with pytest.raises(IntegrationError):
        read_asset_versions_for_shot(session, shot_external_id="shot-1")


# --- read_direct_notes_for_asset_version -----------------------------------


def test_direct_note_filter_uses_snake_case_asset_version() -> None:
    session = _FakeSession()
    session.direct_note_rows["v1"] = [_note_row(id="n1")]

    read_direct_notes_for_asset_version(session, version_external_id="v1")

    assert any('parent_type is "asset_version"' in q for q in session.queries)
    assert not any('parent_type is "AssetVersion"' in q for q in session.queries)


def test_direct_notes_map_to_the_queried_version_external_id() -> None:
    session = _FakeSession()
    session.direct_note_rows["v1"] = [_note_row(id="n1"), _note_row(id="n2")]

    result = read_direct_notes_for_asset_version(session, version_external_id="v1")

    assert all(n.version_external_id == "v1" for n in result.notes)


def test_direct_note_write_back_marker_excluded() -> None:
    session = _FakeSession()
    session.direct_note_rows["v1"] = [
        _note_row(id="n1", content=f"{WRITE_BACK_MARKER} Core Anchor confirmed."),
        _note_row(id="n2", content="real feedback"),
    ]

    result = read_direct_notes_for_asset_version(session, version_external_id="v1")

    assert [n.external_id for n in result.notes] == ["n2"]
    assert result.write_back_echoes_excluded == 1


def test_direct_note_tolerates_missing_author() -> None:
    session = _FakeSession()
    session.direct_note_rows["v1"] = [_note_row(id="n1", author=None)]

    result = read_direct_notes_for_asset_version(session, version_external_id="v1")

    assert result.notes[0].external_author_id is None
    assert result.notes[0].external_author_name is None


# --- read_review_session_object_notes_for_asset_version ---------------------


def test_review_session_object_note_filter_uses_snake_case() -> None:
    session = _FakeSession()
    session.rso_rows["v1"] = [{"id": "rso-1"}]
    session.rso_note_rows["rso-1"] = [_note_row(id="n1")]

    read_review_session_object_notes_for_asset_version(session, version_external_id="v1")

    assert any('parent_type is "review_session_object"' in q for q in session.queries)
    assert not any('parent_type is "ReviewSessionObject"' in q for q in session.queries)


def test_review_session_object_notes_map_to_the_queried_version_external_id() -> None:
    session = _FakeSession()
    session.rso_rows["v1"] = [{"id": "rso-1"}]
    session.rso_note_rows["rso-1"] = [_note_row(id="n1")]

    result = read_review_session_object_notes_for_asset_version(session, version_external_id="v1")

    assert all(n.version_external_id == "v1" for n in result.notes)


def test_missing_review_session_object_is_skipped_not_fatal() -> None:
    session = _FakeSession()
    session.rso_rows["v1"] = [{"id": "rso-dead"}, {"id": "rso-live"}]
    session.rso_note_error["rso-dead"] = RuntimeError("no longer resolves")
    session.rso_note_rows["rso-live"] = [_note_row(id="n1")]

    result = read_review_session_object_notes_for_asset_version(session, version_external_id="v1")

    assert result.review_session_objects_examined == 2
    assert result.review_session_objects_unresolved == 1
    assert [n.external_id for n in result.notes] == ["n1"]


def test_review_session_object_note_write_back_marker_excluded() -> None:
    session = _FakeSession()
    session.rso_rows["v1"] = [{"id": "rso-1"}]
    session.rso_note_rows["rso-1"] = [
        _note_row(id="n1", content=f"{WRITE_BACK_MARKER} echo"),
        _note_row(id="n2", content="real feedback"),
    ]

    result = read_review_session_object_notes_for_asset_version(session, version_external_id="v1")

    assert [n.external_id for n in result.notes] == ["n2"]
    assert result.write_back_echoes_excluded == 1


def test_review_session_object_query_failure_wraps_in_integration_error() -> None:
    class _RaisingSession(_FakeSession):
        def query(self, expression: str) -> list[dict[str, Any]]:
            if "from ReviewSessionObject" in expression:
                raise RuntimeError("boom")
            return super().query(expression)

    with pytest.raises(IntegrationError):
        read_review_session_object_notes_for_asset_version(
            _RaisingSession(), version_external_id="v1"
        )
