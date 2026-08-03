import type {
  AgentRunRead,
  ContextSnapshotRead,
} from "@intent-core/contracts";
import type { ReactNode } from "react";

import { AgentRunReference } from "../evidence/AgentRunReference";
import { ContextSnapshotReference } from "../evidence/ContextSnapshotReference";
import { EvidenceProvenanceDrawer } from "../evidence/EvidenceProvenanceDrawer";
import type { EvidenceReferenceLike } from "../evidence/evidenceModel";
import styles from "./AgentContributionPanel.module.css";

export type AgentCapabilityState =
  | "not_ready"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "stale"
  | "superseded";

const stateLabel: Record<AgentCapabilityState, string> = {
  not_ready: "Not ready",
  ready: "Ready",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  stale: "Stale",
  superseded: "Superseded",
};

export function AgentContributionPanel({
  agent,
  capability,
  state,
  generatedAt,
  inputs,
  output,
  authority,
  nextAction,
  run,
  snapshot,
  evidence = [],
  readiness,
}: {
  agent: string;
  capability: string;
  state: AgentCapabilityState;
  generatedAt?: string | null;
  inputs: string[];
  output: ReactNode;
  authority: ReactNode;
  nextAction: ReactNode;
  run?: AgentRunRead | null;
  snapshot?: ContextSnapshotRead | null;
  evidence?: EvidenceReferenceLike[];
  readiness?: { label: string; available: boolean }[];
}) {
  return (
    <section className={styles.panel} aria-label={`${agent} ${capability}`}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{agent}</p>
          <h3 className={styles.title}>{capability}</h3>
        </div>
        <span className={`${styles.state} ${styles[`state_${state}`]}`}>
          {stateLabel[state]}
        </span>
      </header>
      {generatedAt && (
        <p className={styles.generated}>Generated {generatedAt}</p>
      )}
      <div className={styles.section}>
        <h4>Inputs</h4>
        {inputs.length ? (
          <ul className={styles.list}>
            {inputs.map((input) => <li key={input}>{input}</li>)}
          </ul>
        ) : (
          <p className={styles.muted}>No recorded inputs.</p>
        )}
      </div>
      {readiness && (
        <div className={styles.readiness}>
          <h4>Prerequisites</h4>
          <ul className={styles.list}>
            {readiness.map((item) => (
              <li key={item.label} className={item.available ? styles.available : styles.missing}>
                <span aria-hidden="true">{item.available ? "✓" : "○"}</span> {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.section}>
        <h4>Agent contribution</h4>
        {output}
      </div>
      <div className={styles.section}>
        <h4>Human authority</h4>
        <p>{authority}</p>
      </div>
      <div className={styles.nextAction}>
        <h4>Next human action</h4>
        {nextAction}
      </div>
      {(run || snapshot || evidence.length > 0) && (
        <EvidenceProvenanceDrawer evidence={evidence} run={run ?? null} snapshot={snapshot ?? null} />
      )}
      {!run && !snapshot && evidence.length === 0 && state !== "not_ready" && (
        <details className={styles.provenance}>
          <summary>Provenance</summary>
          <p className={styles.muted}>Detailed Agent provenance is unavailable for this output.</p>
          {run === null && <AgentRunReference run={null} />}
          {snapshot === null && <ContextSnapshotReference snapshot={null} />}
        </details>
      )}
    </section>
  );
}
