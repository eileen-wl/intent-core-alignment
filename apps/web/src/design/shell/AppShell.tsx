import type { ReactNode } from "react";

import type { SidebarNavItem } from "@/lib/roleNavigation";
import { RoleSidebar } from "./RoleSidebar";
import styles from "./AppShell.module.css";
import { TopBar } from "./TopBar";

export function AppShell({
  name,
  role,
  onExitRole,
  sidebarItems,
  currentPath,
  children,
}: {
  name: string;
  role: string;
  onExitRole: () => void | Promise<void>;
  sidebarItems: SidebarNavItem[];
  currentPath: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <TopBar name={name} role={role} onExitRole={onExitRole} />
      <div className={styles.body}>
        <RoleSidebar items={sidebarItems} currentPath={currentPath} name={name} />
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
