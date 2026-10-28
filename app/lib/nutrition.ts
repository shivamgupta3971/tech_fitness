/**
 * Deterministic calorie & macro calculator.
 * Uses Mifflin-St Jeor TDEE formula + goal adjustment.
 * All arithmetic here — never delegated to the LLM.
 */

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Goal = "weight_loss" | "weight_gain" | "muscle_gain" | "general_fitness";
export type DietType = "vegan" | "vegetarian" | "vegetarian_eggs" | "non_vegetarian";
export type Budget = "affordable" | "moderate" | "flexible";

export interface UserProfile {
  age: number;
  heightCm: number;
  weightKg: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
  dietType: DietType;
  allergies: string[];
  budget: Budget;
  cuisinePreferences?: string[];
  mealTimings?: string[];
  /** true if user is pregnant */
  pregnant?: boolean;
  /** true if user has a medical condition or eating disorder history */
  medicalFlag?: boolean;
}

export interface MacroTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Computed TDEE before goal adjustment */
  tdee: number;
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const CALORIE_FLOOR_MALE = 1500;
const CALORIE_FLOOR_FEMALE = 1200;
const MAX_DEFICIT = 750;  // kcal/day
const MAX_SURPLUS = 600;  // kcal/day

/**
 * Mifflin-St Jeor BMR → TDEE → goal-adjusted calorie target.
 * Returns null for unsafe profiles (under 18 with medical flag, pregnant, ED history).
 */
export function computeMacroTargets(profile: UserProfile): MacroTargets | null {
  const { age, heightCm, weightKg, sex, activityLevel, goal } = profile;

  // Safety: flag unsafe cases, caller should show "consult professional" notice
  if (age < 18 && (profile.medicalFlag || profile.pregnant)) return null;
  if (profile.pregnant) return null;
  if (profile.medicalFlag && (goal === "weight_loss")) return null;

  // BMR — Mifflin-St Jeor
  let bmr: number;
  if (sex === "male") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    // female or other → use female equation (conservative)
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  const tdee = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);

  // Goal adjustment
  let adjustment = 0;
  switch (goal) {
    case "weight_loss":
      adjustment = -Math.min(500, MAX_DEFICIT);
      break;
    case "weight_gain":
    case "muscle_gain":
      adjustment = Math.min(300, MAX_SURPLUS);
      break;
    case "general_fitness":
      adjustment = 0;
      break;
  }

  let calories = tdee + adjustment;

  // Enforce floor
  const floor = sex === "male" ? CALORIE_FLOOR_MALE : CALORIE_FLOOR_FEMALE;
  calories = Math.max(calories, floor);

  // Macro split: protein 25–30%, fat 25–30%, carbs rest
  const proteinG = Math.round((calories * 0.27) / 4);
  const fatG = Math.round((calories * 0.27) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);

  return { calories: Math.round(calories), proteinG, carbsG, fatG, tdee };
}

/**
 * Returns true if a profile requires the "consult a professional" safety notice
 * and should NOT receive a restrictive meal plan.
 */
export function requiresProfessionalNotice(profile: UserProfile): boolean {
  if (profile.age < 18) return true;
  if (profile.pregnant) return true;
  if (profile.medicalFlag) return true;
  return false;
}

// ─── Allergen & Diet-Type Validation ─────────────────────────────────────────

/**
 * Common allergen keyword map. Keys are canonical allergen names.
 * Values are keyword arrays for matching against ingredient text.
 */
export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: ["wheat", "barley", "rye", "maida", "atta", "bread", "roti", "naan", "pita", "pasta", "noodle", "semolina", "suji", "rava", "oat"],
  dairy: ["milk", "paneer", "ghee", "butter", "cream", "curd", "yogurt", "dahi", "cheese", "lassi", "whey", "lactose", "khoya", "mawa"],
  nuts: ["peanut", "groundnut", "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "macadamia", "pine nut", "chestnut"],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh", "miso"],
  egg: ["egg", "mayonnaise", "mayo", "albumen"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "scallop", "clam", "mussel", "oyster"],
  fish: ["fish", "salmon", "tuna", "sardine", "mackerel", "tilapia", "rohu", "catla", "hilsa"],
  sesame: ["sesame", "til", "tahini"],
};

/** Ingredients that are non-vegetarian (for vegetarian/vegan validation) */
const NON_VEG_KEYWORDS = [
  "chicken", "mutton", "lamb", "beef", "pork", "fish", "prawn", "shrimp",
  "crab", "lobster", "meat", "bacon", "ham", "sausage", "keema", "biryani with meat",
  "rohu", "catla", "hilsa", "salmon", "tuna", "sardine",
];

/** Ingredients not allowed for vegans */
const NON_VEGAN_KEYWORDS = [
  ...NON_VEG_KEYWORDS,
  "milk", "curd", "dahi", "paneer", "ghee", "butter", "cream", "cheese",
  "lassi", "khoya", "mawa", "honey", "egg",
];

/** Eggs are allowed in "vegetarian_eggs" but not strict vegetarian or vegan */
const EGG_KEYWORDS = ["egg", "omelette", "scrambled", "boiled egg", "fried egg", "egg white", "egg yolk"];

/**
 * Check if a list of ingredient strings contains any declared allergen.
 * Returns the first offending allergen name, or null if clean.
 */
export function findAllergenViolation(
  ingredients: string[],
  userAllergies: string[]
): string | null {
  const lower = ingredients.map((i) => i.toLowerCase());
  for (const allergen of userAllergies) {
    const keywords = ALLERGEN_KEYWORDS[allergen.toLowerCase()] ?? [allergen.toLowerCase()];
    for (const kw of keywords) {
      if (lower.some((i) => i.includes(kw))) {
        return allergen;
      }
    }
  }
  return null;
}

/**
 * Check if ingredients are compatible with the user's diet type.
 * Returns a violation description or null if clean.
 */
export function findDietTypeViolation(
  ingredients: string[],
  dietType: DietType
): string | null {
  const lower = ingredients.map((i) => i.toLowerCase()).join(" ");

  if (dietType === "vegan") {
    for (const kw of NON_VEGAN_KEYWORDS) {
      if (lower.includes(kw)) return `"${kw}" not allowed for vegan diet`;
    }
  } else if (dietType === "vegetarian") {
    for (const kw of NON_VEG_KEYWORDS) {
      if (lower.includes(kw)) return `"${kw}" not allowed for vegetarian diet`;
    }
    for (const kw of EGG_KEYWORDS) {
      if (lower.includes(kw)) return `eggs not allowed for strict vegetarian`;
    }
  } else if (dietType === "vegetarian_eggs") {
    for (const kw of NON_VEG_KEYWORDS) {
      if (lower.includes(kw)) return `"${kw}" not allowed for vegetarian diet`;
    }
  }
  // non_vegetarian: no restrictions
  return null;
}
