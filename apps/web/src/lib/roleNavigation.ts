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

/** Locked per-role navigation structure. Step 7C-1 replaced the VFX
 * Supervisor's single "Alignment Inbox" entry with the locked three-page
 * primary navigation (Workspace Home / Review Inbox / Shots) --
 * "Projects" is a production entity/filter/breadcrumb context, not a
 * primary nav page; "Intent Signals" is embedded contextually, not a
 * standalone page; "Integrations" belongs in a later account/settings
 * area, not daily VFX navigation. All three VFX entries are fully
 * implemented. */
export const ROLE_SIDEBAR_ITEMS: Record<HumanRole, SidebarNavItem[]> = {
  vfx_supervisor: [
    {
      id: "workspace-home",
      label: "Workspace Home",
      href: "/vfx",
      implemented: true,
    },
    {
      id: "review-inbox",
      label: "Review Inbox",
      href: "/vfx/inbox",
      implemented: true,
    },
    {
      id: "shots",
      label: "Shots",
      href: "/vfx/shots",
      implemented: true,
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
