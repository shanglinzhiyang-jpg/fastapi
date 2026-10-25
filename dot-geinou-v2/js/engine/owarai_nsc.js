// NSC（吉本総合芸能学院）— the school year as state (owner: A): application, 入学, monthly fees, classes and attendance,
// ネタ見せ records, graduation (卒業公演 → 所属審査 through g.audition, or 修了 without it). The rooms and the scenes are in
// js/places/nsc.js (places 'nsc' = 大阪校 in なんば, 'nsc_tokyo' = 東京校 in the Tokyo town).
//
// Verified (2026-10, WebSearch of the official 吉本興業 / NSC pages): NSC opened in Osaka in April 1982 (吉本興業ヒストリー:
// 1982年4月4日, 大阪で「吉本総合芸能学院（NSC）」を開校) and in Tokyo in 1995; a one-year course entered in April (入学式・クラス
// 決定・「相方探しの会」 in April, ネタ見せ from May); classes: ネタ見せ (about 4 in 10 of all classes), 発声, 演技, ダンス, 発想法
// (大喜利), コント, 吉本新喜劇, 落語, 即興. 期: 東京校 2004年入学 = 10期 (→ 1期 = 1995); 大阪校 1期 = 1982.
// Fees (official 入学案内, 東京・大阪校, current): 入学諸経費 115,000円・年間授業料 330,000円・年間施設使用料 55,000円 (税込).
// Fees of earlier years could not be verified: the game charges the same internal amounts in every era (money is shown in the
// era's prices) and marks them 目安 outside 令和. Paying the year's fees month by month is this game's own arrangement.
// Teachers and classmates are fictional.

import { Game } from './game.js';
import { weekdayOf } from './life.js';
import { clamp, fmtMoney } from './util.js';
import { personalityMult } from './profile.js';
import { num, dateOf, NSC_COHORT, COMEDY_STATS, STAT_KEYS, eraKey } from './owarai_data.js';

export const CAMPUS = {
  osaka: { id: 'osaka', name: 'NSC大阪校', short: '大阪校', founded: 1982, place: 'nsc', town: 'なんば' },
  tokyo: { id: 'tokyo', name: 'NSC東京校', short: '東京校', founded: 1995, place: 'nsc_tokyo', town: '東京' },
};
export const FEES = { entry: 115000, tuition: 330000, facility: 55000 };
export const MONTHS = 12;
// The screens show the real yearly amounts; the bills follow the game's compressed year (a year = 120 days, a "month" = 10
// days): the yearly 授業料＋施設使用料 is billed as 12 installments of (yearly × 120 / 365) / 12 ≈ ¥10,550, about the rent of
// ドット荘 per day, so a student who works (the 劇場の裏方 job the 受付 offers, the jobs open to amateurs) can pay. A 入学金
// a student cannot pay (and no family to help) can be added to the installments the same way (× 120 / 365).
export const COMPRESS = 120 / 365;
export const YEARLY = FEES.tuition + FEES.facility;
export const BILLED_YEAR = Math.round((YEARLY * COMPRESS) / 10) * 10;
export const monthly = () => Math.round(BILLED_YEAR / MONTHS / 10) * 10;
export const ENTRY_SPLIT = Math.round((FEES.entry * COMPRESS) / 10) * 10;
// the student job (劇場の裏方：場内整理・もぎり), once a day for an enrolled student
export const BAITO = { pay: 2400, stamina: 25, stress: 3 };
// classes by weekday (0 = 月): 火 alternates ダンス / 落語 by week; April (before ネタ見せ starts in May) has 芸人の基本 instead
export const CLASSES = {
  hassei: { label: '発声・滑舌', teacher: '羽生田 澄江 先生（ボイストレーナー）', gains: { voice: 2.5, wagei: 0.6 }, lines: ['腹式呼吸から、早口言葉、外郎売。\n「声は芸人の楽器や」…先生の口ぐせだ。', '後ろの壁に向かって、ひと言ずつ届ける練習。\n声が届くと、空気が変わるのがわかる。'] },
  dance: { label: 'ダンス', teacher: '坂巻 涼 先生', gains: { chara: 1.6, dokyo: 1, act: 0.6 }, lines: ['リズムに乗って、体をめいっぱい使う。\n「舞台は全身で立つんや！」', '振りを覚えるのに必死だ。\nでも、鏡の中の自分が少し大きく見えた。'] },
  rakugo: { label: '落語', teacher: '月見亭 小まど 師匠', gains: { wagei: 2, ma: 1.2 }, lines: ['扇子と手ぬぐいだけで、そばをすする。\n「間（ま）がすべてや」', '上下（かみしも）をきる練習。\nひとりで何人も演じ分けるのは、むずかしい。'] },
  netami: { label: 'ネタ見せ', teacher: '', gains: { neta: 1.5, kosei: 1, dokyo: 1 }, lines: [] },
  kihon: { label: '芸人の基本（座学）', teacher: '事務局・構成作家の先生たち', gains: { kosei: 1.5, neta: 1, kankyaku: 0.8 }, lines: ['ネタの構成、ツカミとオチ、舞台のあいさつ。\n「売れる前に、まず続けること」', '劇場のしくみ、営業のマナー。\nメモをとる手が止まらない。'] },
  engi: { label: '演技（コント・新喜劇）', teacher: '大道寺 健 先生', gains: { act: 2.4, chara: 0.6, kosei: 0.5 }, lines: ['エチュード（即興の芝居）。\n設定だけ渡されて、役になりきる。', '新喜劇のズッコケの稽古。\n…思ったより、ずっと痛い。'] },
  hassou: { label: '発想法（大喜利・即興）', teacher: '小此木 遊 先生', gains: { hassou: 2.2, adlib: 1.6 }, lines: ['お題に、三十秒で答えを五つ。\n「ふつうの答えは、答えやない」', '即興のやりとり。\n相手のセリフを受けて、すぐに返す。'] },
};
export function classToday(g, day) {
  const d = day ?? g.state.day;
  const wd = weekdayOf(d);
  const date = dateOf(g, d);
  const week = Math.floor((d - 1) / 7);
  const april = date.month === 4;
  const id = [
    'hassei', week % 2 ? 'rakugo' : 'dance', april ? 'kihon' : 'netami', 'engi', 'hassou', april ? 'kihon' : 'netami', null,
  ][wd];
  return id ? { id, ...CLASSES[id] } : null;
}
export const campusOpen = (g, campus, year) => !!CAMPUS[campus] && num(year, dateOf(g).year) >= CAMPUS[campus].founded;
export const kiOf = (campus, year) => (CAMPUS[campus] ? year - CAMPUS[campus].founded + 1 : 0);

function nsc(g) {
  const o = g.__ow.ensure(g);
  const n = o.nsc;
  if (!['none', 'applied', 'enrolled', 'graduated', 'expelled', 'quit'].includes(n.status)) n.status = 'none';
  if (!n.fees || typeof n.fees !== 'object') n.fees = { months: 0, paid: 0, unpaid: 0, lastYM: 0 };
  for (const k of ['months', 'paid', 'unpaid', 'lastYM']) n.fees[k] = Math.max(0, num(n.fees[k]));
  if (!n.classes || typeof n.classes !== 'object') n.classes = {};
  if (!Array.isArray(n.netami)) n.netami = [];
  n.attend = Math.max(0, num(n.attend));
  return n;
}
// class days (月〜土) from the 入学 day up to yesterday / today
function classDays(g, n, upto) {
  if (!n.enrollDay) return 0;
  let c = 0;
  for (let d = n.enrollDay; d <= upto; d++) if (weekdayOf(d) !== 6) c++;
  return c;
}
function summary(g) {
  const n = nsc(g);
  const date = dateOf(g);
  const C = CAMPUS[n.campus] || null;
  const end = n.gradDay || g.state.day;
  const days = classDays(g, n, end);
  const scores = n.netami.map((x) => num(x.score));
  return {
    status: n.status, campus: n.campus || null, campusName: C ? C.name : '', ki: n.ki || 0, year: n.year || 0,
    attend: n.attend, classDays: days, attendRate: days ? clamp(n.attend / days, 0, 1) : 0,
    netamiAvg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, netamiCount: scores.length, netamiBest: scores.length ? Math.max(...scores) : 0,
    monthly: monthly(), monthsBilled: n.fees.months, paid: n.fees.paid, unpaid: n.fees.unpaid, finalWarn: n.finalWarn || 0, entryLeft: num(n.fees.entryLeft),
    classToday: n.status === 'enrolled' ? classToday(g) : null, attendedToday: n.lastClassDay === g.state.day,
    gradOpen: n.status === 'enrolled' && date.year > num(n.year) && date.month <= 3 && date.month >= 3,
    grad: n.grad || null, aikataKai: !!n.aikataKai, enrollDay: n.enrollDay || 0, applyDay: n.applyDay || 0,
    open: { osaka: campusOpen(g, 'osaka'), tokyo: campusOpen(g, 'tokyo') }, verified: eraKey(g) === 'reiwa',
  };
}

// ---------------------------------------------------------------- state changes (the scenes in places/nsc.js call these)
// apply: the 入学諸経費 is paid now; 入学 is the coming April (or today in April)
function commitApply(g, campus, opts = {}) {
  const n = nsc(g);
  const date = dateOf(g);
  n.campus = campus;
  n.applyDay = g.state.day;
  n.fees = { months: 0, paid: opts.familyPaid || opts.entrySplit ? 0 : FEES.entry, unpaid: 0, lastYM: 0, family: !!opts.familyPaid, entryLeft: opts.entrySplit ? ENTRY_SPLIT : 0 };
  n.netami = []; n.classes = {}; n.attend = 0; n.grad = null; n.aikataKai = 0; n.lastClassDay = 0; n.gradDay = 0;
  if (date.month === 4) enroll(g, n, date);
  else { n.status = 'applied'; n.year = date.month >= 4 ? date.year + 1 : date.year; n.ki = kiOf(campus, n.year); }
  return summary(g);
}
function enroll(g, n, date) {
  n.status = 'enrolled';
  n.year = date.year;
  n.ki = kiOf(n.campus, date.year);
  n.enrollDay = g.state.day;
  n.fees.lastYM = 0;
  billMonth(g, n, date, true);
}
// one installment of 授業料・施設使用料 each game month (paid at once when the money is there, else 未納). A 入学金 put on the
// installments is added to the first six.
function billMonth(g, n, date, quiet) {
  const ym = date.year * 100 + date.month;
  if (n.fees.lastYM === ym || n.fees.months >= MONTHS) return;
  n.fees.lastYM = ym;
  n.fees.months++;
  let amt = n.fees.months === MONTHS ? BILLED_YEAR - monthly() * (MONTHS - 1) : monthly();
  let entry = 0;
  if (num(n.fees.entryLeft) > 0) { entry = Math.min(num(n.fees.entryLeft), Math.round(ENTRY_SPLIT / 6 / 10) * 10 || n.fees.entryLeft); if (n.fees.months >= 6) entry = num(n.fees.entryLeft); n.fees.entryLeft -= entry; amt += entry; }
  const st = g.state;
  const what = `授業料・施設使用料の分納（${n.fees.months}／${MONTHS}回目）${entry ? '＋入学金の分納' : ''}`;
  if (st.money >= amt) {
    st.money -= amt;
    n.fees.paid += amt;
    n.fees.lastPay = g.state.day;
    if (!quiet) g.message({ from: `${CAMPUS[n.campus].name} 事務局`, kind: 'bill', receipt: true, text: `${what} ${fmtMoney(amt)} をお支払いいただきました。` });
  } else {
    n.fees.unpaid += amt;
    g.message({ from: `${CAMPUS[n.campus].name} 事務局`, kind: 'bill', text: `${what} ${fmtMoney(amt)} が未納です（未納 計${fmtMoney(n.fees.unpaid)}）。NSCの受付か、「芸人手帳」の芸歴・記録→NSCから払えます。受付では、学生向けの劇場の裏方バイトも紹介しています。` });
  }
}
function payUnpaid(g) {
  const n = nsc(g);
  const pay = Math.min(g.state.money, n.fees.unpaid);
  if (pay <= 0) return 0;
  g.state.money -= pay;
  n.fees.unpaid -= pay;
  n.fees.paid += pay;
  n.fees.lastPay = g.state.day;
  if (n.fees.unpaid < monthly() * 3) n.finalWarn = 0;
  return pay;
}
// one class (counts for attendance; the ネタ見せ scene passes its score)
function attend(g, opts = {}) {
  const st = g.state;
  const n = nsc(g);
  const cls = opts.cls ? { id: opts.cls, ...CLASSES[opts.cls] } : classToday(g);
  if (n.status !== 'enrolled' || !cls) return null;
  const first = n.lastClassDay !== st.day;
  if (first) n.attend++;
  n.lastClassDay = st.day;
  n.classes[cls.id] = num(n.classes[cls.id]) + 1;
  const o = g.__ow.ensure(g);
  const before = { ...o.stats };
  const k = (first ? 1 : 0.35) * personalityMult(st, 'lesson');
  for (const [key, v] of Object.entries(cls.gains || {})) g.__ow.growStat(o, key, v * k);
  if (cls.id === 'netami' && Number.isFinite(Number(opts.score))) { n.netami.push({ day: st.day, score: Math.round(Number(opts.score)), kind: opts.kind || 'manzai' }); if (n.netami.length > 40) n.netami.shift(); }
  const ups = STAT_KEYS.filter((key) => o.stats[key] > before[key]).map((key) => `${COMEDY_STATS[key]} ${before[key]}→${o.stats[key]}`);
  return { cls, ups, first };
}
// the student job (劇場の裏方：場内整理・もぎり): once a day; also offered to anyone at the 貸し稽古場 (owner: places/nsc.js)
function baito(g, opts = {}) {
  const st = g.state;
  const o = g.__ow.ensure(g);
  if (o.daily.day !== st.day) o.daily = { day: st.day, counts: {}, msgs: 0 };
  if (num(o.daily.counts.baito) >= 1) return { ok: false, why: '今日はもうバイトに入った。' };
  const stamina = opts.stamina ?? BAITO.stamina;
  if (st.stamina < stamina) return { ok: false, why: '体力が足りない…。' };
  const why = g.lifeRefusal();
  if (why) return { ok: false, why: [].concat(why).join('\n') };
  o.daily.counts.baito = 1;
  st.stamina -= stamina;
  g.lifeTick({ stress: opts.stress ?? BAITO.stress, hunger: -12, clean: -8 });
  const pay = opts.pay ?? BAITO.pay;
  g.addMoney(pay, true);
  return { ok: true, pay };
}
function graduate(g, opts = {}) {
  const n = nsc(g);
  if (n.status !== 'enrolled') return null;
  const s = summary(g);
  n.status = 'graduated';
  n.gradDay = g.state.day;
  const show = Number.isFinite(Number(opts.show)) ? Math.round(Number(opts.show)) : null;
  const score = clamp(Math.round((show ?? s.netamiAvg * 0.85) * 0.45 + s.netamiAvg * 0.3 + s.attendRate * 100 * 0.25), 0, 100);
  n.grad = { day: g.state.day, show, score, shinsa: null };
  const o = g.__ow.ensure(g);
  if (!o.career.debut) { o.career.debut = { ...dateOf(g), day: g.state.day, how: 'nsc' }; g.__ow.logC(g, o, `${CAMPUS[n.campus].name} 卒業（芸歴のはじまり）`); if (!o.pin.set) o.pin = { formed: { ...o.career.debut }, set: true }; }
  else g.__ow.logC(g, o, `${CAMPUS[n.campus].name} 卒業`);
  return n.grad;
}

// ---------------------------------------------------------------- morning
export function nscMorning(g, o) {
  const n = nsc(g);
  const date = dateOf(g);
  const C = CAMPUS[n.campus];
  if (n.status === 'applied' && C && (date.year > num(n.year) || (date.year === num(n.year) && date.month >= 4))) {
    enroll(g, n, date);
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'chat', text: `入学おめでとうございます。本日から${C.name}の${n.ki}期生です。授業は月曜〜土曜（時間割は校内の掲示板）。4月は「相方探しの会」もあります。学費が心配な人には、受付で劇場の裏方バイトを紹介しています。` });
    return;
  }
  if (n.status !== 'enrolled' || !C) return;
  // the school year ends: April after the 入学 year → 修了 (without the 卒業公演 there is no 所属審査)
  if (date.year > num(n.year) && date.month >= 4 && date.month <= 12) {
    graduate(g, {});
    n.grad.shinsa = 'skipped';
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'chat', text: `${n.ki}期生のみなさん、修了おめでとうございます。卒業公演に出なかったため、所属審査は行われませんでした。所属を希望する場合は、事務所のオーディションを受けてください。` });
    return;
  }
  billMonth(g, n, date, false);
  // 未納: a notice at 2 installments, a final notice at 4; 除籍 only 8+ days after the final notice with nothing paid since
  const m = monthly();
  const day = g.state.day;
  if (n.fees.unpaid >= m * 4 && !n.finalWarn) {
    n.finalWarn = day;
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'bill', text: `【最終のお知らせ】学費の未納が${fmtMoney(n.fees.unpaid)}になっています。次の分納日までに一部でも納めていただけない場合、規定により除籍となります。受付で劇場の裏方バイトも紹介しています。` });
  } else if (n.fees.unpaid >= m * 5 && n.finalWarn && day - n.finalWarn >= 8 && num(n.fees.lastPay) < n.finalWarn) {
    n.status = 'expelled';
    g.__ow.logC(g, o, `${C.name} 除籍（学費の未納）`);
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'chat', text: '学費の未納が続いたため、規定により除籍となりました。またいつか、挑戦をお待ちしています。' });
    return;
  } else if (n.fees.unpaid >= m * 2 && n.warnYM !== date.year * 100 + date.month && !n.finalWarn) {
    n.warnYM = date.year * 100 + date.month;
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'bill', text: `学費の未納が${fmtMoney(n.fees.unpaid)}になっています。受付で払えます。学生向けの劇場の裏方バイトも紹介しています。` });
  }
  if (date.month === 3 && !n.gradNote) {
    n.gradNote = true;
    g.__ow.sendOw(g, o, { force: true, from: `${C.name} 事務局`, kind: 'chat', text: '3月は卒業公演です。校内の劇場（ネタ見せ教室）で出番があります。卒業公演の結果と一年間の成績で、所属審査が行われます。' });
  }
  if (date.month === 4 && !n.aikataKai && !o.unit && !n.kaiNote) {
    n.kaiNote = true;
    g.__ow.sendOw(g, o, { from: `${C.name} 事務局`, kind: 'chat', text: '今月は「相方探しの会」があります。教室に来てください。同期の中から相方をさがせます。' });
  }
}

const methods = {
  nsc() { return summary(this); },
  nscCampus(id) { return CAMPUS[id] || null; },
  nscCampusOpen(id, year) { return campusOpen(this, id, year); },
  nscCommitApply(campus, opts) { return commitApply(this, campus, opts); },
  nscAttend(opts) { return attend(this, opts); },
  nscGraduate(opts) { return graduate(this, opts); },
  nscPay() { return payUnpaid(this); },
  nscBaito(opts) { return baito(this, opts); },
  nscQuit() { const n = nsc(this); if (n.status === 'enrolled' || n.status === 'applied') { n.status = 'quit'; return true; } return false; },
  nscClassToday(day) { return classToday(this, day); },
  nscCohort() { const n = nsc(this); return n.campus ? NSC_COHORT[n.campus].slice() : []; },
  nscRecord() { return nsc(this); },
};
for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(Game.prototype, k, Object.getOwnPropertyDescriptor(methods, k));
