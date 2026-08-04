"use client";

import { useState, useTransition } from "react";
import { generateVfxCreativeReviewAction } from "@/features/vfx/versions-workspace/actions";

export function GenerateCreativeReviewButton({
  shotId,
  versionId,
}: {
  shotId: string;
  versionId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(() => {
            generateVfxCreativeReviewAction(shotId, versionId).then((result) =>
              result.ok ? window.location.reload() : setError(result.message),
            );
          });
        }}
      >
        {pending ? "Generating…" : "Generate Creative Review"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
