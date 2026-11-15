import type { PlannedExercise } from "./storage";

/**
 * Deep link from a planned exercise into the Arena. Carries the session and item ids so the Arena can offer
 * "mark done" and return to the plan; older links without them still work (the Arena just shows the target).
 */
export function arenaLink(
  exercise: Pick<PlannedExercise, "catalogId" | "trackingMode" | "id">,
  sessionId: string
): string {
  const params = new URLSearchParams({
    mode: exercise.trackingMode === "dance" ? "dance" : "gym",
    exercise: exercise.catalogId,
    session: sessionId,
    item: exercise.id,
  });
  return `/?${params.toString()}`;
}
