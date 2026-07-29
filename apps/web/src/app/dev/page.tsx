import type { Metadata } from "next";

import { DevIndexPage } from "./DevIndexPage";

export const metadata: Metadata = {
  title: "Development — ICAS",
};

export default function Page() {
  return <DevIndexPage />;
}
