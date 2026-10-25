// キングオブコント — HD sets (640x360) and screens: 予選会場の受付・大部屋楽屋・舞台袖・劇場ステージ、TBSの決勝スタジオ（KOCの
// 黒と金）、決勝進出者発表会見、敗者復活戦、反省会／打ち上げ、ドキュメント、エントリー用紙、きっかけ表、小道具チェック、結果一覧、
// 採点ボード、順位表、PV＋キャッチコピー、優勝の瞬間 (owner: E2). The crown and the wordmark are this game's own pixel art.
//
// pushSet(g, id, data) → handle { set(id, data), data, pop() }: an opaque HD backdrop under the dialogue window.
// card(g, draw, opts) → Promise: a full screen card (A / tap / auto under g.auto). pickRows(g, opts) → Promise<index>:
// an invisible picker over a backdrop that draws its own rows (keys ↑↓←→ A B, taps: first tap selects, second chooses).

import { SW, SH, clamp, makeCanvas } from './util.js';
import { text, measure, wrap } from './draw.js';
import { charSheetHD } from './sprites.js';
import { audio } from './audio.js';

export const KC = {
  bg: '#07070c', navy: '#0d1024', navy2: '#141936', gold: '#e8c25a', goldHi: '#fff0a8', goldDk: '#8a6a1a', red: '#c8283a',
  white: '#f4f4f8', dim: '#8a8aa0', ink: '#1a1a22', paper: '#f7f3e8', paper2: '#ebe4d2', line: '#c9bfa6', blue: '#2f6fd0', good: '#5ee07a', bad: '#ff6470', cyan: '#5fd7ff',
};
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
export function T(c, s, x, y, size = 12, color = KC.white, align = 'left', w = 0, opt = {}) {
  text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: opt.shadow === undefined ? null : opt.shadow, outline: opt.outline || null });
}
// a size that makes s fit in w (down to min)
export function fitSize(c, s, w, size, min = 10) { let z = size; while (z > min && measure(c, s, z) > w) z--; return z; }
export function para(c, s, x, y, w, size = 12, color = KC.white, lh = 0, maxLines = 99) {
  const ls = wrap(c, String(s ?? ''), w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], x, y + i * step, size, color);
  return n * step;
}
const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };

// ---------------------------------------------------------------- the crown + wordmark (this game's own design)
const CROWN = [
  'H.....H.....H',
  'GG...GHG...GG',
  'GGG.GGGGG.GGG',
  'GGGGGGGGGGGGG',
  'DGRGGGBGGGRGD',
  'GGGGGGGGGGGGG',
  'DDDDDDDDDDDDD',
];
export function crown(c, x, y, s = 2, glow = 0) {
  const col = { H: KC.goldHi, G: KC.gold, D: KC.goldDk, R: KC.red, B: '#3a7ae8' };
  CROWN.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const k = row[i]; if (k !== '.') R(c, x + i * s, y + j * s, s, s, col[k]); } });
  // shine: the three tips light up one after another
  if (glow > 0) { const tip = Math.floor(glow * 2.99); const ti = [0, 6, 12][tip]; c.globalAlpha = 0.85; R(c, x + ti * s - Math.floor(s / 2), y - s, s * 2, s, '#ffffff'); c.globalAlpha = 1; }
}
export function kocLogo(c, cx, y, size = 22, year = null) {
  const w = measure(c, 'キングオブコント', size);
  const s = Math.max(2, Math.round(size / 9));
  crown(c, Math.round(cx - (13 * s) / 2), y, s);
  T(c, 'キングオブコント', cx, y + 7 * s + 4, size, KC.gold, 'center', 0, { outline: '#2a1e00' });
  if (year) T(c, String(year), cx, y + 7 * s + 6 + size, Math.max(10, Math.round(size * 0.6)), KC.white, 'center', 0, { outline: '#000' });
  return w;
}

// ---------------------------------------------------------------- people
// look at (x, y) = top-left, k = scale of the 32x40 HD frame (k 2 → 64x80).
export function person(c, look, x, y, k = 2, dir = 'down', frame = 0, opt = {}) {
  if (!look) return;
  const sh = charSheetHD(look);
  const img = (sh[dir] && (sh[dir][frame] || sh[dir][0])) || sh.down[0];
  if (opt.shadow !== false) { c.globalAlpha = 0.28; R(c, x + 8 * k, y + 37 * k, 16 * k, 2 * k, '#000'); c.globalAlpha = 1; }
  if (opt.dark) { c.globalAlpha = opt.dark; }
  c.drawImage(img, Math.round(x), Math.round(y), 32 * k, 40 * k);
  c.globalAlpha = 1;
}
function silhouette(c, x, y, k, col = '#000') {
  // a head-and-shoulders audience silhouette (k = size)
  R(c, x + 3 * k, y, 6 * k, 6 * k, col);
  R(c, x + 2 * k, y + 1 * k, 8 * k, 4 * k, col);
  R(c, x, y + 6 * k, 12 * k, 6 * k, col);
}
function bulbRow(c, x, y, w, t) { for (let i = 0; i < w; i += 14) { R(c, x + i, y, 6, 6, (Math.floor(t / 20) + i / 14) % 3 ? '#ffe9a0' : '#fff8d0'); } }
function spot(c, cx, top, bottom, w0, w1, alpha = 0.12, col = '#fff6d0') {
  c.globalAlpha = alpha;
  c.fillStyle = col;
  for (let y = top; y < bottom; y += 2) { const k = (y - top) / Math.max(1, bottom - top); const hw = w0 + (w1 - w0) * k; c.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 2); }
  c.globalAlpha = 1;
}

// ---------------------------------------------------------------- conte set pieces on a stage (floor line fy)
export function setPieces(c, look, cx, fy, k = 1, t = 0) {
  const P = (x, y, w, h, col) => R(c, cx + x * k, fy + y * k, w * k, h * k, col);
  switch (look) {
    case 'shop': P(-150, -46, 90, 46, '#d8dde6'); P(-150, -50, 90, 6, '#9aa6b8'); P(-140, -40, 20, 10, '#3a3f4a'); P(60, -110, 80, 110, '#c0c8d4'); for (let i = 0; i < 4; i++) P(64, -104 + i * 26, 72, 4, '#7a8494'); for (let i = 0; i < 6; i++) P(68 + (i % 3) * 22, -98 + Math.floor(i / 3) * 26, 14, 18, ['#ff7a5a', '#ffd23f', '#5fd7ff'][i % 3]); break;
    case 'office': P(-120, -36, 110, 8, '#8a6a4a'); P(-116, -28, 6, 28, '#5a4a3a'); P(-20, -28, 6, 28, '#5a4a3a'); P(40, -38, 26, 6, '#3b3f48'); P(44, -32, 4, 32, '#2a2d36'); P(80, -120, 70, 50, '#f4f4f8'); P(80, -120, 70, 3, '#9aa6b8'); P(86, -110, 40, 2, '#2f6fd0'); P(86, -100, 30, 2, '#d62f2f'); break;
    case 'clinic': P(-130, -40, 70, 8, '#e8eef4'); P(-126, -32, 6, 32, '#9aa6b8'); P(-70, -32, 6, 32, '#9aa6b8'); P(10, -24, 22, 6, '#3a6fd8'); P(18, -18, 6, 18, '#5a5f6b'); P(70, -130, 80, 130, '#cfe6f0'); for (let i = 0; i < 6; i++) P(70 + i * 14, -130, 2, 130, '#a8c8d8'); break;
    case 'school': P(-160, -130, 150, 80, '#2f5a3a'); P(-160, -130, 150, 4, '#6a4a2a'); P(-150, -110, 40, 2, '#f4f4f8'); for (let i = 0; i < 3; i++) { P(-60 + i * 70, -30, 44, 6, '#c8a070'); P(-56 + i * 70, -24, 4, 24, '#7a5a3a'); P(-24 + i * 70, -24, 4, 24, '#7a5a3a'); } break;
    case 'ryokan': P(-170, -140, 340, 100, '#e8dcc0'); for (let i = 0; i < 9; i++) P(-170 + i * 40, -140, 3, 100, '#8a6a4a'); P(-170, -96, 340, 3, '#8a6a4a'); P(-60, -22, 120, 8, '#7a4a2a'); P(-54, -14, 6, 14, '#5a3a1a'); P(48, -14, 6, 14, '#5a3a1a'); break;
    case 'space': P(-160, -130, 320, 70, '#1a2440'); for (let i = 0; i < 14; i++) P(-150 + i * 22, -120 + (i % 2) * 18, 10, 8, (Math.floor(t / 15) + i) % 4 ? '#3aa8e8' : '#ff6470'); P(-40, -34, 80, 10, '#5a6a8a'); P(-6, -54, 12, 20, '#9aa6b8'); break;
    case 'party': P(-150, -130, 300, 60, '#f0d8e0'); for (let i = 0; i < 8; i++) P(-140 + i * 38, -126, 18, 18, i % 2 ? '#ff9ab0' : '#fff'); P(-6, -70, 4, 70, '#2a2d36'); P(-12, -76, 16, 10, '#3b3f48'); P(80, -40, 40, 40, '#5ee07a'); P(84, -54, 32, 16, '#ff7eb6'); break;
    case 'car': P(-110, -40, 50, 40, '#2a3560'); P(-110, -70, 10, 34, '#2a3560'); P(20, -40, 50, 40, '#2a3560'); P(60, -70, 10, 34, '#2a3560'); P(-84, -60, 26, 26, '#1e1e26'); P(-80, -56, 18, 18, '#3b3f48'); break;
    case 'gym': P(-140, -10, 120, 10, '#3a6fd8'); P(40, -18, 40, 6, '#5a5f6b'); P(36, -24, 8, 18, '#2a2d36'); P(76, -24, 8, 18, '#2a2d36'); P(100, -90, 60, 90, '#3b3f48'); P(104, -86, 52, 20, '#5fd7ff'); break;
    case 'dark': spot(c, cx, fy - 160 * k, fy, 10 * k, 80 * k, 0.16); P(-60, -36, 120, 8, '#5a4a3a'); P(-56, -28, 6, 28, '#3a2a1a'); P(50, -28, 6, 28, '#3a2a1a'); P(30, -60, 6, 24, '#2a2d36'); P(20, -64, 26, 8, '#ffd23f'); P(-30, -44, 22, 8, '#c8a050'); break;
    case 'park': P(-120, -30, 100, 8, '#8a5a2a'); P(-116, -22, 6, 22, '#5a3a1a'); P(-30, -22, 6, 22, '#5a3a1a'); P(-120, -50, 100, 6, '#8a5a2a'); P(80, -150, 8, 150, '#4a4f5a'); P(68, -160, 32, 14, '#fff6c8'); spot(c, cx + 84 * k, fy - 146 * k, fy, 10 * k, 60 * k, 0.12); break;
    default: P(-40, -30, 80, 8, '#7a5a3a'); P(-36, -22, 6, 22, '#5a3a1a'); P(30, -22, 6, 22, '#5a3a1a');
  }
}

// ---------------------------------------------------------------- the sets
// Each set: (c, t, d, g) with d = the handle's data. People: d.unit = [looks], d.others = [looks], d.staff = look …
const SETS = {
  // 予選会場の受付 (a theater lobby)
  reception(c, t, d) {
    R(c, 0, 0, SW, SH, '#2a1c18');
    R(c, 0, 0, SW, 200, '#d9c7a6'); for (let x = 0; x < SW; x += 40) R(c, x, 0, 2, 200, '#cbb794');
    R(c, 0, 196, SW, 6, '#8a6a4a'); R(c, 0, 202, SW, SH - 202, '#6a1f24'); for (let x = 0; x < SW; x += 24) R(c, x, 202, 1, SH, '#5a1a1f');
    // banner
    R(c, 70, 14, 500, 34, KC.bg); R(c, 70, 14, 500, 2, KC.gold); R(c, 70, 46, 500, 2, KC.gold);
    crown(c, 82, 20, 2);
    T(c, d.banner || 'キングオブコント 予選会場', 320, 22, 16, KC.gold, 'center', 440);
    // posters
    for (const [px, i] of [[20, 0], [580, 1]]) { R(c, px, 60, 44, 64, KC.bg); R(c, px + 2, 62, 40, 60, KC.navy); crown(c, px + 9, 72, 2); T(c, 'KOC', px + 22, 92, 10, KC.gold, 'center'); T(c, String(d.year || ''), px + 22, 106, 10, KC.white, 'center'); void i; }
    // fee sign + desk
    R(c, 330, 70, 210, 44, KC.paper); R(c, 330, 70, 210, 2, KC.line);
    T(c, 'エントリー料（当日お支払い）', 435, 74, 12, KC.ink, 'center', 200);
    T(c, d.feeText || '', 435, 92, 12, KC.red, 'center', 200);
    R(c, 300, 160, 280, 46, '#f4f4f8'); R(c, 300, 160, 280, 4, '#dcdce4'); R(c, 300, 202, 280, 4, '#b8b8c4');
    T(c, '受付', 440, 170, 14, KC.ink, 'center');
    person(c, d.staff, 370, 104, 1.6, 'down');
    person(c, d.staff2 || d.staff, 470, 104, 1.6, 'down');
    // queue with prop bags
    (d.others || []).slice(0, 5).forEach((lk, i) => { person(c, lk, 18 + i * 44, 168 + (i % 2) * 6, 1.6, 'right'); R(c, 46 + i * 44, 222 + (i % 2) * 6, 16, 14, '#b88a50'); });
    (d.unit || []).forEach((lk, i) => person(c, lk, 236 + i * 40, 178, 2, 'right'));
  },
  // 大部屋楽屋 (shared dressing room)
  gakuya(c, t, d) {
    R(c, 0, 0, SW, SH, '#4a3a30');
    R(c, 0, 0, SW, 210, '#cfc3b0'); R(c, 0, 206, SW, 4, '#8a7a64'); R(c, 0, 210, SW, SH, '#7a6a58');
    for (let x = 0; x < SW; x += 32) R(c, x, 210, 1, SH, '#6a5a48');
    // mirror row
    for (let i = 0; i < 4; i++) { const mx = 20 + i * 108; R(c, mx, 30, 92, 70, '#9ab0c0'); R(c, mx + 4, 34, 84, 62, '#c8dce8'); R(c, mx + 10, 40, 30, 4, '#e8f4fa'); bulbRow(c, mx, 22, 92, t + i * 7); }
    R(c, 0, 104, 440, 16, '#a88a64'); R(c, 0, 118, 440, 4, '#7a5a3a');
    // 出番表
    R(c, 456, 20, 160, 110, KC.paper); R(c, 456, 20, 160, 3, KC.line);
    T(c, d.boardTitle || '出番表', 536, 26, 12, KC.ink, 'center', 150);
    (d.order || []).slice(0, 6).forEach((o, i) => { const me = o.me; if (me) R(c, 460, 44 + i * 14, 152, 14, '#ffe08a'); T(c, `${o.n}. ${o.name}`, 464, 45 + i * 14, 10, me ? KC.red : KC.ink, 'left', 146); });
    // props / boxes / rack
    R(c, 456, 150, 70, 50, '#b88a50'); R(c, 462, 156, 58, 2, '#8a6a3a'); T(c, '小道具', 491, 168, 10, '#5a3a1a', 'center');
    R(c, 540, 136, 4, 70, '#5a5f6b'); R(c, 536, 134, 90, 4, '#5a5f6b'); for (let i = 0; i < 5; i++) R(c, 548 + i * 15, 138, 12, 44, ['#d64161', '#2f6fd0', '#f2f2f2', '#3f8a3a', '#ffd23f'][i]);
    // monitor
    R(c, 330, 140, 96, 60, '#1e1e26'); R(c, 334, 144, 88, 48, '#0a0a12'); R(c, 334, 176, 88, 16, '#3a2a1a'); person(c, d.monitorLook || null, 360, 146, 0.8, 'down', 0, { shadow: false });
    T(c, 'ステージ', 378, 194, 9, KC.dim, 'center');
    // others rehearsing (pairs facing each other)
    // two pairs rehearsing face to face on the left, the player's act in the middle
    const P = [[6, 126, 'right'], [54, 126, 'left'], [110, 152, 'right'], [158, 152, 'left']];
    (d.others || []).slice(0, 4).forEach((lk, i) => person(c, lk, P[i][0], P[i][1], 1.6, P[i][2]));
    (d.unit || []).forEach((lk, i, a) => person(c, lk, 236 + i * 52 - (a.length - 2) * 20, 172, 2, a.length === 2 ? (i ? 'left' : 'right') : 'down'));
  },
  // 舞台袖 (the wings): dark, the cue light, the stage manager with a headset
  sode(c, t, d) {
    R(c, 0, 0, SW, SH, '#0a0a10');
    // the lit stage beyond the legs
    R(c, 420, 0, 220, 230, '#3a2f1a'); spot(c, 540, 0, 230, 20, 120, 0.25);
    for (let i = 0; i < 3; i++) R(c, 380 + i * 70, 0, 40, 240, '#15151c');
    R(c, 0, 230, SW, SH - 230, '#1a1a22'); R(c, 0, 230, SW, 2, '#2a2a34');
    // tape marks (バミリ)
    for (const x of [150, 230, 310]) { R(c, x, 236, 14, 3, '#ffd23f'); R(c, x + 5, 232, 3, 11, '#ffd23f'); }
    // cue light
    const on = d.cue || Math.floor(t / 30) % 2 === 0;
    R(c, 60, 40, 30, 46, '#2a2a34'); R(c, 64, 44, 22, 18, on ? '#ff3848' : '#5a1a20'); R(c, 64, 64, 22, 18, d.cue === 'go' ? '#3ae878' : '#1a4a2a');
    T(c, 'CUE', 75, 90, 10, KC.dim, 'center');
    // monitor of the stage
    R(c, 110, 30, 110, 70, '#2a2a34'); R(c, 114, 34, 102, 56, '#101018'); spot(c, 165, 34, 90, 6, 30, 0.2);
    T(c, 'ステージ モニター', 165, 92, 9, KC.dim, 'center');
    person(c, d.staff, 40, 120, 2, 'right');
    R(c, 46, 124, 8, 4, '#3b3f48'); // headset
    (d.unit || []).forEach((lk, i) => person(c, lk, 180 + i * 56, 148, 2, 'right', 0, { dark: 0.92 }));
    if (d.label) { R(c, 420, 206, 210, 20, '#000'); T(c, d.label, 525, 209, 12, KC.gold, 'center', 200); }
  },
  // 予選の劇場ステージ (audience view). d.light: 'dark' | 'up'; d.look: set pieces; d.unit: performers
  stage(c, t, d) {
    R(c, 0, 0, SW, SH, '#050508');
    const lit = d.light !== 'dark';
    // proscenium
    R(c, 0, 0, SW, 20, '#3a0a14'); for (let x = 0; x < SW; x += 6) R(c, x, 18, 3, 6, '#5a1420');
    R(c, 40, 24, 560, 206, lit ? '#14141c' : '#020203');
    if (lit) { spot(c, 200, 24, 226, 14, 90, 0.10); spot(c, 440, 24, 226, 14, 90, 0.10); spot(c, 320, 24, 226, 20, 160, 0.06); }
    // a hung banner
    if (lit && d.banner) { R(c, 200, 30, 240, 22, KC.bg); crown(c, 206, 34, 2); T(c, d.banner, 330, 34, 12, KC.gold, 'center', 200); }
    // floor
    R(c, 40, 226, 560, 6, lit ? '#6a4a2a' : '#0a0806');
    if (lit) setPieces(c, d.look, 320, 226, 1, t);
    if (lit) (d.unit || []).forEach((lk, i, a) => person(c, lk, 320 - (a.length * 60) / 2 + i * 60 - 2, 146 - (d.bounce && Math.floor(t / 8) % 2 ? 2 : 0), 2, a.length === 1 ? 'down' : i < a.length / 2 ? 'right' : 'left'));
    R(c, 0, 24, 40, 220, '#5a1420'); R(c, 600, 24, 40, 220, '#5a1420');
    for (let x = 4; x < 40; x += 8) { R(c, x, 24, 3, 220, '#3a0a14'); R(c, 600 + x, 24, 3, 220, '#3a0a14'); }
    // audience (heads bob with the laughter)
    const heat = clamp(d.heat || 0, 0, 1);
    for (let i = 0; i < 22; i++) {
      const bob = heat > 0.3 && (Math.floor(t / (10 - heat * 5)) + i) % 3 === 0 ? -3 : 0;
      silhouette(c, -6 + i * 30, 236 + (i % 2) * 8 + bob, 2.4, '#000');
    }
    if (!lit) { T(c, d.darkText || '', 320, 120, 14, '#333340', 'center'); }
  },
  // TBS 決勝スタジオ (KOC's black and gold). d.view: 'wide' | 'stage' | 'dark'; d.judges: [{ look, name }]; d.screen: lines
  studio(c, t, d) {
    R(c, 0, 0, SW, SH, KC.bg);
    // LED back wall
    for (let x = 0; x < SW; x += 20) R(c, x, 0, 18, 150, x % 40 ? '#0b0d1c' : '#0e1124');
    for (let i = 0; i < 12; i++) { const x = 26 + i * 52; const k = (Math.sin(t / 25 + i) + 1) / 2; c.globalAlpha = 0.25 + k * 0.35; R(c, x, 0, 4, 150, KC.gold); c.globalAlpha = 1; }
    // the crown emblem
    crown(c, 320 - 39, 18, 6, 0.01 + (Math.floor(t / 20) % 3) / 3);
    T(c, 'KING OF CONTE', 320, 64, 14, KC.goldHi, 'center', 0, { outline: '#2a1e00' });
    T(c, String(d.year || ''), 320, 82, 12, KC.white, 'center');
    // the stage platform
    R(c, 120, 196, 400, 18, '#1a1a26'); R(c, 120, 196, 400, 2, KC.gold); R(c, 120, 212, 400, 2, KC.goldDk);
    if (d.view === 'stage' || d.view === 'dark') {
      R(c, 120, 96, 400, 100, d.view === 'dark' ? '#000' : '#10121e');
      if (d.view !== 'dark') { spot(c, 320, 96, 196, 30, 150, 0.12); setPieces(c, d.look, 320, 196, 0.8, t); (d.unit || []).forEach((lk, i, a) => person(c, lk, 320 - (a.length * 54) / 2 + i * 54, 118, 1.9, a.length === 1 ? 'down' : i < a.length / 2 ? 'right' : 'left')); }
    } else {
      // stairs + side LED towers
      for (let i = 0; i < 5; i++) R(c, 250 - i * 10, 160 + i * 8, 140 + i * 20, 8, i % 2 ? '#20222e' : '#262838');
      (d.unit || []).forEach((lk, i, a) => person(c, lk, 320 - (a.length * 54) / 2 + i * 54, 118, 1.9, 'down'));
    }
    // MC podium (left)
    R(c, 18, 150, 96, 64, '#14162a'); R(c, 18, 150, 96, 3, KC.gold); crown(c, 53, 166, 2);
    person(c, d.mc, 20, 76, 1.8, 'right'); if (d.mc2) person(c, d.mc2, 66, 82, 1.6, 'right');
    // score screen (right)
    R(c, 526, 30, 104, 110, '#000'); R(c, 528, 32, 100, 106, KC.navy);
    (d.screen || ['KOC']).slice(0, 5).forEach((s, i) => { const z = fitSize(c, String(s), 94, i === 0 ? 12 : 14, 9); T(c, s, 578, 38 + i * 20, z, i === 0 ? KC.gold : KC.white, 'center', 96); });
    // judges' desk (backs) at the front
    const J = d.judges || [];
    R(c, 60, 226, 520, 40, '#16182a'); R(c, 60, 226, 520, 3, KC.gold);
    J.forEach((j, i) => { const n = J.length; const x = 320 - (n * 72) / 2 + i * 72 + 4; person(c, j.look, x, 190, 1.6, 'up'); R(c, x + 2, 244, 50, 14, '#000'); T(c, j.short || '', x + 27, 245, 10, KC.goldHi, 'center', 48); });
    // audience risers in the dark
    for (let i = 0; i < 6; i++) { silhouette(c, 4 + i * 16, 262 + (i % 2) * 6, 1.4, '#05050a'); silhouette(c, 540 + i * 16, 262 + (i % 2) * 6, 1.4, '#05050a'); }
    if (d.onair) { R(c, 8, 8, 64, 18, KC.red); T(c, 'ON AIR', 40, 10, 12, '#fff', 'center'); }
  },
  // TBS 決勝の楽屋
  tbsgakuya(c, t, d) {
    R(c, 0, 0, SW, SH, '#2a2620');
    R(c, 0, 0, SW, 210, '#e8e0d0'); R(c, 0, 206, SW, 4, '#a89a80'); R(c, 0, 210, SW, SH, '#8a7a64');
    R(c, 30, 30, 140, 90, '#9ab0c0'); R(c, 34, 34, 132, 82, '#cfe0ea'); bulbRow(c, 30, 22, 140, t);
    R(c, 0, 124, 220, 14, '#b8a080');
    R(c, 240, 30, 120, 76, '#1e1e26'); R(c, 244, 34, 112, 60, KC.navy); crown(c, 285, 46, 3); T(c, '本番中', 300, 96, 10, KC.dim, 'center');
    R(c, 400, 26, 60, 150, '#c8b088'); R(c, 404, 30, 52, 142, '#d8c098');
    // the 楽屋札 on the door: vertical writing on white paper
    const chars = Array.from(String(d.door || '')).slice(0, 10);
    R(c, 418, 32, 24, Math.max(30, chars.length * 12 + 8), '#fff');
    chars.forEach((ch, i) => T(c, ch === 'ー' ? '｜' : ch === ' ' ? '' : ch, 430, 36 + i * 12, 11, KC.ink, 'center'));
    R(c, 500, 140, 110, 30, '#a8865a'); R(c, 510, 128, 30, 12, '#fff'); R(c, 548, 128, 30, 12, '#fff'); R(c, 590, 110, 16, 30, '#5ee07a'); R(c, 586, 100, 24, 14, '#ff7eb6');
    T(c, '差し入れ', 555, 172, 10, '#5a4a3a', 'center');
    (d.unit || []).forEach((lk, i, a) => person(c, lk, 220 + i * 56 - (a.length - 2) * 22, 160, 2, 'down'));
    if (d.visitor) person(c, d.visitor, 470, 160, 2, 'left');
  },
  // 決勝進出者発表会見
  press(c, t, d) {
    R(c, 0, 0, SW, SH, '#101018');
    R(c, 0, 0, SW, 220, KC.navy);
    for (let y = 0; y < 220; y += 44) for (let x = (y / 44) % 2 ? 20 : 0; x < SW; x += 80) { crown(c, x + 18, y + 10, 2); T(c, 'KOC', x + 31, y + 28, 9, KC.goldDk, 'center'); }
    R(c, 0, 220, SW, SH, '#1a1a26'); R(c, 0, 220, SW, 3, KC.gold);
    const list = d.lineup || [];
    const n = list.length;
    list.forEach((u, i) => {
      const w = Math.min(60, 580 / Math.max(1, n));
      const x = 30 + i * (580 / Math.max(1, n)) + (580 / Math.max(1, n) - w) / 2;
      person(c, u.look, x + w / 2 - 26, 130, 1.6, 'down');
      R(c, x, 200, w, 16, u.me ? KC.red : '#000'); T(c, u.name, x + w / 2, 202, 9, u.me ? '#fff' : KC.goldHi, 'center', w - 2);
    });
    // flashes
    for (let i = 0; i < 4; i++) { if ((Math.floor(t / 7) + i * 3) % 11 === 0) { c.globalAlpha = 0.5; R(c, 60 + i * 150, 250, 30, 30, '#fff'); c.globalAlpha = 1; } }
    for (let i = 0; i < 9; i++) silhouette(c, 6 + i * 72, 244, 2.4, '#05050a');
    if (d.title) { R(c, 120, 6, 400, 26, '#000'); T(c, d.title, 320, 10, 14, KC.gold, 'center', 390); }
  },
  // 敗者復活戦 (2026-): a stage with the vote screen
  revival(c, t, d) {
    R(c, 0, 0, SW, SH, '#0c0c18');
    R(c, 60, 10, 520, 120, '#000'); R(c, 64, 14, 512, 112, '#101a3a');
    T(c, d.title || '敗者復活戦', 320, 20, 16, KC.gold, 'center', 500);
    if (!(d.bars && d.bars.length) && d.acts && d.acts.length) {
      T(c, `出場${d.acts.length}組`, 320, 40, 11, KC.dim, 'center');
      d.acts.slice(0, 10).forEach((n, i) => T(c, n, i % 2 ? 330 : 90, 56 + Math.floor(i / 2) * 13, 11, KC.white, 'left', 220));
    }
    for (let i = 0; i < 6; i++) spot(c, 110 + i * 84, 130, 214, 6, 26, 0.07);
    (d.bars || []).slice(0, 3).forEach((b, i) => { const w = Math.round(380 * clamp(b.v, 0, 1)); T(c, b.name, 76, 50 + i * 24, 12, b.me ? KC.goldHi : KC.white, 'left', 120); R(c, 200, 52 + i * 24, 380, 12, '#1a2448'); R(c, 200, 52 + i * 24, w, 12, b.me ? KC.gold : KC.cyan); if (b.label) T(c, b.label, 572, 50 + i * 24, 12, KC.white, 'right'); });
    R(c, 100, 200, 440, 16, '#1a1a26'); R(c, 100, 200, 440, 2, KC.gold);
    (d.unit || []).forEach((lk, i, a) => person(c, lk, 320 - (a.length * 54) / 2 + i * 54, 122, 1.9, 'down'));
    for (let i = 0; i < 24; i++) silhouette(c, -6 + i * 28, 238 + (i % 2) * 8, 2.2, '#000');
  },
  // 生・大反省会 (2024-) / 打ち上げ
  hanseikai(c, t, d) {
    if (d.party) {
      R(c, 0, 0, SW, SH, '#3a2418'); R(c, 0, 0, SW, 190, '#7a4a2a'); for (let i = 0; i < 9; i++) { R(c, 20 + i * 70, 20, 26, 34, '#d62f2f'); R(c, 22 + i * 70, 24, 22, 26, '#ff6a50'); }
      T(c, '打ち上げ', 320, 66, 16, '#ffe9a0', 'center');
      const L0 = (d.people || []).slice(0, 12);
      const back = L0.slice(0, Math.ceil(L0.length / 2)), front = L0.slice(Math.ceil(L0.length / 2));
      back.forEach((lk, i) => person(c, lk, 320 - (back.length * 76) / 2 + i * 76 + 12, 104, 1.6, 'down'));
      R(c, 60, 166, 520, 40, '#a8764a'); R(c, 60, 166, 520, 4, '#c89a6a');
      for (let i = 0; i < 8; i++) { R(c, 84 + i * 62, 156, 14, 16, '#ffd23f'); R(c, 84 + i * 62, 156, 14, 3, '#fff6c8'); }
      front.forEach((lk, i) => person(c, lk, 320 - (front.length * 76) / 2 + i * 76 + 12, 176, 1.6, 'up'));
      return;
    } else {
      R(c, 0, 0, SW, SH, '#101018'); R(c, 0, 0, SW, 200, '#1a1430');
      R(c, 160, 18, 320, 40, '#000'); R(c, 162, 20, 316, 36, '#2a0a3a'); T(c, d.title || '生・大反省会', 320, 28, 16, '#ffe0f0', 'center', 300);
      R(c, 40, 196, 560, 10, '#2a2440');
    }
    const L = (d.people || []).slice(0, 12);
    const back = L.slice(0, Math.ceil(L.length / 2)), front = L.slice(Math.ceil(L.length / 2));
    const row = (list, y, k) => list.forEach((lk, i) => { const x = 320 - (list.length * 84) / 2 + i * 84 + 10; if (!d.party) { R(c, x + 6, y + 30 * k, 40, 8, '#4a3a6a'); R(c, x + 10, y + 38 * k, 4, 10, '#2a2440'); R(c, x + 38, y + 38 * k, 4, 10, '#2a2440'); } person(c, lk, x, y, k, 'down'); });
    row(back, 104, 1.6);
    row(front, 150, 1.7);
  },
  // a quiet set for notices (the player's room at night, the phone glowing)
  night(c, t, d) {
    R(c, 0, 0, SW, SH, '#0a0c1a'); R(c, 0, 0, SW, 220, '#14183a');
    R(c, 440, 30, 150, 110, '#0a0c1a'); R(c, 444, 34, 142, 102, '#1a2050'); for (let i = 0; i < 20; i++) R(c, 450 + ((i * 37) % 130), 40 + ((i * 23) % 90), 2, 2, '#fff6c8');
    R(c, 0, 220, SW, SH, '#3a2a20');
    R(c, 80, 190, 200, 40, '#5a3a2a'); R(c, 80, 186, 200, 6, '#7a5a3a');
    (d.unit || []).forEach((lk, i) => person(c, lk, 300 + i * 56, 150, 2, 'down'));
    if (d.glow) { c.globalAlpha = 0.25 + 0.1 * Math.sin(t / 10); R(c, 300, 180, 120, 60, '#9adfff'); c.globalAlpha = 1; }
  },
};
SETS.dark = (c) => R(c, 0, 0, SW, SH, '#000');
// screens drawn as sets (the flow puts a picker over them)
SETS.form = (c, t, d) => drawForm(c, t, d);
SETS.props = (c, t, d) => drawProps(c, t, d);
SETS.cue = (c, t, d) => drawCueSheet(c, t, d);

// ---------------------------------------------------------------- backdrop handle
export class SetScene {
  constructor(g, id, data) { Object.assign(this, { g, id, data: data || {}, hd: true, opaque: true, hidesHud: true, isKoc: true, t: 0 }); }
  update() { this.t++; }
  draw(c, g) {
    const fn = SETS[this.id] || SETS.dark;
    try { fn(c, this.t, this.data, g); } catch (e) { console.error('[koc art]', this.id, e); R(c, 0, 0, SW, SH, '#000'); }
    if (this.data.caption) { R(c, 0, 0, SW, 22, 'rgba(0,0,0,0.65)'); crown(c, 6, 5, 1); T(c, this.data.caption, 24, 4, 12, KC.gold, 'left', SW - 30); }
    if (this.data.dim) { c.globalAlpha = this.data.dim; R(c, 0, 0, SW, SH, '#000'); c.globalAlpha = 1; }
  }
}
export function pushSet(g, id, data = {}) {
  const sc = new SetScene(g, id, data);
  g.push(sc);
  return {
    scene: sc,
    get data() { return sc.data; },
    set(nid, nd) { sc.id = nid; if (nd) sc.data = nd; sc.t = 0; },
    merge(nd) { Object.assign(sc.data, nd); },
    pop() { const i = g.scenes.indexOf(sc); if (i >= 0) g.scenes.splice(i, 1); },
  };
}

// ---------------------------------------------------------------- taps (first tap selects, second chooses)
let tapCanvas = null;
const kocTop = (g) => g && g.top && g.top.isKocPick ? g.top : null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = kocTop(g);
    if (!sc) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

// A row picker over a set that draws its own rows from d.sel. opts: { data (the set's data), n, rects: [{x,y,w,h}],
//   onLeft(i), onRight(i), cancel (index on B; default -1), auto (index under g.auto) }
class PickScene {
  constructor(g, o, resolve) { Object.assign(this, { g, o, resolve, hd: true, isKocPick: true, t: 0, tapAt: null }); bindTap(g); }
  update(g) {
    this.t++;
    const o = this.o, d = o.data, inp = g.input;
    if (g.auto) { g.pop(this); this.resolve(o.auto ?? (o.n - 1)); return; }
    const tap = this.tapAt; this.tapAt = null;
    if (this.t < 4) return;
    if (tap) {
      const now = inp.pressedNow || {};
      const i = (o.rects || []).findIndex((r) => inR(tap.x, tap.y, r));
      if (i >= 0) {
        now.a = false;
        if (d.sel === i) { sfx('ok'); this.done(i); } else { d.sel = i; sfx('cursor'); }
        return;
      }
      if (o.tapOutside === 'next') { now.a = false; sfx('ok'); this.done(d.sel); return; }
    }
    if (inp.repeat('up')) { d.sel = (d.sel + o.n - 1) % o.n; sfx('cursor'); }
    else if (inp.repeat('down')) { d.sel = (d.sel + 1) % o.n; sfx('cursor'); }
    else if (inp.repeat('left') && o.onLeft) { o.onLeft(d.sel); sfx('cursor'); }
    else if (inp.repeat('right') && o.onRight) { o.onRight(d.sel); sfx('cursor'); }
    else if (inp.pressed('a')) { sfx('ok'); this.done(d.sel); }
    else if (inp.pressed('b') && o.cancel !== null) { sfx('cancel'); this.done(o.cancel ?? -1); }
  }
  done(v) { this.g.pop(this); this.resolve(v); }
  draw() {}
}
export function pickRows(g, o) { if (!Number.isInteger(o.data.sel)) o.data.sel = 0; return new Promise((res) => g.push(new PickScene(g, o, res))); }

// A full-screen card: draw(c, t, g) every frame; closes on A / tap after `min` frames, or after `life` frames, or at once
// under g.auto. opts: { min (frames, default 20), life (auto-close), opaque (default true), sound }
class CardScene {
  constructor(g, draw, o, resolve) { Object.assign(this, { g, drawFn: draw, o, resolve, hd: true, opaque: o.opaque !== false, hidesHud: true, isKocPick: true, t: 0, tapAt: null }); bindTap(g); }
  update(g) {
    this.t++;
    if (g.auto) { this.close(); return; }
    const tap = this.tapAt; this.tapAt = null;
    const min = this.o.min ?? 20;
    if (this.o.life && this.t >= this.o.life) { this.close(); return; }
    if (this.t > min && (g.input.pressed('a') || g.input.pressed('b') || tap)) { if (tap && g.input.pressedNow) g.input.pressedNow.a = false; sfx('cursor'); this.close(); }
  }
  close() { if (this.closed) return; this.closed = true; this.g.pop(this); this.resolve(); }
  draw(c, g) {
    try { this.drawFn(c, this.t, g); } catch (e) { console.error('[koc card]', e); }
    if (!this.o.noHint && this.t > (this.o.min ?? 20) && Math.floor(this.t / 30) % 2 === 0) T(c, '▼', SW - 18, SH - 18, 12, KC.gold, 'center');
  }
}
export function card(g, draw, o = {}) { return new Promise((res) => g.push(new CardScene(g, draw, o, res))); }

// ---------------------------------------------------------------- confetti
const CONF = [KC.gold, KC.goldHi, '#ff7eb6', '#5fd7ff', '#ffffff', KC.red];
export function confetti(c, t, n = 90) {
  for (let i = 0; i < n; i++) {
    const sp = 0.7 + (i % 5) * 0.25;
    const x = ((i * 71) % (SW + 20)) - 10 + Math.sin((t + i * 17) / 18) * 8;
    const y = ((t * sp * 1.6 + i * 41) % (SH + 20)) - 10;
    R(c, x, y, Math.floor((t + i * 7) / 8) % 2 ? 3 : 5, 3, CONF[i % CONF.length]);
  }
}

// ---------------------------------------------------------------- screens drawn by the flow (data in, pixels out)
// エントリー用紙. d = { year, title, rows: [{ label, value, edit, ok }], sel, note, submit }
export function drawForm(c, t, d) {
  R(c, 0, 0, SW, SH, '#3a3f4a');
  for (let x = 0; x < SW; x += 32) R(c, x, 0, 1, SH, '#343944');
  // the sheet
  R(c, 64, 8, 516, 346, '#00000055');
  R(c, 60, 4, 516, 346, KC.paper);
  R(c, 60, 4, 516, 40, KC.bg); crown(c, 72, 12, 2);
  T(c, d.title || 'エントリー用紙', 318, 8, 16, KC.gold, 'center', 380);
  T(c, d.sub || '', 318, 27, 10, KC.white, 'center', 440);
  const rows = d.rows || [];
  const y0 = 50, rh = 22;
  d.rects = [];
  rows.forEach((r, i) => {
    const y = y0 + i * rh;
    const sel = d.sel === i;
    if (sel) R(c, 64, y, 508, rh, '#ffe9a0');
    R(c, 64, y + rh - 1, 508, 1, KC.line);
    T(c, r.label, 72, y + 4, 12, r.submit ? KC.red : '#5a5040', 'left', 150);
    if (!r.submit) R(c, 222, y + 2, 1, rh - 4, KC.line);
    if (r.check != null) { R(c, 232, y + 4, 13, 13, KC.ink); R(c, 233, y + 5, 11, 11, '#fff'); if (r.check) T(c, '✓', 238, y + 2, 13, KC.red, 'center'); T(c, r.value, 252, y + 4, 12, KC.ink, 'left', 312); }
    else T(c, r.value, r.submit ? 318 : 232, y + 4, 12, r.submit ? KC.red : r.ok === false ? '#b03a2a' : KC.ink, r.submit ? 'center' : 'left', r.submit ? 480 : 332);
    if (r.edit && sel) T(c, 'A：変更', 566, y + 5, 10, KC.blue, 'right');
    d.rects.push({ x: 64, y, w: 508, h: rh });
  });
  if (d.note) para(c, d.note, 72, y0 + rows.length * rh + 6, 492, 10, '#5a5040', 13, 3);
  if (d.stamp) { c.globalAlpha = 0.85; R(c, 470, 300, 90, 40, 'rgba(0,0,0,0)'); T(c, d.stamp, 515, 306, 18, KC.red, 'center', 0, { outline: '#fff' }); c.globalAlpha = 1; }
}
// きっかけ表 (音響・照明の打ち合わせ). d = { rows: [{ label, opts, v }], sel, title, hint, setName }
export function drawCueSheet(c, t, d) {
  R(c, 0, 0, SW, SH, '#101018');
  R(c, 0, 0, SW, 30, '#000'); T(c, d.title || '音響・照明 きっかけ表', 12, 8, 14, KC.gold, 'left', 400); T(c, d.setName || '', SW - 12, 9, 12, KC.white, 'right', 220);
  // the console
  R(c, 20, 40, 600, 220, '#1e1e2a'); R(c, 20, 40, 600, 2, '#3a3a50');
  d.rects = [];
  (d.rows || []).forEach((r, i) => {
    const y = 52 + i * 40;
    const sel = d.sel === i;
    R(c, 30, y, 580, 34, sel ? '#2a3050' : '#181824');
    if (sel) R(c, 30, y, 3, 34, KC.gold);
    T(c, r.label, 44, y + 10, 12, KC.dim, 'left', 110);
    const opt = r.opts[r.v] || '';
    T(c, '◀', 170, y + 9, 13, sel ? KC.gold : '#444', 'center');
    T(c, opt, 380, y + 10, 13, KC.white, 'center', 380);
    T(c, '▶', 590, y + 9, 13, sel ? KC.gold : '#444', 'center');
    for (let k = 0; k < 6; k++) R(c, 44 + k * 10, y + 26, 6, 3, (k + i + Math.floor(t / 12)) % 5 ? '#2a4a2a' : '#5ee07a');
    d.rects.push({ x: 30, y, w: 580, h: 34 });
  });
  const ny = 52 + (d.rows || []).length * 40;
  const okSel = d.sel === (d.rows || []).length;
  R(c, 230, ny + 4, 180, 26, okSel ? KC.gold : '#2a2a3a'); T(c, 'これで決定', 320, ny + 10, 13, okSel ? KC.ink : KC.white, 'center');
  d.rects.push({ x: 230, y: ny + 4, w: 180, h: 26 });
  if (d.hint) { R(c, 20, 300, 600, 52, '#000'); para(c, d.hint, 30, 306, 580, 11, KC.white, 15, 3); }
}
// 小道具チェックリスト. d = { items: [{ name, ok, missing }], sel, title }
export function drawProps(c, t, d) {
  R(c, 0, 0, SW, SH, '#2a2018');
  R(c, 0, 0, SW, 30, '#000'); T(c, d.title || '小道具の搬入と確認', 12, 8, 14, KC.gold, 'left', 600);
  R(c, 40, 44, 320, 290, '#c8a070'); R(c, 46, 50, 308, 278, '#e8d0a0');
  T(c, 'チェックリスト', 200, 56, 13, '#5a3a1a', 'center');
  d.rects = [];
  (d.items || []).forEach((it, i) => {
    const y = 80 + i * 30;
    const sel = d.sel === i;
    if (sel) R(c, 52, y - 2, 296, 26, '#fff2c0');
    R(c, 60, y + 3, 16, 16, '#5a3a1a'); R(c, 62, y + 5, 12, 12, '#fff');
    if (it.ok) T(c, '✓', 68, y + 2, 14, KC.red, 'center');
    T(c, it.name, 86, y + 3, 13, '#3a2a1a', 'left', 200);
    if (it.missing && it.ok === false && it.checked) T(c, '見当たらない！', 340, y + 4, 11, KC.red, 'right');
    d.rects.push({ x: 52, y: y - 2, w: 296, h: 26 });
  });
  const ny = 80 + (d.items || []).length * 30 + 6;
  const okSel = d.sel === (d.items || []).length;
  R(c, 120, ny, 160, 24, okSel ? '#5a3a1a' : '#b08a5a'); T(c, '確認おわり', 200, ny + 5, 12, '#fff', 'center');
  d.rects.push({ x: 120, y: ny, w: 160, h: 24 });
  // boxes
  R(c, 400, 160, 200, 130, '#b88a50'); R(c, 400, 160, 200, 4, '#8a6a3a'); R(c, 420, 120, 140, 50, '#c89a60'); T(c, d.unitName || '', 500, 214, 12, '#5a3a1a', 'center', 180);
  T(c, '「割れ物注意」', 500, 236, 11, KC.red, 'center');
}
// 結果一覧 (the official results page). d = { title, sub, rows: [{ no, name, pass, me }], scroll, verdict }
export function drawBoard(c, t, d) {
  R(c, 0, 0, SW, SH, '#f2f2f4');
  R(c, 0, 0, SW, 44, KC.bg); crown(c, 12, 10, 2); T(c, d.title || '', 48, 6, 14, KC.gold, 'left', 560); T(c, d.sub || '', 48, 25, 10, KC.white, 'left', 560);
  const rows = d.rows || [];
  const cols = 3, rh = 22, colW = 200;
  const per = cols * 12;
  const start = Math.max(0, Math.min(rows.length - per, Math.floor((d.scroll || 0) / cols) * cols));
  for (let i = 0; i < Math.min(per, rows.length - start); i++) {
    const r = rows[start + i];
    const x = 16 + (i % cols) * (colW + 4), y = 54 + Math.floor(i / cols) * rh;
    R(c, x, y, colW, rh - 3, r.me ? (r.pass ? '#ffe08a' : '#ffd0d0') : r.pass ? '#ffffff' : '#e4e4ea');
    T(c, String(r.no), x + 6, y + 3, 12, r.pass ? KC.red : '#8a8a94', 'left');
    T(c, r.name, x + 48, y + 3, 12, r.pass ? KC.ink : '#8a8a94', 'left', colW - 52);
  }
  if (rows.length > per) T(c, `${start + 1}〜${Math.min(rows.length, start + per)} / ${rows.length}`, SW - 12, 334, 10, '#5a5a66', 'right');
  if (d.verdict) { const ok = d.verdict.ok; R(c, 140, 300, 360, 46, ok ? KC.red : '#3a3a48'); T(c, d.verdict.text, 320, 312, 18, '#fff', 'center', 350); }
  if (d.legend) T(c, d.legend, 16, 334, 10, '#5a5a66', 'left', 400);
}
// 採点ボード. d = { name, title, cells: [{ label, v, shown }], total, max, mode, sub }
export function drawScore(c, t, d) {
  R(c, 0, 0, SW, SH, KC.bg);
  for (let i = 0; i < 16; i++) { c.globalAlpha = 0.12; R(c, i * 40 + ((t * 2) % 40), 0, 2, SH, KC.gold); c.globalAlpha = 1; }
  crown(c, 20, 14, 2); T(c, d.title || '', 50, 14, 12, KC.gold, 'left', 400);
  const nz = fitSize(c, d.name || '', 560, 26, 14);
  T(c, d.name || '', 320, 40, nz, KC.white, 'center', 600, { outline: '#000' });
  const cells = d.cells || [];
  const n = cells.length;
  const cw = Math.min(96, Math.floor(600 / Math.max(1, n)) - 6);
  cells.forEach((cl, i) => {
    const x = 320 - (n * (cw + 6)) / 2 + i * (cw + 6);
    R(c, x, 100, cw, 120, KC.navy2); R(c, x, 100, cw, 2, KC.gold);
    T(c, cl.label, x + cw / 2, 106, 10, KC.dim, 'center', cw - 4);
    if (cl.shown) { const z = fitSize(c, String(cl.v), cw - 6, 40, 16); T(c, String(cl.v), x + cw / 2, 140, z, KC.goldHi, 'center'); }
    else T(c, '?', x + cw / 2, 140, 30, '#3a3a50', 'center');
  });
  if (d.total != null) { R(c, 180, 238, 280, 66, '#000'); R(c, 180, 238, 280, 2, KC.gold); T(c, '合計', 200, 250, 14, KC.dim, 'left'); T(c, `${d.total}`, 420, 246, 40, KC.gold, 'right', 0, { outline: '#3a2a00' }); T(c, d.max ? `/${d.max}` : '', 450, 276, 12, KC.dim, 'right'); }
  if (d.sub) T(c, d.sub, 320, 316, 12, KC.white, 'center', 600);
  if (d.rank) T(c, d.rank, 320, 336, 14, KC.goldHi, 'center', 600);
}
// 順位表. d = { title, rows: [{ name, score, me, out, cur }], line (how many advance), sub }
export function drawRanking(c, t, d) {
  R(c, 0, 0, SW, SH, KC.bg);
  R(c, 0, 0, SW, 36, '#000'); crown(c, 12, 8, 2); T(c, d.title || '順位', 44, 10, 14, KC.gold, 'left', 560);
  const rows = d.rows || [];
  rows.forEach((r, i) => {
    const y = 44 + i * 26;
    if (y > 320) return;
    const adv = d.line && i < d.line;
    R(c, 40, y, 560, 22, r.cur ? '#3a3010' : adv ? '#14203a' : '#101018');
    if (r.me) R(c, 40, y, 4, 22, KC.red);
    T(c, `${i + 1}`, 60, y + 4, 13, adv ? KC.gold : KC.dim, 'center');
    T(c, r.name, 84, y + 4, 13, r.me ? KC.goldHi : KC.white, 'left', 360);
    T(c, r.score != null ? String(r.score) : '－', 590, y + 4, 13, KC.white, 'right');
    if (d.line && i === d.line - 1) R(c, 40, y + 23, 560, 2, KC.gold);
  });
  if (d.sub) T(c, d.sub, 320, 340, 11, KC.dim, 'center', 600);
}
// PV + キャッチコピー. d = { copy, name, sub, looks, me }
export function drawPV(c, t, d) {
  R(c, 0, 0, SW, SH, '#000');
  for (let i = 0; i < 9; i++) { const x = ((i * 97 + t * (3 + (i % 3))) % (SW + 200)) - 100; c.globalAlpha = 0.18; R(c, x, 0, 6 + (i % 3) * 4, SH, KC.gold); c.globalAlpha = 1; }
  const k = Math.min(1, t / 24);
  (d.looks || []).forEach((lk, i, a) => { const x = 320 - (a.length * 90) / 2 + i * 90 + (1 - k) * (i % 2 ? 120 : -120); person(c, lk, x, 120, 2.6, 'down', 0, { dark: 0.35 + 0.65 * k }); });
  if (t > 10) { const z = fitSize(c, `「${d.copy}」`, 600, 22, 12); T(c, `「${d.copy}」`, 320, 40, z, KC.white, 'center', 610, { outline: '#000' }); }
  if (t > 24) { R(c, 0, 262, SW, 56, 'rgba(0,0,0,0.75)'); const z = fitSize(c, d.name || '', 600, 30, 14); T(c, d.name || '', 320, 268, z, d.me ? KC.goldHi : KC.gold, 'center', 610, { outline: '#2a1e00' }); }
  if (t > 30 && d.sub) T(c, d.sub, 320, 322, 12, KC.white, 'center', 610);
}
// 優勝の瞬間. d = { name, title, sub, looks }
export function drawWinner(c, t, d) {
  R(c, 0, 0, SW, SH, KC.bg);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + t / 120; c.globalAlpha = 0.08; c.fillStyle = KC.gold; c.beginPath(); c.moveTo(320, 150); c.lineTo(320 + Math.cos(a) * 600, 150 + Math.sin(a) * 600); c.lineTo(320 + Math.cos(a + 0.12) * 600, 150 + Math.sin(a + 0.12) * 600); c.closePath(); c.fill(); c.globalAlpha = 1; }
  const drop = Math.max(0, 60 - t * 2);
  crown(c, 320 - 52, 30 - drop, 8, 0.01 + (Math.floor(t / 15) % 3) / 3);
  (d.looks || []).forEach((lk, i, a) => person(c, lk, 320 - (a.length * 80) / 2 + i * 80, 134, 2.4, 'down'));
  confetti(c, t, 120);
  R(c, 0, 250, SW, 100, 'rgba(0,0,0,0.7)');
  T(c, d.title || '', 320, 258, 14, KC.gold, 'center', 600);
  const z = fitSize(c, d.name || '', 600, 34, 16);
  T(c, d.name || '', 320, 280, z, KC.goldHi, 'center', 610, { outline: '#3a2a00' });
  if (d.sub) T(c, d.sub, 320, 326, 12, KC.white, 'center', 600);
}
// A title card between scenes. d = { big, small, year }
export function drawTitle(c, t, d) {
  R(c, 0, 0, SW, SH, '#000');
  const k = Math.min(1, t / 18);
  c.globalAlpha = k;
  kocLogo(c, 320, 70, 26, d.year);
  const z = fitSize(c, d.big || '', 600, 26, 14);
  T(c, d.big || '', 320, 190, z, KC.white, 'center', 610);
  if (d.small) para(c, d.small, 80, 232, 480, 13, KC.dim, 18, 5);
  c.globalAlpha = 1;
}
// Documentary page (sepia still of a set + narration). d = { set, data, caption, line, page, pages, title }
let docCv = null;
export function drawDoc(c, t, d, g) {
  if (!docCv) docCv = makeCanvas(SW, SH);
  const [cv, cc] = docCv;
  cc.setTransform(1, 0, 0, 1, 0, 0);
  cc.clearRect(0, 0, SW, SH);
  try { (SETS[d.set] || SETS.dark)(cc, 40, d.data || {}, g); } catch (e) { R(cc, 0, 0, SW, SH, '#000'); }
  cc.globalCompositeOperation = 'saturation'; cc.fillStyle = '#808080'; cc.fillRect(0, 0, SW, SH);
  cc.globalCompositeOperation = 'multiply'; cc.fillStyle = '#d8b88a'; cc.fillRect(0, 0, SW, SH);
  cc.globalCompositeOperation = 'source-over';
  const zoom = 1 + Math.min(0.06, t / 3000);
  c.drawImage(cv, -SW * (zoom - 1) / 2, -SH * (zoom - 1) / 2, SW * zoom, SH * zoom);
  for (let i = 0; i < 40; i++) { const x = (i * 131 + t * 17) % SW, y = (i * 71 + t * 29) % SH; c.globalAlpha = 0.08; R(c, x, y, 1, 3, '#fff'); c.globalAlpha = 1; }
  R(c, 0, 0, SW, 24, '#000'); R(c, 0, SH - 92, SW, 92, 'rgba(0,0,0,0.82)');
  T(c, d.title || '', 12, 5, 12, KC.gold, 'left', 500);
  if (d.pages) T(c, `${d.page}/${d.pages}`, SW - 12, 5, 11, KC.dim, 'right');
  if (d.caption) T(c, d.caption, 20, SH - 86, 12, KC.goldHi, 'left', 600);
  para(c, d.line || '', 20, SH - 66, 600, 14, '#fff', 19, 3);
}
export { SETS };
