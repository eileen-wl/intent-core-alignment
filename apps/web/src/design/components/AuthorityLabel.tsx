import styles from "./AuthorityLabel.module.css";

/** The eleven authority labels required by
 * docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md §10. Label text is
 * fixed per variant (this is the product's authority vocabulary, not
 * free-form caller text) -- callers pass `detail` for supplementary
 * context such as a confirming role or timestamp. */
export type AuthorityLabelVariant =
  | "production-fact"
  | "human-intent"
  | "human-confirmed"
  | "ai-interpretation"
  | "ai-proposal"
  | "intent-signal"
  | "human-review-required"
  | "open-question"
  | "historical"
  | "integration-ready"
  | "read-only";

const LABEL_TEXT: Record<AuthorityLabelVariant, string> = {
  "production-fact": "Production fact",
  "human-intent": "Human intent",
  "human-confirmed": "Human-confirmed",
  "ai-interpretation": "AI interpretation",
  "ai-proposal": "AI proposal",
  "intent-signal": "Intent Signal",
  "human-review-required": "Human review required",
  "open-question": "Open question",
  historical: "Historical",
  "integration-ready": "Integration-ready",
  "read-only": "Read-only for your role",
};

/** Short marker text distinguishing each variant independent of colour.
 * Purely decorative (`aria-hidden`) -- the full label text already
 * carries the meaning for assistive technology. */
const MARKER_TEXT: Record<AuthorityLabelVariant, string> = {
  "production-fact": "FACT",
  "human-intent": "INTENT",
  "human-confirmed": "CONFIRMED",
  "ai-interpretation": "AI",
  "ai-proposal": "PROPOSAL",
  "intent-signal": "SIGNAL",
  "human-review-required": "REVIEW",
  "open-question": "OPEN",
  historical: "HISTORY",
  "integration-ready": "SYNC",
  "read-only": "READ-ONLY",
};

const TONE_CLASS: Record<AuthorityLabelVariant, string> = {
  "production-fact": styles.fact,
  "human-intent": styles.neutral,
  "human-confirmed": styles.neutralStrong,
  "ai-interpretation": styles.agent,
  "ai-proposal": styles.agent,
  "intent-signal": styles.attention,
  "human-review-required": styles.attention,
  "open-question": styles.attention,
  historical: styles.historical,
  "integration-ready": styles.fact,
  "read-only": styles.neutral,
};

const BORDER_CLASS: Record<AuthorityLabelVariant, string> = {
  "production-fact": styles.borderSolid,
  "human-intent": styles.borderSolid,
  "human-confirmed": styles.borderSolid,
  "ai-interpretation": styles.borderDashed,
  "ai-proposal": styles.borderDotted,
  "intent-signal": styles.borderSolid,
  "human-review-required": styles.borderDashed,
  "open-question": styles.borderDotted,
  historical: styles.borderDotted,
  "integration-ready": styles.borderDashed,
  "read-only": styles.borderDashed,
};

export function AuthorityLabel({
  variant,
  detail,
}: {
  variant: AuthorityLabelVariant;
  detail?: string;
}) {
  return (
    <span
      className={[
        styles.label,
        TONE_CLASS[variant],
        BORDER_CLASS[variant],
      ].join(" ")}
    >
      <span className={styles.marker} aria-hidden="true">
        {MARKER_TEXT[variant]}
      </span>
      <span className={styles.text}>{LABEL_TEXT[variant]}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </span>
  );
}
