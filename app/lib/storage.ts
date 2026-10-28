/**
 * Typed localStorage wrappers for diet plans, exercise plans,
 * preferences, and nutrition logs.
 *
 * All reads return null if the key doesn't exist or data is corrupt.
 * All writes are fire-and-forget (quota errors are swallowed and logged).
 */

import type { UserProfile } from "./nutrition";

// ─── Diet Types ───────────────────────────────────────────────────────────────

export interface NutritionInfo {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** true = values looked up from nutrition DB; false = LLM estimate */
  verified: boolean;
}

export interface MealIngredient {
  name: string;
  quantity: string; // e.g. "100g", "1 cup", "2 tbsp"
  nutrition?: NutritionInfo;
}

export interface Meal {
  id: string;
  name: string;           // e.g. "Masoor Dal with Rice"
  type: "breakfast" | "lunch" | "snack" | "dinner";
  ingredients: MealIngredient[];
  prepSteps: string[];
  nutrition: NutritionInfo;
  hydrationReminderMl?: number;
}

export interface DayPlan {
  date: string; // ISO date string YYYY-MM-DD
  meals: Meal[];
  totalNutrition: NutritionInfo;
}

export interface WeeklyDietPlan {
  id: string;
  createdAt: string;
  days: DayPlan[];
  groceryList: GroceryItem[];
  notes?: string;
}

export interface GroceryItem {
  name: string;
  totalQuantity: string;
  category: "vegetable" | "fruit" | "grain" | "protein" | "dairy" | "spice" | "other";
}

export interface NutritionLog {
  date: string;
  mealId: string;
  mealName: string;
  eaten: boolean;
  portionMultiplier: number; // 1.0 = full serving
  loggedAt: string;
}

// ─── Exercise Types ───────────────────────────────────────────────────────────

export type ExerciseGoal = "strength" | "muscle_gain" | "stamina" | "flexibility" | "general_fitness" | "sports_performance";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type Equipment = "none" | "dumbbells" | "barbell" | "resistance_bands" | "pull_up_bar" | "kettlebell" | "gym_machines" | "yoga_mat" | "full_gym";
export type WorkoutLocation = "home" | "gym" | "outdoor";
export type TrackingMode = "dance" | "gym" | "manual";

export interface ExercisePreferences {
  goal: ExerciseGoal;
  experienceLevel: ExperienceLevel;
  availableDaysPerWeek: number;
  sessionDurationMinutes: number;
  equipment: Equipment[];
  location: WorkoutLocation;
  preferredActivities: string[];
  limitations: string[];  // e.g. ["knee pain", "no overhead press"]
  avoidList: string[];    // specific exercises/movements to avoid
}

export interface PlannedExercise {
  id: string;
  catalogId: string;       // references exercise catalog
  name: string;
  description: string;
  targetMuscles: string[];
  sets?: number;
  reps?: string;           // e.g. "8-12" or "to failure"
  durationSeconds?: number;
  restSeconds?: number;
  equipment: Equipment[];
  difficulty: ExperienceLevel;
  beginnerAlternative?: string;
  instructions: string[];
  trackable: boolean;
  trackingMode: TrackingMode;
  status: "pending" | "completed" | "skipped" | "modified";
  completedAt?: string;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  plannedDate: string;     // YYYY-MM-DD
  title: string;
  type: "workout" | "rest" | "active_recovery";
  warmup: PlannedExercise[];
  main: PlannedExercise[];
  cooldown: PlannedExercise[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  sessionRef?: string;     // reference to Arena session if tracked
}

export interface WeeklyExercisePlan {
  id: string;
  createdAt: string;
  weekStartDate: string;   // Monday YYYY-MM-DD
  days: WorkoutSession[];
  notes?: string;
}

// ─── User Preferences ─────────────────────────────────────────────────────────

export interface AppPreferences {
  dietProfile?: UserProfile;
  exercisePrefs?: ExercisePreferences;
  timezone?: string;
  onboardingComplete?: {
    diet: boolean;
    exercise: boolean;
  };
  /** Simple credentials auth — username only (no sensitive data in localStorage) */
  username?: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  PREFERENCES: "fitveda:preferences",
  WEEKLY_DIET_PLAN: "fitveda:diet:weeklyPlan",
  NUTRITION_LOGS: "fitveda:diet:logs",
  WEEKLY_EXERCISE_PLAN: "fitveda:exercise:weeklyPlan",
  EXERCISE_HISTORY: "fitveda:exercise:history",
} as const;

// ─── Generic helpers ──────────────────────────────────────────────────────────

function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("[storage] localStorage write failed:", err);
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ─── Preferences ──────────────────────────────────────────────────────────────

export function getPreferences(): AppPreferences {
  return safeGet<AppPreferences>(KEYS.PREFERENCES) ?? {};
}

export function savePreferences(prefs: AppPreferences): void {
  safeSet(KEYS.PREFERENCES, prefs);
}

export function updatePreferences(partial: Partial<AppPreferences>): void {
  const current = getPreferences();
  safeSet(KEYS.PREFERENCES, { ...current, ...partial });
}

// ─── Diet Plan ────────────────────────────────────────────────────────────────

export function getWeeklyDietPlan(): WeeklyDietPlan | null {
  return safeGet<WeeklyDietPlan>(KEYS.WEEKLY_DIET_PLAN);
}

export function saveWeeklyDietPlan(plan: WeeklyDietPlan): void {
  safeSet(KEYS.WEEKLY_DIET_PLAN, plan);
}

export function clearWeeklyDietPlan(): void {
  safeRemove(KEYS.WEEKLY_DIET_PLAN);
}

// ─── Nutrition Logs ───────────────────────────────────────────────────────────

export function getNutritionLogs(): NutritionLog[] {
  return safeGet<NutritionLog[]>(KEYS.NUTRITION_LOGS) ?? [];
}

export function addNutritionLog(log: NutritionLog): void {
  const logs = getNutritionLogs();
  // Remove any existing log for the same meal on the same date
  const filtered = logs.filter((l) => !(l.date === log.date && l.mealId === log.mealId));
  filtered.push(log);
  safeSet(KEYS.NUTRITION_LOGS, filtered);
}

export function getNutritionLogsForDate(date: string): NutritionLog[] {
  return getNutritionLogs().filter((l) => l.date === date);
}

// ─── Exercise Plan ────────────────────────────────────────────────────────────

export function getWeeklyExercisePlan(): WeeklyExercisePlan | null {
  return safeGet<WeeklyExercisePlan>(KEYS.WEEKLY_EXERCISE_PLAN);
}

export function saveWeeklyExercisePlan(plan: WeeklyExercisePlan): void {
  safeSet(KEYS.WEEKLY_EXERCISE_PLAN, plan);
}

export function clearWeeklyExercisePlan(): void {
  safeRemove(KEYS.WEEKLY_EXERCISE_PLAN);
}

export function updateWorkoutSessionStatus(
  sessionId: string,
  status: WorkoutSession["status"],
  completedAt?: string
): void {
  const plan = getWeeklyExercisePlan();
  if (!plan) return;
  const day = plan.days.find((d) => d.id === sessionId);
  if (!day) return;
  day.status = status;
  if (completedAt) day.completedAt = completedAt;
  saveWeeklyExercisePlan(plan);
}

export function updateExerciseStatus(
  sessionId: string,
  exerciseId: string,
  status: PlannedExercise["status"],
  notes?: string
): void {
  const plan = getWeeklyExercisePlan();
  if (!plan) return;
  const day = plan.days.find((d) => d.id === sessionId);
  if (!day) return;
  const allExercises = [...day.warmup, ...day.main, ...day.cooldown];
  const ex = allExercises.find((e) => e.id === exerciseId);
  if (!ex) return;
  ex.status = status;
  if (notes) ex.notes = notes;
  if (status === "completed") ex.completedAt = new Date().toISOString();
  saveWeeklyExercisePlan(plan);
}

// ─── Exercise History ─────────────────────────────────────────────────────────

export function getExerciseHistory(): WeeklyExercisePlan[] {
  return safeGet<WeeklyExercisePlan[]>(KEYS.EXERCISE_HISTORY) ?? [];
}

export function archiveExercisePlan(plan: WeeklyExercisePlan): void {
  const history = getExerciseHistory();
  history.unshift(plan);
  // Keep last 12 weeks
  safeSet(KEYS.EXERCISE_HISTORY, history.slice(0, 12));
}

// ─── Export helpers ───────────────────────────────────────────────────────────

/** Export all user data as a downloadable JSON blob */
export function exportAllData(): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      preferences: getPreferences(),
      weeklyDietPlan: getWeeklyDietPlan(),
      nutritionLogs: getNutritionLogs(),
      weeklyExercisePlan: getWeeklyExercisePlan(),
      exerciseHistory: getExerciseHistory(),
    },
    null,
    2
  );
}
