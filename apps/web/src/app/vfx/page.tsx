import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { VfxInboxRead } from "@intent-core/contracts";

import { fetchVfxInbox } from "@/features/vfx/api";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../demo/actions";
import { VfxWorkspacePage } from "./VfxWorkspacePage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate (brief §9). */
export default async function Page() {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "vfx_supervisor") {
    redirect("/demo");
  }

  let inbox: VfxInboxRead | null;
  try {
    inbox = await fetchVfxInbox();
  } catch {
    inbox = null;
  }

  return <VfxWorkspacePage inbox={inbox} onExitRole={exitRoleView} />;
}
