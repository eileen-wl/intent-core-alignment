import type {
  AnchorConfirmRequest,
  AnchorRejectRequest,
  CGSupervisorReviewRead,
  CgInboxItemRead,
  CgInboxRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  EscalationCreate,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionDraftCreate,
  ExecutionAnchorRevisionRead,
  ExecutionAnchorRevisionUpdate,
  HumanGateRead,
  ReviewNoteRead,
  TaskActivityRead,
  TaskDependencyCreate,
  TaskDependencyRead,
  TaskRead,
  VersionRead,
} from "@intent-core/contracts";

/** Server-only API boundary for the CG Supervisor role workspace (Step
 * 7C-4) -- mirrors `features/vfx/api.ts`'s structure exactly (same
 * error shape, same `cache: "no-store"` fetch, same trusted-header
 * mutation convention), kept as its own self-contained module rather
 * than importing across role-feature boundaries. Never imported by a
 * Client Component. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export class CgApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`CG API error ${status}: ${detail}`);
    this.name = "CgApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      return (body as { detail: string }).detail;
    }
  } catch {
    // Response body was not JSON -- fall through to the status text.
  }
  return response.statusText || "Unknown error";
}

async function cgFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new CgApiError(0, "The ICAS service is unavailable.");
  }
  if (!response.ok) {
    throw new CgApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function cgFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await cgFetch<T>(path);
  } catch (error) {
    if (error instanceof CgApiError && error.status === 404) return null;
    throw error;
  }
}

/** Trusted Actor headers, resolved server-side (never client-supplied) --
 * see `features/session/identity.ts`'s `actorHeaders()`. */
type ActorHeaders = Record<string, string>;

function mutationInit(
  method: "POST" | "PATCH",
  body: unknown,
  actorHeaders: ActorHeaders,
): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...actorHeaders },
    body: JSON.stringify(body),
  };
}

// --- CG Review Inbox / Task read model -------------------------------------

/** `GET /cg/inbox` -- the full CG Review Inbox source data, real Tasks
 * only, honest empty `items` array when none exist. */
export function fetchCgInbox(): Promise<CgInboxRead> {
  return cgFetch<CgInboxRead>("/cg/inbox");
}

/** `GET /cg/inbox/{task_id}` -- one Task's derived Inbox row, reused as
 * the primary context/header data on every CG Task page (mirrors how
 * VFX Shot pages reuse `fetchVfxInboxItem`). `null` only on a real 404. */
export function fetchCgInboxItem(taskId: string): Promise<CgInboxItemRead | null> {
  return cgFetchOrNull<CgInboxItemRead>(`/cg/inbox/${taskId}`);
}

export function getTask(taskId: string): Promise<TaskRead | null> {
  return cgFetchOrNull<TaskRead>(`/tasks/${taskId}`);
}

export function listTasksForShot(shotId: string): Promise<TaskRead[]> {
  return cgFetch<TaskRead[]>(`/shots/${shotId}/tasks`);
}

// --- Core Anchor read-only context (never edited from CG) ------------------

export function getCoreAnchor(shotId: string): Promise<CoreAnchorRead | null> {
  return cgFetchOrNull<CoreAnchorRead>(`/intent/shots/${shotId}/core-anchor`);
}

export function listCoreAnchorRevisions(shotId: string): Promise<CoreAnchorRevisionRead[]> {
  return cgFetch<CoreAnchorRevisionRead[]>(`/intent/shots/${shotId}/core-anchor/revisions`);
}

// --- Execution Anchor read model --------------------------------------------

export function getExecutionAnchor(taskId: string): Promise<ExecutionAnchorRead | null> {
  return cgFetchOrNull<ExecutionAnchorRead>(`/intent/tasks/${taskId}/execution-anchor`);
}

export function listExecutionAnchorRevisions(
  taskId: string,
): Promise<ExecutionAnchorRevisionRead[]> {
  return cgFetch<ExecutionAnchorRevisionRead[]>(
    `/intent/tasks/${taskId}/execution-anchor/revisions`,
  );
}

export function getExecutionAnchorRevisionHumanGate(
  revisionId: string,
): Promise<HumanGateRead | null> {
  return cgFetchOrNull<HumanGateRead>(
    `/intent/execution-anchor-revisions/${revisionId}/human-gate`,
  );
}

// --- Execution Anchor mutations ---------------------------------------------
// Every mutation requires trusted Actor headers, injected by the caller
// (a Server Action) from the server-resolved identity.

export function createExecutionAnchorDraft(
  taskId: string,
  content: ExecutionAnchorRevisionDraftCreate,
  actorHeaders: ActorHeaders,
): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/tasks/${taskId}/execution-anchor/drafts`,
    mutationInit("POST", content, actorHeaders),
  );
}

/** Agent-assisted draft: reads the Task's Shot's active confirmed Core
 * Anchor and translates it into Execution Anchor's fields, persisted as
 * a draft only -- advisory, never auto-confirmed. Mirrors the backend's
 * own no-actor-dependency convention for Agent-generation endpoints
 * (see `intent.router.generate_execution_anchor_draft`). */
export function generateExecutionAnchorDraft(taskId: string): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/tasks/${taskId}/execution-anchor/generate`,
    { method: "POST" },
  );
}

/** Human-authored: copies the Task's current confirmed Execution Anchor
 * revision's own content into a new editable draft. */
export function createExecutionAnchorDraftFromConfirmed(
  taskId: string,
  actorHeaders: ActorHeaders,
): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/tasks/${taskId}/execution-anchor/drafts/from-confirmed`,
    { method: "POST", headers: actorHeaders },
  );
}

export function updateExecutionAnchorDraft(
  revisionId: string,
  changes: ExecutionAnchorRevisionUpdate,
  actorHeaders: ActorHeaders,
): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/execution-anchor-revisions/${revisionId}`,
    mutationInit("PATCH", changes, actorHeaders),
  );
}

export function confirmExecutionAnchorRevision(
  revisionId: string,
  payload: AnchorConfirmRequest,
  actorHeaders: ActorHeaders,
): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/execution-anchor-revisions/${revisionId}/confirm`,
    mutationInit("POST", payload, actorHeaders),
  );
}

export function rejectExecutionAnchorRevision(
  revisionId: string,
  payload: AnchorRejectRequest,
  actorHeaders: ActorHeaders,
): Promise<ExecutionAnchorRevisionRead> {
  return cgFetch<ExecutionAnchorRevisionRead>(
    `/intent/execution-anchor-revisions/${revisionId}/reject`,
    mutationInit("POST", payload, actorHeaders),
  );
}

// --- CG Supervisor Agent review ---------------------------------------------

export function listCgSupervisorReviews(revisionId: string): Promise<CGSupervisorReviewRead[]> {
  return cgFetch<CGSupervisorReviewRead[]>(
    `/intent/execution-anchor-revisions/${revisionId}/cg-supervisor-reviews`,
  );
}

export function generateCgSupervisorReview(
  revisionId: string,
  actorHeaders: ActorHeaders,
): Promise<CGSupervisorReviewRead> {
  return cgFetch<CGSupervisorReviewRead>(
    `/intent/execution-anchor-revisions/${revisionId}/cg-supervisor-reviews/generate`,
    { method: "POST", headers: actorHeaders },
  );
}

// --- Production Versions / Review Notes -------------------------------------
// A Task's associated Versions are its Shot's Versions -- no persisted
// Task<->Version link exists in the domain (see execution_anchor_service's
// own context-snapshot assembly, which relies on the same relationship).

export function listVersionsForShot(shotId: string): Promise<VersionRead[]> {
  return cgFetch<VersionRead[]>(`/shots/${shotId}/versions`);
}

export function listReviewNotesForVersion(versionId: string): Promise<ReviewNoteRead[]> {
  return cgFetch<ReviewNoteRead[]>(`/versions/${versionId}/review-notes`);
}

export function createReviewNote(
  versionId: string,
  content: string,
  actorHeaders: ActorHeaders,
): Promise<ReviewNoteRead> {
  return cgFetch<ReviewNoteRead>(
    `/versions/${versionId}/review-notes`,
    mutationInit("POST", { content }, actorHeaders),
  );
}

// --- Dependencies / conflicts / escalation ----------------------------------

export function listDependenciesForTask(taskId: string): Promise<TaskDependencyRead[]> {
  return cgFetch<TaskDependencyRead[]>(`/tasks/${taskId}/dependencies`);
}

export function createDependency(
  taskId: string,
  payload: TaskDependencyCreate,
  actorHeaders: ActorHeaders,
): Promise<TaskDependencyRead> {
  return cgFetch<TaskDependencyRead>(
    `/tasks/${taskId}/dependencies`,
    mutationInit("POST", payload, actorHeaders),
  );
}

export function acknowledgeDependency(
  taskId: string,
  dependencyId: string,
  actorHeaders: ActorHeaders,
): Promise<TaskDependencyRead> {
  return cgFetch<TaskDependencyRead>(
    `/tasks/${taskId}/dependencies/${dependencyId}/acknowledge`,
    { method: "POST", headers: actorHeaders },
  );
}

export function resolveDependency(
  taskId: string,
  dependencyId: string,
  actorHeaders: ActorHeaders,
): Promise<TaskDependencyRead> {
  return cgFetch<TaskDependencyRead>(
    `/tasks/${taskId}/dependencies/${dependencyId}/resolve`,
    { method: "POST", headers: actorHeaders },
  );
}

export function escalateTask(
  taskId: string,
  payload: EscalationCreate,
  actorHeaders: ActorHeaders,
): Promise<TaskDependencyRead> {
  return cgFetch<TaskDependencyRead>(
    `/tasks/${taskId}/escalate`,
    mutationInit("POST", payload, actorHeaders),
  );
}

// --- Task Activity -----------------------------------------------------------

export function getTaskActivity(taskId: string): Promise<TaskActivityRead> {
  return cgFetch<TaskActivityRead>(`/tasks/${taskId}/activity`);
}
