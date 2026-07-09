const CACHE_NAME = "fieldkit-shell-v16";
const APP_ROOT_URL = new URL("./", self.location.href);

function appURL(path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return new URL(normalized, APP_ROOT_URL).toString();
}

const OFFLINE_FALLBACK = appURL("index.html");
const API_PATH = new URL("api/", APP_ROOT_URL).pathname;

const PRECACHE_PATHS = [
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
  "shared/ui-tweaks-runtime.js",
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
];

const PRECACHE_URLS = PRECACHE_PATHS.map(appURL);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache entries independently so one optional/missing module cannot make
      // the entire FieldKit installation fail.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn("[FieldKit SW] Precache skipped:", url, error);
          }
        })
      );
      await self.skipWaiting();
    })
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
  if (url.pathname.startsWith(API_PATH)) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      if (url.pathname.endsWith("/")) {
        const indexRequest = new Request(new URL("index.html", url).toString());
        cache.put(indexRequest, networkResponse.clone());
      }
      return networkResponse;
    }

    if (networkResponse && networkResponse.status !== 404) {
      return networkResponse;
    }
  } catch (_error) {
    // Try the cache candidates below.
  }

  const querylessURL = new URL(url.toString());
  querylessURL.search = "";
  querylessURL.hash = "";

  const candidates = [
    request,
    querylessURL.toString(),
    url.pathname.endsWith("/")
      ? new URL("index.html", querylessURL).toString()
      : null,
    OFFLINE_FALLBACK
  ].filter(Boolean);

  for (const candidate of candidates) {
    const cached = await cache.match(candidate, { ignoreSearch: true });
    if (cached) return cached;
  }

  return new Response("Offline and page was not cached yet.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
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
