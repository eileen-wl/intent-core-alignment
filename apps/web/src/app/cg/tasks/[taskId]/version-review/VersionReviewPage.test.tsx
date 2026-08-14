import type {
  CGSupervisorReviewRead,
  CgInboxItemRead,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cg/tasks/t1/version-review",
}));

vi.mock("@/features/cg/actions", () => ({
  createReviewNoteAction: vi.fn(),
  escalateTaskAction: vi.fn(),
  generateCgSupervisorReviewAction: vi.fn(),
  resolveVersionMediaAction: vi.fn().mockResolvedValue({
    ok: false,
    message: "No media resolved in this test.",
  }),
}));

import type { VersionReviewWorkspaceData } from "@/features/cg/version-review-workspace/data";
import { resolveVersionMediaAction } from "@/features/cg/actions";
import { VersionReviewPage } from "./VersionReviewPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function item(overrides: Partial<CgInboxItemRead> = {}): CgInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Lighting Pass",
    department: "lighting",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "r1",
    active_execution_anchor_summary: "24fps, no motion blur.",
    pending_human_gate_id: null,
    latest_version_id: "v1",
    latest_version_name: "SH010_v001",
    latest_version_number: 1,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "version_review_available",
      title: "A Production Version is ready for CG review",
      explanation: "No CG Supervisor review has been recorded yet.",
      target_route: "/cg/tasks/t1/version-review",
      primary_action_label: "Review version",
      actionable: true,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function version(overrides: Partial<VersionRead> = {}): VersionRead {
  return {
    id: "v1",
    shot_id: "s1",
    name: "SH010_v001",
    version_number: 1,
    description: "First pass.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<ReviewNoteRead> = {}): ReviewNoteRead {
  return {
    id: "n1",
    version_id: "v1",
    content: "Contrast reads slightly hot.",
    source: "manual",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function reviewOutput(
  overrides: Partial<CGSupervisorReviewRead["review_output"]> = {},
): CGSupervisorReviewRead["review_output"] {
  return {
    executive_summary: "x",
    execution_direction_read: {
      summary: "Reads within the confirmed range.",
      rationale: "Matches the confirmed Execution Anchor.",
      priority: "low",
      evidence: [],
    },
    actionable_requirements: [],
    technical_concerns: [],
    coordination_concerns: [],
    implementation_priorities: [],
    proposed_execution_guidance: [],
    questions_for_human_cg_supervisor: [],
    evidence_gaps: [],
    ...overrides,
  };
}

function review(
  overrides: Partial<CGSupervisorReviewRead> = {},
): CGSupervisorReviewRead {
  return {
    id: "cgr1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    execution_anchor_revision_id: "ea1",
    version_id: "v1",
    context_snapshot_id: "cs1",
    agent_run_id: "run1",
    review_output: reviewOutput(),
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const activeExecutionRevision = {
  id: "ea1",
  execution_anchor_id: "ea",
  core_anchor_revision_id: "ca1",
  revision_number: 1,
  status: "confirmed" as const,
  technical_boundaries: "24fps, no motion blur.",
  parameter_ranges: null,
  delivery_conditions: null,
  production_ready_criteria: null,
  downstream_dependencies: null,
  publish_requirements: null,
  allowed_refinements: null,
  escalation_conditions: null,
  created_by_actor_kind: "human" as const,
  created_by_actor_id: "cg-1",
  created_by_human_role: "cg_supervisor" as const,
  created_by_agent_type: null,
  created_by_agent_run_id: null,
  confirmed_by_human_role: "cg_supervisor" as const,
  confirmed_by_actor_id: "cg-1",
  confirmed_at: "2026-08-01T00:00:00Z",
  supersedes_revision_id: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

function data(
  overrides: Partial<VersionReviewWorkspaceData> = {},
): VersionReviewWorkspaceData {
  return {
    item: item(),
    versions: [{ version: version(), reviewNotes: [note()] }],
    coreAnchorSummary: "A restrained dusk confrontation.",
    coreAnchorRevisionNumber: 2,
    coreAnchorStatus: "confirmed",
    activeExecutionRevision: null,
    cgSupervisorReviews: [],
    ...overrides,
  };
}

describe("VersionReviewPage", () => {
  it("shows an honest unavailable state when the page-specific data failed to load", () => {
    render(<VersionReviewPage taskId="t1" data={null} />);
    expect(screen.getByText("This page is unavailable")).toBeVisible();
  });

  it("shows the honest empty state when no Production Version exists for this Task's Shot", () => {
    render(<VersionReviewPage taskId="t1" data={data({ versions: [] })} />);
    expect(
      screen.getByText("No Production Version is available"),
    ).toBeVisible();
  });

  it("renders real Production Versions, never confusing them with a Core/Execution Anchor Revision", () => {
    render(<VersionReviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByRole("button", { name: /SH010_v001 \(v1\)/ }),
    ).toBeVisible();
    expect(screen.queryByText(/Core Anchor Revision/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Execution Anchor Revision/),
    ).not.toBeInTheDocument();
  });

  it("shows the selected Version's real Review Notes", () => {
    render(<VersionReviewPage taskId="t1" data={data()} />);
    expect(screen.getByText("Contrast reads slightly hot.")).toBeVisible();
  });

  it("switches the selected-version detail when a different Version row is clicked", () => {
    const versionA = version({
      id: "v1",
      name: "SH010_v001",
      version_number: 1,
    });
    const versionB = version({
      id: "v2",
      name: "SH010_v002",
      version_number: 2,
    });
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          versions: [
            { version: versionB, reviewNotes: [] },
            {
              version: versionA,
              reviewNotes: [note({ id: "nA", content: "Note on v1 only" })],
            },
          ],
        })}
      />,
    );
    expect(screen.queryByText("Note on v1 only")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /SH010_v001 \(v1\)/ }));
    expect(screen.getByText("Note on v1 only")).toBeVisible();
  });

  it("shows the selected Version as the review object with its real name, department/Task/Shot context, and honest review state (Review Workspace pass)", () => {
    render(<VersionReviewPage taskId="t1" data={data()} />);
    const versionRegion = screen.getByRole("region", {
      name: "Version under review",
    });
    expect(within(versionRegion).getByText("SH010_v001 (v1)")).toBeVisible();
    expect(
      within(versionRegion).getByText("Latest Production Version"),
    ).toBeVisible();
    expect(within(versionRegion).getByText("No Agent review")).toBeVisible();
    expect(
      within(versionRegion).getByText(/Lighting Pass · lighting · Shot 010/),
    ).toBeVisible();
  });

  it("shows which Version is being reviewed relative to the latest Production Version, including a note naming the latest one when reviewing an earlier Version", () => {
    const versionA = version({
      id: "v1",
      name: "Compositing Conflict",
      version_number: 1,
    });
    const versionB = version({
      id: "v2",
      name: "Comp Resolved",
      version_number: 2,
    });
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          item: item({
            latest_version_id: "v2",
            latest_version_name: "Comp Resolved",
            latest_version_number: 2,
          }),
          versions: [
            { version: versionA, reviewNotes: [] },
            { version: versionB, reviewNotes: [] },
          ],
        })}
      />,
    );
    // Default selection is the first entry in `versions` (oldest-first
    // ordering, unchanged) -- the earlier Version, not the latest.
    const versionRegion = screen.getByRole("region", {
      name: "Version under review",
    });
    expect(
      within(versionRegion).getByText("Compositing Conflict (v1)"),
    ).toBeVisible();
    expect(
      within(versionRegion).getByText("Earlier Production Version"),
    ).toBeVisible();
    expect(within(versionRegion).getByText("Latest production")).toBeVisible();
    expect(
      within(versionRegion).getByText(/Comp Resolved \(v2\)/),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: /Comp Resolved \(v2\)/ }),
    );
    expect(
      within(versionRegion).getByText("Latest Production Version"),
    ).toBeVisible();
    expect(
      within(versionRegion).queryByText("Latest production"),
    ).not.toBeInTheDocument();
  });

  it("shows Agent review current (never Human/Version approval wording) when the current Agent Execution Review reflects the active Execution Anchor revision, and Agent review outdated when it does not", () => {
    const { rerender } = render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [
            review({ execution_anchor_revision_id: "ea1" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Agent review current")).toBeVisible();
    expect(screen.queryByText(/^Reviewed$/)).not.toBeInTheDocument();

    rerender(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision: { ...activeExecutionRevision, id: "ea2" },
          cgSupervisorReviews: [
            review({ execution_anchor_revision_id: "ea1" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Agent review outdated")).toBeVisible();
  });

  it("groups Production Evidence and the Agent Review Summary as clearly separate regions, and shows an honest Human Response state without manufacturing a Decision (Review Workspace pass)", () => {
    render(<VersionReviewPage taskId="t1" data={data()} />);
    const evidenceRegion = screen.getByRole("region", {
      name: "Production Evidence",
    });
    expect(
      within(evidenceRegion).getByText("Contrast reads slightly hot."),
    ).toBeVisible();

    const agentRegion = screen.getByRole("region", {
      name: "CG Supervisor Agent Execution Review",
    });
    expect(
      within(agentRegion).getByText(
        "No Execution Review has been generated for this selected Version yet.",
      ),
    ).toBeVisible();

    // Neither the Escalate button nor a pending review may be presented
    // as if it were a persisted Human Decision.
    const humanRegion = screen.getByRole("region", { name: "Human Response" });
    expect(within(humanRegion).getByText(/not a Human Decision/)).toBeVisible();
    expect(within(evidenceRegion).queryByText(/not a Human Decision/)).toBe(
      null,
    );
  });

  it("places Record Review Note, Generate Agent Execution Review, and Escalate to VFX inside the Human Response region only, never inside Production Evidence or the Agent Review region", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({ activeExecutionRevision })}
      />,
    );
    const evidenceRegion = screen.getByRole("region", {
      name: "Production Evidence",
    });
    const agentRegion = screen.getByRole("region", {
      name: "CG Supervisor Agent Execution Review",
    });
    const humanRegion = screen.getByRole("region", { name: "Human Response" });

    for (const region of [evidenceRegion, agentRegion]) {
      expect(
        within(region).queryByRole("button", { name: "Record Review Note" }),
      ).toBeNull();
      expect(
        within(region).queryByRole("button", {
          name: "Generate Agent Execution Review",
        }),
      ).toBeNull();
      expect(
        within(region).queryByRole("button", { name: "Escalate to VFX" }),
      ).toBeNull();
    }

    expect(
      within(humanRegion).getByRole("button", { name: "Record Review Note" }),
    ).toBeVisible();
    expect(
      within(humanRegion).getByRole("button", {
        name: "Generate Agent Execution Review",
      }),
    ).toBeVisible();
    expect(
      within(humanRegion).getByRole("button", { name: "Escalate to VFX" }),
    ).toBeVisible();
  });

  it("relabels the Generate action to Regenerate once a current Agent Execution Review already exists for the active Execution Anchor revision (currentness gating, Package C follow-up)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [review()],
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Generate Agent Execution Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Regenerate Agent Execution Review" }),
    ).toBeVisible();
  });

  it("honestly shows no Agent Execution Review has been generated yet", () => {
    render(<VersionReviewPage taskId="t1" data={data()} />);
    expect(
      screen.getByText(
        "No Execution Review has been generated for this selected Version yet.",
      ),
    ).toBeVisible();
  });

  it("shows a structured real-state Agent Review takeaway (technical/coordination counts, not the raw executive_summary sentence), counts, and a detailed-review disclosure that preserves every real review field", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [
            review({
              review_output: reviewOutput({
                executive_summary: "Reads within the confirmed ceiling.",
                technical_concerns: [
                  {
                    summary: "Contrast pushes toward the ceiling.",
                    rationale: "Approaches the recorded escalation condition.",
                    priority: "high",
                    evidence: [],
                  },
                ],
                questions_for_human_cg_supervisor: [
                  "Should the highlight rolloff be reduced?",
                ],
                evidence_gaps: ["No reference plate was attached."],
              }),
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText(
        "Execution raises 1 technical concern against the confirmed R1 boundary. No cross-role coordination concerns are currently open.",
      ),
    ).toBeVisible();
    for (const [label, count] of [
      ["Technical", "1"],
      ["Coordination", "0"],
      ["Requirements", "0"],
      ["Questions", "1"],
      ["Evidence gaps", "1"],
    ] as const) {
      const signalItem = screen.getByText(label).closest("li")!;
      expect(within(signalItem).getByText(count)).toBeVisible();
    }
    // The decision-relevant preview surfaces the one real high-priority
    // concern without opening the disclosure (the same text also
    // appears inside the still-closed detail disclosure, so this counts
    // occurrences rather than assuming exactly one).
    expect(
      screen.getAllByText("Contrast pushes toward the ceiling.").length,
    ).toBeGreaterThan(0);

    const detailButton = screen.getByText("View detailed Agent review →");
    expect(
      screen.queryByText("Should the highlight rolloff be reduced?"),
    ).not.toBeVisible();
    fireEvent.click(detailButton);
    expect(
      screen.getByText("Should the highlight rolloff be reduced?"),
    ).toBeVisible();
    expect(screen.getByText("No reference plate was attached.")).toBeVisible();
    expect(screen.getByText("Reads within the confirmed range.")).toBeVisible();
  });

  it("keeps the detailed-review disclosure toggle as the same semantic control with matching collapsed/expanded labels -- it must not appear to become a different element (owner-reported regression: the control jumped position when expanded)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [review()],
        })}
      />,
    );

    // Both real labels live inside the same <summary> of the same
    // <details> (a native-CSS `[open]` swap, not JS state) -- which
    // one is visually shown is a CSS concern the jsdom test
    // environment cannot compute (no stylesheet injection here), so
    // this asserts the structural facts that are reliably testable:
    // both exact labels exist in the one real control, and the native
    // `open` attribute -- the actual state driving the CSS swap --
    // toggles correctly on click.
    const toggle = screen.getByText("View detailed Agent review →");
    const details = toggle.closest("details")!;
    const summary = toggle.closest("summary")!;
    expect(details).not.toHaveAttribute("open");
    expect(
      within(summary).getByText("Collapse detailed Agent review ↑"),
    ).toBeInTheDocument();

    fireEvent.click(toggle);

    // Same underlying <details>/<summary> element -- not a different
    // control -- and its `open` attribute is now set.
    expect(toggle.closest("details")).toBe(details);
    expect(details).toHaveAttribute("open");
    expect(
      within(summary).getByText("View detailed Agent review →"),
    ).toBeInTheDocument();
  });

  it("links Review Context's Execution Anchor to the real, already-accessible CG Execution route, but leaves Version and Core Anchor as static text since neither has a real navigable route from this role", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [review()],
        })}
      />,
    );
    fireEvent.click(screen.getByText("View detailed Agent review →"));

    const reviewContext = screen
      .getByText("Review context")
      .closest("section")!;
    const link = within(reviewContext).getByRole("link", {
      name: "Confirmed R1 →",
    });
    expect(link).toHaveAttribute("href", "/cg/tasks/t1/execution");

    // Only the Execution Anchor value is interactive.
    expect(within(reviewContext).getAllByRole("link")).toHaveLength(1);
    expect(within(reviewContext).getByText("SH010_v001")).toBeVisible();
    expect(
      within(reviewContext).getByText("SH010_v001").closest("a"),
    ).toBeNull();
  });

  it("shows earlier Agent Execution Reviews for the same Version as real, visually secondary history -- never replacing the current review", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [
            review({
              id: "cgr2",
              created_at: "2026-01-05T00:00:00Z",
              review_output: reviewOutput({
                executive_summary: "Current: within ceiling.",
                technical_concerns: [
                  {
                    summary: "Contrast pushes toward the ceiling.",
                    rationale: "Approaches the recorded escalation condition.",
                    priority: "high",
                    evidence: [],
                  },
                ],
              }),
            }),
            review({
              id: "cgr1",
              created_at: "2026-01-01T00:00:00Z",
              review_output: reviewOutput({
                executive_summary: "Earlier: exceeded ceiling.",
              }),
            }),
          ],
        })}
      />,
    );
    // The current review's own structured takeaway (1 real technical
    // concern) is shown in the Agent Review Summary -- distinct from
    // the older review's own raw executive_summary shown in history.
    expect(
      screen.getByText(
        "Execution raises 1 technical concern against the confirmed R1 boundary. No cross-role coordination concerns are currently open.",
      ),
    ).toBeVisible();
    const historyRegion = screen.getByRole("region", {
      name: "Earlier Agent Execution Reviews",
    });
    expect(
      within(historyRegion).getByText("Earlier: exceeded ceiling."),
    ).toBeVisible();
  });

  it("shows the ftrack external author as source provenance on Review Notes, not an ICAS Human role (Step 8C-6/8C-7)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          versions: [
            {
              version: version(),
              reviewNotes: [
                note({
                  source: "ftrack",
                  created_by_actor_kind: "system",
                  created_by_human_role: null,
                  external_author_id: "ext-42",
                  external_author_name: "Jamie Lin",
                }),
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/Source author: Jamie Lin/)).toBeVisible();
    expect(screen.queryByText(/vfx_supervisor/)).not.toBeInTheDocument();
  });

  it("falls back to the actor kind, never a fabricated name, when an ftrack Review Note has no external_author_name", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          versions: [
            {
              version: version(),
              reviewNotes: [
                note({
                  source: "ftrack",
                  created_by_actor_kind: "system",
                  created_by_human_role: null,
                  external_author_id: "ext-42",
                  external_author_name: null,
                }),
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/^system ·/)).toBeVisible();
    expect(screen.queryByText(/Source author:/)).not.toBeInTheDocument();
  });

  it("strips the verified real CG D1 Golden Journey implementation labels from the Agent Review summary, decision-relevant preview items, and the expanded Detailed Agent Review -- the previous exact-string allowlist did not cover these real runtime label variants (owner-reported regression)", () => {
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          activeExecutionRevision,
          cgSupervisorReviews: [
            review({
              review_output: reviewOutput({
                executive_summary:
                  "[CG D1 deterministic - R2 combined-intensity ceiling compliance] Animation Execution Anchor R2 confirmed compliant with the combined-intensity ceiling.",
                execution_direction_read: {
                  summary:
                    "[CG D1 deterministic - R2 combined-intensity ceiling compliance] Lighting stays within the confirmed ceiling.",
                  rationale:
                    "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Matches the confirmed Execution Anchor.",
                  priority: "low",
                  evidence: [],
                },
                technical_concerns: [
                  {
                    summary:
                      "[CG D1 deterministic - R2 combined-intensity ceiling compliance] Contrast approaches the ceiling.",
                    rationale:
                      "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation] Recorded escalation condition.",
                    priority: "high",
                    evidence: [],
                  },
                ],
              }),
            }),
          ],
        })}
      />,
    );

    // Agent Review summary now shows a structured takeaway derived
    // from real counts, not the raw (label-bearing) executive_summary
    // sentence -- confirms the leaked label cannot resurface there.
    expect(
      screen.getByText(
        "Execution raises 1 technical concern against the confirmed R1 boundary. No cross-role coordination concerns are currently open.",
      ),
    ).toBeVisible();
    // Decision-relevant preview item (technical concern summary)
    expect(
      screen.getAllByText("Contrast approaches the ceiling.").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("View detailed Agent review →"));
    expect(
      screen.getByText("Lighting stays within the confirmed ceiling."),
    ).toBeVisible();
    expect(
      screen.getByText("Matches the confirmed Execution Anchor."),
    ).toBeVisible();
    // Also shown in the still-visible top-2 preview's own rationale line,
    // so this counts occurrences rather than assuming exactly one.
    expect(
      screen.getAllByText("Recorded escalation condition.").length,
    ).toBeGreaterThan(0);

    expect(screen.queryByText(/CG D1 deterministic/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/combined-intensity ceiling translation/),
    ).not.toBeInTheDocument();
  });

  it("shows the real Version name alone, without a redundant (vN) suffix, when the name already ends with the equivalent V{number} -- in the selector, the Version Review header, and the Latest Production Version line (owner-reported: 'Compositing Conflict V1 (v1)' read as redundant)", () => {
    const versionA = version({
      id: "v1",
      name: "Compositing Conflict V1",
      version_number: 1,
    });
    const versionB = version({
      id: "v2",
      name: "Comp Resolved V2",
      version_number: 2,
    });
    render(
      <VersionReviewPage
        taskId="t1"
        data={data({
          item: item({
            latest_version_id: "v2",
            latest_version_name: "Comp Resolved V2",
            latest_version_number: 2,
          }),
          versions: [
            { version: versionA, reviewNotes: [] },
            { version: versionB, reviewNotes: [] },
          ],
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: /^Compositing Conflict V1/ }),
    ).toBeVisible();
    expect(
      screen.queryByText("Compositing Conflict V1 (v1)"),
    ).not.toBeInTheDocument();

    const versionRegion = screen.getByRole("region", {
      name: "Version under review",
    });
    expect(
      within(versionRegion).getByText("Compositing Conflict V1"),
    ).toBeVisible();
    expect(within(versionRegion).getByText("Latest production")).toBeVisible();
    expect(within(versionRegion).getByText(/Comp Resolved V2/)).toBeVisible();
  });

  describe("Step 9B-4 real media context", () => {
    it("resolves real media for the selected Version via the Task-scoped Server Action, inside Production Evidence", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "playable",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: "https://ftrack.example/video",
          playable_media_type: "video/mp4",
          playable_component_name: "ftrackreview-mp4",
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(<VersionReviewPage taskId="t1" data={data()} />);

      expect(resolveVersionMediaAction).toHaveBeenCalledWith("t1", "v1");
      await waitFor(() => {
        expect(document.querySelector("video")).toBeTruthy();
      });

      const evidenceRegion = screen.getByRole("region", {
        name: "Production Evidence",
      });
      expect(
        within(evidenceRegion).getByRole("button", { name: "Refresh media" }),
      ).toBeVisible();
    });

    it("does not classify media as Agent Interpretation or Human Response", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "thumbnail_only",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: null,
          playable_media_type: null,
          playable_component_name: null,
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(<VersionReviewPage taskId="t1" data={data()} />);

      await waitFor(() => expect(document.querySelector("img")).toBeTruthy());

      const agentRegion = screen.getByRole("region", {
        name: "CG Supervisor Agent Execution Review",
      });
      const humanRegion = screen.getByRole("region", {
        name: "Human Response",
      });
      expect(within(agentRegion).queryByRole("img")).not.toBeInTheDocument();
      expect(within(humanRegion).queryByRole("img")).not.toBeInTheDocument();
    });

    it("does not remove Review Notes or Anchor context when media resolution fails", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: false,
        message: "The ICAS service is unavailable.",
      });

      render(<VersionReviewPage taskId="t1" data={data()} />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "The ICAS service is unavailable.",
        );
      });
      expect(screen.getByText("Contrast reads slightly hot.")).toBeVisible();
    });

    it("never renders a media upload, annotation, or ftrack write-back control", async () => {
      vi.mocked(resolveVersionMediaAction).mockResolvedValueOnce({
        ok: true,
        media: {
          version_id: "v1",
          source: "ftrack",
          ftrack_linked: true,
          media_state: "playable",
          thumbnail_url: "https://ftrack.example/thumb",
          playable_url: "https://ftrack.example/video",
          playable_media_type: "video/mp4",
          playable_component_name: "ftrackreview-mp4",
          external_web_url: null,
          resolved_at: "2026-08-01T00:00:00Z",
          url_expires_at: null,
          unavailable_reason: null,
        },
      });

      render(<VersionReviewPage taskId="t1" data={data()} />);

      await waitFor(() => expect(document.querySelector("video")).toBeTruthy());
      expect(
        screen.queryByRole("button", { name: /Upload/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Annotate/i }),
      ).not.toBeInTheDocument();
    });
  });
});
