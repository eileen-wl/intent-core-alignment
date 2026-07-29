import type { HumanRole } from "@intent-core/contracts";

/** Serialisable display data only -- no callback functions. This is
 * rendered by `DemoEntryPage` (a Server Component) and must stay plain
 * data so it can safely reach `RoleEntryButton` (a Client Component)
 * across the Server/Client boundary. */
export interface RoleCard {
  role: HumanRole;
  title: string;
  responsibility: string;
  question: string;
}

export const ROLE_CARDS: readonly RoleCard[] = [
  {
    role: "vfx_supervisor",
    title: "VFX Supervisor",
    responsibility: "Protects the shared creative intent across departments.",
    question:
      "Where does cross-role interpretation require human coordination?",
  },
  {
    role: "cg_supervisor",
    title: "CG Supervisor",
    responsibility:
      "Turns confirmed intent into department execution boundaries.",
    question:
      "What does the department need to execute safely and consistently?",
  },
  {
    role: "artist",
    title: "Artist",
    responsibility:
      "Works from practical guidance and confirmed variation boundaries.",
    question: "What should change, why it matters, and what remains open?",
  },
];
