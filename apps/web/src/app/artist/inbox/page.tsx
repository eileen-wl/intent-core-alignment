import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ArtistInboxRead } from "@intent-core/contracts";

import { fetchArtistInbox } from "@/features/artist/api";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../demo/actions";
import { ArtistReviewInboxPage } from "./ArtistReviewInboxPage";

export default async function Page() {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "artist") {
    redirect("/demo");
  }

  let inbox: ArtistInboxRead | null;
  try {
    inbox = await fetchArtistInbox();
  } catch {
    inbox = null;
  }

  return <ArtistReviewInboxPage inbox={inbox} onExitRole={exitRoleView} />;
}
