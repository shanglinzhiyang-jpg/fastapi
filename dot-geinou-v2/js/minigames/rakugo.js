// minigame 'rakugo' (owner: C) — 落語 on the 高座 (perform_base.js):
//   出囃子 → 高座への登場 (walk in from 下手, sit on the 座布団) → お辞儀 (hold A while the applause rolls, release as
//   it settles) → まくら: read the room — today's 客層 is shown, pick the topic that fits (↑↓ + A) → 本題: every time
//   another character speaks, 上下を切る — → for a character speaking to a 目上 (faces 上手), ← for the 目上 (faces
//   下手); wrong/late = the audience loses track → 仕草 (扇子で蕎麦をすする, まんじゅうを食べる …: A on the beats) →
//   サゲ: hold A for the 間, release in the zone → お辞儀. 上方 (kamigata: opts.kamigata or dialect 'kansai' at an
//   Osaka venue) adds the 見台・膝隠し・小拍子 (小拍子 clacks at scene changes).
// opts: CONTRACT4 perform opts + audience ('elder'|'young'|'family'|'tsuu'|'first' — the 客層; else by venue),
//   kamigata, makura (false = skip), noPick …

import { registerMinigame, COLORS, text } from '../engine/minigame.js';
import { registerSong, audio } from '../engine/audio.js';
import { SW, clamp, shade } from '../engine/util.js';
import { rect } from '../engine/draw.js';
import { PerformGame, HoldTask, ArrowTask, ChoiceTask, BeatTask, WaitTask, S } from '../engine/perform_base.js';
import { MAKURA, CROWD_TYPES, makuraLines } from '../engine/perform_bank.js';

registerSong('rakugo_debayashi', {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'E5 . E5 B4 . E5 F#5 . | A5 . F#5 E5 . B4 . . | E5 . F#5 A5 . B5 A5 . | F#5 E5 . B4 . E5 . . | D5 . E5 F#5 . E5 D5 . | B4 . . A4 . B4 . . | E5 . F#5 . A5 . F#5 E5 | E5 - - . . . . .' },
    { wave: 'square', vol: 0.02, notes: 'E4 . . . B3 . . . | E4 . . . B3 . . . | A3 . . . E4 . . . | B3 . . . E4 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k . . h . . s . | k . h . . k s .' },
  ],
});

const KIMONO = ['#2f3a5a', '#4a3a2a', '#3a4a3a', '#5a2a3a', '#2a2a2a', '#4a4a6a'];
const SEAT_X = 288; // the sprite's left edge when seated (centre 320)
const FEET = 228; // seated: the lap rests on the 高座

class Rakugo extends PerformGame {
  static title = '落語';
  static kind = 'rakugo';
  static skill = 'talk';
  static bgm = 'rakugo_debayashi';

  howto() {
    return [
      '出囃子で高座へ。お辞儀は A 長押し、拍手が収まってきたら離す',
      'まくら：今日の客層に合う話題を選ぶ（↑↓＋A）',
      '本題：話す人物が変わったら上下を切る。→＝目上に話す人（上手を向く）／←＝目上の人（下手を向く）',
      '仕草はリズムよく A、サゲは A 長押しで間をため、ゾーンではなす',
    ];
  }
  kamigata() { return !!(this.opts.kamigata || (this.opts.dialect === 'kansai' && this.opts.venue && /大阪|なんば|天満|上方|関西/.test(this.opts.venue.name || ''))); }
  makeIntroBg() { return S.backdrop('yose', { sign: this.koza(), kamigata: this.kamigata() }); }
  koza() { const st = this.g.state || {}; return this.opts.koza || st.name || '落語'; }

  setup() {
    this.kami = this.kamigata();
    this.bg = S.backdrop('yose', { sign: this.koza(), kamigata: this.kami });
    const me = this.members[this.pi];
    const look = me.look || {};
    let hsh = 0;
    for (const ch of String(me.name || '')) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    this.kimono = KIMONO[hsh % KIMONO.length];
    this.sheet = S.sheetOf({ ...look, top: this.kimono, bottom: this.kimono, jacket: true, tie: undefined, skirt: false });
    this.sheets[this.pi] = this.sheet;
    this.face = 'down';
    this.walk = 0; // 0..1 walking in
    this.seated = false;
    this.bowing = 0;
    this.gesture = null;
    this.switches = 0;
    // 客層
    const v = this.opts.venue || {};
    const pool = v.size === 'small' ? ['elder', 'tsuu', 'family'] : v.size === 'tv' ? ['first', 'young', 'family'] : ['elder', 'young', 'family', 'tsuu', 'first'];
    this.audience = CROWD_TYPES[this.opts.audience] ? this.opts.audience : pool[Math.floor(this.rng() * pool.length)];
    // the ネタ's own written まくら gives way to the one chosen for today's room (opts.makura === false keeps it)
    if (this.opts.makura !== false && this.lines.some((l) => l.beat === 'makura')) {
      this.lines = this.lines.filter((l) => l.beat !== 'makura');
      this.ctx.lines = this.lines;
      this.lines.forEach((l, i) => { l.i = i; l.respIdx = null; l.resp = false; });
    }
    // the first サゲ line is the punch; what follows (「おあとがよろしいようで」) is the closing bow
    let sage = false;
    for (const l of this.lines) {
      if (l.beat !== 'sage') continue;
      if (!sage && l.who >= 0) { l.punch = true; sage = true; } else { l.punch = false; l.closing = true; }
    }
  }
  speakerName(line) { return line.char || (line.who < 0 ? '' : this.members[this.pi].short); }
  headPos() { return { x: 320, y: 186 }; }
  makeLineBubble(ln, str, n) {
    if (ln.who < 0 || (!ln.side && !ln.char)) {
      // 地の語り: the narrator's voice (the performer facing front)
      this.bubble = S.makeBubble(str, { tailX: 320, tailY: 186, cx: 320, y: 40, name: ln.who < 0 ? '地' : null, nameCol: '#6a6a8a', n, maxW: 440, size: 16 });
      return;
    }
    const left = ln.side === 'shimo';
    this.bubble = S.makeBubble(str, { tailX: left ? 300 : 340, tailY: 186, cx: left ? 230 : 410, y: 44, name: this.speakerName(ln), nameCol: left ? '#5a7ad0' : '#d0645a', n, maxW: 360 });
  }

  openingTasks() {
    const tasks = [
      new WaitTask({ frames: 80, tick: (mg, t) => { mg.walk = Math.min(1, t / 70); } , done: (mg) => { mg.seated = true; mg.g.sfx('drum'); } }),
      new WaitTask({ frames: 14, tick: (mg, t) => { if (t === 1) { mg.g.sfx('applause'); mg.wave = 0.9; mg.waveDecay = 0.008; mg.clapAll = true; } } }),
      new HoldTask({ label: 'お辞儀', zone: [0.6, 0.9], fill: 70, waitMax: 90, onDone: (r, mg) => {
        mg.clapAll = false;
        mg.bowing = 0;
        const pts = { perfect: 2, good: 1, early: -1, late: -0.5, stiff: -1 }[r.grade] ?? 0;
        mg.show.h = clamp(mg.show.h + pts * 0.02, 0.05, 1);
        mg.show.craft(pts * 0.5, 'ojigi', r.grade === 'perfect' ? 'お辞儀ひとつで客席の空気をつかんだ' : null);
        mg.popup({ perfect: '見事なお辞儀', good: 'お辞儀', early: '頭を上げるのが早い', late: '長すぎるお辞儀', stiff: 'ぎこちない…' }[r.grade], 320, 150, pts > 0 ? COLORS.good : COLORS.dim, 16);
        audio.stopBgm();
      } }),
    ];
    if (this.opts.makura !== false) tasks.push(...this.makuraTasks());
    return tasks;
  }
  makuraTasks() {
    // three topics; the 客層 decides how each lands
    const pool = MAKURA.slice();
    const pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    const aud = CROWD_TYPES[this.audience];
    return [new ChoiceTask({ title: `まくら：今日は${aud.label}`, options: pick.map((m) => ({ label: m.label })), win: 480, onDone: (r, mg) => {
      const m = pick[r.i] || pick[0];
      const fit = m.fit[mg.audience] ?? 0;
      mg.makuraFit = fit;
      mg.addExec((fit + 2) / 4);
      const lines = makuraLines(m, mg.ctx.era);
      const q = clamp(mg.ctx.quality * 0.5 + 30 + fit * 14, 5, 100);
      const add = lines.map((t, k) => ({ i: -1, who: mg.pi, role: 'pin', text: t, beat: k === lines.length - 1 ? 'boke' : 'makura', punch: k === lines.length - 1, resp: false, respIdx: null, sec: Math.max(1.2, Array.from(t).length / 5.2), side: null, char: null, q, makura: true }));
      mg.lines.splice(0, 0, ...add);
      mg.lines.forEach((l, i) => { l.i = i; if (l.respIdx != null) l.respIdx = l.respIdx + add.length; });
      // re-index response links of the 本題 after the insert (respIdx already shifted above for 本題 lines only)
      for (const l of add) l.respIdx = null;
      mg.show.h = clamp(mg.show.h + fit * 0.04, 0.05, 1);
      mg.popup(fit >= 2 ? 'ぴったりの話題！' : fit >= 1 ? '悪くない' : fit <= -1 ? '客層に合ってない…' : 'まずまず', 320, 150, fit >= 1 ? COLORS.good : fit <= -1 ? COLORS.bad : COLORS.dim, 18);
      if (fit >= 2) mg.show.note('makura', `まくらで${aud.short}の客席をつかんだ`);
      if (fit <= -1) mg.show.note('makuraMiss', `まくらの話題が客層（${aud.short}）に合わなかった`);
    } })];
  }
  closingTasks() {
    return [
      new WaitTask({ frames: 30, tick: (mg, t) => { mg.face = 'down'; } }),
      new WaitTask({ frames: 80, tick: (mg, t) => { mg.bowing = t < 50 ? 1 : 0; if (t === 4) { mg.g.sfx('applause'); mg.clapAll = true; mg.wave = Math.max(mg.wave, 0.6); } if (t === 30 && mg.kami) mg.clack(); }, done: (mg) => { mg.clapAll = false; } }),
    ];
  }
  clack() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.005;
    audio.noise(t, 0.05, { vol: 0.16, filter: 'bandpass', freq: 2400 });
    audio.tone(1800, t, 0.03, { wave: 'square', vol: 0.05 });
  }

  beforeTasks(line) {
    const out = [];
    // 上下を切る
    const want = line.who < 0 || !line.side ? 'down' : line.side === 'kami' ? 'right' : 'left';
    if (want !== 'down' && want !== this.face) {
      this.switches++;
      const reveal = this.switches <= 2;
      out.push(new ArrowTask({ label: `上下を切る：${line.char || (want === 'right' ? '上手を向く人物' : '下手を向く人物')}`, prompt: reveal ? (want === 'right' ? '→ 上手へ' : '← 下手へ') : 'どっち？', dirs: ['left', 'right'], answer: want, reveal, win: Math.round(this.ease(reveal ? 70 : 46, 0.35)), hint: ['話す人物に合わせて', 'left', 'right', '（→目上に話す人／←目上の人）'], onDone: (r, mg) => {
        if (r.ok) { mg.face = want; mg.g.sfx('cursor'); if (r.f < 18 && !mg.mixups) mg.show.craft(0.3, 'kamishimo', '上下の切り替えが鮮やかだった'); }
        else {
          mg.face = r.dir || mg.face;
          mg.lineRes.mult = 0.8;
          mg.show.h = Math.max(0.05, mg.show.h - 0.04);
          mg.mixups = (mg.mixups || 0) + 1;
          mg.show.hl = mg.show.hl.filter((h) => h.key !== 'kamishimo');
          if (mg.mixups === 2) mg.show.note('kamishimo-miss', '上下がこんがらがって、誰が話しているか伝わらなかった');
          mg.popup(r.miss ? '切り替えが遅い！' : '上下が逆！', 320, 150, COLORS.bad, 18);
          mg.g.sfx('buzz');
          mg.face = want;
        }
      } }));
    } else if (want === 'down') this.face = 'down';
    // 仕草
    if (line.gesture && line.who >= 0) {
      const G = { soba: ['蕎麦をすする', 4, 20], manju: ['まんじゅうを食べる', 3, 24], tegami: ['書きつける', 2, 28], sake: ['お茶をすする', 0, 0] }[line.gesture] || ['仕草', 2, 26];
      const onDone = (r, mg) => {
        mg.gesture = null;
        const good = (r.acc ?? (r.grade === 'perfect' ? 1 : r.grade === 'good' ? 0.75 : 0.3)) >= 0.6;
        if (line.punch) mg.lineRes.t = r.t ?? (good ? 0.95 : 0.5);
        else mg.lineRes.mult = good ? 1.05 : 0.9;
        mg.show.h = clamp(mg.show.h + (good ? 0.04 : -0.02), 0.05, 1);
        if (good) mg.show.craft(1, 'shigusa', `仕草（${G[0]}）が見事で、客席から「ほう」と声が出た`);
        mg.popup(good ? '見事な仕草！' : '仕草がぎこちない', 320, 150, good ? COLORS.good : COLORS.dim, 16);
      };
      if (G[1] > 0) {
        out.push(new BeatTask({ label: `仕草：${G[0]}`, beats: G[1], interval: G[2], lead: 40, start: null, sfx: (k) => mg2sfx(this, line.gesture), onDone }));
        this.gestureNext = line.gesture;
      } else {
        out.push(new HoldTask({ label: `仕草：${G[0]}`, zone: [0.55, 0.85], fill: 56, onDone }));
        this.gestureNext = line.gesture;
      }
    } else if (line.punch && line.who >= 0) {
      const sage = line.beat === 'sage';
      out.push(new HoldTask({ label: sage ? 'サゲの間' : line.makura ? 'まくらのオチ' : '笑いどころの間', zone: sage ? [0.7, 0.92] : [0.55, 0.82], fill: 60, onDone: (r, mg) => {
        mg.lineRes.t = r.t;
        mg.popup({ perfect: 'PERFECT!', good: 'GOOD!', late: '間延び…', early: '早い！', stiff: '間延び…' }[r.grade], 548, 96, r.grade === 'perfect' ? COLORS.accent : r.grade === 'good' ? COLORS.good : COLORS.dim, 18);
      } }));
    }
    if (line.who < 0 && this.kami && line.beat === 'tenkai') this.clack();
    return out;
  }
  startType() {
    if (this.gestureNext) { this.gesture = { kind: this.gestureNext, t: 0 }; this.gestureNext = null; }
    super.startType();
  }
  tickFx(inp) {
    super.tickFx(inp);
    if (this.gesture) { this.gesture.t++; if (this.gesture.t > 140) this.gesture = null; }
    if (this.task instanceof BeatTask && this.gestureNext) { this.gesture = { kind: this.gestureNext, t: 0 }; }
    if (this.task instanceof HoldTask && this.task.label === 'お辞儀') this.bowing = this.task.holding ? 1 : 0;
  }

  drawStage(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    const cx = 320;
    S.drawZabuton(ctx, cx, FEET + 2, '#6a2a8a', 1);
    if (!this.seated) {
      // walking in from 下手 (screen left)
      const x = Math.round(-60 + this.walk * (SEAT_X + 60));
      const f = Math.floor(this.pt / 8) % 3;
      S.shadowAt(ctx, x + 32, FEET + 2);
      S.drawActor(ctx, this.sheet, { x, feet: FEET + 2, dir: 'right', frame: f });
    } else {
      let dir = this.face;
      const talking = this.speaking === this.pi && Math.floor(this.talkT / 4) % 2 === 0;
      const bowY = this.bowing ? 8 : 0;
      S.drawActor(ctx, this.sheet, { x: SEAT_X, feet: FEET + bowY, dir, talk: talking, seated: true, lap: this.kimono });
      this.drawProps(ctx, dir, bowY);
    }
    if (this.kami) S.drawKendai(ctx, cx, FEET + 14);
    // 上下 legend
    if (this.seated) {
      const kami = [...new Set(this.lines.filter((l) => l.side === 'kami' && l.char).map((l) => l.char))].slice(0, 2).join('・');
      const shimo = [...new Set(this.lines.filter((l) => l.side === 'shimo' && l.char).map((l) => l.char))].slice(0, 2).join('・');
      if (shimo) { S.roundBox(ctx, 56, 196, 132, 22, 'rgba(40,60,120,0.85)', S.INK); text(ctx, `◀ ${shimo}`, 64, 200, { size: 12, color: '#ffffff', shadow: null }); }
      if (kami) { S.roundBox(ctx, 420, 196, 132, 22, 'rgba(120,50,40,0.85)', S.INK); text(ctx, `${kami} ▶`, 544, 200, { size: 12, align: 'right', color: '#ffffff', shadow: null }); }
    }
  }
  drawProps(ctx, dir, bowY) {
    const g = this.gesture;
    const hx = dir === 'left' ? 300 : dir === 'right' ? 340 : 320;
    const y = 214 + bowY;
    if (g && g.kind === 'soba') {
      // 扇子 as chopsticks, 手ぬぐい as the bowl; the noodles rise on each slurp
      const lift = Math.abs(Math.sin(g.t / 5)) * 10;
      S.drawTenugui(ctx, hx - 12, y + 6, { w: 22, h: 10, col: '#c8a060' });
      S.drawSensu(ctx, hx + (dir === 'left' ? -6 : 6), y + 4 - lift, { angle: -Math.PI / 2 + (dir === 'left' ? -0.4 : 0.4), len: 22 });
      for (let k = 0; k < 3; k++) rect(ctx, hx - 4 + k * 3, y - lift + 2, 1, lift + 4, '#f4e8c0');
    } else if (g && g.kind === 'manju') {
      S.fillEllipse(ctx, hx, y + 2 - Math.abs(Math.sin(g.t / 6)) * 6, 6, 5, S.INK);
      S.fillEllipse(ctx, hx, y + 2 - Math.abs(Math.sin(g.t / 6)) * 6, 5, 4, '#f4dcb0');
    } else if (g && g.kind === 'sake') {
      S.drawSensu(ctx, hx, y + 2, { open: true, angle: -Math.PI / 2 - 0.4 + Math.sin(g.t / 12) * 0.2, len: 16 });
    } else if (g && g.kind === 'tegami') {
      S.drawTenugui(ctx, hx - 14, y + 2, { w: 26, h: 16, col: '#f4f0e0' });
      S.drawSensu(ctx, hx + 10, y - 4, { angle: Math.PI * 0.75, len: 16 });
    } else {
      // resting: the 扇子 by the knee, the 手ぬぐい tucked
      S.drawSensu(ctx, 284, FEET - 4 + bowY, { angle: 0, len: 20 });
      S.drawTenugui(ctx, 344, FEET - 10 + bowY, { w: 14, h: 8, col: '#5a8ad0' });
    }
  }
  hint() { return ['人物が変わったら', 'left', 'right', 'で上下を切る　笑いどころは', 'A', '長押し']; }
}
function mg2sfx(mg, kind) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + 0.005;
  if (kind === 'soba') { audio.noise(t, 0.18, { vol: 0.09, filter: 'bandpass', freq: 900 }); audio.tone(300, t, 0.12, { wave: 'sine', vol: 0.04, slideTo: 600 }); }
  else audio.tone(500, t, 0.05, { wave: 'triangle', vol: 0.06 });
}

registerMinigame('rakugo', Rakugo);
