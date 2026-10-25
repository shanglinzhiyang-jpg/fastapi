// 自動車免許取得システム — core (owner: R8-L1). 教習所 → 修了検定 → 仮免許 → 第2段階 → 卒業検定 → 免許センター → 免許証.
// API doc: test-output/api_license.txt. The scenes (desk, camp, centre) are in license_flow.js, the 学科 exam is the
// minigame 'license_exam' (license_exam.js), the 適性検査 the minigame 'license_check', the card art is license_card.js,
// the phone app 「教習予約」 license_app.js. This file is the state, the rules by year and the g.* API.
//
// State g.state.license (lazy, save-safe; an old save without it starts empty):
//   { v: 1, classes: { futsu: { got: day, mt: bool|null, serial, via: 'school'|'center', school, renewals, cond: [..] }, … },
//     school: null | { cls, mt, kind: 'tsugaku'|'gassyuku', site, enrolled, fee, done: { stepId: day }, ken1 / kari / ken2 / cert:
//                      day|0, fails: { ken1, kari, ken2 }, need: { hoshu: n }, t: { day, gi, gaku, ken }, booking, camp, …},
//     center: { tekisei: day, attempts: { cls: n }, lastTry: day }, history: [{ day, text }], violations, stats }
//
// Time scale: a game day is 3 calendar days (g.clock / api_clock.txt): 合宿 AT 約14日 = 5 game days, MT 約16日 = 6.

import { Game } from './game.js';
import { PLACES } from './map.js';
import { MINIGAMES } from './minigame.js';
import { registerPhoneApp, onMorning, weekdayOf, weekOf, PEOPLE } from './life.js';
import { ageOf, YEAR_DAYS, fullName } from './profile.js';
import { fmtMoney, clamp } from './util.js';
import { asQuizQuestion } from './license_bank.js';

const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const has = (g, k) => !!g && typeof g[k] === 'function';
const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error('[license]', e); return d; } };
export const eraId = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_BASE[e] ? e : 'reiwa'; };
export const devOf = (g) => { const e = eraId(g); return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; };

// ======================================================================== calendar
export function dateOfDay(g, day) {
  const d = Math.max(1, Math.floor(num(day, g && g.state ? g.state.day : 1)));
  const n = d - 1;
  const idx = 3 + Math.floor(n / 10);
  const year = ERA_BASE[eraId(g)] + Math.floor(idx / 12);
  return { year, month: (idx % 12) + 1, date: (n % 10) * 3 + 1 };
}
export const ymOfDay = (g, day) => { const d = dateOfDay(g, day); return d.year * 100 + d.month; };
export const ymNow = (g) => ymOfDay(g, g.state.day);
export function warekiOf(year, month = 6, date = 1) {
  const v = year * 10000 + month * 100 + date;
  if (v >= 20190501) return `令和${year - 2018 === 1 ? '元' : year - 2018}年`;
  if (v >= 19890108) return `平成${year - 1988 === 1 ? '元' : year - 1988}年`;
  return `昭和${year - 1925}年`;
}
export const dateText = (d) => `${warekiOf(d.year, d.month, d.date)}${d.month}月${d.date}日`;
export const dayText = (g, day) => dateText(dateOfDay(g, day));
// the player's birthday is the first of April of the era's base year, every YEAR_DAYS (profile.js: day 1 + k * 120)
export function birthOf(g) {
  const p = g.state.profile || {};
  return { year: ERA_BASE[eraId(g)] - num(p.age, 20), month: 4, date: 1 };
}
const nextBirthday = (day) => 1 + YEAR_DAYS * Math.ceil((Math.max(1, day) - 1) / YEAR_DAYS);

// ======================================================================== classes, fees, plans
// Fees are written in today's yen (internal money; the display scales them by the era, util.js fmtMoney).
export const CLASSES = {
  gentsuki: { id: 'gentsuki', name: '原付', long: '原動機付自転車', kind: 1, school: false, vehicle: 'moto', cardName: '原付' },
  nirin: { id: 'nirin', name: '普通二輪', long: '普通自動二輪車', kind: 1, school: true, vehicle: 'moto', cardName: '普通二輪' },
  futsu: { id: 'futsu', name: '普通', long: '普通自動車', kind: 1, school: true, vehicle: 'car', cardName: '普通' },
  junchu: { id: 'junchu', name: '準中型', long: '準中型自動車（2トントラックなど）', kind: 1, school: true, vehicle: 'car', cardName: '準中型', from: 201703 },
  futsu2: { id: 'futsu2', name: '普通第二種', long: '普通第二種（タクシーなど）', kind: 2, school: true, vehicle: 'car', cardName: '普通二種' },
};
export const CLASS_ORDER = ['gentsuki', 'nirin', 'futsu', 'junchu', 'futsu2'];
// 通学 / 合宿 (宿泊・食事つき) by class [MT, AT]
export const SCHOOL_FEES = {
  nirin: { tsugaku: [155000, 150000], gassyuku: [185000, 180000] },
  futsu: { tsugaku: [305000, 290000], gassyuku: [250000, 235000] },
  junchu: { tsugaku: [335000, 335000], gassyuku: [285000, 285000] },
  futsu2: { tsugaku: [335000, 335000], gassyuku: [290000, 290000] },
};
export const EXTRA_FEES = {
  hoshu: 5500, // 補習（追加の技能教習）1回
  ken1: 3300, ken2: 5500, // 検定の再受験料
  kari: 1200, // 仮免学科の再受験料
  cancel: 1100, // 予約の無断キャンセル
  extendDay: 9000, // 合宿の延泊（1日）
  extendTerm: 15000, // 教習の有効期間の延長
  switchToTsugaku: 30000, // 合宿から通学に切りかえ
  centerGakka: 1500, // 学科試験の受験手数料（1回）
  centerIssue: 2050, // 免許証の交付手数料
  photo: 700, // 写真
  koshu: 4500, // 原付講習
  renew: 3300, // 更新手数料
};
export const SITES = {
  zao: { id: 'zao', name: '山形・蔵王校', short: '蔵王', extra: 0, desc: '雪国の山あい。食堂のご飯がおいしいと評判。', fare: 14000 },
  kogen: { id: 'kogen', name: '長野・高原校', short: '高原', extra: 5000, desc: '高原の澄んだ空気。夜は星がきれい。', fare: 9000 },
  aso: { id: 'aso', name: '熊本・阿蘇校', short: '阿蘇', extra: 10000, desc: '大きな山のふもと。温泉つきの寮。', fare: 22000 },
};
export const SITE_ORDER = ['zao', 'kogen', 'aso'];
export const SCHOOL_NAME = 'ドット自動車教習所';
export const CENTER_NAME = 'ドット運転免許センター';
export const OPEN_FROM = 540, OPEN_TO = 1140; // 9:00 – 19:00 (last start 18:00)
export const CAMP_DAYS = { at: 5, mt: 6 }; // game days (3 calendar days each): AT 約14日 / MT 約16日
export const KARI_DAYS = 60; // 仮免許は6か月（game: 10 days a month）
export const CERT_DAYS = 120; // 卒業証明書は1年
export const TERM_DAYS = 90; // 教習の有効期間（入所から9か月）
export const EXPIRY_YEARS = 3;

export const atAllowed = (ym) => ym >= 199111;
export const mtOnly = (cls) => cls === 'junchu' || cls === 'nirin';
export function minAgeOf(cls, ym, held) {
  if (cls === 'gentsuki' || cls === 'nirin') return 16;
  if (cls === 'futsu' || cls === 'junchu') return 18;
  if (cls === 'futsu2') return ym >= 202205 && held && held.special ? 19 : 21;
  return 18;
}

// the plan: stage 1 and 2 steps in order (gaku = 学科教習, gi = 技能教習)
export function planFor(cls, mt, ym) {
  const car = CLASSES[cls].vehicle === 'car';
  const second = cls === 'futsu2';
  const g = (id, label, cats, stage, minutes = 50) => ({ id, type: 'gaku', stage, label, cats, minutes });
  const d = (id, label, drv, stage, minutes = 50) => ({ id, type: 'gi', stage, label, drv, minutes });
  if (!car) {
    return {
      s1: [g('g1a', '交通ルールの基本', ['shingo', 'tsuko', 'kokoro'], 1), g('g1b', '二輪車の運転の心得', ['nirin', 'koten', 'tomaru'], 1),
        d('d1', '車体の取り回しと発進・停止', { stage: 'moto', course: 'basic' }, 1), d('d2', '一本橋', { stage: 'moto', course: 'ippon' }, 1), d('d3', 'スラローム', { stage: 'moto', course: 'slalom' }, 1)],
      s2: [g('g2a', '危険予測と運転の心得', ['kiken', 'kokoro'], 2), g('g2b', '応急救護処置', ['kozo'], 2),
        d('d4', '応用走行（急制動・コース）', { stage: 'moto', course: 'ouyou' }, 2)],
    };
  }
  if (second) {
    return {
      s1: [g('g1a', '旅客自動車の運送と接遇', ['second', 'shingo'], 1), g('g1b', '旅客の安全と車内事故の防止', ['second', 'kokoro'], 1),
        d('d1', '発進・停止・ハンドル操作（旅客を想定）', { stage: 'lesson1', course: 'second' }, 1), d('d2', 'クランク・S字', { stage: 'crank', course: 'second' }, 1),
        d('d3', '坂道発進・踏切', { stage: 'hill', course: 'second' }, 1)],
      s2: [g('g2a', '危険予測と旅客の安全', ['kiken', 'second'], 2), g('g2b', '応急救護処置', ['kozo'], 2), g('g2c', '高速道路・夜間・悪天候', ['koso', 'yoru'], 2),
        d('d4', '路上教習(1) 市街地の営業走行', { stage: 'second', course: 'city' }, 2), d('d5', '路上教習(2) 乗降と接客', { stage: 'second', course: 'passenger' }, 2)],
    };
  }
  const s1 = [g('g1a', '交通ルールの基本', ['shingo', 'tsuko'], 1), g('g1b', '運転の心得と危険な場所', ['kokoro', 'koten'], 1), g('g1c', '車の構造と点検', ['kozo', 'tomaru'], 1)];
  if (mt) s1.push(d('d0', 'クラッチ操作と変速', { stage: 'lesson1', course: 'clutch', mt: true }, 1));
  s1.push(d('d1', '発進・停止・ハンドル操作', { stage: 'lesson1', course: 'basic' }, 1), d('d2', 'クランク・S字', { stage: 'crank', course: 'crank' }, 1),
    d('d3', '方向変換・縦列駐車', { stage: 'park', course: 'park' }, 1), d('d4', '坂道発進・踏切', { stage: 'hill', course: 'hill' }, 1));
  return {
    s1,
    s2: [g('g2a', '危険予測と運転の心得', ['kiken', 'kokoro'], 2), g('g2b', '応急救護処置', ['kozo'], 2), g('g2c', '高速道路・夜間・悪天候', ['koso', 'yoru'], 2),
      d('d5', '路上教習(1) 市街地', { stage: 'road', course: 'city' }, 2), d('d6', '路上教習(2) 交差点・合図・安全確認', { stage: 'road', course: 'crossing' }, 2)],
  };
}
export const KEN = {
  ken1: { id: 'ken1', type: 'ken', stage: 1, label: '修了検定', long: '第1段階の修了検定（所内コース）', minutes: 60 },
  kari: { id: 'kari', type: 'kari', stage: 1, label: '仮免学科試験', long: '仮免許の学科試験（50問・90%以上で合格）', minutes: 40 },
  ken2: { id: 'ken2', type: 'ken', stage: 2, label: '卒業検定', long: '卒業検定（路上）', minutes: 60 },
};
export const PASS_LINE = (cls) => (cls === 'futsu2' ? 80 : 70);

// ======================================================================== state
const repaired = new WeakSet();
function repairSchool(s) {
  if (!isObj(s) || !CLASSES[s.cls]) return null;
  s.kind = s.kind === 'gassyuku' ? 'gassyuku' : 'tsugaku';
  s.mt = !!s.mt;
  s.site = SITES[s.site] ? s.site : null;
  s.enrolled = Math.max(1, Math.floor(num(s.enrolled, 1)));
  s.fee = Math.max(0, Math.round(num(s.fee)));
  s.done = isObj(s.done) ? Object.fromEntries(Object.entries(s.done).map(([k, v]) => [String(k), Math.max(1, Math.floor(num(v, 1)))])) : {};
  for (const k of ['ken1', 'kari', 'ken2', 'cert']) s[k] = Math.max(0, Math.floor(num(s[k])));
  s.fails = { ken1: 0, kari: 0, ken2: 0, ...(isObj(s.fails) ? s.fails : {}) };
  for (const k of Object.keys(s.fails)) s.fails[k] = Math.max(0, Math.floor(num(s.fails[k])));
  s.need = isObj(s.need) ? { hoshu: Math.max(0, Math.floor(num(s.need.hoshu))) } : { hoshu: 0 };
  s.t = isObj(s.t) ? { day: num(s.t.day), gi: num(s.t.gi), gaku: num(s.t.gaku), ken: num(s.t.ken) } : { day: 0, gi: 0, gaku: 0, ken: 0 };
  s.lastLesson = Math.max(0, Math.floor(num(s.lastLesson)));
  s.cond = Array.isArray(s.cond) ? s.cond.map(String).slice(0, 4) : [];
  s.special = !!s.special;
  s.booking = isObj(s.booking) && s.booking.step && num(s.booking.day) > 0 ? { step: String(s.booking.step), day: Math.floor(num(s.booking.day)), min: Math.floor(num(s.booking.min, 600)) } : null;
  s.camp = isObj(s.camp) ? {
    start: Math.max(1, Math.floor(num(s.camp.start, s.enrolled))), planned: Math.max(1, Math.floor(num(s.camp.planned, 5))), extra: Math.max(0, Math.floor(num(s.camp.extra))),
    day: Math.max(1, Math.floor(num(s.camp.day, 1))), arrived: !!s.camp.arrived, end: Math.max(0, Math.floor(num(s.camp.end))), prepaid: Math.max(0, Math.floor(num(s.camp.prepaid))),
    meals: Math.max(0, Math.floor(num(s.camp.meals))), vignette: Math.max(0, Math.floor(num(s.camp.vignette))), slotsDay: Math.max(0, Math.floor(num(s.camp.slotsDay))),
    slots: Array.isArray(s.camp.slots) ? s.camp.slots.map(Number).filter((x) => x >= 0 && x < 3) : [],
  } : null;
  if (s.kind === 'gassyuku' && !s.camp) s.camp = { start: s.enrolled, planned: s.mt ? CAMP_DAYS.mt : CAMP_DAYS.at, extra: 0, day: 1, arrived: false, end: 0, prepaid: 0, meals: 0, vignette: 0, slotsDay: 0, slots: [] };
  s.extended = Math.max(0, Math.floor(num(s.extended)));
  s.score = isObj(s.score) ? { gaku: num(s.score.gaku), n: num(s.score.n) } : { gaku: 0, n: 0 };
  s.gradDay = Math.max(0, Math.floor(num(s.gradDay)));
  return s;
}
export function lic(g) {
  const st = g.state;
  if (st.license && repaired.has(st.license)) return st.license;
  const s = isObj(st.license) ? st.license : {};
  const out = {
    v: 1,
    classes: {},
    school: repairSchool(s.school),
    center: { tekisei: 0, attempts: {}, lastTry: 0, ...(isObj(s.center) ? s.center : {}) },
    history: Array.isArray(s.history) ? s.history.filter((h) => isObj(h)).map((h) => ({ day: Math.floor(num(h.day, 1)), text: String(h.text || '') })).slice(-40) : [],
    violations: Math.max(0, Math.floor(num(s.violations))),
    stats: { exams: 0, passes: 0, fails: 0, ...(isObj(s.stats) ? s.stats : {}) },
    rental: Math.max(0, Math.floor(num(s.rental))),
  };
  out.center.tekisei = Math.max(0, Math.floor(num(out.center.tekisei)));
  out.center.lastTry = Math.max(0, Math.floor(num(out.center.lastTry)));
  out.center.attempts = isObj(out.center.attempts) ? out.center.attempts : {};
  if (isObj(s.classes)) {
    for (const [id, c] of Object.entries(s.classes)) {
      if (!CLASSES[id] || !isObj(c)) continue;
      out.classes[id] = {
        got: Math.max(1, Math.floor(num(c.got, 1))), mt: c.mt == null ? null : !!c.mt, serial: String(c.serial || ''), via: c.via === 'center' ? 'center' : 'school',
        school: String(c.school || ''), renewals: Math.max(0, Math.floor(num(c.renewals))), cond: Array.isArray(c.cond) ? c.cond.map(String).slice(0, 4) : [],
        expires: Math.max(0, Math.floor(num(c.expires))), special: !!c.special,
      };
      if (!out.classes[id].expires) out.classes[id].expires = nextBirthday(out.classes[id].got) + YEAR_DAYS * (EXPIRY_YEARS - 1) + 10;
    }
  }
  repaired.add(out);
  st.license = out;
  return out;
}
export function note(g, text) {
  const L = lic(g);
  L.history.push({ day: g.state.day, text });
  if (L.history.length > 40) L.history.splice(0, L.history.length - 40);
}
function newSerial(g, cls) {
  const st = g.state;
  const h = (st.day * 7919 + cls.length * 131 + ageOf(st) * 17 + (st.fame || 0)) % 1000000;
  const code = ({ futsu: '30', junchu: '31', nirin: '32', gentsuki: '34', futsu2: '35' })[cls] || '30';
  return `第 ${code}${String(h).padStart(6, '0')}${(h % 7) + 1} 号`;
}

// ======================================================================== holdings
export function expired(g, cls) {
  const c = lic(g).classes[cls];
  return !!c && g.state.day > c.expires;
}
// the card as a whole (one 免許証 for all classes; the shortest expiry)
export function cardExpiry(g) {
  const ids = Object.keys(lic(g).classes);
  if (!ids.length) return 0;
  return Math.min(...ids.map((id) => lic(g).classes[id].expires));
}
export function holds(g, cls) {
  const L = lic(g);
  const has1 = (id) => !!L.classes[id];
  let ok;
  switch (cls) {
    case 'futsu': case 'car': ok = has1('futsu') || has1('junchu') || has1('futsu2'); break;
    case 'gentsuki': ok = has1('gentsuki') || has1('nirin') || has1('futsu') || has1('junchu') || has1('futsu2'); break;
    case 'nirin': case 'moto': ok = has1('nirin'); break;
    case 'second': case 'futsu2': ok = has1('futsu2'); break;
    case 'junchu': ok = has1('junchu'); break;
    case undefined: case null: case 'any': ok = Object.keys(L.classes).length > 0; break;
    default: ok = has1(cls);
  }
  return ok && g.state.day <= cardExpiry(g);
}
export const hasLicense = (g, cls) => holds(g, cls);
export function heldDays(g, cls) {
  const c = lic(g).classes[cls] || lic(g).classes.futsu;
  return c ? g.state.day - c.got : 0;
}
// can the player MT-drive (an AT-limited 普通 cannot)
export function canMT(g) {
  const L = lic(g);
  return ['futsu', 'junchu', 'futsu2'].some((id) => L.classes[id] && L.classes[id].mt !== false);
}
export function colorOf(g) {
  const L = lic(g);
  const ids = Object.keys(L.classes);
  if (!ids.length) return 'blue';
  const first = Math.min(...ids.map((id) => L.classes[id].got));
  const renewals = Math.max(...ids.map((id) => L.classes[id].renewals));
  return renewals >= 1 && L.violations === 0 && g.state.day - first >= YEAR_DAYS * 5 ? 'gold' : 'blue';
}

// ======================================================================== eligibility
// Why the player cannot start the class now (null = can). { ok, why, special } style via eligible()
export function eligible(g, cls) {
  const C = CLASSES[cls];
  if (!C) return { ok: false, why: 'その免許はありません。' };
  const ym = ymNow(g);
  const age = ageOf(g.state);
  const L = lic(g);
  if (C.from && ym < C.from) return { ok: false, why: `${C.name}免許は${Math.floor(C.from / 100)}年${C.from % 100}月から。` };
  if (L.classes[cls]) return { ok: false, why: g.state.day <= L.classes[cls].expires ? 'もう持っている。' : '免許証の有効期限が切れている。免許センターで更新を。' };
  if (cls === 'futsu' && (L.classes.junchu || L.classes.futsu2)) return { ok: false, why: 'もっと上の免許を持っている。' };
  if (cls === 'gentsuki' && holds(g, 'gentsuki')) return { ok: false, why: '原付に乗れる免許をもう持っている。' };
  if (cls === 'futsu2') {
    if (!holds(g, 'futsu')) return { ok: false, why: '普通免許（など）を持っていないと受けられない。' };
    const days = heldDays(g, L.classes.futsu ? 'futsu' : L.classes.junchu ? 'junchu' : 'futsu2');
    const need3 = YEAR_DAYS * 3, need1 = YEAR_DAYS;
    if (ym >= 202205) {
      if (age < 19) return { ok: false, why: '普通第二種は19歳以上（特例教習を受ければ）。' };
      if (days < need1) return { ok: false, why: '普通免許を受けて1年以上たたないと受けられない。' };
      const special = age < 21 || days < need3;
      return { ok: true, special };
    }
    if (age < 21) return { ok: false, why: '普通第二種は21歳以上。' };
    if (days < need3) return { ok: false, why: '普通免許を受けて3年以上たたないと受けられない。' };
    return { ok: true, special: false };
  }
  if (age < minAgeOf(cls, ym)) return { ok: false, why: `${C.name}は${minAgeOf(cls, ym)}歳から。` };
  return { ok: true, special: false };
}
export function schoolFee(cls, kind, mt, site) {
  const t = SCHOOL_FEES[cls];
  if (!t) return 0;
  const base = (t[kind] || t.tsugaku)[mt ? 0 : 1];
  return base + (kind === 'gassyuku' && site && SITES[site] ? SITES[site].extra : 0);
}
// rent that has to be paid in advance for a stay of `days` game days from today (the weeks whose Monday falls inside)
export function prepaidRent(g, days) {
  const st = g.state;
  const rent = safe(() => g.housing().rent, 0) || 0;
  const from = weekOf(st.day), to = weekOf(st.day + days);
  const weeks = Math.max(0, to - Math.max(from, st.rent.paidWeek));
  return { weeks, amount: rent * weeks, week: to };
}

// ======================================================================== school progress
export function schoolOf(g) { return lic(g).school; }
export function planOf(g) {
  const s = schoolOf(g);
  if (!s) return null;
  const p = planFor(s.cls, s.mt, ymNow(g));
  // 普通第二種の受験資格特例教習 (2022-05〜: 19歳以上・免許1年以上で受けるときの追加教習)
  if (s.cls === 'futsu2' && s.special) p.s1.unshift({ id: 'g0', type: 'gaku', stage: 1, label: '受験資格特例教習', cats: ['second', 'kokoro'], minutes: 50 });
  return p;
}
export function allSteps(g) {
  const p = planOf(g);
  if (!p) return [];
  return [...p.s1, KEN.ken1, KEN.kari, ...p.s2, KEN.ken2];
}
const isDone = (s, id) => (id === 'ken1' || id === 'kari' || id === 'ken2' ? !!s[id] : !!s.done[id]);
export function todayCounts(s, day) {
  if (s.t.day !== day) s.t = { day, gi: 0, gaku: 0, ken: 0 };
  return s.t;
}
export function quota(s) {
  return s.kind === 'gassyuku' ? { gi: 2, gaku: 2, ken: 2 } : { gi: 1, gaku: 1, ken: 1 };
}
// 仮免許 expired? (only once granted and before the 卒業検定 passed)
export function kariExpired(g) {
  const s = schoolOf(g);
  return !!s && !!s.kari && !s.ken2 && g.state.day > s.kari + KARI_DAYS;
}
export function termExpired(g) {
  const s = schoolOf(g);
  return !!s && s.kind === 'tsugaku' && !s.gradDay && g.state.day > s.enrolled + TERM_DAYS + num(s.extended);
}
export function stageOf(g) {
  const s = schoolOf(g);
  if (!s) return 0;
  if (s.cert) return 3;
  if (s.kari) return 2;
  return 1;
}
// every step with its state: { step, state: 'done'|'open'|'locked'|'quota'|'wait', why }
export function stepList(g) {
  const s = schoolOf(g);
  if (!s) return [];
  const plan = planOf(g);
  const day = g.state.day;
  const cnt = todayCounts(s, day);
  const q = quota(s);
  const out = [];
  const gi1 = plan.s1.filter((x) => x.type === 'gi'), gi2 = plan.s2.filter((x) => x.type === 'gi');
  const s1done = plan.s1.every((x) => isDone(s, x.id));
  const s2done = plan.s2.every((x) => isDone(s, x.id));
  const nextGi = (list) => list.find((x) => !isDone(s, x.id));
  const hoshu = s.need.hoshu > 0 && s.ken1 === 0 ? 'ken1' : s.need.hoshu > 0 && s.ken2 === 0 && s.kari ? 'ken2' : null;
  const push = (step, state, why = '') => out.push({ step, state, why });
  for (const x of [...plan.s1, KEN.ken1, KEN.kari, ...plan.s2, KEN.ken2]) {
    if (isDone(s, x.id)) { push(x, 'done'); continue; }
    if (x.type === 'gaku' || x.type === 'gi') {
      if (x.stage === 2 && !s.kari) { push(x, 'locked', '仮免許をもらってから。'); continue; }
      if (x.stage === 2 && kariExpired(g)) { push(x, 'locked', '仮免許の有効期間が切れている。'); continue; }
      if (x.type === 'gi' && nextGi(x.stage === 1 ? gi1 : gi2) !== x) { push(x, 'locked', '前の技能教習を先に。'); continue; }
      if (x.type === 'gi' && hoshu) { push(x, 'locked', '検定の前に補習を受ける。'); continue; }
      if (cnt[x.type] >= q[x.type]) { push(x, 'quota', x.type === 'gi' ? '技能教習は今日の上限まで受けた。' : '学科教習は今日の上限まで受けた。'); continue; }
      push(x, 'open');
    } else if (x.id === 'ken1') {
      if (!s1done) { push(x, 'locked', '第1段階の教習を全部終えてから。'); continue; }
      if (s.need.hoshu > 0) { push(x, 'locked', '補習を受けてから。'); continue; }
      if (s.lastLesson >= day && s.kind !== 'gassyuku') { push(x, 'wait', '教習を受けた日には検定は受けられない（あしたの予約を）。'); continue; }
      if (s.lastLesson >= day && s.kind === 'gassyuku') { push(x, 'wait', '検定は教習の翌日に。'); continue; }
      if (cnt.ken >= q.ken) { push(x, 'quota', '検定は今日の上限まで受けた。'); continue; }
      push(x, 'open');
    } else if (x.id === 'kari') {
      if (!s.ken1) { push(x, 'locked', '修了検定に合格してから。'); continue; }
      if (cnt.ken >= q.ken) { push(x, 'quota', '検定は今日の上限まで受けた。'); continue; }
      push(x, 'open');
    } else if (x.id === 'ken2') {
      if (!s.kari) { push(x, 'locked', '仮免許をもらってから。'); continue; }
      if (kariExpired(g)) { push(x, 'locked', '仮免許の有効期間が切れている。'); continue; }
      if (!s2done) { push(x, 'locked', '第2段階の教習を全部終えてから。'); continue; }
      if (s.need.hoshu > 0) { push(x, 'locked', '補習を受けてから。'); continue; }
      if (s.lastLesson >= day) { push(x, 'wait', '検定は教習の翌日に。'); continue; }
      if (cnt.ken >= q.ken) { push(x, 'quota', '検定は今日の上限まで受けた。'); continue; }
      push(x, 'open');
    }
  }
  // 補習: an extra 技能教習 inserted before the retake
  if (s.need.hoshu > 0) {
    const stage = s.kari ? 2 : 1;
    const step = hoshuStep(g, stage);
    if (cnt.gi >= q.gi) push(step, 'quota', '技能教習は今日の上限まで受けた。');
    else push(step, 'open');
  }
  return out;
}
export function hoshuStep(g, stage) {
  const s = schoolOf(g);
  const moto = s && CLASSES[s.cls].vehicle === 'moto';
  return { id: 'hoshu', type: 'gi', stage, label: stage === 1 ? '補習（所内コース）' : '補習（路上）', hoshu: true, minutes: 50, drv: moto ? { stage: 'moto', course: stage === 1 ? 'slalom' : 'ouyou' } : stage === 1 ? { stage: 'crank', course: 'crank' } : { stage: 'road', course: 'city' } };
}
export function nextActions(g) {
  return stepList(g).filter((x) => x.state === 'open').map((x) => x.step);
}
export function progressText(g) {
  const s = schoolOf(g);
  if (!s) return '';
  const L = stepList(g);
  const plan = planOf(g);
  const doneN = L.filter((x) => x.state === 'done').length;
  const total = allSteps(g).length;
  let where;
  if (s.cert) where = '卒業（免許センターで学科試験を）';
  else if (s.kari) where = kariExpired(g) ? '仮免許の期限切れ' : '第2段階';
  else if (s.ken1) where = '仮免学科試験';
  else where = plan.s1.every((x) => s.done[x.id]) ? '修了検定' : '第1段階';
  return `${where}（${doneN}/${total}）`;
}

// ======================================================================== mutators
export function completeStep(g, step) {
  const s = schoolOf(g);
  if (!s || !step) return;
  const day = g.state.day;
  const cnt = todayCounts(s, day);
  if (step.id === 'hoshu') { s.need.hoshu = Math.max(0, s.need.hoshu - 1); cnt.gi++; s.lastLesson = day; return; }
  if (step.type === 'gaku') { s.done[step.id] = day; cnt.gaku++; s.lastLesson = day; }
  else if (step.type === 'gi') { s.done[step.id] = day; cnt.gi++; s.lastLesson = day; }
  else if (step.id === 'ken1') { s.ken1 = day; cnt.ken++; }
  else if (step.id === 'kari') { s.kari = day; cnt.ken++; }
  else if (step.id === 'ken2') { s.ken2 = day; cnt.ken++; }
}
export function failExam(g, id) {
  const s = schoolOf(g);
  if (!s) return;
  s.fails[id] = (s.fails[id] || 0) + 1;
  todayCounts(s, g.state.day).ken++;
  if (id === 'ken1' || id === 'ken2') s.need.hoshu = Math.min(3, s.need.hoshu + (s.fails[id] >= 2 ? 2 : 1));
  lic(g).stats.fails++;
}
// the school kicks in 卒業: a 卒業証明書 (valid CERT_DAYS)
export function graduate(g) {
  const s = schoolOf(g);
  if (!s) return;
  s.cert = g.state.day;
  s.gradDay = g.state.day;
  note(g, `${CLASSES[s.cls].name}の卒業検定に合格。卒業証明書をもらった。`);
}
export function certValid(g) {
  const s = schoolOf(g);
  return !!s && !!s.cert && g.state.day <= s.cert + CERT_DAYS;
}
export function centerClosed(g) {
  const wd = weekdayOf(g.state.day);
  return wd >= 5; // 土日: 学科試験・交付は休み
}

// ======================================================================== grant a license (the 交付)
export function grantLicense(g, cls, o = {}) {
  const L = lic(g);
  const st = g.state;
  const prev = L.classes[cls];
  const c = {
    got: prev ? prev.got : st.day, mt: o.mt == null ? (prev ? prev.mt : null) : !!o.mt, serial: prev ? prev.serial : newSerial(g, cls),
    via: o.via || 'school', school: o.school || (prev ? prev.school : ''), renewals: prev ? prev.renewals : 0,
    cond: Array.isArray(o.cond) ? o.cond : prev ? prev.cond : [], expires: 0, special: !!o.special,
  };
  c.expires = nextBirthday(st.day) + YEAR_DAYS * (EXPIRY_YEARS - 1) + 10;
  // a higher class covers the lower ones: the card keeps one entry per class, the lower ones it replaces stay (hasLicense counts both)
  L.classes[cls] = c;
  if (cls === 'futsu2') for (const k of ['futsu', 'junchu']) if (L.classes[k]) L.classes[k].expires = Math.max(L.classes[k].expires, c.expires);
  note(g, `${CLASSES[cls].name}免許を取得した。`);
  g.state.flags.licenseFirst = g.state.flags.licenseFirst || st.day;
  try { for (const fn of LICENSE_HOOKS.granted) fn(g, cls, c); } catch (e) { console.error(e); }
  return c;
}
export function renewLicense(g) {
  const L = lic(g);
  const st = g.state;
  for (const id of Object.keys(L.classes)) {
    const c = L.classes[id];
    c.renewals++;
    c.expires = nextBirthday(st.day) + YEAR_DAYS * 5 + 10;
  }
  L.violations = Math.max(0, L.violations);
  note(g, '免許証を更新した。');
}
export const LICENSE_HOOKS = { granted: [] };

// ======================================================================== the 免許証 summary
const CLASS_LINE = { futsu: '普通', junchu: '準中型', nirin: '普二', gentsuki: '原付', futsu2: '普通二種' };
export function licenseCard(g) {
  const L = lic(g);
  const ids = CLASS_ORDER.filter((id) => L.classes[id]);
  if (!ids.length) return null;
  const p = g.state.profile || {};
  const birth = birthOf(g);
  const first = Math.min(...ids.map((id) => L.classes[id].got));
  const kind2 = !!L.classes.futsu2;
  const names = ids.map((id) => CLASSES[id].cardName);
  const cond = [];
  for (const id of ids) {
    const c = L.classes[id];
    if ((id === 'futsu' || id === 'futsu2') && c.mt === false) cond.push('ＡＴ車に限る');
    for (const x of c.cond) if (!cond.includes(x)) cond.push(x);
  }
  const s = L.school;
  const expiry = cardExpiry(g);
  const main = L.classes[ids[ids.length - 1]];
  const color = colorOf(g);
  return {
    name: fullName(p) || g.state.name,
    birth: dateText(birth), birthDate: birth,
    address: `東京都ドット区ドット${1 + (g.state.day % 9)}丁目${1 + (ageOf(g.state) % 20)}番${1 + ((g.state.day * 3) % 9)}号`,
    issued: dayText(g, main.got), issuedDay: main.got, first: dayText(g, first),
    expires: dayText(g, expiry), expiresDay: expiry, expired: g.state.day > expiry,
    color, colorName: color === 'gold' ? 'ゴールド' : 'ブルー', classes: ids, classNames: names, kind: kind2 ? 2 : 1,
    conditions: cond, number: main.serial, school: main.school || '', via: main.via,
    commission: '東京都公安委員会', pending: !!s, year: dateOfDay(g, main.got).year,
    shoshin: g.state.day <= main.got + YEAR_DAYS, shoshinLeft: Math.max(0, main.got + YEAR_DAYS - g.state.day), // 初心運転者期間（1年）：若葉マーク
  };
}
export function licenseStatus(g) {
  const L = lic(g);
  const s = L.school;
  const held = CLASS_ORDER.filter((id) => L.classes[id]).map((id) => ({ id, name: CLASSES[id].name, got: L.classes[id].got, mt: L.classes[id].mt, expired: g.state.day > L.classes[id].expires }));
  const out = { held, color: colorOf(g), expired: held.some((h) => h.expired), school: null, text: '' };
  if (s) {
    out.school = { cls: s.cls, name: CLASSES[s.cls].name, mt: s.mt, kind: s.kind, stage: stageOf(g), progress: progressText(g), enrolled: s.enrolled, kari: s.kari, ken1: s.ken1, ken2: s.ken2, cert: s.cert, certValid: certValid(g), booking: s.booking, camp: s.camp };
    out.text = `教習中：${CLASSES[s.cls].name}（${s.kind === 'gassyuku' ? '合宿' : '通学'}）${progressText(g)}`;
  } else if (held.length) out.text = `${held.map((h) => h.name).join('・')}免許`;
  else out.text = 'まだ免許はない';
  return out;
}
// the きろく line of the てちょう
export function licenseLine(g) {
  const st = licenseStatus(g);
  if (st.school) return { text: `教習中（${st.school.name}${st.school.mt ? '' : '・AT'}）`, sub: st.school.progress, c: 'ing' };
  if (st.held.length) {
    const top = st.held.map((h) => h.name + (h.id === 'futsu' && h.mt === false ? '(AT限定)' : '')).join('・');
    return { text: `${top}免許`, sub: `${st.color === 'gold' ? 'ゴールド' : 'ブルー'}${st.expired ? '・期限切れ' : ''}`, c: st.expired ? 'bad' : 'ok' };
  }
  return null;
}

// ======================================================================== the 'driving' minigame (L2) and a fallback
// The driving course is the minigame 'driving' (js/minigames/driving.js). Until it exists a short quiz stands in
// (the flow stays testable). → { res, points, passed, deductions, fallback }
const FALLBACK_Q = [
  ['信号が黄色に変わった。停止線の手前で安全に止まれる。どうする？', ['止まる', 'アクセルを踏んで通過する'], 0],
  ['横断歩道で歩行者が渡ろうとしている。どうする？', ['手前で止まって道をゆずる', 'クラクションを鳴らして先に行く'], 0],
  ['右折する交差点。対向から直進車が来ている。どうする？', ['直進車を先に行かせる', '急いで曲がる'], 0],
  ['一時停止の標識がある。交通量は少ない。どうする？', ['停止線の前で完全に止まる', '徐行でそのまま通過する'], 0],
  ['路上に駐車車両。右に出て避けたい。どうする？', ['合図を出し、後方を確認して進路変更する', '合図なしですぐ右にハンドルを切る'], 0],
  ['カーブの手前。どうする？', ['手前で減速する', 'カーブの途中でブレーキをかける'], 0],
];
export async function runDriving(g, o = {}) {
  const era = eraId(g);
  const opts = {
    stage: o.stage || 'lesson1', course: o.course, era, practice: !!o.practice, difficulty: clamp(Math.round(o.difficulty || 1), 1, 5),
    mt: !!o.mt, exam: !!o.exam, strict: !!o.second, title: o.title, minutes: o.minutes ?? 50,
  };
  let res = null;
  let fallback = false;
  if (MINIGAMES.driving) {
    res = await g.minigame('driving', opts);
  } else {
    fallback = true;
    const qs = FALLBACK_Q.map((q) => ({ q: q[0], choices: q[1], answer: q[2] })).slice(0, 5);
    res = await g.minigame('quiz', { questions: qs, count: 5, shuffle: true, show: o.title || '路上の判断', genre: '技能', minutes: opts.minutes, difficulty: 1 + (o.exam ? 1 : 0), title: o.title });
  }
  res = res || { score: 50, rank: 'C', success: true };
  const d = res.driving || null;
  const points = Number.isFinite(d && d.points) ? d.points : num(res.score, 50);
  const line = o.passLine ?? 70;
  const passed = d && typeof d.passed === 'boolean' ? d.passed : points >= line;
  return { res, points, passed, deductions: (d && Array.isArray(d.deductions) ? d.deductions : []), fallback, driving: d };
}

// ======================================================================== 学科教習 helper (the 'quiz' minigame with ○×)
export function lessonQuestions(qs) { return qs.map(asQuizQuestion); }

// ======================================================================== part-time jobs that need a license
// registerLicenseJob(id, def, need): adds a job to the 求人 (phone_apps3_work.js BAITO) that is listed only while the player holds
// the license class `need` ('futsu' | 'second' | …). def is a BAITO entry (name, where, pay, hours, stamina, stress, hunger, clean, lines…).
export function registerLicenseJob(id, def, need = 'futsu') {
  import('./phone_apps3_work.js').then((m) => {
    const { BAITO, BAITO_IDS } = m;
    if (!BAITO || BAITO[id]) return;
    const entry = { ...def };
    Object.defineProperty(entry, 'from', {
      enumerable: true,
      get() { const g = typeof window !== 'undefined' ? window.__game : null; return g && g.state && holds(g, need) ? 0 : 999912; },
    });
    BAITO[id] = entry;
    if (Array.isArray(BAITO_IDS) && !BAITO_IDS.includes(id)) BAITO_IDS.push(id);
  }).catch((e) => console.error('[license] job', e));
}
registerLicenseJob('haisou', { name: '軽バンの配送ドライバー', where: '運送会社', pay: 3800, hours: 6, stamina: 28, stress: 9, hunger: -10, clean: -4, seed: 0.2, lines: ['伝票を見ながら、住宅街を走りまわった。再配達が一番こたえる。', '「ご苦労さま」と言われると、ちょっとうれしい。'] }, 'futsu');
registerLicenseJob('delivery_car', { name: 'フードデリバリー（車）', where: '車で街中', pay: 3200, hours: 4, stamina: 20, stress: 7, hunger: -8, clean: -3, from: 201609, variable: true, seed: 0.25, lines: ['雨の日は注文が多い。ワイパーを動かしながら走った。', '駐車できる場所を探すのがいちばん大変だった。'] }, 'futsu');
registerLicenseJob('taxi', { name: 'タクシー運転手（日勤）', where: 'タクシー会社', pay: 8200, hours: 8, stamina: 34, stress: 12, hunger: -12, clean: -4, variable: true, seed: 0.45, lines: ['駅前で、スーツ姿のお客さんを乗せた。「急いでるんだ」と言われた。', '無線が鳴るたびに、行き先がちがう。東京の道がだんだん頭に入ってきた。', 'お客さんに「運転うまいね」と言われて、ちょっとうれしい。'] }, 'second');

// ======================================================================== morning
// booking reminders, 期限 notices (messages, never forced scenes)
onMorning((g) => {
  try {
    const L = g.state.license;
    if (!L || !isObj(L)) return;
    const l = lic(g);
    const s = l.school;
    if (s && s.kind === 'tsugaku') {
      if (s.booking && s.booking.day === g.state.day) {
        const label = (allSteps(g).find((x) => x.id === s.booking.step) || { label: '教習' }).label;
        g.message({ from: SCHOOL_NAME, text: `今日は「${label}」の予約日です。${hmText(s.booking.min)}までに受付へお越しください。`, kind: 'news' });
      }
      if (s.kari && !s.ken2 && g.state.day === s.kari + KARI_DAYS - 10) g.message({ from: SCHOOL_NAME, text: '仮免許の有効期間があと1か月で切れます。卒業検定の予定を立ててください。', kind: 'news' });
      if (s.cert && g.state.day === s.cert + CERT_DAYS - 20) g.message({ from: SCHOOL_NAME, text: '卒業証明書の有効期間があと2か月です。免許センターで学科試験を受けてください。', kind: 'news' });
    }
    for (const id of Object.keys(l.classes)) {
      if (g.state.day === l.classes[id].expires - 10) { g.message({ from: CENTER_NAME, text: '運転免許証の有効期間があと1か月で終わります。免許センターで更新の手続きを。', kind: 'news' }); break; }
    }
  } catch (e) { console.error('[license] morning', e); }
});
export const hmText = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

// ======================================================================== the flow (license_flow.js fills it)
export const FLOW = {};
const flowCall = async (name, g, ...a) => {
  if (!FLOW[name]) { await g.say('（まだ準備中のようだ…）'); return { ok: false }; }
  return FLOW[name](g, ...a);
};

// ======================================================================== g.* API
const METHODS = {
  license() { return lic(this); },
  hasLicense(cls) { return holds(this, cls); },
  licenseCard() { return licenseCard(this); },
  licenseStatus() { return licenseStatus(this); },
  licenseLine() { return licenseLine(this); },
  licenseViolation(n = 1) { lic(this).violations += Math.max(1, Math.floor(n)); return lic(this).violations; },
  licenseEligible(cls) { return eligible(this, cls); },
  licenseSteps() { return stepList(this); },
  licenseDays() { return { camp: CAMP_DAYS, kari: KARI_DAYS, cert: CERT_DAYS, term: TERM_DAYS }; },
  enrollSchool(opts = {}) { return flowCall('enroll', this, opts); },
  licenseDesk(opts = {}) { return flowCall('desk', this, opts); },
  licenseCenter(opts = {}) { return flowCall('center', this, opts); },
  // test helpers (also usable by other modules): grant a license without the school (e.g. a wealthy NPC story, a test)
  licenseGrant(cls, o = {}) { if (!CLASSES[cls]) return null; return grantLicense(this, cls, { via: 'center', ...o }); },
  licenseRevoke(cls) { const L = lic(this); if (cls) delete L.classes[cls]; else L.classes = {}; return true; },
};
for (const k of Object.keys(METHODS)) if (!Object.getOwnPropertyDescriptor(Game.prototype, k)) Object.defineProperty(Game.prototype, k, { value: METHODS[k], writable: true, configurable: true });

export { has, safe, num, isObj, PEOPLE, registerPhoneApp, fmtMoney };
