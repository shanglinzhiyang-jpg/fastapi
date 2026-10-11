/* 熱闘！ポケットベースボール — 起動とメインループ */
(function (PB) {
  "use strict";
  const R = PB.R;
  const A = PB.Audio;
  const UI = PB.UI;
  const Store = PB.Store;

  const M = {};
  M.match = null;
  let last = 0;

  M.applySettings = function () {
    const S = Store.settings();
    A.enabled = S.sound;
    A.voice = S.voice;
    A.bgm = S.bgm;
  };

  /* ---------- 画質 (3D 描画) ---------- */
  // 「自動」の判定結果は端末ごとに覚える (セーブはサーバー経由で別の端末と共有するので、そこには入れない)
  const GFX_KEY = "pocket_baseball_gfx";
  const GFX_VER = 1;
  M.GFX_LEVELS = ["2d", "low", "mid", "high"];
  function readAuto() {
    try {
      const a = JSON.parse(window.localStorage.getItem(GFX_KEY) || "null");
      if (a && a.v === GFX_VER && M.GFX_LEVELS.indexOf(a.lvl) >= 0) return a;
    } catch (e) {
      /* ストレージ無効 */
    }
    return null;
  }
  function writeAuto(a) {
    try {
      window.localStorage.setItem(GFX_KEY, JSON.stringify(a));
    } catch (e) {
      /* 保存できなくても毎回判定するだけ */
    }
  }
  // GPU の名前 (WEBGL_debug_renderer_info) からおおまかな画質を決める。分からなければ中
  M.classifyGpu = function (name, webgl2) {
    const g = String(name || "").toLowerCase();
    // WebGL1 では仕上げ処理も環境マップも使えない
    if (!webgl2) return "low";
    // ソフトウェア描画 (テスト環境など) は GPU の速さが分からないので中
    if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(g)) return "mid";
    let m = g.match(/adreno[^0-9]*(\d{3})/);
    if (m) {
      const n = Number(m[1]);
      return n >= 730 ? "high" : n >= 630 ? "mid" : "low";
    }
    if (/immortalis|xclipse/.test(g)) return "high";
    m = g.match(/mali-?g(\d+)/);
    if (m) {
      const n = Number(m[1]);
      return n >= 700 ? "high" : n >= 600 || (n >= 76 && n < 100) ? "mid" : "low";
    }
    if (/mali|powervr|vivante|videocore|tegra/.test(g)) return "low";
    if (/apple m\d|nvidia|geforce|quadro|radeon|amd|intel.*arc/.test(g)) return "high";
    // iPhone の Safari は "Apple GPU" としか出さない (A12 以降なら中で動く)
    return "mid";
  };
  function probeGpu() {
    let gl = null;
    let webgl2 = false;
    let gpu = "";
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      gl = c.getContext("webgl2");
      webgl2 = !!gl;
      if (!gl) gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) return { lvl: "2d", gpu: "" };
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
    } catch (e) {
      return { lvl: "low", gpu: "" };
    } finally {
      // 調べるためだけのコンテキストはすぐ手放す
      try {
        const lose = gl && gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      } catch (e) {
        /* 無視 */
      }
    }
    let lvl = M.classifyGpu(gpu, webgl2);
    // メモリの少ない端末は一段下げる (Android の Chrome だけが教えてくれる)
    const mem = navigator.deviceMemory;
    if (mem && mem <= 2) lvl = "low";
    else if (mem && mem <= 4 && lvl === "high") lvl = "mid";
    return { lvl, gpu };
  }
  // 「自動」のときの画質 (初回だけ GPU を調べる)
  M.autoGfx = function () {
    let a = readAuto();
    if (!a) {
      const p = probeGpu();
      a = { v: GFX_VER, lvl: p.lvl, gpu: p.gpu.slice(0, 120) };
      writeAuto(a);
    }
    return a;
  };
  M.gfxLevel = function () {
    const g = Store.settings().gfx || "auto";
    if (g !== "auto") return M.GFX_LEVELS.indexOf(g) >= 0 ? g : "mid";
    // 3D の無い版 (1 ファイル版) では調べない
    return PB.View3D && PB.View3D.init ? M.autoGfx().lvl : "2d";
  };
  // 一番解像度を下げても重すぎる (view.js が知らせる): 「自動」なら次から一段軽い画質にする
  function onPoor(q) {
    if ((Store.settings().gfx || "auto") !== "auto") return;
    const a = M.autoGfx();
    const i = M.GFX_LEVELS.indexOf(a.lvl);
    if (i <= 1 || a.lvl !== q) return;
    a.lvl = M.GFX_LEVELS[i - 1];
    a.slow = (a.slow || 0) + 1;
    writeAuto(a);
    // 試合中に作り直すと止まるので、タイトル画面ならすぐ・試合中は次の試合から
    if (!M.match) M.applyGfx();
  }
  // 画質の設定を 3D 描画に反映する (起動時・設定の変更・試合の開始時)。3D で描けるときは true
  // retry: WebGL を作れなかった端末でももう一度試す (設定画面で選び直したとき)
  M.applyGfx = function (retry) {
    const V3 = PB.View3D;
    const show = (on) => {
      const c = (V3 && V3.canvas && V3.canvas()) || document.getElementById("gl");
      if (c) c.style.display = on ? "" : "none";
      document.body.classList.toggle("gl3d", on);
    };
    if (!V3 || !V3.init) {
      show(false);
      return false;
    }
    V3.onPoor = onPoor;
    const lvl = M.gfxLevel();
    if (lvl !== "2d") {
      const prevQ = V3.ok ? V3.quality : null;
      if (!V3.ok) {
        const gl = document.getElementById("gl");
        if (gl && (!M.glFailed || retry)) M.glFailed = !V3.init(gl, lvl);
      } else if (V3.quality !== lvl || !V3.active) V3.setQuality(lvl);
      if (V3.ok) {
        const was = V3.active;
        V3.active = true;
        show(true);
        if (!was || prevQ !== V3.quality) V3.resize(R.W, R.H, R.dpr);
        if (!was) {
          // 2D から戻したとき: 人体モデルとチームの画像を読み直す
          M.titlePrepared = false;
          const g = M.match && M.match.g;
          if (g && g.teams) V3.prepare([g.teams.home, g.teams.away]);
        }
        return true;
      }
    }
    if (V3.active && V3.release) V3.release();
    V3.active = false;
    show(false);
    R.bg = {};
    return false;
  };

  M.startMatch = function (opt) {
    if (M.match) M.match.destroy();
    document.body.classList.add("in-game");
    M.layout();
    // 「自動」の画質が重すぎて下がっていたら、ここで切り替える
    M.applyGfx();
    const V3 = PB.View3D;
    if (V3 && V3.active && opt.game && opt.game.teams) V3.prepare([opt.game.teams.home, opt.game.teams.away]);
    M.match = new PB.Match(opt);
  };

  M.stopMatch = function () {
    if (M.match) M.match.destroy();
    M.match = null;
    document.body.classList.remove("in-game");
    R.setLayout(96, 150);
    R.bg = {};
    M.applyGfx();
  };

  // HUD の高さに合わせてカメラを調整
  M.layout = function () {
    const portrait = window.innerHeight >= window.innerWidth;
    const top = portrait ? 104 : 64;
    const bottom = portrait ? 168 : 104;
    R.setLayout(top, bottom);
  };

  function bindCanvas(cv) {
    const opts = { passive: false };
    cv.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        A.unlock();
        if (M.match) M.match.pointerDown(e);
      },
      opts
    );
    window.addEventListener(
      "pointermove",
      (e) => {
        if (M.match) M.match.pointerMove(e);
      },
      opts
    );
    const up = (e) => {
      if (M.match) M.match.pointerUp(e);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  // タイトル画面の背景 (ゆっくり動く観客席のフラッシュ)
  const title = { t: 0, flashes: [] };
  function drawTitle(ctx, dt) {
    const cam = R.cams.field;
    ctx.drawImage(R.background("field", cam, null), 0, 0, R.W, R.H);
    title.t += dt;
    if (Math.random() < dt * 6) {
      const m = PB.R.G.crowd[Math.floor(Math.random() * PB.R.G.crowd.length)];
      title.flashes.push({ p: m.p, t: 0 });
    }
    for (const f of title.flashes) {
      f.t += dt;
      const q = cam.p(f.p[0], f.p[1], f.p[2] + 0.5);
      if (!q) continue;
      const a = Math.max(0, 1 - f.t / 0.25);
      ctx.fillStyle = "rgba(255,255,240," + a + ")";
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    title.flashes = title.flashes.filter((f) => f.t < 0.25);
    ctx.fillStyle = "rgba(6,12,24,0.45)";
    ctx.fillRect(0, 0, R.W, R.H);
  }

  // タイトル画面の 3D 背景 (好きな球団の本拠地)
  function drawTitle3D(ctx, dt) {
    const V3 = PB.View3D;
    const teams = Store.teams();
    const fav = Store.settings().favTeam;
    const home = teams.find((t) => t.id === fav) || teams[1] || teams[0];
    const away = teams.find((t) => t !== home && PB.D.teamDef(t.id) && PB.D.teamDef(home.id) && PB.D.teamDef(t.id).lg === PB.D.teamDef(home.id).lg) || teams[0];
    if (!M.titlePrepared) {
      M.titlePrepared = true;
      V3.prepare([home, away]);
    }
    if (!V3.renderTitle(dt, [home, away], R.night)) return false;
    ctx.clearRect(0, 0, R.W, R.H);
    const g = ctx.createLinearGradient(0, 0, 0, R.H);
    g.addColorStop(0, "rgba(6,12,24,0.15)");
    g.addColorStop(1, "rgba(6,12,24,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, R.W, R.H);
    return true;
  }

  function frame(ts) {
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
    last = ts;
    const ctx = R.ctx;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    try {
      const V3 = PB.View3D;
      if (M.match && !M.match.dead) {
        M.match.update(dt);
        M.match.draw(ctx, dt);
      } else if (!(V3 && V3.active && drawTitle3D(ctx, dt))) {
        drawTitle(ctx, dt);
      }
    } catch (err) {
      // 1フレームの失敗でゲーム全体が止まらないようにする
      if (!M.errShown) {
        M.errShown = true;
        console.error(err);
      }
    }
    requestAnimationFrame(frame);
  }

  M.boot = function () {
    Store.load();
    M.applySettings();
    const cv = document.getElementById("cv");
    R.init(cv);
    // 3D 描画 (WebGL)。使えない端末や「2D」設定では従来の描画のまま
    M.applyGfx();
    R.night = Store.settings().night;
    UI.init();
    bindCanvas(cv);
    let rt = null;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        R.resize();
        if (PB.View3D && PB.View3D.active) PB.View3D.resize(R.W, R.H, R.dpr);
        if (M.match) M.layout();
      }, 120);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) A.chant(false);
    });
    // 最初のタップで音声を有効化
    window.addEventListener("pointerdown", () => A.unlock(), { once: true });
    Store.teams();
    UI.go(PB.Screens.title());
    requestAnimationFrame(frame);
    // フォント読み込み後に背景を描き直す
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => (R.bg = {}));
    // FastAPI サーバーで動いている場合はセーブを同期
    Store.detectServer().then((on) => {
      if (!on) return;
      Store.pull().then((changed) => {
        if (changed) {
          M.applySettings();
          if (!M.match) UI.go(PB.Screens.title());
        } else Store.push();
        if (UI.cur && UI.root.querySelector(".title-wrap")) UI.refresh();
      });
      if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    });
  };

  PB.main = M;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", M.boot);
  else M.boot();
})((window.PB = window.PB || {}));
