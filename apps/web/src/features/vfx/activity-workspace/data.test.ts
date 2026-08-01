import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadActivityWorkspaceData } from "./data";

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
  shot_id: "s1",
  project_name: "D1 Demo Project",
  shot_name: "Shot 010",
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("loadActivityWorkspaceData", () => {
  it("returns null on a real 404 (Shot not found)", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { detail: "not found" }));
    const result = await loadActivityWorkspaceData("missing-shot");
    expect(result).toBeNull();
  });

  it("propagates a genuine API failure instead of collapsing it into null", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { detail: "boom" }));
    await expect(loadActivityWorkspaceData("s1")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("returns the real activity timeline exactly as the backend delivers it", async () => {
    const events = [
      {
        id: "e2",
        event_type: "core_anchor_confirmed",
        occurred_at: "2026-01-02T00:00:00Z",
        summary: "s2",
        related_entity_type: "decision",
        related_entity_id: "d1",
        route: "/vfx/shots/s1/intent",
      },
      {
        id: "e1",
        event_type: "core_anchor_draft_created",
        occurred_at: "2026-01-01T00:00:00Z",
        summary: "s1",
        related_entity_type: "core_anchor_revision",
        related_entity_id: "r1",
        route: "/vfx/shots/s1/intent",
      },
    ];
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, { shot_id: "s1", events }));

    const result = await loadActivityWorkspaceData("s1");
    expect(result?.activity.events).toEqual(events);
  });

  it("honestly returns an empty events array when nothing has ever happened", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, ITEM))
      .mockResolvedValueOnce(jsonResponse(200, { shot_id: "s1", events: [] }));

    const result = await loadActivityWorkspaceData("s1");
    expect(result?.activity.events).toEqual([]);
  });
});
