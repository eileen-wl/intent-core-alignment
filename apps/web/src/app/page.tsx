import { redirect } from "next/navigation";

/** No normal-product sign-in exists yet, so `/` sends every visitor
 * straight to the Demo entry (brief §3). The former "Engineering
 * skeleton" landing content moved to `/dev`. */
export default function HomePage() {
  redirect("/demo");
}
