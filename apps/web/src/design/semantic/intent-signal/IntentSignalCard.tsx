import type { HumanRole } from "@intent-core/contracts";
import Link from "next/link";

import { AuthorityLabel } from "../../components/AuthorityLabel";
import { Card } from "../../layout/Card";
import {
  intentSignalRoleWording,
  type IntentSignalAvailability,
} from "./intentSignalModel";
import styles from "./IntentSignalCard.module.css";

/** Level 3 -- role-homepage card. Leads with the conclusion (the role
 * wording), then why, then the object/context it relates to, then the
 * next step -- the "Intent Signal" category marker is a quiet footer
 * detail, not a headline competing with the conclusion. Honest for
 * every `IntentSignalAvailability` state; a missing or failed
 * assessment is never replaced with optimistic placeholder content. */
export function IntentSignalCard({
  availability,
  role,
  contextLabel,
  detailHref,
  detailLabel = "Open supporting context",
}: {
  availability: IntentSignalAvailability;
  role: HumanRole;
  /** Caller-supplied object/context, e.g. "Shot 010 · Final confrontation". */
  contextLabel?: string;
  /** Optional -- when provided, renders a link to the supporting
   * context. No route is assumed or hardcoded here. */
  detailHref?: string;
  detailLabel?: string;
}) {
  if (availability.status === "no-assessment") {
    return (
      <Card className={styles.card}>
        <p className={styles.title}>No current Intent Signal</p>
        <p className={styles.description}>
          A successful Cross-role Assessment is required.
        </p>
      </Card>
    );
  }

  if (availability.status === "generation-failed") {
    return (
      <Card className={styles.card}>
        <p className={styles.title}>Intent Signal unavailable</p>
        <p className={styles.description}>
          The latest Cross-role Assessment attempt failed. A previous result, if
          one exists, remains available separately.
        </p>
      </Card>
    );
  }

  if (availability.status === "unavailable") {
    return (
      <Card className={styles.card}>
        <p className={styles.title}>Intent Signal unavailable</p>
      </Card>
    );
  }

  const { signal } = availability;
  const attention = signal.attention_level !== "low";

  return (
    <Card
      className={
        attention ? `${styles.card} ${styles.cardAttention}` : styles.card
      }
    >
      <p className={styles.title}>
        {intentSignalRoleWording(role, signal.attention_level)}
      </p>
      <p className={styles.description}>{signal.signal_output.summary}</p>
      {contextLabel && <p className={styles.context}>{contextLabel}</p>}
      <div className={styles.footer}>
        <AuthorityLabel variant="intent-signal" />
        {detailHref && (
          <Link href={detailHref} className={styles.link}>
            {detailLabel}
          </Link>
        )}
      </div>
    </Card>
  );
}
