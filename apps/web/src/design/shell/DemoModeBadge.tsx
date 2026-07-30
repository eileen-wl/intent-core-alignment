import styles from "./DemoModeBadge.module.css";

export function DemoModeBadge() {
  return (
    <span className={styles.badge}>
      <span aria-hidden="true" />
      Demo mode
    </span>
  );
}
