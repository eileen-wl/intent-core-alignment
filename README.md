# Intent Core Alignment System

Independent AI-assisted intent-alignment system for animation/VFX workflows, with ftrack as the first formal Workflow Connector.

## Current project stage

The team has completed the initial shared product and architecture documents.  
This repository skeleton is the common starting point for all team members and all Claude Code sessions.

No production feature code has been generated yet.

## Read first

1. `docs/PROJECT_CONTEXT.md`
2. `docs/PRODUCT_SCOPE.md`
3. `docs/GLOSSARY.md`
4. `docs/ROLE_PERMISSIONS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DOMAIN_MODEL.md`
7. `docs/AGENT_CONTRACTS.md`
8. `docs/FTRACK_INTEGRATION.md`
9. `CLAUDE.md`

## Planned repository areas

- `apps/web` — Next.js Dashboard
- `apps/api` — FastAPI application and domain modules
- `services/ftrack-connector` — ftrack sync, events, mapping, and write-back
- `services/worker` — background model, media, and reconciliation jobs
- `packages/contracts` — shared API, event, and Agent-output contracts
- `packages/ui` — shared frontend components
- `evaluation` — synthetic scenarios and expected behaviours
- `spikes` — disposable feasibility experiments
- `tests` — unit, integration, and end-to-end tests
- `infra` — local and deployment infrastructure

## Important rule

Do not begin broad feature generation before the shared repository, documents, environment-variable conventions, and first engineering skeleton are confirmed.
