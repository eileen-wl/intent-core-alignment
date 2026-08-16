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
import { VfxWorkspacePage } from "./VfxWorkspacePage";

/** The role gate itself now lives in `app/vfx/layout.tsx`
 * (`RoleWorkspaceLayout`), which wraps this page -- by the time this
 * component runs, `identity.role === "vfx_supervisor"` is already
 * guaranteed. `resolveIdentity()` is still called directly here (not
 * threaded down from the layout) since Next.js layouts and pages are
 * independent Server Components with no prop-passing between them; the
 * `redirect` below is an unreachable-in-practice defensive fallback
 * (matching the layout's own check) purely so `identity` narrows to
 * non-null for `actorHeaders`, not a second real gate. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/");
  }

  let inbox: VfxInboxRead | null;
  let anchorActions: AnchorContextSummaryListRead | null = null;
  try {
    [inbox, anchorActions] = await Promise.all([
      fetchVfxInbox(),
      fetchVfxAnchorContextSummaries(actorHeaders(identity), {
        limit: 5,
        scope: "triage",
      }),
    ]);
  } catch {
    inbox = null;
  }

  return <VfxWorkspacePage inbox={inbox} anchorActions={anchorActions} />;
}
