import type {
  HumanRole,
  IntentSignalDriver,
  IntentSignalRead,
} from "@intent-core/contracts";

/** Frontend display view model for "why is there nothing to show" --
 * not a persisted type. An `IntentSignalRead` only ever exists after a
 * successful Cross-role Assessment, so the reasons a caller has
 * nothing to render (no assessment ever run, the latest attempt
 * failed, or the data simply isn't available yet) are not fields on
 * the domain object itself -- they come from combining an `AgentRun`
 * status with the presence/absence of a persisted signal. Every Intent
 * Signal component in this family takes this union instead of a bare
 * `IntentSignalRead | null` so all six presentation levels share one
 * honest state model. */
export type IntentSignalAvailability =
  | { status: "available"; signal: IntentSignalRead }
  | { status: "no-assessment" }
  | { status: "generation-failed" }
  | { status: "unavailable" };

/** Generic, role-agnostic wording -- matches the persisted `label`
 * field's three values 1:1 (low_attention / attention_needed /
 * human_review_required from `derive_intent_signal` in
 * cross_role_assessment_service.py), rendered as human-readable text.
 * Used wherever a signal is shown without a specific viewing role (the
 * global indicator, list-row badges). */
const LEVEL_WORDING: Record<IntentSignalRead["attention_level"], string> = {
  low: "Low attention",
  medium: "Attention needed",
  high: "Human review required",
};

export function intentSignalLevelWording(
  level: IntentSignalRead["attention_level"],
): string {
  return LEVEL_WORDING[level];
}

/** Role-specific framing per docs/step-7/02_STEP_7A1_...md §10, used
 * only when the signal actually carries attention (medium or high).
 * At "low" attention there is nothing for a role to act on, so every
 * role falls back to the neutral level wording instead of an action
 * phrase -- showing e.g. "Execution clarification required" when
 * nothing actually needs clarifying would misrepresent the signal.
 * This is a frontend presentation mapping only: the persisted
 * IntentSignal remains one object regardless of viewing role
 * (docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md §8). */
const ROLE_ACTION_WORDING: Record<HumanRole, string> = {
  vfx_supervisor: "Human review required",
  cg_supervisor: "Execution clarification required",
  artist: "Supervisor clarification pending",
};

export function intentSignalRoleWording(
  role: HumanRole,
  level: IntentSignalRead["attention_level"],
): string {
  return level === "low" ? LEVEL_WORDING.low : ROLE_ACTION_WORDING[role];
}

/** Visual tone for the shared `StatusBadge` -- "low" never reads as an
 * attention state; "medium" and "high" both read as attention, and are
 * distinguished from each other by wording text, not badge tone alone. */
export function intentSignalStatusTone(
  level: IntentSignalRead["attention_level"],
): "neutral" | "attention" {
  return level === "low" ? "neutral" : "attention";
}

/** Human-readable label for each `IntentSignalDriver.code` value. */
const DRIVER_CODE_LABEL: Record<IntentSignalDriver["code"], string> = {
  cross_role_tension: "Cross-role tension",
  local_optimum_risk: "Local-optimum risk",
  unresolved_dependency: "Unresolved dependency",
  anchor_clarity_gap: "Anchor clarity gap",
  missing_evidence: "Missing evidence",
};

export function intentSignalDriverCodeLabel(
  code: IntentSignalDriver["code"],
): string {
  return DRIVER_CODE_LABEL[code];
}
