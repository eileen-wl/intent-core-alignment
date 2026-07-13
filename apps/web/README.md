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

Requires `API_BASE_URL` (see `.env.example`) pointing at a running
`apps/api`.
