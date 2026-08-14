import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryListRead,
  ArtistInboxRead,
} from "@intent-core/contracts";

import {
  fetchArtistAnchorContextSummaries,
  fetchArtistInbox,
} from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { ArtistWorkspacePage } from "./ArtistWorkspacePage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate, matching `app/cg/page.tsx`'s identical pattern. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/demo");
  }

  let inbox: ArtistInboxRead | null;
  let readyTasks: AnchorContextSummaryListRead | null = null;
  let waitingTasks: AnchorContextSummaryListRead | null = null;
  try {
    [inbox, readyTasks, waitingTasks] = await Promise.all([
      fetchArtistInbox(),
      fetchArtistAnchorContextSummaries(actorHeaders(identity), {
        limit: 5,
        scope: "ready",
      }),
      fetchArtistAnchorContextSummaries(actorHeaders(identity), {
        limit: 5,
        scope: "waiting",
      }),
    ]);
  } catch {
    inbox = null;
  }

  return (
    <ArtistWorkspacePage
      inbox={inbox}
      readyTasks={readyTasks}
      waitingTasks={waitingTasks}
    />
  );
}
