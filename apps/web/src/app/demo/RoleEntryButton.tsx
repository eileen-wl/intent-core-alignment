"use client";

import type { HumanRole } from "@intent-core/contracts";

import { enterDemoRole, startGuidedDemonstration } from "./actions";
import styles from "./RoleEntryButton.module.css";

/** "Enter as ..." action for one role-entry card. Takes only the
 * serialisable `role` literal (never a callback prop) and calls the
 * imported Server Action itself -- a Server Component cannot pass a
 * freshly-created closure into a Client Component prop (React rejects
 * it: "Event handlers cannot be passed to Client Component props"), so
 * this Client Component owns the call instead of receiving one.
 *
 * `variant` is presentational only. `guided`, when true (only ever the
 * primary "Start guided demonstration" instance), calls
 * `startGuidedDemonstration` instead of `enterDemoRole` -- the one
 * place the guided path's behaviour genuinely differs (it additionally
 * resolves the real D1 Shot and redirects there, docs/step-7/16_STEP_7C0D_...md
 * §8.3), not merely a different visual weight. Every direct role-entry
 * card, and the guided CTA's own role literal, still establish the
 * exact same session-scoped Demo identity. */
export function RoleEntryButton({
  role,
  label,
  variant = "secondary",
  guided = false,
}: {
  role: HumanRole;
  label: string;
  variant?: "primary" | "secondary";
  guided?: boolean;
}) {
  return (
    <button
      type="button"
      className={variant === "primary" ? styles.primaryButton : styles.button}
      onClick={() => {
        if (guided) {
          void startGuidedDemonstration();
        } else {
          void enterDemoRole(role);
        }
      }}
    >
      {label}
    </button>
  );
}
