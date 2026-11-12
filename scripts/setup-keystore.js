/**
 * Generates an Android release upload keystore (for Play Store .aab & signed .apk)
 * and writes android/release-keystore.properties when Java keytool is available.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const androidDir = path.join(rootDir, "android");
const keystorePath = path.join(androidDir, "app", "locallink-release.jks");
const propsPath = path.join(androidDir, "release-keystore.properties");

function hasKeytool() {
  try {
    execFileSync("keytool", ["-help"], { stdio: "ignore" });
    return true;
  } catch (_) {
    return false;
  }
}

function main() {
  const force = process.argv.includes("--force");

  if (!hasKeytool()) {
    console.log("keytool (Java JDK) is not installed on this machine.");
    console.log("You have two easy options to build signed Play Store APK/AAB packages:");
    console.log("  Option A (Recommended — Cloud CI): Push to GitHub and configure these Actions Secrets:");
    console.log("    - ANDROID_KEYSTORE_BASE64  (base64 of your .jks file)");
    console.log("    - ANDROID_KEYSTORE_PASSWORD");
    console.log("    - ANDROID_KEY_ALIAS        (e.g. locallink-upload)");
    console.log("    - ANDROID_KEY_PASSWORD");
    console.log("  Option B (Local Mac): Install JDK 21 + Android Studio, then re-run: npm run app:keystore");
    return;
  }

  if (fs.existsSync(keystorePath) && fs.existsSync(propsPath) && !force) {
    console.log("Release keystore already exists at:", keystorePath);
    console.log("Pass --force to regenerate.");
    return;
  }

  const storePass = crypto.randomBytes(16).toString("hex");
  const keyPass = storePass;
  const alias = "locallink-upload";

  if (force && fs.existsSync(keystorePath)) {
    fs.unlinkSync(keystorePath);
  }

  execFileSync(
    "keytool",
    [
      "-genkeypair",
      "-v",
      "-storetype",
      "PKCS12",
      "-keystore",
      keystorePath,
      "-alias",
      alias,
      "-keyalg",
      "RSA",
      "-keysize",
      "2048",
      "-validity",
      "10000",
      "-storepass",
      storePass,
      "-keypass",
      keyPass,
      "-dname",
      "CN=LocalLink App, OU=Mobile, O=LocalLink Marketplace, L=Kolkata, ST=WB, C=IN"
    ],
    { stdio: "inherit" }
  );

  const propsContent = [
    `storeFile=app/locallink-release.jks`,
    `storePassword=${storePass}`,
    `keyAlias=${alias}`,
    `keyPassword=${keyPass}`
  ].join("\n") + "\n";

  fs.writeFileSync(propsPath, propsContent, { encoding: "utf8", mode: 0o600 });
  console.log("Created release keystore:", keystorePath);
  console.log("Created signing properties:", propsPath);

  try {
    const out = execFileSync(
      "keytool",
      ["-list", "-v", "-keystore", keystorePath, "-alias", alias, "-storepass", storePass],
      { encoding: "utf8" }
    );
    const shaMatch = out.match(/SHA256:\s*([A-F0-9:]+)/i);
    if (shaMatch) {
      console.log("SHA-256 Fingerprint (set as ANDROID_SHA256_FINGERPRINT env var on backend):");
      console.log("  " + shaMatch[1]);
    }
  } catch (_) {}
}

main();
