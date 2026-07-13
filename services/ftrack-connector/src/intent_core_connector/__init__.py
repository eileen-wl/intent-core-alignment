"""ftrack Workflow Connector process (docs/FTRACK_INTEGRATION.md).

This package is a stub. The ftrack test workspace and API identity are
"Not started" (docs/API_AND_ACCOUNTS.md §1), and the entity mapping is
explicitly provisional (docs/FTRACK_INTEGRATION.md §3, §16). Real
sync, event handling, and write-back logic must not be built against a
guessed schema -- it is implemented once workspace access exists and
the open questions in docs/FTRACK_INTEGRATION.md §16 are answered.

Agents must never call ftrack directly; only this process does, and
only once it is no longer a stub (docs/ARCHITECTURE.md §3.4).
"""
