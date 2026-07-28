import type { Metadata } from "next";

import { UiFoundationPreview } from "./UiFoundationPreview";

export const metadata: Metadata = {
  title: "Development preview — ICAS UI Foundation",
};

export default function Page() {
  return <UiFoundationPreview />;
}
