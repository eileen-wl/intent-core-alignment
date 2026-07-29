import type { HumanRole } from "@intent-core/contracts";

import { PermissionState } from "../../components/PermissionState";
import { ROLE_LABEL } from "@/lib/demoIdentity";

/** Read-only Anchor authority (e.g. an Artist viewing the Core or
 * Execution Anchor). Reuses the 7B-1 `PermissionState` -- a boundary,
 * not an error -- rather than a second read-only pattern. */
export function ReadOnlyAuthorityNotice({
  ownerRole,
  objectLabel,
}: {
  /** The role that actually controls the object, e.g. "vfx_supervisor". */
  ownerRole: HumanRole;
  /** e.g. "Core Anchor" */
  objectLabel: string;
}) {
  return (
    <PermissionState
      description={`Human ${ROLE_LABEL[ownerRole]} controls the ${objectLabel}.`}
    />
  );
}
