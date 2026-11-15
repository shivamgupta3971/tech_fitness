import { describe, it, expect } from "vitest";
import {
  EXERCISE_CATALOG,
  CATALOG_ID_MAP,
  filterEligibleExercises,
  parseExclusions,
} from "../data/exercises";
import { buildWeek, hasEligibleExercises, weekLayout } from "../lib/exercisePlanner";
import { applyAdjustment, bumpReps, suggestAdjustment } from "../lib/adaptive";
import { deriveSessionStatus } from "../lib/storage";
import type { ExercisePreferences, WeeklyExercisePlan, WorkoutSession } from "../lib/storage";
import type { LlmExerciseDay } from "../lib/planValidator";

const ids = (list: { id: string }[]) => list.map((e) => e.id);

const basePrefs: ExercisePreferences = {
  goal: "general_fitness",
  experienceLevel: "beginner",
  availableDaysPerWeek: 3,
  sessionDurationMinutes: 40,
  equipment: ["none"],
  location: "home",
  preferredActivities: [],
  limitations: [],
  avoidList: [],
};

const allExercises = (s: WorkoutSession) => [...s.warmup, ...s.main, ...s.cooldown];

describe("exercise catalog integrity", () => {
  it("has unique ids and usable content", () => {
    const seen = new Set<string>();
    for (const ex of EXERCISE_CATALOG) {
      expect(seen.has(ex.id), `duplicate id ${ex.id}`).toBe(false);
      seen.add(ex.id);
      expect(ex.id.startsWith("ex_")).toBe(true);
      expect(ex.instructions.length, ex.id).toBeGreaterThan(0);
      expect(ex.targetMuscles.length, ex.id).toBeGreaterThan(0);
      expect(ex.equipment.length, ex.id).toBeGreaterThan(0);
      // Only the exercises the pose engine can really score may claim to be trackable.
      if (ex.trackable) expect(ex.trackingMode === "gym" || ex.trackingMode === "dance", ex.id).toBe(true);
      else expect(ex.trackingMode, ex.id).toBe("manual");
    }
  });
});

describe("equipment eligibility", () => {
  it("lets a bodyweight-only user do plank, stretches and glute bridges (regression: they were all filtered out)", () => {
    const eligible = ids(filterEligibleExercises(["none"]));
    for (const id of ["ex_plank", "ex_cat_cow", "ex_childs_pose", "ex_downward_dog", "ex_glute_bridge"]) {
      expect(eligible, id).toContain(id);
    }
  });

  it("treats the listed equipment as alternatives (a kettlebell alone unlocks the goblet squat)", () => {
    expect(ids(filterEligibleExercises(["kettlebell"]))).toContain("ex_db_goblet_squat");
    expect(ids(filterEligibleExercises(["dumbbells"]))).toContain("ex_db_goblet_squat");
    expect(ids(filterEligibleExercises(["none"]))).not.toContain("ex_db_goblet_squat");
  });

  it("gives equipment owners something to do", () => {
    expect(ids(filterEligibleExercises(["none", "kettlebell"]))).toContain("ex_kb_swing");
    expect(ids(filterEligibleExercises(["none", "barbell"]))).toContain("ex_barbell_squat");
    expect(ids(filterEligibleExercises(["none", "resistance_bands"]))).toContain("ex_band_row");
    expect(ids(filterEligibleExercises(["none", "pull_up_bar"]))).toContain("ex_dead_hang");
  });

  it("unlocks barbell and machine work for a full gym but never hides bodyweight moves", () => {
    const eligible = ids(filterEligibleExercises(["full_gym"]));
    expect(eligible).toContain("ex_barbell_deadlift");
    expect(eligible).toContain("ex_leg_press");
    expect(eligible).toContain("ex_squat");
    expect(eligible.length).toBe(EXERCISE_CATALOG.length);
  });
});

describe("limitations and avoid list", () => {
  it("excludes knee-loading and impact moves for 'knee pain' but keeps safe ones", () => {
    const eligible = ids(filterEligibleExercises(["none"], ["knee pain"]));
    for (const id of ["ex_squat", "ex_lunge", "ex_jumping_jacks", "ex_burpees", "ex_dance_cardio"]) {
      expect(eligible, id).not.toContain(id);
    }
    for (const id of ["ex_plank", "ex_glute_bridge", "ex_dead_bug", "ex_brisk_walk", "ex_pushup"]) {
      expect(eligible, id).toContain(id);
    }
  });

  it("understands natural phrasing ('no overhead press', 'bad lower back', 'avoid jumping')", () => {
    expect(ids(filterEligibleExercises(["dumbbells"], ["no overhead press"]))).not.toContain("ex_db_shoulder_press");
    expect(ids(filterEligibleExercises(["dumbbells"], ["bad lower back"]))).not.toContain("ex_db_romanian_deadlift");
    expect(ids(filterEligibleExercises(["none"], ["avoid jumping"]))).not.toContain("ex_jumping_jacks");
  });

  it("matches movement names however they are spelled", () => {
    for (const phrase of ["push-ups", "pushups", "Push Up", "avoid push ups"]) {
      expect(ids(filterEligibleExercises(["none"], [phrase])), phrase).not.toContain("ex_pushup");
    }
    expect(ids(filterEligibleExercises(["none"], ["squats"]))).not.toContain("ex_squat");
  });

  it("ignores blank entries (an empty string used to match, and so exclude, every exercise)", () => {
    expect(filterEligibleExercises(["none"], ["", "   "]).length).toBe(filterEligibleExercises(["none"]).length);
  });

  it("also honours limitations passed separately from the avoid list", () => {
    const eligible = ids(filterEligibleExercises(["none"], [], { limitations: ["wrist pain"] }));
    expect(eligible).not.toContain("ex_pushup");
    expect(eligible).toContain("ex_squat");
  });

  it("parses body areas versus movement names", () => {
    const parsed = parseExclusions(["knee pain", "push-ups", ""]);
    expect([...parsed.stress]).toEqual(["knee"]);
    expect(parsed.terms).toEqual(["pushup"]);
  });

  it("limits difficulty when asked", () => {
    const beginner = filterEligibleExercises(["full_gym"], [], { maxDifficulty: "beginner" });
    expect(beginner.every((e) => e.difficulty === "beginner")).toBe(true);
    expect(ids(beginner)).not.toContain("ex_burpees");
  });
});

describe("weekLayout", () => {
  it("has exactly the requested number of training days, spread out", () => {
    for (let n = 1; n <= 7; n++) {
      const layout = weekLayout(n);
      expect(layout).toHaveLength(7);
      expect(layout.filter((t) => t === "workout")).toHaveLength(n);
    }
    expect(weekLayout(3)).toEqual(["workout", "active_recovery", "workout", "rest", "workout", "active_recovery", "rest"]);
  });
});

describe("buildWeek (deterministic)", () => {
  const build = (prefs: Partial<ExercisePreferences> = {}, llmDays?: LlmExerciseDay[]) =>
    buildWeek({ prefs: { ...basePrefs, ...prefs }, startDate: "2026-03-30", planId: "t", llmDays });

  it("makes seven consecutive days from the start date, across a month boundary", () => {
    const week = build();
    expect(week.map((d) => d.plannedDate)).toEqual([
      "2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05",
    ]);
    expect(new Set(week.map((d) => d.id)).size).toBe(7);
  });

  it("honours the requested number of training days and gives workouts a warm-up, main work and cooldown", () => {
    for (const days of [2, 3, 5, 6]) {
      const week = build({ availableDaysPerWeek: days });
      const workouts = week.filter((d) => d.type === "workout");
      expect(workouts).toHaveLength(days);
      for (const w of workouts) {
        expect(w.warmup.length, w.title).toBeGreaterThan(0);
        expect(w.main.length, w.title).toBeGreaterThanOrEqual(3);
        expect(w.cooldown.length, w.title).toBeGreaterThan(0);
      }
    }
  });

  it("leaves rest days empty and gives recovery days real mobility work", () => {
    const week = build({ availableDaysPerWeek: 3 });
    for (const d of week.filter((x) => x.type === "rest")) expect(allExercises(d)).toHaveLength(0);
    for (const d of week.filter((x) => x.type === "active_recovery")) expect(d.main.length).toBeGreaterThan(0);
  });

  it("uses unique exercise ids and never repeats an exercise within a session", () => {
    const week = build({ availableDaysPerWeek: 6, equipment: ["full_gym"], experienceLevel: "advanced" });
    const all = week.flatMap(allExercises);
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    for (const s of week) {
      const catalogIds = allExercises(s).map((e) => e.catalogId);
      expect(new Set(catalogIds).size, s.title).toBe(catalogIds.length);
    }
  });

  it("only ever uses exercises the user can do (equipment, limitations, avoid list)", () => {
    const cases: Partial<ExercisePreferences>[] = [
      { equipment: ["none"], limitations: ["knee pain"], avoidList: ["knee pain"] },
      { equipment: ["none", "dumbbells"], limitations: ["no overhead press", "lower back"], avoidList: [] },
      { equipment: ["none"], avoidList: ["squat", "push-ups", "plank"] },
      { equipment: ["resistance_bands"], experienceLevel: "advanced", availableDaysPerWeek: 6 },
      { equipment: ["full_gym"], limitations: ["shoulder", "wrist"], availableDaysPerWeek: 5 },
    ];
    for (const c of cases) {
      const prefs = { ...basePrefs, ...c };
      const allowed = new Set(ids(filterEligibleExercises(prefs.equipment, prefs.avoidList, { limitations: prefs.limitations })));
      for (const s of build(c)) {
        for (const e of allExercises(s)) expect(allowed.has(e.catalogId), `${e.catalogId} for ${JSON.stringify(c)}`).toBe(true);
      }
    }
  });

  it("doesn't give a beginner advanced exercises when easier ones exist", () => {
    const week = build({ equipment: ["full_gym"], experienceLevel: "beginner", availableDaysPerWeek: 5 });
    for (const e of week.flatMap(allExercises)) expect(e.difficulty, e.name).not.toBe("advanced");
  });

  it("varies the plan by goal, level and session length (the old fallback ignored all three)", () => {
    const strength = build({ goal: "strength", sessionDurationMinutes: 60 });
    const stamina = build({ goal: "stamina", sessionDurationMinutes: 60 });
    expect(strength.map((d) => d.title)).not.toEqual(stamina.map((d) => d.title));

    const short = build({ sessionDurationMinutes: 20 }).find((d) => d.type === "workout")!;
    const long = build({ sessionDurationMinutes: 75, equipment: ["full_gym"] }).find((d) => d.type === "workout")!;
    expect(long.main.length).toBeGreaterThan(short.main.length);

    const hypertrophy = build({ goal: "muscle_gain", experienceLevel: "intermediate", equipment: ["full_gym"] })
      .flatMap((d) => d.main)
      .find((e) => e.reps);
    expect(hypertrophy?.reps).toBe("8-12");
  });

  it("different training days use different exercises where possible", () => {
    const week = build({ availableDaysPerWeek: 4, equipment: ["none", "dumbbells"] });
    const signatures = week.filter((d) => d.type === "workout").map((d) => d.main.map((e) => e.catalogId).join(","));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("prefers exercises the Arena can track when there is a choice", () => {
    const first = build({ availableDaysPerWeek: 3 }).find((d) => d.type === "workout")!;
    expect(first.main.some((e) => e.trackable)).toBe(true);
  });

  it("detects a profile with nothing to build from", () => {
    expect(hasEligibleExercises({ ...basePrefs, equipment: ["none"], avoidList: ["squat", "pushup", "plank", "glute", "burpee"] })).toBe(true);
    expect(hasEligibleExercises({ ...basePrefs, equipment: ["none"], limitations: ["knee", "back", "shoulder", "wrist", "ankle", "hip", "neck", "elbow", "jump"] })).toBe(true);
  });
});

describe("buildWeek with an LLM suggestion", () => {
  const day = (over: Partial<LlmExerciseDay>): LlmExerciseDay => ({
    title: "Day",
    type: "workout",
    warmupCatalogIds: ["ex_arm_circles"],
    mainCatalogIds: [{ id: "ex_squat", sets: 3, reps: "10", durationSeconds: undefined }, { id: "ex_pushup", sets: undefined, reps: undefined, durationSeconds: undefined }],
    cooldownCatalogIds: ["ex_childs_pose"],
    ...over,
  });
  const rest = day({ type: "rest", title: "Rest", warmupCatalogIds: [], mainCatalogIds: [], cooldownCatalogIds: [] });
  const week3 = (workout: LlmExerciseDay) => [workout, rest, workout, rest, workout, rest, rest];

  it("keeps a valid suggestion and its prescription", () => {
    const plan = buildWeek({ prefs: basePrefs, startDate: "2026-03-30", planId: "t", llmDays: week3(day({})) });
    expect(plan[0].main[0].catalogId).toBe("ex_squat");
    expect(plan[0].main[0].sets).toBe(3);
    expect(plan[0].main[0].reps).toBe("10");
    expect(plan[1].type).toBe("rest");
  });

  it("drops hallucinated ids and swaps ineligible exercises for a safe equivalent", () => {
    const bad = day({
      mainCatalogIds: [
        { id: "ex_made_up", sets: undefined, reps: undefined, durationSeconds: undefined },
        { id: "ex_barbell_squat", sets: undefined, reps: undefined, durationSeconds: undefined }, // needs a barbell
        { id: "ex_squat", sets: undefined, reps: undefined, durationSeconds: undefined },
        { id: "ex_lunge", sets: undefined, reps: undefined, durationSeconds: undefined },
      ],
    });
    const plan = buildWeek({ prefs: { ...basePrefs, equipment: ["none"] }, startDate: "2026-03-30", planId: "t", llmDays: week3(bad) });
    const allowed = new Set(ids(filterEligibleExercises(["none"])));
    for (const s of plan) for (const e of allExercises(s)) expect(allowed.has(e.catalogId), e.catalogId).toBe(true);
    expect(plan[0].main.map((e) => e.catalogId)).not.toContain("ex_made_up");
    expect(plan[0].main.map((e) => e.catalogId)).not.toContain("ex_barbell_squat");
  });

  it("never lets the model smuggle in something the user said to avoid", () => {
    const plan = buildWeek({
      prefs: { ...basePrefs, limitations: ["knee pain"], avoidList: ["knee pain"] },
      startDate: "2026-03-30",
      planId: "t",
      llmDays: week3(day({})), // squat is in the model's suggestion
    });
    for (const s of plan) expect(allExercises(s).map((e) => e.catalogId)).not.toContain("ex_squat");
  });

  it("ignores a suggestion with the wrong number of training days and builds the requested schedule", () => {
    const fiveDays = [day({}), day({}), day({}), day({}), day({}), rest, rest];
    const plan = buildWeek({ prefs: { ...basePrefs, availableDaysPerWeek: 3 }, startDate: "2026-03-30", planId: "t", llmDays: fiveDays });
    expect(plan.filter((d) => d.type === "workout")).toHaveLength(3);
  });

  it("rebuilds a day the model left empty and fills a missing warm-up/cooldown", () => {
    const hollow = day({ mainCatalogIds: [] });
    const noWarm = day({ warmupCatalogIds: [], cooldownCatalogIds: [] });
    const plan = buildWeek({ prefs: basePrefs, startDate: "2026-03-30", planId: "t", llmDays: [hollow, rest, noWarm, rest, day({}), rest, rest] });
    expect(plan[0].main.length).toBeGreaterThanOrEqual(3);
    expect(plan[2].warmup.length).toBeGreaterThan(0);
    expect(plan[2].cooldown.length).toBeGreaterThan(0);
  });
});

describe("session status", () => {
  const ex = (status: WorkoutSession["warmup"][number]["status"], id: string) => ({
    ...CATALOG_ID_MAP.get("ex_squat")!,
    id,
    catalogId: "ex_squat",
    status,
  });
  const session = (statuses: WorkoutSession["warmup"][number]["status"][]): WorkoutSession => ({
    id: "s",
    plannedDate: "2026-01-01",
    title: "t",
    type: "workout",
    warmup: [],
    main: statuses.map((s, i) => ex(s, `e${i}`)) as unknown as WorkoutSession["main"],
    cooldown: [],
    status: "pending",
  });

  it("derives the session from its exercises", () => {
    expect(deriveSessionStatus(session(["pending", "pending"]))).toBe("pending");
    expect(deriveSessionStatus(session(["completed", "pending"]))).toBe("in_progress");
    expect(deriveSessionStatus(session(["completed", "completed"]))).toBe("completed");
    expect(deriveSessionStatus(session(["completed", "skipped"]))).toBe("completed");
    expect(deriveSessionStatus(session(["skipped", "skipped"]))).toBe("skipped");
    expect(deriveSessionStatus(session(["modified", "completed"]))).toBe("completed");
  });

  it("leaves rest days as they are", () => {
    const rest = { ...session([]), type: "rest" as const, status: "pending" as const };
    expect(deriveSessionStatus(rest)).toBe("pending");
  });
});

describe("adaptive adjustments", () => {
  const plan = (): WeeklyExercisePlan =>
    ({
      id: "p",
      createdAt: "",
      weekStartDate: "2026-01-01",
      days: buildWeek({ prefs: { ...basePrefs, availableDaysPerWeek: 5 }, startDate: "2026-03-30", planId: "t" }),
    });

  const firstWorkoutWithRepeat = (p: WeeklyExercisePlan) => {
    for (const s of p.days) {
      for (const e of s.main) {
        const later = p.days.slice(p.days.indexOf(s) + 1).flatMap((d) => d.main).some((x) => x.catalogId === e.catalogId);
        if (later && e.reps) return { s, e };
      }
    }
    throw new Error("test plan has no repeated rep-based exercise");
  };

  it("bumps rep ranges", () => {
    expect(bumpReps("8-12")).toBe("9-13");
    expect(bumpReps("10")).toBe("11");
    expect(bumpReps("to failure")).toBe("to failure");
  });

  it("suggests nothing when there is nothing upcoming to change", () => {
    const p = plan();
    const last = p.days.filter((d) => d.type === "workout").pop()!;
    expect(suggestAdjustment(p, last.id, last.main[0].id, "skipped")).toBeNull();
  });

  it("suggests progression for a completed main lift and eases a skipped one", () => {
    const p = plan();
    const { s, e } = firstWorkoutWithRepeat(p);
    expect(suggestAdjustment(p, s.id, e.id, "completed")?.kind).toBe("progress");
    expect(suggestAdjustment(p, s.id, e.id, "skipped")?.kind).toBe("ease");
    expect(suggestAdjustment(p, s.id, e.id, "pending")).toBeNull();
    // Warm-ups and cooldowns are not progressed.
    const warm = s.warmup[0];
    expect(suggestAdjustment(p, s.id, warm.id, "completed")).toBeNull();
  });

  it("applies progression to upcoming sessions only, without mutating the original plan", () => {
    const p = plan();
    const { s, e } = firstWorkoutWithRepeat(p);
    const before = JSON.stringify(p);
    const suggestion = suggestAdjustment(p, s.id, e.id, "completed")!;
    const next = applyAdjustment(p, suggestion);

    expect(JSON.stringify(p)).toBe(before);
    const idx = p.days.indexOf(s);
    const original = p.days[idx].main.find((x) => x.id === e.id)!;
    expect(next.days[idx].main.find((x) => x.id === e.id)!.reps).toBe(original.reps); // today's untouched

    const changed = next.days
      .slice(idx + 1)
      .flatMap((d) => d.main)
      .filter((x) => x.catalogId === e.catalogId);
    expect(changed.length).toBe(suggestion.affected);
    for (const x of changed) expect(x.reps).toBe(bumpReps(e.reps!));
  });

  it("eases upcoming sessions by dropping a set", () => {
    const p = plan();
    const { s, e } = firstWorkoutWithRepeat(p);
    const suggestion = suggestAdjustment(p, s.id, e.id, "modified")!;
    const next = applyAdjustment(p, suggestion);
    const idx = p.days.indexOf(s);
    const later = p.days.slice(idx + 1).flatMap((d) => d.main).find((x) => x.catalogId === e.catalogId)!;
    const eased = next.days.slice(idx + 1).flatMap((d) => d.main).find((x) => x.catalogId === e.catalogId)!;
    expect(eased.sets).toBe(Math.max(1, (later.sets ?? 1) - 1));
    expect(eased.notes).toMatch(/Eased/);
  });
});
