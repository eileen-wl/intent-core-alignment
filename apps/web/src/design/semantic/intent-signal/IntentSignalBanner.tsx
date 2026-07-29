import type { HumanRole } from "@intent-core/contracts";
import Link from "next/link";

import {
  intentSignalRoleWording,
  type IntentSignalAvailability,
} from "./intentSignalModel";
import styles from "./IntentSignalBanner.module.css";

/** Level 5 -- contextual page banner. Shows what changed, why it
 * matters, and where to go (docs/step-7/03_STEP_7A2_...md §10.4). A
 * restrained left-accent strip on a neutral surface, not a large
 * uniform amber block -- amber signals attention through a controlled
 * accent, applied only when the signal actually carries attention.
 * Never rendered when there is nothing to say; callers should simply
 * not mount this component for `no-assessment` if a banner would be
 * noisy, though it renders an honest empty message if they do. */
export function IntentSignalBanner({
  availability,
  role,
  contextLabel,
  detailHref,
}: {
  availability: IntentSignalAvailability;
  role: HumanRole;
  /** Caller-supplied context, e.g. "Shot 010 · Final confrontation". */
  contextLabel?: string;
  detailHref?: string;
}) {
  if (availability.status === "no-assessment") {
    return (
      <div className={`${styles.banner} ${styles.bannerNeutral}`}>
        <p className={styles.wordingNeutral}>No current Intent Signal</p>
        <p className={styles.explanation}>
          A successful Cross-role Assessment is required.
        </p>
      </div>
    );
  }

  if (
    availability.status === "generation-failed" ||
    availability.status === "unavailable"
  ) {
    return (
      <div className={`${styles.banner} ${styles.bannerNeutral}`}>
        <p className={styles.wordingNeutral}>Intent Signal unavailable</p>
      </div>
    );
  }

  const { signal } = availability;
  const isAttention = signal.attention_level !== "low";
  return (
    <div
      className={
        isAttention ? styles.banner : `${styles.banner} ${styles.bannerNeutral}`
      }
    >
      <div className={styles.row}>
        <p className={isAttention ? styles.wording : styles.wordingNeutral}>
          {intentSignalRoleWording(role, signal.attention_level)}
        </p>
        {contextLabel && <span className={styles.context}>{contextLabel}</span>}
      </div>
      <p className={styles.explanation}>{signal.signal_output.summary}</p>
      {detailHref && (
        <Link href={detailHref} className={styles.link}>
          Open supporting context
        </Link>
      )}
    </div>
  );
}
