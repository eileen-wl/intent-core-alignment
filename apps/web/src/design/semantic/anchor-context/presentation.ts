import type { AnchorContextRead } from "@intent-core/contracts";

const PLACEHOLDER_DIRECTION = /^[a-z0-9]$/i;

/** Exact implementation-only generator/debug labels verified present in
 * this codebase's deterministic Agent generators (same base allowlist
 * established for VFX Alignment and CG Version Review) --
 * ICAS_DESIGN.md §25.9 prohibits exposing these in normal product UI.
 * An explicit allowlist, not a generic "strip any leading bracket"
 * pattern -- legitimate product copy that happens to start with a
 * bracket must never be silently removed. Applied here (not just on
 * one page) because `conciseDirection` is the one shared formatter
 * `AnchorContextLayer` uses for every role's direction text, so a
 * generator label leaking through it would show up wherever Anchor
 * Context renders, not only on the page where it was first noticed.
 * The two CG-D1-specific entries were verified by direct inspection
 * of persisted `execution_anchor_revisions` rows -- the D1-specific
 * generator override that produced them no longer emits a bracket
 * label in its current source form, so the label only exists in
 * already-persisted rows, not in any current source string. */
const GENERATOR_LABELS = [
  "[Cross-role deterministic]",
  "[Artist deterministic]",
  "[CG deterministic]",
  "[Core Agent draft - deterministic placeholder, review required]",
  "[Core Agent intent decomposition - deterministic placeholder, review required]",
  "[Core Agent alignment assessment - deterministic placeholder, review required]",
  "[Core Agent context reconstruction - deterministic placeholder, review required]",
  "[CG Agent execution anchor draft - deterministic placeholder, review required]",
  "[CG Agent execution anchor draft - D1 combined-intensity ceiling translation]",
  "[ICAS Demo — D1]",
] as const;

/** The Artist D1 Golden Journey's R2+ combined-intensity-boundary label
 * carries a real variable part -- the Execution Anchor revision number
 * that gated the D1-specific Artist guidance generator override (same
 * shape as the already-verified CG D1 compliance label). Verified by
 * direct inspection of a persisted `ArtistAgentGuidance` row -- the
 * current `DeterministicD1ArtistGuidanceGenerator` no longer emits a
 * bracket label in its present source form (its `executive_summary`/
 * `task_goal` overrides are plain sentences), so this label only
 * exists in already-persisted rows, not in any current source string.
 * `ArtistAgentGuidance` rows are immutable and append-only, so an
 * older row carrying this label stays real history forever. */
const ARTIST_D1_BOUNDARY_LABEL =
  /\[Artist D1 deterministic - R\d+ combined-intensity ceiling boundary\]/g;

/** Removes any verified generator label wherever it occurs in `text`
 * (a leading prefix, or embedded mid-sentence if a caller ever
 * composes one field's text into another), then normalizes the
 * resulting whitespace. Text containing no verified label is returned
 * unchanged -- this never touches genuine domain wording. Exported so
 * callers needing the stripping alone (not `conciseDirection`'s
 * additional placeholder-detection) -- e.g. `AnchorContextLayer`'s
 * "review" variant guardrail-matrix fields -- can reuse the exact
 * same verified allowlist instead of duplicating it. */
export function stripGeneratorLabel(text: string): string {
  let result = text;
  let changed = false;
  for (const label of GENERATOR_LABELS) {
    if (result.includes(label)) {
      result = result.split(label).join(" ");
      changed = true;
    }
  }
  const withoutArtistD1Boundary = result.replace(ARTIST_D1_BOUNDARY_LABEL, " ");
  if (withoutArtistD1Boundary !== result) {
    result = withoutArtistD1Boundary;
    changed = true;
  }
  return changed ? result.replace(/\s+/g, " ").trim() : result;
}

export function conciseDirection(
  value: string | null | undefined,
): string | null {
  const direction = value?.trim();
  if (!direction || PLACEHOLDER_DIRECTION.test(direction)) return null;
  return stripGeneratorLabel(direction);
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
