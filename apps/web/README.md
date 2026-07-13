# Web Application

Next.js (App Router) + TypeScript Dashboard.

Only two pages exist so far: a landing page and `/shots`, which calls
`apps/api`'s `GET /shots` to prove the web -> api -> Postgres -> web
path (`docs/PRODUCT_SCOPE.md` §15's manual-input path). No role-aware
views, auth, or Anchor UI exist yet — see the initialization plan in
`docs/decisions/` for what's deliberately deferred and why.

## Run locally

```bash
pnpm install
pnpm --filter web dev
```

Reads `API_BASE_URL` server-side only (never bundled into browser
code) to reach a running `apps/api`, defaulting to
`http://localhost:8000` if unset — the same default as
`.env.example`, so plain `pnpm --filter web dev` needs no
configuration in the common case.

Unlike the Python services, `apps/web` does **not** read the
repo-root `.env` — Next.js scopes its own `.env*` file loading to the
app directory, by design, and this repo doesn't work around that with
an `apps/web`-local `.env` file. Under `docker compose`, `API_BASE_URL`
is already set correctly (no action needed). For bare local dev
against a non-default API address, export it in your shell before
running `pnpm --filter web dev`:

```bash
export API_BASE_URL=http://localhost:8001
```
