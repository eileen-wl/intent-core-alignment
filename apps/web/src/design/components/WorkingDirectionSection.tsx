import Link from "next/link";

import type { WorkingDirectionSection as WorkingDirectionSectionModel } from "@/lib/workingDirection";
import { Grid } from "../layout/Grid";
import { Panel } from "../layout/Panel";
import { AuthorityLabel } from "./AuthorityLabel";
import { SectionHeader } from "./SectionHeader";
import styles from "./WorkingDirectionSection.module.css";

/** Step 9B-1: the shared, role-agnostic render for a role's Working
 * Direction summary (`docs/step-9/03_STEP_9B1_...md`). Every role's page
 * supplies its own `WorkingDirectionSectionModel` (built by a pure,
 * role-specific selector, never fetched here) -- this component only
 * renders it, using the existing `AuthorityLabel` vocabulary so the
 * four information classes (human-confirmed / production-fact /
 * ai-interpretation / human-review-required) are visible without
 * inventing a second labelling system. Renders nothing when `items` is
 * empty rather than an empty heading. */
export function WorkingDirectionSection({
  section,
}: {
  section: WorkingDirectionSectionModel;
}) {
  if (section.items.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader title={section.title} />
      <Grid
        minColumnWidth="26rem"
        gap={3}
        className={styles.grid}
        style={{ alignItems: "start" }}
      >
        {section.items.map((item) => (
          <Panel key={item.id} className={styles.item}>
            <p className={styles.label}>{item.label}</p>
            <p className={styles.value}>{item.value}</p>
            {item.authority && (
              <AuthorityLabel variant={item.authority} detail={item.detail} />
            )}
            {item.href && (
              <Link href={item.href} className={styles.viewDetails}>
                View details
              </Link>
            )}
          </Panel>
        ))}
      </Grid>
    </section>
  );
}
