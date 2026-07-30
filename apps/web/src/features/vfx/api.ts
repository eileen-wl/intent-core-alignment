import type { VfxInboxItemRead, VfxInboxRead } from "@intent-core/contracts";

/** Server-only API boundary for the new VFX role workspace (Step 7C-1;
 * docs/step-7/16_STEP_7C0D_...md §17, `7C-1` scope item 6). Distinct
 * from `apps/web/src/lib/api.ts` (the legacy browser-side client for
 * `/shots`, preserved unchanged) -- this module is never imported by a
 * Client Component. Uses the plain, non-`NEXT_PUBLIC_`-prefixed
 * `API_BASE_URL` convention already established by
 * `apps/web/src/lib/api-client.ts`'s server-side `fetchShots`. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";

/** Honest typed error -- mirrors `lib/api.ts`'s `ApiError` shape so a
 * future consolidation is easy, but kept local since this module must
 * not depend on the browser-facing client. */
export class VfxApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`VFX API error ${status}: ${detail}`);
    this.name = "VfxApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      body &&
      typeof body === "object" &&
      "detail" in body &&
      typeof (body as { detail: unknown }).detail === "string"
    ) {
      return (body as { detail: string }).detail;
    }
  } catch {
    // Response body was not JSON -- fall through to the status text.
  }
  return response.statusText || "Unknown error";
}

async function vfxFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...init,
    });
  } catch {
    throw new VfxApiError(0, "The ICAS service is unavailable.");
  }
  if (!response.ok) {
    throw new VfxApiError(response.status, await parseErrorDetail(response));
  }
  return (await response.json()) as T;
}

/** `GET /vfx/inbox` -- the full Alignment Inbox, real Shots only,
 * honest empty `items` array when none exist. */
export async function fetchVfxInbox(): Promise<VfxInboxRead> {
  return vfxFetch<VfxInboxRead>("/vfx/inbox");
}

/** `GET /vfx/inbox/{shot_id}` -- one Shot's derived Inbox row, reusing
 * the exact same backend Current-focus derivation the Inbox itself
 * uses (docs/step-7/16_STEP_7C0D_...md §16's "smallest honest
 * architecture": the Shot Overview never re-derives Current focus in
 * TypeScript). Returns `null` on a real 404 (Shot not found) --
 * distinguished from a thrown `VfxApiError` for any other failure, so
 * callers can render "not found" and "unavailable" differently. */
export async function fetchVfxInboxItem(shotId: string): Promise<VfxInboxItemRead | null> {
  try {
    return await vfxFetch<VfxInboxItemRead>(`/vfx/inbox/${shotId}`);
  } catch (error) {
    if (error instanceof VfxApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
