"use client";

import Link from "next/link";
import { useMemo } from "react";
import { addNutritionLog } from "../lib/storage";
import type { DayPlan, WorkoutSession } from "../lib/storage";
import { computeMacroTargets } from "../lib/nutrition";
import { dayOfMonth, parseLocalDate, planWindow, weekdayShort } from "../lib/dates";
import { arenaLink } from "../lib/arenaLink";
import { useHydrated, useNutritionLogs, usePreferences, useToday, useWeeklyDietPlan, useWeeklyExercisePlan } from "../lib/useAppData";

function sessionExercises(s: WorkoutSession) {
  return [...s.warmup, ...s.main, ...s.cooldown];
}

/** One status per plan day, from the user's point of view. */
function dayStatus(s: WorkoutSession, today: string): { icon: string; label: string; tone: string } {
  if (s.type === "rest") return { icon: "🧘", label: "Rest", tone: "text-white/40" };
  if (s.status === "completed") return { icon: "✅", label: "Done", tone: "text-emerald-400" };
  if (s.status === "skipped") return { icon: "⏭️", label: "Skipped", tone: "text-white/40" };
  if (today && s.plannedDate < today) return { icon: "⚠️", label: "Missed", tone: "text-amber-400" };
  if (s.type === "active_recovery") return { icon: "🚶", label: "Recovery", tone: "text-neon-cyan/70" };
  return { icon: "🏋️", label: s.status === "in_progress" ? "Started" : "Planned", tone: "text-white/40" };
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const today = useToday();
  const prefs = usePreferences();
  const dietPlan = useWeeklyDietPlan();
  const exercisePlan = useWeeklyExercisePlan();
  const allLogs = useNutritionLogs();

  const username = prefs.username || "Athlete";
  const targets = useMemo(() => (prefs.dietProfile ? computeMacroTargets(prefs.dietProfile) : null), [prefs.dietProfile]);

  // "Today" is strictly today: no silent fallback to Day 1 of a plan that hasn't started or has already ended.
  const todayDietDay: DayPlan | undefined = dietPlan?.days.find((d) => d.date === today);
  const todayWorkout: WorkoutSession | undefined = exercisePlan?.days.find((d) => d.plannedDate === today);
  const dietState = dietPlan ? planWindow(dietPlan.days.map((d) => d.date), today) : null;
  const workoutState = exercisePlan ? planWindow(exercisePlan.days.map((d) => d.plannedDate), today) : null;

  const todayLogs = useMemo(() => {
    const map = new Map<string, { eaten: boolean; portion: number }>();
    for (const l of allLogs) if (l.date === today) map.set(l.mealId, { eaten: l.eaten, portion: l.portionMultiplier });
    return map;
  }, [allLogs, today]);

  let eatenCount = 0;
  let consumedCalories = 0;
  if (todayDietDay) {
    for (const m of todayDietDay.meals) {
      const log = todayLogs.get(m.id);
      if (log?.eaten) {
        eatenCount++;
        consumedCalories += Math.round(m.nutrition.calories * log.portion);
      }
    }
  }

  const quickLogNextMeal = () => {
    if (!todayDietDay) return;
    const next = todayDietDay.meals.find((m) => !todayLogs.get(m.id)?.eaten);
    if (!next) return;
    addNutritionLog({
      date: todayDietDay.date,
      mealId: next.id,
      mealName: next.name,
      eaten: true,
      portionMultiplier: todayLogs.get(next.id)?.portion ?? 1,
      loggedAt: new Date().toISOString(),
    });
  };

  const todayExercises = todayWorkout ? sessionExercises(todayWorkout) : [];
  const finishedToday = todayExercises.filter((e) => e.status === "completed").length;

  const workoutDays = exercisePlan?.days.filter((d) => d.type === "workout") ?? [];
  const workoutsDone = workoutDays.filter((d) => d.status === "completed").length;

  const todayLabel = today
    ? parseLocalDate(today).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })
    : "";

  const workoutMessage = (() => {
    if (!exercisePlan) return "Create an AI workout routine to see your scheduled sessions.";
    if (workoutState === "ended") return "Your plan has ended. Generate a fresh week to keep going.";
    if (workoutState === "upcoming") return `Your plan starts on ${exercisePlan.days[0].plannedDate}.`;
    if (!todayWorkout) return "Nothing scheduled today.";
    if (todayWorkout.type === "rest") return "Rest & recovery day. Focus on hydration and mobility.";
    return `${finishedToday} of ${todayExercises.length} movements completed`;
  })();

  return (
    <div className="flex-1 arena text-white p-4 sm:p-8 flex flex-col relative overflow-x-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="max-w-6xl w-full mx-auto flex flex-col gap-8 relative z-10">
        {/* Welcome Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neon-cyan/20">
          <div>
            <div className="text-[10px] text-neon-cyan tracking-[0.25em] uppercase font-semibold">FitVeda Unified Command</div>
            <h1
              className="text-2xl sm:text-4xl font-bold tracking-[0.15em] uppercase neon-title mt-1"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              WELCOME BACK, {username}
            </h1>
            <p className="text-xs text-white/50 tracking-wider uppercase mt-1 min-h-4">{todayLabel && `Today: ${todayLabel}`}</p>
          </div>

          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-linear-to-r from-neon-cyan via-neon-magenta to-neon-violet text-black font-bold text-xs tracking-[0.2em] uppercase hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center gap-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span aria-hidden="true">📹</span> START LIVE ARENA
          </Link>
        </div>

        {!hydrated ? (
          <div className="h-64" aria-busy="true" />
        ) : (
          <>
            {/* Quick Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Workout */}
              <div className="p-5 rounded-2xl bg-[#080814] border border-neon-cyan/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
                <div>
                  <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-cyan mb-2 font-semibold">
                    <span>💪 Workout Overview</span>
                    <span className="font-mono">{todayWorkout ? todayWorkout.type.replace("_", " ").toUpperCase() : "—"}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide mb-1" style={{ fontFamily: "var(--font-chakra-petch)" }}>
                    {todayWorkout ? todayWorkout.title : exercisePlan ? "No session today" : "No Workout Scheduled"}
                  </h3>
                  <p className="text-xs text-white/60 mb-4">{workoutMessage}</p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <Link
                    href="/exercise"
                    className="text-xs text-neon-cyan hover:underline tracking-wider uppercase font-semibold"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    {exercisePlan ? "Open Workout →" : "Create Plan →"}
                  </Link>
                  {todayWorkout?.main.some((e) => e.trackable) && (
                    <span className="text-[9px] px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40">
                      Pose Trackable
                    </span>
                  )}
                </div>
              </div>

              {/* Nutrition */}
              <div className="p-5 rounded-2xl bg-[#080814] border border-neon-magenta/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
                <div>
                  <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-magenta mb-2 font-semibold">
                    <span>🥗 Nutrition Status</span>
                    <span className="font-mono">{targets ? `${targets.calories} KCAL` : "NO PROFILE"}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide mb-1" style={{ fontFamily: "var(--font-chakra-petch)" }}>
                    {todayDietDay
                      ? `${eatenCount} of ${todayDietDay.meals.length} Meals Logged`
                      : dietPlan
                      ? dietState === "ended"
                        ? "Diet plan ended"
                        : "Diet plan not started"
                      : "No Diet Plan"}
                  </h3>
                  <p className="text-xs text-white/60 mb-2">
                    {targets
                      ? `Target: ${targets.proteinG}g Protein • ${targets.carbsG}g Carbs • ${targets.fatG}g Fat`
                      : "Set up your dietary profile to get calculated macros."}
                  </p>
                  {todayDietDay && targets && (
                    <div className="mb-3">
                      <div className="text-[10px] text-white/50 font-mono">
                        {consumedCalories} / {targets.calories} kcal eaten
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                        <div
                          className="h-full rounded-full bg-neon-magenta transition-all"
                          style={{ width: `${Math.min(100, Math.round((consumedCalories / targets.calories) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <Link
                    href="/diet"
                    className="text-xs text-neon-magenta hover:underline tracking-wider uppercase font-semibold"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    {dietPlan ? "View Meals & Groceries →" : "Create Diet Plan →"}
                  </Link>
                  {todayDietDay && eatenCount < todayDietDay.meals.length && (
                    <button
                      type="button"
                      onClick={quickLogNextMeal}
                      className="text-[10px] px-2 py-0.5 rounded bg-neon-magenta/20 text-neon-pink border border-neon-magenta/40 hover:bg-neon-magenta/30"
                    >
                      + Log Next Meal
                    </button>
                  )}
                </div>
              </div>

              {/* Arena / Privacy */}
              <div className="p-5 rounded-2xl bg-[#080814] border border-neon-violet/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
                <div>
                  <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-violet mb-2 font-semibold">
                    <span>🤖 Live AI Coach</span>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-wide mb-1" style={{ fontFamily: "var(--font-chakra-petch)" }}>
                    Pose-tracked sessions
                  </h3>
                  <p className="text-xs text-white/60 mb-4">
                    Pose detection runs on your device. While a reference video is playing, a snapshot of you and of the video is
                    sent to the AI scorer every few seconds, and short pose summaries go to the coach.
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <Link
                    href="/"
                    className="text-xs text-neon-violet hover:underline tracking-wider uppercase font-semibold"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    Launch Webcam Session →
                  </Link>
                </div>
              </div>
            </div>

            {/* Detailed Sections: Today's Schedule Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Today's Meal Plan Preview */}
              <div className="p-6 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3
                    className="text-sm font-bold uppercase tracking-wider text-neon-cyan flex items-center gap-2"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    <span aria-hidden="true">🥗</span> Today&apos;s Planned Menu
                  </h3>
                  <Link href="/diet" className="text-[11px] text-white/50 hover:text-neon-cyan uppercase">
                    Manage All →
                  </Link>
                </div>

                {todayDietDay ? (
                  <div className="space-y-3">
                    {todayDietDay.meals.map((meal) => {
                      const eaten = todayLogs.get(meal.id)?.eaten;
                      return (
                        <div
                          key={meal.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                            eaten ? "bg-emerald-950/20 border-emerald-500/20" : "bg-white/5 border-white/5"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-neon-cyan">{meal.type}</span>
                              {meal.nutrition.verified && <span className="text-[8px] text-emerald-400">✓ DB</span>}
                              {eaten && <span className="text-[8px] text-emerald-400">EATEN</span>}
                            </div>
                            <div className="font-semibold text-white mt-0.5 truncate">{meal.name}</div>
                          </div>
                          <div className="text-right font-mono shrink-0">
                            <div className="text-neon-cyan font-bold">{meal.nutrition.calories} kcal</div>
                            <div className="text-[10px] text-white/50">{meal.nutrition.proteinG}g P</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/40 text-xs">
                    {dietPlan
                      ? dietState === "ended"
                        ? "Your meal plan has ended. Generate a new week in the Diet Planner."
                        : `Your meal plan starts on ${dietPlan.days[0].date}.`
                      : "No active meal plan. Visit the Diet Planner to generate your plan."}
                  </div>
                )}
              </div>

              {/* Right Column: Today's Workout Routine Preview */}
              <div className="p-6 rounded-2xl bg-black/60 border border-white/10 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3
                    className="text-sm font-bold uppercase tracking-wider text-neon-magenta flex items-center gap-2"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    <span aria-hidden="true">💪</span> Today&apos;s Training Schedule
                  </h3>
                  <Link href="/exercise" className="text-[11px] text-white/50 hover:text-neon-magenta uppercase">
                    Manage All →
                  </Link>
                </div>

                {todayWorkout && todayWorkout.type !== "rest" ? (
                  <div className="space-y-3">
                    {todayExercises.map((ex) => (
                      <div
                        key={ex.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                          ex.status === "completed" ? "bg-emerald-950/20 border-emerald-500/20" : "bg-white/5 border-white/5"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold truncate ${ex.status === "skipped" ? "text-white/40 line-through" : "text-white"}`}>
                              {ex.name}
                            </span>
                            {ex.trackable && (
                              <span className="text-[8px] px-1.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                                Pose Arena
                              </span>
                            )}
                            {ex.status === "completed" && <span className="text-[8px] text-emerald-400">DONE</span>}
                          </div>
                          <div className="text-[10px] text-white/50 mt-0.5">
                            {ex.sets && ex.reps
                              ? `${ex.sets} sets × ${ex.reps} reps`
                              : ex.durationSeconds
                              ? `${ex.sets && ex.sets > 1 ? `${ex.sets} × ` : ""}${ex.durationSeconds >= 120 ? `${Math.round(ex.durationSeconds / 60)} min` : `${ex.durationSeconds}s`}`
                              : "As prescribed"}
                          </div>
                        </div>

                        {ex.trackable ? (
                          <Link
                            href={arenaLink(ex, todayWorkout.id)}
                            className="px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px] tracking-wider uppercase hover:bg-neon-cyan/35 shrink-0"
                            style={{ fontFamily: "var(--font-audiowide)" }}
                          >
                            TRACK →
                          </Link>
                        ) : (
                          <span className="text-[10px] text-white/40 shrink-0">Self-guided</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : todayWorkout ? (
                  <div className="p-8 text-center text-white/50 text-xs">
                    <span aria-hidden="true">🧘 </span>Today is a rest day. Take a light walk and stay hydrated!
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/40 text-xs">{workoutMessage}</div>
                )}
              </div>
            </div>

            {/* Weekly Adherence Grid */}
            <div className="p-6 rounded-2xl bg-black/50 border border-neon-cyan/20">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3
                  className="text-xs uppercase tracking-[0.2em] text-neon-cyan font-bold"
                  style={{ fontFamily: "var(--font-audiowide)" }}
                >
                  Weekly Training Adherence
                </h3>
                {exercisePlan && workoutDays.length > 0 && (
                  <span className="text-[10px] text-white/50 font-mono">
                    {workoutsDone} of {workoutDays.length} workouts completed
                  </span>
                )}
              </div>

              {exercisePlan ? (
                <div className="grid grid-cols-7 gap-2 text-center text-xs">
                  {exercisePlan.days.map((s) => {
                    const status = dayStatus(s, today);
                    const isToday = s.plannedDate === today;
                    return (
                      <div
                        key={s.id}
                        className={`p-2 sm:p-3 rounded-xl border ${
                          isToday ? "bg-neon-cyan/10 border-neon-cyan/50" : "bg-white/5 border-white/5"
                        }`}
                      >
                        <div className="text-[10px] text-white/50 uppercase font-semibold">{weekdayShort(s.plannedDate)}</div>
                        <div className="text-[9px] text-white/30">{dayOfMonth(s.plannedDate)}</div>
                        <div className="text-lg my-1" aria-hidden="true">{status.icon}</div>
                        <div className={`text-[9px] truncate ${status.tone}`}>{status.label}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-white/40">
                  No workout plan yet. <Link href="/exercise" className="text-neon-cyan hover:underline">Create one</Link> to track
                  your week here.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
