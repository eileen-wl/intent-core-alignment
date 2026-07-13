FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /repo
COPY . .

WORKDIR /repo/services/worker
RUN uv sync --no-dev

CMD ["uv", "run", "arq", "intent_core_worker.worker_settings.WorkerSettings"]
