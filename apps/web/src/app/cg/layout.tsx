import type { ReactNode } from "react";

import { RoleWorkspaceLayout } from "../_shared/RoleWorkspaceLayout";

export default function CgLayout({ children }: { children: ReactNode }) {
  return (
    <RoleWorkspaceLayout role="cg_supervisor">{children}</RoleWorkspaceLayout>
  );
}
