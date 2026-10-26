// 政治家AI (R11-P) — the core: every NPC politician is an AGENT with traits, tastes (ideology + priorities) that drift, goals, memory,
// relationships, feelings and a career. The agents observe the world, learn, DECIDE by utility and ACT through the existing politics APIs.
//
// Installed by politics.js (installAI(X, H) inside the R5-D context, `[R11-P]` region): X = the helper context of politics.js, H = the
// intra-party engine (politics_intra.js). This file never imports politics.js. Acts / evolution live in politics_ai_act.js / politics_ai_evo.js,
// the screens in politics_ai_ui.js, the optional Claude interview in politics_ai_claude.js.
//
// STATE: g.state.politics.ai (S) — { v, seed, day, mo, yr, log[] (the timeline, capped), gone[] (retired / dead, capped), hist[] (yearly party
// positions, capped), meta { sal{area}, pol, med[7] }, strat { party: { coop, hawk, rc, rh } }, base0, sup, seats, stats, msg, ... }.
// Per agent: n.ai on the NPC record itself (so it is pruned with the NPC) — see mk(). Everything is small ints / one-decimal numbers.
// DETERMINISM: no Math.random in the decision core. rr(p, ...keys) hashes the save seed (S.seed) with the keys (day, agent id, topic), so the
// same save + day decides the same way after a reload. (The only Math.random of this layer is the one-time save seed.)
// BUDGET: the morning tick touches a rotating 1/6 of the agents (plus a few monthly / yearly jobs); AI.perf records the measured ms.

import { AX, AXN, RUNG, RUNG_GOAL, MEM, WHY, attWord, moodWord, KIND_STYLE } from './politics_ai_text.js';
import { installActs } from './politics_ai_act.js';
import { installEvo } from './politics_ai_evo.js';
import { REAL } from './politics_real.js'; // [R14-P] 実在の政治家

export const AI_VERSION = 1;
export { AX, AXN, RUNG, RUNG_GOAL, KIND_STYLE };

export function installAI(X, H) {
  const { clamp, num, YEAR_DAYS, POSTS, PARTY_DEFS, POLICIES, POLICY_AREAS } = X;
  const IND = 'ind';
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const today = (g) => (g.state && g.state.day) || 1;
  const AREAS = Object.keys(POLICY_AREAS);
  const r1 = (v) => Math.round(v * 10) / 10;
  const SLICE = 6; // an agent is looked at every 6 game days (a political month = 10 days)
  const sigm = (z) => 1 / (1 + Math.exp(-z));

  // ---------------------------------------------------------------- state
  function S(p) {
    let s = p.ai;
    if (s && s.__ok === true) return s; // already normalised in this session (a non-enumerable mark: never saved)
    if (!obj(s)) s = p.ai = {};
    s.v = 1;
    if (!(s.seed > 0)) s.seed = ((Math.random() * 2147483646) | 0) + 1; // the save seed: the only Math.random of this layer
    for (const k of ['day', 'mo', 'yr', 'born', 'ageDay']) if (!Number.isFinite(s[k])) s[k] = 0;
    for (const k of ['log', 'gone', 'hist']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['meta', 'strat', 'base0', 'sup', 'seats', 'cab', 'cool']) if (!obj(s[k])) s[k] = {};
    if (!Array.isArray(s.jd)) s.jd = [];
    if (!obj(s.stats)) s.stats = {};
    for (const k of ['acts', 'moved', 'retired', 'died', 'heirs', 'scandals', 'gaffes', 'rebels', 'plots', 'wins', 'losses', 'newcomers']) if (!Number.isFinite(s.stats[k])) s.stats[k] = 0;
    if (!obj(s.msg)) s.msg = { day: 0, n: 0, nn: 0 };
    Object.defineProperty(s, '__ok', { value: true, enumerable: false, configurable: true });
    return s;
  }
  const slotOf = (id) => { const k = parseInt(String(id).slice(2), 10); return Number.isFinite(k) ? k : h32(id); };
  const AIH = { perf: { max: 0, sum: 0, n: 0, last: 0 }, S };

  // ---------------------------------------------------------------- seeded randomness (stateless: a hash of the save seed and the keys)
  function h32(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return h >>> 0;
  }
  const rr = (p, ...k) => h32(`${S(p).seed}|${k.join('|')}`) / 4294967296;
  const rg = (p, ...k) => (rr(p, ...k, 'a') + rr(p, ...k, 'b') + rr(p, ...k, 'c') - 1.5) * 2; // ~ N(0, 1)
  // run fn with Math.random replaced by a seeded stream: the core functions an act calls (a succession, a new face for a cabinet post, a by-election) draw from the
  // save seed too, so the whole effect of a decision is reproducible (the swap is synchronous; nothing awaits inside)
  function seeded(p, key, fn) {
    const orig = Math.random;
    Math.random = stream(p, 'mr', key).u;
    try { return fn(); } finally { Math.random = orig; }
  }
  // a seeded stream for the places that need many numbers at once (one hash, then mulberry32): u() ~ U(0,1), gs() ~ N(0,1)
  function stream(p, ...k) {
    let a = h32(`${S(p).seed}|${k.join('|')}`) | 0;
    const u = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { u, gs: () => (u() + u() + u() - 1.5) * 2 };
  }

  // ---------------------------------------------------------------- policy / party vectors
  const FW = [1.2, 0.7, 1.1, 1.0, 0.5, 0.5, 0.4];
  const FWS = FW.reduce((a, b) => a + b, 0);
  const distV = (a100, b1) => { let s = 0; for (let i = 0; i < 7; i++) { const d = num(a100[i]) / 100 - num(b1[i]); s += FW[i] * d * d; } return Math.sqrt(s / FWS); };
  const fitV = (a100, b1) => clamp(1 - distV(a100, b1), 0, 1);
  // a policy's position on the 7 axes (-1..1): ideology.js when loaded, else the policy's own ideo
  function policyVec(id) {
    let o = null;
    try { o = X.policyAxes ? X.policyAxes(id) : null; } catch (e) { o = null; }
    if (!o || !Object.keys(o).length) {
      const v = (POLICIES[id] && POLICIES[id].ideo) || {};
      o = { econ: num(v.econ) / 1.4, social: num(v.social) / 1.6, world: num(v.security) / 2.2 };
    }
    return AX.map((k) => clamp(num(o[k]), -1, 1));
  }
  let AREA_V = null; // area → mean |position| per axis (what an area is "about")
  function areaVec(area) {
    if (!AREA_V) {
      AREA_V = {};
      for (const a of AREAS) {
        const ids = Object.keys(POLICIES).filter((id) => POLICIES[id].area === a);
        const v = AX.map(() => 0);
        for (const id of ids) { const pv = policyVec(id); for (let i = 0; i < 7; i++) v[i] += Math.abs(pv[i]) / Math.max(1, ids.length); }
        AREA_V[a] = v;
      }
    }
    return AREA_V[area] || AX.map(() => 0);
  }
  function partyVec(g, p, pid) {
    const W0 = W_CACHE.get(p);
    if (W0 && W0.day === today(g) && W0.pv[pid]) return W0.pv[pid];
    let v = AX.map(() => 0);
    if (pid && pid !== IND && p.parties[pid]) {
      try { const o = H.partyAxes(g, p, pid); v = AX.map((k) => clamp(num(o[k]), -1, 1)); } catch (e) { /* zeros */ }
    }
    if (W0 && W0.day === today(g)) W0.pv[pid] = v;
    return v;
  }

  // ---------------------------------------------------------------- the world as the agents see it (once per day)
  const W_CACHE = new WeakMap();
  function world(g, p, day) {
    let W = W_CACHE.get(p);
    if (W && W.day === day) return W;
    const fy = X.fyNow(g);
    W = { day, pv: {}, sup: {}, trend: {}, ruling: new Set(p.cabinet.partyIds || []), appr: num(p.cabinet.approval, 45), leadFac: {}, elecIn: 9999, seatsOf: {}, cent: {}, n: {}, pm: p.cabinet.pm };
    W_CACHE.set(p, W);
    for (const [pid, pt] of Object.entries(p.parties)) {
      const s = X.natSupport(p, pid, fy) * 100;
      W.sup[pid] = s;
      // the trend: support now against its own moving average (half a year); a party's last 得票率 is not a baseline at the start of a game
      W.trend[pid] = s - num(S(p).sup[pid], s);
      W.seatsOf[pid] = X.partySeats(p, pid);
      try { W.leadFac[pid] = H.leaderFaction(p, pt); } catch (e) { W.leadFac[pid] = null; }
    }
    W.elecInH = { shugi: 9999, sangi: 9999 };
    for (const e of p.elections.upcoming || []) if ((e.kind === 'shugi' || e.kind === 'sangi') && e.status !== 'done') { W.elecIn = Math.min(W.elecIn, e.day - day); W.elecInH[e.kind] = Math.min(W.elecInH[e.kind], e.day - day); }
    // party centroids of the Diet members among the agents
    const acc = {};
    for (const n of Object.values(p.npcs)) {
      if (!obj(n.ai) || !mpOf(n) || !n.party) continue;
      fix(n.ai);
      const c = acc[n.party] || (acc[n.party] = { v: AX.map(() => 0), w: 0, n: 0 });
      const w = 1 + Math.min(3, (n.posts || []).length) * 0.5;
      for (let i = 0; i < 7; i++) c.v[i] += n.ai.ax[i] * w;
      c.w += w; c.n++;
    }
    for (const [pid, c] of Object.entries(acc)) { W.cent[pid] = c.v.map((x) => x / c.w / 100); W.n[pid] = c.n; }
    return W;
  }
  const mpOf = (n) => !!n && (n.office === 'shugi' || n.office === 'sangi');

  // ---------------------------------------------------------------- the agent record
  // ax/tg: positions on the 7 axes ×100 (one decimal). pr: top-3 policy areas. lr: learning rate. jb: 地盤 (0..100). pf: feeling toward the party's leadership
  // (-100..100). bw: belief of keeping the seat (0..100). str: stress. risk: scandal exposure. hp: health. fund (百万円) / con (人脈 0..100).
  // mem: [[day, code, weight]] (≤ 6), act: [[day, kind, text]] (≤ 5), rel: { npcId: affinity } (≤ 4), cool: { action: day }.
  function priorities(p, a, n, day) {
    const sal = S(p).meta.sal || {};
    const st = stream(p, 'prio', n.id, Math.floor(day / 120));
    const sc = AREAS.map((area) => {
      const av = areaVec(area);
      let s = 0;
      for (let i = 0; i < 7; i++) s += Math.abs(a.ax[i] / 100) * av[i];
      s = s * 1.2 + st.u() * 0.35 + (num(sal[area]) / 100) * 0.35 * (0.4 + (a.lr || 12) / 30);
      return [area, s];
    });
    sc.sort((x, y) => y[1] - x[1]);
    return sc.slice(0, 3).map((x) => AREAS.indexOf(x[0])); // stored as indexes into the policy areas (small saves)
  }
  function mk(g, p, n, opts = {}) {
    const day = today(g);
    const id = n.id;
    const par = opts.parent && opts.parent.ai ? opts.parent.ai : null;
    const base = partyVec(g, p, n.party);
    const sp = p.parties[n.party] ? 0.3 : 0.45;
    const t = n.traits || (n.traits = { charisma: 50, integrity: 60, ambition: 50 });
    const sx = stream(p, 'mk', id);
    const ax = AX.map((k, i) => {
      const own = clamp(base[i] + sx.gs() * sp * (i < 4 ? 1 : 0.7), -0.95, 0.95);
      const v = par ? clamp(par.ax[i] / 100 * 0.5 + base[i] * 0.3 + own * 0.2 + sx.gs() * 0.1, -0.95, 0.95) : own; // a successor inherits, then mutates
      return r1(v * 100);
    });
    const age = num(n.age, 55);
    const lr = Math.round(clamp(22 - (age - 40) * 0.32 + (num(t.ambition, 50) - 50) * 0.08 + (50 - num(t.integrity, 60)) * 0.05 + sx.gs() * 2, 6, 30));
    const a = {
      ax, tg: ax.slice(), pr: [], lr,
      jb: Math.round(clamp((par ? par.jb * 0.6 : 30 + num(n.wins, 1) * 4) + sx.gs() * 8, 5, 95)),
      pf: Math.round(clamp(18 + sx.gs() * 14, -60, 80)), bw: Math.round(clamp(55 + num(n.wins, 1) * 1.5 + sx.gs() * 8, 15, 95)),
      str: Math.round(clamp(24 + sx.gs() * 8, 0, 100)), risk: Math.round(clamp((100 - num(t.integrity, 60)) * 0.5 + 8 + sx.gs() * 6, 2, 95)),
      hp: Math.round(clamp(100 - Math.max(0, age - 45) * 0.8 + sx.gs() * 6, 35, 100)),
      fund: Math.round(Math.max(2, num(n.wins, 1) * 3 + 8 + sx.u() * 25)), con: Math.round(clamp(12 + num(n.wins, 1) * 4 + sx.u() * 20, 5, 95)),
      mem: [], act: [], rel: {}, cool: {}, gen: opts.gen != null ? opts.gen : 0, since: day,
    };
    if (par && opts.parent) { a.rel[opts.parent.id] = 40; a.mentor = opts.parent.id; a.gen = num(par.gen) + 1; }
    a.pr = priorities(p, a, n, day);
    // [R14-P] a real figure: the positions of public record, held steady (never drifting), no scandal exposure
    if (n.real && REAL[n.real]) { const R = REAL[n.real]; a.ax = AX.map((k) => r1(clamp(num(R.ax[k]), -95, 95))); a.tg = a.ax.slice(); a.lr = 6; a.risk = 2; a.hp = 95; a.str = 18; a.pf = 30; a.pr = priorities(p, a, n, day); }
    n.ai = a;
    return a;
  }
  const ag = (g, p, n) => (obj(n.ai) ? fix(n.ai) : mk(g, p, n));
  // fields that older saves / hand-built NPCs might miss
  function fix(a) {
    if (!Array.isArray(a.ax) || a.ax.length !== 7 || a.ax.some((v) => !Number.isFinite(v))) a.ax = AX.map((k, i) => (Array.isArray(a.ax) && Number.isFinite(a.ax[i]) ? a.ax[i] : 0));
    if (!Array.isArray(a.tg) || a.tg.length !== 7 || a.tg.some((v) => !Number.isFinite(v))) a.tg = a.ax.slice();
    for (const k of ['mem', 'act', 'pr']) if (!Array.isArray(a[k])) a[k] = [];
    if (a.pr.some((x) => !Number.isInteger(x) || x < 0 || x >= AREAS.length)) a.pr = [];
    for (const k of ['rel', 'cool']) if (!obj(a[k])) a[k] = {};
    for (const k of ['lr', 'jb', 'pf', 'bw', 'str', 'risk', 'hp', 'fund', 'con', 'gen', 'since']) if (!Number.isFinite(a[k])) a[k] = k === 'lr' ? 12 : k === 'hp' ? 80 : k === 'bw' ? 55 : 20;
    return a;
  }

  // ---------------------------------------------------------------- career
  function posKind(p, n) {
    const out = { pm: p.cabinet.pm === n.id, leader: false, cab: false, party: false, fleader: false, bantou: false };
    const pt = p.parties[n.party];
    if (pt) {
      out.leader = pt.leader === n.id;
      out.party = Object.values(pt.posts || {}).includes(n.id);
      for (const f of pt.factions || []) {
        if (f.leader === n.id) out.fleader = true;
        const x = p.intra && p.intra.fx && p.intra.fx[f.id];
        if (x && x.bantou === n.id) out.bantou = true;
      }
    }
    out.cab = Object.values(p.cabinet.ministers || {}).includes(n.id);
    return out;
  }
  function rungOf(p, n) {
    const k = posKind(p, n);
    return k.pm ? 5 : k.leader ? 4 : k.cab ? 3 : k.party ? 2 : (k.fleader || k.bantou) ? 1 : 0;
  }
  // the rung this politician is aiming at, by ambition (a modest one stops earlier)
  function capOf(n) {
    const am = num(n.traits && n.traits.ambition, 50);
    return am >= 82 ? 5 : am >= 66 ? 4 : am >= 50 ? 3 : am >= 34 ? 2 : 1;
  }
  function goalOf(p, n) {
    const r = rungOf(p, n);
    const cap = capOf(n);
    const age = num(n.age, 55);
    let g2 = Math.min(cap, r + 1);
    if (age >= 74 && r < 4) g2 = r; // too late for a new climb
    return { rung: r, goal: g2, label: g2 > r ? RUNG_GOAL[g2] : r >= 5 ? '政権を全うする' : '今の地位を守る', cap };
  }
  // how ripe the politician is for the next step (0..100)
  function readiness(p, n, a) {
    const t = n.traits || {};
    const sen = Math.min(35, num(n.wins) * 3.6);
    const v = 12 + sen + a.con * 0.22 + num(t.charisma, 50) * 0.2 + Math.min(10, a.fund * 0.05) - a.risk * 0.18 - (num(n.age) > 74 ? 14 : 0) + (a.pf > 20 ? 4 : 0);
    return Math.round(clamp(v, 0, 100));
  }

  // ---------------------------------------------------------------- memory & the player
  function remember(g, p, n, code, w, day, ref) {
    const a = ag(g, p, n);
    const m = MEM[code];
    const wt = w != null ? w : m ? m[1] : 0;
    a.mem.unshift([day != null ? day : today(g), code, Math.round(wt)].concat(ref ? [ref] : []));
    if (a.mem.length > 5) {
      // forget the weakest (after decay), not the oldest only: strong grudges and favours last
      const d0 = today(g);
      let k = 0, best = 1e9;
      a.mem.forEach((e, i) => { const v = Math.abs(e[2]) * Math.pow(0.5, (d0 - e[0]) / 240); if (v < best) { best = v; k = i; } });
      a.mem.splice(k, 1);
    }
  }
  function memSum(a, day) {
    let s = 0;
    for (const e of a.mem) s += e[2] * Math.pow(0.5, Math.max(0, day - e[0]) / 240); // half-life 240 game days (2 years)
    return clamp(s, -45, 45);
  }
  // what the agent thinks of the player (-100..100): the standing relation plus remembered deeds (bounded; never decisive alone)
  function attitude(g, p, n) {
    const a = ag(g, p, n);
    const me = p.me;
    const day = today(g);
    let b = 0;
    const sameParty = me.party && me.party === n.party;
    if (sameParty) b += 8 + (num(me.standing) - 50) * 0.12;
    if (sameParty && me.faction && me.faction === n.faction) b += 10;
    if (me.office) b += 3;
    try {
      const pl = typeof g.ideologyOf === 'function' ? g.ideologyOf('player', 'player') : null;
      if (pl && pl.axes && num(g.ideology && g.ideology().strength, 0) > 0.05) {
        const pv = AX.map((k) => num(pl.axes[k]));
        b += (fitV(a.ax, pv) - 0.7) * 40;
      }
    } catch (e) { /* no ideology */ }
    b += num(me.reputation) * 0.06;
    if (a.cool.rivalP) b -= 6;
    return Math.round(clamp(b + memSum(a, day), -100, 100));
  }
  function topMemory(a, day) {
    let best = null, bv = 0;
    for (const e of a.mem) { const v = Math.abs(e[2]) * Math.pow(0.5, Math.max(0, day - e[0]) / 240); if (v > bv) { bv = v; best = e; } }
    return best && bv >= 1.5 ? { code: best[1], day: best[0], text: (MEM[best[1]] || [best[1]])[0], w: best[2] } : null;
  }

  // ---------------------------------------------------------------- logging (timeline, news and phone budgets)
  const nameOf = (p, id) => (id === 'player' ? '' : (p.npcs[id] && p.npcs[id].name) || '');
  function logAct(g, p, n, kind, text, opts = {}) {
    const day = today(g);
    const a = ag(g, p, n);
    a.act.unshift([day, kind, text]);
    if (a.act.length > 2) a.act.length = 2;
    const s = S(p);
    s.log.unshift([day, n.id, kind, text, n.name, n.party || IND]);
    if (s.log.length > 48) s.log.length = 48;
    s.stats.acts++;
    if (!obj(s.stats.k)) s.stats.k = {};
    s.stats.k[kind] = (s.stats.k[kind] || 0) + 1;
    if (opts.news) newsAI(g, p, `${n.name}氏が${text}`, opts.news === true ? `a:${n.id}` : opts.news);
  }
  // politics news: ≤ 3 lines from this system a morning; one line per key every 20 days
  function newsAI(g, p, text, key) {
    const s = S(p);
    const day = today(g);
    if (s.msg.day !== day) { s.msg.day = day; s.msg.n = 0; s.msg.nn = 0; }
    if (s.msg.nn >= 3) return false;
    const k = `n:${key}`;
    if (s.cool[k] != null && day - s.cool[k] < 20) return false;
    s.cool[k] = day;
    s.msg.nn++;
    X.news(p, g, text);
    return true;
  }
  // phone messages: ≤ 2 a morning from this system in total (pushEvent's party notices count too)
  function phoneAI(g, p, text, from) {
    const s = S(p);
    const day = today(g);
    if (s.msg.day !== day) { s.msg.day = day; s.msg.n = 0; s.msg.nn = 0; }
    if (s.msg.n >= 2) return false;
    s.msg.n++;
    X.phoneNews(g, text, from);
    return true;
  }
  function budgetLeft(g, p) { const s = S(p); if (s.msg.day !== today(g)) return 2; return 2 - s.msg.n; }
  // spend one phone message of the budget on something this system did not send itself (an event notice)
  function spendPhone(g, p) { const s = S(p); const day = today(g); if (s.msg.day !== day) { s.msg.day = day; s.msg.n = 0; s.msg.nn = 0; } s.msg.n++; }

  // ---------------------------------------------------------------- shared context for the acts / evolution parts
  const C = {
    X, H, S, AIH, rr, rg, h32, sigm, r1, obj, today, AREAS, IND, SLICE, AX, RUNG, WHY, MEM, mpOf, ag, mk, fix, fitV, distV, partyVec, policyVec, areaVec, world, priorities,
    posKind, rungOf, capOf, goalOf, readiness, remember, memSum, attitude, topMemory, logAct, newsAI, phoneAI, budgetLeft, spendPhone, nameOf, W_CACHE, stream, slotOf, seeded,
  };

  // ---------------------------------------------------------------- the step of one agent (every SLICE days)
  function updateFeelings(g, p, n, a, W, day, sn) {
    const pt = p.parties[n.party];
    const pv = partyVec(g, p, n.party);
    const fitP = pt ? fitV(a.ax, pv) : 0.6;
    const ruling = W.ruling.has(n.party);
    const trend = W.trend[n.party] || 0;
    const hasPost = (n.posts || []).length > 0;
    let facMood = 0, inLead = false;
    if (n.faction && p.intra && p.intra.fx && p.intra.fx[n.faction]) { facMood = num(p.intra.fx[n.faction].mood); inLead = W.leadFac[n.party] === n.faction; }
    const tp = (fitP - 0.75) * 110 + trend * 2 + (ruling ? (W.appr - 42) * 0.32 : -(W.appr - 42) * 0.1) + (hasPost ? 14 : 0) + (inLead ? 9 : -3) + facMood * 0.15 - a.str * 0.08;
    a.pf = Math.round(clamp(a.pf + (tp - a.pf) * 0.15 + sn.gs() * 1.2, -100, 100));
    const lastRes = a.mem.find((e) => e[1] === 'won' || e[1] === 'lost');
    const tb = 56 + Math.min(20, num(n.wins) * 2.2) + (a.jb - 50) * 0.2 + trend * 2.6 + (ruling ? (W.appr - 45) * 0.22 : (45 - W.appr) * 0.12) + (lastRes ? (lastRes[1] === 'won' ? 5 : -12) : 0);
    a.bw = Math.round(clamp(a.bw + (tb - a.bw) * 0.1, 4, 98));
    const k = posKind(p, n);
    const plotInv = p.intra && p.intra.plot && (p.intra.plot.boss === n.id) ? 22 : 0;
    const ts = 24 + (k.pm ? 22 : k.leader ? 14 : k.cab ? 10 : k.party ? 6 : 0) + plotInv + Math.max(0, 40 - a.bw) * 0.55 + (ruling ? Math.max(0, 42 - W.appr) * 0.45 : 0) + Math.max(0, a.risk - 40) * 0.25;
    a.str = Math.round(clamp(a.str + (ts - a.str) * 0.08 + sn.gs() * 0.8, 0, 100));
    const t = n.traits || {};
    const tr = (100 - num(t.integrity, 60)) * 0.5 + num(t.ambition, 50) * 0.12 + a.str * 0.14 + (a.fund < 8 ? 7 : 0) + (a.fund > 160 ? 5 : 0) + (k.pm || k.cab ? 4 : 0);
    a.risk = Math.round(clamp(a.risk + (tr - a.risk) * 0.05, 1, 98));
    // money and connections: posts bring both; a seat needs upkeep
    const income = 0.32 + (k.pm ? 1.4 : k.leader ? 1.2 : k.cab ? 0.8 : k.party ? 0.9 : 0) + (k.fleader ? 0.7 : 0) + a.con * 0.004;
    a.fund = Math.round(clamp(a.fund + income - 0.38 - a.fund * 0.0015, 1, 400));
    a.con = Math.round(clamp(a.con + (hasPost ? 0.25 : 0.04) + (k.fleader ? 0.15 : 0) - 0.03, 3, 99));
  }
  // positions drift (slowly, in months): toward what the agent believes wins (tg), toward the party line (conformity), a little at random
  function driftAxes(g, p, n, a, W, day, sn) {
    const pv = partyVec(g, p, n.party);
    const integ = num(n.traits && n.traits.integrity, 60);
    const hasPost = (n.posts || []).length > 0;
    const conf = clamp((1 - integ / 160) * 0.005 * (hasPost ? 1.6 : 1) * (a.pf >= 0 ? 1 : 0.4), 0, 0.01);
    const LRc = a.lr / 100;
    for (let i = 0; i < 7; i++) {
      let v = a.ax[i];
      v += (a.tg[i] - v) * LRc * 0.045;
      if (n.party && n.party !== IND) v += (pv[i] * 100 - v) * conf;
      v += sn.gs() * 0.12;
      a.ax[i] = r1(clamp(v, -95, 95));
    }
  }

  // The agents' own stance on a policy (-1..1): positions × the policy's, priorities, the party platform
  function policyStance(g, p, n, a, policyId) {
    const pl = POLICIES[policyId];
    if (!pl) return 0;
    const pv = policyVec(policyId);
    let s = 0;
    for (let i = 0; i < 7; i++) s += (a.ax[i] / 100) * pv[i];
    s *= 1.5;
    const pt = p.parties[n.party];
    if (pt && (pt.platform || []).includes(policyId)) s += 0.45;
    if (a.pr.includes(AREAS.indexOf(pl.area))) s += 0.18 * Math.sign(s || 1);
    return clamp(s, -1.2, 1.2);
  }
  C.policyStance = policyStance;

  const ACT = installActs(C);
  const EVO = installEvo(C);
  Object.assign(C, ACT, EVO);

  function step(g, p, n, day, W) {
    const a = fix(ag(g, p, n));
    const mp = mpOf(n);
    const sn = stream(p, 'step', n.id, day);
    updateFeelings(g, p, n, a, W, day, sn);
    driftAxes(g, p, n, a, W, day, sn);
    ACT.yearlyAgent(g, p, n, a, W, day); // the agent's own year (health, priorities, retirement) — staggered over the days, so no morning spikes
    if (mp || (n.posts && n.posts.length)) ACT.decide(g, p, n, a, W, day);
  }

  // ---------------------------------------------------------------- the morning tick
  function tick(g, p, day, abs) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const s = S(p);
    if (s.day === day) return;
    seeded(p, `tick|${day}`, () => tickInner(g, p, day, abs, s, t0));
  }
  function tickInner(g, p, day, abs, s, t0) {
    const gap = s.day ? Math.min(40, day - s.day) : SLICE;
    s.day = day;
    const W = world(g, p, day);
    const ids = Object.keys(p.npcs);
    let made = 0;
    for (const id of ids) {
      const n = p.npcs[id];
      if (n.ai !== undefined && !obj(n.ai)) delete n.ai; // a damaged record is rebuilt
      if (!n.ai) {
        // a fresh NPC gets a record (at most 24 a morning: an old save is filled over a few days); decisions wait for its slice
        if (made < 24) { mk(g, p, n); made++; }
        continue;
      }
      if ((slotOf(id) + day) % SLICE !== 0) { fix(n.ai); continue; }
      try { step(g, p, n, day, W); } catch (e) { console.error('ai step', id, e); }
    }
    void gap;
    try { ACT.dailyEvents(g, p, day, W); } catch (e) { console.error('ai events', e); }
    try { EVO.tick(g, p, day, abs, W); } catch (e) { console.error('ai evo', e); }
    try { ACT.aboutPlayer(g, p, day, W); } catch (e) { console.error('ai player', e); }
    if (t0) {
      const ms = performance.now() - t0;
      const q = AIH.perf;
      q.last = ms; q.max = Math.max(q.max, ms); q.sum += ms; q.n++;
      (q.recent || (q.recent = [])).push(ms); if (q.recent.length > 400) q.recent.shift();
    }
  }

  // ---------------------------------------------------------------- views (profiles for the UI, tests and Claude mode)
  const dayName = (g, d) => X.dateLabel(g, d).replace(/^\d+年/, '');
  function rolesOf(g, p, n) {
    const out = [];
    const fy = X.fyNow(g);
    const pt = p.parties[n.party];
    if (p.cabinet.pm === n.id) out.push('内閣総理大臣');
    for (const [post, who] of Object.entries(p.cabinet.ministers || {})) if (who === n.id) out.push(X.postName(post, fy));
    if (pt) {
      if (pt.leader === n.id) out.push(pt.leaderTitle || '党首');
      for (const [post, who] of Object.entries(pt.posts || {})) if (who === n.id) out.push(X.postName(post, fy, pt.id));
      for (const f of pt.factions || []) {
        if (f.leader === n.id) out.push(`${f.name}の領袖`);
        const x = p.intra && p.intra.fx && p.intra.fx[f.id];
        if (x && x.bantou === n.id) out.push(`${f.name}の番頭`);
      }
    }
    if (n.office === 'chiji') out.push('都知事'); else if (n.office === 'shicho') out.push('区長');
    return out;
  }
  function relationsOf(g, p, n, a) {
    const rows = [];
    for (const [id, v] of Object.entries(a.rel || {})) { const m = p.npcs[id]; if (m) rows.push({ id, name: m.name, v, label: v >= 30 ? '師弟・盟友' : v >= 10 ? '親しい' : v <= -30 ? '宿敵' : v <= -10 ? '対立' : '知り合い' }); }
    // the implicit ones: same faction's boss, and the nearest rival for the same rung
    const pt = p.parties[n.party];
    if (pt) {
      const f = (pt.factions || []).find((x) => x.id === n.faction);
      if (f && f.leader !== n.id && p.npcs[f.leader] && !rows.some((r) => r.id === f.leader)) rows.push({ id: f.leader, name: p.npcs[f.leader].name, v: 20, label: '派の領袖' });
      const rv = ACT.rivalOf ? ACT.rivalOf(g, p, n, a) : null;
      if (rv && !rows.some((r) => r.id === rv.id)) rows.push({ id: rv.id, name: rv.name, v: -18, label: 'ライバル' });
    }
    return rows.slice(0, 5);
  }
  function profile(g, p, id) {
    const n = p.npcs[id];
    if (!n) return null;
    const a = fix(ag(g, p, n));
    const day = today(g);
    const pt = p.parties[n.party];
    const gl = goalOf(p, n);
    const att = attitude(g, p, n);
    const aw = attWord(att);
    const pv = partyVec(g, p, n.party);
    const fq = n.faction ? H.findFaction(p, n.faction) : null;
    const mem = topMemory(a, day);
    const ready = readiness(p, n, a);
    const posn = [];
    for (const [i, k] of AX.entries()) {
      const v = a.ax[i] / 100;
      posn.push({ k, name: AXN[k][0], v, left: AXN[k][1], right: AXN[k][2], party: pv[i], word: Math.abs(v) < 0.12 ? '中間' : v < 0 ? AXN[k][1] : AXN[k][2], strong: Math.abs(v) >= 0.5 });
    }
    // 5-8 issues: the 7 axes, in the agent's own order of conviction
    const open = p.diet.bills.filter((b) => b.policy && !['enacted', 'rejected', 'shelved'].includes(b.stage)).slice(0, 3).map((b) => {
      const st = policyStance(g, p, n, a, b.policy);
      return { id: b.id, title: b.title, stance: st >= 0.12 ? '賛成' : st <= -0.12 ? '反対' : '態度未定', v: st };
    });
    const mood = Math.round(clamp(a.pf * 0.6 - a.str * 0.4 + (a.bw - 50) * 0.3, -100, 100));
    const tags = [];
    const rp = playerRelation(g, p, n, a, att);
    if (rp.mentor) tags.push({ text: 'あなたの後ろ盾', color: '#2a7a4a' });
    if (rp.rival) tags.push({ text: 'あなたのライバル', color: '#8a2a34' });
    if (a.cool.court && day - a.cool.court < 30) tags.push({ text: 'あなたを誘っている', color: '#8a6a1a' });
    return {
      id, rp: n.real || null, name: n.name, age: n.age, gender: n.gender, look: n.look, party: n.party || IND, partyName: pt ? pt.name : '無所属', partyShort: pt ? pt.short : '無所属', color: pt ? pt.color : '#8a90a6', real: !!(pt && pt.real),
      office: n.office, house: n.house, wins: num(n.wins), faction: fq ? fq.f.name : '', factionId: fq ? fq.f.id : null, roles: rolesOf(g, p, n), district: n.district || '',
      rung: gl.rung, rungName: RUNG[gl.rung], goalRung: gl.goal, goal: gl.label, cap: gl.cap, ready, positions: posn, party7: pv, priorities: a.pr.map((x) => (POLICY_AREAS[AREAS[x]] || {}).name || String(x)),
      attitude: att, attWord: aw.text, attColor: aw.color, memory: mem, memories: a.mem.filter((e) => Math.abs(e[2]) >= 1).map((e) => ({ day: e[0], text: (MEM[e[1]] || [e[1]])[0], w: e[2] })),
      acts: a.act.map((e) => ({ day: e[0], kind: e[1], text: e[2], date: dayName(g, e[0]) })), relations: relationsOf(g, p, n, a), mood, moodWord: moodWord(mood),
      pf: a.pf, bw: a.bw, str: a.str, risk: a.risk, hp: a.hp, fund: a.fund, con: a.con, jb: a.jb, lr: a.lr, gen: a.gen, mentor: a.mentor || null, heirOf: a.heirOf || null,
      traits: { charisma: num(n.traits && n.traits.charisma), integrity: num(n.traits && n.traits.integrity), ambition: num(n.traits && n.traits.ambition) },
      open, tags, ex: !!n.exMp, mp: mpOf(n), local: n.office === 'chiji' || n.office === 'shicho',
    };
  }
  function playerRelation(g, p, n, a, att) {
    const me = p.me;
    const day = today(g);
    const same = me.party && me.party === n.party;
    const senior = num(n.wins) > num(me.nationalWins) + 1 || num(n.age) >= num(g.state.profile && g.state.profile.age, 30) + 8;
    return {
      mentor: !!(same && att >= 24 && rungOf(p, n) >= 2 && senior && (me.office || me.party)),
      rival: !!(same && att <= -18 && rungOf(p, n) >= 1 && (me.office || me.party)),
    };
  }
  C.playerRelation = playerRelation;
  C.profile = profile;

  // the list for the 名鑑: everyone who matters, sorted (the powerful first)
  function roster(g, p, opts = {}) {
    const out = [];
    const day = today(g);
    for (const n of Object.values(p.npcs)) {
      if (!n.ai) mk(g, p, n);
      if (n.exMp && !opts.ex) continue;
      if (!n.party && !n.office) continue;
      const a = n.ai;
      const gl = goalOf(p, n);
      const pt = p.parties[n.party];
      out.push({ id: n.id, name: n.name, age: n.age, party: n.party || IND, partyShort: pt ? pt.short : '無所属', color: pt ? pt.color : '#8a90a6', rung: gl.rung, rungName: RUNG[gl.rung], wins: num(n.wins), office: n.office, goal: gl.label, att: attitude(g, p, n), mood: Math.round(a.pf * 0.6 - a.str * 0.4 + (a.bw - 50) * 0.3), roles: rolesOf(g, p, n).slice(0, 2), last: a.act[0] ? a.act[0][2] : '', lastDay: a.act[0] ? a.act[0][0] : null, faction: n.faction || null });
    }
    out.sort((x, y) => y.rung - x.rung || y.wins - x.wins || x.name.localeCompare(y.name));
    void day;
    return out;
  }

  // ---------------------------------------------------------------- hook entry points (politics.js calls these through INTRA.ai; all are guarded there)
  AIH.tick = tick;
  AIH.profile = (g, id) => profile(g, X.ensurePol(g), id);
  AIH.roster = (g, opts) => roster(g, X.ensurePol(g), opts);
  AIH.world = world;
  AIH.C = C;
  AIH.mk = mk;
  AIH.rungOf = rungOf;
  AIH.goalOf = goalOf;
  AIH.readiness = readiness;
  AIH.attitude = attitude;
  AIH.remember = remember;
  // records the pruning must keep: mentors, heirs waiting for the seat, the recently defeated (comebacks), the fallen for a month, strong memories of the player
  AIH.refs = (p) => {
    const out = new Set();
    const day = S(p).day;
    for (const n of Object.values(p.npcs || {})) {
      const a = n.ai;
      if (!a) continue;
      if (a.mentor) out.add(a.mentor);
      if (a.heir && mpOf(n)) out.add(a.heir); // a sitting member's chosen successor (links between the others do not keep each other alive)
      if (n.heirOf && !n.office && !n.dead) out.add(n.id);
      if (n.exMp && !n.dead && a.exDay && day - a.exDay < YEAR_DAYS * 0.8 && num(n.traits && n.traits.ambition) >= 50) out.add(n.id); // only the ambitious may stage a comeback
      if (n.dead && a.exDay && day - a.exDay < 12) out.add(n.id);
      if (a.mem && a.mem.some((e) => Math.abs(e[2]) >= 12)) out.add(n.id);
      if (n.runFor) out.add(n.id);
    }
    return out;
  };
  // the spare Diet members beyond a party's bench are dropped by importance (rank, seniority, generation, newcomers) — not by age of the record
  AIH.prune = (p, keep) => {
    const day = S(p).day;
    const by = {};
    for (const [id, n] of Object.entries(p.npcs)) {
      if (keep.has(id)) continue;
      if (mpOf(n)) { (by[n.party || IND] || (by[n.party || IND] = [])).push(n); continue; }
      delete p.npcs[id];
    }
    const imp = (n) => num(n.wins) + 3 * num(n.ai && n.ai.gen) + 5 * (n.ai ? rungOf(p, n) : 0) + (n.ai && day - num(n.ai.since) < YEAR_DAYS ? 8 : 0) + (n.faction ? 2 : 0);
    for (const [pid, arr] of Object.entries(by)) {
      arr.sort((a, b) => imp(b) - imp(a) || (a.id < b.id ? -1 : 1));
      const seats = X.partySeats(p, pid);
      const cap = Math.max(9, Math.round(4 + seats * 0.05));
      for (const n of arr.slice(cap)) delete p.npcs[n.id];
    }
  };
  // ideology.js asks for an NPC's axes: the agent's own, as {axis: -1..1}
  AIH.axesOf = (p, id) => {
    const n = p.npcs && p.npcs[id];
    if (!n || !n.ai || !Array.isArray(n.ai.ax)) return null;
    const o = {};
    AX.forEach((k, i) => { o[k] = clamp(n.ai.ax[i] / 100, -1, 1); });
    return o;
  };
  Object.assign(AIH, ACT.hooks, EVO.hooks);
  // the hooks that act (not only decide) run under the seeded stream
  for (const k of ['onElection', 'onCabinet', 'applyFx', 'afterExec', 'execRunner', 'leaderField', 'onPlayerMove']) {
    const f0 = AIH[k];
    if (typeof f0 !== 'function') continue;
    AIH[k] = (...a) => { const pp = a.find((x) => x && typeof x === 'object' && x.npcs && x.me); return pp ? seeded(pp, `${k}|${S(pp).day}`, () => f0(...a)) : f0(...a); };
  }
  AIH.rr = rr;
  AIH.rg = rg;

  // ---------------------------------------------------------------- g.* methods (merged into the politics methods by politics.js)
  const ep = (g) => X.ensurePol(g);
  AIH.methods = {
    // aiAgents({ party?, ex? }) -> [{ id, name, age, party, partyShort, color, rung, rungName, wins, office, goal, att, mood, roles, last, lastDay, faction }] (the 名鑑 list, powerful first)
    aiAgents(opts = {}) {
      const p = ep(this);
      let rows = roster(this, p, opts);
      if (opts.party) rows = rows.filter((r) => r.party === opts.party);
      return rows;
    },
    // aiAgent(id) -> the full profile (positions, goal, readiness, attitude toward the player, memories, last acts with reasons, relations) | null
    aiAgent(id) { const p = ep(this); return profile(this, p, id); },
    // aiTimeline({ limit?, party?, kinds? }) -> [{ day, date, id, kind, text, name, party, icon, color }] newest first (what the agents decided, with the reason)
    aiTimeline(opts = {}) {
      const p = ep(this);
      const s = S(p);
      let rows = s.log.map((l) => ({ day: l[0], date: dayName(this, l[0]), id: l[1], kind: l[2], text: l[3], name: l[4], party: l[5], icon: (KIND_STYLE[l[2]] || ['・', '#9aa3c8'])[0], color: (KIND_STYLE[l[2]] || ['・', '#9aa3c8'])[1] }));
      if (opts.party) rows = rows.filter((r) => r.party === opts.party);
      if (opts.kinds) rows = rows.filter((r) => opts.kinds.includes(r.kind));
      return rows.slice(0, opts.limit || 60);
    },
    // aiParties() -> per party: { id, name, short, color, seats, n (named agents), centroid[7], platform7[7], strat { coop, hawk }, sd[7], hist [[year, [econ, social, world]]], factions [{ id, name, size, mood, n, axes }] }
    aiParties() {
      const p = ep(this);
      const W = world(this, p, today(this));
      const s = S(p);
      const out = [];
      for (const [pid, pt] of Object.entries(p.parties)) {
        const mem = ACT.named(p, pid);
        const cent = W.cent[pid] || AX.map(() => 0);
        const sd = AX.map((k, i) => (mem.length ? Math.sqrt(mem.reduce((t, n) => t + (n.ai.ax[i] / 100 - cent[i]) ** 2, 0) / mem.length) : 0));
        const st = s.strat[pid];
        out.push({
          id: pid, name: pt.name, short: pt.short, color: pt.color, real: !!pt.real, seats: W.seatsOf[pid] || 0, n: mem.length, centroid: cent, platform7: partyVec(this, p, pid), sd, ruling: W.ruling.has(pid), sup: Math.round((W.sup[pid] || 0) * 10) / 10,
          strat: st ? { coop: Math.round(st.coop), hawk: 100 - Math.round(st.coop) } : null,
          hist: s.hist.map((h) => [h[0], h[1][pid] || null]).filter((x) => x[1]),
          factions: (pt.factions || []).map((f) => { const x = p.intra && p.intra.fx && p.intra.fx[f.id]; const fm = mem.filter((n) => n.faction === f.id); return { id: f.id, name: f.name, size: num(f.size), mood: x ? Math.round(num(x.mood)) : 0, n: fm.length, leader: f.leader, leaderName: nameOf(p, f.leader), axes: x && x.axes ? AX.map((k) => num(x.axes[k])) : null, pf: fm.length ? Math.round(fm.reduce((t, n) => t + n.ai.pf, 0) / fm.length) : 0 }; }),
        });
      }
      return out.sort((a, b) => b.seats - a.seats);
    },
    // aiMeta() -> { issues: [{ area, name, sal }] (what moves votes, strongest first), pol, med[7], strat: { party: { coop, hawk } } }
    aiMeta() {
      const p = ep(this);
      const m = S(p).meta;
      const issues = AREAS.map((a) => ({ area: a, name: (POLICY_AREAS[a] || {}).name || a, sal: Math.round(num(m.sal && m.sal[a])) })).sort((x, y) => y.sal - x.sal);
      return { issues, pol: Math.round(num(m.pol)), med: Array.isArray(m.med) ? m.med.slice() : AX.map(() => 0), strat: Object.fromEntries(Object.entries(S(p).strat).map(([k, v]) => [k, { coop: Math.round(v.coop), hawk: 100 - Math.round(v.coop) }])) };
    },
    // aiInterview(id, topic) -> { ok, text, by: 'local', topic, name } ; topics now | you | goal | party | issue  (politics_ai_claude.js g.aiInterviewAsk adds the Claude version)
    aiInterview(id, topic = 'now') { return ACT.interview(this, ep(this), id, topic); },
    // aiReport() -> the evolution report (party centroids, spread, turnover) ; aiPerf() -> { last, max, avg, n } ms of the morning tick
    aiReport() { return EVO.report(this, ep(this)); },
    aiPerf() { const q = AIH.perf; const r = (q.recent || []).slice().sort((a, b) => a - b); return { last: q.last, max: q.max, avg: q.n ? q.sum / q.n : 0, n: q.n, p95: r.length ? r[Math.floor(r.length * 0.95)] : 0, p99: r.length ? r[Math.floor(r.length * 0.99)] : 0 }; },
    // aiPlayerTies() -> { mentor, rival } : who backs / eyes the player in their party
    aiPlayerTies() { const p = ep(this); const s = S(p); const pr = (id) => (id && p.npcs[id] ? profile(this, p, id) : null); return { mentor: pr(s.mentor), rival: pr(s.rival) }; },
    // aiSave() -> bytes of the agent layer in the save
    // aiHandle() -> the agent layer itself (tests, the UI files): AIH.C (the shared helpers), AIH.dbg (an array turns on the decision trace)
    aiHandle() { return AIH; },
    aiBytes() { const p = ep(this); return JSON.stringify(p.ai || {}).length + Object.values(p.npcs).reduce((a, n) => a + (n.ai ? JSON.stringify(n.ai).length : 0), 0); },
  };
  return AIH;
}
