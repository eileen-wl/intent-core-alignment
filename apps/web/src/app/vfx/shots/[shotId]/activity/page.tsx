import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  loadActivityWorkspaceData,
  type ActivityWorkspaceData,
} from "@/features/vfx/activity-workspace/data";
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
  let unavailable = false;
  try {
    data = await loadActivityWorkspaceData(shotId);
  } catch {
    unavailable = true;
  }

  return (
    <ActivityWorkspacePage
      shotId={shotId}
      data={data}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
