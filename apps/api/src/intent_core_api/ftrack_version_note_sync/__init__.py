"""Trusted internal ftrack Version/ReviewNote sync (Step 8C-3).

See docs/step-8/02_STEP_8B_VERSION_NOTE_SYNC_CONTRACT.md and
docs/decisions/ADR-0014-ftrack-version-note-sync-contract.md for the
locked contract this module implements: two endpoints
(``POST /internal/sync/versions``, ``POST /internal/sync/review-notes``)
reachable only with a valid ``X-Internal-Sync-Token`` header (``auth.py``),
resolving ftrack lineage exclusively through ``ExternalEntityLink``
(``service.py``), never by name matching. Does not implement the ftrack
connector queries, the sync client, or the worker job that will call
these endpoints -- those are later slices.
"""
