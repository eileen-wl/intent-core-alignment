from datetime import UTC, datetime
from uuid import uuid4

import pytest
from intent_core_contracts.agents.envelope import AgentOutputEnvelope, AgentRunRecord
from intent_core_contracts.api.integrations import ExternalEntityLinkRead
from intent_core_contracts.api.production_context import (
    ProjectCreate,
    ProjectRead,
    ShotCreate,
    TaskCreate,
)
from intent_core_contracts.events.payloads import InternalEvent
from pydantic import ValidationError


def test_project_create_defaults_to_manual_source() -> None:
    project = ProjectCreate(name="Test Project")
    assert project.source == "manual"


def test_project_read_round_trip() -> None:
    now = datetime.now(UTC)
    project = ProjectRead(
        id=uuid4(), name="Test Project", source="manual", created_at=now, updated_at=now
    )
    assert project.model_dump()["source"] == "manual"


def test_shot_and_task_create_require_parent_ids() -> None:
    shot = ShotCreate(project_id=uuid4(), name="SH010")
    task = TaskCreate(shot_id=uuid4(), name="Lighting", department="lighting")
    assert shot.source == "manual"
    assert task.department == "lighting"


def test_ftrack_source_requires_external_id() -> None:
    with pytest.raises(ValidationError):
        ProjectCreate(name="Napo", source="ftrack")


def test_manual_source_forbids_external_id() -> None:
    with pytest.raises(ValidationError):
        ProjectCreate(name="Napo", source="manual", external_id="0123abcd")


def test_ftrack_source_with_external_id_succeeds() -> None:
    project = ProjectCreate(name="Napo", source="ftrack", external_id="0123abcd")
    assert project.external_id == "0123abcd"


def test_external_entity_link_read_round_trip() -> None:
    now = datetime.now(UTC)
    link = ExternalEntityLinkRead(
        id=uuid4(),
        entity_type="shot",
        entity_id=uuid4(),
        source="ftrack",
        external_id="0123abcd",
        created_at=now,
        updated_at=now,
    )
    assert link.model_dump()["source"] == "ftrack"


def test_internal_event_carries_internal_id_only() -> None:
    event = InternalEvent(
        event_type="SHOT_SYNCED",
        entity_id=uuid4(),
        occurred_at=datetime.now(UTC),
    )
    assert event.payload == {}


def test_agent_output_envelope_confidence_is_bounded() -> None:
    envelope = AgentOutputEnvelope(summary="Draft summary", confidence=0.5)
    assert 0.0 <= envelope.confidence <= 1.0


def test_agent_run_record_can_hold_no_output_yet() -> None:
    run = AgentRunRecord(
        id=uuid4(),
        agent_type="core_agent",
        capability="intent_decomposition",
        target_entity="shot:placeholder",
        context_snapshot_id=uuid4(),
        model_id="unassigned",
        prompt_version="unassigned",
        input_schema_version="v1",
        output_schema_version="v1",
        status="pending",
        created_at=datetime.now(UTC),
    )
    assert run.validated_output is None
