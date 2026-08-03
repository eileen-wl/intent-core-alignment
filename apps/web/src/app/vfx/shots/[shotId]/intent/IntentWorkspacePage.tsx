import Link from "next/link";
import type { AnchorContextRead } from "@intent-core/contracts";

import type { IntentWorkspaceData } from "@/features/vfx/intent-workspace/data";
import {
  AuthorityBoundary,
  AuthorityLabel,
  EvidenceLayerSection,
} from "@/design";
import {
  createCoreAnchorDraftFromConfirmedAction,
  startBlankCoreAnchorDraftAction,
} from "@/features/vfx/intent-workspace/actions";
import { VfxShotWorkspaceFrame } from "../VfxShotWorkspaceFrame";
import { ConfirmedAnchorSummary } from "./ConfirmedAnchorSummary";
import { CoreAnchorRevisionEditor } from "./CoreAnchorRevisionEditor";
import { IntentEvidenceDisclosures } from "./IntentEvidenceDisclosures";
import { IntentInitialEmptyState } from "./IntentInitialEmptyState";
import { ReturnToShotOverviewLink } from "./ReturnToShotOverviewLink";
import { StartDraftButton } from "./StartDraftButton";
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
