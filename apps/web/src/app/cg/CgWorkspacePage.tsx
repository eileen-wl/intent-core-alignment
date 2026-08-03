import type {
  AnchorContextSummaryListRead,
  CgInboxItemRead,
  CgInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  AppShell,
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Grid,
  PageHeader,
  SectionHeader,
  Stack,
  SummaryCard,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import { CgTaskRow } from "./CgTaskRow";

const IMPORTANT_TASK_COUNT = 3;

/** `/cg` -- the CG Workspace Home (Step 7C-4), mirroring
 * `app/vfx/VfxWorkspacePage.tsx`'s shape exactly: a small, real
 * production overview, a small number of real Priority actions (work
 * items, not Tasks) using the same priority ordering as the CG Review
 * Inbox, and a small, clearly secondary Important-Tasks section routing
 * into the full Tasks catalogue. `inbox` is `null` only when the real
 * `GET /cg/inbox` call failed, distinct from a real empty portfolio. */
export function CgWorkspacePage({
  inbox,
  anchorActions,
  onExitRole,
}: {
  inbox: CgInboxRead | null;
  anchorActions?: AnchorContextSummaryListRead | null;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg"
    >
      <Breadcrumbs items={[{ label: "Workspace Home" }]} />
      <PageHeader
        title="Workspace Home"
        description={`${ROLE_LABEL.cg_supervisor} · your production overview and priorities.`}
      />

      {inbox === null ? (
        <ErrorState
          title="Workspace Home is unavailable"
          description="The ICAS service could not be reached. Try refreshing the page."
        />
      ) : inbox.items.length === 0 ? (
        <EmptyState
          title="No Tasks exist yet"
          description="Tasks will appear here once they exist."
        />
      ) : (
        <WorkspaceHomeContent
          items={inbox.items}
          anchorActions={anchorActions}
        />
      )}
    </AppShell>
  );
}

function WorkspaceHomeContent({
  items,
  anchorActions,
}: {
  items: CgInboxItemRead[];
  anchorActions?: AnchorContextSummaryListRead | null;
}) {
  const executionAwaitingAction = items.filter(
    (item) => item.execution_anchor_state === "draft_pending",
  ).length;
  const versionReviewsRequiringAction = items.filter(
    (item) => item.current_focus.focus_type === "version_review_available",
  ).length;
  const missingExecutionAnchors = items.filter(
    (item) => item.execution_anchor_state === "none",
  ).length;
  const confirmedExecutionAnchors = items.filter(
    (item) => item.execution_anchor_state === "confirmed",
  ).length;
  const tasksWithDependencies = items.filter(
    (item) => item.open_dependency_count > 0,
  ).length;
  const summaries = anchorActions?.items ?? [];
  const itemsById = new Map(items.map((item) => [item.task_id, item]));
  const actionTasks = summaries.flatMap((summary) => {
    const item = summary.task_id ? itemsById.get(summary.task_id) : undefined;
    return item ? [{ item, summary }] : [];
  });
  const actionTaskIds = new Set(actionTasks.map(({ item }) => item.task_id));

  // Important Tasks: a small, clearly secondary, Task-led section --
  // never the complete catalogue (that is `/cg/tasks`'s job).
  const importantTasks = items
    .filter((item) => !actionTaskIds.has(item.task_id))
    .slice(0, IMPORTANT_TASK_COUNT);

  return (
    <Stack gap={6}>
      <div role="region" aria-label="Execution Anchor actions">
        <SectionHeader
          title="Execution Anchor actions"
          description="Highest-priority translation, review, dependency, and escalation states across Tasks."
          actions={<Link href="/cg/inbox">Go to Review Inbox →</Link>}
        />
        {actionTasks.length === 0 ? (
          <EmptyState title="No immediate Execution Anchor actions" />
        ) : (
          <div role="list">
            {actionTasks.map(({ item, summary }) => (
              <div role="listitem" key={item.task_id}>
                <CgTaskRow item={item} anchorContext={summary} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Department anchor readiness">
        <SectionHeader
          title="Execution readiness"
          description="Scope-level state; attention does not imply a formal VFX escalation."
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard
            label="Confirmed Execution Anchors"
            value={confirmedExecutionAnchors}
          />
          <SummaryCard
            label="Awaiting Anchor action"
            value={executionAwaitingAction}
          />
          <SummaryCard
            label="Missing Execution Anchors"
            value={missingExecutionAnchors}
          />
          <SummaryCard
            label="Ready for Version review"
            value={versionReviewsRequiringAction}
          />
          <SummaryCard
            label="Tasks with open Dependencies"
            value={tasksWithDependencies}
          />
        </Grid>
      </div>

      <div role="region" aria-label="Important Tasks">
        <SectionHeader
          title="Important Tasks"
          description="A small preview -- browse the complete catalogue in Tasks."
          actions={<Link href="/cg/tasks">View all Tasks →</Link>}
        />
        <div role="list">
          {importantTasks.map((item) => (
            <div role="listitem" key={item.task_id}>
              <CgTaskRow item={item} />
            </div>
          ))}
        </div>
      </div>
    </Stack>
  );
}
