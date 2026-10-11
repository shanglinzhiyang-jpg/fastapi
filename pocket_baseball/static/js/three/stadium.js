/* 熱闘！ポケットベースボール — 3D 球場
 * ゲーム座標 (x: 一塁側, y: センター方向, z: 上, 単位 m) を three.js 座標 (X=x, Y=z, Z=-y) に写して組み立てる。
 * 地面は 1 枚の板にシェーダーで芝・土・白線を描く (どれだけ寄ってもラインがにじまない)。
 * スタンドはフィールドの外周に沿って段々を積み上げ、観客は帯状のテクスチャで表現する。 */
(function (PB) {
  "use strict";
  const T = window.THREE;
  const F = PB.F;
  const S3 = {};
  const SQ = Math.SQRT1_2;
  const D2R = Math.PI / 180;

  const V = (x, y, z) => new T.Vector3(x, z || 0, -y);
  S3.V = V;

  // 乱数 (球場ごとに同じ見た目になるよう種付き)
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }
  const hashStr = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const ab2xy = (a, b) => [(a - b) * SQ, (a + b) * SQ];

  /* ---------- 球場のバリエーション ---------- */
  S3.PARKS = {
    phx: { dome: true, seat: "#2b5fa8", wall: "#123a6b", roof: "#e6e6e0" },
    oct: { dome: false, seat: "#5b3a8c", wall: "#1f5c3a", skyline: true },
    bea: { dome: true, seat: "#3e8cc0", wall: "#173a63", roof: "#dfe6ea" },
    typ: { dome: false, seat: "#1f7a6d", wall: "#0d4a40", skyline: true },
    sha: { dome: true, seat: "#c58f00", wall: "#232323", roof: "#ece6d4" },
    thu: { dome: false, seat: "#2d4f86", wall: "#123824", skyline: false },
  };
  S3.parkFor = function (team) {
    if (!team) return { dome: false, seat: "#2d4f86", wall: "#14402c", skyline: true };
    if (S3.PARKS[team.id]) return S3.PARKS[team.id];
    const h = hashStr(team.id || team.name || "x");
    return { dome: h % 3 === 0, seat: team.main || "#2d4f86", wall: h % 2 ? "#14402c" : "#173a63", roof: "#e4e4de", skyline: h % 2 === 0 };
  };

  const SPONSORS = [
    ["ポケット生命", "#ffffff", "#c8102e"],
    ["熱闘カレー", "#ffd23f", "#5a2a0c"],
    ["NINE BANK", "#ffffff", "#0b3d91"],
    ["スラッガー電機", "#ffffff", "#111111"],
    ["ダイヤモンド証券", "#0b2a5b", "#f2f2f2"],
    ["ホームランビール", "#ffe25c", "#b5121b"],
    ["カーブ製菓", "#ffffff", "#e5007f"],
    ["STRIKE MOTORS", "#e8e8e8", "#2a2a2a"],
    ["グランドスラム不動産", "#ffffff", "#00754a"],
    ["ナックル運輸", "#ffcc00", "#003b70"],
    ["ベースボールモバイル", "#ffffff", "#ff6a00"],
    ["SPEEDGUN WATCH", "#d4af37", "#101010"],
    ["まんぷく弁当", "#5a2a0c", "#ffcf6e"],
    ["フルカウント保険", "#ffffff", "#2a7de1"],
    ["サヨナラ銀行", "#ffffff", "#7a1f9b"],
  ];

  /* ---------- テクスチャ ---------- */
  function canvasTex(w, h, draw, opts) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = (opts && opts.aniso) || 4;
    if (opts && opts.repeat) t.wrapS = T.RepeatWrapping;
    t.userData.canvas = c;
    return t;
  }

  function fitText(ctx, txt, maxW, size, font) {
    let s = size;
    ctx.font = font.replace("%s", s);
    while (ctx.measureText(txt).width > maxW && s > 6) {
      s -= 1;
      ctx.font = font.replace("%s", s);
    }
    return s;
  }

  // 外野フェンス (u = 弧長)
  function fenceTexture(path, park, total) {
    const W = 4096;
    const k = W / total; // px/m
    const H = Math.round(F.FENCE_H * k) + 4;
    return canvasTex(
      W,
      H,
      (ctx) => {
        ctx.fillStyle = park.wall;
        ctx.fillRect(0, 0, W, H);
        // パッドの継ぎ目
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        for (let x = 0; x < W; x += 2.0 * k) ctx.fillRect(Math.round(x), 0, 1, H);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, H * 0.18, W, 2);
        // 黄色いホームランライン
        ctx.fillStyle = "#f5d443";
        ctx.fillRect(0, 0, W, Math.max(3, 0.16 * k));
        // 広告 (バックスクリーン付近は空ける)
        const r = rng(hashStr(park.wall + "ads"));
        const thAt = (s) => {
          for (let i = 0; i < path.length - 1; i++) if (path[i + 1].s >= s) return path[i].th;
          return 0;
        };
        let s = 3;
        let si = Math.floor(r() * SPONSORS.length);
        while (s < total - 6) {
          const w = 8 + Math.floor(r() * 3) * 2;
          const th = thAt(s + w / 2) / D2R;
          const near = [-45, -22.5, 22.5, 45].some((a) => Math.abs(a - th) < 3.2);
          if (Math.abs(th) < 10 || near) {
            s += 2;
            continue;
          }
          const [name, fg, bg] = SPONSORS[si++ % SPONSORS.length];
          const x0 = s * k;
          const y0 = H * 0.3;
          const ww = w * k;
          const hh = H * 0.6;
          ctx.fillStyle = bg;
          ctx.fillRect(x0, y0, ww, hh);
          ctx.fillStyle = fg;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          fitText(ctx, name, ww * 0.9, Math.round(hh * 0.62), "900 %spx 'M PLUS Rounded 1c', 'Hiragino Sans', sans-serif");
          ctx.fillText(name, x0 + ww / 2, y0 + hh / 2 + 1);
          s += w + 0.6;
        }
        // 距離表示
        const marks = [
          [-45, "100"],
          [-22.5, "116"],
          [0, "122"],
          [22.5, "116"],
          [45, "100"],
        ];
        for (const [a, txt] of marks) {
          let best = 0;
          for (let i = 0; i < path.length; i++) if (Math.abs(path[i].th / D2R - a) < Math.abs(path[best].th / D2R - a)) best = i;
          const x = Math.min(W - 3 * k, Math.max(3 * k, path[best].s * k));
          ctx.font = "900 " + Math.round(H * 0.5) + "px 'Dela Gothic One', 'Arial Black', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#f6f2e4";
          ctx.fillText(txt, x, H * 0.58);
          ctx.font = "700 " + Math.round(H * 0.2) + "px sans-serif";
          ctx.fillText("m", x + H * 0.62, H * 0.72);
        }
      },
      { aniso: 8 }
    );
  }

  // 内野側の低いフェンス (48m で繰り返す LED 広告帯)
  function sideWallTexture(park) {
    const L = 48;
    const W = 2048;
    const k = W / L;
    const H = Math.round(1.2 * k);
    return canvasTex(
      W,
      H,
      (ctx) => {
        ctx.fillStyle = park.wall;
        ctx.fillRect(0, 0, W, H);
        const r = rng(hashStr(park.seat + "side"));
        let x = 0;
        let i = Math.floor(r() * SPONSORS.length);
        while (x < W - 2) {
          const w = Math.min(W - x, (6 + Math.floor(r() * 3) * 2) * k);
          const [name, fg, bg] = SPONSORS[i++ % SPONSORS.length];
          ctx.fillStyle = bg;
          ctx.fillRect(x + 2, H * 0.14, w - 4, H * 0.66);
          ctx.fillStyle = fg;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          fitText(ctx, name, w * 0.86, Math.round(H * 0.42), "900 %spx 'M PLUS Rounded 1c', sans-serif");
          ctx.fillText(name, x + w / 2, H * 0.48);
          x += w;
        }
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(0, 0, W, 2);
      },
      { repeat: true, aniso: 8 }
    );
  }

  // 観客の帯 (8 段: 0-2 一般, 3-4 ホーム応援, 5-6 ビジター応援, 7 まばら)
  const PEOPLE_PER_BAND = 34;
  const BAND_LEN = 17;
  function crowdAtlas(park, home, away) {
    const W = 2048;
    const BH = 128;
    return canvasTex(
      W,
      BH * 8,
      (ctx) => {
        const r = rng(hashStr((home && home.id) + (away && away.id) + "crowd"));
        const skin = ["#f1cfaf", "#e2b48e", "#d8a47c", "#c48c66", "#f4d9be"];
        const hair = ["#1d1611", "#2a1d14", "#3a2a1c", "#121212", "#5b4030", "#8a6a48", "#c9c9c9"];
        const neutral = ["#f2f2ee", "#2b2f3a", "#33507a", "#8c2b2b", "#d9c9a3", "#4d6b3c", "#e6e1d6", "#1c1c1c", "#b8b8b8", "#d77a2a", "#6d4c8c"];
        const hc = home ? [home.main, home.main, home.sub, home.cap || home.main, "#f4f2ec"] : neutral;
        const ac = away ? [away.main, away.main, away.sub, away.cap || away.main, "#f4f2ec"] : neutral;
        const seatBack = park.seat;
        const px = W / PEOPLE_PER_BAND;
        for (let band = 0; band < 8; band++) {
          const y0 = band * BH;
          const kind = band < 3 ? "n" : band < 5 ? "h" : band < 7 ? "a" : "e";
          const pal = kind === "h" ? hc : kind === "a" ? ac : neutral;
          // 座席の背もたれ
          for (let i = 0; i < PEOPLE_PER_BAND; i++) {
            const cx = (i + 0.5) * px;
            ctx.fillStyle = seatBack;
            ctx.fillRect(cx - px * 0.4, y0 + BH * 0.62, px * 0.8, BH * 0.38);
            ctx.fillStyle = "rgba(0,0,0,0.25)";
            ctx.fillRect(cx - px * 0.4, y0 + BH * 0.94, px * 0.8, BH * 0.06);
          }
          for (let i = 0; i < PEOPLE_PER_BAND; i++) {
            const empty = kind === "e" ? r() < 0.62 : r() < 0.04;
            if (empty) continue;
            const cx = (i + 0.5) * px + (r() - 0.5) * px * 0.18;
            const shirt = r() < (kind === "n" ? 0.25 : 0.82) ? pal[Math.floor(r() * pal.length)] : neutral[Math.floor(r() * neutral.length)];
            const bw = px * (0.62 + r() * 0.16);
            const top = y0 + BH * (0.34 + r() * 0.06);
            const up = kind !== "n" && kind !== "e" ? r() < 0.35 : r() < 0.06;
            // 腕
            ctx.fillStyle = shirt;
            if (up) {
              ctx.save();
              ctx.lineCap = "round";
              ctx.strokeStyle = shirt;
              ctx.lineWidth = px * 0.16;
              ctx.beginPath();
              ctx.moveTo(cx - bw * 0.38, top + BH * 0.06);
              ctx.lineTo(cx - bw * 0.55, top - BH * 0.2);
              ctx.moveTo(cx + bw * 0.38, top + BH * 0.06);
              ctx.lineTo(cx + bw * 0.55, top - BH * 0.2);
              ctx.stroke();
              ctx.restore();
              // メガホン/タオル
              if (r() < 0.5) {
                ctx.fillStyle = r() < 0.5 ? pal[0] : "#ffffff";
                ctx.fillRect(cx - bw * 0.7, top - BH * 0.3, bw * 1.4, BH * 0.08);
              }
            }
            // 胴体
            ctx.fillStyle = shirt;
            ctx.beginPath();
            const rr = bw * 0.3;
            ctx.moveTo(cx - bw / 2, y0 + BH);
            ctx.lineTo(cx - bw / 2, top + rr);
            ctx.quadraticCurveTo(cx - bw / 2, top, cx - bw / 2 + rr, top);
            ctx.lineTo(cx + bw / 2 - rr, top);
            ctx.quadraticCurveTo(cx + bw / 2, top, cx + bw / 2, top + rr);
            ctx.lineTo(cx + bw / 2, y0 + BH);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.fillRect(cx - bw / 2, top + BH * 0.28, bw, BH * 0.4);
            // 頭
            const hr = px * (0.2 + r() * 0.04);
            const hy = top - hr * 0.7;
            ctx.fillStyle = skin[Math.floor(r() * skin.length)];
            ctx.beginPath();
            ctx.ellipse(cx, hy, hr * 0.9, hr, 0, 0, Math.PI * 2);
            ctx.fill();
            const cap = kind !== "n" ? r() < 0.45 : r() < 0.15;
            ctx.fillStyle = cap ? (kind === "n" ? neutral[Math.floor(r() * 4)] : pal[Math.floor(r() * 2)]) : hair[Math.floor(r() * hair.length)];
            ctx.beginPath();
            ctx.ellipse(cx, hy - hr * 0.3, hr * 0.95, hr * 0.75, 0, Math.PI, Math.PI * 2);
            ctx.fill();
            if (cap) ctx.fillRect(cx - hr * 1.1, hy - hr * 0.3, hr * 2.2, hr * 0.25);
          }
        }
      },
      { repeat: true, aniso: 4 }
    );
  }

  // 照明のランプ面
  function lampTexture() {
    return canvasTex(256, 160, (ctx, w, h) => {
      ctx.fillStyle = "#2b2f36";
      ctx.fillRect(0, 0, w, h);
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 8; i++) {
          const x = 16 + i * 32;
          const y = 16 + j * 32;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.5, "#fff6d8");
          g.addColorStop(1, "#8a8572");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 13, 0, Math.PI * 2);
          ctx.fill();
        }
    });
  }
  function glowTexture() {
    return canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,245,1)");
      g.addColorStop(0.18, "rgba(255,248,220,0.55)");
      g.addColorStop(0.5, "rgba(255,240,200,0.12)");
      g.addColorStop(1, "rgba(255,240,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
  }

  // 街並み (遠景)
  function skylineTexture(seed) {
    return canvasTex(
      2048,
      256,
      (ctx, w, h) => {
        const r = rng(seed);
        ctx.clearRect(0, 0, w, h);
        let x = 0;
        while (x < w) {
          const bw = 18 + r() * 60;
          const bh = 30 + r() * r() * 200;
          const c = 18 + Math.floor(r() * 18);
          ctx.fillStyle = "rgb(" + c + "," + (c + 4) + "," + (c + 14) + ")";
          ctx.fillRect(x, h - bh, bw, bh);
          for (let yy = h - bh + 6; yy < h - 4; yy += 7)
            for (let xx = x + 3; xx < x + bw - 3; xx += 6) {
              if (r() < 0.3) {
                ctx.fillStyle = r() < 0.7 ? "rgba(255,226,160,0.9)" : "rgba(200,230,255,0.85)";
                ctx.fillRect(xx, yy, 3, 3);
              }
            }
          x += bw + r() * 6;
        }
      },
      { repeat: true }
    );
  }

  /* ---------- 地面のシェーダー ---------- */
  const GROUND_GLSL = `
uniform vec3 uGrass; uniform vec3 uGrass2; uniform vec3 uFoul; uniform vec3 uDirt; uniform vec3 uClay; uniform vec3 uTrack; uniform vec3 uLine; uniform vec3 uOut;
uniform float uMow;
varying vec2 vG;
float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float gn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(gh(i), gh(i+vec2(1.0,0.0)), f.x), mix(gh(i+vec2(0.0,1.0)), gh(i+vec2(1.0,1.0)), f.x), f.y); }
float gfbm(vec2 p){ return gn(p)*0.5 + gn(p*2.07+3.1)*0.3 + gn(p*4.13+7.7)*0.2; }
float cov(float d){ float w = max(fwidth(d), 1e-4); return clamp(0.5 - d / w, 0.0, 1.0); }
float chalk(float d, float hw){ float w = max(fwidth(d), 1e-4); return clamp((hw - abs(d)) / w + 0.5, 0.0, 1.0) * clamp(hw * 2.0 / w, 0.35, 1.0); }
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a; vec2 ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec2 abxy(float a, float b){ return vec2((a - b) * 0.70710678, (a + b) * 0.70710678); }
float boxd(vec2 p, vec2 c, vec2 h){ vec2 q = abs(p - c) - h; return max(q.x, q.y); }
`;
  const GROUND_MAIN = `
  vec2 p = vG;
  float r = length(p);
  float a = (p.y + p.x) * 0.70710678;
  float b = (p.y - p.x) * 0.70710678;
  float th = atan(p.x, p.y);
  float thc = clamp(th, -0.785398, 0.785398);
  float fd = 100.0 + 22.0 * cos(2.0 * thc);
  bool fair = a >= 0.0 && b >= 0.0;
  // フィールドの内外
  vec2 cc = vec2(0.0, -6.13);
  vec2 pc = p - cc;
  bool corner = pc.y < -abs(pc.x);
  bool inside;
  if (fair) inside = r < fd + 0.3;
  else if (corner) inside = length(pc) < 13.67;
  else inside = a > -18.0 && b > -18.0 && a < 100.3 && b < 100.3;
  float fw = fwidth(p.x) + fwidth(p.y);
  float fine = clamp(1.0 - fw * 4.0, 0.0, 1.0);
  // 芝 (刈り込みの市松模様 + むら)
  float ck = sin(a * 0.4134) * sin(b * 0.4134);
  float kw = max(fwidth(ck), 1e-3);
  float mow = smoothstep(-kw, kw, ck);
  vec3 grass = fair ? mix(uGrass, uGrass2, mow * uMow) : mix(uFoul, uGrass2 * 0.94, mow * uMow * 0.6);
  float big = gfbm(p * 0.045);
  grass *= 0.9 + 0.2 * big;
  grass *= 1.0 + (gn(p * 7.0) - 0.5) * 0.16 * fine + (gn(p * 31.0) - 0.5) * 0.14 * clamp(1.0 - fw * 20.0, 0.0, 1.0);
  vec3 col = grass;
  float rough = 0.93;
  // 土 (内野のスキン, 本塁, マウンド, ベースの切り欠き)
  float dSkin = max(max(26.1 - max(a, b), length(p - vec2(0.0, 18.44)) - 29.0), max(-1.0 - a, -1.0 - b));
  float dHome = r - 4.2;
  float dMound = length(p - vec2(0.0, 17.98)) - 2.75;
  float dBase = min(min(length(p - abxy(27.431, 0.0)), length(p - abxy(0.0, 27.431))), length(p - abxy(27.431, 27.431))) - 2.4;
  float dDirt = min(min(dSkin, dHome), min(dMound, dBase));
  // 外野フェンス際・ファウルゾーンのウォーニングトラック
  float dTrack = 1e5;
  if (fair) dTrack = (fd - 4.6) - r;
  else if (corner) dTrack = (13.67 - 2.6) - length(pc);
  else { dTrack = min(a + 15.4, b + 15.4); dTrack = min(dTrack, min(95.4 - a, 95.4 - b)); }
  vec3 dirt = uDirt * (0.86 + 0.24 * gfbm(p * 0.9)) * (1.0 + (gn(p * 23.0) - 0.5) * 0.22 * fine);
  // 芝との境目は湿って濃い
  dirt *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.9, -dDirt));
  // 打席・マウンドの粘土
  float clay = max(1.0 - smoothstep(1.6, 2.6, length(p - vec2(0.0, -0.5))), 1.0 - smoothstep(0.5, 1.3, length(p - vec2(0.0, 18.2))));
  dirt = mix(dirt, uClay * (0.9 + 0.2 * gn(p * 11.0)), clay * 0.85);
  // 打席の足跡
  float hole = max(1.0 - smoothstep(0.0, 0.25, length(vec2(abs(p.x) - 0.95, (p.y + 0.15) * 0.8))), 1.0 - smoothstep(0.0, 0.3, length(vec2(p.x, (p.y - 17.2) * 0.7))));
  dirt *= 1.0 - hole * 0.18;
  col = mix(col, dirt, cov(dDirt));
  rough = mix(rough, 0.97, cov(dDirt));
  vec3 track = uTrack * (0.85 + 0.25 * gfbm(p * 1.3));
  col = mix(col, track, cov(dTrack));
  // ネクストバッターズサークル
  for (int s = 0; s < 2; s++) {
    vec2 oc = vec2(s == 0 ? -11.5 : 11.5, -6.5);
    float od = length(p - oc);
    col = mix(col, uClay * 0.75, cov(od - 0.8));
    col = mix(col, uLine, chalk(od - 0.8, 0.04) * 0.9);
  }
  // 白線
  float ln = 0.0;
  ln = max(ln, chalk(a, 0.045) * step(1.34, b) * step(b, 100.0));
  ln = max(ln, chalk(b, 0.045) * step(1.34, a) * step(a, 100.0));
  for (int s = 0; s < 2; s++) {
    float sx = s == 0 ? -1.0 : 1.0;
    float bd = boxd(p, vec2(sx * 0.99, 0.0), vec2(0.61, 0.95));
    ln = max(ln, chalk(bd, 0.04));
    ln = max(ln, chalk(segd(p, vec2(sx * 0.545, -0.95), vec2(sx * 0.545, -3.39)), 0.04));
  }
  ln = max(ln, chalk(segd(p, vec2(-0.545, -3.39), vec2(0.545, -3.39)), 0.04));
  // 一塁へのスリーフットライン
  ln = max(ln, chalk(segd(p, abxy(13.7, -0.91), abxy(27.431, -0.91)), 0.04));
  ln = max(ln, chalk(segd(p, abxy(13.7, -0.91), abxy(13.7, 0.0)), 0.04));
  // コーチャーズボックス
  ln = max(ln, chalk(boxd(vec2(a, b), vec2(25.0, -6.1), vec2(3.05, 1.52)), 0.035) * step(b, -4.4));
  ln = max(ln, chalk(boxd(vec2(a, b), vec2(-6.1, 25.0), vec2(1.52, 3.05)), 0.035) * step(a, -4.4));
  col = mix(col, uLine, ln * 0.92);
  rough = mix(rough, 0.75, ln);
  if (!inside) { col = uOut * (0.9 + 0.1 * gn(p * 0.5)); rough = 0.9; }
  diffuseColor.rgb = col;
  gRough = rough;
`;

  function groundMaterial(night) {
    const C = (s) => new T.Color(s);
    const uniforms = {
      uGrass: { value: C("#3d8f3a") },
      uGrass2: { value: C("#46993f") },
      uFoul: { value: C("#3b8838") },
      uDirt: { value: C("#b57a4b") },
      uClay: { value: C("#9a5a36") },
      uTrack: { value: C("#8c5a3c") },
      uLine: { value: C("#f4f4ec") },
      uOut: { value: C("#3a3d42") },
      uMow: { value: 0.75 },
    };
    const m = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = "varying vec2 vG;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vec4 gw = modelMatrix * vec4(transformed, 1.0); vG = vec2(gw.x, -gw.z);");
      sh.fragmentShader = GROUND_GLSL + sh.fragmentShader
        .replace("#include <map_fragment>", "float gRough = 0.9;\n" + GROUND_MAIN)
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = gRough;");
    };
    m.customProgramCacheKey = () => "pb-ground-v1";
    m.userData.uniforms = uniforms;
    return m;
  }

  /* ---------- 外周 (フィールドの境界) ---------- */
  function boundary() {
    const pts = [];
    for (let a = 45; a >= -45.0001; a -= 1.5) {
      const th = a * D2R;
      const r = F.fenceDist(th);
      pts.push({ x: r * Math.sin(th), y: r * Math.cos(th), h: F.FENCE_H, kind: "of", th });
    }
    const push = (x, y, kind, h) => pts.push({ x, y, h: h == null ? 1.2 : h, kind, th: Math.atan2(x, y) });
    // 左翼ポール → 三塁側の壁
    {
      const [x, y] = ab2xy(-0.6, 100);
      push(x, y, "sw", 1.2);
    }
    for (let b = 100; b > -4.33; b -= 5.2) {
      const [x, y] = ab2xy(-18, b);
      push(x, y, b > 99 ? "sw" : "side");
    }
    // 本塁後方の弧
    for (let ang = 225; ang <= 315.001; ang += 7.5) {
      const r = 13.67;
      push(r * Math.cos(ang * D2R), -6.13 + r * Math.sin(ang * D2R), "back");
    }
    for (let a = -4.33 + 5.2; a <= 100.001; a += 5.2) {
      const [x, y] = ab2xy(a, -18);
      push(x, y, "side");
    }
    {
      const [x, y] = ab2xy(100, -18);
      push(x, y, "sw");
      const [x2, y2] = ab2xy(100, -0.6);
      push(x2, y2, "sw");
    }
    // 弧長と外向きの法線 (閉じたループ, 反時計回り)
    const n = pts.length;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      const o = pts[(i - 1 + n) % n];
      p.s = s;
      s += Math.hypot(q.x - p.x, q.y - p.y);
      const e1 = norm2(p.x - o.x, p.y - o.y);
      const e2 = norm2(q.x - p.x, q.y - p.y);
      const n1 = [e1[1], -e1[0]];
      const n2 = [e2[1], -e2[0]];
      let m = norm2(n1[0] + n2[0], n1[1] + n2[1]);
      const c = Math.max(0.45, m[0] * n2[0] + m[1] * n2[1]);
      p.nx = m[0] / c;
      p.ny = m[1] / c;
    }
    pts.total = s;
    return pts;
  }
  function norm2(x, y) {
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }

  /* ---------- 組み立て ---------- */
  S3.build = function (o) {
    o = o || {};
    const home = o.home || null;
    const away = o.away || null;
    const park = Object.assign({}, S3.parkFor(home), o.park || {});
    const dome = o.dome != null ? o.dome : park.dome;
    const qual = o.quality || "mid";
    const group = new T.Group();
    group.name = "stadium";
    const disposables = [];
    const keep = (x) => (disposables.push(x), x);
    const st = { group, park, dome, night: o.night !== false, time: 0, exc: [0.15, 0.3, 0.3], excT: [0.15, 0.3, 0.3] };

    /* 地面 */
    const gmat = keep(groundMaterial());
    const ground = new T.Mesh(keep(new T.PlaneGeometry(420, 420, 1, 1)), gmat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -50);
    ground.receiveShadow = true;
    group.add(ground);
    // マウンド (同じシェーダーで土色になる)
    {
      const rings = 14;
      const segs = 48;
      const pos = [];
      const idx = [];
      const R = 2.78;
      const hAt = (d) => 0.254 * (1 - smooth(0.75, R, d)) + 0.004;
      for (let i = 0; i <= rings; i++) {
        const d = (i / rings) * R;
        for (let j = 0; j <= segs; j++) {
          const a = (j / segs) * Math.PI * 2;
          const x = d * Math.cos(a);
          const y = 17.98 + d * Math.sin(a);
          pos.push(x, hAt(d), -y);
        }
      }
      for (let i = 0; i < rings; i++)
        for (let j = 0; j < segs; j++) {
          const a = i * (segs + 1) + j;
          const b = a + segs + 1;
          idx.push(a, b, a + 1, a + 1, b, b + 1);
        }
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mound = new T.Mesh(g, gmat);
      mound.receiveShadow = true;
      group.add(mound);
      st.moundHeight = (x, y) => hAt(Math.hypot(x, y - 17.98));
    }
    /* ベース・本塁・プレート */
    const white = keep(new T.MeshStandardMaterial({ color: "#f7f7f2", roughness: 0.6 }));
    const black = keep(new T.MeshStandardMaterial({ color: "#1d1d1d", roughness: 0.8 }));
    {
      const bg = keep(new T.BoxGeometry(0.381, 0.08, 0.381));
      for (let i = 1; i <= 3; i++) {
        const m = new T.Mesh(bg, white);
        const [x, y] = F.BASES[i];
        m.position.copy(V(x, y, 0.04));
        m.rotation.y = Math.PI / 4;
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
      }
      const plate = (sc, h, mat) => {
        const sh = new T.Shape();
        const P5 = [
          [-0.216, 0],
          [0.216, 0],
          [0.216, -0.216],
          [0, -0.432],
          [-0.216, -0.216],
        ];
        // three の Shape は XY 平面 → X=x, Y=y として作り、あとで寝かせる
        P5.forEach(([x, y], i) => (i ? sh.lineTo(x * sc, y * sc) : sh.moveTo(x * sc, y * sc)));
        sh.closePath();
        const g = keep(new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false }));
        const m = new T.Mesh(g, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0;
        m.receiveShadow = true;
        group.add(m);
        return m;
      };
      plate(1.08, 0.012, black);
      plate(1.0, 0.02, white);
      const rub = new T.Mesh(keep(new T.BoxGeometry(0.61, 0.04, 0.152)), white);
      rub.position.copy(V(0, 18.44 + 0.076, 0.254 + 0.02));
      rub.receiveShadow = true;
      group.add(rub);
      // ロジンバッグ
      const ros = new T.Mesh(keep(new T.SphereGeometry(0.06, 10, 6)), white);
      ros.scale.set(1, 0.4, 0.8);
      ros.position.copy(V(0.6, 19.6, 0.2));
      group.add(ros);
    }

    /* 外周の壁 */
    const path = boundary();
    st.path = path;
    const ofPts = path.filter((p) => p.kind === "of");
    {
      // 外野フェンス
      // 弧長は左翼→右翼の向きに貼る (フィールドから見て文字が反転しないように)
      const total = ofPts[ofPts.length - 1].s;
      const tex = keep(fenceTexture(ofPts.map((p) => ({ s: total - p.s, th: p.th })).reverse(), park, total));
      const pos = [];
      const uv = [];
      const idx = [];
      ofPts.forEach((p, i) => {
        const u = 1 - p.s / total;
        pos.push(p.x, 0, -p.y, p.x, F.FENCE_H, -p.y);
        uv.push(u, 0, u, 1);
        if (i) {
          const a = (i - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new T.Mesh(g, keep(new T.MeshStandardMaterial({ map: tex, roughness: 0.85, side: T.DoubleSide })));
      m.receiveShadow = true;
      group.add(m);
    }
    {
      // 内野側・ポール際の低い壁
      const tex = keep(sideWallTexture(park));
      const pos = [];
      const uv = [];
      const idx = [];
      const lo = path.filter((p) => p.kind !== "of");
      const first = path[path.indexOf(ofPts[ofPts.length - 1])];
      const seq = [first].concat(lo).concat([path[0]]);
      let s = 0;
      seq.forEach((p, i) => {
        if (i) s += Math.hypot(p.x - seq[i - 1].x, p.y - seq[i - 1].y);
        const h = p.kind === "of" ? F.FENCE_H : 1.2;
        pos.push(p.x, 0, -p.y, p.x, h, -p.y);
        uv.push(-s / 48, 0, -s / 48, h / 1.2);
        if (i) {
          const a = (i - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      tex.wrapT = T.ClampToEdgeWrapping;
      const m = new T.Mesh(g, keep(new T.MeshStandardMaterial({ map: tex, roughness: 0.8, side: T.DoubleSide })));
      m.receiveShadow = true;
      group.add(m);
    }
    /* ダッグアウト (三塁側・一塁側) */
    {
      const dark = keep(new T.MeshBasicMaterial({ color: "#07090c" }));
      const trimH = keep(new T.MeshStandardMaterial({ color: home ? home.main : "#c8102e", roughness: 0.6 }));
      const trimA = keep(new T.MeshStandardMaterial({ color: away ? away.main : "#22406e", roughness: 0.6 }));
      const rail = keep(new T.MeshStandardMaterial({ color: "#d9dde3", roughness: 0.3, metalness: 0.6 }));
      for (const side of [-1, 1]) {
        // side=-1: 三塁側 (a=-18), +1: 一塁側 (b=-18)
        const p0 = side < 0 ? ab2xy(-17.95, 8) : ab2xy(8, -17.95);
        const p1 = side < 0 ? ab2xy(-17.95, 22) : ab2xy(22, -17.95);
        const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
        const g = new T.Group();
        g.position.copy(V(mid[0], mid[1], 0));
        g.rotation.y = ang;
        // ローカル +Z が三塁側ではフィールド向き、一塁側では外向き
        const fz = side < 0 ? 1 : -1;
        const openMat = dark.clone();
        openMat.side = T.DoubleSide;
        keep(openMat);
        const open = new T.Mesh(keep(new T.PlaneGeometry(len, 0.95)), openMat);
        open.position.set(0, 0.5, fz * 0.01);
        g.add(open);
        const roof = new T.Mesh(keep(new T.BoxGeometry(len, 0.22, 0.5)), side > 0 ? trimH : trimA);
        roof.position.set(0, 1.08, fz * 0.2);
        g.add(roof);
        const bar = new T.Mesh(keep(new T.CylinderGeometry(0.025, 0.025, len, 6)), rail);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, 0.95, fz * 0.3);
        g.add(bar);
        group.add(g);
      }
    }
    /* ポール */
    {
      const pm = keep(new T.MeshStandardMaterial({ color: "#f5d443", roughness: 0.4, emissive: "#3a3000" }));
      const pg = keep(new T.CylinderGeometry(0.16, 0.2, 30, 10));
      for (const p of [ofPts[0], ofPts[ofPts.length - 1]]) {
        const m = new T.Mesh(pg, pm);
        m.position.copy(V(p.x, p.y, 15));
        m.castShadow = true;
        group.add(m);
        const fin = new T.Mesh(keep(new T.PlaneGeometry(0.7, 26)), keep(new T.MeshStandardMaterial({ color: "#f5d443", transparent: true, opacity: 0.6, side: T.DoubleSide })));
        fin.position.copy(V(p.x * 1.004, p.y * 1.004, 16));
        fin.lookAt(V(0, 0, 16));
        fin.rotateY(Math.PI / 2);
        group.add(fin);
      }
    }

    /* スタンド (外周に沿った段々) */
    const seatCol = new T.Color(park.seat);
    const concrete = new T.Color("#5b5f66");
    const screenCol = new T.Color("#173d2b");
    const lower = { rows: 30, tread: 0.92, rise: 0.46 };
    const upper = { rows: 18, tread: 0.95, rise: 0.62, gap: 3.2, lift: 3.6 };
    const isScreen = (p) => p.kind === "of" && Math.abs(p.th) < 9.5 * D2R;
    const isUpper = (p) => p.kind === "side" || p.kind === "back";
    const crowdPos = [];
    const crowdUv = [];
    const crowdInfo = [];
    const crowdIdx = [];
    const standPos = [];
    const standCol = [];
    const standNrm = [];
    const standIdx = [];
    const screenPos = [];
    const screenCol2 = [];
    const screenNrm = [];
    const screenIdx = [];
    const R = rng(hashStr(park.seat + (home ? home.id : "")));
    const fill = o.fill == null ? 0.85 : o.fill;
    const groupOf = (p) => {
      // 0: 一般, 1: ホーム応援, 2: ビジター応援 (外野右翼=ホーム, 左翼=ビジター)
      if (p.kind === "of") return isScreen(p) ? -1 : p.x > 0 ? 1 : 2;
      if (p.kind === "sw") return p.x > 0 ? 1 : 2;
      return 0;
    };
    const pickBand = (grp, p) => {
      if (R() > fill) return 7;
      if (grp === 1) return R() < 0.85 ? 3 + Math.floor(R() * 2) : Math.floor(R() * 3);
      if (grp === 2) return R() < 0.8 ? 5 + Math.floor(R() * 2) : Math.floor(R() * 3);
      // 内野: 一塁側はホーム寄り, 三塁側はビジター寄り
      if (p.x > 6 && R() < 0.3) return 3 + Math.floor(R() * 2);
      if (p.x < -6 && R() < 0.3) return 5 + Math.floor(R() * 2);
      return Math.floor(R() * 3);
    };
    const quad = (arr, cols, nrms, idx, a, b, c, d, col, nrm) => {
      const base = arr.length / 3;
      for (const v of [a, b, c, d]) arr.push(v[0], v[1], v[2]);
      for (let i = 0; i < 4; i++) {
        cols.push(col.r, col.g, col.b);
        nrms.push(nrm[0], nrm[1], nrm[2]);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const tierInfo = []; // 各頂点の上段の位置 (照明塔・スコアボード用)
    function buildTiers(cfg, d0Of, z0Of, sel, upperDeck) {
      const n = path.length;
      for (let i = 0; i < n; i++) {
        const p = path[i];
        const q = path[(i + 1) % n];
        if (!sel(p) || !sel(q)) continue;
        const grp = groupOf(p);
        const scr = isScreen(p) || isScreen(q);
        if (scr && !upperDeck) {
          // バックスクリーン: 段々の代わりに傾斜した無地のパネル
          const P = (pp, d, z) => [pp.x + pp.nx * d, z, -(pp.y + pp.ny * d)];
          const dT = cfg.rows * cfg.tread;
          const zp0 = z0Of(p);
          const zq0 = z0Of(q);
          const zT = cfg.rows * cfg.rise + 2.4;
          const nrm = [-p.nx * 0.5, 0.86, p.ny * 0.5];
          quad(screenPos, screenCol2, screenNrm, screenIdx, P(p, 0, zp0), P(q, 0, zq0), P(q, dT, zq0 + zT), P(p, dT, zp0 + zT), screenCol, nrm);
          tierInfo[i] = { d: dT, z: zp0 + cfg.rows * cfg.rise };
          continue;
        }
        for (let k = 0; k < cfg.rows; k++) {
          const dp = d0Of(p) + k * cfg.tread;
          const dq = d0Of(q) + k * cfg.tread;
          const zp = z0Of(p) + k * cfg.rise;
          const zq = z0Of(q) + k * cfg.rise;
          const P = (pp, d, z) => [pp.x + pp.nx * d, z, -(pp.y + pp.ny * d)];
          const c1 = scr ? screenCol : seatCol.clone().multiplyScalar(0.55 + 0.1 * (k % 2));
          const c2 = scr ? screenCol : concrete;
          // 踏み面
          quad(standPos, standCol, standNrm, standIdx, P(p, dp, zp), P(q, dq, zq), P(q, dq + cfg.tread, zq), P(p, dp + cfg.tread, zp), c1, [0, 1, 0]);
          // 蹴上げ
          quad(standPos, standCol, standNrm, standIdx, P(p, dp + cfg.tread, zp), P(q, dq + cfg.tread, zq), P(q, dq + cfg.tread, zq + cfg.rise), P(p, dp + cfg.tread, zp + cfg.rise), c2, [-p.nx, 0, p.ny]);
          // 観客
          if (!scr && grp >= 0) {
            const band = pickBand(grp, p);
            const off = 0.55 * cfg.tread;
            const ch = 1.15;
            const base = crowdPos.length / 3;
            const A = P(p, dp + off, zp - 0.05);
            const B = P(q, dq + off, zq - 0.05);
            crowdPos.push(A[0], A[1], A[2], B[0], B[1], B[2], B[0], B[1] + ch, B[2], A[0], A[1] + ch, A[2]);
            const u0 = p.s / BAND_LEN + k * 0.37;
            const u1 = u0 + Math.hypot(q.x - p.x, q.y - p.y) / BAND_LEN;
            crowdUv.push(u0, 0, u1, 0, u1, 1, u0, 1);
            const seed = R();
            for (let v = 0; v < 4; v++) crowdInfo.push(band, grp, seed);
            crowdIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
        // 最上段の奥の壁
        const dTop = (pp) => d0Of(pp) + cfg.rows * cfg.tread;
        const zTop = (pp) => z0Of(pp) + cfg.rows * cfg.rise;
        const P = (pp, d, z) => [pp.x + pp.nx * d, z, -(pp.y + pp.ny * d)];
        quad(standPos, standCol, standNrm, standIdx, P(p, dTop(p), zTop(p)), P(q, dTop(q), zTop(q)), P(q, dTop(q), zTop(q) + (upperDeck ? 3.5 : 2.4)), P(p, dTop(p), zTop(p) + (upperDeck ? 3.5 : 2.4)), concrete.clone().multiplyScalar(0.7), [-p.nx, 0, p.ny]);
        if (!upperDeck) tierInfo[i] = { d: dTop(p), z: zTop(p) };
      }
    }
    const lowerD0 = () => 0;
    const lowerZ0 = (p) => (p.kind === "of" ? F.FENCE_H : 1.2);
    buildTiers(lower, lowerD0, lowerZ0, () => true, false);
    const upD0 = (p) => lower.rows * lower.tread + upper.gap;
    const upZ0 = (p) => lowerZ0(p) + lower.rows * lower.rise + upper.lift;
    buildTiers(upper, upD0, upZ0, isUpper, true);
    {
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(standPos, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(standNrm, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(standCol, 3));
      g.setIndex(standIdx);
      const m = new T.Mesh(g, keep(new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })));
      m.receiveShadow = qual === "high";
      group.add(m);
    }
    {
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(screenPos, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(screenNrm, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(screenCol2, 3));
      g.setIndex(screenIdx);
      const m = new T.Mesh(g, keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide })));
      m.receiveShadow = true;
      group.add(m);
    }
    // 上段の手すり壁 (LED リボンボード)
    {
      const tex = keep(sideWallTexture(Object.assign({}, park, { wall: "#0c0f14", seat: park.seat + "r" })));
      const pos = [];
      const uv = [];
      const idx = [];
      let s = 0;
      let prev = null;
      const sel = path.filter(isUpper);
      sel.forEach((p, i) => {
        const d = lower.rows * lower.tread + upper.gap - 0.1;
        const z0 = lowerZ0(p) + lower.rows * lower.rise + 0.4;
        const x = p.x + p.nx * d;
        const y = p.y + p.ny * d;
        if (prev) s += Math.hypot(x - prev[0], y - prev[1]);
        prev = [x, y];
        pos.push(x, z0, -y, x, z0 + upper.lift - 0.4, -y);
        uv.push(-s / 48, 0, -s / 48, 1);
        if (i) {
          const a = (i - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      const m = new T.Mesh(g, keep(new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, toneMapped: false })));
      st.ribbon = m;
      group.add(m);
    }
    // 観客
    {
      const atlas = keep(crowdAtlas(park, home, away));
      const g = keep(new T.BufferGeometry());
      g.setAttribute("position", new T.Float32BufferAttribute(crowdPos, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(crowdUv, 2));
      g.setAttribute("aInfo", new T.Float32BufferAttribute(crowdInfo, 3));
      g.setIndex(crowdIdx);
      const mat = keep(new T.MeshBasicMaterial({ map: atlas, alphaTest: 0.5, side: T.DoubleSide }));
      const cu = { uTime: { value: 0 }, uExc: { value: new T.Vector3(0.1, 0.2, 0.2) } };
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, cu);
        sh.vertexShader = "attribute vec3 aInfo;\nvarying vec3 vInfo;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n vInfo = aInfo;");
        sh.fragmentShader =
          "uniform float uTime;\nuniform vec3 uExc;\nvarying vec3 vInfo;\n" +
          sh.fragmentShader.replace(
            "#include <map_fragment>",
            `
            float person = floor(vMapUv.x * ${PEOPLE_PER_BAND}.0);
            float hh = fract(sin(person * 12.9898 + vInfo.z * 78.233) * 43758.5453);
            float ex = vInfo.y < 0.5 ? uExc.x : (vInfo.y < 1.5 ? uExc.y : uExc.z);
            float jump = ex * max(0.0, sin(uTime * (6.5 + hh * 4.0) + hh * 6.2832)) * 0.2;
            float ly = vMapUv.y - jump;
            if (ly < 0.0) discard;
            vec4 sampledDiffuseColor = texture2D(map, vec2(vMapUv.x, (7.0 - vInfo.x + min(ly, 0.995)) / 8.0));
            diffuseColor *= sampledDiffuseColor;
            `
          );
      };
      mat.customProgramCacheKey = () => "pb-crowd-v1";
      const m = new T.Mesh(g, mat);
      st.crowd = { mesh: m, uniforms: cu, mat };
      group.add(m);
    }

    /* バックスクリーンとスコアボード */
    {
      const cf = ofPts.reduce((b, p) => (Math.abs(p.th) < Math.abs(b.th) ? p : b), ofPts[0]);
      const ti = tierInfo[path.indexOf(cf)] || { d: 28, z: 17 };
      const d = ti.d + 4;
      const bw = 44;
      const bh = 19.5;
      const x = cf.x + cf.nx * d;
      const y = cf.y + cf.ny * d;
      const z0 = ti.z + 1.5;
      const back = new T.Mesh(keep(new T.BoxGeometry(bw + 2, bh + 2, 1.6)), keep(new T.MeshStandardMaterial({ color: "#15181d", roughness: 0.7 })));
      back.position.copy(V(x, y + 0.9, z0 + bh / 2));
      group.add(back);
      // 支柱
      for (const sx of [-0.35, 0.35]) {
        const leg = new T.Mesh(keep(new T.BoxGeometry(2, z0, 2)), back.material);
        leg.position.copy(V(x + sx * bw, y + 1, z0 / 2));
        group.add(leg);
      }
      const board = makeBoard(home, away);
      keep(board.tex);
      const face = new T.Mesh(keep(new T.PlaneGeometry(bw, bh)), keep(new T.MeshBasicMaterial({ map: board.tex, toneMapped: false })));
      face.position.copy(V(x, y - 0.02, z0 + bh / 2));
      group.add(face);
      st.board = board;
      // 球場名の看板
      const nameTex = keep(
        canvasTex(1024, 96, (ctx, w, h) => {
          ctx.fillStyle = home ? home.main : "#c8102e";
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = home ? home.sub || "#fff" : "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const nm = (home && home.stadium) || o.name || "POCKET STADIUM";
          fitText(ctx, nm, w * 0.92, 64, "900 %spx 'Dela Gothic One', 'M PLUS Rounded 1c', sans-serif");
          ctx.fillText(nm, w / 2, h / 2 + 2);
        })
      );
      const sign = new T.Mesh(keep(new T.PlaneGeometry(bw, 4.2)), keep(new T.MeshBasicMaterial({ map: nameTex, toneMapped: false })));
      sign.position.copy(V(x, y - 0.03, z0 + bh + 3.2));
      group.add(sign);
      st.boardPos = [x, y, z0 + bh / 2];
    }

    /* 照明・屋根・空 */
    const lights = {};
    lights.hemi = new T.HemisphereLight("#9fb4d8", "#2c3b24", 0.8);
    lights.key = new T.DirectionalLight("#fff3e0", 2.4);
    lights.key.castShadow = qual !== "low";
    const sm = qual === "high" ? 2048 : 1024;
    lights.key.shadow.mapSize.set(sm, sm);
    lights.key.shadow.bias = -0.0004;
    lights.key.shadow.normalBias = 0.03;
    lights.key.shadow.camera.near = 1;
    lights.key.shadow.camera.far = 400;
    lights.fill = new T.DirectionalLight("#cfe0ff", 0.5);
    group.add(lights.hemi, lights.key, lights.key.target, lights.fill, lights.fill.target);
    st.lights = lights;

    const towers = [];
    if (!dome) {
      // 照明塔
      const lampTex = keep(lampTexture());
      const glowTex = keep(glowTexture());
      const poleMat = keep(new T.MeshStandardMaterial({ color: "#8d96a3", roughness: 0.5, metalness: 0.5 }));
      const lampMat = keep(new T.MeshBasicMaterial({ map: lampTex, toneMapped: false }));
      const frameMat = keep(new T.MeshStandardMaterial({ color: "#3a3f47", roughness: 0.6 }));
      const center = [0, 45];
      for (const deg of [-150, -105, -50, 50, 105, 150]) {
        // 中心から見た方向に一番近い外周点
        const want = deg * D2R;
        let best = null;
        let bd = 1e9;
        path.forEach((p, i) => {
          const a = Math.atan2(p.x - center[0], p.y - center[1]);
          const d = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        const p = path[best];
        const up = isUpper(p);
        const dd = up ? lower.rows * lower.tread + upper.gap + upper.rows * upper.tread + 2 : (tierInfo[best] ? tierInfo[best].d : 28) + 2;
        const zb = up ? upZ0(p) + upper.rows * upper.rise : tierInfo[best] ? tierInfo[best].z : 16;
        const x = p.x + p.nx * dd;
        const y = p.y + p.ny * dd;
        const hgt = 30;
        const pole = new T.Mesh(keep(new T.CylinderGeometry(0.45, 0.8, zb + hgt, 8)), poleMat);
        pole.position.copy(V(x, y, (zb + hgt) / 2));
        group.add(pole);
        const bank = new T.Group();
        bank.position.copy(V(x, y, zb + hgt + 3));
        const frame = new T.Mesh(keep(new T.BoxGeometry(14, 8, 0.8)), frameMat);
        bank.add(frame);
        const face = new T.Mesh(keep(new T.PlaneGeometry(13.4, 7.4)), lampMat);
        face.position.z = 0.42;
        bank.add(face);
        bank.lookAt(V(0, 40, 0));
        group.add(bank);
        const glow = new T.Sprite(keep(new T.SpriteMaterial({ map: glowTex, color: "#fff6dc", transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false })));
        glow.scale.set(60, 60, 1);
        glow.position.copy(bank.position).add(new T.Vector3(0, 0, 0).subVectors(V(0, 40, 0), bank.position).normalize().multiplyScalar(2));
        group.add(glow);
        towers.push({ bank, glow, face });
      }
    }
    st.towers = towers;

    // 空
    let sky = null;
    if (!dome) {
      const sm2 = keep(
        new T.ShaderMaterial({
          side: T.BackSide,
          depthWrite: false,
          uniforms: { uNight: { value: 1 }, uTime: { value: 0 } },
          vertexShader: "varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }",
          fragmentShader: `
            uniform float uNight; uniform float uTime; varying vec3 vD;
            float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
            float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
              return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                         mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
            void main(){
              float y = clamp(vD.y, -0.2, 1.0);
              vec3 dayTop = vec3(0.18, 0.42, 0.85); vec3 dayHz = vec3(0.70, 0.84, 0.96);
              vec3 nTop = vec3(0.008, 0.016, 0.05); vec3 nHz = vec3(0.10, 0.14, 0.24);
              float k = pow(max(0.0, y), 0.45);
              vec3 day = mix(dayHz, dayTop, k);
              vec3 nit = mix(nHz, nTop, k);
              // 雲
              float c = n3(vD * 6.0 + vec3(uTime * 0.01, 0.0, 0.0)) * 0.6 + n3(vD * 13.0) * 0.4;
              c = smoothstep(0.55, 0.85, c) * smoothstep(0.02, 0.25, y);
              day = mix(day, vec3(0.97), c * 0.75);
              nit = mix(nit, vec3(0.16, 0.18, 0.24), c * 0.35);
              // 星
              vec3 sd = floor(vD * 220.0);
              float s = step(0.9965, h(sd)) * smoothstep(0.1, 0.4, y) * (0.6 + 0.4 * sin(uTime * 3.0 + h(sd + 7.0) * 30.0));
              nit += vec3(s);
              vec3 col = mix(day, nit, uNight);
              gl_FragColor = vec4(col, 1.0);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        })
      );
      sky = new T.Mesh(keep(new T.SphereGeometry(1500, 32, 16)), sm2);
      sky.renderOrder = -10;
      sky.frustumCulled = false;
      group.add(sky);
      if (park.skyline !== false) {
        const sk = keep(skylineTexture(hashStr(park.seat)));
        sk.repeat.set(3, 1);
        const cyl = new T.Mesh(keep(new T.CylinderGeometry(700, 700, 120, 48, 1, true)), keep(new T.MeshBasicMaterial({ map: sk, transparent: true, side: T.BackSide, depthWrite: false, fog: false })));
        cyl.position.set(0, 50, -50);
        cyl.renderOrder = -9;
        group.add(cyl);
        st.skyline = cyl;
      }
    } else {
      // ドーム屋根 (内側から見る)
      const rTex = keep(
        canvasTex(1024, 512, (ctx, w, h) => {
          ctx.fillStyle = park.roof || "#e6e6e0";
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = "rgba(90,90,90,0.55)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 48; i++) {
            const x = (i / 48) * w;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let j = 1; j < 9; j++) {
            const y = (j / 9) * h;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "rgba(255,255,255,0.25)");
          g.addColorStop(1, "rgba(0,0,0,0.25)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        })
      );
      const lTex = keep(
        canvasTex(1024, 512, (ctx, w, h) => {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, w, h);
          for (const ring of [0.42, 0.62]) {
            for (let i = 0; i < 96; i++) {
              const x = ((i + 0.5) / 96) * w;
              const y = ring * h;
              const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
              g.addColorStop(0, "#ffffff");
              g.addColorStop(1, "rgba(255,250,230,0)");
              ctx.fillStyle = g;
              ctx.fillRect(x - 8, y - 8, 16, 16);
            }
          }
        })
      );
      const R0 = 240;
      const zc = -160;
      const g = keep(new T.SphereGeometry(R0, 64, 20, 0, Math.PI * 2, 0, Math.acos(-zc / R0 * 0.999) ));
      const m = new T.Mesh(g, keep(new T.MeshLambertMaterial({ map: rTex, emissiveMap: lTex, emissive: "#ffffff", emissiveIntensity: 1.4, side: T.BackSide })));
      m.position.set(0, zc, -48);
      group.add(m);
      st.roof = m;
    }

    /* 霧 (遠景のかすみ) */
    st.fog = new T.Fog(dome ? "#1c2230" : "#0a1428", 260, 1400);

    /* 状態の切り替え */
    st.setNight = function (night) {
      st.night = !!night;
      const N = dome ? false : st.night;
      if (sky) sky.material.uniforms.uNight.value = N ? 1 : 0;
      if (st.skyline) st.skyline.material.opacity = N ? 1 : 0.55;
      for (const t of towers) t.glow.visible = N;
      lights.hemi.color.set(dome ? "#f4f1ea" : N ? "#9fb0d0" : "#cfe4ff");
      lights.hemi.groundColor.set(dome ? "#4a4a3a" : N ? "#28361f" : "#4f5f2c");
      lights.hemi.intensity = dome ? 1.25 : N ? 0.85 : 1.0;
      lights.key.color.set(N ? "#fff1dc" : dome ? "#fffaf0" : "#fff2d6");
      lights.key.intensity = dome ? 1.7 : N ? 2.3 : 3.0;
      lights.fill.intensity = dome ? 0.6 : N ? 0.55 : 0.35;
      st.keyDir = dome ? V(-10, -30, 120).normalize() : N ? V(-35, -70, 120).normalize() : V(70, 20, 85).normalize();
      st.fillDir = V(30, 160, 60).normalize();
      st.fog.color.set(dome ? "#2a2f3a" : N ? "#0d1830" : "#b9d3ee");
      st.crowd.mat.color.setScalar(dome ? 0.95 : N ? 0.82 : 1.0);
      if (st.ribbon) st.ribbon.visible = true;
      st.exposure = dome ? 1.05 : N ? 1.1 : 0.95;
    };
    st.setNight(st.night);

    // 影を落とす範囲 (ゲーム座標の中心と半径)
    st.focusShadow = function (cx, cy, rad) {
      const L = lights.key;
      const tgt = V(cx, cy, 0);
      L.target.position.copy(tgt);
      L.position.copy(tgt).addScaledVector(st.keyDir, 200);
      const c = L.shadow.camera;
      c.left = -rad;
      c.right = rad;
      c.top = rad;
      c.bottom = -rad;
      c.updateProjectionMatrix();
      lights.fill.target.position.copy(tgt);
      lights.fill.position.copy(tgt).addScaledVector(st.fillDir, 200);
    };
    st.focusShadow(0, 30, 70);

    // 観客の盛り上がり (0..1) — neutral, home, away
    st.setExcite = function (n, h, a) {
      st.excT = [n, h, a];
    };
    st.update = function (dt) {
      st.time += dt;
      const k = 1 - Math.exp(-dt * 2.5);
      for (let i = 0; i < 3; i++) st.exc[i] += (st.excT[i] - st.exc[i]) * k;
      st.crowd.uniforms.uTime.value = st.time;
      st.crowd.uniforms.uExc.value.set(st.exc[0], st.exc[1], st.exc[2]);
      if (sky) sky.material.uniforms.uTime.value = st.time;
      if (st.ribbon) st.ribbon.material.map.offset.x = (st.time * 0.02) % 1;
    };
    st.dispose = function () {
      for (const d of disposables) if (d && d.dispose) d.dispose();
    };
    return st;
  };

  function smooth(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /* ---------- スコアボード ---------- */
  function makeBoard(home, away) {
    const W = 1024;
    const H = 456;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const board = { tex, last: "" };
    const LED = "'DotGothic16', 'M PLUS Rounded 1c', monospace";
    board.draw = function (info) {
      info = info || {};
      const key = JSON.stringify(info);
      if (key === board.last) return;
      board.last = key;
      ctx.fillStyle = "#06090d";
      ctx.fillRect(0, 0, W, H);
      // LED のドット感
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
      const A = info.away || { short: away ? away.short : "VIS", lineup: [] };
      const Hm = info.home || { short: home ? home.short : "HOME", lineup: [] };
      const col = (t, fallback) => (t && t.main) || fallback;
      // 両チームの打順 (左: ビジター, 右: ホーム)
      const lineup = (team, x, color, sideKey) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, 10, 250, 34);
        ctx.fillStyle = "#fff";
        ctx.font = "700 24px " + LED;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(team.short || "", x + 125, 28);
        ctx.textAlign = "left";
        const L = team.lineup || [];
        for (let i = 0; i < 9; i++) {
          const e = L[i];
          const y = 62 + i * 31;
          const cur = info.batSide === sideKey && info.batIdx === i;
          if (cur) {
            ctx.fillStyle = "rgba(255,210,63,0.22)";
            ctx.fillRect(x, y - 14, 250, 29);
          }
          ctx.fillStyle = cur ? "#ffe25c" : "#e9e3c8";
          ctx.font = "400 22px " + LED;
          ctx.fillText(String(i + 1), x + 6, y + 1);
          if (e) {
            ctx.fillStyle = "#9ad9ff";
            ctx.fillText(e.pos || "", x + 30, y + 1);
            ctx.fillStyle = cur ? "#ffe25c" : "#f4f1e4";
            fitText(ctx, e.name || "", 170, 22, "400 %spx " + LED);
            ctx.fillText(e.name || "", x + 74, y + 1);
          }
        }
      };
      lineup(A, 10, col(away, "#22406e"), "away");
      lineup(Hm, W - 260, col(home, "#c8102e"), "home");
      // ラインスコア
      const x0 = 280;
      const cw = 36;
      const inns = Math.max(9, (info.innings || []).length || 0);
      const n = Math.min(12, inns);
      ctx.font = "400 20px " + LED;
      ctx.textAlign = "center";
      ctx.fillStyle = "#9ad9ff";
      for (let i = 0; i < n; i++) ctx.fillText(String(i + 1), x0 + 70 + i * cw * (9 / n), 30);
      ctx.fillText("R", x0 + 70 + 9 * cw + 6, 30);
      ctx.fillText("H", x0 + 70 + 10 * cw + 6, 30);
      ctx.fillText("E", x0 + 70 + 11 * cw + 6, 30);
      const row = (t, y, k) => {
        ctx.textAlign = "left";
        ctx.fillStyle = "#f4f1e4";
        fitText(ctx, t.short || "", 64, 22, "700 %spx " + LED);
        ctx.fillText(t.short || "", x0, y);
        ctx.textAlign = "center";
        ctx.font = "400 24px " + LED;
        const runs = (info.line && info.line[k]) || [];
        for (let i = 0; i < n; i++) {
          const v = runs[i];
          ctx.fillStyle = v == null ? "#3a3f46" : "#ffe25c";
          ctx.fillText(v == null ? "" : String(v), x0 + 70 + i * cw * (9 / n), y);
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillText(String(t.R != null ? t.R : 0), x0 + 70 + 9 * cw + 6, y);
        ctx.fillText(String(t.H != null ? t.H : 0), x0 + 70 + 10 * cw + 6, y);
        ctx.fillText(String(t.E != null ? t.E : 0), x0 + 70 + 11 * cw + 6, y);
      };
      row(A, 66, "away");
      row(Hm, 102, "home");
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x0, 120, 450, 2);
      // BSO
      const lamp = (label, nOn, max, y, color) => {
        ctx.textAlign = "left";
        ctx.fillStyle = "#e9e3c8";
        ctx.font = "700 26px " + LED;
        ctx.fillText(label, x0 + 6, y);
        for (let i = 0; i < max; i++) {
          ctx.fillStyle = i < nOn ? color : "#262a30";
          ctx.beginPath();
          ctx.arc(x0 + 56 + i * 34, y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      lamp("B", info.b || 0, 3, 156, "#3fd35a");
      lamp("S", info.s || 0, 2, 194, "#ffd23f");
      lamp("O", info.o || 0, 2, 232, "#ff4d4d");
      // 回
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe25c";
      ctx.font = "700 30px " + LED;
      if (info.inning) ctx.fillText(info.inning + "回" + (info.top ? "表" : "裏"), x0 + 330, 160);
      // 球速
      if (info.speed) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 54px " + LED;
        ctx.fillText(String(info.speed), x0 + 320, 214);
        ctx.font = "400 20px " + LED;
        ctx.fillText("km/h", x0 + 410, 222);
        if (info.pitch) {
          ctx.fillStyle = "#9ad9ff";
          ctx.font = "400 22px " + LED;
          ctx.fillText(info.pitch, x0 + 320, 252);
        }
      }
      // 打者
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x0, 268, 450, 2);
      if (info.batter) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#9ad9ff";
        ctx.font = "400 22px " + LED;
        ctx.fillText("BATTER", x0 + 6, 296);
        ctx.fillStyle = "#ffffff";
        fitText(ctx, info.batter, 300, 34, "700 %spx " + LED);
        ctx.fillText(info.batter, x0 + 110, 298);
        if (info.batLine) {
          ctx.fillStyle = "#e9e3c8";
          ctx.font = "400 22px " + LED;
          ctx.fillText(info.batLine, x0 + 6, 334);
        }
      }
      if (info.pitcher) {
        ctx.textAlign = "left";
        ctx.fillStyle = "#9ad9ff";
        ctx.font = "400 22px " + LED;
        ctx.fillText("PITCHER", x0 + 6, 372);
        ctx.fillStyle = "#ffffff";
        fitText(ctx, info.pitcher, 300, 28, "700 %spx " + LED);
        ctx.fillText(info.pitcher, x0 + 120, 373);
        if (info.pitLine) {
          ctx.fillStyle = "#e9e3c8";
          ctx.font = "400 22px " + LED;
          ctx.fillText(info.pitLine, x0 + 6, 408);
        }
      }
      if (info.msg) {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, H / 2 - 70, W, 140);
        ctx.fillStyle = "#ffe25c";
        ctx.textAlign = "center";
        fitText(ctx, info.msg, W * 0.9, 96, "700 %spx " + LED);
        ctx.fillText(info.msg, W / 2, H / 2 + 4);
      }
      tex.needsUpdate = true;
    };
    board.draw({});
    return board;
  }

  PB.Stadium3D = S3;
})((window.PB = window.PB || {}));
