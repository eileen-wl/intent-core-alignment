// Typed API client boundary for client-rendered pages (e.g. the Shot
// Anchor page). Runs in the browser, unlike lib/api-client.ts's
// `fetchShots` (a Server Component fetch) -- so the base URL must come
// from a `NEXT_PUBLIC_`-prefixed env var to survive into the client
// bundle; a plain `API_BASE_URL` read here would be `undefined` at
// runtime. No `.env.local` is introduced (matches the existing web
// convention): override via a one-off shell export if ever needed, same
// as documented for `API_BASE_URL`.
import type {
  AnchorConfirmRequest,
  AnchorRejectRequest,
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  HumanRole,
  IntentBriefRead,
  ShotRead,
  TaskRead,
} from "@intent-core/contracts";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface Actor {
  role: HumanRole;
  actorId: string;
}

/** Thrown for any non-2xx response, and for network failures (status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) {
        // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
        return detail
          .map((entry) =>
            entry && typeof entry === "object" && "msg" in entry
              ? String((entry as { msg: unknown }).msg)
              : JSON.stringify(entry),
          )
          .join("; ");
      }
    }
    return response.statusText;
  } catch {
    return response.statusText;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  actor?: Actor;
}

async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.actor) {
    headers["X-Actor-Role"] = options.actor.role;
    headers["X-Actor-Id"] = options.actor.actorId;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Could not reach the API server");
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorDetail(response));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Converts a 404 into `null` -- for reads where "does not exist yet" is a
 * legitimate empty state, not an error (e.g. a shot with no CoreAnchor
 * yet). Any other failure still propagates as `ApiError`. */
async function fetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function getShot(shotId: string): Promise<ShotRead> {
  return apiFetch(`/shots/${shotId}`);
}

export function listTasks(): Promise<TaskRead[]> {
  return apiFetch("/tasks");
}

export function listBriefsForShot(shotId: string): Promise<IntentBriefRead[]> {
  return apiFetch(`/intent/shots/${shotId}/briefs`);
}

export function getCoreAnchor(shotId: string): Promise<CoreAnchorRead | null> {
  return fetchOrNull(`/intent/shots/${shotId}/core-anchor`);
}

export function generateCoreAnchorDraft(
  shotId: string,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/shots/${shotId}/core-anchor/generate`, {
    method: "POST",
  });
}

export function listCoreAnchorRevisions(
  shotId: string,
): Promise<CoreAnchorRevisionRead[]> {
  return apiFetch(`/intent/shots/${shotId}/core-anchor/revisions`);
}

export function updateCoreAnchorRevision(
  revisionId: string,
  changes: CoreAnchorRevisionUpdate,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}`, {
    method: "PATCH",
    body: changes,
    actor,
  });
}

export function confirmCoreAnchorRevision(
  revisionId: string,
  payload: AnchorConfirmRequest,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}/confirm`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function rejectCoreAnchorRevision(
  revisionId: string,
  payload: AnchorRejectRequest,
  actor: Actor,
): Promise<CoreAnchorRevisionRead> {
  return apiFetch(`/intent/core-anchor-revisions/${revisionId}/reject`, {
    method: "POST",
    body: payload,
    actor,
  });
}

export function getExecutionAnchor(
  taskId: string,
): Promise<ExecutionAnchorRead | null> {
  return fetchOrNull(`/intent/tasks/${taskId}/execution-anchor`);
}

export function getExecutionAnchorRevision(
  revisionId: string,
): Promise<ExecutionAnchorRevisionRead> {
  return apiFetch(`/intent/execution-anchor-revisions/${revisionId}`);
}
