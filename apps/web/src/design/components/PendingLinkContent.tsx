"use client";

import { useLinkStatus } from "next/link";

import styles from "./PendingLinkContent.module.css";

/** Immediate, restrained click acknowledgement for an internal
 * navigation `<Link>` (full-screen-skeleton removal pass). Route
 * `loading.tsx` boundaries are gone -- clicking a nav item, sidebar
 * link, or work-item row no longer replaces the current page with a
 * skeleton; the current content stays visible until the next route
 * commits. This component is the click feedback that fills that gap:
 * render it as a child of the `<Link>` it should track (`useLinkStatus`
 * can only be read from inside that specific `<Link>`, never applied to
 * the `<a>` element itself). Renders nothing until that Link's own
 * navigation is pending, then a small neutral dot (never purple --
 * reserved for current-selection/Intent/primary-Human-action, not a
 * system loading state, ICAS Visual Language) plus an `aria-live`
 * status region so assistive tech hears the click was registered
 * immediately, not only once navigation completes. Mirrors
 * `ContextTabs.tsx`'s existing `TabPendingIndicator`, generalized for
 * reuse outside the tab strip.
 *
 * Layout-shift fix: the visible dot is `position: absolute` (see
 * `PendingLinkContent.module.css`), so it never becomes a flex item or
 * changes inline-block intrinsic width in any consuming Link's layout --
 * appearing/disappearing on click must never resize or shift the row,
 * card, or button around it. */
export function PendingLinkContent({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span className={styles.pendingDot} aria-hidden="true" />
      <span className={styles.srOnly} role="status">
        {`Loading ${label}…`}
      </span>
    </>
  );
}
