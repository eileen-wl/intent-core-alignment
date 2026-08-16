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
  within,
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
  it("uses an explicit accessible disclosure control, with no Authoritative Direction content shown while collapsed", () => {
    render(<AnchorContextLayer context={contextFor("vfx_supervisor")} />);

    const button = screen.getByRole("button", {
      name: "Show anchor context",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/remains authoritative/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse anchor context" }),
    ).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/remains authoritative/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show anchor context" }),
    ).not.toBeInTheDocument();
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
        screen.getByRole("button", { name: "Show anchor context" }),
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

  it("presents Core Anchor, Execution Anchor, and Readiness as three compact semantic reading blocks for Artists, never the old per-field narrative-row grammar or the older three-column grid", () => {
    const { container } = render(
      <AnchorContextLayer context={contextFor("artist")} defaultExpanded />,
    );

    // Core Anchor block: identity, creative-intent body, inline "Must
    // preserve —" clause, draft distinction as quiet metadata.
    expect(screen.getByText(/Core Anchor R2.*confirmed/)).toBeVisible();
    expect(
      screen.getByText("Keep the hero silhouette readable."),
    ).toBeVisible();
    expect(screen.getByText(/Must preserve —/)).toBeVisible();
    expect(screen.getByText(/The turn lands on the music cue\./)).toBeVisible();
    expect(screen.getByText(/remains authoritative/)).toBeVisible();

    // Execution Anchor block: identity, current-direction body, inline
    // "Allowed to vary —"/"Boundary —" clauses.
    expect(screen.getByText(/Execution Anchor R1.*outdated/)).toBeVisible();
    expect(
      screen.getAllByText(/Preserve the readable turn in blocking\./).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Allowed to vary —/)).toBeVisible();
    expect(screen.getByText(/Boundary —/)).toBeVisible();
    expect(
      screen.getByText(/Do not shift the final pose timing\./),
    ).toBeVisible();

    // Readiness block: title, why-now, attention/downstream clauses.
    expect(
      screen.getByText("Review the outdated execution direction"),
    ).toBeVisible();
    expect(
      screen.getByText("Core Anchor R2 supersedes the department direction."),
    ).toBeVisible();
    expect(screen.getByText(/Attention —/)).toBeVisible();
    expect(screen.getByText(/Downstream —/)).toBeVisible();

    // Supporting footer: Guidance state.
    expect(screen.getByText("Guidance outdated")).toBeInTheDocument();

    // Compact semantic-block correction: the old per-field narrative
    // rows (and the older three-column `artistChain` grid) are both
    // gone -- exactly three `.semanticBlock` reading blocks exist.
    expect(container.querySelector('[class*="artistChain"]')).toBeNull();
    expect(container.querySelectorAll('[class*="narrativeRow"]')).toHaveLength(
      0,
    );
    expect(container.querySelectorAll('[class*="semanticBlock"]').length).toBe(
      3,
    );
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

  it("strips the verified real CG D1 Golden Journey implementation labels from the collapsed Anchor Context direction text (owner-reported regression -- the previous exact-string allowlist did not cover these real runtime label variants)", () => {
    const context = contextFor("cg_supervisor");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          execution_anchor: {
            ...context.execution_anchor!,
            direction_summary:
              "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Lighting owns the warm rim.",
          },
        }}
      />,
    );

    expect(screen.getByText("Lighting owns the warm rim.")).toBeVisible();
    expect(
      screen.queryByText(/D1 combined-intensity ceiling translation/),
    ).not.toBeInTheDocument();
  });

  it("never renders a persistent or sticky bar while collapsed", () => {
    const { container } = render(
      <AnchorContextLayer context={contextFor("cg_supervisor")} />,
    );
    expect(
      container.querySelector('[class*="sticky"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeInTheDocument();
  });

  it("never renders a persistent or sticky bar while expanded", () => {
    const { container } = render(
      <AnchorContextLayer
        context={contextFor("cg_supervisor")}
        defaultExpanded
      />,
    );
    expect(
      container.querySelector('[class*="sticky"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeInTheDocument();
  });

  it("shows a compact guardrail summary while collapsed, never the full Authoritative Direction region at the same time", () => {
    render(<AnchorContextLayer context={contextFor("vfx_supervisor")} />);

    expect(
      screen.getByRole("button", { name: "Show anchor context" }),
    ).toBeVisible();
    expect(screen.getByText(/Core Anchor R2/)).toBeVisible();
    expect(screen.getByText(/confirmed/)).toBeVisible();
    expect(
      screen.getByText("Keep the hero silhouette readable."),
    ).toBeVisible();
    expect(screen.getByText("High attention")).toBeVisible();
    expect(
      screen.queryByText("Authoritative direction"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Must preserve")).not.toBeInTheDocument();
  });

  it("labels the collapsed band with an explicit 'Anchor context' kicker, so it reads as a recognizable context layer rather than loose text", () => {
    render(<AnchorContextLayer context={contextFor("vfx_supervisor")} />);

    expect(screen.getByText("Anchor context")).toBeVisible();
  });

  it("omits the attention chip in the collapsed summary when attention has not been assessed, rather than showing a placeholder", () => {
    const context = contextFor("vfx_supervisor");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          attention: { ...context.attention, level: "not_assessed" },
        }}
      />,
    );

    expect(screen.queryByText("Not assessed yet")).not.toBeInTheDocument();
  });

  it("shows a role-generic collapsed summary for CG and Artist too, using the same real fields (no VFX-only assumption)", () => {
    const { unmount } = render(
      <AnchorContextLayer context={contextFor("cg_supervisor")} />,
    );
    expect(screen.getByText(/Core Anchor R2/)).toBeVisible();
    expect(
      screen.getByText("Preserve the readable turn in blocking."),
    ).toBeVisible();
    unmount();

    render(<AnchorContextLayer context={contextFor("artist")} />);
    expect(screen.getByText(/Core Anchor R2/)).toBeVisible();
    expect(
      screen.getByText("Preserve the readable turn in blocking."),
    ).toBeVisible();
  });

  it("reserves no empty space for Related Context in the supporting footer when no link actually applies to this role", () => {
    const context = contextFor("artist");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          attention: { ...context.attention, link_target: null },
        }}
        defaultExpanded
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Open Alignment →" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Related Context link in the supporting footer when a link applies to this role", () => {
    render(
      <AnchorContextLayer context={contextFor("artist")} defaultExpanded />,
    );

    expect(
      screen.getByRole("link", { name: "Open Alignment →" }),
    ).toBeInTheDocument();
  });

  it("keeps the Artist Core Anchor, Execution Anchor, and Readiness content, plus the disclosure control, inside one region once expanded", () => {
    render(
      <AnchorContextLayer context={contextFor("artist")} defaultExpanded />,
    );

    const section = screen.getByRole("region", { name: "Anchor context" });
    for (const content of [
      "Keep the hero silhouette readable.",
      "Must preserve —",
      "Preserve the readable turn in blocking.",
      "Allowed to vary —",
      "Review the outdated execution direction",
    ]) {
      expect(section).toHaveTextContent(content);
    }
    expect(
      screen.getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();
  });

  it("does not repeat the real readiness statement verbatim in both 'What to do now' and a secondary 'Readiness / next action' row (row-grammar correction: the title/why-now/link now live only in the primary row; the secondary row keeps only the real downstream_effect fact, which was not shown anywhere else)", () => {
    const context = contextFor("artist");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          next_action: {
            ...context.next_action,
            title: "Review the outdated execution direction",
            why_now: "Core Anchor R2 supersedes the department direction.",
            downstream_effect: "Confirmation will unlock regenerated guidance.",
          },
        }}
        defaultExpanded
      />,
    );

    // The real statement, its supporting explanation, and the real
    // downstream fact are all still visible -- once each.
    expect(
      screen.getAllByText("Review the outdated execution direction").length,
    ).toBe(1);
    expect(
      screen.getAllByText("Core Anchor R2 supersedes the department direction.")
        .length,
    ).toBe(1);
    expect(
      screen.getByText("Confirmation will unlock regenerated guidance."),
    ).toBeVisible();
  });

  it("attaches each real status to the semantic block it qualifies (Execution state to the Execution Anchor identity, attention to the Readiness header, Guidance state to the supporting footer), never as a floating header badge cluster", () => {
    const context = contextFor("artist");
    const { container } = render(
      <AnchorContextLayer
        context={{
          ...context,
          execution_anchor: {
            ...context.execution_anchor!,
            context_state: "current",
          },
          guidance_state: "current",
        }}
        defaultExpanded
      />,
    );

    const header = container.querySelector(
      '[class*="artistCompactHeader"]',
    ) as HTMLElement;
    expect(header).toBeTruthy();
    expect(within(header).queryByText(/attention/i)).not.toBeInTheDocument();
    expect(within(header).queryByText(/Guidance/i)).not.toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "Collapse anchor context" }),
    ).toBeVisible();

    expect(screen.getByText(/Execution Anchor R1.*current/)).toBeVisible();
    expect(screen.getByText("High attention")).toBeVisible();
    expect(screen.getByText("Guidance current")).toBeVisible();
  });

  it("strips the verified real CG D1 implementation label from the Artist-facing standard Anchor's Current direction / Allowed to vary / Execution boundary / Intent attention fields (owner-reported product bug: the label was visibly leaking there, though already fixed on the 'review' variant)", () => {
    const context = contextFor("artist");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          execution_anchor: {
            ...context.execution_anchor!,
            direction_summary:
              "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Preserve the readable turn in blocking.",
            allowed_refinement:
              "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Polish arcs without changing the beat.",
            execution_boundary:
              "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Do not shift the final pose timing.",
          },
          attention: {
            ...context.attention,
            summary:
              "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] The current Version diverges from the confirmed intent.",
          },
        }}
        defaultExpanded
      />,
    );

    expect(
      screen.getByText("Preserve the readable turn in blocking."),
    ).toBeVisible();
    expect(
      screen.getByText("Polish arcs without changing the beat."),
    ).toBeVisible();
    expect(
      screen.getByText("Do not shift the final pose timing."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "The current Version diverges from the confirmed intent.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(/D1 combined-intensity ceiling translation/),
    ).not.toBeInTheDocument();
  });

  it("states the Execution Anchor's own context state as part of its own identity line for Artists (owner-reported bug: a bare 'current' badge is ambiguous about which real object it describes), while leaving CG's own established bare label unchanged", () => {
    const artistContext = contextFor("artist");
    const { unmount } = render(
      <AnchorContextLayer
        context={{
          ...artistContext,
          execution_anchor: {
            ...artistContext.execution_anchor!,
            context_state: "current",
          },
        }}
        defaultExpanded
      />,
    );
    expect(screen.getByText(/Execution Anchor R1 · current/)).toBeVisible();
    expect(screen.queryByText(/^current$/)).not.toBeInTheDocument();
    unmount();

    // CG's own bare label is untouched -- same real underlying state,
    // same badge color/status logic, only the Artist-facing text changed.
    render(
      <AnchorContextLayer
        context={contextFor("cg_supervisor")}
        defaultExpanded
      />,
    );
    expect(screen.getByText("outdated")).toBeVisible();
    expect(screen.queryByText("Execution outdated")).not.toBeInTheDocument();
  });

  it("shows the real Guidance state once, as the 'Guidance current' supporting-footer badge, never repeated as 'Guidance: Guidance current' prose alongside the current production context fact", () => {
    const context = contextFor("artist");
    render(
      <AnchorContextLayer
        context={{ ...context, guidance_state: "current" }}
        defaultExpanded
      />,
    );
    expect(screen.getByText("Guidance current")).toBeVisible();
    expect(screen.queryByText(/Guidance: Guidance/)).not.toBeInTheDocument();
    expect(screen.queryByText("Guidance:")).not.toBeInTheDocument();
    expect(screen.queryByText("Guidance · current")).not.toBeInTheDocument();
  });

  it("shows the real upstream state exactly once (compact semantic-block correction: the audit-confirmed duplicate -- an identical header badge plus a secondary row repeating the same sentence -- is removed)", () => {
    const context = contextFor("artist");
    const upstreamContext: AnchorContextRead = {
      ...context,
      core_anchor: { ...context.core_anchor, lifecycle_state: "draft" },
    };
    render(<AnchorContextLayer context={upstreamContext} defaultExpanded />);

    expect(
      screen.getAllByText("VFX Core Anchor confirmation is required.").length,
    ).toBe(1);
  });

  it("shows the Intent attention requirement exactly once when no AI/rule summary is present, instead of repeating the same sentence as both the primary clause and its sub-text", () => {
    const context = contextFor("artist");
    render(
      <AnchorContextLayer
        context={{
          ...context,
          attention: { ...context.attention, summary: null },
        }}
        defaultExpanded
      />,
    );

    expect(
      screen.getAllByText("VFX Supervisor review is required.").length,
    ).toBe(1);
  });

  it("keeps the Artist expanded Anchor entirely read-only -- no edit, confirm, approve, or re-anchor control anywhere in the region", () => {
    render(
      <AnchorContextLayer context={contextFor("artist")} defaultExpanded />,
    );

    const section = screen.getByRole("region", { name: "Anchor context" });
    const buttons = within(section).getAllByRole("button");
    for (const button of buttons) {
      expect(button).toHaveAccessibleName("Collapse anchor context");
    }
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows 'Confirmed by VFX Supervisor' without the internal actor id -- 'vfx-1' is a session/audit identifier, never a real display name", () => {
    render(
      <AnchorContextLayer
        context={contextFor("vfx_supervisor")}
        defaultExpanded
      />,
    );

    expect(screen.getByText("Confirmed by VFX Supervisor")).toBeVisible();
    expect(screen.queryByText(/vfx-1/)).not.toBeInTheDocument();
  });

  it("keeps 'Anchor context' as the stable region identity in both collapsed and expanded states, so expansion reads as showing more of the same region rather than switching to a different module (owner-reported regression: expanded state's first heading was 'Authoritative direction')", () => {
    const { unmount } = render(
      <AnchorContextLayer context={contextFor("vfx_supervisor")} />,
    );
    expect(screen.getByText("Anchor context")).toBeVisible();
    unmount();

    render(
      <AnchorContextLayer
        context={contextFor("vfx_supervisor")}
        defaultExpanded
      />,
    );
    const section = screen.getByRole("region", { name: "Anchor context" });
    expect(within(section).getByText("Anchor context")).toBeVisible();
    // "Authoritative direction" survives, but only as a Level-B
    // descriptor inside the region -- not the region's own heading.
    expect(
      within(section).getByText("Authoritative direction"),
    ).toBeInTheDocument();
  });

  describe('variant="review" (CG Version Review visual reference)', () => {
    it("shows the Core Anchor -> Execution Anchor relationship, current direction, and an expand action while collapsed, without affecting the default variant's own collapsed markup", () => {
      render(
        <AnchorContextLayer
          context={contextFor("cg_supervisor")}
          variant="review"
        />,
      );
      expect(
        screen.getByText("Core Anchor R2", { exact: false }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Animation Execution Anchor R1/),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Preserve the readable turn in blocking."),
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: "Show full context →" }),
      ).toBeVisible();
    });

    it("expands into an authority relationship, a 2x2 guardrail matrix, and a state rail that preserves every real field the default variant shows -- not the old 4-column grid", () => {
      render(
        <AnchorContextLayer
          context={contextFor("cg_supervisor")}
          variant="review"
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Show full context →" }),
      );

      const region = screen.getByRole("region", { name: "Anchor context" });
      for (const label of [
        "Must preserve",
        "May vary",
        "Execution boundary",
        "Intent attention",
        "Readiness / next action",
        "Current draft source",
        "Current production context",
        "Related context",
      ]) {
        expect(region).toHaveTextContent(label);
      }
      expect(
        screen.getByText("The turn lands on the music cue."),
      ).toBeVisible();
      expect(
        screen.getByRole("link", { name: "Open Execution →" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Collapse anchor context" }),
      ).toBeVisible();
    });

    it("does not change the default variant's rendering for other roles/pages when variant is omitted", () => {
      render(<AnchorContextLayer context={contextFor("artist")} />);
      expect(
        screen.getByRole("button", { name: "Show anchor context" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "Show full context →" }),
      ).not.toBeInTheDocument();
    });

    it("strips the verified real CG D1 implementation label from Must preserve / May vary / Execution boundary in the expanded guardrail matrix (owner-reported product bug: the label was visibly leaking there)", () => {
      const context = contextFor("cg_supervisor");
      render(
        <AnchorContextLayer
          context={{
            ...context,
            core_anchor: {
              ...context.core_anchor,
              must_preserve:
                "[CG deterministic] The turn lands on the music cue.",
            },
            execution_anchor: {
              ...context.execution_anchor!,
              allowed_refinement:
                "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Polish arcs without changing the beat.",
              execution_boundary:
                "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Do not shift the final pose timing.",
            },
          }}
          variant="review"
          defaultExpanded
        />,
      );

      expect(
        screen.getByText("The turn lands on the music cue."),
      ).toBeVisible();
      expect(
        screen.getByText("Polish arcs without changing the beat."),
      ).toBeVisible();
      expect(
        screen.getByText("Do not shift the final pose timing."),
      ).toBeVisible();
      expect(
        screen.queryByText(/D1 combined-intensity ceiling translation/),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/CG deterministic\]/)).not.toBeInTheDocument();
    });

    it("shows a concise, complete-sentence direction while collapsed instead of the full real direction text, without truncating any real content in the expanded state", () => {
      const context = contextFor("cg_supervisor");
      const longDirection =
        "Compositing owns bloom, particles, debris and saturation inside the confirmed combined-intensity boundary. Threat must read through restraint, weight, and silhouette hierarchy. Do not introduce new emissive sources beyond the confirmed palette.";
      render(
        <AnchorContextLayer
          context={{
            ...context,
            execution_anchor: {
              ...context.execution_anchor!,
              direction_summary: longDirection,
            },
          }}
          variant="review"
        />,
      );

      // Collapsed: only the first whole sentence fits the concise
      // budget -- the second and third sentences are absent, and the
      // one shown sentence is never sliced mid-thought.
      expect(
        screen.getByText(
          "Compositing owns bloom, particles, debris and saturation inside the confirmed combined-intensity boundary.",
        ),
      ).toBeVisible();
      expect(
        screen.queryByText(/Threat must read through restraint/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Do not introduce new emissive sources/),
      ).not.toBeInTheDocument();

      // Expanded: the full real direction text is untouched.
      fireEvent.click(
        screen.getByRole("button", { name: "Show full context →" }),
      );
      expect(screen.getByText(longDirection)).toBeVisible();
    });
  });
});
