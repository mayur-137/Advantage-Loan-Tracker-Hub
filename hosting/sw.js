// Service worker: lets the installed app open without a connection.
// The page is fetched network-first (so updates show at once) and falls back to the saved copy offline.
// Libraries and fonts from the CDNs are kept after first use. Sign-in and database traffic is never touched;
// Firestore keeps its own offline copy of the data.
const CACHE = "loan-tracker-v1";
const SHELL = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const CDN = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (req.mode === "navigate" && url.origin === location.origin) {
    e.respondWith(fetch(req).then((res) => {
      // Only the app page is kept for offline use (not other pages such as /privacy.html).
      if (url.pathname === "/" && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("/", copy)); }
      return res;
    }).catch(() => caches.match("/")));
    return;
  }
  if ((url.origin === location.origin && SHELL.indexOf(url.pathname) >= 0) || CDN.test(req.url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
