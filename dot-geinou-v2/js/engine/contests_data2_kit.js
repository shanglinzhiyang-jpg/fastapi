// 賞レースのデータ その2 (owner: D2b) — shared helpers for contests_data2_defs1.js / _defs2.js.
// Everything here talks to the other reform modules ONLY through the CONTRACT4 g.* API, always
// feature-detected with a local fallback (the other side may still be a stub):
//   g.contestRivals / g.contestJudges / g.contestNews (D1)   → local fictional names when the stub is detected
//   g.perform / g.performSim (C)                              → talk / quiz / rhythm minigames + a local model
//   g.unit / g.unitPower / g.geireki / g.playerAge / g.shortfall / g.addStageExp (A)
//   g.netaList / g.netaQuality (B)
// State: st.contests2 (lazy; old saves fine): { v, seen: {'id:round': 1}, wins: { id: [years] }, paid: { key: day },
//   log: [{ id, year, round, score, place, passed }], flags: {} }.
// Every person named here is fictional (entrants, judges, 進行役, past winners).

import * as C from './contests.js';
const contestDate = (g, day) => C.contestDate(g, day);
import { MINIGAMES, rankFor } from './minigame.js';
import { clamp, mulberry32, YEN_MARK } from './util.js';

export const KIND_LABEL = {
  manzai: '漫才', conte: 'コント', pin: 'ピン芸', rakugo: '落語', ogiri: '大喜利', utaneta: '歌ネタ', monomane: 'ものまね',
  talk: 'トーク', any: 'ジャンル不問', double: '漫才＋コント', kaidan: '怪談',
};

// ------------------------------------------------------------------ state
export function d2(g) {
  const st = g.state || (g.state = {});
  let s = st.contests2;
  if (!s || typeof s !== 'object') s = st.contests2 = {};
  if (!s.v) s.v = 1;
  for (const k of ['seen', 'wins', 'paid', 'flags']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  if (!Array.isArray(s.log)) s.log = [];
  return s;
}

export const yearOf = (g, ctx) => (ctx && Number.isFinite(ctx.year) ? ctx.year : contestDate(g).year);
export function eraKey(y) { return y < 1989 ? 'showa' : y < 2000 ? 'heisei_early' : y < 2019 ? 'heisei' : 'reiwa'; }
export function deviceOf(y) { return y < 1996 ? '電話' : y < 2009 ? 'ケータイ' : 'スマホ'; }
export function streamOf(y) { return y < 2006 ? 'テレビ中継' : y < 2015 ? 'ネット配信' : '配信'; }

// deterministic per contest / year / round (a rerun of the same round gives the same field)
export function rngFor(g, ...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const seed = (g && g.state && Number(g.state.seed)) || 0;
  return mulberry32(((h >>> 0) ^ seed) >>> 0);
}
const pickR = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

// ------------------------------------------------------------------ fictional names (fallbacks)
const SURN = ['森下', '川端', '大西', '坂巻', '上村', '松尾', '三宅', '岡島', '西浦', '田畑', '久保井', '浜野', '柴原', '小野寺', '野々宮',
  '宮脇', '堀之内', '江口', '谷崎', '富永', '石黒', '菅沼', '戸川', '早瀬', '日比野', '若松', '津島', '奥平', '白石', '平賀'];
const GIVEN = ['ひろし', 'けんた', 'さとる', 'まなぶ', 'たかし', 'ゆうき', 'みのる', 'しんじ', 'あきら', 'つよし', 'なおみ', 'さちこ',
  'ゆかり', 'まゆ', 'あやか', 'ちひろ', '健吾', '大輔', '真一', '友和', '涼子', '美紀', '修', '徹', '啓介', '光太郎'];
const COMBI_A = ['湯けむり', 'かぼちゃ', '急行', '冷やし', '三丁目', '大盛り', '月見', '路地裏', '白玉', '花火', '回覧板', '空き缶', '豆電球',
  '鍋焼き', '寝ぐせ', '夕焼け', '木枯らし', '綿あめ', '目覚まし', 'コイン', '金曜', '缶詰', 'ちゃぶ台', '扇風機', '学級', '路面', '駄菓子'];
const COMBI_B = ['ロケット', 'パレード', '劇団', '商会', '倶楽部', 'ステーション', 'ラジオ', 'ポンプ', 'エンジン', 'ジャンクション', '楽団', '食堂',
  '鉄道', '飛行船', '号', 'カーニバル', '工務店', 'ストア', 'ランド', 'ハウス', '通信', 'サイダー'];
const PIN_PRE = ['ぽんぽこ', 'ハイテンション', 'ひとり', 'まっすぐ', '寝不足', 'うっかり', '大声', '前のめり', '三枚目', 'ほろ酔い'];

export function fictionalPerson(r) { return `${pickR(SURN, r)} ${pickR(GIVEN, r)}`; }
export function fictionalUnit(r, type) {
  if (type === 'pin' || (type == null && r() < 0.28)) return `${pickR(PIN_PRE, r)}${pickR(SURN, r)}`;
  return `${pickR(COMBI_A, r)}${pickR(COMBI_B, r)}`;
}

// ------------------------------------------------------------------ the act
export function unitOf(g) {
  try { if (typeof g.unit === 'function') { const u = g.unit(); if (u) return u; } } catch (e) { console.error(e); }
  const st = g.state || {};
  return { id: 'solo', type: 'pin', name: st.name || 'あなた', members: [{ id: 'player', name: st.name, role: 'pin' }], style: 'pin', harmony: 50, amateur: !st.agency, agency: st.agency || null };
}
export const unitName = (g) => unitOf(g).name || (g.state && g.state.name) || 'あなた';
export const memberCount = (u) => (u && Array.isArray(u.members) ? u.members.length : 1);
export function styleKind(g) {
  const u = unitOf(g);
  if (u.type === 'pin' || u.style === 'pin') return 'pin';
  return u.style === 'conte' ? 'conte' : 'manzai';
}
export function geirekiOf(g, y) { try { if (typeof g.geireki === 'function') { const v = g.geireki(y); if (Number.isFinite(v)) return v; } } catch (e) { /* fall back */ } return 0; }
export function ageOf(g, y) {
  try { if (typeof g.playerAge === 'function') { const v = g.playerAge(y); if (Number.isFinite(v)) return v; } } catch (e) { /* fall back */ }
  const p = g.state && g.state.profile; return (p && Number(p.age)) || 20;
}
export function powerOf(g, kind) {
  const k = kind === 'kaidan' ? 'talk' : kind;
  try { if (typeof g.unitPower === 'function') { const v = g.unitPower(k); if (Number.isFinite(v)) return clamp(v, 0, 100); } } catch (e) { /* fall back */ }
  const w = Number(g.state && g.state.skills && g.state.skills.warai) || 0;
  return clamp(Math.round(w * 0.5), 0, 100);
}
// The best quality among the player's scripts of that kind (B), else a rough guess from power.
export function netaQualityOf(g, kind) {
  try {
    if (typeof g.netaList === 'function' && typeof g.netaQuality === 'function') {
      const k = kind === 'kaidan' ? 'talk' : kind;
      const list = g.netaList(k === 'any' ? undefined : k) || [];
      let best = -1;
      for (const n of list.slice(0, 30)) best = Math.max(best, Number(g.netaQuality(n)) || 0);
      if (best >= 0) return best;
    }
  } catch (e) { console.error(e); }
  return clamp(Math.round(powerOf(g, kind) * 0.8 + 8), 0, 100);
}
export function playerAgency(g) { return (g.state && g.state.agency) || null; }
export function isAmateur(g) { const u = unitOf(g); return u.amateur != null ? !!u.amateur : !playerAgency(g); }
// Has the act ever won any contest? (D1's entries + this module's own record)
export function hasAnyTitle(g) {
  const s = d2(g);
  if (Object.values(s.wins).some((a) => Array.isArray(a) && a.length)) return true;
  const e = g.state && g.state.contests && g.state.contests.entries;
  if (e && typeof e === 'object') {
    for (const byYear of Object.values(e)) for (const rec of Object.values(byYear || {})) if (rec && rec.status === 'champion') return true;
  }
  return false;
}

// ------------------------------------------------------------------ D1 hooks with fallbacks
const STUB_RIVAL = /^ライバル\d+$/;
const STUB_JUDGE = /^審査員\d+$/;
// rivals: [{ name, unit, kind, power, quality, tags, agency }]
// roundId may be a sub-stage ('block', 'final2' …): D1 is asked for the real round (opts.d1Round, else the def's
// round with that id, else the final), skipping opts.offset acts so two sub-stages do not meet the same names.
export function rivalsFor(g, ctx, roundId, n, opts = {}) {
  const r = rngFor(g, ctx.id, ctx.year, roundId, 'rivals');
  const level = opts.level ?? 50;
  const rounds = (ctx.def && Array.isArray(ctx.def.rounds)) ? ctx.def.rounds : [];
  const d1Round = opts.d1Round || (rounds.some((x) => x.id === roundId) ? roundId : rounds.length ? rounds[rounds.length - 1].id : roundId);
  const off = Math.max(0, opts.offset | 0);
  let list = [];
  try { if (typeof g.contestRivals === 'function') list = (g.contestRivals(ctx.id, d1Round, n + off, ctx.year) || []).slice(off); } catch (e) { console.error(e); list = []; }
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = list[i] || {};
    const stub = !x.name || STUB_RIVAL.test(x.name);
    const type = x.unit || (opts.pinOnly ? 'pin' : r() < 0.25 ? 'pin' : r() < 0.9 ? 'combi' : 'trio');
    // a field gets stronger round by round (opts.level); D1's own power wins when it is real
    const base = stub || !Number.isFinite(x.power) ? clamp(Math.round(level + (r() - 0.5) * (opts.spread ?? 34)), 5, 98) : clamp(x.power, 0, 100);
    out.push({
      name: stub ? fictionalUnit(r, type) : x.name,
      unit: type, kind: x.kind || opts.kind || 'manzai', power: base,
      quality: Number.isFinite(x.quality) ? x.quality : clamp(Math.round(base + (r() - 0.5) * 20), 0, 100),
      tags: Array.isArray(x.tags) ? x.tags.slice() : [], agency: x.agency || null,
    });
  }
  // a few flavour tags (only on the local ones)
  if (out.length && !out.some((x) => x.tags.length)) {
    out[0].tags.push(ctx.revival ? '復刻を待っていた古参' : '前年王者');
    if (out[1]) out[1].tags.push('初出場');
    if (out[2] && opts.amateurTag !== false) out[2].tags.push('アマチュア');
  }
  return out;
}
// judges: [{ name, title, taste }]
export function judgesFor(g, ctx, n, titles = []) {
  const r = rngFor(g, ctx.id, ctx.year, 'judges');
  let list = [];
  try { if (typeof g.contestJudges === 'function') list = g.contestJudges(ctx.id, ctx.year, n) || []; } catch (e) { console.error(e); list = []; }
  const TASTES = ['構成重視', '勢い重視', '発想重視', '技術重視', '人間味重視', '客席の空気重視'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = list[i] || {};
    const stub = !x.name || STUB_JUDGE.test(x.name);
    // the contest's own roles (when given) win over D1's generic titles; D1's names / tastes are kept
    out.push({ name: stub ? fictionalPerson(r) : x.name, title: (titles.length ? titles[i % titles.length] : x.title) || '審査員', taste: (stub || !x.taste ? pickR(TASTES, r) : x.taste) });
  }
  return out;
}
// opts: 'cat' string or { personal, prio } (D1's contestNews: rate-limited; personal = a notice to the player)
export function news(g, ctx, text, opts = {}) {
  if (!text) return;
  const o = typeof opts === 'string' ? { cat: opts } : opts || {};
  try {
    if (typeof g.contestNews === 'function') g.contestNews(text, { contest: ctx.id, ...o });
    else if (typeof g.message === 'function') g.message({ from: 'お笑いニュース', text, kind: 'news' });
  } catch (e) { console.error(e); }
}

// ------------------------------------------------------------------ performing
// C's real minigames registered? (the skeleton registers none of them)
export const realPerform = () => !!(MINIGAMES.manzai || MINIGAMES.conte || MINIGAMES.pinneta || MINIGAMES.ogiri || MINIGAMES.rakugo);
export function simScore(g, kind, power, quality, r) {
  const k = kind === 'kaidan' ? 'talk' : kind;
  if (realPerform() && typeof g.performSim === 'function') {
    try { const x = g.performSim({ kind: k, power, quality, rng: r }); if (x && Number.isFinite(x.score)) return clamp(Math.round(x.score), 0, 100); } catch (e) { /* local model */ }
  }
  return clamp(Math.round(power * 0.55 + quality * 0.35 + (r() - 0.5) * 22 + 6), 0, 100);
}
function normResult(x, fallbackScore) {
  const score = clamp(Math.round(Number(x && x.score) || fallbackScore || 0), 0, 100);
  const parts = (x && x.parts) || {};
  return {
    score, rank: (x && x.rank) || rankFor(score), laughs: (x && x.laughs) ?? Math.round(score / 8), big: (x && x.big) ?? Math.round(score / 30),
    flubs: (x && x.flubs) || 0, blanks: (x && x.blanks) || 0, overtime: (x && x.overtime) || 0, adlib: (x && x.adlib) || 0,
    heat: Array.isArray(x && x.heat) && x.heat.length ? x.heat : null,
    parts: { neta: parts.neta ?? score, execution: parts.execution ?? score, presence: parts.presence ?? score, timing: parts.timing ?? score, crowd: parts.crowd ?? 50 },
    comment: (x && x.comment) || '', highlights: (x && x.highlights) || [],
  };
}
// A synthetic heat curve (samples 0..100) for meters when the performance gave none.
export function heatCurve(score, r, n = 24) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const arc = Math.sin(t * Math.PI * 0.9 + 0.2) * 0.35 + t * 0.4 + 0.25; // warms up, peaks near the end
    out.push(clamp(Math.round(score * arc + (r() - 0.5) * 26 + (r() < 0.12 ? 22 : 0)), 0, 100));
  }
  return out;
}
// Plays the act on stage. o: { kind, round, length, venue: { name, size, crowd, pressure }, title, style, theme,
//   skip (おまかせ), custom: { id: 'talk'|'quiz'|'rhythm', opts } (used while C's minigame for this kind is missing),
//   useC: minigame id that replaces `custom` once C registers it (e.g. 'pinneta' for ものまね) }.
// Result: CONTRACT4 performance Result (normalized) + { kindPlayed }.
export async function stagePerform(g, ctx, o = {}) {
  const kind = o.kind === 'any' || !o.kind ? styleKind(g) : o.kind;
  const perfKind = kind === 'kaidan' ? 'talk' : kind;
  const r = rngFor(g, ctx.id, ctx.year, o.round || 'r', 'me', g.state && g.state.day);
  const power = powerOf(g, perfKind), quality = netaQualityOf(g, perfKind);
  const sim = simScore(g, perfKind, power, quality, r);
  const contest = { id: ctx.id, round: o.round, name: ctx.def && ctx.def.name };
  const skip = !!o.skip;
  let res;
  try {
    const useCustom = o.custom && !(o.useC ? MINIGAMES[o.useC] : realPerform());
    if (useCustom) {
      if (skip || g.auto) res = normResult(null, sim);
      else {
        const mg = await g.minigame(o.custom.id, { difficulty: o.custom.difficulty ?? 3, ...(o.custom.opts || {}), title: o.title || (o.custom.opts && o.custom.opts.title) });
        // the minigame shows the player's skill on the day; the act's power and script still count
        res = normResult(mg, Math.round(sim * 0.55 + (Number(mg && mg.score) || 0) * 0.45));
        res.score = clamp(Math.round(sim * 0.55 + (Number(mg && mg.score) || 0) * 0.45), 0, 100);
        res.rank = rankFor(res.score);
      }
    } else if (typeof g.perform === 'function') {
      const x = await g.perform({ kind: perfKind, length: o.length, venue: o.venue, contest, title: o.title, skip, style: o.style, theme: o.theme, neta: o.neta });
      res = normResult(x, sim);
      // with the skeleton g.perform the score is only a minigame score: fold the act's real strength in
      if (!realPerform()) { res.score = clamp(Math.round(sim * 0.6 + res.score * 0.4), 0, 100); res.rank = rankFor(res.score); }
    } else res = normResult(null, sim);
  } catch (e) { console.error(e); res = normResult(null, sim); }
  if (!res.heat) res.heat = heatCurve(res.score, r);
  if (o.length && res.overtime === 0 && !realPerform() && r() < 0.12 && res.score < 55) res.overtime = 2 + Math.floor(r() * 9);
  res.kindPlayed = kind;
  try { if (typeof g.addStageExp === 'function') g.addStageExp(perfKind, 1); } catch (e) { /* optional */ }
  return res;
}

// Concrete 実力不足 reasons for a result (CONTRACT4 g.shortfall + what happened on stage).
export function failReasons(g, kind, res, need = 55) {
  const out = [];
  if (res) {
    if (res.overtime > 0) out.push(`尺オーバー（${res.overtime}秒）`);
    if (res.flubs > 0) out.push(`噛み ${res.flubs}回`);
    if (res.blanks > 0) out.push('ネタが飛んだ');
    const p = res.parts || {};
    if (p.neta < 45) out.push('ネタの構成が弱い（ツカミ〜オチの流れ）');
    if (p.timing < 45) out.push('間・テンポが走った');
    if (p.presence < 40) out.push('声量・華が客席の後ろまで届かない');
    if (p.crowd < 40) out.push('客層とネタが合わなかった');
  }
  try {
    if (typeof g.shortfall === 'function') {
      const sf = g.shortfall(kind === 'kaidan' ? 'talk' : kind === 'any' || kind === 'double' ? styleKind(g) : kind, need);
      if (sf && Array.isArray(sf.gaps)) for (const x of sf.gaps.slice(0, 2)) out.push(`${x.label}が足りない（${Math.round(x.have)}／目安${x.need}）`);
    }
  } catch (e) { /* optional */ }
  if (!out.length) out.push('ほんの少し、ほかの組の爆発力が上だった');
  return out.slice(0, 4);
}

// ------------------------------------------------------------------ judging a round
// Judges a round: D1's simulated field when available (see d1Field), else a sample of rivals around the player's score.
// opts: { field, pass (share < 1 | count), sample, level, spread, kind, pinOnly, d1: false (force the local sample) }
// → { place, field, passed, passCount, rows: [{ name, score, me, tags }], top, cutoff }
// When D1's simulated field exists (contests.js internals: simOf / toFieldScore) and roundId is a real round of the def,
// the round is judged against THAT field (the same one D1's history, news and 大会一覧 show): the player's performance
// score is mapped onto the field scale and compared with the named entrants (+ the anonymous mass for big 予選).
function d1Field(g, ctx, roundId, myScore) {
  const I = C.internals;
  if (!I || typeof I.simOf !== 'function' || typeof I.toFieldScore !== 'function' || !g.state) return null;
  const rounds = (ctx.def && ctx.def.rounds) || [];
  const idx = rounds.findIndex((r) => r.id === roundId);
  if (idx < 0) return null;
  let sim = null;
  try { sim = I.simOf(g, ctx.id, ctx.year); } catch (e) { return null; }
  const rd = sim && sim.rounds && sim.rounds[idx];
  if (!rd || !rd.scores || !Array.isArray(rd.sorted)) return null;
  const fs = clamp(Number(I.toFieldScore(g, myScore)) || 0, 0, 100);
  const nameOf = (aid) => ((sim.byId && sim.byId.get(aid)) || {}).name || '？';
  const named = rd.sorted.filter((aid) => aid !== 'player').map((aid) => ({ name: nameOf(aid), score: Math.round(Number(rd.scores.get(aid)) || 0), tags: [], unit: ((sim.byId && sim.byId.get(aid)) || {}).type }));
  const above = named.filter((x) => x.score > fs).length;
  let passed, place, field, passCount;
  if (rd.exact) {
    field = named.length + 1;
    passCount = Math.max(1, Number(rd.P) || 1);
    place = above + 1;
    passed = place <= passCount;
  } else {
    const ms = rd.anonInMS || rd.anonMS || { mS: 30, sS: 12 };
    const PHI = typeof I.PHI === 'function' ? I.PHI : normCdf;
    const anonAbove = rd.anonIn > 0 ? rd.anonIn * (1 - PHI((fs - ms.mS) / Math.max(1, ms.sS))) : 0;
    field = Math.max(2, Number(rd.E) || named.length + 1);
    passCount = Math.max(1, Number(rd.P) || 1);
    place = clamp(Math.round(above + anonAbove + 1), 1, field);
    passed = fs >= rd.cut;
  }
  const me = { name: unitName(g), score: Math.round(fs), me: true, tags: [] };
  const rows = [...named, me].sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
  return { place, field, passed, passCount, rows, top: rows.find((x) => !x.me) || rows[0], cutoff: Math.round(Number(rd.cut) || 0), d1: true, fs };
}

export function judgeField(g, ctx, roundId, myScore, opts = {}) {
  if (opts.d1 !== false) { try { const x = d1Field(g, ctx, roundId, myScore); if (x) return x; } catch (e) { console.error(e); } }
  const field = Math.max(2, Math.round(opts.field || 20));
  const passCount = opts.pass == null ? Math.max(1, Math.round(field * 0.3)) : opts.pass < 1 ? Math.max(1, Math.round(field * opts.pass)) : Math.round(opts.pass);
  const n = Math.min(field - 1, opts.sample || 24);
  const r = rngFor(g, ctx.id, ctx.year, roundId, 'field');
  const rivals = rivalsFor(g, ctx, roundId, n, opts);
  const rows = rivals.map((x) => ({ name: x.name, score: simScore(g, opts.kind || x.kind, x.power, x.quality, r), tags: x.tags, unit: x.unit }));
  const me = { name: unitName(g), score: myScore, me: true, tags: [] };
  rows.push(me);
  rows.sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0));
  const idx = rows.indexOf(me);
  // with a big field the sample stands for everyone: the place comes from the sampled rivals' score
  // distribution (normal approximation), so a 1-in-1000 act can still be 1st of 1000
  let place = idx + 1;
  if (field > rows.length) {
    const xs = rows.filter((x) => !x.me).map((x) => x.score);
    const mu = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const sd = Math.max(4, Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, xs.length)));
    place = clamp(1 + Math.round((field - 1) * (1 - normCdf((myScore - mu) / sd))), 1, field);
  }
  const passed = place <= passCount;
  const cut = rows[Math.min(rows.length - 1, Math.max(0, Math.round((passCount / field) * rows.length) - 1))];
  return { place, field, passed, passCount, rows, top: rows[0], cutoff: cut ? cut.score : 0 };
}

function normCdf(z) {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Points from a panel of judges: each judge's score scatters around the act's score by taste.
// → { total, max, per: [{ judge, score }] }
export function panelPoints(g, ctx, roundId, score, judges, perMax = 100, who = 'me') {
  const r = rngFor(g, ctx.id, ctx.year, roundId, 'panel', who);
  const per = judges.map((j) => {
    const base = 55 + (score - 50) * 0.75;
    const v = clamp(Math.round((base + (r() - 0.5) * 12) * (perMax / 100)), Math.round(perMax * 0.3), perMax);
    return { judge: j, score: v };
  });
  return { total: per.reduce((a, x) => a + x.score, 0), max: perMax * judges.length, per };
}

// ------------------------------------------------------------------ pacing / rewards / records
// First time a round is seen it plays in full; later the player may choose おまかせ (simulate).
export async function askSkip(g, ctx, roundId) {
  const s = d2(g);
  const key = `${ctx.id}:${roundId}`;
  // D1's runner already asked how to go on (ctx.mode 'full' | 'quick' | 'auto'): 'auto' = おまかせ (simulated)
  if (ctx && typeof ctx.mode === 'string') { s.seen[key] = s.seen[key] || (g.state ? g.state.day : 1); return ctx.mode === 'auto'; }
  if (!s.seen[key]) { s.seen[key] = g.state ? g.state.day : 1; return false; }
  if (g.auto) return !!g.auto.skip;
  const i = await g.ask('この舞台は前にも経験している。', ['自分で演じる', 'おまかせで進める（結果だけ見る）'], { cancel: 0 });
  return i === 1;
}
// Pays an EXTRA reward once per contest-year-key (D1's runner already pays fame / fans / def.prize for the recorded
// result: use this only for what D1 cannot know — 奨励賞 money, 得点×1万円, 文芸部門賞 …). → true when paid now.
export function grant(g, ctx, key, rw = {}) {
  const s = d2(g);
  const k = `${ctx.id}:${ctx.year}:${key}`;
  if (s.paid[k]) return false;
  s.paid[k] = (g.state && g.state.day) || 1;
  try {
    if (rw.fame && typeof g.addFame === 'function') g.addFame(rw.fame);
    if (rw.fans && typeof g.addFans === 'function') g.addFans(rw.fans);
    // rw.money is a REAL nominal amount of that year (D1's rule): stored as amount / era price rate
    if (rw.money && typeof g.addMoney === 'function') g.addMoney(typeof C.realToInternal === 'function' ? C.realToInternal(rw.money) : rw.money);
    if (rw.stress && typeof g.lifeTick === 'function') g.lifeTick({ stress: rw.stress });
  } catch (e) { console.error(e); }
  return true;
}
export function record(g, ctx, roundId, res) {
  const s = d2(g);
  s.log.unshift({ id: ctx.id, year: ctx.year, round: roundId, score: res.score, place: res.place ?? null, passed: !!res.passed, day: (g.state && g.state.day) || 0 });
  if (s.log.length > 120) s.log.length = 120;
  if (res.champion) { const w = s.wins[ctx.id] || (s.wins[ctx.id] = []); if (!w.includes(ctx.year)) w.push(ctx.year); }
}
// A round result in the shape D1's runner records (plus extras).
export function roundResult(res, extra = {}) {
  const score = Math.round(res && Number.isFinite(res.score) ? res.score : 0);
  const out = { score, rank: rankFor(score), passed: false, place: null, field: null, comment: '', reasons: [], perf: res || null, ...extra };
  if (out.of == null && out.field != null) out.of = out.field; // D1's record() reads res.of
  return out;
}

// The round def from ctx (D1 may pass the round object or its id).
export function roundOf(ctx, fallbackId) {
  const def = ctx && ctx.def;
  if (ctx && ctx.round && typeof ctx.round === 'object') return ctx.round;
  const id = (ctx && ctx.round) || fallbackId;
  return (def && Array.isArray(def.rounds) && def.rounds.find((x) => x.id === id)) || { id };
}
// Edition label: 「第12回」 / 「第12回（復刻開催）」
export function edLabel(ctx) {
  if (!ctx || !ctx.edition) return '';
  return `第${ctx.edition}回${ctx.revival ? '（復刻開催）' : ''}`;
}
// Converts a 0..100 performance score into the contest's own display scale.
export const toScale = (score, max) => Math.round((clamp(score, 0, 100) / 100) * max);
// a REAL nominal amount in text: YEN_MARK keeps g.fmt / yenText from rescaling it by the era's price rate (D1's rule)
export const yen = (n) => `${YEN_MARK}${Math.round(n).toLocaleString('ja-JP')}円`;
