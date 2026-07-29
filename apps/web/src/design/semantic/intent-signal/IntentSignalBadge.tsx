import { StatusBadge } from "../../components/StatusBadge";
import {
  intentSignalLevelWording,
  intentSignalStatusTone,
  type IntentSignalAvailability,
} from "./intentSignalModel";

/** Level 4 -- list-row badge (docs/step-7/03_STEP_7A2_...md §10.3:
 * "Human review required / Attention needed / Low attention"),
 * role-agnostic. Renders nothing when no signal is available -- an
 * absent badge honestly means "no assessment yet," rather than
 * cluttering every row with an "unavailable" chip. */
export function IntentSignalBadge({
  availability,
}: {
  availability: IntentSignalAvailability;
}) {
  if (availability.status !== "available") {
    return null;
  }

  const { attention_level: level } = availability.signal;
  return (
    <StatusBadge
      status={intentSignalStatusTone(level)}
      label={intentSignalLevelWording(level)}
    />
  );
}
