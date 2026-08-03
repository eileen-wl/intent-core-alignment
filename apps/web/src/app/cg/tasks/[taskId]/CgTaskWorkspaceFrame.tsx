import type {
  AnchorContextRead,
  CgInboxItemRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import {
  AnchorContextLayer,
  AppShell,
  Breadcrumbs,
  ContextTabs,
  ErrorState,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { TaskContextHeader } from "./TaskContextHeader";

export type CgTaskTab =
  "overview" | "execution" | "version-review" | "dependencies" | "activity";

export function CgTaskWorkspaceFrame({
  item,
  anchorContext,
  activeTab,
  unavailable = false,
  onExitRole,
  children,
}: {
  item: CgInboxItemRead | null;
  anchorContext?: AnchorContextRead | null;
  activeTab: CgTaskTab;
  unavailable?: boolean;
  onExitRole: () => void | Promise<void>;
  children: ReactNode;
}) {
  const labels: Record<CgTaskTab, string> = {
    overview: "Overview",
    execution: "Execution",
    "version-review": "Version Review",
    dependencies: "Dependencies",
    activity: "Activity",
  };
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/tasks"
    >
      {!item ? (
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
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: item.project_name, href: "/cg/tasks" },
              { label: item.shot_name },
              { label: item.task_name },
              { label: labels[activeTab] },
            ]}
          />
          <TaskContextHeader item={item} />
          <AnchorContextLayer context={anchorContext ?? null} />
          <ContextTabs
            activeTabId={activeTab}
            tabs={[
              {
                id: "overview",
                label: "Overview",
                href: `/cg/tasks/${item.task_id}`,
              },
              {
                id: "execution",
                label: "Execution",
                href: `/cg/tasks/${item.task_id}/execution`,
              },
              {
                id: "version-review",
                label: "Version Review",
                href: `/cg/tasks/${item.task_id}/version-review`,
              },
              {
                id: "dependencies",
                label: "Dependencies",
                href: `/cg/tasks/${item.task_id}/dependencies`,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/cg/tasks/${item.task_id}/activity`,
              },
            ]}
          />
          {children}
        </>
      )}
    </AppShell>
  );
}
