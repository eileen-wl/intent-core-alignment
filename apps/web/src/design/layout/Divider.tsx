import styles from "./Divider.module.css";

/** Thin horizontal rule for separating content within a panel. Purely
 * visual -- pass `aria-hidden` semantics are already handled by the
 * `<hr>` element's implicit "separator" role. */
export function Divider({ className }: { className?: string }) {
  return (
    <hr className={[styles.divider, className].filter(Boolean).join(" ")} />
  );
}
