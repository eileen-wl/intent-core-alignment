"""Request/response schema for the transient, read-only Version media
resolution capability (Step 9B-4;
docs/step-9/06_STEP_9B4_REAL_MEDIA_AND_FTRACK_CONTEXT.md).

Never persisted: every field on ``VersionMediaRead`` is resolved fresh,
server-side, per request, from a live ftrack read via the Connector --
no migration, no stored column, no cached signed URL. ``media_state``
is the one field a caller must branch on; every other field is
genuinely nullable rather than fabricated when unavailable (§2 of the
locked task).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.api.production_context import RecordSource

VersionMediaState = Literal[
    "playable",
    "thumbnail_only",
    "external_context_only",
    "unavailable",
]


class VersionMediaRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    version_id: UUID
    # Mirrors the underlying Version's own real `source` field -- never
    # implies ftrack linkage on its own; see `ftrack_linked` for that.
    source: RecordSource
    ftrack_linked: bool

    media_state: VersionMediaState

    thumbnail_url: str | None
    playable_url: str | None
    playable_media_type: str | None
    playable_component_name: str | None

    # Omitted (always `None`) unless a stable, safely-constructible
    # ftrack web deep link was proven reliable for this workspace during
    # Step 9B-4 -- see docs/step-9/06_STEP_9B4_...md §11. Never a guessed
    # URL format.
    external_web_url: str | None

    resolved_at: datetime
    # Only ever set if the real ftrack source itself exposes a signed-URL
    # expiry -- it does not, in the workspace this was built against
    # (docs/step-9/06_STEP_9B4_...md §7), so this is always `None` today,
    # kept as a real, honest field rather than removed, in case a future
    # workspace does expose one.
    url_expires_at: datetime | None

    unavailable_reason: str | None
