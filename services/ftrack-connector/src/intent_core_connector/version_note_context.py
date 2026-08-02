"""Read AssetVersion/Note context from ftrack for the trusted internal
sync API (Step 8C-4/8C-5; docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md
§4-§6/§13, docs/step-8/01_STEP_8A_FTRACK_VERSION_NOTE_RELATIONSHIP_VALIDATION.md).

Still read-only, still no persistence (ADR-0008): this module only ever
calls ``session.query(...)``, never ``session.create``/``create_note``/
``update``/``delete``/``commit``. Every query here is targeted -- scoped
to one already-linked Shot or one already-read AssetVersion -- never a
workspace-wide fetch, matching Step 8B's locked reconciliation strategy
(a complete per-linked-Shot sweep, not incremental polling).

Two real, empirically-confirmed ftrack quirks this module encodes
directly (Step 8A §7/§11, Step 8B §3):

- ``Note.parent_type`` is filter-comparable only in snake_case
  (``"asset_version"``, ``"review_session_object"``), even though the
  same field's *displayed* value renders in PascalCase. Using the
  PascalCase form in a ``where`` clause silently returns zero rows.
- A guest/client reviewer's ``Note.author`` relation, when present,
  reliably carries a stable ``id`` even without a ``username`` -- so
  ``external_author_id`` is only ever null when the ``author``/``user``
  relation itself is absent, never merely because ``username`` is
  unset.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import ftrack_api
from pydantic import BaseModel, Field

from intent_core_connector.errors import IntegrationError

# ADR-0012's write-back Note content marker -- a Note carrying this
# prefix is ICAS's own prior write-back echo, never organic ftrack
# feedback, and must never be read back in as an incoming ReviewNote
# (Step 8B §13).
WRITE_BACK_MARKER = "[Intent Core Alignment System]"


class AssetVersionContext(BaseModel):
    """One real AssetVersion, ready to post to
    ``POST /internal/sync/versions`` (Step 8B §13 field mapping)."""

    external_id: str
    shot_external_id: str
    task_external_id: str | None = None
    # Derived per the locked contract: f"{asset_name}_v{version:03d}"
    # (no direct 1:1 ftrack field for a Version's own name).
    name: str
    asset_name: str
    version_number: int
    comment: str
    source_created_at: datetime
    external_author_id: str | None = None
    external_author_name: str | None = None


class NoteContext(BaseModel):
    """One real Note, ready to post to
    ``POST /internal/sync/review-notes`` (Step 8B §13 field mapping).
    Already resolved to its owning AssetVersion's external id, whether
    the Note was ``asset_version``-direct or reached via one
    ``ReviewSessionObject`` hop -- the caller never needs to know which.
    """

    external_id: str
    version_external_id: str
    content: str
    source_created_at: datetime
    external_author_id: str | None = None
    external_author_name: str | None = None


class AssetVersionSweepWarning(BaseModel):
    """One AssetVersion this sweep could not safely include, and why --
    never silently dropped."""

    external_id: str
    reason: str


class AssetVersionSweepResult(BaseModel):
    versions: list[AssetVersionContext] = Field(default_factory=list)
    warnings: list[AssetVersionSweepWarning] = Field(default_factory=list)


class DirectNoteResult(BaseModel):
    notes: list[NoteContext] = Field(default_factory=list)
    write_back_echoes_excluded: int = 0


class ReviewSessionObjectNoteResult(BaseModel):
    notes: list[NoteContext] = Field(default_factory=list)
    review_session_objects_examined: int = 0
    # A live ReviewSessionObject (this sweep only ever discovers live
    # ones -- see module docstring) whose Note sub-query itself failed
    # for some other reason (permissions, transient error, malformed
    # data). An expected, logged skip, never a run-wide failure (Step
    # 8B §12; this task's own instruction not to attempt recovering the
    # already-deleted ReviewSessionObjects Step 8B separately found via
    # the reverse Note-to-parent direction, which this module never
    # traverses).
    review_session_objects_unresolved: int = 0
    write_back_echoes_excluded: int = 0


def _to_datetime(value: Any) -> datetime:
    """ftrack_api returns an ``arrow.Arrow`` for a date-typed field, not
    a plain ``datetime`` -- pydantic does not coerce that automatically.
    Duck-typed so a real Arrow value and a plain ``datetime`` (as used
    directly in this module's fake-session tests) both work.
    """
    maybe_datetime = getattr(value, "datetime", None)
    if isinstance(maybe_datetime, datetime):
        return maybe_datetime
    if isinstance(value, datetime):
        return value
    raise TypeError(f"Unexpected date value type: {type(value)!r}")


def _author_fields(row: dict[str, Any], key: str) -> tuple[str | None, str | None]:
    """``external_author_id``/``external_author_name`` are independently
    nullable (Step 8B §7/§13): ``id`` is only null when the relation
    itself is absent; ``username`` falls back to a first/last-name
    display when unset (real, common for guest/client reviewers).
    """
    author = row.get(key)
    if not author:
        return None, None
    author_id = author.get("id")
    username = author.get("username")
    if username:
        return author_id, username
    first = author.get("first_name") or ""
    last = author.get("last_name") or ""
    display = f"{first} {last}".strip()
    return author_id, (display or None)


def read_asset_versions_for_shot(
    session: ftrack_api.Session, *, shot_external_id: str
) -> AssetVersionSweepResult:
    """Targeted equivalent of ``AssetVersion where asset.parent.id is
    "<shot_external_id>"`` -- every AssetVersion belonging to this one
    already-linked Shot, in a single query, no workspace-wide fetch and
    no arbitrary sample cap (Step 8B §4). Asset-Build/no-Shot
    AssetVersions never appear here by construction: the query itself
    starts from a real Shot id.
    """
    try:
        rows = list(
            session.query(
                "select id, version, asset.name, task.id, task.parent.id, "
                "comment, date, user.id, user.username, "
                "user.first_name, user.last_name "
                f'from AssetVersion where asset.parent.id is "{shot_external_id}"'
            )
        )
    except Exception as exc:  # noqa: BLE001 -- per-Shot isolation, not fatal to the run
        raise IntegrationError(
            f"Failed to read AssetVersions for Shot {shot_external_id}: {exc}"
        ) from exc

    result = AssetVersionSweepResult()
    for row in rows:
        version_ext_id = row.get("id", "<unknown>")
        try:
            task = row.get("task")
            task_ext_id = task["id"] if task else None
            task_parent = task.get("parent") if task else None
            task_parent_id = task_parent.get("id") if task_parent else None
            # Cross-check (Step 8A §6): asset.parent.id (the query's own
            # filter) and task.parent.id must agree when a Task exists.
            # A real, if rare, disagreement means this row's Shot
            # lineage is ambiguous -- skip and report it, never guess.
            if task_parent_id is not None and task_parent_id != shot_external_id:
                result.warnings.append(
                    AssetVersionSweepWarning(
                        external_id=version_ext_id, reason="shot_lineage_disagreement"
                    )
                )
                continue

            asset_name = row["asset"]["name"] if row.get("asset") else ""
            version_number = row["version"]
            author_id, author_name = _author_fields(row, "user")
            result.versions.append(
                AssetVersionContext(
                    external_id=version_ext_id,
                    shot_external_id=shot_external_id,
                    task_external_id=task_ext_id,
                    name=f"{asset_name}_v{version_number:03d}",
                    asset_name=asset_name,
                    version_number=version_number,
                    comment=row.get("comment") or "",
                    source_created_at=_to_datetime(row["date"]),
                    external_author_id=author_id,
                    external_author_name=author_name,
                )
            )
        except Exception as exc:  # noqa: BLE001 -- one malformed row must not abort the sweep
            result.warnings.append(
                AssetVersionSweepWarning(external_id=version_ext_id, reason=f"malformed_row: {exc}")
            )
    return result


def read_direct_notes_for_asset_version(
    session: ftrack_api.Session, *, version_external_id: str
) -> DirectNoteResult:
    """Notes attached directly to one AssetVersion -- real
    filter-comparable ``parent_type is "asset_version"`` (snake_case;
    Step 8A §11.3), scoped to this one AssetVersion id, never a
    workspace-wide Note fetch (Step 8B §5).
    """
    try:
        rows = list(
            session.query(
                "select id, content, date, author.id, author.username, "
                "author.first_name, author.last_name "
                'from Note where parent_type is "asset_version" and parent_id is '
                f'"{version_external_id}"'
            )
        )
    except Exception as exc:  # noqa: BLE001 -- per-Version isolation, not fatal to the run
        raise IntegrationError(
            f"Failed to read direct Notes for AssetVersion {version_external_id}: {exc}"
        ) from exc

    result = DirectNoteResult()
    for row in rows:
        content = row.get("content") or ""
        if content.startswith(WRITE_BACK_MARKER):
            result.write_back_echoes_excluded += 1
            continue
        author_id, author_name = _author_fields(row, "author")
        result.notes.append(
            NoteContext(
                external_id=row["id"],
                version_external_id=version_external_id,
                content=content,
                source_created_at=_to_datetime(row["date"]),
                external_author_id=author_id,
                external_author_name=author_name,
            )
        )
    return result


def read_review_session_object_notes_for_asset_version(
    session: ftrack_api.Session, *, version_external_id: str
) -> ReviewSessionObjectNoteResult:
    """Notes reaching this AssetVersion via one ``ReviewSessionObject``
    hop (Step 8B §5-6): first the live ReviewSessionObjects referencing
    this AssetVersion, then each one's Notes via the real
    filter-comparable ``parent_type is "review_session_object"``
    (snake_case) and its exact id. Only ever examines
    ReviewSessionObjects the first query itself proves are live --
    never attempts the reverse (Note-parent-id-to-ReviewSessionObject)
    recovery Step 8B found mostly orphaned, per this task's own
    instruction.
    """
    try:
        rso_rows = list(
            session.query(
                "select id from ReviewSessionObject "
                f'where asset_version.id is "{version_external_id}"'
            )
        )
    except Exception as exc:  # noqa: BLE001 -- per-Version isolation, not fatal to the run
        raise IntegrationError(
            f"Failed to read ReviewSessionObjects for AssetVersion {version_external_id}: {exc}"
        ) from exc

    result = ReviewSessionObjectNoteResult()
    for rso_row in rso_rows:
        rso_id = rso_row.get("id", "<unknown>")
        result.review_session_objects_examined += 1
        try:
            note_rows = list(
                session.query(
                    "select id, content, date, author.id, author.username, "
                    "author.first_name, author.last_name "
                    'from Note where parent_type is "review_session_object" and parent_id is '
                    f'"{rso_id}"'
                )
            )
        except Exception:  # noqa: BLE001 -- an unresolved/malformed RSO is expected, not fatal
            result.review_session_objects_unresolved += 1
            continue

        for row in note_rows:
            content = row.get("content") or ""
            if content.startswith(WRITE_BACK_MARKER):
                result.write_back_echoes_excluded += 1
                continue
            author_id, author_name = _author_fields(row, "author")
            result.notes.append(
                NoteContext(
                    external_id=row["id"],
                    version_external_id=version_external_id,
                    content=content,
                    source_created_at=_to_datetime(row["date"]),
                    external_author_id=author_id,
                    external_author_name=author_name,
                )
            )
    return result
