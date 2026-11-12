# LocalLink — Public Deployment, App Install & Store Publishing Guide

LocalLink is now configured as both:
1. An **installable HTTPS Web App (PWA)** with one-tap **Install LocalLink App** support and offline shell (`manifest.json` + `sw.js` + `app-bridge.js`).
2. A **Capacitor Native Android & iOS Project** (`android/`, `ios/`, `www/`) with minimal, Google-Play-safe permissions.

---

## Why "Your connection is not private" / Phone Download Only Works on Home Wi-Fi Right Now

- Your Mac is currently running the server on your private LAN IP (`http(s)://192.168.31.157:5001`) with a self-signed certificate.
- Chrome and mobile operating systems mark self-signed IPs as **"Not Private"** and block 1-tap PWA installation unless the site is served over **trusted HTTPS on a public domain**.
- Similarly, sideloaded **unsigned debug APK** files trigger Android **"Harmful app / Play Protect"** prompts. Signing releases with an upload keystore and distributing via HTTPS PWA or Google Play / App Store eliminates those warnings completely.

---

## Part 1 — Go Live on Real HTTPS Cloud Hosting (Railway or Render)

### Option A: Railway (Recommended — Built-in MySQL + Auto HTTPS)
1. Push this repository to GitHub (`.gitignore` already excludes `.env`, `node_modules/`, certs, and keystores).
2. Create a new Railway project -> **Provision MySQL** service.
3. Add a service from your GitHub repo (`Dockerfile` and `railway.json` are auto-detected).
4. Set environment variables on the web service:
   - `NODE_ENV=production`
   - `AUTO_INIT_DB=true` *(runs `backend/scripts/initCloudDb.js` automatically on boot to create tables and seed initial marketplace data only if `users` is empty)*
   - `JWT_SECRET=<generate-a-long-random-secret>`
   - `MYSQL_URL=${{MySQL.MYSQL_URL}}` *(or copy the public/private MySQL connection string into `MYSQL_URL`)*
   - `DB_SSL=false` *(or `true` if your external DB host requires TLS)*
5. Generate a public Railway domain (e.g. `https://locallink.up.railway.app`).

Once live:
- Anyone on Android Chrome/Edge can open `https://your-domain` -> tap **Install** on the in-app banner (or browser menu -> **Install app**), placing the **LocalLink** icon directly on their home screen/app drawer!
- Anyone on iPhone/iPad Safari can open `https://your-domain` -> tap **Share -> Add to Home Screen**.

### Option B: Render + External Managed MySQL/MariaDB
`render.yaml` is already included at the repository root. Connect your repo as a Render Blueprint, supply `MYSQL_URL` from your managed DB provider (e.g., Aiven, Railway MySQL, PlanetScale/TiDB, DigitalOcean), and deploy.

---

## Part 2 — Build Signed Android `.apk` & Google Play `.aab` (Without Installing Android Studio Locally)

> Note: This Mac currently does not have Java JDK, Android Studio SDK, or Xcode installed, so the included **GitHub Actions** workflow is the fastest way to produce `.apk` and `.aab` builds.

1. In your GitHub repo settings -> **Variables**, add:
   - `BACKEND_API_URL` = `https://your-live-domain.up.railway.app`
2. Generate an upload keystore (on any machine with Java `keytool` via `npm run app:keystore`, then base64-encode `android/app/locallink-release.jks`), and save these **GitHub Actions Secrets**:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS` (e.g. `locallink-upload`)
   - `ANDROID_KEY_PASSWORD`
3. Open GitHub -> **Actions** -> **Build LocalLink Android APK & AAB** -> **Run workflow**.
4. Download the generated artifacts:
   - `locallink-android-apk` (`.apk` for direct testing/enterprise distribution)
   - `locallink-playstore-aab` (`.aab` for Google Play Console upload)

If you later install JDK + Android Studio locally on your Mac:
```bash
npm run app:keystore   # creates android/release-keystore.properties + SHA-256 fingerprint
BACKEND_API_URL=https://your-live-domain npm run app:android
```
Then inside Android Studio: **Build -> Generate Signed Bundle / APK -> Android App Bundle (.aab)**.

---

## Part 3 — Google Play Store & App Store Checklist ("Search LocalLink & Install Safely")

So anyone worldwide can search **"LocalLink"** in Google Play / Apple App Store and install cleanly with zero security warnings:

1. **Minimal Safe Permissions (Already Applied)**:
   - `android/app/src/main/AndroidManifest.xml` requests only `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, and `CAMERA`.
   - Broad storage permissions (`READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`) were removed because Android WebView uses the system photo picker automatically.
   - `android/app/src/main/res/xml/network_security_config.xml` enforces HTTPS (`cleartextTrafficPermitted="false"`) for all remote internet hosts.
2. **Privacy Policy URL (Already Included)**:
   - Hosted live at `https://your-live-domain/privacy-policy` (`frontend/privacy-policy.html`). Paste this URL into Google Play Console -> App Content -> Privacy Policy.
3. **Android App Links Verification (Optional / Recommended for TWA)**:
   - Set `ANDROID_SHA256_FINGERPRINT=<your-signing-cert-sha256>` on your cloud server; `GET /.well-known/assetlinks.json` serves the verification JSON automatically.
4. **Google Play Console & Data Safety**:
   - Create a Google Play Developer account, upload the **signed `.aab`**, complete Data Safety (Account info, Delivery address, Optional location for nearby stores/rider tracking), upload screenshots & feature graphic, and submit for review.
5. **Apple App Store (iOS)**:
   - On macOS with Xcode installed, run `BACKEND_API_URL=https://your-live-domain npm run app:ios`, select your Apple Developer Team signing certificate in Xcode, and run **Product -> Archive -> Distribute App**.
