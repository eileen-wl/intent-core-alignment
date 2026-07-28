import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Container.module.css";

/** Page-level container: centers content and caps it at the "wide"
 * content width. Use `ReadingColumn` inside it for prose-width content,
 * or `ComparisonArea` for full-width side-by-side content. */
export function Container({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.container, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
