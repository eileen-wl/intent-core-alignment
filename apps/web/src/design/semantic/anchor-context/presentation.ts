import type { AnchorContextRead } from "@intent-core/contracts";

const PLACEHOLDER_DIRECTION = /^[a-z0-9]$/i;

export function conciseDirection(
  value: string | null | undefined,
): string | null {
  const direction = value?.trim();
  if (!direction || PLACEHOLDER_DIRECTION.test(direction)) return null;
  return direction;
}

export function upstreamState(context: AnchorContextRead): string | null {
  if (context.role === "vfx_supervisor") return null;

  if (context.core_anchor.lifecycle_state !== "confirmed") {
    return "VFX Core Anchor confirmation is required.";
  }
  if (
    context.core_anchor.newer_draft_exists ||
    context.core_anchor.pending_human_gate_exists
  ) {
    return "VFX review pending for the newer Core Anchor draft.";
  }

  if (
    context.role === "artist" &&
    (!context.execution_anchor ||
      context.execution_anchor.lifecycle_state !== "confirmed" ||
      context.execution_anchor.context_state !== "current")
  ) {
    return "CG clarification is required for the Execution direction.";
  }

  return null;
}
