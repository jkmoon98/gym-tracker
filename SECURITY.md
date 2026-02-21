# API key and security practices

## Firebase config (API key)

- **Do not commit real Firebase credentials** to the repo. The app is set up to use placeholders by default (`REPLACE_ME`).
- **To enable cloud sync:**  
  1. Copy `firebase.config.example.js` to `firebase.config.js`.  
  2. Paste your Firebase Web app config from [Firebase Console](https://console.firebase.google.com) → Project settings → Your apps → Web app.  
  3. Add `<script src="/firebase.config.js"></script>` in `index.html` before the Firebase SDK script tags.  
  4. Ensure `firebase.config.js` is in `.gitignore` (it is by default).

**Why the key is in the client:**  
Firebase’s Web SDK is designed to run in the browser. The “API key” in the config is a **public** client identifier. Security is enforced by:

- **Firebase Authentication** – only signed-in users get tokens.
- **Firestore Security Rules** – restrict read/write by `request.auth.uid` and path.

So the key in the front end is expected; what must stay secret are **service account keys** and **server-side secrets**. Never use those in the browser.

**Hardening (optional):**

- In Firebase Console, restrict the API key to your app’s domains (HTTP referrer).
- Enable **Firebase App Check** for your web app to reduce abuse.
- Keep Firestore rules strict: allow read/write only for `users/{userId}` where `request.auth.uid == userId`.

## General safe API practices

- **Never put server-side secrets or private API keys** in `index.html`, JS bundles, or any client-loaded file.
- **Use a backend for sensitive operations** (payments, admin actions, third-party APIs that must stay secret). The browser only talks to your server; the server holds and uses the secret keys.
- **Use environment variables** for secrets in Node/CI (e.g. `process.env.FIREBASE_ADMIN_KEY`). Never commit `.env` or files that contain real secrets.
- **Rotate keys** if they ever appear in git history or public logs. In Firebase, you can add a new key and restrict/remove the old one.
