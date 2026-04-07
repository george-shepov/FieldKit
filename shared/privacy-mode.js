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
    mode: "offline_private",
    allowSync: false,
    allowSupport: false,
    allowAI: false,
    managedEndpoint: "",
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
    Object.keys(defaultConfig).forEach(function (k) {
      if (hasOwn.call(src || {}, k)) cfg[k] = src[k];
      else cfg[k] = defaultConfig[k];
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
    if (!raw) return null;
    return copyConfig(safeParse(raw, defaultConfig));
  }

  function setConfig(cfg) {
    var normalized = copyConfig(cfg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("suite-privacy-changed", { detail: normalized }));
    return normalized;
  }

  function endpointOrigins(cfg) {
    var out = [];
    [cfg.managedEndpoint, cfg.customEndpoint].forEach(function (ep) {
      if (!ep) return;
      try {
        out.push(new URL(ep, window.location.href).origin);
      } catch (_e) {}
    });
    return out;
  }

  function classify(url, cfg) {
    var u = new URL(String(url), window.location.href);
    var p = (u.pathname || "").toLowerCase();
    function isAIPath(pathname) {
      return pathname.indexOf("/api/ai/") === 0 ||
        pathname.indexOf("/v1/chat/completions") === 0 ||
        pathname.indexOf("/chat/completions") === 0 ||
        pathname.indexOf("/api/chat") === 0;
    }
    if (u.protocol === "data:" || u.protocol === "blob:") return "local";
    if (u.origin === window.location.origin) {
      if (isAIPath(p)) return "ai";
      if (u.pathname.indexOf("/api/support/") === 0 || u.pathname === "/api/support/ticket") return "support";
      if (u.pathname.indexOf("/api/") === 0) return "sync";
      return "local";
    }
    if (endpointOrigins(cfg).indexOf(u.origin) >= 0) {
      if (isAIPath(p)) return "ai";
      return "remote-server";
    }
    return "external";
  }

  function allowed(url, method, cfg) {
    var conf = cfg || getConfig() || defaultConfig;
    var cat = classify(url, conf);
    if (cat === "local") return { ok: true, category: cat };

    if (conf.mode === "offline_private") {
      return { ok: false, category: cat, reason: "Offline Private mode blocks all network sync/AI calls." };
    }

    if (cat === "support") {
      return conf.allowSupport
        ? { ok: true, category: cat }
        : { ok: false, category: cat, reason: "Support submit is disabled in Privacy settings." };
    }
    if (cat === "ai" || cat === "external") {
      return conf.allowAI
        ? { ok: true, category: cat }
        : { ok: false, category: cat, reason: "External AI/network calls are disabled in Privacy settings." };
    }
    if (cat === "sync" || cat === "remote-server") {
      return conf.allowSync
        ? { ok: true, category: cat }
        : { ok: false, category: cat, reason: "Cloud sync is disabled in Privacy settings." };
    }
    return { ok: false, category: cat, reason: "Blocked by privacy policy." };
  }

  function blockedError(url, detail) {
    var e = new Error("[Privacy Mode] Blocked request to " + url + " | " + (detail.reason || "policy"));
    e.name = "PrivacyModeBlockedError";
    return e;
  }

  function patchNetwork() {
    if (nativeFetch) {
      window.fetch = function (input, init) {
        var reqUrl = typeof input === "string" ? input : (input && input.url ? input.url : String(input));
        var decision = allowed(reqUrl, init && init.method ? init.method : "GET");
        if (!decision.ok) return Promise.reject(blockedError(reqUrl, decision));
        return nativeFetch(input, init);
      };
    }

    if (NativeXHR) {
      var open0 = NativeXHR.prototype.open;
      var send0 = NativeXHR.prototype.send;
      NativeXHR.prototype.open = function (method, url) {
        this.__suiteUrl = url;
        this.__suiteMethod = method;
        return open0.apply(this, arguments);
      };
      NativeXHR.prototype.send = function () {
        var decision = allowed(this.__suiteUrl || "", this.__suiteMethod || "GET");
        if (!decision.ok) throw blockedError(this.__suiteUrl || "", decision);
        return send0.apply(this, arguments);
      };
    }

    if (nativeSendBeacon) {
      navigator.sendBeacon = function (url, data) {
        var decision = allowed(url, "POST");
        if (!decision.ok) return false;
        return nativeSendBeacon(url, data);
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
      ".suite-privacy-fab{position:fixed;right:16px;bottom:68px;z-index:2147483599;border:1px solid #2f5f7d;background:#11314a;color:#eaf4ff;border-radius:999px;padding:8px 12px;font:700 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer}",
      ".suite-privacy-fab:hover{background:#1a4466}",
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
      ".suite-privacy-actions{display:flex;gap:8px;justify-content:flex-end}",
      ".suite-privacy-btn{border:1px solid #355775;background:#173654;color:#e8f4ff;border-radius:9px;padding:8px 11px;font:700 12px/1.2 system-ui,-apple-system,sans-serif;cursor:pointer}",
      ".suite-privacy-btn.primary{background:linear-gradient(180deg,#2ea36f,#1f7b53);border-color:#2ea36f;color:#05170d}"
    ].join("");
    document.head.appendChild(style);
  }

  function renderPanel(initialOpen, forceChoice) {
    ensureStyles();

    var fab = document.createElement("button");
    fab.className = "suite-privacy-fab";
    fab.type = "button";
    fab.textContent = "Privacy";

    var mask = document.createElement("div");
    mask.className = "suite-privacy-mask";
    mask.id = "suitePrivacyMask";
    mask.innerHTML = [
      '<div class="suite-privacy-panel" role="dialog" aria-modal="true" aria-label="Privacy mode">',
      '  <div class="suite-privacy-head">',
      '    <div><h2>Privacy Mode</h2><p>Default is device-only. Cloud features require explicit opt-in.</p></div>',
      '    <button class="suite-privacy-close" id="suitePrivacyClose" type="button">Close</button>',
      "  </div>",
      '  <div class="suite-privacy-body">',
      '    <section class="suite-privacy-row">',
      '      <label>Mode</label>',
      '      <select id="suitePrivacyMode" class="suite-privacy-select">',
      '        <option value="offline_private">Private Offline (Recommended)</option>',
      '        <option value="sync_managed">Sync to My Server</option>',
      '        <option value="sync_custom">Use My Own Server</option>',
      "      </select>",
      "    </section>",
      '    <section class="suite-privacy-row">',
      '      <label for="suiteManagedEndpoint">Managed server endpoint (optional)</label>',
      '      <input id="suiteManagedEndpoint" class="suite-privacy-input" placeholder="https://your-vps.example.com" />',
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
    }
    function close() {
      if (forceChoice && !getConfig()) return;
      mask.classList.remove("open");
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

    document.body.appendChild(fab);
    document.body.appendChild(mask);

    var current = getConfig() || copyConfig(defaultConfig);
    applyToForm(current);

    fab.addEventListener("click", open);
    document.getElementById("suitePrivacyClose").addEventListener("click", close);
    mask.addEventListener("click", function (event) {
      if (event.target === mask) close();
    });
    document.getElementById("suitePrivacyReset").addEventListener("click", function () {
      var reset = setConfig(defaultConfig);
      applyToForm(reset);
    });
    document.getElementById("suitePrivacySave").addEventListener("click", function () {
      var saved = setConfig(readForm());
      applyToForm(saved);
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
