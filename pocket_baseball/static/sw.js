/* オフラインでも遊べるようにゲーム本体をキャッシュする (API は常にネットワーク) */
const CACHE = "pocket-baseball-v9";
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
  "js/parks.js",
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
  "js/three/clips.js",
  "js/three/gear.js",
  "js/three/human.js",
  "js/three/hrig.js",
  "js/three/look.js",
  "js/three/post.js",
  "js/three/parkparts.js",
  "js/three/stadium.js",
  "js/three/motion.js",
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
  "js/pennant_sched.js",
  "js/bip_table.js",
  "js/quicksim.js",
  "js/pennant_post.js",
  "js/pennant_awards.js",
  "js/pennant_life.js",
  "js/pennant_records.js",
  "js/news.js",
  "js/manga.js",
  "js/success.js",
  "js/main.js",
  // 3D の選手モデル (オフラインでも簡易モデルに落ちないように)
  "models/player.json",
  "models/player.bin",
  "models/player_eye.jpg",
  "models/player_skin_clean.jpg",
  "models/player_skin_stubble.jpg",
  "models/player_skin_beard.jpg",
  // 球団の画像 (npb.js が読むもの)
  "img/flags/d.webp",
  "img/flags/f.webp",
  "img/flags/h.webp",
  "img/flags/m.webp",
  "img/flags/t.webp",
  "img/marks/c.webp",
  "img/marks/g.webp",
  "img/marks/h.webp",
  "img/marks/orix.webp",
  "img/teams/bu.webp",
  "img/teams/bw.webp",
  "img/teams/c.webp",
  "img/teams/d.webp",
  "img/teams/f.webp",
  "img/teams/g.webp",
  "img/teams/h.webp",
  "img/teams/l.webp",
  "img/teams/m.webp",
  "img/teams/s.webp",
  "img/teams/t.webp",
  "img/teams/yb.webp",
  "img/words/bs.webp",
  "img/words/c.webp",
  "img/words/m.webp",
  "img/words/yb_script.webp",
  "img/words/yb_sleeve.webp",
  // サクセスの人物の絵 (manga.js)
  "img/success/kanto_normal.webp",
  "img/success/kanto_happy.webp",
  "img/success/kanto_serious.webp",
  "img/success/goda_normal.webp",
  "img/success/goda_happy.webp",
  "img/success/goda_surprised.webp",
  "img/success/hayase_normal.webp",
  "img/success/hayase_happy.webp",
  "img/success/hayase_angry.webp",
  "img/success/inukai_normal.webp",
  "img/success/inukai_happy.webp",
  "img/success/inukai_serious.webp",
  "img/success/ryuzaki_normal.webp",
  "img/success/ryuzaki_happy.webp",
  "img/success/ryuzaki_angry.webp",
  "img/success/me_normal.webp",
  "img/success/me_happy.webp",
  "img/success/me_sad.webp",
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
