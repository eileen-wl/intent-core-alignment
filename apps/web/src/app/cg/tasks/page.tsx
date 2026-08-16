import { redirect } from "next/navigation";
import type { CgInboxRead } from "@intent-core/contracts";

import { fetchCgInbox } from "@/features/cg/api";
import { resolveIdentity } from "@/features/session/identity";
import { TasksListPage } from "./TasksListPage";

/** The Tasks catalogue is an object browser -- it no longer needs the
 * Anchor Context Summary fetch Home/Inbox still use for Human-action
 * routing; every field the catalogue shows lives directly on
 * `CgInboxRead`. */
export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  try {
    inbox = await fetchCgInbox();
  } catch {
    inbox = null;
  }

  return <TasksListPage inbox={inbox} />;
}
