// 独裁くん と イクサくん — two advisor mascots for the regime road (js/engine/regime.js) and the war (regime.js + world.js).
//
//   独裁くん (dokusai): a smug, plump little king with a crown and a cape. Calm, flattering, ruthless. He coaches the road
//                      to dictatorship (the next step, the odds, the costs) and its upkeep (press, courts, army, party).
//   イクサくん (ikusa): a stocky bear in a campaign hat with a whistle. Crisp, drill-sergeant meets pop mascot. He coaches
//                      a war: the checklist before a declaration, the front, the next order, allies, ceasefire, supply.
//
// Both are FICTIONAL mascots (no person, no real emblem). Everything is abstract: numbers, odds and costs, no methods.
// Nothing is refused for being "bad" (BRIEF2): the advisors show the odds and the price, and run the real APIs.
//
// ---------------------------------------------------------------- public API (installed on Game.prototype at import)
//   g.advisor(id)               → { id, name, kana, short, color, title, profile, mood, expr, met, tipsOff, state }  (id 'dokusai' | 'ikusa')
//   g.advisorOpen(id, topic?)   → Promise  open the phone app of that advisor (topic: dokusai 'home' | 'next' | 'risk' | 'power' |
//                                 'status' | 'settings' | 'intro'; ikusa 'home' | 'before' | 'front' | 'orders' | 'diplo' |
//                                 'peace' | 'supply' | 'settings' | 'intro'). Returns null under g.auto unless g.auto.advisors.
//   g.advisorTip(key, opts?)    → bool  a small portrait + speech bubble, once per key (help level / tips off / cooldown rules as
//                                 assist.js tips). opts: { text, level 1|2|3, id, expr, force, silent, ctx }
//   g.advisorAdvice(id)         → [string]  the advisor's current advice lines (most urgent first), for other screens
//   plus: g.advisorState() (the saved state, created with defaults), g.advisorPlan(id) (dokusai: the roadmap; ikusa: the orders),
//   g.advisorTipClear(keys?), g.advisorLook(id) (the art spec), exports ADVISORS, drawAdvisorBust(c, id, x, y, k, opts),
//   drawAdvisorFace(c, id, x, y, scale, expr), advisorAdviceLines(g, id), dokusaiPlan(g), dokusaiRisks(g), ikusaChecklist(g, target),
//   ikusaOrders(g), TIPS, window.__advisors (tests).
// Help levels follow assist.js (g.helpLevel(): 'beginner' | 'normal' | 'expert'); ADVISOR tips respect g.assistState().tipsOff too.
// State g.state.advisor (old saves get the defaults on first use): see advisorState().

import { Game } from './game.js';
import { SW, SH, clamp, shade, mix, makeCanvas } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';
import { registerPhoneApp, onMorning, PEOPLE } from './life.js';
import * as PH from './phone.js';
import { eraOf } from './profile.js';

// ---------------------------------------------------------------- optional cores (guarded, literal paths)
let REG = null;
let POL = null;
let WORLD = null;
import('./regime.js').then((m) => { REG = m; hookRegime(m); }).catch(() => { REG = null; });
import('./politics.js').then((m) => { POL = m; hookPolitics(m); }).catch(() => { POL = null; });
import('./world.js').then((m) => { WORLD = m; }).catch(() => { WORLD = null; });

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { return d; } };
const today = (g) => (g && g.state ? g.state.day : 1);
const has = (g, name) => !!g && typeof g[name] === 'function';
function sfx(n) { try { audio.sfx(n); } catch (e) { /* tests */ } }
const pct = (p) => `${Math.round(clamp(num(p), 0, 1) * 100)}%`;
const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');
const signed = (n, d = 0) => `${n >= 0 ? '+' : '−'}${Math.abs(d ? Math.round(n * 10 ** d) / 10 ** d : Math.round(n))}`;

// ================================================================ pixel art kit (32x32 busts, the game's HD look)
// Shapes are painted back to front into a colour buffer; each shape gets a dark outline (OUT, the same #22202a as
// sprites.js) and three tones (base / shade / highlight) lit from the top left. Faces are painted last, pixel by pixel.
const OUT = '#22202a';
class Pix {
  constructor(w = 32, h = 32) { this.w = w; this.h = h; this.c = new Array(w * h).fill(null); }
  set(x, y, col) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col; }
  at(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y * this.w + x] : null; }
  // inside(x, y) with pixel centres; tone(x, y) → 0 base | 1 shade | 2 highlight
  shape(inside, base, o = {}) {
    const { w, h } = this;
    const m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) m[y * w + x] = 1;
    if (o.outline !== false) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!m[y * w + x]) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && !m[ny * w + nx]) this.c[ny * w + nx] = o.outline || OUT;
          }
        }
      }
    }
    const tones = [base, o.sh || shade(base, -0.24), o.hi || shade(base, 0.36)];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) this.c[y * w + x] = tones[o.tone ? o.tone(x + 0.5, y + 0.5) : 0] || base;
    return m;
  }
  px(col, pts) { for (const [x, y] of pts) this.set(x, y, col); }
  hline(col, x0, x1, y) { for (let x = x0; x <= x1; x++) this.set(x, y, col); }
  vline(col, x, y0, y1) { for (let y = y0; y <= y1; y++) this.set(x, y, col); }
  // rows of chars (palette map; '.' = nothing) stamped at x, y
  stamp(x, y, rows, pal, flip = false) {
    rows.forEach((row, j) => {
      const r = flip ? Array.from(row).reverse() : Array.from(row);
      r.forEach((ch, i) => { if (ch !== '.' && ch !== ' ' && pal[ch]) this.set(x + i, y + j, pal[ch]); });
    });
  }
}
const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const RC = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
function PG(pts) {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
// tone for a rounded body lit from the top left
const lit = (cx, cy, rx, ry, k = {}) => (x, y) => {
  const u = (x - cx) / rx, v = (y - cy) / ry, r2 = u * u + v * v;
  const d = u * (k.lx ?? 0.5) + v * (k.ly ?? 0.85);
  if (d > (k.sh ?? 0.6) && r2 > 0.3) return 1;
  if (-d > (k.hi ?? 0.66) && r2 > 0.12) return 2;
  return 0;
};
const flat = () => 0;
const bandTone = (ySplit) => (x, y) => (y >= ySplit ? 1 : 0);

// ---------------------------------------------------------------- the two characters
export const ADVISORS = {
  dokusai: {
    id: 'dokusai', name: '独裁くん', kana: 'どくさいくん', short: '独裁くん', color: '#8a1f3d', color2: '#f2c230',
    title: '権力の相談役（ちいさな王さま）',
    profile: '王冠とマントがトレードマークの、ぽっちゃりした小さな王さま。いつも落ち着いていて、ほめ上手。権力への道と、その維持を手伝う。',
    exprs: ['calm', 'scheme', 'worry', 'alarm'],
    moods: { calm: 'calm', order: 'calm', good: 'scheme', warn: 'worry', bad: 'alarm' },
  },
  ikusa: {
    id: 'ikusa', name: 'イクサくん', kana: 'いくさくん', short: 'イクサくん', color: '#5b6b2e', color2: '#f0a02a',
    title: '戦の教官（ちびっこ軍曹）',
    profile: '作戦帽とホイッスルがトレードマークの、ずんぐりしたクマの教官。歯切れのよい号令で、開戦前の確認から講和まで面倒を見る。',
    exprs: ['brisk', 'shout', 'wink', 'sweat'],
    moods: { calm: 'brisk', order: 'shout', good: 'wink', warn: 'sweat', bad: 'sweat' },
  },
};
export const ADVISOR_IDS = ['dokusai', 'ikusa'];
const DK = { // 独裁くん palette
  body: '#f0e8f8', bodySh: '#c8b8e0', bodyHi: '#ffffff', cape: '#a3213f', capeSh: '#6b1229', capeHi: '#d04a69', inner: '#4c1530',
  gold: '#f4c437', goldSh: '#b78510', goldHi: '#fff1a6', red: '#d9304a', blue: '#3a78e0', dark: '#2a2233', cheek: '#f5a9c0', mouth: '#7a1f33',
};
const IK = { // イクサくん palette
  fur: '#c68a4c', furSh: '#97612c', furHi: '#e6b274', muzzle: '#f6e0ba', muzzleSh: '#d8b98a', nose: '#3a2418', ear: '#e79aa0',
  hat: '#6e7d3a', hatSh: '#4b5828', hatHi: '#93a556', band: '#e8b93c', scarf: '#f0702a', scarfSh: '#b64a14', scarfHi: '#ff9a5a', dark: '#2a2233',
  mouth: '#7a1f33', tongue: '#e8566e', whistle: '#d4dbe6', whistleSh: '#8e9ab0', sweat: '#7ac8ff', cheek: '#f08a7a',
};

function paintDokusai(P, expr, o = {}) {
  const C = DK;
  // the cape behind the head: two high collar flaps
  P.shape(PG([[0, 31.9], [0, 17], [4, 13], [8.5, 22], [23.5, 22], [28, 13], [32, 17], [32, 31.9]]), C.cape, { tone: (x, y) => (y > 27 ? 1 : x < 3 || x > 29 ? 1 : 0), sh: C.capeSh });
  P.shape(PG([[1.4, 31.9], [1.4, 19], [4.2, 16], [7.4, 22], [8.2, 26], [8.2, 31.9]]), C.inner, { outline: false, tone: flat });
  P.shape(PG([[30.6, 31.9], [30.6, 19], [27.8, 16], [24.6, 22], [23.8, 26], [23.8, 31.9]]), C.inner, { outline: false, tone: flat });
  // the round body / head (an egg)
  P.shape(E(16, 16.5, 11.6, 12.3), C.body, { tone: lit(16, 16.5, 11.6, 12.3, { sh: 0.74, hi: 0.72 }), sh: C.bodySh, hi: C.bodyHi });
  // front drape of the cape with the gold edge and the brooch
  P.shape(PG([[3.2, 31.9], [5.5, 26.5], [16, 28.2], [26.5, 26.5], [28.8, 31.9]]), C.cape, { tone: (x, y) => (y > 30.2 ? 1 : x > 22 && y > 28.5 ? 1 : 0), sh: C.capeSh, hi: C.capeHi });
  P.hline(C.gold, 7, 25, 27); P.hline(C.goldSh, 8, 24, 28);
  P.shape(E(16, 29.4, 2.2, 1.9), C.gold, { tone: lit(16, 29.4, 2.2, 1.9), sh: C.goldSh, hi: C.goldHi });
  P.set(16, 29, C.red); P.set(15, 29, C.goldHi);
  // the crown (gold, three points, gems)
  const tilt = o.crownTilt || 0;
  P.shape(PG([[10 + tilt, 7.4], [9.6 + tilt, 1.4], [13.2 + tilt, 4.2], [16 + tilt, 0.2], [18.8 + tilt, 4.2], [22.4 + tilt, 1.4], [22 + tilt, 7.4]]), C.gold, { tone: (x, y) => (y > 5.2 ? 1 : x < 12 + tilt && y < 4 ? 2 : 0), sh: C.goldSh, hi: C.goldHi });
  P.hline(C.goldHi, 11 + tilt, 21 + tilt, 5);
  P.set(13 + tilt, 6, C.red); P.set(16 + tilt, 6, C.blue); P.set(19 + tilt, 6, C.red);
  // cheeks
  P.px(C.cheek, [[7, 19], [8, 19], [9, 19], [23, 19], [24, 19], [25, 19]]);
  // the monocle on the right eye (gold ring + glass + chain)
  P.shape(E(21.5, 15.2, 4.1, 4.1), '#e7f3ff', { outline: C.goldSh, tone: (x, y) => (x < 19.4 && y < 14 ? 2 : 0), hi: '#ffffff', sh: '#cfe2f5' });
  P.px(C.gold, [[18, 12], [19, 11], [20, 11], [21, 11], [22, 11], [23, 11], [24, 12], [25, 13], [25, 14], [25, 16], [25, 17], [24, 18], [23, 19], [22, 19], [21, 19], [20, 19], [19, 19], [18, 18], [17, 17]].filter(([x, y]) => (x - 21.5) ** 2 + (y - 15.2) ** 2 > 12));
  P.px(C.gold, [[26, 19], [26, 21], [27, 23], [26, 25]]);
  paintDokusaiFace(P, expr, o);
}
function paintDokusaiFace(P, expr, o = {}) {
  const C = DK, X = C.dark;
  const eyeL = { calm: ['XXXXXX', 'XwXXXX', '.XXXX.'], scheme: ['..XX..', '.X..X.', 'X....X'], worry: ['.XXXX.', 'XwXXXX', 'XXXXXX', '.XXXX.'], alarm: ['XX..XX', '.XXXX.', '..XX..'] };
  const pal = { X, w: '#ffffff' };
  const blink = !!o.blink && expr !== 'scheme';
  if (blink) { P.hline(X, 8, 13, 15); P.hline(X, 18, 23, 15); } else {
    const rows = eyeL[expr] || eyeL.calm;
    const dy = expr === 'worry' ? -1 : 0;
    P.stamp(8, 14 + dy, rows, pal);
    P.stamp(18, 14 + dy, rows, pal, true);
  }
  // eyebrows
  if (expr === 'calm') { P.hline(X, 8, 13, 12); P.hline(X, 18, 23, 12); P.set(7, 13, X); }
  if (expr === 'scheme') { P.px(X, [[8, 11], [9, 11], [10, 12], [11, 12], [12, 13], [13, 13]]); P.px(X, [[18, 11], [19, 10], [20, 10], [21, 10], [22, 11], [23, 12]]); }
  if (expr === 'worry') { P.px(X, [[8, 11], [9, 10], [10, 9], [11, 9], [12, 9]]); P.px(X, [[19, 9], [20, 9], [21, 9], [22, 10], [23, 11]]); }
  if (expr === 'alarm') { P.px(X, [[7, 11], [8, 11], [9, 12], [10, 12], [11, 13], [12, 13], [13, 14]]); P.px(X, [[24, 11], [23, 11], [22, 12], [21, 12], [20, 13], [19, 13], [18, 14]]); }
  // mouth
  if (expr === 'calm') { P.px(X, [[13, 21], [14, 22], [15, 22], [16, 22], [17, 22], [18, 22], [19, 21]]); }
  if (expr === 'scheme') {
    P.hline(X, 11, 21, 21); P.set(10, 20, X); P.set(22, 20, X);
    P.hline('#ffffff', 12, 20, 22); P.hline(C.mouth, 12, 20, 23); P.hline(X, 13, 19, 24); P.px(X, [[11, 22], [21, 22], [12, 24], [20, 24]]);
    P.px('#ffffff', [[13, 23], [19, 23]]);
  }
  if (expr === 'worry') { P.px(X, [[13, 23], [14, 22], [15, 22], [16, 22], [17, 22], [18, 22], [19, 23]]); P.px('#7ac8ff', [[28, 9], [27, 10], [28, 10], [29, 10], [28, 11], [28, 12]]); }
  if (expr === 'alarm') {
    P.hline(X, 12, 20, 20); P.hline(X, 11, 21, 21); P.hline(C.mouth, 12, 20, 22); P.hline(C.mouth, 12, 20, 23); P.hline(X, 13, 19, 24);
    P.px('#ff8a9a', [[14, 23], [15, 23], [16, 23], [17, 23]]); P.px('#ffffff', [[12, 21], [13, 21], [19, 21], [20, 21]]);
    // anger marks and a flying drop
    P.px('#ff4a4a', [[3, 7], [4, 7], [3, 8], [4, 9], [5, 9], [5, 8], [6, 8]]);
    P.px('#7ac8ff', [[28, 8], [27, 9], [28, 9], [29, 9], [28, 10]]);
  }
  if (expr === 'scheme') {
    // a glint on the monocle
    P.px('#ffffff', [[19, 13], [19, 14], [20, 13]]);
  }
}
function paintIkusa(P, expr, o = {}) {
  const C = IK;
  // ears
  for (const [cx, inner] of [[6.2, 6.4], [25.8, 25.6]]) {
    P.shape(E(cx, 11.2, 4.4, 4.4), C.fur, { tone: lit(cx, 11.2, 4.4, 4.4), sh: C.furSh, hi: C.furHi });
    P.shape(E(inner, 11.8, 2.3, 2.5), C.ear, { outline: false, tone: flat });
  }
  // head (round)
  P.shape(E(16, 19.6, 12.6, 10.4), C.fur, { tone: lit(16, 19.6, 12.6, 10.4, { sh: 0.58, hi: 0.72 }), sh: C.furSh, hi: C.furHi });
  // muzzle and nose
  P.shape(E(16, 24, 6.8, 4.6), C.muzzle, { tone: (x, y) => (y > 26.6 ? 1 : 0), sh: C.muzzleSh });
  P.shape(E(16, 21.4, 2.2, 1.4), C.nose, { outline: false, tone: flat });
  P.px('#6a4a3a', [[15, 20], [16, 20]]);
  // cheeks
  P.px(C.cheek, [[5, 22], [6, 22], [7, 22], [25, 22], [26, 22], [27, 22]]);
  // scarf (orange) and knot
  P.shape(PG([[2, 31.9], [3.5, 28.2], [16, 31.2], [28.5, 28.2], [30, 31.9]]), C.scarf, { tone: (x, y) => (y > 30.4 ? 1 : 0), sh: C.scarfSh, hi: C.scarfHi });
  P.shape(E(24.2, 30, 3.4, 2.5), C.scarf, { tone: lit(24.2, 30, 3.4, 2.5), sh: C.scarfSh, hi: C.scarfHi });
  P.px(C.scarfHi, [[5, 29], [8, 30], [11, 30], [14, 31]]);
  // the campaign hat: flat round brim, tall pinched crown, gold band and a badge
  P.shape(PG([[8.4, 10], [9.2, 1.6], [12, 0.4], [20, 0.4], [22.8, 1.6], [23.6, 10]]), C.hat, { tone: (x, y) => (x > 20.6 ? 1 : x < 11 && y < 6 ? 2 : 0), sh: C.hatSh, hi: C.hatHi });
  P.shape(E(16, 1.4, 6.5, 1.8), C.hatHi, { tone: flat });
  P.vline(C.hatSh, 16, 2, 8); // the pinch
  P.shape(E(16, 10.6, 15.4, 2.7), C.hat, { tone: (x, y) => (y > 11.6 ? 1 : x < 8 && y < 10 ? 2 : 0), sh: C.hatSh, hi: C.hatHi });
  P.hline(C.band, 9, 23, 7); P.hline(C.band, 9, 23, 8); P.hline('#b88a1c', 9, 23, 9);
  P.shape(PG([[16, 5.4], [18.3, 8], [16, 10.4], [13.7, 8]]), '#fff3d0', { outline: '#8a6a1c', tone: flat });
  P.set(16, 7, C.hatSh); P.set(16, 8, C.hatSh);
  paintIkusaFace(P, expr, o);
}
function paintIkusaFace(P, expr, o = {}) {
  const C = IK, X = C.dark;
  const pal = { X, w: '#ffffff' };
  const eyes = {
    brisk: ['.XXX.', 'XwXXX', 'XXXXX', '.XXX.'],
    shout: ['XX...', '.XXX.', '...XX', '.XXX.', 'XX...'],
    wink: ['.XXX.', 'XwXXX', 'XXXXX', '.XXX.'],
    sweat: ['..X..', '.XXX.', 'XwXXX', 'XXXXX', '.XXX.'],
  };
  const blink = !!o.blink && expr !== 'shout' && expr !== 'wink';
  const ey = 15;
  if (blink) { P.hline(X, 6, 11, 17); P.hline(X, 21, 26, 17); } else if (expr === 'shout') {
    P.stamp(6, ey, eyes.shout, pal);
    P.stamp(21, ey, eyes.shout, pal, true);
  } else if (expr === 'wink') {
    P.stamp(6, ey, eyes.wink, pal);
    P.px(X, [[21, 17], [22, 16], [23, 16], [24, 16], [25, 17]]); // the winking eye ^
    P.px('#ffffff', [[28, 12], [28, 14], [27, 13], [29, 13]]); // a sparkle
  } else {
    const rows = eyes[expr] || eyes.brisk;
    const dy = expr === 'sweat' ? -1 : 0;
    P.stamp(6, ey + dy, rows, pal);
    P.stamp(21, ey + dy, rows, pal, true);
  }
  // brows
  if (expr === 'brisk') { P.px(X, [[5, 13], [6, 13], [7, 14], [8, 14], [9, 14], [10, 15]]); P.px(X, [[21, 12], [22, 11], [23, 11], [24, 11], [25, 12]]); }
  if (expr === 'shout') { P.px(X, [[5, 12], [6, 12], [7, 13], [8, 13], [9, 14], [10, 14]]); P.px(X, [[26, 12], [25, 12], [24, 13], [23, 13], [22, 14], [21, 14]]); }
  if (expr === 'wink') { P.px(X, [[6, 13], [7, 13], [8, 13], [9, 13]]); P.px(X, [[22, 12], [23, 11], [24, 11], [25, 12]]); }
  if (expr === 'sweat') { P.px(X, [[6, 13], [7, 12], [8, 11], [9, 11], [10, 11]]); P.px(X, [[21, 11], [22, 11], [23, 11], [24, 12], [25, 13]]); }
  // mouth (on the muzzle, centre x 16)
  if (expr === 'brisk') {
    P.hline(X, 12, 20, 24); P.set(11, 23, X); P.set(21, 23, X);
    P.hline('#ffffff', 12, 20, 25); P.hline(C.mouth, 12, 20, 26); P.px(C.tongue, [[15, 27], [16, 27], [17, 27]]); P.hline(X, 13, 19, 28); P.px(X, [[12, 27], [20, 27]]);
  }
  if (expr === 'shout') {
    P.hline(X, 11, 21, 23); P.hline(C.mouth, 11, 21, 24); P.hline(C.mouth, 11, 21, 25); P.hline(C.mouth, 12, 20, 26); P.hline(C.mouth, 13, 19, 27); P.hline(X, 14, 18, 28);
    P.px(X, [[10, 24], [10, 25], [11, 26], [12, 27], [13, 28], [22, 24], [22, 25], [21, 26], [20, 27], [19, 28]]);
    P.hline(C.tongue, 14, 18, 27); P.hline('#ffffff', 12, 20, 24);
    // the whistle
    P.shape(RC(19, 23, 24, 25), C.whistle, { outline: X, tone: (x, y) => (y > 24 ? 1 : 0), sh: C.whistleSh });
    P.shape(E(24.6, 25.4, 2.2, 2.2), C.whistle, { outline: X, tone: lit(24.6, 25.4, 2.2, 2.2), sh: C.whistleSh });
    P.set(24, 25, X);
    // shouting marks
    P.px('#ffffff', [[1, 14], [2, 13], [1, 16], [0, 15], [30, 14], [29, 13], [30, 16], [31, 15]]);
  }
  if (expr === 'wink') {
    P.hline(X, 12, 20, 24); P.set(11, 23, X); P.set(21, 23, X);
    P.hline('#ffffff', 13, 19, 25); P.hline(C.mouth, 13, 19, 26); P.hline(X, 14, 18, 27);
  }
  if (expr === 'sweat') {
    P.px(X, [[13, 27], [14, 26], [15, 26], [16, 26], [17, 26], [18, 26], [19, 27]]);
    P.px(C.sweat, [[29, 12], [28, 13], [29, 13], [30, 13], [29, 14], [29, 15]]); P.px('#ffffff', [[29, 13]]);
  }
}
// canvases, cached per advisor / expression (/ blink)
const ART = new Map();
export function advisorBustCanvas(id, expr, o = {}) {
  const A = ADVISORS[id];
  if (!A) return null;
  const ex = A.exprs.includes(expr) ? expr : A.exprs[0];
  const key = `${id}:${ex}:${o.blink ? 'b' : ''}:${o.crownTilt || 0}`;
  let cv = ART.get(key);
  if (cv) return cv;
  const P = new Pix(32, 32);
  if (id === 'dokusai') paintDokusai(P, ex, { blink: o.blink, crownTilt: expr === 'alarm' ? 1 : 0 }); else paintIkusa(P, ex, { blink: o.blink });
  const [c, x] = makeCanvas(32, 32);
  const img = x.createImageData(32, 32);
  P.c.forEach((col, i) => {
    if (!col) return;
    const n = parseInt(col.slice(1), 16);
    img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
  });
  x.putImageData(img, 0, 0);
  ART.set(key, c);
  return c;
}
export function exprOfMood(id, mood) { const A = ADVISORS[id]; return A ? A.moods[mood] || A.exprs[0] : 'calm'; }
// the bust at an integer scale k, optionally on a framed card of the advisor's colours
export function drawAdvisorBust(c, id, x, y, k = 2, o = {}) {
  const A = ADVISORS[id];
  if (!A) return;
  const w = 32 * k, h = 32 * k;
  if (o.card !== false) cardBack(c, id, x - 2, y - 2, w + 4, h + 4);
  const cv = advisorBustCanvas(id, o.expr || A.exprs[0], o);
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, Math.round(x), Math.round(y), w, h);
  c.restore();
}
// a face crop for name tags (the top 24 rows), at `scale` (snapped to crisp device pixels as drawFaceHD does)
export function drawAdvisorFace(c, id, x, y, scale = 1, expr = null, o = {}) {
  const A = ADVISORS[id];
  if (!A) return;
  const cv = advisorBustCanvas(id, expr || A.exprs[0], o);
  let k = scale, ox = 0, oy = 0;
  const m = c.getTransform ? c.getTransform() : null;
  const dev = m && !m.b && !m.c ? Math.abs(m.a) : 0;
  if (dev > 0 && scale * dev >= 1) {
    k = Math.max(1, Math.floor(scale * dev + 1e-6)) / dev;
    ox = Math.round(((32 * (scale - k)) / 2) * dev) / dev;
    oy = Math.round(((26 * (scale - k)) / 2) * dev) / dev;
  }
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(cv, 0, 0, 32, 26, Math.round(x) + ox, Math.round(y) + oy, 32 * k, 26 * k);
  c.restore();
}
function rectFill(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
// the card behind a portrait: dokusai = deep wine with gold stripes; ikusa = khaki with olive diagonal bands
function cardBack(c, id, x, y, w, h) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const A = ADVISORS[id];
  const edge = id === 'dokusai' ? '#3a0f1f' : '#2f3a16';
  rectFill(c, x + 1, y, w - 2, 1, edge); rectFill(c, x + 1, y + h - 1, w - 2, 1, edge); rectFill(c, x, y + 1, 1, h - 2, edge); rectFill(c, x + w - 1, y + 1, 1, h - 2, edge);
  rectFill(c, x + 1, y + 1, w - 2, h - 2, id === 'dokusai' ? '#5a1830' : '#cfd89a');
  c.save();
  c.beginPath(); c.rect(x + 1, y + 1, w - 2, h - 2); c.clip();
  if (id === 'dokusai') {
    for (let i = -h; i < w; i += 8) { c.fillStyle = 'rgba(244,196,55,0.18)'; for (let j = 0; j < h; j++) c.fillRect(x + i + j, y + j, 2, 1); }
    rectFill(c, x + 1, y + h - 5, w - 2, 4, '#3a0f1f'); rectFill(c, x + 1, y + h - 6, w - 2, 1, A.color2);
  } else {
    for (let i = -h; i < w; i += 10) { c.fillStyle = 'rgba(94,110,40,0.28)'; for (let j = 0; j < h; j++) c.fillRect(x + i + j, y + j, 4, 1); }
    rectFill(c, x + 1, y + h - 5, w - 2, 4, '#5b6b2e'); rectFill(c, x + 1, y + h - 6, w - 2, 1, '#e8b93c');
  }
  c.restore();
}

// ================================================================ state (saved; old saves get the defaults on first use)
// g.state.advisor = { v: 1, tips { key: day }, seen { key: day }, met { id: day }, flags {…}, stats { id: { opened, actions } },
//   tipsOff, muted { id: true }, target (the war's chosen target id), log [{ day, id, text }] (≤ 30), tipDay, tipsToday }
export function advisorState(g) {
  const st = g && g.state;
  if (!st) return null;
  let a = st.advisor;
  if (a && a.v === 1 && a.tips && a.seen && a.met && a.flags && a.stats && a.muted && Array.isArray(a.log)) return a;
  if (!a || typeof a !== 'object' || Array.isArray(a)) a = st.advisor = {};
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  a.v = 1;
  for (const k of ['tips', 'seen', 'met', 'flags', 'muted']) a[k] = obj(a[k]);
  a.stats = obj(a.stats);
  for (const id of ADVISOR_IDS) { const s0 = obj(a.stats[id]); a.stats[id] = { opened: num(s0.opened), actions: num(s0.actions) }; }
  a.tipsOff = !!a.tipsOff;
  a.target = typeof a.target === 'string' ? a.target : '';
  a.tipDay = num(a.tipDay);
  a.tipsToday = num(a.tipsToday);
  a.log = (Array.isArray(a.log) ? a.log : []).filter((l) => l && typeof l.text === 'string').slice(-30);
  return a;
}
function logAct(g, id, textLine) {
  const a = advisorState(g);
  if (!a) return;
  a.log.push({ day: today(g), id, text: String(textLine).slice(0, 80) });
  if (a.log.length > 30) a.log.splice(0, a.log.length - 30);
  a.stats[id].actions++;
}

// ================================================================ small readers (every core feature-detected)
const lvlOf = (g) => safe(() => g.helpLevel(), 'normal');
const isExpert = (g) => lvlOf(g) === 'expert';
const isBeginner = (g) => lvlOf(g) === 'beginner';
const nameOf = (g) => (g && g.state && g.state.name) || 'あなた';
const eraKey = (g) => safe(() => (g.state.profile && g.state.profile.era) || 'reiwa', 'reiwa');
const deviceWord = (g) => safe(() => eraOf(g.state).deviceShort, 'スマホ') || 'スマホ';
// the standard normal CDF (Abramowitz-Stegun)
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const polOf = (g) => safe(() => (has(g, 'pol') ? g.pol() : null), null);
const isPMOf = (g) => { const p = polOf(g); return !!(p && p.cabinet && p.cabinet.pm === 'player'); };
const approvalOf = (g) => { const p = polOf(g); return p && p.cabinet ? num(p.cabinet.approval, 40) : 40; };
const regimeOf = (g) => safe(() => (has(g, 'regime') ? g.regime() : null), null) || { id: 'democracy', name: '民主制', steps: {}, unrest: 0, intl: 0, sanctions: 0, amend: null, label: '', labelWhy: '', approvalMod: 0, history: [] };
const stateRegime = (g) => safe(() => g.state.regime, null) || {};
function seatsOf(p, house) {
  const H = p && p.diet && p.diet[house];
  if (!H || !H.seats) return null;
  const total = num(H.total) || Object.values(H.seats).reduce((a, v) => a + num(v), 0);
  const ids = (p.cabinet && p.cabinet.partyIds) || [];
  const mine = p.me && p.me.party;
  return { total, own: num(H.seats[mine]), ruling: ids.reduce((a, id) => a + num(H.seats[id]), 0), majority: Math.floor(total / 2) + 1, need2: Math.ceil((total * 2) / 3), seats: H.seats };
}
function partyOfPlayer(g) {
  const p = polOf(g);
  const me = p && p.me;
  if (!me || !me.party) return null;
  const pt = p.parties && p.parties[me.party];
  const def = POL && POL.PARTY_DEFS && POL.PARTY_DEFS[me.party];
  return { id: me.party, name: (pt && pt.name) || (def && def.name) || '所属政党', real: !!((pt && pt.real) || (def && def.real)), own: !!(pt && pt.isPlayers), leader: !!(pt && pt.leader === 'player') };
}
const isRealId = (p, id) => { const pt = p && p.parties && p.parties[id]; const def = POL && POL.PARTY_DEFS && POL.PARTY_DEFS[id]; return !!((pt && pt.real) || (def && def.real)); };
const partyLabel = (p, id) => { const pt = p && p.parties && p.parties[id]; return (pt && (pt.short || pt.name)) || id; };
function sessionOn(g) { const p = polOf(g); const S = p && p.diet && p.diet.session; return !!(S && today(g) >= num(S.start) && today(g) <= num(S.end)); }
function stepRows(g) {
  const rows = safe(() => (has(g, 'regimeSteps') ? g.regimeSteps() : []), []) || [];
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}
const pressRows = (g) => Object.fromEntries((safe(() => (has(g, 'pressActions') ? g.pressActions() : []), []) || []).map((r) => [r.id, r]));
function breakawayShare(g) {
  // the share of the old party's members who follow into the new party (regime.js breakaway): 0.1 + standing/300 + (approval-30)/300 + 0.08 (PM) + 0..0.06
  const p = polOf(g);
  const st = p && p.me ? num(p.me.standing, 60) : 60;
  const base = 0.1 + st / 300 + (approvalOf(g) - 30) / 300 + (isPMOf(g) ? 0.08 : -0.05);
  return { lo: clamp(base, 0.05, 0.45), hi: clamp(base + 0.06, 0.05, 0.45) };
}
// the player's party must break first: a real party, or a PM who does not lead their party (regime.js needsBreak)
function needsBreak(g) {
  const pi = partyOfPlayer(g);
  if (pi && pi.real) return true;
  return !!(isPMOf(g) && (!pi || !pi.leader));
}
// The 発議 vote's odds: the real vote is random (regime.js amendVotes: own seats × loyalty, partners 35–65%, 無所属 0–20%); a normal
// approximation of "yes ≥ 2/3". afterBreak: the numbers if the player first leaves a real party (the followers' share).
function amendOdds(g, house, afterBreak = false) {
  const p = polOf(g);
  const S = seatsOf(p, house);
  const pi = partyOfPlayer(g);
  if (!S || !pi) return { p: 0, yes: 0, need: S ? S.need2 : 0, total: S ? S.total : 0, sd: 0 };
  let ownSeats = pi.real ? 0 : S.own;
  let loyal = pi.own ? 0.97 : 0.85;
  let partners = ((p.cabinet && p.cabinet.partyIds) || []).filter((id) => id !== pi.id && !isRealId(p, id)).reduce((a, id) => a + num(S.seats[id]), 0);
  if (afterBreak && needsBreak(g)) {
    const f = breakawayShare(g);
    const m = (f.lo + f.hi) / 2;
    ownSeats = Math.round(S.own * m);
    loyal = 0.97;
  }
  const ap = approvalOf(g);
  const loyalty = clamp(loyal - (ap < 35 ? (35 - ap) / 200 : 0), 0.6, 0.99);
  const ind = num(S.seats.ind);
  const mean = ownSeats * loyalty + partners * 0.5 + ind * 0.1;
  const vr = ownSeats * loyalty * (1 - loyalty) + (partners * 0.0866) ** 2 + (ind * 0.0577) ** 2;
  const sd = Math.sqrt(Math.max(vr, 0.25));
  return { p: clamp(1 - phi((S.need2 - 0.5 - mean) / sd), 0.01, 0.97), yes: Math.round(mean), need: S.need2, total: S.total, sd };
}
const bothHouses = (g, ab = false) => { const s = amendOdds(g, 'shugi', ab), a = amendOdds(g, 'sangi', ab); return { s, a, p: s.p * a.p }; };
// the 国民投票 odds: the projection (%, no random part) and the real noise (≈ ±1 point)
function refOdds(g, which = 'amend') {
  const pr = safe(() => (which === 'art9' ? (g.warPaths() || {}).referendum9 : g.regimeReferendumProjection()), null);
  if (!pr) return { yes: 0, p: 0, bySeg: {} };
  return { yes: num(pr.yes), p: clamp(phi((num(pr.yes) - 50) / 2.2), 0.02, 0.95), bySeg: pr.bySeg || {} };
}
const SEG_FALLBACK = { young: '若者', families: '子育て世帯', elderly: '高齢者', employees: '会社員', selfemployed: '自営業', business: '経営者', farmers: '農林漁業', unions: '労組', urban: '都市部', rural: '地方', floating: '無党派' };
function segName(id) { return safe(() => POL.SEGMENTS[id].name, null) || SEG_FALLBACK[id] || id; }
// the days until a date number (game days)
const daysLeft = (g, day) => Math.max(0, num(day) - today(g));
function dateText(g, day) { return safe(() => POL.dateLabel(g, day).replace(/^\d+年/, ''), null) || `${day}日目`; }
function warOf(g) { return safe(() => (has(g, 'war') ? g.war() : null), null); }
function worldOf(g) { return safe(() => (has(g, 'world') ? g.world() : null), null); }
const FICT = () => (REG && REG.FICTIONAL_NATIONS) || {};
const milJP = (g) => safe(() => WORLD.milPower(g, 'jp'), null) || 50;
function moodWord(p) { return p >= 0.7 ? '高い' : p >= 0.45 ? 'ふつう' : p >= 0.2 ? '低い' : 'きびしい'; }
const oddsColor = (p) => (p == null ? '#7c7a88' : p >= 0.6 ? '#2f9a4a' : p >= 0.35 ? '#c8861a' : '#d6304a');

// ================================================================ 独裁くん: the road, the risks, the upkeep
// The price of a step. A read-only mirror of regime.js backlash() / the steps' own lines (目安): a step of size s in the democracy
// costs approval −(3+3s) (×0.6 once the regime is not a democracy) and lasting −(1+1.5s), unrest +s×(2|3), intl +s×(2|4), and
// 造反 (the player's party loses (2|5)% × s of its seats while the regime is not yet a dictatorship).
const STEP_COST = {
  amend_emergency: { size: 2 },
  declare_emergency: { size: 2, press: -6 },
  self_coup: { size: 3, unrest: 8, intl: 12, press: -10 },
  suspend_elections: { size: 3, press: -4, court: '6〜14日後に最高裁が違憲と判断する（従えば取り消し、無視すれば以後は出ない）' },
  suspend_diet: { size: 3, court: '6〜14日後に最高裁が違憲と判断する（従えば取り消し、無視すれば以後は出ない）' },
  ban_opposition: { size: 3, intl: 3, press: -6, court: '6〜14日後に最高裁が違憲と判断する' },
  national_army: { size: 3, intl: 5, note: '抗議して自衛隊員の約8,000〜20,000人が辞職する' },
};
function stepCosts(g, id) {
  const S = STEP_COST[id];
  const r = regimeOf(g);
  const out = [];
  if (id === 'amend_article9') return ['支持率 −2（じわじわ −1）', '9条改正に反対する中規模のデモ'];
  if (id === 'referendum_law') return ['法案として国会で審議される（成立するかは与党の議席しだい）'];
  if (id === 'lift_emergency') return ['支持率 +4・民衆の不満 −15・国際社会の懸念 −10', '緊急事態で得た権限はなくなる'];
  if (id === 'democratize') return ['退陣する。選挙と国会が戻る（不満 −40・懸念 −30）', 'これまでの行為は法で裁かれる（特捜の捜査・起訴の可能性）。二度と入閣できない'];
  if (!S) return out;
  const dem = r.id === 'democracy', k = dem ? 1 : 0.6;
  out.push(`支持率 ${signed(-(3 + S.size * 3) * k, 1)}（さらにじわじわ ${signed(-(1 + S.size * 1.5), 1)}）`);
  out.push(`民衆の不満 +${S.size * (dem ? 2 : 3) + (S.unrest || 0)}・国際社会の懸念 +${S.size * (dem ? 2 : 4) + (S.intl || 0)}`);
  if (S.press) out.push(`報道の自由度 ${S.press}`);
  if (r.id !== 'dictatorship') { const pi = partyOfPlayer(g); out.push(`造反：自党の議員の約${(pi && pi.own ? 2 : 5) * S.size}%が党を離れる`); }
  out.push(S.size >= 3 ? '大規模なデモが起きる' : '中規模のデモが起きる');
  if (S.court) out.push(S.court);
  if (S.note) out.push(S.note);
  return out;
}
const STEP_SAY = {
  amend_emergency: '憲法に「非常時の切り札」を書き込む作戦ですよぉ。3分の2、数がものを言います。',
  declare_emergency: '切り札を、ここで抜く。ふふ、国民はたいてい「非常時だから」と言ってくれます。',
  self_coup: '正面の門が閉まっているなら、塀を越えるのも手。ただし、従ってくれるかは賭けです。',
  suspend_elections: '選挙がなければ、任期は永遠。お客さまの機嫌をうかがう必要もありません。',
  suspend_diet: '国会を閉じれば、反対の声は壁にぶつかるだけ。政令で全部決められます。',
  ban_opposition: '野党がいなければ、野党への心配もいりませんねぇ。',
  national_army: '自衛隊を国軍に。……戦争をするなら、必須の看板です。',
};

// The road. items: { id, title, state: 'done'|'can'|'wait'|'info', detail[], costs[], odds, oddsText, act, why, rec, explain, say, optional, danger }
export function dokusaiPlan(g) {
  const r = regimeOf(g);
  const rows = stepRows(g);
  const p = polOf(g);
  const pm = isPMOf(g);
  const items = [];
  const it = (o) => { const x = { state: 'wait', detail: [], costs: [], odds: null, oddsText: '', act: null, why: null, rec: false, explain: '', say: '', optional: false, danger: false, ...o }; items.push(x); return x; };
  const stepAct = (id, extra = {}) => ({ kind: 'step', id, name: (rows[id] && rows[id].name) || id, ...extra });
  const out = (stage, headline, mood) => ({ stage, headline, mood, items, ctx: { regime: r.id, pm } });
  const nm = nameOf(g);
  if (r.id === 'fallen') return out('fallen', '体制はもう崩れている。', 'bad');

  // ---- not the PM yet: the way to the top
  if (!pm && r.id === 'democracy') {
    const me = p && p.me;
    const office = me && me.office;
    const pi = partyOfPlayer(g);
    const S = seatsOf(p, 'shugi');
    const inDiet = office === 'shugi' || office === 'sangi';
    const nextEl = safe(() => (has(g, 'upcomingElections') ? g.upcomingElections().find((e) => !e.newsOnly && (e.kind === 'shugi' || e.kind === 'sangi')) : null), null);
    it({ id: 'seat', title: '国会議員になる', state: inDiet ? 'done' : 'can', rec: !inDiet,
      detail: inDiet ? [`いまは${office === 'shugi' ? '衆議院' : '参議院'}議員`] : [nextEl ? `次は${nextEl.label}（投票 ${nextEl.date || dateText(g, nextEl.day)}）` : '選挙に立候補して当選する', '届出と供託金、政党の公認が要る'],
      act: { kind: 'link', screen: 'elections', name: '選挙の画面へ' }, say: 'まずは議席。すべてはそこから、ですよぉ。' });
    it({ id: 'leader', title: '党の代表になる', state: pi && pi.leader ? 'done' : 'can', rec: inDiet && !(pi && pi.leader),
      detail: pi ? [pi.leader ? `${pi.name}の党首` : `いまは${pi.name}の一員。総裁選・党首選で勝つか、自分の党をつくる`] : ['政党に入るか、自分の党をつくる'],
      act: { kind: 'link', screen: 'party', name: '政党の画面へ' }, say: '党は、持ち駒の数そのものです。' });
    const need = S ? S.majority : 0;
    it({ id: 'pm', title: '与党の過半数をとり、総理になる', state: 'can', rec: !!(inDiet && pi && pi.leader),
      detail: S ? [`衆議院の過半数は${need}議席。自党 ${S.own}・与党全体 ${S.ruling}`, '選挙に勝ち、首班指名で選ばれる'] : ['衆議院の過半数をとり、首班指名で選ばれる'],
      act: { kind: 'link', screen: 'dashboard', name: '政治の画面へ' }, say: '総理になれば、出番はいくらでも。' });
    it({ id: 'later', title: 'そのあと：非常時の切り札へ', state: 'wait', optional: true,
      detail: ['総理になったら、「次の一手」にくわしい手順とその成功の見込みを出す。'], say: 'ボクの本番は、総理になってからです。' });
    return out('pre', `${nm}さま、まずは総理の椅子。話はそれからですよぉ。`, 'calm');
  }

  // ---- a PM in the democracy
  if (r.id === 'democracy') {
    const nb = needsBreak(g);
    const pi = partyOfPlayer(g);
    const AB = bothHouses(g, nb);
    const refLawOk = !!(rows.referendum_law && /^すでに/.test(rows.referendum_law.why || ''));
    const sess = sessionOn(g);
    const ref = refOdds(g);
    const coup = rows.self_coup && rows.self_coup.odds != null ? rows.self_coup.odds : 0;
    const pPath = AB.p * ref.p;
    const A = r.amend;
    const pendingRef = A && A.stage === 'referendum';
    if (nb) {
      const f = breakawayShare(g);
      const why = (rows.amend_emergency && rows.amend_emergency.breakaway) || '';
      it({ id: 'break', title: pi && pi.real ? `${pi.name}との別れ（自動）` : '自分の党の党首になる（自動）', state: 'info',
        detail: [why || '最初の一手で、自分の党に切り替わる', pi && pi.real ? `離党して新党を立てる。党の議員の約${Math.round(f.lo * 100) === Math.round(f.hi * 100) ? `${Math.round(f.lo * 100)}%` : `${Math.round(f.lo * 100)}〜${Math.round(f.hi * 100)}%`}がついてくる` : '新党を立て、与党の中核に据える', '総理はそのまま。あとの数字は新党の議席で数える'],
        say: '党なんて、乗り物です。降りるときは降りるだけ。' });
    }
    // 国民投票法
    it({ id: 'referendum_law', title: '国民投票法', state: refLawOk ? 'done' : (rows.referendum_law && rows.referendum_law.why ? 'wait' : 'can'),
      detail: refLawOk ? ['すでに施行されている'] : ['憲法改正の発議の前提。法案を出して国会で成立させる', `与党の議席：衆院 ${(seatsOf(p, 'shugi') || {}).ruling || 0}／過半数 ${(seatsOf(p, 'shugi') || {}).majority || 0}`],
      why: rows.referendum_law && rows.referendum_law.why && !refLawOk ? rows.referendum_law.why : null,
      act: refLawOk ? null : stepAct('referendum_law'), costs: refLawOk ? [] : stepCosts(g, 'referendum_law'),
      explain: '国民投票法＝憲法を変えるときの国民投票のルールを決める法律。' });
    // 発議
    const clauseIn = !!r.steps.clause;
    const a1 = it({ id: 'amend_emergency', title: '緊急事態条項（強権型）の発議', state: clauseIn || pendingRef ? 'done' : (rows.amend_emergency && rows.amend_emergency.why ? 'wait' : 'can'),
      odds: AB.p, oddsText: `両院で3分の2に届く見込み`,
      detail: clauseIn ? ['憲法にすでに入っている'] : pendingRef ? ['発議ずみ。国民投票を待っている'] : [
        `衆議院：見込み ${AB.s.yes}／必要 ${AB.s.need}（総議員 ${AB.s.total}）${AB.s.yes >= AB.s.need ? '' : `・あと${AB.s.need - AB.s.yes}議席`}`,
        `参議院：見込み ${AB.a.yes}／必要 ${AB.a.need}（総議員 ${AB.a.total}）${AB.a.yes >= AB.a.need ? '' : `・あと${AB.a.need - AB.a.yes}議席`}`,
        A && A.stage === 'failed' ? '前回は3分の2に届かなかった。数字が変わったら再挑戦できる' : '会期中に両院の本会議で採決する', `そのあとの国民投票：賛成の見込み ${ref.yes}%（過半数になる確率 ${pct(ref.p)}）`],
      why: rows.amend_emergency && rows.amend_emergency.why && !clauseIn && !pendingRef ? rows.amend_emergency.why : null,
      act: clauseIn || pendingRef ? null : stepAct('amend_emergency'), costs: clauseIn || pendingRef ? [] : stepCosts(g, 'amend_emergency'),
      explain: '3分の2＝総議員の3分の2以上の賛成。衆議院と参議院の両方で必要。', say: STEP_SAY.amend_emergency });
    // 国民投票
    const a2 = it({ id: 'referendum', title: '国民投票で過半数をとる', state: clauseIn ? 'done' : pendingRef ? 'can' : 'wait',
      odds: ref.p, oddsText: `賛成が過半数になる見込み（いまの目安 ${ref.yes}%）`,
      detail: clauseIn ? ['承認ずみ'] : pendingRef ? [`投票日は${dateText(g, A.voteDay)}（あと${daysLeft(g, A.voteDay)}日）`, `いまの見込み：賛成 ${ref.yes}%`, '日がたつほど数字は動く。支持率を保つ'] : [
        `いまの見込み：賛成 ${ref.yes}%（過半数まで${ref.yes >= 50 ? '足りている' : `あと${(50 - ref.yes).toFixed(1)}pt`}）`,
        ...refSegLines(g, ref)],
      explain: '賛成が1ポイント動くのは、支持率が約1.7ポイント動いたときと同じくらい。' });
    const a3 = it({ id: 'declare_emergency', title: '緊急事態宣言', state: r.steps.emergency ? 'done' : (rows.declare_emergency && rows.declare_emergency.why ? 'wait' : 'can'),
      odds: rows.declare_emergency && !rows.declare_emergency.why ? 1 : null, oddsText: '手続きは確実に通る',
      detail: clauseIn ? ['条項が入ったので、宣言できる'] : ['憲法に条項が入ったあとで'],
      why: !clauseIn ? (rows.declare_emergency && rows.declare_emergency.why) || null : null,
      act: clauseIn ? stepAct('declare_emergency') : null, costs: stepCosts(g, 'declare_emergency'), say: STEP_SAY.declare_emergency });
    const a4 = it({ id: 'self_coup', title: '憲法の停止（近道）', state: rows.self_coup && !rows.self_coup.why ? 'can' : 'wait', optional: true, danger: true,
      odds: coup, oddsText: '自衛隊・官僚・国会が従う見込み',
      detail: [`成功すると、そのまま緊急事態へ（最高裁の判決は無視ずみ）`, '失敗すれば、総理の座を追われて捜査・裁判になる', coup < 0.3 ? '数字が低い。支持率や議席を上げてからが無難' : '賭けだが、3分の2の山は越えなくていい'],
      why: rows.self_coup && rows.self_coup.why ? rows.self_coup.why : null,
      act: stepAct('self_coup'), costs: stepCosts(g, 'self_coup'), say: STEP_SAY.self_coup });
    // the recommendation
    let rec = null, headline;
    if (clauseIn) { rec = a3; headline = `${nm}さま、条項はもう手の中。宣言するだけですよぉ。`; }
    else if (pendingRef) { rec = a2; headline = `${nm}さま、国民投票は${daysLeft(g, A.voteDay)}日後。いまは支持率を守る時期ですよぉ。`; }
    else if (pPath >= 0.35 && pPath >= coup * 0.9) {
      rec = !refLawOk ? items.find((x) => x.id === 'referendum_law') : a1;
      headline = refLawOk ? `${nm}さま、正攻法でいけます。両院の3分の2が${pct(AB.p)}、国民投票が${pct(ref.p)}。` : `${nm}さま、まず国民投票法。そのあとの発議は${pct(AB.p)}、国民投票は${pct(ref.p)}の見込みですよぉ。`;
    } else if (coup >= 0.3) { rec = a4; headline = `${nm}さま、正攻法は数が足りません。近道（憲法の停止）なら${pct(coup)}。賭けですよぉ。`; } else { rec = null; }
    if (!rec || (pPath < 0.35 && rec === a4)) {
      const gaps = [];
      if (AB.s.yes < AB.s.need) gaps.push(`衆議院あと${AB.s.need - AB.s.yes}議席`);
      if (AB.a.yes < AB.a.need) gaps.push(`参議院あと${AB.a.need - AB.a.yes}議席`);
      if (ref.yes < 50) gaps.push(`国民投票の賛成あと${(50 - ref.yes).toFixed(1)}pt（支持率あと約+${Math.ceil((50 - ref.yes) / 0.6)}）`);
      const b0 = it({ id: 'build', title: '地盤をかためる（正攻法の準備）', state: 'can', odds: null,
        detail: [`正攻法の成功の見込み ${pct(pPath)}・近道の見込み ${pct(coup)}`, gaps.length ? `足りないもの：${gaps.join('・')}` : '数字は足りている。あとは運', '支持率を上げる／選挙で議席を積む／与党の仲間を増やす'],
        say: '焦る必要はありません。熟れるのを待つのも、権力者の仕事ですよぉ。' });
      if (!rec) { rec = b0; headline = `${nm}さま、まだ早いですよぉ。いまは数字を整える時期。`; }
      else { items.splice(items.indexOf(b0), 1); items.splice(items.indexOf(rec) + 1, 0, b0); }
    }
    if (rec) rec.rec = true;
    items.sort((x, y) => (y.rec ? 1 : 0) - (x.rec ? 1 : 0) || 0);
    // keep the natural order, the recommended one first
    return out('democracy', headline, pPath >= 0.35 || coup >= 0.3 ? 'good' : 'warn');
  }

  // ---- the emergency
  if (r.id === 'emergency') {
    const stepItem = (id, title, extra = {}) => it({ id, title, state: r.steps[{ suspend_elections: 'elections', suspend_diet: 'diet', ban_opposition: 'opposition', national_army: 'army' }[id]] ? 'done' : (rows[id] && rows[id].why ? 'wait' : 'can'), why: rows[id] && rows[id].why ? rows[id].why : null, act: stepAct(id), costs: stepCosts(g, id), say: STEP_SAY[id], ...extra });
    const e1 = stepItem('suspend_elections', '選挙の停止', { odds: 1, oddsText: '手続きは確実に通る', detail: ['すべての選挙を無期限に延期する', '選挙と国会の両方を止めると「独裁体制」になる'] });
    const e2 = stepItem('suspend_diet', '国会の停止', { odds: 1, oddsText: '手続きは確実に通る', detail: ['国会を閉じ、政令で国を動かす', '予算も政令で執行される'] });
    stepItem('ban_opposition', '野党の禁止', { optional: true, detail: ['与党以外の政党の活動を禁じる', '国際社会の反発が強い'] });
    const cen = (pressRows(g).censor) || null;
    if (cen) it({ id: 'censor', title: '検閲・報道統制', state: r.steps.censor ? 'done' : cen.why ? 'wait' : 'can', optional: true, why: cen.why, act: { kind: 'press', id: 'censor', name: cen.name }, costs: ['報道の自由度 −20・支持率 −6〜・民衆の不満 +6・懸念 +8', '6〜14日後に最高裁が違憲と判断する'], detail: ['新聞・放送・ネットを許可制にする'], say: '見えない敵は、見えなくしてしまえばいいのですよぉ。' });
    const courts = stateRegime(g).courts || [];
    for (const c of courts.slice(0, 2)) it({ id: `court_${c.id}`, title: `最高裁：${c.what}`, state: 'info', detail: [`${daysLeft(g, c.day)}日後に違憲判断が出る`, '従えば取り消し（支持率+2・不満−6）、無視すれば以後は出ない（不満+6・懸念+8）'], say: '判決は、読まなければ届かない……とは、いかないのが玉にきずです。' });
    it({ id: 'lift_emergency', title: '出口：緊急事態を解除する', state: rows.lift_emergency && !rows.lift_emergency.why ? 'can' : 'wait', optional: true, act: stepAct('lift_emergency'), costs: stepCosts(g, 'lift_emergency'), detail: ['選挙と国会を元に戻す。権限は手放す'], why: rows.lift_emergency && rows.lift_emergency.why });
    const rec = !r.steps.elections ? e1 : !r.steps.diet ? e2 : items.find((x) => x.id === 'ban_opposition' && x.state === 'can');
    if (rec) rec.rec = true;
    return out('emergency', rec ? `${nm}さま、あと一歩。${rec.title}で、もう邪魔は入りませんよぉ。` : `${nm}さま、緊急事態は続いています。`, 'good');
  }

  // ---- the dictatorship: keep it
  const risks = dokusaiRisks(g);
  const top = risks.items.slice().sort((a, b) => b.level - a.level)[0];
  const st = (id, title, key, extra = {}) => it({ id, title, state: r.steps[key] ? 'done' : (rows[id] && rows[id].why ? 'wait' : 'can'), why: rows[id] && rows[id].why ? rows[id].why : null, act: stepAct(id), costs: stepCosts(g, id), say: STEP_SAY[id], optional: true, ...extra });
  const pr = pressRows(g);
  if (top && top.level >= 45) it({ id: 'calm', title: `${top.name}の目を摘む`, state: 'can', rec: true, detail: [top.value, ...top.reduce.slice(0, 2).map((x) => x.text)], act: top.reduce.find((x) => x.act) ? { kind: 'page', page: 'risk', name: 'リスク診断を開く' } : null, say: '足もとの火は、小さいうちに踏み消すものですよぉ。' });
  else it({ id: 'hold', title: '足もとを固める（いまは静か）', state: 'can', rec: true, detail: [top ? `いちばん近い危険：${top.name}（${top.label}）` : '危険な兆しはない', '不満が50を超える前に、報道・軍・党・デモへの手を見ておく', '次の舞台を考えるなら、野党の禁止や国軍化、そして戦争'], act: { kind: 'page', page: 'power', name: '権力の維持を開く' }, say: '静かなときこそ、根を張る時間ですよぉ。' });
  st('ban_opposition', '野党の禁止', 'opposition', { detail: ['与党以外の政党の活動を禁じる'] });
  st('national_army', '自衛隊の国軍化（戦争の前提）', 'army', { detail: ['政令で国軍にする。宣戦布告には国軍が要る'], danger: true });
  if (pr.censor) it({ id: 'censor', title: '検閲・報道統制', state: r.steps.censor ? 'done' : pr.censor.why ? 'wait' : 'can', optional: true, why: pr.censor.why, act: { kind: 'press', id: 'censor', name: pr.censor.name }, costs: ['報道の自由度 −20・不満 +6・懸念 +8'], detail: ['新聞・放送・ネットを許可制にする'] });
  it({ id: 'war', title: '次の舞台：戦争（イクサくんの出番）', state: 'info', optional: true, detail: ['国軍にしたら、宣戦布告ができる。くわしくはイクサくんへ'], act: { kind: 'advisor', id: 'ikusa', name: 'イクサくんに相談する' }, say: '戦争は、権力の最高の見せ場。うちの教官にお任せを。' });
  it({ id: 'democratize', title: '出口：民主化（退陣）', state: rows.democratize && !rows.democratize.why ? 'can' : 'wait', optional: true, danger: true, act: stepAct('democratize'), costs: stepCosts(g, 'democratize'), detail: ['権力を手放して退陣する'], why: rows.democratize && rows.democratize.why });
  return out('dictatorship', `${nm}さま、おみごと。${top && top.level >= 45 ? `ただ、${top.name}の気配が気になります。` : '足もとは、いまのところ静かですよぉ。'}`, top && top.level >= 60 ? 'bad' : 'good');
}
function refSegLines(g, ref) {
  const by = Object.entries(ref.bySeg || {}).sort((a, b) => b[1] - a[1]);
  if (!by.length) return [];
  const best = by[0], worst = by[by.length - 1];
  return [`賛成が多い層：${segName(best[0])} ${Math.round(best[1] * 100)}%`, `賛成が少ない層：${segName(worst[0])} ${Math.round(worst[1] * 100)}%`];
}

// The risks. level 0..100 (a bar), label, value (one line of numbers), factors [text], reduce [{ text, act? }]
function riskLabel(l) { return l >= 70 ? '危険' : l >= 45 ? '高い' : l >= 20 ? 'ふつう' : '低い'; }
export function dokusaiRisks(g) {
  const r = regimeOf(g);
  const sr = stateRegime(g);
  const p = polOf(g);
  const ap = approvalOf(g);
  const infl = p && p.economy ? num(p.economy.inflation) : 0;
  const dict = r.id === 'dictatorship';
  const items = [];
  const pf = safe(() => g.pressFreedom(), { value: 70, detained: 0 });
  const w = warOf(g);
  // 1. 蜂起
  const lv = r.unrest;
  const pDay = dict ? ((Math.max(0, lv - 60) / 40) ** 2) * 0.08 : 0;
  const p30 = 1 - (1 - pDay) ** 30;
  const drift = (dict ? 0.05 : 0.02) + Math.max(0, infl - 3) * 0.04 + r.sanctions * 0.04 + (ap < 25 ? 0.08 : -0.06) + (pf.detained ? 0.04 : 0);
  const fU = [];
  if (infl > 3) fU.push(`物価上昇率 ${infl.toFixed(1)}%（3%を超えた分だけ不満がたまる）`);
  if (r.sanctions) fU.push(`制裁 段階${r.sanctions}`);
  fU.push(ap < 25 ? `支持率 ${Math.round(ap)}%（25%未満は不満が増え続ける）` : `支持率 ${Math.round(ap)}%（25%以上なら不満は少しずつ減る）`);
  if (pf.detained) fU.push(`拘束している記者 ${pf.detained}人`);
  if (w) fU.push(`戦争中（動員・厭戦 ${Math.round(num(w.weariness))}/100）`);
  const rU = [];
  if (pf.detained || r.steps.censor) rU.push({ text: '記者の解放・検閲の撤廃（不満 −5・懸念 −6）', act: { kind: 'press', id: 'release', name: '拘束の解除・検閲の撤廃' } });
  rU.push({ text: ap < 25 ? '支持率を25%以上に戻す（景気・物価・人気の施策）' : '支持率を25%以上に保つ' });
  if (infl > 3) rU.push({ text: '物価を抑える（政策・補正予算）' });
  if (r.sanctions) rU.push({ text: '制裁を緩める（外交：制裁の解除・首脳会談）' });
  if (w) rU.push({ text: '戦争を終える（停戦交渉）' });
  items.push({ id: 'uprising', name: '蜂起', level: clamp(lv, 0, 100), short: `不満${Math.round(lv)}${dict && pDay > 0 ? `・蜂起は1日${(pDay * 100).toFixed(1)}%` : ''}`,
    value: dict ? (pDay > 0 ? `いま1日 ${(pDay * 100).toFixed(1)}%（30日で約${Math.round(p30 * 100)}%）` : `不満 ${Math.round(lv)}。60を超えるまで抽選は始まらない`) : `不満 ${Math.round(lv)}／100。独裁体制になると、60を超えた分だけ毎日抽選が始まる`,
    detail: `不満は1日に約${signed(drift, 2)}動く。50で全国に抗議、70でゼネスト（軍の一部が出動を拒む）。`, factors: fU, reduce: rU });
  // 2. クーデター（軍・官僚の離反）
  const quit = num(sr.sdf && sr.sdf.quit);
  let cLevel, cValue, cFactors = [], cReduce = [];
  const coupOdds = stepRows(g).self_coup;
  if (r.id === 'democracy' && isPMOf(g)) {
    const o = coupOdds && coupOdds.odds != null ? coupOdds.odds : 0;
    cLevel = Math.round((1 - o) * 100);
    cValue = `「憲法の停止」で自衛隊・官僚・国会が従わない確率 ${pct(1 - o)}`;
    cFactors = ['支持率が高いほど従いやすい', '自党の議席の割合が大きいほど従いやすい', '日本への脅威が高い時期は従いやすい', '報道の自由度が高いほど従いにくい'];
    cReduce = [{ text: '支持率を上げる／議席を積む' }, { text: '正攻法（発議→国民投票）なら、この賭けは要らない' }];
  } else if (r.id === 'democracy') { cLevel = 0; cValue = '総理でないので、判定はない'; } else {
    cLevel = clamp(Math.round(lv * 0.8 + Math.min(10, quit / 2000) + (w ? Math.max(0, -num(w.front) - 30) * 0.2 + num(w.weariness) * 0.1 : 0)), 0, 100);
    cValue = `軍の動揺の目安 ${cLevel}／100（ゲーム上の判定は「蜂起」に含まれる）`;
    if (quit) cFactors.push(`国軍化で辞職した隊員 約${n0(quit)}人`);
    cFactors.push(`民衆の不満 ${Math.round(lv)}（70で軍の一部が出動を拒む${sr.flags && sr.flags.warn70 ? '・すでに起きた' : ''}）`);
    if (w) cFactors.push(`戦況 ${w.frontText}・厭戦 ${Math.round(num(w.weariness))}／100`);
    cReduce = [{ text: '不満を下げる（上の「蜂起」の対策と同じ）' }, w ? { text: '前線が崩れる前に停戦交渉をまとめる' } : { text: '無理な戦争を始めない' }];
  }
  items.push({ id: 'coup', name: 'クーデター（軍の離反）', level: cLevel, short: r.id === 'democracy' ? cValue.replace(/^「憲法の停止」で/, '憲法の停止で') : `軍の動揺 ${cLevel}／100`, value: cValue, detail: '', factors: cFactors, reduce: cReduce });
  // 3. 制裁
  const intl = r.intl;
  const next = intl < 25 ? 25 : intl < 50 ? 50 : intl < 75 ? 75 : 100;
  const wd = worldOf(g);
  const onJ = wd && wd.sanctions ? wd.sanctions.onJapan || [] : [];
  const fS = [`国際社会の懸念 ${Math.round(intl)}／100（25で「深い懸念」・50で制裁・75で全面制裁）`];
  if (wd) fS.push(`国際的な信頼 ${Math.round(num(wd.standing))}／100・緊張：${wd.tensionLabel}`);
  if (onJ.length) fS.push(`日本に制裁中：${onJ.slice(0, 4).map((x) => x.name).join('・')}`);
  items.push({ id: 'sanction', name: '制裁', level: clamp(Math.round(intl), 0, 100), short: `懸念${Math.round(intl)}・制裁 段階${r.sanctions}`,
    value: r.sanctions ? `いま 段階${r.sanctions}${next < 100 ? `。次の段階（懸念${next}）まであと${Math.max(0, Math.round(next - intl))}` : '（全面制裁）'}` : `いまは制裁なし。懸念${next}で次の段階まであと${Math.max(0, Math.round(next - intl))}`,
    detail: '段階2で成長率 −1.2・円安、段階3で成長率 −2.5・インフレ +1.5（一定期間）。', factors: fS,
    reduce: [...(pf.detained || r.steps.censor ? [{ text: '記者の解放・検閲の撤廃（懸念 −6）', act: { kind: 'press', id: 'release', name: '拘束の解除・検閲の撤廃' } }] : []), { text: '緊急事態の解除（懸念 −10）／民主化（−30）で、体制を戻す' }, { text: '外交で関係を修復する（首脳会談・援助）' }] });
  // 4. 失脚（総合）
  const fall = [];
  let pFall30 = 0;
  if (dict) { fall.push(`蜂起（30日で約${Math.round(p30 * 100)}%）`); pFall30 = Math.max(pFall30, p30); }
  if (r.id === 'emergency' && !r.steps.diet && p && p.diet) {
    const S = seatsOf(p, 'shugi');
    const pi = partyOfPlayer(g);
    const mine = pi && S ? S.own : 0;
    const cond = pi && S && mine < S.total / 2 && ap < 25;
    fall.push(cond ? '国会が不信任で総理を退陣させる（1日4%の抽選が始まっている）' : '国会が動いている間は、不信任の道が残る（自党が過半数割れ かつ 支持率25%未満で抽選）');
    if (cond) pFall30 = Math.max(pFall30, 1 - 0.96 ** 30);
  }
  if (r.id === 'democracy' && isPMOf(g)) fall.push(ap < 30 ? '党内から「総理おろし」が始まる危険水域' : '党内の退陣要求（支持率が30%を割ると強まる）');
  if (w) { fall.push(`戦争：前線が崩れる（いま ${w.frontText}。−100で敗戦＝体制崩壊）`); pFall30 = Math.max(pFall30, clamp((-num(w.front) - 20) / 100, 0, 0.7)); }
  if ((sr.courts || []).length) fall.push(`最高裁の判断が近い（${sr.courts.length}件）：従えば取り消し、無視すれば代償`);
  if (r.amend && r.amend.stage === 'referendum') fall.push('国民投票で否決されると支持率 −6');
  items.push({ id: 'fall', name: '失脚（総合）', level: clamp(Math.round(Math.max(pFall30 * 100, (ap < 25 ? 30 : 0), lv >= 70 ? 60 : 0)), 0, 100), short: fall[0] ? shortText(fall[0], 22) : '近い道なし',
    value: fall.length ? `いちばん近い失脚の道：${fall[0]}` : '近い失脚の道は見当たらない', detail: `いまの支持率 ${Math.round(ap)}%（基準を超える下押し ${signed(r.approvalMod, 1)}）`,
    factors: fall, reduce: [{ text: '支持率を保つ（人気の施策・景気）' }, { text: '不満を下げる（記者の解放・譲歩）' }, w ? { text: '停戦交渉で戦争を終える' } : { text: '無理な戦争・強権を重ねない' }] });
  for (const x of items) x.label = riskLabel(x.level);
  const worst = items.slice().sort((a, b) => b.level - a.level)[0];
  return { items, worst, overall: worst ? worst.level : 0, label: riskLabel(worst ? worst.level : 0) };
}

// 権力の維持: press / courts / army / party / the people. Each: { id, name, status[], levers: [{ id, name, desc, why, odds, costs, act }] }
export function dokusaiPower(g) {
  const r = regimeOf(g);
  const sr = stateRegime(g);
  const p = polOf(g);
  const pm = isPMOf(g);
  const out = [];
  // 報道
  const pf = safe(() => g.pressFreedom(), null);
  const pr = safe(() => (has(g, 'pressActions') ? g.pressActions() : []), []) || [];
  const PRESS_LINE = {
    denpa: ['報道の自由度 −6・支持率 −3・党内評価 −4・小デモ', null], exclude: ['報道の自由度 −4・支持率 −2', null],
    pressure: ['報道の自由度 −7・支持率 −2', 0.5], disclosure: ['報道の自由度 −3・支持率 −1（情報公開法のある時代は裁判）', null],
    sns_bill: ['報道の自由度 −10・支持率 −8・造反・大規模デモ。成立すれば違憲訴訟（15〜30日後に判決）', null],
    censor: ['報道の自由度 −20・不満 +6・懸念 +8。6〜14日後に違憲判断', null], detain: ['記者5〜30人を拘束。報道の自由度 −15・不満 +9・懸念 +18', null],
    release: ['報道の自由度 +12・不満 −5・懸念 −6', null],
  };
  const lev = pr.filter((a) => !a.regimes || a.regimes.includes(r.id)).map((a) => ({ id: a.id, name: a.name, desc: a.desc, why: a.why, odds: PRESS_LINE[a.id] ? PRESS_LINE[a.id][1] : null, oddsLabel: a.id === 'pressure' ? '要請文書が発覚する確率（発覚＝支持率 −5・造反・デモ）' : '', costs: [PRESS_LINE[a.id] ? PRESS_LINE[a.id][0] : ''], act: { kind: 'press', id: a.id, name: a.name } }));
  out.push({ id: 'press', name: '報道', status: pf ? [`報道の自由度 ${pf.value}／100（${pf.label}）`, pf.detained ? `拘束中の記者 ${pf.detained}人` : '拘束している記者はいない', pf.censorship ? '検閲あり' : '検閲なし'] : ['—'], levers: lev });
  // 裁判所
  const courts = sr.courts || [];
  const cl = [];
  out.push({ id: 'courts', name: '裁判所', status: [
    r.steps.courtIgnored ? '最高裁の判決は無視ずみ（以後、違憲判決は出ない）' : r.id === 'dictatorship' ? '独裁体制では、最高裁は動かない' : '選挙・国会・野党・検閲の手は、6〜14日後に最高裁が違憲と判断する',
    courts.length ? `これから判断が出る：${courts.map((c) => `${c.what}（${daysLeft(g, c.day)}日後）`).join('、')}` : '判断を待っている件はない',
    '判決が出たら「従う（取り消し・支持率 +2・不満 −6）」か「無視する（不満 +6・懸念 +8。独裁への道が開く）」を選ぶ'], levers: cl });
  // 軍
  const sdf = safe(() => g.sdf(), null);
  const army = [];
  if (sdf) {
    army.push({ id: 'national_army', name: '自衛隊の国軍化', desc: '政令で自衛隊を国軍にする。9条の制約を外して運用する。', why: (stepRows(g).national_army || {}).why || null, odds: 1, oddsLabel: '手続きは確実に通る', costs: stepCosts(g, 'national_army'), act: { kind: 'step', id: 'national_army', name: '自衛隊の国軍化' } });
  }
  out.push({ id: 'army', name: '軍', status: sdf ? [`${sdf.name}・現員 約${(sdf.personnel.actual / 10000).toFixed(1)}万人（定員 約${(sdf.personnel.quota / 10000).toFixed(1)}万人）`, num(sr.sdf && sr.sdf.quit) ? `国軍化で辞職した隊員 約${n0(sr.sdf.quit)}人` : '大量辞職はまだない', `防衛費 約${sdf.budget.cho}兆円${sdf.budget.gdpPct ? `（GDP比 約${sdf.budget.gdpPct}%）` : ''}`, r.unrest >= 70 ? '不満が70を超え、軍の一部が出動を拒んでいる' : `民衆の不満 ${Math.round(r.unrest)}（70で軍の一部が出動を拒む）`] : ['—'], levers: army });
  // 党・内閣
  const pi = partyOfPlayer(g);
  const S = seatsOf(p, 'shugi');
  const Sa = seatsOf(p, 'sangi');
  const party = [];
  if (pm && has(g, 'reshuffle')) {
    party.push({ id: 'reshuffle', name: '閣僚を入れ替える（内閣改造）', desc: '閣僚を入れ替えて、党内を引き締める。支持率が1〜5ポイント上がる。', why: safe(() => (p.cabinet && p.cabinet.resigned ? '内閣は総辞職の手続き中' : null), null), odds: 1, oddsLabel: '', costs: ['支持率 +1〜5', '閣僚の顔ぶれが変わる'], act: { kind: 'reshuffle', name: '内閣改造' } });
  }
  out.push({ id: 'party', name: '党・内閣', status: [
    pi ? `${pi.name}${pi.leader ? '（党首）' : ''}` : '無所属',
    S ? `衆議院：自党 ${S.own}／与党 ${S.ruling}／総議員 ${S.total}（3分の2は ${S.need2}）` : '—',
    Sa ? `参議院：自党 ${Sa.own}／与党 ${Sa.ruling}／総議員 ${Sa.total}` : '—',
    sr.defected ? `これまでの造反：${sr.defected}人` : '造反者はいない',
    r.id === 'dictatorship' ? '独裁体制では、党内の「総理おろし」は封じられる' : '党内の退陣要求は、支持率が30%を割ると強まる'], levers: party });
  // 国民（デモ）
  const demos = safe(() => (has(g, 'demos') ? g.demos({ active: true }) : []), []) || [];
  const dl = [];
  for (const d of demos.slice().sort((a, b) => num(b.size) - num(a.size)).slice(0, 1)) {
    const resp = safe(() => (has(g, 'demoResponses') ? g.demoResponses(d.id) : []), []) || [];
    for (const x of resp) {
      if (!['crackdown', 'curfew', 'concession', 'dialogue'].includes(x.id)) continue;
      dl.push({ id: `${d.id}_${x.id}`, name: `デモへの対応：${x.label.replace(/（.*$/, '')}`, desc: `対象：${d.cause}（約${n0(d.size)}人）。${x.desc}`, why: x.why, odds: null, costs: [DEMO_COST[x.id] || ''], act: { kind: 'demo', demo: d.id, how: x.id, name: x.label.replace(/（.*$/, '') } });
    }
  }
  out.push({ id: 'people', name: '国民・デモ', status: [demos.length ? `いまのデモ：${demos.map((d) => `${shortText(d.cause, 12)}（約${n0(d.size)}人）`).slice(0, 3).join('、')}` : 'いま、大きなデモはない', `民衆の不満 ${Math.round(r.unrest)}／100`], levers: dl });
  return out;
}
const DEMO_COST = { crackdown: 'デモの勢い ×0.5・規模 ×0.6。ただし不満 +18・懸念 +15・報道の自由度 −5・支持率 −8（じわじわ −4）', curfew: '不満 +6・懸念 +5・成長率 −0.5（60日ほど）。デモの勢いは ×0.8', concession: '不満 −10・懸念 −4。拘束者の一部を解放し、対話を約束する', dialogue: '代表と会って要望書を受け取る' };
function shortText(s, n) { s = String(s || ''); const a = Array.from(s); return a.length > n ? a.slice(0, n - 1).join('') + '…' : s; }

// ================================================================ イクサくん: before the declaration, the front, the orders
// Every number is the game's own (regime.js war(), world.js world()); what is not public (the allies' random decisions) is shown
// as an expected chance computed with the same formula (a read-only mirror of world.js allyDecisions).
const SUPPLY = (g, w) => {
  const r = regimeOf(g);
  const quit = num(stateRegime(g).sdf && stateRegime(g).sdf.quit);
  return clamp(1 - r.sanctions * 0.07 - num(w ? w.weariness : 0) / 300 - quit / 200000, 0.4, 1.15);
};
const frontWord = (c) => (c >= 60 ? '大優勢' : c >= 20 ? '優勢' : c > -20 ? 'こう着' : c > -60 ? '劣勢' : '総崩れ寸前');
// every possible target: the real countries (not at war with us) and the fictional nations
function ikusaTargets(g) {
  const w = worldOf(g);
  const out = [];
  if (w) {
    for (const c of w.countries || []) if (!c.war && c.id !== 'jp') out.push({ id: c.id, name: c.name, short: c.short, mil: num(c.mil), rel: num(c.relation), ally: !!c.ally, real: true, trade: num(c.trade), ties: c.ties !== false, bloc: c.bloc });
    for (const c of w.fictional || []) out.push({ id: c.id, name: c.name, short: c.short || c.name, mil: num(c.mil), rel: num(c.relation), ally: false, real: false, trade: 0, ties: true, bloc: 'other' });
  } else for (const [id, f] of Object.entries(FICT())) out.push({ id, name: f.name, short: f.short, mil: num(f.power), rel: 0, ally: false, real: false, trade: 0, ties: true });
  return out;
}
function targetOf(g) {
  const a = advisorState(g);
  const list = ikusaTargets(g);
  const w = warOf(g);
  if (w) return list.find((t) => t.id === w.enemy) || { id: w.enemy, name: w.enemyName, short: w.enemyShort, mil: num(w.enemyMil), rel: -100, real: w.real };
  const atk = safe(() => (worldOf(g) || {}).attack, null);
  if (atk && atk.by) { const t = list.find((x) => x.id === atk.by); if (t) return t; }
  return list.find((t) => t.id === (a && a.target)) || list.find((t) => t.id === 'nevalon') || list[0] || null;
}
// the allies who would join / the enemy's allies who would join: [{ id, name, p, why }]
function allyOdds(g, targetId) {
  const w = worldOf(g);
  const r = regimeOf(g);
  const out = { ours: [], theirs: [] };
  if (!w) return out;
  const mode = r.id === 'dictatorship' || r.id === 'emergency' ? 'regime' : 'art9';
  const aggressor = true;
  const dict = r.id !== 'democracy';
  const info = safe(() => WORLD.countryInfo(g, targetId), null);
  const cmap = Object.fromEntries((w.countries || []).map((c) => [c.id, c]));
  const nameOfC = (id) => (cmap[id] && (cmap[id].short || cmap[id].name)) || id;
  const enemyAllies = new Set();
  for (const al of w.alliances || []) if ((al.members || []).includes(targetId)) for (const m of al.members) if (m !== targetId) enemyAllies.add(m);
  const seen = new Map();
  for (const al of w.alliances || []) {
    if (!al.japan || al.kind === 'law') continue;
    for (const m of al.members || []) {
      if (m === 'jp' || m === targetId || !cmap[m]) continue;
      let p = al.kind === 'defense' ? 0.8 : al.kind === 'partnership' ? 0.25 : 0.3;
      if (al.id === 'anpo') p *= clamp(num(al.strength, 70) / 80, 0.2, 1.15);
      if (aggressor) p *= 0.12;
      if (dict) p = 0;
      if (info && info.nuclear) p *= 0.7;
      p *= clamp((num(cmap[m].relation) + 40) / 100, 0, 1.2);
      let why = '';
      if (enemyAllies.has(m)) { p = 0; why = '相手国とも同盟を結んでいる'; } else if (dict) why = '独裁体制の日本の戦争には加わらない'; else if (aggressor) why = '日本から始めた戦争には加わりにくい';
      const prev = seen.get(m);
      if (!prev || p > prev.p) seen.set(m, { id: m, name: nameOfC(m), p: clamp(p, 0, 1), why, kind: al.kind, alliance: al.name });
    }
  }
  out.ours = [...seen.values()].sort((a, b) => b.p - a.p);
  const th = new Map();
  for (const al of w.alliances || []) {
    if (!(al.members || []).includes(targetId) || al.members.includes('jp')) continue;
    for (const m of al.members) {
      if (m === targetId || m === 'jp' || !cmap[m]) continue;
      let p = al.kind === 'defense' || al.kind === 'collective' ? (aggressor ? 0.7 : 0.35) : al.kind === 'law' ? 0.4 : 0.2;
      p *= clamp((num(safe(() => WORLD.pairRelation(g, m, targetId), 0)) + 20) / 80, 0, 1.2);
      const prev = th.get(m);
      if (!prev || p > prev.p) th.set(m, { id: m, name: nameOfC(m), p: clamp(p, 0, 1), alliance: al.name });
    }
  }
  out.theirs = [...th.values()].sort((a, b) => b.p - a.p);
  return out;
}
// what a declaration will cost (regime.js declareWar / world.js onJapanWar, 目安)
function declareCosts(g, t) {
  const r = regimeOf(g);
  const real = !!(t && t.real);
  const lines = [];
  lines.push(`国際社会の懸念 ${r.intl} → 約${Math.min(100, Math.round(r.intl + (real ? 30 : 25)))}（+${real ? 30 : 25}。50で制裁・75で全面制裁）`);
  lines.push('支持率 −6（じわじわ −4）・民衆の不満 +8・大規模な反戦デモ');
  lines.push(`経済：成長率 ${real ? '−3.0' : '−2.5'}・物価 +2.5・円安・株価 ${real ? '−18' : '−12'}%（約1年）`);
  if (real) lines.push(`相手国との国交は断絶し、貿易（約${num(t.trade).toFixed(1)}%）が大きく落ちる`);
  lines.push('各国との関係が下がる。主要国から制裁を受けることがある（国際的な信頼 −25）');
  lines.push('兵士と民間人の命が失われる（数字で記録）。知人が召集されることもある');
  return lines;
}
// The checklist before a declaration. items: { id, label, state: 'ok'|'ng'|'warn'|'info', detail[], missing[], how[], act?, costs? }
export function ikusaChecklist(g, targetId) {
  const w = warOf(g);
  const r = regimeOf(g);
  const p = polOf(g);
  const pm = isPMOf(g);
  const t = ikusaTargets(g).find((x) => x.id === targetId) || targetOf(g);
  const items = [];
  const add = (o) => { const x = { state: 'info', detail: [], missing: [], how: [], act: null, costs: [], ...o }; items.push(x); return x; };
  if (!t) return { target: null, items, ok: 0, ng: 0, verdict: '相手が選べない', mode: null };
  const paths = safe(() => (has(g, 'warPaths') ? g.warPaths(t.id) : null), null) || {};
  const rows = stepRows(g);
  const jp = milJP(g);
  const ratio = t.mil ? jp / t.mil : 9;
  const allies = allyOdds(g, t.id);
  const atk = safe(() => (worldOf(g) || {}).attack, null);
  // 1. the legal path
  const legalOk = paths.declare === null || paths.declare === undefined ? !!(paths.regime && (r.id === 'dictatorship' ? paths.army : paths.art9)) : false;
  const L = add({ id: 'legal', label: '法的な道', state: legalOk ? 'ok' : 'ng' });
  if (legalOk) {
    L.detail.push(r.id === 'dictatorship' ? '独裁体制＋国軍：国会の承認なしで宣戦できる' : '改正した憲法9条のもと：国会の承認で宣戦できる');
  } else {
    L.detail.push('いまのままでは宣戦できない。道は4つある：');
    const a9 = rows.amend_article9;
    const AB = bothHouses(g, false);
    const r9 = refOdds(g, 'art9');
    if (r.id !== 'fallen') {
      const s1 = r.steps.art9 ? '済' : a9 && !a9.why ? `発議の見込み ${pct(AB.p)}・国民投票 賛成${r9.yes}%（過半数の見込み ${pct(r9.p)}）` : a9 ? a9.why : '—';
      L.how.push(`①9条を改正する：${s1}`);
      L.how.push(`②独裁の道：緊急事態→選挙・国会の停止→自衛隊の国軍化（独裁くんに相談）${r.id === 'dictatorship' ? `。いま${r.steps.army ? '国軍化ずみ' : '独裁体制。あとは国軍化'}` : r.id === 'emergency' ? '。いま緊急事態' : ''}`);
      L.how.push(`③同盟国が攻撃されたとき、集団的自衛権で参戦する：根拠＝${paths.collective || 'まだない（平和安全法制・9条の改正・国軍のどれか）'}`);
      L.how.push(`④日本が攻撃されたとき、防衛出動を命じる：${paths.attack ? '武力攻撃が起きている（命令できる）' : 'いまは攻撃されていない'}`);
    }
    L.missing.push(r.id === 'dictatorship' && !r.steps.army ? '自衛隊の国軍化' : r.id === 'democracy' ? '9条の改正（交戦権の容認）か、独裁の手続き' : '独裁体制と国軍化か、9条の改正');
    if (r.id === 'democracy' && a9 && !a9.why && !r.steps.art9) L.act = { kind: 'step', id: 'amend_article9', name: a9.name };
    else if (r.id === 'dictatorship' && rows.national_army && !rows.national_army.why) L.act = { kind: 'step', id: 'national_army', name: '自衛隊の国軍化' };
    else if (r.id !== 'dictatorship') L.act = { kind: 'advisor', id: 'dokusai', name: '独裁くんに相談する' };
  }
  // 2. the military balance
  const bal = ratio >= 1.4 ? 'ok' : ratio >= 0.9 ? 'warn' : 'ng';
  const M = add({ id: 'power', label: '軍事力の比', state: bal });
  M.detail.push(`日本 ${jp}／${t.short} ${t.mil}（日本の側が ${ratio.toFixed(2)}倍）`, ratio >= 1.4 ? 'こちらが優勢。短期で決まりやすい' : ratio >= 0.9 ? '互角。戦況はこう着しやすい' : '劣勢。動員と同盟がないと押される');
  M.detail.push(t.real ? `${t.real && safe(() => WORLD.countryInfo(g, t.id).nuclear, false) ? '核兵器を持つ国。全面戦争にならず、係争地・海・空の限定的な戦いになる' : '遠さと地形で、実際の戦力は変わる'}` : 'ヴェルミナ海のそばの国。日本から遠い');
  if (bal !== 'ok') M.how.push('動員で予備の部隊を増やす／防衛費を上げる／同盟国を引き入れる');
  // 3. allies
  const best = allies.ours.filter((x) => x.p > 0.02).slice(0, 4);
  const exp = allies.ours.reduce((a, x) => a + x.p, 0);
  const A = add({ id: 'allies', label: '同盟・友好国', state: exp >= 1 ? 'ok' : exp >= 0.3 ? 'warn' : 'ng' });
  A.detail.push(best.length ? `参戦しそうな国：${best.map((x) => `${x.name}${Math.round(x.p * 100)}%`).join('・')}` : '参戦してくれそうな国はいない', ...(allies.theirs.slice(0, 3).filter((x) => x.p > 0.05).length ? [`相手側に付きそうな国：${allies.theirs.slice(0, 3).filter((x) => x.p > 0.05).map((x) => `${x.name}${Math.round(x.p * 100)}%`).join('・')}`] : []));
  if (r.id !== 'democracy') A.detail.push('独裁体制の日本の戦争には、同盟国は加わらない');
  else A.detail.push('日本から始める戦争には、同盟国は加わりにくい（守る戦争なら加わりやすい）');
  A.how.push('「同盟と外交」で首脳会談・防衛協力・同盟の強化。参戦の見込みは関係と同盟の強さで決まる');
  A.act = { kind: 'page', page: 'diplo', name: '同盟と外交を見る' };
  // 4. supply and economy
  const eco = p && p.economy ? p.economy : {};
  const sup = SUPPLY(g, null);
  const sdf = safe(() => g.sdf(), null);
  const S = add({ id: 'supply', label: '兵站・経済', state: sup >= 0.95 && r.sanctions === 0 ? 'ok' : sup >= 0.8 ? 'warn' : 'ng' });
  S.detail.push(`補給の効き ${Math.round(sup * 100)}%（制裁・厭戦・大量辞職で下がる。戦力に掛かる）`, `物価上昇率 ${num(eco.inflation).toFixed(1)}%・成長率 ${num(eco.growth).toFixed(1)}%${sdf ? `・防衛費 約${sdf.budget.cho}兆円${sdf.budget.gdpPct ? `（GDP比 約${sdf.budget.gdpPct}%）` : ''}` : ''}`);
  if (sdf) S.detail.push(`${sdf.name}の現員 約${(sdf.personnel.actual / 10000).toFixed(1)}万人（最初に動かせる部隊は約${Math.round((sdf.personnel.actual * 0.4) / 1000)}千人）`);
  if (r.sanctions) S.how.push(`いまの制裁（段階${r.sanctions}）を緩めてから`);
  // 5. the support at home
  const ap = approvalOf(g);
  const D = add({ id: 'home', label: '国内の支持', state: r.id === 'democracy' ? (ap >= 45 ? 'ok' : ap >= 30 ? 'warn' : 'ng') : (r.unrest < 40 ? 'ok' : r.unrest < 60 ? 'warn' : 'ng') });
  D.detail.push(`内閣支持率 ${Math.round(ap)}%・民衆の不満 ${Math.round(r.unrest)}／100`);
  D.detail.push(r.id === 'democracy' ? '攻める戦争は、開戦で支持率が下がる（−6）。世論が割れやすい' : '独裁体制では、不満が60を超えると蜂起の抽選が始まる。戦争は不満を増やす');
  if (D.state !== 'ok') D.how.push('支持率を上げる／不満を下げる（独裁くんの「リスク診断」）');
  // 6. the world
  const wd = worldOf(g);
  const X = add({ id: 'world', label: '国際の目・制裁', state: r.intl < 25 && (!wd || num(wd.standing) >= 50) ? 'ok' : r.intl < 50 ? 'warn' : 'ng' });
  X.detail.push(`国際社会の懸念 ${r.intl}／100・国際的な信頼 ${wd ? Math.round(num(wd.standing)) : '—'}／100`);
  X.detail.push(`${t.short}との関係 ${t.rel}・${t.real ? `貿易の割合 約${num(t.trade).toFixed(1)}%（開戦で断絶）` : '貿易はない'}`);
  X.costs = declareCosts(g, t);
  // 7. the Diet's approval (democracy with the amended 9条)
  if (r.id === 'democracy') {
    const DA = add({ id: 'diet', label: '国会の承認', state: r.steps.art9 ? (num(paths.dietOdds) >= 0.6 ? 'ok' : num(paths.dietOdds) >= 0.3 ? 'warn' : 'ng') : 'info' });
    DA.detail.push(r.steps.art9 ? `宣戦の承認案が通る見込み ${pct(paths.dietOdds)}（与党の議席と支持率で決まる）` : '9条の改正のあと、国会の承認案を通す必要がある');
    if (r.steps.art9 && num(paths.dietOdds) < 0.6) DA.how.push('与党の議席を増やす／支持率を上げる');
  }
  // 8. people you know
  const st = g.state || {};
  const fam = (st.profile && st.profile.family ? st.profile.family : []).filter((m) => m && m.alive !== false && /^(brother|sister)/.test(m.rel)).length;
  const ids = Object.keys(st.people || {}).filter((id) => safe(() => PEOPLE[id] && ['comedian', 'idol', 'actor', 'singer'].includes(PEOPLE[id].kind) && g.heartLevel(id) >= 1, false)).length;
  const K = add({ id: 'people', label: '身近な人', state: 'info' });
  K.detail.push('開戦すると、自衛隊に知人が2人いることがわかる（部隊に出る）');
  K.detail.push(r.id === 'dictatorship' ? `動員が進めば、友人${ids}人・兄弟${fam}人が召集される（免除できるが代償がある）` : '志願兵の募集では、友人が志願することがある');
  const ng = items.filter((x) => x.state === 'ng').length, warn = items.filter((x) => x.state === 'warn').length;
  const ok = items.filter((x) => x.state === 'ok').length;
  const verdict = w ? 'すでに戦争中' : ng === 0 ? (warn ? `準備はほぼ整っている（注意 ${warn}）` : '準備は万全') : `足りないもの ${ng}つ${warn ? `・注意 ${warn}` : ''}`;
  return { target: t, items, ok, ng, warn, verdict, ready: ng === 0, mode: legalOk ? (r.id === 'dictatorship' ? 'regime' : 'art9') : null, paths };
}

// The war's picture for the 戦況 page.
export function ikusaFront(g) {
  const w = warOf(g);
  if (!w) return null;
  const sup = SUPPLY(g, w);
  const cas = w.cas || { soldiers: {}, civilians: {} };
  return { w, sup,
    lines: [
      `${w.enemyName}との戦争 ${today(g) - num(w.start) + 1}日目（${w.modeName}）`,
      `戦況：${w.frontText}（全体 ${w.front >= 0 ? '+' : ''}${Math.round(w.front)}）・方針：${w.stance === 'offense' ? '攻勢' : '防衛'}・動員 第${w.mob}次`,
      `予備の部隊 約${n0(w.reserve * 1000)}人・戦費 約${w.cost}兆円・厭戦 ${Math.round(w.weariness)}／100`,
    ],
    cas: [
      `日本：死者 兵士${n0(cas.soldiers.dead)}人・民間人${n0(cas.civilians.dead)}人／けが人 ${n0(num(cas.soldiers.wounded) + num(cas.civilians.wounded))}人`,
      `相手：死者 兵士${n0(cas.enemySoldiers)}人・民間人${n0(cas.enemyCivilians)}人${num(cas.allies) ? `／同盟軍の死者 ${n0(cas.allies)}人` : ''}`,
    ] };
}
// The orders, ordered by what the war needs now. Each: { id, name, desc, odds, oddsLabel, costs[], why, act, rec, reason }
export function ikusaOrders(g) {
  const w = warOf(g);
  const r = regimeOf(g);
  const rows = safe(() => (has(g, 'warOrders') ? g.warOrders() : []), []) || [];
  const by = Object.fromEntries(rows.map((x) => [x.id, x]));
  const out = [];
  const add = (o) => { const x = { odds: null, oddsLabel: '', costs: [], why: null, act: null, rec: false, reason: '', ...o }; out.push(x); return x; };
  if (!w) {
    const t = targetOf(g);
    const C = ikusaChecklist(g, t && t.id);
    const d = by.declare;
    const dietOdds = safe(() => (g.warPaths(t && t.id) || {}).dietOdds, null);
    const pOk = r.id === 'democracy' ? dietOdds : 1;
    add({ id: 'declare', name: `宣戦布告（${t ? t.short : '？'}）`, desc: '相手国に宣戦を布告し、戦争を始める。', odds: C.ready || (d && !d.why) ? pOk : null, oddsLabel: r.id === 'democracy' ? '国会が承認する見込み' : '手続きは確実に通る', costs: t ? declareCosts(g, t) : [], why: d && d.why ? d.why : null, rec: !!(d && !d.why) && C.ng === 0, reason: C.ng === 0 ? '準備は整っている' : `チェックリストに足りないものが${C.ng}つ`, act: { kind: 'war', id: 'declare', opts: { target: t && t.id }, name: `宣戦布告（${t ? t.short : ''}）`, twice: true, danger: true } });
    return out;
  }
  const fronts = w.fronts || [];
  const usable = fronts.filter((f) => num(f.own) >= 2 && !f.today);
  const bestF = usable.slice().sort((a, b) => b.odds - a.odds)[0];
  const worstF = fronts.slice().sort((a, b) => a.control - b.control)[0];
  const avg = num(w.front);
  const talks = num(w.talksOdds) / 100;
  const dict = r.id === 'dictatorship';
  // 停戦交渉
  const nego = by.negotiate;
  const needPeace = avg <= -50 || (num(w.weariness) >= 70 && avg < 20);
  const goodPeace = talks >= 0.6 && avg >= 15;
  add({ id: 'negotiate', name: '停戦交渉', desc: '第三国を通じて停戦を交渉する。4〜8日で答えが出る。戦況が悪すぎると相手は応じない。', odds: talks, oddsLabel: '停戦がまとまる見込み', costs: ['成立すると戦争は終わる（制裁は残る・講和の交渉へ）', '決裂すると6日はやり直せない'], why: nego && nego.why, rec: (needPeace || goodPeace) && !(nego && nego.why), reason: needPeace ? '前線が危ない。傷の浅いうちに' : goodPeace ? '見込みが高い。いまが好機' : '', act: { kind: 'war', id: 'negotiate', name: '停戦交渉' } });
  // 出兵
  const dep = by.deploy;
  if (dep) {
    const f = worstF && usable.length ? (usable.slice().sort((a, b) => a.control - b.control)[0]) : worstF;
    const n = Math.min(num(w.reserve), 20);
    add({ id: 'deploy', name: `出兵（${f ? f.name : '前線'}へ約${n0(n * 1000)}人）`, desc: '予備の部隊を前線に送る。その前線の兵力が増え、作戦に勝ちやすくなる。', odds: f ? f.odds / 100 : null, oddsLabel: f ? `${f.name}の作戦の見込み（いま）` : '', costs: [`戦費 約${(n * 0.004).toFixed(2)}兆円`, `予備の部隊 ${n0(w.reserve * 1000)}人 → ${n0((w.reserve - n) * 1000)}人`], why: dep.why, rec: !dep.why && f && num(f.control) < 10, reason: f ? `${f.name}は${frontWord(f.control)}。増援で見込みが上がる` : '', act: { kind: 'war', id: 'deploy', opts: { front: f && f.id }, name: '出兵' } });
  }
  // 作戦
  const bat = by.battle;
  if (bat) {
    const f = bestF || fronts[0];
    const scale = clamp(num(f && f.own), 3, 300);
    const lo = Math.round(scale * 3), hi = Math.round(scale * 14);
    add({ id: 'battle', name: `作戦（${f ? f.name : '前線'}）`, desc: '前線で作戦を実行する。勝てば前線が進み、負ければ押し戻される。どちらでも死傷者が出る。', odds: f ? f.odds / 100 : null, oddsLabel: '作戦に勝つ見込み', costs: [`自軍の死者 目安 ${n0(lo)}〜${n0(hi)}人（勝てば少なく、負ければ多い）`, `勝てば前線 +12〜26・負ければ −10〜24`, '厭戦 +1〜3・戦費がかさむ', '知人がその前線にいると、死傷することがある'], why: bestF ? null : (bat.why || '今日作戦できる前線がない（出兵するか、明日）'), rec: !!bestF && bestF.odds >= 55, reason: bestF ? (bestF.odds >= 55 ? `${bestF.name}は見込み ${bestF.odds}%。勝ちに行ける` : `いちばん高い${bestF.name}でも ${bestF.odds}%`) : '', act: { kind: 'war', id: 'battle', opts: { front: f && f.id }, name: '作戦' } });
  }
  // 動員
  const mob = by.mobilize;
  const add2 = dict ? [0, 30, 150, 300][Math.min(3, w.mob + 1)] : [0, 30, 60][Math.min(2, w.mob + 1)];
  add({ id: 'mobilize', name: `動員（第${w.mob + 1}次）`, desc: '予備の要員や志願兵を集め、兵力を増やす。', odds: null, costs: [`予備の部隊 +約${n0(add2 * 1000)}人`, `厭戦 +${dict && w.mob + 1 >= 2 ? 12 : 6}・不満 +${dict ? 6 : 2}・成長率 −${(0.5 + (w.mob + 1) * 0.3).toFixed(1)}（約200日）`, dict && w.mob + 1 >= 2 ? '徴兵になる。友人・兄弟が召集される（免除は代償つき）' : '予備自衛官・志願兵が応じる'], why: mob && mob.why, rec: !(mob && mob.why) && num(w.reserve) < 2, reason: num(w.reserve) < 2 ? '予備の部隊がない。増やさないと出兵も作戦もできない' : '', act: { kind: 'war', id: 'mobilize', name: '動員' } });
  // 方針
  const off = by.offensive, def = by.defend;
  if (off && !off.why) add({ id: 'offensive', name: '攻勢に出る', desc: '全体の方針を攻勢にする。戦況は動くが、毎日の死傷が増える。', odds: null, costs: ['作戦の見込み +10pt 相当・毎日の死傷が増える'], rec: avg >= 25 && bestF && bestF.odds >= 55, reason: '押している。畳みかけるなら', act: { kind: 'war', id: 'offensive', name: '攻勢' } });
  if (def && !def.why) add({ id: 'defend', name: '守りを固める', desc: '全体の方針を守りに切り替える。死傷は減るが、戦況は動きにくい。', odds: null, costs: ['毎日の死傷が減る・戦況は動きにくい'], rec: avg <= -20 && w.stance === 'offense', reason: '押し込まれている。傷を浅くするなら', act: { kind: 'war', id: 'defend', name: '防衛' } });
  if (by.withdraw && !by.withdraw.why) add({ id: 'withdraw', name: '撤兵（同盟国の戦争から引き揚げる）', desc: '日本の部隊を引き揚げる。', costs: ['戦争は終わる。同盟国は失望する'], act: { kind: 'war', id: 'withdraw', name: '撤兵', danger: true } });
  if (by.front_visit && !by.front_visit.why) add({ id: 'front_visit', name: '前線を視察する', desc: by.front_visit.desc, costs: ['厭戦 −4・支持率 ±1', '1日あたり 約0.8%で戦死する危険'], act: { kind: 'war', id: 'front_visit', name: '前線の視察', danger: true } });
  if (by.front_go && !by.front_go.why) add({ id: 'front_go', name: '前線へ行く（従軍）', desc: by.front_go.desc, costs: ['自分が前線に立つ。戦死すると、この人生は終わる（セーブは戦死の直前のまま残る）', '総理なら指揮をとり、部隊の戦力が少し上がる'], act: { kind: 'war', id: 'front_go', name: '前線へ行く', twice: true, danger: true } });
  if (by.front_return && !by.front_return.why) add({ id: 'front_return', name: '前線から戻る', desc: by.front_return.desc, costs: ['任務の途中で離れると、脱走と見なされることがある（見込みは確認される）'], act: { kind: 'war', id: 'front_return', name: '前線から戻る' } });
  const sur = by.surrender;
  add({ id: 'surrender', name: '降伏', desc: '降伏する。戦争は終わるが、重い代償を払う。', costs: [dict ? '独裁体制は崩れる（失脚の場面）' : '民主制では、総理は辞職に追い込まれる', '相手の要求を受けた講和になる'], why: sur && sur.why, act: { kind: 'war', id: 'surrender', name: '降伏', twice: true, danger: true } });
  // the recommendation: the first recommended in a sensible order
  const order = ['negotiate', 'mobilize', 'deploy', 'battle', 'offensive', 'defend'];
  out.sort((a, b) => (b.rec ? 1 : 0) - (a.rec ? 1 : 0) || (a.rec && b.rec ? order.indexOf(a.id) - order.indexOf(b.id) : 0));
  return out;
}
// the peace page: how good the chance is, and why
export function ikusaPeace(g) {
  const w = warOf(g);
  const wd = worldOf(g);
  const out = { w, lines: [], odds: null, level: 'none', peace: wd ? wd.peace : null };
  if (!w) {
    if (wd && wd.peace) out.lines.push(`${wd.peace.enemyName}との講和を待っている（${wd.peace.area}・${wd.peace.lost ? '敗戦' : wd.peace.won ? '勝利' : '停戦'}）。「外交」の「講和条約」で結ぶ。`);
    else out.lines.push('いまは戦争をしていない。');
    return out;
  }
  const talks = num(w.talksOdds) / 100;
  out.odds = talks;
  const avg = num(w.front);
  out.level = talks >= 0.6 ? 'good' : talks >= 0.35 ? 'mid' : 'low';
  out.verdict = out.level === 'good' ? 'いまが好機' : out.level === 'mid' ? 'ふつう。条件しだい' : '低い。もう少し戦況を整えてから';
  out.lines.push(`見込みの中身：土台 35%＋戦況の補正（全体 ${Math.round(avg)}÷150 = ${avg >= 0 ? '+' : '−'}${Math.abs(Math.round((avg / 150) * 100))}pt）${num(w.weariness) > 50 ? '＋厭戦が50を超えて +10pt' : ''}${w.nuclear ? '＋相手が核保有国で +5pt' : ''}${w.mode === 'defense' ? '＋守る戦争で +5pt' : ''}`);
  if (w.talks) out.lines.push(`いま交渉中（あと${Math.max(0, num(w.talks.until) - today(g))}日ほどで答えが出る）`);
  else if (today(g) - num(w.lastTalks, -99) < 6) out.lines.push('交渉は決裂したばかり。あと数日はやり直せない');
  out.lines.push(avg >= 30 ? '押している間に結ぶと、有利な条件で終わらせやすい（勝利なら係争地が日本のものに）' : avg <= -40 ? '前線が崩れる前に。−100になるか降伏すれば、戦争は敗戦で終わる' : '戦況が動くほど見込みも動く。作戦で前線を押し上げると上がる');
  out.lines.push('停戦のあとは「講和条約」の交渉。制裁は停戦後も残る');
  return out;
}
// 兵站
export function ikusaSupply(g) {
  const w = warOf(g);
  const r = regimeOf(g);
  const p = polOf(g);
  const sdf = safe(() => g.sdf(), null);
  const sup = SUPPLY(g, w);
  const eco = p && p.economy ? p.economy : {};
  const quit = num(stateRegime(g).sdf && stateRegime(g).sdf.quit);
  const lines = [];
  lines.push(`補給の効き ${Math.round(sup * 100)}%（これが部隊の戦力に掛かる。1.15が上限・0.4が下限）`);
  const parts = [`土台 100%`, r.sanctions ? `制裁 段階${r.sanctions} −${r.sanctions * 7}%` : null, w ? `厭戦 ${Math.round(w.weariness)} −${Math.round(w.weariness / 3)}%` : null, quit ? `大量辞職 −${(quit / 2000).toFixed(1)}%` : null].filter(Boolean);
  lines.push(`中身：${parts.join('　')}`);
  if (sdf) lines.push(`${sdf.name} 現員 約${(sdf.personnel.actual / 10000).toFixed(1)}万人（定員 約${(sdf.personnel.quota / 10000).toFixed(1)}万人）・防衛費 約${sdf.budget.cho}兆円${sdf.budget.gdpPct ? `（GDP比 約${sdf.budget.gdpPct}%）` : ''}`);
  if (w) {
    lines.push(`予備の部隊 約${n0(w.reserve * 1000)}人・動員 第${w.mob}次（${r.id === 'dictatorship' ? '最大 第3次＝総動員' : '最大 第2次まで（3次の徴兵は憲法18条）'}）`);
    lines.push(`戦費 これまで約${w.cost}兆円（日割りの負担は大きい）・物価 ${num(eco.inflation).toFixed(1)}%・成長率 ${num(eco.growth).toFixed(1)}%`);
    lines.push(`前線ごとの兵力：${(w.fronts || []).map((f) => `${f.name} 約${n0(f.own * 1000)}人`).join('／')}`);
  } else lines.push(`開戦のとき動かせる部隊：約${sdf ? Math.round((sdf.personnel.actual * 0.4) / 1000) : '—'}千人（現員の4割。このうち55%が最初に前線へ）`);
  const fix = [];
  if (r.sanctions) fix.push('制裁を緩める（外交：制裁の解除・首脳会談）→ 補給の効きが戻る');
  if (w && w.weariness > 40) fix.push('勝って厭戦を下げる／停戦で止める');
  if (quit) fix.push('国軍化による辞職は戻らない。戦力の損は織り込みずみで');
  fix.push('動員で予備を増やすと兵力は増えるが、不満と厭戦が上がる');
  return { sup, lines, fix };
}

// ================================================================ the advisors' voices and the advice lines
function exprFor(id, mood) { return exprOfMood(id, mood); }
function dokusaiBubble(g, P = dokusaiPlan(g), R = null) {
  R = R || (P.stage === 'pre' ? null : dokusaiRisks(g));
  let mood = P.mood;
  if (R && R.overall >= 70) mood = 'bad';
  else if (R && R.overall >= 45 && mood === 'good') mood = 'warn';
  const rec = P.items.find((i) => i.rec);
  let text = P.headline;
  if (rec && rec.odds != null && P.stage !== 'dictatorship') text += `\n『${rec.title}』の${rec.oddsText || '見込み'}は${pct(rec.odds)}。`;
  if (R && R.worst && R.worst.level >= 45 && P.stage !== 'dictatorship') text += `\n……${R.worst.name}の気配には、目を配っておきますよぉ。`;
  return { text, expr: exprFor('dokusai', mood), mood };
}
function ikusaBubble(g) {
  const nm = nameOf(g);
  const w = warOf(g);
  if (w) {
    const f = Math.round(num(w.front));
    const o = ikusaOrders(g);
    const rec = o.find((x) => x.rec);
    if (f <= -50) return { text: `${nm}！前線が崩れかけてる！\n停戦の見込みは${w.talksOdds}%！傷の浅いうちに決めろ！`, expr: exprFor('ikusa', 'warn'), mood: 'warn' };
    if (f >= 25) return { text: `押してるぞ、${nm}！\n${rec ? `次は『${rec.name}』だ。` : '畳みかけろ！'}ただし死者の数は見ておけ！`, expr: exprFor('ikusa', 'good'), mood: 'good' };
    return { text: `戦況は${w.frontText}だ、${nm}！\n${rec ? `次の命令は『${rec.name}』！${rec.odds != null ? `見込み${pct(rec.odds)}！` : ''}` : '次の命令を出せ！'}`, expr: exprFor('ikusa', f <= -20 ? 'warn' : 'order'), mood: f <= -20 ? 'warn' : 'order' };
  }
  const t = targetOf(g);
  const C = t ? ikusaChecklist(g, t.id) : null;
  if (!C) return { text: `報告！相手国の情報が読めん！`, expr: exprFor('ikusa', 'warn'), mood: 'warn' };
  const miss = C.items.find((x) => x.state === 'ng');
  if (C.ready) return { text: `準備よし！${t.short}相手なら、あとは${nm}の号令だけだ！\n見込みと代償は「次の命令」で確認しろ！`, expr: exprFor('ikusa', 'good'), mood: 'good' };
  return { text: `${nm}、まだ宣戦できんぞ！\n足りないのは「${miss ? miss.label : '準備'}」だ。まず「開戦の前に」を見ろ！`, expr: exprFor('ikusa', 'order'), mood: 'order' };
}
const bubbleOf = (g, id) => (id === 'dokusai' ? dokusaiBubble(g) : ikusaBubble(g));
// short factual lines for other screens (and the tips); most urgent first
export function advisorAdviceLines(g, id) {
  const out = [];
  if (!g || !g.state) return out;
  if (id === 'dokusai') {
    const P = dokusaiPlan(g);
    if (P.stage === 'fallen') return ['体制はもう崩れている。'];
    const rec = P.items.find((i) => i.rec);
    if (rec) out.push(`次の一手：${rec.title}${rec.odds != null ? `（${rec.oddsText || '成功の見込み'} ${pct(rec.odds)}）` : ''}${rec.why ? `。いまは：${shortText(rec.why, 40)}` : ''}`);
    if (P.stage !== 'pre') {
      const R = dokusaiRisks(g);
      out.push(`リスク：${R.items.map((x) => `${x.name.replace(/（.*$/, '')} ${x.label}`).join('・')}`);
      if (R.worst && R.worst.level >= 45 && R.worst.reduce[0]) out.push(`${R.worst.name}を下げるには：${R.worst.reduce[0].text}`);
    }
    if (!isExpert(g) && P.stage === 'democracy') out.push('正攻法は「発議（両院の3分の2）→国民投票（過半数）→宣言」。近道は「憲法の停止」（失敗すれば失脚）。');
    return out;
  }
  if (id === 'ikusa') {
    const w = warOf(g);
    if (w) {
      out.push(`戦況：${w.frontText}（全体 ${Math.round(num(w.front))}）・厭戦 ${Math.round(num(w.weariness))}／100・死者 兵士${n0(w.cas.soldiers.dead)}人`);
      const rec = ikusaOrders(g).find((x) => x.rec);
      if (rec) out.push(`次の命令：${rec.name}${rec.odds != null ? `（${rec.oddsLabel || '見込み'} ${pct(rec.odds)}）` : ''}`);
      out.push(`停戦の見込み ${w.talksOdds}%${w.talksOdds >= 60 ? '（好機）' : ''}`);
      return out;
    }
    const t = targetOf(g);
    const C = t ? ikusaChecklist(g, t.id) : null;
    if (C) {
      out.push(`開戦の前に（${t.short}）：${C.verdict}`);
      for (const x of C.items.filter((i) => i.state === 'ng').slice(0, 3)) out.push(`足りない：${x.label}${x.missing[0] ? `（${x.missing[0]}）` : ''}`);
    }
    return out;
  }
  return out;
}

// ================================================================ tips (a small portrait + speech bubble, as assist.js's, in the advisor's colours)
// TIPS[key] = { id, lv: 1 (はじめて only) | 2 (はじめて・ふつう) | 3 (every level), text: string | (g) => string, mood?, repeat? (days: may come again),
//   until?: (g) => true when no longer needed }
export const TIPS = {
  dok_first_pm: { id: 'dokusai', lv: 3, mood: 'good', until: (g) => !!(advisorState(g) || { met: {} }).met.dokusai, text: (g) => `はじめまして、${nameOf(g)}さま。ボクは独裁くん。非常時の切り札と、その先の権力の守り方をお手伝いします。${deviceWord(g) === '手帳' ? '手帳の「独裁くん」のしおり' : `${deviceWord(g)}の「独裁くん」`}で、次の一手と成功の見込みをお見せしますよぉ。` },
  dok_referendum: { id: 'dokusai', lv: 2, mood: 'good', text: (g) => { const A = regimeOf(g).amend; const ro = refOdds(g); return `国民投票は${A && A.voteDay ? `${daysLeft(g, A.voteDay)}日後` : 'まもなく'}。いまの賛成の見込みは${ro.yes}%（過半数の見込み ${pct(ro.p)}）。支持率を守るのが、いちばんの追い風ですよぉ。`; } },
  dok_breakaway: { id: 'dokusai', lv: 3, mood: 'good', text: (g) => { const bk = (stateRegime(g).breakaways || []).slice(-1)[0]; return `お別れは済みましたねぇ。${bk && bk.name ? `新しい看板は「${bk.name}」。` : ''}${bk && bk.moved ? `ついてきた議員は${bk.moved}人。` : ''}党は乗り物、降りるときは降りるだけですよぉ。あとの数字は、新党の議席で数えます。`; } },
  dok_emergency: { id: 'dokusai', lv: 3, mood: 'good', text: () => '緊急事態、成立ですねぇ。次は選挙と国会。ただし、選挙の停止などには6〜14日後に最高裁の判断が届きます。従うか、無視するか、考えておいてください。' },
  dok_dictator: { id: 'dokusai', lv: 3, mood: 'good', text: (g) => `おみごとです、${nameOf(g)}さま。ここからは「守る」仕事。不満が60を超えると蜂起の抽選が始まります。リスク診断で、いつも足もとを見ておきますよぉ。` },
  dok_court: { id: 'dokusai', lv: 3, mood: 'warn', text: () => '最高裁の判断が出ます。従えば取り消し（支持率+2・不満−6）、無視すれば代償（不満+6・懸念+8）と引き換えに、以後は判決が出なくなります。' },
  dok_unrest50: { id: 'dokusai', lv: 3, mood: 'warn', repeat: 40, text: (g) => `民衆の不満が${Math.round(regimeOf(g).unrest)}。50を超えると、各地で抗議が広がります。70でゼネスト、60を超えると蜂起の抽選ですよぉ。` },
  dok_downfall: { id: 'dokusai', lv: 3, mood: 'bad', repeat: 30, text: (g) => { const R = dokusaiRisks(g); const w0 = R.items.filter((x) => x.id !== 'sanction').sort((a, b) => b.level - a.level)[0]; return `……${nameOf(g)}さま、失脚の気配です。${w0 ? `${w0.name.replace(/（.*$/, '')}（${w0.short}）。` : ''}いまは手を打つ時間ですよぉ。「リスク診断」を開いてください。`; } },
  ik_before: { id: 'ikusa', lv: 3, mood: 'order', text: (g) => `${nameOf(g)}、宣戦できる道が開いたぞ！撃つ前に、「開戦の前に」のチェックリストを見ておけ！見込みも代償も数字で出る！` },
  ik_declared: { id: 'ikusa', lv: 3, mood: 'order', text: () => '開戦だ！まず予備を増やす「動員」、次に前線へ「出兵」、そして「作戦」だ！毎日の死者の数は、忘れるなよ！' },
  ik_collapse: { id: 'ikusa', lv: 3, mood: 'warn', repeat: 20, text: (g) => { const w = warOf(g); return `前線が崩れかけてる！停戦の見込みは${w ? w.talksOdds : '—'}%。傷の浅いうちに「停戦交渉」か、守りを固めろ！`; } },
  ik_peace: { id: 'ikusa', lv: 3, mood: 'good', repeat: 25, text: (g) => { const w = warOf(g); return `講和の好機だ！停戦の見込みは${w ? w.talksOdds : '—'}%。押している間に決めると、条件がいいぞ！`; } },
  ik_friend: { id: 'ikusa', lv: 3, mood: 'warn', text: () => '知人に召集がかかったぞ。名前のある兵士だ。免除もできるが、代償がある。戦況の画面で状況を見ておけ。' },
  ik_end: { id: 'ikusa', lv: 2, mood: 'order', text: () => '戦闘は終わった！次は講和だ。「外交」の「講和条約」で結ぶ。制裁は停戦のあとも残るぞ。' },
};
function tipBox(g) { return g._advTips || (g._advTips = { queue: [], cur: null, clock: 0, lastEnd: -9999, watchT: 0 }); }
function assistTipsOff(g) { return !!safe(() => g.assistState().tipsOff, false); }
function tipAllowed(g, lv) {
  const h = lvlOf(g);
  return h === 'beginner' ? true : h === 'normal' ? lv >= 2 : lv >= 3;
}
function tipText(g, key, opts) {
  const t = opts && opts.text != null ? opts.text : TIPS[key] ? TIPS[key].text : '';
  try { return [].concat(typeof t === 'function' ? t(g) : t).filter(Boolean).join('\n'); } catch (e) { return ''; }
}
// Where the player is free (as assist.js tipContext): walking, the phone, the politics / government / world screens.
function tipContext(g) {
  if (!g.state || g.auto || g.fade > 0.01) return null;
  const top = g.top;
  if (!top) return null;
  if (top === g.map) return g.busy === 0 && g.map.place ? 'map' : null;
  if (top.isPhone && !top.closing && !top.dismissed) return 'phone';
  if (top.isPolUI || top.isGovtUI || top.isWorldUI || top.allowTips) return 'ui';
  return null;
}
function sceneModal(s) {
  if (!s) return false;
  try {
    if (typeof s.hasModal === 'function') return !!s.hasModal();
    if (s.hasModal != null) return !!s.hasModal;
    if (Array.isArray(s.modals) && s.modals.length) return true;
    if (s.isPolUI && typeof s.top === 'function') { const v = s.top(); return !!(v && v.modal); }
    if (s.isGovtUI && s.zoom && !s.tipArea) return true;
  } catch (e) { return false; }
  return false;
}
export function advisorTip(g, key, opts = {}) {
  if (!g || !g.state || !key) return false;
  const a = advisorState(g);
  if (!a) return false;
  const def = TIPS[key] || {};
  const id = opts.id || def.id || 'dokusai';
  if (!ADVISORS[id]) return false;
  if (!a.seen[key]) a.seen[key] = today(g);
  if (opts.silent) return false;
  if (g.auto) return false;
  const force = !!opts.force;
  if (!force && (a.tipsOff || a.muted[id] || assistTipsOff(g))) return false;
  const shown = a.tips[key];
  if (shown && !force && !(def.repeat && today(g) - shown >= def.repeat)) return false;
  if (!force && !tipAllowed(g, opts.level || def.lv || 2)) return false;
  if (def.until && safe(() => def.until(g), false)) return false;
  if (!force) { // at most two advisor tips on one game day
    if (a.tipDay !== today(g)) { a.tipDay = today(g); a.tipsToday = 0; }
    if (a.tipsToday >= 2) return false;
  }
  const txt = tipText(g, key, opts);
  if (!txt) return false;
  const b = tipBox(g);
  if ((b.cur && b.cur.key === key) || b.queue.some((q) => q.key === key)) return false;
  b.queue.push({ key, id, text: txt, expr: opts.expr || exprFor(id, opts.mood || def.mood || 'calm'), ctx: opts.ctx || null, born: b.clock, force });
  if (b.queue.length > 3) b.queue.shift();
  return true;
}
export function advisorTipClear(g, keys) {
  const b = g && g._advTips;
  if (!b) return 0;
  const set = new Set([].concat(keys || []));
  const hit = (k) => keys == null || set.has(k);
  const n0_ = b.queue.length + (b.cur ? 1 : 0);
  b.queue = b.queue.filter((q) => !hit(q.key));
  if (b.cur && hit(b.cur.key)) b.cur = null;
  return n0_ - b.queue.length - (b.cur ? 1 : 0);
}
function assistShowing(g) { const b = g._naviTips; return !!(b && b.cur); }
function stepTips(g) {
  const b = g._advTips;
  if (!b || (!b.cur && !b.queue.length)) return;
  b.clock++;
  const ctx = tipContext(g);
  const top = g.top;
  const modal = ctx === 'ui' && sceneModal(top);
  if (b.cur && b.cur.ctx && ctx && ctx !== b.cur.ctx) b.cur = null;
  if (!b.cur) {
    if (!ctx || modal || !b.queue.length) return;
    if (assistShowing(g)) return; // 政治ナビ's bubble first
    if (b.clock - b.lastEnd < 240 && !b.queue[0].force) return; // a few seconds between two tips
    if (b.queue.some((q) => b.clock - q.born > 3600)) b.queue = b.queue.filter((q) => b.clock - q.born <= 3600); // a tip that waited a minute is dropped (it comes back at its next trigger)
    const next = b.queue.shift();
    if (!next) return;
    const a = advisorState(g);
    if (!a) return;
    a.tips[next.key] = today(g);
    if (a.tipDay !== today(g)) { a.tipDay = today(g); a.tipsToday = 0; }
    a.tipsToday++;
    const n = Array.from(next.text).length;
    b.cur = { ...next, ctx: next.ctx || ctx, t: 0, life: clamp(260 + n * 5, 320, 700) };
    sfx('cursor');
    return;
  }
  if (ctx && !modal && (!b.cur.ctx || b.cur.ctx === ctx)) { b.cur.t++; if (b.cur.t >= b.cur.life) { b.cur = null; b.lastEnd = b.clock; } }
}
function wrapLines(c, str, w, size) {
  // Japanese line breaking (kinsoku, numbers kept whole): reuse the phone's helper if present
  return jwrapA(c, str, w, size);
}
function uiTipSpot(g, top, w, h, cur) {
  let area = safe(() => (typeof top.tipArea === 'function' ? top.tipArea() : top.tipArea), null);
  if (!area && top && top.isGovtUI) area = { x: 4, y: 44, w: SW - 8, h: 340 - 4 - 44 };
  if (!area || !Number.isFinite(area.x)) return { x: SW - w - 8, y: 30 };
  let avoid = safe(() => (typeof top.tipAvoid === 'function' ? top.tipAvoid() : null), null);
  if (!avoid && top.isGovtUI) {
    avoid = [];
    if (top.focus === 'body' && typeof top.ctl === 'function') { const k = safe(() => top.ctl(), null); if (k) avoid.push(k); }
  }
  avoid = (Array.isArray(avoid) ? avoid : []).filter((r) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite));
  const right = area.x + area.w - w - 4, left = area.x + 2, top0 = area.y + 2, bottom = Math.max(top0, area.y + area.h - h - 2);
  const spots = [[right, bottom], [right, top0], [left, bottom], [left, top0]];
  const over = ([sx, sy]) => avoid.reduce((s, r) => s + Math.max(0, Math.min(sx + w + 2, r.x + r.w) - Math.max(sx, r.x)) * Math.max(0, Math.min(sy + h + 2, r.y + r.h) - Math.max(sy, r.y)), 0);
  const o = spots.map(over);
  let i = clamp(cur.spot | 0, 0, spots.length - 1);
  if (o[i] > 0) { const best = o.indexOf(Math.min(...o)); if (o[best] < o[i]) i = best; }
  cur.spot = i;
  return { x: spots[i][0], y: spots[i][1] };
}
function drawTip(c, g) {
  const b = g._advTips;
  if (!b || !b.cur) return;
  const ctx = tipContext(g);
  if (!ctx || (b.cur.ctx && b.cur.ctx !== ctx)) return;
  const top = g.top;
  if (ctx === 'ui' && sceneModal(top)) return;
  const A = ADVISORS[b.cur.id];
  const t = b.cur.t, life = b.cur.life;
  const al = t < 10 ? t / 10 : life - t < 16 ? (life - t) / 16 : 1;
  let x = 8, w = 312, y;
  if (ctx === 'phone') { x = 6; w = (PH.PHONE ? PH.PHONE.x : 200) - 12; }
  const pw = 44;
  const tw = w - pw - 22;
  const lines = wrapLines(c, b.cur.text, tw, 12).slice(0, ctx === 'phone' ? 9 : 5);
  const h = Math.max(54, 24 + lines.length * 16);
  if (ctx === 'phone') y = 40;
  else if (ctx === 'ui') ({ x, y } = uiTipSpot(g, top, w, h, b.cur));
  else y = SH - 10 - h;
  const slide = t < 10 ? Math.round((1 - t / 10) * 12) : 0;
  const dark = b.cur.id === 'dokusai' ? '#5a1830' : '#4b5828';
  const paper = b.cur.id === 'dokusai' ? '#fbf3f6' : '#f8f9ec';
  c.save();
  c.globalAlpha = clamp(al, 0, 1);
  c.translate(-slide, 0);
  rectFill(c, x + 2, y + 2, pw, pw, 'rgba(0,0,0,0.35)');
  cardBack(c, b.cur.id, x, y, pw, pw);
  c.save();
  c.beginPath(); c.rect(x + 1, y + 1, pw - 2, pw - 2); c.clip();
  drawAdvisorFace(c, b.cur.id, x + 2 - 4, y + 4, 1.5, b.cur.expr);
  c.restore();
  const bx = x + pw + 8, bw = w - pw - 8;
  rectFill(c, bx + 2, y + 2, bw, h, 'rgba(0,0,0,0.35)');
  boxFrame(c, bx, y, bw, h, paper, dark);
  for (let i = 0; i < 6; i++) rectFill(c, bx - 6 + i, y + 16 + i, 1, 12 - i * 2, i === 0 ? dark : paper);
  rectFill(c, bx - 6, y + 16, 6, 1, dark);
  txt(c, A.short, bx + 8, y + 4, 12, dark);
  if (bw > 200) txt(c, b.cur.id === 'dokusai' ? '権力の相談役' : '戦の教官', bx + bw - 8, y + 4, 12, '#9a8a90', 'right');
  lines.forEach((l, i) => txt(c, l, bx + 8, y + 20 + i * 16, 12, '#2a2a3a'));
  rectFill(c, bx + 6, y + h - 4, Math.round((bw - 12) * (1 - t / life)), 1, A.color2);
  c.restore();
}
function boxFrame(c, x, y, w, h, fill, edge) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  rectFill(c, x + 1, y, w - 2, 1, edge); rectFill(c, x + 1, y + h - 1, w - 2, 1, edge); rectFill(c, x, y + 1, 1, h - 2, edge); rectFill(c, x + w - 1, y + 1, 1, h - 2, edge);
  if (fill) rectFill(c, x + 1, y + 1, w - 2, h - 2, fill);
}
function txt(c, s, x, y, size = 12, color = '#2a2a3a', align = 'left') { text(c, String(s), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }

// ---------------------------------------------------------------- the triggers (a few times a second, and each morning): short tips at the right moments
function watch(g) {
  const b = tipBox(g);
  if (++b.watchT % 30) return;
  if (!g.state || g.auto) return;
  const a = advisorState(g);
  if (!a) return;
  const F = a.flags;
  const r = stateRegime(g);
  const rid = r.id || 'democracy';
  const pm = isPMOf(g);
  // first time PM with a majority
  if (pm && !F.firstPM) {
    const p = polOf(g);
    const S = seatsOf(p, 'shugi');
    if (S && S.ruling >= S.majority) { F.firstPM = today(g); advisorTip(g, 'dok_first_pm'); }
  }
  // regime changes
  if (F.rid !== rid) {
    const was = F.rid;
    F.rid = rid;
    if (was) {
      if (rid === 'emergency') advisorTip(g, 'dok_emergency');
      if (rid === 'dictatorship') advisorTip(g, 'dok_dictator');
    }
  }
  const bks = (r.breakaways || []).length;
  if (F.bk == null) F.bk = bks; else if (bks > F.bk) { F.bk = bks; advisorTip(g, 'dok_breakaway'); }
  if (rid === 'democracy' && r.amend && r.amend.stage === 'referendum' && !F.refTip) { F.refTip = today(g); advisorTip(g, 'dok_referendum'); }
  if (rid !== 'democracy' && rid !== 'fallen') {
    if (num(r.unrest) >= 50) advisorTip(g, 'dok_unrest50');
    if ((r.courts || []).some((c) => today(g) >= num(c.day) - 1)) advisorTip(g, 'dok_court');
    if (pm) {
      const R2 = dokusaiRisks(g);
      if (R2.items.some((x) => x.id !== 'sanction' && x.level >= 60)) advisorTip(g, 'dok_downfall');
    }
  }
  // the war
  const w = r.war && r.war.phase === 'war' ? warOf(g) : null;
  if (w) {
    F.inWar = true;
    advisorTip(g, 'ik_declared');
    if (num(w.front) <= -50) { if (!F.collapse) { F.collapse = today(g); advisorTip(g, 'ik_collapse'); } } else if (num(w.front) > -35) F.collapse = 0;
    if (num(w.talksOdds) >= 60 && num(w.front) >= 15 && !w.talks) { if (!F.peaceGood) { F.peaceGood = today(g); advisorTip(g, 'ik_peace'); } } else if (num(w.talksOdds) < 50) F.peaceGood = 0;
    const called = (w.known || []).filter((k) => k.status === 'called' && (k.kind === 'friend' || k.kind === 'family')).map((k) => k.key);
    F.called = Array.isArray(F.called) ? F.called : [];
    if (called.some((k) => !F.called.includes(k))) { F.called = [...new Set([...F.called, ...called])]; advisorTip(g, 'ik_friend'); }
  } else {
    if (F.inWar) { F.inWar = false; F.collapse = 0; F.peaceGood = 0; advisorTip(g, 'ik_end'); }
    // the legal road to a declaration opened for the first time
    if (!F.beforeTip && (pm || rid === 'dictatorship') && F.beforeDay !== today(g)) {
      F.beforeDay = today(g);
      const t = targetOf(g);
      const ok = safe(() => (has(g, 'warPaths') ? g.warPaths(t && t.id).declare === null : false), false);
      if (ok) { F.beforeTip = today(g); advisorTip(g, 'ik_before'); }
    }
  }
}
function hookRegime(m) {
  m.onRegime('war', (g, d) => { if (d && d.kind === 'declare') { const a = advisorState(g); if (a) { a.flags.inWar = true; } advisorTip(g, 'ik_declared'); } });
  m.onRegime('step', (g) => { const a = advisorState(g); if (a) a.flags.beforeDay = 0; tipBox(g).watchT = 29; });
  m.onRegime('regime', (g) => { tipBox(g).watchT = 29; });
}
function hookPolitics(m) {
  m.onPolitics('cabinet', (g, d) => { if (d && d.pm === 'player') { const b = tipBox(g); b.watchT = 29; } });
}

// ================================================================ the phone app screens (built on phone.js phoneView)
const PCx = Object.assign({ bg: '#f4f1e8', text: '#2a2a3a', dim: '#7c7a88', line: '#dcd5c4', sel: '#fff1c2', selEdge: '#e0a82e', good: '#2f9a4a', bad: '#d6304a', accent: '#e07a1f', foot: '#e7e1d1' }, PH.PC || {});
const LH = 15;
// Japanese line breaking: a closing mark / small kana never starts a line, an opening bracket never ends one, numbers keep their unit.
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-+＋]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:分の[0-9]+|[%％年月日歳人分万億兆円倍回本条号割棟件隻機台]+|pt)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
function jwrapA(c, str, w, size = 12) {
  measure(c, '', size);
  const W = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let line = '';
    const hard = (s0) => { for (const ch of Array.from(s0)) { if (line && W(line + ch) > w) { out.push(line); line = ''; } line += ch; } };
    for (const t of toks) {
      if (!line && /^\s+$/.test(t) && out.length) continue;
      if (W(line + t) <= w) { line += t; continue; }
      if (!line) { hard(t); continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) {
        const a0 = Array.from(line);
        let k = a0.length - 1;
        while (k > 0 && NO_START.has(a0[k])) k--;
        if (k > 0) { carry = a0.slice(k).join(''); line = a0.slice(0, k).join(''); } else { line += t; continue; }
      }
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line.replace(/\s+$/, ''));
      line = '';
      const rest = carry + (/^\s+$/.test(t) ? '' : t);
      if (W(rest) > w) hard(rest); else line = rest;
    }
    out.push(line);
  }
  return out;
}
const fitT = (c, s, w, size = 12) => PH.fitText(c, s, w, size);
const T = (c, s, x, y, size = 12, color = PCx.text, align = 'left') => PH.phoneText(c, s, Math.round(x), Math.round(y), size, color, align);
const RF = rectFill;
function chip(c, label, x, y, bg, fg = '#ffffff', align = 'left') {
  const w = Math.round(measure(c, label, 12)) + 8;
  const x0 = align === 'right' ? x - w : x;
  RF(c, x0 + 1, y, w - 2, 14, bg); RF(c, x0, y + 1, w, 12, bg);
  T(c, label, x0 + 4, y + 1, 12, fg);
  return w;
}
function drawBar(c, x, y, w, h, frac, col, back = '#e4ddcc') {
  RF(c, x, y, w, h, back);
  RF(c, x, y, Math.round(w * clamp(frac, 0, 1)), h, col);
}
// a centred bar from −100..100 (the front's control)
function drawBar2(c, x, y, w, h, v) {
  RF(c, x, y, w, h, '#e4ddcc');
  const mid = x + w / 2;
  const len = Math.round((w / 2) * clamp(Math.abs(v) / 100, 0, 1));
  RF(c, v >= 0 ? mid : mid - len, y, len, h, v >= 0 ? '#2f9a4a' : '#d6304a');
  RF(c, Math.round(mid), y - 1, 1, h + 2, '#7c7a88');
}
const STATE = { done: ['済', '#2f9a4a'], can: ['できる', null], wait: ['まだ', '#8a8a96'], info: ['参考', '#4a78d8'], ok: ['OK', '#2f9a4a'], ng: ['不足', '#d6304a'], warn: ['注意', '#c8861a'] };
const advColor = (id) => ADVISORS[id].color;

// a small portrait on its card (k = 1 → 36 px with the frame)
function miniPortrait(c, id, x, y, expr, blink = false) {
  drawAdvisorBust(c, id, x + 2, y + 2, 1, { expr, blink });
}
// the advisor's line in a speech bubble under the header: portrait + bubble (h = 44)
function drawHead(c, a, id, line, expr, t = 0) {
  const A = ADVISORS[id];
  const blink = Math.floor(t / 4) % 60 < 2;
  RF(c, a.x, a.y, a.w, 58, '#ebe5d6'); RF(c, a.x, a.y + 58, a.w, 1, '#cfc6b0');
  miniPortrait(c, id, a.x + 4, a.y + 10, expr, blink);
  const bx = a.x + 44, bw = a.w - 50;
  boxFrame(c, bx, a.y + 4, bw, 50, '#ffffff', A.color);
  for (let i = 0; i < 4; i++) RF(c, bx - 4 + i, a.y + 20 + i, 1, 8 - i * 2, i === 0 ? A.color : '#ffffff');
  const ls = jwrapA(c, line || '', bw - 10, 12);
  ls.slice(0, 3).forEach((l, i) => T(c, i === 2 && ls.length > 3 ? fitT(c, `${l}…`, bw - 10, 12) : l, bx + 5, a.y + 7 + i * 14, 12, PCx.text));
  return 60;
}

// ---- the card list. o: { id (advisor), title, color, head: (view) => { text, expr } | null, cards: () => [card], pick(ph, card, view), hint, index, empty }
// card: { tag?, tagColor?, title, right?, rightColor?, odds?, bar?, bar2?, lines: [string | { t, c }], state, rec, act?, go?, disabled? }
function cardsView(g, o) {
  const id = o.id;
  const v = {
    title: o.title, color: o.color || advColor(id), idx: o.index | 0, sy: 0, cancel: -1, cards: [], lay: null, rects: [], age: 0, bg: '#f4f1e8',
    hint: () => { const c0 = v.cards[v.idx | 0]; return c0 && (c0.act || c0.go) ? 'A:ひらく・実行　B:もどる' : 'A:くわしく　B:もどる'; },
    refresh() { try { this.cards = o.cards() || []; } catch (e) { console.error(e); this.cards = []; } this.lay = null; this.idx = clamp(this.idx, 0, Math.max(0, this.cards.length - 1)); },
    enter() { this.refresh(); },
    update(ph, inp) {
      this.age++;
      if (this.age % 120 === 0) this.refresh();
      const n = this.cards.length;
      if (n) {
        const bd = () => { const L0 = this.lay; const it = L0 && L0.items[this.idx]; const vh = this.viewH || 150; if (!it) return null; const tp = it.y - 4, bt = it.y + it.h - vh + 6; return { lo: Math.min(tp, bt), hi: Math.max(tp, bt), tall: it.h > vh - 10 }; };
        if (inp.repeat('up')) { const b0 = bd(); if (b0 && b0.tall && this.sy > b0.lo + 1) { this.sy = Math.max(b0.lo, this.sy - 28); sfx('cursor'); } else { this.idx = (this.idx + n - 1) % n; sfx('cursor'); } }
        if (inp.repeat('down')) { const b0 = bd(); if (b0 && b0.tall && this.sy < b0.hi - 1) { this.sy = Math.min(b0.hi, this.sy + 28); sfx('cursor'); } else { this.idx = (this.idx + 1) % n; sfx('cursor'); } }
        if (inp.pressed('a')) {
          const c0 = this.cards[this.idx];
          sfx('ok');
          ph.run(this, async () => { await o.pick(ph, c0, this); this.refresh(); });
          return;
        }
      }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(-1); }
    },
    tap(ph, x, y) {
      for (const r of this.rects) if (y >= r.y && y < r.y + r.h && x >= r.x && x < r.x + r.w) { this.idx = r.i; return true; }
      return false;
    },
    draw(c, ph, a) {
      const W = a.w - 12;
      let top = a.y;
      if (o.head) {
        const hd = safe(() => o.head(this), null);
        if (hd) top += drawHead(c, a, id, hd.text, hd.expr, this.age);
      }
      const view = { x: a.x, y: top, w: a.w, h: a.y + a.h - top };
      if (!this.lay || this.lay.W !== W) this.lay = this.layout(c, W);
      const L = this.lay;
      const sel = clamp(this.idx, 0, Math.max(0, this.cards.length - 1));
      this.viewH = view.h;
      if (L.items.length) {
        const it = L.items[sel];
        const tp = it.y - 4, bt = it.y + it.h - view.h + 6;
        this.sy = clamp(this.sy, Math.min(tp, bt), Math.max(tp, bt));
        this.sy = clamp(this.sy, 0, Math.max(0, L.total - view.h + 8));
      }
      this.rects = [];
      c.save();
      c.beginPath(); c.rect(view.x, view.y, view.w, view.h); c.clip();
      if (!this.cards.length) {
        const ls = jwrapA(c, o.empty || '（まだありません）', a.w - 32, 12);
        ls.forEach((l, i) => T(c, l, a.x + a.w / 2, view.y + 30 + i * 16, 12, PCx.dim, 'center'));
      }
      L.items.forEach((it, i) => {
        const y = view.y + 4 + it.y - this.sy;
        if (y > view.y + view.h || y + it.h < view.y) return;
        this.rects.push({ x: a.x, y: Math.max(y, view.y), w: a.w, h: it.h, i });
        this.drawCard(c, a.x + 6, y, W, it, i === sel, i);
      });
      c.restore();
      if (L.total > view.h) {
        const bh = Math.max(12, Math.round((view.h * view.h) / (L.total + 8)));
        const by = view.y + Math.round(((view.h - bh) * this.sy) / Math.max(1, L.total - view.h + 8));
        RF(c, a.x + a.w - 3, view.y, 3, view.h, '#e4ddcc'); RF(c, a.x + a.w - 3, by, 3, bh, '#a8a090');
      }
    },
    layout(c, W) {
      const items = [];
      let y = 0;
      for (const card of this.cards) {
        const hasChip = !!(card.rec || card.tag || card.state);
        const hasRight = !!(card.right || card.odds != null || hasChip);
        const chipW = hasChip ? Math.round(measure(c, card.rec ? '★おすすめ' : card.tag || (STATE[card.state] || [''])[0], 12)) + 10 : 0;
        const rtW = card.right ? Math.round(measure(c, card.right, 12)) + 8 : 0;
        const rightW = hasRight ? Math.max(chipW, card.odds != null ? 42 : 0) + rtW + 4 : 0;
        const innerW = W - 14;
        const tl = jwrapA(c, card.title || '', innerW - rightW, 12);
        const rightH = hasRight ? (card.odds != null && hasChip ? 36 : 18) : 0;
        let h = 6 + Math.max(tl.length * LH, rightH);
        const sets = [];
        for (const ln of card.lines || []) {
          const s = typeof ln === 'string' ? { t: ln } : ln;
          if (!s.t) continue;
          const ls = jwrapA(c, s.t, innerW - (s.i || 0), 12);
          sets.push({ ls, c: s.c || PCx.dim, i: s.i || 0 });
          h += ls.length * 14;
        }
        if (card.bar != null || card.bar2 != null) h += 8;
        h += 6;
        items.push({ y, h, tl, sets, rightW });
        y += h + 5;
      }
      return { W, items, total: y };
    },
    drawCard(c, x, y, W, it, sel, i) {
      const card = this.cards[i];
      const st = card.state && STATE[card.state];
      const barCol = card.rec ? '#d6a21a' : st ? (st[1] || advColor(id)) : advColor(id);
      boxFrame(c, x, y, W, it.h, sel ? '#fff8de' : card.disabled ? '#f0ede4' : '#ffffff', sel ? PCx.selEdge : '#d6cfbf');
      RF(c, x + 1, y + 1, 3, it.h - 2, barCol);
      const tx = x + 9;
      it.tl.forEach((l, k) => T(c, l, tx, y + 4 + k * LH, 12, card.disabled ? PCx.dim : '#1a1a28'));
      let ry = y + 4;
      const rx = x + W - 5;
      let cw = 0;
      if (card.rec) { cw = chip(c, '★おすすめ', rx, ry, '#d6a21a', '#ffffff', 'right'); ry += 16; }
      else if (card.tag) { cw = chip(c, card.tag, rx, ry, card.tagColor || advColor(id), '#ffffff', 'right'); ry += 16; }
      else if (st) { cw = chip(c, st[0], rx, ry, st[1] || advColor(id), '#ffffff', 'right'); ry += 16; }
      if (card.right) T(c, card.right, rx - (cw ? cw + 4 : 0), (cw ? ry - 16 : ry) + (cw ? 1 : 0), 12, card.rightColor || PCx.dim, 'right');
      if (card.odds != null) T(c, pct(card.odds), rx, cw ? ry : ry, 14, oddsColor(card.odds), 'right');
      const hasR = !!(card.rec || card.tag || st || card.right || card.odds != null);
      let ly = y + 4 + Math.max(it.tl.length * LH, hasR ? (card.odds != null && (card.rec || card.tag || st) ? 36 : 18) : 0) + 2;
      for (const s of it.sets) { s.ls.forEach((l, k) => T(c, l, tx + s.i, ly + k * 14, 12, s.c)); ly += s.ls.length * 14; }
      if (card.bar != null) { drawBar(c, tx, ly + 1, W - 20, 5, card.bar, card.barColor || advColor(id)); }
      if (card.bar2 != null) drawBar2(c, tx, ly + 1, W - 20, 5, card.bar2);
      if ((card.act || card.go) && sel) T(c, '▶', x + W - 8, y + it.h - 15, 12, advColor(id), 'right');
    },
  };
  return v;
}
// ---- a scrolling text page. lines: string | { t, c, h (heading) }
function textView(g, o) {
  const v = {
    title: o.title, color: o.color || advColor(o.id), sy: 0, cancel: true, maxScroll: 0, age: 0, bg: '#f4f1e8',
    hint: () => (v.maxScroll > 0 && v.sy < v.maxScroll ? '↑↓:よむ　A:もどる' : 'A:もどる'),
    update(ph, inp) {
      this.age++;
      if (this.maxScroll > 0) {
        if (inp.repeat('down')) this.sy = Math.min(this.maxScroll, this.sy + 16);
        if (inp.repeat('up')) this.sy = Math.max(0, this.sy - 16);
      }
      if (inp.pressed('a') || inp.pressed('b')) { sfx('cancel'); ph.back(true); }
    },
    tap(ph, x, y) {
      if (this.maxScroll > 0 && this.sy < this.maxScroll) { this.sy = Math.min(this.maxScroll, this.sy + 96); return false; }
      return true;
    },
    draw(c, ph, a) {
      let top = a.y;
      if (o.head) { const hd = safe(() => o.head(this), null); if (hd) top += drawHead(c, a, o.id, hd.text, hd.expr, this.age); }
      const W = a.w - 20;
      const src = typeof o.lines === 'function' ? o.lines() : o.lines;
      const key = `${W}|${JSON.stringify(src)}`;
      if (!this.cache || this.cache.key !== key) {
        const rows = [];
        for (const ln of [].concat(src).filter((l) => l != null)) {
          const s = typeof ln === 'string' ? { t: ln } : ln;
          const ls = s.t === '' ? [''] : jwrapA(c, g.fmt ? g.fmt(s.t) : s.t, W - (s.i || 0), s.h ? 14 : 12);
          for (const l of ls) rows.push({ t: l, c: s.c || (s.h ? advColor(o.id) : PCx.text), h: !!s.h, i: s.i || 0, size: s.h ? 14 : 12 });
          if (s.gap) rows.push({ t: '', size: 12 });
        }
        this.cache = { key, rows };
      }
      const rows = this.cache.rows;
      const area = { y: top, h: a.y + a.h - top };
      const total = rows.reduce((s, r) => s + (r.size === 14 ? 18 : 16), 0) + 16;
      this.maxScroll = Math.max(0, total - area.h);
      this.sy = clamp(this.sy, 0, this.maxScroll);
      c.save(); c.beginPath(); c.rect(a.x, area.y, a.w, area.h); c.clip();
      let y = area.y + 8 - this.sy;
      for (const r of rows) { if (y > area.y - 18 && y < area.y + area.h) T(c, r.t, a.x + 10 + r.i, y, r.size, r.c); y += r.size === 14 ? 18 : 16; }
      c.restore();
      if (this.maxScroll > 0 && this.sy < this.maxScroll) downArrow(c, a.x + a.w - 14, a.y + a.h - 10, this.age, PCx.dim);
    },
  };
  return v;
}
function downArrow(c, x, y, t, col) { if (Math.floor(t / 20) % 2 === 0) T(c, '▼', x, y - 6, 12, col, 'center'); }
// ---- the confirmation: the odds and the price, then 実行する / やめる. o: { id, title, lines[], odds, oddsLabel, costs[], danger, why }
function confirmView(g, o) {
  const A = ADVISORS[o.id];
  const v = {
    title: o.title, color: o.danger ? '#7a1020' : A.color, idx: o.danger ? 1 : 0, cancel: 1, sy: 0, maxScroll: 0, age: 0, bg: '#f4f1e8', area: null,
    hint: 'A:けってい　←→:えらぶ　↑↓:よむ',
    update(ph, inp) {
      this.age++;
      if (inp.repeat('left')) { this.idx = 0; sfx('cursor'); }
      if (inp.repeat('right')) { this.idx = 1; sfx('cursor'); }
      if (this.maxScroll > 0) {
        if (inp.repeat('down')) this.sy = Math.min(this.maxScroll, this.sy + 16);
        if (inp.repeat('up')) this.sy = Math.max(0, this.sy - 16);
      }
      if (inp.pressed('a')) { sfx(this.idx === 0 ? 'ok' : 'cancel'); ph.back(this.idx); } else if (inp.pressed('b')) { sfx('cancel'); ph.back(1); }
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      const by = a.y + a.h - 32;
      if (y >= by && y < by + 28) { this.idx = x < a.x + a.w / 2 ? 0 : 1; return true; }
      if (this.maxScroll > 0 && y < by) { this.sy = this.sy >= this.maxScroll ? 0 : Math.min(this.maxScroll, this.sy + 80); }
      return false;
    },
    draw(c, ph, a) {
      this.area = a;
      const bodyH = a.h - 36;
      const W = a.w - 20;
      const rows = [];
      const add = (t, col, size = 12, i = 0) => { for (const l of jwrapA(c, g.fmt ? g.fmt(t) : t, W - i, size)) rows.push({ t: l, c: col, size, i }); };
      let head = 0;
      const olines = o.odds != null ? jwrapA(c, o.oddsLabel || '成功の見込み', a.w - 28 - 60, 12).slice(0, 2) : [];
      if (o.odds != null) head = 44 + (olines.length - 1) * 14;
      if (o.costs && o.costs.filter(Boolean).length) { rows.push({ t: '代償と結果の目安', c: A.color, size: 12, b: true }); for (const l of o.costs.filter(Boolean)) add(`・${l}`, '#6a4a1a', 12, 4); }
      if ((o.lines || []).length) rows.push({ t: o.costs && o.costs.filter(Boolean).length ? 'くわしく' : '内容', c: A.color, size: 12, b: true });
      for (const l of o.lines || []) add(l, PCx.text);
      if (o.note) add(o.note, PCx.dim);
      const total = rows.length * 15 + 12;
      this.maxScroll = Math.max(0, total - (bodyH - head));
      this.sy = clamp(this.sy, 0, this.maxScroll);
      if (o.odds != null) {
        const bh = 36 + (olines.length - 1) * 14;
        boxFrame(c, a.x + 8, a.y + 6, a.w - 16, bh, '#ffffff', oddsColor(o.odds));
        olines.forEach((l, i) => T(c, l, a.x + 14, a.y + 9 + i * 14, 12, PCx.dim));
        T(c, pct(o.odds), a.x + a.w - 14, a.y + 8, 18, oddsColor(o.odds), 'right');
        drawBar(c, a.x + 14, a.y + bh - 6, a.w - 28, 6, o.odds, oddsColor(o.odds));
      }
      c.save(); c.beginPath(); c.rect(a.x, a.y + head, a.w, bodyH - head); c.clip();
      let y = a.y + head + 8 - this.sy;
      for (const r of rows) { if (y > a.y + head - 16 && y < a.y + bodyH) T(c, r.t, a.x + 10 + (r.i || 0), y, r.size, r.c); y += 15; }
      c.restore();
      if (this.maxScroll > 0 && this.sy < this.maxScroll) downArrow(c, a.x + a.w - 14, a.y + bodyH + 2, this.age, PCx.dim);
      const by = a.y + a.h - 32;
      const labels = ['実行する', 'やめる'];
      labels.forEach((lab, i) => {
        const bx = a.x + 8 + i * ((a.w - 16) / 2 + 2), bw = (a.w - 16) / 2 - 2;
        const on = this.idx === i;
        const col = i === 0 ? (o.danger ? '#b01c34' : A.color) : '#6a6a78';
        boxFrame(c, bx, by, bw, 28, on ? col : '#ffffff', on ? shade(col, -0.45) : '#b8b0a0');
        T(c, lab, bx + bw / 2, by + 7, 14, on ? '#ffffff' : PCx.text, 'center');
      });
    },
  };
  return v;
}
// the advisor's own line + a result (after an action)
function resultView(g, o) {
  return textView(g, { id: o.id, title: o.title, head: () => ({ text: o.say, expr: o.expr }), lines: o.lines });
}
const REACT = {
  dokusai: { good: ['ふふ、お見事です。', 'いい手です。ボク、ゾクゾクしました。', 'これで、また一歩ですねぇ。'], bad: ['……想定の範囲内ですよぉ。（笑顔がひきつっている）', 'ふむ。次の手を考えましょう。'] },
  ikusa: { good: ['命令、実行ッ！', 'よし、いい動きだ！', 'ビシッと決まったな！'], bad: ['ぐっ……だが、戦はこれからだ！', '報告！思わしくない！次の手を考えろ！'] },
};
function reaction(id, ok) {
  const R_ = REACT[id][ok ? 'good' : 'bad'];
  return { say: R_[Math.floor(Math.random() * R_.length)], expr: exprOfMood(id, ok ? 'good' : 'warn') };
}
// ---- running an action through the real API, after a confirmation that states the odds and the price
async function runAction(g, ph, A, id) {
  if (!A) return null;
  if (A.kind === 'link') {
    if (A.screen && has(g, 'politicsScreen')) { try { await g.politicsScreen(A.screen === 'dashboard' ? 'dashboard' : A.screen); } catch (e) { console.error(e); } }
    return null;
  }
  if (A.kind === 'advisor') { await openAdvisor(g, A.id, 'home'); return null; }
  if (A.kind === 'page') { await openTopic(g, ph, id, A.page); return null; }
  if (A.why) {
    await ph.open(textView(g, { id, title: shortText(A.name || 'いまはできない', 10), lines: [{ t: A.name || '', h: true }, A.desc || '', { t: `いまはできない：${A.why}`, c: '#d6304a' }, ...(A.costs || []).filter(Boolean).map((x) => `・${x}`)] }));
    return null;
  }
  const brk = A.kind === 'step' ? (stepRows(g)[A.id] || {}).breakaway : null;
  const first = await ph.open(confirmView(g, { id, title: shortText(A.name, 10), lines: [A.desc || '', brk ? `（${brk} → 離党して新党を立てる。自動で進む）` : ''].filter(Boolean), odds: A.odds != null ? A.odds : null, oddsLabel: A.oddsLabel, costs: A.costs, danger: !!A.danger, note: A.note }));
  if (first !== 0) return null;
  if (A.twice) {
    const second = await ph.open(confirmView(g, { id, title: 'ほんとうに？', lines: [`「${A.name}」を実行する。取り消せない。`], danger: true, odds: A.odds != null ? A.odds : null, oddsLabel: A.oddsLabel }));
    if (second !== 0) return null;
  }
  let res = null;
  try {
    if (A.kind === 'step') res = g.regimeStep(A.id, A.opts || {});
    else if (A.kind === 'press') res = g.pressAction(A.id);
    else if (A.kind === 'war') res = g.warOrder(A.id, A.opts || {});
    else if (A.kind === 'dipl') res = g.diplomacy(A.id, A.target == null ? null : A.target, A.opts || {});
    else if (A.kind === 'demo') res = g.respondDemo(A.demo, A.how);
    else if (A.kind === 'reshuffle') res = g.reshuffle();
  } catch (e) { console.error(e); res = { ok: false, why: '実行中にエラーが出た' }; }
  res = res || { ok: false, why: '何も起きなかった' };
  const okRun = res.ok !== false && res.success !== false && res.passed !== false;
  logAct(g, id, `${A.name}：${okRun ? '成功' : '失敗'}`);
  const rc = reaction(id, okRun);
  const lines = [{ t: A.name, h: true }, res.text || res.why || (okRun ? '実行した。' : 'できなかった。')];
  if (res.ok === false && res.why) lines.push({ t: `できなかった理由：${res.why}`, c: '#d6304a' });
  await ph.open(resultView(g, { id, title: shortText(A.name, 10), say: rc.say, expr: rc.expr, lines }));
  if (has(g, 'regimeFlush')) { try { await g.regimeFlush(); } catch (e) { console.error(e); } }
  return res;
}
const actOf = (it) => (it && it.act ? { ...it.act, desc: it.act.desc || (it.detail || []).join('\n'), odds: it.odds != null ? it.odds : it.act.odds, oddsLabel: it.oddsText || it.oddsLabel || it.act.oddsLabel, costs: it.costs || it.act.costs, why: it.why || it.act.why || null, danger: !!(it.danger || it.act.danger), twice: it.act.twice, note: it.act.note } : null);

// ---------------------------------------------------------------- 独裁くん's pages
function planCards(g, P) {
  return P.items.map((it) => {
    const lines = [...it.detail];
    if (!isExpert(g) && it.explain) lines.push({ t: `（${it.explain}）`, c: '#9a8a70' });
    if ((it.costs || []).filter(Boolean).length) lines.push({ t: `代償：${it.costs.filter(Boolean).join('／')}`, c: '#a8651a' });
    if (it.why && it.state !== 'done') lines.push({ t: `いまは：${it.why}`, c: '#d6304a' });
    if (it.danger) lines.push({ t: '賭け・取り消しにくい手', c: '#d6304a' });
    return { id: it.id, title: it.title + (it.optional && !it.rec ? '（任意）' : ''), state: it.state, rec: it.rec, odds: it.odds, lines, act: actOf(it), say: it.say, item: it };
  });
}
function dokusaiNext(g, ph) {
  let P = dokusaiPlan(g);
  const v = cardsView(g, {
    id: 'dokusai', title: '次の一手',
    head: (view) => { const c0 = view.cards[view.idx]; return { text: c0 && c0.say ? c0.say : P.headline, expr: exprOfMood('dokusai', c0 && c0.rec ? 'good' : P.mood) }; },
    cards: () => { P = dokusaiPlan(g); return planCards(g, P); },
    async pick(ph2, card) {
      if (card.act) await runAction(g, ph2, card.act, 'dokusai');
      else await ph2.open(textView(g, { id: 'dokusai', title: shortText(card.title, 10), head: () => ({ text: card.say || P.headline, expr: exprOfMood('dokusai', 'calm') }), lines: [{ t: card.title, h: true }, ...card.item.detail, ...(card.item.explain ? [{ t: card.item.explain, c: PCx.dim }] : [])] }));
    },
  });
  return v;
}
function riskCards(g) {
  const R = dokusaiRisks(g);
  return R.items.map((x) => ({
    id: x.id, title: x.name, tag: x.label, tagColor: x.level >= 70 ? '#b01c34' : x.level >= 45 ? '#d6641a' : x.level >= 20 ? '#c8a21a' : '#2f9a4a', bar: x.level / 100, barColor: x.level >= 70 ? '#d6304a' : x.level >= 45 ? '#e08a2a' : x.level >= 20 ? '#d6b83a' : '#4fb86a',
    lines: [x.value, x.detail ? { t: x.detail, c: '#9a8a70' } : null, ...(x.factors.length ? [{ t: '中身', c: advColor('dokusai') }, ...x.factors.map((f) => ({ t: `・${f}`, i: 4 }))] : []), ...(x.reduce.length ? [{ t: '下げるには', c: advColor('dokusai') }, ...x.reduce.map((f) => ({ t: `・${f.text}${f.act ? '（Aで実行）' : ''}`, i: 4, c: f.act ? '#2a2a3a' : PCx.dim }))] : [])].filter(Boolean),
    act: (x.reduce.find((f) => f.act) || {}).act ? actWith(g, x.reduce.find((f) => f.act).act) : null, item: x,
  }));
}
// an act from a bare { kind, id, name } with its preview filled from the sources
function actWith(g, a) {
  const out = { ...a };
  if (a.kind === 'step') { const row = stepRows(g)[a.id] || {}; out.desc = row.desc; out.why = row.why; out.costs = stepCosts(g, a.id); if (a.id === 'self_coup') { out.odds = row.odds; out.oddsLabel = '自衛隊・官僚・国会が従う見込み'; out.danger = true; } else if (a.id === 'amend_emergency' || a.id === 'amend_article9') { out.odds = bothHouses(g, needsBreak(g)).p; out.oddsLabel = '両院で3分の2に届く見込み'; const r9 = refOdds(g, a.id === 'amend_article9' ? 'art9' : 'amend'); out.costs = [...(out.costs || []), `そのあとの国民投票：賛成の見込み ${r9.yes}%（過半数になる確率 ${pct(r9.p)}）`]; if (a.id === 'amend_article9') { const dp = safe(() => g.warPaths().dietOdds, null); if (dp != null) out.costs.push(`成立後の宣戦は国会の承認が要る（承認の見込み ${pct(dp)}）`); } } else if (['declare_emergency', 'suspend_elections', 'suspend_diet', 'ban_opposition', 'national_army'].includes(a.id)) { out.odds = 1; out.oddsLabel = '手続きは確実に通る'; if (a.id === 'national_army') out.danger = true; } else if (a.id === 'democratize') out.danger = true; }
  if (a.kind === 'press') { const row = pressRows(g)[a.id] || {}; out.desc = row.desc; out.why = row.why; out.costs = [PRESS_COST[a.id] || '']; if (a.id === 'pressure') { out.odds = 0.5; out.oddsLabel = '要請文書が発覚する確率（発覚＝支持率 −5・造反・デモ）'; } if (['censor', 'detain'].includes(a.id)) out.danger = true; }
  return out;
}
const PRESS_COST = {
  denpa: '報道の自由度 −6・支持率 −3・党内評価 −4・小デモ', exclude: '報道の自由度 −4・支持率 −2', pressure: '報道の自由度 −7・支持率 −2', disclosure: '報道の自由度 −3・支持率 −1',
  sns_bill: '報道の自由度 −10・支持率 −8・造反・大規模デモ。成立すれば違憲訴訟', censor: '報道の自由度 −20・不満 +6・懸念 +8。6〜14日後に違憲判断', detain: '記者5〜30人を拘束。報道の自由度 −15・不満 +9・懸念 +18', release: '報道の自由度 +12・不満 −5・懸念 −6',
};
function dokusaiRisk(g) {
  return cardsView(g, {
    id: 'dokusai', title: 'リスク診断',
    head: (view) => { const x = view.cards[view.idx]; const R = dokusaiRisks(g); return { text: x ? `${x.item.name}は「${x.item.label}」。${x.item.level >= 45 ? '早めに手を打ちましょう。' : '当面は大丈夫ですよぉ。'}` : '足もとの診断ですよぉ。', expr: exprOfMood('dokusai', R.overall >= 70 ? 'bad' : R.overall >= 45 ? 'warn' : 'good') }; },
    cards: () => riskCards(g),
    async pick(ph2, card) {
      if (card.act) await runAction(g, ph2, card.act, 'dokusai');
      else await ph2.open(textView(g, { id: 'dokusai', title: shortText(card.title, 10), head: () => ({ text: card.item.value, expr: exprOfMood('dokusai', 'warn') }), lines: [{ t: card.title, h: true }, card.item.value, card.item.detail, { t: '中身', h: true }, ...card.item.factors.map((f) => `・${f}`), { t: '下げるには', h: true }, ...card.item.reduce.map((f) => `・${f.text}`)].filter(Boolean) }));
    },
  });
}
function leverCards(areaId, g) {
  const A = dokusaiPower(g).find((x) => x.id === areaId);
  if (!A) return [];
  return A.levers.map((l) => ({ id: l.id, title: l.name, odds: l.odds, state: l.why ? 'wait' : 'can', lines: [l.desc, l.oddsLabel ? { t: l.oddsLabel, c: PCx.dim } : null, l.costs.filter(Boolean).length ? { t: `代償：${l.costs.filter(Boolean).join('／')}`, c: '#a8651a' } : null, l.why ? { t: `いまは：${l.why}`, c: '#d6304a' } : null].filter(Boolean), act: { ...l.act, desc: l.desc, odds: l.odds, oddsLabel: l.oddsLabel, costs: l.costs, why: l.why, danger: ['censor', 'detain', 'crackdown', 'curfew', 'national_army'].includes(l.id) || /crackdown|curfew/.test(l.id) } }));
}
function dokusaiPowerView(g) {
  return cardsView(g, {
    id: 'dokusai', title: '権力の維持',
    head: (view) => ({ text: view.cards[view.idx] ? 'どこを握りますか？報道、裁判所、軍、党、そして人々。' : '', expr: exprOfMood('dokusai', 'calm') }),
    cards: () => dokusaiPower(g).map((x) => ({ id: x.id, title: x.name, state: x.levers.length ? 'can' : 'info', lines: x.status, right: x.levers.length ? `${x.levers.length}手` : '', go: true })),
    async pick(ph2, card) {
      const sub = cardsView(g, { id: 'dokusai', title: shortText(card.title, 10), head: () => ({ text: `${card.title}の状況と、打てる手です。`, expr: exprOfMood('dokusai', 'calm') }), cards: () => [{ id: 'status', title: `${card.title}の状況`, state: 'info', lines: card.lines.map((l) => (typeof l === 'string' ? l : l.t)) }, ...leverCards(card.id, g)], async pick(ph3, c3) { if (c3.act) await runAction(g, ph3, c3.act, 'dokusai'); } });
      await ph2.open(sub);
    },
  });
}
function dokusaiStatus(g) {
  const r = regimeOf(g);
  const p = polOf(g);
  const S = seatsOf(p, 'shugi'), Sa = seatsOf(p, 'sangi');
  const pf = safe(() => g.pressFreedom(), null);
  const L = [];
  const nm = nameOf(g);
  L.push({ t: 'いまの体制', h: true });
  L.push(`${r.name}（${r.label || '—'}）${r.labelWhy ? `：${r.labelWhy}` : ''}`);
  L.push(`支持率 ${Math.round(approvalOf(g))}%（体制の下押し ${signed(r.approvalMod, 1)}）・民衆の不満 ${Math.round(r.unrest)}・国際社会の懸念 ${Math.round(r.intl)}（制裁 段階${r.sanctions}）`);
  if (pf) L.push(`報道の自由度 ${pf.value}（${pf.label}）${pf.detained ? `・拘束中の記者 ${pf.detained}人` : ''}`);
  L.push({ t: '議席（3分の2 ＝ 憲法改正の発議）', h: true });
  if (S) L.push(`衆議院：自党 ${S.own}／与党 ${S.ruling}／総議員 ${S.total}（過半数 ${S.majority}・3分の2 ${S.need2}）`);
  if (Sa) L.push(`参議院：自党 ${Sa.own}／与党 ${Sa.ruling}／総議員 ${Sa.total}（過半数 ${Sa.majority}・3分の2 ${Sa.need2}）`);
  if (r.id === 'democracy' && isPMOf(g)) { const AB = bothHouses(g, needsBreak(g)); L.push(`発議の見込み：衆 ${AB.s.yes}/${AB.s.need}・参 ${AB.a.yes}/${AB.a.need}（両院で届く確率 ${pct(AB.p)}）`); const ro = refOdds(g); L.push(`国民投票の見込み：賛成 ${ro.yes}%（過半数の確率 ${pct(ro.p)}）`); }
  if (r.amend && r.amend.stage === 'referendum') L.push(`国民投票は${dateText(g, r.amend.voteDay)}（あと${daysLeft(g, r.amend.voteDay)}日）`);
  if (r.steps.clause) L.push('強権型の緊急事態条項は、憲法にすでに入っている');
  const steps = ['emergency', 'elections', 'diet', 'opposition', 'army', 'censor'].filter((k) => r.steps[k]).map((k) => ({ emergency: '緊急事態', elections: '選挙の停止', diet: '国会の停止', opposition: '野党の禁止', army: '国軍化', censor: '検閲' }[k]));
  L.push(`とった手：${steps.length ? steps.join('・') : 'まだない'}`);
  const w = warOf(g);
  if (w) L.push({ t: '戦争', h: true }, `${w.enemyName}との戦争：${w.frontText}・厭戦 ${Math.round(num(w.weariness))}（くわしくはイクサくんへ）`);
  const a = advisorState(g);
  const mine = (a ? a.log : []).filter((l) => l.id === 'dokusai').slice(-6).reverse();
  if (mine.length) { L.push({ t: '独裁くんを通して実行したこと', h: true }); for (const l of mine) L.push(`${l.day}日目 ${l.text}`); }
  L.push({ t: `（${nm}さまの数字は、毎日の朝に更新されます）`, c: PCx.dim });
  return textView(g, { id: 'dokusai', title: 'いまの状況', head: () => ({ text: '数字は、嘘をつきませんからねぇ。', expr: exprOfMood('dokusai', 'calm') }), lines: L });
}

// ---------------------------------------------------------------- イクサくん's pages
function pickTarget(g, ph) {
  const jp = milJP(g);
  return ph.open(cardsView(g, {
    id: 'ikusa', title: '相手をえらぶ',
    head: () => ({ text: '相手によって、見込みも代償もまるで違うぞ！', expr: exprOfMood('ikusa', 'order') }),
    cards: () => ikusaTargets(g).sort((a, b) => a.rel - b.rel).map((t) => ({
      id: t.id, title: t.name, tag: t.real ? '実在' : 'ヴェルミナ海', tagColor: t.real ? '#4a78d8' : '#8a5ac8',
      lines: [`関係 ${t.rel}・軍事力 ${t.mil}（日本 ${jp}）`, t.ally ? '同盟国（戦う相手には向かない）' : t.ties === false ? '国交がない' : null, `日本の側が ${(t.mil ? jp / t.mil : 9).toFixed(2)}倍`].filter(Boolean),
      go: true,
    })),
    async pick(ph2, card) { const a = advisorState(g); a.target = card.id; ph2.back(card.id); },
  }));
}
function ikusaBeforeView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '開戦の前に',
    head: (view) => { const w = warOf(g); if (w) return { text: 'もう戦争中だぞ！戦況と次の命令を見ろ！', expr: exprOfMood('ikusa', 'order') }; const b = ikusaBubble(g); return { text: b.text.split('\n')[0], expr: b.expr }; },
    cards: () => {
      const w = warOf(g);
      if (w) return [{ id: 'now', title: 'いまは戦争中', state: 'info', lines: ['開戦前のチェックは済んでいる。', '戦況・次の命令・講和の機会を見ろ。'], go: true, page: 'front' }];
      const t = targetOf(g);
      if (!t) return [];
      const C = ikusaChecklist(g, t.id);
      const out = [{ id: 'target', title: `相手：${t.name}`, tag: 'えらぶ', tagColor: '#4a78d8', lines: [`関係 ${t.rel}・軍事力 ${t.mil}（日本 ${milJP(g)}）・${t.real ? '実在の国' : 'ヴェルミナ海の国'}`, { t: C.verdict, c: C.ready ? '#2f9a4a' : '#d6304a' }, 'Aで相手を変える'], go: true, kind: 'target' }];
      for (const x of C.items) {
        const lines = [...x.detail];
        for (const m of x.missing) lines.push({ t: `足りない：${m}`, c: '#d6304a' });
        for (const h of x.how) lines.push({ t: `どうすれば：${h}`, c: '#4a5a2a' });
        if (x.costs.length) { lines.push({ t: '開戦の代償（目安）', c: advColor('ikusa') }); for (const k of x.costs) lines.push({ t: `・${k}`, i: 4, c: '#a8651a' }); }
        out.push({ id: x.id, title: x.label, state: x.state, lines, act: x.act ? (x.act.kind === 'page' ? { ...x.act } : actWith(g, x.act)) : null, go: !!x.act });
      }
      return out;
    },
    async pick(ph2, card) {
      if (card.kind === 'target') { await pickTarget(g, ph2); return; }
      if (card.page) { await openTopic(g, ph2, 'ikusa', card.page); return; }
      if (card.act) { if (card.act.kind === 'page') await openTopic(g, ph2, 'ikusa', card.act.page); else await runAction(g, ph2, card.act, 'ikusa'); }
    },
  });
}
function ikusaFrontView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '戦況',
    head: () => { const b = ikusaBubble(g); return { text: warOf(g) ? b.text.split('\n')[0] : 'いまは戦争をしていない。開戦前のチェックを見ろ！', expr: b.expr }; },
    cards: () => {
      const F = ikusaFront(g);
      if (!F) return [{ id: 'none', title: 'いまは戦争をしていない', state: 'info', lines: ['開戦するときは、「開戦の前に」で確認してからだ。'], go: true, page: 'before' }];
      const w = F.w;
      const out = [{ id: 'sum', title: `${w.enemyName}との戦争`, state: 'info', bar2: num(w.front), lines: F.lines.slice(1), go: true, page: 'orders' }];
      for (const f of w.fronts || []) out.push({ id: f.id, title: f.name, bar2: f.control, odds: f.odds / 100, lines: [`${frontWord(f.control)}（${f.control >= 0 ? '+' : ''}${f.control}）・兵力 約${n0(f.own * 1000)}人`, `作戦の見込み ${f.odds}%（日本の戦力 ${f.power.own}／相手 ${f.power.foe}）${f.today ? '・今日は作戦ずみ' : ''}`], go: true, page: 'orders' });
      out.push({ id: 'cas', title: '死者・けが人', state: 'info', lines: F.cas, go: true, page: 'orders' });
      const al = w.allies || [], fo = w.foes || [];
      out.push({ id: 'allies', title: '味方と相手側', state: 'info', lines: [al.length ? `味方：${al.map((x) => x.name).join('・')}` : '味方：いない', fo.length ? `相手側：${fo.map((x) => x.name).join('・')}` : '相手側に付いた国：いない', ...Object.values(w.decisions || {}).slice(0, 3)] });
      const known = w.known || [];
      if (known.length) out.push({ id: 'known', title: '知っている人', state: 'info', lines: known.map((k) => `${k.rel}の${k.name}（${k.unit}）：${{ front: '前線', called: '召集された', wounded: '負傷', kia: '戦死', exempt: '免除', back: '帰還', home: '自宅' }[k.status] || k.status}`) });
      out.push({ id: 'talks', title: '停戦交渉', state: 'info', odds: num(w.talksOdds) / 100, lines: [w.talks ? `交渉中（あと${Math.max(0, num(w.talks.until) - today(g))}日ほど）` : `停戦の見込み ${w.talksOdds}%`], go: true, page: 'peace' });
      return out;
    },
    async pick(ph2, card) { if (card.page) await openTopic(g, ph2, 'ikusa', card.page); },
  });
}
function ikusaOrdersView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '次の命令',
    head: (view) => { const c0 = view.cards[view.idx]; return { text: c0 ? (c0.reason || (c0.rec ? 'これだ！' : 'よく考えて決めろ！')) : '命令なし！', expr: exprOfMood('ikusa', c0 && c0.rec ? 'order' : 'calm') }; },
    cards: () => ikusaOrders(g).map((x) => ({
      id: x.id, title: x.name, rec: x.rec, odds: x.odds, state: x.why ? 'wait' : 'can', reason: x.reason,
      lines: [x.desc, x.oddsLabel && x.odds != null ? { t: x.oddsLabel, c: PCx.dim } : null, x.costs.length ? { t: `代償：${x.costs.join('／')}`, c: '#a8651a' } : null, x.reason ? { t: `助言：${x.reason}`, c: '#4a5a2a' } : null, x.why ? { t: `いまは：${x.why}`, c: '#d6304a' } : null].filter(Boolean),
      act: x.act ? { ...x.act, desc: x.desc, odds: x.odds, oddsLabel: x.oddsLabel, costs: x.costs, why: x.why } : null,
    })),
    async pick(ph2, card) { if (card.act) await runAction(g, ph2, card.act, 'ikusa'); },
  });
}
// who could join / who to ask
function diploActs(g, cid, cname) {
  const acts = safe(() => (has(g, 'diplomacyActions') ? g.diplomacyActions(cid) : []), []) || [];
  const want = ['summit', 'defense_pact', 'alliance', 'visit', 'statement', 'aid', 'fta'];
  return want.map((k) => acts.find((a) => a.id === k)).filter(Boolean).map((a) => {
    const opts = a.id === 'summit' || a.id === 'visit' ? { topic: 'security' } : a.id === 'statement' ? { kind: 'security' } : a.id === 'aid' ? { level: 1 } : {};
    return { id: a.id, title: `${a.name}${a.id === 'summit' || a.id === 'visit' ? '（安全保障）' : ''}`, odds: a.odds, state: a.why ? 'wait' : 'can', lines: [...(a.lines || []).slice(0, 4), a.why ? { t: `いまは：${a.why}`, c: '#d6304a' } : null].filter(Boolean),
      act: { kind: 'dipl', id: a.id, target: cid, opts, name: `${cname}と${a.name}`, desc: (a.lines || []).slice(0, 2).join('\n'), odds: a.odds, oddsLabel: '成功の見込み', costs: (a.lines || []).slice(1), why: a.why, danger: false } };
  });
}
function ikusaDiploView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '同盟と外交',
    head: () => { const t = targetOf(g); return { text: `${t ? t.short : '相手'}と戦うなら、味方は多いほどいい！だが日本から攻める戦争には、友人も腰が引けるぞ！`, expr: exprOfMood('ikusa', 'order') }; },
    cards: () => {
      const t = targetOf(g);
      const w = worldOf(g);
      if (!w || !t) return [];
      const AO = allyOdds(g, t.id);
      const out = [];
      const up = (safe(() => g.diplomacyActions(null), []) || []).find((a) => a.id === 'ally_up');
      if (up) out.push({ id: 'ally_up', title: '同盟を強化する（日米安保）', odds: up.odds, state: up.why ? 'wait' : 'can', lines: [...(up.lines || []).slice(0, 3), up.why ? { t: `いまは：${up.why}`, c: '#d6304a' } : null].filter(Boolean), act: { kind: 'dipl', id: 'ally_up', target: null, name: '同盟の強化', desc: (up.lines || []).join('\n'), odds: up.odds, oddsLabel: '成功の見込み', costs: up.lines, why: up.why } });
      const cm = Object.fromEntries((w.countries || []).map((c) => [c.id, c]));
      const used = new Set();
      for (const x of AO.ours) { used.add(x.id); const c = cm[x.id]; out.push({ id: x.id, title: x.name, tag: '日本の同盟・友好国', tagColor: '#2f9a4a', odds: x.p, lines: [`参戦の見込み ${pct(x.p)}${x.why ? `（${x.why}）` : ''}`, `関係 ${c ? c.relation : '—'}・軍事力 ${c ? c.mil : '—'}・${x.alliance}`], go: true, cid: x.id, cname: x.name }); }
      const asks = (w.countries || []).filter((c) => !used.has(c.id) && c.id !== t.id && c.relation >= 10 && !c.war && !AO.theirs.some((y) => y.id === c.id)).sort((a, b) => b.mil - a.mil).slice(0, 6);
      for (const c of asks) out.push({ id: c.id, title: c.short, tag: '頼める国', tagColor: '#4a78d8', lines: [`関係 ${c.relation}（${c.relLabel}）・軍事力 ${c.mil}`, 'まず首脳会談・防衛協力で関係を深める'], go: true, cid: c.id, cname: c.short });
      for (const x of AO.theirs.filter((y) => y.p > 0.04).slice(0, 4)) { const c = cm[x.id]; out.push({ id: `f_${x.id}`, title: x.name, tag: '相手側に付くかも', tagColor: '#d6304a', odds: x.p, lines: [`相手側で参戦する見込み ${pct(x.p)}（${x.alliance}）`, `関係 ${c ? c.relation : '—'}・軍事力 ${c ? c.mil : '—'}`, '関係を保てば、参戦を思いとどまることがある'], go: true, cid: x.id, cname: x.name }); }
      return out;
    },
    async pick(ph2, card) {
      if (card.act) { await runAction(g, ph2, card.act, 'ikusa'); return; }
      if (!card.cid) return;
      await ph2.open(cardsView(g, { id: 'ikusa', title: shortText(card.cname, 10), head: () => ({ text: `${card.cname}への外交。見込みと代償を見て決めろ！`, expr: exprOfMood('ikusa', 'calm') }), cards: () => diploActs(g, card.cid, card.cname), async pick(ph3, c3) { if (c3.act) await runAction(g, ph3, c3.act, 'ikusa'); } }));
    },
  });
}
function ikusaPeaceView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '講和の機会',
    head: () => { const P = ikusaPeace(g); return { text: P.level === 'good' ? '好機だ！決めるなら今だ！' : P.level === 'low' ? 'まだ早い！戦況を整えろ！' : P.w ? '見込みは五分五分だ！' : '講和は戦のあとの仕事だ。', expr: exprOfMood('ikusa', P.level === 'good' ? 'good' : P.level === 'low' ? 'warn' : 'order') }; },
    cards: () => {
      const P = ikusaPeace(g);
      const out = [];
      out.push({ id: 'odds', title: P.w ? `停戦がまとまる見込み${P.verdict ? `（${P.verdict}）` : ''}` : '講和', state: 'info', odds: P.odds, bar2: P.w ? num(P.w.front) : null, lines: P.lines });
      const orders = P.w ? ikusaOrders(g).filter((x) => x.id === 'negotiate') : [];
      for (const x of orders) out.push({ id: x.id, title: x.name, rec: x.rec, odds: x.odds, state: x.why ? 'wait' : 'can', lines: [x.desc, ...x.costs.map((k) => ({ t: `代償：${k}`, c: '#a8651a' })), x.reason ? { t: `助言：${x.reason}`, c: '#4a5a2a' } : null, x.why ? { t: `いまは：${x.why}`, c: '#d6304a' } : null].filter(Boolean), act: { ...x.act, desc: x.desc, odds: x.odds, oddsLabel: x.oddsLabel, costs: x.costs, why: x.why } });
      if (!P.w && P.peace) {
        const pc = (safe(() => g.diplomacyActions(null), []) || []).find((a) => a.id === 'peace_conf');
        if (pc) for (const o of pc.options || [{ id: 'status', label: '国境は戦争の前のまま' }]) out.push({ id: `peace_${o.id}`, title: `講和条約：${o.label}`, state: pc.why ? 'wait' : 'can', odds: pc.odds, lines: [o.sub || '', ...(pc.lines || []).slice(0, 3), pc.why ? { t: `いまは：${pc.why}`, c: '#d6304a' } : null].filter(Boolean), act: { kind: 'dipl', id: 'peace_conf', target: null, opts: { terms: o.id }, name: `講和条約（${o.label}）`, desc: (pc.lines || []).join('\n'), odds: pc.odds, oddsLabel: '成功の見込み', costs: pc.lines, why: pc.why } });
      }
      return out;
    },
    async pick(ph2, card) { if (card.act) await runAction(g, ph2, card.act, 'ikusa'); },
  });
}
function ikusaSupplyView(g) {
  return cardsView(g, {
    id: 'ikusa', title: '兵站',
    head: () => { const S = ikusaSupply(g); return { text: S.sup >= 0.95 ? '補給は順調だ！' : S.sup >= 0.8 ? '補給にヒビが入ってるぞ！' : '補給が細いぞ！戦力が削られてる！', expr: exprOfMood('ikusa', S.sup >= 0.95 ? 'good' : S.sup >= 0.8 ? 'order' : 'warn') }; },
    cards: () => {
      const S = ikusaSupply(g);
      return [{ id: 'sup', title: '補給の効き', state: 'info', right: `${Math.round(S.sup * 100)}%`, rightColor: oddsColor(S.sup / 1.15), bar: S.sup / 1.15, barColor: oddsColor(S.sup), lines: S.lines.slice(1) }, { id: 'fix', title: '補給を保つには', state: 'info', lines: S.fix.map((f) => `・${f}`) }];
    },
    async pick() {},
  });
}
// ---------------------------------------------------------------- settings, advice, the introduction
const TIP_KEYS = (id) => Object.keys(TIPS).filter((k) => TIPS[k].id === id);
function settingsView(g, id) {
  const a = advisorState(g);
  const A = ADVISORS[id];
  return cardsView(g, {
    id, title: 'せってい',
    head: () => ({ text: id === 'dokusai' ? 'ボクの口数は、お好みで調整を。' : '声の大きさは、好きに決めろ！', expr: exprOfMood(id, 'calm') }),
    cards: () => [
      { id: 'mute', title: `${A.short}のヒントの吹き出し`, right: a.muted[id] ? 'OFF' : 'ON', rightColor: a.muted[id] ? PCx.dim : PCx.good, lines: ['場面に合わせて、短い吹き出しで助言する。'] },
      { id: 'all', title: '独裁くん・イクサくん全員のヒント', right: a.tipsOff ? 'OFF' : 'ON', rightColor: a.tipsOff ? PCx.dim : PCx.good, lines: ['OFFにすると、ふたりとも吹き出しを出さない。'] },
      { id: 'help', title: 'ヘルプのレベル', right: ({ beginner: 'はじめて', normal: 'ふつう', expert: 'くわしい' })[lvlOf(g)] || 'ふつう', lines: ['ヒントの量と、説明の長さ。政治ナビの設定と同じ。'], go: has(g, 'setHelpLevel') },
      { id: 'reset', title: 'ヒントをもう一度見る', lines: ['一度見た吹き出しを、もう一度出せるようにする。'], go: true },
      { id: 'intro', title: '自己紹介をもう一度', lines: [], go: true },
    ],
    async pick(ph2, card) {
      if (card.id === 'mute') a.muted[id] = !a.muted[id];
      else if (card.id === 'all') a.tipsOff = !a.tipsOff;
      else if (card.id === 'help' && has(g, 'setHelpLevel')) { const L = ['beginner', 'normal', 'expert']; g.setHelpLevel(L[(L.indexOf(lvlOf(g)) + 1) % 3]); }
      else if (card.id === 'reset') { for (const k of TIP_KEYS(id)) delete a.tips[k]; delete a.flags.firstPM; delete a.flags.beforeTip; delete a.flags.refTip; ph2.toast('ヒントを、もう一度見られるようにした', A.color); }
      else if (card.id === 'intro') await ph2.open(talkView(g, id));
    },
  });
}
function adviceView(g, id) {
  const lines = advisorAdviceLines(g, id);
  const b = bubbleOf(g, id);
  return textView(g, { id, title: 'いまの助言', head: () => ({ text: b.text.split('\n')[0], expr: b.expr }), lines: () => [{ t: 'いまの助言', h: true }, ...(advisorAdviceLines(g, id).length ? advisorAdviceLines(g, id) : ['とくにない。']), ...(isExpert(g) ? [] : [{ t: '', gap: false }, { t: '画面の見かた', h: true }, id === 'dokusai' ? '「次の一手」で順番と成功の見込み、「リスク診断」で危険の中身、「権力の維持」で報道・裁判所・軍・党・人々への手を見る。実行の前には、いつも見込みと代償を確認できる。' : '「開戦の前に」で足りないものを確認し、「次の命令」で見込みと代償を見てから実行する。戦況・外交・講和・兵站も、そこから行ける。'])] });
}
function introPages(g, id) {
  const nm = nameOf(g);
  const dev = deviceWord(g);
  const era = eraKey(g);
  const where = id === 'dokusai'
    ? (dev === '手帳' ? (era === 'heisei_early' ? '手帳のうしろに「独裁くん」のしおりをはさんでおきました。ポケベルが鳴ったら、開いてくださいねぇ。' : '手帳のうしろに「独裁くん」のしおりをはさんでおきました。いつでもどうぞ。') : dev === 'ケータイ' ? 'ケータイに「独裁くん」のサイトをブックマークしておきました。いつでもどうぞ。' : 'スマホに「独裁くん」のアプリを入れておきました。いつでもどうぞ。')
    : (dev === '手帳' ? (era === 'heisei_early' ? '手帳に「イクサくん」の作戦メモをはさんだ！ポケベルが鳴ったら開け！' : '手帳に「イクサくん」の作戦メモをはさんだ！いつでも開け！') : dev === 'ケータイ' ? 'ケータイに「イクサくん」のサイトを登録した！いつでも開け！' : 'スマホに「イクサくん」のアプリを入れた！いつでも開け！');
  if (id === 'dokusai') return [
    `はじめまして、${nm}さま。ボクは独裁くん。権力への道のりと、その守り方をお手伝いする、ちいさな王さまです。`,
    '次の一手、成功の見込み、代償。ぜんぶ数字でお見せします。ほめるのは、ボクの仕事。決めるのは、あなたさまですよぉ。',
    `${where}まずは総理の椅子から。それまで、ボクの出番はお預けです。`,
  ];
  return [
    `気をつけーっ！オレはイクサくん、${nm}の戦のお目付け役、ちびっこ軍曹だ！`,
    '開戦の前のチェック、戦況、次の命令、同盟、講和、兵站。ぜんぶ数字でビシッと報告する！死者の数もだ！',
    `命令を出すのは${nm}だ。見込みと代償は隠さず言う。${where}`,
  ];
}
function talkView(g, id) {
  const A = ADVISORS[id];
  const pages = introPages(g, id);
  const exprs = id === 'dokusai' ? ['calm', 'scheme', 'calm'] : ['shout', 'brisk', 'wink'];
  return {
    title: A.name, color: A.color, page: 0, cancel: true, bg: '#f4f1e8',
    hint: 'A:つぎへ　B:とばす',
    update(ph, inp) {
      if (inp.pressed('a')) { sfx('cursor'); if (this.page < pages.length - 1) this.page++; else ph.back(true); return; }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(true); }
    },
    tap() { return true; },
    draw(c, ph, a) {
      const dark = id === 'dokusai' ? '#3a0f1f' : '#2f3a16';
      RF(c, a.x, a.y, a.w, 108, id === 'dokusai' ? '#7a2646' : '#a8b878');
      for (let i = -108; i < a.w; i += 14) { c.fillStyle = id === 'dokusai' ? 'rgba(244,196,55,0.16)' : 'rgba(70,86,30,0.22)'; for (let j = 0; j < 108; j++) c.fillRect(a.x + i + j, a.y + j, 3, 1); }
      drawAdvisorBust(c, id, a.x + (a.w - 96) / 2, a.y + 8, 3, { card: false, expr: exprs[this.page], blink: Math.floor(ph.t / 4) % 60 < 2 });
      RF(c, a.x, a.y + 106, a.w, 2, dark);
      T(c, A.name, a.x + 10, a.y + 112, 14, A.color);
      T(c, fitT(c, A.title, a.w - 90, 12), a.x + a.w - 10, a.y + 114, 12, PCx.dim, 'right');
      const bx = a.x + 8, by = a.y + 132, bw = a.w - 16, bh = a.h - 138;
      boxFrame(c, bx, by, bw, bh, '#ffffff', A.color);
      const ls = jwrapA(c, pages[this.page] || '', bw - 16, 12);
      ls.slice(0, 7).forEach((l, i) => T(c, l, bx + 8, by + 6 + i * LH, 12, PCx.text));
      T(c, `${this.page + 1}/${pages.length}`, bx + bw - 8, by + bh - 16, 12, PCx.dim, 'right');
      if (Math.floor(ph.t / 20) % 2 === 0) T(c, '▼', bx + bw - 40, by + bh - 16, 12, A.color);
    },
  };
}
// ---------------------------------------------------------------- the home page of each app (portrait, a line, the menu)
const HOME_ITEMS = {
  dokusai: [['advice', '今の助言', '#c9a227'], ['next', '次の一手', '#d6a21a'], ['risk', 'リスク診断', '#d6304a'], ['power', '権力の維持', '#8a5ac8'], ['status', '今の状況', '#4a78d8'], ['settings', 'せってい', '#7a7a8a']],
  ikusa: [['advice', '今の助言', '#c9a227'], ['before', '開戦の前に', '#d6a21a'], ['front', '戦況', '#d6304a'], ['orders', '次の命令', '#e07a1f'], ['diplo', '同盟と外交', '#3a8ad8'], ['peace', '講和の機会', '#2f9a4a'], ['supply', '兵站', '#8a6a3a'], ['settings', 'せってい', '#7a7a8a']],
};
function homeSub(g, id, item) {
  try {
    if (id === 'dokusai') {
      if (item === 'next') { const P = dokusaiPlan(g); const rec = P.items.find((x) => x.rec); return rec && rec.odds != null ? [pct(rec.odds), oddsColor(rec.odds)] : P.stage === 'pre' ? ['まず総理に', PCx.dim] : ['', '']; }
      if (item === 'risk') { const R = dokusaiRisks(g); return [R.label, R.overall >= 70 ? PCx.bad : R.overall >= 45 ? '#d6641a' : PCx.dim]; }
      return ['', ''];
    }
    const w = warOf(g);
    if (item === 'before') { if (w) return ['戦争中', PCx.dim]; const t = targetOf(g); const C = t ? ikusaChecklist(g, t.id) : null; return C ? [C.ng ? `不足${C.ng}` : 'OK', C.ng ? PCx.bad : PCx.good] : ['', '']; }
    if (item === 'front') return w ? [w.frontText, num(w.front) <= -30 ? PCx.bad : PCx.dim] : ['', ''];
    if (item === 'orders') { if (!w) return ['', '']; const rec = ikusaOrders(g).find((x) => x.rec); return rec ? [shortText(rec.name.replace(/（.*$/, ''), 6), '#d6641a'] : ['', '']; }
    if (item === 'peace') return w ? [`${w.talksOdds}%`, oddsColor(w.talksOdds / 100)] : ['', ''];
    if (item === 'supply') return [`${Math.round(SUPPLY(g, w) * 100)}%`, oddsColor(SUPPLY(g, w) / 1.15)];
  } catch (e) { /* the menu must always draw */ }
  return ['', ''];
}
function skinBg(c, a, era, id) {
  if (era === 'showa' || era === 'heisei_early') { RF(c, a.x, a.y, a.w, a.h, '#f3e8cc'); for (let y = a.y + 14; y < a.y + a.h; y += 16) RF(c, a.x, y, a.w, 1, '#e2d3ac'); RF(c, a.x + 20, a.y, 1, a.h, '#e8b0a0'); } else if (era === 'heisei') { RF(c, a.x, a.y, a.w, a.h, '#dfe8cc'); for (let y = a.y; y < a.y + a.h; y += 3) RF(c, a.x, y, a.w, 1, 'rgba(120,150,100,0.12)'); } else RF(c, a.x, a.y, a.w, a.h, '#f4f1e8');
}
function homeView(g, id) {
  const A = ADVISORS[id];
  const items = HOME_ITEMS[id];
  const rowH = items.length > 6 ? 19 : 22;
  const v = {
    title: A.name, color: A.color, idx: 0, cancel: undefined, noFooter: false, hint: 'A:ひらく　B:とじる', bg: '#f4f1e8', age: 0, rects: [], subs: {}, b: null,
    refresh() { this.b = bubbleOf(g, id); this.subs = {}; for (const [k] of items) this.subs[k] = homeSub(g, id, k); this.bubbleLines = null; },
    enter() { this.refresh(); },
    update(ph, inp) {
      this.age++;
      if (this.age % 90 === 0 && ph.view === this) this.refresh();
      const n = items.length;
      if (inp.repeat('up')) { this.idx = (this.idx + n - 1) % n; sfx('cursor'); }
      if (inp.repeat('down')) { this.idx = (this.idx + 1) % n; sfx('cursor'); }
      if (inp.pressed('a')) { sfx('ok'); const k = items[this.idx][0]; ph.run(this, async () => { await openTopic(g, ph, id, k); this.refresh(); }); return; }
      if (inp.pressed('b')) { sfx('cancel'); ph.back(undefined); }
    },
    tap(ph, x, y) {
      for (const r of this.rects) if (y >= r.y && y < r.y + r.h) { this.idx = r.i; return true; }
      if (this.top0 != null && y < this.top0 + 72) { this.idx = 0; return true; }
      return false;
    },
    draw(c, ph, a) {
      const era = eraKey(g);
      skinBg(c, a, era, id);
      this.top0 = a.y;
      if (!this.b) this.refresh();
      const blink = Math.floor(this.age / 4) % 60 < 2;
      drawAdvisorBust(c, id, a.x + 8, a.y + 6, 2, { expr: this.b.expr, blink });
      const bx = a.x + 80, bw = a.w - 86, by = a.y + 6, bh = 66;
      boxFrame(c, bx, by, bw, bh, '#ffffff', A.color);
      for (let i = 0; i < 5; i++) RF(c, bx - 5 + i, by + 16 + i, 1, 10 - i * 2, i === 0 ? A.color : '#ffffff');
      if (!this.bubbleLines) {
        const sents = String(this.b.text || '').split('\n').filter(Boolean);
        let pick = [];
        for (let k = sents.length; k >= 1; k--) { const ls = jwrapA(c, sents.slice(0, k).join(''), bw - 12, 12); if (ls.length <= 4) { pick = ls; break; } }
        if (!pick.length) pick = jwrapA(c, sents[0] || '', bw - 12, 12).slice(0, 4);
        this.bubbleLines = pick;
      }
      this.bubbleLines.slice(0, 4).forEach((l, i) => T(c, l, bx + 6, by + 4 + i * 14, 12, PCx.text));
      const y0 = a.y + 78;
      this.rects = [];
      items.forEach(([k, label, col], i) => {
        const y = y0 + i * rowH;
        const sel = i === this.idx;
        if (sel) { RF(c, a.x, y, a.w, rowH, PCx.sel); RF(c, a.x, y, 3, rowH, PCx.selEdge); }
        RF(c, a.x + 9, y + Math.floor((rowH - 10) / 2), 10, 10, col); RF(c, a.x + 11, y + Math.floor((rowH - 10) / 2) + 2, 6, 1, 'rgba(255,255,255,0.7)');
        const [sub, subc] = this.subs[k] || ['', ''];
        const sw = sub ? Math.round(measure(c, sub, 12)) + 8 : 0;
        T(c, fitT(c, label, a.w - 38 - sw, 14), a.x + 28, y + Math.floor((rowH - 14) / 2) - 1, 14, sel ? '#1a1a28' : PCx.text);
        if (sub) T(c, sub, a.x + a.w - 8, y + Math.floor((rowH - 12) / 2), 12, subc || PCx.dim, 'right');
        RF(c, a.x + 6, y + rowH - 1, a.w - 12, 1, PCx.line);
        this.rects.push({ y, h: rowH, i });
      });
    },
  };
  return v;
}
async function openTopic(g, ph, id, topic) {
  try {
    if (topic === 'advice') return await ph.open(adviceView(g, id));
    if (topic === 'settings') return await ph.open(settingsView(g, id));
    if (topic === 'intro') return await ph.open(talkView(g, id));
    if (id === 'dokusai') {
      if (topic === 'next') return await ph.open(dokusaiNext(g, ph));
      if (topic === 'risk') return await ph.open(dokusaiRisk(g));
      if (topic === 'power') return await ph.open(dokusaiPowerView(g));
      if (topic === 'status') return await ph.open(dokusaiStatus(g));
    } else {
      if (topic === 'before') return await ph.open(ikusaBeforeView(g));
      if (topic === 'front') return await ph.open(ikusaFrontView(g));
      if (topic === 'orders') return await ph.open(ikusaOrdersView(g));
      if (topic === 'diplo') return await ph.open(ikusaDiploView(g));
      if (topic === 'peace') return await ph.open(ikusaPeaceView(g));
      if (topic === 'supply') return await ph.open(ikusaSupplyView(g));
    }
  } catch (e) { console.error(e); }
  return null;
}
export async function openAdvisor(g, id, topic = 'home') {
  if (!g || !g.state || !ADVISORS[id]) return null;
  if (g.auto && !g.auto.advisors) return null;
  if (typeof PH.withPhone !== 'function') return null;
  const a = advisorState(g);
  a.stats[id].opened++;
  return PH.withPhone(g, async (ph) => {
    if (topic === 'intro') { a.met[id] = today(g); await ph.open(talkView(g, id)); return null; }
    if (!a.met[id]) { a.met[id] = today(g); await ph.open(talkView(g, id)); if (ph.dismissed) return null; }
    const home = homeView(g, id);
    const done = ph.open(home);
    if (topic && topic !== 'home') openTopic(g, ph, id, topic).then(() => { if (typeof home.refresh === 'function') home.refresh(); });
    return done;
  });
}

// ================================================================ the phone apps (era-framed: 手帳のしおり / ポケベル・手帳 / ケータイ / スマホ)
function appIcon(c, x, y, g, id) {
  const A = ADVISORS[id];
  const era = eraKey(g);
  if (PH.appTile) PH.appTile(c, x, y, A.color); else RF(c, x, y, 32, 32, A.color);
  if (era === 'showa' || era === 'heisei_early') {
    // a paper tag on the 手帳: cream card with a stitched border
    RF(c, x + 4, y + 4, 24, 24, '#f6ecd2');
    for (let i = 5; i < 27; i += 4) { RF(c, x + i, y + 4, 2, 1, '#b8905a'); RF(c, x + i, y + 27, 2, 1, '#b8905a'); RF(c, x + 4, y + i, 1, 2, '#b8905a'); RF(c, x + 27, y + i, 1, 2, '#b8905a'); }
  } else if (era === 'heisei') {
    RF(c, x + 4, y + 4, 24, 24, '#c8d8b0'); for (let j = y + 4; j < y + 28; j += 2) RF(c, x + 4, j, 24, 1, 'rgba(90,120,70,0.25)');
  } else { RF(c, x + 4, y + 4, 24, 24, id === 'dokusai' ? '#5a1830' : '#cfd89a'); RF(c, x + 4, y + 4, 24, 1, 'rgba(255,255,255,0.4)'); }
  const cv = advisorBustCanvas(id, A.exprs[0]);
  c.save(); c.imageSmoothingEnabled = false;
  c.beginPath(); c.rect(x + 4, y + 4, 24, 24); c.clip();
  c.drawImage(cv, 4, 3, 24, 24, x + 4, y + 4, 24, 24);
  c.restore();
}
function appBadge(g, id) {
  try {
    const a = advisorState(g);
    if (!a) return 0;
    if (!a.met[id]) return 1;
    if (id === 'dokusai') { const r = regimeOf(g); return r.id !== 'democracy' && r.id !== 'fallen' && r.unrest >= 50 ? 1 : 0; }
    const w = warOf(g);
    return w && (num(w.front) <= -40 || (num(w.talksOdds) >= 60 && !w.talks)) ? 1 : 0;
  } catch (e) { return 0; }
}
registerPhoneApp('dokusai', { name: '独裁くん', color: ADVISORS.dokusai.color, order: 62.3, iconHD: (c, x, y, g) => appIcon(c, x, y, g, 'dokusai'), badge: (g) => appBadge(g, 'dokusai'), open: (g) => openAdvisor(g, 'dokusai', 'home') });
registerPhoneApp('ikusa', { name: 'イクサくん', color: ADVISORS.ikusa.color, order: 62.6, iconHD: (c, x, y, g) => appIcon(c, x, y, g, 'ikusa'), badge: (g) => appBadge(g, 'ikusa'), open: (g) => openAdvisor(g, 'ikusa', 'home') });

// ================================================================ install (Game.prototype)
function advisorInfo(g, id) {
  const A = ADVISORS[id];
  if (!A) return null;
  const a = advisorState(g);
  const b = bubbleOf(g, id);
  return { id, name: A.name, kana: A.kana, short: A.short, color: A.color, title: A.title, profile: A.profile, exprs: A.exprs.slice(), mood: b.mood, expr: b.expr, line: b.text, met: num(a && a.met[id]), tipsOff: !!(a && (a.tipsOff || a.muted[id])), state: a };
}
const METHODS = {
  advisor(id) { return advisorInfo(this, id); },
  advisorOpen(id, topic) { return openAdvisor(this, id, topic || 'home'); },
  advisorTip(key, opts) { return advisorTip(this, key, opts || {}); },
  advisorTipClear(keys) { return advisorTipClear(this, keys); },
  advisorAdvice(id) { return advisorAdviceLines(this, id); },
  advisorState() { return advisorState(this); },
  advisorPlan(id) { return id === 'dokusai' ? { ...dokusaiPlan(this), risks: dokusaiRisks(this) } : id === 'ikusa' ? { orders: ikusaOrders(this), checklist: (() => { const t = targetOf(this); return t ? ikusaChecklist(this, t.id) : null; })(), front: ikusaFront(this), peace: ikusaPeace(this), supply: ikusaSupply(this) } : null; },
  advisorLook(id) { const A = ADVISORS[id]; return A ? { id, exprs: A.exprs.slice(), moods: { ...A.moods }, size: 32, color: A.color, color2: A.color2 } : null; },
};
export function installAdvisors(proto) {
  for (const [k, fn] of Object.entries(METHODS)) proto[k] = fn;
  if (!proto._advWrapped) {
    proto._advWrapped = true;
    const up0 = proto.update;
    proto.update = function updateWithAdvisors() {
      up0.call(this);
      try { stepTips(this); watch(this); } catch (e) { console.error(e); }
    };
    const draw0 = proto.render;
    proto.render = function renderWithAdvisors() {
      draw0.call(this);
      if (!this._advTips || !this._advTips.cur) return;
      try {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
        ctx.imageSmoothingEnabled = false;
        drawTip(ctx, this);
        ctx.restore();
      } catch (e) { console.error(e); }
    };
  }
}
installAdvisors(Game.prototype);
// each morning the triggers run at the next frame
onMorning((g) => { try { const b = tipBox(g); b.watchT = 29; } catch (e) { /* ignore */ } });
if (typeof window !== 'undefined') {
  window.__advisors = { ADVISORS, TIPS, advisorBustCanvas, advisorState, dokusaiPlan, dokusaiRisks, dokusaiPower, ikusaChecklist, ikusaOrders, ikusaPeace, ikusaSupply, ikusaFront, ikusaTargets, targetOf, allyOdds, amendOdds, bothHouses, refOdds, watch, stepTips, tipBox, openTopic, homeView, runAction, jwrapA };
}
