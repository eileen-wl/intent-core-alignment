from typing import Any

import pytest
from intent_core_connector.errors import IntegrationError
from intent_core_connector.writeback_client import write_note_to_shot


class _FakeNote:
    def __init__(self, note_id: str) -> None:
        self._data = {"id": note_id}

    def __getitem__(self, key: str) -> Any:
        return self._data[key]


class _FakeShot:
    def __init__(
        self, *, created_note_id: str | None = None, raise_on_create: Exception | None = None
    ):
        self._created_note_id = created_note_id
        self._raise_on_create = raise_on_create
        self.create_note_calls: list[dict[str, Any]] = []

    def create_note(self, content: str, author: Any = None) -> _FakeNote:
        self.create_note_calls.append({"content": content, "author": author})
        if self._raise_on_create is not None:
            raise self._raise_on_create
        assert self._created_note_id is not None
        return _FakeNote(self._created_note_id)


class _FakeUser:
    def __init__(self, username: str) -> None:
        self.username = username


_UNSET = object()


class _FakeSession:
    def __init__(
        self,
        shot: _FakeShot | None,
        *,
        api_user: str = "api-user@example.com",
        user: Any = _UNSET,
        raise_on_get: Exception | None = None,
    ) -> None:
        self._shot = shot
        self._raise_on_get = raise_on_get
        self.api_user = api_user
        self._user = _FakeUser(api_user) if user is _UNSET else user
        self.committed = False

    def get(self, entity_type: str, entity_key: str) -> _FakeShot | None:
        assert entity_type == "Shot"
        if self._raise_on_get is not None:
            raise self._raise_on_get
        return self._shot

    def query(self, expression: str) -> "_FakeQueryResult":
        assert "User where username is" in expression
        return _FakeQueryResult(self._user)

    def commit(self) -> None:
        self.committed = True


class _FakeQueryResult:
    def __init__(self, user: _FakeUser | None) -> None:
        self._user = user

    def first(self) -> _FakeUser | None:
        return self._user


def test_write_note_to_shot_returns_new_note_id() -> None:
    shot = _FakeShot(created_note_id="note-1")
    session = _FakeSession(shot)

    note_id = write_note_to_shot(session, shot_external_id="shot-1", content="[ICAS] hello")

    assert note_id == "note-1"
    assert shot.create_note_calls == [
        {"content": "[ICAS] hello", "author": session._user}  # noqa: SLF001
    ]
    assert session.committed is True


def test_write_note_to_shot_raises_when_shot_not_found() -> None:
    session = _FakeSession(None)

    with pytest.raises(IntegrationError):
        write_note_to_shot(session, shot_external_id="missing", content="hi")


def test_write_note_to_shot_wraps_lookup_failure() -> None:
    session = _FakeSession(None, raise_on_get=RuntimeError("boom"))

    with pytest.raises(IntegrationError):
        write_note_to_shot(session, shot_external_id="shot-1", content="hi")


def test_write_note_to_shot_wraps_create_failure() -> None:
    shot = _FakeShot(raise_on_create=RuntimeError("boom"))
    session = _FakeSession(shot)

    with pytest.raises(IntegrationError):
        write_note_to_shot(session, shot_external_id="shot-1", content="hi")


def test_write_note_to_shot_raises_when_author_user_not_found() -> None:
    shot = _FakeShot(created_note_id="note-1")
    session = _FakeSession(shot, user=None)

    with pytest.raises(IntegrationError):
        write_note_to_shot(session, shot_external_id="shot-1", content="hi")

    assert shot.create_note_calls == []
