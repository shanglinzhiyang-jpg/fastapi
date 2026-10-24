// minigame 'conte' (owner: C) — コント on a set (perform_base.js). The act's real script line by line:
//   明転 → 役に入る (A when the ring meets the circle: how well you become the character) → the scene:
//   your 笑いどころ: hold A for the 間, release in the zone; 裏切り (the reveal) has a narrower zone and a bigger payoff;
//   小道具 lines: A on the beat to use the prop (miss = 落とした); the 相方's ボケ: A for your ツッコミ (if you play the
//   straight role); after the last laugh: 暗転 — A when the laugh is at its peak/just turning (too early cuts the
//   laugh, too late = 間延び). Shared: 笑い待ち (A), 噛み/飛び (B), → 早口.
// opts: as manzai (neta, venue, contest, length, lesson, practice, partner/partnerLook, role, noPick …) plus
//   setting ('office'|'taxi'|'hospital'|'school'|'konbini'|'generic' — else from the ネタ's setting/theme),
//   scenes (legacy acting scenes [{ title }]: a title that matches a built-in コント picks it).

import { registerMinigame, COLORS, text } from '../engine/minigame.js';
import { registerSong, audio } from '../engine/audio.js';
import { SW, clamp } from '../engine/util.js';
import { rect } from '../engine/draw.js';
import { PerformGame, WindowTask, HoldTask, RingTask, BeatTask, BlackoutTask, WaitTask, S } from '../engine/perform_base.js';
import { bankNeta, BANK } from '../engine/perform_bank.js';

registerSong('conte_jingle', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'E5 . G5 . A5 G5 E5 . | D5 . E5 G5 . . . . | C5 . E5 . G5 A5 C6 . | B5 A5 G5 . E5 . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | E2 . B2 . E2 . G#2 .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h h' },
  ],
});

const SET_OF = [
  [/コンビニ|レジ|店員|スーパー|お店/, 'konbini'], [/面接|会社|オフィス|上司|部長|社長|会議/, 'office'], [/タクシー|運転|車/, 'taxi'],
  [/病院|医者|診察|患者|看護/, 'hospital'], [/学校|教室|先生|転校|授業|生徒/, 'school'],
];
export function setOf(neta, opts = {}) {
  if (opts.setting && SETS_OK.has(opts.setting)) return opts.setting;
  const s = neta ? `${neta.setting || ''} ${neta.theme || ''} ${neta.title || ''}` : '';
  if (neta && SETS_OK.has(neta.setting)) return neta.setting;
  for (const [re, k] of SET_OF) if (re.test(s)) return k;
  return 'generic';
}
const SETS_OK = new Set(['office', 'taxi', 'hospital', 'school', 'konbini', 'generic']);
const POS = { a: 216, b: 372 };



class Conte extends PerformGame {
  static title = 'コント';
  static kind = 'conte';
  static skill = 'engi';
  static bgm = 'conte_jingle';

  houseNeta() {
    const o = this.opts;
    let title = o.houseTitle;
    if (!title && Array.isArray(o.scenes)) {
      for (const sc of o.scenes) {
        const t = String((sc && sc.title) || '');
        const hit = BANK.CONTE.find((c) => t.includes(c.title) || (c.title === '転校生' && /転校生/.test(t)) || (c.title === '病院' && /医者|病院/.test(t)) || (c.title === 'タクシー' && /タクシー|運転/.test(t)) || (c.title === '面接' && /面接|新入社員|会社/.test(t)));
        if (hit) { title = hit.title; break; }
      }
    }
    return bankNeta('conte', { rng: this.rng, title });
  }
  howto() {
    return [
      '明転したら、輪が重なった瞬間に A で「役に入る」',
      '自分の笑いどころは A 長押しで間をため、ゾーンではなす（裏切りは特にシビア）',
      '相方のボケには A でツッコミ。小道具はリズムよく A。最後は笑いのピークで A で暗転！',
    ];
  }
  stageType() { return 'conte'; }
  makeIntroBg() { return S.backdrop('conte', { setting: setOf((this.choices[this.choiceIdx] || {}).neta, this.opts) }); }

  setup() {
    this.setting = setOf(this.ctx.neta || { setting: this.ctx.setting, theme: this.ctx.theme, title: this.ctx.title }, this.opts);
    this.bg = S.backdrop('conte', { setting: this.setting });
    const mem = this.members;
    this.pos = mem.map((m, i) => ({ x: mem.length === 1 ? 288 : m.role === 'boke' ? POS.a : POS.b, dir: 'down' }));
    this.light = 0;
    this.dark = false;
    this.inRole = false;
    this.props = [];
    this.knock = 0;
    this.slap = null;
    this.actMult = 1;
    // the script's own closing stage direction is played by the 暗転 task
    const last = this.lines[this.lines.length - 1];
    if (last && last.who < 0 && /暗転/.test(last.text)) last.consumed = true;
  }
  openingTasks() {
    return [
      new WaitTask({ frames: 50, tick: (mg, t) => { mg.light = Math.min(1, t / 40); if (t === 2) mg.g.sfx('door'); } }),
    ];
  }
  closingTasks() {
    return [
      new BlackoutTask({ label: '暗転', onDone: (r, mg) => {
        mg.dark = true;
        mg.g.sfx('drum');
        const pts = { perfect: 3, good: 1.5, early: -2, late: -1.5 }[r.grade] ?? 0;
        mg.show.craft(pts, 'anten', r.grade === 'perfect' ? '暗転のタイミングが完璧だった' : r.grade === 'early' ? '暗転が早すぎて、笑いを切ってしまった' : null);
        mg.popup({ perfect: 'キレイな暗転！', good: '暗転', early: '暗転が早い！', late: '暗転が遅い…' }[r.grade], 320, 150, r.grade === 'perfect' ? COLORS.accent : r.grade === 'good' ? COLORS.good : COLORS.bad, 18);
      } }),
      new WaitTask({ frames: 70, tick: (mg, t) => { mg.light = Math.max(0, 1 - t / 12); if (t === 20) { mg.g.sfx('applause'); mg.clapAll = true; mg.wave = Math.max(mg.wave, 0.6); } }, done: (mg) => { mg.clapAll = false; } }),
    ];
  }

  // --- the player's part
  respTo(line) { return line.respIdx != null ? this.lines[line.respIdx] : null; }
  expectsPress(line) { const r = this.respTo(line); return !!(line.punch && r && r.who === this.pi && line.who !== this.pi); }
  beforeTasks(line) {
    const out = [];
    if (line.who === this.pi && !this.inRole) {
      this.inRole = true;
      const ch = line.char || 'この役';
      out.push(new RingTask({ label: '役に入る', prompt: `A で「${ch}」になりきる`, win: Math.round(this.ease(56, 0.3)), onDone: (r, mg) => {
        mg.actMult = { perfect: 1.1, good: 1.0, early: 0.9, late: 0.9, miss: 0.85 }[r.grade] ?? 1;
        mg.show.craft(r.grade === 'perfect' ? 2 : r.grade === 'good' ? 1 : -1.5, 'yaku', r.grade === 'perfect' ? `「${ch}」の役に完璧に入った（演技力）` : r.grade === 'miss' || r.grade === 'early' || r.grade === 'late' ? '役に入りきれず、照れが出た（演技力）' : null);
        mg.popup({ perfect: 'なりきった！', good: '役に入った', early: '照れが出た…', late: '照れが出た…', miss: '入りきれない…' }[r.grade], 320, 150, r.grade === 'perfect' ? COLORS.accent : r.grade === 'good' ? COLORS.good : COLORS.bad, 18);
      } }));
    }
    if (line.prop) {
      if (line.who === this.pi) {
        out.push(new BeatTask({ label: `小道具「${line.prop}」`, beats: 1, interval: 30, lead: 36, onDone: (r, mg) => {
          const ok = r.acc >= 0.45;
          mg.props.push({ name: line.prop, who: line.who, t: 0, ok });
          mg.lineRes.mult = (mg.lineRes.mult ?? 1) * (r.acc >= 0.75 ? 1.12 : ok ? 1 : 0.78);
          if (!ok) { mg.show.craft(-1, 'prop', `小道具「${line.prop}」をうまく扱えなかった`); mg.g.sfx('buzz'); mg.popup('小道具を落とした！', 520, 120, COLORS.bad, 16); }
          else { mg.g.sfx('ok'); mg.popup('小道具バッチリ！', 520, 120, COLORS.good, 16); }
        } }));
      } else this.props.push({ name: line.prop, who: line.who, t: 0, ok: true });
    }
    if (line.punch && line.who === this.pi) {
      const twist = line.twist;
      const zone = twist ? [0.72, 0.9] : line.beat === 'ochi' ? [0.68, 0.94] : [0.55, 0.82];
      out.push(new HoldTask({ label: twist ? '裏切りの間' : line.beat === 'ochi' ? 'オチの間' : 'ボケの間', zone, fill: 60, onDone: (r, mg) => {
        mg.lineRes.t = r.t;
        if (twist) {
          mg.lineRes.mult = (mg.lineRes.mult ?? 1) * (r.grade === 'perfect' ? 1.25 : r.grade === 'good' ? 1.08 : 0.82);
          if (r.grade === 'perfect') mg.show.craft(1.5, 'twist', '裏切りの瞬間、客席がどよめいた');
        }
        mg.gradePop(r.grade);
      } }));
    }
    return out;
  }
  afterTasks(line) {
    if (this.expectsPress(line)) return [new WindowTask({ label: 'ツッコミ', win: this.win, early: this.earlyPress, onDone: (r, mg) => { mg.lineRes.respT = r.t; mg.lineRes.respGrade = r.grade; mg.gradePop(r.grade); } })];
    return [];
  }
  gradePop(grade) {
    const lab = { perfect: 'PERFECT!', good: 'GOOD!', late: 'LATE…', early: '早い！', miss: 'スルー…', stiff: '間延び…' }[grade];
    const col = { perfect: COLORS.accent, good: COLORS.good, late: COLORS.cyan, early: COLORS.bad, miss: COLORS.dim, stiff: COLORS.dim }[grade];
    if (lab) this.popup(lab, 548, 96, col, grade === 'perfect' ? 22 : 18);
    if (grade === 'perfect' || grade === 'good') this.g.sfx('good');
  }
  onResponse(punch, resp, grade) {
    const miss = resp.who === this.pi && (grade === 'miss' || grade === 'early');
    const hp = this.headPos(resp.who);
    this.burst = { text: miss ? '……' : resp.text, t: 0, x: hp.x + (this.pos[resp.who].x > 300 ? 90 : -60), y: 166, weak: miss || grade === 'late' };
    if (!miss) { this.slap = { t: 0, who: resp.who, target: punch.who }; this.g.sfx('hit'); }
  }
  tickFx(inp) {
    super.tickFx(inp);
    if (this.slap) { this.slap.t++; if (this.slap.t === 4) { this.knock = 1; this.shakeT = Math.max(this.shakeT, 3); } if (this.slap.t > 26) this.slap = null; }
    if (this.knock > 0) this.knock = Math.max(0, this.knock - 0.06);
    for (const p of this.props) p.t++;
    this.props = this.props.filter((p) => p.t < 200);
  }
  speakerName(line) {
    const m = this.members[line.who];
    if (!line.char) return m ? m.short : '';
    return line.who === this.pi ? `${line.char}（${m.short}）` : line.char;
  }
  headPos(who) { const p = this.pos ? this.pos[who] : null; return p ? { x: p.x + 32, y: 204 } : { x: SW / 2, y: 204 }; }

  drawStage(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    for (let i = 0; i < this.members.length; i++) S.shadowAt(ctx, this.pos[i].x + 32, S.FEET_Y);
    for (let i = 0; i < this.members.length; i++) {
      const p = this.pos[i];
      let x = p.x;
      let dir = 'down';
      if (this.members.length > 1) dir = this.speaking === i || (this.slap && this.slap.who === i) ? (p.x < 300 ? 'right' : 'left') : 'down';
      if (this.slap && this.slap.target === i && this.knock > 0) x += Math.round(this.knock * 8) * (p.x < 300 ? -1 : 1);
      const talking = this.speaking === i && Math.floor(this.talkT / 4) % 2 === 0;
      S.drawActor(ctx, this.sheets[i], { x, feet: S.FEET_Y, dir, talk: talking, shout: this.slap && this.slap.who === i && this.slap.t < 14, bob: Math.floor((this.pt + i * 13) / 32) % 2 ? 2 : 0 });
    }
    // props in hand
    for (const pr of this.props) {
      const p = this.pos[pr.who];
      if (!p) continue;
      const px = p.x + (p.x < 300 ? 58 : -8), py = pr.ok ? 236 : 272 + Math.min(10, pr.t);
      S.roundBox(ctx, px - 22, py - 10, 44, 20, pr.ok ? '#fff6d8' : '#c8c0b0', S.INK, '#d8c8a0');
      let s = 12;
      text(ctx, pr.name.slice(0, 4), px, py - 7, { size: s, align: 'center', color: '#3a2a1a', shadow: null });
    }
    // lights
    const dim = 1 - this.light;
    if (dim > 0) { ctx.fillStyle = `rgba(0,0,0,${0.92 * dim})`; ctx.fillRect(0, S.HUD_H, SW, S.AUD_Y - S.HUD_H); }
  }
  hint() {
    const role = this.members[this.pi] ? this.members[this.pi].role : 'tsukkomi';
    return role === 'boke' ? ['自分のボケは', 'A', '長押しで間をため、ゾーンではなす　', 'right', '早口'] : ['相方のボケに', 'A', 'でツッコミ／自分の見せ場は', 'A', '長押し'];
  }
}

registerMinigame('conte', Conte);
