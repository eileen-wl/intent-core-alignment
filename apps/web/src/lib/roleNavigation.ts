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
 * implemented. Step 7C-4 gave CG Supervisor the same three-page shape
 * (Workspace Home / Review Inbox / Tasks) -- never a VFX-only item such
 * as Shots, and no separate Intent Signals entry. Step 7C-5 gives Artist
 * the identical three-page shape -- the earlier "My Tasks"/"Intent
 * Signals" placeholder entries are retired. */
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
      id: "workspace-home",
      label: "Workspace Home",
      href: "/cg",
      implemented: true,
    },
    {
      id: "review-inbox",
      label: "Review Inbox",
      href: "/cg/inbox",
      implemented: true,
    },
    {
      id: "tasks",
      label: "Tasks",
      href: "/cg/tasks",
      implemented: true,
    },
  ],
  artist: [
    {
      id: "workspace-home",
      label: "Workspace Home",
      href: "/artist",
      implemented: true,
    },
    {
      id: "review-inbox",
      label: "Review Inbox",
      href: "/artist/inbox",
      implemented: true,
    },
    {
      id: "tasks",
      label: "Tasks",
      href: "/artist/tasks",
      implemented: true,
    },
  ],
};
