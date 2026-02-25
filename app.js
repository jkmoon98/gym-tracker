    const { useEffect, useRef, useState, useMemo, useCallback, memo } = React;
    // ----------------------------
    // Firebase (optional) setup
    // 1) Create a Firebase project at https://console.firebase.google.com
    // 2) Add a "Web app" and copy the config below
    // 3) Enable Authentication -> Google
    // 4) Create Firestore Database (in production mode is fine)
    //
    // Safe API practice: Do NOT commit real keys. Use one of:
    // 1) Load a gitignored script that sets window.__FIREBASE_CONFIG__ (see firebase.config.example.js)
    // 2) Leave apiKey as "REPLACE_ME" for local-only mode (no cloud sync).
    const FIREBASE_CONFIG = (typeof window !== "undefined" && window.__FIREBASE_CONFIG__) || {
      apiKey: "REPLACE_ME",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project",
      storageBucket: "your-project.firebasestorage.app",
      messagingSenderId: "",
      appId: ""
    };

    const firebaseReady = () =>
      typeof window !== "undefined" &&
      window.firebase &&
      FIREBASE_CONFIG &&
      FIREBASE_CONFIG.apiKey &&
      FIREBASE_CONFIG.apiKey !== "REPLACE_ME";

    const initFirebase = () => {
      if (!firebaseReady()) return { app: null, auth: null, db: null };
      try {
        // Avoid "already exists" errors if hot-reloading or re-running.
        const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
        const auth = firebase.auth();
        const db = firebase.firestore();
        return { app, auth, db };
      } catch (e) {
        console.warn("Firebase init failed:", e);
        return { app: null, auth: null, db: null };
      }
    };

    // --- Ensure SheetJS is loaded before export ---
    // --- Simple download helper (for CSV fallback) ---
const downloadTextFile = (filename, text, mime = "text/plain") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const toCSV = (rows) => {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
};

// --- Ensure SheetJS is loaded before export ---
const ensureXLSX = () =>
  new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);

    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js";
    s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX failed to load")));
    s.onerror = () => reject(new Error("Could not load XLSX (blocked/offline?)"));
    document.head.appendChild(s);
  });


// ----- Prefilled program + exercise catalog (from your uploaded Excel) -----
   

    // ---------- Icons (inline SVG) ----------
    const Icon = ({ children, className = "" }) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className={className}>
        {children}
      </svg>
    );
    const ChevronDown = (p) => <Icon className={p.className}><polyline points="6 9 12 15 18 9" /></Icon>;
    const ChevronUp   = (p) => <Icon className={p.className}><polyline points="18 15 12 9 6 15" /></Icon>;
    const Trash2      = (p) => <Icon className={p.className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Icon>;
    const Plus = (p) => <Icon className={p.className}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>;
    const GripVertical = (p) => <Icon className={p.className}>
      <circle cx="9" cy="12" r="1"></circle>
      <circle cx="9" cy="5" r="1"></circle>
      <circle cx="9" cy="19" r="1"></circle>
      <circle cx="15" cy="12" r="1"></circle>
      <circle cx="15" cy="5" r="1"></circle>
      <circle cx="15" cy="19" r="1"></circle>
    </Icon>;

    // Fully memoized input that only re-renders when switching rows/exercises  
    const SimpleInput = memo(({ value, onChange, placeholder, className, inputKey }) => {
      const [localValue, setLocalValue] = useState(value || "");
      const onChangeRef = useRef(onChange);
      const prevInputKeyRef = useRef(inputKey);
      const valueRef = useRef(value);
      
      // Keep value ref updated
      valueRef.current = value;
      
      // Update callback ref (doesn't cause re-render)
      onChangeRef.current = onChange;
      
      // Sync local value when inputKey changes (switching rows) or value changes (e.g. "Use last week")
      useEffect(() => {
        if (prevInputKeyRef.current !== inputKey) prevInputKeyRef.current = inputKey;
        setLocalValue(valueRef.current ?? "");
      }, [inputKey, value]);
      
      return (
        <input
          className={className}
          placeholder={placeholder}
          value={localValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setLocalValue(newValue);
            onChangeRef.current(newValue);
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          autoComplete="off"
        />
      );
    }, (prev, next) => {
      return prev.inputKey === next.inputKey && prev.value === next.value;
    });

    // Memoized row to prevent re-renders
    const SetRow = memo(({ row, bucket, setRowField, deleteRow, ex }) => {
      const isWarmup = bucket === "warmup";
      
      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className={`w-10 text-center text-xs font-semibold rounded-md py-2 ${isWarmup ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
            {row.label}
          </div>
          <SimpleInput
            inputKey={`${row.id}-weight`}
            className="flex-1 border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Weight"
            value={row.weight}
            onChange={(val) => setRowField(ex, bucket, row.id, "weight", val)}
          />
          <SimpleInput
            inputKey={`${row.id}-reps`}
            className="flex-1 border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Reps"
            value={row.reps}
            onChange={(val) => setRowField(ex, bucket, row.id, "reps", val)}
          />
          <button 
            className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
            onClick={() => deleteRow(ex, bucket, row.id)}
            title={`Delete ${isWarmup ? 'warm-up' : 'working'} set`}>
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      );
    }, (prev, next) => {
      const shouldBlock = prev.row.id === next.row.id && 
             prev.row.weight === next.row.weight && 
             prev.row.reps === next.row.reps &&
             prev.row.label === next.row.label;
      
      return shouldBlock;
    });

    const Home = (p) => <Icon className={p.className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </Icon>;
    const ListOrdered = (p) => <Icon className={p.className}>
      <line x1="10" y1="6" x2="21" y2="6"></line>
      <line x1="10" y1="12" x2="21" y2="12"></line>
      <line x1="10" y1="18" x2="21" y2="18"></line>
      <path d="M4 6h1v4"></path>
      <path d="M4 10h2"></path>
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>
    </Icon>;
    const Calendar = (p) => <Icon className={p.className}>
      <rect x="3" y="4" width="18" height="18" rx="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </Icon>;
    const Database = (p) => <Icon className={p.className}>
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </Icon>;

    // ---------- Constants ----------
    const STORAGE_KEY_BASE = "gymTracker_prefilled_from_excel_v1";
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);
    const WORKOUT_TYPES = {
      Monday: "Upper Strength (Focus)",
      Tuesday: "Lower Strength (Focus)",
      Wednesday: "Pull (Hypertrophy Focus)",
      Thursday: "Push (Hypertrophy Focus)",
      Friday: "Legs (Hypertrophy Focus)",
    };

    const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const makeRow = (label) => ({ id: uuid(), label, weight: "", reps: "" });
    const makeEmptyExerciseLog = (defaultWorking = 2) => ({
      selectedAlt: "",
      customAlt: "",
      warmup: [makeRow("W1"), makeRow("W2"), makeRow("W3")],
      working: Array.from({ length: defaultWorking }, (_, i) => makeRow(String(i + 1))),
      notes: "",
      savedAt: null,
    });

    // logs[week][day][exerciseId] = exerciseLog
    const ensureLogPath = (logs, week, day, exId, defaultWorking) => {
      const next = structuredClone(logs || {});
      if (!next[week]) next[week] = {};
      if (!next[week][day]) next[week][day] = {};
      if (!next[week][day][exId]) next[week][day][exId] = makeEmptyExerciseLog(defaultWorking);
      return next;
    };

    // ---------- Excel export/import ----------
    const exportToExcel = async ({ program, logs }) => {
      // If XLSX can't load (adblock / no internet), we fall back to CSV exports.
      const cleanProgram = JSON.parse(JSON.stringify(program || {}));
      const cleanLogs = JSON.parse(JSON.stringify(logs || {}));

      const rowsProgram = [];
      for (let w = 1; w <= 12; w++) {
        for (const d of DAYS) {
          for (const ex of (cleanProgram?.[w]?.[d] || [])) {
            rowsProgram.push({
              Week: w,
              Day: d,
              ExerciseId: ex.id,
              Exercise: ex.name,
              Sets: ex.sets || "",
              Reps: ex.reps || "",
              DefaultWorking: ex.defaultWorking ?? 2,
              Alternatives: (ex.alternatives || []).join("|"),
            });
          }
        }
      }

      const rowsLogs = [];
      for (const wStr of Object.keys(cleanLogs || {})) {
        const w = Number(wStr);
        for (const d of Object.keys(cleanLogs[w] || {})) {
          for (const exId of Object.keys(cleanLogs[w][d] || {})) {
            const entry = cleanLogs[w][d][exId];
            const note = entry.notes || "";
            for (const r of (entry.warmup || [])) {
              rowsLogs.push({
                Week: w, Day: d, ExerciseId: exId,
                SetType: "warmup", Set: r.label, Weight: r.weight, Reps: r.reps, Notes: note
              });
            }
            for (const r of (entry.working || [])) {
              rowsLogs.push({
                Week: w, Day: d, ExerciseId: exId,
                SetType: "working", Set: r.label, Weight: r.weight, Reps: r.reps, Notes: note
              });
            }
          }
        }
      }

      try {
        const XLSX = await ensureXLSX();
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsProgram), "Program");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsLogs), "Logs");
        XLSX.writeFile(wb, "gym-tracker-export.xlsx");
      } catch (e) {
        console.warn("XLSX export failed, using CSV fallback:", e);
        downloadTextFile("gym-tracker-program.csv", toCSV(rowsProgram), "text/csv");
        downloadTextFile("gym-tracker-logs.csv", toCSV(rowsLogs), "text/csv");
        alert("Couldn't load the Excel library (maybe adblock). Exported CSV files instead.");
      }
    };

    const importFromExcel = (file, onLoaded, onError) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });

          const program = structuredClone(PREFILLED_PROGRAM);
          const logs = {};

          const wsProgram = wb.Sheets["Program"];
          if (wsProgram) {
            const fresh = {};
            for (let w = 1; w <= 12; w++) {
              fresh[w] = {};
              for (const d of DAYS) fresh[w][d] = [];
            }

            const rows = XLSX.utils.sheet_to_json(wsProgram, { defval: "" });
            for (const r of rows) {
              const w = Number(r.Week);
              const d = String(r.Day || "");
              if (!w || w < 1 || w > 12 || !DAYS.includes(d)) continue;
              const name = String(r.Exercise || r.ExerciseName || "").trim();
              if (!name) continue;
              const ex = {
                id: String(r.ExerciseId || uuid()),
                name,
                sets: String(r.Sets || ""),
                reps: String(r.Reps || ""),
                defaultWorking: Number(r.DefaultWorking || 2),
                alternatives: String(r.Alternatives || "").split("|").map(s => s.trim()).filter(Boolean),
              };
              fresh[w][d].push(ex);
            }

            for (let w = 1; w <= 12; w++) program[w] = fresh[w];
          }

          const wsLogs = wb.Sheets["Logs"];
          if (wsLogs) {
            const rows = XLSX.utils.sheet_to_json(wsLogs, { defval: "" });
            for (const r of rows) {
              const w = Number(r.Week);
              const d = String(r.Day || "");
              const exId = String(r.ExerciseId || "");
              if (!w || w < 1 || w > 12 || !DAYS.includes(d) || !exId) continue;

              if (!logs[w]) logs[w] = {};
              if (!logs[w][d]) logs[w][d] = {};
              if (!logs[w][d][exId]) logs[w][d][exId] = makeEmptyExerciseLog(2);

              const entry = logs[w][d][exId];
              entry.selectedAlt = String(r.Alt || "");
              entry.notes = String(r.Notes || "");

              const type = String(r.SetType || "").toLowerCase();
              const label = String(r.Set || r.SetLabel || "");
              if (!type || !label) continue;

              const rowObj = { id: uuid(), label, weight: String(r.Weight || ""), reps: String(r.Reps || "") };
              if (type === "warmup") entry.warmup.push(rowObj);
              if (type === "working") entry.working.push(rowObj);
            }

            for (const wStr of Object.keys(logs)) {
              const w = Number(wStr);
              for (const d of Object.keys(logs[w] || {})) {
                for (const exId of Object.keys(logs[w][d] || {})) {
                  const entry = logs[w][d][exId];
                  entry.warmup = (entry.warmup || []).filter(r => (r.weight || r.reps || r.label));
                  entry.working = (entry.working || []).filter(r => (r.weight || r.reps || r.label));
                  if (entry.warmup.length === 0) entry.warmup = [makeRow("W1"), makeRow("W2"), makeRow("W3")];
                  if (entry.working.length === 0) entry.working = [makeRow("1"), makeRow("2")];
                  entry.working = entry.working.map((r, i) => ({ ...r, label: String(i + 1) }));
                }
              }
            }
          }

          onLoaded({ program, logs });
        } catch (err) {
          onError(err);
        }
      };
      reader.onerror = () => onError(new Error("Failed reading file."));
      reader.readAsArrayBuffer(file);
    };

    
    
    // Build a stable "template snapshot" from the original program (the Excel/XML import),
    // keyed by exercise id. This is used to keep template values consistent even if you
    // reorder, edit, or otherwise modify the exercise later.
    const TEMPLATE_BY_ID = (() => {
      const map = {};
      try {
        for (const wk of Object.keys(PREFILLED_PROGRAM || {})) {
          const weekObj = PREFILLED_PROGRAM[wk] || {};
          for (const dy of Object.keys(weekObj || {})) {
            const arr = weekObj[dy] || [];
            for (const ex of arr) {
              if (!ex || !ex.id) continue;
              // First occurrence wins (keeps it stable if duplicates exist)
              if (map[ex.id]) continue;
              map[ex.id] = {
                name: ex.name ?? '',
                alternatives: (() => {
                  const raw = (ex.templateAlternatives !== undefined ? ex.templateAlternatives : ex.alternatives);
                  const alts = Array.isArray(raw) ? raw.slice() : (typeof raw === 'string' ? raw.split(/[,;/]/) : []);
                  const main = (ex.name ?? '').trim();
                  return alts
                    .map(a => (typeof a === 'string' ? a.trim() : String(a ?? '').trim()))
                    .filter(a => a.length)
                    // Guard: template alternates should never include the main exercise name
                    .filter(a => !main || a !== main);
                })(),
                sets: ex.sets ?? '',
                reps: ex.reps ?? '',
              };
            }
          }
        }
      } catch (e) {
        console.warn("Template map build failed:", e);
      }
      return map;
    })();

    // Ensure we never "forget" the original (Excel/template) exercise + alternates,
    // and ensure each exercise has a stable 'order' field for reordering.
    const ensureExerciseMeta = (prog) => {
      const next = structuredClone(prog || {});
      for (const wk of Object.keys(next)) {
        const weekObj = next[wk] || {};
        for (const dy of Object.keys(weekObj)) {
          const arr = weekObj[dy] || [];
          arr.forEach((ex, idx) => {
            if (ex.templateName === undefined) ex.templateName = (TEMPLATE_BY_ID[ex.id]?.name ?? ex.name ?? '-');
            if (ex.templateAlternatives === undefined) ex.templateAlternatives = (Array.isArray(TEMPLATE_BY_ID[ex.id]?.alternatives) ? TEMPLATE_BY_ID[ex.id].alternatives.slice() : (Array.isArray(ex.alternatives) ? ex.alternatives.slice() : []));
            if (ex.templateSets === undefined) ex.templateSets = (TEMPLATE_BY_ID[ex.id]?.sets ?? ex.sets ?? '-');
            if (ex.templateReps === undefined) ex.templateReps = (TEMPLATE_BY_ID[ex.id]?.reps ?? ex.reps ?? '-');
            if (ex.order === undefined || ex.order === null) ex.order = idx;
          });
        }
      }
      return next;
    };

    const namesMatch = (a, b) => (String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase());
    const getFromExerciseMap = (map, name) => {
      const n = String(name || "").trim().toLowerCase();
      const k = Object.keys(map || {}).find(x => String(x || "").trim().toLowerCase() === n);
      return k != null ? map[k] : undefined;
    };
    const exerciseListHas = (list, name) => (list || []).some(x => namesMatch(x, name));
    const exerciseListFind = (list, name) => (list || []).find(x => namesMatch(x, name));

const normalizeOrderEverywhere = (prog) => {
  const next = structuredClone(prog || {});
  for (const wk of Object.keys(next)) {
    const weekObj = next[wk] || {};
    for (const dy of Object.keys(weekObj)) {
      const arr = weekObj[dy] || [];

      const seen = new Set();
      let needsFix = false;

      for (const ex of arr) {
        const o = ex.order;
        if (typeof o !== "number" || seen.has(o)) {
          needsFix = true;
          break;
        }
        seen.add(o);
      }

      if (needsFix) {
        // Preserve current array order as the source of truth once, then lock in
        arr.forEach((ex, idx) => (ex.order = idx));
      }
    }
  }
  return next;
};



const App = () => {
      const [view, setView] = useState("current"); // current | weeks | day | data
      const [week, setWeek] = useState(1);
      const [day, setDay] = useState("Monday");
      const [expandedExId, setExpandedExId] = useState(null);
      const [draggedExId, setDraggedExId] = useState(null);
      const [dragOverExId, setDragOverExId] = useState(null);
      
      // Cache for empty exercise logs (prevents creating new rows with new IDs on every render)
      const emptyLogCache = useRef({});
      const [dirtyByExId, setDirtyByExId] = useState({});
      const [altDraftById, setAltDraftById] = useState({});
      const [orderDraftByKey, setOrderDraftByKey] = useState({});

const TEMPLATES = Array.isArray(window.PROGRAM_TEMPLATES) ? window.PROGRAM_TEMPLATES : [];
const INITIAL_TEMPLATE_ID = window.DEFAULT_TEMPLATE_ID || (TEMPLATES[0] && TEMPLATES[0].id) || "nippard_ppl";
const TEMPLATE_ID_KEY = "gymTracker_activeTemplateId";

const [templateId, setTemplateId] = useState(() => {
  try {
    return localStorage.getItem(TEMPLATE_ID_KEY) || INITIAL_TEMPLATE_ID;
  } catch {
    return INITIAL_TEMPLATE_ID;
  }
});
useEffect(() => {
  try { localStorage.setItem(TEMPLATE_ID_KEY, templateId); } catch {}
}, [templateId]);

const getTemplateById = useCallback((id) => {
  const list = Array.isArray(window.PROGRAM_TEMPLATES) ? window.PROGRAM_TEMPLATES : [];
  return list.find(t => t && t.id === id) || list[0] || null;
}, []);

// Get template exercise for current week/day by name (so Target Sets/Reps match template, not global catalog).
const getTemplateExerciseForDay = useCallback((templateId, week, day, exerciseName) => {
  const t = getTemplateById(templateId);
  const arr = t?.program?.[week]?.[day];
  if (!Array.isArray(arr)) return null;
  const n = String(exerciseName || "").trim().toLowerCase();
  return arr.find(e => e && String(e.name || "").trim().toLowerCase() === n) || null;
}, [getTemplateById]);


const getTemplateNameById = useCallback((id) => {
  const list = Array.isArray(window.PROGRAM_TEMPLATES) ? window.PROGRAM_TEMPLATES : [];
  return list.find(t => t && t.id === id)?.name || "Workout";
}, []);


const getGuestProgram = useCallback((id) => {
  const t = getTemplateById(id || (window.DEFAULT_TEMPLATE_ID || ""));
  return ensureExerciseMeta((t && t.program) ? t.program : PREFILLED_PROGRAM);
}, [getTemplateById]);

            const [recentlyMovedId, setRecentlyMovedId] = useState(null);

      // --- Auth + per-user storage key + cloud sync (Firestore) ---
      const [user, setUser] = useState(null);
      const [cloudStatus, setCloudStatus] = useState("local"); // local | syncing | synced | error
      const [isCloudLoading, setIsCloudLoading] = useState(false); // true until first Firestore load completes (signed-in only)
const hydratedRef = useRef(false);
      const loadSucceededRef = useRef(false); // true only when cloud load succeeded; prevents sync overwriting on load failure 
// true after we load from Firestore for this user (prevents overwriting cloud with defaults)

const loadedTemplateIdRef = useRef(null); 
// which template is currently loaded into state (logged-in mode)

const applyingRemoteRef = useRef(false); 
// prevents save-loop when applying remote state


      // Compute a per-user localStorage key so two accounts don't overwrite each other on the same device.
      const STORAGE_KEY = useMemo(
        () => `${STORAGE_KEY_BASE}_${user?.uid || "local"}`,
        [user]
      );

      // One-time Firebase init + auth listener
      useEffect(() => {
        if (!firebaseReady()) return;
        const { auth } = initFirebase();
        if (!auth) return;

        // Handle redirect sign-in results (mobile-friendly)
        auth.getRedirectResult().catch(() => {});

        const unsub = auth.onAuthStateChanged((u) => {
          setUser(u || null);
        });
        return () => unsub && unsub();
      }, []);


      const cloudSyncTimerRef = useRef(null);
      const lastCloudJsonRef = useRef("");

      const pushToCloudDebounced = useCallback((stateObj) => {
        if (!firebaseReady() || !user) return;
        if (!loadSucceededRef.current) return; // don't overwrite cloud when load failed
        const { db } = initFirebase();
        if (!db) return;

        // We store progress per-template so Nippard and RP have separate logs/state.
        const activeId = stateObj?.templateId || templateId;

        const templateData = {
          program: stateObj.program,
          logs: stateObj.logs,
          week: stateObj.week,
          day: stateObj.day,
          catalog: stateObj.catalog || null,
        };

        const json = JSON.stringify({ activeTemplateId: activeId, templates: { [activeId]: templateData } });
        if (json === lastCloudJsonRef.current) return;

        if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
        cloudSyncTimerRef.current = setTimeout(async () => {
          try {
            setCloudStatus("syncing");
            const docRef = db.collection("users").doc(user.uid);
            try {
              await docRef.update({
                activeTemplateId: activeId,
                ["templates." + activeId]: templateData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
            } catch (updateErr) {
              if (updateErr?.code === "not-found" || updateErr?.message?.includes("NOT_FOUND")) {
                await docRef.set(
                  {
                    activeTemplateId: activeId,
                    templates: { [activeId]: templateData },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
              } else throw updateErr;
            }
            lastCloudJsonRef.current = json;

            // Update baseline for Discard/dirty tracking (workout state only)
            try {
              savedJsonRef.current = JSON.stringify({
                program: stateObj.program ?? (getTemplateById(activeId)?.program || PREFILLED_PROGRAM),
                logs: stateObj.logs ?? {},
                week: typeof stateObj.week === "number" ? stateObj.week : 1,
                day: typeof stateObj.day === "string" ? stateObj.day : "Monday",
              });
            } catch {}
            setCloudStatus("synced");
          } catch (e) {
            console.warn("Cloud sync failed:", e);
            setCloudStatus("error");
          }
        }, 1200);
      }, [user, templateId, getTemplateById]);
// Prevent accidental double-taps in Android WebView
      const lastTapRef = useRef(0);
      const safeTap = (e, fn) => {
        try { e?.stopPropagation?.(); } catch {}
        const now = Date.now();
        if (now - lastTapRef.current < 180) return;
        lastTapRef.current = now;
        fn();
      };

      const [program, setProgram] = useState(() => getGuestProgram(INITIAL_TEMPLATE_ID));
      const [logsRaw, setLogsRaw] = useState({});
      
      const setLogs = useCallback((updater) => setLogsRaw(updater), []);
      
      const logs = logsRaw;

      // --- Draft vs saved state: only persist when user clicks Save ---
      const savedJsonRef = useRef(null);
      const markDirty = useCallback((exId) => {
        setDirtyByExId(prev => (prev[exId] ? prev : { ...prev, [exId]: true }));
      }, []);

      const clearDirty = useCallback((exId) => {
        setDirtyByExId(prev => {
          if (!prev[exId]) return prev;
          const next = { ...prev };
          delete next[exId];
          return next;
        });
      }, []);

      const clearAllDirty = useCallback(() => setDirtyByExId({}), []);

// When logged out, switching templates should immediately swap the program.
// When logged out (guest mode), switching templates should load the new template program
// Track previous templateId to prevent unnecessary resets
const prevTemplateIdRef = useRef(null);
const hasInitializedRef = useRef(false);

useEffect(() => {
  // Don't run if logged in
  if (user) return;
  
  // Don't run if already initialized and templateId hasn't changed
  if (hasInitializedRef.current && prevTemplateIdRef.current === templateId) {
    return;
  }
  
  prevTemplateIdRef.current = templateId;
  hasInitializedRef.current = true;
  
  const next = getGuestProgram(templateId);
  setProgram(next);
  setLogs({});
  setWeek(1);
  setDay("Monday");
  setExpandedExId(null);
  setDirtyByExId({});
  try {
    savedJsonRef.current = JSON.stringify({ program: next, logs: {}, week: 1, day: "Monday" });
  } catch {}
}, [templateId, user]); // ONLY depend on templateId and user, nothing else!

// When logged in, switching templates should load that template's own saved state (separate logs).
useEffect(() => {
  if (!user) return;
  if (!firebaseReady()) return;
  if (!hydratedRef.current) return; // wait until initial cloud load finishes

  // If we already have this template loaded, do nothing.
  if (loadedTemplateIdRef.current === templateId) return;

  const { db } = initFirebase();
  if (!db) return;

  (async () => {
    try {
      setCloudStatus("syncing");
      const docRef = db.collection("users").doc(user.uid);
      const snap = await docRef.get();
      const data = snap.exists ? (snap.data() || {}) : {};
      const templates = (data.templates && typeof data.templates === "object") ? data.templates : {};
      const tpl = templates?.[templateId] || null;

      // If missing, create defaults for that template in the cloud (update preserves other templates).
      if (!tpl) {
        const fallbackTpl = getTemplateById(templateId);
        const newTpl = {
          program: fallbackTpl?.program || PREFILLED_PROGRAM,
          logs: {},
          week: 1,
          day,
          catalog: fallbackTpl?.catalog || { list: DEFAULT_EXERCISE_LIST, map: DEFAULT_EXERCISE_MAP },
        };
        try {
          await docRef.update({
            activeTemplateId: templateId,
            ["templates." + templateId]: newTpl,
            templateId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } catch (updateErr) {
          if (updateErr?.code === "not-found" || updateErr?.message?.includes("NOT_FOUND")) {
            await docRef.set({ activeTemplateId: templateId, templates: { [templateId]: newTpl }, templateId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          } else throw updateErr;
        }
        loadedTemplateIdRef.current = templateId;

        applyingRemoteRef.current = true;
setProgram(ensureExerciseMeta(newTpl.program));
        setLogs(newTpl.logs);
        setWeek(newTpl.week);
        setDay(newTpl.day);
        if (newTpl.catalog?.list) setExerciseList(newTpl.catalog.list);
        if (newTpl.catalog?.map) setExerciseMap(newTpl.catalog.map);
        applyingRemoteRef.current = false;

        savedJsonRef.current = JSON.stringify({ program: newTpl.program, logs: newTpl.logs, week: newTpl.week, day: newTpl.day, templateId });
        clearAllDirty();
        setExpandedExId(null);
        setCloudStatus("synced");
        hydratedRef.current = true;
        loadSucceededRef.current = true;
        return;
      }

      // Apply template from cloud
      loadedTemplateIdRef.current = templateId;

      applyingRemoteRef.current = true;
if (tpl.program) setProgram(ensureExerciseMeta(tpl.program));
      if (tpl.logs) setLogs(tpl.logs);
      if (typeof tpl.week === "number") setWeek(tpl.week);
      if (typeof tpl.day === "string") setDay(tpl.day);
      if (tpl.catalog?.list && Array.isArray(tpl.catalog.list)) setExerciseList(tpl.catalog.list);
      if (tpl.catalog?.map && typeof tpl.catalog.map === "object") setExerciseMap(tpl.catalog.map);
      applyingRemoteRef.current = false;

      savedJsonRef.current = JSON.stringify({
        program: tpl.program ?? (getTemplateById(templateId)?.program || PREFILLED_PROGRAM),
        logs: tpl.logs ?? {},
        week: typeof tpl.week === "number" ? tpl.week : 1,
        day: typeof tpl.day === "string" ? tpl.day : day,
        templateId,
      });

      clearAllDirty();
      setExpandedExId(null);
      setCloudStatus("synced");
      hydratedRef.current = true;
      loadSucceededRef.current = true;
    } catch (e) {
      console.warn("Template switch load failed:", e);
      loadSucceededRef.current = false;
      setCloudStatus("error");
    }
  })();
}, [templateId, user, day, getTemplateById, clearAllDirty]);



      const isDirty = useCallback((exId) => !!dirtyByExId[exId], [dirtyByExId]);

      const getSavedState = useCallback(() => {
        const json = savedJsonRef.current;
        if (!json) return null;
        try { return JSON.parse(json); } catch { return null; }
      }, []);
      const currentJson = useMemo(
        () => JSON.stringify({ program, logs, week, day }),
        [program, logs, week, day]
      );

      const saveNow = useCallback(() => {
        // "Save" now means: update the baseline for dirty-tracking.
        // Persistence is handled by cloud autosync when signed in.
        savedJsonRef.current = currentJson;
        lastCloudJsonRef.current = currentJson;
        clearAllDirty();
      }, [currentJson, clearAllDirty]);

      const discardNow = useCallback(() => {
        try {
          const json = savedJsonRef.current;
          if (json) {
            const parsed = JSON.parse(json);
            setProgram(parsed?.program ? ensureExerciseMeta(parsed.program) : getGuestProgram(templateId));
            setLogs(parsed?.logs || {});
            setWeek(typeof parsed?.week === "number" ? parsed.week : 1);
            setDay(typeof parsed?.day === "string" ? parsed.day : "Monday");
          } else {
            // Nothing saved yet -> revert to defaults
            setProgram(getGuestProgram(templateId));
            setLogs({});
            setWeek(1);
            setDay("Monday");
            savedJsonRef.current = JSON.stringify({ program: PREFILLED_PROGRAM, logs: {}, week: 1, day: "Monday" });
          }
          setExpandedExId(null);
          clearAllDirty();
        } catch (e) {
          console.warn("Discard failed:", e);
          alert("Discard failed.");
        }
      }, [clearAllDirty]);

      const [dirty, setDirty] = useState(false);
      const [otherTabUpdated, setOtherTabUpdated] = useState(false);

      // When tab becomes visible, check if cloud data changed (e.g. another tab synced).
      useEffect(() => {
        if (!user || !firebaseReady()) return;
        const onVisible = () => {
          if (document.visibilityState !== "visible") return;
          const { db } = initFirebase();
          if (!db) return;
          const docRef = db.collection("users").doc(user.uid);
          docRef.get().then(snap => {
            if (!snap.exists) return;
            const data = snap.data() || {};
            const activeId = data.activeTemplateId || templateId;
            const tpl = data.templates?.[activeId];
            if (!tpl) return;
            const cloudJson = JSON.stringify({ program: tpl.program, logs: tpl.logs, week: tpl.week, day: tpl.day });
            if (cloudJson !== lastCloudJsonRef.current) setOtherTabUpdated(true);
          }).catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
      }, [user, templateId]);

      useEffect(() => {
        // Initialize baseline once, after the first render
        if (savedJsonRef.current === null) savedJsonRef.current = currentJson;
        setDirty(currentJson !== savedJsonRef.current);
      }, [currentJson]);


// Exercise catalog (dropdown) is editable + saved locally
      const CATALOG_KEY = "gymTracker_exerciseCatalog_v1";
      const [exerciseList, setExerciseList] = useState(DEFAULT_EXERCISE_LIST);
      const [exerciseMap, setExerciseMap] = useState(DEFAULT_EXERCISE_MAP);

      // Add Exercise modal state (supports custom exercise)
      const [customExerciseName, setCustomExerciseName] = useState("");
      const [customSets, setCustomSets] = useState("");
      const [customReps, setCustomReps] = useState("");
const [showAdd, setShowAdd] = useState(false);
const [addName, setAddName] = useState((exerciseList?.[0]) || "");
      // Add-exercise target: "current" | "specific" | "all"
      const [addTarget, setAddTarget] = useState("current");
      const [addTargetWeek, setAddTargetWeek] = useState(1);
      const [addTargetDay, setAddTargetDay] = useState("Monday");
      const fileInputRef = useRef(null);

      useEffect(() => {
        const dayMap = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
        const today = dayMap[new Date().getDay()];
        const initialDay = DAYS.includes(today) ? today : "Friday";
        setDay(initialDay);

        // Guest mode baseline (no login): start from hardcoded defaults every refresh.
        // When the user signs in, we load from Firestore and then auto-sync from there.
        savedJsonRef.current = JSON.stringify({
          program: PREFILLED_PROGRAM,
          logs: {},
          week: 1,
          day: initialDay,
        });

        // Load editable exercise catalog

        const savedCatalog = localStorage.getItem(CATALOG_KEY);
        if (savedCatalog) {
          try {
            const parsed = JSON.parse(savedCatalog);
            if (Array.isArray(parsed?.list) && parsed.list.length) setExerciseList(parsed.list);
            if (parsed?.map && typeof parsed.map === "object") setExerciseMap(parsed.map);
          } catch {}
        }
      }, []);

      // When signed in, load the user's latest state from Firestore (if it exists).
      useEffect(() => {
        // Signed out: go back to the hardcoded defaults (guest mode).
        if (!user) {
          hydratedRef.current = false;
          loadSucceededRef.current = false;
          loadedTemplateIdRef.current = null;
          setIsCloudLoading(false);
          setCloudStatus("local");
          setProgram(() => getGuestProgram(templateId));
          setLogs({});
          setWeek(1);
          // keep whatever "day" the initial effect picked
          savedJsonRef.current = JSON.stringify({ program: getGuestProgram(templateId), logs: {}, week: 1, day });
          clearAllDirty();
          setExpandedExId(null);
          return;
        }

        if (!firebaseReady()) return;
        const { db } = initFirebase();
        if (!db) return;

        hydratedRef.current = false;
        loadSucceededRef.current = false;
        setIsCloudLoading(true);

        const applyTemplateState = (id, tpl) => {
          const fallbackTpl = getTemplateById(id);
          const fallbackProgram = fallbackTpl?.program || PREFILLED_PROGRAM;
          const fallbackCatalog = fallbackTpl?.catalog || { list: DEFAULT_EXERCISE_LIST, map: DEFAULT_EXERCISE_MAP };

const nextProgram = ensureExerciseMeta(
  normalizeOrderEverywhere(tpl?.program ?? fallbackProgram)
);
          const nextLogs = tpl?.logs ?? {};
          const nextWeek = typeof tpl?.week === "number" ? tpl.week : 1;
          const nextDay = typeof tpl?.day === "string" ? tpl.day : day;

          const nextCatalogList = tpl?.catalog?.list && Array.isArray(tpl.catalog.list)
            ? tpl.catalog.list
            : (fallbackCatalog.list || DEFAULT_EXERCISE_LIST);
          const nextCatalogMap = tpl?.catalog?.map && typeof tpl.catalog.map === "object"
            ? tpl.catalog.map
            : (fallbackCatalog.map || DEFAULT_EXERCISE_MAP);

          applyingRemoteRef.current = true;
          setProgram(nextProgram);
          setLogs(nextLogs);
          setWeek(nextWeek);
          setDay(nextDay);
          setExerciseList(nextCatalogList);
          setExerciseMap(nextCatalogMap);
          applyingRemoteRef.current = false;

          loadedTemplateIdRef.current = id;

          const baseline = { program: nextProgram, logs: nextLogs, week: nextWeek, day: nextDay, templateId: id };
          savedJsonRef.current = JSON.stringify(baseline);
          lastCloudJsonRef.current = JSON.stringify({
            activeTemplateId: id,
            templates: {
              [id]: {
                program: nextProgram,
                logs: nextLogs,
                week: nextWeek,
                day: nextDay,
                catalog: { list: nextCatalogList, map: nextCatalogMap },
              },
            },
          });

          clearAllDirty();
          setExpandedExId(null);
        };

        (async () => {
          try {
            setCloudStatus("syncing");
            const docRef = db.collection("users").doc(user.uid);
            const snap = await docRef.get();

            // If the user has no cloud doc yet, seed it from current in-memory state (current template only).
            if (!snap.exists) {
              const seedId = templateId;
              const seed = {
                activeTemplateId: seedId,
                templates: {
                  [seedId]: {
                    program,
                    logs,
                    week,
                    day,
                    catalog: { list: exerciseList, map: exerciseMap },
                  },
                },
              };
              await docRef.set(
                { ...seed, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
                { merge: true }
              );
              applyTemplateState(seedId, seed.templates[seedId]);
              hydratedRef.current = true;
              loadSucceededRef.current = true;
              setIsCloudLoading(false);
              setCloudStatus("synced");
              return;
            }

            const data = snap.data() || {};

            // --- Migration from old schema (single state at root) to per-template schema ---
            const legacyHasRootState = !!(data.program || data.logs || typeof data.week === "number" || typeof data.day === "string" || data.catalog);
            const hasTemplates = data.templates && typeof data.templates === "object";
            const inferredActive =
              (typeof data.activeTemplateId === "string" && data.activeTemplateId) ||
              (typeof data.templateId === "string" && data.templateId) ||
              (typeof data.templateOriginId === "string" && data.templateOriginId) ||
              templateId;

            let templates = hasTemplates ? data.templates : {};
            if (!hasTemplates && legacyHasRootState) {
              templates = {
                [inferredActive]: {
                  program: data.program ?? (getTemplateById(inferredActive)?.program || PREFILLED_PROGRAM),
                  logs: data.logs ?? {},
                  week: typeof data.week === "number" ? data.week : 1,
                  day: typeof data.day === "string" ? data.day : day,
                  catalog: data.catalog ?? (getTemplateById(inferredActive)?.catalog || { list: DEFAULT_EXERCISE_LIST, map: DEFAULT_EXERCISE_MAP }),
                },
              };

              await docRef.set(
                {
                  activeTemplateId: inferredActive,
                  templates,
                  // Keep these for backward compatibility (optional)
                  templateId: inferredActive,
                  templateOriginId: inferredActive,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }

            const activeId = inferredActive;

            // Keep React state in sync with what's active in cloud
            if (activeId && activeId !== templateId) setTemplateId(activeId);
try { localStorage.setItem(TEMPLATE_ID_KEY, activeId); } catch {}

            const tpl = templates?.[activeId] || null;

            // If the chosen template has never been saved before, create it from defaults (update preserves other templates).
            if (!tpl) {
              const fallbackTpl = getTemplateById(activeId);
              const newTpl = {
                program: fallbackTpl?.program || PREFILLED_PROGRAM,
                logs: {},
                week: 1,
                day,
                catalog: fallbackTpl?.catalog || { list: DEFAULT_EXERCISE_LIST, map: DEFAULT_EXERCISE_MAP },
              };
              try {
                await docRef.update({
                  activeTemplateId: activeId,
                  ["templates." + activeId]: newTpl,
                  templateId: activeId,
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
              } catch (updateErr) {
                if (updateErr?.code === "not-found" || updateErr?.message?.includes("NOT_FOUND")) {
                  await docRef.set({ activeTemplateId: activeId, templates: { [activeId]: newTpl }, templateId: activeId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
                } else throw updateErr;
              }
              applyTemplateState(activeId, newTpl);
            } else {
              applyTemplateState(activeId, tpl);
            }

            hydratedRef.current = true;
            loadSucceededRef.current = true;
            setIsCloudLoading(false);
            setCloudStatus("synced");
          } catch (e) {
            console.warn("Cloud load failed:", e);
            hydratedRef.current = true;
            loadSucceededRef.current = false; // do not sync; would overwrite cloud
            setIsCloudLoading(false);
            setCloudStatus("error");
          }
        })();
      }, [user]);

      // Guest mode: restore program/logs/week/day from localStorage after other init (so refresh keeps your data).
      const guestStorageLoadedRef = useRef(false);
      useEffect(() => {
        if (user !== null) {
          guestStorageLoadedRef.current = false;
          return;
        }
        if (guestStorageLoadedRef.current) return;
        guestStorageLoadedRef.current = true;
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const data = JSON.parse(raw);
          if (!data || (!data.program && !data.logs)) return;
          if (data.program) setProgram(ensureExerciseMeta(data.program));
          if (data.logs) setLogs(data.logs);
          if (typeof data.week === "number" && data.week >= 1 && data.week <= 12) setWeek(data.week);
          savedJsonRef.current = raw;
        } catch (_) {}
      }, [user, STORAGE_KEY]);

      // Guest mode: persist program/logs/week/day to localStorage (debounced) so refresh keeps data.
      useEffect(() => {
        if (user !== null) return;
        const payload = JSON.stringify({ program, logs, week, day });
        const t = setTimeout(() => {
          try { localStorage.setItem(STORAGE_KEY, payload); } catch (_) {}
        }, 800);
        return () => clearTimeout(t);
      }, [program, logs, week, day, user, STORAGE_KEY]);

      // Persist program/logs/week/day implicitly (debounced) to reduce lag
useEffect(() => {
        localStorage.setItem(CATALOG_KEY, JSON.stringify({ list: exerciseList, map: exerciseMap }));
      }, [exerciseList, exerciseMap]);

      // Auto-sync to cloud when signed in (debounced).
      useEffect(() => {
        if (!user || !firebaseReady()) return;
        if (!hydratedRef.current) return;          // don't overwrite cloud with defaults before the first load
        if (applyingRemoteRef.current) return;     // don't echo remote -> local -> remote

        pushToCloudDebounced({
          program,
          logs,
          week,
          day,
          catalog: { list: exerciseList, map: exerciseMap },
        });
      }, [program, logs, week, day, templateId, exerciseList, exerciseMap, user, pushToCloudDebounced]);


      const dayKey = week + ":" + day;
      
      const baseExercises = useMemo(() => 
        (program?.[week]?.[day] || []).slice().sort((a,b)=>(((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id)))),
        [program, week, day]
      );
      
      const draftIds = orderDraftByKey[dayKey];
      
      const exercises = useMemo(() => {
        if (!Array.isArray(draftIds) || !draftIds.length) return baseExercises;
        const byId = new Map(baseExercises.map(e => [e.id, e]));
        const ordered = draftIds.map(id => byId.get(id)).filter(Boolean);
        // If something new was added after the draft was created, append it at the end
        const seen = new Set(draftIds);
        baseExercises.forEach(e => { if (!seen.has(e.id)) ordered.push(e); });
        return ordered;
      }, [baseExercises, draftIds]);

      const ensureOrderDraft = () => {
        setOrderDraftByKey(prev => {
          if (Array.isArray(prev[dayKey]) && prev[dayKey].length) return prev;
          return { ...prev, [dayKey]: baseExercises.map(e => e.id) };
        });
      };

      const clearOrderDraft = () => {
        setOrderDraftByKey(prev => {
          if (!prev[dayKey]) return prev;
          const next = { ...prev };
          delete next[dayKey];
          return next;
        });
      };

      const moveInOrderDraft = (pickId, targetId) => {
        ensureOrderDraft();
        setOrderDraftByKey(prev => {
          const cur = Array.isArray(prev[dayKey]) && prev[dayKey].length ? prev[dayKey].slice() : baseExercises.map(e => e.id);
          const from = cur.indexOf(pickId);
          const to = cur.indexOf(targetId);
          if (from < 0 || to < 0 || pickId === targetId) return prev;
          cur.splice(from, 1);
          const insertAt = (from < to) ? (to - 1) : to;
          cur.splice(insertAt, 0, pickId);
          return { ...prev, [dayKey]: cur };
        });
      };

      const hasOrderDraft = Array.isArray(draftIds) && draftIds.length;

      const saveOrderDraft = () => {
        if (!Array.isArray(orderDraftByKey[dayKey]) || !orderDraftByKey[dayKey].length) return;

        // 1) Commit orders into in-memory program
        setProgram(prev => {
          const next = structuredClone(prev);
          const arr = next?.[week]?.[day] || [];
          const orderIds2 = orderDraftByKey[dayKey];
          const pos = new Map(orderIds2.map((id, i) => [id, i]));
          next[week][day] = arr.map(ex => ({ ...ex, order: (pos.has(ex.id) ? pos.get(ex.id) : (ex.order ?? 0)) }));
          return next;
        });

        // 2) Persist orders to localStorage (without needing per-exercise Save)
        const saved = getSavedState() || { program: PREFILLED_PROGRAM, logs: {}, week, day };
        saved.program = saved.program || PREFILLED_PROGRAM;
        saved.logs = saved.logs || {};
        if (!saved.program[week]) saved.program[week] = {};
        if (!saved.program[week][day]) saved.program[week][day] = [];
        const orderIds2 = orderDraftByKey[dayKey];
        const pos = new Map(orderIds2.map((id, i) => [id, i]));
        saved.program[week][day] = (saved.program[week][day] || []).map(ex => ({ ...ex, order: (pos.has(ex.id) ? pos.get(ex.id) : (ex.order ?? 0)) }));
        saved.week = week;
        saved.day = day;

        try {
          const json = JSON.stringify(saved);
          savedJsonRef.current = json;
          lastCloudJsonRef.current = json;
          savedJsonRef.current = json;
          clearOrderDraft();
        } catch (e) {
          console.warn("Save order failed:", e);
          alert("Save order failed. Your browser may be blocking localStorage.");
        }
      };



const updateExerciseLog = (ex, updater) => {
  markDirty(ex.id);

  setLogs((prev) => {
    const next = { ...(prev || {}) };
    const weekObj = { ...(next[week] || {}) };
    const dayObj = { ...(weekObj[day] || {}) };

    // CRITICAL FIX: Use getExerciseLog to get cached version with stable IDs!
    const current = dayObj[ex.id] || getExerciseLog(ex);
    dayObj[ex.id] = updater(current);

    weekObj[day] = dayObj;
    next[week] = weekObj;

    return next;
  });
};

      const getExerciseLog = (ex) => {
        const entry = logs?.[week]?.[day]?.[ex.id];
        if (entry) return entry;
        const cacheKey = `${week}-${day}-${ex.id}`;
        if (!emptyLogCache.current[cacheKey]) {
          emptyLogCache.current[cacheKey] = makeEmptyExerciseLog(ex.defaultWorking ?? 2);
        }
        return emptyLogCache.current[cacheKey];
      };

      // If the program "Target Sets" is a plain integer (e.g. "2"), keep it in sync
      // with the number of working sets the user currently has.
      const syncTargetSetsIfSimple = (ex, workingCount) => {
        const cur = (ex?.sets ?? "").trim();
        if (!/^[0-9]+$/.test(cur)) return; // don't touch ranges like "2-3"
        setProgram(prev => {
          const next = structuredClone(prev);
          const arr = next?.[week]?.[day] || [];
          const i = arr.findIndex(x => x.id === ex.id);
          if (i >= 0) arr[i] = { ...arr[i], sets: String(workingCount) };
          return next;
        });
      };


      const addWarmupRow = (ex) => {
        updateExerciseLog(ex, cur => {
          const next = [...(cur.warmup || [])];
          const nextLabel = "W" + (next.length + 1);
          next.push(makeRow(nextLabel));
          return { ...cur, warmup: next };
        });
      };

      const addWorkingRow = (ex) => {
        const before = getExerciseLog(ex);
        const beforeCount = (before.working || []).length;

        updateExerciseLog(ex, cur => {
          const next = [...(cur.working || [])];
          next.push(makeRow(String(next.length + 1)));
          return { ...cur, working: next };
        });

        // Keep Target Sets aligned (only when it's a simple integer)
        syncTargetSetsIfSimple(ex, beforeCount + 1);
      };

      const deleteRow = (ex, bucket, rowId) => {
        const isWarmup = bucket === "warmup";
        if (!confirm("Remove this " + (isWarmup ? "warm-up" : "working") + " set?")) return;
        const before = getExerciseLog(ex);
        const beforeWorkingCount = (before.working || []).length;

        updateExerciseLog(ex, cur => {
          const list = cur[bucket] || [];
          const filtered = list.filter(r => r.id !== rowId);
          if (bucket === "working") {
            const relabeled = filtered.map((r, i) => ({ ...r, label: String(i + 1) }));
            return { ...cur, working: relabeled };
          }
          return { ...cur, [bucket]: filtered };
        });

        if (bucket === "working") {
          // If we actually removed a row, new count is before-1 (floor at 0)
          const nextCount = Math.max(0, beforeWorkingCount - 1);
          syncTargetSetsIfSimple(ex, nextCount);
        }
      };

      const setRowField = (ex, bucket, rowId, field, value) => {
        updateExerciseLog(ex, cur => {
          const next = (cur[bucket] || []).map(r => r.id === rowId ? { ...r, [field]: value } : r);
          return { ...cur, [bucket]: next };
        });
      };

      const saveExercise = (ex) => {
        const saved = getSavedState() || { program: PREFILLED_PROGRAM, logs: {}, week, day };
        // Ensure paths exist
        saved.program = saved.program || PREFILLED_PROGRAM;
        saved.logs = saved.logs || {};
        if (!saved.program[week]) saved.program[week] = {};
        if (!saved.program[week][day]) saved.program[week][day] = [];
        if (!saved.logs[week]) saved.logs[week] = {};
        if (!saved.logs[week][day]) saved.logs[week][day] = {};

        const curEx = (program?.[week]?.[day] || []).find(e => e.id === ex.id) || ex;
        const curLog = logs?.[week]?.[day]?.[ex.id] || getExerciseLog(ex);

        // Replace exercise in saved program for this day
        const arr = saved.program[week][day] || [];
        const idx = arr.findIndex(e => e.id === ex.id);
        if (idx >= 0) arr[idx] = curEx;
        else arr.push(curEx);
        saved.program[week][day] = arr;

        // Save log entry
        saved.logs[week][day][ex.id] = { ...curLog, savedAt: new Date().toISOString() };

        // Keep UI selectors
        saved.week = week;
        saved.day = day;

        try {
          const json = JSON.stringify(saved);
          savedJsonRef.current = json;
          lastCloudJsonRef.current = json;
          clearDirty(ex.id);
          // Also update local in-memory log savedAt so UI reflects immediately
setLogs(prev => {
  const next = { ...(prev || {}) };
  next[week] = { ...(next[week] || {}) };
  next[week][day] = { ...(next[week][day] || {}) };
  next[week][day][ex.id] = saved.logs[week][day][ex.id];
  return next;
});

        } catch (e) {
          console.warn("Save failed:", e);
          alert("Save failed.");
        }
      };

      const discardExercise = (ex) => {
        const saved = getSavedState();
        const savedEx = saved?.program?.[week]?.[day]?.find?.(e => e.id === ex.id);
        const savedLog = saved?.logs?.[week]?.[day]?.[ex.id];

        const templateEx = getTemplateExerciseForDay(templateId, week, day, ex.name);
        const revertEx = savedEx || (templateEx ? { ...templateEx, id: ex.id } : null);

        if (revertEx) {
          setProgram(prev => {
            const next = structuredClone(prev);
            if (!next[week]) next[week] = {};
            if (!next[week][day]) next[week][day] = [];
            const arr2 = next[week][day];
            const idx2 = arr2.findIndex(e => e.id === ex.id);
            if (idx2 >= 0) arr2[idx2] = revertEx;
            else arr2.push(revertEx);
            next[week][day] = arr2;
            return ensureExerciseMeta(next);
          });
        }

        const defaultWorking = revertEx?.defaultWorking ?? ex.defaultWorking ?? 2;
        setLogs(prev => {
          const next = ensureLogPath(prev, week, day, ex.id, defaultWorking);
          next[week][day][ex.id] = savedLog || makeEmptyExerciseLog(defaultWorking);
          return next;
        });
        clearDirty(ex.id);
      };

      const discardAllDrafts = () => {
        const saved = getSavedState();
        if (!saved) return;
        setProgram(ensureExerciseMeta(saved.program || PREFILLED_PROGRAM));
        setLogs(saved.logs || {});
        clearAllDirty();
        clearOrderDraft();
      };

      const removeExercise = (exId, fromWeeks, exerciseName) => {
        const weeksToRemove = fromWeeks === "all" ? Array.from({ length: 12 }, (_, i) => i + 1) : Array.isArray(fromWeeks) ? fromWeeks : [week];
        const name = (exerciseName || "").trim();
        const idsByWeek = {};
        for (const w of weeksToRemove) {
          if (w === week) idsByWeek[w] = [exId];
          else {
            const arr = program?.[w]?.[day] || [];
            idsByWeek[w] = arr.filter(e => namesMatch(e.name, name)).map(e => e.id);
          }
        }
        setProgram(prev => {
          const next = structuredClone(prev);
          for (const w of weeksToRemove) {
            if (!next[w]?.[day]) continue;
            if (w === week) {
              next[w][day] = (next[w][day] || []).filter(e => e.id !== exId);
            } else {
              next[w][day] = (next[w][day] || []).filter(e => !namesMatch(e.name, name));
            }
          }
          return next;
        });
        setLogs(prev => {
          const next = structuredClone(prev);
          for (const w of weeksToRemove) {
            const ids = idsByWeek[w] || [];
            if (!next[w]?.[day] || !ids.length) continue;
            for (const id of ids) { if (next[w][day][id]) delete next[w][day][id]; }
          }
          return next;
        });
        if (expandedExId === exId) setExpandedExId(null);
        setOrderDraftByKey(prev => {
          const key = week + ":" + day;
          const cur = prev[key];
          if (!Array.isArray(cur)) return prev;
          const nextIds = cur.filter(id => id !== exId);
          return { ...prev, [key]: nextIds };
        });
      };

      const addExerciseToWeeks = (ex, targetWeeks) => {
        const weeksToAdd = targetWeeks === "all" ? WEEKS : (Array.isArray(targetWeeks) ? targetWeeks : [targetWeeks]);
        const name = (ex.name || "").trim();
        if (!name) return;
        const updateData = { sets: ex.sets ?? "", reps: ex.reps ?? "", defaultWorking: ex.defaultWorking ?? 2, alternatives: ex.alternatives || [] };
        setProgram(prev => {
          const next = structuredClone(prev);
          for (const w of weeksToAdd) {
            if (!next[w]) next[w] = {};
            if (!next[w][day]) next[w][day] = [];
            const arr = next[w][day];
            const idx = arr.findIndex(e => namesMatch(e.name, name));
            if (idx >= 0) {
              arr[idx] = { ...arr[idx], ...updateData };
            } else {
              const maxOrder = arr.reduce((m, e) => Math.max(m, (e.order ?? 0)), -1);
              arr.push({
                id: uuid(),
                order: maxOrder + 1,
                name: ex.name,
                ...updateData,
              });
            }
          }
          return next;
        });
      };

      const addDayToWeeks = (targetWeeks) => {
        const weeksToAdd = targetWeeks === "all" ? WEEKS : (Array.isArray(targetWeeks) ? targetWeeks : [targetWeeks]);
        const dayExercises = (program?.[week]?.[day] || []).slice().sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)));
        if (!dayExercises.length) {
          alert("No exercises in this day to add.");
          return;
        }
        setProgram(prev => {
          const next = structuredClone(prev);
          for (const ex of dayExercises) {
            const name = (ex.name || "").trim();
            if (!name) continue;
            const updateData = { sets: ex.sets ?? "", reps: ex.reps ?? "", defaultWorking: ex.defaultWorking ?? 2, alternatives: ex.alternatives || [] };
            for (const w of weeksToAdd) {
              if (!next[w]) next[w] = {};
              if (!next[w][day]) next[w][day] = [];
              const arr = next[w][day];
              const idx = arr.findIndex(e => namesMatch(e.name, name));
              if (idx >= 0) {
                arr[idx] = { ...arr[idx], ...updateData };
              } else {
                const maxOrder = arr.reduce((m, e) => Math.max(m, (e.order ?? 0)), -1);
                arr.push({ id: uuid(), order: maxOrder + 1, name: ex.name, ...updateData });
              }
            }
          }
          return next;
        });
      };

      const moveExerciseOrder = (exId, dir) => {
        // dir: -1 up, +1 down
        const sorted = (program?.[week]?.[day] || []).slice().sort((a,b)=>((a.order ?? 0) - (b.order ?? 0)));
        const idx = sorted.findIndex(e => e.id === exId);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= sorted.length) return;
        const otherId = sorted[j].id;

        markDirty(exId);
        markDirty(otherId);

        setProgram(prev => {
          const next = structuredClone(prev);
          const arr = next?.[week]?.[day] || [];
          const aIdx = arr.findIndex(e => e.id === exId);
          const bIdx = arr.findIndex(e => e.id === otherId);
          if (aIdx < 0 || bIdx < 0) return next;
          const a = arr[aIdx], b = arr[bIdx];
          const ao = a.order ?? 0, bo = b.order ?? 0;
          arr[aIdx] = { ...a, order: bo };
          arr[bIdx] = { ...b, order: ao };
          return next;
        });
      };

      // Drag and Drop handlers - wrapped in useCallback for stable references
      const handleDragStart = useCallback((e, exId) => {
        e.dataTransfer.effectAllowed = "move";
        setDraggedExId(exId);
        ensureOrderDraft();
      }, []);

      const handleDragOver = useCallback((e, exId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverExId(exId);
      }, []);

      const handleDrop = useCallback((e, targetExId) => {
        e.preventDefault();
        if (draggedExId && draggedExId !== targetExId) {
          moveInOrderDraft(draggedExId, targetExId);
          setRecentlyMovedId(draggedExId);
          setTimeout(() => setRecentlyMovedId(null), 700);
          setTimeout(() => saveOrderDraft(), 80);
        }
        setDraggedExId(null);
        setDragOverExId(null);
      }, [draggedExId, moveInOrderDraft, saveOrderDraft]);

      const handleDragEnd = useCallback(() => {
        setDraggedExId(null);
        setDragOverExId(null);
      }, []);

const addExerciseToDay = () => {
  const typedName = (customExerciseName || "").trim();
  const isCustom = !!typedName;

  const name = isCustom ? typedName : addName;
  if (!name) return;
  if (!confirm("Add \"" + name + "\" to " + day + "?")) return;

  // Prefer explicit inputs when present
  const overrideSets = (customSets || "").trim();
  const overrideReps = (customReps || "").trim();

  const base = (!isCustom ? (getFromExerciseMap(exerciseMap, name) || {}) : (getFromExerciseMap(exerciseMap, name) || {}));

  // Resolve target week/day pairs
  const pairs = (() => {
    if (addTarget === "current") return [[week, day]];
    if (addTarget === "specific") return [[addTargetWeek, addTargetDay]];
    // "all" -> every week and day
    const list = [];
    for (const w of WEEKS) for (const d of DAYS) list.push([w, d]);
    return list;
  })();

  setProgram((prev) => {
    const next = structuredClone(prev);
    for (const [w, d] of pairs) {
      const templateEx = getTemplateExerciseForDay(templateId, w, d, name);
      const src = templateEx || base;
      const sets = overrideSets !== "" ? overrideSets : (src.sets || base.sets || "");
      const reps = overrideReps !== "" ? overrideReps : (src.reps || base.reps || "");
      const defaultWorking = src.defaultWorking ?? base.defaultWorking ?? 2;
      if (!next[w]) next[w] = {};
      if (!next[w][d]) next[w][d] = [];
      const arr = next[w][d];
      const maxOrder = arr.reduce((m, e) => Math.max(m, (e.order ?? 0)), -1);
      const ex = {
        id: uuid(),
        order: maxOrder + 1,
        name,
        sets,
        reps,
        defaultWorking,
        alternatives: (Array.isArray(src.alternatives) && src.alternatives.length) ? src.alternatives : (base.alternatives || []),
      };
      next[w][d].push(ex);
    }
    return next;
  });

  // If they typed a custom exercise, also add it into the dropdown/catalog (optional but nice)
  if (isCustom) {
    setExerciseList((prev) => (exerciseListHas(prev, name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))));
    setExerciseMap((prev) =>
      prev[name]
        ? prev
        : { ...prev, [name]: { sets: overrideSets, reps: overrideReps, defaultWorking: 2, alternatives: [] } }
    );
  }

  // Reset modal inputs
  setShowAdd(false);
  setCustomExerciseName("");
  setCustomSets("");
  setCustomReps("");
};


      const onClickImport = () => fileInputRef.current?.click();
      const onFilePicked = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        importFromExcel(
          file,
          ({ program: p, logs: l }) => {
            setProgram(p);
            setLogs(l);
            alert("Imported from Excel!");
            e.target.value = "";
          },
          (err) => {
            console.error(err);
            alert("Import failed. Use an Excel exported from this app (Program/Logs sheets).");
            e.target.value = "";
          }
        );
      };

      return (
        <div className="min-h-screen pb-24">
          {user && isCloudLoading && (
            <div className="fixed inset-0 z-[9998] bg-white/90 flex items-center justify-center" role="alert" aria-busy="true">
              <div className="text-center">
                <div className="animate-pulse text-lg font-semibold text-gray-800 mb-2">Loading your workouts…</div>
                <div className="text-sm text-gray-500">Please wait for cloud data to load before editing.</div>
              </div>
            </div>
          )}
          {user && otherTabUpdated && (
            <div className="fixed top-0 left-0 right-0 z-[9997] bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-amber-900">Data may have been updated in another tab.</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded font-medium" onClick={() => { setOtherTabUpdated(false); window.location.reload(); }}>Refresh</button>
                <button className="px-3 py-1 text-amber-800 hover:underline" onClick={() => setOtherTabUpdated(false)}>Dismiss</button>
              </div>
            </div>
          )}
          {/* Header */}
          <div className="bg-blue-600 text-white shadow">
            <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">Week {week}</div>
                <div className="text-sm opacity-90">{WORKOUT_TYPES[day] || ""}</div>
              </div>
              
<div className="w-full sm:w-auto flex items-center gap-3">
  <select
    className="w-full sm:w-auto bg-blue-700 px-4 py-2 sm:py-1 rounded-full text-sm text-white focus:outline-none"
    value={day}
    onChange={(e) => { clearOrderDraft(); setDay(e.target.value); setExpandedExId(null); }}
  >
    {DAYS.map((d) => (
      <option key={d} value={d}>{d}</option>
    ))}
  </select>
  {TEMPLATES.length > 0 && (
    <select
      className="w-full sm:w-auto bg-blue-700 px-4 py-2 sm:py-1 rounded-full text-sm text-white focus:outline-none"
      value={templateId}
      onChange={(e) => setTemplateId(e.target.value)}
      title="Workout template"
    >
      {TEMPLATES.map((t) => (
        <option key={t.id} value={t.id}>{t.name || t.id}</option>
      ))}
    </select>
  )}

  {/* Auth / Cloud sync */}
  <div className="flex items-center gap-2 ml-auto">
    {firebaseReady() ? (
      user ? (
        <>
          <div className="text-xs opacity-90 hidden sm:block">
            Signed in as <span className="font-semibold">{user.email || user.displayName || "User"}</span>
          </div>

          {/* Cloud sync status badge (visible on mobile too) */}
          {cloudStatus && (
            <div
              style={{
                position: "fixed",
                right: 12,
                bottom: 76, // above bottom nav
                zIndex: 9999,
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                lineHeight: 1,
                background: "rgba(0,0,0,0.75)",
                color: "white",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
{cloudStatus === "syncing"
  ? `Syncing… (${getTemplateNameById(templateId)})`
  : cloudStatus === "synced"
  ? `Synced (${getTemplateNameById(templateId)})`
  : cloudStatus === "error"
  ? `Sync error (${getTemplateNameById(templateId)})`
  : ""}

            </div>
          )}
          <button
            className="bg-blue-800 hover:bg-blue-900 px-3 py-2 sm:py-1 rounded-full text-sm"
            onClick={() => {
              const { auth } = initFirebase();
              auth && auth.signOut();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <button
          className="bg-white/15 hover:bg-white/25 px-3 py-2 sm:py-1 rounded-full text-sm"
          onClick={async () => {
            const { auth } = initFirebase();
            if (!auth) return alert("Firebase is not configured yet.");
            const provider = new firebase.auth.GoogleAuthProvider();
            try {
              await auth.signInWithPopup(provider);
            } catch (e) {
              // Popups are often blocked in mobile webviews. Redirect is more reliable.
              try {
                await auth.signInWithRedirect(provider);
              } catch (e2) {
                console.warn(e2);
                alert("Sign-in failed. If you're on Android, try opening in Chrome.");
              }
            }
          }}
        >
          Sign in
        </button>
      )
    ) : (
      <div className="text-xs opacity-90 hidden sm:block">Local-only (Firebase not configured)</div>
    )}
  </div>
</div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-5">
            {view === "current" && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div className="text-lg font-semibold text-gray-800">Workout</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium cursor-pointer border-0"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = "";
                        if (!v) return;
                        if (v === "all") {
                          if (confirm("Add this " + day + " workout to all 12 weeks? Existing exercises will be updated.")) addDayToWeeks("all");
                        } else {
                          const w = parseInt(v, 10);
                          if (!isNaN(w) && confirm("Add this " + day + " workout to Week " + w + "? Existing exercises will be updated.")) addDayToWeeks([w]);
                        }
                      }}
                      title="Add this day's workouts to other weeks"
                    >
                      <option value="" disabled>+ Add day to ▼</option>
                      {WEEKS.map((w) => (
                        <option key={w} value={w}>Week {w} only</option>
                      ))}
                      <option value="all">All weeks</option>
                    </select>
                    <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => setShowAdd(v => !v)}>
                      + Add Exercise
                    </button>
                  </div>
                </div>

                {showAdd && (
                  <div className="bg-white border rounded-lg shadow p-4 mb-4">
                    <div className="font-semibold mb-2">Add Exercise</div>
                    <div className="flex gap-3 flex-wrap items-end">
                      <div className="flex-1 min-w-[260px]">
                        <div className="text-xs text-gray-500 mb-1">Exercise</div>
                        <select className="w-full border rounded-md px-3 py-2 bg-white"
                                value={addName}
                                onChange={(e) => setAddName(e.target.value)}>
                          {exerciseList.map(name => (<option key={name} value={name}>{name}</option>))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[260px]">
                        <div className="text-xs text-gray-500 mb-1">Or add a new exercise (not in dropdown)</div>
                        <input
                          className="w-full border rounded-md px-3 py-2 bg-white"
                          placeholder="Type new exercise name..."
                          value={customExerciseName}
                          onChange={(e) => setCustomExerciseName(e.target.value)}
                        />
                        <div className="flex gap-2 mt-2">
                          <input
                            className="flex-1 border rounded-md px-3 py-2 bg-white"
                            placeholder="Sets (optional, e.g. 2-3)"
                            value={customSets}
                            onChange={(e) => setCustomSets(e.target.value)}
                          />
                          <input
                            className="flex-1 border rounded-md px-3 py-2 bg-white"
                            placeholder="Reps (optional, e.g. 6-8)"
                            value={customReps}
                            onChange={(e) => setCustomReps(e.target.value)}
                          />
                        </div>
                        <button
                          className="mt-2 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black disabled:opacity-40"
                          disabled={!customExerciseName.trim()}
                          onClick={() => {
                            const name = customExerciseName.trim();
                            // add to catalog if not present
                            setExerciseList(prev => exerciseListHas(prev, name) ? prev : [...prev, name].sort((a,b) => a.localeCompare(b)));
                            setExerciseMap(prev => prev[name] ? prev : { ...prev, [name]: { sets: customSets.trim(), reps: customReps.trim(), defaultWorking: 2, alternatives: [] }});
                            setAddName(name);
                            setCustomExerciseName("");
                            setCustomSets("");
                            setCustomReps("");
                            alert("Added to dropdown!");
                          }}
                        >
                          Add to Dropdown
                        </button>
                      </div>

                      <div className="w-full border-t pt-3 mt-1 flex flex-wrap gap-3 items-center">
                        <button
                          type="button"
                          className="text-sm text-gray-500 hover:text-gray-700 underline"
                          onClick={() => {
                            if (!confirm("Restore the dropdown list to the full default list? This will bring back any exercises you removed with \"From dropdown list only\". Exercises you added yourself will be kept.")) return;
                            const tpl = getTemplateById(templateId);
                            const fallback = { list: DEFAULT_EXERCISE_LIST, map: DEFAULT_EXERCISE_MAP };
                            const defaultList = (tpl?.catalog?.list && Array.isArray(tpl.catalog.list)) ? tpl.catalog.list : fallback.list;
                            const defaultMap = (tpl?.catalog?.map && typeof tpl.catalog.map === "object") ? tpl.catalog.map : fallback.map;
                            const defaultSetLower = new Set((defaultList || []).map(n => (n || "").toLowerCase()));
                            const addedByUser = (exerciseList || []).filter(name => !defaultSetLower.has((name || "").toLowerCase()));
                            const newList = [...defaultList, ...addedByUser].sort((a, b) => a.localeCompare(b));
                            const newMap = { ...defaultMap };
                            addedByUser.forEach(name => { const v = getFromExerciseMap(exerciseMap, name); if (v) newMap[name] = v; });
                            setExerciseList(newList);
                            setExerciseMap(newMap);
                            setAddName(newList?.[0] || "");
                            alert("Dropdown list restored. Your added exercises were kept.");
                          }}
                          title="Bring back all exercises you removed from the dropdown"
                        >
                          Restore dropdown list
                        </button>
                        <button
                          type="button"
                          className="text-sm text-gray-500 hover:text-gray-700 underline"
                          onClick={() => {
                            if (!confirm("Restore only deleted exercises? Any exercises you removed will be added back. Workouts you added yourself will be kept. Your logs are kept.")) return;
                            const tpl = getTemplateById(templateId);
                            const tplProgram = tpl?.program || {};
                            const newProgram = structuredClone(program);
                            for (const w of WEEKS) {
                              for (const d of DAYS) {
                                const tArr = tplProgram[w]?.[d] || [];
                                const cArr = newProgram[w]?.[d] || [];
                                const templateNamesLower = new Set(tArr.map(e => (e.name || "").toLowerCase()));
                                const currentByLower = new Map(cArr.map(e => [(e.name || "").toLowerCase(), e]));
                                const merged = [];
                                for (const ex of tArr) {
                                  const key = (ex.name || "").toLowerCase();
                                  if (currentByLower.has(key)) merged.push(currentByLower.get(key));
                                  else merged.push({ ...ex, id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "r-" + w + "-" + d + "-" + Date.now() + "-" + Math.random().toString(36).slice(2) });
                                }
                                for (const ex of cArr) {
                                  if (!templateNamesLower.has((ex.name || "").toLowerCase())) merged.push(ex);
                                }
                                if (!newProgram[w]) newProgram[w] = {};
                                newProgram[w][d] = merged;
                              }
                            }
                            const normalized = ensureExerciseMeta(newProgram);
                            setProgram(normalized);
                            const json = JSON.stringify({ program: normalized, logs, week, day });
                            savedJsonRef.current = json;
                            lastCloudJsonRef.current = json;
                            clearOrderDraft();
                            clearAllDirty();
                            alert("Deleted exercises restored. Your added workouts were kept.");
                          }}
                          title="Add back only the exercises you removed; keep any you added"
                        >
                          Restore workouts to template
                        </button>
                      </div>

                      <div className="w-full border-t pt-3 mt-1 flex flex-wrap gap-3 items-end">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Add to</div>
                          <select
                            className="border rounded-md px-3 py-2 bg-white"
                            value={addTarget}
                            onChange={(e) => setAddTarget(e.target.value)}
                          >
                            <option value="current">Current (Week {week}, {day})</option>
                            <option value="specific">Choose week &amp; day…</option>
                            <option value="all">All workouts (every week &amp; day)</option>
                          </select>
                        </div>
                        {addTarget === "specific" && (
                          <>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Week</div>
                              <select
                                className="border rounded-md px-3 py-2 bg-white"
                                value={addTargetWeek}
                                onChange={(e) => setAddTargetWeek(Number(e.target.value))}
                              >
                                {WEEKS.map(w => (<option key={w} value={w}>Week {w}</option>))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Day</div>
                              <select
                                className="border rounded-md px-3 py-2 bg-white"
                                value={addTargetDay}
                                onChange={(e) => setAddTargetDay(e.target.value)}
                              >
                                {DAYS.map(d => (<option key={d} value={d}>{d}</option>))}
                              </select>
                            </div>
                          </>
                        )}
                      </div>

                      <button className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                              onClick={addExerciseToDay}>
                        Add
                      </button>
                      <button className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                              onClick={() => {
                            if (confirm("Cancel adding an exercise? Your selection will be discarded.")) setShowAdd(false);
                          }}>
                        Cancel
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      (Sets/reps auto-fill from the catalog when available.)
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {exercises.map((ex) => {
                    const open = expandedExId === ex.id;
                    const state = open ? getExerciseLog(ex) : null;
                                        const isRecentlyMoved = recentlyMovedId === ex.id;
return (
                      <div 
                        key={ex.id} 
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, ex.id)}
                        onDragOver={(e) => handleDragOver(e, ex.id)}
                        onDrop={(e) => handleDrop(e, ex.id)}
                        onDragEnd={handleDragEnd}
                        className={[
                          "bg-white rounded-lg shadow border transition-all duration-200",
                          isRecentlyMoved ? "bg-green-100 border-green-400" : "",
                          draggedExId === ex.id ? "opacity-50 scale-95 cursor-grabbing" : "cursor-grab",
                          dragOverExId === ex.id && draggedExId !== ex.id ? "border-blue-500 border-2 scale-105" : ""
                        ].filter(Boolean).join(" ")}
                      >
                        <div className="flex items-stretch">
                          <div className="px-3 py-4 flex items-center text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <button className="flex-1 px-5 py-4 flex items-center justify-between text-left"
                                  onClick={() => setExpandedExId(open ? null : ex.id)}>
                            <div>
                              <div className="font-semibold flex items-center gap-2">{ex.name}{isRecentlyMoved && (<span className="text-xs px-2 py-1 rounded-full bg-green-600 text-white">Moved</span>)}</div>
                              <div className="text-sm text-gray-500">{ex.sets || "—"} sets × {ex.reps || "—"} reps</div>
                            </div>
                            {open ? <ChevronUp className="w-6 h-6 text-gray-400" /> : <ChevronDown className="w-6 h-6 text-gray-400" />}
                          </button>

                          <div className="flex items-stretch shrink-0 border-l">
                          <select
                                  className="px-2 py-2 text-red-600 hover:bg-red-50 text-xs font-medium bg-transparent cursor-pointer min-w-0 max-w-[4.2rem]"
                                  title="Remove exercise"
                                  value=""
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    e.target.value = "";
                                    if (!v) return;
                                    const name = ex.name || "this exercise";
                                    if (v === "this") {
                                      if (confirm("Remove \"" + name + "\" from " + day + " (Week " + week + ") only?")) removeExercise(ex.id, [week], ex.name);
                                    } else if (v === "all") {
                                      if (confirm("Remove \"" + name + "\" from " + day + " in all 12 weeks? This cannot be undone. (Export a backup first in Weeks tab if needed.)")) removeExercise(ex.id, "all", ex.name);
                                    } else if (v === "catalog") {
                                      if (confirm("Remove \"" + name + "\" from the Add Exercise dropdown list? It will no longer appear when adding exercises. (It stays in this workout.)")) {
                                        setExerciseList(prev => (prev || []).filter(n => !namesMatch(n, name)));
                                        setExerciseMap(prev => { const next = { ...prev }; const k = Object.keys(next || {}).find(x => namesMatch(x, name)); if (k != null) delete next[k]; return next; });
                                      }
                                    } else {
                                      const w = parseInt(v, 10);
                                      if (!isNaN(w) && confirm("Remove \"" + name + "\" from " + day + " (Week " + w + ") only?")) removeExercise(ex.id, [w], ex.name);
                                    }
                                  }}>
                            <option value="" disabled>−</option>
                            <option value="this">This week only</option>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                              <option key={w} value={w}>Week {w} only</option>
                            ))}
                            <option value="all">All weeks (this day)</option>
                            <option value="catalog">From dropdown list only</option>
                          </select>
                          <select
                                  className="px-2 py-2 text-green-600 hover:bg-green-50 text-xs font-medium bg-transparent cursor-pointer min-w-0 max-w-[4.2rem]"
                                  title="Add exercise"
                                  value=""
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    e.target.value = "";
                                    if (!v) return;
                                    const name = ex.name || "this exercise";
                                    if (v === "this") {
                                      if (confirm("Add another \"" + name + "\" to " + day + " (Week " + week + ")?")) addExerciseToWeeks(ex, [week]);
                                    } else if (v === "all") {
                                      if (confirm("Add \"" + name + "\" to " + day + " in all 12 weeks?")) addExerciseToWeeks(ex, "all");
                                    } else if (v === "catalog") {
                                      if (!exerciseListHas(exerciseList, name)) {
                                        setExerciseList(prev => [...prev, name].sort((a,b) => a.localeCompare(b)));
                                        setExerciseMap(prev => prev[name] ? prev : { ...prev, [name]: { sets: ex.sets || "", reps: ex.reps || "", defaultWorking: ex.defaultWorking ?? 2, alternatives: ex.alternatives || [] } });
                                        alert("Added \"" + name + "\" to the Add Exercise dropdown.");
                                      } else {
                                        alert("\"" + name + "\" is already in the dropdown.");
                                      }
                                    } else {
                                      const w = parseInt(v, 10);
                                      if (!isNaN(w) && confirm("Add \"" + name + "\" to " + day + " (Week " + w + ")?")) addExerciseToWeeks(ex, [w]);
                                    }
                                  }}>
                            <option value="" disabled>+</option>
                            <option value="this">This week only</option>
                            {WEEKS.map((w) => (
                              <option key={w} value={w}>Week {w} only</option>
                            ))}
                            <option value="all">All weeks (this day)</option>
                            <option value="catalog">To dropdown list only</option>
                          </select>
                          </div>
                        </div>

                        {open && state && (
                          <div className="px-5 pb-5">
                            {/* MAIN dropdown + alternate */}
                            <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                              <div className="text-xs tracking-wide text-gray-700 mb-2">MAIN</div>
                              <div className="text-[11px] text-gray-600 mb-2 flex flex-wrap gap-x-3 gap-y-1">
                                <div><span className="font-medium">Template:</span> {ex.templateName || ex.name}</div>
                                <div><span className="font-medium">Sets:</span> {ex.templateSets ?? ""}</div>
                                <div><span className="font-medium">Reps:</span> {ex.templateReps ?? ""}</div>
                              </div>
                              <select
                                className="w-full border rounded-md px-3 py-2 bg-white"
                                value={exerciseListHas(exerciseList, ex.name) ? (exerciseListFind(exerciseList, ex.name) || ex.name) : "__custom__"}
                                onChange={(e) => {
                                  const selected = e.target.value;
                                  markDirty(ex.id);
                                    if (selected === "__custom__") {
                                    // Switch to custom entry; keep current name if it was already custom,
                                    // otherwise clear so the user can type.
                                    if (exerciseListHas(exerciseList, ex.name)) {
                                      const newName = "";
                                      setProgram(prev => {
                                        const next = structuredClone(prev);
                                        const arr = next[week][day] || [];
                                        const i = arr.findIndex(x => x.id === ex.id);
                                        if (i >= 0) arr[i] = { ...arr[i], name: newName };
                                        return next;
                                      });
                                    }
                                    return;
                                  }

                                  const newName = selected;
                                  const templateEx = getTemplateExerciseForDay(templateId, week, day, newName);
                                  const base = getFromExerciseMap(exerciseMap, newName) || {};
                                  const src = templateEx || base;
                                  setProgram(prev => {
                                    const next = structuredClone(prev);
                                    const arr = next[week][day] || [];
                                    const i = arr.findIndex(x => x.id === ex.id);
                                    if (i >= 0) {
                                      arr[i] = {
                                        ...arr[i],
                                        name: newName,
                                        sets: (src.sets !== undefined && src.sets !== "") ? String(src.sets) : arr[i].sets,
                                        reps: (src.reps !== undefined && src.reps !== "") ? String(src.reps) : arr[i].reps,
                                        defaultWorking: (src.defaultWorking ?? base.defaultWorking ?? arr[i].defaultWorking) ?? 2,
                                        alternatives: (Array.isArray(src.alternatives) && src.alternatives.length) ? src.alternatives : (Array.isArray(base.alternatives) && base.alternatives.length) ? base.alternatives : arr[i].alternatives,
                                      };
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {exerciseList.map(name => (<option key={name} value={name}>{name}</option>))}
                                <option value="__custom__">Custom…</option>
                              </select>
                              {!exerciseListHas(exerciseList, ex.name) && (
                                <input
                                  className="w-full border rounded-md px-3 py-2 bg-white mt-2"
                                  value={ex.name}
                                  placeholder="Type a custom exercise…"
                                  onChange={(e) => {
                                    markDirty(ex.id);
                                    const newName = e.target.value;
                                    setProgram(prev => {
                                      const next = structuredClone(prev);
                                      const arr = next[week][day] || [];
                                      const i = arr.findIndex(x => x.id === ex.id);
                                      if (i >= 0) arr[i] = { ...arr[i], name: newName };
                                      return next;
                                    });
                                  }}
                                />
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">Target Sets</div>
                                  <input
                                    className="w-full border rounded-md px-3 py-2 bg-white"
                                    value={ex.sets || ""}
                                    placeholder="e.g. 2-3"
                                    onChange={(e) => {
                                      markDirty(ex.id);
                                      const val = e.target.value;
                                      setProgram(prev => {
                                        const next = structuredClone(prev);
                                        const arr = next[week][day] || [];
                                        const i = arr.findIndex(x => x.id === ex.id);
                                        if (i >= 0) arr[i] = { ...arr[i], sets: val };
                                        return next;
                                      });
                                    }}
                                    onBlur={(e) => {
                                      const val = (e.target.value ?? "").trim();
                                      const n = parseInt(val, 10);
                                      if (!isNaN(n) && n >= 0) {
                                        const cur = getExerciseLog(ex);
                                        const working = cur.working || [];
                                        if (working.length < n) {
                                          updateExerciseLog(ex, c => {
                                            const next = [...(c.working || [])];
                                            while (next.length < n) next.push(makeRow(String(next.length + 1)));
                                            return { ...c, working: next };
                                          });
                                        } else if (working.length > n && n > 0) {
                                          updateExerciseLog(ex, c => {
                                            const next = (c.working || []).slice(0, n).map((r, i) => ({ ...r, label: String(i + 1) }));
                                            return { ...c, working: next };
                                          });
                                        }
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs text-gray-600 mb-1">Target Reps</div>
                                  <input
                                    className="w-full border rounded-md px-3 py-2 bg-white"
                                    value={ex.reps || ""}
                                    placeholder="e.g. 6-8"
                                    onChange={(e) => {
                                      markDirty(ex.id);
                                      const val = e.target.value;
                                      setProgram(prev => {
                                        const next = structuredClone(prev);
                                        const arr = next[week][day] || [];
                                        const i = arr.findIndex(x => x.id === ex.id);
                                        if (i >= 0) arr[i] = { ...arr[i], reps: val };
                                        return next;
                                      });
                                    }}
                                  />
                                </div>
                              </div>


                              <div className="text-xs tracking-wide text-gray-700 mt-4 mb-2">ALTERNATE</div>
                              <div className="text-[11px] text-gray-600 mb-2">
                                <span className="font-medium">Template alternates:</span>{" "}
                                {(ex.templateAlternatives || []).length ? (ex.templateAlternatives || []).join(", ") : "—"}
                              </div>
                              <select
                                className="w-full border rounded-md px-3 py-2 bg-white"
                                value={state.selectedAlt === "__CUSTOM__" ? "__CUSTOM__" : (state.selectedAlt || "__MAIN__")}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === "__MAIN__") {
                                    updateExerciseLog(ex, cur => ({ ...cur, selectedAlt: "", customAlt: "" }));
                                  } else if (v === "__CUSTOM__") {
                                    updateExerciseLog(ex, cur => ({ ...cur, selectedAlt: "__CUSTOM__", customAlt: cur.customAlt || "" }));
                                  } else {
                                    updateExerciseLog(ex, cur => ({ ...cur, selectedAlt: v, customAlt: "" }));
                                  }
                                }}
                              >
                                <option value="__MAIN__">Use Main ({ex.name || "—"})</option>
                                {(ex.alternatives || []).map((alt) => (<option key={alt} value={alt}>{alt}</option>))}
                                <option value="__CUSTOM__">Custom…</option>
                              </select>

                              {state.selectedAlt === "__CUSTOM__" && (
                                <input
                                  className="w-full border rounded-md px-3 py-2 bg-white mt-2"
                                  placeholder="Type a custom alternate exercise"
                                  value={state.customAlt || ""}
                                  onChange={(e) => updateExerciseLog(ex, cur => ({ ...cur, customAlt: e.target.value }))}
                                />
                              )}

                              <div className="mt-2 flex gap-2">
                                <input
                                  className="flex-1 border rounded-md px-3 py-2 bg-white"
                                  placeholder="Add alternate option (saved with exercise)"
                                  value={altDraftById[ex.id] || ""}
                                  onChange={(e) => setAltDraftById(prev => ({ ...prev, [ex.id]: e.target.value }))}
                                />
                                <button
                                  className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                  disabled={!((altDraftById[ex.id] || '').trim())}
                                  onClick={() => {
                                    const v = (altDraftById[ex.id] || '').trim();
                                    if (!v) return;
                                    markDirty(ex.id);
                                    setProgram(prev => {
                                      const next = structuredClone(prev);
                                      const arr = next[week][day] || [];
                                      const i = arr.findIndex(x => x.id === ex.id);
                                      if (i >= 0) {
                                        const cur = arr[i];
                                        const alts = Array.isArray(cur.alternatives) ? cur.alternatives.slice() : [];
                                        if (!alts.includes(v)) alts.push(v);
                                        arr[i] = { ...cur, alternatives: alts };
                                      }
                                      return next;
                                    });
                                    setAltDraftById(prev => ({ ...prev, [ex.id]: "" }));
                                  }}
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            {/* Warm-up */}
                            <div className="mt-5">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-700">WARM-UP SETS</div>
                                <button className="p-2 rounded-md bg-green-50 text-green-600 hover:bg-green-100"
                                        onClick={() => addWarmupRow(ex)}
                                        title="Add warm-up set">
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="space-y-2">
                                {(state.warmup || []).map((row) => (
                                  <SetRow 
                                    key={row.id}
                                    row={row}
                                    bucket="warmup"
                                    setRowField={setRowField}
                                    deleteRow={deleteRow}
                                    ex={ex}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Working */}
                            <div className="mt-6">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-700">WORKING SETS</div>
                                <button className="p-2 rounded-md bg-green-50 text-green-600 hover:bg-green-100"
                                        onClick={() => addWorkingRow(ex)}
                                        title="Add working set">
                                  <Plus className="w-5 h-5" />
                                </button>
                              </div>
                              {(() => {
                                const prevWorking = week > 1 && (() => {
                                  const prevEx = (program?.[week - 1]?.[day] || []).find(e => namesMatch(e.name, ex.name));
                                  return prevEx ? (logs?.[week - 1]?.[day]?.[prevEx.id]?.working || []) : null;
                                })();
                                if (!prevWorking || !prevWorking.some(r => (r.weight || r.reps || "").trim())) return null;
                                return (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs text-gray-500">Last week: {prevWorking.map(r => ((r.weight || "") + (r.weight && r.reps ? "×" : "") + (r.reps || "")).trim() || "—").join(", ")}</span>
                                    <button
                                      type="button"
                                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                                      onClick={() => {
                                        const cur = getExerciseLog(ex);
                                        const curWorking = cur.working || [];
                                        const merged = curWorking.map((r, i) => {
                                          const prev = prevWorking[i];
                                          return prev ? { ...r, weight: prev.weight || r.weight, reps: prev.reps || r.reps } : r;
                                        });
                                        updateExerciseLog(ex, c => ({ ...c, working: merged }));
                                        markDirty(ex.id);
                                      }}>
                                      Use last week
                                    </button>
                                  </div>
                                );
                              })()}
                              <div className="space-y-2">
                                {(state.working || []).map((row) => (
                                  <SetRow 
                                    key={row.id}
                                    row={row}
                                    bucket="working"
                                    setRowField={setRowField}
                                    deleteRow={deleteRow}
                                    ex={ex}
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Notes + Save */}
                            <div className="mt-6">
                              <div className="text-sm font-semibold text-gray-700 mb-2">NOTES</div>
                              <textarea 
                                className="w-full border rounded-md px-3 py-2 min-h-[90px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Add notes about this exercise..."
                                value={state.notes || ""}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateExerciseLog(ex, cur => ({ ...cur, notes: e.target.value }));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                              />
                            </div>

                            <div className="mt-5">
                              <button className={"w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg " + (isDirty(ex.id) ? "" : "opacity-60 cursor-not-allowed")}
                                      onClick={() => {
                                        if (confirm("Discard your changes to \"" + (ex.name || "this exercise") + "\"? Sets, reps, and logged weights will revert to the last saved state.")) discardExercise(ex);
                                      }}
                                      disabled={!isDirty(ex.id)}>
                                Discard changes
                              </button>
                            </div>
</div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </>
            )}

            {view === "weeks" && (
              <div>
                <div className="text-xl font-bold mb-4">Select Week</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => (
                    <button key={w}
                            className={"rounded-lg border shadow-sm px-5 py-4 font-semibold " + (w === week ? "bg-blue-600 text-white" : "bg-white")}
                            onClick={() => { clearOrderDraft(); setWeek(w); setView("current"); setExpandedExId(null); }}>
                      Week {w}
                    </button>
                  ))}
                </div>
                <div className="mt-6 pt-6 border-t flex flex-wrap gap-3">
                  <button className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-medium"
                          onClick={() => exportToExcel({ program, logs })}>
                    Export backup (Excel)
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-white border hover:bg-gray-50 text-sm font-medium"
                          onClick={onClickImport}>
                    Import from Excel
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={onFilePicked} />
                </div>
              </div>
            )}

            {view === "day" && (
              <div>
                <div className="text-xl font-bold mb-4">Select Day</div>
                <div className="space-y-3">
                  {DAYS.map((d) => (
                    <button key={d}
                            className={"w-full text-left rounded-lg border shadow-sm px-5 py-4 " + (d === day ? "bg-blue-600 text-white" : "bg-white")}
                            onClick={() => { clearOrderDraft(); setDay(d); setView("current"); setExpandedExId(null); }}>
                      <div className="font-semibold">{d}</div>
                      <div className={"text-sm " + (d === day ? "text-white/90" : "text-gray-500")}>
                        {WORKOUT_TYPES[d]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
            <div className="max-w-6xl mx-auto px-6 py-3 flex justify-around">
              <button className="flex flex-col items-center text-xs" onClick={() => setView("current")}>
                <Home className={"w-6 h-6 " + (view === "current" ? "text-blue-600" : "text-gray-400")} />
                <div className={view === "current" ? "text-blue-600" : "text-gray-500"}>Current</div>
              </button>

              <button className="flex flex-col items-center text-xs" onClick={() => setView("weeks")}>
                <ListOrdered className={"w-6 h-6 " + (view === "weeks" ? "text-blue-600" : "text-gray-400")} />
                <div className={view === "weeks" ? "text-blue-600" : "text-gray-500"}>Weeks</div>
              </button>

              <button className="flex flex-col items-center text-xs" onClick={() => setView("day")}>
                <Calendar className={"w-6 h-6 " + (view === "day" ? "text-blue-600" : "text-gray-400")} />
                <div className={view === "day" ? "text-blue-600" : "text-gray-500"}>Day</div>
              </button>
            </div>
          </div>
        </div>
      );
    };

    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
