"""Context Builder, Agent Orchestrator, prompt registry, structured
outputs, Agent Run records.

Implemented (Core Agent only -- see docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md
§C for the full evidence-based baseline):

- Core Agent Core Anchor drafting (``core_agent_service``, B1, capability
  ``core_anchor_drafting``, docs/AGENT_CONTRACTS.md §4: "Primary Anchor
  Drafting"). Deterministic provider only -- no real model provider
  exists for this capability.
- Core Agent Alignment Assessment (``alignment_assessment_service``,
  capability ``alignment_assessment``, docs/AGENT_CONTRACTS.md §4:
  "Alignment Assessment"). Deterministic provider, plus a real DeepSeek
  provider (see docs/decisions/ADR-0013).
- The shared ``ContextSnapshot``/``AgentRun`` foundation (``agents.models``)
  both capabilities above build on.

Not implemented:

- Remaining Core Agent capabilities: intent decomposition, context
  reconstruction (a ``ContextSnapshot`` is runtime provenance, not this
  capability -- see docs/IMPLEMENTATION_STATUS_AND_ROADMAP.md §B),
  re-anchor proposal, Intent Signal.
- VFX Supervisor Agent -- reserved ``AgentType`` value only, no code path
  reaches it.
- CG Supervisor Agent runtime capability -- a permission-allowlist
  scaffold exists (``intent.execution_anchor_service``) and is exercised
  only by a unit test; no generator, prompt, or ``AgentRun`` path exists.
- Artist Agent -- reserved ``AgentType`` value only.
- The full shared runtime/evaluation layer described in
  docs/ARCHITECTURE.md §3.5 (a dedicated Model Gateway, capability
  registry, and evaluation harness) -- today each capability above
  selects its own provider inline.

Scope: docs/ARCHITECTURE.md §3.5, §4, docs/AGENT_CONTRACTS.md. Agent
input/output contracts are a change-boundary item per CLAUDE.md; the
output envelope shape already exists in packages/contracts/python
(intent_core_contracts.agents) and is reused (via inheritance) by
``alignment_assessment_service``'s output contract, but not by
``core_agent_service`` -- see that module's own docstring for why.
Agents must never call ftrack directly and must go through the Model
Gateway once one exists as its own module.
"""
