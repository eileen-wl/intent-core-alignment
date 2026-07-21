"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  AlignmentAssessmentRead,
  AlignmentState,
  CoreAnchorRevisionRead,
  DecisionRead,
  HumanRole,
  ReviewNoteRead,
  VersionRead,
} from "@intent-core/contracts";

import {
  ApiError,
  acceptAlignmentAssessment,
  describeError,
  generateAlignmentAssessment,
  getVersion,
  listCoreAnchorRevisions,
  listDecisionsForAssessment,
  listReviewNotesForVersion,
  listAssessmentsForVersion,
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
  const [reviewNotes, coreAnchorRevisions, assessments] = await Promise.all([
    listReviewNotesForVersion(versionId),
    listCoreAnchorRevisions(shotId),
    listAssessmentsForVersion(versionId),
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

  const { version, reviewNotes, coreAnchorRevisions, assessments } = state.data;
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
