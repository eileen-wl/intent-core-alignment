"""Internal-service authentication for the trusted ftrack Version/
ReviewNote sync endpoints (Step 8C-3;
docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §8, ADR-0014
Decision 3).

A single shared-secret header (``X-Internal-Sync-Token``), deliberately
distinct from and unrelated to the ordinary human ``X-Actor-Role``/
``X-Actor-Id`` headers (``workflow.actors.get_current_actor``): this
dependency grants no ``ActorContext``, no ``human_role``, and is never
recognized by ``require_human_role`` or any permission check. It only
answers "is this caller the trusted internal sync client (eventually
``services/worker`` via ``services/ftrack-connector``), not an arbitrary
network client" -- nothing more. A Human role header alone, with no
internal token, must never satisfy these endpoints; the internal token
must never grant access to any Human-only route (neither is wired here,
so both hold by construction, not by an extra check).
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import Header, HTTPException

from intent_core_api.config import get_settings

INTERNAL_SYNC_TOKEN_HEADER = "X-Internal-Sync-Token"


async def require_internal_sync_token(
    x_internal_sync_token: Annotated[str | None, Header(alias=INTERNAL_SYNC_TOKEN_HEADER)] = None,
) -> None:
    """Fails closed: an unconfigured server-side token (blank
    ``internal_sync_token``) rejects every request outright -- it is
    never treated as "no auth required". Never logs, echoes, or includes
    either the supplied or the configured token value in any response;
    only the fact of accept/reject is observable. Uses
    ``hmac.compare_digest`` (timing-safe) rather than ``==`` so response
    timing cannot be used to guess the token character-by-character.
    """
    configured_token = get_settings().internal_sync_token
    if not configured_token:
        raise HTTPException(status_code=503, detail="Internal sync is not configured")
    if not x_internal_sync_token:
        raise HTTPException(status_code=401, detail=f"Missing {INTERNAL_SYNC_TOKEN_HEADER} header")
    if not hmac.compare_digest(x_internal_sync_token, configured_token):
        raise HTTPException(status_code=401, detail="Invalid internal sync token")
