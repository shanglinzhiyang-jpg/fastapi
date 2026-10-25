// 芸の実演 (owner C): PerformGame — the base of the stage minigames (manzai / conte / rakugo / pinneta; ogiri uses the
// intro, model, crowd, HUD and result card). It plays the act's real script line by line through the model in
// perform_model.js and gives the player the act's decisions as small tasks (QTE):
//   WindowTask  ツッコミのタイミング (A in the window after a ボケ)     HoldTask   ボケの間 / サゲ / 裏切り (hold A, release in the zone)
//   ArrowTask   飛んだセリフを思い出す / 上下を切る (press the arrow)    SettleTask 爆笑のあと、笑いが引きかけたところで A
//   AdlibTask   誰かが噛んだ・飛んだ → B でアドリブ / フォロー         ChoiceTask まくらの話題など (↑↓ + A)
//   BeatTask    仕草・歌ネタのリズム (A on the beats)                   RingTask   役に入る (A when the ring meets the circle)
// Holding → while you speak speeds the line up (saves 尺) but makes 噛み more likely and can make the act 走る.
// The intro card lets the player switch the ネタ (←→): the house script (おまかせ) or the player's own (B's ネタ帳).

import { Minigame, text, rect, COLORS } from './minigame.js';
import { rankFor } from './minigame.js';
import { audio } from './audio.js';
import { clamp, SW, SH, shade } from './util.js';
import { measure, wrap } from './draw.js';
import { buildCtx, Show, simulate, legacyNeta, netaQ, KIND_LABEL, PIN_STYLES, CROWD, SIZE } from './perform_model.js';
import * as S from './perform_stage.js';
import { ADLIB, kamiText, bankNeta } from './perform_bank.js';

const safe = (f, d = null) => { try { const v = f(); return v === undefined ? d : v; } catch (e) { console.error(e); return d; } };
export const GRADE_T = { perfect: 1.05, good: 0.86, late: 0.55, early: 0.32, miss: 0.14, stiff: 0.34, ok: 0.9 };
export const GRADE_LABEL = { perfect: 'PERFECT!', good: 'GOOD!', late: 'LATE…', early: '早い！', miss: 'スルー…', stiff: '間延び…' };
const GRADE_COL = { perfect: COLORS.accent, good: COLORS.good, late: COLORS.cyan, early: COLORS.bad, miss: COLORS.dim, stiff: COLORS.dim };
const PANEL = { x: 140, y: 288, w: 360, h: 48 };

// ------------------------------------------------------------------ tasks
export class Task {
  constructor(o = {}) { this.o = o; this.t = 0; this.result = null; this.label = o.label || ''; }
  start() {}
  update() { this.t++; return false; }
  draw(ctx) {}
  panel(ctx, w = PANEL.w, labelMax = w - 28) {
    const x = Math.round(SW / 2 - w / 2);
    S.drawPanel(ctx, x, PANEL.y, w, PANEL.h, { gold: true });
    if (this.label) {
      // fit the label: shrink to 11px, then cut with …
      let size = 14, str = this.label;
      while (measure(ctx, str, size) > labelMax && size > 11) size--;
      while (measure(ctx, str, size) > labelMax && Array.from(str).length > 2) str = Array.from(str).slice(0, -2).join('') + '…';
      text(ctx, str, x + 14, PANEL.y + 7, { size, color: '#ffe9a0', shadow: null });
    }
    return x;
  }
}
// A in a window that starts now. o: { win: [p, g, l], key, early (already pressed during the line) }
export class WindowTask extends Task {
  update(inp) {
    this.t++;
    if (this.o.early) { this.result = { grade: 'early', t: GRADE_T.early }; return true; }
    if (inp.pressed(this.o.key || 'a')) {
      const [p, g] = this.o.win;
      const grade = this.t <= p ? 'perfect' : this.t <= g ? 'good' : 'late';
      this.result = { grade, t: GRADE_T[grade], f: this.t };
      return true;
    }
    if (this.t > this.o.win[2]) { this.result = { grade: 'miss', t: GRADE_T.miss }; return true; }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx);
    const [p, g, l] = this.o.win;
    const bx = x + 110, bw = PANEL.w - 128, by = PANEL.y + 16, bh = 16;
    rect(ctx, bx, by, bw, bh, S.INK);
    const zone = (a, b, col) => { const x0 = bx + 2 + Math.round((a / l) * (bw - 4)); const x1 = bx + 2 + Math.round((b / l) * (bw - 4)); rect(ctx, x0, by + 2, Math.max(1, x1 - x0), bh - 4, col); rect(ctx, x0, by + 2, Math.max(1, x1 - x0), 2, shade(col, 0.4)); };
    zone(0, p, '#ffd23f'); zone(p, g, '#5ee07a'); zone(g, l, '#5fd7ff');
    const mx = bx + 2 + Math.round((clamp(this.t, 0, l) / l) * (bw - 8));
    rect(ctx, mx - 2, by - 4, 8, bh + 8, S.INK);
    rect(ctx, mx, by - 2, 4, bh + 4, '#ffffff');
    text(ctx, '間', x + 14, PANEL.y + 26, { size: 14, color: '#c8cce6', shadow: null });
  }
}
// Hold A to build the 間, release inside the zone. o: { fill (frames to 1.0), zone: [a, b], waitMax }
export class HoldTask extends Task {
  start() { this.g = 0; this.holding = false; this.done = false; }
  update(inp) {
    this.t++;
    const fill = this.o.fill || 60;
    if (!this.holding) {
      if (inp.down('a')) { this.holding = true; this.ht = 0; }
      else if (this.t > (this.o.waitMax || 110)) { this.result = { grade: 'stiff', t: GRADE_T.stiff, g: 0 }; return true; }
      return false;
    }
    this.ht++;
    this.g = this.ht / fill;
    const [a, b] = this.o.zone || [0.6, 0.85];
    if (!inp.down('a') || this.g >= 1.25) {
      const g = this.g;
      let grade;
      if (g < a) grade = 'early';
      else if (g > b) grade = g >= 1.25 ? 'stiff' : 'late';
      else grade = Math.abs(g - (a + b) / 2) <= (b - a) / 4 ? 'perfect' : 'good';
      this.result = { grade, t: GRADE_T[grade], g };
      return true;
    }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx);
    const bx = x + 110, bw = PANEL.w - 128, by = PANEL.y + 16, bh = 16;
    const [a, b] = this.o.zone || [0.6, 0.85];
    const sc = (v) => bx + 2 + Math.round((clamp(v, 0, 1.25) / 1.25) * (bw - 4));
    rect(ctx, bx, by, bw, bh, S.INK);
    rect(ctx, bx + 2, by + 2, bw - 4, bh - 4, '#2a2f55');
    rect(ctx, sc(a), by + 2, sc(b) - sc(a), bh - 4, '#5ee07a');
    rect(ctx, sc((a * 3 + b) / 4), by + 2, sc((a + b * 3) / 4) - sc((a * 3 + b) / 4), bh - 4, '#ffd23f');
    if (this.g > 0) { rect(ctx, bx + 2, by + bh - 6, sc(this.g) - bx - 2, 4, '#ff7eb6'); }
    const mx = sc(this.g || 0);
    rect(ctx, mx - 2, by - 4, 6, bh + 8, S.INK);
    rect(ctx, mx - 1, by - 2, 4, bh + 4, '#ffffff');
    text(ctx, this.holding ? 'ためて…' : 'A長押し', x + 14, PANEL.y + 26, { size: 14, color: this.holding ? '#ff9ac8' : '#c8cce6', shadow: null });
  }
}
// Press the shown arrow. o: { dirs (choices), answer, win, prompt }
export class ArrowTask extends Task {
  update(inp) {
    this.t++;
    for (const d of ['up', 'down', 'left', 'right']) {
      if (inp.pressed(d)) { this.result = { ok: d === this.o.answer, dir: d, f: this.t }; return true; }
    }
    if (this.t > (this.o.win || 60)) { this.result = { ok: false, dir: null, miss: true }; return true; }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx);
    const dirs = this.o.dirs || [this.o.answer];
    const lw = Math.ceil(measure(ctx, this.label, 14));
    let gx = Math.max(x + 120, x + 24 + lw);
    const row2 = gx + dirs.length * 30 + 120 > x + PANEL.w;
    if (row2) gx = x + 14;
    const gy = row2 ? PANEL.y + 24 : PANEL.y + 14;
    for (const d of dirs) {
      const show = this.o.reveal === false ? false : d === this.o.answer;
      S.glyph(ctx, d, gx, gy);
      if (show && Math.floor(this.t / 6) % 2 === 0) rect(ctx, gx - 2, gy + 21, 24, 2, '#ffd23f');
      gx += 30;
    }
    if (this.o.prompt) text(ctx, this.o.prompt, gx + 8, gy + 2, { size: 14, color: '#ffffff', shadow: null });
    const frac = 1 - this.t / (this.o.win || 60);
    rect(ctx, x + 14, PANEL.y + 44, Math.round((PANEL.w - 28) * clamp(frac, 0, 1)), 2, frac > 0.3 ? '#5ee07a' : '#ff5d6c');
  }
}
// B (or A) quickly. o: { key, win, prompt }
export class AdlibTask extends Task {
  update(inp) {
    this.t++;
    if (inp.pressed(this.o.key || 'b')) { this.result = { ok: true, f: this.t }; return true; }
    if (this.t > (this.o.win || 45)) { this.result = { ok: false }; return true; }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx);
    const lw = Math.ceil(measure(ctx, this.label, 14));
    const pw = Math.ceil(measure(ctx, this.o.prompt || 'でアドリブ！', 16));
    let gx = Math.max(x + 120, x + 24 + lw);
    const row2 = gx + 28 + pw > x + PANEL.w - 8;
    if (row2) gx = x + 14;
    const gy = row2 ? PANEL.y + 24 : PANEL.y + 14;
    S.glyph(ctx, (this.o.key || 'b').toUpperCase(), gx, gy);
    text(ctx, this.o.prompt || 'でアドリブ！', gx + 26, gy + 2, { size: 16, color: Math.floor(this.t / 5) % 2 ? '#ffffff' : '#ffd23f', shadow: null });
    const frac = 1 - this.t / (this.o.win || 45);
    rect(ctx, x + 14, PANEL.y + 44, Math.round((PANEL.w - 28) * clamp(frac, 0, 1)), 2, '#ff7eb6');
  }
}
// After a 爆笑: wait for the laugh to settle, then A. Too soon = 笑いに被せる, in the zone = ナイス間, too late = 間延び.
export class SettleTask extends Task {
  update(inp, mg) {
    this.t++;
    const w = mg.wave;
    mg.show.wait(1 / 60);
    if (inp.pressed('a') && this.t > 4) {
      const grade = w > 0.42 ? 'kabuse' : w >= 0.1 ? 'nice' : 'nobi';
      this.result = { grade };
      return true;
    }
    if (w < 0.1) { this.low = (this.low || 0) + 1; if (this.low > 40) { this.result = { grade: 'nobi', auto: true }; return true; } }
    return false;
  }
  draw(ctx, mg) {
    const x = this.panel(ctx);
    const bx = x + 110, bw = PANEL.w - 128, by = PANEL.y + 14, bh = 18;
    rect(ctx, bx, by, bw, bh, S.INK);
    rect(ctx, bx + 2, by + 2, bw - 4, bh - 4, '#2a2f55');
    const sc = (v) => bx + 2 + Math.round(clamp(v / 1.2, 0, 1) * (bw - 4));
    rect(ctx, sc(0.1), by + 2, sc(0.42) - sc(0.1), bh - 4, 'rgba(94,224,122,0.55)');
    const wv = sc(mg.wave);
    rect(ctx, bx + 2, by + 4, wv - bx - 2, bh - 8, mg.wave > 0.42 ? '#ff9a3c' : '#ffd23f');
    text(ctx, '笑い', x + 14, PANEL.y + 26, { size: 14, color: '#c8cce6', shadow: null });
    text(ctx, '引きかけたら A', bx + bw - 4, PANEL.y + 34, { size: 12, align: 'right', color: '#c8cce6', shadow: null });
  }
}
// ↑↓ + A. o: { title, options: [{ label, sub }], win }
export class ChoiceTask extends Task {
  start() { this.i = 0; }
  update(inp) {
    this.t++;
    const n = this.o.options.length;
    if (inp.pressed('up')) { this.i = (this.i + n - 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('down')) { this.i = (this.i + 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 8) { this.result = { i: this.i, f: this.t }; audio.sfx('ok'); return true; }
    if (this.o.win && this.t > this.o.win) { this.result = { i: this.i, timeout: true }; return true; }
    return false;
  }
  draw(ctx) {
    const n = this.o.options.length;
    const w = 380, h = 34 + n * 26;
    const x = Math.round(SW / 2 - w / 2), y = Math.round(178 - h / 2);
    S.drawPanel(ctx, x, y, w, h, { gold: true });
    text(ctx, this.o.title || '', x + 14, y + 8, { size: 14, color: '#ffe9a0', shadow: null });
    this.o.options.forEach((op, k) => {
      const yy = y + 30 + k * 26;
      if (k === this.i) { rect(ctx, x + 8, yy - 2, w - 16, 24, 'rgba(255,210,63,0.18)'); text(ctx, '▶', x + 14, yy + 2, { size: 14, color: COLORS.accent, shadow: null }); }
      text(ctx, op.label, x + 34, yy + 2, { size: 16, color: k === this.i ? '#ffffff' : '#c8cce6', shadow: null });
      if (op.sub) text(ctx, op.sub, x + w - 14, yy + 4, { size: 12, align: 'right', color: COLORS.dim, shadow: null });
    });
    if (this.o.win) { const f = 1 - this.t / this.o.win; rect(ctx, x + 10, y + h - 6, Math.round((w - 20) * clamp(f, 0, 1)), 2, f > 0.3 ? '#5ee07a' : '#ff5d6c'); }
  }
}
// Press A on each beat as the markers reach the line. o: { beats, interval, lead, win, sfx(k) }
export class BeatTask extends Task {
  start() { this.hits = []; this.k = 0; }
  update(inp) {
    this.t++;
    const iv = this.o.interval || 30, lead = this.o.lead || 40, n = this.o.beats || 3;
    const at = (k) => lead + k * iv;
    if (inp.pressed('a')) {
      let best = -1, bd = 1e9;
      for (let k = 0; k < n; k++) { if (this.hits[k] != null) continue; const d = Math.abs(this.t - at(k)); if (d < bd) { bd = d; best = k; } }
      if (best >= 0 && bd <= 14) { this.hits[best] = bd <= 5 ? 1 : bd <= 10 ? 0.75 : 0.45; if (this.o.sfx) this.o.sfx(best, this.hits[best]); }
    }
    for (let k = 0; k < n; k++) if (this.hits[k] == null && this.t > at(k) + 14) this.hits[k] = 0;
    if (this.t > at(n - 1) + 16) {
      const acc = this.hits.reduce((a, b) => a + (b || 0), 0) / n;
      const grade = acc >= 0.85 ? 'perfect' : acc >= 0.6 ? 'good' : acc >= 0.3 ? 'late' : 'miss';
      this.result = { acc, grade, t: GRADE_T[grade] };
      return true;
    }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx);
    const iv = this.o.interval || 30, lead = this.o.lead || 40, n = this.o.beats || 3;
    const hx = x + 140, by = PANEL.y + 16;
    rect(ctx, x + 100, by + 8, PANEL.w - 116, 2, '#5a6090');
    rect(ctx, hx - 1, by - 2, 3, 22, '#ffffff');
    for (let k = 0; k < n; k++) {
      const dt = lead + k * iv - this.t;
      const mx = hx + dt * 3;
      if (mx < x + 96 || mx > x + PANEL.w - 12) continue;
      const h = this.hits[k];
      const col = h == null ? '#ffd23f' : h >= 0.75 ? '#5ee07a' : h > 0 ? '#5fd7ff' : '#ff5d6c';
      S.fillEllipse(ctx, mx, by + 9, 7, 7, S.INK);
      S.fillEllipse(ctx, mx, by + 9, 5, 5, col);
    }
  }
}
// The ring closes in; A when it meets the circle. o: { win (frames to close) }
export class RingTask extends Task {
  update(inp) {
    this.t++;
    const win = this.o.win || 60;
    const r = this.radius();
    if (inp.pressed('a')) {
      const d = Math.abs(r - 12);
      const grade = d <= 3 ? 'perfect' : d <= 8 ? 'good' : r > 12 ? 'early' : 'late';
      this.result = { grade, t: GRADE_T[grade] };
      return true;
    }
    if (this.t > win + 14) { this.result = { grade: 'miss', t: GRADE_T.stiff }; return true; }
    return false;
  }
  radius() { const win = this.o.win || 60; return 12 + 40 * (1 - this.t / win); }
  draw(ctx) {
    const x = this.panel(ctx);
    const cx = x + PANEL.w - 60, cy = PANEL.y + 24;
    S.fillEllipse(ctx, cx, cy, 13, 13, S.INK);
    S.fillEllipse(ctx, cx, cy, 11, 11, '#ffd23f');
    const r = Math.max(2, Math.round(this.radius()));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(r, 22), 0, Math.PI * 2);
    ctx.stroke();
    text(ctx, this.o.prompt || 'Aで役に入る', x + 110, PANEL.y + 17, { size: 14, color: '#ffffff', shadow: null });
  }
}
// 暗転: the light goes out when you press A; the laugh then finishes in the dark.
export class BlackoutTask extends Task {
  update(inp, mg) {
    this.t++;
    if (inp.pressed('a') && this.t > 6) {
      const w = mg.wave;
      const peak = this.maxW || 0;
      let grade;
      if (peak < 0.2) grade = this.t < 45 ? 'good' : 'late'; // no laugh to ride: cut quickly
      else grade = w >= peak * 0.55 && w > 0.25 ? 'perfect' : w > 0.12 ? 'good' : this.t < 20 ? 'early' : 'late';
      this.result = { grade };
      return true;
    }
    this.maxW = Math.max(this.maxW || mg.wave, mg.wave);
    if (this.t > 150) { this.result = { grade: 'late', auto: true }; return true; }
    return false;
  }
  draw(ctx, mg) {
    const x = this.panel(ctx);
    S.glyph(ctx, 'A', x + 120, PANEL.y + 15);
    text(ctx, '暗転のタイミング！', x + 148, PANEL.y + 17, { size: 16, color: '#ffffff', shadow: null });
    rect(ctx, x + 14, PANEL.y + 38, Math.round((340 - 28) * clamp(mg.wave / 1.2, 0, 1)), 3, '#ffd23f');
  }
}
// Wait n frames (visual beats of a sequence). o: { frames, tick(mg, t), done(mg) }
export class WaitTask extends Task {
  update(inp, mg) { this.t++; if (this.o.tick) this.o.tick(mg, this.t); if (this.t >= (this.o.frames || 30)) { if (this.o.done) this.o.done(mg); return true; } return false; }
}
export class CallTask extends Task {
  update(inp, mg) { this.o.fn(mg); return true; }
}

// ------------------------------------------------------------------ the base game
export class PerformGame extends Minigame {
  static hd = true;
  static bgm = null;
  static kind = 'manzai';
  static skill = 'warai';

  constructor(g, opts = {}) {
    super(g, opts);
    this.kind = opts.kind && opts.kind !== 'any' ? opts.kind : this.constructor.kind;
    this.venue = { name: '', ...(opts.venue || {}) };
    try { this.setupChoices(); } catch (e) { console.error(e); this.choices = [{ neta: null, label: 'おまかせ', own: false, q: 50 }]; this.choiceIdx = 0; }
  }

  // ---------------------------------------------------------------- the ネタ choice (intro card)
  houseNeta() {
    const o = this.opts;
    if (Array.isArray(o.lines) && o.lines.length && (this.kind === 'manzai')) return legacyNeta(o.lines, { dialect: o.dialect, title: o.houseLabel });
    return bankNeta(this.kind === 'pin' ? 'pin' : this.kind, { style: o.style, dialect: o.dialect, rng: this.rng, title: o.houseTitle });
  }
  listKind() { return this.kind; }
  setupChoices() {
    const g = this.g, o = this.opts;
    this.choices = [];
    if (o.neta) {
      const n = o.neta;
      const own = !n.house && !n.auto;
      this.choices.push({ neta: n, label: n.title || 'ネタ', own, q: netaQ(g, n, n.ai && n.ai.total ? n.ai.total : 45), fixed: true });
    } else {
      const house = this.houseNeta();
      house.quality = Number.isFinite(o.quality) ? o.quality : clamp(40 + this.difficulty * 6, 0, 100);
      this.choices.push({ neta: house, label: house.title || 'おまかせ', own: false, q: house.quality });
      if (!o.noPick && typeof g.netaList === 'function') {
        const own = (safe(() => g.netaList(this.listKind()), []) || []).filter((n) => n && Array.isArray(n.lines) && n.lines.length).slice(0, 8);
        for (const n of own) this.choices.push({ neta: n, label: n.title || '無題のネタ', own: true, q: netaQ(g, n, 45) });
      }
    }
    this.choiceIdx = 0;
    if (!o.lesson && this.choices.length > 1 && o.preferOwn !== false) {
      let best = 1;
      for (let i = 2; i < this.choices.length; i++) if (this.choices[i].q > this.choices[best].q) best = i;
      this.choiceIdx = best;
    }
  }

  update(g) {
    if (this.phase === 'intro' && !g.auto && this.choices && this.choices.length > 1 && this.t > 6) {
      const n = this.choices.length;
      if (g.input.pressed('left')) { this.choiceIdx = (this.choiceIdx + n - 1) % n; audio.sfx('cursor'); }
      if (g.input.pressed('right')) { this.choiceIdx = (this.choiceIdx + 1) % n; audio.sfx('cursor'); }
    }
    super.update(g);
  }

  // ---------------------------------------------------------------- init
  init() {
    const ch = this.choices[this.choiceIdx] || this.choices[0];
    this.chosen = ch;
    const neta = ch.neta;
    this.ctx = buildCtx(this.g, { ...this.opts, kind: this.kind, neta, quality: neta && neta.house ? ch.q : this.opts.quality, rng: this.rng, difficulty: this.difficulty });
    this.show = new Show(this.ctx);
    this.lines = this.ctx.lines;
    this.members = this.ctx.members;
    this.pi = this.ctx.playerIdx;
    this.sheets = this.members.map((m) => S.sheetOf(m.look));
    this.crowd = new S.Crowd(1234 + this.kind.length);
    this.wave = 0;
    this.waveDecay = 0.012;
    this.sched = [];
    this.idx = -1;
    this.cur = null;
    this.state = 'opening';
    this.st = 0;
    this.task = null;
    this.queue = [];
    this.tempo = 1;
    this.rushM = 0;
    this.rushing = false;
    this.rushNoted = false;
    this.needSettle = false;
    this.nextMult = 1;
    this.bubble = null;
    this.burst = null;
    this.laughLabel = null;
    this.silenceT = 0;
    this.shakeT = 0;
    this.impact = 0;
    this.speaking = -1;
    this.talkT = 0;
    this.execLog = [];
    const d = this.difficulty - 1;
    this.charF = [3.0, 2.7, 2.4, 2.2, 2.0][d];
    this.win = [Math.round(this.ease([24, 21, 18, 15, 12][d], 0.5)), 0, 0];
    this.win[1] = this.win[0] + Math.round(this.ease([20, 18, 16, 14, 12][d], 0.4));
    this.win[2] = this.win[1] + Math.round(this.ease([24, 22, 20, 18, 16][d], 0.3));
    this.fast = this.lines.length > 34;
    this.dialect = this.ctx.dialect;
    this.setup();
    this.queue = (this.openingTasks() || []).slice();
  }

  // ---------------------------------------------------------------- subclass hooks (defaults)
  setup() {}
  openingTasks() { return []; }
  closingTasks() { return [new WaitTask({ frames: 90, done: (mg) => { mg.g.sfx('applause'); } })]; }
  beforeTasks(line) { return []; }
  afterTasks(line) { return []; }
  headPos(who) { return { x: SW / 2, y: 200 }; }
  speakerName(line) { return line.char || (this.members[line.who] && this.members[line.who].short) || ''; }
  drawStage(ctx) { if (this.bg) ctx.drawImage(this.bg, 0, 0); }
  hint() { return ['セリフ中に', 'right', '長押しで早口（尺を稼ぐ・噛みやすい）']; }
  onLaugh(line, L, resp) {}
  onResponse(punch, resp, grade) {}
  expectsPress(line) { return false; }
  onStrayPress(line) {}

  // ---------------------------------------------------------------- flow
  later(frames, fn) { this.sched.push({ at: this.pt + frames, fn }); }
  setState(s) { this.state = s; this.st = 0; }
  push(...tasks) { for (const t of tasks) if (t) this.queue.push(t); }

  updatePlay(inp) {
    this.st++;
    const due = this.sched.filter((e) => e.at <= this.pt);
    if (due.length) { this.sched = this.sched.filter((e) => e.at > this.pt); for (const e of due) e.fn(); }
    this.tickFx(inp);
    if (this.phase !== 'play') return;
    if (this.task) {
      let done = false;
      try { done = this.task.update(inp, this); } catch (e) { console.error(e); done = true; }
      if (done) { const t = this.task; this.task = null; this.recordExec(t, t.result || {}); if (t.o.onDone) t.o.onDone(t.result || {}, this); }
      return;
    }
    if (this.queue.length) { this.task = this.queue.shift(); this.task.start(this); return; }
    switch (this.state) {
      case 'opening': this.nextLine(); break;
      case 'pre': if (this.st >= this.preF) this.beginLine(); break;
      case 'before': this.startType(); break;
      case 'type': this.updateType(inp); break;
      case 'after': this.resolveLine(); break;
      case 'react': if (this.st >= this.reactLen) this.nextLine(); break;
      case 'closing': this.setState('done'); this.end(); break;
      default: break;
    }
  }

  nextLine() {
    this.idx++;
    this.burst = null;
    while (this.idx < this.lines.length && this.lines[this.idx].consumed) this.idx++;
    if (this.idx >= this.lines.length) {
      this.bubble = null;
      this.setState('closing');
      this.push(...(this.closingTasks() || []));
      return;
    }
    if (this.idx === 0) audio.stopBgm();
    this.cur = this.lines[this.idx];
    this.lineRes = {};
    this.setState('pre');
    const fastLine = this.fast && !this.cur.punch && !this.cur.resp;
    this.preF = fastLine ? 6 : this.cur.who < 0 ? 16 : 22;
    if (this.needSettle) {
      this.needSettle = false;
      this.push(new SettleTask({ label: '笑い待ち', onDone: (r, mg) => mg.onSettle(r) }));
    }
  }
  onSettle(r) {
    if (r.grade === 'kabuse') { this.nextMult = 0.72; this.show.h = Math.max(0.05, this.show.h - 0.03); this.popup('笑いに被せた！', 320, 120, COLORS.bad, 18); }
    else if (r.grade === 'nice') { this.nextMult = 1.08; this.show.h = Math.min(1, this.show.h + 0.03); this.popup('ナイス間！', 320, 120, COLORS.good, 18); audio.sfx('good'); }
    else { this.nextMult = 0.92; this.show.h = Math.max(0.05, this.show.h - 0.03); this.popup('間延び…', 320, 120, COLORS.dim, 18); }
  }
  beginLine() {
    this.setState('before');
    this.push(...(this.beforeTasks(this.cur) || []));
  }
  startType() {
    const ln = this.cur;
    this.setState('type');
    this.shown = 0;
    this.typeT = 0;
    this.tempoSum = 0;
    this.typeFrames = 0;
    this.kamuAt = -1;
    this.kamuDone = false;
    this.earlyPress = false;
    const chars = Array.from(ln.text);
    this.chars = chars;
    if (ln.who >= 0 && !ln.noRisk) {
      const r = this.show.risk(ln, { tempo: ln.who === this.pi && this.g.input.down('right') ? 1.6 : 1 });
      if (this.rng() < r.tobu) this.queueBlank(ln);
      if (this.rng() < r.kamu) this.kamuAt = Math.max(2, Math.floor(chars.length * (0.35 + this.rng() * 0.35)));
    }
    this.makeLineBubble(ln, ln.text, 0);
  }
  makeLineBubble(ln, str, n) {
    if (ln.who < 0) { this.bubble = S.makeBubble(str, { narr: true, y: 36, cx: SW / 2, n, maxW: 440, size: 16 }); return; }
    const hp = this.headPos(ln.who, ln);
    this.bubble = S.makeBubble(str, { tailX: hp.x, tailY: hp.y, cx: hp.x, y: 44, name: this.speakerName(ln), nameCol: ln.who === this.pi ? '#d64161' : '#ff8a3d', n });
  }
  updateType(inp) {
    const ln = this.cur;
    const mine = ln.who === this.pi && ln.who >= 0;
    let tempo = 1;
    if (mine && inp.down('right')) tempo = 1.6;
    if (this.fast && !ln.punch && !ln.resp) tempo = Math.max(tempo, 2.2);
    this.tempo = tempo;
    this.tempoSum += tempo;
    this.typeFrames = (this.typeFrames || 0) + 1;
    this.typeT += tempo;
    // rushing: speaking fast for too long
    if (mine) {
      const lim = 0.55 + this.members[this.pi].s.ma * 0.4;
      this.rushM = clamp(this.rushM + (tempo > 1 ? 0.012 : -0.004), 0, 1);
      if (!this.rushing && this.rushM > lim) { this.rushing = true; this.popup('走ってる！', 320, 150, COLORS.bad, 16); }
    }
    let n = Math.min(this.chars.length, Math.floor(this.typeT / this.charF));
    if (this.kamuAt >= 0 && !this.kamuDone && n >= this.kamuAt) { this.onKamu(ln); return; }
    if (n > this.shown) {
      if (n % 2 === 1 && !'、。！？…'.includes(this.chars[n - 1])) this.voice(ln.who === this.pi);
      this.shown = n;
      if (this.bubble) this.bubble.n = this.kamuDone ? Infinity : n;
    }
    if (inp.pressed('a')) {
      if (this.expectsPress(ln)) { if (n < this.chars.length - 3 && !this.earlyPress) { this.earlyPress = true; this.popup('まだ途中！', 520, 120, COLORS.bad, 16); } }
      else this.onStrayPress(ln);
    }
    this.speaking = ln.who;
    if (n >= this.chars.length) {
      if (this.bubble) this.bubble.n = Infinity;
      this.show.speak(ln, this.tempoSum / Math.max(1, this.typeFrames) || 1);
      this.speaking = -1;
      this.setState('after');
      this.push(...(this.afterTasks(ln) || []));
    }
  }
  onKamu(ln) {
    this.kamuDone = true;
    const k = kamiText(ln.text, this.rng);
    this.makeLineBubble(ln, k, Infinity);
    this.shakeT = 4;
    this.g.sfx('buzz');
    this.popup('噛んだ！', 520, 110, COLORS.bad, 18);
    const self = ln.who === this.pi;
    const d = this.dialect === 'std' ? 'std' : 'kansai';
    const adl = this.members[this.pi].s.adlib;
    const win = Math.round(this.ease(30 + adl * 30, 0.3));
    const other = this.members.length > 1;
    this.push(new AdlibTask({ label: self ? '噛んだ！' : `${this.members[ln.who].short}が噛んだ！`, prompt: self ? 'で言い直す' : (other ? 'でいじる（アドリブ）' : 'でごまかす'), win, onDone: (r, mg) => {
      if (r.ok) {
        const ok = self ? mg.rng() < 0.55 + adl * 0.4 : mg.rng() < 0.4 + adl * 0.55;
        mg.show.flub(ln.who, ok);
        if (ok) {
          const lines = self ? ADLIB.kamiSelf[d] : ADLIB.kamiOther[d];
          mg.burst = { text: lines[Math.floor(mg.rng() * lines.length)], t: 0, x: mg.headPos(mg.pi).x, weak: false };
          const L = mg.show.adlib(true, mg.pi, 0.3 + adl * 0.5);
          if (!self) mg.laughFx(L, true);
          mg.popup(self ? '言い直した！' : 'アドリブ成功！', 520, 140, COLORS.good, 16);
        } else { mg.show.adlib(false); mg.popup('…すべった', 520, 140, COLORS.dim, 16); mg.silenceT = 40; }
      } else { mg.show.flub(ln.who, false); mg.silenceT = 30; }
      mg.later(30, () => { if (mg.cur === ln) mg.makeLineBubble(ln, ln.text, Infinity); });
    } }));
  }
  queueBlank(ln) {
    const self = ln.who === this.pi;
    const d = this.dialect === 'std' ? 'std' : 'kansai';
    const dk = this.members[this.pi].s.dokyo;
    this.later(1, () => { this.makeLineBubble(ln, '……………', Infinity); this.silenceT = 50; });
    if (self) {
      const dirs = ['up', 'down', 'left', 'right'];
      const ans = dirs[Math.floor(this.rng() * 4)];
      this.push(new ArrowTask({ label: 'セリフが飛んだ！', prompt: '思い出せ！', dirs, answer: ans, win: Math.round(this.ease(34 + dk * 26, 0.3)), onDone: (r, mg) => {
        mg.show.blank(ln.who, !!r.ok);
        if (r.ok) { mg.burst = { text: ADLIB.self[d][Math.floor(mg.rng() * ADLIB.self[d].length)], t: 0, x: mg.headPos(mg.pi).x, weak: true }; mg.popup('思い出した！', 520, 140, COLORS.good, 16); }
        else { mg.popup('頭が真っ白…', 520, 140, COLORS.bad, 16); mg.silenceT = 60; mg.shakeT = 3; }
      } }));
    } else {
      this.push(new AdlibTask({ label: `${this.members[ln.who].short}のセリフが飛んだ！`, prompt: 'でフォロー', win: Math.round(this.ease(40, 0.3)), onDone: (r, mg) => {
        const adl = mg.members[mg.pi].s.adlib;
        const ok = r.ok && mg.rng() < 0.45 + adl * 0.5;
        mg.show.blank(ln.who, ok);
        if (ok) {
          const lines = ADLIB.follow[d];
          mg.burst = { text: lines[Math.floor(mg.rng() * lines.length)].replace('〜', ''), t: 0, x: mg.headPos(mg.pi).x, weak: true };
          mg.show.adlib(true, mg.pi, 0.3);
          mg.popup('フォロー成功！', 520, 140, COLORS.good, 16);
        } else mg.silenceT = 60;
      } }));
    }
  }

  // the laugh for a 笑いどころ (and its response line)
  resolveLine() {
    const ln = this.cur;
    if (!ln.punch) { this.react(ln.who < 0 ? 10 : 8); return; }
    const resp = ln.respIdx != null ? this.lines[ln.respIdx] : null;
    let t = this.lineRes.t;
    if (t == null) t = this.show.simTiming(ln.who >= 0 ? ln.who : this.pi);
    else { const w = 0.8 + 0.15 * this.show.r; t = w * t + (1 - w) * this.show.simTiming(this.pi); }
    if (resp) {
      resp.consumed = true;
      let rt = this.lineRes.respT;
      if (rt == null) rt = this.show.simTiming(resp.who);
      else { const w = 0.8 + 0.15 * this.show.r; rt = w * rt + (1 - w) * this.show.simTiming(this.pi); }
      // whoever the player is in the pair carries more of the bit on a routine stage; at stakes both count alike
      const pw = 0.5 + 0.25 * this.show.r;
      if (resp.who === this.pi && ln.who !== this.pi) t = (1 - pw) * t + pw * rt;
      else if (ln.who === this.pi && resp.who !== this.pi) t = pw * t + (1 - pw) * rt;
      else t = (t + rt) / 2;
      if (resp.who !== this.pi) { const rk = this.show.risk(resp); if (this.rng() < rk.kamu * 0.6) { this.show.flub(resp.who, false); this.popup(`${this.members[resp.who].short}が噛んだ`, 520, 110, COLORS.bad, 14); } }
      this.show.speak(resp);
    }
    let mult = this.nextMult * (this.lineRes.mult ?? 1) * (ln.who === this.pi ? (this.actMult ?? 1) : 1);
    this.nextMult = 1;
    if (this.rushing && (ln.who === this.pi || (resp && resp.who === this.pi))) {
      mult *= 0.75;
      if (!this.rushNoted) { this.show.rushed(this.pi); this.rushNoted = true; }
    } else if (!this.rushing) this.rushNoted = false;
    if (this.rushing && this.rushM < 0.3) this.rushing = false;
    // the partner can rush under pressure on their own
    const other = resp ? resp.who : ln.who;
    if (other >= 0 && other !== this.pi && this.rng() < this.show.risk(ln).rush * 0.5) { mult *= 0.8; this.show.rushed(other); }
    const L = this.show.laugh(ln, t, { resp, mult, waitK: 0 });
    if (resp) this.onResponse(ln, resp, this.lineRes.respGrade);
    this.onLaugh(ln, L, resp);
    this.laughFx(L);
    this.react(L.cls === 'big' ? 64 : L.cls === 'laugh' ? 48 : L.cls === 'kusu' ? 34 : 50);
    if (L.cls === 'big' && this.idx < this.lines.length - 2) this.needSettle = true;
    else if (L.cls !== 'suberi') this.show.wait(L.cls === 'laugh' ? 0.9 : 0.3);
  }
  laughFx(L, small = false) {
    if (!L) return;
    const v = L.v;
    this.wave = Math.max(this.wave, Math.min(1.25, v * (small ? 0.7 : 1)));
    this.waveDecay = L.cls === 'big' ? 0.0085 : 0.013;
    const label = { big: '爆笑！', laugh: 'ウケた！', kusu: 'クスクス', suberi: 'スベった…' }[L.cls];
    const col = { big: COLORS.accent, laugh: COLORS.good, kusu: COLORS.cyan, suberi: COLORS.dim }[L.cls];
    if (!small) this.laughLabel = { text: label, col, t: 0 };
    if (L.cls === 'big') { this.g.sfx('laugh'); this.later(14, () => this.g.sfx('applause')); this.crowd.spawn(6); this.shakeT = 6; }
    else if (L.cls === 'laugh') { this.g.sfx('laugh'); this.crowd.spawn(4); }
    else if (L.cls === 'kusu') { this.chuckle(); this.crowd.spawn(1, ['クスッ', 'ふふ']); }
    else { this.silenceT = 60; }
  }
  react(n) { this.setState('react'); this.reactLen = n; }

  tickFx(inp) {
    this.wave = Math.max(0, this.wave - this.waveDecay);
    if (this.crowd) this.crowd.update(this.wave, this.pt);
    if (this.burst) this.burst.t++;
    if (this.laughLabel) { this.laughLabel.t++; if (this.laughLabel.t > 60) this.laughLabel = null; }
    if (this.silenceT > 0) this.silenceT--;
    if (this.shakeT > 0) this.shakeT--;
    if (this.impact > 0) this.impact--;
    this.talkT++;
    if (this.state !== 'type' && this.rushM > 0) this.rushM = Math.max(0, this.rushM - 0.002);
    if (this.rushing && this.rushM < 0.3) this.rushing = false;
  }
  voice(player) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    audio.tone(player ? 760 + this.rng() * 120 : 420 + this.rng() * 90, t, 0.035, { wave: 'square', vol: 0.035 });
  }
  chuckle() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    for (let i = 0; i < 2; i++) audio.tone(520 - i * 30, t + i * 0.09, 0.05, { wave: 'square', vol: 0.03 });
  }
  // the minigame's own execution rating for the result's parts
  // How well the player played (0..100): every finished task scores 0..1 (the old minigames' accuracy); the result blends
  // it in on routine stages (perform_model.js, stakes).
  addExec(v) { if (Number.isFinite(v)) this.execLog.push(clamp(v, 0, 1)); }
  recordExec(task, r) {
    const n = task.constructor.name;
    if (task.o && task.o.noExec) return;
    if (n === 'WindowTask' || n === 'HoldTask' || n === 'RingTask') this.addExec(r.grade === 'early' ? 0.12 : (r.t ?? 0.3) / 1.05);
    else if (n === 'ArrowTask') this.addExec(r.ok ? 1 : 0.1);
    else if (n === 'AdlibTask') this.addExec(r.ok ? 1 : 0.3);
    else if (n === 'SettleTask') this.addExec({ nice: 1, nobi: r.auto ? 0.3 : 0.45, kabuse: 0.2 }[r.grade] ?? 0.4);
    else if (n === 'BeatTask' || n === 'PitchTask') this.addExec(r.acc ?? 0.5);
    else if (n === 'BlackoutTask') this.addExec({ perfect: 1, good: 0.8, early: 0.35, late: 0.45 }[r.grade] ?? 0.5);
  }
  execRating() { return this.execLog && this.execLog.length ? clamp(Math.round((this.execLog.reduce((a, b) => a + b, 0) / this.execLog.length) * 100), 0, 100) : undefined; }

  // ---------------------------------------------------------------- results
  end(score, comment) {
    if (this.phase === 'result') return;
    let res = null;
    try {
      if (this.show) res = this.show.finish({ score: Number.isFinite(score) ? score : undefined, pass: this.opts.pass, execAcc: this.execRating() });
    } catch (e) { console.error(e); }
    if (!res) {
      const s = clamp(Math.round(Number.isFinite(score) ? score : 50), 0, 100);
      res = { score: s, rank: rankFor(s), success: s >= (this.opts.pass ?? 50), laughs: 0, big: 0, flubs: 0, blanks: 0, overtime: 0, adlib: 0, heat: [], parts: { neta: 50, execution: 50, presence: 50, timing: 50, crowd: 50 }, comment: '', highlights: [] };
    }
    if (comment) res.comment = comment;
    if (this.chosen && this.chosen.own && this.chosen.neta) res.netaId = this.chosen.neta.id;
    this.result = res;
    this.phase = 'result';
    this.t = 0;
    audio.sfx(res.success ? 'success' : 'fail');
    this.applyGrowth(res);
  }
  forceEnd(score = 60) {
    // tests / g.auto: the model's own run with the forced score
    if (!this.ctx) { try { this.init(); } catch (e) { console.error(e); } }
    this.phase = 'play';
    try {
      const res = simulate(this.ctx, { score, pass: this.opts.pass });
      if (this.chosen && this.chosen.own && this.chosen.neta) res.netaId = this.chosen.neta.id;
      this.result = res;
      this.phase = 'result';
      this.t = 0;
      this.applyGrowth(res);
      return;
    } catch (e) { console.error(e); }
    this.end(score);
  }
  applyGrowth(res) {
    if (this.grown) return;
    this.grown = true;
    const g = this.g;
    if (typeof g.performGrowth !== 'function') return;
    const role = this.members && this.members[this.pi] ? this.members[this.pi].role : null;
    this.growthText = safe(() => g.performGrowth(this.kind, res, { lesson: !!this.opts.lesson, practice: !!this.opts.practice, pressure: this.ctx ? this.ctx.venue.pressure : 0, role, netaId: res.netaId, stats: this.opts.growStats }), '') || '';
  }

  // ---------------------------------------------------------------- drawing
  drawPlay(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (this.shakeT > 0) {
      const a = this.shakeT;
      ctx.translate(Math.round((((this.pt * 37) % 7) / 6 - 0.5) * a * 1.4), Math.round((((this.pt * 53) % 5) / 4 - 0.5) * a * 0.8));
    }
    this.drawStage(ctx);
    if (this.impact > 0 && this.impactAt) S.impactStar(ctx, this.impactAt.x, this.impactAt.y, this.impact);
    this.crowd.draw(ctx, this.wave, this.pt, { clap: this.clapAll });
    ctx.restore();
    this.drawOver(ctx);
    if (this.bubble) S.drawBubble(ctx, this.bubble);
    if (this.burst) S.drawBurst(ctx, this.burst.text, this.burst.x ?? 480, this.burst.y ?? 166, this.burst.t, { weak: this.burst.weak, size: this.burst.size });
    if (this.silenceT > 0) {
      ctx.globalAlpha = clamp(this.silenceT / 30, 0, 1);
      text(ctx, 'シーン…', 320, 300, { size: 18, align: 'center', color: '#9aa3c7', outline: '#000' });
      ctx.globalAlpha = 1;
    }
    if (this.laughLabel) {
      const L = this.laughLabel;
      ctx.globalAlpha = clamp(1.4 - L.t / 45, 0, 1);
      text(ctx, L.text, 560, 150 - Math.min(10, L.t) , { size: 22, align: 'center', color: L.col, outline: '#000' });
      ctx.globalAlpha = 1;
    }
    if (this.task) this.task.draw(ctx, this);
    this.drawHudBar(ctx);
    S.drawHint(ctx, this.task ? this.taskHint(this.task) : this.hint());
  }
  drawOver(ctx) {}
  drawHudBar(ctx) {
    const total = this.lines.filter((l) => !l.resp).length;
    const done = clamp(this.lines.slice(0, this.idx + 1).filter((l) => !l.resp).length, 0, total);
    const mineAny = this.lines.some((l) => l.who === this.pi);
    S.drawHud(ctx, { left: `ネタ ${done}/${total}`, heat: this.show.h, clock: this.show.time, limit: this.ctx.limit, rush: mineAny ? clamp(this.rushM / (0.55 + this.members[this.pi].s.ma * 0.4), 0, 1) : null });
  }
  taskHint(t) {
    if (t instanceof WindowTask) return ['ボケが言い終わったら', 'A', 'でツッコミ！'];
    if (t instanceof HoldTask) return ['A', '長押しで間をためて、緑のゾーンではなす'];
    if (t instanceof SettleTask) return ['爆笑中は待つ。笑いが引きかけたら', 'A', 'で次のセリフ'];
    if (t instanceof AdlibTask) return ['すかさず', String(t.o.key || 'b').toUpperCase(), t.o.prompt || 'でアドリブ！'];
    if (t instanceof ArrowTask) return t.o.hint || ['表示された', 'up', 'down', 'left', 'right', 'を押そう'];
    if (t instanceof ChoiceTask) return ['up', 'down', 'でえらんで', 'A', 'で決定'];
    if (t instanceof BeatTask) return ['リズムに合わせて', 'A'];
    if (t instanceof RingTask) return ['輪が重なった瞬間に', 'A'];
    return this.hint();
  }

  // intro card: venue, the act, the ネタ selector
  drawIntroHD(ctx) {
    S.drawPanel(ctx, 64, 24, SW - 128, SH - 48, { gold: true, fill: 'rgba(14,16,40,0.95)' });
    text(ctx, this.title, SW / 2, 36, { size: 22, align: 'center', color: COLORS.accent });
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += i <= this.difficulty ? '★' : '☆';
    const v = this.opts.venue || {};
    const crowd = (CROWD[v.crowd] || CROWD.normal).label;
    const vname = v.name || (this.opts.contest && this.opts.contest.name) || (SIZE[v.size] || SIZE.theater).label;
    const vline = `${vname}　${crowd}　むずかしさ ${stars}`;
    let vs = 14;
    while (measure(ctx, vline, vs) > SW - 170 && vs > 11) vs--;
    text(ctx, vline, SW / 2, 64, { size: vs, align: 'center', color: COLORS.pink });
    // the ネタ
    const ch = this.choices[this.choiceIdx] || this.choices[0];
    const bx = 96, by = 86, bw = SW - 192, bh = 64;
    S.roundBox(ctx, bx, by, bw, bh, '#1c2048', S.INK, '#141838');
    const multi = this.choices.length > 1;
    if (multi) { S.glyph(ctx, 'left', bx + 8, by + 12); S.glyph(ctx, 'right', bx + bw - 28, by + 12); }
    const tag = ch.own ? '自作' : ch.fixed ? '' : (this.opts.lines ? '劇場の台本' : 'おまかせ');
    let title = `『${ch.label}』${tag ? `（${tag}）` : ''}`;
    let ts = 18;
    while (measure(ctx, title, ts) > bw - 80 && ts > 12) ts--;
    text(ctx, title, SW / 2, by + 10, { size: ts, align: 'center', color: '#ffffff' });
    const q = Math.round(ch.q);
    const qs = '★'.repeat(clamp(Math.round(q / 20), 0, 5)) + '☆'.repeat(5 - clamp(Math.round(q / 20), 0, 5));
    const lim = Number(this.opts.length) > 0 ? `／制限 ${S.mmss(this.opts.length)}` : '';
    const len = ch.neta && Number(ch.neta.length) > 0 ? `尺 約${S.mmss(ch.neta.length)}` : '';
    const prac = ch.neta && Number.isFinite(Number(ch.neta.practice)) && ch.own ? `／仕上がり ${Math.round(ch.neta.practice)}` : '';
    const sub = `台本 ${qs}（${q}）　${len}${lim}${prac}`;
    let ss = 14;
    while (measure(ctx, sub, ss) > bw - 70 && ss > 11) ss--;
    text(ctx, sub, SW / 2, by + 36, { size: ss, align: 'center', color: COLORS.dim });
    if (multi) text(ctx, `${this.choiceIdx + 1}/${this.choices.length}`, bx + bw - 18, by + bh - 16, { size: 12, align: 'right', color: COLORS.dim });
    // how to
    const howto = [].concat(this.opts.howto || this.howto());
    let y = 162;
    for (const line of howto) {
      for (const l of wrap(ctx, line, SW - 200, 14)) { text(ctx, l, 100, y, { size: 14 }); y += 21; }
      if (y > 268) break;
    }
    this.drawBonusLine(ctx, SW / 2, SH - 76, 13);
    const go = multi ? '←→でネタを選んで　Aでスタート！' : 'Aでスタート！';
    if (Math.floor(this.t / 20) % 2 === 0) text(ctx, go, SW / 2, SH - 56, { size: 16, align: 'center', color: COLORS.cyan });
  }
  howto() { return [].concat(this.constructor.howto || []); }
  drawBackground(ctx) {
    try {
      if (!this.introBg) this.introBg = this.makeIntroBg();
      if (this.introBg) ctx.drawImage(this.introBg, 0, 0);
      ctx.fillStyle = 'rgba(8,10,26,0.55)';
      ctx.fillRect(0, 0, SW, SH);
    } catch (e) { super.drawBackground(ctx); }
  }
  makeIntroBg() { return S.backdrop('theater', {}); }

  drawResultHD(ctx) {
    const r = this.result;
    const k = Math.min(1, this.t / 15);
    ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
    ctx.fillRect(0, 0, SW, SH);
    const y = Math.round(18 + (1 - k) * 40);
    const x = 40, w = SW - 80, h = 318;
    S.drawPanel(ctx, x, y, w, h, { gold: true, fill: 'rgba(14,16,40,0.96)' });
    let tt = this.title;
    let ts = 14;
    while (measure(ctx, tt, ts) > w - 40 && ts > 11) ts--;
    text(ctx, tt, SW / 2, y + 10, { size: ts, align: 'center', color: COLORS.dim });
    const RC = { S: '#ffd23f', A: '#ff7eb6', B: '#5fd7ff', C: '#5ee07a', D: '#9aa3c7' };
    text(ctx, r.rank, x + 70, y + 30, { size: 64, align: 'center', color: RC[r.rank], outline: '#000' });
    text(ctx, `${r.score}点`, x + 70, y + 104, { size: 20, align: 'center', color: COLORS.accent });
    // counts
    const ot = r.overtime || 0;
    const rows = [
      ['笑い', `${r.laughs || 0}（爆笑 ${r.big || 0}）`, COLORS.text],
      ['スベり', `${r.suberi ?? 0}`, r.suberi ? COLORS.dim : COLORS.text],
      ['噛み', `${r.flubs || 0}`, r.flubs ? COLORS.bad : COLORS.text],
      ['飛び', `${r.blanks || 0}`, r.blanks ? COLORS.bad : COLORS.text],
      ['尺', r.limit ? `${S.mmss(r.duration || 0)}/${S.mmss(r.limit)}${ot ? ` +${ot}秒` : ''}` : `${S.mmss(r.duration || 0)}`, ot > 3 ? COLORS.bad : COLORS.text],
      ['アドリブ', `${r.adlib || 0}`, r.adlib ? COLORS.good : COLORS.text],
    ];
    rows.forEach(([a, b, c], i) => { text(ctx, a, x + 150, y + 36 + i * 21, { size: 14, color: COLORS.dim }); text(ctx, b, x + 222, y + 36 + i * 21, { size: 14, color: c }); });
    // parts
    const P = r.parts || {};
    const PL = [['neta', 'ネタ'], ['execution', '実行'], ['presence', '存在感'], ['timing', '間'], ['crowd', '客席']];
    PL.forEach(([kk, lab], i) => {
      const yy = y + 38 + i * 22;
      text(ctx, lab, x + 352, yy - 2, { size: 13, color: COLORS.dim });
      S.meter(ctx, x + 404, yy, 116, 10, (P[kk] || 0) / 100, (f) => (f >= 0.75 ? '#ffd23f' : f >= 0.5 ? '#5ee07a' : f >= 0.3 ? '#5fd7ff' : '#9aa3c7'));
      text(ctx, String(P[kk] ?? '-'), x + w - 16, yy - 2, { size: 12, align: 'right', color: COLORS.text });
    });
    // heat wave
    const hv = r.heat || [];
    if (hv.length > 1) {
      const gx = x + 20, gy = y + 156, gw = w - 40, gh = 28;
      rect(ctx, gx, gy, gw, gh, '#0a0c22');
      for (let i = 0; i < hv.length; i++) {
        const bx = gx + Math.round((i / hv.length) * gw), bw2 = Math.max(2, Math.round(gw / hv.length) - 2);
        const bh2 = Math.max(1, Math.round((hv[i] / 100) * (gh - 4)));
        rect(ctx, bx, gy + gh - 2 - bh2, bw2, bh2, hv[i] >= 70 ? '#ff7a5c' : hv[i] >= 40 ? '#ffd23f' : '#5fd7ff');
      }
      text(ctx, '笑いの波', gx + 4, gy + 2, { size: 11, color: COLORS.dim, shadow: null });
    }
    // highlights (up to 5: every mistake first-class, then the good moments, in the order they happened) + comment
    const all = r.highlights || [];
    const bad = new Set(r.highlightsBad || []);
    let pickHl = all.slice(0, 5);
    if (all.length > 5) {
      const keep = new Set(all.filter((h) => bad.has(h)).slice(0, 4));
      for (const h of all) { if (keep.size >= 5) break; keep.add(h); }
      pickHl = all.filter((h) => keep.has(h));
    }
    let yy = y + 188;
    for (const hline of pickHl) {
      let s = 12;
      let str = '・' + hline;
      while (measure(ctx, str, s) > w - 40 && s > 10) s--;
      while (measure(ctx, str, s) > w - 40 && str.length > 6) str = str.slice(0, -2) + '…';
      text(ctx, str, x + 20, yy, { size: s, color: bad.has(hline) ? '#ffb4bc' : '#e8eaf6' });
      yy += 15;
    }
    const cm = wrap(ctx, r.comment || '', w - 40, 14);
    let cs = 14;
    while (cm.length > 1 && cs > 11 && wrap(ctx, r.comment || '', w - 40, cs).length > 1) cs--;
    text(ctx, wrap(ctx, r.comment || '', w - 40, cs)[0] || '', SW / 2, Math.max(yy + 3, y + h - 48), { size: cs, align: 'center', color: COLORS.accent });
    if (this.growthText) text(ctx, this.growthText, x + 20, y + h - 24, { size: 12, color: COLORS.good });
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aで次へ', x + w - 16, y + h - 24, { size: 13, align: 'right', color: COLORS.cyan });
  }
}

export { S };
