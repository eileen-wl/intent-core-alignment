"use client";

import { use } from "react";

import { ShotAnchorPage } from "./ShotAnchorPage";

export default function Page({
  params,
}: {
  params: Promise<{ shotId: string }>;
}) {
  const { shotId } = use(params);
  return <ShotAnchorPage shotId={shotId} />;
}
