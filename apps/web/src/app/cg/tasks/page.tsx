import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CgInboxRead } from "@intent-core/contracts";

import { fetchCgInbox } from "@/features/cg/api";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../demo/actions";
import { TasksListPage } from "./TasksListPage";

export default async function Page() {
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  try {
    inbox = await fetchCgInbox();
  } catch {
    inbox = null;
  }

  return <TasksListPage inbox={inbox} onExitRole={exitRoleView} />;
}
