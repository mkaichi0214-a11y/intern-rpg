// オフラインでも起動できるように、アプリ本体をキャッシュする
const CACHE = "intern-rpg-v1";
const ASSETS = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "vendor/three.min.js", "vendor/supabase.js",
  "js/config.js", "js/platform.js", "js/events.js", "js/events_more.js", "js/extras.js", "js/world3d.js", "js/game.js",
  "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // Supabaseやフォントはそのまま通信
  // 新しい版を優先し、通信できないときだけキャッシュを使う
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
