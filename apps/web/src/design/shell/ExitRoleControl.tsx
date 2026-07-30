"use client";

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
      <ExitIcon />
      <span>Exit role view</span>
    </button>
  );
}
