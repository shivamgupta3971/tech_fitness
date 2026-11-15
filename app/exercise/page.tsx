"use client";

import { useMemo, useRef, useState } from "react";
import {
  getPreferences,
  getWeeklyExercisePlan,
  savePreferences,
  saveWeeklyExercisePlan,
  archiveExercisePlan,
  updateExerciseStatus,
  updateWorkoutSessionStatus,
} from "../lib/storage";
import type {
  WeeklyExercisePlan,
  WorkoutSession,
  ExercisePreferences,
  PlannedExercise,
} from "../lib/storage";
import { applyAdjustment, suggestAdjustment } from "../lib/adaptive";
import type { AdaptiveSuggestion } from "../lib/adaptive";
import { defaultDayIndex, dayOfMonth, planWindow, toLocalDateString, weekdayShort } from "../lib/dates";
import { postJson } from "../lib/api";
import { useHydrated, usePreferences, useToday, useWeeklyExercisePlan } from "../lib/useAppData";
import ExerciseOnboardingModal from "../components/exercise/ExerciseOnboardingModal";
import ExerciseItemCard from "../components/exercise/ExerciseItemCard";

const SESSION_BADGES: Record<WorkoutSession["type"], { label: string; className: string }> = {
  workout: { label: "WORKOUT", className: "text-neon-magenta bg-neon-magenta/10" },
  active_recovery: { label: "RECOVERY", className: "text-neon-cyan bg-neon-cyan/10" },
  rest: { label: "REST", className: "text-white/40 bg-white/5" },
};

function sessionExercises(s: WorkoutSession): PlannedExercise[] {
  return [...s.warmup, ...s.main, ...s.cooldown];
}

export default function ExercisePage() {
  const hydrated = useHydrated();
  const today = useToday();
  const prefs: ExercisePreferences | undefined = usePreferences().exercisePrefs;
  const plan = useWeeklyExercisePlan();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<AdaptiveSuggestion | null>(null);
  const generating = useRef(false);

  const dates = useMemo(() => plan?.days.map((d) => d.plannedDate) ?? [], [plan]);
  const activeDayIndex = Math.min(selectedDay ?? defaultDayIndex(dates, today), Math.max(0, dates.length - 1));
  const activeSession: WorkoutSession | undefined = plan?.days[activeDayIndex];
  const planState = planWindow(dates, today);

  const generateExercisePlan = async (userPrefs: ExercisePreferences) => {
    if (generating.current) return;
    generating.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await postJson<{ plan: WeeklyExercisePlan }>("/api/exercise/plan", {
        ...userPrefs,
        startDate: toLocalDateString(),
      });
      // Keep last week's progress in history before replacing it.
      const previous = getWeeklyExercisePlan();
      if (previous) archiveExercisePlan(previous);
      saveWeeklyExercisePlan(data.plan);
      setSelectedDay(null);
      setSuggestion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong generating your workout plan.");
    } finally {
      generating.current = false;
      setLoading(false);
    }
  };

  const handleSavePreferences = async (newPrefs: ExercisePreferences) => {
    // Saved first so a failed generation doesn't make the user retype everything.
    savePreferences({ ...getPreferences(), exercisePrefs: newPrefs });
    setIsModalOpen(false);
    await generateExercisePlan(newPrefs);
  };

  const handleExerciseStatus = (
    sessionId: string,
    exerciseId: string,
    status: PlannedExercise["status"],
    notes?: string
  ) => {
    updateExerciseStatus(sessionId, exerciseId, status, notes);
    // The UI re-renders from storage; read the updated plan only to decide whether to offer an adjustment.
    const updated = getWeeklyExercisePlan();
    setSuggestion(updated ? suggestAdjustment(updated, sessionId, exerciseId, status) : null);
  };

  const handleSessionStatus = (sessionId: string, status: WorkoutSession["status"]) => {
    updateWorkoutSessionStatus(sessionId, status);
    setSuggestion(null);
  };

  const acceptSuggestion = () => {
    const current = getWeeklyExercisePlan();
    if (current && suggestion) saveWeeklyExercisePlan(applyAdjustment(current, suggestion));
    setSuggestion(null);
  };

  const sessionProgress = (s: WorkoutSession) => {
    const all = sessionExercises(s);
    const finished = all.filter((e) => e.status !== "pending").length;
    return { done: finished, total: all.length };
  };

  const renderSection = (
    title: string,
    icon: string,
    colorClass: string,
    items: PlannedExercise[],
    session: WorkoutSession
  ) =>
    items.length > 0 && (
      <div>
        <h3
          className={`text-xs tracking-[0.2em] uppercase font-bold mb-3 flex items-center gap-2 ${colorClass}`}
          style={{ fontFamily: "var(--font-audiowide)" }}
        >
          <span aria-hidden="true">{icon}</span> {title} ({items.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((ex) => (
            <ExerciseItemCard
              key={ex.id}
              exercise={ex}
              sessionId={session.id}
              onStatusChange={(status, notes) => handleExerciseStatus(session.id, ex.id, status, notes)}
            />
          ))}
        </div>
      </div>
    );

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

        <div className="flex flex-wrap items-center gap-2">
          {prefs && (
            <button
              type="button"
              onClick={() => generateExercisePlan(prefs)}
              disabled={loading}
              title="Generate a fresh plan from your saved preferences"
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
            <span aria-hidden="true">⚙️</span> {prefs ? "EDIT PREFERENCES" : "GET STARTED"}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="max-w-6xl w-full mx-auto mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-start justify-between gap-3 relative z-10"
        >
          <span className="leading-relaxed">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {!hydrated && <div className="flex-1" aria-busy="true" />}

      {/* Loading State */}
      {hydrated && loading && (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative z-10" role="status">
          <div className="w-16 h-16 rounded-full border-4 border-neon-magenta border-t-transparent animate-spin mb-4" />
          <h2
            className="text-lg uppercase tracking-widest text-neon-pink animate-pulse"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            Synthesizing Workout Schedule...
          </h2>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Matching exercises to your equipment and limitations, spacing your training days and setting sets, reps and rest.
          </p>
        </div>
      )}

      {/* Empty State */}
      {hydrated && !loading && !plan && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto text-center p-8 bg-black/60 border border-neon-cyan/20 rounded-2xl relative z-10 shadow-2xl">
          <div className="text-5xl mb-4" aria-hidden="true">💪</div>
          <h2
            className="text-xl uppercase tracking-widest text-neon-cyan font-bold mb-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            No Active Workout Plan
          </h2>
          <p className="text-xs text-white/70 leading-relaxed mb-6">
            Configure your training goal, equipment, schedule and any limitations. FitVeda builds a 7-day plan using only
            exercises you can actually do, with one-click links to the live webcam coach for the moves it can track.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-full bg-linear-to-r from-neon-cyan to-neon-magenta text-black font-bold text-xs tracking-[0.2em] uppercase hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            CREATE YOUR AI WORKOUT PLAN ✨
          </button>
        </div>
      )}

      {/* Plan Active View */}
      {hydrated && !loading && plan && (
        <div className="max-w-6xl w-full mx-auto flex flex-col gap-6 relative z-10">
          {planState === "ended" && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-100 text-xs flex flex-wrap items-center justify-between gap-2">
              <span>This plan ended on {plan.days[plan.days.length - 1].plannedDate}. Generate a fresh week to keep training.</span>
              {prefs && (
                <button
                  type="button"
                  onClick={() => generateExercisePlan(prefs)}
                  className="px-3 py-1 rounded border border-amber-400/50 text-amber-200 hover:bg-amber-500/10 uppercase tracking-wider text-[10px]"
                >
                  ↻ New plan
                </button>
              )}
            </div>
          )}

          {/* Adaptive suggestion (rule-based); Accept really changes the upcoming sessions */}
          {suggestion && (
            <div role="status" className="p-4 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs flex items-center justify-between gap-4 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="text-base" aria-hidden="true">📈</span>
                <span className="leading-relaxed">{suggestion.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={acceptSuggestion}
                  className="px-2.5 py-1 rounded bg-neon-cyan/20 text-neon-cyan font-bold text-[10px] uppercase hover:bg-neon-cyan/30"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  aria-label="Dismiss suggestion"
                  className="text-white/40 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* 7-Day Day Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Plan days">
            {plan.days.map((session, idx) => {
              const isSelected = activeDayIndex === idx;
              const isToday = session.plannedDate === today;
              const badge =
                session.status === "completed" && session.type !== "rest"
                  ? { label: "DONE ✓", className: "text-emerald-400 bg-emerald-950/40" }
                  : SESSION_BADGES[session.type];

              return (
                <button
                  key={session.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedDay(idx)}
                  className={`px-4 py-2.5 rounded-xl border text-xs tracking-wider uppercase transition-all whitespace-nowrap flex flex-col items-center min-w-21.25 ${
                    isSelected
                      ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold shadow-[0_0_15px_rgba(0,255,255,0.25)]"
                      : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  <span className="text-[10px] opacity-60">{isToday ? "Today" : `Day ${idx + 1}`}</span>
                  <span className="font-semibold text-sm">{weekdayShort(session.plannedDate)}</span>
                  <span className="text-[9px] opacity-60">{dayOfMonth(session.plannedDate)}</span>
                  <span className={`text-[9px] mt-1 px-1.5 rounded font-mono ${badge.className}`}>{badge.label}</span>
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
                      : (() => {
                          const { done, total } = sessionProgress(activeSession);
                          return `${total} movements • ${done} of ${total} logged • Form cues enabled`;
                        })()}
                  </div>
                </div>

                {activeSession.type !== "rest" && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSessionStatus(activeSession.id, activeSession.status === "completed" ? "pending" : "completed")
                    }
                    className={`px-4 py-2 rounded-xl text-xs tracking-wider uppercase font-bold transition-all shadow-lg ${
                      activeSession.status === "completed"
                        ? "bg-emerald-600 text-white shadow-emerald-900/50"
                        : "bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30"
                    }`}
                    style={{ fontFamily: "var(--font-audiowide)" }}
                    title={
                      activeSession.status === "completed"
                        ? "Reopen this session (resets its exercises)"
                        : "Completes every exercise you haven't skipped or modified"
                    }
                  >
                    {activeSession.status === "completed" ? "✓ SESSION COMPLETED — REOPEN" : "MARK SESSION DONE"}
                  </button>
                )}
              </div>

              {/* Rest Day Card */}
              {activeSession.type === "rest" && (
                <div className="p-8 text-center rounded-2xl bg-black/40 border border-white/10 max-w-lg mx-auto">
                  <div className="text-4xl mb-3" aria-hidden="true">🧘</div>
                  <h3
                    className="text-lg uppercase tracking-wider text-white font-bold mb-2"
                    style={{ fontFamily: "var(--font-audiowide)" }}
                  >
                    Recovery &amp; Regeneration
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Muscles grow and repair during rest intervals. Focus on protein intake, 8+ hours of sleep, and gentle mobility
                    or light walks.
                  </p>
                </div>
              )}

              {/* Workout Sections */}
              {activeSession.type !== "rest" && (
                <div className="space-y-6">
                  {renderSection("1. Warm-up & Mobility", "🔥", "text-neon-yellow", activeSession.warmup, activeSession)}
                  {renderSection(
                    activeSession.type === "active_recovery" ? "2. Recovery Work" : "2. Main Routine",
                    "⚡",
                    "text-neon-cyan",
                    activeSession.main,
                    activeSession
                  )}
                  {renderSection("3. Cooldown & Stretch", "🧊", "text-neon-green", activeSession.cooldown, activeSession)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onboarding Wizard Modal */}
      <ExerciseOnboardingModal
        isOpen={isModalOpen}
        initialPrefs={prefs}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePreferences}
      />
    </div>
  );
}
