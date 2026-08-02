import type { HumanRole } from "@intent-core/contracts";

import { ROLE_LABEL } from "./demoIdentity";

/** Step 9B-2 owner-validation correction: normalises a persisted
 * human-role enum value (`"cg_supervisor"`, or a stray mixed-case
 * variant such as `"Cg_supervisor"`) into the existing `ROLE_LABEL`
 * display text (`"CG Supervisor"`). Reused everywhere a role enum
 * would otherwise render raw in visible provenance (Step 9B-2's shared
 * decision provenance, VFX Intent, Artist Feedback History). Never
 * alters the persisted value itself -- purely a display formatter.
 * Falls back to the raw value when it does not match a known
 * `HumanRole` -- an honest fallback, never a fabricated label. */
export function humanRoleLabel(role: string | null | undefined): string {
  if (!role) {
    return "Unknown";
  }
  const normalized = role.toLowerCase() as HumanRole;
  if (normalized in ROLE_LABEL) {
    return ROLE_LABEL[normalized];
  }
  return role;
}
