import type {
  AnchorContextRead,
  ArtistInboxItemRead,
  ArtistInboxRead,
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
import { adaptArtistCurrentFocusToWorkItems } from "@/features/artist/reviewInbox";
import { ArtistTaskRow } from "./ArtistTaskRow";
import { ArtistTaskWorkItemRow } from "./ArtistTaskWorkItemRow";

const PRIORITY_ACTION_COUNT = 3;
const IMPORTANT_TASK_COUNT = 3;

/** `/artist` -- the Artist Workspace Home (Step 7C-5), mirroring
 * `app/cg/CgWorkspacePage.tsx`'s shape exactly: a small, real production
 * overview ("what is assigned to me, what changed, what should I work
 * on next"), a small number of real Priority actions (work items, not
 * Tasks) using the same priority ordering as the Artist Review Inbox,
 * and a small, clearly secondary Important-Tasks section routing into
 * the full Tasks catalogue. `inbox` is `null` only when the real
 * `GET /artist/inbox` call failed, distinct from a real empty
 * portfolio. */
export function ArtistWorkspacePage({
  inbox,
  anchorContexts = {},
  onExitRole,
}: {
  inbox: ArtistInboxRead | null;
  anchorContexts?: Record<string, AnchorContextRead | null>;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.artist}
      role={ROLE_LABEL.artist}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.artist}
      currentPath="/artist"
    >
      <Breadcrumbs items={[{ label: "Workspace Home" }]} />
      <PageHeader
        title="Workspace Home"
        description={`${ROLE_LABEL.artist} · what is assigned to you, what changed, and what to work on next.`}
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
          anchorContexts={anchorContexts}
        />
      )}
    </AppShell>
  );
}

function WorkspaceHomeContent({
  items,
  anchorContexts,
}: {
  items: ArtistInboxItemRead[];
  anchorContexts: Record<string, AnchorContextRead | null>;
}) {
  const totalTasks = items.length;
  const requiringAttention = items.filter(
    (item) => item.current_focus.actionable,
  ).length;
  const newOrUpdatedGuidance = items.filter((item) =>
    ["guidance_outdated", "guidance_available"].includes(
      item.current_focus.focus_type,
    ),
  ).length;
  const feedbackRequiringResponse = items.filter(
    (item) => item.current_focus.focus_type === "review_note_needs_response",
  ).length;
  const blockedTasks = items.filter(
    (item) => item.open_dependency_count > 0,
  ).length;
  const currentDirection = anchorContexts[items[0].task_id];

  // Priority actions: the shared Artist Review work-item model, not a
  // Task-led list -- `items` already arrives sorted by the backend's
  // real priority ordering (`sort_rank`), and the adapter preserves that
  // order, so the first N *are* the highest-priority work. The exact
  // same ordering the Artist Review Inbox itself uses.
  const priorityActions = adaptArtistCurrentFocusToWorkItems(items).slice(
    0,
    PRIORITY_ACTION_COUNT,
  );

  // Important Tasks: a small, clearly secondary, Task-led section --
  // never the complete catalogue (that is `/artist/tasks`'s job).
  const importantTasks = items.slice(0, IMPORTANT_TASK_COUNT);

  return (
    <Stack gap={6}>
      <div role="region" aria-label="My current working direction">
        <SectionHeader
          title="My current working direction"
          description={`Highest-priority Task: ${items[0].task_name}`}
        />
        <Grid minColumnWidth="15rem" gap={4}>
          <SummaryCard
            label="Why"
            value={
              currentDirection?.core_anchor.direction_summary ??
              "No confirmed Core Anchor direction yet"
            }
            description={`Core Anchor ${currentDirection?.core_anchor.confirmed_revision_number ? `R${currentDirection.core_anchor.confirmed_revision_number}` : "not confirmed"}`}
          />
          <SummaryCard
            label="How"
            value={
              currentDirection?.execution_anchor?.direction_summary ??
              "No confirmed department execution direction yet"
            }
            description={
              currentDirection?.execution_anchor?.execution_boundary ??
              "Execution boundary unavailable"
            }
          />
          <SummaryCard
            label="What to do now"
            value={
              currentDirection?.next_action.title ??
              items[0].current_focus.title
            }
            description={`Guidance: ${currentDirection?.guidance_state.replaceAll("_", " ") ?? "unavailable"}`}
          />
        </Grid>
      </div>

      <Grid
        minColumnWidth="13rem"
        gap={4}
        role="region"
        aria-label="Production overview"
      >
        <SummaryCard label="Total Tasks" value={totalTasks} />
        <SummaryCard
          label="Requiring attention"
          value={requiringAttention}
          description="Tasks with an actionable Current focus"
        />
        <SummaryCard
          label="New or updated guidance"
          value={newOrUpdatedGuidance}
        />
        <SummaryCard
          label="Feedback requiring response"
          value={feedbackRequiringResponse}
        />
        <SummaryCard label="Blocked Tasks" value={blockedTasks} />
      </Grid>

      <div role="region" aria-label="Priority actions">
        <SectionHeader
          title="Priority actions"
          description="The work that most needs your attention or response."
          actions={<Link href="/artist/inbox">Go to Review Inbox →</Link>}
        />
        {priorityActions.length === 0 ? (
          <EmptyState title="No priority actions require your attention" />
        ) : (
          <div role="list">
            {priorityActions.map((item) => (
              <div role="listitem" key={item.id}>
                <ArtistTaskWorkItemRow
                  item={item}
                  anchorContext={anchorContexts[item.task.id]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Important Tasks">
        <SectionHeader
          title="Important Tasks"
          description="A small preview -- browse the complete catalogue in Tasks."
          actions={<Link href="/artist/tasks">View all Tasks →</Link>}
        />
        <div role="list">
          {importantTasks.map((item) => (
            <div role="listitem" key={item.task_id}>
              <ArtistTaskRow
                item={item}
                anchorContext={anchorContexts[item.task_id]}
              />
            </div>
          ))}
        </div>
      </div>
    </Stack>
  );
}
