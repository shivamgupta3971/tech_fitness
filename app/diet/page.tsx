"use client";

import { useEffect, useState } from "react";
import {
  getPreferences,
  savePreferences,
  getWeeklyDietPlan,
  saveWeeklyDietPlan,
  getNutritionLogsForDate,
  addNutritionLog,
} from "../lib/storage";
import type { WeeklyDietPlan, DayPlan } from "../lib/storage";
import type { UserProfile, MacroTargets } from "../lib/nutrition";
import { computeMacroTargets } from "../lib/nutrition";
import DietOnboardingModal from "../components/diet/DietOnboardingModal";
import MealCard from "../components/diet/MealCard";
import GroceryListView from "../components/diet/GroceryListView";
import NutritionChat from "../components/diet/NutritionChat";

export default function DietPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<WeeklyDietPlan | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<"plan" | "grocery">("plan");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eatenLogs, setEatenLogs] = useState<Record<string, { eaten: boolean; portion: number }>>({});

  // Load from local storage
  useEffect(() => {
    const prefs = getPreferences();
    if (prefs.dietProfile) {
      setProfile(prefs.dietProfile);
    }
    const currentPlan = getWeeklyDietPlan();
    if (currentPlan) {
      setPlan(currentPlan);
    }
  }, []);

  // Update eaten logs when day changes
  useEffect(() => {
    if (!plan || !plan.days[activeDayIndex]) return;
    const date = plan.days[activeDayIndex].date;
    const logs = getNutritionLogsForDate(date);
    const map: Record<string, { eaten: boolean; portion: number }> = {};
    for (const l of logs) {
      map[l.mealId] = { eaten: l.eaten, portion: l.portionMultiplier };
    }
    setEatenLogs(map);
  }, [plan, activeDayIndex]);

  const handleSaveProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    savePreferences({ ...getPreferences(), dietProfile: newProfile });
    setIsModalOpen(false);
    await generateDietPlan(newProfile);
  };

  const generateDietPlan = async (userProfile: UserProfile) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/diet/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userProfile),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      setPlan(data.plan);
      saveWeeklyDietPlan(data.plan);
      setActiveDayIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error generating diet plan");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEaten = (mealId: string, mealName: string, eaten: boolean, portion: number) => {
    if (!plan || !plan.days[activeDayIndex]) return;
    const date = plan.days[activeDayIndex].date;
    addNutritionLog({
      date,
      mealId,
      mealName,
      eaten,
      portionMultiplier: portion,
      loggedAt: new Date().toISOString(),
    });
    setEatenLogs((prev) => ({ ...prev, [mealId]: { eaten, portion } }));
  };

  const activeDay: DayPlan | undefined = plan?.days[activeDayIndex];
  const targets: MacroTargets | null = profile ? computeMacroTargets(profile) : null;

  // Calculate consumed totals for today
  let consumedCalories = 0;
  let consumedProtein = 0;
  if (activeDay) {
    for (const m of activeDay.meals) {
      const log = eatenLogs[m.id];
      if (log?.eaten) {
        consumedCalories += Math.round(m.nutrition.calories * log.portion);
        consumedProtein += Math.round(m.nutrition.proteinG * log.portion);
      }
    }
  }

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

        <div className="flex items-center gap-2">
          {plan && (
            <div className="flex bg-black/50 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("plan")}
                className={`px-3 py-1 rounded text-xs tracking-wider uppercase transition-colors ${
                  activeTab === "plan"
                    ? "bg-neon-cyan/20 text-neon-cyan font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Meal Plan
              </button>
              <button
                onClick={() => setActiveTab("grocery")}
                className={`px-3 py-1 rounded text-xs tracking-wider uppercase transition-colors ${
                  activeTab === "grocery"
                    ? "bg-neon-cyan/20 text-neon-cyan font-bold"
                    : "text-white/60 hover:text-white"
                }`}
              >
                Grocery List
              </button>
            </div>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 transition-all text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>⚙️</span> {profile ? "EDIT PROFILE" : "GET STARTED"}
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-6xl w-full mx-auto mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative z-10">
          <div className="w-16 h-16 rounded-full border-4 border-neon-cyan border-t-transparent animate-spin mb-4" />
          <h2
            className="text-lg uppercase tracking-widest text-neon-cyan animate-pulse"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Synthesizing Nutrition Engine...
          </h2>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Analyzing Mifflin-St Jeor caloric limits, calculating verified macro bounds, and generating Indian recipe plans.
          </p>
        </div>
      )}

      {/* Empty State / Welcome */}
      {!loading && !plan && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto text-center p-8 bg-black/60 border border-neon-cyan/20 rounded-2xl relative z-10 shadow-2xl">
          <div className="text-5xl mb-4">🥗</div>
          <h2
            className="text-xl uppercase tracking-widest text-neon-cyan font-bold mb-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            No Active Diet Plan
          </h2>
          <p className="text-xs text-white/70 leading-relaxed mb-6">
            Tell FitVeda about your weight goals, dietary style (Vegetarian, Vegan, Eggetarian, Non-Veg), allergies, and budget. Our deterministic clinical algorithm will compute your exact caloric floor and construct your weekly Indian-first meal plan.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta text-black font-bold text-xs tracking-[0.2em] uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            CREATE YOUR AI DIET PLAN ✨
          </button>
        </div>
      )}

      {/* Main Content: Plan Active */}
      {!loading && plan && (
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 relative z-10">
          {/* Targets Bar */}
          {targets && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-black/50 border border-neon-cyan/20 backdrop-blur-md">
              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">
                  Target Calories
                </div>
                <div className="text-xl font-bold text-neon-cyan font-mono">
                  {targets.calories} <span className="text-xs font-normal text-white/60">kcal</span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">
                  Consumed: {consumedCalories} kcal
                </div>
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">
                  Target Protein
                </div>
                <div className="text-xl font-bold text-neon-magenta font-mono">
                  {targets.proteinG}g
                </div>
                <div className="text-[10px] text-neon-pink mt-0.5">
                  Logged: {consumedProtein}g
                </div>
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">
                  Target Carbs
                </div>
                <div className="text-xl font-bold text-neon-yellow font-mono">
                  {targets.carbsG}g
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">27% energy ratio</div>
              </div>

              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider">Target Fat</div>
                <div className="text-xl font-bold text-neon-pink font-mono">{targets.fatG}g</div>
                <div className="text-[10px] text-white/40 mt-0.5">Essential lipids</div>
              </div>
            </div>
          )}

          {activeTab === "grocery" ? (
            <GroceryListView items={plan.groceryList} />
          ) : (
            <>
              {/* Day Selector Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {plan.days.map((day, idx) => {
                  const dayDate = new Date(day.date + "T00:00:00");
                  const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
                  const isSelected = activeDayIndex === idx;

                  return (
                    <button
                      key={day.date}
                      onClick={() => setActiveDayIndex(idx)}
                      className={`px-4 py-2 rounded-xl border text-xs tracking-wider uppercase transition-all whitespace-nowrap flex flex-col items-center min-w-[75px] ${
                        isSelected
                          ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold shadow-[0_0_15px_rgba(0,255,255,0.25)]"
                          : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <span className="text-[10px] opacity-70">Day {idx + 1}</span>
                      <span className="font-semibold text-sm">{dayName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Day Header Info */}
              {activeDay && (
                <div className="flex items-center justify-between text-xs text-white/70 px-1">
                  <div>
                    Planned Day Total:{" "}
                    <span className="font-bold text-neon-cyan">
                      {activeDay.totalNutrition.calories} kcal
                    </span>{" "}
                    • Protein:{" "}
                    <span className="font-bold text-neon-magenta">
                      {activeDay.totalNutrition.proteinG}g
                    </span>
                  </div>
                  <div>
                    {activeDay.totalNutrition.verified ? (
                      <span className="text-emerald-400">✓ 100% Verified DB Ingredients</span>
                    ) : (
                      <span className="text-amber-400">~ Contains Estimated Ingredients</span>
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
                    isEaten={eatenLogs[meal.id]?.eaten}
                    portionMultiplier={eatenLogs[meal.id]?.portion}
                    onToggleEaten={(eaten, portion) =>
                      handleToggleEaten(meal.id, meal.name, eaten, portion)
                    }
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
        initialProfile={profile || undefined}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
      />

      <NutritionChat profile={profile || undefined} activeDayPlan={activeDay} />
    </div>
  );
}
