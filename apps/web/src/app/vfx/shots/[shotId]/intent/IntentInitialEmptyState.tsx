import type { VfxInboxItemRead } from "@intent-core/contracts";

import type { IntentActionResult } from "@/features/vfx/intent-workspace/actions";
import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { IntentSourceContext } from "./IntentSourceContext";
import { StartDraftButton } from "./StartDraftButton";
import styles from "./IntentInitialEmptyState.module.css";

const GETTING_STARTED_STEPS = [
  "Review or generate Intent Decomposition and Context Reconstruction.",
  "Create the first Core Anchor draft.",
  "Confirm it through the Human VFX Supervisor HumanGate.",
];

/** INITIAL EMPTY (Step 7C-2 visual finalization §4): no confirmed
 * revision, no draft revision. Locked content order: About Core Anchor
 * -> Get started (three real steps, one real action) -> Source of
 * creative intent -> Downstream impact. Explanatory product copy only
 * -- `GETTING_STARTED_STEPS` narrates the real, existing three-step
 * path but only step 2 has a real action attached (`StartDraftButton`);
 * steps 1 and 3 describe work that happens on other real surfaces
 * (Evidence/Decomposition disclosures below, and the HumanGate dialog
 * once a draft exists), never a fabricated button for a control that
 * does not exist yet. */
export function IntentInitialEmptyState({
  item,
  evidenceData,
  startDraftAction,
}: {
  item: VfxInboxItemRead;
  evidenceData: IntentEvidenceData | null;
  startDraftAction: () => Promise<IntentActionResult>;
}) {
  return (
    <div className={styles.wrapper}>
      <section className={styles.about}>
        <h2 className={styles.aboutHeading}>About Core Anchor</h2>
        <p className={styles.aboutText}>
          Core Anchor establishes the shared creative intent for this Shot. It becomes authoritative
          only after a Human VFX Supervisor confirms it -- downstream CG, Artist, and review work
          aligns to whichever revision is currently confirmed.
        </p>
        <p className={styles.status}>No Core Anchor has been confirmed for this Shot yet.</p>
      </section>

      <section className={styles.gettingStarted}>
        <h2 className={styles.gettingStartedHeading}>Get started with the first Core Anchor</h2>
        <ol className={styles.steps}>
          {GETTING_STARTED_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <StartDraftButton
          label="Start a Core Anchor"
          pendingLabel="Starting…"
          action={startDraftAction}
        />
      </section>

      <section className={styles.source}>
        <IntentSourceContext item={item} evidenceData={evidenceData} />
      </section>

      <section className={styles.impact}>
        <h2 className={styles.impactHeading}>Downstream impact</h2>
        <p className={styles.impactText}>
          Once confirmed, this Core Anchor will inform CG interpretation, execution constraints,
          Artist guidance, and Version and Alignment review for this Shot.
        </p>
      </section>
    </div>
  );
}
