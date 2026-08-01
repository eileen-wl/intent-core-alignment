import type { ReactNode } from "react";

import styles from "./PageHeader.module.css";

/** Top-of-page heading: optional eyebrow (e.g. a breadcrumb-like
 * context label), an `<h1>` title, an optional description, and an
 * optional right-aligned actions/status slot (e.g. a StatusBadge or
 * AuthorityLabel). */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headingBlock}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
