(function () {
  if (window.__suitePrivacyInit) return;
  window.__suitePrivacyInit = true;

  var STORAGE_KEY = "suite.privacy.mode.v1";
  var hasOwn = Object.prototype.hasOwnProperty;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var NativeXHR = window.XMLHttpRequest;
  var nativeSendBeacon = navigator.sendBeacon ? navigator.sendBeacon.bind(navigator) : null;
  var nativeWebSocket = window.WebSocket;

  var defaultConfig = {
    mode: "sync_managed",
    allowSync: true,
    allowSupport: false,
    allowAI: false,
    managedEndpoint: "https://giorgiy-shepov.com",
    customEndpoint: ""
  };

  function safeParse(raw, fallback) {
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_e) {
      return fallback;
    }
  }

  function copyConfig(src) {
    var cfg = {};
    Object.keys(defaultConfig).forEach(function (key) {
      cfg[key] = hasOwn.call(src || {}, key) ? src[key] : defaultConfig[key];
    });
    cfg.mode = String(cfg.mode || "offline_private");
    cfg.allowSync = Boolean(cfg.allowSync);
    cfg.allowSupport = Boolean(cfg.allowSupport);
    cfg.allowAI = Boolean(cfg.allowAI);
    cfg.managedEndpoint = String(cfg.managedEndpoint || "").trim();
    cfg.customEndpoint = String(cfg.customEndpoint || "").trim();
    return cfg;
  }

  function getConfig() {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? copyConfig(safeParse(raw, defaultConfig)) : null;
  }

  function setConfig(cfg) {
    var normalized = copyConfig(cfg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("suite-privacy-changed", { detail: normalized }));
    return normalized;
  }

  function endpointOrigins(cfg) {
    var out = [];
    [cfg.managedEndpoint, cfg.customEndpoint].forEach(function (endpoint) {
      if (!endpoint) return;
      try {
        out.push(new URL(endpoint, window.location.href).origin);
      } catch (_e) {}
    });
    return out;
  }

  function classify(url, cfg) {
    var parsed = new URL(String(url), window.location.href);
    var path = (parsed.pathname || "").toLowerCase();

    function isAIPath(value) {
      return value.indexOf("/api/ai/") === 0 ||
        value.indexOf("/v1/chat/completions") === 0 ||
        value.indexOf("/chat/completions") === 0 ||
        value.indexOf("/api/chat") === 0;
    }

    if (parsed.protocol === "data:" || parsed.protocol === "blob:") return "local";
    if (parsed.origin === window.location.origin) {
      if (isAIPath(path)) return "ai";
      if (path.indexOf("/api/support/") === 0 || path === "/api/support/ticket") return "support";
      if (path.indexOf("/api/") === 0) return "sync";
      return "local";
    }
    if (endpointOrigins(cfg).indexOf(parsed.origin) >= 0) {
      return isAIPath(path) ? "ai" : "remote-server";
    }
    return "external";
  }

  function allowed(url, method, cfg) {
    var conf = cfg || getConfig() || defaultConfig;
    var category = classify(url, conf);
    if (category === "local") return { ok: true, category: category };

    if (conf.mode === "offline_private") {
      return { ok: false, category: category, reason: "Offline Private mode blocks all network sync/AI calls." };
    }
    if (category === "support") {
      return conf.allowSupport
        ? { ok: true, category: category }
        : { ok: false, category: category, reason: "Support submit is disabled in Privacy settings." };
    }
    if (category === "ai" || category === "external") {
      return conf.allowAI
        ? { ok: true, category: category }
        : { ok: false, category: category, reason: "External AI/network calls are disabled in Privacy settings." };
    }
    if (category === "sync" || category === "remote-server") {
      return conf.allowSync
        ? { ok: true, category: category }
        : { ok: false, category: category, reason: "Cloud sync is disabled in Privacy settings." };
    }
    return { ok: false, category: category, reason: "Blocked by privacy policy." };
  }

  function blockedError(url, detail) {
    var error = new Error("[Privacy Mode] Blocked request to " + url + " | " + (detail.reason || "policy"));
    error.name = "PrivacyModeBlockedError";
    return error;
  }

  function patchNetwork() {
    if (nativeFetch) {
      window.fetch = function (input, init) {
        var requestURL = typeof input === "string" ? input : (input && input.url ? input.url : String(input));
        var decision = allowed(requestURL, init && init.method ? init.method : "GET");
        return decision.ok ? nativeFetch(input, init) : Promise.reject(blockedError(requestURL, decision));
      };
    }

    if (NativeXHR) {
      var nativeOpen = NativeXHR.prototype.open;
      var nativeSend = NativeXHR.prototype.send;
      NativeXHR.prototype.open = function (method, url) {
        this.__suiteUrl = url;
        this.__suiteMethod = method;
        return nativeOpen.apply(this, arguments);
      };
      NativeXHR.prototype.send = function () {
        var decision = allowed(this.__suiteUrl || "", this.__suiteMethod || "GET");
        if (!decision.ok) throw blockedError(this.__suiteUrl || "", decision);
        return nativeSend.apply(this, arguments);
      };
    }

    if (nativeSendBeacon) {
      navigator.sendBeacon = function (url, data) {
        var decision = allowed(url, "POST");
        return decision.ok ? nativeSendBeacon(url, data) : false;
      };
    }

    if (nativeWebSocket) {
      window.WebSocket = function (url, protocols) {
        var decision = allowed(url, "WS");
        if (!decision.ok) throw blockedError(url, decision);
        return protocols ? new nativeWebSocket(url, protocols) : new nativeWebSocket(url);
      };
      window.WebSocket.prototype = nativeWebSocket.prototype;
    }
  }

  function ensureStyles() {
    if (document.getElementById("suitePrivacyStyle")) return;
    var style = document.createElement("style");
    style.id = "suitePrivacyStyle";
    style.textContent = [
      ".suite-privacy-mask{position:fixed;inset:0;z-index:2147483601;background:rgba(5,10,18,.78);display:none;align-items:flex-start;justify-content:center;padding:14px;overflow:auto}",
      ".suite-privacy-mask.open{display:flex}",
      ".suite-privacy-panel{width:min(780px,100%);border:1px solid #325a75;border-radius:14px;background:#0e1b29;color:#e6f3ff;box-shadow:0 22px 62px rgba(0,0,0,.45)}",
      ".suite-privacy-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:14px;border-bottom:1px solid #27465e}",
      ".suite-privacy-head h2{margin:0;font:800 18px/1.25 system-ui,-apple-system,sans-serif}",
      ".suite-privacy-head p{margin:6px 0 0;color:#9ec0d8;font:500 12px/1.45 system-ui,-apple-system,sans-serif}",
      ".suite-privacy-close{border:1px solid #35506a;background:#132739;color:#dce9f6;border-radius:8px;padding:6px 10px;font:700 12px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer}",
      ".suite-privacy-body{padding:12px 14px 14px;display:grid;gap:10px}",
      ".suite-privacy-row{display:grid;gap:8px;border:1px solid #2a4760;border-radius:10px;background:#11263a;padding:10px}",
      ".suite-privacy-row label{display:block;font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#afd0e7;margin-bottom:6px}",
      ".suite-privacy-opt{display:grid;gap:6px}",
      ".suite-privacy-check{display:flex;align-items:flex-start;gap:8px;color:#d8e9f8;font:500 13px/1.35 system-ui,-apple-system,sans-serif}",
      ".suite-privacy-input,.suite-privacy-select{width:100%;border:1px solid #355775;background:#0f2438;color:#e6f3ff;border-radius:8px;padding:8px 9px;font:500 13px/1.2 system-ui,-apple-system,sans-serif}",
      ".suite-privacy-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}",
      ".suite-privacy-btn{border:1px solid #355775;background:#173654;color:#e8f4ff;border-radius:9px;padding:8px 11px;font:700 12px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer}",
      ".suite-privacy-btn.primary{background:linear-gradient(180deg,#2ea36f,#1f7b53);border-color:#2ea36f;color:#05170d}"
    ].join("");
    document.head.appendChild(style);
  }

  function renderPanel(initialOpen, forceChoice) {
    ensureStyles();
    var mask = document.getElementById("suitePrivacyMask");
    if (mask) return;

    mask = document.createElement("div");
    mask.className = "suite-privacy-mask";
    mask.id = "suitePrivacyMask";
    mask.setAttribute("aria-hidden", "true");
    mask.innerHTML = [
      '<div class="suite-privacy-panel" role="dialog" aria-modal="true" aria-label="Privacy mode">',
      '  <div class="suite-privacy-head">',
      '    <div><h2>Privacy Mode</h2><p>Choose device-only operation, the managed demo server, or your own server.</p></div>',
      '    <button class="suite-privacy-close" id="suitePrivacyClose" type="button">Close</button>',
      "  </div>",
      '  <div class="suite-privacy-body">',
      '    <section class="suite-privacy-row">',
      '      <label>Mode</label>',
      '      <select id="suitePrivacyMode" class="suite-privacy-select">',
      '        <option value="offline_private">Private Offline (Device Only)</option>',
      '        <option value="sync_managed">Sync to Demo Server (Default)</option>',
      '        <option value="sync_custom">Use My Own Server</option>',
      "      </select>",
      "    </section>",
      '    <section class="suite-privacy-row">',
      '      <label for="suiteManagedEndpoint">Demo server endpoint</label>',
      '      <input id="suiteManagedEndpoint" class="suite-privacy-input" placeholder="https://giorgiy-shepov.com" />',
      '      <label for="suiteCustomEndpoint">Custom server endpoint (optional)</label>',
      '      <input id="suiteCustomEndpoint" class="suite-privacy-input" placeholder="https://my-server.example.com" />',
      "    </section>",
      '    <section class="suite-privacy-row">',
      '      <label>Opt-in channels</label>',
      '      <div class="suite-privacy-opt">',
      '        <label class="suite-privacy-check"><input type="checkbox" id="suiteAllowSync" /> Cloud sync & heartbeat API</label>',
      '        <label class="suite-privacy-check"><input type="checkbox" id="suiteAllowSupport" /> Support ticket/network submit</label>',
      '        <label class="suite-privacy-check"><input type="checkbox" id="suiteAllowAI" /> External AI/network calls</label>',
      "      </div>",
      "    </section>",
      '    <div class="suite-privacy-actions">',
      '      <button class="suite-privacy-btn" id="suitePrivacyReset" type="button">Reset to Private</button>',
      '      <button class="suite-privacy-btn primary" id="suitePrivacySave" type="button">Save</button>',
      "    </div>",
      "  </div>",
      "</div>"
    ].join("");

    function open() {
      mask.classList.add("open");
      mask.setAttribute("aria-hidden", "false");
    }

    function close() {
      if (forceChoice && !getConfig()) return;
      mask.classList.remove("open");
      mask.setAttribute("aria-hidden", "true");
    }

    function applyToForm(cfg) {
      document.getElementById("suitePrivacyMode").value = cfg.mode;
      document.getElementById("suiteManagedEndpoint").value = cfg.managedEndpoint || "";
      document.getElementById("suiteCustomEndpoint").value = cfg.customEndpoint || "";
      document.getElementById("suiteAllowSync").checked = Boolean(cfg.allowSync);
      document.getElementById("suiteAllowSupport").checked = Boolean(cfg.allowSupport);
      document.getElementById("suiteAllowAI").checked = Boolean(cfg.allowAI);
    }

    function readForm() {
      return copyConfig({
        mode: document.getElementById("suitePrivacyMode").value,
        managedEndpoint: document.getElementById("suiteManagedEndpoint").value.trim(),
        customEndpoint: document.getElementById("suiteCustomEndpoint").value.trim(),
        allowSync: document.getElementById("suiteAllowSync").checked,
        allowSupport: document.getElementById("suiteAllowSupport").checked,
        allowAI: document.getElementById("suiteAllowAI").checked
      });
    }

    document.body.appendChild(mask);
    applyToForm(getConfig() || copyConfig(defaultConfig));

    document.getElementById("suitePrivacyClose").addEventListener("click", close);
    mask.addEventListener("click", function (event) {
      if (event.target === mask) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") close();
    });
    document.addEventListener("click", function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest("[data-open-privacy]") : null;
      if (!trigger) return;
      event.preventDefault();
      open();
    });
    document.getElementById("suitePrivacyReset").addEventListener("click", function () {
      applyToForm(setConfig(defaultConfig));
    });
    document.getElementById("suitePrivacySave").addEventListener("click", function () {
      applyToForm(setConfig(readForm()));
      close();
    });

    window.SUITE_PRIVACY = window.SUITE_PRIVACY || {};
    window.SUITE_PRIVACY.openPanel = open;
    window.SUITE_PRIVACY.getConfig = function () {
      return getConfig() || copyConfig(defaultConfig);
    };
    window.SUITE_PRIVACY.setConfig = function (cfg) {
      var saved = setConfig(cfg);
      applyToForm(saved);
      return saved;
    };
    window.dispatchEvent(new CustomEvent("suite-privacy-ready", { detail: window.SUITE_PRIVACY }));

    if (initialOpen) open();
  }

  patchNetwork();
  var existingConfig = getConfig();
  if (document.body) {
    renderPanel(!existingConfig, !existingConfig);
  } else {
    window.addEventListener("DOMContentLoaded", function () {
      renderPanel(!existingConfig, !existingConfig);
    });
  }
})();
