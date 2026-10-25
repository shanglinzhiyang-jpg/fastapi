// 投資 (手帳の時代: 証券会社に電話 / ケータイ: ネット証券 / スマホ: 投資アプリ) and フリマ
// (手帳: リサイクルショップの出張買取 / ケータイ: ネットオークション (1999-09〜) / 2012-07〜: フリマアプリ).
//
// 投資: 日経平均に連動するファンド and three listed companies of this world. The index follows the real
// 日経平均 by date (monthly anchors below, interpolated on a log scale; the day-to-day wiggle is noise
// around it), so the real bubble (1987–1989, peak 38,915.87 on 1989-12-29), Black Monday (1987-10-20,
// −14.90%), the bubble's collapse (1990–1992), the IT bubble (2000), the 2003 low (7,607.88), the
// Lehman shock (2008-10, −11.41% on 10-16; 7,054.98 on 2009-03-10), 2011-03-15 (−10.55%), the 2024-02-22
// new high and 2024-08-05 (−12.40%), 2025 (¥50,339 at the year end), 2026 (50,559 on 03-31, 72,366 on
// 06-25, 64,362 on 07-31) all happen. After the last anchor the market is a random walk (drift +4%/年,
// 18%/年 volatility, rare crashes): no gain is guaranteed. Prices move once a day (in the morning), so
// buying and selling the same day only costs fees. Fees by device: 対面 (手帳: 委託手数料 1.15%,
// at least ¥2,500 before the 1999-10 自由化; funds 3% 購入時手数料), ネット証券 (ケータイ: 0.1%, min ¥100;
// funds 1%), スマホ (2023-10 手数料ゼロ; ノーロード). Tax on gains: 1989-03 まで原則非課税, 1989-04 申告分離
// 26%, 2003 軽減税率 10%, 2014 20.315%. NISA from 2014-01 (年¥100万, 2016〜 ¥120万, 2024〜 新NISA
// 年¥360万 (成長投資枠¥240万) ・生涯¥1,800万), tax-free. Sources: indexes.nikkei.co.jp (monthly
// reports 2023-12, 2026-06), 共同通信 (kumanichi.com 2026-06-25 / 06-30 / 10-21), year-end closes
// (sbbit.jp, sakigake.jp 2025-12-30). Points between the anchors are rounded estimates.
//
// フリマ: sell what you do not use (もちもの that are not food or keepsakes, and furniture). The
// shop pays at once but little (items 20%, furniture 30%; the furniture shop's own 引き取り is 50%);
// an auction ends after 3 days (bids decide the price; 落札手数料 5%); a フリマアプリ listing sells
// some morning within 14 days, the cheaper the sooner (販売手数料 10% from 2014-10, 送料). Nothing
// ever sells above what it cost new. Facts: Yahoo!オークション 1999-09; フリル 2012-07; メルカリ 2013-07,
// its 10% fee from 2014-10-01.

import { fmtMoney, clamp, shade } from './util.js';
import { ITEMS } from './state.js';
import { FURNITURE } from './life.js';
import { audio } from './audio.js';
import { phoneView, phoneList, phoneInfo, phoneConfirm } from './phone.js';
import { panelView, rowsList } from './phone_apps.js';
import {
  num, isObj, arr, str, has, safe, R, disc, devOf, dateOf, ymOf, realT, part, definePart, rnd, gaussR, toInternal, pct, commas,
  bar, lineChart, chip, buttons, hit, T, fitText, PC, box, rrect, para, yearOf,
} from './phone_apps3_kit.js';

export const INV_COLOR = '#1f7a5a';
export const FURIMA_COLOR = '#e0563a';
export const investTitle = (g) => ({ techo: '証券', keitai: '株', smart: '投資' })[devOf(g)];

// ======================================================================== the market
// [year, month, day, 日経平均 close]
const ANCHORS = [
  [1986, 12, 30, 18701], [1987, 3, 31, 21566], [1987, 4, 30, 23274], [1987, 6, 30, 24176], [1987, 9, 30, 26011], [1987, 10, 19, 25746],
  [1987, 10, 20, 21910], [1987, 10, 30, 22765], [1987, 12, 28, 21564], [1988, 3, 31, 26260], [1988, 6, 30, 27769], [1988, 9, 30, 27924],
  [1988, 12, 28, 30159], [1989, 3, 31, 32839], [1989, 6, 30, 32948], [1989, 9, 29, 35637], [1989, 12, 29, 38916], [1990, 1, 31, 37189],
  [1990, 2, 28, 34592], [1990, 3, 30, 29980], [1990, 4, 2, 28002], [1990, 6, 29, 31940], [1990, 8, 31, 25978], [1990, 10, 1, 20222],
  [1990, 12, 28, 23849], [1991, 3, 29, 26292], [1991, 6, 28, 23290], [1991, 9, 30, 23916], [1991, 12, 30, 22984], [1992, 3, 31, 19346],
  [1992, 8, 18, 14309], [1992, 12, 28, 16925], [1993, 6, 30, 19590], [1993, 12, 30, 17417], [1994, 6, 30, 20644], [1994, 12, 30, 19723],
  [1995, 3, 31, 16140], [1995, 7, 3, 14485], [1995, 12, 29, 19868], [1996, 6, 26, 22666], [1996, 12, 30, 19361], [1997, 6, 30, 20605],
  [1997, 12, 30, 15259], [1998, 6, 30, 15830], [1998, 10, 9, 12880], [1998, 12, 30, 13842], [1999, 6, 30, 17530], [1999, 12, 30, 18934],
  [2000, 4, 12, 20833], [2000, 6, 30, 17411], [2000, 12, 29, 13786], [2001, 3, 30, 12999], [2001, 6, 29, 12969], [2001, 9, 17, 9504],
  [2001, 12, 28, 10543], [2002, 5, 31, 11764], [2002, 12, 30, 8579], [2003, 4, 28, 7608], [2003, 9, 30, 10219], [2003, 12, 30, 10677],
  [2004, 4, 26, 12163], [2004, 8, 31, 11082], [2004, 12, 30, 11489], [2005, 6, 30, 11584], [2005, 12, 30, 16111], [2006, 4, 7, 17563],
  [2006, 6, 13, 14219], [2006, 12, 29, 17226], [2007, 2, 26, 18215], [2007, 7, 9, 18262], [2007, 8, 17, 15273], [2007, 12, 28, 15308],
  [2008, 3, 17, 11787], [2008, 6, 6, 14489], [2008, 9, 12, 12215], [2008, 10, 15, 9548], [2008, 10, 16, 8458], [2008, 10, 27, 7163],
  [2008, 12, 30, 8860], [2009, 3, 10, 7055], [2009, 8, 31, 10493], [2009, 12, 30, 10546], [2010, 4, 5, 11339], [2010, 8, 31, 8824],
  [2010, 12, 30, 10229], [2011, 2, 17, 10858], [2011, 3, 10, 10434], [2011, 3, 15, 8605], [2011, 6, 30, 9816], [2011, 11, 25, 8160],
  [2011, 12, 30, 8455], [2012, 3, 27, 10255], [2012, 6, 4, 8295], [2012, 11, 14, 8665], [2012, 12, 28, 10395], [2013, 5, 22, 15627],
  [2013, 5, 23, 14484], [2013, 6, 13, 12445], [2013, 12, 30, 16291], [2014, 4, 11, 13910], [2014, 12, 30, 17451], [2015, 6, 24, 20868],
  [2015, 8, 25, 17806], [2015, 9, 29, 16931], [2015, 12, 30, 19034], [2016, 2, 12, 14953], [2016, 6, 23, 16238], [2016, 6, 24, 14952],
  [2016, 12, 30, 19114], [2017, 6, 30, 20033], [2017, 12, 29, 22765], [2018, 1, 23, 24124], [2018, 3, 23, 20618], [2018, 10, 2, 24270],
  [2018, 12, 25, 19155], [2018, 12, 28, 20015], [2019, 6, 28, 21276], [2019, 12, 30, 23657], [2020, 1, 17, 24041], [2020, 3, 19, 16553],
  [2020, 6, 30, 22288], [2020, 12, 30, 27444], [2021, 2, 16, 30468], [2021, 8, 20, 27014], [2021, 9, 14, 30670], [2021, 12, 30, 28792],
  [2022, 3, 8, 24718], [2022, 6, 30, 26393], [2022, 12, 30, 26095], [2023, 6, 30, 33189], [2023, 12, 29, 33464], [2024, 2, 22, 39099],
  [2024, 3, 22, 40888], [2024, 7, 11, 42224], [2024, 8, 2, 35910], [2024, 8, 5, 31458], [2024, 8, 30, 38648], [2024, 12, 30, 39895],
  [2025, 3, 31, 35618], [2025, 4, 7, 31137], [2025, 6, 30, 40487], [2025, 9, 30, 44933], [2025, 10, 31, 52411], [2025, 12, 30, 50339],
  [2026, 1, 30, 53300], [2026, 2, 27, 56500], [2026, 3, 31, 50559], [2026, 4, 30, 59000], [2026, 5, 29, 65500], [2026, 6, 25, 72366],
  [2026, 6, 30, 70062], [2026, 7, 31, 64362], [2026, 9, 30, 66000], [2026, 10, 21, 64621],
];
const AT = ANCHORS.map(([y, m, d, v]) => [y + (m - 1) / 12 + (d - 1) / 365, Math.log(v)]);
const LAST_T = AT[AT.length - 1][0];
function trendAt(t) {
  if (t <= AT[0][0]) return AT[0][1];
  if (t > LAST_T) return null;
  let i = 1;
  while (i < AT.length && AT[i][0] < t) i++;
  const [t0, v0] = AT[i - 1], [t1, v1] = AT[i];
  return v0 + ((v1 - v0) * (t - t0)) / Math.max(1e-6, t1 - t0);
}
// real events, told by the morning paper when the game day reaches them: [y, m, d, text]
const EVENTS = [
  [1987, 10, 20, '東京株式市場、日経平均が1日で3,836円安（−14.90%）。前日のニューヨーク市場の暴落「ブラックマンデー」が波及した。'],
  [1989, 12, 29, '大納会。日経平均は3万8,915円87銭の史上最高値で取引を終えた。'],
  [1990, 10, 1, '日経平均が一時2万円を割りこむ。年初から4割近い下落で、「バブル崩壊」という言葉が広がる。'],
  [1992, 8, 18, '日経平均が1万4,309円まで下落。ピークの3分の1近くに。'],
  [2000, 4, 12, '日経平均が2万833円をつける。IT関連株の人気が過熱している。'],
  [2003, 4, 28, '日経平均がバブル後最安値の7,607円88銭に。'],
  [2008, 9, 16, '米大手証券会社の経営破綻（リーマン・ショック）を受け、東京市場も全面安。'],
  [2008, 10, 16, '日経平均が1日で1,089円安（−11.41%）。下落率は歴代2位。'],
  [2009, 3, 10, '日経平均が7,054円98銭。バブル後の最安値を更新した。'],
  [2011, 3, 15, '日経平均が1日で1,015円安（−10.55%）。震災の影響が広がる。'],
  [2020, 3, 19, '感染症の世界的な流行への警戒から、日経平均が1万6,552円まで下落。'],
  [2024, 2, 22, '日経平均が3万9,098円68銭。1989年末の史上最高値を34年ぶりに更新した。'],
  [2024, 8, 5, '日経平均が1日で4,451円安（−12.40%）。下げ幅は史上最大。'],
  [2025, 12, 30, '大納会。日経平均の年末終値は5万339円48銭と、初めて5万円を超えた。'],
  [2026, 6, 25, '日経平均が7万2,366円34銭。AI関連への期待で最高値を更新した。'],
];
const EVENT_T = EVENTS.map(([y, m, d, s]) => [y + (m - 1) / 12 + (d - 1) / 365, s]);

export const PRODUCTS = {
  fund: { name: '日経平均ファンド', short: '日経ファンド', fund: true, beta: 1, sector: '投資信託（インデックス）' },
  denki: { name: 'ドット電機', short: 'ドット電機', beta: 1.4, vol: 0.02, base: 1800, kessan: 7, sector: '電機・半導体' },
  shoku: { name: 'まるどっと食品', short: 'まるどっと', beta: 0.5, vol: 0.01, base: 1100, kessan: 17, sector: '食品・スーパー' },
  media: { name: '星くずメディア', short: '星くず', beta: 1.0, vol: 0.017, base: 950, kessan: 27, sector: 'テレビ・芸能' },
};
export const PRODUCT_IDS = Object.keys(PRODUCTS);
const STOCK_IDS = PRODUCT_IDS.filter((id) => !PRODUCTS[id].fund);
const HIST = 60;

const cleanPos = (p) => (isObj(p) ? Object.fromEntries(PRODUCT_IDS.map((id) => [id, isObj(p[id]) ? { n: Math.max(0, num(p[id].n)), cost: Math.max(0, num(p[id].cost)) } : { n: 0, cost: 0 }])) : Object.fromEntries(PRODUCT_IDS.map((id) => [id, { n: 0, cost: 0 }])));
definePart('inv', (s) => {
  const cur = isObj(s.cur) && Number.isFinite(Number(s.cur.d)) && Number.isFinite(Number(s.cur.L)) ? {
    d: Math.max(1, Math.floor(num(s.cur.d))), tr: num(s.cur.tr, num(s.cur.L)), dev: num(s.cur.dev), L: num(s.cur.L),
    e: STOCK_IDS.map((id, i) => num(arr(s.cur.e)[i])),
  } : null;
  return {
    opened: Math.max(0, Math.floor(num(s.opened))), cur, L1: num(s.L1, cur ? cur.L : 0),
    hist: cur ? arr(s.hist).filter((h) => isObj(h) && Number.isFinite(Number(h.d)) && Number.isFinite(Number(h.L))).map((h) => ({ d: Math.floor(num(h.d)), L: num(h.L), e: STOCK_IDS.map((id, i) => num(arr(h.e)[i])) })).slice(-HIST) : [],
    pos: cleanPos(s.pos), nisa: cleanPos(s.nisa),
    nisaYear: isObj(s.nisaYear) ? { y: Math.floor(num(s.nisaYear.y)), used: Math.max(0, num(s.nisaYear.used)), usedStock: Math.max(0, num(s.nisaYear.usedStock)) } : { y: 0, used: 0, usedStock: 0 },
    realized: Math.round(num(s.realized)), tax: Math.max(0, Math.round(num(s.tax))), fees: Math.max(0, Math.round(num(s.fees))), trades: Math.max(0, Math.floor(num(s.trades))),
    log: arr(s.log).filter(isObj).slice(0, 30).map((l) => ({ day: Math.floor(num(l.day, 1)), text: str(l.text, 80) })),
    newsT: num(s.newsT), lastBig: Math.floor(num(s.lastBig)),
  };
});
const eraStartL = (g) => Math.log(({ showa: 23274, heisei_early: 21500, heisei: 11800, reiwa: 59000 })[g.state.profile && g.state.profile.era] || 30000);
// Move the market forward to `day` (reload-proof: every step is drawn from the save's seed and the day).
export function marketTo(g, day = g.state.day) {
  const I = part(g, 'inv');
  if (!I.cur) {
    const tr = trendAt(realT(g, 1)) ?? eraStartL(g);
    I.cur = { d: 1, tr, dev: 0, L: tr, e: STOCK_IDS.map(() => 0) };
    I.L1 = tr;
    I.hist = [{ d: 1, L: tr, e: I.cur.e.slice() }];
  }
  let guard = 0;
  while (I.cur.d < day && guard++ < 20000) {
    const d = I.cur.d + 1;
    let tr = trendAt(realT(g, d));
    if (tr == null) {
      // past the known history: a random walk with a small upward drift and the odd crash
      tr = I.cur.tr + 0.04 / 120 + 0.0164 * gaussR(g, 'mkt', d);
      if (rnd(g, 'crash', d) < 0.004) tr -= 0.08 + 0.12 * rnd(g, 'crashSize', d);
    }
    const dev = 0.9 * I.cur.dev + 0.011 * gaussR(g, 'dev', d);
    const e = STOCK_IDS.map((id, i) => {
      const P = PRODUCTS[id];
      let x = 0.995 * I.cur.e[i] + P.vol * gaussR(g, 'stk', id, d);
      if (d % 30 === P.kessan) x += 0.06 * gaussR(g, 'kessan', id, d); // 決算
      if (rnd(g, 'scandal', id, d) < 0.0015) x -= 0.15 + 0.2 * rnd(g, 'scandalSize', id, d); // 不祥事・業績の下方修正
      return x;
    });
    I.cur = { d, tr, dev, L: tr + dev, e };
    I.hist.push({ d, L: I.cur.L, e: e.slice() });
    if (I.hist.length > HIST) I.hist.splice(0, I.hist.length - HIST);
  }
  return I.cur;
}
const FUND_FEE = { techo: 0.01, keitai: 0.005, smart: 0.001 }; // 信託報酬 / 年
const navOf = (g, I, h) => 10000 * Math.exp(h.L - I.L1 - (FUND_FEE[devOf(g)] * (h.d - 1)) / 120);
// the price of a product at a history point (internal yen; the index in points)
export function priceAt(g, id, h) {
  const I = part(g, 'inv');
  if (id === 'index') return Math.exp(h.L);
  if (id === 'fund') return navOf(g, I, h);
  const i = STOCK_IDS.indexOf(id);
  const P = PRODUCTS[id];
  return P.base * Math.exp(P.beta * (h.L - I.L1) + num(h.e[i]));
}
export function quote(g, id) {
  marketTo(g);
  const I = part(g, 'inv');
  const h = I.hist[I.hist.length - 1], p = I.hist[I.hist.length - 2] || h;
  const now = priceAt(g, id, h), before = priceAt(g, id, p);
  return { price: id === 'fund' || id === 'index' ? now : Math.max(1, Math.round(now)), change: before ? now / before - 1 : 0, series: I.hist.map((x) => priceAt(g, id, x)) };
}
// rules by the game date
export const gainTaxRate = (g) => { const ym = ymOf(g); return ym < 198904 ? 0 : ym < 200301 ? 0.26 : ym < 201401 ? (ym >= 201301 ? 0.10147 : 0.10) : 0.20315; };
export const nisaOpen = (g) => ymOf(g) >= 201401;
const nisaYearCap = (g) => { const y = yearOf(g); return toInternal(y < 2016 ? 1000000 : y < 2024 ? 1200000 : 3600000); };
const nisaStockCap = (g) => (yearOf(g) >= 2024 ? toInternal(2400000) : nisaYearCap(g));
const NISA_LIFE = 18000000;
export const lotUnit = (g, id) => (PRODUCTS[id].fund ? 1 : devOf(g) === 'smart' ? 1 : ymOf(g) >= 201810 ? 100 : 1000);
export function tradeFee(g, id, amount) {
  const dv = devOf(g);
  if (PRODUCTS[id].fund) return Math.round(amount * ({ techo: 0.03, keitai: 0.01, smart: 0 })[dv]); // 購入時手数料 (buying only)
  if (dv === 'smart') return 0;
  if (dv === 'keitai') return Math.max(toInternal(100), Math.round(amount * 0.001));
  return Math.max(toInternal(2500), Math.round(amount * (ymOf(g) < 199910 ? 0.0115 : 0.01)));
}
function nisaRoom(g, id) {
  if (!nisaOpen(g)) return 0;
  const I = part(g, 'inv');
  const y = yearOf(g);
  if (I.nisaYear.y !== y) I.nisaYear = { y, used: 0, usedStock: 0 };
  let room = nisaYearCap(g) - I.nisaYear.used;
  if (!PRODUCTS[id].fund) room = Math.min(room, nisaStockCap(g) - I.nisaYear.usedStock);
  if (y >= 2024) room = Math.min(room, toInternal(NISA_LIFE) - PRODUCT_IDS.reduce((a, k) => a + I.nisa[k].cost, 0));
  return Math.max(0, Math.floor(room));
}
const ilog = (g, text) => { const I = part(g, 'inv'); I.log.unshift({ day: g.state.day, text }); if (I.log.length > 30) I.log.length = 30; };
// Buy: fund by amount (internal yen), stocks by shares. → { ok, why?, n, cost, fee }
export function buy(g, id, qty, acct = 'tokutei') {
  const P = PRODUCTS[id];
  if (!P) return { ok: false, why: 'その銘柄はない' };
  const I = part(g, 'inv');
  const q = quote(g, id);
  let n, cost, fee;
  if (P.fund) { cost = Math.floor(qty); fee = tradeFee(g, id, cost); n = (cost - fee) / q.price; }
  else { n = Math.floor(qty); cost = n * q.price; fee = tradeFee(g, id, cost); }
  if (!(n > 0) || cost <= 0) return { ok: false, why: '数量が正しくない' };
  const pay = P.fund ? cost : cost + fee;
  if (g.state.money < pay) return { ok: false, why: 'お金が足りない…' };
  if (acct === 'nisa') {
    const room = nisaRoom(g, id);
    if (cost > room) return { ok: false, why: `NISAの枠が足りない（残り${fmtMoney(room)}）` };
    I.nisaYear.used += cost;
    if (!P.fund) I.nisaYear.usedStock += cost;
  }
  g.state.money -= pay;
  const pos = (acct === 'nisa' ? I.nisa : I.pos)[id];
  pos.n += n; pos.cost += P.fund ? cost - fee : cost;
  I.fees += fee; I.trades++;
  if (!I.opened) I.opened = g.state.day;
  ilog(g, `買 ${P.short} ${P.fund ? fmtMoney(cost) : `${commas(n)}株`}${acct === 'nisa' ? '（NISA）' : ''}`);
  return { ok: true, n, cost, fee, pay };
}
// Sell n units (shares / fund units) from an account. → { ok, proceeds, fee, gain, tax, net }
export function sell(g, id, n, acct = 'tokutei') {
  const P = PRODUCTS[id];
  const I = part(g, 'inv');
  const pos = (acct === 'nisa' ? I.nisa : I.pos)[id];
  if (!P || !pos || !(pos.n > 0)) return { ok: false, why: '持っていない' };
  n = Math.min(pos.n, n);
  if (!P.fund) n = Math.floor(n);
  if (!(n > 0)) return { ok: false, why: '数量が正しくない' };
  const q = quote(g, id);
  const proceeds = Math.floor(n * q.price);
  const fee = P.fund ? 0 : tradeFee(g, id, proceeds);
  const basis = (pos.cost * n) / pos.n;
  const gain = proceeds - fee - basis;
  const tax = acct === 'nisa' ? 0 : Math.max(0, Math.round(gain * gainTaxRate(g)));
  const net = proceeds - fee - tax;
  pos.cost -= basis; pos.n -= n;
  if (pos.n < 1e-6) { pos.n = 0; pos.cost = 0; }
  g.addMoney(net, true);
  I.realized += Math.round(gain); I.tax += tax; I.fees += fee; I.trades++;
  ilog(g, `売 ${P.short} ${P.fund ? fmtMoney(proceeds) : `${commas(n)}株`}（損益${gain >= 0 ? '+' : '−'}${fmtMoney(Math.abs(gain))}）`);
  return { ok: true, n, proceeds, fee, gain: Math.round(gain), tax, net };
}
export function portfolio(g) {
  const I = part(g, 'inv');
  let value = 0, cost = 0;
  const rows = {};
  for (const id of PRODUCT_IDS) {
    const q = quote(g, id);
    const a = I.pos[id], b = I.nisa[id];
    const n = a.n + b.n, c = a.cost + b.cost, v = n * q.price;
    value += v; cost += c;
    rows[id] = { n, cost: c, value: v, q };
  }
  return { value: Math.round(value), cost: Math.round(cost), gain: Math.round(value - cost), rows };
}
// the morning: move the market, the paper's market news (real events; a big day)
export function investMorning(g) {
  const I = part(g, 'inv');
  marketTo(g);
  if (!I.opened && !PRODUCT_IDS.some((id) => I.pos[id].n > 0 || I.nisa[id].n > 0)) return;
  const t0 = realT(g, Math.max(1, g.state.day - 1)), t1 = realT(g, g.state.day);
  const ev = EVENT_T.find(([t]) => t > t0 - 1e-9 && t <= t1 + 1e-9 && t > I.newsT);
  const h = I.hist[I.hist.length - 1], p = I.hist[I.hist.length - 2];
  const ch = p ? Math.exp(h.L - p.L) - 1 : 0;
  let text = null;
  if (ev) { text = ev[1]; I.newsT = ev[0]; }
  else if (Math.abs(ch) >= 0.045 && g.state.day - I.lastBig >= 5) { text = `日経平均が${ch > 0 ? '大幅高' : '大幅安'}。前日比${pct(ch)}の${commas(Math.exp(h.L))}円。`; I.lastBig = g.state.day; }
  if (text) g.message({ from: 'ドット経済新聞', kind: 'news', text });
}

// ---------------------------------------------------------------- the app
const up = (v) => (v > 0 ? '#c0303a' : v < 0 ? '#2a6ac0' : PC.dim); // Japanese colours: up red, down blue
function drawInvTop(c, a, g) {
  const dv = devOf(g);
  const pf = portfolio(g);
  const qi = quote(g, 'index');
  R(c, a.x, a.y, a.w, a.h, dv === 'techo' ? '#f2ead0' : dv === 'keitai' ? '#e6eef0' : '#f2f8f5');
  T(c, '評価額', a.x + 8, a.y + 4, 12, PC.dim);
  T(c, fmtMoney(pf.value), a.x + 52, a.y + 2, 14, PC.text);
  const gn = pf.value - pf.cost;
  T(c, `${gn >= 0 ? '+' : '−'}${fmtMoney(Math.abs(gn))}`, a.x + a.w - 8, a.y + 4, 12, up(gn), 'right');
  T(c, `日経平均 ${commas(qi.price)}円`, a.x + 8, a.y + 20, 12, PC.text);
  T(c, pct(qi.change, 2), a.x + a.w - 8, a.y + 20, 12, up(qi.change), 'right');
  lineChart(c, a.x + 8, a.y + 36, a.w - 16, a.h - 42, qi.series.slice(-40), INV_COLOR);
  R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
}
export async function investApp(g) {
  const I = part(g, 'inv');
  if (!I.opened) I.opened = g.state.day;
  marketTo(g);
  const items = () => {
    const pf = portfolio(g);
    const rows = PRODUCT_IDS.map((id) => {
      const P = PRODUCTS[id], r = pf.rows[id];
      return { id, label: P.name, sub: r.n > 0 ? `保有 ${P.fund ? fmtMoney(r.value) : `${commas(r.n)}株`}・${r.value - r.cost >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.value - r.cost))}` : P.sector, right: `${fmtMoney(r.q.price)} ${pct(r.q.change)}`, rightColor: up(r.q.change), subColor: r.n > 0 ? up(r.value - r.cost) : PC.dim };
    });
    if (nisaOpen(g)) rows.push({ id: 'nisa', label: 'NISA（非課税）', sub: `今年の残り枠 ${fmtMoney(nisaRoom(g, 'fund'))}`, chip: ['NISA', '#d07a2a'] });
    rows.push({ id: 'log', label: '取引のきろく', sub: `取引${I.trades}回・確定損益${I.realized >= 0 ? '+' : '−'}${fmtMoney(Math.abs(I.realized))}` });
    rows.push({ id: 'help', label: 'しくみ・手数料・税金' });
    return rows;
  };
  return phoneView(g, panelView(g, {
    title: investTitle(g), color: INV_COLOR, top: 96, rowH: 36,
    hint: 'A:えらぶ　B:もどる',
    items,
    drawTop: (c, a) => drawInvTop(c, a, g),
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.id === 'log') await phoneInfo(g, { title: '取引のきろく', color: INV_COLOR, lines: I.log.length ? I.log.map((l) => `${l.day}日目 ${l.text}`) : ['まだ取引はない。'] });
      else if (it.id === 'help') await phoneInfo(g, { title: 'しくみ', color: INV_COLOR, lines: investHelp(g) });
      else if (it.id === 'nisa') await phoneInfo(g, { title: 'NISA', color: INV_COLOR, lines: nisaHelp(g) });
      else await productView(g, it.id);
    }),
  }));
}
function investHelp(g) {
  const dv = devOf(g);
  const how = { techo: '証券会社の営業さんに電話して注文する（対面取引）。', keitai: 'ケータイのネット証券で注文する。', smart: 'アプリで注文する。' }[dv];
  const rate = gainTaxRate(g);
  return [
    how,
    '値段が動くのは一日に一度（朝）。上がるか下がるかは、だれにもわからない。',
    '日経平均ファンド：日経平均にあわせて動く。値動きはおだやか。',
    'ドット電機：景気に敏感で、値動きが大きい。',
    'まるどっと食品：景気に左右されにくい。',
    '星くずメディア：テレビ・芸能の会社。',
    '決算の発表や不祥事で、1日で大きく動くこともある。',
    '',
    `売買手数料：${dv === 'smart' ? '無料' : dv === 'keitai' ? '約定代金の0.1%（最低' + fmtMoney(toInternal(100)) + '）' : '約定代金の約1%（最低' + fmtMoney(toInternal(2500)) + '）'}`,
    `ファンドの購入時手数料：${({ techo: '3%', keitai: '1%', smart: 'なし（ノーロード）' })[dv]}`,
    `株は${lotUnit(g, 'denki') === 1 ? '1株' : `${commas(lotUnit(g, 'denki'))}株（1単元）`}から買える。`,
    `もうけ（譲渡益）にかかる税金：${rate ? `${(rate * 100).toFixed(3).replace(/\.?0+$/, '')}%` : 'いまは原則かからない'}`,
    nisaOpen(g) ? 'NISA口座で買ったものは、もうけに税金がかからない。' : '',
  ].filter((s) => s !== null);
}
function nisaHelp(g) {
  const y = yearOf(g);
  return [
    `NISA（少額投資非課税制度）：${y >= 2024 ? '2024年からの新しいNISA。' : '2014年1月から。'}`,
    `年間の投資枠：${fmtMoney(nisaYearCap(g))}${y >= 2024 ? `（株は成長投資枠の${fmtMoney(nisaStockCap(g))}まで）` : ''}`,
    y >= 2024 ? `生涯の上限：${fmtMoney(toInternal(NISA_LIFE))}（売ると、その分の枠は翌年に戻る）` : '',
    `今年の残り枠：${fmtMoney(nisaRoom(g, 'fund'))}`,
    'NISAで買ったものを売っても、もうけに税金はかからない。損が出ても、ほかのもうけとは相殺できない。',
  ].filter(Boolean);
}
// one product: chart, price, holdings, buy / sell
function productView(g, id) {
  const P = PRODUCTS[id];
  return phoneView(g, {
    title: P.name, color: INV_COLOR, cancel: -1, sel: 0,
    hint: '←→:えらぶ　A:けってい　B:もどる',
    update(ph, inp) {
      if (inp.repeat('left')) { this.sel = (this.sel + 2) % 3; audio.sfx('cursor'); }
      if (inp.repeat('right')) { this.sel = (this.sel + 1) % 3; audio.sfx('cursor'); }
      if (inp.pressed('a')) { audio.sfx('ok'); this.act(ph); return; }
      if (inp.pressed('b')) { audio.sfx('cancel'); ph.back(-1); }
    },
    act(ph) {
      if (this.sel === 2) { ph.back(-1); return; }
      ph.run(this, () => (this.sel === 0 ? buyFlow(g, id) : sellFlow(g, id)));
    },
    tap(ph, x, y) { const i = (this.btns || []).findIndex((r) => hit(r, x, y)); if (i >= 0) { this.sel = i; return true; } return false; },
    draw(c, ph, a) {
      const q = quote(g, id);
      const I = part(g, 'inv');
      R(c, a.x, a.y, a.w, a.h, '#fbfaf6');
      T(c, P.sector, a.x + 8, a.y + 4, 12, PC.dim);
      T(c, fmtMoney(q.price), a.x + 8, a.y + 18, 14, PC.text);
      T(c, `前日比 ${pct(q.change, 2)}`, a.x + a.w - 8, a.y + 20, 12, up(q.change), 'right');
      const ser = q.series;
      lineChart(c, a.x + 8, a.y + 38, a.w - 16, 84, ser, INV_COLOR, { base: ser[0] });
      const hi = Math.max(...ser), lo = Math.min(...ser);
      T(c, `${ser.length}日の高値 ${fmtMoney(hi)}・安値 ${fmtMoney(lo)}`, a.x + 8, a.y + 126, 12, PC.dim);
      const a1 = I.pos[id], a2 = I.nisa[id];
      let y = a.y + 144;
      const row = (label, pos) => {
        const v = pos.n * q.price, gn = v - pos.cost;
        T(c, fitText(c, `${label} ${P.fund ? fmtMoney(v) : `${commas(pos.n)}株・${fmtMoney(v)}`}`, a.w - 90, 12), a.x + 8, y, 12, PC.text);
        T(c, `${gn >= 0 ? '+' : '−'}${fmtMoney(Math.abs(gn))}`, a.x + a.w - 8, y, 12, up(gn), 'right');
        y += 16;
      };
      if (a1.n > 0) row('保有', a1);
      if (a2.n > 0) row('NISA', a2);
      if (!(a1.n > 0) && !(a2.n > 0)) { T(c, 'まだ持っていない。', a.x + 8, y, 12, PC.dim); y += 16; }
      if (!P.fund) T(c, `売買単位 ${commas(lotUnit(g, id))}株`, a.x + 8, y, 12, PC.dim);
      this.btns = buttons(c, a, ['買う', '売る', 'もどる'], this.sel, INV_COLOR);
    },
  });
}
async function pickAcct(g, id, cost) {
  if (!nisaOpen(g)) return 'tokutei';
  const room = nisaRoom(g, id);
  const k = await phoneConfirm(g, { title: '口座', color: INV_COLOR, text: `どちらの口座で買う？\nNISAの残り枠 ${fmtMoney(room)}${cost > room ? '（足りない）' : ''}`, choices: ['NISA（非課税）', 'ふつうの口座', 'やめる'] });
  if (k === 2 || k < 0) return null;
  return k === 0 ? 'nisa' : 'tokutei';
}
async function buyFlow(g, id) {
  const P = PRODUCTS[id];
  const q = quote(g, id);
  let qty = 0, cost = 0;
  if (P.fund) {
    const shown = devOf(g) === 'smart' ? [1000, 10000, 30000, 100000, 300000, 1000000, 3000000] : [10000, 30000, 100000, 300000, 1000000, 3000000];
    const opts = shown.map(toInternal).filter((v) => v <= g.state.money);
    if (!opts.length) { await phoneInfo(g, { title: '買う', color: INV_COLOR, text: `お金が足りない…（${fmtMoney(toInternal(shown[0]))}から）` }); return; }
    const k = await rowsList(g, { title: `${P.short}を買う`, color: INV_COLOR, items: opts.map((v) => ({ label: `${fmtMoney(v)}分`, right: tradeFee(g, id, v) ? `手数料${fmtMoney(tradeFee(g, id, v))}` : '手数料なし' })) });
    if (k < 0) return;
    qty = cost = opts[k];
  } else {
    const unit = lotUnit(g, id);
    const lots = [1, 2, 5, 10, 20, 50, 100].map((m) => m * unit).filter((n) => n * q.price + tradeFee(g, id, n * q.price) <= g.state.money);
    if (!lots.length) { await phoneInfo(g, { title: '買う', color: INV_COLOR, text: `お金が足りない…（${commas(unit)}株で約${fmtMoney(unit * q.price)}）` }); return; }
    const k = await rowsList(g, { title: `${P.short}を買う`, color: INV_COLOR, items: lots.map((n) => ({ label: `${commas(n)}株`, sub: `約${fmtMoney(n * q.price)}`, right: tradeFee(g, id, n * q.price) ? `手数料${fmtMoney(tradeFee(g, id, n * q.price))}` : '手数料なし' })) });
    if (k < 0) return;
    qty = lots[k]; cost = qty * q.price;
  }
  const acct = await pickAcct(g, id, cost);
  if (!acct) return;
  const ok = await phoneConfirm(g, { title: '注文の確認', color: INV_COLOR, text: `${P.name}\n${P.fund ? `${fmtMoney(cost)}分` : `${commas(qty)}株（約${fmtMoney(cost)}）`}を${acct === 'nisa' ? 'NISAで' : ''}買う。\n手数料 ${fmtMoney(tradeFee(g, id, cost))}\n値下がりすることもある。`, choices: ['注文する', 'やめる'] });
  if (ok !== 0) return;
  const r = buy(g, id, qty, acct);
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: '買えなかった', color: INV_COLOR, text: r.why }); return; }
  audio.sfx('coin');
  g.notify(`${P.short}を買った（${fmtMoney(r.pay)}）`, { color: '#ffffff' });
}
async function sellFlow(g, id) {
  const P = PRODUCTS[id];
  const I = part(g, 'inv');
  const accts = [['tokutei', 'ふつうの口座'], ['nisa', 'NISA']].filter(([k]) => (k === 'nisa' ? I.nisa : I.pos)[id].n > 0);
  if (!accts.length) { await phoneInfo(g, { title: '売る', color: INV_COLOR, text: 'まだ持っていない。' }); return; }
  let acct = accts[0][0];
  if (accts.length > 1) { const k = await phoneConfirm(g, { title: 'どちらを売る？', color: INV_COLOR, text: 'どちらの口座の分を売る？', choices: [...accts.map((x) => x[1]), 'やめる'] }); if (k < 0 || k >= accts.length) return; acct = accts[k][0]; }
  const pos = (acct === 'nisa' ? I.nisa : I.pos)[id];
  const q = quote(g, id);
  const unit = lotUnit(g, id);
  const choices = P.fund ? [['全部', pos.n], ['半分', pos.n / 2]] : [['全部', pos.n], ...(pos.n >= unit * 2 ? [['半分', Math.floor(pos.n / 2 / unit) * unit]] : []), ...(pos.n > unit ? [[`${commas(unit)}株`, unit]] : [])];
  const k = await rowsList(g, { title: `${P.short}を売る`, color: INV_COLOR, items: choices.map(([l, n]) => ({ label: l, sub: P.fund ? `約${fmtMoney(n * q.price)}` : `${commas(n)}株・約${fmtMoney(n * q.price)}`, right: `${(n * q.price) - (pos.cost * n) / pos.n >= 0 ? '+' : '−'}${fmtMoney(Math.abs((n * q.price) - (pos.cost * n) / pos.n))}` })) });
  if (k < 0) return;
  const n = choices[k][1];
  const est = n * q.price - (pos.cost * n) / pos.n;
  const tax = acct === 'nisa' ? 0 : Math.max(0, Math.round(est * gainTaxRate(g)));
  const c = await phoneConfirm(g, { title: '売り注文', color: INV_COLOR, text: `約${fmtMoney(n * q.price)}で売る。\n損益 ${est >= 0 ? '+' : '−'}${fmtMoney(Math.abs(est))}\n税金 ${tax ? `約${fmtMoney(tax)}` : 'なし'}`, choices: ['売る', 'やめる'] });
  if (c !== 0) return;
  const r = sell(g, id, n, acct);
  if (!r.ok) { audio.sfx('buzz'); await phoneInfo(g, { title: '売れなかった', color: INV_COLOR, text: r.why }); return; }
  audio.sfx('coin');
  await phoneInfo(g, { title: '約定', color: INV_COLOR, lines: [`${P.name}を売った。`, `受取 ${fmtMoney(r.net)}`, `損益 ${r.gain >= 0 ? '+' : '−'}${fmtMoney(Math.abs(r.gain))}`, `手数料 ${fmtMoney(r.fee)}・税金 ${fmtMoney(r.tax)}`] });
}

// ======================================================================== フリマ / オークション / リサイクルショップ
export function furimaMode(g) {
  const ym = ymOf(g);
  if (ym >= 201207) return 'flea';
  if (devOf(g) !== 'techo' && ym >= 199909) return 'auction';
  return 'shop';
}
export const furimaTitle = (g) => ({ flea: 'フリマ', auction: 'ネット出品', shop: 'リサイクル' })[furimaMode(g)];
const NO_SELL = new Set(['tabako', 'kanraku_beer', 'kanraku_card', 'kanraku_wallet', 'nodoame', 'okashi', 'tea', 'cake', 'butaman', 'hanataba']);
export function sellableItem(id) {
  const it = ITEMS[id];
  return !!it && num(it.price) > 0 && !it.key && !it.heal && !it.fill && !it.ingredient && !NO_SELL.has(id);
}
definePart('furima', (s, day) => ({
  listings: arr(s.listings).filter((l) => isObj(l) && (l.kind === 'item' ? ITEMS[l.key] : FURNITURE[l.key])).slice(0, 8).map((l) => ({
    id: Math.floor(num(l.id)), kind: l.kind === 'furn' ? 'furn' : 'item', key: String(l.key), price: Math.max(1, Math.round(num(l.price, 1))),
    base: Math.max(1, Math.round(num(l.base, 1))), day: Math.floor(num(l.day, day)), until: Math.floor(num(l.until, day + 14)), mode: ['flea', 'auction'].includes(l.mode) ? l.mode : 'flea',
    views: Math.max(0, Math.floor(num(l.views))), likes: Math.max(0, Math.floor(num(l.likes))),
  })),
  pickup: isObj(s.pickup) && Array.isArray(s.pickup.items) ? { day: Math.floor(num(s.pickup.day, day)), pay: Math.max(0, Math.round(num(s.pickup.pay))), items: arr(s.pickup.items).map((x) => str(x, 30)).slice(0, 12) } : null,
  callDay: Math.floor(num(s.callDay)), nextId: Math.max(1, Math.floor(num(s.nextId, 1))),
  sold: Math.max(0, Math.floor(num(s.sold))), earned: Math.max(0, Math.round(num(s.earned))),
  log: arr(s.log).filter(isObj).slice(0, 30).map((l) => ({ day: Math.floor(num(l.day, 1)), text: str(l.text, 80) })),
}));
const flog = (g, text) => { const F = part(g, 'furima'); F.log.unshift({ day: g.state.day, text }); if (F.log.length > 30) F.log.length = 30; };
const listedFurn = (g) => new Set(part(g, 'furima').listings.filter((l) => l.kind === 'furn').map((l) => l.key));
export function sellables(g) {
  const st = g.state;
  const out = [];
  for (const [id, n] of Object.entries(st.items || {})) if (num(n) > 0 && sellableItem(id)) out.push({ kind: 'item', key: id, name: ITEMS[id].name, base: num(ITEMS[id].price), n: num(n) });
  const lf = listedFurn(g);
  for (const id of Object.keys(st.furniture || {})) if (st.furniture[id] && FURNITURE[id] && !lf.has(id)) out.push({ kind: 'furn', key: id, name: FURNITURE[id].name, base: num(FURNITURE[id].price), n: 1 });
  return out;
}
const fleaFee = (g) => (ymOf(g) >= 201410 ? 0.1 : 0);
const shipCost = (kind) => (kind === 'furn' ? 3000 : 210);
const shopRate = (s) => (s.kind === 'furn' ? 0.3 : ITEMS[s.key] && ITEMS[s.key].gift ? 0.25 : 0.2);
// List one thing (item: taken out of もちもの until sold or taken back). ratio = price / new price.
export function listItem(g, s, ratio) {
  const F = part(g, 'furima');
  const mode = furimaMode(g);
  if (mode === 'shop') return { ok: false, why: 'この時代は、リサイクルショップに電話して引き取ってもらう。' };
  if (F.listings.length >= 5) return { ok: false, why: '出品は5つまで。' };
  if (s.kind === 'item') { if (!g.takeItem(s.key, 1)) return { ok: false, why: 'もう持っていない。' }; } else if (!(g.state.furniture || {})[s.key]) return { ok: false, why: 'もう持っていない。' };
  const price = Math.max(10, Math.round((s.base * clamp(ratio, 0.05, 0.9)) / 10) * 10);
  const L = { id: F.nextId++, kind: s.kind, key: s.key, price, base: s.base, day: g.state.day, until: g.state.day + (mode === 'auction' ? 3 : 14), mode, views: 0, likes: 0 };
  F.listings.push(L);
  flog(g, `出品 ${s.name}（${fmtMoney(price)}${mode === 'auction' ? 'から' : ''}）`);
  return { ok: true, listing: L };
}
export function cancelListing(g, id) {
  const F = part(g, 'furima');
  const i = F.listings.findIndex((l) => l.id === id);
  if (i < 0) return false;
  const L = F.listings[i];
  F.listings.splice(i, 1);
  if (L.kind === 'item') g.giveItem(L.key, 1, true);
  return true;
}
const nameOf = (L) => (L.kind === 'item' ? ITEMS[L.key] && ITEMS[L.key].name : FURNITURE[L.key] && FURNITURE[L.key].name) || L.key;
function settle(g, L, price) {
  const F = part(g, 'furima');
  const st = g.state;
  if (L.kind === 'furn') {
    if (!(st.furniture || {})[L.key]) return null; // already gone (sold to the shop)
    delete st.furniture[L.key];
  }
  const fee = Math.round(price * (L.mode === 'auction' ? 0.05 : fleaFee(g)));
  const ship = L.mode === 'auction' ? 0 : shipCost(L.kind);
  const net = Math.max(0, price - fee - ship);
  g.addMoney(net, true);
  F.sold++; F.earned += net;
  flog(g, `売れた ${nameOf(L)} ${fmtMoney(price)}（受取${fmtMoney(net)}）`);
  return { price, fee, ship, net };
}
// The morning: listings that sold, auctions that ended, the shop's pickup.
export function furimaMorning(g) {
  const F = part(g, 'furima');
  const day = g.state.day;
  const notes = [];
  if (F.pickup && F.pickup.day < day) {
    g.addMoney(F.pickup.pay, true);
    F.sold += F.pickup.items.length; F.earned += F.pickup.pay;
    notes.push(`リサイクルショップが引き取りに来た（${F.pickup.items.length}点・${fmtMoney(F.pickup.pay)}）`);
    flog(g, `出張買取 ${F.pickup.items.length}点 ${fmtMoney(F.pickup.pay)}`);
    F.pickup = null;
  }
  for (const L of F.listings.slice()) {
    if (L.day >= day) continue;
    const r = L.price / Math.max(1, L.base);
    if (L.mode === 'auction') {
      if (day < L.until) { L.views += Math.round(8 + 30 * rnd(g, 'av', L.id, day)); continue; }
      const lam = clamp(3.2 - 5 * (r - 0.1), 0.1, 3.5);
      let bids = 0, p = Math.exp(-lam), cum = p;
      const u = rnd(g, 'bids', L.id);
      while (u > cum && bids < 12) { bids++; p *= lam / bids; cum += p; }
      F.listings.splice(F.listings.indexOf(L), 1);
      if (!bids) { if (L.kind === 'item') g.giveItem(L.key, 1, true); notes.push(`「${nameOf(L)}」は入札がなく、オークションが終わった`); continue; }
      const price = Math.min(Math.round(L.base * 0.85), Math.round((L.price * (1 + 0.18 * (bids - 1))) / 10) * 10);
      const s = settle(g, L, Math.max(L.price, price));
      if (s) notes.push(`「${nameOf(L)}」が${fmtMoney(s.price)}で落札された（入札${bids}件・受取${fmtMoney(s.net)}）`);
      continue;
    }
    L.views += Math.round(10 + 40 * rnd(g, 'fv', L.id, day));
    if (rnd(g, 'fl', L.id, day) < 0.3) L.likes++;
    const p = clamp(0.9 - 1.6 * (r - 0.25), 0.03, 0.85) * (L.kind === 'furn' ? 0.6 : 1);
    if (rnd(g, 'sold', L.id, day) < p) {
      F.listings.splice(F.listings.indexOf(L), 1);
      const s = settle(g, L, L.price);
      if (s) notes.push(`「${nameOf(L)}」が売れた！（${fmtMoney(L.price)}・受取${fmtMoney(s.net)}）`);
    } else if (day >= L.until) {
      F.listings.splice(F.listings.indexOf(L), 1);
      if (L.kind === 'item') g.giveItem(L.key, 1, true);
      notes.push(`「${nameOf(L)}」は売れないまま出品期間が終わった（もちものに戻した）`);
    }
  }
  if (notes.length) g.message({ from: furimaTitle(g) === 'リサイクル' ? 'リサイクルショップ' : `${furimaTitle(g)}のお知らせ`, kind: 'chat', text: notes.join('\n') });
}
// the shop: quote → set aside → paid at the pickup the next morning
export function shopQuote(g, list) { return list.reduce((a, s) => a + Math.round((s.base * shopRate(s)) / 10) * 10, 0); }
export function shopSell(g, list) {
  const F = part(g, 'furima');
  if (F.callDay === g.state.day || F.pickup) return { ok: false, why: '今日はもう引き取りをお願いしてある。明日の朝に来てくれる。' };
  const taken = [];
  for (const s of list) {
    if (s.kind === 'item') { if (g.takeItem(s.key, 1)) taken.push(s); } else if ((g.state.furniture || {})[s.key]) { delete g.state.furniture[s.key]; taken.push(s); }
  }
  if (!taken.length) return { ok: false, why: '引き取ってもらうものがない。' };
  const pay = shopQuote(g, taken);
  F.callDay = g.state.day;
  F.pickup = { day: g.state.day, pay, items: taken.map((s) => s.name) };
  flog(g, `買取の電話 ${taken.length}点（見積${fmtMoney(pay)}）`);
  return { ok: true, pay, n: taken.length };
}

function drawFurimaTop(c, a, g) {
  const F = part(g, 'furima');
  const mode = furimaMode(g);
  R(c, a.x, a.y, a.w, a.h, mode === 'shop' ? '#f2ead0' : '#fff4ee');
  T(c, `売れた ${F.sold}点`, a.x + 8, a.y + 4, 12, PC.text);
  T(c, `売上 ${fmtMoney(F.earned)}`, a.x + a.w - 8, a.y + 4, 12, FURIMA_COLOR, 'right');
  const line = mode === 'shop' ? (F.pickup ? `明日の朝、引き取り（${F.pickup.items.length}点・${fmtMoney(F.pickup.pay)}）` : '電話すると、翌朝に引き取りに来てくれる')
    : mode === 'auction' ? `出品中 ${F.listings.length}/5・3日で終了・落札手数料5%` : `出品中 ${F.listings.length}/5・手数料${Math.round(fleaFee(g) * 100)}%・送料は出品者`;
  T(c, fitText(c, line, a.w - 16, 12), a.x + 8, a.y + 20, 12, PC.dim);
  R(c, a.x, a.y + a.h - 1, a.w, 1, '#c8c0ac');
}
export async function furimaApp(g) {
  const F = part(g, 'furima');
  const items = () => {
    const mode = furimaMode(g);
    const rows = [];
    if (mode === 'shop') rows.push({ id: 'call', label: 'リサイクルショップに電話', sub: '出張買取（家具・雑貨）', chip: ['電話', FURIMA_COLOR], disabled: !!F.pickup || F.callDay === g.state.day, why: '今日はもう頼んである' });
    else rows.push({ id: 'new', label: mode === 'auction' ? '出品する（オークション）' : '出品する', sub: `使っていないもの ${sellables(g).length}点`, chip: ['出品', FURIMA_COLOR], disabled: F.listings.length >= 5, why: '出品は5つまで' });
    for (const L of F.listings) rows.push({ id: 'L', L, label: nameOf(L), sub: L.mode === 'auction' ? `入札受付中・あと${Math.max(0, L.until - g.state.day)}日・閲覧${L.views}` : `出品${g.state.day - L.day}日目・閲覧${L.views}・いいね${L.likes}`, right: fmtMoney(L.price) });
    rows.push({ id: 'log', label: 'きろく', sub: F.log[0] ? `${F.log[0].day}日目 ${F.log[0].text}` : 'まだない' });
    return rows;
  };
  return phoneView(g, panelView(g, {
    title: furimaTitle(g), color: FURIMA_COLOR, top: 38, rowH: 38,
    items, drawTop: (c, a) => drawFurimaTop(c, a, g),
    pick: (ph, it, i, v) => ph.run(v, async () => {
      if (it.id === 'new') await listFlow(g);
      else if (it.id === 'call') await shopFlow(g);
      else if (it.id === 'L') {
        const k = await phoneConfirm(g, { title: nameOf(it.L), color: FURIMA_COLOR, text: `${fmtMoney(it.L.price)}${it.L.mode === 'auction' ? 'から（オークション）' : 'で出品中'}\n新品は${fmtMoney(it.L.base)}`, choices: ['出品をとりやめる', 'もどる'] });
        if (k === 0) { cancelListing(g, it.L.id); g.notify('出品をとりやめた', { color: '#ffffff' }); }
      } else if (it.id === 'log') await phoneInfo(g, { title: 'きろく', color: FURIMA_COLOR, lines: F.log.length ? F.log.map((l) => `${l.day}日目 ${l.text}`) : ['まだない。'] });
    }),
  }));
}
async function listFlow(g) {
  const list = sellables(g);
  if (!list.length) { await phoneInfo(g, { title: '出品', color: FURIMA_COLOR, text: '売れそうなものがない。\n（食べ物や、思い出の品は出せない）' }); return; }
  const k = await rowsList(g, { title: '何を出す？', color: FURIMA_COLOR, items: list.map((s) => ({ label: s.name, sub: s.kind === 'furn' ? '家具（送料が高い）' : `もちもの ×${s.n}`, right: `新品${fmtMoney(s.base)}` })) });
  if (k < 0) return;
  const s = list[k];
  const auction = furimaMode(g) === 'auction';
  const ratios = auction ? [[0.1, '1割から（入札が集まりやすい）'], [0.2, '2割から'], [0.4, '4割から'], [0.6, '6割から（強気）']] : [[0.3, '新品の3割（すぐ売れそう）'], [0.45, '4割5分'], [0.6, '6割'], [0.8, '8割（強気）']];
  const j = await rowsList(g, { title: '値段', color: FURIMA_COLOR, items: ratios.map(([r, l]) => ({ label: fmtMoney(Math.max(10, Math.round((s.base * r) / 10) * 10)), sub: l })) });
  if (j < 0) return;
  const r = listItem(g, s, ratios[j][0]);
  if (!r.ok) { await phoneInfo(g, { title: '出品', color: FURIMA_COLOR, text: r.why }); return; }
  audio.sfx('ok');
  g.notify(`「${s.name}」を出品した`, { color: '#ffffff' });
}
async function shopFlow(g) {
  const list = sellables(g);
  if (!list.length) { await phoneInfo(g, { title: 'リサイクルショップ', color: FURIMA_COLOR, text: '引き取ってもらえそうなものがない。\n（食べ物や、思い出の品は引き取ってもらえない）' }); return; }
  const picked = new Set();
  const done = await phoneList(g, {
    title: '引き取ってもらう', color: FURIMA_COLOR, rowH: 34,
    hint: 'A:えらぶ・はずす　B:もどる',
    items: () => [...list.map((s, i) => ({ label: `${picked.has(i) ? '☑' : '☐'} ${s.name}`, right: `約${fmtMoney(Math.round((s.base * shopRate(s)) / 10) * 10)}` })), { label: `見積もりを聞く（${picked.size}点）`, disabled: !picked.size, why: 'えらんでいない' }],
    pick(ph, it, i) { if (i < list.length) { if (picked.has(i)) picked.delete(i); else picked.add(i); } else ph.back(1); },
  });
  if (done !== 1 || !picked.size) return;
  const chosen = [...picked].map((i) => list[i]);
  const pay = shopQuote(g, chosen);
  const k = await phoneConfirm(g, { title: '電話で見積もり', color: FURIMA_COLOR, text: `「${chosen.length}点で、${fmtMoney(pay)}ですね。\n明日の朝、引き取りにうかがいます」`, choices: ['お願いする', 'やめる'] });
  if (k !== 0) return;
  const r = shopSell(g, chosen);
  if (!r.ok) { await phoneInfo(g, { title: 'リサイクルショップ', color: FURIMA_COLOR, text: r.why }); return; }
  audio.sfx('ok');
  g.notify(`明日の朝、${r.n}点を引き取りに来る（${fmtMoney(r.pay)}）`, { color: '#ffffff' });
}
