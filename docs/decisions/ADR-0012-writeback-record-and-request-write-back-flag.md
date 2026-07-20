# ADR-0012: WritebackRecord and the `request_write_back` confirm flag

## Context

WP-C's last piece is controlled write-back: a human-confirmed Core Anchor
should be able to post a marked, human-requested Note back to the linked
ftrack Shot (`docs/FTRACK_INTEGRATION.md` §12). `docs/DOMAIN_MODEL.md` §10
already names `WritebackRecord` ("Tracks an outbound ftrack operation"),
and `workflow.models.Decision` already has an unused
`write_back_requested: bool` column (`docs/DOMAIN_MODEL.md` §9: "Decisions
must record: ... whether a write-back was requested") that every existing
caller passes as `False`. This is a shared-contract change per `CLAUDE.md`.

## Decision

1. `AnchorConfirmRequest` gains `request_write_back: bool = False`.
   `core_anchor_service.confirm_revision` accepts and forwards it to
   `Decision.write_back_requested` -- the field now does something.
2. When `request_write_back=True`, the `intent` router (not the service)
   resolves the Shot's `ExternalEntityLink` (source="ftrack") and creates
   a `WritebackRecord` with the target already resolved
   (`target_external_id`) and the Note content already composed, then
   enqueues `write_back_core_anchor_confirmation` (mirroring how
   `ops.router.ping_worker` enqueues `ping`). If the Shot has no ftrack
   link, this raises `ConflictError` (409) rather than silently no-op'ing
   -- a human explicitly asked for a write-back; failing loudly is more
   honest than pretending it happened.
3. `WritebackRecord` resolves and freezes its target
   (`target_external_id`) at creation time, in `apps/api`, where the
   `ExternalEntityLink` lookup is a normal DB query. The worker job only
   reads the record and writes the Note -- it does not re-derive
   Shot -> ExternalEntityLink itself. This keeps the worker job simple and
   matches how `sync_shot_context`/`reconcile_ftrack_shots` already keep
   resolution and execution separate.
4. Note content is prefixed with a fixed, recognizable marker
   (`"[Intent Core Alignment System]"`) per `docs/FTRACK_INTEGRATION.md`
   §8's "origin markers for system-created Notes" -- even though, for
   this specific pairing, the reconciliation job (ADR-0011, keyed off new
   `Task.created_at`) cannot itself loop on a new Note, marking the
   content is still the honest, forward-compatible thing to do once a
   real event listener exists.
5. `write_back_core_anchor_confirmation` (in `services/worker`, reusing
   the ADR-0011 dependency on `intent_core_connector`) reads the
   `WritebackRecord` from `apps/api`, writes the Note via a new
   `FtrackConnector.write_note_to_shot()`, and `PATCH`es the record's
   `status`/`external_note_id`/`error` back -- same
   read-execute-report-back shape as `reconcile_ftrack_shots`.

## Alternatives considered

- **A write-back requested as its own, separate endpoint/action, decoupled
  from confirming the revision** -- this is what `docs/ROLE_PERMISSIONS.md`'s
  table literally lists as two separate rows ("Approve creative direction
  change" / "Trigger approved ftrack write-back"). Rejected as the
  *trigger* shape (still requires an explicit `request_write_back=True`
  the human must opt into, not automatic) but folded into the same confirm
  call rather than a second round-trip, because `Decision.write_back_requested`
  already exists specifically to be set at Decision-creation time, and a
  human confirming an Anchor while also asking "and post that back to
  ftrack" is one coherent action from the human's point of view, not two.
- **Worker re-resolves the ExternalEntityLink itself at write time** --
  rejected; resolving it once at request time in `apps/api` (where the DB
  already is) is simpler and avoids a second HTTP round-trip from the
  worker just to look up a link.

## Status

Accepted, per explicit confirmation before implementation (shared
contract change; and the user explicitly confirmed a real Note will be
written to their real ftrack workspace during verification).
