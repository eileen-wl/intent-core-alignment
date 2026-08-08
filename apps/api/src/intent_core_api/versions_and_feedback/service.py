from __future__ import annotations

import uuid
from typing import Final

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.audit import service as audit_service
from intent_core_api.production_context.models import Shot, Task
from intent_core_api.versions_and_feedback.models import AlignmentAssessment, ReviewNote, Version
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.actors import (
    ActorContext,
    HumanRole,
    require_can_confirm_or_reject,
    require_human_role,
)
from intent_core_api.workflow.exceptions import (
    ConflictError,
    InternalConsistencyError,
    NotFoundError,
    ValidationError,
)
from intent_core_api.workflow.models import Decision

# Unlike IntentBrief (VFX-Supervisor-only) or Core Anchor confirm/reject
# (VFX-Supervisor-only), submitting a Version or adding a Review Note is
# not restricted to one role (docs/ROLE_PERMISSIONS.md: "Submit a
# Version" and "Add original Review Note" both list all three human
# roles) -- any human actor qualifies, no human role is rejected here.
_MANUAL_CREATE_ROLES: frozenset[HumanRole] = frozenset(
    {"vfx_supervisor", "cg_supervisor", "artist"}
)


async def create_version(
    session: AsyncSession,
    actor: ActorContext,
    shot_id: uuid.UUID,
    *,
    name: str,
    version_number: int | None,
    description: str,
    task_id: uuid.UUID | None = None,
) -> Version:
    # Authoritative check: enforced here regardless of what the router
    # does, matching intent.brief_service's own precedent. Also the only
    # thing standing between an agent/system actor and this route --
    # require_human_role rejects any non-"human" actor_kind outright.
    require_human_role(actor, _MANUAL_CREATE_ROLES)

    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    if task_id is not None:
        task = await session.get(Task, task_id)
        if task is None:
            raise NotFoundError("Task not found")
        if task.shot_id != shot_id:
            raise ValidationError("task_id does not belong to the given shot_id")

    version = Version(
        shot_id=shot_id,
        task_id=task_id,
        name=name,
        version_number=version_number,
        description=description,
        source="manual",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(version)
    await session.commit()
    await session.refresh(version)
    return version


async def get_version(session: AsyncSession, version_id: uuid.UUID) -> Version | None:
    return await session.get(Version, version_id)


async def list_versions_for_shot(session: AsyncSession, shot_id: uuid.UUID) -> list[Version]:
    result = await session.execute(
        select(Version).where(Version.shot_id == shot_id).order_by(Version.created_at)
    )
    return list(result.scalars().all())


async def create_review_note(
    session: AsyncSession, actor: ActorContext, version_id: uuid.UUID, *, content: str
) -> ReviewNote:
    require_human_role(actor, _MANUAL_CREATE_ROLES)

    version = await session.get(Version, version_id)
    if version is None:
        raise NotFoundError("Version not found")

    note = ReviewNote(
        version_id=version_id,
        content=content,
        source="manual",
        created_by_actor_kind=actor.actor_kind,
        created_by_actor_id=actor.actor_id,
        created_by_human_role=actor.human_role,
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def list_review_notes_for_version(
    session: AsyncSession, version_id: uuid.UUID
) -> list[ReviewNote]:
    result = await session.execute(
        select(ReviewNote)
        .where(ReviewNote.version_id == version_id)
        .order_by(ReviewNote.created_at)
    )
    return list(result.scalars().all())


# Step 4c: human accept/reject of an AlignmentAssessment, expressed as a
# Decision -- AlignmentAssessment itself gains no status column (its
# human-review state is derived from Decision rows), and only a VFX
# Supervisor may create one.
_ENTITY_TYPE_ALIGNMENT_ASSESSMENT = "alignment_assessment"
_ASSESSMENT_OWNING_ROLE: Final[HumanRole] = "vfx_supervisor"
DECISION_TYPE_ACCEPT_ALIGNMENT_ASSESSMENT = "accept_alignment_assessment"
DECISION_TYPE_REJECT_ALIGNMENT_ASSESSMENT = "reject_alignment_assessment"


async def _find_active_prior_decision_for_shot(
    session: AsyncSession, shot_id: uuid.UUID
) -> Decision | None:
    """The current, unsuperseded head of the alignment_assessment Decision
    chain for a Shot, if any: the most recent Decision targeting an
    AlignmentAssessment that belongs to this Shot (via
    AlignmentAssessment.version_id -> Version.shot_id), that no other
    Decision has already superseded. Accept and reject participate in the
    same chain -- supersession tracks "latest judgment for this Shot", not
    "latest judgment of one particular type".
    """
    superseded_ids = select(Decision.supersedes_decision_id).where(
        Decision.supersedes_decision_id.is_not(None)
    )
    result = await session.execute(
        select(Decision)
        .join(AlignmentAssessment, Decision.entity_id == AlignmentAssessment.id)
        .join(Version, AlignmentAssessment.version_id == Version.id)
        .where(
            Decision.entity_type == _ENTITY_TYPE_ALIGNMENT_ASSESSMENT,
            Version.shot_id == shot_id,
            Decision.id.not_in(superseded_ids),
        )
        .order_by(Decision.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def decide_alignment_assessment(
    session: AsyncSession,
    actor: ActorContext,
    assessment_id: uuid.UUID,
    *,
    decision_type: str,
    rationale: str | None = None,
) -> Decision:
    """Record a VFX Supervisor's accept/reject of an AlignmentAssessment.

    Never mutates the AlignmentAssessment (no status column exists to
    mutate). An Assessment may receive only one direct Decision; a later
    judgment must be expressed by generating and deciding a newer
    Assessment instead. When a prior, still-active Decision exists for the
    same Shot, the new Decision supersedes it (natural chain, independent
    of accept/reject type).
    """
    require_can_confirm_or_reject(actor, _ASSESSMENT_OWNING_ROLE)

    assessment = await session.get(AlignmentAssessment, assessment_id)
    if assessment is None:
        raise NotFoundError("Alignment assessment not found")

    version = await session.get(Version, assessment.version_id)
    if version is None:
        raise InternalConsistencyError(
            f"AlignmentAssessment {assessment_id} references missing Version "
            f"{assessment.version_id}"
        )

    existing_decisions = await decision_service.list_decisions_for_entity(
        session, _ENTITY_TYPE_ALIGNMENT_ASSESSMENT, assessment_id
    )
    if existing_decisions:
        raise ConflictError(
            "This alignment assessment has already been decided; generate a new "
            "assessment to record a later judgment"
        )

    prior_decision = await _find_active_prior_decision_for_shot(session, version.shot_id)

    try:
        decision = await decision_service.record_decision(
            session,
            decision_type=decision_type,
            owning_human_role=_ASSESSMENT_OWNING_ROLE,
            actor=actor,
            entity_type=_ENTITY_TYPE_ALIGNMENT_ASSESSMENT,
            entity_id=assessment_id,
            rationale=rationale,
            supersedes_decision_id=(prior_decision.id if prior_decision is not None else None),
        )
        action = (
            "alignment_assessment.accepted"
            if decision_type == DECISION_TYPE_ACCEPT_ALIGNMENT_ASSESSMENT
            else "alignment_assessment.rejected"
        )
        await audit_service.record_audit_event(
            session,
            entity_type=_ENTITY_TYPE_ALIGNMENT_ASSESSMENT,
            entity_id=assessment_id,
            action=action,
            actor=actor,
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Concurrent decision conflict") from None
    except Exception:
        await session.rollback()
        raise
    await session.refresh(decision)
    return decision
