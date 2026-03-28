// ============================================================
// FlexPOS — Auth Module
// Login, logout, session management, registration
// ============================================================

import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Registration flag to prevent race condition ──
window._registering = false;

// ── Login ──
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Register ──
export async function register(name, email, password, role = 'cashier') {
  window._registering = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      name,
      email,
      role,
      createdAt: serverTimestamp(),
      active: true
    });
    return cred.user;
  } finally {
    // Short delay so onAuthStateChanged doesn't fire before Firestore write
    setTimeout(() => { window._registering = false; }, 1500);
  }
}

// ── Logout ──
export async function logout() {
  localStorage.removeItem('fp_user_cache');
  await signOut(auth);
  window.location.href = '/index.html';
}

// ── Get current user doc (with cache) ──
export async function getCurrentUserDoc() {
  const user = auth.currentUser;
  if (!user) return null;

  // Try localStorage cache first for speed
  try {
    const cached = localStorage.getItem('fp_user_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.uid === user.uid) return parsed;
    }
  } catch (_) {}

  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) return null;
  const data = { uid: user.uid, ...snap.data() };

  try {
    localStorage.setItem('fp_user_cache', JSON.stringify(data));
  } catch (_) {}

  return data;
}

// ── Get user role ──
export async function getUserRole() {
  const userDoc = await getCurrentUserDoc();
  return userDoc?.role || null;
}

// ── Auth state observer ──
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Password reset ──
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// ── Populate sidebar user info ──
export function populateSidebarUser(userDoc) {
  const nameEl   = document.getElementById('sidebar-user-name');
  const roleEl   = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');

  if (!userDoc) return;

  if (nameEl) nameEl.textContent = userDoc.name || userDoc.email;
  if (roleEl) {
    roleEl.textContent  = userDoc.role;
    roleEl.className    = `role-badge role-${userDoc.role}`;
  }
  if (avatarEl) {
    const initials = (userDoc.name || userDoc.email || 'U')
      .split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    avatarEl.textContent = initials;
  }
}

export { auth, db };
