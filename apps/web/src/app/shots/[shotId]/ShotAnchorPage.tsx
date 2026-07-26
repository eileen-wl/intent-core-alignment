"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
  DecisionRead,
  ExecutionAnchorRead,
  ExecutionAnchorRevisionRead,
  HumanRole,
  IntentBriefRead,
  IntentDecompositionDimensions,
  IntentDecompositionRead,
  ShotRead,
  TaskRead,
  VersionRead,
} from "@intent-core/contracts";

import {
  ApiError,
  confirmCoreAnchorRevision,
  createCoreAnchorDraftFromDecomposition,
  describeError,
  generateCoreAnchorDraft,
  generateIntentDecomposition,
  getCoreAnchor,
  getExecutionAnchor,
  getExecutionAnchorRevision,
  getShot,
  listBriefsForShot,
  listCoreAnchorRevisions,
  listDecisionsForRevision,
  listIntentDecompositionsForShot,
  listTasks,
  listVersionsForShot,
  rejectCoreAnchorRevision,
  updateCoreAnchorRevision,
} from "@/lib/api";
import { ActorSelector } from "@/components/ActorSelector";
import { AgentProvenanceDetails } from "@/components/AgentProvenanceDetails";

const CORE_ANCHOR_FIELDS = [
  ["shot_objective", "Shot objective"],
  ["emotional_tone", "Emotional tone"],
  ["visual_focus", "Visual focus"],
  ["rhythm_intensity", "Rhythm & intensity"],
  ["character_relationship", "Character relationship"],
  ["narrative_priority", "Narrative priority"],
  ["core_summary", "Core summary"],
] as const;

type CoreAnchorField = (typeof CORE_ANCHOR_FIELDS)[number][0];

// Matches the actor ids already used by convention across this repository's
// own backend tests (e.g. apps/api/tests/test_core_anchor_draft_update.py's
// VFX/CG/ARTIST header constants) -- not a new identity system, just the
// same default per role reused here.
const ROLE_DEFAULT_ACTOR_IDS: Record<HumanRole, string> = {
  vfx_supervisor: "vfx-1",
  cg_supervisor: "cg-1",
  artist: "artist-1",
};

// Step 1A-UI: the five Core Anchor semantic-child collections already
// implemented backend-side (migration 0014). Fixed product meaning --
// these labels are the only UI-facing names for these collections.
type AnchorReferenceReadItem = CoreAnchorRevisionRead["references"][number];

interface ReferenceFormItem {
  label: string;
  uri: string;
  note: string;
}

function buildFieldsFromRevision(
  revision: CoreAnchorRevisionRead,
): Record<CoreAnchorField, string> {
  return Object.fromEntries(
    CORE_ANCHOR_FIELDS.map(([field]) => [field, revision[field] ?? ""]),
  ) as Record<CoreAnchorField, string>;
}

function buildReferenceFormItems(
  revision: CoreAnchorRevisionRead,
): ReferenceFormItem[] {
  return revision.references.map((r) => ({
    label: r.label,
    uri: r.uri ?? "",
    note: r.note ?? "",
  }));
}

function stringArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function referenceFormItemsEqual(
  a: ReferenceFormItem[],
  b: ReferenceFormItem[],
): boolean {
  return (
    a.length === b.length &&
    a.every(
      (item, i) =>
        item.label === b[i].label &&
        item.uri === b[i].uri &&
        item.note === b[i].note,
    )
  );
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function moveArrayItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  const temp = next[index];
  next[index] = next[target];
  next[target] = temp;
  return next;
}

// Step 1A-UI usability fixes: this app has no CSS module/Tailwind
// convention (see apps/web/src/app/globals.css) -- these are the smallest,
// most locally-scoped way to fix the verified readability issues (cramped
// textareas, controls crammed onto the text-field line, sections running
// together) without introducing a new styling approach or touching other
// pages.
const fieldRowStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
  marginBottom: "1rem",
};
const labelStyle = { fontWeight: 600 };
const scalarTextareaStyle = {
  width: "100%",
  minHeight: "4rem",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  fontSize: "1rem",
};
const itemWrapperStyle = {
  border: "1px solid #ccc",
  borderRadius: "4px",
  padding: "0.75rem",
  marginBottom: "0.75rem",
};
const itemFieldStyle = {
  width: "100%",
  minHeight: "3rem",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  fontSize: "1rem",
};
const itemInputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  fontSize: "1rem",
};
const itemControlsRowStyle = {
  display: "flex",
  gap: "0.5rem",
  marginTop: "0.5rem",
};
const sectionSpacingStyle = { marginTop: "1.5rem", marginBottom: "1.5rem" };

interface TaskAnchorInfo {
  task: TaskRead;
  executionAnchor: ExecutionAnchorRead | null;
  activeRevision: ExecutionAnchorRevisionRead | null;
}

interface ShotData {
  shot: ShotRead;
  briefs: IntentBriefRead[];
  intentDecompositions: IntentDecompositionRead[];
  coreAnchor: CoreAnchorRead | null;
  revisions: CoreAnchorRevisionRead[];
  confirmedRevisionDecision: DecisionRead | null;
  taskAnchors: TaskAnchorInfo[];
  versions: VersionRead[];
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ShotData };

interface LastDecision {
  type: "confirmed" | "rejected";
  revisionNumber: number;
  rationale: string | null;
}

async function loadTaskAnchor(task: TaskRead): Promise<TaskAnchorInfo> {
  const executionAnchor = await getExecutionAnchor(task.id);
  const activeRevision =
    executionAnchor?.active_revision_id != null
      ? await getExecutionAnchorRevision(executionAnchor.active_revision_id)
      : null;
  return { task, executionAnchor, activeRevision };
}

async function loadShotData(shotId: string): Promise<ShotData> {
  const shot = await getShot(shotId);
  const [briefs, intentDecompositions, coreAnchor, allTasks, versions] =
    await Promise.all([
      listBriefsForShot(shotId),
      listIntentDecompositionsForShot(shotId),
      getCoreAnchor(shotId),
      listTasks(),
      listVersionsForShot(shotId),
    ]);
  const revisions = coreAnchor ? await listCoreAnchorRevisions(shotId) : [];
  const confirmedRevision =
    revisions.find((r) => r.status === "confirmed") ?? null;
  const confirmedRevisionDecision = confirmedRevision
    ? ((await listDecisionsForRevision(confirmedRevision.id)).at(-1) ?? null)
    : null;
  const shotTasks = allTasks.filter((t) => t.shot_id === shotId);
  const taskAnchors = await Promise.all(shotTasks.map(loadTaskAnchor));
  return {
    shot,
    briefs,
    intentDecompositions,
    coreAnchor,
    revisions,
    confirmedRevisionDecision,
    taskAnchors,
    versions,
  };
}

export function ShotAnchorPage({ shotId }: { shotId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [role, setRole] = useState<HumanRole>("vfx_supervisor");
  const [actorId, setActorId] = useState("vfx-1");
  const [lastDecision, setLastDecision] = useState<LastDecision | null>(null);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    loadShotData(shotId).then(
      (data) => setState({ status: "ready", data }),
      (err: unknown) => {
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: "not-found" });
        } else {
          setState({ status: "error", message: describeError(err) });
        }
      },
    );
  }, [shotId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Smallest safe correction for the "stale actor id after a role switch"
  // usability issue: only replace the Actor id with the new role's default
  // when the field was empty or still held the *previous* role's default --
  // a manually-typed custom id is always preserved across a role change.
  function handleRoleChange(nextRole: HumanRole) {
    const previousDefault = ROLE_DEFAULT_ACTOR_IDS[role];
    if (actorId.trim() === "" || actorId === previousDefault) {
      setActorId(ROLE_DEFAULT_ACTOR_IDS[nextRole]);
    }
    setRole(nextRole);
  }

  function handleDecided(
    type: "confirmed" | "rejected",
    revisionNumber: number,
    rationale: string | null,
  ) {
    setLastDecision({ type, revisionNumber, rationale });
    reload();
  }

  if (state.status === "loading") {
    return (
      <main>
        <p role="status">Loading shot…</p>
      </main>
    );
  }

  if (state.status === "not-found") {
    return (
      <main>
        <h1>Shot not found</h1>
        <p>No shot exists with id {shotId}.</p>
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
    shot,
    briefs,
    intentDecompositions,
    coreAnchor,
    revisions,
    confirmedRevisionDecision,
    taskAnchors,
    versions,
  } = state.data;
  const latestBrief = briefs.length > 0 ? briefs[briefs.length - 1] : null;
  const confirmedRevision =
    revisions.find((r) => r.status === "confirmed") ?? null;
  const draftRevision =
    [...revisions].reverse().find((r) => r.status === "draft") ?? null;

  const actor = { role, actorId };

  // A newer Core revision being confirmed marks every currently-confirmed,
  // not-yet-stale Execution Anchor under this shot as stale (A2's cascade,
  // intent.execution_anchor_service.mark_stale_for_new_core_revision) --
  // only relevant if something is actually confirmed today.
  const wouldMakeExecutionAnchorsStale =
    confirmedRevision !== null &&
    taskAnchors.some(
      (info) =>
        info.executionAnchor !== null &&
        !info.executionAnchor.is_stale &&
        info.executionAnchor.active_revision_id != null,
    );

  return (
    <main>
      <p>
        <Link href="/shots">← All shots</Link>
      </p>
      <h1>
        {shot.name} <small>({shot.source})</small>
      </h1>

      <ActorSelector
        role={role}
        actorId={actorId}
        onRoleChange={handleRoleChange}
        onActorIdChange={setActorId}
      />

      {lastDecision && (
        <p role="status" data-decision={lastDecision.type}>
          {lastDecision.type === "confirmed" ? "Confirmed" : "Rejected"}{" "}
          revision #{lastDecision.revisionNumber}.
          {lastDecision.rationale
            ? ` Rationale: ${lastDecision.rationale}`
            : ""}
        </p>
      )}

      <section>
        <h2>Intent brief</h2>
        {latestBrief ? (
          <p>{latestBrief.raw_text}</p>
        ) : (
          <p>No intent brief yet.</p>
        )}
      </section>

      <IntentDecompositionSection
        shotId={shot.id}
        hasBrief={latestBrief !== null}
        hasDraft={draftRevision !== null}
        actor={actor}
        decompositions={intentDecompositions}
        onGenerated={reload}
        onApplied={reload}
      />

      <section>
        <h2>Core anchor</h2>
        {coreAnchor === null ? (
          <>
            <p>No Core Anchor yet for this shot.</p>
            <p>
              <small>
                Generate an intent decomposition above, then use it to create a
                Core Anchor draft.
              </small>
            </p>
            <details>
              <summary>
                Advanced: generate a draft directly, without a decomposition
              </summary>
              <GenerateDraftButton
                shotId={shot.id}
                hasBrief={latestBrief !== null}
                onGenerated={reload}
              />
            </details>
          </>
        ) : (
          <>
            {confirmedRevision && (
              <ConfirmedAnchorCard
                revision={confirmedRevision}
                decision={confirmedRevisionDecision}
              />
            )}
            {draftRevision ? (
              <CoreAnchorGate
                key={draftRevision.id}
                revision={draftRevision}
                actor={actor}
                showStaleWarning={wouldMakeExecutionAnchorsStale}
                onDecided={handleDecided}
              />
            ) : (
              <>
                <p>No draft revision awaiting review.</p>
                <details>
                  <summary>
                    Advanced: generate a draft directly, without a decomposition
                  </summary>
                  <GenerateDraftButton
                    shotId={shot.id}
                    hasBrief={latestBrief !== null}
                    onGenerated={reload}
                  />
                </details>
              </>
            )}
          </>
        )}
      </section>

      <section>
        <h2>Execution anchors</h2>
        {taskAnchors.length === 0 ? (
          <p>No tasks under this shot yet.</p>
        ) : (
          <ul>
            {taskAnchors.map((info) => (
              <TaskAnchorRow
                key={info.task.id}
                info={info}
                revisions={revisions}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Versions</h2>
        {versions.length === 0 ? (
          <p>No Versions yet.</p>
        ) : (
          <ul>
            {versions.map((version) => (
              <li key={version.id}>
                <Link href={`/shots/${shot.id}/versions/${version.id}`}>
                  {version.name}
                </Link>{" "}
                {version.version_number != null && (
                  <span>v{version.version_number} </span>
                )}
                <small>({version.source})</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function GenerateDraftButton({
  shotId,
  hasBrief,
  onGenerated,
}: {
  shotId: string;
  hasBrief: boolean;
  onGenerated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      await generateCoreAnchorDraft(shotId);
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
        disabled={!hasBrief || pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? "Generating…" : "Generate draft with Core Agent"}
      </button>
      {!hasBrief && (
        <p>
          <small>Add an Intent Brief first.</small>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: CoreAnchorRevisionRead["status"] }) {
  return <span data-status={status}>[{status}]</span>;
}

// Step 1B: Intent Decomposition -- a Core Agent AI proposal generated
// *before* Core Anchor drafting, reviewed by the Human VFX Supervisor, and
// optionally used to create a new Core Anchor draft (see
// agents/intent_decomposition_service.py and
// agents/core_agent_service.create_core_anchor_draft_from_decomposition).

const DIMENSION_LABELS: [keyof IntentDecompositionDimensions, string][] = [
  ["emotional_tone", "Emotional tone"],
  ["visual_focus", "Visual focus"],
  ["rhythm_and_intensity", "Rhythm & intensity"],
  ["character_relationships", "Character relationships"],
  ["narrative_priority", "Narrative priority"],
  ["technical_execution_requirements", "Technical execution requirements"],
  ["visual_detail_constraints", "Visual detail constraints"],
];

function DimensionsReadOnly({
  dimensions,
}: {
  dimensions: IntentDecompositionDimensions;
}) {
  return (
    <div style={sectionSpacingStyle}>
      <h4>Dimensions</h4>
      <dl>
        {DIMENSION_LABELS.map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>
              {dimensions[key].summary}
              <br />
              <small>{dimensions[key].rationale}</small>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StringListReadOnly({
  label,
  items,
}: {
  label: string;
  items: string[];
}) {
  return (
    <div style={sectionSpacingStyle}>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>None specified.</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GenerateDecompositionButton({
  shotId,
  hasBrief,
  actor,
  onGenerated,
}: {
  shotId: string;
  hasBrief: boolean;
  actor: { role: HumanRole; actorId: string };
  onGenerated: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      await generateIntentDecomposition(shotId, actor);
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
        disabled={!hasBrief || pending}
        onClick={() => void handleGenerate()}
      >
        {pending ? "Generating…" : "Generate intent decomposition"}
      </button>
      {!hasBrief && (
        <p>
          <small>Add an Intent Brief first.</small>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function UseInCoreAnchorDraftButton({
  decompositionId,
  actor,
  disabled,
  onApplied,
}: {
  decompositionId: string;
  actor: { role: HumanRole; actorId: string };
  disabled: boolean;
  onApplied: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setPending(true);
    setError(null);
    try {
      await createCoreAnchorDraftFromDecomposition(decompositionId, actor);
      onApplied();
    } catch (err) {
      setError(describeError(err));
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => void handleApply()}
      >
        {pending ? "Using…" : "Use in Core Anchor draft"}
      </button>
      {disabled && !pending && (
        <p>
          <small>
            A draft is already awaiting review. Confirm, reject, or edit it
            before applying a different decomposition.
          </small>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function IntentDecompositionCard({
  decomposition,
  actor,
  hasDraft,
  onApplied,
}: {
  decomposition: IntentDecompositionRead;
  actor: { role: HumanRole; actorId: string };
  hasDraft: boolean;
  onApplied: () => void;
}) {
  const canApply = actor.role === "vfx_supervisor";

  return (
    <article
      aria-label={`Intent decomposition ${shortId(decomposition.id)}`}
      style={itemWrapperStyle}
    >
      <p>
        <strong>AI proposal — Core Agent</strong>
      </p>
      <dl>
        <div>
          <dt>Core intent summary</dt>
          <dd>{decomposition.core_intent_summary}</dd>
        </div>
        <div>
          <dt>Anchor-relevant content</dt>
          <dd>{decomposition.anchor_relevant_content}</dd>
        </div>
      </dl>
      <DimensionsReadOnly dimensions={decomposition.dimensions} />
      <StringListReadOnly
        label="Candidate must preserve"
        items={decomposition.candidate_constraints}
      />
      <StringListReadOnly
        label="Candidate allowed variation"
        items={decomposition.candidate_variation_zones}
      />
      <StringListReadOnly
        label="Contextual information"
        items={decomposition.contextual_information}
      />
      <StringListReadOnly
        label="Uncertainties"
        items={decomposition.uncertainties}
      />
      <AgentProvenanceDetails
        agentRunId={decomposition.agent_run_id}
        contextSnapshotId={decomposition.context_snapshot_id}
      />
      {canApply && (
        <UseInCoreAnchorDraftButton
          decompositionId={decomposition.id}
          actor={actor}
          disabled={hasDraft}
          onApplied={onApplied}
        />
      )}
    </article>
  );
}

function IntentDecompositionSection({
  shotId,
  hasBrief,
  hasDraft,
  actor,
  decompositions,
  onGenerated,
  onApplied,
}: {
  shotId: string;
  hasBrief: boolean;
  hasDraft: boolean;
  actor: { role: HumanRole; actorId: string };
  decompositions: IntentDecompositionRead[];
  onGenerated: () => void;
  onApplied: () => void;
}) {
  const canGenerate = actor.role === "vfx_supervisor";

  return (
    <section aria-label="Intent decomposition">
      <h2>Intent decomposition</h2>
      <p>
        <small>
          A Core Agent AI proposal that structures the Intent Brief into
          Anchor-relevant content, generated before the Core Anchor is drafted.
          This is an AI proposal, not a Human Decision.
        </small>
      </p>
      {canGenerate ? (
        <GenerateDecompositionButton
          shotId={shotId}
          hasBrief={hasBrief}
          actor={actor}
          onGenerated={onGenerated}
        />
      ) : (
        <p>
          <small>
            Only a VFX Supervisor can generate or use an intent decomposition.
          </small>
        </p>
      )}
      {decompositions.length === 0 ? (
        <p>No intent decompositions generated yet.</p>
      ) : (
        decompositions.map((decomposition) => (
          <IntentDecompositionCard
            key={decomposition.id}
            decomposition={decomposition}
            actor={actor}
            hasDraft={hasDraft}
            onApplied={onApplied}
          />
        ))
      )}
    </section>
  );
}

/** Read-only presentation of the seven scalar Core Anchor fields, shared by
 * the confirmed-anchor card and a non-editable draft view (CG Supervisor /
 * Artist). */
function ScalarFieldsReadOnly({
  revision,
}: {
  revision: CoreAnchorRevisionRead;
}) {
  return (
    <dl>
      {CORE_ANCHOR_FIELDS.map(([field, label]) => (
        <div key={field}>
          <dt>{label}</dt>
          <dd>{revision[field] ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ConfirmedAnchorCard({
  revision,
  decision,
}: {
  revision: CoreAnchorRevisionRead;
  decision: DecisionRead | null;
}) {
  return (
    <article>
      <h3>
        Revision #{revision.revision_number}{" "}
        <StatusBadge status={revision.status} />
      </h3>
      <ScalarFieldsReadOnly revision={revision} />
      <SemanticCollectionsReadOnly revision={revision} />
      {revision.source_intent_decomposition_id && (
        <p>
          <small>
            Based on intent decomposition{" "}
            {shortId(revision.source_intent_decomposition_id)}
          </small>
        </p>
      )}
      <p>
        <small>
          Confirmed by {revision.confirmed_by_human_role} at{" "}
          {revision.confirmed_at}
        </small>
      </p>
      {decision && (
        <p>
          <small>
            Decision rationale: {decision.rationale ?? "(none given)"}
          </small>
        </p>
      )}
    </article>
  );
}

/** Read-only, ordered list rendering for one semantic collection. Used for
 * every non-editable state: confirmed/rejected/superseded revisions, and a
 * draft revision viewed by a role other than VFX Supervisor. */
function SemanticListReadOnly({
  label,
  items,
}: {
  label: string;
  items: { id: string; text: string }[];
}) {
  return (
    <div style={sectionSpacingStyle}>
      <h4>{label}</h4>
      {items.length === 0 ? (
        <p>None specified.</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ReferencesReadOnly({ items }: { items: AnchorReferenceReadItem[] }) {
  return (
    <div style={sectionSpacingStyle}>
      <h4>References</h4>
      {items.length === 0 ? (
        <p>None specified.</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>
              {item.uri && (
                <>
                  {" — "}
                  <a href={item.uri} target="_blank" rel="noreferrer noopener">
                    {item.uri}
                  </a>
                </>
              )}
              {item.note && <p>{item.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** All five semantic collections, read-only, in the fixed display order
 * (docs/STEP_1A_PLAN.md product meaning: constraints -> "Must preserve",
 * variation_zones -> "Allowed variation", drift_risks -> "High-risk drift
 * points", references -> "References", open_questions -> "Open
 * questions"). Shared by the confirmed-anchor card and any non-editable
 * view of a draft revision. */
function SemanticCollectionsReadOnly({
  revision,
}: {
  revision: CoreAnchorRevisionRead;
}) {
  return (
    <div aria-label="Core Anchor semantic collections">
      <SemanticListReadOnly
        label="Must preserve"
        items={revision.constraints.map((c) => ({ id: c.id, text: c.content }))}
      />
      <SemanticListReadOnly
        label="Allowed variation"
        items={revision.variation_zones.map((v) => ({
          id: v.id,
          text: v.content,
        }))}
      />
      <SemanticListReadOnly
        label="High-risk drift points"
        items={revision.drift_risks.map((d) => ({
          id: d.id,
          text: d.description,
        }))}
      />
      <ReferencesReadOnly items={revision.references} />
      <SemanticListReadOnly
        label="Open questions"
        items={revision.open_questions.map((q) => ({
          id: q.id,
          text: q.question,
        }))}
      />
    </div>
  );
}

/** Add/remove/move-up/move-down editor for one single-field semantic
 * collection (constraints/variation_zones/drift_risks/open_questions --
 * all share the same shape: one multiline text value per item). */
function SingleFieldCollectionEditor({
  idPrefix,
  sectionKey,
  sectionLabel,
  itemNoun,
  items,
  onChange,
  errors,
  disabled,
}: {
  idPrefix: string;
  sectionKey: string;
  sectionLabel: string;
  itemNoun: string;
  items: string[];
  onChange: (next: string[]) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <div style={sectionSpacingStyle}>
      <h4>{sectionLabel}</h4>
      {items.map((value, i) => {
        const fieldId = `${idPrefix}-${sectionKey}-${i}`;
        const errorMessage = errors[`${sectionKey}-${i}`];
        return (
          <div key={i} style={itemWrapperStyle}>
            <label htmlFor={fieldId} style={labelStyle}>
              {`${sectionLabel} item ${i + 1}`}
            </label>
            <textarea
              id={fieldId}
              value={value}
              disabled={disabled}
              style={itemFieldStyle}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <div style={itemControlsRowStyle}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${itemNoun} ${i + 1}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
              <button
                type="button"
                disabled={disabled || i === 0}
                aria-label={`Move ${itemNoun} ${i + 1} up`}
                onClick={() => onChange(moveArrayItem(items, i, -1))}
              >
                Move up
              </button>
              <button
                type="button"
                disabled={disabled || i === items.length - 1}
                aria-label={`Move ${itemNoun} ${i + 1} down`}
                onClick={() => onChange(moveArrayItem(items, i, 1))}
              >
                Move down
              </button>
            </div>
            {errorMessage && <p role="alert">{errorMessage}</p>}
          </div>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Add ${itemNoun}`}
        onClick={() => onChange([...items, ""])}
      >
        {`Add ${itemNoun}`}
      </button>
    </div>
  );
}

function ReferencesEditor({
  idPrefix,
  items,
  onChange,
  errors,
  disabled,
}: {
  idPrefix: string;
  items: ReferenceFormItem[];
  onChange: (next: ReferenceFormItem[]) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  function updateItem(i: number, patch: Partial<ReferenceFormItem>) {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  return (
    <div style={sectionSpacingStyle}>
      <h4>References</h4>
      {items.map((item, i) => {
        const errorMessage = errors[`references-${i}`];
        return (
          <fieldset key={i} style={itemWrapperStyle}>
            <legend>Reference {i + 1}</legend>
            <div style={fieldRowStyle}>
              <label htmlFor={`${idPrefix}-ref-label-${i}`} style={labelStyle}>
                {`Reference ${i + 1} label`}
              </label>
              <input
                id={`${idPrefix}-ref-label-${i}`}
                value={item.label}
                disabled={disabled}
                style={itemInputStyle}
                onChange={(e) => updateItem(i, { label: e.target.value })}
              />
            </div>
            <div style={fieldRowStyle}>
              <label htmlFor={`${idPrefix}-ref-uri-${i}`} style={labelStyle}>
                {`Reference ${i + 1} URI`}
              </label>
              <input
                id={`${idPrefix}-ref-uri-${i}`}
                value={item.uri}
                disabled={disabled}
                style={itemInputStyle}
                onChange={(e) => updateItem(i, { uri: e.target.value })}
              />
            </div>
            <div style={fieldRowStyle}>
              <label htmlFor={`${idPrefix}-ref-note-${i}`} style={labelStyle}>
                {`Reference ${i + 1} note`}
              </label>
              <textarea
                id={`${idPrefix}-ref-note-${i}`}
                value={item.note}
                disabled={disabled}
                style={itemFieldStyle}
                onChange={(e) => updateItem(i, { note: e.target.value })}
              />
            </div>
            <div style={itemControlsRowStyle}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove reference ${i + 1}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
              <button
                type="button"
                disabled={disabled || i === 0}
                aria-label={`Move reference ${i + 1} up`}
                onClick={() => onChange(moveArrayItem(items, i, -1))}
              >
                Move up
              </button>
              <button
                type="button"
                disabled={disabled || i === items.length - 1}
                aria-label={`Move reference ${i + 1} down`}
                onClick={() => onChange(moveArrayItem(items, i, 1))}
              >
                Move down
              </button>
            </div>
            {errorMessage && <p role="alert">{errorMessage}</p>}
          </fieldset>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        aria-label="Add reference"
        onClick={() => onChange([...items, { label: "", uri: "", note: "" }])}
      >
        Add reference
      </button>
    </div>
  );
}

/** All five semantic collections, editable. Only rendered when the parent
 * has already determined editing is allowed (draft revision, VFX
 * Supervisor actor) -- see CoreAnchorGate's `canEditSemantics`. */
function SemanticCollectionsEditor({
  idPrefix,
  constraints,
  onConstraintsChange,
  variationZones,
  onVariationZonesChange,
  driftRisks,
  onDriftRisksChange,
  references,
  onReferencesChange,
  openQuestions,
  onOpenQuestionsChange,
  errors,
  disabled,
}: {
  idPrefix: string;
  constraints: string[];
  onConstraintsChange: (next: string[]) => void;
  variationZones: string[];
  onVariationZonesChange: (next: string[]) => void;
  driftRisks: string[];
  onDriftRisksChange: (next: string[]) => void;
  references: ReferenceFormItem[];
  onReferencesChange: (next: ReferenceFormItem[]) => void;
  openQuestions: string[];
  onOpenQuestionsChange: (next: string[]) => void;
  errors: Record<string, string>;
  disabled: boolean;
}) {
  return (
    <div aria-label="Edit Core Anchor semantic collections">
      <SingleFieldCollectionEditor
        idPrefix={idPrefix}
        sectionKey="constraints"
        sectionLabel="Must preserve"
        itemNoun="must-preserve item"
        items={constraints}
        onChange={onConstraintsChange}
        errors={errors}
        disabled={disabled}
      />
      <SingleFieldCollectionEditor
        idPrefix={idPrefix}
        sectionKey="variation_zones"
        sectionLabel="Allowed variation"
        itemNoun="allowed-variation item"
        items={variationZones}
        onChange={onVariationZonesChange}
        errors={errors}
        disabled={disabled}
      />
      <SingleFieldCollectionEditor
        idPrefix={idPrefix}
        sectionKey="drift_risks"
        sectionLabel="High-risk drift points"
        itemNoun="drift-risk item"
        items={driftRisks}
        onChange={onDriftRisksChange}
        errors={errors}
        disabled={disabled}
      />
      <ReferencesEditor
        idPrefix={idPrefix}
        items={references}
        onChange={onReferencesChange}
        errors={errors}
        disabled={disabled}
      />
      <SingleFieldCollectionEditor
        idPrefix={idPrefix}
        sectionKey="open_questions"
        sectionLabel="Open questions"
        itemNoun="open-question item"
        items={openQuestions}
        onChange={onOpenQuestionsChange}
        errors={errors}
        disabled={disabled}
      />
    </div>
  );
}

function CoreAnchorGate({
  revision,
  actor,
  showStaleWarning,
  onDecided,
}: {
  revision: CoreAnchorRevisionRead;
  actor: { role: HumanRole; actorId: string };
  showStaleWarning: boolean;
  onDecided: (
    type: "confirmed" | "rejected",
    revisionNumber: number,
    rationale: string | null,
  ) => void;
}) {
  const [fields, setFields] = useState<Record<CoreAnchorField, string>>(() =>
    buildFieldsFromRevision(revision),
  );
  // The freshest server-known state for this revision: the original prop
  // until a save succeeds, then the PATCH response. Used both as the
  // read-only rendering source and as the dirty-check baseline, so a
  // second edit compares against what the server actually has, not a
  // stale initial prop.
  const [baseRevision, setBaseRevision] =
    useState<CoreAnchorRevisionRead>(revision);
  const [constraints, setConstraints] = useState<string[]>(() =>
    revision.constraints.map((c) => c.content),
  );
  const [variationZones, setVariationZones] = useState<string[]>(() =>
    revision.variation_zones.map((v) => v.content),
  );
  const [driftRisks, setDriftRisks] = useState<string[]>(() =>
    revision.drift_risks.map((d) => d.description),
  );
  const [references, setReferences] = useState<ReferenceFormItem[]>(() =>
    buildReferenceFormItems(revision),
  );
  const [openQuestions, setOpenQuestions] = useState<string[]>(() =>
    revision.open_questions.map((q) => q.question),
  );
  const [semanticErrors, setSemanticErrors] = useState<Record<string, string>>(
    {},
  );
  const [rationale, setRationale] = useState("");
  const [pending, setPending] = useState<"save" | "confirm" | "reject" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // Section 2 fix: a successful save must give visible acknowledgement.
  // Cleared on any later edit, on Cancel, on a later failed save, and (for
  // free, via the parent's `key={draftRevision.id}` remount) whenever the
  // selected revision changes.
  const [saveSuccess, setSaveSuccess] = useState(false);

  const canAct = actor.role === "vfx_supervisor";
  // Section 1: semantic collections are editable only on a draft revision,
  // by VFX Supervisor -- confirmed/rejected/superseded remain read-only
  // for every role. `revision.status === "draft"` is always true for the
  // revision this component is mounted with (the parent only ever passes
  // the shot's current draft), but the check is kept explicit here rather
  // than assumed, matching the fixed product meaning in section 1.
  const canEditSemantics = canAct && revision.status === "draft";

  /** Wraps a setter so any edit to the form also clears a stale "Changes
   * saved." message -- used for every semantic collection setter passed
   * down to the editor components. */
  function clearingSuccess<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setSaveSuccess(false);
    };
  }

  function resetFormFromRevision(source: CoreAnchorRevisionRead) {
    setFields(buildFieldsFromRevision(source));
    setConstraints(source.constraints.map((c) => c.content));
    setVariationZones(source.variation_zones.map((v) => v.content));
    setDriftRisks(source.drift_risks.map((d) => d.description));
    setReferences(buildReferenceFormItems(source));
    setOpenQuestions(source.open_questions.map((q) => q.question));
  }

  function validateSemanticForm(): Record<string, string> {
    const errors: Record<string, string> = {};
    const checkSingleField = (
      sectionKey: string,
      values: string[],
      itemNoun: string,
    ) => {
      values.forEach((value, i) => {
        if (value.trim() === "") {
          errors[`${sectionKey}-${i}`] =
            `${itemNoun} ${i + 1} cannot be blank.`;
        }
      });
    };
    checkSingleField("constraints", constraints, "Must-preserve item");
    checkSingleField(
      "variation_zones",
      variationZones,
      "Allowed-variation item",
    );
    checkSingleField("drift_risks", driftRisks, "Drift-risk item");
    checkSingleField("open_questions", openQuestions, "Open-question item");
    references.forEach((item, i) => {
      if (item.label.trim() === "") {
        errors[`references-${i}`] = `Reference ${i + 1} label cannot be blank.`;
      }
    });
    return errors;
  }

  /** Only collections whose normalized content or order actually changed
   * are included -- an omitted collection means "unchanged" to the
   * backend, and replacing an unchanged collection would unnecessarily
   * mint new semantic-row UUIDs and weaken evidence traceability. */
  function buildSemanticPayload(): Partial<CoreAnchorRevisionUpdate> {
    const payload: Partial<CoreAnchorRevisionUpdate> = {};

    const originalConstraints = baseRevision.constraints.map((c) => c.content);
    if (!stringArraysEqual(originalConstraints, constraints)) {
      payload.constraints = constraints.map((content) => ({ content }));
    }

    const originalVariationZones = baseRevision.variation_zones.map(
      (v) => v.content,
    );
    if (!stringArraysEqual(originalVariationZones, variationZones)) {
      payload.variation_zones = variationZones.map((content) => ({
        content,
      }));
    }

    const originalDriftRisks = baseRevision.drift_risks.map(
      (d) => d.description,
    );
    if (!stringArraysEqual(originalDriftRisks, driftRisks)) {
      payload.drift_risks = driftRisks.map((description) => ({
        description,
      }));
    }

    const originalReferences = buildReferenceFormItems(baseRevision);
    if (!referenceFormItemsEqual(originalReferences, references)) {
      payload.references = references.map((item) => ({
        label: item.label,
        uri: item.uri.trim() === "" ? null : item.uri,
        note: item.note.trim() === "" ? null : item.note,
      }));
    }

    const originalOpenQuestions = baseRevision.open_questions.map(
      (q) => q.question,
    );
    if (!stringArraysEqual(originalOpenQuestions, openQuestions)) {
      payload.open_questions = openQuestions.map((question) => ({
        question,
      }));
    }

    return payload;
  }

  async function handleSave() {
    const errors = validateSemanticForm();
    if (Object.keys(errors).length > 0) {
      setSemanticErrors(errors);
      return;
    }
    setSemanticErrors({});
    setPending("save");
    setError(null);
    // Clears any stale success message immediately -- both while this save
    // is pending, and up front in case it goes on to fail.
    setSaveSuccess(false);
    try {
      const payload: CoreAnchorRevisionUpdate = {
        ...fields,
        ...buildSemanticPayload(),
      };
      const updated = await updateCoreAnchorRevision(
        revision.id,
        payload,
        actor,
      );
      // The PATCH response is the new source of truth: server-generated
      // ids/order_index/created_at for any replaced collection. Deliberately
      // does not trigger the parent's full-page reload -- a plain draft save
      // only changes this revision's own content, and reloading would
      // unmount this component (and any success feedback) before the user
      // could ever perceive it.
      setBaseRevision(updated);
      resetFormFromRevision(updated);
      setSaveSuccess(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  function handleCancel() {
    resetFormFromRevision(baseRevision);
    setSemanticErrors({});
    setSaveSuccess(false);
    setError(null);
  }

  async function handleConfirm() {
    setPending("confirm");
    setError(null);
    try {
      // request_write_back stays false in A3 -- ftrack write-back is out of
      // scope for this page.
      await confirmCoreAnchorRevision(
        revision.id,
        { rationale: rationale || null, request_write_back: false },
        actor,
      );
      onDecided("confirmed", revision.revision_number, rationale || null);
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
      await rejectCoreAnchorRevision(
        revision.id,
        { rationale: rationale || null },
        actor,
      );
      onDecided("rejected", revision.revision_number, rationale || null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <article aria-label={`Draft revision ${revision.revision_number}`}>
      <h3>Core Anchor Human Review Gate</h3>
      <p>
        Revision #{revision.revision_number}{" "}
        <StatusBadge status={revision.status} />
      </p>
      <dl>
        <div>
          <dt>Created by</dt>
          <dd>
            {revision.created_by_actor_kind}
            {revision.created_by_actor_kind === "agent" && (
              <>
                {" "}
                — agent type: {revision.created_by_agent_type ?? "unknown"},
                agent run id: {revision.created_by_agent_run_id ?? "unknown"}
                {revision.created_by_agent_run_id && (
                  <AgentProvenanceDetails
                    agentRunId={revision.created_by_agent_run_id}
                    contextSnapshotId={revision.context_snapshot_id}
                  />
                )}
              </>
            )}
            {revision.created_by_human_role && (
              <> — {revision.created_by_human_role}</>
            )}
          </dd>
        </div>
        {revision.source_intent_decomposition_id && (
          <div>
            <dt>Source decomposition</dt>
            <dd>
              Based on intent decomposition{" "}
              {shortId(revision.source_intent_decomposition_id)}
            </dd>
          </div>
        )}
        <div>
          <dt>Required reviewer</dt>
          <dd>VFX Supervisor</dd>
        </div>
        <div>
          <dt>Acting as</dt>
          <dd>
            {actor.role} ({actor.actorId})
          </dd>
        </div>
      </dl>

      {showStaleWarning && (
        <p data-warning="stale-impact">
          Confirming this draft will mark all confirmed Execution Anchors under
          this shot as stale. It will not modify, regenerate, or confirm any
          Execution Anchor automatically.
        </p>
      )}

      {!canAct && (
        <p>
          <small>
            Only a VFX Supervisor can edit, confirm, or reject this draft.
          </small>
        </p>
      )}

      {canEditSemantics ? (
        <section aria-label="Edit draft">
          <h4>Edit draft</h4>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            {CORE_ANCHOR_FIELDS.map(([field, label]) => (
              <div key={field} style={fieldRowStyle}>
                <label htmlFor={`field-${field}`} style={labelStyle}>
                  {label}
                </label>
                <textarea
                  id={`field-${field}`}
                  value={fields[field]}
                  disabled={!canAct}
                  style={scalarTextareaStyle}
                  onChange={(e) => {
                    setFields((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }));
                    setSaveSuccess(false);
                  }}
                />
              </div>
            ))}
            <SemanticCollectionsEditor
              idPrefix={revision.id}
              constraints={constraints}
              onConstraintsChange={clearingSuccess(setConstraints)}
              variationZones={variationZones}
              onVariationZonesChange={clearingSuccess(setVariationZones)}
              driftRisks={driftRisks}
              onDriftRisksChange={clearingSuccess(setDriftRisks)}
              references={references}
              onReferencesChange={clearingSuccess(setReferences)}
              openQuestions={openQuestions}
              onOpenQuestionsChange={clearingSuccess(setOpenQuestions)}
              errors={semanticErrors}
              disabled={!canAct || pending !== null}
            />
            <div style={itemControlsRowStyle}>
              <button type="submit" disabled={!canAct || pending !== null}>
                {pending === "save" ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={!canAct || pending !== null}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
            {saveSuccess && (
              <p role="status" aria-live="polite">
                Changes saved.
              </p>
            )}
          </form>
        </section>
      ) : (
        <section aria-label="Draft details">
          <h4>Draft details</h4>
          <ScalarFieldsReadOnly revision={baseRevision} />
          <SemanticCollectionsReadOnly revision={baseRevision} />
        </section>
      )}

      <section aria-label="Gate decision">
        <h4>Gate decision</h4>
        <label htmlFor="rationale">Decision rationale (optional)</label>
        <textarea
          id="rationale"
          value={rationale}
          disabled={!canAct}
          onChange={(e) => setRationale(e.target.value)}
        />
        <div>
          <button
            type="button"
            disabled={!canAct || pending !== null}
            onClick={() => void handleConfirm()}
          >
            {pending === "confirm" ? "Confirming…" : "Confirm"}
          </button>{" "}
          <button
            type="button"
            disabled={!canAct || pending !== null}
            onClick={() => void handleReject()}
          >
            {pending === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </section>

      {error && <p role="alert">{error}</p>}
    </article>
  );
}

function TaskAnchorRow({
  info,
  revisions,
}: {
  info: TaskAnchorInfo;
  revisions: CoreAnchorRevisionRead[];
}) {
  const { task, executionAnchor, activeRevision } = info;

  return (
    <li>
      <strong>{task.name}</strong>
      {task.department && <span> ({task.department})</span>}
      <p>
        <small>Required reviewer: CG Supervisor</small>
      </p>
      {executionAnchor === null ? (
        <p>No Execution Anchor yet.</p>
      ) : (
        <>
          <p>Status: {executionAnchor.is_stale ? "Stale" : "Up to date"}</p>
          {activeRevision ? (
            <p>
              References Core Anchor{" "}
              {(() => {
                const referenced = revisions.find(
                  (r) => r.id === activeRevision.core_anchor_revision_id,
                );
                return referenced
                  ? `revision #${referenced.revision_number}`
                  : "revision (not found)";
              })()}
            </p>
          ) : (
            <p>No confirmed Execution Anchor revision yet.</p>
          )}
        </>
      )}
    </li>
  );
}
