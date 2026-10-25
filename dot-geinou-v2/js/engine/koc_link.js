// キングオブコント ⇄ D1's 賞レースの土台 (owner: E2). When D1's framework is loaded (g.contestRegister / g.contestRecord /
// g.contestCycle / g.contestState), the KOC season uses D1's world: its acts (the same people who enter M-1 and the rest),
// its simulation of every round, its history, its reminders, its 「賞レース」 hub. This file keeps the player's KOC entry
// (st.koc) and D1's entry (st.contests.entries.koc) in step:
//   ・the entry is registered in D1 (no, unit, fee, the 1回戦 pick, the seed round);
//   ・every round is recorded in D1 (g.contestRecord, rewards off: KOC gives its own), the next round's pick follows KOC's plan;
//   ・the final's ranking follows D1's simulation for the acts of this world (so the history and D1's news agree), and the
//     player's broadcast is written into D1's history;
//   ・D1's generic news with a fixed key that KOC tells better (the real entry count, the secret finalists of 2018-2019,
//     the champion of a final the player was in) is claimed first (D1 never sends a key twice).
// Without D1 every function returns null / does nothing and KOC runs on its own world (koc_core.js).

import * as D1 from './contests.js';
import { kocRounds, roundIndex, rules, schedule, hallText } from './koc_data.js';

const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { const v = fn(); return v === undefined ? d : v; } catch (e) { console.error('[koc link]', e); return d; } };
const I = () => (D1.internals && typeof D1.internals === 'object' ? D1.internals : null);

export function linked(g) {
  return !!(g && g.state && D1.CONTESTS && D1.CONTESTS.koc && has(g, 'contestRegister') && has(g, 'contestRecord') && has(g, 'contestCycle') && has(g, 'contestState'));
}
export function d1Entry(g, y) { return linked(g) ? safe(() => g.contestEntry('koc', y), null) : null; }
export function d1Sim(g, y) { const i = I(); return linked(g) && i && typeof i.simOf === 'function' ? safe(() => i.simOf(g, 'koc', y), null) : null; }
export function fieldScore(g, s) { const i = I(); return i && typeof i.toFieldScore === 'function' ? safe(() => i.toFieldScore(g, s), s) : s; }
// D1's option index of a KOC venue/date in a round
export function optionIndex(g, y, idx, venue) {
  if (!venue || !venue.when) return 0;
  const cyc = safe(() => g.contestCycle('koc', y), null);
  const rr = cyc && cyc.rounds && cyc.rounds[idx];
  if (!rr) return 0;
  const want = hallText(venue);
  const hit = rr.options.find((o) => o.date && o.date.month === venue.when[0] && o.date.dom === venue.when[1] && o.venue === want)
    || rr.options.find((o) => o.date && o.date.month === venue.when[0] && o.date.dom === venue.when[1]);
  return hit ? hit.k : 0;
}
// The KOC venue a D1 pick stands for (the player may change the date in D1's hub: 日程・会場を変える)
export function venueOfPick(g, y, idx, list) {
  const e = d1Entry(g, y);
  const cyc = safe(() => g.contestCycle('koc', y), null);
  if (!e || !cyc || !cyc.rounds[idx]) return null;
  const k = Number(e.picks && e.picks[idx]) || 0;
  const o = cyc.rounds[idx].options[k];
  if (!o || !o.date) return null;
  return list.find((v) => v.when[0] === o.date.month && v.when[1] === o.date.dom && hallText(v) === o.venue) || list.find((v) => v.when[0] === o.date.month && v.when[1] === o.date.dom) || null;
}
export function register(g, y, E) {
  if (!linked(g)) return null;
  const startIdx = roundIndex(y, E.start);
  const picks = { 0: E.r1 ? optionIndex(g, y, 0, E.r1) : 0 };
  const e = safe(() => g.contestRegister('koc', { year: y, no: E.no, unitName: E.unitName, kana: E.kana || '', members: (E.members || []).length || 2, fee: E.fee, title: E.plannedTitle || '', picks, rep: g.state.name }), null);
  if (e) {
    if (startIdx > 0) { e.round = startIdx; e.status = 'passed'; e.seed = E.start; }
    E.d1 = true;
  }
  return e;
}
// After a round the player passed: D1's pick of the next round = the KOC plan (東京 / 大阪 by the 1回戦's city)
export function pickNext(g, y, idx, venue) {
  const e = d1Entry(g, y);
  if (!e || !venue) return;
  if (!e.picks) e.picks = {};
  e.picks[idx] = optionIndex(g, y, idx, venue);
}
// res: { passed, score (perform scale), place, of, rank, champion, total, revival }
export function record(g, y, idx, res) {
  if (!linked(g) || idx < 0) return null;
  const fs = Number.isFinite(res.score) ? Math.round(fieldScore(g, res.score) * 10) / 10 : undefined;
  return safe(() => g.contestRecord('koc', idx, { ...res, fs }, { year: y, reward: false }), null);
}
export function noRevival(g, y) { const e = d1Entry(g, y); if (e) e.revivalOk = null; }
export function withdrawnInD1(g, y) { const e = d1Entry(g, y); return !!(e && e.status === 'withdrawn'); }
export function markWithdrawn(g, y) { const e = d1Entry(g, y); if (e && e.status !== 'champion') e.status = 'withdrawn'; }
// D1 claims: a news key D1 sends once; KOC sends the better line itself
export function claim(g, key) {
  if (!linked(g)) return;
  const c = safe(() => g.contestState(), null);
  if (c && c.sent && typeof c.sent === 'object' && !c.sent[key]) c.sent[key] = g.state.day;
}

// ---------------------------------------------------------------- D1's world for a KOC season
// { sf: [act], finalists: [act], losers: [act], revivalPool: [act], revivalWinner: act|null, rank: Map(id → place) }
// act: { id, name, type, agency, power, formed, looks, members }
export function season(g, y) {
  const sim = d1Sim(g, y);
  if (!sim || !Array.isArray(sim.rounds) || !sim.rounds.length) return null;
  const R = rules(y);
  const list = kocRounds(y);
  const sfIdx = list.findIndex((r) => r.id === 'sf' || r.id === 'sf2');
  const fIdx = list.length - 1;
  const sfR = sim.rounds[sfIdx], fR = sim.rounds[fIdx];
  if (!sfR || !fR) return null;
  const info = new Map();
  for (const idx of [sfIdx, fIdx]) for (const x of safe(() => g.contestRivals('koc', idx, 80, y), []) || []) if (x && x.id && !info.has(x.id)) info.set(x.id, x);
  const act = (id) => {
    const e = sim.byId && sim.byId.get(id);
    if (!e) return null;
    const x = info.get(id) || {};
    const members = (x.members && x.members.length ? x.members : (e.act && e.act.members) || []).map((m) => ({ name: m.name || e.name, look: m.look || null }));
    return { id, name: e.name, type: e.type || 'combi', agency: x.agency || (e.agency ? 'プロ' : 'アマチュア'), power: Math.round(Number(e.power) || 50), formed: e.act ? e.act.formed : y - 5, looks: members.map((m) => m.look).filter(Boolean).slice(0, 4), members, tags: x.tags || [] };
  };
  const sfSorted = (sfR.sorted || sfR.entrants || []).map(act).filter(Boolean);
  const revWin = fR.revival && Array.isArray(fR.revival.winners) ? fR.revival.winners : [];
  const finalists = (fR.entrants || []).filter((id) => !revWin.includes(id)).map(act).filter(Boolean).slice(0, R.finalists);
  const fset = new Set(finalists.map((a) => a.id));
  const losers = sfSorted.filter((a) => !fset.has(a.id));
  const revivalPool = fR.revival && Array.isArray(fR.revival.pool) ? fR.revival.pool.map(act).filter(Boolean).slice(0, 10) : R.revival ? losers.slice(0, 10) : [];
  const rank = new Map();
  (sim.final && Array.isArray(sim.final.ranking) ? sim.final.ranking : []).forEach((id, i) => rank.set(id, i + 1));
  return { sf: sfSorted.slice(0, R.sfCount), finalists, losers, revivalPool, revivalWinner: revWin.length ? act(revWin[0]) : null, rank };
}
// The world's history (D1): [{ y, ed, champ, runner, third, finalists: [names] }]
export function history(g) {
  if (!linked(g) || !has(g, 'contestHistory')) return null;
  const rows = safe(() => g.contestHistory('koc'), null);
  if (!Array.isArray(rows)) return null;
  return rows.filter((r) => r && r.held !== false && r.champion).map((r) => ({ y: r.year, ed: r.edition, champ: r.champion, runner: r.runnerUp || null, third: r.third || null, finalists: r.finalists || [], player: r.playerPlace || null }));
}
// After a final the player watched or played: the broadcast becomes this world's history in D1 too.
export function writeHistory(g, y, rows, mePlace) {
  if (!linked(g)) return;
  const c = safe(() => g.contestState(), null);
  if (!c || !c.hist) return;
  if (!c.hist.koc) c.hist.koc = {};
  const prev = c.hist.koc[y] || {};
  const nm = (x) => (x ? x.name : null);
  c.hist.koc[y] = { ...prev, edition: rules(y).edition, revival: false, champion: nm(rows[0]), champId: rows[0] && rows[0].me ? 'player' : (rows[0] && rows[0].id) || null, runnerUp: nm(rows[1]), runnerId: rows[1] && rows[1].me ? 'player' : (rows[1] && rows[1].id) || null, third: nm(rows[2]), finalists: rows.slice(0, 12).map(nm), note: '', player: mePlace || null, deep: prev.deep || {} };
}
export const finalDay = (y) => schedule(y).final.when;
