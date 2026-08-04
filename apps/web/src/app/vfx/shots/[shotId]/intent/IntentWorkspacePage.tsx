import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import type { IntentWorkspaceData } from "@/features/vfx/intent-workspace/data";
import {
  AuthorityBoundary,
  AuthorityLabel,
  AgentContributionPanel,
  EvidenceLayerSection,
} from "@/design";
import {
  createCoreAnchorDraftFromConfirmedAction,
  createCoreAnchorDraftFromDecompositionAction,
  generateCoreAnchorDraftAction,
  startBlankCoreAnchorDraftAction,
} from "@/features/vfx/intent-workspace/actions";
import { VfxShotWorkspaceFrame } from "../VfxShotWorkspaceFrame";
import { ConfirmedAnchorSummary } from "./ConfirmedAnchorSummary";
import { CoreAnchorRevisionEditor } from "./CoreAnchorRevisionEditor";
import { IntentEvidenceDisclosures } from "./IntentEvidenceDisclosures";
import { IntentInitialEmptyState } from "./IntentInitialEmptyState";
import { ReturnToShotOverviewLink } from "./ReturnToShotOverviewLink";
import { StartDraftButton } from "./StartDraftButton";
import { GenerateIntentCapabilityButton } from "./GenerateIntentCapabilityButton";
import {
  generateContextReconstructionAction,
  generateIntentDecompositionAction,
} from "@/features/vfx/intent-workspace/actions";
import styles from "./IntentWorkspacePage.module.css";

/** `/vfx/shots/:shotId/intent` -- the VFX Intent Workspace (Step 7C-2;
 * docs/step-7/16_STEP_7C0D_...md §7). Reuses the exact same production-
 * context header and contextual tabs as the Shot Overview (Step 7C-1) --
 * never a duplicated implementation. Locked vertical order: header ->
 * tabs -> one restrained authority line -> comparison/confirmed-only
 * region -> change summary -> rationale and actions -> Evidence/
 * advisory disclosures. */
export function IntentWorkspacePage({
  shotId,
  data,
  anchorContext,
  unavailable,
  justConfirmed = false,
  onExitRole,
}: {
  shotId: string;
  data: IntentWorkspaceData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  /** True only when the server has validated `?justConfirmed=` names the
   * Shot's real, current confirmed revision (Step 7C-2) -- see
   * `page.tsx`. */
  justConfirmed?: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  const hasRevisionHistory = Boolean(
    data?.draftRevision || data?.confirmedRevision,
  );

  return (
    <VfxShotWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="intent"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          <div className={styles.authorityLine}>
            <AuthorityBoundary
              tone="human"
              label={<AuthorityLabel variant="human-intent" />}
              ownerLabel="The Human VFX Supervisor"
              statement="owns Core Anchor confirmation. The Core Agent may propose or support a draft, but a draft is never active intent until a Human VFX Supervisor confirms it."
            />
          </div>

          <div className={styles.agentPreparation}>
            <AgentContributionPanel
              agent="Core Agent"
              capability="Intent Decomposition"
              state={
                data.evidenceData?.decompositions.length
                  ? "completed"
                  : data.evidenceData
                    ? "ready"
                    : "not_ready"
              }
              generatedAt={data.evidenceData?.decompositions[0]?.created_at}
              inputs={["Intent Brief and Shot context"]}
              readiness={[
                {
                  label: "Intent evidence available",
                  available: Boolean(data.item),
                },
              ]}
              output={
                data.evidenceData?.decompositions[0] ? (
                  <>
                    <p>
                      {data.evidenceData.decompositions[0].core_intent_summary}
                    </p>
                    <p>
                      {
                        data.evidenceData.decompositions[0]
                          .anchor_relevant_content
                      }
                    </p>
                    {data.evidenceData.decompositions[0].uncertainties.length >
                      0 && (
                      <p>
                        Evidence gaps:{" "}
                        {data.evidenceData.decompositions[0].uncertainties.join(
                          "; ",
                        )}
                      </p>
                    )}
                  </>
                ) : (
                  <p>No decomposition has been generated for this Shot yet.</p>
                )
              }
              authority="Advisory only; the VFX Supervisor decides what belongs in the editable Core Anchor Draft."
              nextAction={
                data.evidenceData?.decompositions.length ? (
                  "Use the decomposition in the editable Core Anchor Draft."
                ) : (
                  <GenerateIntentCapabilityButton
                    label="Generate decomposition"
                    disabled={!data.evidenceData}
                    action={generateIntentDecompositionAction.bind(
                      null,
                      shotId,
                    )}
                  />
                )
              }
            />
            <AgentContributionPanel
              agent="Core Agent"
              capability="Context Reconstruction"
              state={
                data.evidenceData?.reconstructions.length
                  ? "completed"
                  : data.evidenceData
                    ? "ready"
                    : "not_ready"
              }
              generatedAt={data.evidenceData?.reconstructions[0]?.created_at}
              inputs={["Historical and current Shot context"]}
              output={
                data.evidenceData?.reconstructions[0] ? (
                  <p>
                    {
                      data.evidenceData.reconstructions[0].reconstructed_context
                        .context_summary
                    }
                  </p>
                ) : (
                  <p>
                    No context reconstruction has been generated for this Shot
                    yet.
                  </p>
                )
              }
              authority="Advisory context summary; it cannot establish or confirm a Core Anchor."
              nextAction={
                data.evidenceData?.reconstructions.length ? (
                  "Use the reconstructed context to review the Draft and unresolved questions."
                ) : (
                  <GenerateIntentCapabilityButton
                    label="Generate context reconstruction"
                    disabled={!data.evidenceData}
                    action={generateContextReconstructionAction.bind(
                      null,
                      shotId,
                    )}
                  />
                )
              }
            />
            <AgentContributionPanel
              agent="Core Agent"
              capability="Core Anchor Draft"
              state={
                data.draftRevision
                  ? "completed"
                  : data.evidenceData
                    ? "ready"
                    : "not_ready"
              }
              generatedAt={data.draftRevision?.created_at}
              inputs={[
                "Intent evidence",
                data.item.shot_name,
                data.draftRevision
                  ? `Draft R${data.draftRevision.revision_number}`
                  : "No active Draft",
              ]}
              readiness={[
                {
                  label: "Intent evidence available",
                  available: Boolean(data.evidenceData),
                },
              ]}
              output={
                data.draftRevision ? (
                  <p>
                    An editable Core Anchor Draft R
                    {data.draftRevision.revision_number} is active. Source
                    provenance is shown only when recorded.
                  </p>
                ) : (
                  <p>No Core Anchor Draft has been generated yet.</p>
                )
              }
              authority="Advisory proposal only; the Human VFX Supervisor reviews, edits, and confirms the Draft."
              nextAction={
                data.draftRevision ? (
                  "Review or edit the active Core Anchor Draft."
                ) : data.evidenceData ? (
                  <>
                    <GenerateIntentCapabilityButton
                      label="Generate Core Anchor draft"
                      action={generateCoreAnchorDraftAction.bind(null, shotId)}
                    />
                    {data.evidenceData.decompositions[0] && (
                      <GenerateIntentCapabilityButton
                        label="Use decomposition to create Draft"
                        action={createCoreAnchorDraftFromDecompositionAction.bind(
                          null,
                          data.evidenceData.decompositions[0].id,
                        )}
                      />
                    )}
                  </>
                ) : (
                  "Provide Intent evidence before generating a Core Anchor Draft."
                )
              }
            />
          </div>

          {data.draftRevision ? (
            <CoreAnchorRevisionEditor
              shotId={shotId}
              shotName={data.item.shot_name}
              item={data.item}
              confirmedRevision={data.confirmedRevision}
              draftRevision={data.draftRevision}
              humanGate={data.draftHumanGate}
              evidenceData={data.evidenceData}
            />
          ) : data.confirmedRevision ? (
            <>
              <ConfirmedAnchorSummary
                revision={data.confirmedRevision}
                previousConfirmedRevision={data.previousConfirmedRevision}
                justConfirmed={justConfirmed}
                evidenceData={data.evidenceData}
                decisionRationale={data.confirmedDecisionRationale}
              />
              <div className={styles.confirmedActions}>
                {justConfirmed && <ReturnToShotOverviewLink shotId={shotId} />}
                <StartDraftButton
                  label="Create new revision"
                  pendingLabel="Starting…"
                  action={createCoreAnchorDraftFromConfirmedAction.bind(
                    null,
                    shotId,
                  )}
                />
              </div>
            </>
          ) : (
            <IntentInitialEmptyState
              item={data.item}
              evidenceData={data.evidenceData}
              startDraftAction={startBlankCoreAnchorDraftAction.bind(
                null,
                shotId,
              )}
            />
          )}

          {data.evidenceData && (
            <EvidenceLayerSection kind="agent-interpretation">
              <IntentEvidenceDisclosures data={data.evidenceData} />
            </EvidenceLayerSection>
          )}

          {hasRevisionHistory && (
            <p className={styles.activityLink}>
              <Link href={`/vfx/shots/${shotId}/activity`}>
                View full revision history in Activity
              </Link>
            </p>
          )}
        </>
      )}
    </VfxShotWorkspaceFrame>
  );
}
