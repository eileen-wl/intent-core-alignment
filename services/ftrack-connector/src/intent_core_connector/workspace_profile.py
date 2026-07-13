from __future__ import annotations

from pydantic import BaseModel, Field


class FtrackWorkspaceProfile(BaseModel):
    """Workspace-specific mapping, per docs/FTRACK_INTEGRATION.md §4.

    Every mapping field defaults empty on purpose: the exact ftrack
    hierarchy, task-type-to-department mapping, and status mapping are
    open questions (docs/FTRACK_INTEGRATION.md §16) that require a
    real ftrack test workspace to resolve. No Agent prompt or
    connector logic should hard-code a workspace-specific field name
    (docs/FTRACK_INTEGRATION.md §4).
    """

    workspace_name: str
    sequence_object_type: str | None = None
    shot_object_type: str | None = None
    task_type_to_department: dict[str, str] = Field(default_factory=dict)
    status_mapping: dict[str, str] = Field(default_factory=dict)
    relevant_custom_attributes: list[str] = Field(default_factory=list)
    allowed_write_back_fields: list[str] = Field(default_factory=list)
