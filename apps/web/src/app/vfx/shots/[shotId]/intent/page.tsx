import { redirect } from "next/navigation";

import {
  loadIntentWorkspaceData,
  type IntentWorkspaceData,
} from "@/features/vfx/intent-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { IntentWorkspacePage } from "./IntentWorkspacePage";

/** `/vfx/shots/:shotId/intent` -- the VFX Intent Workspace (Step 7C-2;
 * docs/step-7/16_STEP_7C0D_...md §7). Same defence-in-depth route guard
 * as the Shot Overview: `middleware.ts` is the authoritative check.
 *
 * Distinguishes an honest not-found Shot (a real 404 from the backend)
 * from an honest unavailable state (the API could not be reached) --
 * `loadIntentWorkspaceData` returns `null` only for the former; any
 * other failure is a thrown `VfxApiError`, caught here as the latter.
 *
 * `?justConfirmed=<revisionId>` is a transient, non-persisted signal
 * (Step 7C-2) set by `CoreAnchorRevisionEditor` right after a
 * successful Confirm -- never a database flag. It is only ever honored
 * when it names the revision that is genuinely `data.confirmedRevision`
 * *right now*; a stale, mismatched, or bookmarked value renders the
 * plain Normal Confirmed state instead. The client strips the param
 * from the visible URL once rendered, so a plain refresh never repeats
 * it. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ shotId: string }>;
  searchParams: Promise<{ justConfirmed?: string }>;
}) {
  const { shotId } = await params;
  const { justConfirmed: justConfirmedRevisionId } = await searchParams;
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/demo");
  }

  let data: IntentWorkspaceData | null = null;
  try {
    data = await loadIntentWorkspaceData(shotId);
  } catch {
    data = null;
  }

  const justConfirmed =
    justConfirmedRevisionId !== undefined &&
    data?.confirmedRevision?.id === justConfirmedRevisionId;

  return (
    <IntentWorkspacePage
      shotId={shotId}
      data={data}
      justConfirmed={justConfirmed}
    />
  );
}
