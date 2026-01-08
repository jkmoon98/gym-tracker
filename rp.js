// rp.js
// Plain JS file loaded via <script src="/rp.js"></script>
// No imports/exports.

(() => {
  // 1) Define the RP "week"
  const RP_WEEK = {
    Monday: [
      { id: "rp_pullups", name: "Pull-Ups", sets: "3", reps: "12", defaultWorking: 3, alternatives: [] },
      { id: "rp_pulldown", name: "Lat Pulldown", sets: "3", reps: "12", defaultWorking: 3, alternatives: [] },
      { id: "rp_incline_bar_press", name: "Incline Barbell Press", sets: "3", reps: "12", defaultWorking: 3, alternatives: [] },
      { id: "rp_incline_db_press", name: "Incline DB Press", sets: "3", reps: "12", defaultWorking: 3, alternatives: [] },
      { id: "rp_hanging_leg_raise", name: "Hanging Leg Raise (Flagstaff)", sets: "3", reps: "15-20", defaultWorking: 3, alternatives: [] },
    ],

    Tuesday: [
      { id: "rp_ez_skull_crushers", name: "EZ-Bar Skull Crushers", sets: "2", reps: "15-20", defaultWorking: 2, alternatives: [] },
      { id: "rp_overhead_ez_extension", name: "Overhead EZ Extension", sets: "2", reps: "10-20", defaultWorking: 2, alternatives: [] },

      { id: "rp_db_lateral_raise", name: "DB Lateral Raise", sets: "4", reps: "12", defaultWorking: 4, alternatives: [] },
      { id: "rp_cable_lateral_raise", name: "Cable Lateral Raise", sets: "3", reps: "15-20", defaultWorking: 3, alternatives: [] },

      { id: "rp_barbell_curl", name: "Barbell Curl", sets: "5", reps: "10-15", defaultWorking: 5, alternatives: [] },
      { id: "rp_bar_wrist_curl", name: "Bar Wrist Curl", sets: "1", reps: "60", defaultWorking: 1, alternatives: [] }, // reps progression note below
    ],

    Wednesday: [
      { id: "rp_incline_wide_grip_press", name: "Incline Wide-Grip Press", sets: "3", reps: "8-12", defaultWorking: 3, alternatives: [] },
      { id: "rp_incline_machine_press", name: "Incline Machine Press", sets: "3", reps: "8-12", defaultWorking: 3, alternatives: [] },
      { id: "rp_underhand_lat_pulldown", name: "Underhand Lat Pulldown", sets: "3", reps: "10-15", defaultWorking: 3, alternatives: [] },
      { id: "rp_straight_arm_pulldown", name: "Straight-Arm Pulldown", sets: "3", reps: "15-20", defaultWorking: 3, alternatives: [] },
      { id: "rp_cable_crunch", name: "Cable Crunch", sets: "3", reps: "12", defaultWorking: 3, alternatives: [] },
    ],

    Thursday: [
      { id: "rp_ez_bar_curl", name: "EZ-Bar Curl", sets: "3-4", reps: "5-10", defaultWorking: 3, alternatives: [] },
      { id: "rp_cable_curl", name: "Cable Curl", sets: "3-4", reps: "10-15", defaultWorking: 3, alternatives: [] },

      { id: "rp_machine_laterals", name: "Machine Lateral Raise", sets: "3-4", reps: "10-15", defaultWorking: 3, alternatives: [] },
      { id: "rp_seated_db_laterals", name: "Seated DB Lateral Raise", sets: "3-4", reps: "15-20", defaultWorking: 3, alternatives: [] },

      { id: "rp_inverted_bar_skull_crushers", name: "Inverted Bar Skull Crushers", sets: "3-4", reps: "20-25", defaultWorking: 3, alternatives: [] },
      { id: "rp_forearm_pushup", name: "Forearm Push-Up", sets: "1", reps: "50-60", defaultWorking: 1, alternatives: [] },
    ],

    Friday: [
      { id: "rp_lying_leg_curl", name: "Lying Leg Curl", sets: "2", reps: "8-10", defaultWorking: 2, alternatives: [] },
      { id: "rp_squat", name: "Squat", sets: "3", reps: "6-8", defaultWorking: 3, alternatives: [] },
      { id: "rp_barbell_rdl", name: "Barbell RDL", sets: "3", reps: "6-8", defaultWorking: 3, alternatives: [] },
      { id: "rp_leg_extension_sissy", name: "Leg Extension (Sissy Squats)", sets: "2", reps: "8-10", defaultWorking: 2, alternatives: [] },
      { id: "rp_standing_calf_raise", name: "Standing Calf Raise", sets: "1", reps: "60", defaultWorking: 1, alternatives: [] },
      { id: "rp_ab_roller", name: "Ab Roller", sets: "3", reps: "10-15", defaultWorking: 3, alternatives: [] },
    ],
  };

  // 2) Normalize into your app's "week-based" shape (12 weeks)
  // IMPORTANT: deep-clone so editing one week won't mutate the others.
  const cloneWeek = () => JSON.parse(JSON.stringify(RP_WEEK));

  const RP_PROGRAM = {};
  for (let w = 1; w <= 12; w++) {
    RP_PROGRAM[String(w)] = cloneWeek();
  }

  // 3) Build exerciseList + exerciseMap from the week data
  const allExercises = [];
  Object.values(RP_WEEK).forEach(dayArr => {
    dayArr.forEach(ex => allExercises.push(ex));
  });

  const RP_EXERCISE_LIST = Array.from(new Set(allExercises.map(e => e.name))).sort();

  const RP_EXERCISE_MAP = {};
  allExercises.forEach(e => {
    // If same name appears multiple days, keep first definition
    if (!RP_EXERCISE_MAP[e.name]) {
      RP_EXERCISE_MAP[e.name] = {
        sets: e.sets,
        reps: e.reps,
        alternatives: e.alternatives || [],
        defaultWorking: typeof e.defaultWorking === "number" ? e.defaultWorking : 0,
      };
    }
  });

  // 4) Register template
  window.PROGRAM_TEMPLATES ||= [];
  window.PROGRAM_TEMPLATES.push({
    id: "rp_5day_12w",
    name: "RP (5-Day, 12 Weeks)",
    program: RP_PROGRAM,
    exerciseList: RP_EXERCISE_LIST,
    exerciseMap: RP_EXERCISE_MAP,
    meta: {
      notes: [
        "Bar Wrist Curl: reps start at 60, add +10 reps each time.",
        "Inverted Bar Skull Crushers: add +5-10 reps every week.",
        "This template repeats the same weekly layout for weeks 1–12 (edit any week after choosing it).",
      ],
    },
  });
})();
