import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadFeedbackHistoryData } from "@/features/artist/feedback-history/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
import { exitRoleView } from "../../../../demo/actions";
import { FeedbackHistoryPage } from "./FeedbackHistoryPage";

export default async function Page({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "artist") {
    redirect("/demo");
  }

  try {
    const data = await loadFeedbackHistoryData(taskId);
    return (
      <FeedbackHistoryPage taskId={taskId} data={data} unavailable={false} onExitRole={exitRoleView} />
    );
  } catch {
    return (
      <FeedbackHistoryPage taskId={taskId} data={null} unavailable onExitRole={exitRoleView} />
    );
  }
}
