/* 熱闘！ポケットベースボール — 3D 描画レイヤー
 * 2D の試合ロジック (Match / Play) の状態を読み取り、three.js の球場と選手モデルで描く。
 * カメラは render.js の Cam (ピンホール) をそのまま写すので、2D のオーバーレイ (ゾーン・カーソル) と画面上で一致する。
 * 打席視点の打者だけは別カメラで描いて画面の横に大きく置く (縦画面でも打者が収まるように)。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const V3 = { ok: false, active: false, quality: "mid" };
  PB.View3D = V3;
  if (!T || !PB.Stadium3D || !PB.Model3D || !PB.Anim) return;
  const U = PB.U;
  const D = PB.D;
  const F = PB.F;
  const P = PB.P;
  const A = PB.Anim;
  const M = PB.Model3D;
  const S3 = PB.Stadium3D;
  const V = S3.V;
  const TAU = Math.PI * 2;

  let renderer = null;
  let canvasEl = null;
  let post = null; // 仕上げ処理 (post.js)。low と、使えない端末では null (画面に直接描く)
  let canvasAA = true; // 画面のキャンバス自体が MSAA を持つか
  // 確認用の切り替え (?post=0|ldr, ?env=0)
  const QS = new URLSearchParams((window.location && window.location.search) || "");
  V3.gen = 0; // WebGL コンテキストを作り直した回数 (portrait.js が環境マップを作り直す目印)
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(30, 1, 0.4, 4000);
  const layerCam = new T.PerspectiveCamera(30, 1, 0.2, 400);
  layerCam.layers.set(1);
  let stadium = null;
  let stadiumKey = "";
  let W = 1;
  let H = 1;
  let DPR = 1;
  let tick = 0;
  let created = 0;
  const actors = new Map();
  const MAX_ACTORS = 46;

  /* ---------- 初期化 ---------- */
  // 仕上げ処理 (MSAA 付きの RenderTarget) を使う画質では、画面のキャンバスに MSAA は要らない
  const wantCanvasAA = (q) => !(q !== "low" && PB.Post && typeof window.WebGL2RenderingContext !== "undefined" && QS.get("post") !== "0");
  function makeRenderer(cv, q) {
    canvasAA = wantCanvasAA(q);
    let r = null;
    try {
      r = new T.WebGLRenderer({ canvas: cv, antialias: canvasAA, powerPreference: "high-performance", stencil: false });
    } catch (e) {
      console.warn("WebGL を初期化できませんでした", e);
      return null;
    }
    if (!r.getContext()) return null;
    // GPU の名前 (ソフトウェア描画では解像度の自動調整をしない)
    try {
      const gl = r.getContext();
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      V3.gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    } catch (e) {
      V3.gpu = "";
    }
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.setClearColor(0x05080f, 1);
    // 1 フレームの全部の描画 (影・打者レイヤー・仕上げ) を数える
    r.info.autoReset = false;
    // 差し替えて捨てたキャンバスの通知は無視する
    cv.addEventListener("webglcontextlost", (e) => {
      if (cv !== canvasEl) return;
      e.preventDefault();
      V3.lost = true;
    });
    cv.addEventListener("webglcontextrestored", () => {
      if (cv !== canvasEl) return;
      V3.lost = false;
      V3.gen++;
      stadiumKey = "";
      if (post) post.reset();
      V3.resize(W, H, DPR);
    });
    return r;
  }
  V3.init = function (cv, quality) {
    canvasEl = cv;
    const q = quality || "mid";
    renderer = makeRenderer(cv, q);
    if (!renderer) return false;
    if (!ball) makeBall();
    V3.ok = true;
    V3.setQuality(q);
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(() => {
        if (stadium) {
          stadium.board.last = "";
        }
      });
    return true;
  };
  V3.canvas = () => canvasEl;

  // 3D を休ませる (2D 表示に切り替えたとき・キャンバスを作り直すとき): 球場・選手・仕上げ処理の GPU 資源を手放す
  V3.release = function () {
    V3.clearActors();
    if (stadium) {
      scene.remove(stadium.group);
      stadium.dispose();
      stadium = null;
    }
    stadiumKey = "";
    scene.environment = null;
    scene.fog = null;
    if (post) post.dispose();
    post = null;
  };

  // 画面のキャンバスの MSAA の有無は後から変えられないので、low ⇔ mid/high で変わるときはキャンバスごと作り直す
  function swapCanvas(q) {
    const old = renderer;
    const oc = canvasEl;
    if (!oc || !oc.parentNode) return false;
    V3.release();
    const nc = oc.cloneNode(false);
    oc.parentNode.replaceChild(nc, oc);
    canvasEl = nc;
    old.dispose();
    try {
      old.forceContextLoss();
    } catch (e) {
      /* 古いコンテキストはもう使わない */
    }
    V3.gen++;
    V3.lost = false;
    renderer = makeRenderer(nc, q);
    if (!renderer) {
      V3.ok = false;
      return false;
    }
    return true;
  }

  V3.setQuality = function (q) {
    q = q || "mid";
    const prev = V3.quality;
    V3.quality = q;
    if (!renderer) return;
    if (canvasAA !== wantCanvasAA(q) && !swapCanvas(q)) return;
    // 選手のマテリアル (肌・帽子のテクスチャ) は画質ごとに作り分けるので作り直す
    if (prev !== q) V3.clearActors();
    renderer.shadowMap.enabled = q !== "low";
    // 仕上げ処理: mid/high だけ (low は画面に直接描く)
    if (post) post.dispose();
    post = null;
    if (q !== "low" && PB.Post && PB.Post.create && QS.get("post") !== "0") {
      post = PB.Post.create(renderer, q, { force: QS.get("post") });
      if (!post.ok) post = null;
    }
    drsReset();
    V3.resize(W, H, DPR);
    stadiumKey = "";
  };

  const _size = new T.Vector2();
  // 画質ごとの描画解像度 (ピクセル比) の上限
  const prCap = () => (V3.quality === "high" ? Math.min(DPR, 2) : V3.quality === "mid" ? Math.min(DPR, 1.5) : Math.min(DPR, 1));
  V3.resize = function (w, h, dpr) {
    W = w;
    H = h;
    DPR = dpr || 1;
    if (!renderer) return;
    applySize(true);
  };
  // 仕上げ処理があれば画面のキャンバスは上限の解像度のままで、描き込む RenderTarget だけを縮める (仕上げで拡大して出す)
  function applySize(full) {
    const cap = prCap();
    const s = DRS.on ? DRS.scale : 1;
    if (full || !post) {
      renderer.setPixelRatio(post ? cap : cap * s);
      renderer.setSize(W, H, false);
    }
    if (post) {
      renderer.getDrawingBufferSize(_size);
      // 作れなかったら (フレームバッファ未対応など) 直接描く
      if (!post.setSize(_size.x * s, _size.y * s)) {
        post.dispose();
        post = null;
        renderer.setPixelRatio(cap * s);
        renderer.setSize(W, H, false);
      }
    }
  }

  /* ---------- 解像度の自動調整 (mid/high) ---------- */
  // 1 フレームの間隔の移動平均を見て、重い状態が 1 秒続いたら描画の解像度を 1 段下げ、
  // 軽い状態 (画面の更新に間に合っている) が続いたら 1 段戻す。戻してすぐ重くなったら、次に戻すまでの待ちを倍にする
  const DRS = { on: false, scale: 1, min: 0.7, ema: 16.7, last: 0, slowT: 0, fastT: 0, wait: 3, upAt: -1e9, poorT: 0 };
  const DRS_SLOW = 21; // ms (48fps を割る)
  const DRS_FAST = 17.8; // ms (60fps の画面更新に間に合っている)
  const SOFT_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;
  function drsReset() {
    const forced = Number(QS.get("drs"));
    // ソフトウェア描画 (SwiftShader などのテスト環境) では GPU の重さを測れないので調整しない
    // (?drs=on で強制的に有効、?drs=0 で無効)
    DRS.on = V3.quality !== "low" && QS.get("drs") !== "0" && (!SOFT_GPU.test(V3.gpu || "") || QS.get("drs") === "on" || forced > 0);
    // ?drs=0.7 などで縮尺を固定 (確認用)
    DRS.fixed = forced > 0 && forced <= 1 ? forced : 0;
    DRS.scale = DRS.fixed || 1;
    DRS.ema = 16.7;
    DRS.slowT = DRS.fastT = DRS.poorT = 0;
    DRS.wait = 3;
    DRS.last = 0;
  }
  function drsSet(s) {
    s = Math.max(DRS.min, Math.min(1, Math.round(s * 100) / 100));
    if (s === DRS.scale) return;
    DRS.scale = s;
    applySize(false);
  }
  function drsTick() {
    const now = performance.now();
    const ft = DRS.last ? now - DRS.last : 0;
    DRS.last = now;
    // 止まっていたフレーム (タブの切り替え・シェーダーの準備) は数えない
    if (!DRS.on || ft <= 0 || ft > 250) return;
    DRS.ema += (ft - DRS.ema) * 0.08;
    if (DRS.fixed) return;
    const sec = ft / 1000;
    if (DRS.ema > DRS_SLOW) {
      DRS.slowT += sec;
      DRS.fastT = 0;
    } else if (DRS.ema < DRS_FAST) {
      DRS.fastT += sec;
      DRS.slowT = 0;
    } else DRS.slowT = DRS.fastT = 0;
    if (DRS.slowT > 1 && DRS.scale > DRS.min) {
      // 戻してすぐ重くなった: 次に戻すまで長く待つ
      if (now - DRS.upAt < 5000) DRS.wait = Math.min(60, DRS.wait * 2);
      DRS.slowT = 0;
      drsSet(DRS.scale - 0.1);
    } else if (DRS.fastT > DRS.wait && DRS.scale < 1) {
      DRS.fastT = 0;
      DRS.upAt = now;
      drsSet(DRS.scale + 0.1);
    } else if (DRS.fastT > 20) DRS.wait = 3;
    // 一番下げても 25fps に届かない状態が続いたら知らせる (main.js が「自動」の画質を 1 段下げる)
    DRS.poorT = DRS.scale <= DRS.min && DRS.ema > 40 ? DRS.poorT + sec : 0;
    if (DRS.poorT > 6) {
      DRS.poorT = -1e9;
      if (V3.onPoor) V3.onPoor(V3.quality);
    }
  }
  // 選手カード (portrait.js) が同じ WebGL コンテキストで描くため
  V3.renderer = () => (V3.ok && !V3.lost ? renderer : null);

  function ensureStadium(home, away, night) {
    const key = (home ? home.id : "-") + "|" + (away ? away.id : "-") + "|" + V3.quality;
    if (key !== stadiumKey || !stadium) {
      if (stadium) {
        scene.remove(stadium.group);
        stadium.dispose();
      }
      const lg = home && PB.D.teamDef && PB.D.teamDef(home.id) ? PB.D.teamDef(home.id).lg : null;
      const flags = lg ? PB.D.TEAMS.filter((t) => t.lg === lg) : [];
      stadium = S3.build({ home, away, night, quality: V3.quality, flags });
      for (const l of [stadium.lights.hemi, stadium.lights.key, stadium.lights.fill]) l.layers.enableAll();
      scene.add(stadium.group);
      scene.fog = stadium.fog;
      stadiumKey = key;
    }
    if (stadium.night !== !!night) stadium.setNight(night);
    // 環境マップ (IBL): 球場の空・スタンド・照明塔から作る (昼夜を切り替えたら作り直す)
    const env = QS.get("env") !== "0" && stadium.envFor ? stadium.envFor(renderer) : null;
    scene.environment = env ? env.texture : null;
    if (stadium.setEnv) stadium.setEnv(!!env);
    if (stadium.setPost && stadium.postOn !== !!post) stadium.setPost(!!post);
    const msaa = post ? post.samples > 0 : canvasAA;
    if (stadium.setMSAA && stadium.msaa !== msaa) {
      stadium.msaa = msaa;
      stadium.setMSAA(msaa);
    }
    renderer.toneMappingExposure = stadium.exposure;
    return stadium;
  }

  /* ---------- カメラ (render.js の Cam を写す) ---------- */
  function syncCam(c3, rc) {
    c3.position.set(rc.pos[0], rc.pos[2], -rc.pos[1]);
    c3.up.set(0, 1, 0);
    c3.lookAt(rc.target[0], rc.target[2], -rc.target[1]);
    c3.updateMatrixWorld(true);
    const n = c3.near;
    const f = rc.f;
    c3.projectionMatrix.makePerspective((-rc.cx / f) * n, ((W - rc.cx) / f) * n, (rc.cy / f) * n, (-(H - rc.cy) / f) * n, n, c3.far);
    c3.projectionMatrixInverse.copy(c3.projectionMatrix).invert();
  }
  // 打者レイヤー用: 同じ向き・同じ投影で、アンカー点が画面 (sx,sy) に k px/m の大きさで写る位置にカメラを置く
  function syncLayerCam(rc, anchor, sx, sy, k) {
    const d = rc.f / k;
    const cxv = ((sx - rc.cx) * d) / rc.f;
    const cyv = (-(sy - rc.cy) * d) / rc.f;
    const p = [0, 1, 2].map((i) => anchor[i] - (rc.rt[i] * cxv + rc.up[i] * cyv + rc.fw[i] * d));
    layerCam.position.set(p[0], p[2], -p[1]);
    layerCam.quaternion.copy(cam.quaternion);
    layerCam.updateMatrixWorld(true);
    layerCam.projectionMatrix.copy(cam.projectionMatrix);
    layerCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
  }

  /* ---------- ボール ---------- */
  let ball = null;
  let ballShadow = null;
  let layerShadow = null;
  let batShadow = null;
  function makeBall() {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#fbfaf4";
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = "#c8323a";
    x.lineWidth = 3;
    for (const off of [0, 128]) {
      x.beginPath();
      for (let i = 0; i <= 128; i++) {
        const u = off + i;
        const v = 64 + Math.sin((i / 128) * TAU) * 34 * (off ? -1 : 1);
        if (i === 0) x.moveTo(u, v);
        else x.lineTo(u, v);
      }
      x.stroke();
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    ball = new T.Mesh(new T.SphereGeometry(0.0366, 20, 14), new T.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: "#262626" }));
    ball.castShadow = false;
    scene.add(ball);
    const sc = document.createElement("canvas");
    sc.width = sc.height = 64;
    const sx = sc.getContext("2d");
    const g = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.6, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = g;
    sx.fillRect(0, 0, 64, 64);
    const stex = new T.CanvasTexture(sc);
    const smat = new T.MeshBasicMaterial({ map: stex, transparent: true, depthWrite: false });
    ballShadow = new T.Mesh(new T.PlaneGeometry(1, 1), smat);
    ballShadow.rotation.x = -Math.PI / 2;
    scene.add(ballShadow);
    // 打者レイヤーの足元の影 (接地のぼかし)
    layerShadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: stex, transparent: true, depthWrite: false }));
    layerShadow.rotation.x = -Math.PI / 2;
    layerShadow.layers.set(1);
    layerShadow.scale.set(1.3, 0.9, 1);
    scene.add(layerShadow);
    // 打者の本当の影: レイヤー 1 の影だけを受ける透明な板 (レイヤーの描画で影の地図も打者だけで作り直される)
    batShadow = new T.Mesh(new T.PlaneGeometry(6, 6), new T.ShadowMaterial({ opacity: 0.5, depthWrite: false }));
    batShadow.rotation.x = -Math.PI / 2;
    batShadow.receiveShadow = true;
    batShadow.layers.set(1);
    batShadow.renderOrder = 1;
    scene.add(batShadow);
  }
  // ボールを置く (minPx: 画面上の最小直径)
  function placeBall(x, y, z, minPx, spin, dt) {
    ball.visible = true;
    ball.position.set(x, z, -y);
    const d = cam.position.distanceTo(ball.position);
    const f = cam.projectionMatrix.elements[5] * H * 0.5;
    const px = (0.0732 * f) / Math.max(0.1, d);
    const s = Math.max(1, (minPx || 0) / Math.max(0.01, px));
    ball.scale.setScalar(s);
    if (spin) ball.rotation.x += spin * dt;
    ballShadow.visible = z > 0.05;
    if (ballShadow.visible) {
      ballShadow.position.set(x, 0.03, -y);
      // 影はメートルで大きさを決める (ボールを見やすく拡大しても影は広げない)。高いほど薄くぼける。遠くても 3px は残す
      const ds = cam.position.distanceTo(ballShadow.position);
      const k = Math.max(Math.min(0.6, 0.12 + 0.012 * z), (3 * ds) / Math.max(1, f));
      ballShadow.scale.set(k, k, 1);
      ballShadow.material.opacity = Math.max(0.22, 0.8 * (1 - Math.min(1, z / 35)));
    }
  }
  function hideBall() {
    ball.visible = false;
    ballShadow.visible = false;
  }

  /* ---------- 選手 ---------- */
  const hashStr = (s) => {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  function look(team, home) {
    return {
      id: team.id,
      main: team.main,
      sub: team.sub,
      cap: team.cap || team.main,
      mark: team.mark,
      en: team.en || (team.short || "").toUpperCase(),
      away: team.awayJersey || team.main,
      awayPants: "#eeeee8",
      pinstripe: !!team.pinstripe && home,
    };
  }
  function skinOf(p) {
    const f = p.face || {};
    if (f.skin3) return f.skin3;
    const i = D.SKINS.indexOf(f.skin);
    if (i >= 0) return M.SKINS[i];
    return M.SKINS[hashStr(p.id || p.name || "x") % 5];
  }
  function makeSpec(p, team, home, extra) {
    const human = HM();
    const h = hashStr(p.id || p.name || "x");
    return Object.assign(
      {
        team: human ? team : look(team, home),
        seed: p.id || p.name,
        skinTone: p.foreign ? (h % 3 === 0 ? 4 : 1) : h % 3,
        race: p.foreign ? (h % 3 === 0 ? { african: 0.9 } : { caucasian: 0.85 }) : null,
        longPants: p.longPants != null ? p.longPants : h % 5 < 2,
        home,
        num: p.num,
        nameEn: D.romaji(p),
        name: p.name,
        skin: skinOf(p),
        hair: p.face && p.face.hair,
        bats: p.bats === "L" ? "L" : "R",
        throws: p.throws === "L" ? "L" : "R",
        pos: p.pos,
      },
      extra || {}
    );
  }
  // 選手カードの描画 (portrait.js) でも同じ見た目の選手を作る
  V3.specFor = (p, team, home, extra) => makeSpec(p, team, home, extra);
  function umpireSpec() {
    return { role: "umpire", team: { main: "#1b2230", sub: "#e9e9ee", cap: "#14171d" }, skin: M.SKINS[1], bats: "R", throws: "R" };
  }

  const HM = () => PB.Human && PB.Human.ready;
  function getActor(key, specFn, budget) {
    let a = actors.get(key);
    // 実写モデルの読み込みが終わったら簡易モデルを置き換える
    if (a && a.kind === "p" && HM() && created < (budget || 2)) {
      scene.remove(a.pl.group);
      a.pl.dispose();
      actors.delete(key);
      a = null;
    }
    if (!a) {
      if (created >= (budget || 2)) return null;
      created++;
      const spec = specFn();
      const human = HM();
      const pl = human ? PB.Human.createPlayer(spec) : M.createPlayer(spec);
      if (!pl) return null;
      a = { key, pl, kind: human ? "h" : "p", rig: human ? new PB.Human.Rig(pl) : new A.Rig(pl), mem: {}, used: tick, yaw: 0, layer: 0, fresh: true, helmet: !!pl.opts.helmet, bat: false, glove: true };
      actors.set(key, a);
      scene.add(pl.group);
    }
    a.used = tick;
    return a;
  }
  // 試合の前に、両チームの画像・フォントと人体モデルを読み込む
  V3.prepare = function (teams) {
    if (!PB.Human) return Promise.resolve();
    return PB.Human.load("models/").then(() => Promise.all((teams || []).filter(Boolean).map((t) => PB.Human.preloadTeam(t))));
  };
  function setLayer(a, layer) {
    if (a.layer === layer) return;
    a.layer = layer;
    a.pl.group.traverse((o) => o.layers.set(layer));
  }
  function gear(a, o) {
    if (o.helmet != null && o.helmet !== a.helmet) {
      a.helmet = o.helmet;
      a.pl.setHelmet(o.helmet);
    }
    if (o.bat != null && o.bat !== a.bat) {
      a.bat = o.bat;
      a.pl.showBat(o.bat);
    }
    if (o.glove != null && o.glove !== a.glove) {
      a.glove = o.glove;
      a.pl.showGlove(o.glove);
    }
    if (o.bats && a.pl.opts.bats !== o.bats) a.pl.opts.bats = o.bats;
  }
  function angTo(a, b, k) {
    let d = b - a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return a + d * Math.min(1, k);
  }
  // ゲーム座標の向き (dx,dy) を向く Y 回転
  const yawOf = (dx, dy) => Math.atan2(dx, -dy);
  // キャラクター空間の +X を (dx,dy) に向ける Y 回転 (投げる・投球・打席)
  const yawX = (dx, dy) => Math.atan2(dy, dx);

  function pose(a, x, y, z, yaw, p, dt, o) {
    o = o || {};
    const g = a.pl.group;
    g.visible = true;
    g.position.set(x, z || 0, -y);
    if (a.fresh || o.snap) a.yaw = yaw;
    else a.yaw = angTo(a.yaw, yaw, dt * (o.turn || 10));
    g.rotation.y = a.yaw;
    lookHook(a, p);
    if (a.fresh || o.snap || !dt) a.rig.apply(p);
    else a.rig.drive(p, dt, o.rate || 14);
    a.fresh = false;
    setLayer(a, o.layer || 0);
    // 後から骨に付けた道具 (バット) もレイヤーをそろえる
    const bat = a.pl.gear && a.pl.gear.bat;
    if (bat && bat.layers.mask !== a.pl.group.layers.mask) bat.layers.mask = a.pl.group.layers.mask;
  }
  // 視線と待機中の動き (human.js の HRig.setLook): 見えているボール (前のフレームの位置) を頭で追う。
  // 手元のボールは見ない。打者はスイング中は追わない、走者は前を見る。低画質では視線・呼吸などを切る (足の固定は残る)
  function lookHook(a, p) {
    const rig = a.rig;
    if (!rig.setLook) return;
    const life = V3.quality !== "low";
    let w = 0;
    if (life && ball && ball.visible) {
      const g = a.pl.group.position;
      const b = ball.position;
      const near = Math.hypot(b.x - g.x, b.z - g.z) < 1.6 && b.y - g.y < 2.6;
      if (!near) w = p.kind === "swing" ? 0 : p.kind === "run" ? (a.helmet ? 0.3 : 0.9) : p.bat && p.bat.on ? 0.7 : 0.85;
    }
    rig.setLook(w > 0 ? ball.position : null, w, life);
  }
  const handPos = (a, side) => {
    const b = a.pl.human ? a.pl.bones["hand_" + side.toLowerCase()] : a.pl.bones["hand." + side];
    const v = new T.Vector3();
    b.getWorldPosition(v);
    return [v.x, -v.z, v.y];
  };

  function endFrame() {
    for (const a of actors.values()) if (a.used !== tick) a.pl.group.visible = false;
    if (actors.size > MAX_ACTORS) {
      const old = [...actors.values()].filter((a) => a.used !== tick).sort((p, q) => p.used - q.used);
      for (const a of old.slice(0, actors.size - MAX_ACTORS)) {
        scene.remove(a.pl.group);
        a.pl.dispose();
        actors.delete(a.key);
      }
    }
  }
  V3.clearActors = function () {
    for (const a of actors.values()) {
      scene.remove(a.pl.group);
      a.pl.dispose();
    }
    actors.clear();
  };

  /* ---------- ポーズの組み立て ---------- */
  const mir = (p, left) => (left ? A.mirror(p) : p);
  const pitchClipCache = A.pitchClip();
  const throwClipCache = A.throwClip();
  const swingCache = {};
  function swingClip(cz, pull) {
    const k = Math.round(cz * 20) + ":" + Math.round(pull * 10);
    if (!swingCache[k]) swingCache[k] = A.swingClip(cz, pull);
    return swingCache[k];
  }
  // 野手の構え (投球前は少し力を抜く)
  function idlePose(set, t, seed) {
    if (set) return A.LIB.ready;
    const p = A.P(A.LIB.stand);
    p.spine[0] = 4 + Math.sin(t * 0.7 + seed) * 2;
    p.head[1] = Math.sin(t * 0.4 + seed * 3) * 12;
    return p;
  }
  // 走りの位相を移動距離から進める
  function runPose(a, x, y, dt, speed) {
    const m = a.mem;
    if (m.rx != null) m.ph = (m.ph || 0) + (Math.hypot(x - m.rx, y - m.ry) / 3.3) * TAU;
    m.rx = x;
    m.ry = y;
    return A.run(m.ph || 0, speed);
  }

  /* ---------- 試合の描画 ---------- */
  const HOME_POS = { P: [0, 18.44], C: [0, -1.1], "1B": [19.5, 25.5], "2B": [9.5, 42.5], SS: [-10.5, 42.0], "3B": [-19.5, 25.0], LF: [-42, 80], CF: [0, 95], RF: [42, 80] };
  const ab2xy = (a, b) => [(a - b) * Math.SQRT1_2, (a + b) * Math.SQRT1_2];
  const UMP = { "1B": ab2xy(30.5, -3.2), "2B": [-4.5, 47], "3B": ab2xy(-3.2, 30.5) };
  const COACH = { 1: ab2xy(25, -6.1), 3: ab2xy(-6.1, 25) };

  V3.renderMatch = function (m, rc, dt, blend) {
    if (!V3.ok || V3.lost) return false;
    tick++;
    created = 0;
    const R = PB.R;
    const g = m.g;
    const st = ensureStadium(g.teams.home, g.teams.away, R.night);
    const play = m.play;
    const fs = g.fieldingSide();
    const bs = g.battingSide();
    const fT = g.teams[fs];
    const bT = g.teams[bs];
    const fHome = fs === "home";
    const now = m.time;
    const state = m.state;
    const fieldView = blend > 0.5;
    const pit = g.pitcher();
    const bat = g.batter();
    const def = g.defense();
    const budget = 3;
    syncCam(cam, rc);
    let layerUsed = false;
    let layerBx = 0;
    fadeBatFx(blend);

    /* --- 守備側 --- */
    const pitching = state === "windup" || state === "pitch";
    if (play) {
      for (const f of play.fielders) {
        const isC = f.pos === "C";
        const a = getActor(fT.id + ":" + f.p.id + (isC ? ":C" : ""), () => makeSpec(f.p, fT, fHome, isC ? { role: "catcher", pos: "C" } : {}), budget);
        if (!a) continue;
        gear(a, { helmet: false, bat: false, glove: true });
        fielderInPlay(a, f, play, dt, st);
      }
    } else {
      for (const pos of D.FIELD_POS) {
        const p = def[pos];
        if (!p) continue;
        if (pos === "C" && !fieldView) continue;
        const isC = pos === "C";
        const a = getActor(fT.id + ":" + p.id + (isC ? ":C" : ""), () => makeSpec(p, fT, fHome, isC ? { role: "catcher", pos: "C" } : {}), budget);
        if (!a) continue;
        gear(a, { helmet: false, bat: false, glove: true });
        a.mem = a.mem || {};
        if (pos === "P") {
          pitcherPose(a, m, p, dt, st);
          continue;
        }
        if (isC) {
          const q = A.P(A.LIB.crouch);
          if (m.pc && (state === "pitch" || state === "call")) {
            const k = Math.min(1, (m.pT || 0) / Math.max(0.2, m.pc.T));
            q.armL.t = [U.lerp(0.12, -m.pc.A[0] * 0.9, k), U.lerp(0.85, m.pc.A[1] + 0.05, k), U.lerp(0.42, 0.55, k)];
          }
          pose(a, 0, -1.1, 0, Math.PI, mir(q, p.throws === "L"), dt);
          continue;
        }
        let h = HOME_POS[pos];
        const align = g.align(null);
        if (align.holdRunner && pos === "1B") h = [17.6, 21.0];
        if (align.infieldIn && (pos === "2B" || pos === "SS")) h = [pos === "2B" ? 7.5 : -7.5, 33];
        if (align.infieldIn && (pos === "1B" || pos === "3B")) h = [pos === "1B" ? 17.5 : -17.5, 22];
        pose(a, h[0], h[1], 0, yawOf(-h[0] * 0.8, -h[1] + 6), idlePose(pitching, now, (hashStr(pos) % 100) / 10), dt, { rate: 6 });
      }
    }

    /* --- 審判 --- */
    if (fieldView || play) {
      const pu = getActor("ump:PU", umpireSpec, budget);
      if (pu) {
        gear(pu, { glove: false });
        const strike = state === "call" && m.jr && m.jr.call === "strike";
        pose(pu, 0, -2.05, 0, Math.PI, strike ? A.LIB.umpireStrike : play ? A.LIB.stand : A.LIB.umpire, dt, { rate: 8 });
      }
      if (V3.quality !== "low") {
        for (const k of ["1B", "2B", "3B"]) {
          const u = getActor("ump:" + k, umpireSpec, budget);
          if (!u) continue;
          gear(u, { glove: false });
          const [x, y] = UMP[k];
          let fx = -x;
          let fy = -y + 10;
          if (play && play.ball && play.ball.x != null) {
            fx = play.ball.x - x;
            fy = play.ball.y - y;
          }
          pose(u, x, y, 0, yawOf(fx, fy), play ? A.LIB.stand : A.LIB.ready, dt, { rate: 6, turn: 5 });
        }
      }
    }

    /* --- 攻撃側: 打者 --- */
    const side = P.batSide(bat, pit);
    const left = side === "L";
    if (!play || (play && blend < 0.5)) {
      const a = getActor(bT.id + ":" + bat.id, () => makeSpec(bat, bT, !fHome, { helmet: true }), budget);
      if (a) {
        gear(a, { helmet: true, bat: true, glove: false, bats: side });
        a.pl.setBattingGloves(true);
        const q = batterPose(a, m, side);
        if (!fieldView) {
          // 打席視点: 別カメラで画面の横に大きく描く
          const z = R.zoneRect(rc);
          const zh = z.y1 - z.y0;
          const zw = z.x1 - z.x0;
          const kz = zh / (P.ZONE.hi - P.ZONE.lo);
          // 打者はゾーンの横に、ゾーンより少し小さい縮尺で置く (縦画面でも全身が入る)
          const k = kz * 0.42;
          const sx = left ? z.x1 + 0.3 * k : z.x0 - 0.3 * k;
          const sy = (z.y0 + z.y1) / 2 + 0.95 * k;
          const bx = left ? 0.85 : -0.85;
          pose(a, bx, 0.0, 0, left ? -Math.PI / 2 : Math.PI / 2, q, dt, { layer: 1, rate: 22, turn: 30 });
          syncLayerCam(rc, [bx, 0, 0], sx, sy, k);
          layerShadow.position.set(bx, 0.01, 0);
          layerShadow.visible = true;
          // 影の地図があれば本当の影を落とし、ぼかしは足元の接地感だけにする
          const realShadow = renderer.shadowMap.enabled;
          batShadow.visible = realShadow;
          batShadow.position.set(bx, 0.005, 0);
          layerShadow.material.opacity = realShadow ? 0.6 : 1;
          layerBx = bx;
          layerUsed = true;
        } else {
          pose(a, left ? 0.85 : -0.85, 0.0, 0, left ? -Math.PI / 2 : Math.PI / 2, q, dt, { rate: 22, turn: 30 });
        }
      }
    }
    if (!layerUsed) layerShadow.visible = batShadow.visible = false;

    /* --- 走者 --- */
    if (play) {
      for (const r of play.runners) {
        if (r.isBatter && blend < 0.5) continue;
        const a = getActor(bT.id + ":" + r.p.id, () => makeSpec(r.p, bT, !fHome, { helmet: true }), budget);
        if (!a) continue;
        gear(a, { helmet: true, bat: false, glove: false });
        runnerInPlay(a, r, play, dt, m);
      }
    } else {
      for (let b = 1; b <= 3; b++) {
        const r = g.bases[b];
        if (!r) continue;
        const a = getActor(bT.id + ":" + r.id, () => makeSpec(r, bT, !fHome, { helmet: true }), budget);
        if (!a) continue;
        gear(a, { helmet: true, bat: false, glove: false });
        let off = pitching ? 2.8 : 1.8;
        const stealing = m.steal && m.steal[b] && (state === "pitch" || state === "call" || (state === "windup" && m.t > 0.3));
        if (stealing) off = 3.5 + Math.min(14, Math.max(0, state === "windup" ? (m.t - 0.3) * 6 : 3.4 + (m.pT || 0) * 7.5));
        const a0 = F.BASES[b];
        const n1 = F.BASES[Math.min(4, b + 1)];
        const L = Math.hypot(n1[0] - a0[0], n1[1] - a0[1]);
        const x = a0[0] + ((n1[0] - a0[0]) / L) * off;
        const y = a0[1] + ((n1[1] - a0[1]) / L) * off;
        if (stealing) pose(a, x, y, 0, yawOf(n1[0] - a0[0], n1[1] - a0[1]), runPose(a, x, y, dt, 1), dt, { rate: 20 });
        else {
          a.mem.rx = null;
          pose(a, x, y, 0, yawOf(-x, 18.44 - y), A.LIB.lead, dt, { rate: 6, turn: 6 });
        }
      }
    }

    /* --- ベースコーチ・ネクストバッター --- */
    if (V3.quality !== "low" && (fieldView || play)) {
      const bench = (bT.players || []).filter((p) => p.pos !== "P" && !g.order[bs].some((e) => e.id === p.id));
      const coaches = bench.slice(-2);
      [1, 3].forEach((b, i) => {
        const p = coaches[i];
        if (!p) return;
        const a = getActor(bT.id + ":coach" + b, () => makeSpec(p, bT, !fHome, { helmet: true, num: 70 + b + (hashStr(bT.id) % 8) }), budget);
        if (!a) return;
        gear(a, { helmet: true, bat: false, glove: false });
        const [x, y] = COACH[b];
        const wave = play && b === 3 && play.runners.some((r) => r.state === "run" && r.from === 2);
        const q = wave ? A.P(A.LIB.cheer) : A.LIB.stand;
        if (wave) {
          q.armR.t[0] += Math.sin(now * 12) * 0.25;
        }
        pose(a, x, y, 0, yawOf(-x * 0.3 + 4, -y + 18), q, dt, { rate: 8 });
      });
      const od = g.onDeck(1);
      if (od && !play) {
        const a = getActor(bT.id + ":" + od.id, () => makeSpec(od, bT, !fHome, { helmet: true }), budget);
        if (a) {
          gear(a, { helmet: true, bat: true, glove: false, bats: P.batSide(od, pit) });
          const ox = fHome ? -11.5 : 11.5;
          const sl = P.batSide(od, pit) === "L";
          pose(a, ox, -6.5, 0, sl ? -Math.PI / 2 : Math.PI / 2, mir(A.batIdle(now * 0.8 + 1), sl), dt, { rate: 6 });
        }
      }
    }

    /* --- ボール --- */
    hideBall();
    if (play) {
      const b = play.ball;
      const hrGone = play.pred && play.pred.info.hr && b.mode === "live" && play.t > play.pred.samples[play.pred.samples.length - 1].t;
      if (b && b.x != null && !hrGone) {
        if (b.mode === "held" && b.holder) {
          const ha = actors.get(fT.id + ":" + b.holder.p.id + (b.holder.pos === "C" ? ":C" : ""));
          if (ha && ha.pl.group.visible) {
            const glove = b.holder.p.throws === "L" ? "R" : "L";
            const throwing = ha.mem.throwing;
            const hp = handPos(ha, throwing ? (glove === "L" ? "R" : "L") : glove);
            placeBall(hp[0], hp[1], hp[2], fieldView ? 4 : 2, 0, dt);
          } else placeBall(b.x, b.y, Math.max(0, b.z || 0), fieldView ? 4 : 2, 0, dt);
        } else placeBall(b.x, b.y, Math.max(0, b.z || 0), fieldView ? 4.5 : 2.2, 40, dt);
      }
    } else if (m.foulBall) {
      placeBall(m.foulBall.x, m.foulBall.y, Math.max(0, m.foulBall.z), 2.5, 40, dt);
    } else if (state === "windup") {
      const pa = actors.get(fT.id + ":" + pit.id);
      if (pa && pa.pl.group.visible && m.t > 0.05) {
        const hp = handPos(pa, pit.throws === "L" ? "L" : "R");
        placeBall(hp[0], hp[1], hp[2], 2, 0, dt);
      }
    } else if ((state === "pitch" || state === "call") && m.pc && m.pendingCall !== "derby") {
      const pT = Math.min(m.pT || 0, m.pc.T + 0.025);
      if (!(state === "call" && (m.pT || 0) > m.pc.T + 0.35)) {
        const p = P.pos(m.pc, pT);
        placeBall(p[0], p[1], p[2], 2.4, 30, dt);
      }
    }

    /* --- スコアボード・観客 --- */
    updateBoard(m, st);
    const hot = play && (play.hr || (play.scored && play.scored.length)) ? 1 : 0;
    const homeBat = bs === "home";
    st.setExcite(0.08 + hot * 0.4, homeBat ? 0.3 + hot * 0.7 : 0.06, homeBat ? 0.06 : 0.3 + hot * 0.7);
    st.update(dt);

    endFrame();
    // 影の範囲: 守備視点は見えている地面と選手のいる所の重なり、打席視点は投手のまわり
    if (fieldView) fitShadowToView(st);
    else st.fitShadow(-9, 9, 7, 27, 2.6);
    draw(layerUsed, layerBx);
    return true;
  };

  // 打った瞬間の火花 (2D の R.burst) は打席カメラの画面に貼り付いているので、守備視点へ動き出したら消す
  // (残すと守備視点の芝の上に黄色い四角が散らばって見える)
  function fadeBatFx(blend) {
    const fx = PB.R && PB.R.fx;
    if (!fx || !fx.length) return;
    for (const p of fx) {
      // 打席視点で生まれた粒 (と、打球の火花の色の粒) に印を付ける。花火は残す
      if (p.v3 == null) p.v3 = blend <= 0.2 || p.c === "#fff3b0" ? 1 : 0;
      if (p.v3 === 1 && blend > 0.3) {
        p.life = Math.min(p.life, p.t + 0.1);
        p.v3 = 2;
      }
    }
  }

  // 影の範囲を、画面に写っている地面 (視錐台の光線と地面の交点) と選手のいる範囲の重なりに合わせる
  const _ray = new T.Vector3();
  function fitShadowToView(st) {
    const o = cam.position;
    let x0 = 1e9;
    let x1 = -1e9;
    let y0 = 1e9;
    let y1 = -1e9;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        _ray.set((i / 3) * 2 - 1, (j / 3) * 2 - 1, 0.5).unproject(cam).sub(o);
        let gx;
        let gy;
        if (_ray.y < -1e-3 && -o.y / _ray.y < 600) {
          const t = -o.y / _ray.y;
          gx = o.x + _ray.x * t;
          gy = -(o.z + _ray.z * t);
        } else {
          // 地面に当たらない (空を向く) 光線は遠くで止める
          const l = Math.hypot(_ray.x, _ray.z) || 1;
          gx = o.x + (_ray.x / l) * 600;
          gy = -(o.z + (_ray.z / l) * 600);
        }
        if (gx < x0) x0 = gx;
        if (gx > x1) x1 = gx;
        if (gy < y0) y0 = gy;
        if (gy > y1) y1 = gy;
      }
    let a0 = 1e9;
    let a1 = -1e9;
    let b0 = 1e9;
    let b1 = -1e9;
    for (const a of actors.values()) {
      if (a.used !== tick || !a.pl.group.visible || a.layer !== 0) continue;
      const p = a.pl.group.position;
      if (p.x < a0) a0 = p.x;
      if (p.x > a1) a1 = p.x;
      if (-p.z < b0) b0 = -p.z;
      if (-p.z > b1) b1 = -p.z;
    }
    if (a0 > a1) {
      a0 = -20;
      a1 = 20;
      b0 = 0;
      b1 = 40;
    }
    const m = 3;
    let fx0 = Math.max(x0, a0 - m, -112);
    let fx1 = Math.min(x1, a1 + m, 112);
    let fy0 = Math.max(y0, b0 - m, -30);
    let fy1 = Math.min(y1, b1 + m, 135);
    if (fx0 >= fx1 || fy0 >= fy1) {
      fx0 = a0 - m;
      fx1 = a1 + m;
      fy0 = b0 - m;
      fy1 = b1 + m;
    }
    st.fitShadow(fx0, fx1, fy0, fy1, 2.4);
  }

  function draw(layerUsed, layerBx) {
    drsTick();
    renderer.info.reset();
    renderer.autoClear = true;
    cam.layers.set(0);
    const usePost = !!post && post.begin();
    renderer.render(scene, cam);
    if (layerUsed) {
      // 打者だけの 2 回目: 影の範囲を打者のまわりに絞る (影の地図はこの描画で打者だけから作り直される)
      if (stadium) stadium.focusShadow(layerBx || 0, 0, 2.6);
      renderer.autoClear = false;
      if (usePost) post.clearDepth();
      else renderer.clearDepth();
      renderer.render(scene, layerCam);
      renderer.autoClear = true;
    }
    if (usePost) post.end(stadium && stadium.post);
  }

  /* 投手 (試合の打席前・投球中) */
  function pitcherPose(a, m, p, dt, st) {
    const left = p.throws === "L";
    const z = st.moundHeight ? st.moundHeight(0, 18.44) : 0.25;
    const state = m.state;
    let q;
    let yaw;
    if (state === "windup" || state === "pitch" || state === "call") {
      const ct = state === "windup" ? m.t : A.PITCH_RELEASE + (m.pT || 0);
      q = mir(A.sample(pitchClipCache, Math.min(ct, 1.5)), left);
      yaw = left ? yawX(0, 1) : yawX(0, -1);
      if (left) yaw = Math.atan2(-1, 0) + Math.PI;
      pose(a, 0, 18.44, z, left ? Math.PI / 2 : -Math.PI / 2, q, dt, { rate: 40, turn: 40 });
      return;
    }
    // サインを見る
    q = A.P(A.LIB.stand);
    q.spine[0] = 10;
    q.head[0] = 6;
    q.armL.t = [0.16, 1.0, 0.18];
    q.armR.t = [-0.12, 1.0, 0.14];
    void yaw;
    pose(a, 0, 18.44, z, 0, mir(q, left), dt, { rate: 6, turn: 6 });
  }

  /* 打者 */
  function batterPose(a, m, side) {
    const left = side === "L";
    const g = m.g;
    const userBat = m.userBat();
    const buntStance = (userBat && m.bunt) || (!userBat && g.paBunt && (m.state === "windup" || m.state === "pitch"));
    let q;
    if (m.swingT != null && !(m.swUsed && m.swUsed.bunt) && !(m.sw && m.sw.bunt)) {
      const cz = m.sw && m.sw.cz != null ? m.sw.cz : m.pc ? m.pc.A[1] : 0.8;
      const cx = m.sw && m.sw.cx != null ? m.sw.cx : 0;
      // 外角 (打者から遠い) ほど流し打ち気味のスイング
      const away = left ? -cx : cx;
      const pull = U.clamp(-away * 1.6, -0.6, 0.6);
      q = A.sample(swingClip(U.clamp(cz, 0.35, 1.25), pull), m.swingT);
    } else if (buntStance) {
      q = A.LIB.bunt;
    } else if (m.state === "windup" && m.t > 0.45) {
      // 投球に合わせて足を上げる
      const k = U.clamp((m.t - 0.45) / 0.35, 0, 1);
      q = A.lerpPose(A.batIdle(m.time), A.LIB.batLoad, k);
    } else if (m.state === "pitch") {
      q = A.lerpPose(A.LIB.batLoad, A.LIB.batStance, U.clamp((m.pT || 0) / 0.3, 0, 1));
    } else q = A.batIdle(m.time);
    return mir(q, left);
  }

  /* 守備中の野手 */
  function fielderInPlay(a, f, play, dt, st) {
    const t = play.t;
    const mem = a.mem;
    const left = f.p.throws === "L";
    const glove = left ? "R" : "L";
    const moving = Math.hypot(f.vx, f.vy) > 0.3;
    let x = f.x;
    let y = f.y;
    let z = 0;
    let q;
    let yaw;
    let rate = 14;
    mem.throwing = false;
    const act = f.act && t - f.act.t < (f.act.k === "dive" ? 1.1 : 0.6) ? f.act : null;
    const b = play.ball;
    if (f.pos === "P" && t < 0.7 && !moving && !act) {
      // フォロースルーの続き
      q = mir(A.sample(pitchClipCache, Math.min(1.5, A.PITCH_RELEASE + 0.4 + t)), left);
      yaw = left ? Math.PI / 2 : -Math.PI / 2;
      x = 0;
      y = 18.44;
      z = st.moundHeight ? st.moundHeight(0, 18.44) : 0.25;
      pose(a, x, y, z, yaw, q, dt, { rate: 30, turn: 30 });
      return;
    }
    if (f.pos === "C" && !moving && !f.hasBall && !act && t < 0.8) {
      pose(a, x, y, 0, Math.PI, mir(A.LIB.crouch, left), dt, { rate: 10 });
      return;
    }
    if (act && act.k === "throw") {
      const tx = b && b.mode === "thrown" ? b.tx : f.x;
      const ty = b && b.mode === "thrown" ? b.ty : f.y + 1;
      mem.tdir = [tx - f.x, ty - f.y];
      q = mir(A.sample(throwClipCache, A.THROW_RELEASE + (t - act.t)), left);
      yaw = left ? yawX(-mem.tdir[0], -mem.tdir[1]) : yawX(mem.tdir[0], mem.tdir[1]);
      rate = 30;
      pose(a, x, y, z, yaw, q, dt, { rate, turn: 30 });
      return;
    }
    if (act && act.k === "dive") {
      const dv = mem.diveDir || [f.vx || 1, f.vy || 0];
      if (t - act.t < 0.05 || !mem.diveDir) mem.diveDir = [b && b.x != null ? b.x - f.x : 1, b && b.y != null ? b.y - f.y : 0];
      q = A.LIB.dive;
      yaw = yawOf(dv[0], dv[1]);
      pose(a, x, y, 0, yaw, q, dt, { rate: 12, turn: 20 });
      return;
    }
    mem.diveDir = null;
    if (f.down && t < f.down) {
      q = A.P(A.LIB.dive);
      q.root[1] = -0.75;
      pose(a, x, y, 0, a.yaw, q, dt, { rate: 6 });
      return;
    }
    if (act && act.k === "catch") {
      if (mem.catchAt !== act.t) {
        mem.catchAt = act.t;
        mem.catchZ = b && b.z != null ? b.z : 1;
      }
      const cz = mem.catchZ;
      const gp = [glove === "L" ? 0.18 : -0.18, U.clamp(cz, 0.15, 2.1), 0.45];
      q = A.catchPose(gp, glove, cz < 0.7);
      const bx = b && b.x != null ? b.x : 0;
      const by = b && b.y != null ? b.y : 0;
      yaw = Math.hypot(bx - f.x, by - f.y) > 0.5 ? yawOf(bx - f.x, by - f.y) : a.yaw;
      pose(a, x, y, 0, yaw, q, dt, { rate: 18, turn: 12 });
      return;
    }
    if (moving) {
      const sp = Math.hypot(f.vx, f.vy);
      q = runPose(a, x, y, dt, U.clamp(sp / 7, 0.3, 1));
      // ボールが近づいたらグラブを出す
      if (b && b.mode === "live" && f.task === "chase") {
        const d = Math.hypot((b.x || 0) - f.x, (b.y || 0) - f.y);
        if (d < 4) {
          const arm = glove === "L" ? "armL" : "armR";
          q[arm].t = [glove === "L" ? 0.2 : -0.2, U.clamp(b.z || 0.3, 0.25, 2.0), 0.4];
          q[arm].h = [-60, 0, 0];
        }
      }
      yaw = yawOf(f.vx, f.vy);
      pose(a, x, y, 0, yaw, q, dt, { rate: 20, turn: 9 });
      return;
    }
    mem.rx = null;
    // 止まっている: ボールを持っていれば送球の構え、なければボールを見る
    const bx = b && b.x != null ? b.x : 0;
    const by = b && b.y != null ? b.y : 0;
    if (f.hasBall) {
      mem.throwing = true;
      q = mir(A.sample(throwClipCache, Math.min(A.THROW_RELEASE * 0.5, Math.max(0, A.THROW_RELEASE - (f.holdT || 0)))), left);
      const d = mem.tdir || [-f.x, -f.y];
      yaw = left ? yawX(-d[0], -d[1]) : yawX(d[0], d[1]);
      pose(a, x, y, 0, yaw, q, dt, { rate: 14, turn: 8 });
      return;
    }
    q = f.task === "cover" ? A.LIB.ready : A.P(A.LIB.ready);
    yaw = Math.hypot(bx - f.x, by - f.y) > 0.5 ? yawOf(bx - f.x, by - f.y) : a.yaw;
    pose(a, x, y, 0, yaw, q, dt, { rate: 8, turn: 6 });
  }

  /* 走者 */
  function runnerInPlay(a, r, play, dt, m) {
    const t = play.t;
    const mem = a.mem;
    if (r.state === "scored") {
      const since = t - (r.scoredAt || 0);
      if (since > 2.2) {
        a.pl.group.visible = false;
        return;
      }
      // 本塁を駆け抜けてベンチへ
      const dir = m.g.battingSide() === "home" ? 1 : -1;
      const x = dir * Math.min(10, since * 4.5);
      const y = -Math.min(3, since * 1.5);
      pose(a, x, y, 0, yawOf(dir, -0.4), since < 0.6 ? A.LIB.cheer : runPose(a, x, y, dt, 0.5), dt, { rate: 10 });
      return;
    }
    if (r.state === "out") {
      if (mem.outAt == null) mem.outAt = t;
      if (t - mem.outAt > 1.6) {
        a.pl.group.visible = false;
        return;
      }
      pose(a, r.x, r.y, 0, a.yaw, A.LIB.stand, dt, { rate: 6 });
      return;
    }
    mem.outAt = null;
    const from = Math.min(r.from, 4);
    const nb = Math.min(r.from + 1, 4);
    const A0 = F.BASES[from];
    const B0 = F.BASES[nb];
    const moving = (r.state === "run" || r.state === "return") && !(r.wait > 0);
    if (moving) {
      const s = r.state === "return" ? -1 : 1;
      const dx = (B0[0] - A0[0]) * s;
      const dy = (B0[1] - A0[1]) * s;
      // 次の塁が近く、送球が来ていればスライディング
      const left = 27.431 - r.d;
      const b = play.ball;
      const contested = (b && b.mode === "thrown" && b.base === nb) || r.stealing;
      if (r.state === "run" && left < 2.6 && contested) {
        pose(a, r.x, r.y, 0, yawOf(dx, dy), A.LIB.slide, dt, { rate: 16 });
        mem.slid = t;
        return;
      }
      pose(a, r.x, r.y, 0, yawOf(dx, dy), runPose(a, r.x, r.y, dt, 1), dt, { rate: 20, turn: 14 });
      return;
    }
    mem.rx = null;
    if (mem.slid != null && t - mem.slid < 0.45) {
      pose(a, r.x, r.y, 0, a.yaw, A.LIB.slide, dt, { rate: 8 });
      return;
    }
    // 塁上: 打球を見る
    const b = play.ball;
    const bx = b && b.x != null ? b.x : 0;
    const by = b && b.y != null ? b.y : 30;
    pose(a, r.x, r.y, 0, yawOf(bx - r.x, by - r.y), r.from > 0 ? A.LIB.lead : A.LIB.stand, dt, { rate: 8, turn: 6 });
  }

  /* スコアボードに渡す情報 */
  function updateBoard(m, st) {
    const g = m.g;
    const team = (side) => {
      const t = g.teams[side];
      return {
        short: t.short,
        R: g.score[side],
        H: g.hits ? g.hits[side] : 0,
        E: g.errors ? g.errors[side] : 0,
        lineup: (g.order[side] || []).map((e) => {
          const p = g.P(e.id);
          return { pos: posK(e.pos), name: p ? p.name : "" };
        }),
      };
    };
    const bat = g.batter();
    const pit = g.pitcher();
    const bsx = g.stat ? g.stat(bat.id) : {};
    const psx = g.stat ? g.stat(pit.id) : {};
    const info = {
      inning: g.inning,
      top: g.top,
      b: g.balls,
      s: g.strikes,
      o: g.outs,
      line: g.line,
      innings: g.line ? g.line.away : [],
      away: team("away"),
      home: team("home"),
      batSide: g.battingSide(),
      batIdx: g.bi[g.battingSide()],
      batter: bat.name + (bat.given ? " " + bat.given : ""),
      batLine: "今日 " + (bsx.ab || 0) + "打数" + (bsx.h || 0) + "安打" + (bsx.hr ? " " + bsx.hr + "本" : ""),
      pitcher: pit.name + (pit.given ? " " + pit.given : ""),
      pitLine: "投球数 " + (psx.np || 0),
      speed: m.lastPitch && m.state !== "windup" ? m.lastPitch.speedKmh : m.pc && m.state !== "windup" ? m.pc.speedKmh : null,
      pitch: m.lastPitch && m.state !== "windup" ? m.lastPitch.name : null,
      msg: m.play && m.play.hr ? "HOME RUN!!" : null,
    };
    st.board.draw(info);
  }
  const POSK = { P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三", SS: "遊", LF: "左", CF: "中", RF: "右", DH: "指" };
  const posK = (p) => POSK[p] || p || "";

  /* ---------- タイトル画面の背景 ---------- */
  const title = { t: 0 };
  V3.renderTitle = function (dt, teams, night) {
    if (!V3.ok || V3.lost) return false;
    tick++;
    created = 0;
    const home = teams && teams[0];
    const away = teams && teams[1];
    const st = ensureStadium(home, away, night);
    title.t += dt;
    const t = title.t;
    // ゆっくり回るカメラ
    const ang = -0.6 + Math.sin(t * 0.05) * 0.55;
    const r = 70;
    const cx = Math.sin(ang) * r;
    const cy = 28 - Math.cos(ang) * r;
    // スタンドの上を通るときは観客 (と張り出した上段) より上に保つ
    const cz = Math.max(22 + Math.sin(t * 0.07) * 4, st.standTop ? st.standTop(cx, cy) + 2.5 : 0);
    const rc = new PB.R.Cam().set([cx, cy, cz], [0, 26, 1.5], (H * 0.5) / Math.tan(0.42), W / 2, H * 0.46);
    syncCam(cam, rc);
    // 投球練習とキャッチボール
    if (home && home.players) {
      const ps = home.players;
      const pit = ps.find((p) => p.pos === "P") || ps[0];
      const cat = ps.find((p) => p.pos === "C") || ps[1];
      const bt = (away && away.players ? away.players : ps).find((p) => p.pos !== "P") || ps[2];
      const cyc = t % 2.6;
      const a = getActor(home.id + ":" + pit.id, () => makeSpec(pit, home, true), 2);
      if (a) {
        gear(a, { helmet: false, bat: false, glove: true });
        pose(a, 0, 18.44, 0.25, pit.throws === "L" ? Math.PI / 2 : -Math.PI / 2, mir(A.sample(pitchClipCache, Math.min(1.5, cyc * 0.9)), pit.throws === "L"), dt, { rate: 40, turn: 40 });
      }
      const c = getActor(home.id + ":" + cat.id + ":C", () => makeSpec(cat, home, true, { role: "catcher", pos: "C" }), 2);
      if (c) pose(c, 0, -1.1, 0, Math.PI, A.LIB.crouch, dt);
      const b = away ? getActor(away.id + ":" + bt.id, () => makeSpec(bt, away, false, { helmet: true }), 2) : null;
      if (b) {
        gear(b, { helmet: true, bat: true, glove: false, bats: bt.bats === "L" ? "L" : "R" });
        const sw = cyc > 0.86 && cyc < 1.6 ? A.sample(swingClip(0.8, 0), cyc - 0.82) : A.batIdle(t);
        const sl = bt.bats === "L";
        pose(b, sl ? 0.85 : -0.85, 0, 0, sl ? -Math.PI / 2 : Math.PI / 2, mir(sw, sl), dt, { rate: 22, turn: 30 });
      }
      // 外野でキャッチボール
      const pair = ps.filter((p) => p.pos !== "P" && p.pos !== "C").slice(0, 2);
      pair.forEach((p, i) => {
        const fa = getActor(home.id + ":" + p.id, () => makeSpec(p, home, true), 2);
        if (!fa) return;
        gear(fa, { helmet: false, bat: false, glove: true });
        const x = i ? -14 : -30;
        const y = 70 + i * 6;
        const tx = i ? -30 - x : -14 - x;
        const ty = i ? 70 - y : 76 - y;
        const ph = (t + i * 1.6) % 3.2;
        const q = ph < 0.6 ? A.sample(throwClipCache, ph) : ph > 1.6 && ph < 2.2 ? A.catchPose([0.2, 1.3, 0.45], "L") : A.LIB.ready;
        pose(fa, x, y, 0, ph < 0.6 ? yawX(tx, ty) : yawOf(tx, ty), mir(q, p.throws === "L"), dt, { rate: 12, turn: 8 });
      });
    }
    hideBall();
    layerShadow.visible = batShadow.visible = false;
    st.setExcite(0.1, 0.25, 0.25);
    st.update(dt);
    st.board.draw({ msg: "熱闘！ポケットベースボール", home: { short: home ? home.short : "" }, away: { short: away ? away.short : "" } });
    endFrame();
    fitShadowToView(st);
    draw(false);
    return true;
  };

  // 画面サイズのチェック用
  V3._actors = actors;
  // 1 フレーム分の合計 (影の地図・打者レイヤー・仕上げ処理を含む)
  V3.info = () => ({
    actors: actors.size,
    calls: renderer ? renderer.info.render.calls : 0,
    tris: renderer ? renderer.info.render.triangles : 0,
    post: post ? (post.hdr ? "hdr" : "ldr") + " msaa" + post.samples : "off",
    env: !!scene.environment,
    quality: V3.quality,
    // 実際の描画解像度 (ピクセル比) と自動調整の縮尺・1 フレームの間隔 (ms)
    pr: renderer ? Math.round(prCap() * (DRS.on ? DRS.scale : 1) * 100) / 100 : 0,
    scale: DRS.on ? DRS.scale : 1,
    ft: Math.round(DRS.ema * 10) / 10,
  });
})((window.PB = window.PB || {}));
