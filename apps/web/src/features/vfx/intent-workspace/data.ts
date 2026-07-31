import type {
  AgentRunRead,
  ContextReconstructionRead,
  ContextSnapshotRead,
  CoreAnchorRevisionRead,
  HumanGateRead,
  IntentDecompositionRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";

import {
  fetchVfxInboxItem,
  getAgentRun,
  getContextSnapshot,
  getHumanGateForRevision,
  listContextReconstructionsForShot,
  listCoreAnchorRevisions,
  listDecisionsForRevision,
  listIntentDecompositionsForShot,
} from "@/features/vfx/api";
import type { EvidenceReferenceLike } from "@/design";

/** Bounded server-side read model for `/vfx/shots/:shotId/intent` (Step
 * 7C-2; docs/step-7/16_STEP_7C0D_...md §17). Exactly what the page needs
 * -- not the legacy monolithic Shot workflow fetch. `item` supplies the
 * same Project/Shot/Task/Version/source context the Shot Overview's
 * `ProductionContextHeader` already renders, reused rather than
 * re-derived. All fetching happens here, once, server-side -- components
 * receive already-resolved data as plain props (never an async Server
 * Component themselves), which also keeps every component here
 * synchronously renderable in tests. */
export interface IntentEvidenceData {
  evidence: EvidenceReferenceLike[];
  run: AgentRunRead | null;
  snapshot: ContextSnapshotRead | null;
  decompositions: IntentDecompositionRead[];
  reconstructions: ContextReconstructionRead[];
}

export interface IntentWorkspaceData {
  item: VfxInboxItemRead;
  /** The Shot's current confirmed revision, or `null` if none has ever
   * been confirmed yet. */
  confirmedRevision: CoreAnchorRevisionRead | null;
  /** The Shot's current draft revision (at most one can exist), or
   * `null` if none exists. */
  draftRevision: CoreAnchorRevisionRead | null;
  /** The draft's own HumanGate, when a draft exists. `null` for a
   * legacy pre-HumanGate draft (an honest, real state -- see
   * `human_gate_service`'s own documented legacy-compatibility path) or
   * when there is no draft at all. */
  draftHumanGate: HumanGateRead | null;
  /** Evidence/Provenance + advisory-input data for whichever revision
   * (draft, else confirmed) is currently relevant -- `null` when
   * neither exists yet. */
  evidenceData: IntentEvidenceData | null;
  /** The revision `confirmedRevision` superseded, if any -- derived from
   * the already-fetched revisions list below (never a second API call).
   * `null` for a first-ever confirmation, or when there is no confirmed
   * revision at all. Used only to compute an honest, real change summary
   * for the transient Just-confirmed Success state (Step 7C-2) -- never
   * fabricated. */
  previousConfirmedRevision: CoreAnchorRevisionRead | null;
  /** The real recorded rationale (if any) from the Decision that
   * confirmed `confirmedRevision` -- fetched only when there is a
   * confirmed revision and no in-progress draft (Normal Confirmed /
   * Just-confirmed Success; the two states that render
   * `ConfirmedAnchorSummary`'s Decision-and-provenance card). `null`
   * both when no confirmed revision exists and when one exists but its
   * Decision genuinely carries no rationale -- the UI must say so
   * honestly rather than treat `null` as "not loaded yet". */
  confirmedDecisionRationale: string | null;
}

async function loadEvidenceData(
  shotId: string,
  revision: CoreAnchorRevisionRead,
): Promise<IntentEvidenceData> {
  const evidence: EvidenceReferenceLike[] = [];
  if (revision.source_intent_decomposition_id) {
    evidence.push({
      source_type: "intent_decomposition",
      source_id: revision.source_intent_decomposition_id,
      label: "Source Intent Decomposition",
    });
  }
  if (revision.supersedes_revision_id) {
    evidence.push({
      source_type: "core_anchor_revision",
      source_id: revision.supersedes_revision_id,
      label: "Previous confirmed revision",
    });
  }

  const [run, snapshot, decompositions, reconstructions] = await Promise.all([
    revision.created_by_agent_run_id ? getAgentRun(revision.created_by_agent_run_id) : null,
    revision.context_snapshot_id ? getContextSnapshot(revision.context_snapshot_id) : null,
    listIntentDecompositionsForShot(shotId),
    listContextReconstructionsForShot(shotId),
  ]);

  return { evidence, run, snapshot, decompositions, reconstructions };
}

/** The confirming Decision's real rationale for a confirmed revision, or
 * `null` when none was provided -- never the reject Decision, and never
 * fabricated when the list is empty (a legacy-compatibility case the
 * same as `draftHumanGate`'s). */
async function loadConfirmedDecisionRationale(revisionId: string): Promise<string | null> {
  const decisions = await listDecisionsForRevision(revisionId);
  const confirmDecision = decisions.find((decision) => decision.decision_type === "confirm_core_anchor");
  return confirmDecision?.rationale ?? null;
}

/** Returns `null` only when the Shot itself does not exist (a real
 * 404) -- any other failure (network, 5xx) propagates as a thrown
 * `VfxApiError`, so the caller can distinguish "this Shot does not
 * exist" from "the ICAS service is unavailable right now," per the
 * locked honest-state requirement. */
export async function loadIntentWorkspaceData(shotId: string): Promise<IntentWorkspaceData | null> {
  const item = await fetchVfxInboxItem(shotId);
  if (item === null) {
    return null;
  }

  const revisions = await listCoreAnchorRevisions(shotId);
  const confirmedRevision = revisions.find((revision) => revision.status === "confirmed") ?? null;
  const draftRevision = revisions.find((revision) => revision.status === "draft") ?? null;
  const draftHumanGate = draftRevision
    ? await getHumanGateForRevision(draftRevision.id)
    : null;

  const relevantRevision = draftRevision ?? confirmedRevision;
  const evidenceData = relevantRevision ? await loadEvidenceData(shotId, relevantRevision) : null;

  const previousConfirmedRevision = confirmedRevision?.supersedes_revision_id
    ? (revisions.find((revision) => revision.id === confirmedRevision.supersedes_revision_id) ??
      null)
    : null;

  // Only fetched for Normal Confirmed / Just-confirmed Success (no
  // in-progress draft) -- the two states that actually render the
  // Decision-and-provenance card; Initial Empty, First Draft, and
  // Revision Draft have no use for it.
  const confirmedDecisionRationale =
    draftRevision === null && confirmedRevision
      ? await loadConfirmedDecisionRationale(confirmedRevision.id)
      : null;

  return {
    item,
    confirmedRevision,
    draftRevision,
    draftHumanGate,
    evidenceData,
    previousConfirmedRevision,
    confirmedDecisionRationale,
  };
}
