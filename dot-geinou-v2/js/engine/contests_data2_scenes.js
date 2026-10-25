// 賞レースのデータ その2 (owner: D2b) — small HD scenes for the 19 contests' own formats.
//   withBackdrop(g, kind, opts, fn)  a stage drawn behind the dialogue while fn runs (popped afterwards)
//      kinds: theater | shrine | ballpark | studio | banquet | kaidan | jyuku | video | okinawa | ceremony | stream | timer30
//      opts: { title, sub, sign (text on the set), cast: [look…] (performers on stage), night }
//   showMeter(g, opts)   笑い声メーター / 恐怖メーター: animates a needle + waveform through samples, shows the final value
//      opts: { title, sub, label, unit, samples: [0..100], value (final number), max, decimals, theme: 'laugh'|'fear'|'cheer', note }
//   showBoard(g, opts)   a results table: { title, sub, cols: [{ key, label, w, align }], rows: [{ …, me }], note, max }
//   showBracket(g, opts) an 8- or 4-slot tournament: { title, sub, slots: [name…], wins: [[slot…] per round], me: slot, note }
// Every scene is hd (640x360), keyboard (A/B) and touch (tap = A) friendly, and closes itself under g.auto.

import { SW, SH, clamp, makeCanvas } from './util.js';
import { text, panel, rect, measure, wrap, COLORS } from './draw.js';
import { charSheetHD, LOOKS } from './sprites.js';
import { contestDate } from './contests.js';

const R = rect;
const fit = (c, s, maxW, size) => {
  s = String(s ?? '');
  if (measure(c, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length && measure(c, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
};
function fig(c, look, x, y, dir = 'down', s = 2, frame = 0) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites are optional */ }
}
const playerLook = (g) => (g && g.state && g.state.look) || LOOKS.player;
function heads(c, y, h, cols, seed = 1) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let x = -6; x < SW + 10; x += 22) {
    const hy = y + Math.floor(rnd() * 6);
    const col = cols[Math.floor(rnd() * cols.length)];
    R(c, x + Math.floor(rnd() * 6), hy, 16, 16, col);
    R(c, x - 2 + Math.floor(rnd() * 6), hy + 12, 20, h, '#14121c');
  }
}
function mic(c, x, y) { R(c, x, y, 3, 62, '#b8bcc8'); R(c, x - 3, y - 8, 9, 10, '#2a2a30'); R(c, x - 10, y + 60, 23, 4, '#55596a'); }
function spot(c, x, w, alpha = 0.18, color = '#fff6d0') {
  c.save(); c.globalAlpha = alpha; c.fillStyle = color;
  c.beginPath(); c.moveTo(x - 14, 0); c.lineTo(x + 14, 0); c.lineTo(x + w / 2, 230); c.lineTo(x - w / 2, 230); c.closePath(); c.fill(); c.restore();
}
function lantern(c, x, y, lit = true) {
  R(c, x - 7, y, 14, 18, lit ? '#e8402e' : '#8a2a22'); R(c, x - 5, y - 2, 10, 2, '#2a1a10'); R(c, x - 5, y + 18, 10, 2, '#2a1a10');
  if (lit) { R(c, x - 3, y + 4, 6, 10, '#ffb070'); }
}
function sign(c, str, x, y, w, h, bg = '#2a1a10', fg = '#ffe7a8', size = 14) {
  R(c, x, y, w, h, '#000000aa'); R(c, x + 2, y + 2, w - 4, h - 4, bg);
  text(c, fit(c, str, w - 12, size), x + w / 2, y + (h - size) / 2, { size, align: 'center', color: fg, shadow: null });
}

// ------------------------------------------------------------------ backdrops (static part cached)
const ART = {
  theater(c, o) {
    R(c, 0, 0, SW, SH, '#1a0f14');
    R(c, 0, 0, SW, 34, '#7a1020'); for (let x = 0; x < SW; x += 40) R(c, x, 26, 20, 8, '#d9a73a');
    for (let i = 0; i < 6; i++) { R(c, i * 18, 34, 14, 200, i % 2 ? '#8e1426' : '#a8182e'); R(c, SW - (i + 1) * 18, 34, 14, 200, i % 2 ? '#8e1426' : '#a8182e'); }
    R(c, 108, 34, SW - 216, 196, '#2a1c22');
    if (o.gold) { for (let x = 150; x < SW - 150; x += 34) { R(c, x, 60, 32, 130, '#c9a24a'); R(c, x + 30, 60, 2, 130, '#8a6a2a'); } }
    R(c, 0, 196, SW, 40, '#8a5a32'); for (let x = 0; x < SW; x += 48) R(c, x, 196, 1, 40, '#6a4224'); R(c, 0, 196, SW, 2, '#c08a52');
    mic(c, SW / 2 - 1, 140);
    if (o.sign) sign(c, o.sign, SW / 2 - 140, 64, 280, 26, '#3a0c14', '#ffe7a8', 14);
    heads(c, 238, 30, ['#2a2230', '#3a2a24', '#24242e'], 7);
  },
  shrine(c, o) {
    for (let y = 0; y < 200; y += 4) R(c, 0, y, SW, 4, `rgb(${Math.round(250 - y * 0.6)},${Math.round(150 - y * 0.45)},${Math.round(90 + y * 0.3)})`);
    R(c, 0, 150, SW, 60, '#3a2a30');
    for (let x = 30; x < SW; x += 110) { R(c, x, 120, 70, 40, '#d8d0c0'); R(c, x - 4, 112, 78, 10, '#b03a2e'); R(c, x + 8, 128, 54, 10, '#2a2420'); }
    R(c, 0, 60, SW, 3, '#2a1a10'); for (let x = 20; x < SW; x += 46) lantern(c, x, 64);
    R(c, 170, 150, 300, 60, '#7a4a2a'); for (let x = 170; x < 470; x += 30) R(c, x, 140, 15, 12, '#ffffff'), R(c, x + 15, 140, 15, 12, '#d8303a');
    R(c, 170, 150, 300, 3, '#a8703a');
    // 大きな鳥居ではなく境内の社の屋根（末社の前の特設舞台）
    R(c, 250, 92, 140, 10, '#3a2a24'); R(c, 240, 86, 160, 8, '#2a1e1a'); R(c, 262, 102, 116, 36, '#8a3a2a');
    mic(c, SW / 2 - 1, 120);
    if (o.sign) sign(c, o.sign, 176, 178, 288, 24, '#f4efe2', '#8a1a1a', 13); // 舞台の前幕
    heads(c, 222, 40, ['#3a3040', '#5a3a2a', '#2a2a3a'], 3);
  },
  ballpark(c, o) {
    R(c, 0, 0, SW, SH, '#20242e');
    for (let i = 0; i < 9; i++) { c.save(); c.strokeStyle = '#4a5060'; c.lineWidth = 2; c.beginPath(); c.arc(SW / 2, 260, 140 + i * 40, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.restore(); }
    R(c, 0, 108, SW, 52, '#2c3240'); for (let x = 0; x < SW; x += 6) R(c, x, 112 + ((x * 7) % 13), 3, 3, ['#d8c050', '#e0e0e8', '#3a5ac0', '#b8bcc8'][(x / 6) % 4]);
    R(c, 220, 30, 200, 60, '#0e1018'); R(c, 224, 34, 192, 52, '#18202c');
    text(c, 'GAME SET', 320, 38, { size: 14, color: '#ffd23f', align: 'center', shadow: null });
    R(c, 0, 160, SW, 76, '#2f8a3e'); for (let x = 0; x < SW; x += 64) R(c, x, 160, 32, 76, '#349a44');
    R(c, 250, 176, 140, 30, '#8a6a3a'); R(c, 250, 176, 140, 3, '#c8a050');
    mic(c, SW / 2 - 1, 120);
    if (o.sign) sign(c, o.sign, 226, 60, 188, 24, '#0e1030', '#ffd23f', 13); // スコアボード
    heads(c, 236, 30, ['#2a3a6a', '#d8c050', '#1e2a50'], 11);
  },
  studio(c, o) {
    R(c, 0, 0, SW, SH, '#0c1028');
    for (let x = 30; x < SW; x += 80) { R(c, x, 6, 22, 10, '#3a3e58'); R(c, x + 6, 16, 10, 6, '#ffe9a0'); }
    R(c, 120, 40, 400, 130, '#121a4a'); for (let i = 0; i < 12; i++) R(c, 120 + i * 34, 40, 2, 130, '#1e2a6a');
    R(c, 120, 40, 400, 2, '#5fd7ff'); R(c, 120, 168, 400, 2, '#5fd7ff');
    if (o.sign) { text(c, fit(c, o.sign, 380, 22), SW / 2, 88, { size: 22, align: 'center', color: o.signColor || '#ffd23f', outline: '#000' }); }
    R(c, 0, 186, SW, 50, '#262a44'); R(c, 0, 186, SW, 3, '#5fd7ff');
    R(c, 160, 196, 320, 8, '#3a3e5a');
    mic(c, SW / 2 - 1, 130);
    R(c, 18, 150, 40, 30, '#2a2a30'); R(c, 56, 160, 16, 10, '#1a1a20'); R(c, SW - 58, 150, 40, 30, '#2a2a30'); R(c, SW - 72, 160, 16, 10, '#1a1a20');
  },
  banquet(c, o) {
    R(c, 0, 0, SW, SH, '#3a2418');
    R(c, 0, 0, SW, 20, '#d8303a'); for (let x = 0; x < SW; x += 40) R(c, x, 0, 20, 20, '#ffffff');
    for (let x = 140; x < SW - 140; x += 45) { R(c, x, 40, 44, 130, '#d8b24a'); R(c, x + 43, 40, 1, 130, '#9a7a2a'); }
    R(c, 450, 140, 40, 16, '#f4efe2'); R(c, 456, 128, 28, 14, '#f4efe2'); R(c, 464, 120, 12, 8, '#f0a020'); // 鏡餅
    R(c, 0, 176, SW, 60, '#a88a5a'); for (let y = 176; y < 236; y += 15) R(c, 0, y, SW, 1, '#8a6a3a');
    for (let x = 20; x < SW; x += 150) { R(c, x, 206, 110, 14, '#5a2a18'); R(c, x + 10, 200, 14, 8, '#e8e0d0'); R(c, x + 40, 198, 10, 10, '#c83a2a'); R(c, x + 70, 200, 14, 8, '#e8e0d0'); }
    if (o.sign) sign(c, o.sign, SW / 2 - 150, 62, 300, 24, '#f4efe2', '#a8101a', 14);
    mic(c, SW / 2 - 1, 112);
  },
  kaidan(c, o) {
    R(c, 0, 0, SW, SH, '#05060c');
    for (let y = 0; y < 236; y += 6) R(c, 0, y, SW, 3, '#070912');
    spot(c, SW / 2, 230, 0.12, '#8aa0ff');
    R(c, 300, 150, 40, 8, '#3a2a20'); R(c, 304, 158, 4, 40, '#2a1e18'); R(c, 332, 158, 4, 40, '#2a1e18'); R(c, 302, 110, 36, 42, '#2a1e18');
    R(c, 0, 210, SW, 26, '#0c0e16');
    if (o.sign) text(c, fit(c, o.sign, 420, 16), SW / 2, 70, { size: 16, align: 'center', color: '#c8d0ff', shadow: '#000' });
  },
  jyuku(c, o) {
    R(c, 0, 0, SW, SH, '#e8e2d0');
    R(c, 120, 26, 400, 120, '#2e4a3a'); R(c, 116, 22, 408, 4, '#8a6a3a'); R(c, 116, 146, 408, 6, '#8a6a3a');
    text(c, 'x² − 5x + 6 = 0', 150, 66, { size: 16, color: '#f0f0e0', shadow: null });
    text(c, '1192 → 1185？', 150, 92, { size: 16, color: '#f0f0e0', shadow: null });
    text(c, 'be動詞 / 化学式 H₂O', 150, 118, { size: 14, color: '#f0f0e0', shadow: null });
    if (o.sign) sign(c, o.sign, 340, 64, 168, 26, '#1e3a2a', '#ffd23f', 13);
    R(c, 0, 170, SW, 66, '#b8a078');
    for (let x = 30; x < SW; x += 120) { R(c, x, 196, 80, 10, '#8a6a3a'); R(c, x + 6, 206, 6, 24, '#6a4a2a'); R(c, x + 68, 206, 6, 24, '#6a4a2a'); }
    mic(c, SW / 2 - 1, 120);
  },
  video(c, o) {
    R(c, 0, 0, SW, SH, '#d8d4cc'); R(c, 0, 180, SW, 56, '#9a8a72');
    R(c, 60, 40, 520, 140, '#e8e6e0');
    R(c, 470, 100, 10, 110, '#3a3a40'); R(c, 450, 206, 50, 4, '#3a3a40'); R(c, 456, 78, 38, 26, '#18181c'); R(c, 462, 84, 26, 14, '#3a5ac0');
    c.save(); c.strokeStyle = '#f8f8f8'; c.lineWidth = 6; c.beginPath(); c.arc(140, 100, 34, 0, Math.PI * 2); c.stroke(); c.restore();
    R(c, 138, 134, 4, 76, '#3a3a40');
    if (o.sign) sign(c, o.sign, 200, 64, 240, 24, '#2a2a30', '#ffffff', 13);
  },
  okinawa(c, o) {
    for (let y = 0; y < 150; y += 5) R(c, 0, y, SW, 5, `rgb(${Math.round(20 + y * 0.3)},${Math.round(30 + y * 0.5)},${Math.round(80 + y * 0.4)})`);
    R(c, 0, 132, SW, 30, '#1a4a7a'); for (let x = 0; x < SW; x += 30) R(c, x, 140 + (x % 3) * 4, 18, 2, '#5aa0d0');
    for (const px of [40, 560]) { R(c, px, 70, 8, 100, '#3a2a1a'); for (let k = -3; k <= 3; k++) R(c, px - 30 + k * 2, 64 + Math.abs(k) * 4, 70 - Math.abs(k) * 8, 4, '#1e5a2a'); }
    R(c, 150, 150, 340, 56, '#2a2a3a'); R(c, 150, 150, 340, 4, '#ffd23f');
    for (let x = 160; x < 490; x += 40) R(c, x, 140, 10, 10, ['#ff5d6c', '#5fd7ff', '#ffd23f', '#5ee07a'][(x / 40) % 4]);
    mic(c, SW / 2 - 1, 120);
    if (o.sign) sign(c, o.sign, 176, 172, 288, 24, '#0a2a4a', '#ffd23f', 13); // 舞台の前幕
    heads(c, 230, 36, ['#2a2a3a', '#3a2a24', '#1e2a3a'], 5);
  },
  ceremony(c, o) {
    R(c, 0, 0, SW, SH, '#2a1a08');
    for (let x = 0; x < SW; x += 24) R(c, x, 0, 12, 200, '#c9a24a'), R(c, x + 12, 0, 12, 200, '#b08a38');
    R(c, 270, 128, 100, 72, '#5a2a14'); R(c, 270, 128, 100, 4, '#e0b860');
    R(c, 308, 98, 24, 30, '#ffd23f'); R(c, 302, 94, 36, 6, '#ffe070'); R(c, 314, 128, 12, 6, '#c9a24a');
    for (const fx of [180, 440]) { R(c, fx, 150, 24, 50, '#2a6a2a'); R(c, fx - 6, 140, 12, 12, '#ff7eb6'); R(c, fx + 10, 134, 12, 12, '#ffd23f'); R(c, fx + 22, 142, 12, 12, '#ff5d6c'); }
    R(c, 0, 200, SW, 36, '#4a1a10');
    if (o.sign) sign(c, o.sign, SW / 2 - 160, 62, 320, 28, '#3a0c08', '#ffe7a8', 15);
    heads(c, 234, 30, ['#2a2230', '#3a2a24'], 9);
  },
  stream(c, o) {
    R(c, 0, 0, SW, SH, '#0e0e18');
    R(c, 30, 30, 360, 190, '#18182a'); R(c, 30, 30, 360, 2, '#ff3a5a');
    text(c, '● LIVE', 44, 40, { size: 12, color: '#ff3a5a', shadow: null });
    R(c, 410, 30, 200, 190, '#141420');
    const chat = o.chat || ['きた！', '新春からこれ', 'がんばれー', '草', 'おめでとう'];
    chat.slice(0, 7).forEach((s, i) => { R(c, 418, 40 + i * 25, 184, 20, '#20203a'); text(c, fit(c, s, 176, 12), 424, 44 + i * 25, { size: 12, color: '#d8dcf0', shadow: null }); });
    mic(c, 210, 130);
    if (o.sign) text(c, fit(c, o.sign, 330, 18), 210, 70, { size: 18, align: 'center', color: '#ffd23f', outline: '#000' });
    R(c, 0, 220, SW, 16, '#1a1a28');
  },
  timer30(c, o) {
    R(c, 0, 0, SW, SH, '#101016');
    R(c, 200, 20, 240, 100, '#000'); R(c, 204, 24, 232, 92, '#1a0a0a');
    text(c, '0:30', SW / 2, 40, { size: 48, align: 'center', color: '#ff3a3a', shadow: null });
    R(c, 0, 150, SW, 86, '#2a2a34'); R(c, 0, 150, SW, 3, '#ffd23f');
    mic(c, SW / 2 - 1, 120);
    if (o.sign) sign(c, o.sign, SW / 2 - 140, 206, 280, 22, '#000', '#ffd23f', 13);
  },
};

export class Backdrop {
  constructor(g, kind, opts = {}) {
    Object.assign(this, { g, kind: ART[kind] ? kind : 'theater', opts, t: 0, hd: true, opaque: true, hidesHud: true });
    const [cv, c] = makeCanvas(SW, SH);
    try { ART[this.kind](c, opts); } catch (e) { console.error(e); }
    this.cv = cv;
  }
  update() { this.t++; }
  draw(ctx, g) {
    ctx.drawImage(this.cv, 0, 0);
    const o = this.opts;
    const t = this.t;
    if (this.kind === 'theater' || this.kind === 'studio' || this.kind === 'ceremony') spot(ctx, SW / 2, 210 + Math.sin(t / 30) * 8);
    if (this.kind === 'kaidan') {
      for (const [x, y] of [[250, 196], [390, 196]]) { R(ctx, x, y, 6, 14, '#e8e0c8'); const f = Math.sin(t / 5 + x) * 1.5; R(ctx, x + 1, y - 7 + f, 4, 7, '#ffb040'); R(ctx, x + 2, y - 4 + f, 2, 3, '#fff0b0'); }
    }
    if (this.kind === 'video' && Math.floor(t / 30) % 2 === 0) { R(ctx, 500, 16, 10, 10, '#ff3a3a'); text(ctx, 'REC', 514, 14, { size: 12, color: '#ff3a3a', shadow: null }); }
    if (this.kind === 'timer30' && o.count != null) { R(ctx, 204, 24, 232, 92, '#1a0a0a'); text(ctx, `0:${String(Math.max(0, o.count)).padStart(2, '0')}`, SW / 2, 40, { size: 48, align: 'center', color: '#ff3a3a', shadow: null }); }
    // performers (the act) on the stage
    const cast = o.cast || [playerLook(g)];
    const n = cast.length;
    const baseY = this.kind === 'banquet' ? 108 : this.kind === 'shrine' ? 74 : this.kind === 'okinawa' ? 76 : this.kind === 'ballpark' ? 100 : 118;
    const cx = this.kind === 'stream' ? 210 : SW / 2;
    if (o.cast !== false) cast.forEach((lk, i) => fig(ctx, lk, cx - 32 * n - 6 + i * 70 + (n === 1 ? 38 : 0), baseY, i < n / 2 ? 'right' : 'left', 2, Math.floor(t / 24) % 2));
    // title panel + date
    if (o.title) {
      const tw = Math.min(SW - 180, Math.max(measure(ctx, o.title, 16), measure(ctx, o.sub || '', 12)) + 28);
      panel(ctx, 8, 8, tw, o.sub ? 50 : 32, { bg: '#1a1f38' });
      text(ctx, fit(ctx, o.title, tw - 28, 16), 22, 15, { size: 16, color: COLORS.accent });
      if (o.sub) text(ctx, fit(ctx, o.sub, tw - 28, 12), 22, 36, { size: 12, color: '#d8dcf0' });
    }
    if (g && g.state) {
      const d = contestDate(g);
      const label = `${d.year}年${d.month}月`;
      const w = measure(ctx, label, 12) + 20;
      panel(ctx, SW - w - 8, 8, w, 26, { bg: '#1a1f38' });
      text(ctx, label, SW - w + 2, 14, { size: 12, color: '#d8dcf0' });
    }
  }
}
// Pushes a backdrop for the duration of fn (always popped, even on errors).
export async function withBackdrop(g, kind, opts, fn) {
  const sc = new Backdrop(g, kind, opts || {});
  g.push(sc);
  try { return await fn(sc); } finally { g.pop(sc); }
}

// ------------------------------------------------------------------ meter (笑い声 / 恐怖)
const THEMES = {
  laugh: { bg: '#120c1e', bar: ['#5ee07a', '#ffd23f', '#ff7e3a', '#ff3a5a'], ink: '#ffd23f', wave: '#ff7eb6' },
  fear: { bg: '#05060e', bar: ['#3a4a8a', '#5a3aa8', '#8a2ac8', '#d01a4a'], ink: '#c8d0ff', wave: '#8aa0ff' },
  cheer: { bg: '#0a1a12', bar: ['#5ee07a', '#5fd7ff', '#ffd23f', '#ff7eb6'], ink: '#5fd7ff', wave: '#5ee07a' },
};
class MeterScene {
  constructor(g, o, resolve) {
    Object.assign(this, { g, o, resolve, t: 0, hd: true, opaque: true, hidesHud: true, done: false });
    this.th = THEMES[o.theme] || THEMES.laugh;
    this.samples = (o.samples && o.samples.length ? o.samples : [o.value || 0]).map((v) => clamp(Number(v) || 0, 0, 100));
    this.dur = 150;
  }
  update(g) {
    this.t++;
    const a = g.input && (g.input.pressed('a') || g.input.pressed('b'));
    if (g.auto) { this.close(g); return; }
    if (a && this.t < this.dur) { this.t = this.dur; return; }
    if (a && this.t >= this.dur + 10) this.close(g);
  }
  close(g) { if (this.done) return; this.done = true; g.pop(this); this.resolve(); }
  draw(ctx) {
    const o = this.o, th = this.th;
    R(ctx, 0, 0, SW, SH, th.bg);
    panel(ctx, 8, 8, SW - 16, 44, { bg: '#1a1f38' });
    text(ctx, fit(ctx, o.title || '笑い声メーター', SW - 48, 16), 22, 14, { size: 16, color: COLORS.accent });
    if (o.sub) text(ctx, fit(ctx, o.sub, SW - 48, 12), 22, 34, { size: 12, color: '#d8dcf0' });
    const p = clamp(this.t / this.dur, 0, 1);
    const n = this.samples.length;
    const upto = Math.max(1, Math.round(p * n));
    const cur = this.samples[Math.min(n - 1, upto - 1)];
    // waveform
    const wx = 30, wy = 70, ww = 380, wh = 150;
    R(ctx, wx - 2, wy - 2, ww + 4, wh + 4, '#000'); R(ctx, wx, wy, ww, wh, '#0c0c18');
    for (let k = 1; k < 4; k++) R(ctx, wx, wy + (wh * k) / 4, ww, 1, '#1e2038');
    const bw = ww / n;
    for (let i = 0; i < upto; i++) {
      const v = this.samples[i] / 100;
      const h = Math.max(2, Math.round(v * (wh - 6)));
      const col = th.bar[Math.min(3, Math.floor(v * 4))];
      R(ctx, wx + i * bw + 1, wy + wh - h - 2, Math.max(1, bw - 2), h, col);
    }
    text(ctx, o.label || '笑量', wx, wy + wh + 6, { size: 12, color: '#9aa3c7' });
    // vertical meter
    const mx = 440, my = 70, mw = 46, mh = 150;
    R(ctx, mx - 2, my - 2, mw + 4, mh + 4, '#000'); R(ctx, mx, my, mw, mh, '#14142a');
    const fill = Math.round((cur / 100) * mh);
    for (let y = 0; y < fill; y += 6) { const v = y / mh; R(ctx, mx + 4, my + mh - y - 5, mw - 8, 4, th.bar[Math.min(3, Math.floor(v * 4))]); }
    // final value
    const max = o.max || 100;
    const dec = o.decimals ?? 2;
    const shown = p < 1 ? (cur / 100) * max * 0.98 : Number(o.value ?? (cur / 100) * max);
    const valStr = `${shown.toFixed(dec)}${o.unit || ''}`;
    panel(ctx, 500, 70, 128, 80, { bg: '#1a1f38' });
    text(ctx, p < 1 ? '計測中…' : '結果', 564, 80, { size: 12, align: 'center', color: '#9aa3c7' });
    text(ctx, fit(ctx, valStr, 116, 24), 564, 104, { size: 24, align: 'center', color: th.ink });
    if (o.note) { const lines = wrap(ctx, o.note, SW - 60, 12).slice(0, 3); lines.forEach((l, i) => text(ctx, l, 30, 250 + i * 18, { size: 12, color: '#d8dcf0' })); }
    if (p >= 1 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'A：つぎへ', SW - 20, SH - 24, { size: 12, align: 'right', color: '#9aa3c7' });
  }
}
export function showMeter(g, o = {}) { return new Promise((resolve) => g.push(new MeterScene(g, o, resolve))); }

// ------------------------------------------------------------------ board (results table)
class BoardScene {
  constructor(g, o, resolve) { Object.assign(this, { g, o, resolve, t: 0, hd: true, opaque: true, hidesHud: true, done: false }); }
  update(g) {
    this.t++;
    if (g.auto) { this.close(g); return; }
    if (this.t > 12 && g.input && (g.input.pressed('a') || g.input.pressed('b'))) this.close(g);
  }
  close(g) { if (this.done) return; this.done = true; g.pop(this); this.resolve(); }
  draw(ctx) {
    const o = this.o;
    R(ctx, 0, 0, SW, SH, o.bg || '#0e1226');
    panel(ctx, 8, 8, SW - 16, 44, { bg: '#1a1f38' });
    text(ctx, fit(ctx, o.title || '結果', SW - 48, 16), 22, 14, { size: 16, color: COLORS.accent });
    if (o.sub) text(ctx, fit(ctx, o.sub, SW - 48, 12), 22, 34, { size: 12, color: '#d8dcf0' });
    const cols = o.cols || [{ key: 'place', label: '順位', w: 60 }, { key: 'name', label: '名前', w: 360 }, { key: 'score', label: '点', w: 120, align: 'right' }];
    const max = o.max || 9;
    let rows = (o.rows || []).slice();
    const meIdx = rows.findIndex((x) => x.me);
    if (rows.length > max) { const keep = rows.slice(0, max - 1); if (meIdx >= max - 1) keep.push(rows[meIdx]); else keep.push(rows[max - 1]); rows = keep; }
    const x0 = 20, y0 = 62;
    let x = x0;
    for (const c of cols) { text(ctx, c.label, c.align === 'right' ? x + c.w - 8 : x + 6, y0, { size: 12, color: '#9aa3c7', align: c.align === 'right' ? 'right' : 'left' }); x += c.w; }
    rows.forEach((row, i) => {
      const y = y0 + 20 + i * 24;
      R(ctx, x0, y - 2, SW - 40, 22, row.me ? '#3a2a5a' : i % 2 ? '#141a34' : '#18203e');
      if (row.me) R(ctx, x0, y - 2, 4, 22, COLORS.accent);
      let xx = x0;
      for (const c of cols) {
        const v = row[c.key];
        const s = v == null ? '' : String(v);
        const col = row.me ? '#ffffff' : c.key === 'name' ? '#e8ecff' : '#c8d0f0';
        text(ctx, fit(ctx, s, c.w - 14, 14), c.align === 'right' ? xx + c.w - 8 : xx + 6, y + 1, { size: 14, color: row.hl && c.key === 'name' ? COLORS.accent : col, align: c.align === 'right' ? 'right' : 'left' });
        xx += c.w;
      }
    });
    if (o.note) { const lines = wrap(ctx, o.note, SW - 50, 12).slice(0, 3); lines.forEach((l, i) => text(ctx, l, 22, SH - 64 + i * 17, { size: 12, color: '#d8dcf0' })); }
    if (this.t > 12 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'A：つぎへ', SW - 20, SH - 18, { size: 12, align: 'right', color: '#9aa3c7' });
  }
}
export function showBoard(g, o = {}) { return new Promise((resolve) => g.push(new BoardScene(g, o, resolve))); }

// ------------------------------------------------------------------ bracket (4 or 8 slots)
class BracketScene {
  constructor(g, o, resolve) { Object.assign(this, { g, o, resolve, t: 0, hd: true, opaque: true, hidesHud: true, done: false }); }
  update(g) {
    this.t++;
    if (g.auto) { this.close(g); return; }
    if (this.t > 12 && g.input && (g.input.pressed('a') || g.input.pressed('b'))) this.close(g);
  }
  close(g) { if (this.done) return; this.done = true; g.pop(this); this.resolve(); }
  draw(ctx) {
    const o = this.o;
    R(ctx, 0, 0, SW, SH, '#10121e');
    panel(ctx, 8, 8, SW - 16, 44, { bg: '#1a1f38' });
    text(ctx, fit(ctx, o.title || 'トーナメント', SW - 48, 16), 22, 14, { size: 16, color: COLORS.accent });
    if (o.sub) text(ctx, fit(ctx, o.sub, SW - 48, 12), 22, 34, { size: 12, color: '#d8dcf0' });
    const slots = o.slots || [];
    const n = slots.length <= 4 ? 4 : 8;
    const rounds = n === 8 ? 3 : 2;
    const top = 64, gap = n === 8 ? 30 : 56, boxW = n === 8 ? 130 : 168, boxH = 22;
    const step = boxW + (n === 8 ? 22 : 40);
    const colX = [16, 16 + step, 16 + step * 2, 16 + step * 3];
    const wins = o.wins || [];
    const reveal = Math.min(rounds, Math.floor(this.t / 25));
    const yOf = (r, i) => top + (i + 0.5) * gap * 2 ** r - boxH / 2;
    // first column: entrants
    for (let i = 0; i < n; i++) {
      const y = yOf(0, i);
      const me = o.me === i;
      R(ctx, colX[0], y, boxW, boxH, me ? '#3a2a5a' : '#18203e');
      if (me) R(ctx, colX[0], y, 4, boxH, COLORS.accent);
      text(ctx, fit(ctx, slots[i] || '—', boxW - 14, 13), colX[0] + 8, y + 4, { size: 13, color: me ? '#fff' : '#e8ecff' });
    }
    for (let r = 0; r < rounds; r++) {
      const w = wins[r] || [];
      const m = n / 2 ** (r + 1);
      for (let k = 0; k < m; k++) {
        const ya = yOf(r, k * 2) + boxH / 2, yb = yOf(r, k * 2 + 1) + boxH / 2, ym = (ya + yb) / 2;
        const xa = colX[r] + boxW;
        const half = Math.floor((step - boxW) / 2);
        R(ctx, xa, ya, half, 2, '#4a5070'); R(ctx, xa, yb, half, 2, '#4a5070'); R(ctx, xa + half, ya, 2, yb - ya + 2, '#4a5070'); R(ctx, xa + half, ym, step - boxW - half, 2, '#4a5070');
        if (r < reveal && w[k] != null) {
          const win = w[k];
          const y = yOf(r + 1, k);
          const me = o.me === win;
          R(ctx, colX[r + 1], y, boxW, boxH, me ? '#5a3a8a' : '#24305a');
          text(ctx, fit(ctx, slots[win] || '—', boxW - 14, 13), colX[r + 1] + 8, y + 4, { size: 13, color: r === rounds - 1 ? COLORS.accent : '#fff' });
          const fromTop = win === (wins[r - 1] ? wins[r - 1][k * 2] : k * 2);
          R(ctx, xa, fromTop ? ya : yb, half, 2, COLORS.accent);
        }
      }
    }
    if (o.note) { const lines = wrap(ctx, o.note, SW - 50, 12).slice(0, 2); lines.forEach((l, i) => text(ctx, l, 22, SH - 46 + i * 17, { size: 12, color: '#d8dcf0' })); }
    if (this.t > 12 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'A：つぎへ', SW - 20, SH - 18, { size: 12, align: 'right', color: '#9aa3c7' });
  }
}
export function showBracket(g, o = {}) { return new Promise((resolve) => g.push(new BracketScene(g, o, resolve))); }
