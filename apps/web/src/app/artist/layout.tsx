import type { ReactNode } from "react";

import { RoleWorkspaceLayout } from "../_shared/RoleWorkspaceLayout";

export default function ArtistLayout({ children }: { children: ReactNode }) {
  return <RoleWorkspaceLayout role="artist">{children}</RoleWorkspaceLayout>;
}
