"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskDependencyRead } from "@intent-core/contracts";

import {
  acknowledgeDependencyAction,
  resolveDependencyAction,
} from "@/features/cg/actions";
import styles from "./DependencyRow.module.css";

export function DependencyRow({
  taskId,
  dependency,
}: {
  taskId: string;
  dependency: TaskDependencyRead;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <span className={styles.kind}>
          {dependency.kind === "escalation" ? "Escalation" : dependency.kind}
        </span>
        <p className={styles.description}>{dependency.description}</p>
        <p className={styles.meta}>
          {dependency.created_by_human_role ?? dependency.created_by_actor_kind}{" "}
          · {new Date(dependency.created_at).toLocaleString()}
          {dependency.severity ? ` · ${dependency.severity} severity` : ""}
        </p>
      </div>
      <div className={styles.actions}>
        <span className={styles.status}>{dependency.status}</span>
        {dependency.status === "open" && (
          <>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(() => {
                  acknowledgeDependencyAction(taskId, dependency.id).then(
                    (result) => {
                      if (result.ok) {
                        router.refresh();
                      } else {
                        setError(result.error.message);
                      }
                    },
                  );
                });
              }}
            >
              Acknowledge
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(() => {
                  resolveDependencyAction(taskId, dependency.id).then(
                    (result) => {
                      if (result.ok) {
                        router.refresh();
                      } else {
                        setError(result.error.message);
                      }
                    },
                  );
                });
              }}
            >
              Resolve
            </button>
          </>
        )}
        {dependency.status === "acknowledged" && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(() => {
                resolveDependencyAction(taskId, dependency.id).then(
                  (result) => {
                    if (result.ok) {
                      router.refresh();
                    } else {
                      setError(result.error.message);
                    }
                  },
                );
              });
            }}
          >
            Resolve
          </button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
