import Link from "next/link";

import styles from "./Breadcrumbs.module.css";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** Simple current-location breadcrumb reflecting production hierarchy
 * (docs/step-7/03_STEP_7A2_...md §14), not database structure. The
 * last item is always the current page and is never a link. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={styles.item}>
              {isCurrent || !item.href ? (
                <span aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href}>{item.label}</Link>
              )}
              {!isCurrent && <span aria-hidden="true"> / </span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
