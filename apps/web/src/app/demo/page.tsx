import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  DEMO_ROLE_COOKIE,
  ROLE_HOME_PATH,
  isDemoRole,
} from "@/lib/demoIdentity";
import { DemoEntryPage } from "./DemoEntryPage";

/** A Demo role is fixed once selected -- switching requires
 * `Exit role view` (brief §1). Revisiting `/demo` with a role already
 * selected redirects straight back to that role's workspace rather
 * than allowing a second, un-audited role pick. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await cookies();
  const existingRole = store.get(DEMO_ROLE_COOKIE)?.value;
  if (isDemoRole(existingRole)) {
    redirect(ROLE_HOME_PATH[existingRole]);
  }

  const params = await searchParams;
  const guidedEntryError = params.guidedError !== undefined;

  return <DemoEntryPage guidedEntryError={guidedEntryError} />;
}
