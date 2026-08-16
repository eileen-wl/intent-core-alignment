import { redirect } from "next/navigation";

import {
  loadActivityWorkspaceData,
  type ActivityWorkspaceData,
} from "@/features/vfx/activity-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { ActivityWorkspacePage } from "./ActivityWorkspacePage";

/** `/vfx/shots/:shotId/activity` (Step 7C-3) -- the Shot's real
 * chronological activity timeline. The role gate itself already ran in
 * `app/vfx/layout.tsx`; this repeats the same defensive,
 * unreachable-in-practice check. */
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

  let data: ActivityWorkspaceData | null = null;
  try {
    data = await loadActivityWorkspaceData(shotId);
  } catch {
    data = null;
  }

  return <ActivityWorkspacePage data={data} />;
}
