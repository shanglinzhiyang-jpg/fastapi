// ニュース (R9-D): the news feed behind the news app — every source of the game in one list, by section, with the real
// headlines of the date, the seasons' news, today's market and weather, 号外 for big events, read / unread and search.
// The app's screens are news_ui.js; data is news_data.js. API doc: test-output/api_r9d.txt.
//
// Sources (each feature-detected; a missing core is simply skipped):
//   inbox press messages (kind 'news', sender /ニュース|新聞|週刊|速報|報道|通信/) · politics p.news (politics / govt / regime / world)
//   · g.govtNews · g.worldNews (国際) · g.contestState().news (お笑い: D1's log, also what the morning cap held back) · REAL_NEWS
//   (by date) · SEASONAL (by month) · g.marketQuote (経済: today's close) · g.weather (天気: typhoons and warnings).
// Nothing here sends a phone message: the feed only reads what the game already said, so it adds no morning messages
// (the contest cap of contests.js stays as it is). The app icon's badge counts the stories since the app was last opened.
//
// State: g.state.newsApp = { v, base (first day seen), seen (day of the last open), prevSeen, read: { key: 1 } (≤ 500),
//   gogai: { key: day shown }, q (last search) } — repaired on first use; old saves simply lack it.
//
// API (exports; g.* wrappers at the end):
//   newsFeed(g, { cat, q, mine, unread, limit }) → [item]   item: { key, day, cat, head, body, from, img, real, gogai, mine,
//                                                              read, isNew, msg?, date? (real date number), prio }
//   newsFront(g) → { top, subs[4], list[], gogai (unseen 号外 item | null), counts { cat: unread } }
//   newsUnreadCount(g) → n (since the last open)  ·  newsOpened(g) (marks the open)  ·  newsRead(g, item)
//   newsGogaiSeen(g, item)  ·  newsMarket(g) → { price, change, series, stocks[] } | null  ·  newsWeather(g) → {...} | null
//   newsDateNum(g, day?) → YYYYMMDD of a game day  ·  newsDayOf(g, dateNum) → the first game day on or after that date

import { SEC, CATS, REAL_NEWS, SEASONAL, catOfText, imgOf, dateText } from './news_data.js';
import { Game } from './game.js';

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
const PRESS = /ニュース|新聞|週刊|速報|報道|通信/;
let CT = null; // contests.js (the player's unit name), loaded when it can be
import('./contests.js').then((m) => { CT = m; }).catch(() => { CT = null; });

// ================================================================ state
const READY = new WeakSet();
export function nstate(g) {
  const st = g.state;
  let s = st.newsApp;
  if (isObj(s) && READY.has(s)) return s;
  if (!isObj(s)) s = st.newsApp = {};
  const day = Math.max(1, num(st.day, 1));
  s.v = 1;
  s.base = Math.max(1, Math.floor(num(s.base, day)));
  s.seen = Math.max(0, Math.floor(num(s.seen, num(st.phone && st.phone.apps && st.phone.apps.news && st.phone.apps.news.seen, 0))));
  s.prevSeen = Math.max(0, Math.floor(num(s.prevSeen, s.seen)));
  const r = isObj(s.read) ? s.read : {};
  const keys = Object.keys(r);
  s.read = {};
  for (const k of keys.slice(-500)) s.read[k] = 1;
  s.gogai = isObj(s.gogai) ? Object.fromEntries(Object.entries(s.gogai).slice(-60).map(([k, v]) => [k, Math.floor(num(v))])) : {};
  s.q = typeof s.q === 'string' ? s.q.slice(0, 20) : '';
  READY.add(s);
  return s;
}

// ================================================================ dates
// The game day as a real date number (the politics calendar: 10 game days a month, real day 1, 4, … 28).
export function newsDateNum(g, day) {
  const dd = Math.max(1, Math.floor(num(day, g.state.day)));
  if (has(g, 'gameDate')) {
    const d = safe(() => g.gameDate(dd), null);
    if (d && Number.isFinite(Number(d.year))) {
      const dom = Number.isFinite(Number(d.doy)) ? (Number(d.doy) % 10) * 3 + 1 : num(d.dom, 1);
      return Number(d.year) * 10000 + Number(d.month) * 100 + dom;
    }
  }
  const n = dd - 1, idx = 3 + Math.floor(n / 10);
  const y0 = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 }[g.state.profile && g.state.profile.era] || 2026;
  return (y0 + Math.floor(idx / 12)) * 10000 + ((idx % 12) + 1) * 100 + (n % 10) * 3 + 1;
}
const DAY_CACHE = new WeakMap();
// the first game day whose date is on or after `n` (≤ today); 0 when it was before day 1
export function newsDayOf(g, n) {
  const st = g.state;
  let M = DAY_CACHE.get(st);
  const era = st.profile && st.profile.era;
  if (!M || M.era !== era) { M = new Map(); M.era = era; DAY_CACHE.set(st, M); }
  if (M.has(n)) return M.get(n);
  if (newsDateNum(g, 1) >= n) { M.set(n, 0); return 0; }
  let lo = 1, hi = Math.max(2, num(st.day, 1) + 400);
  while (lo < hi) { const mid = (lo + hi) >> 1; if (newsDateNum(g, mid) >= n) hi = mid; else lo = mid + 1; }
  M.set(n, lo);
  return lo;
}

// ================================================================ the player
function playerNames(g) {
  const st = g.state, out = [];
  if (st.name) out.push(String(st.name));
  const pr = st.profile;
  if (pr && pr.familyName && pr.givenName) { out.push(`${pr.familyName}${pr.givenName}`, `${pr.familyName} ${pr.givenName}`); }
  if (CT && CT.playerUnitName) { const u = safe(() => CT.playerUnitName(g), null); if (u && u !== 'あなた' && !out.includes(u)) out.push(String(u)); }
  return out.filter((x) => x && x.length >= 2);
}
const mentions = (names, t) => names.some((n) => t.includes(n));

// ================================================================ the feed
const CAT_W = { pol: 6, soc: 5, ent: 4, owarai: 4, intl: 4, eco: 3, sports: 3, weather: 2 };
// big events of the game itself → 号外 (only when they are this recent)
const GOGAI_RULES = [
  { re: /内閣総理大臣に/, mine: true },
  { re: /政権交代/ },
  { re: /(逮捕|起訴)/, mine: true },
  { re: /(宣戦布告|開戦|戦争が始まった|武力攻撃を受け)/ },
  { re: /(緊急事態を宣言|選挙を停止|国会を停止|クーデター)/ },
  { re: /(M-1グランプリ|キングオブコント|R-1).{0,24}(優勝|王者|チャンピオン)/, mine: true },
  { re: /ファン(100万人|30万人)/, mine: true },
];
const key = (s) => String(s).replace(/\s+/g, '').replace(/^【[^】]{1,12}】/, '').slice(0, 60);
function splitText(raw) {
  const t = String(raw || '').trim();
  const lines = t.split('\n').map((x) => x.trim()).filter(Boolean);
  let head = lines[0] || '';
  let body = lines.slice(1).join('\n');
  if (!body && head.length > 34) {
    const m = /^(.{8,40}?[。！])(.+)$/.exec(head);
    if (m) { head = m[1].replace(/。$/, ''); body = t; }
  }
  return { head: head.replace(/^【(ニュース|国際ニュース|政界)】/, ''), body };
}

// all items (cached per frame-ish: per day + inbox length + politics news length)
const CACHE = new WeakMap();
function stamp(g) {
  const st = g.state;
  const p = st.politics;
  const cs = has(g, 'contestState') ? safe(() => g.contestState(), null) : null;
  const w = st.world;
  return [st.day, st.phone && st.phone.inbox ? st.phone.inbox.length : 0, (st.phone && st.phone.inbox && st.phone.inbox[0] && st.phone.inbox[0].id) || 0,
    p && p.news ? p.news.length + ':' + (p.news[0] && p.news[0].text || '').length : 0, cs && cs.news ? cs.news.length + ':' + (cs.news[0] && cs.news[0].text || '').length : 0,
    w && w.news ? w.news.length : 0, st.profile && st.profile.era].join('|');
}
function allItems(g) {
  const st = g.state;
  const sk = stamp(g);
  const hit = CACHE.get(st);
  if (hit && hit.sk === sk) return hit.items;
  const items = [];
  const seenKeys = new Set();
  const names = playerNames(g);
  const add = (it) => {
    const k = key(it.head + (it.body ? it.body.slice(0, 10) : ''));
    const k2 = key(it.head);
    if (!it.head || seenKeys.has(k2)) return;
    seenKeys.add(k2);
    it.key = it.key || 'k:' + k;
    const all = `${it.head}\n${it.body || ''}`;
    it.mine = it.mine || mentions(names, all);
    it.img = it.img || imgOf(it.cat, all);
    items.push(it);
  };
  const today = num(st.day, 1);
  // 1. the phone's press messages
  for (const m of (st.phone && st.phone.inbox) || []) {
    if (!m || m.kind !== 'news' || !PRESS.test(String(m.from || ''))) continue;
    const { head, body } = splitText(m.text);
    add({ day: num(m.day, today), cat: catOfText(m.from, m.text), head, body, from: String(m.from), msg: m, key: 'm:' + (m.id ?? key(m.text)) });
  }
  // 2. the cores' news (politics / govt / regime / world in p.news; govt and world on their own too)
  const p = st.politics;
  const fromKind = { world: 'ドット新聞 国際部', regime: 'ドット新聞', govt: 'ドット新聞 政治部', politics: 'ドット新聞 政治部' };
  if (p && Array.isArray(p.news)) {
    for (const n of p.news) {
      if (!n || !n.text) continue;
      const cat = n.kind === 'world' ? 'intl' : n.kind === 'regime' ? (catOfText('', n.text) === 'soc' || catOfText('', n.text) === 'weather' ? 'soc' : 'pol') : 'pol';
      const { head, body } = splitText(n.text);
      add({ day: num(n.day, today), cat, head, body, from: fromKind[n.kind] || 'ドット新聞 政治部' });
    }
  }
  if (has(g, 'govtNews')) for (const n of [].concat(safe(() => g.govtNews(40), []) || [])) { const t = typeof n === 'string' ? n : n && n.text; if (t) { const { head, body } = splitText(t); add({ day: num(n && n.day, today), cat: 'pol', head, body, from: 'ドット新聞 政治部' }); } }
  if (has(g, 'worldNews')) for (const n of [].concat(safe(() => g.worldNews(40), []) || [])) { const t = typeof n === 'string' ? n : n && n.text; if (t) { const { head, body } = splitText(t); add({ day: num(n && n.day, today), cat: 'intl', head, body, from: 'ドット新聞 国際部' }); } }
  // 3. the comedy news (the contests' own log: what the morning cap held back is here too)
  const cs = has(g, 'contestState') ? safe(() => g.contestState(), null) : null;
  if (cs && Array.isArray(cs.news)) {
    for (const n of cs.news) {
      if (!n || !n.text || n.kind === 'personal') continue;
      const { head, body } = splitText(n.text);
      add({ day: num(n.day, today), cat: 'owarai', head, body, from: 'ドット芸能 お笑い速報' });
    }
  }
  // 4. real headlines up to today (those from before the first day: only the last ~2 months)
  const nowN = newsDateNum(g, today);
  const startN = newsDateNum(g, 1);
  const floorN = Math.floor(startN / 10000) * 10000 + Math.floor(startN / 100) % 100 * 100 - 200; // two months back (approx.)
  for (const r of REAL_NEWS) {
    const [dn, cat, head, body, o] = r;
    if (dn > nowN || dn < floorN) continue;
    const d = newsDayOf(g, dn);
    add({ day: Math.max(0, d), cat, head, body, from: { eco: 'ドット経済新聞', sports: 'ドットスポーツ', ent: 'ドット新聞 文化部' }[cat] || 'ドット新聞', real: true, date: dn, img: o && o.img, gengo: o && o.gengo, gogai: !!(o && o.gogai), key: 'r:' + dn + ':' + cat });
  }
  // 5. the season (the last three months of the game, one or two stories a month)
  const months = [];
  for (let back = 0; back < 3; back++) {
    const dd = today - back * 10;
    if (dd < 1) break;
    const n = newsDateNum(g, dd);
    const ym = Math.floor(n / 100);
    if (!months.includes(ym)) months.push(ym);
  }
  for (const ym of months) {
    const y = Math.floor(ym / 100), m = ym % 100;
    const pool = SEASONAL.map((s, i) => [s, i]).filter(([s]) => s[0] === m && y >= s[4] && y <= s[5]);
    pool.forEach(([s, i], j) => {
      // the k-th game day of the month (stable): spread through the month
      const first = newsDayOf(g, ym * 100 + 1);
      const d = first + ((j * 3 + (i % 3)) % 9);
      if (d > today || d < 1) return;
      add({ day: d, cat: s[1], head: s[2], body: s[3], from: s[1] === 'sports' ? 'ドットスポーツ' : 'ドット新聞', img: s[6], key: `s:${ym}:${i}`, season: true });
    });
  }
  // 6. today's market (経済) and weather (天気) when those modules are there
  const mk = newsMarket(g);
  if (mk) {
    const up = mk.change >= 0;
    const pts = Math.round(mk.price * Math.abs(mk.change) / (1 + mk.change));
    add({ day: today, cat: 'eco', head: `日経平均、${up ? '反発' : '反落'} ${Math.round(mk.price).toLocaleString('ja-JP')}円（${up ? '+' : '−'}${pts.toLocaleString('ja-JP')}円）`, body: `きょうの東京株式市場、日経平均株価の終値は${Math.round(mk.price).toLocaleString('ja-JP')}円。前日比${up ? '+' : '−'}${(Math.abs(mk.change) * 100).toFixed(2)}%。`, from: 'ドット経済新聞', img: up ? 'chartUp' : 'chartDown', key: 'mkt:' + today, market: true });
  }
  const wx = newsWeather(g);
  if (wx && wx.today) {
    const w = wx.today;
    if (num(w.typhoon) > 0) add({ day: today, cat: 'weather', head: `台風${w.typhoon}号が接近、${w.regionName || ''}は警戒を`, body: `${(w.warnings || []).map((x) => (typeof x === 'string' ? x : x && (x.label || x.name))).filter(Boolean).join('・') || '暴風や大雨に注意'}。不要不急の外出はひかえて。`, from: 'ドット新聞', img: 'typhoon', key: 'wx:' + today });
    else if ((w.warnings || []).length) add({ day: today, cat: 'weather', head: `${w.regionName || ''}に${(w.warnings || []).map((x) => (typeof x === 'string' ? x : x && (x.label || x.name))).filter(Boolean)[0] || '注意報'}`, body: `きょうの${w.regionName || ''}は${w.label}。最高${w.high}℃、最低${w.low}℃、降水確率${w.pop}%。`, from: 'ドット新聞', img: w.kind === 'snow' ? 'snow' : w.wet ? 'rain' : 'sun', key: 'wx:' + today });
  }
  // gogai for the game's own big events (within 3 days)
  for (const it of items) {
    if (it.real || it.gogai || today - it.day > 2) continue;
    const t = `${it.head}\n${it.body}`;
    if (GOGAI_RULES.some((r) => r.re.test(t) && (!r.mine || it.mine))) { it.gogai = true; it.key = it.key.replace(/^k:/, 'g:'); }
  }
  for (const it of items) it.prio = (it.gogai ? 100 : 0) + (it.mine ? 40 : 0) - Math.max(0, today - it.day) * 3 + (CAT_W[it.cat] || 2) + (it.real ? 4 : 0) - (it.season ? 6 : 0) - (it.market ? 5 : 0);
  items.sort((a, b) => b.day - a.day || b.prio - a.prio);
  if (items.length > 220) items.length = 220;
  CACHE.set(st, { sk, items });
  return items;
}

export function newsFeed(g, opts = {}) {
  if (!g || !g.state) return [];
  const S = nstate(g);
  let list = allItems(g);
  if (opts.cat && opts.cat !== 'top' && opts.cat !== 'all') list = list.filter((n) => n.cat === opts.cat);
  if (opts.mine) list = list.filter((n) => n.mine);
  const q = String(opts.q || '').trim();
  if (q) list = list.filter((n) => `${n.head}${n.body}${n.from}`.includes(q));
  list = list.map((n) => {
    const read = n.msg ? !!n.msg.read : !!S.read[n.key] || n.day < S.base;
    return { ...n, read, isNew: !read && n.day > S.prevSeen, dateText: n.date ? dateText(n.date) : '' };
  });
  if (opts.unread) list = list.filter((n) => !n.read);
  return list.slice(0, opts.limit || 120);
}
export function newsFront(g) {
  const S = nstate(g);
  const list = newsFeed(g, { limit: 220 });
  const today = num(g.state.day, 1);
  const recent = list.filter((n) => today - n.day <= 12);
  const pool = (recent.length >= 5 ? recent : list).slice();
  pool.sort((a, b) => b.prio - a.prio || b.day - a.day);
  const top = pool.find((n) => !n.season && !n.market) || pool[0] || null;
  const subs = [];
  const used = new Set(top ? [top.key] : []);
  for (const n of pool) { if (subs.length >= 4) break; if (used.has(n.key) || n.market) continue; if (subs.some((x) => x.cat === n.cat) && pool.filter((x) => !used.has(x.key)).length > 8) continue; subs.push(n); used.add(n.key); }
  const rest = list.filter((n) => !used.has(n.key));
  const gogai = list.filter((n) => n.gogai && !S.gogai[n.key] && today - n.day <= 3).sort((a, b) => b.day - a.day)[0] || null;
  const counts = {};
  for (const c of CATS) counts[c] = list.filter((n) => n.cat === c && n.isNew).length;
  return { top, subs, list: rest, gogai, counts, total: list.length };
}
export function newsUnreadCount(g) {
  if (!g || !g.state) return 0;
  const S = nstate(g);
  return allItems(g).filter((n) => (n.msg ? !n.msg.read && n.day > S.seen : n.day > S.seen && !S.read[n.key] && !n.season && !n.market)).length;
}
export function newsOpened(g) { const S = nstate(g); S.prevSeen = S.seen; S.seen = num(g.state.day, 1); return S; }
export function newsRead(g, it) {
  const S = nstate(g);
  if (!it) return;
  if (it.msg) it.msg.read = true;
  S.read[it.key] = 1;
  const ks = Object.keys(S.read);
  if (ks.length > 520) for (const k of ks.slice(0, ks.length - 500)) delete S.read[k];
}
export function newsGogaiSeen(g, it) { const S = nstate(g); if (it && it.key) S.gogai[it.key] = num(g.state.day, 1); }
export function newsSearch(g, q) { const S = nstate(g); S.q = String(q || '').slice(0, 20); return newsFeed(g, { q: S.q }); }

// ================================================================ market and weather boxes
const STOCKS = [['denki', 'ドット電機'], ['shoku', 'まるどっと食品'], ['media', '星くずメディア']];
export function newsMarket(g) {
  if (!has(g, 'marketQuote')) return null;
  const q = safe(() => g.marketQuote('index'), null);
  if (!q || !Number.isFinite(Number(q.price))) return null;
  const stocks = STOCKS.map(([id, name]) => { const s = safe(() => g.marketQuote(id), null); return s && Number.isFinite(Number(s.price)) ? { id, name, price: s.price, change: num(s.change) } : null; }).filter(Boolean);
  return { price: Number(q.price), change: num(q.change), series: Array.isArray(q.series) ? q.series.slice(-30) : [], stocks };
}
export const WX_REGIONS = [['hokkaido', '札幌'], ['tohoku', '仙台'], ['tokyo', '東京'], ['chubu', '名古屋'], ['osaka', '大阪'], ['chugoku', '広島'], ['shikoku', '高松'], ['kyushu', '福岡'], ['okinawa', '那覇']];
export function newsWeather(g) {
  if (!has(g, 'weather')) return null;
  const today = safe(() => g.weather(), null);
  if (!today) return null;
  const regions = WX_REGIONS.map(([id, city]) => { const w = safe(() => g.weather(g.state.day, id), null); return w ? { id, city, kind: w.dayKind || w.kind, label: w.label, high: w.high, low: w.low, pop: w.pop } : null; }).filter(Boolean);
  const week = has(g, 'forecast') ? safe(() => g.forecast(7), []) || [] : [];
  const osakaWeek = has(g, 'forecast') ? safe(() => g.forecast(7, 'osaka'), []) || [] : [];
  return { today, regions, week, osakaWeek };
}

// ================================================================ g.*
const methods = {
  newsFeed(opts = {}) { return newsFeed(this, opts || {}); },
  newsFront() { return this.state ? newsFront(this) : null; },
  newsUnread() { return newsUnreadCount(this); },
};
for (const k of Object.keys(methods)) Object.defineProperty(Game.prototype, k, { value: methods[k], configurable: true, writable: true });
export { SEC };
