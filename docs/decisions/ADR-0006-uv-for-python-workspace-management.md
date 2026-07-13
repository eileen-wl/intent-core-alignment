# ADR-0006: uv for Python package/workspace management

## Context

`apps/api`, `services/worker`, `services/ftrack-connector`, and
`packages/contracts/python` are four separate Python projects that
need to (a) each have their own dependency set and deployable
environment (`docs/ARCHITECTURE.md` §11 lists them as separate
deployment units) and (b) let `apps/api`, `services/worker`, and
`services/ftrack-connector` all depend on
`packages/contracts/python` without publishing it to a package index.
This is a "core technology choice" per `CLAUDE.md`'s change-boundary
list.

## Decision

Use a uv workspace: a root `pyproject.toml` with
`[tool.uv.workspace]` listing all four Python projects as members,
each with its own `pyproject.toml` and `[dependency-groups] dev`
section. `packages/contracts/python` is referenced from the other
three via `[tool.uv.sources] intent-core-contracts = { workspace =
true }`, resolving as a local path dependency. `uv.lock` is
committed once generated.

Commands that need real imports to resolve (`pytest`, `mypy`) run
per-project via `uv run --project <dir> ...`, since each project has
its own venv. `ruff` runs once against the whole tree since it only
parses source and needs no installed dependencies.

## Alternatives considered

- **Poetry** — mature, but has no native multi-package workspace
  concept; intra-repo path dependencies between
  `packages/contracts/python` and the three consumers would need
  manual `path = "..."` dependencies per project without a unified
  lockfile, so nothing would guarantee the four projects agree on a
  shared dependency's resolved version.
- **Plain pip + requirements.txt per project** — no lockfile, no
  workspace concept, would require hand-written path installs
  (`pip install -e ../../packages/contracts/python`) with no
  version pinning across the four projects.

## Consequences

- Contributors need `uv` installed locally (or use the Docker images,
  which use `ghcr.io/astral-sh/uv` base images).
- Every Python Dockerfile (`infra/api.Dockerfile`,
  `infra/worker.Dockerfile`, `infra/connector.Dockerfile`) copies the
  **entire** repo into the build context, not just its own
  subdirectory, because uv workspace resolution needs the root
  `pyproject.toml` and every member directory present on disk. This
  is a known tradeoff for this first pass — see
  `infra/README.md` "Known limitations."

## Status

Accepted. `uv.lock` has now been generated and committed (root of
the repo) with a real `uv` binary (0.11.28), resolving all four
workspace members cleanly with no dependency conflicts. `uv sync
--project <dir>` was run for all four members in order, and the CI
python job's exact commands (`ruff check`/`ruff format --check`,
`mypy`, `pytest`, all via `uv run --project <dir>`) were run for real
against the generated lock -- all pass. `.github/workflows/ci.yml`
now has a dedicated `uv lock --check` step plus `--locked` on every
`uv sync`, both confirmed to actually fail (not just exist) when the
lockfile is stale relative to a `pyproject.toml` change.

One behavior worth recording for future readers of this ADR: **a uv
workspace uses a single shared virtual environment at the workspace
root (`<repo>/.venv`) by default**, not one per member directory.
`uv sync --project X` replaces that shared venv's contents to match
only `X`'s resolved dependencies (removing what a prior sync for a
different member installed); `uv run --project X <cmd>` auto-syncs
`X`'s dependencies back in immediately before running, which is why
running all four `uv sync` calls up front in CI and then a separate
`uv run --project X` per check still works correctly. This means the
`.venv` path assumed by `infra/docker-compose.yml`'s anonymous-volume
fix for each Python service (`/repo/apps/api/.venv`,
`/repo/services/worker/.venv`,
`/repo/services/ftrack-connector/.venv`) does not match where `uv
sync` actually places the environment inside those containers (the
workspace root, `/repo/.venv`) -- worth a follow-up look at that
Compose file, tracked separately rather than changed here.
