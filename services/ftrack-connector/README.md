# ftrack Connector

Reserved for server-side ftrack authentication, mapping, sync, event handling, reconciliation, and authorised write-back.

Agents must never call ftrack directly.

## Current status: real auth + read-only discovery, no mapping/sync yet

`FtrackConnector` authenticates a real `ftrack_api.Session`
(`connect()`/`health(probe=True)`/`close()`, see ADR-0009) and can run
read-only schema discovery (`discover_workspace()` in `discovery.py`)
against a connected workspace, reporting the raw object types,
statuses, and custom attribute configurations that exist there.

It does **not** map or sync any entities, listen for events, or write
anything back — the entity mapping is explicitly provisional
(`docs/FTRACK_INTEGRATION.md` §3, §16) and must not be built against a
guessed schema. `discover_workspace()` is a reporting tool for a human
to read and hand-confirm into a `FtrackWorkspaceProfile` afterward; it
never populates that type itself. `FtrackWorkspaceProfile` fixes the
shape of the eventual per-workspace mapping without pre-guessing any
of its values.

Run `python -m intent_core_connector` with real credentials in `.env`
to connect and print a discovery report; without credentials it prints
the same "not configured" message as before.

Kept out of the default `docker compose up` (behind the `ftrack`
Compose profile) so its absence is explicit rather than a silent
connection failure.

`FTRACK_SERVER`/`FTRACK_API_USER`/`FTRACK_API_KEY` are read from the
repo-root `.env` regardless of which directory this is run from —
`intent_core_connector.config.Settings` resolves it via an absolute
path, not the current working directory. No per-package `.env` file
is needed or read.

## Test

```bash
uv run pytest
```
