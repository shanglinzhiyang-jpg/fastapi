// minigame 'pinneta' (owner: C) — ピン芸 (perform_base.js). opts.style:
//   'flip'     フリップ芸: the フリップ on the easel; each 笑いどころ = hold A for the めくりの間 and release to flip
//   'solo'     一人コント: the set, 役に入る (ring), 「（間）」 lines = listening to the invisible partner (hold A through
//              the pause, release when they'd have finished), 暗転 at the end
//   'mandan'   漫談 at the センターマイク: 笑いどころ = hold A for the 間; → 早口 / 笑い待ち / 噛み (B)
//   'utaneta'  歌ネタ: a backing track; sung lines ride the beat; the 笑いどころ lands on the beats (A on the beats);
//              the last line is the 歌い上げ (hold A, release at the end of the long note)
//   'monomane' ものまね: keep the voice on the target melody with ↑↓ (似てる度), then deliver the line
// kind 'utaneta' / 'monomane' / 'talk' (→ mandan) set the style; R-1 / 歌ネタ王 / ものまね contests call it through
// g.perform. Other opts as manzai (neta, venue, contest, length, lesson, practice, noPick …).

import { registerMinigame, COLORS, text } from '../engine/minigame.js';
import { registerSong, audio } from '../engine/audio.js';
import { SW, SH, clamp } from '../engine/util.js';
import { rect, measure, wrap } from '../engine/draw.js';
import { PerformGame, HoldTask, BeatTask, RingTask, BlackoutTask, WaitTask, Task, S } from '../engine/perform_base.js';
import { bankNeta, MONOMANE } from '../engine/perform_bank.js';
import { pinStyle, PIN_STYLES } from '../engine/perform_model.js';
import { setOf } from './conte.js';

registerSong('pin_debayashi', {
  bpm: 150, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'A4 . C5 E5 . C5 A4 . | B4 . D5 F5 . D5 B4 . | C5 . E5 A5 . G5 E5 . | D5 E5 F5 G5 A5 . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | E2 . B2 . E2 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k . h k s . h . | k . h . s h h .' },
  ],
});
registerSong('utaneta_backing', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.06, notes: 'E4 . G4 . B4 . G4 . | C4 . E4 . G4 . E4 . | D4 . F#4 . A4 . F#4 . | B3 . D#4 . F#4 . D#4 .' },
    { wave: 'triangle', vol: 0.09, notes: 'E2 - - . E2 - - . | C2 - - . C2 - - . | D2 - - . D2 - - . | B1 - - . B1 - - .' },
    { wave: 'drum', vol: 0.05, notes: 'k . h . s . h . | k . h k s . h .' },
  ],
});

// ものまね: keep the pitch cursor on the target melody (↑ raises, ↓ lowers, it drifts back to the middle)
class PitchTask extends Task {
  start() { this.p = 0.5; this.v = 0; this.sum = 0; this.n = 0; }
  target(t) {
    const c = this.o.contour || MONOMANE.generic.contour;
    const len = this.o.len || 150;
    const f = clamp(t / len, 0, 0.999) * (c.length - 1);
    const i = Math.floor(f), k = f - i;
    return c[i] * (1 - k) + c[Math.min(c.length - 1, i + 1)] * k;
  }
  update(inp) {
    this.t++;
    const len = this.o.len || 150;
    if (inp.down('up')) this.v += 0.0045;
    if (inp.down('down')) this.v -= 0.0045;
    this.v += (0.5 - this.p) * 0.0006;
    this.v *= 0.9;
    this.p = clamp(this.p + this.v, 0, 1);
    if (this.t > 20) { const d = Math.abs(this.p - this.target(this.t)); this.sum += clamp(1 - d * 4, 0, 1); this.n++; }
    if (this.t % 6 === 0 && audio.ctx && !audio.muted) audio.tone(260 + this.p * 520, audio.ctx.currentTime + 0.005, 0.09, { wave: 'square', vol: 0.025 });
    if (this.t >= len) {
      const acc = this.n ? this.sum / this.n : 0;
      const grade = acc >= 0.8 ? 'perfect' : acc >= 0.6 ? 'good' : acc >= 0.35 ? 'late' : 'miss';
      this.result = { acc, grade, t: { perfect: 1.05, good: 0.86, late: 0.55, miss: 0.25 }[grade] };
      return true;
    }
    return false;
  }
  draw(ctx) {
    const x = this.panel(ctx, 440, 146);
    const gx = x + 170, gw = 254, gy = 290 + 6, gh = 36;
    rect(ctx, gx, gy, gw, gh, '#0a0c22');
    const len = this.o.len || 150;
    for (let k = -20; k <= 60; k += 2) {
      const tt = this.t + k;
      if (tt < 0 || tt > len) continue;
      const px = gx + Math.round(((k + 20) / 80) * gw);
      const py = gy + gh - 3 - Math.round(this.target(tt) * (gh - 6));
      rect(ctx, px, py, 2, 3, '#5ee07a');
    }
    const cx = gx + Math.round((20 / 80) * gw);
    rect(ctx, cx, gy, 1, gh, 'rgba(255,255,255,0.3)');
    const py = gy + gh - 3 - Math.round(this.p * (gh - 6));
    S.fillEllipse(ctx, cx, py, 4, 4, '#ff7eb6');
    const acc = this.n ? this.sum / this.n : 0;
    text(ctx, `似てる度 ${Math.round(acc * 100)}%`, x + 14, 290 + 26, { size: 13, color: '#c8cce6', shadow: null });
  }
}

const CUE_RE = /（(フリップ|めくる)）/;

class PinNeta extends PerformGame {
  static title = 'ピンネタ';
  static kind = 'pin';
  static skill = 'warai';
  static bgm = 'pin_debayashi';

  constructor(g, opts = {}) {
    super(g, opts);
    this.style = pinStyle(this.kind, opts);
    if (!opts.title) this.title = PIN_STYLES[this.style] || 'ピンネタ';
    if (this.style !== 'flip' && !opts.neta && this.choices && this.choices[0] && this.choices[0].neta && this.choices[0].neta.house && this.choices[0].neta.styleBuilt !== this.style) {
      // the house script was built before the style was known
      const q = this.choices[0].q;
      const n = bankNeta(this.kind === 'pin' ? 'pin' : this.kind, { style: this.style, rng: this.rng });
      n.quality = q;
      this.choices[0] = { ...this.choices[0], neta: n, label: n.title };
    }
  }
  houseNeta() {
    const style = pinStyle(this.kind, this.opts);
    const n = bankNeta(this.kind === 'pin' ? 'pin' : this.kind, { style, rng: this.rng });
    n.styleBuilt = style;
    return n;
  }
  listKind() { return this.kind === 'pin' ? 'pin' : this.kind; }
  howto() {
    const s = this.style || pinStyle(this.kind, this.opts);
    if (s === 'flip') return ['フリップ芸：笑いどころは A 長押しで「めくりの間」をため、ゾーンではなしてめくる', '爆笑のあとは笑いが引きかけたところで A。噛んだら B で言い直す'];
    if (s === 'solo') return ['一人コント：輪が重なったら A で役に入る', '「（間）」は見えない相手のセリフ。A長押しで聞く間をとり、ゾーンではなす', '最後は笑いのピークで A で暗転'];
    if (s === 'utaneta') return ['歌ネタ：伴奏に乗って歌う。笑いどころはリズムに合わせて A', '最後の歌い上げは A 長押し、ゾーンではなす'];
    if (s === 'monomane') return ['ものまね：↑↓で声の高さを緑のメロディに合わせる（似てる度）', 'そのあとセリフで笑いを取る。笑いどころは A 長押しで間'];
    return ['漫談：ひとりでマイクの前。笑いどころは A 長押しで間をため、ゾーンではなす', '→長押しで早口（尺は稼げるが噛みやすい）。爆笑のあとは笑いが引きかけたら A'];
  }
  makeIntroBg() { return this.style === 'solo' ? S.backdrop('conte', { setting: 'office' }) : S.backdrop('pin', { sign: this.signText() }); }
  signText() { const o = this.opts; return (o.venue && o.venue.name) || (o.contest && o.contest.name) || PIN_STYLES[this.style] || 'ピン芸'; }

  setup() {
    this.style = pinStyle(this.kind, this.opts);
    if (this.style === 'solo') {
      this.setting = setOf({ setting: this.ctx.setting, theme: this.ctx.theme, title: this.ctx.title }, this.opts);
      this.bg = S.backdrop('conte', { setting: this.setting === 'generic' ? 'office' : this.setting });
    } else this.bg = S.backdrop('pin', { sign: this.signText() });
    this.px = this.style === 'flip' ? 200 : 288;
    this.page = null; // flip: { setup, punch, open, t }
    this.inRole = false;
    this.light = this.style === 'solo' ? 0 : 1;
    this.subject = null;
    for (const l of this.lines) {
      // flip cues stay out of the spoken bubble; the board shows the text
      const m = CUE_RE.exec(l.text);
      if (m) { l.flipCue = m[1]; l.text = l.text.replace(CUE_RE, '').trim() || l.text; l.board = l.text.replace(/^(まずは|続いて|最後は)?こちら。/, ''); }
      if (this.style === 'solo' && /^（間）/.test(l.text)) { l.listen = true; l.text = l.text.replace(/^（間）/, ''); }
    }
    const last = this.lines[this.lines.length - 1];
    if (this.style === 'solo' && last && last.who < 0 && /暗転/.test(last.text)) last.consumed = true;
  }
  openingTasks() {
    if (this.style === 'solo') return [new WaitTask({ frames: 46, tick: (mg, t) => { mg.light = Math.min(1, t / 36); } })];
    return [new WaitTask({ frames: 50, tick: (mg, t) => { mg.enter = 1 - Math.min(1, t / 40); }, done: (mg) => { mg.enter = 0; mg.g.sfx('applause'); mg.wave = 0.3; } })];
  }
  closingTasks() {
    if (this.style === 'solo') {
      return [
        new BlackoutTask({ label: '暗転', onDone: (r, mg) => { mg.show.craft({ perfect: 3, good: 1.5, early: -2, late: -1.5 }[r.grade] ?? 0, 'anten', r.grade === 'perfect' ? '暗転のタイミングが完璧だった' : null); mg.popup({ perfect: 'キレイな暗転！', good: '暗転', early: '暗転が早い！', late: '暗転が遅い…' }[r.grade], 320, 150, r.grade === 'perfect' ? COLORS.accent : COLORS.good, 18); } }),
        new WaitTask({ frames: 60, tick: (mg, t) => { mg.light = Math.max(0, 1 - t / 12); if (t === 16) { mg.g.sfx('applause'); mg.clapAll = true; } }, done: (mg) => { mg.clapAll = false; } }),
      ];
    }
    return [new WaitTask({ frames: 80, tick: (mg, t) => { mg.bowT = t; if (t === 4) { mg.g.sfx('applause'); mg.clapAll = true; } }, done: (mg) => { mg.clapAll = false; audio.stopBgm(); } })];
  }
  beforeTasks(line) {
    const out = [];
    if (line.who !== this.pi) return out;
    if (this.style === 'solo' && !this.inRole) {
      this.inRole = true;
      out.push(new RingTask({ label: '役に入る', prompt: 'A で役になりきる', win: Math.round(this.ease(56, 0.3)), onDone: (r, mg) => {
        mg.actMult = { perfect: 1.1, good: 1, early: 0.9, late: 0.9, miss: 0.85 }[r.grade] ?? 1;
        mg.show.craft(r.grade === 'perfect' ? 2 : r.grade === 'good' ? 1 : -1.5, 'yaku', r.grade === 'perfect' ? '一人なのに、相手が見えるほどの演技だった（演技力）' : null);
        mg.popup({ perfect: 'なりきった！', good: '役に入った', miss: '入りきれない…' }[r.grade] || '照れが出た…', 320, 150, r.grade === 'perfect' ? COLORS.accent : COLORS.good, 18);
      } }));
    }
    if (this.style === 'solo' && line.listen) {
      out.push(new HoldTask({ label: '見えない相手の間', zone: [0.5, 0.8], fill: 56, onDone: (r, mg) => {
        mg.listenGrade = r.grade;
        if (line.punch) mg.lineRes.t = r.t;
        else mg.lineRes.mult = r.grade === 'perfect' || r.grade === 'good' ? 1.05 : 0.9;
        mg.popup({ perfect: 'いい間！', good: 'GOOD', early: '相手の話を聞いてない！', late: '間延び…', stiff: '間延び…' }[r.grade], 520, 120, r.grade === 'perfect' || r.grade === 'good' ? COLORS.good : COLORS.bad, 16);
      } }));
      return out;
    }
    if (this.style === 'monomane' && (line.subject || line.punch)) {
      const sub = MONOMANE[line.subject] || { ...MONOMANE.generic, label: (this.ctx.theme || 'ものまね').slice(0, 14) };
      this.subject = sub;
      if (line.punch) {
        out.push(new PitchTask({ label: `ものまね「${sub.label}」`, contour: sub.contour, len: Math.round(140 / (1 + this.bonus * 0.2)), onDone: (r, mg) => {
          mg.lineRes.t = r.t;
          if (r.acc >= 0.8) mg.show.craft(1.5, 'nite', `${sub.label}のものまねが「似てる！」とどよめきを呼んだ（ものまね）`);
          mg.popup(r.acc >= 0.8 ? 'そっくり！' : r.acc >= 0.6 ? '似てる！' : r.acc >= 0.35 ? 'ちょっと似てる' : '似てない…', 520, 120, r.acc >= 0.6 ? COLORS.good : COLORS.dim, 18);
        } }));
        return out;
      }
    }
    if (line.punch) {
      if (this.style === 'utaneta' && line.beat !== 'ochi') {
        out.push(new BeatTask({ label: '歌の笑いどころ', beats: 2, interval: 18, lead: 36, sfx: () => { if (audio.ctx && !audio.muted) audio.tone(660, audio.ctx.currentTime + 0.005, 0.1, { wave: 'square', vol: 0.05 }); }, onDone: (r, mg) => { mg.lineRes.t = r.t; } }));
      } else {
        const label = this.style === 'flip' ? 'めくりの間' : this.style === 'utaneta' ? '歌い上げ' : line.beat === 'ochi' ? 'オチの間' : '笑いどころの間';
        const zone = this.style === 'utaneta' ? [0.75, 0.96] : line.beat === 'ochi' ? [0.66, 0.92] : [0.55, 0.82];
        out.push(new HoldTask({ label, zone, fill: this.style === 'utaneta' ? 76 : 58, onDone: (r, mg) => {
          mg.lineRes.t = r.t;
          mg.popup({ perfect: 'PERFECT!', good: 'GOOD!', late: '間延び…', early: '早い！', stiff: '間延び…' }[r.grade], 548, 96, r.grade === 'perfect' ? COLORS.accent : r.grade === 'good' ? COLORS.good : COLORS.dim, 18);
          if (mg.style === 'flip' && mg.page) { mg.page.open = true; mg.page.t = 0; mg.g.sfx('shutter'); }
        } }));
      }
    }
    return out;
  }
  startType() {
    const ln = this.cur;
    if (this.style === 'flip') {
      if (ln.flipCue === 'フリップ') this.page = { setup: ln.board || ln.text, punch: null, open: false, t: 0 };
      if (ln.punch && this.page && !this.page.open) { this.page.open = true; this.page.t = 0; }
      if (ln.punch && this.page) this.page.punch = ln.board || ln.text;
    }
    if (this.style === 'utaneta' && this.idx >= 0) audio.bgm('utaneta_backing');
    super.startType();
  }
  nextLine() {
    super.nextLine();
    if (this.style === 'utaneta' && this.state !== 'closing') audio.bgm('utaneta_backing');
  }
  headPos() { return { x: this.px + 32, y: 204 }; }
  speakerName(line) { return line.char || this.members[this.pi].short; }
  tickFx(inp) {
    super.tickFx(inp);
    if (this.page) this.page.t++;
  }
  drawStage(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    const off = Math.round((this.enter || 0) * 340);
    const x = this.px + off;
    S.shadowAt(ctx, x + 32, S.FEET_Y);
    const talking = this.speaking === this.pi && Math.floor(this.talkT / 4) % 2 === 0;
    const bow = this.bowT > 0 && this.bowT < 50 ? 4 : 0;
    let dir = this.enter > 0 ? 'left' : 'down';
    if (this.style === 'flip' && this.task instanceof HoldTask) dir = 'right';
    S.drawActor(ctx, this.sheets[this.pi], { x, feet: S.FEET_Y + bow, dir, talk: talking, bob: Math.floor(this.pt / 30) % 2 ? 2 : 0 });
    if (this.style === 'mandan' || this.style === 'monomane' || this.style === 'utaneta') S.drawMic(ctx, x + 32 + 34, S.FEET_Y);
    if (this.style === 'utaneta' && this.state !== 'closing' && this.idx >= 0) {
      for (let k = 0; k < 3; k++) { const nx = x + 90 + k * 26, ny = 196 - ((this.pt * 0.6 + k * 20) % 60); text(ctx, k % 2 ? '♪' : '♫', nx, ny, { size: 16, color: '#ffd23f', outline: '#3a1a00' }); }
    }
    if (this.style === 'flip') {
      const pg = this.page;
      const lines = !pg ? ['（フリップ）'] : pg.open && pg.punch ? wrap(ctx, pg.punch, 196, 18).slice(0, 4) : wrap(ctx, pg.setup || '', 196, 18).slice(0, 4);
      const flipAnim = pg && pg.open && pg.t < 8;
      if (flipAnim) {
        S.drawFlipBoard(ctx, 330, 120, 216, 110, [], { easel: true });
        const hgt = Math.round(110 * (1 - pg.t / 8));
        rect(ctx, 330, 120 - (110 - hgt), 216, Math.max(2, 110 - hgt), '#e8e2d0');
      } else S.drawFlipBoard(ctx, 330, 120, 216, 110, lines, { easel: true, size: 18, color: pg && pg.open ? '#c0182c' : '#1a1a28' });
    }
    if (this.style === 'solo') { const dim = 1 - this.light; if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${0.92 * dim})`; ctx.fillRect(0, S.HUD_H, SW, S.AUD_Y - S.HUD_H); } }
  }
  hint() {
    if (this.style === 'monomane') return ['up', 'down', 'で声を合わせる　笑いどころは', 'A', '長押し'];
    if (this.style === 'utaneta') return ['リズムに合わせて', 'A', '　歌い上げは', 'A', '長押し'];
    return ['笑いどころは', 'A', '長押しで間をため、ゾーンではなす　', 'right', '早口'];
  }
}

registerMinigame('pinneta', PinNeta);
