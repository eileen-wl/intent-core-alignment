# ftrack Connector

Reserved for server-side ftrack authentication, mapping, sync, event handling, reconciliation, and authorised write-back.

Agents must never call ftrack directly.

## Current status: stub only

The ftrack test workspace and API identity are "Not started"
(`docs/API_AND_ACCOUNTS.md` §1), and the entity mapping is explicitly
provisional (`docs/FTRACK_INTEGRATION.md` §3, §16). `FtrackConnector`
therefore only reports credential presence (`health()`) and raises
`NotImplementedError` on `connect()` — it does not sync anything.
`FtrackWorkspaceProfile` fixes the shape of the eventual per-workspace
mapping without pre-guessing any of its values.

Kept out of the default `docker compose up` (behind the `ftrack`
Compose profile) so its absence is explicit rather than a silent
connection failure.

## Test

```bash
uv run pytest
```
