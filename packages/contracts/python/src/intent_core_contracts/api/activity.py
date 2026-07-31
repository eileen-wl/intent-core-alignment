"""Request/response schemas for the Shot Activity read model (Step 7C-3).

Read-only aggregation of already-persisted events across the Core
Anchor, Version/Review-Note, Cross-role Assessment, and integration
domains into one chronological timeline per Shot -- no new persisted
table, no fabricated entry. Every event traces back to a real row's own
timestamp: a ``CoreAnchorRevision``'s ``created_at``/``updated_at``, a
real recorded ``Decision``, a ``Version``/``ReviewNote``'s
``created_at``, a ``CrossRoleAssessment``/``ReAnchorProposal``'s
``created_at``, or an ``ExternalEntityLink``'s ``created_at``. See
``intent_core_api.activity.service`` for the aggregation itself.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

ActorKind = Literal["human", "agent", "system"]

ShotActivityEventType = Literal[
    "core_anchor_draft_created",
    "core_anchor_draft_updated",
    "core_anchor_confirmed",
    "core_anchor_draft_discarded",
    "production_version_recorded",
    "review_note_recorded",
    "alignment_assessment_created",
    "re_anchor_proposal_generated",
    "external_link_recorded",
]


class ShotActivityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    # Stable and deterministic -- never a random uuid -- so the same
    # underlying row always produces the same event id across requests.
    id: str
    event_type: ShotActivityEventType
    occurred_at: datetime
    actor_kind: ActorKind | None
    actor_id: str | None
    actor_human_role: HumanRole | None
    summary: str
    related_entity_type: str
    related_entity_id: UUID
    # The relevant Intent, Versions, or Alignment route for this Shot;
    # falls back to the Shot Overview route only for a Shot-level event
    # (e.g. an external/ftrack link) that is not itself about any one of
    # the three. Never the Activity route itself, and never a raw API path.
    route: str


class ShotActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    shot_id: UUID
    # Newest first.
    events: list[ShotActivityEventRead]
