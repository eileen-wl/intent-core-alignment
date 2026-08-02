import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadFeedbackHistoryData } from "./data";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    json: async () => body,
  };
}

const ITEM = {
  task_id: "t1",
  shot_id: "s1",
  project_name: "D1 Demo Project",
  shot_name: "Shot 010",
  task_name: "Lighting Pass",
};

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "e1",
    event_type: "review_note_recorded",
    occurred_at: "2026-01-01T00:00:00Z",
    actor_kind: "human",
    actor_id: "vfx-1",
    actor_human_role: "vfx_supervisor",
    summary: "A Review Note was recorded.",
    related_entity_type: "review_note",
    related_entity_id: "n1",
    related_version_id: null,
    route: "/artist/tasks/t1/current-version",
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    shot_id: "s1",
    task_id: null,
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

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadFeedbackHistoryData", () => {
  it("returns null on a real 404 (Task not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadFeedbackHistoryData("missing-task");
    expect(result).toBeNull();
  });

  it("keeps an event with no related Version (e.g. an Execution Anchor Decision) unchanged", async () => {
    const event = makeEvent({ id: "e-no-version", related_version_id: null });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM)) // fetchArtistInboxItem
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", events: [event] }),
      ) // getTaskFeedbackHistory
      .mockResolvedValueOnce(jsonResponse(200, [])); // listVersionsForShot

    const result = await loadFeedbackHistoryData("t1");
    expect(result?.history.events.map((e) => e.id)).toEqual(["e-no-version"]);
  });

  it("keeps an event whose related Version belongs to this Task", async () => {
    const version = makeVersion({ id: "v-this", task_id: "t1" });
    const event = makeEvent({
      id: "e-this-task",
      related_version_id: "v-this",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", events: [event] }),
      )
      .mockResolvedValueOnce(jsonResponse(200, [version]));

    const result = await loadFeedbackHistoryData("t1");
    expect(result?.history.events.map((e) => e.id)).toEqual(["e-this-task"]);
  });

  it("keeps an event whose related Version has no Task link (manual/legacy compatibility)", async () => {
    const version = makeVersion({ id: "v-legacy", task_id: null });
    const event = makeEvent({
      id: "e-legacy",
      related_version_id: "v-legacy",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", events: [event] }),
      )
      .mockResolvedValueOnce(jsonResponse(200, [version]));

    const result = await loadFeedbackHistoryData("t1");
    expect(result?.history.events.map((e) => e.id)).toEqual(["e-legacy"]);
  });

  it("excludes an event whose related Version is linked to a different Task -- the cross-Task leak this loader exists to close (Step 8C-6/8C-7)", async () => {
    const versionThisTask = makeVersion({ id: "v-this", task_id: "t1" });
    const versionOtherTask = makeVersion({ id: "v-other", task_id: "t2" });
    const eventThisTask = makeEvent({
      id: "e-this-task",
      related_version_id: "v-this",
    });
    const eventOtherTask = makeEvent({
      id: "e-other-task",
      related_version_id: "v-other",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          task_id: "t1",
          events: [eventThisTask, eventOtherTask],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, [versionThisTask, versionOtherTask]),
      );

    const result = await loadFeedbackHistoryData("t1");
    const ids = result?.history.events.map((e) => e.id);
    expect(ids).toEqual(["e-this-task"]);
    expect(ids).not.toContain("e-other-task");
  });

  it("fails closed: excludes an event whose related_version_id cannot be resolved in the Shot's real Version list", async () => {
    const event = makeEvent({
      id: "e-unresolvable",
      related_version_id: "does-not-exist",
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(
        jsonResponse(200, { task_id: "t1", events: [event] }),
      )
      .mockResolvedValueOnce(jsonResponse(200, []));

    const result = await loadFeedbackHistoryData("t1");
    expect(result?.history.events).toEqual([]);
  });
});
