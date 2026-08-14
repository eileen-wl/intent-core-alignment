import { redirect } from "next/navigation";

import { loadFeedbackHistoryData } from "@/features/artist/feedback-history/data";
import { resolveIdentity } from "@/features/session/identity";
import { FeedbackHistoryPage } from "./FeedbackHistoryPage";

/** The role gate itself already ran in `app/artist/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check. */
export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/demo");
  }

  try {
    const data = await loadFeedbackHistoryData(taskId);
    return <FeedbackHistoryPage data={data} />;
  } catch {
    return <FeedbackHistoryPage data={null} />;
  }
}
