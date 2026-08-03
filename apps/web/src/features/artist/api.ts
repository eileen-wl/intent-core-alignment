import type {
  AnchorContextRead,
  AnchorContextSummaryListRead,
  ArtistAgentGuidanceRead,
  ArtistFeedbackHistoryRead,
  ArtistGuidanceGenerateRequest,
  ArtistInboxItemRead,
  ArtistInboxRead,
  CGSupervisorReviewRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CrossRoleAssessmentRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  ReviewNoteRead,
  TaskDependencyRead,
  TaskRead,
  VersionMediaRead,
  VersionRead,
} from "@intent-core/contracts";

/** Server-only API boundary for the Artist role workspace (Step 7C-5) --
 * mirrors `features/cg/api.ts`'s structure exactly (same error shape,
 * same `cache: "no-store"` fetch, same trusted-header mutation
 * convention), kept as its own self-contained module rather than
 * importing across role-feature boundaries. Never imported by a Client
 * Component. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export class ArtistApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Artist API error ${status}: ${detail}`);
    this.name = "ArtistApiError";
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

async function artistFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new ArtistApiError(0, "The ICAS service is unavailable.");
  }
  if (!response.ok) {
    throw new ArtistApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function artistFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await artistFetch<T>(path);
  } catch (error) {
    if (error instanceof ArtistApiError && error.status === 404) return null;
    throw error;
  }
}

/** Trusted Actor headers, resolved server-side (never client-supplied) --
 * see `features/session/identity.ts`'s `actorHeaders()`. */
type ActorHeaders = Record<string, string>;

function mutationInit(
  method: "POST",
  body: unknown,
  actorHeaders: ActorHeaders,
): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", ...actorHeaders },
    body: JSON.stringify(body),
  };
}

// --- Artist Review Inbox / Task read model ----------------------------------

/** `GET /artist/inbox` -- the full Artist Review Inbox source data, real
 * Tasks only, honest empty `items` array when none exist. */
export function fetchArtistInbox(): Promise<ArtistInboxRead> {
  return artistFetch<ArtistInboxRead>("/artist/inbox");
}

/** `GET /artist/inbox/{task_id}` -- one Task's derived Inbox row, reused
 * as the primary context/header data on every Artist Task page. `null`
 * only on a real 404. */
export function fetchArtistInboxItem(
  taskId: string,
): Promise<ArtistInboxItemRead | null> {
  return artistFetchOrNull<ArtistInboxItemRead>(`/artist/inbox/${taskId}`);
}

/** Role-authorized, read-only Anchor Context projection for one Task. */
export function fetchArtistAnchorContext(
  taskId: string,
  actorHeaders: ActorHeaders,
): Promise<AnchorContextRead> {
  return artistFetch<AnchorContextRead>(
    `/artist/tasks/${taskId}/anchor-context`,
    { headers: actorHeaders },
  );
}

export async function fetchArtistAnchorContextOrNull(
  taskId: string,
  actorHeaders: ActorHeaders,
): Promise<AnchorContextRead | null> {
  try {
    return await fetchArtistAnchorContext(taskId, actorHeaders);
  } catch {
    return null;
  }
}

/** One bounded, role-authorized compact read for multi-Task surfaces. */
export function fetchArtistAnchorContextSummaries(
  actorHeaders: ActorHeaders,
  options: {
    limit?: number;
    scope?: "all" | "triage" | "ready" | "waiting";
  } = {},
): Promise<AnchorContextSummaryListRead> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 200),
    scope: options.scope ?? "all",
  });
  return artistFetch<AnchorContextSummaryListRead>(
    `/artist/anchor-contexts?${params}`,
    { headers: actorHeaders },
  );
}

export function getTask(taskId: string): Promise<TaskRead | null> {
  return artistFetchOrNull<TaskRead>(`/tasks/${taskId}`);
}

export function listTasksForShot(shotId: string): Promise<TaskRead[]> {
  return artistFetch<TaskRead[]>(`/shots/${shotId}/tasks`);
}

// --- Core Anchor / Execution Anchor read-only context (never edited from Artist) --

export function getCoreAnchor(shotId: string): Promise<CoreAnchorRead | null> {
  return artistFetchOrNull<CoreAnchorRead>(
    `/intent/shots/${shotId}/core-anchor`,
  );
}

export function listCoreAnchorRevisions(
  shotId: string,
): Promise<CoreAnchorRevisionRead[]> {
  return artistFetch<CoreAnchorRevisionRead[]>(
    `/intent/shots/${shotId}/core-anchor/revisions`,
  );
}

export function getExecutionAnchor(
  taskId: string,
): Promise<ExecutionAnchorRead | null> {
  return artistFetchOrNull<ExecutionAnchorRead>(
    `/intent/tasks/${taskId}/execution-anchor`,
  );
}

export function listExecutionAnchorRevisions(
  taskId: string,
): Promise<ExecutionAnchorRevisionRead[]> {
  return artistFetch<ExecutionAnchorRevisionRead[]>(
    `/intent/tasks/${taskId}/execution-anchor/revisions`,
  );
}

// --- Production Versions / Review Notes -------------------------------------
// A Task's associated Versions are its Shot's Versions, fetched here at
// the Shot level; callers apply the Task-scoped compatibility filter
// (`@/lib/taskScopedVersions`) themselves, since a real `task_id` link
// now exists on synced Versions (Step 8C-6/8C-7) alongside the
// null-task_id manual/legacy rows this relationship always covered.

export function listVersionsForShot(shotId: string): Promise<VersionRead[]> {
  return artistFetch<VersionRead[]>(`/shots/${shotId}/versions`);
}

export function listReviewNotesForVersion(
  versionId: string,
): Promise<ReviewNoteRead[]> {
  return artistFetch<ReviewNoteRead[]>(`/versions/${versionId}/review-notes`);
}

// --- Artist Agent guidance ---------------------------------------------------

export function listArtistGuidancesForVersion(
  versionId: string,
): Promise<ArtistAgentGuidanceRead[]> {
  return artistFetch<ArtistAgentGuidanceRead[]>(
    `/intent/versions/${versionId}/artist-guidances`,
  );
}

/** Real Agent-assisted generation: reads the Task's active confirmed
 * Core Anchor and Execution Anchor, the Version, its Review Notes, and
 * relevant cross-role evidence, and produces a persisted, advisory
 * ArtistAgentGuidance row -- never auto-applied, never a Version/Anchor
 * mutation. Generating again (e.g. after a newer confirmed Execution
 * Anchor makes prior guidance outdated) is the same real call --
 * ArtistAgentGuidance is immutable and append-only, with no
 * active/latest pointer, so "regenerate" is not a distinct capability. */
export function generateArtistGuidance(
  versionId: string,
  payload: ArtistGuidanceGenerateRequest,
  actorHeaders: ActorHeaders,
): Promise<ArtistAgentGuidanceRead> {
  return artistFetch<ArtistAgentGuidanceRead>(
    `/intent/versions/${versionId}/artist-guidances/generate`,
    mutationInit("POST", payload, actorHeaders),
  );
}

// --- Related cross-role evidence (read-only, "where available") -------------

export function listCgSupervisorReviews(
  revisionId: string,
): Promise<CGSupervisorReviewRead[]> {
  return artistFetch<CGSupervisorReviewRead[]>(
    `/intent/execution-anchor-revisions/${revisionId}/cg-supervisor-reviews`,
  );
}

export function listCrossRoleAssessmentsForVersion(
  versionId: string,
  taskId: string,
): Promise<CrossRoleAssessmentRead[]> {
  return artistFetch<CrossRoleAssessmentRead[]>(
    `/intent/versions/${versionId}/cross-role-assessments?task_id=${taskId}`,
  );
}

// --- Dependencies (read-only context for blockers) ---------------------------

export function listDependenciesForTask(
  taskId: string,
): Promise<TaskDependencyRead[]> {
  return artistFetch<TaskDependencyRead[]>(`/tasks/${taskId}/dependencies`);
}

// --- Feedback History ----------------------------------------------------------

export function getTaskFeedbackHistory(
  taskId: string,
): Promise<ArtistFeedbackHistoryRead> {
  return artistFetch<ArtistFeedbackHistoryRead>(
    `/tasks/${taskId}/feedback-history`,
  );
}

// --- Version media (Step 9B-4) -----------------------------------------------

/** `GET /artist/tasks/{task_id}/versions/{version_id}/media` -- transient,
 * read-only ftrack media resolution for one Production Version,
 * Task-scoped (preserves the Step 8C-6/8C-7 nullable-`task_id`
 * compatibility rule). Role-gated server-side (Artist only), so this
 * call requires trusted, server-resolved Actor headers. `artistFetch`
 * already sends `cache: "no-store"`. Returns `null` on a real 404 (Task
 * or Version not found/not in this Task's scope). */
export async function fetchVersionMedia(
  taskId: string,
  versionId: string,
  actorHeaders: ActorHeaders,
): Promise<VersionMediaRead | null> {
  try {
    return await artistFetch<VersionMediaRead>(
      `/artist/tasks/${taskId}/versions/${versionId}/media`,
      { headers: actorHeaders },
    );
  } catch (error) {
    if (error instanceof ArtistApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
