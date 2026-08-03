import type {
  AnchorContextRead,
  ArtistInboxItemRead,
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

export type ArtistTaskTab = "overview" | "current-version" | "feedback-history";

export function ArtistTaskWorkspaceFrame({
  item,
  anchorContext,
  activeTab,
  unavailable = false,
  onExitRole,
  children,
}: {
  item: ArtistInboxItemRead | null;
  anchorContext?: AnchorContextRead | null;
  activeTab: ArtistTaskTab;
  unavailable?: boolean;
  onExitRole: () => void | Promise<void>;
  children: ReactNode;
}) {
  const labels: Record<ArtistTaskTab, string> = {
    overview: "Task Overview",
    "current-version": "Current Version",
    "feedback-history": "Feedback History",
  };
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist/tasks"
    >
      {!item ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Tasks", href: "/artist/tasks" },
              { label: "Task" },
            ]}
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
              { label: item.project_name, href: "/artist/tasks" },
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
                label: "Task Overview",
                href: `/artist/tasks/${item.task_id}`,
              },
              {
                id: "current-version",
                label: "Current Version",
                href: `/artist/tasks/${item.task_id}/current-version`,
              },
              {
                id: "feedback-history",
                label: "Feedback History",
                href: `/artist/tasks/${item.task_id}/feedback-history`,
              },
            ]}
          />
          {children}
        </>
      )}
    </AppShell>
  );
}
