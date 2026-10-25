// 時間と天気の描画 (owner: R7-C): weather icons, the HUD's clock panel, and the town maps' sky — the day / night tint
// (a translucent wash), lit windows and street lamps at night, rain / snow / typhoon particles and lightning. Called by clock.js
// (which owns the state); this file only draws what it is given, so it never imports clock.js.
//
// exports: drawWeatherIcon(ctx, kind, x, y, size = 16, night = false), skyOverlay(min, sun, kind) → { r, g, b, a, dark },
//   drawSky(ctx, map, g, s) (world units, inside MapScene#drawWorld), drawClockPanel(ctx, x, y, w, h, s)

import { TILE, VIEW_W, VIEW_H, makeCanvas, clamp, hash2 } from './util.js';
import { text, measure, panel } from './draw.js';
import { drawBuilding } from './buildings.js';

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

// ---------------------------------------------------------------- weather icons (16 x 16 art, cached)
const ICONS = new Map();
function px(c, x, y, s, col) { c.fillStyle = col; c.fillRect(x * s, y * s, s, s); }
function blob(c, s, parts, fill, edge) {
  // a cloud: union of discs + a flat bottom, with a 1-px outline
  const inside = (x, y, grow) => parts.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= (r + grow) ** 2) || (y >= 9 - grow && y <= 12 + grow && x >= 3 - grow && x <= 13 + grow);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (inside(x, y, 0)) px(c, x, y, s, fill);
    else if (inside(x, y, 1)) px(c, x, y, s, edge);
  }
}
const CLOUD = [[6, 8, 3], [9.5, 6.5, 3.6], [12, 9, 2.6]];
function paintIcon(c, kind, s, night) {
  if (kind === 'sunny' && night) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const a = (x - 7.5) ** 2 + (y - 8) ** 2, b = (x - 10.5) ** 2 + (y - 5.5) ** 2;
      if (a <= 30 && b > 22) px(c, x, y, s, a > 22 ? '#c8a830' : '#fff0a0');
    }
    px(c, 13, 11, s, '#fff6c8'); px(c, 2, 3, s, '#fff6c8'); px(c, 14, 2, s, '#c8ccf0');
    return;
  }
  if (kind === 'sunny') {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      for (const d of [6, 7]) px(c, Math.round(7.5 + Math.cos(a) * d), Math.round(7.5 + Math.sin(a) * d), s, '#ffb020');
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = (x - 7.5) ** 2 + (y - 7.5) ** 2;
      if (d <= 17) px(c, x, y, s, d > 11 ? '#f08a10' : d < 4 ? '#fff6b0' : '#ffd23f');
    }
    return;
  }
  if (kind === 'typhoon') {
    for (let arm = 0; arm < 2; arm++) for (let t = 0; t < 4 * Math.PI; t += 0.06) {
      const r = 1.2 + t * 0.52;
      const x = Math.round(7.5 + Math.cos(t + arm * Math.PI) * r), y = Math.round(7.5 + Math.sin(t + arm * Math.PI) * r * 0.9);
      if (x >= 0 && x < 16 && y >= 0 && y < 16) px(c, x, y, s, arm ? '#9ad0ff' : '#3a8ae8');
    }
    px(c, 7, 7, s, '#ffffff'); px(c, 8, 8, s, '#ffffff');
    return;
  }
  const dark = kind === 'heavyrain' || kind === 'storm';
  if (kind === 'cloudy') {
    // a small sun (or moon) peeking behind
    if (!night) for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const d = (x - 4) ** 2 + (y - 4) ** 2; if (d <= 10) px(c, x, y, s, d > 6 ? '#f08a10' : '#ffd23f'); }
  }
  blob(c, s, CLOUD.map(([x, y, r]) => [x, y - (kind === 'cloudy' ? 0 : 2), r]), dark ? '#7c8496' : kind === 'cloudy' ? '#eef1f6' : '#c8ceda', dark ? '#40465a' : '#6a7288');
  if (kind === 'rain' || kind === 'heavyrain') {
    const drops = kind === 'rain' ? [[5, 12], [9, 13], [12, 12]] : [[3, 12], [6, 13], [9, 12], [12, 13], [5, 15], [11, 15]];
    for (const [x, y] of drops) { px(c, x, y, s, '#3a8ae8'); px(c, x - 1, y + 1, s, '#3a8ae8'); if (y + 2 < 16) px(c, x - 1, y + 2, s, '#8ac4ff'); }
  } else if (kind === 'snow') {
    for (const [x, y] of [[5, 12], [10, 13], [13, 11]]) {
      px(c, x, y, s, '#ffffff'); px(c, x - 1, y, s, '#c8e4ff'); px(c, x + 1, y, s, '#c8e4ff'); px(c, x, y - 1, s, '#c8e4ff'); if (y + 1 < 16) px(c, x, y + 1, s, '#c8e4ff');
    }
  } else if (kind === 'storm') {
    for (const [x, y] of [[8, 9], [7, 10], [6, 11], [7, 11], [8, 11], [9, 11], [8, 12], [7, 13], [6, 14], [5, 15]]) px(c, x, y, s, '#ffd23f');
    for (const [x, y] of [[12, 12], [11, 13], [3, 12], [2, 13]]) px(c, x, y, s, '#3a8ae8');
  }
}
// Draws the icon (screen px; size 16 or 32 …) at x, y. night: a clear sky shows the moon.
export function drawWeatherIcon(ctx, kind, x, y, size = 16, night = false) {
  const s = Math.max(1, Math.round(size / 16));
  const key = `${kind}|${s}|${night ? 1 : 0}`;
  let cv = ICONS.get(key);
  if (!cv) {
    const [c, cx] = makeCanvas(16 * s, 16 * s);
    try { paintIcon(cx, kind, s, night); } catch (e) { console.error(e); }
    ICONS.set(key, c);
    cv = c;
  }
  ctx.drawImage(cv, Math.round(x), Math.round(y), 16 * s, 16 * s);
}

// ---------------------------------------------------------------- the sky over a town
// The time of day as one translucent wash over the picture (source-over: cheap even without a GPU), key frames
// around sunrise / sunset: [r, g, b, alpha]. The weather adds its own wash (grey clouds, white snow haze).
const K0 = {
  late: [4, 6, 30, 0.7], night: [6, 10, 44, 0.64], dawn: [110, 80, 140, 0.3], morning: [255, 228, 186, 0.08], day: [255, 255, 255, 0],
  golden: [255, 186, 90, 0.16], sunset: [255, 118, 40, 0.32], dusk: [56, 36, 104, 0.48],
};
const KW = { sunny: null, cloudy: [96, 104, 124, 0.12], rain: [60, 70, 92, 0.28], heavyrain: [42, 50, 70, 0.4], storm: [42, 50, 70, 0.4], typhoon: [36, 44, 64, 0.46], snow: [226, 234, 248, 0.16] };
// min: minutes since the day's midnight (24:00+ = after midnight); sun: { rise, set }; kind: the weather now
// → { r, g, b, a (the wash), dark (0..1: how dark it is, for the lights) }
export function skyOverlay(min, sun, kind) {
  const m = ((min % 1440) + 1440) % 1440;
  const { rise, set } = sun;
  const K = [[0, K0.late], [rise - 70, K0.late], [rise - 15, K0.dawn], [rise + 45, K0.morning], [rise + 170, K0.day], [set - 110, K0.day], [set - 50, K0.golden], [set, K0.sunset], [set + 35, K0.dusk], [set + 80, K0.night], [1380, K0.night], [1440, K0.late]];
  let f = K0.day;
  for (let i = 0; i < K.length - 1; i++) {
    const [a, fa] = K[i], [b, fb] = K[i + 1];
    if (m >= a && m < b) {
      const t = b > a ? (m - a) / (b - a) : 0;
      // interpolate premultiplied, so a colour fading in or out does not flash
      const A = fa[3] + (fb[3] - fa[3]) * t;
      f = A > 0 ? [0, 1, 2].map((j) => (fa[j] * fa[3] + (fb[j] * fb[3] - fa[j] * fa[3]) * t) / A).concat(A) : [255, 255, 255, 0];
      break;
    }
  }
  let [r, g, b, a] = f;
  const w = KW[kind];
  if (w) {
    // two washes (time, then weather) as one: a = 1 - (1 - a1)(1 - a2)
    const a2 = w[3] * (1 - Math.min(0.6, a)); // the weather shows less once it is already dark
    const A = 1 - (1 - a) * (1 - a2);
    if (A > 0) { r = (r * a * (1 - a2) + w[0] * a2) / A; g = (g * a * (1 - a2) + w[1] * a2) / A; b = (b * a * (1 - a2) + w[2] * a2) / A; }
    a = A;
  }
  const dark = clamp(f[3] * (f[0] + f[1] + f[2] < 300 ? 1.6 : 0.6) + (w && w[0] < 200 ? w[3] * 0.8 : 0), 0, 1);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: clamp(a, 0, 0.85), dark };
}

// lamp glow sprites (a soft disc and a pool of light on the ground), built once
let GLOW = null;
function glowSprites() {
  if (GLOW) return GLOW;
  const mk = (w, h, fn) => { const [c, x] = makeCanvas(w, h); fn(x, w, h); return c; };
  const halo = mk(64, 64, (x, w) => {
    const gr = x.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,236,170,0.95)'); gr.addColorStop(0.25, 'rgba(255,210,120,0.45)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
    x.fillStyle = gr; x.fillRect(0, 0, w, w);
  });
  const pool = mk(96, 32, (x, w, h) => {
    x.save(); x.scale(1, h / w);
    const gr = x.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
    x.fillStyle = gr; x.fillRect(0, 0, w, w); x.restore();
  });
  GLOW = { halo, pool };
  return GLOW;
}
// Street lamps of a room (tile ids; the head's position in the tile, units), found once per built room.
const LAMP_HEAD = { lamp: [8, 3], minato_lantern: [8, 5], lantern: [8, 6] };
const LAMPS = new WeakMap();
function lampsOf(room) {
  let L = LAMPS.get(room);
  if (L) return L;
  L = [];
  for (let y = 0; y < room.h; y++) for (let x = 0; x < room.w; x++) {
    for (const id of room.cells[y][x]) if (LAMP_HEAD[id]) { L.push([x, y, ...LAMP_HEAD[id]]); break; }
  }
  LAMPS.set(room, L);
  return L;
}
// Lit windows: each building's look is painted once (1 px per unit) and its glass turned into warm lights — rectangles
// (runs merged down the rows), so drawing them is a few fillRects. Shops, stations and theatres are lit all over;
// homes and offices window by window (about 6 in 10). Yellow bulbs and lit signs stay lit. One building a frame.
const LIGHTS = new WeakMap();
const SHOPLIKE = /shop|konbini|convenience|super|station|theater|small|restaurant|famires|ramen|cafe|coffee|karaoke|arcade|bath|salon|hair|beauty|gym|fitness|flower|florist|cake|bakery|book|boutique|realestate|furniture/;
let lightFrame = -1;
function lightsOf(b, frame) {
  let L = LIGHTS.get(b);
  if (L) return L;
  if (lightFrame === frame) return null;
  lightFrame = frame;
  L = { win: [], bulb: [] };
  LIGHTS.set(b, L);
  try {
    const rise = Math.max(0, b.rise ?? 6);
    const ml = 16, mt = 96 + rise * TILE, W = b.w * TILE + ml * 2, H = b.h * TILE + mt + 12;
    const [, c] = makeCanvas(W, H);
    drawBuilding(c, b, ml, mt, 0);
    const d = c.getImageData(0, 0, W, H).data;
    const seed = (b.x * 73856093) ^ (b.y * 19349663);
    // glass: light blue pixels in flat colours (a colour used by fewer than 8 pixels is a logo's or a sign's
    // anti-aliasing, not a window)
    const key = new Int32Array(W * H).fill(-1);
    const count = new Map();
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      if (d[i + 3] >= 160 && bl >= 165 && bl > r + 22 && g > r && g >= 135) { const k = (r << 16) | (g << 8) | bl; key[p] = k; count.set(k, (count.get(k) || 0) + 1); }
    }
    const allLit = SHOPLIKE.test(String(b.kind || ''));
    const cls = new Uint8Array(W * H); // 1 window light, 2 bulb
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      if (d[i + 3] < 160) continue;
      if (key[p] >= 0 && count.get(key[p]) >= 8) { if (allLit || hash2(Math.floor(x / 32), Math.floor((y + 4) / 22), seed) <= 0.62) cls[p] = 1; }
      else if (d[i] > 235 && d[i + 1] > 195 && d[i + 2] < 175) cls[p] = 2;
    }
    // a window pane is split by its glints: light each pane's whole box (when the box is mostly glass)
    const seen = new Uint8Array(W * H), fill = new Uint8Array(W * H), stack = [];
    for (let p0 = 0; p0 < W * H; p0++) {
      if (cls[p0] !== 1 || seen[p0]) continue;
      let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
      const comp = [];
      stack.push(p0); seen[p0] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % W, y = (p - x) / W;
        comp.push(p); n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (cls[q] === 1 && !seen[q]) { seen[q] = 1; stack.push(q); }
        }
      }
      const box = (x1 - x0 + 1) * (y1 - y0 + 1);
      if (box <= n * 2.5 && box <= 900) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] >= 160 && cls[y * W + x] !== 2) fill[y * W + x] = 1; }
      else for (const p of comp) fill[p] = 1;
    }
    for (let p = 0; p < W * H; p++) if (cls[p] === 1 && !fill[p]) cls[p] = 0; else if (fill[p]) cls[p] = 1;
    // runs per row, merged with the identical run of the row above → rectangles
    for (const [kind, out] of [[1, L.win], [2, L.bulb]]) {
      let open = new Map();
      for (let y = 0; y <= H; y++) {
        const next = new Map();
        if (y < H) {
          for (let x = 0; x < W; x++) {
            if (cls[y * W + x] !== kind) continue;
            let e = x;
            while (e + 1 < W && cls[y * W + e + 1] === kind) e++;
            const k = x * 4096 + e;
            const r = open.get(k);
            if (r) { r[3]++; next.set(k, r); open.delete(k); } else { const nr = [x - ml, y - mt, e - x + 1, 1]; next.set(k, nr); out.push(nr); }
            x = e;
          }
        }
        open = next;
      }
    }
  } catch (e) { console.error(e); }
  return L;
}

// Rain / snow / wind particles over the view (world units), driven by the frame counter only.
function drawParticles(ctx, g, kind, cam, dark) {
  const f = g.frame;
  const wetRain = kind === 'rain' || kind === 'heavyrain' || kind === 'storm' || kind === 'typhoon';
  if (wetRain) {
    const n = kind === 'rain' ? 70 : kind === 'typhoon' ? 170 : 130;
    const slant = kind === 'typhoon' ? 0.75 : kind === 'rain' ? 0.18 : 0.3;
    const sp = kind === 'rain' ? 4.2 : 5.2;
    ctx.fillStyle = dark > 0.35 ? 'rgba(190,205,240,0.5)' : 'rgba(225,235,255,0.6)';
    const H = VIEW_H + 24, W = VIEW_W + 40;
    for (let i = 0; i < n; i++) {
      const s = sp * (0.8 + hash2(i, 3, 5) * 0.5);
      const y = ((hash2(i, 1, 5) * H + f * s) % H) - 12;
      const x = ((((hash2(i, 2, 5) * W - f * s * slant - cam.x * 0.4) % W) + W) % W) - 20;
      const len = 4 + hash2(i, 4, 5) * 3;
      ctx.fillRect(x, y, 0.5, len * 0.5);
      ctx.fillRect(x - slant * len * 0.5, y + len * 0.5, 0.5, len * 0.5);
    }
    // splashes on the ground
    ctx.fillStyle = 'rgba(225,235,255,0.55)';
    for (let i = 0; i < (kind === 'rain' ? 14 : 26); i++) {
      const life = (f + i * 7) % 18;
      if (life > 5) continue;
      const k = Math.floor((f + i * 7) / 18);
      const x = hash2(i, k, 11) * VIEW_W, y = hash2(i, k, 12) * VIEW_H;
      ctx.fillRect(x - 1, y, 0.5, 0.5); ctx.fillRect(x + 1, y, 0.5, 0.5); ctx.fillRect(x, y - 0.5, 0.5, 0.5);
    }
    if (kind === 'typhoon') {
      ctx.fillStyle = 'rgba(230,236,250,0.22)';
      for (let i = 0; i < 18; i++) {
        const y = hash2(i, 7, 5) * VIEW_H;
        const x = (((hash2(i, 8, 5) * (VIEW_W + 120) - f * 9) % (VIEW_W + 120)) + VIEW_W + 120) % (VIEW_W + 120) - 60;
        ctx.fillRect(x, y, 26 + hash2(i, 9, 5) * 30, 0.5);
      }
    }
  } else if (kind === 'snow') {
    const n = 120;
    for (let i = 0; i < n; i++) {
      const s = 0.35 + hash2(i, 3, 6) * 0.35;
      const H = VIEW_H + 10;
      const y = ((hash2(i, 1, 6) * H + f * s) % H) - 5;
      const x = ((((hash2(i, 2, 6) * VIEW_W + Math.sin((f + i * 37) / 40) * 4 - cam.x * 0.3) % VIEW_W) + VIEW_W) % VIEW_W);
      const big = hash2(i, 4, 6) > 0.6;
      ctx.fillStyle = big ? 'rgba(255,255,255,0.95)' : 'rgba(240,246,255,0.85)';
      ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    }
  }
}

// s: { min, sun, kind, nightOnly (place already drawn at night: no tint, no lights), outdoor }
export function drawSky(ctx, map, g, s) {
  const cam = map.cam;
  const o = s.nightOnly ? { r: 0, g: 0, b: 0, a: 0, dark: 0 } : skyOverlay(s.min, s.sun, s.kind);
  if (!s.noTint && o.a > 0.004) {
    ctx.fillStyle = `rgba(${o.r},${o.g},${o.b},${o.a.toFixed(3)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const lit = s.nightOnly ? 0 : clamp((o.dark - 0.12) / 0.5, 0, 1);
  if (lit > 0.02) {
    ctx.save();
    // lit windows (buildings on screen)
    if (!s.noLights) {
      const wins = [], bulbs = [];
      for (const e of map.entities) {
        if (e.type !== 'building' || (e.cond && !map.visible(e))) continue;
        const bx = e.x * TILE - cam.x, by = e.y * TILE - cam.y;
        if (bx > VIEW_W + 16 || bx + e.w * TILE < -16 || by - 200 > VIEW_H || by + e.h * TILE < -8) continue;
        const L = lightsOf(e, g.frame);
        if (L) { wins.push([bx, by, L.win]); bulbs.push([bx, by, L.bulb]); }
      }
      ctx.globalAlpha = lit * 0.85;
      ctx.fillStyle = '#ffd27a';
      for (const [bx, by, rs] of wins) for (const r of rs) ctx.fillRect(bx + r[0], by + r[1], r[2], r[3]);
      ctx.globalAlpha = lit;
      ctx.fillStyle = '#fff2a0';
      for (const [bx, by, rs] of bulbs) for (const r of rs) ctx.fillRect(bx + r[0], by + r[1], r[2], r[3]);
    }
    // street lamps: a halo around the head and a pool of light on the ground
    const G = glowSprites();
    ctx.globalCompositeOperation = 'lighter';
    if (!s.noLamps) for (const [x, y, hx, hy] of lampsOf(map.room)) {
      const sx = x * TILE - cam.x + hx, sy = y * TILE - cam.y + hy;
      if (sx < -40 || sx > VIEW_W + 40 || sy < -40 || sy > VIEW_H + 60) continue;
      ctx.globalAlpha = lit * 0.75;
      ctx.drawImage(G.pool, sx - 24, y * TILE - cam.y + 10, 48, 16);
      ctx.globalAlpha = lit * (0.85 + 0.15 * Math.sin((g.frame + x * 17) / 23));
      ctx.drawImage(G.halo, sx - 14, sy - 14, 28, 28);
    }
    ctx.restore();
  }
  if (s.kind && s.kind !== 'sunny' && s.kind !== 'cloudy') drawParticles(ctx, g, s.kind, cam, o.dark);
  // lightning: now and then a white flash
  if (s.kind === 'storm' || s.kind === 'typhoon') {
    const k = Math.floor(g.frame / 260), ph = g.frame % 260;
    if (hash2(k, 1, 77) < (s.kind === 'storm' ? 0.45 : 0.2) && (ph < 3 || (ph > 6 && ph < 9))) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

// ---------------------------------------------------------------- the HUD panel (screen px)
// s: { date '4月7日', label '晴れ', kind, night, time '07:30', phase '朝', temp 18, late, tag ('+1:30' | null), tagA 0..1 }
export function drawClockPanel(ctx, x, y, w, h, s, frame = 0) {
  panel(ctx, x, y, w, h, { bg: 'rgba(18,26,58,0.88)' });
  const L = x + 10, Rx = x + w - 9;
  text(ctx, s.date, L, y + 5, { size: 12, color: '#cfd6ff' });
  // weather: icon + label at the right of the first row (the label is dropped when it does not fit)
  const dw = measure(ctx, s.date, 12);
  const lw = measure(ctx, s.label, 12);
  const room = Rx - (L + dw + 6);
  const showLabel = room >= 16 + 2 + lw;
  const ix = showLabel ? Rx - lw - 18 : Rx - 16;
  drawWeatherIcon(ctx, s.kind, ix, y + 3, 16, s.night);
  if (showLabel) text(ctx, s.label, Rx, y + 5, { size: 12, align: 'right', color: '#ffffff' });
  // the time (red after midnight), then the phase (or what just passed) and the temperature
  const blink = s.late && Math.floor(frame / 40) % 2 === 0;
  text(ctx, s.time, L, y + 21, { size: 14, color: s.late ? (blink ? '#ff5d6c' : '#ffb4b4') : '#ffffff' });
  const tx = L + measure(ctx, s.time, 14) + 6;
  if (s.tag && s.tagA > 0) {
    ctx.globalAlpha = clamp(s.tagA, 0, 1);
    text(ctx, s.tag, tx, y + 23, { size: 12, color: '#ffd23f' });
    ctx.globalAlpha = 1;
  } else text(ctx, s.phase, tx, y + 23, { size: 12, color: s.late ? '#ffb4b4' : '#9aa3c7' });
  // the temperature (hidden while a long "+n時間" tag needs the room)
  const tagW = s.tag && s.tagA > 0 ? measure(ctx, s.tag, 12) : 0;
  if (Number.isFinite(s.temp) && tx + tagW + 6 + measure(ctx, `${s.temp}℃`, 12) <= Rx) text(ctx, `${s.temp}℃`, Rx, y + 23, { size: 12, align: 'right', color: s.temp >= 33 ? '#ff9a5a' : s.temp <= 3 ? '#9ad0ff' : '#cfd6ff' });
}
