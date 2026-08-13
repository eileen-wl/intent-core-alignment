import type { ReactNode } from "react";

import styles from "./Icon.module.css";

/** ICAS Visual Language v1 §4/§5: a small, restrained, monoline icon
 * set for object/authority/signal identity. Extends the existing
 * inline-SVG convention already established in this codebase (see
 * `apps/web/src/app/vfx/shots/[shotId]/intent/FieldIcon.tsx` --
 * `viewBox 0 0 24 24`, `stroke: currentColor`, `aria-hidden`) rather
 * than installing a new icon dependency: no npm icon library exists in
 * `apps/web` (`package.json` has none), and Visual Language v1 §4.1
 * requires reusing an existing reusable icon system where one already
 * fits, not inventing a large new SVG set. Bounded to exactly the
 * icons this document's semantic mapping calls for -- not a general
 * icon library. */
export type IconName =
  // Level A semantic region icons (§7.1)
  | "review" // Version Review region -- Scan/Inspect/Search-check
  | "evidence" // Production Evidence region -- File-search
  | "agent" // CG Agent Review region -- Radar/ScanSearch advisory
  | "human" // Human Authority region -- UserCheck
  // Object icons (§5)
  | "version" // Production Version -- Layers/Stack
  | "review-note" // Review Note -- Message-square-text
  | "core-anchor" // Core Anchor / Intent -- Target/Focus/Crosshair
  | "execution-anchor" // Execution Anchor -- Sliders/Constraint
  | "history" // History region -- History/Clock/Timeline
  // Signal strip micro glyphs (§8.4/§8.5)
  | "technical" // Wrench
  | "coordination" // Network/Git-branch (also Cross-role tension)
  | "requirements" // Clipboard-check
  | "question" // Circle-help (also Open question)
  | "evidence-gap" // Search-x
  | "risk" // Local-optimum risk -- Triangle-alert
  // Action icons (§11)
  | "regenerate" // refresh/rotate
  | "escalate"; // arrow-up

export type IconSize = "micro" | "standard" | "region";

const SIZE_CLASS: Record<IconSize, string> = {
  micro: styles.micro,
  standard: styles.standard,
  region: styles.region,
};

const ICON_PATHS: Record<IconName, ReactNode> = {
  review: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.2 15.2 4.3 4.3" />
      <path d="M7.5 10.5 9.5 12.5 13 8.5" />
    </>
  ),
  evidence: (
    <>
      <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
      <circle cx="10.5" cy="14.5" r="2.4" />
      <path d="m13.1 17.1 1.6 1.6" />
    </>
  ),
  agent: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 12 16.8 7.2" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  human: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c.5-4 3-6.5 6.5-6.5s6 2.5 6.5 6.5" />
      <path d="m16 14.5 2 2 3.5-4" />
    </>
  ),
  version: (
    <>
      <path d="m12 3 8 4.5-8 4.5-8-4.5Z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </>
  ),
  "review-note": (
    <>
      <path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z" />
      <path d="M7.5 9.5h9M7.5 13h6" />
    </>
  ),
  "core-anchor": (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  "execution-anchor": (
    <>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="9" cy="6.5" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="7" cy="17.5" r="2" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.5 2" />
    </>
  ),
  technical: (
    <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L4 16.5V20h3.5l5.3-5.3a4 4 0 0 0 4.9-5.4l-2.9 2.9-2-2Z" />
  ),
  coordination: (
    <>
      <circle cx="6" cy="6" r="2.1" />
      <circle cx="6" cy="18" r="2.1" />
      <circle cx="18" cy="12" r="2.1" />
      <path d="M6 8.1v7.8M8 6.7l8 3.3M8 17.3l8-3.3" />
    </>
  ),
  requirements: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" />
      <path d="m8.5 12 1.8 1.8L13.5 10.5M8.5 16.5h7" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.2 1-1.2 2" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  "evidence-gap": (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.2 15.2 4.3 4.3" />
      <path d="m8.3 8.3 4.4 4.4M12.7 8.3l-4.4 4.4" />
    </>
  ),
  risk: (
    <>
      <path d="M12 3.5 22 20H2Z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  regenerate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
    </>
  ),
  escalate: (
    <>
      <path d="M12 19V6" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
};

/** A single restrained monoline icon (`currentColor`, `aria-hidden`).
 * Purely reinforces visible text -- never the sole carrier of meaning
 * (§16). Consumers pair it with a real label; this component never
 * renders standalone interactive content. */
export function Icon({
  name,
  size = "standard",
}: {
  name: IconName;
  size?: IconSize;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${styles.icon} ${SIZE_CLASS[size]}`}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
