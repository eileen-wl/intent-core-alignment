"""Background worker: runtime-model calls, media processing, retries,
reconciliation, and other long-running jobs (docs/ARCHITECTURE.md §3.3).

Only a `ping` proof-of-wiring task exists in this initial skeleton.
Real job handlers (Agent Runs, media processing, ftrack reconciliation)
are not implemented yet -- they depend on decisions this repository
has not made (runtime model provider, object storage provider).
"""
