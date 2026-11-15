import { z } from "zod";

// ─── Diet Profile Schema ──────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  age: z.number().int().min(12).max(100),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(300),
  sex: z.enum(["male", "female", "other"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["weight_loss", "weight_gain", "muscle_gain", "general_fitness"]),
  dietType: z.enum(["vegan", "vegetarian", "vegetarian_eggs", "non_vegetarian"]),
  allergies: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  budget: z.enum(["affordable", "moderate", "flexible"]).default("affordable"),
  cuisinePreferences: z.array(z.string().max(40)).max(10).optional(),
  mealTimings: z.array(z.string().max(20)).max(10).optional(),
  pregnant: z.boolean().optional(),
  medicalFlag: z.boolean().optional(),
  /** The user's local date (YYYY-MM-DD) so plan days start "today" for them, not for the server's clock. */
  startDate: z.string().optional(),
});

export type ValidatedUserProfile = z.infer<typeof UserProfileSchema>;

// ─── LLM output: diet ─────────────────────────────────────────────────────────
//
// Models ignore the schema in small ways (capitalised "Breakfast", quantity as a number, a stray string where a
// number belongs). These schemas accept the harmless variations and reject anything that can't be used, so a bad
// day is replaced by the built-in plan instead of crashing the request.

function normalizeMealType(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.includes("break") || v === "brunch") return "breakfast";
  if (v.includes("lunch")) return "lunch";
  if (v.includes("snack")) return "snack";
  if (v.includes("dinner") || v.includes("supper")) return "dinner";
  return "";
}

/** A number in range, or undefined when the model sent something unusable (never an error). */
function optionalNumber(min: number, max: number) {
  return z
    .unknown()
    .transform((v) => {
      if (v === null || v === undefined || v === "") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
    })
    .optional();
}

const quantitySchema = z
  .union([z.string(), z.number()])
  .transform((q) => (typeof q === "number" ? `${q}g` : q.trim()))
  .pipe(z.string().min(1).max(60));

export const LlmMealSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.string().transform(normalizeMealType).pipe(z.enum(["breakfast", "lunch", "snack", "dinner"])),
  ingredients: z
    .array(z.object({ name: z.string().trim().min(1).max(100), quantity: quantitySchema }))
    .min(1)
    .max(15),
  prepSteps: z.array(z.string().max(300)).max(10).default([]),
  hydrationReminderMl: optionalNumber(0, 2000),
});

export const LlmDaySchema = z.object({
  meals: z.array(LlmMealSchema).min(3).max(6),
});

export type LlmDay = z.infer<typeof LlmDaySchema>;

// ─── Exercise Preferences Schema ──────────────────────────────────────────────

export const ExercisePreferencesSchema = z.object({
  goal: z.enum(["strength", "muscle_gain", "stamina", "flexibility", "general_fitness", "sports_performance"]),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
  availableDaysPerWeek: z.number().int().min(1).max(7),
  sessionDurationMinutes: z.number().int().min(15).max(120),
  equipment: z.array(
    z.enum(["none", "dumbbells", "barbell", "resistance_bands", "pull_up_bar", "kettlebell", "gym_machines", "yoga_mat", "full_gym"])
  ).min(1),
  location: z.enum(["home", "gym", "outdoor"]),
  preferredActivities: z.array(z.string().max(40)).max(10).default([]),
  limitations: z.array(z.string().trim().max(80)).max(15).default([]),
  avoidList: z.array(z.string().trim().max(80)).max(15).default([]),
  /** The user's local date (YYYY-MM-DD) so plan days start "today" for them, not for the server's clock. */
  startDate: z.string().optional(),
});

export type ValidatedExercisePreferences = z.infer<typeof ExercisePreferencesSchema>;

// ─── LLM output: exercise ─────────────────────────────────────────────────────

const mainItemSchema = z.union([
  z.string().transform((id) => ({ id, sets: undefined, reps: undefined, durationSeconds: undefined })),
  z.object({
    id: z.string(),
    sets: optionalNumber(1, 10),
    reps: z
      .union([z.string(), z.number()])
      .transform((r) => String(r).slice(0, 20))
      .optional(),
    durationSeconds: optionalNumber(5, 3600),
  }),
]);

export const LlmExerciseDaySchema = z.object({
  title: z.string().trim().min(1).max(80).default("Training Session"),
  type: z.enum(["workout", "rest", "active_recovery"]),
  warmupCatalogIds: z.array(z.string()).max(10).default([]),
  mainCatalogIds: z.array(mainItemSchema).max(12).default([]),
  cooldownCatalogIds: z.array(z.string()).max(10).default([]),
});

export const LlmExercisePlanSchema = z.object({
  days: z.array(LlmExerciseDaySchema).length(7),
});

export type LlmExerciseDay = z.infer<typeof LlmExerciseDaySchema>;
