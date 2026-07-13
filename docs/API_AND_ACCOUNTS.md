# API_AND_ACCOUNTS.md

**Project:** Intent Core Alignment System  
**Purpose:** Track external accounts, APIs, ownership, and secret handling

Do not store real credentials in this file.

## 1. Required external resources

| Resource | Purpose | Account owner | Status | Notes |
|---|---|---|---|---|
| GitHub organisation or repository | Shared code, Issues, PRs, Actions, Secrets | TBD | Not started | One repository for the full team |
| ftrack test workspace | Connector development and controlled workflow testing | TBD | Not started | Must allow test Project, Shot, Task, Version, Note, and Status operations |
| ftrack API identity | Server-side authentication | TBD | Not started | Prefer dedicated development identity, not a personal admin login |
| Runtime model API project | Core and Role Agent inference | TBD | Not started | Separate from Claude Code access |
| PostgreSQL environment | Application data and lineage | TBD | Not started | Local and shared deployment environments |
| Object storage | Images, videos, references, derived media | TBD | Not started | S3-compatible service or equivalent |
| Backend deployment | API, workers, Connector | TBD | Not started | Must support secrets and background processes |
| Frontend deployment | Dashboard and ftrack-linked views | TBD | Not started | HTTPS required for external access |
| Error monitoring | Runtime and integration errors | TBD | Optional | Decide before production-style testing |

## 2. ftrack access requirements

The test environment should allow the team to validate:

- authentication;
- reading Project and hierarchy context;
- reading Shot and Task records;
- reading and creating controlled test Versions and Notes;
- reading Status and assignment information;
- receiving relevant update events;
- writing one approved test Note or Status change;
- identifying schema or permission limitations.

The team must record findings in a later `FTRACK_FEASIBILITY.md` or `FTRACK_INTEGRATION.md`.

## 3. Runtime model API

Claude Code is used to build the software. The deployed product still requires a runtime model API.

The model project should have:

- one team-managed development project;
- a spending limit;
- server-side API access only;
- documented model choices;
- logging and retention decisions;
- separate development and presentation credentials where practical.

The API key must never be exposed in browser code.

## 4. Proposed environment variables

These names are project conventions and may be adjusted after feasibility testing.

```env
# Application
APP_ENV=
APP_BASE_URL=
API_BASE_URL=

# Database
DATABASE_URL=

# ftrack
FTRACK_SERVER=
FTRACK_API_USER=
FTRACK_API_KEY=

# Runtime model
MODEL_PROVIDER=
MODEL_API_KEY=
MODEL_NAME=

# Object storage
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=

# Optional queue / worker
REDIS_URL=

# Authentication
AUTH_SECRET=
```

Only variable names belong in `.env.example`. Real values belong in local secret files or deployment secret managers.

## 5. Secret-handling rules

- Never commit secrets to Git.
- Do not paste real keys into Issues, PRs, screenshots, or shared documents.
- Do not expose server-side keys through frontend environment variables.
- Use the minimum ftrack permissions required.
- Rotate credentials after accidental exposure.
- Record who owns each account and who can revoke access.
- Use separate test data; do not upload DNEG or confidential production material.
- Claude Code may edit `.env.example` but must not read or output real `.env` values.

## 6. Access checklist before implementation

Before the shared engineering skeleton is finalised, confirm:

- [ ] GitHub repository exists.
- [ ] Repository owner and backup owner are assigned.
- [ ] ftrack workspace is accessible.
- [ ] ftrack API authentication succeeds.
- [ ] Runtime model API access succeeds.
- [ ] Local PostgreSQL can run.
- [ ] File storage choice is documented.
- [ ] Each member can clone and start the shared repository.
- [ ] Deployment account ownership is clear.
- [ ] No real credentials are stored in project documents.

## 7. Decision rule

A team member must not introduce a new external platform, authentication provider, database, model provider, or storage service without recording:

- why it is needed;
- who owns it;
- cost or usage limits;
- data sent to it;
- replacement impact;
- approval from the Architecture Owner.
