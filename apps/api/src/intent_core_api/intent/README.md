# Intent module — WP-A slices A1 + A2

Implements the Primary Anchor (`IntentBrief`/`CoreAnchor`/
`CoreAnchorRevision`, A1) and Secondary Execution Anchor
(`ExecutionAnchor`/`ExecutionAnchorRevision`, A2) lifecycles, plus the
stale-alignment cascade that links them. See the approved WP-A/WP-A2
implementation plans for the full design rationale; this file is a quick
orientation for what exists in code today.

## What's implemented (A1)

- **`IntentBrief`** (`intent/models.py`): manual creation only, VFX
  Supervisor only (enforced in `brief_service.create_brief`, not just the
  router). Immutable, append-only. Attribution columns
  (`created_by_actor_kind`, `created_by_human_role` nullable,
  `source_external_id`) are generalized so a future ftrack-ingestion path
  never needs a fabricated VFX identity — that path is not implemented
  here.
- **`CoreAnchor`/`CoreAnchorRevision`** (`intent/models.py`,
  `intent/core_anchor_service.py`): one `CoreAnchor` per Shot; revisions
  move `draft -> confirmed -> superseded` or `draft -> rejected`, VFX
  Supervisor only. Draft `PATCH` is allowed only in `draft` status and
  writes a field-level before/after `AuditEvent` — no `Decision`/
  `WorkflowTransition`, since `status` doesn't change. Confirming writes
  a `Decision`, a `WorkflowTransition`, and an `AuditEvent` for the
  target revision, plus (if a previous confirmed revision exists) a
  _separate_ system-attributed `WorkflowTransition` + `AuditEvent` for
  the auto-superseded revision, and (A2) cascades to mark related
  `ExecutionAnchor`s stale (see below).
- **`ActorContext`** (`workflow/actors.py`): `human`/`agent`/`system`
  actor identity. The only HTTP-reachable construction path
  (`get_current_actor`, via `X-Actor-Role`/`X-Actor-Id` headers) can only
  ever build a `human` actor. Agent/system actors exist only for direct
  service-layer tests and internal cascade side effects — no HTTP
  endpoint or real agent-authentication boundary exists yet (see the
  plan's deferred "Identity, Membership & Assignment Scoping" work
  package).
- **`Decision`/`WorkflowTransition`** (`workflow/models.py`) and
  **`AuditEvent`** (`audit/models.py`): persisted as side effects of the
  above; no create/read HTTP endpoints exist for them.

## What's implemented (A2)

- **`ExecutionAnchor`** (`intent/models.py`) — one per **Task** (not per
  Shot), owned by the **CG Supervisor**. Same shape as `CoreAnchor`:
  `active_revision_id` is a stored pointer; `is_stale` is a stored boolean
  with **no PATCH endpoint or manual toggle anywhere** — it is set only
  by the CoreAnchor-confirm stale cascade and cleared only as a side
  effect of confirming a new `ExecutionAnchorRevision`.
- **`ExecutionAnchorRevision`** (`intent/models.py`,
  `intent/execution_anchor_service.py`) — `core_anchor_revision_id`
  records the **exact** `CoreAnchorRevision` this revision translates.
  It is resolved by the service (never client-supplied) as "the Task's
  Shot's current confirmed `CoreAnchorRevision`" at draft-creation time,
  and **re-validated at confirm time**: confirming a draft whose Core
  reference is no longer the shot's current confirmed revision is
  rejected (409), never silently confirmed against stale data. Lifecycle
  is otherwise identical to `CoreAnchorRevision`
  (`draft -> confirmed -> superseded` / `draft -> rejected`), CG
  Supervisor only for update/confirm/reject; a `cg_supervisor_agent`
  `ActorContext` may create a draft only (service-level only, no HTTP
  path — see `workflow/actors.py`).
- **Stale marking** (`execution_anchor_service.mark_stale_for_new_core_revision`,
  called only from `core_anchor_service.confirm_revision`, inside that
  same transaction): every `ExecutionAnchor` under the confirming Shot
  whose active confirmed revision references a _different_
  `CoreAnchorRevision` is marked stale (`is_stale: False -> True`) with
  a **system**-attributed `AuditEvent` (`execution_anchor.marked_stale`).
  Already-stale anchors are skipped entirely — never a duplicate event.
  An active revision that is missing or not `confirmed` is a data-
  integrity bug, not a skippable case: it raises `InternalConsistencyError`.
- **Stale clearing** happens only as a side effect of confirming a new
  `ExecutionAnchorRevision` against the shot's current Core revision,
  with a **human**-attributed `AuditEvent` (`execution_anchor.stale_cleared`)
  — the anchor being cleared is the one the human directly confirmed,
  unlike marking, which is a cascade onto other anchors.
- **Concurrency**: `intent/core_anchor_lock.py`'s
  `compare_and_swap_active_revision` is the single, dialect-portable
  serialization mechanism shared unmodified by CoreAnchor confirmation,
  Execution draft creation, and Execution confirmation — always the
  first mutating operation in each. The global lock order is
  `CoreAnchor -> ExecutionAnchor -> revisions/lineage` throughout, to
  avoid deadlocks between the two workflows. See that module's docstring
  for why a `SELECT` (even a bare-scalar one) cannot substitute for a
  compare-and-swap `UPDATE` under SQLite/PostgreSQL snapshot isolation.

## What's explicitly out of scope

`HumanGate` and `Decision` supersession (A3); `Constraint`/
`VariationZone`/`DriftRisk`/`Reference`/`OpenQuestion` and the audit/
lineage query surface (A4); real authentication, real agent
authentication, and assignment-based read scoping (deferred future work
package, not part of WP-A/WP-A2).

## Concurrency invariants (A1 + A2)

- `UNIQUE(core_anchor_id, revision_number)` / `UNIQUE(execution_anchor_id,
revision_number)` make concurrent draft-number allocation safe (409 on
  race).
- A partial unique index per anchor type (`core_anchor_id` /
  `execution_anchor_id` WHERE `status = 'confirmed'`, dialect-aware for
  Postgres/SQLite) guarantees at most one confirmed revision per anchor
  at the database level.
- `compare_and_swap_active_revision` (`intent/core_anchor_lock.py`) is
  the authoritative, dialect-portable commit gate for
  `CoreAnchor.active_revision_id` in all three cross-workflow-sensitive
  operations — not a `SELECT`. `SELECT ... FOR UPDATE` is additionally
  used on PostgreSQL for read-then-decide confidence (a no-op on SQLite).
- Every mutating service function commits exactly once; any
  `IntegrityError` there (including from a `record_*()` flush, not just
  the terminal commit) is caught, the session is rolled back, and a 409
  is returned — no partial writes are ever left behind. A recognised
  retriable database lock/busy/serialization error from the CAS is also
  mapped to 409; an unrecognised `OperationalError` is rolled back and
  re-raised unchanged, never misreported as a client conflict.
