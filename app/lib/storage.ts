/**
 * Typed localStorage wrappers for diet plans, exercise plans,
 * preferences, and nutrition logs.
 *
 * Reads validate the stored shape and return null/defaults if a key is missing or corrupt, so an old or
 * hand-edited value can never crash a page. Writes swallow quota errors (and log them) and announce the change
 * (see STORAGE_EVENT) so every mounted page/hook re-reads — no manual "reload state after save" code needed.
 */

import type { UserProfile } from "./nutrition";
import { toLocalDateString, addDays } from "./dates";

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
  /** Set when portions were rescaled to hit the calorie target (1.25 = 25% bigger than the dishes as written). */
  portionScale?: number;
}

export interface WeeklyDietPlan {
  id: string;
  createdAt: string;
  days: DayPlan[];
  groceryList: GroceryItem[];
  /** Who wrote the meals: all seven days by the LLM, a mix, or only the built-in meal bank. */
  source?: "ai" | "mixed" | "builtin";
  notes?: string;
}

export interface GroceryItem {
  name: string;
  /** Summed across the whole plan, e.g. "1.35 kg" (as-cooked weight). */
  totalQuantity: string;
  category: "vegetable" | "fruit" | "grain" | "protein" | "dairy" | "spice" | "other";
  /** How many times the ingredient appears in the plan. */
  uses?: number;
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
  /** First day of the plan (the day it was generated), YYYY-MM-DD. */
  weekStartDate: string;
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

// ─── Storage Keys & change events ─────────────────────────────────────────────

export const STORAGE_KEYS = {
  PREFERENCES: "fitveda:preferences",
  WEEKLY_DIET_PLAN: "fitveda:diet:weeklyPlan",
  NUTRITION_LOGS: "fitveda:diet:logs",
  WEEKLY_EXERCISE_PLAN: "fitveda:exercise:weeklyPlan",
  EXERCISE_HISTORY: "fitveda:exercise:history",
} as const;

const KEYS = STORAGE_KEYS;

/** Fired on `window` after any write in this tab (the native `storage` event only reaches *other* tabs). */
export const STORAGE_EVENT = "fitveda:storage";

/** Logs older than this many days are dropped when a new log is written. */
const LOG_RETENTION_DAYS = 90;

// ─── Generic helpers ──────────────────────────────────────────────────────────

/** Raw string for a key, or null (missing, SSR, or storage unavailable). Cheap enough for useSyncExternalStore. */
export function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── Shape validation ─────────────────────────────────────────────────────────

function isNutrition(v: unknown): v is NutritionInfo {
  return isRecord(v) && typeof v.calories === "number" && typeof v.proteinG === "number";
}

function isMeal(v: unknown): v is Meal {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Array.isArray(v.ingredients) &&
    isNutrition(v.nutrition)
  );
}

function isDayPlan(v: unknown): v is DayPlan {
  return (
    isRecord(v) &&
    typeof v.date === "string" &&
    Array.isArray(v.meals) &&
    v.meals.every(isMeal) &&
    isNutrition(v.totalNutrition)
  );
}

export function isWeeklyDietPlan(v: unknown): v is WeeklyDietPlan {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    Array.isArray(v.days) &&
    v.days.length > 0 &&
    v.days.every(isDayPlan) &&
    Array.isArray(v.groceryList)
  );
}

function isPlannedExercise(v: unknown): v is PlannedExercise {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.catalogId === "string" &&
    typeof v.name === "string" &&
    Array.isArray(v.targetMuscles) &&
    Array.isArray(v.instructions)
  );
}

function isWorkoutSession(v: unknown): v is WorkoutSession {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    typeof v.plannedDate === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.warmup) && v.warmup.every(isPlannedExercise) &&
    Array.isArray(v.main) && v.main.every(isPlannedExercise) &&
    Array.isArray(v.cooldown) && v.cooldown.every(isPlannedExercise)
  );
}

export function isWeeklyExercisePlan(v: unknown): v is WeeklyExercisePlan {
  return (
    isRecord(v) &&
    typeof v.id === "string" &&
    Array.isArray(v.days) &&
    v.days.length > 0 &&
    v.days.every(isWorkoutSession)
  );
}

// ─── Parsers (raw string → validated value), shared with the React hooks ─────

export function parsePreferences(raw: string | null): AppPreferences {
  const v = parseJson(raw);
  return isRecord(v) ? (v as AppPreferences) : {};
}

export function parseWeeklyDietPlan(raw: string | null): WeeklyDietPlan | null {
  const v = parseJson(raw);
  return isWeeklyDietPlan(v) ? v : null;
}

export function parseNutritionLogs(raw: string | null): NutritionLog[] {
  const v = parseJson(raw);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (l): l is NutritionLog =>
      isRecord(l) && typeof l.date === "string" && typeof l.mealId === "string" && typeof l.eaten === "boolean"
  );
}

export function parseWeeklyExercisePlan(raw: string | null): WeeklyExercisePlan | null {
  const v = parseJson(raw);
  return isWeeklyExercisePlan(v) ? v : null;
}

// ─── Preferences ──────────────────────────────────────────────────────────────

export function getPreferences(): AppPreferences {
  return parsePreferences(readRaw(KEYS.PREFERENCES));
}

export function savePreferences(prefs: AppPreferences): void {
  safeSet(KEYS.PREFERENCES, prefs);
}

export function updatePreferences(partial: Partial<AppPreferences>): void {
  safeSet(KEYS.PREFERENCES, { ...getPreferences(), ...partial });
}

// ─── Diet Plan ────────────────────────────────────────────────────────────────

export function getWeeklyDietPlan(): WeeklyDietPlan | null {
  return parseWeeklyDietPlan(readRaw(KEYS.WEEKLY_DIET_PLAN));
}

export function saveWeeklyDietPlan(plan: WeeklyDietPlan): void {
  safeSet(KEYS.WEEKLY_DIET_PLAN, plan);
}

export function clearWeeklyDietPlan(): void {
  safeRemove(KEYS.WEEKLY_DIET_PLAN);
}

// ─── Nutrition Logs ───────────────────────────────────────────────────────────

export function getNutritionLogs(): NutritionLog[] {
  return parseNutritionLogs(readRaw(KEYS.NUTRITION_LOGS));
}

export function addNutritionLog(log: NutritionLog): void {
  const cutoff = addDays(toLocalDateString(), -LOG_RETENTION_DAYS);
  // One log per meal per date; also drop logs old enough that no plan can still reference them.
  const kept = getNutritionLogs().filter(
    (l) => l.date >= cutoff && !(l.date === log.date && l.mealId === log.mealId)
  );
  kept.push(log);
  safeSet(KEYS.NUTRITION_LOGS, kept);
}

export function getNutritionLogsForDate(date: string): NutritionLog[] {
  return getNutritionLogs().filter((l) => l.date === date);
}

// ─── Grocery checklist ────────────────────────────────────────────────────────

/** Storage key for the ticked-off grocery items of one plan (so ticks survive tab switches and reloads). */
export function groceryCheckedKey(planId: string): string {
  return `fitveda:diet:groceryChecked:${planId}`;
}

export function parseGroceryChecked(raw: string | null): string[] {
  const v = parseJson(raw);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function setGroceryChecked(planId: string, checkedNames: string[]): void {
  safeSet(groceryCheckedKey(planId), checkedNames);
}

// ─── Exercise Plan ────────────────────────────────────────────────────────────

export function getWeeklyExercisePlan(): WeeklyExercisePlan | null {
  return parseWeeklyExercisePlan(readRaw(KEYS.WEEKLY_EXERCISE_PLAN));
}

export function saveWeeklyExercisePlan(plan: WeeklyExercisePlan): void {
  safeSet(KEYS.WEEKLY_EXERCISE_PLAN, plan);
}

export function clearWeeklyExercisePlan(): void {
  safeRemove(KEYS.WEEKLY_EXERCISE_PLAN);
}

/**
 * Session status follows from its exercises: everything done/skipped/modified (with at least one done) is
 * "completed", any progress is "in_progress", otherwise "pending". Rest days have nothing to derive from.
 */
export function deriveSessionStatus(day: WorkoutSession): WorkoutSession["status"] {
  const all = [...day.warmup, ...day.main, ...day.cooldown];
  if (all.length === 0) return day.status;
  const touched = all.filter((e) => e.status !== "pending");
  if (touched.length === 0) return "pending";
  const nothingLeft = touched.length === all.length;
  const anyCompleted = all.some((e) => e.status === "completed" || e.status === "modified");
  if (nothingLeft && anyCompleted) return "completed";
  if (nothingLeft) return "skipped";
  return "in_progress";
}

function applySessionStatus(day: WorkoutSession, status: WorkoutSession["status"]): void {
  if (day.status === status) return;
  day.status = status;
  if (status === "completed") day.completedAt = new Date().toISOString();
  else delete day.completedAt;
  if (status === "in_progress" && !day.startedAt) day.startedAt = new Date().toISOString();
}

/**
 * Marks a whole session. "completed" completes every exercise that is still pending (skipped/modified ones keep
 * their status); "pending" reopens the session and resets all its exercises.
 */
export function updateWorkoutSessionStatus(
  sessionId: string,
  status: WorkoutSession["status"]
): void {
  const plan = getWeeklyExercisePlan();
  const day = plan?.days.find((d) => d.id === sessionId);
  if (!plan || !day) return;

  const all = [...day.warmup, ...day.main, ...day.cooldown];
  const now = new Date().toISOString();
  if (status === "completed") {
    for (const ex of all) {
      if (ex.status === "pending") {
        ex.status = "completed";
        ex.completedAt = now;
      }
    }
  } else if (status === "pending") {
    for (const ex of all) {
      ex.status = "pending";
      delete ex.completedAt;
    }
  }
  applySessionStatus(day, status);
  saveWeeklyExercisePlan(plan);
}

export function updateExerciseStatus(
  sessionId: string,
  exerciseId: string,
  status: PlannedExercise["status"],
  notes?: string
): void {
  const plan = getWeeklyExercisePlan();
  const day = plan?.days.find((d) => d.id === sessionId);
  if (!plan || !day) return;
  const ex = [...day.warmup, ...day.main, ...day.cooldown].find((e) => e.id === exerciseId);
  if (!ex) return;

  ex.status = status;
  if (notes !== undefined) {
    if (notes) ex.notes = notes;
    else delete ex.notes;
  }
  if (status === "completed") ex.completedAt = new Date().toISOString();
  else delete ex.completedAt;

  applySessionStatus(day, deriveSessionStatus(day));
  saveWeeklyExercisePlan(plan);
}

// ─── Exercise History ─────────────────────────────────────────────────────────

export function getExerciseHistory(): WeeklyExercisePlan[] {
  const v = parseJson(readRaw(KEYS.EXERCISE_HISTORY));
  return Array.isArray(v) ? v.filter(isWeeklyExercisePlan) : [];
}

export function archiveExercisePlan(plan: WeeklyExercisePlan): void {
  const history = getExerciseHistory().filter((p) => p.id !== plan.id);
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
