/** Spacing scale keys shared by layout primitives, mapped to the
 * `--space-N` custom properties defined in `design/tokens.css`. */
export type SpaceScale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function spaceVar(scale: SpaceScale): string {
  return `var(--space-${scale})`;
}
