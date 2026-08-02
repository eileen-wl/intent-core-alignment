from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import ftrack_api
import ftrack_api.exception
import requests

from intent_core_connector.config import get_settings
from intent_core_connector.discovery import WorkspaceDiscoveryReport, discover_workspace
from intent_core_connector.errors import (
    IntegrationAuthenticationError,
    IntegrationConnectionError,
    IntegrationError,
)
from intent_core_connector.media_context import (
    AssetVersionMediaContext,
    read_media_context_for_asset_version,
)
from intent_core_connector.sample_entities import SampleEntityReport, read_sample_entities
from intent_core_connector.shot_context import ShotContext, read_shot_contexts_with_new_tasks_since
from intent_core_connector.version_note_context import (
    AssetVersionSweepResult,
    DirectNoteResult,
    ReviewSessionObjectNoteResult,
    read_asset_versions_for_shot,
    read_direct_notes_for_asset_version,
    read_review_session_object_notes_for_asset_version,
)
from intent_core_connector.writeback_client import write_note_to_shot


@dataclass
class ConnectionHealth:
    configured: bool
    detail: str


class FtrackConnector:
    """Server-side ftrack session wrapper (docs/FTRACK_INTEGRATION.md).

    Covers auth, read-only schema discovery (discovery.py), Shot context
    reads (shot_context.py), writing a controlled Note back to a Shot
    (writeback_client.py, ADR-0012), and pushing a synced Shot to
    apps/api (sync_client.py, called directly by services/worker per
    ADR-0011 -- not wrapped here since it doesn't need a live ftrack
    session). Event-Hub-based real-time sync is not implemented --
    docs/ARCHITECTURE.md §12 marks the event-transport choice
    provisional; reconciliation (ADR-0011) covers incremental sync
    instead. Agents must never call ftrack directly; only this process
    (and, per ADR-0011/ADR-0012, services/worker) does
    (docs/ARCHITECTURE.md §3.4).
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._session: ftrack_api.Session | None = None

    def _is_configured(self) -> bool:
        return bool(
            self._settings.ftrack_server
            and self._settings.ftrack_api_user
            and self._settings.ftrack_api_key
        )

    @property
    def is_connected(self) -> bool:
        return self._session is not None

    def health(self, *, probe: bool = False) -> ConnectionHealth:
        """Report configuration status. With probe=True, also attempt a
        real connection and report the outcome instead of raising.
        """
        if not self._is_configured():
            return ConnectionHealth(configured=False, detail="No ftrack credentials configured")
        if not probe:
            return ConnectionHealth(
                configured=True,
                detail="Credentials present (connection not attempted; pass probe=True to verify)",
            )
        try:
            self.connect()
        except IntegrationError as exc:
            return ConnectionHealth(
                configured=True, detail=f"Configured but connection failed: {exc}"
            )
        return ConnectionHealth(configured=True, detail="Connected to ftrack server")

    def connect(self) -> None:
        """Establish a real ftrack session. Idempotent -- a no-op if
        already connected. The event hub is deliberately not connected
        here (auto_connect_event_hub=False); that's incremental-sync
        territory for a later task, not this one.
        """
        if self._session is not None:
            return
        if not self._is_configured():
            raise IntegrationAuthenticationError("No ftrack credentials configured")
        try:
            self._session = ftrack_api.Session(
                server_url=self._settings.ftrack_server,
                api_user=self._settings.ftrack_api_user,
                api_key=self._settings.ftrack_api_key,
                auto_connect_event_hub=False,
            )
        except ftrack_api.exception.AuthenticationError as exc:
            raise IntegrationAuthenticationError(
                f"ftrack rejected the configured credentials: {exc}"
            ) from exc
        except ftrack_api.exception.ServerError as exc:
            raise IntegrationAuthenticationError(
                f"ftrack server reported an error during connect: {exc}"
            ) from exc
        except requests.exceptions.RequestException as exc:
            raise IntegrationConnectionError(
                f"Could not reach ftrack server {self._settings.ftrack_server!r}: {exc}"
            ) from exc
        except Exception as exc:  # safety net: SDK exception surface not fully enumerated above
            raise IntegrationError(f"Unexpected error connecting to ftrack: {exc}") from exc

    def close(self) -> None:
        if self._session is not None:
            self._session.close()
            self._session = None

    def discover_workspace(self) -> WorkspaceDiscoveryReport:
        if self._session is None:
            raise IntegrationError("connect() must succeed before discover_workspace()")
        return discover_workspace(self._session, server_url=self._settings.ftrack_server)

    def read_sample_entities(self, *, limit: int = 5) -> SampleEntityReport:
        if self._session is None:
            raise IntegrationError("connect() must succeed before read_sample_entities()")
        return read_sample_entities(self._session, limit=limit)

    def read_shot_contexts_with_new_tasks(
        self, *, since: datetime, limit: int = 20
    ) -> list[ShotContext]:
        if self._session is None:
            raise IntegrationError(
                "connect() must succeed before read_shot_contexts_with_new_tasks()"
            )
        return read_shot_contexts_with_new_tasks_since(self._session, since=since, limit=limit)

    def write_note_to_shot(self, *, shot_external_id: str, content: str) -> str:
        if self._session is None:
            raise IntegrationError("connect() must succeed before write_note_to_shot()")
        return write_note_to_shot(self._session, shot_external_id=shot_external_id, content=content)

    def read_asset_versions_for_shot(self, *, shot_external_id: str) -> AssetVersionSweepResult:
        if self._session is None:
            raise IntegrationError("connect() must succeed before read_asset_versions_for_shot()")
        return read_asset_versions_for_shot(self._session, shot_external_id=shot_external_id)

    def read_direct_notes_for_asset_version(self, *, version_external_id: str) -> DirectNoteResult:
        if self._session is None:
            raise IntegrationError(
                "connect() must succeed before read_direct_notes_for_asset_version()"
            )
        return read_direct_notes_for_asset_version(
            self._session, version_external_id=version_external_id
        )

    def read_review_session_object_notes_for_asset_version(
        self, *, version_external_id: str
    ) -> ReviewSessionObjectNoteResult:
        if self._session is None:
            raise IntegrationError(
                "connect() must succeed before read_review_session_object_notes_for_asset_version()"
            )
        return read_review_session_object_notes_for_asset_version(
            self._session, version_external_id=version_external_id
        )

    def read_media_context_for_asset_version(
        self, *, version_external_id: str
    ) -> AssetVersionMediaContext:
        if self._session is None:
            raise IntegrationError(
                "connect() must succeed before read_media_context_for_asset_version()"
            )
        return read_media_context_for_asset_version(
            self._session, version_external_id=version_external_id
        )

    def __enter__(self) -> FtrackConnector:
        self.connect()
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
