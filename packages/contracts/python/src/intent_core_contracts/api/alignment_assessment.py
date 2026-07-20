"""Request/response schemas for the Alignment Assessment capability
(Step 4b).

``AlignmentState`` describes exactly one Assessment's relationship
between a Version (its description + its Review Notes) and the Shot's
currently *confirmed* Core Anchor revision. It is deliberately a
separate, smaller vocabulary from the future Intent Signal states
(Stable/Stretching/Drifting/Re-anchor Needed, docs/GLOSSARY.md) -- an
Intent Signal aggregates across a Shot's whole timeline, an Alignment
Assessment judges one Version in isolation. Do not conflate the two.

``AlignmentAssessmentOutput`` is the provider's structured output
contract: ``AlignmentState`` plus the existing, already-defined
``AgentOutputEnvelope`` (reused via inheritance, not duplicated --
CLAUDE.md "Use structured and validated Agent outputs"). The
``requires_human_gate`` invariant for this capability (must always be
``True``) is enforced here, once, rather than trusted to every adapter.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from intent_core_contracts.agents.envelope import AgentOutputEnvelope

AlignmentState = Literal["aligned", "minor_drift", "significant_drift"]


class AlignmentAssessmentOutput(AgentOutputEnvelope):
    alignment_state: AlignmentState

    @field_validator("requires_human_gate")
    @classmethod
    def _requires_human_gate_always_true(cls, value: bool) -> bool:
        if not value:
            raise ValueError(
                "requires_human_gate must be true for the alignment_assessment capability"
            )
        return value


class AlignmentAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_id: UUID
    core_anchor_revision_id: UUID
    context_snapshot_id: UUID
    agent_run_id: UUID
    alignment_state: AlignmentState
    envelope: dict[str, Any]
    created_at: datetime


class AssessmentDecisionRequest(BaseModel):
    """Step 4c: the body of the accept/reject endpoints. Deliberately
    just the optional rationale -- no ``request_write_back`` or any
    ftrack-related field exists for this capability.
    """

    rationale: str | None = None
