import Link from "next/link";

import styles from "./RoleSidebar.module.css";
import type { SidebarNavItem } from "@/lib/roleNavigation";

function NavigationIcon({ label }: { label: string }) {
  if (/alignment|execution inbox|my tasks/i.test(label)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5.5h14l2 11H3l2-11Z" />
        <path d="M3.75 16.5h4.7l1.2-2h4.7l1.2 2h4.7" />
      </svg>
    );
  }

  if (/project|task/i.test(label)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.75 7.25A2.25 2.25 0 0 1 6 5h3.1l1.75 2H18a2.25 2.25 0 0 1 2.25 2.25v7.5A2.25 2.25 0 0 1 18 19H6a2.25 2.25 0 0 1-2.25-2.25v-9.5Z" />
      </svg>
    );
  }

  if (/intent signal/i.test(label)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9v6" />
        <path d="M9.5 5.5v13" />
        <path d="M14.5 3v18" />
        <path d="M19 8v8" />
      </svg>
    );
  }

  if (/integration/i.test(label)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9.25 14.75 5.5-5.5" />
        <path d="M7.25 17.25 5.8 18.7a3.5 3.5 0 0 1-4.95-4.95L4 10.6a3.5 3.5 0 0 1 4.95 0" />
        <path d="m16.75 6.75 1.45-1.45a3.5 3.5 0 1 1 4.95 4.95L20 13.4a3.5 3.5 0 0 1-4.95 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
    </svg>
  );
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "IC";
}

/** A nav item is a *candidate* match for `currentPath` if the path is
 * exactly its `href`, or a real sub-path of it (`href + "/"` boundary --
 * never a bare string-prefix, so `/vfx-other` never matches `/vfx`).
 * Among every candidate, the one with the longest `href` wins: this is
 * what correctly keeps `Shots` (`/vfx/shots`) active on
 * `/vfx/shots/{id}/intent` without `Workspace Home` (`/vfx`) also
 * claiming it, and without `/vfx` ever prefix-matching every VFX page
 * (docs/step-7 Step 7C-1 locked IA §6). */
function currentItemId(items: SidebarNavItem[], currentPath: string): string | null {
  let best: SidebarNavItem | null = null;
  for (const item of items) {
    const matches = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.href.length)) {
      best = item;
    }
  }
  return best?.id ?? null;
}

export function RoleSidebar({
  items,
  currentPath,
  name = "ICAS User",
}: {
  items: SidebarNavItem[];
  currentPath: string;
  name?: string;
}) {
  const activeId = currentItemId(items, currentPath);

  return (
    <nav className={styles.sidebar} aria-label="Role navigation">
      <ul className={styles.list}>
        {items.map((item) => {
          const isCurrent = item.id === activeId;
          const content = (
            <>
              <NavigationIcon label={item.label} />
              <span aria-disabled={!item.implemented ? "true" : undefined}>{item.label}</span>
            </>
          );

          if (!item.implemented) {
            return (
              <li key={item.id} className={styles.itemRow}>
                <span className={styles.disabledItem} aria-disabled="true">
                  {content}
                </span>
                <span className={styles.upcoming}>Upcoming</span>
              </li>
            );
          }

          return (
            <li key={item.id} className={styles.itemRow}>
              <Link
                href={item.href}
                className={styles.link}
                aria-current={isCurrent ? "page" : undefined}
                data-current={isCurrent || undefined}
              >
                {content}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer} aria-label={`${name} profile`}>
        <span className={styles.avatar}>{initials(name)}</span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </div>
    </nav>
  );
}
