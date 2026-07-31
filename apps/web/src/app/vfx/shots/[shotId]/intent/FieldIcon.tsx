import type { ReactNode } from "react";

type IconField =
  | "core_summary"
  | "shot_objective"
  | "emotional_tone"
  | "visual_focus"
  | "rhythm_intensity"
  | "character_relationship"
  | "narrative_priority"
  | "constraints"
  | "variation_zones"
  | "drift_risks"
  | "open_questions"
  | "references";

/** Small, restrained per-field marker (Step 7C-2 visual finalization
 * §3: "meaningful icons only where they improve scanning") -- a dense
 * field-by-field comparison is exactly the case where a consistent
 * glyph per row measurably speeds up scanning, matching the approved
 * `04_intent_draft_comparison` reference. Purely decorative
 * (`aria-hidden`); the field's own text label already carries the
 * meaning. Intent-scoped, not a shared design-system icon set. */
export function FieldIcon({ field }: { field: IconField }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICON_PATHS[field]}
    </svg>
  );
}

const ICON_PATHS: Record<IconField, ReactNode> = {
  core_summary: (
    <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Zm8 0V7h3.5M8 12h8M8 15.5h8M8 8.5h4" />
  ),
  shot_objective: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  emotional_tone: (
    <path d="M12 20s-7-4.35-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.65-9.5 9-9.5 9Z" />
  ),
  visual_focus: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  rhythm_intensity: <path d="M3 12h3l2-6 4 12 2-6 2 3h5" />,
  character_relationship: (
    <>
      <circle cx="8.5" cy="8" r="2.75" />
      <circle cx="16" cy="9.5" r="2.25" />
      <path d="M3 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13.5 15.5c2.3.2 4 1.7 4 3.5" />
    </>
  ),
  narrative_priority: <path d="M6 3v18M6 4h11l-2.5 3.5L17 11H6" />,
  constraints: (
    <>
      <rect x="5" y="10.5" width="14" height="9" rx="1.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  variation_zones: (
    <>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" />
    </>
  ),
  drift_risks: (
    <>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  open_questions: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 2" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  references: <path d="M9 12a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1M15 12a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5l1-1" />,
};
