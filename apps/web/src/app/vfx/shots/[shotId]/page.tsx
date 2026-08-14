import { redirect } from "next/navigation";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { fetchVfxAnchorContextOrNull } from "@/features/vfx/api";
import { loadShotOverviewData } from "@/features/vfx/shot-overview/data";
import { selectCurrentCreativeDirection } from "@/features/vfx/shot-overview/selectCurrentCreativeDirection";
import { ShotOverviewPage } from "./ShotOverviewPage";

/** Route-object validation: `shotId` is resolved server-side via the
 * exact same backend Current-focus derivation the Inbox itself uses
 * (docs/step-7/16_STEP_7C0D_...md §16) -- a Shot that does not exist
 * results in an honest not-found treatment on the page, not a
 * fabricated Overview. The role gate itself already ran in
 * `app/vfx/layout.tsx`; this repeats the same defensive,
 * unreachable-in-practice check purely so `identity` narrows to
 * non-null for `actorHeaders` (Step 9B-3's Department Execution
 * Overview call is role-gated server-side).
 *
 * `anchorContext` is fetched again here even though
 * `app/vfx/shots/[shotId]/layout.tsx` already fetches it once for the
 * persistent chrome: `ShotOverviewPage`'s own body (not just chrome)
 * reads `anchorContext.next_action` to decide whether to also show a
 * page-specific Current-focus panel, so it genuinely needs the value as
 * page-level data. Next.js has no mechanism for a layout to pass
 * fetched data down into a page component's props (`children` is
 * already-rendered output, not a data channel) -- this is a
 * deliberate, documented exception (the persistent-workspace-
 * architecture audit and its follow-up implementation call this out
 * explicitly), not an oversight. */
export default async function Page({
  params,
}: {
  params: Promise<{ shotId: string }>;
}) {
  const { shotId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/demo");
  }

  let data: Awaited<ReturnType<typeof loadShotOverviewData>> = null;
  let anchorContext: Awaited<ReturnType<typeof fetchVfxAnchorContextOrNull>> =
    null;
  try {
    const headers = actorHeaders(identity);
    [data, anchorContext] = await Promise.all([
      loadShotOverviewData(shotId, headers),
      fetchVfxAnchorContextOrNull(shotId, headers),
    ]);
  } catch {
    data = null;
  }

  return (
    <ShotOverviewPage
      item={data?.item ?? null}
      anchorContext={anchorContext}
      workingDirection={data ? selectCurrentCreativeDirection(data) : undefined}
      departmentExecutionOverview={data?.departmentExecutionOverview ?? null}
    />
  );
}
