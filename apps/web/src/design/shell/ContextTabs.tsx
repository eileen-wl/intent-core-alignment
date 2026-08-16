"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

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

/** Renders only while its own enclosing `<Link>`'s navigation is
 * in flight (`useLinkStatus` must be called from a component nested
 * inside that specific `<Link>` -- there is no way to read this state
 * on the `<a>` element itself, which is why the pending treatment is a
 * child overlay rather than an attribute on the tab). A restrained
 * underline-opacity pulse, never purple (reserved for current-
 * selection/Intent/primary-Human-action, not system loading state --
 * ICAS Visual Language), plus an `aria-live` status region so the click
 * is announced to assistive tech immediately, not only once navigation
 * completes. */
function TabPendingIndicator({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className={styles.tabPendingBar} aria-hidden="true" />
      <span className={styles.srOnly} role="status">
        {`Loading ${label}…`}
      </span>
    </>
  );
}

/** Route-backed contextual tabs (docs/step-7/05_STEP_7A4_...md §3 --
 * "route-backed tabs", each a real navigable page rather than a
 * client-side panel switcher).
 *
 * Persistent workspace architecture (Navigation Responsiveness Fix,
 * Phase 2): `activeTabId` is no longer a prop supplied by the leaf
 * server page -- once this component lives inside a persistent
 * Shot/Task `layout.tsx` instead of being recreated by every tab's own
 * page, a value computed once at a page's render time would go stale
 * the instant the user clicks a sibling tab without this component
 * itself re-rendering. `usePathname()` derives the active tab from the
 * real current route on every render instead. `TabPendingIndicator`
 * (`useLinkStatus`, stable in the installed Next.js 15.5) gives the
 * clicked tab immediate, restrained feedback before that navigation
 * commits -- no `router.push`, no third-party progress library, no
 * global "disable other tabs" behavior. */
export function ContextTabs({ tabs }: { tabs: ContextTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Section" className={styles.nav}>
      <ul className={styles.list}>
        {tabs.map((tab) => {
          const isActive = tab.href === pathname;
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
                <TabPendingIndicator label={tab.label} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
