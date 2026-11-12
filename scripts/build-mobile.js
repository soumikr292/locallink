/**
 * LocalLink Mobile Bundle Builder
 * Syncs `frontend/` -> `www/` for Capacitor Android & iOS native wrappers:
 *  - Customer Marketplace (`customer.html`) becomes root `www/index.html`
 *  - Admin Dashboard (`frontend/index.html`) becomes `www/admin.html`
 *  - Generates `build-env.js` with live Mac Wi-Fi LAN IP for physical phone testing
 *  - Strips `target="_blank"` on internal portal navigation so role switching stays inside the native app
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const rootDir = path.join(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");
const wwwDir = path.join(rootDir, "www");
const PORT = process.env.PORT || "5001";

function getLanUrls() {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const iface of Object.values(interfaces)) {
    for (const info of iface || []) {
      if (info.family === "IPv4" && !info.internal) {
        urls.push(`http://${info.address}:${PORT}`);
      }
    }
  }
  return urls;
}

function copyDirClean(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === "index copy.html") continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirClean(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function sanitizeInternalLinks(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  // Remove target="_blank" on internal .html links so Capacitor stays in the native WebView
  content = content.replace(
    /href="([^"]+\.html)"([^>]*)target="_blank"/g,
    'href="$1"$2'
  );
  content = content.replace(
    /target="_blank"([^>]*)href="([^"]+\.html)"/g,
    '$1href="$2"'
  );
  fs.writeFileSync(filePath, content, "utf8");
}

function main() {
  const lanUrls = getLanUrls();
  const primaryLan = lanUrls[0] || `http://localhost:${PORT}`;
  const defaultServerUrl = (process.env.BACKEND_API_URL || process.env.DEFAULT_SERVER_URL || "").trim().replace(/\/+$/, "");

  console.log("📦 Building LocalLink mobile bundle -> www/");
  console.log("🌐 Detected Host LAN URL(s):", lanUrls.length ? lanUrls.join(", ") : "None (using localhost)");
  if (defaultServerUrl) {
    console.log("☁️ Baked Cloud Server URL:", defaultServerUrl);
  }

  // Refresh frontend/js/build-env.js for web
  const webEnvContent = `window.__LOCALLINK_BUILD_ENV__ = ${JSON.stringify(
    {
      isMobileBundle: false,
      defaultServerUrl,
      lanUrl: primaryLan,
      lanUrls,
      androidEmuUrl: `http://10.0.2.2:${PORT}`,
      localUrl: `http://localhost:${PORT}`
    },
    null,
    2
  )};\n`;
  fs.writeFileSync(path.join(frontendDir, "js/build-env.js"), webEnvContent, "utf8");

  // Copy frontend -> www
  copyDirClean(frontendDir, wwwDir);

  // Move Admin Dashboard www/index.html -> www/admin.html
  const wwwAdminOld = path.join(wwwDir, "index.html");
  const wwwAdminNew = path.join(wwwDir, "admin.html");
  if (fs.existsSync(wwwAdminOld)) {
    fs.renameSync(wwwAdminOld, wwwAdminNew);
  }

  // Copy Customer Marketplace www/customer.html -> www/index.html as mobile app home
  const wwwCustomer = path.join(wwwDir, "customer.html");
  const wwwHome = path.join(wwwDir, "index.html");
  if (fs.existsSync(wwwCustomer)) {
    fs.copyFileSync(wwwCustomer, wwwHome);
  }

  // Update login.html admin dashboard link/redirect -> admin.html inside www/
  const wwwLogin = path.join(wwwDir, "login.html");
  if (fs.existsSync(wwwLogin)) {
    let loginHtml = fs.readFileSync(wwwLogin, "utf8");
    loginHtml = loginHtml.replace(/href="index\.html"/g, 'href="admin.html"');
    loginHtml = loginHtml.replace(/window\.location\.href\s*=\s*"index\.html"/g, 'window.location.href = "admin.html"');
    fs.writeFileSync(wwwLogin, loginHtml, "utf8");
  }

  // Sanitize target="_blank" on internal HTML files in www/
  for (const file of fs.readdirSync(wwwDir)) {
    if (file.endsWith(".html")) {
      sanitizeInternalLinks(path.join(wwwDir, file));
    }
  }

  // Write mobile-bundle specific build-env.js into www/js/build-env.js
  const mobileEnvContent = `window.__LOCALLINK_BUILD_ENV__ = ${JSON.stringify(
    {
      isMobileBundle: true,
      defaultServerUrl,
      lanUrl: primaryLan,
      lanUrls,
      androidEmuUrl: `http://10.0.2.2:${PORT}`,
      localUrl: `http://localhost:${PORT}`
    },
    null,
    2
  )};\n`;
  fs.writeFileSync(path.join(wwwDir, "js/build-env.js"), mobileEnvContent, "utf8");

  console.log("✅ Built www/ successfully! App Home = Customer Marketplace (www/index.html), Admin = www/admin.html");
}

main();
