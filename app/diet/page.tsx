"use client";

import { useMemo, useRef, useState } from "react";
import {
  savePreferences,
  getPreferences,
  saveWeeklyDietPlan,
  addNutritionLog,
} from "../lib/storage";
import type { WeeklyDietPlan, DayPlan } from "../lib/storage";
import type { UserProfile, MacroTargets } from "../lib/nutrition";
import { computeMacroTargets, macroEnergyShare } from "../lib/nutrition";
import { defaultDayIndex, dayOfMonth, planWindow, toLocalDateString, weekdayShort } from "../lib/dates";
import { ApiError, postJson } from "../lib/api";
import { useHydrated, useNutritionLogs, usePreferences, useToday, useWeeklyDietPlan } from "../lib/useAppData";
import DietOnboardingModal from "../components/diet/DietOnboardingModal";
import MealCard from "../components/diet/MealCard";
import GroceryListView from "../components/diet/GroceryListView";
import NutritionChat from "../components/diet/NutritionChat";

interface PlanError {
  message: string;
  isSafetyNotice: boolean;
}

const SOURCE_LABELS: Record<NonNullable<WeeklyDietPlan["source"]>, string> = {
  ai: "AI-written meals",
  mixed: "Mix of AI-written and built-in meals",
  builtin: "Built-in meal bank (AI unavailable)",
};

function ProgressBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5" role="presentation">
      <div className={`h-full rounded-full transition-all duration-300 ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DietPage() {
  const hydrated = useHydrated();
  const today = useToday();
  const prefs = usePreferences();
  const plan = useWeeklyDietPlan();
  const allLogs = useNutritionLogs();
  const profile: UserProfile | undefined = prefs.dietProfile;

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"plan" | "grocery">("plan");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PlanError | null>(null);
  const generating = useRef(false);

  const dates = useMemo(() => plan?.days.map((d) => d.date) ?? [], [plan]);
  const activeDayIndex = Math.min(selectedDay ?? defaultDayIndex(dates, today), Math.max(0, dates.length - 1));
  const activeDay: DayPlan | undefined = plan?.days[activeDayIndex];
  const planState = planWindow(dates, today);
  const targets: MacroTargets | null = useMemo(() => (profile ? computeMacroTargets(profile) : null), [profile]);

  // What the user has logged for the day on screen, straight from storage (always in sync with MealCard).
  const dayLogs = useMemo(() => {
    const map: Record<string, { eaten: boolean; portion: number }> = {};
    if (!activeDay) return map;
    for (const l of allLogs) {
      if (l.date === activeDay.date) map[l.mealId] = { eaten: l.eaten, portion: l.portionMultiplier };
    }
    return map;
  }, [allLogs, activeDay]);

  let consumedCalories = 0;
  let consumedProtein = 0;
  if (activeDay) {
    for (const m of activeDay.meals) {
      const log = dayLogs[m.id];
      if (log?.eaten) {
        consumedCalories += Math.round(m.nutrition.calories * log.portion);
        consumedProtein += Math.round(m.nutrition.proteinG * log.portion);
      }
    }
  }

  const generateDietPlan = async (userProfile: UserProfile) => {
    if (generating.current) return; // a double-click must not start two (billable) generations
    generating.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ plan: WeeklyDietPlan }>("/api/diet/plan", {
        ...userProfile,
        startDate: toLocalDateString(),
      });
      saveWeeklyDietPlan(data.plan);
      setSelectedDay(null);
      setActiveTab("plan");
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Something went wrong generating your diet plan.",
        isSafetyNotice: err instanceof ApiError && err.isSafetyNotice,
      });
    } finally {
      generating.current = false;
      setLoading(false);
    }
  };

  const handleSaveProfile = async (newProfile: UserProfile) => {
    // Saved first so a failed generation doesn't make the user retype everything.
    savePreferences({ ...getPreferences(), dietProfile: newProfile });
    setIsModalOpen(false);
    await generateDietPlan(newProfile);
  };

  const handleToggleEaten = (mealId: string, mealName: string, eaten: boolean, portion: number) => {
    if (!activeDay) return;
    addNutritionLog({
      date: activeDay.date,
      mealId,
      mealName,
      eaten,
      portionMultiplier: portion,
      loggedAt: new Date().toISOString(),
    });
  };

  const share = targets ? macroEnergyShare(targets) : null;

  return (
    <div className="flex-1 arena text-white p-4 sm:p-6 flex flex-col relative overflow-x-hidden">
      {/* Background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      {/* Top Banner */}
      <div className="max-w-6xl w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-[0.18em] uppercase neon-title"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            AI DIET PLANNER
          </h1>
          <p className="text-xs text-neon-cyan/70 tracking-widest uppercase">
            Indian-First Macros • Allergen Safe • Deterministic Nutrition
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <div className="flex bg-black/50 border border-white/10 rounded-lg p-1" role="tablist">
              {(["plan", "grocery"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-xs tracking-wider uppercase transition-colors ${
                    activeTab === tab ? "bg-neon-cyan/20 text-neon-cyan font-bold" : "text-white/60 hover:text-white"
                  }`}
                >
                  {tab === "plan" ? "Meal Plan" : "Grocery List"}
                </button>
              ))}
            </div>
          )}

          {profile && (
            <button
              type="button"
              onClick={() => generateDietPlan(profile)}
              disabled={loading}
              title="Generate a fresh plan from your saved profile"
              className="px-3 py-2 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-all text-xs tracking-wider uppercase disabled:opacity-40"
            >
              ↻ New plan
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 transition-all text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span aria-hidden="true">⚙️</span> {profile ? "EDIT PROFILE" : "GET STARTED"}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className={`max-w-6xl w-full mx-auto mb-6 p-4 rounded-xl border text-xs flex items-start justify-between gap-3 relative z-10 ${
            error.isSafetyNotice
              ? "bg-amber-950/50 border-amber-500/50 text-amber-100"
              : "bg-red-950/60 border-red-500/50 text-red-200"
          }`}
        >
          <span className="leading-relaxed">
            {error.isSafetyNotice && <span aria-hidden="true">⚠️ </span>}
            {error.message}
          </span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="font-bold px-2 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Not yet hydrated: avoid flashing the empty state before the saved plan is read */}
      {!hydrated && <div className="flex-1" aria-busy="true" />}

      {/* Loading state */}
      {hydrated && loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative z-10" role="status">
          <div className="w-16 h-16 rounded-full border-4 border-neon-cyan border-t-transparent animate-spin mb-4" />
          <h2
            className="text-lg uppercase tracking-widest text-neon-cyan animate-pulse"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Synthesizing Nutrition Engine...
          </h2>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Calculating your calorie target, drafting seven days of meals, checking every ingredient against your allergies and
            matching portions to your target. This can take up to a minute.
          </p>
        </div>
      )}

      {/* Empty State / Welcome */}
      {hydrated && !loading && !plan && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto text-center p-8 bg-black/60 border border-neon-cyan/20 rounded-2xl relative z-10 shadow-2xl">
          <div className="text-5xl mb-4" aria-hidden="true">🥗</div>
          <h2
            className="text-xl uppercase tracking-widest text-neon-cyan font-bold mb-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            No Active Diet Plan
          </h2>
          <p className="text-xs text-white/70 leading-relaxed mb-6">
            Tell FitVeda about your weight goals, dietary style (Vegetarian, Vegan, Eggetarian, Non-Veg), allergies, and budget.
            We calculate your exact calorie target in code, then build a weekly Indian-first meal plan that is checked against
            your allergies and sized to that target.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-full bg-linear-to-r from-neon-cyan to-neon-magenta text-black font-bold text-xs tracking-[0.2em] uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            CREATE YOUR AI DIET PLAN ✨
          </button>
        </div>
      )}

      {/* Main Content: Plan Active */}
      {hydrated && !loading && plan && (
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 relative z-10">
          {planState === "ended" && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-100 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>This plan ended on {plan.days[plan.days.length - 1].date}. Generate a fresh week to keep logging meals.</span>
              {profile && (
                <button
                  type="button"
                  onClick={() => generateDietPlan(profile)}
                  className="px-3 py-1 rounded border border-amber-400/50 text-amber-200 hover:bg-amber-500/10 uppercase tracking-wider text-[10px]"
                >
                  ↻ New plan
                </button>
              )}
            </div>
          )}
          {planState === "upcoming" && (
            <div className="p-3 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs">
              This plan starts on {plan.days[0].date}.
            </div>
          )}

          {/* Targets Bar */}
          {targets && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-black/50 border border-neon-cyan/20 backdrop-blur-md">
              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Target Calories</div>
                <div className="text-xl font-bold text-neon-cyan font-mono">
                  {targets.calories} <span className="text-xs font-normal text-white/60">kcal</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">Eaten: {consumedCalories} kcal</div>
                <ProgressBar value={consumedCalories} max={targets.calories} className="bg-emerald-400" />
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Target Protein</div>
                <div className="text-xl font-bold text-neon-magenta font-mono">{targets.proteinG}g</div>
                <div className="text-[10px] text-neon-pink mt-0.5">Eaten: {consumedProtein}g</div>
                <ProgressBar value={consumedProtein} max={targets.proteinG} className="bg-neon-pink" />
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Target Carbs</div>
                <div className="text-xl font-bold text-neon-yellow font-mono">{targets.carbsG}g</div>
                <div className="text-[10px] text-white/40 mt-0.5">{share?.carbs}% of energy</div>
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Target Fat</div>
                <div className="text-xl font-bold text-neon-pink font-mono">{targets.fatG}g</div>
                <div className="text-[10px] text-white/40 mt-0.5">{share?.fat}% of energy</div>
              </div>
            </div>
          )}

          {plan.source && (
            <p className="text-[10px] text-white/40 tracking-wider uppercase -mt-3 px-1">
              {SOURCE_LABELS[plan.source]}
              {plan.notes?.includes("Portions were scaled") ? " • portions sized to your target" : ""}
            </p>
          )}

          {activeTab === "grocery" ? (
            <GroceryListView planId={plan.id} items={plan.groceryList} />
          ) : (
            <>
              {/* Day Selector Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Plan days">
                {plan.days.map((day, idx) => {
                  const isSelected = activeDayIndex === idx;
                  const isToday = day.date === today;

                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedDay(idx)}
                      className={`px-4 py-2 rounded-xl border text-xs tracking-wider uppercase transition-all whitespace-nowrap flex flex-col items-center min-w-18.75 ${
                        isSelected
                          ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold shadow-[0_0_15px_rgba(0,255,255,0.25)]"
                          : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className="text-[10px] opacity-70">{isToday ? "Today" : `Day ${idx + 1}`}</span>
                      <span className="font-semibold text-sm">{weekdayShort(day.date)}</span>
                      <span className="text-[9px] opacity-60">{dayOfMonth(day.date)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Day Header Info */}
              {activeDay && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/70 px-1">
                  <div>
                    Planned Day Total:{" "}
                    <span className="font-bold text-neon-cyan">{activeDay.totalNutrition.calories} kcal</span>
                    {targets && (
                      <span className="text-white/40">
                        {" "}
                        ({Math.round((activeDay.totalNutrition.calories / targets.calories) * 100)}% of target)
                      </span>
                    )}{" "}
                    • Protein:{" "}
                    <span className="font-bold text-neon-magenta">{activeDay.totalNutrition.proteinG}g</span>
                    {targets && (
                      <span className="text-white/40">
                        {" "}
                        ({Math.round((activeDay.totalNutrition.proteinG / targets.proteinG) * 100)}% of target)
                      </span>
                    )}
                    {activeDay.portionScale && (
                      <span className="text-white/40"> • portions ×{activeDay.portionScale} to fit your target</span>
                    )}
                  </div>
                  <div>
                    {activeDay.totalNutrition.verified ? (
                      <span className="text-emerald-400">✓ All ingredients matched to the nutrition database</span>
                    ) : (
                      <span className="text-amber-400">~ Some ingredients are estimated</span>
                    )}
                  </div>
                </div>
              )}

              {/* Meals Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDay?.meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    isEaten={dayLogs[meal.id]?.eaten ?? false}
                    portionMultiplier={dayLogs[meal.id]?.portion ?? 1}
                    onToggleEaten={(eaten, portion) => handleToggleEaten(meal.id, meal.name, eaten, portion)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Assistant & Onboarding Modals */}
      <DietOnboardingModal
        isOpen={isModalOpen}
        initialProfile={profile}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
      />

      <NutritionChat profile={profile} activeDayPlan={activeDay} targetCalories={targets?.calories} />
    </div>
  );
}
