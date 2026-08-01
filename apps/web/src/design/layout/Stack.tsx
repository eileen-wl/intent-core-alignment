import type { HTMLAttributes, ReactNode } from "react";

import { spaceVar, type SpaceScale } from "./spacing";

/** Vertical flex stack with a configurable gap from the spacing scale. */
export function Stack({
  children,
  gap = 4,
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  gap?: SpaceScale;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spaceVar(gap),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
