import Link from "next/link";

import { StatusBadge } from "../components/StatusBadge";
import styles from "./RoleSidebar.module.css";
import type { SidebarNavItem } from "@/lib/roleNavigation";

/** Locked, role-specific primary navigation (brief §7). Only
 * `implemented` items are real links; the rest render as disabled,
 * non-navigable placeholders labelled "Upcoming" so they never lead to
 * a 404 and never imply available functionality. */
export function RoleSidebar({
  items,
  currentPath,
}: {
  items: SidebarNavItem[];
  currentPath: string;
}) {
  return (
    <nav className={styles.sidebar} aria-label="Role navigation">
      <ul className={styles.list}>
        {items.map((item) => {
          if (!item.implemented) {
            return (
              <li key={item.id} className={styles.itemRow}>
                <span className={styles.disabledItem} aria-disabled="true">
                  {item.label}
                </span>
                <StatusBadge status="unavailable" label="Upcoming" />
              </li>
            );
          }

          const isCurrent = item.href === currentPath;
          return (
            <li key={item.id} className={styles.itemRow}>
              <Link
                href={item.href}
                className={styles.link}
                aria-current={isCurrent ? "page" : undefined}
                data-current={isCurrent || undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
