"use server";

import { revalidatePath } from "next/cache";
import type { CrossRoleAssessmentRead } from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import { VfxApiError, generateCrossRoleAssessment } from "@/features/vfx/api";

/** Server-authoritative Cross-role Assessment generation for the VFX
 * Alignment Workspace (Step 7C-3 completion pass). Mirrors
 * `intent-workspace/actions.ts`'s Server Action shape: resolve Demo
 * identity server-side, verify VFX Supervisor role, call the real
 * `POST /intent/versions/{version_id}/cross-role-assessments/generate`
 * endpoint, then revalidate so the persisted result is what renders --
 * never a fabricated result held only in client state. */

export type AlignmentActionErrorKind = "forbidden" | "not_found" | "conflict" | "validation" | "network";

export interface AlignmentActionError {
  kind: AlignmentActionErrorKind;
  message: string;
}

export type GenerateAssessmentResult =
  | { ok: true; assessment: CrossRoleAssessmentRead }
  | { ok: false; error: AlignmentActionError };

const FORBIDDEN_ERROR: AlignmentActionError = {
  kind: "forbidden",
  message: "Generating a Cross-role Assessment is owned by the VFX Supervisor.",
};

function mapThrownError(error: unknown): AlignmentActionError {
  if (error instanceof VfxApiError) {
    if (error.status === 403) return FORBIDDEN_ERROR;
    if (error.status === 404) return { kind: "not_found", message: error.detail || "Not found." };
    if (error.status === 409) {
      return {
        kind: "conflict",
        message: "This was already acted on elsewhere -- reload to see the current state.",
      };
    }
    if (error.status === 0) {
      return { kind: "network", message: "The ICAS service is unavailable." };
    }
    return { kind: "validation", message: error.detail || "Something went wrong. Please try again." };
  }
  return { kind: "network", message: "Something went wrong. Please try again." };
}

/** Generates a Cross-role Assessment for the Shot's currently paired
 * Version + Task -- the real pairing `vfx_inbox`'s Current-focus
 * derivation already used to decide `assessment_generation_available`
 * fired, never a value chosen client-side. */
export async function generateAssessmentAction(
  shotId: string,
  versionId: string,
  taskId: string,
): Promise<GenerateAssessmentResult> {
  const identity = await resolveIdentity();
  if (identity === null || identity.role !== "vfx_supervisor") {
    return { ok: false, error: FORBIDDEN_ERROR };
  }

  try {
    const assessment = await generateCrossRoleAssessment(
      versionId,
      { task_id: taskId },
      actorHeaders(identity),
    );
    revalidatePath(`/vfx/shots/${shotId}/alignment`);
    revalidatePath(`/vfx/shots/${shotId}`);
    revalidatePath("/vfx");
    return { ok: true, assessment };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}
