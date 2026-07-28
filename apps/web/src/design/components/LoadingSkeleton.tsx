import styles from "./LoadingSkeleton.module.css";

/** Placeholder block(s) shown while content loads. `variant="text"`
 * renders `lines` text-height bars; `variant="block"` renders a single
 * rectangle at `height`. The shimmer only animates when the user has
 * not requested reduced motion (see globals.css). */
export function LoadingSkeleton({
  variant = "text",
  lines = 3,
  height = "8rem",
  label = "Loading",
}: {
  variant?: "text" | "block";
  lines?: number;
  height?: string;
  label?: string;
}) {
  if (variant === "block") {
    return (
      <div
        className={styles.block}
        style={{ height }}
        role="status"
        aria-label={label}
      />
    );
  }

  return (
    <div className={styles.textGroup} role="status" aria-label={label}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          className={styles.line}
          key={index}
          style={index === lines - 1 ? { width: "70%" } : undefined}
        />
      ))}
    </div>
  );
}
