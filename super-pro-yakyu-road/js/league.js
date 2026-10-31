// スーパープロ野球ロード — the pennant: a new season (12 clubs, rosters, lineups, rotations), the schedule (each league plays
// itself, 3 games a day per league), a day of games (the player's game played or simulated), standings, leaders, save/load.
// Integration point for the merge with the life game later: `SPR_HOOKS` (money, date) — empty for now.
import { makeRng } from './core.js';
import { TEAMS, LEAGUES, makeRoster, overall, resetSeq, nextSeq, FIELD_POS, BALANCE } from './data.js';
import { simGame, seasonStats } from './game.js';

export const SAVE_KEY = 'spr_save_v1';
export const SPR_HOOKS = { onDay: null, onGame: null }; // (for the merge: the life game can listen to days and games)
export const DAY_HOOKS = { before: [], after: [] }; // 球団運営 (front.js) runs its daily business here
export const GAME_OPTIONS = [30, 60, 143];

export function newLeague({ seed = Date.now() % 1e9, myTeam = 'baystars', games = 60, year = 2026, balance = 'normal' } = {}) {
  const rng = makeRng(seed);
  resetSeq(1);
  const L = { v: 1, seed, year, myTeam, games, balance: BALANCE[balance] ? balance : 'normal', day: 0, P: {}, teams: {}, sched: [], results: [], news: [], over: false };
  for (const t of TEAMS) {
    const tier = Math.round((rng() - 0.5) * 4);
    const roster = makeRoster(rng, tier);
    for (const p of roster) { L.P[p.id] = p; seasonStats(p); }
    L.teams[t.id] = { id: t.id, league: t.league, tier, roster: roster.map((p) => p.id), lineup: [], rotation: [], pen: [], closer: null, rot: 0, w: 0, l: 0, d: 0, rs: 0, ra: 0, streak: 0, last: [] };
    autoOrder(L, t.id);
  }
  L.sched = makeSchedule(games, rng);
  L.seq = nextSeq();
  L.rng = rng.state();
  return L;
}
// the computer manager's lineup, rotation and bullpen (also the player's default)
export function autoOrder(L, teamId) {
  const T = L.teams[teamId];
  // the injured and the suspended sit out (if a club runs short, they play anyway)
  const all = T.roster.map((id) => L.P[id]);
  const ok = all.filter((p) => !(p.inj > 0) && !(p.susp > 0));
  const ps = ok.filter((p) => !p.pitcher).length >= 9 && ok.filter((p) => p.pitcher).length >= 8 ? ok : all;
  const bats = ps.filter((p) => !p.pitcher), pits = ps.filter((p) => p.pitcher);
  const taken = new Set(), pos = {};
  for (const fp of FIELD_POS) {
    const c = bats.filter((p) => !taken.has(p.id) && p.pos === fp).sort((a, b) => overall(b) - overall(a))[0] || bats.filter((p) => !taken.has(p.id)).sort((a, b) => b.field - a.field)[0];
    if (c) { taken.add(c.id); pos[c.id] = fp; }
  }
  const dh = bats.filter((p) => !taken.has(p.id)).sort((a, b) => b.meet + b.power - (a.meet + a.power))[0];
  if (dh) { taken.add(dh.id); pos[dh.id] = 'DH'; }
  const nine = [...taken].map((id) => L.P[id]);
  // the batting order: 4th the power, 3rd the best bat, 1st the fastest good hitter, 2nd contact, 5th power, then the rest
  const order = new Array(9).fill(null), left = nine.slice();
  const take = (fn) => { left.sort(fn); return left.shift(); };
  order[3] = take((a, b) => b.power - a.power);
  order[2] = take((a, b) => b.meet + b.power - (a.meet + a.power));
  order[0] = take((a, b) => b.speed + b.meet * 0.6 - (a.speed + a.meet * 0.6));
  order[1] = take((a, b) => b.meet - a.meet);
  order[4] = take((a, b) => b.power - a.power);
  for (let i = 5; i < 9; i++) order[i] = take((a, b) => b.meet + b.power - (a.meet + a.power));
  T.lineup = order.filter(Boolean).map((p) => p.id);
  T.pos = {}; for (const id of T.lineup) T.pos[id] = pos[id] || L.P[id].pos;
  const sp = pits.filter((p) => p.role === 'sp').sort((a, b) => overall(b) - overall(a));
  T.rotation = sp.slice(0, 5).map((p) => p.id);
  const cl = pits.filter((p) => p.role === 'cl').sort((a, b) => overall(b) - overall(a))[0];
  T.closer = cl ? cl.id : null;
  T.pen = pits.filter((p) => !T.rotation.includes(p.id)).sort((a, b) => overall(b) - overall(a)).map((p) => p.id);
}
// each league's 6 clubs play a round robin (circle method), 3 games a day per league, home/away alternating
export function makeSchedule(games, rng) {
  const byL = { C: TEAMS.filter((t) => t.league === 'C').map((t) => t.id), P: TEAMS.filter((t) => t.league === 'P').map((t) => t.id) };
  const rounds = (ids) => {
    const arr = ids.slice(), out = [];
    for (let r = 0; r < arr.length - 1; r++) {
      const day = [];
      for (let i = 0; i < arr.length / 2; i++) day.push([arr[i], arr[arr.length - 1 - i]]);
      out.push(day);
      arr.splice(1, 0, arr.pop());
    }
    return out;
  };
  const RD = rounds(byL.C), RS = rounds(byL.P);
  const days = [];
  for (let d = 0; d < games; d++) {
    const flip = Math.floor(d / 5) % 2 === 1;
    const day = [];
    for (const R of [RD, RS]) for (const [a, b] of R[d % 5]) day.push(flip ? { h: b, a } : { h: a, a: b });
    days.push(day);
  }
  void rng;
  return days;
}
export const myGameToday = (L) => (L.sched[L.day] || []).find((g) => g.h === L.myTeam || g.a === L.myTeam) || null;
// play out today's other games (and the player's own when `simMine`), then move to the next day
export function advanceDay(L, myResult = null, simMine = true) {
  if (L.over) return [];
  const rng = makeRng(L.rng || 1); rng.set(L.rng || 1);
  const out = [];
  for (const f of DAY_HOOKS.before) { try { f(L); } catch (e) { console.error(e); } }
  const struck = L.front && L.front.strikeToday; // a players' strike: no games today
  for (const g of struck ? [] : L.sched[L.day] || []) {
    const mine = g.h === L.myTeam || g.a === L.myTeam;
    if (mine && myResult) { out.push({ h: g.h, a: g.a, hs: myResult.score.home, as: myResult.score.away, mine: true, dec: myResult.dec }); continue; }
    if (mine && !simMine) continue;
    const GS = simGame(L, g.h, g.a, rng);
    out.push({ h: g.h, a: g.a, hs: GS.score.home, as: GS.score.away, mine, dec: GS.dec, line: mine ? GS.line : null, log: mine ? GS.log.slice(-12) : null });
  }
  L.results.push(out);
  if (L.results.length > 14) L.results.shift();
  for (const id of Object.keys(L.P)) if (L.P[id].tired > 0) L.P[id].tired--;
  L.day++;
  L.rng = rng.state();
  if (L.day >= L.sched.length) L.over = true;
  for (const f of DAY_HOOKS.after) { try { f(L, out); } catch (e) { console.error(e); } }
  try { if (SPR_HOOKS.onDay) SPR_HOOKS.onDay(L, out); } catch (e) { console.error(e); }
  return out;
}

// ---------------------------------------------------------------- standings and leaders
export function standings(L, lg) {
  const rows = Object.values(L.teams).filter((t) => t.league === lg).map((t) => ({ id: t.id, w: t.w, l: t.l, d: t.d, pct: t.w + t.l ? t.w / (t.w + t.l) : 0, rs: t.rs, ra: t.ra, streak: t.streak, last: t.last }));
  rows.sort((a, b) => b.pct - a.pct || b.w - a.w || (b.rs - b.ra) - (a.rs - a.ra));
  const top = rows[0];
  for (const r of rows) r.gb = top ? ((top.w - r.w) + (r.l - top.l)) / 2 : 0;
  return rows;
}
export const avg = (s) => (s.ab ? s.h / s.ab : 0);
export const era = (s) => (s.outs ? (s.er * 27) / s.outs : 0);
export const ipText = (outs) => `${Math.floor(outs / 3)}${outs % 3 ? `.${outs % 3}` : ''}`;
export const fmt3 = (v) => (v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, ''));
export function leaders(L, key, lg = null, n = 10) {
  const daysPlayed = Math.max(1, L.day);
  const ps = Object.values(L.P).filter((p) => { const t = teamOfPlayer(L, p.id); return t && L.teams[t] && L.teams[t].roster.includes(p.id) && (!lg || L.teams[t].league === lg); });
  const qualB = (p) => p.s.pa >= daysPlayed * 2.7;
  const qualP = (p) => p.s.outs >= daysPlayed * 3;
  const defs = {
    avg: { name: '打率', f: (p) => avg(p.s), ok: qualB, show: (p) => fmt3(avg(p.s)), hi: true },
    hr: { name: '本塁打', f: (p) => p.s.hr, ok: (p) => !p.pitcher, show: (p) => `${p.s.hr}`, hi: true },
    rbi: { name: '打点', f: (p) => p.s.rbi, ok: (p) => !p.pitcher, show: (p) => `${p.s.rbi}`, hi: true },
    era: { name: '防御率', f: (p) => era(p.s), ok: qualP, show: (p) => era(p.s).toFixed(2), hi: false },
    w: { name: '勝利', f: (p) => p.s.w, ok: (p) => p.pitcher, show: (p) => `${p.s.w}`, hi: true },
    so: { name: '奪三振', f: (p) => p.s.pso, ok: (p) => p.pitcher, show: (p) => `${p.s.pso}`, hi: true },
    sv: { name: 'セーブ', f: (p) => p.s.sv, ok: (p) => p.pitcher, show: (p) => `${p.s.sv}`, hi: true },
  };
  const D = defs[key];
  return { name: D.name, rows: ps.filter(D.ok).sort((a, b) => (D.hi ? D.f(b) - D.f(a) : D.f(a) - D.f(b))).slice(0, n).map((p) => ({ p, team: teamOfPlayer(L, p.id), v: D.show(p) })) };
}
export const LEADER_KEYS = ['avg', 'hr', 'rbi', 'era', 'w', 'so', 'sv'];
const owner = new Map();
export function teamOfPlayer(L, pid) {
  const k = `${L.seed}:${pid}`;
  if (owner.has(k)) { const t = L.teams[owner.get(k)]; if (t && (t.roster.includes(pid) || (t.farm2 || []).includes(pid) || (t.farm3 || []).includes(pid))) return owner.get(k); }
  for (const t of Object.values(L.teams)) if (t.roster.includes(pid) || (t.farm2 || []).includes(pid) || (t.farm3 || []).includes(pid)) { owner.set(k, t.id); return t.id; }
  return null;
}

// ---------------------------------------------------------------- save / load (localStorage; a memory copy when blocked)
let memSave = null;
export function saveLeague(L) {
  const s = JSON.stringify(L);
  try { localStorage.setItem(SAVE_KEY, s); return true; } catch (e) { memSave = s; return false; }
}
export function loadLeague() {
  let s = null;
  try { s = localStorage.getItem(SAVE_KEY); } catch (e) { s = memSave; }
  if (!s) s = memSave;
  if (!s) return null;
  try { const L = JSON.parse(s); if (!L || L.v !== 1 || !L.teams || !L.P) return null; resetSeq(L.seq || 1000); return L; } catch (e) { return null; }
}
export const hasSave = () => { try { return !!localStorage.getItem(SAVE_KEY) || !!memSave; } catch (e) { return !!memSave; } };
export { LEAGUES };
