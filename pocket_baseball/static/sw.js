/* オフラインでも遊べるようにゲーム本体をキャッシュする (API は常にネットワーク) */
const CACHE = "pocket-baseball-v4";
const ASSETS = [
  "./",
  "index.html",
  "css/style.css",
  "icon.svg",
  "manifest.webmanifest",
  "js/util.js",
  "js/data.js",
  "js/npb.js",
  "js/rosters2004.js",
  "js/field.js",
  "js/pitch.js",
  "js/play.js",
  "js/ai.js",
  "js/game.js",
  "js/chara.js",
  "js/render.js",
  "vendor/three.min.js",
  "js/three/model.js",
  "js/three/anim.js",
  "js/three/gear.js",
  "js/three/human.js",
  "js/three/look.js",
  "js/three/post.js",
  "js/three/stadium.js",
  "js/three/view.js",
  "js/three/portrait.js",
  "js/audio.js",
  "js/store.js",
  "js/ui.js",
  "js/photos.js",
  "js/cards.js",
  "js/broadcast.js",
  "js/match.js",
  "js/screens.js",
  "js/pennant.js",
  "js/news.js",
  "js/success.js",
  "js/main.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.includes("/api/")) return;
  // ネットワーク優先 (更新をすぐ反映)、失敗したらキャッシュ
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
