const CACHE_NAME = "fieldkit-shell-v18";

function scopedPath(path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return new URL(normalized, self.registration.scope).pathname;
}

const OFFLINE_FALLBACK = scopedPath("index.html");
const SHELL_CSS = scopedPath("shared/fieldkit-shell.css");
const SHELL_JS = scopedPath("shared/fieldkit-shell.js");

const PRECACHE_URLS = [
  "",
  "index.html",
  "landing.html",
  "manifest.webmanifest",
  "help/index.html",
  "shared/help-content.js",
  "shared/f1-help-nav.js",
  "shared/privacy-mode.js",
  "shared/global-auth.js",
  "shared/pwa-init.js",
  "shared/app-extensions.js",
  "shared/ui-tweaks-runtime.js",
  "shared/fieldkit-shell.css",
  "shared/fieldkit-shell.js",
  "shared/icons/tictak-icon-192.png",
  "shared/icons/tictak-icon-512.png",
  "accent-speaker/index.html",
  "authority-assistant/index.html",
  "legal-library/index.html",
  "acronym-list/index.html",
  "audio-notes/index.html",
  "battleship/index.html",
  "clock/index.html",
  "cns-tap-test/index.html",
  "docketpro/index.html",
  "drivers-license/index.html",
  "employee-skills/index.html",
  "field-checkin/index.html",
  "first-aid/index.html",
  "gigtax/index.html",
  "habit-tracker/index.html",
  "image-rater/index.html",
  "inventory/index.html",
  "js-trainer/index.html",
  "kanban/index.html",
  "light-messenger/index.html",
  "linux-trainer/index.html",
  "math-raindrops/index.html",
  "math-trainer/index.html",
  "midi-note-helper/index.html",
  "music-player/index.html",
  "music-trainer/index.html",
  "odd-one-out/index.html",
  "outdoor-kit/index.html",
  "pattern-mirror/index.html",
  "pomodoro/index.html",
  "profile/index.html",
  "positive-iq/index.html",
  "privacy-camera/index.html",
  "privacy-recorder/index.html",
  "receipt-tracker/index.html",
  "snake/index.html",
  "snippet-board/index.html",
  "support/index.html",
  "tic-tac-toe/index.html",
  "time-tracker/index.html",
  "ui-tweaker/index.html",
  "wishlist/index.html",
  "drivers-license/DriversLicensePrep.html",
  "games/reversi.html",
  "games/game-academy.html"
].map(scopedPath);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function shouldApplyShell(url) {
  const relative = url.pathname.replace(self.registration.scope.replace(url.origin, ""), "").replace(/^\/+/, "");
  if (!relative || relative === "index.html") return false;
  if (relative === "landing.html") return false;
  if (relative.startsWith("help/")) return false;
  return relative.endsWith(".html") || !relative.includes(".") || relative.endsWith("/");
}

async function applyFieldKitShell(response, url) {
  if (!response || !response.ok || !shouldApplyShell(url)) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (html.includes("data-fieldkit-unified-shell")) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

  const cssHref = new URL(SHELL_CSS, url.origin).toString();
  const jsSrc = new URL(SHELL_JS, url.origin).toString();
  const marker = `<link rel="stylesheet" href="${cssHref}" data-fieldkit-unified-shell="1">`;
  const script = `<script src="${jsSrc}" data-fieldkit-unified-shell="1" defer></script>`;

  let transformed = html;
  if (/<\/head>/i.test(transformed)) transformed = transformed.replace(/<\/head>/i, `${marker}</head>`);
  else transformed = marker + transformed;

  if (/<\/body>/i.test(transformed)) transformed = transformed.replace(/<\/body>/i, `${script}</body>`);
  else transformed += script;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("x-fieldkit-shell", "unified-v1");

  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const transformed = await applyFieldKitShell(networkResponse.clone(), url);
      cache.put(request, transformed.clone());
      if (url.pathname.endsWith("/")) {
        const indexRequest = new Request(url.pathname + "index.html");
        cache.put(indexRequest, transformed.clone());
      }
      return transformed;
    }
    if (networkResponse && networkResponse.status === 404) {
      const fallback = await cache.match(OFFLINE_FALLBACK);
      if (fallback) return fallback;
    }
    return networkResponse;
  } catch (_error) {
    const candidates = [
      request,
      url.pathname,
      url.pathname.replace(/\/$/, "") + "/index.html",
      OFFLINE_FALLBACK
    ];
    for (const candidate of candidates) {
      const cached = await cache.match(candidate);
      if (cached) return applyFieldKitShell(cached.clone(), url);
    }
    return new Response("Offline and page was not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_error) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}
