# Cross-service tests

Per-package unit/API tests live next to their code (`apps/api/tests`,
`services/worker/tests`, `services/ftrack-connector/tests`,
`packages/contracts/python/tests`) and run against in-memory
fakes/mocks — no live infra required, so they run in `make test`.

This directory is for tests that need more than one real service
running together.

- `integration/` — needs `docker compose up` (real Postgres, real
  Redis, a real worker process). Not part of `make test`; run
  explicitly once infra is up.
- `e2e/` — reserved for Playwright browser tests against the running
  Dashboard. Empty until role-aware views exist
  (`docs/PRODUCT_SCOPE.md` §13) worth driving through a browser.
