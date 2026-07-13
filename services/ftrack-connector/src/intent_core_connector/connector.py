from __future__ import annotations

from dataclasses import dataclass

from intent_core_connector.config import get_settings


@dataclass
class ConnectionHealth:
    configured: bool
    detail: str


class FtrackConnector:
    """No-op stub. Does not connect to a real ftrack workspace.

    Real session handling, sync, and write-back are intentionally not
    implemented -- see the package docstring for why. `health()` only
    reports whether credentials are present, never their value
    (CLAUDE.md: "Do not expose or print secrets").
    """

    def __init__(self) -> None:
        self._settings = get_settings()

    def health(self) -> ConnectionHealth:
        configured = bool(
            self._settings.ftrack_server
            and self._settings.ftrack_api_user
            and self._settings.ftrack_api_key
        )
        if not configured:
            return ConnectionHealth(configured=False, detail="No ftrack credentials configured")
        return ConnectionHealth(
            configured=True,
            detail="Credentials present (connection not attempted by this stub)",
        )

    def connect(self) -> None:
        raise NotImplementedError(
            "Real ftrack session handling is not implemented until a test "
            "workspace is available (docs/API_AND_ACCOUNTS.md §1)."
        )
