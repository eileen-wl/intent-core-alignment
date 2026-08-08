import type {
  AnchorContextRead,
  AnchorContextSummaryRead,
} from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AnchorContextLayer } from "./AnchorContextLayer";
import { AnchorContextSummary } from "./AnchorContextSummary";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function contextFor(role: AnchorContextRead["role"]): AnchorContextRead {
  return {
    role,
    shot_id: "11111111-1111-4111-8111-111111111111",
    task_id:
      role === "vfx_supervisor" ? null : "22222222-2222-4222-8222-222222222222",
    core_anchor: {
      exists: true,
      lifecycle_state: "confirmed",
      confirmed_revision_id: "33333333-3333-4333-8333-333333333333",
      confirmed_revision_number: 2,
      direction_summary: "Keep the hero silhouette readable.",
      must_preserve: "The turn lands on the music cue.",
      allowed_variation: "Secondary cloth motion may vary.",
      confirmed_by_human_role: "vfx_supervisor",
      confirmed_by_actor_id: "vfx-1",
      link_target: "/vfx/shots/shot-1/intent",
      newer_draft_exists: true,
      pending_human_gate_exists: true,
      draft_revision_number: 3,
    },
    execution_anchor:
      role === "vfx_supervisor"
        ? null
        : {
            exists: true,
            department: "Animation",
            lifecycle_state: "confirmed",
            context_state: "outdated",
            confirmed_revision_id: "44444444-4444-4444-8444-444444444444",
            confirmed_revision_number: 1,
            direction_summary: "Preserve the readable turn in blocking.",
            execution_boundary: "Do not shift the final pose timing.",
            allowed_refinement: "Polish arcs without changing the beat.",
            based_on_core_anchor_revision_id:
              "55555555-5555-4555-8555-555555555555",
            based_on_core_anchor_revision_number: 1,
            upstream_relationship_available: true,
            confirmed_by_human_role: "cg_supervisor",
            confirmed_by_actor_id: "cg-1",
            link_target: "/cg/tasks/task-1/execution",
            draft_revision_number: 2,
            draft_source: "copied_from_prior_revision",
          },
    attention: {
      level: "high",
      summary: "The current Version diverges from the confirmed intent.",
      review_requirement: "VFX Supervisor review is required.",
      source_assessment_id: "66666666-6666-4666-8666-666666666666",
      source_signal_id: "77777777-7777-4777-8777-777777777777",
      assessed_at: "2026-08-03T10:00:00Z",
      link_target: "/vfx/shots/shot-1/alignment",
    },
    current_version: {
      version_id: "88888888-8888-4888-8888-888888888888",
      name: "hero_turn_v005",
      version_number: 5,
      link_target: "/artist/tasks/task-1/current-version",
    },
    guidance_state: role === "artist" ? "outdated" : "unavailable",
    open_vfx_escalation: false,
    next_action: {
      title: "Review the outdated execution direction",
      why_now: "Core Anchor R2 supersedes the department direction.",
      downstream_effect: "Confirmation will unlock regenerated guidance.",
      target_route: "/cg/tasks/task-1/execution",
      action_label: "Review Execution Anchor",
      executable: role === "cg_supervisor",
    },
  };
}

function summaryFor(role: AnchorContextRead["role"]): AnchorContextSummaryRead {
  const context = contextFor(role);
  return {
    role,
    shot_id: context.shot_id,
    task_id: context.task_id,
    core_anchor_state: context.core_anchor.lifecycle_state,
    core_anchor_revision_number: context.core_anchor.confirmed_revision_number,
    core_direction: context.core_anchor.direction_summary,
    execution_context_state: context.execution_anchor?.context_state ?? null,
    execution_anchor_revision_number:
      context.execution_anchor?.confirmed_revision_number ?? null,
    execution_direction: context.execution_anchor?.direction_summary ?? null,
    based_on_core_anchor_revision_number:
      context.execution_anchor?.based_on_core_anchor_revision_number ?? null,
    attention_level: context.attention.level,
    attention_summary: context.attention.summary,
    guidance_state: context.guidance_state,
    readiness_state: "waiting_upstream",
    readiness_detail: "CG clarification is required before work continues.",
    open_vfx_escalation: false,
    next_action: context.next_action,
  };
}

describe("AnchorContextLayer", () => {
  it("uses an explicit accessible disclosure control", () => {
    render(<AnchorContextLayer context={contextFor("vfx_supervisor")} />);

    const button = screen.getByRole("button", {
      name: "Expand anchor context",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/remains authoritative/)).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/remains authoritative/)).toBeInTheDocument();
  });

  it("defaults Overview context to expanded and remembers a session choice", async () => {
    const { unmount } = render(
      <AnchorContextLayer
        context={contextFor("vfx_supervisor")}
        defaultExpanded
        storageKey="icas:test:shot"
      />,
    );

    const collapse = screen.getByRole("button", {
      name: "Collapse anchor context",
    });
    fireEvent.click(collapse);
    expect(window.sessionStorage.getItem("icas:test:shot")).toBe("collapsed");
    unmount();

    render(
      <AnchorContextLayer
        context={contextFor("vfx_supervisor")}
        defaultExpanded
        storageKey="icas:test:shot"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Expand anchor context" }),
      ).toHaveAttribute("aria-expanded", "false"),
    );
  });

  it("presents the authoritative Core Anchor and draft distinction to VFX", () => {
    render(
      <AnchorContextLayer
        context={contextFor("vfx_supervisor")}
        defaultExpanded
      />,
    );

    expect(screen.getAllByText(/Core Anchor R2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/remains authoritative/)).toBeInTheDocument();
    expect(screen.getByText("High attention")).toBeInTheDocument();
  });

  it("shows the Core-to-Execution relationship and stale state to CG", () => {
    render(
      <AnchorContextLayer
        context={contextFor("cg_supervisor")}
        defaultExpanded
      />,
    );

    expect(screen.getByText("Based on Core Anchor R1")).toBeInTheDocument();
    expect(screen.getByText("outdated")).toBeInTheDocument();
    expect(screen.getByText("copied from prior revision")).toBeInTheDocument();
    expect(
      screen.getAllByText("VFX review pending for the newer Core Anchor draft.")
        .length,
    ).toBeGreaterThan(0);
  });

  it("uses content-first WHY / HOW / WHAT TO DO NOW and secondary Anchor metadata for Artists", () => {
    render(
      <AnchorContextLayer context={contextFor("artist")} defaultExpanded />,
    );

    expect(screen.getByText("Why")).toBeInTheDocument();
    expect(screen.getByText("How")).toBeInTheDocument();
    expect(screen.getByText("What to do now")).toBeInTheDocument();
    expect(screen.getByText("Guidance outdated")).toBeInTheDocument();
    expect(
      screen.getByText("Keep the hero silhouette readable."),
    ).toBeVisible();
    expect(
      screen.getAllByText("Preserve the readable turn in blocking.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Core Anchor R2.*confirmed/)).toBeVisible();
    expect(screen.getByText(/Execution Anchor R1.*outdated/)).toBeVisible();
  });

  it("renders attention and readiness as separate compact-row meanings", () => {
    const { rerender } = render(<AnchorContextLayer context={null} />);
    expect(screen.getByText("Anchor context unavailable")).toBeInTheDocument();

    rerender(<AnchorContextSummary context={summaryFor("artist")} />);
    expect(screen.getByText(/Core Anchor R2/)).toBeInTheDocument();
    expect(screen.getByText(/Preserve the readable turn/)).toBeInTheDocument();
    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Readiness")).toBeInTheDocument();
    expect(
      screen.getAllByText("Review the outdated execution direction").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/high.*waiting upstream/i),
    ).not.toBeInTheDocument();
  });

  it("treats a one-character direction placeholder as unavailable", () => {
    const summary = summaryFor("cg_supervisor");
    render(
      <AnchorContextSummary
        context={{ ...summary, execution_direction: "x" }}
      />,
    );

    expect(
      screen.getByText("No concise direction is available yet."),
    ).toBeVisible();
    expect(screen.queryByText("x")).not.toBeInTheDocument();
  });

  it("renders a compact one-line sticky summary bar with its own Expand action, in addition to the full non-sticky block's own disclosure control", () => {
    render(<AnchorContextLayer context={contextFor("cg_supervisor")} />);

    expect(screen.getByText("Core R2 · Execution R1 · outdated")).toBeVisible();
    const stickyExpand = screen.getByRole("button", { name: "Expand" });
    expect(stickyExpand).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(stickyExpand);
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Collapse" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows a Core-only sticky summary for VFX, since there is no Execution Anchor at that role", () => {
    render(<AnchorContextLayer context={contextFor("vfx_supervisor")} />);

    expect(screen.getByText("Core R2 · confirmed")).toBeVisible();
  });

  it("keeps the Artist header groups and disclosure control as distinct wrapping regions", () => {
    render(<AnchorContextLayer context={contextFor("artist")} />);

    const section = screen.getByRole("region", { name: "Anchor context" });
    for (const label of ["Why", "How", "What to do now", "Current direction"]) {
      expect(section).toHaveTextContent(label);
    }
    expect(
      screen.getByRole("button", { name: "Expand anchor context" }),
    ).toBeVisible();
  });
});
