/** Server-only D1 Demo scenario resolver (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §2-§3.4, docs/step-7/15_STEP_7C0C_...md
 * §7.1/§8.3). Calls the backend's idempotent ensure-or-resolve
 * capability and returns the real, persisted D1 Shot id -- never a
 * hardcoded UUID. Exactly one server-side call site: the guided-demo
 * Server Action (`app/demo/actions.ts`); Client Components never see
 * the raw id except as the already-resolved `/vfx/shots/:shotId`
 * redirect target. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

interface D1ScenarioResult {
  project_id: string;
  shot_id: string;
  task_id: string;
  version_id: string;
}

/** Thrown when the D1 scenario cannot be ensured/resolved -- API
 * unreachable, or a non-2xx response. The guided-demo Server Action
 * catches this and redirects back to `/demo` with an inline, honest
 * error rather than redirecting into a broken Shot page (locked
 * failure behaviour, docs/step-7/15_STEP_7C0C_...md §4.7). */
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

interface D1GuidedScenarioResult {
  project_id: string;
  shot_id: string;
  task_id: string;
  version_id: string;
}

/** Step 7C-2: the guided-walkthrough counterpart to `resolveD1DemoShotId`
 * -- ensures/resolves the separate, always-INITIAL-EMPTY guided D1 Shot
 * (never the fully-seeded rich Shot `resolveD1DemoShotId` resolves) and
 * returns its real, persisted id. Same failure contract: throws
 * `DemoScenarioUnavailableError` on an unreachable API or non-2xx
 * response, for the guided-demo Server Action to catch. */
export async function resolveD1GuidedDemoShotId(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/internal/demo/ensure-d1-guided-scenario`, {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    throw new DemoScenarioUnavailableError();
  }
  if (!response.ok) {
    throw new DemoScenarioUnavailableError();
  }
  const result = (await response.json()) as D1GuidedScenarioResult;
  return result.shot_id;
}
