# Build context is the repo root (see infra/docker-compose.yml) because
# apps/api depends on packages/contracts/python via a uv workspace path
# dependency, which needs the workspace root pyproject.toml and every
# member directory present to resolve.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /repo
COPY . .

WORKDIR /repo/apps/api
RUN uv sync --no-dev

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "intent_core_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
