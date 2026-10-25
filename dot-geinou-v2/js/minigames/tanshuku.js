// minigame 'tanshuku' — はねるのトびら「短縮鉄道の夜」 (owner C / R7-E). API doc: test-output/api_tanshuku.txt
//
// The corner as it aired (第1夜 2007-04-11 … 第26夜 2009-06-24, はねるのトびら・フジテレビ): middle-aged salarymen ride a
// night train and learn the young people's 短縮言葉 from a young salaryman. In rhythm with the BGM the quizmaster calls
// a 短縮言葉; two beats later the next rider must say the original words. A wrong answer or no answer in time is a miss;
// two misses = アウト → a blast of 冷却ガス in the face; a rider who is out may 土下座 to ride on from リーチ.
// Here: 3 fictional riders + the player hold the straps; 5 stations + the 終点 (tempo up every station). The riders'
// gag name telops follow the show's style (「モリテツ｜森野鉄道」, and the player's own 「ドッテツ｜ドット鉄道」).
// Presentation: a portrait 9:16 TV frame (tanshuku_stage.js TvLayer — full screen on a portrait phone, side panels on a
// landscape screen), speechSynthesis voices, the original night-train chiptune on the game's beat clock.
// Input: ↑ → ← ↓ (or tap) pick one of four answers before the answer beat; optional answering by voice (マイク).
// opts: { year, practice, legs (2..6), difficulty, title, overlay (false = draw only in the game canvas) }

import { Minigame, registerMinigame } from '../engine/minigame.js';
import { audio } from '../engine/audio.js';
import { clamp, SW, SH, makeCanvas, mulberry32 } from '../engine/util.js';
import { LOOKS } from '../engine/sprites.js';
import * as T from '../engine/tanshuku_stage.js';
import { pickWords, optionsFor, isCorrect } from '../engine/tanshuku_words.js';
import { gameYM, onAirYM } from '../engine/tanshuku_air.js';

const { FW, FH, K, SET } = T;
export const STATIONS = ['宵の口', 'リャクゴ坂', 'モトドオリ', 'イイナオシ', '星見台', '天の川'];
const BPM = [104, 112, 120, 128, 136, 144];
const CAST = [
  { id: 'mori', name: '森野 大吾', tag: 'モリテツ', line: '森野鉄道', look: { ...LOOKS.salaryman, hair: 'short', hairColor: 'black', tie: '#d64161', glasses: true }, pitch: 0.75, rate: 1.25, skill: 0.86 },
  { id: 'kuro', name: '黒川 誠一', tag: 'クロテツ', line: '黒川鉄道', look: { ...LOOKS.salaryman, hair: 'slick', hairColor: 'black', top: '#2e3140', bottom: '#2e3140', tie: '#ffd23f' }, pitch: 1.15, rate: 1.3, skill: 0.82 },
  { id: 'hama', name: '浜岡 ひろし', tag: 'ハマテツ', line: '浜岡鉄道', look: { ...LOOKS.salaryman, hair: 'bald', hairColor: 'black', skin: 'tan', tie: '#2f6fd0', beard: true }, pitch: 0.9, rate: 1.15, skill: 0.78 },
];
const HOST = { name: '早瀬 透', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#3a4a7a', bottom: '#2a3560', jacket: true, tie: '#5fd7ff' }, pitch: 1.35, rate: 1.4 };
const SAY = { 'W杯': 'ダブルはい', 'Mステ': 'エムステ', 'MK5': 'エムケーファイブ', 'ドラ1': 'ドライチ', '月9': 'げつく', 'イッテQ': 'イッテキュー', 'セ・リーグ': 'セリーグ', 'パ・リーグ': 'パリーグ', '朝ドラ': 'あさドラ', 'りょ': 'りょ', 'KY': 'ケーワイ' };
const isTouch = () => typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch');
const KEY_OPT = { up: 0, right: 1, left: 2, down: 3 };
const OPT_GLYPH = ['↑', '→', '←', '↓'];

// the player's gag name telop on this corner
export const PLAYER_TETSU = Object.freeze({ tag: 'ドッテツ', line: 'ドット鉄道' });

class Tanshuku extends Minigame {
  static title = '短縮鉄道の夜';
  static howto = ['短縮言葉を、リズムに合わせて元に戻せ！'];
  static bgm = 'tanshuku_title';
  static skill = 'talk';
  static hd = true;

  constructor(g, opts = {}) {
    super(g, opts);
    this.fcv = makeCanvas(FW * K, FH * K);
    this.fctx = this.fcv[1];
    this.fctx.imageSmoothingEnabled = false;
    this.voice = new T.Voice();
    this.ears = new T.Ears();
    this.layer = null;
    this.acts = [];
    this.sc = T.makeScenery(11);
    this.year = Number(opts.year) || this.gameYear();
    const st = g.state || {};
    const me = PLAYER_TETSU;
    this.riders = [
      { ...CAST[0] }, { ...CAST[1] },
      { id: 'player', name: st.name || 'あなた', tag: me.tag, line: me.line, look: st.look || LOOKS.player, pitch: 1.0, rate: 1.25, player: true },
      { ...CAST[2] },
    ].map((r) => ({ ...r, misses: 0, out: false, sheet: T.sheetOf(r.look), frost: 0, dogeza: 0 }));
    this.hostSheet = T.sheetOf(HOST.look);
    this.legs = clamp(Math.round(opts.legs || STATIONS.length), 2, STATIONS.length);
    this.view = { t: 0 };
  }
  gameYear() { return gameYM(this.g).year; }

  // ---------------------------------------------------------------- setup
  init() {
    this.rng = mulberry32((Date.now() ^ (this.year * 131)) >>> 0);
    this.train = new T.Train();
    this.leg = 0;
    this.turn = -1;
    this.state = 'depart';
    this.st = 0;
    this.clock = 0;
    this.lastBeat = -1;
    this.lastStep = -1;
    this.scroll = 0;
    this.speed = 0;
    this.cam = { x: FW / 2, z: 1, tx: FW / 2, tz: 1 };
    this.used = new Set();
    this.word = null;
    this.prevWord = null;
    this.opts4 = [];
    this.sel = -1;
    this.selT = 0;
    this.cardFlip = 0;
    this.sub = null;
    this.nameTelop = null;
    this.bigTelop = null;
    this.flash = 0;
    this.sparks = [];
    this.confetti = [];
    this.wipe = 0;
    this.mode = 'station';
    this.correct = 0;
    this.just = 0;
    this.pMiss = 0;
    this.pOut = 0;
    this.usedDogeza = false;
    this.cleared = false;
    this.turnsPlayed = 0;
    this.playerTurns = 0;
    this.speak(HOST, '短縮鉄道の夜、まもなく発車いたします！');
  }
  // tempo: the station's BPM, a little faster on harder shows (difficulty 1..5)
  get bpm() { return (BPM[this.leg] || 120) + Math.max(0, this.diff - 2) * 4; }
  get diff() { return clamp(Math.round(Number(this.opts.difficulty) || 2), 1, 5); }
  get fpb() { return 3600 / this.bpm; }
  setState(s) { this.state = s; this.st = 0; }
  speak(who, str, o = {}) { this.voice.speak(str, { pitch: who.pitch, rate: who.rate, interrupt: o.interrupt }); }
  rider(i) { return this.riders[i]; }

  // ---------------------------------------------------------------- input from the TV layer
  onAct(a) {
    if (a === 'a-down') this.g.input.press('a', 'tvl');
    else if (a === 'a-up') this.g.input.release('a', 'tvl');
    else if (a === 'voice') this.voice.toggle();
    else if (a === 'mic') this.ears.toggle();
    else this.acts.push(a);
  }

  update(g) {
    this.view.t++;
    if (this.phase === 'result' && this.t > 40 && (g.input.pressed('a') || this.acts.includes('a'))) this.cleanup();
    if (this.phase === 'intro' && this.acts.length) { if (this.acts.includes('a')) g.input.press('a', 'tvl2'); }
    super.update(g);
    g.input.release('a', 'tvl2');
    if (this.phase !== 'play') this.acts.length = 0;
  }

  // ---------------------------------------------------------------- the play loop
  updatePlay(inp) {
    this.st++;
    const acts = this.acts.splice(0);
    const pressed = (k) => inp.pressed(k) || acts.includes(k);
    this.speed += ((this.state === 'arrive' || this.state === 'gameover' ? 0.2 : 3.2) - this.speed) * 0.02;
    this.scroll += this.speed;
    for (const s of this.sparks) s.t++;
    this.sparks = this.sparks.filter((s) => s.t < 40);
    for (const p of this.confetti) { p.y += p.vy; p.x += p.vx + Math.sin((this.st + p.ph * 10) / 10) * 0.4; }
    this.confetti = this.confetti.filter((p) => p.y < FH);
    if (this.flash > 0) this.flash--;
    if (this.wipe > 0) this.wipe = Math.max(0, this.wipe - 0.04);
    if (this.cardFlip > 0 && this.cardFlip < 1) this.cardFlip = Math.min(1, this.cardFlip + 0.12);
    if (this.nameTelop) { this.nameTelop.t++; if (this.nameTelop.t > 110) this.nameTelop = null; }
    if (this.bigTelop) { this.bigTelop.t++; if (this.bigTelop.t > (this.bigTelop.life || 90)) this.bigTelop = null; }
    if (this.sub) { this.sub.t++; if (this.sub.t > 90) this.sub = null; }
    for (const r of this.riders) { if (r.frost > 0 && this.state !== 'penalty') r.frost = Math.max(0, r.frost - 0.004); if (r.talkT > 0) r.talkT--; }
    this.cam.x += (this.cam.tx - this.cam.x) * 0.12;
    this.cam.z += (this.cam.tz - this.cam.z) * 0.12;
    // the beat clock (music steps on 8th notes)
    if (this.train.on) {
      this.clock++;
      const step = Math.floor(this.clock / (this.fpb / 2));
      if (step !== this.lastStep) { this.lastStep = step; this.train.tick(); }
      const beat = Math.floor(this.clock / this.fpb);
      if (beat !== this.lastBeat) { this.lastBeat = beat; this.onBeat(beat); }
    }
    switch (this.state) {
      case 'depart':
        if (this.st === 2) { T.sfx('depart'); this.wipe = 1; this.bigTelop = { text: '短縮鉄道の夜', sub: '発車オーライ！', t: 0, life: 120, kind: 'title' }; }
        if (this.st === 60) this.speak(HOST, '発車オーライ！');
        if (this.st >= 120) this.startLeg();
        break;
      case 'announce':
        // two bars of the station announcement with the music running; the quiz starts on the next bar
        break;
      case 'quiz':
        this.updateQuiz(pressed);
        break;
      case 'miss':
        if (this.st >= 84) this.afterMiss();
        break;
      case 'penalty':
        this.updatePenalty();
        break;
      case 'dogeza':
        this.updateDogeza(pressed);
        break;
      case 'arrive':
        if (this.st % 3 === 0) this.confetti.push({ x: this.rng() * FW, y: -8, vy: 1.2 + this.rng() * 1.6, vx: (this.rng() - 0.5) * 1.2, col: ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff'][Math.floor(this.rng() * 5)], ph: this.rng() * 6 });
        if (this.st % 12 === 0) this.spark(this.rng() * FW, 60 + this.rng() * 200, this.rng() < 0.5 ? '#ffd23f' : '#ffffff');
        if (this.st === 40) this.speak(this.rider(2), 'やったー！');
        if (this.st >= 300) this.finish();
        break;
      case 'gameover':
        if (this.st >= 220) this.finish();
        break;
      default: break;
    }
  }
  startLeg() {
    this.mode = this.leg === this.legs - 1 ? 'space' : 'city';
    this.train.bpm = this.bpm;
    this.train.on = true;
    this.clock = 0; this.lastBeat = -1; this.lastStep = -1;
    this.turn = -1;
    this.setState('announce');
    this.cam.tx = FW / 2; this.cam.tz = 1;
    const st = STATIONS[this.leg];
    const last = this.leg === this.legs - 1;
    this.bigTelop = { text: last ? `次は終点 ${STATIONS[STATIONS.length - 1]}` : `次は ${st}`, sub: `テンポ ${this.bpm}`, t: 0, life: 150, kind: 'next' };
    T.sfx('station');
    this.speak(HOST, last ? `次は、終点、${STATIONS[STATIONS.length - 1]}〜。` : `次は、${st}〜、${st}〜。`, { interrupt: true });
    this.wipe = 1;
    T.sfx('wipe');
  }
  // every beat of the bar: 0 call, 1-2 claps, 3 answer. The announce takes beats 0..7 of a leg.
  onBeat(b) {
    if (this.state === 'announce') {
      if (b % 2 === 1) T.sfx('clap');
      if (b >= 7) { this.setState('quiz'); this.clock = 0; this.lastBeat = 0; this.nextTurn(); }
      return;
    }
    if (this.state !== 'quiz') return;
    const k = b % 4;
    if (b > 0 && k === 0) this.nextTurn();
    else if (k === 1 || k === 2) { T.sfx('clap'); for (const r of this.riders) r.bob = 6; }
    else if (k === 3) this.answerBeat();
  }
  nextTurn() {
    if (this.turn >= 3) { this.endLeg(); return; }
    this.turn++;
    this.turnsPlayed++;
    // the turn order skips nobody: a rider who is out and did 土下座 rides on from リーチ
    const r = this.rider(this.turn);
    const up = this.diff >= 4 ? 1 : 0;
    const lv = this.leg < 2 ? [1, 1 + up] : this.leg < 4 ? [1, 2 + up] : [1 + up, 3];
    let w = pickWords(this.year, 1, { rng: this.rng, lv, exclude: this.used })[0] || pickWords(this.year, 1, { rng: this.rng })[0];
    this.used.add(w.id);
    this.prevWord = this.word;
    this.word = w;
    this.opts4 = optionsFor(w, 4, { rng: this.rng, year: this.year });
    this.sel = -1;
    this.selT = 0;
    this.judged = false;
    this.cardFlip = 0;
    this.turnStart = this.clock;
    this.cam.tx = this.riderX(this.turn); this.cam.tz = r.player ? 1.25 : 1.5;
    this.nameTelop = { r, t: 0 };
    this.hostTalk = 24;
    T.sfx('call');
    this.sub = { who: HOST.name, text: `「${w.abbr}！」`, col: '#9ae0ff', t: 0 };
    this.speak(HOST, (SAY[w.abbr] || w.abbr) + '！', { interrupt: true });
    if (r.player) {
      this.playerTurns++;
      this.ears.start((txt) => this.onHeard(txt));
    } else {
      // the rider's knowledge: easier early, harder words and faster tempo later
      const p = clamp(r.skill - this.leg * 0.035 - (w.lv - 1) * 0.07 - (r.misses ? 0.03 : 0), 0.45, 0.97);
      r.willHit = this.rng() < p;
    }
  }
  onHeard(txt) {
    if (this.state !== 'quiz' || !this.rider(this.turn).player || this.sel >= 0) return;
    if (isCorrect(this.word, txt)) { this.pick(this.opts4.indexOf(this.word.full), true); return; }
    const i = this.opts4.findIndex((o) => isCorrect({ full: o }, txt));
    if (i >= 0) this.pick(i, true);
  }
  updateQuiz(pressed) {
    const r = this.rider(this.turn);
    if (!r) return;
    if (r.player && this.sel < 0 && !this.judged) {
      for (const [k, i] of Object.entries(KEY_OPT)) if (pressed(k)) { this.pick(i); break; }
      for (let i = 0; i < 4; i++) if (pressed('opt' + i)) { this.pick(i); break; }
      // late: past the answer beat + grace → time over
      const grace = this.fpb * (0.42 + 0.12 * clamp(this.bonus, 0, 1));
      if (this.sel < 0 && this.clock - this.turnStart > this.fpb * 3 + grace) this.judgePlayer();
    }
    if (r.player && this.sel >= 0 && !this.judged && this.clock - this.turnStart >= this.fpb * 3) this.judgePlayer();
  }
  pick(i, byVoice = false) {
    if (i < 0 || i > 3 || this.sel >= 0) return;
    this.sel = i;
    this.selT = this.clock - this.turnStart;
    audio.sfx('cursor');
    this.byVoice = byVoice;
    // picked after the answer beat (inside the grace): judge right away
    if (this.selT >= this.fpb * 3) this.judgePlayer();
  }
  answerBeat() {
    const r = this.rider(this.turn);
    if (!r || r.player) return;
    // a rider answers on the beat
    const ok = r.willHit;
    r.talkT = 30;
    if (ok) {
      this.sub = { who: r.tag, text: `「${this.word.full}！」`, col: '#ffffff', t: 0 };
      this.speak(r, this.word.yomi || this.word.full);
      this.good(false);
    } else {
      const wrong = this.opts4.find((o) => o !== this.word.full) || '…';
      const stammer = this.rng() < 0.4;
      this.sub = { who: r.tag, text: stammer ? '「えーっと…！」' : `「${wrong}！」`, col: '#ffffff', t: 0 };
      this.speak(r, stammer ? 'えーっと' : wrong);
      this.miss(this.turn);
    }
  }
  judgePlayer() {
    if (this.judged) return;
    this.judged = true;
    this.ears.stop();
    const r = this.rider(this.turn);
    r.talkT = 30;
    const chosen = this.sel >= 0 ? this.opts4[this.sel] : null;
    if (chosen && chosen === this.word.full) {
      const off = Math.abs(this.selT - this.fpb * 3) / this.fpb;
      const just = off <= 0.35;
      this.correct++;
      if (just) this.just++;
      this.sub = { who: r.tag, text: `「${this.word.full}！」`, col: '#ffd23f', t: 0 };
      this.speak(r, this.word.yomi || this.word.full);
      this.good(just);
    } else {
      this.sub = { who: r.tag, text: chosen ? `「${chosen}！」` : '「……！」', col: '#ffd23f', t: 0 };
      if (chosen) this.speak(r, chosen);
      this.miss(this.turn);
    }
  }
  good(just) {
    this.cardFlip = 0.01;
    T.sfx(just ? 'just' : 'ok');
    for (let k = 0; k < (just ? 16 : 8); k++) this.spark(110 + this.rng() * 140, 430 + this.rng() * 40, k % 2 ? '#ffd23f' : '#ffffff');
    if (just) { this.bigTelop = { text: 'ジャスト！', t: 0, life: 40, kind: 'just' }; this.cam.tz += 0.08; }
  }
  miss(i) {
    const r = this.rider(i);
    this.train.on = false;
    this.missIdx = i;
    r.misses++;
    if (r.player) this.pMiss++;
    T.sfx('miss');
    this.flash = 16;
    this.setState('miss');
    this.cam.tx = this.riderX(i); this.cam.tz = 1.7;
    this.bigTelop = { text: r.misses >= 2 ? 'アウト！' : 'リーチ！', t: 0, life: 84, kind: 'miss' };
    this.speak(HOST, `ブッブー！ 正解は、${this.word.yomi || this.word.full}！`, { interrupt: true });
    this.cardFlip = 0.01;
  }
  afterMiss() {
    const r = this.rider(this.missIdx);
    if (r.misses >= 2) {
      r.out = true;
      if (r.player) this.pOut++;
      this.setState('penalty');
      this.speak(HOST, 'アウトー！', { interrupt: true });
      return;
    }
    this.resume();
  }
  updatePenalty() {
    const r = this.rider(this.missIdx);
    if (this.st === 20) { T.sfx('gas'); this.bigTelop = { text: '冷却ガス', t: 0, life: 110, kind: 'gas' }; }
    if (this.st > 20 && this.st < 110) { r.frost = Math.min(1, r.frost + 0.02); r.shake = 2; }
    if (this.st === 110) { r.shake = 0; this.speak(r, 'つめたっ！ いたい、いたい！'); this.sub = { who: r.tag, text: '「つめたっ！いたい、いたい！」', col: '#ffffff', t: 0 }; }
    if (this.st >= 170) {
      if (r.player) {
        if (this.usedDogeza) { this.gameOver(); return; }
        this.setState('dogeza');
        this.dogezaAsk = true;
      } else {
        this.setState('dogeza');
        this.dogezaAsk = false;
      }
    }
  }
  updateDogeza(pressed) {
    const r = this.rider(this.missIdx);
    if (this.dogezaAsk) {
      // the player decides: 土下座して乗り続ける (A) / 下車する (B)
      if (pressed('a') || pressed('dogeza')) { this.dogezaAsk = false; this.usedDogeza = true; this.st = 0; }
      else if (pressed('b') || pressed('getoff')) { this.gameOver(); }
      else if (this.g.auto) { this.dogezaAsk = false; this.usedDogeza = true; this.st = 0; }
      return;
    }
    if (this.st === 1) { this.cam.tz = 1.15; r.dogeza = 1; T.sfx('dogeza'); this.speak(r, 'すいませんでしたー！'); this.sub = { who: r.tag, text: '「すいませんでしたー！」', col: '#ffffff', t: 0 }; this.bigTelop = { text: '土下座で復帰', sub: 'リーチから再スタート', t: 0, life: 80, kind: 'dogeza' }; }
    if (this.st >= 80) { r.dogeza = 0; r.misses = 1; r.out = false; this.resume(); }
  }
  resume() {
    // the next rider gets the next word on a fresh bar; the music comes back in
    this.setState('quiz');
    this.train.on = true;
    this.clock = 0; this.lastBeat = 0;
    this.nextTurn();
  }
  endLeg() {
    this.leg++;
    if (this.leg >= this.legs) { this.arrive(); return; }
    this.startLeg();
  }
  arrive() {
    this.train.on = false;
    this.cleared = true;
    this.setState('arrive');
    this.mode = 'space';
    this.cam.tx = FW / 2; this.cam.tz = 1;
    audio.sfx('fanfare');
    this.bigTelop = { text: `終点 ${STATIONS[STATIONS.length - 1]}`, sub: '全員、無事に到着！', t: 0, life: 300, kind: 'end' };
    this.speak(HOST, `終点、${STATIONS[STATIONS.length - 1]}〜。おつかれさまでした！`, { interrupt: true });
  }
  gameOver() {
    this.train.on = false;
    this.setState('gameover');
    this.cam.tx = FW / 2; this.cam.tz = 1;
    this.mode = 'station';
    audio.sfx('fail');
    this.bigTelop = { text: '途中下車', sub: `${STATIONS[Math.min(this.leg, STATIONS.length - 1)]}駅で降ろされた…`, t: 0, life: 220, kind: 'off' };
    this.speak(HOST, 'ここで、途中下車です！', { interrupt: true });
  }
  finish() {
    const max = this.playerTurns * 13 + 20;
    let pts = this.correct * 10 + this.just * 3 - this.pMiss * 6 - this.pOut * 15 + (this.cleared ? 20 : 0);
    const score = clamp(Math.round((100 * Math.max(0, pts)) / Math.max(1, max)), 0, 100);
    this.end(score);
  }
  end(score, comment) {
    super.end(score, comment || this.commentFor(score));
    if (this.result) Object.assign(this.result, { correct: this.correct, just: this.just, misses: this.pMiss, outs: this.pOut, cleared: this.cleared, turns: this.playerTurns, year: this.year });
    this.ears.stop();
  }
  commentFor(score) {
    if (this.cleared && this.pMiss === 0) return '全問正解で終点まで！短縮言葉マスターだ！';
    if (this.cleared) return `終点まで乗りきった！（ミス${this.pMiss}回）`;
    if (this.pOut) return '冷却ガスの洗礼…。短縮言葉を勉強しなおそう！';
    return score >= 55 ? 'なかなかの乗りこなし！' : 'リズムに乗りきれなかった…';
  }
  forceEnd(score = 60) {
    if (!this.train) { try { this.init(); } catch (e) { console.error(e); } }
    this.phase = 'play';
    this.playerTurns = this.playerTurns || 6;
    this.correct = Math.round((clamp(score, 0, 100) / 100) * this.playerTurns);
    this.cleared = score >= 40;
    this.end(score);
  }
  spark(x, y, col) { this.sparks.push({ x, y, col, t: 0, vx: (this.rng() - 0.5) * 3, vy: -1 - this.rng() * 2 }); }
  riderX(i) { return 50 + i * 87; }

  // ---------------------------------------------------------------- drawing
  cleanup() {
    this.voice.cancel();
    this.ears.stop();
    if (this.layer) { this.layer.destroy(); this.layer = null; }
    if (this.watch) { clearInterval(this.watch); this.watch = null; }
  }
  ensureLayer() {
    if (this.layer || this.g.auto || this.opts.overlay === false || typeof document === 'undefined' || this.phase === 'result' && this.t > 400) return;
    try {
      this.layer = new T.TvLayer((a) => this.onAct(a));
      const g = this.g;
      this.watch = setInterval(() => { if (!g.scenes || !g.scenes.includes(this)) this.cleanup(); }, 500);
    } catch (e) { this.layer = null; }
  }
  info() {
    return {
      t: this.view.t, year: this.year, yearLabel: onAirYM(this.year) ? `${this.year}年 放送` : `${this.year}年のことば`, program: 'はねるのトびら', stations: STATIONS.slice(STATIONS.length - this.legs), leg: this.leg ?? 0,
      cast: this.riders.map((r) => ({ tag: `${r.tag}｜${r.line}`, misses: Math.min(2, r.misses), out: r.out, player: !!r.player })),
      correct: this.correct, just: this.just, voice: this.voice.enabled, micOk: this.ears.ok, mic: this.ears.enabled,
    };
  }
  draw(ctx) {
    this.ensureLayer();
    const c = this.fctx;
    c.setTransform(K, 0, 0, K, 0, 0);
    c.imageSmoothingEnabled = false;
    this.hits = [];
    try { this.drawFrame(c); } catch (e) { console.error(e); }
    // the game canvas: the same TV composition (visible when the layer is off)
    ctx.save();
    renderInGame(ctx, this.fcv[0], this.info());
    ctx.restore();
    if (this.layer) { this.layer.hits = this.hits; this.layer.render(this.fcv[0], this.info()); }
  }
  drawFrame(c) {
    const t = this.view.t;
    const playing = this.phase === 'play' && this.train;
    // the set under the camera
    c.save();
    const cam = playing ? this.cam : { x: FW / 2, z: 1 };
    c.translate(FW / 2, 300);
    c.scale(cam.z, cam.z);
    c.translate(-cam.x, -300);
    T.drawScenery(c, this.sc, this.scroll || t * 1.5, playing ? (this.state === 'gameover' ? 'station' : this.state === 'announce' ? 'station' : this.mode) : 'city', t, playing && this.state === 'announce' ? STATIONS[this.leg] : '');
    T.drawCar(c, t, 0);
    const amp = playing ? 0.12 + this.leg * 0.03 : 0.08;
    for (let k = 0; k < 9; k++) { const sx = 20 + k * 40; if (this.riders.some((_, i) => Math.abs(this.riderX(i) + 18 - sx) < 14)) continue; T.drawStrap(c, sx, Math.sin(t / 22 + k) * amp); }
    this.riders.forEach((r, i) => {
      const x = this.riderX(i);
      const ring = T.drawStrap(c, x + 22, Math.sin(t / 22 + i * 1.3) * amp, 14);
      const bob = r.bob > 0 ? r.bob-- * 0.4 : 0;
      T.drawPerformer(c, { sheet: r.sheet, x, feet: SET.floor + 8 - bob, ring: r.dogeza ? null : ring, talk: r.talkT > 0 && Math.floor(t / 4) % 2 === 0, frost: r.frost, shake: r.shake || 0, t, dogeza: r.dogeza, sleeve: r.look.top });
      if (playing && r.misses === 1 && !r.dogeza) { T.rect(c, x - 22, SET.floor - 122, 44, 16, '#ffd23f'); T.text(c, 'リーチ', x, SET.floor - 121, { size: 11, align: 'center', color: '#1a1a26', shadow: null }); }
      if (playing && i === this.turn && this.state === 'quiz') { c.globalAlpha = 0.5 + 0.3 * Math.sin(t / 5); T.rect(c, x - 30, SET.floor + 6, 60, 4, '#ffd23f'); c.globalAlpha = 1; }
    });
    if (playing && this.state === 'penalty') { const x = this.riderX(this.missIdx); T.drawGas(c, x, SET.floor - 84, this.st > 20 && this.st < 120 ? 1 : 0, t); }
    c.restore();
    if (this.flash > 0) { c.globalAlpha = this.flash / 24; T.rect(c, 0, 0, FW, 400, '#ff2040'); c.globalAlpha = 1; }
    this.drawTelops(c, t, playing);
    this.drawBottom(c, t, playing);
    for (const p of this.confetti || []) T.rect(c, p.x, p.y, 4, Math.floor((this.view.t + p.ph * 10) / 6) % 2 ? 6 : 3, p.col);
    for (const s of this.sparks || []) { c.globalAlpha = 1 - s.t / 40; T.rect(c, s.x + s.vx * s.t, s.y + s.vy * s.t, 3, 3, s.col); T.rect(c, s.x + s.vx * s.t - 3, s.y + s.vy * s.t + 1, 9, 1, s.col); c.globalAlpha = 1; }
    if (this.wipe > 0) this.drawWipe(c, this.wipe);
    if (this.phase === 'intro') this.drawIntroCard(c, t);
    if (this.phase === 'count') this.drawCount(c, t);
    if (this.phase === 'result') this.drawResultCard(c, t);
  }
  drawWipe(c, k) {
    const x = (1 - k) * (FW + 200) - 100;
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#ffd23f' : '#d64161'; c.beginPath(); c.moveTo(x + i * 26, 0); c.lineTo(x + i * 26 + 26, 0); c.lineTo(x + i * 26 - 74, FH); c.lineTo(x + i * 26 - 100, FH); c.fill(); }
  }
  drawTelops(c, t, playing) {
    // ゲーム中 badge + the corner logo
    T.rect(c, 6, 6, 62, 20, '#d62f2f'); T.rect(c, 6, 6, 62, 2, '#ff8080');
    T.telop(c, 'ゲーム中', 37, 8, 12, '#ffffff', '#5a0000');
    T.telop(c, '短縮鉄道の夜', 214, 6, 18, '#ffd23f', '#1a2a80');
    for (let k = 0; k < 3; k++) T.rect(c, 160 + k * 120 + Math.sin(t / 8 + k) * 3, 10 + (k % 2) * 8, 2, 2, '#ffffff');
    // quizmaster wipe (TV inset)
    T.rect(c, FW - 86, 34, 80, 62, '#ffffff'); T.rect(c, FW - 84, 36, 76, 58, '#24305e');
    c.save(); c.beginPath(); c.rect(FW - 84, 36, 76, 58); c.clip();
    const talking = this.hostTalk > 0 && Math.floor(t / 4) % 2 === 0;
    if (this.hostTalk > 0) this.hostTalk--;
    const [hcv, hctx] = this.hostCv || (this.hostCv = makeCanvas(32, 40));
    hctx.clearRect(0, 0, 32, 40); hctx.drawImage(this.hostSheet.down[0], 0, 0);
    if (talking) { hctx.fillStyle = '#4a1420'; hctx.fillRect(14, 18, 4, 3); }
    c.drawImage(hcv, 0, 0, 32, 30, FW - 78, 38, 64, 60);
    c.restore();
    T.telop(c, '早瀬', FW - 46, 82, 10, '#ffffff', '#1a1a26');
    if (playing && this.state === 'quiz' && Math.floor(t / 20) % 2 === 0) {
      T.rect(c, 0, 102, FW, 22, 'rgba(200,20,40,0.85)');
      T.telop(c, '短縮言葉をリズムに合わせて元に戻せ!!', FW / 2, 105, T.fitSize(c, '短縮言葉をリズムに合わせて元に戻せ!!', FW - 16, 15), '#fff6a0', '#5a0000');
    }
    // name telop (lower third)
    if (this.nameTelop && playing) {
      const r = this.nameTelop.r;
      const k = Math.min(1, this.nameTelop.t / 8);
      const x = -160 + k * 166;
      T.rect(c, x, 300, 70, 26, '#d62f2f'); T.telop(c, r.tag, x + 35, 305, T.fitSize(c, r.tag, 64, 14), '#ffffff', '#5a0000');
      T.rect(c, x + 70, 300, 110, 26, '#ffffff'); T.text(c, r.line, x + 125, 306, { size: T.fitSize(c, r.line, 104, 13), align: 'center', color: '#1a1a26', shadow: null });
    }
    // subtitles
    if (this.sub && playing) {
      const s = this.sub;
      const size = T.fitSize(c, s.text, FW - 30, 18, 11);
      const sy = this.state === 'dogeza' ? 238 : 360; // 土下座 happens on the floor: keep the subtitle above it
      T.rect(c, 0, sy, FW, 36, 'rgba(0,0,0,0.35)');
      T.telop(c, s.text, FW / 2, sy + 12, size, s.col, '#1a1a26');
      T.telop(c, s.who, FW / 2, sy - 1, 10, '#c8cce6', '#1a1a26');
    }
    // big telops
    const b = this.bigTelop;
    if (b && (playing || b.kind === 'title')) {
      const pop = Math.min(1, b.t / 6);
      c.save();
      c.translate(FW / 2, 200);
      c.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
      const col = { miss: '#ff5d6c', gas: '#9ae0ff', just: '#ffd23f', end: '#ffd23f', off: '#c8cce6', next: '#ffffff', dogeza: '#ffd23f', title: '#ffd23f' }[b.kind] || '#ffffff';
      if (b.kind === 'next' || b.kind === 'title' || b.kind === 'end') { T.rect(c, -170, -36, 340, b.sub ? 72 : 52, 'rgba(10,12,40,0.85)'); T.rect(c, -170, -36, 340, 3, '#ffd23f'); }
      T.telop(c, b.text, 0, -28, T.fitSize(c, b.text, 320, b.kind === 'miss' || b.kind === 'just' ? 40 : 28, 14), col, b.kind === 'miss' ? '#5a0000' : '#1a1a26');
      if (b.sub) T.telop(c, b.sub, 0, 12, T.fitSize(c, b.sub, 320, 14, 10), '#ffffff', '#1a1a26');
      c.restore();
      if (b.kind === 'miss') { c.globalAlpha = Math.min(1, b.t / 8) * 0.9; c.strokeStyle = '#ff2040'; c.lineWidth = 10; c.beginPath(); c.moveTo(130, 250); c.lineTo(230, 330); c.moveTo(230, 250); c.lineTo(130, 330); c.stroke(); c.globalAlpha = 1; }
    }
  }
  drawBottom(c, t, playing) {
    T.rect(c, 0, 400, FW, FH - 400, '#0c0a20');
    T.rect(c, 0, 400, FW, 3, '#ffd23f');
    const fin = this.state === 'arrive' ? 'end' : this.state === 'gameover' ? 'off' : '';
    const w = fin ? null : this.word;
    if (fin) T.drawSign(c, 20, 414, FW - 40, fin === 'end' ? STATIONS[STATIONS.length - 1] : STATIONS[this.leg] || '', fin === 'end' ? 'しゅうてん' : 'とちゅうげしゃ', STATIONS[STATIONS.length - 2], '', 0, '');
    else T.drawSign(c, 20, 414, FW - 40, w ? w.abbr : '短縮鉄道', w ? 'たんしゅくことば' : 'たんしゅくてつどう', this.prevWord ? this.prevWord.full : (playing ? STATIONS[this.leg] || '' : ''), w ? '？' : '', this.cardFlip || 0, w ? w.full : '');
    // beat lamps
    const beat = playing && this.state === 'quiz' ? Math.floor((this.clock - (this.turnStart || 0)) / this.fpb) : -1;
    for (let k = 0; k < 4; k++) {
      const on = beat === k;
      const x = 112 + k * 46, y = 506;
      c.fillStyle = on ? (k === 3 ? '#ff5d6c' : '#ffd23f') : '#2a2f55';
      c.beginPath(); c.arc(x, y, on ? 9 : 7, 0, Math.PI * 2); c.fill();
      T.text(c, ['コール', '', '', '回答'][k], x, y + 10, { size: 9, align: 'center', color: '#9aa3c7', shadow: null });
    }
    // the answer buttons
    const mine = playing && this.state === 'quiz' && this.rider(this.turn) && this.rider(this.turn).player;
    if (playing && (this.state === 'quiz' || this.state === 'miss') && this.opts4.length) {
      for (let i = 0; i < 4; i++) {
        const bx = 10 + (i % 2) * 174, by = 532 + Math.floor(i / 2) * 52, bw = 166, bh = 46;
        const right = this.opts4[i] === (w && w.full);
        const reveal = this.state === 'miss' || this.judged;
        let fill = mine ? '#24305e' : '#1a1c34';
        if (this.sel === i) fill = '#2f6fd0';
        if (reveal && right) fill = '#2f9a4a';
        else if (reveal && this.sel === i) fill = '#a02030';
        T.rect(c, bx - 2, by - 2, bw + 4, bh + 4, mine ? '#ffd23f' : '#3a3f60');
        T.rect(c, bx, by, bw, bh, fill);
        T.telop(c, OPT_GLYPH[i], bx + 14, by + 13, 16, mine ? '#ffd23f' : '#5a6090', '#1a1a26');
        const lines = T.wrap(c, this.opts4[i], bw - 34, 13);
        const sz = lines.length > 2 ? 11 : 13;
        const L = T.wrap(c, this.opts4[i], bw - 34, sz).slice(0, 3);
        L.forEach((l, k) => T.text(c, l, bx + 30, by + bh / 2 - (L.length * (sz + 2)) / 2 + k * (sz + 2), { size: sz, color: mine || reveal ? '#ffffff' : '#7a80a8', shadow: null }));
        if (mine) this.hits.push({ x: bx, y: by, w: bw, h: bh, act: 'opt' + i });
      }
      if (mine && this.ears.listening) T.text(c, '（声で回答できます）', FW / 2, 520, { size: 10, align: 'center', color: '#5fd7ff', shadow: null });
    } else if (playing && this.state === 'dogeza' && this.dogezaAsk) {
      T.telop(c, '土下座して乗り続ける？', FW / 2, 530, 16, '#ffd23f', '#1a1a26');
      const B = [['A：土下座する', 'dogeza', '#2f6fd0'], ['B：下車する', 'getoff', '#5a5f6b']];
      B.forEach(([l, act, col], i) => { const bx = 10 + i * 174; T.rect(c, bx, 566, 166, 50, col); T.telop(c, l, bx + 83, 582, 14, '#ffffff', '#1a1a26'); this.hits.push({ x: bx, y: 566, w: 166, h: 50, act }); });
    } else if (playing) {
      T.text(c, this.state === 'announce' ? (isTouch() ? 'まもなく出題！ ボタンをタップで答えよう' : 'まもなく出題！ ↑→←↓ で答えよう') : this.state === 'arrive' ? '終点に到着！' : '', FW / 2, 560, { size: 13, align: 'center', color: '#c8cce6', shadow: null });
    }
  }
  drawIntroCard(c, t) {
    T.rect(c, 0, 0, FW, FH, 'rgba(6,6,20,0.72)');
    T.rect(c, 20, 120, FW - 40, 300, 'rgba(12,16,48,0.95)'); T.rect(c, 20, 120, FW - 40, 3, '#ffd23f'); T.rect(c, 20, 417, FW - 40, 3, '#ffd23f');
    T.telop(c, 'はねるのトびら', FW / 2, 134, 16, '#ffffff', '#2a1a60');
    T.telop(c, this.opts.practice ? '短縮鉄道の夜（練習）' : '短縮鉄道の夜', FW / 2, 158, T.fitSize(c, '短縮鉄道の夜（練習）', FW - 70, 28), '#ffd23f', '#1a2a80');
    const lines = ['短縮言葉がコールされたら、', '2拍あとの「回答」の拍までに', (isTouch() ? '元の言葉をタップで選ぼう' : '元の言葉を ↑→←↓ で選ぼう'), 'ミス2回でアウト… 冷却ガス！', `${this.year}年の言葉で出題`];
    lines.forEach((l, i) => T.text(c, l, FW / 2, 206 + i * 24, { size: 14, align: 'center', color: i === 3 ? '#9ae0ff' : '#ffffff', shadow: null }));
    T.text(c, `${this.riders[2].tag}｜${this.riders[2].line}`, FW / 2, 336, { size: 13, align: 'center', color: '#ffd23f', shadow: null });
    T.text(c, `ボイス：${this.voice.ok ? (this.voice.enabled ? 'ON' : 'OFF') : '非対応'}`, FW / 2, 360, { size: 11, align: 'center', color: '#9aa3c7', shadow: null });
    if (Math.floor(t / 20) % 2 === 0) T.telop(c, 'タップ／Aで乗車！', FW / 2, 384, 16, '#5fd7ff', '#1a1a26');
  }
  drawCount(c, t) {
    const n = 3 - Math.floor(this.t / 30);
    T.rect(c, 0, 0, FW, FH, 'rgba(0,0,0,0.35)');
    T.telop(c, n > 0 ? String(n) : '発車！', FW / 2, 250, n > 0 ? 64 : 40, '#ffd23f', '#1a1a26');
  }
  drawResultCard(c, t) {
    const r = this.result;
    if (!r) return;
    T.rect(c, 0, 0, FW, FH, 'rgba(0,0,0,0.6)');
    T.rect(c, 20, 110, FW - 40, 330, 'rgba(12,16,48,0.96)'); T.rect(c, 20, 110, FW - 40, 3, '#ffd23f');
    T.telop(c, r.cleared ? '終点 到着！' : '途中下車…', FW / 2, 124, 24, r.cleared ? '#ffd23f' : '#c8cce6', '#1a1a26');
    const RC = { S: '#ffd23f', A: '#ff7eb6', B: '#5fd7ff', C: '#5ee07a', D: '#9aa3c7' };
    T.telop(c, r.rank, 100, 170, 64, RC[r.rank], '#1a1a26');
    T.text(c, `${r.score}点`, 100, 244, { size: 18, align: 'center', color: '#ffd23f' });
    const rows = [['正解', `${r.correct}/${r.turns}`], ['ジャスト', `${r.just}`], ['ミス', `${r.misses}`], ['アウト', `${r.outs}`]];
    rows.forEach(([a, b], i) => { T.text(c, a, 180, 176 + i * 22, { size: 14, color: '#9aa3c7' }); T.text(c, b, 300, 176 + i * 22, { size: 14, align: 'right', color: '#ffffff' }); });
    T.wrap(c, r.comment || '', FW - 70, 14).slice(0, 3).forEach((l, i) => T.text(c, l, FW / 2, 290 + i * 20, { size: 14, align: 'center', color: '#ffd23f' }));
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) T.text(c, 'タップ／Aで次へ', FW / 2, 400, { size: 13, align: 'center', color: '#5fd7ff' });
  }
}

// the game canvas (640x360): the same TV composition, scaled
function renderInGame(ctx, fcv, info) {
  T.renderTV(ctx, SW, SH, fcv, info);
}

registerMinigame('tanshuku', Tanshuku);
