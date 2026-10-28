import { describe, it, expect } from "vitest";
import {
  computeMacroTargets,
  requiresProfessionalNotice,
  findAllergenViolation,
  findDietTypeViolation,
} from "../lib/nutrition";
import { parseQuantityInGrams } from "../lib/nutritionLookup";
import { filterEligibleExercises } from "../data/exercises";

describe("Nutrition Formulas & Safety Limits", () => {
  it("calculates baseline TDEE and macros correctly for adult male", () => {
    const targets = computeMacroTargets({
      age: 25,
      heightCm: 175,
      weightKg: 70,
      sex: "male",
      activityLevel: "moderate", // 1.55
      goal: "general_fitness",
      dietType: "vegetarian",
      allergies: [],
      budget: "moderate",
    });

    expect(targets).not.toBeNull();
    if (!targets) return;
    // BMR = 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
    // TDEE = round(1673.75 * 1.55) = 2594
    expect(targets.tdee).toBeGreaterThan(2500);
    expect(targets.tdee).toBeLessThan(2700);
    expect(targets.calories).toBe(targets.tdee);
    expect(targets.proteinG).toBeGreaterThan(150);
    expect(targets.fatG).toBeGreaterThan(60);
  });

  it("enforces female calorie floor (1200 kcal)", () => {
    const targets = computeMacroTargets({
      age: 60,
      heightCm: 145,
      weightKg: 40,
      sex: "female",
      activityLevel: "sedentary",
      goal: "weight_loss",
      dietType: "vegetarian",
      allergies: [],
      budget: "affordable",
    });

    expect(targets).not.toBeNull();
    if (!targets) return;
    expect(targets.calories).toBeGreaterThanOrEqual(1200);
  });

  it("flags safety for minors under 18 or medical flag", () => {
    expect(
      requiresProfessionalNotice({
        age: 16,
        heightCm: 160,
        weightKg: 50,
        sex: "female",
        activityLevel: "moderate",
        goal: "weight_loss",
        dietType: "vegetarian",
        allergies: [],
        budget: "affordable",
      })
    ).toBe(true);

    expect(
      requiresProfessionalNotice({
        age: 28,
        heightCm: 165,
        weightKg: 60,
        sex: "female",
        activityLevel: "moderate",
        goal: "general_fitness",
        dietType: "vegetarian",
        allergies: [],
        budget: "moderate",
        pregnant: true,
      })
    ).toBe(true);
  });
});

describe("Allergen & Diet Restrictions", () => {
  it("detects declared allergen in ingredients", () => {
    const violation = findAllergenViolation(
      ["Whole wheat atta roti", "Ghee", "Toor dal"],
      ["gluten"]
    );
    expect(violation).toBe("gluten");
  });

  it("allows safe ingredients with no allergen violation", () => {
    const violation = findAllergenViolation(
      ["White rice", "Yellow moong dal", "Cucumber salad"],
      ["dairy", "nuts"]
    );
    expect(violation).toBeNull();
  });

  it("detects meat in vegetarian diet", () => {
    const violation = findDietTypeViolation(
      ["Chicken breast curry", "Brown rice"],
      "vegetarian"
    );
    expect(violation).toContain("chicken");
  });

  it("detects dairy in vegan diet", () => {
    const violation = findDietTypeViolation(
      ["Paneer bhurji", "Roti"],
      "vegan"
    );
    expect(violation).toContain("paneer");
  });

  it("allows eggs in vegetarian_eggs diet but not strict vegetarian", () => {
    expect(
      findDietTypeViolation(["Boiled egg", "Toast"], "vegetarian_eggs")
    ).toBeNull();

    expect(
      findDietTypeViolation(["Boiled egg", "Toast"], "vegetarian")
    ).not.toBeNull();
  });
});

describe("Nutrition Lookup Gram Parsing", () => {
  it("parses explicit grams", () => {
    expect(parseQuantityInGrams("150g")).toBe(150);
    expect(parseQuantityInGrams("80 gm")).toBe(80);
  });

  it("parses rotis and eggs by piece count", () => {
    expect(parseQuantityInGrams("2 rotis")).toBe(80); // 2 * 40g
    expect(parseQuantityInGrams("3 boiled eggs")).toBe(150); // 3 * 50g
  });
});

describe("Exercise Catalog Filtering", () => {
  it("filters out dumbbell exercises when user only has bodyweight (none)", () => {
    const eligible = filterEligibleExercises(["none"]);
    const hasDumbbell = eligible.some((ex) => ex.id === "ex_db_bicep_curl");
    expect(hasDumbbell).toBe(false);
    const hasSquat = eligible.some((ex) => ex.id === "ex_squat");
    expect(hasSquat).toBe(true);
  });

  it("filters out avoided movements", () => {
    const eligible = filterEligibleExercises(["none", "dumbbells"], ["squat"]);
    const hasSquat = eligible.some((ex) => ex.id === "ex_squat");
    expect(hasSquat).toBe(false);
  });
});
