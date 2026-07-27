import { useEffect, useState } from "react";
import type { AgentRunRead, ContextSnapshotRead } from "@intent-core/contracts";

import { getAgentRun, getContextSnapshot } from "@/lib/api";

/** Enriches a "created by an Agent" line with the AgentRun's agent
 * type/provider/status and the ContextSnapshot's creation time -- both
 * already linked from the caller via id, fetched here rather than on
 * every page load since they're only relevant once a record's
 * provenance is actually being inspected. Silently shows nothing extra
 * if either fetch fails; the essential provenance (agent run id) is
 * already visible to the caller without this.
 *
 * `showAgentType` defaults to false to preserve the Core Anchor Human
 * Review Gate's existing behavior (it already shows agent type
 * synchronously from the revision's own field, before this component
 * loads) -- pass `true` for callers with no such field of their own
 * (e.g. AlignmentAssessment, which has no created_by_agent_type). */
export function AgentProvenanceDetails({
  agentRunId,
  contextSnapshotId,
  showAgentType = false,
}: {
  agentRunId: string;
  contextSnapshotId: string | null;
  showAgentType?: boolean;
}) {
  const [run, setRun] = useState<AgentRunRead | null>(null);
  const [snapshot, setSnapshot] = useState<ContextSnapshotRead | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAgentRun(agentRunId).then(
      (result) => {
        if (!cancelled) setRun(result);
      },
      () => {},
    );
    if (contextSnapshotId) {
      getContextSnapshot(contextSnapshotId).then(
        (result) => {
          if (!cancelled) setSnapshot(result);
        },
        () => {},
      );
    }
    return () => {
      cancelled = true;
    };
  }, [agentRunId, contextSnapshotId]);

  return (
    <>
      {run && (
        <>
          {showAgentType && <>, agent type: {run.agent_type}</>}, provider:{" "}
          {run.provider}
          {run.model_name && <>, model: {run.model_name}</>}
          {run.prompt_version && <>, prompt version: {run.prompt_version}</>},
          run status: {run.status}
        </>
      )}
      {snapshot && (
        <>
          , context snapshot: {snapshot.id} (captured {snapshot.created_at})
        </>
      )}
    </>
  );
}
