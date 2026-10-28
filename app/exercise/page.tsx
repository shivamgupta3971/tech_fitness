"use client";

import { useEffect, useState } from "react";
import {
  getPreferences,
  savePreferences,
  getWeeklyExercisePlan,
  saveWeeklyExercisePlan,
  updateExerciseStatus,
  updateWorkoutSessionStatus,
} from "../../app/lib/storage";
import type {
  WeeklyExercisePlan,
  WorkoutSession,
  ExercisePreferences,
  PlannedExercise,
} from "../../app/lib/storage";
import ExerciseOnboardingModal from "../components/exercise/ExerciseOnboardingModal";
import ExerciseItemCard from "../components/exercise/ExerciseItemCard";

export default function ExercisePage() {
  const [prefs, setPrefs] = useState<ExercisePreferences | null>(null);
  const [plan, setPlan] = useState<WeeklyExercisePlan | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adaptiveSuggestion, setAdaptiveSuggestion] = useState<string | null>(null);

  useEffect(() => {
    const p = getPreferences();
    if (p.exercisePrefs) setPrefs(p.exercisePrefs);
    const currentPlan = getWeeklyExercisePlan();
    if (currentPlan) {
      setPlan(currentPlan);
    }
  }, []);

  const handleSavePreferences = async (newPrefs: ExercisePreferences) => {
    setPrefs(newPrefs);
    savePreferences({ ...getPreferences(), exercisePrefs: newPrefs });
    setIsModalOpen(false);
    await generateExercisePlan(newPrefs);
  };

  const generateExercisePlan = async (userPrefs: ExercisePreferences) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exercise/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userPrefs),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate exercise plan");
      }

      setPlan(data.plan);
      saveWeeklyExercisePlan(data.plan);
      setActiveDayIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error generating exercise routine");
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseStatus = (
    sessionId: string,
    exerciseId: string,
    status: PlannedExercise["status"],
    notes?: string
  ) => {
    updateExerciseStatus(sessionId, exerciseId, status, notes);
    // Reload local state
    const updated = getWeeklyExercisePlan();
    if (updated) {
      setPlan({ ...updated });
      // Adaptive heuristic check
      if (status === "modified" || status === "skipped") {
        setAdaptiveSuggestion(
          "Adaptive suggestion: We noticed you modified/skipped this movement. Would you like to substitute it with its lighter beginner variation on upcoming days?"
        );
      } else if (status === "completed") {
        setAdaptiveSuggestion(
          "Solid form! Progressive Overload: You've completed your planned target. Try adding +1 rep or +5s hold next week."
        );
      }
    }
  };

  const handleSessionStatus = (sessionId: string, status: WorkoutSession["status"]) => {
    updateWorkoutSessionStatus(sessionId, status, status === "completed" ? new Date().toISOString() : undefined);
    const updated = getWeeklyExercisePlan();
    if (updated) setPlan({ ...updated });
  };

  const activeSession: WorkoutSession | undefined = plan?.days[activeDayIndex];

  return (
    <div className="flex-1 arena text-white p-4 sm:p-6 flex flex-col relative overflow-x-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-3" />

      {/* Top Banner */}
      <div className="max-w-6xl w-full mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-[0.18em] uppercase neon-title"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            AI EXERCISE PLANNER
          </h1>
          <p className="text-xs text-neon-cyan/70 tracking-widest uppercase">
            Catalog-Verified • Real-Time Arena Tracking • Adaptive Progress
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 transition-all text-xs tracking-wider uppercase font-semibold flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,255,255,0.2)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>⚙️</span> {prefs ? "EDIT PREFERENCES" : "GET STARTED"}
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

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative z-10">
          <div className="w-16 h-16 rounded-full border-4 border-neon-magenta border-t-transparent animate-spin mb-4" />
          <h2
            className="text-lg uppercase tracking-widest text-neon-pink animate-pulse"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Synthesizing Workout Schedule...
          </h2>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Validating equipment matching, filtering catalog movements, and configuring trackable Arena routines.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !plan && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto text-center p-8 bg-black/60 border border-neon-cyan/20 rounded-2xl relative z-10 shadow-2xl">
          <div className="text-5xl mb-4">💪</div>
          <h2
            className="text-xl uppercase tracking-widest text-neon-cyan font-bold mb-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            No Active Workout Plan
          </h2>
          <p className="text-xs text-white/70 leading-relaxed mb-6">
            Configure your training goals, equipment access, preferred days, and limitation avoid-lists. FitVeda will generate a balanced 7-day schedule with one-click links to launch our live webcam AI coach on squats, pushups, lunges, and dance cardio.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta text-black font-bold text-xs tracking-[0.2em] uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            CREATE YOUR AI WORKOUT PLAN ✨
          </button>
        </div>
      )}

      {/* Plan Active View */}
      {!loading && plan && (
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 relative z-10">
          {/* Adaptive Suggestion Banner (Rule-Based Overload / Modification) */}
          {adaptiveSuggestion && (
            <div className="p-4 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="text-base">📈</span>
                <span className="leading-relaxed">{adaptiveSuggestion}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setAdaptiveSuggestion(null)}
                  className="px-2.5 py-1 rounded bg-neon-cyan/20 text-neon-cyan font-bold text-[10px] uppercase hover:bg-neon-cyan/30"
                >
                  Accept
                </button>
                <button
                  onClick={() => setAdaptiveSuggestion(null)}
                  className="text-white/40 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* 7-Day Day Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {plan.days.map((session, idx) => {
              const sessionDate = new Date(session.plannedDate + "T00:00:00");
              const dayName = sessionDate.toLocaleDateString("en-US", { weekday: "short" });
              const isSelected = activeDayIndex === idx;
              const isRest = session.type === "rest";

              return (
                <button
                  key={session.id}
                  onClick={() => setActiveDayIndex(idx)}
                  className={`px-4 py-2.5 rounded-xl border text-xs tracking-wider uppercase transition-all whitespace-nowrap flex flex-col items-center min-w-[85px] ${
                    isSelected
                      ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold shadow-[0_0_15px_rgba(0,255,255,0.25)]"
                      : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="text-[10px] opacity-60">Day {idx + 1}</span>
                  <span className="font-semibold text-sm">{dayName}</span>
                  <span
                    className={`text-[9px] mt-1 px-1.5 py-0.2 rounded font-mono ${
                      isRest
                        ? "text-white/40 bg-white/5"
                        : session.status === "completed"
                        ? "text-emerald-400 bg-emerald-950/40"
                        : "text-neon-magenta bg-neon-magenta/10"
                    }`}
                  >
                    {isRest ? "REST" : session.status === "completed" ? "DONE ✓" : "WORKOUT"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Session Content */}
          {activeSession && (
            <div className="flex flex-col gap-6">
              {/* Session Top Card */}
              <div className="p-5 rounded-2xl bg-[#080814] border border-neon-cyan/25 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="text-[10px] text-neon-cyan tracking-widest uppercase mb-1 font-semibold">
                    Day {activeDayIndex + 1} Routine • {activeSession.type.replace("_", " ").toUpperCase()}
                  </div>
                  <h2
                    className="text-xl sm:text-2xl font-bold text-white tracking-wide"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    {activeSession.title}
                  </h2>
                  <div className="text-xs text-white/60 mt-1">
                    {activeSession.type === "rest"
                      ? "Take this time to hydrate, stretch, and allow muscle glycogen replenishment."
                      : `${activeSession.warmup.length + activeSession.main.length + activeSession.cooldown.length} movements total • Form cues enabled`}
                  </div>
                </div>

                {activeSession.type !== "rest" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleSessionStatus(
                          activeSession.id,
                          activeSession.status === "completed" ? "pending" : "completed"
                        )
                      }
                      className={`px-4 py-2 rounded-xl text-xs tracking-wider uppercase font-bold transition-all shadow-lg ${
                        activeSession.status === "completed"
                          ? "bg-emerald-600 text-white shadow-emerald-900/50"
                          : "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
                      }`}
                      style={{ fontFamily: "var(--font-audiowide)" }}
                    >
                      {activeSession.status === "completed" ? "✓ WORKOUT COMPLETED" : "MARK SESSION DONE"}
                    </button>
                  </div>
                )}
              </div>

              {/* Rest Day Card */}
              {activeSession.type === "rest" && (
                <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 max-w-lg mx-auto">
                  <div className="text-4xl mb-3">🧘</div>
                  <h3
                    className="text-lg uppercase tracking-wider text-white font-bold mb-2"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    Recovery & Regeneration
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Muscles grow and repair during rest intervals. Focus on protein intake, 8+ hours of sleep, and gentle mobility or light walks.
                  </p>
                </div>
              )}

              {/* Workout Sections */}
              {activeSession.type !== "rest" && (
                <div className="space-y-6">
                  {/* Warmup Section */}
                  {activeSession.warmup.length > 0 && (
                    <div>
                      <h3
                        className="text-xs tracking-[0.2em] uppercase text-neon-yellow font-bold mb-3 flex items-center gap-2"
                        style={{ fontFamily: "var(--font-audiowide)" }}
                      >
                        <span>🔥</span> 1. WARM-UP & MOBILITY ({activeSession.warmup.length} Movements)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeSession.warmup.map((ex) => (
                          <ExerciseItemCard
                            key={ex.id}
                            exercise={ex}
                            onStatusChange={(status, notes) =>
                              handleExerciseStatus(activeSession.id, ex.id, status, notes)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Main Work Section */}
                  {activeSession.main.length > 0 && (
                    <div>
                      <h3
                        className="text-xs tracking-[0.2em] uppercase text-neon-cyan font-bold mb-3 flex items-center gap-2"
                        style={{ fontFamily: "var(--font-audiowide)" }}
                      >
                        <span>⚡</span> 2. MAIN ROUTINE ({activeSession.main.length} Exercises)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeSession.main.map((ex) => (
                          <ExerciseItemCard
                            key={ex.id}
                            exercise={ex}
                            onStatusChange={(status, notes) =>
                              handleExerciseStatus(activeSession.id, ex.id, status, notes)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cooldown Section */}
                  {activeSession.cooldown.length > 0 && (
                    <div>
                      <h3
                        className="text-xs tracking-[0.2em] uppercase text-neon-green font-bold mb-3 flex items-center gap-2"
                        style={{ fontFamily: "var(--font-audiowide)" }}
                      >
                        <span>🧊</span> 3. COOLDOWN & STRETCH ({activeSession.cooldown.length} Exercises)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeSession.cooldown.map((ex) => (
                          <ExerciseItemCard
                            key={ex.id}
                            exercise={ex}
                            onStatusChange={(status, notes) =>
                              handleExerciseStatus(activeSession.id, ex.id, status, notes)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding Wizard Modal */}
      <ExerciseOnboardingModal
        isOpen={isModalOpen}
        initialPrefs={prefs || undefined}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePreferences}
      />
    </div>
  );
}
