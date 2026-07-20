"""Read-only sample of real entity instances (F1: connect + read).

Extends discovery.py's schema-only report with a small, capped read of
actual Project/Shot/Task/AssetVersion/Note data -- still read-only,
still no entity mapping, still no persistence (ADR-0008: this service
never writes to Postgres). Each entity type is queried independently
so one query failing (e.g. a field name that doesn't exist in a given
workspace's schema) doesn't hide the others; failures are recorded in
the report rather than raised, since this is an exploratory
verification tool, not the sync path (docs/FTRACK_INTEGRATION.md §16
open questions are meant to be answered empirically, one workspace at
a time -- a failure here is itself a finding).
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import ftrack_api
from pydantic import BaseModel, Field

_DEFAULT_LIMIT = 5


class ProjectSample(BaseModel):
    id: str
    name: str
    full_name: str


class ShotSample(BaseModel):
    id: str
    name: str
    parent_name: str | None = None


class TaskSample(BaseModel):
    id: str
    name: str
    type_name: str | None = None
    status_name: str | None = None
    parent_name: str | None = None


class VersionSample(BaseModel):
    id: str
    version_number: int
    asset_name: str | None = None
    task_name: str | None = None
    status_name: str | None = None


class NoteSample(BaseModel):
    id: str
    content: str
    author_name: str | None = None


class SampleEntityReport(BaseModel):
    """Capped, read-only sample of real entity instances.

    Per-entity-type errors are recorded in `errors` rather than raised,
    so a schema mismatch in one entity type doesn't hide findings for
    the others.
    """

    projects: list[ProjectSample] = Field(default_factory=list)
    shots: list[ShotSample] = Field(default_factory=list)
    tasks: list[TaskSample] = Field(default_factory=list)
    versions: list[VersionSample] = Field(default_factory=list)
    notes: list[NoteSample] = Field(default_factory=list)
    errors: dict[str, str] = Field(default_factory=dict)


def _take[T](rows: Iterable[T], limit: int) -> list[T]:
    result: list[T] = []
    for row in rows:
        result.append(row)
        if len(result) >= limit:
            break
    return result


def _relation_name(row: dict[str, Any], key: str) -> str | None:
    related = row.get(key)
    return related["name"] if related else None


def read_sample_entities(
    session: ftrack_api.Session, *, limit: int = _DEFAULT_LIMIT
) -> SampleEntityReport:
    report = SampleEntityReport()

    try:
        rows = _take(session.query("select id, name, full_name from Project"), limit)
        report.projects = [
            ProjectSample(id=row["id"], name=row["name"], full_name=row["full_name"])
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001 -- recorded per-entity-type, not raised
        report.errors["projects"] = str(exc)

    try:
        rows = _take(session.query("select id, name, parent.name from Shot"), limit)
        report.shots = [
            ShotSample(id=row["id"], name=row["name"], parent_name=_relation_name(row, "parent"))
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001
        report.errors["shots"] = str(exc)

    try:
        rows = _take(
            session.query("select id, name, type.name, status.name, parent.name from Task"),
            limit,
        )
        report.tasks = [
            TaskSample(
                id=row["id"],
                name=row["name"],
                type_name=_relation_name(row, "type"),
                status_name=_relation_name(row, "status"),
                parent_name=_relation_name(row, "parent"),
            )
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001
        report.errors["tasks"] = str(exc)

    try:
        rows = _take(
            session.query(
                "select id, version, asset.name, task.name, status.name from AssetVersion"
            ),
            limit,
        )
        report.versions = [
            VersionSample(
                id=row["id"],
                version_number=row["version"],
                asset_name=_relation_name(row, "asset"),
                task_name=_relation_name(row, "task"),
                status_name=_relation_name(row, "status"),
            )
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001
        report.errors["versions"] = str(exc)

    try:
        rows = _take(
            session.query("select id, content, author.first_name, author.last_name from Note"),
            limit,
        )
        report.notes = [
            NoteSample(
                id=row["id"],
                content=row["content"],
                author_name=(
                    f"{row['author']['first_name']} {row['author']['last_name']}"
                    if row.get("author")
                    else None
                ),
            )
            for row in rows
        ]
    except Exception as exc:  # noqa: BLE001
        report.errors["notes"] = str(exc)

    return report
