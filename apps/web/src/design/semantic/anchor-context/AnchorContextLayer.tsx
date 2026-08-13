"use client";

import type { AnchorContextRead } from "@intent-core/contracts";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Icon, StatusBadge } from "../../components";
import styles from "./AnchorContextLayer.module.css";
import {
  conciseDirection,
  stripGeneratorLabel,
  upstreamState,
} from "./presentation";

/** CG Version Review's "review" variant, collapsed state only: a
 * presentation-only concise version of the already-`conciseDirection`
 * -cleaned direction text, budgeted to roughly 1-2 desktop lines. Same
 * whole-sentence-only technique as the Agent Review takeaway builder
 * (never slices a sentence in half) -- the full real direction stays
 * exactly as-is in the expanded state, untouched by this turn. */
const REVIEW_COLLAPSED_DIRECTION_CHAR_BUDGET = 140;

function deriveConciseReviewDirection(direction: string): string {
  const sentences = direction.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
  if (!sentences || sentences.length === 0) return direction.trim();

  let concise = "";
  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (concise.length === 0) {
      concise = sentence;
      continue;
    }
    if (
      `${concise} ${sentence}`.length > REVIEW_COLLAPSED_DIRECTION_CHAR_BUDGET
    )
      break;
    concise = `${concise} ${sentence}`;
  }
  return concise;
}

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
        {/* `confirmed_by_actor_id` is an internal session/audit id (e.g.
         * "vfx-1"), never a real display name -- this codebase already
         * keeps a separate, real display-name field for that purpose
         * (`DEMO_IDENTITY_NAME` in `demoIdentity.ts`), so the raw id is
         * presentation-hidden here rather than shown as if it were
         * meaningful business information. */}
        {core.confirmed_by_human_role && (
          <small>Confirmed by VFX Supervisor</small>
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

/** CG Version Review's "review" variant: the Core Anchor -> Execution
 * Anchor authority relationship as two icon-marked nodes joined by an
 * arrow, reused identically by both the collapsed guardrail summary
 * and the expanded state's "Authority relationship" row -- CG-role
 * context always carries both anchors, so this assumes that shape
 * rather than branching on `context.role` the way `AuthorityChain`
 * (used by every other role/variant) does. */
function ReviewRelationship({ context }: { context: AnchorContextRead }) {
  const core = context.core_anchor;
  const execution = context.execution_anchor;
  return (
    <div className={styles.reviewRelationship}>
      <div className={styles.reviewNode}>
        <span
          className={`${styles.reviewNodeIcon} ${styles.reviewNodeIconCore}`}
        >
          <Icon name="core-anchor" size="region" />
        </span>
        <div>
          <strong>
            Core Anchor {revisionLabel(core.confirmed_revision_number)}
          </strong>
          <small>{contextStateLabel(core.lifecycle_state)}</small>
        </div>
      </div>
      <span className={styles.reviewRelationshipArrow} aria-hidden="true">
        →
      </span>
      <div className={styles.reviewNode}>
        <span
          className={`${styles.reviewNodeIcon} ${styles.reviewNodeIconExecution}`}
        >
          <Icon name="execution-anchor" size="region" />
        </span>
        <div>
          <strong>
            {execution?.department ?? "Task"} Execution Anchor{" "}
            {revisionLabel(execution?.confirmed_revision_number ?? null)}
          </strong>
          <small>
            {contextStateLabel(execution?.lifecycle_state ?? "missing")}
            {execution?.upstream_relationship_available
              ? ` · based on Core Anchor R${execution.based_on_core_anchor_revision_number}`
              : ""}
          </small>
        </div>
      </div>
    </div>
  );
}

function ReviewAttention({ context }: { context: AnchorContextRead }) {
  if (context.attention.level === "not_assessed") return null;
  return (
    <div className={styles.reviewAttention}>
      <span
        className={styles.reviewAttentionHead}
        data-level={context.attention.level}
      >
        <span className={styles.reviewAttentionDot} aria-hidden="true" />
        {ATTENTION_LABEL[context.attention.level]}
      </span>
      {context.attention.summary && (
        <p className={styles.reviewAttentionDetail}>
          {stripGeneratorLabel(context.attention.summary)}
        </p>
      )}
    </div>
  );
}

/** Persistent, derived orientation layer shared by every formal object route. */
export function AnchorContextLayer({
  context,
  defaultExpanded = false,
  storageKey,
  variant = "standard",
}: {
  context: AnchorContextRead | null;
  defaultExpanded?: boolean;
  storageKey?: string;
  /** Owner-approved CG Version Review visual reference (Visual
   * Recomposition pass): a distinct collapsed guardrail summary and
   * expanded relationship/matrix/rail composition, opt-in only.
   * Additive -- every existing caller (VFX Alignment, Artist, CG's
   * other tabs) keeps the unchanged "standard" rendering by not
   * passing this prop, so none of them are visually affected. */
  variant?: "standard" | "review";
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
  const hasContextLinks = Boolean(
    (core.link_target && context.role === "vfx_supervisor") ||
    context.attention.link_target ||
    (execution?.link_target && context.role === "cg_supervisor"),
  );

  if (variant === "review") {
    if (!expanded) {
      return (
        <div className={styles.reviewCollapsed}>
          <span className={styles.reviewKicker}>
            <Icon name="core-anchor" size="region" />
            Anchor context
          </span>
          <div className={styles.reviewTopRow}>
            <ReviewRelationship context={context} />
            <ReviewAttention context={context} />
          </div>
          <div className={styles.reviewDirection}>
            <span className={styles.eyebrow}>Current direction</span>
            <p title={direction ?? undefined}>
              {direction
                ? deriveConciseReviewDirection(direction)
                : "No concise direction is available yet."}
            </p>
          </div>
          <button
            type="button"
            className={styles.reviewExpandButton}
            aria-expanded={false}
            aria-controls={contentId}
            onClick={toggleExpanded}
          >
            Show full context →
          </button>
        </div>
      );
    }

    return (
      <section
        className={styles.reviewExpanded}
        aria-label="Anchor context"
        id={contentId}
      >
        <span className={styles.reviewKicker}>
          <Icon name="core-anchor" size="region" />
          Anchor context
        </span>
        <div className={styles.reviewTopRow}>
          <ReviewRelationship context={context} />
          <ReviewAttention context={context} />
        </div>
        <div className={styles.reviewDirection}>
          <span className={styles.eyebrow}>Current direction</span>
          <p>{direction ?? "No concise direction is available yet."}</p>
        </div>
        <div className={styles.guardrailMatrix}>
          <div className={styles.guardrailCell}>
            <span className={styles.eyebrow}>Must preserve</span>
            <p>
              {stripGeneratorLabel(
                core.must_preserve ??
                  "No concise must-preserve item is recorded.",
              )}
            </p>
          </div>
          <div className={styles.guardrailCell}>
            <span className={styles.eyebrow}>May vary</span>
            <p>
              {stripGeneratorLabel(
                execution?.allowed_refinement ??
                  core.allowed_variation ??
                  "No concise variation boundary is recorded.",
              )}
            </p>
          </div>
          <div className={styles.guardrailCell}>
            <span className={styles.eyebrow}>Execution boundary</span>
            <p>
              {stripGeneratorLabel(
                execution?.execution_boundary ??
                  "No execution boundary is recorded.",
              )}
            </p>
          </div>
          <div className={styles.guardrailCell}>
            <span className={styles.eyebrow}>Intent attention</span>
            <p>
              {stripGeneratorLabel(
                context.attention.summary ??
                  context.attention.review_requirement,
              )}
            </p>
          </div>
        </div>
        <div className={styles.stateRail}>
          <div className={styles.stateRailItem}>
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
            <div className={styles.stateRailItem}>
              <span className={styles.eyebrow}>Upstream state</span>
              <strong>{upstream}</strong>
            </div>
          )}
          {(core.newer_draft_exists || core.pending_human_gate_exists) && (
            <div className={styles.stateRailItem}>
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
            <div className={styles.stateRailItem}>
              <span className={styles.eyebrow}>Current draft source</span>
              <p>
                {execution.draft_source
                  ? contextStateLabel(execution.draft_source)
                  : "Unknown"}
              </p>
            </div>
          )}
          <div className={styles.stateRailItem}>
            <span className={styles.eyebrow}>Current production context</span>
            <p>
              {context.current_version.name
                ? `${context.current_version.name}${context.current_version.version_number ? ` · v${context.current_version.version_number}` : ""}`
                : "No current Production Version is recorded."}
            </p>
          </div>
          {hasContextLinks && (
            <div className={styles.stateRailItem}>
              <span className={styles.eyebrow}>Related context</span>
              {context.attention.link_target && (
                <Link href={context.attention.link_target}>
                  Open Alignment →
                </Link>
              )}
              {execution?.link_target && context.role === "cg_supervisor" && (
                <Link href={execution.link_target}>Open Execution →</Link>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.reviewCollapseButton}
          aria-expanded={true}
          aria-controls={contentId}
          onClick={toggleExpanded}
        >
          Collapse anchor context
        </button>
      </section>
    );
  }

  // Owner decision (VFX Alignment interaction refinement): no
  // persistent/sticky bar in either state, but the collapsed state
  // reads as a compact, structured "band" -- a kicker + attention
  // header, then identity/direction with the expand action, inside a
  // light, non-sticky surface -- not just loose lines of text, and
  // still substantially lighter than the expanded `.layer` (no strong
  // border, no shadow, no backdrop blur). Attention only renders when
  // the backend has a real assessed value (`not_assessed` is honestly
  // omitted, never rendered as a placeholder chip). Built only from
  // `core`/`direction`, already real, role-generic fields computed
  // above -- no VFX-only assumption, since every role's AnchorContextRead
  // carries a `core_anchor` and a resolved `direction`.
  if (!expanded) {
    return (
      <div className={styles.collapsedRow}>
        <div className={styles.collapsedHeader}>
          <span className={styles.eyebrow}>Anchor context</span>
          {context.attention.level !== "not_assessed" && (
            <StatusBadge
              status={attentionTone(context.attention.level)}
              label={ATTENTION_LABEL[context.attention.level]}
            />
          )}
        </div>
        <div className={styles.collapsedBody}>
          <div className={styles.collapsedText}>
            <p className={styles.collapsedIdentity}>
              Core Anchor {revisionLabel(core.confirmed_revision_number)} ·{" "}
              {contextStateLabel(core.lifecycle_state)}
            </p>
            <p
              className={styles.collapsedDirection}
              title={direction ?? undefined}
            >
              {direction ?? "No concise direction is available yet."}
            </p>
          </div>
          <button
            type="button"
            className={styles.reopenButton}
            aria-expanded={false}
            aria-controls={contentId}
            onClick={toggleExpanded}
          >
            <span>Show anchor context</span>
            <span className={styles.reopenChevron} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      className={styles.layer}
      aria-label="Anchor context"
      id={contentId}
    >
      <span className={styles.kicker}>
        <Icon name="core-anchor" size="region" />
        Anchor context
      </span>
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
            {upstream && <StatusBadge status="attention" label={upstream} />}
          </div>
          <button
            type="button"
            className={styles.disclosureButton}
            aria-expanded={true}
            aria-controls={contentId}
            onClick={toggleExpanded}
          >
            <span>Collapse anchor context</span>
            <span className={styles.chevron} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.expanded}>
        <div>
          <span className={styles.eyebrow}>Must preserve</span>
          <p>
            {core.must_preserve ?? "No concise must-preserve item is recorded."}
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
            {context.attention.summary ?? context.attention.review_requirement}
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
          <span className={styles.eyebrow}>Current production context</span>
          <p>
            {context.current_version.name
              ? `${context.current_version.name}${context.current_version.version_number ? ` · v${context.current_version.version_number}` : ""}`
              : "No current Production Version is recorded."}
          </p>
          {context.role === "artist" && (
            <small>Guidance: {GUIDANCE_LABEL[context.guidance_state]}</small>
          )}
        </div>
        {hasContextLinks && (
          <div className={styles.contextLinks}>
            <span className={styles.eyebrow}>Related context</span>
            {core.link_target && context.role === "vfx_supervisor" && (
              <Link href={core.link_target}>Open Intent →</Link>
            )}
            {context.attention.link_target && (
              <Link href={context.attention.link_target}>Open Alignment →</Link>
            )}
            {execution?.link_target && context.role === "cg_supervisor" && (
              <Link href={execution.link_target}>Open Execution →</Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
