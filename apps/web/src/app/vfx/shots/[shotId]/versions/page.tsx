import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  loadVersionsWorkspaceData,
  type VersionsWorkspaceData,
} from "@/features/vfx/versions-workspace/data";
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
  let unavailable = false;
  try {
    data = await loadVersionsWorkspaceData(shotId);
  } catch {
    unavailable = true;
  }

  return (
    <VersionsWorkspacePage
      shotId={shotId}
      data={data}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
