"use client";

import { useEffect, useRef, useState } from "react";
import type { VersionMediaRead } from "@intent-core/contracts";

import { VersionMediaPanel } from "./VersionMediaPanel";

export type VersionMediaFetchResult =
  { ok: true; media: VersionMediaRead } | { ok: false; message: string };

interface ResolutionState {
  versionId: string;
  status: "loading" | "loaded" | "error";
  media: VersionMediaRead | null;
  message: string | null;
}

function initialState(versionId: string): ResolutionState {
  return { versionId, status: "loading", media: null, message: null };
}

/** Step 9B-4 -- the one reusable client-side orchestrator for a
 * Version-focused page whose Version selection is client state (VFX
 * `VersionsWorkspacePage.tsx`, CG `VersionReviewPage.tsx`; Artist's
 * `CurrentVersionPage.tsx` selects via navigation instead and fetches
 * media server-side, so it renders `VersionMediaPanel` directly).
 *
 * Resolves media only for the currently-selected Version (never
 * pre-resolves every Version on the page), and guards against the
 * classic stale-response race: if the user switches to a different
 * Version before an in-flight resolution for the previous one returns,
 * that stale response is discarded rather than overwriting the newly
 * selected Version's panel (`requestIdRef`). `resolve` is a Server
 * Action reference (`resolveVersionMediaAction` from the caller's own
 * `features/*\/actions.ts`) -- identity is resolved server-side inside
 * it on every call, never client-supplied. */
export function VersionMediaResolver({
  versionId,
  resolve,
}: {
  versionId: string;
  resolve: (versionId: string) => Promise<VersionMediaFetchResult>;
}) {
  const [state, setState] = useState<ResolutionState>(() =>
    initialState(versionId),
  );
  const requestIdRef = useRef(0);

  const runResolve = (targetVersionId: string) => {
    const requestId = ++requestIdRef.current;
    setState(initialState(targetVersionId));
    resolve(targetVersionId).then((result) => {
      if (requestIdRef.current !== requestId) return; // superseded by a newer selection/retry
      if (result.ok) {
        setState({
          versionId: targetVersionId,
          status: "loaded",
          media: result.media,
          message: null,
        });
      } else {
        setState({
          versionId: targetVersionId,
          status: "error",
          media: null,
          message: result.message,
        });
      }
    });
  };

  useEffect(() => {
    runResolve(versionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `resolve` is a stable Server Action reference per caller
  }, [versionId]);

  return (
    <VersionMediaPanel
      media={state.status === "loaded" ? state.media : null}
      isLoading={state.status === "loading"}
      errorMessage={state.status === "error" ? state.message : null}
      onRetry={() => runResolve(versionId)}
    />
  );
}
