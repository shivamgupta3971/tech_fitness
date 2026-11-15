/**
 * Diet plan building blocks (pure except for nutrition lookups, so they are easy to unit test).
 *
 * The route handler asks an LLM for meal *ideas*; everything that has to be right is done here in code:
 *   - safety: every day is checked against the user's allergies and diet type, and replaced if it fails
 *   - nutrition: calories/macros come from the food database, never from the model
 *   - targets: each day's portions are scaled so the day actually lands on the calorie target
 *   - groceries: quantities are summed across the week
 *
 * The built-in meal bank is also the fallback when no LLM is configured or a model reply is unusable.
 */

import {
  findAllergenViolation,
  findDietTypeViolation,
} from "./nutrition";
import type { DietType } from "./nutrition";
import {
  aggregateNutrition,
  lookupIngredientNutrition,
  parseQuantityInGrams,
  toNumber,
} from "./nutritionLookup";
import type { DayPlan, GroceryItem, Meal } from "./storage";

export type MealType = Meal["type"];
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

export interface RawIngredient {
  name: string;
  quantity: string;
}

export interface RawMeal {
  name: string;
  type: MealType;
  ingredients: RawIngredient[];
  prepSteps: string[];
  hydrationReminderMl?: number;
}

export interface RawDay {
  meals: RawMeal[];
}

// ─── Safety ───────────────────────────────────────────────────────────────────

/** Returns a human-readable reason if the meal breaks the user's allergies or diet, otherwise null. */
export function findMealViolation(
  meal: RawMeal,
  dietType: DietType,
  allergies: string[]
): string | null {
  // The dish name is checked too: a model can write "Paneer Tikka" and forget paneer in the ingredient list.
  const texts = [meal.name, ...meal.ingredients.map((i) => i.name)];

  const allergen = findAllergenViolation(texts, allergies);
  if (allergen) return `"${meal.name}" contains ${allergen}`;

  const diet = findDietTypeViolation(texts, dietType);
  if (diet) return `"${meal.name}": ${diet}`;

  return null;
}

export function findDayViolation(
  day: RawDay,
  dietType: DietType,
  allergies: string[]
): string | null {
  for (const meal of day.meals) {
    const violation = findMealViolation(meal, dietType, allergies);
    if (violation) return violation;
  }
  return null;
}

/** True when a day has at least breakfast, lunch and dinner and each meal has ingredients. */
export function isCompleteDay(day: RawDay): boolean {
  const types = new Set(day.meals.map((m) => m.type));
  return (
    types.has("breakfast") &&
    types.has("lunch") &&
    types.has("dinner") &&
    day.meals.every((m) => m.ingredients.length > 0)
  );
}

// ─── Built-in meal bank ───────────────────────────────────────────────────────
//
// Ingredient names are the nutrition database's own names, so every value is "verified" and the names also
// carry their allergens (e.g. "…Veggies & Peanuts"), which the safety check picks up automatically.
// Safe-for-everyone options exist for every slot, so even vegan + gluten-free + nut-free + soy-free works.

function meal(
  type: MealType,
  name: string,
  ingredients: [string, string][],
  prepSteps: string[],
  hydrationReminderMl = 400
): RawMeal {
  return {
    type,
    name,
    ingredients: ingredients.map(([n, quantity]) => ({ name: n, quantity })),
    prepSteps,
    hydrationReminderMl,
  };
}

const KHICHDI = "Moong Dal Khichdi (Rice + Moong)";
const IDLI = "Steamed Idli";
const DOSA = "Plain Dosa";
const SAMBAR = "Vegetable Sambar";
const CUCUMBER = "Cucumber Salad";
const SABZI = "Mixed Vegetable Sabzi (Light Oil)";
const SPROUTS = "Sprouted Moong Beans";
const BANANA = "Fresh Banana";
const APPLE = "Apple";
const ROTI = "Roti (Whole Wheat Chapati)";
const WHITE_RICE = "White Rice (Cooked)";
const BROWN_RICE = "Brown Rice (Cooked)";
const TOOR_DAL = "Moong / Toor Dal (Cooked)";
const MASOOR = "Masoor Dal (Cooked)";
const CHANA = "Boiled Chana (Chickpeas / Kala Chana)";
const RAJMA = "Rajma (Kidney Beans Curry / Cooked)";
const PALAK = "Palak / Spinach (Cooked)";
const PANEER = "Fresh Paneer (Cottage Cheese)";
const CURD = "Curd / Plain Yogurt (Dahi)";
const EGG = "Whole Egg (Boiled)";
const CHICKEN = "Chicken Breast (Cooked / Grilled)";
const FISH = "Fish Curry (Rohu / Pomfret)";
const TOFU = "Firm Tofu";
const SOYA = "Soya Chunks / Mealmaker (Cooked)";
const OATS = "Rolled Oats (Cooked in water)";
const POHA = "Poha (Flattened Rice with Veggies & Peanuts)";
const UPMA = "Upma (Rava / Semolina Upma)";
const PEANUTS = "Roasted Peanuts (Moongfali)";
const ALMONDS = "Almonds (Badam)";

export const FALLBACK_MEALS: RawMeal[] = [
  // Breakfast
  meal("breakfast", "Moong Dal Khichdi with Cucumber Salad", [[KHICHDI, "250g"], [CUCUMBER, "100g"]], [
    "Pressure-cook rice and moong dal with turmeric and a pinch of salt until soft.",
    "Temper with cumin and serve warm with the cucumber salad.",
  ]),
  meal("breakfast", "Idli with Sambar", [[IDLI, "4 pieces (240g)"], [SAMBAR, "200g"]], [
    "Steam idli batter in moulds for 10–12 minutes.",
    "Serve hot with a bowl of sambar.",
  ]),
  meal("breakfast", "Plain Dosa with Sambar", [[DOSA, "2 pieces (160g)"], [SAMBAR, "200g"]], [
    "Spread fermented batter thinly on a hot tawa and cook until crisp.",
    "Serve with warm sambar.",
  ]),
  meal("breakfast", "Sprouts Chaat with Banana", [[SPROUTS, "150g"], [CUCUMBER, "50g"], [BANANA, "1 piece (120g)"]], [
    "Toss sprouts and chopped cucumber with lemon, cumin and chaat masala.",
    "Enjoy with a banana on the side.",
  ]),
  meal("breakfast", "Oats Porridge with Banana", [[OATS, "250g"], [BANANA, "1 piece (120g)"]], [
    "Cook rolled oats in water until creamy.",
    "Top with sliced banana and a pinch of cinnamon.",
  ]),
  meal("breakfast", "Vegetable Poha", [[POHA, "250g"], [CUCUMBER, "50g"]], [
    "Rinse poha and drain. Sauté mustard seeds, onion and vegetables, then fold in the poha.",
    "Finish with lemon juice and coriander.",
  ]),
  meal("breakfast", "Vegetable Upma", [[UPMA, "250g"], [CUCUMBER, "50g"]], [
    "Dry-roast semolina, then cook with sautéed onions, vegetables and hot water.",
    "Serve warm with lemon.",
  ]),
  meal("breakfast", "Paneer Bhurji with Roti", [[PANEER, "100g"], [ROTI, "2 pieces (80g)"], [SABZI, "50g"]], [
    "Crumble paneer and sauté with onion, tomato and turmeric.",
    "Serve with fresh rotis.",
  ]),
  meal("breakfast", "Egg Bhurji with Roti", [[EGG, "3 pieces (150g)"], [ROTI, "2 pieces (80g)"], [SABZI, "50g"]], [
    "Scramble eggs with onion, tomato and green chilli.",
    "Serve with warm rotis.",
  ]),

  // Lunch
  meal("lunch", "Dal, Rice & Palak", [[WHITE_RICE, "200g"], [MASOOR, "180g"], [PALAK, "100g"], [CUCUMBER, "100g"]], [
    "Simmer masoor dal with turmeric and cumin until soft.",
    "Serve over steamed rice with sautéed spinach and a cucumber salad.",
  ], 600),
  meal("lunch", "Rajma Chawal", [[RAJMA, "200g"], [WHITE_RICE, "200g"], [CUCUMBER, "100g"]], [
    "Slow-cook soaked rajma in an onion-tomato masala.",
    "Serve over steamed rice with salad.",
  ], 600),
  meal("lunch", "Chana Masala with Roti & Salad", [[CHANA, "200g"], [ROTI, "3 pieces (120g)"], [CUCUMBER, "100g"]], [
    "Simmer boiled chana in a spiced onion-tomato gravy.",
    "Serve with rotis and fresh salad.",
  ], 600),
  meal("lunch", "Khichdi with Sabzi", [[KHICHDI, "300g"], [SABZI, "100g"]], [
    "Cook rice and moong dal together with turmeric until soft and porridge-like.",
    "Serve with a dry vegetable sabzi.",
  ], 600),
  meal("lunch", "Sambar Rice", [[WHITE_RICE, "200g"], [SAMBAR, "250g"], [SABZI, "100g"]], [
    "Pressure-cook rice and serve with hot sambar.",
    "Add a side of seasonal vegetable sabzi.",
  ], 600),
  meal("lunch", "Soya Chunk Curry with Brown Rice", [[SOYA, "100g"], [BROWN_RICE, "200g"], [SABZI, "100g"]], [
    "Soak soya chunks, squeeze dry and simmer in an onion-tomato masala.",
    "Serve with brown rice and sabzi.",
  ], 600),
  meal("lunch", "Paneer Veggie Roti Plate", [[PANEER, "100g"], [ROTI, "3 pieces (120g)"], [SABZI, "100g"], [CURD, "100g"]], [
    "Cube paneer and sauté with capsicum and spices.",
    "Serve with rotis, sabzi and a bowl of curd.",
  ], 600),
  meal("lunch", "Chicken & Brown Rice Bowl", [[CHICKEN, "150g"], [BROWN_RICE, "200g"], [SABZI, "100g"]], [
    "Season chicken with turmeric, pepper and garlic, then grill or pan-sear until cooked through.",
    "Serve over brown rice with sautéed vegetables.",
  ], 600),
  meal("lunch", "Fish Curry with Rice", [[FISH, "150g"], [WHITE_RICE, "200g"], [CUCUMBER, "100g"]], [
    "Simmer fish gently in a tangy tomato masala until just cooked.",
    "Serve with steamed rice and cucumber salad.",
  ], 600),

  // Snack
  meal("snack", "Sprouted Moong Chaat", [[SPROUTS, "150g"], [CUCUMBER, "50g"]], [
    "Toss sprouts with chopped cucumber, lemon juice and chaat masala.",
  ]),
  meal("snack", "Boiled Chana Chaat", [[CHANA, "120g"], [CUCUMBER, "50g"]], [
    "Mix boiled chana with cucumber, lemon and a pinch of black salt.",
  ]),
  meal("snack", "Fresh Fruit Plate", [[APPLE, "1 piece (150g)"], [BANANA, "1 piece (120g)"]], [
    "Slice the fruit and serve fresh.",
  ]),
  meal("snack", "Banana & Roasted Peanuts", [[BANANA, "1 piece (120g)"], [PEANUTS, "25g"]], [
    "Pair a ripe banana with a small handful of roasted peanuts.",
  ]),
  meal("snack", "Apple with Almonds", [[APPLE, "1 piece (150g)"], [ALMONDS, "20g"]], [
    "Slice the apple and enjoy with soaked almonds.",
  ]),
  meal("snack", "Curd with Banana", [[CURD, "150g"], [BANANA, "1 piece (120g)"]], [
    "Whisk curd until smooth and top with sliced banana.",
  ]),
  meal("snack", "Boiled Egg Snack", [[EGG, "2 pieces (100g)"], [CUCUMBER, "50g"]], [
    "Boil eggs for 9 minutes, peel and season with pepper.",
  ]),

  // Dinner
  meal("dinner", "Masoor Dal with Rice & Cucumber", [[MASOOR, "200g"], [WHITE_RICE, "150g"], [CUCUMBER, "100g"]], [
    "Cook masoor dal with turmeric and a cumin tadka.",
    "Serve with steamed rice and cucumber salad.",
  ], 500),
  meal("dinner", "Rajma with Brown Rice", [[RAJMA, "200g"], [BROWN_RICE, "150g"], [SABZI, "100g"]], [
    "Simmer rajma in a light onion-tomato gravy.",
    "Serve with brown rice and sabzi.",
  ], 500),
  meal("dinner", "Idli Sambar Dinner", [[IDLI, "4 pieces (240g)"], [SAMBAR, "250g"]], [
    "Steam idlis and serve with generous hot sambar.",
  ], 500),
  meal("dinner", "Khichdi with Sabzi", [[KHICHDI, "300g"], [SABZI, "100g"]], [
    "Cook rice and moong dal until soft with turmeric.",
    "Serve warm with sabzi.",
  ], 500),
  meal("dinner", "Dal Tadka with Roti", [[TOOR_DAL, "200g"], [ROTI, "2 pieces (80g)"], [SABZI, "100g"]], [
    "Cook toor dal and finish with a cumin-garlic tadka.",
    "Serve with rotis and sabzi.",
  ], 500),
  meal("dinner", "Palak Paneer Bowl with Brown Rice", [[PANEER, "100g"], [PALAK, "150g"], [BROWN_RICE, "150g"]], [
    "Simmer paneer cubes in a pureed spinach gravy.",
    "Serve over brown rice.",
  ], 500),
  meal("dinner", "Tofu Stir-fry with Rice", [[TOFU, "120g"], [SABZI, "150g"], [BROWN_RICE, "150g"]], [
    "Pan-sear tofu until golden, then toss with vegetables and spices.",
    "Serve over brown rice.",
  ], 500),
  meal("dinner", "Grilled Chicken with Sabzi & Roti", [[CHICKEN, "150g"], [SABZI, "150g"], [ROTI, "2 pieces (80g)"]], [
    "Season chicken with spices and grill until cooked through.",
    "Serve with sabzi and rotis.",
  ], 500),
  meal("dinner", "Egg Curry with Rice", [[EGG, "2 pieces (100g)"], [WHITE_RICE, "150g"], [SABZI, "100g"]], [
    "Simmer boiled eggs in an onion-tomato masala.",
    "Serve over steamed rice with sabzi.",
  ], 500),
];

/** Fallback meals for one slot that pass the user's allergy and diet checks. */
export function safeFallbackMeals(type: MealType, dietType: DietType, allergies: string[]): RawMeal[] {
  return FALLBACK_MEALS.filter((m) => m.type === type && !findMealViolation(m, dietType, allergies));
}

/**
 * One safe, varied day from the built-in bank. Different days pick different dishes (rotating through the
 * safe options per slot). Returns null if some slot has no safe option at all (extremely restrictive profile).
 */
export function buildFallbackDay(
  dayIndex: number,
  dietType: DietType,
  allergies: string[]
): RawDay | null {
  const meals: RawMeal[] = [];
  for (let slot = 0; slot < MEAL_TYPES.length; slot++) {
    const safe = safeFallbackMeals(MEAL_TYPES[slot], dietType, allergies);
    if (safe.length === 0) return null;
    // Offset the slots so e.g. a repeating breakfast doesn't always land next to the same dinner.
    meals.push(structuredClone(safe[(dayIndex + slot * 2) % safe.length]));
  }
  return { meals };
}

// ─── Portion scaling ──────────────────────────────────────────────────────────

const QUANTITY_TOKEN =
  /(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(\s*(?:kgs?|kilograms?|gms?|grams?|g|ml|litres?|liters?|l)\b)?/gi;

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

/**
 * Multiplies every number in a quantity string ("2 pieces (80g)" ×1.5 → "3 pieces (120g)"), rounding weights
 * to 5 g and counts/spoons to halves so the result still reads like something a person would measure.
 */
export function scaleQuantityText(quantity: string, factor: number): string {
  return quantity.replace(QUANTITY_TOKEN, (_match, num: string, unit?: string) => {
    const value = toNumber(num) * factor;
    if (unit) {
      const big = /^\s*(kg|kilogram|l\b|litre|liter)/i.test(unit);
      const rounded = big ? Math.max(0.05, Math.round(value * 20) / 20) : Math.max(5, Math.round(value / 5) * 5);
      return `${trimNumber(rounded)}${unit}`;
    }
    return trimNumber(Math.max(0.5, Math.round(value * 2) / 2));
  });
}

export function scaleRawDay(day: RawDay, factor: number): RawDay {
  return {
    meals: day.meals.map((m) => ({
      ...m,
      ingredients: m.ingredients.map((i) => ({ name: i.name, quantity: scaleQuantityText(i.quantity, factor) })),
    })),
  };
}

/** Days within this of the calorie target are left alone. */
const CALORIE_TOLERANCE = 0.08;
/** Portions are never scaled beyond these bounds; a plan that far off should be flagged, not silently inflated. */
export const MIN_PORTION_SCALE = 0.6;
export const MAX_PORTION_SCALE = 1.8;

// ─── Hydration into stored plan types ─────────────────────────────────────────

/** Looks up nutrition for each ingredient (in parallel) and assembles a stored DayPlan. */
export async function hydrateDay(
  raw: RawDay,
  date: string,
  idPrefix: string,
  portionScale?: number
): Promise<DayPlan> {
  const ordered = [...raw.meals].sort(
    (a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type)
  );

  const meals: Meal[] = await Promise.all(
    ordered.map(async (m, index) => {
      const nutrition = await Promise.all(
        m.ingredients.map((i) => lookupIngredientNutrition(i.name, i.quantity))
      );
      return {
        id: `${idPrefix}_m${index}`,
        name: m.name,
        type: m.type,
        ingredients: m.ingredients.map((i, k) => ({
          name: i.name,
          quantity: i.quantity,
          nutrition: nutrition[k],
        })),
        prepSteps: m.prepSteps,
        nutrition: aggregateNutrition(nutrition),
        hydrationReminderMl: m.hydrationReminderMl,
      };
    })
  );

  return {
    date,
    meals,
    totalNutrition: aggregateNutrition(meals.map((m) => m.nutrition)),
    ...(portionScale ? { portionScale } : {}),
  };
}

/**
 * Hydrates a day and, if its calories are not within ~8% of the target, rescales the portions and hydrates again.
 * The scale applied is recorded on the day so the UI can say so.
 */
export async function buildDayForTarget(
  raw: RawDay,
  date: string,
  idPrefix: string,
  targetCalories: number
): Promise<DayPlan> {
  const base = await hydrateDay(raw, date, idPrefix);
  const total = base.totalNutrition.calories;
  if (total <= 0 || targetCalories <= 0) return base;

  const ratio = targetCalories / total;
  if (Math.abs(ratio - 1) <= CALORIE_TOLERANCE) return base;

  const factor = Math.min(MAX_PORTION_SCALE, Math.max(MIN_PORTION_SCALE, ratio));
  return hydrateDay(scaleRawDay(raw, factor), date, idPrefix, Math.round(factor * 100) / 100);
}

// ─── Grocery list ─────────────────────────────────────────────────────────────

// Order matters: the first rule that matches wins ("Peanut Butter" is a protein, not dairy).
const CATEGORY_RULES: [GroceryItem["category"], RegExp][] = [
  ["spice", /\b(turmeric|haldi|cumin|jeera|masala|chilli powder|coriander|dhania|ginger|garlic|spices?|black pepper|salt|mustard|hing|cardamom|cinnamon|cloves?)\b/],
  ["fruit", /\b(banana|kela|apples?|seb|mango|orange|papaya|guava|pomegranate|berry|berries|grapes?|melon|pear|kiwi|pineapple|lemon|fruit|dates?)\b/],
  ["grain", /\b(rice|roti|chapati|atta|wheat|oats?|poha|upma|suji|rava|idli|dosa|bread|khichdi|pasta|quinoa|millet|ragi|jowar|bajra|flour)\b/],
  ["protein", /\b(dal|lentils?|chana|chickpeas?|rajma|beans?|moong|eggs?|chicken|fish|mutton|prawns?|paneer|tofu|soya|soy|sprout\w*|whey|peanuts?|almonds?|nuts?|cashews?|walnuts?|chole)\b/],
  ["dairy", /\b(milk|curd|dahi|yogurt|yoghurt|ghee|butter|cheese|buttermilk|chaas|lassi|cream)\b/],
  ["vegetable", /\b(palak|spinach|sabzi|subzi|vegetables?|veg|veggies|cucumber|kheera|tomato|onion|carrot|gobi|cauliflower|broccoli|cabbage|capsicum|bhindi|okra|brinjal|eggplant|peas|salad|lauki|methi|sambar)\b/],
];

export function categorizeIngredient(name: string): GroceryItem["category"] {
  const lower = name.toLowerCase();
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(lower)) return category;
  }
  return "other";
}

function formatGrams(grams: number): string {
  if (grams >= 1000) return `${parseFloat((grams / 1000).toFixed(2))} kg`;
  return `${Math.round(grams / 5) * 5 || Math.round(grams)} g`;
}

/** Sums every ingredient across the week (as-cooked weights) into a categorised shopping list. */
export function buildGroceryList(days: DayPlan[]): GroceryItem[] {
  const totals = new Map<string, { name: string; grams: number; uses: number }>();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase().trim();
        const grams = parseQuantityInGrams(ing.quantity, ing.name);
        const entry = totals.get(key);
        if (entry) {
          entry.grams += grams;
          entry.uses += 1;
        } else {
          totals.set(key, { name: ing.name.trim(), grams, uses: 1 });
        }
      }
    }
  }

  return Array.from(totals.values())
    .map(
      (t): GroceryItem => ({
        name: t.name,
        totalQuantity: formatGrams(t.grams),
        category: categorizeIngredient(t.name),
        uses: t.uses,
      })
    )
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
