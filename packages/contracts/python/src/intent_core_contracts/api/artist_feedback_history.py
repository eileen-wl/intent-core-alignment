"""Request/response schemas for the Artist-facing Task Feedback History
read model (Step 7C-5).

Mirrors `api.task_activity`'s event-record shape exactly (one bounded,
newest-first list, no new table, no fabricated entry) but is its own,
separate capability with its own event vocabulary -- Feedback History is
explicitly not the CG Activity tab reused: it is framed around what
feedback this Task received and what changed after it (Review Notes,
Artist Agent guidance generations, CG Supervisor reviews, Cross-role
Assessment findings, dependency/conflict/escalation changes, Production
Version references, and Human Decisions), never Execution Anchor draft/
save mechanics. Never modifies `task_activity` -- CG's Activity tab and
its locked test coverage are untouched.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.actors import HumanRole

ArtistFeedbackEventType = Literal[
    "version_recorded",
    "review_note_recorded",
    "artist_guidance_generated",
    "cg_supervisor_review_generated",
    "cross_role_assessment_involving_task",
    "dependency_recorded",
    "dependency_acknowledged",
    "dependency_resolved",
    "escalation_recorded",
    "execution_anchor_confirmed",
    "execution_anchor_draft_discarded",
]

ArtistFeedbackActorKind = Literal["human", "agent", "system"]


class ArtistFeedbackEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    id: str
    event_type: ArtistFeedbackEventType
    occurred_at: datetime
    actor_kind: ArtistFeedbackActorKind | None
    actor_id: str | None
    actor_human_role: HumanRole | None
    summary: str
    related_entity_type: str
    related_entity_id: UUID
    # The real Version this event concerns, when one applies -- never
    # fabricated for an event that has no genuine Version relationship
    # (e.g. a dependency record).
    related_version_id: UUID | None
    route: str


class ArtistFeedbackHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=False)

    task_id: UUID
    events: list[ArtistFeedbackEventRead]
