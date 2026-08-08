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

from intent_core_contracts.api.artist_agent_guidance import (
    ArtistAgentGuidanceOutput,
    ArtistEvidenceReference,
    ArtistGuidanceItem,
)
from intent_core_contracts.api.cg_supervisor_review import (
    CGReviewEvidenceReference,
    CGReviewItem,
    CGSupervisorReviewOutput,
)
from intent_core_contracts.api.cross_role_assessment import (
    CrossRoleAssessmentOutput,
    CrossRoleEvidenceReference,
    CrossRoleFinding,
    ReAnchorFieldProposal,
    ReAnchorProposalOutput,
)
from intent_core_contracts.api.execution_anchor import ExecutionAnchorRevisionDraftCreate
from intent_core_contracts.api.vfx_supervisor_review import (
    VFXReviewEvidenceReference,
    VFXReviewItem,
    VFXSupervisorReviewOutput,
)
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import cg_supervisor_review_service, vfx_supervisor_review_service
from intent_core_api.agents.artist_guidance_service import (
    ArtistGuidanceGenerator,
    DeterministicArtistGuidanceGenerator,
    generate_artist_agent_guidance,
)
from intent_core_api.agents.cg_agent_service import ExecutionAnchorDraftGenerator
from intent_core_api.agents.cg_supervisor_review_service import (
    CGSupervisorReviewGenerator,
    DeterministicCGSupervisorReviewGenerator,
)
from intent_core_api.agents.cross_role_assessment_service import (
    CrossRoleAssessmentGenerator,
    DeterministicCrossRoleAssessmentGenerator,
    generate_cross_role_assessment,
)
from intent_core_api.agents.vfx_supervisor_review_service import (
    DeterministicVFXSupervisorReviewGenerator,
    VFXSupervisorReviewGenerator,
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
    Constraint,
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
# Package C journey rebase (ICAS_PACKAGE_C_AUDIT_REPORT.md): this rich
# scenario used to target `icas-demo:d1:shot-010` -- the exact same Shot
# identity the Package C D1 Journey state machine (`demo_seed.d1_journey`)
# now owns. Because both pipelines wrote real Version/Review/Guidance/
# Assessment rows onto that one shared Shot, calling this generic dev
# seed (directly, or transitively through anything reachable from the
# product) after a D1 Journey Reset silently re-created a
# CrossRoleAssessment + ReAnchorProposal + 4th ArtistAgentGuidance the
# Journey never asked for. Retargeted to its own Shot (below), following
# the same isolated-fixture pattern already used for the "uninitialized"
# Shot 020 and the CG demo Shot 030, so this pipeline can never again
# mutate the canonical D1 Journey graph no matter what calls it.
D1_LEGACY_SHOT_EXTERNAL_ID: Final = "icas-demo:d1:legacy-baseline-shot"
D1_LEGACY_TASK_EXTERNAL_ID: Final = "icas-demo:d1:legacy-baseline-shot:compositing-review"

# The canonical Package C D1 Journey identity (ICAS_PACKAGE_C_JOURNEY_
# REBASE_CLAUDE_HANDOFF.md §2) -- declared here as the single source of
# truth for the string, but the *only* sanctioned way to resolve/create
# these two rows is `resolve_or_create_canonical_root` below, which
# creates nothing beyond the Project/Shot pair itself. `demo_seed.
# d1_journey` owns everything downstream of this root (Tasks, Versions,
# Anchors, and every journey-state record).
CANONICAL_D1_SHOT_EXTERNAL_ID: Final = "icas-demo:d1:shot-010"
_CANONICAL_D1_SHOT_NAME: Final = "Shot 010 — Final confrontation"
# The three canonical Task identities `demo_seed.d1_journey` owns
# (ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md §2). Declared again
# here, privately, purely so `resolve_canonical_d1_sibling_department_
# evidence` below can read all three departments' real seeded evidence
# without an import from `d1_journey` (which already imports this
# module at its own top level -- importing back would be circular).
# These three literal strings are the same fixed product identity
# `d1_journey.CANONICAL_TASK_EXTERNAL_IDS` declares; nothing here
# resolves-or-creates any of them.
_CANONICAL_ANIMATION_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:animation-pass"
_CANONICAL_LIGHTING_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:lighting-pass"
_CANONICAL_COMPOSITING_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-010:compositing-review"
# Stable, parseable marker (docs/step-7/16_STEP_7C0D_...md §2.3) --
# Version has no ExternalEntityLink support, so this prefix on the free-
# text `description`/`raw_text`/`content` field is the seed-owned key,
# always scoped additionally by the already-resolved seeded Shot/Version.
D1_MARKER: Final = "[ICAS Demo — D1]"

_D1_PROJECT_NAME: Final = "D1 Demo Project"
_D1_SHOT_NAME: Final = "Shot 040 — Legacy ensure-scenario baseline"
_D1_TASK_NAME: Final = "Compositing Review"
_D1_VERSION_NAME: Final = "D1_STEP3_VFX_REVIEW_001"

# Step 7C-1: a second, deterministic Shot under the same seed-owned
# Project, with its own fixed `ExternalEntityLink(source="demo")`
# identity -- never the same row as the fully-seeded
# `D1_LEGACY_SHOT_EXTERNAL_ID` Shot above. Its whole purpose is to be a
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

# Development-only Execution Anchor lifecycle fixture. It must never
# occupy the canonical D1 Shot 010 Lighting Task used by Package C's
# complete three-department journey.
CG_DEMO_SHOT_EXTERNAL_ID: Final = "icas-demo:d1:shot-030:execution-draft"
CG_DEMO_TASK_EXTERNAL_ID: Final = "icas-demo:d1:shot-030:lighting-pass"
_CG_DEMO_SHOT_NAME: Final = "Shot 030 — Execution draft fixture"
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
_D1_CONFIRM_RATIONALE: Final = f"{D1_MARKER} Initial seeded baseline for the D1 demo scenario."

_SEED_ACTOR_ID: Final = "demo-seed"
_SEED_ACTOR_VFX = ActorContext(
    actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="vfx_supervisor"
)
_SEED_ACTOR_CG = ActorContext(
    actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="cg_supervisor"
)
_SEED_ACTOR_ARTIST = ActorContext(actor_kind="human", actor_id=_SEED_ACTOR_ID, human_role="artist")


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
    external_id: str = D1_LEGACY_SHOT_EXTERNAL_ID,
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
    external_id: str = D1_LEGACY_TASK_EXTERNAL_ID,
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
    "constraints": [{"content": "No jump cuts through the confrontation's central exchange."}],
    "variation_zones": [
        {"content": "Compositing contrast may vary within the confirmed restrained range."}
    ],
    "drift_risks": [
        {
            "description": (
                "Camera timing or contrast choices reading as more overtly dramatic than intended."
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
    session: AsyncSession, project: Project
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
    shot = await _resolve_or_create_shot(
        session,
        project,
        external_id=CG_DEMO_SHOT_EXTERNAL_ID,
        name=_CG_DEMO_SHOT_NAME,
    )
    await _ensure_confirmed_core_anchor(session, shot)
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


_D1_DEPARTMENT_LABELS: Final = {
    "animation": "Animation",
    "lighting": "Lighting",
    "comp": "Compositing",
}

# Same length bound
# `cross_role_assessment_service.DeterministicCrossRoleAssessmentGenerator.
# generate` uses for its own `executive_summary` (that module's own
# private `_EXECUTIVE_SUMMARY_LIMIT`, replicated here rather than
# imported, since this module already keeps its own D1-only constants
# local instead of reaching into that module's private names).
_EXECUTIVE_SUMMARY_LIMIT: Final = 700


def _recomputed_executive_summary(
    *,
    cross_role_tensions: list[CrossRoleFinding],
    local_optimum_risks: list[CrossRoleFinding],
    unresolved_dependencies: list[CrossRoleFinding],
) -> str:
    """Owner re-validation correction (Package C follow-up): the base
    `DeterministicCrossRoleAssessmentGenerator`'s own `executive_summary`
    encodes exact finding counts as text. `_three_department_resolved`
    and `_three_department_conflict` below both append their own
    department findings to `base.local_optimum_risks`/`cross_role_
    tensions` via `base.model_copy(...)`, which carries the *pre-
    augmentation* `executive_summary` string forward unchanged --
    stale text like "0 local-optimum risk(s)" sitting next to a
    Findings section that visibly holds three. Recomputing from the
    actual final list lengths, same sentence shape the base generator
    itself uses (minus its internal `"[Cross-role deterministic]"`
    label -- Package C presentation cleanup: this is D1's own visible
    executive summary, not the shared generic generator's own output,
    so it never carries an implementation-fixture prefix), keeps the
    summary truthful without changing what evidence any Finding cites
    or adding a new one.
    """
    text = (
        f"{len(cross_role_tensions)} cross-role tension(s), "
        f"{len(local_optimum_risks)} local-optimum risk(s), and "
        f"{len(unresolved_dependencies)} unresolved dependency(ies) considered across the "
        "VFX Supervisor Agent, CG Supervisor Agent, and Artist Agent recorded output."
    )
    if len(text) <= _EXECUTIVE_SUMMARY_LIMIT:
        return text
    return text[: _EXECUTIVE_SUMMARY_LIMIT - 1] + "…"


class DeterministicD1CrossRoleAssessmentGenerator:
    """D1 Demo-only deterministic generator (Step 7C-1 targeted
    correction; Package C content-fidelity fix) -- never used by any
    production request path and never substituted for
    `DeterministicCrossRoleAssessmentGenerator` outside this seed
    module. Delegates the shared-intent read, role perspectives,
    agreements, and evidence-gaps disclosure to the real, unmodified
    `DeterministicCrossRoleAssessmentGenerator`.

    When `snapshot_payload["sibling_departments"]` is present (added
    only for the canonical Package C D1 Journey identity by
    `agents.cross_role_assessment_service.generate_cross_role_assessment`,
    via `resolve_canonical_d1_sibling_department_evidence` -- see that
    function's own docstring), this generator reads each department's
    real, currently-confirmed Execution Anchor content and CG Review
    directly. Two truthful outcomes, chosen by `_all_departments_
    resolved` (real `revision_number` check, never guessed):

    - Not yet resolved (any department still confirmed-R1): derives the
      locked Animation + Lighting + Compositing local-optimum conflict
      (`_three_department_conflict`) -- a `local_optimum_risk` per
      department, one combined `cross_role_tension`, and a
      `re_anchor_proposal` recommending a combined-intensity ceiling.
    - Resolved (every department confirmed its own Execution Anchor
      R2 -- Package C follow-up, downstream retranslation semantics):
      derives a truthful "integration verified" read instead
      (`_three_department_resolved`) -- medium-priority findings citing
      each department's real confirmed R2 content, no `re_anchor_
      proposal` (the ceiling has already been adopted, not merely
      proposed).

    Every field either way is a live read of the real payload content
    -- if the canonical D1 fixture's Execution Anchor text ever
    changes, this generator's output changes with it; nothing here is a
    fixed UI-layer string substitute.

    When `sibling_departments` is absent (the noncanonical legacy D1
    fixture Shot this same module's `ensure_d1_scenario` seeds, which
    has only one Task), falls back to the original single-Task
    camera-timing/contrast-drift proposal, grounded in the same snapshot
    evidence ids `DeterministicCrossRoleAssessmentGenerator` already
    cites (the confirmed Core Anchor revision, the VFX Supervisor Agent
    review, the CG Supervisor Agent review) -- unchanged from before.

    Either way, the result is handed to the real
    `generate_cross_role_assessment` service call, which runs it through
    the same `_validate_re_anchor_proposal` evidence-diversity gate,
    `_validate_evidence_resolves_to_snapshot`, and
    `_validate_content_boundaries` checks a live provider's output would
    face, and persists it the same way.
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

        sibling_departments = snapshot_payload.get("sibling_departments")
        if sibling_departments:
            if self._all_departments_resolved(sibling_departments):
                return self._three_department_resolved(
                    base, sibling_departments, core_anchor_evidence, vfx_evidence, cg_evidence
                )
            return self._three_department_conflict(
                base, sibling_departments, core_anchor_evidence, vfx_evidence, cg_evidence
            )
        return self._single_task_fallback(base, core_anchor_evidence, vfx_evidence, cg_evidence)

    @staticmethod
    def _all_departments_resolved(sibling_departments: dict[str, dict[str, Any]]) -> bool:
        """Package C follow-up (downstream retranslation semantics):
        true only once all three departments' currently-confirmed
        Execution Anchor revision is their own real R2 (`revision_number
        >= 2`) -- i.e. each has actually confirmed a draft generated
        from Core Anchor R2, not merely still R1. For the canonical D1
        Journey, a department's ExecutionAnchor lineage never exceeds
        two revisions, so `revision_number >= 2` is an exact, real
        (never guessed) signal that this department's shared-ceiling
        translation has already been human-confirmed.
        """
        return all(
            info["execution_anchor_revision"]["revision_number"] >= 2
            for info in sibling_departments.values()
        )

    @staticmethod
    def _three_department_resolved(
        base: CrossRoleAssessmentOutput,
        sibling_departments: dict[str, dict[str, Any]],
        core_anchor_evidence: CrossRoleEvidenceReference,
        vfx_evidence: CrossRoleEvidenceReference,
        cg_evidence: CrossRoleEvidenceReference,
    ) -> CrossRoleAssessmentOutput:
        """Package C follow-up (downstream retranslation semantics): the
        truthful J4 counterpart to `_three_department_conflict` -- fires
        once every department has actually confirmed its own Execution
        Anchor R2, translating the confirmed Core Anchor R2's combined-
        intensity ceiling into department-specific execution boundaries
        (see `DeterministicD1ExecutionAnchorDraftGenerator`). Reads each
        department's real, now-current confirmed Execution Anchor R2
        content directly -- if that content ever changes, this output
        changes with it, same evidence-grounding discipline as
        `_three_department_conflict`.

        Deliberately never attaches a `re_anchor_proposal` (the shared
        ceiling has already been adopted, not merely proposed) and never
        raises a `priority="high"` finding (each department's own
        confirmed Execution Anchor R2 already keeps its contribution
        inside the shared ceiling) -- `derive_intent_signal` therefore
        classifies this assessment `medium`, never `high`: real,
        continued-monitoring attention, not the "human review required"
        signal a still-open conflict or proposal would raise.
        """
        department_execution_evidence: dict[str, CrossRoleEvidenceReference] = {}
        local_optimum_risks = list(base.local_optimum_risks)
        for department, label in _D1_DEPARTMENT_LABELS.items():
            info = sibling_departments[department]
            revision = info["execution_anchor_revision"]
            execution_evidence = CrossRoleEvidenceReference(
                source_type="execution_anchor_revision",
                source_id=revision["id"],
                label=f"{label} Execution Anchor revision {revision['id']}",
            )
            department_execution_evidence[department] = execution_evidence
            finding_evidence = [execution_evidence]
            review = info.get("cg_supervisor_review")
            if review is not None:
                finding_evidence.append(
                    CrossRoleEvidenceReference(
                        source_type="cg_supervisor_review",
                        source_id=review["id"],
                        label=f"{label} CG review {review['id']}",
                    )
                )
            local_optimum_risks.append(
                CrossRoleFinding(
                    summary=(f"{label}: {revision['allowed_refinements']}")[:280],
                    why_it_matters=(f"{revision['escalation_conditions']}")[:420],
                    affected_roles=["cg_supervisor", "vfx_supervisor"],
                    priority="medium",
                    evidence=finding_evidence,
                )
            )

        combined_evidence = [
            department_execution_evidence["animation"],
            department_execution_evidence["lighting"],
            department_execution_evidence["comp"],
        ]
        cross_role_tensions = [
            *base.cross_role_tensions,
            CrossRoleFinding(
                summary=(
                    "Animation, Lighting, and Compositing have each "
                    "confirmed an Execution Anchor R2 translating the confirmed Core Anchor "
                    "R2's combined-intensity ceiling into their own department-specific "
                    "boundaries; integration now reads as the confirmed restrained threat, "
                    "not spectacle."
                )[:280],
                why_it_matters=(
                    "Each department's own current confirmed content "
                    "now stays bounded by the shared combined-intensity ceiling; continued "
                    "cross-department monitoring remains appropriate."
                )[:420],
                affected_roles=["vfx_supervisor", "cg_supervisor", "artist"],
                priority="medium",
                evidence=combined_evidence,
            ),
        ]

        return base.model_copy(
            update={
                "local_optimum_risks": local_optimum_risks,
                "cross_role_tensions": cross_role_tensions,
                "re_anchor_proposal": None,
                "executive_summary": _recomputed_executive_summary(
                    cross_role_tensions=cross_role_tensions,
                    local_optimum_risks=local_optimum_risks,
                    unresolved_dependencies=base.unresolved_dependencies,
                ),
            }
        )

    @staticmethod
    def _three_department_conflict(
        base: CrossRoleAssessmentOutput,
        sibling_departments: dict[str, dict[str, Any]],
        core_anchor_evidence: CrossRoleEvidenceReference,
        vfx_evidence: CrossRoleEvidenceReference,
        cg_evidence: CrossRoleEvidenceReference,
    ) -> CrossRoleAssessmentOutput:
        department_execution_evidence: dict[str, CrossRoleEvidenceReference] = {}
        local_optimum_risks = list(base.local_optimum_risks)
        for department, label in _D1_DEPARTMENT_LABELS.items():
            info = sibling_departments[department]
            revision = info["execution_anchor_revision"]
            execution_evidence = CrossRoleEvidenceReference(
                source_type="execution_anchor_revision",
                source_id=revision["id"],
                label=f"{label} Execution Anchor revision {revision['id']}",
            )
            department_execution_evidence[department] = execution_evidence
            finding_evidence = [execution_evidence]
            review = info.get("cg_supervisor_review")
            if review is not None:
                finding_evidence.append(
                    CrossRoleEvidenceReference(
                        source_type="cg_supervisor_review",
                        source_id=review["id"],
                        label=f"{label} CG review {review['id']}",
                    )
                )
            local_optimum_risks.append(
                CrossRoleFinding(
                    summary=(f"{label}: {revision['allowed_refinements']}")[:280],
                    why_it_matters=(f"{revision['escalation_conditions']}")[:420],
                    affected_roles=["cg_supervisor", "vfx_supervisor"],
                    priority="high",
                    evidence=finding_evidence,
                )
            )

        combined_evidence = [
            department_execution_evidence["animation"],
            department_execution_evidence["lighting"],
            department_execution_evidence["comp"],
        ]
        cross_role_tensions = [
            *base.cross_role_tensions,
            CrossRoleFinding(
                summary=(
                    "Animation, Lighting, and Compositing are each "
                    "locally defensible, but combined they shift the Shot from the confirmed "
                    "Core Anchor's controlled, oppressive, restrained threat toward heroic, "
                    "theatrical spectacle."
                )[:280],
                why_it_matters=(
                    "Each department's own confirmed Execution Anchor "
                    "records a locally reasonable refinement and its own escalation condition "
                    "for combined drift; none has individually changed, but together they "
                    "approach every recorded escalation condition at once."
                )[:420],
                affected_roles=["vfx_supervisor", "cg_supervisor", "artist"],
                priority="high",
                evidence=combined_evidence,
            ),
        ]

        proposal = ReAnchorProposalOutput(
            reason_for_consideration=(
                "Animation, Lighting, and Compositing Execution "
                "Anchors each record a real, locally defensible optimisation and its own "
                "escalation condition; combined, they approach the confirmed Core Anchor's "
                "restrained-threat boundary from three directions at once."
            )[:420],
            preserved_elements=[
                "The controlled, oppressive, inevitable threat.",
                "Weight and silhouette hierarchy over spectacle.",
            ],
            proposed_fields=[
                ReAnchorFieldProposal(
                    field="constraints",
                    current_problem=(
                        "The confirmed Core Anchor names one combined "
                        "restraint constraint, without a specific combined-intensity ceiling "
                        "across Animation, Lighting, and Compositing."
                    )[:420],
                    # `proposed_direction` is the exact text
                    # `core_anchor_service._apply_proposed_field_changes`
                    # copies verbatim into the new Core Anchor R2 Draft's
                    # own Constraints when the Human VFX Supervisor
                    # clicks "Create Core Anchor R2 draft from proposal"
                    # -- real Anchor content, not an advisory aside, so
                    # it reads like the Shot's other real constraints
                    # (see `_core_content`'s own risk text).
                    proposed_direction=(
                        "Keep the combined intensity of motion acceleration, warm rim/contrast, "
                        "bloom, particles and debris below the point where restrained threat "
                        "becomes heroic or theatrical spectacle."
                    )[:420],
                    why_it_may_help=(
                        "Each department's own recorded refinement stays "
                        "within its own local boundary; a combined ceiling would let the three "
                        "be checked together against the shared restrained-threat intent, "
                        "rather than only one department at a time."
                    )[:420],
                    evidence=combined_evidence,
                )
            ],
            adoption_risks=[
                "A combined-intensity ceiling could read as restricting "
                "each department's own already-confirmed refinement, even though none has "
                "individually changed."
            ],
            questions_for_human_vfx_supervisor=[
                "Should the combined-intensity ceiling be expressed as "
                "one shared Core Anchor constraint, or as linked per-department Execution "
                "Anchor limits?"
            ],
            evidence=[
                core_anchor_evidence,
                vfx_evidence,
                cg_evidence,
                *combined_evidence,
            ],
        )

        return base.model_copy(
            update={
                "local_optimum_risks": local_optimum_risks,
                "cross_role_tensions": cross_role_tensions,
                "re_anchor_proposal": proposal,
                "executive_summary": _recomputed_executive_summary(
                    cross_role_tensions=cross_role_tensions,
                    local_optimum_risks=local_optimum_risks,
                    unresolved_dependencies=base.unresolved_dependencies,
                ),
            }
        )

    @staticmethod
    def _single_task_fallback(
        base: CrossRoleAssessmentOutput,
        core_anchor_evidence: CrossRoleEvidenceReference,
        vfx_evidence: CrossRoleEvidenceReference,
        cg_evidence: CrossRoleEvidenceReference,
    ) -> CrossRoleAssessmentOutput:
        proposal = ReAnchorProposalOutput(
            reason_for_consideration=(
                "The VFX and CG Supervisor Agent reviews both record "
                "camera-timing and contrast drift concerns that the confirmed Core Anchor's "
                "drift_risks field currently names only as one combined risk."
            ),
            preserved_elements=[
                "The restrained, internal emotional tone.",
                "That camera timing must not imply release before the climax.",
            ],
            proposed_fields=[
                ReAnchorFieldProposal(
                    field="drift_risks",
                    current_problem=(
                        "The confirmed drift_risks field names camera "
                        "timing and contrast drift together, without distinguishing which "
                        "recorded role's concern is driving the current drift."
                    ),
                    proposed_direction=(
                        "Consider naming the camera-timing risk and the "
                        "contrast-grading risk as two separately trackable drift risks."
                    ),
                    why_it_may_help=(
                        "Separating the two recorded concerns would let "
                        "each role's evidence be checked against the Core Anchor independently, "
                        "rather than through one combined risk statement."
                    ),
                    evidence=[vfx_evidence, cg_evidence],
                )
            ],
            adoption_risks=[
                "Splitting the drift risk into two entries could read as "
                "raising two problems where the underlying scene intent has not changed."
            ],
            questions_for_human_vfx_supervisor=[
                "Should camera-timing drift and contrast-grading drift "
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
    `ensure_d1_scenario`'s rich `D1_LEGACY_SHOT_EXTERNAL_ID` Shot.

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
    shot = await _resolve_or_create_shot(
        session,
        project,
        external_id=CG_DEMO_SHOT_EXTERNAL_ID,
        name=_CG_DEMO_SHOT_NAME,
    )
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


async def resolve_or_create_canonical_root(session: AsyncSession) -> tuple[Project, Shot]:
    """Minimal, non-journey-state structural bootstrap for the Package C
    canonical D1 Journey root (`demo_seed.d1_journey`). Resolves-or-
    creates only the canonical D1 Project and the canonical Shot 010 row,
    through the same `ExternalEntityLink(source="demo")` identity
    mechanism every other seeded row in this module uses.

    Deliberately creates nothing else -- no Task, Version, Core/Execution
    Anchor, Review, Guidance, Assessment, Proposal, or Signal. Those are
    exclusively owned by `d1_journey`'s own explicit Reset / Load-
    Completed actions, never by this function. This is the only sanction-
    ed way to resolve the canonical root from outside `d1_journey`
    itself; `ensure_d1_scenario`'s rich generation deliberately targets a
    separate, noncanonical Shot (see `D1_LEGACY_SHOT_EXTERNAL_ID` above)
    and must never be used for this purpose.

    Idempotent and safe to call repeatedly, including from an explicit
    developer action (Reset/Load-Completed D1 Journey) -- never from a
    normal product read path.
    """
    project = await _resolve_or_create_project(session)
    shot = await _resolve_or_create_shot(
        session,
        project,
        external_id=CANONICAL_D1_SHOT_EXTERNAL_ID,
        name=_CANONICAL_D1_SHOT_NAME,
    )
    return project, shot


async def resolve_canonical_d1_assessment_generator(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID
) -> CrossRoleAssessmentGenerator | None:
    """Package C explicit-transition fix: the sole hook
    `agents.cross_role_assessment_service.generate_cross_role_assessment`
    calls, and only when its caller did not already supply an explicit
    `generator=` override (Reset/Load-Completed always do, so this never
    runs for them).

    Returns `DeterministicD1CrossRoleAssessmentGenerator` -- the D1-
    specific generator that truthfully represents the locked Animation +
    Lighting + Compositing local-optimum conflict -- whenever
    `project_id`/`shot_id` are exactly the canonical Package C D1
    Journey identity, matched by real `ExternalEntityLink(source=
    "demo")` rows -- never by Project/Shot display name.

    Deliberately **not** gated on the ambient configured model provider
    (`model_gateway.resolve_provider_name()`): canonical D1 is a
    reproducible demo fixture whose locked J0 -> J1 transition must be
    deterministic regardless of whatever provider a given environment
    happens to have configured (an owner's local `.env` set to
    "deepseek" previously fell through to a real, non-deterministic
    network call here and could fail outright -- see
    ICAS_PACKAGE_C_JOURNEY_REBASE_CLAUDE_HANDOFF.md). This is not a
    global fallback: it only ever fires for this one exact Shot/Project
    identity, so every noncanonical Shot -- including any real ftrack/
    live Shot, which can never carry this `source="demo"` identity --
    keeps using whatever provider is actually configured, completely
    unaffected.

    Returns `None` for every other Project/Shot, in which case the
    caller falls back to its own generic generator resolution unchanged.
    This function never creates, mutates, or reads anything beyond the
    two `ExternalEntityLink` lookups already used everywhere else in
    this module: no Assessment, Anchor, Draft, or Signal is created
    here -- it only *selects* which already-existing, already-validated
    generator `generate_cross_role_assessment` goes on to run and
    persist through its own real, unbypassed pipeline.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None
    return DeterministicD1CrossRoleAssessmentGenerator()


async def resolve_canonical_d1_sibling_department_evidence(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID
) -> dict[str, dict[str, Any]] | None:
    """Package C content-fidelity fix (owner re-validation correction):
    the canonical Cross-role Assessment stays formally attached to one
    Version/Task (the Compositing integration Version, matching the
    existing single-Version/Task schema), but a truthful three-
    department local-optimum conflict requires real evidence from
    Animation and Lighting too -- evidence the standard single-Task
    `generate_cross_role_assessment` snapshot never includes.

    Returns a `{department: {...}}` mapping (each department's real,
    currently-confirmed `ExecutionAnchorRevision` content plus its
    newest `CGSupervisorReview`, if one exists) only for the exact
    canonical Package C D1 Journey identity -- matched by the same
    `ExternalEntityLink(source="demo")` rows `resolve_canonical_d1_
    assessment_generator` checks, never by display name -- and only when
    all three canonical Tasks each already have a confirmed Execution
    Anchor revision (true for any legal J0-J4 state; if the graph is
    mid-transition or otherwise incomplete, returns `None` rather than a
    partial, potentially misleading mapping).

    Returns `None` for every other Project/Shot, including the
    noncanonical legacy D1 fixture Shot this same module's `ensure_
    d1_scenario` seeds (which has only one Task) -- the caller then
    leaves the standard snapshot payload untouched.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None

    departments: dict[str, dict[str, Any]] = {}
    for department, external_id in (
        ("animation", _CANONICAL_ANIMATION_TASK_EXTERNAL_ID),
        ("lighting", _CANONICAL_LIGHTING_TASK_EXTERNAL_ID),
        ("comp", _CANONICAL_COMPOSITING_TASK_EXTERNAL_ID),
    ):
        task_id = await find_linked_entity_id(
            session, entity_type="task", source=_DEMO_SOURCE, external_id=external_id
        )
        if task_id is None:
            return None
        task = await session.get(Task, task_id)
        if task is None or task.shot_id != shot_id:
            return None
        execution_anchor = await session.scalar(
            select(ExecutionAnchor).where(ExecutionAnchor.task_id == task_id)
        )
        if execution_anchor is None or execution_anchor.active_revision_id is None:
            return None
        execution_revision = await session.get(
            ExecutionAnchorRevision, execution_anchor.active_revision_id
        )
        if execution_revision is None or execution_revision.status != "confirmed":
            return None
        cg_review = await session.scalar(
            select(CGSupervisorReview)
            .where(CGSupervisorReview.execution_anchor_revision_id == execution_revision.id)
            .order_by(CGSupervisorReview.created_at.desc())
            .limit(1)
        )
        departments[department] = {
            "task": {"id": str(task.id), "name": task.name, "department": task.department},
            "execution_anchor_revision": {
                "id": str(execution_revision.id),
                "revision_number": execution_revision.revision_number,
                "allowed_refinements": execution_revision.allowed_refinements,
                "escalation_conditions": execution_revision.escalation_conditions,
                "technical_boundaries": execution_revision.technical_boundaries,
            },
            "cg_supervisor_review": (
                {
                    "id": str(cg_review.id),
                    "executive_summary": cg_review.review_output["executive_summary"],
                }
                if cg_review is not None
                else None
            ),
        }
    return departments


_D1_EXECUTION_R2_CONTRIBUTIONS: Final = {
    "animation": "faster motion, acceleration, impact timing, and stronger poses",
    "lighting": "warm rim intensity, contrast, and impact accents",
    "comp": "bloom, particles, debris, and saturation",
}
_D1_EXECUTION_R2_OTHER_DEPARTMENTS: Final = {
    "animation": "Lighting and Compositing",
    "lighting": "Animation and Compositing",
    "comp": "Animation and Lighting",
}
_D1_EXECUTION_R2_SPECTACLE_TERMS: Final = {
    "animation": "heroic or theatrical spectacle",
    "lighting": "triumphant or theatrical spectacle",
    "comp": "spectacle",
}


class DeterministicD1ExecutionAnchorDraftGenerator:
    """Package C follow-up (downstream retranslation semantics): the
    D1-Demo-only generator behind the real "Generate Execution Anchor
    R{n+1} draft from Core Anchor R{n}" action
    (`agents.cg_agent_service.generate_execution_anchor_draft`),
    injected only for the canonical Package C D1 Journey's three Tasks
    -- see `resolve_canonical_d1_execution_generator` for the exact
    identity gate and why this is not gated on the ambient configured
    model provider either (same rationale as `resolve_canonical_d1_
    assessment_generator`).

    Translates the confirmed Core Anchor's own structured Constraint
    text -- injected into `snapshot_payload["core_anchor"]["constraints"]`
    only for this same canonical identity by `resolve_canonical_d1_
    core_constraints` -- into this one Task's department-specific
    execution boundaries: each department owns its own slice of the
    shared combined-intensity ceiling (Animation: faster motion,
    acceleration, impact timing, and stronger poses; Lighting: warm rim
    intensity, contrast, and impact accents; Compositing: bloom,
    particles, debris, and saturation), must not raise its own
    contribution independently of what the other two departments are
    already contributing, and escalates specifically when the combined
    three-department intensity risks turning the confirmed restrained
    threat into spectacle. Every field below cites the real confirmed
    Core Anchor constraint text (falling back to `core_summary` only if
    no Constraint exists yet) rather than a fixed UI-layer string -- if
    the canonical D1 Core Anchor's own confirmed constraint text ever
    changes, this generator's output changes with it.
    """

    def __init__(self, *, department: str) -> None:
        self._department = department

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ExecutionAnchorRevisionDraftCreate:
        core = snapshot_payload["core_anchor"]
        constraints = core.get("constraints") or []
        constraint_text = constraints[0] if constraints else core["core_summary"]

        department = self._department
        own = _D1_EXECUTION_R2_CONTRIBUTIONS[department]
        other = _D1_EXECUTION_R2_OTHER_DEPARTMENTS[department]
        spectacle = _D1_EXECUTION_R2_SPECTACLE_TERMS[department]
        dept_label = _D1_DEPARTMENT_LABELS[department]

        if department == "animation":
            delivery_conditions = (
                f"Controlled pauses and silhouette weight remain primary; {own} may "
                "read as more confident, never as a release into spectacle."
            )
        else:
            delivery_conditions = (
                f"{own[0].upper()}{own[1:]} may read as more confident, never as a "
                f"release into spectacle; coordinate timing directly with {other}'s current "
                "contributions."
            )

        if department == "comp":
            downstream_dependencies = (
                f"Compositing integration coordinates {other}'s current confirmed "
                "contributions, keeping the combined result inside the shared "
                "combined-intensity ceiling."
            )
        else:
            downstream_dependencies = (
                f"Compositing integration depends on {dept_label}'s {own} contribution "
                f"staying inside the shared combined-intensity ceiling alongside {other}."
            )

        return ExecutionAnchorRevisionDraftCreate(
            technical_boundaries=(
                f"{dept_label} owns the {own} contribution to the confirmed Core "
                f'Anchor\'s combined-intensity ceiling: "{constraint_text}". {own[0].upper()}'
                f"{own[1:]} may not be increased independently of what {other} are already "
                "contributing."
            ),
            parameter_ranges=(
                f"{own[0].upper()}{own[1:]} stay within {dept_label}'s own confirmed "
                f"local range, and must not rise further whenever {other} are already raising "
                "visual intensity toward the shared combined-intensity ceiling."
            ),
            delivery_conditions=delivery_conditions,
            production_ready_criteria=(
                f"Production-ready only when {dept_label}'s own intensity contribution, "
                f"combined with {other}'s current contributions, still reads as restrained "
                "threat rather than spectacle."
            ),
            downstream_dependencies=downstream_dependencies,
            publish_requirements=("Human CG Supervisor confirmation is required before publish."),
            allowed_refinements=(
                f"Local refinements to {dept_label}'s own {own}, within its own "
                f"confirmed range, coordinated against {other}'s current confirmed "
                "contributions."
            ),
            escalation_conditions=(
                f"Escalate to the VFX Supervisor if the combined Animation + Lighting "
                f"+ Compositing intensity risks turning the confirmed restrained threat into "
                f"{spectacle}."
            ),
        )


async def resolve_canonical_d1_execution_generator(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID, task_id: uuid.UUID
) -> ExecutionAnchorDraftGenerator | None:
    """Package C follow-up (downstream retranslation semantics): the
    sole hook `agents.cg_agent_service.generate_execution_anchor_draft`
    calls, and only when its caller did not already supply an explicit
    `generator=` override (never true for canonical D1 -- Execution R1
    is seeded directly by `d1_journey._anchors`, never through this
    Agent endpoint, so this always runs the first time the real
    "Generate Execution Anchor draft" action is used against a
    canonical D1 Task).

    Returns `DeterministicD1ExecutionAnchorDraftGenerator`, scoped to
    whichever of the three canonical departments `task_id` resolves to,
    whenever `project_id`/`shot_id`/`task_id` are exactly the canonical
    Package C D1 Journey identity -- matched by real
    `ExternalEntityLink(source="demo")` rows, never by Task name.

    Deliberately **not** gated on the ambient configured model provider
    (`model_gateway.resolve_provider_name()`), for exactly the same
    reason `resolve_canonical_d1_assessment_generator` is not: this
    Task's real "Generate Execution Anchor R{n+1} draft from Core
    Anchor R{n}" action is the locked J3 downstream-retranslation step
    of a reproducible demo journey, which must reliably translate the
    confirmed Core Anchor R2's combined-intensity ceiling regardless of
    whatever provider a given environment happens to have configured.
    This is not a global fallback: it only ever fires for these three
    exact Task identities under the one exact canonical Shot/Project,
    so every noncanonical Task -- including any real ftrack/live Task,
    which can never carry this `source="demo"` identity -- keeps using
    whatever provider is actually configured, completely unaffected.

    Returns `None` for every other Project/Shot/Task, in which case the
    caller falls back to its own generic generator resolution unchanged.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None
    for department, external_id in (
        ("animation", _CANONICAL_ANIMATION_TASK_EXTERNAL_ID),
        ("lighting", _CANONICAL_LIGHTING_TASK_EXTERNAL_ID),
        ("comp", _CANONICAL_COMPOSITING_TASK_EXTERNAL_ID),
    ):
        canonical_task_id = await find_linked_entity_id(
            session, entity_type="task", source=_DEMO_SOURCE, external_id=external_id
        )
        if canonical_task_id == task_id:
            return DeterministicD1ExecutionAnchorDraftGenerator(department=department)
    return None


async def resolve_canonical_d1_core_constraints(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID
) -> list[str] | None:
    """Package C follow-up (downstream retranslation semantics): the
    Shot's currently confirmed Core Anchor revision's own real
    Constraint rows' content, in `order_index` order -- the "actual
    confirmed Core R2 structured constraint"
    `DeterministicD1ExecutionAnchorDraftGenerator` cites as its source
    evidence, rather than a fixed UI-layer string. Returns `None`
    (never an empty list standing in for "no constraints exist") for
    every Project/Shot other than the exact canonical Package C D1
    Journey identity, or if that Shot currently has no confirmed Core
    Anchor revision at all.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None

    core_anchor = await session.scalar(select(CoreAnchor).where(CoreAnchor.shot_id == shot_id))
    if core_anchor is None or core_anchor.active_revision_id is None:
        return None
    rows = (
        await session.scalars(
            select(Constraint)
            .where(Constraint.core_anchor_revision_id == core_anchor.active_revision_id)
            .order_by(Constraint.order_index)
        )
    ).all()
    return [row.content for row in rows]


class DeterministicD1CGSupervisorReviewGenerator:
    """Package C follow-up (owner-runtime DeepSeek `finish_reason=
    'length'` failure): the D1-Demo-only generator behind the real
    "Generate CG Supervisor Review" action
    (`agents.cg_supervisor_review_service.generate_cg_supervisor_review`),
    injected only for the canonical Package C D1 Journey's three Tasks
    -- see `resolve_canonical_d1_cg_review_generator` for the exact
    identity gate and why this is not gated on the ambient configured
    model provider either (same rationale as `resolve_canonical_d1_
    assessment_generator`/`resolve_canonical_d1_execution_generator`).

    Delegates every field to the real, unmodified
    `DeterministicCGSupervisorReviewGenerator`. Only once the target
    Execution Anchor revision under review is itself a real R2
    (`revision_number >= 2`, translating the confirmed Core R2's
    combined-intensity ceiling per `DeterministicD1
    ExecutionAnchorDraftGenerator`) does this override `executive_
    summary` and `execution_direction_read` with a truthful compliance
    read: does the confirmed Execution R2's own real content (`allowed_
    refinements`/`escalation_conditions`/`technical_boundaries`,
    already present in the snapshot payload) stay within this
    department's own role-specific contribution to the ceiling. R1-era
    reviews (`revision_number == 1`, no ceiling exists yet) are
    returned unchanged from the base generator -- nothing here invents
    an R2 concept for R1 evidence. Every field is a live read of the
    real payload content -- if the canonical D1 Execution Anchor or
    Core Anchor text ever changes, this generator's output changes
    with it; nothing here is a fixed UI-layer string substitute.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> CGSupervisorReviewOutput:
        base = DeterministicCGSupervisorReviewGenerator().generate(
            snapshot_payload=snapshot_payload
        )

        target_revision = snapshot_payload["execution_anchor"]["target_revision"]
        if target_revision["revision_number"] < 2:
            return base

        task = snapshot_payload["task"]
        department = task.get("department") or "comp"
        dept_label = _D1_DEPARTMENT_LABELS.get(department, task["name"])

        boundary_text = (
            target_revision.get("allowed_refinements")
            or target_revision.get("technical_boundaries")
            or ""
        )
        escalation_text = target_revision.get("escalation_conditions") or ""

        executive_summary = (
            f"{dept_label}'s confirmed Execution Anchor R"
            f"{target_revision['revision_number']} stays within its own role-specific "
            f"contribution to the confirmed Core Anchor's combined-intensity ceiling: "
            f"{boundary_text}"
        )[:700]

        execution_direction_read = CGReviewItem(
            summary=(
                f"{dept_label} Execution Anchor R{target_revision['revision_number']} "
                "confirmed compliant with the combined-intensity ceiling."
            )[:280],
            rationale=(
                escalation_text
                if escalation_text
                else "No escalation condition is recorded on this revision."
            )[:420],
            priority="high",
            evidence=[
                CGReviewEvidenceReference(
                    source_type="execution_anchor_revision",
                    source_id=target_revision["id"],
                    label=f"{dept_label} Execution Anchor revision {target_revision['id']}",
                )
            ],
        )

        return base.model_copy(
            update={
                "executive_summary": executive_summary,
                "execution_direction_read": execution_direction_read,
            }
        )


async def resolve_canonical_d1_cg_review_generator(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID, task_id: uuid.UUID
) -> CGSupervisorReviewGenerator | None:
    """Package C follow-up (owner-runtime DeepSeek `finish_reason=
    'length'` failure): the sole hook `agents.cg_supervisor_review_
    service.generate_cg_supervisor_review` calls, and only when its
    caller did not already supply an explicit `generator=` override
    (Reset/Load-Completed always do, so this never runs for them --
    only the real "Generate CG Supervisor Review" endpoint, with no
    override, ever reaches this).

    Returns `DeterministicD1CGSupervisorReviewGenerator` whenever
    `project_id`/`shot_id`/`task_id` are exactly the canonical Package
    C D1 Journey identity -- matched by real `ExternalEntityLink(
    source="demo")` rows, never by Task name.

    Deliberately **not** gated on the ambient configured model provider
    (`model_gateway.resolve_provider_name()`), for exactly the same
    reason `resolve_canonical_d1_assessment_generator`/`resolve_
    canonical_d1_execution_generator` are not: this Task's real
    "Generate CG Supervisor Review" action is a locked step of a
    reproducible demo journey, which must reliably succeed regardless
    of whatever provider a given environment happens to have configured
    (an owner's local `.env` set to "deepseek" hit a real DeepSeek
    structured-output failure here -- `finish_reason='length'` --
    exactly the class of bug already fixed for Cross-role Assessment
    and Execution Anchor Draft generation). This is not a global
    fallback: it only ever fires for these three exact Task identities
    under the one exact canonical Shot/Project, so every noncanonical
    Task -- including any real ftrack/live Task, which can never carry
    this `source="demo"` identity -- keeps using whatever provider is
    actually configured, completely unaffected.

    Returns `None` for every other Project/Shot/Task, in which case the
    caller falls back to its own generic generator resolution unchanged.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None
    for external_id in (
        _CANONICAL_ANIMATION_TASK_EXTERNAL_ID,
        _CANONICAL_LIGHTING_TASK_EXTERNAL_ID,
        _CANONICAL_COMPOSITING_TASK_EXTERNAL_ID,
    ):
        canonical_task_id = await find_linked_entity_id(
            session, entity_type="task", source=_DEMO_SOURCE, external_id=external_id
        )
        if canonical_task_id == task_id:
            return DeterministicD1CGSupervisorReviewGenerator()
    return None


class DeterministicD1ArtistGuidanceGenerator:
    """Package C follow-up (owner-flow generator audit): the D1-Demo-
    only generator behind the real "Generate Guidance" action
    (`agents.artist_guidance_service.generate_artist_agent_guidance`),
    injected only for the canonical Package C D1 Journey's three Tasks
    -- see `resolve_canonical_d1_artist_guidance_generator` for the
    exact identity gate and why this is not gated on the ambient
    configured model provider either (same rationale as every other
    canonical D1 dispatch in this module).

    Delegates every field to the real, unmodified
    `DeterministicArtistGuidanceGenerator`. Only once the target
    Execution Anchor revision this Guidance is generated against is
    itself a real R2 (`revision_number >= 2`) does this override
    `executive_summary` and `task_goal` with a truthful department-
    specific combined-intensity-boundary read, citing the confirmed
    Execution R2's own real content (already present in the snapshot
    payload). R1-era Guidance (`revision_number == 1`, no ceiling
    exists yet) is returned unchanged from the base generator, and --
    because ArtistAgentGuidance rows are immutable and append-only --
    stays preserved as real history once R2 Guidance is generated.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> ArtistAgentGuidanceOutput:
        base = DeterministicArtistGuidanceGenerator().generate(snapshot_payload=snapshot_payload)

        target_revision = snapshot_payload["execution_anchor"]["target_revision"]
        if target_revision["revision_number"] < 2:
            return base

        task = snapshot_payload["task"]
        version = snapshot_payload["version"]
        department = task.get("department") or "comp"
        dept_label = _D1_DEPARTMENT_LABELS.get(department, task["name"])

        boundary_text = (
            target_revision.get("allowed_refinements")
            or target_revision.get("technical_boundaries")
            or ""
        )

        executive_summary = (
            f"{dept_label}'s resolved Version {version['name']} reflects the "
            f"confirmed Execution Anchor R{target_revision['revision_number']}'s own "
            f"department-specific contribution to the confirmed Core Anchor's "
            f"combined-intensity ceiling."
        )[:400]

        task_goal = ArtistGuidanceItem(
            summary=(
                f"{dept_label} R{target_revision['revision_number']} boundary: {boundary_text}"
            )[:200],
            why_it_matters=(
                "This is the confirmed Execution Anchor R2 revision for this "
                "Task, translating the shared combined-intensity ceiling into this "
                "department's own contribution."
            )[:240],
            priority="high",
            evidence=[
                ArtistEvidenceReference(
                    source_type="execution_anchor_revision",
                    source_id=target_revision["id"],
                    label=f"{dept_label} Execution Anchor revision {target_revision['id']}",
                )
            ],
        )

        return base.model_copy(
            update={"executive_summary": executive_summary, "task_goal": task_goal}
        )


async def resolve_canonical_d1_artist_guidance_generator(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID, task_id: uuid.UUID
) -> ArtistGuidanceGenerator | None:
    """Package C follow-up (owner-flow generator audit): the sole hook
    `agents.artist_guidance_service.generate_artist_agent_guidance`
    calls, and only when its caller did not already supply an explicit
    `generator=` override (Reset/Load-Completed always do, so this
    never runs for them).

    Returns `DeterministicD1ArtistGuidanceGenerator` whenever
    `project_id`/`shot_id`/`task_id` are exactly the canonical Package
    C D1 Journey identity -- matched by real `ExternalEntityLink(
    source="demo")` rows, never by Task name.

    Deliberately **not** gated on the ambient configured model provider,
    for exactly the same reason every other canonical D1 dispatch in
    this module is not: real "Generate Guidance" actions against the
    canonical D1 Journey must reliably succeed regardless of whatever
    provider a given environment happens to have configured. This is
    not a global fallback: it only ever fires for these three exact
    Task identities under the one exact canonical Shot/Project, so
    every noncanonical Task -- including any real ftrack/live Task --
    keeps using whatever provider is actually configured, completely
    unaffected.

    Returns `None` for every other Project/Shot/Task, in which case the
    caller falls back to its own generic generator resolution unchanged.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None
    for external_id in (
        _CANONICAL_ANIMATION_TASK_EXTERNAL_ID,
        _CANONICAL_LIGHTING_TASK_EXTERNAL_ID,
        _CANONICAL_COMPOSITING_TASK_EXTERNAL_ID,
    ):
        canonical_task_id = await find_linked_entity_id(
            session, entity_type="task", source=_DEMO_SOURCE, external_id=external_id
        )
        if canonical_task_id == task_id:
            return DeterministicD1ArtistGuidanceGenerator()
    return None


class DeterministicD1VFXSupervisorReviewGenerator:
    """Package C follow-up (owner-flow generator audit): the D1-Demo-
    only generator behind the real "Generate Creative Review" action
    (`agents.vfx_supervisor_review_service.generate_vfx_supervisor_review`),
    injected only for the canonical Package C D1 Journey's Shot -- see
    `resolve_canonical_d1_vfx_review_generator`. Not Task-scoped (a VFX
    Creative Review reviews one Version against the confirmed Core
    Anchor only, never a specific Task's Execution Anchor), so the
    identity gate here is Project/Shot only, matching `resolve_
    canonical_d1_assessment_generator`'s own gate shape.

    Delegates every field to the real, unmodified `Deterministic
    VFXSupervisorReviewGenerator`. Only once the reviewed Version is
    itself a real resolved Version (`version_number >= 2`, the same
    numbering convention every resolved-Version-publish action uses --
    see `versions_and_feedback.service.create_version` callers) does
    this override `executive_summary` and `creative_direction_read`
    with a truthful restrained-vs-spectacle integration read, citing
    the confirmed Core Anchor's own real constraint text. A still-R1-
    era Version (`version_number < 2`, or no confirmed Core Anchor
    Constraint recorded yet) is returned unchanged from the base
    generator.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> VFXSupervisorReviewOutput:
        base = DeterministicVFXSupervisorReviewGenerator().generate(
            snapshot_payload=snapshot_payload
        )

        version = snapshot_payload["version"]
        if (version.get("version_number") or 0) < 2:
            return base

        core_anchor = snapshot_payload["core_anchor"]
        confirmed_revision = core_anchor["confirmed_revision"] if core_anchor is not None else None
        if confirmed_revision is None:
            return base
        constraints = confirmed_revision.get("constraints")
        if not constraints:
            return base

        constraint_text = constraints[0]["content"]

        executive_summary = (
            f"{version['name']} integrates Animation, Lighting, and Compositing's "
            "confirmed Execution R2 contributions; the combined result reads as restrained "
            "and controlled, not heroic, theatrical, or spectacle, honoring the confirmed "
            f"Core Anchor's combined-intensity ceiling: {constraint_text}"
        )

        creative_direction_read = VFXReviewItem(
            summary=(
                f"Review {version['name']} against the confirmed Core Anchor "
                f"revision #{confirmed_revision['revision_number']}'s combined-intensity "
                "ceiling, integrating all three departments' confirmed Execution R2 "
                "contributions."
            ),
            rationale=(
                "This is the Shot's currently confirmed Core Anchor revision, and "
                f"{version['name']} is a resolved Version responding to it."
            ),
            priority="high",
            evidence=[
                VFXReviewEvidenceReference(
                    source_type="core_anchor_revision",
                    source_id=confirmed_revision["id"],
                    label=f"Confirmed Core Anchor revision {confirmed_revision['id']}",
                )
            ],
        )

        return base.model_copy(
            update={
                "executive_summary": executive_summary,
                "creative_direction_read": creative_direction_read,
            }
        )


async def resolve_canonical_d1_vfx_review_generator(
    session: AsyncSession, *, project_id: uuid.UUID, shot_id: uuid.UUID
) -> VFXSupervisorReviewGenerator | None:
    """Package C follow-up (owner-flow generator audit): the sole hook
    `agents.vfx_supervisor_review_service.generate_vfx_supervisor_review`
    calls, and only when its caller did not already supply an explicit
    `generator=` override.

    Returns `DeterministicD1VFXSupervisorReviewGenerator` whenever
    `project_id`/`shot_id` are exactly the canonical Package C D1
    Journey identity -- matched by real `ExternalEntityLink(source=
    "demo")` rows, never by Shot name. Deliberately **not** gated on
    the ambient configured model provider, for exactly the same reason
    every other canonical D1 dispatch in this module is not.

    Returns `None` for every other Project/Shot, in which case the
    caller falls back to its own generic generator resolution unchanged.
    """
    canonical_project_id = await find_linked_entity_id(
        session, entity_type="project", source=_DEMO_SOURCE, external_id=D1_PROJECT_EXTERNAL_ID
    )
    if canonical_project_id != project_id:
        return None
    canonical_shot_id = await find_linked_entity_id(
        session, entity_type="shot", source=_DEMO_SOURCE, external_id=CANONICAL_D1_SHOT_EXTERNAL_ID
    )
    if canonical_shot_id != shot_id:
        return None
    return DeterministicD1VFXSupervisorReviewGenerator()


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
    cg_demo_task, cg_demo_dependency = await _ensure_cg_demo_task(session, project)

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
