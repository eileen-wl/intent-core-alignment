"""Core Agent: the smallest end-to-end slice (B1) -- generates a Core
Anchor draft for human review.

Reuses the existing A1 draft-creation workflow
(``intent.core_anchor_service.create_draft_revision``) so every
permission check, revision-numbering rule, and persistence path already
enforced there applies unchanged; this module only assembles the input
context and produces the draft content. It never confirms, rejects,
supersedes, or requests ftrack write-back -- there is no code path here
that could do any of those (the only domain-mutating call this module
makes is ``create_draft_revision``, which only ever creates a
``status="draft"`` revision).

See docs/AGENT_CONTRACTS.md §4 ("Primary Anchor Drafting") and
docs/PRODUCT_SCOPE.md §6.2.

Deliberately not using ``intent_core_contracts.agents.envelope``
(``AgentOutputEnvelope``/``AgentRunRecord``): that shape is for advisory
outputs (observations/inferences/evidence/confidence) like alignment
assessments and re-anchor proposals, which are out of scope for B1. This
slice's deliverable is a structured domain object
(``CoreAnchorRevisionDraftCreate``), which the existing A1 workflow
already validates and persists -- wrapping it in the advisory envelope
first would add a translation step nothing downstream reads yet. No
``AgentRunRecord`` row is persisted in this slice either; the run is
still attributable after the fact via the created revision's own
``created_by_agent_type``/``created_by_agent_run_id`` columns (see
``intent.models.CoreAnchorRevision``), which is what "preserve
provenance where the current architecture supports it" resolves to
without introducing a new table.

Model provider boundary: ``CoreAnchorDraftGenerator`` is the seam a real
model-backed generator would implement (docs/ARCHITECTURE.md §3.5, §4:
"Agents must go through the Model Gateway once a runtime model provider
is chosen"). Only ``DeterministicCoreAnchorDraftGenerator`` exists today
-- see its docstring for exactly what connecting a real provider would
require.
"""

from __future__ import annotations

import uuid
from typing import Protocol

from intent_core_contracts.api.intent import CoreAnchorRevisionDraftCreate
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.config import get_settings
from intent_core_api.intent import brief_service, core_anchor_service
from intent_core_api.intent.models import CoreAnchorRevision
from intent_core_api.production_context.models import Shot
from intent_core_api.workflow.actors import build_agent_actor
from intent_core_api.workflow.exceptions import AgentGenerationError, ConflictError, NotFoundError


class CoreAnchorDraftGenerator(Protocol):
    """Pure input -> output by design: no ftrack access, no session/DB
    access, no ability to confirm/reject/write back -- it only ever
    returns content for a new draft. Whatever it returns still goes
    through ``core_anchor_service.create_draft_revision``'s own
    validation and persistence, same as a human-authored draft.
    """

    def generate(self, *, shot_name: str, brief_text: str) -> CoreAnchorRevisionDraftCreate: ...


class DeterministicCoreAnchorDraftGenerator:
    """Offline, deterministic dev/test adapter: no network call, no API
    key, same output for the same input every time. Does not attempt
    real language understanding or invent creative judgement the system
    doesn't have -- each of the 7 fields is a clearly-labeled echo of the
    intent brief, honest about being a placeholder that needs human
    review rather than a real analysis.

    To connect a real model behind this same boundary: implement
    ``CoreAnchorDraftGenerator.generate()`` against a real provider (this
    project's ``claude-api`` skill -- model ``claude-opus-4-8``,
    structured output via ``client.messages.parse()`` against
    ``CoreAnchorRevisionDraftCreate`` directly), read
    ``MODEL_PROVIDER``/``MODEL_API_KEY``/``MODEL_NAME`` (already reserved
    in ``.env.example``, unused today) into ``Settings``, and add a
    branch for it in ``_get_generator()`` below. Nothing else in this
    module or the router needs to change.
    """

    def generate(self, *, shot_name: str, brief_text: str) -> CoreAnchorRevisionDraftCreate:
        excerpt = brief_text.strip()
        label = "[Core Agent draft - deterministic placeholder, review required]"
        return CoreAnchorRevisionDraftCreate(
            shot_objective=f"{label} Objective for {shot_name}, from the intent brief: {excerpt}",
            emotional_tone=f"{label} Emotional tone per the intent brief: {excerpt}",
            visual_focus=f"{label} Visual focus per the intent brief: {excerpt}",
            rhythm_intensity=f"{label} Rhythm and intensity per the intent brief: {excerpt}",
            character_relationship=f"{label} Character relationship per the brief: {excerpt}",
            narrative_priority=f"{label} Narrative priority per the intent brief: {excerpt}",
            core_summary=f"{label} Summary of the intent brief: {excerpt}",
        )


def _get_generator() -> CoreAnchorDraftGenerator:
    settings = get_settings()
    # An unset/blank MODEL_PROVIDER means "use the default", not "no
    # provider configured" -- .env.example ships it blank on purpose
    # (matches DATABASE_URL's own shape), and pydantic-settings treats an
    # explicit blank in .env as set-to-empty-string rather than falling
    # back to the field default, so that has to be handled here.
    provider = settings.model_provider or "deterministic"
    if provider == "deterministic":
        return DeterministicCoreAnchorDraftGenerator()
    raise AgentGenerationError(
        f"model_provider={provider!r} is not implemented; only "
        "'deterministic' exists in this slice (see core_agent_service module docstring)"
    )


async def generate_core_anchor_draft(
    session: AsyncSession,
    shot_id: uuid.UUID,
    *,
    generator: CoreAnchorDraftGenerator | None = None,
) -> CoreAnchorRevision:
    shot = await session.get(Shot, shot_id)
    if shot is None:
        raise NotFoundError("Shot not found")

    briefs = await brief_service.list_briefs_for_shot(session, shot_id)
    if not briefs:
        raise NotFoundError(
            "No Intent Brief exists for this Shot; cannot generate a Core Anchor draft"
        )
    latest_brief = briefs[-1]

    existing_revisions = await core_anchor_service.list_revisions_for_shot(session, shot_id)
    if any(revision.status == "draft" for revision in existing_revisions):
        raise ConflictError(
            "An editable Core Anchor draft already exists for this shot; confirm, "
            "reject, or edit it before generating a new one"
        )

    active_generator = generator if generator is not None else _get_generator()
    try:
        content = active_generator.generate(shot_name=shot.name, brief_text=latest_brief.raw_text)
    except AgentGenerationError:
        raise
    except Exception as exc:  # noqa: BLE001 -- any provider/runtime failure becomes a clear 502
        raise AgentGenerationError(f"Core Agent draft generation failed: {exc}") from exc

    agent_actor = build_agent_actor("core_agent", agent_run_id=uuid.uuid4())
    return await core_anchor_service.create_draft_revision(
        session, agent_actor, shot_id, content.model_dump()
    )
