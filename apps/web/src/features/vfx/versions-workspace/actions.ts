"use server";

import type { VersionMediaRead } from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { VfxApiError, fetchVersionMedia } from "@/features/vfx/api";

/** Step 9B-4: the one read-only Server Action the VFX Versions Workspace
 * uses to resolve transient ftrack media for the currently-selected
 * Version (client-side selection, `VersionsWorkspacePage.tsx`) --
 * mirrors `features/vfx/intent-workspace/actions.ts`'s identity-
 * resolution pattern exactly, but performs no mutation and calls no
 * `revalidatePath` (there is nothing to invalidate). Identity is
 * resolved server-side on every call; the Client never supplies a role
 * or actor id. */

export type VersionMediaFetchResult =
  { ok: true; media: VersionMediaRead } | { ok: false; message: string };

const FORBIDDEN_MESSAGE =
  "Media context is only available to a VFX Supervisor session.";
const UNAVAILABLE_MESSAGE = "The ICAS service is unavailable.";
const NOT_FOUND_MESSAGE =
  "This Production Version could not be found in this Shot.";

export async function resolveVersionMediaAction(
  shotId: string,
  versionId: string,
): Promise<VersionMediaFetchResult> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "vfx_supervisor") {
    return { ok: false, message: FORBIDDEN_MESSAGE };
  }

  try {
    const media = await fetchVersionMedia(
      shotId,
      versionId,
      actorHeaders(identity),
    );
    if (media === null) {
      return { ok: false, message: NOT_FOUND_MESSAGE };
    }
    return { ok: true, media };
  } catch (error) {
    if (error instanceof VfxApiError) {
      if (error.status === 403)
        return { ok: false, message: FORBIDDEN_MESSAGE };
      if (error.status === 0)
        return { ok: false, message: UNAVAILABLE_MESSAGE };
      return { ok: false, message: error.detail || UNAVAILABLE_MESSAGE };
    }
    return { ok: false, message: UNAVAILABLE_MESSAGE };
  }
}
