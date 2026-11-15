/**
 * Rule-based plan adaptation. After the user skips/modifies an exercise it can be eased in their upcoming
 * sessions; after they complete a main lift it can be progressed. Pure functions: they describe the change
 * (`suggestAdjustment`) and produce the updated plan (`applyAdjustment`); the caller decides whether to save it.
 */

import type { PlannedExercise, WeeklyExercisePlan } from "./storage";

export interface AdaptiveSuggestion {
  kind: "ease" | "progress";
  message: string;
  catalogId: string;
  /** Only sessions after this one are changed. */
  fromSessionId: string;
  /** How many upcoming exercises would change. */
  affected: number;
}

/** Later, untouched occurrences of the same catalog exercise. */
function upcomingMatches(
  plan: WeeklyExercisePlan,
  fromSessionId: string,
  catalogId: string
): PlannedExercise[] {
  const index = plan.days.findIndex((d) => d.id === fromSessionId);
  if (index === -1) return [];
  return plan.days
    .slice(index + 1)
    .filter((d) => d.status !== "completed")
    .flatMap((d) => [...d.warmup, ...d.main, ...d.cooldown])
    .filter((e) => e.catalogId === catalogId && e.status === "pending");
}

/** "8-12" → "9-13", "10" → "11"; anything else ("to failure") is left alone. */
export function bumpReps(reps: string): string {
  const match = reps.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!match) return reps;
  const low = parseInt(match[1], 10) + 1;
  return match[2] ? `${low}-${parseInt(match[2], 10) + 1}` : String(low);
}

export function suggestAdjustment(
  plan: WeeklyExercisePlan,
  sessionId: string,
  exerciseId: string,
  status: PlannedExercise["status"]
): AdaptiveSuggestion | null {
  const session = plan.days.find((d) => d.id === sessionId);
  if (!session) return null;
  const exercise = [...session.warmup, ...session.main, ...session.cooldown].find((e) => e.id === exerciseId);
  if (!exercise) return null;

  const isMain = session.main.some((e) => e.id === exerciseId);
  let kind: AdaptiveSuggestion["kind"];
  if (status === "skipped" || status === "modified") kind = "ease";
  else if (status === "completed" && isMain) kind = "progress";
  else return null;

  const affected = upcomingMatches(plan, sessionId, exercise.catalogId).length;
  if (affected === 0) return null; // nothing to change, so nothing to offer

  const sessions = `${affected} upcoming session${affected === 1 ? "" : "s"}`;
  const message =
    kind === "ease"
      ? `You ${status === "skipped" ? "skipped" : "modified"} ${exercise.name}. Ease it in ${sessions}: one fewer set or a shorter hold${
          exercise.beginnerAlternative ? `, with "${exercise.beginnerAlternative}" noted as an easier option` : ""
        }.`
      : `Nice work on ${exercise.name}! Progress it in ${sessions}: ${
          exercise.durationSeconds && !exercise.reps ? "+5 seconds" : "+1 rep"
        } per set.`;

  return { kind, message, catalogId: exercise.catalogId, fromSessionId: sessionId, affected };
}

/** Returns a new plan with the suggestion applied to the upcoming matching exercises (input is not mutated). */
export function applyAdjustment(plan: WeeklyExercisePlan, suggestion: AdaptiveSuggestion): WeeklyExercisePlan {
  const next = structuredClone(plan);
  for (const ex of upcomingMatches(next, suggestion.fromSessionId, suggestion.catalogId)) {
    if (suggestion.kind === "ease") {
      if (ex.sets && ex.sets > 1) ex.sets -= 1;
      if (ex.durationSeconds) ex.durationSeconds = Math.max(10, Math.round((ex.durationSeconds * 0.8) / 5) * 5);
      ex.notes = ex.beginnerAlternative
        ? `Eased after a skip/modification. Easier option: ${ex.beginnerAlternative}`
        : "Eased after a skip/modification.";
    } else {
      if (ex.reps) ex.reps = bumpReps(ex.reps);
      else if (ex.durationSeconds) ex.durationSeconds += 5;
      ex.notes = "Progressed after a strong session.";
    }
  }
  return next;
}
