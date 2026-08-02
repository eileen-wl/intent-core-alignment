from __future__ import annotations

from typing import Any

import pytest
from intent_core_connector.errors import IntegrationError
from intent_core_connector.media_context import read_media_context_for_asset_version


def _extract_quoted_after(expression: str, marker: str) -> str | None:
    start = expression.find(marker)
    if start == -1:
        return None
    start += len(marker)
    end = expression.find('"', start)
    return expression[start:end]


class _FakeSession:
    """Matches ``test_version_note_context.py``'s ``_FakeSession``
    convention (``.query(expression) -> list[dict]``, dispatched by
    substring), with explicit no-write traps."""

    def __init__(self) -> None:
        self.asset_version_rows: dict[str, list[dict[str, Any]]] = {}
        self.asset_version_error: dict[str, Exception] = {}
        self.queries: list[str] = []

    def query(self, expression: str) -> list[dict[str, Any]]:
        self.queries.append(expression)
        if "from AssetVersion" in expression:
            version_id = _extract_quoted_after(expression, 'id is "')
            if version_id in self.asset_version_error:
                raise self.asset_version_error[version_id]
            return self.asset_version_rows.get(version_id or "", [])
        raise AssertionError(f"Unexpected query expression: {expression!r}")

    def create(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.create must never be called (read-only)")

    def commit(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.commit must never be called (read-only)")

    def delete(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.delete must never be called (read-only)")

    def update(self, *args: object, **kwargs: object) -> None:
        raise AssertionError("session.update must never be called (read-only)")


# --- one linked AssetVersion with a real, safe, resolvable thumbnail -------


def test_resolves_the_real_safe_thumbnail_url() -> None:
    session = _FakeSession()
    session.asset_version_rows["v1"] = [
        {
            "thumbnail_url": {
                "url": "https://cdn-eu3.ftrackapp.com/thumbor/abc/component/get?id=c1&signature=sig",
                "value": "https://cdn-eu3.ftrackapp.com/thumbor/abc/component/get?id=c1&signature=sig",
            }
        }
    ]

    result = read_media_context_for_asset_version(session, version_external_id="v1")

    assert result.exists is True
    assert result.thumbnail_url == (
        "https://cdn-eu3.ftrackapp.com/thumbor/abc/component/get?id=c1&signature=sig"
    )
    assert any('id is "v1"' in q for q in session.queries)


def test_never_embeds_a_credential_bearing_url() -> None:
    """A real, resolvable thumbnail_url must never contain the
    connector's own api_key/username -- this module never calls the
    credential-embedding Location.get_url()/get_thumbnail_url() methods
    at all (proven by the fake session having no such method for this
    module to call in the first place)."""
    session = _FakeSession()
    session.asset_version_rows["v1"] = [
        {
            "thumbnail_url": {
                "url": "https://cdn-eu3.ftrackapp.com/thumbor/abc/component/get?id=c1&signature=sig",
            }
        }
    ]

    result = read_media_context_for_asset_version(session, version_external_id="v1")

    assert result.thumbnail_url is not None
    assert "apiKey" not in result.thumbnail_url
    assert "username" not in result.thumbnail_url


# --- honest absence, never fabricated -----------------------------------


def test_no_thumbnail_field_resolves_to_none_not_an_error() -> None:
    session = _FakeSession()
    session.asset_version_rows["v1"] = [{"thumbnail_url": None}]

    result = read_media_context_for_asset_version(session, version_external_id="v1")

    assert result.exists is True
    assert result.thumbnail_url is None


def test_empty_thumbnail_mapping_resolves_to_none() -> None:
    session = _FakeSession()
    session.asset_version_rows["v1"] = [{"thumbnail_url": {}}]

    result = read_media_context_for_asset_version(session, version_external_id="v1")

    assert result.thumbnail_url is None


def test_playable_fields_are_never_populated_by_this_module() -> None:
    """Forward-compatible shape, never fabricated today -- see the
    module docstring for why no safe Component URL mechanism exists in
    this workspace."""
    session = _FakeSession()
    session.asset_version_rows["v1"] = [
        {"thumbnail_url": {"url": "https://cdn-eu3.ftrackapp.com/x"}}
    ]

    result = read_media_context_for_asset_version(session, version_external_id="v1")

    assert result.playable_url is None
    assert result.playable_media_type is None
    assert result.playable_component_name is None


# --- deleted/missing ftrack AssetVersion ------------------------------------


def test_deleted_or_missing_asset_version_reports_exists_false() -> None:
    session = _FakeSession()
    # No row registered for "missing-1" at all.

    result = read_media_context_for_asset_version(session, version_external_id="missing-1")

    assert result.exists is False
    assert result.thumbnail_url is None


def test_a_genuine_query_transport_failure_raises() -> None:
    session = _FakeSession()
    session.asset_version_error["v1"] = RuntimeError("connection reset")

    with pytest.raises(IntegrationError):
        read_media_context_for_asset_version(session, version_external_id="v1")


# --- no session.commit or write-capable call --------------------------------


def test_never_calls_a_write_capable_session_method() -> None:
    session = _FakeSession()
    session.asset_version_rows["v1"] = [
        {"thumbnail_url": {"url": "https://cdn-eu3.ftrackapp.com/x"}}
    ]

    # The fake's create/commit/delete/update all raise AssertionError if
    # called -- a clean run below is itself the proof this module never
    # calls any of them.
    read_media_context_for_asset_version(session, version_external_id="v1")


# --- signed URL values are returned transiently, resolved fresh per call ---


def test_resolved_fresh_per_call_never_cached() -> None:
    session = _FakeSession()
    session.asset_version_rows["v1"] = [
        {"thumbnail_url": {"url": "https://cdn-eu3.ftrackapp.com/thumb-1"}}
    ]

    first = read_media_context_for_asset_version(session, version_external_id="v1")
    session.asset_version_rows["v1"] = [
        {"thumbnail_url": {"url": "https://cdn-eu3.ftrackapp.com/thumb-2"}}
    ]
    second = read_media_context_for_asset_version(session, version_external_id="v1")

    assert first.thumbnail_url == "https://cdn-eu3.ftrackapp.com/thumb-1"
    assert second.thumbnail_url == "https://cdn-eu3.ftrackapp.com/thumb-2"
