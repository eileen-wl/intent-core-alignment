import type { AuthorityLabelVariant } from "@/design";

/** Step 9B-1: the four information classes Working Direction is allowed
 * to express, reusing the existing `AuthorityLabel` vocabulary exactly
 * (`docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md` §10) -- never a
 * new persisted domain state, only a display category over data that
 * already carries this distinction (`created_by_actor_kind`,
 * `Decision.actor_human_role`, etc.). `"human-confirmed"` = confirmed
 * human direction (an Anchor once confirmed, a Decision); `"production-
 * fact"` = a real recorded production object (Version, ReviewNote,
 * Dependency); `"ai-interpretation"` = advisory Agent output (Assessment,
 * Guidance, Intent Signal, a draft Anchor); `"human-review-required"` =
 * a pending action derived from `current_focus`/open Dependency/Gate. */
export type WorkingDirectionAuthority = Extract<
  AuthorityLabelVariant,
  | "human-confirmed"
  | "production-fact"
  | "ai-interpretation"
  | "human-review-required"
>;

/** One line of a role's Working Direction summary. Every item with a
 * real backing object is traceable to it (`sourceType`/`sourceId`) --
 * `sourceId` exists for traceability and tests only and must never be
 * rendered as visible raw-UUID text (Step 9B-1 §2/§6). `href` is always
 * an existing, already-locked route -- this module never invents a new
 * one. */
export interface WorkingDirectionItem {
  /** Stable, human-readable key for tests and React keys -- never a UUID. */
  id: string;
  label: string;
  /** Concise summary text, or an honest fallback string when the source
   * object is absent -- never generic motivational copy. */
  value: string;
  /** Owner-validation correction (Step 9B-1): **omitted, never
   * `"human-confirmed"`, whenever the item's `value` is a fallback
   * string for an absent object** -- e.g. "No confirmed Core Anchor
   * yet." is a current production/system state, not confirmed human
   * direction, and must render with no authority badge at all rather
   * than a misleading one. Every selector must set this only when a
   * real backing object (a confirmed revision, a real Note, a real
   * Guidance row, etc.) actually exists. */
  authority?: WorkingDirectionAuthority;
  /** The real object type this line was derived from, e.g.
   * `"core_anchor_revision"`, `"version"`, `"cross_role_assessment"`,
   * `"current_focus"` -- for tests/traceability, not rendered as body
   * text. */
  sourceType: string;
  /** The real object id this line was derived from, when one exists
   * (absent for a derived/fallback line with no single backing row) --
   * never rendered in the visible summary. */
  sourceId?: string;
  /** ISO timestamp of the source object, when one exists. */
  timestamp?: string;
  /** Short, human-readable provenance detail shown next to the
   * authority badge, e.g. "Confirmed by VFX Supervisor",
   * "From latest Production Version". */
  detail?: string;
  /** Navigation destination -- always one of the existing locked routes
   * for the current role; omitted when a line has nothing to link to. */
  href?: string;
}

export interface WorkingDirectionSection {
  title: string;
  items: WorkingDirectionItem[];
}

/** Owner-validation correction (Step 9B-1): a deterministic,
 * character-count excerpt for long free-text source content (a
 * ReviewNote's content, an Intent Signal summary) -- never an LLM
 * summary, and never a change in meaning, only length. The full text
 * always remains reachable via the item's existing `href` to the real
 * source page, so nothing is hidden, only shortened for the card. Cuts
 * on a word boundary so it never splits mid-word. */
export function excerptText(text: string, maxLength = 140): string {
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed}…`;
}
