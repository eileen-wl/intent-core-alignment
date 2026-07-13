import pytest
from intent_core_connector.config import get_settings
from intent_core_connector.connector import FtrackConnector


def test_health_reports_unconfigured_without_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("FTRACK_SERVER", raising=False)
    monkeypatch.delenv("FTRACK_API_USER", raising=False)
    monkeypatch.delenv("FTRACK_API_KEY", raising=False)
    get_settings.cache_clear()

    health = FtrackConnector().health()

    assert health.configured is False
    get_settings.cache_clear()


def test_connect_is_not_implemented() -> None:
    with pytest.raises(NotImplementedError):
        FtrackConnector().connect()
