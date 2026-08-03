"""Read-only ftrack thumbnail resolution for one AssetVersion (Step
9B-4; docs/step-9/06_STEP_9B4_REAL_MEDIA_AND_FTRACK_CONTEXT.md).

Read-only, no persistence (ADR-0008): only ever calls ``session.query(
...)`` against ``AssetVersion``'s own server-computed ``thumbnail_url``
field -- never ``Location.get_url()``/``get_thumbnail_url()`` and never
``session.create``/``create_note``/``update``/``delete``/``commit``.

A real, safety-critical finding from this task's own live, read-only
probe against the controlled trial workspace: ``Location.get_url()``/
``get_thumbnail_url()`` (ftrack_api's own documented Component-URL-
resolution methods, this module's first implementation) build their
returned URL by embedding this process's *own* live ftrack API user and
API key directly as ``username``/``apiKey`` query-string parameters
(``ftrack_api/accessor/server.py``'s ``ServerAccessor.get_url``/
``get_thumbnail_url``) -- sending that URL to a browser would hand this
service's real ftrack credentials to every session that loads a
Version's media panel. No ``Component`` schema field exposes a safe,
credential-free equivalent (``FileComponent``'s real schema has no
``url``/``thumbnail_url`` property -- confirmed live, a
``ParseError: No attribute 'url' exists for schema 'Component'``). The
*only* safe, credential-free, server-signed URL this workspace exposes
is ``AssetVersion.thumbnail_url`` itself: a real, queryable schema
field whose resolved value is a ``{"url": ..., "value": ...}`` mapping,
both keys carrying the same real URL -- a ``cdn-eu3.ftrackapp.com``
Thumbor proxy wrapping a ``bristol-l.ftrackapp.com/component/get?id=
...&signature=...`` link (a one-time-scoped signature, never a reusable
account credential).

Per the task's own explicit instruction ("If direct browser access
requires an authenticated ftrack session and cannot work safely,
downgrade to thumbnail or external-context-only rather than proxying
credentials through ICAS"), this module therefore only ever resolves
the real, safe ``thumbnail_url`` field. ``AssetVersionMediaContext``
keeps its ``playable_*`` fields -- for forward compatibility with a
future ftrack workspace/SDK version that does expose a safe Component
URL field -- but this module never populates them today; every real
Version this connector resolves is honestly reported no higher than
``"thumbnail_only"`` by ``apps/api``'s ``version_media.service``.
"""

from __future__ import annotations

from typing import Any

import ftrack_api
from pydantic import BaseModel

from intent_core_connector.errors import IntegrationError


class AssetVersionMediaContext(BaseModel):
    """Transient result of one real, read-only media resolution --
    never persisted by any caller (Step 9B-4 §5/§7). ``exists=False``
    means the AssetVersion itself could not be found (deleted or the
    external id is otherwise stale) -- distinct from "found, but
    nothing resolvable," which returns ``exists=True`` with every URL
    field ``None``. ``playable_*`` fields are always ``None`` from this
    module today -- see the module docstring for why."""

    exists: bool
    thumbnail_url: str | None = None
    playable_url: str | None = None
    playable_media_type: str | None = None
    playable_component_name: str | None = None


def _safe_thumbnail_url(field: Any) -> str | None:
    """``AssetVersion.thumbnail_url`` resolves to a ``{"url": ...,
    "value": ...}`` mapping in every real sample this task observed --
    read defensively via ``.get``, never assume a single fixed key or a
    bare string, and never fabricate a URL when the field is empty."""
    if not field:
        return None
    if hasattr(field, "get"):
        url = field.get("url") or field.get("value")
        return url if isinstance(url, str) and url else None
    if isinstance(field, str):
        return field
    return None


def read_media_context_for_asset_version(
    session: ftrack_api.Session, *, version_external_id: str
) -> AssetVersionMediaContext:
    """Targeted, single-AssetVersion resolution -- never a workspace-
    wide fetch, matching every other module in this package."""
    try:
        rows = list(
            session.query(
                f'select thumbnail_url from AssetVersion where id is "{version_external_id}"'
            )
        )
    except Exception as exc:  # noqa: BLE001 -- surfaced to the caller, not swallowed
        raise IntegrationError(f"Failed to read AssetVersion {version_external_id}: {exc}") from exc

    if not rows:
        return AssetVersionMediaContext(exists=False)

    thumbnail_url = _safe_thumbnail_url(rows[0].get("thumbnail_url"))
    return AssetVersionMediaContext(exists=True, thumbnail_url=thumbnail_url)
