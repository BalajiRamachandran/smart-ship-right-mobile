# Smart Ship Right Mobile

A React Native (Expo) mobile app for warehouse operations: orders, inventory moves, and batch picking. Built for field workers who need a fast, scan-first workflow similar to ShipHero-style flows.

---

## Features

- **Orders** — Browse and filter orders by status (Pending, Picking, Packed, Shipped, Hold, Cancelled) and sort by date, amount, or customer. Infinite scroll pagination and pull-to-refresh.
- **Move SKU** — Move inventory between locations: scan SKU → scan source → scan destination → enter quantity → confirm. Step-by-step flow with progress and confirmation screen.
- **Picking** — Create picking batches (quick start or custom by category/type/order count), assign a tote, scan items to pick, and complete the batch. Progress strip and single primary action per step (scan tote, scan next item).

All flows use the device camera for barcode scanning and are designed for one-handed, task-focused use.

---

## Tech Stack

| Layer        | Technology |
|-------------|------------|
| Framework   | [Expo](https://expo.dev) (~54) |
| UI          | React Native 0.81, [React Navigation](https://reactnavigation.org/) (native stack + bottom tabs) |
| Icons       | [Lucide React Native](https://lucide.dev/) |
| HTTP        | Axios |
| State       | [Zustand](https://github.com/pmndrs/zustand) (auth, debug, Move SKU persist) |
| Language    | TypeScript 5.9 |

---

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Expo Go** on your phone (for quick testing), or Xcode / Android Studio for dev builds
- **Backend API** — the app expects a Ship Right–compatible API (auth, orders, inventory, picking). See [Environment](#environment) for the base URL.

---

## Installation

```bash
# Clone the repo (if not already)
cd smart-ship-right-mobile

# Install dependencies
npm install
```

---

## Environment

Create a `.env` file in the project root (see `.env.example`):

```env
# Backend API base URL (no trailing slash)
# Examples: https://your-api.example.com  or  http://192.168.1.100:8080
EXPO_PUBLIC_API_URL=http://192.168.86.125:8080

# Optional: show verbose debug logs and errors on screen (Move SKU, Picking, etc.)
EXPO_PUBLIC_SCREEN_DEBUG=false
```

- **EXPO_PUBLIC_API_URL** — Required for all API calls. Use your machine’s LAN IP (e.g. `http://192.168.x.x:8080`) when testing on a physical device with Expo Go so the phone can reach the backend.
- **EXPO_PUBLIC_SCREEN_DEBUG** — When `true`, surfaces detailed API errors and debug info on screen; set to `false` in production.

If `EXPO_PUBLIC_API_URL` is not set, the app falls back to a default URL defined in `src/config/api.ts`.

---

## Running the App

### Development (Expo Go)

```bash
npm start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS). Ensure your phone and computer are on the same network and that `.env` points to a backend reachable from the phone (e.g. LAN IP, not `localhost`).

```bash
# Start with cache cleared (e.g. after changing env or assets)
npx expo start -c
```

### iOS Simulator

```bash
npx expo start --ios
```

### Android Emulator

```bash
npx expo start --android
```

### Development build (custom app icon and native modules)

To run with your app icon and a standalone build:

```bash
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

---

## Project Structure

```
smart-ship-right-mobile/
├── App.tsx                 # Root: auth gate, root stack (Login | Main)
├── index.ts                # Entry: registerRootComponent(App)
├── app.json                # Expo config (name, icon, splash, etc.)
├── .env                    # Local env (not committed; see .env.example)
├── assets/
│   ├── icon.png            # App icon (1024×1024)
│   ├── adaptive-icon.png   # Android adaptive icon foreground
│   ├── splash-icon.png     # Splash screen
│   └── favicon.png         # Web favicon
└── src/
    ├── api/
    │   └── client.ts       # Axios instance, auth header, debug logging
    ├── config/
    │   ├── api.ts         # getApiBaseUrl() from env
    │   └── debug.ts       # Screen-level debug flag
    ├── navigation/
    │   ├── types.ts       # Root, Main tab, MoveSku, Picking param lists
    │   ├── MainTabs.tsx   # Bottom tabs: Orders | Move SKU | Picking
    │   ├── MoveSkuStack.tsx
    │   └── PickingStack.tsx
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── MoveSkuScreen.tsx
    │   ├── PickingScreen.tsx
    │   ├── BarcodeScannerScreen.tsx
    │   └── Orders/
    │       └── OrdersListScreen.tsx
    ├── store/
    │   ├── authStore.ts   # Login, logout, token, user
    │   ├── debugStore.ts  # Debug log entries
    │   └── moveSkuPersistStore.ts  # Move SKU step/SKU/locations persist
    ├── theme.ts           # Colors, spacing, typography, radius, shadow
    ├── types/
    │   └── user.ts
    └── utils/
        └── formatApiError.ts
```

---

## API Overview

The app assumes a REST backend that provides at least:

| Area   | Endpoints (examples) |
|--------|------------------------|
| Auth   | `POST /api/auth/login` (username, password → access_token, user) |
| Orders | `GET /api/orders` (params: limit, skip, sort, order, status) |
| Inventory | `GET /api/inventory/skus/:id`, location/SKU lookups, move API |
| Picking | `GET /api/picking/batches/available-orders`, `POST /api/picking/batches/create-dynamic`, `GET /api/picking/batches/:id/pick-list`, tote lookup, complete batch |

All authenticated requests use `Authorization: Bearer <token>`. The base URL is set via `EXPO_PUBLIC_API_URL`.

---

## Scripts

| Command | Description |
|--------|-------------|
| `npm start` | Start Expo dev server |
| `npm run ios` | Start and open iOS simulator |
| `npm run android` | Start and open Android emulator |
| `npm run web` | Start Expo for web |

---

## Building for Production

- **EAS Build** (Expo Application Services): configure `eas.json` and run `eas build` for iOS/Android.
- **Local build**: after `npx expo prebuild`, open the `ios` or `android` folder in Xcode or Android Studio and archive / build as usual.

Ensure production builds use a production `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SCREEN_DEBUG=false` (or omit debug).

---

## License

Private. All rights reserved.
