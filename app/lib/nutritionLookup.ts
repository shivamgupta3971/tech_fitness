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

/** Names of every verified food, so prompts can steer the LLM towards ingredients we can look up exactly. */
export const VERIFIED_FOOD_NAMES: string[] = FOOD_DATABASE.map((f) => f.name);

// ─── Quantity parsing ─────────────────────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": " 1/2",
  "¼": " 1/4",
  "¾": " 3/4",
  "⅓": " 1/3",
  "⅔": " 2/3",
};

/** A number: "1 1/2", "1/2", "2.5" or "2". */
const NUM = String.raw`(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;

/** Parses "1 1/2", "1/2" or "2.5" into a number. */
export function toNumber(raw: string): number {
  const parts = raw.trim().split(/\s+/);
  let total = 0;
  for (const part of parts) {
    if (part.includes("/")) {
      const [n, d] = part.split("/").map(Number);
      total += d ? n / d : 0;
    } else {
      total += parseFloat(part);
    }
  }
  return total;
}

/** Typical weight of one piece, matched against the quantity text and the ingredient name. */
const PIECE_WEIGHTS: [RegExp, number][] = [
  [/roti|chapati|chapatti|phulka/, 40],
  [/paratha/, 80],
  [/\begg|\banda\b/, 50],
  [/idli/, 60],
  [/dosa/, 80],
  [/banana|kela/, 120],
  [/\bapples?\b|\bseb\b/, 150],
  [/orange|mosambi/, 130],
  [/almond|badam/, 1.2],
  [/cashew|kaju/, 1.5],
  [/walnut|akhrot/, 4],
  [/peanut|moongfali/, 0.6],
  [/\bdates?\b|khajur/, 8],
  [/chilli|chili|mirch/, 5],
  [/garlic|lehsun/, 4],
  [/onion|pyaaz/, 110],
  [/tomato|tamatar/, 100],
  [/lemon|nimbu/, 50],
];

/** A single ingredient above this is almost certainly a mis-parse (e.g. "10 almonds" read as 1000 g). */
const MAX_REASONABLE_GRAMS = 2000;

/**
 * Extracts estimated weight in grams from typical ingredient quantity strings.
 * e.g., "2 rotis (80g)" -> 80      (an explicit weight always wins)
 *       "150g cooked rice" -> 150
 *       "1/2 cup curd" -> 75
 *       "2 boiled eggs" -> 100
 *       "10 almonds" -> 12
 *       "1 tbsp ghee" -> 15
 */
export function parseQuantityInGrams(quantityStr: string, foodNameHint?: string): number {
  if (!quantityStr) return 100;

  let str = quantityStr.toLowerCase().trim();
  for (const [glyph, replacement] of Object.entries(UNICODE_FRACTIONS)) {
    str = str.split(glyph).join(replacement);
  }
  str = str.trim();

  const unit = (units: string) => str.match(new RegExp(`${NUM}\\s*(?:${units})\\b`));
  const clamp = (g: number) => Math.min(Math.max(g, 1), MAX_REASONABLE_GRAMS);

  // Explicit weights / volumes first
  const kg = unit("kg|kgs|kilograms?");
  if (kg) return clamp(toNumber(kg[1]) * 1000);
  const g = unit("g|gm|gms|grams?");
  if (g) return clamp(toNumber(g[1]));
  const ml = unit("ml|milliliters?|millilitres?");
  if (ml) return clamp(toNumber(ml[1])); // ~1 ml ≈ 1 g
  const litre = unit("l|litres?|liters?");
  if (litre) return clamp(toNumber(litre[1]) * 1000);
  const oz = unit("oz|ounces?");
  if (oz) return clamp(toNumber(oz[1]) * 28.35);

  // Household measures
  const tbsp = unit("tbsp|tbs|tablespoons?");
  if (tbsp) return clamp(toNumber(tbsp[1]) * 15);
  const tsp = unit("tsp|teaspoons?");
  if (tsp) return clamp(toNumber(tsp[1]) * 5);
  const glass = unit("glass|glasses");
  if (glass) return clamp(toNumber(glass[1]) * 200);
  // Indian katori / bowl / cup ≈ 150 g
  const cup = unit("cups?|katoris?|bowls?");
  if (cup) return clamp(toNumber(cup[1]) * 150);
  const handful = unit("handfuls?");
  if (handful) return clamp(toNumber(handful[1]) * 30);

  // Piece counts: "2 rotis", "3 boiled eggs", "10 almonds"
  const pieces = str.match(new RegExp(`^${NUM}\\s*(?:x\\s*)?(?:pieces?|slices?|pcs?|nos?)?`));
  if (pieces) {
    const count = toNumber(pieces[1]);
    const hint = `${foodNameHint ?? ""} ${str}`.toLowerCase();
    for (const [pattern, weight] of PIECE_WEIGHTS) {
      if (pattern.test(hint)) return clamp(count * weight);
    }
    return clamp(count * 100);
  }

  return 100;
}

// ─── Local database search ────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** True when `phrase` occurs in `text` on word boundaries. */
function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z])${escaped}(?:e?s)?(?![a-z])`).test(text);
}

/**
 * Searches the local Indian food database. Exact name/alias wins; otherwise the *longest* alias found in the
 * query wins, so "boiled egg whites" resolves to egg white (alias "egg whites"), not whole egg (alias "egg").
 */
function searchLocalDatabase(query: string): FoodItem | null {
  const q = normalize(query);
  if (!q) return null;

  for (const item of FOOD_DATABASE) {
    if (normalize(item.name) === q) return item;
    if (item.aliases.some((a) => normalize(a) === q)) return item;
  }

  let best: { item: FoodItem; score: number } | null = null;
  for (const item of FOOD_DATABASE) {
    const candidates = [item.name, ...item.aliases].map(normalize);
    for (const c of candidates) {
      let score = 0;
      if (containsPhrase(q, c)) score = c.length;
      else if (q.length >= 4 && containsPhrase(c, q)) score = q.length * 0.5; // query is a fragment of a known name
      if (score > (best?.score ?? 0)) best = { item, score };
    }
  }
  return best?.item ?? null;
}

// ─── USDA fallback ────────────────────────────────────────────────────────────

const usdaCache = new Map<string, Promise<FoodItem | null>>();

/**
 * Queries USDA FoodData Central API if USDA_API_KEY is present in environment.
 * Results (including misses) are cached per process so repeated ingredients cost one request.
 */
function queryUsdaFoodData(query: string): Promise<FoodItem | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  const key = normalize(query);
  const cached = usdaCache.get(key);
  if (cached) return cached;

  const request = (async (): Promise<FoodItem | null> => {
    try {
      const endpoint = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(
        query
      )}&pageSize=1`;

      const res = await fetch(endpoint, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
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
        aliases: [key],
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
      // Do not log the request URL: it carries the API key.
      console.warn("[USDA API] Lookup failed:", err instanceof Error ? err.message : err);
      return null;
    }
  })();

  usdaCache.set(key, request);
  return request;
}

// ─── Public API ───────────────────────────────────────────────────────────────

function scaleFood(per100g: FoodItem["per100g"], grams: number, verified: boolean): NutritionInfo {
  const scale = grams / 100;
  return {
    calories: Math.round(per100g.calories * scale),
    proteinG: Math.round(per100g.protein * scale * 10) / 10,
    carbsG: Math.round(per100g.carbs * scale * 10) / 10,
    fatG: Math.round(per100g.fat * scale * 10) / 10,
    verified,
  };
}

/** Rough per-100 g profile of a mixed Indian dish, used (and flagged unverified) when nothing matches. */
const GENERIC_PER_100G: FoodItem["per100g"] = { calories: 130, protein: 3, carbs: 20, fat: 4, fiber: 2 };

/**
 * Resolve nutrition information for an ingredient and its declared quantity.
 */
export async function lookupIngredientNutrition(
  ingredientName: string,
  quantityStr: string
): Promise<NutritionInfo> {
  const grams = parseQuantityInGrams(quantityStr, ingredientName);

  const local = searchLocalDatabase(ingredientName);
  if (local) return scaleFood(local.per100g, grams, true);

  const usda = await queryUsdaFoodData(ingredientName);
  if (usda) return scaleFood(usda.per100g, grams, true);

  return scaleFood(GENERIC_PER_100G, grams, false);
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
