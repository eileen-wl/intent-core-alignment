"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createDependencyAction } from "@/features/cg/actions";
import styles from "./RecordDependencyForm.module.css";

export function RecordDependencyForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"dependency" | "conflict">("dependency");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "">("");

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <label className={styles.fieldLabel}>
          Kind
          <select
            className={styles.select}
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as "dependency" | "conflict")
            }
          >
            <option value="dependency">Dependency</option>
            <option value="conflict">Cross-role conflict</option>
          </select>
        </label>
        <label className={styles.fieldLabel}>
          Severity (optional)
          <select
            className={styles.select}
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as "low" | "medium" | "high" | "")
            }
          >
            <option value="">Not set</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>
      <label className={styles.fieldLabel}>
        Description
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </label>
      <button
        type="button"
        className={styles.button}
        disabled={isPending || description.trim().length === 0}
        onClick={() => {
          setError(null);
          startTransition(() => {
            createDependencyAction(
              taskId,
              kind,
              description,
              severity || null,
            ).then((result) => {
              if (result.ok) {
                setDescription("");
                router.refresh();
              } else {
                setError(result.error.message);
              }
            });
          });
        }}
      >
        {isPending ? "Recording…" : "Record"}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
