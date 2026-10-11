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

  M.startMatch = function (opt) {
    if (M.match) M.match.destroy();
    document.body.classList.add("in-game");
    M.layout();
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
    const gl = document.getElementById("gl");
    const gfx = Store.settings().gfx || "mid";
    if (gl && PB.View3D && gfx !== "2d" && PB.View3D.init(gl, gfx)) {
      PB.View3D.active = true;
      document.body.classList.add("gl3d");
      PB.View3D.resize(R.W, R.H, R.dpr);
    } else if (gl) gl.style.display = "none";
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
