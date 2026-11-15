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

/** Share of daily energy from each macro, rounded to whole percents (for display). */
export function macroEnergyShare(t: Pick<MacroTargets, "calories" | "proteinG" | "carbsG" | "fatG">): {
  protein: number;
  carbs: number;
  fat: number;
} {
  if (t.calories <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((t.proteinG * 4 * 100) / t.calories),
    carbs: Math.round((t.carbsG * 4 * 100) / t.calories),
    fat: Math.round((t.fatG * 9 * 100) / t.calories),
  };
}

// ─── Allergen & Diet-Type Validation ─────────────────────────────────────────
//
// These checks are the app's safety net: every plan (LLM-written or built-in) must pass them before it
// reaches the user. Matching is whole-word (a trailing plural "s"/"es" is allowed) so that
//   "egg" does not flag eggplant (baingan), "oat" does not flag goat, "til" does not flag lentil —
// while compound words that really are the allergen (buttermilk, raita, kheer) are listed explicitly.

const regexCache = new Map<string, RegExp>();

function wordRegex(keyword: string): RegExp {
  let re = regexCache.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?:^|[^a-z])${escaped}(?:e?s)?(?![a-z])`);
    regexCache.set(keyword, re);
  }
  return re;
}

/** True when `keyword` appears in `text` as a whole word/phrase (plural tolerated). Expects lowercase text. */
function hasWord(text: string, keyword: string): boolean {
  return wordRegex(keyword).test(text);
}

/**
 * Phrases that contain a dairy/egg word but are not dairy/egg. Removed before dairy, egg and diet-type
 * checks only — never before the nut check, because "almond milk" and "peanut butter" are still nuts.
 */
const NOT_ANIMAL_PRODUCT = [
  "coconut milk",
  "coconut cream",
  "almond milk",
  "soy milk",
  "soya milk",
  "oat milk",
  "rice milk",
  "cashew milk",
  "peanut butter",
  "almond butter",
  "cashew butter",
  "cocoa butter",
  "shea butter",
  "butter bean",
  "butter beans",
];

function stripNotAnimalProducts(text: string): string {
  let out = text;
  for (const phrase of NOT_ANIMAL_PRODUCT) out = out.split(phrase).join(" ");
  return out;
}

/**
 * Canonical allergen names → words that indicate them in an ingredient. Includes Indian names.
 * Values are matched as whole words; see the note above about compounds.
 */
export const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  gluten: [
    "wheat", "barley", "rye", "maida", "atta", "bread", "roti", "chapati", "chapatti", "phulka", "paratha",
    "puri", "poori", "thepla", "naan", "kulcha", "pita", "pasta", "noodle", "semolina", "suji", "sooji",
    "rava", "upma", "oat", "oatmeal", "couscous", "seitan", "bulgur", "dalia", "daliya", "toast", "pav", "bun",
    "tortilla", "pizza", "muesli", "granola", "biscuit", "cracker",
  ],
  dairy: [
    "milk", "paneer", "ghee", "butter", "cream", "curd", "yogurt", "yoghurt", "dahi", "cheese", "lassi",
    "buttermilk", "chaas", "chhaas", "raita", "kheer", "malai", "kulfi", "khoya", "mawa", "whey", "casein",
    "lactose", "custard", "shrikhand", "rasmalai", "milkshake", "cheesecake", "mozzarella", "cheddar", "parmesan", "ricotta",
  ],
  nuts: [
    "nut", "peanut", "groundnut", "moongfali", "almond", "badam", "cashew", "kaju", "walnut", "akhrot",
    "pistachio", "pista", "hazelnut", "pecan", "macadamia", "pine nut", "chestnut", "nutella", "praline",
    "marzipan", "granola", "muesli", "chikki", "trail mix", "satay",
  ],
  soy: ["soy", "soya", "soybean", "soyabean", "tofu", "edamame", "tempeh", "miso", "nutrela", "mealmaker"],
  egg: ["egg", "omelette", "omelet", "anda", "mayonnaise", "mayo", "albumen", "meringue"],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "crayfish", "scallop", "clam", "mussel", "oyster", "squid", "calamari", "octopus", "shellfish"],
  fish: [
    "fish", "salmon", "tuna", "sardine", "mackerel", "tilapia", "rohu", "catla", "hilsa", "pomfret", "anchovy",
    "anchovies", "cod", "trout", "bombil", "surmai", "bangda", "machli", "machhi",
  ],
  sesame: ["sesame", "til", "tahini", "gingelly"],
};

/** Common spellings people type for an allergy → canonical key above. */
const ALLERGEN_ALIASES: Record<string, string> = {
  peanut: "nuts",
  peanuts: "nuts",
  "tree nut": "nuts",
  "tree nuts": "nuts",
  nut: "nuts",
  lactose: "dairy",
  milk: "dairy",
  wheat: "gluten",
  soya: "soy",
  eggs: "egg",
  seafood: "shellfish",
  prawn: "shellfish",
  prawns: "shellfish",
};

function canonicalAllergen(declared: string): string {
  const a = declared.trim().toLowerCase();
  return ALLERGEN_ALIASES[a] ?? a;
}

/** Ingredients that are meat, fish or poultry. */
const NON_VEG_KEYWORDS = [
  "chicken", "mutton", "lamb", "beef", "pork", "bacon", "ham", "sausage", "salami", "pepperoni", "keema",
  "meat", "meatball", "goat", "turkey", "duck", "liver", "steak", "lard", "tallow", "seafood",
  "shrimp", "prawn", "crab", "lobster", "squid", "fish", "rohu", "catla", "hilsa", "salmon", "tuna",
  "sardine", "mackerel", "pomfret", "tilapia", "anchovy", "anchovies", "bombil", "surmai", "bangda", "machli", "cod", "trout",
];

/** Everything above plus dairy, eggs and honey. */
const NON_VEGAN_KEYWORDS = [
  ...NON_VEG_KEYWORDS,
  "milk", "curd", "dahi", "paneer", "ghee", "butter", "cream", "cheese", "yogurt", "yoghurt", "lassi",
  "buttermilk", "chaas", "chhaas", "raita", "kheer", "malai", "kulfi", "khoya", "mawa", "whey", "casein",
  "custard", "shrikhand", "rasmalai", "honey", "gelatin", "gelatine",
];

/** Eggs are allowed in "vegetarian_eggs" but not strict vegetarian or vegan. */
const EGG_KEYWORDS = ["egg", "omelette", "omelet", "anda", "mayonnaise", "mayo", "albumen", "meringue"];

/**
 * Check if a list of ingredient strings contains any declared allergen.
 * Returns the first offending allergen as the user declared it, or null if clean.
 */
export function findAllergenViolation(
  ingredients: string[],
  userAllergies: string[]
): string | null {
  const lower = ingredients.map((i) => i.toLowerCase());
  const lowerAnimal = lower.map(stripNotAnimalProducts);

  for (const declared of userAllergies) {
    const key = canonicalAllergen(declared);
    if (!key) continue;
    const keywords = ALLERGEN_KEYWORDS[key] ?? [key];
    // Plant milks / nut butters are not dairy or egg, but they must still trip the nut check.
    const haystack = key === "dairy" || key === "egg" ? lowerAnimal : lower;
    if (keywords.some((kw) => haystack.some((text) => hasWord(text, kw)))) {
      return declared;
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
  if (dietType === "non_vegetarian") return null;

  const text = ingredients.map((i) => stripNotAnimalProducts(i.toLowerCase()));
  const firstHit = (keywords: string[]) => keywords.find((kw) => text.some((t) => hasWord(t, kw)));

  if (dietType === "vegan") {
    const hit = firstHit(NON_VEGAN_KEYWORDS) ?? firstHit(EGG_KEYWORDS);
    if (hit) return `"${hit}" not allowed for vegan diet`;
    return null;
  }

  const meat = firstHit(NON_VEG_KEYWORDS);
  if (meat) return `"${meat}" not allowed for vegetarian diet`;

  if (dietType === "vegetarian" && firstHit(EGG_KEYWORDS)) {
    return `eggs not allowed for strict vegetarian`;
  }
  return null;
}
