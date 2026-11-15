"use client";

import Link from "next/link";
import { getExerciseById } from "../data/exercises";
import { updateExerciseStatus } from "../lib/storage";
import { useWeeklyExercisePlan } from "../lib/useAppData";

export interface WorkoutTarget {
  catalogId: string;
  /** Present when the Arena was opened from a plan, so the exercise can be ticked off here. */
  sessionId?: string;
  itemId?: string;
}

interface Props {
  target: WorkoutTarget;
  onDismiss: () => void;
}

/**
 * Shown in the Arena when it is opened from the Exercise Planner or Dashboard. Closes the loop: the user
 * sees what they came to do, can mark it done, and can jump back to the plan.
 */
export default function WorkoutTargetBanner({ target, onDismiss }: Props) {
  const plan = useWeeklyExercisePlan();
  const catalog = getExerciseById(target.catalogId);
  if (!catalog) return null;

  const session = target.sessionId ? plan?.days.find((d) => d.id === target.sessionId) : undefined;
  const planned = target.itemId
    ? [...(session?.warmup ?? []), ...(session?.main ?? []), ...(session?.cooldown ?? [])].find((e) => e.id === target.itemId)
    : undefined;
  const done = planned?.status === "completed";

  const prescription = planned
    ? [
        planned.sets ? `${planned.sets} sets` : null,
        planned.reps ? `${planned.reps} reps` : null,
        planned.durationSeconds ? `${planned.durationSeconds}s` : null,
      ]
        .filter(Boolean)
        .join(" × ")
    : "";

  return (
    <div
      role="status"
      className="flex-shrink-0 relative z-20 px-3 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 bg-neon-cyan/10 border-b border-neon-cyan/25 text-xs"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span aria-hidden="true">🎯</span>
        <span className="text-[10px] tracking-[0.2em] uppercase text-neon-cyan/70" style={{ fontFamily: "var(--font-audiowide)" }}>
          Workout target
        </span>
        <span className="font-semibold text-white truncate">{catalog.name}</span>
        {prescription && <span className="font-mono text-white/60 hidden sm:inline">{prescription}</span>}
      </div>

      {catalog.instructions[0] && (
        <span className="text-white/50 hidden lg:inline truncate flex-1 min-w-0">{catalog.instructions[0]}</span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {planned && session && (
          <button
            type="button"
            onClick={() => updateExerciseStatus(session.id, planned.id, done ? "pending" : "completed")}
            className={`px-3 py-1 rounded text-[10px] tracking-wider uppercase font-bold transition-all ${
              done
                ? "bg-emerald-600 text-white"
                : "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
            }`}
          >
            {done ? "✓ Done — undo" : "Mark done"}
          </button>
        )}
        <Link
          href="/exercise"
          className="px-3 py-1 rounded border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-[10px] tracking-wider uppercase transition-colors"
        >
          Back to plan
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss workout target"
          className="text-white/40 hover:text-white px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
