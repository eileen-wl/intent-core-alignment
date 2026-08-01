import type { VfxInboxItemRead } from "@intent-core/contracts";

import type { IntentActionResult } from "@/features/vfx/intent-workspace/actions";
import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { IntentSourceContext } from "./IntentSourceContext";
import { StartDraftButton } from "./StartDraftButton";
import styles from "./IntentInitialEmptyState.module.css";

const PRIMARY_PATH = [
  {
    title: "Review available Shot context",
    description:
      "Check the Project, Task, Production Version, and any linked source material.",
  },
  {
    title: "Create the first Core Anchor draft",
    description:
      "Capture the shared creative direction, boundaries, and open questions.",
  },
  {
    title: "Confirm with the VFX Supervisor",
    description:
      "Human confirmation makes the revision active for downstream work.",
  },
];

const DOWNSTREAM_IMPACT = [
  "CG interpretation and execution boundaries",
  "Artist guidance",
  "Version and Alignment review",
];

/** INITIAL EMPTY: no confirmed revision and no draft revision.
 *
 * The reference-led layout makes creation the dominant task while preserving
 * the shared ICAS shell, tokens, typography, and compact supporting context.
 * Intent Decomposition and Context Reconstruction remain optional Agent
 * support rather than a mandatory first step. */
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
      <section className={styles.hero} aria-labelledby="initial-empty-title">
        <div className={styles.visual} aria-hidden="true">
          <div className={styles.visualMark}>
            <svg viewBox="0 0 96 96">
              <rect x="24" y="18" width="48" height="60" rx="8" />
              <path d="M34 34h28M34 45h28M34 56h18" />
              <circle cx="64" cy="64" r="12" />
              <path d="M64 58v12M58 64h12" />
            </svg>
          </div>
          <span className={styles.visualLabel}>Shared creative intent</span>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroHeading}>
            <h2 id="initial-empty-title" className={styles.title}>
              No Core Anchor yet
            </h2>
            <p className={styles.description}>
              This Shot does not yet have a confirmed shared creative intent.
              Create the first draft to establish what downstream work should
              align to.
            </p>
          </div>

          <ol
            className={styles.primaryPath}
            aria-label="How the first Core Anchor becomes active"
          >
            {PRIMARY_PATH.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <div>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <StartDraftButton
            label="Create first Core Anchor draft"
            pendingLabel="Creating draft…"
            action={startDraftAction}
            variant="primary"
          />
          <p className={styles.actionHint}>
            Saving a draft does not make it active. A VFX Supervisor confirms it
            later.
          </p>
        </div>
      </section>

      <div className={styles.supportGrid}>
        <section className={`${styles.supportCard} ${styles.sourceCard}`}>
          <IntentSourceContext
            item={item}
            evidenceData={evidenceData}
            compact
          />
        </section>

        <div className={styles.supportStack}>
          <section className={styles.supportCard}>
            <div className={styles.supportHeadingRow}>
              <span className={styles.supportIcon} aria-hidden="true">
                AI
              </span>
              <h2 className={styles.supportHeading}>Optional Agent support</h2>
            </div>
            <p className={styles.supportText}>
              Intent Decomposition and Context Reconstruction can help structure
              the available context. Agent output remains advisory until human
              confirmation.
            </p>
          </section>

          <section className={styles.supportCard}>
            <div className={styles.supportHeadingRow}>
              <span className={styles.supportIcon} aria-hidden="true">
                →
              </span>
              <h2 className={styles.supportHeading}>After confirmation</h2>
            </div>
            <p className={styles.supportText}>
              The active Core Anchor will guide:
            </p>
            <ul className={styles.impactList}>
              {DOWNSTREAM_IMPACT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
