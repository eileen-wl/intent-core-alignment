"""VFX Alignment Inbox read-model service (Step 7C-1).

Composes real, already-persisted Shot/CoreAnchor/HumanGate/
CrossRoleAssessment/IntentSignal/ReAnchorProposal/ExecutionAnchor/role-
output state into one bounded ``VfxInboxItemRead`` per Shot -- no new
mutation logic, no notification/read state, no fabricated metric.

Bounded query strategy at portfolio scale (docs/step-7/16_STEP_7C0D_...md
§6.5): one query per domain object type per Shot (Core Anchor + its
revisions, HumanGates, latest CrossRoleAssessment + its Signal/Proposal,
Tasks + their Execution Anchors, Versions, and existence checks for the
three role outputs) -- never a per-row subquery inside a loop over
unrelated Shots.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from intent_core_contracts.api.vfx_inbox import (
    VfxInboxItemRead,
    VfxInboxNextFocusRead,
    VfxInboxRead,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    HumanGate,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    IntentSignal,
    ReAnchorProposal,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.vfx_inbox.current_focus import (
    ShotFocusInputs,
    derive_current_focus,
    derive_next_focus_candidates,
    sort_rank_for_focus_type,
)


@dataclass(frozen=True)
class _ShotRelatedData:
    core_anchor: CoreAnchor | None
    active_revision: CoreAnchorRevision | None
    latest_revision_created_at: datetime | None
    draft_revision_without_gate: bool
    pending_gate_id: uuid.UUID | None
    latest_gate_resolved_at: datetime | None
    latest_assessment: CrossRoleAssessment | None
    latest_signal: IntentSignal | None
    re_anchor_proposal_present: bool
    tasks: list[Task]
    versions: list[Version]
    # task_id -> execution_anchor_revision_id
    task_confirmed_execution_anchor: dict[uuid.UUID, uuid.UUID]
    versions_with_vfx_review: set[uuid.UUID]
    # (task_id, version_id)
    tasks_with_artist_guidance_by_version: set[tuple[uuid.UUID, uuid.UUID]]
    execution_revisions_with_cg_review: set[uuid.UUID]


async def _load_shot_related_data(session: AsyncSession, shot_id: uuid.UUID) -> _ShotRelatedData:
    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))

    active_revision: CoreAnchorRevision | None = None
    latest_revision_created_at: datetime | None = None
    draft_revision_without_gate = False
    pending_gate_id: uuid.UUID | None = None
    latest_gate_resolved_at: datetime | None = None

    if core_anchor is not None:
        if core_anchor.active_revision_id is not None:
            active_revision = await session.get(CoreAnchorRevision, core_anchor.active_revision_id)

        latest_revision_created_at = await session.scalar(
            select(func.max(CoreAnchorRevision.created_at)).where(
                CoreAnchorRevision.core_anchor_id == core_anchor.id
            )
        )

        gates = list(
            (
                await session.execute(
                    select(HumanGate).where(
                        HumanGate.shot_id == shot_id,
                        HumanGate.gate_type == "core_anchor_confirmation",
                    )
                )
            )
            .scalars()
            .all()
        )
        for gate in gates:
            if gate.status == "pending":
                pending_gate_id = gate.id
            if gate.resolved_at is not None and (
                latest_gate_resolved_at is None or gate.resolved_at > latest_gate_resolved_at
            ):
                latest_gate_resolved_at = gate.resolved_at

        if pending_gate_id is None:
            gated_revision_ids = {gate.core_anchor_revision_id for gate in gates}
            draft_revisions = list(
                (
                    await session.execute(
                        select(CoreAnchorRevision).where(
                            CoreAnchorRevision.core_anchor_id == core_anchor.id,
                            CoreAnchorRevision.status == "draft",
                        )
                    )
                )
                .scalars()
                .all()
            )
            draft_revision_without_gate = any(
                revision.id not in gated_revision_ids for revision in draft_revisions
            )

    latest_assessment = await session.scalar(
        select(CrossRoleAssessment)
        .where(CrossRoleAssessment.shot_id == shot_id)
        .order_by(CrossRoleAssessment.created_at.desc(), CrossRoleAssessment.id.desc())
        .limit(1)
    )
    latest_signal: IntentSignal | None = None
    re_anchor_proposal_present = False
    if latest_assessment is not None:
        latest_signal = await session.scalar(
            select(IntentSignal).where(
                IntentSignal.cross_role_assessment_id == latest_assessment.id
            )
        )
        proposal = await session.scalar(
            select(ReAnchorProposal.id).where(
                ReAnchorProposal.cross_role_assessment_id == latest_assessment.id
            )
        )
        re_anchor_proposal_present = proposal is not None

    tasks = list(
        (
            await session.execute(
                select(Task).where(Task.shot_id == shot_id).order_by(Task.created_at)
            )
        )
        .scalars()
        .all()
    )
    versions = list(
        (
            await session.execute(
                select(Version).where(Version.shot_id == shot_id).order_by(Version.created_at)
            )
        )
        .scalars()
        .all()
    )

    task_confirmed_execution_anchor: dict[uuid.UUID, uuid.UUID] = {}
    if tasks:
        task_ids = [task.id for task in tasks]
        anchors = list(
            (
                await session.execute(
                    select(ExecutionAnchor).where(
                        ExecutionAnchor.task_id.in_(task_ids),
                        ExecutionAnchor.active_revision_id.is_not(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        for anchor in anchors:
            if anchor.active_revision_id is not None:
                task_confirmed_execution_anchor[anchor.task_id] = anchor.active_revision_id

    versions_with_vfx_review: set[uuid.UUID] = set()
    if versions:
        version_ids = [version.id for version in versions]
        vfx_review_rows = (
            await session.execute(
                select(VFXSupervisorReview.version_id).where(
                    VFXSupervisorReview.version_id.in_(version_ids)
                )
            )
        ).all()
        versions_with_vfx_review = {row[0] for row in vfx_review_rows}

    tasks_with_artist_guidance_by_version: set[tuple[uuid.UUID, uuid.UUID]] = set()
    if tasks and versions:
        artist_guidance_rows = (
            await session.execute(
                select(ArtistAgentGuidance.task_id, ArtistAgentGuidance.version_id).where(
                    ArtistAgentGuidance.shot_id == shot_id
                )
            )
        ).all()
        tasks_with_artist_guidance_by_version = {
            (row[0], row[1]) for row in artist_guidance_rows
        }

    execution_revisions_with_cg_review: set[uuid.UUID] = set()
    if task_confirmed_execution_anchor:
        cg_review_rows = (
            await session.execute(
                select(CGSupervisorReview.execution_anchor_revision_id).where(
                    CGSupervisorReview.execution_anchor_revision_id.in_(
                        task_confirmed_execution_anchor.values()
                    )
                )
            )
        ).all()
        execution_revisions_with_cg_review = {row[0] for row in cg_review_rows}

    return _ShotRelatedData(
        core_anchor=core_anchor,
        active_revision=active_revision,
        latest_revision_created_at=latest_revision_created_at,
        draft_revision_without_gate=draft_revision_without_gate,
        pending_gate_id=pending_gate_id,
        latest_gate_resolved_at=latest_gate_resolved_at,
        latest_assessment=latest_assessment,
        latest_signal=latest_signal,
        re_anchor_proposal_present=re_anchor_proposal_present,
        tasks=tasks,
        versions=versions,
        task_confirmed_execution_anchor=task_confirmed_execution_anchor,
        versions_with_vfx_review=versions_with_vfx_review,
        tasks_with_artist_guidance_by_version=tasks_with_artist_guidance_by_version,
        execution_revisions_with_cg_review=execution_revisions_with_cg_review,
    )


def _assessment_generation_check(
    core_anchor_confirmed: bool, data: _ShotRelatedData
) -> tuple[bool, str | None]:
    """Ordered prerequisite check (docs/step-7/15_STEP_7C0C_...md §6.5):
    confirmed Core Anchor -> confirmed Execution Anchor for at least one
    Task -> all three role outputs present for at least one Task/Version
    pair. Returns (available, honest missing-prerequisite explanation).
    """
    if not core_anchor_confirmed:
        return False, None

    if not data.task_confirmed_execution_anchor:
        return False, (
            "Assessment generation requires a confirmed Execution Anchor, which does not "
            "exist yet for this Shot's Tasks. This is owned by the CG Supervisor."
        )

    for task_id, execution_revision_id in data.task_confirmed_execution_anchor.items():
        if execution_revision_id not in data.execution_revisions_with_cg_review:
            continue
        for version in data.versions:
            if version.id not in data.versions_with_vfx_review:
                continue
            if (task_id, version.id) not in data.tasks_with_artist_guidance_by_version:
                continue
            return True, None

    return False, (
        "Assessment generation requires a VFX Supervisor review, a CG Supervisor review, "
        "and Artist Agent guidance to all exist for the same Task and Version."
    )


def _to_shot_focus_inputs(shot_id: uuid.UUID, data: _ShotRelatedData) -> ShotFocusInputs:
    core_anchor_confirmed = (
        data.active_revision is not None and data.active_revision.status == "confirmed"
    )
    generation_available, missing_explanation = _assessment_generation_check(
        core_anchor_confirmed, data
    )
    assessment = data.latest_assessment
    signal = data.latest_signal

    return ShotFocusInputs(
        shot_id=shot_id,
        core_anchor_confirmed=core_anchor_confirmed,
        active_core_anchor_revision_id=data.active_revision.id if data.active_revision else None,
        latest_core_anchor_revision_created_at=data.latest_revision_created_at,
        pending_core_anchor_gate_id=data.pending_gate_id,
        draft_revision_without_gate_exists=data.draft_revision_without_gate,
        latest_core_anchor_gate_resolved_at=data.latest_gate_resolved_at,
        latest_assessment_id=assessment.id if assessment else None,
        latest_assessment_created_at=assessment.created_at if assessment else None,
        latest_signal_attention_level=signal.attention_level if signal else None,  # type: ignore[arg-type]
        re_anchor_proposal_present=data.re_anchor_proposal_present,
        assessment_generation_available=generation_available,
        missing_prerequisite_explanation=missing_explanation,
    )


def _task_version_display(data: _ShotRelatedData) -> tuple[
    uuid.UUID | None, str | None, uuid.UUID | None, str | None, int | None, bool
]:
    """Honest Task/Version display (docs/step-7/15_STEP_7C0C_...md §3):
    the latest Assessment's own persisted pairing when one exists (an
    explicit, asserted pairing -- ``pairing_established=True``);
    otherwise the latest Task and latest Version shown as two
    independent facts (``pairing_established=False``), never implied to
    be paired.
    """
    if data.latest_assessment is not None:
        task = next((t for t in data.tasks if t.id == data.latest_assessment.task_id), None)
        version = next(
            (v for v in data.versions if v.id == data.latest_assessment.version_id), None
        )
        return (
            data.latest_assessment.task_id,
            task.name if task else None,
            data.latest_assessment.version_id,
            version.name if version else None,
            version.version_number if version else None,
            True,
        )

    latest_task = data.tasks[-1] if data.tasks else None
    latest_version = data.versions[-1] if data.versions else None
    return (
        latest_task.id if latest_task else None,
        latest_task.name if latest_task else None,
        latest_version.id if latest_version else None,
        latest_version.name if latest_version else None,
        latest_version.version_number if latest_version else None,
        False,
    )


async def build_inbox_item(
    session: AsyncSession, shot: Shot, project_name: str
) -> VfxInboxItemRead:
    data = await _load_shot_related_data(session, shot.id)
    inputs = _to_shot_focus_inputs(shot.id, data)
    current_focus = derive_current_focus(inputs)
    next_candidates = [
        VfxInboxNextFocusRead(**candidate.model_dump())
        for candidate in derive_next_focus_candidates(inputs)
    ]

    has_draft_or_gate = (
        data.active_revision is not None
        or data.draft_revision_without_gate
        or data.pending_gate_id
    )
    if data.core_anchor is None:
        core_anchor_state = "none"
    elif inputs.core_anchor_confirmed:
        core_anchor_state = "confirmed"
    elif has_draft_or_gate:
        core_anchor_state = "draft_pending"
    else:
        core_anchor_state = "none"

    (
        task_id,
        task_name,
        version_id,
        version_name,
        version_number,
        pairing_established,
    ) = _task_version_display(data)

    signal_summary: str | None = None
    if data.latest_signal is not None:
        signal_summary = data.latest_signal.signal_output.get("summary")

    # Deterministic tie-break within the same precedence bucket: most
    # recent relevant timestamp descending, encoded as a negative
    # microsecond ordinal so a plain ascending sort on (bucket, ordinal)
    # naturally yields "most recent first" within the bucket; a Shot with
    # no relevant timestamp sorts last within its own bucket.
    relevant_timestamp = (
        data.latest_gate_resolved_at
        or (data.active_revision.created_at if data.active_revision else None)
        or (data.latest_assessment.created_at if data.latest_assessment else None)
        or shot.created_at
    )
    bucket = sort_rank_for_focus_type(current_focus.focus_type)
    ordinal = -int(relevant_timestamp.timestamp() * 1_000_000) if relevant_timestamp else 0

    assessment = data.latest_assessment
    signal = data.latest_signal
    revision = data.active_revision

    return VfxInboxItemRead(
        project_id=shot.project_id,
        project_name=project_name,
        shot_id=shot.id,
        shot_name=shot.name,
        shot_source=shot.source,  # type: ignore[arg-type]
        core_anchor_state=core_anchor_state,  # type: ignore[arg-type]
        active_core_anchor_revision_id=revision.id if revision else None,
        active_core_anchor_summary=revision.core_summary if revision else None,
        pending_human_gate_id=data.pending_gate_id,
        relevant_task_id=task_id,
        relevant_task_name=task_name,
        relevant_version_id=version_id,
        relevant_version_name=version_name,
        relevant_version_number=version_number,
        pairing_established=pairing_established,
        latest_assessment_id=assessment.id if assessment else None,
        latest_assessment_created_at=assessment.created_at if assessment else None,
        latest_signal_id=signal.id if signal else None,
        latest_signal_attention_level=signal.attention_level if signal else None,  # type: ignore[arg-type]
        latest_signal_summary=signal_summary,
        re_anchor_proposal_present=data.re_anchor_proposal_present,
        current_focus=current_focus,
        next_candidates=next_candidates,
        sort_rank=bucket * 1_000_000_000_000 + ordinal,
    )


async def list_inbox_items(session: AsyncSession) -> VfxInboxRead:
    # Step 7C-1: every real Shot is listed here, unfiltered -- there is no
    # more Guided/Explore split, so no Shot needs excluding by identity.
    # The generic development seed's second, deliberately-unconfirmed Shot
    # (`demo_seed.d1_scenario._ensure_uninitialized_shot`) appears here like
    # any other Shot.
    query = select(Shot).order_by(Shot.created_at)
    shots = list((await session.execute(query)).scalars().all())
    project_ids = {shot.project_id for shot in shots}
    projects: dict[uuid.UUID, str] = {}
    if project_ids:
        rows = (
            await session.execute(
                select(Project.id, Project.name).where(Project.id.in_(project_ids))
            )
        ).all()
        projects = {row[0]: row[1] for row in rows}

    items = [
        await build_inbox_item(session, shot, projects.get(shot.project_id, ""))
        for shot in shots
    ]
    items.sort(key=lambda item: (item.sort_rank, str(item.shot_id)))
    return VfxInboxRead(items=items, generated_at=datetime.now(UTC))


async def get_inbox_item_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> VfxInboxItemRead | None:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        return None
    project = await session.get(Project, shot.project_id)
    project_name = project.name if project is not None else ""
    return await build_inbox_item(session, shot, project_name)
