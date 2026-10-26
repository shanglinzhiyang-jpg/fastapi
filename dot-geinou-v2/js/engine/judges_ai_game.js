// 審査員AI — the game layer [R11-J]: the morning tick (the scene, the seats of the script panel, 審査員交代 news, ≤ 2 messages a morning),
// the data the 審査員名鑑 shows (profiles, the 席の相関, the scene), and the g.* methods. The rules are in judges_ai.js (agents, taste
// drift, careers), judges_ai_mem.js (what they remember of the player's scripts), judges_ai_con.js (contest panels); the screen is
// judges_ai_ui.js; the optional Claude mode is judges_ai_claude.js. API doc: test-output/api_judges.txt.
//
//   g.judgeScopes()            → [{ id: 'neta' | 'm1' | 'koc' | 'c:<contestId>', label, year, n }]   the panels the book can show
//   g.judgeBook(scopeId?)      → { scope, year, judges: [profile], corr: [[0..100]], scene: { tops, kinds } } (see profileOf)
//   g.judgeProfile(key)        → profile | null  (any judge of any scope by key)
//   g.openJudgeBook(opts?)     → Promise  the HD 審査員名鑑 ({ scope, key })      g.judgeAsk(key, qid, opts?) → { text, by, notice? }
//   g.judgeLog(n?)             → the 動向 log (seat changes, panel changes, scene shifts)   g.judgeNetaPanel() → the five seats today
//   g.judgeTick()              the morning work (also callable by tests)

import { Game } from './game.js';
import { onMorning } from './life.js';
import { CONTESTS, internals as I, actById } from './contests.js';
import { lookFor, rngOf, personName, isRealNameLike } from './contests_gen.js';
import { JUDGES as BASE_JUDGES, AXES } from './neta_ai.js';
import { KIND_LABEL } from './neta_ui_kit.js';
import * as JA from './judges_ai.js';
import * as JM from './judges_ai_mem.js';
import { askJudge, localAnswer, QUESTIONS } from './judges_ai_claude.js';
import { judgesFor as m1JudgesFor } from './m1_data.js';
import { openJudgeBook } from './judges_ai_ui.js';
import { M as M1State } from './m1_core.js';

const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const safe = (key, fn, d = null) => { try { return fn(); } catch (e) { I.logOnce(`jai:${key}`, e); return d; } };
const has = (g, k) => !!g && typeof g[k] === 'function';
const dateOf = (g) => I.contestDate(g);

// ------------------------------------------------------------------ the morning
const NEWS_MAX = 2; // new phone messages a morning from this system, in all
function ensureJ(g) {
  const st = g.state;
  if (!st) return null;
  const J = JA.initState(st);
  if (J) JA.ensureSeats(J, BASE_JUDGES, dateOf(g).year);
  return J;
}
function logLine(J, day, kind, text) {
  J.log.unshift({ d: day, k: kind, s: text });
  if (J.log.length > 24) J.log.length = 24;
}
function queueNews(J, key, text, opts = {}) {
  if (J.sent[key]) return;
  J.sent[key] = 1;
  (J.nq || (J.nq = [])).push({ key, text, ...opts });
  const ks = Object.keys(J.sent);
  if (ks.length > 60) for (const k of ks.slice(0, ks.length - 60)) delete J.sent[k];
}
const MAJOR = (def) => def && (def.category === 'major' || ['m1', 'koc', 'r1'].includes(def.id));
// the champion of a contest-year as a scene entry: { style (code word), v (the champion's style vector) } or null
function champEntry(g, id, y) {
  const def = CONTESTS[id];
  const J = JA.jstate(g.state);
  const seed = J.seed || 1;
  const kind = I.kindOf(def);
  if (id === 'm1') {
    if (!g.state.m1) return null; // (this system never creates M-1's world: it reads it once the player's game has one)
    const m = M1State(g);
    const h = m && (safe('m1h', () => g.m1History(), []) || []).find((r) => r.y === y);
    if (!h || !h.ch || h.ch === 'me') return null;
    const c = (m.pool || []).find((x) => x.id === String(h.ch).slice(2) || x.id === h.ch);
    return { style: 'manzai', name: String(h.chN || ''), v: JA.actVec(seed, { id: String(h.chN || h.ch), style: (c && c.style) || 'しゃべくり' }) };
  }
  if (I.isSelfRun(def)) { // the contests that run their own world (KOC, R-1, ABC): the kind's plain style + the champion's own individuality
    const hr = (safe('selfh', () => g.contestHistory(id, {}), []) || []).find((r) => r.year === y && r.champion);
    if (!hr || hr.playerPlace === 1) return null;
    const word = ['manzai', 'conte', 'pin', 'rakugo'].includes(kind) ? kind : 'manzai';
    return { style: word, name: String(hr.champion), v: JA.actVec(seed, { id: String(hr.champion), style: word }) };
  }
  const rows = safe('hist', () => I.historyRows(g, id, y), []);
  const row = rows.find((r) => r.year === y && r.held);
  if (!row || !row.champion || row.champId === 'player') return null;
  if (row.champId) {
    const act = actById(g, row.champId);
    if (act) return { style: act.style, name: String(row.champion), v: JA.actVec(seed, act) };
  }
  // the contests that run their own world: the kind's plain style + the champion's own individuality
  const word = ['manzai', 'conte', 'pin', 'rakugo'].includes(kind) ? kind : 'manzai';
  return { style: word, name: String(row.champion), v: JA.actVec(seed, { id: String(row.champion), style: word }) };
}
function nameSet(list) { return new Set(list.map((j) => j.name)); }
function panelChange(g, J, id, y, day) {
  const def = CONTESTS[id];
  if (!def) return;
  const A = safe('jf0', () => I.judgesFor(g, id, y - 1), []);
  const B = safe('jf1', () => I.judgesFor(g, id, y), []);
  if (!A.length || !B.length) return;
  const a = nameSet(A), b = nameSet(B);
  const left = A.filter((j) => !b.has(j.name)), joined = B.filter((j) => !a.has(j.name));
  if (!left.length && !joined.length) return;
  const nm = def.short || def.name;
  const parts = [];
  if (left.length) parts.push(`${left.slice(0, 2).map((j) => j.name).join('、')}が審査員を退任`);
  if (joined.length) parts.push(`新審査員に${joined.slice(0, 2).map((j) => `${j.name}（${String(j.title).replace(/（芸歴.*$/, '')}）`).join('、')}`);
  const alum = joined.find((j) => j.alumni);
  const text = `【${nm} 審査員交代】${parts.join('。')}。`;
  void alum;
  const mine = !!I.entryOf(g, id, y - 1) || !!I.entryOf(g, id, y);
  queueNews(J, `jai|chg|${id}|${y}`, text, { contest: id, personal: mine, prio: mine ? 70 : 45 });
  logLine(J, day, 'panel', text);
}
function yearTurn(g, J, y, day) {
  // the year y is over: its champions shape the scene (processed one contest per morning, in order)
  for (const def of Object.values(CONTESTS)) if (MAJOR(def)) (J.pend || (J.pend = [])).push(['champ', def.id, y]);
}
function seatsTurn(g, J, year, day) {
  const used = new Set();
  const evs = JA.tickSeats(J, BASE_JUDGES, year, {
    day,
    champ: (seatId, gen) => {
      // a former champion takes the seat now and then (every third turnover): the person is invented, the unit is a champion of this world
      // (from the names the morning tick has already read: no history is computed here)
      if (gen % 3 !== 1) return null;
      const cn = (J.cn || []).filter((c) => year - c[0] >= 4 && !used.has(c[2]));
      const c = cn[cn.length - 1];
      if (c) used.add(c[2]);
      return c ? { unit: c[2], year: c[0], contest: (CONTESTS[c[1]] && (CONTESTS[c[1]].short || CONTESTS[c[1]].name)) || '' } : null;
    },
  });
  for (const e of evs) {
    const text = `【審査員交代】${e.from.title}の${e.from.name}が${e.reason}、ネタの審査員を退任。後任は${e.to.name}（${e.to.title}）。${e.to.school}で、${e.from.name}の審査を受け継ぎながら自分の色を足していく。`;
    queueNews(J, `jai|seat|${e.seat}|${year}`, text, { personal: true, prio: 75 });
    logLine(J, day, 'seat', `${e.from.name}が${e.reason}退任し、${e.to.name}が就任（${e.to.school}・師匠は${e.to.mentor}）`);
  }
}
export const STATS = { n: 0, sum: 0, max: 0, slow: [] };
let WHAT = '';
if (typeof window !== 'undefined') window.__judgeStats = STATS;
export function judgeTick(g) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  try { tickBody(g); } finally { if (t0) { const dt = performance.now() - t0; STATS.n++; STATS.sum += dt; STATS.max = Math.max(STATS.max, dt); if (dt > 3 && STATS.slow.length < 12) STATS.slow.push([g.state.day, Math.round(dt), WHAT]); WHAT = ''; } }
}
function tickBody(g) {
  const J = ensureJ(g);
  if (!J) return;
  const d = dateOf(g), day = g.state.day || 1, year = d.year;
  if (J.ty == null) J.ty = year;
  if (year > J.ty) { WHAT = 'yearTurn'; for (let y = J.ty; y < year; y++) yearTurn(g, J, y, day); J.ty = year; }
  if (d.month >= 4 && J.sy !== year) { WHAT = `seats${year}`; J.sy = year; if (year > (J.y0 || year)) seatsTurn(g, J, year, day); }
  // one pending item a morning. A contest's history is only read once it has been computed by whoever needed it first (cheap); an item
  // that is not ready goes to the back of the line (and is forced after two game months)
  let p = null;
  if (J.pend && J.pend.length) {
    for (let k = 0; k < Math.min(6, J.pend.length); k++) {
      const q = J.pend.shift();
      const selfRun = CONTESTS[q[1]] && I.isSelfRun(CONTESTS[q[1]]);
      const ready = selfRun ? q[0] === 'champ' : safe('cached', () => I.historyCached(g, q[1], q[0] === 'champ' ? q[2] : q[2] - 1), false);
      if (ready || num(q[3]) >= 60) { p = q; break; }
      q[3] = num(q[3]) + 1;
      J.pend.push(q);
    }
  }
  if (p) {
    WHAT = `${p[0]}:${p[1]}:${p[2]}`;
    if (p[0] === 'champ') {
      const ce = champEntry(g, p[1], p[2]);
      if (ce && ce.name && ['m1', 'koc', 'r1'].includes(p[1])) { (J.cn || (J.cn = [])).push([p[2], p[1], ce.name]); if (J.cn.length > 12) J.cn.shift(); } // (names of the big three's champions, for the next 元王者 on a panel)
      if (ce && JA.recordChampion(J, p[2], ce.style, ce.v)) logLine(J, day, 'scene', `${p[2]}年の${(CONTESTS[p[1]].short || CONTESTS[p[1]].name)}の王者は${{ manzai: '漫才', both: '漫才とコント', conte: 'コント', pin: '一人芸', rakugo: '落語', flip: 'フリップ芸', mandan: '漫談', utaneta: '歌ネタ', monomane: 'ものまね' }[ce.style] || '新しい型'}の人`);
      if (!J.pend.some((q) => q[0] === 'champ' && q[2] === p[2])) { // all of the year's champions are in: look at the panels
        for (const def of Object.values(CONTESTS)) if (MAJOR(def) && !I.isSelfRun(def)) J.pend.push(['panel', def.id, p[2] + 1]);
      }
    } else if (p[0] === 'panel') panelChange(g, J, p[1], p[2], day);
  }
  // news: at most NEWS_MAX a morning
  let n = 0;
  while (J.nq && J.nq.length && n < NEWS_MAX) {
    const it = J.nq.shift();
    if (has(g, 'contestNews')) g.contestNews(it.text, { contest: it.contest, personal: !!it.personal, prio: it.prio || 50, key: it.key });
    n++;
  }
  if (J.nq && J.nq.length > 12) J.nq.length = 12;
}
onMorning((g) => { try { judgeTick(g); } catch (e) { console.error(e); } });

// ------------------------------------------------------------------ profiles
const mkLook = (J, key, female) => lookFor(rngOf(J.seed, 'look', key), !!female);
function thinksOf(J, key, se, fo, br) {
  if (!se) return 'まだあなたのネタを見たことがない。';
  if (fo >= 0.5) return 'あなたの書くものを、期待して待っている。';
  if (fo >= 0.2) return 'あなたにはいい印象を持っている。';
  if (fo <= -0.4) return 'あなたのネタには見飽きていて、厳しい目で見ている。';
  if (fo <= -0.15) return 'あなたのネタに少し辛口になっている。';
  if (br >= 0.5) return 'あなたの実力を知っていて、もう高い水準を求めている。';
  return `まだ評価は定まっていない（${se}回見た）。`;
}
// one judge, for the book. d: a descriptor (judges_ai.js); o: { year, look, dialect, female, extra }
export function profileOf(g, J, d, year, o = {}) {
  const sty = JA.styleAt(J, d, year);
  const ag = J.ag[d.key] || null;
  const fo = ag ? num(ag.fo) / 100 : 0, br = ag ? num(ag.br) / 100 : 0, se = ag ? num(ag.se) : 0;
  const day = (g.state && g.state.day) || 1;
  const mood = JA.moodOf(J, d.key, day);
  return {
    key: d.key, name: d.name, title: d.title, scope: d.scope, id: d.id || null,
    school: JA.schoolOf(sty), baseSchool: JA.schoolOf(d.b), tasteNow: sty, tasteBase: d.b.slice(), hist: JA.history(J, d, year, 14), drift: JA.driftNote(J, d, year),
    y0: d.y0, years: Math.max(0, year - (Number.isFinite(o.since) ? o.since : d.y0)) + (o.pre || 0), mood, moodWord: JA.moodWord(mood), fo, br, se, fa: ag ? num(ag.fn) : 0,
    cm: ag && ag.cm ? ag.cm.map((c) => c.slice()) : [], fv: ag && ag.fv ? ag.fv.map((f) => f.slice()) : [], tr: d.tr, dimLabels: JA.DIMS.map((k) => JA.DIM_JP[k]),
    thinks: thinksOf(J, d.key, se, fo, br), goal: JA.goalOf(d, ag, year), look: o.look || mkLook(J, d.key, o.female), dialect: o.dialect || 'std', year, ...(o.extra || {}),
  };
}
const agreeTaste = (a, b) => { let l1 = 0; for (let i = 0; i < a.length; i++) l1 += Math.abs(a[i] - b[i]); return Math.round(clamp100(100 - l1 * 40)); };
const clamp100 = (v) => Math.max(0, Math.min(100, v));
function corrOf(J, profiles) {
  return profiles.map((p, i) => profiles.map((q, j) => {
    if (i === j) return 100;
    let v = agreeTaste(p.tasteNow, q.tasteNow);
    const k = p.key < q.key ? `${p.key}|${q.key}` : `${q.key}|${p.key}`;
    const r = J.rel[k];
    if (r && r[0] >= 3) {
      const obs = p.scope === 'neta' ? clamp100(100 - (r[1] / 10) * 5) : clamp100(100 - (r[1] / 1000) * 100 * 4);
      v = Math.round(v * 0.5 + obs * 0.5);
    }
    return v;
  }));
}
function sceneInfo(J, year) {
  const t = JA.sceneAt(J, year);
  const o = JA.DIMS.map((k, i) => [k, t[i]]).sort((a, b) => b[1] - a[1]);
  return {
    tops: [o[0], o[1]].filter((x) => x[1] > 0.02).map((x) => JA.DIM_JP[x[0]]), lows: o.slice(-1).filter((x) => x[1] < -0.02).map((x) => JA.DIM_JP[x[0]]),
    kinds: { manzai: JA.kindFavor(J, 'manzai', year), conte: JA.kindFavor(J, 'conte', year), pin: JA.kindFavor(J, 'pin', year), rakugo: JA.kindFavor(J, 'rakugo', year) }, vec: t,
  };
}
function scopeList(g) {
  const d = dateOf(g);
  const out = [{ id: 'neta', label: 'ネタの審査員（台本）', year: d.year, n: 5 }];
  if (CONTESTS.m1 && I.heldIn(g, CONTESTS.m1, d.year).held) out.push({ id: 'm1', label: CONTESTS.m1.short || 'M-1', year: d.year, n: 7 });
  if (CONTESTS.koc && I.heldIn(g, CONTESTS.koc, d.year).held) out.push({ id: 'koc', label: CONTESTS.koc.short || 'KOC', year: d.year, n: 5 });
  const defs = Object.values(CONTESTS).filter((def) => !['m1', 'koc'].includes(def.id) && !I.isSelfRun(def)).sort((a, b) => I.prestigeOf(b) - I.prestigeOf(a));
  for (const def of defs) {
    const y = safe('seasonYear', () => I.seasonYearOf(g, def), d.year);
    if (!safe('held', () => I.heldIn(g, def, y).held, false)) continue;
    const R = I.roundsAt(def, y);
    const fin = R[R.length - 1] || {};
    if (!(fin.judge === 'panel' || fin.judge === 'points' || (!fin.judge && fin.final))) continue;
    out.push({ id: `c:${def.id}`, label: def.short || def.name, year: y, n: num(fin.judges, 5) });
    if (out.length >= 14) break;
  }
  return out;
}
function profilesOf(g, J, scope) {
  const year = scope.year;
  if (scope.id === 'neta') {
    const panel = JA.netaPanel(J, BASE_JUDGES, year);
    return panel.map((p) => {
      const seat = J.seats[p.id];
      return profileOf(g, J, p.desc, year, {
        female: p.id === 'emihara', dialect: ['tobishima', 'emihara'].includes(p.id) ? 'kansai' : 'std', pre: seat.pre || 0,
        extra: { seat: { gen: seat.gen, since: seat.y0, end: seat.end, mentor: seat.mentor, prev: seat.prev || [] }, voiceId: p.id, schoolSeat: p.taste },
      });
    });
  }
  if (scope.id === 'm1') {
    return m1JudgesFor(year).map((j) => profileOf(g, J, JA.descOfTable(J, 'm1', j), year, { dialect: 'kansai', since: j.from, extra: { schoolSeat: j.taste, line: j.line } }));
  }
  if (scope.id === 'koc') {
    const c = g.contest('koc');
    const list = c && typeof c.judgesOf === 'function' ? safe('kocJ', () => c.judgesOf(g, year), []) : [];
    return list.map((j) => profileOf(g, J, JA.descOfTable(J, 'koc', { ...j, taste: j.taste }), year, { extra: { schoolSeat: j.taste } }));
  }
  const id = scope.id.replace(/^c:/, '');
  const list = safe('judgesFor', () => I.judgesFor(g, id, year, scope.n), []);
  return list.map((j) => profileOf(g, J, JA.descOfJudge(J, j), year, { look: j.look, female: j.female, dialect: j.dialect, since: j.from, extra: { schoolSeat: j.taste, alumni: !!j.alumni } }));
}

// ------------------------------------------------------------------ methods
const methods = {
  judgeScopes() { return this.state ? safe('scopes', () => scopeList(this), []) : []; },
  judgeBook(scopeId) {
    if (!this.state) return null;
    const J = ensureJ(this);
    if (!J) return null;
    const scopes = this.judgeScopes();
    const scope = scopes.find((s) => s.id === scopeId) || scopes[0];
    const judges = safe('profiles', () => profilesOf(this, J, scope), []);
    return { scope, scopes, year: scope.year, judges, corr: corrOf(J, judges), scene: sceneInfo(J, scope.year), log: J.log.slice(0, 8) };
  },
  judgeProfile(key) {
    const J = ensureJ(this);
    if (!J) return null;
    for (const s of this.judgeScopes()) { const p = safe('p', () => profilesOf(this, J, s), []).find((x) => x.key === key); if (p) return p; }
    return null;
  },
  judgeLog(n = 8) { const J = this.state && ensureJ(this); return J ? J.log.slice(0, n) : []; },
  judgeNetaPanel() { const J = ensureJ(this); return J ? JA.netaPanel(J, BASE_JUDGES, dateOf(this).year).map((p) => ({ id: p.id, key: p.key, name: p.name, title: p.title, school: p.school, since: p.since, end: p.end, gen: p.gen })) : []; },
  judgeTick() { return judgeTick(this); },
  openJudgeBook(opts = {}) { if (this.auto && !this.auto.judgeui) return Promise.resolve(null); return openJudgeBook(this, opts); },
  // after a panel has judged the player (a final): offer to open the 審査員名鑑 and ask one of them (never under g.auto; nothing is sent anywhere unless the player then asks)
  async judgeOffer(scope) {
    if (this.auto || !this.state) return null;
    const i = await this.ask('審査員に話を聞いてみる？（審査員名鑑）', ['審査員名鑑を開く', 'このまま進む']);
    if (i === 0) await this.openJudgeBook({ scope });
    return i === 0;
  },
  // 「この審査員にたずねる」: the judge's answer (Claude in character when the player set a key; else from the judge's own state)
  async judgeAsk(key, qid = 'impression', opts = {}) {
    const p = opts.profile || this.judgeProfile(key);
    if (!p) return { text: '…', by: 'local' };
    const J = ensureJ(this);
    const last = J.pl[J.pl.length - 1];
    let script = null;
    if (last) {
      const ax = {};
      JM.AXIS_ORDER.forEach((a, i) => { if (last.a[i] >= 0) ax[a] = last.a[i]; });
      const rank = Object.entries(ax).sort((a, b) => b[1] - a[1]);
      script = { title: last.ti || '無題', kind: KIND_LABEL[last.k] || '', total: last.t, rank: last.t >= 74 ? '決勝レベル' : last.t >= 56 ? '3回戦レベル' : '修行中', strong: rank[0] ? AXES[rank[0][0]] : '', weak: rank[rank.length - 1] ? AXES[rank[rank.length - 1][0]] : '' };
    }
    const ctx = { script, year: dateOf(this).year };
    if (this.auto && !opts.fetch) return { text: localAnswer(p, qid, ctx), by: 'local' };
    return askJudge(p, qid, ctx, opts);
  },
};
export function installJudges(proto) { for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k)); }
installJudges(Game.prototype);
export { QUESTIONS, scopeList, profilesOf, corrOf, sceneInfo, personName, isRealNameLike };
