import { describe, it, expect } from "vitest";
import {
  addDays,
  daysBetween,
  defaultDayIndex,
  isValidDateString,
  parseLocalDate,
  planWindow,
  toLocalDateString,
} from "../lib/dates";
import { parseLooseJson } from "../lib/json";
import {
  ExercisePreferencesSchema,
  LlmDaySchema,
  LlmExercisePlanSchema,
  UserProfileSchema,
} from "../lib/planValidator";
import { parseWeeklyDietPlan, parseWeeklyExercisePlan, parseNutritionLogs } from "../lib/storage";

describe("local dates", () => {
  it("formats the local calendar date, not the UTC one", () => {
    // 00:30 local on Jan 1: toISOString() would say Dec 31 anywhere east of UTC — the bug this replaces.
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toLocalDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("round-trips and does arithmetic across month and year boundaries", () => {
    expect(toLocalDateString(parseLocalDate("2026-03-09"))).toBe("2026-03-09");
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
  });

  it("validates real calendar dates only", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-31")).toBe(false);
    expect(isValidDateString("26-02-28")).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
    expect(isValidDateString(20260228)).toBe(false);
  });

  it("knows where today sits relative to a plan", () => {
    const dates = ["2026-05-10", "2026-05-11", "2026-05-12"];
    expect(planWindow(dates, "2026-05-09")).toBe("upcoming");
    expect(planWindow(dates, "2026-05-11")).toBe("active");
    expect(planWindow(dates, "2026-05-13")).toBe("ended");
    expect(planWindow(dates, "")).toBe("active"); // server render: no "today" yet
    expect(defaultDayIndex(dates, "2026-05-11")).toBe(1);
    expect(defaultDayIndex(dates, "2026-05-01")).toBe(0);
    expect(defaultDayIndex(dates, "2026-06-01")).toBe(2);
  });
});

describe("parseLooseJson", () => {
  it("parses clean, fenced and prose-wrapped JSON", () => {
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseLooseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLooseJson('Here you go: {"a":{"b":2}} hope that helps')).toEqual({ a: { b: 2 } });
  });

  it("tolerates trailing commas", () => {
    expect(parseLooseJson('{"a":[1,2,],"b":3,}')).toEqual({ a: [1, 2], b: 3 });
  });

  it("returns null instead of throwing", () => {
    expect(parseLooseJson("")).toBeNull();
    expect(parseLooseJson(null)).toBeNull();
    expect(parseLooseJson("no json here")).toBeNull();
    expect(parseLooseJson('{"truncated": [1, 2')).toBeNull();
  });
});

describe("LLM diet output schema", () => {
  const meal = (over: Record<string, unknown> = {}) => ({
    name: "Dal Rice",
    type: "lunch",
    ingredients: [{ name: "Dal", quantity: "150g" }],
    prepSteps: ["Cook"],
    ...over,
  });
  const day = (meals: unknown[]) => LlmDaySchema.safeParse({ meals });

  it("accepts the harmless variations models produce", () => {
    const parsed = day([
      meal({ type: "Breakfast" }),
      meal({ type: "LUNCH", ingredients: [{ name: "Rice", quantity: 150 }] }),
      meal({ type: "Evening Snack", hydrationReminderMl: "500" }),
      meal({ type: "Dinner", hydrationReminderMl: "lots" }),
    ]);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.meals.map((m) => m.type)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(parsed.data.meals[1].ingredients[0].quantity).toBe("150g"); // number → grams
    expect(parsed.data.meals[2].hydrationReminderMl).toBe(500);
    expect(parsed.data.meals[3].hydrationReminderMl).toBeUndefined(); // unusable value dropped, not fatal
  });

  it("rejects days that cannot be used", () => {
    expect(day([meal(), meal()]).success).toBe(false); // too few meals
    expect(day([meal(), meal(), meal({ type: "elevenses" })]).success).toBe(false); // unknown slot
    expect(day([meal(), meal(), meal({ ingredients: [] })]).success).toBe(false); // nothing to cook
    expect(day([meal(), meal(), meal({ name: "" })]).success).toBe(false);
  });
});

describe("LLM exercise output schema", () => {
  const dayOf = (over: Record<string, unknown> = {}) => ({
    title: "Day",
    type: "workout",
    warmupCatalogIds: ["ex_arm_circles"],
    mainCatalogIds: [{ id: "ex_squat", sets: 3, reps: "10-12" }],
    cooldownCatalogIds: [],
    ...over,
  });

  it("needs exactly seven days", () => {
    expect(LlmExercisePlanSchema.safeParse({ days: Array(7).fill(dayOf()) }).success).toBe(true);
    expect(LlmExercisePlanSchema.safeParse({ days: Array(6).fill(dayOf()) }).success).toBe(false);
  });

  it("accepts plain-string main ids and numeric reps, and ignores nonsense numbers", () => {
    const parsed = LlmExercisePlanSchema.safeParse({
      days: Array(7).fill(dayOf({ mainCatalogIds: ["ex_squat", { id: "ex_plank", sets: "x", reps: 12, durationSeconds: 45 }] })),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const main = parsed.data.days[0].mainCatalogIds;
    expect(main[0]).toMatchObject({ id: "ex_squat" });
    expect(main[1]).toMatchObject({ id: "ex_plank", sets: undefined, reps: "12", durationSeconds: 45 });
  });
});

describe("request schemas", () => {
  it("accepts the client's startDate and enforces ranges", () => {
    const ok = UserProfileSchema.safeParse({
      age: 30, heightCm: 170, weightKg: 70, sex: "female", activityLevel: "light", goal: "general_fitness",
      dietType: "vegan", allergies: ["nuts"], budget: "moderate", startDate: "2026-01-01",
    });
    expect(ok.success).toBe(true);
    expect(UserProfileSchema.safeParse({ ...(ok.success ? ok.data : {}), age: 5 }).success).toBe(false);
  });

  it("caps list sizes so a request can't smuggle in an enormous prompt", () => {
    const tooMany = Array.from({ length: 30 }, (_, i) => `a${i}`);
    const r = ExercisePreferencesSchema.safeParse({
      goal: "strength", experienceLevel: "beginner", availableDaysPerWeek: 3, sessionDurationMinutes: 30,
      equipment: ["none"], location: "home", limitations: tooMany,
    });
    expect(r.success).toBe(false);
  });
});

describe("stored data is validated on read", () => {
  it("returns null/empty for corrupt or foreign shapes instead of crashing a page", () => {
    expect(parseWeeklyDietPlan(null)).toBeNull();
    expect(parseWeeklyDietPlan("not json")).toBeNull();
    expect(parseWeeklyDietPlan(JSON.stringify({ id: "x", days: "nope" }))).toBeNull();
    expect(parseWeeklyDietPlan(JSON.stringify({ id: "x", days: [{ date: "2026-01-01" }], groceryList: [] }))).toBeNull();
    expect(parseWeeklyExercisePlan(JSON.stringify({ id: "x", days: [] }))).toBeNull();
    expect(parseNutritionLogs("{}")).toEqual([]);
    expect(parseNutritionLogs(JSON.stringify([{ date: "d", mealId: "m", eaten: true }, { junk: 1 }]))).toHaveLength(1);
  });
});
