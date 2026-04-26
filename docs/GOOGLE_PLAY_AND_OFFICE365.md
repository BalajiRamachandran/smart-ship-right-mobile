# Google Play + EAS when your company email is Office 365 (`@smartshipright.com`)

Your **Microsoft 365 / Office 365** mailbox is **not** the same as a **Google account**. Google Play Console and **Google Cloud** (for API uploads) both live in Google’s ecosystem. This doc explains what to use where.

---

## What you need from whom

| System | What it uses | Your `@smartshipright.com` (Office 365) |
|--------|----------------|----------------------------------------|
| **Google Play Console** | A **Google account** (sign-in) | Does **not** replace Google sign-in unless you have **Google Workspace** on the same domain with users synced to Google. Most M365-only companies use a **dedicated Gmail** or a **Google Workspace** account for the Play *organization*. |
| **Google Cloud** (service account + JSON key) | Google Cloud project | Independent of Outlook; often created by the same person who administers Play, using their **Google** login. |
| **EAS (Expo)** | Expo account + EAS secrets | Unrelated to M365; you’re already building as `bramkas-inc` / your Expo org. |

**Bottom line:** Registering “with Google Play” still means a **Google identity** for the developer account. Office 365 is fine for **company contact email** in Play listings, but **sign-in and API keys** are Google-side.

---

## Recommended setup (practical)

1. **Play Console owner**  
   Use a stable **Google account** (e.g. `smartshipright.play@gmail.com` or your org’s **Google Workspace** user if you have it).  
   - In Play Console you can set **contact details** and **support email** to `something@smartshipright.com` (Office 365) for customers—that’s normal.

2. **Create the app in Play Console**  
   - Application ID must match: **`com.smartshipright`** (see `app.json` → `expo.android.package`).

3. **Google Cloud → service account (for `eas submit`)**  
   - In [Google Cloud Console](https://console.cloud.google.com), create/select a project.  
   - Enable **Google Play Android Developer API**.  
   - **IAM & Admin** → **Service accounts** → create account → **Keys** → **Add key** → JSON → download **once** and store safely.

   **Using the `gcloud` CLI (optional but common):** sign in once on your machine with a **Google** account (not Office 365 by itself):

   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable androidpublisher.googleapis.com
   ```

   Then create the service account and JSON key in the [Cloud Console IAM](https://console.cloud.google.com/iam-admin/serviceaccounts) UI, or via `gcloud iam service-accounts` / `keys create` if your team prefers full CLI. **EAS Submit does not run `gcloud`** on each upload—it only needs the **JSON key** as the `GOOGLE_SERVICE_ACCOUNT_KEY` secret.

4. **Link service account to Play**  
   - [Play Console](https://play.google.com/console) → **Users and permissions** → **Invite new users**.  
   - Paste the service account email (ends with `gserviceaccount.com`).  
   - Grant **access to this app** (Expo docs often suggest sufficient permissions for releases; many teams use **Admin** on the app for the service account to avoid permission errors—tighten later if IT requires).

5. **Attach the JSON to EAS (required for `eas submit`)**  
   Expo’s [Android submit guide](https://docs.expo.dev/submit/android/) expects the key under **project Credentials**, not only a generic env var:

   1. Open [expo.dev](https://expo.dev) → your **project** → **Credentials**.
   2. **Android** → select application id **`com.smartshipright`**.
   3. Under **Service credentials** → **Add a Google Service Account Key** → **Upload new key** → choose your downloaded `.json`.

   After it’s stored there, **`eas submit --platform android --non-interactive`** can use it in CI. If you only added the JSON under **Environment variables**, run **`eas submit --platform android`** once **interactively** in a terminal (so EAS can link credentials), or add the key in **Credentials** as above.

   Optional: also set **`GOOGLE_SERVICE_ACCOUNT_KEY`** in EAS env if other tooling expects it; **submit** still relies on the **Credentials** upload for the standard flow.

6. **Build an Android App Bundle for production**  
   ```bash
   cd smart-ship-right-mobile
   npx eas-cli@latest build --platform android --profile production --non-interactive
   ```

7. **Submit to Play (e.g. internal testing first)**  
   ```bash
   npx eas-cli@latest submit --platform android --profile production --latest
   ```  
   First time, Play may still ask you to complete **policy, content rating, signing**, etc. in the browser—EAS only uploads the binary.

---

## If IT only allows `@smartshipright.com` (no shared Gmail)

Options:

- **Google Workspace** on `smartshipright.com` (paid Google) → real Google users `@smartshipright.com` can own Play + Cloud.  
- Or **one agreed Google account** (e.g. `play-console@…`) stored in a password manager, **not** the same as M365 login.

Expo does **not** need your Office 365 password.

---

## `eas.json` in this repo

- **`production`** Android build: defaults to **AAB** (correct for Play).  
- **`preview`**: APK for sideloading, not for default production store upload.  
- **`submit.production`**: includes Android **`track`**: `internal` and **`releaseStatus`**: `draft` (adjust when you promote releases). Credentials for Play API still come from **EAS → Credentials → Google Service Account Key**.

---

## Checklist before first successful upload

- [ ] Play app created with package **`com.smartshipright`**
- [ ] Google Cloud: API enabled + JSON key created
- [ ] Play Console: service account invited with app access
- [ ] EAS: `GOOGLE_SERVICE_ACCOUNT_KEY` set
- [ ] Store listing / privacy / data safety (as Play requires) filled in Play Console
- [ ] `eas build` production Android finished
- [ ] `eas submit --platform android --profile production --latest`

---

## Need IT to approve something?

Send them:

- **Purpose:** CI/CD upload of Android builds to **our** Google Play app via **official Google Play Developer API** and a **dedicated service account** (no human Google password in Expo).  
- **Data:** The JSON key is a **machine credential**; rotate/delete in Google Cloud if leaked.  
- **Scope:** Only the Play app(s) you grant that service account in Play Console.

This file is documentation only; it does not store secrets.
