// Reusable multi-tile props for maps. Each returns an entity definition.
//   { type: 'prop', x, y, w, h, draw(ctx, sx, sy, g, e) }
//
// The map draws props in world units under a 2x transform. Static art is
// painted once at 2x (one canvas pixel = half a unit = one screen pixel) and
// cached; animated bits are drawn each frame with half-unit coordinates.

import { makeCanvas, shade } from '../engine/util.js';
import { R as PR, P as PP, oval, outline, inset, dither } from '../engine/tiles.js';
import { scale2x } from '../engine/hdify.js';

// Unit-space rect (no rounding: 0.5 = one screen pixel). Animated values must be
// snapped with hu() first, or fillRect anti-aliases them into blended pixels.
const R = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const hu = (v) => Math.round(v * 2) / 2; // snap to the half-unit (screen pixel) grid

// Cached 2x painting: `paint(c)` draws on a (w*2) x (h*2) canvas; the result is
// drawn at (sx + ox, sy + oy) with size w x h units.
const baked = new Map();
function bake(key, w, h, paint) {
  let cv = baked.get(key);
  if (!cv) {
    const [c2, c] = makeCanvas(w * 2, h * 2);
    paint(c);
    cv = c2;
    baked.set(key, cv);
  }
  return cv;
}
function blit(ctx, cv, x, y) { ctx.drawImage(cv, x, y, cv.width / 2, cv.height / 2); }

// ---------------------------------------------------------------- fountain
// 3x2 tiles. Canvas covers x 0..48, y -14..32 (units).
function paintFountain(c) {
  const Y = (u) => (u + 14) * 2; // unit y -> canvas px
  // basin: rim (top surface), water, front face with stone blocks
  PR(c, 4, Y(6), 88, Y(30) - Y(6), '#c9ccd4');
  for (const [x, y] of [[4, Y(6)], [91, Y(6)], [4, Y(30) - 1], [91, Y(30) - 1]]) c.clearRect(x, y, 1, 1);
  PR(c, 5, Y(6), 86, 1, '#eef0f4'); PR(c, 4, Y(6) + 1, 1, 34, '#dfe2e8');
  PR(c, 4, Y(24), 88, Y(30) - Y(24), '#8e929c');
  PR(c, 4, Y(24), 88, 1, '#a9adb7'); PR(c, 4, Y(30) - 2, 88, 2, '#6d717b');
  for (let x = 4; x < 92; x += 16) { PR(c, x + 15, Y(24) + 1, 1, 10, '#787c86'); PR(c, x, Y(24) + 1, 1, 10, '#a3a7b1'); }
  // water
  PR(c, 9, Y(8), 78, Y(23) - Y(8), '#3d7fd1');
  PR(c, 9, Y(8), 78, 3, '#2f6ab8'); PR(c, 9, Y(8) + 3, 3, Y(23) - Y(8) - 3, '#3674c2');
  PR(c, 9, Y(23) - 2, 78, 2, '#5f9fe6');
  dither(c, 12, Y(8) + 3, 74, 2, '#3674c2');
  PR(c, 8, Y(8) - 1, 80, 1, '#a9adb7'); PR(c, 8, Y(8), 1, Y(23) - Y(8), '#a9adb7');
  PR(c, 87, Y(8), 1, Y(23) - Y(8), '#e4e7ec'); PR(c, 8, Y(23), 80, 1, '#e4e7ec');
  // central column with an upper bowl
  oval(c, 36, Y(17), 24, 9, '#2f6ab8');
  PR(c, 42, Y(4), 12, Y(18) - Y(4), '#c9ccd4');
  PR(c, 42, Y(4), 2, Y(18) - Y(4), '#e4e7ec'); PR(c, 51, Y(4), 3, Y(18) - Y(4), '#9aa0aa');
  PR(c, 40, Y(16), 16, 4, '#b8bcc6'); PR(c, 40, Y(16), 16, 1, '#dfe2e8');
  oval(c, 32, Y(-1), 32, 11, '#9aa0aa'); oval(c, 32, Y(-1) - 1, 32, 9, '#c9ccd4');
  oval(c, 35, Y(-1), 26, 6, '#3d7fd1'); PR(c, 38, Y(-1) + 1, 20, 1, '#2f6ab8');
  PR(c, 44, Y(-4), 8, Y(-1) - Y(-4) + 2, '#c9ccd4'); PR(c, 44, Y(-4), 2, 6, '#e4e7ec'); PR(c, 50, Y(-4), 2, 6, '#9aa0aa');
  oval(c, 43, Y(-5), 10, 4, '#dfe2e8');
  outline(c, { tint: 0.3 });
}
export function fountain(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 3, h: 2,
    text: '噴水だ。水しぶきがキラキラしている。',
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('fountain', 48, 46, paintFountain), sx, sy - 14);
      const f = g.frame;
      // ripples drifting across the basin
      for (let i = 0; i < 8; i++) {
        const k = (f / 7 + i * 5) % 30;
        const dx = 6 + ((i * 11 + Math.floor(f / 40)) % 36), dy = 9 + (k % 13);
        if (dx + 2 > 20.5 && dx < 27.5 && dy < 19) continue; // behind the central column
        const px = sx + dx, py = hu(sy + dy);
        R(ctx, px, py, 2, 0.5, '#8cc2f5'); R(ctx, px + 0.5, py - 0.5, 1, 0.5, '#d4ebff');
      }
      // rings where the falling water lands
      const t = (f % 40) / 40;
      for (const [cx, cy] of [[sx + 19, sy + 17.5], [sx + 29, sy + 17.5]]) {
        const rw = hu(1 + t * 3);
        R(ctx, cx - rw, cy, rw * 2, 0.5, t < 0.6 ? '#bfe6ff' : '#8cc2f5');
      }
      // jet: a central column plus arcs of drops falling back into the bowl
      const h = 5 + Math.round(Math.sin(f / 8) * 2 * 2) / 2;
      R(ctx, sx + 23, sy - 5 - h, 2, h + 1, '#bfe6ff'); R(ctx, sx + 23.5, sy - 5 - h, 0.5, h, '#ffffff');
      R(ctx, sx + 22.5, sy - 5.5 - h, 3, 1, '#e8f6ff');
      for (let i = 0; i < 6; i++) {
        const p = ((f / 30 + i / 6) % 1), side = i % 2 ? 1 : -1;
        const dx = side * (1 + p * 7), dy = -h - 4 + p * p * 10 + p * 2;
        R(ctx, hu(sx + 23.5 + dx), hu(sy + dy - 1), 1, 1, p < 0.5 ? '#ffffff' : '#bfe6ff');
      }
      // sparkles on the basin water
      if (Math.floor(f / 18) % 3 === 0) { R(ctx, sx + 9, sy + 11, 0.5, 0.5, '#ffffff'); R(ctx, sx + 37, sy + 21, 0.5, 0.5, '#ffffff'); }
    },
    ...extra,
  };
}

// ---------------------------------------------------------------- shinkansen
// 10x2 tiles; the nose sticks out 11 units past the right edge.
function paintShinkansen(c) {
  const W = 320; // body length in px (160 units)
  const body = '#f4f6fa', blue = '#2f5fd0';
  // underframe and bogies
  PR(c, 6, 50, W - 8, 6, '#20232a');
  for (let b = 30; b < W - 20; b += 100) { PR(c, b, 52, 28, 4, '#3b3f48'); for (const k of [3, 19]) { oval(c, b + k, 51, 7, 6, '#4a4e58'); PP(c, b + k + 2, 52, '#7d8391'); } }
  // body
  PR(c, 4, 8, W - 4, 42, body);
  PR(c, 4, 8, W - 4, 2, '#ffffff'); PR(c, 4, 10, W - 4, 3, '#e4e8ef');
  PR(c, 4, 36, W - 4, 5, blue); PR(c, 4, 42, W - 4, 1, blue); PR(c, 4, 36, W - 4, 1, '#5f86e6');
  PR(c, 4, 44, W - 4, 6, '#c3c8d2'); PR(c, 4, 44, W - 4, 1, '#dfe3ea'); PR(c, 4, 49, W - 4, 1, '#9aa0aa');
  PR(c, 4, 8, 2, 42, '#dfe3ea');
  // windows
  for (let x = 16; x < W - 20; x += 20) {
    PR(c, x, 18, 14, 10, '#3b4a6a'); PR(c, x, 18, 14, 1, '#2a3550'); PR(c, x + 1, 19, 3, 2, '#8fa4c8'); PR(c, x + 1, 27, 13, 1, '#d5d9e0');
  }
  // doors
  for (let d = 60; d < W - 20; d += 100) {
    PR(c, d, 16, 12, 26, '#d5d9e0'); PR(c, d, 16, 12, 1, '#b8bcc6'); PR(c, d, 16, 1, 26, '#b8bcc6'); PR(c, d + 11, 16, 1, 26, '#9aa0aa');
    PR(c, d + 3, 19, 6, 8, '#3b4a6a'); PR(c, d + 3, 19, 2, 2, '#8fa4c8'); PR(c, d + 1, 36, 10, 5, '#d5d9e0');
  }
  // streamlined nose
  for (let x = W; x < W + 24; x++) {
    const t = (x - W) / 23;
    const top = 8 + Math.round(30 * Math.pow(t, 1.5)), bot = 50 - Math.round(5 * t * t);
    PR(c, x, top, 1, bot - top, body);
    PR(c, x, top, 1, 1, '#ffffff');
    if (bot > 36) PR(c, x, Math.max(top, 36), 1, Math.max(0, Math.min(5, bot - Math.max(top, 36))), blue);
    if (bot > 44) PR(c, x, Math.max(top, 44), 1, bot - Math.max(top, 44), '#c3c8d2');
  }
  PR(c, W + 2, 14, 12, 8, '#20232a'); PR(c, W + 2, 14, 12, 1, '#3b4a6a'); PR(c, W + 3, 15, 4, 1, '#5a6a8a');
  for (let k = 0; k < 6; k++) PR(c, W + 2 + 12 + k, 16 + k * 2, 1, 6 - k, k < 5 ? '#20232a' : body);
  PR(c, W + 18, 40, 3, 2, '#fff6a8'); PP(c, W + 18, 40, '#ffffff');
  outline(c, { tint: 0.3 });
}
export function train(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 10, h: 2,
    text: '新幹線がホームに停まっている。駅から乗れるぞ。',
    draw(ctx, sx, sy) { blit(ctx, bake('shinkansen', 172, 30, paintShinkansen), sx, sy); },
    ...extra,
  };
}

// ---------------------------------------------------------------- commuter train
// Two-car commuter train (silver body, orange stripe, flat front) for local stations.
function paintCommuter(c) {
  for (const [x0, len] of [[4, 154], [164, 152]]) {
    const x1 = x0, x2 = x0 + len;
    PR(c, x1, 52, len, 4, '#20232a');
    for (const b of [x1 + 14, x2 - 34]) { PR(c, b, 52, 20, 4, '#3b3f48'); for (const k of [2, 12]) { oval(c, b + k, 51, 6, 6, '#4a4e58'); PP(c, b + k + 2, 52, '#7d8391'); } }
    PR(c, x1, 6, len, 46, '#9aa0aa');
    PR(c, x1 + 2, 8, len - 4, 42, '#e8eaee');
    PR(c, x1 + 2, 8, len - 4, 2, '#ffffff'); PR(c, x1 + 2, 10, 2, 40, '#f4f6fa');
    PR(c, x1 + 2, 32, len - 4, 6, '#ff8a3d'); PR(c, x1 + 2, 32, len - 4, 1, '#ffb070'); PR(c, x1 + 2, 38, len - 4, 2, '#d62f2f');
    PR(c, x1 + 2, 44, len - 4, 6, '#c3c8d2'); PR(c, x1 + 2, 44, len - 4, 1, '#dfe3ea');
    for (let d = 16; d < len - 16; d += 44) {
      const dx = x1 + d;
      PR(c, dx, 12, 16, 38, '#b8bcc6'); PR(c, dx, 12, 16, 1, '#9aa0aa'); PR(c, dx + 8, 12, 1, 38, '#8e929c');
      for (const k of [2, 10]) { PR(c, dx + k, 16, 4, 12, '#3b4a6a'); PR(c, dx + k, 16, 2, 2, '#8fa4c8'); }
      if (d + 40 < len - 12) for (const k of [22, 32]) { PR(c, dx + k, 16, 8, 12, '#3b4a6a'); PR(c, dx + k, 16, 8, 1, '#2a3550'); PR(c, dx + k + 1, 17, 2, 3, '#8fa4c8'); }
    }
  }
  // gangway between the cars
  PR(c, 158, 14, 6, 32, '#4a4e58'); PR(c, 158, 14, 6, 1, '#6b707c');
  for (let y = 16; y < 46; y += 3) PR(c, 158, y, 6, 1, '#3b3f48');
  // flat front with headlights and a destination sign
  PR(c, 312, 6, 6, 46, '#9aa0aa'); PR(c, 316, 6, 2, 46, '#7d8391');
  PR(c, 300, 12, 12, 6, '#20232a'); PR(c, 302, 14, 8, 2, '#ffb03a'); PR(c, 302, 14, 3, 1, '#ffe0a0');
  PR(c, 308, 40, 4, 4, '#fff6a8'); PP(c, 308, 40, '#ffffff');
  outline(c, { tint: 0.3 });
}
export function commuterTrain(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 10, h: 2,
    text: '電車がホームに停まっている。駅から乗れるぞ。',
    draw(ctx, sx, sy) { blit(ctx, bake('commuter', 160, 30, paintCommuter), sx, sy); },
    ...extra,
  };
}

// ---------------------------------------------------------------- taxi
// 2x1 tiles, side view facing right. Canvas covers y -2..16 (units).
function paintTaxi(color) {
  return (c) => {
    const hi = shade(color, 0.35), mid = shade(color, 0.15), lo = shade(color, -0.25), dk = shade(color, -0.45);
    // cabin (trapezoid) with windows
    for (let y = 4; y < 14; y++) { const k = Math.round((13 - y) * 0.6); PR(c, 15 + k, y, 31 - k * 2 + 2, 1, color); }
    PR(c, 18, 4, 26, 1, hi);
    for (let y = 6; y < 13; y++) { const k = Math.round((13 - y) * 0.6); PR(c, 18 + k, y, 11 - k, 1, '#8fd0ff'); PR(c, 32, y, 11 - k, 1, '#8fd0ff'); }
    PR(c, 30, 5, 2, 9, color); PR(c, 20, 7, 2, 2, '#d8f0ff'); PR(c, 33, 7, 2, 2, '#d8f0ff');
    // roof sign
    PR(c, 26, 0, 10, 4, '#ffffff'); PR(c, 26, 3, 10, 1, '#d5d9e0'); PR(c, 28, 1, 6, 1, '#d62f2f');
    // body
    PR(c, 4, 13, 56, 14, color);
    PR(c, 4, 13, 56, 2, hi); PR(c, 4, 15, 56, 1, mid);
    PR(c, 4, 20, 56, 2, '#20232a');
    PR(c, 4, 24, 56, 3, lo);
    PR(c, 30, 15, 1, 9, lo); PR(c, 44, 15, 1, 9, lo);
    PR(c, 26, 17, 3, 1, dk); PR(c, 40, 17, 3, 1, dk);
    PR(c, 56, 15, 4, 3, '#fff6a8'); PR(c, 4, 15, 2, 3, '#ff5d6c');
    PR(c, 2, 24, 4, 3, '#9aa0aa'); PR(c, 58, 24, 4, 3, '#9aa0aa');
    // wheels
    for (const cx of [15, 49]) {
      oval(c, cx - 6, 21, 12, 12, '#20232a');
      oval(c, cx - 3, 24, 6, 6, '#9aa0aa'); PP(c, cx - 2, 25, '#e4e7ec'); PP(c, cx, 27, '#5a5f6b');
    }
    outline(c, { tint: 0.25 });
  };
}
export function taxi(x, y, color = '#ffd23f', extra = {}) {
  return {
    type: 'prop', x, y, w: 2, h: 1,
    text: 'タクシーが客待ちをしている。',
    draw(ctx, sx, sy) {
      R(ctx, sx + 2, sy + 14, 28, 2, 'rgba(0,0,0,0.25)');
      R(ctx, sx + 3, sy + 13.5, 26, 0.5, 'rgba(0,0,0,0.15)');
      blit(ctx, bake('taxi' + color, 32, 18, paintTaxi(color)), sx, sy - 2);
    },
    ...extra,
  };
}

// ---------------------------------------------------------------- bus stop
// 1x1 tile with the sign above it. Canvas covers y -7..16 (units).
const BUS = ['.########.', '#..#..#..#', '#..#..#..#', '##########', '##########', '.##....##.'];
function paintBusStop(c) {
  // base, pole, timetable
  PR(c, 9, 42, 14, 4, '#5a5f6b'); PR(c, 9, 42, 14, 1, '#7d8391');
  PR(c, 14, 20, 4, 23, '#9aa0aa'); PR(c, 14, 20, 1, 23, '#d5d9e0'); PR(c, 17, 20, 1, 23, '#6d7380');
  PR(c, 10, 24, 12, 10, '#f4f4f4'); PR(c, 10, 24, 12, 2, '#2f6fd0');
  for (let y = 27; y < 33; y += 2) PR(c, 11, y, 9, 1, '#9aa0aa');
  // round-cornered sign
  PR(c, 5, 2, 22, 20, '#2f6fd0'); PR(c, 6, 1, 20, 1, '#2f6fd0'); PR(c, 6, 22, 20, 1, '#2f6fd0');
  PR(c, 6, 2, 20, 1, '#5f8fe6');
  PR(c, 8, 5, 16, 14, '#ffffff');
  pix(c, BUS, '#2f6fd0', 11, 8);
  PR(c, 8, 18, 16, 1, '#d5d9e0');
  outline(c, { tint: 0.25 });
}
function pix(c, rows, col, ox, oy) { rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') PP(c, ox + x, oy + y, col); }); }
export function busStop(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    text: 'バス停だ。時刻表を見ると…次のバスはしばらく来ないみたい。',
    draw(ctx, sx, sy) {
      R(ctx, sx + 4, sy + 15, 8, 1, 'rgba(0,0,0,0.22)');
      blit(ctx, bake('busstop', 16, 23, paintBusStop), sx, sy - 7);
    },
    ...extra,
  };
}

// ---------------------------------------------------------------- street stage
// Small outdoor stage (w tiles wide, 2 tall) used for street performances.
// The canvas has a 1px (half-unit) margin left, right and below so the outline
// pass can close the silhouette on every side.
function paintStage(w) {
  return (c) => {
    const W = w * 32;
    c.save();
    c.translate(1, 0);
    // front skirt with lamp sockets
    PR(c, 0, 48, W, 12, '#5a3a20'); PR(c, 0, 48, W, 1, '#3a2512');
    for (let x = 0; x < W; x += 16) { PR(c, x, 49, 1, 11, '#4a2e18'); PR(c, x + 1, 49, 1, 11, '#6e4a2a'); }
    for (let i = 8; i < W; i += 16) { PR(c, i - 1, 53, 6, 6, '#2a1a0e'); }
    PR(c, 0, 59, W, 1, '#3a2512');
    // deck boards
    PR(c, 0, 8, W, 40, '#ddb06e');
    for (let x = 0; x < W; x += 8) {
      PR(c, x, 8, 1, 40, '#ecc488'); PR(c, x + 7, 8, 1, 40, '#b88a4c');
      PR(c, x + 3, 12 + ((x * 7) % 20), 1, 6, '#d2a462'); PR(c, x + 5, 24 + ((x * 13) % 16), 1, 5, '#d2a462');
    }
    PR(c, 0, 8, W, 1, '#f0ca90'); PR(c, 0, 9, W, 1, '#ecc488');
    PR(c, 0, 44, W, 2, '#c49a5c'); PR(c, 0, 46, W, 2, '#3a2512');
    c.restore();
    outline(c, { tint: 0.3 });
  };
}
export function streetStage(x, y, w = 4, extra = {}) {
  return {
    type: 'prop', x, y, w, h: 2, solid: false,
    draw(ctx, sx, sy, g) {
      blit(ctx, bake('stage' + w, w * 16 + 1, 30.5, paintStage(w)), sx - 0.5, sy);
      for (let i = 4; i < w * 16; i += 8) {
        const on = Math.floor(g.frame / 20 + i) % 2;
        R(ctx, sx + i, sy + 27, 2, 2, on ? '#fff6a8' : '#ff9a3c');
        R(ctx, sx + i, sy + 27, 1, 0.5, on ? '#ffffff' : '#ffc070');
      }
    },
    ...extra,
  };
}

// ---------------------------------------------------------------- statue
// Bronze statue of a smiling figure with both arms raised, on a stone pedestal.
const STATUE = [
  '.bb...hhhh...bb.',
  '.bb..hhbbbb..bb.',
  '..bb.hdbbdb.bb..',
  '..bb.bbbbbb.bb..',
  '..bb.bdbbdb.bb..',
  '...bb.bddb.bb...',
  '...bb..bb..bb...',
  '...bhbbbbbbbb...',
  '....hbbbbbbb....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hbbbbb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '.....hb..bb.....',
  '....bbb..bbb....',
];
// The 1x figure is EPX-smoothed to 2x, then re-lit (bronze highlights on the
// upper-left edges, shadow on the lower-right) and outlined.
function paintStatue(c) {
  // canvas covers units x -1..17, y -12..16; figure top = unit -11
  const [fc, f] = makeCanvas(16, STATUE.length);
  const COL = { b: '#a8783a', h: '#d2a65a', d: '#5a3c18' };
  STATUE.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') PP(f, i, j, COL[row[i]]); });
  const big = scale2x(fc);
  const src = big.getContext('2d').getImageData(0, 0, big.width, big.height);
  const d = src.data, BW = big.width, BH = big.height;
  const op = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH && d[(y * BW + x) * 4 + 3] > 0;
  const isDetail = (i) => d[i] === 0x5a && d[i + 1] === 0x3c;
  const ox = 2, oy = 2; // canvas offset of the figure (unit -1 -> px 0, figure x 0 -> px 2)
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const i = (y * BW + x) * 4;
    if (!op(x, y)) continue;
    let col = '#a8783a';
    if (isDetail(i)) col = '#4a2e10';
    else if (!op(x - 1, y) || !op(x, y - 1)) col = '#e0b46a';
    else if (!op(x + 1, y) || !op(x, y + 1)) col = '#7a5224';
    else if (!op(x - 2, y) || !op(x, y - 2)) col = '#c2914a';
    PP(c, ox + x, oy + y, col);
  }
  outline(c, { col: '#3a2610' });
  // pedestal: painted and outlined on its own layer, then drawn under the
  // figure (whose bronze outline marks where the feet meet the stone)
  const T = (u) => (u + 12) * 2;
  const [pc, p] = makeCanvas(c.canvas.width, c.canvas.height);
  PR(p, 4, T(8), 28, T(15) - T(8), '#8e929c');
  PR(p, 4, T(8), 28, 2, '#dfe2e8'); PR(p, 4, T(8) + 2, 28, 1, '#c9ccd4');
  PR(p, 4, T(8) + 2, 1, 12, '#a9adb7'); PR(p, 31, T(8) + 2, 1, 12, '#6d717b');
  inset(p, 10, T(11), 16, 5, '#b8a060', '#d8c080', '#8a7438');
  PR(p, 12, T(11) + 2, 12, 1, '#8a7438');
  PR(p, 3, T(15) - 2, 30, 2, '#6d717b'); PR(p, 3, T(15) - 2, 30, 1, '#7d818b');
  outline(p, { tint: 0.25 });
  c.globalCompositeOperation = 'destination-over';
  c.drawImage(pc, 0, 0);
  c.globalCompositeOperation = 'source-over';
}
export function statue(x, y, extra = {}) {
  return {
    type: 'prop', x, y, w: 1, h: 1,
    draw(ctx, sx, sy) {
      R(ctx, sx + 1, sy + 15, 14, 1, 'rgba(0,0,0,0.25)');
      blit(ctx, bake('statue', 18, 28, paintStatue), sx - 1, sy - 12);
    },
    ...extra,
  };
}
