# ADR-0007: arq as the background worker framework

## Context

`docs/ARCHITECTURE.md` §3.3 and §9 assign runtime-model calls, media
processing, ftrack reconciliation, and long-running Assessments to a
background worker process backed by Redis, but explicitly lists the
worker framework as provisional (§12). This is a "core technology
choice" per `CLAUDE.md`'s change-boundary list.

## Decision

Use `arq` (async Redis queue) for `services/worker`.

## Alternatives considered

- **Celery** — the most established option, but its API and
  configuration surface are built around sync workers with an
  optional async story bolted on; `apps/api` is fully async
  (SQLAlchemy async engine, async FastAPI handlers), and a sync
  worker would need a separate concurrency model from the rest of the
  codebase.
- **RQ (Redis Queue)** — simple and Redis-native like arq, but
  sync-only; same mismatch with the rest of the stack as Celery.
- **Dramatiq** — solid async support, but smaller ecosystem/community
  than arq for a Redis-only, FastAPI-adjacent setup.

arq was chosen because it is async-native, has the smallest
configuration surface of the options (a single `WorkerSettings` class
with a `functions` list), and needs nothing beyond the Redis instance
already required by `docs/ARCHITECTURE.md` §9.

## Consequences

- Every job handler in `services/worker` must be an `async def`.
- `apps/api`'s `ops` module enqueues jobs via arq's `create_pool` /
  `enqueue_job` client API (see
  `intent_core_api.ops.router.ping_worker`), which becomes the
  pattern real Agent Run job enqueuing will follow later.
- If a future workload needs Celery-specific features (e.g. complex
  routing across multiple queues/brokers), this decision should be
  revisited rather than silently worked around.

## Status

Proposed as part of the initial engineering skeleton
(`chore/initial-engineering-skeleton`). The `ping` task and its
`WorkerSettings` class import and construct correctly (verified with
a local Python environment); the full Redis-connected path
(`api -> Redis -> worker -> api`) has not been run end to end since
this environment has no Redis/Docker available — see
`tests/integration/test_worker_ping.py`, which is written to verify
this once `docker compose up` is available.
