"""The common Agent output envelope and Agent Run record.

See docs/AGENT_CONTRACTS.md §2-3. No Agent capability is implemented
in this package or elsewhere yet — this only fixes the shape every
future Agent output must conform to, so schema validation can be
enforced from day one (docs/AGENT_CONTRACTS.md §11: "Outputs must
pass schema validation before entering product workflow").

Agents may only ever produce this envelope. They cannot confirm
Anchors, approve Versions, resolve Human Gates, or write back to
ftrack (docs/ROLE_PERMISSIONS.md §3) — none of that is expressible
through this schema, by design.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

AgentType = Literal[
    "core_agent",
    "vfx_supervisor_agent",
    "cg_supervisor_agent",
    "artist_agent",
    "cross_department",
]

AgentRunStatus = Literal["pending", "succeeded", "failed"]


class AgentOutputEnvelope(BaseModel):
    summary: str
    observations: list[str] = Field(default_factory=list)
    inferences: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    open_questions: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    requires_human_gate: bool = False


class AgentRunRecord(BaseModel):
    id: UUID
    agent_type: AgentType
    capability: str
    target_entity: str
    context_snapshot_id: UUID
    model_id: str
    prompt_version: str
    input_schema_version: str
    output_schema_version: str
    status: AgentRunStatus
    validated_output: AgentOutputEnvelope | None = None
    latency_ms: int | None = None
    errors: list[str] = Field(default_factory=list)
    created_at: datetime
