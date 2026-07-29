import type { HumanRole } from "@intent-core/contracts";

import { AuthorityLabel } from "../../components/AuthorityLabel";
import { MetadataRow } from "../../components/MetadataRow";
import { ROLE_LABEL } from "@/lib/demoIdentity";
import { AuthorityBoundary } from "./AuthorityBoundary";

/** A human-confirmed record -- grounded in the `confirmed_by_human_role`
 * / `confirmed_at` / rationale shape shared by `CoreAnchorRevisionRead`,
 * `ExecutionAnchorRevisionRead`, and `DecisionRead`. Visibly distinct
 * from `AgentAdvisoryNotice`: the neutral "human" tone, never the
 * violet Agent accent, and never a *stronger* colour than Agent
 * advisory -- just a different, equally-restrained one. */
export function HumanDecisionNotice({
  objectLabel,
  confirmingRole,
  confirmedAt,
  rationale,
}: {
  /** e.g. "Core Anchor revision 3" */
  objectLabel: string;
  confirmingRole: HumanRole;
  confirmedAt: string;
  rationale?: string | null;
}) {
  return (
    <AuthorityBoundary
      tone="human"
      label={<AuthorityLabel variant="human-confirmed" />}
      ownerLabel={`Human ${ROLE_LABEL[confirmingRole]}`}
      statement={`confirmed ${objectLabel}.`}
    >
      <MetadataRow
        items={[
          { label: "Confirmed by", value: ROLE_LABEL[confirmingRole] },
          { label: "Confirmed at", value: confirmedAt },
        ]}
      />
      {rationale && <p>{rationale}</p>}
    </AuthorityBoundary>
  );
}
