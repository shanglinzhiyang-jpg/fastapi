// minigame 'driving' — 運転免許の技能: 所内コース・路上・二輪・第二種 (owner L2 / R8).  API doc: test-output/api_driving.txt
//
//   const r = await g.minigame('driving', { stage, course, era, practice, difficulty, mt, year })
//   -> { score (= 持ち点 after 減点, 0..100), rank, success (= 合格), comment, driving: { passed, points, deductions: [{what, pts}], stage, course, seconds } }
//
// stage: lesson1 | crank | park | hill | kentei1 (修了検定) | road | kentei2 (卒業検定) | second (第二種) | moto (二輪)
// 持ち点100・70点以上で合格 (第二種 80).  検定 (kentei1 / kentei2 / second): 一時不停止・信号無視・接触は即中止.
// 教習 stages and `practice: true`: the instructor steps on the 補助ブレーキ instead.  AT / MT: opts.mt.
// Keys: ↑ アクセル / ↓ ブレーキ (止まって長押しで後退 R) / ←→ ハンドル / A ウィンカー (←/→ を押しながらで直接) / B 安全確認.
// Touch: on-screen pedals, wheel, 合図, 確認 (and the pad's d-pad / A / B).

import { Minigame, registerMinigame, text, panel, wrap, COLORS } from '../engine/minigame.js';
import { audio, registerSong } from '../engine/audio.js';
import { clamp, SW, SH, mulberry32 } from '../engine/util.js';
import { measure } from '../engine/draw.js';
import { STAGES, STAGE_IDS, DED, KMH, PASS, PASS_SECOND, INSTRUCTOR, LINES, carLook, ERA_YEAR, eraOf } from '../engine/driving_data.js';
import { buildCourse, sigState } from '../engine/driving_course.js';
import { Sim } from '../engine/driving_core.js';
import { Bot } from '../engine/driving_bot.js';
import * as Art from '../engine/driving_art.js';

const { Z } = Art;

// ------------------------------------------------------------------ original music
registerSong('drv_yard', {
  bpm: 108, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E5 . G5 . A5 G5 E5 . | D5 . F5 . G5 F5 D5 . | C5 . E5 . G5 E5 C5 . | D5 E5 D5 . G4 . . . | E5 . G5 . A5 G5 E5 . | F5 . A5 . C6 A5 F5 . | G5 . E5 . D5 E5 C5 . | D5 . . . C5 - - .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h . s . h h' },
  ],
});
registerSong('drv_road', {
  bpm: 124, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'G5 . D5 G5 B5 . A5 G5 | E5 . G5 . B5 - A5 . | C6 . G5 C6 E6 . D6 C6 | B5 . G5 . D5 - - . | A5 . E5 A5 C6 . B5 A5 | F#5 . A5 . D6 - C6 . | B5 G5 B5 D6 G6 . F#6 D6 | G5 - - - . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'G2 . G3 . G2 . G3 . | E2 . E3 . E2 . E3 . | C3 . C4 . C3 . C4 . | G2 . G3 . D3 . D3 . | A2 . A3 . A2 . A3 . | D3 . D4 . D3 . D4 . | E3 . E3 . G2 . G2 . | G2 . D3 . G2 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k h s h k k s h' },
    { wave: 'square', vol: 0.02, notes: 'D4 G4 B4 G4 D4 G4 B4 G4 | B3 E4 G4 E4 B3 E4 G4 E4 | E4 G4 C5 G4 E4 G4 C5 G4 | D4 G4 B4 G4 D4 F#4 A4 F#4' },
  ],
});
registerSong('drv_kentei', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.08, notes: 'A4 - C5 - E5 - D5 C5 | B4 - D5 - G5 - F5 E5 | C5 - E5 - A5 - G5 E5 | F5 - E5 - D5 - - . | A4 - C5 - E5 - D5 C5 | B4 - D5 - G5 - B5 . | A5 - G5 - E5 - C5 - | A4 - - - . . . .' },
    { wave: 'square', vol: 0.025, notes: 'A3 E4 A3 E4 A3 E4 A3 E4 | G3 D4 G3 D4 G3 D4 G3 D4 | F3 C4 F3 C4 F3 C4 F3 C4 | E3 B3 E3 B3 E3 B3 E3 B3' },
    { wave: 'triangle', vol: 0.1, notes: 'A2 . . . A2 . . . | G2 . . . G2 . . . | F2 . . . F2 . . . | E2 . . . E2 . . .' },
    { wave: 'drum', vol: 0.05, notes: 'k . . h s . h .' },
  ],
});

// ------------------------------------------------------------------ helpers
const isTouchUI = () => typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch');
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
function urlParams() {
  try { return new URLSearchParams(typeof location !== 'undefined' ? location.search : ''); } catch (e) { return new URLSearchParams(''); }
}
function gameYear(g) {
  try {
    if (g && typeof g.gameDate === 'function') { const d = g.gameDate(); if (d && Number.isFinite(d.year)) return d.year; }
  } catch (e) { /* fall back to the era */ }
  const era = g && g.state && g.state.profile && g.state.profile.era;
  return ERA_YEAR[era] || 2026;
}
function eraName(g) { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_YEAR[e] ? e : null; }

// `course` names the callers use (license_flow.js): city / crossing / passenger / kentei1 / kentei2 (towns), tenkan / tate (parking),
// ippon / slalom / basic / ouyou / koshu (two-wheelers) — anything else gets the stage's default course.
export function courseVariant(stage, course) {
  const c = String(course || '');
  if (stage === 'road' || stage === 'kentei2' || stage === 'second') {
    if (c === 'A' || c === 'city' || c === 'kentei1') return 'A';
    if (c === 'B' || c === 'crossing' || c === 'passenger' || c === 'kentei2') return 'B';
    return stage === 'kentei2' ? 'B' : 'A';
  }
  if (stage === 'park') return c === 'tenkan' || c === 'a' ? 'tenkan' : c === 'tate' || c === 'b' ? 'tate' : '';
  if (stage === 'moto') return ['ippon', 'slalom', 'basic'].includes(c) ? c : '';
  return '';
}

// tuning by difficulty (1..5) and the player's bonus (skill / condition)
export function widthFactor(difficulty, bonus = 0) { return clamp(1.3 - 0.075 * (difficulty - 1) + 0.12 * Math.min(1, Math.max(-0.35, bonus)), 0.88, 1.55); }

// phones in portrait: every button is drawn in the canvas; in landscape the page's own pad (d-pad, A, B) covers the corners,
// so only the three centre buttons (合図 / 確認) are drawn there
const isPortrait = () => typeof window !== 'undefined' && window.innerHeight >= window.innerWidth * 0.9;
const BUTTONS = [
  { id: 'left', label: '◀', x: 8, y: 284, w: 84, h: 72, col: '#5fd7ff' },
  { id: 'right', label: '▶', x: 98, y: 284, w: 84, h: 72, col: '#5fd7ff' },
  { id: 'sigL', label: '合図◀', x: 196, y: 284, w: 66, h: 72, col: '#ffd23f', always: true },
  { id: 'sigR', label: '合図▶', x: 266, y: 284, w: 66, h: 72, col: '#ffd23f', always: true },
  { id: 'look', label: '確認', x: 336, y: 284, w: 62, h: 72, col: '#b8f0a0', always: true },
  { id: 'brake', label: 'ブレーキ\n長押しで後退', x: 408, y: 284, w: 104, h: 72, col: '#ff7a7a' },
  { id: 'gas', label: 'アクセル', x: 518, y: 284, w: 114, h: 72, col: '#7be08a' },
];

class Driving extends Minigame {
  static title = '運転技能';
  static howto = ['↑アクセル ↓ブレーキ ←→ハンドル A合図 B確認'];
  static bgm = 'drv_yard';
  static hd = true;
  static skill = null;

  constructor(g, opts = {}) {
    const P = urlParams();
    const lab = typeof window !== 'undefined' && P.get('minigame') === 'driving';
    const o = { ...opts };
    if (lab) { // the lab (?minigame=driving&stage=crank&practice=1&mt=1&era=showa&course=B)
      for (const k of ['stage', 'course', 'era']) if (o[k] == null && P.get(k)) o[k] = P.get(k);
      if (o.practice == null && P.get('practice')) o.practice = P.get('practice') !== '0';
      if (o.mt == null && P.get('mt')) o.mt = P.get('mt') !== '0';
      if (o.year == null && P.get('year')) o.year = +P.get('year');
    }
    const stage = STAGES[o.stage] ? o.stage : 'lesson1';
    const S = STAGES[stage];
    const second = !!S.strict || o.strict === true || o.course === 'second'; // 第二種: strict marking
    o.pass = o.pass ?? (S.pass || (second ? PASS_SECOND : PASS));
    super(g, o);
    this.opts = o;
    this.stage = stage;
    this.S = S;
    this.practice = !!o.practice;
    this.year = Number(o.year) || gameYear(g);
    this.era = o.era && ERA_YEAR[o.era] ? o.era : (eraName(g) || eraOf(this.year));
    if (!o.year && o.era && ERA_YEAR[o.era]) this.year = ERA_YEAR[o.era];
    this.mt = o.mt != null ? !!o.mt : this.year < 1996;
    this.second = second;
    this.strictK = S.strict || (second ? 1.5 : 1);
    this.passMark = o.pass;
    this.title = o.title || S.title;
    this.look = carLook(this.era, this.year, stage);
    this.kind = this.practice ? 'lesson' : (S.kind === 'kentei' || o.exam === true) ? 'kentei' : 'lesson';
    this.seed = (Math.floor(((o.seed ?? 0) + stage.length * 131 + this.difficulty * 17) * 2654435761) >>> 0);
    this.courseId = o.course || null;
    this.cam = { x: 0, y: 0 };
    this.tbtn = new Set();
    this.tpress = { sigL: false, sigR: false, look: false };
    this.ptr = new Map();
    this.alive = true;
    this.flash = 0;
    this.listPop = [];
    this.endT = 0;
    this.demo = !!o.autopilot;
    this.buildSim();
  }

  buildSim() {
    const d = this.difficulty;
    const wf = widthFactor(d, this.bonus);
    this.course = buildCourse(this.stage, { wf, variant: courseVariant(this.stage, this.courseId), difficulty: d });
    if (this.course.sigs) { /* signal cycle by difficulty */ }
    const cyc = { g: 380 - d * 20, y: 80 };
    for (const t of this.course.trig) if (t.type === 'signal') t.cyc = cyc;
    this.course.cyc = cyc;
    const S = this.S;
    this.sim = new Sim(this.course, {
      stage: this.stage, kind: this.kind, mt: this.mt, practice: this.practice, strict: this.strictK, pass: this.passMark,
      passenger: !!S.passenger, time: Math.round(S.time * (1.2 - 0.05 * d)), reverse: !!S.reverse, rng: mulberry32(this.seed), ease: this.bonus, pedSpeed: 0.5 + 0.04 * d,
    });
    this.sim.limit = S.limit;
    this.bot = this.demo ? new Bot(this.sim) : null;
    this.art = null;
    this.hintOn = true;
  }

  ensureArt() {
    if (!this.art) {
      try { this.art = Art.renderStatic(this.course, { year: this.year }); } catch (e) { console.error(e); this.art = { cv: null, ox: 0, oy: 0 }; }
      this.snapCam();
    }
  }
  snapCam() {
    const q = this.sim.center();
    this.cam.x = q[0]; this.cam.y = q[1];
  }

  // ------------------------------------------------------------------ lifecycle
  init() {
    try { audio.bgm(this.S.song || 'drv_yard'); } catch (e) { /* audio is optional */ }
    this.bindTouch();
    this.ensureArt();
    this.hintT = 0;
  }

  // ------------------------------------------------------------------ touch buttons (in-canvas, multi-touch)
  bindTouch() {
    const cv = this.g && this.g.canvas;
    const host = cv && cv.parentElement;
    if (!cv || !host || this._bound) return;
    this._bound = true;
    const pos = (e) => {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
    };
    const hit = (p) => (p ? shown().find((b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) : null);
    const shown = () => (isPortrait() ? BUTTONS : BUTTONS.filter((b) => b.always));
    const recompute = () => { this.tbtn = new Set([...this.ptr.values()]); };
    this._h = {
      down: (e) => {
        if (!this.alive || this.phase !== 'play' || !isTouchUI()) return;
        const b = hit(pos(e));
        if (!b) return;
        e.stopPropagation(); e.preventDefault();
        try { host.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        this.ptr.set(e.pointerId, b.id);
        if (b.id === 'sigL' || b.id === 'sigR' || b.id === 'look') this.tpress[b.id] = true;
        recompute();
      },
      move: (e) => {
        if (!this.ptr.has(e.pointerId)) return;
        const b = hit(pos(e));
        const cur = this.ptr.get(e.pointerId);
        if (b && b.id !== cur && ['left', 'right', 'gas', 'brake'].includes(b.id) && ['left', 'right', 'gas', 'brake'].includes(cur)) { this.ptr.set(e.pointerId, b.id); recompute(); }
        e.stopPropagation();
      },
      up: (e) => { if (this.ptr.delete(e.pointerId)) { recompute(); e.stopPropagation(); } },
    };
    host.addEventListener('pointerdown', this._h.down, true);
    host.addEventListener('pointermove', this._h.move, true);
    host.addEventListener('pointerup', this._h.up, true);
    host.addEventListener('pointercancel', this._h.up, true);
    this._host = host;
  }
  unbindTouch() {
    this.alive = false;
    const h = this._host;
    if (h && this._h) {
      h.removeEventListener('pointerdown', this._h.down, true);
      h.removeEventListener('pointermove', this._h.move, true);
      h.removeEventListener('pointerup', this._h.up, true);
      h.removeEventListener('pointercancel', this._h.up, true);
    }
    this._host = null; this._bound = false; this.ptr.clear(); this.tbtn.clear();
  }

  // ------------------------------------------------------------------ one frame
  gather(inp) {
    const t = this.tbtn;
    const k = {
      up: inp.down('up') || t.has('gas'),
      down: inp.down('down') || t.has('brake'),
      left: inp.down('left') || t.has('left'),
      right: inp.down('right') || t.has('right'),
    };
    // a plain screen tap is not the A button here
    const srcA = inp.sources && inp.sources.a;
    const tapOnly = srcA && srcA.size > 0 && [...srcA].every((s) => s === 'tap');
    const p = { a: inp.pressed('a') && !tapOnly, b: inp.pressed('b') };
    if (this.tpress.sigL) { p.a = true; k.left = true; k.right = false; }
    if (this.tpress.sigR) { p.a = true; k.right = true; k.left = false; }
    if (this.tpress.look) p.b = true;
    this.tpress.sigL = this.tpress.sigR = this.tpress.look = false;
    return { k, p };
  }

  updatePlay(inp) {
    const sim = this.sim;
    if (this.flash > 0) this.flash--;
    if (sim.done) { this.afterDone(); return; }
    let k, p;
    if (this.bot) ({ k, p } = this.bot.act()); else ({ k, p } = this.gather(inp));
    sim.step(k, p);
    for (const e of sim.ev) this.onEvent(e);
    this.hum();
    this.updateCam();
    this.hintT++;
    if (sim.done) this.endT = 0;
  }

  hum() {
    // a very quiet engine note that follows the speed (skipped while muted / before the first gesture)
    const c = audio.ctx;
    if (!c || audio.muted || this.pt % 7 !== 0) return;
    const sim = this.sim;
    const v = Math.abs(sim.car.v);
    const f = (sim.moto ? 70 : 52) + v * 42 + sim.car.th * 14;
    try { audio.tone(f, c.currentTime, 0.1, { wave: 'sawtooth', vol: 0.012 + 0.008 * sim.car.th }); } catch (err) { /* optional */ }
    if (sim.sig && this.pt % 28 === 0) { try { audio.tone(1500, c.currentTime, 0.015, { vol: 0.03 }); } catch (err) { /* optional */ } }
  }

  onEvent(e) {
    const hasCtx = !!audio.ctx;
    switch (e.type) {
      case 'ded': {
        const col = e.pts >= 30 ? '#ff4a4a' : '#ffb26b';
        this.popup(`${e.what}  −${e.pts}`, 320, 118, col, 20);
        this.flash = 10;
        audio.sfx(e.pts >= 30 ? 'fail' : 'buzz');
        this.listPop.unshift({ what: e.what, pts: e.pts, t: 0 });
        this.listPop = this.listPop.slice(0, 4);
        break;
      }
      case 'hit': audio.sfx('hit'); break;
      case 'assist': break;
      case 'sig': if (hasCtx && !e.auto) audio.tone(1500, audio.ctx.currentTime, 0.02, { vol: 0.04 }); break;
      case 'look': audio.sfx('cursor'); break;
      case 'gear': audio.sfx('door'); break;
      case 'bell': audio.sfx('chime'); break;
      case 'door': audio.sfx('door'); break;
      case 'good': audio.sfx('good'); break;
      case 'warped': audio.sfx('ok'); break;
      default: break;
    }
  }

  updateCam() {
    const sim = this.sim, c = sim.car;
    const q = sim.center();
    const lead = Math.min(1, Math.abs(c.v) / 1.6) * 26 * Math.sign(c.v || 1);
    const tx = q[0] + Math.cos(c.a) * lead, ty = q[1] + Math.sin(c.a) * lead;
    const b = this.course.bounds;
    const vw = SW / Z, vh = SH / Z;
    this.cam.x += (tx - this.cam.x) * 0.14;
    this.cam.y += (ty - this.cam.y) * 0.14;
    // keep the view inside the course (when the course is larger than the view)
    this.cam.x = b.x1 - b.x0 <= vw ? (b.x0 + b.x1) / 2 : clamp(this.cam.x, b.x0 + vw / 2, b.x1 - vw / 2);
    const vy = this.carScreenY();
    const top = vy / Z, bot = (SH - vy) / Z;
    this.cam.y = b.y1 - b.y0 <= top + bot ? (b.y0 + b.y1) / 2 + (bot - top) / 2 : clamp(this.cam.y, b.y0 + top, b.y1 - bot);
  }
  carScreenY() { return isTouchUI() ? 150 : 178; }

  afterDone() {
    const sim = this.sim;
    this.endT++;
    const wait = sim.done === 'goal' ? 60 : sim.done === 'abort' ? 110 : 70;
    if (this.endT === 1) {
      if (sim.done === 'goal') { this.popup('終了！', 320, 130, '#7be08a', 28); audio.sfx('ok'); }
      else if (sim.done === 'abort') { audio.sfx('fail'); }
    }
    if (this.endT >= wait) this.finishRun();
  }

  finishRun() {
    if (this.phase === 'result') return;
    const r = this.sim.result();
    let score = r.points;
    if (!r.passed) score = Math.min(score, r.aborted ? 30 : this.passMark - 1);
    this.end(score, this.commentFor(r));
  }

  commentFor(r) {
    const who = this.stage === 'second' ? INSTRUCTOR.second : INSTRUCTOR.name;
    const sim = this.sim;
    if (r.aborted) return `${who}：「${sim.over.what}のため、検定を中止します。」`;
    if (r.how === 'timeout') return `${who}：「時間切れです。落ち着いて、もう一度。」`;
    if (r.passed) {
      if (r.points >= 98) return `${who}：「文句なし。模範の運転でした。」`;
      if (r.points >= 90) return `${who}：「とてもよくできました。この調子で。」`;
      if (r.points >= 80) return `${who}：「合格です。少しの減点を復習しましょう。」`;
      return `${who}：「合格です。ただ、ギリギリでしたね。」`;
    }
    return `${who}：「あと${Math.max(1, this.passMark - r.points)}点。苦手なところを練習しましょう。」`;
  }

  // the base class resolves the promise; add the driving payload
  end(score, comment) {
    if (this.phase === 'result') return;
    this.unbindTouch();
    const sim = this.sim;
    const real = sim && sim.done;
    let drv;
    if (real) {
      drv = sim.result();
    } else { // g.auto / forceEnd: no real run
      const pts = clamp(Math.round(score), 0, 100);
      drv = { passed: pts >= this.passMark, points: pts, aborted: false, how: 'auto', seconds: sim ? Math.round(sim.t / 60) : 0, deductions: [] };
    }
    super.end(score, comment || undefined);
    if (!this.result) return;
    this.result.success = !!drv.passed;
    this.result.driving = {
      passed: !!drv.passed, points: drv.points, deductions: drv.deductions, stage: this.stage, course: this.courseLabel(), seconds: drv.seconds,
      aborted: !!drv.aborted, mt: this.mt, practice: this.practice, pass: this.passMark, how: drv.how,
    };
    this.rdata = this.result.driving;
  }
  courseLabel() { return this.courseId || (this.course.variant ? this.course.variant : this.course.name); }

  // tests: run the autopilot headlessly (no canvas) and return the result in the same shape
  static quickRun(opts = {}) {
    const stage = STAGES[opts.stage] ? opts.stage : 'lesson1';
    const S = STAGES[stage];
    const d = clamp(Math.round(opts.difficulty ?? 2), 1, 5);
    const second = !!S.strict || opts.strict === true || opts.course === 'second';
    const course = buildCourse(stage, { wf: widthFactor(d, opts.bonus || 0), variant: courseVariant(stage, opts.course) });
    const kind = opts.practice ? 'lesson' : (S.kind === 'kentei' || opts.exam === true) ? 'kentei' : 'lesson';
    const sim = new Sim(course, { stage, kind, mt: !!opts.mt, practice: !!opts.practice, strict: S.strict || (second ? 1.5 : 1), pass: S.pass || (second ? PASS_SECOND : PASS), passenger: !!S.passenger, time: Math.round(S.time * (1.2 - 0.05 * d)), reverse: !!S.reverse, rng: mulberry32(7) });
    const bot = new Bot(sim, { sloppy: opts.sloppy || 0 });
    let n = 0;
    while (!sim.done && n < 60 * 600) { const { k, p } = bot.act(); sim.step(k, p); n++; }
    const r = sim.result();
    const pm = S.pass || (second ? PASS_SECOND : PASS);
    const score = r.passed ? r.points : Math.min(r.points, pm - 1);
    const rank = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
    return { score, rank, success: r.passed, comment: '', driving: { passed: r.passed, points: r.points, deductions: r.deductions, stage, course: opts.course || course.variant || course.name, seconds: r.seconds, aborted: r.aborted, mt: !!opts.mt, practice: !!opts.practice, pass: pm, how: r.how } };
  }

  // ------------------------------------------------------------------ drawing
  drawBackground(ctx) {
    ctx.fillStyle = '#1b2b3a';
    ctx.fillRect(0, 0, SW, SH);
  }

  w2s(x, y) { return [(x - this.cam.x) * Z + SW / 2, (y - this.cam.y) * Z + this.carScreenY()]; }

  drawPlay(ctx) {
    this.ensureArt();
    const sim = this.sim, A = this.art;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#3d6f3c';
    ctx.fillRect(0, 0, SW, SH);
    const vy = this.carScreenY();
    const ox = SW / 2 - this.cam.x * Z, oy = vy - this.cam.y * Z;
    if (A.cv) ctx.drawImage(A.cv, Math.round(A.ox * Z + ox), Math.round(A.oy * Z + oy));
    // ---- world layer
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    ctx.scale(Z, Z);
    this.drawWorld(ctx);
    ctx.restore();
    // ---- screen layer
    this.drawHud(ctx);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.02})`; ctx.fillRect(0, 0, SW, SH); }
    if (sim.fade > 0 || sim.fadeIn > 0) {
      const a = sim.fade > 0 ? 1 - sim.fade / 60 : sim.fadeIn / 40;
      ctx.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, SW, SH);
    }
    if (isTouchUI() && this.phase === 'play') this.drawTouchUI(ctx);
    if (sim.done === 'abort') this.drawAbort(ctx);
  }

  drawWorld(c) {
    const sim = this.sim, course = this.course, t = this.pt;
    c.imageSmoothingEnabled = false;
    // upcoming stop lines glow
    for (const tr of course.trig) {
      if (tr.type !== 'stopmark' && tr.type !== 'pickup') continue;
      if (tr.st.done || tr.st.fin) continue;
      if (tr.sp !== undefined && Math.abs(sim.s - tr.sp) > 170) continue;
      const pulse = 0.25 + 0.2 * Math.sin(t * 0.12);
      c.save(); c.translate(tr.x, tr.y); c.rotate(Math.atan2(tr.dy, tr.dx));
      const hw = tr.type === 'pickup' ? 0 : (tr.hw || 22);
      if (tr.type === 'stopmark') { c.fillStyle = `rgba(255,226,100,${pulse})`; c.fillRect(tr.near, -22, tr.far - tr.near, 44); }
      c.restore();
    }
    // route preview dots
    if (this.course._pb && !course.noPathProgress && this.phase === 'play') {
      const pb = course._pb;
      c.fillStyle = 'rgba(120,230,255,0.75)';
      for (let u = 14; u < 150; u += 14) {
        const q = pb.at(sim.s + u);
        const r = 1.4 - u / 300;
        c.beginPath(); c.arc(q.x, q.y, r + 0.4, 0, Math.PI * 2); c.fill();
      }
    }
    if (course.name === 'park' && this.phase === 'play') {
      const target = course.trig.find((x) => x.type === 'park' && !x.st.done && (x.id === 'parkB') === (sim.phase === 1));
      if (target) {
        const r = target.rect;
        c.strokeStyle = `rgba(120,255,160,${0.55 + 0.3 * Math.sin(t * 0.15)})`; c.lineWidth = 1.6; c.setLineDash([4, 3]);
        c.strokeRect(r.x, r.y, r.w, r.h); c.setLineDash([]);
        c.fillStyle = 'rgba(120,255,160,0.18)'; c.fillRect(r.x, r.y, r.w, r.h);
        // little car-shaped hint
        c.save(); c.translate(r.x + r.w / 2, r.y + r.h / 2); c.rotate(target.a); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.strokeRect(-14, -6, 28, 12); c.restore();
        const stt = target.st;
        if (stt.hold) { c.fillStyle = '#7be08a'; c.fillRect(r.x, r.y + r.h + 3, r.w * clamp(stt.hold / 36, 0, 1), 3); }
      }
    }
    if (course.town) Art.drawSignalHeads(c, course, sim.t);
    if (course.marks.some((m) => m.t === 'rail')) Art.drawGateAndTrain(c, course, sim.gate, sim.train);
    for (const k of sim.cones) Art.drawCone(c, k);
    for (const p of sim.peds) Art.drawPed(c, p, t);
    Art.drawVehicle(c, sim, this.look, t);
    // pickup progress
    if (sim.hold > 0) {
      const q = sim.center();
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(q[0] - 16, q[1] - 24, 32, 5);
      c.fillStyle = '#7be08a'; c.fillRect(q[0] - 15, q[1] - 23, 30 * clamp(sim.hold / 90, 0, 1), 3);
    }
  }

  drawHud(ctx) {
    const sim = this.sim, car = sim.car;
    // ---- top bar
    ctx.fillStyle = 'rgba(8,12,28,0.78)';
    ctx.fillRect(0, 0, SW, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 30, SW, 1);
    const pts = sim.points;
    const col = pts >= 85 ? '#7be08a' : pts >= this.passMark ? '#ffd23f' : '#ff6a6a';
    text(ctx, '持ち点', 8, 1, { size: 9, color: '#9aa3c7' });
    text(ctx, String(pts), 8, 11, { size: 17, color: col, outline: '#000' });
    text(ctx, `/ ${this.passMark}合格`, 52, 17, { size: 10, color: '#9aa3c7' });
    const tag = this.practice ? '練習' : this.S.kind === 'kentei' ? '検定' : '教習';
    const tcol = this.practice ? '#5fd7ff' : this.S.kind === 'kentei' ? '#ff7eb6' : '#ffd23f';
    let label = this.title;
    while (label.length > 4 && measure(ctx, label, 14) > 270) label = label.slice(0, -2) + '…';
    const w = measure(ctx, label, 14);
    const cx = 330;
    ctx.fillStyle = tcol; ctx.fillRect(cx - w / 2 - 44, 6, 38, 17);
    text(ctx, tag, cx - w / 2 - 25, 8, { size: 12, color: '#101428', align: 'center', shadow: null });
    text(ctx, label, cx - w / 2, 7, { size: 14 });
    text(ctx, sim.moto ? '二輪' : this.mt ? 'MT' : 'AT', cx + w / 2 + 6, 8, { size: 12, color: '#9aa3c7' });
    // speed + limit sign
    const kmh = Math.round(sim.kmh);
    const lim = Math.round(sim.limit || this.S.limit);
    const over = sim.kmh > lim + 1.5;
    text(ctx, String(kmh).padStart(2, ' '), 576, 5, { size: 20, color: over ? '#ff6a6a' : '#fff', align: 'right', outline: '#000' });
    text(ctx, 'km/h', 580, 15, { size: 9, color: '#9aa3c7' });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(618, 15, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e03a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(618, 15, 9, 0, Math.PI * 2); ctx.stroke();
    text(ctx, String(lim), 618, 9, { size: 10, color: '#111', align: 'center', shadow: null });
    // progress
    let prog = 0;
    if (!this.course.noPathProgress) prog = clamp(sim.s / Math.max(1, this.course.total), 0, 1);
    else prog = clamp((sim.phase + (sim.c.trig.find((x) => x.id === (sim.phase === 0 ? 'parkA' : 'parkB')).st.done ? 0.5 : 0)) / 2, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 30, SW, 3);
    ctx.fillStyle = '#5fd7ff'; ctx.fillRect(0, 30, SW * prog, 3);
    // gear + signals + clutch
    const gx = 4, gy = 38;
    ctx.fillStyle = 'rgba(8,12,28,0.7)'; ctx.fillRect(gx, gy, 66, 22);
    text(ctx, car.gear === 'R' ? 'R' : sim.moto ? '1' : 'D', gx + 8, gy + 3, { size: 16, color: car.gear === 'R' ? '#ff9a9a' : '#9cffb8' });
    const blink = Math.floor(this.pt / 14) % 2 === 0;
    text(ctx, '◀', gx + 28, gy + 4, { size: 14, color: sim.sig < 0 && blink ? '#ffb400' : '#4a4f66' });
    text(ctx, '▶', gx + 48, gy + 4, { size: 14, color: sim.sig > 0 && blink ? '#ffb400' : '#4a4f66' });
    if (this.mt && sim.mtT > 0) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(gx, gy + 24, 66 * clamp(sim.mtT / 24, 0, 1), 4); text(ctx, 'クラッチ', gx, gy + 29, { size: 10, color: '#ffd23f' }); }
    if (sim.stall > 0) text(ctx, 'エンスト！', gx, gy + 29, { size: 12, color: '#ff6a6a' });
    // traffic light ahead
    const sg = this.nextSignal();
    if (sg) {
      ctx.fillStyle = 'rgba(8,12,28,0.78)'; ctx.fillRect(SW / 2 - 28, 36, 56, 20);
      [['g', '#31e07a'], ['y', '#ffd23f'], ['r', '#ff4a4a']].forEach(([k, onc], i) => {
        ctx.fillStyle = sg === k ? onc : '#2a2f45'; ctx.beginPath(); ctx.arc(SW / 2 - 16 + i * 16, 46, 6, 0, Math.PI * 2); ctx.fill();
      });
    }
    // time left
    const left = Math.max(0, Math.ceil((sim.timeLimit - sim.t) / 60));
    text(ctx, `残り ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, SW - 8, 36, { size: 11, color: left < 20 ? '#ff6a6a' : '#9aa3c7', align: 'right', outline: '#000' });
    // deduction ticker (right)
    this.listPop.forEach((l, i) => {
      l.t++;
    });
    this.listPop = this.listPop.filter((l) => l.t < 240);
    this.listPop.forEach((l, i) => {
      const a = clamp(1 - l.t / 240, 0.25, 1);
      ctx.globalAlpha = a;
      text(ctx, `${l.what} −${l.pts}`, SW - 8, 52 + i * 15, { size: 12, color: l.pts >= 30 ? '#ff6a6a' : '#ffb26b', align: 'right', outline: '#000' });
      ctx.globalAlpha = 1;
    });
    // instructor
    const sy = sim.say;
    if (sy && this.phase === 'play') {
      const who = this.stage === 'second' ? INSTRUCTOR.second : INSTRUCTOR.name;
      const lines = wrap(ctx, sy.text, 440, 14).slice(0, 2);
      const h = 14 + lines.length * 17;
      const bx = 96, by = SH - (isTouchUI() ? 0 : 0) - 0;
      const y0 = isTouchUI() ? 64 : SH - h - 30;
      ctx.fillStyle = 'rgba(8,12,28,0.84)'; ctx.fillRect(SW / 2 - 232, y0, 464, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(SW / 2 - 231.5, y0 + 0.5, 463, h - 1);
      text(ctx, who, SW / 2 - 224, y0 + 3, { size: 10, color: '#ffd23f' });
      lines.forEach((l, i) => text(ctx, l, SW / 2 - 224, y0 + 14 + i * 17, { size: 14 }));
    }
    // controls strip (keyboard)
    if (!isTouchUI() && this.pt < 600 && this.phase === 'play') {
      ctx.globalAlpha = clamp(1 - this.pt / 600, 0, 1) * 0.9;
      text(ctx, '↑アクセル　↓ブレーキ（止まって長押しで後退）　←→ハンドル　A ウィンカー　B 安全確認', SW / 2, SH - 15, { size: 10, align: 'center', color: '#cfd6ee', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  }

  nextSignal() {
    const sim = this.sim;
    let best = null, bd = 1e9;
    for (const tr of this.course.trig) {
      if (tr.type !== 'signal' || tr.st.ph !== 'approach') continue;
      if (tr.sp !== undefined && Math.abs(sim.s - tr.sp) > 330) continue;
      const dd = -sim.planeS(tr);
      if (dd > -10 && dd < 300 && dd < bd) { bd = dd; best = tr; }
    }
    return best ? sigState(best.sig, best.axis, sim.t, best.cyc) : null;
  }

  drawTouchUI(ctx) {
    for (const b of isPortrait() ? BUTTONS : BUTTONS.filter((q) => q.always)) {
      const on = this.tbtn.has(b.id);
      ctx.fillStyle = on ? 'rgba(255,255,255,0.42)' : 'rgba(10,14,34,0.55)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = b.col; ctx.lineWidth = 2; ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      const lines = b.label.split('\n');
      if (lines.length > 1) {
        text(ctx, lines[0], b.x + b.w / 2, b.y + 20, { size: 15, align: 'center', color: '#fff' });
        text(ctx, lines[1], b.x + b.w / 2, b.y + 44, { size: 9, align: 'center', color: '#cfd6ee' });
      } else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 - (b.label.length > 2 ? 8 : 11), { size: b.label.length > 2 ? 13 : 22, align: 'center', color: '#fff' });
    }
  }

  drawAbort(ctx) {
    const k = clamp(this.endT / 20, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * k})`; ctx.fillRect(0, 0, SW, SH);
    const y = 120 + (1 - k) * 30;
    ctx.fillStyle = `rgba(190,20,40,${0.92 * k})`; ctx.fillRect(0, y, SW, 70);
    text(ctx, '検定中止', SW / 2, y + 8, { size: 40, align: 'center', color: '#fff', outline: '#400' });
    text(ctx, this.sim.over.what, SW / 2, y + 52, { size: 14, align: 'center', color: '#ffd0d0' });
  }

  // ------------------------------------------------------------------ cards
  drawIntroHD(ctx) {
    const S = this.S;
    panel(ctx, 56, 14, SW - 112, SH - 28);
    const kentei = S.kind === 'kentei' && !this.practice;
    const tag = this.practice ? '練習' : kentei ? '検定' : '教習';
    const tcol = this.practice ? '#5fd7ff' : kentei ? '#ff7eb6' : '#ffd23f';
    ctx.fillStyle = tcol; ctx.fillRect(76, 28, 46, 22);
    text(ctx, tag, 99, 31, { size: 16, align: 'center', color: '#101428', shadow: null });
    let ts = 24;
    while (ts > 13 && measure(ctx, this.title, ts) > 340) ts--;
    text(ctx, this.title, 134, 24 + (24 - ts) / 2, { size: ts, color: COLORS.accent });
    text(ctx, S.sub, 134, 52, { size: 13, color: '#cfd6ee' });
    // car icon
    const sp = Art.carSprite(this.look);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2b3a58'; ctx.fillRect(488, 26, 66, 38);
    const sc = this.look.kind === 'moto' ? 3 : 2;
    ctx.drawImage(sp.cv, 521 - (sp.W * sc) / 2, 45 - (sp.H * sc) / 2, sp.W * sc, sp.H * sc);
    text(ctx, this.look.kind === 'moto' ? '二輪車' : this.mt ? 'MT車' : 'AT車', 521, 66, { size: 11, align: 'center', color: '#9aa3c7' });
    // the headline rule
    let head;
    if (this.practice) head = '練習モード：減点しても何も失いません';
    else head = `持ち点100点　${this.passMark}点以上で合格`;
    ctx.fillStyle = 'rgba(255,210,63,0.14)'; ctx.fillRect(76, 74, SW - 152, 26);
    text(ctx, head, SW / 2, 78, { size: 17, align: 'center', color: '#ffe27a' });
    let y = 108;
    const rules = [...S.lines];
    if (!kentei && !this.practice) rules.push('教習中は、危ないときに教官が補助ブレーキを踏みます。');
    for (const line of rules) {
      for (const l of wrap(ctx, line, SW - 190, 13)) { text(ctx, `・${l}`, 86, y, { size: 13 }); y += 18; }
    }
    // deductions table
    y = Math.max(y + 2, 176);
    text(ctx, '主な減点', 86, y, { size: 11, color: '#9aa3c7' });
    const items = [['脱輪', 5], ['ポール接触', 10], ['合図・確認不足', 5], ['速度超過', 5], ['一時不停止', 30], ['信号無視・接触', 100]];
    const abort = new Set(['一時不停止', '信号無視・接触']);
    items.forEach(([n, p], i) => {
      const cx = 86 + (i % 3) * 156, cy = y + 14 + Math.floor(i / 3) * 16;
      text(ctx, `${n}`, cx, cy, { size: 12, color: abort.has(n) && kentei ? '#ff9a9a' : '#e6e9f8' });
      text(ctx, `−${p}${abort.has(n) && kentei ? ' 中止' : ''}`, cx + 148, cy, { size: 12, color: abort.has(n) && kentei ? '#ff6a6a' : '#ffb26b', align: 'right' });
    });
    // controls
    y += 52;
    ctx.fillStyle = 'rgba(95,215,255,0.12)'; ctx.fillRect(76, y - 2, SW - 152, 70);
    if (isTouchUI()) {
      text(ctx, '画面下のボタン：ハンドル ◀▶　合図 ◀▶　確認', 86, y + 1, { size: 12, color: '#bfe9ff' });
      text(ctx, 'ブレーキ（止まって長押しで後退）　アクセル　※十字キー・A・Bも使えます', 86, y + 18, { size: 12, color: '#bfe9ff' });
      text(ctx, 'A ウィンカー　B 安全確認（右左折・発進・停止の前に）', 86, y + 35, { size: 12, color: '#bfe9ff' });
    } else {
      text(ctx, '↑ アクセル　↓ ブレーキ（止まって長押しで後退 R）　← → ハンドル', 86, y + 1, { size: 12, color: '#bfe9ff' });
      text(ctx, 'A ウィンカー（←/→ を押しながら A で左/右を直接）', 86, y + 18, { size: 12, color: '#bfe9ff' });
      text(ctx, 'B 安全確認（右左折・発進・停止の前に）', 86, y + 35, { size: 12, color: '#bfe9ff' });
    }
    text(ctx, `担当：${this.stage === 'second' ? INSTRUCTOR.second : INSTRUCTOR.name}　むずかしさ ${stars(this.difficulty)}`, 86, y + 52, { size: 11, color: '#9aa3c7' });
    this.drawBonusLine(ctx, SW / 2, SH - 54, 11);
    if (Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aでスタート！', SW / 2, SH - 40, { size: 14, align: 'center', color: COLORS.cyan });
  }

  drawResultHD(ctx) {
    const r = this.result;
    const d = r.driving || {};
    const k = Math.min(1, this.t / 15);
    ctx.fillStyle = `rgba(0,0,0,${0.55 * k})`;
    ctx.fillRect(0, 0, SW, SH);
    const y0 = Math.round(14 + (1 - k) * 50);
    panel(ctx, 50, y0, SW - 100, SH - 28);
    text(ctx, this.title, 70, y0 + 10, { size: 15, color: COLORS.dim });
    text(ctx, `${this.practice ? '練習' : this.S.kind === 'kentei' ? '検定' : '教習'}・${this.mt ? 'MT' : 'AT'}・${d.seconds ?? 0}秒`, SW - 70, y0 + 12, { size: 12, color: COLORS.dim, align: 'right' });
    // stamp
    const aborted = d.aborted, ok = d.passed;
    const word = aborted ? '検定中止' : d.how === 'timeout' ? '時間切れ' : ok ? (this.practice ? '合格圏' : '合格') : '不合格';
    const col = ok ? '#4fd27a' : '#ff5a6a';
    ctx.save();
    ctx.translate(150, y0 + 78); ctx.rotate(-0.12);
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.strokeRect(-76, -30, 152, 60);
    ctx.lineWidth = 1.5; ctx.strokeRect(-70, -24, 140, 48);
    text(ctx, word, 0, -22, { size: word.length > 3 ? 34 : 42, align: 'center', color: col, shadow: null });
    ctx.restore();
    // points
    text(ctx, '持ち点', 262, y0 + 40, { size: 14, color: COLORS.dim });
    text(ctx, String(d.points ?? r.score), 262, y0 + 56, { size: 48, color: ok ? '#ffe27a' : '#ff9a9a', outline: '#000' });
    text(ctx, `/ 100（${this.passMark}点で合格）`, 346, y0 + 82, { size: 12, color: COLORS.dim });
    const RC = { S: '#ffd23f', A: '#ff7eb6', B: '#5fd7ff', C: '#5ee07a', D: '#9aa3c7' };
    text(ctx, r.rank, 510, y0 + 34, { size: 72, align: 'center', color: RC[r.rank], outline: '#000' });
    // deductions
    const agg = new Map();
    for (const x of d.deductions || []) { const a = agg.get(x.what) || { n: 0, p: 0 }; a.n++; a.p += x.pts; agg.set(x.what, a); }
    const rows = [...agg.entries()].sort((a, b) => b[1].p - a[1].p);
    const ty = y0 + 118;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(70, ty - 4, SW - 140, 126);
    text(ctx, '減点', 78, ty, { size: 12, color: COLORS.dim });
    if (!rows.length) text(ctx, '減点なし！ パーフェクト', 78, ty + 38, { size: 18, color: '#7be08a' });
    const maxRows = 7;
    rows.slice(0, maxRows).forEach(([n, a], i) => {
      const col2 = i < 3 ? 0 : 1, row = i < 3 ? i : i - 3;
      const x = 78 + (i % 2 === 0 ? 0 : 236), yy = ty + 16 + Math.floor(i / 2) * 25;
      text(ctx, n, x, yy, { size: 14 });
      text(ctx, `×${a.n}　−${a.p}`, x + 222, yy, { size: 14, color: a.p >= 30 ? '#ff6a6a' : '#ffb26b', align: 'right' });
    });
    if (rows.length > maxRows) text(ctx, `ほか ${rows.length - maxRows} 項目`, SW - 78, ty + 108, { size: 11, color: COLORS.dim, align: 'right' });
    // comment
    wrap(ctx, r.comment, SW - 160, 15).slice(0, 2).forEach((l, i) => text(ctx, l, SW / 2, y0 + 252 + i * 20, { size: 15, align: 'center' }));
    if (this.t > 40 && Math.floor(this.t / 20) % 2 === 0) text(ctx, 'Aで次へ', SW / 2, y0 + 296, { size: 14, align: 'center', color: COLORS.cyan });
  }
}

registerMinigame('driving', Driving);
export default Driving;
export { Driving };
export { STAGES, STAGE_IDS };
