import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadTaskOverviewData } from "./data";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    task_id: "t1",
    task_name: "Animation Pass",
    department: "animation",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary: "Keep it restrained.",
    latest_version_id: "v1",
    latest_version_name: "v001",
    latest_version_number: 1,
    guidance_state: "none",
    latest_guidance_id: null,
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: {
      focus_type: "none",
      title: "Nothing requires your attention on this Task right now",
      explanation: "Nothing requires your attention on this Task right now.",
      target_route: "/artist/tasks/t1",
      primary_action_label: null,
      actionable: false,
    },
    sort_rank: 0,
    ...overrides,
  };
}

function makeGuidance(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    project_id: "p1",
    shot_id: "s1",
    task_id: "t1",
    version_id: "v1",
    execution_anchor_revision_id: "ea1",
    context_snapshot_id: "cs1",
    agent_run_id: "run1",
    guidance_output: {
      executive_summary: "Push the rim light slightly warmer.",
      creative_intent_read: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      task_goal: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      current_iteration_read: {
        summary: "s",
        why_it_matters: "w",
        priority: "medium",
        evidence: [],
      },
      non_negotiables: [],
      allowed_variations: [],
      feedback_translations: [],
      iteration_priorities: [],
      cross_department_dependencies: [],
      questions_for_human_supervisor: [],
      evidence_gaps: [],
    },
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

/** Queues the six sequential real fetches `loadTaskOverviewData` issues
 * for an Item with no confirmed Core/Execution Anchor revision on file
 * (so neither optional revision-list call fires) and a real latest
 * Version (so both the guidance and Review Note calls fire): item ->
 * [coreAnchor, executionAnchor, dependencies] -> guidances -> reviewNotes. */
function queueResponses(item: unknown, guidances: unknown[]) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, item)) // fetchArtistInboxItem
    .mockResolvedValueOnce(jsonResponse(200, null)) // getCoreAnchor
    .mockResolvedValueOnce(jsonResponse(200, null)) // getExecutionAnchor
    .mockResolvedValueOnce(jsonResponse(200, [])) // listDependenciesForTask
    .mockResolvedValueOnce(jsonResponse(200, guidances)) // listArtistGuidancesForVersion
    .mockResolvedValueOnce(jsonResponse(200, [])); // listReviewNotesForVersion
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadTaskOverviewData -- Guidance state/content consistency", () => {
  it("case A: no guidance recorded for this Task -- guidance_state 'none' and latestGuidance null", async () => {
    queueResponses(makeItem({ guidance_state: "none" }), []);
    const result = await loadTaskOverviewData("t1");
    expect(result?.item.guidance_state).toBe("none");
    expect(result?.latestGuidance).toBeNull();
  });

  it("case B: current guidance recorded for this Task -- guidance_state 'current' and latestGuidance populated", async () => {
    const guidance = makeGuidance({ task_id: "t1" });
    queueResponses(makeItem({ guidance_state: "current" }), [guidance]);
    const result = await loadTaskOverviewData("t1");
    expect(result?.item.guidance_state).toBe("current");
    expect(result?.latestGuidance?.id).toBe("g1");
  });

  it("case C: outdated guidance recorded for this Task -- guidance_state 'outdated' and latestGuidance still populated", async () => {
    const guidance = makeGuidance({
      task_id: "t1",
      execution_anchor_revision_id: "ea-old",
    });
    queueResponses(makeItem({ guidance_state: "outdated" }), [guidance]);
    const result = await loadTaskOverviewData("t1");
    expect(result?.item.guidance_state).toBe("outdated");
    expect(result?.latestGuidance?.id).toBe("g1");
  });

  it("regression: a sibling Task's guidance on the same Shot/Version is never borrowed when this Task genuinely has none", async () => {
    // Reproduces the reported browser bug: the Shot's latest Version
    // carries real guidance, but only for a different Task
    // ("Lighting Pass"), never for this one ("Animation Pass"). The
    // backend's own `item.guidance_state` already correctly says
    // "none"; `latestGuidance` must agree, not fall back to the
    // sibling Task's row.
    const siblingGuidance = makeGuidance({ id: "g-sibling", task_id: "t2" });
    queueResponses(makeItem({ guidance_state: "none" }), [siblingGuidance]);
    const result = await loadTaskOverviewData("t1");
    expect(result?.item.guidance_state).toBe("none");
    expect(result?.latestGuidance).toBeNull();
  });
});
