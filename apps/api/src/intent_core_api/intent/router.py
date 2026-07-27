from __future__ import annotations

import uuid

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import APIRouter, Depends, HTTPException
from intent_core_contracts.api.agent_runs import AgentRunRead, ContextSnapshotRead
from intent_core_contracts.api.artist_agent_guidance import (
    ArtistAgentGuidanceRead,
    ArtistGuidanceGenerateRequest,
)
from intent_core_contracts.api.cg_supervisor_review import CGSupervisorReviewRead
from intent_core_contracts.api.context_reconstruction import ContextReconstructionRead
from intent_core_contracts.api.execution_anchor import (
    ExecutionAnchorRead,
    ExecutionAnchorRevisionDraftCreate,
    ExecutionAnchorRevisionRead,
    ExecutionAnchorRevisionUpdate,
)
from intent_core_contracts.api.intent import (
    AnchorConfirmRequest,
    AnchorRejectRequest,
    CoreAnchorRead,
    CoreAnchorRevisionDraftCreate,
    CoreAnchorRevisionRead,
    CoreAnchorRevisionUpdate,
    HumanGateRead,
    IntentBriefCreate,
    IntentBriefRead,
)
from intent_core_contracts.api.intent_decomposition import (
    CoreAnchorDraftFromDecompositionRequest,
    IntentDecompositionRead,
)
from intent_core_contracts.api.vfx_supervisor_review import VFXSupervisorReviewRead
from intent_core_contracts.api.workflow import DecisionRead
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import (
    artist_guidance_service,
    cg_supervisor_review_service,
    context_reconstruction_service,
    core_agent_service,
    intent_decomposition_service,
    vfx_supervisor_review_service,
)
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.config import get_settings
from intent_core_api.db import get_session
from intent_core_api.integrations import writeback_service
from intent_core_api.intent import (
    brief_service,
    core_anchor_service,
    execution_anchor_service,
    human_gate_service,
)
from intent_core_api.intent.models import (
    CGSupervisorReview,
    ContextReconstruction,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
    IntentBrief,
    IntentDecomposition,
)
from intent_core_api.versions_and_feedback.models import ArtistAgentGuidance, VFXSupervisorReview
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.actors import ActorContext, get_current_actor
from intent_core_api.workflow.exceptions import NotFoundError
from intent_core_api.workflow.models import Decision

router = APIRouter(prefix="/intent", tags=["intent"])


@router.post("/briefs", response_model=IntentBriefRead, status_code=201)
async def create_brief(
    payload: IntentBriefCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> IntentBrief:
    return await brief_service.create_brief(session, actor, payload.shot_id, payload.raw_text)


@router.get("/briefs/{brief_id}", response_model=IntentBriefRead)
async def get_brief(
    brief_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> IntentBrief:
    brief = await brief_service.get_brief(session, brief_id)
    if brief is None:
        raise NotFoundError("Intent brief not found")
    return brief


@router.get("/shots/{shot_id}/briefs", response_model=list[IntentBriefRead])
async def list_briefs(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[IntentBrief]:
    return await brief_service.list_briefs_for_shot(session, shot_id)


@router.post(
    "/shots/{shot_id}/intent-decompositions/generate",
    response_model=IntentDecompositionRead,
    status_code=201,
)
async def generate_intent_decomposition(
    shot_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> IntentDecomposition:
    return await intent_decomposition_service.generate_intent_decomposition(session, actor, shot_id)


@router.get("/intent-decompositions/{decomposition_id}", response_model=IntentDecompositionRead)
async def get_intent_decomposition(
    decomposition_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> IntentDecomposition:
    decomposition = await intent_decomposition_service.get_intent_decomposition(
        session, decomposition_id
    )
    if decomposition is None:
        raise NotFoundError("Intent decomposition not found")
    return decomposition


@router.get("/shots/{shot_id}/intent-decompositions", response_model=list[IntentDecompositionRead])
async def list_intent_decompositions(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[IntentDecomposition]:
    return await intent_decomposition_service.list_intent_decompositions_for_shot(session, shot_id)


@router.post(
    "/intent-decompositions/{decomposition_id}/core-anchor-draft",
    response_model=CoreAnchorRevisionRead,
    status_code=201,
)
async def create_core_anchor_draft_from_decomposition(
    decomposition_id: uuid.UUID,
    payload: CoreAnchorDraftFromDecompositionRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    del payload  # deliberately empty today -- see contract docstring
    return await core_agent_service.create_core_anchor_draft_from_decomposition(
        session, actor, decomposition_id
    )


@router.post(
    "/shots/{shot_id}/context-reconstructions/generate",
    response_model=ContextReconstructionRead,
    status_code=201,
)
async def generate_context_reconstruction(
    shot_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ContextReconstruction:
    return await context_reconstruction_service.generate_context_reconstruction(
        session, actor, shot_id
    )


@router.get(
    "/context-reconstructions/{reconstruction_id}", response_model=ContextReconstructionRead
)
async def get_context_reconstruction(
    reconstruction_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ContextReconstruction:
    reconstruction = await context_reconstruction_service.get_context_reconstruction(
        session, reconstruction_id
    )
    if reconstruction is None:
        raise NotFoundError("Context reconstruction not found")
    return reconstruction


@router.get(
    "/shots/{shot_id}/context-reconstructions", response_model=list[ContextReconstructionRead]
)
async def list_context_reconstructions(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[ContextReconstruction]:
    return await context_reconstruction_service.list_context_reconstructions_for_shot(
        session, shot_id
    )


@router.post(
    "/shots/{shot_id}/core-anchor/drafts", response_model=CoreAnchorRevisionRead, status_code=201
)
async def create_core_anchor_draft(
    shot_id: uuid.UUID,
    payload: CoreAnchorRevisionDraftCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    return await core_anchor_service.create_draft_revision(
        session, actor, shot_id, payload.model_dump()
    )


@router.post(
    "/shots/{shot_id}/core-anchor/generate", response_model=CoreAnchorRevisionRead, status_code=201
)
async def generate_core_anchor_draft(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CoreAnchorRevision:
    return await core_agent_service.generate_core_anchor_draft(session, shot_id)


@router.get("/context-snapshots/{snapshot_id}", response_model=ContextSnapshotRead)
async def get_context_snapshot(
    snapshot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ContextSnapshot:
    snapshot = await core_agent_service.get_context_snapshot(session, snapshot_id)
    if snapshot is None:
        raise NotFoundError("Context snapshot not found")
    return snapshot


@router.get("/agent-runs/{agent_run_id}", response_model=AgentRunRead)
async def get_agent_run(
    agent_run_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> AgentRun:
    run = await core_agent_service.get_agent_run(session, agent_run_id)
    if run is None:
        raise NotFoundError("Agent run not found")
    return run


@router.get("/shots/{shot_id}/core-anchor", response_model=CoreAnchorRead)
async def get_core_anchor(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CoreAnchor:
    anchor = await core_anchor_service.get_core_anchor_for_shot(session, shot_id)
    if anchor is None:
        raise NotFoundError("Core anchor not found for shot")
    return anchor


@router.get("/shots/{shot_id}/core-anchor/revisions", response_model=list[CoreAnchorRevisionRead])
async def list_core_anchor_revisions(
    shot_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[CoreAnchorRevision]:
    return await core_anchor_service.list_revisions_for_shot(session, shot_id)


@router.get("/core-anchor-revisions/{revision_id}", response_model=CoreAnchorRevisionRead)
async def get_core_anchor_revision(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CoreAnchorRevision:
    revision = await core_anchor_service.get_revision(session, revision_id)
    if revision is None:
        raise NotFoundError("Core anchor revision not found")
    return revision


@router.get("/core-anchor-revisions/{revision_id}/decisions", response_model=list[DecisionRead])
async def list_core_anchor_revision_decisions(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[Decision]:
    return await decision_service.list_decisions_for_entity(
        session, "core_anchor_revision", revision_id
    )


@router.get("/core-anchor-revisions/{revision_id}/human-gate", response_model=HumanGateRead)
async def get_core_anchor_revision_human_gate(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> HumanGate:
    # 404 (not an empty/null response) when a historical, pre-Step-1D
    # revision has no persisted gate -- the caller (UI) distinguishes
    # this from a real error and shows a legacy-compatibility message.
    gate = await human_gate_service.get_gate_for_revision(session, revision_id)
    if gate is None:
        raise NotFoundError("No persisted human gate exists for this revision")
    return gate


@router.patch("/core-anchor-revisions/{revision_id}", response_model=CoreAnchorRevisionRead)
async def update_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: CoreAnchorRevisionUpdate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    changes = payload.model_dump(exclude_unset=True)
    return await core_anchor_service.update_draft_revision(session, actor, revision_id, changes)


@router.post("/core-anchor-revisions/{revision_id}/confirm", response_model=CoreAnchorRevisionRead)
async def confirm_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorConfirmRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    revision = await core_anchor_service.confirm_revision(
        session,
        actor,
        revision_id,
        payload.rationale,
        request_write_back=payload.request_write_back,
    )

    if payload.request_write_back:
        record = await writeback_service.request_core_anchor_writeback(
            session, actor, revision, rationale=payload.rationale
        )
        settings = get_settings()
        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        try:
            job = await redis.enqueue_job("write_back_core_anchor_confirmation", str(record.id))
        finally:
            await redis.close()
        if job is None:
            raise HTTPException(status_code=503, detail="Could not enqueue write-back job")

    return revision


@router.post("/core-anchor-revisions/{revision_id}/reject", response_model=CoreAnchorRevisionRead)
async def reject_core_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorRejectRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CoreAnchorRevision:
    return await core_anchor_service.reject_revision(session, actor, revision_id, payload.rationale)


@router.post(
    "/tasks/{task_id}/execution-anchor/drafts",
    response_model=ExecutionAnchorRevisionRead,
    status_code=201,
)
async def create_execution_anchor_draft(
    task_id: uuid.UUID,
    payload: ExecutionAnchorRevisionDraftCreate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ExecutionAnchorRevision:
    return await execution_anchor_service.create_draft_revision(
        session, actor, task_id, payload.model_dump()
    )


@router.get("/tasks/{task_id}/execution-anchor", response_model=ExecutionAnchorRead)
async def get_execution_anchor(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ExecutionAnchor:
    anchor = await execution_anchor_service.get_execution_anchor_for_task(session, task_id)
    if anchor is None:
        raise NotFoundError("Execution anchor not found for task")
    return anchor


@router.get("/execution-anchor-revisions/{revision_id}", response_model=ExecutionAnchorRevisionRead)
async def get_execution_anchor_revision(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ExecutionAnchorRevision:
    revision = await execution_anchor_service.get_execution_revision(session, revision_id)
    if revision is None:
        raise NotFoundError("Execution anchor revision not found")
    return revision


@router.get(
    "/tasks/{task_id}/execution-anchor/revisions", response_model=list[ExecutionAnchorRevisionRead]
)
async def list_execution_anchor_revisions(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[ExecutionAnchorRevision]:
    return await execution_anchor_service.list_revisions_for_task(session, task_id)


@router.get("/execution-anchor-revisions/{revision_id}/human-gate", response_model=HumanGateRead)
async def get_execution_anchor_revision_human_gate(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> HumanGate:
    # Same legacy-compatibility contract as the Core Anchor equivalent
    # above: 404 (not an empty/null response) when no gate has been
    # persisted for this revision.
    gate = await human_gate_service.get_gate_for_execution_anchor_revision(session, revision_id)
    if gate is None:
        raise NotFoundError("No persisted human gate exists for this revision")
    return gate


@router.patch(
    "/execution-anchor-revisions/{revision_id}", response_model=ExecutionAnchorRevisionRead
)
async def update_execution_anchor_revision(
    revision_id: uuid.UUID,
    payload: ExecutionAnchorRevisionUpdate,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ExecutionAnchorRevision:
    changes = payload.model_dump(exclude_unset=True)
    return await execution_anchor_service.update_draft_revision(
        session, actor, revision_id, changes
    )


@router.post(
    "/execution-anchor-revisions/{revision_id}/confirm", response_model=ExecutionAnchorRevisionRead
)
async def confirm_execution_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorConfirmRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ExecutionAnchorRevision:
    return await execution_anchor_service.confirm_revision(
        session, actor, revision_id, payload.rationale
    )


@router.post(
    "/execution-anchor-revisions/{revision_id}/reject", response_model=ExecutionAnchorRevisionRead
)
async def reject_execution_anchor_revision(
    revision_id: uuid.UUID,
    payload: AnchorRejectRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ExecutionAnchorRevision:
    return await execution_anchor_service.reject_revision(
        session, actor, revision_id, payload.rationale
    )


# Step 3: VFX Supervisor Agent -- the first independent Role Agent. Its
# review is purely advisory evidence for a Human VFX Supervisor; it
# never confirms/rejects/passes/fails/approves/publishes the Version and
# never resolves a HumanGate or creates an authoritative Decision (see
# agents.vfx_supervisor_review_service's module docstring).


@router.post(
    "/versions/{version_id}/vfx-supervisor-reviews/generate",
    response_model=VFXSupervisorReviewRead,
    status_code=201,
)
async def generate_vfx_supervisor_review(
    version_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> VFXSupervisorReview:
    return await vfx_supervisor_review_service.generate_vfx_supervisor_review(
        session, actor, version_id
    )


@router.get("/vfx-supervisor-reviews/{review_id}", response_model=VFXSupervisorReviewRead)
async def get_vfx_supervisor_review(
    review_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> VFXSupervisorReview:
    review = await vfx_supervisor_review_service.get_vfx_supervisor_review(session, review_id)
    if review is None:
        raise NotFoundError("VFX Supervisor review not found")
    return review


@router.get(
    "/versions/{version_id}/vfx-supervisor-reviews", response_model=list[VFXSupervisorReviewRead]
)
async def list_vfx_supervisor_reviews(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[VFXSupervisorReview]:
    return await vfx_supervisor_review_service.list_vfx_supervisor_reviews_for_version(
        session, version_id
    )


# Step 4: CG Supervisor Agent -- the second independent Role Agent. Its
# review is purely advisory execution guidance for a Human CG Supervisor;
# it never confirms/rejects the Execution Anchor and never resolves a
# HumanGate or creates an authoritative Decision (see
# agents.cg_supervisor_review_service's module docstring).


@router.post(
    "/execution-anchor-revisions/{revision_id}/cg-supervisor-reviews/generate",
    response_model=CGSupervisorReviewRead,
    status_code=201,
)
async def generate_cg_supervisor_review(
    revision_id: uuid.UUID,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> CGSupervisorReview:
    return await cg_supervisor_review_service.generate_cg_supervisor_review(
        session, actor, revision_id
    )


@router.get("/cg-supervisor-reviews/{review_id}", response_model=CGSupervisorReviewRead)
async def get_cg_supervisor_review(
    review_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> CGSupervisorReview:
    review = await cg_supervisor_review_service.get_cg_supervisor_review(session, review_id)
    if review is None:
        raise NotFoundError("CG Supervisor review not found")
    return review


@router.get(
    "/execution-anchor-revisions/{revision_id}/cg-supervisor-reviews",
    response_model=list[CGSupervisorReviewRead],
)
async def list_cg_supervisor_reviews(
    revision_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[CGSupervisorReview]:
    svc = cg_supervisor_review_service
    return await svc.list_cg_supervisor_reviews_for_execution_anchor_revision(session, revision_id)


# Step 5: Artist Agent -- the third independent Role Agent. Its guidance
# is purely advisory, Artist-facing iteration guidance for a Human
# Artist; it never establishes/modifies/confirms/rejects an Anchor,
# never resolves a HumanGate, and never creates an authoritative
# Decision or ReviewNote (see agents.artist_guidance_service's module
# docstring).


@router.post(
    "/versions/{version_id}/artist-guidances/generate",
    response_model=ArtistAgentGuidanceRead,
    status_code=201,
)
async def generate_artist_agent_guidance(
    version_id: uuid.UUID,
    payload: ArtistGuidanceGenerateRequest,
    actor: ActorContext = Depends(get_current_actor),
    session: AsyncSession = Depends(get_session),
) -> ArtistAgentGuidance:
    return await artist_guidance_service.generate_artist_agent_guidance(
        session, actor, version_id, payload.task_id
    )


@router.get("/artist-guidances/{guidance_id}", response_model=ArtistAgentGuidanceRead)
async def get_artist_agent_guidance(
    guidance_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ArtistAgentGuidance:
    guidance = await artist_guidance_service.get_artist_agent_guidance(session, guidance_id)
    if guidance is None:
        raise NotFoundError("Artist Agent guidance not found")
    return guidance


@router.get("/versions/{version_id}/artist-guidances", response_model=list[ArtistAgentGuidanceRead])
async def list_artist_agent_guidances(
    version_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[ArtistAgentGuidance]:
    return await artist_guidance_service.list_artist_agent_guidances_for_version(
        session, version_id
    )
