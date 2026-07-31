import type { VfxInboxItemRead } from "@intent-core/contracts";

import {
  AppShell,
  Breadcrumbs,
  ContextTabs,
  Divider,
  ErrorState,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { signalStateLabel } from "../../vfxWording";
import { CurrentFocusPanel } from "../CurrentFocusPanel";
import { NextFocusPanel } from "../NextFocusPanel";
import { ProductionContextHeader } from "../ProductionContextHeader";

const ALIGNMENT_FOCUS_TYPES = new Set([
  "alignment_not_followed_by_anchor_action",
  "re_anchor_proposal_present",
]);

/** `/vfx/shots/:shotId` -- the real Shot Overview (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §6). Locked order: production-context
 * header -> contextual tabs -> exactly one Current focus ->
 * zero-to-two Next-in-this-Shot items -> minimal supporting context.
 *
 * Next-in-this-Shot (Step 7C-1 targeted correction §7-§8) renders the
 * real, backend-derived `item.next_candidates` -- the remaining
 * eligible focus-type candidates below Current focus, same locked
 * six-type precedence, capped at two. `NextFocusPanel` itself renders
 * nothing when that list is empty, so the honest "zero to two" outcome
 * never produces an empty heading or list. */
export function ShotOverviewPage({
  item,
  onExitRole,
}: {
  item: VfxInboxItemRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.vfx_supervisor}
      role={ROLE_LABEL.vfx_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.vfx_supervisor}
      currentPath="/vfx/shots"
    >
      {item === null ? (
        <>
          <Breadcrumbs items={[{ label: "Shots", href: "/vfx/shots" }, { label: "Shot" }]} />
          <ErrorState
            title="This Shot is unavailable"
            description="The ICAS service could not be reached, or this Shot does not exist. Try refreshing the page."
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: item.project_name, href: "/vfx/shots" },
              { label: item.shot_name },
              { label: "Overview" },
            ]}
          />
          <ProductionContextHeader item={item} />
          <ContextTabs
            activeTabId="overview"
            tabs={[
              { id: "overview", label: "Overview", href: `/vfx/shots/${item.shot_id}` },
              { id: "intent", label: "Intent", href: `/vfx/shots/${item.shot_id}/intent` },
              {
                id: "versions",
                label: "Versions",
                href: `/vfx/shots/${item.shot_id}/versions`,
                implemented: false,
              },
              {
                id: "alignment",
                label: "Alignment",
                href: `/vfx/shots/${item.shot_id}/alignment`,
                implemented: false,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/vfx/shots/${item.shot_id}/activity`,
                implemented: false,
              },
            ]}
          />

          <CurrentFocusPanel focus={item.current_focus} />

          <NextFocusPanel items={item.next_candidates ?? []} />

          <Divider />

          <dl>
            <dt>Confirmed Core Anchor</dt>
            <dd>{item.active_core_anchor_summary ?? "No confirmed Core Anchor yet."}</dd>

            <dt>Latest Version</dt>
            <dd>
              {item.relevant_version_name
                ? item.relevant_version_number
                  ? `${item.relevant_version_name} (v${item.relevant_version_number})`
                  : item.relevant_version_name
                : "No Version recorded yet."}
            </dd>

            {!ALIGNMENT_FOCUS_TYPES.has(item.current_focus.focus_type) && (
              <>
                <dt>Latest assessment</dt>
                <dd>
                  {item.latest_signal_id
                    ? `${signalStateLabel(item.latest_signal_attention_level)} -- ${item.latest_signal_summary}`
                    : "No current Intent Signal. A successful Cross-role Assessment is required."}
                </dd>
              </>
            )}
          </dl>
        </>
      )}
    </AppShell>
  );
}
