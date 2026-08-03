import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryRead,
  ArtistInboxRead,
} from "@intent-core/contracts";

import {
  fetchArtistAnchorContextSummaries,
  fetchArtistInbox,
} from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { exitRoleView } from "../../demo/actions";
import { ArtistReviewInboxPage } from "./ArtistReviewInboxPage";

export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/demo");
  }

  let inbox: ArtistInboxRead | null;
  let anchorContexts: Record<string, AnchorContextSummaryRead | null> = {};
  try {
    const [inboxResult, summaryResult] = await Promise.all([
      fetchArtistInbox(),
      fetchArtistAnchorContextSummaries(actorHeaders(identity)),
    ]);
    inbox = inboxResult;
    anchorContexts = Object.fromEntries(
      summaryResult.items.map((item) => [item.task_id ?? "", item]),
    );
  } catch {
    inbox = null;
  }

  return (
    <ArtistReviewInboxPage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
