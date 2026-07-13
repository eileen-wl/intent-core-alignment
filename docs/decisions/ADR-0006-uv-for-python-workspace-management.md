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

Proposed as part of the initial engineering skeleton
(`chore/initial-engineering-skeleton`). Verified locally without a
`uv` binary available in this environment: dependencies, imports,
`alembic upgrade head`, `ruff`, `mypy`, and `pytest` were all
verified using a plain pip-installed virtualenv against the same
`pyproject.toml`/dependency declarations uv would resolve. The uv
workspace resolution itself (`uv sync`, `uv run --project`) has not
been executed end to end and should be confirmed by whoever has `uv`
installed before relying on it in CI.
