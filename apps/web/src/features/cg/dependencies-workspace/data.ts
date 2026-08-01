import type {
  CgInboxItemRead,
  TaskDependencyRead,
} from "@intent-core/contracts";

import { fetchCgInboxItem, listDependenciesForTask } from "@/features/cg/api";

export interface DependenciesWorkspaceData {
  item: CgInboxItemRead;
  dependencies: TaskDependencyRead[];
}

export async function loadDependenciesWorkspaceData(
  taskId: string,
): Promise<DependenciesWorkspaceData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const dependencies = await listDependenciesForTask(taskId);
  return { item, dependencies };
}
