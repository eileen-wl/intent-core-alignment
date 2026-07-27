"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  AlignmentAssessmentRead,
  AlignmentState,
  ArtistAgentGuidanceRead,
  ArtistEvidenceReference,
  ArtistGuidanceItem,
  CoreAnchorRevisionRead,
  DecisionRead,
  HumanRole,
  ReviewNoteRead,
  TaskRead,
  VersionRead,
  VFXReviewEvidenceReference,
  VFXReviewItem,
  VFXSupervisorReviewRead,
} from "@intent-core/contracts";

import {
  ApiError,
  acceptAlignmentAssessment,
  describeError,
  generateAlignmentAssessment,
  generateArtistAgentGuidance,
  generateVfxSupervisorReview,
  getVersion,
  listArtistAgentGuidancesForVersion,
  listCoreAnchorRevisions,
  listDecisionsForAssessment,
  listReviewNotesForVersion,
  listAssessmentsForVersion,
  listTasksForShot,
  listVfxSupervisorReviewsForVersion,
  rejectAlignmentAssessment,
} from "@/lib/api";
import { ActorSelector } from "@/components/ActorSelector";
import { AgentProvenanceDetails } from "@/components/AgentProvenanceDetails";

/** The shape of `AlignmentAssessmentRead.envelope` -- a `dict[str, Any]`
 * on the backend (deliberately reused from AgentOutputEnvelope, see
 * packages/contracts/python/.../alignment_assessment.py), so the
 * generated TS type is just `{ [key: string]: unknown }`. This local
 * interface documents the actual fields without inventing a new backend
 * contract. */
interface AssessmentEnvelope {
  summary: string;
  observations: string[];
  inferences: string[];
  evidence: string[];
  confidence: number;
  open_questions: string[];
  recommended_actions: string[];
  requires_human_gate: boolean;
}

function envelopeOf(assessment: AlignmentAssessmentRead): AssessmentEnvelope {
  return assessment.envelope as unknown as AssessmentEnvelope;
}

const ALIGNMENT_STATE_LABELS: Record<AlignmentState, string> = {
  aligned: "Aligned",
  minor_drift: "Minor drift",
  significant_drift: "Significant drift",
};

function shortId(id: string): string {
  return id.slice(0, 8);
}

interface AssessmentData {
  assessment: AlignmentAssessmentRead;
  decisions: DecisionRead[];
}

interface VersionData {
  version: VersionRead;
  reviewNotes: ReviewNoteRead[];
  coreAnchorRevisions: CoreAnchorRevisionRead[];
  assessments: AssessmentData[];
  vfxSupervisorReviews: VFXSupervisorReviewRead[];
  artistAgentGuidances: ArtistAgentGuidanceRead[];
  tasksForShot: TaskRead[];
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; data: VersionData };

async function loadVersionData(
  shotId: string,
  versionId: string,
): Promise<VersionData> {
  const version = await getVersion(versionId);
  const [
    reviewNotes,
    coreAnchorRevisions,
    assessments,
    vfxSupervisorReviews,
    artistAgentGuidances,
    tasksForShot,
  ] = await Promise.all([
    listReviewNotesForVersion(versionId),
    listCoreAnchorRevisions(shotId),
    listAssessmentsForVersion(versionId),
    listVfxSupervisorReviewsForVersion(versionId),
    listArtistAgentGuidancesForVersion(versionId),
    listTasksForShot(shotId),
  ]);
  const assessmentData = await Promise.all(
    assessments.map(async (assessment) => ({
      assessment,
      decisions: await listDecisionsForAssessment(assessment.id),
    })),
  );
  return {
    version,
    reviewNotes,
    coreAnchorRevisions,
    assessments: assessmentData,
    vfxSupervisorReviews,
    artistAgentGuidances,
    tasksForShot,
  };
}

export function VersionPage({
  shotId,
  versionId,
}: {
  shotId: string;
  versionId: string;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [role, setRole] = useState<HumanRole>("vfx_supervisor");
  const [actorId, setActorId] = useState("vfx-1");

  const reload = useCallback(() => {
    setState({ status: "loading" });
    loadVersionData(shotId, versionId).then(
      (data) => setState({ status: "ready", data }),
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: "not-found" });
        } else {
          setState({ status: "error", message: describeError(err) });
        }
      },
    );
  }, [shotId, versionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (state.status === "loading") {
    return (
      <main>
        <p role="status">Loading version…</p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main>
        <h1>Version not found</h1>
        <p>No version exists with id {versionId}.</p>
        <p>
          <Link href={`/shots/${shotId}`}>← Back to shot</Link>
        </p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main>
        <h1>Something went wrong</h1>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={reload}>
          Retry
        </button>
      </main>
    );
  }

  const {
    version,
    reviewNotes,
    coreAnchorRevisions,
    assessments,
    vfxSupervisorReviews,
    artistAgentGuidances,
    tasksForShot,
  } = state.data;
  const confirmedRevision =
    coreAnchorRevisions.find((r) => r.status === "confirmed") ?? null;
  const actor = { role, actorId };

  // Cross-reference every Decision currently loaded on this page (across
  // all Assessments) to find which ones have already been superseded by
  // another loaded Decision -- Step 4d item 6 deliberately scopes this to
  // "Assessments currently loaded on this Version page", not a Shot-wide
  // decision API.
  const supersededDecisionIds = new Set<string>();
  for (const { decisions } of assessments) {
    for (const decision of decisions) {
      if (decision.supersedes_decision_id) {
        supersededDecisionIds.add(decision.supersedes_decision_id);
      }
    }
  }

  return (
    <main>
      <p>
        <Link href={`/shots/${shotId}`}>← Back to shot</Link>
      </p>
      <h1>
        {version.name}{" "}
        {version.version_number != null && (
          <small>v{version.version_number}</small>
        )}{" "}
        <small>({version.source})</small>
      </h1>
      <p>{version.description}</p>

      <section aria-label="Confirmed Core Anchor">
        <h2>Confirmed Core Anchor</h2>
        {confirmedRevision ? (
          <p>
            Revision #{confirmedRevision.revision_number} —{" "}
            {confirmedRevision.core_summary ?? "(no summary)"}
          </p>
        ) : (
          <p>No confirmed Core Anchor yet for this shot.</p>
        )}
        <p>
          <Link href={`/shots/${shotId}`}>View Shot Anchor page</Link>
        </p>
      </section>

      <section aria-label="Review notes">
        <h2>Review notes</h2>
        {reviewNotes.length === 0 ? (
          <p>No review notes yet.</p>
        ) : (
          <ul>
            {reviewNotes.map((note) => (
              <li key={note.id}>
                <p>{note.content}</p>
                <p>
                  <small>
                    {note.created_by_human_role ?? note.created_by_actor_kind} —{" "}
                    {note.created_at}
                  </small>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActorSelector
        role={role}
        actorId={actorId}
        onRoleChange={setRole}
        onActorIdChange={setActorId}
      />

      <section aria-label="Alignment assessments">
        <h2>Alignment assessments</h2>
        <GenerateAssessmentButton versionId={versionId} onGenerated={reload} />
        {assessments.length === 0 ? (
          <p>No alignment assessments generated yet.</p>
        ) : (
          assessments.map(({ assessment, decisions }) => (
            <AssessmentCard
              key={assessment.id}
              assessment={assessment}
              decisions={decisions}
              supersededDecisionIds={supersededDecisionIds}
              coreAnchorRevisions={coreAnchorRevisions}
              actor={actor}
              onDecided={reload}
            />
          ))
        )}
      </section>

      <section aria-label="VFX Supervisor Agent review">
        <h2>VFX Supervisor Agent review</h2>
        <p>
          <small>
            AI creative review — VFX Supervisor Agent. Advisory only: this Agent
            has not visually inspected any media for this Version -- its review
            is based solely on recorded text metadata and existing evidence.
          </small>
        </p>
        {actor.role === "vfx_supervisor" && (
          <GenerateVfxSupervisorReviewButton
            versionId={versionId}
            actor={actor}
            onGenerated={reload}
          />
        )}
        {vfxSupervisorReviews.length === 0 ? (
          <p>No VFX Supervisor Agent reviews generated yet.</p>
        ) : (
          vfxSupervisorReviews.map((review) => (
            <VfxSupervisorReviewCard key={review.id} review={review} />
          ))
        )}
      </section>

      <section aria-label="AI iteration guidance — Artist Agent">
        <h2>AI iteration guidance — Artist Agent</h2>
        <p>
          <small>
            This guidance is based on recorded text metadata only -- it does not
            visually inspect footage, renders, or scene files. Human supervisors
            retain authority.
          </small>
        </p>
        {actor.role === "artist" && (
          <GenerateArtistAgentGuidancePanel
            versionId={versionId}
            tasksForShot={tasksForShot}
            actor={actor}
            onGenerated={reload}
          />
        )}
        {artistAgentGuidances.length === 0 ? (
          <p>No Artist Agent guidance generated yet.</p>
        ) : (
          artistAgentGuidances.map((guidance) => (
            <ArtistAgentGuidanceCard key={guidance.id} guidance={guidance} />
          ))
        )}
      </section>
    </main>
  );
}

function GenerateAssessmentButton({
  versionId,
  onGenerated,
}: {
  versionId: string;
  onGenerated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      await generateAlignmentAssessment(versionId);
      onGenerated();
    } catch (err) {
      setError(describeError(err));
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? "Generating…" : "Generate Alignment Assessment"}
      </button>
      <p>
        <small>
          Advisory only — generating an assessment does not make a production
          decision. A VFX Supervisor still has to accept or reject it below.
        </small>
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function AlignmentStateBadge({ state }: { state: AlignmentState }) {
  return (
    <span data-alignment-state={state}>[{ALIGNMENT_STATE_LABELS[state]}]</span>
  );
}

function AssessmentCard({
  assessment,
  decisions,
  supersededDecisionIds,
  coreAnchorRevisions,
  actor,
  onDecided,
}: {
  assessment: AlignmentAssessmentRead;
  decisions: DecisionRead[];
  supersededDecisionIds: Set<string>;
  coreAnchorRevisions: CoreAnchorRevisionRead[];
  actor: { role: HumanRole; actorId: string };
  onDecided: () => void;
}) {
  const envelope = envelopeOf(assessment);
  const linkedRevision =
    coreAnchorRevisions.find(
      (r) => r.id === assessment.core_anchor_revision_id,
    ) ?? null;

  return (
    <article aria-label={`Assessment ${assessment.id}`}>
      <h3>
        <AlignmentStateBadge state={assessment.alignment_state} />
      </h3>
      <p>{envelope.summary}</p>

      <EnvelopeList label="Observations" items={envelope.observations} />
      <EnvelopeList label="Inferences" items={envelope.inferences} />
      <EnvelopeList label="Evidence" items={envelope.evidence} />
      <EnvelopeList label="Open questions" items={envelope.open_questions} />
      <EnvelopeList
        label="Recommended actions"
        items={envelope.recommended_actions}
      />

      <dl>
        <div>
          <dt>Confidence</dt>
          <dd>{envelope.confidence}</dd>
        </div>
        <div>
          <dt>Requires human gate</dt>
          <dd>{envelope.requires_human_gate ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{assessment.created_at}</dd>
        </div>
        <div>
          <dt>Linked confirmed Core Anchor revision</dt>
          <dd>
            {linkedRevision
              ? `#${linkedRevision.revision_number}`
              : assessment.core_anchor_revision_id}
          </dd>
        </div>
        <div>
          <dt>Agent run</dt>
          <dd>
            {assessment.agent_run_id}
            <AgentProvenanceDetails
              agentRunId={assessment.agent_run_id}
              contextSnapshotId={assessment.context_snapshot_id}
              showAgentType
            />
          </dd>
        </div>
        <div>
          <dt>Context snapshot</dt>
          <dd>{assessment.context_snapshot_id}</dd>
        </div>
      </dl>

      <AssessmentDecisionPanel
        assessment={assessment}
        decisions={decisions}
        supersededDecisionIds={supersededDecisionIds}
        actor={actor}
        onDecided={onDecided}
      />
    </article>
  );
}

function EnvelopeList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>
          <small>None.</small>
        </p>
      ) : (
        <ul>
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- these
            // strings have no stable id and are never reordered in place
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssessmentDecisionPanel({
  assessment,
  decisions,
  supersededDecisionIds,
  actor,
  onDecided,
}: {
  assessment: AlignmentAssessmentRead;
  decisions: DecisionRead[];
  supersededDecisionIds: Set<string>;
  actor: { role: HumanRole; actorId: string };
  onDecided: () => void;
}) {
  const [rationale, setRationale] = useState("");
  const [pending, setPending] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canAct = actor.role === "vfx_supervisor";

  async function handleAccept() {
    setPending("accept");
    setError(null);
    try {
      await acceptAlignmentAssessment(
        assessment.id,
        { rationale: rationale || null },
        actor,
      );
      onDecided();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  async function handleReject() {
    setPending("reject");
    setError(null);
    try {
      await rejectAlignmentAssessment(
        assessment.id,
        { rationale: rationale || null },
        actor,
      );
      onDecided();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  if (decisions.length === 0) {
    return (
      <section
        aria-label={`Alignment Assessment Human Review Gate ${assessment.id}`}
      >
        <h4>Alignment Assessment Human Review Gate</h4>
        <p>
          Acting as: {actor.role} ({actor.actorId})
        </p>
        {!canAct && (
          <p>
            <small>
              Only a VFX Supervisor can accept or reject this assessment.
            </small>
          </p>
        )}
        <label htmlFor={`rationale-${assessment.id}`}>
          Decision rationale (optional)
        </label>
        <textarea
          id={`rationale-${assessment.id}`}
          value={rationale}
          disabled={!canAct}
          onChange={(e) => setRationale(e.target.value)}
        />
        <div>
          <button
            type="button"
            disabled={!canAct || pending !== null}
            onClick={() => void handleAccept()}
          >
            {pending === "accept" ? "Accepting…" : "Accept"}
          </button>{" "}
          <button
            type="button"
            disabled={!canAct || pending !== null}
            onClick={() => void handleReject()}
          >
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section aria-label={`Decisions for assessment ${assessment.id}`}>
      <h4>Decisions</h4>
      <ul>
        {decisions.map((decision) => (
          <li key={decision.id}>
            <strong>
              {decision.decision_type === "accept_alignment_assessment"
                ? "Accepted"
                : "Rejected"}
            </strong>{" "}
            by {decision.actor_human_role ?? decision.actor_kind} (
            {decision.actor_id})
            {decision.rationale && <> — {decision.rationale}</>}
            <br />
            <small>{decision.created_at}</small>
            {supersededDecisionIds.has(decision.id) && (
              <p>Superseded by a later decision</p>
            )}
            {decision.supersedes_decision_id && (
              <p>
                Supersedes decision {shortId(decision.supersedes_decision_id)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GenerateVfxSupervisorReviewButton({
  versionId,
  actor,
  onGenerated,
}: {
  versionId: string;
  actor: { role: HumanRole; actorId: string };
  onGenerated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      await generateVfxSupervisorReview(versionId, actor);
      onGenerated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? "Generating…" : "Generate VFX Supervisor review"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function EvidenceList({
  evidence,
}: {
  evidence: VFXReviewEvidenceReference[];
}) {
  return (
    <ul>
      {evidence.map((ref, index) => (
        // eslint-disable-next-line react/no-array-index-key -- evidence
        // references have no stable id of their own and are never
        // reordered in place
        <li key={index}>
          <small>
            {ref.label} ({ref.source_type}: {shortId(ref.source_id)})
          </small>
        </li>
      ))}
    </ul>
  );
}

function ReviewItemView({ item }: { item: VFXReviewItem }) {
  return (
    <li>
      <p>
        {item.summary} <em data-priority={item.priority}>[{item.priority}]</em>
      </p>
      <p>
        <small>{item.rationale}</small>
      </p>
      <EvidenceList evidence={item.evidence} />
    </li>
  );
}

function ReviewItemList({
  label,
  items,
}: {
  label: string;
  items: VFXReviewItem[];
}) {
  return (
    <div>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>
          <small>None.</small>
        </p>
      ) : (
        <ul>
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- these
            // items have no stable id of their own and are never
            // reordered in place
            <ReviewItemView key={index} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StringList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>
          <small>None.</small>
        </p>
      ) : (
        <ul>
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- these
            // strings have no stable id and are never reordered in place
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VfxSupervisorReviewCard({
  review,
}: {
  review: VFXSupervisorReviewRead;
}) {
  const output = review.review_output;

  return (
    <article aria-label={`VFX Supervisor review ${review.id}`}>
      <p>{output.executive_summary}</p>

      <div>
        <h4>Creative direction read</h4>
        <ReviewItemView item={output.creative_direction_read} />
      </div>

      <ReviewItemList label="Strengths" items={output.strengths} />
      <ReviewItemList
        label="Creative concerns"
        items={output.creative_concerns}
      />
      <ReviewItemList
        label="Review priorities"
        items={output.review_priorities}
      />

      <div>
        <h4>Proposed feedback notes</h4>
        {output.proposed_feedback_notes.length === 0 ? (
          <p>
            <small>None.</small>
          </p>
        ) : (
          <ul>
            {output.proposed_feedback_notes.map((note, index) => (
              // eslint-disable-next-line react/no-array-index-key -- these
              // notes have no stable id of their own and are never
              // reordered in place
              <li key={index}>
                <p>
                  <strong>Feedback:</strong> {note.feedback}{" "}
                  <em data-priority={note.priority}>[{note.priority}]</em>
                </p>
                <p>
                  <strong>Why it matters:</strong> {note.underlying_intent}
                </p>
                <EvidenceList evidence={note.evidence} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <StringList
        label="Questions for Human Supervisor"
        items={output.questions_for_human_supervisor}
      />
      <StringList label="Evidence gaps" items={output.evidence_gaps} />

      <dl>
        <div>
          <dt>Created</dt>
          <dd>{review.created_at}</dd>
        </div>
        <div>
          <dt>Agent run</dt>
          <dd>
            {review.agent_run_id}
            <AgentProvenanceDetails
              agentRunId={review.agent_run_id}
              contextSnapshotId={review.context_snapshot_id}
              showAgentType
            />
          </dd>
        </div>
        <div>
          <dt>Context snapshot</dt>
          <dd>{review.context_snapshot_id}</dd>
        </div>
      </dl>
    </article>
  );
}

function GenerateArtistAgentGuidancePanel({
  versionId,
  tasksForShot,
  actor,
  onGenerated,
}: {
  versionId: string;
  tasksForShot: TaskRead[];
  actor: { role: HumanRole; actorId: string };
  onGenerated: () => void;
}) {
  const [taskId, setTaskId] = useState(tasksForShot[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      await generateArtistAgentGuidance(versionId, { task_id: taskId }, actor);
      onGenerated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  if (tasksForShot.length === 0) {
    return (
      <p>
        <small>
          No Tasks exist yet for this Shot -- Artist Agent guidance requires a
          Task with a confirmed Execution Anchor.
        </small>
      </p>
    );
  }

  return (
    <div>
      <label htmlFor="artist-guidance-task">Task</label>{" "}
      <select
        id="artist-guidance-task"
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        {tasksForShot.map((task) => (
          <option key={task.id} value={task.id}>
            {task.name}
            {task.department ? ` (${task.department})` : ""}
          </option>
        ))}
      </select>{" "}
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? "Generating…" : "Generate Artist guidance"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function ArtistEvidenceList({
  evidence,
}: {
  evidence: ArtistEvidenceReference[];
}) {
  return (
    <ul>
      {evidence.map((ref, index) => (
        // eslint-disable-next-line react/no-array-index-key -- evidence
        // references have no stable id of their own and are never
        // reordered in place
        <li key={index}>
          <small>
            {ref.label} ({ref.source_type}: {shortId(ref.source_id)})
          </small>
        </li>
      ))}
    </ul>
  );
}

function ArtistItemView({ item }: { item: ArtistGuidanceItem }) {
  return (
    <li>
      <p>
        {item.summary} <em data-priority={item.priority}>[{item.priority}]</em>
      </p>
      <p>
        <small>{item.why_it_matters}</small>
      </p>
      <ArtistEvidenceList evidence={item.evidence} />
    </li>
  );
}

function ArtistItemList({
  label,
  items,
}: {
  label: string;
  items: ArtistGuidanceItem[];
}) {
  return (
    <div>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>
          <small>None.</small>
        </p>
      ) : (
        <ul>
          {items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- these
            // items have no stable id of their own and are never
            // reordered in place
            <ArtistItemView key={index} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArtistAgentGuidanceCard({
  guidance,
}: {
  guidance: ArtistAgentGuidanceRead;
}) {
  const output = guidance.guidance_output;

  return (
    <article aria-label={`Artist Agent guidance ${guidance.id}`}>
      <p>{output.executive_summary}</p>

      <div>
        <h4>Creative intent read</h4>
        <ArtistItemView item={output.creative_intent_read} />
      </div>

      <div>
        <h4>Task goal</h4>
        <ArtistItemView item={output.task_goal} />
      </div>

      <div>
        <h4>Current iteration read</h4>
        <ArtistItemView item={output.current_iteration_read} />
      </div>

      <ArtistItemList label="Non-negotiables" items={output.non_negotiables} />
      <ArtistItemList
        label="Allowed variations"
        items={output.allowed_variations}
      />

      <div>
        <h4>Feedback translations</h4>
        {output.feedback_translations.length === 0 ? (
          <p>
            <small>None.</small>
          </p>
        ) : (
          <ul>
            {output.feedback_translations.map((translation, index) => (
              // eslint-disable-next-line react/no-array-index-key -- these
              // translations have no stable id of their own and are never
              // reordered in place
              <li key={index}>
                <p>
                  <strong>Feedback/issue:</strong>{" "}
                  {translation.feedback_or_issue}{" "}
                  <em data-priority={translation.priority}>
                    [{translation.priority}]
                  </em>
                </p>
                <p>
                  <strong>Practical action:</strong>{" "}
                  {translation.practical_action}
                </p>
                <p>
                  <strong>Why it matters:</strong>{" "}
                  {translation.underlying_intent}
                </p>
                <p>
                  <strong>Self-check:</strong> {translation.self_check}
                </p>
                <ArtistEvidenceList evidence={translation.evidence} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ArtistItemList
        label="Iteration priorities"
        items={output.iteration_priorities}
      />
      <ArtistItemList
        label="Cross-department dependencies"
        items={output.cross_department_dependencies}
      />

      <StringList
        label="Questions for Human Supervisor"
        items={output.questions_for_human_supervisor}
      />
      <StringList label="Evidence gaps" items={output.evidence_gaps} />

      <dl>
        <div>
          <dt>Created</dt>
          <dd>{guidance.created_at}</dd>
        </div>
        <div>
          <dt>Agent run</dt>
          <dd>
            {guidance.agent_run_id}
            <AgentProvenanceDetails
              agentRunId={guidance.agent_run_id}
              contextSnapshotId={guidance.context_snapshot_id}
              showAgentType
            />
          </dd>
        </div>
        <div>
          <dt>Context snapshot</dt>
          <dd>{guidance.context_snapshot_id}</dd>
        </div>
      </dl>
    </article>
  );
}
