import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { VfxInboxItemRead } from "@intent-core/contracts";

import { fetchVfxInboxItem } from "@/features/vfx/api";
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

  let item: VfxInboxItemRead | null;
  try {
    item = await fetchVfxInboxItem(shotId);
  } catch {
    item = null;
  }

  return <ShotOverviewPage item={item} onExitRole={exitRoleView} />;
}
