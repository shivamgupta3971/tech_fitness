import { describe, it, expect } from "vitest";
import {
  FALLBACK_MEALS,
  MEAL_TYPES,
  buildDayForTarget,
  buildFallbackDay,
  buildGroceryList,
  categorizeIngredient,
  findDayViolation,
  findMealViolation,
  hydrateDay,
  isCompleteDay,
  scaleQuantityText,
} from "../lib/dietPlanner";
import type { RawDay } from "../lib/dietPlanner";
import type { DietType } from "../lib/nutrition";
import { lookupIngredientNutrition, parseQuantityInGrams } from "../lib/nutritionLookup";
import type { DayPlan } from "../lib/storage";

const DIETS: DietType[] = ["vegan", "vegetarian", "vegetarian_eggs", "non_vegetarian"];
const ALLERGENS = ["gluten", "dairy", "nuts", "soy", "egg", "shellfish", "fish"];

describe("quantity parsing", () => {
  it("reads fractions, kilograms and litres", () => {
    expect(parseQuantityInGrams("1/2 cup")).toBe(75);
    expect(parseQuantityInGrams("1 1/2 tbsp")).toBe(22.5);
    expect(parseQuantityInGrams("½ cup curd")).toBe(75);
    expect(parseQuantityInGrams("1.2 kg")).toBe(1200);
    expect(parseQuantityInGrams("250 ml")).toBe(250);
    expect(parseQuantityInGrams("1 litre")).toBe(1000);
  });

  it("prefers an explicit weight over the piece count", () => {
    expect(parseQuantityInGrams("2 pieces (80g)")).toBe(80);
    expect(parseQuantityInGrams("1 cup (150g)")).toBe(150);
  });

  it("does not read the 'g' of a word as grams", () => {
    // "2 green chillies" used to be parsed as 2 g (digit followed by the letter g).
    expect(parseQuantityInGrams("2 green chillies", "Green chilli")).toBe(10);
    expect(parseQuantityInGrams("1 large egg", "Egg")).toBe(50);
  });

  it("weighs counted nuts per nut, not per 100 g", () => {
    // "10 almonds" used to be 1000 g (~5,800 kcal).
    expect(parseQuantityInGrams("10 almonds", "Almonds (Badam)")).toBe(12);
    expect(parseQuantityInGrams("2 dates", "Dates")).toBe(16);
  });

  it("caps absurd single-ingredient weights", () => {
    expect(parseQuantityInGrams("50 kg")).toBe(2000);
  });
});

describe("nutrition lookup", () => {
  it("picks the most specific food, not the first substring hit", async () => {
    const whole = await lookupIngredientNutrition("Boiled egg", "100g");
    const white = await lookupIngredientNutrition("Boiled egg whites", "100g");
    expect(white.calories).toBeLessThan(whole.calories);
    expect(white.verified).toBe(true);
  });

  it("flags unknown foods as estimates", async () => {
    const n = await lookupIngredientNutrition("Dragon fruit sorbet", "100g");
    expect(n.verified).toBe(false);
  });
});

describe("built-in meal bank", () => {
  it("only uses foods from the verified nutrition database", async () => {
    const unverified: string[] = [];
    for (const m of FALLBACK_MEALS) {
      for (const i of m.ingredients) {
        const n = await lookupIngredientNutrition(i.name, i.quantity);
        if (!n.verified) unverified.push(i.name);
      }
    }
    expect(unverified).toEqual([]);
  });

  it("always has a safe day — for every diet and every combination of the offered allergies", () => {
    let combos = 0;
    for (const dietType of DIETS) {
      for (let mask = 0; mask < 1 << ALLERGENS.length; mask++) {
        const allergies = ALLERGENS.filter((_, i) => mask & (1 << i));
        for (let day = 0; day < 7; day++) {
          const built = buildFallbackDay(day, dietType, allergies);
          combos++;
          expect(built, `${dietType} / ${allergies.join("+")} / day ${day}`).not.toBeNull();
          if (built === null) continue;
          expect(isCompleteDay(built)).toBe(true);
          expect(findDayViolation(built, dietType, allergies), `${dietType} / ${allergies.join("+")} / day ${day}`).toBeNull();
        }
      }
    }
    expect(combos).toBe(4 * 128 * 7);
  });

  it("covers the realistic restrictive profiles (regression: peanuts were served to nut-allergic users)", () => {
    const profiles: [DietType, string[]][] = [
      ["vegetarian", ["nuts", "soy"]],
      ["vegetarian", ["nuts"]],
      ["vegan", ["gluten", "nuts", "soy"]],
      ["vegan", ["gluten", "nuts", "soy", "dairy", "egg"]],
      ["non_vegetarian", ["fish", "shellfish", "dairy"]],
    ];
    for (const [diet, allergies] of profiles) {
      for (let day = 0; day < 7; day++) {
        const built = buildFallbackDay(day, diet, allergies);
        expect(built, `${diet} / ${allergies.join("+")}`).not.toBeNull();
        const names = built!.meals.flatMap((m) => [m.name, ...m.ingredients.map((i) => i.name)]).join(" ").toLowerCase();
        if (allergies.includes("nuts")) expect(names).not.toMatch(/peanut|almond/);
        if (allergies.includes("soy")) expect(names).not.toMatch(/tofu|soya/);
      }
    }
  });

  it("varies the dishes across the week", () => {
    const names = (slot: number) =>
      new Set(Array.from({ length: 7 }, (_, d) => buildFallbackDay(d, "vegetarian", [])!.meals[slot].name));
    for (let slot = 0; slot < MEAL_TYPES.length; slot++) {
      expect(names(slot).size, MEAL_TYPES[slot]).toBeGreaterThanOrEqual(3);
    }
  });

  it("gives non-vegetarians some non-vegetarian meals", () => {
    const week = Array.from({ length: 7 }, (_, d) => buildFallbackDay(d, "non_vegetarian", [])!);
    const text = week.flatMap((d) => d.meals.map((m) => m.name)).join(" ").toLowerCase();
    expect(text).toMatch(/chicken|fish|egg/);
  });
});

describe("safety validation of externally supplied meals", () => {
  const meal = (name: string, ingredients: string[]): RawDay["meals"][number] => ({
    name,
    type: "lunch",
    ingredients: ingredients.map((n) => ({ name: n, quantity: "100g" })),
    prepSteps: [],
  });

  it("checks the dish name as well as the ingredients", () => {
    // The model named the dish but left the paneer out of the ingredient list.
    expect(findMealViolation(meal("Paneer Tikka", ["Capsicum", "Onion"]), "vegetarian", ["dairy"])).toContain("dairy");
  });

  it("accepts a safe meal", () => {
    expect(findMealViolation(meal("Masoor Dal", ["Masoor Dal (Cooked)", "White Rice (Cooked)"]), "vegan", ["nuts"])).toBeNull();
  });

  it("requires breakfast, lunch and dinner", () => {
    const day: RawDay = { meals: [{ ...meal("A", ["Rice"]), type: "breakfast" }, { ...meal("B", ["Rice"]), type: "lunch" }] };
    expect(isCompleteDay(day)).toBe(false);
  });
});

describe("portion scaling", () => {
  it("scales every number in a quantity and keeps it readable", () => {
    expect(scaleQuantityText("150g", 1.5)).toBe("225g");
    expect(scaleQuantityText("2 pieces (80g)", 1.5)).toBe("3 pieces (120g)");
    expect(scaleQuantityText("1 cup", 1.4)).toBe("1.5 cup");
    expect(scaleQuantityText("100 g", 2)).toBe("200 g");
    expect(scaleQuantityText("1/2 cup", 2)).toBe("1 cup");
    expect(scaleQuantityText("1.5 kg", 2)).toBe("3 kg");
  });

  it("never scales a quantity to zero", () => {
    expect(scaleQuantityText("1g", 0.6)).toBe("5g");
    expect(scaleQuantityText("1 piece", 0.6)).toBe("0.5 piece");
  });

  it("brings a day to its calorie target (the built-in day used to provide ~1450 kcal for a 2500 kcal target)", async () => {
    const raw = buildFallbackDay(0, "vegetarian", [])!;
    const base = await hydrateDay(raw, "2026-01-01", "t");
    const target = 2500;
    expect(base.totalNutrition.calories).toBeLessThan(target * 0.9); // genuinely needs scaling

    const fitted = await buildDayForTarget(raw, "2026-01-01", "t", target);
    expect(fitted.totalNutrition.calories).toBeGreaterThan(target * 0.88);
    expect(fitted.totalNutrition.calories).toBeLessThan(target * 1.12);
    expect(fitted.portionScale).toBeGreaterThan(1);
  });

  it("leaves a day alone when it is already close to the target", async () => {
    const raw = buildFallbackDay(0, "vegetarian", [])!;
    const base = await hydrateDay(raw, "2026-01-01", "t");
    const fitted = await buildDayForTarget(raw, "2026-01-01", "t", base.totalNutrition.calories);
    expect(fitted.portionScale).toBeUndefined();
    expect(fitted.totalNutrition.calories).toBe(base.totalNutrition.calories);
  });

  it("clamps scaling so an extreme target isn't met with absurd portions", async () => {
    const raw = buildFallbackDay(0, "vegetarian", [])!;
    const fitted = await buildDayForTarget(raw, "2026-01-01", "t", 9000);
    expect(fitted.portionScale).toBe(1.8);
  });
});

describe("hydrateDay", () => {
  it("orders meals breakfast → dinner and gives each a stable unique id", async () => {
    const raw = buildFallbackDay(2, "vegetarian", [])!;
    raw.meals.reverse();
    const day = await hydrateDay(raw, "2026-03-04", "plan1_d2");
    expect(day.meals.map((m) => m.type)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(new Set(day.meals.map((m) => m.id)).size).toBe(4);
    expect(day.meals[0].id.startsWith("plan1_d2_")).toBe(true);
    expect(day.totalNutrition.calories).toBe(day.meals.reduce((s, m) => s + m.nutrition.calories, 0));
  });
});

describe("grocery list", () => {
  const dayWith = (ingredients: [string, string][]): DayPlan => ({
    date: "2026-01-01",
    meals: [
      {
        id: "m",
        name: "Meal",
        type: "lunch",
        ingredients: ingredients.map(([name, quantity]) => ({ name, quantity })),
        prepSteps: [],
        nutrition: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, verified: true },
      },
    ],
    totalNutrition: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, verified: true },
  });

  it("sums quantities across the week instead of keeping the first one", () => {
    const list = buildGroceryList([
      dayWith([["White Rice (Cooked)", "200g"], ["Apple", "1 piece (150g)"]]),
      dayWith([["White Rice (Cooked)", "150g"]]),
      dayWith([["white rice (cooked)", "650g"]]),
    ]);
    const rice = list.find((i) => i.name === "White Rice (Cooked)")!;
    expect(rice.totalQuantity).toBe("1 kg");
    expect(rice.uses).toBe(3);
    expect(list.find((i) => i.name === "Apple")!.totalQuantity).toBe("150 g");
  });

  it("categorises sensibly and no longer files everything under vegetables", () => {
    expect(categorizeIngredient("Roasted Peanuts (Moongfali)")).toBe("protein");
    expect(categorizeIngredient("Peanut Butter")).toBe("protein");
    expect(categorizeIngredient("Desi Ghee (Clarified Butter)")).toBe("dairy");
    expect(categorizeIngredient("Roti (Whole Wheat Chapati)")).toBe("grain");
    expect(categorizeIngredient("Moong Dal Khichdi (Rice + Moong)")).toBe("grain");
    expect(categorizeIngredient("Fresh Banana")).toBe("fruit");
    expect(categorizeIngredient("Vegetable Sambar")).toBe("vegetable");
    expect(categorizeIngredient("Sprouted Moong Beans")).toBe("protein");
    expect(categorizeIngredient("Mystery ingredient")).toBe("other");
  });

  it("contains nothing a nut-allergic user's plan shouldn't", () => {
    const days = Array.from({ length: 7 }, (_, d) => buildFallbackDay(d, "vegetarian", ["nuts"])!);
    return Promise.all(days.map((d, i) => hydrateDay(d, `2026-01-0${i + 1}`, `p_d${i}`))).then((hydrated) => {
      const names = buildGroceryList(hydrated).map((g) => g.name).join(" ").toLowerCase();
      expect(names).not.toMatch(/peanut|almond/);
    });
  });
});
