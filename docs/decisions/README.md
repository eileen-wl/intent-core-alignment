# Decision Records

Use this directory for decisions that change shared project contracts.

Recommended filename format:

`ADR-XXX-short-decision-name.md`

Each record should include:

- Context
- Decision
- Alternatives considered
- Consequences
- Status

Initial decisions that should later be formalised here include (reserved as ADR-0001 through ADR-0004 when written up):

- independent system with ftrack as first Connector;
- modular monolith with background workers;
- Python backend and TypeScript frontend;
- shared Agent Orchestrator rather than autonomous Agent-to-Agent chat.

## Recorded decisions

- [ADR-0005](ADR-0005-pnpm-for-js-package-management.md) — pnpm for JS/TS package management
- [ADR-0006](ADR-0006-uv-for-python-workspace-management.md) — uv for Python package/workspace management
- [ADR-0007](ADR-0007-arq-for-background-worker.md) — arq as the background worker framework
- [ADR-0008](ADR-0008-shared-python-domain-code-strategy.md) — how apps/api, services/worker, and services/ftrack-connector share code
