// Typed API client boundary for client-rendered pages (e.g. the Shot
// Anchor page). Runs in the browser, unlike lib/api-client.ts's
// `fetchShots` (a Server Component fetch) -- so the base URL must come
// from a `NEXT_PUBLIC_`-prefixed env var to survive into the client
// bundle; a plain `API_BASE_URL` read here would be `undefined` at
// runtime. No `.env.local` is introduced (matches the existing web
// convention): override via a one-off shell export if ever needed, same
// as documented for `API_BASE_URL`.
import type {
  AgentRunRead,
  AlignmentAssessmentRead,
  AnchorConfirmRequest,
  AnchorRejectRequest,
  AssessmentDecisionRequest,
  CGSupervisorReviewRead,
  ContextReconstructionRead,
  ContextSnapshotRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
  DecisionRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionDraftCreate,
  ExecutionAnchorRevisionRead,
  HumanGateRead,
  HumanRole,
  IntentBriefRead,
  IntentDecompositionRead,
  ReviewNoteRead,
  ShotRead,
  TaskRead,
  VersionRead,
  VFXSupervisorReviewRead,
} from "@intent-core/contracts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface Actor {
  role: HumanRole;
  actorId: string;
}

/** Thrown for any non-2xx response, and for network failures (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
        return detail
          .map((entry) =>
            entry && typeof entry === "object" && "msg" in entry
              ? String((entry as { msg: unknown }).msg)
              : JSON.stringify(entry),
          )
          .join("; ");
      }
    }
    return response.statusText;
  } catch {
    return response.statusText;
  }
}

/** Turns an unknown thrown value (normally an `ApiError`) into a short,
 * user-facing message. Shared by every page that renders backend errors,
 * so the same status code always reads the same way regardless of which
 * page triggered it. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return `Not signed in: ${err.detail}`;
    if (err.status === 403) return `Not allowed: ${err.detail}`;
    if (err.status === 404) return `Not found: ${err.detail}`;
    if (err.status === 409) return `Out of date: ${err.detail}`;
    if (err.status === 502)
      return `Core Agent generation failed: ${err.detail}`;
    if (err.status === 0) return "Could not reach the API server.";
    return err.detail || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  actor?: Actor;
}

async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.actor) {
    headers["X-Actor-Role"] = options.actor.role;
    headers["X-Actor-Id"] = options.actor.actorId;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the API server");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Converts a 404 into `null` -- for reads where "does not exist yet" is a
 * legitimate empty state, not an error (e.g. a shot with no CoreAnchor
 * yet). Any other failure still propagates as `ApiError`. */
async function fetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getShot(shotId: string): Promise<ShotRead> {
  return apiFetch(`/shots/${shotId}`);
}

export function listTasks(): Promise<TaskRead[]> {
  return apiFetch("/tasks");
}

export function listBriefsForShot(shotId: string): Promise<IntentBriefRead[]> {
  return apiFetch(`/intent/shots/${shotId}/briefs`);
}

export function getCoreAnchor(shotId: string): Promise<CoreAnchorRead | null> {
  return fetchOrNull(`/intent/shots/${shotId}/core-anchor`);
}

export function generateCoreAnchorDraft(
  shotId: string,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/shots/${shotId}/core-anchor/generate`, {
    method: "POST",
  });
}

// Step 1B: Intent Decomposition -- generated before Core Anchor drafting,
// reviewed by the Human VFX Supervisor, then optionally used to create a
// new Core Anchor draft.

export function generateIntentDecomposition(
  shotId: string,
  actor: Actor,
): Promise<IntentDecompositionRead> {
  return apiFetch(`/intent/shots/${shotId}/intent-decompositions/generate`, {
    method: "POST",
    actor,
  });
}

export function listIntentDecompositionsForShot(
  shotId: string,
): Promise<IntentDecompositionRead[]> {
  return apiFetch(`/intent/shots/${shotId}/intent-decompositions`);
}

export function createCoreAnchorDraftFromDecomposition(
  decompositionId: string,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(
    `/intent/intent-decompositions/${decompositionId}/core-anchor-draft`,
    { method: "POST", body: {}, actor },
  );
}

// Step 1C: Context Reconstruction -- a read-only Core Agent interpretation
// of the exact local production facts recorded in one ContextSnapshot,
// generated on demand by the Human VFX Supervisor. Advisory only; never
// creates or modifies a Core Anchor, Execution Anchor, Version, ReviewNote,
// or Decision.

export function generateContextReconstruction(
  shotId: string,
  actor: Actor,
): Promise<ContextReconstructionRead> {
  return apiFetch(`/intent/shots/${shotId}/context-reconstructions/generate`, {
    method: "POST",
    actor,
  });
}

export function listContextReconstructionsForShot(
  shotId: string,
): Promise<ContextReconstructionRead[]> {
  return apiFetch(`/intent/shots/${shotId}/context-reconstructions`);
}

export function listCoreAnchorRevisions(
  shotId: string,
): Promise<CoreAnchorRevisionRead[]> {
  return apiFetch(`/intent/shots/${shotId}/core-anchor/revisions`);
}

export function listDecisionsForRevision(
  revisionId: string,
): Promise<DecisionRead[]> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}/decisions`);
}

// Step 1D: the persisted HumanGate for a Core Anchor revision. `null` for
// a legacy, pre-Step-1D draft that has no gate row -- a legitimate empty
// state, not an error (same convention as getCoreAnchor/getExecutionAnchor).
export function getHumanGateForRevision(
  revisionId: string,
): Promise<HumanGateRead | null> {
  return fetchOrNull(`/intent/core-anchor-revisions/${revisionId}/human-gate`);
}

export function getAgentRun(agentRunId: string): Promise<AgentRunRead> {
  return apiFetch(`/intent/agent-runs/${agentRunId}`);
}

export function getContextSnapshot(
  snapshotId: string,
): Promise<ContextSnapshotRead> {
  return apiFetch(`/intent/context-snapshots/${snapshotId}`);
}

export function updateCoreAnchorRevision(
  revisionId: string,
  changes: CoreAnchorRevisionUpdate,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}`, {
    method: "PATCH",
    body: changes,
    actor,
  });
}

export function confirmCoreAnchorRevision(
  revisionId: string,
  payload: AnchorConfirmRequest,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}/confirm`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function rejectCoreAnchorRevision(
  revisionId: string,
  payload: AnchorRejectRequest,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}/reject`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function getExecutionAnchor(
  taskId: string,
): Promise<ExecutionAnchorRead | null> {
  return fetchOrNull(`/intent/tasks/${taskId}/execution-anchor`);
}

export function getExecutionAnchorRevision(
  revisionId: string,
): Promise<ExecutionAnchorRevisionRead> {
  return apiFetch(`/intent/execution-anchor-revisions/${revisionId}`);
}

export function listExecutionAnchorRevisionsForTask(
  taskId: string,
): Promise<ExecutionAnchorRevisionRead[]> {
  return apiFetch(`/intent/tasks/${taskId}/execution-anchor/revisions`);
}

export function createExecutionAnchorDraft(
  taskId: string,
  payload: ExecutionAnchorRevisionDraftCreate,
  actor: Actor,
): Promise<ExecutionAnchorRevisionRead> {
  return apiFetch(`/intent/tasks/${taskId}/execution-anchor/drafts`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function confirmExecutionAnchorRevision(
  revisionId: string,
  payload: AnchorConfirmRequest,
  actor: Actor,
): Promise<ExecutionAnchorRevisionRead> {
  return apiFetch(`/intent/execution-anchor-revisions/${revisionId}/confirm`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function rejectExecutionAnchorRevision(
  revisionId: string,
  payload: AnchorRejectRequest,
  actor: Actor,
): Promise<ExecutionAnchorRevisionRead> {
  return apiFetch(`/intent/execution-anchor-revisions/${revisionId}/reject`, {
    method: "POST",
    body: payload,
    actor,
  });
}

// Step 4: the persisted HumanGate for an Execution Anchor revision. `null`
// for a legacy, pre-Step-4 draft that has no gate row -- same
// legacy-compatibility convention as getHumanGateForRevision above.
export function getHumanGateForExecutionAnchorRevision(
  revisionId: string,
): Promise<HumanGateRead | null> {
  return fetchOrNull(
    `/intent/execution-anchor-revisions/${revisionId}/human-gate`,
  );
}

// Step 4d: Version / ReviewNote / AlignmentAssessment read+action surface.
// Shared across the Shot Anchor page (Versions list) and the Version
// detail page.

export function listVersionsForShot(shotId: string): Promise<VersionRead[]> {
  return apiFetch(`/shots/${shotId}/versions`);
}

export function getVersion(versionId: string): Promise<VersionRead> {
  return apiFetch(`/versions/${versionId}`);
}

export function listReviewNotesForVersion(
  versionId: string,
): Promise<ReviewNoteRead[]> {
  return apiFetch(`/versions/${versionId}/review-notes`);
}

export function listAssessmentsForVersion(
  versionId: string,
): Promise<AlignmentAssessmentRead[]> {
  return apiFetch(`/versions/${versionId}/assessments`);
}

export function generateAlignmentAssessment(
  versionId: string,
): Promise<AlignmentAssessmentRead> {
  return apiFetch(`/versions/${versionId}/assessments/generate`, {
    method: "POST",
  });
}

export function listDecisionsForAssessment(
  assessmentId: string,
): Promise<DecisionRead[]> {
  return apiFetch(`/assessments/${assessmentId}/decisions`);
}

export function acceptAlignmentAssessment(
  assessmentId: string,
  payload: AssessmentDecisionRequest,
  actor: Actor,
): Promise<DecisionRead> {
  return apiFetch(`/assessments/${assessmentId}/accept`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function rejectAlignmentAssessment(
  assessmentId: string,
  payload: AssessmentDecisionRequest,
  actor: Actor,
): Promise<DecisionRead> {
  return apiFetch(`/assessments/${assessmentId}/reject`, {
    method: "POST",
    body: payload,
    actor,
  });
}

// Step 3: VFX Supervisor Agent -- the first independent Role Agent's
// `creative_review` capability. Purely advisory: no accept/reject/apply
// action exists for this output, matching the read-only Context
// Reconstruction surface, not the Alignment Assessment Human Gate.

export function generateVfxSupervisorReview(
  versionId: string,
  actor: Actor,
): Promise<VFXSupervisorReviewRead> {
  return apiFetch(
    `/intent/versions/${versionId}/vfx-supervisor-reviews/generate`,
    {
      method: "POST",
      actor,
    },
  );
}

export function listVfxSupervisorReviewsForVersion(
  versionId: string,
): Promise<VFXSupervisorReviewRead[]> {
  return apiFetch(`/intent/versions/${versionId}/vfx-supervisor-reviews`);
}

// Step 4: CG Supervisor Agent -- the second independent Role Agent's
// `execution_review` capability. Purely advisory, same read-only shape as
// the VFX Supervisor Agent review above: no accept/reject/apply action.

export function generateCgSupervisorReview(
  revisionId: string,
  actor: Actor,
): Promise<CGSupervisorReviewRead> {
  return apiFetch(
    `/intent/execution-anchor-revisions/${revisionId}/cg-supervisor-reviews/generate`,
    {
      method: "POST",
      actor,
    },
  );
}

export function listCgSupervisorReviewsForExecutionAnchorRevision(
  revisionId: string,
): Promise<CGSupervisorReviewRead[]> {
  return apiFetch(
    `/intent/execution-anchor-revisions/${revisionId}/cg-supervisor-reviews`,
  );
}
