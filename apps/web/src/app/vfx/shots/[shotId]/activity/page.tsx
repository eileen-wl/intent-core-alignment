import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  loadActivityWorkspaceData,
  type ActivityWorkspaceData,
} from "@/features/vfx/activity-workspace/data";
import { fetchVfxAnchorContextOrNull } from "@/features/vfx/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { ActivityWorkspacePage } from "./ActivityWorkspacePage";

/** `/vfx/shots/:shotId/activity` (Step 7C-3) -- the Shot's real
 * chronological activity timeline. Same defence-in-depth route guard
 * and honest not-found/unavailable distinction as every other Step 7C
 * Shot route. */
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

  let data: ActivityWorkspaceData | null = null;
  let anchorContext: Awaited<ReturnType<typeof fetchVfxAnchorContextOrNull>> =
    null;
  let unavailable = false;
  try {
    const identity = await resolveIdentity();
    if (identity === null) redirect("/demo");
    [data, anchorContext] = await Promise.all([
      loadActivityWorkspaceData(shotId),
      fetchVfxAnchorContextOrNull(shotId, actorHeaders(identity)),
    ]);
  } catch {
    unavailable = true;
  }

  return (
    <ActivityWorkspacePage
      shotId={shotId}
      data={data}
      anchorContext={anchorContext}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
