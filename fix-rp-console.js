// Paste this into the browser console while on your gym-tracker app, signed in.
// It overwrites your RP data in Firebase to match rp.js. Nippard is not touched.

(async function fixRpInFirebase() {
  if (typeof firebase === "undefined") {
    console.error("Firebase not loaded. Open your gym-tracker app first.");
    return;
  }
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error("Not signed in. Sign in first.");
    return;
  }
  const tpl = (window.PROGRAM_TEMPLATES || []).find(t => t && t.id === "rp_5day_12w");
  if (!tpl || !tpl.program) {
    console.error("RP template not found. Make sure rp.js is loaded.");
    return;
  }
  const program = JSON.parse(JSON.stringify(tpl.program));
  for (const wk of Object.keys(program)) {
    const weekObj = program[wk] || {};
    for (const dy of Object.keys(weekObj)) {
      const arr = weekObj[dy] || [];
      arr.forEach((ex, idx) => {
        ex.order = idx;
      });
    }
  }
  const catalog = {
    list: tpl.exerciseList || tpl.catalog?.list || [],
    map: tpl.exerciseMap || tpl.catalog?.map || {},
  };
  const newRpData = { program, logs: {}, week: 1, day: "Monday", catalog };
  try {
    const db = firebase.firestore();
    await db.collection("users").doc(user.uid).update({
      "templates.rp_5day_12w": newRpData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    console.log("RP in Firebase now matches rp.js. Refresh the page to see it.");
  } catch (e) {
    console.error("Fix failed:", e);
  }
})();
