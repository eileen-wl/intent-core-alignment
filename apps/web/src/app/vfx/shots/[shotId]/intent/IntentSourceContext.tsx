import type { VfxInboxItemRead } from "@intent-core/contracts";

import type { IntentEvidenceData } from "@/features/vfx/intent-workspace/data";
import { taskDisplayText, versionDisplayText } from "../../../vfxWording";
import styles from "./IntentSourceContext.module.css";

/** Read-only "Source of creative intent" panel (Step 7C-2 visual
 * finalization §4.C/§5) -- shared by INITIAL EMPTY (a compact section)
 * and FIRST DRAFT (the comparison's left column). Built entirely from
 * data the page already loaded: `item` (Shot/Task/Version context, the
 * same facts `ProductionContextHeader` shows) and `evidenceData`
 * (Intent Decomposition/Context Reconstruction summaries, Shot-scoped
 * and already fetched whenever a draft or confirmed revision exists).
 * `evidenceData` is honestly `null` only for a Shot with neither --
 * this panel never fabricates a summary to fill that gap, it states the
 * gap. No Intent Brief fetch exists in the current read model, so none
 * is shown here; the decomposition's own `core_intent_summary` is the
 * closest real source-of-intent text available. */
export function IntentSourceContext({
  item,
  evidenceData,
  compact = false,
  firstDraft = false,
}: {
  item: VfxInboxItemRead;
  evidenceData: IntentEvidenceData | null;
  compact?: boolean;
  firstDraft?: boolean;
}) {
  const hasDecompositions = (evidenceData?.decompositions.length ?? 0) > 0;
  const hasReconstructions = (evidenceData?.reconstructions.length ?? 0) > 0;
  const evidenceCount = evidenceData?.evidence.length ?? 0;

  if (firstDraft) {
    return (
      <div className={`${styles.panel} ${styles.firstDraftPanel}`}>
        <div className={styles.firstDraftHeadingGroup}>
          <h2 className={styles.heading}>Source and supporting context</h2>
          <p className={styles.firstDraftIntro}>What I&apos;m using to write this draft</p>
        </div>

        <details className={styles.sourceDisclosure} open>
          <summary>
            <span className={styles.sourceSummaryTitle}>Brief, notes &amp; source evidence</span>
            <span className={styles.sourceCount}>{evidenceCount}</span>
          </summary>
          <div className={styles.sourceDisclosureBody}>
            <p>
              Project, Shot, Task and Production Version context, plus any linked supporting
              material.
            </p>
            <dl className={styles.shotContext}>
              <div className={styles.contextRow}>
                <dt>Project</dt>
                <dd>{item.project_name}</dd>
              </div>
              <div className={styles.contextRow}>
                <dt>Task</dt>
                <dd>{taskDisplayText(item)}</dd>
              </div>
              <div className={styles.contextRow}>
                <dt>Production Version</dt>
                <dd>{versionDisplayText(item)}</dd>
              </div>
            </dl>
            {evidenceCount === 0 && (
              <p className={styles.empty}>No supporting evidence is linked to this draft yet.</p>
            )}
          </div>
        </details>

        <details className={styles.sourceDisclosure} open={hasDecompositions}>
          <summary>
            <span className={styles.sourceSummaryTitle}>Intent Decomposition</span>
            <span className={styles.sourceCount}>{evidenceData?.decompositions.length ?? 0}</span>
          </summary>
          <div className={styles.sourceDisclosureBody}>
            {hasDecompositions ? (
              <ul className={styles.sourceList}>
                {evidenceData?.decompositions.map((decomposition) => (
                  <li key={decomposition.id}>{decomposition.core_intent_summary}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No Intent Decomposition has been generated yet.</p>
            )}
          </div>
        </details>

        <details className={styles.sourceDisclosure} open={hasReconstructions}>
          <summary>
            <span className={styles.sourceSummaryTitle}>Context Reconstruction</span>
            <span className={styles.sourceCount}>{evidenceData?.reconstructions.length ?? 0}</span>
          </summary>
          <div className={styles.sourceDisclosureBody}>
            {hasReconstructions ? (
              <ul className={styles.sourceList}>
                {evidenceData?.reconstructions.map((reconstruction) => (
                  <li key={reconstruction.id}>
                    {reconstruction.reconstructed_context.context_summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No Context Reconstruction has been generated yet.</p>
            )}
          </div>
        </details>

        <div className={styles.shotDetails}>
          <h3>Shot details</h3>
          <dl className={styles.shotContext}>
            <div className={styles.contextRow}>
              <dt>Project</dt>
              <dd>{item.project_name}</dd>
            </div>
            <div className={styles.contextRow}>
              <dt>Shot</dt>
              <dd>{item.shot_name}</dd>
            </div>
            <div className={styles.contextRow}>
              <dt>Task</dt>
              <dd>{taskDisplayText(item)}</dd>
            </div>
            <div className={styles.contextRow}>
              <dt>Production Version</dt>
              <dd>{versionDisplayText(item)}</dd>
            </div>
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <h2 className={styles.heading}>Source of creative intent</h2>

      <dl className={styles.shotContext}>
        <div className={styles.contextRow}>
          <dt>Project</dt>
          <dd>{item.project_name}</dd>
        </div>
        <div className={styles.contextRow}>
          <dt>Task</dt>
          <dd>{taskDisplayText(item)}</dd>
        </div>
        <div className={styles.contextRow}>
          <dt>Version</dt>
          <dd>{versionDisplayText(item)}</dd>
        </div>
      </dl>

      {evidenceData === null ? (
        <p className={styles.empty}>
          No creative-intent source or supporting evidence is linked to this Shot yet. You can still create the first draft from the available Shot context.
        </p>
      ) : (
        <div className={styles.sources}>
          {hasDecompositions && (
            <div className={styles.sourceBlock}>
              <h3 className={styles.sourceLabel}>Intent Decomposition</h3>
              <ul className={styles.sourceList}>
                {evidenceData.decompositions.map((decomposition) => (
                  <li key={decomposition.id}>{decomposition.core_intent_summary}</li>
                ))}
              </ul>
            </div>
          )}
          {hasReconstructions && (
            <div className={styles.sourceBlock}>
              <h3 className={styles.sourceLabel}>Context Reconstruction</h3>
              <ul className={styles.sourceList}>
                {evidenceData.reconstructions.map((reconstruction) => (
                  <li key={reconstruction.id}>
                    {reconstruction.reconstructed_context.context_summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasDecompositions && !hasReconstructions && (
            <p className={styles.empty}>
              No Intent Decomposition or Context Reconstruction has been generated for this Shot yet.
            </p>
          )}
          <p className={styles.evidenceCount}>
            {evidenceCount} evidence {evidenceCount === 1 ? "source" : "sources"} -- see Evidence and
            provenance below.
          </p>
        </div>
      )}
    </div>
  );
}
