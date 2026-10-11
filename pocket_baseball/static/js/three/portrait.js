/* 熱闘！ポケットベースボール — 選手カード用の切り抜き画像 (3D の選手を透明な背景に描く)
   打者はフォロースルー、投手は投げ終わり、捕手は構え。1 枚ずつ順番に描いてキャッシュする。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  if (!T) return;
  const Pt = {};
  const W = 420;
  const H = 560;
  let renderer = null;
  let scene = null;
  let cam = null;
  let rimL = null;
  let rimR = null;
  const cache = new Map();
  const MAX_CACHE = 36; // 1 枚およそ 1MB
  const queue = [];
  let busy = false;

  Pt.available = () => !!(T && PB.Human && PB.View3D && PB.View3D.specFor);

  function setup() {
    if (renderer) return true;
    try {
      renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    } catch (e) {
      return false;
    }
    if (!renderer.getContext()) return false;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new T.Scene();
    scene.add(new T.HemisphereLight("#f4f6ff", "#6a5a48", 0.85));
    const key = new T.DirectionalLight("#fff4e6", 2.6);
    key.position.set(-2.5, 3.2, 4.5);
    scene.add(key);
    // 後ろからの縁の光 (背景の光になじませる)
    rimL = new T.DirectionalLight("#fff0c0", 3.2);
    rimL.position.set(-3.5, 2.5, -3.5);
    scene.add(rimL);
    rimR = new T.DirectionalLight("#fff0c0", 2.6);
    rimR.position.set(3.5, 2.0, -3.0);
    scene.add(rimR);
    const fill = new T.DirectionalLight("#c8d8ff", 0.7);
    fill.position.set(3, 1, 4);
    scene.add(fill);
    cam = new T.PerspectiveCamera(24, W / H, 0.1, 50);
    return true;
  }

  // 役割ごとの決めポーズ
  function poseFor(p, kind) {
    const A = PB.Anim;
    const left = kind === "pit" ? p.throws === "L" : p.bats === "L";
    let pose;
    if (kind === "pit") pose = A.sample(A.pitchClip(), 0.92);
    else if (kind === "cat") pose = A.LIB.crouch;
    else pose = A.sample(A.swingClip(0.8, 0.1), 0.3);
    return left ? A.mirror(pose) : pose;
  }

  function render(job) {
    const { p, team, kind, rim } = job;
    const home = job.home !== false;
    const extra = kind === "bat" ? { helmet: true } : kind === "cat" ? { role: "catcher", pos: "C" } : {};
    const spec = PB.View3D.specFor(p, team, home, extra);
    const pl = PB.Human.createPlayer(spec);
    const rig = new PB.Human.Rig(pl);
    if (kind === "bat") {
      pl.setHelmet(true);
      pl.showBat(true);
      pl.showGlove(false);
      pl.setBattingGloves(true);
    } else {
      pl.showBat(false);
      pl.showGlove(true);
    }
    const left = kind === "pit" ? p.throws === "L" : p.bats === "L";
    // 斜め前から見る向き (打者は投手の方を、投手は打者の方を向いた形)
    const yaw = job.yaw != null ? (left ? -job.yaw : job.yaw) : kind === "bat" ? (left ? 2.5 : -2.5) : kind === "pit" ? (left ? 0.9 : -0.9) : 0.35;
    pl.group.rotation.y = yaw;
    scene.add(pl.group);
    rig.apply(poseFor(p, kind));
    pl.group.updateMatrixWorld(true);
    // 骨とバットの先から写る範囲を求める
    const box = new T.Box3();
    const v = new T.Vector3();
    pl.skeleton.bones.forEach((b) => box.expandByPoint(b.getWorldPosition(v)));
    if (pl.gear.bat && pl.gear.bat.visible) {
      const bb = new T.Box3().setFromObject(pl.gear.bat);
      box.union(bb);
    }
    box.max.y += 0.14; // 頭のてっぺん
    box.min.y = Math.min(box.min.y, 0);
    const c = box.getCenter(new T.Vector3());
    const size = box.getSize(new T.Vector3());
    const hgt = Math.max(size.y, (size.x * H) / W) * 1.08;
    const dist = hgt / 2 / Math.tan((cam.fov * Math.PI) / 360);
    // 少し下から見上げる (手前に出ている部分が切れないよう、箱の手前の面から距離をとる)
    cam.position.set(c.x, c.y - hgt * 0.06, box.max.z + dist);
    cam.lookAt(c.x, c.y + hgt * 0.01, c.z);
    rimL.color.set(rim || "#fff0c0");
    rimR.color.set(rim || "#fff0c0");
    renderer.render(scene, cam);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    out.getContext("2d").drawImage(renderer.domElement, 0, 0);
    scene.remove(pl.group);
    pl.dispose();
    return out;
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const job = queue.shift();
    Promise.resolve()
      .then(() => PB.Human.load("models/"))
      .then(() => PB.Human.preloadTeam(job.team))
      .then(() => {
        if (!setup()) throw new Error("WebGL を使えません");
        return render(job);
      })
      .then(
        (cv) => job.resolve(cv),
        (err) => job.reject(err)
      )
      .then(() => {
        busy = false;
        setTimeout(pump, 16);
      });
  }

  // 選手の切り抜き画像 (canvas) を返す。kind: "bat" | "pit" | "cat" (省略時は守備位置から)
  Pt.get = function (p, team, opts) {
    const o = opts || {};
    const kind = o.kind || (p.pos === "P" ? "pit" : "bat");
    const key = p.id + ":" + team.id + ":" + kind + ":" + (o.home === false ? "a" : "h") + ":" + (o.rim || "") + ":" + (o.yaw != null ? o.yaw : "");
    if (cache.has(key)) {
      // 最近使ったものを後ろへ (古いものから捨てる)
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const pr = new Promise((resolve, reject) => {
      queue.push({ p, team, kind, home: o.home, rim: o.rim, yaw: o.yaw, resolve, reject });
      pump();
    });
    cache.set(key, pr);
    pr.catch(() => cache.delete(key));
    while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    return pr;
  };
  Pt.size = { w: W, h: H };

  PB.Portraits = Pt;
})((window.PB = window.PB || {}));
