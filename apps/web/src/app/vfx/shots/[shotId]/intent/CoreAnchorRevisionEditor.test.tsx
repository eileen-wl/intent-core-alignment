import type { CoreAnchorRevisionRead, HumanGateRead } from "@intent-core/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { confirmMock, rejectMock, saveMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  rejectMock: vi.fn(),
  saveMock: vi.fn(),
}));
vi.mock("@/features/vfx/intent-workspace/actions", () => ({
  confirmCoreAnchorRevisionAction: confirmMock,
  rejectCoreAnchorRevisionAction: rejectMock,
  saveCoreAnchorDraftAction: saveMock,
}));

import { CoreAnchorRevisionEditor } from "./CoreAnchorRevisionEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
      confirmedRevision={CONFIRMED}
      draftRevision={baseRevision()}
      humanGate={GATE}
      {...overrides}
    />,
  );
}

describe("CoreAnchorRevisionEditor", () => {
  it("renders both the confirmed and proposed draft columns", () => {
    renderEditor();
    expect(screen.getByText("Current confirmed")).toBeVisible();
    expect(screen.getByText("Proposed draft")).toBeVisible();
    // Same default core_summary in this fixture's confirmed and draft
    // revisions -- appears once as read-only text, once as the
    // editable textarea's live value.
    expect(screen.getAllByText("Quiet dread")).toHaveLength(2);
  });

  it("shows an honest 'no Core Anchor confirmed yet' message when there is no confirmed revision", () => {
    renderEditor({ confirmedRevision: null });
    expect(screen.getByText("No Core Anchor confirmed yet.")).toBeVisible();
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

  it("submits Confirm through the dialog and shows the resolved outcome", async () => {
    confirmMock.mockResolvedValue({ ok: true, revision: baseRevision({ status: "confirmed" }) });
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[1]);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("s1", "r2", "gate-1", ""));
    expect(screen.getByText(/was confirmed at/)).toBeVisible();
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

  it("disables Confirm and Reject when there is no pending HumanGate", () => {
    renderEditor({ humanGate: null });
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });
});
