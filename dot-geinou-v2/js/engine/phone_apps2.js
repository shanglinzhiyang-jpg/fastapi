// More phone apps (the second set of life apps). Each one reads a system that is already in the
// game; none of them gives money, fame or fans:
//   家計簿     the daily ups and downs of everything you own (cash + 預金): a snapshot every
//              morning (state.phone.apps2.money.hist), a 14-day bar chart and the 7-day totals.
//   健康       steps (the map's walking: 1 tile ≈ 4歩), a 7-day chart, 体力 / 満腹 / ストレス /
//              身だしなみ with the game's own thresholds (life.js) and advice.
//              手帳 eras: 万歩計 (a clip-on pedometer); ケータイ: 歩数計 (phones with one from
//              2003-09, らくらくホンIII); スマホ: ヘルスケア.
//   レシピ     cooking.js recipes: cooked ★ (flags.cook_seen), what is missing, the cooking rank,
//              ordering the missing ingredients (通販's grocery delivery) or a trip to the スーパー.
//   占い       today's fortune (from the day and the name): flavour only, no effect.
//   音楽       the game's own BGM (audio.js SONGS) that you have heard (state.phone.apps2.music):
//              手帳 eras: a pocket ラジオ; ケータイ: 着うた (from 2002-12); スマホ: 音楽.
//              Leaving the app puts the place's music back.
//   ゲーム     ブロック崩し: an LCD 電子ゲーム in the 手帳 eras, a ケータイ game, a スマホ game.
//              Best score saved; the first game of a day is a little 気分転換 (ストレス -5).
//   図鑑       もちもの ever owned (tracked from now; old saves start with what they hold),
//              家具, 称号 (RANKS reached), 番組 (programs.js, the era's real programs appeared
//              on), 場所 (places visited).
//   実績       ~30 achievements read from the existing stats (no reward; a badge when new).
//   電卓       a calculator with a 税込 key (消費税 by the game date / the politics core's rate:
//              none before 1989-04, 3%, 5% 1997-04, 8% 2014-04, 10% 2019-10).
//
// State: g.state.phone.apps2 (see s2(); old saves get defaults on first use).
// API doc: test-output/api_phone.txt.

import { fmtMoney, clamp, shade, display } from './util.js';
import { text, wrap, measure, COLORS } from './draw.js';
import { audio, SONGS } from './audio.js';
import { ITEMS, RANKS, rankIndex, SKILLS } from './state.js';
import { PLACES } from './map.js';
import {
  registerPhoneApp, PEOPLE, FURNITURE, REGULARS, onMorning, WEEKDAYS, weekdayOf,
  HUNGRY, STRESSED, BURNOUT, SCRUFFY, HEARTS,
} from './life.js';
import { eraOf } from './profile.js';
import {
  phoneView, phoneInfo, phoneConfirm, appTile, rrect, box, phoneText as T, fitText, PC,
} from './phone.js';
import {
  devOf, eraId, gameDate, appState, bankBalance, travelTo, placeLabel,
  panelView, drawRow, rowsList, orderGoods,
} from './phone_apps.js';
import { Game } from './game.js';

const EXT = { cooking: null, programs: null, govt: null, housing: null };
import('../world/cooking.js').then((m) => { EXT.cooking = m; }).catch(() => { /* cooking.js left out */ });
import('../world/programs.js').then((m) => { EXT.programs = m; }).catch(() => { /* programs.js left out */ });
import('./govt.js').then((m) => { EXT.govt = m; }).catch(() => { /* govt.js left out */ });
import('../world/housing.js').then((m) => { EXT.housing = m; }).catch(() => { /* housing.js left out */ });

// ======================================================================== small helpers
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function art(c, x, y, rows, pal, s = 1) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const col = pal[rows[j][i]]; if (col) R(c, x + i * s, y + j * s, s, s, col); }
}
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const commas = (n) => Math.round(n).toLocaleString('ja-JP');
function h32(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return h >>> 0;
}
function perFrame(fn) {
  let f = -1, v = null, st = null;
  return (g) => { if (f !== g.frame || st !== g.state) { v = fn(g); f = g.frame; st = g.state; } return v; };
}
const signed = (n) => (n > 0 ? '+' : n < 0 ? '-' : '±') + fmtMoney(Math.abs(n));

// ======================================================================== state
const HIST_MAX = 60; // money snapshots (days)
const STEP_HIST = 14; // days of steps
export const STEPS_PER_TILE = 4;
export const STEP_GOAL = 5000;
const READY = new WeakSet();
// g.state.phone.apps2, created / repaired once per state object (old saves: defaults).
export function s2(g) {
  const st = g.state;
  if (!isObj(st.phone)) st.phone = { inbox: [], nextId: 1, lastPost: 0, posts: 0 };
  let s = st.phone.apps2;
  if (!isObj(s)) s = st.phone.apps2 = {};
  if (READY.has(s)) return s;
  const day = st.day || 1;
  const m = isObj(s.money) ? s.money : {};
  s.money = { hist: arr(m.hist).filter((h) => isObj(h) && num(h.day, 0) >= 1).map((h) => ({ day: Math.max(1, Math.floor(num(h.day, day))), cash: Math.round(num(h.cash)), bank: Math.round(num(h.bank)) })).sort((a, b) => a.day - b.day).slice(-HIST_MAX) };
  const h = isObj(s.health) ? s.health : {};
  s.health = {
    day: Math.max(1, Math.floor(num(h.day, day))), today: Math.max(0, Math.floor(num(h.today))), best: Math.max(0, Math.floor(num(h.best))),
    total: Math.max(0, Math.floor(num(h.total))),
    hist: arr(h.hist).filter(isObj).map((x) => ({ day: Math.floor(num(x.day, day)), steps: Math.max(0, Math.floor(num(x.steps))) })).slice(-STEP_HIST),
  };
  const it = isObj(s.items) ? s.items : {};
  const seen = isObj(it.seen) ? it.seen : {};
  s.items = { seen: Object.fromEntries(Object.keys(seen).filter((k) => ITEMS[k]).map((k) => [k, 1])) };
  const mu = isObj(s.music) ? s.music : {};
  const heard = isObj(mu.heard) ? mu.heard : {};
  s.music = { heard: Object.fromEntries(Object.keys(heard).filter((k) => typeof k === 'string' && k.length < 40).map((k) => [k, Math.floor(num(heard[k], day))])), plays: Math.max(0, Math.floor(num(mu.plays))) };
  const gm = isObj(s.game) ? s.game : {};
  s.game = { best: Math.max(0, Math.floor(num(gm.best))), bestStage: Math.max(0, Math.floor(num(gm.bestStage))), plays: Math.max(0, Math.floor(num(gm.plays))), relaxDay: Math.max(0, Math.floor(num(gm.relaxDay))) };
  const ac = isObj(s.ach) ? s.ach : {};
  const got = isObj(ac.got) ? ac.got : {};
  s.ach = { got: Object.fromEntries(Object.keys(got).map((k) => [k, Math.max(1, Math.floor(num(got[k], day)))])), seen: Math.max(0, Math.floor(num(ac.seen))) };
  const fo = isObj(s.fortune) ? s.fortune : {};
  s.fortune = { seen: Math.max(0, Math.floor(num(fo.seen))), reads: Math.max(0, Math.floor(num(fo.reads))) };
  READY.add(s);
  // what is in もちもの now counts as owned
  for (const k of Object.keys(st.items || {})) if (ITEMS[k] && num(st.items[k]) > 0) s.items.seen[k] = 1;
  return s;
}

// ======================================================================== hooks into the game
// Steps (life.js onWalkStep is called by the map for every tile walked), items received
// (g.giveItem) and every BGM played (audio.bgm), recorded for the apps.
function rollSteps(g) {
  const H = s2(g).health;
  const day = g.state.day || 1;
  if (H.day === day) return H;
  if (H.today > 0 || H.hist.length) H.hist.push({ day: H.day, steps: H.today });
  if (H.hist.length > STEP_HIST) H.hist.splice(0, H.hist.length - STEP_HIST);
  H.day = day;
  H.today = 0;
  return H;
}
(function installHooks() {
  const P = Game && Game.prototype;
  if (P && typeof P.onWalkStep === 'function' && !P.onWalkStep.__apps2) {
    const walk = P.onWalkStep;
    const f = function (...a) {
      const r = walk.apply(this, a);
      try {
        if (this.state && this.state.life) {
          const H = rollSteps(this);
          H.today += STEPS_PER_TILE;
          H.total += STEPS_PER_TILE;
          if (H.today > H.best) H.best = H.today;
        }
      } catch (e) { console.error(e); }
      return r;
    };
    f.__apps2 = true;
    P.onWalkStep = f;
  }
  if (P && typeof P.giveItem === 'function' && !P.giveItem.__apps2) {
    const give = P.giveItem;
    const f = function (id, ...a) {
      const r = give.call(this, id, ...a);
      try { if (this.state && ITEMS[id]) s2(this).items.seen[id] = 1; } catch (e) { console.error(e); }
      return r;
    };
    f.__apps2 = true;
    P.giveItem = f;
  }
  if (audio && typeof audio.bgm === 'function' && !audio.bgm.__apps2) {
    const bgm = audio.bgm.bind(audio);
    const f = (name) => {
      bgm(name);
      try {
        const g = typeof window !== 'undefined' ? window.__game : null;
        if (name && SONGS[name] && g && g.state && g.state.phone) { const H = s2(g).music.heard; if (!H[name]) H[name] = g.state.day || 1; }
      } catch (e) { console.error(e); }
    };
    f.__apps2 = true;
    audio.bgm = f;
  }
})();

// ======================================================================== shared UI
const COL = {
  kakeibo: '#2f8a76', kenko: '#d8506e', recipe: '#d07a22', uranai: '#7a4ab8', music: '#d03a6a',
  game: '#3a4ab0', zukan: '#4f8a3a', jisseki: '#b8901a', dentaku: '#4a5262',
};
const dev = devOf;
// A tab strip on top of a panel view: ←→ (at the strip) switch, a tap on a tab picks it.
const TAB_H = 24;
function drawTabs(c, a, tabs, cur, color) {
  R(c, a.x, a.y, a.w, TAB_H, shade(color, 0.82));
  const w = a.w / tabs.length;
  tabs.forEach(([, label], i) => {
    const x = a.x + i * w;
    const on = i === cur;
    if (on) { rrect(c, x + 2, a.y + 3, w - 4, TAB_H - 5, 5, color); }
    T(c, fitText(c, label, w - 6, 12), x + w / 2, a.y + 6, 12, on ? '#ffffff' : shade(color, -0.45), 'center');
  });
  R(c, a.x, a.y + TAB_H - 1, a.w, 1, shade(color, 0.4));
}
// A list under tabs (and an optional panel under the tabs).
//   o: { title, color, bg, tabs: [[id, label]], items(tabId, view), extra: (tabId, view) => px,
//        drawExtra(c, area, view, tabId), pick(ph, row, i, view, tabId), rowH, hint, empty(tabId), headerRight }
function tabbedView(g, o) {
  const tab = (v) => o.tabs[clamp(v.tab | 0, 0, o.tabs.length - 1)][0];
  const v = panelView(g, {
    title: o.title, color: o.color, bg: o.bg, rowH: o.rowH, hint: o.hint || '←→:タブ　A:えらぶ　B:もどる',
    headerRight: o.headerRight ? (ph) => o.headerRight(tab(v), v) : undefined,
    top: (view) => TAB_H + (o.extra ? o.extra(tab(view), view) : 0),
    drawTop(c, a, view) {
      drawTabs(c, a, o.tabs, view.tab | 0, o.color);
      const ex = o.extra ? o.extra(tab(view), view) : 0;
      if (ex && o.drawExtra) o.drawExtra(c, { x: a.x, y: a.y + TAB_H, w: a.w, h: ex }, view, tab(view));
    },
    items: (view) => o.items(tab(view), view),
    pick: (ph, row, i, view) => (o.pick ? o.pick(ph, row, i, view, tab(view)) : null),
    update(ph, inp, view) {
      const n = o.tabs.length;
      const d = inp.repeat('left') ? -1 : inp.repeat('right') ? 1 : 0;
      if (d) { view.tab = ((view.tab | 0) + d + n) % n; view.idx = 0; view.topRow = 0; view.sy = null; audio.sfx('cursor'); return true; }
      return false;
    },
    tapTop(ph, x, y, view) {
      const a = view.area;
      if (!a || y >= a.y + TAB_H) return false;
      const i = clamp(Math.floor(((x - a.x) * o.tabs.length) / a.w), 0, o.tabs.length - 1);
      if (i !== (view.tab | 0)) { view.tab = i; view.idx = 0; view.topRow = 0; view.sy = null; audio.sfx('cursor'); }
      return false;
    },
  });
  v.tab = o.tab | 0;
  return v;
}
// Stars ★★★☆☆ drawn as pixel stars.
const STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'];
function stars(c, x, y, n, max = 5, on = '#ffc83a', off = '#cfc6b0', s = 1) {
  for (let i = 0; i < max; i++) art(c, x + i * (8 * s + 1), y, STAR, { '#': i < n ? on : off }, s);
}
function bar(c, x, y, w, h, frac, col, bg = '#e4ddcc') {
  R(c, x, y, w, h, bg);
  const fw = Math.round(w * clamp(frac, 0, 1));
  if (fw > 0) R(c, x, y, fw, h, col);
}

// ======================================================================== icons (32x32)
function iconKakeibo(c, x, y, g) {
  appTile(c, x, y, COL.kakeibo);
  if (dev(g) === 'techo') {
    // a 家計簿 notebook with ruled lines and a pencil
    R(c, x + 6, y + 5, 19, 23, '#2a3a2a'); R(c, x + 7, y + 6, 17, 21, '#fbf6e4');
    R(c, x + 7, y + 6, 17, 4, '#e8b040');
    for (let i = 0; i < 5; i++) R(c, x + 9, y + 12 + i * 3, 13, 1, '#a8b0a0');
    R(c, x + 19, y + 13, 3, 1, '#c0392b'); R(c, x + 18, y + 19, 4, 1, '#2f8a4a');
    R(c, x + 23, y + 14, 3, 12, '#f0c020'); R(c, x + 23, y + 26, 3, 2, '#e8a0a0');
    return;
  }
  // a chart: bars going up, a ¥ coin
  R(c, x + 5, y + 6, 22, 20, '#e8f4ee'); R(c, x + 5, y + 25, 22, 1, '#2a4a40');
  [[7, 18], [11, 14], [15, 16], [19, 10]].forEach(([dx, top], i) => R(c, x + dx, y + top, 3, 25 - top, i === 2 ? '#d6463a' : '#2f9a6a'));
  disc(c, x + 23, y + 10, 4, '#a07018'); disc(c, x + 23, y + 10, 3, '#f0c040');
  art(c, x + 22, y + 8, ['#.#', '.#.', '###', '.#.'], { '#': '#a07018' });
}
function iconKenko(c, x, y, g) {
  appTile(c, x, y, COL.kenko);
  const d = dev(g);
  if (d === 'smart') {
    // a heart and a pulse line
    art(c, x + 6, y + 7, ['.###..###.', '#####.####', '##########', '##########', '.########.', '..######..', '...####...', '....##....'].map((r) => r), { '#': '#ffffff' }, 2);
    for (let i = 0; i < 20; i++) R(c, x + 6 + i, y + 16 + (i === 8 ? -5 : i === 9 ? 4 : i === 10 ? -2 : 0), 1, 2, COL.kenko);
    return;
  }
  // a pedometer (万歩計): a round-cornered case with a little LCD
  R(c, x + 8, y + 6, 16, 21, '#1e1e26'); R(c, x + 9, y + 7, 14, 19, d === 'techo' ? '#e8e0c8' : '#c8ccd8');
  R(c, x + 11, y + 10, 10, 6, '#7a8a6a'); R(c, x + 12, y + 11, 8, 4, '#a8b890');
  R(c, x + 13, y + 12, 1, 2, '#1e2a1a'); R(c, x + 15, y + 12, 1, 2, '#1e2a1a'); R(c, x + 17, y + 12, 2, 2, '#1e2a1a');
  disc(c, x + 16, y + 21, 2, '#d8506e');
  R(c, x + 14, y + 3, 4, 4, '#3a3a4a'); // the belt clip
}
function iconRecipe(c, x, y, g) {
  appTile(c, x, y, COL.recipe);
  // a frying pan with an egg
  disc(c, x + 14, y + 17, 9, '#1e1e26'); disc(c, x + 14, y + 17, 8, '#3a3a4a');
  R(c, x + 22, y + 15, 8, 3, '#6a3a1a');
  disc(c, x + 14, y + 17, 5, '#ffffff'); disc(c, x + 15, y + 17, 2, '#ffc020');
  if (dev(g) === 'techo') { R(c, x + 4, y + 4, 9, 6, '#fbf6e4'); R(c, x + 5, y + 6, 7, 1, '#a8a090'); R(c, x + 5, y + 8, 5, 1, '#a8a090'); }
  else { R(c, x + 6, y + 4, 2, 4, '#ffffff'); R(c, x + 11, y + 3, 2, 4, '#ffffff'); }
}
function iconUranai(c, x, y) {
  appTile(c, x, y, COL.uranai);
  // a crystal ball on a stand, with stars
  disc(c, x + 16, y + 14, 8, '#c8b8ff'); disc(c, x + 16, y + 14, 7, '#8a6ae8'); disc(c, x + 14, y + 12, 2, '#e8e0ff');
  R(c, x + 9, y + 22, 14, 3, '#d8a020'); R(c, x + 7, y + 25, 18, 3, '#a87010');
  art(c, x + 4, y + 4, ['.#.', '###', '.#.'], { '#': '#ffe080' });
  art(c, x + 25, y + 6, ['.#.', '###', '.#.'], { '#': '#ffe080' });
}
function iconMusic(c, x, y, g) {
  appTile(c, x, y, COL.music);
  if (dev(g) === 'techo') {
    // a pocket radio: speaker grille, dial, antenna
    R(c, x + 21, y + 3, 1, 8, '#e8e8f0');
    R(c, x + 5, y + 10, 22, 16, '#1e1e26'); R(c, x + 6, y + 11, 20, 14, '#c8b890');
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) R(c, x + 8 + i * 3, y + 13 + j * 3, 2, 2, '#5a4a30');
    R(c, x + 20, y + 13, 5, 9, '#f4ecd0'); R(c, x + 22, y + 14, 1, 7, '#d6304a');
    return;
  }
  // a double note
  R(c, x + 12, y + 7, 13, 3, '#ffffff'); R(c, x + 12, y + 7, 2, 15, '#ffffff'); R(c, x + 23, y + 7, 2, 13, '#ffffff');
  disc(c, x + 10, y + 22, 3, '#ffffff'); disc(c, x + 21, y + 20, 3, '#ffffff');
}
function iconGame(c, x, y, g) {
  const d = dev(g);
  appTile(c, x, y, COL.game);
  if (d === 'techo') {
    // an LCD handheld game: two buttons, a d-pad, the grey-green screen with blocks
    R(c, x + 4, y + 6, 24, 20, '#c8c0b0'); R(c, x + 4, y + 6, 24, 1, '#e8e0d0');
    R(c, x + 9, y + 8, 14, 10, '#1e1e26'); R(c, x + 10, y + 9, 12, 8, '#9aab88');
    R(c, x + 11, y + 10, 3, 1, '#26301e'); R(c, x + 15, y + 10, 3, 1, '#26301e'); R(c, x + 19, y + 10, 2, 1, '#26301e');
    R(c, x + 14, y + 15, 4, 1, '#26301e'); R(c, x + 16, y + 13, 1, 1, '#26301e');
    R(c, x + 6, y + 21, 5, 1, '#3a3a4a'); R(c, x + 8, y + 19, 1, 5, '#3a3a4a');
    disc(c, x + 23, y + 21, 1, '#d6304a'); disc(c, x + 26, y + 20, 1, '#d6304a');
    return;
  }
  // blocks and a ball over a paddle
  const cols = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff'];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) R(c, x + 5 + i * 6, y + 6 + j * 4, 5, 3, cols[(i + j) % 4]);
  R(c, x + 15, y + 19, 3, 3, '#ffffff');
  R(c, x + 10, y + 25, 12, 2, '#ffffff');
}
function iconZukan(c, x, y) {
  appTile(c, x, y, COL.zukan);
  // an open book with a picture and a magnifying glass
  R(c, x + 4, y + 8, 24, 17, '#2a3a1a'); R(c, x + 5, y + 9, 11, 15, '#fbf6e4'); R(c, x + 16, y + 9, 11, 15, '#f4eed8');
  R(c, x + 7, y + 11, 7, 6, '#8ac87a'); R(c, x + 9, y + 13, 3, 3, '#e8384f');
  for (let i = 0; i < 4; i++) R(c, x + 18, y + 12 + i * 3, 7, 1, '#a8a090');
  disc(c, x + 22, y + 21, 4, '#3a3a4a'); disc(c, x + 22, y + 21, 3, '#c8e8ff'); R(c, x + 25, y + 24, 3, 3, '#3a3a4a');
}
function iconJisseki(c, x, y, g) {
  appTile(c, x, y, COL.jisseki);
  if (dev(g) === 'techo') {
    // a stamp card with round stamps
    R(c, x + 4, y + 7, 24, 18, '#5a3a10'); R(c, x + 5, y + 8, 22, 16, '#fbf6e4');
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { disc(c, x + 9 + i * 7, y + 12 + j * 7, 2, i + j * 3 < 4 ? '#d6304a' : '#e0d8c0'); }
    return;
  }
  // a trophy
  R(c, x + 9, y + 6, 14, 3, '#fff0a0'); R(c, x + 9, y + 9, 14, 7, '#ffd23f'); R(c, x + 11, y + 16, 10, 2, '#e0a820');
  R(c, x + 6, y + 8, 3, 6, '#ffd23f'); R(c, x + 23, y + 8, 3, 6, '#ffd23f');
  R(c, x + 14, y + 18, 4, 3, '#e0a820'); R(c, x + 10, y + 21, 12, 3, '#6a4a10'); R(c, x + 9, y + 24, 14, 2, '#4a3008');
  R(c, x + 12, y + 10, 2, 4, '#ffffff');
}
function iconDentaku(c, x, y, g) {
  appTile(c, x, y, COL.dentaku);
  R(c, x + 7, y + 4, 18, 24, '#1e1e26'); R(c, x + 8, y + 5, 16, 22, dev(g) === 'techo' ? '#c8c0b0' : '#2a2e3a');
  R(c, x + 9, y + 7, 14, 5, '#9aab88'); R(c, x + 17, y + 8, 5, 3, '#26301e');
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) R(c, x + 9 + i * 4, y + 14 + j * 3, 3, 2, i === 3 ? '#e07a1f' : '#e8e8f0');
}

// ======================================================================== 家計簿
// A snapshot of cash + 預金 every morning (after the night's rent); a day's change is the next
// morning's snapshot minus that morning's (today: now minus this morning).
function snapNow(g) { return { day: g.state.day || 1, cash: Math.round(num(g.state.money)), bank: Math.round(bankBalance(g)) }; }
export function moneySnapshot(g) {
  const M = s2(g).money;
  const sn = snapNow(g);
  const last = M.hist[M.hist.length - 1];
  if (last && last.day >= sn.day) return false;
  M.hist.push(sn);
  if (M.hist.length > HIST_MAX) M.hist.splice(0, M.hist.length - HIST_MAX);
  return true;
}
// [{ day, change, end, today }] newest first
export function moneyDays(g) {
  const H = s2(g).money.hist;
  const out = [];
  const total = (h) => h.cash + h.bank;
  for (let i = 0; i < H.length; i++) {
    const a = H[i], b = H[i + 1];
    if (b) out.push({ day: a.day, change: total(b) - total(a), end: total(b), today: false });
    else if (a.day === g.state.day) { const now = snapNow(g); out.push({ day: a.day, change: total(now) - total(a), end: total(now), today: true }); }
  }
  return out.reverse();
}
const kakeiboTitle = () => '家計簿';
function drawKakeiboTop(c, a, g) {
  const techo = dev(g) === 'techo';
  const days = moneyDays(g);
  const now = snapNow(g);
  const x = a.x + 8, w = a.w - 16;
  if (techo) { box(c, x, a.y + 4, w, a.h - 8, 3, '#fbf6e4', '#8a7a50', { lo: '#e8dcc0' }); for (let ly = a.y + 52; ly < a.y + a.h - 8; ly += 12) R(c, x + 4, ly, w - 8, 1, '#e8dcc0'); } else box(c, x, a.y + 4, w, a.h - 8, 6, '#ffffff', '#c8d8d0', { lo: '#e0ece6' });
  const ink = techo ? '#3a2a10' : PC.text;
  T(c, '持っているお金（現金＋預金）', x + 8, a.y + 8, 12, PC.dim);
  text(c, fmtMoney(now.cash + now.bank), x + w - 8, a.y + 20, { size: 16, align: 'right', color: techo ? '#3a2a10' : COL.kakeibo, shadow: null });
  T(c, fitText(c, `現金 ${fmtMoney(now.cash)}・預金 ${fmtMoney(now.bank)}`, w - 16, 12), x + 8, a.y + 38, 12, ink);
  // the last 14 days' changes as bars around a zero line
  const cx = x + 8, cw = w - 16, cy = a.y + 56, ch = a.h - 66;
  const last = days.slice(0, 14).reverse();
  const max = Math.max(1, ...last.map((d) => Math.abs(d.change)));
  const mid = cy + Math.round(ch / 2);
  R(c, cx, mid, cw, 1, techo ? '#b8a880' : '#c8d0cc');
  if (!last.length) { T(c, '明日の朝から記録がはじまる', cx + cw / 2, mid - 16, 12, PC.dim, 'center'); return; }
  const bw = Math.floor(cw / 14);
  last.forEach((d, i) => {
    const hgt = Math.max(1, Math.round((Math.abs(d.change) / max) * (ch / 2 - 2)));
    const bx = cx + cw - (last.length - i) * bw + 2;
    const col = d.change >= 0 ? (techo ? '#2f6a3a' : '#2f9a6a') : (techo ? '#a0302a' : '#d6463a');
    if (d.change >= 0) R(c, bx, mid - hgt, bw - 3, hgt, col); else R(c, bx, mid + 1, bw - 3, hgt, col);
    if (d.today) R(c, bx, cy + ch - 2, bw - 3, 2, PC.accent);
  });
}
function kakeiboRows(g) {
  const days = moneyDays(g);
  const wk = days.slice(0, 7);
  const plus = wk.filter((d) => d.change > 0).reduce((s, d) => s + d.change, 0);
  const minus = wk.filter((d) => d.change < 0).reduce((s, d) => s + d.change, 0);
  const rows = [];
  if (days.length) rows.push({ id: 'sum', label: `この7日間：${signed(plus + minus)}`, sub: `ふえた ${signed(plus)}　へった ${signed(minus)}`, chip: ['合計', COL.kakeibo] });
  for (const d of days) {
    rows.push({ id: 'day', label: d.today ? `${d.day}日目（${WEEKDAYS[weekdayOf(d.day)]}）きょう` : `${d.day}日目（${WEEKDAYS[weekdayOf(d.day)]}）`, sub: `${d.today ? 'いま' : '翌朝'} ${fmtMoney(d.end)}`, right: signed(d.change), rightColor: d.change > 0 ? PC.good : d.change < 0 ? PC.bad : PC.dim });
  }
  return rows;
}
export async function kakeiboApp(g) {
  moneySnapshot(g); // an old save: today is the first day of the record
  return phoneView(g, panelView(g, {
    title: kakeiboTitle(g), color: COL.kakeibo, bg: dev(g) === 'techo' ? '#f6f0dc' : '#f2f6f4', top: 120, rowH: 36,
    hint: 'A:くわしく　B:もどる',
    items: () => kakeiboRows(g),
    drawTop(c, a) { drawKakeiboTop(c, a, g); },
    pick(ph, it, i, v) {
      ph.run(v, () => phoneInfo(g, { title: '家計簿のつけかた', color: COL.kakeibo, lines: [
        '毎朝、現金と預金の合計を記録する。',
        'その日のうちにふえた・へったお金がグラフになる（緑はプラス、赤はマイナス）。',
        '家賃は月曜の朝に引かれるので、日曜の分に入る。',
        '',
        `何にいくら使ったかは「家計」の明細や、「${dev(g) === 'techo' ? '通帳' : '銀行'}」の明細で。`,
        `記録は${HIST_MAX}日分。`,
      ] }));
    },
  }));
}

// ======================================================================== 健康（万歩計／歩数計／ヘルスケア）
const kenkoTitle = (g) => ({ techo: '万歩計', keitai: '歩数計', smart: 'ヘルスケア' })[dev(g)];
function stepDays(g) {
  const H = rollSteps(g);
  return [...H.hist.slice(-6), { day: H.day, steps: H.today, today: true }];
}
function advice(g) {
  const st = g.state, L = st.life || {};
  const out = [];
  if (num(L.stress) >= BURNOUT) out.push(['ストレスが限界。仕事はできない。ジョギングやお風呂、友だちと遊んで気分転換を。', PC.bad]);
  else if (num(L.stress) >= STRESSED) out.push([`ストレスが${STRESSED}をこえている（ミニゲームが難しくなる）。息抜きしよう。`, PC.bad]);
  if (num(L.hunger) < HUNGRY) out.push([`おなかがペコペコ（${HUNGRY}未満：ミニゲーム -20%・よく眠れない）。何か食べよう。`, PC.bad]);
  if (num(L.clean) < SCRUFFY) out.push([`身だしなみが${SCRUFFY}未満。お風呂や銭湯でさっぱりしよう。`, PC.bad]);
  if (st.stamina < st.maxStamina * 0.25) out.push(['体力が少ない。食事か、家でぐっすり眠ろう。', PC.accent]);
  const H = s2(g).health;
  if (H.today >= STEP_GOAL) out.push([`きょうは${commas(STEP_GOAL)}歩を達成！よく歩いた。`, PC.good]);
  else out.push([`目標まであと${commas(STEP_GOAL - H.today)}歩。歩くと、おなかがへって身だしなみも少しくずれる。`, PC.dim]);
  if (out.length === 1) out.unshift(['調子は上々！このままいこう。', PC.good]);
  return out;
}
function drawKenkoTop(c, a, g) {
  const d = dev(g);
  const H = s2(g).health;
  const x = a.x + 8, w = a.w - 16, y = a.y + 4, h = a.h - 8;
  if (d === 'techo') {
    // the pedometer's LCD
    box(c, x, y, w, h, 6, '#d8d0bc', '#3a3a4a', { lo: '#b8b0a0' });
    R(c, x + 8, y + 6, w - 16, 34, '#7a8a6a'); R(c, x + 9, y + 7, w - 18, 32, '#a8b890');
    T(c, '歩', x + w - 16, y + 22, 12, '#26301e', 'right');
    text(c, commas(H.today), x + w - 34, y + 12, { size: 20, align: 'right', color: '#26301e', shadow: null });
    T(c, 'きょう', x + 14, y + 11, 12, '#3a4a2a');
  } else {
    box(c, x, y, w, h, 6, d === 'smart' ? '#ffffff' : '#f0f0f8', d === 'smart' ? '#f0c8d4' : '#9a9ab0', { lo: '#e8e0e8' });
    T(c, 'きょうの歩数', x + 10, y + 8, 12, PC.dim);
    text(c, `${commas(H.today)}歩`, x + w - 10, y + 18, { size: 20, align: 'right', color: COL.kenko, shadow: null });
  }
  bar(c, x + 10, y + 44, w - 20, 5, H.today / STEP_GOAL, d === 'techo' ? '#3a5a2a' : COL.kenko, d === 'techo' ? '#b8b0a0' : '#f0dde2');
  T(c, `目標 ${commas(STEP_GOAL)}歩・最高 ${commas(H.best)}歩`, x + 10, y + 52, 12, PC.dim);
  // the last 7 days
  const days = stepDays(g);
  const cx = x + 10, cw = w - 20, cy = y + 70, ch = h - 88;
  const max = Math.max(STEP_GOAL, ...days.map((s) => s.steps));
  const bw = Math.floor(cw / 7);
  const gy = cy + ch - Math.round((STEP_GOAL / max) * ch);
  for (let i = cx; i < cx + cw; i += 4) R(c, i, gy, 2, 1, '#c8b8c0');
  days.forEach((s, i) => {
    const hh = Math.max(1, Math.round((s.steps / max) * ch));
    const bx = cx + (7 - days.length + i) * bw + 3;
    R(c, bx, cy + ch - hh, bw - 6, hh, s.today ? (d === 'techo' ? '#3a5a2a' : COL.kenko) : s.steps >= STEP_GOAL ? '#e88aa0' : '#c8bcc4');
    T(c, WEEKDAYS[weekdayOf(s.day)], bx + (bw - 6) / 2, cy + ch + 2, 12, s.today ? PC.text : PC.dim, 'center');
  });
}
function kenkoRows(g) {
  const st = g.state, L = st.life || {};
  const rows = [
    { kind: 'need', label: '体力', v: st.stamina, max: st.maxStamina, col: '#5ac06a', note: `${Math.round(st.stamina)}／${st.maxStamina}` },
    { kind: 'need', label: '満腹', v: num(L.hunger), max: 100, col: num(L.hunger) < HUNGRY ? PC.bad : '#e0a030', note: `${Math.round(num(L.hunger))}` },
    { kind: 'need', label: 'ストレス', v: num(L.stress), max: 100, col: num(L.stress) >= STRESSED ? PC.bad : '#8a7ad8', note: `${Math.round(num(L.stress))}` },
    { kind: 'need', label: '身だしなみ', v: num(L.clean), max: 100, col: num(L.clean) < SCRUFFY ? PC.bad : '#4ab0d8', note: `${Math.round(num(L.clean))}` },
  ];
  for (const [t, col] of advice(g)) rows.push({ kind: 'tip', label: t, col });
  return rows;
}
function drawKenkoRow(c, it, x, y, w, rh, sel) {
  if (it.kind === 'need') {
    T(c, it.label, x + 10, y + 9, 14, sel ? '#1a1a28' : PC.text);
    bar(c, x + 96, y + 13, w - 172, 8, it.v / Math.max(1, it.max), it.col);
    T(c, it.note, x + w - 10, y + 10, 12, PC.dim, 'right');
    return;
  }
  const lines = wrap(c, it.label, w - 24, 12).slice(0, 2);
  lines.forEach((l, i) => T(c, l, x + 14, y + (lines.length === 1 ? 10 : 3) + i * 15, 12, it.col || PC.text));
  disc(c, x + 7, y + (lines.length === 1 ? 16 : 10), 2, it.col || PC.dim);
}
export async function kenkoApp(g) {
  return phoneView(g, panelView(g, {
    title: kenkoTitle(g), color: COL.kenko, bg: '#f8f2f4', top: 124, rowH: 34,
    hint: 'A:説明　B:もどる',
    items: () => kenkoRows(g),
    drawRow: drawKenkoRow,
    drawTop(c, a) { drawKenkoTop(c, a, g); },
    pick(ph, it, i, v) {
      const d = dev(g);
      ph.run(v, () => phoneInfo(g, { title: kenkoTitle(g), color: COL.kenko, lines: [
        d === 'techo' ? '腰につけた万歩計が、歩いた数をかぞえる（記録は手帳に書きうつす）。' : d === 'keitai' ? 'ケータイの歩数計（2003年に歩数計つきのケータイが登場）が、歩いた数をかぞえる。' : 'スマホが歩いた数をかぞえて、体の調子といっしょに見せてくれる。',
        `町を1マス歩くと、およそ${STEPS_PER_TILE}歩。乗り物では増えない。`,
        `1日の目標は${commas(STEP_GOAL)}歩。`,
        '',
        `満腹が${HUNGRY}未満、ストレスが${STRESSED}以上だとミニゲームが難しくなる。ストレス${BURNOUT}では仕事ができない。身だしなみが${SCRUFFY}未満だと評価や好感度が上がりにくい。`,
      ] }));
    },
  }));
}

// ======================================================================== レシピ（料理帳）
const recipeTitle = (g) => (dev(g) === 'techo' ? '料理帳' : 'レシピ');
function recipeRows(g) {
  const C = EXT.cooking;
  if (!C || !Array.isArray(C.RECIPES)) return [];
  const seen = isObj(g.flag('cook_seen')) ? g.flag('cook_seen') : {};
  return C.RECIPES.map((r) => {
    const n = C.canCook(g, r);
    const missing = Object.entries(r.needs).filter(([id, k]) => (g.state.items[id] || 0) < k);
    const needs = Object.entries(r.needs).map(([id, k]) => `${(ITEMS[id] && ITEMS[id].name) || id}${k > 1 ? `×${k}` : ''}`).join('・');
    return {
      r, missing, label: r.name, sub: needs,
      subColor: missing.length ? PC.dim : PC.good,
      right: n > 0 ? `作れる${n > 1 ? `×${n}` : ''}` : `あと${missing.length}品`, rightColor: n > 0 ? PC.good : PC.dim,
      chip: [seen[r.id] ? '★' : '新', seen[r.id] ? '#e0a020' : '#9a9aaa'],
    };
  });
}
function drawRecipeTop(c, a, g) {
  const C = EXT.cooking;
  const techo = dev(g) === 'techo';
  const x = a.x + 8, w = a.w - 16;
  box(c, x, a.y + 4, w, a.h - 8, techo ? 3 : 6, techo ? '#fbf6e4' : '#fff8ee', techo ? '#8a7a50' : '#ecc898', { lo: '#f0e0c8' });
  if (!C) { T(c, '（レシピを読みこみ中…）', x + 8, a.y + 10, 12, PC.dim); return; }
  const rk = C.cookRank(g);
  const seen = isObj(g.flag('cook_seen')) ? Object.keys(g.flag('cook_seen')).length : 0;
  T(c, fitText(c, `${rk.name}（${C.cookCount(g)}品つくった）`, w - 16, 12), x + 8, a.y + 9, 12, PC.text);
  T(c, fitText(c, `作ったことのある料理 ${Math.min(seen, C.RECIPES.length)}／${C.RECIPES.length}${rk.bonus ? `・効果 +${Math.round(rk.bonus * 100)}%` : ''}`, w - 16, 12), x + 8, a.y + 25, 12, PC.dim);
}
async function recipeDetail(g, row) {
  const C = EXT.cooking;
  const r = row.r;
  const b = C.cookRank(g).bonus;
  const eff = `体力+${Math.round(r.heal * (1 + b))}　満腹+${r.fill}${r.stress ? `　ストレス-${Math.round(r.stress * (1 + b))}` : ''}`;
  const needs = Object.entries(r.needs).map(([id, k]) => `${(ITEMS[id] && ITEMS[id].name) || id}×${k}（持っている${g.state.items[id] || 0}）`).join('\n');
  const choices = [];
  if (row.missing.length) choices.push(dev(g) === 'techo' ? '足りない材料を配達でたのむ' : '足りない材料を注文する');
  if (row.missing.length) choices.push('スーパーへ行く');
  choices.push('もどる');
  const k = await phoneConfirm(g, {
    title: r.name, color: COL.recipe,
    text: `${r.text}\n\n${eff}${r.serves > 1 ? `（${r.serves}皿分）` : ''}${r.box === false ? '' : '・お弁当にできる'}\n\n材料：\n${needs}\n\n家のキッチンで作れる。`,
    choices,
  });
  const ch = choices[k];
  if (!ch || ch === 'もどる') return;
  if (ch === 'スーパーへ行く') { await travelTo(g, 'super'); return; }
  await orderGoods(g, row.missing.map(([id]) => id));
}
export async function recipeApp(g) {
  return phoneView(g, panelView(g, {
    title: recipeTitle(g), color: COL.recipe, bg: dev(g) === 'techo' ? '#f6f0dc' : '#fbf6ee', top: 50, rowH: 38,
    hint: 'A:くわしく　B:もどる',
    empty: '（レシピがない）',
    items: () => recipeRows(g),
    drawTop(c, a) { drawRecipeTop(c, a, g); },
    pick(ph, it, i, v) { ph.run(v, () => recipeDetail(g, it)); },
  }));
}

// ======================================================================== 占い
const LUCKY_COLORS = ['赤', 'オレンジ', '黄色', '黄緑', '水色', '青', 'むらさき', 'ピンク', '白', '金色', '銀色', 'ネイビー'];
const FORTUNE_WORDS = {
  5: ['なにをやってもうまくいきそうな一日。思いきって前へ！', '笑顔がまわりにひろがる日。人に会いに行こう。'],
  4: ['いい流れが来ている。ていねいな準備が実をむすぶ。', '小さなラッキーがつづく日。感謝を口に出してみて。'],
  3: ['ふつうがいちばん。いつものペースで大丈夫。', 'あせらず、ひとつずつ。夕方からツキが上向き。'],
  2: ['ちょっとお疲れぎみ。休むのも大事な仕事。', '早とちりに注意。返事はひと呼吸おいてから。'],
  1: ['今日は充電の日。おいしいものを食べて、早めに寝よう。', 'うまくいかなくても気にしない。明日はきっと晴れ。'],
};
export function fortuneOf(g, day = g.state.day) {
  const p = g.state.profile || {};
  const seed = h32(`${day}|${p.familyName || ''}${p.givenName || g.state.name || ''}|${p.hometown || ''}`);
  const r = (k, n) => (h32(`${seed}:${k}`) % n);
  const all = 1 + Math.min(4, r('all', 6));
  const sub = (k) => clamp(all + r(k, 3) - 1, 1, 5);
  // everyday goods only (nothing for adults, nothing from the 歓楽街 / the dark side)
  const ADULT = /ビール|酒|たばこ|タバコ|煙草|20歳|二十歳|未成年/;
  const goods = Object.keys(ITEMS).filter((k) => ITEMS[k] && ITEMS[k].price > 0 && !ITEMS[k].ingredient && ITEMS[k].name && !/^(kanraku|crime|dark|yami)/.test(k) && !ADULT.test(`${ITEMS[k].name}${ITEMS[k].desc || ''}`)).sort();
  const visited = Object.keys((g.state.flags && g.state.flags.visited) || {}).filter((k) => PLACES[k]).sort();
  const words = FORTUNE_WORDS[all];
  return {
    all, work: sub('work'), people: sub('people'), money: sub('money'),
    item: goods.length ? ITEMS[goods[r('item', goods.length)]].name : 'おにぎり',
    itemId: goods.length ? goods[r('item', goods.length)] : null,
    color: LUCKY_COLORS[r('color', LUCKY_COLORS.length)],
    place: visited.length ? placeLabel(visited[r('place', visited.length)]) : 'ドット荘',
    word: words[r('word', words.length)],
  };
}
const RANK_WORDS = ['', '小吉', '吉', '中吉', '大吉', '超大吉'];
function fortuneView(g) {
  const d = dev(g);
  const F = fortuneOf(g);
  const date = gameDate(g);
  return {
    title: '占い', color: COL.uranai, bg: d === 'techo' ? '#f4eedc' : d === 'keitai' ? '#fff0f6' : '#1e1636', cancel: -1,
    hint: 'A／B:とじる',
    enter() { const S = s2(g).fortune; if (S.seen !== g.state.day) { S.seen = g.state.day; S.reads++; } },
    update(ph, inp) { if (inp.pressed('a') || inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); } },
    draw(c, ph, a) {
      const dark = d === 'smart';
      const ink = dark ? '#f0e8ff' : '#2a1a3a', dim = dark ? '#a898d0' : '#7a6a8a';
      const x = a.x + 10, w = a.w - 20;
      let y = a.y + 8;
      if (dark) for (let i = 0; i < 18; i++) R(c, a.x + ((i * 53 + ph.t / 3) % a.w), a.y + ((i * 37) % a.h), 1, 1, i % 3 ? '#6a5aa8' : '#ffffff');
      const src = d === 'techo' ? `ドット新聞「きょうの運勢」（${date.month}月）` : d === 'keitai' ? 'ケータイ占い（きょうの運勢）' : '占いアプリ（きょうの運勢）';
      T(c, fitText(c, src, w, 12), x, y, 12, dim);
      y += 18;
      T(c, fitText(c, `${g.state.day}日目のあなた`, w - 70, 14), x, y, 14, ink);
      text(c, RANK_WORDS[F.all], x + w, y - 2, { size: 16, align: 'right', color: dark ? '#ffd23f' : COL.uranai, shadow: dark ? '#000' : null });
      y += 22;
      stars(c, x, y, F.all, 5, '#ffc83a', dark ? '#4a3a7a' : '#d8cce0', 2);
      y += 22;
      for (const [k, label] of [['work', '仕事運'], ['people', '人間関係'], ['money', '金運']]) {
        T(c, label, x, y, 12, ink);
        stars(c, x + 70, y + 2, F[k], 5, '#ffc83a', dark ? '#4a3a7a' : '#d8cce0');
        y += 16;
      }
      y += 4;
      R(c, x, y, w, 1, dark ? '#4a3a7a' : '#d8cce0');
      y += 6;
      const lines = [
        `ラッキーアイテム：${F.item}${F.itemId && (g.state.items[F.itemId] || 0) > 0 ? '（持ってる！）' : ''}`,
        `ラッキーカラー：${F.color}`,
        `ラッキースポット：${F.place}`,
      ];
      for (const l of lines) { T(c, fitText(c, l, w, 12), x, y, 12, ink); y += 15; }
      y += 4;
      const wl = wrap(c, F.word, w, 12).slice(0, 3);
      wl.forEach((l, i) => T(c, l, x, y + i * 15, 12, dark ? '#ffd8f0' : COL.uranai));
      T(c, fitText(c, '※占いはお楽しみ（ゲームに影響なし）', w, 12), x + w / 2, a.y + a.h - 16, 12, dim, 'center');
    },
  };
}
export async function uranaiApp(g) { return phoneView(g, fortuneView(g)); }
const fortuneNew = (g) => (s2(g).fortune.seen === g.state.day ? 0 : 1);

// ======================================================================== 音楽（ラジオ／着うた）
// The game's own songs (audio.js SONGS); titles here. Only songs you have heard are on the list.
const SONG_TITLES = {
  title: 'ドット芸能界のテーマ', town: 'ドット区の通り', osaka: 'なんばの通り', office: '事務所のロビー', studio: 'スタジオ',
  theater: '劇場', minigame: '本番だ！', night: '夜の街', ending: 'エンディング', kokkai: '国会議事堂', kuyakusho: '区役所の窓口',
  shinkigeki_theme: '新喜劇のテーマ（ドット版）', horipro_lobby: '芸能事務所のロビー', horipro_audition: 'オーディション', yoshimoto_debayashi: '出囃子（東京の劇場）',
  shochiku_debayashi: '出囃子（なんばの劇場）', tsukkomi_debayashi: '漫才の出囃子', toho_lobby: '映画会社のロビー', toho_musical: 'ミュージカル',
  toho_kaiju: '怪獣映画', grape_store: 'グッズストア', nhk_gala: '年末の歌番組', nhk_kids: '子ども番組のうた', toei_edo: '時代劇のテーマ',
  toei_hero: 'ヒーロー番組のテーマ', machi_shop: '商店街', machi_cafe: 'カフェ', machi_gym: 'ジム', kan_arcade: 'ゲームセンター', kan_shady: '夜の路地',
  sento_yu: '銭湯', lounge: 'ラウンジ', quiz_show: 'クイズ番組', talk_show: 'トーク番組', talk_radio: 'ラジオ番組', command_tate: '殺陣',
  command_henshin: '変身！', command_kaiju: '怪獣あらわる', command_acting: 'お芝居', command_dance: 'ダンス',
};
const songTitle = (k) => SONG_TITLES[k] || `BGM「${k}」`;
const musicTitle = (g) => ({ techo: 'ラジオ', keitai: '着うた', smart: '音楽' })[dev(g)];
function songList(g) {
  const H = s2(g).music.heard;
  return Object.keys(SONGS).filter((k) => SONGS[k] && Array.isArray(SONGS[k].tracks)).map((k) => ({ k, heard: !!H[k] || k === 'title' }))
    .sort((a, b) => (b.heard - a.heard) || (Object.keys(SONG_TITLES).indexOf(a.k) + 1 || 999) - (Object.keys(SONG_TITLES).indexOf(b.k) + 1 || 999));
}
const playing = () => (audio.current && audio.current.name) || audio.wanted || null;
function drawMusicTop(c, a, g, view, ph) {
  const d = dev(g);
  const x = a.x + 8, w = a.w - 16, y = a.y + 4, h = a.h - 8;
  const now = playing();
  const t = ph ? ph.t : 0;
  const mine = view.started && now === view.started;
  if (d === 'techo') {
    // the radio's dial window: a needle on the band
    box(c, x, y, w, h, 4, '#3a2a1a', '#1a1008', { hi: '#5a4a30' });
    R(c, x + 8, y + 8, w - 16, 26, '#f4ecd0');
    for (let i = 0; i <= 20; i++) R(c, x + 12 + i * ((w - 24) / 20), y + 30 - (i % 5 ? 0 : 3), 1, i % 5 ? 3 : 6, '#5a4a30');
    ['531', '900', '1404', 'kHz'].forEach((s, i) => T(c, s, x + 14 + i * ((w - 40) / 3), y + 9, 12, '#5a4a30'));
    const pos = view.idx / Math.max(1, view.rows().length - 1);
    R(c, x + 12 + Math.round(pos * (w - 24)), y + 8, 2, 26, '#d6304a');
    T(c, fitText(c, mine ? `♪ ${songTitle(now)}` : '（ダイヤルをあわせて A で聞く）', w - 16, 12), x + 8, y + 40, 12, '#f4ecd0');
    return;
  }
  box(c, x, y, w, h, 6, d === 'smart' ? '#2a1a2e' : '#e8e8f4', d === 'smart' ? '#0e0610' : '#8a8aa8', { lo: d === 'smart' ? '#1a0e1e' : '#c8c8dc' });
  const ink = d === 'smart' ? '#ffffff' : PC.text, dim = d === 'smart' ? '#c8a8c8' : PC.dim;
  T(c, mine ? '再生中' : audio.muted ? '音がOFF（設定で切りかえ）' : '聞きたい曲をえらんで A', x + 10, y + 7, 12, dim);
  T(c, fitText(c, mine ? songTitle(now) : '―', w - 70, 14), x + 10, y + 24, 14, ink);
  // a level meter that dances while a song is playing
  for (let i = 0; i < 8; i++) {
    const hh = mine && !audio.muted ? 4 + Math.round(Math.abs(Math.sin((t + i * 7) / (5 + i))) * 18) : 3;
    R(c, x + w - 64 + i * 7, y + h - 8 - hh, 5, hh, d === 'smart' ? (i < 5 ? '#ff5d8f' : '#ffd23f') : (i < 5 ? COL.music : '#e07a1f'));
  }
}
export async function musicApp(g) {
  const before = playing();
  const view = panelView(g, {
    title: musicTitle(g), color: COL.music, bg: dev(g) === 'smart' ? '#faf2f6' : undefined, top: 64, rowH: 34,
    hint: 'A:聞く　B:もどる',
    items: () => songList(g).map((s) => ({
      label: s.heard ? songTitle(s.k) : '？？？', sub: s.heard ? null : null, k: s.k,
      right: playing() === s.k && view.started === s.k ? '♪' : '', rightColor: COL.music,
      disabled: !s.heard, why: 'まだ聞いたことがない曲',
    })),
    drawTop(c, a, v, ph) { drawMusicTop(c, a, g, v, ph); },
    pick(ph, it, i, v) {
      if (audio.muted) ph.toast('音がOFFになっている（設定で切りかえ）', COL.music);
      audio.bgm(it.k);
      v.started = it.k;
      s2(g).music.plays++;
    },
  });
  const res = await phoneView(g, view);
  // the place's own music comes back
  if (view.started && before && playing() !== before) audio.bgm(before);
  return res;
}

// ======================================================================== ゲーム（ブロック崩し）
const gameTitle = (g) => (dev(g) === 'techo' ? '電子ゲーム' : 'ゲーム');
const FW = 208, FH = 196; // the play field
const BR_COLS = 8, BR_ROWS = 5, BR_W = 24, BR_H = 8, BR_GAP = 2, BR_TOP = 22;
const PADDLE_W = 36, PADDLE_Y = FH - 14;
function newStage(G) {
  G.bricks = [];
  for (let j = 0; j < BR_ROWS; j++) for (let i = 0; i < BR_COLS; i++) {
    // later stages: harder bricks in the top row
    G.bricks.push({ x: 1 + i * (BR_W + BR_GAP), y: BR_TOP + j * (BR_H + BR_GAP), hp: G.stage >= 2 && j === 0 ? 2 : 1, row: j });
  }
  G.stuck = true;
  G.spd = Math.min(3.6, 2.1 + 0.3 * (G.stage - 1));
}
function newGame() {
  const G = { px: FW / 2, score: 0, lives: 3, stage: 1, over: false, broke: 0, ball: { x: FW / 2, y: PADDLE_Y - 4, vx: 0, vy: 0 }, target: null, flash: 0 };
  newStage(G);
  return G;
}
function launch(G) {
  if (!G.stuck || G.over) return;
  G.stuck = false;
  const a = (-Math.PI / 2) + (Math.random() < 0.5 ? -0.5 : 0.5);
  G.ball.vx = Math.cos(a) * G.spd; G.ball.vy = Math.sin(a) * G.spd;
  audio.sfx('cursor');
}
function stepGame(G, inp) {
  if (G.flash > 0) G.flash--;
  if (G.over) return;
  const sp = 4;
  if (inp.down('left')) { G.px -= sp; G.target = null; }
  if (inp.down('right')) { G.px += sp; G.target = null; }
  if (G.target != null) { const dx = G.target - G.px; G.px += clamp(dx, -sp, sp); if (Math.abs(dx) < 1) G.target = null; }
  G.px = clamp(G.px, PADDLE_W / 2, FW - PADDLE_W / 2);
  const b = G.ball;
  if (G.stuck) { b.x = G.px; b.y = PADDLE_Y - 4; return; }
  for (let s = 0; s < 2; s++) {
    b.x += b.vx / 2; b.y += b.vy / 2;
    if (b.x < 2) { b.x = 2; b.vx = Math.abs(b.vx); }
    if (b.x > FW - 2) { b.x = FW - 2; b.vx = -Math.abs(b.vx); }
    if (b.y < 2) { b.y = 2; b.vy = Math.abs(b.vy); }
    // paddle
    if (b.vy > 0 && b.y + 2 >= PADDLE_Y && b.y - 2 <= PADDLE_Y + 4 && Math.abs(b.x - G.px) <= PADDLE_W / 2 + 2) {
      const k = clamp((b.x - G.px) / (PADDLE_W / 2), -1, 1);
      const ang = -Math.PI / 2 + k * 1.05;
      b.vx = Math.cos(ang) * G.spd; b.vy = Math.sin(ang) * G.spd;
      b.y = PADDLE_Y - 2;
      audio.sfx('drum');
    }
    // bricks
    for (const br of G.bricks) {
      if (br.hp <= 0) continue;
      if (b.x + 2 < br.x || b.x - 2 > br.x + BR_W || b.y + 2 < br.y || b.y - 2 > br.y + BR_H) continue;
      const ox = Math.min(b.x + 2 - br.x, br.x + BR_W - (b.x - 2));
      const oy = Math.min(b.y + 2 - br.y, br.y + BR_H - (b.y - 2));
      if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
      br.hp--;
      if (br.hp <= 0) { G.score += 10 * G.stage + (BR_ROWS - br.row) * 2; G.broke++; audio.sfx('hit'); } else audio.sfx('cursor');
      break;
    }
    if (b.y > FH + 4) {
      G.lives--;
      G.flash = 30;
      audio.sfx('fail');
      if (G.lives <= 0) { G.over = true; return; }
      G.stuck = true;
      return;
    }
  }
  if (G.bricks.every((br) => br.hp <= 0)) {
    G.score += 100 * G.stage;
    G.stage++;
    audio.sfx('success');
    newStage(G);
    G.flash = 40;
  }
}
const GAME_SKIN = {
  techo: { bg: '#a7b48f', field: '#9aab88', ghost: '#93a37f', ink: '#26301e', rows: ['#26301e'], ball: '#26301e', pad: '#26301e', text: '#26301e' },
  keitai: { bg: '#0e1430', field: '#141c40', ghost: null, ink: '#ffffff', rows: ['#ff5d6c', '#ff9a3d', '#ffd23f', '#5ee07a', '#5fd7ff'], ball: '#ffffff', pad: '#c8ccd8', text: '#ffffff' },
  smart: { bg: '#120c26', field: '#1a1236', ghost: null, ink: '#ffffff', rows: ['#ff4f9a', '#b46aff', '#5f8aff', '#3ae0e0', '#5ef0a0'], ball: '#fff8a0', pad: '#ffffff', text: '#ffffff' },
};
function gameView(g) {
  const d = dev(g);
  const K = GAME_SKIN[d];
  const S = s2(g).game;
  return {
    title: 'ブロック崩し', color: COL.game, bg: K.bg, cancel: -1,
    G: newGame(),
    hint() { return this.G.over ? 'A:もう一度　B:おわる' : this.G.stuck ? '←→:うごかす　A:発射　B:おわる' : '←→:うごかす　B:おわる'; },
    finish() {
      const G = this.G;
      if (G.counted) return;
      G.counted = true;
      if (G.score <= 0 && !G.broke) return;
      S.plays++;
      if (G.score > S.best) S.best = G.score;
      if (G.stage - 1 > S.bestStage) S.bestStage = G.stage - 1;
    },
    relax(ph) {
      if (S.relaxDay === g.state.day || !this.G.broke) return;
      S.relaxDay = g.state.day;
      const before = num(g.state.life && g.state.life.stress);
      g.relax({ stress: 5 });
      const dd = Math.round(before - num(g.state.life && g.state.life.stress));
      if (dd > 0) ph.toast(`いい気分転換！ストレス -${dd}`, COL.game);
    },
    update(ph, inp) {
      const G = this.G;
      if (inp.pressed('b')) { audio.sfx('cancel'); this.finish(); this.relax(ph); ph.back(-1); return; }
      if (G.over) {
        if (!G.counted) { this.finish(); this.relax(ph); }
        if (inp.pressed('a')) { audio.sfx('ok'); this.G = newGame(); }
        return;
      }
      if (inp.pressed('a')) launch(G);
      stepGame(G, inp);
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      const G = this.G;
      if (G.over) return true; // A: もう一度
      G.target = clamp(x - this.fx, 0, FW);
      launch(G);
      return false;
    },
    draw(c, ph, a) {
      this.area = a;
      const G = this.G;
      const fx = a.x + Math.round((a.w - FW) / 2), fy = a.y + 18;
      this.fx = fx;
      // the score line
      T(c, `SCORE ${String(G.score).padStart(5, '0')}`, a.x + 8, a.y + 2, 12, K.text);
      T(c, `HI ${String(Math.max(S.best, G.score)).padStart(5, '0')}`, a.x + a.w - 8, a.y + 2, 12, K.text, 'right');
      R(c, fx - 1, fy - 1, FW + 2, FH + 2, d === 'techo' ? '#6a7a5a' : shade(K.field, 0.25));
      R(c, fx, fy, FW, FH, K.field);
      if (d === 'smart') for (let i = 0; i < FH; i += 6) R(c, fx, fy + i, FW, 1, '#1e1640');
      // lives and stage
      for (let i = 0; i < G.lives; i++) R(c, fx + 4 + i * 8, fy + 4, 5, 3, K.pad);
      T(c, `STAGE ${G.stage}`, fx + FW - 4, fy + 2, 12, d === 'techo' ? K.ink : '#c8ccf0', 'right');
      // bricks (the LCD shows the unlit segments faintly)
      for (const br of G.bricks) {
        const bx = fx + br.x, by = fy + br.y;
        if (br.hp <= 0) { if (K.ghost) R(c, bx, by, BR_W, BR_H, K.ghost); continue; }
        const col = K.rows[br.row % K.rows.length];
        R(c, bx, by, BR_W, BR_H, col);
        if (d !== 'techo') { R(c, bx, by, BR_W, 1, shade(col, 0.45)); R(c, bx, by + BR_H - 1, BR_W, 1, shade(col, -0.35)); }
        if (br.hp > 1) R(c, bx + 3, by + 3, BR_W - 6, 2, d === 'techo' ? K.field : '#ffffff');
      }
      // paddle and ball
      const px = Math.round(fx + G.px - PADDLE_W / 2);
      R(c, px, fy + PADDLE_Y, PADDLE_W, 4, K.pad);
      if (d !== 'techo') R(c, px, fy + PADDLE_Y, PADDLE_W, 1, '#ffffff');
      const b = G.ball;
      if (!G.over && !(G.flash && G.stuck && G.flash % 8 < 4)) R(c, fx + Math.round(b.x) - 2, fy + Math.round(b.y) - 2, 4, 4, K.ball);
      if (G.over || (G.stuck && G.flash)) {
        const msg = G.over ? 'GAME OVER' : G.lives < 3 && G.broke ? 'ミス！' : `STAGE ${G.stage}`;
        const w = 156;
        rrect(c, fx + FW / 2 - w / 2, fy + 110, w, 40, 6, d === 'techo' ? '#26301e' : 'rgba(0,0,0,0.75)');
        T(c, msg, fx + FW / 2, fy + 116, 14, d === 'techo' ? '#a7b48f' : '#ffffff', 'center');
        if (G.over) T(c, fitText(c, `${G.score}点${G.score >= S.best && G.score > 0 ? '　ハイスコア！' : ''}`, w - 8, 12), fx + FW / 2, fy + 133, 12, d === 'techo' ? '#a7b48f' : '#ffd23f', 'center');
      }
    },
  };
}
export async function gameApp(g) { return phoneView(g, gameView(g)); }

// ======================================================================== 図鑑
const ZUKAN_TABS = [['items', 'もの'], ['furniture', '家具'], ['titles', '称号'], ['programs', '番組'], ['places', '場所']];
function zukanRows(g, tab) {
  const st = g.state;
  if (tab === 'items') {
    const seen = s2(g).items.seen;
    for (const k of Object.keys(st.items || {})) if (ITEMS[k] && num(st.items[k]) > 0) seen[k] = 1;
    return Object.keys(ITEMS).filter((k) => ITEMS[k] && ITEMS[k].name)
      .sort((a, b) => (!!seen[b] - !!seen[a]) || 0)
      .map((k) => (seen[k] ? { label: ITEMS[k].name, sub: String(ITEMS[k].desc || '').split('\n')[0], right: (st.items[k] || 0) > 0 ? `×${st.items[k]}` : '', rightColor: PC.good, desc: ITEMS[k].desc } : { label: '？？？', sub: 'まだ手にしたことがない', disabled: true, why: 'まだ手にしたことがない' }));
  }
  if (tab === 'furniture') {
    const ids = (EXT.housing && Array.isArray(EXT.housing.FURNITURE_ORDER) ? EXT.housing.FURNITURE_ORDER : Object.keys(FURNITURE)).filter((id) => FURNITURE[id]);
    return ids.map((id) => { const f = FURNITURE[id]; const have = !!(st.furniture && st.furniture[id]); return { label: f.name, sub: f.perk || String(f.desc || '').split('\n')[0], right: have ? '持っている' : fmtMoney(f.price), rightColor: have ? PC.good : PC.dim, desc: f.desc }; });
  }
  if (tab === 'titles') {
    const best = Math.max(rankIndex(st.fame), num(st.stats && st.stats.bestRank, 0));
    return RANKS.map(([min, name], i) => (i <= best ? { label: name, sub: `知名度★${commas(min)}〜`, right: i === rankIndex(st.fame) ? 'いま' : '達成', rightColor: i === rankIndex(st.fame) ? PC.accent : PC.good } : { label: i === best + 1 ? name : '？？？', sub: `知名度★${commas(min)}〜`, disabled: true, why: `知名度★${commas(min)}で手に入る` }));
  }
  if (tab === 'programs') {
    const P = EXT.programs;
    if (!P || !Array.isArray(P.PROGRAM_LIST)) return [];
    const era = P.eraKey(st);
    const list = P.PROGRAM_LIST.filter((p) => Array.isArray(p.eras) && p.eras.includes(era));
    return list.map((p) => {
      const n = num(st.jobs && st.jobs['prog_' + p.id]);
      const stn = (P.STATIONS && p.station && P.STATIONS[p.station] && P.STATIONS[p.station].name) || (p.local && p.local.channel) || '';
      return n > 0 ? { label: p.title, sub: `${stn}${p.genre ? `・${p.genre}` : ''}`, right: `${n}回`, rightColor: PC.good, desc: p.desc } : { label: p.title, sub: `${stn}・まだ出ていない`, subColor: PC.dim, right: '', disabled: true, why: 'まだ出演していない番組' };
    });
  }
  if (tab === 'places') {
    const vis = (st.flags && st.flags.visited) || {};
    return Object.keys(PLACES).filter((id) => PLACES[id] && !PLACES[id].hidden)
      .map((id) => ({ id, v: !!vis[id] }))
      .sort((a, b) => b.v - a.v)
      .map(({ id, v }) => (v ? { label: placeLabel(id), sub: '行ったことがある', right: '', id } : { label: '？？？', sub: 'まだ行っていない', disabled: true, why: 'まだ行ったことのない場所' }));
  }
  return [];
}
function zukanCount(g, tab) {
  const rows = zukanRows(g, tab);
  const n = tab === 'furniture' ? rows.filter((r) => r.right === '持っている').length : rows.filter((r) => !r.disabled).length;
  return `${n}/${rows.length}`;
}
export async function zukanApp(g) {
  s2(g);
  return phoneView(g, tabbedView(g, {
    title: '図鑑', color: COL.zukan, bg: '#f4f6ee', rowH: 36, tabs: ZUKAN_TABS,
    headerRight: (tab) => zukanCount(g, tab),
    items: (tab) => zukanRows(g, tab),
    pick(ph, it, i, v) {
      if (it.desc) ph.run(v, () => phoneInfo(g, { title: it.label, color: COL.zukan, text: String(it.desc) }));
      else if (it.id) ph.run(v, () => travelTo(g, it.id));
    },
  }));
}

// ======================================================================== 実績
// Read from the stats the game already keeps. cur(g) → number, goal.
const friends = (g, min) => Object.keys(g.state.people || {}).filter((id) => PEOPLE[id] && num(g.state.people[id].aff) >= min).length;
const progAppeared = (g) => Object.keys(g.state.jobs || {}).filter((k) => /^prog_/.test(k) && num(g.state.jobs[k]) > 0).length;
const visitedN = (g) => Object.keys((g.state.flags && g.state.flags.visited) || {}).filter((k) => PLACES[k]).length;
const A = (id, name, desc, cur, goal) => ({ id, name, desc, cur, goal });
export const ACHIEVEMENTS = [
  A('job1', 'はじめてのお仕事', 'お仕事を1回する', (g) => num(g.state.stats && g.state.stats.jobs), 1),
  A('job30', '働きもの', 'お仕事を30回する', (g) => num(g.state.stats && g.state.stats.jobs), 30),
  A('job150', '仕事の鬼', 'お仕事を150回する', (g) => num(g.state.stats && g.state.stats.jobs), 150),
  A('rankS', 'Sランク！', 'ミニゲームでSランクをとる', (g) => (Object.values((g.state.stats && g.state.stats.bestRanks) || {}).includes('S') ? 1 : 0), 1),
  A('agency', '所属タレント', '事務所に所属する', (g) => (g.state.agency ? 1 : 0), 1),
  A('fame100', '若手', '知名度★100', (g) => g.state.fame, 100),
  A('fame500', '人気者', '知名度★500', (g) => g.state.fame, 500),
  A('fame2000', 'スター', '知名度★2,000', (g) => g.state.fame, 2000),
  A('fame4000', '国民的スター', '知名度★4,000', (g) => g.state.fame, 4000),
  A('fame12000', '大御所', '知名度★12,000', (g) => g.state.fame, 12000),
  A('fans1k', 'ファン1,000人', 'ファンが1,000人', (g) => num(g.state.fans), 1000),
  A('fans10k', 'ファン1万人', 'ファンが10,000人', (g) => num(g.state.fans), 10000),
  A('fans100k', 'ファン10万人', 'ファンが100,000人', (g) => num(g.state.fans), 100000),
  A('regular', 'レギュラー出演', 'レギュラー番組に出る', (g) => (Object.keys(g.state.regulars || {}).some((id) => num(g.state.regulars[id] && g.state.regulars[id].count) > 0) ? 1 : 0), 1),
  A('prog1', 'テレビデビュー', '本物の番組に出る', progAppeared, 1),
  A('prog5', '番組をはしご', '5つの番組に出る', progAppeared, 5),
  A('friend', '友だちができた', 'だれかと「友だち」になる', (g) => friends(g, HEARTS[2][0]), 1),
  A('friends5', '顔が広い', '5人と「友だち」以上になる', (g) => friends(g, HEARTS[2][0]), 5),
  A('shinyu', '親友', 'だれかと「親友」になる', (g) => friends(g, HEARTS[4][0]), 1),
  A('cook1', 'はじめての自炊', '家で料理をする', (g) => num(g.flag('cook_count')), 1),
  A('cook30', '家庭料理の達人', '料理を30品つくる', (g) => num(g.flag('cook_count')), 30),
  A('places10', '町を歩く', '10か所に行く', visitedN, 10),
  A('places25', '東京・大阪通', '25か所に行く', visitedN, 25),
  A('steps', 'よく歩いた', `1日に${commas(STEP_GOAL)}歩あるく`, (g) => s2(g).health.best, STEP_GOAL),
  A('photo', 'はい、チーズ', '写真を1枚とる', (g) => num(appState(g).stats.photos), 1),
  A('savings', 'コツコツ貯金', '預金が10万円をこえる', (g) => bankBalance(g), 100000),
  A('rich', 'お金持ち', '現金と預金で100万円', (g) => num(g.state.money) + bankBalance(g), 1000000),
  A('furniture', '部屋づくり', '家具を3つそろえる', (g) => Object.keys(g.state.furniture || {}).filter((k) => g.state.furniture[k]).length, 3),
  A('days30', '1か月', '30日目をむかえる', (g) => g.state.day, 30),
  A('days120', '1年', '120日目（1年）をむかえる', (g) => g.state.day, 120),
  A('game', 'ゲーマー', `${'ブロック崩し'}で500点`, (g) => s2(g).game.best, 500),
];
// Records what is newly reached (the day), returns the list of new names.
export function checkAchievements(g) {
  const got = s2(g).ach.got;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    let v = 0;
    try { v = num(a.cur(g)); } catch (e) { v = 0; }
    if (v >= a.goal) { got[a.id] = g.state.day || 1; fresh.push(a.name); }
  }
  return fresh;
}
const achCheck = perFrame((g) => { checkAchievements(g); return Object.keys(s2(g).ach.got).length; });
const achNew = (g) => Math.max(0, achCheck(g) - s2(g).ach.seen);
const jissekiTitle = (g) => (dev(g) === 'techo' ? 'スタンプ帳' : '実績');
function jissekiRows(g) {
  const got = s2(g).ach.got;
  return ACHIEVEMENTS.map((a) => {
    let v = 0;
    try { v = num(a.cur(g)); } catch (e) { v = 0; }
    const done = !!got[a.id];
    const money = /savings|rich/.test(a.id);
    const prog = money ? `${Math.floor(clamp(v / a.goal, 0, 1) * 100)}%` : `${commas(Math.min(v, a.goal))}/${commas(a.goal)}`;
    return { a, done, label: a.name, sub: done ? `${a.desc}・${got[a.id]}日目に達成` : a.desc, right: done ? '達成' : a.goal === 1 ? 'まだ' : prog, rightColor: done ? PC.good : PC.dim, frac: done ? 1 : clamp(v / a.goal, 0, 1) };
  });
}
function drawJissekiRow(g) {
  const techo = dev(g) === 'techo';
  return (c, it, x, y, w, rh, sel) => {
    // a stamp (手帳) or a medal
    if (techo) {
      disc(c, x + 20, y + rh / 2, 11, it.done ? '#d6304a' : '#e4dcc8');
      disc(c, x + 20, y + rh / 2, 9, it.done ? '#fbf6e4' : '#efe8d6');
      if (it.done) { disc(c, x + 20, y + rh / 2, 6, '#d6304a'); R(c, x + 17, y + rh / 2 - 1, 7, 2, '#fbf6e4'); }
    } else {
      disc(c, x + 20, y + rh / 2, 11, it.done ? '#b8901a' : '#d8d2c4');
      disc(c, x + 20, y + rh / 2, 9, it.done ? '#ffd23f' : '#ece6d8');
      if (it.done) art(c, x + 17, y + rh / 2 - 3, STAR, { '#': '#ffffff' });
    }
    const col = it.done ? (sel ? '#1a1a28' : PC.text) : PC.dim;
    const rw = Math.ceil(measure(c, it.right, 12)) + 12;
    T(c, fitText(c, it.label, w - 44 - rw, 14), x + 38, y + 3, 14, col);
    T(c, fitText(c, it.sub, w - 48, 12), x + 38, y + 21, 12, PC.dim);
    T(c, it.right, x + w - 8, y + 5, 12, it.rightColor, 'right');
    if (!it.done) bar(c, x + w - rw + 2, y + 18, rw - 10, 3, it.frac, COL.jisseki);
  };
}
export async function jissekiApp(g) {
  checkAchievements(g);
  const S = s2(g).ach;
  const view = panelView(g, {
    title: jissekiTitle(g), color: COL.jisseki, bg: dev(g) === 'techo' ? '#f6f0dc' : '#f8f4ea', rowH: 38, top: 40,
    hint: 'B:もどる',
    items: () => jissekiRows(g),
    drawRow: drawJissekiRow(g),
    drawTop(c, a) {
      const n = Object.keys(S.got).length;
      box(c, a.x + 8, a.y + 4, a.w - 16, a.h - 8, 6, '#fff8e0', '#e0c070', { lo: '#f0e0b0' });
      T(c, `達成 ${n}／${ACHIEVEMENTS.length}`, a.x + 16, a.y + 11, 14, PC.text);
      bar(c, a.x + 110, a.y + 16, a.w - 134, 6, n / ACHIEVEMENTS.length, COL.jisseki);
    },
    pick() {},
  });
  const res = phoneView(g, view);
  S.seen = Object.keys(S.got).length;
  return res;
}

// ======================================================================== 電卓
// 消費税: the politics core's rate when there is one (it may be changed by law in the game),
// else the real history by game date.
const TAX_STEPS = [[1989, 4, 3], [1997, 4, 5], [2014, 4, 8], [2019, 10, 10]];
export function shohiNow(g) {
  try {
    const p = g.state.politics;
    if (p && p.economy && Number.isFinite(Number(p.economy.taxRate))) return Number(p.economy.taxRate);
  } catch (e) { /* fall back */ }
  const d = gameDate(g);
  try { if (EXT.govt && typeof EXT.govt.taxRateAt === 'function') { const r = EXT.govt.taxRateAt('shohi', d.year, d.month); if (Number.isFinite(Number(r))) return Number(r); } } catch (e) { /* fall back */ }
  let r = 0;
  for (const [y, m, v] of TAX_STEPS) if (d.year * 100 + d.month >= y * 100 + m) r = v;
  return r;
}
const KEYS = [['C', '税込', '÷', '×'], ['7', '8', '9', '−'], ['4', '5', '6', '+'], ['1', '2', '3', '='], ['0', '00', '.', '←']];
function fmtCalc(v) {
  if (!Number.isFinite(v)) return 'E';
  if (Math.abs(v) >= 1e10) return 'E';
  const r = Math.round(v * 1e6) / 1e6;
  const [i, f] = String(Math.abs(r)).split('.');
  return (r < 0 ? '-' : '') + Number(i).toLocaleString('ja-JP') + (f ? '.' + f.slice(0, Math.max(0, 9 - i.length)) : '');
}
function calcView(g) {
  const d = dev(g);
  return {
    title: '電卓', color: COL.dentaku, bg: d === 'techo' ? '#d8d0bc' : d === 'smart' ? '#1a1c24' : '#c8ccd8', cancel: -1,
    cur: '0', acc: null, op: null, fresh: true, note: '', kx: 0, ky: 1,
    hint: '↑↓←→:キー　A:おす　B:もどる',
    value() { return Number(this.cur) || 0; },
    apply() {
      if (this.op == null || this.acc == null) return this.value();
      const a = this.acc, b = this.value();
      return this.op === '+' ? a + b : this.op === '−' ? a - b : this.op === '×' ? a * b : b === 0 ? NaN : a / b;
    },
    press(k) {
      this.note = '';
      if (/^[0-9]$/.test(k) || k === '00') {
        if (this.fresh || this.cur === '0') this.cur = k === '00' ? '0' : k; else if (this.cur.replace(/[^0-9]/g, '').length < 10) this.cur += k;
        this.fresh = false; return;
      }
      if (k === '.') { if (this.fresh) { this.cur = '0.'; this.fresh = false; } else if (!this.cur.includes('.')) this.cur += '.'; return; }
      if (k === 'C') { this.cur = '0'; this.acc = null; this.op = null; this.fresh = true; return; }
      if (k === '←') { if (!this.fresh) { this.cur = this.cur.length > 1 ? this.cur.slice(0, -1) : '0'; } return; }
      if (k === '税込') {
        const r = shohiNow(g);
        const v = this.apply();
        this.acc = null; this.op = null; this.fresh = true;
        if (r <= 0) { this.cur = String(v); this.note = '消費税はまだない（89年4月〜）'; return; }
        this.cur = String(Math.floor(v * (1 + r / 100) + 1e-9));
        this.note = `税込（消費税${r}%）`;
        return;
      }
      if (k === '=') { const v = this.apply(); this.cur = Number.isFinite(v) ? String(Math.round(v * 1e8) / 1e8) : 'E'; this.acc = null; this.op = null; this.fresh = true; return; }
      // + − × ÷
      if (!this.fresh || this.acc == null) { const v = this.apply(); this.acc = Number.isFinite(v) ? v : 0; }
      this.op = k; this.fresh = true;
    },
    update(ph, inp) {
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); return; }
      const bx = this.kx, by = this.ky;
      if (inp.repeat('left')) this.kx = (this.kx + 3) % 4;
      if (inp.repeat('right')) this.kx = (this.kx + 1) % 4;
      if (inp.repeat('up')) this.ky = (this.ky + 4) % 5;
      if (inp.repeat('down')) this.ky = (this.ky + 1) % 5;
      if (bx !== this.kx || by !== this.ky) audio.sfx('cursor');
      if (inp.pressed('a')) { audio.sfx('talk'); this.press(KEYS[this.ky][this.kx]); this.flash = 6; }
      if (this.flash > 0) this.flash--;
    },
    keyRect(a, i, j) {
      const kw = Math.floor((a.w - 20) / 4), kh = 30;
      return { x: a.x + 8 + i * (kw + 1), y: a.y + 64 + j * (kh + 3), w: kw - 2, h: kh };
    },
    tap(ph, x, y) {
      const a = this.area;
      if (!a) return false;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) {
        const r = this.keyRect(a, i, j);
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) { this.kx = i; this.ky = j; return true; }
      }
      return false;
    },
    draw(c, ph, a) {
      this.area = a;
      // the display
      const lcd = d === 'smart' ? { bg: '#1a1c24', ink: '#ffffff', edge: '#1a1c24' } : { bg: '#a8b890', ink: '#1e2a1a', edge: '#5a6a4a' };
      box(c, a.x + 8, a.y + 6, a.w - 16, 52, 4, lcd.bg, lcd.edge, {});
      const s = this.cur === 'E' ? 'E' : fmtCalc(Number(this.cur)) + (this.cur.endsWith('.') ? '.' : '');
      text(c, fitText(c, s, a.w - 32, 20), a.x + a.w - 16, a.y + 24, { size: 20, align: 'right', color: lcd.ink, shadow: null });
      const top = this.note || (this.op && this.acc != null ? `${fmtCalc(this.acc)} ${this.op}` : d === 'techo' ? 'カード電卓' : '');
      T(c, fitText(c, top, a.w - 32, 12), a.x + 16, a.y + 9, 12, d === 'smart' ? '#a8acc0' : '#3a4a2a');
      // the keys
      KEYS.forEach((row, j) => row.forEach((k, i) => {
        const r = this.keyRect(a, i, j);
        const sel = i === this.kx && j === this.ky;
        const op = i === 3 || k === '=';
        const fn = k === 'C' || k === '税込';
        let col = d === 'smart' ? (op ? '#ff9f0a' : fn ? '#a5a5a5' : '#333640') : d === 'techo' ? (op ? '#5a5a6a' : fn ? '#c0392b' : '#3a3a42') : (op ? '#e07a1f' : fn ? '#4a78d8' : '#f4f4f8');
        if (sel && this.flash) col = shade(col, 0.35);
        box(c, r.x, r.y, r.w, r.h, d === 'smart' ? 12 : 4, col, sel ? '#ffd23f' : shade(col, -0.45), { lo: shade(col, -0.15) });
        if (sel) { R(c, r.x - 1, r.y - 1, r.w + 2, 1, '#ffd23f'); R(c, r.x - 1, r.y + r.h, r.w + 2, 1, '#ffd23f'); }
        const ink = d === 'keitai' && !op && !fn ? PC.text : d === 'smart' && fn ? '#000000' : '#ffffff';
        T(c, k, r.x + r.w / 2, r.y + (k.length > 1 ? 9 : 7), k.length > 1 ? 12 : 14, ink, 'center');
      }));
    },
  };
}
export async function dentakuApp(g) { return phoneView(g, calcView(g)); }

// ======================================================================== registration
registerPhoneApp('kakeibo', { name: '家計簿', color: COL.kakeibo, order: 41, iconHD: iconKakeibo, open: (g) => kakeiboApp(g) });
registerPhoneApp('kenko', { name: (g) => kenkoTitle(g), color: COL.kenko, order: 70, iconHD: iconKenko, open: (g) => kenkoApp(g) });
registerPhoneApp('recipe', { name: (g) => recipeTitle(g), color: COL.recipe, order: 71, iconHD: iconRecipe, open: (g) => recipeApp(g) });
registerPhoneApp('uranai', { name: '占い', color: COL.uranai, order: 72, iconHD: iconUranai, badge: (g) => fortuneNew(g), open: (g) => uranaiApp(g) });
registerPhoneApp('music', { name: (g) => musicTitle(g), color: COL.music, order: 73, iconHD: iconMusic, open: (g) => musicApp(g) });
registerPhoneApp('game', { name: (g) => gameTitle(g), color: COL.game, order: 74, iconHD: iconGame, open: (g) => gameApp(g) });
registerPhoneApp('zukan', { name: '図鑑', color: COL.zukan, order: 75, iconHD: iconZukan, open: (g) => zukanApp(g) });
registerPhoneApp('jisseki', { name: (g) => jissekiTitle(g), color: COL.jisseki, order: 76, iconHD: iconJisseki, badge: (g) => achNew(g), open: (g) => jissekiApp(g) });
registerPhoneApp('dentaku', { name: '電卓', color: COL.dentaku, order: 80, iconHD: iconDentaku, open: (g) => dentakuApp(g) });

onMorning((g) => {
  try { rollSteps(g); } catch (e) { console.error(e); }
  try { moneySnapshot(g); } catch (e) { console.error(e); }
  try { checkAchievements(g); } catch (e) { console.error(e); }
});
