// 鉄道ネットワーク (owner: R9-B1) — pure data and routing, no drawing, no DOM. Read by js/world/eki.js (the
// 駅構内 place 'eki', rides, the HD 路線図), js/world/ekimae*.js (the 駅前 areas), the 乗換案内 app
// (js/engine/phone_apps3_move.js) and the マップ app (js/engine/phone_apps.js, the [R9-B1] map region).
//
// Line names are fictional (ドット環状線, ドット中央線, ドットメトロ, ドット多摩線, ドット環状線（大阪）, ドット御堂筋線);
// station and place names are real. Kilometres and minutes are rounded from the real lines they resemble
// (山手線・中央線快速・銀座線・副都心線・京王線/小田急線・大阪環状線・御堂筋線); fares are a simple distance table
// (today's yen inside the game; every era shows its own price through util.js fmtMoney).
//
// Era facts (checked 2026-10): 副都心線 (雑司が谷・北参道 …) opened 2008-06-14; 高輪ゲートウェイ 2020-03-14;
// Suica 2001-11-18, ICOCA 2003-11-01, Suica⇔ICOCA (JR) 2004-08-01, PASMO 2007-03-18, 大阪市交通局 PiTaPa (and
// ICOCA through the PiTaPa link) 2006-02, 全国相互利用 2013-03-23; 首都圏の自動改札 spread from 1990 (関西 earlier);
// 中央線快速 does not stop at 高円寺・阿佐ケ谷 on 土休日; 新幹線 東京–新大阪 times: phone_apps3_move.js shinkansenMin.

export const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);

// ---------------------------------------------------------------- the calendar
// { year, month } of the game (politics core's g.gameDate, else April of the era's first year + day/10).
export function dateOf(g) {
  try {
    if (g && typeof g.gameDate === 'function') {
      const d = g.gameDate();
      if (d && Number.isFinite(d.year)) return { year: d.year, month: Math.max(1, Math.min(12, Math.round(d.month || 1))) };
    }
  } catch (e) { /* fall back */ }
  const era = (g && g.state && g.state.profile && g.state.profile.era) || 'reiwa';
  const n = Math.max(0, num(g && g.state && g.state.day, 1) - 1);
  const idx = 3 + Math.floor(n / 10);
  return { year: (ERA_BASE[era] || 2026) + Math.floor(idx / 12), month: (idx % 12) + 1 };
}
export const ymOf = (g) => { const d = dateOf(g); return d.year * 100 + d.month; };
export const eraOf = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_BASE[e] ? e : 'reiwa'; };

// ---------------------------------------------------------------- stations
// region: 'tokyo' | 'osaka'. place: the town / 駅前 area you come out to (null = ride through only; shown on the map).
// mx, my: the HD 路線図 (640x360) position on its region's page; lab: where the name goes ('l' 'r' 't' 'b').
// open: first year-month the station exists (yyyymm). jr: the JR-style name when it differs (大阪 for 梅田).
export const STATIONS = {
  // ---- 東京
  tokyo: { name: '東京', kana: 'とうきょう', region: 'tokyo', place: 'tokyo', mx: 488, my: 176, lab: 'r', big: true },
  akihabara: { name: '秋葉原', kana: 'あきはばら', region: 'tokyo', place: 'ekimae_akihabara', mx: 472, my: 124, lab: 'r' },
  ueno: { name: '上野', kana: 'うえの', region: 'tokyo', place: 'ekimae_ueno', mx: 440, my: 84, lab: 't', big: true },
  ikebukuro: { name: '池袋', kana: 'いけぶくろ', region: 'tokyo', place: null, mx: 280, my: 84, lab: 't', big: true },
  shinjuku: { name: '新宿', kana: 'しんじゅく', region: 'tokyo', place: 'ekimae_shinjuku', mx: 262, my: 154, lab: 'b', big: true },
  harajuku: { name: '原宿', kana: 'はらじゅく', region: 'tokyo', place: null, mx: 262, my: 206, lab: 'l' },
  shibuya: { name: '渋谷', kana: 'しぶや', region: 'tokyo', place: 'ekimae_shibuya', mx: 284, my: 250, lab: 'b', big: true },
  shinagawa: { name: '品川', kana: 'しながわ', region: 'tokyo', place: null, mx: 392, my: 270, lab: 'b' },
  takanawa: { name: '高輪ゲートウェイ', kana: 'たかなわげーとうぇい', region: 'tokyo', place: null, mx: 436, my: 256, lab: 'r', open: 202003 },
  kanraku: { name: '新橋', kana: 'しんばし', region: 'tokyo', place: 'kanraku', mx: 470, my: 226, lab: 'r' },
  yotsuya: { name: '四ツ谷', kana: 'よつや', region: 'tokyo', place: null, mx: 372, my: 162, lab: 'b' },
  nakano: { name: '中野', kana: 'なかの', region: 'tokyo', place: null, mx: 206, my: 154, lab: 't' },
  koenji: { name: '高円寺', kana: 'こうえんじ', region: 'tokyo', place: null, mx: 160, my: 154, lab: 'b' },
  machi: { name: '阿佐ケ谷', kana: 'あさがや', region: 'tokyo', place: 'machi', mx: 114, my: 154, lab: 't' },
  kichijoji: { name: '吉祥寺', kana: 'きちじょうじ', region: 'tokyo', place: null, mx: 58, my: 154, lab: 'b' },
  asakusa: { name: '浅草', kana: 'あさくさ', region: 'tokyo', place: 'ekimae_asakusa', mx: 566, my: 70, lab: 'b' },
  nagatacho: { name: '永田町', kana: 'ながたちょう', region: 'tokyo', place: 'nagatacho', mx: 392, my: 206, lab: 'b' },
  minato: { name: '六本木', kana: 'ろっぽんぎ', region: 'tokyo', place: 'minato', mx: 340, my: 232, lab: 'b' },
  zoshigaya: { name: '雑司が谷', kana: 'ぞうしがや', region: 'tokyo', place: null, mx: 300, my: 108, lab: 'r', open: 200806 },
  shinjuku3: { name: '新宿三丁目', kana: 'しんじゅくさんちょうめ', region: 'tokyo', place: null, mx: 304, my: 146, lab: 'r', open: 200806 },
  kitasando: { name: '北参道', kana: 'きたさんどう', region: 'tokyo', place: null, mx: 306, my: 190, lab: 'r', open: 200806 },
  shimokita: { name: '下北沢', kana: 'しもきたざわ', region: 'tokyo', place: 'ekimae_shimokita', mx: 204, my: 224, lab: 'l' },
  chofu: { name: '調布', kana: 'ちょうふ', region: 'tokyo', place: 'ekimae_chofu', mx: 140, my: 256, lab: 'l' },
  fuchu: { name: '府中', kana: 'ふちゅう', region: 'tokyo', place: 'ekimae_fuchu', mx: 74, my: 282, lab: 'r' },
  // ---- 大阪
  umeda: { name: '梅田', jr: '大阪', kana: 'うめだ', region: 'osaka', place: 'osaka_umeda', mx: 334, my: 100, lab: 'r', big: true },
  tenma: { name: '天満', kana: 'てんま', region: 'osaka', place: null, mx: 404, my: 118, lab: 'r' },
  kyobashi: { name: '京橋', kana: 'きょうばし', region: 'osaka', place: null, mx: 438, my: 170, lab: 'r', big: true },
  tsuruhashi: { name: '鶴橋', kana: 'つるはし', region: 'osaka', place: null, mx: 430, my: 236, lab: 'r' },
  tennoji: { name: '天王寺', kana: 'てんのうじ', region: 'osaka', place: null, mx: 352, my: 284, lab: 'b', big: true },
  shinimamiya: { name: '新今宮', kana: 'しんいまみや', region: 'osaka', place: null, mx: 270, my: 272, lab: 'b' },
  bentencho: { name: '弁天町', kana: 'べんてんちょう', region: 'osaka', place: null, mx: 228, my: 216, lab: 'l' },
  nishikujo: { name: '西九条', kana: 'にしくじょう', region: 'osaka', place: null, mx: 234, my: 152, lab: 'l' },
  fukushima: { name: '福島', kana: 'ふくしま', region: 'osaka', place: null, mx: 272, my: 108, lab: 'l' },
  shinosaka: { name: '新大阪', kana: 'しんおおさか', region: 'osaka', place: null, mx: 334, my: 56, lab: 'r', big: true },
  yodoyabashi: { name: '淀屋橋', kana: 'よどやばし', region: 'osaka', place: null, mx: 338, my: 136, lab: 'r' },
  honmachi: { name: '本町', kana: 'ほんまち', region: 'osaka', place: null, mx: 338, my: 164, lab: 'r' },
  shinsaibashi: { name: '心斎橋', kana: 'しんさいばし', region: 'osaka', place: null, mx: 338, my: 192, lab: 'r' },
  namba: { name: 'なんば', kana: 'なんば', region: 'osaka', place: 'namba', mx: 338, my: 220, lab: 'r', big: true },
  dobutsuen: { name: '動物園前', kana: 'どうぶつえんまえ', region: 'osaka', place: 'osaka_shinsekai', mx: 318, my: 254, lab: 'l' },
};
export const TOWN_STATIONS = ['tokyo', 'machi', 'minato', 'nagatacho', 'kanraku', 'namba'];

// ---------------------------------------------------------------- lines
// stops: [stationId, cumulative km, cumulative minutes]. loop: [km, min] back to the first stop.
// op: the fare operator (a ride through several lines of one operator pays one fare by the total km).
// icFrom: first year-month an IC card works on it. wait: average wait for a train (minutes, daytime).
export const LINES = {
  kanjo: {
    name: 'ドット環状線', short: '環状線', color: '#3fae49', region: 'tokyo', op: 'jre', kind: 'jr', wait: 3,
    stops: [['tokyo', 0, 0], ['akihabara', 2.0, 4], ['ueno', 3.6, 7], ['ikebukuro', 12.3, 24], ['shinjuku', 17.1, 33], ['harajuku', 19.3, 37], ['shibuya', 20.5, 39], ['shinagawa', 27.7, 51], ['takanawa', 28.6, 53], ['kanraku', 32.3, 59]],
    loop: [34.5, 63],
  },
  chuo: {
    name: 'ドット中央線', short: '中央線', color: '#f0821e', region: 'tokyo', op: 'jre', kind: 'jr', wait: 3,
    stops: [['tokyo', 0, 0], ['yotsuya', 6.6, 10], ['shinjuku', 10.3, 15], ['nakano', 14.7, 20], ['koenji', 16.1, 22], ['machi', 17.3, 24], ['kichijoji', 22.5, 30]],
    weekendSkip: ['koenji', 'machi'],
  },
  sakura: {
    name: 'ドットメトロ さくら線', short: 'さくら線', color: '#e8609a', region: 'tokyo', op: 'dotmetro', kind: 'metro', wait: 2,
    stops: [['asakusa', 0, 0], ['ueno', 2.2, 5], ['tokyo', 5.5, 12], ['kanraku', 7.6, 17], ['nagatacho', 10.2, 23], ['minato', 12.4, 28], ['shibuya', 15.6, 35]],
  },
  wakaba: {
    name: 'ドットメトロ わかば線', short: 'わかば線', color: '#a8743a', region: 'tokyo', op: 'dotmetro', kind: 'metro', wait: 3, open: 200806,
    stops: [['ikebukuro', 0, 0], ['zoshigaya', 1.8, 3], ['shinjuku3', 6.3, 10], ['kitasando', 7.7, 13], ['shibuya', 10.1, 17]],
  },
  tama: {
    name: 'ドット多摩線', short: '多摩線', color: '#9a3fa8', region: 'tokyo', op: 'tama', kind: 'private', wait: 4,
    stops: [['shinjuku', 0, 0], ['shimokita', 6.6, 8], ['chofu', 18.0, 21], ['fuchu', 24.4, 28]],
  },
  okanjo: {
    name: 'ドット環状線（大阪）', short: '大阪環状線', color: '#f26b2a', region: 'osaka', op: 'jrw', kind: 'jr', wait: 3,
    stops: [['umeda', 0, 0], ['tenma', 1.6, 3], ['kyobashi', 4.2, 7], ['tsuruhashi', 8.1, 14], ['tennoji', 11.0, 20], ['shinimamiya', 12.2, 22], ['bentencho', 16.4, 30], ['nishikujo', 17.9, 33], ['fukushima', 20.2, 37]],
    loop: [21.7, 40],
  },
  midosuji: {
    name: 'ドット御堂筋線', short: '御堂筋線', color: '#e5171f', region: 'osaka', op: 'omt', kind: 'metro', wait: 2,
    stops: [['shinosaka', 0, 0], ['umeda', 4.1, 6], ['yodoyabashi', 5.4, 8], ['honmachi', 6.6, 10], ['shinsaibashi', 7.6, 12], ['namba', 8.5, 14], ['dobutsuen', 10.6, 18], ['tennoji', 12.0, 20]],
  },
  shinkansen: {
    name: '新幹線', short: '新幹線', color: '#2a5ad0', region: 'both', op: 'shin', kind: 'shinkansen', wait: 8,
    stops: [['tokyo', 0, 0], ['shinosaka', 552.6, 150]],
  },
};
export const LINE_ORDER = ['kanjo', 'chuo', 'sakura', 'wakaba', 'tama', 'okanjo', 'midosuji', 'shinkansen'];
// walking transfers between two nearby stations: [a, b, minutes, label]
export const WALKS = [
  ['shinjuku', 'shinjuku3', 6, '地下通路を歩いて乗りかえ'],
  ['shinimamiya', 'dobutsuen', 4, '駅の外を歩いて乗りかえ'],
];
const IC_FROM = { jre: 200111, dotmetro: 200703, tama: 200703, jrw: 200311, omt: 200602, shin: 999999 };
const CARD = { tokyo: 'Suica', osaka: 'ICOCA' };

// 東京–新大阪 fastest time by year (matches phone_apps3_move.js shinkansenMin) + about 10 minutes of boarding.
export function shinkansenMin(year, month = 6) {
  const ym = year * 100 + month;
  if (ym >= 202003) return 141;
  if (ym >= 201503) return 142;
  if (ym >= 200707) return 145;
  if (ym >= 199203) return 150;
  return 176;
}
export const shinName = (ym) => (ym >= 199203 ? 'のぞみ' : 'ひかり');

// ---------------------------------------------------------------- era
export const stationOpen = (id, ym) => { const s = STATIONS[id]; return !!s && (!s.open || ym >= s.open); };
export const lineOpen = (id, ym) => { const l = LINES[id]; return !!l && (!l.open || ym >= l.open); };
// the open stops of a line now (closed stations are passed by: their minutes stay in the cumulative values)
export function stopsOf(lineId, ym) {
  const L = LINES[lineId];
  if (!L || !lineOpen(lineId, ym)) return [];
  const out = L.stops.filter((s) => stationOpen(s[0], ym));
  if (lineId === 'shinkansen') { const d = Math.floor(ym / 100), m = ym % 100; out[1] = ['shinosaka', 552.6, shinkansenMin(d, m)]; }
  return out;
}
export function linesAt(stId, ym) {
  return LINE_ORDER.filter((l) => stopsOf(l, ym).some((s) => s[0] === stId));
}
export const stName = (id) => (STATIONS[id] ? STATIONS[id].name : String(id));
export const stLabel = (id) => (STATIONS[id] ? `${STATIONS[id].name}駅` : String(id));
// the station of a place (a town / 駅前 area id), or null
export function stationOfPlace(placeId) {
  for (const [id, s] of Object.entries(STATIONS)) if (s.place === placeId) return id;
  return null;
}
export const enterable = (id) => !!(STATIONS[id] && STATIONS[id].place);

// ---------------------------------------------------------------- service (終電・始発・天気)
// total: g.clock().total (minutes since the day's midnight, 24:00+ after midnight), or null without the clock.
export function clockTotal(g) {
  try { if (g && typeof g.clock === 'function') { const c = g.clock(); if (c && Number.isFinite(c.total)) return c.total; } } catch (e) { /* none */ }
  return null;
}
export const LAST_TRAIN = 24 * 60 + 35; // 0:35 — the last trains have left
export const FIRST_TRAIN = 28 * 60 + 45; // 4:45 the next morning
export const SHIN_LAST = 21 * 60 + 30, SHIN_FIRST = 6 * 60;
function weatherKind(g) {
  try { if (g && typeof g.weather === 'function') { const w = g.weather(); return w && w.kind; } } catch (e) { /* none */ }
  return null;
}
// → { ok, why, wait (minutes until service, when it can be waited for), delay, delayWhy }
export function serviceNow(g, kinds = ['jr']) {
  const t = clockTotal(g);
  const w = weatherKind(g);
  const out = { ok: true, why: null, wait: 0, delay: 0, delayWhy: null };
  if (w === 'typhoon') return { ...out, ok: false, why: '台風のため、運転を見合わせています', wait: null };
  if (t != null) {
    if (kinds.includes('shinkansen') && (t >= SHIN_LAST || t < SHIN_FIRST)) return { ...out, ok: false, why: '新幹線の最終は出てしまった（始発は朝6時ごろ）', wait: null };
    if (t >= LAST_TRAIN && t < FIRST_TRAIN) return { ...out, ok: false, why: '終電はもう出てしまった（始発は4時45分ごろ）', wait: FIRST_TRAIN - t };
  }
  if (w === 'snow') { out.delay = 15; out.delayWhy = '大雪で遅れ'; }
  else if (w === 'storm') { out.delay = 8; out.delayWhy = '雷雨で遅れ'; }
  else if (w === 'heavyrain') { out.delay = 5; out.delayWhy = '大雨で遅れ'; }
  return out;
}
// rush hours (minutes of the day): 満員電車
export function rushNow(g) {
  const t = clockTotal(g);
  if (t == null) return false;
  const m = t % 1440;
  return (m >= 450 && m < 570) || (m >= 1050 && m < 1170);
}
const lateNight = (g) => { const t = clockTotal(g); return t != null && (t % 1440 >= 1320 || t >= 1440); };

// ---------------------------------------------------------------- routing
// route(g, from, to) → null | { from, to, segs: [{ line, from, to, km, min, stops }], walks: [...], transfers, km, min,
//   wait, delay, delayWhy, fare, fares: [{ op, km, fare }], kinds, ic: { ok, card, why }, text }
function weekend(g) {
  try { const d = num(g && g.state && g.state.day, 1); return ((d - 1) % 7) >= 5; } catch (e) { return false; }
}
function graph(ym) {
  const adj = new Map(); // node 'st|line' -> [{ to, min, km, line }]
  const add = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, ...e }); };
  for (const id of LINE_ORDER) {
    const st = stopsOf(id, ym);
    const L = LINES[id];
    for (let i = 0; i + 1 < st.length; i++) {
      const [a, ka, ma] = st[i], [b, kb, mb] = st[i + 1];
      add(`${a}|${id}`, `${b}|${id}`, { min: mb - ma, km: kb - ka, line: id });
      add(`${b}|${id}`, `${a}|${id}`, { min: mb - ma, km: kb - ka, line: id });
    }
    if (L.loop && st.length > 2) {
      const [a, ka, ma] = st[st.length - 1], [b] = st[0];
      const [lk, lm] = L.loop;
      add(`${a}|${id}`, `${b}|${id}|loop`, { min: lm - ma, km: lk - ka, line: id });
      add(`${b}|${id}`, `${a}|${id}`, { min: lm - ma, km: lk - ka, line: id });
    }
  }
  // the loop's closing edge lands on the same node
  for (const [k, list] of adj) for (const e of list) if (e.to.endsWith('|loop')) e.to = e.to.slice(0, -5);
  return adj;
}
export function route(g, from, to, opt = {}) {
  const ym = opt.ym || ymOf(g);
  if (!STATIONS[from] || !STATIONS[to] || from === to || !stationOpen(from, ym) || !stationOpen(to, ym)) return null;
  const adj = graph(ym);
  const XFER = 5;
  const dist = new Map(), prev = new Map();
  const pq = [];
  const push = (node, d, p, how) => {
    if (dist.has(node) && dist.get(node) <= d) return;
    dist.set(node, d); prev.set(node, { p, how });
    pq.push([d, node]);
  };
  for (const l of linesAt(from, ym)) push(`${from}|${l}`, 0, null, { kind: 'start' });
  for (const [a, b, m, label] of WALKS) {
    const o = a === from ? b : b === from ? a : null;
    if (o && stationOpen(o, ym)) for (const l of linesAt(o, ym)) push(`${o}|${l}`, m, null, { kind: 'walk', from, to: o, min: m, label });
  }
  let best = null;
  while (pq.length) {
    pq.sort((x, y) => x[0] - y[0]);
    const [d, node] = pq.shift();
    if (d > dist.get(node)) continue;
    const [st, line] = node.split('|');
    if (st === to) { best = node; break; }
    for (const e of adj.get(node) || []) push(e.to, d + e.min, node, { kind: 'ride', line: e.line, min: e.min, km: e.km });
    for (const l of linesAt(st, ym)) if (l !== line) push(`${st}|${l}`, d + XFER + (l === 'shinkansen' || line === 'shinkansen' ? 5 : 0), node, { kind: 'xfer', st, min: XFER });
    for (const [a, b, m, label] of WALKS) {
      const o = a === st ? b : b === st ? a : null;
      if (o && stationOpen(o, ym)) for (const l of linesAt(o, ym)) push(`${o}|${l}`, d + m, node, { kind: 'walk', from: st, to: o, min: m, label });
    }
  }
  if (!best) return null;
  // rebuild: steps from the start
  const steps = [];
  for (let n = best; n; n = prev.get(n) && prev.get(n).p) {
    const pr = prev.get(n);
    steps.unshift({ node: n, ...pr.how });
    if (!pr.p) break;
  }
  const segs = [];
  const walks = [];
  let transfers = 0;
  for (const s of steps) {
    const [st] = s.node.split('|');
    if (s.kind === 'ride') {
      const last = segs[segs.length - 1];
      if (last && last.line === s.line && last.open) { last.to = st; last.km += s.km; last.min += s.min; last.stops++; }
      else segs.push({ line: s.line, from: null, to: st, km: s.km, min: s.min, stops: 1, open: true });
    } else if (s.kind === 'xfer' || s.kind === 'walk') {
      if (segs.length) segs[segs.length - 1].open = false;
      if (s.kind === 'walk') walks.push({ from: s.from, to: s.to, min: s.min, label: s.label, after: segs.length });
    }
  }
  // fill in each segment's start
  let at = from;
  let wi = 0;
  for (let i = 0; i < segs.length; i++) {
    while (wi < walks.length && walks[wi].after <= i) { at = walks[wi].to; wi++; }
    segs[i].from = at;
    at = segs[i].to;
    delete segs[i].open;
  }
  // 土休日: the 中央線 快速 passes 高円寺・阿佐ケ谷 (a local train: +3 minutes)
  if (weekend(g)) for (const s of segs) if (LINES[s.line].weekendSkip && (LINES[s.line].weekendSkip.includes(s.to) || LINES[s.line].weekendSkip.includes(s.from))) { s.min += 3; s.local = true; }
  transfers = Math.max(0, segs.length - 1);
  const kinds = [...new Set(segs.map((s) => LINES[s.line].kind))];
  const svc = serviceNow(g, kinds);
  const firstLine = segs[0] ? LINES[segs[0].line] : null;
  const wait = firstLine ? Math.round(firstLine.wait * (lateNight(g) ? 2 : 1)) : 0;
  const rideMin = segs.reduce((a, s) => a + s.min, 0) + walks.reduce((a, w) => a + w.min, 0) + transfers * XFER;
  const delay = svc.delay * (kinds.includes('shinkansen') ? 2 : 1);
  const fares = faresOf(g, segs);
  const fare = fares.reduce((a, f) => a + f.fare, 0);
  const km = Math.round(segs.reduce((a, s) => a + s.km, 0) * 10) / 10;
  const r = { from, to, segs, walks, transfers, km, min: rideMin + wait + delay, ride: rideMin, wait, delay, delayWhy: svc.delayWhy, fare, fares, kinds, service: svc };
  r.ic = icFor(g, r);
  r.text = routeText(r);
  return r;
}

// ---------------------------------------------------------------- fares
const TABLES = {
  jre: [[3, 160], [6, 180], [10, 210], [15, 240], [20, 330], [25, 410], [30, 490], [35, 580], [40, 660]],
  jrw: [[3, 140], [6, 170], [10, 200], [15, 230], [20, 310], [25, 400]],
  dotmetro: [[6, 180], [11, 210], [19, 260], [27, 300], [99, 330]],
  tama: [[4, 140], [8, 170], [13, 200], [18, 250], [23, 280], [99, 310]],
  omt: [[3, 190], [7, 240], [13, 290], [19, 340], [99, 390]],
};
function tableFare(op, km) {
  const t = TABLES[op];
  if (!t) return 0;
  for (const [k, f] of t) if (km <= k) return f;
  const [k0, f0] = t[t.length - 1];
  return f0 + 80 * Math.ceil((km - k0) / 5);
}
// the 新幹線 fare is station.js FARE (the game's 東京⇔大阪 ticket), set by eki.js: setShinkansenFare(n)
let SHIN_FARE = 3000;
export function setShinkansenFare(n) { if (Number.isFinite(n) && n > 0) SHIN_FARE = n; }
export function faresOf(g, segs) {
  const out = [];
  for (const s of segs) {
    const op = LINES[s.line].op;
    const last = out[out.length - 1];
    if (last && last.op === op) { last.km += s.km; continue; }
    out.push({ op, km: s.km, line: s.line });
  }
  for (const f of out) { f.km = Math.round(f.km * 10) / 10; f.fare = f.op === 'shin' ? SHIN_FARE : tableFare(f.op, f.km); }
  return out;
}

// ---------------------------------------------------------------- IC cards
// The player's card: g.state.eki.ic = 'tokyo' | 'osaka' (bought at a 券売機) — in the スマホ era the phone is the card.
export function cardName(region) { return CARD[region] || 'ICカード'; }
export function icStart(region) { return region === 'osaka' ? 200311 : 200111; }
export function icEra(g, region) { return ymOf(g) >= icStart(region); }
export function phoneCard(g) { return eraOf(g) === 'reiwa'; }
export function cardOf(g) {
  if (phoneCard(g)) return 'phone';
  const e = g && g.state && g.state.eki;
  return e && (e.ic === 'tokyo' || e.ic === 'osaka') ? e.ic : null;
}
// can the player ride this route with their IC card? → { ok, card, why }
export function icFor(g, r) {
  const ym = ymOf(g);
  const card = cardOf(g);
  if (!card) return { ok: false, card: null, why: ym < 200111 ? null : 'ICカードを持っていない' };
  for (const f of r.fares) {
    if (f.op === 'shin') return { ok: false, card, why: '新幹線は、きっぷを買って乗る' };
    if (ym < IC_FROM[f.op]) return { ok: false, card, why: `${LINES[f.line].name}では、まだICカードが使えない` };
    const lineRegion = LINES[f.line].region;
    if (card !== 'phone' && card !== lineRegion) {
      const need = f.op === 'jre' || f.op === 'jrw' ? 200408 : 201303;
      if (ym < need) return { ok: false, card, why: `${cardName(card)}は、${lineRegion === 'osaka' ? '大阪' : '東京'}の${LINES[f.line].short}ではまだ使えない` };
    }
  }
  return { ok: true, card, why: null };
}
export function cardLabel(g, region) {
  const c = cardOf(g);
  if (c === 'phone') return `スマホの${cardName(region)}`;
  return c ? cardName(c) : cardName(region);
}

// ---------------------------------------------------------------- text
export function routeText(r) {
  if (!r) return '';
  return r.segs.map((s) => `${LINES[s.line].short}（${stName(s.from)}→${stName(s.to)}）`).join(' → ');
}
export const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ''}` : `${m}分`; };

// ---------------------------------------------------------------- distances (the マップ / 乗換案内 apps)
// A place's offset from 東京駅 in tiles (≈ 50 m): the six towns keep the apps' schematic offsets; the 駅前 areas
// use their real distance (rounded). osaka: in 大阪 (offsets from なんば).
export const AREA_POS = {
  ekimae_akihabara: { ox: -10, oy: -40 }, ekimae_ueno: { ox: 0, oy: -76 }, ekimae_shinjuku: { ox: -140, oy: -24 },
  ekimae_shibuya: { ox: -130, oy: 70 }, ekimae_asakusa: { ox: 40, oy: -90 }, ekimae_shimokita: { ox: -180, oy: 70 },
  ekimae_chofu: { ox: -360, oy: 90 }, ekimae_fuchu: { ox: -440, oy: 60 },
  osaka_umeda: { ox: 0, oy: -80, osaka: true }, osaka_shinsekai: { ox: 10, oy: 40, osaka: true },
};
// nearest station of a town / area id (the six towns and the 駅前 areas)
export const stationOf = (placeId) => stationOfPlace(placeId);
