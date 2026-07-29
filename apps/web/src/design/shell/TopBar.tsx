import { DemoModeBadge } from "./DemoModeBadge";
import { ExitRoleControl } from "./ExitRoleControl";
import { RoleIdentity } from "./RoleIdentity";
import styles from "./TopBar.module.css";

/** Portfolio-facing top bar: product identity, current fictional Demo
 * identity, the Demo mode badge, and the explicit exit control. No
 * role dropdown, no Actor ID field, no environment/provider details,
 * no fabricated Signal count (brief §6) -- an Intent Signal indicator
 * is Step 7B-3 scope. */
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
      <span className={styles.product}>ICAS</span>
      <div className={styles.right}>
        <RoleIdentity name={name} role={role} />
        <DemoModeBadge />
        <ExitRoleControl onExit={onExitRole} />
      </div>
    </header>
  );
}
