import { redirect } from "next/navigation";
import type {
  AnchorContextRead,
  ArtistInboxRead,
} from "@intent-core/contracts";

import {
  fetchArtistAnchorContextMap,
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
  let anchorContexts: Record<string, AnchorContextRead | null> = {};
  try {
    inbox = await fetchArtistInbox();
    anchorContexts = await fetchArtistAnchorContextMap(
      inbox.items.map((item) => item.task_id),
      actorHeaders(identity),
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
