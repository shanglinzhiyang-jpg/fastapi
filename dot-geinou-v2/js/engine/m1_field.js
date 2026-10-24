// M-1グランプリ — the field: a persistent pool of fictional combos (consistent across rounds and years), the
// deterministic entrants of every round (a seeded world: 12,000+ entries cost a few ms), the cut lines, the final's
// scoring (judges, ranking board, 最終決戦 votes), this world's history (歴代王者: fictional names, real years).
// Pure functions over the st.m1 object (no UI). contest_m1.js calls them.

import { m1Rules, editionOf, m1Held, entriesOf, comboName, personName, lookFor, judgesFor, rng, hstr, h01, pickH, clamp, gauss,
  STYLES, ORIGINS, REGIONS, AGENCY_NAMES, catchCopy } from './m1_data.js';

export const STATE_V = 1;
const POOL_TARGET = 110;
const WORLD_SEED = 'm1-world-2001'; // the shared past (every save has the same 歴代王者 before its start year)
// the seed of a year: the shared world before the save's start year, the save's own after
export const sd = (m, y) => (y < (m.startYear || 0) ? WORLD_SEED : m.seed);

// ---------------------------------------------------------------- state (lazy, old saves fine)
export function ensureM1(st) {
  if (!st.m1 || typeof st.m1 !== 'object') st.m1 = {};
  const m = st.m1;
  if (m.v !== STATE_V) m.v = STATE_V;
  if (!Number.isFinite(m.seed)) m.seed = Math.floor(Math.random() * 1e9);
  if (!Array.isArray(m.pool)) m.pool = [];
  if (!Number.isFinite(m.nextId)) m.nextId = 1;
  if (!Array.isArray(m.hist)) m.hist = [];
  if (!m.seasons || typeof m.seasons !== 'object') m.seasons = {};
  if (!m.me || typeof m.me !== 'object') m.me = {};
  if (!m.me.entries || typeof m.me.entries !== 'object') m.me.entries = {};
  if (!m.seen || typeof m.seen !== 'object') m.seen = {};
  if (!m.news || typeof m.news !== 'object') m.news = { q: [], sent: 0 };
  if (!Array.isArray(m.news.q)) m.news.q = [];
  if (!Number.isFinite(m.poolYear)) m.poolYear = 0;
  return m;
}

// ---------------------------------------------------------------- pool
const curve = (yrs) => Math.min(1, 0.62 + 0.05 * Math.max(0, yrs)); // grows for ~7 years after forming
export function power(c, year) {
  const yrs = year - c.f;
  const form = (h01('form', c.id, year) - 0.5) * 8; // the year's form
  return clamp(c.pot * curve(yrs) + form, 5, 99);
}
// the year's neta (quality) — the strongest acts tend to have the best scripts
export function quality(c, year) { return clamp(power(c, year) + (h01('neta', c.id, year) - 0.45) * 14, 5, 99); }

function newCombo(m, year, r, opts = {}) {
  const id = 'c' + (m.nextId++);
  const era = year <= 2010 ? 'heisei' : 'reiwa';
  const of = r();
  const origin = opts.origin || (of < 0.24 ? 'nsc_osaka' : of < 0.42 ? 'nsc_tokyo' : of < 0.55 ? 'univ' : of < (era === 'reiwa' ? 0.68 : 0.6) ? 'net' : of < 0.74 ? 'pin' : of < 0.8 ? 'friends' : of < 0.86 ? 'school' : of < 0.9 ? 'work' : of < 0.95 ? 'amateur' : of < 0.97 ? 'family' : 'other');
  const g = r() < 0.12 ? 'f' : r() < 0.1 ? 'x' : 'm';
  const trio = r() < 0.05;
  const amateur = origin === 'amateur' || (origin === 'univ' && r() < 0.4) || (origin === 'net' && r() < 0.25);
  const region = origin === 'nsc_osaka' ? (r() < 0.8 ? '大阪' : '京都') : origin === 'nsc_tokyo' ? '東京' : REGIONS[Math.floor(r() * REGIONS.length)];
  const agency = amateur ? 'アマチュア' : origin.startsWith('nsc') ? '吉本興業' : AGENCY_NAMES[Math.floor(r() * (AGENCY_NAMES.length - 1))];
  let name = comboName(sd(m, year), year, id);
  for (let t = 0; t < 5 && m.pool.some((x) => x.n === name); t++) name = comboName(sd(m, year), year, id, t);
  const c = {
    id, n: name, f: opts.f ?? year - (r() < 0.6 ? 0 : 1), pot: opts.pot ?? Math.round(clamp(68 + gauss(r) * 12, 35, 98)),
    st: STYLES[Math.floor(r() * STYLES.length)], o: origin, r: region, a: agency, g, t: trio ? 1 : 0,
    sm: 0, fin: 0, ru: 0, ch: 0, last: null, since: year,
  };
  m.pool.push(c);
  return c;
}

// Bring the pool to `year`: age it, retire the ones past the limit, a few dissolve, newcomers join.
// From a fixed world seed before the save's own start (so the past is shared), the save's seed after.
export function evolvePool(m, year, notes = null) {
  if (m.poolYear >= year) return;
  const startYear = m.poolYear || 2001 - 1;
  if (!m.poolYear) {
    // the very first pool (for 2001): combos formed 1992..2001
    const r = rng(hstr(WORLD_SEED + '|init'));
    for (let i = 0; i < POOL_TARGET; i++) newCombo(m, 2001, r, { f: 2001 - Math.floor(r() * 10) });
    m.poolYear = 2001;
    if (year === 2001) return;
  }
  for (let y = Math.max(startYear + 1, m.poolYear + 1); y <= year; y++) {
    const r = rng(hstr(String(sd(m, y)) + '|evolve|' + y));
    const rules = m1Rules(y) || m1Rules(y <= 2014 && y >= 2011 ? 2015 : y); // hiatus years age with the later limit
    const limit = rules ? rules.limit : 15;
    const keep = [];
    for (const c of m.pool) {
      if (c.dis) continue;
      if (y - c.f > limit) {
        if (notes && c.sm >= 2 && !c.ch && m1Held(y - 1)) notes.push({ k: 'lastYearTears', x: c.n });
        continue; // M-1を卒業
      }
      if (r() < 0.025 + (c.sm === 0 && y - c.f > 6 ? 0.03 : 0)) {
        if (notes && c.sm >= 2) notes.push({ k: 'disband', x: c.n });
        continue; // 解散
      }
      keep.push(c);
    }
    m.pool = keep;
    const add = Math.max(4, POOL_TARGET - m.pool.length);
    for (let i = 0; i < add; i++) {
      const late = r() < 0.3; // risen from the crowd: formed some years ago
      newCombo(m, y, r, late ? { f: y - 1 - Math.floor(r() * 6), pot: Math.round(clamp(68 + gauss(r) * 10, 45, 96)) } : {});
    }
    m.poolYear = y;
  }
}

// ---------------------------------------------------------------- tags (shown in 楽屋 / lists / PV)
export function comboYears(c, year) { return Math.max(1, year - c.f + 1); } // 結成◯年目
export function tagsOf(m, c, year) {
  const rules = m1Rules(year);
  const out = [];
  const prev = m.hist.find((h) => h.y === lastHeld(year - 1));
  if (rules && year - c.f === rules.limit) out.push('ラストイヤー');
  if (prev && prev.ru === c.id) out.push('前年準優勝');
  else if (prev && prev.fin && prev.fin.includes(c.id)) out.push('前年ファイナリスト');
  if (c.fin >= 2) out.push(`決勝${c.fin}回`);
  if (c.sm >= 3 && !c.fin) out.push('準決勝常連');
  if (year - c.f <= 0) out.push('結成1年目');
  if (c.since === year && year - c.f > 0) out.push('初出場');
  if (c.a === 'アマチュア') out.push('アマチュア');
  if (c.pot >= 82 && c.r === '大阪') out.push('大阪の劇場の看板');
  if (c.pot >= 82 && c.r === '東京') out.push('東京の劇場の人気者');
  if (c.r !== '東京' && c.r !== '大阪' && c.r !== '京都') out.push(`${c.r}在住`);
  if (c.o === 'net') out.push('ネット出身');
  if (c.o === 'nsc_osaka' || c.o === 'nsc_tokyo') out.push('NSC出身');
  if (c.o === 'univ') out.push('学生お笑い出身');
  if (c.g === 'x') out.push('男女コンビ');
  if (c.t) out.push('トリオ');
  return out;
}
export function lastHeld(y) { for (let k = y; k >= 2001; k--) if (m1Held(k)) return k; return null; }

// members (2 or 3), deterministic
export function membersOf(c) {
  const n = c.t ? 3 : 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const gender = c.g === 'f' ? 'f' : c.g === 'x' ? (i === 0 ? 'm' : 'f') : 'm';
    out.push({ name: personName(gender, c.id, i), role: n === 3 ? ['ボケ', 'ツッコミ', 'ボケ'][i] : i === 0 ? 'ボケ' : 'ツッコミ', look: lookFor(gender, c.id, i), gender });
  }
  return out;
}

// ---------------------------------------------------------------- anonymous entrants (by entry number)
// power mixture: 記念受験・アマチュア / 若手 / 中堅 / そこそこ強い
function anonP(seed, year, no) {
  const u = h01(seed, year, no, 'mix'), v = h01(seed, year, no, 'p');
  if (u < 0.4) return 8 + v * 24;
  if (u < 0.75) return 20 + v * 24;
  if (u < 0.93) return 30 + v * 22;
  return 38 + v * 20;
}
export function anonCombo(seed, year, no) {
  const id = `a${year}_${no}`;
  const r = rng(hstr(`${seed}|anon|${year}|${no}`));
  const am = r() < 0.45;
  const of = r();
  return {
    id, anon: true, no, n: comboName(seed, year, 'anon', no), f: year - Math.floor(r() * 8), pot: 0,
    st: STYLES[Math.floor(r() * STYLES.length)], o: am ? 'amateur' : of < 0.3 ? 'nsc_osaka' : of < 0.55 ? 'nsc_tokyo' : of < 0.75 ? 'univ' : 'net',
    r: REGIONS[Math.floor(r() * REGIONS.length)], a: am ? 'アマチュア' : AGENCY_NAMES[Math.floor(r() * (AGENCY_NAMES.length - 1))],
    g: r() < 0.12 ? 'f' : r() < 0.1 ? 'x' : 'm', t: r() < 0.04 ? 1 : 0, sm: 0, fin: 0, ru: 0, ch: 0, last: null, since: year,
  };
}

// ---------------------------------------------------------------- the season's field
// Season (st.m1.seasons[year]): { y, ed, E, nos: { poolId: entryNo }, seeds: [poolIds], done: { roundId: true }, res: { roundId:
//   { cut, n, named: [ids], top: [ids...] } }, fin: {...}, newsDone: {}, ... }
export function seasonOf(m, year, create = true) {
  if (!m1Held(year)) return null;
  let S = m.seasons[year];
  if (!S && create) {
    evolvePool(m, year);
    const rules = m1Rules(year);
    const E = rules.entries;
    S = m.seasons[year] = { y: year, ed: editionOf(year), E, nos: {}, seeds: [], done: {}, res: {}, newsDone: {}, created: true };
    // the pool's combos (eligible, not champions) all enter; each gets an entry number
    const used = new Set();
    for (const c of m.pool) {
      if (c.ch || year - c.f > rules.limit || c.f > year) continue;
      let no = 1 + Math.floor(h01(sd(m, year), year, c.id, 'no') * E);
      while (used.has(no)) no = (no % E) + 1;
      used.add(no);
      S.nos[c.id] = no;
      if (rules.seeds && c.sm > 0) S.seeds.push(c.id);
    }
  }
  return S;
}

const cache = new Map();
// Entrants of round index ri (0 = 1回戦): [{ key, no, c (pool combo or anon), p, q }] — the field WITHOUT the player.
export function fieldOf(m, year, ri) {
  const S = seasonOf(m, year);
  const rules = m1Rules(year);
  const key = `${sd(m, year)}|${year}|${S.playerNo || 0}`;
  let C = cache.get(key);
  if (!C) { C = { fields: [], scores: [] }; cache.set(key, C); if (cache.size > 6) cache.delete(cache.keys().next().value); }
  if (C.fields[ri]) return C.fields[ri];
  if (ri === 0) {
    const byNo = {};
    for (const [id, no] of Object.entries(S.nos)) byNo[no] = id;
    const pool = Object.fromEntries(m.pool.map((c) => [c.id, c]));
    const seeds = new Set(S.seeds);
    const list = [];
    for (let no = 1; no <= S.E; no++) {
      if (no === S.playerNo) continue;
      const pid = byNo[no];
      if (pid && pool[pid] && pool[pid].pr !== year) {
        if (seeds.has(pid)) continue;
        const c = pool[pid];
        list.push({ key: 'c:' + pid, no, c, p: power(c, year), q: quality(c, year) });
      } else {
        const p = anonP(sd(m, year), year, no);
        list.push({ key: 'a:' + no, no, c: pid && pool[pid] ? pool[pid] : null, p, q: clamp(p + (h01(sd(m, year), year, no, 'q') - 0.5) * 16, 3, 95) });
      }
    }
    C.fields[0] = list;
    return list;
  }
  const prev = fieldOf(m, year, ri - 1);
  const sc = scoresOf(m, year, ri - 1);
  const K = rules.rounds[ri - 1].pass;
  const ranked = prev.map((e, i) => [sc[i], e]).sort((a, b) => b[0] - a[0]);
  let next = ranked.slice(0, K).map((x) => x[1]);
  if (ri === 1 && S.seeds.length) {
    const pool = Object.fromEntries(m.pool.map((c) => [c.id, c]));
    for (const id of S.seeds) if (pool[id]) next.push({ key: 'c:' + id, no: S.nos[id], c: pool[id], p: power(pool[id], year), q: quality(pool[id], year), seed: true });
  }
  // ワイルドカード: the best-loved 準々決勝 loser (by power + a vote roll) joins the 準決勝
  if (rules.rounds[ri - 1].wildcard) {
    const losers = ranked.slice(K, K + 40).map((x) => x[1]);
    let best = null, bv = -1;
    for (const e of losers) { const v = e.p + h01(sd(m, year), year, e.no, 'wc') * 25; if (v > bv) { bv = v; best = e; } }
    if (best) { next = next.concat([{ ...best, wildcard: true }]); S.wildcard = best.key; }
  }
  C.fields[ri] = next;
  return next;
}
// Scores of every entrant of round ri (same order as fieldOf). The player's own score never enters here.
export function scoresOf(m, year, ri) {
  const S = seasonOf(m, year);
  const key = `${sd(m, year)}|${year}|${S.playerNo || 0}`;
  const C = cache.get(key) || { fields: [], scores: [] };
  if (C.scores[ri]) return C.scores[ri];
  const f = fieldOf(m, year, ri);
  const press = [0, 0.5, 1, 1.5, 2, 2.5][ri] || 0;
  const out = f.map((e) => rivalScore(e.p, e.q, h01(sd(m, year), year, 'rs', ri, e.no), press));
  (cache.get(key) || C).scores[ri] = out;
  return out;
}
// The same model the stub perform.js uses (power 50% + neta 40% ± 10) so rivals and the player share a scale.
export function rivalScore(p, q, u, press = 0) { return clamp(Math.round(p * 0.5 + q * 0.4 + (u - 0.5) * 20 - press * (u < 0.15 ? 3 : 0)), 0, 100); }
// The pass line of a round: the K-th best score among the others.
export function cutOf(m, year, ri) {
  const rules = m1Rules(year);
  const sc = scoresOf(m, year, ri).slice().sort((a, b) => b - a);
  const K = rules.rounds[ri].pass;
  return sc[Math.min(sc.length - 1, Math.max(0, K - 1))] ?? 50;
}
// who passed round ri: the top K by score (the next field adds seeds / the wildcard on top)
export function passedOf(m, year, ri) {
  const sc = scoresOf(m, year, ri);
  const f = fieldOf(m, year, ri);
  return f.map((e, i) => [sc[i], e]).sort((a, b) => b[0] - a[0]).slice(0, m1Rules(year).rounds[ri].pass).map((x) => x[1]);
}
export function rankIn(m, year, ri, score) {
  const sc = scoresOf(m, year, ri);
  let above = 0;
  for (const s of sc) if (s > score) above++;
  return { rank: above + 1, of: sc.length + 1 };
}

// Make an anonymous entrant a pool member (it reached the 準決勝: it has a story now and returns next year).
export function promote(m, year, e) {
  if (e.c && !e.c.anon) return e.c;
  const a = anonCombo(sd(m, year), year, e.no);
  const c = { ...a, id: 'c' + (m.nextId++), anon: undefined, pr: year, pot: Math.round(clamp(e.p / curve(year - a.f), 30, 97)) };
  delete c.anon; delete c.no;
  m.pool.push(c);
  const S = seasonOf(m, year);
  S.nos[c.id] = e.no;
  return c;
}

// ---------------------------------------------------------------- acts (anyone who can stand at the center mic)
// key: 'c:<poolId>' | 'a:<entryNo>' | 'me'
export function actOf(m, year, key, me = null) {
  if (key === 'me') return me;
  if (key.startsWith('c:')) {
    const c = m.pool.find((x) => x.id === key.slice(2));
    if (c) return comboAct(m, year, c);
  }
  const no = Number(key.slice(2));
  return comboAct(m, year, anonCombo(sd(m, year), year, no), no);
}
export function comboAct(m, year, c, no = null) {
  const S = m.seasons[year];
  const members = membersOf(c);
  const yrs = comboYears(c, year);
  const rules = m1Rules(year);
  const tags = tagsOf(m, c, year);
  const p = c.anon ? anonP(sd(m, year), year, no) : power(c, year);
  return {
    key: c.anon ? 'a:' + no : 'c:' + c.id, id: c.id, name: c.n, members, years: yrs, formed: c.f, agency: c.a, origin: c.o, region: c.r, style: c.st,
    tags, power: Math.round(p), quality: Math.round(c.anon ? p : quality(c, year)), no: no ?? (S && S.nos[c.id]) ?? null,
    last: rules && year - c.f === rules.limit, amateur: c.a === 'アマチュア', finals: c.fin, semis: c.sm, ru: c.ru, mixed: c.g === 'x', trio: !!c.t,
  };
}
export function stars(p) { return p >= 85 ? 5 : p >= 72 ? 4 : p >= 58 ? 3 : p >= 42 ? 2 : 1; }

// ---------------------------------------------------------------- the final day
// Builds (once, deterministically) the 敗者復活戦 and the final for the rivals. The player's act, when in it, is added
// by the flow (S.fin.me). S.fin = { finalists: [keys], losers: [keys], revival: { field, blocks, winner }, order, ... }
export function prepareFinal(m, year) {
  const S = seasonOf(m, year);
  if (S.fin) return S.fin;
  const rules = m1Rules(year);
  const ri = rules.rounds.length - 1; // 準決勝
  const f = fieldOf(m, year, ri);
  const sc = scoresOf(m, year, ri);
  const ranked = f.map((e, i) => [sc[i], e]).sort((a, b) => b[0] - a[0]);
  const nFin = rules.rounds[ri].pass;
  for (const [, e] of ranked) if (!e.c || e.c.anon) e.c = promote(m, year, e); // every semi-finalist is somebody now
  const keyOf = (e) => 'c:' + e.c.id;
  const finalists = ranked.slice(0, nFin).map(([, e]) => keyOf(e));
  let losers = ranked.slice(nFin).map(([, e]) => keyOf(e));
  if (rules.revival && rules.revival.kind === 'blocks') losers = losers.slice(0, rules.revival.field);
  S.fin = { finalists, losers, semiScores: Object.fromEntries(ranked.map(([s, e]) => [keyOf(e), s])), revival: null, order: null, scores: {}, done: false };
  return S.fin;
}

// 敗者復活戦 among keys (+ the player's score when in it). Returns { winner, table: [{ key, s, votes? }], blocks? }
export function runRevival(m, year, meScore = null) {
  const S = seasonOf(m, year);
  const fin = prepareFinal(m, year);
  const rules = m1Rules(year);
  if (!rules.revival) return null;
  const pool = Object.fromEntries(m.pool.map((c) => [c.id, c]));
  const rs = (key) => {
    if (key === 'me') return meScore ?? 0;
    const c = pool[key.slice(2)];
    const p = c ? power(c, year) : 50, q = c ? quality(c, year) : 50;
    // popularity matters in a vote; the outdoor cold costs a little
    const pop = rules.revival.kind === 'vote' ? (c ? c.fin * 2 + c.sm : 0) : 0;
    return clamp(rivalScore(p, q, h01(sd(m, year), year, 'rev', key)) + pop * 0.6, 0, 100);
  };
  let keys = fin.losers.slice();
  if (meScore == null) keys = keys.filter((k) => k !== 'me');
  else if (!keys.includes('me')) keys.push('me');
  const table = keys.map((key) => ({ key, s: Math.round(rs(key)) }));
  let winner;
  let blocks = null;
  if (rules.revival.kind === 'blocks') {
    // A/B/C blocks by the 準決勝 order; the audience keeps the stronger one (勝ち残り), then the 芸人審査員 vote
    blocks = [[], [], []];
    keys.forEach((k, i) => blocks[i % 3].push(k));
    const champs = blocks.map((b) => b.reduce((best, k) => (rs(k) + h01(sd(m, year), year, 'blk', k) * 4 > rs(best) + h01(sd(m, year), year, 'blk', best) * 4 ? k : best), b[0]));
    const votes = {};
    for (let j = 0; j < 5; j++) {
      const v = champs.reduce((best, k) => (rs(k) + h01(sd(m, year), year, 'rj', j, k) * 10 > rs(best) + h01(sd(m, year), year, 'rj', j, best) * 10 ? k : best), champs[0]);
      votes[v] = (votes[v] || 0) + 1;
    }
    winner = champs.slice().sort((a, b) => (votes[b] || 0) - (votes[a] || 0) || rs(b) - rs(a))[0];
    blocks = blocks.map((b, i) => ({ name: 'ABC'[i] + 'ブロック', keys: b, winner: champs[i] }));
    fin.revivalVotes = votes;
  } else {
    table.sort((a, b) => b.s - a.s);
    winner = table[0].key;
  }
  fin.revival = { winner, table: table.sort((a, b) => b.s - a.s).slice(0, 25), blocks };
  return fin.revival;
}

// The final's order: 笑神籤 (2017〜: drawn live, act by act) or decided beforehand (the 敗者復活 act in a fixed slot).
export function finalOrder(m, year, keys, revivalKey) {
  const rules = m1Rules(year);
  const base = keys.filter((k) => k !== revivalKey).slice().sort((a, b) => h01(sd(m, year), year, 'ord', a) - h01(sd(m, year), year, 'ord', b));
  if (rules.emikuji) {
    const all = base.concat(revivalKey ? [revivalKey] : []);
    return all.sort((a, b) => h01(sd(m, year), year, 'kuji', a) - h01(sd(m, year), year, 'kuji', b));
  }
  if (revivalKey) { const slot = Math.min(base.length, Math.max(4, Math.floor(h01(sd(m, year), year, 'revslot') * base.length) + 1)); base.splice(slot, 0, revivalKey); }
  return base;
}

// One judge's points for a performance score s (0..100). Real M-1 judges give roughly 80–98.
export function judgePoints(judge, act, s, key, salt) {
  const taste = act && judge.taste === act.style ? 1.5 : 0;
  const n = (h01('jp', judge.id, key, salt) - 0.5) * 3;
  return clamp(Math.round(80 + s * 0.17 + taste + (judge.bias || 0) + n), 75, 99);
}
// The audience points of 2001 (札幌・大阪・福岡, 100 people each, 1 point each)
export function audiencePoints(act, s, key) {
  const venues = [['札幌', 0], ['大阪', act && act.region === '東京' ? -18 : 6], ['福岡', 0]];
  return venues.map(([city, bias]) => ({ city, pts: clamp(Math.round(s * 0.85 + bias + (h01('aud', key, city) - 0.5) * 20), 3, 98) }));
}
// Score card for an act: { pts: [..], aud?: [..], total }
export function scoreCard(m, year, act, s, key, salt = 'r1') {
  const rules = m1Rules(year);
  const js = judgesFor(year);
  const pts = js.map((j) => judgePoints(j, act, s, key, `${sd(m, year)}|${year}|${salt}`));
  let total = pts.reduce((a, b) => a + b, 0);
  let aud = null;
  if (rules.audience2001) { aud = audiencePoints(act, s, key); total += aud.reduce((a, b) => a + b.pts, 0); }
  return { pts, aud, total, s };
}
// A rival finalist's performance score (big stage: wider swing)
export function finalScore(m, year, key, salt = 'f1') {
  const c = m.pool.find((x) => x.id === key.slice(2));
  const p = c ? power(c, year) : 60, q = c ? quality(c, year) : 60;
  const u = h01(sd(m, year), year, salt, key);
  return clamp(Math.round(p * 0.5 + q * 0.42 + (u - 0.5) * 24 + (c && c.fin ? 1.5 : 0)), 0, 100);
}
// 最終決戦: each judge votes for one of the three (second ネタ mostly; a little of the first round)
export function finalVotes(m, year, entries) {
  // entries: [{ key, s2, s1, act }]
  const js = judgesFor(year);
  return js.map((j) => {
    let best = null, bv = -1e9;
    for (const e of entries) {
      const v = e.s2 + e.s1 * 0.25 + (j.taste === (e.act && e.act.style) ? 2 : 0) + (h01(sd(m, year), year, 'vote', j.id, e.key) - 0.5) * 6;
      if (v > bv) { bv = v; best = e.key; }
    }
    return { judge: j, key: best };
  });
}

// ---------------------------------------------------------------- a whole season for rivals only (past / not entered)
// Returns the history row { y, ed, ch, chN, ru, ruN, th, thN, fin: [ids], finN: [names], rev, revN, top, topN, votes }
export function simulateFinal(m, year, meKey = null) {
  const S = seasonOf(m, year);
  const rules = m1Rules(year);
  const fin = prepareFinal(m, year);
  const rev = rules.revival ? (fin.revival || runRevival(m, year)) : null;
  const keys = fin.finalists.concat(rev ? [rev.winner] : []);
  const order = fin.order || finalOrder(m, year, keys, rev ? rev.winner : null);
  fin.order = order;
  const cards = {};
  for (const k of order) {
    if (fin.scores[k]) { cards[k] = fin.scores[k]; continue; }
    const act = actOf(m, year, k);
    cards[k] = fin.scores[k] = scoreCard(m, year, act, finalScore(m, year, k), k);
  }
  const ranking = order.slice().sort((a, b) => cards[b].total - cards[a].total || Math.max(...cards[b].pts) - Math.max(...cards[a].pts));
  let champ = ranking[0], ru = ranking[1], th = ranking[2], votes = null;
  if (rules.finalRound) {
    const top3 = ranking.slice(0, 3);
    const entries = top3.map((k) => ({ key: k, s1: cards[k].s, s2: k === meKey ? fin.me2 ?? 50 : finalScore(m, year, k, 'f2'), act: actOf(m, year, k) }));
    votes = finalVotes(m, year, entries);
    const count = {};
    for (const v of votes) count[v.key] = (count[v.key] || 0) + 1;
    const byVotes = top3.slice().sort((a, b) => (count[b] || 0) - (count[a] || 0) || cards[b].total - cards[a].total);
    [champ, ru, th] = byVotes;
    fin.votes = votes.map((v) => ({ j: v.judge.id, k: v.key }));
    fin.top3 = top3;
  }
  fin.ranking = ranking;
  fin.champ = champ; fin.done = true;
  return recordHistory(m, year, fin, rev);
}
export function recordHistory(m, year, fin, rev) {
  const nm = (k) => (k === 'me' ? (m.me.name || 'あなた') : actOf(m, year, k).name);
  const cid = (k) => (k && k.startsWith('c:') ? k.slice(2) : k);
  const best = fin.ranking ? fin.scores[fin.ranking[0]] : null;
  const row = {
    y: year, ed: editionOf(year), ch: cid(fin.champ), chN: nm(fin.champ), ru: cid(fin.ru || (fin.top3 ? null : fin.ranking[1])), th: null,
    fin: (fin.order || []).map(cid), finN: (fin.order || []).map(nm), rev: rev ? cid(rev.winner) : null, revN: rev ? nm(rev.winner) : null,
    top: best ? best.total : 0, topN: fin.ranking ? nm(fin.ranking[0]) : '',
  };
  // ru / th from votes when there was a 最終決戦
  if (fin.top3 && fin.votes) {
    const count = {};
    for (const v of fin.votes) count[v.k] = (count[v.k] || 0) + 1;
    const byV = fin.top3.slice().sort((a, b) => (count[b] || 0) - (count[a] || 0) || fin.scores[b].total - fin.scores[a].total);
    row.ru = cid(byV[1]); row.ruN = nm(byV[1]); row.th = cid(byV[2]); row.thN = nm(byV[2]);
    row.v = count[fin.champ] || 0;
  } else if (fin.ranking) { row.ruN = nm(fin.ranking[1]); row.th = cid(fin.ranking[2]); row.thN = nm(fin.ranking[2]); }
  m.hist = m.hist.filter((h) => h.y !== year).concat([row]).sort((a, b) => a.y - b.y);
  // the pool remembers
  const S = m.seasons[year];
  const semis = S && S.fin ? Object.keys(S.fin.semiScores) : [];
  for (const k of semis) { const c = m.pool.find((x) => 'c:' + x.id === k); if (c) { c.sm++; c.last = { y: year, r: 'sf' }; } }
  for (const k of fin.order || []) { const c = m.pool.find((x) => 'c:' + x.id === k); if (c) { c.fin++; c.last = { y: year, r: 'final' }; } }
  if (row.ru) { const c = m.pool.find((x) => x.id === row.ru); if (c) c.ru++; }
  if (row.ch) { const c = m.pool.find((x) => x.id === row.ch); if (c) { c.ch = year; c.last = { y: year, r: 'champ' }; } }
  return row;
}

// The shared past: every held year from 2001 up to (not including) startYear, rivals only.
export function buildPast(m, startYear) {
  if (m.pastBuilt >= startYear - 1) return;
  for (let y = 2001; y < startYear; y++) {
    if (!m1Held(y)) { evolvePool(m, y); continue; }
    if (m.hist.some((h) => h.y === y)) continue;
    evolvePool(m, y);
    const S = seasonOf(m, y);
    // a light season: only the pool competes for the 準決勝 places
    const rules = m1Rules(y);
    const semN = y <= 2010 ? 40 : 30;
    const ranked = m.pool.filter((c) => S.nos[c.id]).map((c) => [rivalScore(power(c, y), quality(c, y), h01(WORLD_SEED, y, c.id, 'semi')), c]).sort((a, b) => b[0] - a[0]).slice(0, semN);
    const nFin = rules.rounds[rules.rounds.length - 1].pass;
    S.fin = { finalists: ranked.slice(0, nFin).map(([, c]) => 'c:' + c.id), losers: ranked.slice(nFin).map(([, c]) => 'c:' + c.id),
      semiScores: Object.fromEntries(ranked.map(([s, c]) => ['c:' + c.id, s])), revival: null, order: null, scores: {}, done: false };
    simulateFinal(m, y);
    // keep past seasons light in the save
    m.seasons[y] = { y, ed: S.ed, E: S.E, past: true };
  }
  m.pastBuilt = startYear - 1;
}

// ---------------------------------------------------------------- PV facts → catch copy
export function actFacts(m, year, act, extra = {}) {
  const rules = m1Rules(year);
  return {
    name: act.name, years: act.years, last: !!act.last, amateur: !!act.amateur, origin: act.origin, region: act.region, style: act.style,
    revival: !!extra.revival, firstFinal: !act.finals, finals: act.finals || 0, semis: act.semis || 0, runnerUpBefore: (act.ru || 0) > 0,
    mixed: !!act.mixed, trio: !!act.trio, oldest: !!extra.oldest, rookie: act.years <= 3, era: rules && rules.era === 'heisei' ? 'heisei' : 'reiwa', player: !!extra.player,
  };
}
export function copyFor(m, year, act, extra = {}) { return catchCopy(actFacts(m, year, act, extra), year); }
export { pickH };
