"use server";

import { revalidatePath } from "next/cache";
import type {
  CGSupervisorReviewRead,
  ExecutionAnchorRevisionRead,
  ExecutionAnchorRevisionUpdate,
  ReviewNoteRead,
  TaskDependencyRead,
  VersionMediaRead,
} from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  CgApiError,
  acknowledgeDependency,
  confirmExecutionAnchorRevision,
  createDependency,
  createExecutionAnchorDraft,
  createExecutionAnchorDraftFromConfirmed,
  createReviewNote,
  escalateTask,
  fetchVersionMedia,
  generateCgSupervisorReview,
  generateExecutionAnchorDraft,
  getExecutionAnchorRevisionHumanGate,
  listExecutionAnchorRevisions,
  rejectExecutionAnchorRevision,
  resolveDependency,
  updateExecutionAnchorDraft,
} from "@/features/cg/api";

/** Server-authoritative CG Supervisor mutations for the CG Task
 * Workspace (Step 7C-4) -- mirrors
 * `features/vfx/intent-workspace/actions.ts`'s pattern exactly: resolve
 * Demo identity server-side, verify CG Supervisor role, call FastAPI
 * with trusted X-Actor-Role/X-Actor-Id headers, revalidate the smallest
 * affected routes. The Client never supplies `actorId`, `role`, or a
 * trusted identity. */

export type CgActionErrorKind =
  "forbidden" | "not_found" | "conflict" | "validation" | "network";

export interface CgActionError {
  kind: CgActionErrorKind;
  message: string;
}

export type ExecutionAnchorActionResult =
  | { ok: true; revision: ExecutionAnchorRevisionRead }
  | { ok: false; error: CgActionError };

export type CgSupervisorReviewActionResult =
  | { ok: true; review: CGSupervisorReviewRead }
  | { ok: false; error: CgActionError };

export type ReviewNoteActionResult =
  { ok: true; note: ReviewNoteRead } | { ok: false; error: CgActionError };

export type DependencyActionResult =
  | { ok: true; dependency: TaskDependencyRead }
  | { ok: false; error: CgActionError };

const FORBIDDEN_ERROR: CgActionError = {
  kind: "forbidden",
  message: "This action is owned by the CG Supervisor.",
};

const STALE_CONFLICT_ERROR: CgActionError = {
  kind: "conflict",
  message:
    "This was already acted on elsewhere -- reload to see the current state.",
};

function mapThrownError(error: unknown): CgActionError {
  if (error instanceof CgApiError) {
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

async function requireCgIdentity(): Promise<
  | { role: "cg_supervisor"; actorId: string; displayName: string }
  | { error: CgActionError }
> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "cg_supervisor") {
    return { error: FORBIDDEN_ERROR };
  }
  return {
    role: "cg_supervisor",
    actorId: identity.actorId,
    displayName: identity.displayName,
  };
}

function revalidateTaskRoutes(
  taskId: string,
  tab: "execution" | "version-review" | "dependencies",
): void {
  revalidatePath(`/cg/tasks/${taskId}/${tab}`);
  revalidatePath(`/cg/tasks/${taskId}`);
  revalidatePath(`/cg/tasks/${taskId}/activity`);
  // Also revalidate the persistent Task layout segment itself (Navigation
  // Responsiveness Fix, Phase 2): the page-type calls above refresh only
  // leaf routes, but `app/cg/tasks/[taskId]/layout.tsx` now owns its own
  // `fetchCgAnchorContextOrNull` fetch and is a distinct cached segment
  // that a page-type revalidation does not reach.
  revalidatePath(`/cg/tasks/${taskId}`, "layout");
  revalidatePath("/cg");
  revalidatePath("/cg/inbox");
}

export async function createExecutionAnchorDraftAction(
  taskId: string,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const revision = await createExecutionAnchorDraft(
      taskId,
      {},
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "execution");
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function generateExecutionAnchorDraftAction(
  taskId: string,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const revision = await generateExecutionAnchorDraft(taskId);
    revalidateTaskRoutes(taskId, "execution");
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function createExecutionAnchorDraftFromConfirmedAction(
  taskId: string,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const revision = await createExecutionAnchorDraftFromConfirmed(
      taskId,
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "execution");
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function saveExecutionAnchorDraftAction(
  taskId: string,
  revisionId: string,
  changes: ExecutionAnchorRevisionUpdate,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const revisions = await listExecutionAnchorRevisions(taskId);
  const target = revisions.find((revision) => revision.id === revisionId);
  if (target === undefined) {
    return {
      ok: false,
      error: {
        kind: "not_found",
        message: "That revision does not belong to this Task.",
      },
    };
  }

  try {
    const revision = await updateExecutionAnchorDraft(
      revisionId,
      changes,
      actorHeaders(identity),
    );
    revalidatePath(`/cg/tasks/${taskId}/execution`);
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

async function validateGateAndRevision(
  taskId: string,
  revisionId: string,
  humanGateId: string | null,
): Promise<CgActionError | null> {
  const revisions = await listExecutionAnchorRevisions(taskId);
  const target = revisions.find((revision) => revision.id === revisionId);
  if (target === undefined) {
    return {
      kind: "not_found",
      message: "That revision does not belong to this Task.",
    };
  }
  if (target.status !== "draft") {
    return STALE_CONFLICT_ERROR;
  }

  const gate = await getExecutionAnchorRevisionHumanGate(revisionId);
  if (gate === null) {
    // Legacy-compatibility case, mirroring the Core Anchor Server
    // Action's identical handling: a draft created before the gate for
    // Execution Anchor existed has no gate row yet. The real backend
    // confirm/reject service call creates the missing pending gate
    // atomically with the resolution itself.
    return null;
  }
  if (gate.id !== humanGateId || gate.status !== "pending") {
    return STALE_CONFLICT_ERROR;
  }
  return null;
}

export async function confirmExecutionAnchorRevisionAction(
  taskId: string,
  revisionId: string,
  humanGateId: string | null,
  rationale: string,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const validationError = await validateGateAndRevision(
    taskId,
    revisionId,
    humanGateId,
  );
  if (validationError) return { ok: false, error: validationError };

  try {
    const revision = await confirmExecutionAnchorRevision(
      revisionId,
      { rationale, request_write_back: false },
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "execution");
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function rejectExecutionAnchorRevisionAction(
  taskId: string,
  revisionId: string,
  humanGateId: string | null,
  rationale: string,
): Promise<ExecutionAnchorActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  const validationError = await validateGateAndRevision(
    taskId,
    revisionId,
    humanGateId,
  );
  if (validationError) return { ok: false, error: validationError };

  try {
    const revision = await rejectExecutionAnchorRevision(
      revisionId,
      { rationale },
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "execution");
    return { ok: true, revision };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function generateCgSupervisorReviewAction(
  taskId: string,
  revisionId: string,
  versionId: string,
): Promise<CgSupervisorReviewActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const review = await generateCgSupervisorReview(
      revisionId,
      versionId,
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "version-review");
    return { ok: true, review };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function createReviewNoteAction(
  taskId: string,
  versionId: string,
  content: string,
): Promise<ReviewNoteActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const note = await createReviewNote(
      versionId,
      content,
      actorHeaders(identity),
    );
    revalidatePath(`/cg/tasks/${taskId}/version-review`);
    revalidatePath(`/cg/tasks/${taskId}/activity`);
    return { ok: true, note };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function createDependencyAction(
  taskId: string,
  kind: "dependency" | "conflict",
  description: string,
  severity: "low" | "medium" | "high" | null,
): Promise<DependencyActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const dependency = await createDependency(
      taskId,
      {
        kind,
        description,
        severity: severity ?? undefined,
        related_version_id: undefined,
      },
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "dependencies");
    return { ok: true, dependency };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function acknowledgeDependencyAction(
  taskId: string,
  dependencyId: string,
): Promise<DependencyActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const dependency = await acknowledgeDependency(
      taskId,
      dependencyId,
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "dependencies");
    return { ok: true, dependency };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

export async function resolveDependencyAction(
  taskId: string,
  dependencyId: string,
): Promise<DependencyActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const dependency = await resolveDependency(
      taskId,
      dependencyId,
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId, "dependencies");
    return { ok: true, dependency };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}

/** Step 9B-4: read-only Server Action the CG Version Review page uses to
 * resolve transient ftrack media for the currently-selected Version
 * (client-side selection, `VersionReviewPage.tsx`) -- no mutation, no
 * `revalidatePath`. Identity is resolved server-side on every call. */
export type VersionMediaFetchResult =
  { ok: true; media: VersionMediaRead } | { ok: false; message: string };

const MEDIA_FORBIDDEN_MESSAGE =
  "Media context is only available to a CG Supervisor session.";
const MEDIA_UNAVAILABLE_MESSAGE = "The ICAS service is unavailable.";
const MEDIA_NOT_FOUND_MESSAGE =
  "This Production Version could not be found for this Task.";

export async function resolveVersionMediaAction(
  taskId: string,
  versionId: string,
): Promise<VersionMediaFetchResult> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "cg_supervisor") {
    return { ok: false, message: MEDIA_FORBIDDEN_MESSAGE };
  }

  try {
    const media = await fetchVersionMedia(
      taskId,
      versionId,
      actorHeaders(identity),
    );
    if (media === null) {
      return { ok: false, message: MEDIA_NOT_FOUND_MESSAGE };
    }
    return { ok: true, media };
  } catch (error) {
    if (error instanceof CgApiError) {
      if (error.status === 403)
        return { ok: false, message: MEDIA_FORBIDDEN_MESSAGE };
      if (error.status === 0)
        return { ok: false, message: MEDIA_UNAVAILABLE_MESSAGE };
      return { ok: false, message: error.detail || MEDIA_UNAVAILABLE_MESSAGE };
    }
    return { ok: false, message: MEDIA_UNAVAILABLE_MESSAGE };
  }
}

export async function escalateTaskAction(
  taskId: string,
  description: string,
  relatedVersionId: string | null,
): Promise<DependencyActionResult> {
  const identity = await requireCgIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const escalation = await escalateTask(
      taskId,
      { description, related_version_id: relatedVersionId ?? undefined },
      actorHeaders(identity),
    );
    revalidatePath(`/cg/tasks/${taskId}/version-review`);
    revalidatePath(`/cg/tasks/${taskId}/dependencies`);
    revalidatePath(`/cg/tasks/${taskId}/activity`);
    revalidatePath("/vfx/inbox");
    revalidatePath("/vfx");
    return { ok: true, dependency: escalation };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}
