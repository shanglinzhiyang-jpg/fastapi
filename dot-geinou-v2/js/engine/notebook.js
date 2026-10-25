// てちょう（メニュー → てちょう）: a notebook with ten tabs in two groups (HD scene, 640x360), styled by era
// (昭和 革の手帳 / 平成 システム手帳 / 令和 デジタル: notebook_look.js). The comedy pages お笑い・賞レース・ネタ帳・
// カレンダー and the お笑いの道 goals are in notebook_pages.js (API: test-output/api_notebook.txt). The older six:
//
//   もくひょう  today's numbers, what needs attention and a concrete next goal
//   せいかつ    the day of the week, needs with advice, housing and rent, this week's
//               regular shows, friends (hearts) and fans
//   くらしと法  the justice state (js/engine/crime.js): 前科, 執行猶予・保護観察, 公民権停止,
//               open cases, loans (消費者金融・闇金) with warnings, 自己破産, smoking / drinking
//               (20歳から) and where to get help
//   政治        the politics state (js/engine/politics.js): office, party, eligibility, the
//               next elections, the Diet session and the player's bills, the cabinet,
//               party support, the economy and political money (裏金 warning)
//   ばしょ      places the player has been to (state.flags.visited, set by g.goto)
//               with a short guide from js/world/guide.js; others are 「？？？」 + a hint
//   きろく      the profile (name, age, hometown, personality, era) and family, days, jobs,
//               minigames and their best ranks, title, agency
//
// The two cores are read only through their g.* methods (g.pol / g.politicsSummary / g.jus /
// g.justiceStatus …), each call guarded: a save from before them simply gets their defaults.
// Controls: ←→ tabs, ↑↓ scroll, A next page, B / MENU close. Everything is wrapped
// to the page, so long text never runs off it. The life registries (PEOPLE,
// REGULARS, HOUSING) are read when the notebook opens and may be empty.

import { SW, SH, fmtMoney, yenText, clamp, shade, YEN_MARK } from './util.js';
import { text, wrap, panel, measure, rect, downArrow, COLORS } from './draw.js';
import { audio } from './audio.js';
import { SKILLS, AGENCIES, RANKS, FINALE_FAME, CAREER, rankIndex, rankName, nextRank as nextTitle } from './state.js';
import { MINIGAMES } from './minigame.js';
import { eraOf, fullName, ageOf, prefecture, regionOf, GENDERS, PERSONALITIES, RELATIONS, CAUSES, isBirthday, daysToBirthday, personalityEffects, sortFamily, YEAR_DAYS } from './profile.js';
import { GUIDE, GUIDE_ORDER, TOWNS, AUDITIONS, GUIDE_JOBS, TIER_FAME, jobOpen } from '../world/guide.js';
import { PEOPLE, HEARTS, heartIndex, REGULARS, FURNITURE, WEEKDAYS, weekdayOf, weekOf, HUNGRY, STRESSED, SCRUFFY, BURNOUT, FULL, showWords, PHONE_APPS } from './life.js';
// The two cores' exports, read at run time. Loaded optionally (main.js installs them; a
// static import here would let a broken core take the whole game down through ui.js):
// until they arrive, or if one fails, every read below falls back (POL.OFFICES || {} …).
let POL = {};
let JUS = {};
import('./politics.js').then((m) => { POL = m; }).catch(() => { /* politics left out */ });
import('./crime.js').then((m) => { JUS = m; }).catch(() => { /* justice left out */ });
import { PLACES } from './map.js'; // (also a cycle through ui.js: read only at run time)
import { themeFor, ink as inkOf, drawBackdrop, drawPaperPart, pageTurnEdge, icon } from './notebook_look.js';
import { owaraiPage, contestPage, netaPage, calendarPage, comedyNotes, comedyLadder } from './notebook_pages.js';

// Ten tabs in two groups of five (desktop: an index down the right edge of the page; touch: a
// 70-unit bar showing one group, with a group switch and the ×). ←→ go through all ten.
const TABS = [
  { id: 'goal', label: 'もくひょう', color: '#ff8a3d', build: (g, ctx) => goalPage(g, ctx) },
  { id: 'life', label: 'せいかつ', color: '#e2569a', build: (g, ctx) => lifePage(g, ctx) },
  { id: 'cal', label: 'カレンダー', color: '#2fa89a', build: (g, ctx, sc) => calendarPage(g, ctx, KIT, sc ? sc.month : 0) },
  { id: 'owarai', label: 'お笑い', color: '#e0a020', build: (g, ctx) => owaraiPage(g, ctx, KIT) },
  { id: 'contest', label: '賞レース', color: '#d83a3a', build: (g, ctx) => contestPage(g, ctx, KIT) },
  { id: 'neta', label: 'ネタ帳', color: '#5a72d8', build: (g, ctx) => netaPage(g, ctx, KIT) },
  { id: 'law', label: 'くらしと法', color: '#c8743a', build: (g, ctx) => lawPage(g, ctx) },
  { id: 'politics', label: '政治', color: '#8a6ad8', build: (g, ctx) => politicsPage(g, ctx) },
  { id: 'places', label: 'ばしょ', color: '#3fb85f', build: (g, ctx) => placesPage(g, ctx) },
  { id: 'record', label: 'きろく', color: '#3a9fd8', build: (g, ctx) => recordPage(g, ctx) },
];
const GROUP = 5; // tabs per group
const TC = Object.fromEntries(TABS.map((t) => [t.id, t.color]));
const TOWN_BG = { tokyo: '#2f5fb8', namba: '#c23a3a', nagatacho: '#4a5a7a', kanraku: '#a0368a' };
const RANK_COLOR = { S: COLORS.accent, A: COLORS.pink, B: COLORS.cyan, C: COLORS.text, D: COLORS.dim };
const MG_ORDER = ['tsukkomi', 'zukko', 'rhythm', 'command', 'quiz', 'announce', 'talk'];

// text sizes and line heights (screen pixels)
const BODY = 16, SMALL = 13;
const LH = { [BODY]: 21, [SMALL]: 18 };

// layout: set by applyLayout() for desktop or touch (body.touch). The page builders wrap to VW
// and page by VH, so the pages are rebuilt when the layout changes.
const isTouch = () => typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch');
const TB = 70; // touch: the tab bar and the × cell (as the 芸人手帳)
const IDX = { x: 546, y: 14, w: 90, h: 30, gap: 2, groupGap: 10 }; // desktop: the side index
const LAYOUTS = {
  desk: { id: 'desk', page: { x: 8, y: 8, w: 540, h: 344 }, vx: 34, vy: 52, vw: 482, vh: 272, foot: true, head: { size: 18, y: 12, icon: 2 } },
  touch: { id: 'touch', page: { x: 4, y: TB + 4, w: SW - 8, h: SH - TB - 7 }, vx: 30, vy: TB + 34, vw: 572, vh: SH - TB - 7 - 30 - 6, foot: false, head: { size: 15, y: 7, icon: 1 } },
};
let LAYOUT = LAYOUTS.desk;
let PX, PY, PW, PH, VX, VY, VW, VH, SB_X;
function applyLayout(touch) {
  LAYOUT = touch ? LAYOUTS.touch : LAYOUTS.desk;
  ({ x: PX, y: PY, w: PW, h: PH } = LAYOUT.page);
  VX = LAYOUT.vx; VY = LAYOUT.vy; VW = LAYOUT.vw; VH = LAYOUT.vh;
  SB_X = VX + VW + 10;
}
applyLayout(false);
const GAUGE_X = 132, GAUGE_W = 210; // need gauges (x relative to VX)
const HEART_X = 236; // friends' hearts (x relative to VX)
const HEART_N = Math.max(1, Math.min(6, HEARTS.length - 1)); // one heart per level above 知り合い

let lastTab = 0; // reopen on the tab the player looked at last

// Era words for the page texts (set when the notebook opens): the phone is 手帳 / ケータイ /
// スマホ, the SNS ブログ etc., and literal prices follow the era (util.js yenText).
let ERA = eraOf(null);
const eraText = (t) => {
  let s = String(t ?? '');
  if (ERA.deviceShort !== 'スマホ') s = s.replaceAll('スマホ', ERA.deviceShort);
  if (ERA.sns !== 'ドッター') s = s.replaceAll('ドッター', ERA.sns);
  return yenText(s);
};

const NO_LINE_START = /^[、。，．）」』】〕〉》？！]/;

// ---------------------------------------------------------------- content builder
// A page is a list of blocks (scroll unit); a block is a list of lines.
// line: { t, s: BODY|SMALL, c, x, h, r, rs, rc, tag: { t, bg }, badge: { t, c }, mark,
//         head: color, gauge: { frac, color }, hearts: level, draw: (ctx, x, y, D) => {} (custom; D = drawKit) }
class Page {
  constructor(ctx) { this.ctx = ctx; this.blocks = []; this.b = null; }

  // opts.sticky: 'note' (a yellow sticky note behind the block) | 'bad' (a pink one) | null
  block(gap = 8, opts = {}) { this.b = { lines: [], h: 0, gap, sticky: opts.sticky || null }; this.blocks.push(this.b); return this; }

  line(l) {
    if (!this.b) this.block();
    if (l.t) l.t = eraText(l.t);
    if (l.r) l.r = eraText(l.r);
    l.s = l.s || BODY;
    l.h = l.h || LH[l.s] || 21;
    this.b.lines.push(l);
    this.b.h += l.h;
    return this;
  }

  head(t, c = COLORS.cyan) { return this.line({ t, c, h: 26, head: c }); }

  // wrapped paragraph
  para(t, { c = COLORS.text, s = BODY, x = 0, mark } = {}) {
    t = eraText(t);
    // wrap() hangs one closing mark past the edge; with two in a row (「…号）。」) the second
    // would start a line on its own, so wrap a little narrower until no line starts with one
    let lines = wrap(this.ctx, t, VW - x, s);
    for (let k = 1; k <= 3 && lines.some((ln, i) => i && NO_LINE_START.test(ln)); k++) lines = wrap(this.ctx, t, VW - x - k * s, s);
    // no last line of one or two characters (「…回復しな／い。」): wrap a little narrower
    const widow = (ls) => ls.length > 1 && Array.from(ls[ls.length - 1]).length <= 2;
    for (let k = 1; k <= 3 && widow(lines); k++) {
      const alt = wrap(this.ctx, t, VW - x - k * s, s);
      if (alt.length === lines.length && !alt.some((ln, i) => i && NO_LINE_START.test(ln))) lines = alt;
    }
    for (const ln of lines) this.line({ t: ln, c, s, x, mark });
    return this;
  }

  // left text (optionally after a small tag) with right-aligned text; falls back to
  // two lines when both do not fit side by side
  row(t, r, { c = COLORS.text, s = BODY, x = 0, rc = COLORS.text, rs = s, tag, mark, gauge, hearts } = {}) {
    t = eraText(t);
    if (r) r = eraText(r);
    const tagW = tag ? measure(this.ctx, tag.t, 12) + 12 : 0;
    const lw = tagW + measure(this.ctx, t, s);
    const rw = r ? measure(this.ctx, r, rs) : 0;
    const extra = gauge ? GAUGE_W + 16 : hearts != null ? HEART_N * 16 + 16 : 0;
    if (!r || x + lw + rw + extra + 14 <= VW) return this.line({ t, s, c, x, r, rs, rc, tag, mark, gauge, hearts });
    const lines = wrap(this.ctx, t, VW - x - tagW, s);
    lines.forEach((ln, i) => this.line({ t: ln, s, c, x: i ? x + tagW : x, tag: i ? null : tag, mark }));
    return this.line({ t: '', s: rs, r, rs, rc, mark, gauge, hearts });
  }

  // Scroll stops (pixel offsets): every block start up to the last stop, from which the
  // rest of the page fits. A block taller than the view gets extra stops, so no line is
  // ever skipped.
  get stops() {
    if (this._stops) return this._stops;
    const tops = [];
    const starts = [];
    let y = 0;
    for (const b of this.blocks) {
      starts.push(y);
      for (const l of b.lines) { tops.push({ y, h: l.h }); y += l.h; }
      y += b.gap;
    }
    const total = tops.length ? tops[tops.length - 1].y + tops[tops.length - 1].h : 0;
    this.lineTops = tops;
    if (total <= VH) return (this._stops = [0]);
    // the last stop: a block start when that leaves only a small gap at the bottom (so the
    // last screen never begins with a heading-less line), else the first line that fits
    const minO = total - VH;
    const lastBlock = starts.find((s) => s >= minO);
    const last = lastBlock != null && lastBlock - minO <= 84 ? lastBlock : tops.find((l) => l.y >= minO).y;
    // top of the first line that does not fit entirely when scrolled to o
    const cut = (o) => { const l = tops.find((t) => t.y + t.h > o + VH); return l ? l.y : Infinity; };
    const out = [];
    for (const o of [...starts.filter((s) => s < last), last]) {
      while (out.length && o > cut(out[out.length - 1])) out.push(cut(out[out.length - 1]));
      out.push(o);
    }
    this._stops = out;
    return this._stops;
  }
}

// ---------------------------------------------------------------- helpers
export function visitedPlaces(g) {
  const st = g.state;
  const fl = st.flags || {};
  const v = { tokyo: true, home: true, ...(fl.visited || {}) };
  // saves from before flags.visited: guess from the place-prefixed flags and job ids. Only for
  // the older places: 永田町・ネオン街・区役所・刑務所 came after flags.visited, and some of their
  // flags are set before a visit (kantei_guest is the invitation)
  const keys = [...Object.keys(fl), ...Object.keys(st.jobs || {})];
  for (const id of GUIDE_ORDER) {
    const G = GUIDE[id];
    if (!G || G.town === 'nagatacho' || G.town === 'kanraku' || id === 'kuyakusho' || G.secret) continue;
    if (!v[id] && keys.some((k) => k.startsWith(id + '_'))) v[id] = true;
  }
  if (g.map && g.map.placeId) v[g.map.placeId] = true;
  // every building of a town is reached through that town
  for (const id of GUIDE_ORDER) if (v[id] && GUIDE[id]) v[GUIDE[id].town] = true;
  return v;
}

function bestSkill(st) {
  let best = null;
  for (const k of Object.keys(SKILLS)) if ((st.skills[k] || 0) > 0 && (!best || st.skills[k] > st.skills[best])) best = k;
  return best;
}

// Up to n open jobs of the highest tier the player can take, the most fitting first:
// jobs only the player's agency offers, then jobs in the town the player is in (town),
// the agency's specialty, the player's best skill and places already visited.
export function suggestJobs(st, visited = {}, town = 'tokyo', n = 3) {
  const open = GUIDE_JOBS.filter((j) => jobOpen(st, j));
  if (!open.length) return [];
  const top = Math.max(...open.map((j) => j.tier));
  const best = bestSkill(st);
  const agSkill = st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency].skill : null;
  const score = (j) => (j.need && j.need === st.agency ? 3 : 0) + (GUIDE[j.place] && GUIDE[j.place].town === town ? 2 : 0)
    + (j.skill === agSkill ? 1 : 0) + (j.skill === best ? 1 : 0) + (visited[j.place] ? 1 : 0);
  const cands = open.filter((j) => j.tier === top);
  const rot = (j) => (cands.indexOf(j) + (st.day || 0)) % cands.length; // vary the ties day by day
  return cands.slice().sort((a, b) => score(b) - score(a) || rot(a) - rot(b)).slice(0, n);
}

const placeName = (id) => (GUIDE[id] ? GUIDE[id].name : id);
const townTag = (id) => (GUIDE[id] ? { t: TOWNS[GUIDE[id].town], bg: TOWN_BG[GUIDE[id].town] } : null);
// any registered place (regular shows can be anywhere): guide name, place name, else nothing
const anyPlaceName = (g, id) => (!id ? '' : GUIDE[id] ? GUIDE[id].name : g.PLACES && g.PLACES[id] ? g.PLACES[id].name || '' : '');

const L0 = { hunger: 70, stress: 10, clean: 90 };
const lifeOf = (st) => ({ ...L0, ...(st.life || {}) });

// The player's regular shows (joined, known to the registry), by weekday.
function myRegulars(st) {
  const regs = st.regulars || {};
  return Object.keys(regs)
    .filter((id) => REGULARS[id] && regs[id] && !regs[id].declined && regs[id].since != null)
    .sort((a, b) => (REGULARS[a].weekday || 0) - (REGULARS[b].weekday || 0));
}

// This week's state of a regular show: [label, color].
function regularStatus(g, id) {
  const st = g.state;
  const r = REGULARS[id], s = st.regulars[id];
  const wk = weekOf(st.day), today = weekdayOf(st.day);
  if (s.dropped) return ['降板', COLORS.dim];
  const w = showWords(r);
  if ((s.doneWeek || 0) >= wk) {
    if (s.missed > 0) return ['休んでしまった…', COLORS.bad];
    // joined after this week's show (or on its day, without doing it): starts next week
    const ws = weekdayOf(s.since);
    if (weekOf(s.since) === wk && (ws > r.weekday || (ws === r.weekday && !s.count))) return ['来週から', COLORS.dim];
    return [w.done, COLORS.good];
  }
  if (r.weekday === today) return [`きょう${w.act}！`, COLORS.accent];
  if (r.weekday > today) return [`あと${r.weekday - today}日`, COLORS.text];
  return ['今週は終わった', COLORS.dim]; // the day passed without a recording (not counted yet)
}

// Days until the next Monday (rent day); Monday itself counts as 7 (paid this morning).
const daysToRent = (day) => (7 - weekdayOf(day)) % 7 || 7;

// Short advice for each need: [text, color].
function needAdvice(k, v, g) {
  if (k === 'hunger') {
    // broke and nothing to eat: work is still allowed (g.lifeRefusal), so say so
    if (v <= 0 && g && g.canFeed && !g.canFeed()) return ['おなかペコペコで、お金も食べ物もない…。まずはお仕事でかせいで、何か食べよう。', COLORS.bad];
    if (v <= 0) return ['おなかがすきすぎて力が出ない！何か食べないと、お仕事もレッスンもできない。', COLORS.bad];
    if (v < HUNGRY) return ['おなかがペコペコ！何か食べよう。ミニゲームが難しくなり、よく眠れない。', COLORS.bad];
    if (v < 45) return ['そろそろ何か食べよう。', COLORS.accent];
    if (v >= FULL) return ['おなかいっぱい。いまは食べられない。', COLORS.dim];
    if (v >= 65) return ['まだおなかは満たされている。いまごはんを食べても、体力はあまり回復しない。', COLORS.dim];
    return ['ちょうどいい感じ。', COLORS.dim];
  }
  if (k === 'stress') {
    if (v >= BURNOUT) return ['もう限界！お仕事はできない。公園でジョギング（無料）やテレビ、友だちと遊んで気分転換。1日しっかり休むのも効く。', COLORS.bad];
    if (v >= STRESSED) return ['ストレスがたまっている。ミニゲームが難しくなる。息抜きするか、1日ゆっくり休もう。', COLORS.bad];
    if (v >= 40) return ['すこし疲れぎみ。たまには息抜きを。', COLORS.accent];
    return ['リラックスしている。', COLORS.dim];
  }
  if (v < SCRUFFY) return ['身だしなみが乱れている。お風呂に入ろう。（知名度や好感度が上がりにくい）', COLORS.bad];
  if (v < 60) return ['そろそろお風呂に入りたい。', COLORS.accent];
  return ['さっぱりしている。', COLORS.dim];
}

const COND = {
  great: ['絶好調！', COLORS.good], normal: ['ふつう', COLORS.text], hungry: ['はらぺこ…', COLORS.bad],
  stressed: ['ストレスぎみ…', COLORS.bad], scruffy: ['身だしなみが乱れている', COLORS.accent], burnout: ['燃え尽きた…', COLORS.bad],
  edge: ['燃え尽き寸前！', COLORS.bad], // stressed, 90 and up
};
// g.condition(), with 'edge' for stress 90+ (one bad job away from burning out)
const condOf = (g) => { const c = g.condition(); return c === 'stressed' && g.state.life.stress >= 90 ? 'edge' : c; };

// ---------------------------------------------------------------- tab: もくひょう
function goalPage(g, ctx) {
  const st = g.state;
  const fl = st.flags || {};
  const L = lifeOf(st);
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);

  pg.block().head('きょうのようす');
  pg.row(g.dayLabel ? g.dayLabel() : `${st.day}日目`, `所持金 ${fmtMoney(st.money)}`, { rc: COLORS.accent });
  const sc = st.stamina / st.maxStamina > 0.5 ? COLORS.good : st.stamina / st.maxStamina > 0.2 ? COLORS.accent : COLORS.bad;
  pg.row(`体力 ${st.stamina}/${st.maxStamina}`, `満腹 ${L.hunger}%`, { c: sc, rc: L.hunger < HUNGRY ? COLORS.bad : COLORS.text });
  // what needs attention today (the details are in せいかつ); a recording today comes
  // first, since it cannot wait, then the needs from the most to the least pressing
  const notes = [];
  try {
    for (const id of g.regularsToday ? g.regularsToday() : []) notes.push([`きょうは『${REGULARS[id].title}』の${showWords(REGULARS[id]).day}！`, COLORS.accent]);
  } catch (e) { /* registry changed under us */ }
  if (st.stamina < 25) {
    notes.push([g.canEat && !g.canEat() ? '体力が少ない。おなかいっぱいなので、ベッドで寝て回復しよう。' : '体力が少ない。何か食べるか、ベッドで寝て回復しよう。', COLORS.bad]);
  }
  if (L.hunger < HUNGRY && st.stamina >= 25) {
    const broke = L.hunger <= 0 && g.canFeed && !g.canFeed();
    notes.push([broke ? 'おなかペコペコで、お金も食べ物もない！まずはお仕事でかせごう。' : L.hunger <= 0 ? 'おなかがすきすぎて力が出ない！まず何か食べよう。' : 'おなかがペコペコ…。何か食べよう。', COLORS.bad]);
  }
  if (L.stress >= BURNOUT) notes.push(['ストレスが限界。ジョギングやテレビで気分転換するか、今日は休もう。', COLORS.bad]);
  else if (L.stress >= STRESSED) notes.push(['ストレスがたまっている。友だちと遊んで息抜きしよう。', COLORS.accent]);
  if (st.rent && st.rent.debt) notes.push([`家賃が未払い（${fmtMoney(st.rent.debt)}）。スマホの「家計」から払おう。`, COLORS.bad]);
  else {
    // rent coming up soon and not enough money yet (the same numbers as せいかつ)
    const rent = (g.housing && g.housing().rent) || 0;
    const d = daysToRent(st.day);
    if (rent > 0 && st.money < rent && d <= 4) notes.push([`家賃（${fmtMoney(rent)}）まで${d === 1 ? 'あした' : `あと${d}日`}。あと${fmtMoney(rent - st.money)}かせごう。`, COLORS.accent]);
  }
  if (L.clean < SCRUFFY) notes.push(['身だしなみが乱れている。お風呂に入ろう。', COLORS.accent]);
  // politics and justice (a court date, an election, 闇金) come right after a recording today
  // a contest round today comes with the recordings; NSC and the 相方 after the needs
  const urgent = urgentNotes(g);
  const comedy = safe(() => comedyNotes(g, KIT), []) || [];
  const recN = notes.filter(([t]) => t.startsWith('きょうは『')).length;
  notes.splice(recN, 0, ...comedy.filter((n) => n[2] === 'contest'), ...urgent);
  notes.push(...comedy.filter((n) => n[2] !== 'contest'));
  const shown = notes.slice(0, 4);
  for (const [t, c] of shown) pg.para('・' + t, { s: SMALL, c });
  const tabs = [...new Set(shown.map((n) => ({ law: '「くらしと法」', politics: '「政治」', contest: '「賞レース」', owarai: '「お笑い」' }[n[2]] || '「せいかつ」')))];
  if (tabs.length) pg.para(`くわしくは${tabs.join('')}タブで。`, { s: SMALL, c: COLORS.dim });

  // the one most important next step
  pg.block(8, { sticky: 'note' }).head('つぎの目標', COLORS.accent);
  // in prison the career waits: the one goal is to serve the term and come back
  const inPrison = hasJustice(g) && g.state.justice && safe(() => g.justiceStatus().status) === 'prison';
  if (inPrison) {
    pg.para('刑期をつとめあげて、社会にもどろう。');
    pg.para('刑務作業や改善指導にまじめに取り組めば、仮釈放が認められることもある。', { s: SMALL, c: COLORS.dim });
  } else if (fl.finaleDone) {
    // the year-end show was a milestone: the next title is the goal now
    const nr = nextTitle(st.fame);
    if (nr) {
      pg.para(`次の称号「${nr[1]}」をめざそう！（あと★${nr[0] - st.fame}）`);
      pg.para('国民的スターになっても、芸能人生はまだまだ続く。大きなお仕事やレギュラー番組、NHKホールの凱旋コンサートで活躍しよう。', { s: SMALL, c: COLORS.dim });
    } else {
      pg.para(`最高の称号「${rankName(st.fame)}」！`);
      pg.para('ドット芸能大賞の殿堂入りや、ファン100万人など、下の「キャリアの目標」をぜんぶ達成しよう。', { s: SMALL, c: COLORS.dim });
    }
  } else if (st.fame >= FINALE_FAME && fl.finaleInvited) {
    pg.para(g.map && g.map.placeId === 'nhk' ? 'プロデューサーに会いに行こう！' : 'NHK放送センターへ行こう！');
    pg.para('年末の大型歌番組のプロデューサーが、入り口の近くで待っている。', { s: SMALL, c: COLORS.dim });
  } else if (st.fame >= FINALE_FAME) {
    pg.para(`★${FINALE_FAME}に届いた！`);
    pg.para('街に出ると、NHKから大事な電話がかかってくるはず。', { s: SMALL, c: COLORS.dim });
  } else if (!st.agency) {
    pg.para('事務所のオーディションに合格して、所属タレントになろう。');
    pg.para('レッスンや自主練でスキルを上げると、合格しやすくなる。ごはんをしっかり食べて、ストレスをためないのも大事。', { s: SMALL, c: COLORS.dim });
  } else {
    const next = TIER_FAME.find((f) => f > st.fame && f > 30) || FINALE_FAME;
    pg.para(`お仕事で知名度を上げて、★${next}をめざそう。`);
    pg.para(`あと★${next - st.fame}。おすすめのお仕事は下のとおり。`, { s: SMALL, c: COLORS.dim });
  }

  // the political path (only once the player has stepped onto it)
  const polGoal = politicsGoal(g);
  if (polGoal) {
    pg.block().head('政治の道', TC.politics);
    pg.para(polGoal[0]);
    if (polGoal[1]) pg.para(polGoal[1], { s: SMALL, c: COLORS.dim });
  }

  // the comedy career as a ladder: the last step done, the next one (with how) and the one after
  const steps = inPrison ? null : safe(() => comedyLadder(g, KIT), null);
  if (steps && steps.length) {
    const ni = steps.findIndex((x) => !x.done);
    pg.block().head('お笑いの道', TC.owarai);
    const from = ni < 0 ? Math.max(0, steps.length - 2) : Math.max(0, ni - 1);
    const to = ni < 0 ? steps.length : Math.min(steps.length, ni + 2);
    const doneN = steps.filter((x) => x.done).length;
    for (let i = from; i < to; i++) {
      const x = steps[i];
      if (x.done) pg.row('◎ ' + x.label, 'できた！', { s: SMALL, c: COLORS.dim, rs: SMALL, rc: COLORS.good });
      else if (i === ni) {
        pg.row('▶ ' + x.label, `${doneN}/${steps.length}`, { c: COLORS.accent, rs: SMALL, rc: COLORS.dim, mark: true });
        if (x.note) pg.para(x.note, { s: SMALL, c: COLORS.text, x: 18, mark: true });
      } else pg.row('・ ' + x.label, '', { s: SMALL, c: COLORS.dim });
    }
    if (ni < 0) pg.para('ぜんぶ達成！あとは、てっぺんを守りつづけよう。', { s: SMALL, c: COLORS.accent });
  }

  if (!st.agency && !fl.finaleDone && !inPrison) {
    pg.block().head('オーディション（合格で所属）');
    for (const a of AUDITIONS) pg.row(placeName(a.place), a.how, { tag: townTag(a.place), rs: SMALL, rc: COLORS.dim });
  }

  // title
  const ri = rankIndex(st.fame);
  const nextRank = RANKS[ri + 1];
  pg.block().head('称号');
  pg.row(`いまは「${rankName(st.fame)}」`, `★${st.fame}`, { rc: COLORS.pink });
  // (after the year-end show the next title is already the main goal above)
  if (nextRank && !fl.finaleDone) pg.para(`次の「${nextRank[1]}」まで あと★${nextRank[0] - st.fame}`, { s: SMALL, c: COLORS.dim });
  else if (!nextRank) pg.para('最高の称号に到達！', { s: SMALL, c: COLORS.accent });

  // long-term career goals (career.js), after the year-end show: always a next step
  if (fl.finaleDone && CAREER.goals) {
    let rows = [];
    try { rows = CAREER.goals(g) || []; } catch (e) { console.error('[notebook] career goals', e); }
    if (rows.length) {
      pg.block().head('キャリアの目標', COLORS.accent);
      for (const r of rows) {
        pg.row((r.done ? '◎ ' : '・') + r.label, r.value || '', { rs: SMALL, rc: r.done ? COLORS.good : COLORS.accent });
        if (r.note) pg.para(r.note, { s: SMALL, c: COLORS.dim, x: 16 });
      }
    }
  }

  // jobs
  const here = g.map && GUIDE[g.map.placeId];
  const jobs = inPrison ? [] : suggestJobs(st, visited, here ? here.town : 'tokyo');
  if (jobs.length) {
    pg.block().head('おすすめのお仕事');
    for (const j of jobs) pg.row('・' + j.label, GUIDE[j.place] ? GUIDE[j.place].short : j.place, { rs: SMALL, rc: COLORS.dim });
  }
  const nextTier = inPrison ? null : TIER_FAME.find((f) => f > st.fame && !(f === 30 && st.agency));
  // (with an agency the next ★ line is already the main goal above)
  if (nextTier === 30) pg.para('所属するか★30になると、受けられるお仕事が増える。', { s: SMALL, c: COLORS.dim });
  else if (nextTier && (!st.agency || fl.finaleDone)) pg.para(`★${nextTier}で、もっと大きなお仕事が増える（あと★${nextTier - st.fame}）。`, { s: SMALL, c: COLORS.dim });
  if (st.agency && AGENCIES[st.agency] && !inPrison) {
    const sk = SKILLS[AGENCIES[st.agency].skill];
    pg.para(`${AGENCIES[st.agency].name}の得意分野は「${sk}」。${sk}のお仕事は、ギャラと知名度が1.1倍！`, { s: SMALL, c: COLORS.dim });
  }

  if (!fl.finaleDone && st.fame < FINALE_FAME) {
    pg.block().head('大きな目標');
    pg.para(`★${FINALE_FAME}で、NHKから年末の大舞台の声がかかる。`, { s: SMALL });
    pg.para(`（あと★${FINALE_FAME - st.fame}）`, { s: SMALL, c: COLORS.dim });
  }
  return pg;
}

// ---------------------------------------------------------------- tab: せいかつ
function lifePage(g, ctx) {
  const st = g.state;
  const L = lifeOf(st);
  const pg = new Page(ctx);
  const day = st.day || 1;
  const wd = weekdayOf(day);

  // today
  pg.block().head('きょう', TC.life);
  pg.row(`${day}日目　${WEEKDAYS[wd]}曜日`, `第${weekOf(day)}週`, { c: COLORS.accent, rc: COLORS.dim, rs: SMALL });
  if (g.condition) {
    const [cl, cc] = COND[condOf(g)] || COND.normal;
    pg.row('調子', cl, { rc: cc });
  }
  try {
    for (const id of g.regularsToday ? g.regularsToday() : []) {
      const r = REGULARS[id];
      const where = anyPlaceName(g, r.place);
      pg.para(`きょうは『${r.title}』の${showWords(r).day}！${where ? `（${where}）` : ''}`, { s: SMALL, c: COLORS.accent });
    }
  } catch (e) { /* ignore */ }
  const unread = g.unread ? g.unread() : 0;
  if (unread) pg.para(`スマホに未読のメッセージが${unread}件あるよ。`, { s: SMALL, c: COLORS.cyan });

  // needs
  pg.block().head('からだと心', TC.life);
  const sf = st.stamina / st.maxStamina;
  pg.row('体力', `${st.stamina}/${st.maxStamina}`, { gauge: { frac: sf, color: sf > 0.5 ? COLORS.good : sf > 0.2 ? COLORS.accent : COLORS.bad }, rc: st.stamina < 25 ? COLORS.bad : COLORS.text });
  if (st.stamina < 25) {
    const full = g.canEat && !g.canEat();
    pg.para(full ? '体力が少ない。おなかいっぱいなので、ベッドで寝て回復しよう。' : '体力が少ない。何か食べるか、ベッドで寝て回復しよう。', { s: SMALL, c: COLORS.bad, x: 16 });
  }
  else pg.para(sf >= 0.7 ? '元気いっぱい！' : 'すこし疲れてきた。お仕事は体力と相談しよう。', { s: SMALL, c: sf >= 0.7 ? COLORS.dim : COLORS.accent, x: 16 });
  const NEED_ROWS = [
    ['hunger', '満腹', (v) => `${v}%`, (v) => (v < HUNGRY ? COLORS.bad : '#ff9a3c')],
    ['stress', 'ストレス', (v) => String(v), (v) => (v >= STRESSED ? COLORS.bad : v >= 40 ? COLORS.accent : '#b48cff')],
    ['clean', '身だしなみ', (v) => String(v), (v) => (v < SCRUFFY ? COLORS.bad : COLORS.cyan)],
  ];
  for (const [k, name, fmt, col] of NEED_ROWS) {
    const v = clamp(Math.round(L[k] || 0), 0, 100);
    const [adv, ac] = needAdvice(k, v, g);
    pg.row(name, fmt(v), { gauge: { frac: v / 100, color: col(v) }, rc: ac === COLORS.bad ? COLORS.bad : COLORS.text });
    pg.para(adv, { s: SMALL, c: ac, x: 16 });
  }

  // housing & rent
  pg.block().head('すまい', TC.life);
  const h = g.housing ? g.housing() : null;
  if (h) {
    pg.row(h.name || 'すまい', `家賃 ${fmtMoney(h.rent || 0)}／週`, { c: COLORS.accent, rs: SMALL, rc: COLORS.text });
    if (h.desc) pg.para(h.desc, { s: SMALL, c: COLORS.dim, x: 16 });
    const perks = [h.kitchen && 'キッチン', h.bath && 'お風呂'].filter(Boolean);
    const owned = Object.keys(st.furniture || {}).filter((k) => st.furniture[k] && FURNITURE[k]).length;
    pg.row(`設備：${perks.length ? perks.join('・') : 'なし'}`, `家具 ${owned}/${h.slots ?? 4}`, { s: SMALL, rs: SMALL, x: 16, rc: COLORS.dim });
    const rent = st.rent || {};
    const d = daysToRent(day);
    const rentful = (h.rent || 0) > 0;
    if (rentful) pg.row('次の家賃', `月曜日（${d === 1 ? 'あした' : `あと${d}日`}）`, { rc: d <= 2 ? COLORS.accent : COLORS.text });
    // unpaid rent is shown even after moving somewhere rent-free
    if (rent.debt) {
      pg.row('未払い', fmtMoney(rent.debt), { c: COLORS.bad, rc: COLORS.bad });
      pg.para('お金ができたら、スマホの「家計」から払おう。払うまで、ストレスがたまっていく。', { s: SMALL, c: COLORS.bad, x: 16 });
    } else if (rentful && st.money < h.rent) {
      pg.para(`いまの所持金では家賃が足りない！月曜日までに、あと${fmtMoney(h.rent - st.money)}かせごう。`, { s: SMALL, c: COLORS.accent, x: 16 });
    } else if (rentful) pg.para('家賃は毎週月曜日の朝に、所持金から自動で支払われる。', { s: SMALL, c: COLORS.dim, x: 16 });
    if (!rentful) pg.para('家賃はかからない。', { s: SMALL, c: COLORS.dim, x: 16 });
  }

  // regular shows this week
  pg.block().head('レギュラー番組（今週）', TC.life);
  const regs = myRegulars(st);
  if (!regs.length) {
    pg.para('まだレギュラー番組はない。知名度が上がると、番組からオファーが届くかも。', { s: SMALL, c: COLORS.dim });
  } else {
    for (const id of regs) {
      const r = REGULARS[id], s = st.regulars[id];
      const [label, color] = regularStatus(g, id);
      const wdName = WEEKDAYS[clamp(r.weekday | 0, 0, 6)] + '曜';
      pg.row(`『${r.title || id}』`, label, { rc: color, tag: { t: wdName, bg: r.weekday === wd ? '#c87a1a' : '#5a4a8a' }, c: s.dropped ? COLORS.dim : COLORS.text });
      const where = anyPlaceName(g, r.place);
      pg.para(`${where ? where + '・' : ''}出演 ${s.count || 0}回${s.missed && !s.dropped ? `・お休み ${s.missed}回` : ''}`, { s: SMALL, c: COLORS.dim, x: 16 });
    }
    pg.para('収録や本番の日に現場へ行けば出演できる。続けて2回休むと降板…。', { s: SMALL, c: COLORS.dim });
  }

  // friends
  pg.block().head('なかま', TC.life);
  const people = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && st.people[id]);
  if (!people.length) {
    pg.para('まだ知り合いはいない。事務所や街の人に話しかけてみよう。', { s: SMALL, c: COLORS.dim });
  } else {
    const aff = (id) => Number(st.people[id].aff) || 0;
    people.sort((a, b) => aff(b) - aff(a));
    const friends = people.filter((id) => heartIndex(aff(id)) >= 2).length;
    pg.row(`知り合い ${people.length}人`, `友だち以上 ${friends}人`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.pink });
    for (const id of people) {
      const p = st.people[id];
      const lv = heartIndex(aff(id));
      const tag = st.partner === id || p.partner ? { t: '相方', bg: '#c87a1a' } : p.special ? { t: '大切な人', bg: '#c2407a' } : null;
      pg.row(PEOPLE[id].name || id, (HEARTS[lv] && HEARTS[lv][1]) || '', { tag, hearts: lv, rc: lv >= 3 ? COLORS.pink : lv >= 2 ? COLORS.text : COLORS.dim, rs: SMALL });
    }
  }

  // fans
  pg.block().head('ファン', TC.life);
  const fans = Math.max(0, Math.round(st.fans || 0));
  pg.row(`ファン ${fans.toLocaleString('ja-JP')}人`, '', { c: COLORS.pink });
  const fanNote = fans === 0 ? 'まだファンはいない。テレビや舞台のお仕事で、名前を覚えてもらおう。'
    : fans < 100 ? 'ファンが少しずつ増えてきた！'
      : fans < 1000 ? '応援してくれるファンが増えてきた。レギュラー番組でもっと増える。'
        : fans < 10000 ? 'たくさんのファンが応援してくれている！'
          : '日本中にファンがいる！国民的スターはもうすぐ。';
  pg.para(fanNote, { s: SMALL, c: COLORS.dim });
  return pg;
}

// ---------------------------------------------------------------- the two cores (guarded)
// Every read of politics / justice goes through here: a missing method or a broken
// state never breaks the notebook (the page just leaves that part out).
function safe(f, d = null) {
  try { const v = f(); return v === undefined ? d : v; } catch (e) { console.error('[notebook]', e); return d; }
}
const hasPolitics = (g) => typeof g.pol === 'function' && typeof g.politicsSummary === 'function';
const hasJustice = (g) => typeof g.jus === 'function' && typeof g.justiceStatus === 'function';
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const inDays = (n) => (n <= 0 ? 'きょう' : n === 1 ? 'あした' : `あと${n}日`);
// 'あと5年＝600日' until the birthday that makes the player `age` (1年＝YEAR_DAYS日)
function daysUntilAge(st, age) {
  const now = ageOf(st);
  if (now >= age) return 'いまから';
  const d = daysToBirthday(st) + (age - now - 1) * YEAR_DAYS;
  return `あと${age - now}年＝${d}日`;
}
// 選挙権 age on today's date: 20, 18 from 2016 (politics.js votingAge; 20 without the core)
function votingAgeNow(g) {
  return safe(() => {
    if (!POL.votingAge || typeof g.polDate !== 'function') return 20;
    const p = typeof g.pol === 'function' ? g.pol() : null;
    return POL.votingAge(g.polDate().year, (p && p.flags) || {});
  }, 20);
}
// Has the calendar reached year / month (the law calendar of crime.js; true without it)?
function sinceYM(g, year, month = 1) {
  const d = safe(() => (JUS.lawDate ? JUS.lawDate(g) : null), null);
  return !d || !Number.isFinite(d.year) ? true : d.year * 100 + (d.month || 1) >= year * 100 + month;
}
// a literal yen amount that is not money (exchange rate, stock index): never era-converted
const plainYen = (n) => `${YEN_MARK}${Math.round(num(n)).toLocaleString('ja-JP')}円`;
const pctText = (v) => `${Math.round(num(v) * 10) / 10}%`;
// a span of game days as years / months (1年＝YEAR_DAYS日, as politics_ui.js spanText)
function spanText(n) {
  n = Math.max(0, Math.round(num(n)));
  const ml = YEAR_DAYS / 12;
  const y = Math.floor(n / YEAR_DAYS), m = Math.floor((n % YEAR_DAYS) / ml);
  return y ? `${y}年${m ? `${m}か月` : ''}` : `${Math.max(1, m)}か月`;
}

const BILL_STAGE = {
  draft: ['準備中', COLORS.dim], committee: ['委員会で審議中', COLORS.cyan], shugi: ['衆議院で審議中', COLORS.cyan],
  sangi: ['参議院で審議中', COLORS.cyan], referendum: ['国民投票へ', COLORS.accent], enacted: ['成立！', COLORS.good],
  rejected: ['否決', COLORS.bad], shelved: ['廃案', COLORS.dim],
};

// Short summaries for the もくひょう notes: what cannot wait in politics / justice.
function urgentNotes(g) {
  const out = [];
  const st = g.state;
  const day = st.day;
  if (hasJustice(g)) {
    const js = safe(() => g.justiceStatus());
    if (js) {
      const yami = (js.loans || []).filter((l) => l.lender === 'yamikin');
      if (yami.length) out.push(['闇金から借りている。払い続ける前に、警察や弁護士に相談しよう。', COLORS.bad, 'law']);
      if (js.status === 'prison') out.push([`刑務所で服役中${num(js.prisonUntil) > day ? `（刑期の終わりまで${inDays(num(js.prisonUntil) - day)}）` : ''}。芸能のお仕事も選挙もできない。`, COLORS.bad, 'law']);
      else if (js.status === 'detained') out.push(['身柄を拘束されている。手続きが終わるまで、家には帰れない。', COLORS.bad, 'law']);
      if (num(js.kinshinUntil) > day) out.push([`活動自粛中（${inDays(num(js.kinshinUntil) - day)}）。芸能のお仕事は受けられない（アルバイトは可）。`, COLORS.accent, 'law']);
      const late = (js.loans || []).find((l) => l.lender !== 'yamikin' && (num(l.missed) > 0 || num(l.due) - day <= 2) && l.status !== 'frozen');
      if (late) out.push([num(late.missed) > 0 || num(late.due) < day ? `${late.company || '借入れ'}の返済が遅れている。早めに返すか、法律相談を。` : `${late.company || '借入れ'}の返済日が${inDays(num(late.due) - day)}。`, num(late.missed) > 0 ? COLORS.bad : COLORS.accent, 'law']);
      const c = (js.cases || [])[0];
      const cname = c && JUS.CRIMES && JUS.CRIMES[c.crime] ? JUS.CRIMES[c.crime].name : '';
      if (c && c.next && c.next >= day) out.push([`${cname || '事件'}の手続きがある（${inDays(c.next - day)}）。`, COLORS.bad, 'law']);
      else if (c) out.push([`${cname ? cname + 'の' : ''}事件の捜査・手続きが続いている。`, COLORS.bad, 'law']);
    }
  }
  if (hasPolitics(g)) {
    const e = safe(() => g.myElection());
    if (e && num(e.day) >= day) out.push([`${e.label || '選挙'}の投票日まで${inDays(num(e.day) - day)}。選挙運動をしよう！`, COLORS.accent, 'politics']);
  }
  return out;
}

// The next step on the political path for もくひょう: [text, small note] or null while the
// player has not started (no office, party, candidacy or political history).
function politicsGoal(g) {
  if (!hasPolitics(g) || !g.state.politics) return null;
  const p = safe(() => g.pol());
  const me = p && p.me;
  if (!me || !(me.office || me.party || me.candidacy || num(me.wins) || num(me.losses))) return null;
  const posts = Array.isArray(me.posts) ? me.posts : [];
  const lvl = me.office && POL.OFFICES && POL.OFFICES[me.office] ? POL.OFFICES[me.office].level : null;
  if (safe(() => g.myElection())) return null; // the election countdown is already in the notes above
  if (posts.includes('pm')) {
    const ap = Math.round(num(safe(() => g.approval(), 0)));
    return ['総理大臣として、政策を実現しよう。', `内閣支持率 ${ap}%。支持率が下がると、次の選挙で苦しくなる。`];
  }
  if (posts.some((x) => x === 'kanbo' || /^minister_/.test(x))) return ['大臣として、閣議と国会の答弁をこなそう。', '総理大臣は、国会が国会議員の中から指名する。党首になれば、その道がひらける。'];
  if (lvl === 'national') return ['国会に出席して、委員会で質問しよう。', '評判と党内の評価が上がると、入閣や党の役職の打診が来ることがある。'];
  if (lvl === 'local' || lvl === 'exec') return ['地元で実績を積もう（議会で質問・陳情・地元回り）。', '地元の支持が固まったら、国政（衆議院・参議院）への挑戦も。'];
  if (me.party) return ['党の公認をもらって、次の選挙に立候補しよう。', '公認の申請は、党本部の選挙対策本部か、スマホの「政治」から。'];
  return ['次の選挙に、もう一度挑戦しよう。', '地元回りや後援会づくりで、ふだんから支持を広げておこう。'];
}

// ---------------------------------------------------------------- tab: くらしと法
const STATUS_WORD = {
  free: ['ふつうに暮らしている', COLORS.good], detained: ['身柄を拘束されている', COLORS.bad], trial: ['裁判中', COLORS.bad],
  prison: ['刑務所で服役中', COLORS.bad], probation: ['執行猶予中', COLORS.accent],
};
const CASE_STAGE = {
  zaitaku: '在宅で捜査中', arrest: '逮捕された', police: '警察で取調べ中', kouryu: '勾留中', kyodaku: '逮捕許諾の請求中',
  indicted: '起訴された', trial: '裁判中', verdict_wait: '判決待ち', appeal_wait: '控訴中', final: '確定',
};
const RECORD_WORD = {
  fine: '罰金・科料', suspended: '執行猶予つき有罪', prison: '実刑', acquitted: '無罪', not_indicted: '不起訴', bizai: '微罪処分',
  hodo: '補導', warning: '警告・指導', kare: '過料', zoun: '増運賃', hogo: '保護', tax_admin: '修正申告',
  juvenile_fusho: '少年審判：不処分', juvenile_hogo: '少年審判：保護観察', juvenile_in: '少年院送致', juvenile_kan: '簡易送致',
};
const CONVICTION = new Set(['fine', 'suspended', 'prison']);
const BANKRUPT_KIND = { doji: '同時廃止', kanzai: '管財事件' };

function lawPage(g, ctx) {
  const st = g.state;
  const pg = new Page(ctx);
  const C = TC.law;
  const day = st.day || 1;
  if (!hasJustice(g)) {
    pg.block().head('くらしと法', C).para('（法律のしくみを読み込めませんでした）', { s: SMALL, c: COLORS.dim });
    return pg;
  }
  const j = safe(() => g.jus(), null);
  const s = safe(() => g.justiceStatus(), null);
  if (!j || !s) {
    pg.block().head('くらしと法', C).para('（いまの状態を読み込めませんでした）', { s: SMALL, c: COLORS.dim });
    return pg;
  }
  const CR = JUS.CRIMES || {};
  const crimeName = (id) => (CR[id] && CR[id].name) || id || '';

  // ---- now
  pg.block().head('いまの状態', C);
  const open = (s.cases || []).length > 0;
  const [sw, sc] = s.status === 'free' && open ? ['事件の手続きが続いている', COLORS.accent]
    : s.status === 'probation' && !s.suspendUntil ? ['保護観察中', COLORS.accent] : STATUS_WORD[s.status] || STATUS_WORD.free;
  pg.row('くらし', sw, { rc: sc });
  const record = Array.isArray(s.record) ? s.record : [];
  const convicted = !!s.hasRecord;
  pg.row('前科', convicted ? `あり（${record.filter((r) => CONVICTION.has(r.outcome) && !r.juvenile).length}件）` : 'なし', { rc: convicted ? COLORS.bad : COLORS.good });
  if (convicted) pg.para('前科は記録に残る。仕事や立候補、家族や仲間の見る目にも影を落とす。', { s: SMALL, c: COLORS.dim, x: 16 });
  if (s.prisonUntil && s.status === 'prison') pg.row('刑期の終わり', `${s.prisonUntil}日目（${inDays(s.prisonUntil - day)}）`, { rc: COLORS.bad, rs: SMALL });
  if (s.suspendUntil) {
    pg.row(`執行猶予${j.supervision ? '（保護観察つき）' : ''}`, inDays(s.suspendUntil - day), { rc: COLORS.accent });
    pg.para('猶予中にまた罪を犯して実刑になると、猶予が取り消され、前の刑も受けることになる。\n猶予の期間を無事に過ごせば、刑の言い渡しは効力を失う。', { s: SMALL, c: COLORS.accent, x: 16 });
  }
  if (s.probationUntil) {
    pg.row('保護観察', inDays(s.probationUntil - day), { rc: COLORS.accent, rs: SMALL });
    if (!s.suspendUntil) pg.para('保護司と定期的に会い、決められた約束（遵守事項）を守って暮らす。', { s: SMALL, c: COLORS.dim, x: 16 });
  }
  const civic = safe(() => g.civicBanReason('vote'));
  const cand = safe(() => g.civicBanReason('candidacy'));
  if (civic || cand) {
    // no vote implies no candidacy; 公職選挙法11条の2 can take only the candidacy
    pg.row('選挙権（投票）', civic ? 'なし' : 'あり', { s: SMALL, rs: SMALL, c: COLORS.dim, rc: civic ? COLORS.bad : COLORS.good });
    pg.row('被選挙権（立候補）', 'なし', { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.bad });
    pg.para(civic || cand, { s: SMALL, c: COLORS.bad, x: 16 });
  } else {
    // the same rules as the 政治 tab: 選挙権 at 20 (18 from 2016), 被選挙権 at 25 (参院・知事 30)
    const age = ageOf(st);
    const va = votingAgeNow(g);
    pg.row('選挙権（投票）', age >= va ? 'あり' : `${va}歳から`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: age >= va ? COLORS.good : COLORS.dim });
    pg.row('被選挙権（立候補）', age >= 30 ? 'あり' : age >= 25 ? 'あり（参院・知事は30歳から）' : `25歳から（${daysUntilAge(st, 25)}）`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: age >= 25 ? COLORS.good : COLORS.dim });
  }
  if (s.kinshinUntil) pg.row('活動自粛', inDays(s.kinshinUntil - day), { rc: COLORS.bad, rs: SMALL });
  if (s.tvBanUntil) pg.row('テレビの起用見送り', inDays(s.tvBanUntil - day), { rc: COLORS.accent, rs: SMALL });
  if (s.agencyBanUntil) pg.row('事務所との契約', `できない（${inDays(s.agencyBanUntil - day)}）`, { rc: COLORS.accent, rs: SMALL });
  for (const c of s.cases || []) {
    pg.row(`事件：${crimeName(c.crime)}`, `${CASE_STAGE[c.stage] || c.stage || ''}${c.bail ? '・保釈中' : ''}`, { rc: COLORS.bad, rs: SMALL });
    if (c.next && c.next >= day) pg.para(`次の手続き：${c.next}日目（${inDays(c.next - day)}）`, { s: SMALL, c: COLORS.dim, x: 16 });
  }

  // ---- record
  if (record.length) {
    pg.block().head('記録', C);
    for (const r of record.slice(-6).reverse()) {
      const conv = CONVICTION.has(r.outcome) && !r.juvenile;
      pg.row(`${r.day || '?'}日目　${crimeName(r.crime)}`, r.label || RECORD_WORD[r.outcome] || r.outcome || '', { s: SMALL, rs: SMALL, rc: conv ? COLORS.bad : COLORS.dim });
    }
    if (record.length > 6) pg.para(`ほか${record.length - 6}件。くわしくは、スマホの「借入・返済」→「記録と手続き」で。`, { s: SMALL, c: COLORS.dim });
  }

  // ---- money
  pg.block().head('お金の借り入れ', C);
  const loans = Array.isArray(s.loans) ? s.loans : [];
  const LND = JUS.LENDERS || {};
  if (!loans.length) pg.para('借金はない。', { s: SMALL, c: COLORS.dim });
  // a 本人申立て waiting for its 予納金 stops the repayments to the legal lenders (crime.js honninPay)
  const stopped = !!(s.hasanPrep && !s.bankrupt);
  for (const l of loans) {
    const yami = l.lender === 'yamikin';
    const rate = yami ? 'トイチ' : `年${pctText(num(l.rate) * 100)}`;
    pg.row(`${l.company || (LND[l.lender] && LND[l.lender].name) || '借入れ'}`, fmtMoney(num(l.balance)), { tag: { t: (LND[l.lender] && LND[l.lender].name) || '借入れ', bg: yami ? '#8a1a2a' : '#5a4a2a' }, rc: yami ? COLORS.bad : COLORS.text });
    const due = num(l.due) - day;
    pg.para(`${rate}・${l.status === 'frozen' ? '返済は止まっている' : stopped && !yami ? '返済は止めている（自己破産の申立て中）' : due < 0 ? '返済日を過ぎている' : `返済日 ${inDays(due)}`}${l.missed ? `・延滞${l.missed}回` : ''}`, { s: SMALL, c: l.missed ? COLORS.bad : COLORS.dim, x: 16 });
  }
  if (loans.length > 1) pg.row('合計', fmtMoney(num(s.debt)), { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.accent });
  if (loans.some((l) => l.lender === 'yamikin')) {
    pg.para('闇金は違法な貸金業者。トイチ（10日で1割）のような利息は法律で認められていない。ひとりで払い続けず、警察の相談窓口や弁護士に相談しよう。', { s: SMALL, c: COLORS.bad });
  }
  if (loans.some((l) => l.missed && l.lender !== 'yamikin')) pg.para('返済が遅れると、信用情報に事故の記録が残る。新しい借入れやローンが組めなくなる。', { s: SMALL, c: COLORS.accent });
  const rateText = safe(() => (JUS.rateLawText ? JUS.rateLawText(g) : ''), '');
  if (rateText) pg.para(rateText + '。', { s: SMALL, c: COLORS.dim });
  if (j.unpaid) pg.row('未納（過料・税など）', fmtMoney(num(j.unpaid)), { s: SMALL, rs: SMALL, rc: COLORS.bad });
  if (s.garnish) pg.para(`給料の差押え中（${s.garnish.by || '債権者'}）：収入の一部が差し引かれる。`, { s: SMALL, c: COLORS.bad });
  const b = s.bankrupt;
  if (b) {
    const kind = BANKRUPT_KIND[b.kind] ? `（${BANKRUPT_KIND[b.kind]}）` : '';
    const word = b.discharged ? ['免責が決まった', COLORS.good] : b.closed ? ['免責は認められなかった', COLORS.bad] : ['手続き中', COLORS.accent];
    pg.row(`自己破産${kind}${b.honnin ? '・本人申立て' : ''}`, word[0], { rc: word[1], rs: SMALL });
    pg.para(b.discharged ? '借金の返済は免除された。ただし、しばらくは新しい借入れやローンができない。' : '裁判所の手続きが進んでいる。審尋の日は裁判所へ。', { s: SMALL, c: COLORS.dim, x: 16 });
  }
  // a 本人申立て waiting for its 予納金 (crime.js hasanPrep): the savings so far
  const prep = !b && s.hasanPrep && num(s.hasanPrep.cost) > 0 ? s.hasanPrep : null;
  if (prep) {
    const cost = num(prep.cost), saved = Math.min(cost, num(prep.saved));
    pg.row('自己破産（本人申立て）', prep.paid ? '予納金を納めた' : '予納金をためている', { rc: COLORS.accent, rs: SMALL });
    pg.row('予納金の積立', `${fmtMoney(saved)} / ${fmtMoney(cost)}`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.accent, gauge: { frac: cost ? clamp(saved / cost, 0, 1) : 0, color: COLORS.accent } });
    pg.para(prep.paid ? '予納金を納めた。裁判所の決定を待っている。' : '返済を止めて、入ったお金の半分をためている。そろった朝に裁判所に納める（家族に頼むこともできる）。', { s: SMALL, c: COLORS.dim, x: 16 });
  }
  if (s.creditBlackUntil) pg.row('信用情報の事故記録', inDays(s.creditBlackUntil - day), { s: SMALL, rs: SMALL, rc: COLORS.accent });

  // ---- tobacco and alcohol
  pg.block().head('タバコとお酒', C);
  const minor = !safe(() => g.canSmoke(), true);
  if (minor) pg.para('20歳未満なので、タバコもお酒も法律で禁止。見つかると補導される。', { s: SMALL, c: COLORS.accent });
  const habit = Math.round(num(s.smoker));
  if (habit > 0) {
    const sc2 = habit >= 60 ? COLORS.bad : habit >= 20 ? COLORS.accent : COLORS.text;
    pg.row('タバコの習慣', String(habit), { gauge: { frac: clamp(habit / 100, 0, 1), color: sc2 }, rc: sc2 });
    if (num(s.lostStamina)) pg.para(`吸いすぎで、体力の最大値が${num(s.lostStamina)}下がっている。`, { s: SMALL, c: COLORS.bad, x: 16 });
    pg.para('路上喫煙は条例で禁止の地区があり、過料をとられることも。吸うなら喫煙所で。', { s: SMALL, c: COLORS.dim, x: 16 });
  } else if (!minor) pg.para('タバコは吸っていない。お酒は飲みすぎず、飲んだら運転しない。', { s: SMALL, c: COLORS.dim });
  if (!minor) {
    const here = safe(() => g.canSmokeHere());
    // (a 過料 is a nominal amount fixed by the ordinance: shown as is in every era)
    if (here && g.map && g.map.placeId) pg.row('いまいる場所', here.ok ? 'タバコを吸える' : here.smokingArea ? '禁煙（喫煙所なら吸える）' : `禁煙${num(here.fine) ? `（過料${plainYen(here.fine)}）` : ''}`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: here.ok ? COLORS.text : COLORS.accent });
  }

  // ---- where to get help
  pg.block().head('困ったときは', C);
  {
    // 多重債務の相談窓口 2007年4月〜 (多重債務問題改善プログラム), 法テラス 2006年10月〜
    const app = PHONE_APPS.justice ? 'スマホの「借入・返済」の法律相談、' : ''; // (スマホ → the era's word: eraText)
    const ward = sinceYM(g, 2007, 4) ? 'ドット区役所3階の多重債務相談' : 'ドット区役所3階の区民相談室';
    const terrace = sinceYM(g, 2006, 10) ? '、法テラス' : sinceYM(g, 2000, 10) ? '、弁護士会の法律相談・法律扶助協会' : '、弁護士会の法律相談';
    pg.para(`・借金：${app}${ward}${terrace}`, { s: SMALL });
    if (!PHONE_APPS.justice) pg.para('（お金を借りると、スマホに「借入・返済」が出る）', { s: SMALL, c: COLORS.dim, x: 16 });
  }
  pg.para(`・闇金・ストーカー・詐欺：警視庁（永田町）の相談室${PLACES.koban ? '、ネオン街の交番' : ''}`, { s: SMALL });
  pg.para('・自己破産：裁判所（永田町）の破産係（弁護士に頼めなくても、本人申立てができる）', { s: SMALL });
  return pg;
}

// ---------------------------------------------------------------- tab: 政治
function politicsPage(g, ctx) {
  const st = g.state;
  const pg = new Page(ctx);
  const C = TC.politics;
  const day = st.day || 1;
  if (!hasPolitics(g)) {
    pg.block().head('政治', C).para('（政治のしくみを読み込めませんでした）', { s: SMALL, c: COLORS.dim });
    return pg;
  }
  const p = safe(() => g.pol(), null);
  const s = safe(() => g.politicsSummary(), null);
  if (!p || !s) {
    pg.block().head('政治', C).para('（政治のようすを読み込めませんでした）', { s: SMALL, c: COLORS.dim });
    return pg;
  }
  const me = p.me || {};
  const O = POL.OFFICES || {};
  const office = me.office && O[me.office];
  const age = ageOf(st);
  // the politics UI's own records (politics_ui.js flags.polui): an announced / finished retirement and
  // the career records written at each retirement (newest first)
  const polui = st.flags && st.flags.polui && typeof st.flags.polui === 'object' ? st.flags.polui : {};
  const retire = polui.retire && typeof polui.retire === 'object' ? polui.retire : null;
  const career = Array.isArray(polui.career) ? polui.career.filter((r) => r && typeof r === 'object') : [];

  // ---- you
  pg.block().head('あなたと政治', C);
  if (s.date && s.date.label) pg.row('いま', s.date.label, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.dim });
  if (office) {
    pg.row(office.label || office.name, me.district || '', { c: COLORS.accent, rs: SMALL, rc: COLORS.dim });
    pg.row('所属', (s.me && s.me.partyName) || '無所属');
    const posts = (s.me && s.me.posts) || [];
    if (posts.length) pg.row('役職', posts.join('・'), { rs: SMALL, rc: COLORS.accent });
    const fac = me.faction && Object.values(p.parties || {}).flatMap((pt) => pt.factions || []).find((f) => f.id === me.faction);
    if (fac) pg.row('派閥・グループ', fac.name, { s: SMALL, rs: SMALL, c: COLORS.dim });
    pg.row(`当選 ${num(me.wins)}回・落選 ${num(me.losses)}回`, me.termEnd ? `任期満了まで ${inDays(num(me.termEnd) - day)}` : '', { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.dim });
    const rep = clamp(Math.round(num(me.reputation)), -100, 100);
    pg.row('評判', String(rep), { gauge: { frac: (rep + 100) / 200, color: rep < 0 ? COLORS.bad : COLORS.good } });
    const ls = clamp(Math.round(num(me.localSupport)), 0, 100);
    pg.row('地元の支持', String(ls), { gauge: { frac: ls / 100, color: COLORS.cyan } });
    if (me.party) {
      const sd = clamp(Math.round(num(me.standing)), 0, 100);
      pg.row('党内の評価', String(sd), { gauge: { frac: sd / 100, color: '#b48cff' } });
    }
    if (retire && !retire.done) pg.para('政界引退を表明している（任期の終わりまで務める）。', { s: SMALL, c: COLORS.accent });
  } else {
    const running = !!safe(() => g.myElection());
    pg.row('いまは', running ? '民間人（立候補中）' : retire && retire.done ? '民間人（政界を引退）' : '民間人', { rc: running ? COLORS.good : COLORS.dim });
    if (me.party) pg.row('党員', safe(() => g.partyName(me.party), '') || '');
    if (!running) pg.para('立候補は、スマホの「政治」、永田町の党本部（選挙対策本部）、ドット区役所の選挙管理委員会から。', { s: SMALL, c: COLORS.dim });
  }
  // eligibility (age on today's date; the core checks the exact election day)
  const ban = safe(() => g.civicBanReason && g.civicBanReason('candidacy'));
  if (ban) pg.para('立候補できない：' + ban, { s: SMALL, c: COLORS.bad });
  else {
    const can = Object.values(O).filter((o) => age >= num(o.ageMin)).map((o) => o.short || o.name);
    const later = Object.values(O).filter((o) => age < num(o.ageMin));
    if (can.length) pg.para(`被選挙権：${can.join('・')}`, { s: SMALL, c: COLORS.text });
    if (later.length) {
      const ages = [...new Set(later.map((o) => num(o.ageMin)))].sort((a, b) => a - b);
      for (const a of ages) pg.para(`${a}歳から：${later.filter((o) => num(o.ageMin) === a).map((o) => o.short || o.name).join('・')}（${daysUntilAge(st, a)}）`, { s: SMALL, c: COLORS.dim });
    }
  }
  const va = votingAgeNow(g);
  const voteBan = safe(() => g.civicBanReason && g.civicBanReason('vote'));
  pg.row('選挙権（投票）', voteBan ? 'いまはない' : age >= va ? 'あり' : `${va}歳から`, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: voteBan ? COLORS.bad : age >= va ? COLORS.good : COLORS.dim });

  // ---- the career record (written when the player leaves politics: the latest one)
  if (career.length) {
    const r = career[0];
    const sm = { s: SMALL, rs: SMALL, c: COLORS.dim };
    pg.block().head('政治家としての歩み', C);
    pg.row(String(r.how || '政界引退'), String(r.date || ''), { c: COLORS.accent, rs: SMALL, rc: COLORS.dim });
    pg.row('最後の職', `${r.office || 'なし'}（${r.party || '無所属'}）`, sm);
    pg.row('政治家として', r.since ? `${r.since}の当選から${spanText(r.span)}` : '当選の経験はない', sm);
    pg.row('選挙', `当選${num(r.wins)}回${num(r.nationalWins) ? `（うち国政${num(r.nationalWins)}回）` : ''}・落選${num(r.losses)}回`, sm);
    if (num(r.pmDays)) pg.row('内閣総理大臣', spanText(r.pmDays), { ...sm, rc: COLORS.accent });
    if (num(r.ministerDays)) pg.row('国務大臣', spanText(r.ministerDays), sm);
    const posts = Array.isArray(r.posts) ? r.posts.slice(0, 3) : [];
    if (posts.length) pg.para(`主な役職：${posts.join('・')}${r.posts.length > 3 ? 'など' : ''}`, { s: SMALL, x: 16 });
    const titles = Array.isArray(r.lawTitles) ? r.lawTitles.slice(0, 2) : [];
    pg.para(`成立させた法律：${num(r.laws) ? `${num(r.laws)}本${titles.length ? `（${titles.map((t) => `「${t}」`).join('')}${num(r.laws) > titles.length ? 'など' : ''}）` : ''}` : 'なし'}`, { s: SMALL, x: 16 });
    if (r.einen) pg.para(`永年在職議員表彰（${r.einen}）`, { s: SMALL, c: COLORS.accent, x: 16 });
    pg.para(`${career.length > 1 ? `ほかに${career.length - 1}件の記録。` : ''}くわしくは、スマホの「政治」の「資金・活動」→「進退」で。引退しても、また立候補できる（政界復帰）。`, { s: SMALL, c: COLORS.dim });
  }

  // ---- elections
  const ups = (safe(() => g.upcomingElections(), []) || []).filter((e) => e && num(e.day) >= day).sort((a, b) => num(a.day) - num(b.day));
  pg.block().head('選挙', C);
  const mine = ups.find((e) => e.declared);
  if (mine) {
    pg.row(`立候補中：${mine.label}`, `投票 ${inDays(num(mine.day) - day)}`, { c: COLORS.good, rc: COLORS.accent, rs: SMALL });
    const f = safe(() => g.electionForecast(mine.id));
    if (f && f.chance != null) {
      const ch = num(f.chance);
      const word = ch >= 0.7 ? ['優勢', COLORS.good] : ch >= 0.4 ? ['接戦', COLORS.accent] : ['劣勢', COLORS.bad];
      pg.row('情勢', word[0], { s: SMALL, rs: SMALL, c: COLORS.dim, rc: word[1] });
    }
    // 公示 is only for the general elections of the two houses; every other election is 告示
    const kw = mine.kind === 'shugi' || mine.kind === 'sangi' ? '公示' : '告示';
    pg.para(day < num(mine.koji) ? `${kw}（${mine.kojiDate || ''}・${inDays(num(mine.koji) - day)}）までは「政治活動」だけ。` : '選挙運動の期間中。街頭演説や握手で支持を広げよう。', { s: SMALL, c: COLORS.dim, x: 16 });
  }
  // public elections first; another party's leadership race is only news (your own party's
  // race stays with the others, since you can stand in it)
  const otherRace = (e) => e.kind === 'sosaisen' && e.party !== me.party;
  const list = ups.filter((e) => e !== mine && !otherRace(e)).slice(0, 4);
  list.push(...ups.filter((e) => e !== mine && otherRace(e)).slice(0, Math.max(0, 5 - list.length)));
  if (!list.length && !mine) pg.para('予定されている選挙はない。', { s: SMALL, c: COLORS.dim });
  for (const e of list) {
    const news = e.newsOnly || otherRace(e);
    pg.row(e.label || '', e.date || `${e.day}日目`, { s: SMALL, rs: SMALL, c: news ? COLORS.dim : COLORS.text, rc: COLORS.dim, tag: news ? { t: e.newsOnly ? 'ニュース' : '他党', bg: '#4a4a6a' } : num(e.koji) <= day ? { t: '選挙中', bg: '#c87a1a' } : null });
  }

  // ---- the Diet
  pg.block().head('国会', C);
  const ses = s.diet && s.diet.session;
  if (ses) pg.row(`${ses.kind || '国会'}の会期中`, ses.end ? `会期末まで ${inDays(num(ses.end) - day)}` : '', { c: COLORS.accent, rs: SMALL, rc: COLORS.dim });
  else pg.row('国会は閉会中', '', { c: COLORS.dim });
  if (s.diet && s.diet.shugi && s.diet.shugi.dissolved) pg.para('衆議院は解散中。総選挙で新しい議員が決まる。', { s: SMALL, c: COLORS.accent });
  if (s.diet && s.diet.nejire) pg.para('ねじれ国会：衆議院と参議院で多数派がちがう。', { s: SMALL, c: COLORS.dim });
  for (const h of ['shugi', 'sangi']) {
    const H = s.diet && s.diet[h];
    if (!H || !Array.isArray(H.seats)) continue;
    const top = H.seats.slice(0, 3).map((x) => `${x.name}${x.n}`).join('・');
    pg.row(`${h === 'shugi' ? '衆議院' : '参議院'}（${num(H.total)}）`, top, { s: SMALL, rs: SMALL, c: COLORS.dim, rc: COLORS.text });
  }
  const bills = (safe(() => g.billsList({ mine: true }), []) || []).slice(-5).reverse();
  if (bills.length) {
    pg.para('あなたの法案', { s: SMALL, c: COLORS.cyan });
    for (const b of bills) {
      const [w, c] = BILL_STAGE[b.stage] || [b.stage || '', COLORS.dim];
      pg.row(`「${b.title || ''}」`, w, { s: SMALL, rs: SMALL, rc: c, x: 8 });
    }
  } else if (office && office.level === 'national') pg.para('議員立法は、スマホの「政治」の「政策・法案」から。', { s: SMALL, c: COLORS.dim });
  if (office && office.level === 'national') {
    const today = safe(() => g.billsList({ house: me.office, today: true }), []) || [];
    if (today.length) pg.para(`きょうの本会議・委員会：${today.length}本。国会に出席しよう。`, { s: SMALL, c: COLORS.accent });
  }

  // ---- the cabinet
  pg.block().head('内閣', C);
  const cab = s.cabinet || {};
  if (cab.pm) {
    const ap = clamp(num(cab.approval), 0, 100);
    pg.row(`${cab.pm === 'player' ? 'あなた' : cab.pmName || '？'}の内閣`, `支持率 ${ap}%`, { c: cab.pm === 'player' ? COLORS.accent : COLORS.text, rc: ap < 30 ? COLORS.bad : ap >= 50 ? COLORS.good : COLORS.text });
    if ((cab.parties || []).length) pg.para(`与党：${cab.parties.join('・')}`, { s: SMALL, c: COLORS.dim });
    const myPost = (cab.ministers || []).find((m) => m.who === 'player');
    if (myPost) pg.para(`あなたは「${myPost.name}」。閣議は官邸で（火曜・金曜）。`, { s: SMALL, c: COLORS.accent });
  } else pg.para('総理大臣が決まっていない（首班指名を待っている）。', { s: SMALL, c: COLORS.dim });

  // ---- party support
  const sup = (s.support || []).filter((x) => num(x.pct) > 0).slice(0, 5);
  if (sup.length) {
    pg.block().head('政党の支持率', C);
    for (const x of sup) {
      const col = (p.parties && p.parties[x.id] && p.parties[x.id].color) || '#8a90a6';
      const full = (p.parties && p.parties[x.id] && p.parties[x.id].name) || x.name || '';
      const nm = Array.from(String(full)).length > 9 ? Array.from(String(full)).slice(0, 8).join('') + '…' : String(full);
      pg.row(nm, `${pctText(x.pct)}`, { s: SMALL, rs: SMALL, gauge: { frac: clamp(num(x.pct) / 50, 0, 1), color: col }, c: x.id === me.party ? COLORS.accent : COLORS.text });
    }
    pg.para('支持率は、層ごとの世論調査の推計。', { s: SMALL, c: COLORS.dim });
  }

  // ---- the economy
  const E = s.economy;
  if (E) {
    pg.block().head('経済', C);
    pg.row('経済成長率', pctText(E.growth), { s: SMALL, rs: SMALL, rc: num(E.growth) < 0 ? COLORS.bad : COLORS.text });
    pg.row('物価の上がり方', pctText(E.inflation), { s: SMALL, rs: SMALL });
    pg.row('失業率', pctText(E.unemployment), { s: SMALL, rs: SMALL });
    pg.row('円相場・日経平均', `1ドル＝${plainYen(E.yen)}・${plainYen(E.nikkei)}`, { s: SMALL, rs: SMALL });
    pg.row('政府の借金（GDP比）', `${Math.round(num(E.debtRatio))}%`, { s: SMALL, rs: SMALL, rc: num(E.debtRatio) >= 200 ? COLORS.accent : COLORS.text });
  }

  // ---- money
  if (office || num(me.funds) || num(me.secret) || me.formerOffice) {
    pg.block().head('政治とお金', C);
    pg.row('政治資金', fmtMoney(num(me.funds)), { rc: COLORS.accent });
    pg.para('政治資金は自分のお金とは別。毎年、収支報告書に正しく書いて出すのがルール（政治資金規正法）。', { s: SMALL, c: COLORS.dim, x: 16 });
    if (num(me.secret) > 0) {
      pg.row('帳簿にないお金（裏金）', fmtMoney(num(me.secret)), { c: COLORS.bad, rc: COLORS.bad });
      pg.para('収支報告書に書かないお金は政治資金規正法違反（不記載）。見つかれば捜査を受け、有罪になると公民権停止で議員の職を失うこともある。', { s: SMALL, c: COLORS.bad, x: 16 });
    }
  }
  return pg;
}

// ---------------------------------------------------------------- tab: ばしょ
function placesPage(g, ctx) {
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);
  const here = g.map && g.map.placeId;
  // a party's headquarters only while the party exists (民主党 1998〜2016), the prison only once
  // the player has been there, and no place whose module is not registered (not built yet, or
  // failed to load); a place already visited always stays listed
  const parties = safe(() => (hasPolitics(g) ? g.pol().parties : null), null) || {};
  const built = (id) => !PLACES.tokyo || !!PLACES[id];
  const shown = (id) => visited[id] || (built(id) && !GUIDE[id].secret && (!GUIDE[id].party || !!parties[GUIDE[id].party]));
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id] && shown(id));
  const counted = ids.filter((id) => !GUIDE[id].secret);
  const count = (town) => counted.filter((id) => GUIDE[id].town === town && visited[id]).length + '/' + counted.filter((id) => GUIDE[id].town === town).length;
  const towns = Object.keys(TOWNS).filter((t) => ids.some((id) => GUIDE[id].town === t));
  pg.block(6).row(`行った場所 ${counted.filter((id) => visited[id]).length}/${counted.length}`, towns.map((t) => `${TOWNS[t]} ${count(t)}`).join('・'), { c: COLORS.accent, rs: SMALL, rc: COLORS.dim });
  for (const id of ids) {
    const p = GUIDE[id];
    const tag = { t: p.tag || TOWNS[p.town], bg: p.tagBg || TOWN_BG[p.town] };
    pg.block(7);
    if (!visited[id]) {
      pg.line({ t: '？？？', c: COLORS.dim, tag });
      pg.para('ヒント：' + (p.hint || '街を歩いてさがしてみよう'), { s: SMALL, c: COLORS.dim, x: 12 });
      continue;
    }
    const mark = id === here;
    const live = p.liveName ? safe(() => (PLACES[id] && PLACES[id].name) || '', '') : '';
    pg.line({ t: live || p.name, c: mark ? COLORS.accent : COLORS.text, tag, mark, badge: p.audition ? { t: 'オーディション', c: COLORS.pink } : mark ? { t: 'いまここ', c: COLORS.accent } : null });
    for (const l of p.lines || []) pg.para(l, { s: SMALL, x: 12, mark });
  }
  return pg;
}

// ---------------------------------------------------------------- tab: きろく
function recordPage(g, ctx) {
  const st = g.state;
  const stats = st.stats || {};
  const pg = new Page(ctx);
  const visited = visitedPlaces(g);
  const ids = GUIDE_ORDER.filter((id) => GUIDE[id]);

  const pf = st.profile;
  pg.block().row(pf ? fullName(pf) : st.name, `${rankName(st.fame)}　★${st.fame}`, { c: COLORS.accent, rc: COLORS.pink });
  pg.row('所属', st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency].name : 'フリー（未所属）');
  const pm = st.playMinutes || 0;
  pg.row('日数', g.dayLabel ? g.dayLabel() : `${st.day}日目`);
  pg.row('プレイ時間', pm >= 60 ? `${Math.floor(pm / 60)}時間${pm % 60}分` : `${pm}分`);

  if (pf) {
    pg.block().head('プロフィール');
    const d = daysToBirthday(st);
    pg.row('年齢', `${ageOf(st)}さい`, { rc: COLORS.accent });
    pg.para(isBirthday(st) ? '今日は誕生日！おめでとう！' : `次の誕生日まで あと${d}日`, { s: SMALL, c: isBirthday(st) ? COLORS.pink : COLORS.dim, x: 12 });
    pg.row('性別', (GENDERS[pf.gender] || GENDERS.x).name);
    pg.row('出身', `${prefecture(pf.hometown).name}（${regionOf(pf.hometown).name}）`);
    const per = PERSONALITIES[pf.personality];
    if (per) {
      pg.row('性格', per.name, { rc: COLORS.cyan });
      pg.para(`${per.desc}（${personalityEffects(pf.personality)}）`, { s: SMALL, c: COLORS.dim, x: 12 });
    }
    pg.row('時代', ERA.label);
    pg.para(`${ERA.year}。${ERA.device}を持って、芸能界へ。`, { s: SMALL, c: COLORS.dim, x: 12 });

    pg.block().head('家族', COLORS.pink);
    const fam = sortFamily(Array.isArray(pf.family) ? pf.family : []);
    if (!fam.length) pg.para('ひとりで上京してきた。いまは仲間が家族みたいなもの。', { s: SMALL, c: COLORS.dim });
    for (const m of fam) {
      const rel = RELATIONS[m.rel] ? RELATIONS[m.rel].name : '家族';
      pg.row(`${rel}　${m.name}`, m.alive ? '元気' : '空から見守っている', { rc: m.alive ? COLORS.good : COLORS.dim, rs: m.alive ? BODY : SMALL });
      if (!m.alive) {
        const why = CAUSES[m.cause] && CAUSES[m.cause].text;
        pg.para(`${why ? why + '旅立った。' : ''}いまも、心の支え。`, { s: SMALL, c: COLORS.dim, x: 12 });
      }
    }
  }

  pg.block().head('あゆみ');
  pg.row('こなしたお仕事', `${stats.jobs || 0}回`);
  pg.row('ミニゲーム', `${stats.minigames || 0}回`);
  pg.row('行った場所', `${ids.filter((id) => visited[id]).length}/${ids.length}`);
  pg.row('ファン', `${Math.max(0, Math.round(st.fans || 0)).toLocaleString('ja-JP')}人`, { rc: COLORS.pink });
  const people = Object.keys(st.people || {}).filter((id) => PEOPLE[id] && st.people[id]);
  if (people.length) pg.row('知り合い', `${people.length}人（友だち以上 ${people.filter((id) => heartIndex(Number(st.people[id].aff) || 0) >= 2).length}人）`);
  if (st.partner && PEOPLE[st.partner]) pg.row('相方', PEOPLE[st.partner].name, { rc: COLORS.accent });
  const regCount = Object.keys(st.regulars || {}).reduce((a, id) => a + (Number(st.regulars[id] && st.regulars[id].count) || 0), 0);
  if (regCount) pg.row('レギュラー番組の出演', `${regCount}回`);
  if (g.housing) pg.row('住まい', g.housing().name || '');
  if (st.flags && st.flags.finaleDone) pg.row('年末の大型歌番組', '出演！', { rc: COLORS.accent });
  const aw = st.flags && st.flags.career_award && st.flags.career_award.wins;
  const grand = aw ? Number(aw.grand) || 0 : 0;
  const prizes = aw ? Object.values(aw).reduce((a, v) => a + (Number(v) || 0), 0) : 0;
  if (prizes) pg.row('ドット芸能大賞', `${grand ? `大賞${grand}回` : `受賞${prizes}回`}${st.flags.career_award.hof ? '・殿堂入り' : ''}`, { rc: COLORS.accent });
  if (st.flags && Number(st.flags.career_no1Weeks)) pg.row('好感度ランキング1位', `通算${Number(st.flags.career_no1Weeks)}週`, { rc: COLORS.pink });

  pg.block().head('ミニゲームのベストランク');
  const best = stats.bestRanks || {};
  const mgIds = [...MG_ORDER.filter((id) => MINIGAMES[id]), ...Object.keys(MINIGAMES).filter((id) => !MG_ORDER.includes(id))];
  for (const id of mgIds) {
    const title = (MINIGAMES[id] && MINIGAMES[id].title) || id;
    const r = best[id];
    pg.row(title, r ? `ランク ${r}` : '―', { rc: r ? RANK_COLOR[r] || COLORS.text : COLORS.dim });
  }

  // most-done jobs (ids from GUIDE_JOBS; unknown ids are left out). Counted per job, so
  // two jobs with the same name at different places (ミュージカル主演) stay apart.
  const done = st.jobs || {};
  const top = GUIDE_JOBS.map((j) => [j, j.ids.reduce((a, id) => a + (Number(done[id]) || 0), 0)])
    .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    pg.block().head('よく受けたお仕事');
    for (const [j, n] of top) {
      const twin = GUIDE_JOBS.some((o) => o !== j && o.label === j.label);
      pg.row('・' + j.label + (twin && GUIDE[j.place] ? `（${GUIDE[j.place].short}）` : ''), `${n}回`);
    }
  }
  return pg;
}

// The kit the comedy pages (notebook_pages.js) build with.
const KIT = {
  Page, BODY, SMALL, COLORS, TC, safe, num, inDays, fmtMoney,
  vw: () => VW, vh: () => VH, WEEKDAYS, weekdayOf, myRegulars, REGULARS, showWords, AGENCIES, daysToBirthday, YEAR_DAYS,
  housing: null, // g.housing, bound when the notebook opens
};

// ---------------------------------------------------------------- header: date, weather, clock
// g.clock() / g.weather() (time and weather, another module): shown only when present, whatever
// shape they return (a string, or an object with text / label / hour + minute …).
function clockText(g) {
  if (typeof g.clock !== 'function') return '';
  const c = safe(() => g.clock(), null);
  if (c == null) return '';
  if (typeof c === 'string' || typeof c === 'number') return String(c);
  if (typeof c.text === 'string' && c.text) return c.text;
  const h = Number(c.hour ?? c.h);
  const t = Number.isFinite(h) ? `${Math.floor(h)}:${String(Math.floor(num(c.minute ?? c.min ?? c.m))).padStart(2, '0')}` : '';
  const ph = [c.phaseLabel, c.periodLabel, c.label, c.name].find((v) => typeof v === 'string' && v) || '';
  return [ph, t].filter(Boolean).join(' ');
}
function weatherText(g) {
  if (typeof g.weather !== 'function') return '';
  const w = safe(() => g.weather(), null);
  if (w == null) return '';
  if (typeof w === 'string') return w;
  const nm = [w.text, w.label, w.name].find((v) => typeof v === 'string' && v) || '';
  const tp = Number.isFinite(Number(w.temp ?? w.temperature)) && (w.temp ?? w.temperature) !== null ? `${Math.round(Number(w.temp ?? w.temperature))}℃` : '';
  return [nm, tp].filter(Boolean).join(' ');
}
function headerInfo(g) {
  const st = g.state;
  let date = '';
  if (typeof g.gameDate === 'function') {
    const d = safe(() => g.gameDate(), null);
    if (d && d.month) date = `${d.year ? d.year + '年' : ''}${d.month}月${d.dom}日（${WEEKDAYS[weekdayOf(st.day)]}）`;
  }
  if (!date) date = g.dayLabel ? g.dayLabel() : `${st.day}日目`;
  return [date, weatherText(g), clockText(g)].filter(Boolean).join('　');
}

// ---------------------------------------------------------------- scene
let THEME = themeFor('reiwa');
const TURN_FR = 10; // page-turn frames
const inR = (x, y, r) => r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
let tapCanvas = null;
function bindTap(g) {
  const cv = g && g.canvas;
  if (!cv || tapCanvas === cv || typeof cv.addEventListener !== 'function') return;
  tapCanvas = cv;
  cv.addEventListener('pointerdown', (e) => {
    const sc = g.top;
    if (!sc || !sc.isNotebook) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    sc.tapAt = { x: ((e.clientX - r.left) * SW) / r.width, y: ((e.clientY - r.top) * SH) / r.height };
  }, { passive: true });
}

export class NotebookScene {
  constructor(g, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.hd = true;
    this.opaque = true; // covers the whole screen
    this.hidesHud = true; // MapScene skips the HUD while this is open
    this.isNotebook = true;
    this.tab = clamp(lastTab, 0, TABS.length - 1);
    this.month = 0; // カレンダー: months from now
    ERA = eraOf(g.state);
    THEME = themeFor(g.state && g.state.profile && g.state.profile.era);
    KIT.housing = typeof g.housing === 'function' ? () => g.housing() : null;
    this.head = safe(() => headerInfo(g), '') || '';
    // red dots on the tabs (cheap reads only)
    const u = safe(() => urgentNotes(g), []) || [];
    const cn = safe(() => comedyNotes(g, KIT), []) || [];
    this.alerts = { law: u.some((n) => n[2] === 'law'), politics: u.some((n) => n[2] === 'politics'), contest: cn.some((n) => n[2] === 'contest'), owarai: cn.some((n) => n[2] === 'owarai' && n[1] === COLORS.bad) };
    this.relayout(isTouch());
    bindTap(g);
  }

  relayout(touch) {
    this.touchLayout = touch;
    applyLayout(touch);
    this.pages = TABS.map(() => null); // built when first shown
    this.scroll = TABS.map(() => 0); // index into page.stops per tab
    this.shown = 0; // drawn pixel offset (eases toward the target)
    this.turn = null;
  }

  pageAt(i) {
    if (!this.pages[i]) {
      let p;
      try { p = TABS[i].build(this.g, this.g.ctx, this); } catch (e) { console.error('[notebook]', TABS[i].id, e); p = null; }
      if (!p || !p.blocks) p = new Page(this.g.ctx).block().para('（読み込めませんでした）');
      void p.stops; // lay out once
      this.pages[i] = p;
    }
    return this.pages[i];
  }

  get page() { return this.pageAt(this.tab); }

  offsetOf(i) { return this.page.stops[i] || 0; }

  maxScroll() { return this.page.stops.length - 1; }

  setScroll(v, animate = true) {
    const s = clamp(v, 0, this.maxScroll());
    this.scroll[this.tab] = s;
    if (!animate) this.shown = this.offsetOf(s);
  }

  // "next page": the stop that brings the first line not entirely on screen to the top
  nextPage() {
    const s = this.scroll[this.tab];
    const o = this.offsetOf(s);
    const cut = this.page.lineTops.find((l) => l.y + l.h > o + VH);
    let j = s + 1;
    if (cut) while (j + 1 < this.page.stops.length && this.page.stops[j + 1] <= cut.y) j++;
    return j;
  }

  // switch to tab i with a page turn (dir: +1 the page leaves to the left)
  setTab(i, dir) {
    i = ((i % TABS.length) + TABS.length) % TABS.length;
    if (i === this.tab) return;
    this.turn = { page: this.page, tab: this.tab, off: Math.round(this.shown), t: 0, dir: dir || (i > this.tab ? 1 : -1) };
    this.tab = i;
    lastTab = i;
    this.setScroll(this.scroll[i], false);
    audio.sfx('cursor');
  }

  // カレンダー: another month (the same page turn)
  setMonth(m) {
    m = clamp(m, -2, 6);
    if (m === this.month) return;
    const ci = TABS.findIndex((t) => t.id === 'cal');
    this.turn = { page: this.pageAt(ci), tab: ci, off: 0, t: 0, dir: m > this.month ? 1 : -1 };
    this.month = m;
    this.pages[ci] = null;
    this.scroll[ci] = 0;
    this.shown = 0;
    audio.sfx('cursor');
  }

  close() {
    audio.sfx('cancel');
    lastTab = this.tab;
    this.g.pop(this);
    this.resolve();
  }

  // a tap / click: tabs, ×, the month arrows and the scrollbar; true when handled (A is dropped)
  handleTap(tap) {
    const inp = this.g.input;
    const now = inp.pressedNow || {};
    const done = () => { now.a = false; return true; };
    if (this.touchLayout) {
      if (tap.y < TB) {
        if (tap.x >= SW - TB) { now.a = false; this.close(); return true; }
        const grp = Math.floor(this.tab / GROUP);
        if (tap.x < TB) { const o = (grp + 1) % 2; this.setTab(o * GROUP + (this.tab % GROUP), o > grp ? 1 : -1); return done(); }
        const k = clamp(Math.floor((tap.x - TB) / ((SW - 2 * TB) / GROUP)), 0, GROUP - 1);
        this.setTab(grp * GROUP + k);
        return done();
      }
    } else {
      for (let i = 0; i < TABS.length; i++) if (inR(tap.x, tap.y, this.tabRect(i))) { this.setTab(i); return done(); }
    }
    const cal = this.page.cal;
    if (cal && cal.rects && tap.y >= cal.rects.y && tap.y < cal.rects.y + cal.rects.h) {
      if (tap.x >= cal.rects.prev.x && tap.x < cal.rects.prev.x + cal.rects.prev.w) { this.setMonth(this.month - 1); return done(); }
      if (tap.x >= cal.rects.next.x && tap.x < cal.rects.next.x + cal.rects.next.w) { this.setMonth(this.month + 1); return done(); }
    }
    // the scrollbar column: upper half up, lower half down
    if (this.maxScroll() > 0 && tap.x >= SB_X - 16 && tap.x < PX + PW && tap.y >= VY && tap.y < VY + VH) {
      const s = this.scroll[this.tab];
      this.setScroll(tap.y < VY + VH / 2 ? s - 1 : s + 1);
      audio.sfx('cursor');
      return done();
    }
    return false; // anywhere else: A (next page / next month)
  }

  update(g) {
    this.t++;
    if (g.auto) { g.pop(this); this.resolve(); return; }
    if (isTouch() !== this.touchLayout) this.relayout(isTouch());
    if (this.turn && ++this.turn.t >= TURN_FR) this.turn = null;
    const inp = g.input;
    const tap = this.tapAt;
    this.tapAt = null;
    if (tap && this.t > 3 && this.handleTap(tap)) return;
    if (this.t > 3 && (inp.pressed('b') || inp.pressed('menu'))) { this.close(); return; }
    if (inp.pressed('left') || inp.pressed('right')) {
      const d = inp.pressed('left') ? -1 : 1;
      this.setTab(this.tab + d, d);
    }
    const isCal = !!this.page.cal;
    const s = this.scroll[this.tab];
    const max = this.maxScroll();
    if (isCal && max === 0) {
      // カレンダー: ↑↓ and A change the month
      if (inp.repeat('up')) this.setMonth(this.month - 1);
      else if (inp.repeat('down')) this.setMonth(this.month + 1);
      else if (inp.pressed('a') && this.t > 3) this.setMonth(this.month >= 6 ? 0 : this.month + 1);
    } else {
      if (inp.repeat('up') && s > 0) { this.setScroll(s - 1); audio.sfx('cursor'); }
      if (inp.repeat('down') && s < max) { this.setScroll(s + 1); audio.sfx('cursor'); }
      if (inp.pressed('a') && this.t > 3 && max > 0) {
        // A: next page, and back to the top after the last one
        this.setScroll(s >= max ? 0 : this.nextPage(), s < max);
        audio.sfx('cursor');
      }
    }
    const target = this.offsetOf(this.scroll[this.tab]);
    this.shown += (target - this.shown) * 0.4;
    if (Math.abs(target - this.shown) < 0.5) this.shown = target;
  }

  // desktop: the side index tab i
  tabRect(i) {
    const sel = i === this.tab;
    const y = IDX.y + i * (IDX.h + IDX.gap) + (i >= GROUP ? IDX.groupGap : 0);
    return sel ? { x: IDX.x - 4, y, w: IDX.w + 4, h: IDX.h } : { x: IDX.x, y, w: IDX.w - 4, h: IDX.h };
  }

  draw(ctx) {
    if (isTouch() !== this.touchLayout) this.relayout(isTouch());
    drawBackdrop(ctx, THEME, LAYOUT);
    const color = TABS[this.tab].color;
    const pg = this.page;
    const off = Math.round(this.shown);
    const settled = off === Math.round(this.offsetOf(this.scroll[this.tab]));
    this.drawHeader(ctx, this.tab);
    this.drawBody(ctx, pg, off, settled, color);

    // the page turning away (the old page, clipped to what is left of it)
    const tn = this.turn;
    if (tn) {
      const p = Math.min(1, (tn.t + 1) / TURN_FR);
      const e = 1 - (1 - p) * (1 - p);
      const w = Math.round(PW * (1 - e));
      const x0 = tn.dir > 0 ? PX : PX + PW - w;
      if (w > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, PY, w, PH);
        ctx.clip();
        drawPaperPart(ctx, THEME, LAYOUT, PX, PY, PW, PH);
        this.drawHeader(ctx, tn.tab);
        this.drawBody(ctx, tn.page, tn.off, true, TABS[tn.tab].color, true);
        ctx.restore();
        pageTurnEdge(ctx, THEME, tn.dir > 0 ? x0 + w : x0, PY + 1, PH - 2, tn.dir);
      }
    }

    if (this.touchLayout) this.drawTouchBar(ctx);
    else this.drawIndex(ctx);

    if (LAYOUT.foot) {
      const hint = pg.cal && this.maxScroll() === 0 ? '←→ タブ　↑↓ 月をかえる　B とじる' : '←→ タブ　↑↓ スクロール　A つぎへ　B とじる';
      text(ctx, hint, PX + PW / 2, PY + PH - 24, { size: SMALL, align: 'center', color: THEME.footer, shadow: THEME.dark ? undefined : null });
    }
  }

  drawHeader(ctx, ti) {
    const tb = TABS[ti];
    const c = inkOf(THEME, tb.color);
    const H = LAYOUT.head;
    const hx = PX + 26, hy = PY + H.y, iw = 12 * H.icon + 8;
    icon(ctx, tb.id, hx, hy + (H.icon === 1 ? 3 : 0), c, H.icon);
    text(ctx, tb.label, hx + iw, hy + 2, { size: H.size, color: c, shadow: THEME.dark ? shade(tb.color, -0.6) : null });
    const tw = measure(ctx, tb.label, H.size);
    if (this.head) {
      // the date (and weather / clock when the game has them), as far as there is room
      const room = PW - 26 - iw - tw - 30;
      let s = this.head;
      while (s.length > 4 && measure(ctx, s, SMALL) > room) s = s.slice(0, -2);
      text(ctx, s, PX + PW - 18, hy + (H.size - SMALL) / 2 + 2, { size: SMALL, align: 'right', color: inkOf(THEME, COLORS.dim), shadow: THEME.dark ? undefined : null });
    }
    rect(ctx, PX + 22, VY - 7, PW - 44, 2, c);
    rect(ctx, PX + 22, VY - 5, PW - 44, 1, THEME.dark ? shade(tb.color, -0.5) : shade(THEME.paper, -0.12));
  }

  drawBody(ctx, pg, off, settled, color, still = false) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(VX - 14, VY - 4, VW + 16, VH + 6);
    ctx.clip();
    let y = VY - off;
    for (const b of pg.blocks) {
      if (y > VY + VH) break;
      if (b.sticky && y + b.h > VY - 4) drawSticky(ctx, y, b.h, b.sticky);
      b.lines.forEach((l, i) => {
        // at rest a heading is not left alone at the bottom without its first line
        const after = l.head && b.lines[i + 1] ? b.lines[i + 1].h : 0;
        if (y + l.h > VY - 2 && y < VY + VH && !(settled && (y < VY - 1 || y + l.h + after > VY + VH + 2))) drawLine(ctx, l, y);
        y += l.h;
      });
      y += b.gap;
    }
    ctx.restore();
    if (still) return;

    // scrollbar + arrows
    const max = this.maxScroll();
    if (max > 0) {
      // track between the ▲ / ▼ marks
      const TY = VY + 12, TH = VH - 24;
      const total = this.offsetOf(max) + VH;
      const th = Math.max(14, Math.round((TH * VH) / total));
      const ty = TY + Math.round(((TH - th) * clamp(this.shown, 0, this.offsetOf(max))) / this.offsetOf(max));
      rect(ctx, SB_X, TY, 4, TH, THEME.track);
      rect(ctx, SB_X, ty, 4, th, color);
      rect(ctx, SB_X, ty, 1, th, shade(color, 0.35));
      const s = this.scroll[this.tab];
      const ac = THEME.dark ? '#ffffff' : inkOf(THEME, COLORS.text);
      if (s > 0) upArrow(ctx, SB_X - 2, VY, this.t, ac);
      if (s < max) downArrow(ctx, SB_X - 2, VY + VH - 8, this.t, ac);
    }
  }

  // desktop: index tabs down the right edge (two groups), the open one joined to the page
  drawIndex(ctx) {
    TABS.forEach((tb, i) => {
      const r = this.tabRect(i);
      const sel = i === this.tab;
      const bg = sel ? tb.color : THEME.dark ? '#161d3a' : shade(tb.color, THEME.tabMix);
      rect(ctx, r.x, r.y + 1, r.w + 1, r.h, 'rgba(0,0,0,0.35)');
      rect(ctx, r.x, r.y, r.w, r.h, bg);
      rect(ctx, r.x, r.y, r.w, 1, shade(bg, 0.3));
      rect(ctx, r.x + r.w - 1, r.y, 1, r.h, shade(bg, -0.35));
      rect(ctx, r.x, r.y + r.h - 1, r.w, 1, shade(bg, -0.35));
      rect(ctx, r.x + r.w - 1, r.y, 1, 1, THEME.cover);
      rect(ctx, r.x + r.w - 1, r.y + r.h - 1, 1, 1, THEME.cover);
      if (!sel && THEME.dark) rect(ctx, r.x + 1, r.y + 4, 2, r.h - 8, tb.color);
      if (sel) rect(ctx, r.x, r.y + 2, 3, r.h - 4, shade(tb.color, 0.35));
      const fc = sel ? '#ffffff' : THEME.dark ? COLORS.dim : THEME.tabDim;
      icon(ctx, tb.id, r.x + 6, r.y + 9, sel ? '#ffffff' : THEME.dark ? tb.color : THEME.tabDim);
      const size = measure(ctx, tb.label, 13) > r.w - 26 ? 12 : 13;
      text(ctx, tb.label, r.x + 21, r.y + (size === 13 ? 7 : 8), { size, color: fc, shadow: shade(bg, -0.55) });
      if (this.alerts[tb.id]) { rect(ctx, r.x + r.w - 9, r.y + 3, 6, 6, '#20090c'); rect(ctx, r.x + r.w - 8, r.y + 4, 4, 4, COLORS.bad); }
    });
  }

  // touch: one group of five tabs (70 units tall), the group switch on the left and the × on the right
  drawTouchBar(ctx) {
    const grp = Math.floor(this.tab / GROUP);
    const tw = (SW - 2 * TB) / GROUP;
    rect(ctx, 0, 0, SW, TB, THEME.dark ? '#0b1022' : shade(THEME.cover, -0.25));
    // group switch
    const other = TABS.slice(((grp + 1) % 2) * GROUP, ((grp + 1) % 2) * GROUP + GROUP);
    rect(ctx, 1, 1, TB - 3, TB - 4, THEME.dark ? '#1a2244' : shade(THEME.cover, 0.12));
    // a big arrow: ▶ to the second group, ◀ back to the first
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 12; i++) ctx.fillRect(grp ? TB / 2 + 6 - i : TB / 2 - 6 + i, 10 + i, 1, (12 - i) * 2 - 1 > 0 ? 24 - 2 * i : 1);
    text(ctx, grp ? 'まえへ' : 'つぎへ', TB / 2, 42, { size: 13, align: 'center', color: '#ffffff' });
    for (let k = 0; k < 2; k++) rect(ctx, TB / 2 - 9 + k * 12, 60, 6, 4, k === grp ? '#ffd23f' : '#5a6080');
    if (other.some((t) => this.alerts[t.id])) { rect(ctx, TB - 14, 5, 7, 7, '#20090c'); rect(ctx, TB - 13, 6, 5, 5, COLORS.bad); }
    for (let k = 0; k < GROUP; k++) {
      const i = grp * GROUP + k;
      const tb = TABS[i];
      const sel = i === this.tab;
      const x = Math.round(TB + k * tw), w = Math.round(TB + (k + 1) * tw) - x;
      const bg = sel ? tb.color : THEME.dark ? '#161d3a' : shade(tb.color, THEME.tabMix - 0.12);
      rect(ctx, x + 1, 2, w - 2, sel ? TB + 2 : TB - 5, bg);
      rect(ctx, x + 1, 2, w - 2, 1, shade(bg, 0.3));
      if (!sel) rect(ctx, x + 1, TB - 6, w - 2, 3, tb.color);
      icon(ctx, tb.id, x + w / 2 - 12, 9, sel ? '#ffffff' : THEME.dark ? tb.color : THEME.tabDim, 2);
      const size = measure(ctx, tb.label, 15) > w - 8 ? 13 : 15;
      text(ctx, tb.label, x + w / 2, 40, { size, align: 'center', color: sel ? '#ffffff' : THEME.dark ? COLORS.dim : THEME.tabDim, shadow: shade(bg, -0.55) });
      if (this.alerts[tb.id]) { rect(ctx, x + w - 14, 6, 8, 8, '#20090c'); rect(ctx, x + w - 13, 7, 6, 6, COLORS.bad); }
    }
    rect(ctx, SW - TB + 1, 2, TB - 3, TB - 5, '#3a1a2a');
    text(ctx, '×', SW - TB / 2, TB / 2 - 14, { size: 24, align: 'center', color: '#ffffff' });
  }
}

function drawSticky(ctx, y, h, kind) {
  const bad = kind === 'bad';
  const bg = bad ? THEME.stickyBad : THEME.sticky, edge = bad ? THEME.stickyBadEdge : THEME.stickyEdge;
  const x = VX - 12, w = VW + 8;
  if (THEME.dark) {
    rect(ctx, x, y - 3, w, h + 4, bg);
    rect(ctx, x, y - 3, 3, h + 4, edge);
    return;
  }
  rect(ctx, x + 2, y - 1, w, h + 4, 'rgba(80,60,20,0.18)');
  rect(ctx, x, y - 3, w, h + 4, bg);
  rect(ctx, x, y + h, w, 1, edge);
  // folded corner and a piece of tape
  ctx.fillStyle = edge;
  for (let i = 0; i < 8; i++) ctx.fillRect(x + w - 8 + i, y + h - i, 8 - i, 1);
  rect(ctx, x + 18, y - 6, 34, 7, 'rgba(255,255,255,0.55)');
}

function upArrow(ctx, x, y, t = 0, color = '#fff') {
  const o = Math.floor(t / 10) % 2;
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 - i, y + 3 - o + i, i * 2 + 1, 1);
}

// 13x11 heart (filled or empty).
const HEART = [
  '..ooo...ooo..',
  '.ohhfo.offfo.',
  'ohhfffofffffo',
  'ohfffffffffso',
  'offffffffffso',
  '.offffffffso.',
  '..offffffso..',
  '...offffso...',
  '....offso....',
  '.....oso.....',
  '......o......',
];
const HEART_FULL = { o: '#5a1430', h: '#ffd0e4', f: '#ff5f9e', s: '#d63a7a' };
function heart(ctx, x, y, full) {
  const pal = full ? HEART_FULL : THEME.heartEmpty;
  for (let j = 0; j < HEART.length; j++) {
    for (let i = 0; i < HEART[j].length; i++) {
      const ch = HEART[j][i];
      if (ch !== '.') { ctx.fillStyle = pal[ch]; ctx.fillRect(x + i, y + j, 1, 1); }
    }
  }
}

// drawing kit for custom lines (notebook_pages.js)
const DK = {
  get th() { return THEME; },
  ink: (c) => inkOf(THEME, c),
  text: (c, s, x, y, o) => text(c, s, x, y, o),
  rect, measure,
  get shadow() { return THEME.dark ? undefined : null; },
};

function drawLine(ctx, l, y) {
  let x = VX + (l.x || 0);
  const ink = (c) => inkOf(THEME, c);
  const sh = THEME.dark ? undefined : null; // no drop shadow on paper
  if (l.mark) rect(ctx, VX - 10, y + 1, 3, l.h - 2, ink(COLORS.accent));
  if (l.draw) { try { l.draw(ctx, x, y, DK); } catch (e) { console.error('[notebook] draw', e); } return; }
  const dy = 1;
  if (l.head) {
    // section heading: a small diamond, the title and a dotted rule to the right edge
    const c = ink(l.head);
    rect(ctx, x, y + 9, 6, 6, shade(c, -0.35));
    rect(ctx, x + 1, y + 10, 4, 4, c);
    rect(ctx, x + 1, y + 10, 2, 1, shade(c, 0.5));
    text(ctx, l.t, x + 12, y + 3, { size: BODY, color: c, shadow: sh });
    const tw = measure(ctx, l.t, BODY);
    ctx.fillStyle = THEME.dark ? shade(c, -0.55) : shade(c, 0.45);
    for (let xx = Math.round(x + 22 + tw); xx < VX + VW; xx += 4) ctx.fillRect(xx, y + 12, 2, 1);
    return;
  }
  if (l.tag) {
    const tw = Math.round(measure(ctx, l.tag.t, 12) + 8);
    const ty = y + (l.s === SMALL ? 1 : 2);
    rect(ctx, x, ty, tw, 16, l.tag.bg);
    rect(ctx, x, ty, tw, 1, shade(l.tag.bg, 0.3));
    rect(ctx, x, ty + 15, tw, 1, shade(l.tag.bg, -0.3));
    text(ctx, l.tag.t, x + 4, ty + 2, { size: 12, color: '#ffffff', shadow: null });
    x += tw + 6;
  }
  if (l.t) text(ctx, l.t, x, y + dy, { size: l.s, color: ink(l.c || COLORS.text), shadow: sh });
  const textEnd = l.t ? x + measure(ctx, l.t, l.s) : x;
  if (l.gauge) {
    const gx = VX + GAUGE_X, gy = y + 5, gw = GAUGE_W;
    const gc = ink(l.gauge.color);
    rect(ctx, gx, gy, gw, 11, THEME.trackEdge);
    rect(ctx, gx + 1, gy + 1, gw - 2, 9, THEME.track);
    const fw = Math.round(clamp(l.gauge.frac, 0, 1) * (gw - 2));
    if (fw > 0) {
      rect(ctx, gx + 1, gy + 1, fw, 9, gc);
      rect(ctx, gx + 1, gy + 1, fw, 2, shade(gc, 0.35));
      rect(ctx, gx + 1, gy + 8, fw, 2, shade(gc, -0.25));
    }
    for (let i = 1; i < 4; i++) rect(ctx, gx + Math.round((gw * i) / 4), gy + 1, 1, 2, THEME.dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)');
  }
  if (l.hearts != null) {
    const hx = Math.round(Math.max(VX + HEART_X, textEnd + 14));
    for (let i = 0; i < HEART_N; i++) heart(ctx, hx + i * 16, y + 5, i < l.hearts);
  }
  if (l.badge) {
    const bw = Math.round(measure(ctx, l.badge.t, 12) + 10);
    const bx = VX + VW - bw;
    rect(ctx, bx, y + 2, bw, 16, l.badge.c);
    rect(ctx, bx, y + 2, bw, 1, shade(l.badge.c, 0.35));
    text(ctx, l.badge.t, bx + 5, y + 4, { size: 12, color: '#20232a', shadow: null });
  }
  if (l.r) text(ctx, l.r, VX + VW, y + dy + (l.rs === SMALL && l.s === BODY ? 3 : 0), { size: l.rs || l.s, align: 'right', color: ink(l.rc || COLORS.text), shadow: sh });
}
