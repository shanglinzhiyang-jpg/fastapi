// 賞レースの土台 (owner: D1): registry, calendar, eligibility, entry, generic round runner, rivals, judges, history,
// news, rewards, the morning hook. contest_ui.js (HD screen + phone app) and places/shourace.js (venue) are D1's too.
// Helpers: contests_gen.js (fictional names / phrases, pure) and contests_run.js (the round runner at the venue).
// API doc for the other modules: test-output/api_contests.txt.
//
// registerContest(id, def) — def schema (all fields optional unless marked *):
//   name*         '…'                       display name (current era). names: [{ from: 2017, to?: 2030, name: 'R-1グランプリ' }, …] for renames
//   short         'M-1'                     short label (HUD / lists, ≤ 8 chars)
//   kind*         'manzai'|'conte'|'pin'|'rakugo'|'ogiri'|'utaneta'|'monomane'|'talk'|'any'|'double'   ('double' = 漫才とコント両方)
//   category      'major' | 'tv' | 'kansai' | 'newcomer' | 'agency' | 'invitational' | 'amateur' | 'special'
//   organizer     '朝日放送テレビ・吉本興業'  broadcaster '…'  venue '…' (final venue / hall text)  region 'tokyo'|'osaka'|'nagoya'|'all'
//   history*      { founded: 2001, ended: 2010 | null, gaps: [[2011, 2014]], revived: 2015 | null, note: '…', sources: ['url', …] }
//   revive        true (default): after `ended` it is held as 「復刻開催」 every year, edition numbers continuing
//   editionOf     (year) => number | null   real edition number for a year (default: count of held years since founded)
//   schedule*     { entry: { from: [month, dom], to: [month, dom] } | null, final: [month, dom] }   (dom 1..10, game month = 10 days)
//   rounds*       [{ id: 'r1', name: '1回戦', when: [month, dom] | [[m, d], [m, d] …] (several dates/venues: the player picks one),
//                    venues: ['東京', '大阪', …], length: 120 (sec), pass: 0.3 (share) | 24 (count), field: 3000 (entrants, rough),
//                    judge: 'staff'|'panel'|'audience'|'vote'|'points', judges: 7, scoring: '100点×7' (text), revival: bool (敗者復活),
//                    tv: bool (broadcast), final: bool, rounds2: … (contest-specific extras are fine), run: async (g, ctx) => result }
//   eligibility   { pro: true, amateur: true, members: [2, null] (min, max|null), unitYearsMax: 15, unitYearsMin: 16, geirekiMax: 10,
//                   geirekiMin, ageMax: 25, ageMin, agency: ['yoshimoto'] (membership required), region, invite: { fame: 2000 } (TV invitational),
//                   note: '結成15年以内（プロ・アマ問わず、2人以上）' } | (g, unit, year) => ({ ok, why })
//   fee           { pro: 2000, amateur: 2000 } | number | (g, unit, year) => yen    real entry fee (0 = free / invitation)
//   prize         10000000 (yen) | (year) => yen,  prizeText '優勝賞金1000万円'
//   perform       { kind, length (sec) } what is performed (defaults from kind / round.length)
//   news          ['…', (g, ctx) => '…', …] extra news lines (D1 also generates generic ones)
//   catchcopy     (g, ctx) => '…'           finalist catch copy
//   flow          async (g, ctx) => void    the WHOLE contest is run by the def (E1 / E2): D1's generic runner then only lists it,
//                                           reminds, and calls flow when the player chooses to go on a round day
//   entry         async (g, ctx) => entry | null   replaces the generic entry flow (エントリー用紙 etc.)
//   onMorning     (g, ctx) => void          per-contest morning work (D1 calls it every morning, errors caught)
//   status        (g) => object             summary for the notebook / screens
//   ctx = { id, def, year, edition, revival, entry, round, date }
// D1 EXTENSIONS (all optional; see test-output/api_contests.txt for the exact behaviour):
//   roundsOf      (year) => rounds | null    the rounds of that year (formats that change); scheduleOf (year) => schedule | null
//                 (both fall back to def.rounds / def.schedule; every D1 path asks them with the cycle's year)
//   entryCount    (year) => number | null    the real total entries of that year (news + round 0's field) instead of an estimate
//   selfRun       true: the contest runs its own world (E1 M-1, E2 KOC, E3 R-1/ABC): D1 never simulates it, posts none of its generic news
//                 and freezes nothing; its history comes from historyList (g) => rows | historyOf (year) => row | history.champions,
//                 the player's entry from status(g).entry, today's actions from status(g).today, rivals from rivalsOf (g, round, n, year)
//                 (in contests_run.js: seasonNews / freeze return at once for it)
//   feeText       '1人1,000円' | (year) => '…'   how the fee is shown (default 「¥2,000（1組）」)
//   repeat        true | false              may a past champion enter again (also eligibility.repeat). Unspecified: invitationals yes, open
//                                           contests with an object eligibility no, a function eligibility: no bar from D1 for the player
//   eligibility   .extra / .check (g, unit, year) => ({ ok, why })  extra rules checked at entry; def.eligibilityNote: a note line
//   history.gapRevival true: real gap years are held as 復刻開催 too (default: a real hiatus follows history)
//   history.champions  { [year]: '…' } this world's champion names for given years (fictional!) instead of the generated ones
//   labelStyle    'edition' (第N回 名前, default) | 'year' (名前2026) | 'both' (名前2026（第N回）);  editionLabel (year, edition) => '…'
//   prestige      0..100 (rewards, news priority; default by category: major 100, tv/invitational 70, kansai 55, newcomer/special 45,
//                 agency 30, amateur 15)
//   color         '#c0392b' venue signage / screen colour (default: derived from the id)
//   rounds[i]     .stage 'stage'|'studio'|'outdoor' (venue room; default: final+tv → studio, revival → outdoor, else stage)
//                 .revivalPass 1 (acts that come back), .revivalName '敗者復活戦', .revivalJudge 'audience'|'vote'|'panel'
//                 .stage2 { top: 3, name: '最終決戦', judge: 'vote' } (a second performance of the top N in a final)
//                 .announce 'next' (staff results the next morning; default for judge 'staff') | 'now'
//                 .crowd 'warm'|'normal'|'cold'|'tough', .size 'small'|'theater'|'hall'|'tv'
//   eligibility   .repeat true: past champions may enter again (default: not for open contests, yes for invitationals)
//                 .kids true: a children's contest (rivals are children)
//   field         { anonMu, anonSd } power of the anonymous mass of entrants (default by eligibility)
// Rules of thumb: real names, years, fees and formats verified (comment the sources); every person fictional.

import { Game } from './game.js';
import { onMorning, MORNING_HOOKS, registerRegular, REGULARS, PEOPLE } from './life.js';
import { AGENCIES } from './state.js';
import { clamp, fmtMoney, display } from './util.js';
import {
  rngOf, strHash, gauss, pickR, actName, personName, kidName, agencyFor, agencyLabel, lookFor, judgePerson, hostPerson,
  judgeComment, TAG_COLORS, FAIL_NOTES, resultMedium, netVoice, NET_LINES, fillName, shortOf, isRealNameLike,
} from './contests_gen.js';
export { isRealNameLike }; // (name) → true when a name is / contains a well-known real person's name (other modules reuse it)
import { runner } from './contests_run.js';

export const CONTESTS = {};
export function registerContest(id, def) {
  if (!id || !def) return;
  CONTESTS[id] = { id, revive: true, ...def };
  CACHE.cycles.clear();
}

const MONTH_DAYS = 10;
const YEAR_DAYS = 120;
const ERA_BASE_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
// The in-game date { year, month, dom } (g.gameDate when the politics core is loaded; the same calendar otherwise).
// dom is always 1..10 (the politics core's dom is a 1..28 "calendar" day: it is mapped back to the 10-day game month).
export function contestDate(g, day) {
  try {
    if (g && typeof g.gameDate === 'function') {
      const d = day == null ? g.gameDate() : g.gameDate(day);
      if (d && Number.isFinite(d.year)) {
        const dom = Number.isFinite(d.doy) ? (d.doy % MONTH_DAYS) + 1 : (d.dom || 1) > MONTH_DAYS ? Math.floor(((d.dom || 1) - 1) / 3) + 1 : (d.dom || 1);
        return { year: d.year, month: d.month, dom: clamp(dom, 1, MONTH_DAYS) };
      }
    }
  } catch (e) { /* fall back */ }
  const st = g && g.state;
  const era = (st && st.profile && st.profile.era) || 'reiwa';
  const n = Math.max(0, ((day ?? (st && st.day)) || 1) - 1);
  const idx = 3 + Math.floor(n / MONTH_DAYS);
  return { year: (ERA_BASE_YEAR[era] ?? 2026) + Math.floor(idx / 12), month: (idx % 12) + 1, dom: (n % MONTH_DAYS) + 1 };
}

// ================================================================ small helpers
const has = (g, k) => !!g && typeof g[k] === 'function';
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const LOGGED = new Set();
export function logOnce(key, e) { if (LOGGED.has(key)) return; LOGGED.add(key); console.error(`[contests] ${key}`, e); }
function safe(key, fn, d = null) { try { return fn(); } catch (e) { logOnce(key, e); return d; } }
const absOf = (y, m, d) => y * YEAR_DAYS + (m - 1) * MONTH_DAYS + (d - 1);
const CACHE = { base: new WeakMap(), cycles: new Map(), acts: new Map(), sims: new Map(), hist: new Map(), calib: null, judges: new Map() };
function baseAbs(g) {
  const st = g.state;
  const key = `${st && st.profile && st.profile.era}|${st && st.politics && st.politics.cal ? `${st.politics.cal.year}-${st.politics.cal.month}` : ''}`;
  const c = st && CACHE.base.get(st);
  if (c && c.key === key) return c.v;
  const d1 = contestDate(g, 1);
  const v = absOf(d1.year, d1.month, d1.dom);
  if (st) CACHE.base.set(st, { key, v });
  return v;
}
// game day of a date (can be ≤ 0 for dates before the game started)
export function dayOfDate(g, y, m, d) { return absOf(y, m, d) - baseAbs(g) + 1; }
export function startYear(g) { return contestDate(g, 1).year; }
export const todayOf = (g) => (g.state && g.state.day) || 1;
// The calendar day shown for a game day of the month (dom 1..10): the same mapping as the politics core's polDate / g.gameDate
// (day index k → (k − 1) × 3 + 1: 1, 4, 7 … 28), so a round shows the same date on every screen. Schedules stay in [month, dom 1..10].
export const realDay = (dom) => (clamp(Math.round(num(dom, 1)), 1, MONTH_DAYS) - 1) * 3 + 1;
export function dateText(g, day, opts = {}) {
  const d = contestDate(g, day);
  const s = `${d.month}月${realDay(d.dom)}日`;
  return opts.year ? `${d.year}年${s}` : s;
}
// 昭和64年 = 平成元年 (1989-01-08); the game's months only
export function wareki(y, m = 12) {
  if (y > 2019 || (y === 2019 && m >= 5)) return `令和${y - 2018 === 1 ? '元' : y - 2018}年`;
  if (y > 1989 || (y === 1989 && m >= 2)) return `平成${y - 1988 === 1 ? '元' : y - 1988}年`;
  return `昭和${y - 1925}年`;
}
// money: contest fees and prizes are REAL nominal yen of that time; the game keeps money in today's yen and shows it
// times the era's price rate (util.js), so a real amount is stored as amount / rate (the screen then shows the real amount).
export const realToInternal = (yen) => Math.round(num(yen) / (display.priceRate || 1));
export const yenLabel = (yen) => `¥${Math.round(num(yen)).toLocaleString('ja-JP')}`; // a real amount as is (no era scaling)

// ================================================================ def helpers
export const roundsOf = (def) => (def && Array.isArray(def.rounds) ? def.rounds : []);
// formats that change by year: def.roundsOf(year) / def.scheduleOf(year) when present (fall back to def.rounds / def.schedule)
export function roundsAt(def, year) {
  if (def && year != null) {
    const r = safe(`roundsOf:${def.id}`, () => (typeof def.roundsOf === 'function' ? def.roundsOf(year) : null), null);
    if (Array.isArray(r) && r.length) return r;
  }
  return roundsOf(def);
}
export function scheduleAt(def, year) {
  if (def && year != null) {
    const s0 = safe(`scheduleOf:${def.id}`, () => (typeof def.scheduleOf === 'function' ? def.scheduleOf(year) : null), null);
    if (s0 && typeof s0 === 'object') return s0;
  }
  return (def && def.schedule) || {};
}
// names: [{ from?, to?, name }] — the name of a year: the matching entry with the latest `from` (to inclusive); else def.name
export function contestName(def, year) {
  if (!def) return '';
  let n = def.name || def.id;
  const f = def.history && Number.isFinite(Number(def.history.founded)) ? Number(def.history.founded) : null;
  if (f != null && year < f) year = f; // before its founding: the name it is founded with
  if (Array.isArray(def.names)) {
    for (const x of def.names.slice().sort((a, b) => num(a.from, -1e9) - num(b.from, -1e9))) {
      if (!x || !x.name) continue;
      if ((x.from == null || year >= num(x.from)) && (x.to == null || year <= num(x.to))) n = x.name;
    }
  }
  return n;
}
export function kindOf(def) { return (def && def.perform && def.perform.kind) || (def && def.kind) || 'any'; }
export const KIND_LABEL = { manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね', talk: 'トーク', any: 'ジャンル不問', double: '漫才・コント' };
const PRESTIGE = { major: 100, tv: 70, invitational: 70, kansai: 55, newcomer: 45, special: 45, agency: 30, amateur: 15 };
export const prestigeOf = (def) => clamp(num(def && def.prestige, PRESTIGE[def && def.category] ?? 40), 0, 100);
const PALETTE = ['#c0392b', '#d35400', '#b8860b', '#27863e', '#16808a', '#2c5aa0', '#5b3fa0', '#a0306a', '#3a6a3a', '#8a5a2a', '#1f6f8b', '#9a2a3a'];
export const colorOf = (def) => (def && def.color) || PALETTE[strHash(def ? def.id : '') % PALETTE.length];
export function isInvitational(def) {
  const e = def && def.eligibility;
  return !!(def && (def.category === 'invitational' || (e && (isObj(e) || typeof e === 'function') && e.invite)));
}
function whenList(w) {
  if (!Array.isArray(w) || !w.length) return [];
  if (typeof w[0] === 'number') return [w];
  return w.filter((x) => Array.isArray(x) && typeof x[0] === 'number');
}
function finalMD(def, year) {
  const f = scheduleAt(def, year).final;
  if (Array.isArray(f) && typeof f[0] === 'number') return f;
  const R = roundsAt(def, year);
  const last = R.length ? whenList(R[R.length - 1].when) : [];
  return last.length ? last[last.length - 1] : [12, 10];
}
// the calendar year a date of the cycle that ends in `year` falls in (dates after the final's date belong to the year before:
// an R-1-style entry in December for a March final). A third element [m, d, -1] forces the offset.
function yearOfMD(def, md, year) {
  if (md.length > 2 && Number.isFinite(md[2])) return year + md[2];
  const [fm, fd] = finalMD(def, year);
  return md[0] > fm || (md[0] === fm && md[1] > fd) ? year - 1 : year;
}
export function labelOf(def, year, edition, revival) {
  const name = contestName(def, year);
  let s;
  if (typeof def.editionLabel === 'function') s = safe(`editionLabel:${def.id}`, () => def.editionLabel(year, edition), null);
  if (!s) s = def.labelStyle === 'year' ? `${name}${year}` : def.labelStyle === 'both' ? `${name}${year}（第${edition}回）` : edition ? `第${edition}回 ${name}` : name;
  return revival ? `${s}（復刻開催）` : s;
}

// Whether the contest is held in `year` (the year of its final): { held, revival, notyet, hiatus, ended, note }
export function heldIn(g, def, year) {
  const h = def.history || {};
  const founded = num(h.founded, -Infinity);
  if (year < founded) return { held: false, notyet: true, note: `まだ始まっていない（${founded}年創設）` };
  const gap = Array.isArray(h.gaps) && h.gaps.find((x) => Array.isArray(x) && year >= num(x[0]) && year <= num(x[1], num(x[0])));
  if (gap) return h.gapRevival ? { held: true, revival: true } : { held: false, hiatus: true, note: `休止中（${gap[0]}〜${gap[1] ?? gap[0]}年は開催なし）` };
  if (h.ended != null && year > num(h.ended)) {
    if (h.revived != null && year >= num(h.revived)) return { held: true };
    if (h.revived != null && year < num(h.revived) && year < startYear(g)) return { held: false, hiatus: true, note: `休止中（${h.ended}年で終了、${h.revived}年に再開）` };
    if (def.revive !== false && year >= startYear(g)) return { held: true, revival: true };
    return { held: false, ended: true, note: `${h.ended}年で終了` };
  }
  return { held: true };
}
// The edition number of a held year (real numbering through editionOf; else the count of held years since the founding).
export function editionIn(g, def, year) {
  if (typeof def.editionOf === 'function') {
    const e = safe(`editionOf:${def.id}`, () => def.editionOf(year), null);
    if (Number.isFinite(e)) return e;
  }
  const h = def.history || {};
  const founded = num(h.founded, year);
  let n = 0;
  for (let y = founded; y <= year; y++) if (heldIn(g, def, y).held) n++;
  return n;
}

// The cycle (edition) of a contest whose final is in `year`: dates as game days, the entry window, rounds with their options.
export function cycleOf(g, idOrDef, year) {
  const def = typeof idOrDef === 'string' ? CONTESTS[idOrDef] : idOrDef;
  if (!def) return null;
  const key = `${baseAbs(g)}|${startYear(g)}|${def.id}|${year}`;
  const hit = CACHE.cycles.get(key);
  if (hit) return hit;
  const h = heldIn(g, def, year);
  const at = (md) => { const y = yearOfMD(def, md, year); return { day: dayOfDate(g, y, md[0], clamp(md[1] || 1, 1, 10)), date: { year: y, month: md[0], dom: clamp(md[1] || 1, 1, 10) } }; };
  const fin = at(finalMD(def, year));
  const sch = scheduleAt(def, year);
  const entry = sch.entry && Array.isArray(sch.entry.from) && Array.isArray(sch.entry.to) ? { from: at(sch.entry.from).day, to: at(sch.entry.to).day, fromDate: at(sch.entry.from).date, toDate: at(sch.entry.to).date } : null;
  const rounds = roundsAt(def, year).map((r, idx) => {
    const venues = Array.isArray(r.venues) && r.venues.length ? r.venues : [def.venue || (def.region === 'osaka' ? '大阪' : '東京')];
    const options = whenList(r.when).map((md, k) => ({ k, ...at(md), venue: venues[k % venues.length] }));
    if (!options.length) options.push({ k: 0, ...fin, venue: venues[0] });
    options.sort((a, b) => a.day - b.day);
    options.forEach((o, i) => { o.k = i; });
    return { idx, r, id: r.id || `r${idx + 1}`, name: r.name || `${idx + 1}回戦`, options, first: options[0].day, last: options[options.length - 1].day };
  });
  const edition = h.held ? editionIn(g, def, year) : null;
  const cyc = { id: def.id, def, year, ...h, edition, label: h.held ? labelOf(def, year, edition, h.revival) : contestName(def, year), name: contestName(def, year),
    final: fin, entry, rounds, invite: isInvitational(def) };
  CACHE.cycles.set(key, cyc);
  if (CACHE.cycles.size > 4000) CACHE.cycles.clear();
  return cyc;
}
// The cycle year that is current at `day`: the first whose final is today or later.
export function seasonYearOf(g, idOrDef, day = todayOf(g)) {
  const def = typeof idOrDef === 'string' ? CONTESTS[idOrDef] : idOrDef;
  if (!def) return contestDate(g, day).year;
  const y0 = contestDate(g, day).year;
  let y = y0 + 1;
  for (let k = y0 - 1; k <= y0 + 2; k++) { const [fm, fd] = finalMD(def, k); if (dayOfDate(g, k, fm, fd) >= day) { y = k; break; } }
  // a cycle that has just finished stays current until the next one actually opens (its entry window, else its first round)
  const prev = cycleOf(g, def, y - 1);
  if (prev && prev.held && prev.final.day < day) {
    const next = cycleOf(g, def, y);
    const start = next && next.held ? (next.entry ? next.entry.from : next.rounds.length ? next.rounds[0].first : next.final.day) : Infinity;
    if (day < start) return y - 1;
  }
  return y;
}

// ================================================================ state
export function cstate(g) {
  const st = g.state;
  if (!isObj(st.contests)) st.contests = {};
  const c = st.contests;
  if (!isObj(c.entries)) c.entries = {};
  if (!Array.isArray(c.news)) c.news = [];
  if (!isObj(c.seen)) c.seen = {};
  if (!isObj(c.results)) c.results = {};
  if (!isObj(c.hist)) c.hist = {};
  if (!isObj(c.sent)) c.sent = {};
  if (!Array.isArray(c.queue)) c.queue = [];
  if (!isObj(c.daily)) c.daily = { day: 0, n: 0 };
  if (!isObj(c.stats)) c.stats = { entered: 0, rounds: 0, passed: 0, finals: 0, wins: 0, fees: 0, prize: 0 };
  if (!Number.isFinite(c.seed)) c.seed = Math.floor(Math.random() * 2147483647);
  if (!Number.isFinite(c.v)) c.v = 0;
  return c;
}
const seedOf = (g) => cstate(g).seed;
function resultsOf(g, id, year, create = false) {
  const c = cstate(g);
  if (!c.results[id]) { if (!create) return null; c.results[id] = {}; }
  if (!c.results[id][year]) { if (!create) return null; c.results[id][year] = { mods: {}, rounds: {}, v: 0 }; }
  return c.results[id][year];
}
function bump(g, id, year) { const r = resultsOf(g, id, year, true); r.v = num(r.v) + 1; const c = cstate(g); c.v++; if (!isObj(c.vers)) c.vers = {}; c.vers[id] = num(c.vers[id]) + 1; }
const verOf = (g, id) => { const c = cstate(g); return isObj(c.vers) ? num(c.vers[id]) : 0; };

// ================================================================ the world's acts (deterministic per save)
// 44 acts are formed every year: 24 combis, 4 trios, 12 pins, 4 落語家. Talent is skewed (most are weak), they grow
// with the years, some break up / retire, most turn pro after a year or two (some stay amateur).
const KINDS = ['manzai', 'conte', 'pin', 'rakugo', 'ogiri', 'utaneta', 'monomane', 'talk'];
function actsFormed(seed, year) {
  const key = `${seed}|${year}`;
  let list = CACHE.acts.get(key);
  if (list) return list;
  list = [];
  for (let k = 0; k < 44; k++) {
    const r = rngOf(seed, 'act', year, k);
    const type = k < 24 ? 'combi' : k < 28 ? 'trio' : k < 40 ? 'pin' : 'rakugo';
    const region = r() < (type === 'rakugo' ? 0.35 : 0.42) ? 'osaka' : 'tokyo';
    const talent = Math.pow(r(), 1.9);
    const n = type === 'combi' ? 2 : type === 'trio' ? 3 : 1;
    const members = [];
    for (let i = 0; i < n; i++) {
      const female = r() < (type === 'pin' ? 0.22 : 0.14);
      const name = type === 'rakugo' ? null : personName(r, female);
      members.push({ name, female, born: year - (18 + Math.floor(r() * 9)), look: lookFor(r, female) });
    }
    const name = actName(r, type);
    if (type === 'rakugo' || type === 'pin') members[0].name = name;
    const style = type === 'pin' ? pickR(r, ['flip', 'mandan', 'conte', 'utaneta', 'monomane']) : type === 'rakugo' ? 'rakugo' : r() < 0.5 ? 'manzai' : r() < 0.64 ? 'conte' : 'both';
    const sk = {};
    for (const kk of KINDS) sk[kk] = 0.45 + r() * 0.5;
    if (style === 'manzai') { sk.manzai += 0.45; sk.conte -= 0.1; }
    if (style === 'conte') { sk.conte += 0.45; sk.manzai -= 0.1; }
    if (style === 'both') { sk.manzai += 0.25; sk.conte += 0.25; }
    if (type === 'pin') { sk.pin += 0.4; sk.manzai = 0.2; sk.conte = 0.35; if (style === 'utaneta') sk.utaneta += 0.5; if (style === 'monomane') sk.monomane += 0.6; if (style === 'mandan') sk.talk += 0.3; }
    if (type === 'rakugo') { sk.rakugo = 1.25; sk.manzai = 0.1; sk.conte = 0.2; sk.pin = 0.5; sk.talk += 0.3; }
    const neverPro = talent < 0.18 && r() < 0.6;
    const proYear = neverPro ? null : year + (talent > 0.3 ? Math.floor(r() * 2) : 1 + Math.floor(r() * 3));
    const agency = proYear == null ? null : agencyFor(r, proYear, region);
    const splits = type === 'combi' || type === 'trio' ? r() < 0.4 + (0.35 - talent * 0.35) : r() < 0.35;
    const breakup = splits ? year + 1 + Math.floor(-Math.log(Math.max(1e-6, r())) * (3 + talent * 8)) : null;
    const debut = year - (r() < 0.22 ? 1 + Math.floor(r() * 4) : 0);
    const college = year >= 2000 && r() < 0.18;
    const nsc = agency === 'yoshimoto' && r() < 0.7 && ((region === 'osaka' && year >= 1982) || (region === 'tokyo' && year >= 1995));
    list.push({ id: `${year}-${k}`, formed: year, type, region, talent, peak: 5 + r() * 9, members, name, style, sk, proYear, agency, breakup, debut, college, nsc, kid: false });
  }
  CACHE.acts.set(key, list);
  if (CACHE.acts.size > 400) { const first = CACHE.acts.keys().next().value; CACHE.acts.delete(first); }
  return list;
}
// children for a kids' contest (今宮子供えびす etc.): generated per contest-year
function kidsActs(seed, id, year) {
  const key = `${seed}|kids|${id}|${year}`;
  let list = CACHE.acts.get(key);
  if (list) return list;
  list = [];
  for (let k = 0; k < 60; k++) {
    const r = rngOf(seed, 'kid', id, year, k);
    const n = r() < 0.8 ? 2 : 3;
    const members = [];
    for (let i = 0; i < n; i++) { const female = r() < 0.4; members.push({ name: kidName(r), female, born: year - (8 + Math.floor(r() * 8)), look: lookFor(r, female, true) }); }
    const sk = {};
    for (const kk of KINDS) sk[kk] = 0.6 + r() * 0.4;
    list.push({ id: `k${year}-${id}-${k}`, formed: year - Math.floor(r() * 3), type: n === 2 ? 'combi' : 'trio', region: r() < 0.7 ? 'osaka' : 'tokyo', talent: Math.pow(r(), 1.5) * 0.7, peak: 4, members, name: actName(r, 'kids'), style: 'manzai', sk, proYear: null, agency: null, breakup: null, debut: year, college: false, nsc: false, kid: true });
  }
  CACHE.acts.set(key, list);
  return list;
}
export const actById = (g, actId) => {
  const s = String(actId).split('#')[0];
  const m = /^(\d+)-(\d+)$/.exec(s);
  if (!m) return null;
  return actsFormed(seedOf(g), Number(m[1]))[Number(m[2])] || null;
};
export function actPower(seed, act, year, kind) {
  const yrs = Math.max(0, year - act.formed);
  const growth = 1 - Math.exp(-(yrs + 0.5) / act.peak * 1.6);
  let p = 14 + 72 * act.talent * (0.35 + 0.65 * growth);
  if (yrs > 25) p -= (yrs - 25) * 0.5;
  if (act.proYear == null || year < act.proYear) p -= 4;
  const k = KINDS.includes(kind) ? kind : null;
  const s = k ? act.sk[k] : Math.max(act.sk.manzai, act.sk.conte, act.sk.pin, act.sk.rakugo);
  p *= 0.62 + 0.38 * clamp(s, 0, 1.4);
  p += 3 * gauss(rngOf(seed, 'form', act.id, year));
  return clamp(Math.round(p * 10) / 10, 3, 97);
}
const isAmateurIn = (act, year) => act.proYear == null || year < act.proYear;
const ageIn = (m, year) => year - m.born;
const brokenIn = (act, year) => act.breakup != null && year >= act.breakup;

// ================================================================ the field of a contest-year
// the eligibility object (a function-form eligibility may still carry .note / .invite / .members … as properties)
function eligObj(def) { const e = def && def.eligibility; return isObj(e) || typeof e === 'function' ? e : {}; }
function entrantOk(def, e, year) {
  const el = eligObj(def);
  const act = e.act;
  if (act.formed > year || brokenIn(act, year)) return false;
  const n = e.member != null ? 1 : act.members.length;
  if (Array.isArray(el.members)) { if (el.members[0] != null && n < el.members[0]) return false; if (el.members[1] != null && n > el.members[1]) return false; }
  const yrs = year - act.formed, geireki = year - act.debut;
  if (el.unitYearsMax != null && yrs > el.unitYearsMax) return false;
  if (el.unitYearsMin != null && yrs < el.unitYearsMin) return false;
  if (el.geirekiMax != null && geireki > el.geirekiMax) return false;
  if (el.geirekiMin != null && geireki < el.geirekiMin) return false;
  const ms = e.member != null ? [act.members[e.member]] : act.members;
  if (el.ageMax != null && ms.some((m) => ageIn(m, year) > el.ageMax)) return false;
  if (el.ageMin != null && ms.some((m) => ageIn(m, year) < el.ageMin)) return false;
  const am = isAmateurIn(act, year);
  if (el.pro === false && !am) return false;
  if (el.amateur === false && am) return false;
  if (Array.isArray(el.agency) && el.agency.length && !el.agency.includes(act.agency)) return false;
  if (el.region && el.region !== 'all') { const want = /osaka|kansai|大阪|関西/.test(el.region) ? 'osaka' : /tokyo|東京|関東/.test(el.region) ? 'tokyo' : null; if (want && act.region !== want) return false; }
  return true;
}
const KIND_TYPES = {
  manzai: (a) => a.type === 'combi' || a.type === 'trio', double: (a) => a.type === 'combi' || a.type === 'trio',
  conte: (a) => a.type !== 'rakugo', pin: (a) => a.type === 'pin', utaneta: (a) => a.type !== 'rakugo', monomane: (a) => a.type === 'pin' || a.type === 'combi',
  rakugo: (a) => a.type === 'rakugo', any: (a) => a.type !== 'rakugo', ogiri: () => false, talk: () => false,
};
// entrants: { id, name, act, member (index | null), power, unitName, type, agency, amateur }
function fieldOf(g, id, year, champs) {
  const def = CONTESTS[id];
  const seed = seedOf(g);
  const el = eligObj(def);
  const kind = kindOf(def);
  const kids = el.kids || (el.ageMax != null && el.ageMax <= 15);
  const span = clamp(num(el.unitYearsMax ?? el.geirekiMax, 40) + 2, 1, 46);
  const minY = num(el.unitYearsMin ?? el.geirekiMin, 0);
  const acts = [];
  if (kids) acts.push(...kidsActs(seed, id, year));
  else for (let y = year - span; y <= year - Math.max(0, minY - 3); y++) acts.push(...actsFormed(seed, y));
  const out = [];
  const individual = kind === 'ogiri' || kind === 'talk';
  for (const act of acts) {
    if (individual) {
      if (year - act.formed < 4 || act.type === 'rakugo' && kind === 'ogiri') continue;
      act.members.forEach((m, i) => out.push({ id: `${act.id}#${i}`, name: act.type === 'pin' || act.type === 'rakugo' ? act.name : `${m.name}（${act.name}）`, short: act.type === 'pin' || act.type === 'rakugo' ? act.name : shortOf(m.name), act, member: i }));
      continue;
    }
    const okType = (KIND_TYPES[kind] || KIND_TYPES.any)(act);
    if (okType) out.push({ id: act.id, name: act.name, act, member: null });
    // members of a combi may enter a pin contest alone (R-1 style)
    if ((kind === 'pin' || kind === 'utaneta' || kind === 'monomane') && (act.type === 'combi' || act.type === 'trio')) {
      act.members.forEach((m, i) => { if (rngOf(seed, 'solo', act.id, i, id)() < 0.18) out.push({ id: `${act.id}#${i}`, name: m.name, short: shortOf(m.name), act, member: i, solo: true }); });
    }
  }
  let list = out.filter((e) => entrantOk(def, e, year) && !(champs && champs.has(e.id)));
  for (const e of list) {
    e.power = actPower(seed, e.act, year, kind === 'double' ? 'manzai' : kind) * (e.member != null && !individual ? 0.88 : 1);
    e.amateur = isAmateurIn(e.act, year);
    e.agency = e.amateur ? null : e.act.agency;
    e.type = e.member != null ? 'pin' : e.act.type;
    e.unitName = e.act.name;
  }
  if (individual) for (const e of list) e.power = clamp(e.power * 0.7 + (year - e.act.formed) * 0.9 + 6, 3, 97);
  list.sort((a, b) => b.power - a.power);
  if (isInvitational(def)) {
    const R0 = roundsAt(def, year)[0];
    const n = clamp(num(R0 && R0.field, 12), 2, 40);
    // invited: the strongest with a career (TV fame), not amateurs
    list = list.filter((e) => !e.amateur && year - e.act.formed >= (kind === 'ogiri' || kind === 'talk' ? 6 : 3)).slice(0, n);
  } else list = list.slice(0, 480);
  return list;
}

// ================================================================ score model (internal, stable across versions of perform.js)
// A rival's performance: 0.85 × power + 8 ± 7. The player's real g.perform score is mapped onto the same scale through a
// calibration of g.performSim (power → score), so whatever model perform.js uses, the player meets the field fairly.
const MODEL = { a: 8, b: 0.85, s: 7 };
const scoreOf = (power, r) => clamp(MODEL.a + MODEL.b * power + MODEL.s * gauss(r), 0, 100);
function calibration(g) {
  if (CACHE.calib && CACHE.calib.fn === g.performSim) return CACHE.calib;
  let a = MODEL.a, b = MODEL.b, s = MODEL.s;
  if (has(g, 'performSim')) {
    try {
      const xs = [], ys = [];
      for (let p = 10; p <= 90; p += 10) for (let k = 0; k < 8; k++) {
        const r = rngOf('calib', p, k);
        // an act of that power in contest conditions (contest stakes, a normal house, moderate pressure)
        const res = g.performSim({ kind: 'manzai', power: p, quality: p, rng: r, skip: true, contest: { id: 'calibration', round: 'r1', name: '' }, venue: { size: 'theater', crowd: 'normal', pressure: 30 } });
        if (res && Number.isFinite(res.score)) { xs.push(p); ys.push(res.score); }
      }
      if (xs.length > 20) {
        const mx = xs.reduce((q, v) => q + v, 0) / xs.length, my = ys.reduce((q, v) => q + v, 0) / ys.length;
        let sxy = 0, sxx = 0;
        xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
        if (sxx > 0 && sxy / sxx > 0.1) { b = sxy / sxx; a = my - b * mx; let rss = 0; xs.forEach((x, i) => { rss += (ys[i] - (a + b * x)) ** 2; }); s = Math.sqrt(rss / xs.length); }
      }
    } catch (e) { logOnce('calibration', e); }
  }
  CACHE.calib = { fn: g.performSim, a, b, s };
  return CACHE.calib;
}
// the player's performance score (perform.js scale) → the field's scale
export function toFieldScore(g, score) {
  const c = calibration(g);
  const p = (num(score) - c.a) / c.b;
  return clamp(MODEL.a + MODEL.b * p, 0, 100);
}
// expected field-scale score (mean, sd) of the player for a kind (power + their best neta)
// expected field-scale score (mean, sd) of the player: g.performSim with their power, their best script (the neta object, so
// perform.js judges it itself) and the round's conditions (opts: { venue: { size, crowd, pressure }, length }) — the same inputs
// the real performance gets, so the odds shown are honest.
export function playerScoreDist(g, kind, opts = {}) {
  const power = playerPower(g, kind);
  let quality = Math.max(10, power - 8); // no script of your own: an おまかせ one
  let best = null;
  if (has(g, 'netaList') && has(g, 'netaQuality')) {
    const list = safe('netaList', () => g.netaList(kind === 'double' ? undefined : kind), []) || [];
    for (const n of list) { const q = num(safe('netaQuality', () => g.netaQuality(n), 0)); if (!best || q > quality) { best = n; quality = q; } }
  }
  if (!best && has(g, 'autoNeta')) best = safe('autoNeta', () => g.autoNeta(kind, quality), null);
  if (has(g, 'performSim')) {
    try {
      const xs = [];
      for (let k = 0; k < 24; k++) {
        // the player's own act (no power given: perform.js reads the unit), their best script, the round's conditions
        const o = { kind, rng: rngOf('pdist', power, quality, k), skip: true, contest: { id: 'odds', round: 'r1', name: '' }, ...opts };
        if (best) o.neta = best; else o.quality = quality;
        const res = g.performSim(o);
        if (res && Number.isFinite(res.score)) xs.push(toFieldScore(g, res.score));
      }
      if (xs.length > 5) { const m = xs.reduce((q, v) => q + v, 0) / xs.length; const sd = Math.sqrt(xs.reduce((q, v) => q + (v - m) ** 2, 0) / xs.length); return { mean: m, sd: Math.max(3, sd), power, quality }; }
    } catch (e) { logOnce('playerScoreDist', e); }
  }
  return { mean: MODEL.a + MODEL.b * (power * 0.6 + quality * 0.4), sd: MODEL.s, power, quality };
}
const PHI = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const phi = (z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

// ================================================================ simulation of a contest-year
// Named entrants (the world's acts) are scored per round with a seeded draw; the anonymous mass of entrants (beginners,
// one-off amateurs) is a normal distribution handled analytically. While the anonymous mass is large a round passes everyone
// above a score threshold (solved so the real pass count comes out); once it is negligible the round is an exact ranking.
// The player's stored results (mods) are inserted: in an exact round a passing player takes one named act's place.
function anonParams(def) {
  const el = eligObj(def);
  const f = isObj(def.field) ? def.field : {};
  const mu = num(f.anonMu, el.kids ? 30 : el.pro === false ? 24 : el.amateur === false ? 36 : 28);
  return { mu, sd: num(f.anonSd, 11) };
}
// the real entrants E / passers P of each round; round 0 = def.entryCount(year) (real total entries, when the def knows it) or its field
function realCounts(def, year) {
  const R = roundsAt(def, year);
  const real = typeof def.entryCount === 'function' ? num(safe(`entryCount:${def.id}`, () => def.entryCount(year), null), null) : null;
  const out = [];
  let prev = null;
  R.forEach((r, i) => {
    let E = i === 0 && real > 0 ? real : r.field != null ? num(r.field) : i === 0 ? (isInvitational(def) ? 12 : 400) : prev;
    if (i > 0 && r.field == null && prev == null) E = 10;
    const last = i === R.length - 1;
    let P = last ? 1 : r.pass == null ? Math.max(1, Math.round(E * 0.35)) : num(r.pass) < 1 ? Math.max(1, Math.round(E * num(r.pass))) : num(r.pass);
    P = Math.min(P, E);
    out.push({ E, P });
    prev = P + (R[i + 1] && R[i + 1].revival ? num(R[i + 1].revivalPass, 1) : 0);
  });
  return out;
}
// A named stand-in for the anonymous mass (beginners, one-off amateurs) once a round is small enough to list everyone: every
// round then has its real field size (a 10-act final has 10 acts even when few of the world's acts were eligible).
const EXACT_MAX = 60;
function ghostEntrant(seed, def, year, i, k, mu, sd) {
  const r = rngOf(seed, 'ghost', def.id, year, i, k);
  const kind = kindOf(def);
  const el = eligObj(def);
  const kids = !!(el.kids || (el.ageMax != null && el.ageMax <= 15));
  const individual = kind === 'ogiri' || kind === 'talk';
  const type = kind === 'rakugo' ? 'rakugo' : kind === 'pin' || kind === 'monomane' || kind === 'utaneta' ? 'pin' : r() < 0.85 ? 'combi' : 'trio';
  const n = individual ? 2 : type === 'combi' ? 2 : type === 'trio' ? 3 : 1;
  const aMin = kids ? 8 : num(el.ageMin, 19), aMax = kids ? Math.min(15, num(el.ageMax, 15)) : num(el.ageMax, 36);
  const members = [];
  for (let m = 0; m < n; m++) { const female = r() < 0.2; members.push({ name: kids ? kidName(r) : personName(r, female), female, born: year - (aMin + Math.floor(r() * Math.max(1, aMax - aMin + 1))), look: lookFor(r, female, kids) }); }
  const name = actName(r, kids ? 'kids' : individual ? 'combi' : type);
  if (type === 'pin' || type === 'rakugo') members[0].name = name;
  const yrs = el.unitYearsMin != null ? num(el.unitYearsMin) + Math.floor(r() * 6) : el.unitYearsMax != null ? Math.floor(r() * (num(el.unitYearsMax) + 1)) : el.geirekiMax != null ? Math.floor(r() * (num(el.geirekiMax) + 1)) : Math.floor(r() * 6);
  const amateur = el.pro === false ? true : el.amateur === false ? false : kids ? true : r() < 0.55;
  const region = /osaka|kansai|大阪|関西/.test(String(el.region || def.region || '')) ? 'osaka' : r() < 0.4 ? 'osaka' : 'tokyo';
  const agency = amateur ? null : Array.isArray(el.agency) && el.agency.length ? el.agency[0] : agencyFor(r, year, region);
  const sk = {};
  for (const kk of KINDS) sk[kk] = 1;
  const act = { id: `g${year}-${def.id}-${i}-${k}`, formed: year - yrs, type: individual ? 'combi' : type, region, talent: 0, peak: 6, members, name, style: kind, sk, proYear: amateur ? null : year - yrs, agency, breakup: null, debut: year - yrs, college: !kids && year >= 2000 && r() < 0.15, nsc: false, kid: kids, ghost: true };
  const power = clamp(mu + sd * gauss(r), 3, 92);
  return { id: act.id, name: individual ? `${members[0].name}（${name}）` : name, short: individual ? shortOf(members[0].name) : undefined, act, member: individual ? 0 : null, power, amateur, agency, type: individual ? 'pin' : act.type, unitName: name, ghost: true };
}
function simulateCore(g, id, year, champs) {
  const def = CONTESTS[id];
  const R = roundsAt(def, year);
  if (!R.length) return null;
  const seed = seedOf(g);
  const res = resultsOf(g, id, year);
  const mods = (res && res.mods) || {};
  const field = fieldOf(g, id, year, champs);
  const counts = realCounts(def, year);
  const ap = anonParams(def);
  const invite = isInvitational(def);
  let named = field.slice();
  // a small contest: only part of the eligible acts enter (a seeded draw), the rest of the entries are the anonymous mass
  if (counts[0] && named.length > counts[0].E && !invite) {
    const pr = rngOf(seed, 'enter', id, year);
    named = named.map((e) => ({ e, k: pr() })).sort((a, b) => a.k - b.k).slice(0, Math.max(1, Math.round(counts[0].E))).map((x) => x.e).sort((a, b) => b.power - a.power);
  }
  let anon = { n: invite ? 0 : Math.max(0, counts[0].E - named.length), mu: ap.mu, sd: ap.sd };
  const ghosts = [];
  const rounds = [];
  let prevElim = [];
  for (let i = 0; i < R.length; i++) {
    const r = R[i];
    const pm = (mods.rounds && mods.rounds[i]) || null;
    let revival = null;
    if (r.revival && i > 0) {
      const pool = prevElim.slice(0, 30);
      const scores = new Map(pool.map((e) => [e.id, scoreOf(e.power, rngOf(seed, id, year, 'rev', i, e.id))]));
      const pmR = (mods.revival && mods.revival[i]) || null;
      const k = Math.max(1, num(r.revivalPass, 1));
      const order = pool.slice().sort((a, b) => scores.get(b.id) - scores.get(a.id));
      const winners = order.slice(0, pmR && pmR.win ? k - 1 : k);
      revival = { pool: order.map((e) => e.id), scores, winners: winners.map((e) => e.id), player: pmR };
      named = named.concat(winners);
    }
    const last = i === R.length - 1;
    const { E, P } = counts[i];
    // small rounds are listed in full: the anonymous entrants who got this far become named stand-ins
    if (last || E <= EXACT_MAX || anon.n < 0.5 || E <= named.length) {
      const playerHere = !!pm || (last && !!mods.final) || !!(r.revival && mods.revival && mods.revival[i] && mods.revival[i].win);
      // an invited player takes the place of the last of the invited acts
      if (invite && i === 0 && playerHere && named.length > Math.round(E) - 1) named = named.slice(0, Math.max(1, Math.round(E) - 1));
      const deficit = Math.round(E) - (playerHere ? 1 : 0) - named.length;
      for (let k = 0; k < deficit && k < 400; k++) { const gh = ghostEntrant(seed, def, year, i, k, anon.n >= 0.5 ? anon.mu : ap.mu, anon.n >= 0.5 ? anon.sd : ap.sd); ghosts.push(gh); named.push(gh); }
      anon = { n: 0, mu: anon.mu, sd: anon.sd };
    }
    const scores = new Map();
    for (const e of named) scores.set(e.id, scoreOf(e.power, rngOf(seed, id, year, i, e.id)));
    const sorted = named.slice().sort((a, b) => scores.get(b.id) - scores.get(a.id));
    const removed = new Set((pm && pm.remove) || []);
    let passed, cut, exact = anon.n < 0.5 || E <= named.length || last;
    const anonIn = anon.n;
    let anonInMS = null;
    if (exact) {
      const want = Math.max(0, P - (pm && pm.pass ? 1 : 0));
      passed = sorted.filter((e) => !removed.has(e.id)).slice(0, last ? sorted.length : want);
      const lp = passed[Math.min(passed.length, want) - 1];
      cut = last ? 0 : lp ? scores.get(lp.id) : 100;
      anon = { n: 0, mu: anon.mu, sd: anon.sd };
    } else {
      const c = MODEL;
      const sS = Math.sqrt((c.b * anon.sd) ** 2 + c.s ** 2);
      const mS = c.a + c.b * anon.mu;
      anonInMS = { mS, sS };
      const sc = sorted.map((e) => scores.get(e.id));
      const namedAbove = (T) => { let lo = 0, hi = sc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sc[m] >= T) lo = m + 1; else hi = m; } return lo; };
      const total = (T) => namedAbove(T) + anon.n * (1 - PHI((T - mS) / sS));
      let lo = -40, hi = 140;
      for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (total(mid) > P) lo = mid; else hi = mid; }
      cut = (lo + hi) / 2;
      passed = sorted.filter((e) => scores.get(e.id) >= cut && !removed.has(e.id));
      const z = (cut - mS) / sS;
      const surv = Math.max(1e-9, 1 - PHI(z));
      const lam = phi(z) / surv;
      const rho2 = (c.b * anon.sd) ** 2 / (sS * sS);
      const nmu = anon.mu + (c.b * anon.sd * anon.sd / sS) * lam;
      const nsd = anon.sd * Math.sqrt(Math.max(0.15, 1 - rho2 * lam * (lam - z)));
      anon = { n: anon.n * surv, mu: nmu, sd: nsd, mS, sS };
    }
    const passSet = new Set(passed.map((e) => e.id));
    prevElim = sorted.filter((e) => !passSet.has(e.id));
    rounds.push({ i, id: r.id || `r${i + 1}`, name: r.name || `${i + 1}回戦`, E: exact ? named.length + (pm ? 1 : 0) : E, P: last ? 1 : exact ? passed.length + (pm && pm.pass ? 1 : 0) : P, exact, cut, scores, sorted: sorted.map((e) => e.id), passed: passed.map((e) => e.id), anonIn, anonInMS, anonOut: anon.n, anonMS: exact ? null : { mS: MODEL.a + MODEL.b * (anon.mu), sS: Math.sqrt((MODEL.b * anon.sd) ** 2 + MODEL.s ** 2) }, revival, entrants: named.map((e) => e.id) });
    if (last) break;
    named = passed;
  }
  const byId = new Map([...field, ...ghosts].map((e) => [e.id, e]));
  const lastR = rounds[rounds.length - 1];
  // the final: ranking by panel totals (judges' tastes) or by score; the player's stored final result is inserted
  const fin = finalRanking(g, id, year, lastR, byId, mods);
  return { id, year, field, byId, rounds, final: fin, champion: fin.ranking[0] || null };
}
function finalRanking(g, id, year, lastR, byId, mods) {
  const def = CONTESTS[id];
  const R = roundsAt(def, year);
  const r = R[R.length - 1] || {};
  const seed = seedOf(g);
  const ids = lastR ? lastR.passed.slice() : [];
  const totals = new Map();
  const panel = r.judge === 'panel' || r.judge === 'points' || (!r.judge && r.final);
  const judges = panel ? judgesFor(g, id, year, num(r.judges, 0) || undefined) : [];
  const scale = scaleOf(r);
  for (const aid of ids) {
    const sc = lastR.scores.get(aid);
    if (panel) totals.set(aid, panelScores(judges, sc, null, scale, rngOf(seed, id, year, 'panel', aid)).total);
    else totals.set(aid, Math.round(sc * 10) / 10);
  }
  const pf = mods.final || null;
  const entries = ids.map((aid) => ({ id: aid, total: totals.get(aid) }));
  if (pf && Number.isFinite(pf.total)) entries.push({ id: 'player', total: pf.total });
  entries.sort((a, b) => b.total - a.total);
  // 最終決戦 (stage2): the top N perform again, decided by votes (judges) or the second score
  let stage2 = null;
  if (r.stage2 && entries.length > 1) {
    const top = clamp(num(r.stage2.top, 3), 2, entries.length);
    const tops = entries.slice(0, top);
    const s2 = new Map();
    for (const e of tops) s2.set(e.id, e.id === 'player' ? num(pf && pf.stage2, 0) : scoreOf(byId.get(e.id).power, rngOf(seed, id, year, 'stage2', e.id)));
    const voters = judges.length || 7;
    const votes = new Map(tops.map((e) => [e.id, 0]));
    for (let j = 0; j < voters; j++) {
      const jr = rngOf(seed, id, year, 'vote', j);
      let best = null, bv = -1;
      for (const e of tops) { const v = s2.get(e.id) + 4 * gauss(jr) + (e.total - tops[0].total) * 0.02; if (v > bv) { bv = v; best = e.id; } }
      votes.set(best, votes.get(best) + 1);
    }
    if (pf && pf.votes) for (const [k, v] of Object.entries(pf.votes)) votes.set(k, v);
    const order = tops.slice().sort((a, b) => votes.get(b.id) - votes.get(a.id) || s2.get(b.id) - s2.get(a.id));
    stage2 = { top, order: order.map((e) => e.id), votes: Object.fromEntries(votes), scores: Object.fromEntries(s2) };
    const rest = entries.slice(top);
    entries.splice(0, entries.length, ...order, ...rest);
  }
  return { ranking: entries.map((e) => e.id), totals: Object.fromEntries(entries.map((e) => [e.id, e.total])), judges: judges.map((j) => j.name), stage2 };
}
// 'NNN点×7' → per-judge maximum (default 100)
export function scaleOf(r) {
  const m = /(\d+)\s*点/.exec(String((r && r.scoring) || ''));
  return m ? num(m[1], 100) : 100;
}
// A judge's points for a performance score (0..100 field scale): 100-point judges give ~80–98, 10-point ones ~6–10.
export function panelScores(judges, score, parts, scale = 100, r = Math.random) {
  const out = judges.map((j) => {
    let v = score;
    if (parts && j.tastePart && Number.isFinite(parts[j.tastePart])) v += (parts[j.tastePart] - score) * 0.25;
    v += num(j.strict) * -0.6 + 2.2 * gauss(r);
    let pts;
    if (scale >= 50) pts = clamp(Math.round(78 + (clamp(v, 0, 100) / 100) * 21), 70, scale);
    else pts = clamp(Math.round((clamp(v, 0, 100) / 100) * scale * 1.05), 1, scale);
    return { name: j.name, short: j.short || shortOf(j.name), pts, max: scale };
  });
  return { per: out, total: out.reduce((a, x) => a + x.pts, 0), max: scale * out.length };
}
const SIM_MAX = 24;
export function simOf(g, id, year) {
  const def = CONTESTS[id];
  if (!def || !g.state) return null;
  if (!heldIn(g, def, year).held) return null;
  const res = resultsOf(g, id, year);
  const key = `${seedOf(g)}|${id}|${year}|${res ? res.v : 0}|${verOf(g, id)}|${baseAbs(g)}`;
  const hit = CACHE.sims.get(key);
  if (hit) return hit;
  const champs = championsBefore(g, id, year);
  const sim = safe(`simulate:${id}`, () => simulateCore(g, id, year, champs), null);
  CACHE.sims.set(key, sim);
  if (CACHE.sims.size > SIM_MAX) CACHE.sims.delete(CACHE.sims.keys().next().value);
  return sim;
}
// May a past champion enter again? def.repeat / eligibility.repeat (explicit) win. Unspecified: invitationals yes; open contests
// with an OBJECT eligibility no (most 新人・賞レース); a FUNCTION eligibility encodes its own rules, so D1 adds no bar for the player
// (forPlayer) — the simulated field of such a contest still keeps past champions out (realism), unless repeat is true.
function repeatAllowed(def, forPlayer = false) {
  if (def.repeat != null) return !!def.repeat;
  const el = eligObj(def);
  if (el.repeat != null) return !!el.repeat;
  if (isInvitational(def)) return true;
  return forPlayer && typeof def.eligibility === 'function';
}
function championsBefore(g, id, year) {
  const def = CONTESTS[id];
  if (repeatAllowed(def)) return null;
  const set = new Set();
  for (const h of historyRows(g, id, year - 1)) if (h.champId && h.champId !== 'player') set.add(h.champId);
  return set;
}

// ================================================================ history (this world's, deterministic per save)
// rows: { year, edition, held, revival, champion, champId, runnerUp, runnerId, third, finalists: [names], note, player, deep: { actId: roundIdx } }
function historyRows(g, id, upto) {
  const def = CONTESTS[id];
  if (!def) return [];
  const h = def.history || {};
  const c = cstate(g);
  const key = `${c.seed}|${id}|${verOf(g, id)}|${baseAbs(g)}`;
  let memo = CACHE.hist.get(key);
  if (!memo) { memo = { rows: [], upto: num(h.founded, upto) - 1, champs: new Set() }; CACHE.hist.set(key, memo); if (CACHE.hist.size > 80) CACHE.hist.delete(CACHE.hist.keys().next().value); }
  const founded = num(h.founded, upto);
  for (let y = Math.max(founded, memo.upto + 1); y <= upto; y++) {
    memo.upto = y;
    const held = heldIn(g, def, y);
    if (!held.held) { memo.rows.push({ year: y, held: false, note: held.note || '開催なし', revival: false }); continue; }
    const frozen = c.hist[id] && c.hist[id][y];
    if (frozen) { memo.rows.push({ ...frozen, year: y, held: true }); if (frozen.champId && frozen.champId !== 'player') memo.champs.add(frozen.champId); continue; }
    const champs = repeatAllowed(def) ? null : memo.champs;
    const sim = safe(`history:${id}`, () => simulateCore(g, id, y, champs), null);
    const row = rowOfSim(g, def, y, sim, held);
    memo.rows.push(row);
    if (row.champId && row.champId !== 'player') memo.champs.add(row.champId);
  }
  return memo.rows.filter((r) => r.year <= upto);
}
function nameOfId(g, sim, aid) {
  if (aid === 'player') return playerUnitName(g);
  const e = sim && sim.byId.get(aid);
  return e ? e.name : '';
}
function rowOfSim(g, def, y, sim, held) {
  const fixed = def.history && isObj(def.history.champions) && def.history.champions[y];
  const ed = editionIn(g, def, y);
  if (!sim) return { year: y, edition: ed, held: true, revival: !!held.revival, champion: fixed || '（記録なし）', champId: null, note: '' };
  const rk = sim.final.ranking;
  const deep = {};
  const n = sim.rounds.length;
  for (let i = Math.max(0, n - 2); i < n; i++) for (const aid of sim.rounds[i].entrants) if (!/^g/.test(aid)) deep[aid] = i;
  return {
    year: y, edition: ed, held: true, revival: !!held.revival,
    champion: fixed || nameOfId(g, sim, rk[0]), champId: rk[0] || null,
    runnerUp: rk[1] ? nameOfId(g, sim, rk[1]) : null, runnerId: rk[1] || null, third: rk[2] ? nameOfId(g, sim, rk[2]) : null,
    finalists: rk.slice(0, 12).map((aid) => nameOfId(g, sim, aid)), note: held.revival ? '復刻開催' : '', player: rk.includes('player') ? rk.indexOf('player') + 1 : null, deep,
  };
}
// finished cycles only (the final's day is past, or the result is frozen)
function lastDoneYear(g, def) {
  const today = todayOf(g);
  const y = seasonYearOf(g, def, today);
  const c = cstate(g);
  if (c.hist[def.id] && c.hist[def.id][y]) return y;
  return y - 1;
}

// ================================================================ judges (fictional panels with tenure)
export function judgesFor(g, id, year, n) {
  const def = CONTESTS[id];
  const R = roundsAt(def, year);
  const fin = R[R.length - 1] || {};
  const want = clamp(num(n, num(fin.judges, 5)), 1, 12);
  const key = `${seedOf(g)}|${id}|${year}|${want}`;
  const hit = CACHE.judges.get(key);
  if (hit) return hit;
  const seed = seedOf(g);
  // a pool of 3×want judges; each serves a run of years (some long, some short)
  const pool = [];
  for (let k = 0; k < want * 3 + 4; k++) {
    const r = rngOf(seed, 'judge', id, k);
    const p = judgePerson(r);
    const from = num(def.history && def.history.founded, 1980) + Math.floor(r() * 60) - 8;
    pool.push({ ...p, id: `j${k}`, from, to: from + 3 + Math.floor(r() * 14) });
  }
  let list = pool.filter((j) => year >= j.from && year <= j.to);
  if (list.length < want) list = list.concat(pool.filter((j) => !list.includes(j)).sort((a, b) => Math.abs(a.from - year) - Math.abs(b.from - year)));
  const seenS = new Set();
  list = list.filter((j) => { if (seenS.has(j.short)) return false; seenS.add(j.short); return true; }).slice(0, want);
  CACHE.judges.set(key, list);
  if (CACHE.judges.size > 200) CACHE.judges.delete(CACHE.judges.keys().next().value);
  return list;
}

// ================================================================ the player
// g.unit() (owarai.js); without it (not loaded yet): the 相方 makes a combi, else a pin act named after the player
export function playerUnit(g) {
  if (has(g, 'unit')) return safe('unit', () => g.unit(), null);
  const st = g.state;
  if (!st) return null;
  const P = st.partner && PEOPLE[st.partner];
  const me = { id: 'player', name: st.name, short: st.name, role: P ? 'tsukkomi' : 'pin', look: st.look || {}, stats: {} };
  const base = { formed: { year: startYear(g), month: 4, day: 1 }, harmony: 50, amateur: !st.agency, agency: st.agency || null, dissolved: false };
  return P ? { id: `u_${P.id}`, type: 'combi', name: `${st.name}と${P.short || P.name}`, members: [me, { id: P.id, name: P.name, short: P.short || P.name, role: 'boke', look: P.look || {}, stats: {} }], style: 'manzai', source: 'people', ...base }
    : { id: 'solo', type: 'pin', name: st.name, members: [me], style: 'pin', source: 'solo', ...base };
}
// g.unitPower(kind) (owarai.js); without it: the お笑い skill
export function playerPower(g, kind) {
  if (has(g, 'unitPower')) return num(safe('unitPower', () => g.unitPower(kind), 40), 40);
  const w = num(g.state && g.state.skills && g.state.skills.warai, 0);
  return clamp(Math.round(12 + w * 0.7), 5, 95);
}
export function playerUnitName(g) {
  const u = playerUnit(g);
  return (u && u.name) || (g.state && g.state.name) || 'あなた';
}
// The player's eligibility for the cycle `year`: { ok, reasons: [{ key, text }], why (text), notes: [] }
export function eligibilityOf(g, id, year) {
  const def = CONTESTS[id];
  const reasons = [];
  if (!def) return { ok: false, reasons: [{ key: 'none', text: 'この大会は登録されていない' }], why: 'この大会は登録されていない', notes: [] };
  const y = year ?? seasonYearOf(g, def);
  const u = playerUnit(g);
  const add = (key, text) => reasons.push({ key, text });
  if (!u || u.dissolved) add('unit', '出場するユニット（コンビ・ピン）がない');
  const cyc = cycleOf(g, def, y);
  if (cyc && !cyc.held) add('held', cyc.note || 'この年は開催されない');
  if (typeof def.eligibility === 'function') {
    const r = safe(`eligibility:${id}`, () => def.eligibility(g, u, y), { ok: true });
    if (r && r.ok === false) add('custom', r.why || '出場資格がない');
  } else if (u) {
    const el = eligObj(def);
    const n = Array.isArray(u.members) ? u.members.length : 1;
    if (Array.isArray(el.members)) {
      const [mn, mx] = el.members;
      if (mn != null && n < mn) add('members', mn >= 2 ? `${mn}人以上のコンビ・グループが対象（ピンでは出られない）` : `${mn}人以上が対象`);
      if (mx != null && n > mx) add('members', mx === 1 ? 'ピン芸人（1人）が対象（コンビでは出られない）' : `${mx}人までが対象（いまは${n}人）`);
    }
    const uy = has(g, 'unitYears') ? num(safe('unitYears', () => g.unitYears(y), 0)) : 0;
    const gr = has(g, 'geireki') ? num(safe('geireki', () => g.geireki(y), 0)) : 0;
    const age = has(g, 'playerAge') ? num(safe('playerAge', () => g.playerAge(y), 20), 20) : 20;
    if (el.unitYearsMax != null && uy > el.unitYearsMax) add('unitYears', `結成${el.unitYearsMax}年以内が対象（${y}年で結成${uy}年目）`);
    if (el.unitYearsMin != null && uy < el.unitYearsMin) add('unitYears', `結成${el.unitYearsMin}年以上が対象（${y}年で結成${uy}年目）`);
    if (el.geirekiMax != null && gr > el.geirekiMax) add('geireki', `芸歴${el.geirekiMax}年以内が対象（${y}年で芸歴${gr}年）`);
    if (el.geirekiMin != null && gr < el.geirekiMin) add('geireki', `芸歴${el.geirekiMin}年以上が対象（${y}年で芸歴${gr}年）`);
    if (el.ageMax != null && age > el.ageMax) add('age', `${el.ageMax}歳以下が対象（${y}年で${age}歳）`);
    if (el.ageMin != null && age < el.ageMin) add('age', `${el.ageMin}歳以上が対象（${y}年で${age}歳）`);
    const amateur = u.amateur != null ? !!u.amateur : !g.state.agency;
    if (el.pro === false && !amateur) add('pro', 'アマチュア限定（事務所に所属しているプロは出られない）');
    if (el.amateur === false && amateur) add('amateur', 'プロ限定（事務所に所属していないと出られない）');
    if (Array.isArray(el.agency) && el.agency.length && !el.agency.includes(g.state.agency)) add('agency', `${el.agency.map((a) => (AGENCIES[a] ? AGENCIES[a].name : a)).join('・')}所属の芸人が対象`);
    if (el.invite) {
      const f = num(el.invite.fame, 0);
      if (f && num(g.state.fame) < f) add('invite', `招待制（★${f}以上の芸人に声がかかる。いまは★${num(g.state.fame)}）`);
    }
    if (el.kids) add('kids', '子どもの大会（小・中学生が対象）');
  }
  // extra rules of a contest (THE SECOND: 全国大会の優勝経験者は不可, 今宮: 受賞歴なし, an area of activity…): eligibility.extra / .check
  const elx = eligObj(def);
  for (const k of ['extra', 'check']) {
    if (typeof elx[k] !== 'function') continue;
    const r = safe(`eligibility.${k}:${id}`, () => elx[k](g, u, y), null);
    if (r && r.ok === false) add('extra', r.why || '出場資格がない');
  }
  const hRows = !repeatAllowed(def, true) && !isSelfRun(def) ? historyRows(g, id, y - 1) : [];
  if (hRows.some((r) => r.champId === 'player')) add('champion', '優勝した大会には、もう出られない（王者は卒業）');
  const notes = [];
  const el = eligObj(def);
  const n0 = safe(`eligibility.note:${id}`, () => el.note, null);
  if (n0) notes.push(String(n0));
  const en = safe(`eligibilityNote:${id}`, () => (typeof def.eligibilityNote === 'function' ? def.eligibilityNote(g, y) : def.eligibilityNote), null);
  if (en && !notes.includes(String(en))) notes.push(String(en));
  return { ok: !reasons.length, reasons, why: reasons.map((r) => r.text).join('／'), notes, year: y };
}
// The entry fee: { yen (real, nominal), internal, text }
export function feeOf(g, id, year) {
  const def = CONTESTS[id];
  const u = playerUnit(g);
  const amateur = u && u.amateur != null ? !!u.amateur : !g.state.agency;
  let yen = 0;
  const f = def && def.fee;
  if (typeof f === 'function') yen = num(safe(`fee:${id}`, () => f(g, u, year), 0));
  else if (isObj(f)) yen = num(amateur ? f.amateur ?? f.pro : f.pro ?? f.amateur, 0);
  else yen = num(f, 0);
  if (isInvitational(def)) yen = 0;
  const ft = def ? safe(`feeText:${id}`, () => (typeof def.feeText === 'function' ? def.feeText(year) : def.feeText), null) : null;
  return { yen, internal: realToInternal(yen), text: ft ? String(ft) : yen ? `${yenLabel(yen)}（1組）` : isInvitational(def) ? 'なし（招待制）' : '無料' };
}
export function prizeOf(def, year) {
  const p = def && def.prize;
  const yen = typeof p === 'function' ? num(safe(`prize:${def.id}`, () => p(year), 0)) : num(p, 0);
  return { yen, text: (def && def.prizeText) || (yen ? `優勝賞金 ${yenLabel(yen)}` : '') };
}

// ================================================================ entries
export function entryOf(g, id, year) {
  const c = cstate(g);
  const y = year ?? seasonYearOf(g, id);
  return (c.entries[id] && c.entries[id][y]) || null;
}
function allEntries(g) {
  const c = cstate(g), out = [];
  for (const id of Object.keys(c.entries)) for (const y of Object.keys(c.entries[id] || {})) { const e = c.entries[id][y]; if (isObj(e)) out.push({ id, year: Number(y), e }); }
  return out;
}
// A realistic entry number: how many have entered before you (entries pile up towards the deadline) out of the field.
function entryNumber(g, id, cyc) {
  const R = cyc.rounds.map((x) => x.r);
  const F = Math.max(10, num(R[0] && R[0].field, 400));
  if (!cyc.entry) return 1 + Math.floor(rngOf(seedOf(g), 'invno', id, cyc.year)() * Math.min(F, 20));
  const span = Math.max(1, cyc.entry.to - cyc.entry.from + 1);
  const t = clamp((todayOf(g) - cyc.entry.from + 0.5) / span, 0, 1);
  const before = Math.round(F * Math.pow(t, 1.6) * 0.92);
  const jitter = Math.floor(rngOf(seedOf(g), 'entryno', id, cyc.year, todayOf(g))() * Math.max(3, F * 0.02));
  return clamp(before + jitter + 1, 1, F + 50);
}
// Creates the player's entry record without any UI (for custom entry flows: E1 / E2). fields: { unitName, kana, rep, formed,
// agency, members, kinds, title, picks: { 0: optionIndex }, invite, fee (real yen), no }
export function registerEntry(g, id, fields = {}) {
  const def = CONTESTS[id];
  if (!def) return null;
  const c = cstate(g);
  const y = fields.year ?? seasonYearOf(g, id);
  const cyc = cycleOf(g, def, y);
  if (!c.entries[id]) c.entries[id] = {};
  if (c.entries[id][y] && c.entries[id][y].status !== 'withdrawn') return c.entries[id][y];
  const u = playerUnit(g);
  const e = {
    no: fields.no ?? entryNumber(g, id, cyc), unitName: fields.unitName || playerUnitName(g), kana: fields.kana || (u && u.kana) || '',
    rep: fields.rep || (g.state && g.state.name) || '', formed: fields.formed || null, agency: fields.agency ?? (g.state.agency || null),
    members: fields.members || (u && Array.isArray(u.members) ? u.members.length : 1), kinds: fields.kinds || KIND_LABEL[kindOf(def)] || '', title: fields.title || '',
    fee: num(fields.fee, 0), day: todayOf(g), status: 'entered', round: 0, results: [], picks: { 0: num(fields.picks && fields.picks[0], 0), ...(fields.picks || {}) },
    invite: !!fields.invite, year: y,
  };
  c.entries[id][y] = e;
  c.stats.entered = num(c.stats.entered) + 1;
  return e;
}

// ================================================================ news (rate-limited) & messages
export const NEWS_FROM = 'ドット芸能 お笑い速報'; // matches the news app's press filter and its 芸能 category
export const OFFICE_FROM = '賞レース事務局'; // personal notices (entries, reminders, results): メッセージ, not the news feed
const DIRECT_PER_DAY = 3;
let inMorning = false;
function dailyCount(g) { const c = cstate(g); if (c.daily.day !== todayOf(g)) c.daily = { day: todayOf(g), n: 0 }; return c.daily; }
function logNews(g, text, opts) {
  const c = cstate(g);
  c.news.unshift({ day: todayOf(g), text: String(text), contest: opts.contest || null, kind: opts.personal ? 'personal' : 'news' });
  if (c.news.length > 120) c.news.length = 120;
}
// opts: { contest, cat, from, personal (a notice to the player: 賞レース事務局), prio (0..100), key (sent once per key) }
export function pushNews(g, text, opts = {}) {
  if (!text || !g.state) return false;
  const c = cstate(g);
  if (opts.key) { if (c.sent[opts.key]) return false; c.sent[opts.key] = todayOf(g); }
  logNews(g, text, opts);
  const item = { text: String(text), contest: opts.contest || null, from: opts.from || (opts.personal ? OFFICE_FROM : NEWS_FROM), personal: !!opts.personal, prio: num(opts.prio, opts.personal ? 90 : 40), look: opts.look, kind: opts.kind };
  if (inMorning) { c.queue.push(item); return true; }
  const d = dailyCount(g);
  if (d.n < DIRECT_PER_DAY || item.personal) { sendItem(g, item); d.n++; return true; }
  c.queue.push(item);
  return true;
}
function sendItem(g, it) {
  const msg = { from: it.from, text: g.fmt ? g.fmt(it.text) : it.text, kind: it.kind || 'news', ...(it.contest ? { contest: it.contest } : {}) };
  if (it.look) msg.look = it.look;
  g.message(msg);
}
// The morning's queue: the 3 most important go out as messages, everything else as one digest.
function flushQueue(g) {
  const c = cstate(g);
  if (!c.queue.length) return;
  const q = c.queue.splice(0).sort((a, b) => b.prio - a.prio);
  const d = dailyCount(g);
  const direct = [];
  const rest = [];
  for (const it of q) { if (d.n + direct.length < DIRECT_PER_DAY) direct.push(it); else rest.push(it); }
  // the digest goes in first and the most important message last, so it sits on top of the inbox
  if (rest.length) {
    const personal = rest.filter((x) => x.personal), news = rest.filter((x) => !x.personal);
    const head = (s) => String(s).split('\n')[0];
    const lines = [...personal.map((x) => `◆${head(x.text)}`), ...news.slice(0, 14).map((x) => `・${head(x.text)}`)];
    if (news.length > 14) lines.push(`ほか${news.length - 14}件（賞レースの画面「ニュース」で全部読める）`);
    sendItem(g, { from: NEWS_FROM, text: `【お笑いニュースまとめ】${rest.length}件\n${lines.join('\n')}`, prio: 0 });
    d.n++;
  }
  for (const it of direct.slice().reverse()) sendItem(g, it);
  d.n += direct.length;
}

// ================================================================ rewards
// what: 'pass' (a 予選 round) | 'finalist' | 'third' | 'runnerup' | 'champion' | 'out' | 'revival'
// opts: { round, roundsTotal, tv, silent, prize: false }
export function applyReward(g, id, what, opts = {}) {
  const def = CONTESTS[id];
  if (!def || !g.state) return null;
  const p = prestigeOf(def) / 100;
  const tv = opts.tv ? 1.25 : 1;
  let fame = 0, fans = 0, money = 0, stress = 0, harmony = 0;
  if (what === 'pass') { const k = (num(opts.round, 0) + 1) / Math.max(1, num(opts.roundsTotal, 3)); fame = Math.round((2 + 14 * p * k) * tv); fans = Math.round(fame * 6); stress = -6; harmony = 1; }
  else if (what === 'revival') { fame = Math.round((20 + 120 * p) * tv); fans = Math.round(fame * 25); stress = -10; harmony = 2; }
  else if (what === 'finalist') { fame = Math.round((40 + 260 * p) * tv); fans = Math.round(600 + 9000 * p * tv); stress = -8; harmony = 2; }
  else if (what === 'third') { fame = Math.round((55 + 340 * p) * tv); fans = Math.round(800 + 12000 * p * tv); stress = -10; harmony = 3; }
  else if (what === 'runnerup') { fame = Math.round((70 + 430 * p) * tv); fans = Math.round(1000 + 17000 * p * tv); stress = -12; harmony = 3; }
  else if (what === 'champion') { fame = Math.round((110 + 720 * p) * tv); fans = Math.round(2000 + 42000 * p * tv); stress = -35; harmony = 6; if (opts.prize !== false) money = realToInternal(prizeOf(def, opts.year ?? seasonYearOf(g, id)).yen); }
  else if (what === 'out') { stress = 4; harmony = -1; }
  if (fame) g.addFame(fame, true);
  if (fans) g.addFans(fans, true);
  if (money) { g.addMoney(money, true); cstate(g).stats.prize = num(cstate(g).stats.prize) + money; }
  if (stress) g.addNeed('stress', stress);
  if (harmony) addHarmony(g, harmony, what === 'out' ? '賞レースで敗退' : what === 'champion' ? '賞レースで優勝' : '賞レースで勝ち上がった');
  if ((what === 'champion' || what === 'runnerup' || what === 'finalist') && prestigeOf(def) >= 40) offerShows(g, id, what);
  return { fame, fans, money, stress, harmony };
}
export function addHarmony(g, n, why = '') {
  if (has(g, 'addHarmony')) { safe('addHarmony', () => g.addHarmony(n, why)); return; }
  if (has(g, 'unitHarmony')) { safe('unitHarmony', () => g.unitHarmony(n, why)); return; }
  const pid = g.state && g.state.partner;
  if (pid && has(g, 'addAff')) safe('addAff', () => g.addAff(pid, n, true));
}
// Offers after a good result (career.js style): a weekly ネタ番組 for finalists, a variety show for champions of big contests.
const SHOW_NETA = 'contest_netaban', SHOW_VARIETY = 'contest_champ_show';
registerRegular(SHOW_NETA, {
  title: 'ドット笑いの花道', place: 'fujitv', weekday: 4, medium: 'tv', requires: null, stamina: 20, pay: 22000, fame: 55, fans: 1400,
  minigame: 'tsukkomi', skill: 'warai', opts: { difficulty: 3 }, host: 'ドット笑いの花道 プロデューサー',
  desc: '毎週金曜に収録する、若手のネタ番組。賞レースで結果を出した芸人が呼ばれる。',
  offer: '『ドット笑いの花道』のプロデューサーです。賞レースのネタ、拝見しました！\n毎週金曜収録のネタ番組に、レギュラーで出ていただけませんか？',
});
registerRegular(SHOW_VARIETY, {
  title: 'チャンピオン笑劇場', place: 'tvasahi', weekday: 1, medium: 'tv', requires: null, stamina: 25, pay: 48000, fame: 120, fans: 3200,
  minigame: 'tsukkomi', skill: 'warai', opts: { difficulty: 4 }, host: 'チャンピオン笑劇場 プロデューサー',
  desc: '賞レース王者が毎週ネタとロケで暴れるバラエティ。毎週火曜収録。',
  offer: '優勝、おめでとうございます！『チャンピオン笑劇場』のプロデューサーです。\n毎週火曜の収録で、王者として番組の顔になってもらえませんか？',
});
function offerShows(g, id, what) {
  const st = g.state;
  const pend = (rid) => st.phone && st.phone.inbox.some((m) => m && m.kind === 'offer' && m.regular === rid && !m.answered);
  const active = (rid) => st.regulars[rid] && !st.regulars[rid].dropped && st.regulars[rid].since != null;
  const ids = what === 'champion' && prestigeOf(CONTESTS[id]) >= 55 ? [SHOW_VARIETY, SHOW_NETA] : [SHOW_NETA];
  for (const rid of ids) {
    if (!REGULARS[rid] || active(rid) || pend(rid)) continue;
    g.message({ from: REGULARS[rid].host, kind: 'offer', regular: rid, text: g.fmt(REGULARS[rid].offer) });
    dailyCount(g).n++; // counts in the day's contest message budget (an offer is never merged into a digest)
    break; // one offer at a time
  }
}

// ================================================================ the season list (g.contests)
export const STATUS_LABEL = { notyet: 'まだ始まっていない', future: 'エントリー前', open: 'エントリー受付中', running: '開催中', closed: '終了', invite: '招待制' };
// ---------------------------------------------------------------- self-run contests (def.selfRun: E1 / E2 / E3 run their own world)
export const isSelfRun = (def) => !!(def && def.selfRun);
export function selfStatus(g, def) { return def ? safe(`status:${def.id}`, () => (typeof def.status === 'function' ? def.status(g) : null), null) : null; }
const EXT_STATUS = { entered: 'entered', entry: 'entered', before: 'entered', prelim: 'passed', passed: 'passed', semi: 'passed', final: 'passed', finalist: 'passed', out: 'out', lost: 'out', eliminated: 'out', champion: 'champion', winner: 'champion', withdrawn: 'withdrawn', kiken: 'withdrawn' };
// the player's entry as the def reports it (status(g).entry), shaped like a D1 entry (external: true)
export function externalEntry(g, def) {
  const st = selfStatus(g, def);
  const e = st && st.entry;
  if (!e || typeof e !== 'object') return null;
  const status = EXT_STATUS[e.status] || (e.final && e.final.place === 1 ? 'champion' : 'entered');
  return { external: true, no: e.no ?? '—', unitName: e.name || e.unitName || playerUnitName(g), status, statusText: e.statusLabel || e.status || '', roundName: e.round || null, next: e.next || null, results: Array.isArray(e.results) ? e.results : [], round: 0, picks: {}, final: e.final || null, year: st.year ?? null };
}
function selfHistory(g, def) {
  const rowOf = (r) => r && {
    year: num(r.year ?? r.y), edition: r.edition ?? r.ed ?? null, held: r.held !== false, revival: !!(r.revival ?? r.rev), champion: r.champion ?? r.chN ?? null,
    runnerUp: r.runnerUp ?? r.ruN ?? null, third: r.third ?? r.thN ?? null, finalists: r.finalists || r.finN || [], note: r.note || '', player: r.player ?? r.playerPlace ?? (r.ch === 'me' ? 1 : null), champId: r.ch === 'me' ? 'player' : null,
  };
  const hl = safe(`historyList:${def.id}`, () => (typeof def.historyList === 'function' ? def.historyList(g) : null), null);
  if (Array.isArray(hl)) return hl.map((r) => safe(`historyRow:${def.id}`, () => rowOf(r), null)).filter((r) => r && r.year).sort((a, b) => a.year - b.year);
  const out = [];
  const h = def.history || {};
  const upto = lastDoneYear(g, def);
  for (let y = num(h.founded, upto); y <= upto; y++) {
    const held = heldIn(g, def, y);
    if (!held.held) { out.push({ year: y, held: false, note: held.note || '開催なし', revival: false }); continue; }
    let row = safe(`historyOf:${def.id}`, () => (typeof def.historyOf === 'function' ? rowOf(def.historyOf(y)) : null), null);
    if (!row) { const ch = safe(`champions:${def.id}`, () => (isObj(h.champions) ? h.champions[y] : null), null); row = { year: y, held: true, revival: !!held.revival, champion: ch || null, runnerUp: null, third: null, finalists: [], note: held.revival ? '復刻開催' : '', player: null }; }
    row.edition = row.edition ?? editionIn(g, def, y);
    out.push(row);
  }
  return out;
}

export function selfToday(g) {
  const out = [];
  for (const def of Object.values(CONTESTS)) {
    if (!isSelfRun(def)) continue;
    const st = selfStatus(g, def);
    const items = st && Array.isArray(st.today) ? st.today : [];
    for (const it of items) if (it) out.push({ id: def.id, def, year: st.year ?? seasonYearOf(g, def), selfRun: true, label: String(it.label || ''), item: it });
  }
  return out;
}

export function contestInfo(g, id, day = todayOf(g)) {
  const def = CONTESTS[id];
  if (!def) return null;
  const sst = isSelfRun(def) ? selfStatus(g, def) : null;
  const year = sst && Number.isFinite(Number(sst.year)) ? Number(sst.year) : seasonYearOf(g, def, day);
  const cyc = cycleOf(g, def, year);
  const entry = entryOf(g, id, year);
  let status;
  if (cyc.notyet) status = 'notyet';
  else if (!cyc.held) status = 'closed';
  else if (cyc.entry) status = day < cyc.entry.from ? 'future' : day <= cyc.entry.to ? 'open' : day <= cyc.final.day ? 'running' : 'closed';
  else status = day < cyc.rounds[0].first ? 'future' : day <= cyc.final.day ? 'running' : 'closed';
  let nextRound = null;
  if (entry && (entry.status === 'entered' || entry.status === 'passed')) {
    const rr = cyc.rounds[entry.round];
    if (rr) { const o = rr.options[num(entry.picks && entry.picks[entry.round], 0)] || rr.options[0]; nextRound = { idx: rr.idx, name: rr.name, day: o.day, venue: o.venue, date: o.date }; }
  } else if (cyc.held) {
    const rr = cyc.rounds.find((x) => x.last >= day);
    if (rr) { const o = rr.options.find((x) => x.day >= day) || rr.options[0]; nextRound = { idx: rr.idx, name: rr.name, day: o.day, venue: o.venue, date: o.date }; }
  }
  const label = cyc.notyet ? `${contestName(def, year)}（まだ始まっていない／${num(def.history && def.history.founded)}年創設）` : cyc.label;
  if (isSelfRun(def) && !entry) {
    // the def's own view: its entry, next round and status label
    const st = sst;
    const ext = externalEntry(g, def);
    if (ext && ext.next && Number.isFinite(Number(ext.next.day))) {
      const ri = cyc.rounds.findIndex((rr) => rr.name === ext.roundName || rr.id === ext.roundName);
      nextRound = { ...(ri >= 0 ? { idx: ri } : {}), name: ext.roundName || '次の回戦', day: Number(ext.next.day), venue: ext.next.city || ext.next.hall || '', date: contestDate(g, Number(ext.next.day)) };
    }
    const map = { notyet: 'notyet', hiatus: 'closed', before: 'future', entry: 'open', open: 'open', prelim: 'running', finalday: 'running', running: 'running', after: 'running', closed: 'closed' };
    const stt = st && map[st.status] ? map[st.status] : status;
    return { id, def, year, cyc, status: stt, statusLabel: (st && st.statusLabel) || STATUS_LABEL[stt] || '', revival: !!cyc.revival, edition: st && st.edition != null ? st.edition : cyc.edition, label: (st && st.label) || label, nextRound, entry: ext, invite: cyc.invite, selfRun: true, today: st && Array.isArray(st.today) ? st.today : [] };
  }
  let closedLabel = null;
  if (status === 'closed' && cyc.held && cyc.final.day < day) {
    const nx = cycleOf(g, def, year + 1);
    const start = nx && nx.held ? (nx.entry ? nx.entry.from : nx.rounds[0] && nx.rounds[0].first) : null;
    closedLabel = start ? `終了（次回は${dateText(g, start)}から${nx.entry ? '受付' : ''}）` : '終了';
  }
  return { id, def, year, cyc, status, statusLabel: closedLabel || (cyc.notyet ? `まだ始まっていない（${num(def.history && def.history.founded)}年創設）` : !cyc.held ? cyc.note || '開催なし' : cyc.invite && status !== 'closed' ? (status === 'running' ? '開催中（招待制）' : '招待制') : STATUS_LABEL[status]), revival: !!cyc.revival, edition: cyc.edition, label, nextRound, entry, invite: cyc.invite };
}

// Player's rounds due on a day: [{ id, year, idx, option, revival, entry, cyc }]
export function dueOn(g, day = todayOf(g)) {
  const out = [];
  for (const { id, year, e } of allEntries(g)) {
    const def = CONTESTS[id];
    if (!def) continue;
    const cyc = cycleOf(g, def, year);
    if (!cyc || !cyc.held) continue;
    if (e.status === 'entered' || e.status === 'passed') {
      const rr = cyc.rounds[e.round];
      if (!rr) continue;
      const o = rr.options[num(e.picks && e.picks[e.round], 0)] || rr.options[0];
      if (o.day === day && !(e.today && e.today.day === day && e.today.done)) out.push({ id, year, idx: rr.idx, option: o, revival: false, entry: e, cyc });
    } else if (e.status === 'out' && e.revivalOk != null) {
      const rr = cyc.rounds[e.revivalOk];
      if (rr && rr.options[0].day === day && !(e.today && e.today.day === day && e.today.done)) out.push({ id, year, idx: rr.idx, option: rr.options[0], revival: true, entry: e, cyc });
    }
  }
  return out;
}
// Everything on a day of the calendar: [{ id, def, type: 'entryOpen'|'entryClose'|'round'|'final', name, mine }]
export function eventsOn(g, day) {
  const out = [];
  for (const def of Object.values(CONTESTS)) {
    const y = seasonYearOf(g, def, day);
    for (const yy of [y, y + 1]) {
      const cyc = cycleOf(g, def, yy);
      if (!cyc || !cyc.held) continue;
      const e = entryOf(g, def.id, yy);
      if (cyc.entry && cyc.entry.from === day) out.push({ id: def.id, def, year: yy, type: 'entryOpen', name: 'エントリー開始' });
      if (cyc.entry && cyc.entry.to === day) out.push({ id: def.id, def, year: yy, type: 'entryClose', name: 'エントリー締切' });
      for (const rr of cyc.rounds) for (const o of rr.options) if (o.day === day) {
        const reached = !!e && (e.status === 'entered' || e.status === 'passed' ? e.round >= rr.idx : (e.results || []).some((x) => x.round === rr.idx));
        const mine = reached && num(e.picks && e.picks[rr.idx], 0) === o.k;
        out.push({ id: def.id, def, year: yy, type: rr.idx === cyc.rounds.length - 1 ? 'final' : 'round', name: `${rr.name}${rr.options.length > 1 ? `（${o.venue}）` : ''}`, idx: rr.idx, option: o, mine });
      }
    }
  }
  const seen = new Set();
  return out.filter((x) => { const k = `${x.id}|${x.type}|${x.idx}|${x.option ? x.option.k : ''}|${x.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ================================================================ rivals (g.contestRivals)
function tagsFor(g, id, year, e, roundIdx, sim) {
  const def = CONTESTS[id];
  const el = eligObj(def);
  const tags = [];
  const act = e.act;
  const yrs = year - act.formed;
  const prev = historyRows(g, id, year - 1);
  const last = prev[prev.length - 1];
  if (last && last.year === year - 1 && last.champId === e.id) tags.push('前年王者');
  if ((el.unitYearsMax != null && yrs === el.unitYearsMax) || (el.geirekiMax != null && year - act.debut === el.geirekiMax)) tags.push('ラストイヤー');
  if (e.amateur) tags.push(act.kid ? (act.members.some((m) => year - m.born >= 13) ? '中学生' : '小学生') : 'アマチュア');
  const R = roundsAt(def, year);
  const semi = Math.max(0, R.length - 2);
  const recent = prev.slice(-4).filter((h) => h.held && h.deep && h.deep[e.id] != null);
  if (recent.filter((h) => h.deep[e.id] >= semi).length >= 2) tags.push('準決勝常連');
  if (prev.some((h) => h.finalists && h.finalists.includes(e.name)) && !tags.includes('前年王者')) tags.push('決勝経験者');
  if (!recent.length && (yrs <= 1 || year === num(def.history && def.history.founded))) tags.push('初出場');
  if (act.college) tags.push('大学お笑い出身');
  if (act.nsc && yrs <= 3) tags.push('NSC出身');
  if (yrs === 0 && !act.kid) tags.push('芸歴1年目');
  if (sim && roundIdx > 0) {
    const rd = sim.rounds[roundIdx];
    if (rd && rd.revival && rd.revival.winners.includes(e.id)) tags.push('敗者復活から');
    if (rd && rd.entrants.length <= 40) { const top = rd.entrants.map((x) => sim.byId.get(x)).filter(Boolean).sort((a, b) => b.power - a.power).slice(0, 3); if (top.includes(e)) tags.push('優勝候補'); }
  }
  return tags.slice(0, 4);
}
function rivalOf(g, id, year, e, roundIdx, sim) {
  const act = e.act;
  const m = e.member != null ? [act.members[e.member]] : act.members;
  return {
    id: e.id, name: e.name, unit: e.type || act.type, kind: kindOf(CONTESTS[id]), power: Math.round(e.power), tags: tagsFor(g, id, year, e, roundIdx, sim),
    agency: e.agency ? agencyLabel(e.agency) : 'アマチュア', agencyId: e.agency || null, members: m.map((x) => ({ name: x.name || act.name, look: x.look, age: year - x.born })),
    formed: act.formed, years: year - act.formed, look: (m[0] && m[0].look) || null, region: act.region,
  };
}
// anonymous entrants of an early round, named on the fly (beginners and amateurs)
function anonRival(g, id, year, roundIdx, k, ap) {
  const r = rngOf(seedOf(g), 'anon', id, year, roundIdx, k);
  const kind = kindOf(CONTESTS[id]);
  const type = kind === 'pin' || kind === 'rakugo' || kind === 'monomane' ? 'pin' : r() < 0.85 ? 'combi' : 'trio';
  const n = type === 'combi' ? 2 : type === 'trio' ? 3 : 1;
  const members = [];
  for (let i = 0; i < n; i++) { const female = r() < 0.2; members.push({ name: personName(r, female), look: lookFor(r, female), age: 18 + Math.floor(r() * 20) }); }
  const name = actName(r, kind === 'rakugo' ? 'rakugo' : type);
  const power = Math.round(clamp(ap.mu + ap.sd * gauss(r), 5, 70));
  const tags = [];
  const k2 = r();
  tags.push(k2 < 0.55 ? 'アマチュア' : k2 < 0.7 ? '初出場' : k2 < 0.82 ? '社会人' : '大学お笑い出身');
  if (r() < 0.3) tags.push('芸歴1年目');
  return { id: `anon-${roundIdx}-${k}`, name, unit: type, kind, power, tags: tags.slice(0, 2), agency: tags[0] === 'アマチュア' || tags[0] === '社会人' ? 'アマチュア' : agencyLabel(agencyFor(r, year, 'tokyo')), members: members.map((x) => ({ name: type === 'pin' ? name : x.name, look: x.look, age: x.age })), formed: year, years: 0, look: members[0].look, anon: true };
}
export function rivalsFor(g, id, roundIdx = 0, n = 10, year) {
  const def = CONTESTS[id];
  if (!def) return [];
  const y = year ?? seasonYearOf(g, id);
  const sim = simOf(g, id, y);
  if (!sim) return [];
  const i = clamp(num(roundIdx, 0), 0, sim.rounds.length - 1);
  const rd = sim.rounds[i];
  const ents = rd.entrants.map((x) => sim.byId.get(x)).filter(Boolean);
  const out = [];
  const r = rngOf(seedOf(g), 'rivals', id, y, i, todayOf(g));
  if (!rd.exact && rd.anonIn > ents.length) {
    // an early round: mostly beginners, some known names
    const named = ents.slice().sort(() => r() - 0.5).slice(0, Math.ceil(n * 0.4));
    for (const e of named) out.push(rivalOf(g, id, y, e, i, sim));
    const ap = anonParams(def);
    for (let k = 0; out.length < n; k++) out.push(anonRival(g, id, y, i, k + Math.floor(r() * 1000), ap));
    return out.sort(() => r() - 0.5);
  }
  for (const e of ents.sort((a, b) => b.power - a.power).slice(0, n)) out.push(rivalOf(g, id, y, e, i, sim));
  return out;
}

// ================================================================ g.* methods
const methods = {
  contests(opts = {}) {
    if (!this.state) return [];
    const day = num(opts.day, todayOf(this));
    const list = Object.keys(CONTESTS).map((id) => safe(`info:${id}`, () => contestInfo(this, id, day), null)).filter(Boolean);
    const order = { open: 0, running: 1, future: 2, closed: 3, notyet: 4 };
    if (opts.sort !== false) list.sort((a, b) => (a.entry ? -1 : 0) - (b.entry ? -1 : 0) || order[a.status] - order[b.status] || (a.nextRound ? a.nextRound.day : 1e9) - (b.nextRound ? b.nextRound.day : 1e9));
    return list;
  },
  contest(id) {
    const def = CONTESTS[id];
    if (!def) return null;
    if (!this.state) return def;
    const info = contestInfo(this, id);
    return Object.assign(Object.create(def), { def, info, year: info.year, status: info.status, edition: info.edition, revival: info.revival, label: info.label, entryInfo: info.entry, cycle: info.cyc });
  },
  contestEdition(id, year) {
    const def = CONTESTS[id];
    if (!def || !this.state) return null;
    const y = year ?? seasonYearOf(this, def);
    const h = heldIn(this, def, y);
    if (!h.held) return null;
    const edition = editionIn(this, def, y);
    return { edition, year: y, revival: !!h.revival, label: labelOf(def, y, edition, h.revival), name: contestName(def, y) };
  },
  contestEntry(id, year) { return this.state ? entryOf(this, id, year) : null; },
  contestEntries(id) { if (!this.state) return []; const c = cstate(this); return Object.entries(c.entries[id] || {}).map(([y, e]) => ({ year: Number(y), ...e })).sort((a, b) => b.year - a.year); },
  async enterContest(id, opts = {}) { return runner.enter(this, id, opts); },
  contestEligibility(id, year) { return eligibilityOf(this, id, year); },
  contestFee(id, year) { return feeOf(this, id, year ?? seasonYearOf(this, id)); },
  contestRegister(id, fields) { const e = registerEntry(this, id, fields); if (e) bump(this, id, e.year); return e; },
  contestRivals(id, round = 0, n = 10, year) {
    if (!this.state) return [];
    const sdef = CONTESTS[id];
    if (sdef && typeof sdef.rivalsOf === 'function') return safe(`rivalsOf:${id}`, () => sdef.rivalsOf(this, round, n, year), []) || [];
    const idx = typeof round === 'string' ? Math.max(0, roundsAt(CONTESTS[id], year ?? seasonYearOf(this, id)).findIndex((r) => r.id === round)) : round;
    return safe(`rivals:${id}`, () => rivalsFor(this, id, idx, n, year), []);
  },
  contestJudges(id, year, n) {
    if (!this.state || !CONTESTS[id]) return [];
    return judgesFor(this, id, year ?? seasonYearOf(this, id), n).map((j) => ({ name: j.name, title: j.title, taste: j.taste, tasteId: j.tasteId, dialect: j.dialect, strict: j.strict, look: j.look, short: j.short }));
  },
  contestHistory(id, opts = {}) {
    if (!this.state || !CONTESTS[id]) return [];
    const def = CONTESTS[id];
    const rows = isSelfRun(def) ? selfHistory(this, def) : historyRows(this, id, lastDoneYear(this, def));
    const mine = cstate(this).entries[id] || {};
    return rows.filter((r) => opts.all || r.held).map((r) => ({ year: r.year, edition: r.edition ?? null, champion: r.champion ?? null, runnerUp: r.runnerUp ?? null, third: r.third ?? null, finalists: r.finalists || [], note: r.note || '', revival: !!r.revival, held: r.held !== false, label: r.held === false ? '' : labelOf(def, r.year, r.edition, r.revival), playerPlace: r.player || null, playerEntry: mine[r.year] ? { status: mine[r.year].status, round: mine[r.year].round, results: mine[r.year].results } : null })).reverse();
  },
  contestNews(text, opts = {}) { return pushNews(this, text, opts); },
  contestVenue(ctx) {
    if (!this.state) return null;
    const c = cstate(this);
    if (ctx === undefined) return c.venue || null;
    c.venue = ctx ? { contest: ctx.contest || null, round: ctx.round ?? null, title: ctx.title || '', color: ctx.color || (ctx.contest && CONTESTS[ctx.contest] ? colorOf(CONTESTS[ctx.contest]) : '#c0392b'), venueName: ctx.venueName || '', stage: ctx.stage || null, sub: ctx.sub || '', year: ctx.year ?? null } : null;
    return c.venue;
  },
  async openContests(tab) { if (CONTEST_UI.open) return CONTEST_UI.open(this, tab); return null; },
  // --- D1 extras (documented in api_contests.txt)
  // the player's rounds today: D1's own (dueOn) + the today items of selfRun contests ({ id, year, selfRun: true, label, item, def })
  contestToday(day) { return this.state ? [...dueOn(this, day ?? todayOf(this)), ...(day == null || day === todayOf(this) ? selfToday(this) : [])] : []; },
  async contestGo(id) { return runner.go(this, id); },
  async contestRunRound(id, opts = {}) { return runner.runToday(this, id, opts); },
  contestRecord(id, roundIdx, res, opts = {}) { return runner.record(this, id, roundIdx, res, opts); },
  contestReward(id, what, opts = {}) { return applyReward(this, id, what, opts); },
  contestResults(id, year) { return this.state ? resultsOf(this, id, year ?? seasonYearOf(this, id)) : null; },
  contestOdds(id, round) { return this.state ? runner.odds(this, id, round) : null; },
  contestCalendar(day) { return this.state ? eventsOn(this, day ?? todayOf(this)) : []; },
  contestSeason(id, day) { return this.state && CONTESTS[id] ? seasonYearOf(this, id, day ?? todayOf(this)) : null; },
  contestCycle(id, year) { return this.state && CONTESTS[id] ? cycleOf(this, id, year ?? seasonYearOf(this, id)) : null; },
  contestState() { return this.state ? cstate(this) : null; },
  // a contest module takes over some of D1's generic news: the keys (see api_contests.txt) are marked as sent, so D1 stays silent
  contestClaimNews(...keys) { if (!this.state) return; const c = cstate(this); for (const k of keys.flat()) if (k) c.sent[k] = Math.max(num(c.sent[k]), todayOf(this) + 100000); },
};
export function installContests(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
}
installContests(Game.prototype);

// contest_ui.js fills this (HD screen, entry form, results boards, scoreboard); contests_run.js falls back to text without it.
export const CONTEST_UI = {};

// internals shared with contests_run.js / contest_ui.js / places/shourace.js
export const internals = {
  realDay, cstate, playerUnit, playerPower, isSelfRun, selfStatus, selfToday, externalEntry, cycleOf, seasonYearOf, contestInfo, dueOn, eventsOn, simOf, entryOf, registerEntry, eligibilityOf, feeOf, prizeOf, applyReward, addHarmony,
  pushNews, rivalsFor, judgesFor, panelScores, scaleOf, toFieldScore, playerScoreDist, PHI, kindOf, KIND_LABEL, roundsOf, roundsAt, scheduleAt, labelOf, contestName, colorOf,
  prestigeOf, isInvitational, dateText, todayOf, playerUnitName, bump, resultsOf, historyRows, lastDoneYear, logOnce, realToInternal, yenLabel,
  OFFICE_FROM, NEWS_FROM, judgeComment, FAIL_NOTES, resultMedium, netVoice, NET_LINES, fillName, TAG_COLORS, hostPerson, rngOf, gauss, pickR, MODEL,
  heldIn, editionIn, startYear, wareki, actPower, STATUS_LABEL, anonParams, contestDate, dayOfDate,
};

// ================================================================ the morning
// Reminders, results, withdrawals, simulated news, champions frozen into the history, invitations, def.onMorning for every
// contest — then the queue goes out (≤ 3 messages + 1 digest), after every other module's morning hook has had its say.
let flushHook = null;
function flushLater(g) {
  if (!flushHook) flushHook = (gg) => { try { flushQueue(gg); } catch (e) { logOnce('flush', e); } finally { inMorning = false; } };
  const i = MORNING_HOOKS.indexOf(flushHook);
  if (i >= 0) MORNING_HOOKS.splice(i, 1);
  MORNING_HOOKS.push(flushHook);
}
async function contestsMorning(g) {
  if (!g.state) return;
  cstate(g);
  inMorning = true;
  flushLater(g);
  try { await runner.morning(g); } catch (e) { logOnce('morning', e); }
  for (const def of Object.values(CONTESTS)) {
    if (typeof def.onMorning !== 'function') continue;
    try {
      const year = seasonYearOf(g, def);
      const h = heldIn(g, def, year);
      await def.onMorning(g, { id: def.id, def, year, edition: h.held ? editionIn(g, def, year) : null, revival: !!h.revival, entry: entryOf(g, def.id, year), round: null, date: contestDate(g) });
    } catch (e) { logOnce(`onMorning:${def.id}`, e); }
  }
}
onMorning(contestsMorning);
export const _test = { CACHE, MODEL, flushQueue, simulateCore, fieldOf, actsFormed, historyRows, realCounts, contestsMorning };
