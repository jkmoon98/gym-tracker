# App improvement pointers

## Is a web app the right choice?

**Staying as a web app is a good fit** for a gym tracker:

- **Reach:** Works on any device with a browser; no app store or install.
- **Updates:** Deploy once, everyone gets the new version.
- **Firebase:** You already use Auth + Firestore; both work great from the web.
- **Offline:** You can add a service worker and Cache API (or Firestore persistence) later for offline use.

**Consider a native/PWA wrapper later if you want:**

- **PWA:** Add a manifest + service worker so users can “Add to home screen” and get app-like behavior and optional offline.
- **Native (e.g. Capacitor):** Wrap the same web app in a native shell for push notifications or store distribution; most of your code stays as-is.

So: **keep the web app**; improve it incrementally (see below).

## Codebase / architecture

- **Single large `index.html`:** The React app and logic live in one file. For maintainability, consider splitting into:
  - A small build (e.g. Vite + React) with components in separate files.
  - Or at least separate `<script src="...">` files for data (nippard.js / rp.js), Firebase init, and the main app.
- **State:** Most state is in React `useState` and refs. For a 12‑week tracker with cloud sync this is fine. If the app grows (e.g. shared programs, more templates), a small state layer (e.g. Zustand or Reducer + context) could help.
- **Templates:** `PROGRAM_TEMPLATES` in nippard.js/rp.js is a clean way to ship programs; keep extending that pattern for new templates.

## UX / product

- **Data screen:** The “Data” tab has Reset and could also expose **Export / Import** (Excel) so users don’t have to hunt for it. Consider moving or duplicating Export/Import there.
- **Save feedback:** When the user saves an exercise or order, show a short “Saved” (or “Synced”) toast instead of only clearing the dirty state.
- **Finish Workout:** Right now it only shows an alert. Consider recording a “workout completed at” timestamp (e.g. in Firestore under that day) so you can show history or streaks later.
- **Today’s day:** You already set the initial day from the current weekday; make sure week selection (e.g. “Week 3”) is obvious so users know where they are in the 12 weeks.

## Technical clean-up (done in this pass)

- **Firebase:** Config no longer contains a real key in the repo; use `firebase.config.js` (gitignored) and see `SECURITY.md`.
- **Excel:** Import now accepts both export column names (`Exercise`, `Set`) and the previous names (`ExerciseName`, `SetLabel`); Program export includes `ExerciseId` and `DefaultWorking` for round-trip.
- **Reset:** Data → “Reset Logs” now uses `templateId` / `window.DEFAULT_TEMPLATE_ID` correctly (no undefined `templateOriginId`).
- **Logging:** Debug `console.log` calls removed from `index.html`.

## Safe API practices (summary)

- **Firebase:** Client config in the repo is placeholder-only; real config in gitignored `firebase.config.js`. Security via Auth + Firestore rules (see `SECURITY.md`).
- **No other secrets:** Don’t add any other API keys or secrets to the front end; use a backend and env vars for those.
