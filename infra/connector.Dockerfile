# Stub process -- see services/ftrack-connector. Kept behind the
# "ftrack" Compose profile so it does not run by default.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /repo
COPY . .

WORKDIR /repo/services/ftrack-connector
RUN uv sync --no-dev

CMD ["uv", "run", "python", "-m", "intent_core_connector"]
