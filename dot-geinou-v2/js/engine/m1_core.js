// M-1グランプリ — shared helpers for contest_m1.js and m1_flow.js: the calendar (game day ↔ real month/day), the state
// (st.m1 through ensureM1 + the shared past), the season's schedule as game days, the player's act (g.unit, feature-
// detected), the news queue (≤ 3 contest messages a morning), money in the era's prices.

import { YEN_MARK, display } from './util.js';
import { PEOPLE } from './life.js';
import { AGENCIES } from './state.js';
import { m1Rules, m1Held, editionOf, M1, h01, NEWS, pickH } from './m1_data.js';
import { ensureM1, buildPast, evolvePool, seasonOf, simulateFinal } from './m1_field.js';

export const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const MONTH_DAYS = 10, YEAR_DAYS = 120;
const ERA_BASE_YEAR = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };

// ---------------------------------------------------------------- calendar
// { year, month, k (0..9: the slot in the month), doy (0..119 from January), dom (real day 1..28) }
export function cal(g, day) {
  const st = g && g.state;
  const d = day ?? ((st && st.day) || 1);
  if (has(g, 'gameDate')) {
    const r = safe(() => g.gameDate(d), null);
    if (r && Number.isFinite(r.year)) {
      const doy = Number.isFinite(r.doy) ? r.doy : (r.month - 1) * MONTH_DAYS + Math.max(0, Math.min(9, (r.dom || 1) - 1));
      return { year: r.year, month: Math.floor(doy / MONTH_DAYS) + 1, k: doy % MONTH_DAYS, doy, dom: (doy % MONTH_DAYS) * 3 + 1 };
    }
  }
  const era = (st && st.profile && st.profile.era) || 'reiwa';
  const n = Math.max(0, d - 1);
  const doy0 = 3 * MONTH_DAYS + n; // the game starts in April
  const year = (ERA_BASE_YEAR[era] ?? 2026) + Math.floor(doy0 / YEAR_DAYS);
  const doy = doy0 % YEAR_DAYS;
  return { year, month: Math.floor(doy / MONTH_DAYS) + 1, k: doy % MONTH_DAYS, doy, dom: (doy % MONTH_DAYS) * 3 + 1 };
}
// The game day of (year, month, slot k)
export function dayOf(g, year, month, k) {
  const now = cal(g);
  const today = (g.state && g.state.day) || 1;
  return today + (year - now.year) * YEAR_DAYS + ((month - 1) * MONTH_DAYS + k - now.doy);
}
export const W = ['日', '月', '火', '水', '木', '金', '土'];
export function dateLabel(g, day) { const c = cal(g, day); return `${c.month}月${c.dom}日`; }
export function dateLabelY(g, day) { const c = cal(g, day); return `${c.year}年${c.month}月${c.dom}日`; }
export const today = (g) => (g.state && g.state.day) || 1;

// ---------------------------------------------------------------- state
export function M(g) {
  const st = g.state;
  const m = ensureM1(st);
  if (!m.startYear) m.startYear = Math.max(2001, cal(g, 1).year);
  const y = cal(g).year;
  if (y >= 2001) {
    if ((m.pastBuilt || 0) < m.startYear - 1) buildPast(m, m.startYear);
    // held years that went by without a final (a jump in time, an old save): their seasons happen quietly, in order
    for (let yy = Math.max(2001, m.startYear); yy < y; yy++) {
      if (!m1Held(yy) || m.hist.some((h) => h.y === yy) || m.poolYear > yy) continue;
      try { seasonOf(m, yy); simulateFinal(m, yy); } catch (e) { console.error(e); }
    }
    if (m.poolYear < y && m1Held(y)) evolvePool(m, y, (m._notes = m._notes || []));
  }
  return m;
}
export function season(g, year = cal(g).year, create = true) { const m = M(g); return m1Held(year) ? seasonOf(m, year, create) : null; }
export function entryOf(g, year = cal(g).year) { const m = M(g); return m.me.entries[year] || null; }

// The season's dated plan (game days)
export function plan(g, year = cal(g).year) {
  const r = m1Rules(year);
  if (!r) return null;
  const d = (mk) => dayOf(g, year, mk[0], mk[1]);
  return {
    year, rules: r,
    entryFrom: d(r.entry.from), entryTo: d(r.entry.to),
    rounds: r.rounds.map((x) => ({ ...x, opts: x.opts.map((o) => ({ ...o, day: dayOf(g, year, o.m, o.k) })), last: Math.max(...x.opts.map((o) => dayOf(g, year, o.m, o.k))) })),
    finalDay: d(r.finalAt),
    // after the final (this world's schedule: the night itself, a few days later, the next spring)
    zadankai: d(r.finalAt) + 2, another: d(r.finalAt) + 3,
    returns: dayOf(g, year + 1, 1, 5),
    tour: [[2, 2, '東京'], [2, 6, '大阪'], [3, 1, '名古屋'], [3, 4, '福岡']].map(([mo, k, city]) => ({ day: dayOf(g, year + 1, mo, k), city })),
    dvd: dayOf(g, year + 1, 3, 6),
  };
}

// status of a year: 'notyet' | 'hiatus' | 'before' | 'entry' | 'prelim' | 'finalday' | 'after'
export function statusOf(g, year = cal(g).year) {
  if (year < M1.founded) return { id: 'notyet', label: `まだ始まっていない（${M1.founded}年創設）` };
  if (!m1Held(year)) return { id: 'hiatus', label: '開催なし（2010年の第10回で一区切り）' };
  const p = plan(g, year), t = today(g);
  if (t < p.entryFrom) return { id: 'before', label: `エントリー受付前（${dateLabel(g, p.entryFrom)}から）` };
  if (t <= p.entryTo && t < p.rounds[0].opts[0].day) return { id: 'entry', label: `エントリー受付中（${dateLabel(g, p.entryTo)}まで）` };
  if (t < p.finalDay) {
    const cur = p.rounds.find((r) => t <= r.last);
    const entryOpen = t <= p.entryTo;
    return { id: 'prelim', label: `予選${cur ? `：${cur.name}` : ''}${entryOpen ? '（エントリー受付中）' : ''}`, entryOpen };
  }
  if (t === p.finalDay) return { id: 'finalday', label: '本日、敗者復活戦・決勝' };
  return { id: 'after', label: '大会終了' };
}

// ---------------------------------------------------------------- the player's act
export function unitInfo(g, year = cal(g).year) {
  const st = g.state;
  const u = has(g, 'unit') ? safe(() => g.unit(), null) : null;
  const P = st.partner && PEOPLE[st.partner];
  const members = u && Array.isArray(u.members) && u.members.length ? u.members.map((x) => ({ ...x })) : [{ id: 'player', name: st.name, role: P ? 'tsukkomi' : 'pin', look: st.look }].concat(P ? [{ id: P.id, name: P.name, short: P.short || P.name, role: 'boke', look: P.look }] : []);
  for (const mb of members) { if (mb.id === 'player') mb.look = st.look; else if (!mb.look && PEOPLE[mb.id]) mb.look = PEOPLE[mb.id].look; }
  const type = u ? u.type : P ? 'combi' : 'pin';
  const formed = u && u.formed ? u.formed : null;
  let formedYear = formed && Number.isFinite(formed.year) ? formed.year : null;
  if (formedYear == null && formed && Number.isFinite(formed.day)) formedYear = cal(g, formed.day).year;
  if (formedYear == null && has(g, 'unitYears')) { const k = safe(() => g.unitYears(year), null); if (Number.isFinite(k) && k > 0) formedYear = year - k; }
  if (formedYear == null) {
    // the stub / no record: this game remembers when it first saw the pair
    const m = ensureM1(st);
    const key = P ? P.id : 'solo';
    m.formed = m.formed || {};
    if (!m.formed[key]) m.formed[key] = year;
    formedYear = m.formed[key];
  }
  const rules = m1Rules(year);
  const agency = (u && u.agency) || st.agency || null;
  const name = (u && u.name) || (P ? `${st.name}と${P.short || P.name}` : st.name);
  const out = {
    unit: u, type, name, kana: (u && u.kana) || '', members, formedYear, formedMonth: (formed && formed.month) || null,
    years: Math.max(1, year - formedYear + 1), // 結成◯年目
    amateur: u ? !!u.amateur : !agency, agency, agencyName: agency ? (AGENCIES[agency] ? AGENCIES[agency].name : String(agency)) : 'アマチュア（所属なし）',
    harmony: u && Number.isFinite(u.harmony) ? u.harmony : P ? Math.min(100, 30 + (g.aff ? g.aff(P.id) * 0.7 : 20)) : 0,
    partner: P ? P.id : (members.find((x) => x.id !== 'player') || {}).id || null,
    partnerName: P ? (P.short || P.name) : (members.find((x) => x.id !== 'player') || {}).short || null,
    partnerLook: P ? P.look : (members.find((x) => x.id !== 'player') || {}).look || null,
    style: (u && u.style) || 'manzai', source: (u && u.source) || (P ? 'people' : 'solo'),
    ok: true, why: '',
  };
  if (!rules) { out.ok = false; out.why = year < 2001 ? 'M-1グランプリはまだ始まっていない（2001年創設）。' : '今年はM-1グランプリの開催がない（2010年の第10回で一区切り）。'; return out; }
  out.last = year - formedYear === rules.limit;
  if (type === 'pin' || members.length < 2) { out.ok = false; out.why = 'M-1は「2人以上」の漫才師の大会。ピンでは出られない。\n相方を見つけよう（ネットの募集やNSCで出会える）。'; }
  else if (u && u.dissolved) { out.ok = false; out.why = 'コンビは解散している…。'; }
  else if (year - formedYear > rules.limit) { out.ok = false; out.why = `出場資格は「${rules.limitText}」。結成${out.years}年目のこのコンビは、もう出られない…。`; }
  else if (ensureM1(st).me.champion) { out.ok = false; out.why = 'M-1王者は、もう出場できない（優勝経験者は出場資格がない）。'; }
  return out;
}
// ability for odds: g.unitPower('manzai') or a fallback from the stats
export function powerOf(g) {
  if (has(g, 'unitPower')) { const v = safe(() => g.unitPower('manzai'), null); if (Number.isFinite(v)) return v; }
  const w = (g.state.skills && g.state.skills.warai) || 0;
  return Math.round(w * 0.6);
}
export function qualityOf(g, neta) {
  if (neta && has(g, 'netaQuality')) { const v = safe(() => g.netaQuality(neta), null); if (Number.isFinite(v)) return v; }
  if (neta && neta.ai && Number.isFinite(neta.ai.total)) return Math.round(neta.ai.total * 0.7 + (neta.practice || 0) * 0.3);
  return 40;
}
// the chance to reach `cut`: g.performSim samples (same model as rivals) or the stub model
export function odds(g, neta, cut, n = 60) {
  const p = powerOf(g), q = qualityOf(g, neta);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const u = h01('odds', g.state.day, i, cut);
    let s;
    if (has(g, 'performSim')) { const r = safe(() => g.performSim({ kind: 'manzai', power: p, quality: q, neta, rng: () => u }), null); s = r && Number.isFinite(r.score) ? r.score : null; }
    if (s == null) s = Math.round(p * 0.5 + q * 0.4 + (u - 0.5) * 20);
    if (s >= cut) ok++;
  }
  return Math.round((ok / n) * 100);
}

// ---------------------------------------------------------------- money in the era's prices
export const rate = () => display.priceRate || 1;
// a real nominal amount of that time (2,000円 in 2004) as game money (shown back as exactly that amount)
export const internal = (nominal) => Math.round(nominal / rate());
export const yenNom = (nominal) => `¥${YEN_MARK}${Math.round(nominal).toLocaleString('ja-JP')}`;

// ---------------------------------------------------------------- news (queued; the morning sends ≤ 3 messages)
export function news(g, key, vars = {}, opts = {}) {
  const m = M(g);
  const bank = NEWS[key];
  const tpl = Array.isArray(bank) ? pickH(bank, m.seed, key, today(g), JSON.stringify(vars)) : String(key);
  let text = tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  if (opts.prefix !== false) text = text.startsWith('【') ? text : `【M-1】${text}`;
  const id = opts.once ? `${opts.once}` : null;
  if (id) { m.newsOnce = m.newsOnce || {}; if (m.newsOnce[id]) return; m.newsOnce[id] = today(g); }
  m.news.q.push({ day: today(g), text, prio: opts.prio || 0, key: opts.key || null });
  if (m.news.q.length > 30) m.news.q.splice(0, m.news.q.length - 30);
}
export function flushNews(g) {
  const m = M(g);
  const q = m.news.q.splice(0).sort((a, b) => b.prio - a.prio);
  if (!q.length) return 0;
  const send = (text) => {
    if (has(g, 'contestNews')) safe(() => g.contestNews(text, { contest: 'm1', cat: 'owarai' }));
    else g.message({ from: 'お笑いニュース', text, kind: 'news', contest: 'm1' });
  };
  const solo = q.slice(0, 2);
  for (const n of solo) send(n.text);
  const rest = q.slice(2);
  if (rest.length) send(`【M-1ニュースまとめ】\n${rest.slice(0, 6).map((n) => '・' + n.text.replace(/^【M-1】/, '')).join('\n')}`);
  m.news.sent = (m.news.sent || 0) + Math.min(3, q.length);
  return Math.min(3, q.length);
}
export function msg(g, from, text, extra = {}) { return g.message({ from, text, kind: extra.kind || 'chat', ...extra }); }
export { editionOf, m1Rules, m1Held };
