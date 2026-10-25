// お笑いの土台 (owner: A) — comedy stats, the player's act (ピン / コンビ / トリオ), 相方 (ネット / NSC / 知り合い), 芸歴,
// 実力不足. API doc: test-output/api_owarai.txt. Files: owarai_data.js (constants, candidates), owarai_net.js (相方募集
// boards and meetings), owarai_ui.js (the 芸人手帳 HD screen, the 相方募集 screen, phone apps), places/nsc.js (NSC and
// the 貸し稽古場). CONTRACT4 signatures are kept; extras are documented in the API doc.
//
// State: st.owarai (lazy; old saves are seeded from skills.warai / talk / engi and st.partner).
// Light hooks into the existing engine (installed once, flag Game.prototype.__owaraiHooks):
//   - Game.prototype.minigame is wrapped to remember the last minigame id (no other change);
//   - Game.prototype.addSkill is wrapped: a positive gain in お笑い / トーク / 演技 also nudges the matching comedy stats
//     (lessons, jobs and events that raise skill 'warai' raise e.g. ボケ・ツッコミ・間 a little, through addComedyStat);
//   - Game.prototype.job is wrapped: a comedy job (skill 'warai' or a comedy minigame) counts as a stage (addStageExp)
//     and its pay is noted for the weekly ギャラの分け方 of a combi.

import { Game } from './game.js';
import { PEOPLE, PEOPLE_UI, onMorning, isKansai, weekdayOf } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { COLORS } from './draw.js';
import { ageOf, personalityMult } from './profile.js';
import { AGENCIES } from './state.js';
import { askText } from './textinput.js';
import { registerMinigame, Minigame, MINIGAMES } from './minigame.js';
import { text, panel } from './draw.js';
import {
  COMEDY_STATS, STAT_KEYS, KINDS, WEIGHTS, SOLO_KINDS, GAP_REASON, GROW_HINT, ROLES, STYLES, THEATER_RANKS, QUIRKS,
  CANDIDATES, CAST_STATS, NAME_A, NAME_B, num, dateOf, baseStats, candStats, personName, strHash,
} from './owarai_data.js';
import { netMorning } from './owarai_net.js';
import { nscMorning } from './owarai_nsc.js';
import './owarai_ui.js';

export { COMEDY_STATS };
const V = 1;
const MAX_PAST = 12;
const MAX_LOG = 30;
const MORNING_MSGS = 2; // owarai messages per morning at most

// ================================================================ state
function seedStats(st) {
  const sk = st.skills || {};
  const w = num(sk.warai), t = num(sk.talk), e = num(sk.engi), u = num(sk.uta);
  const fame = num(st.fame);
  const s = {
    neta: 6 + w * 0.5, boke: 6 + w * 0.5, tsukkomi: 6 + w * 0.5, ma: 6 + w * 0.45 + t * 0.1, voice: 6 + t * 0.35 + u * 0.15,
    act: 6 + e * 0.55, hassou: 6 + w * 0.45, wagei: 6 + t * 0.55, dokyo: 6 + w * 0.2 + Math.min(20, fame / 100), chara: 6 + e * 0.2 + t * 0.2 + Math.min(15, fame / 200),
    adlib: 6 + w * 0.3 + t * 0.3, mane: 4 + e * 0.3 + u * 0.1, kosei: 6 + w * 0.4, kankyaku: 6 + t * 0.3 + w * 0.2,
  };
  const per = (st.profile && st.profile.personality) || 'akarui';
  const tweak = { akarui: { chara: 4, adlib: 1 }, majime: { kosei: 4, neta: 2 }, mypace: { dokyo: 3, ma: 2 }, makezu: { dokyo: 4, tsukkomi: 1 }, hitomishiri: { hassou: 3, chara: -2, dokyo: -2 }, ochoshi: { boke: 4, adlib: 3 } }[per] || {};
  for (const k of Object.keys(tweak)) s[k] += tweak[k];
  for (const k of STAT_KEYS) s[k] = clamp(Math.round(s[k]), 0, 60);
  return s;
}
// comedy jobs already done in an old save (stages before the comedy reform)
const COMEDY_JOB = /warai|tsukkomi|manzai|conte|rakugo|ogiri|owarai|maesetsu|wakate|street_tsukkomi|kanmuri|_gp|oogiri|shinkigeki/i;
function ensure(g) {
  const st = g.state;
  if (!st) return null;
  if (!st.owarai || typeof st.owarai !== 'object' || Array.isArray(st.owarai)) st.owarai = {};
  const o = st.owarai;
  if (o._ok === st && o.v === V) return o;
  if (!o.stats || typeof o.stats !== 'object') o.stats = seedStats(st);
  for (const k of STAT_KEYS) o.stats[k] = clamp(num(o.stats[k], 6), 0, 100);
  if (!o.frac || typeof o.frac !== 'object') o.frac = {};
  const c = o.career && typeof o.career === 'object' ? o.career : (o.career = {});
  for (const k of ['stages', 'ukeru', 'suberu', 'theater', 'oshi', 'bestScore', 'weekPay', 'lowWeeks']) c[k] = Math.max(0, num(c[k]));
  if (!c.byKind || typeof c.byKind !== 'object') c.byKind = {};
  if (!Array.isArray(c.recent)) c.recent = [];
  if (!Array.isArray(c.log)) c.log = [];
  if (c.debut && typeof c.debut !== 'object') c.debut = null;
  if (!o.seeded) {
    o.seeded = st.day || 1;
    // an old save: comedy jobs already done count as stages, an agency means a debut
    let n = 0;
    for (const [k, v] of Object.entries(st.jobs || {})) if (COMEDY_JOB.test(k)) n += num(v);
    c.stages = Math.max(c.stages, n);
    if (!c.debut && (n > 0 || st.agency)) c.debut = { ...dateOf(g, 1), day: 1, how: st.agency ? 'agency' : 'stage' };
    if (st.agency && !c.theater) c.theater = 1;
  }
  if (!o.members || typeof o.members !== 'object') o.members = {};
  if (!Array.isArray(o.past)) o.past = [];
  if (!o.pin || typeof o.pin !== 'object') o.pin = { formed: c.debut ? { ...c.debut } : { ...dateOf(g, 1), day: 1 } };
  if (!o.daily || typeof o.daily !== 'object') o.daily = { day: 0, counts: {}, msgs: 0 };
  if (!o.nsc || typeof o.nsc !== 'object') o.nsc = { status: 'none' };
  if (!o.net || typeof o.net !== 'object') o.net = {};
  if (!Array.isArray(o.shortfalls)) o.shortfalls = [];
  o.unitSeq = Math.max(0, num(o.unitSeq));
  if (o.unit && (typeof o.unit !== 'object' || !Array.isArray(o.unit.members))) o.unit = null;
  if (o.unit) normUnit(o.unit);
  o.v = V;
  Object.defineProperty(o, '_ok', { value: st, enumerable: false, configurable: true, writable: true });
  return o;
}
function normUnit(u) {
  u.harmony = clamp(num(u.harmony, 50), 0, 100);
  u.type = u.members.length >= 3 ? 'trio' : 'combi';
  if (!STYLES[u.style] || u.style === 'pin') u.style = 'manzai';
  if (!u.formed || typeof u.formed !== 'object') u.formed = { day: 1, year: null, month: null };
  if (!['even', 'me', 'them'].includes(u.split)) u.split = 'even';
  for (const m of u.members) if (!ROLES[m.role] || m.role === 'pin') m.role = 'both';
  u.stages = Math.max(0, num(u.stages));
  if (!Array.isArray(u.log)) u.log = [];
}
const today = (g) => ({ ...dateOf(g), day: g.state.day });
function logC(g, o, textS) {
  o.career.log.unshift({ day: g.state.day, text: textS });
  if (o.career.log.length > MAX_LOG) o.career.log.length = MAX_LOG;
}
const isCand = (id) => !!CANDIDATES[id];
export const sourceOf = (id) => (CANDIDATES[id] ? (CANDIDATES[id].board ? 'net' : 'nsc') : 'people');

// a member's stats (seeded once: a candidate's own, a cast member's profile, else a generic level)
function memberRec(o, id) {
  let m = o.members[id];
  if (!m || typeof m !== 'object' || !m.stats) {
    let stats = candStats(id);
    if (!stats) { const cs = CAST_STATS[id]; stats = baseStats(id, cs ? cs.lv : 26, cs ? cs.hi : '', cs ? cs.lo : ''); }
    m = o.members[id] = { stats, frac: {} };
  }
  for (const k of STAT_KEYS) m.stats[k] = clamp(num(m.stats[k], 20), 0, 100);
  if (!m.frac) m.frac = {};
  return m;
}
const quirksOf = (id) => (CANDIDATES[id] && CANDIDATES[id].q) || [];
const hasQ = (id, q) => quirksOf(id).includes(q);
function qMult(id, key) {
  let k = 1;
  for (const q of quirksOf(id)) { const d = QUIRKS[q]; if (d && typeof d[key] === 'number') k *= d[key]; }
  return k;
}

// diminishing returns: a stat grows slower the higher it is (×1 at 0, ×0.6 at 50, ×0.25 at 90)
const gainMult = (v) => clamp(1.15 - v / 90, 0.12, 1);
// rec = { stats, frac } (the player's st.owarai or a member record); returns the whole-point change
function growStat(rec, key, n) {
  if (!COMEDY_STATS[key] || !n || !rec) return 0;
  if (!rec.frac) rec.frac = {};
  const before = rec.stats[key];
  if (n < 0) { rec.stats[key] = clamp(Math.round(before + n), 0, 100); return rec.stats[key] - before; }
  const add = n * gainMult(before) + num(rec.frac[key]);
  const whole = Math.floor(add);
  rec.frac[key] = Math.round((add - whole) * 1000) / 1000;
  rec.stats[key] = clamp(before + whole, 0, 100);
  if (rec.stats[key] >= 100) rec.frac[key] = 0;
  return rec.stats[key] - before;
}

// ================================================================ the act
function newUnit(g, o, pid, opts = {}) {
  const c = CANDIDATES[pid];
  const cs = CAST_STATS[pid];
  const theirRole = (c && c.role) || (cs && cs.role) || 'boke';
  const myRole = theirRole === 'boke' ? 'tsukkomi' : theirRole === 'tsukkomi' ? 'boke' : 'both';
  memberRec(o, pid);
  o.unitSeq++;
  const formedDay = opts.formedDay || g.state.day;
  const u = {
    id: 'u' + o.unitSeq, type: 'combi', name: opts.name || defaultName(g, [pid]), kana: '',
    members: [{ id: 'player', role: myRole }, { id: pid, role: theirRole === myRole ? 'both' : theirRole }],
    formed: { ...dateOf(g, formedDay), day: formedDay }, style: (c && c.style) || 'manzai',
    harmony: clamp(Math.round(opts.harmony ?? startHarmony(g, pid)), 5, 90), source: opts.source || sourceOf(pid), split: 'even',
    named: !!opts.named, stages: 0, lastAwase: g.state.day, awase: 0, quarrel: null, dissolveAsk: 0, log: [], weekPay: 0,
  };
  if (opts.migrated) u.migrated = true;
  normUnit(u);
  return u;
}
// a candidate: from the hidden 相性 and how well you know them; a friend (people.js cast, old saves): from their affection
function startHarmony(g, pid) {
  const c = CANDIDATES[pid];
  if (!c) return clamp(25 + g.aff(pid) * 0.55, 30, 85);
  let h = 44 + (num(c.compat, 50) - 50) * 0.35 + Math.min(10, g.aff(pid) / 8);
  for (const q of quirksOf(pid)) if (QUIRKS[q] && QUIRKS[q].start) h += QUIRKS[q].start;
  return h;
}
export function defaultName(g, ids) {
  const shorts = ids.map((id) => personName(id));
  return `${shorts.join('と')}と${g.state.name || 'ドット'}`.slice(0, 14);
}
export function nameIdeas(g, ids, n = 5) {
  const seed = strHash(ids.join(',') + g.state.day);
  const out = new Set();
  for (let i = 0; out.size < n - 1 && i < 40; i++) out.add(NAME_A[(seed + i * 7) % NAME_A.length] + NAME_B[((seed >>> 4) + i * 5) % NAME_B.length]);
  out.add(defaultName(g, ids));
  return [...out].slice(0, n);
}
function archive(g, o, why) {
  const u = o.unit;
  if (!u) return null;
  const rec = { id: u.id, type: u.type, name: u.name, members: u.members.map((m) => ({ id: m.id, role: m.role })), formed: u.formed, dissolved: today(g), why, source: u.source, stages: u.stages, harmony: u.harmony };
  o.past.unshift(rec);
  if (o.past.length > MAX_PAST) o.past.length = MAX_PAST;
  o.unit = null;
  logC(g, o, `「${u.name}」解散（${why === 'quarrel' ? '不仲' : why === 'reform' ? '組みかえ' : why === 'external' ? '活動停止' : '話し合い'}）`);
  return rec;
}
// st.partner is the truth for the 相方 (people.js, justice, old saves set it): the act follows it.
function reconcile(g, o) {
  const st = g.state;
  const pid = st.partner && PEOPLE[st.partner] ? st.partner : null;
  const u = o.unit;
  const first = o.knownPartner === undefined; // the first look at this save: a 相方 already set is an old save's combi
  o.knownPartner = st.partner || null;
  if (!u && pid) {
    const p = st.people[pid] || {};
    o.unit = first
      ? newUnit(g, o, pid, { formedDay: Math.max(1, Math.min(st.day, num(p.met, st.day))), named: true, migrated: true, name: `${personName(pid)}と${st.name || 'ドット'}` })
      : newUnit(g, o, pid, {});
  } else if (u && !pid && !(st.partner && !PEOPLE[st.partner])) {
    archive(g, o, 'external');
  } else if (u && pid && !u.members.some((m) => m.id === pid)) {
    archive(g, o, 'reform');
    o.unit = newUnit(g, o, pid, {});
  }
}
function getO(g) {
  const o = ensure(g);
  if (o) reconcile(g, o);
  return o;
}

function memberView(g, o, m) {
  const st = g.state;
  if (m.id === 'player') return { id: 'player', name: st.name || 'ドット', short: st.name || 'ドット', role: m.role, look: st.look || {}, stats: { ...o.stats } };
  const P = PEOPLE[m.id] || {};
  return { id: m.id, name: P.name || m.id, short: P.short || P.name || m.id, role: m.role, look: P.look || {}, stats: { ...memberRec(o, m.id).stats } };
}
function unitView(g, o, rec) {
  const st = g.state;
  const J = st.flags && st.flags.people_jus;
  return {
    id: rec.id, type: rec.type, name: rec.name, kana: rec.kana || '', members: rec.members.map((m) => memberView(g, o, m)),
    formed: { ...rec.formed }, style: rec.style, harmony: Math.round(rec.harmony), amateur: !st.agency, agency: st.agency || null,
    source: rec.source, dissolved: false, split: rec.split, named: !!rec.named, stages: rec.stages, quarrel: rec.quarrel ? { ...rec.quarrel } : null,
    paused: !!(J && J.combiPause), trial: !!rec.trial,
  };
}
function pinView(g, o) {
  const st = g.state;
  return {
    id: 'solo', type: 'pin', name: o.pinName || st.name || 'ドット', kana: '', members: [{ id: 'player', name: st.name || 'ドット', short: st.name || 'ドット', role: 'pin', look: st.look || {}, stats: { ...o.stats } }],
    formed: { ...o.pin.formed }, style: 'pin', harmony: 70, amateur: !st.agency, agency: st.agency || null, source: 'solo', dissolved: false, split: 'even', named: true, stages: o.career.stages, quarrel: null, paused: false,
  };
}
// the record the power / UI work on: a trial pair at a meeting (g._owTrial), else the real act
function activeRec(g, o) {
  if (g._owTrial && PEOPLE[g._owTrial.pid]) {
    const pid = g._owTrial.pid;
    memberRec(o, pid);
    const c = CANDIDATES[pid];
    const role = (c && c.role) || 'boke';
    return { id: 'trial', type: 'combi', name: 'おためし', members: [{ id: 'player', role: role === 'boke' ? 'tsukkomi' : role === 'tsukkomi' ? 'boke' : 'both' }, { id: pid, role }], formed: today(g), style: g._owTrial.style || (c && c.style) || 'manzai', harmony: g._owTrial.harmony ?? startHarmony(g, pid), source: sourceOf(pid), split: 'even', stages: 0, trial: true, log: [] };
  }
  return o.unit;
}

// ================================================================ power / shortfall
function roleWeight(role, key, kind) {
  if (kind !== 'manzai' && kind !== 'conte') return 1;
  if (key === 'boke') return role === 'boke' ? 1.6 : role === 'tsukkomi' ? 0.4 : role === 'both' ? 1.3 : 1;
  if (key === 'tsukkomi') return role === 'tsukkomi' ? 1.6 : role === 'boke' ? 0.4 : role === 'both' ? 0.7 : 1;
  return 1;
}
function indiv(stats, role, kind) {
  const W = WEIGHTS[kind] || WEIGHTS.manzai;
  let s = 0, w = 0;
  for (const [k, wk] of Object.entries(W)) { const x = wk * roleWeight(role, k, kind); s += num(stats[k]) * x; w += x; }
  return w ? s / w : 0;
}
function expBonus(o, kind) {
  const bk = o.career.byKind[kind] || {};
  return Math.min(9, Math.log2(1 + num(bk.stages)) * 1.6 + Math.log2(1 + o.career.stages) * 0.6);
}
function condBonus(g) {
  const L = g.state.life || {};
  if (num(L.stress) >= 100) return -10;
  return (num(L.stress) >= 70 ? -4 : 0) + (num(L.hunger, 50) < 20 ? -3 : 0);
}
function powerOf(g, o, kind) {
  if (kind === 'any') return Math.max(powerOf(g, o, 'manzai'), powerOf(g, o, 'conte'), powerOf(g, o, 'pin'));
  if (kind === 'double') return Math.round((powerOf(g, o, 'manzai') + powerOf(g, o, 'conte')) / 2);
  if (!WEIGHTS[kind]) kind = 'manzai';
  const rec = activeRec(g, o);
  let p;
  if (SOLO_KINDS.has(kind) || !rec) {
    p = indiv(o.stats, 'pin', kind);
    if (!rec && (kind === 'manzai' || kind === 'conte')) p *= kind === 'manzai' ? 0.72 : 0.88; // 漫談 / 一人コント
  } else {
    const scores = rec.members.map((m) => indiv(m.id === 'player' ? o.stats : memberRec(o, m.id).stats, m.role, kind));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    p = 0.65 * mean + 0.35 * Math.min(...scores);
    const roles = rec.members.map((m) => m.role);
    if (kind === 'manzai' && roles.filter((r) => r === 'boke').length >= 2 && !roles.includes('tsukkomi') && !roles.includes('both')) p -= 3;
    if (kind === 'manzai' && roles.includes('boke') && roles.includes('tsukkomi')) p += 2;
    p += (num(rec.harmony, 50) - 50) * 0.12;
    if (!rec.trial) p += Math.min(6, Math.max(0, (dateOf(g).year - num(rec.formed.year, dateOf(g).year))) * 0.8);
    if (rec.type === 'trio') p += kind === 'conte' ? 2 : -1;
    if (rec.style === 'conte' && kind === 'manzai') p -= 2;
    if (rec.style === 'manzai' && kind === 'conte') p -= 2;
  }
  p += expBonus(o, kind) + condBonus(g);
  return clamp(Math.round(p), 0, 100);
}
function shortfallOf(g, o, kind, need) {
  if (kind === 'any' || kind === 'double' || !WEIGHTS[kind]) kind = kind === 'double' ? 'manzai' : (o.unit ? (o.unit.style === 'conte' ? 'conte' : 'manzai') : 'pin');
  need = clamp(num(need, 50), 1, 100);
  const rec = SOLO_KINDS.has(kind) ? null : activeRec(g, o);
  const W = WEIGHTS[kind];
  const maxW = Math.max(...Object.values(W));
  const gaps = [];
  const statOf = (key) => {
    if (!rec) return { have: num(o.stats[key]), who: null };
    let best = null;
    for (const m of rec.members) {
      const v = m.id === 'player' ? num(o.stats[key]) : num(memberRec(o, m.id).stats[key]);
      const w = roleWeight(m.role, key, kind);
      if (key === 'boke' || key === 'tsukkomi') { if (!best || w > best.w || (w === best.w && v > best.v)) best = { v, w, id: m.id }; } else if (!best || v < best.v) best = { v, w, id: m.id };
    }
    return { have: best.v, who: best.id === 'player' ? null : best.id };
  };
  for (const [key, wk] of Object.entries(W).sort((a, b) => b[1] - a[1])) {
    const target = Math.round(need * (0.75 + 0.25 * (wk / maxW)));
    const { have, who } = statOf(key);
    if (have < target) {
      const R = GAP_REASON[key] || {};
      gaps.push({ key, label: COMEDY_STATS[key], have: Math.round(have), need: target, reason: (R[kind] || R._ || '') + (who ? `（${personName(who)}）` : ''), hint: GROW_HINT[key] || '', who, weight: wk });
    }
  }
  const bk = o.career.byKind[kind] || {};
  const stagesNeed = Math.max(1, Math.round(need / 6));
  if (num(bk.stages) < stagesNeed) gaps.push({ key: 'exp', label: '場数', have: num(bk.stages), need: stagesNeed, reason: '舞台経験が少ない：本番で緊張して、稽古の半分も出せない', hint: '劇場の出番（ライブ）・賞レースの予選', weight: 0.9 });
  if (rec && !rec.trial && rec.harmony < need * 0.8) gaps.push({ key: 'harmony', label: 'コンビ仲', have: Math.round(rec.harmony), need: Math.round(need * 0.8), reason: '掛け合いの呼吸が合っていない：セリフを待ってしまい、テンポが悪い', hint: '相方とネタ合わせ・話し合い', weight: 0.9 });
  if (rec && !rec.trial && need >= 40) {
    const yrs = dateOf(g).year - num(rec.formed.year, dateOf(g).year);
    if (yrs < 1 && rec.stages < 5) gaps.push({ key: 'young', label: '結成年数', have: yrs, need: 1, reason: '結成したばかり：ふたりの「間」がまだできていない', hint: 'ネタ合わせとライブを重ねる', weight: 0.5 });
  }
  if ((kind === 'manzai') && !o.unit && !SOLO_KINDS.has(kind)) gaps.unshift({ key: 'partner', label: '相方', have: 0, need: 1, reason: '漫才には相方が必要：ひとりでは漫談になる', hint: '相方募集（ネット）・NSCの同期', weight: 2 });
  if (typeof g.netaList === 'function' && ['manzai', 'conte', 'pin', 'rakugo', 'utaneta'].includes(kind)) {
    let q = 0;
    try { for (const n of g.netaList(kind) || []) q = Math.max(q, num(typeof g.netaQuality === 'function' ? g.netaQuality(n) : 0)); } catch (e) { q = 0; }
    if (q < need * 0.85) gaps.push({ key: 'netaq', label: 'ネタの仕上がり', have: Math.round(q), need: Math.round(need * 0.85), reason: q ? 'ネタの仕上がり不足：通しのネタ合わせが足りず、セリフが体に入っていない' : '持ちネタがない：台本を書いて、ネタ合わせで仕上げる', hint: '台本を書く・ネタ合わせ', weight: 1 });
  }
  const L = g.state.life || {};
  if (num(L.stress) >= 70) gaps.push({ key: 'stress', label: 'ストレス', have: num(L.stress), need: 69, reason: '疲れとストレスで集中できていない：本番で頭が真っ白になりやすい', hint: '休む・気分転換', weight: 0.6 });
  gaps.sort((a, b) => (b.key === 'partner') - (a.key === 'partner') || ((b.need - b.have) / b.need) * b.weight - ((a.need - a.have) / a.need) * a.weight);
  const power = powerOf(g, o, kind);
  const ok = power >= need && !gaps.some((x) => x.key === 'partner');
  const textS = gaps.length ? gaps.slice(0, 3).map((x) => x.reason.split('：')[0] + (x.reason.includes('：') ? '：' + x.reason.split('：')[1] : '')).join('／') : '';
  return { ok, gaps, text: textS, power, need, kind };
}

// ================================================================ harmony
function harmonyAdd(g, o, n, why) {
  const u = o.unit;
  if (!u || !n) return u ? u.harmony : 0;
  let k = 1;
  for (const m of u.members) if (m.id !== 'player') k *= qMult(m.id, n > 0 ? 'harmonyGain' : 'harmonyLoss');
  const before = u.harmony;
  u.harmony = clamp(Math.round((u.harmony + n * k) * 10) / 10, 0, 100);
  if (why) { u.log.unshift({ day: g.state.day, d: Math.round((u.harmony - before) * 10) / 10, why }); if (u.log.length > 20) u.log.length = 20; }
  return u.harmony;
}

// ================================================================ practice
// where: 'home' | 'keikoba' | 'nsc' | 'outdoor' | 'theater' | 'any' (list = any of them)
const THEATERS = ['yoshimoto', 'shinkigeki', 'shochiku', 'grape', 'bs_yoshimoto'];
const placeTag = (g) => {
  const id = g.map && g.map.placeId;
  const tags = new Set(['any']);
  if (!id) return tags;
  try { if (g.housing && g.housing().place === id) tags.add('home'); } catch (e) { /* ignore */ }
  if (id === 'keikoba') tags.add('keikoba');
  if (id === 'nsc' || id === 'nsc_tokyo') { tags.add('nsc'); tags.add('keikoba'); }
  if (THEATERS.includes(id)) tags.add('theater');
  const pl = g.map.place;
  if (pl && pl.kind === 'town') tags.add('outdoor');
  return tags;
};
const WHERE_LABEL = { home: '家', keikoba: '稽古場', nsc: 'NSC', outdoor: '公園・河原（町の中）', theater: '劇場（よしもと・新喜劇・松竹芸能・グレープ）', any: 'どこでも' };
export const PRACTICE = {
  neta: { label: 'ネタ作り', where: ['home'], stamina: 8, stress: 4, gains: { neta: 2.5, kosei: 1.5, hassou: 1 }, lines: ['ノートに向かって、ボケを百個書き出した。\n使えそうなのは…三つ。それでいい。', '設定をひとつ決めて、展開を何通りも考えた。\nオチが決まると、頭の中で拍手が聞こえた。', '昔のネタ帳を読み返して、構成を組みかえた。\n前より、ずっとすっきりした。'] },
  hassei: { label: '発声練習', where: ['outdoor', 'keikoba'], stamina: 6, stress: 1, gains: { voice: 2.5, ma: 0.5, dokyo: 0.5 }, lines: ['「あえいうえおあお！」\n腹から声を出す。遠くの木まで届くように。', '早口言葉を十回ずつ。\n「となりの客はよく柿食う客だ」…噛んだ。もう一回。'] },
  awase: { label: '相方とネタ合わせ', where: ['keikoba', 'nsc', 'home'], unit: true, stamina: 10, stress: 3, gains: { ma: 2, kosei: 0.6 }, role: 1.5, harmony: 3, lines: ['頭から通しで三回。\n二回目で、ふたりの間がぴたりと合った。', 'ツカミのくだりを何度もやり直した。\n「いまの、ええやん」――相方が笑った。', 'オチの言い方を変えてみた。\nふたりで顔を見合わせて、うなずいた。'] },
  mitori: { label: '先輩の舞台を観る（見取り稽古）', where: ['theater'], stamina: 4, stress: -4, price: 1500, gains: { kankyaku: 2, ma: 1.5, neta: 0.5 }, lines: ['客席のうしろから、先輩たちの漫才を観た。\n同じネタでも、間ひとつで笑いの量が変わる。', '笑いの「波」がどこで来るか、ノートにメモした。\nお客さんの顔を見ていると、勉強になる。'] },
  ogiri: { label: '大喜利の自主練', where: ['any'], stamina: 5, stress: 2, gains: { hassou: 2, adlib: 1.5, boke: 0.5 }, lines: ['お題「こんな〇〇はイヤだ」で、答えを五十個。\n後半になるほど、変な答えが出てくる。', '雑誌の写真にひと言をつける練習。\n一枚に三つ。ひとつは自分でも笑った。'] },
  rakugo: { label: '落語の稽古', where: ['home', 'keikoba'], stamina: 7, stress: 3, gains: { wagei: 2.5, ma: 1.5, act: 0.5 }, lines: ['座布団に座って、古典をひとつ。\n上下（かみしも）をきって、人物を演じ分ける。', 'マクラだけを何度も。\n間をたっぷりとると、空気が変わる。'] },
  monomane: { label: 'ものまね練習', where: ['home', 'keikoba'], stamina: 5, stress: 2, gains: { mane: 3, voice: 0.5, act: 0.5 }, lines: ['テレビの声を録音して、何度も聞き比べた。\n…だんだん、似てきた気がする。', '鏡の前で、表情と口の形をまねる。\n似てないところを、ひとつずつ直す。'] },
};
// per-day repeats of the same practice: the second one helps less, and so on
const REPEAT = [1, 0.6, 0.35, 0.2, 0.1];

// ================================================================ the g.* methods
const methods = {
  // ---- CONTRACT4
  owarai() { return getO(this); },
  comedyStat(key, who = 'player') {
    const o = getO(this);
    if (!o || !COMEDY_STATS[key]) return 0;
    if (!who || who === 'player') return o.stats[key];
    return PEOPLE[who] || CANDIDATES[who] ? memberRec(o, who).stats[key] : 0;
  },
  addComedyStat(key, n, silent = false) {
    const o = getO(this);
    if (!o || !COMEDY_STATS[key]) return 0;
    const before = o.stats[key];
    growStat(o, key, num(n));
    const d = o.stats[key] - before;
    if (!silent && d) this.notify(`${COMEDY_STATS[key]} ${d > 0 ? '+' : ''}${d}`, { color: COLORS.cyan });
    return o.stats[key];
  },
  unit(opts) {
    const o = getO(this);
    if (!o) return null;
    if (opts === 'pin' || (opts && opts.pin)) return pinView(this, o);
    const rec = activeRec(this, o);
    return rec ? unitView(this, o, rec) : pinView(this, o);
  },
  unitYears(year) {
    const o = getO(this);
    if (!o) return 0;
    const y = num(year, dateOf(this).year);
    if (!o.unit) return this.geireki(y);
    return Math.max(0, y - num(o.unit.formed.year, y));
  },
  geireki(year) {
    const o = getO(this);
    const d = o && o.career.debut;
    if (!d || !d.year) return 0;
    return Math.max(0, num(year, dateOf(this).year) - d.year);
  },
  playerAge(year) {
    const st = this.state;
    if (!st) return 20;
    const now = ageOf(st);
    if (year == null) return now;
    // birthdays come with the game's April (every 120 days from day 1)
    const start = dateOf(this, 1).year;
    const p = st.profile && Number.isFinite(Number(st.profile.age)) ? Number(st.profile.age) : 20;
    return p + (num(year, start) - start);
  },
  unitPower(kind) { const o = getO(this); return o ? powerOf(this, o, kind || (o.unit ? (o.unit.style === 'conte' ? 'conte' : 'manzai') : 'pin')) : 0; },
  shortfall(kind, need = 50) { const o = getO(this); return o ? shortfallOf(this, o, kind, need) : { ok: false, gaps: [], text: '' }; },
  addStageExp(kind = 'manzai', n = 1, res = null) {
    const o = getO(this);
    if (!o) return 0;
    if (!KINDS[kind]) kind = o.unit ? (o.unit.style === 'conte' ? 'conte' : 'manzai') : 'pin';
    n = Math.max(0, Math.round(num(n, 1)));
    if (!n) return o.career.stages;
    const c = o.career;
    c.stages += n;
    const bk = c.byKind[kind] || (c.byKind[kind] = { stages: 0, best: 0, ukeru: 0, suberu: 0 });
    bk.stages = num(bk.stages) + n;
    if (!c.debut) { c.debut = { ...today(this), how: 'stage' }; logC(this, o, '初舞台（芸歴のはじまり）'); if (!o.pin.set) o.pin = { formed: { ...c.debut }, set: true }; }
    const score = res && Number.isFinite(Number(res.score)) ? Number(res.score) : null;
    if (score != null) {
      if (score >= 60) { c.ukeru++; bk.ukeru = num(bk.ukeru) + 1; } else if (score < 40) { c.suberu++; bk.suberu = num(bk.suberu) + 1; }
      bk.best = Math.max(num(bk.best), score);
      c.bestScore = Math.max(c.bestScore, score);
      c.recent.unshift({ day: this.state.day, score, kind });
      if (c.recent.length > 16) c.recent.length = 16;
      if (this.state.agency) c.oshi = clamp(c.oshi + (score >= 75 ? 2 : score >= 60 ? 1 : score < 35 ? -1 : 0), 0, 100);
      if (o.unit && !SOLO_KINDS.has(kind)) {
        harmonyAdd(this, o, score >= 75 ? 3 : score >= 60 ? 1.5 : score < 35 ? -3 : score < 45 ? -1 : 0, score >= 60 ? 'ウケた' : score < 45 ? 'スベった' : '');
        for (const m of o.unit.members) if (m.id !== 'player' && hasQ(m.id, 'negative') && score < 40) harmonyAdd(this, o, -1.5, 'スベって落ちこんだ');
      }
    }
    if (o.unit && !SOLO_KINDS.has(kind)) { o.unit.stages += n; o.unit.lastStage = this.state.day; for (const m of o.unit.members) if (m.id !== 'player') { const r = memberRec(o, m.id); growStat(r, 'dokyo', 0.5 * n); growStat(r, 'ma', 0.4 * n); } }
    for (const [k, v] of [['dokyo', 0.7], ['kankyaku', 0.6], ['ma', 0.3]]) growStat(o, k, v * Math.min(n, 3));
    return c.stages;
  },
  partnerCandidates(source = 'net') {
    const o = getO(this);
    if (!o) return [];
    if (typeof this.owaraiCandidates === 'function') return this.owaraiCandidates(source);
    return [];
  },
  async openOwarai(tab) {
    if (typeof this.owaraiScreen === 'function') return this.owaraiScreen(tab);
    return null;
  },

  // ---- extras (documented in api_owarai.txt)
  owaraiDate(day) { return dateOf(this, day); },
  owaraiPower(kind) { return this.unitPower(kind); },
  unitHarmony(n = 0, why = '') { const o = getO(this); return o ? harmonyAdd(this, o, num(n), why) : 0; },
  unitRecord() { const o = getO(this); return o ? o.unit : null; },
  theaterRank() { const o = getO(this); if (o && this.state.agency && o.career.theater < 1) o.career.theater = 1; const i = o ? clamp(o.career.theater, 0, THEATER_RANKS.length - 1) : 0; return { index: i, ...THEATER_RANKS[i] }; },
  // a member's role / the partner's quirks for the screens
  memberInfo(id) {
    const o = getO(this);
    const c = CANDIDATES[id];
    const P = PEOPLE[id];
    if (!P) return null;
    return { id, name: P.name, short: P.short || P.name, look: P.look, candidate: !!c, age: c ? c.age : null, pref: c ? c.pref : null, persona: c ? c.per : null, quirks: c ? c.q.slice() : [], motive: c ? c.mot : null, style: c ? c.style : null, role: c ? c.role : (CAST_STATS[id] || {}).role || null, stats: o ? { ...memberRec(o, id).stats } : null, source: sourceOf(id) };
  },

  // Form a combi with pid (a registered person). opts: { source, already (st.partner was set by the caller, e.g. people.js),
  // quick (no questions: defaults), silent, npc, harmony }. Resolves with the unit view or null.
  async formUnit(pid, opts = {}) {
    const st = this.state;
    const o = ensure(this);
    if (!o || !PEOPLE[pid]) return null;
    const P = PEOPLE[pid];
    if (o.unit && o.unit.members.some((m) => m.id === pid)) {
      if (opts.already && !o.unit.named && st.partner === pid) { await customizeUnit(this, o, pid, opts); return this.unit(); }
      if (!opts.already) await this.say(`${P.short || P.name}とは、もうコンビを組んでいる。`);
      return this.unit();
    }
    if (o.unit && !opts.already) {
      const cur = o.unit;
      const choices = cur.type === 'combi' ? ['解散して組みなおす', 'トリオにする', 'やめておく'] : ['解散して組みなおす', 'やめておく'];
      const k = await this.ask(`いまは「${cur.name}」で活動している。\n${P.short || P.name}と組むなら…？`, choices, { cancel: choices.length - 1 });
      if (cur.type === 'combi' && k === 1) return this.addUnitMember(pid, opts);
      if (k !== 0) return null;
      const old = cur.members.filter((m) => m.id !== 'player').map((m) => m.id);
      archive(this, o, 'reform');
      for (const id of old) if (PEOPLE[id]) { this.addAff(id, -6, true); this.message({ from: PEOPLE[id].name, person: id, kind: 'chat', text: isKansai(PEOPLE[id]) ? '新しい相方と組むんやってな。…がんばりや。ライバルとして負けへんで。' : '新しい相方と組むんだってね。…がんばって。ライバルとして負けないから。' }); }
    } else if (o.unit && opts.already) archive(this, o, 'reform');
    if (st.partner !== pid) this.setPartner(pid, { silent: true });
    this.meet(pid).partner = true;
    o.unit = newUnit(this, o, pid, { source: opts.source || sourceOf(pid), harmony: opts.harmony });
    logC(this, o, `${P.short || P.name}とコンビ結成`);
    await customizeUnit(this, o, pid, opts);
    if (!opts.silent) {
      this.sfx('fanfare');
      this.notify(`「${o.unit.name}」結成！`, { color: COLORS.accent });
      const u = o.unit;
      await this.say(`コンビ「${u.name}」結成！\n（${dateOf(this).year}年${dateOf(this).month}月結成・${STYLES[u.style]}・${u.members.map((m) => `${m.id === 'player' ? st.name : personName(m.id)}＝${ROLES[m.role]}`).join('／')}）`);
      if (!this.flag('owarai_unit_tip')) {
        this.setFlag('owarai_unit_tip', true);
        await this.say(['（結成した年が「結成◯年目」の基準になる。\nM-1のような「結成15年以内」の大会は、この日から数える）', `（コンビ仲は、ネタ合わせ・ライブの結果・ギャラの分け方で上下する。\n${this.state.profile && ['showa', 'heisei_early'].includes(this.state.profile.era) ? '手帳' : 'スマホ'}の「芸人手帳」で確かめよう）`]);
      }
    }
    return this.unit();
  },
  async addUnitMember(pid, opts = {}) {
    const o = getO(this);
    if (!o || !o.unit || !PEOPLE[pid]) return null;
    if (o.unit.members.some((m) => m.id === pid)) return this.unit();
    if (o.unit.members.length >= 3) { await this.say('4人以上のグループは、劇場の香盤に入れてもらえない。'); return null; }
    const P = PEOPLE[pid];
    const c = CANDIDATES[pid];
    const i = opts.quick || this.auto ? 0 : await this.ask(`${P.short || P.name}をメンバーに加えて、トリオにする？\n（${P.short || P.name}の役割は？）`, ['ボケ', 'ツッコミ', 'どちらも（Wボケ）', 'やめておく'], { cancel: 3 });
    if (i < 0 || i > 2) return null;
    const role = opts.quick || this.auto ? ((c && c.role) || 'boke') : ['boke', 'tsukkomi', 'both'][i];
    memberRec(o, pid);
    this.meet(pid);
    const u = o.unit;
    u.members.push({ id: pid, role });
    u.type = 'trio';
    u.harmony = clamp(Math.round((u.harmony * 2 + startHarmony(this, pid)) / 3), 5, 95);
    logC(this, o, `${P.short || P.name}が加入、トリオに`);
    this.sfx('fanfare');
    this.notify(`${P.short || P.name}が加入！トリオになった`, { color: COLORS.accent });
    this.message({ from: P.name, person: pid, kind: 'chat', text: isKansai(P) ? `今日から「${u.name}」の一員や！よろしゅう！` : `今日から「${u.name}」の一員です！よろしく！` });
    if (!opts.silent) await this.say(`「${u.name}」はトリオになった！\n（結成日は${u.formed.year}年${u.formed.month}月のまま。メンバーの数が変わっても結成年数は続く）`);
    return this.unit();
  },
  async removeUnitMember(pid, opts = {}) {
    const st = this.state;
    const o = getO(this);
    if (!o || !o.unit || o.unit.type !== 'trio') return null;
    const u = o.unit;
    const idx = u.members.findIndex((m) => m.id === pid);
    if (idx < 1) return null;
    if (opts.confirm !== false && !this.auto) {
      const k = await this.ask(`${personName(pid)}がトリオから抜けて、コンビになる。\nいい？`, ['抜けてもらう', 'やめておく'], { cancel: 1 });
      if (k !== 0) return null;
    }
    u.members.splice(idx, 1);
    u.type = 'combi';
    const rest = u.members.find((m) => m.id !== 'player');
    if (st.partner === pid && rest) { this.setPartner(rest.id, { silent: true }); this.meet(rest.id).partner = true; }
    if (PEOPLE[pid]) { this.addAff(pid, -5, true); if (st.people[pid]) st.people[pid].partner = false; }
    harmonyAdd(this, o, -4, 'メンバーが抜けた');
    logC(this, o, `${personName(pid)}が脱退、コンビに`);
    return this.unit();
  },
  async renameUnit(opts = {}) {
    const o = getO(this);
    if (!o) return null;
    const ids = o.unit ? o.unit.members.filter((m) => m.id !== 'player').map((m) => m.id) : [];
    const cur = o.unit ? o.unit.name : (o.pinName || this.state.name);
    const name = await pickName(this, ids, cur, o.unit ? (o.unit.type === 'trio' ? 'トリオ名' : 'コンビ名') : '芸名（ピン）', opts);
    if (!name) return null;
    if (o.unit) { o.unit.name = name; o.unit.named = true; harmonyAdd(this, o, 1, '名前が決まった'); } else o.pinName = name;
    logC(this, o, `名前を「${name}」に`);
    this.notify(`「${name}」に決めた！`, { color: COLORS.accent });
    return name;
  },
  async setUnitRoles(opts = {}) { const o = getO(this); if (!o || !o.unit) return null; await pickRoles(this, o, opts); return this.unit(); },
  async setUnitStyle(opts = {}) { const o = getO(this); if (!o || !o.unit) return null; await pickStyle(this, o, opts); return this.unit(); },
  // ギャラの分け方: 'even' 折半 / 'me' 自分が多め / 'them' 相方に多め (settled every Monday from the week's comedy pay)
  setUnitSplit(v) {
    const o = getO(this);
    if (!o || !o.unit || !['even', 'me', 'them'].includes(v)) return null;
    const was = o.unit.split;
    o.unit.split = v;
    if (was !== v) harmonyAdd(this, o, v === 'them' ? 2 : v === 'me' ? -3 : was === 'me' ? 2 : 0, `ギャラの分け方を${{ even: '折半', me: '自分が多め', them: '相方に多め' }[v]}に`);
    return v;
  },
  // 解散. opts: { confirm (default true), why: 'talk'|'quarrel'|'reform', silent }
  async dissolveUnit(opts = {}) {
    const st = this.state;
    const o = getO(this);
    if (!o || !o.unit) return false;
    const u = o.unit;
    if (opts.confirm !== false && !this.auto) {
      const yrs = dateOf(this).year - num(u.formed.year, dateOf(this).year);
      const k = await this.ask([`「${u.name}」を解散する？\n（結成${yrs}年・舞台${u.stages}回。解散すると結成年数はリセット。\n新しく組めば、その日が新しい結成日になる）`], ['解散する', 'やめておく'], { cancel: 1 });
      if (k !== 0) return false;
    }
    const others = u.members.filter((m) => m.id !== 'player').map((m) => m.id);
    archive(this, o, opts.why || 'talk');
    if (st.partner) this.setPartner(null);
    for (const id of others) {
      const P = PEOPLE[id];
      if (!P) continue;
      if (st.people[id]) st.people[id].partner = false;
      this.addAff(id, opts.why === 'quarrel' ? -10 : -4, true);
      if (!opts.silent) this.message({ from: P.name, person: id, kind: 'chat', text: isKansai(P) ? 'いままで、おおきに。\n…次に同じ舞台に立つときは、ライバルや。' : 'いままで、ありがとう。\n…次に同じ舞台に立つときは、ライバルだね。' });
    }
    this.addNeed('stress', 8);
    this.sfx('fail');
    if (!opts.silent) await this.say(`「${u.name}」は解散した。\n（ピンで活動するか、新しい相方をさがそう）`);
    return true;
  },

  // ---- practice
  practiceList() {
    const o = getO(this);
    const tags = placeTag(this);
    const out = [];
    for (const [id, d] of Object.entries(PRACTICE)) {
      const here = d.where.some((w) => tags.has(w));
      let why = null;
      if (d.unit && !o.unit) why = '相方がいない';
      else if (!here) why = `${d.where.map((w) => WHERE_LABEL[w]).join('・')}でできる`;
      const n = num(o.daily.day === this.state.day ? o.daily.counts[id] : 0);
      out.push({ id, label: d.label, why, stamina: d.stamina, stress: d.stress, price: d.price || 0, count: n, gains: Object.keys(d.gains).map((k) => COMEDY_STATS[k]), mult: REPEAT[Math.min(n, REPEAT.length - 1)] });
    }
    return out;
  },
  // run a practice action (opts: { skipCheck, quiet (no fade), with: partner id })
  async owaraiPractice(id, opts = {}) {
    const st = this.state;
    const o = getO(this);
    const d = PRACTICE[id];
    if (!o || !d) return null;
    if (!opts.skipCheck) {
      const it = this.practiceList().find((x) => x.id === id);
      if (it && it.why) { await this.say(`（${d.label}：${it.why}）`); return null; }
    }
    const why = this.lifeRefusal();
    if (why) { await this.say(why); return null; }
    const tags = placeTag(this);
    let price = d.price || 0;
    if (id === 'mitori' && st.agency && (AGENCIES[st.agency] || {}).name && tags.has('theater')) price = 0; // 所属芸人は関係者として袖から観られる
    if (st.stamina < d.stamina) { await this.say('体力が足りない…。\n少し休んでからにしよう。'); return null; }
    if (price && st.money < price) { await this.say(`お金が足りない…。（${fmtMoney(price)}）`); return null; }
    if (price) { st.money -= price; this.sfx('coin'); }
    if (o.daily.day !== st.day) o.daily = { day: st.day, counts: {}, msgs: o.daily.msgs && o.daily.day === st.day ? o.daily.msgs : 0 };
    const n = num(o.daily.counts[id]);
    o.daily.counts[id] = n + 1;
    const mult = REPEAT[Math.min(n, REPEAT.length - 1)];
    st.stamina = Math.max(0, st.stamina - d.stamina);
    if (d.stress > 0) this.lifeTick({ stress: d.stress, hunger: -Math.round(d.stamina / 2), clean: -Math.round(d.stamina / 3) });
    else this.relax({ stress: -d.stress, silent: true });
    if (!opts.quiet) { await this.fadeOut(10); this.sfx(id === 'mitori' ? 'laugh' : 'drum'); await this.wait(260); await this.fadeIn(10); }
    const before = { ...o.stats };
    const extra = [];
    let lineS = d.lines[Math.floor(Math.random() * d.lines.length)];
    let k = mult * (id === 'neta' || id === 'ogiri' ? personalityMult(st, 'lesson') : 1);
    if (id === 'awase') {
      const u = o.unit;
      const partners = u.members.filter((m) => m.id !== 'player');
      const late = partners.find((m) => Math.random() < (QUIRKS.chikoku && hasQ(m.id, 'chikoku') ? 0.28 : hasQ(m.id, 'hoko') ? 0.12 : 0));
      if (late) { k *= 0.6; harmonyAdd(this, o, -1.5, '遅刻'); this.addNeed('stress', 3); extra.push(`（${personName(late.id)}が${hasQ(late.id, 'chikoku') ? '一時間' : '三十分'}遅れてきた…。練習時間が減った）`); }
      let pk = 1;
      for (const m of partners) pk *= qMult(m.id, 'practice');
      const myRole = (u.members.find((m) => m.id === 'player') || {}).role || 'both';
      growStat(o, myRole === 'tsukkomi' ? 'tsukkomi' : 'boke', d.role * k * pk);
      for (const m of partners) {
        const r = memberRec(o, m.id);
        growStat(r, 'ma', 1.6 * k * pk); growStat(r, m.role === 'tsukkomi' ? 'tsukkomi' : 'boke', 1.2 * k * pk); growStat(r, 'kosei', 0.4 * k);
        if (hasQ(m.id, 'kanpeki')) this.addNeed('stress', 2);
      }
      harmonyAdd(this, o, d.harmony * mult, 'ネタ合わせ');
      u.lastAwase = st.day;
      u.awase = num(u.awase) + 1;
      for (const m of partners) if (PEOPLE[m.id]) this.addAff(m.id, 1, true);
      // the newest script gets more polished (台本: neta.js)
      if (typeof this.netaList === 'function' && typeof this.practiceNeta === 'function') {
        try { const nl = this.netaList() || []; const nn = nl.find((x) => !u.style || x.kind === u.style || u.style === 'both') || nl[0]; if (nn) { const v = this.practiceNeta(nn.id, Math.round(6 * k * pk)); extra.push(`（台本『${nn.title || 'ネタ'}』の仕上がり ${Math.round(num(v))}）`); } } catch (e) { console.error(e); }
      }
      if (partners.length) lineS = lineS.replace('相方', personName(partners[0].id));
    }
    for (const [key, v] of Object.entries(d.gains)) growStat(o, key, v * k);
    const ups = STAT_KEYS.filter((key) => o.stats[key] > before[key]).map((key) => `${COMEDY_STATS[key]} ${before[key]}→${o.stats[key]}`);
    const grew = Object.keys(d.gains).filter((key) => o.stats[key] === before[key]).map((key) => COMEDY_STATS[key]);
    const msg = [lineS];
    msg.push(ups.length ? `（${ups.join('・')}）` : `（${grew.join('・')}の力が、少しずつたまってきた）`);
    if (n >= 1) msg.push(`（今日${n + 1}回目。同じ練習は、くり返すほど身につきにくい ×${mult}）`);
    await this.say([...msg, ...extra]);
    return { id, ups, mult };
  },

  // ---- a live (劇場の出番): amateur free lives at the 貸し稽古場, the agency's 事務所ライブ / 劇場 for pros
  async owaraiLive(opts = {}) {
    const st = this.state;
    const o = getO(this);
    if (!o) return null;
    const why = this.lifeRefusal();
    if (why) { await this.say(why); return null; }
    if (o.daily.day === st.day && num(o.daily.counts.live) >= 1) { await this.say('今日はもう、ライブに出た。\n（ライブは1日1回まで）'); return null; }
    const pro = !!st.agency;
    const rank = clamp(o.career.theater, 0, THEATER_RANKS.length - 1);
    const fee = pro ? 0 : 1000;
    const stamina = 15;
    const u = o.unit;
    const kind = opts.kind || (u ? (u.style === 'conte' ? 'conte' : 'manzai') : 'pin');
    const venue = pro ? { name: rank >= 5 ? 'ドット小劇場（本公演）' : rank >= 2 ? 'ドット小劇場（若手公演）' : '事務所ライブ', size: rank >= 5 ? 'theater' : 'small', crowd: rank >= 2 ? 'normal' : 'cold', pressure: 20 + rank * 8 }
      : { name: '貸し稽古場「ドットスタジオ」フリーライブ', size: 'small', crowd: 'cold', pressure: 15 };
    if (!opts.confirm) {
      const k = await this.ask(`${venue.name}\n出番：${u ? `「${u.name}」` : 'ピン'}で${KINDS[kind]}（体力 -${stamina}${fee ? `・エントリー料 ${fmtMoney(fee)}` : ''}）\n実力の目安 ${powerOf(this, o, kind)}`, ['出る', 'やめておく'], { cancel: 1 });
      if (k !== 0) return null;
    }
    if (st.stamina < stamina) { await this.say('体力が足りない…。\n何か食べて回復しよう。'); return null; }
    if (fee && st.money < fee) { await this.say(`エントリー料（${fmtMoney(fee)}）が足りない…。`); return null; }
    if (fee) st.money -= fee;
    st.stamina -= stamina;
    if (o.daily.day !== st.day) o.daily = { day: st.day, counts: {}, msgs: 0 };
    o.daily.counts.live = num(o.daily.counts.live) + 1;
    this.lifeTick({ stress: 6, hunger: -8, clean: -6 });
    let res = null;
    if (typeof this.perform === 'function') {
      try {
        const skip = !!opts.skip || (this.flag('owarai_live_done') && !this.auto ? (await this.ask('ネタを演じる？', ['自分で演じる', 'おまかせで進める'], { cancel: 1 })) === 1 : false);
        res = await this.perform({ kind, venue, title: venue.name, skip });
      } catch (e) { console.error(e); res = null; }
    }
    if (!res || !Number.isFinite(Number(res.score))) res = simPerform(this, o, kind, venue);
    this.setFlag('owarai_live_done', true);
    this.addStageExp(kind, 1, res);
    const score = num(res.score);
    const fans = Math.max(0, Math.round((score - 30) / 6 + rank * 2));
    if (fans) this.addFans(fans, true);
    if (pro && score >= 50) this.addFame(1 + rank, true);
    if (u && u.members.some((m) => hasQ(m.id, 'akippoi'))) u.lastLive = st.day;
    const L = score >= 80 ? '爆笑！客席がうねるように笑った！' : score >= 60 ? 'しっかりウケた！' : score >= 40 ? 'ぱらぱらと笑いが起きた。' : 'シーン…。スベった。';
    const sf = score < 60 ? shortfallOf(this, o, kind, Math.max(45, Math.min(80, score + 20))) : null;
    const lines = [`${L}（${score}点・${res.rank || ''}）\nファン +${fans}`];
    if (sf && sf.gaps.length) lines.push(`（ふり返り：${sf.gaps.slice(0, 2).map((x) => x.reason.split('：')[0]).join('／')}）`);
    await this.say(lines);
    return res;
  },
};

// a stand-in performance when perform.js is missing (same idea as its sim: power + script + luck)
export function simPerform(g, o, kind, venue = {}) {
  const power = powerOf(g, o, kind);
  let q = 40;
  try { if (typeof g.netaList === 'function' && typeof g.netaQuality === 'function') for (const n of g.netaList(kind) || []) q = Math.max(q, num(g.netaQuality(n))); } catch (e) { q = 40; }
  const score = clamp(Math.round(power * 0.55 + q * 0.35 + (Math.random() - 0.5) * 22 - num(venue.pressure) * 0.08), 0, 100);
  const rank = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D';
  return { score, rank, laughs: Math.round(score / 8), big: Math.round(score / 30), flubs: 0, blanks: 0, overtime: 0, adlib: 0, heat: [score], parts: {}, comment: '', highlights: [] };
}

// ================================================================ formation dialogs
async function customizeUnit(g, o, pid, opts) {
  const u = o.unit;
  if (!u) return;
  if (opts.quick || g.auto) { u.named = !!u.named; return; }
  const P = PEOPLE[pid];
  const first = !g.flag('owarai_formed_once');
  g.setFlag('owarai_formed_once', true);
  if (!first) {
    const k = await g.ask('役割・スタイル・コンビ名を決める？', ['ひとつずつ決める', 'おまかせ（あとで手帳から変えられる）'], { cancel: 1 });
    if (k === 1) return;
  }
  await pickRoles(g, o, { pid });
  await pickStyle(g, o, { pid });
  const name = await pickName(g, [pid], u.name, 'コンビ名', {});
  if (name) { u.name = name; u.named = true; }
  if (P) await g.say(isKansai(P) ? `「${u.name}」か…。\nええやん。今日からオレらは「${u.name}」や！` : `「${u.name}」…。\nいいね。今日からわたしたちは「${u.name}」！`, { name: P.name, look: P.look });
}
async function pickRoles(g, o, opts = {}) {
  const u = o.unit;
  const pm = u.members.find((m) => m.id !== 'player');
  const c = pm && CANDIDATES[pm.id];
  const want = (c && c.role) || (pm && pm.role) || 'boke';
  const k = g.auto ? 3 : await g.ask(`${personName(pm.id)}は「${ROLES[want]}」${want === 'both' ? '（どちらでも）' : ''}をやりたいみたいだ。\n自分の役割は？`, ['ボケ', 'ツッコミ', 'Wボケ（ふたりともボケ）', 'おまかせ'], { cancel: 3 });
  const mine = k === 0 ? 'boke' : k === 1 ? 'tsukkomi' : k === 2 ? 'both' : (want === 'boke' ? 'tsukkomi' : want === 'tsukkomi' ? 'boke' : 'tsukkomi');
  const me = u.members.find((m) => m.id === 'player');
  me.role = mine;
  for (const m of u.members) if (m.id !== 'player') m.role = mine === 'both' ? 'both' : mine === 'boke' ? (m.id === pm.id ? 'tsukkomi' : 'boke') : (m.id === pm.id ? 'boke' : 'tsukkomi');
  if (u.type === 'trio') { const third = u.members[2]; if (third && third.role === me.role && me.role !== 'both') third.role = me.role === 'boke' ? 'tsukkomi' : 'boke'; }
  const theirs = u.members.find((m) => m.id === pm.id).role;
  if (want !== 'both' && theirs !== want) { harmonyAdd(g, o, -5, '役割の希望がかなわなかった'); if (!g.auto) await g.say(`（${personName(pm.id)}は${ROLES[want]}がやりたかったようだ。少し不満そう…）`); }
}
async function pickStyle(g, o, opts = {}) {
  const u = o.unit;
  const pm = u.members.find((m) => m.id !== 'player');
  const c = pm && CANDIDATES[pm.id];
  const want = (c && c.style) || 'manzai';
  const k = g.auto ? -1 : await g.ask(`ネタのスタイルは？\n（${personName(pm.id)}の希望：${STYLES[want]}）`, ['漫才中心', 'コント中心', '漫才とコント両方'], { cancel: -1 });
  const v = k === 0 ? 'manzai' : k === 1 ? 'conte' : k === 2 ? 'both' : want;
  u.style = v;
  if (want !== 'both' && v !== want && v !== 'both') harmonyAdd(g, o, -4, 'スタイルの希望がちがう');
}
async function pickName(g, ids, cur, label, opts = {}) {
  if (g.auto) return opts.name || cur;
  const ideas = nameIdeas(g, ids, 5);
  const k = await g.ask(`${label}をどうする？`, ['自分で考える', '候補から選ぶ', 'いまのまま'], { cancel: 2 });
  if (k === 0) { const s = await askText(g, { title: `${label}（12文字まで）`, value: cur || ideas[0], max: 12 }); return s && s.trim() ? s.trim() : null; }
  if (k === 1) { const i = await g.list({ title: `${label}の候補`, items: ideas, x: 12, y: 56, w: 300, px: true }); return i >= 0 ? ideas[i] : null; }
  return null;
}

// ================================================================ quarrels, money, 解散 talks (talking to a member)
const QUARREL_KINDS = ['neta', 'money', 'effort', 'style', 'late'];
async function quarrelScene(g, o, id, npc) {
  const u = o.unit;
  const P = PEOPLE[id];
  const who = { name: P.name, look: (npc && npc.look) || P.look };
  const k = isKansai(P);
  const q = u.quarrel;
  if (u.dissolveAsk) {
    await g.say(k ? ['…なあ。ずっと考えとってん。', 'オレら、もう解散したほうがええんちゃうか。'] : ['…ねえ。ずっと考えてたんだ。', 'わたしたち、もう解散したほうがいいんじゃないかな。'], who);
    const i = await g.ask('どうする？', ['解散する', '引き止める'], { cancel: 1 });
    if (i === 0) { await g.dissolveUnit({ confirm: false, why: 'quarrel' }); return true; }
    const chance = 0.35 + g.aff(id) / 200 + u.awase / 100;
    if (Math.random() < chance || g.auto) {
      u.dissolveAsk = 0; u.quarrel = null; u.harmony = Math.max(u.harmony, 32);
      g.addAff(id, 3, true);
      await g.say(k ? ['……。', 'わかった。もう一回だけ、やってみよか。\n次こそ、ちゃんと向き合おうな。'] : ['……。', 'わかった。もう一回だけ、やってみよう。\n次こそ、ちゃんと向き合おうね。'], who);
      return true;
    }
    await g.say(k ? ['……ごめん。もう決めてん。'] : ['……ごめん。もう決めたの。'], who);
    await g.dissolveUnit({ confirm: false, why: 'quarrel' });
    return true;
  }
  if (!q) return false;
  const lines = {
    neta: [k ? '今のネタ、オレはもっとベタに笑わせたいねん。\n自分のやり方、ちょっと尖りすぎちゃうか。' : '今のネタ、わたしはもっとわかりやすく笑わせたい。\nちょっと尖りすぎじゃない？', ['相方の案でいく', '自分の案を通す', 'とことん話し合う']],
    money: [k ? 'ギャラの分け方のことやけど…。\n正直、納得いってへんねん。' : 'ギャラの分け方のことなんだけど…。\n正直、納得してないんだ。', ['折半にしよう', '相方に多めに渡す', 'いまのままで']],
    effort: [k ? 'ネタ合わせ、最近少なすぎひん？\nこのままやと、ほかのコンビに置いていかれるで。' : 'ネタ合わせ、最近少なすぎない？\nこのままだと、ほかのコンビに置いていかれるよ。', ['毎日やると約束する', 'バイトがいそがしい', 'とことん話し合う']],
    style: [k ? '漫才とコント、どっちに絞るか決めへん？\n中途半端がいちばんあかん。' : '漫才とコント、どっちに絞るか決めない？\n中途半端がいちばんよくないよ。', ['漫才に絞る', 'コントに絞る', '両方続ける']],
    late: [k ? '…なんでいっつも遅れてくるん、って？\nいや、それはオレが言われる側やな。すまん。' : '…遅刻のこと、怒ってる？\nごめん。ほんとに、ごめん。', ['許す', 'きつく言う', 'とことん話し合う']],
  }[q.kind] || null;
  if (!lines) { u.quarrel = null; return false; }
  await g.say(k ? 'ちょっと、話があるんや。' : 'ちょっと、話があるんだ。', who);
  const i = await g.ask(lines[0], lines[1], { ...who, cancel: 2 });
  let d = 0, say = '';
  if (q.kind === 'money') {
    if (i === 0) { g.setUnitSplit('even'); d = 4; say = k ? 'ほな、折半な。それがいちばんや。' : 'じゃあ、折半ね。それがいちばん。'; } else if (i === 1) { g.setUnitSplit('them'); d = 7; say = k ? 'ほんまに？…おおきに。その分、ネタで返すわ。' : '本当に？…ありがとう。その分、ネタで返すね。'; } else { d = -5; say = k ? '…そうか。わかった。' : '…そう。わかった。'; }
  } else if (q.kind === 'style') {
    u.style = i === 0 ? 'manzai' : i === 1 ? 'conte' : 'both';
    d = i === 2 ? -2 : 5; say = k ? 'よっしゃ、決まりやな！' : 'よし、決まりだね！';
  } else if (i === 0) { d = q.kind === 'late' ? 3 : 5; say = k ? 'ありがとう。…ほな、次のネタ合わせでな。' : 'ありがとう。…じゃあ、次のネタ合わせでね。'; if (q.kind === 'effort') u.lastAwase = g.state.day; } else if (i === 1) { d = q.kind === 'neta' ? (o.stats.neta >= memberRec(o, id).stats.neta ? 1 : -5) : -4; say = k ? '…そうか。まあ、自分がそう言うなら。' : '…そっか。まあ、そう言うなら。'; } else { d = 4; g.addNeed('stress', 8); growStat(o, 'kosei', 0.5); say = k ? '朝までしゃべってもうたな。…けど、すっきりしたわ。' : '朝まで話しちゃったね。…でも、すっきりした。'; }
  harmonyAdd(g, o, d, '話し合い');
  u.quarrel = null;
  await g.say(say, who);
  return true;
}
async function loanScene(g, o, id, npc) {
  const u = o.unit;
  const P = PEOPLE[id];
  const ask = u.loanAsk;
  const k = isKansai(P);
  const who = { name: P.name, look: (npc && npc.look) || P.look };
  const i = await g.ask(k ? `…すまん、${fmtMoney(ask.amount)}だけ貸してくれへん？\n来月には、ぜったい返すから。` : `…ごめん、${fmtMoney(ask.amount)}だけ貸してくれない？\n来月には、ぜったい返すから。`, ['貸す', 'ことわる'], { ...who, cancel: 1 });
  if (i === 0 && g.state.money >= ask.amount) {
    g.state.money -= ask.amount;
    u.loan = { amount: ask.amount, day: g.state.day, back: Math.random() < 0.55 };
    harmonyAdd(g, o, 3, 'お金を貸した');
    await g.say(k ? 'ほんまに助かる…！恩に着るわ。' : '本当に助かる…！恩に着るよ。', who);
  } else {
    harmonyAdd(g, o, -2, 'お金の話');
    await g.say(i === 0 ? '（お金が足りなかった…）' : (k ? '…せやな。すまん、変なこと頼んで。' : '…そうだよね。ごめん、変なこと頼んで。'), who);
  }
  u.loanAsk = null;
  return true;
}

// ================================================================ morning
function sendOw(g, o, msg) {
  if (o.daily.day !== g.state.day) o.daily = { day: g.state.day, counts: {}, msgs: 0 };
  if (o.daily.msgs >= MORNING_MSGS && !msg.force) return false;
  o.daily.msgs++;
  const { force, ...m } = msg;
  g.message(m);
  return true;
}
export function owaraiSend(g, msg) { const o = ensure(g); return o ? sendOw(g, o, msg) : false; }
// a message from a member: never on a morning when people.js already had them text (no cheerful invite next to a 解散 talk);
// it waits for the next morning instead, and marks the day so people.js stays quiet the next morning too
function partnerMsg(g, o, pid, textS, force = false) {
  const st = g.state;
  const P = PEOPLE[pid];
  const p = st.people[pid];
  if (!P) return false;
  if (p && num(p.msgDay) === st.day) { if (o.unit) o.unit.pendingMsg = textS; return false; }
  const ok = sendOw(g, o, { force, from: P.name, person: pid, kind: 'chat', text: textS });
  if (ok && p) p.msgDay = st.day;
  return ok;
}
function morning(g) {
  const st = g.state;
  const o = getO(g);
  if (!o) return;
  if (o.daily.day !== st.day) o.daily = { day: st.day, counts: {}, msgs: 0 };
  const day = st.day;
  // 芸歴: an agency entry is a debut
  if (st.agency && !o.career.debut) { o.career.debut = { ...today(g), how: 'agency' }; logC(g, o, `${(AGENCIES[st.agency] || {}).name || '事務所'}に所属（芸歴のはじまり）`); }
  if (st.agency && o.career.theater < 1) o.career.theater = 1;
  if (!st.agency && o.career.theater > 0 && !o.career.wasPro) o.career.theater = 0;
  if (st.agency) o.career.wasPro = true;
  const u = o.unit;
  if (u) {
    const partners = u.members.filter((m) => m.id !== 'player');
    // a long absence (no ネタ合わせ, stage, talk or outing together for more than 10 days) cools the combi slowly: −1 every
    // 3 days (a close friend: −0.5; 飽きっぽい: −1.5), after a warning on day 8. Nothing else lowers コンビ仲 by itself.
    const main = partners[0] && partners[0].id;
    const pr = (main && st.people[main]) || {};
    const together = Math.max(num(u.lastAwase), num(u.lastStage), num(pr.talkDay), num(pr.hangDay), num(u.formed && u.formed.day));
    const absent = day - together;
    if (absent < 8) u.absentWarned = 0;
    if (absent >= 8 && !u.absentWarned && main && PEOPLE[main]) {
      u.absentWarned = day;
      partnerMsg(g, o, main, isKansai(PEOPLE[main]) ? '最近、ネタ合わせできてへんな。\nそろそろ顔出してや。' : '最近、ネタ合わせできてないね。\nそろそろ顔を出してね。');
    }
    if (absent > 10 && (absent - 11) % 3 === 0) harmonyAdd(g, o, -(g.aff(main) >= 60 ? 0.5 : 1) * (partners.some((m) => hasQ(m.id, 'akippoi')) ? 1.5 : 1), absent === 11 ? 'しばらく会っていない' : '');
    if (u.pendingMsg && main && PEOPLE[main] && num(pr.msgDay) !== day) { const t = u.pendingMsg; u.pendingMsg = null; partnerMsg(g, o, main, t, true); }
    // the weekly ギャラ split (Mondays)
    if (weekdayOf(day) === 0 && u.lastSplitWeek !== Math.floor((day - 1) / 7)) {
      u.lastSplitWeek = Math.floor((day - 1) / 7);
      const pay = Math.max(0, num(u.weekPay));
      u.weekPay = 0;
      const greedy = partners.some((m) => hasQ(m.id, 'rouhi'));
      if (pay > 0) {
        if (u.split === 'me') { const b = Math.round(pay * 0.2); g.addMoney(b, true); harmonyAdd(g, o, greedy ? -6 : -4, 'ギャラを多めにとった'); sendOw(g, o, { from: '芸人手帳', kind: 'chat', text: `今週のギャラ精算：自分が多めにとった（+${fmtMoney(b)}）。${personName(partners[0].id)}は、少し不満そうだ。` }); }
        else if (u.split === 'them') { const b = Math.min(st.money, Math.round(pay * 0.2)); st.money -= b; harmonyAdd(g, o, greedy ? 3 : 4, 'ギャラを多めに渡した'); sendOw(g, o, { from: '芸人手帳', kind: 'chat', text: `今週のギャラ精算：相方に多めに渡した（-${fmtMoney(b)}）。` }); }
        else if (greedy) harmonyAdd(g, o, -1, '取り分に不満');
      }
    }
    // a loan comes back (or not)
    if (u.loan && day - u.loan.day >= 20) {
      const P = PEOPLE[partners[0] && partners[0].id];
      if (u.loan.back) { g.addMoney(u.loan.amount, true); sendOw(g, o, { from: P ? P.name : '相方', person: partners[0].id, kind: 'chat', text: `この前のお金、返すわ。ほんまにありがとう。（${fmtMoney(u.loan.amount)}）` }); }
      else harmonyAdd(g, o, -2, '借りたお金が返ってこない');
      u.loan = null;
    }
    // quirks: a loan request
    const debtor = partners.find((m) => hasQ(m.id, 'shakkin'));
    if (debtor && !u.loanAsk && !u.loan && Math.random() < 0.06) {
      u.loanAsk = { day, amount: [3000, 5000, 10000][Math.floor(Math.random() * 3)], id: debtor.id };
      const P = PEOPLE[debtor.id];
      sendOw(g, o, { from: P.name, person: debtor.id, kind: 'chat', text: isKansai(P) ? 'ちょっと相談があるねん。会えるときに話させて。' : 'ちょっと相談があるんだ。会えるときに話させて。' });
    }
    // a quarrel (low harmony) and, if it is left alone, a 解散 talk
    if (!u.quarrel && u.harmony < 32 && Math.random() < 0.25 && partners.length) {
      const kinds = QUARREL_KINDS.filter((x) => x !== 'late' || partners.some((m) => hasQ(m.id, 'chikoku')));
      u.quarrel = { day, kind: kinds[Math.floor(Math.random() * kinds.length)], with: partners[0].id };
      const P = PEOPLE[partners[0].id];
      partnerMsg(g, o, P.id, isKansai(P) ? '…話がある。稽古場で待っとる。' : '…話があるの。稽古場で待ってる。', true);
      logC(g, o, `${personName(partners[0].id)}とケンカ`);
    }
    if (u.quarrel && !u.dissolveAsk && u.harmony < 14 && day - num(u.quarrel.day) >= 3) {
      u.dissolveAsk = day;
      const P = PEOPLE[partners[0].id];
      partnerMsg(g, o, P.id, isKansai(P) ? '大事な話がある。…これからのことや。会うて話そう。' : '大事な話があるの。…これからのこと。会って話そう。', true);
    }
    // a 解散 talk never happens by itself: the 相方 waits for the talk (a reminder every 10 days)
    if (u.dissolveAsk && day - u.dissolveAsk >= 10 && (day - u.dissolveAsk) % 10 === 0) {
      const P = PEOPLE[partners[0].id];
      partnerMsg(g, o, P.id, isKansai(P) ? 'まだ、ちゃんと話できてへんな。…稽古場で待っとるから。' : 'まだ、ちゃんと話せてないね。…稽古場で待ってるから。', true);
    }
  }
  // 劇場ランク (pros): weekly review of the recent stages
  if (st.agency && weekdayOf(day) === 0) {
    const c = o.career;
    const rec = c.recent.filter((r) => day - r.day <= 14);
    const avg = rec.length ? rec.reduce((a, r) => a + r.score, 0) / rec.length : 0;
    const need = [0, 45, 55, 62, 70, 78, 999][clamp(c.theater, 0, 6)];
    if (rec.length >= 2 && avg >= need - c.oshi * 0.05 && c.theater < THEATER_RANKS.length - 1 && (c.theater < 4 || c.oshi >= 30 + c.theater * 8)) {
      c.theater++;
      c.oshi = clamp(c.oshi + 5, 0, 100);
      logC(g, o, `劇場ランク「${THEATER_RANKS[c.theater].name}」に昇格`);
      sendOw(g, o, { force: true, from: `${(AGENCIES[st.agency] || {}).name || '事務所'} 劇場スタッフ`, kind: 'news', text: `劇場ランクが「${THEATER_RANKS[c.theater].name}」に上がりました！（直近の平均 ${Math.round(avg)}点）` });
    } else if (rec.length >= 2 && avg < need - 18 && c.theater >= 3) {
      c.lowWeeks++;
      if (c.lowWeeks >= 3) { c.theater--; c.lowWeeks = 0; logC(g, o, `劇場ランクが「${THEATER_RANKS[c.theater].name}」に降格`); sendOw(g, o, { from: '劇場スタッフ', kind: 'chat', text: `最近の出番の評価が続けて低かったため、劇場ランクが「${THEATER_RANKS[c.theater].name}」になりました。` }); }
    } else c.lowWeeks = 0;
    c.oshi = clamp(c.oshi - (rec.length ? 0 : 1), 0, 100);
  }
  for (const fn of OW_MORNING) { try { fn(g, o); } catch (e) { console.error('[owarai] morning', e); } }
}
// other owarai files add their morning work here (net replies, NSC fees)
export const OW_MORNING = [nscMorning, netMorning];
onMorning((g) => { try { morning(g); } catch (e) { console.error('[owarai] morning', e); } });

// ================================================================ talk menu entries (any member / candidate)
const isMember = (g, id) => { const o = ensure(g); return !!(o && o.unit && o.unit.members.some((m) => m.id === id)); };
PEOPLE_UI.extras.push({
  id: 'ow_awase', label: 'ネタ合わせする', order: 12, repeat: false,
  cond: (g, id) => isMember(g, id),
  run: async (g) => { await g.owaraiPractice('awase', { skipCheck: true }); },
});
PEOPLE_UI.extras.push({
  id: 'ow_trio', label: 'トリオに誘う', order: 24,
  cond: (g, id) => {
    const o = ensure(g);
    const P = PEOPLE[id];
    if (!o || !o.unit || o.unit.type !== 'combi' || isMember(g, id) || !P || !P.canPartner) return false;
    const c = CANDIDATES[id];
    return c ? !!(o.net.contacts && o.net.contacts[id] && o.net.contacts[id].met) || (c.nsc && o.nsc && o.nsc.campus === c.nsc && ['enrolled', 'graduated'].includes(o.nsc.status)) : g.heartLevel(id) >= 2;
  },
  run: async (g, id) => {
    const c = CANDIDATES[id];
    if (c && c.bar && g.unitPower(c.style) < c.bar && !g.auto) { await g.say(`${personName(id)}「…悪いけど、今の${g.unit().name}には入られへんわ」\n（実力不足：${g.shortfall(c.style, c.bar).text || '実力が足りない'}）`); return 'end'; }
    await g.addUnitMember(id);
    return 'end';
  },
});
PEOPLE_UI.hooks.before.push(async (g, id, npc) => {
  const o = ensure(g);
  if (!o || !o.unit || !isMember(g, id)) return false;
  const u = o.unit;
  if (u.dissolveAsk || (u.quarrel && (u.quarrel.with === id || !u.quarrel.with))) return quarrelScene(g, o, id, npc);
  if (u.loanAsk && u.loanAsk.id === id) return loanScene(g, o, id, npc);
  return false;
});
PEOPLE_UI.hooks.greet.push((g, id) => {
  const o = ensure(g);
  if (!o || !o.unit || !isMember(g, id) || !PEOPLE[id]) return null;
  const k = isKansai(PEOPLE[id]);
  const h = o.unit.harmony;
  if (h >= 75) return k ? '相方！今日もいこか！\nなんや最近、息ぴったりやな。' : '相方！今日もいこう！\nなんだか最近、息ぴったりだね。';
  if (h < 30) return k ? '……おう。' : '……うん。';
  return null;
});

// ================================================================ engine hooks (once)
const COMEDY_MG = { tsukkomi: 'manzai', manzai: 'manzai', zukko: 'conte', conte: 'conte', rakugo: 'rakugo', ogiri: 'ogiri', pinneta: 'pin', talk: 'talk' };
const SKILL_STATS = {
  warai: { _: ['neta', 'boke', 'tsukkomi', 'ma', 'hassou', 'adlib', 'kosei', 'kankyaku'], tsukkomi: ['tsukkomi', 'ma'], manzai: ['ma', 'boke', 'tsukkomi'], zukko: ['act', 'chara'], conte: ['act', 'kosei'], rakugo: ['wagei', 'ma'], ogiri: ['hassou', 'adlib'], pinneta: ['neta', 'hassou'], talk: ['wagei', 'adlib'], quiz: ['hassou'] },
  talk: { _: ['wagei', 'adlib', 'kankyaku', 'voice'] },
  engi: { _: ['act', 'chara', 'mane'] },
};
function installHooks(proto) {
  if (proto.__owaraiHooks) return;
  Object.defineProperty(proto, '__owaraiHooks', { value: true });
  const mg0 = proto.minigame;
  proto.minigame = function minigameOw(id, opts) { this._owMg = id; return mg0.call(this, id, opts); };
  const as0 = proto.addSkill;
  proto.addSkill = function addSkillOw(key, n, silent) {
    const before = this.state && this.state.skills ? num(this.state.skills[key]) : 0;
    const r = as0.call(this, key, n, silent);
    try {
      const d = this.state && this.state.skills ? num(this.state.skills[key]) - before : 0;
      const map = SKILL_STATS[key];
      if (d > 0 && map) {
        const o = ensure(this);
        const list = map[this._owMg] || map._;
        // two stats from the list, rotating so every stat gets its turn
        o.skillTurn = (num(o.skillTurn) + 1) % 1000;
        const picks = list.length <= 2 ? list : [list[o.skillTurn % list.length], list[(o.skillTurn + 3) % list.length]];
        for (const k of picks) growStat(o, k, (d * 0.8) / picks.length);
      }
    } catch (e) { console.error('[owarai] addSkill hook', e); }
    this._owMg = null;
    return r;
  };
  const job0 = proto.job;
  proto.job = async function jobOw(def) {
    const money0 = this.state ? this.state.money : 0;
    const res = await job0.call(this, def);
    try {
      const mg = def && def.minigame;
      let kind = null;
      if (def && def.skill === 'warai') kind = COMEDY_MG[mg] || 'manzai';
      else if (['manzai', 'conte', 'rakugo', 'ogiri', 'pinneta'].includes(mg)) kind = COMEDY_MG[mg];
      if (res && kind) {
        const o = ensure(this);
        const k = o.unit || SOLO_KINDS.has(kind) ? kind : kind === 'manzai' ? 'pin' : kind;
        this.addStageExp(k, 1, res);
        if (o.unit && !SOLO_KINDS.has(k)) o.unit.weekPay = num(o.unit.weekPay) + Math.max(0, this.state.money - money0);
      }
    } catch (e) { console.error('[owarai] job hook', e); }
    return res;
  };
}

// ================================================================ the 所属審査 card (used through g.audition by NSC)
// A "minigame" that only shows a score worked out before (the 卒業公演 and the year at NSC), so the agency entry
// goes through the engine's own g.audition (pass line, transfer question, st.agency, the morning cheers).
class ShinsaCard extends Minigame {
  static title = '所属審査';
  static howto = ['卒業公演と一年間の成績で、所属が決まる'];
  static hd = true;
  static bgm = null;
  update(g) {
    if (this.phase !== 'result') { try { this.init(); } catch (e) { /* none */ } this.phase = 'play'; this.end(num(this.opts.score, 50), this.opts.comment || null); }
    super.update(g);
  }
  drawPlay(ctx) {
    for (let y = 0; y < this.H; y += 12) { ctx.fillStyle = (y / 12) % 2 ? '#22183a' : '#1e1534'; ctx.fillRect(0, y, this.W, 12); }
    panel(ctx, 40, 6, this.W - 80, 44);
    text(ctx, this.opts.head || 'NSC 所属審査', this.W / 2, 16, { size: 18, align: 'center', color: COLORS.accent });
    const parts = (this.opts.parts || []).slice(0, 3);
    if (parts.length) {
      panel(ctx, 40, this.H - 20 - parts.length * 18, this.W - 80, parts.length * 18 + 12);
      parts.forEach((p, i) => text(ctx, p, this.W / 2, this.H - 14 - (parts.length - i) * 18, { size: 12, align: 'center', color: COLORS.text }));
    }
  }
}
if (!MINIGAMES.ow_shinsa) registerMinigame('ow_shinsa', ShinsaCard);

export function installOwarai(proto) {
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(proto, k, Object.getOwnPropertyDescriptor(methods, k));
  installHooks(proto);
}
installOwarai(Game.prototype);

// shared with the other owarai files (they reach the core through these, not through import cycles at load time)
export const OW = { ensure, getO, memberRec, harmonyAdd, growStat, powerOf, shortfallOf, archive, logC, today, sendOw, hasQ, qMult, startHarmony, simPerform };
Game.prototype.__ow = OW;
