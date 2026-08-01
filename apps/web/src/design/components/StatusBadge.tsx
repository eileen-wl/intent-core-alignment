import styles from "./StatusBadge.module.css";

/** Visual status categories only -- deliberately generic (not "Version
 * approved" or "Shot blocked") so this component never embeds
 * production business logic. Callers supply the actual `label` text;
 * this maps only to a restrained visual treatment. */
export type StatusBadgeStatus =
  | "neutral"
  | "active"
  | "confirmed"
  | "attention"
  | "blocking"
  | "historical"
  | "integration-ready"
  | "unavailable";

const TONE_CLASS: Record<StatusBadgeStatus, string> = {
  neutral: styles.neutral,
  active: styles.active,
  confirmed: styles.confirmed,
  attention: styles.attention,
  blocking: styles.blocking,
  historical: styles.historical,
  "integration-ready": styles.integrationReady,
  unavailable: styles.unavailable,
};

const DOT_CLASS: Record<StatusBadgeStatus, string> = {
  neutral: styles.dotSolid,
  active: styles.dotSolid,
  confirmed: styles.dotSolid,
  attention: styles.dotSolid,
  blocking: styles.dotSolid,
  historical: styles.dotHollow,
  "integration-ready": styles.dotSolid,
  unavailable: styles.dotDashed,
};

/** Small status chip. `status` selects the visual treatment; `label`
 * is the caller-supplied, human-readable text -- this component never
 * hardcodes production wording so it stays reusable across VFX, CG,
 * and Artist surfaces. */
export function StatusBadge({
  status,
  label,
}: {
  status: StatusBadgeStatus;
  label: string;
}) {
  return (
    <span className={[styles.badge, TONE_CLASS[status]].join(" ")}>
      <span
        className={[styles.dot, DOT_CLASS[status]].join(" ")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
