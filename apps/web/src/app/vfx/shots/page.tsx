import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { VfxInboxRead } from "@intent-core/contracts";

import { fetchVfxInbox } from "@/features/vfx/api";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../demo/actions";
import { ShotsListPage } from "./ShotsListPage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate. */
export default async function Page() {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "vfx_supervisor") {
    redirect("/");
  }

  let inbox: VfxInboxRead | null;
  try {
    inbox = await fetchVfxInbox();
  } catch {
    inbox = null;
  }

  return <ShotsListPage inbox={inbox} onExitRole={exitRoleView} />;
}
