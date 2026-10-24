// 芸の実演 (owner C): stage art shared by the performance minigames (640x360 screen px, crisp pixels).
//   backdrop(type, o)    cached full-screen canvas: 'theater' | 'studio' | 'kinbyobu' | 'yose' | 'conte' (o.setting)
//                        | 'ogiri' | 'ippon' | 'pin'. o: { sign, color, setting, kamigata, seed }
//   Crowd                audience silhouettes in the pit + rising laughter (bob with the laugh wave)
//   drawActor            a member from charSheetHD at 2x, standing or seated (正座 on a 座布団), with a talking mouth
//   drawMic, drawZabuton, drawSensu, drawTenugui, drawFlipBoard, drawKendai (上方の見台・膝隠し)
//   drawBubble / layoutBubble, drawHud, drawHint, drawPanel, glyph   (UI pieces in the style of tsukkomi.js)

import { text, rect, wrap, measure, COLORS } from './draw.js';
import { makeCanvas, mulberry32, clamp, shade, SW, SH } from './util.js';
import { charSheetHD } from './sprites.js';

export const INK = '#22202a';
export const HUD_H = 26;
export const FLOOR_Y = 236;
export const LIP_Y = 296;
export const AUD_Y = 310;
export const FEET_Y = 284;
export const CW = 64, CH = 80;

// ------------------------------------------------------------------ pixel helpers
export function fillPoly(ctx, pts, color) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  ctx.fillStyle = color;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const sy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(x1 + ((sy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) ctx.fillRect(a, y, b - a, 1);
    }
  }
}
export function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
    if (hw > 0) ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
}
export function starPts(cx, cy, rx, ry, spikes, inner, rot = 0) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = rot + (i * Math.PI) / spikes;
    const r = i % 2 ? inner : 1;
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  return pts;
}
export function dither(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  for (let yy = y; yy < y + h; yy++) for (let xx = x + ((yy + x) & 1); xx < x + w; xx += 2) ctx.fillRect(xx, yy, 1, 1);
}
export function roundBox(ctx, x, y, w, h, fill, edge = INK, low = null) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  rect(ctx, x + 4, y, w - 8, h, edge);
  rect(ctx, x + 2, y + 1, w - 4, h - 2, edge);
  rect(ctx, x + 1, y + 2, w - 2, h - 4, edge);
  rect(ctx, x, y + 4, w, h - 8, edge);
  rect(ctx, x + 4, y + 2, w - 8, h - 4, fill);
  rect(ctx, x + 3, y + 3, w - 6, h - 6, fill);
  rect(ctx, x + 2, y + 4, w - 4, h - 8, fill);
  if (low) {
    rect(ctx, x + 4, y + h - 4, w - 8, 2, low);
    rect(ctx, x + w - 4, y + 4, 2, h - 8, low);
  }
}
const vgrad = (c, x, y, w, h, cols) => {
  const band = h / cols.length;
  cols.forEach((col, i) => {
    const y0 = Math.round(y + i * band), y1 = Math.round(y + (i + 1) * band);
    rect(c, x, y0, w, y1 - y0, col);
    if (i) dither(c, x, y0, w, 2, cols[i - 1]);
  });
};

// ------------------------------------------------------------------ common stage parts
function floorBoards(c, r, y0 = FLOOR_Y, y1 = LIP_Y, A = '#b07a40', B = '#a46f38') {
  rect(c, 0, y0, SW, 2, '#1a0a08');
  for (let y = y0 + 2, row = 0; y < y1; y += 10, row++) {
    const h = Math.min(10, y1 - y);
    const odd = row % 2;
    rect(c, 0, y, SW, h, odd ? B : A);
    rect(c, 0, y, SW, 1, shade(odd ? B : A, 0.12));
    rect(c, 0, y + h - 1, SW, 1, shade(A, -0.3));
    for (let k = 0; k < 14; k++) rect(c, Math.floor(r() * SW), y + 2 + Math.floor(r() * Math.max(1, h - 4)), 6 + Math.floor(r() * 18), 1, shade(odd ? B : A, -0.07));
    for (let x = (row * 53) % 96; x < SW; x += 96) rect(c, x, y, 1, h - 1, shade(A, -0.4));
  }
}
function lipAndPit(c, lights = true) {
  rect(c, 0, LIP_Y, SW, 14, '#4a2a14');
  rect(c, 0, LIP_Y, SW, 1, '#e0a868');
  rect(c, 0, LIP_Y + 1, SW, 1, '#9a6a3a');
  rect(c, 0, LIP_Y + 12, SW, 2, '#1a0e06');
  if (lights) {
    for (let x = 28; x < SW; x += 56) {
      c.globalAlpha = 0.2;
      rect(c, x - 12, LIP_Y - 3, 24, 3, '#fff2b0');
      c.globalAlpha = 1;
      rect(c, x - 8, LIP_Y + 3, 16, 8, INK);
      rect(c, x - 6, LIP_Y + 3, 12, 4, '#ffe9a0');
      rect(c, x - 4, LIP_Y + 3, 5, 1, '#fffbe8');
    }
  }
  rect(c, 0, AUD_Y, SW, SH - AUD_Y, '#0d0a16');
  rect(c, 0, AUD_Y, SW, 2, '#07050c');
}
function spot(c, cx = 320, w0 = 112, w1 = 464, alpha = 0.07) {
  c.globalAlpha = alpha;
  fillPoly(c, [[cx - w0 / 2, 30], [cx + w0 / 2, 30], [cx + w1 / 2, LIP_Y], [cx - w1 / 2, LIP_Y]], '#fff2c8');
  c.globalAlpha = 0.12;
  fillEllipse(c, cx, 278, Math.round(w1 * 0.42), 15, '#fff0c0');
  c.globalAlpha = 1;
}
function curtains(c, col = '#c02438') {
  const T = [shade(col, 0.18), col, col, shade(col, -0.18), shade(col, -0.18), shade(col, -0.32)];
  for (const side of [0, 1]) {
    const x0 = side ? SW - 52 : 0;
    for (let i = 0; i < 4; i++) {
      const fx = x0 + i * 13;
      for (let k = 0; k < 13; k++) rect(c, fx + k, HUD_H, 1, FLOOR_Y - HUD_H, T[Math.min(5, Math.floor(k / 2.2))]);
      rect(c, fx, HUD_H, 1, FLOOR_Y - HUD_H, shade(col, -0.55));
    }
    c.globalAlpha = 0.3;
    rect(c, side ? x0 - 5 : x0 + 53, HUD_H, 4, FLOOR_Y - HUD_H, '#000');
    c.globalAlpha = 1;
    const ty = 146;
    rect(c, x0, ty - 1, 52, 8, '#5a3a0c');
    rect(c, x0, ty, 52, 6, '#e8b830');
    for (let x = x0; x < x0 + 52; x += 4) rect(c, x, ty, 2, 1, '#fff0a0');
  }
}
function valance(c, col = '#b31f34', crest = '笑') {
  rect(c, 0, HUD_H, SW, 4, '#c8961e');
  rect(c, 0, HUD_H, SW, 1, '#ffe27a');
  const top = HUD_H + 4;
  for (let x0 = 0; x0 < SW; x0 += 20) {
    const dark = (x0 / 20) % 2;
    for (let i = 0; i < 20; i++) {
      const sag = Math.round(Math.sin(((i + 0.5) / 20) * Math.PI) * 6);
      const h = 18 + sag;
      rect(c, x0 + i, top, 1, h, i < 2 ? shade(col, 0.15) : i > 17 ? shade(col, -0.3) : dark ? shade(col, -0.12) : col);
      rect(c, x0 + i, top + h, 1, 1, shade(col, -0.6));
      rect(c, x0 + i, top + h + 1, 1, 2, '#e8b830');
    }
  }
  if (crest) {
    fillEllipse(c, 320, top + 11, 14, 13, '#6e4a0e');
    fillEllipse(c, 320, top + 11, 13, 12, '#e8b830');
    fillEllipse(c, 320, top + 11, 11, 10, '#fff6e6');
    text(c, crest, 320, top + 3, { size: 16, align: 'center', color: col, shadow: null });
  }
}
function lantern(c, cx, y, ch = '笑') {
  rect(c, cx, 58, 1, y - 58, '#120a0a');
  rect(c, cx - 9, y, 18, 6, INK);
  for (let j = 0; j < 36; j++) {
    const hw = Math.round(10 + Math.sin(((j + 0.5) / 36) * Math.PI) * 5);
    const yy = y + 6 + j;
    rect(c, cx - hw - 1, yy, hw * 2 + 2, 1, INK);
    rect(c, cx - hw, yy, hw * 2, 1, j % 6 === 5 ? '#e2d2ae' : '#f6ecd2');
    rect(c, cx + hw - 4, yy, 4, 1, '#d8c6a0');
  }
  rect(c, cx - 9, y + 42, 18, 6, INK);
  rect(c, cx - 1, y + 48, 3, 9, '#d8364a');
  text(c, ch, cx, y + 16, { size: 16, align: 'center', color: '#c0182c', shadow: null });
}
// Lit sign board (看板) across the top: the venue / show name
function signBoard(c, str, y = 64, col = '#2a1408', fg = '#ffe27a') {
  if (!str) return;
  const size = 16;
  let w = Math.ceil(measure(c, str, size)) + 36;
  w = Math.min(SW - 140, Math.max(160, w));
  const x = Math.round(SW / 2 - w / 2);
  roundBox(c, x, y, w, 30, col, INK, shade(col, -0.3));
  rect(c, x + 6, y + 4, w - 12, 1, shade(col, 0.4));
  for (let bx = x + 8; bx < x + w - 6; bx += 10) { rect(c, bx, y + 2, 2, 2, '#fff2b0'); rect(c, bx + 4, y + 26, 2, 2, '#fff2b0'); }
  let s = size;
  while (measure(c, str, s) > w - 24 && s > 11) s--;
  text(c, str, SW / 2, y + 15 - Math.round(s / 2), { size: s, align: 'center', color: fg, outline: '#3a1a00' });
}

// ------------------------------------------------------------------ backdrops
const CACHE = new Map();
export function backdrop(type, o = {}) {
  const key = type + '|' + (o.sign || '') + '|' + (o.setting || '') + '|' + (o.color || '') + '|' + (o.kamigata ? 1 : 0);
  if (CACHE.has(key)) return CACHE.get(key);
  const [cv, c] = makeCanvas(SW, SH);
  const r = mulberry32(o.seed || 4242);
  const fnc = BACK[type] || BACK.theater;
  fnc(c, r, o);
  if (CACHE.size > 24) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, cv);
  return cv;
}

const BACK = {
  theater(c, r, o) {
    const col = o.color || '#5c1628';
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, [col, shade(col, -0.06), shade(col, -0.14), shade(col, -0.22), shade(col, -0.3), shade(col, -0.38)]);
    for (let x = 6; x < SW; x += 22) { rect(c, x, 56, 3, FLOOR_Y - 56, 'rgba(0,0,0,0.16)'); rect(c, x + 9, 56, 1, FLOOR_Y - 56, 'rgba(255,190,200,0.05)'); }
    // a back flat with the theatre's mark
    rect(c, 150, 104, 340, 132, '#1c1020');
    rect(c, 152, 106, 336, 128, '#2a1830');
    for (let i = 0; i < 7; i++) rect(c, 160 + i * 48, 112, 40, 116, i % 2 ? '#33203a' : '#2e1c36');
    curtains(c, '#c02438');
    valance(c, '#b31f34', '笑');
    lantern(c, 26, 70);
    lantern(c, SW - 26, 70);
    signBoard(c, o.sign, 66);
    floorBoards(c, r);
    spot(c);
    lipAndPit(c);
  },
  studio(c, r, o) {
    const col = o.color || '#101a44';
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, [shade(col, -0.2), col, shade(col, 0.06), col, shade(col, -0.1), shade(col, -0.25)]);
    // marquee arch of bulbs
    for (let k = 0; k <= 60; k++) {
      const a = Math.PI + (k / 60) * Math.PI;
      const x = 320 + Math.cos(a) * 250, y = 230 + Math.sin(a) * 170;
      rect(c, Math.round(x) - 2, Math.round(y) - 2, 5, 5, INK);
      rect(c, Math.round(x) - 1, Math.round(y) - 1, 3, 3, k % 2 ? '#ffd23f' : '#fff6c8');
    }
    // back screen (LED)
    rect(c, 196, 92, 248, 120, INK);
    rect(c, 200, 96, 240, 112, '#0a0f2a');
    for (let y = 98; y < 206; y += 3) rect(c, 200, y, 240, 1, 'rgba(90,120,255,0.12)');
    for (let i = 0; i < 18; i++) rect(c, 206 + Math.floor(r() * 228), 100 + Math.floor(r() * 100), 2, 2, 'rgba(255,220,120,0.5)');
    if (o.sign) {
      let s = 18;
      while (measure(c, o.sign, s) > 224 && s > 11) s--;
      const lines = measure(c, o.sign, s) > 224 ? wrap(c, o.sign, 224, s) : [o.sign];
      lines.slice(0, 2).forEach((l, i) => text(c, l, 320, 140 - lines.length * 11 + i * (s + 6), { size: s, align: 'center', color: '#ffe27a', outline: '#3a1a00' }));
    }
    // light towers
    for (const tx of [40, SW - 64]) {
      rect(c, tx, 40, 24, FLOOR_Y - 40, '#1a1f36');
      for (let y = 44; y < FLOOR_Y; y += 12) { rect(c, tx + 2, y, 20, 1, '#3a4270'); rect(c, tx + 2, y, 1, 12, '#2a3058'); }
      for (let y = 56; y < 200; y += 44) { fillEllipse(c, tx + 12, y, 9, 9, INK); fillEllipse(c, tx + 12, y, 7, 7, ['#ff7eb6', '#5fd7ff', '#ffd23f'][(y / 44) % 3 | 0]); }
    }
    // glossy floor
    vgrad(c, 0, FLOOR_Y, SW, LIP_Y - FLOOR_Y, ['#2a2f5a', '#22274c', '#1c2040', '#171a36']);
    for (let x = -40; x < SW + 40; x += 48) fillPoly(c, [[x, FLOOR_Y], [x + 2, FLOOR_Y], [x + (x - 320) * 0.4 + 2, LIP_Y], [x + (x - 320) * 0.4, LIP_Y]], 'rgba(120,140,255,0.12)');
    c.globalAlpha = 0.25;
    fillEllipse(c, 320, 274, 150, 14, '#ffe9a0');
    c.globalAlpha = 1;
    spot(c, 320, 90, 380, 0.09);
    lipAndPit(c, false);
    rect(c, 0, LIP_Y, SW, 14, '#1a1d36');
    rect(c, 0, LIP_Y, SW, 2, '#ffd23f');
  },
  kinbyobu(c, r, o) {
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, ['#3a1018', '#341018', '#2c0d14', '#250a10', '#1e080d']);
    const bx = 152, by = 82, pw = 56, bh = FLOOR_Y - 82;
    rect(c, bx - 4, by - 4, pw * 6 + 8, bh + 4, '#2a160c');
    for (let p = 0; p < 6; p++) {
      const px = bx + p * pw;
      const lit = p % 2 === 0;
      vgrad(c, px, by, pw, bh, lit ? ['#e4b647', '#d9a93b', '#cb9a31', '#b78829'] : ['#cf9d33', '#c3902d', '#b08126', '#9a7121']);
      for (let gy = by + 9, row = 0; gy < by + bh; gy += 18, row++) rect(c, px, gy, pw, 1, 'rgba(120,80,10,0.2)');
      rect(c, px, by, 1, bh, lit ? '#f8de8a' : '#e8c66c');
      rect(c, px + pw - 1, by, 1, bh, '#6e4f14');
    }
    for (const [mx, my, mw] of [[164, 100, 120], [300, 118, 150], [196, 176, 100], [356, 196, 110]]) {
      [[6, '#fbe7a6'], [3, '#f6dc8c'], [1, '#efcf74'], [0, '#ecc865'], [0, '#ecc865'], [1, '#d4ad4c'], [3, '#c49a3a'], [6, '#a87e26']].forEach(([ins, col], i) => rect(c, mx + ins, my + i, mw - ins * 2, 1, col));
    }
    curtains(c, '#8e1420');
    valance(c, '#8e1420', null);
    signBoard(c, o.sign, 40, '#5a0c14');
    floorBoards(c, r, FLOOR_Y, LIP_Y, '#8e2a24', '#83261f');
    spot(c);
    lipAndPit(c);
  },
  yose(c, r, o) {
    // 寄席: 後ろ幕 (dark green with a crest), 高座 (raised platform with red 毛氈), めくり at stage right
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, ['#2a3a24', '#26351f', '#22301c', '#1e2a18', '#1a2414']);
    for (let x = 0; x < SW; x += 30) { rect(c, x, HUD_H, 2, FLOOR_Y - HUD_H, 'rgba(0,0,0,0.18)'); rect(c, x + 14, HUD_H, 1, FLOOR_Y - HUD_H, 'rgba(255,255,255,0.03)'); }
    fillEllipse(c, 320, 120, 30, 30, '#1a2414');
    fillEllipse(c, 320, 120, 27, 27, '#d8c68a');
    fillEllipse(c, 320, 120, 23, 23, '#26351f');
    text(c, o.kamigata ? '笑' : '寄', 320, 108, { size: 24, align: 'center', color: '#d8c68a', shadow: null });
    // 欄間 strip
    rect(c, 0, HUD_H, SW, 16, '#3a2414');
    for (let x = 4; x < SW; x += 16) { rect(c, x, HUD_H + 3, 10, 10, '#5a3a20'); rect(c, x + 3, HUD_H + 6, 4, 4, '#2a180c'); }
    lantern(c, 40, 54, '寄');
    lantern(c, SW - 40, 54, '席');
    floorBoards(c, r, FLOOR_Y, LIP_Y, '#9a6a3a', '#8e6034');
    // 高座
    const kx = 196, kw = 248, ky = 222;
    rect(c, kx - 2, ky - 2, kw + 4, LIP_Y - ky + 2, INK);
    rect(c, kx, ky, kw, 8, '#c8a070');
    rect(c, kx, ky, kw, 2, '#e8c890');
    vgrad(c, kx, ky + 8, kw, LIP_Y - ky - 8, ['#c42a30', '#b42428', '#a01e22', '#8a1a1e']);
    for (let x = kx + 4; x < kx + kw; x += 8) rect(c, x, ky + 10, 1, LIP_Y - ky - 12, 'rgba(0,0,0,0.12)');
    // めくり
    const mx = 598, my = 146;
    rect(c, mx - 12, my + 74, 3, 60, '#2e1a0c');
    rect(c, mx + 9, my + 74, 3, 60, '#2e1a0c');
    rect(c, mx - 22, my + 132, 44, 4, '#2e1a0c');
    rect(c, mx - 19, my, 38, 78, INK);
    rect(c, mx - 18, my + 1, 36, 76, '#f4efe0');
    rect(c, mx - 21, my - 4, 42, 5, '#3a1f0e');
    const name = String(o.sign || '落語').slice(0, 4);
    Array.from(name).forEach((ch, i) => text(c, ch, mx - 1, my + 6 + i * (name.length > 3 ? 17 : 22), { size: name.length > 3 ? 16 : 20, align: 'center', color: '#1a1a1a', shadow: null }));
    spot(c, 320, 120, 300, 0.08);
    lipAndPit(c, false);
  },
  conte(c, r, o) {
    // black box with the set's flats; o.setting picks the set
    rect(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, '#141218');
    const set = SETS[o.setting] || SETS.generic;
    set(c, r);
    // proscenium black borders
    rect(c, 0, HUD_H, 34, FLOOR_Y - HUD_H, '#0a090c');
    rect(c, SW - 34, HUD_H, 34, FLOOR_Y - HUD_H, '#0a090c');
    rect(c, 0, HUD_H, SW, 14, '#0a090c');
    floorBoards(c, r, FLOOR_Y, LIP_Y, '#3a3440', '#34303a');
    lipAndPit(c, false);
  },
  ogiri(c, r, o) {
    // 演芸番組の大喜利: 金と朱の背景、長い高座に並ぶ座布団
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, ['#7a1a14', '#8a2016', '#7a1a14', '#6a1610']);
    for (let x = 0; x < SW; x += 40) { rect(c, x, HUD_H + 20, 20, FLOOR_Y - HUD_H - 20, 'rgba(255,200,80,0.06)'); }
    for (let k = 0; k < 9; k++) { const x = 40 + k * 70; fillEllipse(c, x, 70, 18, 18, 'rgba(255,214,90,0.18)'); }
    signBoard(c, o.sign || '大喜利', 40, '#3a0c08');
    // the long dais (高座) where the members sit
    rect(c, 120, 196, 500, 42, INK);
    rect(c, 122, 196, 496, 6, '#e8c890');
    vgrad(c, 122, 202, 496, 34, ['#d43a30', '#c02a26', '#a82020']);
    // the host's desk at the left
    rect(c, 26, 196, 82, 42, INK);
    rect(c, 28, 198, 78, 38, '#6a3a1c');
    rect(c, 28, 198, 78, 4, '#9a6a3a');
    text(c, '司会', 67, 212, { size: 12, align: 'center', color: '#ffe9b0', shadow: null });
    floorBoards(c, r, FLOOR_Y, LIP_Y, '#a07040', '#946838');
    lipAndPit(c);
  },
  ippon(c, r, o) {
    // dark studio with 5 judge booths (lamps) at the back and the answer podium
    vgrad(c, 0, HUD_H, SW, FLOOR_Y - HUD_H, ['#05060f', '#0a0d20', '#0e1230', '#0a0d20']);
    for (let i = 0; i < 40; i++) rect(c, Math.floor(r() * SW), HUD_H + Math.floor(r() * 80), 1, 1, 'rgba(160,180,255,0.35)');
    for (let x = 0; x < SW; x += 64) fillPoly(c, [[x + 30, HUD_H], [x + 34, HUD_H], [x + 60, FLOOR_Y], [x + 4, FLOOR_Y]], 'rgba(80,110,255,0.05)');
    rect(c, 70, 150, 500, 4, '#3a4280');
    vgrad(c, 0, FLOOR_Y, SW, LIP_Y - FLOOR_Y, ['#1a1e3c', '#151834', '#11142c']);
    for (let x = -60; x < SW + 60; x += 40) fillPoly(c, [[x, FLOOR_Y], [x + 1, FLOOR_Y], [x + (x - 320) * 0.5 + 1, LIP_Y], [x + (x - 320) * 0.5, LIP_Y]], 'rgba(120,140,255,0.1)');
    lipAndPit(c, false);
    rect(c, 0, LIP_Y, SW, 14, '#0c0e1e');
    rect(c, 0, LIP_Y, SW, 2, '#ff6a3d');
  },
  pin(c, r, o) {
    BACK.theater(c, r, { ...o, color: o.color || '#24204a' });
  },
};

// --- conte sets (drawn between the black borders, x 34..606, y 40..236)
const SETS = {
  generic(c) {
    rect(c, 34, 40, 572, 196, '#2c2a36');
    for (let x = 34; x < 606; x += 52) rect(c, x, 40, 1, 196, '#24222c');
    rect(c, 420, 110, 64, 126, INK); rect(c, 424, 114, 56, 122, '#6a4a2e'); rect(c, 470, 172, 4, 6, '#e8c860');
  },
  office(c) {
    vgrad(c, 34, 40, 572, 196, ['#c8ccd4', '#bfc3cc', '#b4b8c2']);
    rect(c, 34, 200, 572, 36, '#9aa0ac');
    rect(c, 34, 198, 572, 2, '#7a808c');
    // window with blinds
    rect(c, 70, 66, 150, 104, INK); rect(c, 74, 70, 142, 96, '#8ec8f0');
    for (let y = 72; y < 166; y += 6) rect(c, 74, y, 142, 3, '#e8ecf2');
    // whiteboard
    rect(c, 262, 70, 170, 92, INK); rect(c, 266, 74, 162, 84, '#f8f8fa');
    text(c, '本日の予定', 276, 80, { size: 12, color: '#2a4ad0', shadow: null });
    rect(c, 276, 100, 120, 2, '#d03a3a'); rect(c, 276, 116, 96, 2, '#2a4ad0'); rect(c, 276, 132, 110, 2, '#2a2a2a');
    // clock
    fillEllipse(c, 520, 92, 20, 20, INK); fillEllipse(c, 520, 92, 17, 17, '#ffffff');
    rect(c, 519, 78, 2, 15, INK); rect(c, 520, 91, 10, 2, INK);
    // plant
    rect(c, 548, 196, 22, 26, '#8a5a3a'); fillEllipse(c, 559, 180, 16, 20, '#3a8a40'); fillEllipse(c, 554, 172, 9, 12, '#5ab060');
  },
  taxi(c) {
    rect(c, 34, 40, 572, 196, '#0c1028');
    for (let i = 0; i < 26; i++) rect(c, 40 + (i * 97) % 560, 60 + (i * 37) % 90, 3 + (i % 3), 3 + (i % 2), ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ffffff'][i % 4]);
    // the cab body cutaway
    rect(c, 120, 120, 400, 116, INK);
    rect(c, 124, 124, 392, 108, '#f2c230');
    rect(c, 140, 132, 170, 60, '#1a2440'); rect(c, 330, 132, 170, 60, '#1a2440');
    rect(c, 140, 132, 170, 2, '#5a7ab0'); rect(c, 330, 132, 170, 2, '#5a7ab0');
    rect(c, 300, 104, 40, 18, INK); rect(c, 302, 106, 36, 14, '#ffef9a'); text(c, 'TAXI', 320, 108, { size: 12, align: 'center', color: '#2a2a2a', shadow: null });
    rect(c, 124, 196, 392, 4, '#c89a20');
  },
  hospital(c) {
    vgrad(c, 34, 40, 572, 196, ['#d8eee4', '#cfe8dc', '#c4e0d2']);
    rect(c, 34, 200, 572, 36, '#b0cfc0');
    // curtain rail + curtain
    rect(c, 360, 60, 220, 3, '#9aa0ac');
    for (let x = 360; x < 580; x += 10) { rect(c, x, 63, 10, 150, x % 20 ? '#f4f8f6' : '#e4ece8'); rect(c, x, 63, 1, 150, '#c8d4ce'); }
    // eye chart
    rect(c, 80, 70, 70, 100, INK); rect(c, 83, 73, 64, 94, '#ffffff');
    ['C', 'E  O', 'F  P  C', 'O  E  F  D'].forEach((l, i) => text(c, l, 115, 78 + i * 20, { size: 18 - i * 3, align: 'center', color: '#222', shadow: null }));
    // desk
    rect(c, 170, 170, 130, 8, INK); rect(c, 172, 170, 126, 5, '#e8e8ee'); rect(c, 180, 178, 6, 46, '#9aa0ac'); rect(c, 284, 178, 6, 46, '#9aa0ac');
  },
  school(c) {
    vgrad(c, 34, 40, 572, 196, ['#e8dcc0', '#e2d4b4', '#dccca8']);
    rect(c, 34, 200, 572, 36, '#b89a6a');
    // blackboard
    rect(c, 120, 62, 400, 112, '#5a3a20'); rect(c, 126, 68, 388, 100, '#2e4a34');
    for (let i = 0; i < 6; i++) rect(c, 140 + i * 60, 80 + (i % 3) * 22, 30 + (i % 2) * 20, 2, 'rgba(255,255,255,0.35)');
    text(c, '転校生', 320, 100, { size: 20, align: 'center', color: '#f4f4ec', shadow: null });
    rect(c, 126, 168, 388, 5, '#7a5a3a');
    rect(c, 150, 168, 14, 3, '#ffffff'); rect(c, 180, 168, 10, 3, '#ffd0d0');
    // podium (教卓)
    rect(c, 270, 190, 100, 46, INK); rect(c, 272, 192, 96, 44, '#a87a4a'); rect(c, 272, 192, 96, 4, '#c89a6a');
    // window
    rect(c, 540, 66, 52, 110, INK); rect(c, 544, 70, 44, 102, '#a8d8f0'); rect(c, 565, 70, 2, 102, INK);
  },
  konbini(c) {
    vgrad(c, 34, 40, 572, 196, ['#f4f6f8', '#eceff2', '#e2e6ea']);
    rect(c, 34, 200, 572, 36, '#c8ccd2');
    for (let s = 0; s < 3; s++) {
      const y = 76 + s * 40;
      rect(c, 60, y + 26, 220, 4, '#8a909c');
      for (let k = 0; k < 18; k++) rect(c, 64 + k * 12, y + 6 + (k % 3) * 2, 9, 20 - (k % 3) * 2, ['#d64161', '#ffd23f', '#5fd7ff', '#5ee07a', '#ff8a3d'][(k + s) % 5]);
    }
    // register counter
    rect(c, 380, 168, 200, 68, INK); rect(c, 382, 170, 196, 66, '#e8e0d0'); rect(c, 382, 170, 196, 6, '#b8b0a0');
    rect(c, 420, 140, 50, 30, INK); rect(c, 422, 142, 46, 26, '#3a3d48'); rect(c, 428, 146, 34, 10, '#5ee07a');
    rect(c, 300, 52, 160, 18, '#2f9a4a'); text(c, 'OPEN 24h', 380, 54, { size: 12, align: 'center', color: '#ffffff', shadow: null });
  },
};

// ------------------------------------------------------------------ the audience
export class Crowd {
  constructor(seed = 1234, o = {}) {
    const r = mulberry32(seed);
    this.r = r;
    this.heads = [];
    this.texts = [];
    this.words = o.words || ['ワハハ', 'アハハ', 'ドッ！', 'ハハハ', 'ウフフ', 'ワハハハ'];
    const add = (x, y, rad, row) => {
      const style = Math.floor(r() * 5);
      const m = { x, y, rad, row, ph: r() * 6.28, clap: r() < 0.45 };
      const w = rad * 2 + 34, h = rad * 2 + 34;
      const [cv, c] = makeCanvas(w, h);
      const cx = Math.floor(w / 2), cy = rad + 8;
      const body = row ? '#130e1e' : '#211a30';
      const rim = row ? '#2c2444' : '#3e3458';
      const shapes = [[cx, cy + rad + 14, rad + 12, 12], [cx, cy, rad, rad]];
      if (style === 1) shapes.push([cx + 2, cy - rad - 1, 5, 4]);
      if (style === 3) shapes.push([cx - rad, cy + 3, 4, 6], [cx + rad, cy + 3, 4, 6]);
      if (style === 4) shapes.push([cx, cy + rad - 1, 4, 7]);
      for (const [x0, y0, rx, ry] of shapes) fillEllipse(c, x0, y0, rx, ry, rim);
      for (const [x0, y0, rx, ry] of shapes) fillEllipse(c, x0 + 1, y0 + 2, rx, ry, body);
      if (style === 2) { rect(c, cx - rad, cy - 2, rad * 2, 2, rim); rect(c, cx - 1, cy - rad - 1, 3, 2, rim); }
      m.cv = cv; m.ox = cx; m.oy = cy;
      this.heads.push(m);
    };
    for (let x = 6; x < SW + 10; x += 40) add(x + Math.floor(r() * 10), 326, 13 + Math.floor(r() * 2), 0);
    for (let x = -16; x < SW + 20; x += 52) add(x + Math.floor(r() * 10), 350, 17 + Math.floor(r() * 2), 1);
  }
  spawn(n = 1, words = this.words) {
    for (let i = 0; i < n; i++) {
      const free = [];
      for (let col = 0; col < 6; col++) if (!this.texts.some((c) => c.col === col && c.t < 26)) free.push(col);
      if (!free.length) return;
      const col = free[Math.floor(this.r() * free.length)];
      this.texts.push({ col, str: words[Math.floor(this.r() * words.length)], x: 70 + col * 100 + Math.round((this.r() - 0.5) * 10) * 2, y: 306 + Math.round(this.r() * 10) * 2, t: -Math.floor(this.r() * 8) });
    }
  }
  update(wave, t) {
    for (const c of this.texts) c.t++;
    this.texts = this.texts.filter((c) => c.t < 44);
    if (wave > 0.3 && t % 7 === 0 && this.r() < wave * 0.8) this.spawn(1);
  }
  draw(ctx, wave, pt, o = {}) {
    const clapOn = wave > 0.45 || o.clap;
    for (const h of this.heads) {
      let dy = 0;
      if (wave > 0.05) dy = -Math.round(Math.abs(Math.sin(pt * 0.35 + h.ph)) * 3 * Math.min(1.2, wave)) * 2;
      const y = h.y + dy;
      if (clapOn && h.clap) {
        const apart = Math.floor((pt + h.ph * 10) / 5) % 2;
        const hx = apart ? 10 : 4, hy = y - h.rad - 6;
        const body = h.row ? '#130e1e' : '#211a30';
        for (const sx of [-1, 1]) {
          const px = h.x + sx * hx - 4;
          rect(ctx, px + 1, hy, 6, 7, body);
          rect(ctx, px, hy + 1, 8, 5, body);
          rect(ctx, px + 2 + sx * 2, hy + 7, 4, 4, body);
          rect(ctx, px + 2 + sx * 4, hy + 11, 4, 8, body);
        }
      }
      ctx.drawImage(h.cv, h.x - h.ox, y - h.oy);
    }
    for (const c of this.texts) {
      if (c.t < 0) continue;
      ctx.globalAlpha = clamp(1 - c.t / 44, 0, 1);
      text(ctx, c.str, c.x, c.y - c.t * 0.8, { size: 16, align: 'center', color: '#ffe680', outline: '#3a1a00' });
      ctx.globalAlpha = 1;
    }
  }
}

// ------------------------------------------------------------------ people & props
const MOUTH = '#4a1420';
const comp = new Map();
function scratch(w, h) {
  const k = w + 'x' + h;
  if (!comp.has(k)) comp.set(k, makeCanvas(w, h));
  return comp.get(k);
}
// o: { x (left of the 64px sprite), feet, dir 'down'|'left'|'right'|'up', talk (bool), frame, seated, lap (kimono colour),
//      lean (−1..1 art px per row), bob, alpha, shout }
export function drawActor(ctx, sheet, o = {}) {
  const dir = o.dir || 'down';
  const list = sheet[dir] || sheet.down;
  const img = list[o.frame || 0] || list[0];
  const [cv, c] = scratch(32, 40);
  c.clearRect(0, 0, 32, 40);
  c.drawImage(img, 0, 0);
  if (dir === 'down') {
    if (o.talk || o.shout) { rect(c, 14, 18, 4, o.shout ? 4 : 3, MOUTH); rect(c, 15, 20, 2, 1, '#e2707a'); rect(c, 14, 18, 4, 1, INK); }
  } else if (dir === 'left' || dir === 'right') {
    if (o.talk || o.shout) { const mx = dir === 'left' ? 9 : 20; rect(c, mx, 18, 3, 2, MOUTH); }
  }
  const x = Math.round(o.x || 0);
  const feet = Math.round(o.feet ?? FEET_Y);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.seated) {
    // 正座: torso (rows 0..27) above a kimono lap on the 座布団
    const top = feet - 60;
    ctx.drawImage(cv, 0, 0, 32, 28, x, top, CW, 56);
    const lap = o.lap || shade('#3a4a7a', -0.1);
    const lx = x + 32;
    fillEllipse(ctx, lx, feet - 6, 34, 9, INK);
    fillEllipse(ctx, lx, feet - 7, 32, 8, lap);
    rect(ctx, lx - 28, feet - 14, 56, 8, lap);
    rect(ctx, lx - 30, feet - 12, 60, 4, lap);
    rect(ctx, lx - 26, feet - 15, 52, 1, shade(lap, 0.25));
    rect(ctx, lx - 1, feet - 14, 2, 10, shade(lap, -0.3));
  } else if (o.lean) {
    for (let row = 0; row < 40;) {
      const off = Math.round(o.lean * (39.5 - row));
      let end = row + 1;
      while (end < 40 && Math.round(o.lean * (39.5 - end)) === off) end++;
      ctx.drawImage(cv, 0, row, 32, end - row, x - off * 2, feet - CH + row * 2, CW, (end - row) * 2);
      row = end;
    }
  } else {
    ctx.drawImage(cv, x, feet - CH - (o.bob || 0), CW, CH);
  }
  ctx.globalAlpha = 1;
}
export function shadowAt(ctx, cx, feet = FEET_Y, rx = 26) {
  ctx.globalAlpha = 0.32;
  fillEllipse(ctx, cx, feet - 1, rx, 4, '#1a0a04');
  ctx.globalAlpha = 1;
}
export function drawMic(ctx, x, feet = FEET_Y, top = 198) {
  fillEllipse(ctx, x, feet - 1, 15, 4, INK);
  fillEllipse(ctx, x, feet - 2, 13, 3, '#3a3d48');
  rect(ctx, x - 3, top + 32, 6, feet - top - 35, INK);
  rect(ctx, x - 2, top + 32, 4, feet - top - 35, '#8a909c');
  rect(ctx, x - 2, top + 32, 1, feet - top - 35, '#e6eaf0');
  rect(ctx, x - 5, top + 26, 10, 8, INK);
  rect(ctx, x - 4, top + 27, 8, 6, '#3a3d48');
  rect(ctx, x - 6, top, 12, 28, INK);
  rect(ctx, x - 5, top + 1, 10, 26, '#b8bcc6');
  for (let yy = top + 3; yy < top + 24; yy += 2) rect(ctx, x - 4, yy, 8, 1, '#7a808c');
  rect(ctx, x - 6, top + 12, 12, 3, '#3a3d48');
  rect(ctx, x - 3, top + 2, 2, 9, '#ffffff');
}
export function drawZabuton(ctx, cx, y, col = '#7a3a9a', stack = 1) {
  for (let k = 0; k < stack; k++) {
    const yy = y - k * 6;
    fillEllipse(ctx, cx, yy, 40, 7, INK);
    fillEllipse(ctx, cx, yy - 1, 38, 6, col);
    rect(ctx, cx - 30, yy - 3, 60, 1, shade(col, 0.3));
    rect(ctx, cx - 2, yy - 2, 4, 3, shade(col, -0.35));
  }
}
// closed 扇子: a slim stick; open: a fan. (screen px)
export function drawSensu(ctx, x, y, o = {}) {
  const ang = o.angle || 0;
  const len = o.len || 26;
  if (o.open) {
    const pts = [[x, y]];
    for (let k = 0; k <= 8; k++) { const a = ang - 0.7 + (k / 8) * 1.4; pts.push([x + Math.cos(a) * len, y + Math.sin(a) * len]); }
    fillPoly(ctx, pts, INK);
    const pts2 = [[x, y]];
    for (let k = 0; k <= 8; k++) { const a = ang - 0.65 + (k / 8) * 1.3; pts2.push([x + Math.cos(a) * (len - 2), y + Math.sin(a) * (len - 2)]); }
    fillPoly(ctx, pts2, '#f4e8c8');
    return;
  }
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < len; i++) {
    const px = Math.round(x + dx * i), py = Math.round(y + dy * i);
    rect(ctx, px - 1, py - 1, 3, 3, INK);
  }
  for (let i = 1; i < len - 1; i++) rect(ctx, Math.round(x + dx * i), Math.round(y + dy * i), 1, 1, i < 5 ? '#7a4a2a' : '#e8d8b0');
}
export function drawTenugui(ctx, x, y, o = {}) {
  const w = o.w || 20, h = o.h || 12;
  rect(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  rect(ctx, x, y, w, h, o.col || '#5a8ad0');
  for (let k = 2; k < w; k += 5) rect(ctx, x + k, y, 2, h, 'rgba(255,255,255,0.35)');
}
// 上方落語の見台 + 膝隠し, in front of the seated performer centred at cx
export function drawKendai(ctx, cx, feet) {
  rect(ctx, cx - 44, feet - 26, 88, 26, INK);
  rect(ctx, cx - 42, feet - 24, 84, 22, '#8a5a2a');
  rect(ctx, cx - 42, feet - 24, 84, 3, '#b07a40');
  for (let x = cx - 38; x < cx + 38; x += 12) rect(ctx, x, feet - 20, 8, 14, '#7a4a20');
  rect(ctx, cx - 36, feet - 40, 72, 14, INK);
  rect(ctx, cx - 34, feet - 38, 68, 10, '#9a6a34');
  rect(ctx, cx - 34, feet - 38, 68, 2, '#c08a4a');
  // 小拍子
  rect(ctx, cx + 22, feet - 44, 10, 5, INK);
  rect(ctx, cx + 23, feet - 43, 8, 3, '#d8b070');
}
// A sketchbook フリップ on an easel (or held); lines drawn big
export function drawFlipBoard(ctx, x, y, w, h, lines = [], o = {}) {
  if (o.easel) {
    rect(ctx, x + 10, y + h - 4, 4, 70, '#5a3a20');
    rect(ctx, x + w - 14, y + h - 4, 4, 70, '#5a3a20');
    rect(ctx, x + w / 2 - 2, y + 10, 4, h + 60, '#4a2e18');
  }
  rect(ctx, x - 2, y - 2, w + 4, h + 4, INK);
  rect(ctx, x, y, w, h, '#fbf8ee');
  rect(ctx, x, y, w, 6, '#d8d0bc');
  for (let k = 6; k < w; k += 10) rect(ctx, x + k, y - 4, 3, 8, '#9aa0ac');
  const size = o.size || 16;
  let yy = y + 14;
  for (const l of lines) {
    let s = size;
    while (measure(ctx, l, s) > w - 16 && s > 10) s--;
    text(ctx, l, x + w / 2, yy, { size: s, align: 'center', color: o.color || '#1a1a28', shadow: null });
    yy += s + 6;
  }
}

// ------------------------------------------------------------------ UI pieces
export function glyph(ctx, k, x, y) {
  const fill = k === 'A' ? '#ff7a5c' : k === 'B' ? '#5fa8ff' : '#8a90b0';
  rect(ctx, x + 2, y + 2, 16, 16, INK);
  rect(ctx, x + 1, y + 4, 18, 12, INK);
  rect(ctx, x + 3, y + 3, 14, 14, fill);
  rect(ctx, x + 2, y + 5, 16, 10, fill);
  rect(ctx, x + 5, y + 4, 6, 1, '#ffffff');
  const label = { left: '←', right: '→', up: '↑', down: '↓' }[k] || k;
  text(ctx, label, x + 10, y + 3, { size: 14, align: 'center', color: '#ffffff', shadow: null });
}
// The hint bar along the bottom. parts: strings; 'A' 'B' 'left' 'right' 'up' 'down' become button glyphs.
const GLYPHS = new Set(['A', 'B', 'left', 'right', 'up', 'down']);
export function drawHint(ctx, parts) {
  const y = SH - 20;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, y, SW, 20);
  const ws = parts.map((p) => (GLYPHS.has(p) ? 20 : Math.ceil(measure(ctx, p, 14))));
  const gap = 4;
  let total = ws.reduce((a, b) => a + b + gap, -gap);
  let x = Math.round((SW - total) / 2);
  parts.forEach((p, i) => {
    if (GLYPHS.has(p)) glyph(ctx, p, x, y);
    else text(ctx, p, x, y + 3, { size: 14, color: '#c8cce6', shadow: null });
    x += ws[i] + gap;
  });
}
export function drawPanel(ctx, x, y, w, h, o = {}) {
  roundBox(ctx, x, y, w, h, o.fill || 'rgba(14,16,40,0.92)', o.edge || INK, o.low || null);
  if (o.gold) { rect(ctx, x + 4, y + 2, w - 8, 1, '#ffd23f'); rect(ctx, x + 4, y + h - 3, w - 8, 1, '#a07a20'); }
}
// Laugh / heat style meter with rank ticks
export function meter(ctx, x, y, w, h, frac, cols = null) {
  rect(ctx, x, y, w, h, '#000');
  rect(ctx, x + 1, y + 1, w - 2, h - 2, '#2a2f55');
  const fw = Math.round(clamp(frac, 0, 1) * (w - 2));
  if (fw > 0) {
    const col = cols ? cols(frac) : frac >= 0.75 ? '#ff5d6c' : frac >= 0.45 ? '#ff9a3c' : frac >= 0.25 ? '#ffd23f' : '#5fd7ff';
    rect(ctx, x + 1, y + 1, fw, h - 2, col);
    rect(ctx, x + 1, y + 1, fw, 2, shade(col, 0.4));
    rect(ctx, x + 1, y + h - 3, fw, 2, shade(col, -0.25));
  }
}
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export { mmss };
// HUD: o = { left (e.g. 'ネタ 3/20'), heat 0..1, clock (sec), limit (sec|null), right (string), rush 0..1|null }
export function drawHud(ctx, o) {
  rect(ctx, 0, 0, SW, HUD_H, '#0b0d1e');
  rect(ctx, 0, HUD_H - 2, SW, 1, '#3a3060');
  rect(ctx, 0, HUD_H - 1, SW, 1, '#05060f');
  text(ctx, o.left || '', 10, 4, { size: 16, color: COLORS.text });
  text(ctx, '客席', 132, 5, { size: 14, color: COLORS.accent });
  meter(ctx, 168, 7, 150, 12, o.heat ?? 0);
  const deg = Math.round((o.heat ?? 0) * 100);
  text(ctx, `${deg}℃`, 324, 5, { size: 14, color: deg >= 70 ? '#ff7a6c' : COLORS.text });
  if (o.clock != null) {
    const over = o.limit && o.clock > o.limit;
    const s = o.limit ? `尺 ${mmss(o.clock)}/${mmss(o.limit)}` : `尺 ${mmss(o.clock)}`;
    text(ctx, s, 372, 4, { size: 16, color: over ? COLORS.bad : o.limit && o.clock > o.limit - 15 ? COLORS.accent : COLORS.text });
  }
  if (o.rush != null) {
    text(ctx, 'テンポ', 520, 5, { size: 12, color: COLORS.dim });
    meter(ctx, 560, 8, 72, 10, o.rush, (f) => (f >= 0.75 ? '#ff5d6c' : f >= 0.45 ? '#ffd23f' : '#5ee07a'));
  } else if (o.right) text(ctx, o.right, SW - 10, 4, { size: 16, align: 'right', color: COLORS.pink });
}

// ------------------------------------------------------------------ speech bubbles
const mctx = () => scratch(8, 8)[1];
// Lay out a line: rows of up to maxW at 18px; a long one drops to 16px; returns { lines, size }
export function layoutText(str, maxW = 360, size = 18, maxRows = 3) {
  const c = mctx();
  const m = (x, s) => measure(c, x, s);
  const run = (s, W) => {
    const out = [];
    for (const para of String(str).split('\n')) {
      const segs = para.match(/[^、。！？]+[、。！？]*|[、。！？]+/g) || [''];
      let cur = '';
      for (const seg of segs) {
        if (m(cur + seg, s) <= W) { cur += seg; continue; }
        if (cur) out.push(cur);
        if (m(seg, s) <= W) { cur = seg; continue; }
        const rows = wrap(c, seg, W, s);
        cur = rows.pop();
        out.push(...rows);
      }
      out.push(cur);
    }
    return out;
  };
  let lines = run(size, maxW);
  if (lines.length <= maxRows) return { lines, size };
  lines = run(16, maxW + 40);
  if (lines.length <= maxRows + 1) return { lines, size: 16 };
  return { lines: run(14, maxW + 60), size: 14 };
}
// b: { lines, size, x?, y, w?, tailX, tailY, name, n (chars shown), narr (ト書き style), color }
export function makeBubble(str, o = {}) {
  const { lines, size } = layoutText(str, o.maxW || 380, o.size || 18);
  const c = mctx();
  const lh = size + 6;
  let tw = 0;
  for (const l of lines) tw = Math.max(tw, measure(c, l, size));
  const w = Math.min(SW - 24, Math.max(o.minW || 120, Math.ceil(tw) + 32));
  const h = 12 + lines.length * lh + 6;
  const cx = o.cx ?? o.tailX ?? SW / 2;
  const x = clamp(Math.round(cx - w / 2), 12, SW - 12 - w);
  const total = lines.reduce((k, l) => k + Array.from(l).length, 0);
  return { lines, size, lh, w, h, x, y: o.y ?? 40, tailX: o.tailX ?? null, tailY: o.tailY ?? null, name: o.name || null, nameCol: o.nameCol || '#ff8a3d', n: o.n ?? Infinity, total, narr: !!o.narr, ink: o.ink || '#1a1a28', fill: o.fill || '#ffffff' };
}
export function drawBubble(ctx, b) {
  const { x, y, w, h } = b;
  if (b.narr) {
    ctx.fillStyle = 'rgba(8,8,16,0.82)';
    ctx.fillRect(x, y, w, h);
    rect(ctx, x, y, w, 1, '#8a90b0');
    rect(ctx, x, y + h - 1, w, 1, '#8a90b0');
  } else {
    if (b.tailX != null) {
      const bx = clamp(b.tailX, x + 20, x + w - 20);
      const top = y + h - 3;
      const len = Math.max(0, (b.tailY ?? top + 30) - 10 - top);
      for (let i = 0; i < len; i++) {
        const t = i / Math.max(1, len);
        const cx = Math.round(bx + (b.tailX - bx) * t);
        const hw = Math.round((1 - t) * 9);
        rect(ctx, cx - hw - 2, top + i, hw * 2 + 4, 1, INK);
        if (hw > 0) rect(ctx, cx - hw, top + i, hw * 2, 1, b.fill);
      }
    }
    roundBox(ctx, x, y, w, h, b.fill, INK, '#dcdcea');
    if (b.tailX != null) { const bx = clamp(b.tailX, x + 20, x + w - 20); rect(ctx, bx - 9, y + h - 4, 18, 4, b.fill); }
  }
  if (b.name) {
    const nw = Math.ceil(measure(ctx, b.name, 14)) + 18;
    roundBox(ctx, x + 10, y - 14, nw, 22, b.nameCol, INK, shade(b.nameCol, -0.2));
    text(ctx, b.name, x + 19, y - 11, { size: 14, color: '#ffffff', shadow: null });
  }
  let left = b.n;
  b.lines.forEach((line, i) => {
    if (left <= 0) return;
    const chars = Array.from(line);
    const s = left >= chars.length ? line : chars.slice(0, left).join('');
    left -= chars.length;
    text(ctx, s, x + 16, y + 12 + i * b.lh, { size: b.size, color: b.narr ? '#d8dcf0' : b.ink, shadow: null });
  });
}
// The comic shout burst (ツッコミ etc.) centred at (cx, cy)
export function drawBurst(ctx, str, cx, cy, t, o = {}) {
  let size = o.size || 20;
  while (measure(ctx, str, size) > 250 && size > 14) size--;
  const rows = measure(ctx, str, size) > 250 ? wrap(ctx, str, 250, size) : [str];
  let tw = 0;
  for (const r of rows) tw = Math.max(tw, measure(ctx, r, size));
  const pop = t < 6 ? 0.6 + t * 0.07 : 1;
  const lh = size + 4;
  const rx = (tw / 2 + 28) * pop, ry = (28 + (rows.length - 1) * lh * 0.6) * pop;
  cx = clamp(cx, rx + 8, SW - rx - 8);
  const rot = t * 0.01;
  fillPoly(ctx, starPts(cx, cy, rx + 3, ry + 3, 14, 0.8, rot), INK);
  fillPoly(ctx, starPts(cx, cy, rx, ry, 14, 0.8, rot), o.weak ? '#c4c0d2' : '#f2c84a');
  fillPoly(ctx, starPts(cx - 1, cy - 1, rx - 5, ry - 5, 14, 0.8, rot), o.weak ? '#e8e4f0' : '#fff2a0');
  if (t < 5) return;
  const top = Math.round(cy - (rows.length * lh) / 2 + 2);
  rows.forEach((r, i) => {
    text(ctx, r, cx, top + i * lh, { size, align: 'center', color: o.weak ? '#4a4660' : '#c0182c', shadow: null });
    text(ctx, r, cx + 1, top + i * lh, { size, align: 'center', color: o.weak ? '#4a4660' : '#c0182c', shadow: null });
  });
}
export function impactStar(ctx, cx, cy, k) {
  const r = 12 + (9 - k) * 1.6;
  const rot = k * 0.2;
  fillPoly(ctx, starPts(cx, cy, r + 3, r + 3, 8, 0.45, rot), INK);
  fillPoly(ctx, starPts(cx, cy, r, r, 8, 0.45, rot), '#ffe066');
  fillPoly(ctx, starPts(cx - 1, cy - 1, r * 0.6, r * 0.6, 8, 0.5, rot), '#ffffff');
}
export function sheetOf(look) { return charSheetHD(look || {}); }
