import type { CgInboxItemRead, TaskActivityRead } from "@intent-core/contracts";

import { fetchCgInboxItem, getTaskActivity } from "@/features/cg/api";

export interface TaskActivityWorkspaceData {
  item: CgInboxItemRead;
  activity: TaskActivityRead;
}

export async function loadTaskActivityWorkspaceData(
  taskId: string,
): Promise<TaskActivityWorkspaceData | null> {
  const item = await fetchCgInboxItem(taskId);
  if (item === null) {
    return null;
  }

  const activity = await getTaskActivity(taskId);
  return { item, activity };
}
