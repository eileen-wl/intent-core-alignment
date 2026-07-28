import styles from "./MetadataRow.module.css";

/** A row of label/value metadata pairs -- "Created", "Provider",
 * "Prompt version", etc. Wraps responsively rather than truncating. */
export function MetadataRow({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <dl className={styles.row}>
      {items.map((item) => (
        <div className={styles.item} key={item.label}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={styles.value}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
