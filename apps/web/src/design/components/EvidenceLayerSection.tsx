import type { ReactNode } from "react";

import { SectionHeader } from "./SectionHeader";
import styles from "./EvidenceLayerSection.module.css";

/** Step 9B-2: the three explanatory layers every priority page groups
 * its existing content into. Presentation categories only -- never a
 * new persisted domain state (`docs/step-9/04_STEP_9B2_...md` §3). */
export type EvidenceLayerKind =
  "production-evidence" | "agent-interpretation" | "human-decision";

const LAYER_TITLE: Record<EvidenceLayerKind, string> = {
  "production-evidence": "Production Evidence",
  "agent-interpretation": "Agent Interpretation",
  "human-decision": "Human Decision and Provenance",
};

const LAYER_QUESTION: Record<EvidenceLayerKind, string> = {
  "production-evidence": "What actually happened or is currently recorded?",
  "agent-interpretation": "What does the Agent infer from that evidence?",
  "human-decision": "What did an authorised person decide, and why?",
};

/** Step 9B-2: the one shared structural wrapper for a Production
 * Evidence / Agent Interpretation / Human Decision and Provenance
 * group. A thin heading + content wrapper, not a data model -- each
 * page keeps its own existing content and rendering (`MetadataRow`,
 * `AuthorityLabel`, finding lists, note lists, ...) as `children`, only
 * grouped under a consistent, findable heading. `className` lets a
 * caller keep an existing layout class (e.g. a CSS Grid item) on the
 * section itself, so this never has to restructure an already-tested
 * grid. `data-evidence-layer` makes the three layers distinguishable in
 * the DOM, not merely by colour, per the task's own test requirement.
 *
 * `compact`: for a layer whose content is permanently, unconditionally
 * a single "nothing recorded here" note -- never a real, populated
 * layer -- drops the explanatory description subtitle and tightens the
 * surrounding spacing, so an always-empty layer doesn't carry the same
 * visual weight as a layer with real content. The layer itself, its
 * heading, and its own note text are never hidden: this only changes
 * how much space they claim, never whether the Production Facts /
 * Agent Interpretation / Human Decision separation stays visible. */
export function EvidenceLayerSection({
  kind,
  actions,
  className,
  headingLevel = 2,
  compact = false,
  children,
}: {
  kind: EvidenceLayerKind;
  actions?: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={[styles.layer, className].filter(Boolean).join(" ")}
      data-evidence-layer={kind}
      data-compact={compact || undefined}
    >
      <SectionHeader
        title={LAYER_TITLE[kind]}
        description={compact ? undefined : LAYER_QUESTION[kind]}
        actions={actions}
        level={headingLevel}
      />
      <div className={styles.content}>{children}</div>
    </section>
  );
}
