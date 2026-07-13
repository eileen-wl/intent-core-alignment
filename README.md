# Intent Core Alignment System

Independent AI-assisted intent-alignment system for animation/VFX workflows, with ftrack as the first formal Workflow Connector.

## Current project stage

The team has completed the initial shared product and architecture documents, and the engineering skeleton described in `docs/decisions/` has been scaffolded: a Next.js frontend, a FastAPI backend, a background worker, an ftrack connector stub, shared contracts, Docker Compose, and linting/formatting/type-checking/testing for both ecosystems.

No product features (Anchors, Agents, Human Gates, real ftrack sync) exist yet — see each module's README for what's deliberately deferred and why.

## Quick start

```bash
cp .env.example .env
pnpm install
uv sync --project apps/api && uv sync --project services/worker && uv sync --project services/ftrack-connector && uv sync --project packages/contracts/python
make up      # docker compose: postgres, redis, minio, api, worker, web
make test    # per-package unit/API tests (no live infra required)
```

The root `.env` is the single config file for `apps/api`,
`services/worker`, `services/ftrack-connector`, and Docker Compose —
each Python service resolves it via an absolute path, so it's read
consistently no matter which directory you run commands from.
`apps/web` is the one exception (see `apps/web/README.md`): Next.js
scopes its own env loading to the app directory, so the root `.env`
doesn't reach it — Docker Compose already sets what it needs, and
bare local dev only ever needs an optional shell export, never a
file.

See `infra/README.md` for Docker Compose details and known limitations.

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
