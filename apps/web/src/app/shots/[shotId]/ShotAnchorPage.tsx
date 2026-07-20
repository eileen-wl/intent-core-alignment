"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  CoreAnchorRead,
  CoreAnchorRevisionRead,
  CoreAnchorRevisionUpdate,
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
  getCoreAnchor,
  getExecutionAnchor,
  getExecutionAnchorRevision,
  getShot,
  listBriefsForShot,
  listCoreAnchorRevisions,
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
  taskAnchors: TaskAnchorInfo[];
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ShotData };

const HUMAN_ROLES: { value: HumanRole; label: string }[] = [
  { value: "vfx_supervisor", label: "VFX Supervisor" },
  { value: "cg_supervisor", label: "CG Supervisor" },
  { value: "artist", label: "Artist" },
];

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return `Not allowed: ${err.detail}`;
    if (err.status === 409) return `Out of date: ${err.detail}`;
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
  const shotTasks = allTasks.filter((t) => t.shot_id === shotId);
  const taskAnchors = await Promise.all(shotTasks.map(loadTaskAnchor));
  return { shot, briefs, coreAnchor, revisions, taskAnchors };
}

export function ShotAnchorPage({ shotId }: { shotId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [role, setRole] = useState<HumanRole>("vfx_supervisor");
  const [actorId, setActorId] = useState("vfx-1");

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

  const { shot, briefs, coreAnchor, revisions, taskAnchors } = state.data;
  const latestBrief = briefs.length > 0 ? briefs[briefs.length - 1] : null;
  const confirmedRevision =
    revisions.find((r) => r.status === "confirmed") ?? null;
  const draftRevision =
    [...revisions].reverse().find((r) => r.status === "draft") ?? null;

  const actor = { role, actorId };

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
          <p>No Core Anchor yet for this shot.</p>
        ) : (
          <>
            {confirmedRevision && (
              <ConfirmedAnchorCard revision={confirmedRevision} />
            )}
            {draftRevision ? (
              <DraftAnchorCard
                key={draftRevision.id}
                revision={draftRevision}
                actor={actor}
                onChanged={reload}
              />
            ) : (
              <p>No draft revision awaiting review.</p>
            )}
            {!confirmedRevision && !draftRevision && (
              <p>Core Anchor has no revisions yet.</p>
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

function StatusBadge({ status }: { status: CoreAnchorRevisionRead["status"] }) {
  return <span data-status={status}>[{status}]</span>;
}

function ConfirmedAnchorCard({
  revision,
}: {
  revision: CoreAnchorRevisionRead;
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
    </article>
  );
}

function DraftAnchorCard({
  revision,
  actor,
  onChanged,
}: {
  revision: CoreAnchorRevisionRead;
  actor: { role: HumanRole; actorId: string };
  onChanged: () => void;
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
      onChanged();
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
      // request_write_back stays false in D1 -- ftrack write-back is out of
      // scope for this page.
      await confirmCoreAnchorRevision(
        revision.id,
        { rationale: rationale || null, request_write_back: false },
        actor,
      );
      onChanged();
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
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <article aria-label={`Draft revision ${revision.revision_number}`}>
      <h3>
        Revision #{revision.revision_number}{" "}
        <StatusBadge status={revision.status} />
      </h3>
      {!canAct && (
        <p>
          <small>
            Only a VFX Supervisor can edit, confirm, or reject this draft.
          </small>
        </p>
      )}
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

      <label htmlFor="rationale">Rationale (optional)</label>
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
