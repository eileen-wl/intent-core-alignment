# Background Worker

`arq`-based worker. Reserved for runtime-model calls, media
processing, retries, reconciliation, and other long-running jobs
(docs/ARCHITECTURE.md §3.3).

Only one `ping` task exists so far — it proves the api -> Redis ->
worker -> api async job path works end to end. It stays stateless
and calls back into `apps/api`'s `/internal/worker-heartbeat` endpoint
rather than writing to Postgres directly (see
`docs/decisions/ADR-0008-shared-python-domain-code-strategy.md`).

## Run locally

```bash
uv run arq intent_core_worker.worker_settings.WorkerSettings
```

Config is read from the repo-root `.env` (`cp .env.example .env` at
the repo root first) regardless of which directory you run this from
— `intent_core_worker.config.Settings` resolves it via an absolute
path, not the current working directory. No per-package `.env` file
is needed or read.

## Test

```bash
uv run pytest
```
