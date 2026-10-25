// クイズ番組の本番形式 (owner: R7-D) — one HD minigame, 'quizstudio', that plays a quiz show's stages in order.
//
//   await g.minigame('quizstudio', { show: 'クイズ!ヘキサゴンII' | showId: 'hexagon2', stages?: [...], difficulty,
//                                    practice?: true, year?, month?, count? })
//   stages (by show and date, quiz_bank.js showStages):
//     paper    ペーパーテスト: 10 4択 on an answer sheet against one clock, graded, then the 18 contestants
//              ranked from the bottom up (the ranking makes the teams of the next stage)
//     taiman   1対1 早押し (ヘキサゴンII「ご指名!タイマンクイズ」 style): 3 teams of 6 (points 6…1 by the
//              paper rank); the nominator names someone from another team, the loser's points come off
//              their team and the loser nominates next
//     league   practice: 1対1 早押し against 4 rivals in turn (勝ち負けの表)
//     hexa6    クイズ!ヘキサゴン style: 6 seats on a hexagon take turns as 出題者 and try to see through
//              who answers wrong (or that everyone is right)
//     five     ファイブリーグ: a 5-letter answer, the player and 4 teammates write one letter each in turn
//     trolley  トロッコアドベンチャー: 5 forks, a 2択 at each, the trolley goes down the rail you pick
//     tanshuku 略語の特訓: 略語 → 元の言葉 on a night train (agent C owns the full 短縮鉄道の夜)
//   The quiz minigame ('quiz', js/minigames/quiz.js) hands a TV quiz show to this one by its title.
//
// Knowledge: g.quizBonus(showId) (quiz_app.js) → { v, pts }: v is added to this.bonus (more time, slower
// rivals; shown as 「雑学 +x%」 on the intro card) and pts is added to the final score (shown in the comment).
// Every answer is reported to g.quizRecord(question, ok, { practice, show }) when it exists.
// Keyboard: ↑↓←→ + A (B: skip on the paper test). Touch / mouse: tap a choice (or a rail / a name).
// g.auto: the base class ends it; with g.auto.playFrames the stages run without input (time-outs).

import { Minigame, registerMinigame, text, wrap, COLORS, sparkle, rankFor } from './minigame.js';
import { measure } from './draw.js';
import { charSheetHD, LOOKS } from './sprites.js';
import { audio, registerSong } from './audio.js';
import { SW, SH, clamp } from './util.js';
import {
  pick, asChoices, CATS, FIVE, fiveWrong, twoQuestions, tanshukuPool, tanshukuQuestion, RIVALS, MC, rivalP,
  SHOWS, showOf, showStages, qOk,
} from './quiz_bank.js';

// ======================================================================== music (original chiptunes)
registerSong('qs_hexa', {
  bpm: 140, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.034, notes: 'D5 . F#5 A5 D6 . A5 F#5 | G5 . B5 D6 G5 . E5 . | F#5 . A5 . E5 . C#5 . | D5 - - . A4 . D5 . | B4 . D5 F#5 B5 . F#5 D5 | G4 . B4 D5 G5 . D5 B4 | E5 . G5 B5 A5 . G5 F#5 | E5 - - . A4 . C#5 E5' },
    { wave: 'triangle', vol: 0.11, notes: 'D3 . D3 . A2 . D3 . | G2 . G2 . D3 . G2 . | F#2 . F#2 . A2 . A2 . | D3 . A2 . D3 . . . | B2 . B2 . F#2 . B2 . | G2 . G2 . D3 . G2 . | E2 . E2 . G2 . B2 . | A2 . A2 . E2 . A2 .' },
    { wave: 'drum', vol: 0.08, notes: 'k . h . s . h k | k . h . s h h .' },
  ],
});
registerSong('qs_nep', {
  bpm: 150, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.034, notes: 'A4 . C5 E5 A5 . G5 E5 | F5 . E5 D5 C5 . D5 E5 | G4 . B4 D5 G5 . F5 D5 | E5 . D5 C5 B4 . . . | A4 . C5 E5 A5 . B5 C6 | B5 . A5 G5 E5 . G5 . | F5 . A5 . E5 . G5 . | E5 - D5 - C5 - B4 .' },
    { wave: 'triangle', vol: 0.12, notes: 'A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | E2 E2 E3 E2 E2 E2 G#2 B2' },
    { wave: 'drum', vol: 0.09, notes: 'k h s h k k s h' },
  ],
});
registerSong('qs_think', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'E5 . . . D#5 . . . | E5 . . . B4 . . . | C5 . . . B4 . . . | A4 . . . . . . .' },
    { wave: 'square', vol: 0.018, notes: 'E3 E3 . E3 . E3 . . | E3 E3 . E3 . F3 . .' },
    { wave: 'drum', vol: 0.07, notes: 'k . . . h . . . | k . . . h . h .' },
  ],
});
registerSong('qs_trolley', {
  bpm: 168, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.03, notes: 'C5 E5 G5 C6 G5 E5 C5 E5 | D5 F5 A5 D6 A5 F5 D5 F5 | E5 G5 B5 E6 B5 G5 E5 G5 | F5 A5 C6 F6 E6 D6 C6 B5' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . C3 C3 . C3 . C3 | D3 . D3 D3 . D3 . D3 | E3 . E3 E3 . E3 . E3 | F3 . F3 . G3 . G3 .' },
    { wave: 'drum', vol: 0.09, notes: 'k h k h s h k h' },
  ],
});
registerSong('qs_train', {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.1, notes: 'G4 . B4 . D5 . G5 . | F#5 . D5 . A4 . D5 . | E5 . C5 . G4 . C5 . | D5 - - . . . . . | B4 . D5 . G5 . B5 . | A5 . F#5 . D5 . F#5 . | G5 . E5 . C5 . E5 . | D5 - - - . . . .' },
    { wave: 'square', vol: 0.018, notes: 'G3 . D3 . G3 . D3 . | D3 . A2 . D3 . A2 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . F#3 .' },
    { wave: 'drum', vol: 0.06, notes: 'k h h h s h h h' },
  ],
});

// ======================================================================== small helpers
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const T = (c, s, x, y, size = 14, color = '#fff', align = 'left', o = {}) => text(c, s, Math.round(x), Math.round(y), { size, color, align, outline: o.outline, shadow: o.shadow === undefined ? 'rgba(0,0,0,0.55)' : o.shadow });
function fitLine(c, s, maxW, size) {
  s = String(s);
  if (measure(c, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length > 1 && measure(c, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
}
function fitSize(c, s, maxW, sizes = [18, 16, 14, 12]) {
  for (const z of sizes) if (measure(c, s, z) <= maxW) return z;
  return sizes[sizes.length - 1];
}
// a panel with cut corners
function plate(c, x, y, w, h, fill, edge = null, k = 3) {
  if (edge) { R(c, x + k, y, w - 2 * k, h, edge); R(c, x, y + k, w, h - 2 * k, edge); R(c, x + 1, y + 1, w - 2, h - 2, edge); }
  const i = edge ? 2 : 0;
  R(c, x + k + i, y + i, w - 2 * k - 2 * i, h - 2 * i, fill);
  R(c, x + i, y + k + i, w - 2 * i, h - 2 * k - 2 * i, fill);
  R(c, x + 1 + i, y + 1 + i, w - 2 - 2 * i, h - 2 - 2 * i, fill);
}
function hexPath(c, cx, cy, rx, ry) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function person(c, look, x, y, k = 1.5, dir = 'down', frame = 0) {
  try {
    const sh = charSheetHD(look || LOOKS.player);
    const list = sh[dir] || sh.down;
    const img = list[frame] || list[0];
    c.drawImage(img, Math.round(x - 16 * k), Math.round(y - 40 * k), Math.round(32 * k), Math.round(40 * k));
  } catch (e) { R(c, x - 8, y - 30, 16, 30, '#888'); }
}
function tones(seq) {
  if (!audio.ctx || audio.muted) return;
  const t0 = audio.ctx.currentTime + 0.01;
  for (const [f, s, d, wave = 'square', vol = 0.07] of seq) audio.tone(f, t0 + s, d, { wave, vol });
}
const SND = {
  jingle: [[784, 0, 0.07], [1047, 0.08, 0.07], [1319, 0.16, 0.18, 'square', 0.06], [523, 0.16, 0.18, 'triangle', 0.1]],
  pinpon: [[1319, 0, 0.17, 'square', 0.08], [1047, 0.19, 0.42, 'square', 0.08], [659, 0, 0.17, 'triangle', 0.1], [523, 0.19, 0.42, 'triangle', 0.1]],
  bubuu: [[150, 0, 0.16, 'sawtooth', 0.07], [150, 0.22, 0.45, 'sawtooth', 0.07], [75, 0, 0.16, 'square', 0.05], [75, 0.22, 0.45, 'square', 0.05]],
  buzz: [[1760, 0, 0.05, 'square', 0.06], [2349, 0.05, 0.12, 'square', 0.06]],
  tick: [[1200, 0, 0.03, 'square', 0.04]],
  tick2: [[1600, 0, 0.05, 'square', 0.05]],
  pen: [[2600, 0, 0.02, 'triangle', 0.03], [2200, 0.03, 0.02, 'triangle', 0.03]],
  drum: [[110, 0, 0.08, 'triangle', 0.12], [110, 0.12, 0.08, 'triangle', 0.12], [110, 0.24, 0.08, 'triangle', 0.12], [110, 0.36, 0.08, 'triangle', 0.12]],
  crash: [[90, 0, 0.3, 'sawtooth', 0.08], [60, 0.2, 0.5, 'square', 0.06], [200, 0, 0.1, 'square', 0.05]],
  fanfare: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.5, 'square', 0.08], [523, 0.36, 0.5, 'triangle', 0.12]],
};
const shuffled = (a, rng) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const LABELS = ['ア', 'イ', 'ウ', 'エ'];
const LABEL_COLORS = ['#e8434f', '#3a7be0', '#2fae5a', '#e0a81c'];
const RANK_LINES = { S: 'クイズ王の風格！文句なし！', A: '物知りっぷりが光った！', B: 'なかなかの健闘！', C: 'もう少し勉強が必要かも…', D: '今日はド忘れ連発だった…' };

// The game year / month (g.gameDate when there is one; else the era's start + elapsed days).
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export function gameYM(g) {
  try {
    if (g && typeof g.gameDate === 'function') { const d = g.gameDate(); if (d && Number.isFinite(d.year)) return { y: d.year, m: clamp(Math.round(d.month || 4), 1, 12) }; }
  } catch (e) { /* fall back */ }
  const st = g && g.state;
  const base = ERA_BASE[st && st.profile && st.profile.era] || 2026;
  const n = Math.max(0, ((st && st.day) || 1) - 1);
  const mi = 3 + Math.floor(n / 10);
  return { y: base + Math.floor(mi / 12), m: (mi % 12) + 1 };
}

// Touch / mouse: the tap position in screen pixels for the top scene that asks for it (quizTap).
let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = g.scenes && g.scenes[g.scenes.length - 1];
    if (!sc || !sc.quizTap) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = ((e.clientX - r.left) * SW) / r.width, y = ((e.clientY - r.top) * SH) / r.height;
    sc.tapAt = sc.hd ? { x, y } : { x: (x - 80) / 1.5, y: y / 1.5 };
  }, { passive: true });
}
export { bindTap };
const inRect = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

// ======================================================================== themes
const THEMES = {
  hexagon: { top: '#050f33', bot: '#123a8a', acc: '#ffd23f', acc2: '#5fd7ff', panel: '#0a1640', edge: '#ffd23f', bgm: 'qs_hexa', motif: 'hex' },
  hexagon2: { top: '#08072e', bot: '#3a1a7a', acc: '#ffd23f', acc2: '#ff7eb6', panel: '#120c3a', edge: '#ffd23f', bgm: 'qs_hexa', motif: 'hex' },
  nepleague: { top: '#1a0626', bot: '#5a0f3a', acc: '#ff4f6a', acc2: '#3ae0ff', panel: '#1c0a2a', edge: '#3ae0ff', bgm: 'qs_nep', motif: 'led' },
  tanshuku: { top: '#03041a', bot: '#1a1450', acc: '#ffd23f', acc2: '#9cf0ff', panel: '#0c0c30', edge: '#9cf0ff', bgm: 'qs_train', motif: 'stars' },
  practice: { top: '#0d2a20', bot: '#1d5a3e', acc: '#ffe27a', acc2: '#9cffb8', panel: '#123024', edge: '#9cffb8', bgm: 'qs_think', motif: 'board' },
};
function drawBg(c, th, t) {
  const n = 30;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const mixc = (a, b) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
      return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
    };
    R(c, 0, i * 12, SW, 12, mixc(th.top, th.bot));
  }
  if (th.motif === 'hex') {
    c.save();
    c.globalAlpha = 0.16;
    c.strokeStyle = th.acc2;
    c.lineWidth = 2;
    for (let y = -20, row = 0; y < 220; y += 34, row++) {
      for (let x = (row % 2) * 30 - 20; x < SW + 40; x += 60) {
        const on = ((x + y + Math.floor(t / 6) * 30) % 240) < 60;
        c.globalAlpha = on ? 0.32 : 0.12;
        hexPath(c, x, y, 26, 18);
        c.stroke();
      }
    }
    c.restore();
  } else if (th.motif === 'led') {
    for (let x = 6; x < SW; x += 16) for (let y = 34; y < 186; y += 16) {
      const on = (((x >> 4) + (y >> 4) + Math.floor(t / 8)) % 7) === 0;
      R(c, x, y, 4, 4, on ? th.acc2 : 'rgba(255,255,255,0.06)');
    }
  } else if (th.motif === 'stars') {
    for (let i = 0; i < 70; i++) {
      const x = (i * 97 + 13) % SW, y = 30 + ((i * 53) % 170);
      const tw = (Math.floor(t / 10) + i) % 9 === 0;
      R(c, x, y, tw ? 2 : 1, tw ? 2 : 1, i % 5 ? '#c8d0ff' : '#ffffff');
    }
  } else {
    // a chalkboard
    R(c, 20, 36, SW - 40, 150, '#1f4a36');
    R(c, 20, 36, SW - 40, 3, '#6a4a2a');
    R(c, 20, 183, SW - 40, 4, '#6a4a2a');
    c.save(); c.globalAlpha = 0.07;
    for (let i = 0; i < 30; i++) R(c, 30 + ((i * 131) % (SW - 80)), 44 + ((i * 37) % 130), 40, 1, '#ffffff');
    c.restore();
  }
}
// The program logo (our own lettering; titles only): a hexagon badge, a round plate, or a sign.
function drawLogo(c, x, y, title, th, motif) {
  const s = fitLine(c, title, 196, 14);
  const w = Math.min(212, measure(c, s, 14) + 26);
  if (motif === 'hex') {
    c.save();
    c.fillStyle = '#0a0a2a'; hexPath(c, x + 13, y + 13, 13, 12); c.fill();
    c.strokeStyle = th.acc; c.lineWidth = 2; hexPath(c, x + 13, y + 13, 11, 10); c.stroke();
    c.restore();
    T(c, '?', x + 13, y + 5, 14, th.acc, 'center', { outline: '#000' });
    plate(c, x + 24, y + 3, w, 22, '#0a0a2a', th.acc, 3);
    T(c, s, x + 24 + w / 2, y + 7, 14, '#ffffff', 'center', { outline: '#1a0a4a' });
    return;
  }
  plate(c, x, y + 3, w, 22, '#0a0a2a', th.acc, 4);
  T(c, s, x + w / 2, y + 7, 14, th.acc, 'center', { outline: '#000' });
}

// ======================================================================== the 4択 / 2択 asker
// item: { q, choices, answer, src }; o: { time (frames; 0 = no clock), intro, area, two, label }
const ASK = { qx: 16, qy: 196, qw: 608, qh: 54 };
function cellRects(n) {
  if (n <= 2) return [0, 1].slice(0, n).map((i) => ({ x: 16 + i * 308, y: 258, w: 300, h: 86 }));
  return [0, 1, 2, 3].slice(0, n).map((i) => ({ x: 16 + (i % 2) * 308, y: 256 + (i >> 1) * 50, w: 300, h: 44 }));
}
class Ask {
  constructor(mg, item, o = {}) {
    this.mg = mg; this.item = item; this.o = o;
    this.n = item.choices.length;
    this.sel = o.sel ?? 0;
    this.limit = o.time || 0;
    this.left = this.limit;
    this.intro = o.intro ?? 16;
    this.elim = new Set(o.elim || []);
    this.st = 0;
    this.res = null;
    this.cells = cellRects(this.n);
    if (this.elim.has(this.sel)) this.sel = this.firstFree();
  }
  firstFree() { for (let i = 0; i < this.n; i++) if (!this.elim.has(i)) return i; return 0; }
  hit(p) { return this.cells.findIndex((r) => inRect(p, r)); }
  update(inp, tap) {
    this.st++;
    if (this.res || this.st < this.intro) return;
    let act = false;
    if (tap) {
      const i = this.hit(tap);
      if (i >= 0 && !this.elim.has(i)) { this.sel = i; act = true; }
    } else {
      for (const d of ['up', 'down', 'left', 'right']) if (inp.pressed(d)) this.move(d);
      if (inp.pressed('a')) act = true;
    }
    if (act && !this.elim.has(this.sel)) { this.lock(this.sel); return; }
    if (this.limit) {
      this.left--;
      if (this.left > 0 && this.left <= 180 && this.left % 60 === 0) tones(this.left <= 60 ? SND.tick2 : SND.tick);
      if (this.left <= 0) { this.left = 0; this.res = { ok: false, pick: -1, timeout: true, frac: 0 }; }
    }
  }
  move(d) {
    const n = this.n;
    let t = this.sel;
    if (n <= 2) { if (d === 'left') t = 0; else if (d === 'right') t = 1; else return; }
    else {
      let col = t % 2, row = t >> 1;
      if (d === 'left' || d === 'right') col = 1 - col; else row = 1 - row;
      t = Math.min(n - 1, row * 2 + col);
    }
    if (this.elim.has(t)) {
      const rest = [...Array(n).keys()].filter((i) => !this.elim.has(i) && i !== this.sel);
      if (!rest.length) return;
      t = rest[0];
    }
    if (t !== this.sel) { this.sel = t; audio.sfx('cursor'); }
  }
  lock(i) {
    this.res = { ok: i === this.item.answer, pick: i, timeout: false, frac: this.limit ? this.left / this.limit : 1 };
    audio.sfx('ok');
  }
  // draw: reveal = show the answer (green) and the wrong pick (red)
  draw(c, th, o = {}) {
    if (!o.noQ) this.drawQ(c, th, o);
    // the choices
    this.drawCells(c, th, o);
  }
  drawQ(c, th, o) {
    const it = this.item;
    const qy = ASK.qy;
    plate(c, ASK.qx, qy, ASK.qw, ASK.qh, th.panel, o.edge || th.edge, 4);
    if (this.o.label) { plate(c, ASK.qx + 8, qy - 12, Math.min(260, measure(c, this.o.label, 12) + 16), 20, th.acc, null, 3); T(c, fitLine(c, this.o.label, 244, 12), ASK.qx + 16, qy - 8, 12, '#1a1020', 'left', { shadow: null }); }
    // the question, typed in
    const budget = this.st < this.intro ? Math.floor(this.st * 4) : 9999;
    let size = 16;
    let lines = wrap(c, it.q, ASK.qw - 28, size);
    if (lines.length > 2) { size = 14; lines = wrap(c, it.q, ASK.qw - 28, size); }
    if (lines.length > 2) { size = 12; lines = wrap(c, it.q, ASK.qw - 28, size).slice(0, 3); }
    const lh = size + 4;
    let left = budget;
    const y0 = qy + Math.round((ASK.qh - lines.length * lh) / 2) + 1;
    lines.forEach((l, i) => {
      if (left <= 0) return;
      const ch = Array.from(l);
      T(c, ch.slice(0, left).join(''), ASK.qx + 14, y0 + i * lh, size, '#ffffff');
      left -= ch.length;
    });
    // the clock
    if (this.limit && !o.hideClock) {
      const frac = this.res ? (this.res.frac || 0) : this.left / this.limit;
      const bx = ASK.qx + ASK.qw - 132, by = qy - 10;
      R(c, bx, by, 124, 10, '#000'); R(c, bx + 1, by + 1, 122, 8, '#262c5a');
      const col = frac > 0.5 ? '#5ee07a' : frac > 0.25 ? '#ffd23f' : '#ff5d6c';
      R(c, bx + 1, by + 1, Math.round(122 * clamp(frac, 0, 1)), 8, col);
    }
  }
  drawCells(c, th, o) {
    const it = this.item;
    const appear = clamp((this.st - this.intro * 0.6) / 8, 0, 1);
    const blink = Math.floor(this.mg.t / 8) % 2 === 0;
    this.cells.forEach((r, i) => {
      if (appear <= 0) { plate(c, r.x, r.y, r.w, r.h, 'rgba(10,12,40,0.7)', null, 4); return; }
      let bg = '#17204d', edge = '#6f7fc0', ink = '#ffffff', badge = LABEL_COLORS[i];
      const locked = this.res && this.res.pick === i;
      if (!o.reveal && !this.res && i === this.sel && this.st >= this.intro) { bg = '#2d3f94'; edge = blink ? '#ffd23f' : '#fff3b0'; }
      if (!o.reveal && locked) { bg = '#6a5a10'; edge = '#ffd23f'; }
      if (this.elim.has(i)) { bg = '#191b26'; edge = '#3a3f5a'; ink = '#5a5f78'; badge = '#3a3f5a'; }
      if (o.reveal) {
        if (i === it.answer) { bg = blink ? '#1f8a45' : '#23a04f'; edge = '#9cffb8'; }
        else if (locked) { bg = '#8a2433'; edge = '#ff5d6c'; }
        else { bg = '#14183a'; edge = '#3a4270'; ink = '#8890b8'; }
      }
      const off = Math.round((1 - appear) * (i % 2 ? 40 : -40));
      plate(c, r.x + off, r.y, r.w, r.h, bg, edge, 5);
      const bx = r.x + off + 8, by = r.y + Math.round((r.h - 22) / 2);
      plate(c, bx, by, 24, 22, badge, null, 3);
      T(c, this.n <= 2 ? (i ? '右' : '左') : LABELS[i], bx + 12, by + 4, 14, '#ffffff', 'center');
      const s = String(it.choices[i]);
      const maxW = r.w - 48;
      let z = fitSize(c, s, maxW, this.n <= 2 ? [22, 18, 16, 14] : [18, 16, 14, 12]);
      if (measure(c, s, z) > maxW) {
        const ls = wrap(c, s, maxW, 12).slice(0, 2);
        ls.forEach((l, k) => T(c, l, r.x + off + 40, r.y + Math.round(r.h / 2) - 13 + k * 14, 12, ink));
      } else T(c, s, r.x + off + 40, r.y + Math.round((r.h - z) / 2), z, ink);
      if (o.reveal && i === it.answer) T(c, '○', r.x + off + r.w - 10, r.y + 4, 14, '#ffffff', 'right');
      else if (o.reveal && locked) T(c, '×', r.x + off + r.w - 10, r.y + 4, 14, '#ffffff', 'right');
    });
  }
}

// ======================================================================== the minigame
class QuizStudio extends Minigame {
  static title = 'クイズ番組';
  static howto = ['問題に答えよう！', '十字キーで選んで Aで答える（タップでもOK）'];
  static skill = 'talk';
  static bgm = 'qs_think';
  static hd = true;

  constructor(g, opts = {}) {
    super(g, opts);
    this.quizTap = true;
    this.tapAt = null;
    const d = gameYM(g);
    this.year = Number.isFinite(opts.year) ? opts.year : d.y;
    this.month = Number.isFinite(opts.month) ? opts.month : d.m;
    this.showId = opts.showId || showOf(opts.show) || null;
    const S = this.showId ? SHOWS[this.showId] : null;
    this.stageIds = Array.isArray(opts.stages) && opts.stages.length ? opts.stages.filter((s) => STAGES[s]) : this.showId ? showStages(this.showId, this.year, this.month).filter((s) => STAGES[s]) : ['paper'];
    if (!this.stageIds.length) this.stageIds = ['paper'];
    this.cats = (Array.isArray(opts.cats) && opts.cats.length ? opts.cats : S ? S.cats : null) || Object.keys(CATS);
    this.showTitle = opts.show || (S ? S.title : 'クイズ特訓');
    if (!opts.title) this.title = opts.practice ? `${this.showTitle}（練習）` : this.showTitle;
    this.theme = THEMES[opts.theme] || THEMES[this.showId] || THEMES.practice;
    this.practice = !!opts.practice;
    this.opts = { ...opts, howto: opts.howto || this.stageIds.map((s) => STAGES[s].howto).flat().slice(0, 5) };
    // 雑学・知識 (quiz_app.js): easier and a few more points
    let kb = null;
    try { if (typeof g.quizBonus === 'function') kb = g.quizBonus(this.showId || this.stageIds[0]); } catch (e) { console.error(e); }
    this.knowPts = kb ? Math.max(0, Math.round(kb.pts || 0)) : 0;
    if (kb && kb.v > 0.005) {
      this.bonus += kb.v;
      const parts = [...((this.bonusInfo && this.bonusInfo.parts) || []), { label: '雑学', v: kb.v }];
      this.bonusInfo = { skill: (this.bonusInfo && this.bonusInfo.skill) || 0, parts };
    }
    bindTap(g);
  }

  init() {
    this.rng = Math.random;
    this.lv = this.difficulty <= 1 ? 1 : this.difficulty >= 4 ? 3 : 2;
    this.parts = [];
    this.results = [];
    this.ctx = {};
    this.stageIdx = 0;
    this.flashT = 0;
    this.say = null;
    this.answered = 0;
    this.correctN = 0;
    this.roster = shuffled(RIVALS, this.rng);
    audio.bgm(this.theme.bgm);
    this.startStage();
  }
  startStage() {
    const id = this.stageIds[this.stageIdx];
    this.stage = new STAGES[id](this);
    this.stage.id = id;
    tones(SND.jingle);
  }
  // after a stage: the next one (a stage may skip the ones after it: ctx.skipRest)
  nextStage() {
    const s = this.stage;
    this.results.push({ id: s.id, score: clamp(s.score || 0, 0, 100), weight: s.weight ?? 1, note: s.note || '' });
    this.stageIdx++;
    while (this.stageIdx < this.stageIds.length && this.ctx.skip && this.ctx.skip.includes(this.stageIds[this.stageIdx])) this.stageIdx++;
    if (this.stageIdx < this.stageIds.length) { this.startStage(); return; }
    this.finish();
  }
  finish() {
    const w = this.results.reduce((a, r) => a + r.weight, 0) || 1;
    const sc = this.results.reduce((a, r) => a + r.score * r.weight, 0) / w;
    const notes = this.results.map((r) => r.note).filter(Boolean);
    this.end(sc, notes.slice(-1)[0] || '');
  }
  end(score, comment) {
    if (this.phase === 'result') return;
    const b = this.knowPts || 0;
    const s = clamp(Math.round(score) + b, 0, 100);
    const line = comment || RANK_LINES[rankFor(s)];
    super.end(s, b ? `${line}\n（雑学ボーナス +${b}点）` : line);
    if (this.result) this.result.quiz = { show: this.showId, stages: this.stageIds.slice(), answered: this.answered | 0, correct: this.correctN | 0, practice: this.practice };
  }
  // every answer goes to the 雑学 record (quiz_app.js)
  record(src, ok) {
    this.answered = (this.answered | 0) + 1;
    if (ok) this.correctN = (this.correctN | 0) + 1;
    try { if (src && typeof this.g.quizRecord === 'function') this.g.quizRecord(src, !!ok, { practice: this.practice, show: this.showId }); } catch (e) { console.error(e); }
  }
  // seconds → frames, eased by the bonus (k: how much the bonus helps)
  frames(sec, k = 0.25) { return Math.max(60, Math.round(this.ease(sec, k) * 60)); }
  diffK() { return [1.35, 1.15, 1, 0.9, 0.8][this.difficulty - 1]; }
  confetti(x = SW / 2, y = 120, n = 60) {
    const cols = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff', '#ff7eb6', '#ffffff'];
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (this.rng() - 0.5) * 80, y, vx: (this.rng() - 0.5) * 7, vy: -2 - this.rng() * 5, c: cols[i % cols.length], life: 60 + Math.floor(this.rng() * 50) });
  }
  speak(str, frames = 70, who = null) { this.say = { str, t: frames, who }; }

  updatePlay(inp) {
    const tap = this.tapAt;
    this.tapAt = null;
    if (!this.stage) return;
    if (this.say && --this.say.t <= 0) this.say = null;
    if (this.flashT > 0) this.flashT--;
    for (const p of this.parts) { p.x += p.vx; p.y += p.vy; p.vy = Math.min(p.vy + 0.15, 3); p.vx *= 0.98; p.life--; }
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < SH + 10);
    this.stage.update(inp, tap);
    if (this.stage.done && this.phase === 'play') this.nextStage();
  }

  drawPlay(c) {
    const th = this.theme;
    drawBg(c, th, this.t);
    if (!this.stage) { this.drawHeader(c, ''); return; }
    try { this.stage.draw(c, th); } catch (e) { console.error(e); }
    this.drawHeader(c, this.stage.label || STAGES[this.stage.id].label);
    if (this.say) this.drawSay(c);
    for (const [i, p] of this.parts.entries()) { const f = (p.life + i) % 8 < 4; R(c, p.x, p.y, f ? 5 : 3, f ? 3 : 5, p.c); }
    if (this.flashT > 0) { c.save(); c.globalAlpha = (this.flashT / 10) * 0.3; R(c, 0, 0, SW, SH, '#ffffff'); c.restore(); }
  }
  drawHeader(c, label) {
    const th = this.theme;
    R(c, 0, 0, SW, 30, 'rgba(0,0,0,0.55)');
    R(c, 0, 30, SW, 2, th.acc);
    drawLogo(c, 6, 1, this.showTitle, th, th.motif);
    if (label) T(c, fitLine(c, this.practice ? `${label}（練習）` : label, 210, 14), 404, 8, 14, th.acc2, 'center', { outline: '#000' });
    const right = this.stage && this.stage.right ? this.stage.right() : '';
    if (right) T(c, fitLine(c, right, 120, 14), SW - 10, 8, 14, '#ffffff', 'right', { outline: '#000' });
  }
  drawSay(c) {
    const s = this.say.str;
    const z = 16;
    const at = (this.stage && this.stage.sayAt && this.stage.sayAt()) || {};
    const w = Math.min(at.w || 560, measure(c, s, z) + 28);
    const cx = at.cx || SW / 2;
    const x = Math.round(cx - w / 2), y = at.y || 40;
    plate(c, x, y, w, 30, '#ffffff', '#1a1020', 5);
    T(c, fitLine(c, s, w - 20, z), cx, y + 7, z, '#1a1020', 'center', { shadow: null });
  }
  // a big ○ / ×
  mark(c, ok, x, y, s = 1) {
    c.save();
    c.lineCap = 'round';
    if (ok) {
      c.strokeStyle = '#ffffff'; c.lineWidth = 16 * s; c.beginPath(); c.arc(x, y, 34 * s, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#ff3b4f'; c.lineWidth = 10 * s; c.beginPath(); c.arc(x, y, 34 * s, 0, Math.PI * 2); c.stroke();
    } else {
      for (const [col, lw] of [['#ffffff', 16], ['#2f6fe0', 10]]) {
        c.strokeStyle = col; c.lineWidth = lw * s; c.beginPath();
        c.moveTo(x - 28 * s, y - 28 * s); c.lineTo(x + 28 * s, y + 28 * s); c.moveTo(x + 28 * s, y - 28 * s); c.lineTo(x - 28 * s, y + 28 * s); c.stroke();
      }
    }
    c.restore();
  }
  me() { const st = this.g.state || {}; return { id: 'me', name: st.name || 'あなた', short: Array.from(String(st.name || 'あなた')).slice(0, 5).join(''), look: st.look || LOOKS.player, me: true, str: 0.5, fav: [], weak: [] }; }
  nameplate(c, who, x, y, w = 96, col = '#0b0d1a', ink = '#ffe27a') {
    plate(c, x - w / 2, y, w, 20, col, who.me ? '#ffd23f' : '#3a3f6a', 3);
    T(c, fitLine(c, who.me ? `★${who.short}` : who.short, w - 8, 12), x, y + 4, 12, who.me ? '#ffd23f' : ink, 'center', { shadow: null });
  }
}

// ======================================================================== stage: ペーパーテスト
class PaperStage {
  static label = 'ペーパーテスト';
  static howto = ['ペーパーテスト：制限時間内に10問！', 'Bでとばして次へ。最後に順位発表'];
  constructor(mg) {
    this.mg = mg;
    const n = clamp(Math.round(mg.opts.paperN || 10), 4, 15);
    this.n = n;
    const qs = pick({ cats: mg.cats, n, year: mg.year, lv: mg.lv, rng: mg.rng });
    this.items = qs.map((x) => asChoices(x, mg.rng));
    this.ans = new Array(this.items.length).fill(-1);
    this.n = this.items.length;
    this.i = 0;
    this.total = Math.round(mg.frames(5.4 * mg.diffK() * this.n, 0.25));
    this.left = this.total;
    this.phase = 'test';
    this.t = 0;
    this.ask = this.newAsk();
    this.weight = 1;
    mg.speak('ペーパーテスト、はじめ！', 60);
  }
  newAsk() { return new Ask(this.mg, this.items[this.i], { intro: 8, label: `第${this.i + 1}問／${this.n}` }); }
  sayAt() { return this.phase === 'test' ? { y: 54, cx: 476, w: 284 } : { y: 36 }; }
  right() {
    if (this.phase !== 'test') return '';
    const s = Math.ceil(this.left / 60);
    return `のこり ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    if (this.phase === 'test') {
      this.left--;
      if (this.left > 0 && this.left <= 600 && this.left % 60 === 0) tones(this.left <= 180 ? SND.tick2 : SND.tick);
      if (inp.pressed('b') && this.ask.st >= this.ask.intro) { audio.sfx('cancel'); this.advance(); return; }
      this.ask.update(inp, tap);
      if (this.ask.res) { this.ans[this.i] = this.ask.res.pick; tones(SND.pen); this.advance(); return; }
      if (this.left <= 0) { tones(SND.buzz); this.timeUp = true; this.toGrade(); }
    } else if (this.phase === 'grade') {
      if (this.t === 20) tones(SND.drum);
      const k = Math.floor((this.t - 50) / 9);
      if (this.t >= 50 && (this.t - 50) % 9 === 0 && k < this.n) tones(this.items[k] && this.ans[k] === this.items[k].answer ? SND.pen : SND.tick);
      if ((this.t > 60 + this.n * 9 && (inp.pressed('a') || tap)) || this.t > 150 + this.n * 9) this.toRank();
    } else if (this.phase === 'rank') {
      const shown = Math.floor(this.t / 12);
      if (this.t % 12 === 0 && shown <= this.order.length) audio.sfx('cursor');
      if (shown === this.order.length && this.t % 12 === 0) {
        const r = this.myRank;
        if (r <= 3) { tones(SND.fanfare); mg.confetti(); } else if (r >= this.order.length - 2) tones(SND.bubuu); else audio.sfx('applause');
      }
      if ((this.t > this.order.length * 12 + 40 && (inp.pressed('a') || tap)) || this.t > this.order.length * 12 + 260) this.done = true;
    }
  }
  advance() {
    this.i++;
    if (this.i >= this.n) { this.toGrade(); return; }
    this.ask = this.newAsk();
  }
  toGrade() {
    if (this.phase !== 'test') return;
    const mg = this.mg;
    this.phase = 'grade';
    this.t = 0;
    this.correct = 0;
    this.items.forEach((it, k) => {
      const ok = this.ans[k] === it.answer;
      if (ok) this.correct++;
      if (this.ans[k] >= 0 || k < this.i) mg.record(it.src, ok);
    });
    // everyone's paper (the rivals answer by their strength)
    const roster = mg.roster.slice(0, 17);
    const scores = roster.map((r) => ({ who: r, score: this.items.reduce((a, it) => a + (mg.rng() < rivalP(r, it.src.cat, it.src.lv, mg.difficulty) ? 1 : 0), 0), tie: mg.rng() }));
    scores.push({ who: mg.me(), score: this.correct, tie: mg.rng() });
    scores.sort((a, b) => b.score - a.score || b.tie - a.tie);
    this.order = scores;
    this.myRank = scores.findIndex((s) => s.who.me) + 1;
    mg.ctx.paper = { order: scores, myRank: this.myRank, n: this.n, correct: this.correct };
    const r = this.myRank;
    this.score = (this.correct / this.n) * 80 + (r <= 3 ? 20 : r <= 9 ? 10 : 0);
    this.note = `ペーパーテスト ${this.correct}/${this.n}問・${r}位`;
  }
  toRank() { this.phase = 'rank'; this.t = 0; this.mg.speak('では、順位を発表します。まずは最下位から…', 90); }
  draw(c, th) {
    const mg = this.mg;
    if (this.phase === 'test') {
      // the answer sheet on the left, the MC on the right
      plate(c, 16, 40, 300, 146, '#f6f1e2', '#8a7a5a', 4);
      T(c, '解答用紙', 28, 46, 14, '#3a2a1a', 'left', { shadow: null });
      T(c, fitLine(c, `氏名 ${mg.me().short}`, 140, 12), 304, 48, 12, '#3a2a1a', 'right', { shadow: null });
      R(c, 26, 64, 280, 1, '#c8b890');
      for (let k = 0; k < this.n; k++) {
        const col = k < 8 ? 0 : 1;
        const x = 28 + Math.floor(k / 5) * 92, y = 70 + (k % 5) * 22;
        const cur = k === this.i;
        if (cur) R(c, x - 3, y - 2, 88, 20, '#fff1a8');
        T(c, `${k + 1}.`, x, y, 12, '#3a2a1a', 'left', { shadow: null });
        const a = this.ans[k];
        T(c, a >= 0 ? LABELS[a] : k < this.i ? '—' : '', x + 30, y, 14, '#1a3aa8', 'left', { shadow: null });
        void col;
      }
      person(c, MC.look, 440, 150, 2, 'left');
      plate(c, 470, 152, 150, 20, '#0b0d1a', '#3a3f6a', 3);
      T(c, '司会', 545, 156, 12, '#ffe27a', 'center', { shadow: null });
      const frac = this.left / this.total;
      R(c, 330, 40, 290, 10, '#000');
      R(c, 331, 41, Math.round(288 * clamp(frac, 0, 1)), 8, frac > 0.3 ? '#5ee07a' : '#ff5d6c');
      this.ask.draw(c, th);
      T(c, 'B:とばす', SW - 18, ASK.qy - 26, 12, '#c8d0ff', 'right');
      return;
    }
    if (this.phase === 'grade') {
      plate(c, 120, 40, 400, 300, '#f6f1e2', '#8a7a5a', 5);
      T(c, this.timeUp && this.t < 70 ? 'そこまで！ペンを置いてください' : '採点', SW / 2, 50, 18, this.timeUp && this.t < 70 ? '#c8303c' : '#3a2a1a', 'center', { shadow: null });
      const shown = Math.floor((this.t - 50) / 9);
      for (let k = 0; k < this.n; k++) {
        const x = 150 + (k % 5) * 70, y = 92 + Math.floor(k / 5) * 96;
        const it = this.items[k];
        T(c, `${k + 1}`, x + 22, y - 14, 12, '#3a2a1a', 'center', { shadow: null });
        R(c, x, y, 44, 44, '#ffffff'); R(c, x, y, 44, 1, '#c8b890'); R(c, x, y + 43, 44, 1, '#c8b890');
        T(c, this.ans[k] >= 0 ? LABELS[this.ans[k]] : '—', x + 22, y + 13, 16, '#1a3aa8', 'center', { shadow: null });
        if (k <= shown && this.t >= 50) {
          const ok = this.ans[k] === it.answer;
          c.save(); c.globalAlpha = 0.85; mg.mark(c, ok, x + 22, y + 22, 0.55); c.restore();
        }
      }
      if (shown >= this.n) {
        T(c, `${this.n}問中 ${this.correct}問正解`, SW / 2, 290, 22, '#c8303c', 'center', { shadow: null });
        if (Math.floor(this.t / 20) % 2 === 0) T(c, 'Aで順位発表へ', SW / 2, 318, 12, '#6a5a3a', 'center', { shadow: null });
      }
      return;
    }
    // the ranking, revealed from the bottom
    const N = this.order.length;
    const shown = Math.floor(this.t / 12);
    if (!mg.say) T(c, 'ペーパーテスト 順位発表', SW / 2, 40, 18, th.acc, 'center', { outline: '#000' });
    for (let i = 0; i < N; i++) {
      const rank = i + 1;
      const revealIdx = N - rank; // the bottom first
      const col = i < 9 ? 0 : 1;
      const x = 24 + col * 304, y = 66 + (i % 9) * 30;
      const e = this.order[i];
      const vis = revealIdx < shown;
      plate(c, x, y, 288, 26, e.who.me && vis ? '#5a4a10' : 'rgba(10,10,30,0.8)', e.who.me && vis ? '#ffd23f' : '#3a3f6a', 3);
      T(c, `${rank}位`, x + 10, y + 6, 14, rank <= 3 ? '#ffd23f' : rank >= N - 2 ? '#ff8a9a' : '#ffffff');
      if (vis) {
        T(c, fitLine(c, e.who.me ? `${e.who.name}（あなた）` : e.who.name, 150, 14), x + 56, y + 6, 14, e.who.me ? '#ffd23f' : '#ffffff');
        T(c, `${e.score}点`, x + 276, y + 6, 14, '#9cf0ff', 'right');
      } else T(c, '？？？', x + 56, y + 6, 14, '#5a5f88');
    }
    if (shown >= N) {
      const r = this.myRank;
      const line = r === 1 ? 'まさかの1位！' : r <= 3 ? `${r}位！上位入り！` : r >= N - 2 ? `${r}位…おバカ枠に…` : `${r}位でした`;
      plate(c, 160, 334, 320, 24, '#1a1020', th.acc, 4);
      T(c, line, SW / 2, 338, 14, '#ffffff', 'center');
    }
  }
}

// ======================================================================== stage: 1対1 早押し (タイマン / リーグ)
const TEAM_DEFS = [{ name: 'Aチーム', col: '#e8434f' }, { name: 'Bチーム', col: '#3a7be0' }, { name: 'Cチーム', col: '#e0a81c' }];
class TaimanStage {
  static label = 'ご指名！1対1早押し';
  static howto = ['1対1の早押し：相手より先に正解しよう', '負けると居残り。次の相手を指名する'];
  constructor(mg, mode = 'taiman') {
    this.mg = mg;
    this.mode = mode;
    this.label = mode === 'league' ? '1対1 リーグ戦' : 'ご指名！1対1早押し';
    this.t = 0;
    this.bouts = [];
    this.weight = mode === 'league' ? 1 : 1.5;
    this.myWins = 0; this.myLoss = 0; this.myPlayed = 0;
    const me = mg.me();
    if (mode === 'league') {
      this.opps = mg.roster.slice(0, 4);
      this.oi = 0;
      this.phase = 'table';
      this.max = this.opps.length;
      mg.speak('1対1のリーグ戦！4人と順番に対決だ！', 80);
      return;
    }
    // the paper ranking (or an estimate from the 雑学 level) → 3 teams of 6, points 6…1
    let order = mg.ctx.paper && mg.ctx.paper.order ? mg.ctx.paper.order.map((e) => e.who) : null;
    if (!order) {
      const others = mg.roster.slice(0, 17).sort((a, b) => b.str - a.str);
      const lvl = typeof mg.g.quizLevel === 'function' ? mg.g.quizLevel() : 0;
      const pos = clamp(Math.round(14 - lvl * 1.2 + (mg.rng() - 0.5) * 4), 0, 17);
      order = [...others.slice(0, pos), me, ...others.slice(pos)];
    }
    this.paperRank = new Map(order.map((w, i) => [w.id, i + 1]));
    this.teams = TEAM_DEFS.map((d) => ({ ...d, members: [], pts: 0 }));
    order.forEach((w, i) => { const r = Math.floor(i / 3), k = i % 3; this.teams[r % 2 ? 2 - k : k].members.push(w); });
    for (const tm of this.teams) { tm.members.forEach((w, i) => { w.pts = 6 - i; }); tm.pts = tm.members.reduce((a, w) => a + w.pts, 0); }
    this.teamOf = new Map();
    this.teams.forEach((tm, i) => tm.members.forEach((w) => this.teamOf.set(w.id, i)));
    this.max = 6;
    this.nominator = order[order.length - 1]; // the last of the paper test calls first
    this.phase = 'teams';
    mg.speak('ペーパーテストの成績で、チーム分けです！', 80);
  }
  right() { return this.mode === 'league' ? `${this.myWins}勝${this.myLoss}敗` : `第${Math.min(this.bouts.length + 1, this.max)}戦／${this.max}`; }
  sayAt() { return this.phase === 'bout' ? { y: 104, w: 220 } : this.phase === 'boutEnd' ? { y: 36 } : this.phase === 'called' || this.phase === 'quick' ? { y: 300 } : this.phase === 'pick' ? { y: 40 } : { y: 36 }; }
  others(w) { const ti = this.teamOf.get(w.id); return this.teams.filter((_, i) => i !== ti).flatMap((tm) => tm.members); }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    const go = (this.t > 40 && (inp.pressed('a') || tap)) || this.t > 240;
    switch (this.phase) {
      case 'teams': if (go) this.nominate(); break;
      case 'table': if (go) this.startBout(mg.me(), this.opps[this.oi]); break;
      case 'pick': this.updatePick(inp, tap); break;
      case 'called': if (this.t > 70) this.startBout(this.nominator, this.target); break;
      case 'quick': if ((this.t > 30 && (inp.pressed('a') || tap)) || this.t > 110) this.afterBout(); break;
      case 'bout': this.updateBout(inp, tap); break;
      case 'boutEnd': if ((this.t > 40 && (inp.pressed('a') || tap)) || this.t > 120) this.afterBout(); break;
      case 'final': if ((this.t > 60 && (inp.pressed('a') || tap)) || this.t > 260) this.done = true; break;
    }
  }
  nominate() {
    const mg = this.mg;
    if (this.bouts.length >= this.max) { this.toFinal(); return; }
    const cands = this.others(this.nominator);
    if (this.nominator.me) {
      this.phase = 'pick'; this.t = 0; this.cands = cands; this.sel = 0;
      mg.speak('あなたが指名する番です。だれと対決する？', 90);
      return;
    }
    // a rival names the guest more often than not, else someone it thinks it can beat
    const me = cands.find((w) => w.me);
    let target;
    if (me && (mg.rng() < 0.65 || (!this.myPlayed && this.bouts.length >= 2))) target = me;
    else target = cands.slice().sort((a, b) => (a.str - b.str) + (mg.rng() - 0.5) * 0.5)[0];
    this.target = target;
    this.phase = 'called'; this.t = 0;
    tones(SND.drum);
    mg.speak(`${this.nominator.short}さんが指名したのは…${target.me ? 'あなた！' : target.short + 'さん！'}`, 80);
  }
  updatePick(inp, tap) {
    const n = this.cands.length;
    const cols = 3;
    if (tap) {
      const i = this.pickRects().findIndex((r) => inRect(tap, r));
      if (i >= 0) { this.sel = i; this.choose(); }
      return;
    }
    if (inp.pressed('left')) { this.sel = (this.sel + n - 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('right')) { this.sel = (this.sel + 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('up')) { this.sel = (this.sel - cols + n) % n; audio.sfx('cursor'); }
    if (inp.pressed('down')) { this.sel = (this.sel + cols) % n; audio.sfx('cursor'); }
    if (inp.pressed('a') || this.t > 60 * 20) this.choose();
  }
  choose() { audio.sfx('ok'); this.target = this.cands[this.sel]; this.startBout(this.nominator, this.target); }
  pickRects() { return this.cands.map((_, i) => ({ x: 24 + (i % 3) * 200, y: 120 + Math.floor(i / 3) * 52, w: 192, h: 46 })); }
  startBout(a, b) {
    const mg = this.mg;
    this.a = a; this.b = b; this.qn = 0;
    mg.say = null; // the nomination line is over
    if (!a.me && !b.me) {
      // rivals: decided at once (by strength), shown as a short card
      const pa = rivalP(a, 'joshiki', 2, mg.difficulty), pb = rivalP(b, 'joshiki', 2, mg.difficulty);
      const aWins = mg.rng() < pa / (pa + pb);
      this.res = { winner: aWins ? a : b, loser: aWins ? b : a };
      this.phase = 'quick'; this.t = 0;
      audio.sfx('buzz');
      return;
    }
    this.phase = 'bout'; this.t = 0;
    this.newQuestion();
  }
  opp() { return this.a.me ? this.b : this.a; }
  newQuestion() {
    const mg = this.mg;
    const x = pick({ cats: mg.cats, n: 1, year: mg.year, lv: mg.lv, rng: mg.rng })[0];
    this.item = asChoices(x, mg.rng);
    const o = this.opp();
    const sec = (1.7 + (1 - o.str) * 3.4 + (x.lv - 2) * 0.6) * mg.diffK() * (1 + Math.max(0, mg.bonus) * 0.35);
    this.buzzAt = 16 + Math.round(sec * 60);
    this.ask = new Ask(mg, this.item, { time: mg.frames(8, 0.2), intro: 16, label: `${this.a.me ? 'あなた' : this.a.short} vs ${this.b.me ? 'あなた' : this.b.short}` });
    this.oppTried = false; this.meTried = false; this.boutSub = 'q'; this.subT = 0; this.flag = null;
  }
  updateBout(inp, tap) {
    const mg = this.mg;
    const o = this.opp();
    this.subT++;
    if (this.boutSub === 'q') {
      this.ask.update(inp, tap);
      if (this.ask.res && !this.ask.res.timeout) {
        this.meTried = true;
        mg.record(this.item.src, this.ask.res.ok);
        if (this.ask.res.ok) { this.endBout(true, 'ok'); return; }
        tones(SND.bubuu); this.flag = { who: 'me', ok: false };
        if (!this.oppTried) { this.boutSub = 'oppAfter'; this.subT = 0; return; }
        this.nextOrDraw(); return;
      }
      if (!this.oppTried && this.ask.st >= this.buzzAt) {
        this.oppTried = true;
        tones(SND.buzz);
        const p = rivalP(o, this.item.src.cat, this.item.src.lv, mg.difficulty);
        const ok = mg.rng() < p;
        this.flag = { who: 'opp', ok };
        if (ok) { this.oppPick = this.item.answer; this.endBout(false, 'opp'); return; }
        // おてつき: their wrong choice is crossed out, and the player may answer
        const wrong = [...Array(this.item.choices.length).keys()].filter((i) => i !== this.item.answer && !this.ask.elim.has(i));
        const wp = wrong[Math.floor(mg.rng() * wrong.length)];
        mg.speak(`${o.short}さん、おてつき！「${this.item.choices[wp]}」ではない！`, 70);
        tones(SND.bubuu);
        if (this.meTried) { this.nextOrDraw(); return; }
        this.ask.elim.add(wp);
        if (this.ask.sel === wp) this.ask.sel = this.ask.firstFree();
        this.ask.left = Math.max(this.ask.left, mg.frames(4, 0.2));
        this.ask.limit = Math.max(this.ask.limit, this.ask.left);
      }
      if (this.ask.res && this.ask.res.timeout) { mg.record(this.item.src, false); this.nextOrDraw(); }
    } else if (this.boutSub === 'oppAfter') {
      if (this.subT === 40) {
        const p = Math.min(0.97, rivalP(o, this.item.src.cat, this.item.src.lv, mg.difficulty) + 0.12);
        const ok = mg.rng() < p;
        tones(SND.buzz);
        if (ok) { this.endBout(false, 'opp'); return; }
        mg.speak(`${o.short}さんも不正解！`, 60);
        this.nextOrDraw();
      }
    } else if (this.boutSub === 'reveal') {
      if (this.subT > 70) {
        this.qn++;
        if (this.qn >= 3) { this.res = { draw: true }; this.phase = 'boutEnd'; this.t = 0; mg.speak('3問続けて決着つかず…引き分け！', 80); return; }
        this.newQuestion();
      }
    }
  }
  nextOrDraw() { this.boutSub = 'reveal'; this.subT = 0; }
  endBout(meWon, how) {
    const mg = this.mg;
    const me = this.a.me ? this.a : this.b;
    const o = this.opp();
    this.res = meWon ? { winner: me, loser: o } : { winner: o, loser: me };
    this.phase = 'boutEnd'; this.t = 0;
    if (meWon) { tones(SND.pinpon); mg.flashT = 10; mg.confetti(SW / 2, 160, 40); mg.speak('正解！あなたの勝ち！', 80); }
    else { tones(how === 'opp' ? SND.pinpon : SND.bubuu); mg.speak(`${o.short}さんが正解！あなたの負け…`, 80); }
  }
  afterBout() {
    const mg = this.mg;
    const r = this.res || {};
    const mine = this.a.me || this.b.me;
    this.bouts.push({ a: this.a, b: this.b, winner: r.winner || null, draw: !!r.draw, mine });
    if (mine && !r.draw) { this.myPlayed++; if (r.winner && r.winner.me) this.myWins++; else this.myLoss++; }
    if (mine && r.draw) this.myPlayed++;
    if (this.mode === 'league') {
      this.oi++;
      if (this.oi >= this.opps.length) { this.toFinal(); return; }
      this.phase = 'table'; this.t = 0; this.res = null;
      return;
    }
    if (r.loser) {
      const ti = this.teamOf.get(r.loser.id);
      if (ti != null) this.teams[ti].pts = Math.max(0, this.teams[ti].pts - (r.loser.pts || 1));
      this.nominator = r.loser; // the loser stays and names the next one
    }
    this.res = null;
    this.nominate();
  }
  toFinal() {
    const mg = this.mg;
    this.phase = 'final'; this.t = 0;
    if (this.mode === 'league') {
      this.score = (this.myWins / Math.max(1, this.opps.length)) * 100;
      this.note = `リーグ戦 ${this.myWins}勝${this.myLoss}敗`;
      if (this.myWins >= 3) { tones(SND.fanfare); mg.confetti(); }
      return;
    }
    const ranked = this.teams.map((tm, i) => ({ tm, i })).sort((a, b) => b.tm.pts - a.tm.pts);
    this.ranked = ranked;
    const myTeam = this.teamOf.get('me');
    const place = ranked.findIndex((x) => x.i === myTeam) + 1;
    this.place = place;
    const ratio = this.myPlayed ? this.myWins / this.myPlayed : 0.5;
    this.score = 10 + ratio * 60 + (place === 1 ? 30 : place === 2 ? 15 : 0);
    this.note = `タイマン ${this.myWins}勝${this.myLoss}敗・チーム${place}位`;
    if (place === 1) { tones(SND.fanfare); mg.confetti(); mg.speak(`${this.teams[myTeam].name}の優勝！`, 120); } else mg.speak(`優勝は${ranked[0].tm.name}！`, 120);
  }
  draw(c, th) {
    const mg = this.mg;
    if (this.phase === 'teams' || this.phase === 'final' && this.mode !== 'league') { this.drawTeams(c, th); return; }
    if (this.phase === 'table' || (this.phase === 'final' && this.mode === 'league')) { this.drawTable(c, th); return; }
    if (this.phase === 'pick') {
      T(c, 'だれを指名する？', SW / 2, 88, 18, th.acc, 'center', { outline: '#000' });
      this.pickRects().forEach((r, i) => {
        const w = this.cands[i];
        const sel = i === this.sel;
        const tm = this.teams[this.teamOf.get(w.id)];
        plate(c, r.x, r.y, r.w, r.h, sel ? '#2d3f94' : 'rgba(10,12,40,0.85)', sel ? '#ffd23f' : tm.col, 4);
        person(c, w.look, r.x + 22, r.y + 44, 0.9, 'down');
        T(c, fitLine(c, w.name, 140, 14), r.x + 44, r.y + 6, 14, '#ffffff');
        T(c, fitLine(c, `${tm.name}・${w.kind}・テスト${this.paperRank.get(w.id)}位・${w.pts}点`, 144, 12), r.x + 44, r.y + 26, 12, '#c8d0ff');
      });
      return;
    }
    if (this.phase === 'called' || this.phase === 'quick') {
      this.drawVs(c, th, this.phase === 'quick');
      if (this.phase === 'quick' && this.t > 20) {
        const r = this.res;
        plate(c, 170, 250, 300, 40, '#1a1020', th.acc, 5);
        T(c, fitLine(c, `勝者 ${r.winner.short}さん`, 280, 18), SW / 2, 260, 18, '#ffd23f', 'center');
      }
      return;
    }
    // the bout: two podiums, lamps, the question
    this.drawPodiums(c, th);
    if (this.phase === 'bout') this.ask.draw(c, th, { reveal: this.boutSub === 'reveal' });
    if (this.phase === 'boutEnd') {
      if (this.ask) this.ask.draw(c, th, { reveal: true, hideClock: true });
      const r = this.res;
      if (r && !r.draw && this.t < 60) mg.mark(c, r.winner.me, SW / 2, 120, 0.9);
      if (this.t > 30 && Math.floor(this.t / 20) % 2 === 0) T(c, 'Aで次へ', SW - 18, ASK.qy - 26, 12, '#c8d0ff', 'right');
    }
  }
  drawVs(c, th, quick) {
    const a = this.a || this.nominator, b = this.b || this.target;
    if (!a || !b) return;
    plate(c, 60, 70, 200, 160, 'rgba(10,12,40,0.85)', '#e8434f', 6);
    plate(c, 380, 70, 200, 160, 'rgba(10,12,40,0.85)', '#3a7be0', 6);
    person(c, a.look, 160, 200, 2.4, 'down');
    person(c, b.look, 480, 200, 2.4, 'down');
    T(c, fitLine(c, a.me ? `${a.short}（あなた）` : a.name, 190, 16), 160, 76, 16, '#ffffff', 'center');
    T(c, fitLine(c, b.me ? `${b.short}（あなた）` : b.name, 190, 16), 480, 76, 16, '#ffffff', 'center');
    const k = 1 + Math.max(0, 1 - this.t / 12) * 0.8;
    c.save(); c.translate(SW / 2, 150); c.scale(k, k); T(c, 'VS', 0, -16, 32, '#ffd23f', 'center', { outline: '#5a1a00' }); c.restore();
    if (!quick) T(c, '指名！', SW / 2, 100, 16, th.acc2, 'center', { outline: '#000' });
  }
  drawPodiums(c, th) {
    const me = this.a.me ? this.a : this.b, o = this.opp();
    const lit = (who) => {
      if (!this.flag) return null;
      if (this.flag.who === 'opp' && who === o) return '#ffd23f';
      if (this.flag.who === 'me' && who === me) return '#ffd23f';
      return null;
    };
    [[me, 170], [o, 470]].forEach(([w, x]) => {
      person(c, w.look, x, 156, 2, 'down');
      plate(c, x - 70, 150, 140, 36, '#2a3560', '#9aa3c7', 4);
      const L = lit(w);
      R(c, x - 12, 140, 24, 10, L || '#6a1820');
      if (L) { c.save(); c.globalAlpha = 0.3; R(c, x - 20, 132, 40, 18, L); c.restore(); }
      T(c, fitLine(c, w.me ? `${w.short}（あなた）` : w.name, 128, 14), x, 160, 14, w.me ? '#ffd23f' : '#ffffff', 'center');
    });
    T(c, `第${this.qn + 1}問`, SW / 2, 80, 16, th.acc, 'center', { outline: '#000' });
    // the rival's hand hovering over the buzzer: how close they are to pressing
    if (this.phase === 'bout' && this.boutSub === 'q' && !this.oppTried && this.ask) {
      const frac = clamp(this.ask.st / this.buzzAt, 0, 1);
      R(c, 532, 92, 96, 8, '#000'); R(c, 533, 93, Math.round(94 * frac), 6, frac > 0.75 ? '#ff5d6c' : '#ffb34a');
      T(c, '相手の手', 580, 76, 12, '#ffd0a0', 'center');
    }
  }
  drawTeams(c, th) {
    const final = this.phase === 'final';
    if (!this.mg.say) T(c, final ? '結果発表' : 'チーム分け', SW / 2, 40, 18, th.acc, 'center', { outline: '#000' });
    const order = final ? this.ranked.map((x) => x.i) : [0, 1, 2];
    order.forEach((ti, k) => {
      const tm = this.teams[ti];
      const x = 16 + k * 206;
      plate(c, x, 64, 198, 284, 'rgba(10,12,40,0.88)', tm.col, 5);
      T(c, `${final ? `${k + 1}位 ` : ''}${tm.name}`, x + 12, 72, 16, tm.col);
      T(c, `${tm.pts}点`, x + 186, 72, 16, '#ffffff', 'right');
      tm.members.forEach((w, i) => {
        const y = 98 + i * 40;
        person(c, w.look, x + 22, y + 38, 0.85, 'down');
        T(c, fitLine(c, w.me ? `${w.short}（あなた）` : w.name, 120, 14), x + 42, y + 6, 14, w.me ? '#ffd23f' : '#ffffff');
        T(c, fitLine(c, `テスト${this.paperRank.get(w.id)}位`, 90, 12), x + 42, y + 23, 12, '#9aa3c7');
        T(c, `${w.pts}点`, x + 186, y + 12, 14, '#9cf0ff', 'right');
      });
    });
    if (!final && Math.floor(this.t / 20) % 2 === 0) T(c, 'Aで対決スタート', SW / 2, 350 - 14, 12, '#c8d0ff', 'center');
  }
  drawTable(c, th) {
    const final = this.phase === 'final';
    if (!this.mg.say) T(c, final ? `リーグ戦の結果 ${this.myWins}勝${this.myLoss}敗` : '対戦表', SW / 2, 44, 18, th.acc, 'center', { outline: '#000' });
    this.opps.forEach((o, i) => {
      const x = 40 + i * 144, y = 80;
      const b = this.bouts.find((bt) => bt.a === o || bt.b === o);
      plate(c, x, y, 132, 200, i === this.oi && !final ? '#2d3f94' : 'rgba(10,12,40,0.85)', i === this.oi && !final ? '#ffd23f' : '#3a3f6a', 5);
      person(c, o.look, x + 66, y + 120, 2, 'down');
      T(c, fitLine(c, o.name, 120, 14), x + 66, y + 8, 14, '#ffffff', 'center');
      T(c, fitLine(c, o.kind, 120, 12), x + 66, y + 28, 12, '#9aa3c7', 'center');
      if (b) {
        const res = b.draw ? '△' : b.winner && b.winner.me ? '○' : '●';
        T(c, res, x + 66, y + 150, 32, res === '○' ? '#ff5d6c' : res === '△' ? '#ffd23f' : '#9aa3c7', 'center', { outline: '#000' });
      } else T(c, i === this.oi ? '次の相手' : '', x + 66, y + 160, 14, '#ffd23f', 'center');
    });
    if (Math.floor(this.t / 20) % 2 === 0) T(c, final ? 'Aで次へ' : 'Aで対決！', SW / 2, 300, 14, '#c8d0ff', 'center');
  }
}
class LeagueStage extends TaimanStage {
  static label = '1対1 リーグ戦';
  static howto = ['1対1 リーグ戦：4人と早押しで対決', '相手より先に正解すれば勝ち'];
  constructor(mg) { super(mg, 'league'); }
}

// ======================================================================== stage: クイズ!ヘキサゴン (6人の心理戦)
// the six seats (feet positions) around a flat hexagon between the header and the question
const HEX_SEATS = [{ x: 180, y: 80 }, { x: 460, y: 80 }, { x: 572, y: 128 }, { x: 460, y: 176 }, { x: 180, y: 176 }, { x: 68, y: 128 }];
class Hexa6Stage {
  static label = '六角形の心理戦';
  static howto = ['6人が順番に出題者になる', '出題者のときは、間違えそうな人を見抜こう', '解答者のときは、正解して見抜きをかわそう'];
  constructor(mg) {
    this.mg = mg;
    this.weight = 1;
    this.seats = [mg.me(), ...mg.roster.slice(0, 5)].map((w) => ({ ...w, p: 0 }));
    this.seats = shuffled(this.seats, mg.rng);
    this.round = 0;
    this.rounds = 6;
    this.correct = 0; this.hits = 0;
    this.startRound();
  }
  right() { return `第${Math.min(this.round + 1, this.rounds)}問／${this.rounds}`; }
  seatPos(i) { return HEX_SEATS[i]; }
  sayAt() { return this.phase === 'final' ? { y: 330, w: 400 } : { y: 82, w: 250 }; }
  startRound() {
    const mg = this.mg;
    this.asker = this.seats[this.round];
    const x = pick({ cats: mg.cats, n: 1, year: mg.year, lv: mg.lv, rng: mg.rng })[0];
    this.item = asChoices(x, mg.rng);
    this.cat = x.cat;
    this.phase = 'intro'; this.t = 0;
    this.answers = new Map();
    this.named = null;
    mg.speak(this.asker.me ? 'あなたが出題者！間違えそうな人を見抜け！' : `出題者は${this.asker.short}さん`, 80);
  }
  pOf(w) { return w.me ? null : rivalP(w, this.cat, this.item.src.lv, this.mg.difficulty); }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    if (this.phase === 'intro') {
      if (this.t > 60) {
        if (this.asker.me) { this.phase = 'predict'; this.t = 0; this.sel = 0; this.limit = mg.frames(12, 0.2); }
        else {
          // the rival 出題者 names who will miss (the guest is an unknown: they guess)
          const ans = this.seats.filter((w) => w !== this.asker);
          const est = ans.map((w) => ({ w, p: w.me ? 0.6 + (typeof mg.g.quizLevel === 'function' ? mg.g.quizLevel() : 0) * 0.025 : this.pOf(w) + (mg.rng() - 0.5) * 0.2 }));
          est.sort((a, b) => a.p - b.p);
          this.named = est[0].p > 0.82 ? 'all' : est[0].w;
          this.phase = 'answer'; this.t = 0;
          this.ask = new Ask(mg, this.item, { time: mg.frames(9, 0.25), intro: 16, label: `出題者：${this.asker.short}` });
        }
      }
    } else if (this.phase === 'predict') {
      const opts = this.predOpts();
      if (tap) { const i = this.predRects().findIndex((r) => inRect(tap, r)); if (i >= 0) { this.sel = i; this.lockPred(opts); } return; }
      if (inp.pressed('left')) { this.sel = (this.sel + opts.length - 1) % opts.length; audio.sfx('cursor'); }
      if (inp.pressed('right')) { this.sel = (this.sel + 1) % opts.length; audio.sfx('cursor'); }
      if (inp.pressed('up') || inp.pressed('down')) { this.sel = (this.sel + 3) % opts.length; audio.sfx('cursor'); }
      if (inp.pressed('a') || this.t >= this.limit) this.lockPred(opts);
    } else if (this.phase === 'answer') {
      this.ask.update(inp, tap);
      if (this.ask.res) { this.resolve(); }
    } else if (this.phase === 'reveal') {
      const n = this.seats.length - 1;
      if (this.t % 14 === 0 && this.t / 14 <= n) audio.sfx('cursor');
      if (this.t === 14 * n + 20) this.verdict();
      if ((this.t > 14 * n + 50 && (inp.pressed('a') || tap)) || this.t > 14 * n + 150) {
        this.round++;
        if (this.round >= this.rounds) this.toFinal(); else this.startRound();
      }
    } else if (this.phase === 'final') {
      if ((this.t > 60 && (inp.pressed('a') || tap)) || this.t > 260) this.done = true;
    }
  }
  predOpts() { return [...this.seats.filter((w) => w !== this.asker), 'all']; }
  predRects() { return this.predOpts().map((_, i) => ({ x: 16 + (i % 3) * 206, y: 256 + Math.floor(i / 3) * 50, w: 198, h: 44 })); }
  lockPred(opts) { audio.sfx('ok'); this.named = opts[this.sel]; this.resolve(); }
  resolve() {
    const mg = this.mg;
    for (const w of this.seats) {
      if (w === this.asker) continue;
      let ok;
      if (w.me) { ok = !!(this.ask && this.ask.res && this.ask.res.ok); mg.record(this.item.src, ok); if (ok) this.correct++; }
      else ok = mg.rng() < this.pOf(w);
      this.answers.set(w.id, ok);
    }
    this.phase = 'reveal'; this.t = 0;
  }
  verdict() {
    const mg = this.mg;
    const ans = this.seats.filter((w) => w !== this.asker);
    const allOk = ans.every((w) => this.answers.get(w.id));
    const hit = this.named === 'all' ? allOk : this.named && !this.answers.get(this.named.id);
    for (const w of ans) {
      const ok = this.answers.get(w.id);
      w.p += ok ? 1 : -1;
      if (ok && this.named && this.named !== 'all' && this.named.id === w.id) w.p += 1; // read wrong: the named one gets a bonus
    }
    this.asker.p += hit ? 3 : -1;
    if (this.asker.me) {
      if (hit) { this.hits++; tones(SND.pinpon); mg.confetti(); mg.speak('見抜いた！+3ポイント', 80); } else { tones(SND.bubuu); mg.speak('見抜けなかった…-1', 80); }
    } else {
      const meOk = this.answers.get('me');
      const namedMe = this.named && this.named !== 'all' && this.named.me;
      if (namedMe && meOk) { tones(SND.pinpon); mg.speak('指名をかわした！+1', 80); }
      else if (namedMe) { tones(SND.bubuu); mg.speak('見抜かれた…！', 80); }
      else if (meOk) tones(SND.pinpon); else tones(SND.bubuu);
    }
  }
  toFinal() {
    const mg = this.mg;
    this.phase = 'final'; this.t = 0;
    const order = this.seats.slice().sort((a, b) => b.p - a.p);
    this.order = order;
    const rank = order.findIndex((w) => w.me) + 1;
    this.score = [100, 86, 72, 58, 44, 30][rank - 1] ?? 30;
    this.note = `心理戦 ${rank}位（正解${this.correct}・見抜き${this.hits}）`;
    if (rank === 1) { tones(SND.fanfare); mg.confetti(); mg.speak('あなたがトップ！', 100); } else mg.speak(`あなたは${rank}位`, 100);
  }
  draw(c, th) {
    const mg = this.mg;
    // the hexagonal set
    c.save();
    const P = HEX_SEATS.map((p) => [p.x, p.y - 22]);
    c.beginPath(); P.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.fillStyle = 'rgba(5,10,40,0.78)'; c.fill();
    c.strokeStyle = th.acc; c.lineWidth = 3; c.stroke();
    c.beginPath(); P.forEach(([x, y], i) => { const xx = 320 + (x - 320) * 0.72, yy = 106 + (y - 106) * 0.6; if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); }); c.closePath();
    c.strokeStyle = th.acc2; c.lineWidth = 1; c.stroke();
    c.restore();
    if (this.phase === 'final') {
      R(c, 0, 32, SW, SH - 32, 'rgba(0,0,0,0.45)');
      this.order.forEach((w, i) => {
        const y = 44 + i * 50;
        plate(c, 140, y, 360, 44, w.me ? '#5a4a10' : 'rgba(10,12,40,0.95)', w.me ? '#ffd23f' : '#3a3f6a', 4);
        person(c, w.look, 200, y + 42, 0.9, 'down');
        T(c, `${i + 1}位`, 154, y + 14, 14, i === 0 ? '#ffd23f' : '#ffffff');
        T(c, fitLine(c, w.me ? `${w.name}（あなた）` : w.name, 220, 16), 226, y + 13, 16, w.me ? '#ffd23f' : '#ffffff');
        T(c, `${w.p}P`, 488, y + 13, 16, '#9cf0ff', 'right');
      });
      return;
    }
    if (this.phase === 'intro') T(c, `第${this.round + 1}問`, SW / 2, 118, 24, th.acc, 'center', { outline: '#000' });
    const order = this.seats.filter((s) => s !== this.asker);
    this.seats.forEach((w, i) => {
      const { x, y } = this.seatPos(i);
      const isAsker = w === this.asker;
      const right = x < 320; // the plate is on the side toward the middle
      if (isAsker) { c.save(); c.globalAlpha = 0.22 + 0.1 * Math.sin(mg.t / 6); R(c, x - 22, y - 46, 44, 48, '#fff6a8'); c.restore(); }
      person(c, w.look, x, y + 2, 1, 'down');
      const px = right ? x + 18 : x - 118;
      plate(c, px, y - 34, 100, 34, isAsker ? '#5a4a10' : '#0b0d1a', w.me || isAsker ? '#ffd23f' : '#3a3f6a', 3);
      T(c, fitLine(c, w.me ? `★${w.short}` : w.short, 88, 12), px + 6, y - 31, 12, w.me ? '#ffd23f' : '#ffffff', 'left', { shadow: null });
      T(c, `${w.p}P${isAsker ? '・出題者' : ''}`, px + 6, y - 16, 12, '#9cf0ff', 'left', { shadow: null });
      if (this.phase === 'reveal' && !isAsker) {
        const k = order.indexOf(w);
        if (this.t >= (k + 1) * 14) {
          const ok = this.answers.get(w.id);
          T(c, ok ? '○' : '×', px + 86, y - 32, 24, ok ? '#ff5d6c' : '#5f9aff', 'center', { outline: '#fff' });
        }
        if (this.named && this.named !== 'all' && this.named.id === w.id) { plate(c, px + 44, y - 16, 34, 16, '#ffd23f', null, 2); T(c, '指名', px + 61, y - 15, 12, '#1a1020', 'center', { shadow: null }); }
      }
    });
    if (this.phase === 'predict') {
      const it = this.item;
      plate(c, ASK.qx, ASK.qy, ASK.qw, ASK.qh, th.panel, th.edge, 4);
      T(c, fitLine(c, it.q, ASK.qw - 24, 14), ASK.qx + 12, ASK.qy + 8, 14, '#ffffff');
      T(c, fitLine(c, `正解：${it.choices[it.answer]}　（ジャンル：${CATS[this.cat] ? CATS[this.cat].label : ''}）`, ASK.qw - 24, 14), ASK.qx + 12, ASK.qy + 30, 14, '#ffd23f');
      const opts = this.predOpts();
      const left = Math.ceil((this.limit - this.t) / 60);
      T(c, `間違えそうな人は？（のこり${Math.max(0, left)}秒）`, SW - 18, ASK.qy - 26, 12, '#c8d0ff', 'right');
      this.predRects().forEach((r, i) => {
        const o = opts[i];
        const sel = i === this.sel;
        plate(c, r.x, r.y, r.w, r.h, sel ? '#2d3f94' : '#17204d', sel ? '#ffd23f' : '#6f7fc0', 4);
        if (o === 'all') { T(c, '全員正解', r.x + r.w / 2, r.y + 13, 16, '#ffffff', 'center'); return; }
        T(c, fitLine(c, o.name, r.w - 16, 14), r.x + 10, r.y + 5, 14, '#ffffff');
        const tag = o.fav.includes(this.cat) ? '得意' : o.weak.includes(this.cat) ? '苦手' : '';
        T(c, fitLine(c, `${o.kind}${tag ? `・${CATS[this.cat].short}が${tag}` : ''}`, r.w - 16, 12), r.x + 10, r.y + 24, 12, tag === '苦手' ? '#ff9aa8' : tag === '得意' ? '#9cffb8' : '#9aa3c7');
      });
      return;
    }
    if (this.phase === 'answer' || (this.phase === 'reveal' && this.ask && !this.asker.me)) {
      this.ask.draw(c, th, { reveal: this.phase === 'reveal', hideClock: this.phase === 'reveal' });
      if (this.phase === 'reveal' && this.t > 30) {
        const nm = this.named === 'all' ? '「全員正解」' : this.named ? (this.named.me ? 'あなた' : `${this.named.short}さん`) : '';
        plate(c, 200, 112, 240, 26, '#1a1020', th.acc, 4);
        T(c, fitLine(c, `${this.asker.short}さんの指名：${nm}`, 224, 14), SW / 2, 117, 14, '#ffffff', 'center');
      }
    } else if (this.phase === 'reveal' && this.asker.me) {
      const it = this.item;
      plate(c, ASK.qx, ASK.qy, ASK.qw, 90, th.panel, th.edge, 4);
      T(c, fitLine(c, it.q, ASK.qw - 24, 14), ASK.qx + 12, ASK.qy + 10, 14, '#ffffff');
      T(c, fitLine(c, `正解：${it.choices[it.answer]}`, ASK.qw - 24, 16), ASK.qx + 12, ASK.qy + 34, 16, '#9cffb8');
      const nm = this.named === 'all' ? '「全員正解」' : `${this.named.short}さん`;
      T(c, fitLine(c, `あなたの指名：${nm}`, ASK.qw - 24, 16), ASK.qx + 12, ASK.qy + 60, 16, '#ffd23f');
    }
  }
}

// ======================================================================== stage: ファイブリーグ
class FiveStage {
  static label = 'ファイブリーグ';
  static howto = ['5人で1文字ずつ、5文字の答えを完成！', '自分の番が来たら、正しい1文字を選ぼう'];
  constructor(mg) {
    this.mg = mg;
    this.weight = 0.7;
    this.team = [mg.me(), ...mg.roster.slice(0, 4)];
    this.rivalsTeam = mg.roster.slice(4, 9);
    const pool = shuffled(FIVE.filter((f) => qOk(f, mg.year)), mg.rng);
    this.words = pool.slice(0, clamp(Math.round(mg.opts.fiveN || 5), 3, 8));
    this.k = 0;
    this.got = 0;
    this.oppGot = 0;
    this.results = [];
    this.startWord();
  }
  right() { return this.phase === 'versus' ? '' : `第${this.k + 1}問／${this.words.length}`; }
  sayAt() { return this.phase === 'versus' ? { y: 290 } : { y: 236, w: 420 }; }
  startWord() {
    const mg = this.mg;
    this.w = this.words[this.k];
    this.order = shuffled(this.team, mg.rng);
    this.myPos = this.order.findIndex((x) => x.me);
    this.letters = [null, null, null, null, null];
    this.j = 0;
    this.phase = 'clue'; this.t = 0;
    this.limit = mg.frames(16 * mg.diffK(), 0.3);
    this.left = this.limit;
    this.nextAt = 0;
    this.chooser = null;
    mg.speak(`第${this.k + 1}問！`, 50);
  }
  teamP() { return clamp(0.985 - (this.mg.difficulty - 1) * 0.015, 0.9, 0.985); }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    if (this.phase === 'clue') { if (this.t > 70) { this.phase = 'write'; this.t = 0; this.nextAt = 20 + Math.floor(mg.rng() * 30); } return; }
    if (this.phase === 'write') {
      this.left--;
      if (this.left > 0 && this.left <= 180 && this.left % 60 === 0) tones(SND.tick);
      if (this.j === this.myPos) {
        if (!this.chooser) {
          const ch = this.w.chars[this.j];
          const opts = shuffled([ch, ...fiveWrong(ch, mg.rng)], mg.rng);
          this.chooser = new Ask(mg, { q: '', choices: opts, answer: opts.indexOf(ch) }, { intro: 4 });
        }
        this.chooser.update(inp, tap);
        if (this.chooser.res && !this.chooser.res.timeout) {
          const p = this.chooser.res.pick;
          this.letters[this.j] = { ch: this.chooser.item.choices[p], ok: this.chooser.res.ok };
          tones(SND.pen);
          this.j++; this.chooser = null; this.nextAt = this.t + 20 + Math.floor(mg.rng() * 40);
        }
      } else if (this.t >= this.nextAt) {
        const ch = this.w.chars[this.j];
        const ok = mg.rng() < this.teamP();
        this.letters[this.j] = { ch: ok ? ch : fiveWrong(ch, mg.rng)[0], ok };
        tones(SND.pen);
        this.j++;
        this.nextAt = this.t + 26 + Math.floor(mg.rng() * 50);
      }
      if (this.j >= 5 || this.left <= 0) this.check();
      return;
    }
    if (this.phase === 'check') {
      if (this.t === 30) { if (this.ok) { tones(SND.pinpon); mg.flashT = 8; mg.confetti(SW / 2, 120, 40); } else tones(SND.bubuu); }
      if ((this.t > 60 && (inp.pressed('a') || tap)) || this.t > 140) {
        this.k++;
        if (this.k >= this.words.length) this.toVersus(); else this.startWord();
      }
      return;
    }
    if (this.phase === 'versus') {
      if ((this.t > 60 && (inp.pressed('a') || tap)) || this.t > 220) this.done = true;
    }
  }
  check() {
    const mg = this.mg;
    const timeout = this.j < 5;
    this.ok = !timeout && this.letters.every((l) => l && l.ok);
    if (this.ok) this.got++;
    // my letter is a question of its own (the word's category is カタカナ語)
    const mine = this.letters[this.myPos];
    if (mine && mine.ok) this.myOk = (this.myOk | 0) + 1;
    mg.record({ id: this.w.id, cat: 'katakana', q: this.w.clue, a: this.w.word, lv: 2 }, !!(mine && mine.ok));
    // the regular team plays the same word off screen
    if (mg.rng() < Math.pow(this.teamP(), 5) * 0.95) this.oppGot++;
    this.results.push({ word: this.w.word, ok: this.ok });
    this.phase = 'check'; this.t = 0; this.timeout = timeout;
  }
  toVersus() {
    const mg = this.mg;
    this.phase = 'versus'; this.t = 0;
    this.won = this.got > this.oppGot || (this.got === this.oppGot && mg.rng() < 0.5);
    mg.ctx.five = { won: this.won, got: this.got, n: this.words.length };
    // the player's own letters, the team's words, the win
    this.score = ((this.myOk | 0) / this.words.length) * 50 + (this.got / this.words.length) * 35 + (this.won ? 15 : 0);
    this.note = `ファイブリーグ ${this.got}/${this.words.length}問${this.won ? '・勝利' : ''}`;
    if (!this.won) { (mg.ctx.skip = mg.ctx.skip || []).push('trolley'); mg.speak('レギュラーチームの勝ち…ボーナスステージならず', 120); tones(SND.bubuu); }
    else { tones(SND.fanfare); mg.confetti(); mg.speak(mg.stageIds.includes('trolley') ? 'ゲストチームの勝利！ボーナスステージへ！' : 'ゲストチームの勝利！', 120); }
  }
  draw(c, th) {
    const mg = this.mg;
    if (this.phase === 'versus') {
      plate(c, 70, 70, 230, 200, 'rgba(10,12,40,0.9)', '#3ae0ff', 6);
      plate(c, 340, 70, 230, 200, 'rgba(10,12,40,0.9)', '#ff4f6a', 6);
      T(c, 'ゲストチーム', 185, 80, 16, '#3ae0ff', 'center');
      T(c, 'レギュラーチーム', 455, 80, 16, '#ff4f6a', 'center');
      T(c, `${this.got * 10}`, 185, 150, 48, '#ffffff', 'center', { outline: '#000' });
      T(c, `${this.oppGot * 10}`, 455, 150, 48, '#ffffff', 'center', { outline: '#000' });
      T(c, this.won ? '勝利！' : '敗北…', this.won ? 185 : 455, 220, 22, '#ffd23f', 'center', { outline: '#000' });
      return;
    }
    // the clue
    plate(c, 16, 40, 608, 46, th.panel, th.edge, 4);
    T(c, `第${this.k + 1}問`, 28, 46, 12, th.acc);
    T(c, fitLine(c, `${this.w.clue}（5文字）`, 580, 16), 28, 62, 16, '#ffffff');
    // the five monitors, the team under them
    for (let i = 0; i < 5; i++) {
      const x = 32 + i * 118;
      const who = this.order[i];
      const cur = this.phase === 'write' && i === this.j;
      plate(c, x + 6, 92, 88, 62, cur ? '#2a2a10' : '#0b0d1a', cur ? '#ffd23f' : who.me ? '#ffd23f' : '#3a3f6a', 5);
      T(c, `${i + 1}`, x + 12, 95, 12, '#7a80a8', 'left', { shadow: null });
      const L = this.letters[i];
      if (L) {
        const col = this.phase === 'check' ? (L.ok ? '#9cffb8' : '#ff8a9a') : '#ffffff';
        T(c, L.ch, x + 50, 102, 40, col, 'center', { outline: '#000' });
      } else if (cur) T(c, '…', x + 50, 110, 24, '#ffd23f', 'center');
      person(c, who.look, x + 50, 204, 1.15, 'down', cur ? Math.floor(mg.t / 10) % 2 : 0);
      mg.nameplate(c, who, x + 50, 206, 100);
    }
    // the clock
    if (this.phase === 'write') {
      const frac = this.left / this.limit;
      R(c, 22, 86, 596, 6, '#000');
      R(c, 23, 87, Math.round(594 * clamp(frac, 0, 1)), 4, frac > 0.3 ? '#3ae0ff' : '#ff5d6c');
    }
    if (this.phase === 'write' && this.chooser) {
      T(c, `あなたの番！${this.myPos + 1}文字目を選ぼう`, SW / 2, 232, 16, '#ffd23f', 'center', { outline: '#000' });
      this.chooser.draw(c, th, { hideClock: true, noQ: true });
      return;
    }
    if (this.phase === 'check' && this.t >= 30) {
      plate(c, 120, 240, 400, 100, 'rgba(10,12,40,0.92)', this.ok ? '#9cffb8' : '#ff8a9a', 6);
      mg.mark(c, this.ok, 180, 290, 0.6);
      T(c, '正解は', 240, 256, 14, '#c8d0ff');
      T(c, this.w.word, 240, 278, 32, '#ffffff', 'left', { outline: '#000' });
      if (this.timeout) T(c, '（時間切れ）', 500, 320, 12, '#ff8a9a', 'right');
    }
  }
}
// ======================================================================== stage: トロッコアドベンチャー
class TrolleyStage {
  static label = 'トロッコアドベンチャー';
  static howto = ['トロッコ：2択に答えて正しいレールへ！', '←→でレールを選ぶ（タップでもOK）。5問全問正解で賞品！'];
  constructor(mg) {
    this.mg = mg;
    this.weight = 0.3;
    this.qs = twoQuestions(mg.year, 5, mg.rng, mg.lv).map((x) => {
      const left = mg.rng() < 0.5;
      return { x, choices: left ? [x.a, x.b] : [x.b, x.a], answer: left ? 0 : 1 };
    });
    this.k = 0;
    this.okN = 0;
    this.riders = [mg.me(), ...mg.roster.slice(0, 4)];
    this.phase = 'ride'; this.t = 0;
    this.scroll = 0;
    audio.bgm('qs_trolley');
    mg.speak('5人乗りのトロッコ、出発！', 70);
  }
  right() { return `${this.k + (this.phase === 'goal' ? 0 : 1)}／5`; }
  startQ() {
    const mg = this.mg;
    const q = this.qs[this.k];
    this.item = { q: q.x.q, choices: q.choices, answer: q.answer, src: q.x };
    this.limit = mg.frames(6.5 * mg.diffK(), 0.3);
    this.left = this.limit;
    this.sel = -1;
    this.phase = 'q'; this.t = 0;
    const adv = this.riders[1 + (this.k % 4)];
    const p = clamp(0.62 + Math.max(0, mg.bonus) * 0.12, 0.5, 0.85);
    this.advice = { who: adv, side: mg.rng() < p ? q.answer : 1 - q.answer, at: 70 + Math.floor(mg.rng() * 60) };
  }
  sayAt() { return { y: 92, w: 420 }; }
  signRects() { return [{ x: 16, y: 270, w: 300, h: 80 }, { x: 324, y: 270, w: 300, h: 80 }]; }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    this.scroll += this.phase === 'crash' || this.phase === 'goal' ? 0 : this.phase === 'q' ? 2 : 6;
    if (this.phase === 'ride') { if (this.t > 50) this.startQ(); return; }
    if (this.phase === 'q') {
      this.left--;
      if (this.left > 0 && this.left <= 180 && this.left % 60 === 0) tones(SND.tick);
      if (this.t === this.advice.at) mg.speak(`${this.advice.who.short}「${this.advice.side ? '右' : '左'}だ！」`, 60);
      let lock = false;
      if (tap) { const i = this.signRects().findIndex((r) => inRect(tap, r)); if (i >= 0) { this.sel = i; lock = true; } }
      else {
        if (inp.pressed('left')) { this.sel = 0; audio.sfx('cursor'); }
        if (inp.pressed('right')) { this.sel = 1; audio.sfx('cursor'); }
        if (inp.pressed('a') && this.sel >= 0) lock = true;
      }
      if (lock || this.left <= 0) {
        this.pick = this.sel;
        this.ok = this.pick === this.item.answer;
        mg.record(this.item.src && this.item.src.cat ? this.item.src : { id: this.item.src.id, cat: 'joshiki', q: this.item.q, a: this.item.src.a, lv: 2 }, this.ok);
        this.phase = 'fork'; this.t = 0;
        audio.sfx('ok');
      }
      return;
    }
    if (this.phase === 'fork') {
      if (this.t === 40) {
        if (this.ok) { this.okN++; tones(SND.pinpon); mg.speak('正解！そのまま進め！', 50); }
        else { tones(SND.crash); mg.speak(this.pick < 0 ? '選べなかった…行き止まり！' : '行き止まり！脱線だ！', 90); }
      }
      if (this.t > 70) {
        if (!this.ok) { this.phase = 'crash'; this.t = 0; return; }
        this.k++;
        if (this.k >= 5) { this.phase = 'goal'; this.t = 0; tones(SND.fanfare); mg.confetti(); mg.confetti(SW / 2, 80, 40); mg.speak('5問全問正解！賞品ゲット！', 140); return; }
        this.phase = 'ride'; this.t = 0;
      }
      return;
    }
    if (this.phase === 'crash' || this.phase === 'goal') {
      if ((this.t > 70 && (inp.pressed('a') || tap)) || this.t > 200) {
        this.score = this.okN * 16 + (this.okN >= 5 ? 20 : 0);
        this.note = this.okN >= 5 ? 'トロッコ 全問正解！' : `トロッコ ${this.okN + 1}問目で脱線`;
        this.done = true;
      }
    }
  }
  draw(c, th) {
    const mg = this.mg;
    const hy = 120, by = 262;
    // sky and ground (a rocky canyon)
    R(c, 0, 32, SW, hy - 32, '#3a6ab0');
    for (let i = 0; i < 6; i++) R(c, ((i * 137 + this.scroll * 0.2) % (SW + 120)) - 60, 92 + (i % 3) * 8, 70, 6, 'rgba(255,255,255,0.55)');
    for (let i = 0; i < 9; i++) { const x = ((i * 83 - this.scroll * 0.4) % (SW + 80) + SW + 80) % (SW + 80) - 40; R(c, x, hy - 14 - (i % 3) * 6, 46, 14 + (i % 3) * 6, '#7a4a30'); }
    R(c, 0, hy, SW, by - hy, '#8a5a3a');
    for (let i = 0; i < 40; i++) { const y = hy + ((i * 29 + this.scroll * (1 + (i % 3))) % (by - hy)); R(c, (i * 61) % SW, y, 6 + (i % 4) * 3, 3, '#6a4228'); }
    // rails toward the horizon; at a question the fork comes closer
    const forkK = this.phase === 'q' ? clamp(1 - this.left / this.limit, 0, 1) : this.phase === 'fork' ? 1 : 0;
    c.save();
    c.strokeStyle = '#d8d0c0'; c.lineWidth = 3;
    const rail = (x0, x1, y1 = hy) => { c.beginPath(); c.moveTo(x0, by); c.lineTo(x1, y1); c.stroke(); };
    if (this.phase === 'q' || this.phase === 'fork') {
      const fy = hy + 12 + forkK * 90;
      const sx = 320, spread = 80 + forkK * 220;
      rail(270, sx - 8, fy); rail(370, sx + 8, fy);
      c.strokeStyle = '#efe6d0';
      for (const d of [-1, 1]) { c.beginPath(); c.moveTo(sx - 8, fy); c.lineTo(sx + d * spread - 14, hy); c.stroke(); c.beginPath(); c.moveTo(sx + 8, fy); c.lineTo(sx + d * spread + 14, hy); c.stroke(); }
      // a signpost at each branch
      for (const d of [0, 1]) {
        const x = sx + (d ? 1 : -1) * (spread * 0.55 + 30), y = hy + 8 + forkK * 34;
        const sel = this.sel === d;
        R(c, x - 2, y, 4, 22, '#4a3020');
        plate(c, x - 22, y - 16, 44, 18, sel ? '#ffd23f' : '#f2e8d0', '#4a3020', 3);
        T(c, d ? '右' : '左', x, y - 14, 12, '#3a2010', 'center', { shadow: null });
      }
    } else { rail(270, 316); rail(370, 324); }
    for (let i = 0; i < 8; i++) {
      const k = ((i / 8 + (this.scroll % 40) / 320) % 1);
      const y = hy + (by - hy) * k * k;
      const w = 20 + 110 * k * k;
      R(c, 320 - w / 2, y, w, 2 + k * 4, '#5a3a20');
    }
    c.restore();
    // the trolley with 5 riders
    let tx = 320, ty = 240, tilt = 0;
    if (this.phase === 'fork') { const d = this.pick === 1 ? 1 : this.pick === 0 ? -1 : 0; tx += d * Math.min(this.t, 40) * 3; ty -= Math.min(this.t, 40) * 0.9; }
    if (this.phase === 'crash') { const d = this.pick === 1 ? 1 : -1; tx += d * 120; ty -= 36; tilt = Math.min(1, this.t / 20) * 0.6 * d; }
    c.save(); c.translate(tx, ty); c.rotate(tilt);
    this.riders.forEach((w, i) => person(c, w.look, -64 + i * 32, -4 + (Math.floor((mg.t + i * 7) / 9) % 2), 0.9, 'up'));
    plate(c, -90, -12, 180, 36, '#4a4a52', '#2a2a30', 4);
    R(c, -84, -6, 168, 4, '#8a8a92');
    c.restore();
    if (this.phase === 'crash' && this.t > 10) { plate(c, 200, 134, 240, 50, '#5a0a10', '#ff5d6c', 6); T(c, '脱線！', SW / 2, 144, 28, '#ffffff', 'center', { outline: '#000' }); }
    if (this.phase === 'goal') { plate(c, 160, 128, 320, 60, '#5a4a10', '#ffd23f', 6); T(c, 'ゴール！賞品獲得！', SW / 2, 144, 26, '#ffffff', 'center', { outline: '#000' }); }
    // progress: 5 lamps
    for (let i = 0; i < 5; i++) { const on = i < this.okN; R(c, 520 + i * 22, 98, 16, 12, '#000'); R(c, 521 + i * 22, 99, 14, 10, on ? '#5ee07a' : i === this.k && this.phase !== 'crash' ? '#ffd23f' : '#3a3f5a'); }
    // the question on top, the two rails' answers at the bottom
    if (this.phase === 'q' || this.phase === 'fork') {
      plate(c, 16, 38, 608, 50, th.panel, th.edge, 4);
      T(c, `第${this.k + 1}問`, 28, 42, 12, th.acc);
      T(c, fitLine(c, this.item.q, 580, 16), 28, 60, 16, '#ffffff');
      const frac = this.phase === 'q' ? this.left / this.limit : 0;
      R(c, 496, 41, 120, 8, '#000'); R(c, 497, 42, Math.round(118 * frac), 6, frac > 0.3 ? '#5ee07a' : '#ff5d6c');
      this.signRects().forEach((r, i) => {
        const sel = this.sel === i;
        let bg = sel ? '#2d3f94' : '#17204d', edge = sel ? '#ffd23f' : '#6f7fc0';
        if (this.phase === 'fork' && this.t >= 40) { if (i === this.item.answer) { bg = '#1f8a45'; edge = '#9cffb8'; } else if (i === this.pick) { bg = '#8a2433'; edge = '#ff5d6c'; } }
        plate(c, r.x, r.y, r.w, r.h, bg, edge, 6);
        T(c, i ? '右のレール →' : '← 左のレール', r.x + (i ? r.w - 12 : 12), r.y + 6, 12, '#c8d0ff', i ? 'right' : 'left');
        const s = String(this.item.choices[i]);
        const z = fitSize(c, s, r.w - 24, [24, 20, 16, 14, 12]);
        T(c, fitLine(c, s, r.w - 24, z), r.x + r.w / 2, r.y + 24 + Math.round((48 - z) / 2), z, '#ffffff', 'center');
      });
    }
  }
}

// ======================================================================== stage: 略語の特訓（夜の電車）
class TanshukuStage {
  static label = '略語の特訓';
  static howto = ['略語の元の言葉を4つから選ぼう', '3回まちがえると途中下車！'];
  constructor(mg) {
    this.mg = mg;
    this.weight = 1;
    const pool = tanshukuPool(mg.year);
    this.items = shuffled(pool, mg.rng).slice(0, clamp(Math.round(mg.opts.count || 8), 4, 12)).map((x) => {
      const q = tanshukuQuestion(x, pool, mg.rng, mg.year);
      return { ...asChoices(q, mg.rng), s: x.s };
    });
    this.n = this.items.length;
    this.k = 0; this.okN = 0; this.miss = 0;
    this.trainX = 60;
    this.startQ();
  }
  right() { return `${this.okN}駅クリア・ミス${this.miss}`; }
  sayAt() { return { y: 160, w: 420 }; }
  startQ() {
    const mg = this.mg;
    this.item = this.items[this.k];
    this.ask = new Ask(mg, this.item, { time: mg.frames(7 * mg.diffK(), 0.3), intro: 14, label: `${this.k + 1}駅目` });
    this.phase = 'q'; this.t = 0;
  }
  update(inp, tap) {
    this.t++;
    const mg = this.mg;
    if (this.phase === 'q') {
      this.ask.update(inp, tap);
      if (this.ask.res) {
        const ok = this.ask.res.ok;
        mg.record({ id: this.item.src.id, cat: 'katakana', q: this.item.q, a: this.item.src.a, lv: 2, tanshuku: true }, ok);
        if (ok) { this.okN++; tones(SND.pinpon); } else { this.miss++; tones(SND.bubuu); }
        this.phase = 'reveal'; this.t = 0;
      }
    } else if (this.phase === 'reveal') {
      if ((this.t > 40 && (inp.pressed('a') || tap)) || this.t > 100) {
        this.k++;
        if (this.miss >= 3 || this.k >= this.n) { this.phase = 'end'; this.t = 0; if (this.miss >= 3) mg.speak('3回まちがえて途中下車…', 100); else { tones(SND.fanfare); mg.confetti(); mg.speak('終点まで到着！', 100); } }
        else this.startQ();
      }
    } else if (this.phase === 'end') {
      if ((this.t > 50 && (inp.pressed('a') || tap)) || this.t > 200) {
        this.score = (this.okN / this.n) * 100;
        this.note = `略語 ${this.okN}/${this.n}問正解`;
        this.done = true;
      }
    }
  }
  draw(c, th) {
    const mg = this.mg;
    // the night line: stations and a train
    R(c, 0, 150, SW, 4, '#5a5a7a');
    for (let i = 0; i < this.n; i++) {
      const x = 40 + i * (560 / Math.max(1, this.n - 1));
      R(c, x - 3, 140, 6, 14, i < this.k ? '#ffd23f' : '#8a8aa8');
    }
    const target = 40 + this.k * (560 / Math.max(1, this.n - 1));
    this.trainX += (target - this.trainX) * 0.08;
    const x = this.trainX;
    plate(c, x - 34, 120, 68, 26, '#2a2a40', '#9cf0ff', 4);
    R(c, x - 26, 126, 12, 8, '#fff6a8'); R(c, x - 8, 126, 12, 8, '#fff6a8'); R(c, x + 10, 126, 12, 8, '#fff6a8');
    R(c, x + 30, 132, 6, 6, '#ffd23f');
    // the station sign: the abbreviation
    if (this.item) {
      plate(c, 200, 50, 240, 60, '#f2f2f2', '#2a2a40', 5);
      R(c, 200, 50, 240, 10, '#2a7a4a');
      T(c, fitLine(c, this.item.s, 220, 28), SW / 2, 66, fitSize(c, this.item.s, 220, [28, 24, 20]), '#1a1a2a', 'center', { shadow: null });
    }
    if (this.ask && this.phase !== 'end') this.ask.draw(c, th, { reveal: this.phase === 'reveal' });
    if (this.phase === 'reveal') mg.mark(c, this.ask.res.ok, 560, 84, 0.6);
  }
}

export const STAGES = { paper: PaperStage, taiman: TaimanStage, league: LeagueStage, hexa6: Hexa6Stage, five: FiveStage, trolley: TrolleyStage, tanshuku: TanshukuStage };
export const STAGE_LABELS = Object.fromEntries(Object.entries(STAGES).map(([k, v]) => [k, v.label]));
for (const [k, v] of Object.entries(STAGES)) { v.id = k; }
registerMinigame('quizstudio', QuizStudio);
export { QuizStudio, Ask };
