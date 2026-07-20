# ADR-0010: ExternalEntityLink as its own table

## Context

Syncing a real ftrack Shot's context (Project → Shot → Task) into
`production_context` idempotently requires remembering which internal
record a given external (ftrack) record was already synced to, so a
repeat sync updates the existing row instead of duplicating it
(`docs/FTRACK_INTEGRATION.md` §8). This is a shared domain schema
change per `CLAUDE.md`'s change-boundary list.

`docs/GLOSSARY.md` already names this concept "External Entity Link"
("A record connecting an internal object to its corresponding external
ftrack object"), and `docs/ARCHITECTURE.md` §4 lists "Integrations" as
its own logical backend module ("ftrack workspace profile, entity
mapping, sync state, integration events, write-back") separate from
`production_context`.

## Decision

Add a dedicated `ExternalEntityLink` table/model in the `integrations`
module: `(id, entity_type, entity_id, source, external_id, created_at,
updated_at)`, with `UNIQUE(source, external_id)` (one external record
maps to at most one internal record) and `UNIQUE(entity_type,
entity_id, source)` (one internal record has at most one link per
source). `entity_type`/`entity_id` are a deliberately loose,
unconstrained reference (same pattern as `workflow.models.Decision`,
see `workflow/models.py`'s docstring) since the set of linkable entity
types is open-ended.

`ProjectCreate`/`ShotCreate`/`TaskCreate` gain an optional
`external_id: str | None` field, required when `source != "manual"`
and forbidden when `source == "manual"` (enforced by a pydantic
validator). The existing `POST /projects`/`/shots`/`/tasks` endpoints
become idempotent upserts when `external_id` is present: look up an
existing link first, update that record if found, otherwise create the
record and the link together in the same transaction.

## Alternatives considered

- **A `ftrack_id` column directly on `Project`/`Shot`/`Task`** —
  simpler (one migration, one column each), but hardcodes a
  connector-specific concept into the core domain model, which
  `docs/PROJECT_CONTEXT.md` §11 says the system "must not be
  structurally dependent on" (ftrack-specific objects). A second
  Workflow Connector later would need its own column on every entity
  again, or a migration to generalize -- the dedicated table avoids
  that rework.
- **Reusing the existing `workflow_transitions`/`decisions` loose
  `entity_type`/`entity_id` pattern directly, with no new table** —
  rejected; those tables represent *decisions and transitions*, not
  *identity mappings*, and overloading them would conflate two
  unrelated concepts.

## Consequences

- One new table (`external_entity_links`), one new small contracts
  module (`intent_core_contracts.api.integrations`), and a small
  amount of duplicated validator/upsert logic across the three
  `production_context` endpoints (project/shot/task) -- acceptable
  duplication per three similar call sites rather than a premature
  shared abstraction across dissimilar entities.
- No endpoint currently exposes `ExternalEntityLink` for reading
  (audit/lineage queries over links are explicitly A4 scope per
  `apps/api/.../intent/README.md`'s pattern of deferring the query
  surface); this task only needs the write/upsert path to prove the
  sync loop works.
- `services/ftrack-connector` calls the existing `/projects`, `/shots`,
  `/tasks` endpoints over HTTP with `source="ftrack"` +
  `external_id` set, per ADR-0008 (never writes to Postgres directly).

## Status

Accepted, per explicit confirmation before implementation (this is a
shared-contract change per `CLAUDE.md`).
