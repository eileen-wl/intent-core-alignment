"""Read-only workspace schema discovery.

This is how docs/FTRACK_INTEGRATION.md §16's open questions (which
object types represent Sequence/Shot, which statuses and custom
attributes exist) get answered empirically once a real workspace is
connected, instead of guessed.

WorkspaceDiscoveryReport is deliberately NOT FtrackWorkspaceProfile
and must never populate any of that type's mapping fields
(sequence_object_type, status_mapping, task_type_to_department,
allowed_write_back_fields, relevant_custom_attributes). This module
reports raw, unmapped facts for a human to read and hand-confirm into
a FtrackWorkspaceProfile later -- it does not decide the mapping
itself.
"""

from __future__ import annotations

import ftrack_api
import ftrack_api.exception
from pydantic import BaseModel

from intent_core_connector.errors import IntegrationError


class CustomAttributeConfigurationSummary(BaseModel):
    key: str
    label: str
    entity_type: str
    object_type_name: str | None = None


class WorkspaceDiscoveryReport(BaseModel):
    """Raw, unmapped snapshot of one connected workspace's schema."""

    server_url: str
    object_type_names: list[str]
    status_names: list[str]
    custom_attribute_configurations: list[CustomAttributeConfigurationSummary]


def discover_workspace(session: ftrack_api.Session, *, server_url: str) -> WorkspaceDiscoveryReport:
    try:
        object_type_names = sorted(
            row["name"] for row in session.query("select name from ObjectType")
        )
        status_names = sorted(row["name"] for row in session.query("select name from Status"))
        custom_attribute_configurations = [
            CustomAttributeConfigurationSummary(
                key=row["key"],
                label=row["label"],
                entity_type=row["entity_type"],
                object_type_name=(row["object_type"]["name"] if row.get("object_type") else None),
            )
            for row in session.query(
                "select key, label, entity_type, object_type.name from CustomAttributeConfiguration"
            )
        ]
    except ftrack_api.exception.ServerError as exc:
        raise IntegrationError(f"Discovery query failed: {exc}") from exc
    except Exception as exc:  # safety net: SDK query-surface not fully enumerated above
        raise IntegrationError(f"Unexpected error during discovery: {exc}") from exc

    return WorkspaceDiscoveryReport(
        server_url=server_url,
        object_type_names=object_type_names,
        status_names=status_names,
        custom_attribute_configurations=custom_attribute_configurations,
    )
