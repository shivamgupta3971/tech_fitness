import { z } from "zod";
import { CATALOG_ID_MAP } from "../data/exercises";
import { findAllergenViolation, findDietTypeViolation } from "./nutrition";
import type { DietType } from "./nutrition";

// ─── Diet Profile Schema ──────────────────────────────────────────────────────

export const UserProfileSchema = z.object({
  age: z.number().int().min(12).max(100),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(25).max(300),
  sex: z.enum(["male", "female", "other"]),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  goal: z.enum(["weight_loss", "weight_gain", "muscle_gain", "general_fitness"]),
  dietType: z.enum(["vegan", "vegetarian", "vegetarian_eggs", "non_vegetarian"]),
  allergies: z.array(z.string()).default([]),
  budget: z.enum(["affordable", "moderate", "flexible"]).default("affordable"),
  cuisinePreferences: z.array(z.string()).optional(),
  mealTimings: z.array(z.string()).optional(),
  pregnant: z.boolean().optional(),
  medicalFlag: z.boolean().optional(),
});

export type ValidatedUserProfile = z.infer<typeof UserProfileSchema>;

// ─── Generated Diet Plan Schemas ──────────────────────────────────────────────

export const GeneratedMealIngredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().min(1),
});

export const GeneratedMealSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  name: z.string().min(1),
  type: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  ingredients: z.array(GeneratedMealIngredientSchema).min(1),
  prepSteps: z.array(z.string()).default([]),
  hydrationReminderMl: z.number().optional(),
});

export const GeneratedDayPlanSchema = z.object({
  date: z.string(),
  meals: z.array(GeneratedMealSchema).min(3),
});

export const GeneratedWeeklyDietPlanSchema = z.object({
  id: z.string().default(() => `diet_${Date.now()}`),
  createdAt: z.string().default(() => new Date().toISOString()),
  days: z.array(GeneratedDayPlanSchema).min(1).max(7),
  notes: z.string().optional(),
});

export type GeneratedWeeklyDietPlan = z.infer<typeof GeneratedWeeklyDietPlanSchema>;

/**
 * Validates generated diet plan strictly against user's declared allergies and diet type.
 * Throws an error with descriptive message if an allergen or forbidden item is found.
 */
export function validateDietSafety(
  plan: GeneratedWeeklyDietPlan,
  dietType: DietType,
  allergies: string[]
): { valid: boolean; violation?: string } {
  for (const day of plan.days) {
    for (const meal of day.meals) {
      const ingredientNames = meal.ingredients.map((i) => i.name);
      // 1. Allergen check
      const allergen = findAllergenViolation(ingredientNames, allergies);
      if (allergen) {
        return {
          valid: false,
          violation: `Meal "${meal.name}" violates allergen restriction: contains ${allergen}`,
        };
      }

      // 2. Diet type check
      const dietViolation = findDietTypeViolation(ingredientNames, dietType);
      if (dietViolation) {
        return {
          valid: false,
          violation: `Meal "${meal.name}" violates ${dietType} diet: ${dietViolation}`,
        };
      }
    }
  }
  return { valid: true };
}

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
  preferredActivities: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  avoidList: z.array(z.string()).default([]),
});

export type ValidatedExercisePreferences = z.infer<typeof ExercisePreferencesSchema>;

// ─── Generated Exercise Plan Schemas ──────────────────────────────────────────

export const GeneratedPlannedExerciseSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  catalogId: z.string().refine((id) => CATALOG_ID_MAP.has(id), {
    message: "Exercise catalogId must exist in EXERCISE_CATALOG",
  }),
  sets: z.number().int().optional(),
  reps: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  restSeconds: z.number().int().optional(),
  notes: z.string().optional(),
});

export const GeneratedWorkoutSessionSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  plannedDate: z.string(),
  title: z.string(),
  type: z.enum(["workout", "rest", "active_recovery"]),
  warmup: z.array(GeneratedPlannedExerciseSchema).default([]),
  main: z.array(GeneratedPlannedExerciseSchema).default([]),
  cooldown: z.array(GeneratedPlannedExerciseSchema).default([]),
});

export const GeneratedWeeklyExercisePlanSchema = z.object({
  id: z.string().default(() => `ex_${Date.now()}`),
  createdAt: z.string().default(() => new Date().toISOString()),
  weekStartDate: z.string(),
  days: z.array(GeneratedWorkoutSessionSchema).min(1).max(7),
  notes: z.string().optional(),
});

export type GeneratedWeeklyExercisePlan = z.infer<typeof GeneratedWeeklyExercisePlanSchema>;
