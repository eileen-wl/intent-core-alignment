"""Context Builder, Agent Orchestrator, prompt registry, structured
outputs, Agent Run records.

``core_agent_service`` implements B1, the smallest end-to-end Core Agent
slice: Primary Anchor Drafting only (docs/AGENT_CONTRACTS.md §4). Every
other Core Agent capability (context reconstruction, alignment
assessment, re-anchor proposal, Intent Signal) and every Role Agent
(VFX/CG/Artist Supervisor Agent) remain not implemented -- see that
module's docstring for what B1 does and doesn't cover.

Scope: docs/ARCHITECTURE.md §3.5, §4, docs/AGENT_CONTRACTS.md. Agent
input/output contracts are a change-boundary item per CLAUDE.md; the
output envelope shape already exists in packages/contracts/python
(intent_core_contracts.agents) but B1 does not use it (see
core_agent_service's docstring for why). Agents must never call ftrack
directly and must go through the Model Gateway once a runtime model
provider is chosen -- B1 only has a deterministic offline adapter behind
that seam, not a real provider.
"""
