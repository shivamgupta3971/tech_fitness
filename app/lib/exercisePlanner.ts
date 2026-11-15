/**
 * Exercise week builder.
 *
 * A model (when configured) may *suggest* a week, but this module decides what ships:
 *   - only exercises the user can actually do (equipment, limitations, avoid list, experience level)
 *   - the number of training days the user asked for
 *   - sets/reps/rest derived from goal, level and session length
 * With no model, or an unusable reply, the same rules build the whole week deterministically, so the plan
 * always respects the user's inputs (the old fallback ignored all of them).
 */

import { EXERCISE_CATALOG, CATALOG_ID_MAP, difficultyRank, filterEligibleExercises } from "../data/exercises";
import type { CatalogExercise } from "../data/exercises";
import type { LlmExerciseDay } from "./planValidator";
import type {
  ExerciseGoal,
  ExercisePreferences,
  ExperienceLevel,
  PlannedExercise,
  WorkoutSession,
} from "./storage";
import { addDays } from "./dates";

type SessionType = WorkoutSession["type"];
type Focus = "full_body" | "upper" | "lower" | "cardio" | "core" | "mobility";
type Role = "upper" | "lower" | "core" | "cardio" | "mobility";
type Slot = "warmup" | "main" | "cooldown";

// ─── Weekly layout ────────────────────────────────────────────────────────────

/** Which of the 7 days (0 = first day of the plan) are training days, spaced for recovery. */
const WORKOUT_DAY_OFFSETS: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Layout for the week: training days per the user's schedule, other days alternate recovery / rest. */
export function weekLayout(daysPerWeek: number): SessionType[] {
  const offsets = WORKOUT_DAY_OFFSETS[Math.min(7, Math.max(1, Math.round(daysPerWeek)))];
  let recoveryNext = true;
  return Array.from({ length: 7 }, (_, i): SessionType => {
    if (offsets.includes(i)) return "workout";
    const type: SessionType = recoveryNext ? "active_recovery" : "rest";
    recoveryNext = !recoveryNext;
    return type;
  });
}

/** Session focus in training-day order. Six entries so a 5–6 day week stays balanced instead of repeating one focus. */
const FOCUS_CYCLES: Record<ExerciseGoal, Focus[]> = {
  strength: ["lower", "upper", "full_body", "core", "lower", "upper"],
  muscle_gain: ["upper", "lower", "full_body", "upper", "lower", "full_body"],
  stamina: ["cardio", "full_body", "cardio", "core", "cardio", "full_body"],
  flexibility: ["mobility", "core", "mobility", "full_body", "mobility", "core"],
  general_fitness: ["full_body", "cardio", "core", "lower", "upper", "cardio"],
  sports_performance: ["lower", "cardio", "full_body", "core", "lower", "cardio"],
};

const FOCUS_TITLES: Record<Focus, string> = {
  full_body: "Full Body Strength",
  upper: "Upper Body Push & Pull",
  lower: "Lower Body Power",
  cardio: "Cardio & Dance Conditioning",
  core: "Core & Stability",
  mobility: "Mobility & Flexibility",
};

/** What each main-exercise slot of a session should target, in order. */
const FOCUS_SLOTS: Record<Focus, Role[]> = {
  full_body: ["lower", "upper", "core", "lower", "upper", "cardio", "core"],
  upper: ["upper", "upper", "upper", "core", "upper", "upper", "core"],
  lower: ["lower", "lower", "lower", "core", "lower", "lower", "cardio"],
  cardio: ["cardio", "cardio", "core", "cardio", "cardio", "core", "cardio"],
  core: ["core", "core", "core", "core", "upper", "lower", "cardio"],
  mobility: ["mobility", "mobility", "mobility", "mobility", "mobility", "mobility", "mobility"],
};

// ─── Exercise roles & selection ───────────────────────────────────────────────

const UPPER_RE = /chest|triceps|biceps|shoulder|deltoid|\blat|rhomboid|forearm|upper back|rotator/;
const LOWER_RE = /quadricep|glute|hamstring|calves|calf|thigh/;

function matchesRole(ex: CatalogExercise, role: Role): boolean {
  const muscles = ex.targetMuscles.join(" ").toLowerCase();
  switch (role) {
    case "upper":
      return ex.category === "strength" && UPPER_RE.test(muscles) && !LOWER_RE.test(muscles);
    case "lower":
      return ex.category === "strength" && LOWER_RE.test(muscles);
    case "core":
      return ex.category === "core";
    case "cardio":
      return ex.category === "cardio" || ex.category === "dance";
    case "mobility":
      return ex.category === "mobility";
  }
}

const WARMUP_PREFERENCE = [
  "ex_arm_circles",
  "ex_jumping_jacks",
  "ex_cat_cow",
  "ex_brisk_walk",
  "ex_high_knees",
  "ex_hip_flexor_stretch",
];

const COOLDOWN_PREFERENCE = [
  "ex_childs_pose",
  "ex_hamstring_stretch",
  "ex_quad_stretch",
  "ex_butterfly_stretch",
  "ex_downward_dog",
  "ex_cobra_stretch",
  "ex_hip_flexor_stretch",
];

/** Exercises scored by the Arena are preferred when everything else is equal. */
const CATALOG_ORDER = new Map(EXERCISE_CATALOG.map((ex, i) => [ex.id, i]));

interface Context {
  /** Hard constraints only: equipment, limitations, avoid list. */
  all: CatalogExercise[];
  /** `all` further limited to the user's experience level. */
  atLevel: CatalogExercise[];
  allIds: Set<string>;
  levelIds: Set<string>;
  /** How many times each exercise is already in the week, so repeats are spread out. */
  usage: Map<string, number>;
  prefs: ExercisePreferences;
}

function makeContext(prefs: ExercisePreferences): Context {
  const all = filterEligibleExercises(prefs.equipment, prefs.avoidList, { limitations: prefs.limitations });
  const atLevel = filterEligibleExercises(prefs.equipment, prefs.avoidList, {
    limitations: prefs.limitations,
    maxDifficulty: prefs.experienceLevel,
  });
  return {
    all,
    atLevel,
    allIds: new Set(all.map((e) => e.id)),
    levelIds: new Set(atLevel.map((e) => e.id)),
    usage: new Map(),
    prefs,
  };
}

function pickBest(pool: CatalogExercise[], used: Set<string>, ctx: Context): CatalogExercise | null {
  let best: CatalogExercise | null = null;
  let bestKey: [number, number, number] | null = null;
  for (const ex of pool) {
    if (used.has(ex.id)) continue;
    // Least-used first, then Arena-trackable, then catalog order (stable and deterministic).
    const key: [number, number, number] = [
      ctx.usage.get(ex.id) ?? 0,
      ex.trackable ? 0 : 1,
      CATALOG_ORDER.get(ex.id) ?? 0,
    ];
    if (
      !bestKey ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      best = ex;
      bestKey = key;
    }
  }
  return best;
}

function claim(ex: CatalogExercise, used: Set<string>, ctx: Context): void {
  used.add(ex.id);
  ctx.usage.set(ex.id, (ctx.usage.get(ex.id) ?? 0) + 1);
}

/** Next exercise for a role: at the user's level if possible, otherwise any safe one. */
function pickForRole(role: Role, used: Set<string>, ctx: Context): CatalogExercise | null {
  return (
    pickBest(ctx.atLevel.filter((e) => matchesRole(e, role)), used, ctx) ??
    pickBest(ctx.all.filter((e) => matchesRole(e, role)), used, ctx)
  );
}

function pickFromPreference(
  preference: string[],
  count: number,
  used: Set<string>,
  ctx: Context,
  rotate: number
): CatalogExercise[] {
  const available = preference.filter((id) => ctx.allIds.has(id) && !used.has(id));
  const chosen: CatalogExercise[] = [];
  for (let i = 0; i < available.length && chosen.length < count; i++) {
    const ex = CATALOG_ID_MAP.get(available[(i + rotate) % available.length]);
    if (ex && !chosen.includes(ex)) chosen.push(ex);
  }
  // Not enough preferred options for this user: top up with any eligible mobility move.
  if (chosen.length < count) {
    for (const ex of ctx.all.filter((e) => e.category === "mobility")) {
      if (chosen.length >= count) break;
      if (!used.has(ex.id) && !chosen.includes(ex)) chosen.push(ex);
    }
  }
  return chosen;
}

// ─── Prescription ─────────────────────────────────────────────────────────────

interface Prescription {
  sets?: number;
  reps?: string;
  durationSeconds?: number;
  restSeconds?: number;
}

const REP_SCHEMES: Record<ExerciseGoal, { sets: number; reps: string; rest: number }> = {
  strength: { sets: 4, reps: "5-8", rest: 120 },
  muscle_gain: { sets: 4, reps: "8-12", rest: 75 },
  stamina: { sets: 3, reps: "15-20", rest: 30 },
  flexibility: { sets: 2, reps: "10-12", rest: 30 },
  general_fitness: { sets: 3, reps: "10-12", rest: 60 },
  sports_performance: { sets: 3, reps: "6-10", rest: 90 },
};

/** Cardio done as one steady block (minutes) rather than intervals. */
const STEADY_STATE = new Set(["ex_brisk_walk", "ex_stationary_bike", "ex_dance_cardio", "ex_dance_hiphop"]);

function prescribe(
  ex: CatalogExercise,
  slot: Slot,
  goal: ExerciseGoal,
  level: ExperienceLevel,
  sessionMinutes: number,
  /** Longest steady-state block (minutes): full length on a cardio day, shorter when cardio just finishes a session. */
  maxSteadyMinutes = 20
): Prescription {
  const rank = difficultyRank(level);

  if (slot !== "main") {
    return { sets: 1, durationSeconds: slot === "warmup" ? 30 + rank * 10 : 40 };
  }

  if (STEADY_STATE.has(ex.id)) {
    const minutes = Math.min(maxSteadyMinutes, Math.max(5, Math.round((sessionMinutes * 0.4) / 5) * 5));
    return { sets: 1, durationSeconds: minutes * 60 };
  }

  if (ex.timed) {
    const seconds = ex.category === "cardio" ? 40 + rank * 10 : 30 + rank * 10;
    return { sets: Math.max(2, 3 - (rank === 0 ? 1 : 0)), durationSeconds: seconds, restSeconds: ex.category === "mobility" ? 15 : 30 };
  }

  const scheme = REP_SCHEMES[goal];
  let reps = scheme.reps;
  // 5-8 reps makes sense with weights; bodyweight moves need a higher range to be a stimulus.
  if (goal === "strength" && ex.equipment.includes("none")) reps = "8-12";
  // Never prescribe long high-rep sets of heavy barbell lifts.
  if (ex.equipment.includes("barbell") && reps === "15-20") reps = "10-12";

  let sets = rank === 0 ? Math.max(2, scheme.sets - 1) : scheme.sets;
  // Unloaded core drills (bird-dog, dead bug) gain little beyond three sets.
  if (ex.category === "core") sets = Math.min(sets, 3);

  return { sets, reps, restSeconds: scheme.rest };
}

function toPlanned(ex: CatalogExercise, id: string, rx: Prescription): PlannedExercise {
  return {
    id,
    catalogId: ex.id,
    name: ex.name,
    description: ex.description,
    targetMuscles: ex.targetMuscles,
    sets: rx.sets,
    reps: rx.reps,
    durationSeconds: rx.durationSeconds,
    restSeconds: rx.restSeconds,
    equipment: ex.equipment,
    difficulty: ex.difficulty,
    beginnerAlternative: ex.beginnerAlternative,
    instructions: ex.instructions,
    trackable: ex.trackable,
    trackingMode: ex.trackingMode,
    status: "pending",
  };
}

// ─── Deterministic sessions ───────────────────────────────────────────────────

function mainCountFor(sessionMinutes: number): number {
  return Math.min(7, Math.max(3, Math.round((sessionMinutes - 10) / 7)));
}

interface SessionIds {
  sessionId: string;
  date: string;
}

function emptySession(type: SessionType, title: string, ids: SessionIds): WorkoutSession {
  return {
    id: ids.sessionId,
    plannedDate: ids.date,
    title,
    type,
    warmup: [],
    main: [],
    cooldown: [],
    status: "pending",
  };
}

function buildWarmupAndCooldown(session: WorkoutSession, ctx: Context, used: Set<string>, rotate: number): void {
  const { goal, experienceLevel, sessionDurationMinutes } = ctx.prefs;
  const warmCount = sessionDurationMinutes >= 50 ? 3 : 2;

  const warm = pickFromPreference(WARMUP_PREFERENCE, warmCount, used, ctx, 0);
  warm.forEach((ex, i) => {
    claim(ex, used, ctx);
    session.warmup.push(toPlanned(ex, `${session.id}_w${i}`, prescribe(ex, "warmup", goal, experienceLevel, sessionDurationMinutes)));
  });

  const cool = pickFromPreference(COOLDOWN_PREFERENCE, 2, used, ctx, rotate);
  cool.forEach((ex, i) => {
    claim(ex, used, ctx);
    session.cooldown.push(toPlanned(ex, `${session.id}_c${i}`, prescribe(ex, "cooldown", goal, experienceLevel, sessionDurationMinutes)));
  });
}

function buildWorkout(focus: Focus, ids: SessionIds, ctx: Context, sessionNumber: number): WorkoutSession {
  const { goal, experienceLevel, sessionDurationMinutes } = ctx.prefs;
  const session = emptySession("workout", FOCUS_TITLES[focus], ids);
  const used = new Set<string>();

  const slots = FOCUS_SLOTS[focus];
  const target = mainCountFor(sessionDurationMinutes);
  for (let i = 0; session.main.length < target && i < slots.length; i++) {
    const ex = pickForRole(slots[i], used, ctx);
    if (!ex) continue;
    claim(ex, used, ctx);
    session.main.push(toPlanned(ex, `${session.id}_m${session.main.length}`, prescribe(ex, "main", goal, experienceLevel, sessionDurationMinutes, focus === "cardio" ? 20 : 10)));
  }

  // Very restrictive profiles can leave a role empty; top up from whatever is safe so the session isn't hollow.
  const anything = [...ctx.atLevel, ...ctx.all].filter((e) => e.category !== "mobility");
  while (session.main.length < Math.min(target, 3)) {
    const ex = pickBest(anything, used, ctx);
    if (!ex) break;
    claim(ex, used, ctx);
    session.main.push(toPlanned(ex, `${session.id}_m${session.main.length}`, prescribe(ex, "main", goal, experienceLevel, sessionDurationMinutes)));
  }

  buildWarmupAndCooldown(session, ctx, used, sessionNumber);
  return session;
}

function buildRecovery(ids: SessionIds, ctx: Context, sessionNumber: number): WorkoutSession {
  const { goal, experienceLevel } = ctx.prefs;
  const session = emptySession("active_recovery", "Active Recovery & Mobility", ids);
  const used = new Set<string>();

  const walk = ctx.allIds.has("ex_brisk_walk") ? CATALOG_ID_MAP.get("ex_brisk_walk") : undefined;
  if (walk) {
    claim(walk, used, ctx);
    session.main.push(toPlanned(walk, `${session.id}_m0`, { sets: 1, durationSeconds: 15 * 60 }));
  }
  const stretches = pickFromPreference(COOLDOWN_PREFERENCE, 3, used, ctx, sessionNumber);
  stretches.forEach((ex) => {
    claim(ex, used, ctx);
    session.main.push(toPlanned(ex, `${session.id}_m${session.main.length}`, prescribe(ex, "main", goal, experienceLevel, 20)));
  });
  return session;
}

function buildRest(ids: SessionIds): WorkoutSession {
  return emptySession("rest", "Rest & Recovery", ids);
}

// ─── Using an LLM suggestion ──────────────────────────────────────────────────

function countWorkouts(days: LlmExerciseDay[]): number {
  return days.filter((d) => d.type === "workout").length;
}

type LlmMainItem = LlmExerciseDay["mainCatalogIds"][number];

/** An eligible stand-in with the same category for an exercise the user can't do. */
function substituteFor(ex: CatalogExercise, used: Set<string>, ctx: Context): CatalogExercise | null {
  const sameKind = (e: CatalogExercise) => e.category === ex.category;
  return (
    pickBest(ctx.atLevel.filter(sameKind), used, ctx) ??
    pickBest(ctx.all.filter(sameKind), used, ctx)
  );
}

/**
 * Cleans one LLM day: unknown ids are dropped, ineligible ones swapped for a safe equivalent, duplicates removed.
 * Returns null when too little survives, so the caller rebuilds the day deterministically.
 */
function sessionFromLlmDay(day: LlmExerciseDay, ids: SessionIds, ctx: Context): WorkoutSession | null {
  const { goal, experienceLevel, sessionDurationMinutes } = ctx.prefs;
  const session = emptySession(day.type, day.title, ids);
  const used = new Set<string>();

  const resolve = (id: string): CatalogExercise | null => {
    const ex = CATALOG_ID_MAP.get(id);
    if (!ex) return null; // hallucinated id: drop rather than guess
    if (used.has(ex.id)) return null;
    if (ctx.levelIds.has(ex.id)) return ex;
    if (ctx.allIds.has(ex.id)) return ex; // allowed but above the user's level: keep (the model may have a reason)
    return substituteFor(ex, used, ctx); // not allowed for this user: swap for a safe equivalent
  };

  const add = (target: PlannedExercise[], slot: Slot, ex: CatalogExercise | null, given?: LlmMainItem) => {
    if (!ex || used.has(ex.id)) return;
    claim(ex, used, ctx);
    const base = prescribe(ex, slot, goal, experienceLevel, sessionDurationMinutes);
    target.push(
      toPlanned(ex, `${session.id}_${slot[0]}${target.length}`, {
        sets: given?.sets ?? base.sets,
        reps: given?.reps ?? base.reps,
        durationSeconds: given?.durationSeconds ?? base.durationSeconds,
        restSeconds: base.restSeconds,
      })
    );
  };

  if (day.type === "rest") return session;

  day.warmupCatalogIds.forEach((id) => add(session.warmup, "warmup", resolve(id)));
  day.mainCatalogIds.slice(0, 8).forEach((item) => {
    add(session.main, "main", resolve(item.id), item);
  });
  day.cooldownCatalogIds.forEach((id) => add(session.cooldown, "cooldown", resolve(id)));

  const minMain = day.type === "workout" ? 2 : 1;
  if (session.main.length < minMain) return null;

  // A day with no warm-up or cool-down gets the standard ones.
  if (session.warmup.length === 0 || session.cooldown.length === 0) {
    const filler = emptySession("workout", "", ids);
    buildWarmupAndCooldown(filler, ctx, used, 0);
    if (session.warmup.length === 0) session.warmup = filler.warmup;
    if (session.cooldown.length === 0) session.cooldown = filler.cooldown;
  }
  return session;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export interface BuildWeekInput {
  prefs: ExercisePreferences;
  /** First day of the plan, YYYY-MM-DD (the user's local today). */
  startDate: string;
  planId: string;
  /** Optional LLM suggestion; used only where it is valid and matches the requested training days. */
  llmDays?: LlmExerciseDay[] | null;
}

/** True when the user's equipment/limitations leave nothing to build a plan from. */
export function hasEligibleExercises(prefs: ExercisePreferences): boolean {
  return filterEligibleExercises(prefs.equipment, prefs.avoidList, { limitations: prefs.limitations }).length > 0;
}

export function buildWeek({ prefs, startDate, planId, llmDays }: BuildWeekInput): WorkoutSession[] {
  const ctx = makeContext(prefs);
  const layout = weekLayout(prefs.availableDaysPerWeek);
  // Trust the model's day types only if it honoured the number of training days the user asked for.
  const llmUsable = !!llmDays && llmDays.length === 7 && countWorkouts(llmDays) === prefs.availableDaysPerWeek;

  const cycle = FOCUS_CYCLES[prefs.goal];
  let workoutNumber = 0;

  return Array.from({ length: 7 }, (_, i) => {
    const ids: SessionIds = { sessionId: `${planId}_s${i}`, date: addDays(startDate, i) };
    const type = llmUsable ? llmDays![i].type : layout[i];
    const focus = cycle[workoutNumber % cycle.length];

    if (llmUsable) {
      const fromLlm = sessionFromLlmDay(llmDays![i], ids, ctx);
      if (fromLlm) {
        if (type === "workout") workoutNumber++;
        return fromLlm;
      }
    }

    switch (type) {
      case "workout":
        return buildWorkout(focus, ids, ctx, workoutNumber++);
      case "active_recovery":
        return buildRecovery(ids, ctx, i);
      default:
        return buildRest(ids);
    }
  });
}

/** The eligible catalog the LLM may choose from, in the compact form used in the prompt. */
export function eligibleCatalogForPrompt(prefs: ExercisePreferences) {
  const pool = filterEligibleExercises(prefs.equipment, prefs.avoidList, {
    limitations: prefs.limitations,
    maxDifficulty: prefs.experienceLevel,
  });
  const list = pool.length >= 8 ? pool : filterEligibleExercises(prefs.equipment, prefs.avoidList, { limitations: prefs.limitations });
  return list.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    difficulty: e.difficulty,
    trackable: e.trackable,
    timed: e.timed ?? false,
  }));
}
