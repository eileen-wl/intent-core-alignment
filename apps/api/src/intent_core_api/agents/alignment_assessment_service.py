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
from datetime import UTC, datetime
from typing import Any, Final, Protocol

from intent_core_contracts.api.alignment_assessment import AlignmentAssessmentOutput
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.config import get_settings
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

# DeepSeek's OpenAI-compatible endpoint; no separate official SDK exists
# -- this is DeepSeek's own documented integration path (the `openai`
# package with a custom `base_url`). See ADR-0013.
_DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# DeepSeek's JSON-mode docs require the word "json" to appear in the
# prompt along with an example of the desired structure -- both are
# present below, in addition to the same behavioural boundaries the
# prior Anthropic prompt encoded.
_DEEPSEEK_SYSTEM_PROMPT = """\
You are the Core Agent's alignment-assessment capability for a VFX \
production tool. You compare exactly three inputs supplied to you: the \
Shot's confirmed Core Anchor (its seven intent fields), one Version's \
description, and that Version's Review Notes. Nothing else exists in \
your context -- do not invent unseen visual details, camera work, \
timing, or content that was not described in the supplied text.

Distinguish direct observations (what the text literally says) from \
inferences (what you conclude from it) -- put each in its correct \
output field. Every piece of evidence you cite must refer to a concrete \
Core Anchor field, the Version description, or a specific Review Note \
(quote or closely paraphrase it).

You are strictly advisory. You never make a final production decision, \
and you never edit, rewrite, or propose new wording for the Core \
Anchor -- a human VFX Supervisor makes that call. Your output always \
requires human review: set requires_human_gate to true.

Classify the overall alignment as exactly one of: "aligned" \
(no meaningful tension between the Version and the confirmed Core \
Anchor), "minor_drift" (small, reconcilable tension), or \
"significant_drift" (the Version meaningfully contradicts the confirmed \
Core Anchor).

Respond with a single JSON object only, no text outside of it, matching \
exactly this JSON shape (all fields required):
{
  "alignment_state": "aligned" | "minor_drift" | "significant_drift",
  "summary": "<string>",
  "observations": ["<string>", ...],
  "inferences": ["<string>", ...],
  "evidence": ["<string>", ...],
  "confidence": <number between 0.0 and 1.0>,
  "open_questions": ["<string>", ...],
  "recommended_actions": ["<string>", ...],
  "requires_human_gate": true
}"""


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
        from openai import OpenAI

        client = OpenAI(api_key=self._api_key, base_url=_DEEPSEEK_BASE_URL)
        context = {
            "confirmed_core_anchor_revision": snapshot_payload["confirmed_core_anchor_revision"],
            "version": snapshot_payload["version"],
            "review_notes": snapshot_payload["review_notes"],
        }
        response = client.chat.completions.create(
            model=self._model_name,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _DEEPSEEK_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Assess this Version against the confirmed Core Anchor. "
                        "Respond with the JSON object described in the system "
                        "prompt. Context (JSON):\n" + json.dumps(context, indent=2)
                    ),
                },
            ],
        )
        content = response.choices[0].message.content
        if not content:
            # DeepSeek's JSON-mode docs note the API may occasionally
            # return empty content. For this research prototype, that
            # is treated as one explicit failure recorded on the
            # AgentRun -- not a reason to build a retry system.
            raise AgentGenerationError(
                "DeepSeek response had empty content "
                f"(finish_reason={response.choices[0].finish_reason!r})"
            )
        return AlignmentAssessmentOutput.model_validate_json(content)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _resolve_provider_name() -> str:
    settings = get_settings()
    # Same blank-.env-value footgun as core_agent_service._resolve_provider_name.
    return settings.model_provider or "deterministic"


def _get_generator() -> AlignmentAssessmentGenerator:
    provider = _resolve_provider_name()
    if provider == "deterministic":
        return DeterministicAlignmentAssessmentGenerator()
    if provider == "deepseek":
        settings = get_settings()
        if not settings.model_api_key:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_API_KEY to be set")
        if not settings.model_name:
            raise AgentGenerationError("model_provider='deepseek' requires MODEL_NAME to be set")
        return DeepSeekAlignmentAssessmentGenerator(
            api_key=settings.model_api_key, model_name=settings.model_name
        )
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

    # (c) create and commit ContextSnapshot.
    payload = await _build_context_snapshot_payload(
        session,
        shot=shot,
        core_anchor_revision=confirmed_revision,
        version=version,
        review_notes=review_notes,
    )
    snapshot = ContextSnapshot(shot_id=shot.id, payload=payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    # (d) create and commit AgentRun(status="running").
    run = AgentRun(
        shot_id=shot.id,
        context_snapshot_id=snapshot.id,
        agent_type=_AGENT_TYPE_CORE_AGENT,
        capability=_CAPABILITY_ALIGNMENT_ASSESSMENT,
        provider=_resolve_provider_name(),
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    try:
        # (e) call the selected AlignmentAssessmentGenerator using the
        # snapshot payload. (f) validate the typed output -- the
        # generator's return type is already the validated Pydantic
        # model; any provider/validation failure raises here.
        active_generator = generator if generator is not None else _get_generator()
        try:
            output = active_generator.generate(snapshot_payload=payload)
        except AgentGenerationError:
            raise
        except Exception as exc:  # noqa: BLE001 -- any provider/runtime failure becomes a clear 502
            raise AgentGenerationError(f"Alignment assessment generation failed: {exc}") from exc

        # (g) create immutable AlignmentAssessment. `envelope` stores
        # only the reusable AgentOutputEnvelope fields -- alignment_state
        # is its own column, not duplicated inside the JSON blob.
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
    except Exception as exc:
        # (i) on a failure after AgentRun creation, mark AgentRun
        # failed, store a concise error, set completed_at, and re-raise.
        # No AlignmentAssessment row is created on provider failure.
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    # (h) mark AgentRun succeeded and completed. result_revision_id
    # stays null -- this capability never creates a CoreAnchorRevision.
    run.status = "succeeded"
    run.completed_at = _utcnow()
    await session.commit()

    return assessment


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
