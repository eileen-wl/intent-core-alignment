import type { AgentRunRead, ContextSnapshotRead } from "@intent-core/contracts";

import { Stack } from "../../layout/Stack";
import { AgentRunReference } from "./AgentRunReference";
import { ContextSnapshotReference } from "./ContextSnapshotReference";

/** The full provenance block: which AgentRun produced this, and which
 * ContextSnapshot it read from. Provider/model metadata only appears
 * because `AgentRunRead` already safely exposes it via the API --
 * nothing here reaches for anything beyond that contract. */
export function ProvenanceMetadata({
  run,
  snapshot,
}: {
  run: AgentRunRead | null;
  snapshot: ContextSnapshotRead | null;
}) {
  return (
    <Stack gap={2}>
      <AgentRunReference run={run} />
      <ContextSnapshotReference snapshot={snapshot} />
    </Stack>
  );
}
