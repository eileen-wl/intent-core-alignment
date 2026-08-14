import { redirect } from "next/navigation";
import type {
  AnchorContextRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import { Breadcrumbs, ErrorState, type ContextTab } from "@/design";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  fetchArtistAnchorContextOrNull,
  fetchArtistInboxItem,
} from "@/features/artist/api";
import { ObjectWorkspaceChrome } from "../../../_shared/ObjectWorkspaceChrome";
import { TaskContextHeader } from "./TaskContextHeader";

function taskTabs(taskId: string): ContextTab[] {
  return [
    { id: "overview", label: "Task Overview", href: `/artist/tasks/${taskId}` },
    {
      id: "current-version",
      label: "Current Version",
      href: `/artist/tasks/${taskId}/current-version`,
    },
    {
      id: "feedback-history",
      label: "Feedback History",
      href: `/artist/tasks/${taskId}/feedback-history`,
    },
  ];
}

/** Persistent Task workspace chrome (Navigation Responsiveness Fix,
 * Phase 2) -- owns everything `ArtistTaskWorkspaceFrame` used to
 * re-render on every tab: the Task identity fetch, the Anchor Context
 * fetch, Breadcrumbs, `TaskContextHeader`, `AnchorContextLayer`, and
 * `ContextTabs`. `children` is the tab's own body only. The role gate
 * itself already ran in `app/artist/layout.tsx`; this repeats the same
 * defensive, unreachable-in-practice check. */
export default async function ArtistTaskLayout({
  params,
  children,
}: {
  params: Promise<{ taskId: string }>;
  children: ReactNode;
}) {
  const { taskId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "artist") {
    redirect("/");
  }

  let item: ArtistInboxItemRead | null = null;
  let anchorContext: AnchorContextRead | null = null;
  let unavailable = false;
  try {
    [item, anchorContext] = await Promise.all([
      fetchArtistInboxItem(taskId),
      fetchArtistAnchorContextOrNull(taskId, actorHeaders(identity)),
    ]);
  } catch {
    unavailable = true;
  }

  if (!item) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Tasks", href: "/artist/tasks" }, { label: "Task" }]}
        />
        <ErrorState
          title={
            unavailable
              ? "This Task is unavailable"
              : "This Task could not be found"
          }
          description={
            unavailable
              ? "The ICAS service could not be reached. Try refreshing the page."
              : "This Task does not exist, or its identifier is invalid."
          }
        />
      </>
    );
  }

  return (
    <ObjectWorkspaceChrome
      anchorContext={anchorContext}
      storageKey={`icas:anchor-context:artist:${item.task_id}`}
      tabs={taskTabs(item.task_id)}
      breadcrumbBase={[
        { label: item.project_name, href: "/artist/tasks" },
        { label: item.shot_name },
        { label: item.task_name },
      ]}
      contextHeader={<TaskContextHeader item={item} />}
    >
      {children}
    </ObjectWorkspaceChrome>
  );
}
