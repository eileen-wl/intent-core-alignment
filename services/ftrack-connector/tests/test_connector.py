from collections.abc import Iterator
from pathlib import Path

import ftrack_api.exception
import pytest
import requests
from intent_core_connector import connector as connector_module
from intent_core_connector.config import Settings, get_settings
from intent_core_connector.connector import FtrackConnector
from intent_core_connector.errors import (
    IntegrationAuthenticationError,
    IntegrationConnectionError,
    IntegrationError,
)


class _FakeSession:
    def __init__(self, closed_flags: list[bool] | None = None) -> None:
        self._closed_flags = closed_flags

    def close(self) -> None:
        if self._closed_flags is not None:
            self._closed_flags.append(True)


@pytest.fixture(autouse=True)
def _clear_settings_cache_after_test() -> Iterator[None]:
    yield
    get_settings.cache_clear()


def _configure_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("FTRACK_SERVER", "https://example.ftrackapp.com")
    monkeypatch.setenv("FTRACK_API_USER", "test-user")
    monkeypatch.setenv("FTRACK_API_KEY", "test-key")
    # See test_health_reports_unconfigured_without_credentials for why
    # env_file must be pointed at a guaranteed-nonexistent path.
    monkeypatch.setitem(Settings.model_config, "env_file", tmp_path / "nonexistent.env")
    get_settings.cache_clear()


def _unconfigure_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("FTRACK_SERVER", raising=False)
    monkeypatch.delenv("FTRACK_API_USER", raising=False)
    monkeypatch.delenv("FTRACK_API_KEY", raising=False)
    monkeypatch.setitem(Settings.model_config, "env_file", tmp_path / "nonexistent.env")
    get_settings.cache_clear()


def test_health_reports_unconfigured_without_credentials(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    # `Settings.model_config["env_file"]` is an absolute path to the
    # real repo-root `.env` (see config.py), so clearing env vars
    # alone isn't enough to simulate "unconfigured" -- a developer's
    # real `.env` (e.g. with real ftrack credentials) would otherwise
    # leak into this test via that file.
    _unconfigure_env(monkeypatch, tmp_path)

    health = FtrackConnector().health()

    assert health.configured is False


def test_health_probe_false_never_touches_the_network(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_env(monkeypatch, tmp_path)

    def _fail_if_called(**kwargs: object) -> None:
        raise AssertionError("ftrack_api.Session should not be constructed when probe=False")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _fail_if_called)

    health = FtrackConnector().health()

    assert health.configured is True
    assert "not attempted" in health.detail


def test_health_probe_true_reports_success(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _configure_env(monkeypatch, tmp_path)
    monkeypatch.setattr(connector_module.ftrack_api, "Session", lambda **kwargs: _FakeSession())

    health = FtrackConnector().health(probe=True)

    assert health.configured is True
    assert "Connected" in health.detail


def test_health_probe_true_reports_failure_detail(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_env(monkeypatch, tmp_path)

    def _raise_auth_error(**kwargs: object) -> None:
        raise ftrack_api.exception.AuthenticationError("bad credentials")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _raise_auth_error)

    health = FtrackConnector().health(probe=True)

    assert health.configured is True
    assert "failed" in health.detail


def test_connect_raises_when_unconfigured(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _unconfigure_env(monkeypatch, tmp_path)

    def _fail_if_called(**kwargs: object) -> None:
        raise AssertionError("ftrack_api.Session should not be constructed when unconfigured")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _fail_if_called)

    with pytest.raises(IntegrationAuthenticationError):
        FtrackConnector().connect()


def test_connect_success_marks_connected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _configure_env(monkeypatch, tmp_path)
    monkeypatch.setattr(connector_module.ftrack_api, "Session", lambda **kwargs: _FakeSession())

    conn = FtrackConnector()
    conn.connect()

    assert conn.is_connected is True


def test_connect_is_idempotent(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _configure_env(monkeypatch, tmp_path)
    call_count: list[int] = []

    def _factory(**kwargs: object) -> _FakeSession:
        call_count.append(1)
        return _FakeSession()

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _factory)

    conn = FtrackConnector()
    conn.connect()
    conn.connect()

    assert len(call_count) == 1


def test_connect_wraps_authentication_error(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_env(monkeypatch, tmp_path)

    def _raise_auth_error(**kwargs: object) -> None:
        raise ftrack_api.exception.AuthenticationError("bad credentials")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _raise_auth_error)

    with pytest.raises(IntegrationAuthenticationError):
        FtrackConnector().connect()


def test_connect_wraps_connection_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _configure_env(monkeypatch, tmp_path)

    def _raise_connection_error(**kwargs: object) -> None:
        raise requests.exceptions.ConnectionError("unreachable")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _raise_connection_error)

    with pytest.raises(IntegrationConnectionError):
        FtrackConnector().connect()


def test_connect_wraps_unexpected_error(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _configure_env(monkeypatch, tmp_path)

    def _raise_runtime_error(**kwargs: object) -> None:
        raise RuntimeError("something else")

    monkeypatch.setattr(connector_module.ftrack_api, "Session", _raise_runtime_error)

    with pytest.raises(IntegrationError):
        FtrackConnector().connect()


def test_close_clears_session_and_calls_session_close(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_env(monkeypatch, tmp_path)
    closed_flags: list[bool] = []
    monkeypatch.setattr(
        connector_module.ftrack_api, "Session", lambda **kwargs: _FakeSession(closed_flags)
    )

    conn = FtrackConnector()
    conn.connect()
    conn.close()

    assert closed_flags == [True]
    assert conn.is_connected is False


def test_context_manager_connects_and_closes(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    _configure_env(monkeypatch, tmp_path)
    closed_flags: list[bool] = []
    monkeypatch.setattr(
        connector_module.ftrack_api, "Session", lambda **kwargs: _FakeSession(closed_flags)
    )

    with FtrackConnector() as conn:
        assert conn.is_connected is True

    assert closed_flags == [True]
