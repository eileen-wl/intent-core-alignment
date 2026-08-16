import type { ReactNode } from "react";

import { RoleWorkspaceLayout } from "../_shared/RoleWorkspaceLayout";

export default function VfxLayout({ children }: { children: ReactNode }) {
  return (
    <RoleWorkspaceLayout role="vfx_supervisor">{children}</RoleWorkspaceLayout>
  );
}
