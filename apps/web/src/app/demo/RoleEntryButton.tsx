"use client";

import type { HumanRole } from "@intent-core/contracts";

import { enterDemoRole } from "./actions";
import styles from "./RoleEntryButton.module.css";

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m14 8 4 4-4 4" />
    </svg>
  );
}

/** Role-selection Home entry action (Step 7C-1). The existing
 * `enterDemoRole` Server Action remains the only place that establishes
 * the trusted role session and performs the redirect into that role's
 * workspace -- this Client Component only ever forwards the plain,
 * serialisable `role` literal to it. */
export function RoleEntryButton({ role, label }: { role: HumanRole; label: string }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        void enterDemoRole(role);
      }}
    >
      <span>{label}</span>
      <ArrowIcon />
    </button>
  );
}
