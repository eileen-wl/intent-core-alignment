import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DemoScenarioUnavailableError,
  resolveD1DemoShotId,
  resolveD1GuidedDemoShotId,
} from "./demoScenario";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("resolveD1DemoShotId", () => {
  it("returns the real shot_id from a successful ensure call", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        project_id: "p1",
        shot_id: "s1",
        task_id: "t1",
        version_id: "v1",
      }),
    });

    const shotId = await resolveD1DemoShotId();

    expect(shotId).toBe("s1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/internal/demo/ensure-d1-scenario",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws DemoScenarioUnavailableError on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    await expect(resolveD1DemoShotId()).rejects.toThrow(DemoScenarioUnavailableError);
  });

  it("throws DemoScenarioUnavailableError on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(resolveD1DemoShotId()).rejects.toThrow(DemoScenarioUnavailableError);
  });
});

describe("resolveD1GuidedDemoShotId", () => {
  it("calls the guided ensure endpoint, distinct from the rich one", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        project_id: "p1",
        shot_id: "guided-s1",
        task_id: "t1",
        version_id: "v1",
      }),
    });

    const shotId = await resolveD1GuidedDemoShotId();

    expect(shotId).toBe("guided-s1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/internal/demo/ensure-d1-guided-scenario",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws DemoScenarioUnavailableError on a non-2xx response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });
    await expect(resolveD1GuidedDemoShotId()).rejects.toThrow(DemoScenarioUnavailableError);
  });

  it("throws DemoScenarioUnavailableError on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(resolveD1GuidedDemoShotId()).rejects.toThrow(DemoScenarioUnavailableError);
  });
});
