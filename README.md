# ⚡ VoltCharge Bhopal

<div align="center">

![VoltCharge Banner](https://img.shields.io/badge/VoltCharge-Bhopal%20Smart%20Grid-10b981?style=for-the-badge&logo=zap&logoColor=white)

**A Real-Time EV Charging Station Locator & Slot Booking Platform for Bhopal City**

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-volthub--bhopal.web.app-10b981?style=for-the-badge)](https://volthub-bhopal.web.app)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![React](https://img.shields.io/badge/React-18%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-Build%20Tool-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## 🌐 Live Demo

> **[https://volthub-bhopal.web.app](https://volthub-bhopal.web.app)**

---

## 📖 About

VoltCharge Bhopal is a smart EV charging station management platform built specifically for Bhopal city as part of **Hackathon 2026**. It solves the real problem of EV users having no unified platform to locate chargers, check real-time availability, and book charging slots — all without wasting a trip to an already-occupied station.

The platform features live map-based station discovery, slot booking with a simulated payment gateway, booking cancellation, hub owner registration, an admin panel for station management, and AI-powered smart re-routing via Gemini 1.5 Flash.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Live Map** | Interactive dark-theme Leaflet map showing all 6 Bhopal EV stations |
| 🟢 **Real-Time Availability** | Firebase `onSnapshot()` updates station status instantly across all users |
| 📅 **Slot Booking** | Select time slots and confirm bookings with a simulated payment flow |
| 💳 **VoltPay Gateway** | Animated 3-step payment simulation before confirming booking |
| ❌ **Booking Cancellation** | Cancel bookings and instantly free the slot for other users |
| 🔐 **Google Authentication** | Secure login via Firebase Auth + Google OAuth |
| 🛡️ **Hub Owner Registration** | One-time permanent registration to own and manage a charging hub |
| ⚙️ **Admin Panel** | Hub owners can update pricing, add slots, toggle availability |
| 📊 **Analytics Dashboard** | Revenue, bookings, uptime, and historical load chart |
| 🧭 **Map Legend** | Floating station states guide with hover glow effects |
| 📡 **Network Overview** | Live availability gauge and grid distribution in sidebar |
| 🤖 **Gemini AI Re-routing** | Smart re-routing suggestions when user is predicted to be late |
| 📍 **Distance Tracking** | Haversine formula calculates real distance to each station |

---

## 🏗️ Tech Stack

```
Frontend       React 18 + TypeScript
Build Tool     Vite
Styling        Tailwind CSS v4 + Custom CSS
Animations     Framer Motion
Maps           React Leaflet + CartoDB Dark Tiles
Backend        Firebase Firestore (Real-time DB)
Auth           Firebase Authentication (Google OAuth)
AI             Google Gemini 1.5 Flash API
Hosting        Firebase Hosting
Icons          Lucide React
```

---

## 🗺️ Implementation Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                    USER OPENS APP                           │
│              React + Vite loads at browser                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               FIREBASE AUTH CHECK                           │
│           onAuthStateChanged() fires                        │
└────────────┬────────────────────────┬───────────────────────┘
             │ NOT LOGGED IN          │ LOGGED IN
             ▼                        ▼
    ┌─────────────────┐     ┌──────────────────────┐
    │ Google Sign-In  │     │  User Profile Loaded  │
    │ Popup opens     │     │  uid · email · name   │
    └────────┬────────┘     └──────────┬───────────┘
             └──────────┬─────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  LEAFLET MAP LOADS                          │
│     CartoDB dark tiles · Center: Bhopal [23.26, 77.41]     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│          FIRESTORE onSnapshot() → /stations                 │
│   Real-time stream. Empty? → Auto-seed 6 Bhopal stations   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           6 STATION MARKERS RENDERED ON MAP                 │
│     🟢 Green = Available  ·  🔴 Red = Occupied             │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks marker
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              STATION DETAIL SIDEBAR OPENS                   │
│     Name · Type · Pricing · Distance (Haversine)           │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects slot
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  CONFIRM BOOKING                            │
│              VoltPay Gateway Popup (5s)                     │
│   Step 1: Connecting → Step 2: Processing → Step 3: Done   │
└──────────────────────┬──────────────────────────────────────┘
                       │ Payment success
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FIREBASE WRITE OPERATIONS                      │
│   addDoc('/bookings') → updateDoc('/stations') →           │
│   isAvailable: false · Real-time sync to all users         │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             ▼                        ▼
    ┌─────────────────┐     ┌──────────────────────┐
    │  SUCCESS MODAL  │     │   CANCEL BOOKING      │
    │  Node Reserved  │     │   deleteDoc() →       │
    │  + Navigation   │     │   isAvailable: true   │
    └─────────────────┘     └──────────────────────┘
```

---

## 📊 Station Network Overview

```
Station Distribution across Bhopal
────────────────────────────────────────────────────────

  MP Nagar EV Grid          ████████████████  CCS2 Fast  ₹18/kWh
  Arera Smart Charge        ████████████░░░░  Type 2 AC  ₹15/kWh
  DB City Supercharger      ████████████████  CCS2 Fast  ₹22/kWh
  Habibganj Station Hub     ████████████████  CCS2 Fast  ₹19/kWh
  Gulmohar Eco Point        ████████████░░░░  Type 2 AC  ₹14/kWh
  Indrapuri Tech Charge     ████████████████  CCS2 Fast  ₹20/kWh

  🟢 CCS2 Fast Chargers  ████████████████████  4 stations (67%)
  🟡 Type 2 AC Chargers  ██████████░░░░░░░░░░  2 stations (33%)

Pricing Range
────────────────────────────────────────────────────────
  Min  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ₹14/kWh
  Avg  ████████████████░░░░░░░░░░░░░░░  ₹18/kWh
  Max  ██████████████████████████████░  ₹22/kWh

Booking Slots Available Per Station
────────────────────────────────────────────────────────
  09:00 AM  ██████████████████████████████  All stations
  11:00 AM  ██████████████████████████████  All stations
  01:00 PM  ██████████████████████████████  All stations
  03:00 PM  ██████████████████████████████  All stations
  05:00 PM  ██████████████████████████████  All stations
  07:00 PM  ██████████████████████████████  All stations
```

---

## 🗂️ Project Structure

```
volt-charge-bhopal/
├── public/
├── src/
│   ├── lib/
│   │   └── firebase.ts          # Firebase init + exports
│   ├── App.tsx                  # Main app component
│   ├── index.css                # Global styles + Tailwind
│   ├── main.tsx                 # React entry point
│   └── types.ts                 # TypeScript interfaces
├── .env.local                   # Local env variables (not committed)
├── .env.production              # Production env variables (not committed)
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- A Firebase project
- Google Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/volt-charge-bhopal.git
cd volt-charge-bhopal
```

**2. Install dependencies**
```bash
npm install
```

**3. Create `.env.local` file**
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_GEMINI_API_KEY=your_gemini_key
```

**4. Enable Firebase services**
- Firebase Console → Authentication → Enable Google provider
- Firebase Console → Firestore → Create database (test mode)
- Firebase Console → Firestore → Rules → paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stations/{stationId} {
      allow read, write: if true;
    }
    match /bookings/{bookingId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**5. Run locally**
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

---

## 🚢 Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```
Live at: **[https://volthub-bhopal.web.app](https://volthub-bhopal.web.app)**

---

## 🔐 Hub Owner System

```
Station (Unclaimed)
       │
       │  Logged-in user clicks "Register as Hub Owner"
       ▼
Registration Modal
  └── Full Name
  └── Phone Number
  └── Google Account (auto-verified)
       │
       │  Submits → Firestore ownerId = user.uid
       ▼
Station (Registered) ── LOCKED ──► No one else can register
       │
       │  Owner logs in + selects their station
       ▼
Admin Panel (Owner Only)
  ├── Update Pricing (₹/kWh)
  ├── Add / Manage Time Slots
  └── Toggle Manual Availability
```

---

## 🤖 Gemini AI Smart Re-routing

Every 10 seconds the system:
1. Calculates user's distance to their booked station
2. Estimates ETA based on 30km/h average speed
3. If ETA > 10 minutes → calls Gemini 1.5 Flash API
4. Gemini analyzes available alternative stations
5. If Gemini responds `YES` → shows re-route suggestion overlay
6. User can accept (switch station) or dismiss

---

## 👥 Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🏆 Built for Hackathon 2026

<div align="center">

Made with ⚡ by **Team VoltCharge Bhopal**

[![Live Demo](https://img.shields.io/badge/🌐%20Live-volthub--bhopal.web.app-10b981?style=for-the-badge)](https://volthub-bhopal.web.app)

</div>
