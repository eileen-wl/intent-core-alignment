import { redirect } from "next/navigation";
import type { AnchorContextRead, CgInboxRead } from "@intent-core/contracts";

import { fetchCgAnchorContextMap, fetchCgInbox } from "@/features/cg/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { exitRoleView } from "../../demo/actions";
import { CgReviewInboxPage } from "./CgReviewInboxPage";

export default async function Page() {
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/demo");
  }

  let inbox: CgInboxRead | null;
  let anchorContexts: Record<string, AnchorContextRead | null> = {};
  try {
    inbox = await fetchCgInbox();
    anchorContexts = await fetchCgAnchorContextMap(
      inbox.items.map((item) => item.task_id),
      actorHeaders(identity),
    );
  } catch {
    inbox = null;
  }

  return (
    <CgReviewInboxPage
      inbox={inbox}
      anchorContexts={anchorContexts}
      onExitRole={exitRoleView}
    />
  );
}
