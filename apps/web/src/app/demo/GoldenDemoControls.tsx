"use client";

import { useState } from "react";

import { loadCompletedJourney, resetGoldenJourney } from "./actions";
import styles from "./GoldenDemoControls.module.css";

export function GoldenDemoControls() {
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: "reset" | "completed") {
    const prompt =
      action === "reset"
        ? "Reset only the ICAS Golden Demo dataset?"
        : "Load the completed ICAS Golden Demo journey?";
    if (!window.confirm(prompt)) return;
    setMessage(null);
    setIsPending(true);
    void (async () => {
      try {
        const result =
          action === "reset"
            ? await resetGoldenJourney()
            : await loadCompletedJourney();
        setMessage(
          `${result.snapshot} snapshot loaded · ${result.task_ids.length} Golden Tasks · Shot ${result.shot_id}`,
        );
      } catch {
        setMessage(
          "The Golden Demo could not be changed. No other dataset was targeted.",
        );
      } finally {
        setIsPending(false);
      }
    })();
  }

  return (
    <section className={styles.panel} aria-labelledby="golden-demo-controls">
      <h2 id="golden-demo-controls">Golden Demo journey</h2>
      <p>
        This changes only the ICAS Golden Demo dataset. Legacy fixtures, live
        records and ftrack-linked records are not affected.
      </p>
      <div className={styles.actions}>
        <button type="button" disabled={isPending} onClick={() => run("reset")}>
          Reset Golden Journey
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => run("completed")}
        >
          Load Completed Journey
        </button>
      </div>
      {isPending ? <p role="status">Updating Golden Demo…</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
