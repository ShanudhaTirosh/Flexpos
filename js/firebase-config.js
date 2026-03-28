// ============================================================
// FlexPOS — Firebase Configuration
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (e.g., "flexpos-prod")
// 3. Enable Authentication → Sign-in method → Email/Password
// 4. Enable Firestore Database → Start in production mode
// 5. Project Settings → Your apps → Add web app
// 6. Copy the firebaseConfig object values below
// 7. Deploy Firestore rules: firebase deploy --only firestore:rules
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Replace with your Firebase project config ──
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCKcDEK6BM04KhZ2heoYHkJF6ouO9fOTVA",
  authDomain: "flexpos-prud.firebaseapp.com",
  projectId: "flexpos-prud",
  storageBucket: "flexpos-prud.firebasestorage.app",
  messagingSenderId: "987194647488",
  appId: "1:987194647488:web:7b184d25f3e5a08ea39e25",
  measurementId: "G-0HG4P6EMEW"
};

// ── Init ──
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Session Persistence ──
setPersistence(auth, browserLocalPersistence).catch(console.error);

// ── Offline Persistence ──
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn("Firestore offline persistence failed: multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("Firestore offline persistence not supported in this browser.");
  }
});

export { app, auth, db };
