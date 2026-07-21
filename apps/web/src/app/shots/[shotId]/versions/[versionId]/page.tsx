"use client";

import { use } from "react";

import { VersionPage } from "./VersionPage";

export default function Page({
  params,
}: {
  params: Promise<{ shotId: string; versionId: string }>;
}) {
  const { shotId, versionId } = use(params);
  return <VersionPage shotId={shotId} versionId={versionId} />;
}
