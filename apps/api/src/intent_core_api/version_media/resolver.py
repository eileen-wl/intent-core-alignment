"""Bridges the async FastAPI request path to the synchronous, blocking
ftrack Connector (Step 9B-4; docs/step-9/06_STEP_9B4_REAL_MEDIA_AND_FTRACK_CONTEXT.md).

This is the only module in ``apps/api`` that ever opens a real ftrack
session (CLAUDE.md: "Agents must not call ftrack directly. All external
production data must pass through the Connector") -- everywhere else in
this codebase, ftrack data reaches apps/api only via the trusted
``ftrack_version_note_sync`` internal endpoints, pushed by
``services/worker``. This capability is different in kind: it resolves
a transient, request-scoped, signed media URL that cannot be
pre-synced or persisted (the URL itself expires), so it must be
resolved live, per request, through the same Connector every other
ftrack read in this system already goes through.

The whole connect/resolve/close sequence runs inside a worker thread
(``asyncio.to_thread``) since ``ftrack_api.Session`` is fully
synchronous -- it must never block the event loop.
"""

from __future__ import annotations

import asyncio
from typing import Protocol

from intent_core_connector.connector import FtrackConnector
from intent_core_connector.media_context import AssetVersionMediaContext


class MediaResolver(Protocol):
    async def __call__(self, *, version_external_id: str) -> AssetVersionMediaContext: ...


def _resolve_sync(version_external_id: str) -> AssetVersionMediaContext:
    with FtrackConnector() as connector:
        return connector.read_media_context_for_asset_version(
            version_external_id=version_external_id
        )


async def resolve_media_context(*, version_external_id: str) -> AssetVersionMediaContext:
    """The real, default resolver. Opens one short-lived, read-only
    ftrack session per call -- never held across requests, never reused.
    Raises ``intent_core_connector.errors.IntegrationError`` (or a
    subclass) on a genuine connection/auth/query failure;
    ``version_media.service`` is responsible for downgrading that to an
    honest ``"unavailable"`` API response rather than a 5xx, since a
    ftrack outage must never erase or block access to the rest of the
    Version page (docs/step-9/06_STEP_9B4_...md §12)."""
    return await asyncio.to_thread(_resolve_sync, version_external_id)


async def get_media_resolver() -> MediaResolver:
    """FastAPI dependency provider -- the real resolver by default, with
    a single, explicit override seam (`app.dependency_overrides`) for
    tests, matching this codebase's existing `get_session` override
    convention (`tests/conftest.py`) rather than monkeypatching a
    function default."""
    return resolve_media_context
