import { redirect } from "next/navigation";
import type {
  AnchorContextRead,
  CgInboxItemRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import { Breadcrumbs, ErrorState, type ContextTab } from "@/design";
import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  fetchCgAnchorContextOrNull,
  fetchCgInboxItem,
} from "@/features/cg/api";
import { ObjectWorkspaceChrome } from "../../../_shared/ObjectWorkspaceChrome";
import { TaskContextHeader } from "./TaskContextHeader";

function taskTabs(taskId: string): ContextTab[] {
  return [
    { id: "overview", label: "Overview", href: `/cg/tasks/${taskId}` },
    {
      id: "execution",
      label: "Execution",
      href: `/cg/tasks/${taskId}/execution`,
    },
    {
      id: "version-review",
      label: "Version Review",
      href: `/cg/tasks/${taskId}/version-review`,
    },
    {
      id: "dependencies",
      label: "Dependencies",
      href: `/cg/tasks/${taskId}/dependencies`,
    },
    { id: "activity", label: "Activity", href: `/cg/tasks/${taskId}/activity` },
  ];
}

/** Persistent Task workspace chrome (Navigation Responsiveness Fix,
 * Phase 2) -- owns everything `CgTaskWorkspaceFrame` used to re-render
 * on every tab: the Task identity fetch, the Anchor Context fetch,
 * Breadcrumbs, `TaskContextHeader`, `AnchorContextLayer`, and
 * `ContextTabs`. `children` is the tab's own body only.
 * `reviewVariantTabId="version-review"` preserves CG Version Review's
 * LOCKED `AnchorContextLayer variant="review"` treatment -- every other
 * CG tab gets the unchanged "standard" variant. The role gate itself
 * already ran in `app/cg/layout.tsx`; this repeats the same defensive,
 * unreachable-in-practice check. */
export default async function CgTaskLayout({
  params,
  children,
}: {
  params: Promise<{ taskId: string }>;
  children: ReactNode;
}) {
  const { taskId } = await params;
  const identity = await resolveIdentity();
  if (identity?.role !== "cg_supervisor") {
    redirect("/");
  }

  let item: CgInboxItemRead | null = null;
  let anchorContext: AnchorContextRead | null = null;
  let unavailable = false;
  try {
    [item, anchorContext] = await Promise.all([
      fetchCgInboxItem(taskId),
      fetchCgAnchorContextOrNull(taskId, actorHeaders(identity)),
    ]);
  } catch {
    unavailable = true;
  }

  if (!item) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Tasks", href: "/cg/tasks" }, { label: "Task" }]}
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
      storageKey={`icas:anchor-context:cg:${item.task_id}`}
      tabs={taskTabs(item.task_id)}
      breadcrumbBase={[
        { label: item.project_name, href: "/cg/tasks" },
        { label: item.shot_name },
        { label: item.task_name },
      ]}
      contextHeader={<TaskContextHeader item={item} />}
      reviewVariantTabId="version-review"
    >
      {children}
    </ObjectWorkspaceChrome>
  );
}
