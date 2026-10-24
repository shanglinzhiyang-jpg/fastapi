// minigame 'ogiri' (owner: C) — 大喜利 (perform_base.js for the model, crowd, intro and result card).
// Every お題: ideas come to you one by one while the timer runs (発想力 decides how fast and how good; the ★ you
// see is your own hunch — with low 発想力 it can be wrong). ↑↓ choose an idea, → 練る (refine it: better, but it
// costs time), A answers with it. Modes (opts.mode):
//   'zabuton' (default) 演芸番組の大喜利: 司会 + 5 members on 座布団; members raise hands too; the 司会's verdict gives
//              座布団 (+1 / +2) or takes one away
//   'ippon'    IPPON-style: 5 judges' lamps; answer as often as you like before time runs out; 5 lamps = IPPON
//              (D2's IPPONグランプリ uses it: judges from g.contestJudges(contest.id) when available)
//   'flip'     フリップ大喜利: one answer per お題 written on a フリップ; hold A through the 振り and release to flip
// opts: rounds (お題の数, default 3), odai ([{ q, a: [[text, q0..100]] }]), scenes (legacy talk scenes
//   [{ prompt: 'お題：…', answers: [{ text, score }] }] — kept as the お題 and its ideas), neta (the player's 大喜利ネタ:
//   its theme/title is the first お題 and its answer lines are the ideas), venue, contest, lesson, practice, noPick.

import { registerMinigame, COLORS, text } from '../engine/minigame.js';
import { registerSong, audio } from '../engine/audio.js';
import { SW, SH, clamp, shade } from '../engine/util.js';
import { rect, measure, wrap } from '../engine/draw.js';
import { PerformGame, HoldTask, WaitTask, S } from '../engine/perform_base.js';
import { ODAI, bankNeta } from '../engine/perform_bank.js';
import { gauss } from '../engine/perform_model.js';

registerSong('ogiri_theme', {
  bpm: 128, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'C5 . D5 E5 G5 . E5 . | A5 . G5 E5 D5 . . . | C5 . D5 E5 G5 . A5 . | G5 E5 D5 C5 D5 . . . | E5 . G5 A5 C6 . A5 . | G5 . E5 D5 C5 . . .' },
    { wave: 'triangle', vol: 0.1, notes: 'C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | C3 . G3 . A2 . E3 . | G2 . D3 . G2 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k h h . s . h h' },
  ],
});

const PANELISTS = [
  { name: '松太郎', col: '#2f6fd0', look: { hair: 'bald', hairColor: 'black', skin: 'tan' } },
  { name: '竹蔵', col: '#2f9a4a', look: { hair: 'short', hairColor: 'black', skin: 'fair', glasses: true } },
  { name: '梅之助', col: '#d64161', look: { hair: 'slick', hairColor: 'brown', skin: 'fair' } },
  { name: '桜子', col: '#ff7eb6', look: { hair: 'bob', hairColor: 'black', skin: 'light' } },
  { name: '菊丸', col: '#ffd23f', look: { hair: 'spiky', hairColor: 'black', skin: 'tan' } },
];
const JUDGE_NAMES = ['松葉', '梅園', '竹林', '桜木', '菊池'];
const SEATS = [150, 245, 340, 435, 530]; // seated centres on the dais (zabuton mode)
const PLAYER_SEAT = 2;
const MC_LOOK = { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#3a2a1a', bottom: '#3a2a1a', jacket: true };

class Ogiri extends PerformGame {
  static title = '大喜利';
  static kind = 'ogiri';
  static skill = 'warai';
  static bgm = 'ogiri_theme';

  get mode() { return ['zabuton', 'ippon', 'flip'].includes(this.opts.mode) ? this.opts.mode : 'zabuton'; }
  houseNeta() { const n = bankNeta('ogiri', { rng: this.rng }); n.title = `おまかせ（お題${this.opts.rounds || 3}問）`; return n; }
  listKind() { return 'ogiri'; }
  howto() {
    const common = 'アイデアは時間とともに浮かぶ（★は自分の手応え）。↑↓で選び、→で練る（時間を使う）、Aで答える';
    if (this.mode === 'ippon') return [common, '制限時間内なら何度でも答えられる。審査員5人のランプが全部つけば IPPON！'];
    if (this.mode === 'flip') return [common, '答えはフリップに。A長押しで振りをため、ゾーンではなしてめくる'];
    return [common, 'ほかのメンバーより先に手を挙げよう。ウケれば座布団、スベると取られる…'];
  }
  makeIntroBg() { return S.backdrop(this.mode === 'zabuton' ? 'ogiri' : 'ippon', { sign: this.signText() }); }
  signText() { const o = this.opts; return (o.contest && o.contest.name) || (o.venue && o.venue.name) || (this.mode === 'ippon' ? '大喜利' : '大喜利'); }

  // ---------------------------------------------------------------- rounds
  buildOdai() {
    const o = this.opts;
    const n = clamp(Math.round(o.rounds || 3), 1, 6);
    const out = [];
    const ch = this.chosen;
    if (ch && ch.own && ch.neta) {
      const nt = ch.neta;
      const ans = (nt.lines || []).filter((l) => l && l.text && (l.beat === 'answer' || l.beat === 'boke' || l.role === 'pin'));
      if (ans.length) out.push({ q: nt.theme || nt.title || 'お題', a: ans.map((l) => [String(l.text), Number.isFinite(l.q) ? l.q : clamp(this.ctx.quality + gauss(this.rng) * 12, 5, 98)]) });
    }
    if (Array.isArray(o.odai)) for (const od of o.odai) if (od && od.q && Array.isArray(od.a)) out.push(od);
    if (Array.isArray(o.scenes)) {
      for (const sc of o.scenes) {
        if (!sc || !sc.prompt || !Array.isArray(sc.answers)) continue;
        out.push({ q: String(sc.prompt).replace(/^お題[:：]\s*/, ''), a: sc.answers.map((a) => [String(a.text), clamp(Math.round((Number(a.score) || 0) * 0.85 + 4), 3, 95)]) });
      }
    }
    const pool = ODAI.filter((od) => !out.some((x) => x.q === od.q));
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    return out.slice(0, Math.max(n, Math.min(out.length, n)));
  }
  setup() {
    this.odai = this.buildOdai();
    this.round = -1;
    this.bg = S.backdrop(this.mode === 'zabuton' ? 'ogiri' : 'ippon', { sign: this.signText() });
    this.zabuton = [0, 0, 0, 0, 0];
    this.ippons = 0;
    this.answers = 0;
    this.lamps = [0, 0, 0, 0, 0];
    this.lampT = 0;
    const g = this.g;
    let judges = null;
    if (this.opts.contest && typeof g.contestJudges === 'function') {
      try { judges = g.contestJudges(this.opts.contest.id); } catch (e) { judges = null; }
    }
    this.judges = (Array.isArray(judges) && judges.length ? judges.slice(0, 5).map((j) => ({ name: String(j.name || '審査員'), taste: (this.rng() - 0.5) * 0.16 })) : JUDGE_NAMES.map((name) => ({ name, taste: (this.rng() - 0.5) * 0.16 })));
    while (this.judges.length < 5) this.judges.push({ name: JUDGE_NAMES[this.judges.length], taste: 0 });
    const me = this.members[this.pi];
    this.pSheets = PANELISTS.map((p, i) => (i === PLAYER_SEAT ? S.sheetOf({ ...(me.look || {}), top: p.col, bottom: p.col, jacket: true }) : S.sheetOf({ ...p.look, top: p.col, bottom: p.col, jacket: true })));
    this.playerSheet = this.sheets[this.pi];
    this.mcSheet = S.sheetOf(MC_LOOK);
    this.hands = [0, 0, 0, 0, 0];
    this.speakingSeat = -1;
    this.flipText = null;
    this.flipOpen = 0;
    this.state = 'round';
  }
  openingTasks() { return [new WaitTask({ frames: 40, done: (mg) => { mg.g.sfx('applause'); mg.wave = 0.4; audio.stopBgm(); } })]; }

  updatePlay(inp) {
    this.st++;
    const due = this.sched.filter((e) => e.at <= this.pt);
    if (due.length) { this.sched = this.sched.filter((e) => e.at > this.pt); for (const e of due) e.fn(); }
    this.tickFx(inp);
    if (this.phase !== 'play') return;
    if (this.task) {
      let done = false;
      try { done = this.task.update(inp, this); } catch (e) { console.error(e); done = true; }
      if (done) { const t = this.task; this.task = null; if (t.o.onDone) t.o.onDone(t.result || {}, this); }
      return;
    }
    if (this.queue.length) { this.task = this.queue.shift(); this.task.start(this); return; }
    switch (this.state) {
      case 'opening': case 'round': this.nextRound(); break;
      case 'read': if (this.st > 70) this.startThink(); break;
      case 'think': this.updateThink(inp); break;
      case 'npc': if (this.st > 80) { this.bubble = null; this.speakingSeat = -1; this.setState('think'); } break;
      case 'answer': if (this.st > this.answerLen) this.afterAnswer(); break;
      case 'closing': this.setState('done'); this.end(); break;
      default: break;
    }
  }
  nextRound() {
    this.round++;
    this.bubble = null;
    this.flipText = null;
    this.flipOpen = 0;
    this.lamps = [0, 0, 0, 0, 0];
    if (this.round >= this.odai.length) {
      this.setState('closing');
      this.push(new WaitTask({ frames: 70, tick: (mg, t) => { if (t === 1) { mg.bubble = S.makeBubble(mg.mode === 'zabuton' ? `お後がよろしいようで。座布団は${mg.zabuton[PLAYER_SEAT]}枚！` : mg.mode === 'ippon' ? `終了！IPPONは${mg.ippons}本！` : 'お疲れさまでした！', { tailX: mg.mcPos().x, tailY: mg.mcPos().y, cx: 320, y: 40, name: '司会' }); mg.g.sfx('applause'); mg.clapAll = true; } }, done: (mg) => { mg.clapAll = false; } }));
      return;
    }
    const od = this.odai[this.round];
    this.od = od;
    // ideas: arrival order biased by 発想力 (a quick mind gets the good ones first)
    const hs = this.members[this.pi].s.hassou;
    const ideas = od.a.map(([t, q]) => ({ text: t, q: clamp(q, 0, 100), key: q * (0.3 + hs) + this.rng() * 60 }));
    ideas.sort((a, b) => b.key - a.key);
    this.pool = ideas.slice(0, 6);
    this.ideas = [];
    this.sel = 0;
    this.refining = null;
    this.answeredRound = 0;
    this.bubble = S.makeBubble(`お題「${od.q}」`, { tailX: this.mcPos().x, tailY: this.mcPos().y, cx: 320, y: 40, name: '司会', nameCol: '#6a5a8a', maxW: 460 });
    this.g.sfx('chime');
    this.setState('read');
  }
  mcPos() { return this.mode === 'zabuton' ? { x: 70, y: 160 } : { x: 600, y: 200 }; }
  startThink() {
    const hs = this.members[this.pi].s.hassou;
    const base = this.mode === 'ippon' ? 1080 : this.mode === 'flip' ? 660 : 620;
    this.thinkLen = Math.round(base * (1 + this.bonus * 0.15));
    this.thinkT = 0;
    this.nextIdea = 20;
    this.ideaGap = Math.round(clamp(92 - hs * 44, 40, 100));
    this.npcAt = this.mode === 'zabuton' ? [120 + Math.floor(this.rng() * 160), 330 + Math.floor(this.rng() * 160)] : [];
    this.setState('think');
    this.bubble = S.makeBubble(`お題「${this.od.q}」`, { cx: 320, y: 38, narr: true, maxW: 520, size: 16 });
  }
  hunch(q) {
    const hs = this.members[this.pi].s.hassou;
    return clamp(Math.round((q + gauss(this.rng) * (1 - hs) * 28) / 20), 1, 5);
  }
  updateThink(inp) {
    this.thinkT++;
    this.show.wait(1 / 30);
    if (this.thinkT >= this.nextIdea && this.pool.length) {
      const idea = this.pool.shift();
      idea.stars = this.hunch(idea.q);
      this.ideas.push(idea);
      if (this.ideas.length > 5) this.ideas.shift();
      this.nextIdea = this.thinkT + this.ideaGap;
      this.popup('ひらめき！', 470, 254, COLORS.accent, 14);
      if (audio.ctx && !audio.muted) audio.tone(1320, audio.ctx.currentTime + 0.005, 0.06, { wave: 'triangle', vol: 0.05 });
    }
    const n = this.ideas.length;
    if (n) {
      if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; audio.sfx('cursor'); }
      if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; audio.sfx('cursor'); }
      this.sel = clamp(this.sel, 0, n - 1);
    }
    // 練る: refine the selected idea (costs time)
    if (this.refining) {
      this.refining.t++;
      if (this.refining.t >= 70) {
        const idea = this.refining.idea;
        const hs = this.members[this.pi].s.hassou;
        const gain = Math.round(6 + hs * 14 + this.rng() * 6);
        idea.q = clamp(idea.q + gain, 0, 100);
        idea.stars = this.hunch(idea.q);
        idea.refined = (idea.refined || 0) + 1;
        if (idea.refined === 1) idea.text = refineText(idea.text);
        this.refining = null;
        this.popup('練り上がった！', 470, 254, COLORS.good, 14);
        audio.sfx('good');
      }
    } else if (inp.pressed('right') && n && !(this.ideas[this.sel].refined >= 2)) {
      this.refining = { idea: this.ideas[this.sel], t: 0 };
      audio.sfx('cursor');
    }
    // members raise their hands (zabuton)
    if (this.mode === 'zabuton') {
      for (let k = 0; k < this.npcAt.length; k++) {
        if (this.thinkT === this.npcAt[k]) { this.npcAnswer(); return; }
      }
    }
    if (inp.pressed('a') && n && !this.refining) { this.answer(this.ideas[this.sel]); return; }
    if (this.thinkT >= this.thinkLen) {
      if (this.mode === 'ippon' && this.answeredRound) { this.endRound(); return; }
      // time's up: the 司会 calls on you
      if (n) { this.popup('時間切れ！', 320, 150, COLORS.bad, 18); this.answer(this.ideas[this.sel], true); }
      else { this.popup('何も浮かばない…', 320, 150, COLORS.dim, 18); this.show.laugh({ i: this.round, who: this.pi, beat: 'answer', text: '…', q: 5 }, 0.2, { q: 5 }); this.silenceT = 60; this.endRound(); }
    }
  }
  npcAnswer() {
    const seats = [0, 1, 3, 4];
    const s = seats[Math.floor(this.rng() * seats.length)];
    this.hands[s] = 30;
    const used = new Set(this.ideas.map((i) => i.text));
    const cand = this.od.a.filter(([t]) => !used.has(t));
    const [t, q] = cand.length ? cand[Math.floor(this.rng() * cand.length)] : ['…パス！', 20];
    this.od.a = this.od.a.filter(([x]) => x !== t);
    this.pool = this.pool.filter((p) => p.text !== t);
    this.speakingSeat = s;
    this.bubble = S.makeBubble(t, { tailX: SEATS[s], tailY: 150, cx: SEATS[s], y: 70, name: PANELISTS[s].name, nameCol: shade(PANELISTS[s].col, -0.2) });
    const v = clamp((q / 100) * (0.6 + this.rng() * 0.6), 0, 1.2);
    this.later(30, () => {
      this.laughFx({ v: v * 0.8, cls: v > 0.7 ? 'laugh' : v > 0.4 ? 'kusu' : 'suberi' }, true);
      if (v > 0.6) { this.zabuton[s]++; this.popup('座布団一枚！', SEATS[s], 120, COLORS.accent, 14); }
    });
    this.setState('npc');
  }
  answer(idea, forced = false) {
    if (!idea) return;
    this.ideas = this.ideas.filter((x) => x !== idea);
    this.sel = 0;
    this.answers++;
    this.answeredRound++;
    const frac = this.thinkT / this.thinkLen;
    let t = 0.9 + (this.mode === 'zabuton' ? 0.12 * (1 - frac) : 0) - (forced ? 0.2 : 0);
    if (this.mode === 'zabuton') this.hands[PLAYER_SEAT] = 30;
    this.pending = { idea, t };
    const me = this.members[this.pi];
    if (this.mode === 'flip') {
      this.flipText = idea.text;
      this.flipOpen = 0;
      this.push(new HoldTask({ label: 'フリップをめくる間', zone: [0.6, 0.86], fill: 58, onDone: (r, mg) => { mg.pending.t = r.t; mg.flipOpen = 1; mg.g.sfx('shutter'); mg.resolveAnswer(); } }));
      this.setState('answerWait');
      return;
    }
    const pos = this.mode === 'zabuton' ? { x: SEATS[PLAYER_SEAT], y: 150 } : { x: 92, y: 200 };
    this.speakingSeat = PLAYER_SEAT;
    this.bubble = S.makeBubble(idea.text, { tailX: pos.x, tailY: pos.y, cx: pos.x, y: this.mode === 'zabuton' ? 70 : 60, name: me.short, nameCol: '#d64161', n: 0 });
    this.typing = { n: 0, len: this.bubble.total };
    this.setState('answerType');
  }
  resolveAnswer() {
    const { idea, t } = this.pending;
    const line = { i: this.answers, who: this.pi, beat: 'answer', text: idea.text, q: idea.q };
    const L = this.show.laugh(line, t, { q: idea.q });
    this.laughFx(L);
    this.lastL = L;
    if (this.mode === 'zabuton') {
      const d = L.cls === 'big' ? 2 : L.cls === 'laugh' ? 1 : L.cls === 'suberi' ? -1 : 0;
      this.later(40, () => {
        const before = this.zabuton[PLAYER_SEAT];
        this.zabuton[PLAYER_SEAT] = Math.max(0, before + d);
        const say = d >= 2 ? '座布団二枚！' : d === 1 ? '座布団一枚！' : d < 0 ? (before > 0 ? '座布団一枚、取って！' : '座布団…はもう無いね') : 'うーん、惜しい！';
        this.bubble = S.makeBubble(say, { tailX: this.mcPos().x, tailY: this.mcPos().y, cx: 160, y: 70, name: '司会', nameCol: '#6a5a8a' });
        if (d > 0) audio.sfx('coin'); else if (d < 0) audio.sfx('cancel');
      });
      this.answerLen = 110;
    } else if (this.mode === 'ippon') {
      const votes = this.judges.map((j) => (L.v + j.taste + gauss(this.rng) * 0.08 > 0.5 ? 1 : 0));
      this.lamps = [0, 0, 0, 0, 0];
      this.lampT = 0;
      this.voteQueue = votes;
      votes.forEach((v, k) => this.later(18 + k * 9, () => { this.lamps[k] = v; if (v) { if (audio.ctx && !audio.muted) audio.tone(880 + k * 110, audio.ctx.currentTime + 0.005, 0.08, { wave: 'square', vol: 0.05 }); } }));
      const yes = votes.reduce((a, b) => a + b, 0);
      this.later(18 + 5 * 9 + 6, () => {
        if (yes === 5) { this.ippons++; audio.sfx('fanfare'); this.flash = 30; this.popup('IPPON！', 320, 130, COLORS.accent, 32); this.show.craft(2, 'ippon', null); }
        else this.popup(`${yes}本`, 320, 130, yes >= 3 ? COLORS.good : COLORS.dim, 20);
      });
      this.answerLen = 120;
    } else {
      this.answerLen = 100;
    }
    this.setState('answer');
  }
  afterAnswer() {
    this.speakingSeat = -1;
    if (this.mode === 'ippon' && this.thinkT < this.thinkLen - 60) { this.bubble = S.makeBubble(`お題「${this.od.q}」`, { cx: 320, y: 38, narr: true, maxW: 520, size: 16 }); this.lamps = [0, 0, 0, 0, 0]; this.setState('think'); return; }
    this.endRound();
  }
  endRound() {
    if (this.ippons && this.mode === 'ippon') this.show.note('ippon', `IPPONを${this.ippons}本獲得`);
    if (this.mode === 'zabuton' && this.zabuton[PLAYER_SEAT] >= 3) this.show.note('zabuton', `座布団を${this.zabuton[PLAYER_SEAT]}枚積み上げた`);
    this.setState('round');
  }
  tickFx(inp) {
    super.tickFx(inp);
    for (let k = 0; k < 5; k++) if (this.hands[k] > 0) this.hands[k]--;
    if (this.flash > 0) this.flash--;
    if (this.state === 'answerType' && this.typing) {
      this.typing.n += 0.5;
      this.bubble.n = Math.floor(this.typing.n);
      if (this.bubble.n % 2 === 1) this.voice(true);
      if (this.typing.n >= this.typing.len) { this.bubble.n = Infinity; this.typing = null; this.resolveAnswer(); }
    }
  }
  end(score, comment) {
    super.end(score, comment);
    if (this.result) { this.result.zabuton = this.mode === 'zabuton' ? this.zabuton[PLAYER_SEAT] : undefined; this.result.ippon = this.mode === 'ippon' ? this.ippons : undefined; this.result.mode = this.mode; }
  }

  // ---------------------------------------------------------------- drawing
  drawStage(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    if (this.mode === 'zabuton') this.drawZabutonSet(ctx);
    else this.drawIpponSet(ctx);
  }
  drawZabutonSet(ctx) {
    // the 司会 at the desk
    S.drawActor(ctx, this.mcSheet, { x: 36, feet: 214, dir: 'right', talk: this.bubble && this.bubble.name === '司会' && Math.floor(this.pt / 5) % 2 === 0 });
    for (let s = 0; s < 5; s++) {
      const cx = SEATS[s];
      const stack = 1 + this.zabuton[s];
      S.drawZabuton(ctx, cx, 204, '#7a3a9a', Math.min(stack, 8));
      const lift = Math.min(stack - 1, 7) * 6;
      const sheet = this.pSheets[s];
      S.drawActor(ctx, sheet, { x: cx - 32, feet: 200 - lift, dir: 'down', seated: true, lap: PANELISTS[s].col, talk: this.speakingSeat === s && Math.floor(this.pt / 4) % 2 === 0 });
      if (this.hands[s] > 0) { rect(ctx, cx + 18, 130 - lift, 5, 16, S.INK); rect(ctx, cx + 19, 131 - lift, 3, 14, '#f6c9a0'); }
      if (s === PLAYER_SEAT) text(ctx, '▼', cx, 118 - lift, { size: 12, align: 'center', color: COLORS.accent, outline: '#000' });
    }
  }
  drawIpponSet(ctx) {
    // judges' booths with lamps
    if (this.mode === 'ippon') {
      for (let k = 0; k < 5; k++) {
        const x = 70 + k * 104, y = 52;
        S.roundBox(ctx, x, y, 84, 70, '#1a1e3c', S.INK, '#11142c');
        const on = this.lamps[k];
        S.fillEllipse(ctx, x + 42, y + 26, 18, 18, S.INK);
        S.fillEllipse(ctx, x + 42, y + 26, 16, 16, on ? '#ff6a3d' : '#3a2020');
        if (on) { S.fillEllipse(ctx, x + 38, y + 21, 5, 5, '#ffd0a0'); text(ctx, 'IPPON', x + 42, y + 20, { size: 11, align: 'center', color: '#ffffff', shadow: null }); }
        let nm = this.judges[k].name;
        let sz = 12;
        while (measure(ctx, nm, sz) > 76 && sz > 9) sz--;
        text(ctx, nm, x + 42, y + 50, { size: sz, align: 'center', color: '#c8cce6', shadow: null });
      }
      if (this.flash > 0) { ctx.fillStyle = `rgba(255,200,120,${this.flash / 60})`; ctx.fillRect(0, 0, SW, SH); }
    } else {
      S.drawActor(ctx, this.mcSheet, { x: 536, feet: 284, dir: 'left', talk: this.bubble && this.bubble.name === '司会' && Math.floor(this.pt / 5) % 2 === 0 });
    }
    // the player at the answer podium
    S.shadowAt(ctx, 92, 284);
    S.drawActor(ctx, this.playerSheet, { x: 60, feet: 284, dir: 'down', talk: this.state === 'answerType' && Math.floor(this.pt / 4) % 2 === 0 });
    rect(ctx, 62, 244, 60, 42, S.INK);
    rect(ctx, 64, 246, 56, 38, '#2a3070');
    rect(ctx, 64, 246, 56, 4, '#5a6ad0');
    S.fillEllipse(ctx, 92, 244, 9, 4, S.INK);
    S.fillEllipse(ctx, 92, 243, 7, 3, this.task || this.state === 'answerType' ? '#ff5d6c' : '#c03040');
    if (this.mode === 'flip' && (this.flipText || this.state === 'think')) {
      const open = this.flipOpen;
      const lines = open ? wrap(ctx, this.flipText, 190, 16).slice(0, 4) : ['（フリップ）'];
      S.drawFlipBoard(ctx, 220, 150, 210, 96, lines, { size: 16 });
    }
  }
  drawOver(ctx) {
    if (!['think', 'npc', 'answer', 'answerType', 'answerWait'].includes(this.state) && !this.task) return;
    if (!this.ideas) return;
    // the idea panel
    const x = this.mode === 'zabuton' ? 20 : 150, w = SW - x - 20, y = 246, h = 92;
    S.drawPanel(ctx, x, y, w, h, { gold: true });
    const left = Math.max(0, (this.thinkLen || 1) - (this.thinkT || 0));
    text(ctx, 'アイデア', x + 12, y + 6, { size: 13, color: '#ffe9a0', shadow: null });
    rect(ctx, x + 80, y + 10, Math.round((w - 200) * clamp(left / (this.thinkLen || 1), 0, 1)), 5, left > 180 ? '#5ee07a' : '#ff5d6c');
    text(ctx, `${Math.ceil(left / 60)}秒`, x + w - 110, y + 5, { size: 13, color: COLORS.text, shadow: null });
    if (this.mode === 'zabuton') text(ctx, `座布団 ${this.zabuton[PLAYER_SEAT]}枚`, x + w - 12, y + 5, { size: 13, align: 'right', color: COLORS.accent, shadow: null });
    else if (this.mode === 'ippon') text(ctx, `IPPON ${this.ippons}`, x + w - 12, y + 5, { size: 13, align: 'right', color: COLORS.accent, shadow: null });
    if (!this.ideas.length) { text(ctx, this.refining ? '' : '考え中…', x + 20, y + 30, { size: 14, color: COLORS.dim, shadow: null }); }
    this.ideas.slice(0, 4).forEach((idea, k) => {
      const yy = y + 24 + k * 16;
      const selk = k === this.sel;
      if (selk) rect(ctx, x + 6, yy - 1, w - 12, 16, 'rgba(255,210,63,0.16)');
      text(ctx, '★'.repeat(idea.stars) + '☆'.repeat(5 - idea.stars), x + 14, yy, { size: 11, color: selk ? COLORS.accent : '#a8906a', shadow: null });
      let t = idea.text;
      let s = 13;
      while (measure(ctx, t, s) > w - 110 && s > 10) s--;
      if (measure(ctx, t, s) > w - 110) { while (t.length > 4 && measure(ctx, t + '…', s) > w - 110) t = t.slice(0, -1); t += '…'; }
      text(ctx, t, x + 84, yy, { size: s, color: selk ? '#ffffff' : '#c8cce6', shadow: null });
      if (idea.refined) text(ctx, '練', x + w - 14, yy, { size: 11, align: 'right', color: COLORS.good, shadow: null });
    });
    if (this.refining) {
      rect(ctx, x + 84, y + h - 8, Math.round((w - 100) * (this.refining.t / 70)), 3, COLORS.good);
      text(ctx, '練っている…', x + 14, y + h - 14, { size: 11, color: COLORS.good, shadow: null });
    }
  }
  drawHudBar(ctx) {
    S.drawHud(ctx, { left: `お題 ${clamp(this.round + 1, 0, this.odai.length)}/${this.odai.length}`, heat: this.show.h, clock: null, right: this.mode === 'ippon' ? `IPPON ${this.ippons}` : this.mode === 'zabuton' ? `座布団 ${this.zabuton[PLAYER_SEAT]}` : `回答 ${this.answers}` });
  }
  hint() {
    if (this.state === 'think') return ['up', 'down', 'でえらぶ', 'right', 'で練る', 'A', 'で答える'];
    return ['お題をよく聞こう'];
  }
}
// a refined idea gets a sharper wording
function refineText(t) {
  if (/[」』]$/.test(t)) return t;
  if (/。$/.test(t)) return t;
  return t;
}

registerMinigame('ogiri', Ogiri);
