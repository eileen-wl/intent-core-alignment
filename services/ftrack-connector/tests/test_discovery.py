from typing import Any

import ftrack_api.exception
import pytest
from intent_core_connector.connector import FtrackConnector
from intent_core_connector.discovery import WorkspaceDiscoveryReport, discover_workspace
from intent_core_connector.errors import IntegrationError


class _FakeQuerySession:
    def __init__(
        self,
        rows_by_entity: dict[str, list[dict[str, Any]]],
        raise_error: Exception | None = None,
    ) -> None:
        self._rows_by_entity = rows_by_entity
        self._raise_error = raise_error

    def query(self, expression: str) -> list[dict[str, Any]]:
        if self._raise_error is not None:
            raise self._raise_error
        for entity_name, rows in self._rows_by_entity.items():
            if entity_name in expression:
                return rows
        raise AssertionError(f"Unexpected query expression: {expression!r}")


def test_discover_workspace_returns_report_shape() -> None:
    session = _FakeQuerySession(
        {
            "ObjectType": [{"name": "Shot"}, {"name": "Sequence"}, {"name": "Task"}],
            "Status": [{"name": "In Progress"}, {"name": "Approved"}],
            "CustomAttributeConfiguration": [
                {
                    "key": "fstart",
                    "label": "Frame start",
                    "entity_type": "task",
                    "object_type": {"name": "Shot"},
                },
                {
                    "key": "priority",
                    "label": "Priority",
                    "entity_type": "task",
                    "object_type": None,
                },
            ],
        }
    )

    report = discover_workspace(session, server_url="https://example.ftrackapp.com")

    assert report.server_url == "https://example.ftrackapp.com"
    assert report.object_type_names == ["Sequence", "Shot", "Task"]
    assert report.status_names == ["Approved", "In Progress"]
    assert len(report.custom_attribute_configurations) == 2
    by_key = {cac.key: cac for cac in report.custom_attribute_configurations}
    assert by_key["fstart"].object_type_name == "Shot"
    assert by_key["priority"].object_type_name is None


def test_discover_workspace_wraps_query_failure() -> None:
    session = _FakeQuerySession({}, raise_error=ftrack_api.exception.ServerError("boom"))

    with pytest.raises(IntegrationError):
        discover_workspace(session, server_url="https://example.ftrackapp.com")


def test_discovery_report_has_no_mapping_fields() -> None:
    forbidden = {
        "sequence_object_type",
        "shot_object_type",
        "status_mapping",
        "task_type_to_department",
        "allowed_write_back_fields",
        "relevant_custom_attributes",
    }
    assert forbidden.isdisjoint(WorkspaceDiscoveryReport.model_fields)


def test_discover_workspace_requires_prior_connect() -> None:
    with pytest.raises(IntegrationError):
        FtrackConnector().discover_workspace()
