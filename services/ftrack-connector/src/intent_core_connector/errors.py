"""Connector-level failure types, per docs/FTRACK_INTEGRATION.md §13.

Callers (health(), __main__, future apps/api callers) catch these
instead of ftrack_api/requests exception types directly, so the
connector's failure surface stays stable if the underlying SDK's
exception hierarchy changes. These are in-process exceptions only --
persisting a failure as the `IntegrationError` domain record requires
an apps/api HTTP call (services/ftrack-connector must not write to
Postgres directly, per ADR-0008) and is out of scope until the sync
follow-up.
"""

from __future__ import annotations


class IntegrationError(Exception):
    """Base class for all connector-level failures."""


class IntegrationAuthenticationError(IntegrationError):
    """Credentials were missing, or present but rejected by the server."""


class IntegrationConnectionError(IntegrationError):
    """The ftrack server could not be reached (network/DNS/timeout)."""
