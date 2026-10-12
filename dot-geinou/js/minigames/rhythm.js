// リズム（歌・ダンス） — notes fall down 1, 2 or 4 lanes toward a hit line.
// The player sings / dances on a concert stage; every note you hit is "sung"
// by the lead voice over a procedurally generated, beat-synced chiptune.
//
// opts:
//   lanes:   1 | 2 | 4      default d1 = 1, d2 = 2, d3+ = 4.  1 → A, 2 → ← →, 4 → ← ↓ ↑ →
//   bpm:     tempo           default 96 + 8 * difficulty
//   length:  chart length in beats (default 32 + 8 * difficulty, rounded to whole bars)
//   song:    song name shown on screen (default: a random built-in original song)
//   title:   minigame title (base class)
//   style:   'sing' | 'dance' default 'sing' ('dance' when the title mentions ダンス / 踊)
//   doubles: bool            gold "A bars" played together with an arrow (default: d5 with 2+ lanes)
//   seed:    number          chart seed (default: hash of song / lanes / bpm / length / difficulty)
//   look:    sprite look of the performer (default: the player's look)
//
// Timing is driven by the 60fps frame clock (this.pt) so judgement and the
// headless test bots are deterministic; the music is scheduled ahead on the
// WebAudio clock and re-synced to the frame clock when they drift.
//
// Scoring: PERFECT 1 / GREAT 0.8 / GOOD 0.5 / MISS 0 per note, minus 0.3 per
// stray press (a lane pressed with no note nearby; 0.45 with a single lane, whose
// charts always keep a rest per bar).  score = 100 * total / notes.
// Doing nothing scores 0; mashing is eaten by the stray penalty.

import { Minigame, registerMinigame, text, rect, sparkle } from '../engine/minigame.js';
import { measure } from '../engine/draw.js';
import { charSheet, LOOKS } from '../engine/sprites.js';
import { audio } from '../engine/audio.js';
import { makeCanvas, mulberry32, clamp, shade, mix, W, H } from '../engine/util.js';

// ------------------------------------------------------------------ content
// Original songs. key = semitones from C5 for the lead voice, prog = chord
// roots as scale degrees (0 = I, 3 = IV, 4 = V, 5 = vi ...), one chord per bar.
const SONG_POOL = [
  { name: 'きらめきステップ', key: 0, prog: [0, 4, 5, 3] },
  { name: 'ドット・ドリーマー', key: 2, prog: [5, 3, 0, 4] },
  { name: 'ピコピコ・ハートビート', key: -3, prog: [0, 5, 3, 4] },
  { name: 'ネオンシティ・ダンス', key: -2, prog: [5, 4, 3, 4] },
  { name: 'はじまりのマイク', key: -5, prog: [0, 3, 4, 0] },
  { name: 'まっすぐスターライン', key: 1, prog: [3, 4, 2, 5] },
  { name: 'なつぞら8ビート', key: -4, prog: [0, 4, 5, 2, 3, 0, 3, 4] },
  { name: 'ドット荘ブギ', key: -7, prog: [0, 0, 3, 0, 4, 3, 0, 4] },
];
const PROGS = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 2, 5], [0, 3, 4, 4], [0, 4, 5, 2, 3, 0, 3, 4]];

const HOWTO_LINE = {
  1: ['ノーツが白い線に重なった瞬間に', 'Aボタンを押そう！'],
  2: ['ノーツが白い線に重なったら', '← → で同じ向きを押そう！'],
  4: ['ノーツが白い線に重なったら', '← ↓ ↑ → で同じ向きを押そう！'],
};
const BAND_TEXT = {
  1: 'ノーツが線に重なったら A！',
  2: '← → をリズムに合わせて押そう！',
  4: '← ↓ ↑ → をリズムに合わせて押そう！',
};

export const RHYTHM_CONTENT = { SONG_POOL };

// ------------------------------------------------------------------ tuning
const INTRO = 4; // count-in beats before the first note
const JUDGE_OFFSET = 0.008; // input is read on the next 60fps step: compensate ~half a frame
const VALUES = { perfect: 1, great: 0.8, good: 0.5, miss: 0 };
const STRAY = 0.3; // per stray press (0.45 with a single lane, where timing is the whole game)
const WIN = {
  perfect: [0.065, 0.058, 0.052, 0.047, 0.043],
  great: [0.115, 0.105, 0.095, 0.087, 0.08],
  good: [0.165, 0.152, 0.14, 0.13, 0.12],
};
const LOOK_BEATS = [2.8, 2.6, 2.4, 2.2, 2.1]; // how many beats ahead notes become visible
const P_ON = [0.7, 0.8, 0.86, 0.9, 0.94]; // chance of a note on beats 2-4 of a bar
const P_OFF = [0.12, 0.14, 0.26, 0.38, 0.5]; // chance of an off-beat 8th note

const LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
const JCOLOR = { perfect: '#ffd23f', great: '#ff7eb6', good: '#5fd7ff', miss: '#8a90b0' };

// ------------------------------------------------------------------ layout
const HUD_H = 15;
const HW_TOP = 17;
const HIT_Y = 176;
const HW_BOT = 197;
const FLOOR_Y = 168;
const BAND_Y = 228;
const HW_CX = 222;
const LANE_W = { 1: 52, 2: 46, 4: 34 };
const PX = 54; // performer (3x sprite = 48x60)
const PY = 136;
const LED = { x: 8, y: 28, w: 140, h: 86 };

const LANE_DEFS = {
  1: [{ key: 'a', dir: 'a', color: '#e8466a' }],
  2: [{ key: 'left', dir: 'left', color: '#ff5fa2' }, { key: 'right', dir: 'right', color: '#ffa43a' }],
  4: [
    { key: 'left', dir: 'left', color: '#ff5fa2' },
    { key: 'down', dir: 'down', color: '#4fc8ff' },
    { key: 'up', dir: 'up', color: '#5ee07a' },
    { key: 'right', dir: 'right', color: '#ffa43a' },
  ],
};
const PEN_COLORS = ['#ff5fa2', '#5fd7ff', '#ffd23f', '#5ee07a', '#b77cff', '#ffffff', '#ff8a3d'];
const LED_COLORS = ['#ff5fa2', '#ff8a3d', '#ffd23f', '#5ee07a', '#5fd7ff', '#7a7cff', '#b77cff'];

// ------------------------------------------------------------------ helpers
const SCALE = [0, 2, 4, 5, 7, 9, 11];
const degToSemi = (d) => Math.floor(d / 7) * 12 + SCALE[((d % 7) + 7) % 7];

function hashStr(s) {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fillCircle(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy + r * 0.8)));
    ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
  }
}

// 22x22 boolean masks for the note shapes.
const NS = 22;
function arrowMask(dir) {
  const up = (x, y) => {
    const dx = Math.abs(x + 0.5 - 11);
    if (y >= 1 && y <= 10) return dx <= y;
    if (y >= 11 && y <= 20) return dx <= 5;
    return false;
  };
  const m = [];
  for (let y = 0; y < NS; y++) {
    const row = [];
    for (let x = 0; x < NS; x++) {
      let v;
      if (dir === 'up') v = up(x, y);
      else if (dir === 'down') v = up(x, NS - 1 - y);
      else if (dir === 'left') v = up(y, x);
      else v = up(y, NS - 1 - x);
      row.push(v);
    }
    m.push(row);
  }
  return m;
}
function circleMask(size, r) {
  const c = size / 2;
  const m = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= r * r);
    m.push(row);
  }
  return m;
}
const GLYPH_A = ['.xx.', 'x..x', 'xxxx', 'x..x', 'x..x'];
const GLYPH_NOTE = ['...xx.', '...xxx', '...x.x', '...x..', '.xxx..', 'xxxx..', 'xxxx..', '.xx...'];

// kind: 'note' (filled, shaded) | 'recv' (empty ring) | 'lit' (pressed receptor)
function maskSprite(mask, color, kind, glyph, glyphScale = 2) {
  const n = mask.length;
  const [cv, c] = makeCanvas(n, n);
  const at = (x, y) => x >= 0 && y >= 0 && x < n && y < n && mask[y][x];
  const hi = shade(color, 0.5), lo = shade(color, -0.32);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (at(x, y)) {
        let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!at(x + dx, y + dy)) near = true;
        let col;
        if (kind === 'note') {
          if (!at(x, y - 1) || !at(x - 1, y)) col = hi;
          else if (!at(x, y + 1) || !at(x + 1, y)) col = lo;
          else col = color;
        } else if (kind === 'recv') {
          col = near ? '#bdb6e6' : 'rgba(24,14,48,0.55)';
        } else {
          col = near ? '#ffffff' : color;
        }
        c.fillStyle = col;
        c.fillRect(x, y, 1, 1);
      } else {
        let edge = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(x + dx, y + dy)) edge = true;
        if (edge) {
          c.fillStyle = kind === 'recv' ? 'rgba(10,6,24,0.8)' : '#140b26';
          c.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  if (glyph) {
    const gw = glyph[0].length * glyphScale, gh = glyph.length * glyphScale;
    const ox = Math.floor((n - gw) / 2), oy = Math.floor((n - gh) / 2);
    const gcol = kind === 'recv' ? '#bdb6e6' : kind === 'lit' ? '#ffffff' : '#ffffff';
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== 'x') continue;
        if (kind === 'note') {
          c.fillStyle = shade(color, -0.55);
          c.fillRect(ox + gx * glyphScale + 1, oy + gy * glyphScale + 1, glyphScale, glyphScale);
        }
        c.fillStyle = kind === 'note' && glyphScale === 1 ? '#3a2200' : gcol;
        c.fillRect(ox + gx * glyphScale, oy + gy * glyphScale, glyphScale, glyphScale);
      }
    });
  }
  return cv;
}

let SPRITES = null;
function sprites() {
  if (SPRITES) return SPRITES;
  SPRITES = { lane: {}, tab: {}, notes: new Map() };
  for (const n of [1, 2, 4]) {
    SPRITES.lane[n] = LANE_DEFS[n].map((l) => {
      const mask = l.dir === 'a' ? circleMask(NS, 10.2) : arrowMask(l.dir);
      const glyph = l.dir === 'a' ? GLYPH_A : null;
      return {
        note: maskSprite(mask, l.color, 'note', glyph),
        recv: maskSprite(mask, l.color, 'recv', glyph),
        lit: maskSprite(mask, shade(l.color, -0.1), 'lit', glyph),
      };
    });
  }
  const tm = circleMask(13, 6.2);
  SPRITES.tab = {
    note: maskSprite(tm, '#ffc93a', 'note', GLYPH_A, 1),
    recv: maskSprite(tm, '#ffc93a', 'recv', GLYPH_A, 1),
    lit: maskSprite(tm, '#ffc93a', 'lit', GLYPH_A, 1),
  };
  return SPRITES;
}
function noteGlyph(color, s) {
  const S = sprites();
  const key = color + s;
  if (S.notes.has(key)) return S.notes.get(key);
  const [cv, c] = makeCanvas(GLYPH_NOTE[0].length * s + 1, GLYPH_NOTE.length * s + 1);
  for (const [col, off] of [['#140b26', 1], [color, 0]]) {
    c.fillStyle = col;
    GLYPH_NOTE.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === 'x') c.fillRect(x * s + off, y * s + off, s, s);
    });
  }
  S.notes.set(key, cv);
  return cv;
}

// Static stage backdrop (wall, truss, LED frame, floor).
let BG = null;
function stageBackground() {
  if (BG) return BG;
  const [cv, c] = makeCanvas(W, H);
  for (let y = 0; y < FLOOR_Y; y++) {
    c.fillStyle = mix('#0a0620', '#2a1250', y / FLOOR_Y);
    c.fillRect(0, y, W, 1);
  }
  c.fillStyle = 'rgba(255,255,255,0.035)';
  for (let x = 10; x < W; x += 20) c.fillRect(x, 26, 1, FLOOR_Y - 26);
  // floor with perspective grid
  for (let y = FLOOR_Y; y < H; y++) {
    c.fillStyle = mix('#2a1850', '#120a26', (y - FLOOR_Y) / 32);
    c.fillRect(0, y, W, 1);
  }
  c.fillStyle = '#382364';
  for (const dy of [3, 7, 12, 18, 25]) c.fillRect(0, FLOOR_Y + dy, W, 1);
  for (let xt = -200; xt <= 520; xt += 26) {
    for (let y = FLOOR_Y; y < 197; y++) {
      const k = (y - FLOOR_Y) / 30;
      c.fillRect(Math.round(xt + (xt - 160) * 0.6 * k), y, 1, 1);
    }
  }
  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.fillRect(0, FLOOR_Y, W, 1);
  // stage front edge with footlights
  c.fillStyle = '#4a2f7a';
  c.fillRect(0, 196, W, 4);
  c.fillStyle = '#9a7ae0';
  c.fillRect(0, 196, W, 1);
  c.fillStyle = '#ffe08a';
  for (let x = 6; x < W; x += 20) c.fillRect(x, 198, 4, 1);
  // truss
  c.fillStyle = '#4a4e60';
  c.fillRect(0, 17, W, 2);
  c.fillRect(0, 23, W, 2);
  c.fillStyle = '#7a8098';
  c.fillRect(0, 17, W, 1);
  c.fillRect(0, 23, W, 1);
  c.fillStyle = '#3a3e50';
  for (let x = 0; x < W; x += 8) for (let i = 0; i < 4; i++) { c.fillRect(x + i, 19 + i, 1, 1); c.fillRect(x + 7 - i, 19 + i, 1, 1); }
  // LED screen frame + cables
  c.fillStyle = '#3a3e50';
  c.fillRect(LED.x + 22, 25, 1, 3);
  c.fillRect(LED.x + LED.w - 23, 25, 1, 3);
  c.fillStyle = '#2e2a40';
  c.fillRect(LED.x - 2, LED.y - 2, LED.w + 4, LED.h + 4);
  c.fillStyle = '#56506e';
  c.fillRect(LED.x - 1, LED.y - 1, LED.w + 2, LED.h + 2);
  c.fillStyle = '#05030c';
  c.fillRect(LED.x, LED.y, LED.w, LED.h);
  BG = cv;
  return BG;
}

let LED_GRID = null;
function ledGrid() {
  if (LED_GRID) return LED_GRID;
  const [cv, c] = makeCanvas(LED.w, LED.h);
  c.fillStyle = 'rgba(0,0,0,0.42)';
  for (let y = 2; y < LED.h; y += 3) c.fillRect(0, y, LED.w, 1);
  for (let x = 2; x < LED.w; x += 3) c.fillRect(x, 0, 1, LED.h);
  LED_GRID = cv;
  return cv;
}

// ------------------------------------------------------------------ game
class Rhythm extends Minigame {
  static title = 'リズム（歌・ダンス）';
  static howto = ['落ちてくるノーツが白い線に重なったら', 'ボタンを押そう！（← ↓ ↑ → / A）', 'ぴったり合うほど高得点！'];
  static skill = 'uta';
  static bgm = null; // we play our own beat-synced chiptune

  constructor(g, opts = {}) {
    super(g, opts);
    const d = this.difficulty;
    const o = this.opts;
    let lanes = +(o.lanes ?? (d <= 1 ? 1 : d === 2 ? 2 : 4)) || 4;
    this.lanes = lanes <= 1 ? 1 : lanes < 4 ? 2 : 4;
    this.bpm = clamp(Math.round(+o.bpm || 96 + 8 * d), 60, 200);
    this.beatDur = 60 / this.bpm;
    const maxLen = Math.max(8, Math.floor((62 / this.beatDur - INTRO) / 4) * 4);
    const minLen = Math.max(8, Math.ceil((11 / this.beatDur - INTRO) / 4) * 4);
    this.length = clamp(Math.round((+o.length || 32 + 8 * d) / 4) * 4, minLen, maxLen);
    this.doubles = this.lanes > 1 && !!(o.doubles ?? d >= 5);
    this.style = o.style === 'dance' || o.style === 'sing' ? o.style : /ダンス|踊|ダンサー/.test(String(o.title || '')) ? 'dance' : 'sing';
    const known = o.song ? SONG_POOL.find((s) => s.name === o.song) : SONG_POOL[Math.floor(Math.random() * SONG_POOL.length)];
    this.songName = String(o.song || known.name);
    const h = hashStr(this.songName);
    this.key = known ? known.key : (h % 8) - 5;
    this.prog = known ? known.prog : PROGS[(h >>> 3) % PROGS.length];
    if (!o.howto) {
      const howto = [...HOWTO_LINE[this.lanes]];
      howto.push(this.doubles ? '金色のバーが来たら Aも押そう！' : 'ぴったり合うほど高得点！');
      howto.push(`♪ 曲：「${this.songName}」`);
      this.opts = { ...o, howto };
    }
  }

  // ---------------------------------------------------------------- setup
  init() {
    const d = this.difficulty;
    this.seed = (this.opts.seed ?? hashStr(`${this.songName}|${this.lanes}|${this.bpm}|${this.length}|${d}|${this.doubles}`)) >>> 0;
    this.buildChart(mulberry32(this.seed));
    this.win = {
      perfect: this.ease(WIN.perfect[d - 1], 0.35),
      great: this.ease(WIN.great[d - 1], 0.35),
      good: this.ease(WIN.good[d - 1], 0.35),
    };
    this.travel = LOOK_BEATS[d - 1] * this.beatDur;
    this.speed = (HIT_Y - HW_TOP + 12) / this.travel;
    this.laneW = LANE_W[this.lanes];
    this.hwW = this.laneW * this.lanes;
    this.hwX = Math.round(HW_CX - this.hwW / 2);
    this.laneDefs = LANE_DEFS[this.lanes];
    this.keys = this.laneDefs.map((l) => l.key);
    if (this.doubles) this.keys.push('a');
    this.sheet = charSheet(this.opts.look || (this.g.state && this.g.state.look) || LOOKS.player);
    this.performer = (this.g.state && this.g.state.name) || 'ドット';

    this.combo = 0;
    this.maxCombo = 0;
    this.sum = 0;
    this.penalty = 0;
    this.strays = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.volt = 0.35;
    this.fx = [];
    this.parts = [];
    this.confetti = [];
    this.beam = new Array(this.lanes + 1).fill(0);
    this.strayT = new Array(this.lanes + 1).fill(0);
    this.jd = null;
    this.face = 'down';
    this.faceT = 0;
    this.sweatT = 0;
    this.jumpT = 0;
    this.finished = false;
    this.finT = 0;
    this.nextStep = 0;
    this.audioBase = null;
    this.endStep = (INTRO + this.length) * 2;
    this.endTime = (INTRO + this.length) * this.beatDur;

    // audience: back row then front row
    const r = mulberry32(this.seed ^ 0x5bd1e995);
    this.fans = [];
    for (let i = 0; i < 24; i++) this.fans.push({ x: 6 + i * 13.4 + r() * 4, y: 209, r: 4, body: '#22163f', pen: PEN_COLORS[Math.floor(r() * PEN_COLORS.length)], th: r() * 0.95, ph: r(), side: r() < 0.5 ? -1 : 1 });
    for (let i = 0; i < 19; i++) this.fans.push({ x: 2 + i * 17.6 + r() * 5, y: 219, r: 6, body: '#120a24', pen: PEN_COLORS[Math.floor(r() * PEN_COLORS.length)], th: r() * 0.95, ph: r(), side: r() < 0.5 ? -1 : 1 });
    this.ensureBus();
  }

  // Procedural chart: a few one-bar rhythm motifs arranged like a song
  // (A B A C ...), with a melody that random-walks over one octave. The lane
  // follows the pitch (low = left, high = right) so it feels like singing.
  buildChart(rng) {
    const d = this.difficulty;
    const lanes = this.lanes;
    const bars = this.length / 4;
    const pOn = P_ON[d - 1];
    const pOff = P_OFF[d - 1] * (lanes === 1 ? 0.85 : 1);
    const offOk = (s, i) => pOff > 0 && (d >= 4 || s[i - 1]) && !(d <= 2 && i === 7);
    const makeBar = () => {
      const s = new Array(8).fill(false);
      s[0] = true;
      for (const i of [2, 4, 6]) s[i] = rng() < pOn;
      // one button only: keep a rest in every bar so tapping along blindly to the beat doesn't work
      if (lanes === 1 && s[2] && s[4] && s[6]) s[[2, 4, 6][Math.floor(rng() * 3)]] = false;
      for (const i of [1, 3, 5, 7]) if (offOk(s, i) && rng() < pOff) s[i] = true;
      if (s.filter(Boolean).length < 2) s[4] = true;
      return s;
    };
    const motifs = [makeBar(), makeBar(), makeBar(), makeBar()];
    const order = [0, 1, 0, 2, 0, 1, 3, 2];
    const notes = [];
    let deg = 2 + Math.floor(rng() * 4);
    const laneOf = (dg) => (lanes === 1 ? 0 : Math.min(lanes - 1, Math.floor((dg * lanes) / 8)));
    const chordTones = (ch) => {
      const out = [];
      for (let dg = 0; dg <= 7; dg++) if ([0, 2, 4].includes((((dg - ch) % 7) + 7) % 7)) out.push(dg);
      return out;
    };
    const steps = [[-2, 1], [-1, 3], [0, d <= 2 ? 1.2 : 0.5], [1, 3], [2, 1]];
    const stepRand = () => {
      let t = rng() * steps.reduce((a, s) => a + s[1], 0);
      for (const [v, w] of steps) { if ((t -= w) <= 0) return v; }
      return 1;
    };
    const push = (beat, dg, extra = {}) => {
      let lane = laneOf(dg);
      const p1 = notes[notes.length - 1], p2 = notes[notes.length - 2];
      if (lanes > 1 && p1 && p2 && p1.lane === lane && p2.lane === lane && beat - p2.beat <= 1.01) {
        dg = clamp(dg + (dg < 4 ? 2 : -2), 0, 7);
        lane = laneOf(dg);
      }
      notes.push({ beat, deg: dg, lane, key: this.laneKey(lane), ...extra });
      return dg;
    };
    for (let b = 0; b < bars; b++) {
      let s;
      if (b === bars - 1) {
        s = [true, false, true, false, true, false, d >= 3, false];
      } else {
        s = motifs[order[b % order.length]].slice();
        if (b > 0 && rng() < 0.3) {
          const i = 1 + 2 * Math.floor(rng() * 4);
          if (s[i]) s[i] = false; else if (offOk(s, i)) s[i] = true;
        }
      }
      const chord = this.prog[b % this.prog.length];
      for (let i = 0; i < 8; i++) {
        if (!s[i]) continue;
        const beat = INTRO + b * 4 + i / 2;
        deg += stepRand();
        if (deg < 0) deg = -deg;
        if (deg > 7) deg = 14 - deg;
        if (i % 4 === 0) {
          const ct = chordTones(chord);
          let best = ct[0];
          for (const c of ct) if (Math.abs(c - deg) < Math.abs(best - deg) || (Math.abs(c - deg) === Math.abs(best - deg) && rng() < 0.5)) best = c;
          deg = best;
        }
        deg = push(beat, deg);
        if (this.doubles && b > 0 && ((i === 0 && rng() < 0.55) || (i === 4 && rng() < 0.3))) {
          notes.push({ beat, deg, lane: -1, key: 'a', bar: true, chord });
        }
      }
    }
    // final note lands with the closing chord (tonic)
    const endBeat = INTRO + this.length;
    push(endBeat, deg >= 4 ? 7 : 0, { last: true });
    if (this.doubles) notes.push({ beat: endBeat, deg: 0, lane: -1, key: 'a', bar: true, chord: 0, last: true });

    notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
    const melody = notes.filter((n) => !n.bar);
    melody.forEach((n, i) => {
      const nx = melody[i + 1];
      n.dur = n.last ? 1.1 : clamp(((nx ? nx.beat : n.beat + 1) - n.beat) * this.beatDur * 0.9, 0.1, 0.45);
    });
    for (const n of notes) {
      n.time = n.beat * this.beatDur;
      n.res = null;
    }
    this.notes = notes;
  }

  laneKey(lane) {
    return LANE_DEFS[this.lanes][lane].key;
  }

  // ---------------------------------------------------------------- audio
  audioOk() {
    return !!(audio.ctx && !audio.muted && audio.ctx.state === 'running' && this.bus);
  }

  ensureBus() {
    if (this.bus || this.phase === 'result' || !audio.ctx || !audio.bgmGain) return;
    this.bus = audio.ctx.createGain();
    this.bus.gain.value = 0.9;
    this.bus.connect(audio.bgmGain);
  }

  stopMusic() {
    const b = this.bus;
    this.bus = null;
    if (!b || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    try {
      b.gain.setValueAtTime(b.gain.value, t);
      b.gain.linearRampToValueAtTime(0, t + 0.4);
    } catch (e) { /* ignore */ }
    setTimeout(() => { try { b.disconnect(); } catch (e) { /* already gone */ } }, 700);
  }

  freq(semi) {
    return 523.25 * Math.pow(2, (this.key + semi) / 12);
  }

  // Schedule the backing track ~0.1 s ahead, mapped from frame time to audio time.
  schedule(now) {
    const sd = this.beatDur / 2;
    this.ensureBus();
    if (!this.audioOk()) {
      while (this.nextStep <= this.endStep && this.nextStep * sd <= now) this.nextStep++;
      return;
    }
    const ctxNow = audio.ctx.currentTime;
    if (this.audioBase === null || Math.abs(this.audioBase + now - ctxNow - 0.02) > 0.08) this.audioBase = ctxNow + 0.02 - now;
    while (this.nextStep <= this.endStep && this.nextStep * sd <= now + 0.1) {
      const at = this.audioBase + this.nextStep * sd;
      if (at >= ctxNow - 0.01) this.playStep(this.nextStep, Math.max(at, ctxNow + 0.005));
      this.nextStep++;
    }
  }

  playStep(s, at) {
    const out = this.bus;
    const slot = s % 8;
    const bar = Math.floor(s / 8);
    const sd = this.beatDur / 2;
    if (s === this.endStep) {
      for (const semi of [0, 4, 7]) audio.tone(this.freq(semi - 12), at, 1.3, { wave: 'square', vol: 0.022, out });
      audio.tone(this.freq(-24), at, 1.3, { wave: 'triangle', vol: 0.13, out });
      audio.drum('k', at, 0.1, out);
      audio.noise(at, 1.2, { vol: 0.05, filter: 'highpass', freq: 5000, out });
      return;
    }
    if (bar < INTRO / 4) {
      // count-in: drum sticks on every beat
      if (slot % 2 === 0) audio.tone(slot === 0 ? 1760 : 1320, at, 0.035, { wave: 'square', vol: 0.045, out });
      if (slot === 7) audio.drum('s', at, 0.05, out);
      return;
    }
    const cb = bar - INTRO / 4;
    const chord = this.prog[cb % this.prog.length];
    if (slot === 0 || slot === 4 || (this.difficulty >= 3 && slot === 3 && cb % 2 === 1)) audio.drum('k', at, 0.09, out);
    if (slot === 2 || slot === 6) audio.drum('s', at, 0.08, out);
    if (cb % 4 === 3 && slot === 7) audio.drum('s', at, 0.06, out);
    audio.drum('h', at, slot % 2 ? 0.035 : 0.055, out);
    const root = degToSemi(chord) - 24;
    audio.tone(this.freq(root + [0, 0, 12, 0, 0, 12, 0, 7][slot]), at, sd * 0.8, { wave: 'triangle', vol: 0.11, out });
    const arp = chord + [0, 2, 4, 7, 4, 2, 0, 2][slot];
    audio.tone(this.freq(degToSemi(arp) - 12), at, sd * 0.55, { wave: 'square', vol: 0.018, out });
  }

  sing(n, res) {
    if (!this.audioOk()) return;
    const t = audio.ctx.currentTime + 0.005;
    const out = this.bus;
    if (n.bar) {
      const r = degToSemi(n.chord) - 12;
      audio.tone(this.freq(r), t, 0.32, { wave: 'sawtooth', vol: 0.03, out });
      audio.tone(this.freq(r + 7), t, 0.32, { wave: 'square', vol: 0.025, out });
      audio.noise(t, 0.3, { vol: 0.05, filter: 'highpass', freq: 4000, out });
      return;
    }
    const f = this.freq(degToSemi(n.deg));
    const vol = res === 'good' ? 0.04 : 0.055;
    audio.tone(f, t, n.dur, { wave: 'square', vol, out });
    audio.tone(f / 2, t, n.dur, { wave: 'triangle', vol: 0.05, out });
  }

  blip(freq, dur, vol, wave = 'square') {
    if (!audio.ctx || audio.muted) return;
    audio.tone(freq, audio.ctx.currentTime + 0.005, dur, { wave, vol });
  }

  cheer(n = 10, span = 0.5) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + 0.01;
    for (let i = 0; i < n; i++) audio.noise(t + Math.random() * span, 0.05, { vol: 0.035, filter: 'bandpass', freq: 1500 + Math.random() * 2200 });
  }

  // ---------------------------------------------------------------- play
  now() {
    return (this.pt - 1) / 60;
  }

  beatPulse(now) {
    if (now < 0) return 0;
    const f = now / this.beatDur - Math.floor(now / this.beatDur);
    return Math.max(0, 1 - f * 4);
  }

  laneX(lane) {
    return this.hwX + lane * this.laneW + this.laneW / 2;
  }

  noteY(t, now) {
    return HIT_Y - (t - now) * this.speed;
  }

  liveScore() {
    return clamp((100 * (this.sum - this.penalty)) / Math.max(1, this.notes.length), 0, 100);
  }

  updatePlay(inp) {
    const now = this.now();
    this.schedule(now);

    if (!this.finished) {
      for (const k of this.keys) if (inp.pressed(k)) this.press(k, now);
      for (const n of this.notes) {
        if (n.time > now) break;
        if (!n.res && now - JUDGE_OFFSET - n.time > this.win.good) this.judge(n, 'miss', now, 1);
      }
      if (now > this.endTime + this.win.good + 0.05 && this.notes.every((n) => n.res)) this.finale(now);
    } else if (now - this.finT > 1.7) {
      this.end(Math.round(this.liveScore()), this.comment());
      return;
    }

    // visuals
    for (const f of this.fx) f.t++;
    this.fx = this.fx.filter((f) => f.t < f.life);
    for (const p of this.parts) {
      p.t++;
      p.x += p.vx + Math.sin((p.t + p.ph) * 0.15) * 0.25;
      p.y += p.vy;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const c of this.confetti) {
      c.t++;
      c.x += c.vx + Math.sin(c.t * 0.1 + c.ph) * 0.4;
      c.y += c.vy;
    }
    this.confetti = this.confetti.filter((c) => c.y < BAND_Y);
    for (let i = 0; i < this.beam.length; i++) {
      if (this.beam[i] > 0) this.beam[i]--;
      if (this.strayT[i] > 0) this.strayT[i]--;
    }
    if (this.jd) this.jd.t++;
    if (this.faceT > 0) this.faceT--;
    if (this.sweatT > 0) this.sweatT--;
    if (this.jumpT > 0) this.jumpT--;
  }

  press(k, now) {
    const t = now - JUDGE_OFFSET;
    const li = k === 'a' && this.lanes > 1 ? this.lanes : this.keys.indexOf(k);
    this.beam[li] = 10;
    let hit = null;
    for (const n of this.notes) {
      if (n.time - t > this.win.good) break;
      if (n.res || n.key !== k) continue;
      if (Math.abs(t - n.time) <= this.win.good) { hit = n; break; }
    }
    if (this.style === 'dance') {
      if (k === 'a') this.jumpT = 8;
      else { this.face = k; this.faceT = 14; }
    }
    if (!hit) {
      this.penalty += this.lanes === 1 ? 0.45 : STRAY;
      this.strays++;
      this.strayT[li] = 8;
      this.blip(240, 0.04, 0.025);
      return;
    }
    const dt = t - hit.time;
    const a = Math.abs(dt);
    const res = a <= this.win.perfect ? 'perfect' : a <= this.win.great ? 'great' : 'good';
    this.judge(hit, res, now, dt);
  }

  judge(n, res, now, dt) {
    n.res = res;
    n.jt = now;
    this.sum += VALUES[res];
    this.counts[res]++;
    this.volt += (VALUES[res] - this.volt) * 0.12;
    this.jd = { res, t: 0, tag: res === 'great' || res === 'good' ? (dt < 0 ? 'はやい' : 'おそい') : null };
    if (res === 'miss') {
      this.combo = 0;
      this.sweatT = 30;
      this.blip(110, 0.08, 0.03);
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.sing(n, res);
    const col = n.bar ? '#ffd23f' : this.laneDefs[n.lane].color;
    if (n.bar) this.fx.push({ bar: true, t: 0, life: 14, color: col, res });
    else this.fx.push({ x: this.laneX(n.lane), y: HIT_Y, t: 0, life: 14, color: col, res });
    // ♪ from the performer's mouth
    if (!n.bar) {
      const big = res === 'perfect';
      this.parts.push({
        x: PX + 36 + Math.random() * 4, y: PY + 12, vx: 0.25 + Math.random() * 0.45, vy: -0.65 - Math.random() * 0.45,
        t: 0, life: 60, ph: Math.random() * 40, color: JCOLOR[res] === '#8a90b0' ? '#fff' : JCOLOR[res], s: big ? 2 : 1,
      });
    }
    if (this.combo % 10 === 0) {
      this.popup(`${this.combo} COMBO！`, PX + 24, PY - 12, '#ff7eb6', 12);
      this.cheer(8, 0.4);
    }
  }

  finale(now) {
    this.finished = true;
    this.finT = now;
    const full = this.counts.miss === 0;
    const allPerfect = full && this.counts.perfect === this.notes.length;
    this.popup(allPerfect ? 'オールパーフェクト！' : full ? 'フルコンボ！' : 'フィニッシュ！', W / 2, 92, full ? '#ffd23f' : '#ffffff', 16);
    if (audio.ctx && !audio.muted) audio.sfx('applause');
    this.cheer(18, 1.0);
    for (let i = 0; i < 70; i++) {
      this.confetti.push({
        x: Math.random() * W, y: HW_TOP - Math.random() * 60, vx: (Math.random() - 0.5) * 0.6, vy: 0.6 + Math.random() * 0.9,
        t: 0, ph: Math.random() * 6, color: PEN_COLORS[i % PEN_COLORS.length], w: Math.random() < 0.5 ? 2 : 3,
      });
    }
  }

  comment() {
    const score = Math.round(this.liveScore());
    const word = this.style === 'dance' ? 'ダンス' : '歌声';
    const full = this.counts.miss === 0;
    if (full && this.counts.perfect === this.notes.length) return 'オールパーフェクト！伝説のステージだ！';
    if (full && score >= 75) return 'フルコンボ！会場が総立ちになった！';
    if (score >= 90) return `最高の${word}！アンコールが鳴りやまない！`;
    if (score >= 75) return 'ノリノリのステージ！お客さんも大満足！';
    if (score >= 55) return 'いいステージだった！リズム感が光ったね。';
    if (score >= 35) return 'リズムが少しずれちゃったかも…。';
    return 'リズムに乗りきれなかった…。練習あるのみ！';
  }

  end(score, comment) {
    super.end(score, comment);
    this.stopMusic();
  }

  // ---------------------------------------------------------------- drawing
  drawBackground(ctx) {
    ctx.drawImage(stageBackground(), 0, 0);
    ctx.fillStyle = 'rgba(4,2,12,0.55)';
    ctx.fillRect(0, 0, W, H);
  }

  drawPlay(ctx) {
    const now = this.now();
    const frame = this.g.frame || this.t;
    const pulse = this.beatPulse(now);
    const beat = now < 0 ? -1 : Math.floor(now / this.beatDur);
    ctx.drawImage(stageBackground(), 0, 0);
    this.drawLed(ctx, now, frame, pulse);
    this.drawLights(ctx, now, frame, pulse, beat);
    this.drawSpeaker(ctx, 6, 140, 28, 57, pulse, 2);
    this.drawSpeaker(ctx, 294, 116, 24, 81, pulse, 3);
    this.drawPerformer(ctx, now, pulse);
    for (const p of this.parts) {
      ctx.globalAlpha = clamp(1.4 - p.t / p.life, 0, 1);
      ctx.drawImage(noteGlyph(p.color, p.s), Math.round(p.x), Math.round(p.y));
    }
    ctx.globalAlpha = 1;
    this.drawHighway(ctx, now, pulse);
    this.drawCrowd(ctx, now, pulse);
    for (const c of this.confetti) {
      ctx.fillStyle = c.color;
      ctx.fillRect(Math.round(c.x), Math.round(c.y), c.w, (Math.floor(c.t / 6) % 2) + 1);
    }
    this.drawHud(ctx, now);
  }

  drawLed(ctx, now, frame, pulse) {
    const { x, y, w, h } = LED;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    // shimmering colour waves
    for (let gy = 0; gy < h; gy += 6) {
      for (let gx = 0; gx < w; gx += 6) {
        const v = Math.sin(gx * 0.07 + gy * 0.05 - frame * 0.05) + Math.sin(gx * 0.03 - gy * 0.09 + frame * 0.03);
        if (v < 0.9) continue;
        ctx.fillStyle = LED_COLORS[Math.floor((gx + gy + frame * 0.5) / 30) % LED_COLORS.length];
        ctx.globalAlpha = 0.18 + (v - 0.9) * 0.2;
        ctx.fillRect(x + gx, y + gy, 5, 5);
      }
    }
    ctx.globalAlpha = 1;
    // marquee
    const msg = `♪ ${this.songName}　★ ${this.performer} ライブ中！ ★　`;
    const mw = measure(ctx, msg, 10);
    const off = (frame * 0.6) % mw;
    for (let k = 0; k < 3; k++) text(ctx, msg, x + w - off - mw + k * mw, y + 3, { size: 10, color: '#ffd23f', shadow: null });
    rect(ctx, x, y + 16, w, 1, 'rgba(255,255,255,0.15)');
    // centre: combo / equaliser / finale
    const cx = x + w / 2;
    if (this.finished) {
      const col = LED_COLORS[Math.floor(frame / 6) % LED_COLORS.length];
      text(ctx, 'THANK YOU!', cx, y + 34, { size: 20, align: 'center', color: col, outline: '#000' });
      text(ctx, 'ありがとう！', cx, y + 62, { size: 12, align: 'center', color: '#fff', shadow: null });
    } else if (this.combo >= 5) {
      const col = this.combo >= 30 ? LED_COLORS[Math.floor(frame / 5) % LED_COLORS.length] : this.combo >= 15 ? '#ffd23f' : '#ffffff';
      text(ctx, String(this.combo), cx, y + 24 - Math.round(pulse * 2), { size: 32, align: 'center', color: col, outline: '#000' });
      text(ctx, 'COMBO', cx, y + 64, { size: 12, align: 'center', color: '#ff7eb6', shadow: null });
    } else {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const lv = now < 0 ? 1 + ((i + Math.floor(frame / 8)) % 3) : Math.round(2 + pulse * 5 * (0.5 + 0.5 * Math.sin(i * 1.7 + Math.floor(now / this.beatDur) * 2.3)) + (Math.sin(frame * 0.2 + i) + 1));
        for (let j = 0; j < lv; j++) {
          ctx.fillStyle = j >= 7 ? '#ff5d6c' : j >= 5 ? '#ffd23f' : '#5ee07a';
          ctx.fillRect(x + 8 + i * 9, y + h - 8 - j * 6, 7, 4);
        }
      }
    }
    ctx.drawImage(ledGrid(), x, y);
    ctx.restore();
  }

  drawLights(ctx, now, frame, pulse, beat) {
    const cans = [16, 46, 76, 106, 136, 306];
    // sweeping coloured beams (behind everything on stage)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beams = [[16, '#ff5fa2', 0], [136, '#5fd7ff', 2], [306, '#ffd23f', 4], [46, '#b77cff', 1]];
    for (const [bx, col, ph] of beams) {
      const a = Math.sin(frame * 0.012 + ph) * 0.55 + (bx > 160 ? -0.35 : 0.35);
      const s = 0.1;
      const L = 230;
      ctx.globalAlpha = 0.07 + pulse * 0.05;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(bx, 30);
      ctx.lineTo(bx + Math.sin(a - s) * L, 30 + Math.cos(a - s) * L);
      ctx.lineTo(bx + Math.sin(a + s) * L, 30 + Math.cos(a + s) * L);
      ctx.closePath();
      ctx.fill();
    }
    // main white spotlight on the performer
    ctx.globalAlpha = 0.09 + (this.finished ? 0.04 : 0);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.moveTo(PX + 18, 26);
    ctx.lineTo(PX + 30, 26);
    ctx.lineTo(PX + 62, 197);
    ctx.lineTo(PX - 14, 197);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 4; i++) {
      const hw = 36 - i * 6;
      ctx.fillRect(PX + 24 - hw, 193 + (i % 2), hw * 2, 3 - (i % 2));
    }
    ctx.restore();
    // cans on the truss
    cans.forEach((cx, i) => {
      rect(ctx, cx - 3, 25, 6, 5, '#26262e');
      rect(ctx, cx - 3, 25, 6, 1, '#4a4a58');
      const on = beat >= 0 && (beat + i) % 2 === 0;
      const col = PEN_COLORS[(i + Math.max(0, beat)) % PEN_COLORS.length];
      rect(ctx, cx - 2, 29, 4, 2, on ? col : shade(col, -0.5));
      if (on && pulse > 0) {
        ctx.globalAlpha = pulse * 0.5;
        rect(ctx, cx - 4, 31, 8, 2, col);
        ctx.globalAlpha = 1;
      }
    });
  }

  drawSpeaker(ctx, x, y, w, h, pulse, cones) {
    rect(ctx, x, y, w, h, '#0c0a12');
    rect(ctx, x, y, w, 1, '#3a3446');
    rect(ctx, x, y, 1, h, '#2a2636');
    rect(ctx, x + w - 1, y, 1, h, '#1a1622');
    const step = h / cones;
    const r = Math.floor(Math.min(w, step) / 2) - 3;
    for (let i = 0; i < cones; i++) {
      const cx = x + w / 2, cy = Math.round(y + step * i + step / 2);
      fillCircle(ctx, cx, cy, r + (pulse > 0.6 ? 1 : 0), '#2a2533');
      fillCircle(ctx, cx, cy, r - 2, '#3e3750');
      fillCircle(ctx, cx, cy, 2, '#6a6284');
    }
  }

  drawPerformer(ctx, now, pulse) {
    let dir = 'down';
    let frame = 0;
    if (this.style === 'dance') {
      if (this.faceT > 0) dir = this.face;
      if (now >= 0 && !this.finished) frame = [1, 0, 2, 0][Math.floor(now / this.beatDur) % 4];
    }
    let dy = -Math.round(pulse * 2);
    if (this.jumpT > 0) dy -= Math.round(Math.sin((this.jumpT / 8) * Math.PI) * 5);
    if (this.finished) dy -= Math.round(Math.abs(Math.sin(this.t * 0.15)) * 4);
    const set = this.sheet[dir] || this.sheet.down;
    const img = set[frame] || set[0];
    const x = PX, y = PY + dy;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 9, PY + 58, 30, 3);
    ctx.drawImage(img, x, y, 48, 60);
    if (this.style === 'sing' && dir === 'down') {
      // hand-held microphone held up to the mouth (sprite pixels x3)
      rect(ctx, x + 36, y + 32, 3, 11, '#24222c');
      rect(ctx, x + 32, y + 22, 11, 11, '#1a1822');
      rect(ctx, x + 33, y + 23, 9, 9, '#8a90a6');
      rect(ctx, x + 33, y + 23, 3, 3, '#e0e4f2');
      rect(ctx, x + 37, y + 26, 1, 1, '#5a6078');
      rect(ctx, x + 39, y + 28, 1, 1, '#5a6078');
      rect(ctx, x + 36, y + 29, 1, 1, '#5a6078');
    }
    if (this.sweatT > 0) {
      const sy = y + 4 + (30 - this.sweatT) * 0.3;
      rect(ctx, x + 45, sy, 2, 2, '#9fe3ff');
      rect(ctx, x + 44, sy + 2, 4, 3, '#5fbfff');
      rect(ctx, x + 45, sy + 5, 2, 1, '#5fbfff');
    }
  }

  drawHighway(ctx, now, pulse) {
    const S = sprites();
    const x0 = this.hwX, w = this.hwW, lw = this.laneW;
    const top = HW_TOP, hh = HW_BOT - HW_TOP;
    rect(ctx, x0 - 3, top, w + 6, hh, 'rgba(5,3,14,0.82)');
    const rail = mix('#5a3a9a', '#ff7eb6', pulse);
    rect(ctx, x0 - 3, top, 1, hh, rail);
    rect(ctx, x0 + w + 2, top, 1, hh, rail);
    for (let i = 1; i < this.lanes; i++) rect(ctx, x0 + i * lw, top, 1, hh, 'rgba(255,255,255,0.08)');
    // lane tint near the receptors
    for (let i = 0; i < this.lanes; i++) {
      const g = ctx.createLinearGradient(0, HIT_Y - 50, 0, HW_BOT);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, this.laneDefs[i].color + '30');
      ctx.fillStyle = g;
      ctx.fillRect(x0 + i * lw + 1, HIT_Y - 50, lw - 1, HW_BOT - HIT_Y + 50);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 3, top, w + 6, hh);
    ctx.clip();
    // beat lines
    const b0 = Math.ceil((now - 0.4) / this.beatDur);
    const b1 = Math.floor((now + this.travel + 0.3) / this.beatDur);
    for (let b = Math.max(0, b0); b <= b1; b++) {
      const y = Math.round(this.noteY(b * this.beatDur, now));
      if (y < top || y >= HW_BOT) continue;
      rect(ctx, x0, y, w, 1, b % 4 === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)');
    }
    // key beams
    for (let i = 0; i < this.lanes; i++) {
      if (this.beam[i] <= 0) continue;
      const g = ctx.createLinearGradient(0, HIT_Y - 80, 0, HIT_Y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, this.laneDefs[i].color);
      ctx.globalAlpha = (this.beam[i] / 10) * 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(x0 + i * lw + 1, HIT_Y - 80, lw - 1, 80);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // hit line + receptors
    const lineBoost = this.doubles && this.beam[this.lanes] > 0 ? 0.4 : 0;
    rect(ctx, x0 - 3, HIT_Y, w + 6, 1, `rgba(255,255,255,${0.55 + lineBoost})`);
    const spr = S.lane[this.lanes];
    for (let i = 0; i < this.lanes; i++) {
      const cx = Math.round(this.laneX(i)) - 11;
      ctx.drawImage(this.beam[i] > 0 ? spr[i].lit : spr[i].recv, cx, HIT_Y - 11 + (this.beam[i] > 6 ? 1 : 0));
      if (this.strayT[i] > 0) {
        ctx.globalAlpha = this.strayT[i] / 8;
        text(ctx, '×', cx + 11, HIT_Y + 10, { size: 10, align: 'center', color: '#ff5d6c', outline: '#000' });
        ctx.globalAlpha = 1;
      }
    }
    if (this.doubles) {
      const li = this.lanes;
      const tab = this.beam[li] > 0 ? S.tab.lit : S.tab.recv;
      ctx.drawImage(tab, x0 - 15, HIT_Y - 6);
      ctx.drawImage(tab, x0 + w + 3, HIT_Y - 6);
      if (this.strayT[li] > 0) {
        ctx.globalAlpha = this.strayT[li] / 8;
        rect(ctx, x0 - 3, HIT_Y, w + 6, 1, '#ff5d6c');
        ctx.globalAlpha = 1;
      }
    }
    // judgement text sits under the notes so it never hides an incoming one
    this.drawJudge(ctx);
    // notes: gold bars first, then arrows
    const ymin = top - 12, ymax = HW_BOT + 12;
    for (const n of this.notes) {
      if (!n.bar) continue;
      if (n.res && n.res !== 'miss') continue;
      const y = Math.round(this.noteY(n.time, now));
      if (y < ymin) break;
      if (y > ymax || y < top - 4 || y > HW_BOT - 4) continue;
      ctx.globalAlpha = n.res === 'miss' ? 0.3 : 1;
      this.drawBar(ctx, y);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 3, top, w + 6, hh);
    ctx.clip();
    for (const n of this.notes) {
      if (n.bar) continue;
      if (n.res && n.res !== 'miss') continue;
      const y = Math.round(this.noteY(n.time, now));
      if (y < ymin) break;
      if (y > ymax) continue;
      ctx.globalAlpha = n.res === 'miss' ? 0.3 : 1;
      ctx.drawImage(spr[n.lane].note, Math.round(this.laneX(n.lane)) - 11, y - 11);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // hit bursts
    for (const f of this.fx) {
      const k = f.t / f.life;
      ctx.globalAlpha = clamp(1 - k, 0, 1);
      if (f.bar) {
        rect(ctx, x0 - 3, HIT_Y - 3 - f.t, w + 6, 2 + f.t * 2, 'rgba(255,214,90,0.35)');
      } else {
        const s = Math.round(12 + f.t * 1.3);
        const c = f.res === 'perfect' ? '#ffffff' : f.color;
        rect(ctx, f.x - s, f.y - s, s * 2, 1, c);
        rect(ctx, f.x - s, f.y + s, s * 2 + 1, 1, c);
        rect(ctx, f.x - s, f.y - s, 1, s * 2, c);
        rect(ctx, f.x + s, f.y - s, 1, s * 2, c);
        if (f.res === 'perfect') {
          for (let i = 0; i < 4; i++) {
            const a = f.t * 0.25 + (i * Math.PI) / 2;
            sparkle(ctx, f.x + Math.cos(a) * (s + 3), f.y + Math.sin(a) * (s + 3), 2, f.color);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBar(ctx, y) {
    const S = sprites();
    const xa = this.hwX - 4, xb = this.hwX + this.hwW + 4;
    rect(ctx, xa, y - 4, xb - xa, 8, '#3a2200');
    rect(ctx, xa + 1, y - 3, xb - xa - 2, 6, '#ffc93a');
    rect(ctx, xa + 1, y - 3, xb - xa - 2, 1, '#fff2a8');
    rect(ctx, xa + 1, y + 2, xb - xa - 2, 1, '#c98a12');
    ctx.drawImage(S.tab.note, this.hwX - 15, y - 6);
    ctx.drawImage(S.tab.note, this.hwX + this.hwW + 3, y - 6);
  }

  drawJudge(ctx) {
    const j = this.jd;
    if (!j || j.t >= 36) return;
    const a = j.t < 26 ? 1 : 1 - (j.t - 26) / 10;
    const y = 132 - (j.t < 4 ? 4 - j.t : 0);
    ctx.globalAlpha = a;
    if (j.tag) text(ctx, j.tag, HW_CX, y - 13, { size: 10, align: 'center', color: j.tag === 'はやい' ? '#5fd7ff' : '#ffa43a', outline: '#000' });
    text(ctx, LABEL[j.res], HW_CX, y, { size: 14, align: 'center', color: JCOLOR[j.res], outline: '#000' });
    if (this.combo >= 2 && j.res !== 'miss') text(ctx, `${this.combo} COMBO`, HW_CX, y + 17, { size: 10, align: 'center', color: '#ffffff', outline: '#000' });
    ctx.globalAlpha = 1;
  }

  drawCrowd(ctx, now, pulse) {
    const bp = now < 0 ? 0 : now / this.beatDur;
    const hype = this.finished || this.combo >= 10;
    for (const f of this.fans) {
      const bob = hype && pulse > 0.4 ? -1 : 0;
      const hy = f.y + bob;
      const lit = this.finished || f.th < this.volt;
      if (lit) {
        const sway = Math.round(Math.sin((bp + f.ph * 0.15) * Math.PI) * 3);
        const bx = f.x + f.side * (f.r + 1);
        const by = hy - 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + pulse * 0.2;
        ctx.fillStyle = f.pen;
        ctx.fillRect(Math.round(bx + sway) - 2, by - 12, 5, 9);
        ctx.restore();
        for (let i = 0; i < 9; i++) {
          ctx.fillStyle = i < 3 ? '#2a2a34' : f.pen;
          ctx.fillRect(Math.round(bx + (sway * i) / 8), by - i, 2, 1);
        }
      }
      ctx.fillStyle = f.body;
      ctx.fillRect(Math.round(f.x - f.r - 2), hy + f.r - 1, f.r * 2 + 5, BAND_Y - hy);
      fillCircle(ctx, f.x, hy, f.r, f.body);
    }
  }

  drawHud(ctx, now) {
    rect(ctx, 0, 0, W, HUD_H, '#0b0820');
    const prog = clamp(now / (this.endTime || 1), 0, 1);
    rect(ctx, 0, HUD_H, W, 2, '#241a44');
    rect(ctx, 0, HUD_H, Math.round(W * prog), 2, '#ff7eb6');
    let name = `♪ ${this.songName}`;
    while (measure(ctx, name, 10) > 196 && name.length > 3) name = name.slice(0, -2) + '…';
    text(ctx, name, 4, 2, { size: 10, color: '#ffd23f' });
    text(ctx, `スコア ${Math.floor(this.liveScore())}`, W - 4, 2, { size: 10, align: 'right' });
    rect(ctx, 0, BAND_Y, W, H - BAND_Y, '#07050f');
    rect(ctx, 0, BAND_Y, W, 1, 'rgba(255,255,255,0.15)');
    const band = this.finished ? 'おつかれさま！ 大歓声だ！' : this.doubles ? `${this.lanes === 2 ? '← →' : '← ↓ ↑ →'} で演奏！ 金のバーは A！` : BAND_TEXT[this.lanes];
    text(ctx, band, W / 2, BAND_Y + 1, { size: 10, align: 'center', color: '#c8ccf0' });
  }
}

registerMinigame('rhythm', Rhythm);
