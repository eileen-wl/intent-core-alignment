import type { ReactNode } from "react";

import styles from "./SectionHeader.module.css";

/** Heading for a section within a page (below `PageHeader`'s `<h1>`).
 * Renders an `<h2>` by default; pass `level={3}` for a nested
 * subsection so the document outline stays correct. */
export function SectionHeader({
  title,
  description,
  actions,
  level = 2,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={styles.header}>
      <div className={styles.headingBlock}>
        <Heading className={styles.title}>{title}</Heading>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
