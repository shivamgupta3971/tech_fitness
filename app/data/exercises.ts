import type { Equipment, ExperienceLevel, TrackingMode } from "../lib/storage";

export interface CatalogExercise {
  id: string;
  name: string;
  category: "strength" | "cardio" | "dance" | "mobility" | "core";
  targetMuscles: string[];
  equipment: Equipment[];
  difficulty: ExperienceLevel;
  trackable: boolean;
  trackingMode: TrackingMode;
  description: string;
  instructions: string[];
  beginnerAlternative?: string;
}

export const EXERCISE_CATALOG: CatalogExercise[] = [
  // ── Trackable with FitVeda Arena ──────────────────────────────────────────
  {
    id: "ex_squat",
    name: "Bodyweight Squat",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "hamstrings", "core"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: true,
    trackingMode: "gym",
    description: "Fundamental lower-body compound movement tracking knee bend, hip crease depth, and spinal neutrality.",
    instructions: [
      "Stand with feet shoulder-width apart, toes pointing slightly outward.",
      "Keep chest tall, push hips back and bend knees until thighs are parallel to ground.",
      "Drive through midfoot and heels to return to standing position."
    ],
    beginnerAlternative: "Box Squat / Chair Squat"
  },
  {
    id: "ex_lunge",
    name: "Forward Lunge",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "calves", "core"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: true,
    trackingMode: "gym",
    description: "Unilateral leg exercise focusing on knee tracking, balance, and vertical posture.",
    instructions: [
      "Step forward with right leg into a 90-degree bend at both knees.",
      "Keep back knee hovering just off the ground with torso upright.",
      "Push back firmly through front heel to starting stance and alternate."
    ],
    beginnerAlternative: "Static Split Squat"
  },
  {
    id: "ex_pushup",
    name: "Push-Up",
    category: "strength",
    targetMuscles: ["chest", "triceps", "anterior deltoids", "core"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: true,
    trackingMode: "gym",
    description: "Upper body pushing foundation evaluated for straight body alignment and elbow flexion.",
    instructions: [
      "Place hands slightly wider than shoulder-width in a high plank.",
      "Lower chest until 2-3 inches above ground keeping elbows tucked at 45 degrees.",
      "Press through palms back to full lockout without sagging hips."
    ],
    beginnerAlternative: "Knee Push-Up / Incline Push-Up"
  },
  {
    id: "ex_plank",
    name: "Forearm Plank Hold",
    category: "core",
    targetMuscles: ["rectus abdominis", "transverse abdominis", "shoulders", "glutes"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: true,
    trackingMode: "gym",
    description: "Isometric core stability hold scored for flat back alignment and anti-extension stillness.",
    instructions: [
      "Rest on forearms with elbows stacked directly beneath shoulders.",
      "Form a straight line from heels to head with squeezed glutes and braced core.",
      "Hold steadily while breathing rhythmically."
    ],
    beginnerAlternative: "Knee Plank Hold"
  },
  {
    id: "ex_dance_cardio",
    name: "Cardio Dance Routine",
    category: "dance",
    targetMuscles: ["full body", "calves", "core", "cardiovascular"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: true,
    trackingMode: "dance",
    description: "High-energy rhythmic choreography tracked live against reference video pose landmarks.",
    instructions: [
      "Follow on-screen dance instructor pacing and arm-leg combinations.",
      "Keep light on the balls of your feet and maintain sync with the rhythm.",
      "Aim for full extension of arms and dynamic hip movements."
    ],
    beginnerAlternative: "Low-impact Step Touch"
  },
  {
    id: "ex_dance_hiphop",
    name: "Urban / Hip Hop Groove",
    category: "dance",
    targetMuscles: ["quadriceps", "glutes", "core", "calves"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: true,
    trackingMode: "dance",
    description: "Bouncy tempo choreography testing limb symmetry, bounce depth, and isolation moves.",
    instructions: [
      "Drop into an athletic stance with soft knees.",
      "Follow groove beats matching isolation of shoulders and hips.",
      "Stay relaxed and match instructor transitions."
    ]
  },

  // ── Manual Tracking (Non-trackable pose pipeline) ─────────────────────────
  {
    id: "ex_jumping_jacks",
    name: "Jumping Jacks",
    category: "cardio",
    targetMuscles: ["calves", "deltoids", "core", "cardiovascular"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Classic dynamic warm-up elevating heart rate and shoulder mobility.",
    instructions: ["Jump feet wide while bringing hands overhead, then return together."]
  },
  {
    id: "ex_high_knees",
    name: "High Knees",
    category: "cardio",
    targetMuscles: ["hip flexors", "quadriceps", "calves", "core"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Explosive running in place bringing knees to waist height.",
    instructions: ["Run in place driving knees upward towards hip level with active arm pump."]
  },
  {
    id: "ex_glute_bridge",
    name: "Glute Bridge",
    category: "strength",
    targetMuscles: ["glutes", "hamstrings", "lower back"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Supine hip extension strengthening the posterior chain.",
    instructions: ["Lie on back with knees bent and feet flat, squeeze glutes to lift hips high."]
  },
  {
    id: "ex_mountain_climbers",
    name: "Mountain Climbers",
    category: "cardio",
    targetMuscles: ["core", "shoulders", "hip flexors", "quadriceps"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Rapid alternating knee drives from a push-up plank position.",
    instructions: ["From high plank, rapidly drive knees forward toward chest alternating legs."]
  },
  {
    id: "ex_burpees",
    name: "Burpees",
    category: "cardio",
    targetMuscles: ["chest", "quadriceps", "triceps", "core", "cardiovascular"],
    equipment: ["none"],
    difficulty: "advanced",
    trackable: false,
    trackingMode: "manual",
    description: "Full body explosive conditioning combining squat, push-up, and vertical jump.",
    instructions: ["Squat down, kick back to plank, perform push-up, jump feet forward and leap up."]
  },
  {
    id: "ex_db_bicep_curl",
    name: "Dumbbell Bicep Curl",
    category: "strength",
    targetMuscles: ["biceps", "forearms"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Isolated elbow flexion building upper arm strength.",
    instructions: ["Stand with dumbbells at sides, curl weights toward shoulders keeping elbows pinned."]
  },
  {
    id: "ex_db_shoulder_press",
    name: "Dumbbell Overhead Shoulder Press",
    category: "strength",
    targetMuscles: ["deltoids", "triceps", "upper chest"],
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Vertical pressing movement targeting shoulder caps and lockout strength.",
    instructions: ["Press dumbbells from shoulder height directly overhead until arms lock out."]
  },
  {
    id: "ex_db_goblet_squat",
    name: "Goblet Squat (Dumbbell or Kettlebell)",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "core", "upper back"],
    equipment: ["dumbbells", "kettlebell"],
    difficulty: "intermediate",
    trackable: true,
    trackingMode: "gym",
    description: "Front-loaded squat keeping torso upright and enforcing deep knee flexion.",
    instructions: ["Hold dumbbell vertically at chest, sink hips between knees, drive back up."]
  },
  {
    id: "ex_db_romanian_deadlift",
    name: "Dumbbell Romanian Deadlift (RDL)",
    category: "strength",
    targetMuscles: ["hamstrings", "glutes", "erector spinae"],
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Hip hinge loading posterior chain with soft knees and flat spine.",
    instructions: ["Hinge at hips pushing butt back while lowering dumbbells along shins."]
  },
  {
    id: "ex_db_bent_over_row",
    name: "Dumbbell Bent-Over Row",
    category: "strength",
    targetMuscles: ["latissimus dorsi", "rhomboids", "rear deltoids", "biceps"],
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Horizontal pulling movement developing back thickness and posture.",
    instructions: ["Hinge to 45 degrees, pull dumbbells toward ribcage squeezing shoulder blades."]
  },
  {
    id: "ex_cat_cow",
    name: "Cat-Cow Stretch",
    category: "mobility",
    targetMuscles: ["spine", "neck", "abdominals", "lower back"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Spinal articulation flow mobilizing vertebrae and relieving tension.",
    instructions: ["On hands and knees, alternate between arching spine up (cat) and dipping belly (cow)."]
  },
  {
    id: "ex_downward_dog",
    name: "Downward Facing Dog Hold",
    category: "mobility",
    targetMuscles: ["hamstrings", "calves", "shoulders", "lats"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Inverted V-shape pose stretching calves, hamstrings, and strengthening shoulders.",
    instructions: ["Push hips up and back into an inverted V, press heels toward floor and chest to thighs."]
  },
  {
    id: "ex_childs_pose",
    name: "Child's Pose Restorative Stretch",
    category: "mobility",
    targetMuscles: ["lower back", "hips", "thighs", "ankles"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Restorative cooldown stretch opening hips and calming heart rate.",
    instructions: ["Kneel with big toes touching, sit back on heels and extend arms forward on ground."]
  },
  {
    id: "ex_pullup",
    name: "Pull-Up / Chin-Up",
    category: "strength",
    targetMuscles: ["latissimus dorsi", "biceps", "forearms", "core"],
    equipment: ["pull_up_bar"],
    difficulty: "advanced",
    trackable: false,
    trackingMode: "manual",
    description: "King of vertical bodyweight pulls targeting wide lats and grip.",
    instructions: ["Hang with overhand grip, pull elbows down until chin clears bar."]
  },
  {
    id: "ex_band_pull_apart",
    name: "Resistance Band Pull-Apart",
    category: "mobility",
    targetMuscles: ["rear deltoids", "rhomboids", "rotator cuff"],
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Prehab postural exercise for healthy shoulders and upper back activation.",
    instructions: ["Hold band with arms extended at chest height, pull outward until band touches chest."]
  }
];

export const CATALOG_ID_MAP = new Map(EXERCISE_CATALOG.map((ex) => [ex.id, ex]));

export function getExerciseById(id: string): CatalogExercise | undefined {
  return CATALOG_ID_MAP.get(id);
}

/**
 * Filter exercises appropriate for the user's equipment and avoided movements.
 */
export function filterEligibleExercises(
  userEquipment: Equipment[],
  avoidList: string[] = []
): CatalogExercise[] {
  const eqSet = new Set(userEquipment);
  const avoidLower = avoidList.map((a) => a.toLowerCase());

  return EXERCISE_CATALOG.filter((ex) => {
    // Equipment match: all required equipment must be in user's available equipment
    // (if equipment is ["none"], it's always accessible)
    const hasEquipment = ex.equipment.every(
      (eq) => eq === "none" || eqSet.has(eq) || eqSet.has("full_gym")
    );
    if (!hasEquipment) return false;

    // Check avoid list against exercise id, name, and target muscles
    const nameLower = ex.name.toLowerCase();
    const isAvoided = avoidLower.some(
      (avoid) =>
        ex.id.includes(avoid) ||
        nameLower.includes(avoid) ||
        ex.targetMuscles.some((m) => m.toLowerCase().includes(avoid))
    );
    if (isAvoided) return false;

    return true;
  });
}
