"use client";

import { useState } from "react";

import styles from "./ExitRoleControl.module.css";

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
      <path d="M13 8.5 16.5 12 13 15.5" />
      <path d="M9 12h7.5" />
    </svg>
  );
}

/** Full-screen-skeleton removal pass: `onExit` (`exitRoleView`) is a
 * redirect-based Server Action, same shape as `enterDemoRole` --
 * `RoleEntryButton`'s own doc comment explains why a plain `useState`
 * pending flag, not `useTransition`, is correct on this project's
 * pinned React 18.3. Root `app/loading.tsx` is gone, so this click
 * previously had zero feedback until the redirect landed; now the
 * button disables and relabels immediately, the same acknowledgement
 * Role Entry already gives. */
export function ExitRoleControl({
  onExit,
}: {
  onExit: () => void | Promise<void>;
}) {
  const [isPending, setIsPending] = useState(false);

  return (
    <button
      type="button"
      className={styles.button}
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => {
        setIsPending(true);
        void Promise.resolve(onExit()).finally(() => {
          setIsPending(false);
        });
      }}
    >
      <ExitIcon />
      <span>{isPending ? "Exiting…" : "Exit role view"}</span>
    </button>
  );
}
