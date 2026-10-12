/* 熱闘！ポケットベースボール — 選手カード用の切り抜き画像 (3D の選手を透明な背景に描く)
   打者はフォロースルー、投手は投げ終わり、捕手は構え。1 枚ずつ順番に描いてキャッシュする。
   光は試合と同じ PB.Look (環境マップ + 主光源) に、チーム色の縁の光を足す。
   なるべく試合の WebGL (PB.View3D) を借りて RenderTarget に描き、トーンマップと sRGB を自前でかけて読み出す
   (WebGL のコンテキストを 2 つ作らない。iOS では数に限りがある)。借りられないときだけ自前の小さなレンダラーで描く。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  if (!T) return;
  const Pt = {};
  const W = 420;
  const H = 560;
  let scene = null;
  let cam = null;
  let stage = null; // PB.Look の光と環境マップ (描くレンダラーごとに作る)
  let stageOwner = null;
  let priv = null; // 自前のレンダラー (借りられないとき)
  let shared = null; // 借りたレンダラー用の RenderTarget など
  const cache = new Map();
  const MAX_CACHE = 36; // 1 枚およそ 1MB
  const queue = [];
  let busy = false;

  Pt.available = () => !!(T && PB.Human && PB.View3D && PB.View3D.specFor);

  function ensureScene() {
    if (scene) return;
    scene = new T.Scene();
    cam = new T.PerspectiveCamera(24, W / H, 0.1, 50);
  }
  // 光と環境マップ (レンダラーが変わったら作り直す)
  function ensureStage(r, owner) {
    if (stage && stageOwner === owner) return;
    if (stage) {
      scene.remove(stage.lights.key.target);
      stage.dispose();
    }
    stage = null;
    if (PB.Look && PB.Look.stage) {
      stage = PB.Look.stage(scene, r, { kind: "studio", rim: true });
      const key = stage.lights.key;
      key.position.set(-2.5, 3.2, 4.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      scene.add(key.target);
    } else {
      // PB.Look が無いときの昔の光
      const hemi = new T.HemisphereLight("#f4f6ff", "#6a5a48", 0.85);
      const key = new T.DirectionalLight("#fff4e6", 2.6);
      key.position.set(-2.5, 3.2, 4.5);
      const rimL = new T.DirectionalLight("#fff0c0", 3.2);
      rimL.position.set(-3.5, 2.5, -3.5);
      const rimR = new T.DirectionalLight("#fff0c0", 2.6);
      rimR.position.set(3.5, 2.0, -3.0);
      const fill = new T.DirectionalLight("#c8d8ff", 0.7);
      fill.position.set(3, 1, 4);
      scene.add(hemi, key, rimL, rimR, fill);
      stage = {
        exposure: 1.05,
        lights: { key },
        rim(c) {
          rimL.color.set(c || "#fff0c0");
          rimR.color.set(c || "#fff0c0");
        },
        dispose() {
          scene.remove(hemi, key, rimL, rimR, fill);
        },
      };
    }
    stageOwner = owner;
  }

  /* ---------- 試合のレンダラーを借りる ---------- */
  const RESOLVE_FS = `
uniform sampler2D tSrc; uniform float uExposure;
varying vec2 vUv;
vec3 pbRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 pbACES(vec3 c){
  const mat3 IM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= uExposure / 0.6;
  c = OM * pbRRT(IM * c);
  return clamp(c, 0.0, 1.0);
}
vec3 pbSRGB(vec3 c){ return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
void main(){
  vec4 s = texture2D(tSrc, vUv);
  // 透明な背景に描いたので色はアルファ済み → 戻してからトーンマップ (読み出しはアルファ無しの値)
  float a = clamp(s.a, 0.0, 1.0);
  vec3 c = a > 0.0 ? s.rgb / a : vec3(0.0);
  c = pbSRGB(pbACES(c));
  gl_FragColor = vec4(c, a);
}`;
  function sharedRenderer() {
    const V3 = PB.View3D;
    const r = V3 && V3.renderer ? V3.renderer() : null;
    if (!r || !r.capabilities.isWebGL2 || !PB.Look || !PB.Look.canEnv(r)) return null;
    if (shared && shared.r === r && shared.gen === V3.gen) return shared;
    if (shared) disposeShared();
    const gl = r.getContext();
    const hdr = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType, samples: 4, depthBuffer: true, stencilBuffer: false });
    const ldr = new T.WebGLRenderTarget(W, H, { type: T.UnsignedByteType, depthBuffer: false, stencilBuffer: false });
    hdr.texture.generateMipmaps = ldr.texture.generateMipmaps = false;
    const prev = r.getRenderTarget();
    let ok = true;
    for (const rt of [hdr, ldr]) {
      r.setRenderTarget(rt);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) ok = false;
    }
    r.setRenderTarget(prev);
    if (!ok) {
      hdr.dispose();
      ldr.dispose();
      return null;
    }
    const mat = new T.ShaderMaterial({
      uniforms: { tSrc: { value: hdr.texture }, uExposure: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: RESOLVE_FS,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const fs = new T.Scene();
    fs.add(quad);
    shared = { r, gen: V3.gen, hdr, ldr, mat, quad, fs, fsCam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), buf: new Uint8Array(W * H * 4) };
    return shared;
  }
  function disposeShared() {
    if (!shared) return;
    shared.hdr.dispose();
    shared.ldr.dispose();
    shared.mat.dispose();
    shared.quad.geometry.dispose();
    if (stageOwner === shared) {
      scene.remove(stage.lights.key.target);
      stage.dispose();
      stage = null;
      stageOwner = null;
    }
    shared = null;
  }
  // 借りたレンダラーで描く: HDR (MSAA) → 自前のトーンマップと sRGB → 8bit → 読み出し。レンダラーの状態は元に戻す
  function drawShared(sh) {
    const r = sh.r;
    const prevRT = r.getRenderTarget();
    const prevAuto = r.autoClear;
    const prevClear = r.getClearColor(new T.Color());
    const prevAlpha = r.getClearAlpha();
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    try {
      r.autoClear = true;
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(sh.hdr);
      r.render(scene, cam);
      sh.mat.uniforms.uExposure.value = stage.exposure || 1.05;
      r.setRenderTarget(sh.ldr);
      r.render(sh.fs, sh.fsCam);
      r.readRenderTargetPixels(sh.ldr, 0, 0, W, H, sh.buf);
    } finally {
      r.setRenderTarget(prevRT);
      r.setClearColor(prevClear, prevAlpha);
      r.autoClear = prevAuto;
    }
    // 上下を入れ替えてキャンバスへ
    const ctx = out.getContext("2d");
    const img = ctx.createImageData(W, H);
    const row = W * 4;
    for (let y = 0; y < H; y++) img.data.set(sh.buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    return out;
  }

  /* ---------- 自前のレンダラー (借りられないとき) ---------- */
  function privateRenderer() {
    if (priv) return priv;
    let r;
    try {
      r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: "low-power" });
    } catch (e) {
      return null;
    }
    if (!r.getContext()) return null;
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    priv = { r };
    return priv;
  }
  function drawPrivate(pv) {
    pv.r.toneMappingExposure = stage.exposure || 1.05;
    pv.r.render(scene, cam);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    out.getContext("2d").drawImage(pv.r.domElement, 0, 0);
    return out;
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
    ensureScene();
    const sh = sharedRenderer();
    const pv = sh ? null : privateRenderer();
    if (!sh && !pv) throw new Error("WebGL を使えません");
    ensureStage(sh ? sh.r : pv.r, sh || pv);
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
    stage.rim(rim || "#fff0c0");
    // 主光源の影は選手のまわりだけ (帽子のつばや腕の影)
    const key = stage.lights.key;
    if (key.castShadow) {
      const sc = key.shadow.camera;
      const rad = Math.max(size.x, size.y, size.z) * 0.62 + 0.2;
      key.target.position.copy(c);
      key.position.copy(c).add(new T.Vector3(-2.5, 3.2, 4.5).normalize().multiplyScalar(6));
      sc.left = sc.bottom = -rad;
      sc.right = sc.top = rad;
      sc.near = 0.5;
      sc.far = 14;
      sc.updateProjectionMatrix();
    }
    let out;
    try {
      out = sh ? drawShared(sh) : drawPrivate(pv);
      lastMode = sh ? "shared" : "private";
    } finally {
      scene.remove(pl.group);
      pl.dispose();
    }
    return out;
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const job = queue.shift();
    Promise.resolve()
      .then(() => PB.Human.load("models/"))
      .then(() => PB.Human.preloadTeam(job.team))
      .then(() => render(job))
      .then(
        (cv) => job.resolve(cv),
        (err) => job.reject(err)
      )
      .then(() => {
        busy = false;
        setTimeout(pump, 16);
        if (!queue.length && priv) idleRelease();
      });
  }
  // 自前のレンダラー (2 つ目の WebGL) は、しばらく使わなければ手放す (弱い端末ほどこちらを使うので、メモリを返す)
  let idleT = 0;
  function idleRelease() {
    clearTimeout(idleT);
    idleT = setTimeout(() => {
      if (busy || queue.length || !priv) return;
      if (stage && stageOwner === priv) {
        scene.remove(stage.lights.key.target);
        stage.dispose();
        stage = null;
        stageOwner = null;
      }
      priv.r.dispose();
      try {
        priv.r.forceContextLoss();
      } catch (e) {
        /* もう使わない */
      }
      priv = null;
    }, 15000);
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
  // 確認用: 最後にどちらのレンダラーで描いたか
  let lastMode = "none";
  Pt.mode = () => lastMode;

  PB.Portraits = Pt;
})((window.PB = window.PB || {}));
