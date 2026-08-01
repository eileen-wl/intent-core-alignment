"""Shot Activity read-model service (Step 7C-3).

Composes real, already-persisted Core Anchor / Decision / Version /
Review Note / Cross-role Assessment / Re-anchor Proposal /
ExternalEntityLink rows into one chronological timeline per Shot -- no
new table, no mutation logic, no fabricated entry (docs/step-7 §7's "do
not create a second competing source of truth"). Every event's
``occurred_at`` is a real column value already written by the service
that created the underlying row.

Deliberately excludes the separate, simpler ``AlignmentAssessment``
(Step 4b) accept/reject Decision chain: the VFX workspace (current_focus,
vfx_inbox, and this Activity timeline alike) already treats
``CrossRoleAssessment`` as the one canonical assessment concept, and
folding in a second, parallel assessment lineage would contradict that.
"""

from __future__ import annotations

import uuid

from intent_core_contracts.api.activity import ShotActivityEventRead, ShotActivityRead
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import cross_role_assessment_service
from intent_core_api.integrations.models import ExternalEntityLink
from intent_core_api.intent import core_anchor_service
from intent_core_api.versions_and_feedback import service as versions_and_feedback_service
from intent_core_api.workflow import decision_service
from intent_core_api.workflow.models import Decision


def _intent_route(shot_id: uuid.UUID) -> str:
    return f"/vfx/shots/{shot_id}/intent"


def _versions_route(shot_id: uuid.UUID) -> str:
    return f"/vfx/shots/{shot_id}/versions"


def _alignment_route(shot_id: uuid.UUID) -> str:
    return f"/vfx/shots/{shot_id}/alignment"


def _shot_route(shot_id: uuid.UUID) -> str:
    return f"/vfx/shots/{shot_id}"


# Every Decision this service currently produces an event for is one of
# these two Core Anchor lifecycle types (see workflow.decision_service
# call sites in intent.core_anchor_service). A future decision_type not
# in this map still produces an honest, generic "Human Decision
# recorded" event rather than raising or being silently dropped.
_CORE_ANCHOR_DECISION_EVENT_TYPE = {
    "confirm_core_anchor": "core_anchor_confirmed",
    "reject_core_anchor": "core_anchor_draft_discarded",
}
_CORE_ANCHOR_DECISION_SUMMARY_VERB = {
    "confirm_core_anchor": "confirmed",
    "reject_core_anchor": "discarded the draft for",
}


def _decision_event(
    decision: Decision, revision_number: int, shot_id: uuid.UUID
) -> ShotActivityEventRead:
    event_type = _CORE_ANCHOR_DECISION_EVENT_TYPE.get(
        decision.decision_type, "core_anchor_confirmed"
    )
    verb = _CORE_ANCHOR_DECISION_SUMMARY_VERB.get(
        decision.decision_type, f"recorded a {decision.decision_type} decision on"
    )
    role_label = decision.actor_human_role or "Supervisor"
    return ShotActivityEventRead(
        id=f"decision:{decision.id}",
        event_type=event_type,  # type: ignore[arg-type]
        occurred_at=decision.created_at,
        actor_kind=decision.actor_kind,  # type: ignore[arg-type]
        actor_id=decision.actor_id,
        actor_human_role=decision.actor_human_role,  # type: ignore[arg-type]
        summary=f"Human {role_label} {verb} Revision {revision_number}",
        related_entity_type="decision",
        related_entity_id=decision.id,
        route=_intent_route(shot_id),
    )


def _human_decision_recorded_event(
    decision: Decision, revision_number: int, shot_id: uuid.UUID
) -> ShotActivityEventRead:
    """The Decision's own event -- always emitted alongside
    `_decision_event`'s Core-Anchor-lifecycle event for the same
    `Decision` row, never in place of it (docs/step-7 completion pass:
    "Core Anchor confirmed" is not a substitute for the Decision event).
    A distinct, stable id (`decision_recorded:` prefix, vs. `_decision_event`'s
    `decision:` prefix) keeps the two from colliding in the timeline.
    """
    role_label = decision.actor_human_role or "Supervisor"
    decision_label = decision.decision_type.replace("_", " ")
    return ShotActivityEventRead(
        id=f"decision_recorded:{decision.id}",
        event_type="human_decision_recorded",
        occurred_at=decision.created_at,
        actor_kind=decision.actor_kind,  # type: ignore[arg-type]
        actor_id=decision.actor_id,
        actor_human_role=decision.actor_human_role,  # type: ignore[arg-type]
        summary=(
            f"Decision recorded: Human {role_label} {decision_label} (Revision {revision_number})"
        ),
        related_entity_type="decision",
        related_entity_id=decision.id,
        route=_intent_route(shot_id),
    )


async def build_shot_activity(session: AsyncSession, shot_id: uuid.UUID) -> ShotActivityRead:
    events: list[ShotActivityEventRead] = []

    revisions = await core_anchor_service.list_revisions_for_shot(session, shot_id)
    for revision in revisions:
        events.append(
            ShotActivityEventRead(
                id=f"core_anchor_revision_created:{revision.id}",
                event_type="core_anchor_draft_created",
                occurred_at=revision.created_at,
                actor_kind=revision.created_by_actor_kind,  # type: ignore[arg-type]
                actor_id=revision.created_by_actor_id,
                actor_human_role=revision.created_by_human_role,  # type: ignore[arg-type]
                summary=f"Revision {revision.revision_number} draft created",
                related_entity_type="core_anchor_revision",
                related_entity_id=revision.id,
                route=_intent_route(shot_id),
            )
        )
        if revision.updated_at > revision.created_at:
            events.append(
                ShotActivityEventRead(
                    id=f"core_anchor_revision_updated:{revision.id}",
                    event_type="core_anchor_draft_updated",
                    occurred_at=revision.updated_at,
                    actor_kind=None,
                    actor_id=None,
                    actor_human_role=None,
                    summary=f"Revision {revision.revision_number} draft saved",
                    related_entity_type="core_anchor_revision",
                    related_entity_id=revision.id,
                    route=_intent_route(shot_id),
                )
            )

        decisions = await decision_service.list_decisions_for_entity(
            session, "core_anchor_revision", revision.id
        )
        for decision in decisions:
            events.append(_decision_event(decision, revision.revision_number, shot_id))
            events.append(
                _human_decision_recorded_event(decision, revision.revision_number, shot_id)
            )

    versions = await versions_and_feedback_service.list_versions_for_shot(session, shot_id)
    for version in versions:
        events.append(
            ShotActivityEventRead(
                id=f"version_recorded:{version.id}",
                event_type="production_version_recorded",
                occurred_at=version.created_at,
                actor_kind=version.created_by_actor_kind,  # type: ignore[arg-type]
                actor_id=version.created_by_actor_id,
                actor_human_role=version.created_by_human_role,  # type: ignore[arg-type]
                summary=f'Production Version "{version.name}" recorded',
                related_entity_type="version",
                related_entity_id=version.id,
                route=_versions_route(shot_id),
            )
        )

        notes = await versions_and_feedback_service.list_review_notes_for_version(
            session, version.id
        )
        for note in notes:
            events.append(
                ShotActivityEventRead(
                    id=f"review_note_recorded:{note.id}",
                    event_type="review_note_recorded",
                    occurred_at=note.created_at,
                    actor_kind=note.created_by_actor_kind,  # type: ignore[arg-type]
                    actor_id=note.created_by_actor_id,
                    actor_human_role=note.created_by_human_role,  # type: ignore[arg-type]
                    summary=f'Review Note recorded on "{version.name}"',
                    related_entity_type="review_note",
                    related_entity_id=note.id,
                    route=_versions_route(shot_id),
                )
            )

    assessments = await cross_role_assessment_service.list_cross_role_assessments_for_shot(
        session, shot_id
    )
    for assessment in assessments:
        events.append(
            ShotActivityEventRead(
                id=f"assessment_created:{assessment.id}",
                event_type="alignment_assessment_created",
                occurred_at=assessment.created_at,
                actor_kind="agent",
                actor_id=None,
                actor_human_role=None,
                summary="Cross-role Assessment generated",
                related_entity_type="cross_role_assessment",
                related_entity_id=assessment.id,
                route=_alignment_route(shot_id),
            )
        )

        proposal = getattr(assessment, "re_anchor_proposal", None)
        if proposal is not None:
            events.append(
                ShotActivityEventRead(
                    id=f"proposal_generated:{proposal.id}",
                    event_type="re_anchor_proposal_generated",
                    occurred_at=proposal.created_at,
                    actor_kind="agent",
                    actor_id=None,
                    actor_human_role=None,
                    summary="Re-anchor Proposal generated",
                    related_entity_type="re_anchor_proposal",
                    related_entity_id=proposal.id,
                    route=_alignment_route(shot_id),
                )
            )

    link = await session.scalar(
        select(ExternalEntityLink).where(
            ExternalEntityLink.entity_type == "shot",
            ExternalEntityLink.entity_id == shot_id,
        )
    )
    if link is not None:
        events.append(
            ShotActivityEventRead(
                id=f"external_link:{link.id}",
                event_type="external_link_recorded",
                occurred_at=link.created_at,
                actor_kind="system",
                actor_id=None,
                actor_human_role=None,
                summary=f"Linked to {link.source} entity {link.external_id}",
                related_entity_type="shot",
                related_entity_id=shot_id,
                route=_shot_route(shot_id),
            )
        )

    events.sort(key=lambda event: event.occurred_at, reverse=True)
    return ShotActivityRead(shot_id=shot_id, events=events)
