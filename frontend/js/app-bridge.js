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

    // In any standard web browser over HTTP or HTTPS:
    if (!isCapacitorNative() && (proto === "http:" || proto === "https:")) {
      const saved = normalizeUrl(localStorage.getItem(STORAGE_KEY_SERVER) || "");
      // Clean up saved URL if it accidentally points to a static dev server port (e.g. 5500)
      if (saved) {
        try {
          const u = new URL(saved);
          if (isPrivateHost(u.hostname) && u.port && u.port !== DEFAULT_PORT) {
            localStorage.removeItem(STORAGE_KEY_SERVER);
          } else if (!saved.includes("localhost:5001") && !saved.includes("127.0.0.1:5001") && saved !== window.location.origin) {
            return saved;
          }
        } catch (_) {}
      }

      // If on a private host (localhost, 127.0.0.1, LAN IP) with a static dev server port (e.g. VS Code Live Server 5500, Vite 5173, etc. not 5001),
      // target the backend Express API server on port 5001!
      if (isPrivateHost(host) && port && port !== DEFAULT_PORT) {
        const backendHost = (host === "127.0.0.1" || host === "localhost") ? "localhost" : host;
        return `http://${backendHost}:${DEFAULT_PORT}`;
      }

      return window.location.origin;
    }

    const saved = normalizeUrl(localStorage.getItem(STORAGE_KEY_SERVER) || "");
    if (saved) return saved;

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

  // Transparent fetch wrapper with automatic Cloud Server Failover
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    let resolvedInput = input;
    try {
      const base = getApiBase();
      if (typeof input === "string") {
        if (input.startsWith("http://localhost:5001")) {
          resolvedInput = base + input.slice("http://localhost:5001".length);
        } else if (input.startsWith("http://127.0.0.1:5001")) {
          resolvedInput = base + input.slice("http://127.0.0.1:5001".length);
        } else if (window.location && window.location.origin && input.startsWith(window.location.origin + "/api/")) {
          // If called with window.location.origin on a static dev server port (e.g. :5500), rewrite to base
          if (base && !input.startsWith(base)) {
            resolvedInput = base + input.slice(window.location.origin.length);
          }
        } else if (input.startsWith("/api/")) {
          resolvedInput = base + input;
        }
      } else if (input instanceof Request && input.url) {
        if (input.url.startsWith("http://localhost:5001")) {
          const rewritten = base + input.url.slice("http://localhost:5001".length);
          resolvedInput = new Request(rewritten, input);
        } else if (input.url.startsWith("http://127.0.0.1:5001")) {
          const rewritten = base + input.url.slice("http://127.0.0.1:5001".length);
          resolvedInput = new Request(rewritten, input);
        } else if (window.location && window.location.origin && input.url.startsWith(window.location.origin + "/api/")) {
          if (base && !input.url.startsWith(base)) {
            const rewritten = base + input.url.slice(window.location.origin.length);
            resolvedInput = new Request(rewritten, input);
          }
        }
      }
    } catch (_) {}

    try {
      return await nativeFetch(resolvedInput, init);
    } catch (primaryErr) {
      // Auto-failover: If local/LAN endpoint fails (e.g. "Load failed" on iPhone or "Failed to fetch"), retry against cloud production
      const env = getBuildEnv();
      const cloudServer = normalizeUrl(env.defaultServerUrl || "https://locallink-web-production.up.railway.app");
      const currentTarget = typeof resolvedInput === "string" ? resolvedInput : (resolvedInput && resolvedInput.url ? resolvedInput.url : "");

      if (cloudServer && currentTarget && !currentTarget.startsWith(cloudServer)) {
        let apiPath = null;
        if (currentTarget.includes("/api/")) {
          apiPath = currentTarget.slice(currentTarget.indexOf("/api/"));
        }
        if (apiPath) {
          try {
            const fallbackUrl = cloudServer + apiPath;
            const fallbackInput = typeof resolvedInput === "string" ? fallbackUrl : new Request(fallbackUrl, resolvedInput);
            const fallbackRes = await nativeFetch(fallbackInput, init);
            // Seamlessly promote cloud server so next requests don't lag
            activeApiBase = cloudServer;
            try { localStorage.setItem(STORAGE_KEY_SERVER, cloudServer); } catch (_) {}
            backendConnectionState = "online";
            updateServerStatusUI();
            return fallbackRes;
          } catch (_) {
            // If cloud retry also fails, throw primary error
          }
        }
      }
      throw primaryErr;
    }
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
    if (path.includes("wholesaler")) return "wholesaler";
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
    if (role === "wholesaler") {
      return "wholesaler.html";
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
    window.location.href = "unified-login.html";
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

    // Network offline banner disabled per user request
    updateServerStatusUI();
  }

  function updateServerStatusUI() {
    const badge = document.getElementById("llServerStatusBadge");
    const fabDot = document.getElementById("llFabDot");
    const headerDot = document.getElementById("llHeaderConnectionDot");
    const input = document.getElementById("llServerUrlInput");

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
    } else if (backendConnectionState === "offline") {
      if (badge) {
        badge.textContent = "Offline";
        badge.style.background = "rgba(244,63,94,0.2)";
        badge.style.color = "#fb7185";
      }
      if (fabDot) fabDot.style.background = "#f43f5e";
      if (headerDot) headerDot.style.background = "#f43f5e";
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
    window.location.href = "unified-login.html";
  }

  function closeRoleSwitcher() {
    // Disabled in favor of unified-login.html
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

  // Unified App Back Navigation Handler
  // Ensures pressing the Android back button or browser back navigates to PREVIOUS CONTENT,
  // closes open overlays/modals/search, and NEVER dumps the user on the login screen!
  let lastBackPress = 0;

  function handleUnifiedBackPress() {
    // 1. Close Role Switcher if open
    const rsModal = document.getElementById("llRoleSwitcherModal");
    if (rsModal && rsModal.style.display === "flex") {
      closeRoleSwitcher();
      return true;
    }

    // 2. Close mobile navigation drawers / sidebars
    const wholesalerSidebar = document.getElementById("wholesalerSidebar");
    if (wholesalerSidebar && !wholesalerSidebar.classList.contains("-translate-x-full")) {
      if (typeof window.toggleWholesaleSidebar === "function") window.toggleWholesaleSidebar(false);
      else wholesalerSidebar.classList.add("-translate-x-full");
      const backdrop = document.getElementById("wholesalerBackdrop");
      if (backdrop) backdrop.classList.add("hidden");
      return true;
    }

    const sellerSidebar = document.getElementById("sellerSidebar");
    if (sellerSidebar && !sellerSidebar.classList.contains("-translate-x-full")) {
      if (typeof window.toggleSellerSidebar === "function") window.toggleSellerSidebar(false);
      else sellerSidebar.classList.add("-translate-x-full");
      return true;
    }

    const adminSidebar = document.getElementById("adminSidebar");
    if (adminSidebar && !adminSidebar.classList.contains("-translate-x-full")) {
      if (typeof window.toggleAdminSidebar === "function") window.toggleAdminSidebar(false);
      else adminSidebar.classList.add("-translate-x-full");
      return true;
    }

    // 3. Close open header / three-dot menus
    const threeDotWholesale = document.getElementById("wholesaleHeaderMenu");
    if (threeDotWholesale && !threeDotWholesale.classList.contains("hidden")) {
      if (typeof window.toggleHeaderMenu === "function") window.toggleHeaderMenu(false);
      else threeDotWholesale.classList.add("hidden");
      return true;
    }

    const threeDotCustomer = document.getElementById("customerThreeDotMenu");
    if (threeDotCustomer && !threeDotCustomer.classList.contains("hidden")) {
      if (typeof window.closeThreeDotMenu === "function") window.closeThreeDotMenu();
      else threeDotCustomer.classList.add("hidden");
      return true;
    }

    // 4. Close search dropdowns or live search suggestions
    const aiBucketDropdown = document.getElementById("aiBucketSuggestionsDropdown");
    if (aiBucketDropdown && !aiBucketDropdown.classList.contains("hidden")) {
      aiBucketDropdown.classList.add("hidden");
      return true;
    }

    const marketDropdown = document.getElementById("marketSearchDropdown");
    const mobileMarketDropdown = document.getElementById("mobileMarketSearchDropdown");
    if ((marketDropdown && !marketDropdown.classList.contains("hidden")) || 
        (mobileMarketDropdown && !mobileMarketDropdown.classList.contains("hidden"))) {
      if (typeof window.hideSearchDropdowns === "function") window.hideSearchDropdowns();
      return true;
    }

    // 5. Close any open Tailwind modals (.fixed.inset-0:not(.hidden))
    const openModals = Array.from(document.querySelectorAll(".fixed.inset-0")).filter((el) => {
      if (el.classList.contains("hidden") || el.style.display === "none") return false;
      if (el.id === "llRoleSwitcherModal" || el.id === "wholesalerBackdrop" || el.id === "wholesaleHeaderMenuBackdrop") return false;
      return true;
    });

    if (openModals.length > 0) {
      const topModal = openModals[openModals.length - 1];
      topModal.classList.add("hidden");
      if (topModal.id === "voiceShoppingListModal" && typeof window.closeVoiceShoppingListModal === "function") window.closeVoiceShoppingListModal();
      else if (topModal.id === "voiceSearchModal" && typeof window.closeVoiceSearchModal === "function") window.closeVoiceSearchModal();
      else if (topModal.id === "customerAuthModal" && typeof window.closeCustomerAuthModal === "function") window.closeCustomerAuthModal();
      else if (topModal.id === "addressChangeModal" && typeof window.closeAddressModal === "function") window.closeAddressModal();
      else if (topModal.id === "paperListModal" && typeof window.closePaperListModal === "function") window.closePaperListModal();
      else if (topModal.id === "addLotModal" && typeof window.closeAddLotModal === "function") window.closeAddLotModal();
      return true;
    }

    // 6. Login Page Back Navigation: Return to Customer Marketplace as Guest
    if (typeof window.navigateLoginBack === "function") {
      const handled = window.navigateLoginBack();
      if (handled) return true;
    }

    // 7. In-Page Content Navigation: Customer Portal
    if (typeof window.navigateCustomerBack === "function") {
      const handled = window.navigateCustomerBack();
      if (handled) return true;
    }

    // 8. In-Page Content Navigation: Wholesaler Portal
    if (typeof window.navigateWholesalerBack === "function") {
      const handled = window.navigateWholesalerBack();
      if (handled) return true;
    }

    // 9. In-Page Content Navigation: Seller Portal
    if (typeof window.navigateSellerBack === "function") {
      const handled = window.navigateSellerBack();
      if (handled) return true;
    }

    // 10. In-Page Content Navigation: Admin Portal
    if (typeof window.navigateAdminBack === "function") {
      const handled = window.navigateAdminBack();
      if (handled) return true;
    }

    // Root content reached; do not dump user onto login page!
    return false;
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
        plugins.App.addListener("backButton", () => {
          const handled = handleUnifiedBackPress();
          if (handled) return;

          // User is at root view: confirm before exiting app cleanly
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

      // Also listen to popstate to guard mobile browsers & swipe gestures
      window.addEventListener("popstate", (e) => {
        // If an in-app state with pageId or tabId is handled by page script, it took effect.
        // Otherwise handle any open overlays or sub-views:
        handleUnifiedBackPress();
      });

      if (plugins.Network && typeof plugins.Network.addListener === "function") {
        plugins.Network.addListener("networkStatusChange", (status) => {
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
    // Disabled banner per user instruction
    return;
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
