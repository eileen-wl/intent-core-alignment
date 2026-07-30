import { DemoModeBadge } from "./DemoModeBadge";
import { ExitRoleControl } from "./ExitRoleControl";
import { RoleIdentity } from "./RoleIdentity";
import styles from "./TopBar.module.css";

function ProductMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="15.5" />
      <circle cx="20" cy="20" r="11" />
      <circle cx="20" cy="20" r="6.4" />
      <path d="M20 1.8c10.05 0 18.2 8.15 18.2 18.2S30.05 38.2 20 38.2" />
    </svg>
  );
}

export function TopBar({
  name,
  role,
  onExitRole,
}: {
  name: string;
  role: string;
  onExitRole: () => void | Promise<void>;
}) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand} aria-label="ICAS">
        <ProductMark />
        <span>ICAS</span>
      </div>
      <div className={styles.right}>
        <RoleIdentity name={name} role={role} />
        <DemoModeBadge />
        <ExitRoleControl onExit={onExitRole} />
      </div>
    </header>
  );
}
