from datetime import UTC, datetime
from uuid import uuid4

import pytest
from intent_core_contracts.agents.envelope import AgentOutputEnvelope, AgentRunRecord
from intent_core_contracts.api.ftrack_version_note_sync import (
    ReviewNoteSyncCreate,
    VersionNoteSyncItemResult,
    VersionSyncCreate,
)
from intent_core_contracts.api.integrations import ExternalEntityLinkRead
from intent_core_contracts.api.production_context import (
    ProjectCreate,
    ProjectRead,
    ShotCreate,
    TaskCreate,
)
from intent_core_contracts.api.versions_and_feedback import (
    ReviewNoteCreate,
    ReviewNoteRead,
    VersionCreate,
    VersionRead,
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


# --- Step 8C-2: ftrack Version/ReviewNote sync contracts -------------------


def test_version_create_request_shape_is_unchanged() -> None:
    version = VersionCreate(shot_id=uuid4(), name="v1", version_number=1, description="First pass.")
    assert version.model_dump() == {
        "shot_id": version.shot_id,
        "task_id": None,
        "name": "v1",
        "version_number": 1,
        "description": "First pass.",
    }


def test_review_note_create_request_shape_is_unchanged() -> None:
    note = ReviewNoteCreate(content="Timing feels rushed.")
    assert note.model_dump() == {"content": "Timing feels rushed."}


@pytest.mark.parametrize(
    "extra_field",
    [
        "source",
        "external_id",
        "task_id",
        "source_created_at",
        "external_author_id",
        "external_author_name",
    ],
)
def test_version_create_rejects_ftrack_only_fields(extra_field: str) -> None:
    with pytest.raises(ValidationError):
        VersionCreate(
            shot_id=uuid4(),
            name="v1",
            description="d",
            **{extra_field: "x"},
        )


@pytest.mark.parametrize(
    "extra_field",
    [
        "source",
        "external_id",
        "task_id",
        "source_created_at",
        "external_author_id",
        "external_author_name",
    ],
)
def test_review_note_create_rejects_ftrack_only_fields(extra_field: str) -> None:
    with pytest.raises(ValidationError):
        ReviewNoteCreate(content="note", **{extra_field: "x"})


def test_version_read_accepts_null_new_fields() -> None:
    version = VersionRead(
        id=uuid4(),
        shot_id=uuid4(),
        name="v1",
        version_number=1,
        description="d",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
        created_at=datetime.now(UTC),
        task_id=None,
        source_created_at=None,
        external_author_id=None,
        external_author_name=None,
    )
    assert version.task_id is None
    assert version.source_created_at is None
    assert version.external_author_id is None
    assert version.external_author_name is None


def test_version_read_serializes_populated_new_fields() -> None:
    task_id = uuid4()
    source_created_at = datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC)
    version = VersionRead(
        id=uuid4(),
        shot_id=uuid4(),
        name="bc0040_comp_v003",
        version_number=3,
        description="",
        source="ftrack",
        created_by_actor_kind="system",
        created_by_actor_id="ftrack-sync",
        created_by_human_role=None,
        created_at=datetime.now(UTC),
        task_id=task_id,
        source_created_at=source_created_at,
        external_author_id="ftrack-user-42",
        external_author_name="Jane Reviewer",
    )
    dumped = version.model_dump()
    assert dumped["task_id"] == task_id
    assert dumped["source_created_at"] == source_created_at
    assert dumped["external_author_id"] == "ftrack-user-42"
    assert dumped["external_author_name"] == "Jane Reviewer"


def test_review_note_read_accepts_null_new_fields() -> None:
    note = ReviewNoteRead(
        id=uuid4(),
        version_id=uuid4(),
        content="note",
        source="manual",
        created_by_actor_kind="human",
        created_by_actor_id="vfx-1",
        created_by_human_role="vfx_supervisor",
        created_at=datetime.now(UTC),
        source_created_at=None,
        external_author_id=None,
        external_author_name=None,
    )
    assert note.source_created_at is None
    assert note.external_author_id is None
    assert note.external_author_name is None


def test_review_note_read_serializes_populated_new_fields() -> None:
    source_created_at = datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC)
    note = ReviewNoteRead(
        id=uuid4(),
        version_id=uuid4(),
        content="Client feedback synced from ftrack.",
        source="ftrack",
        created_by_actor_kind="system",
        created_by_actor_id="ftrack-sync",
        created_by_human_role=None,
        created_at=datetime.now(UTC),
        source_created_at=source_created_at,
        external_author_id="ftrack-author-7",
        external_author_name="Mrs. Client",
    )
    dumped = note.model_dump()
    assert dumped["source_created_at"] == source_created_at
    assert dumped["external_author_id"] == "ftrack-author-7"
    assert dumped["external_author_name"] == "Mrs. Client"


def _valid_version_sync_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "external_id": "029a25ce-8b60-11eb-bdb7-c2ffbce28b68",
        "shot_external_id": "2b5a847e-8b4f-11eb-b695-c2ffbce28b68",
        "name": "bc0040_comp_v003",
        "version_number": 3,
        "description": "",
        "source_created_at": datetime(2025, 5, 13, 13, 40, 52, tzinfo=UTC),
    }
    base.update(overrides)
    return base


def test_version_sync_create_accepts_minimum_required_fields() -> None:
    payload = VersionSyncCreate(**_valid_version_sync_kwargs())
    assert payload.task_external_id is None
    assert payload.external_author_id is None
    assert payload.external_author_name is None


@pytest.mark.parametrize("missing_field", ["external_id", "shot_external_id", "source_created_at"])
def test_version_sync_create_requires_stable_external_ids_and_timestamp(
    missing_field: str,
) -> None:
    kwargs = _valid_version_sync_kwargs()
    del kwargs[missing_field]
    with pytest.raises(ValidationError):
        VersionSyncCreate(**kwargs)


def test_version_sync_create_task_external_id_remains_optional() -> None:
    without_task = VersionSyncCreate(**_valid_version_sync_kwargs())
    assert without_task.task_external_id is None

    with_task = VersionSyncCreate(
        **_valid_version_sync_kwargs(task_external_id="2b8871cc-8b4f-11eb-b695-c2ffbce28b68")
    )
    assert with_task.task_external_id == "2b8871cc-8b4f-11eb-b695-c2ffbce28b68"


def test_version_sync_create_rejects_supplied_source() -> None:
    with pytest.raises(ValidationError):
        VersionSyncCreate(**_valid_version_sync_kwargs(source="ftrack"))


@pytest.mark.parametrize("icas_id_field", ["shot_id", "task_id", "version_id"])
def test_version_sync_create_rejects_icas_local_ids(icas_id_field: str) -> None:
    with pytest.raises(ValidationError):
        VersionSyncCreate(**_valid_version_sync_kwargs(**{icas_id_field: str(uuid4())}))


def test_version_sync_create_author_id_and_name_are_independently_optional() -> None:
    only_id = VersionSyncCreate(**_valid_version_sync_kwargs(external_author_id="ftrack-user-42"))
    assert only_id.external_author_id == "ftrack-user-42"
    assert only_id.external_author_name is None

    only_name = VersionSyncCreate(
        **_valid_version_sync_kwargs(external_author_name="Jane Reviewer")
    )
    assert only_name.external_author_id is None
    assert only_name.external_author_name == "Jane Reviewer"


def test_version_sync_create_rejects_naive_timestamp() -> None:
    with pytest.raises(ValidationError):
        VersionSyncCreate(**_valid_version_sync_kwargs(source_created_at=datetime(2025, 5, 13)))


def _valid_review_note_sync_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "external_id": "86685c99-d805-484d-89f7-1ea15a7272f9",
        "version_external_id": "029a25ce-8b60-11eb-bdb7-c2ffbce28b68",
        "content": "Whats this hard line? Can probably be cropped out.",
        "source_created_at": datetime(2025, 5, 20, 9, 56, 12, tzinfo=UTC),
    }
    base.update(overrides)
    return base


def test_review_note_sync_create_accepts_minimum_required_fields() -> None:
    payload = ReviewNoteSyncCreate(**_valid_review_note_sync_kwargs())
    assert payload.external_author_id is None
    assert payload.external_author_name is None


@pytest.mark.parametrize(
    "missing_field", ["external_id", "version_external_id", "content", "source_created_at"]
)
def test_review_note_sync_create_requires_stable_external_ids_and_timestamp(
    missing_field: str,
) -> None:
    kwargs = _valid_review_note_sync_kwargs()
    del kwargs[missing_field]
    with pytest.raises(ValidationError):
        ReviewNoteSyncCreate(**kwargs)


def test_review_note_sync_create_rejects_supplied_source() -> None:
    with pytest.raises(ValidationError):
        ReviewNoteSyncCreate(**_valid_review_note_sync_kwargs(source="ftrack"))


@pytest.mark.parametrize("icas_id_field", ["shot_id", "task_id", "version_id"])
def test_review_note_sync_create_rejects_icas_local_ids(icas_id_field: str) -> None:
    with pytest.raises(ValidationError):
        ReviewNoteSyncCreate(**_valid_review_note_sync_kwargs(**{icas_id_field: str(uuid4())}))


def test_review_note_sync_create_rejects_naive_timestamp() -> None:
    with pytest.raises(ValidationError):
        ReviewNoteSyncCreate(
            **_valid_review_note_sync_kwargs(source_created_at=datetime(2025, 5, 20))
        )


def test_sync_item_result_accepts_only_declared_outcomes() -> None:
    for outcome in ("created", "already_exists", "skipped"):
        result = VersionNoteSyncItemResult(outcome=outcome, external_id="029a25ce-8b60")
        assert result.outcome == outcome

    with pytest.raises(ValidationError):
        VersionNoteSyncItemResult(outcome="deleted", external_id="029a25ce-8b60")


def test_sync_item_result_skipped_carries_a_reason_and_no_entity_id() -> None:
    result = VersionNoteSyncItemResult(
        outcome="skipped",
        external_id="85e37ee8-8c33-11eb-b695-c2ffbce28b68",
        reason="shot_not_linked",
    )
    assert result.entity_id is None
    assert result.reason == "shot_not_linked"


def test_sync_item_result_created_carries_an_entity_id() -> None:
    entity_id = uuid4()
    result = VersionNoteSyncItemResult(
        outcome="created", entity_id=entity_id, external_id="029a25ce-8b60"
    )
    assert result.entity_id == entity_id
    assert result.reason is None
