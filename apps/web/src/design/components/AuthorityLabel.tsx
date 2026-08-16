import styles from "./AuthorityLabel.module.css";

/** The eleven authority labels required by
 * docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md §10, plus
 * `human-authority` (CG Version Review's local Human-owned-region
 * label -- "Human intent" specifically names Core Anchor/creative
 * intent, which does not fit a technical Execution Review response;
 * additive only, every one of the original eleven is unchanged, so
 * every existing consumer including VFX Alignment is unaffected).
 * Label text is fixed per variant (this is the product's authority
 * vocabulary, not free-form caller text) -- callers pass `detail` for
 * supplementary context such as a confirming role or timestamp. */
export type AuthorityLabelVariant =
  | "production-fact"
  | "human-intent"
  | "human-authority"
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
  "human-authority": "Human authority",
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

const TONE_CLASS: Record<AuthorityLabelVariant, string> = {
  "production-fact": styles.fact,
  "human-intent": styles.neutral,
  "human-authority": styles.neutral,
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
  "human-authority": styles.borderSolid,
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

/** Step 9B-1 owner-validation correction: renders exactly one concise
 * badge (no separate abbreviated marker duplicating the same wording --
 * the earlier "CONFIRMED Human-confirmed" layout read as a duplicated
 * label). Optional `detail` (provenance, e.g. "Confirmed by VFX
 * Supervisor") renders on its own line below the badge and wraps
 * naturally -- never forced onto the same row or clipped by a fixed
 * height. */
export function AuthorityLabel({
  variant,
  detail,
}: {
  variant: AuthorityLabelVariant;
  detail?: string;
}) {
  return (
    <span className={styles.wrapper}>
      <span
        className={[
          styles.label,
          TONE_CLASS[variant],
          BORDER_CLASS[variant],
        ].join(" ")}
      >
        {LABEL_TEXT[variant]}
      </span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </span>
  );
}
