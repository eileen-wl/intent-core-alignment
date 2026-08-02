import {
  excerptText,
  type WorkingDirectionItem,
  type WorkingDirectionSection,
} from "@/lib/workingDirection";
import { signalStateLabel } from "@/app/vfx/vfxWording";
import type { ShotOverviewData } from "./data";

/** Step 9B-1: pure, deterministic selector -- explicit input
 * (`ShotOverviewData`, already fetched by `loadShotOverviewData`),
 * explicit output (`WorkingDirectionSection`), no I/O, no LLM call.
 * Never invents content: every item either cites a real object already
 * present on the input, or renders one of the honest fallback strings
 * below. A draft Core Anchor revision is never read here -- only
 * `confirmedCoreAnchorRevision`, which the loader itself guarantees is
 * `status === "confirmed"` or `null`. */
export function selectCurrentCreativeDirection(
  data: ShotOverviewData,
): WorkingDirectionSection {
  const shotId = data.item.shot_id;
  const revision = data.confirmedCoreAnchorRevision;

  const items: WorkingDirectionItem[] = [];

  items.push({
    id: "creative-objective",
    label: "Current creative objective",
    value: revision?.core_summary ?? "No confirmed Core Anchor yet.",
    // Owner-validation correction: an absent confirmed revision is a
    // current production state, never confirmed human direction -- no
    // authority badge renders for the fallback string.
    authority: revision ? "human-confirmed" : undefined,
    sourceType: "core_anchor_revision",
    sourceId: revision?.id,
    timestamp: revision?.confirmed_at ?? undefined,
    detail: revision
      ? formatConfirmedDetail("VFX Supervisor", data.confirmedDecisionRationale)
      : undefined,
    href: `/vfx/shots/${shotId}/intent`,
  });

  const hasConstraints = (revision?.constraints.length ?? 0) > 0;
  items.push({
    id: "must-remain-unchanged",
    label: "What must remain unchanged",
    value: revision
      ? joinOrFallback(
          revision.constraints.map((c) => c.content),
          "No Constraints recorded on the confirmed Core Anchor.",
        )
      : "No confirmed Core Anchor yet.",
    // A confirmed parent Core Anchor does not make an empty optional
    // child field (Constraints) confirmed content -- only the actual
    // recorded Constraints inherit Human-confirmed authority and
    // confirmation provenance.
    authority: hasConstraints ? "human-confirmed" : undefined,
    sourceType: "core_anchor_revision",
    sourceId: revision?.id,
    detail: hasConstraints ? "Confirmed by VFX Supervisor" : undefined,
    href: `/vfx/shots/${shotId}/intent`,
  });

  const hasVariationZones = (revision?.variation_zones.length ?? 0) > 0;
  items.push({
    id: "may-vary",
    label: "What may vary",
    value: revision
      ? joinOrFallback(
          revision.variation_zones.map((v) => v.content),
          "No Variation Zones recorded on the confirmed Core Anchor.",
        )
      : "No confirmed Core Anchor yet.",
    authority: hasVariationZones ? "human-confirmed" : undefined,
    sourceType: "core_anchor_revision",
    sourceId: revision?.id,
    detail: hasVariationZones ? "Confirmed by VFX Supervisor" : undefined,
    href: `/vfx/shots/${shotId}/intent`,
  });

  items.push({
    id: "current-risk",
    label: "Current alignment / drift risk",
    value: data.item.latest_signal_id
      ? `${signalStateLabel(data.item.latest_signal_attention_level)} -- ${excerptText(data.item.latest_signal_summary ?? "")}`
      : "No current Intent Signal. A successful Cross-role Assessment is required.",
    // No Intent Signal is an honest absence, not an Agent interpretation
    // of "aligned" -- omit the badge rather than imply one exists.
    authority: data.item.latest_signal_id ? "ai-interpretation" : undefined,
    sourceType: "cross_role_assessment",
    sourceId: data.currentAssessment?.id,
    timestamp: data.currentAssessment?.created_at,
    detail: data.item.latest_signal_id ? "Agent assessment" : undefined,
    href: `/vfx/shots/${shotId}/alignment`,
  });

  items.push({
    id: "latest-feedback",
    label: "Latest meaningful production feedback",
    value: data.latestReviewNote
      ? excerptText(data.latestReviewNote.content)
      : "No new feedback.",
    authority: "production-fact",
    sourceType: "review_note",
    sourceId: data.latestReviewNote?.id,
    timestamp: data.latestReviewNote?.created_at,
    detail: data.latestVersion
      ? `From ${data.latestVersion.name}${
          data.latestVersion.version_number
            ? ` (v${data.latestVersion.version_number})`
            : ""
        }`
      : undefined,
    href: `/vfx/shots/${shotId}/versions`,
  });

  const focus = data.item.current_focus;
  items.push({
    id: "next-action",
    label: "What needs your decision next",
    value: focus.actionable
      ? focus.title
      : "Nothing requires your attention on this Shot right now.",
    authority: focus.actionable ? "human-review-required" : "production-fact",
    sourceType: "current_focus",
    detail: focus.actionable ? "Derived current focus" : undefined,
    href: focus.actionable ? focus.target_route : undefined,
  });

  items.push({
    id: "cg-artist-escalation",
    label: "When CG / Artist issues need VFX intervention",
    value:
      data.item.open_cg_escalation_summary ??
      "No escalation from CG or Artist currently requires your attention.",
    authority: "production-fact",
    sourceType: "task_dependency",
    sourceId: data.item.open_cg_escalation_task_id ?? undefined,
    detail: data.item.open_cg_escalation_task_name
      ? `From ${data.item.open_cg_escalation_task_name}`
      : undefined,
    href: data.item.open_cg_escalation_task_id
      ? `/vfx/shots/${shotId}/alignment`
      : undefined,
  });

  return { title: "Current Creative Direction", items };
}

function formatConfirmedDetail(role: string, rationale: string | null): string {
  return rationale
    ? `Confirmed by ${role} -- ${rationale}`
    : `Confirmed by ${role}`;
}

function joinOrFallback(values: string[], fallback: string): string {
  return values.length === 0 ? fallback : values.join("; ");
}
