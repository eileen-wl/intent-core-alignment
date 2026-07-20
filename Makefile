.PHONY: fmt lint typecheck test generate-contracts up down logs

# Requires: uv (Python), pnpm (JS/TS), docker (local infra)
#
# Each Python package is its own uv workspace member with its own
# venv, so commands that need imports to resolve (mypy, pytest) run
# once per --project. ruff only parses source, so one project's env
# is enough to run it across the whole tree.

PY_PROJECTS := packages/contracts/python apps/api services/worker services/ftrack-connector

fmt:
	uv run --project apps/api ruff format .
	pnpm -w run format:write

lint:
	uv run --project apps/api ruff check .
	pnpm -w run lint

typecheck:
	uv run --project packages/contracts/python mypy packages/contracts/python/src
	uv run --project apps/api mypy apps/api/src
	uv run --project services/worker mypy services/worker/src
	uv run --project services/ftrack-connector mypy services/ftrack-connector/src
	pnpm -w run typecheck

test:
	uv run --project packages/contracts/python pytest packages/contracts/python
	uv run --project apps/api pytest apps/api
	uv run --project services/worker pytest services/worker
	uv run --project services/ftrack-connector pytest services/ftrack-connector
	uv run --project apps/api pytest tests/infra
	pnpm -w run test

# Regenerates packages/contracts/ts/src/generated/api.ts from apps/api's
# live OpenAPI document. The generated file is committed (the `js` CI job
# typechecks/builds against it without needing the Python toolchain), so
# run this and commit the diff whenever apps/api's request/response
# schemas change.
generate-contracts:
	uv run --project apps/api python -m intent_core_api.export_openapi > apps/api/openapi.json
	pnpm run generate:contracts

up:
	docker compose -f infra/docker-compose.yml up --build

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f
