import type {
  ShotActivityEventRead,
  VfxInboxItemRead,
} from "@intent-core/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityWorkspaceData } from "@/features/vfx/activity-workspace/data";
import { ActivityWorkspacePage } from "./ActivityWorkspacePage";

afterEach(() => {
  cleanup();
});

function item(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "confirmed",
    active_core_anchor_revision_id: "r1",
    active_core_anchor_summary: "A restrained dusk confrontation.",
    pending_human_gate_id: null,
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "SH010_v001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Shot right now",
      explanation: "",
      target_route: "/vfx/shots/s1",
      primary_action_label: null,
      actionable: false,
    },
    next_candidates: [],
    sort_rank: 0,
    ...overrides,
  };
}

function event(
  overrides: Partial<ShotActivityEventRead> = {},
): ShotActivityEventRead {
  return {
    id: "e1",
    event_type: "core_anchor_draft_created",
    occurred_at: "2026-01-01T00:00:00Z",
    actor_kind: "human",
    actor_id: "vfx-1",
    actor_human_role: "vfx_supervisor",
    summary: "Revision 1 draft created",
    related_entity_type: "core_anchor_revision",
    related_entity_id: "r1",
    route: "/vfx/shots/s1/intent",
    ...overrides,
  };
}

function data(
  overrides: Partial<ActivityWorkspaceData> = {},
): ActivityWorkspaceData {
  return {
    item: item(),
    activity: { shot_id: "s1", events: [event()] },
    ...overrides,
  };
}

describe("ActivityWorkspacePage", () => {
  it("renders Project > Shot > Activity breadcrumbs and all five real Context Tabs, Activity active", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("link", { name: "D1 Demo Project" }),
    ).toHaveAttribute("href", "/vfx/shots");
    for (const [label, href] of [
      ["Overview", "/vfx/shots/s1"],
      ["Intent", "/vfx/shots/s1/intent"],
      ["Versions", "/vfx/shots/s1/versions"],
      ["Alignment", "/vfx/shots/s1/alignment"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href,
      );
    }
    expect(screen.getByRole("link", { name: "Activity" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows an honest unavailable state when the API could not be reached", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={null}
        unavailable
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("This Shot is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no activity has ever been recorded", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({ activity: { shot_id: "s1", events: [] } })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(
      screen.getByText("No recorded activity exists for this Shot yet."),
    ).toBeVisible();
  });

  it("renders real records in the exact order the backend delivers (already chronological)", () => {
    const events = [
      event({
        id: "e2",
        event_type: "core_anchor_confirmed",
        summary: "Revision 1 confirmed",
        occurred_at: "2026-01-02T00:00:00Z",
      }),
      event({
        id: "e1",
        event_type: "core_anchor_draft_created",
        summary: "Revision 1 draft created",
        occurred_at: "2026-01-01T00:00:00Z",
      }),
    ];
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({ activity: { shot_id: "s1", events } })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const timeline = screen.getByRole("list", {
      name: "Shot activity timeline",
    });
    const items = within(timeline).getAllByRole("listitem");
    expect(within(items[0]).getByText("Core Anchor confirmed")).toBeVisible();
    expect(
      within(items[1]).getByText("Core Anchor draft created"),
    ).toBeVisible();
  });

  it("shows actor/time/object links for each event", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data()}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("vfx_supervisor")).toBeVisible();
    expect(screen.getByText("Revision 1 draft created")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open →" })).toHaveAttribute(
      "href",
      "/vfx/shots/s1/intent",
    );
  });

  it("shows real Human Decisions in the Activity timeline", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({
          activity: {
            shot_id: "s1",
            events: [
              event({
                id: "d1",
                event_type: "core_anchor_confirmed",
                summary: "Human vfx_supervisor confirmed Revision 1",
                related_entity_type: "decision",
                related_entity_id: "dec1",
              }),
            ],
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Core Anchor confirmed")).toBeVisible();
    expect(
      screen.getByText("Human vfx_supervisor confirmed Revision 1"),
    ).toBeVisible();
  });

  it("shows a separate Decision recorded event, distinct from and alongside Core Anchor confirmed, linked to Intent", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({
          activity: {
            shot_id: "s1",
            events: [
              event({
                id: "e2",
                event_type: "core_anchor_confirmed",
                summary: "Human vfx_supervisor confirmed Revision 1",
                related_entity_type: "decision",
                related_entity_id: "dec1",
                route: "/vfx/shots/s1/intent",
                occurred_at: "2026-01-02T00:00:00Z",
              }),
              event({
                id: "e1",
                event_type: "human_decision_recorded",
                summary:
                  "Decision recorded: Human vfx_supervisor confirm core anchor (Revision 1)",
                related_entity_type: "decision",
                related_entity_id: "dec1",
                route: "/vfx/shots/s1/intent",
                occurred_at: "2026-01-02T00:00:00Z",
              }),
            ],
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    expect(screen.getByText("Core Anchor confirmed")).toBeVisible();
    expect(screen.getByText("Decision recorded")).toBeVisible();
    expect(
      screen.getByText(
        "Decision recorded: Human vfx_supervisor confirm core anchor (Revision 1)",
      ),
    ).toBeVisible();
    const links = screen.getAllByRole("link", { name: "Open →" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/vfx/shots/s1/intent");
    }
  });

  it("still renders the Open action for an event with no actor (the case that previously broke right-alignment)", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({
          activity: {
            shot_id: "s1",
            events: [
              event({
                id: "e1",
                event_type: "core_anchor_draft_updated",
                summary: "Revision 1 draft saved",
                actor_kind: null,
                actor_id: null,
                actor_human_role: null,
              }),
            ],
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    // No actor text renders (honestly absent) -- this is exactly the
    // row shape that needs its own `margin-left: auto` on the link
    // (asserted structurally here; visually confirmed live) rather than
    // depending on a sibling `.eventActor` for `justify-content:
    // space-between` to right-align it.
    expect(screen.queryByText("human")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open →" });
    expect(link).toBeVisible();
  });

  it("routes a Production Version event to Versions and an Alignment event to Alignment", () => {
    render(
      <ActivityWorkspacePage
        shotId="s1"
        data={data({
          activity: {
            shot_id: "s1",
            events: [
              event({
                id: "v1",
                event_type: "production_version_recorded",
                summary: "Production Version recorded",
                route: "/vfx/shots/s1/versions",
              }),
              event({
                id: "a1",
                event_type: "alignment_assessment_created",
                summary: "Cross-role Assessment generated",
                route: "/vfx/shots/s1/alignment",
                actor_kind: "agent",
                actor_id: null,
                actor_human_role: null,
              }),
            ],
          },
        })}
        unavailable={false}
        onExitRole={vi.fn()}
      />,
    );
    const links = screen.getAllByRole("link", { name: "Open →" });
    expect(links[0]).toHaveAttribute("href", "/vfx/shots/s1/versions");
    expect(links[1]).toHaveAttribute("href", "/vfx/shots/s1/alignment");
  });
});
