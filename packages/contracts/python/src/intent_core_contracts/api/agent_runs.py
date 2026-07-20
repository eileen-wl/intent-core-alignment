"""Read schemas for ``ContextSnapshot`` and ``AgentRun`` (WP-B1.5).

Deliberately not ``intent_core_contracts.agents.envelope``
(``AgentOutputEnvelope``/``AgentRunRecord``): that shape is for advisory
Agent outputs (observations/inferences/evidence/confidence), which this
slice doesn't produce -- see ``agents.core_agent_service``'s module
docstring. These two schemas exist purely to expose the two new tables
for provenance inspection.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from intent_core_contracts.api.intent import AgentType

AgentRunStatus = Literal["running", "succeeded", "failed"]


class ContextSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    payload: dict[str, Any]
    created_at: datetime


class AgentRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    shot_id: UUID
    context_snapshot_id: UUID
    agent_type: AgentType
    capability: str
    provider: str
    status: AgentRunStatus
    result_revision_id: UUID | None
    error: str | None
    started_at: datetime
    completed_at: datetime | None
