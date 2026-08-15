import { redirect } from "next/navigation";
import type { VfxInboxRead } from "@intent-core/contracts";

import { resolveIdentity } from "@/features/session/identity";
import { fetchVfxInbox } from "@/features/vfx/api";
import { ShotsListPage } from "./ShotsListPage";

/** The middleware (src/middleware.ts) is the authoritative route
 * guard; this check is a defense-in-depth double check, not the
 * primary gate. The Shots catalogue is an object browser -- it no
 * longer needs the Anchor Context Summary fetch Home/Inbox still use
 * for Human-action routing; every field the catalogue shows lives
 * directly on `VfxInboxRead`. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "vfx_supervisor") {
    redirect("/");
  }

  let inbox: VfxInboxRead | null;
  try {
    inbox = await fetchVfxInbox();
  } catch {
    inbox = null;
  }

  return <ShotsListPage inbox={inbox} />;
}
