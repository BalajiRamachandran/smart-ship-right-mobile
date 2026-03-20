# Publishing SmartShipRight to iOS and Android (Expo / EAS)

This guide walks you through publishing the app when you **don’t have credentials yet**.  
EAS Build can **generate and manage** signing credentials for you; you only need to create **developer accounts** (Apple and Google) when you’re ready to publish to the stores.

---

## 1. Two kinds of “credentials”

| What | Who provides it | When you need it |
|------|------------------|-------------------|
| **Signing credentials** (iOS certificate + provisioning profile, Android keystore) | **EAS can generate and store these for you** | When you run a production build |
| **Developer accounts** (Apple Developer, Google Play Console) | **You create and pay for these** | When you submit to App Store / Play Store |

You can build installable apps (e.g. for internal testing) **without** developer accounts by using EAS-managed credentials. You only need the accounts when you want to submit to the public stores.

---

## 2. Prerequisites

- **Node.js** and **npm** (you already have these)
- **Expo account** (free): [expo.dev](https://expo.dev) → Sign up
- **EAS CLI**: install globally or use `npx` (see below)

Your project already has:

- `app.json` with `extra.eas.projectId` and `owner`
- `eas.json` with `development`, `preview`, and `production` build profiles

---

## 3. Install EAS CLI and log in

From the app root (`smart-ship-right-mobile/`):

```bash
npm install -g eas-cli
eas login
```

Log in with your Expo account. If the project isn’t linked yet, EAS will use the `projectId` in `app.json` to link it.

---

## 4. Build for iOS and Android (no credentials yet)

EAS will **create and store** credentials for you when you run a production build for the first time.

### One-time: choose how to manage credentials

When you run the first **iOS** production build, EAS will ask something like:

- **Generate new credentials and let EAS manage them** → choose this if you don’t have your own
- Or “I want to use my own credentials” (you’d add them later)

For **Android**, EAS will offer to generate an upload keystore and store it on EAS. Accept that if you don’t have a keystore yet.

### Build commands

**Both platforms (recommended for first time):**

```bash
eas build --platform all --profile production
```

**Only iOS:**

```bash
eas build --platform ios --profile production
```

**Only Android:**

```bash
eas build --platform android --profile production
```

- First run may ask you to confirm **Apple Team ID** (iOS) or to **create a new keystore** (Android). Choose the options that let EAS generate and manage credentials.
- Builds run in the cloud. When they finish, you get a link to download the `.ipa` (iOS) and `.aab` / `.apk` (Android).

You can share the built files for internal testing even before you have App Store / Play Store accounts.

---

## 5. When you’re ready to publish to the stores

### iOS (App Store)

1. **Apple Developer account**  
   - [developer.apple.com](https://developer.apple.com) → Enroll ($99/year).  
   - You need this to submit to the App Store.

2. **First iOS build**  
   - When you run `eas build --platform ios --profile production`, EAS will prompt for your Apple Team ID and can create the distribution certificate and provisioning profile.  
   - Use the same Expo/Apple account so EAS can manage credentials.

3. **Submit to App Store Connect**  
   - After a successful build:
     ```bash
     eas submit --platform ios --profile production
     ```
   - EAS will use the latest iOS build and guide you through selecting the build and App Store Connect app (you create the app in [App Store Connect](https://appstoreconnect.apple.com) if you haven’t already).

### Android (Google Play)

1. **Google Play Developer account**  
   - [play.google.com/console](https://play.google.com/console) → Sign up ($25 one-time).  
   - You need this to publish on Play Store.

2. **First Android build**  
   - When you run `eas build --platform android --profile production`, EAS will offer to generate an upload keystore and store it.  
   - Say yes so you don’t have to manage the keystore yourself.

3. **Submit to Play Console**  
   - After a successful build:
     ```bash
     eas submit --platform android --profile production
     ```
   - EAS will use the latest Android build (AAB). In Play Console you create the app and upload the first version (or use EAS Submit to upload the AAB).

---

## 6. Summary checklist

| Step | Action |
|------|--------|
| 1 | Create Expo account, run `eas login` |
| 2 | Run `eas build --platform all --profile production`; when prompted, let EAS **generate and manage** credentials |
| 3 | Download builds from the EAS dashboard for testing |
| 4 | When ready for stores: enroll in [Apple Developer](https://developer.apple.com) and [Google Play Console](https://play.google.com/console) |
| 5 | Run `eas submit --platform ios --profile production` and `eas submit --platform android --profile production` after your first store-ready build |

---

## 7. Useful commands

```bash
# List builds
eas build:list

# Build for internal distribution (no store submission)
eas build --platform all --profile preview

# Submit latest production build to stores (after you have accounts)
eas submit --platform ios --profile production
eas submit --platform android --profile production

# Update app version before a new store submission (then rebuild)
# Bump "version" in app.json and/or "versionCode" (Android) / build number (iOS)
# Your eas.json has "autoIncrement": true in production, so build numbers can auto-increment
```

---

## 8. Your current config (reference)

- **Bundle ID (iOS):** `com.bramkas.smartshipright`
- **Package (Android):** `com.bramkas.smartshipright`
- **EAS project:** linked via `app.json` (`projectId`, `owner`)
- **Profiles:** `development` (simulator/internal), `preview` (internal), `production` (store builds with auto-increment)

You do **not** need to create credentials yourself first. Run the production build, follow the prompts to let EAS generate and manage credentials, then when you have Apple and Google accounts, use `eas submit` to publish.
