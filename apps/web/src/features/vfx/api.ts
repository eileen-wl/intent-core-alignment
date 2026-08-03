import type {
  AnchorContextRead,
  AnchorContextSummaryListRead,
  AgentRunRead,
  AnchorConfirmRequest,
  AnchorRejectRequest,
  ContextReconstructionRead,
  ContextSnapshotRead,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
  CrossRoleAssessmentGenerateRequest,
  CrossRoleAssessmentRead,
  DecisionRead,
  DepartmentExecutionOverviewRead,
  HumanGateRead,
  IntentDecompositionRead,
  ReviewNoteRead,
  ShotActivityRead,
  VersionMediaRead,
  VersionRead,
  VfxInboxItemRead,
  VfxInboxRead,
} from "@intent-core/contracts";

/** Server-only API boundary for the new VFX role workspace (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §17, `7C-1` scope item 6). Distinct
 * from `apps/web/src/lib/api.ts` (the legacy browser-side client for
 * `/shots`, preserved unchanged) -- this module is never imported by a
 * Client Component. Uses the plain, non-`NEXT_PUBLIC_`-prefixed
 * `API_BASE_URL` convention already established by
 * `apps/web/src/lib/api-client.ts`'s server-side `fetchShots`. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

/** Honest typed error -- mirrors `lib/api.ts`'s `ApiError` shape so a
 * future consolidation is easy, but kept local since this module must
 * not depend on the browser-facing client. */
export class VfxApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`VFX API error ${status}: ${detail}`);
    this.name = "VfxApiError";
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

async function vfxFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new VfxApiError(0, "The ICAS service is unavailable.");
  }
  if (!response.ok) {
    throw new VfxApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function vfxFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await vfxFetch<T>(path);
  } catch (error) {
    if (error instanceof VfxApiError && error.status === 404) return null;
    throw error;
  }
}

/** Trusted Actor headers, resolved server-side (never client-supplied) --
 * see `features/session/identity.ts`'s `actorHeaders()`. Every mutation
 * below requires them; every read below does not (matches
 * docs/step-7/14_STEP_7C0B_...md §7.4: reads never needed actor headers). */
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

// --- Step 7C-2 Intent Workspace: Core Anchor read model -------------------

export function getCoreAnchor(shotId: string): Promise<CoreAnchorRead | null> {
  return vfxFetchOrNull<CoreAnchorRead>(`/intent/shots/${shotId}/core-anchor`);
}

export function listCoreAnchorRevisions(
  shotId: string,
): Promise<CoreAnchorRevisionRead[]> {
  return vfxFetch<CoreAnchorRevisionRead[]>(
    `/intent/shots/${shotId}/core-anchor/revisions`,
  );
}

export function getHumanGateForRevision(
  revisionId: string,
): Promise<HumanGateRead | null> {
  return vfxFetchOrNull<HumanGateRead>(
    `/intent/core-anchor-revisions/${revisionId}/human-gate`,
  );
}

/** Real recorded Decisions for a Core Anchor revision (confirm/reject),
 * each carrying its own honest `rationale` (nullable) -- the only source
 * of truth for what a VFX Supervisor actually wrote, never re-derived
 * from client-side dialog state that does not survive navigation. */
export function listDecisionsForRevision(
  revisionId: string,
): Promise<DecisionRead[]> {
  return vfxFetch<DecisionRead[]>(
    `/intent/core-anchor-revisions/${revisionId}/decisions`,
  );
}

/** Read-only advisory-input listings for the Intent Workspace's
 * Decomposition/Reconstruction disclosure (docs/step-7/16_STEP_7C0D_...md
 * §7) -- an honest empty array when the D1 seed (or any Shot) has none;
 * never fabricated. No generation control is wired to these in this
 * stage (docs/step-7/15_STEP_7C0C_...md §13 marks both "supporting,
 * disclosure-only," not Tier 1) -- listing existing records is enough
 * to satisfy the locked disclosure without expanding this stage's scope. */
export function listIntentDecompositionsForShot(
  shotId: string,
): Promise<IntentDecompositionRead[]> {
  return vfxFetch<IntentDecompositionRead[]>(
    `/intent/shots/${shotId}/intent-decompositions`,
  );
}

export function listContextReconstructionsForShot(
  shotId: string,
): Promise<ContextReconstructionRead[]> {
  return vfxFetch<ContextReconstructionRead[]>(
    `/intent/shots/${shotId}/context-reconstructions`,
  );
}

/** Technical provenance for the Evidence/Provenance disclosure -- only
 * fetched when the revision actually carries the corresponding id
 * (human-authored drafts have neither). */
export function getAgentRun(agentRunId: string): Promise<AgentRunRead> {
  return vfxFetch<AgentRunRead>(`/intent/agent-runs/${agentRunId}`);
}

export function getContextSnapshot(
  snapshotId: string,
): Promise<ContextSnapshotRead> {
  return vfxFetch<ContextSnapshotRead>(
    `/intent/context-snapshots/${snapshotId}`,
  );
}

// --- Step 7C-2 Intent Workspace: Core Anchor mutations --------------------
// Every mutation requires trusted Actor headers, injected by the caller
// (a Server Action) from the server-resolved identity -- never accepted
// from Client Component state (docs/step-7/15_STEP_7C0C_...md §12).

export function createCoreAnchorDraftFromConfirmed(
  shotId: string,
  actorHeaders: ActorHeaders,
): Promise<CoreAnchorRevisionRead> {
  return vfxFetch<CoreAnchorRevisionRead>(
    `/intent/shots/${shotId}/core-anchor/drafts/from-confirmed`,
    { method: "POST", headers: actorHeaders },
  );
}

/** The pre-existing, already-real blank/manual draft-creation path
 * (`core_anchor_service.create_draft_revision`, unchanged) -- used only
 * for the honest "no Core Anchor confirmed yet, and no draft exists
 * yet" starting state, where there is no confirmed content to copy
 * from. Every field starts blank/human-authored from here. */
export function createBlankCoreAnchorDraft(
  shotId: string,
  actorHeaders: ActorHeaders,
): Promise<CoreAnchorRevisionRead> {
  return vfxFetch<CoreAnchorRevisionRead>(
    `/intent/shots/${shotId}/core-anchor/drafts`,
    mutationInit("POST", {}, actorHeaders),
  );
}

export function updateCoreAnchorDraft(
  revisionId: string,
  changes: CoreAnchorRevisionUpdate,
  actorHeaders: ActorHeaders,
): Promise<CoreAnchorRevisionRead> {
  return vfxFetch<CoreAnchorRevisionRead>(
    `/intent/core-anchor-revisions/${revisionId}`,
    mutationInit("PATCH", changes, actorHeaders),
  );
}

export function confirmCoreAnchorRevision(
  revisionId: string,
  payload: AnchorConfirmRequest,
  actorHeaders: ActorHeaders,
): Promise<CoreAnchorRevisionRead> {
  return vfxFetch<CoreAnchorRevisionRead>(
    `/intent/core-anchor-revisions/${revisionId}/confirm`,
    mutationInit("POST", payload, actorHeaders),
  );
}

export function rejectCoreAnchorRevision(
  revisionId: string,
  payload: AnchorRejectRequest,
  actorHeaders: ActorHeaders,
): Promise<CoreAnchorRevisionRead> {
  return vfxFetch<CoreAnchorRevisionRead>(
    `/intent/core-anchor-revisions/${revisionId}/reject`,
    mutationInit("POST", payload, actorHeaders),
  );
}

// --- Step 7C-3: Versions, Alignment, Activity read models -----------------

/** Real Production Versions for a Shot, newest-first per the backend's
 * own `created_at` ordering -- never a Core Anchor Revision. */
export function listVersionsForShot(shotId: string): Promise<VersionRead[]> {
  return vfxFetch<VersionRead[]>(`/shots/${shotId}/versions`);
}

export function listReviewNotesForVersion(
  versionId: string,
): Promise<ReviewNoteRead[]> {
  return vfxFetch<ReviewNoteRead[]>(`/versions/${versionId}/review-notes`);
}

/** This Shot's full Cross-role Assessment history, newest first --
 * distinct from the narrower per-Version+Task listing used during
 * generation. Each row already carries its own `intent_signal` and
 * (when one exists) `re_anchor_proposal`. */
export function listCrossRoleAssessmentsForShot(
  shotId: string,
): Promise<CrossRoleAssessmentRead[]> {
  return vfxFetch<CrossRoleAssessmentRead[]>(
    `/intent/shots/${shotId}/cross-role-assessments`,
  );
}

/** Generates a real Cross-role Assessment for a Version+Task pair --
 * VFX Supervisor only (enforced authoritatively in
 * `agents.cross_role_assessment_service.generate_cross_role_assessment`,
 * not just here). Never fabricated client-side: the returned assessment
 * is exactly what the Core Agent persisted. */
export function generateCrossRoleAssessment(
  versionId: string,
  payload: CrossRoleAssessmentGenerateRequest,
  actorHeaders: ActorHeaders,
): Promise<CrossRoleAssessmentRead> {
  return vfxFetch<CrossRoleAssessmentRead>(
    `/intent/versions/${versionId}/cross-role-assessments/generate`,
    mutationInit("POST", payload, actorHeaders),
  );
}

/** The real, persisted chronological Activity timeline for a Shot --
 * see `intent_core_api.activity.service` for what it is assembled from. */
export function getShotActivity(shotId: string): Promise<ShotActivityRead> {
  return vfxFetch<ShotActivityRead>(`/shots/${shotId}/activity`);
}

/** `GET /vfx/inbox` -- the full Alignment Inbox, real Shots only,
 * honest empty `items` array when none exist. */
export async function fetchVfxInbox(): Promise<VfxInboxRead> {
  return vfxFetch<VfxInboxRead>("/vfx/inbox");
}

/** `GET /vfx/inbox/{shot_id}` -- one Shot's derived Inbox row, reusing
 * the exact same backend Current-focus derivation the Inbox itself
 * uses (docs/step-7/16_STEP_7C0D_...md §16's "smallest honest
 * architecture": the Shot Overview never re-derives Current focus in
 * TypeScript). Returns `null` on a real 404 (Shot not found) --
 * distinguished from a thrown `VfxApiError` for any other failure, so
 * callers can render "not found" and "unavailable" differently. */
export async function fetchVfxInboxItem(
  shotId: string,
): Promise<VfxInboxItemRead | null> {
  try {
    return await vfxFetch<VfxInboxItemRead>(`/vfx/inbox/${shotId}`);
  } catch (error) {
    if (error instanceof VfxApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Role-authorized, read-only Anchor Context projection for one Shot. */
export function fetchVfxAnchorContext(
  shotId: string,
  actorHeaders: ActorHeaders,
): Promise<AnchorContextRead> {
  return vfxFetch<AnchorContextRead>(`/vfx/shots/${shotId}/anchor-context`, {
    headers: actorHeaders,
  });
}

export async function fetchVfxAnchorContextOrNull(
  shotId: string,
  actorHeaders: ActorHeaders,
): Promise<AnchorContextRead | null> {
  try {
    return await fetchVfxAnchorContext(shotId, actorHeaders);
  } catch {
    return null;
  }
}

/** One bounded, role-authorized compact read for multi-Shot surfaces. */
export function fetchVfxAnchorContextSummaries(
  actorHeaders: ActorHeaders,
  options: { limit?: number; scope?: "all" | "triage" } = {},
): Promise<AnchorContextSummaryListRead> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 200),
    scope: options.scope ?? "all",
  });
  return vfxFetch<AnchorContextSummaryListRead>(
    `/vfx/anchor-contexts?${params}`,
    { headers: actorHeaders },
  );
}

/** `GET /vfx/shots/{shot_id}/department-execution-overview` (Step 9B-3)
 * -- role-gated server-side (VFX Supervisor only), so this call requires
 * the same trusted, server-resolved Actor headers every mutation in this
 * module already requires -- never client-supplied (matches the exact
 * precedent `features/cg/api.ts`'s `listExecutionAnchorRevisionDecisions`
 * already established for a role-gated *read*). Returns `null` on a real
 * 404 (Shot not found), distinguished from a thrown `VfxApiError` for any
 * other failure -- matches `fetchVfxInboxItem`'s own convention. */
export async function fetchDepartmentExecutionOverview(
  shotId: string,
  actorHeaders: ActorHeaders,
): Promise<DepartmentExecutionOverviewRead | null> {
  try {
    return await vfxFetch<DepartmentExecutionOverviewRead>(
      `/vfx/shots/${shotId}/department-execution-overview`,
      { headers: actorHeaders },
    );
  } catch (error) {
    if (error instanceof VfxApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** `GET /vfx/shots/{shot_id}/versions/{version_id}/media` (Step 9B-4) --
 * transient, read-only ftrack media resolution for one Production
 * Version, Shot-scoped. Role-gated server-side (VFX Supervisor only),
 * so this call requires trusted, server-resolved Actor headers -- never
 * client-supplied. The underlying `vfxFetch` already sends `cache:
 * "no-store"` (no persistent caching of the resolved, transient/signed
 * URLs). Returns `null` on a real 404 (Shot or Version not found/not in
 * this Shot), distinguished from a thrown `VfxApiError` for any other
 * failure. */
export async function fetchVersionMedia(
  shotId: string,
  versionId: string,
  actorHeaders: ActorHeaders,
): Promise<VersionMediaRead | null> {
  try {
    return await vfxFetch<VersionMediaRead>(
      `/vfx/shots/${shotId}/versions/${versionId}/media`,
      { headers: actorHeaders },
    );
  } catch (error) {
    if (error instanceof VfxApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
