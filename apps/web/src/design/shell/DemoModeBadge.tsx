import { StatusBadge } from "../components/StatusBadge";

/** Fixed "Demo mode" indicator for the top bar. Reuses the Step 7B-1
 * `StatusBadge` visual language rather than introducing a second badge
 * treatment -- "neutral" tone since Demo mode is informational, not an
 * attention or authority state. */
export function DemoModeBadge() {
  return <StatusBadge status="neutral" label="Demo mode" />;
}
