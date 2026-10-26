// キングオブコント — state, calendar, this world's field and history, scoring models (owner: E2).
// State: g.state.koc (one top-level key, created lazily; old saves get it on first use).
//   { v, seed, years: { [year]: Y }, hist: { [year]: H }, seen: { key: true }, stats, events: [Ev], netaUsed: { netaId: [years] },
//     newsLog: [{ day, text }] (≤ 40), morning: { day, n } }
//   Y = { y, entry: E | null, news: { key: day }, sf: [names], finalists: [F], revival: {...}|null, final: {...}|null, done }
//   E = { no, unitId, unitName, kana, type, members: [{ id, name, look }], instant, fee, feePaid, day, start, r1: venue,
//         status: 'entered'|'passed'|'out'|'champion'|'withdrawn', round (next round id), results: [{ round, score, rank,
//         passed, place, of, day, comment, reasons }], netas: { [round]: [netaId…] }, log: [{ day, round, text }] }
//   H = { y, ed, mode, entries, approx, finalists: [[name, type, total, rank, agency]], champ, runner, third, champScore, me }

import { contestDate } from './contests.js';
import { PEOPLE } from './life.js';
import * as L from './koc_link.js';
import {
  FOUNDED, rules, edition, entriesOf, POOL_NAMES, unitType, membersOf, memberNames, lookFor, AGENCY_NAMES,
  rngOf, hashStr, fillerName, ROUND_NAME, catchcopyFor, KOC_NAME, judgesOf, kocRounds, realLike, TASTES,
} from './koc_data.js';
import * as JC from './judges_ai_con.js'; // [R11-J] 審査員AI (pure)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error('[koc]', e); return d; } };
export function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ---------------------------------------------------------------- calendar
// { year, month, dom (1..10), abs } of a game day. The politics core's gameDate gives dom as a real day (1, 4, … 28)
// and doy; the 10-day game month is what the schedule uses.
export function kDate(g, day) {
  const st = g && g.state;
  const dd = day ?? (st && st.day) ?? 1;
  let year, month, dom;
  try {
    const d = has(g, 'gameDate') ? g.gameDate(dd) : null;
    if (d && Number.isFinite(d.year)) {
      year = d.year; month = d.month;
      dom = Number.isFinite(d.doy) ? (d.doy % 10) + 1 : d.dom > 10 ? Math.floor((d.dom - 1) / 3) + 1 : d.dom;
    }
  } catch (e) { /* fall back */ }
  if (!Number.isFinite(year)) {
    const c = contestDate(g, dd);
    year = c.year; month = c.month; dom = c.dom > 10 ? Math.floor((c.dom - 1) / 3) + 1 : c.dom;
  }
  dom = clamp(Math.round(dom || 1), 1, 10);
  return { year, month, dom, abs: year * 120 + (month - 1) * 10 + (dom - 1), day: dd };
}
export const absOf = (y, w) => y * 120 + (w[0] - 1) * 10 + (w[1] - 1);
// The game day number of a date in a year (may be in the past or future).
export function dayOf(g, y, w) { const t = kDate(g); return g.state.day + (absOf(y, w) - t.abs); }
// KOC dates are [month, dom 1..10] (the game's 10-day months); every text shows the calendar day as g.gameDate / D1's
// realDay do (dom k → (k − 1) × 3 + 1: 1, 4, 7 … 28), so a round has the same date on every screen: [7, 3] → 「2026年7月7日」
export const realDom = (k) => (clamp(Math.round(Number(k) || 1), 1, 10) - 1) * 3 + 1;
export const mdText = (w) => `${w[0]}月${realDom(w[1])}日`;
export function dateText(y, w) { return `${y}年${mdText(w)}`; }
export const isToday = (g, y, w) => { const t = kDate(g); return t.year === y && t.month === w[0] && t.dom === w[1]; };

// ---------------------------------------------------------------- state
export function K(g) {
  const st = g.state;
  if (!st.koc || typeof st.koc !== 'object') st.koc = {};
  const k = st.koc;
  if (!k.v) k.v = 1;
  if (!Number.isFinite(k.seed)) k.seed = Math.floor(Math.random() * 2 ** 31);
  for (const key of ['years', 'hist', 'seen', 'netaUsed']) if (!k[key] || typeof k[key] !== 'object' || Array.isArray(k[key])) k[key] = {};
  if (!k.stats || typeof k.stats !== 'object') k.stats = {};
  for (const key of ['entered', 'finals', 'wins', 'semis']) k.stats[key] = num(k.stats[key]);
  if (!Array.isArray(k.events)) k.events = [];
  if (!Array.isArray(k.newsLog)) k.newsLog = [];
  if (!k.morning || typeof k.morning !== 'object') k.morning = { day: 0, n: 0 };
  return k;
}
export function yearRec(g, y) {
  const k = K(g);
  let Y = k.years[y];
  if (!Y || typeof Y !== 'object') Y = k.years[y] = { y, entry: null, news: {}, sf: null, finalists: null, revival: null, final: null, done: false };
  if (!Y.news || typeof Y.news !== 'object') Y.news = {};
  // keep only the last few seasons in detail (compact() keeps the player's own runs in short form)
  for (const old of Object.keys(k.years).map(Number)) if (old <= y - KEEP_YEARS && !(k.years[old] && k.years[old].entry)) delete k.years[old];
  return Y;
}
// Save growth: full detail only for the last KEEP_YEARS seasons and the player's own runs. Older seasons of this world keep
// { y, ed, champ, runner, third, entries, champScore, me }; an old entry of the player keeps its record (results, log, members)
// but not the scripts it carried; finished after-events and old 鮮度 marks go. Runs once a day from the morning.
export const KEEP_YEARS = 3;
export function compact(g, y) {
  const k = K(g);
  if (k.compacted === g.state.day) return;
  k.compacted = g.state.day;
  for (const [yy, h] of Object.entries(k.hist)) {
    if (!h || +yy > y - KEEP_YEARS || h.lite || h.mine) continue;
    k.hist[yy] = { y: h.y, ed: h.ed, mode: h.mode, entries: h.entries, approx: h.approx, champ: h.champ, runner: h.runner || null, third: h.third || null, champScore: h.champScore ?? null, me: h.me || null, lite: 1 };
  }
  for (const [yy, Y] of Object.entries(k.years)) {
    if (!Y || +yy > y - KEEP_YEARS || Y.lite) continue;
    if (!Y.entry) { delete k.years[yy]; continue; }
    const E = Y.entry;
    for (const f of ['netas', 'finalPerfs', 'plannedNeta', 'finalNeta1', 'finalFirst', 'harm', 'power0', 'props', 'r1', 'sfDone', 'sfPick', 'doneDay', 'picked', 'd1']) delete E[f];
    k.years[yy] = { y: Y.y, entry: E, news: {}, final: Y.final ? { done: true, champ: Y.final.champ, me: Y.final.me } : null, done: true, lite: 1 };
  }
  if (Array.isArray(k.events)) k.events = k.events.filter((e) => !(e && e.done && num(e.y) <= y - KEEP_YEARS));
  for (const id of Object.keys(k.netaUsed)) {
    const a = k.netaUsed[id];
    const b = Array.isArray(a) ? a.filter((yy) => yy > y - KEEP_YEARS) : [];
    if (b.length) k.netaUsed[id] = b; else delete k.netaUsed[id];
  }
}
export const entryOf = (g, y) => { const k = K(g); const Y = k.years[y]; return (Y && Y.entry) || null; };
export function logRun(g, E, round, text) {
  if (!E) return;
  if (!Array.isArray(E.log)) E.log = [];
  E.log.push({ day: g.state.day, round, text });
  if (E.log.length > 40) E.log.splice(0, E.log.length - 40);
}

// ---------------------------------------------------------------- the player's act (A's g.unit, feature-detected)
export function playerUnit(g) {
  const st = g.state;
  let u = null;
  if (has(g, 'unit')) u = safe(() => g.unit(), null);
  if (!u) u = { id: 'solo', type: 'pin', name: st.name, members: [{ id: 'player', name: st.name, short: st.name, role: 'pin', look: st.look }], harmony: 50, amateur: !st.agency, agency: st.agency || null, source: 'solo' };
  if (!Array.isArray(u.members)) u.members = [];
  return u;
}
export const unitSize = (u) => Math.max(1, (u && u.members && u.members.length) || (u && u.type === 'trio' ? 3 : u && u.type === 'combi' ? 2 : 1));
export function memberLook(g, m) {
  if (!m) return null;
  if (m.id === 'player') return g.state.look || {};
  if (m.look) return m.look;
  const P = m.id && PEOPLE[m.id];
  if (P && P.look) return P.look;
  return lookFor(m.name || 'x');
}
export function powerOf(g, kind = 'conte') {
  if (has(g, 'unitPower')) { const v = safe(() => g.unitPower(kind), null); if (Number.isFinite(v)) return clamp(v, 0, 100); }
  return clamp(Math.round(num(g.state.skills && g.state.skills.warai) * 0.5), 0, 100);
}
export function qualityOf(g, neta) {
  if (neta && has(g, 'netaQuality')) { const v = safe(() => g.netaQuality(neta), null); if (Number.isFinite(v)) return clamp(v, 0, 100); }
  if (neta && neta.ai && Number.isFinite(neta.ai.total)) return clamp(neta.ai.total, 0, 100);
  return 40;
}
export function harmonyOf(g, u) { return clamp(num(u && u.harmony, 50), 0, 100); }

// ---------------------------------------------------------------- simulation of a performance (rivals, おまかせ, odds)
// Uses C's g.performSim when present (so rivals are on the same scale as the player's g.perform), else a local model.
export function simScore(g, { power, quality, r, pressure = 50 }) {
  const rng = r || Math.random;
  if (has(g, 'performSim')) {
    const res = safe(() => g.performSim({ kind: 'conte', power, quality, rng, skip: true, venue: { pressure } }), null);
    if (res && Number.isFinite(res.score)) return clamp(res.score, 0, 100);
  }
  return clamp(Math.round(power * 0.55 + quality * 0.4 + gauss(rng) * 7 + 3), 0, 100);
}

// ---------------------------------------------------------------- this world's acts
// A deterministic pool from the save's seed: every act's formation year and peak strength.
let poolCache = null;
export function pool(g) {
  const k = K(g);
  if (poolCache && poolCache.seed === k.seed) return poolCache.list;
  const r = rngOf(k.seed ^ 0x51ed);
  const names = POOL_NAMES.filter((n) => !realLike(n)); // D1's isRealNameLike grows: checked when the pool is built
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const list = names.map((name, i) => {
    const type = unitType(name);
    const formed = 1990 + Math.floor(r() * 44) + (i % 3 === 0 ? 4 : 0); // 1990..2037
    const peak = Math.round(60 + r() * 34);
    const rise = 6 + Math.floor(r() * 8);
    const agency = AGENCY_NAMES[Math.floor(r() * (AGENCY_NAMES.length - 1))];
    return { name, type, formed, peak, rise, agency };
  });
  poolCache = { seed: k.seed, list };
  return list;
}
export function actPower(a, y) {
  const yrs = y - a.formed;
  if (yrs < 0) return null;
  const grow = Math.min(1, (yrs + 1) / a.rise);
  let p = 28 + (a.peak - 28) * Math.pow(grow, 0.85);
  if (yrs > 20) p -= (yrs - 20) * 1.6;
  return clamp(Math.round(p), 5, 99);
}
const champsBefore = (g, y) => { const k = K(g); const s = new Set(); for (const [yy, h] of Object.entries(k.hist)) if (+yy < y && h && h.champ) s.add(h.champ); return s; };
function prevFinals(g, name, y) { const k = K(g); let n = 0; for (const [yy, h] of Object.entries(k.hist)) if (+yy < y && h && Array.isArray(h.finalists) && h.finalists.some((f) => f[0] === name)) n++; return n; }

// The year's season among this world's acts (deterministic): the semifinal 35 and the finalists (+ the revival pool).
export function season(g, y) {
  const R = rules(y);
  const k = K(g);
  const r = rngOf((k.seed ^ Math.imul(y, 7919)) >>> 0);
  const champs = champsBefore(g, y);
  const acts = pool(g).filter((a) => { const p = actPower(a, y); return p != null && y - a.formed <= 26 && !champs.has(a.name); });
  const scored = acts.map((a) => ({ ...a, power: actPower(a, y), sfs: actPower(a, y) + gauss(r) * 6 })).sort((a, b) => b.sfs - a.sfs);
  const sf = scored.slice(0, R.sfCount);
  while (sf.length < R.sfCount) { const name = fillerName(r); sf.push({ name, type: r() < 0.2 ? 'trio' : 'combi', formed: y - 1 - Math.floor(r() * 10), peak: 60, rise: 6, agency: AGENCY_NAMES[Math.floor(r() * AGENCY_NAMES.length)], power: 55 + Math.round(r() * 12), sfs: 50, filler: true }); }
  for (const a of sf) a.sfDay = a.power + gauss(r) * 5; // the semifinal itself
  sf.sort((a, b) => b.sfDay - a.sfDay);
  const finalists = sf.slice(0, R.finalists);
  const losers = sf.slice(R.finalists);
  const revivalPool = R.revival ? losers.slice(0, 10) : [];
  return { y, R, sf, finalists, losers, revivalPool, revivalWinner: null, rank: new Map(), r };
}
export function unitInfo(g, a, y) {
  const yrs = Math.max(1, y - (a.formed || y));
  return { y, name: a.name, type: a.type || 'combi', agency: a.agency || 'フリー', yrs, prevFinals: prevFinals(g, a.name, y), firstFinal: prevFinals(g, a.name, y) === 0, power: a.power, members: memberNames(a.name, membersOf(a.type || 'combi')) };
}
export function copyFor(g, a, y) { return catchcopyFor(unitInfo(g, a, y), rngOf(hashStr(`cc:${a.name}:${y}`))); }

// ---------------------------------------------------------------- scoring models (by era)
// perf (0..100) → a judge's points. taste bias from the performance parts (C's Result.parts) when known.
export function judgePoints(R, perf, j, parts, r) {
  if (R.mode === 'panel') {
    let bias = 0;
    if (parts && j && j.taste) {
      const key = { kousei: 'neta', hassou: 'neta', engi: 'execution', warai: 'crowd', sekai: 'presence', ma: 'timing' }[j.taste];
      if (key && Number.isFinite(parts[key])) bias = clamp((parts[key] - perf) * 0.06, -1.5, 1.5); // a judge's taste: ±1.5 at most
    }
    // [R11-J] 審査員AI: the judge's taste has drifted since their debut, and for the player's own performance they remember (parts known = the player)
    if (j && j.y) bias += JC.tableMod('koc', j, { parts, perf, me: !!parts });
    return clamp(Math.round(66 + perf * 0.31 + bias + gauss(r) * 2.2), 60, 99);
  }
  return 0;
}
// 100 (or 101) anonymous voters: total points.
export function crowdPoints(R, perf, r) {
  let tot = 0;
  if (R.mode === 'sum2') { const avg = 2 + perf * 0.075; for (let i = 0; i < R.voters; i++) tot += clamp(Math.round(avg + gauss(r) * 1.3), 1, 10); }
  else if (R.mode === 'league') { const avg = 1 + perf * 0.038; for (let i = 0; i < R.voters; i++) tot += clamp(Math.round(avg + gauss(r) * 0.8), 1, 5); }
  return tot;
}
// A 1対1 vote (2014): votes for A out of `voters`.
export function duelVotes(R, perfA, perfB, r) {
  const p = 1 / (1 + Math.exp(-(perfA - perfB) / 5));
  let v = 0;
  for (let i = 0; i < R.voters; i++) if (r() < p) v++;
  return v;
}
// The 8 finalists' oral vote (2008 最終決戦): votes for A (8 voters).
export function finalistVote(perfA, perfB, r, voters = 8) {
  const p = 1 / (1 + Math.exp(-(perfA - perfB) / 4));
  let v = 0;
  for (let i = 0; i < voters; i++) if (r() < p) v++;
  return v;
}
export function totalOf(R, scores) { return scores.reduce((a, b) => a + b, 0); }

// A whole final among this world's acts (no player): results ranked (by era).
export function simFinal(g, y, acts, r) {
  const R = rules(y);
  const judges = R.mode === 'panel' ? judgesFor(g, y) : [];
  const perf = (a) => simScore(g, { power: a.power, quality: clamp(a.power + gauss(r) * 6, 0, 100), r, pressure: 90 });
  const rows = acts.map((a) => ({ a, p1: perf(a) }));
  if (R.mode === 'panel') {
    for (const x of rows) { x.s1 = judges.reduce((t, j) => t + judgePoints(R, x.p1, j, null, r), 0); }
    rows.sort((a, b) => b.s1 - a.s1);
    const top = rows.slice(0, R.finalStage);
    for (const x of top) { x.p2 = perf(x.a); x.s2 = judges.reduce((t, j) => t + judgePoints(R, x.p2, j, null, r), 0); x.total = x.s1 + x.s2; }
    top.sort((a, b) => b.total - a.total);
    const rest = rows.slice(R.finalStage).map((x) => ({ ...x, total: x.s1 }));
    return [...top, ...rest];
  }
  if (R.mode === 'sum2') {
    for (const x of rows) { x.s1 = crowdPoints(R, x.p1, r); x.p2 = perf(x.a); x.s2 = crowdPoints(R, x.p2, r); x.total = x.s1 + x.s2; }
    return rows.sort((a, b) => b.total - a.total);
  }
  if (R.mode === 'league') {
    for (const x of rows) { x.s1 = crowdPoints(R, x.p1, r); x.total = x.s1; }
    const A = rows.filter((_, i) => i % 2 === 0).sort((a, b) => b.s1 - a.s1);
    const B = rows.filter((_, i) => i % 2 === 1).sort((a, b) => b.s1 - a.s1);
    const a = A[0], b = B[0];
    a.p2 = perf(a.a); b.p2 = perf(b.a);
    let va = finalistVote(a.p2, b.p2, r);
    if (va === 4) va += r() < 0.5 ? 1 : -1; // 同点 → 決選投票 (this game: a coin of the semifinalists)
    const win = va > 4 ? a : b, lose = win === a ? b : a;
    win.votes = Math.max(va, 8 - va); lose.votes = 8 - win.votes;
    return [win, lose, ...rows.filter((x) => x !== a && x !== b).sort((x, z) => z.s1 - x.s1)];
  }
  // duel (2014): pairs 1-2, 3-4 … then king of the hill
  const winners = [];
  for (let i = 0; i < rows.length; i += 2) {
    const A = rows[i], B = rows[i + 1];
    if (!B) { winners.push(A); continue; }
    const v = duelVotes(R, A.p1, B.p1, r);
    A.s1 = v; B.s1 = R.voters - v;
    winners.push(v > B.s1 ? A : B);
  }
  let king = null;
  for (const x of winners) { x.p2 = perf(x.a); if (!king) { king = x; continue; } const v = duelVotes(R, x.p2, king.p2, r); x.s2 = v; if (v > R.voters - v) king = x; }
  const order = [king, ...winners.filter((x) => x !== king), ...rows.filter((x) => !winners.includes(x))];
  return order;
}

// ---------------------------------------------------------------- judges (fictional), resolved against the history
export function judgesFor(g, y) {
  JC.bind(g.state); // [R11-J]
  return judgesOf(y, (cy) => {
    const h = K(g).hist[cy];
    if (!h || !h.champ) return null;
    return { unit: h.champ, member: memberNames(h.champ, membersOf(unitType(h.champ)))[0] };
  }).map((j) => ({ ...j, y, part: TASTES[j.taste] && TASTES[j.taste].part })); // [R11-J] the year and the part the judge weighs, for the judge agents
}

// ---------------------------------------------------------------- history (this world's champions, real edition years)
// Fills K(g).hist for every year from 2008 up to (not including) `upto`, in order (champions retire from the field).
export function ensureHistory(g, upto) {
  const k = K(g);
  // KOC runs its own world (def.selfRun): D1 asks this history (historyList), never the other way round
  for (let y = FOUNDED; y < upto; y++) {
    if (k.hist[y] && k.hist[y].champ) continue;
    k.hist[y] = histFromSeason(g, y, null);
  }
}
export function histFromSeason(g, y, finalRows, me = null) {
  const R = rules(y);
  const S = season(g, y);
  let rows = finalRows;
  if (!rows) {
    const acts = S.finalists.slice();
    if (R.revival && S.revivalPool.length) acts.push(S.revivalPool[0]);
    rows = simFinal(g, y, acts, S.r);
  }
  const fin = rows.map((x, i) => [x.a ? x.a.name : x.name, x.a ? x.a.type : x.type || 'combi', Math.round(num(x.total, num(x.s1))), i + 1, x.a ? x.a.agency : x.agency || '']);
  const ent = entriesOf(y);
  return { y, ed: edition(y), mode: R.mode, entries: ent.n, approx: ent.approx, finalists: fin, champ: fin[0] && fin[0][0], runner: fin[1] && fin[1][0], third: fin[2] && fin[2][0], champScore: fin[0] && fin[0][2], me };
}
export function historyList(g) {
  const k = K(g);
  // D1's row shape (def.historyList): player = the player's place in that final (1 = won)
  return Object.values(k.hist).filter((h) => h && h.champ).sort((a, b) => a.y - b.y).map((h) => ({ year: h.y, edition: h.ed, held: true, champion: h.champ, runnerUp: h.runner || null, third: h.third || null, finalists: (h.finalists || []).map((f) => f[0]), note: h.me ? h.me.text || '' : '', revival: false, player: h.me && h.me.place ? h.me.place : null, score: h.champScore, entries: h.entries }));
}

// ---------------------------------------------------------------- the 予選 field of a block (player's rounds)
// Round strength (power of the acts in that round; this game's model).
const ROUND_DIST = { r1: [31, 15], r2: [50, 10], qf: [62, 8], sf: [72, 6] };
export function blockField(g, y, rid, key, size) {
  const k = K(g);
  const r = rngOf((k.seed ^ hashStr(`${y}:${rid}:${key}`)) >>> 0);
  const [mu, sd] = ROUND_DIST[rid] || [40, 12];
  const S = rid === 'sf' || rid === 'qf' ? season(g, y) : null;
  const out = [];
  if (rid === 'sf' && S) {
    for (const a of S.sf) out.push({ id: a.id, name: a.name, type: a.type, agency: a.agency, power: a.power, quality: clamp(a.power + gauss(r) * 5, 0, 100), tags: a.tags && a.tags.length ? a.tags : tagsOf(g, a, y), act: a, looks: a.looks });
    return out.slice(0, size);
  }
  // named acts in this round: this world's pool (the season's semifinal list)
  const named = S ? S.sf.slice(rid === 'qf' ? 0 : 20).filter(() => r() < (rid === 'qf' ? 0.25 : 0.06)) : [];
  for (const a of named.slice(0, Math.floor(size / 4))) out.push({ name: a.name, type: a.type, agency: a.agency, power: a.power, quality: clamp(a.power + gauss(r) * 5, 0, 100), tags: tagsOf(g, a, y), act: a });
  const names = new Set(out.map((x) => x.name));
  while (out.length < size) {
    let name = fillerName(r);
    if (names.has(name)) name += ['A', 'B', '2号', 'ズ'][Math.floor(r() * 4)];
    if (names.has(name)) continue;
    names.add(name);
    const power = clamp(Math.round(mu + gauss(r) * sd), 3, 92);
    const tags = [];
    if (rid === 'r1') { const t = r(); if (t < 0.32) tags.push('アマチュア'); else if (t < 0.4) tags.push('即席ユニット'); else if (t < 0.5) tags.push('学生'); if (r() < 0.3) tags.push('初出場'); }
    out.push({ name, type: r() < 0.16 ? 'trio' : 'combi', agency: tags.includes('アマチュア') || tags.includes('学生') ? 'アマチュア' : AGENCY_NAMES[Math.floor(r() * 5)], power, quality: clamp(power + gauss(r) * 8, 0, 100), tags });
  }
  return out;
}
// rivals for D1's screens (def.rivalsOf → g.contestRivals): this world's acts still in at that round, strongest first
export function rivalsOf(g, round, n = 10, year) {
  const y = year ?? kDate(g).year;
  if (y < FOUNDED) return [];
  const list = kocRounds(y);
  const rid = typeof round === 'number' ? (list[round] || {}).id : round;
  const S = season(g, y);
  const src = rid === 'final' ? S.finalists.concat(S.revivalPool.slice(0, 1)) : S.sf;
  return src.slice().sort((a, b) => num(b.power) - num(a.power)).slice(0, n).map((a) => {
    const ms = memberNames(a.name, membersOf(a.type || 'combi'));
    return { id: a.id || `koc-${a.name}`, name: a.name, unit: a.type === 'trio' ? 'trio' : a.type === 'quartet' ? 'group' : 'combi', kind: 'conte', power: Math.round(num(a.power, 60)), tags: tagsOf(g, a, y).slice(0, 3), agency: a.agency || '', formed: a.formed, members: ms.map((nm) => ({ name: nm, look: lookFor(nm) })), look: lookFor(ms[0] || a.name) };
  });
}
function tagsOf(g, a, y) {
  const t = [];
  const pf = prevFinals(g, a.name, y);
  if (pf) t.push(`決勝${pf}回`);
  const h = K(g).hist[y - 1];
  if (h && h.finalists && h.finalists.some((f) => f[0] === a.name)) t.push('前年ファイナリスト');
  if (y - a.formed <= 2) t.push(`結成${Math.max(1, y - a.formed)}年目`);
  if (y - a.formed >= 15) t.push('ベテラン');
  if (a.type === 'trio') t.push('トリオ');
  return t;
}
// A block's entry numbers (4 digits, stable).
export const entryNo = (y, name) => 1 + (hashStr(`no:${y}:${name}`) % Math.max(100, entriesOf(y).n));

// The chance (0..1) that a player with (power, quality) beats the cut of a field where `pass` acts go through.
export function passOdds(g, field, pass, power, quality, extra = 0, samples = 40) {
  if (!field.length) return 1;
  const r = rngOf(hashStr(`odds:${power}:${quality}:${field.length}`));
  let ok = 0;
  for (let s = 0; s < samples; s++) {
    const scores = field.map((f) => simScore(g, { power: f.power, quality: f.quality, r })).sort((a, b) => b - a);
    const cut = scores[Math.max(0, Math.min(scores.length - 1, pass - 1))];
    const me = simScore(g, { power, quality, r }) + extra;
    if (me > cut) ok++;
  }
  return ok / samples;
}

// ---------------------------------------------------------------- news (through D1's g.contestNews, rate-limited there)
export function news(g, text, opts = {}) {
  if (!text) return;
  const k = K(g);
  k.newsLog.unshift({ day: g.state.day, text });
  if (k.newsLog.length > 40) k.newsLog.length = 40;
  if (opts.silent) return;
  // at most 3 KOC messages a morning; the rest wait in the KOC app's ニュース (and one digest line)
  if (L.linked(g)) { safe(() => g.contestNews(text, { contest: 'koc', cat: opts.cat || 'koc', prio: opts.prio ?? 70, ...(opts.key ? { key: opts.key } : {}) })); return; }
  // without D1: at most 3 KOC messages a morning (the rest stay in the KOC app's ニュース, one digest line)
  const m = k.morning;
  if (m.day !== g.state.day) { m.day = g.state.day; m.n = 0; m.held = 0; }
  if (opts.morning && m.n >= 3) { m.held = (m.held || 0) + 1; return; }
  if (opts.morning) m.n++;
  if (has(g, 'contestNews')) safe(() => g.contestNews(text, { contest: 'koc', cat: opts.cat || 'koc' }));
  else g.message({ from: 'お笑いニュース', text, kind: 'news' });
}
// a personal notice (エントリー受付・リマインド・棄権): D1's 賞レース事務局 queue when loaded, else a message
export function notice(g, text, from = 'キングオブコント事務局', prio = 92, key = null) {
  if (L.linked(g)) { safe(() => g.contestNews(text, { contest: 'koc', personal: true, from, prio, ...(key ? { key } : {}) })); return; }
  g.message({ from, text, kind: 'news', contest: 'koc' });
}
export const roundName = (rid) => ROUND_NAME[rid] || rid;
export { KOC_NAME };
