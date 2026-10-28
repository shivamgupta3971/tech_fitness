"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getPreferences,
  getWeeklyDietPlan,
  getWeeklyExercisePlan,
  getNutritionLogsForDate,
  addNutritionLog,
  updateExerciseStatus,
  updateWorkoutSessionStatus,
} from "../lib/storage";
import type {
  WeeklyDietPlan,
  WeeklyExercisePlan,
  WorkoutSession,
  DayPlan,
} from "../lib/storage";
import type { MacroTargets } from "../lib/nutrition";
import { computeMacroTargets } from "../lib/nutrition";

export default function DashboardPage() {
  const [username, setUsername] = useState("Athlete");
  const [dietPlan, setDietPlan] = useState<WeeklyDietPlan | null>(null);
  const [exercisePlan, setExercisePlan] = useState<WeeklyExercisePlan | null>(null);
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  const [todayDateStr, setTodayDateStr] = useState("");
  const [todayDietDay, setTodayDietDay] = useState<DayPlan | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutSession | null>(null);
  const [eatenCount, setEatenCount] = useState(0);

  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.username) setUsername(prefs.username);
    if (prefs.dietProfile) {
      setTargets(computeMacroTargets(prefs.dietProfile));
    }

    const todayStr = new Date().toISOString().split("T")[0];
    setTodayDateStr(todayStr);

    const dPlan = getWeeklyDietPlan();
    setDietPlan(dPlan);
    if (dPlan && dPlan.days.length > 0) {
      // Find today or fallback to first day
      const day = dPlan.days.find((d) => d.date === todayStr) || dPlan.days[0];
      setTodayDietDay(day);

      const logs = getNutritionLogsForDate(day.date);
      setEatenCount(logs.filter((l) => l.eaten).length);
    }

    const exPlan = getWeeklyExercisePlan();
    setExercisePlan(exPlan);
    if (exPlan && exPlan.days.length > 0) {
      const workout = exPlan.days.find((d) => d.plannedDate === todayStr) || exPlan.days[0];
      setTodayWorkout(workout);
    }
  }, []);

  // Quick action: quick mark meal eaten
  const quickLogFirstPendingMeal = () => {
    if (!todayDietDay) return;
    const logs = getNutritionLogsForDate(todayDietDay.date);
    const eatenMealIds = new Set(logs.filter((l) => l.eaten).map((l) => l.mealId));
    const pendingMeal = todayDietDay.meals.find((m) => !eatenMealIds.has(m.id));
    if (pendingMeal) {
      addNutritionLog({
        date: todayDietDay.date,
        mealId: pendingMeal.id,
        mealName: pendingMeal.name,
        eaten: true,
        portionMultiplier: 1.0,
        loggedAt: new Date().toISOString(),
      });
      setEatenCount((c) => c + 1);
    }
  };

  const totalExercisesToday = todayWorkout
    ? todayWorkout.warmup.length + todayWorkout.main.length + todayWorkout.cooldown.length
    : 0;

  const completedExercisesToday = todayWorkout
    ? [...todayWorkout.warmup, ...todayWorkout.main, ...todayWorkout.cooldown].filter(
        (e) => e.status === "completed"
      ).length
    : 0;

  return (
    <div className="flex-1 arena text-white p-4 sm:p-8 flex flex-col relative overflow-x-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="max-w-6xl w-full mx-auto flex flex-col gap-8 relative z-10">
        {/* Welcome Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neon-cyan/20">
          <div>
            <div className="text-[10px] text-neon-cyan tracking-[0.25em] uppercase font-semibold">
              FitVeda Unified Command
            </div>
            <h1
              className="text-2xl sm:text-4xl font-bold tracking-[0.15em] uppercase neon-title mt-1"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              WELCOME BACK, {username}
            </h1>
            <p className="text-xs text-white/50 tracking-wider uppercase mt-1">
              Today: {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-violet text-black font-bold text-xs tracking-[0.2em] uppercase hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)] flex items-center gap-2"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              <span>📹</span> START LIVE ARENA
            </Link>
          </div>
        </div>

        {/* Quick Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Today's Workout Quick Card */}
          <div className="p-5 rounded-2xl bg-[#080814] border border-neon-cyan/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-cyan mb-2 font-semibold">
                <span>💪 Workout Overview</span>
                <span className="font-mono">{todayWorkout ? todayWorkout.type.toUpperCase() : "NO PLAN"}</span>
              </div>
              <h3
                className="text-lg font-bold text-white tracking-wide mb-1"
                style={{ fontFamily: "var(--font-chakra-petch)" }}
              >
                {todayWorkout ? todayWorkout.title : "No Workout Scheduled"}
              </h3>
              <p className="text-xs text-white/60 mb-4">
                {todayWorkout && todayWorkout.type !== "rest"
                  ? `${completedExercisesToday} of ${totalExercisesToday} movements completed`
                  : todayWorkout
                  ? "Rest & recovery day. Focus on hydration and mobility."
                  : "Create an AI workout routine to see your scheduled sessions."}
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <Link
                href="/exercise"
                className="text-xs text-neon-cyan hover:underline tracking-wider uppercase font-semibold"
                style={{ fontFamily: "var(--font-audiowide)" }}
              >
                {todayWorkout ? "Open Workout →" : "Create Plan →"}
              </Link>
              {todayWorkout && todayWorkout.main.some((e) => e.trackable) && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40">
                  Pose Trackable
                </span>
              )}
            </div>
          </div>

          {/* Today's Nutrition Quick Card */}
          <div className="p-5 rounded-2xl bg-[#080814] border border-neon-magenta/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-magenta mb-2 font-semibold">
                <span>🥗 Nutrition Status</span>
                <span className="font-mono">{targets ? `${targets.calories} KCAL` : "NO PROFILE"}</span>
              </div>
              <h3
                className="text-lg font-bold text-white tracking-wide mb-1"
                style={{ fontFamily: "var(--font-chakra-petch)" }}
              >
                {todayDietDay ? `${eatenCount} of ${todayDietDay.meals.length} Meals Logged` : "No Diet Plan"}
              </h3>
              <p className="text-xs text-white/60 mb-4">
                {targets
                  ? `Target: ${targets.proteinG}g Protein • ${targets.carbsG}g Carbs • ${targets.fatG}g Fat`
                  : "Set up your clinical dietary profile for calculated macros."}
              </p>
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
                  onClick={quickLogFirstPendingMeal}
                  className="text-[10px] px-2 py-0.5 rounded bg-neon-magenta/20 text-neon-pink border border-neon-magenta/40 hover:bg-neon-magenta/30"
                >
                  + Log Next Meal
                </button>
              )}
            </div>
          </div>

          {/* AI Coach & Insights Card */}
          <div className="p-5 rounded-2xl bg-[#080814] border border-neon-violet/20 flex flex-col justify-between shadow-xl backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between text-[10px] tracking-wider uppercase text-neon-violet mb-2 font-semibold">
                <span>🤖 AI Biometrics Coach</span>
                <span className="text-emerald-400 font-mono">ACTIVE</span>
              </div>
              <h3
                className="text-lg font-bold text-white tracking-wide mb-1"
                style={{ fontFamily: "var(--font-chakra-petch)" }}
              >
                MediaPipe Pose WASM
              </h3>
              <p className="text-xs text-white/60 mb-4">
                Full-body landmark estimation at 30 FPS. Real-time form scoring on squats, lunges, and dance choreography with zero video data leaving your device.
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
              <span className="text-[9px] text-white/40">100% Private</span>
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
                <span>🥗</span> Today's Planned Menu
              </h3>
              <Link href="/diet" className="text-[11px] text-white/50 hover:text-neon-cyan uppercase">
                Manage All →
              </Link>
            </div>

            {todayDietDay ? (
              <div className="space-y-3">
                {todayDietDay.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-neon-cyan">
                          {meal.type}
                        </span>
                        {meal.nutrition.verified && (
                          <span className="text-[8px] text-emerald-400">✓ DB</span>
                        )}
                      </div>
                      <div className="font-semibold text-white mt-0.5">{meal.name}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-neon-cyan font-bold">{meal.nutrition.calories} kcal</div>
                      <div className="text-[10px] text-white/50">{meal.nutrition.proteinG}g P</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-white/40 text-xs">
                No active meal plan. Visit the Diet Planner to generate your plan.
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
                <span>💪</span> Today's Training Schedule
              </h3>
              <Link href="/exercise" className="text-[11px] text-white/50 hover:text-neon-magenta uppercase">
                Manage All →
              </Link>
            </div>

            {todayWorkout && todayWorkout.type !== "rest" ? (
              <div className="space-y-3">
                {[...todayWorkout.warmup, ...todayWorkout.main, ...todayWorkout.cooldown].map(
                  (ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{ex.name}</span>
                          {ex.trackable && (
                            <span className="text-[8px] px-1.5 py-0.2 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                              Pose Arena
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/50 mt-0.5">
                          {ex.sets ? `${ex.sets} sets × ${ex.reps || "reps"}` : `${ex.durationSeconds || 45}s hold`}
                        </div>
                      </div>

                      {ex.trackable ? (
                        <Link
                          href={`/?mode=${ex.trackingMode === "dance" ? "dance" : "gym"}&exercise=${ex.catalogId}`}
                          className="px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px] tracking-wider uppercase hover:bg-neon-cyan/35"
                          style={{ fontFamily: "var(--font-audiowide)" }}
                        >
                          TRACK →
                        </Link>
                      ) : (
                        <span className="text-[10px] text-white/40">Self-guided</span>
                      )}
                    </div>
                  )
                )}
              </div>
            ) : todayWorkout ? (
              <div className="p-8 text-center text-white/50 text-xs">
                🧘 Today is designated as a Rest & Recovery day. Take a light walk and stay hydrated!
              </div>
            ) : (
              <div className="p-8 text-center text-white/40 text-xs">
                No active exercise plan. Visit the Exercise Planner to generate your routine.
              </div>
            )}
          </div>
        </div>

        {/* Weekly Adherence Grid */}
        <div className="p-6 rounded-2xl bg-black/50 border border-neon-cyan/20">
          <h3
            className="text-xs uppercase tracking-[0.2em] text-neon-cyan font-bold mb-4"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Weekly Protocol Adherence
          </h3>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName, idx) => {
              const exDay = exercisePlan?.days[idx];
              const isRest = exDay?.type === "rest";
              const isDone = exDay?.status === "completed";

              return (
                <div key={dayName} className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-[10px] text-white/50 uppercase mb-1 font-semibold">
                    {dayName}
                  </div>
                  <div className="text-lg my-1">
                    {isRest ? "🧘" : isDone ? "✅" : "🏋️"}
                  </div>
                  <div className="text-[9px] text-white/40 truncate">
                    {isRest ? "Rest" : isDone ? "Done" : "Planned"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
