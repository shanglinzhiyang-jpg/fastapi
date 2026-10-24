// minigame 'manzai' (owner: C) — 漫才 on the センターマイク, the act's real script line by line (perform_base.js).
// The player's part follows their role in the unit (g.unit().members):
//   ツッコミ: A right after the 相方's ボケ (as tsukkomi.js, on the real script); A during the ボケ = 早い, A on a フリ = 余計
//   ボケ    : hold A before your ボケ to build the 間 and release in the zone; the 相方 answers by their stats
//   both    : 爆笑のあとは笑いが引きかけたところで A (被せる / ナイス間 / 間延び); 噛み・飛びには B でアドリブ／フォロー;
//             → 長押しで早口 (尺を稼ぐ／噛みやすい／走る)
// opts (besides CONTRACT4 perform opts): lines (legacy tsukkomi lines → the house script), partner, partnerLook,
//   dialect 'kansai'|'std', stage 'theater'|'studio'|'kinbyobu', role 'boke'|'tsukkomi', lesson, practice, neta, venue,
//   contest, length, noPick, preferOwn, quality (the house script's quality).
// A pin act performing 漫才 stands alone at the mic (漫談): every line is the player's.

import { registerMinigame, COLORS } from '../engine/minigame.js';
import { registerSong } from '../engine/audio.js';
import { SW } from '../engine/util.js';
import { PerformGame, WindowTask, HoldTask, WaitTask, S } from '../engine/perform_base.js';

registerSong('manzai_debayashi', {
  bpm: 144, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'G4 . C5 E5 G5 . E5 C5 | A4 . D5 F5 A5 . F5 D5 | G4 . C5 E5 G5 . C6 . | B5 A5 G5 F5 E5 . D5 . | E5 . G5 C6 . G5 E5 . | F5 . A5 D6 . A5 F5 . | G5 F5 E5 D5 C5 . G4 . | C5 - - . E5 . C5 .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | D3 . A3 . D3 . A3 . | C3 . G3 . E3 . G3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});

const TS_X = 344, BO_X = 232, SOLO_X = 288, MIC_X = 320;
const HOLD_ZONE = { boke: [0.55, 0.8], tendon: [0.5, 0.75], kaishu: [0.68, 0.94], ochi: [0.7, 0.96], tsukkomi: [0.25, 0.5] };

class Manzai extends PerformGame {
  static title = '漫才';
  static kind = 'manzai';
  static skill = 'warai';
  static bgm = 'manzai_debayashi';
  static howto = ['相方のボケが言い終わったら A でツッコミ！'];

  howto() {
    const role = this.introRole();
    const common = ['爆笑のあとは、笑いが引きかけたところで A（被せると笑いが減る）', '噛んだ・飛んだら B でアドリブ／フォロー。→長押しで早口（尺は稼げるが噛みやすい）'];
    if (role === 'boke') return ['あなたはボケ。自分のボケの前に A を長押しして「間」をため、緑のゾーンではなそう', ...common];
    if (role === 'pin') return ['ひとりでマイクの前に立つ漫談。オチの前は A 長押しで間をためて、ゾーンではなす', ...common];
    return ['あなたはツッコミ。相方のボケが言い終わったら A でツッコミ！（早すぎ・遅すぎ・フリへのツッコミはウケない）', ...common];
  }
  introRole() {
    if (this.opts.role) return this.opts.role;
    try {
      const u = typeof this.g.unit === 'function' ? this.g.unit() : null;
      const me = u && u.members && u.members.find((m) => m.id === 'player');
      if (u && u.type === 'pin' && !this.opts.partner) return 'tsukkomi';
      return me && me.role === 'boke' ? 'boke' : 'tsukkomi';
    } catch (e) { return 'tsukkomi'; }
  }
  stageType() {
    const o = this.opts;
    if (o.stage) return o.stage;
    const v = o.venue || {};
    if (v.size === 'tv' || (o.contest && v.size === 'hall')) return 'studio';
    return 'theater';
  }
  makeIntroBg() { return S.backdrop(this.stageType(), { sign: this.signText() }); }
  signText() { const o = this.opts; return (o.venue && o.venue.name) || (o.contest && o.contest.name) || o.title || '漫才'; }

  setup() {
    this.bg = S.backdrop(this.stageType(), { sign: this.signText() });
    const n = this.members.length;
    this.pos = this.members.map((m, i) => {
      if (n === 1) return { x: SOLO_X, dir: 'down' };
      if (n === 2) return { x: m.role === 'tsukkomi' ? TS_X : BO_X, dir: 'down' };
      return { x: [176, 264, 376][i] ?? 264, dir: 'down' };
    });
    this.entering = 1;
    this.knock = 0;
    this.slap = null;
    this.bowT = 0;
  }
  openingTasks() {
    return [new WaitTask({ frames: 70, tick: (mg, t) => { mg.entering = Math.max(0, 1 - t / 60); }, done: (mg) => { mg.entering = 0; mg.g.sfx('applause'); mg.wave = 0.35; } })];
  }
  closingTasks() {
    const last = this.lines[this.lines.length - 1];
    const thanked = last && /ありがとうございました/.test(last.text);
    return [
      new WaitTask({ frames: thanked ? 10 : 50, tick: (mg, t) => { if (t === 1 && !thanked) mg.bubble = S.makeBubble('どうも、ありがとうございましたー！', { tailX: MIC_X, tailY: 200, y: 44, cx: MIC_X }); } }),
      new WaitTask({ frames: 80, tick: (mg, t) => { mg.bowT = t; if (t === 4) mg.g.sfx('applause'); mg.clapAll = true; }, done: (mg) => { mg.clapAll = false; } }),
    ];
  }

  // --- the player's part
  respTo(line) { return line.respIdx != null ? this.lines[line.respIdx] : null; }
  expectsPress(line) {
    const r = this.respTo(line);
    return !!(line.punch && r && r.who === this.pi && line.who !== this.pi);
  }
  onStrayPress(line) {
    if (line.who >= 0 && line.who !== this.pi && this.members.length > 1 && !this.strayed) {
      this.strayed = true;
      this.show.h = Math.max(0.05, this.show.h - 0.03);
      this.popup('それはフリ！', 520, 120, COLORS.bad, 16);
      this.burst = { text: this.dialect === 'std' ? 'ツッコむとこじゃないよ！' : 'ツッコむとこちゃうで！', t: 0, x: this.headPos(line.who).x, weak: true };
      this.g.sfx('buzz');
    }
  }
  beforeTasks(line) {
    this.strayed = false;
    if (line.punch && line.who === this.pi) {
      const zone = HOLD_ZONE[line.beat] || HOLD_ZONE.boke;
      const label = line.beat === 'ochi' || line.beat === 'kaishu' ? 'オチの間' : line.beat === 'tsukkomi' ? 'ツッコミの間' : 'ボケの間';
      return [new HoldTask({ label, zone, fill: 58, onDone: (r, mg) => { mg.lineRes.t = r.t; mg.lineRes.grade = r.grade; mg.gradePop(r.grade); } })];
    }
    return [];
  }
  afterTasks(line) {
    const r = this.respTo(line);
    if (this.expectsPress(line)) {
      return [new WindowTask({ label: 'ツッコミ', win: this.win, early: this.earlyPress, onDone: (res, mg) => { mg.lineRes.respT = res.t; mg.lineRes.respGrade = res.grade; mg.gradePop(res.grade); } })];
    }
    return [];
  }
  gradePop(grade) {
    const lab = { perfect: 'PERFECT!', good: 'GOOD!', late: 'LATE…', early: '早すぎ！', miss: 'スルー…', stiff: '間延び…' }[grade];
    const col = { perfect: COLORS.accent, good: COLORS.good, late: COLORS.cyan, early: COLORS.bad, miss: COLORS.dim, stiff: COLORS.dim }[grade];
    if (lab) this.popup(lab, 548, 96, col, grade === 'perfect' ? 22 : 18);
    if (grade === 'perfect' || grade === 'good') this.g.sfx('good');
  }
  onResponse(punch, resp, grade) {
    // the ツッコミ: a shout burst + a slap when it lands
    const miss = resp.who === this.pi && (grade === 'miss' || grade === 'early');
    const txt = miss ? (grade === 'early' ? 'なん…' : '……') : resp.text;
    const hp = this.headPos(resp.who);
    this.burst = { text: txt, t: 0, x: hp.x + (resp.who === this.pi ? 120 : -40), y: 166, weak: miss || grade === 'late', size: grade === 'perfect' ? 22 : 20 };
    if (!miss) {
      this.slap = { t: 0, who: resp.who, target: punch.who };
      this.g.sfx('hit');
      this.voice(resp.who === this.pi);
    } else {
      this.g.sfx('cancel');
      this.later(26, () => {
        const say = grade === 'early' ? (this.dialect === 'std' ? '最後まで聞いてよ！' : '最後まで聞いてや！') : (this.dialect === 'std' ? '…ツッコんでよ！' : '…ツッコんでや！');
        this.makeLineBubble(punch, say, Infinity);
      });
    }
  }
  onLaugh(line, L) {}

  tickFx(inp) {
    super.tickFx(inp);
    if (this.slap) {
      this.slap.t++;
      if (this.slap.t === 4) { this.knock = 1; this.impact = 9; const p = this.pos[this.slap.target] || this.pos[0]; this.impactAt = { x: p.x + 32 + (this.pos[this.slap.who].x > p.x ? 14 : -14), y: 226 }; this.shakeT = Math.max(this.shakeT, 4); }
      if (this.slap.t > 30) this.slap = null;
    }
    if (this.knock > 0) this.knock = Math.max(0, this.knock - 0.05);
  }

  headPos(who) {
    const p = this.pos ? this.pos[who] : null;
    return p ? { x: p.x + 32, y: 204 } : { x: SW / 2, y: 204 };
  }

  drawStage(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    const off = Math.round(this.entering * this.entering * 340);
    for (let i = 0; i < this.members.length; i++) S.shadowAt(ctx, this.pos[i].x + 32 + off, S.FEET_Y);
    S.shadowAt(ctx, MIC_X, S.FEET_Y, 16);
    const order = this.members.map((_, i) => i).sort((a, b) => this.pos[a].x - this.pos[b].x);
    for (const i of order) {
      const p = this.pos[i];
      let x = p.x + off;
      let dir = 'down';
      let lean = 0;
      let shout = false;
      const s = this.slap;
      if (this.entering > 0) dir = 'left';
      if (s && s.who === i) {
        const tp = this.pos[s.target];
        dir = tp && tp.x < p.x ? 'left' : 'right';
        const lunge = s.t < 4 ? s.t / 4 : s.t < 16 ? 1 : Math.max(0, 1 - (s.t - 16) / 12);
        x += Math.round(lunge * 10) * (dir === 'left' ? -2 : 2) / 2;
        shout = s.t < 16;
      }
      if (s && s.target === i && this.knock > 0) {
        const other = this.pos[s.who];
        const away = other && other.x > p.x ? -1 : 1;
        x += Math.round(this.knock * this.knock * 10) * away;
        lean = Math.tan(this.knock * this.knock * 0.16) * -away;
      }
      const talking = this.speaking === i && Math.floor(this.talkT / 4) % 2 === 0;
      const bob = this.state === 'react' || this.entering > 0 ? 0 : Math.floor((this.pt + i * 15) / 30) % 2 ? 2 : 0;
      const bow = this.bowT > 0 && this.bowT < 60 ? (this.bowT < 30 ? 4 : 0) : 0;
      const holding = this.task instanceof HoldTask && i === this.pi && this.task.holding;
      S.drawActor(ctx, this.sheets[i], { x, feet: S.FEET_Y + bow, dir, talk: talking || (holding && Math.floor(this.pt / 10) % 2 === 0 ? false : false), shout, lean, bob: holding ? 0 : bob });
      if (holding) { ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.pt / 4); S.fillEllipse(ctx, x + 32, 196, 4, 4, '#ff7eb6'); ctx.globalAlpha = 1; }
    }
    S.drawMic(ctx, MIC_X, S.FEET_Y);
  }
  hint() {
    const role = this.members[this.pi] ? this.members[this.pi].role : 'tsukkomi';
    if (role === 'boke' || role === 'pin') return ['ボケの前は', 'A', '長押しで間をため、ゾーンではなす　', 'right', '早口'];
    return ['相方のボケのあとに', 'A', 'でツッコミ！　', 'right', '長押しで早口'];
  }
}

registerMinigame('manzai', Manzai);
