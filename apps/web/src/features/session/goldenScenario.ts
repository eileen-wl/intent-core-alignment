"use server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

export interface GoldenScenarioResult {
  snapshot: "reset" | "completed";
  project_id: string;
  shot_id: string;
  task_ids: string[];
  version_ids: string[];
  counts: Record<string, number>;
  completed_at: string;
  project_external_id: "icas-demo:golden";
}

class GoldenScenarioUnavailableError extends Error {
  constructor() {
    super("The ICAS Golden Demo is unavailable.");
    this.name = "GoldenScenarioUnavailableError";
  }
}

async function goldenRequest<T>(
  path: string,
  method: "GET" | "POST",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      cache: "no-store",
    });
  } catch {
    throw new GoldenScenarioUnavailableError();
  }
  if (!response.ok) throw new GoldenScenarioUnavailableError();
  return (await response.json()) as T;
}

export async function getGoldenScenarioStatus(): Promise<GoldenScenarioResult | null> {
  return goldenRequest<GoldenScenarioResult | null>(
    "/internal/demo/golden/status",
    "GET",
  );
}

export async function resetGoldenScenario(): Promise<GoldenScenarioResult> {
  return goldenRequest<GoldenScenarioResult>(
    "/internal/demo/golden/reset",
    "POST",
  );
}

export async function loadCompletedGoldenScenario(): Promise<GoldenScenarioResult> {
  return goldenRequest<GoldenScenarioResult>(
    "/internal/demo/golden/load-completed",
    "POST",
  );
}

export async function resolveGoldenDemoShotId(): Promise<string> {
  const current = await getGoldenScenarioStatus();
  if (current) return current.shot_id;
  return (await resetGoldenScenario()).shot_id;
}
