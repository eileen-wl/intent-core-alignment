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
  ShotRead,
  TaskRead,
} from "@intent-core/contracts";

import {
  ApiError,
  confirmCoreAnchorRevision,
  generateCoreAnchorDraft,
  getCoreAnchor,
  getExecutionAnchor,
  getExecutionAnchorRevision,
  getShot,
  listBriefsForShot,
  listCoreAnchorRevisions,
  listDecisionsForRevision,
  listTasks,
  rejectCoreAnchorRevision,
  updateCoreAnchorRevision,
} from "@/lib/api";

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

interface TaskAnchorInfo {
  task: TaskRead;
  executionAnchor: ExecutionAnchorRead | null;
  activeRevision: ExecutionAnchorRevisionRead | null;
}

interface ShotData {
  shot: ShotRead;
  briefs: IntentBriefRead[];
  coreAnchor: CoreAnchorRead | null;
  revisions: CoreAnchorRevisionRead[];
  confirmedRevisionDecision: DecisionRead | null;
  taskAnchors: TaskAnchorInfo[];
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

const HUMAN_ROLES: { value: HumanRole; label: string }[] = [
  { value: "vfx_supervisor", label: "VFX Supervisor" },
  { value: "cg_supervisor", label: "CG Supervisor" },
  { value: "artist", label: "Artist" },
];

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return `Not allowed: ${err.detail}`;
    if (err.status === 409) return `Out of date: ${err.detail}`;
    if (err.status === 502)
      return `Core Agent generation failed: ${err.detail}`;
    if (err.status === 0) return "Could not reach the API server.";
    return err.detail || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
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
  const [briefs, coreAnchor, allTasks] = await Promise.all([
    listBriefsForShot(shotId),
    getCoreAnchor(shotId),
    listTasks(),
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
    coreAnchor,
    revisions,
    confirmedRevisionDecision,
    taskAnchors,
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
    coreAnchor,
    revisions,
    confirmedRevisionDecision,
    taskAnchors,
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
        onRoleChange={setRole}
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

      <section>
        <h2>Core anchor</h2>
        {coreAnchor === null ? (
          <>
            <p>No Core Anchor yet for this shot.</p>
            <GenerateDraftButton
              shotId={shot.id}
              hasBrief={latestBrief !== null}
              onGenerated={reload}
            />
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
                onSaved={reload}
                onDecided={handleDecided}
              />
            ) : (
              <>
                <p>No draft revision awaiting review.</p>
                <GenerateDraftButton
                  shotId={shot.id}
                  hasBrief={latestBrief !== null}
                  onGenerated={reload}
                />
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
    </main>
  );
}

function ActorSelector({
  role,
  actorId,
  onRoleChange,
  onActorIdChange,
}: {
  role: HumanRole;
  actorId: string;
  onRoleChange: (role: HumanRole) => void;
  onActorIdChange: (id: string) => void;
}) {
  return (
    <section aria-label="Acting as">
      <label>
        Role{" "}
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as HumanRole)}
        >
          {HUMAN_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Actor id{" "}
        <input
          value={actorId}
          onChange={(e) => onActorIdChange(e.target.value)}
        />
      </label>
      <p>
        <small>
          Presentational only — the backend independently enforces who may edit,
          confirm, or reject.
        </small>
      </p>
    </section>
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
      <dl>
        {CORE_ANCHOR_FIELDS.map(([field, label]) => (
          <div key={field}>
            <dt>{label}</dt>
            <dd>{revision[field] ?? "—"}</dd>
          </div>
        ))}
      </dl>
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

function CoreAnchorGate({
  revision,
  actor,
  showStaleWarning,
  onSaved,
  onDecided,
}: {
  revision: CoreAnchorRevisionRead;
  actor: { role: HumanRole; actorId: string };
  showStaleWarning: boolean;
  onSaved: () => void;
  onDecided: (
    type: "confirmed" | "rejected",
    revisionNumber: number,
    rationale: string | null,
  ) => void;
}) {
  const [fields, setFields] = useState<Record<CoreAnchorField, string>>(
    () =>
      Object.fromEntries(
        CORE_ANCHOR_FIELDS.map(([field]) => [field, revision[field] ?? ""]),
      ) as Record<CoreAnchorField, string>,
  );
  const [rationale, setRationale] = useState("");
  const [pending, setPending] = useState<"save" | "confirm" | "reject" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const canAct = actor.role === "vfx_supervisor";

  async function handleSave() {
    setPending("save");
    setError(null);
    try {
      await updateCoreAnchorRevision(
        revision.id,
        fields as CoreAnchorRevisionUpdate,
        actor,
      );
      onSaved();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
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
              </>
            )}
            {revision.created_by_human_role && (
              <> — {revision.created_by_human_role}</>
            )}
          </dd>
        </div>
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

      <section aria-label="Edit draft">
        <h4>Edit draft</h4>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          {CORE_ANCHOR_FIELDS.map(([field, label]) => (
            <div key={field}>
              <label htmlFor={`field-${field}`}>{label}</label>
              <textarea
                id={`field-${field}`}
                value={fields[field]}
                disabled={!canAct}
                onChange={(e) =>
                  setFields((prev) => ({ ...prev, [field]: e.target.value }))
                }
              />
            </div>
          ))}
          <button type="submit" disabled={!canAct || pending !== null}>
            {pending === "save" ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

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
