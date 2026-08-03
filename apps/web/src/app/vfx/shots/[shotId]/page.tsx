import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { fetchVfxAnchorContextOrNull } from "@/features/vfx/api";
import { loadShotOverviewData } from "@/features/vfx/shot-overview/data";
import { selectCurrentCreativeDirection } from "@/features/vfx/shot-overview/selectCurrentCreativeDirection";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../demo/actions";
import { ShotOverviewPage } from "./ShotOverviewPage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate (brief §9). Route-object validation: `shotId` is
 * resolved server-side via the exact same backend Current-focus
 * derivation the Inbox itself uses (docs/step-7/16_STEP_7C0D_...md
 * §16) -- a Shot that does not exist results in an honest not-found
 * treatment on the page, not a fabricated Overview. */
export default async function Page({
  params,
}: {
  params: Promise<{ shotId: string }>;
}) {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "vfx_supervisor") {
    redirect("/demo");
  }

  const { shotId } = await params;

  // Step 9B-3: the Department Execution Overview aggregate is role-gated
  // server-side (VFX Supervisor only) -- the real, trusted session
  // identity (already confirmed vfx_supervisor above) is resolved and
  // forwarded, never a client-supplied value.
  const identity = await resolveIdentity();
  if (identity === null) {
    redirect("/demo");
  }

  let data: Awaited<ReturnType<typeof loadShotOverviewData>>;
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
      onExitRole={exitRoleView}
    />
  );
}
