"use client";

import { useEffect, useId, useState } from "react";
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
  { id: "sesame", label: "Sesame" },
];
const COMMON_IDS = new Set(COMMON_ALLERGIES.map((a) => a.id));

/** Same limits the API enforces, so the user hears about a bad value here rather than from a failed request. */
const LIMITS = {
  age: { min: 12, max: 100, label: "Age" },
  heightCm: { min: 80, max: 250, label: "Height" },
  weightKg: { min: 25, max: 300, label: "Weight" },
} as const;

type NumericField = keyof typeof LIMITS;

function validateBody(values: Record<NumericField, number>): Partial<Record<NumericField, string>> {
  const errors: Partial<Record<NumericField, string>> = {};
  for (const field of Object.keys(LIMITS) as NumericField[]) {
    const { min, max, label } = LIMITS[field];
    const v = values[field];
    if (!Number.isFinite(v) || v < min || v > max) errors[field] = `${label} must be between ${min} and ${max}.`;
  }
  return errors;
}

/** Mounts only while open, so the form always starts from the latest saved profile (and step 1). */
export default function DietOnboardingModal({ initialProfile, isOpen, onClose, onSave }: Props) {
  if (!isOpen) return null;
  return <DietProfileDialog initialProfile={initialProfile} onClose={onClose} onSave={onSave} />;
}

function DietProfileDialog({
  initialProfile,
  onClose,
  onSave,
}: Omit<Props, "isOpen">) {
  const titleId = useId();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [age, setAge] = useState(initialProfile?.age ?? 25);
  const [sex, setSex] = useState<Sex>(initialProfile?.sex ?? "male");
  const [heightCm, setHeightCm] = useState(initialProfile?.heightCm ?? 172);
  const [weightKg, setWeightKg] = useState(initialProfile?.weightKg ?? 68);
  const [goal, setGoal] = useState<Goal>(initialProfile?.goal ?? "general_fitness");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(initialProfile?.activityLevel ?? "moderate");
  const [dietType, setDietType] = useState<DietType>(initialProfile?.dietType ?? "vegetarian");
  const [allergies, setAllergies] = useState<string[]>(
    (initialProfile?.allergies ?? []).filter((a) => COMMON_IDS.has(a))
  );
  const [otherAllergies, setOtherAllergies] = useState(
    (initialProfile?.allergies ?? []).filter((a) => !COMMON_IDS.has(a)).join(", ")
  );
  const [budget, setBudget] = useState<Budget>(initialProfile?.budget ?? "moderate");
  const [pregnant, setPregnant] = useState(initialProfile?.pregnant ?? false);
  const [medicalFlag, setMedicalFlag] = useState(initialProfile?.medicalFlag ?? false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const extra = otherAllergies
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const currentProfile: UserProfile = {
    age: Number(age),
    heightCm: Number(heightCm),
    weightKg: Number(weightKg),
    sex,
    goal,
    activityLevel,
    dietType,
    allergies: [...allergies, ...extra],
    budget,
    pregnant,
    medicalFlag,
  };

  const errors = validateBody({ age: currentProfile.age, heightCm: currentProfile.heightCm, weightKg: currentProfile.weightKg });
  const hasErrors = Object.keys(errors).length > 0;
  const hasSafetyNotice = requiresProfessionalNotice(currentProfile);

  const toggleAllergy = (id: string) => {
    setAllergies((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const goNext = () => {
    // Step 1 holds the numeric fields; check them before moving on (they are not mounted on the last step).
    if (step === 1 && hasErrors) {
      setShowErrors(true);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < totalSteps) {
      goNext();
      return;
    }
    if (hasErrors) {
      setStep(1);
      setShowErrors(true);
      return;
    }
    if (hasSafetyNotice) return;
    onSave(currentProfile);
  };

  const fieldClass = (field: NumericField) =>
    `w-full bg-black/60 border rounded px-3 py-2 text-sm text-white focus:outline-none ${
      showErrors && errors[field] ? "border-red-500" : "border-neon-cyan/30 focus:border-neon-cyan"
    }`;

  const numberField = (
    field: NumericField,
    label: string,
    value: number,
    setter: (n: number) => void
  ) => (
    <div>
      <label htmlFor={`${titleId}-${field}`} className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
        {label}
      </label>
      <input
        id={`${titleId}-${field}`}
        type="number"
        inputMode="decimal"
        min={LIMITS[field].min}
        max={LIMITS[field].max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => setter(e.target.value === "" ? NaN : Number(e.target.value))}
        aria-invalid={showErrors && !!errors[field]}
        className={fieldClass(field)}
        required
      />
      {showErrors && errors[field] && <p className="text-[10px] text-red-400 mt-1">{errors[field]}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-xl bg-[#080814] border border-neon-cyan/30 rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,255,255,0.15)] text-white"
      >
        {/* Glow corner brackets */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-neon-cyan/70" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-neon-cyan/70" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              id={titleId}
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
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/40 hover:text-white text-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="w-full h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-neon-cyan via-neon-magenta to-neon-violet transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Safety notice: the planner declines these profiles, so say so up front */}
        {hasSafetyNotice && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-3">
            <span className="text-xl" aria-hidden="true">⚠️</span>
            <div>
              <p className="font-semibold uppercase tracking-wider mb-1">Clinical Health Notice</p>
              <p className="text-amber-200/80 leading-relaxed text-[11px]">
                Because you indicated medical considerations, pregnancy/nursing, or an age under 18, FitVeda
                can&apos;t generate an automated meal plan for you — restrictive or unsupervised diets can be
                unsafe in these cases. Please consult a qualified dietitian or doctor.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* STEP 1: Body Metrics & Goals */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                {numberField("age", "Age", age, setAge)}
                <div>
                  <label htmlFor={`${titleId}-sex`} className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                    Sex
                  </label>
                  <select
                    id={`${titleId}-sex`}
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
                {numberField("heightCm", "Height (cm)", heightCm, setHeightCm)}
                {numberField("weightKg", "Weight (kg)", weightKg, setWeightKg)}
              </div>

              <fieldset>
                <legend className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Primary Nutrition Goal
                </legend>
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
                      aria-pressed={goal === g.id}
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
              </fieldset>
            </div>
          )}

          {/* STEP 2: Diet Type & Allergies */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <fieldset>
                <legend className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Dietary Category
                </legend>
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
                      aria-pressed={dietType === d.id}
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
              </fieldset>

              <fieldset>
                <legend className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-2">
                  Allergies &amp; Intolerances (Strictly Filtered)
                </legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_ALLERGIES.map((a) => {
                    const isSelected = allergies.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleAllergy(a.id)}
                        className={`p-2 rounded border text-xs text-left transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-red-500 bg-red-950/40 text-red-300 font-semibold"
                            : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                        }`}
                      >
                        <span>{a.label}</span>
                        {isSelected && <span className="text-red-400 font-bold" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
                <label htmlFor={`${titleId}-other`} className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mt-3 mb-1">
                  Anything else to avoid? (comma-separated)
                </label>
                <input
                  id={`${titleId}-other`}
                  type="text"
                  value={otherAllergies}
                  onChange={(e) => setOtherAllergies(e.target.value)}
                  placeholder="e.g. mustard, coconut, garlic"
                  maxLength={120}
                  className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-neon-cyan"
                />
              </fieldset>

              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <span className="text-[10px] tracking-wider uppercase text-neon-cyan/70">Optional Health Context</span>
                <div className="flex flex-wrap items-center gap-4 text-xs">
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
              <fieldset>
                <legend className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Daily Activity Factor
                </legend>
                <div className="flex flex-col gap-2">
                  {[
                    { id: "sedentary", title: "Sedentary", desc: "Desk job, little to no exercise" },
                    { id: "light", title: "Light Activity", desc: "1-2 light workouts / walks weekly" },
                    { id: "moderate", title: "Moderate", desc: "3-5 active workouts per week" },
                    { id: "active", title: "Very Active", desc: "Hard exercise 6-7 days / physical job" },
                    { id: "very_active", title: "Athlete", desc: "Twice-daily training or heavy manual work" },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      aria-pressed={activityLevel === act.id}
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
              </fieldset>

              <fieldset>
                <legend className="block text-[10px] tracking-wider uppercase text-neon-cyan/70 mb-1">
                  Budget Priority
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "affordable", label: "Budget-Friendly" },
                    { id: "moderate", label: "Moderate" },
                    { id: "flexible", label: "Premium / Organic" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      aria-pressed={budget === b.id}
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
              </fieldset>
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
                type="submit"
                className="px-5 py-2.5 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded text-xs tracking-[0.2em] uppercase font-semibold hover:bg-neon-cyan/30 transition-all shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                style={{ fontFamily: "var(--font-audiowide)" }}
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                disabled={hasSafetyNotice}
                className="px-6 py-2.5 bg-linear-to-r from-neon-cyan to-neon-magenta text-black font-bold rounded text-xs tracking-[0.2em] uppercase hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
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
