import type { AgentRunRead } from "@intent-core/contracts";

import { AuthorityLabel } from "../../components/AuthorityLabel";
import { MetadataRow } from "../../components/MetadataRow";
import { AuthorityBoundary } from "./AuthorityBoundary";

type AdvisoryVariant = "ai-interpretation" | "ai-proposal";

const OWNER_LABEL: Record<string, string> = {
  core_agent: "Core Agent",
  vfx_supervisor_agent: "VFX Supervisor Agent",
  cg_supervisor_agent: "CG Supervisor Agent",
  artist_agent: "Artist Agent",
  cross_department: "Cross-department Agent",
};

/** Agent output is advisory only -- never automatically applied. Uses
 * the same `AuthorityBoundary` shell as `HumanDecisionNotice` (owner
 * statement + metadata), with the "agent" tone: a violet accent that
 * stays visibly distinct without becoming the visually dominant
 * element on the page. Grounded in `AgentRunRead` -- `agent_type`,
 * `capability`, `provider`, `created_at`/`started_at` (caller supplies
 * the one relevant to their context). */
export function AgentAdvisoryNotice({
  variant = "ai-interpretation",
  agentType,
  capability,
  provider,
  generatedAt,
}: {
  variant?: AdvisoryVariant;
  agentType: AgentRunRead["agent_type"];
  capability: string;
  provider: string;
  generatedAt: string;
}) {
  return (
    <AuthorityBoundary
      tone="agent"
      label={<AuthorityLabel variant={variant} />}
      ownerLabel={OWNER_LABEL[agentType] ?? agentType}
      statement={`produced this ${variant === "ai-proposal" ? "proposal" : "interpretation"} -- advisory only, not automatically applied.`}
    >
      <MetadataRow
        items={[
          { label: "Capability", value: capability },
          { label: "Provider", value: provider },
          { label: "Generated", value: generatedAt },
        ]}
      />
    </AuthorityBoundary>
  );
}
