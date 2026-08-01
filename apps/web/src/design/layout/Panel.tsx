import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Panel.module.css";

/** Bordered surface block for grouped content -- Anchor summaries,
 * HumanGate comparisons, Agent output. `tone="elevated"` adds a subtle
 * shadow for content that should visually sit above the page. */
export function Panel({
  children,
  tone = "panel",
  className,
  ...rest
}: {
  children: ReactNode;
  tone?: "panel" | "elevated" | "muted";
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.panel, styles[tone], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
