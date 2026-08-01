import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import styles from "./Grid.module.css";
import { spaceVar, type SpaceScale } from "./spacing";

/** Responsive grid: as many `minColumnWidth` columns as fit, collapsing
 * to a single column on narrow viewports. Suitable for card listings
 * (Shots, Tasks, Versions) without a hand-written breakpoint per page. */
export function Grid({
  children,
  gap = 4,
  minColumnWidth = "16rem",
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  gap?: SpaceScale;
  minColumnWidth?: string;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[styles.grid, className].filter(Boolean).join(" ")}
      style={
        {
          gap: spaceVar(gap),
          "--grid-min-column-width": minColumnWidth,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </div>
  );
}
