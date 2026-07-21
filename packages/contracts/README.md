# Shared Contracts

Shared API, event, and Agent-output schemas.

Changes here require architecture review because multiple modules depend on them.

## Structure

- `python/` — canonical source of truth. Pydantic models consumed by
  `apps/api`, `services/worker`, and `services/ftrack-connector`.
  - `intent_core_contracts/api/` — request/response schemas per backend module.
  - `intent_core_contracts/events/` — internal event payloads (see `docs/ARCHITECTURE.md` §6).
  - `intent_core_contracts/agents/` — the common Agent output envelope and Agent Run record (see `docs/AGENT_CONTRACTS.md` §2-3).
- `ts/` — generated from `apps/api`'s OpenAPI document via `make generate-contracts`
  (exports `apps/api/openapi.json`, then runs `openapi-typescript` into
  `ts/src/generated/api.ts`). Nothing under `ts/src/generated` should be
  hand-edited; `ts/src/index.ts` re-exports the schemas apps/web actually
  imports and needs a new line whenever a module gains a schema it should
  expose. Run this and commit the diff whenever `apps/api`'s request/response
  schemas change — CI does not currently regenerate or check for drift.

## Why one canonical source

`docs/PRODUCT_SCOPE.md` §11 and `docs/DOMAIN_MODEL.md` §11 both require
that Production Facts, AI Proposals, and Human Decisions stay
structurally consistent and traceable across the system. Hand-
maintaining the same shape twice (Python and TypeScript) would let the
two sides drift silently; generating one from the other removes that
failure mode entirely.
