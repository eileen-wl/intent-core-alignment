import type { AnchorContextRead } from "@intent-core/contracts";

function revisionLabel(revision: number | null): string {
  return revision === null ? "not confirmed" : `R${revision}`;
}

function stateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

/** Compact Anchor-first facts for multi-object rows. */
export function AnchorContextSummary({
  context,
}: {
  context?: AnchorContextRead | null;
}) {
  if (!context) {
    return <span>Anchor context unavailable</span>;
  }

  const execution = context.execution_anchor;
  const direction =
    execution?.direction_summary ?? context.core_anchor.direction_summary;

  return (
    <>
      <span>
        Core Anchor{" "}
        {revisionLabel(context.core_anchor.confirmed_revision_number)}
      </span>
      {execution && (
        <span>
          Execution Anchor {revisionLabel(execution.confirmed_revision_number)}{" "}
          · {stateLabel(execution.context_state)}
        </span>
      )}
      <span>Direction: {direction ?? "not confirmed yet"}</span>
      <span>Attention: {stateLabel(context.attention.level)}</span>
      <span>Next: {context.next_action.title}</span>
    </>
  );
}
