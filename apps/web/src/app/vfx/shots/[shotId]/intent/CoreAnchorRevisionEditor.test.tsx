import type { CoreAnchorRevisionRead, HumanGateRead, VfxInboxItemRead } from "@intent-core/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { confirmMock, rejectMock, saveMock, routerPushMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  rejectMock: vi.fn(),
  saveMock: vi.fn(),
  routerPushMock: vi.fn(),
}));
vi.mock("@/features/vfx/intent-workspace/actions", () => ({
  confirmCoreAnchorRevisionAction: confirmMock,
  rejectCoreAnchorRevisionAction: rejectMock,
  saveCoreAnchorDraftAction: saveMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
  usePathname: () => "/vfx/shots/s1/intent",
}));

import { CoreAnchorRevisionEditor } from "./CoreAnchorRevisionEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function baseItem(overrides: Partial<VfxInboxItemRead> = {}): VfxInboxItemRead {
  return {
    project_id: "p1",
    project_name: "D1 Demo Project",
    shot_id: "s1",
    shot_name: "Shot 010 — Final confrontation",
    shot_source: "manual",
    core_anchor_state: "draft_pending",
    active_core_anchor_revision_id: null,
    active_core_anchor_summary: null,
    pending_human_gate_id: "gate-1",
    relevant_task_id: "t1",
    relevant_task_name: "Compositing Review",
    relevant_version_id: "v1",
    relevant_version_name: "D1_STEP3_VFX_REVIEW_001",
    relevant_version_number: 1,
    pairing_established: true,
    latest_assessment_id: null,
    latest_assessment_created_at: null,
    latest_signal_id: null,
    latest_signal_attention_level: null,
    latest_signal_summary: null,
    re_anchor_proposal_present: false,
    current_focus: {
      focus_type: "core_anchor_draft_needs_review",
      title: "Core Anchor draft in progress",
      explanation: "A draft revision exists but has not yet been submitted for confirmation.",
      target_route: "/vfx/shots/s1/intent",
      primary_action_label: "Review draft",
      actionable: true,
    },
    next_candidates: [],
    sort_rank: 1,
    ...overrides,
  };
}

function baseRevision(overrides: Partial<CoreAnchorRevisionRead> = {}): CoreAnchorRevisionRead {
  return {
    id: "r2",
    core_anchor_id: "a1",
    revision_number: 2,
    status: "draft",
    shot_objective: "Keep it restrained",
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "Quiet dread",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: null,
    confirmed_by_actor_id: null,
    confirmed_at: null,
    supersedes_revision_id: "r1",
    source_intent_decomposition_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    constraints: [],
    variation_zones: [],
    drift_risks: [],
    references: [],
    open_questions: [],
    ...overrides,
  };
}

const CONFIRMED = baseRevision({
  id: "r1",
  status: "confirmed",
  revision_number: 1,
  confirmed_by_human_role: "vfx_supervisor",
  confirmed_at: "2025-12-01T00:00:00Z",
});

const GATE: HumanGateRead = {
  id: "gate-1",
  shot_id: "s1",
  core_anchor_revision_id: "r2",
  execution_anchor_revision_id: null,
  gate_type: "core_anchor_confirmation",
  required_role: "vfx_supervisor",
  status: "pending",
  opened_at: "2026-01-01T00:00:00Z",
  resolved_at: null,
  resolved_by_actor_id: null,
  resolved_by_role: null,
  resolved_by_actor_type: null,
  rationale: null,
  decision_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function renderEditor(overrides: Partial<Parameters<typeof CoreAnchorRevisionEditor>[0]> = {}) {
  return render(
    <CoreAnchorRevisionEditor
      shotId="s1"
      shotName="Shot 010"
      item={baseItem()}
      confirmedRevision={CONFIRMED}
      draftRevision={baseRevision()}
      humanGate={GATE}
      evidenceData={null}
      {...overrides}
    />,
  );
}

describe("CoreAnchorRevisionEditor", () => {
  it("REVISION DRAFT: renders both the Current confirmed and Proposed draft revision columns", () => {
    renderEditor();
    expect(screen.getByText("Current confirmed")).toBeVisible();
    expect(screen.getByText("Proposed draft revision")).toBeVisible();
    // Same default core_summary in this fixture's confirmed and draft
    // revisions -- appears once as read-only text, once as the
    // editable textarea's live value.
    expect(screen.getAllByText("Quiet dread")).toHaveLength(2);
  });

  it("FIRST DRAFT: renders no Current confirmed column, and a clear Revision 1 Draft identity", () => {
    renderEditor({
      confirmedRevision: null,
      draftRevision: baseRevision({ id: "r1", revision_number: 1 }),
    });
    expect(screen.queryByText("Current confirmed")).not.toBeInTheDocument();
    expect(screen.queryByText("No Core Anchor confirmed yet.")).not.toBeInTheDocument();
    expect(screen.getByText("Create the first Core Anchor")).toBeVisible();
    expect(screen.getByText("Revision 1")).toBeVisible();
    expect(screen.getByText("Draft in progress")).toBeVisible();
  });

  it("FIRST DRAFT: shows read-only Source of creative intent, separate from the editable draft form", () => {
    renderEditor({
      confirmedRevision: null,
      draftRevision: baseRevision({ id: "r1", revision_number: 1 }),
      evidenceData: { evidence: [], run: null, snapshot: null, decompositions: [], reconstructions: [] },
    });
    expect(screen.getByText("Source and supporting context")).toBeVisible();
    // The Shot's real Task context appears in the read-only panel.
    expect(screen.getAllByText("Compositing Review").length).toBeGreaterThan(0);
  });

  it("FIRST DRAFT: presents saved status and content counts without a change summary", () => {
    renderEditor({
      confirmedRevision: null,
      draftRevision: baseRevision({
        id: "r1",
        revision_number: 1,
        constraints: [
          { id: "c1", order_index: 0, content: "Keep the movement restrained.", created_at: "2026-01-01T00:00:00Z" },
        ],
        variation_zones: [
          { id: "z1", order_index: 0, content: "Lighting may vary.", created_at: "2026-01-01T00:00:00Z" },
        ],
      }),
    });
    expect(screen.getByText("Draft status: Saved")).toBeVisible();
    const contentOverview = within(screen.getByLabelText("Content overview"));
    expect(contentOverview.getByText("Constraints")).toBeVisible();
    expect(contentOverview.getByText("Variation zones")).toBeVisible();
    expect(screen.queryByText(/Change summary:/)).not.toBeInTheDocument();
  });

  it("FIRST DRAFT: distinguishes Save, Discard and confirmation actions", () => {
    renderEditor({
      confirmedRevision: null,
      draftRevision: baseRevision({ id: "r1", revision_number: 1 }),
    });
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm first Core Anchor" })).toBeVisible();
    expect(screen.getByText("Decision rationale · Optional")).toBeVisible();
  });

  it("rejects a blank required collection field and does not call the save action", () => {
    renderEditor({
      draftRevision: baseRevision({
        constraints: [{ id: "c1", order_index: 0, content: "", created_at: "2026-01-01T00:00:00Z" }],
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByText("This field cannot be blank.")).toBeVisible();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("saves successfully and shows a saved confirmation", async () => {
    saveMock.mockResolvedValue({ ok: true, revision: baseRevision({ core_summary: "Updated" }) });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByText("Changes saved.")).toBeVisible());
    expect(saveMock).toHaveBeenCalledWith("s1", "r2", expect.objectContaining({ core_summary: "Quiet dread" }));
  });

  it("shows the save error message and preserves the last persisted valid draft on failure", async () => {
    saveMock.mockResolvedValue({
      ok: false,
      error: { kind: "conflict", message: "This was already acted on elsewhere -- reload to see the current state." },
    });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(
        screen.getByText("This was already acted on elsewhere -- reload to see the current state."),
      ).toBeVisible(),
    );
    expect(screen.getAllByText("Quiet dread").length).toBeGreaterThan(0);
  });

  it("opens the Confirm dialog and closes it on Cancel without calling the action", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText("Confirm this Core Anchor revision?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("the Confirm dialog communicates Human VFX Supervisor authority and the Revision number", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(screen.getByText(/Human VFX Supervisor may confirm/)).toBeVisible();
    expect(screen.getByText(/revision #2/)).toBeVisible();
  });

  it("submits Confirm through the dialog and navigates to the transient justConfirmed success URL (Step 7C-2)", async () => {
    confirmMock.mockResolvedValue({
      ok: true,
      revision: baseRevision({ id: "r2", status: "confirmed" }),
    });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[1]);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("s1", "r2", "gate-1", ""));
    // The draft is gone the instant this succeeds -- this component is
    // about to unmount, so the transient success presentation is
    // handed off via navigation (to ConfirmedAnchorSummary) rather than
    // shown locally here.
    expect(routerPushMock).toHaveBeenCalledWith("/vfx/shots/s1/intent?justConfirmed=r2");
    expect(screen.queryByText(/was confirmed at/)).not.toBeInTheDocument();
  });

  it("opens the Reject dialog and closes it on Cancel without calling the action", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText("Reject this Core Anchor revision?")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it("submits Reject through the dialog and shows the resolved outcome", async () => {
    rejectMock.mockResolvedValue({ ok: true, revision: baseRevision({ status: "rejected" }) });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Reject" })[1]);
    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("s1", "r2", "gate-1", ""));
    expect(screen.getByText(/was rejected at/)).toBeVisible();
  });

  it("shows a conflict message with a single Reload action instead of pretending success", async () => {
    confirmMock.mockResolvedValue({
      ok: false,
      error: { kind: "conflict", message: "This was already acted on elsewhere -- reload to see the current state." },
    });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[1]);
    await waitFor(() =>
      expect(
        screen.getByText("This was already acted on elsewhere -- reload to see the current state."),
      ).toBeVisible(),
    );
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });

  it("does NOT disable Confirm/Reject merely because no HumanGate has been loaded yet (legacy-compatibility case: the real backend confirm/reject call creates the missing gate atomically)", () => {
    renderEditor({ humanGate: null });
    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).not.toBeDisabled();
  });

  it("submits Confirm with a null humanGateId when no gate has been loaded yet, and the Server Action still resolves it", async () => {
    confirmMock.mockResolvedValue({
      ok: true,
      revision: baseRevision({ id: "r2", status: "confirmed" }),
    });
    renderEditor({ humanGate: null });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[1]);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("s1", "r2", null, ""));
    expect(routerPushMock).toHaveBeenCalledWith("/vfx/shots/s1/intent?justConfirmed=r2");
  });

  it("blocks Confirm and explains why when the form has unsaved changes, but never blocks Reject on that", () => {
    renderEditor();
    const [firstTextarea] = screen.getAllByRole("textbox");
    fireEvent.change(firstTextarea, { target: { value: "An edited value, not yet saved" } });

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).not.toBeDisabled();
    expect(
      screen.getByText(/Save the draft before confirming/),
    ).toBeVisible();
  });

  it("re-enables Confirm, and clears the blocking-reason message, once the edit is saved", async () => {
    saveMock.mockResolvedValue({ ok: true, revision: baseRevision({ core_summary: "Updated" }) });
    renderEditor();
    const [firstTextarea] = screen.getAllByRole("textbox");
    fireEvent.change(firstTextarea, { target: { value: "An edited value" } });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByText("Changes saved.")).toBeVisible());

    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
    expect(
      screen.queryByText(/Save the draft before confirming/),
    ).not.toBeInTheDocument();
  });

  it("shows a restrained Changed indicator for a field that differs from the confirmed revision, honoring the Show changes toggle", () => {
    renderEditor({
      confirmedRevision: CONFIRMED,
      draftRevision: baseRevision({ shot_objective: "A new objective, changed from confirmed" }),
    });
    expect(screen.getAllByLabelText("Changed").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "Show changes" }));
    expect(screen.queryByLabelText("Changed")).not.toBeInTheDocument();
  });
});
