import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  loadAlignmentWorkspaceData,
  type AlignmentWorkspaceData,
} from "@/features/vfx/alignment-workspace/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { AlignmentWorkspacePage } from "./AlignmentWorkspacePage";

/** `/vfx/shots/:shotId/alignment` (Step 7C-3) -- whether the reviewed
 * production work aligns with the active Core Anchor. Same defence-in-
 * depth route guard and honest not-found/unavailable distinction as
 * every other Step 7C Shot route. */
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

  let data: AlignmentWorkspaceData | null = null;
  let unavailable = false;
  try {
    data = await loadAlignmentWorkspaceData(shotId);
  } catch {
    unavailable = true;
  }

  return (
    <AlignmentWorkspacePage
      shotId={shotId}
      data={data}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
