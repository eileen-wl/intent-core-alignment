from datetime import UTC, datetime
from uuid import uuid4

from intent_core_contracts.agents.envelope import AgentOutputEnvelope, AgentRunRecord
from intent_core_contracts.api.production_context import (
    ProjectCreate,
    ProjectRead,
    ShotCreate,
    TaskCreate,
)
from intent_core_contracts.events.payloads import InternalEvent


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
