/**
 * Nutrition lookup engine:
 * 1. Checks local verified curated Indian foods (`nutrition.json`)
 * 2. If not found and USDA_API_KEY is configured, queries USDA FoodData Central API
 * 3. Fallback to smart heuristic if unmatched (flagged verified: false)
 *
 * Computes calories and macros strictly in code, never delegating arithmetic to LLM.
 */

import localNutrition from "../data/nutrition.json";
import type { NutritionInfo } from "./storage";

interface FoodItem {
  id: string;
  name: string;
  aliases: string[];
  servingSizeG: number;
  per100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
}

const FOOD_DATABASE: FoodItem[] = localNutrition as FoodItem[];

/**
 * Extracts estimated weight in grams from typical ingredient quantity strings.
 * e.g., "2 rotis (80g)" -> 80
 *       "150g cooked rice" -> 150
 *       "1 cup curd" -> 150
 *       "2 boiled eggs" -> 100
 *       "1 tbsp ghee" -> 10
 */
export function parseQuantityInGrams(quantityStr: string, foodNameHint?: string): number {
  if (!quantityStr) return 100;
  const str = quantityStr.toLowerCase().trim();

  // Explicit grams
  const gMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|grams)/);
  if (gMatch) return parseFloat(gMatch[1]);

  // Milliliters (roughly 1ml ~ 1g)
  const mlMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliters)/);
  if (mlMatch) return parseFloat(mlMatch[1]);

  // Tablespoon / Teaspoon
  const tbspMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:tbsp|tablespoon)/);
  if (tbspMatch) return parseFloat(tbspMatch[1]) * 15;
  const tspMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:tsp|teaspoon)/);
  if (tspMatch) return parseFloat(tspMatch[1]) * 5;

  // Cup (Indian katori ~ 150g)
  const cupMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:cup|katori|bowl)/);
  if (cupMatch) return parseFloat(cupMatch[1]) * 150;

  // Pieces / count matching
  const pieceMatch = str.match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:piece|pieces|slice|slices|pc|pcs)?/);
  if (pieceMatch) {
    const count = parseFloat(pieceMatch[1]);
    const lowerHint = (foodNameHint || str).toLowerCase();
    if (lowerHint.includes("roti") || lowerHint.includes("chapati")) return count * 40;
    if (lowerHint.includes("egg") || lowerHint.includes("anda")) return count * 50;
    if (lowerHint.includes("idli")) return count * 60;
    if (lowerHint.includes("dosa")) return count * 80;
    if (lowerHint.includes("banana") || lowerHint.includes("kela")) return count * 120;
    if (lowerHint.includes("apple") || lowerHint.includes("seb")) return count * 150;
    return count * 100;
  }

  return 100;
}

/**
 * Searches local Indian Food Database by string matching.
 */
function searchLocalDatabase(query: string): FoodItem | null {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  // 1. Direct alias match
  for (const item of FOOD_DATABASE) {
    if (item.name.toLowerCase() === q) return item;
    if (item.aliases.some((a) => a === q)) return item;
  }

  // 2. Substring match
  for (const item of FOOD_DATABASE) {
    if (item.aliases.some((a) => q.includes(a) || a.includes(q))) return item;
    if (q.includes(item.name.toLowerCase())) return item;
  }

  return null;
}

/**
 * Queries USDA FoodData Central API if USDA_API_KEY is present in environment.
 */
async function queryUsdaFoodData(query: string): Promise<FoodItem | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  try {
    const endpoint = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(
      query
    )}&pageSize=1`;

    const res = await fetch(endpoint, { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const data = await res.json();
    const food = data.foods?.[0];
    if (!food) return null;

    let cal = 0, p = 0, c = 0, f = 0, fib = 0;
    for (const nutrient of food.foodNutrients || []) {
      const name = (nutrient.nutrientName || "").toLowerCase();
      const val = nutrient.value || 0;
      if (name.includes("energy") && (nutrient.unitName || "").toLowerCase() === "kcal") cal = val;
      else if (name.includes("protein")) p = val;
      else if (name.includes("carbohydrate")) c = val;
      else if (name.includes("total lipid") || name === "fat") f = val;
      else if (name.includes("fiber")) fib = val;
    }

    return {
      id: `usda_${food.fdcId}`,
      name: food.description,
      aliases: [query.toLowerCase()],
      servingSizeG: 100,
      per100g: {
        calories: Math.round(cal),
        protein: Math.round(p * 10) / 10,
        carbs: Math.round(c * 10) / 10,
        fat: Math.round(f * 10) / 10,
        fiber: Math.round(fib * 10) / 10,
      },
    };
  } catch (err) {
    console.warn("[USDA API] Failed query:", err);
    return null;
  }
}

/**
 * Resolve nutrition information for an ingredient and its declared quantity.
 */
export async function lookupIngredientNutrition(
  ingredientName: string,
  quantityStr: string
): Promise<NutritionInfo> {
  const grams = parseQuantityInGrams(quantityStr, ingredientName);

  // 1. Try local verified Indian database
  const local = searchLocalDatabase(ingredientName);
  if (local) {
    const scale = grams / 100;
    return {
      calories: Math.round(local.per100g.calories * scale),
      proteinG: Math.round(local.per100g.protein * scale * 10) / 10,
      carbsG: Math.round(local.per100g.carbs * scale * 10) / 10,
      fatG: Math.round(local.per100g.fat * scale * 10) / 10,
      verified: true,
    };
  }

  // 2. Try USDA API
  const usda = await queryUsdaFoodData(ingredientName);
  if (usda) {
    const scale = grams / 100;
    return {
      calories: Math.round(usda.per100g.calories * scale),
      proteinG: Math.round(usda.per100g.protein * scale * 10) / 10,
      carbsG: Math.round(usda.per100g.carbs * scale * 10) / 10,
      fatG: Math.round(usda.per100g.fat * scale * 10) / 10,
      verified: true,
    };
  }

  // 3. Fallback heuristic estimate for unrecognized items
  const scale = grams / 100;
  return {
    calories: Math.round(130 * scale),
    proteinG: Math.round(3.0 * scale * 10) / 10,
    carbsG: Math.round(20.0 * scale * 10) / 10,
    fatG: Math.round(4.0 * scale * 10) / 10,
    verified: false,
  };
}

/**
 * Sum a list of nutrition info objects into a single total.
 */
export function aggregateNutrition(list: NutritionInfo[]): NutritionInfo {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let verified = true;

  for (const n of list) {
    calories += n.calories;
    proteinG += n.proteinG;
    carbsG += n.carbsG;
    fatG += n.fatG;
    if (!n.verified) verified = false;
  }

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
    verified,
  };
}
