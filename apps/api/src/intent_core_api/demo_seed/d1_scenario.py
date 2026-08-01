"""Complete, idempotent D1 Demo scenario seed (Step 7C-1).

docs/step-7/16_STEP_7C0D_...md §2-§3.4 locks the full design this module
implements: real persisted rows created through the *same* domain
services normal product flows use (never raw/faked output rows), a
stable seed-owned identity that cannot collide with a manually-created
production record, and per-record-type resolve-or-create rules so a
repeated run reuses the existing baseline rather than appending a second
one.

Identity (docs/step-7/16_STEP_7C0D_...md §2.3, approved by §6):
Project/Shot/Task are found via a `source="demo"` ExternalEntityLink
with a compound deterministic `external_id` -- never by name alone.
Version has no ExternalEntityLink support, so it is found by a stable
`description` marker prefix, scoped to the already-resolved seeded Shot.

Lifecycle ordering (docs/step-7/16_STEP_7C0D_...md §3.2), and *why* this
exact order: T0 production context, T1-T2 a real human-authored,
human-confirmed baseline Core Anchor (no Agent involved -- confirmation
is human-exclusive by domain rule), T3 a confirmed Execution Anchor
(requires the confirmed Core Anchor from T1-T2), T4 the three Role Agent
outputs generated **in the order VFX -> CG -> Artist** (not arbitrary:
`DeterministicCGSupervisorReviewGenerator` populates `coordination_concerns`
whenever a VFX review already exists in the snapshot, which is exactly
what makes T5's Assessment deterministically reach `medium` attention --
verified by reading the real generator, not assumed; see
`_verify_seeded_signal_is_medium_or_high` below), T5 the CrossRoleAssessment
itself (with its required IntentSignal persisted atomically).

Every generation call explicitly injects the real `Deterministic*Generator`
for its capability -- never a process-wide `MODEL_PROVIDER` environment
mutation at request time, and never a live network call, so the stable
baseline never depends on a model provider being configured.

Re-anchor Proposal (Step 7C-1 targeted correction): the shared,
general-purpose `DeterministicCrossRoleAssessmentGenerator` is
documented, by its own module docstring, to "deliberately keep every
finding at low/medium priority and never propose a re-anchor" --
that generator is intentionally left unmodified (its "high"-attention
and re-anchor-proposal code paths remain exercised only by dedicated
unit-test fixtures, not by this seed). To honestly demonstrate the
locked D1 walkthrough step "inspect Re-anchor Proposal", this module
instead injects `DeterministicD1CrossRoleAssessmentGenerator` (defined
below) -- a D1-Demo-only generator, never used by any production
request path, that delegates every field to the real
`DeterministicCrossRoleAssessmentGenerator` and only adds a
`re_anchor_proposal` grounded in the same snapshot evidence ids that
generator already cites. The result still passes through
`generate_cross_role_assessment`'s real, unbypassed validation and
persistence path (`_validate_re_anchor_proposal`,
`_validate_evidence_resolves_to_snapshot`, `_validate_content_boundaries`)
-- no ORM row is fabricated and no check is special-cased for Demo
content. Because `derive_intent_signal` treats any non-null
`re_anchor_proposal` as a "high"-attention driver, the seeded baseline's
Intent Signal now reaches `high` (not `medium`) -- expected and correct;
the locked Current-focus precedence (`vfx_inbox/current_focus.py`) keeps
`alignment_not_followed_by_anchor_action` as the starting Current focus
regardless, since that focus type accepts both `medium` and `high`
signal levels while `re_anchor_proposal_present` requires `low`.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Final

from intent_core_contracts.api.cross_role_assessment import (
    CrossRoleAssessmentOutput,
    CrossRoleEvidenceReference,
    ReAnchorFieldProposal,
    ReAnchorProposalOutput,
)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import cg_supervisor_review_service, vfx_supervisor_review_service
from intent_core_api.agents.artist_guidance_service import (
    DeterministicArtistGuidanceGenerator,
    generate_artist_agent_guidance,
)
from intent_core_api.agents.cg_supervisor_review_service import (
    DeterministicCGSupervisorReviewGenerator,
)
from intent_core_api.agents.cross_role_assessment_service import (
    DeterministicCrossRoleAssessmentGenerator,
    generate_cross_role_assessment,
)
from intent_core_api.agents.vfx_supervisor_review_service import (
    DeterministicVFXSupervisorReviewGenerator,
)
from intent_core_api.cross_department import service as cross_department_service
from intent_core_api.cross_department.models import TaskDependency
from intent_core_api.integrations.external_link_service import (
    find_linked_entity_id,
    record_external_link,
)
from intent_core_api.intent import brief_service, core_anchor_service, execution_anchor_service
from intent_core_api.intent.models import (
    CGSupervisorReview,
    CoreAnchor,
    CoreAnchorRevision,
    ExecutionAnchor,
    ExecutionAnchorRevision,
    HumanGate,
    IntentBrief,
)
from intent_core_api.production_context.models import Project, Shot, Task
from intent_core_api.versions_and_feedback import service as versions_service
from intent_core_api.versions_and_feedback.models import (
    ArtistAgentGuidance,
    CrossRoleAssessment,
    ReviewNote,
    Version,
    VFXSupervisorReview,
)
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import InternalConsistencyError
from intent_core_api.workflow.models import Decision

_DEMO_SOURCE: Final = "demo"
D1_PROJECT_EXTERNAL_ID: Final = "icas-demo:d1"
D1_SHOT_EXTERNAL_ID: Final = "icas-demo:d1:shot-010"
D1_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:compositing-review"
# Stable, parseable marker (docs/step-7/16_STEP_7C0D_...md §2.3) --
# Version has no ExternalEntityLink support, so this prefix on the free-
# text `description`/`raw_text`/`content` field is the seed-owned key,
# always scoped additionally by the already-resolved seeded Shot/Version.
D1_MARKER: Final = "[ICAS Demo — D1]"

_D1_PROJECT_NAME: Final = "D1 Demo Project"
_D1_SHOT_NAME: Final = "Shot 010 — Final confrontation"
_D1_TASK_NAME: Final = "Compositing Review"
_D1_VERSION_NAME: Final = "D1_STEP3_VFX_REVIEW_001"

# Step 7C-1: a second, deterministic Shot under the same seed-owned
# Project, with its own fixed `ExternalEntityLink(source="demo")`
# identity -- never the same row as the fully-seeded
# `D1_SHOT_EXTERNAL_ID` Shot above. Its whole purpose is to be a
# normal, neutrally-named Shot that starts the Core Anchor lifecycle at
# INITIAL EMPTY (see `_ensure_uninitialized_shot` below), so every
# downstream anchor/gate/decision/review helper this module already has
# for the rich scenario is deliberately never called for it. Not
# Guided-specific, not excluded from any product listing -- it is
# reachable exactly like any other seeded Shot.
UNINITIALIZED_SHOT_EXTERNAL_ID: Final = "icas-demo:uninitialized:shot-020"
UNINITIALIZED_TASK_EXTERNAL_ID: Final = "icas-demo:uninitialized:shot-020:compositing-review"

_UNINITIALIZED_SHOT_NAME: Final = "Shot 020 — Awaiting creative intent"
_UNINITIALIZED_TASK_NAME: Final = "Compositing Review"
_UNINITIALIZED_VERSION_NAME: Final = "DEV_SEED_UNINIT_001"
_UNINITIALIZED_VERSION_DESCRIPTION: Final = (
    f"{D1_MARKER} Compositing pass awaiting a first Core Anchor draft -- generic development "
    "seed data, deliberately left unconfirmed."
)

# Step 7C-4: a second Task under the same rich D1 Shot -- its confirmed
# Core Anchor already exists, but this Task's Execution Anchor is
# deliberately left at DRAFT (a real pending HumanGate), so the CG
# Review Inbox has at least one genuinely actionable work item out of
# the box, and its Dependencies page has one real open dependency to
# show. Never the same row as `D1_TASK_EXTERNAL_ID`'s fully-confirmed
# Task -- distinct external identity, distinct department.
CG_DEMO_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:lighting-pass"
_CG_DEMO_TASK_NAME: Final = "Lighting Pass"
_CG_DEMO_EXECUTION_DRAFT_CONTENT: Final[dict[str, object]] = {
    "technical_boundaries": (
        f"{D1_MARKER} Lighting pass must preserve the restrained dusk key/fill ratio already "
        "established in the confirmed Core Anchor."
    ),
    "parameter_ranges": "Key-to-fill ratio: within 10% of the confirmed baseline.",
    "delivery_conditions": "Deliver at confirmed project resolution, dusk colour temperature.",
    "production_ready_criteria": (
        "Lighting reads as restrained and internal, matching the confirmed Core Anchor's "
        "emotional tone."
    ),
    "downstream_dependencies": "Final composite depends on this lighting pass locking first.",
    "publish_requirements": "Requires CG Supervisor review before publish.",
    "allowed_refinements": "Minor intensity trims within the stated ratio range.",
    "escalation_conditions": "Escalate to VFX Supervisor if the dusk tone reads as too bright.",
}
_CG_DEMO_DEPENDENCY_TEXT: Final = (
    f"{D1_MARKER} Lighting pass is blocked on the Compositing Review Task's final contrast "
    "grade being locked -- key/fill ratio cannot be finalised until that range is confirmed."
)

_D1_BRIEF_TEXT: Final = (
    f"{D1_MARKER} A restrained dusk confrontation should remain internal and controlled. "
    "Camera timing and compositing contrast have begun to drift across role interpretations."
)
_D1_VERSION_DESCRIPTION: Final = (
    f"{D1_MARKER} Compositing pass reviewing camera timing and contrast in the restrained "
    "dusk confrontation."
)
_D1_REVIEW_NOTE_TEXT: Final = (
    f"{D1_MARKER} Contrast reads slightly hotter than the confirmed intent in the back half "
    "of the confrontation; confirm timing against the Core Anchor before the next pass."
)
_D1_CONFIRM_RATIONALE: Final = (
    f"{D1_MARKER} Initial seeded baseline for the D1 demo scenario."
)

_SEED_ACTOR_ID: Final = "demo-seed"
_SEED_ACTOR_VFX = ActorContext(
    actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="vfx_supervisor"
)
_SEED_ACTOR_CG = ActorContext(
    actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="cg_supervisor"
)
_SEED_ACTOR_ARTIST = ActorContext(
    actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="artist"
)


@dataclass(frozen=True)
class D1ScenarioResult:
    project_id: uuid.UUID
    shot_id: uuid.UUID
    task_id: uuid.UUID
    version_id: uuid.UUID
    core_anchor_revision_id: uuid.UUID
    execution_anchor_revision_id: uuid.UUID
    cross_role_assessment_id: uuid.UUID
    # Step 7C-1: id of the separate, normal, deliberately-unconfirmed
    # Shot folded into this same generic development seed process --
    # see `_ensure_uninitialized_shot`.
    uninitialized_shot_id: uuid.UUID
    # Step 7C-4: id of the second Task under the rich D1 Shot with a
    # deliberately draft (not confirmed) Execution Anchor, and the real
    # open TaskDependency recorded against it -- see
    # `_ensure_cg_demo_task`.
    cg_demo_task_id: uuid.UUID
    cg_demo_dependency_id: uuid.UUID


async def _resolve_or_create_project(session: AsyncSession) -> Project:
    existing_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if existing_id is not None:
        project = await session.get(Project, existing_id)
        if project is None:
            raise InternalConsistencyError(
                f"D1 seed: demo ExternalEntityLink points at a missing Project {existing_id}"
            )
        return project

    project = Project(name=_D1_PROJECT_NAME, source="manual")
    session.add(project)
    await session.flush()
    await record_external_link(
        session,
        entity_type="project",
        entity_id=project.id,
        source=_DEMO_SOURCE,
        external_id=D1_PROJECT_EXTERNAL_ID,
    )
    await session.commit()
    await session.refresh(project)
    return project


async def _resolve_or_create_shot(
    session: AsyncSession,
    project: Project,
    *,
    external_id: str = D1_SHOT_EXTERNAL_ID,
    name: str = _D1_SHOT_NAME,
) -> Shot:
    existing_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=external_id
    )
    if existing_id is not None:
        shot = await session.get(Shot, existing_id)
        if shot is None:
            raise InternalConsistencyError(
                f"D1 seed: demo ExternalEntityLink points at a missing Shot {existing_id}"
            )
        return shot

    shot = Shot(project_id=project.id, name=name, source="manual")
    session.add(shot)
    await session.flush()
    await record_external_link(
        session,
        entity_type="shot",
        entity_id=shot.id,
        source=_DEMO_SOURCE,
        external_id=external_id,
    )
    await session.commit()
    await session.refresh(shot)
    return shot


async def _resolve_or_create_task(
    session: AsyncSession,
    shot: Shot,
    *,
    external_id: str = D1_TASK_EXTERNAL_ID,
    name: str = _D1_TASK_NAME,
    department: str = "comp",
) -> Task:
    existing_id = await find_linked_entity_id(
        session, entity_type="task", source=_DEMO_SOURCE, external_id=external_id
    )
    if existing_id is not None:
        task = await session.get(Task, existing_id)
        if task is None:
            raise InternalConsistencyError(
                f"D1 seed: demo ExternalEntityLink points at a missing Task {existing_id}"
            )
        return task

    task = Task(shot_id=shot.id, name=name, department=department, source="manual")
    session.add(task)
    await session.flush()
    await record_external_link(
        session,
        entity_type="task",
        entity_id=task.id,
        source=_DEMO_SOURCE,
        external_id=external_id,
    )
    await session.commit()
    await session.refresh(task)
    return task


async def _resolve_or_create_version(
    session: AsyncSession,
    shot: Shot,
    *,
    name: str = _D1_VERSION_NAME,
    description: str = _D1_VERSION_DESCRIPTION,
) -> Version:
    existing = await session.scalar(
        select(Version)
        .where(Version.shot_id == shot.id, Version.description.like(f"{D1_MARKER}%"))
        .order_by(Version.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await versions_service.create_version(
        session,
        _SEED_ACTOR_VFX,
        shot.id,
        name=name,
        version_number=1,
        description=description,
    )


async def _ensure_intent_brief(session: AsyncSession, shot: Shot) -> IntentBrief:
    existing = await session.scalar(
        select(IntentBrief)
        .where(IntentBrief.shot_id == shot.id, IntentBrief.raw_text.like(f"{D1_MARKER}%"))
        .order_by(IntentBrief.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await brief_service.create_brief(session, _SEED_ACTOR_VFX, shot.id, _D1_BRIEF_TEXT)


async def _ensure_review_note(session: AsyncSession, version: Version) -> ReviewNote:
    existing = await session.scalar(
        select(ReviewNote)
        .where(ReviewNote.version_id == version.id, ReviewNote.content.like(f"{D1_MARKER}%"))
        .order_by(ReviewNote.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await versions_service.create_review_note(
        session, _SEED_ACTOR_VFX, version.id, content=_D1_REVIEW_NOTE_TEXT
    )


_CORE_ANCHOR_DRAFT_CONTENT: Final[dict[str, object]] = {
    "shot_objective": (
        f"{D1_MARKER} Hold the confrontation restrained and internal through to its climax."
    ),
    "emotional_tone": (
        "Quiet, controlled tension -- restraint reads as more dangerous than release."
    ),
    "visual_focus": "Faces and stillness over movement; the drift is in what is withheld.",
    "rhythm_intensity": "Deliberate, unhurried -- avoid cutting to match rising tension.",
    "character_relationship": "Two people who already know how this ends and are delaying it.",
    "narrative_priority": (
        "Preserve the restraint; do not let camera or compositing choices imply release."
    ),
    "core_summary": "A restrained dusk confrontation that stays internal and controlled.",
    "constraints": [
        {"content": "No jump cuts through the confrontation's central exchange."}
    ],
    "variation_zones": [
        {"content": "Compositing contrast may vary within the confirmed restrained range."}
    ],
    "drift_risks": [
        {
            "description": (
                "Camera timing or contrast choices reading as more overtly dramatic than "
                "intended."
            )
        }
    ],
    "references": [],
    "open_questions": [
        {
            "question": (
                "Should the confrontation's climax use a longer take, or is a cut "
                "acceptable if restraint is preserved?"
            )
        }
    ],
}


async def _ensure_confirmed_core_anchor(session: AsyncSession, shot: Shot) -> CoreAnchorRevision:
    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot.id))

    if core_anchor is not None and core_anchor.active_revision_id is not None:
        revision = await session.get(CoreAnchorRevision, core_anchor.active_revision_id)
        if revision is None:
            raise InternalConsistencyError(
                f"D1 seed: CoreAnchor {core_anchor.id} active_revision_id references a "
                "missing CoreAnchorRevision"
            )
        if revision.status != "confirmed":
            raise InternalConsistencyError(
                f"D1 seed: CoreAnchor {core_anchor.id} active_revision_id references a "
                f"revision with status={revision.status!r}, expected 'confirmed'"
            )
        return revision

    draft: CoreAnchorRevision | None = None
    if core_anchor is not None:
        draft = await session.scalar(
            select(CoreAnchorRevision).where(
                CoreAnchorRevision.core_anchor_id == core_anchor.id,
                CoreAnchorRevision.revision_number == 1,
            )
        )
        if draft is not None and draft.status != "draft":
            raise InternalConsistencyError(
                f"D1 seed: CoreAnchorRevision #1 for CoreAnchor {core_anchor.id} has "
                f"status={draft.status!r} but CoreAnchor.active_revision_id is unset -- "
                "inconsistent baseline state"
            )

    if draft is None:
        draft = await core_anchor_service.create_draft_revision(
            session, _SEED_ACTOR_VFX, shot.id, dict(_CORE_ANCHOR_DRAFT_CONTENT)
        )

    return await core_anchor_service.confirm_revision(
        session, _SEED_ACTOR_VFX, draft.id, _D1_CONFIRM_RATIONALE
    )


_EXECUTION_ANCHOR_DRAFT_CONTENT: Final[dict[str, object]] = {
    "technical_boundaries": (
        f"{D1_MARKER} 24fps, no added motion blur, contrast graded within the confirmed "
        "restrained range."
    ),
    "parameter_ranges": "Contrast: -5% to +5% of the confirmed baseline grade.",
    "delivery_conditions": (
        "Deliver at confirmed project resolution with restrained-range LUT applied."
    ),
    "production_ready_criteria": (
        "Camera timing and contrast both fall within the confirmed Core Anchor's "
        "restrained direction."
    ),
    "downstream_dependencies": "Final grade depends on this compositing pass's contrast range.",
    "publish_requirements": "Requires VFX Supervisor review before publish.",
    "allowed_refinements": (
        "Minor contrast trims within the stated range without further confirmation."
    ),
    "escalation_conditions": (
        "Escalate to VFX Supervisor if contrast drift exceeds the stated range."
    ),
}


async def _ensure_confirmed_execution_anchor(
    session: AsyncSession, task: Task
) -> ExecutionAnchorRevision:
    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task.id)
    )

    if execution_anchor is not None and execution_anchor.active_revision_id is not None:
        revision = await session.get(ExecutionAnchorRevision, execution_anchor.active_revision_id)
        if revision is None:
            raise InternalConsistencyError(
                f"D1 seed: ExecutionAnchor {execution_anchor.id} active_revision_id references "
                "a missing ExecutionAnchorRevision"
            )
        if revision.status != "confirmed":
            raise InternalConsistencyError(
                f"D1 seed: ExecutionAnchor {execution_anchor.id} active_revision_id references "
                f"a revision with status={revision.status!r}, expected 'confirmed'"
            )
        return revision

    draft: ExecutionAnchorRevision | None = None
    if execution_anchor is not None:
        draft = await session.scalar(
            select(ExecutionAnchorRevision).where(
                ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id,
                ExecutionAnchorRevision.revision_number == 1,
            )
        )
        if draft is not None and draft.status != "draft":
            raise InternalConsistencyError(
                f"D1 seed: ExecutionAnchorRevision #1 for ExecutionAnchor {execution_anchor.id} "
                f"has status={draft.status!r} but active_revision_id is unset -- inconsistent "
                "baseline state"
            )

    if draft is None:
        draft = await execution_anchor_service.create_draft_revision(
            session, _SEED_ACTOR_CG, task.id, dict(_EXECUTION_ANCHOR_DRAFT_CONTENT)
        )

    return await execution_anchor_service.confirm_revision(
        session, _SEED_ACTOR_CG, draft.id, _D1_CONFIRM_RATIONALE
    )


async def _ensure_cg_demo_task(
    session: AsyncSession, shot: Shot
) -> tuple[Task, TaskDependency]:
    """Step 7C-4: a second, real Task under the rich D1 Shot whose
    Execution Anchor is deliberately left at draft (never confirmed),
    plus one real open `TaskDependency` recorded against it -- so the CG
    Review Inbox and Dependencies page each have at least one genuine,
    non-fabricated work item out of the box. Idempotent: resolves the
    Task via the same `ExternalEntityLink` mechanism every other seeded
    row uses, and the dependency via a stable `D1_MARKER` description
    prefix scoped to the resolved Task (the same convention
    `_ensure_review_note` uses for Version, since `TaskDependency` --
    like `ReviewNote` -- has no `ExternalEntityLink` support).
    """
    task = await _resolve_or_create_task(
        session,
        shot,
        external_id=CG_DEMO_TASK_EXTERNAL_ID,
        name=_CG_DEMO_TASK_NAME,
        department="lighting",
    )

    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task.id)
    )
    if execution_anchor is None:
        await execution_anchor_service.create_draft_revision(
            session, _SEED_ACTOR_CG, task.id, dict(_CG_DEMO_EXECUTION_DRAFT_CONTENT)
        )

    dependency = await session.scalar(
        select(TaskDependency)
        .where(
            TaskDependency.task_id == task.id,
            TaskDependency.description.like(f"{D1_MARKER}%"),
        )
        .order_by(TaskDependency.created_at)
        .limit(1)
    )
    if dependency is None:
        dependency = await cross_department_service.create_dependency(
            session,
            _SEED_ACTOR_CG,
            task.id,
            kind="dependency",
            description=_CG_DEMO_DEPENDENCY_TEXT,
            severity="medium",
        )

    return task, dependency


async def _ensure_vfx_review(session: AsyncSession, version: Version) -> VFXSupervisorReview:
    existing = await session.scalar(
        select(VFXSupervisorReview)
        .where(VFXSupervisorReview.version_id == version.id)
        .order_by(VFXSupervisorReview.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await vfx_supervisor_review_service.generate_vfx_supervisor_review(
        session, _SEED_ACTOR_VFX, version.id, generator=DeterministicVFXSupervisorReviewGenerator()
    )


async def _ensure_cg_review(
    session: AsyncSession, execution_anchor_revision: ExecutionAnchorRevision
) -> CGSupervisorReview:
    existing = await session.scalar(
        select(CGSupervisorReview)
        .where(CGSupervisorReview.execution_anchor_revision_id == execution_anchor_revision.id)
        .order_by(CGSupervisorReview.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    # Generated *after* the VFX review (caller ordering) -- required for
    # the deterministic generator to populate `coordination_concerns`,
    # see this module's own docstring.
    return await cg_supervisor_review_service.generate_cg_supervisor_review(
        session,
        _SEED_ACTOR_CG,
        execution_anchor_revision.id,
        generator=DeterministicCGSupervisorReviewGenerator(),
    )


async def _ensure_artist_guidance(
    session: AsyncSession, version: Version, task: Task
) -> ArtistAgentGuidance:
    existing = await session.scalar(
        select(ArtistAgentGuidance)
        .where(ArtistAgentGuidance.version_id == version.id, ArtistAgentGuidance.task_id == task.id)
        .order_by(ArtistAgentGuidance.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await generate_artist_agent_guidance(
        session,
        _SEED_ACTOR_ARTIST,
        version.id,
        task.id,
        generator=DeterministicArtistGuidanceGenerator(),
    )


_D1_PROPOSAL_LABEL: Final = "[Cross-role D1]"


class DeterministicD1CrossRoleAssessmentGenerator:
    """D1 Demo-only deterministic generator (Step 7C-1 targeted
    correction) -- never used by any production request path and never
    substituted for `DeterministicCrossRoleAssessmentGenerator` outside
    this seed module. Delegates every field to the real, unmodified
    `DeterministicCrossRoleAssessmentGenerator` and only adds a
    `re_anchor_proposal`, grounded in the same snapshot evidence ids
    that generator already cites (the confirmed Core Anchor revision,
    the VFX Supervisor Agent review, the CG Supervisor Agent review).
    This is deterministic Demo *data* generation, not a UI mock: the
    result is handed to the real `generate_cross_role_assessment`
    service call below, which runs it through the same
    `_validate_re_anchor_proposal` evidence-diversity gate,
    `_validate_evidence_resolves_to_snapshot`, and
    `_validate_content_boundaries` checks a live provider's output
    would face, and persists it the same way.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CrossRoleAssessmentOutput:
        base = DeterministicCrossRoleAssessmentGenerator().generate(
            snapshot_payload=snapshot_payload
        )

        confirmed_core_revision = snapshot_payload["core_anchor"]["confirmed_revision"]
        vfx_review = snapshot_payload["vfx_supervisor_review"]
        cg_review = snapshot_payload["cg_supervisor_review"]

        core_anchor_evidence = CrossRoleEvidenceReference(
            source_type="core_anchor_revision",
            source_id=confirmed_core_revision["id"],
            label=f"Confirmed Core Anchor revision {confirmed_core_revision['id']}",
        )
        vfx_evidence = CrossRoleEvidenceReference(
            source_type="vfx_supervisor_review",
            source_id=vfx_review["id"],
            label=f"VFX review {vfx_review['id']}",
        )
        cg_evidence = CrossRoleEvidenceReference(
            source_type="cg_supervisor_review",
            source_id=cg_review["id"],
            label=f"CG review {cg_review['id']}",
        )

        proposal = ReAnchorProposalOutput(
            reason_for_consideration=(
                f"{_D1_PROPOSAL_LABEL} The VFX and CG Supervisor Agent reviews both record "
                "camera-timing and contrast drift concerns that the confirmed Core Anchor's "
                "drift_risks field currently names only as one combined risk."
            ),
            preserved_elements=[
                f"{_D1_PROPOSAL_LABEL} The restrained, internal emotional tone.",
                f"{_D1_PROPOSAL_LABEL} That camera timing must not imply release before the "
                "climax.",
            ],
            proposed_fields=[
                ReAnchorFieldProposal(
                    field="drift_risks",
                    current_problem=(
                        f"{_D1_PROPOSAL_LABEL} The confirmed drift_risks field names camera "
                        "timing and contrast drift together, without distinguishing which "
                        "recorded role's concern is driving the current drift."
                    ),
                    proposed_direction=(
                        f"{_D1_PROPOSAL_LABEL} Consider naming the camera-timing risk and the "
                        "contrast-grading risk as two separately trackable drift risks."
                    ),
                    why_it_may_help=(
                        f"{_D1_PROPOSAL_LABEL} Separating the two recorded concerns would let "
                        "each role's evidence be checked against the Core Anchor independently, "
                        "rather than through one combined risk statement."
                    ),
                    evidence=[vfx_evidence, cg_evidence],
                )
            ],
            adoption_risks=[
                f"{_D1_PROPOSAL_LABEL} Splitting the drift risk into two entries could read as "
                "raising two problems where the underlying scene intent has not changed."
            ],
            questions_for_human_vfx_supervisor=[
                f"{_D1_PROPOSAL_LABEL} Should camera-timing drift and contrast-grading drift "
                "remain one combined risk, or be tracked separately going forward?"
            ],
            evidence=[core_anchor_evidence, vfx_evidence, cg_evidence],
        )

        return base.model_copy(update={"re_anchor_proposal": proposal})


async def _ensure_cross_role_assessment(
    session: AsyncSession, shot: Shot, version: Version, task: Task
) -> CrossRoleAssessment:
    existing = await session.scalar(
        select(CrossRoleAssessment)
        .where(CrossRoleAssessment.shot_id == shot.id)
        .order_by(CrossRoleAssessment.created_at)
        .limit(1)
    )
    if existing is not None:
        return existing
    return await generate_cross_role_assessment(
        session,
        _SEED_ACTOR_VFX,
        version.id,
        task.id,
        generator=DeterministicD1CrossRoleAssessmentGenerator(),
    )


async def _ensure_uninitialized_shot(session: AsyncSession, project: Project) -> Shot:
    """Step 7C-1: resolves/creates a second, normal Shot under the same
    seed-owned Project, through the exact same resolve-or-create helpers
    and `ExternalEntityLink(source="demo")` identity mechanism the rich
    Shot uses, but under the separate, fixed
    `UNINITIALIZED_SHOT_EXTERNAL_ID` identity -- never the same row as
    `ensure_d1_scenario`'s rich `D1_SHOT_EXTERNAL_ID` Shot.

    Deliberately never calls `_ensure_confirmed_core_anchor`,
    `_ensure_confirmed_execution_anchor`, or any downstream review/
    assessment helper -- so the returned Shot always has zero
    `CoreAnchor` rows, no HumanGate, no Decision, no Execution Anchor,
    and no CrossRoleAssessment: Core Anchor lifecycle state 1 (INITIAL
    EMPTY), every time this is called, on a fresh database or a
    thousandth call alike. Safe to call repeatedly; never resets or
    mutates an existing uninitialized Shot's Core Anchor state (there is
    none to reset -- this function never creates one). Not excluded from
    any product listing -- reachable exactly like any other Shot.
    """
    shot = await _resolve_or_create_shot(
        session, project, external_id=UNINITIALIZED_SHOT_EXTERNAL_ID, name=_UNINITIALIZED_SHOT_NAME
    )
    await _resolve_or_create_task(
        session, shot, external_id=UNINITIALIZED_TASK_EXTERNAL_ID, name=_UNINITIALIZED_TASK_NAME
    )
    await _resolve_or_create_version(
        session,
        shot,
        name=_UNINITIALIZED_VERSION_NAME,
        description=_UNINITIALIZED_VERSION_DESCRIPTION,
    )
    return shot


async def reset_uninitialized_shot_core_anchor_state(session: AsyncSession) -> uuid.UUID:
    """Dev-only reset (Step 7C-2 browser-validation fix #1): puts Step
    7C-1's uninitialized Shot back at Core Anchor lifecycle state 1
    (INITIAL EMPTY), even after a prior browser session has moved it past
    that state (e.g. by clicking "Start a Core Anchor" during manual QA).

    `_ensure_uninitialized_shot` only ever resolves-or-creates -- it never
    resets an existing Shot's Core Anchor state, so once any draft exists
    for it, INITIAL EMPTY becomes permanently unreachable through the
    normal seed endpoint alone. This function is the smallest fix: it
    ensures the Shot exists (creating it, and its owning Project, via the
    exact same helpers `ensure_d1_scenario` uses, if this is a fresh
    database), then deletes only that Shot's own CoreAnchor lifecycle
    rows -- every CoreAnchorRevision (cascading to its five semantic-child
    collections via the existing ORM relationship), every HumanGate
    opened for one of those revisions, every Decision recorded against one
    of those revisions, and the CoreAnchor row itself. It never touches
    any other Shot (including the rich D1 Shot), never touches
    Task/Version/Project rows, and never touches Execution Anchor,
    Assessment, or Signal data (the uninitialized Shot never has any).

    Idempotent and safe to call repeatedly: a Shot already at INITIAL
    EMPTY (no CoreAnchor row at all) is left untouched and this is a
    no-op past the resolve-or-create step.
    """
    project = await _resolve_or_create_project(session)
    shot = await _ensure_uninitialized_shot(session, project)

    anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot.id))
    if anchor is None:
        return shot.id

    revisions = (
        await session.scalars(
            select(CoreAnchorRevision).where(CoreAnchorRevision.core_anchor_id == anchor.id)
        )
    ).all()
    revision_ids = [revision.id for revision in revisions]

    if revision_ids:
        # HumanGate/Decision are not ORM-cascaded from CoreAnchorRevision
        # (HumanGate has its own hard FK with no cascade configured;
        # Decision uses the same loose entity_type/entity_id reference
        # CoreAnchorRevision's own docstring already describes) -- both
        # must be deleted explicitly, and before the revisions themselves
        # so HumanGate's FK is never left dangling mid-transaction.
        await session.execute(
            delete(HumanGate).where(HumanGate.core_anchor_revision_id.in_(revision_ids))
        )
        await session.execute(
            delete(Decision).where(
                Decision.entity_type == "core_anchor_revision",
                Decision.entity_id.in_(revision_ids),
            )
        )

    for revision in revisions:
        # ORM-level delete (not a bulk `delete()`) so the existing
        # `cascade="all, delete-orphan"` relationships on
        # CoreAnchorRevision remove its Constraint/VariationZone/
        # DriftRisk/AnchorReference/OpenQuestion rows too.
        await session.delete(revision)

    # CoreAnchor.active_revision_id may still point at a just-deleted
    # confirmed revision; clearing it first avoids a dangling FK value on
    # the row this same transaction is about to delete anyway.
    anchor.active_revision_id = None
    await session.flush()
    await session.delete(anchor)

    await session.commit()
    return shot.id


async def reset_cg_demo_task_execution_anchor_state(session: AsyncSession) -> uuid.UUID:
    """Dev-only reset (Step 7C-4 Execution Anchor workflow fix): puts the
    CG demo Task's (`_ensure_cg_demo_task`, "Lighting Pass") Execution
    Anchor back at its intended coherent baseline -- one draft revision
    holding the real, meaningful seeded `_CG_DEMO_EXECUTION_DRAFT_CONTENT`,
    with a real pending HumanGate, never confirmed -- even after a prior
    browser session has moved it past that state (e.g. by confirming the
    seeded draft, then starting and confirming a second, blank one).

    `_ensure_cg_demo_task` only ever resolves-or-creates -- it never
    resets an existing Task's Execution Anchor state once any revision
    exists for it, so the intended meaningful-draft baseline becomes
    permanently unreachable through the normal seed endpoint alone once
    the demo Task's Execution Anchor has been confirmed. This function is
    the smallest fix: it ensures the Project/Shot/Task and the Shot's
    confirmed Core Anchor exist (via the same helpers `ensure_d1_scenario`
    uses, if this is a fresh database), then deletes only this Task's own
    ExecutionAnchor lifecycle rows -- every ExecutionAnchorRevision
    (and every CGSupervisorReview/ArtistAgentGuidance/CrossRoleAssessment
    that references one, none of which the normal seed ever creates
    against this Task, but a manual/live-check session could have),
    every HumanGate opened for one of those revisions, every Decision
    recorded against one of those revisions, and the ExecutionAnchor row
    itself -- before creating one fresh draft revision with the seeded
    content. It never touches the Task's real open TaskDependency, never
    touches any other Task/Shot, and never touches Core Anchor data.

    Idempotent and safe to call repeatedly: re-running this after it has
    already produced the intended baseline deletes that same one draft
    and recreates an equivalent one.
    """
    project = await _resolve_or_create_project(session)
    shot = await _resolve_or_create_shot(session, project)
    task = await _resolve_or_create_task(
        session,
        shot,
        external_id=CG_DEMO_TASK_EXTERNAL_ID,
        name=_CG_DEMO_TASK_NAME,
        department="lighting",
    )

    # The demo Task's Execution Anchor draft requires a confirmed Core
    # Anchor for its Shot -- a no-op on every normal run, since this
    # rich D1 Shot's Core Anchor is already established by
    # `ensure_d1_scenario`.
    await _ensure_confirmed_core_anchor(session, shot)

    execution_anchor = await session.scalar(
        select(ExecutionAnchor).where(ExecutionAnchor.task_id == task.id)
    )
    if execution_anchor is not None:
        revisions = (
            await session.scalars(
                select(ExecutionAnchorRevision).where(
                    ExecutionAnchorRevision.execution_anchor_id == execution_anchor.id
                )
            )
        ).all()
        revision_ids = [revision.id for revision in revisions]

        if revision_ids:
            # None of these dependent rows are FK-cascaded from
            # ExecutionAnchorRevision -- each must be deleted explicitly,
            # and before the revisions themselves, so no FK is ever left
            # dangling mid-transaction. The normal seed never creates any
            # of these three against this demo Task, but a prior manual/
            # live-check session could have, so this reset must be
            # correct even then.
            await session.execute(
                delete(CGSupervisorReview).where(
                    CGSupervisorReview.execution_anchor_revision_id.in_(revision_ids)
                )
            )
            await session.execute(
                delete(ArtistAgentGuidance).where(
                    ArtistAgentGuidance.execution_anchor_revision_id.in_(revision_ids)
                )
            )
            await session.execute(
                delete(CrossRoleAssessment).where(
                    CrossRoleAssessment.execution_anchor_revision_id.in_(revision_ids)
                )
            )
            await session.execute(
                delete(HumanGate).where(HumanGate.execution_anchor_revision_id.in_(revision_ids))
            )
            await session.execute(
                delete(Decision).where(
                    Decision.entity_type == "execution_anchor_revision",
                    Decision.entity_id.in_(revision_ids),
                )
            )

        for revision in revisions:
            await session.delete(revision)

        # ExecutionAnchor.active_revision_id may still point at a
        # just-deleted confirmed revision; clearing it first avoids a
        # dangling FK value on the row this same transaction is about to
        # delete anyway.
        execution_anchor.active_revision_id = None
        await session.flush()
        await session.delete(execution_anchor)
        await session.flush()

    # create_draft_revision commits internally -- this is the single
    # atomic transaction boundary for the whole reset: either the old
    # state's removal and the new baseline's creation both land, or
    # neither does.
    await execution_anchor_service.create_draft_revision(
        session, _SEED_ACTOR_CG, task.id, dict(_CG_DEMO_EXECUTION_DRAFT_CONTENT)
    )
    return task.id


async def ensure_d1_scenario(session: AsyncSession) -> D1ScenarioResult:
    """Idempotent: safe to call on an empty database (creates the full
    baseline), on a database that already has it (pure reads, no
    writes), or on a database with a partial prior run (resumes at
    whichever step did not complete). Never requires a live model
    provider -- every generation call above explicitly injects the real
    deterministic generator. Never mutates `os.environ`.

    Step 7C-1: also folds creation of a second, normal, deliberately-
    unconfirmed Shot (`_ensure_uninitialized_shot`) into this same
    generic development seed process, so Core Anchor lifecycle states 1
    (INITIAL EMPTY) and 2 (FIRST DRAFT) remain reachable through the
    normal product journey without any special/guided entry path.

    Step 7C-4: also folds in a second Task under the rich D1 Shot
    (`_ensure_cg_demo_task`) with a deliberately draft Execution Anchor
    and one real open dependency, so the CG Workspace has a real,
    actionable Review Inbox item and Dependencies content without any
    special/guided entry path either.
    """
    project = await _resolve_or_create_project(session)
    shot = await _resolve_or_create_shot(session, project)
    task = await _resolve_or_create_task(session, shot)
    version = await _resolve_or_create_version(session, shot)
    await _ensure_intent_brief(session, shot)
    await _ensure_review_note(session, version)

    core_anchor_revision = await _ensure_confirmed_core_anchor(session, shot)
    execution_anchor_revision = await _ensure_confirmed_execution_anchor(session, task)

    await _ensure_vfx_review(session, version)
    await _ensure_cg_review(session, execution_anchor_revision)
    await _ensure_artist_guidance(session, version, task)

    assessment = await _ensure_cross_role_assessment(session, shot, version, task)

    uninitialized_shot = await _ensure_uninitialized_shot(session, project)
    cg_demo_task, cg_demo_dependency = await _ensure_cg_demo_task(session, shot)

    return D1ScenarioResult(
        project_id=project.id,
        shot_id=shot.id,
        task_id=task.id,
        version_id=version.id,
        core_anchor_revision_id=core_anchor_revision.id,
        execution_anchor_revision_id=execution_anchor_revision.id,
        cross_role_assessment_id=assessment.id,
        uninitialized_shot_id=uninitialized_shot.id,
        cg_demo_task_id=cg_demo_task.id,
        cg_demo_dependency_id=cg_demo_dependency.id,
    )
