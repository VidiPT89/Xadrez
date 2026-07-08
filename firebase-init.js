/* Firebase app bootstrap for Multiplayer mode: project init + anonymous auth. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const cfg = window.__FIREBASE_CONFIG__ || {};
export const configured = !!cfg.apiKey && cfg.apiKey !== "REPLACE_ME";

let app = null, auth = null, db = null;
if (configured) {
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);
}
export { auth, db };

let signInPromise = null;
export function ensureSignedIn() {
  if (!configured) return Promise.reject(new Error("not-configured"));
  if (signInPromise) return signInPromise;
  signInPromise = new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) return;
        unsub();
        resolve(user);
      },
      (err) => { unsub(); reject(err); }
    );
    signInAnonymously(auth).catch((err) => { unsub(); reject(err); });
  });
  return signInPromise;
}
