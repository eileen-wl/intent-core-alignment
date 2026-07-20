# ADR-0009: ftrack-python-api as the ftrack SDK

## Context

`services/ftrack-connector`'s `FtrackConnector.connect()` has been a stub
that unconditionally raises `NotImplementedError`, because no ftrack test
workspace or API credentials existed (`docs/API_AND_ACCOUNTS.md` §1). No
dependency for talking to ftrack has been declared anywhere in the
workspace. Choosing how to talk to ftrack's server is a "core technology
choice" per `CLAUDE.md`'s change-boundary list.

## Decision

Use ftrack's official Python SDK, `ftrack-python-api` (imported as
`ftrack_api`), for all real ftrack server communication in
`services/ftrack-connector`.

## Alternatives considered

- **Raw REST calls against ftrack's HTTP API** — rejected. It would mean
  reimplementing entity CRUD, ftrack's query-expression language, and the
  Event Hub protocol that the official SDK already provides and that
  ftrack itself documents and supports. There is no meaningful reduction
  in dependency surface to justify hand-rolling this.
- No other maintained Python ftrack client exists.

## Consequences

- `services/ftrack-connector/pyproject.toml` gains two direct runtime
  dependencies: `ftrack-python-api` and `requests` (declared directly,
  not left transitive, because `connector.py` catches
  `requests.exceptions.RequestException` directly).
- `ftrack_api` ships no inline type stubs, so root `pyproject.toml` has a
  `[[tool.mypy.overrides]] module = "ftrack_api.*" ignore_missing_imports = true`
  entry, mirroring the existing `alembic.*` override.
- The SDK's Event Hub/websocket machinery is deliberately not used yet
  (`auto_connect_event_hub=False` in every `ftrack_api.Session(...)`
  construction) — that is incremental-sync territory
  (`docs/FTRACK_INTEGRATION.md` §6), a later task, not this one.
- This slice only covers real session authentication and read-only schema
  discovery (`discovery.py`) — no entity mapping, sync, or write-back.
  Those still require a Decision Record of their own once a real
  workspace's schema is known (`docs/FTRACK_INTEGRATION.md` §3, §16).

## Status

Accepted. `errors.py` (`IntegrationError`/`IntegrationAuthenticationError`/
`IntegrationConnectionError`), `connector.py` (real `connect()`/`health()`/
`close()`/context-manager support), and `discovery.py` (read-only
`WorkspaceDiscoveryReport`) are implemented and covered by tests mocked at
the `ftrack_api.Session` boundary — no real ftrack server has been reached
yet (credentials exist for one team member's trial workspace as of this
writing, but running the real connect/discover path against it is a
follow-up verification step, not part of this change).
