"use client";

import styles from "./ExitRoleControl.module.css";

/** Explicit Demo role exit (brief §1/§9): the only way to change role
 * once one has been selected. `onExit` is injected as a prop -- the
 * real Server Action reference in production, a plain mock in tests --
 * called directly rather than through a `<form action>`, since a
 * direct call is testable with plain React Testing Library and works
 * identically for a Server Action reference passed down from a Server
 * Component page. */
export function ExitRoleControl({
  onExit,
}: {
  onExit: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => {
        void onExit();
      }}
    >
      Exit role view
    </button>
  );
}
