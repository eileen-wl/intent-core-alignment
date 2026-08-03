import type { AnchorContextRead } from "@intent-core/contracts";
import Link from "next/link";

import { StatusBadge } from "../../components";
import styles from "./AnchorContextLayer.module.css";

const ATTENTION_LABEL = {
  low: "Low attention",
  medium: "Medium attention",
  high: "High attention",
  not_assessed: "Not assessed yet",
} as const;

const GUIDANCE_LABEL = {
  current: "Guidance current",
  outdated: "Guidance outdated",
  missing: "Guidance missing",
  unavailable: "Guidance unavailable",
} as const;

function revisionLabel(revision: number | null): string {
  return revision === null ? "No confirmed revision" : `R${revision}`;
}

function attentionTone(level: AnchorContextRead["attention"]["level"]) {
  if (level === "high") return "blocking" as const;
  if (level === "medium") return "attention" as const;
  if (level === "not_assessed") return "unavailable" as const;
  return "confirmed" as const;
}

function contextStateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

function AuthorityChain({ context }: { context: AnchorContextRead }) {
  const core = context.core_anchor;
  const execution = context.execution_anchor;

  if (context.role === "vfx_supervisor") {
    return (
      <div className={styles.authorityGroup}>
        <span className={styles.eyebrow}>Authoritative direction</span>
        <strong>
          Core Anchor {revisionLabel(core.confirmed_revision_number)} ·{" "}
          {core.lifecycle_state}
        </strong>
        {core.confirmed_by_human_role && (
          <small>
            Confirmed by VFX Supervisor
            {core.confirmed_by_actor_id
              ? ` · ${core.confirmed_by_actor_id}`
              : ""}
          </small>
        )}
      </div>
    );
  }

  if (context.role === "cg_supervisor") {
    return (
      <div className={styles.chain}>
        <div className={styles.authorityGroup}>
          <span className={styles.eyebrow}>Shared direction</span>
          <strong>
            Core Anchor {revisionLabel(core.confirmed_revision_number)}
          </strong>
        </div>
        <span className={styles.chainArrow} aria-hidden="true">
          →
        </span>
        <div className={styles.authorityGroup}>
          <span className={styles.eyebrow}>Department execution</span>
          <strong>
            {execution?.department ?? "Task"} Execution Anchor{" "}
            {revisionLabel(execution?.confirmed_revision_number ?? null)}
          </strong>
          <small>
            {execution?.upstream_relationship_available
              ? `Based on Core Anchor R${execution.based_on_core_anchor_revision_number}`
              : "Upstream relationship unavailable"}
          </small>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.artistChain}>
      <div>
        <span className={styles.eyebrow}>Why</span>
        <strong>
          Core Anchor {revisionLabel(core.confirmed_revision_number)}
        </strong>
      </div>
      <div>
        <span className={styles.eyebrow}>How</span>
        <strong>
          {execution?.department ?? "Task"} Execution{" "}
          {revisionLabel(execution?.confirmed_revision_number ?? null)}
        </strong>
      </div>
      <div>
        <span className={styles.eyebrow}>What to do now</span>
        <strong>{context.next_action.title}</strong>
      </div>
    </div>
  );
}

/** Persistent, derived orientation layer shared by every formal object route. */
export function AnchorContextLayer({
  context,
}: {
  context: AnchorContextRead | null;
}) {
  if (context === null) {
    return (
      <section className={styles.layer} aria-label="Anchor context">
        <div className={styles.unavailable}>
          <strong>Anchor context unavailable</strong>
          <span>
            The current authoritative direction could not be loaded. Refresh
            before making an Anchor-dependent decision.
          </span>
        </div>
      </section>
    );
  }
  const core = context.core_anchor;
  const execution = context.execution_anchor;
  const direction = execution?.direction_summary ?? core.direction_summary;

  return (
    <section className={styles.layer} aria-label="Anchor context">
      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <AuthorityChain context={context} />
          <div className={styles.direction}>
            <span className={styles.eyebrow}>Current direction</span>
            <span>
              {direction ?? "No confirmed direction is available yet."}
            </span>
          </div>
          <div className={styles.statuses}>
            {execution && (
              <StatusBadge
                status={
                  execution.context_state === "outdated"
                    ? "attention"
                    : execution.context_state === "current"
                      ? "confirmed"
                      : "unavailable"
                }
                label={contextStateLabel(execution.context_state)}
              />
            )}
            <StatusBadge
              status={attentionTone(context.attention.level)}
              label={ATTENTION_LABEL[context.attention.level]}
            />
            {context.role === "artist" && (
              <StatusBadge
                status={
                  context.guidance_state === "outdated"
                    ? "attention"
                    : context.guidance_state === "current"
                      ? "confirmed"
                      : "unavailable"
                }
                label={GUIDANCE_LABEL[context.guidance_state]}
              />
            )}
          </div>
          <span className={styles.expandHint}>Details</span>
        </summary>

        <div className={styles.expanded}>
          <div>
            <span className={styles.eyebrow}>Must preserve</span>
            <p>
              {core.must_preserve ??
                "No concise must-preserve item is recorded."}
            </p>
          </div>
          <div>
            <span className={styles.eyebrow}>Allowed to vary</span>
            <p>
              {execution?.allowed_refinement ??
                core.allowed_variation ??
                "No concise variation boundary is recorded."}
            </p>
          </div>
          <div>
            <span className={styles.eyebrow}>Intent attention</span>
            <p>
              {context.attention.summary ??
                context.attention.review_requirement}
            </p>
            <small>{context.attention.review_requirement}</small>
          </div>
          <div className={styles.nextAction}>
            <span className={styles.eyebrow}>Next action</span>
            <strong>{context.next_action.title}</strong>
            <p>{context.next_action.why_now}</p>
            <small>{context.next_action.downstream_effect}</small>
            {context.next_action.executable &&
              context.next_action.target_route &&
              context.next_action.action_label && (
                <Link href={context.next_action.target_route}>
                  {context.next_action.action_label} →
                </Link>
              )}
          </div>
          {(core.newer_draft_exists || core.pending_human_gate_exists) && (
            <div className={styles.authorityNotice}>
              <span className={styles.eyebrow}>Draft distinction</span>
              <p>
                Core Anchor R{core.confirmed_revision_number ?? "—"} remains
                authoritative.
                {core.draft_revision_number
                  ? ` Draft R${core.draft_revision_number} is awaiting human action.`
                  : ""}
              </p>
            </div>
          )}
          {execution?.draft_revision_number && (
            <div>
              <span className={styles.eyebrow}>Current draft source</span>
              <p>
                {execution.draft_source
                  ? contextStateLabel(execution.draft_source)
                  : "Unknown"}
              </p>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
