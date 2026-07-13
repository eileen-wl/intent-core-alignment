# API Application

FastAPI modular-monolith backend. Module boundaries mirror
`docs/ARCHITECTURE.md` §4: `production_context`, `intent`,
`versions_and_feedback`, `workflow`, `agents`, `cross_department`,
`media`, `integrations`, `audit`.

Only `production_context` (the manual/file-based input path from
`docs/PRODUCT_SCOPE.md` §15) and `ops` (scaffolding to prove the
async job path) have real code in this initial skeleton — every other
module is an empty stub documenting its future scope. See the
top-level plan in `docs/decisions/` for why.

## Run locally

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn intent_core_api.main:app --reload
```

## Test

```bash
uv run pytest
```

Uses an in-memory SQLite database for tests (see `tests/conftest.py`)
so no local Postgres is required to run the unit/API test suite.
`tests/integration` at the repo root covers the real-Postgres and
real-Redis paths and requires `docker compose up`.
