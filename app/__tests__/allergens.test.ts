import { describe, it, expect } from "vitest";
import { findAllergenViolation, findDietTypeViolation, macroEnergyShare } from "../lib/nutrition";

describe("allergen matching is whole-word, not substring", () => {
  it("does not flag eggplant (baingan) as an egg allergen", () => {
    expect(findAllergenViolation(["Eggplant Bharta", "Roti"], ["egg"])).toBeNull();
    expect(findAllergenViolation(["Boiled egg"], ["egg"])).toBe("egg");
    expect(findAllergenViolation(["Scrambled eggs"], ["eggs"])).toBe("eggs");
  });

  it("does not flag lentils as sesame (til) or goat as oat", () => {
    expect(findAllergenViolation(["Masoor lentil soup"], ["sesame"])).toBeNull();
    expect(findAllergenViolation(["Til ladoo", "Sesame seeds"], ["sesame"])).toBe("sesame");
    expect(findAllergenViolation(["Goat curry"], ["gluten"])).toBeNull();
    expect(findAllergenViolation(["Rolled oats", "Oatmeal"], ["gluten"])).toBe("gluten");
  });

  it("still catches compound dairy foods", () => {
    for (const food of ["Buttermilk (chaas)", "Cucumber raita", "Rice kheer", "Milkshake", "Ice cream", "Greek yogurt"]) {
      expect(findAllergenViolation([food], ["dairy"]), food).toBe("dairy");
    }
  });

  it("treats plant milks and nut butters as non-dairy, but still as nuts", () => {
    expect(findAllergenViolation(["Coconut milk curry"], ["dairy"])).toBeNull();
    expect(findAllergenViolation(["Peanut butter toast"], ["dairy"])).toBeNull();
    expect(findAllergenViolation(["Peanut butter"], ["nuts"])).toBe("nuts");
    expect(findAllergenViolation(["Almond milk"], ["nuts"])).toBe("nuts");
    expect(findAllergenViolation(["Almond milk"], ["dairy"])).toBeNull();
  });

  it("does not treat coconut or nutmeg as a nut allergen", () => {
    expect(findAllergenViolation(["Coconut chutney", "Nutmeg"], ["nuts"])).toBeNull();
    expect(findAllergenViolation(["Mixed nuts"], ["nuts"])).toBe("nuts");
  });

  it("understands the names users actually type", () => {
    expect(findAllergenViolation(["Roasted Peanuts (Moongfali)"], ["Peanuts"])).toBe("Peanuts");
    expect(findAllergenViolation(["Roti (Whole Wheat Chapati)"], ["Wheat"])).toBe("Wheat");
    expect(findAllergenViolation(["Soya Chunks"], ["soya"])).toBe("soya");
    expect(findAllergenViolation(["Prawn masala"], ["Seafood"])).toBe("Seafood");
    expect(findAllergenViolation(["Fish curry"], ["  FISH "])).toBe("  FISH ");
  });

  it("matches a free-text allergen word directly", () => {
    expect(findAllergenViolation(["Mustard oil tadka"], ["mustard"])).toBe("mustard");
    expect(findAllergenViolation(["Cumin rice"], ["mustard"])).toBeNull();
  });

  it("ignores blank allergy entries", () => {
    expect(findAllergenViolation(["Anything at all"], ["", "  "])).toBeNull();
  });
});

describe("diet type matching", () => {
  it("allows eggplant and chickpeas for vegetarians", () => {
    expect(findDietTypeViolation(["Eggplant curry", "Chickpea salad"], "vegetarian")).toBeNull();
  });

  it("rejects meat, fish and eggs for strict vegetarians", () => {
    expect(findDietTypeViolation(["Chicken curry"], "vegetarian")).toContain("chicken");
    expect(findDietTypeViolation(["Fish tikka"], "vegetarian")).toContain("fish");
    expect(findDietTypeViolation(["Egg bhurji"], "vegetarian")).toContain("eggs");
    expect(findDietTypeViolation(["Egg bhurji"], "vegetarian_eggs")).toBeNull();
    expect(findDietTypeViolation(["Egg bhurji"], "non_vegetarian")).toBeNull();
  });

  it("does not mistake words that merely contain a meat word", () => {
    expect(findDietTypeViolation(["Chamomile tea", "Meatless soya mince"], "vegetarian")).toBeNull();
  });

  it("rejects every animal product for vegans, including the ones the old list missed", () => {
    for (const food of ["Whey Protein Powder", "Greek yogurt", "Buttermilk", "Honey", "Desi Ghee", "Mayonnaise", "Boiled egg"]) {
      expect(findDietTypeViolation([food], "vegan"), food).not.toBeNull();
    }
  });

  it("allows plant milks and nut butters for vegans", () => {
    expect(findDietTypeViolation(["Peanut butter", "Coconut milk", "Almond milk"], "vegan")).toBeNull();
  });
});

describe("macroEnergyShare", () => {
  it("reports the real split instead of a hard-coded label", () => {
    // 2000 kcal: 150g protein (30%), 200g carbs (40%), 67g fat (~30%)
    expect(macroEnergyShare({ calories: 2000, proteinG: 150, carbsG: 200, fatG: 67 })).toEqual({
      protein: 30,
      carbs: 40,
      fat: 30,
    });
    expect(macroEnergyShare({ calories: 0, proteinG: 1, carbsG: 1, fatG: 1 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
