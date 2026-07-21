import type { HumanRole } from "@intent-core/contracts";

const HUMAN_ROLES: { value: HumanRole; label: string }[] = [
  { value: "vfx_supervisor", label: "VFX Supervisor" },
  { value: "cg_supervisor", label: "CG Supervisor" },
  { value: "artist", label: "Artist" },
];

/** Presentational actor picker shared by every page that needs to show
 * "who is acting" for a Human Gate. Selecting a role here never grants
 * any permission by itself -- the backend independently enforces who may
 * act, on every request, via the X-Actor-Role/X-Actor-Id headers. */
export function ActorSelector({
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
