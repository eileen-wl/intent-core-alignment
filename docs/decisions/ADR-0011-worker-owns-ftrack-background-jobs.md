# ADR-0011: worker owns ftrack background jobs

## Context

WP-C's remaining scope includes incremental sync — noticing that a Shot
changed in ftrack and re-syncing it without a human manually re-running
the sync. `docs/ARCHITECTURE.md` §3.3 already assigns "ftrack
reconciliation" to the **background worker**, not a separate always-on
connector process. §12 separately marks "Event Hub versus Webhook as the
main ftrack event source" as still provisional. Choosing where the live
ftrack session used for this job lives, and how the job is triggered, is
a "core technology choice" per `CLAUDE.md`'s change-boundary list.

## Decision

`services/worker` depends on `services/ftrack-connector`
(`intent-core-connector`) as a workspace package and runs ftrack
background jobs (starting with reconciliation) using `FtrackConnector`
directly inside arq job functions, the same process that already runs
`ping`. The job polls ftrack for entities updated since a stored
`SyncCursor` (`docs/DOMAIN_MODEL.md` §10) rather than subscribing to a
continuous Event Hub stream.

`services/worker` still never writes to Postgres directly (ADR-0008
unchanged) — it calls `apps/api` over HTTP to read/write the `SyncCursor`
and to run the existing idempotent shot-sync endpoints, exactly like the
`ping` job calls the heartbeat endpoint.

## Alternatives considered

- **A standalone, always-running Connector daemon subscribing to
  `ftrack_api`'s Event Hub** (`session.event_hub.subscribe(...)` +
  `.wait()`) — this is what `docs/ARCHITECTURE.md` §3.4 originally
  sketches as the Connector process's job. Rejected for this slice
  because it requires resolving the still-provisional Event-Hub-vs-Webhook
  question (§12) and introducing a new long-running process/deployment
  unit before it's needed. Polling reconciliation is transport-agnostic
  and `docs/FTRACK_INTEGRATION.md` §6 already says "real-time events
  alone are not considered sufficient" — reconciliation is required
  either way, so building it first and layering real-time events on top
  later (once the Event Hub question is actually resolved) is the
  lower-risk order.
- **Give `services/ftrack-connector` its own arq-like job consumer** —
  rejected as unnecessary process/infra duplication when `services/worker`
  already exists for exactly this kind of job and `intent-core-connector`
  is just a regular importable Python package with no reason it can't be
  a dependency of another workspace member (same pattern as
  `intent-core-contracts` already being shared).

## Consequences

- `services/worker/pyproject.toml` gains a new dependency,
  `intent-core-connector`, with a `[tool.uv.sources]` workspace reference
  — mirrors how `apps/api` and `services/worker` already depend on
  `intent-core-contracts`.
- `services/worker` now holds real ftrack credentials in-process (via
  `FtrackConnector`, reading the same repo-root `.env`) — no new secret
  handling is introduced; it is the same credential the connector package
  already manages, just imported into a second process.
- Real-time event-driven sync (Event Hub or Webhook) remains an open,
  deferred follow-up once `docs/ARCHITECTURE.md` §12's open question is
  actually resolved; this ADR does not answer it, only routes around it
  for the reconciliation slice.

## Status

Accepted, per explicit confirmation before implementation (shared
cross-service dependency change per `CLAUDE.md`).
