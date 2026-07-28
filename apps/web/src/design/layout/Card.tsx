import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Card.module.css";

/** Compact surface for grid/list items -- one Shot, Task, or Version per
 * card. Use `Panel` instead for larger single-focus content blocks. */
export function Card({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
