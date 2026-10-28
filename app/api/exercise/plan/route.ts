import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";
import {
  ExercisePreferencesSchema,
  GeneratedWeeklyExercisePlanSchema,
} from "../../../lib/planValidator";
import {
  EXERCISE_CATALOG,
  CATALOG_ID_MAP,
  filterEligibleExercises,
} from "../../../data/exercises";
import type {
  WeeklyExercisePlan,
  WorkoutSession,
  PlannedExercise,
} from "../../../lib/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ExercisePreferencesSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid exercise preferences", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const prefs = parseResult.data;

    // Filter eligible catalog exercises
    const eligibleExercises = filterEligibleExercises(prefs.equipment, prefs.avoidList);
    if (eligibleExercises.length === 0) {
      return NextResponse.json(
        { error: "No eligible exercises found for the selected equipment and avoid list." },
        { status: 400 }
      );
    }

    const eligibleCatalogSummary = eligibleExercises.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      trackable: e.trackable,
      trackingMode: e.trackingMode,
      difficulty: e.difficulty,
    }));

    let rawDays: {
      title: string;
      type: "workout" | "rest" | "active_recovery";
      warmupCatalogIds: string[];
      mainCatalogIds: { id: string; sets?: number; reps?: string; durationSeconds?: number }[];
      cooldownCatalogIds: string[];
    }[] = [];

    if (hasLlmProvider()) {
      const prompt = `You are a certified strength and conditioning coach.
Design a balanced 7-day training schedule for a user with these parameters:
- Goal: ${prefs.goal}
- Experience: ${prefs.experienceLevel}
- Available workout days: ${prefs.availableDaysPerWeek} of 7 days (mark remaining as "rest" or "active_recovery")
- Session duration: ${prefs.sessionDurationMinutes} minutes
- Equipment available: ${prefs.equipment.join(", ")}
- Location: ${prefs.location}
- Preferred activities: ${prefs.preferredActivities.join(", ") || "General training, gym, dance"}
- Limitations: ${prefs.limitations.join(", ") || "None"}

CRITICAL RULE: YOU MUST ONLY USE EXERCISE IDs FROM THIS ELIGIBLE CATALOG LIST:
${JSON.stringify(eligibleCatalogSummary)}

Output a valid JSON object matching:
{
  "days": [
    {
      "title": "Full Body Strength" | "Dance Cardio & Agility" | "Active Recovery & Mobility" | "Rest Day",
      "type": "workout" | "rest" | "active_recovery",
      "warmupCatalogIds": ["ex_jumping_jacks", "ex_cat_cow"],
      "mainCatalogIds": [
        { "id": "ex_squat", "sets": 3, "reps": "10-12" },
        { "id": "ex_plank", "durationSeconds": 45 }
      ],
      "cooldownCatalogIds": ["ex_childs_pose"]
    }
  ]
}
Include exactly 7 days. If a day is "rest", mainCatalogIds can be empty.
Return ONLY raw JSON without markdown or backticks.`;

      try {
        const reply = await chatCompletion({
          messages: [
            {
              role: "system",
              content:
                "You are an elite exercise science coordinator that outputs valid JSON only without markdown or code fences.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens: 3000,
          temperature: 0.6,
        });

        const cleaned = reply.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.days) && parsed.days.length === 7) {
          rawDays = parsed.days;
        }
      } catch (err) {
        console.warn("[api/exercise/plan] LLM failed, using deterministic template:", err);
      }
    }

    // Deterministic fallback template if LLM is unavailable or malformed
    if (rawDays.length === 0) {
      const workoutDaysCount = Math.min(prefs.availableDaysPerWeek, 7);
      const dayTitles = [
        "Full Body Strength & Arena Tracking",
        "Cardio Dance & Mobility",
        "Active Recovery & Core",
        "Lower Body Power",
        "Upper Body Push & Form",
        "Weekend Dance Jam",
        "Rest & Regeneration",
      ];

      rawDays = dayTitles.map((title, idx) => {
        const isWorkout = idx < workoutDaysCount;
        return {
          title: isWorkout ? title : "Rest & Regeneration Day",
          type: isWorkout ? ("workout" as const) : ("rest" as const),
          warmupCatalogIds: isWorkout ? ["ex_cat_cow", "ex_jumping_jacks"] : ["ex_cat_cow"],
          mainCatalogIds: isWorkout
            ? [
                { id: "ex_squat", sets: 3, reps: "10-12" },
                { id: "ex_pushup", sets: 3, reps: "8-10" },
                { id: "ex_plank", durationSeconds: 45 },
              ]
            : [],
          cooldownCatalogIds: ["ex_childs_pose", "ex_downward_dog"],
        };
      });
    }

    // Hydrate catalog data into PlannedExercise records
    const today = new Date();
    const days: WorkoutSession[] = [];

    for (let i = 0; i < rawDays.length; i++) {
      const raw = rawDays[i];
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      const hydrateExercise = (item: {
        id: string;
        sets?: number;
        reps?: string;
        durationSeconds?: number;
      }): PlannedExercise | null => {
        const catalogItem = CATALOG_ID_MAP.get(item.id);
        if (!catalogItem) {
          // Replace with first eligible exercise if hallucinated
          const fallback = eligibleExercises[0];
          if (!fallback) return null;
          return {
            id: `ex_${i}_${Math.random().toString(36).substring(2, 7)}`,
            catalogId: fallback.id,
            name: fallback.name,
            description: fallback.description,
            targetMuscles: fallback.targetMuscles,
            sets: item.sets || 3,
            reps: item.reps || "10-12",
            durationSeconds: item.durationSeconds,
            equipment: fallback.equipment,
            difficulty: fallback.difficulty,
            beginnerAlternative: fallback.beginnerAlternative,
            instructions: fallback.instructions,
            trackable: fallback.trackable,
            trackingMode: fallback.trackingMode,
            status: "pending",
          };
        }

        return {
          id: `ex_${i}_${Math.random().toString(36).substring(2, 7)}`,
          catalogId: catalogItem.id,
          name: catalogItem.name,
          description: catalogItem.description,
          targetMuscles: catalogItem.targetMuscles,
          sets: item.sets || (catalogItem.category === "core" ? undefined : 3),
          reps: item.reps || (catalogItem.category === "core" ? undefined : "10-12"),
          durationSeconds:
            item.durationSeconds || (catalogItem.category === "core" || catalogItem.category === "mobility" ? 45 : undefined),
          equipment: catalogItem.equipment,
          difficulty: catalogItem.difficulty,
          beginnerAlternative: catalogItem.beginnerAlternative,
          instructions: catalogItem.instructions,
          trackable: catalogItem.trackable,
          trackingMode: catalogItem.trackingMode,
          status: "pending",
        };
      };

      const warmup: PlannedExercise[] = (raw.warmupCatalogIds || [])
        .map((id) => hydrateExercise({ id }))
        .filter((e): e is PlannedExercise => e !== null);

      const main: PlannedExercise[] = (raw.mainCatalogIds || [])
        .map((item) => hydrateExercise(item))
        .filter((e): e is PlannedExercise => e !== null);

      const cooldown: PlannedExercise[] = (raw.cooldownCatalogIds || [])
        .map((id) => hydrateExercise({ id }))
        .filter((e): e is PlannedExercise => e !== null);

      days.push({
        id: `session_${i}_${Date.now()}`,
        plannedDate: dateStr,
        title: raw.title,
        type: raw.type,
        warmup,
        main,
        cooldown,
        status: "pending",
      });
    }

    const weeklyPlan: WeeklyExercisePlan = {
      id: `ex_plan_${Date.now()}`,
      createdAt: new Date().toISOString(),
      weekStartDate: days[0]?.plannedDate || new Date().toISOString().split("T")[0],
      days,
      notes: `Focus: ${prefs.goal.replace("_", " ")} | ${prefs.experienceLevel} level | ${prefs.sessionDurationMinutes}m sessions`,
    };

    return NextResponse.json({ plan: weeklyPlan });
  } catch (err) {
    console.error("[api/exercise/plan] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate exercise plan" },
      { status: 500 }
    );
  }
}
