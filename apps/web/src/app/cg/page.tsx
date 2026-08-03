import { redirect } from "next/navigation";
import type { AnchorContextRead, CgInboxRead } from "@intent-core/contracts";

import { fetchCgAnchorContextMap, fetchCgInbox } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { exitRoleView } from "../demo/actions";
import { CgWorkspacePage } from "./CgWorkspacePage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate, matching `app/vfx/page.tsx`'s identical pattern. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  let anchorContexts: Record<string, AnchorContextRead | null> = {};
  try {
    inbox = await fetchCgInbox();
    anchorContexts = await fetchCgAnchorContextMap(
      inbox.items.map((item) => item.task_id),
      actorHeaders(identity),
    );
  } catch {
    inbox = null;
  }

  return (
    <CgWorkspacePage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
