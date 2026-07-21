from typing import Any

import pytest
from intent_core_connector.connector import FtrackConnector
from intent_core_connector.errors import IntegrationError
from intent_core_connector.sample_entities import ProjectSample, read_sample_entities


class _FakeQuerySession:
    def __init__(
        self,
        rows_by_entity: dict[str, list[dict[str, Any]]],
        raise_for_entity: dict[str, Exception] | None = None,
    ) -> None:
        self._rows_by_entity = rows_by_entity
        self._raise_for_entity = raise_for_entity or {}

    def query(self, expression: str) -> list[dict[str, Any]]:
        for entity_name in self._raise_for_entity:
            if f"from {entity_name}" in expression:
                raise self._raise_for_entity[entity_name]
        for entity_name, rows in self._rows_by_entity.items():
            if f"from {entity_name}" in expression:
                return rows
        raise AssertionError(f"Unexpected query expression: {expression!r}")


def test_read_sample_entities_maps_all_entity_types() -> None:
    session = _FakeQuerySession(
        {
            "Project": [{"id": "p1", "name": "napo", "full_name": "Napo (Animation demo)"}],
            "Shot": [{"id": "s1", "name": "bc0030", "parent": {"name": "BikeChase"}}],
            "Task": [
                {
                    "id": "t1",
                    "name": "Modeling",
                    "type": {"name": "Modeling"},
                    "status": {"name": "In progress"},
                    "parent": {"name": "bc0030"},
                }
            ],
            "AssetVersion": [
                {
                    "id": "v1",
                    "version": 3,
                    "asset": {"name": "bc0040_comp"},
                    "task": {"name": "Comp"},
                    "status": {"name": "Pending Review"},
                }
            ],
            "Note": [
                {
                    "id": "n1",
                    "content": "Timing is a lot better.",
                    "author": {"first_name": "The Boss", "last_name": ""},
                },
                {"id": "n2", "content": "No author on this one.", "author": None},
            ],
        }
    )

    report = read_sample_entities(session, limit=5)

    expected_project = ProjectSample(id="p1", name="napo", full_name="Napo (Animation demo)")
    assert report.projects == [expected_project]
    assert report.shots[0].parent_name == "BikeChase"
    assert report.tasks[0].type_name == "Modeling"
    assert report.tasks[0].status_name == "In progress"
    assert report.versions[0].version_number == 3
    assert report.versions[0].asset_name == "bc0040_comp"
    assert report.notes[0].author_name == "The Boss "
    assert report.notes[1].author_name is None
    assert report.errors == {}


def test_read_sample_entities_caps_at_limit() -> None:
    session = _FakeQuerySession(
        {
            "Project": [
                {"id": f"p{i}", "name": f"proj{i}", "full_name": f"Project {i}"} for i in range(10)
            ],
            "Shot": [],
            "Task": [],
            "AssetVersion": [],
            "Note": [],
        }
    )

    report = read_sample_entities(session, limit=3)

    assert len(report.projects) == 3


def test_read_sample_entities_records_per_entity_errors_without_raising() -> None:
    session = _FakeQuerySession(
        {
            "Project": [{"id": "p1", "name": "napo", "full_name": "Napo (Animation demo)"}],
            "Shot": [],
            "Task": [],
            "AssetVersion": [],
            "Note": [],
        },
        raise_for_entity={"Project": RuntimeError("field does not exist")},
    )

    report = read_sample_entities(session, limit=5)

    assert report.projects == []
    assert "projects" in report.errors
    assert "field does not exist" in report.errors["projects"]


def test_read_sample_entities_requires_prior_connect() -> None:
    with pytest.raises(IntegrationError):
        FtrackConnector().read_sample_entities()
