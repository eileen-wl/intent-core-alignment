"""Core Agent: the Alignment Assessment capability (Step 4b) -- an
advisory, human-gated judgement of how well a Version (its description
plus its Review Notes) aligns with the Shot's currently *confirmed*
Core Anchor revision.

Mirrors ``agents.core_agent_service``'s exact shape: a
``ContextSnapshot``/``AgentRun`` pair (reused, unmodified, from
WP-B1.5), a ``Protocol`` + deterministic-adapter seam for the model
provider, and a single service function that owns the full
snapshot -> run -> generate -> persist -> finalize flow. Unlike B1, this
slice also ships a first *real* model-backed adapter
(``DeepSeekAlignmentAssessmentGenerator``) alongside the deterministic
one, since Step 4b explicitly calls for a minimal, real, non-streaming
structured-output call. See ADR-0013 for why DeepSeek rather than
Anthropic: the real-account billing needed to exercise a real Anthropic
call could not be completed before this was implemented.

This capability is purely advisory: it never mutates the Core Anchor or
any Execution Anchor, and it produces no Decision (Decision supersession
is Step 4c). ``AlignmentAssessmentOutput.requires_human_gate`` is
enforced to always be ``True`` at the contract level.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Final, Protocol

from intent_core_contracts.api.alignment_assessment import AlignmentAssessmentOutput
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents import model_gateway, prompt_registry
from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.agents.runtime import AgentExecutionSpec, execute_agent
from intent_core_api.integrations import external_link_service
from intent_core_api.intent.core_anchor_service import (
    CORE_ANCHOR_CONTENT_FIELDS,
    get_core_anchor_for_shot,
)
from intent_core_api.intent.models import CoreAnchorRevision
from intent_core_api.production_context.models import Shot
from intent_core_api.versions_and_feedback.models import AlignmentAssessment, ReviewNote, Version
from intent_core_api.workflow.actors import AgentType
from intent_core_api.workflow.exceptions import AgentGenerationError, NotFoundError

_CAPABILITY_ALIGNMENT_ASSESSMENT = "alignment_assessment"
_AGENT_TYPE_CORE_AGENT: Final[AgentType] = "core_agent"


class AlignmentAssessmentGenerator(Protocol):
    """Pure input -> output: no DB/session access, no ftrack access, no
    ability to mutate the Core Anchor or any Execution Anchor, no
    ability to create a Decision. Whatever it returns is persisted
    as-is into an immutable AlignmentAssessment row.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> AlignmentAssessmentOutput: ...


class DeterministicAlignmentAssessmentGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Transparently a
    placeholder -- it does not attempt real judgement of alignment, but
    it does read the actual supplied snapshot structure (Core Anchor
    summary, Version description, Review Note count/content) so the
    output is honestly derived from the test's own data rather than
    static boilerplate.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> AlignmentAssessmentOutput:
        anchor = snapshot_payload["confirmed_core_anchor_revision"]
        version = snapshot_payload["version"]
        review_notes = snapshot_payload["review_notes"]
        label = "[Core Agent alignment assessment - deterministic placeholder, review required]"

        evidence = [
            f"Confirmed Core Anchor core_summary: {anchor['core_summary']}",
            f"Version description ({version['name']}): {version['description']}",
        ]
        evidence.extend(f"Review note {note['id']}: {note['content']}" for note in review_notes)

        return AlignmentAssessmentOutput(
            alignment_state="minor_drift",
            summary=(
                f"{label} {len(review_notes)} review note(s) recorded against "
                f"confirmed Core Anchor revision {anchor['revision_number']}."
            ),
            observations=[f"Version {version['name']} has {len(review_notes)} review note(s)."],
            inferences=[
                f"{label} No real alignment judgement was performed; a human must "
                "review the confirmed Core Anchor, the Version, and the Review "
                "Notes directly."
            ],
            evidence=evidence,
            confidence=0.5,
            open_questions=[
                f"{label} Does the Version's actual content align with the "
                "confirmed Core Anchor's intent?"
            ],
            recommended_actions=[
                f"{label} A VFX Supervisor should review this Version against the "
                "confirmed Core Anchor."
            ],
            requires_human_gate=True,
        )


class DeepSeekAlignmentAssessmentGenerator:
    """First real model-backed capability in this codebase. DeepSeek has
    no separate official SDK and no equivalent of Anthropic's
    ``messages.parse(output_format=...)``, so this uses the official
    ``openai`` Python package pointed at DeepSeek's OpenAI-compatible
    endpoint (DeepSeek's own documented integration path), requests
    DeepSeek's JSON mode (``response_format={"type": "json_object"}``),
    and validates the returned JSON string against
    ``AlignmentAssessmentOutput`` explicitly -- one non-streaming
    request per generation, same shape as every other adapter in this
    module. Model name comes from ``Settings.model_name`` (never
    hardcoded). See ADR-0013.
    """

    def __init__(self, *, api_key: str, model_name: str) -> None:
        self._api_key = api_key
        self._model_name = model_name

    def generate(self, *, snapshot_payload: dict[str, Any]) -> AlignmentAssessmentOutput:
        context = {
            "confirmed_core_anchor_revision": snapshot_payload["confirmed_core_anchor_revision"],
            "version": snapshot_payload["version"],
            "review_notes": snapshot_payload["review_notes"],
        }
        return model_gateway.generate_deepseek(
            api_key=self._api_key,
            model_name=self._model_name,
            system_prompt=prompt_registry.get_registration("alignment_assessment").system_prompt,
            user_content=(
                "Assess this Version against the confirmed Core Anchor. "
                "Respond with the JSON object described in the system "
                "prompt. Context (JSON):\n" + json.dumps(context, indent=2)
            ),
            output_model=AlignmentAssessmentOutput,
            max_tokens=2048,
        )


def _get_generator() -> AlignmentAssessmentGenerator:
    provider = model_gateway.resolve_provider_name()
    if provider == "deterministic":
        return DeterministicAlignmentAssessmentGenerator()
    if provider == "deepseek":
        api_key, model_name = model_gateway.require_deepseek_settings()
        return DeepSeekAlignmentAssessmentGenerator(api_key=api_key, model_name=model_name)
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only 'deterministic' "
        "and 'deepseek' exist in this slice"
    )


async def _build_context_snapshot_payload(
    session: AsyncSession,
    *,
    shot: Shot,
    core_anchor_revision: CoreAnchorRevision,
    version: Version,
    review_notes: list[ReviewNote],
) -> dict[str, Any]:
    shot_payload: dict[str, Any] = {"id": str(shot.id), "name": shot.name, "source": shot.source}
    external_id = await external_link_service.find_external_id_for_entity(
        session, entity_type="shot", entity_id=shot.id, source="ftrack"
    )
    if external_id is not None:
        shot_payload["external_id"] = external_id

    anchor_payload: dict[str, Any] = {
        "id": str(core_anchor_revision.id),
        "revision_number": core_anchor_revision.revision_number,
        "confirmed_by_human_role": core_anchor_revision.confirmed_by_human_role,
        "confirmed_at": (
            core_anchor_revision.confirmed_at.isoformat()
            if core_anchor_revision.confirmed_at is not None
            else None
        ),
        **{field: getattr(core_anchor_revision, field) for field in CORE_ANCHOR_CONTENT_FIELDS},
    }

    version_payload: dict[str, Any] = {
        "id": str(version.id),
        "name": version.name,
        "version_number": version.version_number,
        "description": version.description,
        "source": version.source,
    }

    review_notes_payload: list[dict[str, Any]] = [
        {
            "id": str(note.id),
            "content": note.content,
            "source": note.source,
            "created_by_human_role": note.created_by_human_role,
            "created_at": note.created_at.isoformat(),
        }
        for note in review_notes
    ]

    return {
        "shot": shot_payload,
        "confirmed_core_anchor_revision": anchor_payload,
        "version": version_payload,
        "review_notes": review_notes_payload,
    }


async def generate_alignment_assessment(
    session: AsyncSession,
    version_id: uuid.UUID,
    *,
    generator: AlignmentAssessmentGenerator | None = None,
) -> AlignmentAssessment:
    # (a) load Version, Shot, confirmed Core Anchor, and Review Notes.
    version = await session.get(Version, version_id)
    if version is None:
        raise NotFoundError("Version not found")

    shot = await session.get(Shot, version.shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    core_anchor = await get_core_anchor_for_shot(session, shot.id)
    confirmed_revision: CoreAnchorRevision | None = None
    if core_anchor is not None and core_anchor.active_revision_id is not None:
        confirmed_revision = await session.get(CoreAnchorRevision, core_anchor.active_revision_id)

    # (b) validate all preconditions.
    if confirmed_revision is None:
        raise NotFoundError(
            "Shot has no confirmed Core Anchor revision; cannot generate an alignment assessment"
        )

    review_notes_result = await session.execute(
        select(ReviewNote)
        .where(ReviewNote.version_id == version_id)
        .order_by(ReviewNote.created_at)
    )
    review_notes = list(review_notes_result.scalars().all())
    if not review_notes:
        raise NotFoundError("Version has no Review Notes; cannot generate an alignment assessment")

    # (c) build the ContextSnapshot payload -- persisted inside execute_agent.
    payload = await _build_context_snapshot_payload(
        session,
        shot=shot,
        core_anchor_revision=confirmed_revision,
        version=version,
        review_notes=review_notes,
    )

    async def _persist(
        session: AsyncSession,
        snapshot: ContextSnapshot,
        run: AgentRun,
        output: AlignmentAssessmentOutput,
    ) -> AlignmentAssessment:
        # `envelope` stores only the reusable AgentOutputEnvelope fields --
        # alignment_state is its own column, not duplicated in the JSON
        # blob. result_revision_id stays null -- this capability never
        # creates a CoreAnchorRevision.
        envelope_data = output.model_dump(exclude={"alignment_state"}, mode="json")
        assessment = AlignmentAssessment(
            version_id=version.id,
            core_anchor_revision_id=confirmed_revision.id,
            context_snapshot_id=snapshot.id,
            agent_run_id=run.id,
            alignment_state=output.alignment_state,
            envelope=envelope_data,
        )
        session.add(assessment)
        await session.commit()
        await session.refresh(assessment)
        return assessment

    provider, model_name, prompt_version = prompt_registry.execution_metadata(
        _CAPABILITY_ALIGNMENT_ASSESSMENT
    )
    spec = AgentExecutionSpec(
        shot_id=shot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_ALIGNMENT_ASSESSMENT,
        provider=provider,
        model_name=model_name,
        prompt_version=prompt_version,
        snapshot_payload=payload,
        resolve_generator=lambda: generator if generator is not None else _get_generator(),
        persist_result=_persist,
        failure_label="Alignment assessment generation",
    )
    return await execute_agent(session, spec)


async def get_alignment_assessment(
    session: AsyncSession, assessment_id: uuid.UUID
) -> AlignmentAssessment | None:
    return await session.get(AlignmentAssessment, assessment_id)


async def list_alignment_assessments_for_version(
    session: AsyncSession, version_id: uuid.UUID
) -> list[AlignmentAssessment]:
    result = await session.execute(
        select(AlignmentAssessment)
        .where(AlignmentAssessment.version_id == version_id)
        .order_by(AlignmentAssessment.created_at)
    )
    return list(result.scalars().all())
