import type { CgInboxItemRead, CgInboxRead } from "@intent-core/contracts";
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
import { adaptCgCurrentFocusToWorkItems } from "@/features/cg/reviewInbox";
import { CgTaskRow } from "./CgTaskRow";
import { CgTaskWorkItemRow } from "./CgTaskWorkItemRow";

const PRIORITY_ACTION_COUNT = 3;
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
  onExitRole,
}: {
  inbox: CgInboxRead | null;
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
        <EmptyState title="No Tasks exist yet" description="Tasks will appear here once they exist." />
      ) : (
        <WorkspaceHomeContent items={inbox.items} />
      )}
    </AppShell>
  );
}

function WorkspaceHomeContent({ items }: { items: CgInboxItemRead[] }) {
  const totalTasks = items.length;
  const requiringAttention = items.filter((item) => item.current_focus.actionable).length;
  const executionAwaitingAction = items.filter((item) =>
    ["execution_anchor_gate_pending", "execution_anchor_draft_needs_review"].includes(
      item.current_focus.focus_type,
    ),
  ).length;
  const versionReviewsRequiringAction = items.filter(
    (item) => item.current_focus.focus_type === "version_review_available",
  ).length;
  const unresolvedDependencies = items.reduce((sum, item) => sum + item.open_dependency_count, 0);

  // Priority actions: the shared CG Review work-item model, not a
  // Task-led list -- `items` already arrives sorted by the backend's
  // real priority ordering (`sort_rank`), and the adapter preserves
  // that order, so the first N *are* the highest-priority work. The
  // exact same ordering the CG Review Inbox itself uses.
  const priorityActions = adaptCgCurrentFocusToWorkItems(items).slice(0, PRIORITY_ACTION_COUNT);

  // Important Tasks: a small, clearly secondary, Task-led section --
  // never the complete catalogue (that is `/cg/tasks`'s job).
  const importantTasks = items.slice(0, IMPORTANT_TASK_COUNT);

  return (
    <Stack gap={6}>
      <Grid minColumnWidth="13rem" gap={4} role="region" aria-label="Production overview">
        <SummaryCard label="Total Tasks" value={totalTasks} />
        <SummaryCard
          label="Requiring attention"
          value={requiringAttention}
          description="Tasks with an actionable Current focus"
        />
        <SummaryCard
          label="Execution Anchors awaiting action"
          value={executionAwaitingAction}
        />
        <SummaryCard label="Version reviews requiring action" value={versionReviewsRequiringAction} />
        <SummaryCard label="Unresolved dependencies" value={unresolvedDependencies} />
      </Grid>

      <div role="region" aria-label="Priority actions">
        <SectionHeader
          title="Priority actions"
          description="The work that most needs your review, interpretation, or confirmation."
          actions={<Link href="/cg/inbox">Go to Review Inbox →</Link>}
        />
        {priorityActions.length === 0 ? (
          <EmptyState title="No priority actions require your attention" />
        ) : (
          <div role="list">
            {priorityActions.map((item) => (
              <div role="listitem" key={item.id}>
                <CgTaskWorkItemRow item={item} />
              </div>
            ))}
          </div>
        )}
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
