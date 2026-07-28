import styles from "./PermissionState.module.css";

/** A boundary, not a failure -- the content exists but this role
 * cannot see or act on it (e.g. an Artist viewing a supervisor-only
 * Anchor comparison). Deliberately neutral, not red, so it never
 * reads as an error. */
export function PermissionState({
  title = "Read-only for your role",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className={styles.state} role="note">
      <span className={styles.marker} aria-hidden="true" />
      <div>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </div>
  );
}
