"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPreferences,
  savePreferences,
  exportAllData,
  clearWeeklyDietPlan,
  clearWeeklyExercisePlan,
} from "../lib/storage";
import type { AppPreferences } from "../lib/storage";
import type { MacroTargets } from "../lib/nutrition";
import { computeMacroTargets } from "../lib/nutrition";

export default function ProfilePage() {
  const [prefs, setPrefs] = useState<AppPreferences>({});
  const [usernameInput, setUsernameInput] = useState("");
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const current = getPreferences();
    setPrefs(current);
    if (current.username) setUsernameInput(current.username);
    if (current.dietProfile) {
      setTargets(computeMacroTargets(current.dietProfile));
    }
  }, []);

  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = { ...prefs, username: usernameInput.trim() };
    savePreferences(updated);
    setPrefs(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const downloadDataJson = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fitveda_profile_export_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetPlans = () => {
    if (window.confirm("Are you sure you want to reset your diet and workout plans? Your profile settings will remain.")) {
      clearWeeklyDietPlan();
      clearWeeklyExercisePlan();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 arena text-white p-4 sm:p-8 flex flex-col relative overflow-x-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="max-w-4xl w-full mx-auto flex flex-col gap-8 relative z-10">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-[0.18em] uppercase neon-title"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            PROFILE & PREFERENCES
          </h1>
          <p className="text-xs text-neon-cyan/70 tracking-widest uppercase mt-1">
            Account Management • Biometric Targets • Local Data Controls
          </p>
        </div>

        {/* Username & Identity Card */}
        <div className="p-6 rounded-2xl bg-[#080814] border border-neon-cyan/20 backdrop-blur-md">
          <h2
            className="text-sm font-bold uppercase tracking-wider text-neon-cyan mb-4 flex items-center gap-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>👤</span> User Identity
          </h2>
          <form onSubmit={handleSaveUsername} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] text-white/50 uppercase tracking-wider mb-1">
                Display Name / Athlete Handle
              </label>
              <input
                type="text"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="e.g. shiva"
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
              />
            </div>
            <button
              type="submit"
              className="mt-5 px-5 py-2.5 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-xs uppercase tracking-wider hover:bg-neon-cyan/30 transition-colors"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              {saveSuccess ? "✓ SAVED!" : "UPDATE HANDLE"}
            </button>
          </form>
        </div>

        {/* Biometrics & Dietary Context Summary */}
        <div className="p-6 rounded-2xl bg-[#080814] border border-neon-magenta/20 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm font-bold uppercase tracking-wider text-neon-magenta flex items-center gap-2"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              <span>🥗</span> Clinical Dietary Profile
            </h2>
            <Link
              href="/diet"
              className="text-xs text-neon-magenta hover:underline tracking-wider uppercase font-semibold"
            >
              Edit in Diet Planner →
            </Link>
          </div>

          {prefs.dietProfile ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Body Metrics</div>
                <div className="font-semibold text-white mt-1">
                  {prefs.dietProfile.age} yrs • {prefs.dietProfile.weightKg} kg • {prefs.dietProfile.heightCm} cm
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Diet Category</div>
                <div className="font-semibold text-neon-pink capitalize mt-1">
                  {prefs.dietProfile.dietType.replace("_", " ")}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Target Calories</div>
                <div className="font-semibold text-neon-cyan font-mono mt-1">
                  {targets?.calories || "—"} kcal/day
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Allergies</div>
                <div className="font-semibold text-red-400 capitalize mt-1">
                  {prefs.dietProfile.allergies.length
                    ? prefs.dietProfile.allergies.join(", ")
                    : "None"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-white/50">
              No diet profile configured. Visit the Diet Planner to set up your profile.
            </div>
          )}
        </div>

        {/* Exercise Preferences Summary */}
        <div className="p-6 rounded-2xl bg-[#080814] border border-neon-violet/20 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm font-bold uppercase tracking-wider text-neon-violet flex items-center gap-2"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              <span>💪</span> Workout Parameters
            </h2>
            <Link
              href="/exercise"
              className="text-xs text-neon-violet hover:underline tracking-wider uppercase font-semibold"
            >
              Edit in Exercise Planner →
            </Link>
          </div>

          {prefs.exercisePrefs ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Goal & Level</div>
                <div className="font-semibold text-white capitalize mt-1">
                  {prefs.exercisePrefs.goal.replace("_", " ")} ({prefs.exercisePrefs.experienceLevel})
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Commitment</div>
                <div className="font-semibold text-neon-cyan mt-1">
                  {prefs.exercisePrefs.availableDaysPerWeek} Days/wk • {prefs.exercisePrefs.sessionDurationMinutes}m
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Equipment</div>
                <div className="font-semibold text-white capitalize mt-1">
                  {prefs.exercisePrefs.equipment.join(", ").replace(/_/g, " ")}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-white/40 uppercase">Avoided Movements</div>
                <div className="font-semibold text-amber-400 capitalize mt-1">
                  {prefs.exercisePrefs.avoidList.length
                    ? prefs.exercisePrefs.avoidList.join(", ")
                    : "None"}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-white/50">
              No workout preferences configured. Visit the Exercise Planner to set up.
            </div>
          )}
        </div>

        {/* Data Portability & Safety Controls */}
        <div className="p-6 rounded-2xl bg-black/60 border border-white/10">
          <h2
            className="text-sm font-bold uppercase tracking-wider text-white mb-2 flex items-center gap-2"
            style={{ fontFamily: "var(--font-audiowide)" }}
          >
            <span>💾</span> Privacy & Data Portability
          </h2>
          <p className="text-xs text-white/60 mb-6 leading-relaxed">
            All biometrics, diet schedules, and workout logs are saved client-side in your browser's private storage. Zero video or private profile data is transmitted or stored on remote databases.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={downloadDataJson}
              className="px-4 py-2 rounded-lg border border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan hover:bg-neon-cyan/25 text-xs uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5"
            >
              <span>📥</span> Export All Data (JSON)
            </button>

            <button
              onClick={handleResetPlans}
              className="px-4 py-2 rounded-lg border border-red-500/30 bg-red-950/20 text-red-300 hover:bg-red-950/40 text-xs uppercase tracking-wider font-semibold transition-colors flex items-center gap-1.5"
            >
              <span>🗑️</span> Reset Active Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
