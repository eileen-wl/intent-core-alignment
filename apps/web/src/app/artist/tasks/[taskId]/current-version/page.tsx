import { redirect } from "next/navigation";

import { loadCurrentVersionData } from "@/features/artist/current-version/data";
import { fetchArtistAnchorContextOrNull } from "@/features/artist/api";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { exitRoleView } from "../../../../demo/actions";
import { CurrentVersionPage } from "./CurrentVersionPage";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { taskId } = await params;
  const { version: selectedVersionId } = await searchParams;
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "artist") {
    redirect("/demo");
  }

  try {
    const headers = actorHeaders(identity);
    const [data, anchorContext] = await Promise.all([
      loadCurrentVersionData(taskId, headers, selectedVersionId),
      fetchArtistAnchorContextOrNull(taskId, headers),
    ]);
    return (
      <CurrentVersionPage
        taskId={taskId}
        data={data}
        anchorContext={anchorContext}
        unavailable={false}
        onExitRole={exitRoleView}
      />
    );
  } catch {
    return (
      <CurrentVersionPage
        taskId={taskId}
        data={null}
        anchorContext={null}
        unavailable
        onExitRole={exitRoleView}
      />
    );
  }
}
