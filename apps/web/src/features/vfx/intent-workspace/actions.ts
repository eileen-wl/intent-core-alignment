"use server";

import { revalidatePath } from "next/cache";
import type {
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
} from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  VfxApiError,
  confirmCoreAnchorRevision,
  createBlankCoreAnchorDraft,
  createCoreAnchorDraftFromConfirmed,
  getHumanGateForRevision,
  listCoreAnchorRevisions,
  rejectCoreAnchorRevision,
  updateCoreAnchorDraft,
  generateIntentDecomposition,
  generateContextReconstruction,
  generateCoreAnchorDraft,
  createCoreAnchorDraftFromDecomposition,
} from "@/features/vfx/api";

/** Server-authoritative Core Anchor mutations for the VFX Intent
 * Workspace (Step 7C-2; docs/step-7/15_STEP_7C0C_...md §12,
 * docs/step-7/16_STEP_7C0D_...md §17). Every mutation here:
 *
 *   Client interaction island
 *     -> this Server Action
 *       -> resolve Demo identity server-side (never client-supplied)
 *       -> verify VFX Supervisor role
 *       -> validate the target object's route-context relationship
 *       -> call FastAPI with trusted X-Actor-Role/X-Actor-Id headers
 *       -> keep request_write_back false (Confirm only)
 *       -> map and sanitise the result
 *       -> revalidate the smallest affected routes
 *
 * The Client never supplies `actorId`, `role`, or a trusted identity --
 * only route-visible ids (`shotId`, `revisionId`, `humanGateId`) and
 * user-entered text (`changes`, `rationale`). */

export type IntentActionErrorKind =
  "forbidden" | "not_found" | "conflict" | "validation" | "network";

export interface IntentActionError {
  kind: IntentActionErrorKind;
  message: string;
}

export type IntentActionResult =
  | { ok: true; revision: CoreAnchorRevisionRead }
  | { ok: false; error: IntentActionError };

export type AgentGenerationResult =
  { ok: true } | { ok: false; error: IntentActionError };

const FORBIDDEN_ERROR: IntentActionError = {
  kind: "forbidden",
  message: "Core Anchor confirmation is owned by the VFX Supervisor.",
};

const STALE_CONFLICT_ERROR: IntentActionError = {
  kind: "conflict",
  message:
    "This was already acted on elsewhere -- reload to see the current state.",
};

function mapThrownError(error: unknown): IntentActionError {
  if (error instanceof VfxApiError) {
    if (error.status === 403) return FORBIDDEN_ERROR;
    if (error.status === 404)
      return { kind: "not_found", message: error.detail || "Not found." };
    if (error.status === 409) return STALE_CONFLICT_ERROR;
    if (error.status === 0) {
      return { kind: "network", message: "The ICAS service is unavailable." };
    }
    return {
      kind: "validation",
      message: error.detail || "Something went wrong. Please try again.",
    };
  }
  return {
    kind: "network",
    message: "Something went wrong. Please try again.",
  };
}

async function requireVfxIdentity(): Promise<
  | { role: "vfx_supervisor"; actorId: string; displayName: string }
  | { error: IntentActionError }
> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "vfx_supervisor") {
    return { error: FORBIDDEN_ERROR };
  }
  return {
    role: "vfx_supervisor",
    actorId: identity.actorId,
    displayName: identity.displayName,
  };
}

function revalidateIntentAndOverview(shotId: string, alsoInbox: boolean): void {
  revalidatePath(`/vfx/shots/${shotId}/intent`);
  revalidatePath(`/vfx/shots/${shotId}`);
  if (alsoInbox) {
    revalidatePath("/vfx");
  }
}

export async function generateIntentDecompositionAction(
  shotId: string,
): Promise<AgentGenerationResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };
  try {
    await generateIntentDecomposition(shotId, actorHeaders(identity));
    revalidatePath(`/vfx/shots/${shotId}/intent`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function generateContextReconstructionAction(
  shotId: string,
): Promise<AgentGenerationResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };
  try {
    await generateContextReconstruction(shotId, actorHeaders(identity));
    revalidatePath(`/vfx/shots/${shotId}/intent`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function generateCoreAnchorDraftAction(
  shotId: string,
): Promise<AgentGenerationResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };
  try {
    await generateCoreAnchorDraft(shotId);
    revalidateIntentAndOverview(shotId, true);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function createCoreAnchorDraftFromDecompositionAction(
  decompositionId: string,
): Promise<AgentGenerationResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };
  try {
    await createCoreAnchorDraftFromDecomposition(
      decompositionId,
      actorHeaders(identity),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

/** Starts a new draft revision from the Shot's current confirmed Core
 * Anchor -- the "Create new revision" primary action on the
 * confirmed-only state (docs/step-7/16_STEP_7C0D_...md §7). */
export async function createCoreAnchorDraftFromConfirmedAction(
  shotId: string,
): Promise<IntentActionResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const revision = await createCoreAnchorDraftFromConfirmed(
      shotId,
      actorHeaders(identity),
    );
    revalidateIntentAndOverview(shotId, true);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

/** Starts the Shot's very first draft (no confirmed Core Anchor exists
 * yet) -- every field begins blank/human-authored, since there is no
 * confirmed content to copy from. Distinct from
 * `createCoreAnchorDraftFromConfirmedAction`: this is the honest path
 * for a Shot that has never had a confirmed revision at all. */
export async function startBlankCoreAnchorDraftAction(
  shotId: string,
): Promise<IntentActionResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const revision = await createBlankCoreAnchorDraft(
      shotId,
      actorHeaders(identity),
    );
    revalidateIntentAndOverview(shotId, true);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

/** Saves an in-progress edit to the draft's fields -- stays on the
 * Intent route, refreshes only the draft/comparison region (never the
 * Overview or Inbox: a plain field edit does not change Current
 * focus). Validates that `revisionId` genuinely belongs to `shotId`'s
 * Core Anchor before forwarding the edit. */
export async function saveCoreAnchorDraftAction(
  shotId: string,
  revisionId: string,
  changes: CoreAnchorRevisionUpdate,
): Promise<IntentActionResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const revisions = await listCoreAnchorRevisions(shotId);
  const target = revisions.find((revision) => revision.id === revisionId);
  if (target === undefined) {
    return {
      ok: false,
      error: {
        kind: "not_found",
        message: "That revision does not belong to this Shot.",
      },
    };
  }

  try {
    const revision = await updateCoreAnchorDraft(
      revisionId,
      changes,
      actorHeaders(identity),
    );
    revalidatePath(`/vfx/shots/${shotId}/intent`);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

async function validateGateAndRevision(
  shotId: string,
  revisionId: string,
  humanGateId: string | null,
): Promise<IntentActionError | null> {
  const revisions = await listCoreAnchorRevisions(shotId);
  const target = revisions.find((revision) => revision.id === revisionId);
  if (target === undefined) {
    return {
      kind: "not_found",
      message: "That revision does not belong to this Shot.",
    };
  }
  if (target.status !== "draft") {
    // Someone else already confirmed/rejected this exact revision.
    return STALE_CONFLICT_ERROR;
  }

  const gate = await getHumanGateForRevision(revisionId);
  if (gate === null) {
    // Legacy-compatibility case (`intent.human_gate_service`'s own
    // documented path): a draft created before HumanGate existed for its
    // Anchor type has no gate row yet. This is not a staleness conflict
    // -- the real backend confirm/reject service call
    // (`get_or_create_pending_gate_for_resolution`) creates the missing
    // pending gate atomically with the resolution itself, so this is
    // safe to let through rather than a permanent dead end.
    return null;
  }
  if (gate.id !== humanGateId || gate.status !== "pending") {
    // A real gate exists but does not match what this page last loaded,
    // or has already been resolved -- a genuine stale-conflict, kept
    // exactly as strict as before.
    return STALE_CONFLICT_ERROR;
  }
  return null;
}

/** Confirms a pending Core Anchor revision -- `request_write_back`
 * always stays `false` (real ftrack write-back capability exists on
 * the backend, but stays out of the VFX Workspace until real ftrack
 * Shot linkage exists, docs/step-7/14_STEP_7C0B_...md §2.6/§17). */
export async function confirmCoreAnchorRevisionAction(
  shotId: string,
  revisionId: string,
  humanGateId: string | null,
  rationale: string,
): Promise<IntentActionResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const validationError = await validateGateAndRevision(
    shotId,
    revisionId,
    humanGateId,
  );
  if (validationError) return { ok: false, error: validationError };

  try {
    const revision = await confirmCoreAnchorRevision(
      revisionId,
      { rationale, request_write_back: false },
      actorHeaders(identity),
    );
    revalidateIntentAndOverview(shotId, true);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

/** Rejects a pending Core Anchor revision -- the previously-confirmed
 * revision (if any) remains active; no new draft is created
 * automatically. */
export async function rejectCoreAnchorRevisionAction(
  shotId: string,
  revisionId: string,
  humanGateId: string | null,
  rationale: string,
): Promise<IntentActionResult> {
  const identity = await requireVfxIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const validationError = await validateGateAndRevision(
    shotId,
    revisionId,
    humanGateId,
  );
  if (validationError) return { ok: false, error: validationError };

  try {
    const revision = await rejectCoreAnchorRevision(
      revisionId,
      { rationale },
      actorHeaders(identity),
    );
    revalidateIntentAndOverview(shotId, true);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}
