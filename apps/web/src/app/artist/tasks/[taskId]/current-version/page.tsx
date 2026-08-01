import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadCurrentVersionData } from "@/features/artist/current-version/data";
import { DEMO_ROLE_COOKIE } from "@/lib/demoIdentity";
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
  const store = await cookies();
  if (store.get(DEMO_ROLE_COOKIE)?.value !== "artist") {
    redirect("/demo");
  }

  try {
    const data = await loadCurrentVersionData(taskId, selectedVersionId);
    return (
      <CurrentVersionPage taskId={taskId} data={data} unavailable={false} onExitRole={exitRoleView} />
    );
  } catch {
    return (
      <CurrentVersionPage taskId={taskId} data={null} unavailable onExitRole={exitRoleView} />
    );
  }
}
