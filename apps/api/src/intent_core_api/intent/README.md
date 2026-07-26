# Intent module — WP-A slices A1 + A2, Step 1A

Implements the Primary Anchor (`IntentBrief`/`CoreAnchor`/
`CoreAnchorRevision`, A1) and Secondary Execution Anchor
(`ExecutionAnchor`/`ExecutionAnchorRevision`, A2) lifecycles, plus the
stale-alignment cascade that links them, plus the Core Anchor semantic
child objects (`Constraint`/`VariationZone`/`DriftRisk`/`AnchorReference`/
`OpenQuestion`, Step 1A). See the approved WP-A/WP-A2 implementation
plans and `docs/STEP_1A_PLAN.md` for the full design rationale; this file
is a quick orientation for what exists in code today.

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

## What's implemented (Step 1A)

- **`Constraint`/`VariationZone`/`DriftRisk`/`AnchorReference`/
  `OpenQuestion`** (`intent/models.py`) — five ordered, revision-owned
  semantic-child tables. Each row belongs to exactly one
  `CoreAnchorRevision` via a hard, non-nullable `core_anchor_revision_id`
  FK plus an `order_index`; none of them belong directly to a Shot,
  IntentBrief, ContextSnapshot, AgentRun, or HumanGate. The model class is
  named `AnchorReference` (not the generic `Reference`); its ORM
  relationship attribute on `CoreAnchorRevision` is named `references` to
  line up with the contract field of the same name.
- **Ownership and editing rules**: a revision's five collections can only
  be written while that revision is `draft` — the same lifecycle gate
  `update_draft_revision` already enforces for the seven scalar content
  fields applies identically here (checked once, before any collection is
  touched). There is no independent create/update/delete endpoint for an
  individual semantic row, and no independent lifecycle: they exist only
  as part of `create_draft_revision`/`update_draft_revision`'s existing
  transactions. A new revision is never seeded from a previous one — no
  automatic copying happens anywhere in this codebase; every revision
  (including historical ones created before Step 1A) simply reads back
  its own five collections, empty or not.
- **Replacement semantics** (`core_anchor_service._replace_semantic_collections_for_create`/
  `_for_update`): each of the five collections is handled independently.
  On create, every collection is written from whatever the caller
  supplied (defaulting to empty). On update, a collection absent from the
  request is left untouched; a collection present (including an explicit
  `[]`) is fully replaced -- the current draft rows are deleted and the
  supplied items are re-inserted with `order_index` set from array
  position. Both paths run inside the same transaction as the parent
  draft create/update; a failure anywhere in that transaction rolls back
  every collection change atomically (`IntegrityError`/any other
  exception both trigger `session.rollback()` before re-raising).
- **Provenance**: no actor/source/agent_run_id/context_snapshot_id column
  is duplicated onto any of the five child tables. Their provenance is
  entirely inherited from the parent `CoreAnchorRevision`'s own creation
  provenance, from `AuditEvent` rows recorded for draft edits, and
  eventually from the human confirmation `Decision`.
- **Audit**: only `update_draft_revision` records collection changes (to
  match the existing convention that draft *creation* is not audited
  either); a replaced collection contributes a `{"before": [...],
  "after": [...]}` entry to the same `AuditEvent.source_context.changed_fields`
  payload already used for the seven scalar fields -- normalized to a
  flat list of values for single-field collections (Constraint/
  VariationZone/DriftRisk/OpenQuestion), or a list of `{label, uri,
  note}` objects for AnchorReference. No new audit table or event
  framework was added.
- **Authority**: reuses the existing Core Anchor draft guards
  unchanged (`require_can_draft`/`require_can_update_draft`) -- VFX
  Supervisor (human) or a `core_agent` `ActorContext` (service-level
  only, no HTTP path) may supply semantic content on a draft; CG
  Supervisor and Artist cannot touch it; no actor can touch a non-draft
  revision. The Core Agent's actual generator (`agents/core_agent_service.py`)
  is unmodified in this slice -- `generate_core_anchor_draft` continues to
  produce empty semantic collections until Step 1B Intent Decomposition.
- **Eager loading**: `CoreAnchorRevision`'s five relationships use
  `lazy="selectin"`, and every service function that returns a
  `CoreAnchorRevision` for API serialization re-fetches it through
  `_get_revision_with_semantic_children` (explicit `selectinload()`
  options), rather than relying on `session.refresh()`'s relationship
  semantics -- this codebase uses `AsyncSession` throughout, where an
  un-eager-loaded relationship access outside an awaited call raises
  `MissingGreenlet`.

## What's explicitly out of scope

`HumanGate` and `Decision` supersession (A3); the audit/lineage query
surface (A4); a UI for the five semantic-child collections (Step
1A-UI); Intent Decomposition (Step 1B); Context Reconstruction (Step
1C); persistent HumanGate (Step 1D); real authentication, real agent
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
