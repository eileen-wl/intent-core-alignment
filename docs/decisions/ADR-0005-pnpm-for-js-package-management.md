# ADR-0005: pnpm for JS/TS package management

## Context

`apps/web`, `packages/ui`, and `packages/contracts/ts` need a
JS/TS monorepo workspace tool. `docs/ARCHITECTURE.md` §12 lists the
worker framework and a few other choices as still provisional, but
does not name a JS package manager. `CLAUDE.md`'s change-boundary
list includes "core technology choices," so this needs to be recorded
rather than assumed silently.

## Decision

Use pnpm workspaces (`pnpm-workspace.yaml` at the repo root) for all
JS/TS packages, with `pnpm-lock.yaml` committed.

## Alternatives considered

- **npm workspaces** — built in, no extra tool, but slower installs
  and weaker disk efficiency than pnpm on a monorepo of this shape.
- **Yarn (Berry)** — comparable workspace support, but pnpm's
  strict node_modules layout catches phantom-dependency bugs (a
  package importing something it never declared) earlier, which
  matters once `packages/ui` and `packages/contracts/ts` are consumed
  by `apps/web`.

## Consequences

- Contributors need pnpm installed (or use `corepack enable`, since
  `package.json`'s `packageManager` field pins the version).
- `apps/web`'s Docker image (`infra/web.Dockerfile`) runs
  `corepack enable` before installing, so the pinned pnpm version is
  used consistently in CI, Docker, and local dev.

## Status

Proposed as part of the initial engineering skeleton
(`chore/initial-engineering-skeleton`). Verified locally: `pnpm
install`, `pnpm --filter web build`, `pnpm --filter web lint`,
and per-package `typecheck` all pass.
