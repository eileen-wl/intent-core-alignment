import type { RecordSource } from "@intent-core/contracts";

import { StatusBadge } from "../../components/StatusBadge";

/** Compact linked/not-linked badge for one object, grounded directly in
 * the `source: "manual" | "ftrack"` field already persisted on
 * `ProjectRead`, `ShotRead`, `TaskRead`, `VersionRead`, and
 * `ReviewNoteRead` -- no fabricated per-object sync detail. */
export function FtrackLinkageBadge({ source }: { source: RecordSource }) {
  return source === "ftrack" ? (
    <StatusBadge status="integration-ready" label="Linked to ftrack" />
  ) : (
    <StatusBadge status="neutral" label="No linked ftrack entity" />
  );
}
