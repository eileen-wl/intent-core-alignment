# Intent module — WP-A slice A1

Implements the smallest vertical slice of the Intent Core: `IntentBrief`
manual creation/reads, and the `CoreAnchor`/`CoreAnchorRevision`
draft/update/confirm/reject lifecycle. See the approved WP-A
implementation plan for the full design rationale; this file is a quick
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
  *separate* system-attributed `WorkflowTransition` + `AuditEvent` for
  the auto-superseded revision.
- **`ActorContext`** (`workflow/actors.py`): `human`/`agent`/`system`
  actor identity. The only HTTP-reachable construction path
  (`get_current_actor`, via `X-Actor-Role`/`X-Actor-Id` headers) can only
  ever build a `human` actor. Agent/system actors exist only for direct
  service-layer tests and internal cascade side effects in this slice —
  no HTTP endpoint or real agent-authentication boundary exists yet (see
  the plan's deferred "Identity, Membership & Assignment Scoping" work
  package).
- **`Decision`/`WorkflowTransition`** (`workflow/models.py`) and
  **`AuditEvent`** (`audit/models.py`): persisted as side effects of the
  above; no create/read HTTP endpoints exist for them in A1.

## What's explicitly out of scope for A1

`ExecutionAnchor`/`ExecutionAnchorRevision` (A2); `HumanGate` and
`Decision` supersession (A3); `Constraint`/`VariationZone`/`DriftRisk`/
`Reference`/`OpenQuestion` and the audit/lineage query surface (A4);
real authentication, real agent authentication, and assignment-based
read scoping (deferred future work package, not part of WP-A).

## Concurrency invariants

- `UNIQUE(core_anchor_id, revision_number)` on `core_anchor_revisions`
  makes concurrent draft-number allocation safe (409 on race).
- A partial unique index (`core_anchor_id` WHERE `status = 'confirmed'`,
  dialect-aware for Postgres/SQLite) guarantees at most one confirmed
  revision per `CoreAnchor` at the database level. `confirm_revision`
  additionally re-fetches state and takes a `SELECT ... FOR UPDATE` lock
  on Postgres (a no-op on SQLite) to reduce contention, but the partial
  index is what makes the invariant hold regardless of dialect.
- Every mutating service function commits exactly once; any
  `IntegrityError` there is caught, the session is rolled back, and a
  409 is returned — no partial writes are ever left behind.
