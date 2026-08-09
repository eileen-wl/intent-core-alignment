import type {
  ArtistCurrentFocusType,
  ArtistInboxCurrentFocusRead,
  ArtistInboxItemRead,
} from "@intent-core/contracts";
import { describe, expect, it } from "vitest";

import { adaptArtistCurrentFocusToWorkItems } from "./reviewInbox";

function focus(
  focusType: ArtistCurrentFocusType,
  overrides: Partial<ArtistInboxCurrentFocusRead> = {},
): ArtistInboxCurrentFocusRead {
  return {
    focus_type: focusType,
    title: `Title for ${focusType}`,
    explanation: `Explanation for ${focusType}`,
    target_route: "/artist/tasks/t1",
    primary_action_label: "Act now",
    actionable: focusType !== "none",
    ...overrides,
  };
}

function item(
  overrides: Partial<ArtistInboxItemRead> = {},
): ArtistInboxItemRead {
  return {
    task_id: "t1",
    task_name: "Compositing Review",
    department: "compositing",
    task_source: "manual",
    shot_id: "s1",
    shot_name: "Shot 010",
    project_id: "p1",
    project_name: "D1 Demo Project",
    execution_anchor_state: "confirmed",
    active_execution_anchor_revision_id: "ea1",
    active_execution_anchor_summary: "Keep the silhouette readable.",
    latest_version_id: null,
    latest_version_name: null,
    latest_version_number: null,
    guidance_state: "outdated",
    latest_guidance_id: "g1",
    open_review_note_count: 0,
    open_dependency_count: 0,
    current_focus: focus("guidance_outdated"),
    sort_rank: 0,
    ...overrides,
  };
}

describe("adaptArtistCurrentFocusToWorkItems", () => {
  it("carries the real, persisted guidance_state onto the work item -- needed for the Guidance state Inbox filter", () => {
    const workItems = adaptArtistCurrentFocusToWorkItems([
      item({ guidance_state: "current" }),
    ]);
    expect(workItems[0].guidanceState).toBe("current");
  });

  it("carries the real Department onto the work item -- needed for the Department Inbox filter", () => {
    const workItems = adaptArtistCurrentFocusToWorkItems([
      item({ department: "lighting" }),
    ]);
    expect(workItems[0].task.department).toBe("lighting");
  });
});
