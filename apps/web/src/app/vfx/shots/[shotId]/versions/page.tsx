import { redirect } from "next/navigation";

import {
  loadVersionsWorkspaceData,
  type VersionsWorkspaceData,
} from "@/features/vfx/versions-workspace/data";
import { resolveIdentity } from "@/features/session/identity";
import { VersionsWorkspacePage } from "./VersionsWorkspacePage";

/** `/vfx/shots/:shotId/versions` (Step 7C-3) -- the Shot's production-
 * version and review-note workspace. The role gate itself already ran
 * in `app/vfx/layout.tsx`; this repeats the same defensive,
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

  let data: VersionsWorkspaceData | null = null;
  try {
    data = await loadVersionsWorkspaceData(shotId);
  } catch {
    data = null;
  }

  return <VersionsWorkspacePage shotId={shotId} data={data} />;
}
