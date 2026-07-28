import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ComparisonArea.module.css";

/** Full-width area for side-by-side content such as an Anchor revision
 * comparison or a HumanGate before/after view. Wider than
 * `ReadingColumn` since two-column comparisons need more horizontal
 * room; collapses to a single column on narrow viewports. */
export function ComparisonArea({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.comparisonArea, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
