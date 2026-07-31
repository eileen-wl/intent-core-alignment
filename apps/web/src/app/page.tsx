import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_ROLE_COOKIE, ROLE_HOME_PATH, isDemoRole } from "@/lib/demoIdentity";
import { RoleSelectionHome } from "./RoleSelectionHome";

/** `/` -- the real Role-selection Home (Step 7C-1's locked IA §1):
 * ICAS's entry path, before every role workspace. A role session is
 * fixed once selected -- switching requires `Exit role view`.
 * Revisiting `/` with a role already selected redirects straight back
 * to that role's workspace rather than allowing a second, un-audited
 * role pick. The former "Engineering skeleton" landing content lives at
 * `/dev`. */
export default async function HomePage() {
  const store = await cookies();
  const existingRole = store.get(DEMO_ROLE_COOKIE)?.value;
  if (isDemoRole(existingRole)) {
    redirect(ROLE_HOME_PATH[existingRole]);
  }

  return <RoleSelectionHome />;
}
