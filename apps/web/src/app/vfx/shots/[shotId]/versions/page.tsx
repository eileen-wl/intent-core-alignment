import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  loadVersionsWorkspaceData,
  type VersionsWorkspaceData,
} from "@/features/vfx/versions-workspace/data";
import { fetchVfxAnchorContextOrNull } from "@/features/vfx/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { VersionsWorkspacePage } from "./VersionsWorkspacePage";

/** `/vfx/shots/:shotId/versions` (Step 7C-3) -- the Shot's production-
 * version and review-note workspace. Same defence-in-depth route guard
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

  let data: VersionsWorkspaceData | null = null;
  let anchorContext: Awaited<ReturnType<typeof fetchVfxAnchorContextOrNull>> =
    null;
  let unavailable = false;
  try {
    const identity = await resolveIdentity();
    if (identity === null) redirect("/demo");
    [data, anchorContext] = await Promise.all([
      loadVersionsWorkspaceData(shotId),
      fetchVfxAnchorContextOrNull(shotId, actorHeaders(identity)),
    ]);
  } catch {
    unavailable = true;
  }

  return (
    <VersionsWorkspacePage
      shotId={shotId}
      data={data}
      anchorContext={anchorContext}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
