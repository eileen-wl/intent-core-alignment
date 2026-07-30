"use client";

import type { HumanRole } from "@intent-core/contracts";

import { enterDemoRole, startGuidedDemonstration } from "./actions";
import styles from "./RoleEntryButton.module.css";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8.25 5.5 9 6.5-9 6.5v-13Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13" />
      <path d="m14 8 4 4-4 4" />
    </svg>
  );
}

/** Demo-entry action. The existing Server Actions remain the only place that
 * establishes the trusted Demo role and performs redirects. */
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
      {variant === "primary" && <PlayIcon />}
      <span>{label}</span>
      {variant === "secondary" && <ArrowIcon />}
    </button>
  );
}
