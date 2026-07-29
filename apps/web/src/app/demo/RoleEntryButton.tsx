"use client";

import type { HumanRole } from "@intent-core/contracts";

import { enterDemoRole } from "./actions";
import styles from "./RoleEntryButton.module.css";

/** "Enter as ..." action for one role-entry card. Takes only the
 * serialisable `role` literal (never a callback prop) and calls the
 * imported `enterDemoRole` Server Action itself -- a Server Component
 * cannot pass a freshly-created closure into a Client Component prop
 * (React rejects it: "Event handlers cannot be passed to Client
 * Component props"), so this Client Component owns the call instead of
 * receiving one. */
export function RoleEntryButton({
  role,
  label,
}: {
  role: HumanRole;
  label: string;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        void enterDemoRole(role);
      }}
    >
      {label}
    </button>
  );
}
