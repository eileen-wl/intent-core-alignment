"""ftrack Workflow Connector process (docs/FTRACK_INTEGRATION.md).

`FtrackConnector` can authenticate a real ftrack_api.Session and run
read-only schema discovery (discovery.py). Entity mapping, sync, event
handling, and write-back are not implemented -- the entity mapping is
explicitly provisional (docs/FTRACK_INTEGRATION.md §3, §16) and must
not be built against a guessed schema. That work follows once a real
workspace's discovery output has been reviewed and the open questions
in docs/FTRACK_INTEGRATION.md §16 are answered.

Agents must never call ftrack directly; only this process does
(docs/ARCHITECTURE.md §3.4).
"""
