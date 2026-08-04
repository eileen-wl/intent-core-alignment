import { redirect } from "next/navigation";
import type {
  AnchorContextSummaryRead,
  CgInboxRead,
} from "@intent-core/contracts";

import { fetchCgAnchorContextSummaries, fetchCgInbox } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { exitRoleView } from "../../demo/actions";
import { TasksListPage } from "./TasksListPage";

export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  let anchorContexts: Record<string, AnchorContextSummaryRead | null> = {};
  try {
    const [inboxResult, summaryResult] = await Promise.all([
      fetchCgInbox("icas-demo:golden"),
      fetchCgAnchorContextSummaries(actorHeaders(identity), {
        projectExternalId: "icas-demo:golden",
      }),
    ]);
    inbox = inboxResult;
    anchorContexts = Object.fromEntries(
      summaryResult.items.map((item) => [item.task_id ?? "", item]),
    );
  } catch {
    inbox = null;
  }

  return (
    <TasksListPage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
