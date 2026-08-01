import { redirect } from "next/navigation";

/** Step 7C-1: `/demo` no longer renders product UI -- the real
 * Role-selection Home lives at `/`. This is a permanent, deterministic
 * redirect so any old bookmarked or shared `/demo` link still
 * resolves rather than 404ing. */
export default function Page() {
  redirect("/");
}
