"use server";

import { revalidatePath } from "next/cache";
import type { ArtistAgentGuidanceRead } from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { ArtistApiError, generateArtistGuidance } from "@/features/artist/api";

/** Server-authoritative Artist mutations for the Artist Task Workspace
 * (Step 7C-5) -- mirrors `features/cg/actions.ts`'s pattern exactly:
 * resolve Demo identity server-side, verify Artist role, call FastAPI
 * with trusted X-Actor-Role/X-Actor-Id headers, revalidate the smallest
 * affected routes. The Client never supplies `actorId`, `role`, or a
 * trusted identity. */

export type ArtistActionErrorKind =
  "forbidden" | "not_found" | "conflict" | "validation" | "network";

export interface ArtistActionError {
  kind: ArtistActionErrorKind;
  message: string;
}

export type ArtistGuidanceActionResult =
  | { ok: true; guidance: ArtistAgentGuidanceRead }
  | { ok: false; error: ArtistActionError };

const FORBIDDEN_ERROR: ArtistActionError = {
  kind: "forbidden",
  message: "This action is owned by the Artist.",
};

function mapThrownError(error: unknown): ArtistActionError {
  if (error instanceof ArtistApiError) {
    if (error.status === 403) return FORBIDDEN_ERROR;
    if (error.status === 404)
      return { kind: "not_found", message: error.detail || "Not found." };
    if (error.status === 409) {
      return {
        kind: "conflict",
        message:
          error.detail ||
          "This was already acted on elsewhere -- reload to see the current state.",
      };
    }
    if (error.status === 0) {
      return { kind: "network", message: "The ICAS service is unavailable." };
    }
    if (error.status === 502) {
      return {
        kind: "network",
        message:
          error.detail || "Guidance generation failed. Please try again.",
      };
    }
    return {
      kind: "validation",
      message: error.detail || "Something went wrong. Please try again.",
    };
  }
  return {
    kind: "network",
    message: "Something went wrong. Please try again.",
  };
}

async function requireArtistIdentity(): Promise<
  | { role: "artist"; actorId: string; displayName: string }
  | { error: ArtistActionError }
> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "artist") {
    return { error: FORBIDDEN_ERROR };
  }
  return {
    role: "artist",
    actorId: identity.actorId,
    displayName: identity.displayName,
  };
}

function revalidateTaskRoutes(taskId: string): void {
  revalidatePath(`/artist/tasks/${taskId}`);
  revalidatePath(`/artist/tasks/${taskId}/current-version`);
  revalidatePath(`/artist/tasks/${taskId}/feedback-history`);
  revalidatePath("/artist");
  revalidatePath("/artist/inbox");
}

/** Generates (or regenerates, when prior guidance is outdated) real
 * Artist Agent guidance for one Version -- the same real call either
 * way, since ArtistAgentGuidance rows are immutable and append-only. */
export async function generateArtistGuidanceAction(
  taskId: string,
  versionId: string,
): Promise<ArtistGuidanceActionResult> {
  const identity = await requireArtistIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const guidance = await generateArtistGuidance(
      versionId,
      { task_id: taskId },
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId);
    return { ok: true, guidance };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}
