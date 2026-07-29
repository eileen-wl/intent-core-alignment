import styles from "./RoleIdentity.module.css";

/** The current fictional Demo human's name and fixed production role.
 * Grouped under one accessible name so assistive technology announces
 * "name, role" as a single meaningful unit rather than two unrelated
 * text fragments. */
export function RoleIdentity({ name, role }: { name: string; role: string }) {
  return (
    <div
      className={styles.identity}
      role="group"
      aria-label={`${name}, ${role}`}
    >
      <span className={styles.name}>{name}</span>
      <span className={styles.role}>{role}</span>
    </div>
  );
}
