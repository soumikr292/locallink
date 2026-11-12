/**
 * LocalLink Mobile & Web App Bridge
 * Handles:
 *  1. Dynamic Backend Server URL discovery (Web, PWA, Android Emulator, iOS Simulator, LAN Wi-Fi)
 *  2. Transparent window.fetch rewriting for localhost:5001 and /api/* paths
 *  3. Built-in Role Switcher UI (Customer, Seller, Delivery Rider, Admin) + Server Settings
 *  4. Native Capacitor plugin wrappers (App Back Button, Geolocation, StatusBar, SplashScreen, Network)
 *  5. PWA Service Worker registration
 */
(function () {
  if (window.LocalLinkApp) return;

  const DEFAULT_PORT = "5001";
  const STORAGE_KEY_SERVER = "locallinkServerUrl";

  function isCapacitorNative() {
    try {
      return Boolean(
        window.Capacitor &&
          typeof window.Capacitor.isNativePlatform === "function" &&
          window.Capacitor.isNativePlatform()
      );
    } catch (_) {
      return false;
    }
  }

  function getCapacitorPlatform() {
    try {
      if (window.Capacitor && typeof window.Capacitor.getPlatform === "function") {
        return window.Capacitor.getPlatform();
      }
    } catch (_) {}
    if (/android/i.test(navigator.userAgent || "")) return "android";
    if (/iphone|ipad|ipod/i.test(navigator.userAgent || "")) return "ios";
    return "web";
  }

  function getBuildEnv() {
    return window.__LOCALLINK_BUILD_ENV__ || {};
  }

  function normalizeUrl(url) {
    if (!url || typeof url !== "string") return "";
    let cleaned = url.trim().replace(/\/+$/, "");
    if (cleaned && !/^https?:\/\//i.test(cleaned)) {
      cleaned = "http://" + cleaned;
    }
    return cleaned;
  }

  function isPrivateHost(hostname) {
    if (!hostname) return true;
    const h = String(hostname).toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "10.0.2.2" || h === "::1" || h.endsWith(".local")) {
      return true;
    }
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) {
      return true;
    }
    return false;
  }

  function isPublicWebContext() {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    return !isCapacitorNative() && (proto === "http:" || proto === "https:") && !isPrivateHost(host);
  }

  function resolveInitialApiBase() {
    const proto = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;

    // On a public domain (Railway, Render, custom HTTPS domain), always use same-origin cleanly
    if (isPublicWebContext()) {
      return window.location.origin;
    }

    const saved = normalizeUrl(localStorage.getItem(STORAGE_KEY_SERVER) || "");
    if (saved) return saved;

    // If served directly from Express backend on port 5001 or local dev web server
    if (!isCapacitorNative() && (proto === "http:" || proto === "https:") && port === DEFAULT_PORT) {
      return window.location.origin;
    }

    const env = getBuildEnv();
    const platform = getCapacitorPlatform();

    if (env.defaultServerUrl) {
      return normalizeUrl(env.defaultServerUrl);
    }

    if (env.lanUrl) {
      return env.lanUrl;
    }

    if (platform === "android") {
      return "http://10.0.2.2:" + DEFAULT_PORT;
    }

    return "http://localhost:" + DEFAULT_PORT;
  }

  let activeApiBase = resolveInitialApiBase();
  let backendConnectionState = "checking"; // checking | online | offline

  function getApiBase() {
    return activeApiBase;
  }

  function setApiBase(newUrl, reloadPage = false) {
    const clean = normalizeUrl(newUrl);
    if (!clean) {
      localStorage.removeItem(STORAGE_KEY_SERVER);
      activeApiBase = resolveInitialApiBase();
    } else {
      localStorage.setItem(STORAGE_KEY_SERVER, clean);
      activeApiBase = clean;
    }
    updateServerStatusUI();
    if (reloadPage) {
      window.location.reload();
    }
    return activeApiBase;
  }

  // Transparent fetch wrapper so both relative /api/* and hardcoded localhost:5001 work everywhere
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const base = getApiBase();
      if (typeof input === "string") {
        if (input.startsWith("http://localhost:5001")) {
          input = base + input.slice("http://localhost:5001".length);
        } else if (input.startsWith("http://127.0.0.1:5001")) {
          input = base + input.slice("http://127.0.0.1:5001".length);
        } else if (input.startsWith("/api/")) {
          input = base + input;
        }
      } else if (input instanceof Request && input.url) {
        if (input.url.startsWith("http://localhost:5001")) {
          const rewritten = base + input.url.slice("http://localhost:5001".length);
          input = new Request(rewritten, input);
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };

  async function testServerUrl(baseUrl, timeoutMs = 2500) {
    const clean = normalizeUrl(baseUrl);
    if (!clean) return false;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await nativeFetch(`${clean}/api/health`, {
        method: "GET",
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) return false;
      const json = await res.json();
      return Boolean(json && json.success);
    } catch (_) {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function autoDetectBackend() {
    backendConnectionState = "checking";
    updateServerStatusUI();

    // Public web hosts only talk to their own origin without probing LAN / 10.0.2.2
    if (isPublicWebContext()) {
      const origin = window.location.origin;
      const ok = await testServerUrl(origin, 3000);
      activeApiBase = origin;
      backendConnectionState = ok ? "online" : "offline";
      updateServerStatusUI();
      return ok ? origin : null;
    }

    const env = getBuildEnv();
    const saved = normalizeUrl(localStorage.getItem(STORAGE_KEY_SERVER) || "");
    const candidates = [];

    if (saved) candidates.push(saved);
    if (activeApiBase && !candidates.includes(activeApiBase)) candidates.push(activeApiBase);
    if (env.defaultServerUrl) {
      const def = normalizeUrl(env.defaultServerUrl);
      if (def && !candidates.includes(def)) candidates.push(def);
    }
    if (env.lanUrl && !candidates.includes(env.lanUrl)) candidates.push(env.lanUrl);
    if (Array.isArray(env.lanUrls)) {
      env.lanUrls.forEach((u) => {
        if (u && !candidates.includes(u)) candidates.push(u);
      });
    }
    if (getCapacitorPlatform() === "android") {
      candidates.push("http://10.0.2.2:" + DEFAULT_PORT);
    }
    candidates.push("http://localhost:" + DEFAULT_PORT);

    for (const candidate of candidates) {
      const ok = await testServerUrl(candidate, 2200);
      if (ok) {
        activeApiBase = candidate;
        backendConnectionState = "online";
        updateServerStatusUI();
        return candidate;
      }
    }

    backendConnectionState = "offline";
    updateServerStatusUI();
    return null;
  }

  function detectCurrentRole() {
    const path = (window.location.pathname || "").toLowerCase();
    if (path.includes("seller")) return "seller";
    if (path.includes("delivery") || path.includes("rider")) return "rider";
    if (path.includes("admin") || path.includes("login.html") || path.endsWith("/index.html") && document.title.toLowerCase().includes("admin")) {
      return "admin";
    }
    return "customer";
  }

  function getRoleTargetUrl(role) {
    const isNativeBundle = Boolean(getBuildEnv().isMobileBundle);
    if (role === "customer") {
      return isNativeBundle ? "index.html" : "customer.html";
    }
    if (role === "seller") {
      const sellerToken =
        localStorage.getItem("locallinkSellerToken") ||
        sessionStorage.getItem("locallinkSellerToken");
      return sellerToken ? "seller.html" : "seller-login.html";
    }
    if (role === "rider") {
      return "delivery.html";
    }
    if (role === "admin") {
      const adminToken =
        localStorage.getItem("locallinkAdminToken") ||
        sessionStorage.getItem("locallinkAdminToken");
      if (adminToken) {
        return isNativeBundle ? "admin.html" : "index.html";
      }
      return "login.html";
    }
    return "customer.html";
  }

  function goToRole(role) {
    const url = getRoleTargetUrl(role);
    closeRoleSwitcher();
    window.location.href = url;
  }

  // Native Geolocation wrapper (Capacitor Geolocation -> navigator.geolocation)
  function getCurrentPosition(options = {}) {
    const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000, ...options };
    const capGeo = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;

    if (capGeo && typeof capGeo.getCurrentPosition === "function") {
      return capGeo.getCurrentPosition(opts);
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported on this device"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });
  }

  // Inject Role Switcher Modal & Floating Bar UI
  function injectRoleSwitcherUI() {
    if (document.getElementById("llRoleSwitcherModal")) return;

    const currentRole = detectCurrentRole();
    const env = getBuildEnv();

    const style = document.createElement("style");
    style.textContent = `
      .ll-safe-top { padding-top: env(safe-area-inset-top, 0px); }
      .ll-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      @keyframes llPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .ll-pulse { animation: llPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
    `;
    document.head.appendChild(style);

    // Network offline banner
    const offlineBanner = document.createElement("div");
    offlineBanner.id = "llOfflineBanner";
    offlineBanner.style.cssText =
      "display:none;position:fixed;top:0;left:0;right:0;z-index:9999;background:#e11d48;color:#fff;text-align:center;font-size:11px;font-weight:700;padding:6px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);";
    offlineBanner.innerHTML =
      '<i class="fa-solid fa-wifi mr-1"></i> No internet connection or backend unreachable — <button onclick="window.LocalLinkApp.openRoleSwitcher()" style="text-decoration:underline;margin-left:6px;background:none;border:none;color:#fff;font-weight:800;cursor:pointer;">Check Server Settings</button>';
    document.body.appendChild(offlineBanner);

    // Role Switcher & Server Config Modal
    const modal = document.createElement("div");
    modal.id = "llRoleSwitcherModal";
    modal.style.cssText =
      "display:none;position:fixed;inset:0;z-index:9998;background:rgba(2,6,23,0.82);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:16px;";

    const roles = [
      {
        id: "customer",
        title: "Customer Marketplace",
        desc: "Browse nearby local stalls, AI Bargain & live GPS tracking",
        icon: "fa-bag-shopping",
        accent: "#10b981",
        bg: "rgba(16,185,129,0.12)",
        border: "rgba(16,185,129,0.35)"
      },
      {
        id: "seller",
        title: "Seller Shopkeeper Hub",
        desc: "Upload live morning photos, manage inventory & stall orders",
        icon: "fa-store",
        accent: "#f59e0b",
        bg: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.35)"
      },
      {
        id: "rider",
        title: "Delivery Partner Console",
        desc: "Accept nearby dispatches, live route map & OTP completion",
        icon: "fa-motorcycle",
        accent: "#38bdf8",
        bg: "rgba(56,189,248,0.12)",
        border: "rgba(56,189,248,0.35)"
      },
      {
        id: "admin",
        title: "Admin Control Center",
        desc: "Approve sellers, moderate marketplace catalog & payouts",
        icon: "fa-shield-halved",
        accent: "#a78bfa",
        bg: "rgba(167,139,250,0.12)",
        border: "rgba(167,139,250,0.35)"
      }
    ];

    const roleButtonsHtml = roles
      .map((r) => {
        const isActive = r.id === currentRole;
        return `
          <button type="button" onclick="window.LocalLinkApp.goToRole('${r.id}')"
            style="width:100%;display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;border:1px solid ${
              isActive ? r.accent : "rgba(30,41,59,1)"
            };background:${isActive ? r.bg : "#020617"};color:#f8fafc;text-align:left;cursor:pointer;transition:all 0.15s;">
            <div style="width:40px;height:40px;border-radius:12px;background:${r.bg};border:1px solid ${
          r.border
        };display:flex;align-items:center;justify-content:center;color:${r.accent};font-size:16px;flex-shrink:0;">
              <i class="fa-solid ${r.icon}"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-weight:800;font-size:13px;color:#fff;">${r.title}</span>
                ${
                  isActive
                    ? `<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:999px;background:${r.accent};color:#020617;">ACTIVE</span>`
                    : ""
                }
              </div>
              <p style="font-size:11px;color:#94a3b8;margin:2px 0 0 0;line-height:1.3;">${r.desc}</p>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:#64748b;font-size:11px;"></i>
          </button>
        `;
      })
      .join("");

    modal.innerHTML = `
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:20px;max-width:440px;width:100%;padding:20px;box-shadow:0 25px 50px rgba(0,0,0,0.65);font-family:system-ui,-apple-system,sans-serif;max-height:92vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid #1e293b;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#059669,#2dd4bf);display:flex;align-items:center;justify-content:center;color:#020617;font-size:16px;">
              <i class="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <h3 style="margin:0;font-size:15px;font-weight:800;color:#fff;">LocalLink Role Switcher</h3>
              <p style="margin:0;font-size:11px;color:#94a3b8;">Switch between Customer, Seller, Rider & Admin</p>
            </div>
          </div>
          <button type="button" onclick="window.LocalLinkApp.closeRoleSwitcher()" style="background:#1e293b;border:none;color:#cbd5e1;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${roleButtonsHtml}
        </div>

        <!-- Backend Connection Settings (Essential for Capacitor Phones & Emulators) -->
        <div style="background:#020617;border:1px solid #1e293b;border-radius:14px;padding:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;color:#cbd5e1;">
              <i class="fa-solid fa-server" style="color:#10b981;margin-right:4px;"></i> Backend API Connection
            </span>
            <span id="llServerStatusBadge" style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:#1e293b;color:#94a3b8;">Checking...</span>
          </div>

          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input id="llServerUrlInput" type="url" value="${activeApiBase}" placeholder="http://192.168.x.x:5001"
              style="flex:1;background:#0f172a;border:1px solid #334155;border-radius:10px;padding:7px 10px;color:#fff;font-size:11px;outline:none;" />
            <button type="button" onclick="window.LocalLinkApp.applyCustomServerUrl()"
              style="background:#059669;color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
              Connect
            </button>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:10px;">
            ${
              env.defaultServerUrl
                ? `<button type="button" onclick="document.getElementById('llServerUrlInput').value='${normalizeUrl(env.defaultServerUrl)}';window.LocalLinkApp.applyCustomServerUrl();" style="background:#1e293b;color:#a7f3d0;border:1px solid #334155;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">Cloud Server</button>`
                : ""
            }
            ${
              env.lanUrl
                ? `<button type="button" onclick="document.getElementById('llServerUrlInput').value='${env.lanUrl}';window.LocalLinkApp.applyCustomServerUrl();" style="background:#1e293b;color:#34d399;border:1px solid #334155;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">Wi-Fi LAN (${env.lanUrl.replace('http://','')})</button>`
                : ""
            }
            <button type="button" onclick="document.getElementById('llServerUrlInput').value='http://10.0.2.2:5001';window.LocalLinkApp.applyCustomServerUrl();" style="background:#1e293b;color:#38bdf8;border:1px solid #334155;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">Android Emu (10.0.2.2)</button>
            <button type="button" onclick="document.getElementById('llServerUrlInput').value='http://localhost:5001';window.LocalLinkApp.applyCustomServerUrl();" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">Localhost</button>
            <button type="button" onclick="window.LocalLinkApp.autoDetectAndNotify()" style="background:#1e293b;color:#fbbf24;border:1px solid #334155;border-radius:8px;padding:4px 8px;cursor:pointer;font-weight:700;">Auto-Detect</button>
          </div>
        </div>

        ${
          !isCapacitorNative() && !isStandaloneInstalled()
            ? `<div style="margin-top:12px;background:linear-gradient(135deg,rgba(5,150,105,0.16),rgba(14,165,233,0.12));border:1px solid rgba(16,185,129,0.35);border-radius:14px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div style="min-width:0;">
                  <div style="font-size:12px;font-weight:800;color:#fff;">Install LocalLink App</div>
                  <div style="font-size:10px;color:#cbd5e1;">Add LocalLink icon directly to your home screen</div>
                </div>
                <button type="button" onclick="window.LocalLinkApp.promptInstallPwa()" style="background:#10b981;color:#020617;border:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;cursor:pointer;white-space:nowrap;">
                  <i class="fa-solid fa-download" style="margin-right:4px;"></i>Install
                </button>
              </div>`
            : ""
        }
      </div>
    `;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeRoleSwitcher();
    });
    document.body.appendChild(modal);

    // Also provide subtle floating Role Switcher button if page doesn't have its own visible trigger on mobile
    if (!document.querySelector("[data-ll-role-trigger]")) {
      const fab = document.createElement("button");
      fab.id = "llFloatingRoleBtn";
      fab.type = "button";
      fab.setAttribute("data-ll-role-trigger", "true");
      fab.onclick = openRoleSwitcher;
      fab.title = "Switch Role (Customer / Seller / Rider / Admin)";
      fab.style.cssText =
        "position:fixed;bottom:76px;right:14px;z-index:9990;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);border:1px solid rgba(16,185,129,0.45);color:#fff;padding:8px 12px;border-radius:9999px;font-size:11px;font-weight:800;display:flex;align-items:center;gap:6px;box-shadow:0 8px 25px rgba(0,0,0,0.45);cursor:pointer;";
      fab.innerHTML = `<span id="llFabDot" style="width:7px;height:7px;border-radius:999px;background:#10b981;"></span><i class="fa-solid fa-layer-group" style="color:#34d399;"></i><span>Switch Role</span>`;
      document.body.appendChild(fab);
    }

    updateServerStatusUI();
  }

  function updateServerStatusUI() {
    const badge = document.getElementById("llServerStatusBadge");
    const fabDot = document.getElementById("llFabDot");
    const headerDot = document.getElementById("llHeaderConnectionDot");
    const input = document.getElementById("llServerUrlInput");
    const offlineBanner = document.getElementById("llOfflineBanner");

    if (input && document.activeElement !== input) {
      input.value = activeApiBase;
    }

    if (backendConnectionState === "online") {
      if (badge) {
        badge.textContent = "Connected";
        badge.style.background = "rgba(16,185,129,0.2)";
        badge.style.color = "#34d399";
      }
      if (fabDot) fabDot.style.background = "#10b981";
      if (headerDot) headerDot.style.background = "#10b981";
      if (offlineBanner) offlineBanner.style.display = "none";
    } else if (backendConnectionState === "offline") {
      if (badge) {
        badge.textContent = "Unreachable";
        badge.style.background = "rgba(244,63,94,0.2)";
        badge.style.color = "#fb7185";
      }
      if (fabDot) fabDot.style.background = "#f43f5e";
      if (headerDot) headerDot.style.background = "#f43f5e";
      if (offlineBanner && isCapacitorNative()) offlineBanner.style.display = "block";
    } else {
      if (badge) {
        badge.textContent = "Checking...";
        badge.style.background = "#1e293b";
        badge.style.color = "#fbbf24";
      }
      if (fabDot) fabDot.style.background = "#fbbf24";
      if (headerDot) headerDot.style.background = "#fbbf24";
    }
  }

  function openRoleSwitcher() {
    injectRoleSwitcherUI();
    const modal = document.getElementById("llRoleSwitcherModal");
    if (modal) modal.style.display = "flex";
    const input = document.getElementById("llServerUrlInput");
    if (input) input.value = activeApiBase;
  }

  function closeRoleSwitcher() {
    const modal = document.getElementById("llRoleSwitcherModal");
    if (modal) modal.style.display = "none";
  }

  async function applyCustomServerUrl() {
    const input = document.getElementById("llServerUrlInput");
    if (!input) return;
    const candidate = normalizeUrl(input.value);
    if (!candidate) return;

    const badge = document.getElementById("llServerStatusBadge");
    if (badge) {
      badge.textContent = "Testing...";
      badge.style.color = "#fbbf24";
    }

    const ok = await testServerUrl(candidate, 3000);
    if (ok) {
      setApiBase(candidate, false);
      backendConnectionState = "online";
      updateServerStatusUI();
      if (typeof window.showToast === "function") {
        window.showToast("Connected to backend: " + candidate);
      }
      setTimeout(() => window.location.reload(), 450);
    } else {
      backendConnectionState = "offline";
      updateServerStatusUI();
      if (typeof window.showToast === "function") {
        window.showToast("Could not reach " + candidate + " — check IP & server!", "error");
      } else {
        alert("Could not reach " + candidate + "/api/health. Ensure LocalLink backend is running on port 5001.");
      }
    }
  }

  async function autoDetectAndNotify() {
    const found = await autoDetectBackend();
    if (found) {
      localStorage.setItem(STORAGE_KEY_SERVER, found);
      if (typeof window.showToast === "function") {
        window.showToast("Connected automatically to " + found);
      }
      setTimeout(() => window.location.reload(), 450);
    } else if (typeof window.showToast === "function") {
      window.showToast("No backend server responded. Start npm start on your computer.", "error");
    }
  }

  // Native Capacitor Lifecycle Integration
  function initNativeCapacitor() {
    try {
      const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};

      if (plugins.StatusBar && typeof plugins.StatusBar.setBackgroundColor === "function") {
        plugins.StatusBar.setBackgroundColor({ color: "#020617" }).catch(() => {});
        if (typeof plugins.StatusBar.setStyle === "function") {
          plugins.StatusBar.setStyle({ style: "DARK" }).catch(() => {});
        }
      }

      if (plugins.SplashScreen && typeof plugins.SplashScreen.hide === "function") {
        setTimeout(() => {
          plugins.SplashScreen.hide().catch(() => {});
        }, 350);
      }

      if (plugins.App && typeof plugins.App.addListener === "function") {
        let lastBackPress = 0;
        plugins.App.addListener("backButton", ({ canGoBack }) => {
          // 1. Close Role Switcher if open
          const rsModal = document.getElementById("llRoleSwitcherModal");
          if (rsModal && rsModal.style.display === "flex") {
            closeRoleSwitcher();
            return;
          }

          // 2. Close any open Tailwind modal (.fixed.inset-0:not(.hidden))
          const openModals = Array.from(document.querySelectorAll(".fixed.inset-0")).filter(
            (el) => !el.classList.contains("hidden") && el.id !== "llRoleSwitcherModal"
          );
          if (openModals.length > 0) {
            openModals.forEach((m) => m.classList.add("hidden"));
            return;
          }

          if (canGoBack && window.history.length > 1) {
            window.history.back();
            return;
          }

          const now = Date.now();
          if (now - lastBackPress < 2000) {
            plugins.App.exitApp();
          } else {
            lastBackPress = now;
            if (typeof window.showToast === "function") {
              window.showToast("Press back again to exit LocalLink");
            }
          }
        });
      }

      if (plugins.Network && typeof plugins.Network.addListener === "function") {
        plugins.Network.addListener("networkStatusChange", (status) => {
          const banner = document.getElementById("llOfflineBanner");
          if (banner) {
            banner.style.display = status.connected ? "none" : "block";
          }
          if (status.connected) {
            autoDetectBackend();
          }
        });
      }
    } catch (e) {
      console.warn("Capacitor native init skipped:", e);
    }
  }

  let deferredInstallPrompt = null;

  function isStandaloneInstalled() {
    try {
      return Boolean(
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
          window.navigator.standalone === true
      );
    } catch (_) {
      return false;
    }
  }

  function isIosBrowser() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "") && !isCapacitorNative();
  }

  function dismissInstallBanner() {
    try {
      sessionStorage.setItem("llInstallDismissed", "1");
    } catch (_) {}
    const banner = document.getElementById("llInstallBanner");
    if (banner) banner.remove();
  }

  function showInstallBanner(isIosGuide = false) {
    if (isCapacitorNative() || isStandaloneInstalled()) return;
    try {
      if (sessionStorage.getItem("llInstallDismissed") === "1") return;
    } catch (_) {}
    if (!document.body || document.getElementById("llInstallBanner")) return;

    const banner = document.createElement("div");
    banner.id = "llInstallBanner";
    banner.style.cssText =
      "position:fixed;bottom:74px;left:12px;right:12px;max-width:440px;margin:0 auto;z-index:9989;background:linear-gradient(135deg,#0f172a,#020617);border:1px solid rgba(16,185,129,0.5);border-radius:16px;padding:10px 12px;box-shadow:0 14px 35px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:system-ui,-apple-system,sans-serif;";
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <img src="icons/icon-192.png" alt="LocalLink" style="width:36px;height:36px;border-radius:10px;flex-shrink:0;" onerror="this.style.display='none'" />
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:800;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Install LocalLink App</div>
          <div style="font-size:10px;color:#94a3b8;line-height:1.25;">${
            isIosGuide
              ? "Tap Share <i class='fa-solid fa-arrow-up-from-bracket'></i> then 'Add to Home Screen'"
              : "Put LocalLink icon right on your phone home screen"
          }</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        ${
          isIosGuide
            ? ""
            : `<button type="button" onclick="window.LocalLinkApp.promptInstallPwa()" style="background:#10b981;color:#020617;border:none;border-radius:10px;padding:7px 11px;font-size:11px;font-weight:900;cursor:pointer;">Install</button>`
        }
        <button type="button" onclick="window.LocalLinkApp.dismissInstallBanner()" aria-label="Dismiss" style="background:#1e293b;color:#94a3b8;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:12px;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  async function promptInstallPwa() {
    if (isCapacitorNative() || isStandaloneInstalled()) {
      if (typeof window.showToast === "function") {
        window.showToast("LocalLink is already installed on your device!");
      } else {
        alert("LocalLink is already installed on your device!");
      }
      return false;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice && choice.outcome === "accepted") {
          dismissInstallBanner();
          return true;
        }
      } catch (_) {}
      return false;
    }

    if (isIosBrowser()) {
      const msg = "Safari on iPhone/iPad: tap the Share button at the bottom, then choose 'Add to Home Screen'.";
      if (typeof window.showToast === "function") window.showToast(msg);
      else alert(msg);
      return false;
    }

    const hint =
      window.location.protocol !== "https:" && !isPrivateHost(window.location.hostname)
        ? "Installation requires HTTPS. Open LocalLink on its HTTPS domain and tap Browser Menu -> Install App."
        : "Open your browser menu (⋮) and tap 'Install app' or 'Add to Home screen'. On local HTTP Wi-Fi IPs, deploy over HTTPS for 1-tap Chrome/Play install.";
    if (typeof window.showToast === "function") window.showToast(hint);
    else alert(hint);
    return false;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallBanner(false);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    dismissInstallBanner();
    try {
      localStorage.setItem("locallinkPwaInstalled", "1");
    } catch (_) {}
    if (typeof window.showToast === "function") {
      window.showToast("LocalLink added to your home screen!");
    }
  });

  function registerPwaServiceWorker() {
    if (
      !isCapacitorNative() &&
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.protocol === "http:")
    ) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    injectRoleSwitcherUI();
    initNativeCapacitor();
    registerPwaServiceWorker();
    autoDetectBackend();
    if (isIosBrowser() && !isStandaloneInstalled()) {
      setTimeout(() => showInstallBanner(true), 1800);
    }
  });

  window.LocalLinkApp = {
    isNative: isCapacitorNative,
    getPlatform: getCapacitorPlatform,
    getApiBase,
    setApiBase,
    testServerUrl,
    autoDetectBackend,
    autoDetectAndNotify,
    goToRole,
    openRoleSwitcher,
    closeRoleSwitcher,
    applyCustomServerUrl,
    getCurrentPosition,
    promptInstallPwa,
    dismissInstallBanner,
    isStandaloneInstalled
  };
})();
