"use client";

import { useState } from "react";
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
 * serialisable `role` literal (and, for a deep-link return, the
 * already-validated `returnTo` path) to it. `enterDemoRole` re-validates
 * `returnTo` itself regardless -- a Server Action is a callable network
 * endpoint, not a value this component can be trusted to have gated
 * correctly.
 *
 * Navigation-responsiveness fix (Phase 1 Part A): the click previously
 * gave no feedback at all until the Server Action's network round trip
 * and the subsequent redirect completed, which could take long enough
 * (confirmed in `ICAS_INBOX_SEMANTICS_AND_NAVIGATION_DIAGNOSTIC.md`) to
 * read as "the click did nothing." A plain `useState` pending flag --
 * not `useTransition` -- is the correct mechanism here: this project
 * pins React 18.3 (`package.json`), and `startTransition`'s `isPending`
 * on that version only stays true for the transition scope's own
 * synchronous execution, not for an awaited async call inside it
 * (verified empirically while implementing this fix) -- that "await
 * keeps isPending true" behavior is a React 19 feature this project
 * does not yet have. `setIsPending(true)` runs synchronously in the
 * click handler, before `enterDemoRole` is even called, so the very
 * first click is acknowledged immediately; the button stays disabled
 * until the real call settles, so a repeat click on the same button
 * cannot reach the handler at all while pending, rather than firing a
 * second real invocation. The exact same cookie-write/redirect call is
 * unchanged -- no new logic, no fake delay. `pendingLabel` keeps the
 * accepted role identity visible (its default only applies if a caller
 * ever omits it) rather than showing a role-agnostic "Loading…". In
 * real use `enterDemoRole` never actually resolves -- it always ends in
 * `redirect()`, which unmounts this component via real navigation --
 * so `setIsPending(false)` in `.finally()` is a defensive fallback for
 * a hypothetical non-redirect failure path, not something normally
 * reached. */
export function RoleEntryButton({
  role,
  label,
  pendingLabel = "Entering…",
  returnTo = null,
}: {
  role: HumanRole;
  label: string;
  pendingLabel?: string;
  returnTo?: string | null;
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
        void enterDemoRole(role, returnTo).finally(() => {
          setIsPending(false);
        });
      }}
    >
      <span>{isPending ? pendingLabel : label}</span>
      <ArrowIcon />
    </button>
  );
}
