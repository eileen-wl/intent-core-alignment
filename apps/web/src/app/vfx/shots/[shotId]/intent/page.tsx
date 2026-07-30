import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadIntentWorkspaceData, type IntentWorkspaceData } from "@/features/vfx/intent-workspace/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { IntentWorkspacePage } from "./IntentWorkspacePage";

/** `/vfx/shots/:shotId/intent` -- the VFX Intent Workspace (Step 7C-2;
 * docs/step-7/16_STEP_7C0D_...md §7). Same defence-in-depth route guard
 * as the Shot Overview: `middleware.ts` is the authoritative check.
 *
 * Distinguishes an honest not-found Shot (a real 404 from the backend)
 * from an honest unavailable state (the API could not be reached) --
 * `loadIntentWorkspaceData` returns `null` only for the former; any
 * other failure is a thrown `VfxApiError`, caught here as the latter. */
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

  let data: IntentWorkspaceData | null = null;
  let unavailable = false;
  try {
    data = await loadIntentWorkspaceData(shotId);
  } catch {
    unavailable = true;
  }

  return (
    <IntentWorkspacePage
      shotId={shotId}
      data={data}
      unavailable={unavailable}
      onExitRole={exitRoleView}
    />
  );
}
