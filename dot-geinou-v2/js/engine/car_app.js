// マイカー (R16) — the scenes of the 車の所有 system (core: car.js): the phone app 「マイカー」 and the 販売店 (ドット中古車センター, 府中駅前:
// js/world/ekimae_tokyo.js adds the building, whose talk is carShop). The player needs a 普通免許 to buy; the app shows with a license or a car.
//
//   マイカー (app)   愛車の情報 / ドライブに出かける / 洗車 / 整備・点検 / 車検 / ローンの返済 — and, without a car, how to get one
//   carShop (販売店) 新車 / 中古車（毎月ならびが変わる）/ 愛車を売る / 維持費の話。 現金かローン（36・60・84回）で買う

import { registerPhoneApp } from './life.js';
import { phoneList, phoneInfo, phoneConfirm, closePhoneThen, appTile, phoneText as T } from './phone.js';
import { wrap } from './draw.js';
import { fmtMoney } from './util.js';
import { holds, eraId } from './license.js';
import { drawCarSide } from './car_art.js';
import {
  MODELS, NAME, EQUIP, SHAKEN_OPEN, TAX_MONTH, car, lotOf, feesOf, parkFee, insFee, loanPlan, canBuy, buy, offerOf, sell, gearOf, fuelCost, shakenDays, shakenCost, serviceCost,
  canShaken, doShaken, doService, doWash, payLoan, statusLines, WASH,
} from './car.js';

const COLOR = '#e0703a';
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const DRIVE_KM = 120;

function icon(c, x, y, g) {
  appTile(c, x, y, COLOR);
  const cc = car(g);
  const body = cc ? cc.color : '#f4f0e0';
  R(c, x + 5, y + 16, 22, 7, body); R(c, x + 9, y + 10, 13, 7, body); R(c, x + 11, y + 12, 4, 4, '#9ac8e8'); R(c, x + 16, y + 12, 4, 4, '#9ac8e8');
  R(c, x + 8, y + 22, 5, 5, '#222'); R(c, x + 19, y + 22, 5, 5, '#222');
}
const badge = (g) => {
  try { const c = car(g); return c && shakenDays(g, c) <= 10 ? 1 : 0; } catch (e) { return 0; }
};

// ---------------------------------------------------------------- the app
async function viewCar(g) {
  const c = car(g);
  if (!c) return;
  const M = MODELS[c.id];
  await phoneInfo(g, {
    title: M.name, color: COLOR,
    draw(cv, a) {
      const w = 198 * 0.5;
      cv.save();
      cv.beginPath(); cv.rect(a.x, a.y, a.w, a.h); cv.clip();
      cv.translate(a.x + a.w / 2 - w / 2, a.y + 6); cv.scale(0.5, 0.5);
      drawCarSide(cv, 0, 100, g.frame || 0, c.color, M.body);
      cv.restore();
      const lines = [];
      for (const l of statusLines(g)) for (const w2 of wrap(cv, g.fmt(l), a.w - 20, 11)) lines.push(w2);
      lines.forEach((l, i) => T(cv, l, a.x + 10, a.y + 62 + i * 14, 11, '#333'));
    },
  });
}
function driveLine(g) {
  const era = eraId(g);
  const music = { showa: 'カセットテープをかけて', heisei_early: 'CDをかけて', heisei: 'お気に入りのCDをかけて', reiwa: 'スマホの音楽をスピーカーにつないで' }[era];
  const spots = ['海ぞいの道を、窓を少し開けて走った。', '山道のカーブを、ゆっくり走った。空気がおいしい。', '夜景のきれいな展望台まで走って、缶コーヒーを飲んだ。', '知らない町の道の駅で、地元の名物を食べた。', 'あてもなく、まっすぐな道をどこまでも走った。'];
  return `${music}、${spots[(g.state.day + (car(g) ? car(g).km : 0)) % spots.length]}`;
}
async function doDrive(g) {
  const c = car(g);
  const M = MODELS[c.id];
  const cost = fuelCost(M, DRIVE_KM);
  const block = g.carDriveBlock();
  const why = (() => { try { return g.lifeRefusal(); } catch (e) { return null; } })();
  const i = await phoneConfirm(g, {
    title: 'ドライブ', color: COLOR,
    text: [`自分の${M.name}で、半日ドライブ。`, `${DRIVE_KM}kmほど走って、ガソリン代はおよそ ${fmtMoney(cost)}。`, block ? `\n（${block}）` : why ? `\n${[].concat(why)[0]}` : ''].join('\n'),
    choices: ['出かける', 'やめる'],
  });
  if (i !== 0 || block || why) return;
  closePhoneThen(g, async (gg) => {
    const r = gg.carDrove({ km: DRIVE_KM });
    if (!r.ok) { await gg.say(r.why); return; }
    gg.sfx('coin');
    await gg.fadeOut(14);
    try { if (typeof gg.advanceTime === 'function') gg.advanceTime(240, 'ドライブ'); } catch (e) { console.error(e); }
    await gg.wait(700);
    gg.relax({ stress: 24, hunger: -8 });
    gg.state.stamina = Math.max(0, gg.state.stamina - 10);
    await gg.fadeIn(14);
    await gg.say([driveLine(gg), `自分の車だと、行き先も帰る時間も、自由だ。（ストレス -24・ガソリン代 ${fmtMoney(r.cost)}）`]);
  });
}
async function doWashApp(g) {
  const i = await phoneConfirm(g, { title: '洗車', color: COLOR, text: `ガソリンスタンドの洗車機で、${fmtMoney(WASH)}。\nピカピカの車は、気分がいい。`, choices: ['洗う', 'やめる'] });
  if (i !== 0) return;
  const r = doWash(g);
  if (!r.ok) { await phoneInfo(g, { title: '洗車', color: COLOR, text: r.why }); return; }
  g.sfx('coin');
  g.relax({ stress: 3 });
  await phoneInfo(g, { title: '洗車', color: COLOR, text: `ピカピカになった。（${fmtMoney(r.cost)}・ストレス -3）` });
}
async function doServiceApp(g) {
  const c = car(g);
  const cost = serviceCost(g, c);
  const i = await phoneConfirm(g, { title: '整備・点検', color: COLOR, text: `いまのコンディションは ${Math.round(c.cond)}${c.broken ? '（故障中）' : ''}。\n整備工場で点検と整備をして、${fmtMoney(cost)}。\n（コンディションが90まで戻る）`, choices: ['お願いする', 'やめる'] });
  if (i !== 0) return;
  const r = doService(g);
  if (!r.ok) { g.sfx('buzz'); await phoneInfo(g, { title: '整備・点検', color: COLOR, text: r.why }); return; }
  g.sfx('coin');
  await phoneInfo(g, { title: '整備・点検', color: COLOR, text: `整備が終わった。調子がよくなった。（${fmtMoney(r.cost)}）` });
}
async function doShakenApp(g) {
  const c = car(g);
  const why = canShaken(g, c);
  const sd = shakenDays(g, c);
  const cost = shakenCost(g, c);
  if (why) { await phoneInfo(g, { title: '車検', color: COLOR, text: `${why}。\n（いまは、あと${sd}日）\n費用の目安は ${fmtMoney(cost)}（法定費用と整備代）。` }); return; }
  const i = await phoneConfirm(g, { title: '車検', color: COLOR, text: `${sd < 0 ? '車検が切れている。' : `車検まであと${sd}日。`}\n整備工場で車検を受けて、${fmtMoney(cost)}。\n（自賠責保険・重量税・点検整備を含む。次の車検は2年後）`, choices: ['受ける', 'やめる'] });
  if (i !== 0) return;
  const r = doShaken(g);
  if (!r.ok) { g.sfx('buzz'); await phoneInfo(g, { title: '車検', color: COLOR, text: r.why }); return; }
  g.sfx('coin');
  await phoneInfo(g, { title: '車検', color: COLOR, text: `車検に通った。\n次の車検は、あと${shakenDays(g, car(g))}日後。（${fmtMoney(r.cost)}）` });
}
async function doLoanApp(g) {
  const c = car(g);
  const left = c.loan.left;
  const opts = [100000, 300000, 1000000].filter((n) => n < left);
  opts.push(left);
  const labels = opts.map((n, k) => (k === opts.length - 1 ? `ぜんぶ返す　${fmtMoney(n)}` : `${fmtMoney(n)}を返す`));
  labels.push('やめる');
  const i = await phoneList(g, { title: `ローン残り ${fmtMoney(left)}`, color: COLOR, items: labels.map((l) => ({ label: l })), hint: 'A:えらぶ　B:もどる' });
  if (i < 0 || i >= opts.length) return;
  const r = payLoan(g, opts[i]);
  if (!r.ok) { g.sfx('buzz'); await phoneInfo(g, { title: 'ローン', color: COLOR, text: r.why }); return; }
  g.sfx('coin');
  await phoneInfo(g, { title: 'ローン', color: COLOR, text: r.done ? `${fmtMoney(r.paid)}を返して、ローンを完済した！` : `${fmtMoney(r.paid)}を返した。（残り ${fmtMoney(car(g).loan.left)}）` });
}
async function viewGuide(g) {
  const lic = holds(g, 'futsu');
  await phoneInfo(g, {
    title: '車を買うには', color: COLOR,
    lines: [
      lic ? '普通免許は持っている。あとは、買うだけだ。' : '車を買うには、普通免許が要る（教習所で取れる）。',
      '', `【販売店】${NAME}（府中駅前。ドット多摩線の終点）。新車と中古車、買い取りもしてくれる。`,
      '【買うとき】車の値段のほかに、諸費用（登録・車庫証明・自賠責・重量税など）と、月極駐車場の初月分が要る。ローン（36・60・84回）もある。',
      `【毎月】駐車場（${fmtMoney(20000)}〜）と任意保険（若いほど高い）、ローン。${TAX_MONTH}月は自動車税。`,
      '【ときどき】車検（新車は3年、そのあとは2年ごと）。整備をさぼると、車が動かなくなる。',
      '【払えないと】引き落としが3か月とどこおると、車を引き上げられる。',
    ],
  });
}
function menu(g) {
  const c = car(g);
  const items = [];
  if (!c) {
    items.push({ label: 'まだ車がない', sub: '買うには？（府中駅前の販売店）', run: () => viewGuide(g) });
    return items;
  }
  const M = MODELS[c.id];
  const sd = shakenDays(g, c);
  items.push({ label: '愛車の情報', sub: `${M.name}・${c.km.toLocaleString('ja-JP')}km`, run: () => viewCar(g) });
  items.push({ label: 'ドライブに出かける', sub: `半日・${fmtMoney(fuelCost(M, DRIVE_KM))}`, run: () => doDrive(g) });
  items.push({ label: '洗車する', sub: fmtMoney(WASH), run: () => doWashApp(g) });
  items.push({ label: '整備・点検', sub: c.broken ? '故障中！' : `コンディション ${Math.round(c.cond)}`, run: () => doServiceApp(g) });
  items.push({ label: '車検', sub: sd < 0 ? '切れている！' : sd <= SHAKEN_OPEN ? `あと${sd}日（受けられる）` : `あと${sd}日`, run: () => doShakenApp(g) });
  if (c.loan) items.push({ label: 'ローンの返済', sub: `残り ${fmtMoney(c.loan.left)}`, run: () => doLoanApp(g) });
  items.push({ label: '車を買うには・売るには', sub: 'ドット中古車センター', run: () => viewGuide(g) });
  return items;
}
async function openApp(g) {
  for (let guard = 0; guard < 30; guard++) {
    const items = menu(g);
    const i = await phoneList(g, { title: 'マイカー', color: COLOR, items: items.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる', rowH: 38 });
    if (i < 0 || !items[i]) return;
    await items[i].run();
  }
}
registerPhoneApp('mycar', {
  name: 'マイカー', color: COLOR, order: 43.7,
  iconHD: icon, badge,
  cond: (g) => !!(g && g.state && (car(g) || holds(g, 'futsu'))),
  open: (g) => openApp(g),
});

// ---------------------------------------------------------------- the 販売店
const who = { name: '販売員' };
function itemLabel(it) {
  const M = MODELS[it.id];
  return it.used ? `${M.name}　${it.age}年・${it.km.toLocaleString('ja-JP')}km　${fmtMoney(it.price)}` : `${M.name}　${fmtMoney(it.price)}`;
}
function itemInfo(g, it) {
  const M = MODELS[it.id];
  const f = feesOf(it);
  const month = parkFee(M) + insFee(g, M);
  return [
    `${M.kind}・${gearOf(M)}・燃費 ${M.kmpl}km/L　${it.used ? `コンディション ${it.cond}・車検あと${it.shakenLeft}日` : EQUIP[eraId(g)]}`,
    M.text,
    `諸費用 ${fmtMoney(f)}・毎月の維持費 約${fmtMoney(month)}（駐車場と保険）`,
  ].join('\n');
}
async function purchase(g, it) {
  const M = MODELS[it.id];
  const f = feesOf(it);
  const park = parkFee(M);
  const total = it.price + f + park;
  if (!holds(g, 'futsu')) { await g.say('「申し訳ありません、普通免許がないと、車はお売りできないんです。」\n（教習所で免許を取ってからまた来よう）', who); return false; }
  if (g.carOwned()) { await g.say('「すでにお車をお持ちですね。買いかえるなら、先にお売りいただいてからに。」', who); return false; }
  const choices = ['現金で買う', 'ローンで買う', 'やめる'];
  const i = await g.ask(
    `${M.name}（${it.used ? `${it.age}年落ち` : '新車'}）　車両 ${fmtMoney(it.price)}\n諸費用 ${fmtMoney(f)}・駐車場の初月分 ${fmtMoney(park)}\n現金なら、合計 ${fmtMoney(total)}`,
    choices, { cancel: 2 });
  if (i === 2) return false;
  let opts = {};
  if (i === 1) {
    const mi = await g.ask('ローンの回数は？\n（金利は、そのときの相場の単純計算）', ['36回', '60回', '84回', 'やめる'], { cancel: 3 });
    if (mi === 3) return false;
    const months = [36, 60, 84][mi];
    const p = loanPlan(g, it, months);
    const ok = await g.ask(`頭金 ${fmtMoney(p.down)}（と駐車場の初月分 ${fmtMoney(park)}）\n毎月 ${fmtMoney(p.monthly)} × ${months}回\n支払いの総額 ${fmtMoney(p.total + p.down)}`, ['これで買う', 'やめる'], { cancel: 1 });
    if (ok !== 0) return false;
    opts = { loan: true, months };
  }
  const why = canBuy(g, it, opts);
  if (why) { g.sfx('buzz'); await g.say(`「${why}」`, who); return false; }
  const r = buy(g, it, opts);
  if (!r.ok) { g.sfx('buzz'); await g.say(`「${r.why}」`, who); return false; }
  g.sfx('fanfare');
  await g.say([
    `「ご契約ありがとうございます！　こちらがキーです。」`,
    `${M.name}を手に入れた！（${fmtMoney(r.cash)}を支払った）`,
    `駐車場は、近くの月極を押さえてある。\n毎月の引き落としと、車検、5月の自動車税に気をつけよう。\nスマホ（手帳）の「マイカー」から、ドライブもできる。`,
  ], who);
  g.notify('愛車を手に入れた！', { color: '#ffd23f', life: 260 });
  return true;
}
async function browse(g, items, title) {
  if (g.carOwned()) { await g.say('「すでにお車をお持ちですね。買いかえるなら、先にお売りいただいてからに。」', who); return false; }
  let idx = 0;
  for (let guard = 0; guard < 40; guard++) {
    const k = await g.list({ title, items: items.map(itemLabel), x: 8, y: 8, w: 304, cancel: -1, index: idx, describe: (j) => itemInfo(g, items[j]) });
    if (k < 0) return false;
    idx = k;
    if (await purchase(g, items[k])) return true;
  }
  return false;
}
async function sellFlow(g) {
  const c = car(g);
  if (!c) { await g.say('「お売りいただけるお車は、ないようです。」', who); return; }
  const M = MODELS[c.id];
  const price = offerOf(g, c);
  const owe = (c.loan ? c.loan.left : 0) + c.owed;
  const i = await g.ask([`「${M.name}、${c.km.toLocaleString('ja-JP')}km、コンディション ${Math.round(c.cond)}ですね。\n査定は、${fmtMoney(price)}です。」${owe ? `\nローンと未納の ${fmtMoney(owe)} は、売値から引かせていただきます。` : ''}`], ['売る', 'やめる'], { cancel: 1 });
  if (i !== 0) return;
  const r = sell(g);
  if (!r.ok) { g.sfx('buzz'); await g.say(`「${r.why}」`, who); return; }
  g.sfx('coin');
  await g.say([`${r.model}を売った。（売値 ${fmtMoney(r.price)}${r.owe ? `・ローンなどを引いて、手もとに ${fmtMoney(Math.max(0, r.net))}` : ''}）`, '「またのご利用をお待ちしています。」'], who);
}
export async function carShop(g) {
  const era = eraId(g);
  await g.say([`「いらっしゃいませ。${NAME}です。」`, era === 'showa' ? '「カセットもエアコンも、ぜんぶ新しいのが入ってますよ。」' : era === 'reiwa' ? '「ご予算に合わせて、新車も中古車もご案内します。」' : '「新車も中古車もそろえています。ゆっくり見ていってください。」'], who);
  for (let guard = 0; guard < 20; guard++) {
    const lot = lotOf(g);
    const choices = ['新車を見る', '中古車を見る', ...(g.carOwned() ? ['愛車を売る（査定）'] : []), '維持費のはなし', 'やめておく'];
    const i = await g.ask(g.carOwned() ? 'ご用件は？' : holds(g, 'futsu') ? 'ご用件は？' : 'ご用件は？\n（車を買うには、普通免許が要ります）', choices, { cancel: choices.length - 1 });
    const label = choices[i];
    if (label === 'やめておく') return;
    if (label === '新車を見る') { if (await browse(g, lot.fresh, '新車')) return; }
    else if (label === '中古車を見る') { if (await browse(g, lot.used, '中古車（毎月ならびが変わる）')) return; }
    else if (label === '愛車を売る（査定）') await sellFlow(g);
    else if (label === '維持費のはなし') {
      await g.say([`「車は、買ってからも、お金がかかります。」`, `「月極の駐車場が ${fmtMoney(20000)}〜、任意保険が ${fmtMoney(6000)}〜（お若いと高くなります）。」`, `「${TAX_MONTH}月には自動車税、車検は新車で3年、そのあとは2年ごと。ローンなら、毎月の返済も。」`, '「ガソリン代と、整備のお金も、見ておいてくださいね。」'], who);
    }
  }
}
export { openApp as openCarApp };
