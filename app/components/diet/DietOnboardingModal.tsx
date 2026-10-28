"use client";

import { useState } from "react";
import type { UserProfile, Goal, DietType, ActivityLevel, Budget, Sex } from "../../lib/nutrition";
import { requiresProfessionalNotice } from "../../lib/nutrition";

interface Props {
  initialProfile?: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

const COMMON_ALLERGIES = [
  { id: "gluten", label: "Gluten / Wheat" },
  { id: "dairy", label: "Dairy / Lactose" },
  { id: "nuts", label: "Peanuts / Tree Nuts" },
  { id: "soy", label: "Soy / Soya" },
  { id: "egg", label: "Eggs" },
  { id: "shellfish", label: "Shellfish" },
  { id: "fish", label: "Fish" },
];

export default function DietOnboardingModal({
  initialProfile,
  isOpen,
  onClose,
  onSave,
}: Props) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Form state
  const [age, setAge] = useState(initialProfile?.age || 25);
  const [sex, setSex] = useState<Sex>(initialProfile?.sex || "male");
  const [heightCm, setHeightCm] = useState(initialProfile?.heightCm || 172);
  const [weightKg, setWeightKg] = useState(initialProfile?.weightKg || 68);
  const [goal, setGoal] = useState<Goal>(initialProfile?.goal || "general_fitness");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    initialProfile?.activityLevel || "moderate"
  );
  const [dietType, setDietType] = useState<DietType>(
    initialProfile?.dietType || "vegetarian"
  );
  const [allergies, setAllergies] = useState<string[]>(
    initialProfile?.allergies || []
  );
  const [budget, setBudget] = useState<Budget>(initialProfile?.budget || "moderate");
  const [pregnant, setPregnant] = useState(initialProfile?.pregnant || false);
  const [medicalFlag, setMedicalFlag] = useState(initialProfile?.medicalFlag || false);

  if (!isOpen) return null;

  const currentProfile: UserProfile = {
    age: Number(age),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    sex,
    goal,
    activityLevel,
    dietType,
    allergies,
    budget,
    pregnant,
    medicalFlag,
  };

  const hasSafetyNotice = requiresProfessionalNotice(currentProfile);

  const toggleAllergy = (id: string) => {
    setAllergies((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(currentProfile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#080814] border border-neon-cyan/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,255,255,0.15)] text-white">
        {/* Glow corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/70" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-lg sm:text-xl font-bold tracking-[0.18em] uppercase neon-title"
              style={{ fontFamily: "var(--font-audiowide)" }}
            >
              AI DIET PROFILE
            </h2>
            <p className="text-[10px] text-neon-cyan/60 tracking-widest uppercase">
              Step {step} of {totalSteps} • Personalized Nutrition
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

        {/* Safety Warning if applicable */}
        {hasSafetyNotice && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold uppercase tracking-wider mb-1">
                Clinical Health Notice
              </p>
              <p className="text-amber-200/80 leading-relaxed text-[11px]">
                Because you indicated medical considerations, pregnancy, or an age under 18, FitVeda provides balanced maintenance guidance only. Please consult a qualified clinical dietitian before undertaking restrictive deficits.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* STEP 1: Body Metrics & Goals */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min="12"
                    max="100"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full bg-black/60 border border-neon-cyan/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                    Sex
                  </label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value as Sex)}
                    className="w-full bg-black/60 border border-neon-cyan/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    min="90"
                    max="240"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Number(e.target.value))}
                    className="w-full bg-black/60 border border-neon-cyan/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    value={weightKg}
                    onChange={(e) => setWeightKg(Number(e.target.value))}
                    className="w-full bg-black/60 border border-neon-cyan/30 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-cyan"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Primary Nutrition Goal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "weight_loss", label: "Fat Loss / Deficit" },
                    { id: "muscle_gain", label: "Muscle Gain / Surplus" },
                    { id: "general_fitness", label: "General Fitness / Maintenance" },
                    { id: "weight_gain", label: "Healthy Weight Gain" },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id as Goal)}
                      className={`p-2.5 rounded border text-left text-xs transition-all ${
                        goal === g.id
                          ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan font-semibold shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Diet Type & Allergies */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Dietary Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "vegetarian", label: "Pure Vegetarian (Lacto)" },
                    { id: "vegetarian_eggs", label: "Eggetarian (Veg + Eggs)" },
                    { id: "non_vegetarian", label: "Non-Vegetarian (Chicken, Fish)" },
                    { id: "vegan", label: "100% Plant-Based Vegan" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDietType(d.id as DietType)}
                      className={`p-2.5 rounded border text-left text-xs transition-all ${
                        dietType === d.id
                          ? "border-neon-magenta bg-neon-magenta/20 text-neon-pink font-semibold shadow-[0_0_10px_rgba(255,0,170,0.25)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Allergies & Intolerances (Strictly Filtered)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_ALLERGIES.map((a) => {
                    const isSelected = allergies.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAllergy(a.id)}
                        className={`p-2 rounded border text-xs text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-red-500 bg-red-950/40 text-red-300 font-semibold"
                            : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                        }`}
                      >
                        <span>{a.label}</span>
                        {isSelected && <span className="text-red-400 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <label className="text-[10px] tracking-wider uppercase text-neon-cyan/70">
                  Optional Health Context
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pregnant}
                      onChange={(e) => setPregnant(e.target.checked)}
                      className="accent-neon-cyan rounded"
                    />
                    <span className="text-white/80">Pregnant or Nursing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={medicalFlag}
                      onChange={(e) => setMedicalFlag(e.target.checked)}
                      className="accent-neon-cyan rounded"
                    />
                    <span className="text-white/80">Medical Condition / History</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Lifestyle & Budget */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Daily Activity Factor
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: "sedentary", title: "Sedentary", desc: "Desk job, little to no exercise" },
                    { id: "light", title: "Light Activity", desc: "1-2 light workouts / walks weekly" },
                    { id: "moderate", title: "Moderate", desc: "3-5 active workouts per week" },
                    { id: "active", title: "Very Active", desc: "Hard exercise 6-7 days / physical job" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActivityLevel(act.id as ActivityLevel)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        activityLevel === act.id
                          ? "border-neon-cyan bg-neon-cyan/20 text-white font-semibold shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
                      }`}
                    >
                      <div className="text-xs font-semibold text-neon-cyan">{act.title}</div>
                      <div className="text-[11px] text-white/60">{act.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Budget Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "affordable", label: "Budget-Friendly" },
                    { id: "moderate", label: "Moderate" },
                    { id: "flexible", label: "Premium / Organic" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBudget(b.id as Budget)}
                      className={`p-2 rounded border text-center text-xs transition-all ${
                        budget === b.id
                          ? "border-neon-green bg-neon-green/20 text-neon-green font-semibold"
                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
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
                GENERATE DIET PLAN ✨
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
