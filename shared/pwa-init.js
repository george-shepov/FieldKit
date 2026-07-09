(function () {
  if (window.__suitePWAInit) return;
  window.__suitePWAInit = true;

  const params = new URLSearchParams(window.location.search);
  const currentScript = document.currentScript;
  const scriptURL = currentScript && currentScript.src
    ? new URL(currentScript.src, window.location.href)
    : new URL("shared/pwa-init.js", document.baseURI);
  const appRootURL = new URL("../", scriptURL);
  const appRootPath = appRootURL.pathname.endsWith("/")
    ? appRootURL.pathname
    : appRootURL.pathname + "/";

  function resolveAssetURL(path) {
    const normalized = String(path || "").replace(/^\/+/, "");
    return new URL(normalized, appRootURL).toString();
  }

  function ensureMeta(name, content) {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const meta = document.createElement("meta");
    meta.setAttribute("name", name);
    meta.setAttribute("content", content);
    document.head.appendChild(meta);
  }

  function ensureLink(rel, href) {
    const existing = document.querySelector(`link[rel="${rel}"]`);
    if (existing) {
      existing.setAttribute("href", href);
      return;
    }
    const link = document.createElement("link");
    link.setAttribute("rel", rel);
    link.setAttribute("href", href);
    document.head.appendChild(link);
  }

  if (document.head) {
    ensureLink("manifest", resolveAssetURL("manifest.webmanifest"));
    ensureLink("apple-touch-icon", resolveAssetURL("shared/icons/tictak-icon-512.png"));
    ensureMeta("theme-color", "#0f172a");
    ensureMeta("mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-capable", "yes");
    ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
  }

  function isInsideAppRoot(url) {
    return url.origin === appRootURL.origin && url.pathname.startsWith(appRootPath);
  }

  // The launcher historically produced origin-root links such as
  // /drivers-license/index.html. Those work on a custom root domain but fail
  // when FieldKit is hosted under a GitHub Pages project path (/FieldKit/).
  function repairLauncherLinks() {
    document.querySelectorAll("a.app-item[href]").forEach(function (link) {
      const raw = link.getAttribute("href");
      if (!raw || raw.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(raw)) return;

      let current;
      try {
        current = new URL(raw, window.location.href);
      } catch (_e) {
        return;
      }

      if (current.origin !== appRootURL.origin || isInsideAppRoot(current)) return;

      const corrected = new URL(current.pathname.replace(/^\/+/, ""), appRootURL);
      corrected.search = current.search;
      corrected.hash = current.hash;
      link.setAttribute("href", corrected.toString());
    });

    // index.html's delegated click handler expects this class, but older
    // launcher markup omitted it. Adding it prevents a star click from
    // following the surrounding app link.
    document.querySelectorAll('button[data-favorite-btn="1"]').forEach(function (button) {
      button.classList.add("favorite-btn");
    });
  }

  // Keep the standalone interview question deck visible inside FieldKit without
  // duplicating its data and editor code. The module page embeds the independently
  // deployable PWA and also offers a full-screen link.
  function addInterviewPrepToLauncher() {
    if (document.querySelector('[data-app-key="developer-interview-prep"]')) return true;
    const categories = Array.from(document.querySelectorAll(".category"));
    const training = categories.find(function (category) {
      const title = category.querySelector(".category-title span");
      return title && /training lab/i.test(title.textContent || "");
    });
    const list = training && training.querySelector(".apps-list");
    if (!list) return false;

    const link = document.createElement("a");
    link.href = resolveAssetURL("developer-interview-prep/index.html");
    link.className = "app-item";
    link.setAttribute("data-app-key", "developer-interview-prep");
    link.setAttribute("data-category-key", "education");
    link.innerHTML = [
      '<div class="app-info">',
      '  <div class="app-icon"><span aria-hidden="true" style="font-size:1.25rem">🎯</span></div>',
      "  <div>",
      '    <div class="app-name">Developer Interview Prep</div>',
      '    <div class="app-desc text-muted">Searchable SQL, .NET, JavaScript and behavioral question decks</div>',
      "  </div>",
      "</div>",
      '<div class="badges flex items-center gap-2">',
      '  <span class="s-badge s-badge-outline badge badge-connectivity offline" style="border-color:rgba(74,222,128,.4);color:#4ade80">AIRPLANE MODE</span>',
      '  <span class="s-badge s-badge-default">FULL</span>',
      "</div>"
    ].join("");
    list.appendChild(link);

    const count = training.querySelector(".category-title .s-badge");
    if (count) {
      const current = Number.parseInt(count.textContent || "0", 10);
      if (Number.isFinite(current)) count.textContent = String(current + 1);
    }
    return true;
  }

  function repairLauncher() {
    repairLauncherLinks();
    addInterviewPrepToLauncher();
  }

  // Capture star clicks early so the class is present before index.html's
  // delegated bubble-phase handler runs.
  document.addEventListener(
    "click",
    function (event) {
      const target = event.target;
      const favoriteButton = target && target.closest
        ? target.closest('button[data-favorite-btn="1"]')
        : null;
      if (favoriteButton) favoriteButton.classList.add("favorite-btn");
    },
    true
  );

  window.addEventListener("DOMContentLoaded", function () {
    repairLauncher();
    const content = document.getElementById("content");
    if (!content) return;

    const observer = new MutationObserver(function () {
      repairLauncher();
    });
    observer.observe(content, { childList: true, subtree: true });
  });

  if (!("serviceWorker" in navigator)) return;

  async function resetOfflineState() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (registration) {
        return registration.unregister();
      }));
    } catch (_e) {}

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(function (key) {
          return caches.delete(key);
        }));
      }
    } catch (_e) {}
  }

  if (params.get("sw-reset") === "1") {
    window.addEventListener("load", function () {
      resetOfflineState().finally(function () {
        const next = new URL(window.location.href);
        next.searchParams.delete("sw-reset");
        next.searchParams.set("v", String(Date.now()));
        window.location.replace(next.toString());
      });
    });
    return;
  }

  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";

  if (!window.isSecureContext && !isLocalhost) {
    console.info(
      "[PWA] Service worker skipped: HTTPS is required for installable offline mode on phone."
    );
    return;
  }

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(resolveAssetURL("sw.js"), { scope: appRootPath })
      .catch(function (err) {
        console.warn("[PWA] Service worker registration failed:", err);
      });
  });
})();
