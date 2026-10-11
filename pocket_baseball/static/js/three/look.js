/* 熱闘！ポケットベースボール — 光の共通設定 (PB.Look)
 * 試合 (view.js / stadium.js)・選手の確認ページ (dev/human.html)・選手カード (portrait.js) で同じ光を使う。
 * 環境マップ (IBL) は、空・スタンド・芝・照明塔・ドームの照明リングだけの簡単な景色を PMREM で畳み込んで作る。
 * WebGL1 や半精度の色バッファが使えない端末では環境マップを作らず、半球ライトを強めにした昔の光に戻す。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const L = {};
  PB.Look = L;
  if (!T) return;

  // 環境マップを作れるか (PMREM は半精度浮動小数のキューブに描く)
  L.canEnv = function (renderer) {
    if (!renderer || !renderer.capabilities || !renderer.capabilities.isWebGL2) return false;
    const ex = renderer.extensions;
    return !!(ex.has("EXT_color_buffer_float") || ex.has("EXT_color_buffer_half_float"));
  };

  /* ---------- ライトの強さ (環境マップの有無で切り替え) ---------- */
  // kind: "night" | "day" | "dome" | "studio"
  // hemi: [空, 地面, 強さ (環境マップ無し), 強さ (有り)], key/fill: [色, 無し, 有り], post: 仕上げ処理 (post.js) の強さ
  const PRESET = {
    night: { hemi: ["#9fb0d0", "#28361f", 0.85, 0.3], key: ["#fff1dc", 2.3, 2.1], fill: ["#cfe0ff", 0.55, 0.15], exposure: 1.1, post: { bloom: 0.9, threshold: 1.1, vignette: 0.3, sat: 1.08, contrast: 1.05 } },
    day: { hemi: ["#cfe4ff", "#4f5f2c", 1.0, 0.3], key: ["#fff2d6", 3.0, 2.9], fill: ["#cfe0ff", 0.35, 0.1], exposure: 0.95, post: { bloom: 0.15, threshold: 1.6, vignette: 0.22, sat: 1.06, contrast: 1.05 } },
    dome: { hemi: ["#f4f1ea", "#4a4a3a", 1.25, 0.35], key: ["#fffaf0", 1.7, 1.5], fill: ["#cfe0ff", 0.6, 0.2], exposure: 1.05, post: { bloom: 0.3, threshold: 1.2, vignette: 0.26, sat: 1.07, contrast: 1.05 } },
    studio: { hemi: ["#f4f6ff", "#6a5a48", 0.85, 0.25], key: ["#fff4e6", 2.6, 2.4], fill: ["#c8d8ff", 0.7, 0.25], exposure: 1.05, post: { bloom: 0.2, threshold: 1.4, vignette: 0.2, sat: 1.06, contrast: 1.04 } },
  };
  L.kindOf = (night, dome) => (dome ? "dome" : night ? "night" : "day");
  L.preset = (kind) => PRESET[kind] || PRESET.night;
  // { hemi, key, fill } のライトに強さ・色を入れる
  L.setLights = function (lights, kind, env) {
    const p = L.preset(kind);
    if (lights.hemi) {
      lights.hemi.color.set(p.hemi[0]);
      lights.hemi.groundColor.set(p.hemi[1]);
      lights.hemi.intensity = env ? p.hemi[3] : p.hemi[2];
    }
    if (lights.key) {
      lights.key.color.set(p.key[0]);
      lights.key.intensity = env ? p.key[2] : p.key[1];
    }
    if (lights.fill) {
      lights.fill.color.set(p.fill[0]);
      lights.fill.intensity = env ? p.fill[2] : p.fill[1];
    }
    return p;
  };

  /* ---------- 環境マップ用の景色 ---------- */
  const lin = (c) => new T.Color(c); // Color は線形で持つ
  const PROBE_VS = "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const PROBE_FS = `
uniform vec3 uTop; uniform vec3 uHz; uniform vec3 uStand; uniform vec3 uGround; uniform vec3 uDirt; uniform vec3 uRoof;
uniform float uDome; uniform float uStandTop; uniform float uSpeck;
varying vec3 vD;
float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vD);
  float y = d.y;
  // 空 (ドームは屋根の膜)
  vec3 c = mix(uHz, uTop, pow(clamp(y, 0.0, 1.0), 0.5));
  if (uDome > 0.5) c = uRoof * (0.65 + 0.35 * clamp(y, 0.0, 1.0));
  // スタンド (地平線から uStandTop まで) と観客のまだら
  float st = smoothstep(-0.03, 0.0, y) * (1.0 - smoothstep(uStandTop - 0.03, uStandTop + 0.03, y));
  vec3 sc = uStand * (1.0 + uSpeck * (hh(floor(d * 160.0)) - 0.5));
  c = mix(c, sc, st);
  // 地面 (芝、真下は内野の土)
  if (y < 0.0) c = mix(uGround, uDirt, smoothstep(-0.75, -0.95, y)) * (0.9 + 0.1 * hh(floor(d * 60.0)));
  gl_FragColor = vec4(c, 1.0);
}`;

  // o: { kind, seat, roof, grass, dirt, towers: [Vector3 (中心からの向き)], key: Vector3 (主光源の向き) }
  L.probeScene = function (o) {
    o = o || {};
    const kind = o.kind || "night";
    const night = kind === "night";
    const dome = kind === "dome";
    const scene = new T.Scene();
    const trash = [];
    const keep = (x) => (trash.push(x), x);
    const seat = lin(o.seat || "#2d4f86");
    const crowd = new T.Color(0.5, 0.45, 0.42);
    const stand = seat.clone().multiplyScalar(0.55).add(crowd.multiplyScalar(0.45));
    const grass = lin(o.grass || "#3d8f3a");
    const dirt = lin(o.dirt || "#b57a4b");
    let top;
    let hz;
    let standK;
    let groundK;
    if (night) {
      top = new T.Color(0.004, 0.007, 0.022);
      hz = new T.Color(0.05, 0.06, 0.09);
      standK = 0.32;
      groundK = 0.5;
    } else if (dome) {
      top = new T.Color(0.3, 0.3, 0.3);
      hz = new T.Color(0.3, 0.3, 0.3);
      standK = 0.36;
      groundK = 0.55;
    } else if (kind === "studio") {
      // 写真スタジオ風: 上は少し青い白、地面は暖かい灰色 (芝の緑を映さない)
      top = new T.Color(0.62, 0.66, 0.76);
      hz = new T.Color(0.42, 0.42, 0.44);
      stand.setRGB(0.5, 0.48, 0.47);
      grass.setRGB(0.3, 0.27, 0.24);
      dirt.setRGB(0.3, 0.27, 0.24);
      standK = 0.6;
      groundK = 0.6;
    } else {
      top = new T.Color(0.16, 0.32, 0.72);
      hz = new T.Color(0.62, 0.72, 0.86);
      standK = 0.5;
      groundK = 0.9;
    }
    const mat = keep(
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          uTop: { value: top },
          uHz: { value: hz },
          uStand: { value: stand.multiplyScalar(standK) },
          uGround: { value: grass.clone().multiplyScalar(groundK) },
          uDirt: { value: dirt.clone().multiplyScalar(groundK * 0.8) },
          uRoof: { value: lin(o.roof || "#e6e6e0").multiplyScalar(0.42) },
          uDome: { value: dome ? 1 : 0 },
          uStandTop: { value: dome ? 0.42 : 0.38 },
          uSpeck: { value: kind === "studio" ? 0 : 0.9 },
        },
        vertexShader: PROBE_VS,
        fragmentShader: PROBE_FS,
      })
    );
    scene.add(new T.Mesh(keep(new T.SphereGeometry(50, 48, 24)), mat));
    // 照明塔の投光器 (HDR: 小さくてもとても明るい → ヘルメットや目に映り込む)
    if (night) {
      const towers = o.towers && o.towers.length ? o.towers : [-150, -105, -50, 50, 105, 150].map((deg) => new T.Vector3(Math.sin(deg * Math.PI / 180), 0.55, Math.cos(deg * Math.PI / 180)));
      const bm = keep(new T.MeshBasicMaterial({ color: new T.Color(1, 0.95, 0.86).multiplyScalar(26), side: T.DoubleSide }));
      const bg = keep(new T.PlaneGeometry(6, 3.4));
      for (const d of towers) {
        const m = new T.Mesh(bg, bm);
        m.position.copy(d).normalize().multiplyScalar(40);
        m.lookAt(0, 0, 0);
        scene.add(m);
      }
    }
    // ドームの照明リング
    if (dome) {
      const rm = keep(new T.MeshBasicMaterial({ color: new T.Color(1, 0.97, 0.9).multiplyScalar(9), side: T.DoubleSide }));
      const rg = keep(new T.PlaneGeometry(1.6, 1.6));
      for (const el of [0.62, 0.95]) {
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          const m = new T.Mesh(rg, rm);
          m.position.set(Math.sin(a) * Math.cos(el) * 40, Math.sin(el) * 40, Math.cos(a) * Math.cos(el) * 40);
          m.lookAt(0, 0, 0);
          scene.add(m);
        }
      }
    }
    // 昼は太陽のまわりを少し明るく (太陽そのものは平行光源で出す)
    if (kind === "day" || kind === "studio") {
      const dir = (o.key || new T.Vector3(0.5, 0.7, 0.5)).clone().normalize();
      const sm = keep(new T.MeshBasicMaterial({ color: new T.Color(1, 0.96, 0.88).multiplyScalar(kind === "day" ? 6 : 4), side: T.DoubleSide }));
      const s = new T.Mesh(keep(new T.CircleGeometry(4, 16)), sm);
      s.position.copy(dir).multiplyScalar(40);
      s.lookAt(0, 0, 0);
      scene.add(s);
    }
    return {
      scene,
      dispose() {
        for (const x of trash) x.dispose();
      },
    };
  };

  // 環境マップ (PMREM の RenderTarget) を作る。使えなければ null
  L.makeEnv = function (renderer, o) {
    if (!L.canEnv(renderer)) return null;
    const ps = L.probeScene(o);
    let rt = null;
    let pm = null;
    try {
      pm = new T.PMREMGenerator(renderer);
      rt = pm.fromScene(ps.scene, 0, 0.1, 100);
    } catch (e) {
      console.warn("環境マップを作れませんでした", e);
      if (rt) rt.dispose();
      rt = null;
    }
    if (pm) pm.dispose();
    ps.dispose();
    return rt;
  };

  /* ---------- 選手だけを照らす小さな舞台 (確認ページ・選手カード) ---------- */
  // o: { kind (光の強さ), envKind (環境マップの景色。省略時は kind), rim: false で縁の光なし, seat, grass }
  L.stage = function (scene, renderer, o) {
    o = o || {};
    const kind = o.kind || "night";
    const env = o.env === false ? null : L.makeEnv(renderer, { kind: o.envKind || kind, seat: o.seat, grass: o.grass, key: new T.Vector3(-2.5, 3.2, 4.5) });
    const hemi = new T.HemisphereLight("#ffffff", "#444444", 1);
    const key = new T.DirectionalLight("#ffffff", 1);
    const fill = new T.DirectionalLight("#ffffff", 1);
    key.position.set(-2.5, 3.2, 4.5);
    fill.position.set(3, 1, 4);
    const lights = { hemi, key, fill };
    scene.add(hemi, key, fill);
    let rimL = null;
    let rimR = null;
    if (o.rim !== false) {
      // 後ろからの縁の光 (切り抜き写真のふち)
      rimL = new T.DirectionalLight("#fff0c0", env ? 4.2 : 3.2);
      rimL.position.set(-3.5, 2.5, -3.5);
      rimR = new T.DirectionalLight("#fff0c0", env ? 3.4 : 2.6);
      rimR.position.set(3.5, 2.0, -3.0);
      scene.add(rimL, rimR);
    }
    const p = L.setLights(lights, kind, !!env);
    if (env) scene.environment = env.texture;
    return {
      env,
      lights,
      rimL,
      rimR,
      exposure: p.exposure,
      rim(color) {
        if (rimL) rimL.color.set(color || "#fff0c0");
        if (rimR) rimR.color.set(color || "#fff0c0");
      },
      dispose() {
        scene.remove(hemi, key, fill);
        if (rimL) scene.remove(rimL, rimR);
        if (scene.environment === (env && env.texture)) scene.environment = null;
        if (env) env.dispose();
      },
    };
  };
})((window.PB = window.PB || {}));
