import type { ReactNode } from "react";

import styles from "./AuthorityBoundary.module.css";

export type AuthorityTone = "human" | "agent" | "attention";

const TONE_CLASS: Record<AuthorityTone, string> = {
  human: styles.human,
  agent: styles.agent,
  attention: styles.attention,
};

/** Shared shell for `HumanDecisionNotice`, `AgentAdvisoryNotice`, and
 * `ConfirmationRequiredPanel`: one consistent visual grammar (a left
 * accent bar carrying the tone, a compact authority-type kicker, a
 * prominent owner statement, then supporting detail) so the three read
 * as one family rather than three disconnected cards. `tone` only ever
 * changes the accent bar colour -- human authority is never
 * represented by a *stronger* colour than Agent advisory, just a
 * different one, matching the "never green for human-confirmed, never
 * dominant for Agent" rule. */
export function AuthorityBoundary({
  tone,
  label,
  ownerLabel,
  statement,
  children,
}: {
  tone: AuthorityTone;
  /** The `AuthorityLabel` instance naming the authority type. */
  label: ReactNode;
  /** e.g. "Human VFX Supervisor" */
  ownerLabel: string;
  /** e.g. "controls the Core Anchor" */
  statement: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${styles.boundary} ${TONE_CLASS[tone]}`}>
      <div className={styles.kicker}>{label}</div>
      <p className={styles.statement}>
        <strong className={styles.owner}>{ownerLabel}</strong> {statement}
      </p>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
