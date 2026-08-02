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

/** One line of a role's Working Direction summary. Every non-`unavailable`
 * item must be traceable to a real object (`sourceType`/`sourceId`) --
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
  authority: WorkingDirectionAuthority;
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
