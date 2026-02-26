# Custom app icon and splash

Your app uses custom assets in `assets/icon.png`, `assets/splash-icon.png`, and `assets/adaptive-icon.png`. They only appear when the app is run as a **standalone build**, not inside Expo Go.

## Why you still see the default icon

- **Expo Go**: When you open the project with **Expo Go** (QR code / “Run in Expo Go”), the icon and splash you see are **Expo Go’s**, not your app’s. Expo Go is a single app that loads your project; it cannot show your custom icon on the home screen or as the main splash.
- **Custom icon and splash** are applied only when you build and run your **own** app binary (development or production build).

## How to see your custom icon and splash

You need to create and run a **development build** (or a production build) so your icon and splash are baked into the app.

### 1. Regenerate native projects with latest assets

```bash
npx expo prebuild --clean
```

This recreates the `ios` and `android` folders using your current `app.json` and `assets/`.

### 2. Run the app as a native build (not Expo Go)

**iOS (Mac with Xcode):**

```bash
npx expo run:ios
```

**Android:**

```bash
npx expo run:android
```

This builds and installs an app that uses your `icon.png` and `splash-icon.png`. The home screen icon and the splash screen will be your custom ones.

### 3. Optional: EAS Build (cloud build)

If you use EAS:

```bash
eas build --platform ios
# or
eas build --platform android
```

Install the built binary on a device/simulator; that app will show your icon and splash.

## Summary

| How you run the app        | Icon / splash you see   |
|----------------------------|--------------------------|
| Expo Go (QR code, “Run in Expo Go”) | Expo Go’s default icon and splash |
| `npx expo run:ios` or `run:android` | Your custom icon and splash       |
| EAS Build → install .ipa/.apk       | Your custom icon and splash       |

Your assets are set up correctly; to see them, run a **development or production build** instead of Expo Go.
