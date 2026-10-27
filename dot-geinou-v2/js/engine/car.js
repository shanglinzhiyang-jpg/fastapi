// 車の所有 (R16) — core: buy a car (new or used), keep it (駐車場・任意保険・自動車税・車検・ローン), drive it, sell it.
// The scenes are in car_app.js (the phone app 「マイカー」 and the 販売店 in 府中駅前); the マップ app, the license app and the
// romance drive date call the g.car* API below. Everything needs a 普通免許 (an AT-limited one cannot buy an MT car).
//
// State g.state.car (lazy, save-safe; an old save has none):
//   { id: model, used, age0 (years old when bought), color, bought: day, price (paid), km, cond (0..100), shaken: day (車検 due),
//     taxYear (自動車税 settled for that year), loan: null | { left, monthly, months, rate, principal }, lastYm (last month billed),
//     owed (unpaid so far), late (months not paid), broken, drives, washed }
// and g.state.carLog = { bought, sold, repo, kmAll, drives, trips, noLoanUntil }  (history; survives selling the car).
//
// MONEY: internal amounts are 令和's; each era shows its own prices (util.js eraPrice), so the table here is today's level.
// Time: a game day is 3 calendar days, a month is 10 game days, a year YEAR_DAYS = 120.

import { Game } from './game.js';
import { onMorning } from './life.js';
import { ageOf, YEAR_DAYS } from './profile.js';
import { clamp, fmtMoney } from './util.js';
import { holds, canMT, eraId, ymOfDay, dateOfDay } from './license.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export const GAS = 165; // ガソリン 1L (令和 level)
export const TAX_MONTH = 5; // 自動車税 is settled in May
export const NEW_SHAKEN_DAYS = YEAR_DAYS * 3; // 新車の初回車検は3年
export const SHAKEN_DAYS = YEAR_DAYS * 2; // そのあとは2年ごと
export const SHAKEN_OPEN = 20; // 車検は期限の約2か月前から受けられる (game days)
export const NAME = 'ドット中古車センター';

// The cars. Every name is made up. price = 新車 (令和), kmpl = 燃費, tax = 自動車税 (年), shaken = 車検の費用, ins = 任意保険 (月, 年齢で上下)
export const MODELS = {
  mini: { id: 'mini', name: 'ドット・ミニ', kind: '軽自動車', body: 'kei', price: 1500000, kmpl: 20, tax: 10800, shaken: 65000, ins: 6000, color: '#ffd23f', at: true, text: '小さくて小回りがきく軽自動車。燃費がよく、維持費も安い。' },
  compact: { id: 'compact', name: 'ドット・コンパクト', kind: 'コンパクトカー', body: 'compact', price: 2000000, kmpl: 18, tax: 30500, shaken: 85000, ins: 7000, color: '#e8384f', at: true, text: '街のまんなかで扱いやすい、ちょうどいいサイズ。' },
  wagon: { id: 'wagon', name: 'ドット・ワゴン', kind: 'ワゴン', body: 'wagon', price: 2900000, kmpl: 14, tax: 34500, shaken: 105000, ins: 8000, color: '#2f9a4a', at: true, text: '荷物もたっぷり積める。機材をのせて、遠くの現場にも行ける。' },
  sedan: { id: 'sedan', name: 'ドット・セダン', kind: 'セダン', body: 'sedan', price: 3200000, kmpl: 12, tax: 39500, shaken: 115000, ins: 8500, color: '#3a3f6a', at: true, text: '落ち着いた乗り心地のセダン。送り迎えにも似合う。' },
  suv: { id: 'suv', name: 'ドット・SUV', kind: 'SUV', body: 'suv', price: 3800000, kmpl: 11, tax: 39500, shaken: 125000, ins: 9000, color: '#6a7a3a', at: true, text: '山でも雪道でも頼れる、背の高い一台。' },
  sports: { id: 'sports', name: 'ドット・スポーツ', kind: 'スポーツカー', body: 'sports', price: 4600000, kmpl: 9, tax: 45000, shaken: 135000, ins: 12000, color: '#d8202a', at: false, text: 'MT（マニュアル）専用。走るのが好きな人の、あこがれの一台。' },
};
export const MODEL_ORDER = ['mini', 'compact', 'wagon', 'sedan', 'suv', 'sports'];
export const modelOf = (id) => MODELS[id] || null;
// what the era's cars come with (flavour only)
export const EQUIP = {
  showa: 'エアコンとカセットステレオつき', heisei_early: 'CDプレーヤーとエアバッグつき', heisei: 'カーナビとETC車載器つき', reiwa: '衝突被害軽減ブレーキとドライブレコーダーつき',
};
const LOAN_RATE = { showa: 0.065, heisei_early: 0.05, heisei: 0.045, reiwa: 0.04 }; // 年利 (単純)

export const ymNow = (g) => ymOfDay(g, g.state.day);
const monthIdx = (ym) => Math.floor(ym / 100) * 12 + (ym % 100) - 1;
const ymOfIdx = (i) => Math.floor(i / 12) * 100 + (i % 12) + 1;
export const BILL_DATE = 25; // the month's bill is taken from the 25th (a game day is 3 calendar days: the 9th of the month's ten)
export const gearOf = (M) => (M.at ? 'AT' : 'MT');
export const parkFee = (M) => (M.body === 'kei' ? 20000 : 25000);
export const ageFactor = (g) => { const a = ageOf(g.state); return a < 21 ? 2 : a < 26 ? 1.5 : a < 30 ? 1.2 : 1; };
export const insFee = (g, M) => Math.round((M.ins * ageFactor(g)) / 100) * 100;
export const fuelCost = (M, km) => Math.max(10, Math.round(((km / M.kmpl) * GAS) / 10) * 10);

// ======================================================================== state
export function car(g) {
  const st = g && g.state;
  if (!st || !isObj(st.car)) return null;
  const c = st.car;
  if (!MODELS[c.id]) { delete st.car; return null; } // a damaged save: no such model
  c.used = !!c.used;
  c.age0 = Math.max(0, num(c.age0));
  c.bought = Math.floor(num(c.bought, st.day));
  c.price = Math.max(0, Math.floor(num(c.price)));
  c.km = Math.max(0, Math.floor(num(c.km)));
  c.cond = clamp(num(c.cond, 80), 0, 100);
  c.shaken = Math.floor(num(c.shaken, st.day + SHAKEN_DAYS));
  c.lastYm = Math.floor(num(c.lastYm, ymNow(g)));
  if (c.lastYm < 190001 || c.lastYm % 100 < 1 || c.lastYm % 100 > 12) c.lastYm = ymNow(g); // a damaged save: start from this month
  c.taxYear = Math.floor(num(c.taxYear, dateOfDay(g, st.day).year));
  c.owed = Math.max(0, Math.floor(num(c.owed)));
  c.late = Math.max(0, Math.floor(num(c.late)));
  c.drives = Math.max(0, Math.floor(num(c.drives)));
  c.washed = Math.floor(num(c.washed));
  c.broken = !!c.broken;
  c.color = String(c.color || MODELS[c.id].color);
  if (c.loan != null) {
    const L = c.loan;
    if (!isObj(L) || !(num(L.left) > 0)) c.loan = null;
    else { L.left = Math.floor(num(L.left)); L.monthly = Math.max(100, Math.floor(num(L.monthly, 10000))); L.months = Math.max(1, Math.floor(num(L.months, 60))); L.rate = num(L.rate, 0.04); L.principal = Math.floor(num(L.principal, L.left)); }
  }
  return c;
}
export function carLog(g) {
  const st = g.state;
  let l = st.carLog;
  if (!isObj(l)) l = st.carLog = {};
  for (const k of ['bought', 'sold', 'repo', 'kmAll', 'drives', 'trips', 'noLoanUntil']) l[k] = Math.max(0, Math.floor(num(l[k])));
  return l;
}
export const owned = (g) => !!car(g);

// ======================================================================== the lot (new cars; used cars change every month)
export function lotOf(g) {
  const ym = ymNow(g);
  const r = rnd(ym * 7919 + 13);
  const fresh = MODEL_ORDER.map((id) => ({ id, used: false, age: 0, km: 0, cond: 100, price: MODELS[id].price, shakenLeft: NEW_SHAKEN_DAYS, uid: `new-${id}` }));
  const used = [];
  for (let i = 0; i < 5; i++) {
    const M = MODELS[MODEL_ORDER[Math.floor(r() * MODEL_ORDER.length)]];
    const age = 2 + Math.floor(r() * 11); // 2..12 年落ち
    const km = Math.round((age * (5000 + r() * 5000)) / 100) * 100;
    const cond = Math.round(clamp(96 - age * 3.2 - r() * 14, 38, 94));
    const shakenLeft = 30 + Math.floor(r() * 210);
    const raw = M.price * Math.pow(0.88, age) * (0.78 + cond / 300);
    const price = Math.max(Math.round((M.price * 0.22) / 10000) * 10000, Math.round(raw / 10000) * 10000);
    used.push({ id: M.id, used: true, age, km, cond, price, shakenLeft, uid: `${ym}-${i}` });
  }
  used.sort((a, b) => a.price - b.price);
  return { fresh, used };
}

// ======================================================================== buying
export const feesOf = (item) => Math.max(80000, Math.round((item.price * (item.used ? 0.1 : 0.08)) / 1000) * 1000); // 登録・車庫証明・納車・重量税・自賠責…
export function loanPlan(g, item, months = 60) {
  const total = item.price + feesOf(item);
  const down = Math.ceil((total * 0.2) / 10000) * 10000;
  const principal = total - down;
  const m = [36, 60, 84].includes(months) ? months : 60;
  const rate = LOAN_RATE[eraId(g)] ?? 0.04;
  const sum = Math.round(principal * (1 + (rate * m) / 12));
  const monthly = Math.ceil(sum / m / 100) * 100;
  return { down, principal, months: m, rate, monthly, total: monthly * m };
}
// null, or the reason the player cannot buy this now. opts: { loan, months }
export function canBuy(g, item, opts = {}) {
  const M = MODELS[item && item.id];
  if (!M) return 'その車はもう売れてしまった';
  if (!holds(g, 'futsu')) return '普通免許がないと、車は買えない（教習所で免許を取ろう）';
  if (car(g)) return 'もう車を持っている（買いかえるなら、先に売ろう）';
  if (!M.at && !canMT(g)) return 'MT車は、AT限定の免許では運転できない';
  const l = carLog(g);
  const cash = opts.loan ? loanPlan(g, item, opts.months).down + parkFee(M) : item.price + feesOf(item) + parkFee(M);
  if (opts.loan && l.noLoanUntil > g.state.day) return 'ローンの審査に通らなかった（以前の滞納の記録が残っている）';
  if (g.state.money < cash) return `お金が足りない（${fmtMoney(cash)}が必要）`;
  return null;
}
export function buy(g, item, opts = {}) {
  const why = canBuy(g, item, opts);
  if (why) return { ok: false, why };
  const M = MODELS[item.id];
  const st = g.state;
  const f = feesOf(item);
  const park = parkFee(M);
  let cash = item.price + f + park;
  let loan = null;
  if (opts.loan) {
    const p = loanPlan(g, item, opts.months);
    cash = p.down + park;
    loan = { left: p.total, monthly: p.monthly, months: p.months, rate: p.rate, principal: p.principal };
  }
  g.spend(cash);
  st.car = {
    id: item.id, used: !!item.used, age0: item.age || 0, color: M.color, bought: st.day, price: item.price, km: item.km || 0, cond: item.cond ?? 100,
    shaken: st.day + (item.shakenLeft || SHAKEN_DAYS), taxYear: dateOfDay(g, st.day).year, loan, lastYm: ymNow(g), owed: 0, late: 0, broken: false, drives: 0, washed: 0,
  };
  carLog(g).bought++;
  return { ok: true, cash, fees: f, park, loan, car: car(g) };
}

// ======================================================================== value and selling
export function valueOf(g, c = car(g)) {
  if (!c) return 0;
  const M = MODELS[c.id];
  const age = c.age0 + (g.state.day - c.bought) / YEAR_DAYS;
  const kmF = clamp(1 - Math.max(0, c.km - age * 8000) / 150000, 0.55, 1.05);
  const raw = M.price * Math.pow(0.87, age) * (0.72 + c.cond / 360) * kmF;
  return Math.max(Math.round((M.price * 0.08) / 1000) * 1000, Math.round(raw / 1000) * 1000);
}
export const offerOf = (g, c = car(g)) => Math.round((valueOf(g, c) * 0.92) / 1000) * 1000; // what the 販売店 pays
export function sell(g) {
  const c = car(g);
  if (!c) return { ok: false, why: '売る車がない' };
  const price = offerOf(g, c);
  const owe = (c.loan ? c.loan.left : 0) + c.owed;
  const net = price - owe;
  if (net < 0 && g.state.money + net < 0) return { ok: false, why: `ローンや未納が売値より${fmtMoney(-net)}多く残っていて、足りない`, short: -net };
  if (net >= 0) g.addMoney(net, true); else g.spend(-net);
  const m = MODELS[c.id].name;
  delete g.state.car;
  carLog(g).sold++;
  return { ok: true, price, owe, net, model: m };
}

// ======================================================================== running it
export function driveBlock(g) {
  const c = car(g);
  if (!c) return '車を持っていない';
  if (!holds(g, 'futsu')) return '運転免許が切れている（免許センターで更新しよう）';
  if (!MODELS[c.id].at && !canMT(g)) return 'MT車は、AT限定の免許では運転できない';
  if (c.shaken < g.state.day) return '車検が切れていて、公道は走れない（マイカー → 車検）';
  if (c.broken) return '故障していて動かない（マイカー → 整備）';
  return null;
}
export const fuelFor = (g, km) => { const c = car(g); return c ? fuelCost(MODELS[c.id], km) : 0; };
// a drive of km: the 走行距離 and the コンディション move; the fuel is paid unless o.free (a date or a trip already paid for it)
export function drove(g, o = {}) {
  const c = car(g);
  const why = driveBlock(g);
  if (why) return { ok: false, why };
  const km = Math.max(1, Math.round(num(o.km, 10)));
  const cost = o.free ? 0 : fuelCost(MODELS[c.id], km);
  if (cost && !g.spend(cost)) return { ok: false, why: `ガソリン代が足りない（${fmtMoney(cost)}）` };
  c.km += km;
  c.cond = clamp(c.cond - km / 700, 0, 100);
  c.drives++;
  const l = carLog(g);
  l.kmAll += km;
  l.drives++;
  if (o.trip) l.trips++;
  return { ok: true, km, cost };
}
// the マップ app's 「自分の車で行く」: null (no car) or { km, fare, why }
export function tripFor(g, tiles) {
  const c = car(g);
  if (!c) return null;
  const km = Math.max(2, Math.round(num(tiles, 20) * 0.065)); // a tile is about 50 m; roads wind
  const fare = fuelCost(MODELS[c.id], km) + 600; // + コインパーキング
  return { km, fare, why: driveBlock(g), color: c.color, body: MODELS[c.id].body, model: MODELS[c.id].name };
}

// ======================================================================== upkeep
export function monthlyOf(g, c = car(g)) {
  if (!c) return { lines: [], total: 0 };
  const M = MODELS[c.id];
  const lines = [['駐車場', parkFee(M)], ['任意保険', insFee(g, M)]];
  if (c.loan) lines.push(['ローン', Math.min(c.loan.monthly, c.loan.left)]);
  return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
}
export const shakenDays = (g, c = car(g)) => (c ? c.shaken - g.state.day : 0); // < 0: expired
export const shakenCost = (g, c = car(g)) => (c ? MODELS[c.id].shaken + Math.round(((100 - c.cond) * 600) / 100) * 100 : 0);
export const canShaken = (g, c = car(g)) => (c ? (shakenDays(g, c) <= SHAKEN_OPEN ? null : '車検は、期限の約2か月前から受けられる') : '車がない');
export function doShaken(g) {
  const c = car(g);
  const why = canShaken(g, c);
  if (why) return { ok: false, why };
  const cost = shakenCost(g, c);
  if (!g.spend(cost)) return { ok: false, why: `お金が足りない（${fmtMoney(cost)}）` };
  c.shaken = Math.max(c.shaken, g.state.day) + SHAKEN_DAYS;
  c.cond = Math.max(c.cond, 78);
  c.broken = false;
  return { ok: true, cost, next: c.shaken };
}
export const serviceCost = (g, c = car(g)) => (c ? 12000 + Math.round(((100 - c.cond) * 700) / 100) * 100 : 0);
export function doService(g) {
  const c = car(g);
  if (!c) return { ok: false, why: '車がない' };
  if (c.cond >= 90 && !c.broken) return { ok: false, why: 'いまは調子がいい。整備はまだ要らない' };
  const cost = serviceCost(g, c);
  if (!g.spend(cost)) return { ok: false, why: `お金が足りない（${fmtMoney(cost)}）` };
  c.cond = Math.max(c.cond, 90);
  c.broken = false;
  return { ok: true, cost };
}
export const WASH = 1000;
export function doWash(g) {
  const c = car(g);
  if (!c) return { ok: false, why: '車がない' };
  if (c.washed === g.state.day) return { ok: false, why: '今日は、もう洗った' };
  if (!g.spend(WASH)) return { ok: false, why: `お金が足りない（${fmtMoney(WASH)}）` };
  c.washed = g.state.day;
  return { ok: true, cost: WASH };
}
// pay some of the loan early (never more than is left)
export function payLoan(g, amount) {
  const c = car(g);
  if (!c || !c.loan) return { ok: false, why: 'ローンはない' };
  const n = Math.min(Math.max(1000, Math.floor(num(amount))), c.loan.left);
  if (!g.spend(n)) return { ok: false, why: `お金が足りない（${fmtMoney(n)}）` };
  c.loan.left -= n;
  const done = c.loan.left <= 0;
  if (done) c.loan = null;
  return { ok: true, paid: n, done };
}

// the lines of the 愛車の情報 screen
export function statusLines(g) {
  const c = car(g);
  if (!c) return [];
  const M = MODELS[c.id];
  const m = monthlyOf(g, c);
  const sd = shakenDays(g, c);
  const age = c.age0 + (g.state.day - c.bought) / YEAR_DAYS;
  return [
    `${M.name}（${M.kind}・${gearOf(M)}・${c.used ? `${Math.round(age)}年落ち` : '新車で購入'}）`,
    `走行距離 ${c.km.toLocaleString('ja-JP')}km　コンディション ${Math.round(c.cond)}${c.broken ? '（故障中）' : ''}`,
    `車検 ${sd < 0 ? '切れている！' : sd <= SHAKEN_OPEN ? `あと${sd}日（受けられる）` : `あと${sd}日`}　自動車税 ${fmtMoney(M.tax)}／年（${TAX_MONTH}月）`,
    `毎月 ${fmtMoney(m.total)}（${m.lines.map((l) => `${l[0]}${fmtMoney(l[1])}`).join('・')}）`,
    c.loan ? `ローン残り ${fmtMoney(c.loan.left)}（月${fmtMoney(c.loan.monthly)}）` : 'ローンなし',
    c.owed ? `未納 ${fmtMoney(c.owed)}（${c.late}か月）` : `いまの売値の目安 ${fmtMoney(offerOf(g, c))}`,
  ];
}

// ======================================================================== the morning: the month's bill, 車検, breakdowns
function repossess(g, c) {
  const l = carLog(g);
  l.repo++;
  l.noLoanUntil = g.state.day + YEAR_DAYS * 3;
  const name = MODELS[c.id].name;
  delete g.state.car;
  try { g.message({ from: 'マイカー（口座引き落とし）', kind: 'bill', legal: true, text: `【車の引き上げ】\n支払いが3か月とどこおったため、${name}を引き上げました。\n売却した代金は、未払い分にあてられました。\n（ローンの審査には、しばらく通りません）` }); } catch (e) { console.error(e); }
}
function chargeMonth(g, c, billYm) {
  c.lastYm = billYm; // the month being billed (the bill comes from the 25th; a skipped month is caught up one a morning)
  const M = MODELS[c.id];
  const by = Math.floor(billYm / 100), bm = billYm % 100;
  const m = monthlyOf(g, c);
  const lines = m.lines.map((l) => l.slice());
  if (c.loan) { c.loan.left -= Math.min(c.loan.monthly, c.loan.left); if (c.loan.left <= 0) c.loan = null; }
  if (bm === TAX_MONTH && c.taxYear < by) { lines.push(['自動車税', M.tax]); c.taxYear = by; }
  let total = lines.reduce((a, l) => a + l[1], 0);
  const prev = c.owed;
  total += prev;
  const text = lines.map((l) => `${l[0]} ${fmtMoney(l[1])}`).join('\n') + (prev ? `\n前月までの未納 ${fmtMoney(prev)}` : '');
  if (g.spend(total)) {
    c.owed = 0;
    c.late = 0;
    try { g.message({ from: 'マイカー（口座引き落とし）', kind: 'bill', receipt: true, text: `【${M.name} 今月の維持費】\n${text}\n合計 ${fmtMoney(total)} を口座から引き落としました。${c.loan ? `\nローン残り ${fmtMoney(c.loan.left)}` : lines.some((l) => l[0] === 'ローン') ? '\nローンを完済しました！' : ''}` }); } catch (e) { console.error(e); }
    return;
  }
  c.owed = total;
  c.late++;
  if (c.late >= 3) { repossess(g, c); return; }
  try { g.message({ from: 'マイカー（口座引き落とし）', kind: 'bill', text: `【引き落としができませんでした】\n${text}\n合計 ${fmtMoney(total)}。残高が足りません。\n来月までにご入金ください（${c.late}か月目。3か月続くと、車を引き上げます）。` }); } catch (e) { console.error(e); }
}
onMorning((g) => {
  try {
    if (!g.state || !isObj(g.state.car)) return;
    const c = car(g);
    if (!c) return;
    const behind = monthIdx(ymNow(g)) - monthIdx(c.lastYm);
    if (behind >= 2 || (behind === 1 && dateOfDay(g, g.state.day).date >= BILL_DATE)) { chargeMonth(g, c, ymOfIdx(monthIdx(c.lastYm) + 1)); if (!g.state.car) return; }
    const sd = shakenDays(g, c);
    const from = 'ドット整備工場';
    if (sd === SHAKEN_OPEN) g.message({ from, kind: 'news', text: `${MODELS[c.id].name}の車検が、あと約2か月で切れます。\n「マイカー」アプリから受けられます（費用の目安 ${fmtMoney(shakenCost(g, c))}）。` });
    else if (sd === 10) g.message({ from, kind: 'news', text: `${MODELS[c.id].name}の車検の期限まで、あと約1か月です。\nお早めに「マイカー」アプリから。` });
    else if (sd === -1) g.message({ from, kind: 'news', text: `車検の期限が切れました。車検を受けるまで、${MODELS[c.id].name}は公道を走れません。` });
    if (!c.broken && c.cond < 40 && rnd(g.state.day * 31 + c.km)() < (40 - c.cond) / 800) {
      c.broken = true;
      g.message({ from, kind: 'news', text: `${MODELS[c.id].name}が動かなくなってしまった…。\n（コンディションが悪くなっていた。「マイカー」アプリの「整備」で直そう。費用の目安 ${fmtMoney(serviceCost(g, c))}）` });
    }
  } catch (e) { console.error('[car] morning', e); }
});

// ======================================================================== g.* API
const METHODS = {
  carOwned() { return owned(this); },
  car() { return car(this); },
  carLot() { return lotOf(this); },
  carCanBuy(item, opts) { return canBuy(this, item, opts || {}); },
  carBuy(item, opts) { return buy(this, item, opts || {}); },
  carSell() { return sell(this); },
  carValue() { return offerOf(this); },
  carLoanPlan(item, months) { return loanPlan(this, item, months); },
  carDriveBlock() { return driveBlock(this); },
  carDrove(o) { return drove(this, o || {}); },
  carFuelCost(km) { return fuelFor(this, km); },
  carTrip(tiles) { return tripFor(this, tiles); },
  carShaken() { return doShaken(this); },
  carService() { return doService(this); },
  carWash() { return doWash(this); },
  carPayLoan(n) { return payLoan(this, n); },
  carMonthly() { return monthlyOf(this); },
  carStatus() { return statusLines(this); },
  carLog() { return carLog(this); },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });
