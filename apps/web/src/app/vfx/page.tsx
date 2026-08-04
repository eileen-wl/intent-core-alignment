import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryListRead,
  VfxInboxRead,
} from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  fetchVfxAnchorContextSummaries,
  fetchVfxInbox,
} from "@/features/vfx/api";
import { exitRoleView } from "../demo/actions";
import { VfxWorkspacePage } from "./VfxWorkspacePage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate (brief §9). */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/demo");
  }

  let inbox: VfxInboxRead | null;
  let anchorActions: AnchorContextSummaryListRead | null = null;
  try {
    [inbox, anchorActions] = await Promise.all([
      fetchVfxInbox("icas-demo:golden"),
      fetchVfxAnchorContextSummaries(actorHeaders(identity), {
        limit: 5,
        scope: "triage",
        projectExternalId: "icas-demo:golden",
      }),
    ]);
  } catch {
    inbox = null;
  }

  return (
    <VfxWorkspacePage
      inbox={inbox}
      anchorActions={anchorActions}
      onExitRole={exitRoleView}
    />
  );
}
