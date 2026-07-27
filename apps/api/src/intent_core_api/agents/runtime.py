"""Lightweight shared Agent Runtime (Step 2).

The common ``ContextSnapshot -> AgentRun -> provider -> validate ->
domain-persist -> finalize`` execution lifecycle that
``core_anchor_drafting``, ``intent_decomposition``,
``context_reconstruction``, and ``alignment_assessment`` each
implemented independently before this module existed (see
docs/AGENT_CONTRACTS.md §2, "Common Agent Run contract"). Domain
services keep everything about what a capability *means* -- building
its own snapshot payload and persisting its own domain-specific result
row; this module only owns the execution envelope around that: the
ContextSnapshot/AgentRun bookkeeping and the transaction/failure
guarantees already established by every capability before Step 2.

Not itself an Agent: it has no ftrack access, confirms/rejects nothing,
and creates no Decision or HumanGate on its own. It only ever creates a
ContextSnapshot and an AgentRun row and calls back into the domain
service (``AgentExecutionSpec.persist_result``) to persist that
service's own result -- exactly the same domain-mutating calls each
capability already made before this module existed, just no longer
duplicated four times.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.agents.models import AgentRun, ContextSnapshot
from intent_core_api.workflow.actors import AgentType
from intent_core_api.workflow.exceptions import AgentGenerationError


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Generator[OutputT](Protocol):
    """The one generator shape every capability's deterministic and
    DeepSeek adapters already implement: pure input -> output, no
    DB/session access, no ftrack access. Whatever it returns is handed
    to ``AgentExecutionSpec.persist_result`` unchanged.
    """

    def generate(self, *, snapshot_payload: dict[str, Any]) -> OutputT: ...


@dataclass(frozen=True)
class AgentExecutionSpec[OutputT, ResultT]:
    """One capability's execution request, handed to ``execute_agent``.

    Everything domain-specific -- what the snapshot contains, what gets
    persisted, and how ``result_revision_id`` (if any) gets set -- stays
    with the caller; this spec is just the typed boundary between a
    domain service and the shared lifecycle.

    ``resolve_generator`` is a zero-argument callable rather than an
    already-resolved ``Generator``, matching every capability's existing
    behaviour: resolving "which provider, and is it configured" can
    itself fail (e.g. an unsupported ``MODEL_PROVIDER`` or a missing
    DeepSeek API key), and that failure must still produce a "failed"
    AgentRun with the ContextSnapshot preserved -- not an exception
    raised before either row exists.
    """

    shot_id: uuid.UUID
    agent_type: AgentType
    capability: str
    provider: str
    snapshot_payload: dict[str, Any]
    resolve_generator: Callable[[], Generator[OutputT]]
    persist_result: Callable[[AsyncSession, ContextSnapshot, AgentRun, OutputT], Awaitable[ResultT]]
    failure_label: str
    model_name: str | None = None
    prompt_version: str | None = None


async def execute_agent[OutputT, ResultT](
    session: AsyncSession, spec: AgentExecutionSpec[OutputT, ResultT]
) -> ResultT:
    """Runs the shared lifecycle every capability already implemented:

    1. persist the exact ContextSnapshot;
    2. create an AgentRun(status="running") recording agent_type,
       capability, provider, model_name, and prompt_version;
    3. resolve and invoke the configured provider;
    4. validate the structured output (a provider/validation failure
       raises here, before any domain result is persisted);
    5. call ``spec.persist_result`` so the domain service can persist
       its own result -- AgentRun only becomes "succeeded" after this
       returns, so a domain persistence failure also leaves no
       succeeded AgentRun and no partial result;
    6. on any failure after step 2, mark AgentRun "failed" with a safe
       (credential-free) error message, leave the ContextSnapshot in
       place, and create no domain result.
    """
    snapshot = ContextSnapshot(shot_id=spec.shot_id, payload=spec.snapshot_payload)
    session.add(snapshot)
    await session.commit()
    await session.refresh(snapshot)

    run = AgentRun(
        shot_id=spec.shot_id,
        context_snapshot_id=snapshot.id,
        agent_type=spec.agent_type,
        capability=spec.capability,
        provider=spec.provider,
        model_name=spec.model_name,
        prompt_version=spec.prompt_version,
        status="running",
    )
    session.add(run)
    await session.commit()
    await session.refresh(run)

    try:
        try:
            generator = spec.resolve_generator()
            output = generator.generate(snapshot_payload=spec.snapshot_payload)
        except AgentGenerationError:
            raise
        except Exception as exc:  # noqa: BLE001 -- any provider/runtime failure becomes a clear 502
            raise AgentGenerationError(f"{spec.failure_label} failed: {exc}") from exc

        result = await spec.persist_result(session, snapshot, run, output)
    except Exception as exc:
        run.status = "failed"
        run.error = str(exc)
        run.completed_at = _utcnow()
        await session.commit()
        raise

    run.status = "succeeded"
    run.completed_at = _utcnow()
    await session.commit()

    return result
