import { redirect } from "next/navigation";
import type { AnchorContextRead, VfxInboxRead } from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { fetchVfxAnchorContextMap, fetchVfxInbox } from "@/features/vfx/api";
import { exitRoleView } from "../../demo/actions";
import { ReviewInboxPage } from "./ReviewInboxPage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/");
  }

  let inbox: VfxInboxRead | null;
  let anchorContexts: Record<string, AnchorContextRead | null> = {};
  try {
    inbox = await fetchVfxInbox();
    anchorContexts = await fetchVfxAnchorContextMap(
      inbox.items.map((item) => item.shot_id),
      actorHeaders(identity),
    );
  } catch {
    inbox = null;
  }

  return (
    <ReviewInboxPage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
