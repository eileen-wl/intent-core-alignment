import type { ReactNode } from "react";

import { Card } from "../layout/Card";
import styles from "./SummaryCard.module.css";

/** Compact label/value summary tile -- e.g. a count on a role
 * homepage ("High-attention Shots: 3"). Generic: callers supply the
 * label and value text, no production wording is hardcoded here. */
export function SummaryCard({
  label,
  value,
  description,
  status,
}: {
  label: string;
  value: string | number;
  description?: string;
  status?: ReactNode;
}) {
  return (
    <Card>
      <p className={styles.label}>{label}</p>
      <div className={styles.valueRow}>
        <p className={styles.value}>{value}</p>
        {status}
      </div>
      {description && <p className={styles.description}>{description}</p>}
    </Card>
  );
}
