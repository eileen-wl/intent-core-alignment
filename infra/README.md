# Infrastructure

Docker Compose for local development. Deployment infrastructure is not
set up yet (hosted Postgres/object-storage/deployment providers are
still undecided -- see `docs/decisions/`).

## Local development

```bash
cp .env.example .env   # first time only
make up                 # or: docker compose -f infra/docker-compose.yml up --build
```

Brings up `postgres`, `redis`, `minio`, `api`, `worker`, and `web`.

The `connector` service is **not** started by default -- there is no
ftrack test workspace yet (`docs/API_AND_ACCOUNTS.md` §1). Start it
explicitly once one exists:

```bash
docker compose -f infra/docker-compose.yml --profile ftrack up connector
```

## Known limitations of this first pass

- `api`, `worker`, and `connector` bind-mount only their own app
  directory for hot reload. Editing `packages/contracts/python`
  requires an image rebuild (`docker compose build`) to take effect,
  since it is installed into the shared uv workspace venv at
  `/repo/.venv` at build time -- not into a per-service venv (see
  `docs/decisions/ADR-0006-uv-for-python-workspace-management.md`).
- `minio` is for local S3-compatible parity only, not a commitment to
  a hosted object storage provider.
- No CI runner has executed this Compose file yet (this environment
  doesn't have Docker installed) -- treat it as reviewed-but-unrun
  until someone with Docker confirms `make up` works end to end.
