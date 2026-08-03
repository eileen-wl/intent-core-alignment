import type {
  AnchorContextRead,
  DepartmentExecutionOverviewRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import Link from "next/link";

import { DetailedContext, Divider, WorkingDirectionSection } from "@/design";
import type { WorkingDirectionSection as WorkingDirectionSectionModel } from "@/lib/workingDirection";
import { signalStateLabel } from "../../vfxWording";
import { CurrentFocusPanel } from "../CurrentFocusPanel";
import { NextFocusPanel } from "../NextFocusPanel";
import { DepartmentExecutionOverviewSection } from "./DepartmentExecutionOverviewSection";
import { VfxShotWorkspaceFrame } from "./VfxShotWorkspaceFrame";

const ALIGNMENT_FOCUS_TYPES = new Set([
  "alignment_not_followed_by_anchor_action",
  "re_anchor_proposal_present",
]);

/** `/vfx/shots/:shotId` -- the real Shot Overview (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §6). Locked order: production-context
 * header -> contextual tabs -> exactly one Current focus ->
 * zero-to-two Next-in-this-Shot items -> Current Creative Direction ->
 * Department Execution Overview (Step 9B-3) -> minimal supporting context.
 *
 * Next-in-this-Shot (Step 7C-1 targeted correction §7-§8) renders the
 * real, backend-derived `item.next_candidates` -- the remaining
 * eligible focus-type candidates below Current focus, same locked
 * six-type precedence, capped at two. `NextFocusPanel` itself renders
 * nothing when that list is empty, so the honest "zero to two" outcome
 * never produces an empty heading or list. */
export function ShotOverviewPage({
  item,
  anchorContext,
  workingDirection,
  departmentExecutionOverview,
  onExitRole,
}: {
  item: VfxInboxItemRead | null;
  anchorContext?: AnchorContextRead | null;
  /** Legacy derived summary input retained for caller compatibility; the
   * expanded Anchor Context is now the single high-level briefing. */
  workingDirection?: WorkingDirectionSectionModel;
  /** Step 9B-3: the Shot's real Tasks and their execution state --
   * optional (and rendering nothing when `null`/omitted) so every
   * pre-existing caller/test keeps compiling and rendering unchanged. */
  departmentExecutionOverview?: DepartmentExecutionOverviewRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <VfxShotWorkspaceFrame
      item={item}
      anchorContext={anchorContext}
      activeTab="overview"
      onExitRole={onExitRole}
    >
      {item && (
        <>
          <CurrentFocusPanel focus={item.current_focus} />

          <NextFocusPanel items={item.next_candidates ?? []} />

          {!anchorContext && workingDirection && (
            <WorkingDirectionSection section={workingDirection} />
          )}

          <DepartmentExecutionOverviewSection
            shotId={item.shot_id}
            overview={departmentExecutionOverview ?? null}
          />

          <Divider />

          <DetailedContext>
            <dl>
              <dt>Latest Version</dt>
              <dd>
                {item.relevant_version_name ? (
                  <Link href={`/vfx/shots/${item.shot_id}/versions`}>
                    {item.relevant_version_number
                      ? `${item.relevant_version_name} (v${item.relevant_version_number})`
                      : item.relevant_version_name}
                  </Link>
                ) : (
                  "No Version recorded yet."
                )}
              </dd>

              {!ALIGNMENT_FOCUS_TYPES.has(item.current_focus.focus_type) && (
                <>
                  <dt>Latest assessment</dt>
                  <dd>
                    {item.latest_signal_id ? (
                      <Link href={`/vfx/shots/${item.shot_id}/alignment`}>
                        {signalStateLabel(item.latest_signal_attention_level)}{" "}
                        -- {item.latest_signal_summary}
                      </Link>
                    ) : (
                      "No current Intent Signal. A successful Cross-role Assessment is required."
                    )}
                  </dd>
                </>
              )}

              <dt>Activity</dt>
              <dd>
                <Link href={`/vfx/shots/${item.shot_id}/activity`}>
                  View full activity →
                </Link>
              </dd>
            </dl>
          </DetailedContext>
        </>
      )}
    </VfxShotWorkspaceFrame>
  );
}
