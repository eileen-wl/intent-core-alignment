"use server";

import { revalidatePath } from "next/cache";
import type {
  ArtistAgentGuidanceRead,
  VersionRead,
} from "@intent-core/contracts";

import { actorHeaders, resolveIdentity } from "@/features/session/identity";
import {
  ArtistApiError,
  createVersion,
  generateArtistGuidance,
  getCoreAnchor,
  getExecutionAnchor,
  getTask,
  listCoreAnchorRevisions,
  listExecutionAnchorRevisions,
  listVersionsForShot,
} from "@/features/artist/api";

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

export type PublishResolvedVersionActionResult =
  { ok: true; version: VersionRead } | { ok: false; error: ArtistActionError };

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

const NOT_READY_ERROR: ArtistActionError = {
  kind: "conflict",
  message:
    "This Task's confirmed Execution Anchor is not yet current, or a resolved " +
    "Version already exists for it.",
};

/** "Publish next Version from Execution Anchor R{n}" -- the real,
 * generic `POST /versions` domain action (docs/ROLE_PERMISSIONS.md:
 * "Submit a Version", all three human roles), explicitly Artist-
 * triggered here per the locked J3 -> J4 role flow. Independently
 * re-derives readiness and content server-side from real reads --
 * never trusts client-supplied name/description/version_number --
 * exactly mirroring `generateArtistGuidanceAction`'s own re-derive-
 * don't-trust-the-client discipline. Creates exactly one new Version,
 * scoped to this Task via `task_id`; never touches the prior R1-era
 * Version, and never auto-creates Guidance, CG Review, VFX Review, or
 * an Assessment -- those remain their own separate, explicit actions. */
export async function publishResolvedVersionAction(
  taskId: string,
): Promise<PublishResolvedVersionActionResult> {
  const identity = await requireArtistIdentity();
  if ("error" in identity) return { ok: false, error: identity.error };

  try {
    const task = await getTask(taskId);
    if (task === null) {
      return {
        ok: false,
        error: { kind: "not_found", message: "Task not found." },
      };
    }

    const [coreAnchor, executionAnchor] = await Promise.all([
      getCoreAnchor(task.shot_id),
      getExecutionAnchor(taskId),
    ]);
    if (
      coreAnchor === null ||
      coreAnchor.active_revision_id === null ||
      executionAnchor === null ||
      executionAnchor.active_revision_id === null
    ) {
      return { ok: false, error: NOT_READY_ERROR };
    }

    const [coreRevisions, executionRevisions, shotVersions] = await Promise.all(
      [
        listCoreAnchorRevisions(task.shot_id),
        listExecutionAnchorRevisions(taskId),
        listVersionsForShot(task.shot_id),
      ],
    );
    const coreAnchorRevision =
      coreRevisions.find(
        (revision) => revision.id === coreAnchor.active_revision_id,
      ) ?? null;
    const executionAnchorRevision =
      executionRevisions.find(
        (revision) => revision.id === executionAnchor.active_revision_id,
      ) ?? null;
    if (coreAnchorRevision === null || executionAnchorRevision === null) {
      return { ok: false, error: NOT_READY_ERROR };
    }
    if (
      executionAnchorRevision.status !== "confirmed" ||
      executionAnchorRevision.core_anchor_revision_id !== coreAnchorRevision.id
    ) {
      return { ok: false, error: NOT_READY_ERROR };
    }
    const maxPublishedVersionNumberForTask = Math.max(
      0,
      ...shotVersions
        .filter((version) => version.task_id === taskId)
        .map((version) => version.version_number ?? 0),
    );
    if (
      executionAnchorRevision.revision_number <=
      maxPublishedVersionNumberForTask
    ) {
      return { ok: false, error: NOT_READY_ERROR };
    }

    const departmentLabel = task.department
      ? task.department.charAt(0).toUpperCase() + task.department.slice(1)
      : task.name;
    const revisionNumber = executionAnchorRevision.revision_number;
    const boundaryText =
      executionAnchorRevision.allowed_refinements ||
      executionAnchorRevision.technical_boundaries ||
      "";

    const version = await createVersion(
      {
        shot_id: task.shot_id,
        task_id: taskId,
        name: `${departmentLabel} Resolved V${revisionNumber}`,
        version_number: revisionNumber,
        description:
          `${departmentLabel} resolved version responding to the confirmed ` +
          `Execution Anchor R${revisionNumber}.` +
          (boundaryText ? ` ${boundaryText}` : ""),
      },
      actorHeaders(identity),
    );
    revalidateTaskRoutes(taskId);
    return { ok: true, version };
  } catch (error) {
    return { ok: false, error: mapThrownError(error) };
  }
}
