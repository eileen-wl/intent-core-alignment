"""Read Shot context (Project -> Shot -> Task) from ftrack.

F2's read half (docs/FTRACK_INTEGRATION.md §2): still read-only, still
no persistence. The push-to-apps/api half lives in sync_client.py.
`read_one_shot_context` picks the alphabetically-first Shot in the
workspace so repeat runs target the same real Shot (useful for
demonstrating idempotent sync). `read_shot_contexts_updated_since`
(ADR-0011) supports the reconciliation job in services/worker.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import ftrack_api
from pydantic import BaseModel

from intent_core_connector.errors import IntegrationError

_DEFAULT_RECONCILIATION_LIMIT = 20


class ProjectContext(BaseModel):
    external_id: str
    name: str
    full_name: str


class TaskContext(BaseModel):
    external_id: str
    name: str
    department: str | None = None


class ShotContext(BaseModel):
    external_id: str
    name: str
    project: ProjectContext
    task: TaskContext | None = None


def _read_first_task(session: ftrack_api.Session, *, shot_id: str) -> TaskContext | None:
    # The Shot id was just read from this same session, not external
    # input -- string interpolation here matches ftrack's own documented
    # query-language usage, not a client-facing query.
    tasks = list(
        session.query(
            f'select id, name, type.name from Task where parent.id is "{shot_id}" order by name'
        )
    )
    if not tasks:
        return None
    task_row = tasks[0]
    return TaskContext(
        external_id=task_row["id"],
        name=task_row["name"],
        department=(task_row["type"]["name"] if task_row.get("type") else None),
    )


def _build_shot_context(session: ftrack_api.Session, shot_row: dict[str, Any]) -> ShotContext:
    try:
        task = _read_first_task(session, shot_id=shot_row["id"])
    except Exception as exc:  # noqa: BLE001 -- exploratory read, see errors.py
        raise IntegrationError(f"Failed to read Task under Shot {shot_row['id']}: {exc}") from exc

    return ShotContext(
        external_id=shot_row["id"],
        name=shot_row["name"],
        project=ProjectContext(
            external_id=shot_row["project"]["id"],
            name=shot_row["project"]["name"],
            full_name=shot_row["project"]["full_name"],
        ),
        task=task,
    )


def read_one_shot_context(session: ftrack_api.Session) -> ShotContext | None:
    try:
        shots = list(
            session.query(
                "select id, name, project.id, project.name, project.full_name "
                "from Shot order by name"
            )
        )
    except Exception as exc:  # noqa: BLE001
        raise IntegrationError(f"Failed to read Shot for context sync: {exc}") from exc

    if not shots:
        return None
    return _build_shot_context(session, shots[0])


def read_shot_contexts_with_new_tasks_since(
    session: ftrack_api.Session, *, since: datetime, limit: int = _DEFAULT_RECONCILIATION_LIMIT
) -> list[ShotContext]:
    """Shots with a Task created after `since` (ADR-0011 reconciliation).

    `Shot` has no queryable `updated_at`/modification-timestamp attribute
    in this workspace's schema (verified empirically -- `Shot.attributes`
    only has `created_at`; docs/DOMAIN_MODEL.md §12 flags this kind of
    field as requiring validation, not assuming it exists). New-Task
    creation under a Shot is the closest available proxy for "this Shot
    has recent activity" without one. One ShotContext per distinct parent
    Shot; when a Shot has multiple new Tasks, only the first (by
    `created_at`) is attached -- matches `read_one_shot_context`'s
    one-task-per-context shape, not a full Task list.
    """
    since_str = since.strftime("%Y-%m-%d %H:%M:%S")
    try:
        rows = list(
            session.query(
                "select id, name, type.name, parent.id, parent.name, "
                "parent.object_type.name, project.id, project.name, project.full_name "
                f'from Task where created_at after "{since_str}" order by created_at'
            )
        )
    except Exception as exc:  # noqa: BLE001
        raise IntegrationError(f"Failed to read new Tasks since {since_str}: {exc}") from exc

    contexts: dict[str, ShotContext] = {}
    for row in rows:
        parent = row.get("parent")
        if parent is None or parent.get("object_type", {}).get("name") != "Shot":
            continue  # only Shot-level sync is supported (production_context scope)
        shot_id = parent["id"]
        if shot_id in contexts:
            continue  # keep the first (earliest) new Task found per Shot
        contexts[shot_id] = ShotContext(
            external_id=shot_id,
            name=parent["name"],
            project=ProjectContext(
                external_id=row["project"]["id"],
                name=row["project"]["name"],
                full_name=row["project"]["full_name"],
            ),
            task=TaskContext(
                external_id=row["id"],
                name=row["name"],
                department=(row["type"]["name"] if row.get("type") else None),
            ),
        )
        if len(contexts) >= limit:
            break

    return list(contexts.values())
