/** A structural shape shared by `CrossRoleEvidenceReference`,
 * `VFXReviewEvidenceReference`, `CGReviewEvidenceReference`, and
 * `ArtistEvidenceReference` -- all four contracts already have exactly
 * this `{source_type, source_id, label}` shape (the literal unions
 * differ slightly per capability), so one component family covers all
 * four evidence-reference kinds rather than four near-duplicates. Any
 * of those real contract types is assignable here without a cast. */
export interface EvidenceReferenceLike {
  source_type: string;
  source_id: string;
  label: string;
}

/** Known source types across every evidence-reference contract in the
 * repository. Anything not listed still renders (via the fallback in
 * `humanizeSourceType`) rather than being hidden -- this list is a
 * display convenience, not a validation gate. */
const KNOWN_SOURCE_TYPE_LABEL: Record<string, string> = {
  intent_brief: "Intent Brief",
  intent_decomposition: "Intent Decomposition",
  core_anchor_revision: "Core Anchor revision",
  execution_anchor_revision: "Execution Anchor revision",
  constraint: "Constraint",
  variation_zone: "Variation zone",
  drift_risk: "Drift risk",
  open_question: "Open question",
  context_reconstruction: "Context reconstruction",
  anchor_reference: "Anchor reference",
  alignment_assessment: "Alignment assessment",
  vfx_supervisor_review: "VFX Supervisor review",
  cg_supervisor_review: "CG Supervisor review",
  artist_agent_guidance: "Artist Agent guidance",
  version: "Version",
  review_note: "Review note",
  decision: "Decision",
  task: "Task",
  shot: "Shot",
};

export function humanizeSourceType(sourceType: string): string {
  const known = KNOWN_SOURCE_TYPE_LABEL[sourceType];
  if (known) return known;
  return sourceType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
