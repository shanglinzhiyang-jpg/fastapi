// M-1グランプリ — HD scenes (640x360): the venue sets (受付・楽屋・廊下・舞台袖・予選ステージ・会見・敗者復活・決勝スタジオ・
// 打ち上げ・トーク・ツアー・自宅), the entry form, the results board, 笑神籤, the 紹介VTR (PV), the judges' score reveal and the
// ranking board (暫定ボックス), the 最終決戦 votes, the champion card, ネットの反応, the documentary pages and the DVD.
// Everything is drawn here (no image files). Dialogue (g.say / g.ask) is shown over the sets; the important parts of a
// set stay above the message window (y < 236). Every card resolves at once under g.auto.

import { SW, SH, makeCanvas } from './util.js';
import { text, measure } from './draw.js';
import { charSheetHD } from './sprites.js';
import { audio } from './audio.js';
import { h01 } from './m1_data.js';

const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
export function T(c, s, x, y, size = 12, color = '#fff', align = 'left', w = 0, opt = {}) {
  text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: opt.shadow ?? null, outline: opt.outline });
}
// fitted size: the largest size ≤ size that fits w
export function fitSize(c, s, w, size, min = 8) { let k = size; while (k > min && measure(c, s, k) > w) k--; return k; }
const NO_START = new Set('、。，．・：；？！ー～…）」』】!?.,)%'.split(''));
export function jwrap(c, str, w, size = 12) {
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    let line = '';
    for (const ch of Array.from(par)) {
      if (line && measure(c, line + ch, size) > w && !NO_START.has(ch)) { out.push(line); line = ch; } else line += ch;
    }
    out.push(line);
  }
  return out;
}
export function para(c, s, x, y, w, size = 12, color = '#fff', lh = 0, max = 99, align = 'left') {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, max);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], align === 'center' ? x + w / 2 : x, y + i * step, size, color, align, w);
  return n * step;
}
// A character from the HD sheets (32x40 per frame) at integer scale, feet at (x, y).
export function person(c, look, x, y, s = 2, dir = 'down', frame = 0) {
  if (!look) return;
  try {
    const sh = charSheetHD(look);
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x - 16 * s), Math.round(y - 40 * s), 32 * s, 40 * s);
  } catch (e) { /* bad look */ }
}
function shadow(c, x, y, w) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(Math.round(x - w / 2), Math.round(y - 2), Math.round(w), 4); }
function tag(c, s, x, y, bg = 'rgba(10,10,20,0.82)', col = '#fff', size = 10, maxW = 120) {
  const t = fit(c, s, maxW, size);
  const w = Math.round(measure(c, t, size)) + 8;
  R(c, x - w / 2, y, w, size + 5, bg);
  T(c, t, x, y + 2, size, col, 'center');
}
const GOLD = '#ffd23f', GOLD2 = '#c9a227', GOLD3 = '#8a6a1a', RED = '#c8102e', INK = '#14141c';

// ================================================================ big logo text (our own lettering; not the real logo)
export function m1Logo(c, x, y, size, year, opt = {}) {
  const s1 = 'M-1グランプリ';
  const y2 = year ? String(year) : '';
  const w1 = measure(c, s1, size);
  const ws = y2 ? measure(c, y2, Math.round(size * 0.6)) + 6 : 0;
  const x0 = opt.align === 'left' ? x : x - (w1 + ws) / 2;
  T(c, s1, x0 + 2, y + 2, size, '#3a0a0a');
  T(c, s1, x0, y, size, GOLD, 'left', 0, { outline: '#5a1a08' });
  if (y2) T(c, y2, x0 + w1 + 6, y + size * 0.35, Math.round(size * 0.6), '#fff', 'left', 0, { outline: '#5a1a08' });
}

// ================================================================ sets
const SETS = {};
function bgGrad(c, top, bot) { const g = c.createLinearGradient(0, 0, 0, SH); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, SW, SH); }
function banner(c, x, y, w, h, title, sub, year, bg = RED) {
  R(c, x + 3, y + 3, w, h, 'rgba(0,0,0,0.4)');
  R(c, x, y, w, h, bg); R(c, x, y, w, 2, GOLD); R(c, x, y + h - 2, w, 2, GOLD);
  const ty = sub ? y + 4 : y + (h - 18) / 2;
  if (title === 'logo') m1Logo(c, x + w / 2, ty, Math.min(20, h - 8), year);
  else T(c, title, x + w / 2, ty, Math.min(18, h - 10), '#fff', 'center', w - 12, { outline: '#3a0a0a' });
  if (sub) T(c, sub, x + w / 2, y + h - 16, 11, '#ffe9a8', 'center', w - 12);
}
function floorBoards(c, y0, col1, col2) { R(c, 0, y0, SW, SH - y0, col1); for (let x = 0; x < SW; x += 40) R(c, x, y0, 1, SH - y0, col2); for (let y = y0 + 18; y < SH; y += 22) R(c, 0, y, SW, 1, col2); }
function crowdRow(c, y, n, t, colors, seed = 0, react = 0) {
  for (let i = 0; i < n; i++) {
    const x = (i * SW) / n + 8 + (h01('crowd', seed, i) * 10);
    const bob = react > 0 && (Math.floor(t / 8) + i) % 2 ? -2 : 0;
    const col = colors[i % colors.length];
    R(c, x - 7, y + bob, 14, 12, col); R(c, x - 9, y + 10 + bob, 18, 14, col);
    R(c, x - 5, y + 2 + bob, 10, 3, 'rgba(255,255,255,0.08)');
  }
}
SETS.uketsuke = (c, sc) => {
  bgGrad(c, '#e8e2d4', '#c8bfae');
  R(c, 0, 0, SW, 12, '#b8ae9a');
  for (let x = 30; x < SW; x += 120) { R(c, x, 30, 70, 46, '#f6f2ea'); R(c, x + 4, 34, 62, 38, '#a8c8e8'); R(c, x + 34, 34, 2, 38, '#f6f2ea'); }
  banner(c, 120, 18, 400, 46, 'logo', sc.sub || '受付', sc.year);
  floorBoards(c, 196, '#9a8a72', '#8a7a62');
  // reception table
  R(c, 120, 168, 400, 34, '#f8f8f8'); R(c, 120, 168, 400, 4, '#ffffff'); R(c, 120, 198, 400, 8, '#d8d8d8');
  R(c, 140, 154, 60, 14, '#ffd23f'); T(c, '受付', 170, 155, 10, INK, 'center');
  R(c, 420, 150, 80, 18, '#2a2a3a'); T(c, 'No.順に', 460, 153, 10, '#fff', 'center');
  // standing sign
  R(c, 556, 110, 64, 70, '#fff'); R(c, 556, 110, 64, 3, RED); R(c, 586, 180, 4, 20, '#555');
  para(c, 'エントリーナンバー順にお並びください', 560, 116, 56, 9, INK, 11, 5);
};
SETS.gakuya = (c, sc) => {
  bgGrad(c, '#d8cdb4', '#b8ab90');
  // mirrors with bulbs
  for (let i = 0; i < 4; i++) {
    const x = 26 + i * 150;
    R(c, x, 26, 120, 76, '#3a3a44'); R(c, x + 6, 32, 108, 64, '#9ab8c8'); R(c, x + 10, 36, 30, 56, 'rgba(255,255,255,0.25)');
    for (let k = 0; k < 6; k++) { R(c, x + 4 + k * 22, 20, 8, 8, (Math.floor(sc.t / 30) + k + i) % 9 ? '#fff6c8' : '#ffd23f'); }
  }
  R(c, 0, 108, SW, 14, '#8a6a4a'); R(c, 0, 108, SW, 3, '#a88a6a');
  floorBoards(c, 200, '#7a8a6a', '#6a7a5a');
  // 出番表 whiteboard
  if (sc.order && sc.order.length) {
    R(c, 470, 126, 160, 104, '#f8f8f8'); R(c, 470, 126, 160, 14, '#2a3a7a'); T(c, '出番表', 550, 127, 10, '#fff', 'center');
    sc.order.slice(0, 8).forEach((o, i) => T(c, `${i + 1}. ${o}`, 476, 143 + i * 11, 9, o === sc.me ? RED : INK, 'left', 148));
  }
  // tatami / zabuton area
  R(c, 20, 196, 200, 10, '#c8b878');
};
SETS.rouka = (c, sc) => {
  bgGrad(c, '#c8ccd0', '#9aa0a8');
  R(c, 0, 0, SW, 16, '#8a9098');
  for (let x = 0; x < SW; x += 160) { R(c, x + 30, 40, 50, 110, '#7a6a5a'); R(c, x + 34, 44, 42, 102, '#8a7a6a'); R(c, x + 68, 92, 4, 8, GOLD2); }
  R(c, 500, 28, 70, 22, '#1f8a3a'); T(c, '非常口', 535, 32, 11, '#fff', 'center');
  R(c, 600, 120, 16, 40, RED); R(c, 604, 112, 8, 8, '#333');
  R(c, 0, 150, SW, 6, '#b0b4b8');
  floorBoards(c, 200, '#8a8e92', '#7a7e82');
  T(c, '関係者以外立入禁止', 240, 60, 12, '#4a4a50', 'center');
};
SETS.sode = (c, sc) => {
  R(c, 0, 0, SW, SH, '#0c0c12');
  for (let x = 0; x < 220; x += 14) R(c, x, 0, 10, 230, x % 28 ? '#16161e' : '#1c1c26');
  // light leaking from the stage
  c.fillStyle = 'rgba(255,240,190,0.16)';
  c.beginPath(); c.moveTo(640, 0); c.lineTo(640, 230); c.lineTo(300, 230); c.lineTo(470, 0); c.closePath(); c.fill();
  R(c, 220, 0, 10, 230, '#2a1a10');
  floorBoards(c, 220, '#3a2a1a', '#2a1a10');
  // monitor
  R(c, 40, 110, 120, 80, '#222'); R(c, 46, 116, 108, 62, '#0a2a1a');
  T(c, sc.timer || '持ち時間 4:00', 100, 132, 12, '#5ee07a', 'center', 100);
  T(c, 'ON STAGE', 100, 152, 10, '#ff5d6c', 'center');
  // bami tape
  R(c, 420, 226, 14, 3, GOLD); R(c, 470, 226, 14, 3, '#5fd7ff');
};
function stageBase(c, sc, opt = {}) {
  bgGrad(c, opt.top || '#1a0c2a', opt.bot || '#05050a');
  // curtains
  for (let x = 0; x < 90; x += 6) R(c, x, 0, 6, 230, x % 12 ? '#7a1020' : '#9a1a2c');
  for (let x = SW - 90; x < SW; x += 6) R(c, x, 0, 6, 230, x % 12 ? '#7a1020' : '#9a1a2c');
  R(c, 0, 0, SW, 16, '#5a0a16');
  banner(c, 150, 26, 340, 52, 'logo', opt.sub || sc.sub || '', sc.year, opt.bannerBg || RED);
  // lights
  for (let i = 0; i < 6; i++) { const x = 110 + i * 84; R(c, x, 0, 16, 10, '#333'); c.fillStyle = 'rgba(255,240,190,0.05)'; c.beginPath(); c.moveTo(x, 10); c.lineTo(x + 16, 10); c.lineTo(x + 70, 230); c.lineTo(x - 54, 230); c.closePath(); c.fill(); }
  // floor
  R(c, 60, 200, 520, 30, '#3a2414'); R(c, 60, 200, 520, 2, '#a86a38'); R(c, 60, 226, 520, 4, '#24140a');
  for (let x = 60; x < 580; x += 40) R(c, x, 202, 1, 24, '#2a180c');
}
function centerMic(c, x = 320, base = 222, top = 168) {
  R(c, x - 14, base - 2, 28, 4, '#888'); R(c, x - 10, base - 4, 20, 2, '#aaa');
  R(c, x - 1, top, 2, base - top, '#c8c8d0'); R(c, x, top, 1, base - top, '#ffffff');
  R(c, x - 3, top - 8, 6, 10, '#2a2a30'); R(c, x - 2, top - 7, 2, 4, '#5a5a66');
}
SETS.stage = (c, sc) => {
  stageBase(c, sc);
  // the spot on the center mic
  c.fillStyle = 'rgba(255,248,210,0.12)'; c.beginPath(); c.moveTo(300, 0); c.lineTo(340, 0); c.lineTo(400, 228); c.lineTo(240, 228); c.closePath(); c.fill();
  centerMic(c);
  crowdRow(c, 236, 22, sc.t, ['#1a1a24', '#22222e', '#181820'], 1, sc.react || 0);
  crowdRow(c, 252, 24, sc.t, ['#101018', '#16161e'], 2, sc.react || 0);
};
SETS.press = (c, sc) => {
  bgGrad(c, '#2a1a06', '#0a0602');
  for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(255,210,63,${0.05 + (i % 3) * 0.02})`; c.beginPath(); c.moveTo(320, 60); c.lineTo(i * 40 - 40, 240); c.lineTo(i * 40, 240); c.closePath(); c.fill(); }
  banner(c, 120, 12, 400, 54, 'logo', '決勝進出者発表', sc.year, '#1a1206');
  R(c, 40, 196, 560, 12, '#5a4a2a'); R(c, 40, 196, 560, 2, GOLD2);
  // cameras + flashes
  for (let i = 0; i < 9; i++) {
    const x = 30 + i * 72;
    R(c, x, 244, 30, 18, '#1a1a1a'); R(c, x + 10, 238, 12, 8, '#2a2a2a'); R(c, x + 4, 248, 10, 10, '#3a3a4a');
    if ((Math.floor(sc.t / 7) * 7 + i * 13) % 23 === 0) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(x - 6, 228, 44, 30); }
  }
};
function cityNight(c, t, warm = false) {
  bgGrad(c, '#0a1430', '#1a2448');
  for (let i = 0; i < 40; i++) R(c, (i * 97) % SW, (i * 53) % 90, 1, 1, i % 5 ? '#6a7ab8' : '#fff');
  for (let i = 0; i < 14; i++) {
    const x = i * 48 - 10, h = 60 + ((i * 37) % 70), w = 40;
    R(c, x, 150 - h, w, h + 20, '#141c34');
    for (let wy = 150 - h + 6; wy < 160; wy += 10) for (let wx = x + 4; wx < x + w - 4; wx += 8) if (h01('win', i, wx, wy) < 0.4) R(c, wx, wy, 4, 5, warm ? '#ffd890' : '#c8d8ff');
  }
}
SETS.outdoor = (c, sc) => {
  cityNight(c, sc.t);
  // truss stage
  R(c, 110, 60, 420, 6, '#8a8a90'); R(c, 110, 60, 6, 150, '#8a8a90'); R(c, 524, 60, 6, 150, '#8a8a90');
  for (let x = 116; x < 524; x += 12) R(c, x, 61, 6, 4, (x / 12) % 2 ? '#6a6a70' : '#aaaaB0');
  banner(c, 170, 70, 300, 40, '敗者復活戦', sc.sub || sc.venue || '', sc.year, '#1a3a7a');
  R(c, 110, 196, 420, 14, '#2a2a34'); R(c, 110, 196, 420, 2, '#5fd7ff');
  centerMic(c, 320, 196, 146);
  // wind + breath
  for (let i = 0; i < 30; i++) { const x = (i * 71 + sc.t * 3) % SW, y = 20 + ((i * 41 + sc.t) % 200); R(c, x, y, 6, 1, 'rgba(255,255,255,0.35)'); }
  crowdRow(c, 232, 22, sc.t, ['#2a2a3a', '#3a2a2a', '#1a2a3a'], 3, sc.react || 0);
  crowdRow(c, 250, 24, sc.t, ['#20202a', '#2a2020'], 4, sc.react || 0);
};
SETS.revival_in = (c, sc) => {
  bgGrad(c, '#10102a', '#05050f');
  banner(c, 170, 24, 300, 46, '敗者復活戦', sc.sub || sc.venue || '', sc.year, '#1a3a7a');
  if (sc.blocks) sc.blocks.forEach((b, i) => { const x = 20 + i * 210; R(c, x, 82, 190, 16, i === sc.blockIdx ? GOLD : '#2a3a6a'); T(c, b, x + 95, 84, 10, i === sc.blockIdx ? INK : '#fff', 'center', 180); });
  R(c, 100, 196, 440, 14, '#2a2a34'); R(c, 100, 196, 440, 2, GOLD2);
  centerMic(c, 320, 196, 146);
  crowdRow(c, 232, 22, sc.t, ['#1a1a24', '#22222e'], 5, sc.react || 0);
  crowdRow(c, 250, 24, sc.t, ['#101018', '#16161e'], 6, sc.react || 0);
};

// ---- the final studio (everything that matters stays above y 236: the message window starts there)
// LED wall 6..96, arch 100..186, stage floor 186..206 (performers' feet at 202), judges' desk 208..234 (name + score plates),
// score panel top-left, 暫定ボックス right.
export const STUDIO = { feet: 202, mcX: 70, perfX: [282, 358] };
function studioBase(c, sc) {
  bgGrad(c, '#0a0a1c', '#000000');
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI + Math.PI;
    c.fillStyle = `rgba(255,210,63,${i % 2 ? 0.035 : 0.06})`;
    c.beginPath(); c.moveTo(320, 70); c.lineTo(320 + Math.cos(a - 0.05) * 600, 70 + Math.sin(a - 0.05) * 600); c.lineTo(320 + Math.cos(a + 0.05) * 600, 70 + Math.sin(a + 0.05) * 600); c.closePath(); c.fill();
  }
  R(c, 160, 6, 320, 90, '#1a0a06'); R(c, 160, 6, 320, 2, GOLD2); R(c, 160, 94, 320, 2, GOLD2);
  for (let y = 10; y < 94; y += 4) R(c, 162, y, 316, 1, 'rgba(255,255,255,0.03)');
  const showName = sc.studio && sc.studio.led;
  if (showName) {
    const sz = fitSize(c, showName, 290, 26, 12);
    T(c, showName, 320, 28, sz, '#fff', 'center', 300, { outline: '#7a1a08' });
    if (sc.studio.ledSub) T(c, sc.studio.ledSub, 320, 66, 12, GOLD, 'center', 300);
  } else m1Logo(c, 320, 36, 26, sc.year);
  R(c, 140, 100, 6, 88, GOLD2); R(c, 494, 100, 6, 88, GOLD2); R(c, 140, 100, 360, 4, GOLD);
  R(c, 90, 186, 460, 20, '#1a1426'); R(c, 90, 186, 460, 2, GOLD); for (let x = 100; x < 550; x += 30) R(c, x, 190, 14, 1, 'rgba(255,255,255,0.12)');
  c.fillStyle = 'rgba(255,240,200,0.10)'; c.beginPath(); c.moveTo(296, 104); c.lineTo(344, 104); c.lineTo(390, 206); c.lineTo(250, 206); c.closePath(); c.fill();
  centerMic(c, 320, 202, 150);
  // the studio audience (seen when no message is open)
  crowdRow(c, 268, 24, sc.t, ['#14141e', '#1a1a26', '#101018'], 11, sc.react || 0);
  crowdRow(c, 292, 26, sc.t, ['#0e0e16', '#14141c'], 12, sc.react || 0);
  crowdRow(c, 316, 24, sc.t, ['#0a0a10', '#101016'], 13, sc.react || 0);
}
function judgesDesk(c, sc) {
  const S = sc.studio || {};
  const js = S.judges || [];
  if (!js.length) return;
  const n = js.length;
  const w = Math.min(62, Math.floor(540 / n));
  const x0 = 320 - (n * w) / 2;
  js.forEach((j, i) => person(c, j.look || { hair: 'short', hairColor: 'black', top: '#2e3140', bottom: '#2e3140', jacket: true }, x0 + i * w + w / 2, 224, 1, 'up'));
  R(c, x0 - 8, 208, n * w + 16, 28, '#2a1a10'); R(c, x0 - 8, 208, n * w + 16, 2, GOLD2); R(c, x0 - 8, 234, n * w + 16, 2, '#140a06');
  js.forEach((j, i) => {
    const x = x0 + i * w + w / 2;
    R(c, x - w / 2 + 2, 210, w - 4, 10, '#f2ead8');
    T(c, j.name, x, 211, 8, INK, 'center', w - 6);
    const p = S.points && S.points[i];
    const shown = p != null && i < (S.reveal ?? n);
    R(c, x - w / 2 + 6, 221, w - 12, 12, shown ? '#1a1206' : '#0e0a06');
    if (shown) { R(c, x - w / 2 + 6, 221, w - 12, 1, GOLD); T(c, String(p), x, 221, 11, p >= 95 ? '#ff6a7a' : GOLD, 'center'); }
  });
}
function rankingBoard(c, sc) {
  const S = sc.studio || {};
  const rk = S.ranking || [];
  const x = 528, y = 118;
  R(c, x - 4, y - 16, 112, 15, '#1a1206'); T(c, S.final ? '最終決戦' : '暫定ボックス', x + 52, y - 14, 10, GOLD, 'center');
  for (let i = 0; i < 3; i++) {
    const r = rk[i];
    const yy = y + i * 28;
    R(c, x - 4, yy, 112, 26, i === 0 ? '#3a2a06' : '#1a1a26'); R(c, x - 4, yy, 3, 26, i === 0 ? GOLD : i === 1 ? '#c8c8d8' : '#c87a3a');
    T(c, `${i + 1}`, x + 3, yy + 7, 11, i === 0 ? GOLD : '#fff');
    if (r) {
      T(c, r.name, x + 14, yy + 2, 9, r.me ? '#ffdd66' : '#fff', 'left', 92);
      T(c, r.total != null ? `${r.total}点` : '', x + 104, yy + 14, 9, GOLD, 'right');
    } else T(c, '―', x + 56, yy + 7, 10, '#666', 'center');
  }
}
function scorePanel(c, sc) {
  const S = sc.studio || {};
  if (S.total == null) return;
  R(c, 6, 8, 144, 76, '#000'); R(c, 7, 9, 142, 74, '#1a1206'); R(c, 7, 9, 142, 2, GOLD);
  T(c, S.totalLabel || '得点', 78, 13, 10, '#ffe9a8', 'center', 132);
  T(c, String(S.totalShown ?? S.total), 78, 30, 30, GOLD, 'center', 0, { outline: '#3a1a06' });
  if (S.max) T(c, `/${S.max}`, 144, 68, 9, '#c8b888', 'right');
}
SETS.studio = (c, sc) => { studioBase(c, sc); };
SETS.tvroom = (c, sc) => {
  bgGrad(c, '#d8c8a8', '#b8a888');
  R(c, 0, 186, SW, SH - 186, '#8a6a4a');
  for (let x = 0; x < SW; x += 64) R(c, x, 186, 1, 80, '#7a5a3a');
  // TV
  R(c, 200, 40, 240, 150, '#1a1a1a'); R(c, 210, 50, 220, 124, '#000');
  c.save(); c.beginPath(); c.rect(210, 50, 220, 124); c.clip();
  c.translate(210, 50); c.scale(220 / SW, 124 / SH);
  try { (SETS[sc.tvKind || 'studio'] || SETS.studio)(c, { ...sc, t: sc.t }); } catch (e) { /* tv picture */ }
  c.restore();
  R(c, 300, 190, 40, 8, '#2a2a2a');
  R(c, 60, 220, 160, 30, '#a84a3a'); R(c, 420, 220, 160, 30, '#a84a3a'); // sofa cushions
};
SETS.party = (c, sc) => {
  bgGrad(c, '#3a1a10', '#1a0a06');
  for (let i = 0; i < 26; i++) { const x = 10 + i * 25; R(c, x, 8 + (i % 2) * 4, 8, 10, ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a'][i % 4]); }
  R(c, 0, 4, SW, 1, '#ffffff');
  banner(c, 140, 26, 360, 42, 'logo', '打ち上げ', sc.year, '#5a1a08');
  floorBoards(c, 200, '#5a3a20', '#4a2a10');
  for (let i = 0; i < 3; i++) { const x = 40 + i * 210; R(c, x, 168, 150, 30, '#f2f2f2'); R(c, x, 196, 150, 6, '#c8c8c8'); for (let k = 0; k < 5; k++) { R(c, x + 12 + k * 28, 158, 8, 12, k % 2 ? '#ffd23f' : '#c8e8ff'); } R(c, x + 50, 160, 50, 10, '#e8a87a'); }
};
SETS.talk = (c, sc) => {
  bgGrad(c, '#1a2a4a', '#0a1020');
  R(c, 60, 20, 520, 70, '#0a0a14'); R(c, 60, 20, 520, 2, GOLD2);
  T(c, sc.sub || '大反省会', 320, 34, fitSize(c, sc.sub || '大反省会', 500, 22, 12), '#fff', 'center', 500, { outline: '#3a1a06' });
  T(c, sc.year ? `M-1グランプリ${sc.year}` : '', 320, 64, 12, GOLD, 'center');
  R(c, 80, 176, 480, 26, '#7a2a3a'); R(c, 80, 170, 480, 8, '#9a3a4a'); // sofa
  floorBoards(c, 206, '#2a2a3a', '#1a1a2a');
};
SETS.tour = (c, sc) => {
  stageBase(c, sc, { sub: sc.sub || 'ツアー', top: '#2a0a1a', bannerBg: '#5a1a3a' });
  centerMic(c);
  crowdRow(c, 236, 22, sc.t, ['#2a1a24', '#22222e'], 7, sc.react || 0);
  crowdRow(c, 252, 24, sc.t, ['#1a1018', '#16161e'], 8, sc.react || 0);
};
SETS.home = (c, sc) => {
  bgGrad(c, '#e8dcc0', '#c8b898');
  R(c, 40, 30, 130, 90, '#5a7aa8'); R(c, 44, 34, 122, 82, '#a8c8e8'); R(c, 104, 34, 2, 82, '#5a7aa8');
  R(c, 420, 40, 160, 100, '#8a6a4a'); for (let k = 0; k < 4; k++) R(c, 424, 44 + k * 24, 152, 20, k % 2 ? '#a88a6a' : '#9a7a5a');
  floorBoards(c, 196, '#b89a6a', '#a88a5a');
  R(c, 230, 176, 180, 24, '#7a5a3a'); R(c, 230, 172, 180, 6, '#9a7a5a'); // low table
  R(c, 260, 166, 40, 8, '#f8f8f8'); R(c, 330, 166, 30, 10, '#ffffff');
};
SETS.night = (c, sc) => { cityNight(c, sc.t, true); floorBoards(c, 210, '#2a2a34', '#20202a'); R(c, 200, 180, 240, 10, '#5a4a3a'); };

// ================================================================ the backdrop scene
// pushSet(g, kind, opts) → the scene (sc.kind / sc.cast / sc.sub / sc.studio … can be changed while it shows)
// cast: [{ look, x, y, s, dir, tag, tagColor, bob }]
export class M1Set {
  constructor(g, kind, opts = {}) {
    Object.assign(this, { g, kind, hd: true, opaque: true, hidesHud: true, isM1: true, t: 0, cast: [], year: null, sub: '', caption: null, fx: [] }, opts);
  }
  update() { this.t++; this.fx = this.fx.filter((f) => ++f.t < f.life); }
  draw(c, g) {
    try { (SETS[this.kind] || SETS.stage)(c, this, g); } catch (e) { console.error(e); }
    const cast = this.cast.slice().sort((a, b) => a.y - b.y);
    for (const p of cast) {
      if (!p || !p.look) continue;
      const bob = p.bob && Math.floor((this.t + (p.x | 0)) / 14) % 2 ? -2 : 0;
      shadow(c, p.x, p.y, 14 * (p.s || 2));
      person(c, p.look, p.x, p.y + bob, p.s || 2, p.dir || 'down', p.frame || 0);
      if (p.tag) tag(c, p.tag, p.x, p.y + 2, p.tagBg || 'rgba(10,10,20,0.82)', p.tagColor || '#fff', 9, Math.max(60, 40 * (p.s || 2)));
      if (p.sub) T(c, p.sub, p.x, p.y + 15, 8, p.subColor || '#ffe9a8', 'center', 90);
    }
    if (this.kind === 'studio') { judgesDesk(c, this); rankingBoard(c, this); scorePanel(c, this); }
    if (this.overlay) { try { this.overlay(c, this); } catch (e) { console.error(e); } }
    for (const f of this.fx) { if (f.kind === 'flash') { c.fillStyle = `rgba(255,255,255,${0.6 * (1 - f.t / f.life)})`; c.fillRect(0, 0, SW, SH); } }
    if (this.caption) {
      const w = Math.min(SW - 20, measure(c, this.caption, 12) + 30);
      R(c, SW / 2 - w / 2, 4, w, 20, 'rgba(0,0,0,0.65)');
      T(c, this.caption, SW / 2, 7, 12, '#fff', 'center', w - 10);
    }
    if (this.info && this.info.length) {
      const w = 236, h = this.info.length * 15 + 10;
      R(c, 6, 28, w, h, 'rgba(8,8,16,0.82)'); R(c, 6, 28, 2, h, GOLD);
      this.info.forEach((l, i) => T(c, l, 14, 33 + i * 15, 10, i === 0 ? GOLD : '#fff', 'left', w - 14));
    }
  }
  flash() { this.fx.push({ kind: 'flash', t: 0, life: 14 }); }
}
export function pushSet(g, kind, opts = {}) { const sc = new M1Set(g, kind, opts); g.push(sc); return sc; }
export function popSet(g, sc) { if (sc && g.scenes.includes(sc)) g.pop(sc); }

// ================================================================ timed cards
// card(g, draw(c, t, sc), { min, max, opaque }) → Promise. A/B (or a tap) after `min` frames closes it; `max` ends it.
export function card(g, draw, o = {}) {
  return new Promise((resolve) => {
    const sc = {
      hd: true, opaque: !!o.opaque, hidesHud: true, t: 0, isM1Card: true, tag: o.tag || 'card',
      update(gg) {
        sc.t++;
        if (gg.auto || sc.t >= (o.max ?? 600) || (sc.t > (o.min ?? 20) && (gg.input.pressed('a') || gg.input.pressed('b')))) { gg.pop(sc); resolve(); }
      },
      draw(c) { try { draw(c, sc.t, sc); } catch (e) { console.error(e); } },
    };
    g.push(sc);
  });
}
// a big title over the current set (合格 / 不合格 / 決勝進出 …)
export function bigText(g, title, sub = '', o = {}) {
  return card(g, (c, t) => {
    const k = Math.min(1, t / 12);
    R(c, 0, 0, SW, SH, `rgba(0,0,0,${0.45 * k})`);
    const h = Math.round(96 * k);
    R(c, 0, 110 - h / 2, SW, h, o.bg || 'rgba(20,10,4,0.92)'); R(c, 0, 110 - h / 2, SW, 2, o.edge || GOLD); R(c, 0, 110 + h / 2 - 2, SW, 2, o.edge || GOLD);
    if (k >= 1) {
      T(c, title, SW / 2, sub ? 76 : 92, fitSize(c, title, SW - 40, 32, 14), o.color || GOLD, 'center', SW - 40, { outline: '#2a0a04' });
      if (sub) para(c, sub, 40, 120, SW - 80, 13, '#fff', 17, 2, 'center');
    }
    if (o.confetti) confetti(c, t, 90);
  }, { min: o.min ?? 30, max: o.max ?? 200, tag: 'big' });
}
const CONF = ['#ffd23f', '#ff5d8f', '#5fd7ff', '#5ee07a', '#ffffff', '#b48cff', '#ff8a3d'];
export function confetti(c, t, n = 100) {
  for (let i = 0; i < n; i++) {
    const sp = 0.8 + h01('cf', i) * 1.4;
    const x = (h01('cx', i) * SW + Math.sin((t + i * 13) / 16) * 8) % SW;
    const y = ((t * sp + h01('cy', i) * SH * 1.5) % (SH + 20)) - 10;
    R(c, x, y, Math.floor((t + i) / 6) % 2 ? 4 : 2, 3, CONF[i % CONF.length]);
  }
}

// ---- 笑神籤 (or 抽選): the drawn name, the remaining ones
export function kujiCard(g, o) {
  if (!g.auto) sfx('drum');
  return card(g, (c, t) => {
    bgGrad(c, '#14060a', '#020104');
    for (let i = 0; i < 16; i++) { c.fillStyle = 'rgba(255,210,63,0.04)'; c.beginPath(); c.moveTo(320, 150); c.lineTo(i * 44 - 20, 360); c.lineTo(i * 44 + 4, 360); c.closePath(); c.fill(); }
    T(c, o.emikuji ? '笑神籤' : '出番順', SW / 2, 10, 24, GOLD, 'center', 0, { outline: '#3a1a06' });
    T(c, o.emikuji ? `${o.n}組目　${o.drawer || '司会'}が籤を引く` : `${o.n}組目（事前の抽選で決定）`, SW / 2, 42, 11, '#fff', 'center', 400);
    const bx = 220, by = 120;
    const k = Math.min(1, Math.max(0, (t - 20) / 30));
    const sy = by - 4 - k * 52; // the stick rises out of the box (y 64..116)
    R(c, SW / 2 - 6, sy, 12, 58, '#f2e6c8'); R(c, SW / 2 - 6, sy, 12, 4, RED);
    R(c, bx, by, 200, 80, '#7a1a08'); R(c, bx, by, 200, 6, GOLD); R(c, bx, by + 74, 200, 6, GOLD2); R(c, SW / 2 - 30, by, 60, 6, '#2a0a04');
    T(c, o.emikuji ? '笑神籤' : '抽選箱', SW / 2, by + 26, 24, GOLD, 'center', 0, { outline: '#2a0a04' });
    if (t > 50) {
      if (t === 51 && !g.auto) sfx('fanfare');
      const z = Math.min(1, (t - 50) / 10);
      const w = Math.round(400 * z);
      R(c, SW / 2 - w / 2, 214, w, 48, '#fff8e8'); R(c, SW / 2 - w / 2, 214, w, 3, RED); R(c, SW / 2 - w / 2, 259, w, 3, RED);
      if (z >= 1) T(c, o.name, SW / 2, 225, fitSize(c, o.name, 380, 24, 12), INK, 'center', 380);
      if (t < 62) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0, 0, SW, SH); }
    }
    if (o.remaining && o.remaining.length) {
      T(c, `まだ呼ばれていない：${o.remaining.length}組`, SW / 2, 276, 10, '#c8c8d8', 'center', 600);
      para(c, o.remaining.join('・'), 40, 292, SW - 80, 10, '#8a8aa0', 14, 3, 'center');
    }
  }, { min: 60, max: 260, tag: 'kuji' });
}

// ---- the 紹介VTR (PV) with its キャッチコピー
const PV_BG = [['#3a0a14', '#0a0206'], ['#0a1a3a', '#02060f'], ['#1a2a0a', '#050a02'], ['#2a1a3a', '#08040f'], ['#3a2a0a', '#0f0a02'], ['#0a2a2a', '#020a0a']];
export function pvCard(g, o) {
  // o: { year, copy, name, members: [{ name, role, look }], lines: [..], key, me }
  const pal = PV_BG[Math.floor(h01('pv', o.key || o.name) * PV_BG.length)];
  return card(g, (c, t) => {
    const gr = c.createLinearGradient(0, 0, SW, SH); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); c.fillStyle = gr; c.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 16; i++) R(c, (i * 83 + t * (1 + (i % 3))) % SW, 40 + ((i * 47) % 280), 40 + (i % 4) * 20, 1, 'rgba(255,255,255,0.08)');
    R(c, 0, 0, SW, 30, '#000'); R(c, 0, SH - 30, SW, 30, '#000');
    T(c, '紹介VTR', 12, 9, 10, '#888');
    T(c, `M-1グランプリ${o.year}　決勝`, SW - 12, 9, 10, GOLD2, 'right');
    // members, large
    const ms = (o.members || []).slice(0, 3);
    ms.forEach((m, i) => person(c, m.look, 470 + i * 70 - (ms.length - 2) * 35, 300, 3, 'down', 0));
    const slide = Math.max(0, 40 - t * 2);
    const cs = fitSize(c, `「${o.copy}」`, 420, 30, 14);
    T(c, `「${o.copy}」`, 30 - slide, 70, cs, '#fff', 'left', 430, { outline: '#000' });
    if (t > 24) {
      T(c, o.name, 34, 122, fitSize(c, o.name, 380, 26, 12), GOLD, 'left', 390, { outline: '#2a0a04' });
      ms.forEach((m, i) => T(c, `${m.role}　${m.name}`, 36, 158 + i * 16, 11, '#fff', 'left', 380));
    }
    if (t > 40) (o.lines || []).slice(0, 5).forEach((l, i) => T(c, l, 36, 214 + i * 15, 10, '#d8d8e8', 'left', 400));
  }, { min: 40, max: 300, tag: 'pv' });
}

// ---- the judges' points, one by one, then the total (drawn over the studio set)
export async function revealScores(g, sc, o) {
  // o: { name, points: [..], total, aud: [{ city, pts }], max }
  const S = sc.studio || (sc.studio = {});
  S.points = o.points; S.reveal = 0; S.total = null; S.totalLabel = o.name; S.max = o.max;
  if (g.auto) { S.reveal = o.points.length; S.total = o.total; S.totalShown = o.total; return; }
  for (let i = 0; i < o.points.length; i++) { S.reveal = i + 1; sfx('drum'); await g.wait(260); }
  if (o.aud) { for (const a of o.aud) { sc.caption = `${a.city}会場の一般審査：${a.pts}点`; sfx('drum'); await g.wait(420); } sc.caption = null; }
  S.total = o.total; S.totalShown = 0;
  for (let k = 0; k <= 10; k++) { S.totalShown = Math.round((o.total * k) / 10); sfx('snare'); await g.wait(50); }
  S.totalShown = o.total;
  sfx(o.total >= o.great ? 'fanfare' : 'good');
  await g.wait(500);
}

// ---- 最終決戦: the judges' votes, card by card
export function votesCard(g, o) {
  // o: { year, acts: [{ key, name }], votes: [{ judge: name, key }] }
  return card(g, (c, t) => {
    R(c, 0, 0, SW, SH, '#05050c');
    T(c, '最終決戦　審査員の投票', SW / 2, 14, 20, GOLD, 'center', 0, { outline: '#3a1a06' });
    const shown = Math.min(o.votes.length, Math.floor(t / 26));
    const count = {};
    o.votes.slice(0, shown).forEach((v) => { count[v.key] = (count[v.key] || 0) + 1; });
    o.acts.forEach((a, i) => {
      const x = 40 + i * 196;
      R(c, x, 50, 176, 30, '#1a1206'); R(c, x, 50, 176, 2, GOLD);
      T(c, a.name, x + 88, 57, 12, a.me ? '#ffdd66' : '#fff', 'center', 166);
      T(c, `${count[a.key] || 0}票`, x + 88, 88, 22, GOLD, 'center');
    });
    o.votes.slice(0, shown).forEach((v, i) => {
      const ai = o.acts.findIndex((a) => a.key === v.key);
      const x = 40 + ai * 196 + 8 + ((count[v.key] && o.votes.slice(0, i).filter((w) => w.key === v.key).length) || 0) % 2 * 84;
      const y = 124 + Math.floor((o.votes.slice(0, i).filter((w) => w.key === v.key).length) / 2) * 30;
      R(c, x, y, 78, 24, '#f8f0d8'); R(c, x, y, 78, 3, RED);
      T(c, v.judge, x + 39, y + 7, 9, INK, 'center', 72);
      if (i === shown - 1 && t % 26 < 6) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x, y, 78, 24); }
    });
    if (shown >= o.votes.length && t % 40 < 30) T(c, '（A：つづける）', SW / 2, 326, 10, '#888', 'center');
  }, { min: o.votes.length * 26 + 20, max: o.votes.length * 26 + 400, tag: 'votes' });
}

// ---- the champion: confetti, trophy, prize board
export function championCard(g, o) {
  // o: { year, ed, name, members, prize: '1000万円' }
  if (!g.auto) { sfx('fanfare'); g.shake(16, 2); }
  return card(g, (c, t) => {
    bgGrad(c, '#2a1a02', '#0a0600');
    for (let i = 0; i < 20; i++) { c.fillStyle = 'rgba(255,210,63,0.05)'; c.beginPath(); c.moveTo(320, 120); c.lineTo(i * 34 - 20, 360); c.lineTo(i * 34 + 6, 360); c.closePath(); c.fill(); }
    T(c, `第${o.ed}代王者`, SW / 2, 16, 16, '#fff', 'center');
    T(c, o.name, SW / 2, 40, fitSize(c, o.name, 560, 36, 14), GOLD, 'center', 580, { outline: '#3a1a06' });
    (o.members || []).slice(0, 3).forEach((m, i, a) => person(c, m.look, SW / 2 - (a.length - 1) * 52 + i * 104, 280, 3, 'down', Math.floor(t / 20) % 2));
    // trophy (right), prize board (left)
    const tx = 520;
    R(c, tx - 16, 150, 32, 40, GOLD); R(c, tx - 22, 146, 44, 8, GOLD); R(c, tx - 6, 190, 12, 16, GOLD2); R(c, tx - 18, 206, 36, 8, GOLD3);
    R(c, tx - 12, 154, 6, 30, '#fff6c8');
    R(c, 40, 230, 170, 60, '#fff'); R(c, 40, 230, 170, 8, RED); T(c, '賞金', 125, 240, 11, INK, 'center'); T(c, o.prize || '1000万円', 125, 256, 22, RED, 'center');
    T(c, `M-1グランプリ${o.year}`, SW - 30, 236, 12, '#ffe9a8', 'right');
    confetti(c, t, 130);
  }, { min: 60, max: 420, tag: 'champion' });
}

// ---- ネットの反応 (掲示板 / SNS by era)
export function netCard(g, o) {
  // o: { title, era: 'heisei'|'reiwa', posts: [str], sns }
  return card(g, (c) => {
    R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.6)');
    const x = 120, w = 400;
    if (o.era === 'heisei') {
      R(c, x, 20, w, 300, '#efefef'); R(c, x, 20, w, 22, '#800000'); T(c, o.title || '匿名掲示板', x + 8, 25, 11, '#fff', 'left', w - 16);
      o.posts.slice(0, 7).forEach((p, i) => { T(c, `${i + 1} 名前：名無しさん`, x + 10, 50 + i * 38, 9, '#228b22', 'left', w - 20); T(c, p, x + 18, 64 + i * 38, 11, '#111', 'left', w - 30); });
    } else {
      R(c, x, 20, w, 300, '#10141c'); R(c, x, 20, w, 24, '#1a2230'); T(c, o.title || `${o.sns || 'SNS'}の反応`, x + 10, 26, 11, '#fff', 'left', w - 20);
      o.posts.slice(0, 6).forEach((p, i) => { const y = 52 + i * 44; R(c, x + 8, y, 22, 22, ['#5a6fd8', '#d85a8a', '#5ad88a', '#d8a85a'][i % 4]); T(c, `@user${(i * 7919) % 9000 + 1000}`, x + 36, y, 9, '#8a9ab8', 'left', 200); para(c, p, x + 36, y + 13, w - 50, 11, '#e8eef8', 14, 2); });
    }
  }, { min: 30, max: 500, tag: 'net' });
}

// ---- アナザーストーリー: sepia pages
export function docPage(g, o) {
  // o: { title, lines: [..], looks: [look, look], year }
  return card(g, (c, t) => {
    bgGrad(c, '#3a2a1a', '#120a04');
    for (let i = 0; i < 40; i++) R(c, (h01('grain', i, Math.floor(t / 4)) * SW) | 0, (h01('grain2', i, Math.floor(t / 4)) * SH) | 0, 1, 1, 'rgba(255,240,200,0.2)');
    R(c, 0, 0, SW, 26, '#000'); R(c, 0, SH - 26, SW, 26, '#000');
    T(c, 'アナザーストーリー', 14, 7, 10, '#c8a878');
    T(c, o.title, SW / 2, 40, fitSize(c, o.title, 560, 20, 11), '#f8e8c8', 'center', 580, { outline: '#1a0a04' });
    (o.looks || []).slice(0, 2).forEach((lk, i) => { c.globalAlpha = 0.85; person(c, lk, 500 + i * 60, 300, 3, i ? 'left' : 'right'); c.globalAlpha = 1; });
    para(c, (o.lines || []).join('\n'), 40, 84, 400, 12, '#f2e2c2', 18, 12);
  }, { min: 30, max: 900, tag: 'doc' });
}

// ---- DVD package
export function dvdCard(g, o) {
  return card(g, (c, t) => {
    R(c, 0, 0, SW, SH, 'rgba(0,0,0,0.7)');
    const x = 200, y = 30, w = 240, h = 300;
    R(c, x + 6, y + 6, w, h, '#000'); R(c, x, y, w, h, '#120a02'); R(c, x, y, w, 6, GOLD); R(c, x, y + h - 6, w, 6, GOLD);
    m1Logo(c, x + w / 2, y + 22, 18, o.year);
    T(c, o.sub || '決勝・敗者復活戦 完全収録', x + w / 2, y + 52, 10, '#fff', 'center', w - 20);
    (o.members || []).slice(0, 2).forEach((m, i) => person(c, m.look, x + w / 2 - 34 + i * 68, y + 210, 3));
    T(c, o.name, x + w / 2, y + 222, fitSize(c, o.name, w - 20, 18, 10), GOLD, 'center', w - 20, { outline: '#000' });
    T(c, 'DVD', x + w - 14, y + h - 30, 14, '#fff', 'right');
    if (o.copy) T(c, `「${o.copy}」`, x + w / 2, y + 248, 10, '#ffe9a8', 'center', w - 20);
  }, { min: 30, max: 400, tag: 'dvd' });
}

// ================================================================ interactive: the entry form
// form: { year, era: 'heisei'|'reiwa', title, fields: [{ key, label, value, edit: async (g) => value | undefined, req, ro }], submit }
let tapCanvas = null;
const sceneTop = (g) => g && g.scenes && g.scenes[g.scenes.length - 1];
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = sceneTop(g);
    if (!sc || !sc.m1Tap) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}
export function formScreen(g, form) {
  bindTap(g);
  return new Promise((resolve) => {
    const rows = form.fields.length + 2; // + 提出 + やめる
    const sc = {
      hd: true, opaque: true, hidesHud: true, m1Tap: true, isM1Form: true, form, t: 0, idx: 0, busy: false, tapAt: null, msg: '',
      update(gg) {
        sc.t++;
        if (gg.auto) { gg.pop(sc); resolve(form); return; }
        if (sc.busy || sc.t < 4) return;
        const inp = gg.input;
        const tap = sc.tapAt; sc.tapAt = null;
        if (tap) { const i = sc.rowAt(tap.x, tap.y); if (i >= 0) sc.idx = i; else if (inp.pressedNow) inp.pressedNow.a = false; }
        if (inp.repeat('up')) { sc.idx = (sc.idx + rows - 1) % rows; sfx('cursor'); }
        if (inp.repeat('down')) { sc.idx = (sc.idx + 1) % rows; sfx('cursor'); }
        if (inp.pressed('b')) { sfx('cancel'); sc.idx = rows - 1; }
        if (inp.pressed('a')) sc.act(gg);
      },
      async act(gg) {
        sfx('ok');
        if (sc.idx === rows - 1) { gg.pop(sc); resolve(null); return; }
        if (sc.idx === rows - 2) {
          const miss = form.fields.find((f) => f.req && !String(f.value ?? '').trim());
          if (miss) { sc.msg = `「${miss.label}」が空欄です`; sfx('buzz'); return; }
          gg.pop(sc); resolve(form); return;
        }
        const f = form.fields[sc.idx];
        if (f.ro || !f.edit) { sc.msg = f.roWhy || 'この欄は変更できません'; return; }
        sc.busy = true;
        try { const v = await f.edit(gg, f); if (v !== undefined && v !== null) f.value = v; sc.msg = ''; } catch (e) { console.error(e); }
        sc.busy = false; gg.input.consume();
      },
      rowAt(x, y) {
        const L = sc.layout; if (!L) return -1;
        for (let i = 0; i < L.length; i++) { const r = L[i]; if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i; }
        return -1;
      },
      draw(c) {
        const heisei = form.era === 'heisei';
        const L = [];
        if (heisei) {
          R(c, 0, 0, SW, SH, '#5a4a3a');
          R(c, 70, 6, 500, 348, '#fbf6e8'); R(c, 74, 10, 492, 340, '#fbf6e8');
          R(c, 70, 6, 500, 3, RED);
          T(c, form.title, SW / 2, 16, 16, RED, 'center', 480);
          T(c, '※黒のボールペンで、楷書ではっきりとご記入ください', SW / 2, 38, 9, '#6a5a4a', 'center', 480);
        } else {
          R(c, 0, 0, SW, SH, '#e9edf3');
          R(c, 0, 0, SW, 30, '#14141c'); m1Logo(c, 14, 6, 14, form.year, { align: 'left' });
          T(c, 'エントリーフォーム', SW - 14, 9, 11, '#fff', 'right');
          R(c, 70, 34, 500, 316, '#ffffff'); R(c, 70, 34, 500, 1, '#c8ccd4');
          T(c, form.title, SW / 2, 40, 12, '#14141c', 'center', 480);
        }
        const y0 = heisei ? 54 : 58, rh = 21;
        form.fields.forEach((f, i) => {
          const y = y0 + i * rh, sel = i === sc.idx;
          if (heisei) {
            R(c, 84, y, 472, rh, sel ? '#fff0c8' : '#fbf6e8'); R(c, 84, y + rh - 1, 472, 1, '#c8b898'); R(c, 200, y, 1, rh, '#c8b898');
            T(c, f.label + (f.req ? '＊' : ''), 90, y + 5, 10, '#3a2a1a', 'left', 106);
            T(c, String(f.value ?? ''), 208, y + 4, 12, '#1a2a6a', 'left', 340);
          } else {
            T(c, f.label + (f.req ? ' *' : ''), 86, y + 5, 10, '#4a5468', 'left', 120);
            R(c, 210, y + 2, 344, rh - 4, sel ? '#eef4ff' : '#f6f7f9'); R(c, 210, y + rh - 3, 344, 1, sel ? '#3a6fd8' : '#c8ccd4');
            T(c, String(f.value ?? ''), 216, y + 5, 11, f.ro ? '#6a7488' : '#14141c', 'left', 334);
          }
          if (sel) T(c, '▶', 76, y + 4, 10, heisei ? RED : '#3a6fd8');
          L.push({ x: 80, y, w: 480, h: rh });
        });
        const by = y0 + form.fields.length * rh + 8;
        const btn = (i, label, x, w, main) => {
          const sel = sc.idx === i;
          R(c, x, by, w, 24, main ? (sel ? '#e8402a' : RED) : sel ? '#8a8a96' : '#b0b0ba');
          T(c, label, x + w / 2, by + 6, 12, '#fff', 'center', w - 8);
          L[i] = { x, y: by, w, h: 24 };
        };
        btn(rows - 2, heisei ? 'この内容で提出する（郵送）' : form.submit || '確認して送信する', 170, 200, true);
        btn(rows - 1, 'やめる', 390, 80, false);
        sc.layout = L;
        if (sc.msg) T(c, sc.msg, SW / 2, by + 30, 11, RED, 'center', 480);
        else T(c, '↑↓で選んでA：記入・変更　／　Bでやめる', SW / 2, by + 30, 9, heisei ? '#8a7a6a' : '#6a7488', 'center', 480);
      },
    };
    g.push(sc);
  });
}

// ================================================================ interactive: the results board
// o: { year, era, title, sub, rows: [{ no, name, me, mark }], note, mine (index or -1) }
export function boardScreen(g, o) {
  bindTap(g);
  return new Promise((resolve) => {
    const per = 12;
    const sc = {
      hd: true, opaque: true, hidesHud: true, m1Tap: true, isM1Board: true, t: 0, top: Math.max(0, (o.mine ?? 0) - 5),
      update(gg) {
        sc.t++;
        if (gg.auto) { gg.pop(sc); resolve(); return; }
        const inp = gg.input;
        const tap = sc.tapAt; sc.tapAt = null;
        if (tap && inp.pressedNow) {
          if (tap.y < 120 && sc.top > 0) { inp.pressedNow.a = false; sc.top = Math.max(0, sc.top - per); return; }
          if (tap.y > 300 && sc.top + per < o.rows.length) { inp.pressedNow.a = false; sc.top = Math.min(o.rows.length - per, sc.top + per); return; }
        }
        if (inp.repeat('up')) sc.top = Math.max(0, sc.top - 1);
        if (inp.repeat('down')) sc.top = Math.max(0, Math.min(o.rows.length - per, sc.top + 1));
        if (sc.t > 20 && (inp.pressed('a') || inp.pressed('b'))) { sfx('cursor'); gg.pop(sc); resolve(); }
      },
      draw(c) {
        const heisei = o.era === 'heisei';
        let x0 = 100, y0 = 90, w = 440;
        if (heisei) {
          R(c, 0, 0, SW, SH, '#6a4a2a');
          for (let i = 0; i < 300; i++) R(c, (i * 37) % SW, (i * 59) % SH, 2, 2, i % 2 ? '#7a5a3a' : '#5a3a1a');
          R(c, 90, 8, 460, 330, '#fdfdf8'); R(c, 316, 4, 8, 8, RED); R(c, 96, 12, 6, 6, '#3a6fd8'); R(c, 538, 12, 6, 6, '#3a6fd8');
          T(c, o.title, SW / 2, 20, fitSize(c, o.title, 430, 15, 10), INK, 'center', 430);
          T(c, o.sub || '', SW / 2, 42, 10, '#5a5a5a', 'center', 430);
          y0 = 66; x0 = 110; w = 420;
        } else {
          R(c, 0, 0, SW, SH, '#f2f3f6');
          R(c, 0, 0, SW, 34, '#14141c'); m1Logo(c, 14, 8, 15, o.year, { align: 'left' });
          T(c, '公式サイト', SW - 14, 12, 10, '#c8c8d8', 'right');
          R(c, 80, 40, 480, 300, '#fff');
          T(c, o.title, SW / 2, 48, fitSize(c, o.title, 460, 15, 10), INK, 'center', 460);
          T(c, o.sub || '', SW / 2, 70, 10, '#5a6478', 'center', 460);
          y0 = 90;
        }
        if (o.note) T(c, o.note, SW / 2, y0 - 2, 10, RED, 'center', 440);
        const rows = o.rows.slice(sc.top, sc.top + per);
        rows.forEach((r, i) => {
          const y = y0 + 14 + i * 19;
          if (r.me) { R(c, x0 - 4, y - 2, w + 8, 18, '#fff1a8'); if (sc.t % 30 < 20) R(c, x0 - 8, y + 4, 4, 4, RED); }
          T(c, r.no != null ? `No.${String(r.no).padStart(4, '0')}` : '', x0 + 4, y, 11, '#5a5a6a');
          T(c, r.name, x0 + 90, y, 12, r.me ? RED : INK, 'left', w - 170);
          if (r.mark) T(c, r.mark, x0 + w - 4, y, 10, r.markColor || '#3a6fd8', 'right', 80);
        });
        if (sc.top > 0) T(c, '▲', SW / 2, y0 + 2, 10, '#888', 'center');
        if (sc.top + per < o.rows.length) T(c, '▼', SW / 2, y0 + 14 + per * 19, 10, '#888', 'center');
        T(c, `${o.rows.length ? sc.top + 1 : 0}〜${Math.min(o.rows.length, sc.top + per)} / ${o.total ?? o.rows.length}`, SW / 2, 344, 9, heisei ? '#e8d8c8' : '#6a7488', 'center');
      },
    };
    g.push(sc);
  });
}
