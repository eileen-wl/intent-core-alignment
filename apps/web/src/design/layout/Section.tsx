import type { HTMLAttributes, ReactNode } from "react";

import { spaceVar, type SpaceScale } from "./spacing";

/** Consistent vertical rhythm between page sections. Wraps a section of
 * the page (e.g. "Cross-role Assessment", "Activity") with a bottom
 * margin from the spacing scale, so pages don't hand-roll spacing. */
export function Section({
  children,
  spacing = 7,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  spacing?: SpaceScale;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={className}
      style={{ marginBottom: spaceVar(spacing), ...style }}
      {...rest}
    >
      {children}
    </section>
  );
}
