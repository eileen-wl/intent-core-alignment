import type { IntentWorkspaceData } from "@/features/vfx/intent-workspace/data";
import {
  AppShell,
  AuthorityBoundary,
  AuthorityLabel,
  Breadcrumbs,
  ContextTabs,
  ErrorState,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import {
  createCoreAnchorDraftFromConfirmedAction,
  startBlankCoreAnchorDraftAction,
} from "@/features/vfx/intent-workspace/actions";
import { ProductionContextHeader } from "../../ProductionContextHeader";
import { ConfirmedAnchorSummary } from "./ConfirmedAnchorSummary";
import { CoreAnchorRevisionEditor } from "./CoreAnchorRevisionEditor";
import { IntentEvidenceDisclosures } from "./IntentEvidenceDisclosures";
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
  unavailable,
  onExitRole,
}: {
  shotId: string;
  data: IntentWorkspaceData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs items={[{ label: "Alignment Inbox", href: "/vfx" }, { label: "Intent" }]} />
          <ErrorState
            title={unavailable ? "This Shot is unavailable" : "This Shot could not be found"}
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Shot does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: "Alignment Inbox", href: "/vfx" },
              { label: data.item.project_name },
              { label: data.item.shot_name },
              { label: "Intent" },
            ]}
          />
          <ProductionContextHeader item={data.item} />
          <ContextTabs
            activeTabId="intent"
            tabs={[
              { id: "overview", label: "Overview", href: `/vfx/shots/${data.item.shot_id}` },
              { id: "intent", label: "Intent", href: `/vfx/shots/${data.item.shot_id}/intent` },
              { id: "versions", label: "Versions", href: `/vfx/shots/${data.item.shot_id}/versions` },
              { id: "alignment", label: "Alignment", href: `/vfx/shots/${data.item.shot_id}/alignment` },
              { id: "activity", label: "Activity", href: `/vfx/shots/${data.item.shot_id}/activity` },
            ]}
          />

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
              confirmedRevision={data.confirmedRevision}
              draftRevision={data.draftRevision}
              humanGate={data.draftHumanGate}
            />
          ) : data.confirmedRevision ? (
            <>
              <ConfirmedAnchorSummary revision={data.confirmedRevision} />
              <StartDraftButton
                label="Create new revision"
                pendingLabel="Starting…"
                action={createCoreAnchorDraftFromConfirmedAction.bind(null, shotId)}
              />
            </>
          ) : (
            <>
              <p className={styles.neverConfirmed}>
                No Core Anchor has been confirmed for this Shot yet.
              </p>
              <StartDraftButton
                label="Start a Core Anchor"
                pendingLabel="Starting…"
                action={startBlankCoreAnchorDraftAction.bind(null, shotId)}
              />
            </>
          )}

          {data.evidenceData && <IntentEvidenceDisclosures data={data.evidenceData} />}

          <p className={styles.activityLink}>
            <a href={`/vfx/shots/${data.item.shot_id}/activity`}>
              View full revision history in Activity
            </a>
          </p>
        </>
      )}
    </AppShell>
  );
}
