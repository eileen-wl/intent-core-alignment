"""Context Builder, Agent Orchestrator, prompt registry, structured
outputs, Agent Run records.

Not implemented yet. Scope: docs/ARCHITECTURE.md §3.5, §4,
docs/AGENT_CONTRACTS.md. Agent input/output contracts are a
change-boundary item per CLAUDE.md; the output envelope shape already
exists in packages/contracts/python (intent_core_contracts.agents).
Agents must never call ftrack directly and must go through the Model
Gateway once a runtime model provider is chosen.
"""
