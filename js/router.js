// ============================================================
// FlexPOS — Router / Route Guard
// Role-based page access control
// ============================================================

import { onAuthChange, getCurrentUserDoc } from './auth.js';

// ── Page permissions per role ──
const ROLE_PAGES = {
  admin: [
    'dashboard', 'pos', 'products', 'inventory', 'customers',
    'orders', 'expenses', 'reports', 'settings', 'profile'
  ],
  manager: [
    'dashboard', 'products', 'inventory', 'customers',
    'orders', 'expenses', 'reports', 'profile'
  ],
  cashier: [
    'pos', 'orders', 'customers', 'profile'
  ]
};

// ── Default page per role ──
const ROLE_DEFAULT = {
  admin:   '/dashboard.html',
  manager: '/dashboard.html',
  cashier: '/pos.html'
};

// ── Derive page name from URL ──
function getPageName() {
  const path = window.location.pathname;
  const file = path.split('/').pop().replace('.html', '') || 'index';
  return file;
}

// ── Guard: call on every protected page ──
export function guard() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthChange(async (user) => {
      unsubscribe();

      if (window._registering) {
        resolve(null);
        return;
      }

      const page = getPageName();

      // Not logged in → redirect to login
      if (!user) {
        if (page !== 'index') {
          window.location.href = '/index.html';
        }
        resolve(null);
        return;
      }

      // Logged in on login page → redirect to role default
      if (page === 'index') {
        const userDoc = await getCurrentUserDoc();
        if (userDoc) {
          window.location.href = ROLE_DEFAULT[userDoc.role] || '/dashboard.html';
        }
        resolve(null);
        return;
      }

      // Check page access
      const userDoc = await getCurrentUserDoc();
      if (!userDoc) {
        window.location.href = '/index.html';
        resolve(null);
        return;
      }

      const allowed = ROLE_PAGES[userDoc.role] || [];
      if (!allowed.includes(page)) {
        window.location.href = ROLE_DEFAULT[userDoc.role] || '/index.html';
        resolve(null);
        return;
      }

      resolve(userDoc);
    });
  });
}

// ── Navigate to role default ──
export function goToDefault(role) {
  window.location.href = ROLE_DEFAULT[role] || '/index.html';
}

export { ROLE_PAGES, ROLE_DEFAULT };
