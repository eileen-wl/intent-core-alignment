import type {
  AnchorContextRead,
  ExecutionAnchorRevisionRead,
} from "@intent-core/contracts";

import { AgentContributionPanel, EvidenceLayerSection, MetadataRow } from "@/design";
import {
  decisionOutcomeStatement,
  decisionProvenanceItems,
} from "@/lib/decisionProvenance";
import { humanRoleLabel } from "@/lib/humanRoleLabel";
import type { ExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { CgTaskWorkspaceFrame } from "../CgTaskWorkspaceFrame";
import { ExecutionAnchorEditor } from "./ExecutionAnchorEditor";
import styles from "./ExecutionPage.module.css";

function contentFieldRows(
  revision: ExecutionAnchorRevisionRead,
): { key: string; label: string; value: string }[] {
  return [
    {
      key: "technical_boundaries",
      label: "Technical boundaries",
      value: revision.technical_boundaries,
    },
    {
      key: "parameter_ranges",
      label: "Parameter ranges",
      value: revision.parameter_ranges,
    },
    {
      key: "delivery_conditions",
      label: "Delivery conditions",
      value: revision.delivery_conditions,
    },
    {
      key: "production_ready_criteria",
      label: "Production-ready criteria",
      value: revision.production_ready_criteria,
    },
    {
      key: "downstream_dependencies",
      label: "Downstream dependencies",
      value: revision.downstream_dependencies,
    },
    {
      key: "publish_requirements",
      label: "Publish requirements",
      value: revision.publish_requirements,
    },
    {
      key: "allowed_refinements",
      label: "Allowed refinements",
      value: revision.allowed_refinements,
    },
    {
      key: "escalation_conditions",
      label: "Escalation conditions",
      value: revision.escalation_conditions,
    },
  ].map((row) => ({ ...row, value: row.value || "Not recorded" }));
}

/** `/cg/tasks/:taskId/execution` -- the real Execution Anchor workspace
 * (Step 7C-4). Distinguishes active Core Anchor (read-only creative
 * authority) from Execution Anchor (CG-owned operational
 * interpretation), and renders only the real lifecycle states the
 * domain supports: no Execution Anchor, draft, confirmed, confirmed
 * plus newer draft. */
export function ExecutionPage({
  taskId,
  data,
  anchorContext,
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: ExecutionWorkspaceData | null;
  anchorContext?: AnchorContextRead | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <CgTaskWorkspaceFrame
      item={data?.item ?? null}
      anchorContext={anchorContext}
      activeTab="execution"
      unavailable={unavailable}
      onExitRole={onExitRole}
    >
      {data && (
        <>
          <EvidenceLayerSection kind="production-evidence">
            <section className={styles.section}>
              <h3 className={styles.sectionHeading}>
                Active Core Anchor (read-only)
              </h3>
              <p className={styles.contextText}>
                {data.coreAnchorConfirmed
                  ? "A confirmed Core Anchor exists for this Task's Shot."
                  : "No Core Anchor is confirmed for this Shot yet."}
              </p>
            </section>

            {data.confirmedRevision && (
              <section className={styles.section}>
                <h3 className={styles.sectionHeading}>
                  Confirmed Execution Anchor (Revision{" "}
                  {data.confirmedRevision.revision_number})
                </h3>
                <dl className={styles.readOnlyFields}>
                  {contentFieldRows(data.confirmedRevision).map(
                    ({ key, label, value }) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </section>
            )}
          </EvidenceLayerSection>

          <AgentContributionPanel
            agent="CG Supervisor Agent"
            capability="Execution Anchor Draft"
            state={data.draftRevision ? "completed" : data.coreAnchorConfirmed ? "ready" : "not_ready"}
            generatedAt={data.draftRevision?.created_at}
            inputs={["Confirmed Core Anchor", `${data.item.task_name} task context`]}
            readiness={[{ label: "Confirmed Core Anchor", available: data.coreAnchorConfirmed }]}
            output={
              data.draftRevision ? (
                <>
                  <p>Agent-proposed technical translation is available in the editable Draft below.</p>
                  <p>Technical boundaries: {data.draftRevision.technical_boundaries || "Not recorded"}</p>
                </>
              ) : <p>No Agent Execution Anchor proposal is available yet.</p>
            }
            authority="Advisory only; the human CG Supervisor edits and confirms the Execution Anchor through the Human Gate."
            nextAction={
              data.coreAnchorConfirmed
                ? "Use the proposal, edit the Draft, then submit it through the Human Gate."
                : "Open the VFX Intent route and confirm the Core Anchor first."
            }
          />

          {data.confirmedRevision && (
            <EvidenceLayerSection kind="human-decision">
              {data.confirmDecision ? (
                <>
                  <p className={styles.contextText}>
                    {decisionOutcomeStatement(
                      data.confirmDecision,
                      data.confirmedRevision.revision_number,
                    )}
                  </p>
                  <MetadataRow
                    items={decisionProvenanceItems(data.confirmDecision)}
                  />
                </>
              ) : (
                // Owner-validation correction: no real Decision record
                // was found for this confirmed revision -- state the
                // revision's own recorded confirmation fields honestly
                // rather than inferring a Decision outcome that was
                // never actually loaded.
                <MetadataRow
                  items={[
                    {
                      label: "Confirmed by",
                      value: humanRoleLabel(
                        data.confirmedRevision.confirmed_by_human_role,
                      ),
                    },
                    {
                      label: "Confirmed at",
                      value: data.confirmedRevision.confirmed_at
                        ? new Date(
                            data.confirmedRevision.confirmed_at,
                          ).toLocaleString()
                        : "Unknown",
                    },
                  ]}
                />
              )}
              {data.confirmedRevision.supersedes_revision_id && (
                <p className={styles.contextText}>
                  Supersedes a previous Execution Anchor revision.
                </p>
              )}
            </EvidenceLayerSection>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionHeading}>
              {data.draftRevision
                ? "Draft Execution Anchor"
                : data.confirmedRevision
                  ? "Revise Execution Anchor"
                  : "Start Execution Anchor"}
            </h3>
            <ExecutionAnchorEditor
              taskId={taskId}
              draftRevision={data.draftRevision}
              draftHumanGateId={
                data.draftRevision
                  ? (data.item.pending_human_gate_id ?? null)
                  : null
              }
              coreAnchorConfirmed={data.coreAnchorConfirmed}
              hasConfirmedRevision={data.confirmedRevision !== null}
            />
          </section>
        </>
      )}
    </CgTaskWorkspaceFrame>
  );
}
