import { redirect } from "next/navigation";
import type { ArtistInboxRead } from "@intent-core/contracts";

import { fetchArtistInbox } from "@/features/artist/api";
import { resolveIdentity } from "@/features/session/identity";
import { TasksListPage } from "./TasksListPage";

/** The Tasks catalogue is an object browser -- it no longer needs the
 * Anchor Context Summary fetch Home/Inbox still use for Human-action
 * routing; every field the catalogue shows lives directly on
 * `ArtistInboxRead`. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/demo");
  }

  let inbox: ArtistInboxRead | null;
  try {
    inbox = await fetchArtistInbox();
  } catch {
    inbox = null;
  }

  return <TasksListPage inbox={inbox} />;
}
