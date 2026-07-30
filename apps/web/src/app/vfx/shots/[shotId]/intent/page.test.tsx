import type { CoreAnchorRevisionRead } from "@intent-core/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

const redirectSpy = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    redirectSpy(destination);
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

const { loadIntentWorkspaceDataMock } = vi.hoisted(() => ({
  loadIntentWorkspaceDataMock: vi.fn(),
}));
vi.mock("@/features/vfx/intent-workspace/data", () => ({
  loadIntentWorkspaceData: loadIntentWorkspaceDataMock,
}));

vi.mock("../../../../demo/actions", () => ({
  exitRoleView: vi.fn(),
}));

import { IntentWorkspacePage } from "./IntentWorkspacePage";
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockReturnValue({ value: "vfx_supervisor" });
});

function confirmedRevision(overrides: Partial<CoreAnchorRevisionRead> = {}): CoreAnchorRevisionRead {
  return {
    id: "r2",
    core_anchor_id: "a1",
    revision_number: 2,
    status: "confirmed",
    shot_objective: null,
    emotional_tone: null,
    visual_focus: null,
    rhythm_intensity: null,
    character_relationship: null,
    narrative_priority: null,
    core_summary: "A restrained dusk confrontation.",
    created_by_actor_kind: "human",
    created_by_actor_id: "vfx-1",
    created_by_human_role: "vfx_supervisor",
    created_by_agent_type: null,
    created_by_agent_run_id: null,
    context_snapshot_id: null,
    confirmed_by_human_role: "vfx_supervisor",
    confirmed_by_actor_id: "vfx-1",
    confirmed_at: "2026-01-01T00:00:00Z",
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

const params = Promise.resolve({ shotId: "s1" });

describe("/vfx/shots/:shotId/intent page", () => {
  it("passes justConfirmed=true when the search param names the real current confirmed revision", async () => {
    loadIntentWorkspaceDataMock.mockResolvedValue({
      item: { shot_id: "s1" },
      confirmedRevision: confirmedRevision({ id: "r2" }),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
    });

    const result = await Page({
      params,
      searchParams: Promise.resolve({ justConfirmed: "r2" }),
    });

    expect(result.type).toBe(IntentWorkspacePage);
    expect(result.props.justConfirmed).toBe(true);
  });

  it("passes justConfirmed=false for a stale id that no longer matches the current confirmed revision", async () => {
    loadIntentWorkspaceDataMock.mockResolvedValue({
      item: { shot_id: "s1" },
      confirmedRevision: confirmedRevision({ id: "r2" }),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
    });

    const result = await Page({
      params,
      searchParams: Promise.resolve({ justConfirmed: "some-other-revision-id" }),
    });

    expect(result.props.justConfirmed).toBe(false);
  });

  it("passes justConfirmed=false when there is no confirmed revision at all (e.g. a rejected first draft)", async () => {
    loadIntentWorkspaceDataMock.mockResolvedValue({
      item: { shot_id: "s1" },
      confirmedRevision: null,
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
    });

    const result = await Page({
      params,
      searchParams: Promise.resolve({ justConfirmed: "r2" }),
    });

    expect(result.props.justConfirmed).toBe(false);
  });

  it("passes justConfirmed=false on a plain visit with no search param (Normal Confirmed)", async () => {
    loadIntentWorkspaceDataMock.mockResolvedValue({
      item: { shot_id: "s1" },
      confirmedRevision: confirmedRevision({ id: "r2" }),
      draftRevision: null,
      draftHumanGate: null,
      evidenceData: null,
      previousConfirmedRevision: null,
    });

    const result = await Page({ params, searchParams: Promise.resolve({}) });

    expect(result.props.justConfirmed).toBe(false);
  });
});
