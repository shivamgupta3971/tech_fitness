import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";
import { parseLooseJson } from "../../../lib/json";
import {
  computeMacroTargets,
  requiresProfessionalNotice,
} from "../../../lib/nutrition";
import type { MacroTargets } from "../../../lib/nutrition";
import { VERIFIED_FOOD_NAMES } from "../../../lib/nutritionLookup";
import { LlmDaySchema, UserProfileSchema } from "../../../lib/planValidator";
import type { ValidatedUserProfile } from "../../../lib/planValidator";
import {
  buildDayForTarget,
  buildFallbackDay,
  buildGroceryList,
  findDayViolation,
  isCompleteDay,
} from "../../../lib/dietPlanner";
import type { RawDay } from "../../../lib/dietPlanner";
import { addDays, isValidDateString, toLocalDateString } from "../../../lib/dates";
import type { DayPlan, WeeklyDietPlan } from "../../../lib/storage";

const PLAN_DAYS = 7;
/** Concurrent LLM calls. Small enough for free-tier rate limits, large enough that 7 days take ~2 rounds. */
const LLM_CONCURRENCY = 4;
/** After this long, remaining days use the built-in meal bank instead of waiting on a slow provider. */
const LLM_BUDGET_MS = 50_000;
/** One retry for a reply that parses but is unusable (wrong shape or breaks the diet); not for outages. */
const MAX_ATTEMPTS = 2;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A different regional flavour per day keeps seven independently generated days from repeating each other. */
const DAY_THEMES = [
  "North Indian home-style (dal, roti, sabzi)",
  "South Indian (idli, dosa, sambar, rice)",
  "Gujarati / Rajasthani light meals",
  "Maharashtrian (poha, usal, bhakri-style)",
  "Bengali / Eastern (khichuri, light curries)",
  "Punjabi comfort food, lightened",
  "Simple one-pot meals (khichdi, pulao, curd rice)",
];

function buildDayPrompt(
  profile: ValidatedUserProfile,
  targets: MacroTargets,
  dayIndex: number
): string {
  const allergies = profile.allergies.length ? profile.allergies.join(", ") : "None";
  return `You are a sports nutritionist specializing in Indian cuisines. Plan ONE day of meals.

Day: ${DAY_NAMES[dayIndex % 7]}
Theme for variety: ${DAY_THEMES[dayIndex % DAY_THEMES.length]}
Daily target: about ${targets.calories} kcal (protein ~${targets.proteinG}g, carbs ~${targets.carbsG}g, fat ~${targets.fatG}g)
Diet type: ${profile.dietType}
ALLERGIES / MUST AVOID: ${allergies}
Budget: ${profile.budget}
Preferred cuisine: ${profile.cuisinePreferences?.join(", ") || "Indian staples"}

STRICT RULES:
1. Never include any allergen listed above, in any form.
2. Follow the diet type exactly. Vegetarian = no meat, fish or eggs. Vegan = additionally no dairy, honey or eggs. Eggetarian = vegetarian plus eggs.
3. Exactly 4 meals with type "breakfast", "lunch", "snack", "dinner".
4. Every ingredient needs a quantity in grams as cooked/ready-to-eat weight, e.g. "150g" or "2 pieces (80g)".
5. Prefer these exact ingredient names where they fit (their nutrition is verified): ${VERIFIED_FOOD_NAMES.join("; ")}.

Return ONLY a JSON object of this shape:
{"meals":[{"name":"Dish name","type":"breakfast","ingredients":[{"name":"Ingredient","quantity":"150g"}],"prepSteps":["Step 1","Step 2"],"hydrationReminderMl":500}]}`;
}

type DaySource = "ai" | "builtin";

/** Asks the LLM for one day; returns null if it can't produce a usable, safe day (caller falls back). */
async function generateLlmDay(
  profile: ValidatedUserProfile,
  targets: MacroTargets,
  dayIndex: number,
  deadline: number
): Promise<RawDay | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) return null;

    let reply: string;
    try {
      reply = await chatCompletion({
        messages: [
          { role: "system", content: "You are a nutrition engine. Reply with one valid JSON object and nothing else." },
          { role: "user", content: buildDayPrompt(profile, targets, dayIndex) },
        ],
        maxTokens: 1800,
        temperature: 0.7,
        json: true,
      });
    } catch (err) {
      // Provider outage / no key / quota: retrying immediately won't help.
      console.warn(`[diet/plan] day ${dayIndex + 1}: LLM unavailable, using built-in meals:`, err instanceof Error ? err.message : err);
      return null;
    }

    const parsed = LlmDaySchema.safeParse(parseLooseJson(reply));
    if (!parsed.success) {
      console.warn(`[diet/plan] day ${dayIndex + 1} attempt ${attempt}: unusable reply (${parsed.error.issues[0]?.message ?? "bad shape"})`);
      continue;
    }

    const day: RawDay = {
      meals: parsed.data.meals.map((m) => ({
        name: m.name,
        type: m.type,
        ingredients: m.ingredients,
        prepSteps: m.prepSteps,
        hydrationReminderMl: m.hydrationReminderMl,
      })),
    };

    if (!isCompleteDay(day)) {
      console.warn(`[diet/plan] day ${dayIndex + 1} attempt ${attempt}: missing breakfast/lunch/dinner`);
      continue;
    }

    const violation = findDayViolation(day, profile.dietType, profile.allergies);
    if (violation) {
      console.warn(`[diet/plan] day ${dayIndex + 1} attempt ${attempt}: rejected — ${violation}`);
      continue;
    }

    return day;
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function describeValidationError(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): string {
  const fields = Object.entries(error.flatten().fieldErrors)
    .map(([field, messages]) => `${field}: ${messages?.[0] ?? "invalid"}`)
    .slice(0, 3);
  return fields.length ? `Please check your details — ${fields.join("; ")}` : "Invalid profile data";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parseResult = UserProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: describeValidationError(parseResult.error), details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const profile = parseResult.data;

    // Safety limit check
    if (requiresProfessionalNotice(profile)) {
      return NextResponse.json(
        {
          error:
            "Safety Advisory: Due to medical context, age under 18, or pregnancy, automated restrictive meal plans are not generated. Please consult a qualified clinical dietitian or healthcare professional.",
          isSafetyNotice: true,
        },
        { status: 400 }
      );
    }

    // Deterministic macro calculation in code (never by LLM)
    const targets = computeMacroTargets(profile);
    if (!targets) {
      return NextResponse.json(
        { error: "Could not compute safe macro targets for this profile." },
        { status: 400 }
      );
    }

    const startDate = isValidDateString(profile.startDate) ? profile.startDate : toLocalDateString();
    const deadline = Date.now() + LLM_BUDGET_MS;
    const useLlm = hasLlmProvider();

    // 1. One safe RawDay per day: LLM when it produces a valid one, otherwise the built-in meal bank.
    const sources: DaySource[] = [];
    const rawDays = await mapWithConcurrency(
      Array.from({ length: PLAN_DAYS }, (_, i) => i),
      LLM_CONCURRENCY,
      async (i): Promise<RawDay | null> => {
        const llmDay = useLlm ? await generateLlmDay(profile, targets, i, deadline) : null;
        if (llmDay) {
          sources[i] = "ai";
          return llmDay;
        }
        sources[i] = "builtin";
        return buildFallbackDay(i, profile.dietType, profile.allergies);
      }
    );

    if (rawDays.some((d) => d === null)) {
      return NextResponse.json(
        {
          error:
            "We couldn't build a meal plan that avoids all of your listed allergies and still fits your diet. Try removing a restriction, or consult a dietitian.",
        },
        { status: 422 }
      );
    }
    const safeDays = rawDays as RawDay[];

    // 2. Defense in depth: nothing unsafe may leave this function, whatever happened above.
    for (const day of safeDays) {
      const violation = findDayViolation(day, profile.dietType, profile.allergies);
      if (violation) {
        console.error("[diet/plan] safety re-check failed:", violation);
        return NextResponse.json({ error: "Could not produce a safe meal plan. Please try again." }, { status: 500 });
      }
    }

    // 3. Nutrition + calorie fitting, computed in code.
    const planId = Date.now().toString(36);
    const days: DayPlan[] = await Promise.all(
      safeDays.map((day, i) =>
        buildDayForTarget(day, addDays(startDate, i), `${planId}_d${i}`, targets.calories)
      )
    );

    const aiDays = sources.filter((s) => s === "ai").length;
    const scales = days.map((d) => d.portionScale).filter((s): s is number => typeof s === "number");
    const notes = [
      `Target: ${targets.calories} kcal | Protein: ${targets.proteinG}g | Carbs: ${targets.carbsG}g | Fat: ${targets.fatG}g`,
      scales.length
        ? `Portions were scaled (×${Math.min(...scales).toFixed(2)}–×${Math.max(...scales).toFixed(2)}) so each day matches your calorie target.`
        : null,
    ]
      .filter(Boolean)
      .join(" • ");

    const weeklyPlan: WeeklyDietPlan = {
      id: `diet_${planId}`,
      createdAt: new Date().toISOString(),
      days,
      groceryList: buildGroceryList(days),
      source: aiDays === PLAN_DAYS ? "ai" : aiDays === 0 ? "builtin" : "mixed",
      notes,
    };

    return NextResponse.json({ plan: weeklyPlan, targets, groceryList: weeklyPlan.groceryList });
  } catch (err) {
    console.error("[api/diet/plan] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate diet plan. Please try again." },
      { status: 500 }
    );
  }
}
