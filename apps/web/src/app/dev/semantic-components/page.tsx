import type { Metadata } from "next";

import { SemanticComponentsPreview } from "./SemanticComponentsPreview";

export const metadata: Metadata = {
  title: "Development preview — ICAS Semantic Components",
};

export default function Page() {
  return <SemanticComponentsPreview />;
}
