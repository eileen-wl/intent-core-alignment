# Shared Contracts

Shared API, event, and Agent-output schemas.

Changes here require architecture review because multiple modules depend on them.

## Structure

- `python/` — canonical source of truth. Pydantic models consumed by
  `apps/api`, `services/worker`, and `services/ftrack-connector`.
  - `intent_core_contracts/api/` — request/response schemas per backend module.
  - `intent_core_contracts/events/` — internal event payloads (see `docs/ARCHITECTURE.md` §6).
  - `intent_core_contracts/agents/` — the common Agent output envelope and Agent Run record (see `docs/AGENT_CONTRACTS.md` §2-3).
- `ts/` — generated from `apps/api`'s OpenAPI document via `pnpm generate:contracts`. Nothing under `ts/src/generated` should be hand-edited.

## Why one canonical source

`docs/PRODUCT_SCOPE.md` §11 and `docs/DOMAIN_MODEL.md` §11 both require
that Production Facts, AI Proposals, and Human Decisions stay
structurally consistent and traceable across the system. Hand-
maintaining the same shape twice (Python and TypeScript) would let the
two sides drift silently; generating one from the other removes that
failure mode entirely.
