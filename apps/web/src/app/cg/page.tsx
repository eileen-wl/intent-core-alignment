import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CgInboxRead } from "@intent-core/contracts";

import { fetchCgInbox } from "@/features/cg/api";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../demo/actions";
import { CgWorkspacePage } from "./CgWorkspacePage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate, matching `app/vfx/page.tsx`'s identical pattern. */
export default async function Page() {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  try {
    inbox = await fetchCgInbox();
  } catch {
    inbox = null;
  }

  return <CgWorkspacePage inbox={inbox} onExitRole={exitRoleView} />;
}
