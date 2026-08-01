import type { HTMLAttributes, ReactNode } from "react";

import { spaceVar, type SpaceScale } from "./spacing";

/** Horizontal inline row with a configurable gap; wraps by default so
 * it stays usable on narrow viewports without a separate breakpoint. */
export function Row({
  children,
  gap = 3,
  align = "center",
  wrap = true,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  gap?: SpaceScale;
  align?: "start" | "center" | "end" | "baseline";
  wrap?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: align,
        flexWrap: wrap ? "wrap" : "nowrap",
        gap: spaceVar(gap),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
