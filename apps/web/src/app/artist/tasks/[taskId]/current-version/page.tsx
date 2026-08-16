import { redirect } from "next/navigation";

import { loadCurrentVersionData } from "@/features/artist/current-version/data";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { CurrentVersionPage } from "./CurrentVersionPage";

/** The role gate itself already ran in `app/artist/layout.tsx`; this
 * repeats the same defensive, unreachable-in-practice check.
 * `?version=` selection stays a leaf-page concern -- it is forwarded
 * into `loadCurrentVersionData` exactly as before, never hoisted to the
 * persistent Task layout (a layout has no reason to know about a
 * page-local Version selection, and doing so would only reintroduce
 * the same coupling this refactor removes elsewhere). */
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
    const data = await loadCurrentVersionData(
      taskId,
      actorHeaders(identity),
      selectedVersionId,
    );
    return <CurrentVersionPage taskId={taskId} data={data} />;
  } catch {
    return <CurrentVersionPage taskId={taskId} data={null} />;
  }
}
