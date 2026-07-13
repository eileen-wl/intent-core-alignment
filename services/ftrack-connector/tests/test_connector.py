from pathlib import Path

import pytest
from intent_core_connector.config import Settings, get_settings
from intent_core_connector.connector import FtrackConnector


def test_health_reports_unconfigured_without_credentials(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FTRACK_SERVER", raising=False)
    monkeypatch.delenv("FTRACK_API_USER", raising=False)
    monkeypatch.delenv("FTRACK_API_KEY", raising=False)
    # `Settings.model_config["env_file"]` is an absolute path to the
    # real repo-root `.env` (see config.py), so clearing env vars
    # alone isn't enough to simulate "unconfigured" -- a developer's
    # real `.env` (e.g. with real ftrack credentials) would otherwise
    # leak into this test via that file. Point env_file at a path
    # that's guaranteed not to exist for the duration of this test.
    monkeypatch.setitem(Settings.model_config, "env_file", tmp_path / "nonexistent.env")
    get_settings.cache_clear()

    health = FtrackConnector().health()

    assert health.configured is False
    get_settings.cache_clear()


def test_connect_is_not_implemented() -> None:
    with pytest.raises(NotImplementedError):
        FtrackConnector().connect()
