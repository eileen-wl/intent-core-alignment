"""Internal ftrack Version/ReviewNote sync payload and result contracts
(Step 8C-2; docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md §8/§13,
ADR-0014).

These are *not* the public manual-create contracts
(``VersionCreate``/``ReviewNoteCreate`` in ``api/versions_and_feedback.py``,
left untouched by this slice) -- they exist only for the trusted,
separately-authenticated internal sync endpoint the Step 8B contract
locked in. No router in this repository accepts these shapes yet
(that is Step 8C-3, not this slice); see
``intent_core_api.openapi_extra`` for why they nonetheless already
appear in the generated OpenAPI/TypeScript contracts ahead of that
endpoint's existence.

Deliberately excluded from every payload below, per the locked contract:

- ``source`` -- always hardcoded ``"ftrack"`` by the future service,
  never client-supplied (Step 8B §8's trusted-boundary decision).
- Any ICAS-internal id (``shot_id``/``task_id``/``version_id``) -- those
  are resolved server-side through ``ExternalEntityLink``, never
  accepted as input, so a client cannot claim linkage to a local row it
  doesn't actually own.
- ``created_by_actor_kind``/``created_by_actor_id``/
  ``created_by_human_role`` -- the future service hardcodes
  ``"system"``/``"ftrack-sync"``/``None`` (ADR-0014 Decision 2);
  accepting these from a client would let it forge a human actor
  identity.
- ``status``, ``category``, thread/reply, and Component/media fields --
  all explicit non-goals of the locked contract (Step 8B §14).
- Any ``SyncCursor`` field -- the locked reconciliation strategy creates
  no cursor for this sync (Step 8B §10, ADR-0014 Decision 4).

``source_created_at`` uses Pydantic's ``AwareDatetime`` (not plain
``datetime``) specifically so a naive timestamp is rejected at the
contract boundary rather than silently accepted and stored ambiguously
-- every real ``AssetVersion.date``/``Note.date`` value ftrack returns
is already timezone-aware (docs/step-8/01_..._VALIDATION.md §6-7), so
this enforces a real invariant, not an arbitrary strictness.
"""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


class VersionSyncCreate(BaseModel):
    """One AssetVersion, as the trusted internal sync endpoint (a later
    slice, not this one) will receive it. ``shot_external_id``/
    ``task_external_id`` are resolved to a local Shot/Task via
    ``ExternalEntityLink`` server-side -- never trusted as, and never
    matched by, a local id or a Task/Shot name.
    """

    # extra="forbid": a client cannot smuggle source (always hardcoded
    # "ftrack" server-side), an ICAS-internal shot_id/task_id, or
    # created_by_* through this payload -- see the module docstring.
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(min_length=1, max_length=200)
    shot_external_id: str = Field(min_length=1, max_length=200)
    task_external_id: str | None = Field(default=None, min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    version_number: int | None = None
    # Empty string allowed -- real AssetVersion.comment is sometimes
    # empty (docs/step-8/01_..._VALIDATION.md §8), unlike the manual
    # VersionCreate.description, which requires non-empty human input.
    description: str = ""
    source_created_at: AwareDatetime
    external_author_id: str | None = Field(default=None, max_length=200)
    external_author_name: str | None = Field(default=None, max_length=200)


class ReviewNoteSyncCreate(BaseModel):
    """One Note, as the trusted internal sync endpoint (a later slice,
    not this one) will receive it. ``version_external_id`` is resolved
    to a local Version via ``ExternalEntityLink`` server-side -- never
    trusted as, and never matched by, a local id.
    """

    # extra="forbid": same rationale as VersionSyncCreate above.
    model_config = ConfigDict(extra="forbid")

    external_id: str = Field(min_length=1, max_length=200)
    version_external_id: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    source_created_at: AwareDatetime
    external_author_id: str | None = Field(default=None, max_length=200)
    external_author_name: str | None = Field(default=None, max_length=200)


# The three, and only three, real outcomes the locked contract's
# reconciliation strategy defines (Step 8B §10/§12): a new local row was
# created; an already-linked row already exists (a true no-op, never an
# update -- Step 8B §8/§11); or required lineage could not be resolved
# and the item was skipped and logged, never guessed.
SyncOutcome = Literal["created", "already_exists", "skipped"]


class VersionNoteSyncItemResult(BaseModel):
    """One sync item's outcome, shared by both the future Version and
    ReviewNote sync endpoints (a later slice, not this one) -- enough
    for the worker to log and report a reconciliation run's results
    without exposing any ExternalEntityLink internal id, credential, or
    token.
    """

    outcome: SyncOutcome
    # The local ICAS row's id -- populated for "created" and
    # "already_exists" (a local row exists either way); null for
    # "skipped" (no local row was created or matched).
    entity_id: UUID | None = None
    external_id: str
    # Populated for "skipped" -- e.g. "shot_not_linked",
    # "version_not_linked" (ReviewNote), or "review_session_object_
    # unresolvable" (Step 8B §5/§12 -- expected for the large majority
    # of review_session_object-parented Notes in the real controlled
    # workspace). Also populated for a "created" Version whose optional
    # task_external_id was supplied but did not resolve (task_id=None,
    # Step 8B §13's explicit "skip only the task_id assignment, not the
    # whole Version" rule) -- e.g. "task_not_linked" -- so the future
    # worker can report a partial-lineage creation distinctly from a
    # fully-resolved one, without inventing a fourth SyncOutcome. Free
    # text, not a Literal: the real Step 8C-3 reasons are not yet
    # enumerated against a real sync run, and inventing a closed set now
    # would be a guess.
    reason: str | None = None
