import type { AnchorContextSummaryRead } from "@intent-core/contracts";

import styles from "./AnchorContextSummary.module.css";

function revisionLabel(revision: number | null): string {
  return revision === null ? "not confirmed" : `R${revision}`;
}

function stateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

/** Compact Anchor-first facts for multi-object rows. */
export function AnchorContextSummary({
  context,
}: {
  context?: AnchorContextSummaryRead | null;
}) {
  if (!context) {
    return (
      <span className={styles.unavailable}>Anchor context unavailable</span>
    );
  }

  const direction = context.execution_direction ?? context.core_direction;

  return (
    <span className={styles.summary}>
      <span className={styles.group}>
        <span className={styles.label}>Anchor</span>
        <strong>
          Core Anchor {revisionLabel(context.core_anchor_revision_number)} ·{" "}
          {stateLabel(context.core_anchor_state)}
        </strong>
        {context.execution_context_state && (
          <span>
            Execution Anchor{" "}
            {revisionLabel(context.execution_anchor_revision_number)} ·{" "}
            {stateLabel(context.execution_context_state)}
          </span>
        )}
      </span>
      <span className={styles.group}>
        <span className={styles.label}>Direction</span>
        <span>{direction ?? "No confirmed direction is available yet."}</span>
      </span>
      <span className={styles.group}>
        <span className={styles.label}>Attention / state</span>
        <strong>
          {stateLabel(context.attention_level)} ·{" "}
          {stateLabel(context.readiness_state)}
        </strong>
        <span>{context.readiness_detail}</span>
      </span>
      <span className={styles.group}>
        <span className={styles.label}>Next</span>
        <strong>{context.next_action.title}</strong>
      </span>
    </span>
  );
}
