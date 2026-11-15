import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";
import { parseLooseJson } from "../../../lib/json";
import { ExercisePreferencesSchema, LlmExercisePlanSchema } from "../../../lib/planValidator";
import type { LlmExerciseDay, ValidatedExercisePreferences } from "../../../lib/planValidator";
import {
  buildWeek,
  eligibleCatalogForPrompt,
  hasEligibleExercises,
} from "../../../lib/exercisePlanner";
import { isValidDateString, toLocalDateString } from "../../../lib/dates";
import type { WeeklyExercisePlan } from "../../../lib/storage";

function buildPrompt(prefs: ValidatedExercisePreferences): string {
  return `You are a certified strength and conditioning coach.
Design a balanced 7-day training schedule for a user with these parameters:
- Goal: ${prefs.goal}
- Experience: ${prefs.experienceLevel}
- Training days: EXACTLY ${prefs.availableDaysPerWeek} of the 7 days must have type "workout". Make the others "active_recovery" or "rest", and avoid back-to-back hard days when possible.
- Session duration: ${prefs.sessionDurationMinutes} minutes (about ${Math.min(7, Math.max(3, Math.round((prefs.sessionDurationMinutes - 10) / 7)))} main exercises)
- Equipment available: ${prefs.equipment.join(", ")}
- Location: ${prefs.location}
- Limitations (must respect): ${prefs.limitations.join(", ") || "None"}

CRITICAL RULE: use ONLY exercise ids from this list, exactly as written:
${JSON.stringify(eligibleCatalogForPrompt(prefs))}

Output a JSON object of this shape with exactly 7 days:
{"days":[{"title":"Lower Body Power","type":"workout","warmupCatalogIds":["ex_arm_circles"],"mainCatalogIds":[{"id":"ex_squat","sets":3,"reps":"10-12"},{"id":"ex_plank","sets":3,"durationSeconds":40}],"cooldownCatalogIds":["ex_childs_pose"]}]}
Rest days have empty lists. Use "durationSeconds" for exercises marked timed.`;
}

async function suggestWeekWithLlm(prefs: ValidatedExercisePreferences): Promise<LlmExerciseDay[] | null> {
  if (!hasLlmProvider()) return null;
  try {
    const reply = await chatCompletion({
      messages: [
        { role: "system", content: "You are an exercise science coordinator. Reply with one valid JSON object and nothing else." },
        { role: "user", content: buildPrompt(prefs) },
      ],
      maxTokens: 3000,
      temperature: 0.6,
      json: true,
    });
    const parsed = LlmExercisePlanSchema.safeParse(parseLooseJson(reply));
    if (!parsed.success) {
      console.warn("[api/exercise/plan] LLM reply unusable:", parsed.error.issues[0]?.message ?? "bad shape");
      return null;
    }
    return parsed.data.days;
  } catch (err) {
    console.warn("[api/exercise/plan] LLM unavailable, building the plan deterministically:", err instanceof Error ? err.message : err);
    return null;
  }
}

function describeValidationError(error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }): string {
  const fields = Object.entries(error.flatten().fieldErrors)
    .map(([field, messages]) => `${field}: ${messages?.[0] ?? "invalid"}`)
    .slice(0, 3);
  return fields.length ? `Please check your preferences — ${fields.join("; ")}` : "Invalid exercise preferences";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parseResult = ExercisePreferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: describeValidationError(parseResult.error), details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const prefs = parseResult.data;

    if (!hasEligibleExercises(prefs)) {
      return NextResponse.json(
        {
          error:
            "No exercises match your equipment, limitations and avoid list. Try selecting more equipment or removing a restriction.",
        },
        { status: 400 }
      );
    }

    const startDate = isValidDateString(prefs.startDate) ? prefs.startDate : toLocalDateString();
    const planId = Date.now().toString(36);
    const llmDays = await suggestWeekWithLlm(prefs);

    const days = buildWeek({ prefs, startDate, planId, llmDays });

    const weeklyPlan: WeeklyExercisePlan = {
      id: `ex_plan_${planId}`,
      createdAt: new Date().toISOString(),
      weekStartDate: startDate,
      days,
      notes: `Focus: ${prefs.goal.replace(/_/g, " ")} | ${prefs.experienceLevel} level | ${prefs.sessionDurationMinutes}m sessions | ${llmDays ? "AI-assisted" : "Built-in"} plan`,
    };

    return NextResponse.json({ plan: weeklyPlan });
  } catch (err) {
    console.error("[api/exercise/plan] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate exercise plan. Please try again." },
      { status: 500 }
    );
  }
}
