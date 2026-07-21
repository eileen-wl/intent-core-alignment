"""Shared, dialect-portable serialization primitive for
``CoreAnchor.active_revision_id`` -- used identically by CoreAnchor
confirmation, ExecutionAnchor draft creation, and ExecutionAnchor
confirmation (see the approved WP-A2 plan, concurrency addendum).

A compare-and-swap ``UPDATE`` -- not a ``SELECT`` -- is the actual commit
gate in all three callers. A ``SELECT``, even a bare-scalar one issued
mid-transaction, reflects that transaction's own snapshot and is not
guaranteed to observe another transaction's newly committed value under
SQLite or PostgreSQL snapshot isolation. An ``UPDATE ... WHERE <expected>``
does not have this problem: a conflicting writer must wait for the row's
write lock and then evaluates the ``WHERE`` clause against the true latest
committed value, not a stale snapshot.

This is layered *underneath* (not replaced by) ``SELECT ... FOR UPDATE``
on PostgreSQL, which additionally provides real row-level locking and lets
callers read-then-decide with confidence before performing the CAS. On
SQLite, ``FOR UPDATE`` is a no-op and this CAS is the entire protection.

Lives in its own module, imported by both ``core_anchor_service.py`` and
``execution_anchor_service.py``, so neither service imports the other.
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from sqlalchemy import update
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.intent.models import CoreAnchor
from intent_core_api.workflow.exceptions import ConflictError

_RETRIABLE_SQLITE_ERRORNAME_PREFIXES = ("SQLITE_BUSY", "SQLITE_LOCKED")
_RETRIABLE_SQLITE_MESSAGE_SUBSTRINGS = ("database is locked", "database table is locked")
_RETRIABLE_POSTGRES_SQLSTATES = frozenset(
    {"40001", "40P01"}
)  # serialization_failure, deadlock_detected


def _is_recognized_retriable_db_error(exc: OperationalError) -> bool:
    """True only for errors that mean "another transaction is contending
    for this row right now, retry" -- SQLite SQLITE_BUSY/SQLITE_LOCKED
    (by errorname, falling back to message substrings) and PostgreSQL
    serialization_failure/deadlock_detected (by SQLSTATE, as exposed by
    asyncpg via ``orig.sqlstate``). Anything else (schema errors,
    permission errors, connectivity failures, ...) is NOT a client
    concurrency conflict and must not be reported as one.
    """
    orig = exc.orig
    if orig is None:
        return False
    sqlstate = getattr(orig, "sqlstate", None)
    if sqlstate in _RETRIABLE_POSTGRES_SQLSTATES:
        return True
    errorname = getattr(orig, "sqlite_errorname", None)
    if errorname and errorname.startswith(_RETRIABLE_SQLITE_ERRORNAME_PREFIXES):
        return True
    message = str(orig).lower()
    return any(substring in message for substring in _RETRIABLE_SQLITE_MESSAGE_SUBSTRINGS)


async def compare_and_swap_active_revision(
    session: AsyncSession,
    core_anchor_id: uuid.UUID,
    expected_active_revision_id: uuid.UUID | None,
    new_active_revision_id: uuid.UUID | None,
) -> None:
    """Atomically verify ``CoreAnchor(core_anchor_id).active_revision_id``
    is still ``expected_active_revision_id``, and set it to
    ``new_active_revision_id`` in the same statement.

    A verify-only call (nothing should actually change) is expressed by
    passing the same value for both parameters -- used by Execution draft
    creation and Execution confirmation. CoreAnchor confirmation passes
    the newly confirmed revision's id as ``new_active_revision_id``, a
    genuine change.

    MUST be the first mutating operation in every caller: invoked before
    any ``session.add()``, attribute mutation, or ``record_*()`` call (all
    of which flush internally), so a CAS failure never needs to unwind any
    partial application-level state.

    Raises ``ConflictError`` (-> 409) if the row no longer matches the
    expected value, or on a recognised retriable lock/busy/serialization
    error. Any other ``OperationalError`` is rolled back and re-raised
    unchanged -- never misreported as a client concurrency conflict.
    """
    stmt = (
        update(CoreAnchor)
        .where(CoreAnchor.id == core_anchor_id)
        .where(CoreAnchor.active_revision_id.is_not_distinct_from(expected_active_revision_id))
        .values(active_revision_id=new_active_revision_id)
    )
    try:
        result = cast(CursorResult[Any], await session.execute(stmt))
    except OperationalError as exc:
        await session.rollback()
        if _is_recognized_retriable_db_error(exc):
            raise ConflictError(
                "Database busy verifying Core Anchor state; retry the request"
            ) from None
        raise
    if result.rowcount != 1:
        await session.rollback()
        raise ConflictError(
            "The current confirmed CoreAnchorRevision changed since this operation began; retry"
        )
