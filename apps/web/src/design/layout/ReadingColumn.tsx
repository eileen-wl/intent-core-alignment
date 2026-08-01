import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ReadingColumn.module.css";

/** Prose-width column for Intent Workspace copy, Anchor text, and other
 * long-form reading content. Caps line length for readability. */
export function ReadingColumn({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.readingColumn, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
