import type { HumanRole } from "@intent-core/contracts";

export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  /** Whether this destination has been built yet. Unimplemented items
   * render as disabled, non-navigable placeholders (brief §7) rather
   * than links that would lead to a 404. */
  implemented: boolean;
}

/** Locked per-role navigation structure, per
 * docs/step-7/06_STEP_7_LOCKED_SOURCE_OF_TRUTH.md §7 and
 * docs/step-7/03_STEP_7A2_...md §13. Only each role's homepage is an
 * implemented destination in Step 7B-2; the rest are upcoming. */
export const ROLE_SIDEBAR_ITEMS: Record<HumanRole, SidebarNavItem[]> = {
  vfx_supervisor: [
    {
      id: "alignment-inbox",
      label: "Alignment Inbox",
      href: "/vfx",
      implemented: true,
    },
    {
      id: "projects",
      label: "Projects",
      href: "/vfx/projects",
      implemented: false,
    },
    {
      id: "intent-signals",
      label: "Intent Signals",
      href: "/vfx/signals",
      implemented: false,
    },
    {
      id: "integrations",
      label: "Integrations",
      href: "/vfx/integrations",
      implemented: false,
    },
  ],
  cg_supervisor: [
    {
      id: "execution-inbox",
      label: "Execution Inbox",
      href: "/cg",
      implemented: true,
    },
    { id: "tasks", label: "Tasks", href: "/cg/tasks", implemented: false },
    {
      id: "intent-signals",
      label: "Intent Signals",
      href: "/cg/signals",
      implemented: false,
    },
  ],
  artist: [
    { id: "my-tasks", label: "My Tasks", href: "/artist", implemented: true },
    {
      id: "intent-signals",
      label: "Intent Signals",
      href: "/artist/signals",
      implemented: false,
    },
  ],
};
