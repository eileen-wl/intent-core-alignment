import type {
  AnchorContextSummaryListRead,
  ArtistInboxItemRead,
  ArtistInboxRead,
} from "@intent-core/contracts";
import Link from "next/link";

import {
  Breadcrumbs,
  EmptyState,
  ErrorState,
  Grid,
  PageHeader,
  SectionHeader,
  Stack,
  SummaryCard,
} from "@/design";
import { ROLE_LABEL } from "@/lib/demoIdentity";
import { ArtistTaskRow } from "./ArtistTaskRow";

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
  readyTasks,
  waitingTasks,
}: {
  inbox: ArtistInboxRead | null;
  readyTasks?: AnchorContextSummaryListRead | null;
  waitingTasks?: AnchorContextSummaryListRead | null;
}) {
  return (
    <>
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
          readyTasks={readyTasks}
          waitingTasks={waitingTasks}
        />
      )}
    </>
  );
}

function WorkspaceHomeContent({
  items,
  readyTasks,
  waitingTasks,
}: {
  items: ArtistInboxItemRead[];
  readyTasks?: AnchorContextSummaryListRead | null;
  waitingTasks?: AnchorContextSummaryListRead | null;
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
  const itemsById = new Map(items.map((item) => [item.task_id, item]));
  const ready = (readyTasks?.items ?? []).flatMap((summary) => {
    const item = summary.task_id ? itemsById.get(summary.task_id) : undefined;
    return item ? [{ item, summary }] : [];
  });
  const waiting = (waitingTasks?.items ?? []).flatMap((summary) => {
    const item = summary.task_id ? itemsById.get(summary.task_id) : undefined;
    return item ? [{ item, summary }] : [];
  });
  const singleReady = readyTasks?.total_count === 1 ? ready[0] : undefined;

  return (
    <Stack gap={6}>
      <div role="region" aria-label="Ready to work">
        <SectionHeader
          title="Ready to work"
          description="Tasks with confirmed Core and Execution direction, an executable next step, and no recorded blocker."
        />
        {singleReady ? (
          <>
            <p>
              <strong>{singleReady.item.task_name}</strong> ·{" "}
              {singleReady.item.shot_name}
            </p>
            <Grid minColumnWidth="15rem" gap={4}>
              <SummaryCard
                label="Why"
                value={
                  singleReady.summary.core_direction ??
                  "Confirmed Core direction is unavailable."
                }
                description={`Core Anchor R${singleReady.summary.core_anchor_revision_number}`}
              />
              <SummaryCard
                label="How"
                value={
                  singleReady.summary.execution_direction ??
                  "Confirmed execution direction is unavailable."
                }
                description={`Execution Anchor R${singleReady.summary.execution_anchor_revision_number}`}
              />
              <SummaryCard
                label="What to do now"
                value={singleReady.summary.next_action.title}
                description={`Guidance: ${singleReady.summary.guidance_state.replaceAll("_", " ")}`}
              />
            </Grid>
          </>
        ) : ready.length === 0 ? (
          <EmptyState
            title="No Tasks are ready to work"
            description="Tasks waiting for confirmed direction or unblocked Guidance are grouped below."
          />
        ) : (
          <div role="list">
            {ready.map(({ item, summary }) => (
              <div role="listitem" key={item.task_id}>
                <ArtistTaskRow item={item} anchorContext={summary} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Waiting for upstream direction">
        <SectionHeader
          title="Waiting for upstream direction"
          description="Tasks blocked by missing or outdated direction, Guidance, or Dependencies, with the owning next step made explicit."
          actions={<Link href="/artist/inbox">Go to Review Inbox →</Link>}
        />
        {waiting.length === 0 ? (
          <EmptyState title="No Tasks are waiting upstream" />
        ) : (
          <div role="list">
            {waiting.map(({ item, summary }) => (
              <div role="listitem" key={item.task_id}>
                <ArtistTaskRow item={item} anchorContext={summary} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div role="region" aria-label="Task overview">
        <SectionHeader
          title="Task overview"
          description="Scope-level counts follow the executable and waiting work groups."
          actions={<Link href="/artist/tasks">View all Tasks →</Link>}
        />
        <Grid minColumnWidth="13rem" gap={4}>
          <SummaryCard label="Total Tasks" value={totalTasks} />
          <SummaryCard
            label="Ready to work"
            value={readyTasks?.total_count ?? 0}
          />
          <SummaryCard
            label="Waiting upstream"
            value={waitingTasks?.total_count ?? 0}
          />
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
      </div>
    </Stack>
  );
}
