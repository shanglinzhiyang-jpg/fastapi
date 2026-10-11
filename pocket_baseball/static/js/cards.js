/* 熱闘！ポケットベースボール — 選手カード
   切り抜いた選手 (3D の選手の描画、または利用者が用意した写真) を、光のあふれる背景に重ねた派手なカード。
   背景・枠・ランクの記章はすべてプログラムで描く (オリジナルのデザイン)。 */
(function (PB) {
  "use strict";
  const U = PB.U;
  const D = PB.D;
  const Cards = {};

  /* ---------- 乱数 (カードごとに同じ絵になるよう種から) ---------- */
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function rgb(hex) {
    const v = String(hex || "#888").replace("#", "");
    const s = v.length === 3 ? v.replace(/./g, (c) => c + c) : v;
    const n = parseInt(s, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const c = rgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function mix(h1, h2, t) {
    const a = rgb(h1);
    const b = rgb(h2);
    return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, "0")).join("");
  }

  /* ---------- テーマ (ランクごとの光の色) ---------- */
  // burst: 暖かい光と雲・虹の輪 (上位ランク)、speed: 青い光の筋と粒子
  Cards.theme = function (rank, team) {
    const tc = (team && team.main) || "#2a6df0";
    switch (rank) {
      case "S":
        return { style: "burst", core: "#fffbe8", mid: "#ffc552", edge: "#5a2a08", ray: "#fff2c0", rainbow: true, cloud: "#fff8ec" };
      case "A":
        return { style: "burst", core: "#fff4ec", mid: "#ff8a3c", edge: "#4a0d0d", ray: "#ffd8b0", rainbow: false, cloud: "#ffe9de" };
      case "B":
        return { style: "speed", core: "#eaffff", mid: "#2fc6ff", edge: "#04183a", ray: "#bff4ff", streak: "#47e0ff" };
      default:
        return { style: "speed", core: "#ffffff", mid: mix(tc, "#7fd0ff", 0.35), edge: mix(tc, "#020812", 0.8), ray: mix(tc, "#ffffff", 0.6), streak: mix(tc, "#9fe8ff", 0.5) };
    }
  };

  /* ---------- 背景 ---------- */
  // もこもこした雲 1 つ (上が明るく下が陰る)
  function cloud(ctx, x, y, r, th, R) {
    const n = 12 + Math.floor(R() * 8);
    for (let k = 0; k < n; k++) {
      const px = x + (R() - 0.5) * r * 1.8;
      const py = y + (R() - 0.5) * r * 0.6;
      const pr = r * (0.25 + R() * 0.4);
      const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.4, 0, px, py, pr);
      g.addColorStop(0, rgba(th.cloud, 0.5));
      g.addColorStop(0.45, rgba(mix(th.cloud, th.mid, 0.25), 0.32));
      g.addColorStop(1, rgba(mix(th.cloud, th.mid, 0.5), 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  Cards.background = function (ctx, w, h, th, seed) {
    const R = rng(seed || 1);
    const cx = w * 0.5;
    const cy = h * 0.4;
    const big = Math.hypot(w, h);
    ctx.save();
    // 地の色 (外は暗く)
    let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, big * 0.6);
    g.addColorStop(0, mix(th.mid, th.core, 0.2));
    g.addColorStop(0.35, th.mid);
    g.addColorStop(0.75, mix(th.mid, th.edge, 0.7));
    g.addColorStop(1, th.edge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    // 光の筋 (中心から放射・太さと長さをばらつかせる)
    const N = th.style === "burst" ? 44 : 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + R() * 0.1;
      const wd = (0.004 + R() * R() * 0.035) * Math.PI;
      const len = big * (0.35 + R() * 0.55);
      const gr = ctx.createRadialGradient(cx, cy, w * 0.05, cx, cy, len);
      gr.addColorStop(0, rgba(th.ray, 0.42 * (0.35 + R() * 0.65)));
      gr.addColorStop(0.6, rgba(th.ray, 0.12));
      gr.addColorStop(1, rgba(th.ray, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, len, a - wd, a + wd);
      ctx.closePath();
      ctx.fill();
    }
    if (th.style === "burst") {
      // 光の輪 (ぼかした太い輪を重ねる・上位ランクは虹色)
      for (let k = 0; k < 2; k++) {
        const r = w * (0.4 + k * 0.17);
        for (let s = 0; s < 4; s++) {
          ctx.lineWidth = w * (0.05 - s * 0.011);
          let st;
          if (th.rainbow && ctx.createConicGradient) {
            st = ctx.createConicGradient(-Math.PI / 2 + k * 1.3, cx, cy);
            ["#ff4a4a", "#ffae3a", "#fff06a", "#5aff7a", "#4ad0ff", "#7a6aff", "#ff5ad0", "#ff4a4a"].forEach((c, i, arr) => st.addColorStop(i / (arr.length - 1), rgba(c, 0.08 + s * 0.035 - k * 0.03)));
          } else st = rgba(th.ray, 0.06 + s * 0.03 - k * 0.02);
          ctx.strokeStyle = st;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * 0.97, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else {
      // 光の弧 (欠けた円) と斜めの筋
      for (let k = 0; k < 4; k++) {
        const r = w * (0.3 + k * 0.12);
        const a0 = R() * Math.PI * 2;
        ctx.lineWidth = w * (0.006 + R() * 0.012);
        ctx.strokeStyle = rgba(th.streak, 0.25 + R() * 0.25);
        for (let s = 0; s < 3; s++) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, a0 + s * 2.1, a0 + s * 2.1 + 0.6 + R() * 0.9);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 22; i++) {
        const y0 = h * R();
        const x0 = -w * 0.2 + w * 1.2 * R();
        const len = w * (0.25 + R() * 0.6);
        const t2 = -0.42;
        const lg = ctx.createLinearGradient(x0, y0, x0 + Math.cos(t2) * len, y0 + Math.sin(t2) * len);
        lg.addColorStop(0, rgba(th.streak, 0));
        lg.addColorStop(0.5, rgba(th.streak, 0.3 + R() * 0.3));
        lg.addColorStop(1, rgba(th.streak, 0));
        ctx.strokeStyle = lg;
        ctx.lineWidth = 1 + R() * w * 0.01;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(t2) * len, y0 + Math.sin(t2) * len);
        ctx.stroke();
      }
      // 山形の矢印 (左上)
      ctx.lineWidth = w * 0.022;
      ctx.lineJoin = "round";
      for (let k = 0; k < 4; k++) {
        const x = w * (0.06 + k * 0.07);
        const y = h * 0.07;
        ctx.strokeStyle = rgba(th.streak, 0.15 + k * 0.1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w * 0.04, y + h * 0.035);
        ctx.lineTo(x, y + h * 0.07);
        ctx.stroke();
      }
      // 四角い光の粒
      for (let i = 0; i < 30; i++) {
        const s = w * (0.006 + R() * 0.018);
        ctx.fillStyle = rgba(th.streak, 0.15 + R() * 0.35);
        ctx.fillRect(w * R(), h * R() * 0.8, s, s);
      }
      // レンズのきらめき (六角の連なり)
      const fx = w * (0.15 + R() * 0.2);
      const fy = h * (0.12 + R() * 0.15);
      for (let k = 0; k < 4; k++) {
        const t = k / 3;
        const x = fx + (cx - fx) * t * 1.6;
        const y = fy + (cy - fy) * t * 1.6;
        hexagon(ctx, x, y, w * (0.025 + k * 0.012), rgba(th.streak, 0.12 + 0.05 * k));
      }
    }
    // 中心の強い光 (小さめ・選手の後ろ)
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.42);
    g.addColorStop(0, rgba(th.core, 0.95));
    g.addColorStop(0.18, rgba(th.core, 0.6));
    g.addColorStop(0.5, rgba(th.core, 0.12));
    g.addColorStop(1, rgba(th.core, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    if (th.style === "burst") {
      // 雲: 光を取り巻くように左右と下に
      for (let i = 0; i < 9; i++) {
        const left = i % 2 === 0;
        cloud(ctx, left ? w * (0.02 + R() * 0.18) : w * (0.8 + R() * 0.18), h * (0.2 + R() * 0.55), w * (0.1 + R() * 0.08), th, R);
      }
      for (let i = 0; i < 10; i++) cloud(ctx, w * (i / 9) + (R() - 0.5) * w * 0.08, h * (0.7 + R() * 0.1), w * (0.1 + R() * 0.07), th, R);
    }
    // きらめき (少なめ・十字の光)
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const x = w * R();
      const y = h * R() * 0.8;
      const s = w * (0.003 + R() * R() * 0.016);
      sparkle(ctx, x, y, s, rgba(th.core, 0.55 + R() * 0.45));
    }
    ctx.globalCompositeOperation = "source-over";
    // 足元の芝
    const gy = h * 0.78;
    g = ctx.createLinearGradient(0, gy, 0, h);
    g.addColorStop(0, "rgba(40,110,40,0)");
    g.addColorStop(0.3, "rgba(46,128,44,0.9)");
    g.addColorStop(1, "rgba(14,52,16,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.strokeStyle = "rgba(150,220,120,0.2)";
    ctx.lineWidth = Math.max(1, w * 0.003);
    for (let i = 0; i < 200; i++) {
      const x = w * R();
      const y = gy + (h - gy) * (0.25 + R() * 0.75);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (R() - 0.5) * w * 0.01, y - h * (0.006 + R() * 0.02));
      ctx.stroke();
    }
    // 周辺を暗く
    g = ctx.createRadialGradient(cx, h * 0.48, w * 0.3, cx, h * 0.48, big * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };
  function hexagon(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  function sparkle(ctx, x, y, s, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.4);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, s * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 4);
    ctx.quadraticCurveTo(x + s * 0.25, y - s * 0.25, x + s * 4, y);
    ctx.quadraticCurveTo(x + s * 0.25, y + s * 0.25, x, y + s * 4);
    ctx.quadraticCurveTo(x - s * 0.25, y + s * 0.25, x - s * 4, y);
    ctx.quadraticCurveTo(x - s * 0.25, y - s * 0.25, x, y - s * 4);
    ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  Cards.roundRect = roundRect;

  /* ---------- 能力の総合値 (0〜100) とランク ---------- */
  Cards.overall = function (p) {
    const v = p.pos === "P" ? U.clamp((D.pitOverall(p) - 40) / 1.55, 1, 100) : U.clamp((D.batOverall(p) - 90) / 2.4, 1, 100);
    return { v: Math.round(v), rank: D.rank(v).r };
  };

  /* ---------- 画像の読み込み (球団マーク) ---------- */
  const imgCache = {};
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (!imgCache[src])
      imgCache[src] = new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = src;
      });
    return imgCache[src];
  }

  const FONT = '"M PLUS 1p", "Hiragino Kaku Gothic ProN", sans-serif';
  const FONT_N = '"Archivo Black", "Arial Black", sans-serif';

  // ランクの記章 (メダル)
  function medal(ctx, x, y, r, rank) {
    const col = { S: ["#fff6c0", "#e0a400", "#7a4a00"], A: ["#ffd6c8", "#e04a2a", "#5a1000"], B: ["#d8f0ff", "#2a8ae0", "#0a2a5a"] }[rank] || ["#f0f0f0", "#9aa3ad", "#3a4048"];
    ctx.save();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, col[0]);
    g.addColorStop(0.6, col[1]);
    g.addColorStop(1, col[2]);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = r * 0.3;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = r * 0.12;
    ctx.strokeStyle = col[0];
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = col[2];
    ctx.lineWidth = r * 0.14;
    ctx.font = "400 " + Math.round(r * 1.2) + "px " + FONT_N;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(rank, x, y + r * 0.05);
    ctx.fillText(rank, x, y + r * 0.05);
    ctx.restore();
  }
  // 縁取りつきの文字
  // font は "900 " + 書体名 のように太さを先頭に書く (canvas の font は「太さ 大きさ 書体」の順)
  function label(ctx, text, x, y, size, font, fill, stroke, align) {
    const m = /^(\d{3})\s+(.*)$/.exec(font);
    ctx.font = m ? m[1] + " " + size + "px " + m[2] : size + "px " + font;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.strokeStyle = stroke || "rgba(0,0,0,0.85)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill || "#fff";
    ctx.fillText(text, x, y);
  }

  // 切り抜いた絵に白い縁取りをつける (シールのように)。結果は元の絵に覚えておく
  function sticker(src, r) {
    if (src._sticker) return src._sticker;
    const pad = Math.ceil(r) + 1;
    const W = src.width + pad * 2;
    const H = src.height + pad * 2;
    const sil = document.createElement("canvas");
    sil.width = W;
    sil.height = H;
    const sc = sil.getContext("2d");
    sc.drawImage(src, pad, pad);
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = "#fff";
    sc.fillRect(0, 0, W, H);
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const oc = out.getContext("2d");
    for (const k of [1, 0.55])
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        oc.drawImage(sil, Math.cos(a) * r * k, Math.sin(a) * r * k);
      }
    oc.drawImage(src, pad, pad);
    src._sticker = out;
    return out;
  }

  /* ---------- カードを描く ---------- */
  // portrait: 切り抜いた選手の画像 (canvas / image)。null のときは背番号を大きく描く
  // 球団マークを読み込んでから描く (マークは選手の後ろに置き、頭が隠れないように)
  Cards.draw = function (cv, p, team, portrait, opts) {
    return loadImg(team.logo).then((logo) => paint(cv, p, team, portrait, opts || {}, logo));
  };
  function paint(cv, p, team, portrait, o, logo) {
    const ctx = cv.getContext("2d");
    const w = cv.width;
    const h = cv.height;
    const ov = Cards.overall(p);
    const th = Cards.theme(ov.rank, team);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    roundRect(ctx, 0, 0, w, h, w * 0.05);
    ctx.clip();
    Cards.background(ctx, w, h, th, hash(String(p.id)));
    // 背景に大きな背番号
    if (p.num != null) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.font = "400 " + Math.round(w * 0.62) + "px " + FONT_N;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText(String(p.num), w * 0.5, h * 0.56);
      ctx.restore();
    }
    // 球団マーク (右上)
    if (logo) {
      const ls = o.mini ? w * 0.26 : w * 0.17;
      ctx.drawImage(logo, w - ls - w * 0.04, o.mini ? w * 0.04 : h * 0.025, ls, ls);
    }
    // 選手 (白い縁取りと光)
    if (portrait) {
      const meta = portrait._photo || null;
      // 写真は切り抜いたまま使う (縁取り・光などの加工はしない)。3D の選手・2 頭身のキャラは白く縁取る
      const img = meta ? portrait : sticker(portrait, Math.max(2, portrait.height / 150));
      const pw = img.width;
      const ph = img.height;
      // 膝から上などで写真の下端が切れているときは、カードの下端に合わせる
      const flush = !!(meta && meta.cut && meta.cut.indexOf("b") >= 0);
      // 写真は横に広い姿勢 (投球の踏み出し・スイング) でも小さくならないよう、左右は少しはみ出してよい
      const scale = flush ? Math.min((w * 1.15) / pw, (h * 0.97) / ph) : meta ? Math.min((w * 1.2) / pw, (h * 0.87) / ph) : Math.min((w * 1.0) / pw, (h * 0.92) / ph);
      const dw = pw * scale;
      const dh = ph * scale;
      // 足元 (写真では記録した位置) をカードの中央に
      const fx = meta && meta.foot != null ? meta.foot : 0.5;
      const dx = U.clamp(w / 2 - fx * dw, Math.min(0, w - dw), Math.max(0, w - dw));
      const dy = (flush ? h : h * 0.9) - dh;
      if (meta) ctx.drawImage(img, dx, dy, dw, dh);
      else {
        ctx.save();
        ctx.shadowColor = th.style === "burst" ? "rgba(255,250,230,0.95)" : "rgba(200,245,255,0.95)";
        ctx.shadowBlur = w * 0.04;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = w * 0.012;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      }
    }
    // 下の帯
    let g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    const s = w / 300;
    if (!o.mini) {
      medal(ctx, w * 0.11, h * 0.885, 27 * s, ov.rank);
      label(ctx, "総合", w * 0.215, h * 0.855, Math.round(13 * s), "900 " + FONT, "#ffe9a0");
      label(ctx, String(ov.v), w * 0.2, h * 0.965, Math.round(38 * s), "400 " + FONT_N, ov.rank === "S" ? "#ffd84a" : ov.rank === "A" ? "#ff6a3a" : "#ffffff", "rgba(40,10,0,0.95)");
      const pos = (D.POS_JP[o.pos || p.pos] || "") + (p.num != null ? " #" + p.num : "");
      label(ctx, "2004 " + (team.short || "") + " " + pos, w * 0.43, h * 0.865, Math.round(15 * s), "900 " + FONT, "#ffffff");
      const name = p.given ? (p.foreign ? p.name : p.name + " " + p.given) : p.name;
      label(ctx, name, w * 0.43, h * 0.955, Math.round((name.length > 6 ? 24 : 30) * s), "900 " + FONT, "#ffffff");
    } else {
      // 小さいカード: 左下にランク、右に名前 (幅に合わせて文字を縮める)
      const mr = w * 0.1;
      medal(ctx, w * 0.04 + mr, h - w * 0.05 - mr, mr, ov.rank);
      const room = w * 0.95 - (w * 0.06 + mr * 2);
      ctx.font = "900 100px " + FONT;
      const fit = (100 * room) / Math.max(1, ctx.measureText(p.name).width);
      label(ctx, p.name, w * 0.95, h - w * 0.07, Math.round(Math.min(w * 0.2, fit)), "900 " + FONT, "#fff", null, "right");
    }
    ctx.restore();
    // 枠
    ctx.save();
    roundRect(ctx, 1, 1, w - 2, h - 2, w * 0.05);
    ctx.lineWidth = Math.max(2, w * 0.012);
    const fg = ctx.createLinearGradient(0, 0, w, h);
    const fr = ov.rank === "S" ? ["#fff6c0", "#d4a224", "#fff0a8"] : ov.rank === "A" ? ["#ffd0c0", "#c83a1a", "#ffb0a0"] : ["#e8f6ff", "#6a8aa8", "#d0e4f4"];
    fg.addColorStop(0, fr[0]);
    fg.addColorStop(0.5, fr[1]);
    fg.addColorStop(1, fr[2]);
    ctx.strokeStyle = fg;
    ctx.stroke();
    ctx.restore();
  }

  // カードの文字の書体を読み込む。すでに使える (または読み込めない環境) なら null
  function fontLoad(text) {
    const F = document.fonts;
    if (!F || !F.load || !F.check) return null;
    const specs = ['900 20px "M PLUS 1p"', '400 20px "Archivo Black"'];
    try {
      if (specs.every((f) => F.check(f, text))) return null;
    } catch (e) {
      return null;
    }
    return Promise.all(specs.map((f) => F.load(f, text))).catch(() => {});
  }

  // すぐに使える <canvas> を返し、選手の画像が描けたら描き直す
  Cards.el = function (p, team, opts) {
    const o = opts || {};
    const cw = o.w || 300;
    const ch = Math.round(cw * (o.mini ? 1.25 : 1.333));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement("canvas");
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(ch * dpr);
    cv.style.width = cw + "px";
    cv.style.height = ch + "px";
    cv.className = "pbcard" + (o.mini ? " mini" : "");
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", (p.full || p.name) + " " + (team.short || "") + " " + Cards.overall(p).rank + "ランク");
    // 書体 (その文字の分) を読み込んでから描き直す。画面でまだ使っていない書体は canvas では読み込まれないため
    const fl = fontLoad((p.full || p.name) + (p.given || "") + (team.short || "") + "総合2004#" + (D.POS_JP[o.pos || p.pos] || "") + (p.num != null ? p.num : ""));
    if (fl) fl.then(() => Cards.draw(cv, p, team, cv._portrait || null, o));
    Cards.draw(cv, p, team, null, o);
    const src = Cards.portraitOf(p, team, o);
    if (src)
      src.then(
        (img) => {
          if (!img) return;
          cv._portrait = img;
          Cards.draw(cv, p, team, img, o);
        },
        () => {}
      );
    return cv;
  };

  // 利用者が用意した写真 (tools/player_photo.py で切り抜いたもの)。球団と背番号で引く
  Cards.photoOf = function (p, team) {
    if (!PB.PHOTOS || p.custom || p.num == null) return null;
    const t = PB.PHOTOS[team.id];
    return (t && t[p.num]) || null;
  };
  // 選手の画像: 写真があればそれ、なければ 3D の選手の描画、3D が使えなければ 2 頭身のキャラ
  Cards.portraitOf = function (p, team, o) {
    const ph = Cards.photoOf(p, team);
    if (ph)
      return loadImg(D.asset ? D.asset(ph.src) : ph.src).then((im) => {
        if (!im) return rendered(p, team, o); // 画像が読めなければ 3D で
        im._photo = ph;
        return im;
      });
    return rendered(p, team, o);
  };
  function rendered(p, team, o) {
    if (PB.Portraits && PB.Portraits.available() && PB.View3D && PB.View3D.active) {
      const ov = Cards.overall(p);
      const th = Cards.theme(ov.rank, team);
      return PB.Portraits.get(p, team, { kind: o && o.kind, home: o && o.home, rim: th.ray }).catch(() => chibi(p, team));
    }
    return Promise.resolve(chibi(p, team));
  }
  // 3D が使えないときは 2 頭身のキャラで (ガッツポーズ・投手は投げる形)
  function chibi(p, team) {
    if (!PB.Chara) return null;
    const cv = document.createElement("canvas");
    cv.width = 300;
    cv.height = 400;
    PB.Chara.draw(cv.getContext("2d"), 150, 384, 150, { team, face: p.face, view: "front", pose: p.pos === "P" ? "throw" : "cheer", t: 0.6, num: p.num, mark: team.mark, noShadow: true });
    return cv;
  }

  PB.Cards = Cards;
})((window.PB = window.PB || {}));
