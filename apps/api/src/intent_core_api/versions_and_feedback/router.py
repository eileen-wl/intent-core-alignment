from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from intent_core_contracts.api.alignment_assessment import (
    AlignmentAssessmentRead,
    AssessmentDecisionRequest,
)
from intent_core_contracts.api.versions_and_feedback import (
    ReviewNoteCreate,
    ReviewNoteRead,
    VersionCreate,
    VersionRead,
)
from intent_core_contracts.api.workflow import DecisionRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import alignment_assessment_service
from intent_core_api.db import get_session
from intent_core_api.versions_and_feedback import service as versions_and_feedback_service
from intent_core_api.versions_and_feedback.models import AlignmentAssessment, ReviewNote, Version
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.actors import ActorContext, get_current_actor
from intent_core_api.workflow.exceptions import NotFoundError
from intent_core_api.workflow.models import Decision

router = APIRouter(tags=["versions_and_feedback"])


@router.post("/versions", response_model=VersionRead, status_code=201)
async def create_version(
    payload: VersionCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> Version:
    return await versions_and_feedback_service.create_version(
        session,
        actor,
        payload.shot_id,
        name=payload.name,
        version_number=payload.version_number,
        description=payload.description,
    )


@router.get("/versions/{version_id}", response_model=VersionRead)
async def get_version(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Version:
    version = await versions_and_feedback_service.get_version(session, version_id)
    if version is None:
        raise NotFoundError("Version not found")
    return version


@router.get("/shots/{shot_id}/versions", response_model=list[VersionRead])
async def list_versions(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[Version]:
    return await versions_and_feedback_service.list_versions_for_shot(session, shot_id)


@router.post("/versions/{version_id}/review-notes", response_model=ReviewNoteRead, status_code=201)
async def create_review_note(
    version_id: uuid.UUID,
    payload: ReviewNoteCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ReviewNote:
    return await versions_and_feedback_service.create_review_note(
        session, actor, version_id, content=payload.content
    )


@router.get("/versions/{version_id}/review-notes", response_model=list[ReviewNoteRead])
async def list_review_notes(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[ReviewNote]:
    return await versions_and_feedback_service.list_review_notes_for_version(session, version_id)


@router.post(
    "/versions/{version_id}/assessments/generate",
    response_model=AlignmentAssessmentRead,
    status_code=201,
)
async def generate_alignment_assessment(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> AlignmentAssessment:
    # No actor headers required, matching the existing B1 Core Agent
    # generate endpoint: the configured provider is used, never a
    # client-controlled one.
    return await alignment_assessment_service.generate_alignment_assessment(session, version_id)


@router.get("/assessments/{assessment_id}", response_model=AlignmentAssessmentRead)
async def get_alignment_assessment(
    assessment_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> AlignmentAssessment:
    assessment = await alignment_assessment_service.get_alignment_assessment(session, assessment_id)
    if assessment is None:
        raise NotFoundError("Alignment assessment not found")
    return assessment


@router.get("/versions/{version_id}/assessments", response_model=list[AlignmentAssessmentRead])
async def list_alignment_assessments(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[AlignmentAssessment]:
    return await alignment_assessment_service.list_alignment_assessments_for_version(
        session, version_id
    )


@router.post("/assessments/{assessment_id}/accept", response_model=DecisionRead, status_code=201)
async def accept_alignment_assessment(
    assessment_id: uuid.UUID,
    payload: AssessmentDecisionRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> Decision:
    return await versions_and_feedback_service.decide_alignment_assessment(
        session,
        actor,
        assessment_id,
        decision_type=versions_and_feedback_service.DECISION_TYPE_ACCEPT_ALIGNMENT_ASSESSMENT,
        rationale=payload.rationale,
    )


@router.post("/assessments/{assessment_id}/reject", response_model=DecisionRead, status_code=201)
async def reject_alignment_assessment(
    assessment_id: uuid.UUID,
    payload: AssessmentDecisionRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> Decision:
    return await versions_and_feedback_service.decide_alignment_assessment(
        session,
        actor,
        assessment_id,
        decision_type=versions_and_feedback_service.DECISION_TYPE_REJECT_ALIGNMENT_ASSESSMENT,
        rationale=payload.rationale,
    )


@router.get("/assessments/{assessment_id}/decisions", response_model=list[DecisionRead])
async def list_alignment_assessment_decisions(
    assessment_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[Decision]:
    return await decision_service.list_decisions_for_entity(
        session, "alignment_assessment", assessment_id
    )
