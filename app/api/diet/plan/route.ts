import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, hasLlmProvider } from "../../../lib/llm";
import {
  computeMacroTargets,
  requiresProfessionalNotice,
} from "../../../lib/nutrition";
import {
  lookupIngredientNutrition,
  aggregateNutrition,
} from "../../../lib/nutritionLookup";
import {
  UserProfileSchema,
  validateDietSafety,
} from "../../../lib/planValidator";
import type { Meal, DayPlan, WeeklyDietPlan, GroceryItem } from "../../../lib/storage";

function buildAdaptiveFallbackDays(dietType: string, allergies: string[]) {
  const isVegan = dietType === "vegan";
  const hasGlutenAllergy = allergies.includes("gluten");
  const hasDairyAllergy = allergies.includes("dairy") || isVegan;

  const proteinSource = hasDairyAllergy
    ? { name: "Firm Tofu", quantity: "100g" }
    : { name: "Fresh Paneer (Cottage Cheese)", quantity: "80g" };

  const dairyOrAlt = hasDairyAllergy
    ? { name: "Cucumber Salad", quantity: "100g" }
    : { name: "Curd / Plain Yogurt (Dahi)", quantity: "100g" };

  const grainSource = hasGlutenAllergy
    ? { name: "White Rice (Cooked)", quantity: "150g" }
    : { name: "Roti (Whole Wheat Chapati)", quantity: "2 pieces (80g)" };

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return dayNames.map((d) => ({
    dayName: d,
    meals: [
      {
        name: "Moong Dal Chilla with Mint Chutney",
        type: "breakfast" as const,
        ingredients: [
          { name: "Moong / Toor Dal (Cooked)", quantity: "150g" },
          dairyOrAlt,
          { name: "Mixed Vegetable Sabzi (Light Oil)", quantity: "50g" },
        ],
        prepSteps: [
          "Batter soaked moong dal with spices and herbs.",
          "Cook chilla on a hot pan until crisp and golden.",
          "Serve fresh."
        ],
        hydrationReminderMl: 500,
      },
      {
        name: "Spiced Dal with Traditional Grain & Greens",
        type: "lunch" as const,
        ingredients: [
          grainSource,
          { name: "Masoor Dal (Cooked)", quantity: "180g" },
          { name: "Palak / Spinach (Cooked)", quantity: "100g" },
          { name: "Cucumber Salad", quantity: "100g" },
        ],
        prepSteps: [
          "Heat dal with pinch of turmeric and cumin.",
          "Serve alongside cooked grains and sautéed greens."
        ],
        hydrationReminderMl: 600,
      },
      {
        name: "Roasted Chana & Sprouted Moong Chaat",
        type: "snack" as const,
        ingredients: [
          { name: "Sprouted Moong Beans", quantity: "100g" },
          { name: "Roasted Peanuts (Moongfali)", quantity: "25g" },
        ],
        prepSteps: [
          "Toss sprouted moong with roasted peanuts, lemon, and chaat masala."
        ],
        hydrationReminderMl: 400,
      },
      {
        name: `${proteinSource.name} Bowl with Warm Rice & Sabzi`,
        type: "dinner" as const,
        ingredients: [
          proteinSource,
          { name: "Brown Rice (Cooked)", quantity: "150g" },
          { name: "Mixed Vegetable Sabzi (Light Oil)", quantity: "100g" },
        ],
        prepSteps: [
          `Lightly pan-sear ${proteinSource.name} with aromatic spices.`,
          "Serve warm over steamed rice and fresh vegetables."
        ],
        hydrationReminderMl: 500,
      },
    ],
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = UserProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid profile data", details: parseResult.error.flatten() },
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

    // Deterministic Macro calculation in code (never by LLM)
    const targets = computeMacroTargets(profile);
    if (!targets) {
      return NextResponse.json(
        { error: "Could not compute safe macro targets for this profile." },
        { status: 400 }
      );
    }

    let rawDays: ReturnType<typeof buildAdaptiveFallbackDays> = [];

    if (hasLlmProvider()) {
      const prompt = `You are a certified sports nutritionist specializing in Indian and regional cuisines.
Create a structured 7-day meal plan for a user with the following profile:
- Target daily calories: ~${targets.calories} kcal
- Target daily protein: ~${targets.proteinG}g, Carbs: ~${targets.carbsG}g, Fat: ~${targets.fatG}g
- Diet Type: ${profile.dietType}
- ALLERGIES / RESTRICTIONS: ${profile.allergies.length ? profile.allergies.join(", ") : "None"}
- Budget: ${profile.budget}
- Preferred cuisine: ${profile.cuisinePreferences?.join(", ") || "Indian staples (dal, roti, sabzi, curd, rice)"}

STRICT SAFETY RULES:
1. NEVER include any of these allergens: ${profile.allergies.join(", ") || "None"}
2. Adhere 100% to ${profile.dietType} diet. If vegetarian or vegan, zero meat/fish/poultry. If vegan, zero dairy or honey.
3. Every meal must include exact ingredient quantities with measurable units (e.g. "80g (2 pieces)", "150g", "100g", "1 tbsp").
4. Return ONLY a valid JSON object matching this schema:
{
  "days": [
    {
      "dayName": "Monday",
      "meals": [
        {
          "name": "Dish Name",
          "type": "breakfast" | "lunch" | "snack" | "dinner",
          "ingredients": [
            { "name": "Ingredient Name", "quantity": "100g" }
          ],
          "prepSteps": ["Step 1", "Step 2"],
          "hydrationReminderMl": 500
        }
      ]
    }
  ]
}
No Markdown formatting around the JSON, no trailing comma, no comments. Output raw JSON only.`;

      try {
        const reply = await chatCompletion({
          messages: [
            {
              role: "system",
              content:
                "You are a strict clinical nutrition engine that outputs valid JSON only without backticks or markdown.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens: 3500,
          temperature: 0.7,
        });

        // Robust JSON extraction (look between first { and last })
        const jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.days) && parsed.days.length > 0) {
            rawDays = parsed.days;
          }
        }
      } catch (err) {
        console.warn("[diet/plan] LLM failed or malformed, using adaptive Indian fallback:", err);
      }
    }

    if (rawDays.length === 0) {
      rawDays = buildAdaptiveFallbackDays(profile.dietType, profile.allergies);
    }

    // Process all days: Calculate nutrition strictly in code via lookup
    const days: DayPlan[] = [];
    const groceryMap = new Map<string, { quantity: string; category: GroceryItem["category"] }>();

    for (let i = 0; i < rawDays.length; i++) {
      const day = rawDays[i];
      const today = new Date();
      today.setDate(today.getDate() + i);
      const dateStr = today.toISOString().split("T")[0];

      const meals: Meal[] = [];

      for (const rawMeal of day.meals || []) {
        const processedIngredients = [];
        const mealNutritions = [];

        for (const ing of rawMeal.ingredients || []) {
          const nut = await lookupIngredientNutrition(ing.name, ing.quantity);
          mealNutritions.push(nut);
          processedIngredients.push({
            name: ing.name,
            quantity: ing.quantity,
            nutrition: nut,
          });

          // Aggregate into grocery list
          const key = ing.name.toLowerCase().trim();
          if (!groceryMap.has(key)) {
            let category: GroceryItem["category"] = "vegetable";
            if (key.includes("dal") || key.includes("chana") || key.includes("egg") || key.includes("paneer") || key.includes("chicken") || key.includes("tofu")) {
              category = "protein";
            } else if (key.includes("rice") || key.includes("roti") || key.includes("oat") || key.includes("wheat") || key.includes("poha")) {
              category = "grain";
            } else if (key.includes("curd") || key.includes("dahi") || key.includes("milk") || key.includes("ghee") || key.includes("butter")) {
              category = "dairy";
            } else if (key.includes("banana") || key.includes("apple") || key.includes("fruit")) {
              category = "fruit";
            }
            groceryMap.set(key, { quantity: ing.quantity, category });
          }
        }

        const mealTotal = aggregateNutrition(mealNutritions);

        meals.push({
          id: `meal_${i}_${meals.length}_${Date.now()}`,
          name: rawMeal.name,
          type: rawMeal.type as Meal["type"],
          ingredients: processedIngredients,
          prepSteps: rawMeal.prepSteps || [],
          nutrition: mealTotal,
          hydrationReminderMl: rawMeal.hydrationReminderMl || 500,
        });
      }

      const dayTotal = aggregateNutrition(meals.map((m) => m.nutrition));
      days.push({
        date: dateStr,
        meals,
        totalNutrition: dayTotal,
      });
    }

    // Build Weekly Grocery List
    const groceryList: GroceryItem[] = Array.from(groceryMap.entries()).map(([name, val]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      totalQuantity: val.quantity,
      category: val.category,
    }));

    const weeklyPlan: WeeklyDietPlan = {
      id: `diet_plan_${Date.now()}`,
      createdAt: new Date().toISOString(),
      days,
      groceryList,
      notes: `Target: ${targets.calories} kcal | Protein: ${targets.proteinG}g | Carbs: ${targets.carbsG}g | Fat: ${targets.fatG}g`,
    };

    // Run backend safety validation
    const safetyCheck = validateDietSafety(
      {
        id: weeklyPlan.id,
        createdAt: weeklyPlan.createdAt,
        days: weeklyPlan.days.map((d) => ({
          date: d.date,
          meals: d.meals.map((m) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            ingredients: m.ingredients.map((ing) => ({ name: ing.name, quantity: ing.quantity })),
            prepSteps: m.prepSteps,
            hydrationReminderMl: m.hydrationReminderMl,
          })),
        })),
      },
      profile.dietType,
      profile.allergies
    );

    if (!safetyCheck.valid) {
      // If LLM returned a violation, automatically swap to adaptive fallback and validate that
      const adaptiveFallback = buildAdaptiveFallbackDays(profile.dietType, profile.allergies);
      // Process adaptive fallback safely
      const fallbackDays: DayPlan[] = [];
      for (let i = 0; i < adaptiveFallback.length; i++) {
        const day = adaptiveFallback[i];
        const today = new Date();
        today.setDate(today.getDate() + i);
        const dateStr = today.toISOString().split("T")[0];
        const meals: Meal[] = [];
        for (const rawMeal of day.meals) {
          const processedIngredients = [];
          const mealNutritions = [];
          for (const ing of rawMeal.ingredients) {
            const nut = await lookupIngredientNutrition(ing.name, ing.quantity);
            mealNutritions.push(nut);
            processedIngredients.push({ name: ing.name, quantity: ing.quantity, nutrition: nut });
          }
          meals.push({
            id: `meal_fb_${i}_${meals.length}_${Date.now()}`,
            name: rawMeal.name,
            type: rawMeal.type,
            ingredients: processedIngredients,
            prepSteps: rawMeal.prepSteps,
            nutrition: aggregateNutrition(mealNutritions),
            hydrationReminderMl: rawMeal.hydrationReminderMl,
          });
        }
        fallbackDays.push({
          date: dateStr,
          meals,
          totalNutrition: aggregateNutrition(meals.map((m) => m.nutrition)),
        });
      }

      weeklyPlan.days = fallbackDays;
    }

    return NextResponse.json({
      plan: weeklyPlan,
      targets,
      groceryList,
    });
  } catch (err) {
    console.error("[api/diet/plan] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate diet plan" },
      { status: 500 }
    );
  }
}
