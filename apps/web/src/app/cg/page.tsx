import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryListRead,
  CgInboxRead,
} from "@intent-core/contracts";

import { fetchCgAnchorContextSummaries, fetchCgInbox } from "@/features/cg/api";
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
  let anchorActions: AnchorContextSummaryListRead | null = null;
  try {
    [inbox, anchorActions] = await Promise.all([
      fetchCgInbox("icas-demo:golden"),
      fetchCgAnchorContextSummaries(actorHeaders(identity), {
        limit: 5,
        scope: "triage",
        projectExternalId: "icas-demo:golden",
      }),
    ]);
  } catch {
    inbox = null;
  }

  return (
    <CgWorkspacePage
      inbox={inbox}
      anchorActions={anchorActions}
      onExitRole={exitRoleView}
    />
  );
}
