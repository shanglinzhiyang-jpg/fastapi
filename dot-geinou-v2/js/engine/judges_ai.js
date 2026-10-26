// 審査員AI — the judge agent model [R11-J]. Pure JS: no DOM, no network, no game imports (node imports it for the tests).
//
// Every judge of the game (the 5 script judges of neta_ai.js, the pool judges of contests.js, M-1's and KOC's own panels) is an AGENT:
//   * a STABLE part derived from the save seed + the judge's name (traits: fair 公平さ / open 流行への敏感さ / mem 記憶力 / stub 頑固さ /
//     warm 甘さ / mellow 円熟; a base taste vector over 6 dimensions) — never saved, recomputed identically after a reload;
//   * a taste that DRIFTS (styleAt): scene trend (a seeded AR(1) fashion per dimension + what the recent champions did) × openness,
//     age (veterans turn conservative / mellow), generation (a successor inherits the mentor's taste, then mutates);
//   * a small SAVED state (st.jai): the seats of the script panel (who sits there now, since when, until when), a ring of the
//     player's scripts seen, per-judge fondness / bar / fatigue / last comments, a champions-of-the-year record, a news log.
// Taste is a vector over 6 DIMS: 構成 発想 言葉 テンポ 華・熱量 新しさ. Script AXES (neta_ai.js) and performance PARTS (perform.js:
// timing neta execution presence crowd) both map onto it, so one drifting taste serves every kind of judging.
// Deterministic: no Math.random anywhere — only strHash/rngOf streams of (seed, name, year, day). Bounded: every drift is clamped.

import { strHash, rngOf, gauss, personName, isRealNameLike } from './contests_gen.js';

export const VERSION = 1;
export const DIMS = ['kousei', 'hassou', 'kotoba', 'tempo', 'hana', 'atarashi'];
export const DIM_JP = { kousei: '構成', hassou: '発想', kotoba: '言葉', tempo: 'テンポ', hana: '華・熱量', atarashi: '新しさ' };
export const DIM_VERB = { kousei: '組み立て', hassou: '発想', kotoba: '言葉', tempo: 'テンポ', hana: '華', atarashi: '新しさ' };
export const AXIS_DIM = {
  kousei: 'kousei', tsukami: 'kousei', shaku: 'kousei', tendon: 'kousei', sage: 'kousei', settei: 'kousei',
  hassou: 'hassou', uragiri: 'hassou', kyori: 'hassou', nisete: 'hassou',
  kotoba: 'kotoba', tsukkomi: 'kotoba', enji: 'kotoba', mijika: 'kotoba', uta: 'kotoba',
  tempo: 'tempo', chara: 'hana', rinjou: 'hana', hitori: 'hana', dokuji: 'atarashi',
};
export const PARTS = ['timing', 'neta', 'execution', 'presence', 'crowd'];
export const PART_JP = { timing: '間・ツカミ', neta: 'ネタ', execution: '技術', presence: '華・存在感', crowd: '客席の反応' };
const PART_DIM = {
  timing: { tempo: 0.7, kousei: 0.3 }, neta: { kousei: 0.5, hassou: 0.5 }, execution: { kotoba: 0.8, tempo: 0.2 },
  presence: { hana: 0.8, atarashi: 0.2 }, crowd: { hana: 0.5, tempo: 0.5 },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
export const h01 = (...p) => strHash(p.join('|')) / 4294967296;
const r2 = (v) => Math.round(v * 100) / 100;
const r4 = (v) => Math.round(v * 10000) / 10000;
const vec = (o, d = 0.45) => DIMS.map((k) => (o && Number.isFinite(o[k]) ? o[k] : d));

// ------------------------------------------------------------------ taste tables (ids of contests_gen / koc_data and M-1's styles)
const TASTE_STY = {
  // contests_gen TASTES
  tsukami: { tempo: 0.85, kousei: 0.6 }, kousei: { kousei: 0.9 }, atarashisa: { atarashi: 0.9, hassou: 0.7 }, gijutsu: { kotoba: 0.85, tempo: 0.55 },
  hana: { hana: 0.9, atarashi: 0.55 }, ma: { tempo: 0.9, kotoba: 0.6 }, netsuryo: { hana: 0.85, tempo: 0.6 }, kyaku: { tempo: 0.65, hana: 0.7 },
  // koc_data TASTES
  engi: { kotoba: 0.7, hana: 0.7 }, hassou: { hassou: 0.9, atarashi: 0.6 }, warai: { hana: 0.7, tempo: 0.7 }, sekai: { hana: 0.85, atarashi: 0.6 },
  // M-1 styles / tastes (m1_data.js)
  しゃべくり: { kotoba: 0.85, tempo: 0.6 }, 正統派: { kousei: 0.7, kotoba: 0.7 }, 人間味: { hana: 0.9 }, 構成: { kousei: 0.95 }, 話芸: { kotoba: 0.95 },
  コント漫才: { hassou: 0.7, kousei: 0.65, hana: 0.6 }, テンポ: { tempo: 0.95 }, 新しさ: { atarashi: 0.95, hassou: 0.7 }, ボケ数: { tempo: 0.8, hana: 0.55 },
  システム: { kousei: 0.7, hassou: 0.8, atarashi: 0.7 }, 変則: { atarashi: 0.85, hassou: 0.75 },
  // generic words (contests_data2_kit's tastes)
  構成重視: { kousei: 0.9 }, 勢い重視: { hana: 0.8, tempo: 0.7 }, 発想重視: { hassou: 0.9, atarashi: 0.6 }, 技術重視: { kotoba: 0.85, tempo: 0.55 }, 人間味重視: { hana: 0.9 }, 客席の空気重視: { tempo: 0.65, hana: 0.7 },
};
const ACT_STY = {
  manzai: { kousei: 0.5, hassou: 0.45, kotoba: 0.7, tempo: 0.75, hana: 0.5, atarashi: 0.35 }, conte: { kousei: 0.75, hassou: 0.75, kotoba: 0.4, tempo: 0.5, hana: 0.6, atarashi: 0.6 },
  both: { kousei: 0.62, hassou: 0.6, kotoba: 0.55, tempo: 0.62, hana: 0.55, atarashi: 0.48 }, pin: { kousei: 0.4, hassou: 0.75, kotoba: 0.5, tempo: 0.5, hana: 0.8, atarashi: 0.7 },
  flip: { kousei: 0.45, hassou: 0.7, kotoba: 0.55, tempo: 0.55, hana: 0.7, atarashi: 0.6 }, mandan: { kousei: 0.5, hassou: 0.5, kotoba: 0.8, tempo: 0.5, hana: 0.6, atarashi: 0.4 },
  utaneta: { kousei: 0.45, hassou: 0.55, kotoba: 0.5, tempo: 0.6, hana: 0.8, atarashi: 0.5 }, monomane: { kousei: 0.35, hassou: 0.5, kotoba: 0.4, tempo: 0.55, hana: 0.8, atarashi: 0.45 },
  rakugo: { kousei: 0.65, hassou: 0.4, kotoba: 0.95, tempo: 0.35, hana: 0.5, atarashi: 0.2 },
};
export const tasteVec = (idOrLabel) => (TASTE_STY[idOrLabel] ? vec(TASTE_STY[idOrLabel]) : null);
// the style vector of an act (a rival of D1's world, an M-1 pool act …): its style word + a small personal noise
export function actVec(seed, act) {
  const word = act && (ACT_STY[act.style] ? act.style : TASTE_STY[act && act.style] ? null : null);
  const base = word ? ACT_STY[word] : act && TASTE_STY[act.style] ? TASTE_STY[act.style] : ACT_STY.manzai;
  const id = (act && (act.id || act.name)) || '?';
  return DIMS.map((k, i) => clamp((base[k] ?? 0.45) + (h01(seed, 'act', id, i) - 0.5) * 0.24, 0.05, 0.97));
}
// the vector of a performance from its parts (perform.js: deviations from the mean show what the act is good at)
export function partsVec(parts, score = 60) {
  if (!parts) return DIMS.map(() => 0.5);
  const out = DIMS.map(() => 0.5);
  for (const p of PARTS) {
    if (!Number.isFinite(parts[p])) continue;
    const dev = clamp((parts[p] - score) / 40, -0.5, 0.5);
    for (const [k, w] of Object.entries(PART_DIM[p])) out[DIMS.indexOf(k)] += dev * w * 0.9;
  }
  return out.map((v) => clamp(v, 0.05, 0.97));
}
// parts of a rival performance (it has no perform.js result): deviations from its score that follow its style
export function simParts(v, score) {
  const out = {};
  for (const p of PARTS) {
    let d = 0;
    for (const [k, w] of Object.entries(PART_DIM[p])) d += (v[DIMS.indexOf(k)] - 0.5) * 2 * w;
    out[p] = score + d * 11;
  }
  return out;
}
// how much a judge's taste has moved the way an act is: Σ (now − debut) × (act − the field's average style), so the average act gains nothing
export function driftFit(sNow, sBase, av) {
  let s = 0;
  for (let i = 0; i < DIMS.length; i++) s += (sNow[i] - sBase[i]) * (av[i] - FIELD_MEAN[i]);
  return s * 4;
}
// how well a judge's taste (style vector) fits an act (-1.5 … +1.5; 0 for the average)
export function fit(js, av) {
  let s = 0;
  for (let i = 0; i < DIMS.length; i++) s += (js[i] - 0.5) * (av[i] - 0.5);
  return clamp(s * 4, -1.5, 1.5);
}

// ------------------------------------------------------------------ state
export function jstate(st) {
  if (!st) return null;
  let J = st.jai;
  if (!isObj(J)) J = st.jai = { v: VERSION };
  if (J._ok === st) return J;
  if (!Number.isFinite(J.y0)) J.y0 = 0;
  if (!Number.isFinite(J.seed)) J.seed = 0;
  if (!isObj(J.seats)) J.seats = {};
  if (!isObj(J.ag)) J.ag = {};
  if (!Array.isArray(J.pl)) J.pl = [];
  if (!Array.isArray(J.log)) J.log = [];
  if (!isObj(J.sc)) J.sc = {};
  if (!Array.isArray(J.sc.ch)) J.sc.ch = [];
  if (!isObj(J.rel)) J.rel = {};
  if (!isObj(J.sent)) J.sent = {};
  if (!Number.isFinite(J.sv)) J.sv = 0;
  J.v = VERSION;
  Object.defineProperty(J, '_ok', { value: st, enumerable: false, configurable: true, writable: true });
  return J;
}
// first use: the reference year (taste drift is 0 there, so a fresh game judges exactly like the plain tables) and the seed.
// Both come from the save itself (its era and the player's name), so every module that starts the system agrees; a save whose era was
// changed (tests) starts the world over.
const ERA_FIRST = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
export const firstYear = (st) => ERA_FIRST[st && st.profile && st.profile.era] || 2026;
export function initState(st) {
  let J = jstate(st);
  if (!J) return null;
  const era = (st.profile && st.profile.era) || 'reiwa';
  if (J.era && J.era !== era) { delete st.jai; J = jstate(st); }
  if (!J.y0) { J.y0 = firstYear(st); J.era = era; }
  if (!J.seed) J.seed = (strHash(`${st.name || 'p'}|jai|${era}`) | 0) || 1;
  return J;
}
export const bump = (J) => { J.sv = (J.sv || 0) + 1; };

// ------------------------------------------------------------------ the scene (fashion + what recent champions did)
const FASH = new Map();
export function fashion(seed, dim, year) {
  const n = clamp(Math.round(year) - 1960, 0, 170);
  const key = `${seed}|${dim}`;
  let s = FASH.get(key);
  if (!s) { s = [0]; FASH.set(key, s); if (FASH.size > 60) FASH.delete(FASH.keys().next().value); }
  while (s.length <= n) { const t = s.length; s.push(clamp(s[t - 1] * 0.92 + 0.022 * clamp(gauss(rngOf(seed, 'fash', dim, t)), -2, 2), -0.2, 0.2)); }
  return s[n];
}
const FIELD_MEAN = [0.54, 0.55, 0.62, 0.65, 0.57, 0.44];
export const STYLE_CODES = ['manzai', 'conte', 'pin', 'rakugo', 'other'];
const CHAMP_FX = [
  { tempo: 0.022, kotoba: 0.018, hana: 0.008 }, { kousei: 0.022, hassou: 0.022 }, { hassou: 0.022, hana: 0.015, atarashi: 0.018 },
  { kotoba: 0.028, kousei: 0.008 }, { atarashi: 0.015 },
];
// scene trend vector in a year: fashion + the champions recorded before that year (a one-year lag, decay 0.8 a year, 9 years).
// A champion entry is [year, code, dev] — dev: the champion act's style as deviations from the middle (×100), or null (then the kind's plain effect).
export function sceneAt(J, year) {
  const seed = J.seed || 1;
  const out = DIMS.map((k) => fashion(seed, k, year));
  for (const [y, code, dev] of J.sc.ch) {
    const age = year - y;
    if (age < 2 || age > 9) continue; // a one-year lag: the judges of a year never depend on a result that the year itself decides
    const w = (0.8 ** (age - 2)) / Math.sqrt(J.sc.ch.filter(([yy]) => yy === y).length || 1);
    if (Array.isArray(dev)) { DIMS.forEach((k, i) => { out[i] += (dev[i] / 100) * 0.1 * w; }); continue; }
    const fx = CHAMP_FX[code] || CHAMP_FX[4];
    DIMS.forEach((k, i) => { out[i] += (fx[k] || 0) * w; });
  }
  return out.map((v) => clamp(v, -0.4, 0.4));
}
// which kinds are in favour: recent champions' style shares → -1 … +1 per kind (manzai conte pin rakugo)
export function kindFavor(J, kind, year) {
  const code = { manzai: 0, conte: 1, pin: 2, rakugo: 3 }[kind];
  if (code == null) return 0;
  const recent = J.sc.ch.filter(([y]) => year - y >= 1 && year - y <= 6);
  if (recent.length < 2) return 0;
  const share = recent.filter(([, c]) => c === code).length / recent.length;
  return clamp((share - 0.34) * 1.8, -1, 1);
}
export function recordChampion(J, year, style, v) {
  const code = ({ manzai: 0, combi: 0, both: 0, conte: 1, pin: 2, flip: 2, mandan: 2, utaneta: 2, monomane: 2, rakugo: 3 })[style];
  const c = code == null ? 4 : code;
  const dev = Array.isArray(v) ? v.map((x, i) => Math.round(clamp((x - FIELD_MEAN[i]) * 100, -50, 50))) : null; // relative to the average style of the field (mostly 漫才)
  if (J.sc.ch.some(([y, k, d]) => y === year && k === c && JSON.stringify(d || null) === JSON.stringify(dev))) return false;
  J.sc.ch.push(dev ? [year, c, dev] : [year, c]);
  J.sc.ch.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (J.sc.ch.length > 30) J.sc.ch.splice(0, J.sc.ch.length - 30);
  bump(J);
  return true;
}

// ------------------------------------------------------------------ agents (stable part)
// desc = { key, scope, name, title?, y0 (debut year in this game; <= J.y0 means "since before"), b? (base vector), taste? (id / label), tr? }
export function traitsOf(seed, key, inherit) {
  const t = {
    fair: clamp(0.35 + h01(seed, 'fair', key) * 0.6, 0.3, 0.97), open: clamp(0.4 + h01(seed, 'open', key) * 0.8, 0.4, 1.2), mem: clamp(0.5 + h01(seed, 'mem', key) * 0.7, 0.5, 1.2),
    stub: clamp(h01(seed, 'stub', key), 0, 1), warm: clamp(h01(seed, 'warm', key) - 0.5, -0.5, 0.5), mellow: clamp(h01(seed, 'mellow', key), 0, 1),
  };
  if (inherit) for (const k of Object.keys(t)) if (Number.isFinite(inherit[k])) t[k] = clamp(0.6 * inherit[k] + 0.4 * t[k], k === 'open' ? 0.4 : k === 'mem' ? 0.5 : k === 'fair' ? 0.3 : -0.5, k === 'open' || k === 'mem' ? 1.2 : 1);
  return t;
}
export function baseVec(seed, key, taste) {
  const t = (taste && TASTE_STY[taste]) || null;
  return DIMS.map((k, i) => clamp((t && Number.isFinite(t[k]) ? t[k] : 0.42) + (h01(seed, 'base', key, i) - 0.5) * 0.14, 0.08, 0.95));
}
// a descriptor: everything stable about a judge in this world
export function descOf(J, spec) {
  const seed = J.seed || 1;
  const key = spec.key || `${spec.scope || 'c'}:${spec.name}`;
  const y0 = Number.isFinite(spec.y0) ? Math.max(spec.y0, J.y0 || spec.y0) : J.y0;
  return {
    key, scope: spec.scope || 'c', name: spec.name, title: spec.title || '', taste: spec.taste || '', y0,
    b: spec.b || baseVec(seed, key, spec.taste), tr: spec.tr || traitsOf(seed, key), id: spec.id, seat: spec.seat || null,
  };
}
const AGE_FX = { kousei: 0.004, kotoba: 0.004, atarashi: -0.005, hana: -0.002, hassou: -0.001, tempo: -0.001 };
// the judge's taste in a year (drift = scene change since their debut × openness + the veteran's age)
export function styleAt(J, d, year) {
  if (year <= d.y0) return d.b.slice(); // before the debut (and before the game began) nothing has drifted: the shared past stays shared
  const t1 = sceneAt(J, year), t0 = sceneAt(J, d.y0);
  const yrs = clamp(year - d.y0, 0, 30);
  return DIMS.map((k, i) => clamp(d.b[i] + d.tr.open * (t1[i] - t0[i]) + (AGE_FX[k] || 0) * yrs * (0.5 + d.tr.mellow), 0.05, 0.97));
}
export const driftOf = (J, d, year) => { const a = styleAt(J, d, year), b = d.b; return a.map((v, i) => r2(v - b[i])); };
// the taste history for the little chart: [[year, vec]…], at most n points ending at `year`
export function history(J, d, year, n = 14) {
  const from = Math.max(J.y0 || year, d.y0 || year, year - n + 1);
  const out = [];
  for (let y = from; y <= year; y++) out.push([y, styleAt(J, d, y)]);
  if (!out.length) out.push([year, styleAt(J, d, year)]);
  return out;
}
// the most prominent dimensions of a vector
export function topDims(v, n = 2) { return DIMS.map((k, i) => [k, v[i]]).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]); }
// a short label: 「構成派」 style; the dominant dimension (with a margin) else 「バランス型」
const SCHOOL = { kousei: '構成派', hassou: '発想派', kotoba: '言葉派', tempo: 'テンポ派', hana: '大衆派', atarashi: '新しさ派' };
export function schoolOf(v) {
  const o = DIMS.map((k, i) => [k, v[i]]).sort((a, b) => b[1] - a[1]);
  return o[0][1] - o[1][1] >= 0.04 ? SCHOOL[o[0][0]] : `${SCHOOL[o[0][0]].replace('派', '')}・${SCHOOL[o[1][0]].replace('派', '')}寄り`;
}
// what moved the most since the debut, in words (null when nothing did)
export function driftNote(J, d, year) {
  const dr = driftOf(J, d, year);
  let bi = 0;
  dr.forEach((v, i) => { if (Math.abs(v) > Math.abs(dr[bi])) bi = i; });
  if (Math.abs(dr[bi]) < 0.04) return null;
  return `${DIM_JP[DIMS[bi]]}を${dr[bi] > 0 ? '重視' : '軽視'}（${dr[bi] > 0 ? '+' : ''}${Math.round(dr[bi] * 100)}）`;
}
// the performance-parts mix of a judge (sums to 0.25 like the plain `(parts[tastePart] − score) × 0.25`): the plain one-hot at the debut
// (drift 0), moving with the drift
export function partMix(J, d, year, tastePart) {
  const one = {};
  for (const p of PARTS) one[p] = p === tastePart ? 1 : 0;
  const dr = driftOf(J, d, year);
  if (dr.every((v) => Math.abs(v) < 0.005)) return null;
  const m = {};
  let sum = 0;
  for (const p of PARTS) {
    let x = one[p];
    for (const [k, w] of Object.entries(PART_DIM[p])) { const v = dr[DIMS.indexOf(k)]; x += (v > 0 ? 2.5 : 1.2) * v * w; }
    m[p] = Math.max(0, x);
    sum += m[p];
  }
  if (sum <= 0) return null;
  for (const p of PARTS) m[p] = (m[p] / sum) * 0.25;
  return m;
}
// mellowing: a veteran gets milder the longer they sit (points on a 100-scale judge's `strict`, positive = generous)
export function mellowShift(d, year) { return clamp((d.tr.mellow - 0.4) * 0.09 * clamp(year - d.y0, 0, 25), -1.2, 1.4); }

// ------------------------------------------------------------------ goals (each judge has one main goal, with progress)
// chosen by traits: the curious (流行に敏感) look for new talent, the mellow prepare to hand the seat on, the rest guard the standard.
export function goalOf(d, ag, year) {
  const tr = d.tr;
  const pr = ag ? num(ag.pr) : 0;
  if (tr.open >= 0.95) return { id: 'discover', label: '新しい才能を見つけたい', progress: clamp(pr / 5, 0, 1), note: pr ? `これまでに${pr}回、伸びる芸を見つけた` : 'まだ見つけていない' };
  if (tr.mellow >= 0.6) { const served = Math.max(0, year - d.y0) + (d.pre || 0); return { id: 'legacy', label: '後進に席を譲る準備をしたい', progress: clamp(served / 12, 0, 1), note: `この席に座って${served + 1}年目` }; }
  const br = ag ? num(ag.br) : 0;
  return { id: 'standard', label: '審査の水準を守りたい', progress: clamp(br / 100, 0, 1), note: br >= 40 ? 'よい芸を見て、水準が上がっている' : '厳しい目を保っている' };
}

// ------------------------------------------------------------------ mood (a smooth deterministic wave per judge and day)
export function moodOf(J, key, day) {
  const seed = J.seed || 1;
  const a = h01(seed, 'm1', key) * 6.283, b = h01(seed, 'm2', key) * 6.283;
  return clamp(0.62 * Math.sin(day / 13 + a) + 0.38 * Math.sin(day / 4.7 + b), -1, 1);
}
export const moodWord = (m) => (m > 0.45 ? '上機嫌' : m > 0.12 ? '機嫌がいい' : m < -0.45 ? '不機嫌' : m < -0.12 ? '少し辛口の気分' : 'ふつう');

// ------------------------------------------------------------------ agents (saved part, lazy)
export function agentOf(J, key, create = true) {
  let a = J.ag[key];
  if (!a && create) {
    const keys = Object.keys(J.ag);
    if (keys.length >= 70) { // evict the least recently active
      let old = keys[0];
      for (const k of keys) if (num(J.ag[k].l) < num(J.ag[old].l)) old = k;
      delete J.ag[old];
    }
    a = J.ag[key] = { fo: 0, br: 0, fa: 0, fd: 0, se: 0, l: 0, cm: [] };
  }
  return a || null;
}
export const ctr = (a, k, d = 0) => num(a && a[k], d);

// ------------------------------------------------------------------ the script panel: five seats with careers
// base seats come from neta_ai.js JUDGES (passed in so this file stays free of imports of it): [{ id, name, title, taste, w, bias, spread }]
const SEAT_TITLE_POOL = {
  dan: ['放送作家', '構成作家', 'テレビ作家'], tobishima: ['ベテラン漫才師', 'ベテランコント師', '元・漫才師'], koiki: ['落語家', '講談師', '演芸作家'],
  emihara: ['劇場支配人', '劇場プロデューサー', '寄席の席亭'], shindo: ['お笑い評論家', '演芸評論家', 'お笑いコラムニスト'],
};
const SEAT_PERSON = { dan: 'm', tobishima: 'm', koiki: 'm', emihara: 'f', shindo: 'm' };
function dimsOfW(w) {
  const sum = {}, cnt = {};
  for (const [a, k] of Object.entries(AXIS_DIM)) { sum[k] = (sum[k] || 0) + (w[a] || 1); cnt[k] = (cnt[k] || 0) + 1; }
  return DIMS.map((k) => clamp(0.5 + (sum[k] / cnt[k] - 1.3) * 0.28, 0.1, 0.95));
}
const tenureOf = (seed, id, gen) => 6 + Math.floor(h01(seed, 'tenure', id, gen) * 12);
// ensure the five seats exist (initial holders = the plain table); idempotent
export function ensureSeats(J, base, year) {
  for (const b of base) {
    if (J.seats[b.id]) continue;
    const key = `neta:${b.id}:0`;
    J.seats[b.id] = { id: b.id, gen: 0, name: b.name, title: b.title, taste: b.taste, y0: J.y0 || year, end: (J.y0 || year) + tenureOf(J.seed || 1, b.id, 0), pre: 3 + Math.floor(h01(J.seed || 1, 'pre', b.id) * 12), d0: 0, b: dimsOfW(b.w).map(r4), tr: Object.fromEntries(Object.entries(traitsOf(J.seed || 1, key)).map(([k, v]) => [k, r2(v)])), mentor: '', prev: [] };
  }
}
// the descriptor of the current holder of a seat
export function seatDesc(J, seat) {
  return { key: `neta:${seat.id}:${seat.gen}`, scope: 'neta', name: seat.name, title: seat.title, taste: seat.taste, y0: seat.y0, b: seat.b.slice(), tr: { ...seat.tr }, id: seat.id, seat: seat.id, pre: seat.pre || 0 };
}
// seat vector → axis weights: the plain weights scaled by how far the holder's taste moved from the seat's table
export function seatWeights(J, base, seat, year) {
  const d = seatDesc(J, seat);
  const sty = styleAt(J, d, year);
  const ref = dimsOfW(base.w);
  const w = {};
  const keys = new Set([...Object.keys(base.w), ...Object.keys(AXIS_DIM)]);
  for (const a of keys) {
    const k = AXIS_DIM[a];
    const bw = base.w[a] || 1;
    if (!k) { w[a] = bw; continue; }
    const i = DIMS.indexOf(k);
    // a successor starts from their own base vector (b), so the scale uses sty − ref (0 for the initial holder at the debut)
    w[a] = r2(bw * clamp(1 + 1.5 * (sty[i] - ref[i]), 0.6, 1.6));
  }
  return { w, sty, d };
}
// the panel of a year: [{ id (seat), name, title, taste, w, bias, spread, key, gen, since, end, school, sty }]
export function netaPanel(J, base, year) {
  ensureSeats(J, base, year);
  return base.map((b) => {
    const seat = J.seats[b.id];
    const { w, sty, d } = seatWeights(J, b, seat, year);
    const bias = clamp(b.bias + mellowShift(d, year), b.bias - 1.5, b.bias + 1.5);
    return { id: b.id, name: seat.name, title: seat.title, taste: b.taste, w, bias: r2(bias), spread: b.spread, key: d.key, gen: seat.gen, since: seat.y0, end: seat.end, school: schoolOf(sty), sty, desc: d, base: b, d0: seat.d0 };
  });
}
// the turn of the year: seats whose tenure ended get a successor (inherited-then-mutated taste), announced as events.
// opts.champ(seatId) → { name?, unit, year, contest } for a former champion to take the seat (the game layer supplies it).
export function tickSeats(J, base, year, opts = {}) {
  ensureSeats(J, base, year);
  const events = [];
  const seed = J.seed || 1;
  for (const b of base) {
    const seat = J.seats[b.id];
    // the holder decides: a hard end of term, or a retirement they choose (the longer they sit and the more mellow / out of step they are, the likelier)
    const yrs = year - seat.y0;
    let reason = year >= seat.end ? '任期を終えて' : '';
    if (!reason && yrs >= 6 && events.length < 2) { // (at most two chosen retirements a year)
      const p = clamp((yrs - 6) * 0.06 + (seat.tr.mellow - 0.5) * 0.08 + (0.8 - seat.tr.open) * 0.05, 0, 0.5);
      if (rngOf(seed, 'retire', b.id, seat.gen, year)() < p) reason = yrs >= 12 ? '長く務めたので後進に席を譲りたいとして' : seat.tr.mellow > 0.6 ? 'おだやかな時間を過ごしたいとして' : seat.tr.open < 0.6 ? 'いまの笑いの流れに自分はついていけないと感じて' : '体力に自信がなくなったとして';
    }
    if (!reason || events.length >= 2) continue; // (at most two changes of seat a year: the rest wait for the next)
    const gen = seat.gen + 1;
    const r = rngOf(seed, 'successor', b.id, gen);
    const female = SEAT_PERSON[b.id] === 'f' ? r() < 0.7 : r() < 0.2;
    const taken = new Set(Object.values(J.seats).map((s) => s.name));
    let name = '';
    const champ = opts.champ ? opts.champ(b.id, gen) : null;
    for (let i = 0; i < 12 && !name; i++) { const n = personName(r, female); if (!taken.has(n) && !isRealNameLike(n)) name = n; }
    if (!name) name = `${b.name.split(' ')[0]} 二世`;
    const profs = SEAT_TITLE_POOL[b.id] || [b.title];
    const prof = profs[Math.floor(r() * profs.length) % profs.length];
    const title = champ ? `${prof}・元「${champ.unit}」（${champ.year}年${champ.contest}王者）` : prof;
    const mentorDesc = seatDesc(J, seat);
    const mv = styleAt(J, mentorDesc, year);
    const key = `neta:${b.id}:${gen}`;
    const tr = traitsOf(seed, key, seat.tr);
    // inherited-then-mutated: 55% the mentor's taste today, 20% the seat's table, 25% their own
    const own = baseVec(seed, key, b.taste);
    const ref = dimsOfW(b.w);
    const nb = DIMS.map((k, i) => clamp(0.55 * mv[i] + 0.2 * ref[i] + 0.25 * own[i] + (r() - 0.5) * 0.1, 0.08, 0.95));
    seat.prev = [...(seat.prev || []), { name: seat.name, title: seat.title, gen: seat.gen, y0: seat.y0, end: year }].slice(-4);
    Object.assign(seat, { gen, name, title, y0: year, end: year + tenureOf(seed, b.id, gen), d0: opts.day || 0, b: nb.map(r4), tr: Object.fromEntries(Object.entries(tr).map(([k, v]) => [k, r2(v)])), mentor: mentorDesc.name });
    events.push({ type: 'seat', seat: b.id, reason, from: seat.prev[seat.prev.length - 1], to: { name, title, school: schoolOf(nb), mentor: mentorDesc.name, champ: !!champ } });
  }
  if (events.length) bump(J);
  return events;
}

// ------------------------------------------------------------------ pool judges (contests.js): decorate with the agent
// j: { name, title, short, taste, tasteId, tastePart, dialect, strict, look, from, to, id }. Returns a copy with the agent fields.
export function decorateJudge(J, j, cid, year) {
  const scope = 'c';
  const d = descOf(J, { scope, key: `c:${j.name}`, name: j.name, title: j.title, taste: j.tasteId || j.taste, y0: Number.isFinite(j.from) ? j.from : J.y0 });
  const mix = partMix(J, d, year, j.tastePart || 'neta');
  const shift = mellowShift(d, year);
  const sty = styleAt(J, d, year);
  const out = { ...j, key: d.key, strict: r2(num(j.strict) + shift * 0.5), school: schoolOf(sty), sty: sty.map(r2), drift: driftNote(J, d, year), tr: d.tr, jy0: d.y0 };
  if (mix) { out.mix = mix; const top = Object.entries(mix).sort((a, b) => b[1] - a[1])[0]; if (top && top[0] !== j.tastePart) out.partNow = top[0]; }
  return out;
}
export const descOfJudge = (J, j) => descOf(J, { scope: 'c', key: j.key || `c:${j.name}`, name: j.name, title: j.title, taste: j.tasteId || j.taste, y0: Number.isFinite(j.jy0) ? j.jy0 : J.y0 });
export const descOfTable = (J, scope, j) => descOf(J, { scope, key: `${scope}:${j.name}`, name: j.name, title: j.title, taste: j.taste, y0: Number.isFinite(j.from) ? j.from : J.y0 });
// M-1 / KOC style panels: { name, title, taste } with their own table; scope tags the key
export function decorateTable(J, scope, j, year) {
  const d = descOf(J, { scope, key: `${scope}:${j.name}`, name: j.name, title: j.title, taste: j.taste, y0: Number.isFinite(j.from) ? j.from : J.y0 });
  const sty = styleAt(J, d, year);
  return { ...j, key: d.key, sty: sty.map(r2), school: schoolOf(sty), drift: driftNote(J, d, year), jy0: d.y0 };
}
// M-1's `taste === act.style ? 1.5 : 0` becomes `+ drift`: how the drifted taste's fit to the act differs from the debut taste's
export function tableDrift(J, scope, j, act, year) {
  const d = descOf(J, { scope, key: `${scope}:${j.name}`, name: j.name, title: j.title, taste: j.taste, y0: Number.isFinite(j.from) ? j.from : J.y0 });
  const av = actVec(J.seed || 1, act);
  return clamp(driftFit(styleAt(J, d, year), d.b, av) * 0.8, -1.2, 1.2);
}
