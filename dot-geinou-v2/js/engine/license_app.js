// 教習予約 — the phone app of the 運転免許 system (owner: R8-L1). ケータイ / スマホ only (the 手帳 eras book at the school's desk).
//
//   免許証            the card (blue / gold), 有効期限
//   教習の状況        every step of the plan (済 / ○ / △ / ・)
//   教習を予約する    通学: a lesson or a 検定 → a day (あした … 次の週末) → a time (10:00 / 13:00 / 16:00 / 18:00)
//   予約の確認        today's / the coming booking (cancel)
//   ドライブ          with a license: レンタカーで半日ドライブ (¥6,000, 気分転換)
//   免許センター・教習所の案内
// Booking rules live in license_flow.js (bookStep / cancelBooking / checkBooking): 一度に1件、遅刻は無断キャンセル（料金）。

import { registerPhoneApp } from './life.js';
import { phoneList, phoneInfo, phoneConfirm, closePhoneThen, appTile, rrect, box, phoneText as T } from './phone.js';
import { weekdayOf } from './life.js';
import {
  devOf, lic, schoolOf, stepList, progressText, licenseCard, holds, hmText, dayText, CLASSES, SCHOOL_NAME, CENTER_NAME, EXTRA_FEES, KARI_DAYS, CERT_DAYS, cardExpiry, expired,
} from './license.js';
import { bookStep, cancelBooking, practiceExam } from './license_flow.js';
import { drawLicenseCard } from './license_card.js';
import { fmtMoney } from './util.js';

const COLOR = '#2f9a5a';
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const WD = '月火水木金土日';
const stateMark = { done: '済', open: '○', locked: '・', quota: '△', wait: '△' };
const kindLabel = (x) => (x.type === 'gaku' ? '学科' : x.type === 'gi' ? '技能' : '検定');

function icon(c, x, y, g) {
  appTile(c, x, y, COLOR);
  const card = holds(g, 'any');
  R(c, x + 5, y + 8, 22, 15, '#f4f4f0'); R(c, x + 5, y + 8, 22, 3, card ? '#2f6fd0' : '#d0402f');
  R(c, x + 7, y + 13, 7, 8, '#8fb8e0'); R(c, x + 16, y + 14, 9, 1, '#6a6a70'); R(c, x + 16, y + 17, 9, 1, '#6a6a70'); R(c, x + 16, y + 20, 6, 1, '#6a6a70');
  R(c, x + 8, y + 24, 5, 3, '#222'); R(c, x + 19, y + 24, 5, 3, '#222');
}
const badge = (g) => {
  try {
    const s = schoolOf(g);
    if (!s) return 0;
    return s.booking && s.booking.day === g.state.day ? 1 : 0;
  } catch (e) { return 0; }
};

async function viewCard(g) {
  const card = licenseCard(g);
  if (!card) return;
  await phoneInfo(g, {
    title: '免許証', color: COLOR,
    draw(c, a) {
      drawLicenseCard(c, a.x, a.y + 8, card, g.state.look, { scale: a.w / 320, t: g.frame || 0 });
      const y = a.y + 8 + 200 * (a.w / 320) + 8;
      T(c, `${card.classNames.join('・')}　${card.colorName}`, a.x + a.w / 2, y, 12, '#333', 'center');
      T(c, card.expired ? '有効期限が切れています。免許センターで更新を。' : `有効期限 ${card.expires}`, a.x + a.w / 2, y + 16, 11, card.expired ? '#d0402f' : '#666', 'center');
      if (card.shoshin) T(c, `初心運転者標識（若葉マーク）あと${card.shoshinLeft}日`, a.x + a.w / 2, y + 31, 11, '#2f8a3a', 'center');
    },
  });
}
async function viewSteps(g) {
  const s = schoolOf(g);
  if (!s) return;
  const rows = stepList(g).map((r) => ({ label: `${stateMark[r.state]}　${r.step.label}`, sub: r.state === 'done' ? `${kindLabel(r.step)}・済み` : r.why ? `${kindLabel(r.step)}・${r.why}` : `${kindLabel(r.step)}・受けられる`, disabled: r.state === 'done' }));
  await phoneList(g, { title: progressText(g), color: COLOR, items: rows, hint: 'B:もどる', pick: () => {}, rowH: 38 });
}
async function doBook(g) {
  const s = schoolOf(g);
  if (!s || s.kind !== 'tsugaku') return;
  const rows = stepList(g).filter((r) => r.state === 'open' || r.state === 'quota' || r.state === 'wait');
  if (!rows.length) { await phoneInfo(g, { title: '予約', color: COLOR, text: '予約できる教習は、いまありません。\n（ほかの教習を終えると、次のコマが予約できます）' }); return; }
  const i = await phoneList(g, { title: '何を予約する？', color: COLOR, items: rows.map((r) => ({ label: r.step.label, sub: `${kindLabel(r.step)}${r.state === 'open' ? '' : '・今日は上限（あしたから）'}` })), hint: 'A:えらぶ　B:もどる' });
  if (i < 0) return;
  const step = rows[i].step;
  const offs = [1, 2, 3];
  let w = 1; while (weekdayOf(g.state.day + w) < 5 && w < 8) w++;
  offs.push(w);
  const di = await phoneList(g, { title: '何日にする？', color: COLOR, items: offs.map((o, k) => ({ label: ['あした', 'あさって', '3日後', '次の週末'][k], sub: `${dayText(g, g.state.day + o)}（${WD[weekdayOf(g.state.day + o)]}）` })), hint: 'A:えらぶ　B:もどる' });
  if (di < 0) return;
  const mins = [600, 780, 960, 1080];
  const ti = await phoneList(g, { title: '何時にする？', color: COLOR, items: mins.map((m) => ({ label: hmText(m), sub: '1コマ50分' })), hint: 'A:えらぶ　B:もどる' });
  if (ti < 0) return;
  const r = bookStep(g, step.id, offs[di], mins[ti]);
  g.sfx(r.ok ? 'chime' : 'buzz');
  await phoneInfo(g, { title: '予約', color: COLOR, text: r.ok ? `予約しました。\n${dayText(g, r.day)}（${WD[weekdayOf(r.day)]}） ${hmText(r.min)}\n${step.label}\n\nその日に教習所の受付へ。遅れると、無断キャンセルの料金（${fmtMoney(EXTRA_FEES.cancel)}）がかかります。` : r.why });
}
async function viewBooking(g) {
  const s = schoolOf(g);
  if (!s || !s.booking) return;
  const b = s.booking;
  const step = stepList(g).find((r) => r.step.id === b.step);
  const i = await phoneConfirm(g, { title: '予約の確認', color: COLOR, text: `${dayText(g, b.day)}（${WD[weekdayOf(b.day)]}） ${hmText(b.min)}\n${step ? step.step.label : '教習'}\n\n${b.day === g.state.day ? '今日です。教習所の受付へ。' : ''}`, choices: ['このまま', '取り消す'] });
  if (i === 1) { cancelBooking(g); g.sfx('cancel'); }
}
async function doDrive(g) {
  const cost = 6000;
  const why = (() => { try { return g.lifeRefusal(); } catch (e) { return null; } })();
  const lines = ['レンタカーを借りて、半日ドライブ。', `料金は ${fmtMoney(cost)}。海でも山でも、好きなところへ。`];
  const i = await phoneConfirm(g, { title: 'ドライブ', color: COLOR, text: lines.join('\n') + (why ? `\n\n${[].concat(why)[0]}` : ''), choices: ['出かける', 'やめる'] });
  if (i !== 0) return;
  closePhoneThen(g, async (gg) => {
    if (gg.state.money < cost) { await gg.say('お金が足りない…。'); return; }
    if (why) { await gg.say(why); return; }
    gg.spend(cost); gg.sfx('coin');
    await gg.fadeOut(14);
    try { if (typeof gg.advanceTime === 'function') gg.advanceTime(240, 'ドライブ'); } catch (e) { console.error(e); }
    await gg.wait(700);
    lic(gg).rental++;
    gg.relax({ stress: 18, hunger: -8 });
    gg.state.stamina = Math.max(0, gg.state.stamina - 10);
    await gg.fadeIn(14);
    await gg.say(['海ぞいの道を、窓を少し開けて走った。', '免許を取ってよかった、と思った。\n安全運転で、無事に帰ってきた。（ストレス -18）']);
  });
}
async function viewInfo(g) {
  await phoneInfo(g, {
    title: '免許の案内', color: COLOR,
    lines: [
      // [R9-B1] the school and the centre moved to the 駅前 of 調布 and 府中 (js/world/ekimae_tokyo.js)
      `【${SCHOOL_NAME}】`, '調布駅前（新宿からドット多摩線）。通学は予約制、合宿は宿泊しながら最短2週間。', '',
      `【${CENTER_NAME}】`, '府中駅前の免許試験場（多摩線の終点）。学科試験・免許の更新・原付免許。平日 9:00〜16:00。', '',
      '【流れ】入所・適性検査 → 第1段階 → 修了検定 → 仮免学科（90%以上）→ 仮免許（6か月）→ 第2段階 → 卒業検定 → 免許センターで学科試験 → 免許証。', '',
      `仮免許は交付から${KARI_DAYS / 10}か月、卒業証明書は${CERT_DAYS / 120}年、教習は入所から9か月で有効期間が切れます。`,
    ],
  });
}

function menu(g) {
  const L = lic(g);
  const s = L.school;
  const card = licenseCard(g);
  const items = [];
  if (card) items.push({ label: '免許証', sub: `${card.classNames.join('・')}・${card.colorName}${card.expired ? '・期限切れ' : ''}`, run: () => viewCard(g) });
  if (s) {
    items.push({ label: '教習の状況', sub: `${CLASSES[s.cls].name}（${s.kind === 'gassyuku' ? '合宿' : '通学'}）${progressText(g)}`, run: () => viewSteps(g) });
    if (s.kind === 'tsugaku') {
      if (s.booking) items.push({ label: '予約の確認', sub: `${s.booking.day === g.state.day ? '今日' : dayText(g, s.booking.day)} ${hmText(s.booking.min)}`, run: () => viewBooking(g) });
      else if (!s.cert) items.push({ label: '教習を予約する', sub: '学科・技能・検定', run: () => doBook(g) });
    } else items.push({ label: '合宿中', sub: s.camp && s.camp.arrived ? `${s.camp.day}日目` : '東京に戻っています', run: () => viewSteps(g) });
  }
  if (holds(g, 'futsu')) items.push({ label: 'ドライブ', sub: `レンタカー ${fmtMoney(6000)}（半日）`, run: () => doDrive(g) });
  items.push({ label: '学科の練習', sub: '○×を10問（成績には入りません）', run: () => closePhoneThen(g, (gg) => practiceExam(gg)) });
  items.push({ label: '免許の案内', sub: '教習所・免許センター', run: () => viewInfo(g) });
  return items;
}
async function openApp(g) {
  for (let guard = 0; guard < 20; guard++) {
    const items = menu(g);
    const i = await phoneList(g, { title: '教習予約', color: COLOR, items: items.map((x) => ({ label: x.label, sub: x.sub })), hint: 'A:えらぶ　B:もどる' });
    if (i < 0 || !items[i]) return;
    await items[i].run();
  }
}

registerPhoneApp('kyoshu', {
  name: '教習予約', color: COLOR, order: 43.5,
  iconHD: icon, badge,
  cond: (g) => devOf(g) !== 'techo',
  open: (g) => openApp(g),
});
export { openApp as openLicenseApp };
