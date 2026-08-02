import type { ExecutionAnchorRevisionRead } from "@intent-core/contracts";

import {
  AppShell,
  Breadcrumbs,
  ContextTabs,
  ErrorState,
  EvidenceLayerSection,
  MetadataRow,
} from "@/design";
import { DEMO_IDENTITY_NAME, ROLE_LABEL } from "@/lib/demoIdentity";
import { decisionProvenanceItems } from "@/lib/decisionProvenance";
import { ROLE_SIDEBAR_ITEMS } from "@/lib/roleNavigation";
import type { ExecutionWorkspaceData } from "@/features/cg/execution-workspace/data";
import { TaskContextHeader } from "../TaskContextHeader";
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
  unavailable,
  onExitRole,
}: {
  taskId: string;
  data: ExecutionWorkspaceData | null;
  unavailable: boolean;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <AppShell
      name={DEMO_IDENTITY_NAME.cg_supervisor}
      role={ROLE_LABEL.cg_supervisor}
      onExitRole={onExitRole}
      sidebarItems={ROLE_SIDEBAR_ITEMS.cg_supervisor}
      currentPath="/cg/tasks"
    >
      {unavailable || data === null ? (
        <>
          <Breadcrumbs
            items={[
              { label: "Tasks", href: "/cg/tasks" },
              { label: "Execution" },
            ]}
          />
          <ErrorState
            title={
              unavailable
                ? "This Task is unavailable"
                : "This Task could not be found"
            }
            description={
              unavailable
                ? "The ICAS service could not be reached. Try refreshing the page."
                : "This Task does not exist, or its identifier is invalid."
            }
          />
        </>
      ) : (
        <>
          <Breadcrumbs
            items={[
              { label: data.item.project_name, href: "/cg/tasks" },
              { label: data.item.shot_name },
              { label: data.item.task_name },
              { label: "Execution" },
            ]}
          />
          <TaskContextHeader item={data.item} />
          <ContextTabs
            activeTabId="execution"
            tabs={[
              {
                id: "overview",
                label: "Overview",
                href: `/cg/tasks/${taskId}`,
              },
              {
                id: "execution",
                label: "Execution",
                href: `/cg/tasks/${taskId}/execution`,
              },
              {
                id: "version-review",
                label: "Version Review",
                href: `/cg/tasks/${taskId}/version-review`,
              },
              {
                id: "dependencies",
                label: "Dependencies",
                href: `/cg/tasks/${taskId}/dependencies`,
              },
              {
                id: "activity",
                label: "Activity",
                href: `/cg/tasks/${taskId}/activity`,
              },
            ]}
          />

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

          {data.confirmedRevision && (
            <EvidenceLayerSection kind="human-decision">
              <MetadataRow
                items={
                  data.confirmDecision
                    ? decisionProvenanceItems(data.confirmDecision)
                    : [
                        {
                          label: "Confirmed by",
                          value:
                            data.confirmedRevision.confirmed_by_human_role ??
                            "Unknown",
                        },
                        {
                          label: "Confirmed at",
                          value: data.confirmedRevision.confirmed_at
                            ? new Date(
                                data.confirmedRevision.confirmed_at,
                              ).toLocaleString()
                            : "Unknown",
                        },
                      ]
                }
              />
            </EvidenceLayerSection>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionHeading}>
              {data.draftRevision
                ? "Draft Execution Anchor"
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
    </AppShell>
  );
}
