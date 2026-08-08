"use client";

import type { AnchorContextRead } from "@intent-core/contracts";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { StatusBadge } from "../../components";
import styles from "./AnchorContextLayer.module.css";
import { conciseDirection, upstreamState } from "./presentation";

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

/** Package C follow-up (Anchor Context sticky-scrolling fix): the only
 * text shown in the persistent one-line `.stickySummaryBar` -- deliberately
 * minimal, never the full WHY/HOW/WHAT-TO-DO-NOW content. */
function stickySummaryText(context: AnchorContextRead): string {
  const core = context.core_anchor;
  const execution = context.execution_anchor;
  if (execution) {
    return `Core ${revisionLabel(core.confirmed_revision_number)} · Execution ${revisionLabel(execution.confirmed_revision_number)} · ${contextStateLabel(execution.context_state)}`;
  }
  return `Core ${revisionLabel(core.confirmed_revision_number)} · ${contextStateLabel(core.lifecycle_state)}`;
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
          {conciseDirection(core.direction_summary) ??
            "Core Anchor direction is unavailable."}
        </strong>
        <small>
          Core Anchor {revisionLabel(core.confirmed_revision_number)} ·{" "}
          {contextStateLabel(core.lifecycle_state)}
        </small>
      </div>
      <div>
        <span className={styles.eyebrow}>How</span>
        <strong>
          {conciseDirection(execution?.direction_summary) ??
            "Execution direction is unavailable."}
        </strong>
        <small>
          Execution Anchor{" "}
          {revisionLabel(execution?.confirmed_revision_number ?? null)} ·{" "}
          {contextStateLabel(execution?.context_state ?? "missing")}
        </small>
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
  defaultExpanded = false,
  storageKey,
}: {
  context: AnchorContextRead | null;
  defaultExpanded?: boolean;
  storageKey?: string;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!storageKey) return;
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored !== null) setExpanded(stored === "expanded");
  }, [storageKey]);

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;
      if (storageKey) {
        window.sessionStorage.setItem(
          storageKey,
          next ? "expanded" : "collapsed",
        );
      }
      return next;
    });
  }

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
  const direction = conciseDirection(
    execution?.direction_summary ?? core.direction_summary,
  );
  const upstream = upstreamState(context);

  return (
    <>
      {/* Package C follow-up: the only sticky element is this compact,
       * one-line summary -- the full block below (collapsed or expanded)
       * always participates in normal document flow and scrolls away
       * with the page. */}
      <div className={styles.stickySummaryBar}>
        <span className={styles.stickySummaryText}>
          {stickySummaryText(context)}
        </span>
        <button
          type="button"
          className={styles.stickySummaryButton}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggleExpanded}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <section
        className={styles.layer}
        aria-label="Anchor context"
        data-expanded={expanded}
      >
        <div className={styles.disclosure}>
          <div className={styles.summary}>
            <AuthorityChain context={context} />
            <div className={styles.direction}>
              <span className={styles.eyebrow}>Current direction</span>
              <span title={direction ?? undefined}>
                {direction ?? "No concise direction is available yet."}
              </span>
            </div>
            <div className={styles.controls}>
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
                {upstream && (
                  <StatusBadge status="attention" label={upstream} />
                )}
              </div>
              <button
                type="button"
                className={styles.disclosureButton}
                aria-expanded={expanded}
                aria-controls={contentId}
                onClick={toggleExpanded}
              >
                <span>
                  {expanded
                    ? "Collapse anchor context"
                    : "Expand anchor context"}
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  ⌄
                </span>
              </button>
            </div>
          </div>

          {expanded && (
            <div className={styles.expanded} id={contentId}>
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
              {execution?.execution_boundary && (
                <div>
                  <span className={styles.eyebrow}>Execution boundary</span>
                  <p>{execution.execution_boundary}</p>
                </div>
              )}
              <div>
                <span className={styles.eyebrow}>Intent attention</span>
                <p>
                  {context.attention.summary ??
                    context.attention.review_requirement}
                </p>
                <small>{context.attention.review_requirement}</small>
              </div>
              <div className={styles.nextAction}>
                <span className={styles.eyebrow}>
                  {context.next_action.title.startsWith("No immediate")
                    ? "Role action"
                    : "Readiness / next action"}
                </span>
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
              {upstream && (
                <div className={styles.upstreamState}>
                  <span className={styles.eyebrow}>Upstream state</span>
                  <strong>{upstream}</strong>
                </div>
              )}
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
              <div>
                <span className={styles.eyebrow}>
                  Current production context
                </span>
                <p>
                  {context.current_version.name
                    ? `${context.current_version.name}${context.current_version.version_number ? ` · v${context.current_version.version_number}` : ""}`
                    : "No current Production Version is recorded."}
                </p>
                {context.role === "artist" && (
                  <small>
                    Guidance: {GUIDANCE_LABEL[context.guidance_state]}
                  </small>
                )}
              </div>
              <div className={styles.contextLinks}>
                <span className={styles.eyebrow}>Related context</span>
                {core.link_target && context.role === "vfx_supervisor" && (
                  <Link href={core.link_target}>Open Intent →</Link>
                )}
                {context.attention.link_target && (
                  <Link href={context.attention.link_target}>
                    Open Alignment →
                  </Link>
                )}
                {execution?.link_target && context.role === "cg_supervisor" && (
                  <Link href={execution.link_target}>Open Execution →</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
