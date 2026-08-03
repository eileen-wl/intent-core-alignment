import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadFeedbackHistoryData } from "@/features/artist/feedback-history/data";
import { fetchArtistAnchorContextOrNull } from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { FeedbackHistoryPage } from "./FeedbackHistoryPage";

export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "artist") {
    redirect("/demo");
  }

  try {
    const identity = await resolveIdentity();
    if (identity === null) redirect("/demo");
    const [data, anchorContext] = await Promise.all([
      loadFeedbackHistoryData(taskId),
      fetchArtistAnchorContextOrNull(taskId, actorHeaders(identity)),
    ]);
    return (
      <FeedbackHistoryPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
        unavailable={false}
        onExitRole={exitRoleView}
      />
    );
  } catch {
    return (
      <FeedbackHistoryPage
        taskId={taskId}
        data={null}
        anchorContext={null}
        unavailable
        onExitRole={exitRoleView}
      />
    );
  }
}
