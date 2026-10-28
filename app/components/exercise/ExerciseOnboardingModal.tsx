"use client";

import { useState } from "react";
import type {
  ExercisePreferences,
  ExerciseGoal,
  ExperienceLevel,
  Equipment,
  WorkoutLocation,
} from "../../lib/storage";

interface Props {
  initialPrefs?: ExercisePreferences;
  isOpen: boolean;
  onClose: () => void;
  onSave: (prefs: ExercisePreferences) => void;
}

const EQUIPMENT_OPTIONS: { id: Equipment; label: string }[] = [
  { id: "none", label: "No Equipment (Bodyweight)" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "resistance_bands", label: "Resistance Bands" },
  { id: "pull_up_bar", label: "Pull-Up Bar" },
  { id: "yoga_mat", label: "Yoga Mat" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "barbell", label: "Barbell & Plates" },
  { id: "full_gym", label: "Full Commercial Gym" },
];

export default function ExerciseOnboardingModal({
  initialPrefs,
  isOpen,
  onClose,
  onSave,
}: Props) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [goal, setGoal] = useState<ExerciseGoal>(initialPrefs?.goal || "general_fitness");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    initialPrefs?.experienceLevel || "beginner"
  );
  const [availableDays, setAvailableDays] = useState(
    initialPrefs?.availableDaysPerWeek || 4
  );
  const [sessionDuration, setSessionDuration] = useState(
    initialPrefs?.sessionDurationMinutes || 40
  );
  const [location, setLocation] = useState<WorkoutLocation>(
    initialPrefs?.location || "home"
  );
  const [equipment, setEquipment] = useState<Equipment[]>(
    initialPrefs?.equipment || ["none"]
  );
  const [limitationsInput, setLimitationsInput] = useState(
    initialPrefs?.limitations?.join(", ") || ""
  );

  if (!isOpen) return null;

  const toggleEquipment = (eq: Equipment) => {
    if (eq === "none") {
      setEquipment(["none"]);
      return;
    }
    setEquipment((prev) => {
      const filtered = prev.filter((e) => e !== "none");
      return filtered.includes(eq)
        ? filtered.filter((e) => e !== eq)
        : [...filtered, eq];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limitations = limitationsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    onSave({
      goal,
      experienceLevel,
      availableDaysPerWeek: Number(availableDays),
      sessionDurationMinutes: Number(sessionDuration),
      location,
      equipment: equipment.length ? equipment : ["none"],
      preferredActivities: ["gym", "dance", "mobility"],
      limitations,
      avoidList: limitations,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#080814] border border-neon-cyan/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,255,255,0.15)] text-white">
        {/* Glow corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/70" />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-lg sm:text-xl font-bold tracking-[0.18em] uppercase neon-title"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              AI WORKOUT PLANNER
            </h2>
            <p className="text-[10px] text-neon-cyan/60 tracking-widest uppercase">
              Step {step} of {totalSteps} • Smart Pose-Linked Routine
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-cyan via-neon-magenta to-neon-violet transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <form onSubmit={handleSubmit}>
          {/* STEP 1: Goal & Experience */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Training Goal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "strength", label: "Strength & Power" },
                    { id: "muscle_gain", label: "Hypertrophy / Muscle" },
                    { id: "stamina", label: "Endurance & Cardio" },
                    { id: "flexibility", label: "Mobility & Posture" },
                    { id: "general_fitness", label: "Balanced General Fitness" },
                    { id: "sports_performance", label: "Agility & Athletic" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id as ExerciseGoal)}
                      className={`p-2.5 rounded border text-left text-xs transition-all ${
                        goal === g.id
                          ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-semibold shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Experience Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "beginner", label: "Beginner (<6 mos)" },
                    { id: "intermediate", label: "Intermediate (1-2 yrs)" },
                    { id: "advanced", label: "Advanced (3+ yrs)" },
                  ].map((exp) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => setExperienceLevel(exp.id as ExperienceLevel)}
                      className={`p-2 rounded border text-center text-xs transition-all ${
                        experienceLevel === exp.id
                          ? "border-neon-magenta bg-neon-magenta/20 text-neon-pink font-semibold"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                      }`}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule & Environment */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Available Days Per Week:{" "}
                  <span className="text-neon-cyan font-bold">{availableDays} Days</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={availableDays}
                  onChange={(e) => setAvailableDays(Number(e.target.value))}
                  className="w-full accent-neon-cyan cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/40 font-mono mt-1">
                  <span>2 Days (Express)</span>
                  <span>4 Days (Balanced)</span>
                  <span>6 Days (Intense)</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Target Session Length:{" "}
                  <span className="text-neon-magenta font-bold">{sessionDuration} Mins</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="75"
                  step="5"
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(Number(e.target.value))}
                  className="w-full accent-neon-magenta cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-white/40 font-mono mt-1">
                  <span>20m</span>
                  <span>40m</span>
                  <span>75m</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Workout Location
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "home", label: "🏠 Home" },
                    { id: "gym", label: "🏋️ Gym" },
                    { id: "outdoor", label: "🌳 Outdoor" },
                  ].map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setLocation(loc.id as WorkoutLocation)}
                      className={`p-2 rounded border text-center text-xs transition-all ${
                        location === loc.id
                          ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-bold"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                      }`}
                    >
                      {loc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Equipment & Limitations */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Equipment You Have Access To
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((opt) => {
                    const isSelected = equipment.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleEquipment(opt.id)}
                        className={`p-2 rounded border text-left text-xs transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-neon-green bg-neon-green/20 text-neon-green font-semibold"
                            : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Limitations / Avoided Movements (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. knee pain, avoid overhead press, lower back"
                  value={limitationsInput}
                  onChange={(e) => setLimitationsInput(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Comma-separated. The engine will filter out incompatible catalog exercises.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 flex items-center justify-between pt-4 border-t border-white/10">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 rounded text-xs tracking-wider uppercase text-white/60 hover:text-white transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded text-xs tracking-[0.2em] uppercase font-semibold hover:bg-neon-cyan/30 transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                style={{ fontFamily: "var(--font-audiowide)" }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-neon-cyan to-neon-magenta text-black font-bold rounded text-xs tracking-[0.2em] uppercase hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)]"
                style={{ fontFamily: "var(--font-audiowide)" }}
              >
                GENERATE WORKOUT PLAN ✨
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
