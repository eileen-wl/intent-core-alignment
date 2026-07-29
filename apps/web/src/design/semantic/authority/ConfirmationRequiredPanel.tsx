import type { HumanGateRead, HumanRole } from "@intent-core/contracts";

import { AuthorityLabel } from "../../components/AuthorityLabel";
import { MetadataRow } from "../../components/MetadataRow";
import { ROLE_LABEL } from "@/lib/demoIdentity";
import { AuthorityBoundary } from "./AuthorityBoundary";

const GATE_TYPE_LABEL: Record<HumanGateRead["gate_type"], string> = {
  core_anchor_confirmation: "Core Anchor confirmation",
  execution_anchor_confirmation: "Execution Anchor confirmation",
};

/** A pending `HumanGateRead` -- display only. Deliberately has no
 * Confirm/Reject/Apply action of any kind (HumanGate interactions are
 * out of scope for this batch); it exists to make "this is waiting on
 * a specific human" visible wherever a gate is referenced. Uses the
 * "attention" tone -- amber, the same accent reserved for genuine
 * attention elsewhere in the product, not a separate ad-hoc colour. */
export function ConfirmationRequiredPanel({
  gateType,
  requiredRole,
  openedAt,
}: {
  gateType: HumanGateRead["gate_type"];
  requiredRole: HumanRole;
  openedAt: string;
}) {
  return (
    <AuthorityBoundary
      tone="attention"
      label={<AuthorityLabel variant="human-review-required" />}
      ownerLabel={`Human ${ROLE_LABEL[requiredRole]}`}
      statement="has not yet confirmed this."
    >
      <MetadataRow
        items={[
          { label: "Gate", value: GATE_TYPE_LABEL[gateType] },
          { label: "Opened", value: openedAt },
        ]}
      />
    </AuthorityBoundary>
  );
}
