"use client";

/**
 * React bindings for the localStorage-backed app data.
 *
 * Built on useSyncExternalStore: components always render what is currently stored, update when *anything*
 * (this tab, another tab) writes, and render a stable server snapshot first so hydration never mismatches.
 * This replaces "read localStorage in an effect and copy it into state", which went stale whenever another
 * component wrote the same data.
 */

import { useMemo, useSyncExternalStore } from "react";
import {
  STORAGE_EVENT,
  STORAGE_KEYS,
  groceryCheckedKey,
  parseGroceryChecked,
  parseNutritionLogs,
  parsePreferences,
  parseWeeklyDietPlan,
  parseWeeklyExercisePlan,
  readRaw,
} from "./storage";
import type {
  AppPreferences,
  NutritionLog,
  WeeklyDietPlan,
  WeeklyExercisePlan,
} from "./storage";
import { toLocalDateString } from "./dates";

function subscribeToStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback); // other tabs
  window.addEventListener(STORAGE_EVENT, callback); // this tab
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

/** Raw string snapshot: a primitive, so React can compare it by value and skip needless renders. */
function useRaw(key: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => readRaw(key),
    () => null
  );
}

export function usePreferences(): AppPreferences {
  const raw = useRaw(STORAGE_KEYS.PREFERENCES);
  return useMemo(() => parsePreferences(raw), [raw]);
}

export function useWeeklyDietPlan(): WeeklyDietPlan | null {
  const raw = useRaw(STORAGE_KEYS.WEEKLY_DIET_PLAN);
  return useMemo(() => parseWeeklyDietPlan(raw), [raw]);
}

export function useNutritionLogs(): NutritionLog[] {
  const raw = useRaw(STORAGE_KEYS.NUTRITION_LOGS);
  return useMemo(() => parseNutritionLogs(raw), [raw]);
}

export function useWeeklyExercisePlan(): WeeklyExercisePlan | null {
  const raw = useRaw(STORAGE_KEYS.WEEKLY_EXERCISE_PLAN);
  return useMemo(() => parseWeeklyExercisePlan(raw), [raw]);
}

/** Names of grocery items the user has ticked off for a plan. */
export function useGroceryChecked(planId: string): Set<string> {
  const raw = useRaw(groceryCheckedKey(planId));
  return useMemo(() => new Set(parseGroceryChecked(raw)), [raw]);
}

const noopSubscribe = () => () => {};

/** False during SSR/hydration, true once mounted in the browser — lets pages skip the "empty" flash. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function subscribeToDayChange(callback: () => void): () => void {
  // Re-check when the tab regains focus and once a minute, so a page left open overnight rolls over to the new day.
  const interval = window.setInterval(callback, 60_000);
  document.addEventListener("visibilitychange", callback);
  window.addEventListener("focus", callback);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", callback);
    window.removeEventListener("focus", callback);
  };
}

/**
 * The user's *local* date (YYYY-MM-DD). Empty string on the server so nothing date-dependent is rendered
 * there (the server's clock/timezone is not the user's).
 */
export function useToday(): string {
  return useSyncExternalStore(subscribeToDayChange, () => toLocalDateString(), () => "");
}
