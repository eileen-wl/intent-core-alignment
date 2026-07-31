import Link from "next/link";

import styles from "./ContextTabs.module.css";

export interface ContextTab {
  id: string;
  label: string;
  href: string;
  /** Whether this secondary page has a real route yet. Step 7C-1: an
   * unimplemented tab (Versions/Alignment/Activity, built in Step 7C-3)
   * renders as a disabled, non-navigable placeholder labelled
   * "Upcoming" -- the same pattern `RoleSidebar` already uses for
   * unimplemented primary nav -- rather than a link that would lead to
   * an avoidable 404. Defaults to `true` so every existing caller keeps
   * behaving exactly as before. */
  implemented?: boolean;
}

/** Route-backed contextual tabs (docs/step-7/05_STEP_7A4_...md §3 --
 * "route-backed tabs", each a real navigable page rather than a
 * client-side panel switcher). */
export function ContextTabs({
  tabs,
  activeTabId,
}: {
  tabs: ContextTab[];
  activeTabId: string;
}) {
  return (
    <nav aria-label="Section" className={styles.nav}>
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          if (tab.implemented === false) {
            return (
              <li key={tab.id} className={styles.disabledItem}>
                <span className={styles.disabledTab} aria-disabled="true">
                  {tab.label}
                </span>
                <span className={styles.upcomingBadge}>Upcoming</span>
              </li>
            );
          }
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-active={isActive || undefined}
                className={styles.tab}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
