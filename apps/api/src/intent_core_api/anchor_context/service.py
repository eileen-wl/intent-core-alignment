"""Package A Anchor Context derivation.

This service composes existing authoritative records and existing role
Current-focus read models. It performs no writes and never runs an Agent.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from intent_core_contracts.api.anchor_context import (
    AnchorAttentionContextRead,
    AnchorContextRead,
    AnchorContextSummaryListRead,
    AnchorContextSummaryRead,
    AnchorNextActionRead,
    AnchorVersionContextRead,
    CoreAnchorContextRead,
    ExecutionAnchorContextRead,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from intent_core_api.artist_inbox import service as artist_inbox_service
from intent_core_api.cg_inbox import service as cg_inbox_service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.intent.models import (
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
)
from intent_core_api.production_context.models import Shot, Task
from intent_core_api.versions_and_feedback.models import (
    IntentSignal,
)
from intent_core_api.vfx_inbox import service as vfx_inbox_service
from intent_core_api.workflow.exceptions import NotFoundError

_ATTENTION_REQUIREMENT = {
    "vfx_supervisor": {
        "low": "Current evidence supports the confirmed direction.",
        "medium": "One or more changes need creative review.",
        "high": "Human VFX review is required before the direction continues.",
        "not_assessed": "No current Intent Signal has been generated.",
    },
    "cg_supervisor": {
        "low": "Current execution remains within confirmed boundaries.",
        "medium": "Technical execution may be placing pressure on the creative direction.",
        "high": "Execution may affect the Core Anchor and requires escalation or review.",
        "not_assessed": "No current cross-role attention result is available.",
    },
    "artist": {
        "low": "Current changes are within the confirmed working range.",
        "medium": "Check current Guidance or ask CG before continuing.",
        "high": "Pause this direction and request supervisor clarification.",
        "not_assessed": "No current attention result is available for this Task.",
    },
}

_DOWNSTREAM_EFFECT = {
    "core_anchor_gate_pending": (
        "Confirmation will make the shared direction available for department translation."
    ),
    "core_anchor_draft_needs_review": (
        "Submitting and confirming the draft will establish the shared direction for CG."
    ),
    "alignment_not_followed_by_anchor_action": (
        "Your interpretation determines whether the current Anchor remains sufficient."
    ),
    "re_anchor_proposal_present": (
        "Review may lead to a human-authored Core Anchor revision; "
        "the proposal changes nothing itself."
    ),
    "assessment_generation_available": (
        "The resulting assessment will make cross-role attention evidence visible."
    ),
    "execution_anchor_gate_pending": (
        "Confirmation will update the department working direction available to Artists."
    ),
    "execution_anchor_draft_needs_review": (
        "A confirmed translation will define the Artist's current execution boundary."
    ),
    "dependency_needs_attention": (
        "Clarifying the issue will show whether work can continue or needs VFX escalation."
    ),
    "version_review_available": (
        "The review will add technical execution evidence for cross-role assessment."
    ),
    "guidance_outdated": (
        "Regenerated Guidance will reference the current confirmed Execution Anchor."
    ),
    "review_note_needs_response": (
        "The next iteration can respond to recorded production feedback."
    ),
    "guidance_available": (
        "Guidance will translate the confirmed Anchors into advisory next-iteration actions."
    ),
}


async def _core_context(session: AsyncSession, shot_id: uuid.UUID) -> CoreAnchorContextRead:
    anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))
    if anchor is None:
        return CoreAnchorContextRead(
            exists=False,
            lifecycle_state="missing",
            confirmed_revision_id=None,
            confirmed_revision_number=None,
            direction_summary=None,
            must_preserve=None,
            allowed_variation=None,
            confirmed_by_human_role=None,
            confirmed_by_actor_id=None,
            link_target=f"/vfx/shots/{shot_id}/intent",
            newer_draft_exists=False,
            pending_human_gate_exists=False,
            draft_revision_number=None,
        )

    revisions = list(
        (
            await session.execute(
                select(CoreAnchorRevision)
                .where(CoreAnchorRevision.core_anchor_id == anchor.id)
                .options(
                    selectinload(CoreAnchorRevision.constraints),
                    selectinload(CoreAnchorRevision.variation_zones),
                )
                .order_by(CoreAnchorRevision.revision_number.desc())
            )
        )
        .scalars()
        .all()
    )
    confirmed = next(
        (revision for revision in revisions if revision.id == anchor.active_revision_id), None
    )
    draft = next((revision for revision in revisions if revision.status == "draft"), None)
    pending_gate = None
    if draft is not None:
        pending_gate = await session.scalar(
            select(HumanGate).where(
                HumanGate.core_anchor_revision_id == draft.id,
                HumanGate.status == "pending",
            )
        )
    newer_draft = bool(
        draft is not None
        and confirmed is not None
        and draft.revision_number > confirmed.revision_number
    )
    return CoreAnchorContextRead(
        exists=True,
        lifecycle_state="confirmed" if confirmed is not None else ("draft" if draft else "missing"),
        confirmed_revision_id=confirmed.id if confirmed else None,
        confirmed_revision_number=confirmed.revision_number if confirmed else None,
        direction_summary=(confirmed.core_summary or confirmed.shot_objective)
        if confirmed
        else None,
        must_preserve=(
            confirmed.constraints[0].content if confirmed and confirmed.constraints else None
        ),
        allowed_variation=(
            confirmed.variation_zones[0].content
            if confirmed and confirmed.variation_zones
            else None
        ),
        confirmed_by_human_role=confirmed.confirmed_by_human_role if confirmed else None,  # type: ignore[arg-type]
        confirmed_by_actor_id=confirmed.confirmed_by_actor_id if confirmed else None,
        link_target=f"/vfx/shots/{shot_id}/intent",
        newer_draft_exists=newer_draft,
        pending_human_gate_exists=pending_gate is not None,
        draft_revision_number=draft.revision_number if draft else None,
    )


def _draft_source(revision: ExecutionAnchorRevision | None) -> str | None:
    if revision is None:
        return None
    if revision.supersedes_revision_id is not None:
        return "copied_from_prior_revision"
    if revision.created_by_actor_kind == "agent":
        return "agent_proposed"
    if revision.created_by_actor_kind == "human":
        return "human_created"
    return "unknown"


async def _execution_context(
    session: AsyncSession,
    task: Task,
    core: CoreAnchorContextRead,
) -> ExecutionAnchorContextRead:
    anchor = await session.scalar(select(ExecutionAnchor).where(ExecutionAnchor.task_id == task.id))
    if anchor is None:
        return ExecutionAnchorContextRead(
            exists=False,
            department=task.department,
            lifecycle_state="missing",
            context_state="missing",
            confirmed_revision_id=None,
            confirmed_revision_number=None,
            direction_summary=None,
            execution_boundary=None,
            allowed_refinement=None,
            based_on_core_anchor_revision_id=None,
            based_on_core_anchor_revision_number=None,
            upstream_relationship_available=False,
            confirmed_by_human_role=None,
            confirmed_by_actor_id=None,
            link_target=f"/cg/tasks/{task.id}/execution",
            draft_revision_number=None,
            draft_source=None,
        )

    revisions = list(
        (
            await session.execute(
                select(ExecutionAnchorRevision)
                .where(ExecutionAnchorRevision.execution_anchor_id == anchor.id)
                .order_by(ExecutionAnchorRevision.revision_number.desc())
            )
        )
        .scalars()
        .all()
    )
    confirmed = next(
        (revision for revision in revisions if revision.id == anchor.active_revision_id), None
    )
    draft = next((revision for revision in revisions if revision.status == "draft"), None)
    pending = False
    if draft is not None:
        pending = (
            await session.scalar(
                select(HumanGate.id).where(
                    HumanGate.execution_anchor_revision_id == draft.id,
                    HumanGate.status == "pending",
                )
            )
            is not None
        )

    based_on_number = None
    relationship_available = False
    if confirmed is not None:
        upstream = await session.get(CoreAnchorRevision, confirmed.core_anchor_revision_id)
        if upstream is not None:
            based_on_number = upstream.revision_number
            relationship_available = True

    if confirmed is not None:
        if relationship_available and core.confirmed_revision_id is not None:
            context_state = (
                "outdated"
                if anchor.is_stale
                or confirmed.core_anchor_revision_id != core.confirmed_revision_id
                else "current"
            )
        else:
            context_state = "relationship_unavailable"
    elif draft is not None:
        context_state = "pending" if pending else "draft"
    else:
        context_state = "missing"

    return ExecutionAnchorContextRead(
        exists=True,
        department=task.department,
        lifecycle_state="confirmed" if confirmed else ("draft" if draft else "missing"),
        context_state=context_state,  # type: ignore[arg-type]
        confirmed_revision_id=confirmed.id if confirmed else None,
        confirmed_revision_number=confirmed.revision_number if confirmed else None,
        direction_summary=confirmed.technical_boundaries if confirmed else None,
        execution_boundary=(
            confirmed.production_ready_criteria
            or confirmed.delivery_conditions
            or confirmed.parameter_ranges
            if confirmed
            else None
        ),
        allowed_refinement=confirmed.allowed_refinements if confirmed else None,
        based_on_core_anchor_revision_id=(confirmed.core_anchor_revision_id if confirmed else None),
        based_on_core_anchor_revision_number=based_on_number,
        upstream_relationship_available=relationship_available,
        confirmed_by_human_role=confirmed.confirmed_by_human_role if confirmed else None,  # type: ignore[arg-type]
        confirmed_by_actor_id=confirmed.confirmed_by_actor_id if confirmed else None,
        link_target=f"/cg/tasks/{task.id}/execution",
        draft_revision_number=draft.revision_number if draft else None,
        draft_source=_draft_source(draft),  # type: ignore[arg-type]
    )


async def _attention_context(
    session: AsyncSession,
    *,
    role: str,
    shot_id: uuid.UUID,
    task_id: uuid.UUID | None,
) -> AnchorAttentionContextRead:
    query = (
        select(IntentSignal)
        .where(IntentSignal.shot_id == shot_id)
        .order_by(IntentSignal.created_at.desc(), IntentSignal.id.desc())
        .limit(1)
    )
    if task_id is not None:
        query = query.where(IntentSignal.task_id == task_id)
    signal = await session.scalar(query)
    level = signal.attention_level if signal is not None else "not_assessed"
    output = signal.signal_output if signal is not None else {}
    return AnchorAttentionContextRead(
        level=level,  # type: ignore[arg-type]
        summary=output.get("summary") if isinstance(output, dict) else None,
        review_requirement=_ATTENTION_REQUIREMENT[role][level],
        source_assessment_id=signal.cross_role_assessment_id if signal else None,
        source_signal_id=signal.id if signal else None,
        assessed_at=signal.created_at if signal else None,
        link_target=f"/vfx/shots/{shot_id}/alignment" if role == "vfx_supervisor" else None,
    )


def _version_context(item: object, target: str) -> AnchorVersionContextRead:
    return AnchorVersionContextRead(
        version_id=getattr(item, "latest_version_id", None)
        or getattr(item, "relevant_version_id", None),
        name=getattr(item, "latest_version_name", None)
        or getattr(item, "relevant_version_name", None),
        version_number=getattr(item, "latest_version_number", None)
        or getattr(item, "relevant_version_number", None),
        link_target=target,
    )


def _focus_action(focus: Any) -> AnchorNextActionRead:
    focus_type = str(focus.focus_type)
    if focus_type == "none":
        return AnchorNextActionRead(
            title="No immediate review action",
            why_now=(
                "No current review, confirmation, dependency, or feedback action is recorded."
            ),
            downstream_effect="New evidence may create a later human action.",
            target_route=str(focus.target_route),
            action_label=None,
            executable=False,
        )
    return AnchorNextActionRead(
        title=str(focus.title),
        why_now=str(focus.explanation),
        downstream_effect=_DOWNSTREAM_EFFECT.get(
            focus_type, "No downstream change is required until new evidence is recorded."
        ),
        target_route=str(focus.target_route),
        action_label=focus.primary_action_label,
        executable=bool(focus.actionable),
    )


async def _build_vfx_anchor_context(
    session: AsyncSession, shot_id: uuid.UUID, item: Any
) -> AnchorContextRead:
    core = await _core_context(session, shot_id)
    attention = await _attention_context(
        session, role="vfx_supervisor", shot_id=shot_id, task_id=None
    )
    action = _focus_action(item.current_focus)
    if core.lifecycle_state == "missing":
        action = AnchorNextActionRead(
            title="Create the Core Anchor",
            why_now="This Shot has no authoritative shared creative direction yet.",
            downstream_effect=(
                "Confirmation will make department technical translation available to CG."
            ),
            target_route=f"/vfx/shots/{shot_id}/intent",
            action_label="Open Intent",
            executable=True,
        )
    return AnchorContextRead(
        role="vfx_supervisor",
        shot_id=shot_id,
        task_id=None,
        core_anchor=core,
        execution_anchor=None,
        attention=attention,
        current_version=_version_context(item, f"/vfx/shots/{shot_id}/versions"),
        guidance_state="unavailable",
        open_vfx_escalation=item.open_cg_escalation_task_id is not None,
        next_action=action,
    )


async def get_vfx_anchor_context(session: AsyncSession, shot_id: uuid.UUID) -> AnchorContextRead:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")
    item = await vfx_inbox_service.get_inbox_item_for_shot(session, shot_id)
    if item is None:
        raise NotFoundError("Shot not found")
    return await _build_vfx_anchor_context(session, shot_id, item)


async def _get_task_context(
    session: AsyncSession, task_id: uuid.UUID, *, role: str, item: Any | None = None
) -> AnchorContextRead:
    task = await session.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    if role == "cg_supervisor":
        item = item or await cg_inbox_service.get_inbox_item_for_task(session, task_id)
        version_route = f"/cg/tasks/{task_id}/version-review"
        guidance_state = "unavailable"
    else:
        item = item or await artist_inbox_service.get_inbox_item_for_task(session, task_id)
        version_route = f"/artist/tasks/{task_id}/current-version"
        guidance_state = (
            ("missing" if item and item.guidance_state == "none" else item.guidance_state)
            if item
            else "unavailable"
        )
    if item is None:
        raise NotFoundError("Task not found")
    core = await _core_context(session, task.shot_id)
    execution = await _execution_context(session, task, core)
    attention = await _attention_context(session, role=role, shot_id=task.shot_id, task_id=task_id)
    open_vfx_escalation = (
        await session.scalar(
            select(TaskDependency.id).where(
                TaskDependency.task_id == task_id,
                TaskDependency.kind == "escalation",
                TaskDependency.escalated_to_role == "vfx_supervisor",
                TaskDependency.status.in_(("open", "acknowledged")),
            )
        )
        is not None
    )
    action = _focus_action(item.current_focus)
    if role == "cg_supervisor" and core.lifecycle_state != "confirmed":
        action = AnchorNextActionRead(
            title="Core Anchor confirmation required",
            why_now=(
                "CG cannot establish an authoritative department translation without "
                "confirmed shared direction."
            ),
            downstream_effect=(
                "The VFX Supervisor must confirm the Core Anchor before Execution Anchor "
                "work can proceed."
            ),
            target_route=None,
            action_label=None,
            executable=False,
        )
    elif role == "cg_supervisor" and execution.lifecycle_state == "missing":
        action = AnchorNextActionRead(
            title="Create the Execution Anchor",
            why_now=(
                "This Task has confirmed shared direction but no department execution translation."
            ),
            downstream_effect="Confirmation will update the Artist working direction.",
            target_route=f"/cg/tasks/{task_id}/execution",
            action_label="Open Execution",
            executable=True,
        )
    elif role == "cg_supervisor" and execution.context_state == "outdated":
        action = AnchorNextActionRead(
            title="Review the outdated Execution Anchor",
            why_now="The confirmed department translation is based on an older Core Anchor.",
            downstream_effect=(
                "A CG-confirmed revision will restore current direction for Artists."
            ),
            target_route=f"/cg/tasks/{task_id}/execution",
            action_label="Review Execution Anchor",
            executable=True,
        )
    elif role == "artist" and core.lifecycle_state != "confirmed":
        action = AnchorNextActionRead(
            title="Core Anchor confirmation is required",
            why_now="The VFX Supervisor has not confirmed shared creative direction.",
            downstream_effect=(
                "CG can translate the direction only after VFX confirms the Core Anchor."
            ),
            target_route=None,
            action_label=None,
            executable=False,
        )
    elif role == "artist" and (
        execution.lifecycle_state != "confirmed" or execution.context_state != "current"
    ):
        action = AnchorNextActionRead(
            title="Request CG clarification",
            why_now=("A current, confirmed Execution Anchor is not available for this Task."),
            downstream_effect=(
                "A CG-confirmed execution translation is required before authoritative "
                "work direction is available."
            ),
            target_route=None,
            action_label=None,
            executable=False,
        )
    elif role == "artist" and guidance_state == "current":
        action = AnchorNextActionRead(
            title="Continue within current Guidance",
            why_now="Confirmed direction and current Guidance are available for this Task.",
            downstream_effect=(
                "The next Version can remain traceable to the confirmed execution direction."
            ),
            target_route=f"/artist/tasks/{task_id}/current-version",
            action_label="Open Current Version",
            executable=True,
        )
    elif role == "artist" and guidance_state == "missing" and item.latest_version_id is None:
        action = AnchorNextActionRead(
            title="Guidance is not ready",
            why_now="A Production Version is required before Artist Guidance can be generated.",
            downstream_effect=(
                "Once a Version exists, the Artist can generate advisory iteration Guidance."
            ),
            target_route=f"/artist/tasks/{task_id}/current-version",
            action_label=None,
            executable=False,
        )
    return AnchorContextRead(
        role=role,  # type: ignore[arg-type]
        shot_id=task.shot_id,
        task_id=task_id,
        core_anchor=core,
        execution_anchor=execution,
        attention=attention,
        current_version=_version_context(item, version_route),
        guidance_state=guidance_state,  # type: ignore[arg-type]
        open_vfx_escalation=open_vfx_escalation,
        next_action=action,
    )


async def get_cg_anchor_context(session: AsyncSession, task_id: uuid.UUID) -> AnchorContextRead:
    return await _get_task_context(session, task_id, role="cg_supervisor")


async def get_artist_anchor_context(session: AsyncSession, task_id: uuid.UUID) -> AnchorContextRead:
    return await _get_task_context(session, task_id, role="artist")


def _summary_readiness(context: AnchorContextRead, item: Any) -> tuple[str, str]:
    if context.role == "vfx_supervisor":
        if context.next_action.executable:
            return "action_required", context.next_action.why_now
        return "no_immediate_action", "No immediate VFX review action is recorded."

    execution = context.execution_anchor
    if context.core_anchor.lifecycle_state != "confirmed":
        return (
            "waiting_upstream",
            "Core Anchor confirmation is required from the VFX Supervisor.",
        )
    if context.role == "cg_supervisor":
        if execution is None or execution.context_state in {
            "missing",
            "draft",
            "pending",
            "outdated",
            "relationship_unavailable",
        }:
            return "action_required", context.next_action.why_now
        if context.next_action.executable or getattr(item, "open_dependency_count", 0) > 0:
            return "action_required", context.next_action.why_now
        return "no_immediate_action", "No immediate CG review action is recorded."

    if getattr(item, "open_dependency_count", 0) > 0:
        return (
            "waiting_upstream",
            "A blocking Dependency requires supervisor resolution before work continues.",
        )
    if execution is None or execution.context_state != "current":
        return (
            "waiting_upstream",
            "Current Execution direction is required from the CG Supervisor.",
        )
    if context.guidance_state == "current" or context.next_action.executable:
        return "ready_to_work", context.next_action.why_now
    if context.guidance_state in {"missing", "outdated"}:
        return "waiting_upstream", context.next_action.why_now
    return "no_immediate_action", "No immediate Artist action is recorded."


def _compact_summary(context: AnchorContextRead, item: Any) -> AnchorContextSummaryRead:
    readiness_state, readiness_detail = _summary_readiness(context, item)
    execution = context.execution_anchor
    return AnchorContextSummaryRead(
        role=context.role,
        shot_id=context.shot_id,
        task_id=context.task_id,
        core_anchor_state=context.core_anchor.lifecycle_state,
        core_anchor_revision_number=context.core_anchor.confirmed_revision_number,
        core_direction=context.core_anchor.direction_summary,
        execution_context_state=execution.context_state if execution else None,
        execution_anchor_revision_number=(
            execution.confirmed_revision_number if execution else None
        ),
        execution_direction=execution.direction_summary if execution else None,
        based_on_core_anchor_revision_number=(
            execution.based_on_core_anchor_revision_number if execution else None
        ),
        attention_level=context.attention.level,
        attention_summary=context.attention.summary,
        guidance_state=context.guidance_state,
        readiness_state=readiness_state,  # type: ignore[arg-type]
        readiness_detail=readiness_detail,
        open_vfx_escalation=context.open_vfx_escalation,
        next_action=context.next_action,
    )


def _matches_scope(summary: AnchorContextSummaryRead, scope: str) -> bool:
    if scope == "all":
        return True
    if scope == "triage":
        return summary.readiness_state in {"action_required", "waiting_upstream"}
    if scope == "ready":
        return summary.readiness_state == "ready_to_work"
    return summary.readiness_state == "waiting_upstream"


async def list_anchor_context_summaries(
    session: AsyncSession,
    *,
    role: Literal["vfx_supervisor", "cg_supervisor", "artist"],
    limit: int,
    scope: Literal["all", "triage", "ready", "waiting"],
) -> AnchorContextSummaryListRead:
    """Return a bounded compact projection in the role Inbox's backend order."""

    if role == "vfx_supervisor":
        source_items = (await vfx_inbox_service.list_inbox_items(session)).items
        summaries = [
            _compact_summary(await _build_vfx_anchor_context(session, item.shot_id, item), item)
            for item in source_items
        ]
    else:
        inbox = (
            await cg_inbox_service.list_inbox_items(session)
            if role == "cg_supervisor"
            else await artist_inbox_service.list_inbox_items(session)
        )
        summaries = [
            _compact_summary(
                await _get_task_context(session, item.task_id, role=role, item=item),
                item,
            )
            for item in inbox.items
        ]

    matching = [summary for summary in summaries if _matches_scope(summary, scope)]
    return AnchorContextSummaryListRead(
        items=matching[:limit], total_count=len(matching), limit=limit
    )
