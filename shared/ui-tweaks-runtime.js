(() => {
  const STORAGE_KEY = "suite.ui.tweaks.v1";
  const SCRIPT_MARKER = "/shared/ui-tweaks-runtime.js";
  let debounceTimer = null;

  function wildcardToRegExp(pattern) {
    const escaped = String(pattern || "")
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }

  function matchesPath(pattern, pathname) {
    const p = String(pattern || "*").trim() || "*";
    if (p === "*") return true;
    try {
      return wildcardToRegExp(p).test(pathname);
    } catch {
      return false;
    }
  }

  function loadRules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const rules = Array.isArray(parsed) ? parsed : [];
      return rules.filter((r) => r && typeof r === "object");
    } catch {
      return [];
    }
  }

  function applyRule(rule) {
    if (!rule || rule.enabled === false) return;
    const selector = String(rule.selector || "").trim();
    const property = String(rule.property || "").trim();
    if (!selector || !property) return;
    const value = rule.value == null ? "" : String(rule.value);

    let nodes = [];
    try {
      nodes = document.querySelectorAll(selector);
    } catch {
      return;
    }

    nodes.forEach((node) => {
      try {
        node.style.setProperty(property, value, rule.important ? "important" : "");
      } catch {
        // ignore invalid property/value
      }
    });
  }

  function applyAll() {
    const rules = loadRules();
    const path = location.pathname || "/";
    rules.forEach((rule) => {
      if (matchesPath(rule.pathPattern, path)) applyRule(rule);
    });
  }

  function scheduleApply() {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      applyAll();
    }, 70);
  }

  function boot() {
    applyAll();

    const observer = new MutationObserver(() => {
      scheduleApply();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener("storage", (ev) => {
      if (ev.key === STORAGE_KEY) scheduleApply();
    });

    window.ProSePilotUITweaks = {
      storageKey: STORAGE_KEY,
      script: SCRIPT_MARKER,
      applyNow: applyAll
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
