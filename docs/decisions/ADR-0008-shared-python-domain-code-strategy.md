# ADR-0008: How the three Python services share domain code

## Context

`apps/api`, `services/worker`, and `services/ftrack-connector` are
separate deployment units (`docs/ARCHITECTURE.md` §11), but nothing
in the docs specifies how they share code. This is a **shared domain
schema** decision per `CLAUDE.md`'s change-boundary list and must not
be assumed silently.

Two things needed a decision for the first skeleton:

1. Do `services/worker` and `services/ftrack-connector` import
   `apps/api`'s SQLAlchemy ORM models directly, or something else?
2. Who is allowed to write to Postgres?

## Decision

- **Only `apps/api` writes to Postgres.** `services/worker` and
  `services/ftrack-connector` do not import `apps/api`'s SQLAlchemy
  models and do not open their own database connections in this
  skeleton. When a job needs to persist something, it calls back into
  `apps/api` over HTTP (see `intent_core_worker.tasks.ping` calling
  `apps/api`'s `POST /internal/worker-heartbeat`).
- **`packages/contracts/python` is the only code shared between the
  three services** — Pydantic schemas for API request/response
  bodies, internal event payloads, and the Agent output envelope.
  SQLAlchemy models and business logic stay inside `apps/api` only.

This keeps `apps/api` as "the main authority for product behaviour"
(`docs/ARCHITECTURE.md` §3.2) literally true at the persistence layer:
there is exactly one writer to Postgres, so there is no risk of the
worker and the API racing on schema assumptions or migrations drifting
out of sync with a second consumer of the ORM layer.

## Alternatives considered

- **Worker/connector import `apps/api`'s SQLAlchemy models and write
  to Postgres directly.** Rejected for this first pass: it would mean
  three services need to agree on migration state at all times, and
  a schema change in `apps/api` could break the worker or connector
  silently at import time rather than at a defined API boundary.
- **A separate shared `packages/domain` Python package holding
  SQLAlchemy models**, imported by all three services. Deferred, not
  rejected: this is the more scalable long-term shape once
  `services/worker` needs to persist high-volume records (e.g. Agent
  Run records, media processing results) where an HTTP round-trip per
  write may become impractical. Revisit this ADR when that need is
  concrete rather than speculative.

## Consequences

- `services/worker`'s `ping` task is fully stateless; the only
  stateful component in this skeleton is `apps/api`.
- Adding a new worker job that needs to persist something means
  adding an endpoint on `apps/api` for it to call, not writing a new
  SQLAlchemy model in `services/worker`.
- If/when this stops scaling (see "Alternatives considered"), that
  should be a new ADR, not a silent change.

## Status

Proposed as part of the initial engineering skeleton
(`chore/initial-engineering-skeleton`). The `ping` -> heartbeat
callback path is implemented and its individual pieces are unit
tested (`apps/api/tests/test_ops_heartbeat.py`,
`services/worker/tests/test_tasks.py`); the full live loop is covered
by `tests/integration/test_worker_ping.py`, not yet run against real
infra in this environment.
