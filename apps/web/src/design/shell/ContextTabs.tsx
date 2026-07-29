import Link from "next/link";

import styles from "./ContextTabs.module.css";

export interface ContextTab {
  id: string;
  label: string;
  href: string;
}

/** Route-backed contextual tabs (docs/step-7/05_STEP_7A4_...md §3 --
 * "route-backed tabs", each a real navigable page rather than a
 * client-side panel switcher). Reusable and tested on its own; not
 * wired into any role homepage in this batch since no Shot/Task/Version
 * context exists yet to tab through. */
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
