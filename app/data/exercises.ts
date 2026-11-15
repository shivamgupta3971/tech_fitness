import type { Equipment, ExperienceLevel, TrackingMode } from "../lib/storage";

/** Body area an exercise loads heavily; matched against the user's stated limitations (e.g. "knee pain"). */
export type JointStress =
  | "knee"
  | "back"
  | "shoulder"
  | "wrist"
  | "ankle"
  | "hip"
  | "neck"
  | "elbow"
  | "overhead"
  | "impact";

export interface CatalogExercise {
  id: string;
  name: string;
  category: "strength" | "cardio" | "dance" | "mobility" | "core";
  targetMuscles: string[];
  /** The exercise is available if the user has ANY of these ("none" = no equipment needed). */
  equipment: Equipment[];
  difficulty: ExperienceLevel;
  trackable: boolean;
  trackingMode: TrackingMode;
  description: string;
  instructions: string[];
  beginnerAlternative?: string;
  /** Areas this movement stresses; used to honour limitations like "knee pain" or "no overhead press". */
  stress?: JointStress[];
  /** Prescribed by time (holds, stretches, cardio) rather than by sets × reps. */
  timed?: boolean;
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
    beginnerAlternative: "Box Squat / Chair Squat",
    stress: ["knee"],
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
    beginnerAlternative: "Static Split Squat",
    stress: ["knee", "hip"],
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
    beginnerAlternative: "Knee Push-Up / Incline Push-Up",
    stress: ["wrist", "shoulder"],
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
    beginnerAlternative: "Knee Plank Hold",
    stress: ["shoulder"],
    timed: true,
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
    beginnerAlternative: "Low-impact Step Touch",
    stress: ["impact", "knee", "ankle"],
    timed: true,
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
    ],
    stress: ["impact", "knee", "ankle"],
    timed: true,
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
    instructions: ["Jump feet wide while bringing hands overhead, then return together."],
    beginnerAlternative: "Step-out Jacks (no jump)",
    stress: ["impact", "knee", "ankle"],
    timed: true,
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
    instructions: ["Run in place driving knees upward towards hip level with active arm pump."],
    beginnerAlternative: "Marching in place",
    stress: ["impact", "knee", "hip"],
    timed: true,
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
    instructions: ["From high plank, rapidly drive knees forward toward chest alternating legs."],
    stress: ["wrist", "shoulder", "impact"],
    timed: true,
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
    instructions: ["Squat down, kick back to plank, perform push-up, jump feet forward and leap up."],
    stress: ["impact", "knee", "wrist", "shoulder", "back"],
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
    instructions: ["Stand with dumbbells at sides, curl weights toward shoulders keeping elbows pinned."],
    stress: ["elbow"],
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
    instructions: ["Press dumbbells from shoulder height directly overhead until arms lock out."],
    stress: ["shoulder", "overhead", "neck"],
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
    instructions: ["Hold dumbbell vertically at chest, sink hips between knees, drive back up."],
    stress: ["knee"],
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
    instructions: ["Hinge at hips pushing butt back while lowering dumbbells along shins."],
    stress: ["back"],
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
    instructions: ["Hinge to 45 degrees, pull dumbbells toward ribcage squeezing shoulder blades."],
    stress: ["back"],
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
    instructions: ["On hands and knees, alternate between arching spine up (cat) and dipping belly (cow)."],
    stress: ["wrist"],
    timed: true,
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
    instructions: ["Push hips up and back into an inverted V, press heels toward floor and chest to thighs."],
    stress: ["wrist", "shoulder"],
    timed: true,
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
    instructions: ["Kneel with big toes touching, sit back on heels and extend arms forward on ground."],
    stress: ["knee"],
    timed: true,
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
    instructions: ["Hang with overhand grip, pull elbows down until chin clears bar."],
    stress: ["shoulder", "elbow"],
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
  },

  // ── More bodyweight ───────────────────────────────────────────────────────
  {
    id: "ex_wall_sit",
    name: "Wall Sit",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "calves"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Static squat against a wall building quad endurance with no movement under load.",
    instructions: [
      "Slide down a wall until knees are near 90 degrees, feet flat and hip-width apart.",
      "Keep your back flat on the wall and weight through your heels.",
      "Hold while breathing steadily, then press up to stand."
    ],
    beginnerAlternative: "Shallow wall sit (higher angle)",
    stress: ["knee"],
    timed: true,
  },
  {
    id: "ex_calf_raise",
    name: "Standing Calf Raise",
    category: "strength",
    targetMuscles: ["calves", "ankles"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Simple lower-leg strengthener that supports ankle stability and running mechanics.",
    instructions: [
      "Stand tall holding a wall for balance, feet hip-width apart.",
      "Rise onto the balls of your feet, pause, then lower slowly."
    ],
    stress: ["ankle"],
  },
  {
    id: "ex_bird_dog",
    name: "Bird-Dog",
    category: "core",
    targetMuscles: ["core", "glutes", "erector spinae", "shoulders"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Low-load anti-rotation drill that builds spinal control and balance.",
    instructions: [
      "From hands and knees, extend the opposite arm and leg while keeping hips level.",
      "Pause for a second without arching your lower back, then return and switch sides."
    ],
    stress: ["wrist"],
  },
  {
    id: "ex_dead_bug",
    name: "Dead Bug",
    category: "core",
    targetMuscles: ["transverse abdominis", "hip flexors", "core"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Back-friendly core exercise teaching you to brace while the limbs move.",
    instructions: [
      "Lie on your back with arms up and knees bent over your hips.",
      "Lower the opposite arm and leg slowly, keeping your lower back pressed into the floor.",
      "Return and alternate sides."
    ],
  },
  {
    id: "ex_side_plank",
    name: "Side Plank",
    category: "core",
    targetMuscles: ["obliques", "glutes", "shoulders"],
    equipment: ["none", "yoga_mat"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Lateral core hold that strengthens the obliques and hip stabilisers.",
    instructions: [
      "Lie on your side with your elbow under your shoulder and legs stacked.",
      "Lift your hips so your body forms a straight line and hold, then switch sides."
    ],
    beginnerAlternative: "Knee side plank",
    stress: ["shoulder"],
    timed: true,
  },
  {
    id: "ex_superman",
    name: "Superman Back Extension",
    category: "strength",
    targetMuscles: ["erector spinae", "glutes", "rear deltoids"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Prone lift strengthening the muscles along the spine and the glutes.",
    instructions: [
      "Lie face down with arms extended overhead.",
      "Lift arms, chest and legs a few inches, squeeze your glutes and hold for two seconds.",
      "Lower with control; keep your neck neutral."
    ],
    stress: ["back", "neck"],
  },
  {
    id: "ex_tricep_dip",
    name: "Chair Tricep Dip",
    category: "strength",
    targetMuscles: ["triceps", "chest", "shoulders"],
    equipment: ["none"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Bodyweight triceps exercise using a sturdy chair or bench.",
    instructions: [
      "Sit on the edge of a sturdy chair, hands beside your hips, then slide forward.",
      "Bend your elbows to about 90 degrees keeping them pointing back, then press up."
    ],
    beginnerAlternative: "Bend knees with feet close to the chair",
    stress: ["shoulder", "wrist", "elbow"],
  },
  {
    id: "ex_brisk_walk",
    name: "Brisk Walk",
    category: "cardio",
    targetMuscles: ["legs", "glutes", "cardiovascular"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Steady low-impact cardio that suits every fitness level and most joint limitations.",
    instructions: [
      "Walk at a pace where you can talk but not sing.",
      "Swing your arms and keep your posture tall."
    ],
    timed: true,
  },

  // ── Mobility & stretching ─────────────────────────────────────────────────
  {
    id: "ex_hip_flexor_stretch",
    name: "Kneeling Hip Flexor Stretch",
    category: "mobility",
    targetMuscles: ["hip flexors", "quadriceps"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Opens the front of the hips, which tighten from sitting.",
    instructions: [
      "Kneel on one knee (pad it) with the other foot forward, torso upright.",
      "Tuck your pelvis under and gently shift forward until you feel a stretch in the front of the hip; switch sides."
    ],
    stress: ["knee"],
    timed: true,
  },
  {
    id: "ex_hamstring_stretch",
    name: "Seated Hamstring Stretch",
    category: "mobility",
    targetMuscles: ["hamstrings", "calves", "lower back"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Gentle stretch for the back of the legs.",
    instructions: [
      "Sit with one leg extended and the other foot against your inner thigh.",
      "Hinge forward from the hips with a long spine until you feel a stretch; switch legs."
    ],
    timed: true,
  },
  {
    id: "ex_cobra_stretch",
    name: "Cobra Stretch",
    category: "mobility",
    targetMuscles: ["abdominals", "hip flexors", "chest"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Prone backbend that opens the chest and front of the body.",
    instructions: [
      "Lie face down with hands under your shoulders.",
      "Press up gently, keeping hips on the floor and shoulders away from your ears."
    ],
    stress: ["back", "wrist"],
    timed: true,
  },
  {
    id: "ex_arm_circles",
    name: "Arm Circles",
    category: "mobility",
    targetMuscles: ["shoulders", "upper back"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Easy shoulder warm-up to lubricate the joint before training.",
    instructions: [
      "Stand tall with arms out to the sides.",
      "Make small circles, gradually larger, then reverse direction."
    ],
    timed: true,
  },
  {
    id: "ex_quad_stretch",
    name: "Standing Quad Stretch",
    category: "mobility",
    targetMuscles: ["quadriceps", "hip flexors"],
    equipment: ["none"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Classic stretch for the front of the thigh.",
    instructions: [
      "Stand holding a wall, bend one knee and hold your ankle behind you.",
      "Keep knees together and hips tucked; switch legs."
    ],
    stress: ["knee"],
    timed: true,
  },
  {
    id: "ex_butterfly_stretch",
    name: "Butterfly Stretch",
    category: "mobility",
    targetMuscles: ["inner thighs", "hips"],
    equipment: ["none", "yoga_mat"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Seated stretch for the groin and hips.",
    instructions: [
      "Sit with the soles of your feet together and knees dropped out to the sides.",
      "Sit tall and gently lean forward from the hips."
    ],
    stress: ["hip", "knee"],
    timed: true,
  },

  // ── Resistance bands, kettlebell, dumbbells, bar ──────────────────────────
  {
    id: "ex_band_row",
    name: "Resistance Band Row",
    category: "strength",
    targetMuscles: ["latissimus dorsi", "rhomboids", "biceps"],
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Horizontal pull using a band anchored at chest height.",
    instructions: [
      "Anchor the band, hold the ends with arms extended and step back for tension.",
      "Pull elbows back squeezing your shoulder blades, then release slowly."
    ],
  },
  {
    id: "ex_band_chest_press",
    name: "Resistance Band Chest Press",
    category: "strength",
    targetMuscles: ["chest", "triceps", "shoulders"],
    equipment: ["resistance_bands"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Pressing movement with a band wrapped behind your back.",
    instructions: [
      "Wrap the band behind your upper back and hold the ends at chest height.",
      "Press forward until arms are straight, then return with control."
    ],
    stress: ["shoulder"],
  },
  {
    id: "ex_kb_swing",
    name: "Kettlebell Swing",
    category: "strength",
    targetMuscles: ["glutes", "hamstrings", "core", "shoulders"],
    equipment: ["kettlebell"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Explosive hip hinge that builds posterior-chain power and conditioning.",
    instructions: [
      "Hinge at the hips with a flat back and swing the bell back between your legs.",
      "Snap your hips forward to float the bell to chest height; let it fall back and repeat."
    ],
    beginnerAlternative: "Kettlebell deadlift",
    stress: ["back"],
  },
  {
    id: "ex_db_floor_press",
    name: "Dumbbell Floor Press",
    category: "strength",
    targetMuscles: ["chest", "triceps", "shoulders"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Pressing from the floor limits shoulder range, so it is a joint-friendly chest exercise.",
    instructions: [
      "Lie on your back with knees bent, dumbbells held above your chest.",
      "Lower until your upper arms touch the floor, then press back up."
    ],
    stress: ["shoulder"],
  },
  {
    id: "ex_db_lateral_raise",
    name: "Dumbbell Lateral Raise",
    category: "strength",
    targetMuscles: ["deltoids"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Isolation lift for the side of the shoulders.",
    instructions: [
      "Stand with light dumbbells at your sides and a soft bend in the elbows.",
      "Raise arms out to shoulder height, then lower slowly."
    ],
    stress: ["shoulder"],
  },
  {
    id: "ex_db_reverse_lunge",
    name: "Dumbbell Reverse Lunge",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "hamstrings"],
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Stepping backwards puts less shear on the front knee than a forward lunge.",
    instructions: [
      "Hold dumbbells at your sides and step one foot back.",
      "Lower until both knees are near 90 degrees, then drive through the front heel to stand."
    ],
    stress: ["knee", "hip"],
  },
  {
    id: "ex_dead_hang",
    name: "Dead Hang",
    category: "strength",
    targetMuscles: ["forearms", "latissimus dorsi", "shoulders"],
    equipment: ["pull_up_bar"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Hanging from a bar builds grip strength and decompresses the shoulders.",
    instructions: [
      "Grip the bar slightly wider than your shoulders and hang with arms straight.",
      "Keep your shoulders engaged (not shrugged up to your ears) and breathe."
    ],
    stress: ["shoulder", "elbow"],
    timed: true,
  },
  {
    id: "ex_barbell_squat",
    name: "Barbell Back Squat",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "hamstrings", "core"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "The foundational loaded squat for lower-body strength.",
    instructions: [
      "Rest the bar across your upper back, brace your core and unrack.",
      "Sit down and back until thighs are at least parallel, then drive up through your whole foot."
    ],
    beginnerAlternative: "Goblet squat",
    stress: ["knee", "back"],
  },
  {
    id: "ex_barbell_bench",
    name: "Barbell Bench Press",
    category: "strength",
    targetMuscles: ["chest", "triceps", "anterior deltoids"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Classic horizontal press for upper-body strength; use a spotter or safety arms.",
    instructions: [
      "Lie with eyes under the bar, feet planted and shoulder blades pinched together.",
      "Lower the bar to your mid-chest, then press it back up over your shoulders."
    ],
    beginnerAlternative: "Dumbbell floor press",
    stress: ["shoulder", "wrist"],
  },
  {
    id: "ex_barbell_deadlift",
    name: "Barbell Deadlift",
    category: "strength",
    targetMuscles: ["hamstrings", "glutes", "erector spinae", "latissimus dorsi"],
    equipment: ["barbell"],
    difficulty: "advanced",
    trackable: false,
    trackingMode: "manual",
    description: "Full posterior-chain lift; technique matters more than load.",
    instructions: [
      "Stand with the bar over midfoot, hinge down and grip just outside your knees.",
      "Brace, push the floor away and stand tall, then lower the bar with control."
    ],
    beginnerAlternative: "Dumbbell Romanian deadlift",
    stress: ["back"],
  },
  {
    id: "ex_barbell_row",
    name: "Barbell Bent-Over Row",
    category: "strength",
    targetMuscles: ["latissimus dorsi", "rhomboids", "rear deltoids", "biceps"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    trackable: false,
    trackingMode: "manual",
    description: "Heavy horizontal pull for a strong, thick back.",
    instructions: [
      "Hinge to about 45 degrees with a flat back, bar hanging at arm's length.",
      "Row the bar to your lower ribs, squeeze, and lower under control."
    ],
    stress: ["back"],
  },

  // ── Gym machines (available with "Full Commercial Gym") ───────────────────
  {
    id: "ex_lat_pulldown",
    name: "Lat Pulldown",
    category: "strength",
    targetMuscles: ["latissimus dorsi", "biceps", "rear deltoids"],
    equipment: ["gym_machines"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Machine version of the pull-up, easy to scale to any strength level.",
    instructions: [
      "Sit with thighs secured and grip the bar just wider than your shoulders.",
      "Pull the bar to your upper chest, elbows down, then return slowly."
    ],
    stress: ["shoulder"],
  },
  {
    id: "ex_leg_press",
    name: "Leg Press",
    category: "strength",
    targetMuscles: ["quadriceps", "glutes", "hamstrings"],
    equipment: ["gym_machines"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Supported lower-body press that lets you load the legs without loading the spine.",
    instructions: [
      "Place feet shoulder-width on the platform with your lower back flat on the pad.",
      "Lower until knees are near 90 degrees, then press without locking your knees."
    ],
    stress: ["knee"],
  },
  {
    id: "ex_stationary_bike",
    name: "Stationary Bike",
    category: "cardio",
    targetMuscles: ["quadriceps", "calves", "cardiovascular"],
    equipment: ["gym_machines"],
    difficulty: "beginner",
    trackable: false,
    trackingMode: "manual",
    description: "Low-impact cardio that is kind to knees and ankles.",
    instructions: [
      "Set the saddle so your knee is slightly bent at the bottom of the pedal stroke.",
      "Pedal at a steady, conversational effort."
    ],
    timed: true,
  },
];

export const CATALOG_ID_MAP = new Map(EXERCISE_CATALOG.map((ex) => [ex.id, ex]));

export function getExerciseById(id: string): CatalogExercise | undefined {
  return CATALOG_ID_MAP.get(id);
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

const DIFFICULTY_RANK: Record<ExperienceLevel, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export function difficultyRank(level: ExperienceLevel): number {
  return DIFFICULTY_RANK[level];
}

/** Which body areas a free-text limitation refers to ("bad knees", "lower back pain", "no overhead press"). */
const STRESS_PATTERNS: [JointStress, RegExp][] = [
  ["knee", /\b(knee|knees|acl|mcl|meniscus|patell\w*)\b/],
  ["back", /\b(back|spine|spinal|disc|discs|sciatica|lumbar|herniat\w*|slipped)\b/],
  ["shoulder", /\b(shoulder|shoulders|rotator|impingement)\b/],
  ["wrist", /\b(wrist|wrists|carpal)\b/],
  ["ankle", /\b(ankle|ankles|achilles|plantar)\b/],
  ["hip", /\b(hip|hips)\b/],
  ["neck", /\b(neck|cervical)\b/],
  ["elbow", /\b(elbow|elbows|tennis)\b/],
  ["overhead", /\boverhead\b/],
  ["impact", /\b(jump|jumping|impact|plyo|plyometric|cardiac|heart|blood pressure|hypertension|pregnan\w*|osteoporosis)\b/],
];

/** Words that describe the problem rather than name a movement. */
const FILLER_WORDS = new Set([
  "avoid", "no", "not", "dont", "don", "t", "pain", "painful", "injury", "injured", "problem", "problems",
  "issue", "issues", "bad", "weak", "chronic", "surgery", "my", "with", "and", "the", "any", "exercise",
  "exercises", "movement", "movements", "sore", "tight", "hurts", "hurt", "i", "have", "a", "an", "of", "on",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface ParsedExclusions {
  stress: Set<JointStress>;
  /** Movement or muscle names to avoid, squeezed (no spaces) and singularised, e.g. "pushup", "squat". */
  terms: string[];
}

/**
 * Turns the user's limitations / avoid list into body-area tags and movement names. A phrase that names a body
 * area ("knee pain") excludes exercises tagged as stressing it; any other phrase ("push-ups", "chest") is matched
 * against exercise names and target muscles. Blank entries are ignored — an empty string would otherwise match
 * *every* exercise.
 */
export function parseExclusions(phrases: string[]): ParsedExclusions {
  const stress = new Set<JointStress>();
  const terms: string[] = [];

  for (const phrase of phrases) {
    const normalized = normalizeText(phrase);
    if (!normalized) continue;

    let matchedArea = false;
    for (const [area, pattern] of STRESS_PATTERNS) {
      if (pattern.test(normalized)) {
        stress.add(area);
        matchedArea = true;
      }
    }
    if (matchedArea) continue;

    const movement = normalized
      .split(" ")
      .filter((w) => !FILLER_WORDS.has(w))
      .join("");
    const singular = movement.replace(/s$/, "");
    if (singular.length >= 3) terms.push(singular);
  }

  return { stress, terms };
}

export function isExcluded(ex: CatalogExercise, exclusions: ParsedExclusions): boolean {
  if (ex.stress?.some((area) => exclusions.stress.has(area))) return true;
  if (exclusions.terms.length === 0) return false;

  const name = normalizeText(ex.name).replace(/ /g, "");
  const muscles = ex.targetMuscles.map((m) => normalizeText(m).replace(/ /g, ""));
  return exclusions.terms.some((term) => name.includes(term) || muscles.some((m) => m.includes(term)));
}

export function hasRequiredEquipment(ex: CatalogExercise, userEquipment: Equipment[]): boolean {
  const owned = new Set(userEquipment);
  if (owned.has("full_gym")) return true;
  // Any ONE of the listed items is enough; "none" means no equipment is needed at all.
  return ex.equipment.some((eq) => eq === "none" || owned.has(eq));
}

export interface EligibilityOptions {
  /** Extra phrases treated like the avoid list (the UI sends the same text as both). */
  limitations?: string[];
  /** Hide exercises harder than this level. */
  maxDifficulty?: ExperienceLevel;
}

/**
 * Filter exercises appropriate for the user's equipment, limitations and avoided movements.
 */
export function filterEligibleExercises(
  userEquipment: Equipment[],
  avoidList: string[] = [],
  options: EligibilityOptions = {}
): CatalogExercise[] {
  const exclusions = parseExclusions([...avoidList, ...(options.limitations ?? [])]);
  const maxRank = options.maxDifficulty ? DIFFICULTY_RANK[options.maxDifficulty] : Infinity;

  return EXERCISE_CATALOG.filter(
    (ex) =>
      hasRequiredEquipment(ex, userEquipment) &&
      !isExcluded(ex, exclusions) &&
      DIFFICULTY_RANK[ex.difficulty] <= maxRank
  );
}
