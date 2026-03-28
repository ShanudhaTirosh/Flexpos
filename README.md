# FlexPOS — Enterprise Point of Sale System

A complete, production-ready Point of Sale system built with HTML5, Vanilla JavaScript, Bootstrap 5, and Firebase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| UI | Bootstrap 5.3 + Bootstrap Icons 1.11 + Custom Glassmorphism |
| Auth | Firebase Authentication (Email/Password) |
| Database | Cloud Firestore |
| Images | Client-side Canvas compression → Base64 in Firestore |
| Charts | Chart.js 4.x |
| Barcodes | JsBarcode + QRCode.js |
| Exports | jsPDF + SheetJS |

---

## Features

- **3 Role System**: Admin, Manager, Cashier — each with page-level access control
- **POS Screen**: Product grid, barcode scan, cart, discounts, multi-payment, receipt
- **Product Catalog**: CRUD with drag-and-drop image upload, auto EAN-13 barcode, QR codes, CSV import
- **Inventory**: Real-time stock levels, adjustment history, supplier tracking
- **Customers**: Purchase history, loyalty points, search
- **Orders**: Full transaction history, date filters, refund processing with stock restore
- **Expenses**: Categorized expense tracking with monthly charts
- **Reports**: 6 report types with Chart.js visualization + PDF/CSV export
- **Settings**: Business info, tax, currency, user management (admin only)
- **Profile**: Personal stats, password change
- **Dark/Light Mode** with localStorage persistence
- **Offline support** via Firestore IndexedDB persistence
- **Cart persistence** via localStorage across page refreshes
- **Mobile responsive** with bottom navigation on small screens

---

## Project Structure

```
flexpos/
├── index.html              ← Login / Register
├── dashboard.html          ← Sales overview, charts, live stats
├── pos.html                ← Main billing screen
├── products.html           ← Product catalog
├── inventory.html          ← Stock management
├── customers.html          ← Customer CRM
├── orders.html             ← Transaction history + refunds
├── expenses.html           ← Expense tracking
├── reports.html            ← Analytics + exports
├── settings.html           ← Admin system settings
├── profile.html            ← User profile
├── css/
│   ├── main.css            ← Global styles + glassmorphism
│   ├── sidebar.css         ← Navigation sidebar
│   └── pos.css             ← POS screen styles
├── js/
│   ├── firebase-config.js  ← Firebase init (EDIT THIS)
│   ├── auth.js             ← Login, register, session
│   ├── router.js           ← Route guards per role
│   ├── sidebar.js          ← Sidebar toggle + clock
│   ├── layout.js           ← HTML sidebar/topbar builder
│   ├── theme.js            ← Dark/light mode
│   ├── imageService.js     ← Canvas compression → Base64
│   ├── barcodeService.js   ← EAN-13 + QR generation
│   ├── exportService.js    ← PDF + CSV
│   ├── utils.js            ← Toast, confirm, paginator, sound
│   └── pages/
│       ├── pos.js          ← POS screen logic
│       └── products.js     ← Products page logic
├── firestore.rules         ← Security rules
├── firebase.json           ← Hosting config
└── .firebaserc             ← Project alias (EDIT THIS)
```

---

## Setup Guide

### Step 1 — Create Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **Add project**
3. Enter a project name (e.g., `flexpos-prod`)
4. Disable Google Analytics (optional) → **Create project**

### Step 2 — Enable Authentication

1. In Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** tab → **Email/Password** → Enable → **Save**

### Step 3 — Create Firestore Database

1. **Firestore Database** → **Create database**
2. Select **Start in production mode**
3. Choose your region → **Done**

### Step 4 — Get Firebase Config

1. Project Settings (gear icon) → **Your apps** → **Add app** → Web (`</>`)
2. Register app name (e.g., `FlexPOS`)
3. Copy the `firebaseConfig` object

### Step 5 — Update Config File

Open `js/firebase-config.js` and replace the placeholder:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef..."
};
```

Also update `.firebaserc`:
```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

### Step 6 — Deploy Firestore Security Rules

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### Step 7 — Set First Admin User

After registering your account via the web app:

1. Firebase Console → **Firestore Database** → `users` collection
2. Find your user document (by UID or email)
3. Edit the `role` field → set to `"admin"`
4. Edit the `active` field → set to `true`

> Only the first admin needs to be set manually. After that, admins can promote users from Settings → User Management.

### Step 8 — Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

Or deploy everything:
```bash
firebase deploy
```

Your app will be live at: `https://your-project-id.web.app`

---

## Local Development

Since this uses ES Modules and Firebase's modular SDK, you need to serve files over HTTP (not `file://`). Use any local server:

```bash
# Python
python3 -m http.server 3000

# Node.js (npx)
npx serve .

# VS Code Live Server extension
```

Then open: [http://localhost:3000](http://localhost:3000)

---

## Keyboard Shortcuts (POS Screen)

| Key | Action |
|---|---|
| `F2` | Focus product search bar |
| `F4` | Open payment modal |
| `F8` | Clear cart |
| `Escape` | Close any modal |
| `Enter` (in search) | Add first matching product to cart |

---

## Firestore Data Architecture

```
users/{uid}                    → User profile + role
products/{productId}           → Product catalog
categories/{categoryId}        → Product categories
customers/{customerId}         → Customer CRM
transactions/{txnId}           → All POS transactions
stockLogs/{logId}              → Stock adjustment history
suppliers/{supplierId}         → Supplier records
expenses/{expenseId}           → Business expenses
settings/business              → Business info + logo
settings/tax                   → Tax rate + name
settings/currency              → Currency symbol + code
settings/inventory             → Global stock threshold
```

---

## Role Permissions

| Page | Admin | Manager | Cashier |
|---|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | — |
| POS | ✅ | ✅ | ✅ |
| Products | ✅ | ✅ | — |
| Inventory | ✅ | ✅ | — |
| Customers | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ |
| Expenses | ✅ | ✅ | — |
| Reports | ✅ | ✅ | — |
| Settings | ✅ | — | — |
| Profile | ✅ | ✅ | ✅ |

---

## Known Limitations & Notes

- **No Firebase Storage**: Images are compressed to <100KB via Canvas API and stored as Base64 in Firestore documents. Works well for product thumbnails and logos.
- **Firestore Composite Indexes**: The app avoids combining `where()` + `orderBy()` on different fields to prevent index errors. Sorting is done client-side.
- **Race condition guard**: A `window._registering` flag prevents `onAuthStateChanged` from redirecting before the Firestore user document is written on registration.
- **Offline mode**: Enabled via `enableIndexedDbPersistence` — basic reads work offline; writes are queued.

---

## Production Checklist

- [ ] Replace Firebase config placeholders
- [ ] Deploy Firestore security rules
- [ ] Set first admin user via Firebase Console
- [ ] Configure business info in Settings
- [ ] Set tax rate and currency in Settings
- [ ] Add product categories and products
- [ ] Create cashier accounts via Register or Firebase Console
- [ ] Test POS flow end-to-end

---

© 2025 FlexPOS. Built for real businesses.
