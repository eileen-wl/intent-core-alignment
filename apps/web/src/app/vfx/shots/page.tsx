import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryRead,
  VfxInboxRead,
} from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  fetchVfxAnchorContextSummaries,
  fetchVfxInbox,
} from "@/features/vfx/api";
import { exitRoleView } from "../../demo/actions";
import { ShotsListPage } from "./ShotsListPage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/");
  }

  let inbox: VfxInboxRead | null;
  let anchorContexts: Record<string, AnchorContextSummaryRead | null> = {};
  try {
    const [inboxResult, summaryResult] = await Promise.all([
      fetchVfxInbox("icas-demo:golden"),
      fetchVfxAnchorContextSummaries(actorHeaders(identity), {
        projectExternalId: "icas-demo:golden",
      }),
    ]);
    inbox = inboxResult;
    anchorContexts = Object.fromEntries(
      summaryResult.items.map((item) => [item.shot_id, item]),
    );
  } catch {
    inbox = null;
  }

  return (
    <ShotsListPage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
