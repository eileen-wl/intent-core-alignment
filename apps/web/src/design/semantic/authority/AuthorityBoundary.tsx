import type { ReactNode } from "react";

import styles from "./AuthorityBoundary.module.css";

export type AuthorityTone = "human" | "agent" | "attention";

const TONE_CLASS: Record<AuthorityTone, string> = {
  human: styles.human,
  agent: styles.agent,
  attention: styles.attention,
};

/** Shared shell for `HumanDecisionNotice`, `AgentAdvisoryNotice`, and
 * `ConfirmationRequiredPanel`: one consistent visual grammar (a compact
 * authority-type kicker, a prominent owner statement, then supporting
 * detail) so the three read as one family rather than three
 * disconnected cards. Dark visual-convergence pass: the previous left
 * accent bar duplicated the tone already carried by the `AuthorityLabel`
 * kicker inside it -- a decorative "side-tab" the design review flagged
 * (see `AnchorContextLayer`'s identical fix). `tone` now applies only a
 * restrained background luminance shift, never a border, and never a
 * *stronger* treatment for one tone over another -- human authority is
 * never represented by a heavier surface than Agent advisory, just a
 * different one, matching the "never green for human-confirmed, never
 * dominant for Agent" rule. */
export function AuthorityBoundary({
  tone,
  label,
  ownerLabel,
  statement,
  children,
  flush = false,
}: {
  tone: AuthorityTone;
  /** The `AuthorityLabel` instance naming the authority type. */
  label: ReactNode;
  /** e.g. "Human VFX Supervisor" */
  ownerLabel: string;
  /** e.g. "controls the Core Anchor" */
  statement: string;
  children?: ReactNode;
  /** Presentation variant, not a domain/semantic change: drops this
   * component's own surface (background/padding/radius) so it reads as
   * typography inside a parent-owned surface instead of a second nested
   * panel. For callers (like Alignment's Human Attention) that already
   * render `AuthorityBoundary` as the sole child of their own focused
   * surface -- the tone/kicker/statement/body semantics are unchanged. */
  flush?: boolean;
}) {
  return (
    <div
      className={`${styles.boundary} ${TONE_CLASS[tone]} ${flush ? styles.flush : ""}`}
    >
      <div className={styles.kicker}>{label}</div>
      <p className={styles.statement}>
        <strong className={styles.owner}>{ownerLabel}</strong> {statement}
      </p>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  );
}
