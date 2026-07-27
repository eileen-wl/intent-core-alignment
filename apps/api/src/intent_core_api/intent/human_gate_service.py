"""Step 1D: a minimal persistent ``HumanGate`` for Core Anchor revision
review (docs/DOMAIN_MODEL.md §9 names ``HumanGate`` as its own persisted
object; before this slice, "Human Gate" was only a UI/workflow pattern).

A ``HumanGate`` is not an Agent, does not interpret creative intent, and
does not generate recommendations -- it only records that an
authoritative human review is required for one ``CoreAnchorRevision``
draft, and how that review was resolved. ``Decision``
(``workflow.models.Decision``) remains the authoritative human decision
record; a ``HumanGate`` links to the ``Decision`` that resolved it via
``decision_id``, it never replaces it.

Every function here is a pure persistence helper with no commit of its
own -- callers (``intent.core_anchor_service``) fold gate creation/
resolution into their own existing atomic transaction, so a draft and
its pending gate always succeed or fail together, and a confirm/reject,
its ``Decision``, and its gate resolution always succeed or fail
together.

Legacy compatibility (Step 1D §5): a ``CoreAnchorRevision`` draft created
before migration ``0017`` has no ``HumanGate`` row (no backfill is ever
run). The first time such a draft is confirmed or rejected,
``get_or_create_pending_gate_for_resolution`` creates the missing
pending gate inside that same resolution transaction -- it is never left
pending on its own, and this path can never create a duplicate gate for
one revision (enforced by the unique ``core_anchor_revision_id`` column
and this function's own existing-row check).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Final

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from intent_core_api.intent.models import HumanGate
from intent_core_api.workflow.actors import ActorContext
from intent_core_api.workflow.exceptions import InternalConsistencyError

GATE_TYPE_CORE_ANCHOR_CONFIRMATION: Final = "core_anchor_confirmation"
REQUIRED_ROLE_VFX_SUPERVISOR: Final = "vfx_supervisor"


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def create_pending_gate(
    session: AsyncSession, *, shot_id: uuid.UUID, core_anchor_revision_id: uuid.UUID
) -> HumanGate:
    """Called exactly once, inside the same transaction as a new
    ``CoreAnchorRevision`` draft (``core_anchor_service.create_draft_revision``)
    -- never called standalone. Does not commit.
    """
    gate = HumanGate(
        shot_id=shot_id,
        core_anchor_revision_id=core_anchor_revision_id,
        gate_type=GATE_TYPE_CORE_ANCHOR_CONFIRMATION,
        required_role=REQUIRED_ROLE_VFX_SUPERVISOR,
        status="pending",
    )
    session.add(gate)
    await session.flush()
    return gate


async def get_gate_for_revision(session: AsyncSession, revision_id: uuid.UUID) -> HumanGate | None:
    result: HumanGate | None = await session.scalar(
        select(HumanGate).where(HumanGate.core_anchor_revision_id == revision_id)
    )
    return result


async def get_or_create_pending_gate_for_resolution(
    session: AsyncSession, *, shot_id: uuid.UUID, core_anchor_revision_id: uuid.UUID
) -> HumanGate:
    """Load the existing gate for a revision, or -- for a legacy,
    pre-Step-1D draft -- create the missing pending one. Does not commit;
    the caller's own confirm/reject transaction resolves and commits this
    same row immediately after, so a legacy gate is never left pending on
    its own.
    """
    gate = await get_gate_for_revision(session, core_anchor_revision_id)
    if gate is not None:
        return gate
    return await create_pending_gate(
        session, shot_id=shot_id, core_anchor_revision_id=core_anchor_revision_id
    )


def resolve_gate(
    gate: HumanGate,
    *,
    status: str,
    actor: ActorContext,
    rationale: str | None,
    decision_id: uuid.UUID,
) -> None:
    """Mutates ``gate`` in place to its resolved state. Does not commit --
    the caller's existing atomic confirm/reject commit covers this row
    too. The pending-status check here is defensive, not a normal
    product-facing validation: by the time this is reached,
    ``core_anchor_service`` has already confirmed the revision itself is
    still ``draft``, and a revision/gate pair is only ever mutated
    together -- so a non-pending gate at this point indicates the two
    fell out of lockstep, not an ordinary user error.
    """
    if gate.status != "pending":
        raise InternalConsistencyError(
            f"HumanGate {gate.id} is not pending (status={gate.status!r}); "
            "cannot resolve a gate twice"
        )
    gate.status = status
    gate.resolved_at = _utcnow()
    gate.resolved_by_actor_id = actor.actor_id
    gate.resolved_by_role = actor.human_role
    gate.resolved_by_actor_type = actor.actor_kind
    gate.rationale = rationale
    gate.decision_id = decision_id
