/** Server-only generic development seed resolver (Step 7C-1). Calls the
 * backend's idempotent ensure-or-resolve capability and returns the
 * real, persisted rich Shot id -- never a hardcoded UUID. Exactly one
 * server-side call site: `enterDemoRole` (`app/demo/actions.ts`);
 * Client Components never see the raw id. The same backend call also
 * folds in a second, normal, deliberately-uninitialized Shot (see
 * `apps/api/.../demo_seed/d1_scenario.py`), so Core Anchor lifecycle
 * states 1 (INITIAL EMPTY) and 2 (FIRST DRAFT) remain reachable through
 * the normal product journey without any special entry path. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

interface D1ScenarioResult {
  project_id: string;
  shot_id: string;
  task_id: string;
  version_id: string;
  uninitialized_shot_id: string;
}

/** Thrown when the seed data cannot be ensured/resolved -- API
 * unreachable, or a non-2xx response. `enterDemoRole` treats this as
 * best-effort and does not block entry to the workspace on failure. */
export class DemoScenarioUnavailableError extends Error {
  constructor() {
    super("The ICAS service is unavailable.");
    this.name = "DemoScenarioUnavailableError";
  }
}

export async function resolveD1DemoShotId(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/internal/demo/ensure-d1-scenario`, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    throw new DemoScenarioUnavailableError();
  }
  if (!response.ok) {
    throw new DemoScenarioUnavailableError();
  }
  const result = (await response.json()) as D1ScenarioResult;
  return result.shot_id;
}
