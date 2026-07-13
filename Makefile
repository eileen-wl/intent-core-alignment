.PHONY: fmt lint typecheck test up down logs

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
	pnpm -w run test

up:
	docker compose -f infra/docker-compose.yml up --build

down:
	docker compose -f infra/docker-compose.yml down

logs:
	docker compose -f infra/docker-compose.yml logs -f
