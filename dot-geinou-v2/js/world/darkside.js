// 闇の要素（ダークサイド）: random and story events that bring the dark side of Japanese society into
// every career — 事故・事件・週刊誌のスクープ・裏金と汚職・反社・脅迫とテロへの対応・借金と破産.
//
// ---------------------------------------------------------------- rules (non-negotiable)
// - Serious tone, fictional people / companies / groups only. No real incidents, parties accused, or
//   politicians. Real parties (自民・民主) are never shown as doing wrong: party-driven temptations
//   (パーティー券のキックバック) only come from fictional parties; companies offering bribes are fictional.
// - Crimes are abstract choices routed through the justice core (g.commitCrime / g.coverUp /
//   g.investigate …); no real-world method detail. Every event offers a responsible choice, put first
//   (it is also the B-button / g.auto default).
// - テロ・暗殺 are NEVER player actions: only threats and a foiled attempt by a fictional lone individual
//   (no ideology, no method), injury → hospital, public sympathy, tighter security; and, as PM / a
//   minister, a crisis to manage (警戒・交通・情報 with trade-offs). No casualties are ever shown.
// - 暴力団・反社 are dangerous and predatory (闇営業 offers, 恐喝, 闇バイト recruitment); ties end careers.
//
// ---------------------------------------------------------------- how events start
// - onMorning → decide(): at most one dark event every few days. The gap (3..9 days) and the daily
//   chance (6..40%) follow the player's risk (riskOf: 闇金, 延滞, 前科・heat, ネオン街, 反社, 裏金, fame,
//   office). Story follow-ups come first. Plain misfortune (events marked luck: an accident, a fraud
//   call, a stalker, a threat) keeps the rate of the player's position (posRisk: fame, a seat), so a
//   risky life brings more of its own consequences, not more car accidents; accidents are at least
//   30 days apart (ACC_GAP). The chosen event waits in flags.darkside.pending for a free
//   moment: 'any' when a script ends (usually right after waking), 'home' at home after a script,
//   'town' after some steps in a town (onWalkStep), 'home_return' when coming home, { places } inside
//   those places. Unfired events of yesterday are dropped (follow-ups are retried).
// - Moments: after a job in a venue (収録・舞台の事故) and after a 街頭演説 / 地元回り / 視察 (g.campaign /
//   g.activity of the politics core: a foiled attack, rare).
// - Hooks: onJustice('harassment' | 'loan_missed' | 'arrested'), onPolitics('elected' | 'scandal' | 'resign')
//   (a serious 裏金・収賄 scandal may bring a 家宅捜索: pol_tokuso → g.investigate);
//   the morning check assigns / removes SP for ministers.
// - Passive follow-ups (news only: an arrest, a court ruling) arrive in the morning without a slot.
//
// ---------------------------------------------------------------- API (export DARK; window.__dark)
//   DARK.EVENTS, DARK.state(g), DARK.ctx(g), DARK.risk(g), DARK.decide(g, { force, only }),
//   DARK.run(g, id, { data }) (async: call inside g.run), DARK.flush(g) (run the pending event now,
//   anywhere), DARK.schedule(g, id, inDays, data), DARK.rng (replaceable), DARK.gap(risk), DARK.chance(risk)
// State: g.state.flags.darkside = { v, last, pending, follow[], log[], counts, lastId, seen{place: day},
//   story{}, guard, sp, threat, famWarned, hospUntil, townSteps, awayDay, jobs, speech, risk }
//
// Facts used (checked 2026-10, WebSearch):
//   ストーカー規制法 2000年11月24日施行（2016年改正の施行日は下の行）
//     （npa.go.jp stalker/kaisei, gender.go.jp bo86-1.pdf）
//   芸能従事者の労災保険特別加入 2021年4月1日から（mhlw.go.jp kanyu_r3.4.1）
//   東京都の自転車保険の加入義務 2020年4月1日（条例改正。兵庫県が2015年に全国初）（kuruma-news.jp 239640）
//   自転車は道路交通法上の「車両」（軽車両）。人身事故の救護・報告義務は72条（city.osaka.lg.jp, young-machine.com）
//   多重債務問題改善プログラム 2007年4月（多重債務者対策本部）→ 2008年までに全都道府県・約9割の市区町村に
//     相談窓口（fsa.go.jp kashikin/program）; 警察相談専用電話 #9110（npa.go.jp 白書 h21）
//   刑事訴訟法150条（証人の不出頭: 10万円以下の過料）・151条（1年以下の拘禁刑又は30万円以下の罰金）
//     （ja.wikibooks 刑事訴訟法第151条）; 証人には旅費・日当が支給される
//   自賠責保険 傷害の限度額 120万円、慰謝料 1日4,300円（2020年4月以降の事故）（mlit.go.jp jibaiseki）
//   オレオレ詐欺（2003年に社会問題化）→ 2004年12月に警察庁が「振り込め詐欺」と統一→ 2011年ごろから総称の「特殊詐欺」
//     （警察庁 白書 h26 qf130000; ja.wikid.org 特殊詐欺）。報道で広く使われるのは2013年ごろからとした
//   政治家個人（資金管理団体）への企業・団体献金は2000年1月から禁止（政党・政党支部へは可）（imidas C-103-0010）
//   貸金業法21条: 正当な理由なく午後9時〜午前8時の取立て・勤務先への電話や訪問は禁止（fsa.go.jp yami_leaf）
//   SP（警視庁警備部警護課）の警護対象: 内閣総理大臣・国務大臣・衆参両院議長・政党要人など（agora-web.jp 16128）
//   証人の宣誓書: 刑訴規則118条「良心に従つて、真実を述べ何事も隠さず、又何事も附け加えないことを誓う」旨
//   ストーカー規制法の2016年改正: SNSの連続送信など2017年1月施行、警告を経ない禁止命令は2017年6月14日施行
//     （法務省 犯罪白書 令和6年版 4-6-3-1、警察庁 白書 h29 tt200000）
//   内閣危機管理監は1998年4月1日に新設（それまでは内閣安全保障室）。新官邸の危機管理センターは2002年4月から
//     （内閣府 cstp siryo4-2、防災白書 h14）

import { Game } from '../engine/game.js';
import { SW, SH, clamp, fmtMoney } from '../engine/util.js';
import { text, measure, panel, COLORS } from '../engine/draw.js';
import { PLACES } from '../engine/map.js';
import { onMorning, PEOPLE, REGULARS, weekdayOf, weekOf } from '../engine/life.js';
import { ageOf } from '../engine/profile.js';
import { charSheetHD, LOOKS } from '../engine/sprites.js';
import { AGENCIES } from '../engine/state.js';
import { CRIMES, onJustice, lawDate, wareki, StageScene, legalYen } from '../engine/crime.js';
import { POSTS, OFFICES, onPolitics } from '../engine/politics.js';
import { ensureFamily, FAMILY, sendPackage } from './family.js';

// ======================================================================== basics
let RNG = Math.random;
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pickOne = (a) => a[Math.floor(rnd() * a.length)];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const round1000 = (n) => Math.max(0, Math.round(num(n) / 1000) * 1000);

const GRACE = 6; // no dark events in the first days of a new life
const NIGHT = ['kyabakura', 'yamikin', 'kumi', 'gamecen', 'kanraku'];
const NO_EVENT_PLACES = new Set(['keisatsu', 'kensatsu', 'saibansho', 'keimusho']);
const HOSPITAL = 'ドット中央病院';
const MAG = '週刊ドット';
const LOG_MAX = 120;

// ======================================================================== state
function blank() {
  return { v: 1, last: 0, pending: null, follow: [], log: [], counts: {}, lastId: {}, seen: {}, story: {}, guard: 0, sp: 0, threat: null, famWarned: 0, hospUntil: 0, townSteps: 0, awayDay: 0, jobs: -1, speech: 0, risk: 0 };
}
function D(g) {
  const st = g.state;
  const fl = st.flags || (st.flags = {});
  let d = fl.darkside;
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = fl.darkside = blank();
  if (!d._ok) {
    const b = blank();
    for (const k of Object.keys(b)) if (d[k] === undefined) d[k] = b[k];
    for (const k of ['follow', 'log']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['counts', 'lastId', 'seen', 'story']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
    d.follow = d.follow.filter((f) => f && typeof f === 'object' && EV[f.id]);
    if (d.pending && (typeof d.pending !== 'object' || !EV[d.pending.id])) d.pending = null;
    for (const k of ['last', 'guard', 'sp', 'famWarned', 'hospUntil', 'townSteps', 'awayDay', 'speech']) d[k] = num(d[k]);
    Object.defineProperty(d, '_ok', { value: true, enumerable: false, configurable: true });
  }
  return d;
}
const seenWithin = (d, ids, day, days) => ids.some((id) => d.seen[id] && day - d.seen[id] <= days);
function free(g) {
  try { return typeof g.isFree === 'function' ? g.isFree() : true; } catch (e) { return true; }
}
function polOf(g) {
  try { if (typeof g.pol === 'function') return g.pol(); } catch (e) { console.error(e); }
  return null;
}
function homePlace(g) {
  try { const h = g.housing(); return (h && h.place) || 'home'; } catch (e) { return 'home'; }
}
function family(g) {
  try { return ensureFamily(g) || []; } catch (e) { console.error(e); return []; }
}
const famPick = (list, roles) => { for (const r of roles) { const m = list.find((M) => M && M.role === r); if (m) return m; } return null; };

// What the events need to know about the player right now.
function ctxOf(g) {
  const st = g.state, d = D(g), day = st.day;
  const p = polOf(g);
  const me = (p && p.me) || null;
  const office = (me && me.office) || null;
  const O = office && OFFICES[office];
  const posts = me && Array.isArray(me.posts) ? me.posts : [];
  const cabinet = posts.filter((x) => POSTS[x] && POSTS[x].kind === 'cabinet' && x !== 'pm');
  const pm = !!(p && p.cabinet && p.cabinet.pm === 'player' && office);
  const party = me && me.party && p.parties ? p.parties[me.party] : null;
  let j = null;
  try { j = typeof g.jus === 'function' ? g.jus() : null; } catch (e) { j = null; }
  const loans = j && Array.isArray(j.loans) ? j.loans.filter((l) => l && l.status !== 'void' && l.status !== 'paid') : [];
  const fam = family(g);
  const ld = lawDate(g);
  return {
    g, st, d, day, p, me, office, level: (O && O.level) || null, national: office === 'shugi' || office === 'sangi',
    posts, cabinet, pm, minister: pm || cabinet.length > 0, party, realParty: !!(party && party.real),
    j, loans, yami: loans.filter((l) => l.lender === 'yamikin'), late: loans.filter((l) => l.lender !== 'yamikin' && num(l.missed) > 0),
    heat: (j && j.heat) || {}, fam, elder: famPick(fam, ['parent', 'grand']), anyFam: famPick(fam, ['parent', 'grand', 'older', 'younger']),
    year: ld.year, month: ld.month, era: (st.profile && st.profile.era) || 'reiwa', fame: num(st.fame), age: ageOf(st),
    home: homePlace(g), secret: num(me && me.secret), agency: st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency] : null,
    guarded: num(d.guard) > day || (!!office && (pm || cabinet.length > 0)),
  };
}
// The part of the risk that comes with the player's position (fame, a seat, a cabinet post), not
// with their choices.
function posRisk(c) {
  return (c.fame >= 4000 ? 1 : c.fame >= 1000 ? 0.5 : 0) + (c.office ? 0.5 : 0) + (c.minister ? 1 : 0) + (c.pm ? 0.5 : 0);
}
// 0 (a quiet, clean life) .. about 12 (debts to 闇金, 反社 ties, 裏金, a famous minister).
function riskOf(g, c = ctxOf(g)) {
  const d = c.d, day = c.day;
  // an old deal weighs on the risk while its case is open or for about a year (120 days)
  const recent = (v) => Number.isFinite(v) && day - v <= 120;
  let r = 0;
  if (c.yami.length) r += 3;
  if (c.late.length) r += 1.5;
  if (c.st.rent && num(c.st.rent.debt) > 0) r += 0.5;
  try { if (typeof g.hasRecord === 'function' && g.hasRecord()) r += 1; } catch (e) { /* ignore */ }
  r += Math.min(2, Object.keys(c.heat || {}).length * 0.5);
  if (seenWithin(d, NIGHT, day, 10)) r += 1.5;
  if (seenWithin(d, ['kumi'], day, 30)) r += 1;
  if (d.story.hanshaDeal && (recent(d.story.hanshaDeal) || c.heat.antisocial_ties)) r += 2;
  if (c.secret > 0) r += 1 + clamp(Math.log10(c.secret / 1e6 + 1) * 1.5, 0, 2);
  if (d.story.bribe && (recent(d.story.bribe) || c.heat.bribery_take || c.heat.assen)) r += 2;
  if (c.j && num(c.j.smoker) > 50) r += 0.5;
  r += posRisk(c);
  return Math.round(r * 10) / 10;
}
const minGap = (r) => clamp(Math.round(9 - r * 0.8), 3, 9);
const dayChance = (r) => clamp(0.06 + r * 0.035, 0.06, 0.4);
// Accidents (on the street, at work) never come in a cluster.
const ACC_GAP = 30;
const accidentRecent = (d, day) => Object.keys(d.lastId).some((id) => EV[id] && EV[id].cat === 'accident' && day - num(d.lastId[id]) < ACC_GAP);

// ======================================================================== speakers
const LK = {
  police: { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' },
  keiji: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#4a4a52', bottom: '#3a3a40', jacket: true, tie: '#7a2f2f' },
  medic: { hair: 'cap', hat: '#e8e8ec', hairColor: 'black', skin: 'tan', top: '#8a96a8', bottom: '#5a6478' },
  doctor: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#f4f4f4', bottom: '#5a6478', jacket: true, glasses: true },
  nurse: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8f0fa', bottom: '#e8f0fa' },
  hoken: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3b4458', bottom: '#3b4458', jacket: true, tie: '#5a7ab8' },
  kisha: { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' },
  broker: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#2a2a30', bottom: '#2a2a30', jacket: true, tie: '#9a7a2a' },
  boss: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#1e1e22', bottom: '#1e1e22', jacket: true, tie: '#5a1a2a' },
  guest: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#3a2a4a', bottom: '#2a2030', jacket: true, tie: '#c8a24a' },
  sp: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#1e2230', bottom: '#1e2230', jacket: true, tie: '#2a2e3a' },
  secretary: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#2a3560', bottom: '#2a3560', jacket: true, skirt: true, glasses: true },
  shacho: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a3a40', bottom: '#3a3a40', jacket: true, tie: '#c8a24a' },
  kanbu: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, tie: '#7a2f2f', glasses: true },
  kanshi: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#2a3040', bottom: '#2a3040', jacket: true, tie: '#7a1a20' },
  op: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8e8ec', bottom: '#2a3040' },
  chinpira: { hair: 'spiky', hairColor: 'blonde', skin: 'tan', top: '#7a2a8a', bottom: '#1e1e26', glasses: 'sun' },
  chinpira2: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#c8c8c8', bottom: '#1e1e26' },
  yankee: { hair: 'spiky', hairColor: 'orange', skin: 'tan', top: '#b82a2a', bottom: '#2a2a30' },
  lawyer: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227' },
  collector: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#4a5060', bottom: '#4a5060', jacket: true, tie: '#3a4a6a', glasses: true },
  shadow: { hair: 'cap', hat: '#1a1a20', hairColor: 'black', skin: 'fair', top: '#24242c', bottom: '#1a1a20', shoes: '#1a1a20' },
  thief: { hair: 'cap', hat: '#2a2a2a', hairColor: 'black', skin: 'tan', top: '#3a3a3a', bottom: '#2a2a2a' },
  rusher: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#4a4a48', bottom: '#2e2e2c' },
  judge: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#151518', bottom: '#151518', jacket: true, glasses: true },
};
const WHO = {
  driver: { name: '運転していた男性', look: LOOKS.salaryman },
  police: { name: '警察官', look: LK.police },
  keiji: { name: '刑事', look: LK.keiji },
  medic: { name: '救急隊員', look: LK.medic },
  doctor: { name: '医師', look: LK.doctor },
  nurse: { name: '看護師', look: LK.nurse },
  hoken: { name: 'ドット損保の担当者', look: LK.hoken },
  victimB: { name: '歩いていた女性', look: LOOKS.oldwoman },
  victimFam: { name: '女性の息子', look: LOOKS.salaryman },
  director: { name: 'ディレクター', look: LOOKS.director },
  producer: { name: 'プロデューサー', look: LOOKS.manager },
  kisha: { name: `${MAG}の記者`, look: LK.kisha },
  broker: { name: '仲介者の久住', look: LK.broker },
  boss: { name: '主催者の「会長」', look: LK.boss },
  sp: { name: 'SP（警護官）', look: LK.sp },
  secretary: { name: '秘書の森下', look: LK.secretary },
  shacho: { name: 'くろがね建設の社長', look: LK.shacho },
  aoba: { name: 'あおば土木の会長', look: LK.shacho },
  koenkai: { name: '後援会の有力者', look: LOOKS.oldman },
  kanbu: { name: '派閥の事務総長', look: LK.kanbu },
  kanshi: { name: '危機管理監', look: LK.kanshi },
  chinpira: { name: 'ガラの悪い男', look: LK.chinpira },
  yankee: { name: 'ゲーセンの先輩', look: LK.yankee },
  lawyer: { name: '弁護士', look: LK.lawyer },
  collector: { name: '債権回収の担当者', look: LK.collector },
  judge: { name: '裁判長', look: LK.judge },
  kenji: { name: '検察官', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2a2c38', bottom: '#2a2c38', jacket: true, tie: '#5a5f6b', glasses: true } },
  bengo: { name: '弁護人', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#3a4a7a', bottom: '#2a3560', jacket: true, skirt: true } },
};
function managerOf(c) {
  if (c.office) return WHO.secretary;
  if (c.agency) return { name: `${c.agency.name}のマネージャー`, look: LOOKS.manager };
  return { name: '知り合いの芸能記者', look: LK.kisha };
}

// ======================================================================== scenes (native HD backdrops)
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.fill(); };
const ring = (c, x, y, r, col, w = 3) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.stroke(); };
function fig(c, look, x, y, dir = 'down', s = 2, frame = 0) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites optional */ }
}
const playerLook = (g) => (g.state && g.state.look) || LOOKS.player;
const pajama = (g) => ({ ...playerLook(g), top: '#9ec8e8', bottom: '#9ec8e8', jacket: false, tie: undefined, skirt: false, hat: undefined });
const FLOOR_Y = 168;
function wallFloor(c, wall, wallLo, floor, floorLine) {
  R(c, 0, 0, SW, FLOOR_Y, wall);
  R(c, 0, FLOOR_Y - 34, SW, 34, wallLo);
  R(c, 0, FLOOR_Y - 35, SW, 1, '#00000040');
  R(c, 0, FLOOR_Y, SW, SH - FLOOR_Y, floor);
  for (let y = FLOOR_Y + 14; y < SH; y += 18) R(c, 0, y, SW, 1, floorLine);
  for (let x = 0; x < SW; x += 64) R(c, x + ((x / 64) % 2 ? 32 : 0), FLOOR_Y, 1, SH - FLOOR_Y, floorLine);
}
function windowBox(c, x, y, w, h, sky = '#9ccbe8') {
  R(c, x - 3, y - 3, w + 6, h + 6, '#3a3e48');
  R(c, x, y, w, h, sky);
  R(c, x, y + h * 0.6, w, h * 0.4, '#b8dcef');
  R(c, x + w / 2 - 1, y, 2, h, '#3a3e48');
  R(c, x, y + h / 2 - 1, w, 2, '#3a3e48');
}
function bands(c, y0, y1, top, bottom) {
  const a = hex(top), b = hex(bottom);
  for (let y = y0; y < y1; y += 4) {
    const k = (y - y0) / Math.max(1, y1 - y0);
    R(c, 0, y, SW, 4, `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`);
  }
}
function hex(h) { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
function cityRow(c, y, h, night) {
  const cols = night ? ['#22243a', '#2a2a40', '#1e2032'] : ['#b8b4ac', '#a8b0b8', '#c8bca8'];
  for (let i = 0; i < 7; i++) {
    const x = i * 96 - 10, top = y + (i % 3) * 12, bh = h - (i % 3) * 12;
    R(c, x, top, 88, bh, cols[i % 3]);
    for (let wy = top + 8; wy < y + h - 10; wy += 14) for (let wx = x + 8; wx < x + 80; wx += 16) R(c, wx, wy, 8, 7, night ? ((wx + wy) % 3 ? '#e8c860' : '#3a3a50') : '#8aa8c4');
  }
}
function car(c, x, y, col) {
  R(c, x + 6, y + 52, 132, 6, '#00000050');
  R(c, x, y + 22, 140, 28, col);
  R(c, x, y + 22, 140, 3, '#ffffff60');
  R(c, x + 30, y + 4, 72, 20, col);
  R(c, x + 36, y + 8, 28, 14, '#9cc8e8');
  R(c, x + 68, y + 8, 28, 14, '#9cc8e8');
  R(c, x + 132, y + 28, 8, 7, '#ffe08a');
  R(c, x, y + 30, 6, 6, '#d62f2f');
  for (const wx of [x + 30, x + 110]) { disc(c, wx, y + 50, 11, '#1e1e22'); disc(c, wx, y + 50, 4, '#9a9aa2'); }
}
function bicycle(c, x, y, fallen) {
  if (fallen) { ring(c, x, y + 22, 13, '#2a2a30', 3); ring(c, x + 46, y + 26, 13, '#2a2a30', 3); R(c, x, y + 20, 48, 3, '#c83a3a'); R(c, x + 18, y + 10, 3, 14, '#c83a3a'); return; }
  ring(c, x, y + 26, 14, '#2a2a30', 3); ring(c, x + 50, y + 26, 14, '#2a2a30', 3);
  R(c, x, y + 16, 50, 3, '#c83a3a'); R(c, x + 22, y + 4, 3, 22, '#c83a3a'); R(c, x + 16, y + 2, 14, 4, '#2a2a30');
}
function crowd(c, x0, x1, y, n, seed = 1, dir = 'up') {
  const looks = [LOOKS.salaryman, LOOKS.oldman, LOOKS.oldwoman, LOOKS.mom, LOOKS.clerk, LOOKS.fan, LOOKS.kid, LOOKS.tourist];
  for (let i = 0; i < n; i++) fig(c, looks[(i * 3 + seed) % looks.length], x0 + ((x1 - x0) * i) / Math.max(1, n - 1), y + ((i * 7 + seed) % 3) * 6, dir);
}
function neon(c, x, y, w, h, col, t, k = 0) {
  const on = ((t >> 4) + k) % 7 !== 0;
  R(c, x - 2, y - 2, w + 4, h + 4, '#0a0a12');
  R(c, x, y, w, h, on ? col : '#3a3a48');
  if (on) { c.globalAlpha = 0.25; R(c, x - 6, y - 6, w + 12, h + 12, col); c.globalAlpha = 1; }
}
function paperBag(c, x, y) { R(c, x, y, 34, 28, '#c8a46a'); R(c, x, y, 34, 4, '#a8844a'); R(c, x + 8, y - 8, 3, 9, '#8a6a3a'); R(c, x + 23, y - 8, 3, 9, '#8a6a3a'); R(c, x + 8, y - 9, 18, 3, '#8a6a3a'); }

const SCN = {
  crossing(c, t, g, o) {
    bands(c, 0, 110, '#8cbce8', '#d8ecf8');
    cityRow(c, 26, 86, false);
    R(c, 0, 110, SW, 26, '#a8a49a');
    R(c, 0, 136, SW, 118, '#55565e');
    for (let x = 180; x < 460; x += 30) R(c, x, 140, 18, 110, '#e4e4de');
    R(c, 0, 254, SW, SH - 254, '#a8a49a');
    R(c, 580, 40, 6, 100, '#5a5e66'); R(c, 566, 40, 34, 14, '#2a2e36'); disc(c, 574, 47, 4, '#3a3a3a'); disc(c, 590, 47, 4, (t >> 5) % 2 ? '#3aff6a' : '#2a7a3a');
    car(c, 380, 150, o.carColor || '#c8ccd2');
    fig(c, playerLook(g), 248, 168, 'down');
    if (t < 60 && !o.police) for (let i = 0; i < 4; i++) disc(c, 280 + Math.cos(t / 6 + i * 1.6) * 30, 168 + Math.sin(t / 6 + i * 1.6) * 10, 3, '#ffe08a');
    fig(c, LOOKS.salaryman, 330, 152, 'left');
    if (o.police) { fig(c, LK.police, 120, 150, 'right'); fig(c, LK.medic, 176, 160, 'right'); }
  },
  sidewalk(c, t, g, o) {
    bands(c, 0, 120, '#9cc8ec', '#e0f0fa');
    cityRow(c, 30, 92, false);
    R(c, 0, 120, SW, 140, '#bcb8ae');
    for (let x = 0; x < SW; x += 40) R(c, x, 120, 1, 140, '#a8a49a');
    for (let y = 140; y < 260; y += 40) R(c, 0, y, SW, 1, '#a8a49a');
    R(c, 0, 250, SW, SH - 250, '#55565e');
    bicycle(c, 360, 180, true);
    fig(c, LOOKS.oldwoman, 220, 168, 'right');
    fig(c, playerLook(g), 300, 156, 'left');
    if (o.police) { fig(c, LK.police, 460, 150, 'left'); fig(c, LK.medic, 140, 156, 'right'); }
  },
  stage(c, t, g, o) {
    if (o.tv) {
      R(c, 0, 0, SW, SH, '#1a1c26');
      for (let i = 0; i < 6; i++) { R(c, 40 + i * 100, 10, 30, 14, '#3a3c48'); c.globalAlpha = 0.12; R(c, 30 + i * 100, 24, 50, 150, '#fff6c8'); c.globalAlpha = 1; }
      R(c, 60, 50, 520, 130, '#3a5a8a'); R(c, 60, 50, 520, 6, '#5a7ab8');
      R(c, 0, 180, SW, SH - 180, '#2a2c36');
    } else {
      R(c, 0, 0, SW, SH, '#2a1214');
      R(c, 0, 0, 90, 200, '#8a1a24'); R(c, SW - 90, 0, 90, 200, '#8a1a24');
      for (let x = 0; x < 90; x += 12) { R(c, x, 0, 2, 200, '#6a1018'); R(c, SW - 90 + x, 0, 2, 200, '#6a1018'); }
      R(c, 0, 0, SW, 22, '#6a1018');
      R(c, 0, 180, SW, SH - 180, '#7a5230');
      for (let x = 0; x < SW; x += 48) R(c, x, 180, 1, SH - 180, '#5a3a20');
    }
    c.save(); c.translate(380, 150); c.rotate(-0.35); R(c, -60, -20, 120, 40, '#8a8e96'); R(c, -60, -20, 120, 4, '#aab0ba'); c.restore();
    fig(c, playerLook(g), 270, 112, 'down');
    fig(c, LOOKS.staff, 140, 120, 'right');
    fig(c, LOOKS.director, 470, 120, 'left');
  },
  hospital(c, t, g, o) {
    wallFloor(c, '#eef2f2', '#d6dee0', '#cfd3cc', '#bfc3bc');
    windowBox(c, 440, 30, 140, 84, '#a8d4f0');
    R(c, 430, 26, 20, 96, '#e8e0f0'); R(c, 570, 26, 20, 96, '#e8e0f0');
    R(c, 128, 96, 14, 116, '#9aa4ac'); R(c, 330, 140, 10, 72, '#9aa4ac');
    R(c, 140, 150, 196, 56, '#f4f6f8'); R(c, 140, 150, 196, 6, '#ffffff');
    fig(c, pajama(g), 190, 86, 'down');
    R(c, 150, 158, 180, 46, '#a8c8e8'); R(c, 150, 158, 180, 4, '#c8e0f4');
    R(c, 372, 54, 3, 156, '#9aa0a8'); R(c, 364, 54, 20, 30, '#dceef8'); R(c, 373, 84, 1, 70, '#c8d8e8');
    R(c, 40, 120, 60, 80, '#d8d0c0'); R(c, 40, 120, 60, 6, '#e8e2d4');
    if (o.visitor) fig(c, o.visitor, 420, 126, 'left'); else fig(c, LK.nurse, 420, 126, 'left');
  },
  phone(c, t, g, o) {
    R(c, 0, 0, SW / 2, SH, '#e8dcc8'); R(c, 0, FLOOR_Y, SW / 2, SH - FLOOR_Y, '#a88a64');
    R(c, SW / 2, 0, SW / 2, SH, o.rightBg || '#d8cca0'); R(c, SW / 2, FLOOR_Y, SW / 2, SH - FLOOR_Y, o.rightFloor || '#c8b878');
    for (let x = SW / 2; x < SW; x += 40) R(c, x, FLOOR_Y, 1, SH - FLOOR_Y, '#a89858');
    R(c, SW / 2 - 2, 0, 4, SH, '#1a1f38');
    fig(c, playerLook(g), 120, 110, 'right');
    R(c, 166, 132, 8, 14, '#2a2a30');
    if (o.who) { fig(c, o.who, 440, 110, 'left'); R(c, 446, 132, 8, 14, '#2a2a30'); }
    const pulse = (t >> 3) % 2;
    for (let i = 0; i < 3; i++) { R(c, 200 + i * 14, 120 - i * 6, 3, 10 + i * 12, pulse ? '#ffd23f' : '#c8a83a'); R(c, 420 - i * 14, 120 - i * 6, 3, 10 + i * 12, pulse ? '#ffd23f' : '#c8a83a'); }
    if (o.leftLabel) text(c, o.leftLabel, SW / 4, 214, { size: 12, align: 'center', color: '#3a2a1a', shadow: null });
    if (o.rightLabel) text(c, o.rightLabel, (SW * 3) / 4, 214, { size: 12, align: 'center', color: '#3a2a1a', shadow: null });
  },
  room(c, t, g, o) {
    wallFloor(c, '#e8dcc8', '#d4c4a8', '#a88a64', '#967654');
    R(c, 40, 50, 70, 118, '#7a5a3a'); R(c, 44, 54, 62, 110, '#8a6a44'); R(c, 92, 104, 8, 8, '#4a4a4a'); R(c, 96, 100, 10, 4, '#d8c060');
    R(c, 420, 70, 150, 98, '#8a6a44');
    for (let i = 0; i < 3; i++) { R(c, 430, 80 + i * 30, 130, 22, '#6a4a2a'); R(c, 436 + i * 10, 96 + i * 30, 120, 18, '#9a7a54'); }
    for (let i = 0; i < 16; i++) R(c, 130 + ((i * 53) % 380), 180 + ((i * 29) % 70), 18, 12, i % 3 ? '#f4f2ea' : '#d8e0e8');
    R(c, 300, 196, 50, 10, '#6a4a2a'); R(c, 330, 170, 10, 30, '#6a4a2a');
    fig(c, playerLook(g), 230, 96, 'down');
    if (o.police) { fig(c, LK.police, 360, 100, 'left'); fig(c, LK.keiji, 120, 104, 'right'); }
  },
  doorway(c, t, g, o) {
    bands(c, 0, 150, '#0e1024', '#24284a');
    R(c, 20, 40, 260, 130, '#5a5a66');
    for (let y = 52; y < 160; y += 26) for (let x = 36; x < 270; x += 40) R(c, x, y, 22, 14, (x + y) % 3 ? '#e8c860' : '#2a2a3a');
    R(c, 120, 120, 40, 50, '#3a3a44');
    R(c, 0, 170, SW, SH - 170, '#3a3a42');
    R(c, 470, 40, 5, 140, '#4a4a52'); R(c, 456, 36, 30, 8, '#6a6a72');
    c.globalAlpha = 0.18; c.fillStyle = '#fff2b0'; c.beginPath(); c.moveTo(466, 44); c.lineTo(420, 190); c.lineTo(520, 190); c.closePath(); c.fill(); c.globalAlpha = 1;
    fig(c, LK.shadow, 440, 108, 'left');
    fig(c, playerLook(g), 112, 100, 'right');
    if (o.police) fig(c, LK.police, 360, 112, 'right');
  },
  snatch(c, t, g, o) {
    bands(c, 0, 110, '#9cc8ec', '#e0f0fa');
    for (let i = 0; i < 6; i++) { R(c, i * 110, 40, 104, 90, ['#d8c8a8', '#c8d0d8', '#e0c8b8'][i % 3]); R(c, i * 110 + 8, 96, 88, 34, '#5a4a3a'); R(c, i * 110, 40, 104, 10, ['#c83a3a', '#3a6aa8', '#3a8a5a'][i % 3]); }
    R(c, 0, 130, SW, SH - 130, '#c4bcae');
    for (let x = 0; x < SW; x += 48) R(c, x, 130, 1, SH - 130, '#b0a898');
    fig(c, LOOKS.oldwoman, 170, 160, 'right');
    const run = (t >> 3) % 3;
    fig(c, LK.thief, 470 + Math.min(80, t), 140, 'right', 2, run);
    R(c, 520 + Math.min(80, t), 186, 18, 14, '#a83a5a');
    fig(c, playerLook(g), 290, 150, 'right');
    if (o.police) fig(c, LK.police, 380, 150, 'left');
  },
  magazine(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#2a1e18');
    for (let y = 0; y < SH; y += 12) R(c, 0, y, SW, 1, '#33261e');
    R(c, 70, 18, 500, 238, '#00000060');
    R(c, 64, 12, 250, 236, '#f6f2e8'); R(c, 316, 12, 250, 236, '#f2eee2'); R(c, 314, 12, 2, 236, '#c8c0b0');
    // the masthead sits below the scene's title panel
    R(c, 84, 66, 120, 22, '#c8202a'); text(c, MAG, 94, 70, { size: 14, color: '#ffffff', shadow: null });
    const lines = String(g.fmt(o.headline || 'スクープ')).split('\n');
    lines.forEach((l, i) => {
      const size = Math.max(14, Math.min(24, Math.floor((24 * 212) / Math.max(1, measure(c, l, 24)))));
      text(c, l, 84, 98 + i * 34, { size, color: i ? '#c8202a' : '#1a1a1a', shadow: null });
    });
    for (let i = 0; i < 6; i++) R(c, 84, 174 + i * 11, 210 - (i % 3) * 30, 5, '#b8b2a4');
    R(c, 330, 42, 222, 150, '#5a5a62');
    for (let y = 42; y < 192; y += 4) for (let x = 330 + ((y >> 2) % 2) * 2; x < 552; x += 4) R(c, x, y, 2, 2, '#6a6a72');
    fig(c, { ...playerLook(g), top: '#3a3a44', bottom: '#2a2a34' }, 380, 98, 'down');
    if (o.other) fig(c, o.other, 450, 102, 'left');
    R(c, 330, 198, 222, 40, '#f2eee2');
    for (let i = 0; i < 2; i++) R(c, 336, 206 + i * 14, 200 - i * 50, 6, '#b8b2a4');
    if (o.stamp) { R(c, 470, 52, 76, 28, '#c8202a'); text(c, o.stamp, 508, 57, { size: 16, color: '#ffffff', align: 'center', shadow: null }); }
  },
  ryotei(c, t, g, o) {
    R(c, 0, 0, SW, FLOOR_Y, '#e8dfc8');
    for (let x = 0; x < SW; x += 80) { R(c, x, 0, 4, FLOOR_Y, '#5a3a20'); R(c, x + 4, 20, 72, 110, '#f0e8d4'); R(c, x + 38, 70, 6, 14, '#8a6a3a'); }
    R(c, 0, 0, SW, 20, '#5a3a20'); R(c, 0, 130, SW, 6, '#5a3a20');
    R(c, 500, 24, 80, 106, '#d8ccb0'); R(c, 526, 34, 28, 80, '#f4eee0'); R(c, 538, 44, 4, 60, '#3a3a3a');
    R(c, 0, FLOOR_Y, SW, SH - FLOOR_Y, '#cdbf86');
    for (let y = FLOOR_Y; y < SH; y += 46) R(c, 0, y, SW, 2, '#a89a5a');
    for (let x = 0; x < SW; x += 92) R(c, x, FLOOR_Y, 2, SH - FLOOR_Y, '#a89a5a');
    fig(c, o.host || LK.shacho, 290, 84, 'down');
    R(c, 170, 160, 300, 50, '#6a3a20'); R(c, 170, 160, 300, 6, '#8a5a34');
    disc(c, 230, 176, 10, '#f4f0e4'); disc(c, 400, 176, 10, '#f4f0e4');
    if (o.bag !== false) paperBag(c, 300, 168);
    fig(c, playerLook(g), 290, 206, 'up');
  },
  office(c, t, g, o) {
    wallFloor(c, '#ece4d4', '#d8ccb4', '#7a6a58', '#6a5a48');
    R(c, 20, 30, 150, 132, '#5a3e26');
    const cols = ['#8a2f2f', '#2f4a8a', '#3a6a3a', '#7a6a3a'];
    for (let r = 0; r < 5; r++) { R(c, 24, 34 + r * 26, 142, 22, '#3a2818'); for (let bx = 26; bx < 160; bx += 7) R(c, bx, 37 + r * 26, 6, 18, cols[(bx + r) % 4]); }
    R(c, 372, 30, 144, 110, '#f8f6f0'); R(c, 372, 30, 144, 16, '#c8202a');
    text(c, g.fmt(o.poster || '{familyname}'), 444, 60, { size: 16, color: '#1a1a1a', align: 'center', shadow: null });
    text(c, 'かならず、やりとげる。', 444, 100, { size: 12, color: '#3a3a3a', align: 'center', shadow: null });
    R(c, 528, 40, 92, 70, '#e8e8e0'); for (let i = 0; i < 5; i++) R(c, 534, 56 + i * 10, 80, 1, '#b8b8b0');
    R(c, 200, 150, 240, 40, '#6a4a2a'); R(c, 200, 150, 240, 6, '#8a6a44');
    for (let i = 0; i < 3; i++) R(c, 230 + i * 26, 138 - i * 4, 22, 14 + i * 4, '#f4f2ea');
    fig(c, o.who || LK.secretary, 290, 70, 'down');
    fig(c, playerLook(g), 290, 196, 'up');
  },
  party(c, t, g, o) {
    R(c, 0, 0, SW, FLOOR_Y, '#4a1a24'); R(c, 0, FLOOR_Y - 30, SW, 30, '#3a141c');
    for (let x = 60; x < SW; x += 160) { disc(c, x, 26, 18, '#e8c860'); disc(c, x, 26, 10, '#fff4c0'); }
    R(c, 160, 40, 320, 34, '#c8a24a'); R(c, 164, 44, 312, 26, '#1e1a10');
    text(c, o.banner || '感謝の宴', SW / 2, 48, { size: 16, align: 'center', color: '#f4e4a0', shadow: null });
    R(c, 0, FLOOR_Y, SW, SH - FLOOR_Y, '#5a2a30');
    for (const [x, y] of [[90, 200], [530, 200], [150, 250], [470, 250]]) { c.fillStyle = '#f4f2ea'; c.beginPath(); c.ellipse(x, y, 54, 16, 0, 0, Math.PI * 2); c.fill(); }
    fig(c, LK.guest, 50, 128, 'right'); fig(c, { ...LK.guest, top: '#1e2a3a' }, 540, 128, 'left'); fig(c, { ...LK.guest, top: '#3a3a1e', hair: 'short' }, 120, 160, 'right');
    fig(c, LK.boss, 380, 100, 'left');
    fig(c, playerLook(g), 270, 104, 'right');
    if (o.flash && (t >> 2) % 6 === 0) { c.globalAlpha = 0.5; R(c, 0, 0, SW, SH, '#ffffff'); c.globalAlpha = 1; }
  },
  arcade(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#0e0a1a');
    for (let i = 0; i < 7; i++) { const x = 20 + i * 90; R(c, x, 40, 70, 120, '#24203a'); neon(c, x + 8, 50, 54, 40, ['#ff3a8a', '#3ae0ff', '#ffd23f', '#7a5aff'][i % 4], t, i); R(c, x + 6, 110, 58, 20, '#3a3450'); }
    R(c, 0, 170, SW, SH - 170, '#1a1428');
    for (let x = 0; x < SW; x += 32) for (let y = 170; y < SH; y += 32) if ((x + y) % 64 === 0) R(c, x, y, 32, 32, '#221a34');
    fig(c, LK.yankee, 380, 124, 'left'); fig(c, { ...LK.yankee, hairColor: 'blonde', top: '#2a2a30' }, 450, 130, 'left');
    fig(c, playerLook(g), 260, 128, 'right');
  },
  alley(c, t, g, o) {
    bands(c, 0, 60, '#0a0a18', '#1a1a30');
    R(c, 0, 0, 170, 200, '#2a2630'); R(c, SW - 170, 0, 170, 200, '#2a2630');
    neon(c, 30, 40, 100, 24, '#ff4a9a', t, 1); neon(c, SW - 140, 60, 110, 24, '#3ad8ff', t, 3); neon(c, 40, 110, 70, 18, '#ffd23f', t, 5);
    R(c, 170, 0, SW - 340, 200, '#14121c');
    R(c, 0, 200, SW, SH - 200, '#26242c');
    R(c, 190, 150, 30, 46, '#3a4a3a'); R(c, 186, 146, 38, 6, '#4a5a4a');
    fig(c, LK.chinpira, 360, 124, 'left'); fig(c, LK.chinpira2, 420, 116, 'left');
    fig(c, playerLook(g), 250, 128, 'right');
  },
  letter(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#5a3e26');
    for (let y = 0; y < SH; y += 18) R(c, 0, y, SW, 2, '#4e3420');
    const words = String(o.words || '').split('\n');
    if (o.screen) {
      // a phone: the same sender, again and again
      const x = 210, y = 44;
      R(c, x - 6, y - 6, 192, 246, '#101018'); R(c, x, y + 10, 180, 226, '#eef2f8'); R(c, x + 70, y - 1, 40, 4, '#3a3a48');
      R(c, x, y + 10, 180, 24, o.bar || '#3a6ab8'); text(c, o.screen, x + 90, y + 15, { size: 12, align: 'center', color: '#ffffff', shadow: null });
      for (let i = 0; i < 3; i++) { R(c, x + 10, y + 42 + i * 26, 110 - i * 14, 18, '#d4dae6'); R(c, x + 18, y + 49 + i * 26, 80 - i * 14, 4, '#9aa4b8'); }
      words.forEach((w, i) => { const bw = measure(c, w, 16) + 20; R(c, x + 10, y + 124 + i * 34, bw, 28, '#ffffff'); R(c, x + 10, y + 124 + i * 34, 3, 28, '#c8202a'); text(c, w, x + 20, y + 130 + i * 34, { size: 16, color: '#2a1a1a', shadow: null }); });
    } else if (o.tv) {
      // the news on TV
      R(c, 300, 26, 300, 196, '#1a1a1e'); R(c, 312, 38, 276, 160, '#3a4a6a');
      for (let i = 0; i < 4; i++) R(c, 330 + i * 64, 70 - (i % 2) * 10, 50, 80 + (i % 2) * 10, '#5a6a8a');
      R(c, 312, 38, 64, 20, '#c8202a'); text(c, 'NEWS', 344, 41, { size: 12, align: 'center', color: '#ffffff', shadow: null });
      R(c, 312, 150, 276, 48, '#f4f4f0');
      words.forEach((w, i) => text(c, w, 450, 153 + i * 22, { size: 16, align: 'center', color: '#1a1a2a', shadow: null }));
      R(c, 420, 222, 60, 8, '#2a2a30'); R(c, 400, 230, 100, 6, '#2a2a30');
    } else {
      R(c, 110, 30, 200, 120, '#e8e0cc'); R(c, 110, 30, 200, 4, '#d0c8b4');
      c.fillStyle = '#c8bea8'; c.beginPath(); c.moveTo(110, 34); c.lineTo(210, 96); c.lineTo(310, 34); c.closePath(); c.fill();
      c.save(); c.translate(380, 40); c.rotate(0.06);
      R(c, 0, 0, 200, 210, '#f8f6f0');
      for (let y = 30; y < 200; y += 22) R(c, 14, y, 172, 1, '#c8d0e0');
      words.forEach((w, i) => text(c, w, 100, 50 + i * 40, { size: 22, align: 'center', color: '#2a1a1a', shadow: null }));
      c.restore();
    }
    fig(c, playerLook(g), 60, 170, 'up');
  },
  speech(c, t, g, o) {
    bands(c, 0, 130, '#8cbce8', '#d8ecf8');
    R(c, 120, 20, 400, 110, '#c8c4bc'); R(c, 120, 20, 400, 16, '#a8a49c');
    R(c, 260, 26, 120, 22, '#2a4a8a'); text(c, 'ドット駅', 320, 29, { size: 14, align: 'center', color: '#ffffff', shadow: null });
    for (let x = 140; x < 500; x += 60) R(c, x, 60, 40, 50, '#9ab8d0');
    R(c, 0, 130, SW, SH - 130, '#b8b4a8');
    for (const x of [176, 446]) { R(c, x, 40, 4, 110, '#5a5a5a'); R(c, x + 4, 40, 18, 70, '#ffffff'); R(c, x + 4, 40, 18, 6, '#c8202a'); }
    text(c, g.fmt('{familyname}'), 190, 54, { size: 12, color: '#1a1a1a', shadow: null });
    R(c, 270, 134, 100, 40, '#6a6a72'); R(c, 270, 134, 100, 5, '#8a8a92');
    fig(c, playerLook(g), 288, 64, 'down');
    if (o.sp) { if (!o.rush) fig(c, LK.sp, 200, 104, 'down'); fig(c, LK.sp, 376, 104, 'down'); }
    crowd(c, 30, 600, 186, 9, 2, 'up');
    if (o.rush) {
      // on the left, clear of the choice box: the man is stopped short of the podium
      const k = Math.min(1, t / 20);
      fig(c, o.sp ? LK.sp : LOOKS.staff, 30 + k * 40, 124, 'right');
      fig(c, LK.rusher, 70 + k * 50, 118, 'right');
      fig(c, o.sp ? LK.sp : LK.police, 186 - k * 16, 108, 'left');
      if ((t >> 2) % 2) for (let i = 0; i < 3; i++) R(c, 40 + k * 50 - i * 6, 150 + i * 10, 18, 2, '#ffffff');
    }
  },
  crisis(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#10141e');
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 196;
      R(c, x, 20, 180, 96, '#1a2a4a'); R(c, x + 4, 24, 172, 88, '#24406a');
      c.fillStyle = '#3a8a5a'; c.beginPath(); c.moveTo(x + 40, 90); c.lineTo(x + 70, 40); c.lineTo(x + 110, 52); c.lineTo(x + 140, 96); c.closePath(); c.fill();
      if (((t >> 4) + i) % 2) disc(c, x + 96, 66, 5, '#ff4a4a');
      for (let k = 0; k < 4; k++) R(c, x + 10, 30 + k * 8, 40 + ((k * 13 + i * 7) % 30), 3, '#8ab8e8');
    }
    R(c, 0, 160, SW, SH - 160, '#1a1e28');
    for (let i = 0; i < 4; i++) { R(c, 30 + i * 160, 150, 120, 26, '#2a3040'); R(c, 40 + i * 160, 138, 40, 14, '#3a5a8a'); }
    fig(c, LK.op, 60, 92, 'up'); fig(c, LK.op, 500, 92, 'up');
    fig(c, LK.kanshi, 380, 112, 'left');
    fig(c, playerLook(g), 270, 120, 'right');
  },
  visit(c, t, g, o) {
    bands(c, 0, 100, '#9ab8d8', '#c8d8e8');
    R(c, 0, 100, SW, 70, '#c8b89a'); R(c, 0, 100, SW, 4, '#e0d4b8');
    R(c, 260, 72, 90, 98, '#7a5a3a'); R(c, 264, 76, 82, 94, '#8a6a44'); R(c, 334, 120, 6, 6, '#d8c060');
    R(c, 0, 170, SW, SH - 170, '#9a9a90');
    fig(c, o.who || LK.collector, 390, 120, 'left');
    if (o.who !== LK.police) R(c, 380, 168, 26, 18, '#3a2a1a');
    fig(c, playerLook(g), 268, 118, 'down');
  },
};

// An HD backdrop behind the dialogue (or one of the justice core's stages).
class DarkScene {
  constructor(g, kind, opts = {}) { Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true, core: null }); }
  update() { this.t++; if (this.core) this.core.update(this.g); }
  draw(ctx, g) {
    if (this.core) { try { this.core.draw(ctx, g); } catch (e) { console.error(e); } return; }
    const fn = SCN[this.kind] || SCN.room;
    try { fn(ctx, this.t, g, this.opts); } catch (e) { console.error(e); }
    const title = this.opts.title;
    if (title) {
      const sub = this.opts.sub || '';
      const w = Math.min(SW - 24, Math.max(measure(ctx, title, 16), measure(ctx, sub, 12)) + 28);
      panel(ctx, 8, 8, w, sub ? 50 : 32, { bg: '#1a1f38' });
      text(ctx, title, 22, 15, { size: 16, color: COLORS.accent });
      if (sub) text(ctx, sub, 22, 36, { size: 12, color: '#d8dcf0' });
    }
    const st = g.state;
    if (st) {
      const d = lawDate(g);
      const label = `${wareki(d.year, d.month)}　${g.dayLabel()}`;
      const w = measure(ctx, label, 12) + 20;
      panel(ctx, SW - w - 8, 8, w, 26, { bg: '#1a1f38' });
      text(ctx, label, SW - w + 2, 14, { size: 12, color: '#d8dcf0' });
    }
  }
}
// One stage per event: set() switches the backdrop, core() shows a justice-core stage (press,
// houtei, kouban, bengoshi), hide() takes it away while a core flow runs, ensure() brings it back.
function makeStage(g, rec, kind, opts = {}) {
  const sc = new DarkScene(g, kind, opts);
  const S = {
    sc,
    set(k, o = {}) { sc.kind = k; sc.opts = o; sc.core = null; sc.t = 0; S.ensure(); return S; },
    core(k, o = {}) { sc.core = new StageScene(g, k, o); sc.t = 0; S.ensure(); return S; },
    ensure() { if (!g.scenes.includes(sc)) g.push(sc); return S; },
    hide() { g.pop(sc); return S; },
  };
  rec.stages.push(sc);
  g.push(sc);
  return S;
}

// ======================================================================== dialogue helpers
let CUR = null; // the event being run (its record collects the choices made)
let RUNNING = 0;
const narr = (g, t) => g.say(t);
const say = (g, who, t) => g.say(t, who ? { name: who.name, look: who.look } : {});
async function ask(g, who, t, choices, opts = {}) {
  const i = await g.ask(t, choices, { ...(who ? { name: who.name, look: who.look } : {}), cancel: opts.cancel ?? 0 });
  const k = Number.isInteger(i) && i >= 0 && i < choices.length ? i : opts.cancel ?? 0;
  if (CUR) CUR.picks.push(choices[k]);
  return k;
}
function news(g, t, from = 'ニュース') { g.message({ from, kind: 'news', text: g.fmt(t) }); }
function note(g, t) { (g.morningNotes || (g.morningNotes = [])).push(g.fmt(t)); }
const fl = (s, M) => (M ? FAMILY.fill(s, M) : s);
function famWho(M) { return { name: M.call, look: M.look }; }
function famSay(g, M, lines) { return g.say([].concat(lines).map((l) => fl(l, M)), famWho(M)); }
function famAsk(g, M, t, choices, opts) { return ask(g, famWho(M), [].concat(t).map((l) => fl(l, M)), choices, opts); }
function famMsg(g, M, t) {
  if (!M) return;
  const def = PEOPLE[M.pid];
  g.message({ from: def ? def.name : M.call, person: def ? M.pid : undefined, family: M.pid, look: M.look, kind: 'chat', text: g.fmt(fl(t, M)) });
}
function famAff(g, M, n) { try { if (M && PEOPLE[M.pid]) g.addAff(M.pid, n, true); } catch (e) { console.error(e); } }
function whoIs(g, c) {
  if (c.office && OFFICES[c.office]) return `${OFFICES[c.office].short || OFFICES[c.office].name}の{fullname}さん（${c.age}）`;
  return `タレントの{fullname}さん（${c.age}）`;
}
// The politics core's documented state: reputation / local support / standing in the party / the
// cabinet's mood (the same fields the core and kantei.js nudge).
function polNudge(g, { rep = 0, local = 0, mood = 0, standing = 0 } = {}) {
  const p = polOf(g);
  if (!p || !p.me) return;
  const me = p.me;
  if (rep) me.reputation = clamp(num(me.reputation) + rep, -100, 100);
  if (local) me.localSupport = clamp(num(me.localSupport) + local, 0, 100);
  if (standing) me.standing = clamp(num(me.standing) + standing, 0, 100);
  if (mood && p.cabinet) p.cabinet.mood = clamp(num(p.cabinet.mood) + mood, -20, 20);
}
// 裏金 that surfaces: what the core's own exposure check does (exposed += secret; secret = 0; scandal).
function exposeSecret(g, severity = 4) {
  const p = polOf(g);
  const me = p && p.me;
  if (!me || !(num(me.secret) > 0)) return 0;
  const amount = num(me.secret);
  me.exposed = num(me.exposed) + amount;
  me.secret = 0;
  try { g.politicalScandal('slush_fund', { amount, severity }); } catch (e) { console.error(e); }
  return amount;
}
// Write the hidden money into a proper report (the current year first, then last year's).
function correctReport(g) {
  const p = polOf(g);
  if (!p || !p.me || !(num(p.me.secret) > 0)) return 0;
  const amount = num(p.me.secret);
  let y = 0;
  try { y = g.polDate().year; } catch (e) { y = lawDate(g).year; }
  for (const year of [y, y - 1]) {
    try { const r = g.reportFunds({ includeSecret: true, year }); if (r && r.ok) return amount; } catch (e) { console.error(e); }
  }
  return exposeSecret(g, 3);
}
function scandalPol(g, kind, opts) { try { if (typeof g.politicalScandal === 'function') return g.politicalScandal(kind, opts); } catch (e) { console.error(e); } return null; }
function sanction(g, level, info = {}) { try { return g.careerSanction(level, info); } catch (e) { console.error(e); return null; } }
async function commit(g, id, ctx = {}) {
  try { return await g.commitCrime(id, ctx); } catch (e) { console.error(e); return { caught: false, report: { none: true } }; }
}
// Is this crime already on its way through the justice core (investigated, a case open)? With
// weekly, a 週刊誌 round the core has queued for it counts as well.
function caseOpen(g, crime, weekly = false) {
  try {
    const j = g.jus();
    if (!j) return false;
    const h = j.heat && j.heat[crime];
    if (h && h.queued) return true;
    const types = weekly ? ['arrest', 'summons', 'weekly'] : ['arrest', 'summons'];
    if ((j.queue || []).some((e) => e && e.crime === crime && types.includes(e.type))) return true;
    return (j.cases || []).some((cs) => cs && !cs.closed && cs.crime === crime);
  } catch (e) { return false; }
}
// A crime that is already public (a search, a report already in the news) goes straight to the
// investigators: the core's 週刊誌 round for it (heat.weekly / a queued 'weekly') is not needed any
// more. A crime the core is already handling is left to it (no second case).
async function prosecute(g, crime, ctx = {}) {
  try {
    const j = g.jus();
    if (caseOpen(g, crime)) { if (ctx.now) await g.justiceEvents(); return null; }
    j.queue = (j.queue || []).filter((e) => !(e && e.crime === crime && e.type === 'weekly'));
    const h = j && j.heat && j.heat[crime];
    if (h) h.weekly = true;
    return await g.investigate(crime, ctx);
  } catch (e) { console.error(e); return null; }
}
// 自首 (刑法42条: before the investigators know, the sentence may be reduced): the player goes to the
// prosecutors with a lawyer. Like the 警視庁's 自首 counter (justice.js), the core's g.arrest runs the
// procedure with the plea already made, and the case records the surrender (反省).
let SURRENDER = null;
async function surrender(g, crime) {
  try {
    if (caseOpen(g, crime)) return prosecute(g, crime, { now: true });
    const j = g.jus();
    const h = j.heat && j.heat[crime];
    if (h) h.queued = true;
    j.queue = (j.queue || []).filter((e) => !(e && e.crime === crime && ['arrest', 'summons', 'weekly'].includes(e.type)));
    SURRENDER = { crime, day: g.state.day };
    const cs = await g.arrest(crime, { via: 'warrant', evidence: 0.92, amount: h ? num(h.amount) : 0, request: h ? h.request : undefined, plea: 'admit', askPlea: false, skipArrestScene: true, source: '自首' });
    if (cs && typeof cs === 'object') { cs.remorse = Math.max(num(cs.remorse), 1.5); cs.plea = 'admit'; cs.jishu = 'jishu'; }
    return cs;
  } catch (e) { console.error(e); return null; } finally { SURRENDER = null; }
}
function caughtCount(g, id) { try { const j = g.jus(); return num(j && j.stats && j.stats.caught && j.stats.caught[id]); } catch (e) { return 0; } }
function money(g, n) { const st = g.state; const t = Math.min(Math.max(0, Math.round(n)), st.money); st.money -= t; return t; }
function schedule(g, id, inDays, data = {}) { const d = D(g); d.follow.push({ id, day: g.state.day + Math.max(1, Math.round(inDays)), data, tries: 0 }); }
const sagiWord = (y) => (y < 2005 ? 'オレオレ詐欺' : y < 2013 ? '振り込め詐欺' : '特殊詐欺');
// ストーカー規制法: in force from 2000-11-24; the 2016 amendment's 禁止命令 without a prior 警告 from 2017-06-14.
const stalkerLaw = (c) => c.year > 2000 || (c.year === 2000 && c.month >= 11);
const directOrder = (c) => c.year > 2017 || (c.year === 2017 && c.month >= 6);

// Regular shows on the days in hospital are put on hold (the shows wait; they are not "missed").
function excuseRegulars(g, notes) {
  const st = g.state;
  const wd = weekdayOf(st.day), wk = weekOf(st.day);
  for (const id of Object.keys(st.regulars || {})) {
    const r = REGULARS[id], s = st.regulars[id];
    if (!r || !s || s.dropped || s.since == null || r.weekday !== wd || num(s.doneWeek) >= wk) continue;
    s.doneWeek = wk;
    const m = `（『${r.title}』は、番組の配慮で今週はお休み扱いになった）`;
    if (!notes.includes(m)) notes.push(m);
  }
}
async function goHome(g) {
  try {
    const h = g.housing();
    const place = PLACES[h.place] ? h.place : PLACES.home ? 'home' : null;
    if (place && g.map.placeId !== place) await g.goto(place, h.room);
  } catch (e) { console.error(e); }
}
// A stay in hospital: the days pass (g.sleep away from home), meals and care inside, regular shows
// on hold; afterwards the body is still weak. o: { injury, cost, sub, doctor, home, weak }
async function hospitalStay(g, S, days, o = {}) {
  const st = g.state, d = D(g);
  S.set('hospital', { title: HOSPITAL, sub: o.sub || `入院（${days}日）`, visitor: o.visitor || LK.doctor });
  await say(g, WHO.doctor, o.doctor || [`${o.injury || 'けがをしています'}。\n${days}日ほど、入院して安静にしてください。`, '無理に動くと、治りが遅くなりますからね。']);
  d.hospUntil = st.day + days;
  const notes = [];
  try {
    for (let i = 0; i < days; i++) {
      excuseRegulars(g, notes);
      g.addNeed('hunger', 60);
      g.addNeed('clean', 30);
      await g.sleep({ away: true, shower: 0, sleepStress: 6, notes: false, save: false });
      if (Array.isArray(g.morningNotes)) notes.push(...g.morningNotes.splice(0));
      if (!free(g)) break;
      S.ensure();
    }
  } finally { d.hospUntil = 0; }
  S.ensure();
  const uniq = [...new Set(notes)].slice(0, 5);
  if (uniq.length) await g.say(uniq);
  if (o.cost) {
    const paid = money(g, o.cost);
    await narr(g, `（入院と治療の費用、${fmtMoney(paid)}を支払った）`);
  }
  try { g.useStamina(Math.round(st.maxStamina * (o.weak ?? 0.3))); } catch (e) { console.error(e); }
  await narr(g, '（退院の日。体はまだ、少し重い…）');
}

// ======================================================================== the events
// def: { name, cat, where: 'any'|'town'|'home_return'|{ places }, weight(g, c) | n, ok(g, c, data), cool (days),
//        story (follow-up only), passive (news only, no slot), moment ('job'|'speech'), run(g, c, data, open) }
const EV = {
  // ---------------------------------------------------------------- 事故
  acc_pedestrian: {
    name: '交通事故（歩行中）', cat: 'accident', luck: true, where: 'town', weight: 1, cool: 50,
    async run(g, c, data, open) {
      const st = g.state;
      const S = open('crossing', { title: '交差点', sub: '横断歩道を渡っていたとき…' });
      g.sfx('hit'); g.shake(18, 3);
      await narr(g, ['（青信号の横断歩道を渡っていたら、\n右折してきた車にぶつけられた――）', '（体が道路に投げ出された。\n足に、激しい痛みが走る…）']);
      let sev = data.sev || (roll(0.12) ? 3 : roll(0.45) ? 2 : 1);
      await say(g, WHO.driver, 'だ、大丈夫ですか！？\nすみません、歩いている人が見えていなくて…！');
      const k = await ask(g, null, '（どうする…？）', ['救急車を呼んでもらう', '大丈夫と言って帰る']);
      let mult = 1, report = 'jinshin';
      if (k === 1) {
        report = 'late';
        mult = 0.5;
        if (sev < 3 && roll(0.5)) sev++;
        await narr(g, ['（「大丈夫です」と言って、その場を離れた…）', '（しばらくすると、足がひどく腫れてきた。\n事故の直後は、興奮で痛みを感じにくいことがある）']);
        g.addNeed('stress', 10);
        await narr(g, '（あわてて病院へ行き、警察にも届け出た。\nあとからの届け出は、手続きに手間がかかる…）');
      } else {
        await say(g, WHO.medic, ['救急隊です。痛むところは、どこですか？', '動かないで。このまま病院へ運びます。']);
        S.set('crossing', { title: '交差点', sub: '実況見分', police: true });
        await say(g, WHO.police, ['警察です。運転手さんと、あなたの話を聞かせてください。', '事故の状況を確かめる「実況見分」をします。']);
        const k2 = await ask(g, WHO.driver, ['あの…人身事故になると、免許の点数が…。', '物損事故ということに、してもらえませんか…？'], ['人身事故として届ける', '物損事故にしてあげる']);
        if (k2 === 1) {
          report = 'busson';
          mult = 0.6;
          await narr(g, '（頼まれて、物損事故にしてしまった。\nけがの補償を、保険で受けにくくなるとも知らずに…）');
        } else await narr(g, '（けがをしたのだから、人身事故として届けた。\n治療費や慰謝料は、相手の自賠責保険などから出る）');
      }
      if (sev === 1) {
        S.set('hospital', { title: HOSPITAL, sub: '外来' });
        await say(g, WHO.doctor, ['足の打撲です。骨に異常はありません。', 'しばらく通院して、湿布で様子を見ましょう。']);
        try { g.useStamina(Math.round(st.maxStamina * 0.3)); } catch (e) { /* ignore */ }
        g.addNeed('stress', 8);
      } else {
        await hospitalStay(g, S, sev === 2 ? rint(3, 4) : rint(6, 8), { injury: sev === 2 ? '足の骨にひびが入っています' : '足を骨折しています' });
      }
      const base = [0, 60000, 250000, 800000][sev];
      let offer = round1000(base * mult);
      S.set('phone', { title: '保険会社からの電話', who: LK.hoken, rightBg: '#d8dce4', rightFloor: '#9a9ea8' });
      await say(g, WHO.hoken, ['ドット損保です。このたびは、申し訳ございませんでした。', `治療費とは別に、慰謝料などとして\n${fmtMoney(offer)}をお支払いしたいと考えております。`]);
      if (report !== 'jinshin') await say(g, WHO.hoken, report === 'busson' ? 'ただ…物損事故として届けられていますので、\nおけがの分は、お支払いできる額が限られます。' : 'ただ…事故の届け出が遅れていますので、\n事故とけがの関係を確かめるのに時間がかかります。');
      const k3 = await ask(g, WHO.hoken, 'こちらの金額で、示談としてよろしいでしょうか？', ['弁護士に相談する', 'この金額で示談する']);
      if (k3 === 0) {
        const more = round1000(offer * 1.6);
        const fee = round1000(Math.max(50000, (more - offer) * 0.3));
        if (more - fee <= offer) {
          await say(g, WHO.lawyer, ['この金額だと、弁護士費用のほうが高くついてしまいます。', '今回は、提示どおりで示談するのがいいでしょう。\n示談書の中身は、よく読んでからサインしてくださいね。']);
          await narr(g, '（相談して納得したうえで、示談書にサインした）');
        } else {
          await say(g, WHO.lawyer, ['保険会社の最初の提示は、低めのことが多いんです。', '裁判で使われる基準で、交渉してみましょう。']);
          await narr(g, `（数週間後、示談がまとまった。\n${fmtMoney(more)}から弁護士費用${fmtMoney(fee)}を引いた額を受け取った）`);
          offer = more - fee;
        }
      } else await narr(g, '（示談書にサインした。\n…一度サインすると、あとからやり直すのは難しい）');
      g.addMoney(offer);
      if (c.fame >= 250 || c.office) {
        news(g, `${whoIs(g, c)}が、横断歩道で車にはねられ${sev >= 2 ? '入院' : '軽いけが'}。`);
        const back = Math.round(num(st.fans) * 0.01);
        if (back > 0) g.addFans(back, true);
        if (c.office) polNudge(g, { local: 1 });
      }
      if (c.anyFam) famMsg(g, c.anyFam, '事故のこと、聞いた{yo}！\nけがは大丈夫な{no}？ 無理しないで、ちゃんと治して{ne}。');
      return { sev, report, settle: k3 === 0 ? 'lawyer' : 'accept', amount: offer };
    },
  },
  acc_bicycle: {
    name: '自転車の事故（加害）', cat: 'accident', luck: true, where: 'town', weight: 0.6, cool: 70,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const S = open('sidewalk', { title: '歩道', sub: '借りた自転車で急いでいたとき…' });
      g.sfx('hit'); g.shake(10, 2);
      await narr(g, ['（遅れそうで、借りた自転車で歩道を急いでいた。\n角から出てきた女性と、ぶつかってしまった――）', '（女性は倒れて、手首をおさえている…）']);
      await say(g, WHO.victimB, 'いたた…。');
      const sev = data.sev || (roll(0.3) ? 2 : 1);
      const k = await ask(g, null, '（どうする…？）', ['すぐ救護して110番', '連絡先だけ渡して去る']);
      let amount = sev === 2 ? 600000 : 120000;
      if (k === 0) {
        await narr(g, '（女性を歩道のはしに座らせて、救急車と警察を呼んだ）');
        S.set('sidewalk', { title: '歩道', sub: '事故の届け出', police: true });
        await say(g, WHO.police, ['自転車も、道路交通法では「車両」です。', '事故を起こしたら、けが人の救護と\n警察への報告が義務です（72条）。', '…すぐに連絡してくれて、よかった。']);
        await say(g, WHO.victimB, sev === 2 ? '…手首が、折れてるかもしれないわ。\nでも、逃げないでくれて、ありがとう。' : '…打っただけみたい。\n逃げないでくれて、ありがとうね。');
      } else {
        amount = round1000(amount * 1.4);
        await narr(g, '（名前と電話番号だけ渡して、その場を離れてしまった…）');
        S.set('phone', { title: '数日後の電話', who: WHO.victimFam.look, rightBg: '#d8dce4', rightFloor: '#9a9ea8' });
        await say(g, WHO.victimFam, ['母は、手首を骨折していました。', 'あなた、警察にも届けずに行ってしまったそうですね。\nけが人を残して立ち去るのは、許されることですか！']);
        await narr(g, '（けが人を残して立ち去るのは、救護義務違反として\n罪に問われることもある。何も言い返せなかった）');
        await narr(g, '（警察からも呼び出され、事故のことを一から聞かれた。\n「次は、必ずその場で救護と通報を」と厳しく言われた）');
        g.addNeed('stress', 15);
        if (c.fame >= 250 || c.office) {
          news(g, `【${MAG}】${whoIs(g, c)}、自転車で歩行者にけがをさせ、その場を離れていた。`);
          sanction(g, 2, {});
          if (c.office) scandalPol(g, 'private', { name: '自転車事故で被害者を置き去り', severity: 2 });
        }
      }
      S.set('phone', { title: '損害賠償', who: LK.lawyer, rightBg: '#e8e0d0', rightFloor: '#5a4a3a' });
      if (d.story.bikeIns) {
        await say(g, WHO.lawyer, ['入っていた自転車保険（個人賠償責任保険）から、\n治療費と慰謝料が支払われます。', `相手の方への賠償、${fmtMoney(amount)}は保険で払えますよ。`]);
      } else {
        await say(g, WHO.lawyer, ['相手方の弁護士です。', `治療費と慰謝料、休業損害として\n${fmtMoney(amount)}をお支払いください。`, '自転車の事故でも、けがが重いと賠償は高額になります。']);
        const r = await g.fine(amount, '自転車事故の損害賠償', { kind: 'civil' });
        if (r && r.unpaid) await narr(g, '（払いきれない分は、これからの収入から\n少しずつ支払っていくことになった…）');
        const law = c.year > 2020 || (c.year === 2020 && c.month >= 4) ? '\n東京都では2020年4月から、加入が義務になった' : '';
        const k2 = await ask(g, null, `（自転車保険に入っていれば…。${law}）`, ['自転車保険に入る', 'いまは入らない']);
        if (k2 === 0) {
          const fee = 4000;
          if (st.money >= fee) { money(g, fee); d.story.bikeIns = st.day; await narr(g, `（年${fmtMoney(fee)}の自転車保険に入った）`); } else await narr(g, '（いまは保険料が払えない…）');
        }
      }
      return { sev, fled: k === 1, amount };
    },
  },
  acc_stage: {
    name: '収録・舞台の事故', cat: 'accident', moment: 'job', cool: 60,
    async run(g, c, data, open) {
      const st = g.state;
      const tv = /nhk|ntv|tbs|fuji|asahi|tokyo|mbs|ktv|bs_|osaka_tv/.test(String(g.map.placeId));
      const S = open('stage', { title: tv ? 'スタジオ' : '劇場の舞台', sub: '本番の最中に…', tv });
      g.sfx('hit'); g.shake(20, 3);
      await narr(g, [tv ? '（収録の最中、頭の上のセットの一部が外れて落ちてきた――）' : '（本番の最中、舞台装置が倒れてきた――）', '（肩と腕に、強い痛みが走った…）']);
      await say(g, WHO.director, '止めて！ 本番止めて！\n大丈夫ですか！？ だれか、救急車を！');
      const k = await ask(g, null, '（どうする…？）', ['すぐに病院へ行く', '最後までやりきる']);
      let days = rint(2, 3);
      if (k === 1) {
        await narr(g, ['（「大丈夫です、続けましょう」と言って、最後までやりきった）', '（…終わったとたん、痛みで立っていられなくなった）']);
        days += 2;
        g.addNeed('stress', 10);
        await hospitalStay(g, S, days, { doctor: ['無理をしましたね。けがが広がっています。', '痛みは、体からの大事な合図です。\n次からは、すぐに止めてください。', `${days}日ほど入院して、安静にしてください。`] });
      } else await hospitalStay(g, S, days, { injury: '肩の打撲と、腕の骨にひびが入っています' });
      S.set('hospital', { title: HOSPITAL, sub: 'お見舞い', visitor: LOOKS.manager });
      await say(g, WHO.producer, ['このたびは、本当に申し訳ありませんでした。', '治療費は、制作会社の保険でお支払いします。\nセットの安全点検も、すべてやり直しています。']);
      if (c.year >= 2021 && c.month >= 4 || c.year >= 2022) await narr(g, '（芸能の仕事をする人も、2021年4月から\n労災保険に「特別加入」できるようになった）');
      g.addMoney(50000, true);
      await narr(g, `（制作会社から、お見舞金${fmtMoney(50000)}を受け取った）`);
      if (c.fame >= 250) {
        news(g, `${tv ? '収録' : '公演'}中の事故で、${whoIs(g, c)}がけが。制作側は安全管理を見直すと発表。`);
        const back = Math.round(num(st.fans) * 0.01);
        if (back > 0) g.addFans(back, true);
      }
      if (c.anyFam) famMsg(g, c.anyFam, '仕事中にけがしたって聞いた{yo}！\nしっかり治すまで、無理したら{dameyo}。');
      return { pushed: k === 1, days };
    },
  },

  // ---------------------------------------------------------------- 事件（被害・目撃）
  inc_sagi_warn: {
    name: '詐欺の注意（家族へ）', cat: 'incident', luck: true, where: 'any', weight: 0.5, cool: 90,
    ok: (g, c) => c.year >= 2003 && !!c.elder && (!c.d.famWarned || c.day - num(c.d.famWarned) > 60),
    async run(g, c, data, open) {
      const M = c.elder;
      const S = open('phone', { title: 'ニュース', sub: sagiWord(c.year), who: M.look, rightLabel: M.call });
      await narr(g, `（ニュースで、家族を名乗る電話でお金をだまし取る\n「${sagiWord(c.year)}」の被害が増えていると伝えていた）`);
      const k = await ask(g, null, '（ふるさとの家族は、大丈夫だろうか…）', ['家族に電話して注意', 'あとにする']);
      if (k === 0) {
        await famSay(g, M, ['そうなの？ 気をつける{yo}。', '{you}の声なら、すぐ分かると思う{yo}。']);
        await narr(g, '（「お金の話が出たら、いったん電話を切って、\nこっちの番号にかけ直して」と、念を押した）');
        c.d.famWarned = g.state.day;
        famAff(g, M, 2);
      } else await narr(g, '（あとで電話しよう…と思ったまま、忘れてしまった）');
      S.hide();
      return { warned: k === 0 };
    },
  },
  inc_sagi: {
    name: '特殊詐欺（家族が狙われる）', cat: 'incident', luck: true, where: 'any', noJikka: true, weight: 0.6, cool: 90,
    ok: (g, c) => c.year >= 2003 && !!c.elder,
    async run(g, c, data, open) {
      const st = g.state, M = c.elder;
      const word = sagiWord(c.year);
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call });
      if (c.day - num(c.d.famWarned) <= 90 && c.d.famWarned) {
        await famSay(g, M, ['さっき、{you}を名乗る電話があった{yo}。\n「会社のお金をなくした」って。', 'でも、{you}に言われたとおり、すぐ切って\n警察に相談した{yo}。']);
        const k = await ask(g, famWho(M), fl('…{you}の言ったとおりだった{ne}。', M), ['よく気づいたとほめる', 'もう一度念を押す']);
        await narr(g, k === 0 ? '（「ありがとう、本当によかった」と伝えた）' : '（「これからも、お金の話は必ずかけ直してね」と伝えた）');
        famAff(g, M, 3);
        news(g, `${word}の被害を防いだ家族がいた。警察は「電話でお金の話が出たら、まず相談を」と呼びかけている。`);
        return { prevented: true, warned: true };
      }
      const amt = 3000000;
      await famSay(g, M, ['{you}！ さっきの電話、風邪で声が変だった{ne}…。\nもう具合はいい{no}？', `それで、「会社のお金をなくした、\n今日中に${fmtMoney(amt)}いる」って言ってたでしょ。`, 'いまから、言われた人にお金を渡しに行く{nda}。']);
      const k = await ask(g, null, '（そんな電話、していない…！）', ['それは詐欺だと止める', 'いまは忙しいと切る']);
      if (k === 0) {
        await narr(g, ['（「それは詐欺だよ！ 自分はかけていない！」と伝えた。\n家族を落ち着かせて、すぐ110番してもらった）', '（警察が待ちかまえ、お金を受け取りに来た男が逮捕された）']);
        news(g, `${word}：現金を受け取りに来た「受け子」の男を、警察が逮捕。被害は防がれた。`);
        famAff(g, M, 3);
        c.d.famWarned = st.day;
        return { prevented: true };
      }
      await narr(g, ['（「ごめん、いま忙しいから」と電話を切ってしまった…）', `（夜になって分かった。${M.call}は、知らない男に\n${fmtMoney(amt)}を渡してしまっていた…）`]);
      g.addNeed('stress', 15);
      news(g, `${word}の被害：高齢者が、家族を名乗る電話にだまされ現金${fmtMoney(amt)}を渡す。`);
      famMsg(g, M, 'ごめん{ne}、{me}がだまされたばっかりに…。\n{you}は悪くない{yo}。警察には届けた{kara}。');
      famAff(g, M, -1);
      return { prevented: false };
    },
  },
  inc_akisu: {
    name: '空き巣', cat: 'incident', luck: true, where: 'home_return',
    weight: (g, c) => (c.home === 'tower' ? 0.2 : c.home === 'mansion' ? 0.4 : 0.6), cool: 80,
    async run(g, c, data, open) {
      const st = g.state;
      const S = open('room', { title: '自宅', sub: '帰ってくると…' });
      g.sfx('buzz');
      await narr(g, ['（家に帰ると、玄関の鍵がこじ開けられていた。\n部屋の中が、ひどく荒らされている…）', '（空き巣だ――）']);
      const loss = round1000(clamp(st.money * 0.06, 3000, 30000));
      const k = await ask(g, null, '（どうする…？）', ['何も触らず110番する', '自分で片付ける']);
      g.addMoney(-Math.min(loss, st.money), true);
      if (k === 0) {
        S.set('room', { title: '自宅', sub: '現場検証', police: true });
        await say(g, WHO.keiji, ['よく触らずにいてくれました。\n指紋や足あとを調べます。', '何がなくなったか、あとで一覧にして\n被害届を出してください。']);
        await narr(g, `（部屋に置いていた現金${fmtMoney(loss)}と、腕時計がなくなっていた）`);
        g.addNeed('stress', 12);
        if (roll(0.5)) schedule(g, 'inc_akisu_caught', rint(12, 30), { loss });
      } else {
        await narr(g, ['（気が動転して、散らかった部屋を片付けてしまった…）', '（あとで警察に届けると、「現場を片付けると、\n犯人の手がかりが消えてしまう」と言われた）']);
        await narr(g, `（現金${fmtMoney(loss)}と腕時計は、もう戻らないだろう…）`);
        g.addNeed('stress', 18);
      }
      await narr(g, c.home === 'home' ? '（大家さんが、すぐに鍵を交換してくれた）' : '（管理会社が、鍵を交換してくれた）');
      return { police: k === 0, loss };
    },
  },
  inc_akisu_caught: {
    name: '空き巣の犯人逮捕', cat: 'incident', passive: true, story: true,
    run(g, c, data) {
      const back = round1000(num(data.loss) / 2);
      news(g, '連続空き巣の疑いで、男を逮捕。警察によると、被害は数十件にのぼるという。');
      if (back > 0) g.addMoney(back, true);
      note(g, `（警察から連絡があった。空き巣の犯人がつかまり、\n盗まれたお金の一部、${fmtMoney(back)}が戻ってきた）`);
    },
  },
  inc_stalker: {
    name: 'ストーカー', cat: 'incident', luck: true, where: 'any', weight: 0.7, cool: 150,
    ok: (g, c) => c.fame >= 250 && !c.d.story.stalker,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const how = c.year < 2005 ? '同じ人物から、手紙が毎日のように届く' : c.year < 2015 ? 'ブログのコメント欄に、同じ人物の書きこみが続く' : 'ドッターのDMに、同じ人物から何十通もメッセージが届く';
      const S = open('letter', { title: '届いたメッセージ', sub: 'このところ毎日…', words: 'きょうの帰り道\nすてきでした', screen: c.year < 2005 ? null : c.year < 2015 ? 'ブログのコメント' : g.fmt('ドッター　DM') });
      await narr(g, [`（このところ、${how}）`, '（「今日の帰り道、すてきでした」――\n…どうして、帰り道を知っているんだろう）']);
      const law = stalkerLaw(c);
      const k = await ask(g, null, '（どうしよう…）', ['事務所と警察に相談', 'しばらく様子を見る', '返事をしてみる']);
      d.story.stalker = st.day;
      if (k === 0) {
        S.core('kouban', { title: '警察署', sub: '生活安全課の相談窓口' });
        if (law) {
          await say(g, WHO.police, ['つきまといは、ストーカー規制法の対象です。', directOrder(c) ? '相手に警告したり、すぐに禁止命令を出したりできます。\n（2017年6月から、警告なしでも命令が出せる）' : '相手に「警告」を出して、やめるよう求めます。\n従わなければ、禁止命令や逮捕もありえます。', 'ひとりで抱えこまないで、何かあればすぐ110番を。']);
          await narr(g, '（警察が相手に警告をした。\nメッセージは、ぴたりと止まった）');
          g.addNeed('stress', -6);
          d.story.stalker = 'done';
          return { pick: 'police', ended: true };
        }
        await say(g, WHO.police, ['つきまといを取りしまる法律は、\nまだ十分ではないんです…。', '家の周りの見回りを、強めておきます。\n何かあったら、すぐに110番してください。']);
        schedule(g, 'inc_stalker2', rint(6, 12), { level: 1 });
        return { pick: 'police', ended: false };
      }
      if (k === 2) {
        await narr(g, '（「応援ありがとう。でも、つきまとわないで」と返した。\n…次の日から、メッセージはもっと増えた）');
        g.addNeed('stress', 8);
        schedule(g, 'inc_stalker2', rint(3, 6), { level: 2 });
        return { pick: 'reply' };
      }
      await narr(g, '（気にしないようにした。…でも、メッセージは止まらない）');
      g.addNeed('stress', 6);
      schedule(g, 'inc_stalker2', rint(5, 10), { level: 1 });
      return { pick: 'wait' };
    },
  },
  inc_stalker2: {
    name: 'ストーカー（家の前）', cat: 'incident', where: 'home_return', story: true,
    async run(g, c, data, open) {
      const S = open('doorway', { title: '自宅の前', sub: '夜、帰ってくると…' });
      await narr(g, ['（家の前の電柱のかげに、だれかが立っている）', '（…あのメッセージの人物だ）']);
      const k = await ask(g, null, '（どうする…？）', ['すぐに110番する', '話しかけてみる']);
      const law = stalkerLaw(c);
      if (k === 1) {
        await narr(g, ['（「やめてください」と声をかけた。\n「やっと会えたね」…相手が一歩、近づいてきた）', '（近所の人が気づいて、110番してくれた）']);
        g.addNeed('stress', 20);
      } else await narr(g, '（家に入って鍵をかけ、すぐに110番した）');
      S.set('doorway', { title: '自宅の前', sub: '警察が来た', police: true });
      await say(g, WHO.police, !law
        ? ['相手から事情を聞き、厳しく注意しました。', '何かあれば、夜中でもすぐに呼んでください。']
        : directOrder(c)
          ? ['相手から事情を聞きました。ストーカー規制法にもとづいて、\n二度と近づかないよう禁止命令を出します。', 'ひとりで直接、相手に会わないでくださいね。']
          : ['相手から事情を聞き、ストーカー規制法の「警告」を\n出しました。従わなければ、禁止命令や逮捕もありえます。', 'ひとりで直接、相手に会わないでくださいね。']);
      c.d.story.stalker = 'done';
      if (k === 0) g.addNeed('stress', -4);
      return { pick: k === 0 ? 'police' : 'talk' };
    },
  },
  inc_witness: {
    name: 'ひったくりの目撃', cat: 'incident', luck: true, where: 'town', weight: 0.7, cool: 70,
    async run(g, c, data, open) {
      const st = g.state;
      const S = open('snatch', { title: '商店街', sub: '目の前で…' });
      g.sfx('buzz');
      await narr(g, '（目の前で、男が歩いていた女性のバッグをひったくり、\n走り去った――）');
      await say(g, WHO.victimB, 'だれか！ どろぼう！');
      const k = await ask(g, null, '（どうする…？）', ['110番して女性を助ける', '男を追いかける', '見なかったことにする']);
      if (k === 2) {
        await narr(g, '（足がすくんで、その場を離れてしまった…）');
        g.addNeed('stress', 6);
        return { pick: 'ignore' };
      }
      if (k === 1) {
        if (roll(0.4)) {
          await narr(g, '（追いかけて大声を出すと、周りの人も加わり、\n男は取り押さえられた）');
          g.addFame(10, true);
          if (c.fame >= 250) news(g, `${whoIs(g, c)}が、ひったくりの男を追いかけ、通行人と協力して取り押さえた。警察は「危険なので、まず110番を」とも呼びかけている。`);
        } else {
          await narr(g, '（追いかけたが、角で転んでしまった。\n男の姿は、もう見えない…）');
          try { g.useStamina(15); } catch (e) { /* ignore */ }
        }
      }
      S.set('snatch', { title: '商店街', sub: '警察が来た', police: true });
      await say(g, WHO.police, ['通報ありがとうございます。\n男の服装や、逃げた方向を教えてください。', '目撃した方の証言は、とても大事なんです。']);
      await narr(g, '（覚えていることを、すべて話した）');
      if (roll(0.75)) schedule(g, 'inc_court', rint(12, 25), {});
      return { pick: k === 0 ? 'call' : 'chase' };
    },
  },
  inc_court: {
    name: '証人として出廷', cat: 'incident', where: 'any', story: true,
    async run(g, c, data, open) {
      const S = open('letter', { title: '裁判所からの呼出状', sub: '証人として', words: '証人\n呼出状' });
      news(g, '先日のひったくり事件で、男を窃盗の疑いで逮捕。男は起訴された。');
      await narr(g, ['（裁判所から、証人として出廷してほしいという\n呼出状が届いた）', '（あのひったくり事件の裁判だ）']);
      const k = await ask(g, null, '（どうする…？）', ['出廷して証言する', '仕事を優先する']);
      if (k === 1) {
        await narr(g, '（正当な理由なく出頭しない証人には、過料や\n罰金などの罰がある――刑事訴訟法150条・151条）');
        const r = await g.fine(legalYen(g, 50000), '証人の不出頭', { kind: 'kare' });
        await narr(g, '（裁判所から過料の決定が届いた。\n…裁判は、次の期日に延びたという）');
        return { pick: 'skip', fined: r };
      }
      S.core('houtei', { title: '地方裁判所　刑事法廷', sub: '証人尋問' });
      await say(g, WHO.judge, ['証人は、宣誓書を読み上げてください。']);
      await narr(g, '「良心に従って真実を述べ、何事も隠さず、\nまた何事も付け加えないことを誓います」');
      await say(g, WHO.kenji, ['あなたが見たことを、順番に話してください。']);
      await narr(g, '（あの日のことを、見たとおりに話した）');
      const k2 = await ask(g, WHO.bengo, ['弁護人です。', 'その時、あたりは暗くなかったですか？\n本当に、被告人の顔が見えたのでしょうか。'], ['見たままを答える', '自信がないと答える']);
      await narr(g, k2 === 0 ? '（「明るい時間でした。顔も服も、はっきり見ました」\nと答えた）' : '（「…はっきりとは言えません」と正直に答えた）');
      await say(g, WHO.judge, 'ご苦労さまでした。\n証人の旅費と日当は、あとで支払われます。');
      g.addMoney(legalYen(g, 8000), true);
      news(g, `ひったくり事件の裁判で、被告人に${k2 === 0 ? '有罪判決' : '判決'}。裁判所は、目撃者の証言などから事実を認めた。`);
      return { pick: 'testify', sure: k2 === 0 };
    },
  },

  // ---------------------------------------------------------------- 週刊誌のスクープ
  scoop_kyaba: {
    name: '週刊誌：キャバクラの写真', cat: 'scoop', where: 'any', cool: 25,
    weight: (g, c) => 2.5,
    ok: (g, c) => seenWithin(c.d, ['kyabakura'], c.day, 21) && (c.fame >= 250 || !!c.office) && c.d.story.kyabaShot !== c.d.seen.kyabakura,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      d.story.kyabaShot = d.seen.kyabakura || st.day;
      const M = managerOf(c);
      const head = c.office ? '{familyname}議員\n深夜のネオン街' : '{fullname}\n夜の街で豪遊';
      const S = open('magazine', { title: MAG, sub: '来週号のゲラ', headline: head, stamp: '独占' });
      await say(g, M, [`${MAG}が、キャバクラから出てくる写真を\n来週号に載せるそうです。`, c.national && c.p && c.p.diet && c.p.diet.session && num(c.p.diet.session.end) >= c.day ? '国会の会期中だということも、書かれています…。' : c.office ? '有権者に、どう説明なさいますか…。' : 'どう対応するか、決めてください。']);
      return scoopChoice(g, c, S, { topic: 'kyaba', truth: true, label: 'キャバクラ通い' });
    },
  },
  scoop_second: {
    name: '週刊誌：第2弾', cat: 'scoop', where: 'any', story: true,
    async run(g, c, data, open) {
      const S = open('magazine', { title: MAG, sub: '第2弾', headline: '{familyname}\n「否定」は嘘だった', stamp: '第2弾' });
      await narr(g, [`（${MAG}が第2弾を出した。\n店の中の写真と、関係者の証言つきだ）`, '（否定したことが、かえって火に油を注いだ…）']);
      sanction(g, 2, { force: true });
      if (c.office) scandalPol(g, 'private', { name: `${data.label || '報道'}をめぐる虚偽の説明`, severity: 3 });
      const k = await ask(g, null, '（どうする…？）', ['会見を開いて謝罪する', '何も言わない']);
      if (k === 0) {
        S.core('press', { title: '謝罪会見', sub: '', banner: 'おわびの会見' });
        await narr(g, '（「事実と違う説明をしてしまいました。\n深くおわびします」と、頭を下げた）');
        if (c.office) polNudge(g, { rep: 3 });
      } else {
        g.addNeed('stress', 8);
        if (c.office) polNudge(g, { rep: -5, local: -3 });
      }
      return { apologized: k === 0 };
    },
  },
  scoop_suit: {
    name: '名誉毀損の裁判の判決', cat: 'scoop', passive: true, story: true,
    run(g, c, data) {
      if (data.truth) {
        news(g, `{fullname}さんが${MAG}を訴えた裁判で、裁判所は請求を退けた。「記事の重要な部分は真実」と判断した。`);
        sanction(g, 1, { force: true });
        if (c.office) polNudge(g, { rep: -6 });
        note(g, '（名誉毀損の裁判に負けた。\n記事は真実だと、裁判所に認められてしまった…）');
      } else {
        const dmg = 1100000;
        g.addMoney(dmg, true);
        news(g, `{fullname}さんが${MAG}を訴えた裁判で、裁判所は記事を「真実とは認められない」として、出版社に${fmtMoney(dmg)}の賠償を命じた。`);
        if (c.office) polNudge(g, { rep: 6, local: 3 });
        else { const back = Math.round(num(g.state.fans) * 0.02); if (back > 0) g.addFans(back, true); }
        note(g, `（名誉毀損の裁判に勝った！\n出版社から、${fmtMoney(dmg)}の賠償金が支払われる）`);
      }
    },
  },
  scoop_momikeshi: {
    name: 'もみ消し工作の発覚', cat: 'scoop', where: 'any', story: true,
    ok: (g, c) => !!(c.heat && c.heat.antisocial_ties),
    async run(g, c, data, open) {
      const S = open('magazine', { title: MAG, sub: '新たなスクープ', headline: '{familyname}\n記事もみ消しに反社', stamp: '衝撃' });
      await narr(g, ['（記事をもみ消すために頼った「仲介者」が、\n暴力団の関係者だったことが報じられた）', '（もみ消しを頼んだこと自体が、\nもっと大きなスキャンダルになってしまった…）']);
      S.hide();
      try { await g.investigate('antisocial_ties', { now: true }); } catch (e) { console.error(e); }
      if (c.office) await politicianResign(g, c, open, '反社会的勢力との関わり');
      return { exposed: true };
    },
  },
  scoop_hansha: {
    name: '週刊誌：反社との写真', cat: 'scoop', where: 'any', cool: 30,
    weight: 2,
    ok: (g, c) => !!(c.heat && c.heat.antisocial_ties && !c.heat.antisocial_ties.queued) && (c.fame >= 250 || !!c.office),
    async run(g, c, data, open) {
      const M = managerOf(c);
      const src = hanshaSource(g, c);
      const S = open('magazine', { title: MAG, sub: '来週号のゲラ', headline: `{familyname}${c.office ? '議員' : ''}\n${src.head}`, other: src.other, stamp: '独占' });
      await say(g, M, [`${MAG}が、${src.photo}を\n持っているそうです。`, c.office ? '先生、どう説明なさいますか…。' : '本当なんですか…？ どうするか、決めてください。']);
      const k = await ask(g, null, '（どうする…？）', ['自分から公表して謝る', '弁護士に相談する', 'もみ消しを頼む', '取材には応じない']);
      const res = { pick: ['admit', 'lawyer', 'momikeshi', 'silent'][k], src: src.id };
      let admit = k === 0;
      if (k === 2) {
        S.hide();
        let ok = false;
        try { ok = await g.coverUp('antisocial_ties', { where: '都内の喫茶店' }); } catch (e) { console.error(e); }
        if (!free(g)) return res;
        S.ensure();
        if (ok) { await narr(g, '（記事は、出なかった。\n…今のところは）'); return { ...res, covered: true }; }
        await narr(g, '（記事を止めることは、できなかった…）');
      }
      if (k === 1) {
        S.set('phone', { title: '弁護士事務所', who: LK.lawyer, rightBg: '#e8e0d0', rightFloor: '#5a4a3a' });
        await say(g, WHO.lawyer, ['写真が本物なら、裁判で争っても勝ち目は薄い。', '反社会的勢力との関わりは、契約を切られる理由に\n十分なります。事実なら、早く説明したほうがいい。']);
        const k2 = await ask(g, WHO.lawyer, 'どうしますか？', ['公表して謝る', '出版社を訴える']);
        if (k2 === 1) {
          money(g, 300000);
          schedule(g, 'scoop_suit', rint(15, 25), { truth: true });
          res.sued = true;
        } else admit = true;
      }
      if (k === 0) await narr(g, '（自分から事務所と世間に、すべて話すことにした）');
      await hanshaExposed(g, c, S, { admit, src });
      if (c.office && free(g)) {
        scandalPol(g, 'antisocial', {});
        await politicianResign(g, c, open, '反社会的勢力との交際');
      }
      return res;
    },
  },
  scoop_urakane: {
    name: '週刊誌：裏金疑惑', cat: 'scoop', where: 'any', cool: 40,
    weight: (g, c) => (c.secret > 0 ? 2 : 0.2),
    ok: (g, c) => !!c.office,
    async run(g, c, data, open) {
      const st = g.state;
      const truth = c.secret > 0;
      const S = open('magazine', { title: MAG, sub: '来週号のゲラ', headline: '{familyname}議員に\n「裏金」疑惑', stamp: '追及' });
      await say(g, WHO.secretary, [`${MAG}が、先生の政治団体の収支報告書に\n書かれていない収入があると書くそうです。`, truth ? (secretFromParty(c) ? '…パーティー券の分のことだと思います。' : '…帳簿にのせていない、あのお金のことだと思います。') : '身に覚えは、ありませんよね…？']);
      if (!truth) {
        const k = await ask(g, null, '（身に覚えのない疑惑だ…）', ['事実無根と説明する', '名誉毀損で訴える', '何も言わない']);
        if (k === 0) {
          S.core('press', { title: '記者会見', sub: '', banner: '説明会見' });
          await narr(g, '（収支報告書と領収書を公開して、ひとつずつ説明した。\n疑いは、しだいに晴れていった）');
          polNudge(g, { rep: 2 });
        } else if (k === 1) {
          await narr(g, '（弁護士を通じて、出版社を名誉毀損で訴えた）');
          money(g, 300000);
          schedule(g, 'scoop_suit', rint(15, 25), { truth: false });
        } else { await narr(g, '（何も説明しなかった。「説明責任を果たせ」という声が上がった）'); polNudge(g, { rep: -6, local: -3 }); }
        return { truth: false, pick: ['explain', 'sue', 'silent'][k] };
      }
      const k = await ask(g, null, '（どうする…？）', ['報告書を訂正し謝罪', '否定する', '名誉毀損で訴える', 'もみ消しを図る']);
      if (k === 0) {
        const amount = correctReport(g);
        S.core('press', { title: '記者会見', sub: '', banner: 'おわびの会見' });
        await narr(g, [`（収支報告書に書いていなかった${fmtMoney(amount)}を、\n書き加えて訂正した）`, '（「事務所の管理が不十分でした」と、頭を下げた。\n…訂正しても、違法だった事実は消えない）']);
        scandalPol(g, 'slush_fund', { amount, severity: 3 });
        return { truth: true, pick: 'correct', amount };
      }
      if (k === 3) {
        S.hide();
        let ok = false;
        try { ok = await g.coverUp('slush_fund', { where: '議員会館' }); } catch (e) { console.error(e); }
        if (ok) { S.ensure(); await narr(g, '（記事は、別の話題に差しかえられた。\n…でも、この秘密はいつまで守れるだろう）'); return { truth: true, pick: 'momikeshi', covered: true }; }
        if (!free(g)) return { truth: true, pick: 'momikeshi' };
      }
      S.ensure();
      await narr(g, k === 1 ? '（「まったくの事実無根です」と言い切った）' : k === 2 ? '（「事実無根の記事です。法的措置をとります」と発表した）' : '（記事を止めることは、できなかった…）');
      const amount = exposeSecret(g, 4);
      await narr(g, `（発売された記事には、帳簿の写しまで載っていた。\n不記載は${fmtMoney(amount)}にのぼる…）`);
      polNudge(g, { rep: -5 });
      if (k === 2) { money(g, 300000); schedule(g, 'scoop_suit', rint(15, 25), { truth: true }); }
      return { truth: true, pick: ['correct', 'deny', 'sue', 'momikeshi'][k], amount };
    },
  },

  // ---------------------------------------------------------------- 裏金・汚職・利権（政治家）
  pol_offer: {
    name: '業者からの見返りの申し出', cat: 'corruption', where: 'any', weight: 1.2, cool: 30,
    ok: (g, c) => !!c.office,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const level = c.level;
      if (c.national) {
        const amt = 3000000;
        const S = open('ryotei', { title: '料亭の座敷', sub: '「ぜひ一席」と招かれた', host: LK.shacho });
        await say(g, WHO.shacho, ['先生、本日はありがとうございます。', '地元のバイパス工事の件で、役所のほうに\nひと声かけていただければ…。', 'これは、ほんの気持ちです。']);
        await narr(g, `（テーブルの上に、紙袋が置かれた。\n中には、現金${fmtMoney(amt)}…）`);
        const k = await ask(g, null, `（受け取れば、収賄だ。\n${CRIMES.bribery_take.law(g).split('：')[0]}…）`, ['きっぱり断る', '受け取る']);
        if (k === 0) {
          await narr(g, ['（紙袋を押し返した。社長の顔から、笑みが消えた）', '（席を用意した地元の有力者の顔をつぶした形だ。\n地元の業者の一部は、対立候補の応援に回るだろう）']);
          polNudge(g, { local: -3, standing: -2, rep: 1 });
          d.story.refused = (d.story.refused || 0) + 1;
          return { pick: 'refuse' };
        }
        const r = await commit(g, 'bribery_take', { amount: amt, request: true, gain: { money: amt }, where: '料亭' });
        d.story.bribe = st.day;
        if (!r.caught) { await narr(g, '（紙袋を受け取った。…手が、少しふるえていた）'); schedule(g, 'pol_benbi', rint(5, 10), { amt }); }
        return { pick: 'take', caught: !!r.caught };
      }
      if (level === 'exec') {
        const amt = 2000000;
        const S = open('office', { title: c.office === 'chiji' ? '知事室' : '区長室', sub: '来客', who: LK.shacho, poster: c.office === 'chiji' ? '都政' : '区政' });
        await say(g, WHO.aoba, ['来月の道路工事の入札の件ですが…。', '予定価格を、こっそり教えていただけませんか。\nもちろん、お礼はさせていただきます。']);
        const k = await ask(g, null, '（入札の情報をもらすのは「官製談合」。\n見返りを受け取れば、収賄にもなる）', ['公正な入札を守る', '予定価格を教える']);
        if (k === 0) {
          await narr(g, ['（「入札は公正にやります。お引き取りください」）', '（地元の業者の中には、不満をもらす人もいた）']);
          polNudge(g, { local: -4, rep: 2 });
          return { pick: 'refuse' };
        }
        const r = await commit(g, 'bribery_take', { amount: amt, request: true, gain: { money: amt }, where: '役所の応接室' });
        d.story.bribe = st.day;
        if (!r.caught) await narr(g, '（予定価格を書いたメモを渡した。\n…あおば土木は、ぴったりの額で落札した）');
        return { pick: 'take', caught: !!r.caught };
      }
      const amt = 500000;
      const crime = CRIMES.assen && (!CRIMES.assen.exists || CRIMES.assen.exists(g)) ? 'assen' : 'bribery_take';
      const S = open('office', { title: '事務所', sub: '後援会の有力者が来た', who: LOOKS.oldman });
      await say(g, WHO.koenkai, ['いつも応援してるんだからさ。', '区の仕事が、うちの会社に回るよう、\n役所に口をきいてくれないか。お礼はするよ。']);
      const k = await ask(g, null, '（口利きの見返りにお金をもらうのは、犯罪だ）', ['口利きは断る', '引き受ける']);
      if (k === 0) {
        await narr(g, ['（「それは、できません」とはっきり断った）', '（有力者は、不機嫌そうに帰っていった。\n次の選挙では、応援してもらえないかもしれない）']);
        polNudge(g, { local: -3, rep: 1 });
        return { pick: 'refuse' };
      }
      const r = await commit(g, crime, { amount: amt, request: true, gain: { money: amt }, where: '議員事務所' });
      d.story.bribe = st.day;
      if (!r.caught) await narr(g, `（役所の担当者に、それとなく話をした。\n後日、封筒で${fmtMoney(amt)}が届いた…）`);
      return { pick: 'take', caught: !!r.caught };
    },
  },
  pol_benbi: {
    name: '業者からの催促', cat: 'corruption', where: 'any', story: true,
    ok: (g, c) => !!c.office,
    async run(g, c, data, open) {
      const st = g.state;
      const S = open('phone', { title: 'くろがね建設からの電話', who: LK.shacho, rightBg: '#e8dfc8', rightFloor: '#cdbf86' });
      // 国土交通省 from 2001-01 (before: 建設省)
      await say(g, WHO.shacho, ['先生、例の件ですが…。', `${c.year >= 2001 ? '国交省' : '建設省'}の担当の方に、そろそろ\nひと声かけていただけませんか。`]);
      const k = await ask(g, null, '（約束を果たせば、罪をかさねることになる…）', ['できないと断る', '役所に口をきく']);
      if (k === 0) {
        await say(g, WHO.shacho, '…お金だけ受け取って、それですか。\nまあ、いいでしょう。覚えておきますよ。');
        g.addNeed('stress', 10);
        return { pick: 'refuse' };
      }
      const crime = CRIMES.assen && (!CRIMES.assen.exists || CRIMES.assen.exists(g)) ? 'assen' : 'bribery_take';
      const fee = 1000000;
      const r = await commit(g, crime, { amount: fee, request: true, gain: { money: fee }, where: '議員会館' });
      if (!r.caught) await narr(g, `（役所の幹部に電話を一本かけた。\n…数日後、「成功報酬」として${fmtMoney(fee)}が届いた）`);
      return { pick: 'kuchiki', caught: !!r.caught };
    },
  },
  pol_kickback: {
    name: 'パーティー券の不記載のすすめ', cat: 'corruption', where: 'any', weight: 1, cool: 80,
    ok: (g, c) => !!(c.national && c.me && c.me.faction && c.party && !c.realParty),
    async run(g, c, data, open) {
      const amt = 3000000;
      const S = open('office', { title: '派閥の事務所', sub: '事務総長に呼ばれた', who: LK.kanbu, poster: '政策研究会' });
      await say(g, WHO.kanbu, ['パーティー券のノルマを超えた分は、\nそっちの事務所に戻しておく。', `今年は${fmtMoney(amt)}だ。`, '収支報告書には、書かなくていい。\nうちでは、昔からそうしてる。']);
      const k = await ask(g, null, `（書かなければ「不記載」だ。\n${CRIMES.slush_fund.law(g).split('：')[0]}）`, ['全額を報告書に書く', '言われたとおりにする']);
      if (k === 0) {
        await narr(g, ['（「全額、きちんと書かせていただきます」）', '（事務総長は、渋い顔をした。\n派閥の中で、少し浮いてしまったようだ…）']);
        polNudge(g, { standing: -6, rep: 1 });
        return { pick: 'report' };
      }
      try { g.addSecretFunds(amt, 'パーティー券収入のキックバック（不記載）'); } catch (e) { console.error(e); }
      await narr(g, `（${fmtMoney(amt)}を、帳簿にのせずに受け取った。\n…いつか、明るみに出る日が来るかもしれない）`);
      return { pick: 'hide', amount: amt };
    },
  },
  pol_naibu: {
    name: '秘書の内部告発', cat: 'corruption', where: 'any', cool: 40,
    weight: (g, c) => 1.2 + (c.secret > 0 ? 0.6 : 0) + (c.d.story.bribe ? 0.6 : 0),
    // only for money the investigators do not have yet (no second case for the same thing)
    ok: (g, c) => !!c.office && !!naibuCrime(g, c),
    async run(g, c, data, open) {
      const st = g.state;
      const crime = naibuCrime(g, c);
      if (!crime) return { skipped: true };
      const S = open('office', { title: '議員事務所', sub: '秘書が、思いつめた顔で…' });
      await say(g, WHO.secretary, ['先生…もう、黙っていられません。', crime === 'slush_fund' ? '帳簿にのせていないお金のこと、\n検察に話そうと思います。' : 'あの業者からのお金のこと、\n検察に話そうと思います。']);
      const k = await ask(g, null, '（どうする…？）', ['自ら公表して謝る', '口止め料を払う', '秘書を解雇する']);
      if (k === 0) {
        if (crime === 'slush_fund') {
          const amount = correctReport(g);
          S.core('press', { title: '記者会見', sub: '', banner: 'おわびの会見' });
          await narr(g, [`（収支報告書に書いていなかった${fmtMoney(amount)}を公表し、\n訂正した）`, '（「すべて私の責任です」と頭を下げた）']);
          scandalPol(g, 'slush_fund', { amount, severity: 3 });
          return { pick: 'confess', crime };
        }
        await narr(g, ['（弁護士とともに検察庁へ出向き、\nすべてを話すことにした…）', '（捜査機関に知られる前に名乗り出るのが「自首」。\n刑が軽くなることがある――刑法42条）']);
        S.hide();
        await surrender(g, crime);
        return { pick: 'confess', crime };
      }
      if (k === 1) {
        S.hide();
        let ok = false;
        const caught0 = caughtCount(g, 'cover_up');
        try { ok = await g.coverUp(crime, { where: '議員事務所', cost: 1000000 }); } catch (e) { console.error(e); }
        if (ok) { S.ensure(); await narr(g, '（秘書は黙った。…でも、もう目を合わせようとしない）'); return { pick: 'hush', crime, covered: true }; }
        if (!free(g) || caughtCount(g, 'cover_up') > caught0) return { pick: 'hush', crime, covered: false };
        S.ensure();
        await narr(g, '（口止めはできなかった。\n秘書は、そのまま特捜部へ向かった…）');
        S.hide();
        if (crime === 'slush_fund') exposeSecret(g, 4);
        else scandalPol(g, 'bribery', { amount: num(c.heat[crime] && c.heat[crime].amount) });
        await prosecute(g, crime, {});
        return { pick: 'hush', crime, covered: false };
      }
      try { if (num(c.me && c.me.staff) > 0) g.hireStaff(-1); } catch (e) { console.error(e); }
      await narr(g, ['（「明日から、来なくていい」）', '（数日後、元秘書は特捜部に、帳簿の写しを持ちこんだ…）']);
      S.hide();
      if (crime === 'slush_fund') exposeSecret(g, 4);
      else scandalPol(g, 'bribery', { amount: num(c.heat[crime] && c.heat[crime].amount) });
      await prosecute(g, crime, {});
      return { pick: 'fire', crime };
    },
  },
  pol_tokuso: {
    name: '家宅捜索', cat: 'corruption', where: 'any', story: true,
    ok: (g, c, data) => !!c.office && !!(c.heat && c.heat[data.crime || 'slush_fund']) && !caseOpen(g, data.crime || 'slush_fund'),
    async run(g, c, data, open) {
      const crime = data.crime && CRIMES[data.crime] ? data.crime : 'slush_fund';
      const tokuso = c.national || c.level === 'exec';
      const who = tokuso ? { name: '東京地検特捜部の検事', look: WHO.kenji.look } : { name: '警視庁捜査二課の刑事', look: LK.keiji };
      const S = open('office', { title: '事務所', sub: '朝早く、事務所に…', who: who.look });
      g.sfx('buzz');
      await narr(g, ['（朝早く、事務所に段ボール箱を抱えた人たちが\n次々と入ってきた）', `（${tokuso ? '東京地検特捜部' : '警視庁'}の家宅捜索だ――）`]);
      await say(g, who, [`${CRIMES[crime].short}の疑いで、捜索します。`, c.year >= 1995 ? '帳簿とパソコン、手帳を押収させていただきます。' : '帳簿と手帳、書類を押収させていただきます。']);
      const k = await ask(g, null, '（どうする…？）', ['捜査に協力する', '弁護士を呼ぶ', '書類を処分させる']);
      if (k === 2) {
        await narr(g, '（秘書に目くばせした…。\n秘書は、首を横にふった）');
        await say(g, WHO.secretary, '先生…それだけは、できません。\n証拠を隠せば、罪がもっと重くなります。');
        await narr(g, '（証拠を隠すよう頼むことも、罪になりうる。\n…捜査員の目つきが、いっそう厳しくなった）');
        polNudge(g, { standing: -6, rep: -6 });
      } else if (k === 1) await say(g, WHO.lawyer, ['取り調べには、事実だけを話してください。', '黙秘する権利もあります。\n迷ったら、まず私に相談してください。']);
      else await narr(g, '（「すべて、ありのままにお見せします」と答えた）');
      news(g, `${tokuso ? '東京地検特捜部' : '警視庁'}が、${whoIs(g, c)}の事務所を${CRIMES[crime].short}の疑いで家宅捜索。${k === 2 ? '関係者によると、捜索の場で書類の処分を秘書に求めたという。' : ''}`);
      polNudge(g, { rep: -4, local: -3 });
      await narr(g, '（段ボール箱が運び出されていく。\n…これで終わりではないことは、分かっていた）');
      // the search comes first; the arrest (or a summons) follows on another day, as the core queues it
      await prosecute(g, crime, { amount: num(data.amount) || undefined });
      return { pick: ['cooperate', 'lawyer', 'destroy'][k], crime };
    },
  },

  // ---------------------------------------------------------------- 反社
  hansha_offer: {
    name: '闇営業の誘い', cat: 'hansha', where: 'any', weight: 0.9, cool: 45,
    ok: (g, c) => !c.office && c.fame >= 30 && !c.d.story.hanshaDeal,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const amt = 300000;
      const S = open('phone', { title: '久しぶりの電話', who: LK.broker, rightBg: '#3a3436', rightFloor: '#2a2426' });
      await say(g, WHO.broker, ['久しぶり。いい話があるんだ。', 'ある会社の忘年会で、10分ネタをやってくれたら、\nギャラは現金で' + fmtMoney(amt) + '。', '事務所を通さなくていいから、気楽に来てよ。']);
      const k = await ask(g, null, '（事務所を通さない「闇営業」だ…）', [c.agency ? '事務所に相談する' : '主催者を調べてみる', 'きっぱり断る', '引き受ける']);
      if (k === 0) {
        const M = managerOf(c);
        S.set('phone', { title: c.agency ? '事務所' : '調べてみると…', who: M.look, rightBg: '#e8e8f0', rightFloor: '#9a9ea8' });
        await say(g, M, ['主催の会社のこと、調べました。', '登記はあるのに、実体がない。\n反社会的勢力とつながりがある疑いが強いです。', c.agency ? 'よく相談してくれました。\nこういう話は、絶対に受けないでください。' : '関わらないほうがいい。\nこういう話は、断るのがいちばんです。']);
        d.story.hansha = 'checked';
        g.addNeed('stress', -2);
        return { pick: 'check' };
      }
      if (k === 1) {
        await say(g, WHO.broker, '…そっか。もったいないな。\nま、気が変わったら連絡してよ。');
        d.story.hansha = 'refused';
        return { pick: 'refuse' };
      }
      S.set('party', { title: 'ホテルの宴会場', sub: '「感謝の宴」', banner: 'ドット興産　感謝の宴' });
      await say(g, WHO.boss, ['いやあ、テレビで見てるよ！', '今日は楽しんでいってよ。']);
      await narr(g, '（ネタを終えると、会場はわいた。\n…客の何人かは、目つきが鋭い）');
      const k2 = await ask(g, WHO.boss, '記念に、みんなで写真を撮ろう！', ['写真は断る', '一緒に写る']);
      if (k2 === 1) { S.set('party', { title: 'ホテルの宴会場', sub: '記念撮影', banner: 'ドット興産　感謝の宴', flash: true }); g.sfx('shutter'); }
      await commit(g, 'antisocial_ties', { amount: amt, gain: { money: amt }, where: 'ホテルの宴会場' });
      d.story.hanshaDeal = st.day;
      d.story.hanshaPhoto = k2 === 1;
      await narr(g, `（帰りぎわ、封筒で現金${fmtMoney(amt)}を受け取った…）`);
      schedule(g, 'hansha_bust', rint(10, 20), { photo: k2 === 1 });
      return { pick: 'accept', photo: k2 === 1 };
    },
  },
  hansha_bust: {
    name: '闇営業の発覚', cat: 'hansha', where: 'any', story: true,
    async run(g, c, data, open) {
      // what the 会長's company really was, in words of that time (no 特殊詐欺 before 2003)
      const fraud = c.year >= 2003;
      const group = fraud ? `${sagiWord(c.year)}のグループ` : '暴力団の資金源とされる会社';
      news(g, `${group}を摘発。「会長」が開いた宴会には、芸能人も出ていたとみられる。`);
      const S = open('letter', { title: 'ニュース', sub: '摘発', words: fraud ? '詐欺グループを摘発\n「会長」ら逮捕' : '暴力団の関連会社\n「会長」ら逮捕', tv: true });
      await narr(g, ['（ニュースを見て、血の気が引いた。\nあの「感謝の宴」の会長だ…）', fraud ? '（あの会社は、詐欺グループの隠れみのだった）' : '（あの会社は、暴力団の資金源だった）']);
      const c2 = ctxOf(g);
      if ((data.photo || roll(0.5)) && (c2.fame >= 250 || c2.office)) {
        S.hide();
        const r = await EV.scoop_hansha.run(g, ctxOf(g), {}, open);
        return { exposed: true, ...r };
      }
      await narr(g, '（写真は撮られていない。…でも、あの夜のことを\n知っている人は、きっといる）');
      g.addNeed('stress', 12);
      return { exposed: false };
    },
  },
  hansha_recruit: {
    name: '闇バイトの誘い', cat: 'hansha', where: 'any', cool: 25,
    weight: (g, c) => (seenWithin(c.d, ['gamecen'], c.day, 7) ? 1.6 : 0.8),
    // money trouble, or a young person who is not yet well known (never a sitting politician)
    ok: (g, c) => !c.office && c.year >= 1990 && (c.st.money < 10000 || c.yami.length > 0 || (c.age <= 22 && c.fame < 1000)),
    async run(g, c, data, open) {
      const st = g.state;
      const atGame = g.map && g.map.placeId === 'gamecen';
      const modern = c.year >= 2003;
      const crime = modern ? 'fraud_courier' : 'stolen_goods';
      const pay = 50000;
      const senpai = atGame || !modern;
      const S = atGame ? open('arcade', { title: 'ゲームセンター', sub: '先輩に声をかけられた' })
        : senpai ? open('phone', { title: 'ゲーセンの先輩からの電話', who: LK.yankee, rightBg: '#1a1428', rightFloor: '#221a34' })
          : open('phone', { title: c.year >= 2019 ? 'SNSの募集' : 'ケータイの掲示板', sub: '「高額・即日払い」', who: LK.shadow, rightBg: '#1a1a24', rightFloor: '#24242c' });
      const who = senpai ? WHO.yankee : { name: '募集の相手', look: LK.shadow };
      const broke = c.st.money < 10000 || c.yami.length > 0;
      await say(g, who, [broke ? '金に困ってるんだろ？ 楽して稼げるバイトがあるぜ。' : '割のいいバイトがあるんだけど、やらない？', modern ? `荷物を受け取って、渡すだけで${fmtMoney(pay)}。` : `荷物を運ぶだけで${fmtMoney(pay)}。`]);
      const k = await ask(g, null, '（うまい話には、裏がある…）', ['断って立ち去る', '話を聞いてみる']);
      if (k === 0) {
        await narr(g, '（「やめておきます」と言って、その場を離れた）');
        return { pick: 'refuse' };
      }
      await say(g, who, ['身分証の写真を送って。\nあとは、指示どおりに動くだけ。', '…やめたいなんて言ったら、どうなるか分かるよな？']);
      await narr(g, modern ? '（これは、特殊詐欺の「受け子」だ…。\nお年寄りから、お金をだまし取る手伝いだ）' : '（中身は、盗品かもしれない…）');
      const k2 = await ask(g, null, '（どうする…？）', ['断って警察に相談', '引き受ける']);
      if (k2 === 0) {
        S.hide();
        await narr(g, '（怖くなって、警察に相談した）');
        try { await g.policeConsult('threat'); } catch (e) { console.error(e); }
        await narr(g, '（「脅されても、言いなりにならないで。\n本人も家族も、警察が守ります」と言われた）');
        return { pick: 'police' };
      }
      S.hide();
      const r = await commit(g, crime, { amount: modern ? 2000000 : 500000, gain: { money: pay }, where: '駅前の待ち合わせ場所' });
      if (!r.caught && free(g)) await narr(g, `（${fmtMoney(pay)}を受け取った。\n…自分のしたことが、頭から離れない）`);
      return { pick: 'accept', caught: !!r.caught };
    },
  },
  hansha_kyokatsu: {
    name: 'チンピラの恐喝', cat: 'hansha', where: { places: ['kanraku'] }, cool: 15,
    weight: (g, c) => 1.2,
    ok: (g, c) => !!PLACES.kanraku && c.fame >= 30 && seenWithin(c.d, ['kanraku'], c.day, 14),
    async run(g, c, data, open) {
      const st = g.state;
      const amt = round1000(data.amt || 30000);
      const S = open('alley', { title: '路地裏', sub: '呼び止められた' });
      const hey = c.office ? 'おう、議員のセンセイじゃねえか。' : c.fame >= 250 ? 'おう、テレビの人じゃねえか。' : 'おう、見ねえ顔だな。';
      await say(g, WHO.chinpira, [data.again ? 'よう、また会ったな。\nこの前の分じゃ、足りねえんだよ。' : `${hey}\nこの街で遊ぶなら、あいさつってもんがあるだろ。`, `${fmtMoney(amt)}でいいぜ。…払えねえとは言わせねえぞ。`]);
      const k = await ask(g, null, '（これは恐喝だ…）', ['断って交番へ行く', '黙って払う']);
      if (k === 0) {
        S.core('kouban', { title: '交番', sub: '相談' });
        await say(g, WHO.police, ['それは恐喝です。払う必要はありません。', '相手の顔や服装を覚えていますか？\n見回りを強めます。', '何かあったら、ためらわずに110番を。']);
        if (roll(0.6)) schedule(g, 'kyokatsu_caught', rint(3, 8), {});
        return { pick: 'police' };
      }
      g.addMoney(-Math.min(amt, st.money), true);
      await narr(g, '（言われるままに払ってしまった。\n…一度払うと、何度でもたかられる）');
      g.addNeed('stress', 10);
      if (!data.again || roll(0.5)) schedule(g, 'hansha_kyokatsu', rint(4, 8), { again: true, amt: amt * 2 });
      return { pick: 'pay' };
    },
  },
  kyokatsu_caught: {
    name: '恐喝の男の逮捕', cat: 'hansha', passive: true, story: true,
    run(g) { news(g, 'ネオン街で通行人から金を脅し取ろうとした疑いで、暴力団の組員の男を逮捕。'); note(g, '（交番から連絡があった。\nあの男が、恐喝の疑いで逮捕されたという）'); },
  },

  // ---------------------------------------------------------------- 脅迫・襲撃・危機管理
  threat_letter: {
    name: '脅迫', cat: 'threat', luck: true, where: 'any', cool: 45,
    weight: (g, c) => 0.6 + (c.minister ? 0.6 : 0) + (c.fame >= 4000 ? 0.3 : 0),
    ok: (g, c) => c.fame >= 1000 || !!c.office,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const net = !c.office && c.year >= 2005;
      const S = open('letter', { title: c.office ? '事務所に届いた手紙' : net ? 'ネットの書きこみ' : '事務所に届いた手紙', sub: net && !c.office ? '名指しの投稿' : '差出人はない', words: 'おまえを\nゆるさない', screen: net && !c.office ? '匿名の掲示板' : null, bar: '#5a5a66' });
      await narr(g, c.office ? '（事務所に、差出人のない封筒が届いた。\n中には、短い一文だけ――）' : net ? '（ネットに、名指しで危害をくわえると\nほのめかす書きこみがあった――）' : '（事務所に、差出人のない手紙が届いた――）');
      g.addNeed('stress', 6);
      const k = await ask(g, null, '（どうする…？）', ['警察に相談する', '事務所で様子を見る', '気にしない']);
      d.threat = { day: st.day, reported: k === 0, ignored: k === 2 };
      if (k === 0) {
        S.core('kouban', { title: '警察署', sub: '相談窓口' });
        await say(g, WHO.police, ['脅迫の疑いで、捜査します。', '自宅や事務所の周りの見回りを強めます。\n人の多い場所では、気をつけてください。', c.minister ? '大臣の警護も、強化するよう伝えます。' : 'ひとりで抱えこまないでくださいね。']);
        d.guard = Math.max(num(d.guard), st.day + 40);
        if (roll(0.6)) schedule(g, 'threat_caught', rint(8, 20), {});
        return { pick: 'police' };
      }
      if (k === 1) {
        await say(g, managerOf(c), 'しばらく、ひとりで出歩かないでください。\n移動はスタッフがつきそいます。');
        d.guard = Math.max(num(d.guard), st.day + 15);
        return { pick: 'wait' };
      }
      await narr(g, '（いたずらだろう…と、自分に言い聞かせた）');
      return { pick: 'ignore' };
    },
  },
  threat_caught: {
    name: '脅迫の容疑者逮捕', cat: 'threat', passive: true, story: true,
    run(g, c) {
      news(g, `${whoIs(g, c)}に脅迫の文書を送った疑いで、警察は男を逮捕した。男は容疑を認めているという。`);
      g.addNeed('stress', -10);
      note(g, '（脅迫状を送った男が、逮捕されたと連絡があった。\n…ほっとして、力が抜けた）');
    },
  },
  threat_attempt: {
    name: '街頭演説中の襲撃（未遂）', cat: 'threat', moment: 'speech', cool: 120,
    async run(g, c, data, open) {
      const st = g.state, d = c.d;
      const guard = c.guarded || num(d.guard) > st.day;
      const kind = data.kind || d.speechKind || '街頭演説';
      const where = kind === '視察' ? '視察先' : '駅前';
      const S = open('speech', { title: where, sub: kind, sp: guard });
      await narr(g, kind === '地元回り' ? '（駅前で、地元の人たちにあいさつをしていたときだった）' : kind === '視察' ? '（視察先で、集まった人たちにあいさつをしていたときだった）' : '（駅前で、街頭演説をしていたときだった）');
      S.set('speech', { title: where, sub: kind, sp: guard, rush: true });
      g.sfx('buzz'); g.shake(16, 3);
      await narr(g, '（聴衆の中から、男が突然こちらへ駆け寄ってきた――）');
      if (guard) await say(g, WHO.sp, '下がってください！');
      const k = await ask(g, null, '（どうする…！？）', [guard ? 'SPの指示で身を伏せる' : '身を低くして離れる', '聴衆に避難を呼びかける']);
      const injured = data.injured ?? roll((guard ? 0.1 : 0.45) + (k === 1 ? 0.15 : 0));
      await narr(g, guard ? `（SPがすぐに間に入り、男はその場で取り押さえられた）${injured ? '\n（もみ合いの中で、こちらも倒れて体を打った…）' : ''}` : injured ? '（スタッフと警察官が、男を取り押さえた。\nもみ合いの中で、こちらも突き飛ばされて倒れた…）' : '（スタッフと警察官が、すぐに男を取り押さえた）');
      await say(g, WHO.police, ['男はその場で、現行犯逮捕しました。', '動機などについて、くわしく調べています。']);
      const title = c.office && OFFICES[c.office] ? `${OFFICES[c.office].short || '議員'}の` : '立候補している';
      news(g, `【速報】${title}{fullname}氏の${kind === '街頭演説' ? '街頭演説中' : kind === '視察' ? '視察中' : '地元回りの最中'}、男が駆け寄り取り押さえられた。${injured ? '{fullname}氏は軽いけが。' : 'けが人はいない。'}警察が動機を調べている。`);
      if (injured) await hospitalStay(g, S, 2, { injury: '腕と背中を強く打っています', home: false });
      S.core('press', { title: '記者会見', sub: '', banner: '会見' });
      await narr(g, ['（「巻きこまれた方がいなかったことに、まず安堵しています」）', '（「言論の場は、民主主義の土台です。\n暴力で言論を封じることは、決して許されません」）']);
      const k2 = await ask(g, null, '（これからの活動は…）', ['暴力に屈しないと誓う', 'しばらく活動を控える']);
      await narr(g, k2 === 0 ? '（警備を見直したうえで、演説を続けると表明した）' : '（安全が確認できるまで、街頭での活動を控えると表明した）');
      polNudge(g, { rep: k2 === 0 ? 6 : 4, local: 5, mood: c.pm ? 2 : c.minister ? 1 : 0.5 });
      g.addFans(Math.max(20, Math.round(num(st.fans) * 0.03)), true);
      g.addFame(30, true);
      g.addNeed('stress', 18);
      d.guard = Math.max(num(d.guard), st.day + 120);
      d.threat = null;
      news(g, '警察は、要人の街頭演説の警備を見直すと発表。聴衆との距離や、手荷物の確認などを強める。');
      if (c.anyFam) famMsg(g, c.anyFam, 'ニュースを見て、心臓が止まるかと思った{yo}…。\n{you}が無事で、本当によかった。');
      return { injured, pick: k === 0 ? 'duck' : 'evacuate', after: k2 === 0 ? 'continue' : 'pause' };
    },
  },
  crisis_threat: {
    name: 'テロ予告への対応', cat: 'crisis', where: 'any', cool: 60,
    weight: (g, c) => (c.pm ? 1.2 : 0.7),
    ok: (g, c) => !!c.minister,
    async run(g, c, data, open) {
      const st = g.state;
      const ev = 'ドット国際スポーツ大会';
      // 内閣危機管理監 from 1998-04 (before: 内閣安全保障室); a threat on the net only from about 2000
      const modern = c.year > 1998 || (c.year === 1998 && c.month >= 4);
      const net = c.year >= 2000;
      const kanshi = { name: modern ? '内閣危機管理監' : '内閣安全保障室長', look: LK.kanshi };
      const center = modern ? '危機管理センター' : '官邸の対策室';
      if (!c.pm) {
        const S = open('crisis', { title: '官邸　緊急の閣僚会議', sub: 'テロ予告' });
        await say(g, kanshi, [`週末の「${ev}」の会場周辺で、不審な荷物が\n見つかり、${net ? 'ネットに予告の書きこみ' : '新聞社に予告の電話'}がありました。`, '総理のもとで、関係閣僚が対応を協議します。']);
        const k = await ask(g, null, '（大臣として…）', ['所管の対応を急ぐ', '総理の判断を待つ']);
        await narr(g, k === 0 ? '（省の担当者を集め、すぐに警備と情報の連携を指示した）' : '（総理の判断を待った。…動きが遅いという声も出た）');
        polNudge(g, { rep: k === 0 ? 3 : -2 });
        await narr(g, '（不審な荷物は、警察が安全に回収した。\nけが人は、ひとりも出なかった）');
        schedule(g, 'crisis_after', rint(3, 6), {});
        return { pm: false, pick: k === 0 ? 'act' : 'wait' };
      }
      let S = null;
      const kantei = PLACES.kantei && PLACES.kantei.rooms && PLACES.kantei.rooms.crisis;
      const pre = open('phone', { title: '緊急の電話', sub: `${kanshi.name}から`, who: LK.kanshi, rightBg: '#10141e', rightFloor: '#1a1e28' });
      await say(g, kanshi, ['総理、緊急事態です。', `週末に開かれる「${ev}」の会場周辺で、\n不審な荷物が見つかりました。`, net ? 'ネットには、会場をねらうと予告する書きこみも。' : '新聞社には、会場をねらうと予告する電話も。']);
      let went = false, phone = false;
      if (kantei && modern) {
        const k0 = await ask(g, kanshi, '官邸の危機管理センターへ、お願いします。', ['官邸に向かう', '電話で指示する']);
        if (k0 === 0) {
          pre.hide();
          try { await g.goto('kantei', 'crisis'); went = true; } catch (e) { console.error(e); }
        } else phone = true;
      }
      S = went ? null : phone ? pre.set('phone', { title: '電話で指示', sub: `${center}と結んで`, who: LK.kanshi, rightBg: '#10141e', rightFloor: '#1a1e28' }) : pre.set('crisis', { title: center, sub: 'テロ予告への対応' });
      if (went) g.showBanner('首相官邸　危機管理センター');
      await say(g, kanshi, '関係省庁がそろいました。ご指示をお願いします。');
      const a = await ask(g, kanshi, '総理、警戒のレベルは？', ['警戒を最高度に上げる', '警備を強めて様子見']);
      const b = await ask(g, kanshi, '大会と、周辺の交通は？', ['大会を延期し交通規制', '大会は続け警備を増員']);
      const i = await ask(g, kanshi, '国民への説明は？', ['すぐに会見で呼びかける', '捜査のため一部を伏せる']);
      let mood = 0, rep = 0;
      if (a === 0) { mood -= 0.5; rep += 1; } else rep += 0.5;
      if (b === 0) { mood -= 1.5; rep += 1; await narr(g, '（大会は延期、会場周辺の電車と道路を止めた。\n「やりすぎだ」「安全第一だ」――声は分かれた）'); } else await narr(g, '（大会は予定どおり。会場の警備を倍に増やした）');
      const real = roll(0.4);
      await narr(g, real ? '（不審な荷物は、警察が安全に回収した。\nけが人は、ひとりも出なかった）' : '（調べると、不審な荷物は危険なものではなかった。\n予告は、いたずらだった可能性が高い）');
      if (real && a === 1 && b === 1) { mood -= 1.5; await narr(g, '（「警戒が甘かったのでは」という指摘も出た）'); }
      if (i === 0) {
        if (S) S.core('press', { title: '首相官邸　記者会見室', sub: '', banner: '総理大臣　記者会見' });
        await narr(g, ['（「国民のみなさん、どうか落ち着いて行動してください」）', '（「不審な物を見つけたら、触らずに、\nすぐ近くの警察官や駅員に知らせてください」）']);
        mood += 1.5; rep += 2;
      } else if (roll(0.4)) {
        mood -= 2; rep -= 2;
        await narr(g, '（伏せていた情報が、報道で明らかになった。\n「政府は事実を隠した」と批判が出た…）');
      } else mood += 0.5;
      polNudge(g, { mood, rep: Math.round(rep) });
      schedule(g, 'crisis_after', rint(3, 6), {});
      return { pm: true, picks: [a, b, i], real, kantei: went };
    },
  },
  crisis_after: {
    name: '予告の容疑者逮捕', cat: 'crisis', passive: true, story: true,
    run(g, c) { news(g, 'スポーツ大会の会場をねらうと予告した疑いで、警察は男を威力業務妨害の疑いで逮捕。単独の犯行とみている。'); note(g, c.year >= 2000 ? '（予告の書きこみをした男が、逮捕された）' : '（予告の電話をかけた男が、逮捕された）'); },
  },

  // ---------------------------------------------------------------- 借金と破産
  debt_collect: {
    name: '延滞の取り立て', cat: 'debt', where: 'home', weight: 2, cool: 12,
    ok: (g, c) => c.late.length > 0,
    async run(g, c, data, open) {
      const st = g.state;
      const l = c.late[0];
      const S = open('visit', { title: '自宅', sub: `${l.company}の担当者が来た` });
      await say(g, WHO.collector, ['ご返済が、遅れております。', 'このままですと、信用情報に登録され、\n最後は裁判所から支払督促が届くことになります。']);
      await narr(g, '（貸金業者の取り立てにも、法律のルールがある。\n夜9時から朝8時の訪問や、勤務先への押しかけは禁止だ）');
      const k = await ask(g, null, '（どうする…？）', ['返済の相談をする', '弁護士に相談する', '区役所の窓口へ行く']);
      if (k === 0) {
        const idx = c.j.loans.indexOf(l);
        const due = Math.max(2000, round1000(num(l.principal) * 0.05));
        const pay = Math.min(due, st.money);
        let r = null;
        if (pay > 0) { try { r = g.repay(idx >= 0 ? idx : l, pay); } catch (e) { console.error(e); } }
        await narr(g, r && r.paid ? `（${fmtMoney(r.paid)}を返した。残りは${fmtMoney(r.left)}）` : '（いまは、払えるお金がない…）');
        await say(g, WHO.collector, '無理のない返し方を、一緒に考えましょう。\n苦しいときは、専門の窓口もありますよ。');
        return { pick: 'repay', paid: r ? r.paid : 0 };
      }
      S.hide();
      if (k === 2) {
        const soudan = PLACES.kuyakusho && PLACES.kuyakusho.rooms && PLACES.kuyakusho.rooms.soudan;
        await narr(g, c.year >= 2007 ? '（区役所には、借金の悩みを無料で相談できる窓口がある。\n2007年から、全国の自治体に広がった）' : '（区役所の生活相談や、弁護士会の相談窓口がある）');
        if (soudan) {
          try { await g.goto('kuyakusho', 'soudan'); } catch (e) { console.error(e); }
          await narr(g, '（区役所の3階、区民相談室に来た。\n相談員に、話を聞いてもらおう）');
          return { pick: 'kuyakusho' };
        }
      }
      try { await g.consultLawyer('debt'); } catch (e) { console.error(e); }
      return { pick: k === 1 ? 'lawyer' : 'kuyakusho' };
    },
  },
  debt_family: {
    name: '借金を心配する家族', cat: 'debt', where: 'any', noJikka: true, weight: 1.2, cool: 20,
    ok: (g, c) => !!c.anyFam && (c.late.length > 0 || c.yami.length > 0 || num(c.st.rent && c.st.rent.debt) > 0),
    async run(g, c, data, open) {
      const M = c.elder || c.anyFam;
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call });
      await famSay(g, M, ['最近、声が元気ない{ne}…。', 'お金のこと、困ってる{no}？']);
      const k = await famAsk(g, M, '正直に言って{ne}。', ['正直に相談する', '大丈夫とごまかす']);
      if (k === 1) {
        await famSay(g, M, '…そう。何かあったら、いつでも言って{ne}。');
        g.addNeed('stress', 6);
        famAff(g, M, -1);
        return { pick: 'hide' };
      }
      await famSay(g, M, ['話してくれて、ありがとう。\nひとりで抱えこんだら{dameyo}。', '区役所や弁護士さんの無料相談があるって、\nテレビで言ってた{yo}。いっしょに考えよう。']);
      try { sendPackage(g, { member: M, money: 30000, note: false, text: fl('少しだけど、足しにして{ne}。\n困ったら、すぐ相談して{ne}。', M) }); } catch (e) { console.error(e); }
      famAff(g, M, 2);
      g.addNeed('stress', -8);
      const k2 = await ask(g, null, '（家族に背中を押された…）', ['弁護士に相談してみる', 'まず自分で考える']);
      if (k2 === 0) {
        S.hide();
        try { await g.consultLawyer(c.yami.length ? 'yamikin' : 'debt'); } catch (e) { console.error(e); }
      }
      return { pick: 'tell', lawyer: k2 === 0 };
    },
  },
  debt_yamikin_family: {
    name: '闇金が家族に', cat: 'debt', where: 'any', noJikka: true, weight: 2, cool: 15,
    ok: (g, c) => !!c.anyFam && c.yami.some((l) => num(l.harass) >= 2),
    async run(g, c, data, open) {
      const M = c.elder || c.anyFam;
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call });
      g.sfx('buzz');
      await famSay(g, M, ['{you}！ 知らない男の人たちが家に来て、\n「{you}の借金を払え」って…。', '怖くて、玄関を開けられなかった{yo}…。']);
      const k = await famAsk(g, M, 'どうしたら、いい{no}…？', ['警察に相談する', '弁護士に相談する', '自分で払うと言う']);
      if (k === 2) {
        await famSay(g, M, '…無理しないで{ne}。\n{you}の体のほうが、ずっと大事{dap}{kara}。');
        g.addNeed('stress', 12);
        famAff(g, M, -2);
        return { pick: 'pay' };
      }
      await famSay(g, M, k === 0 ? '警察に相談してくれる{no}？ …ありがとう。' : '弁護士さんに…？ そう{ne}、それがいい{yo}。');
      S.hide();
      try { if (k === 0) await g.policeConsult('yamikin'); else await g.consultLawyer('yamikin'); } catch (e) { console.error(e); }
      famAff(g, M, 1);
      return { pick: k === 0 ? 'police' : 'lawyer' };
    },
  },
};
// What the 週刊誌 has on the player: the 闇営業 party, visits to the 組事務所 (kanraku.js), or a meeting
// with someone from that world (the fixer of a もみ消し).
function hanshaSource(g, c) {
  const kan = (c.st.flags && c.st.flags.kanraku) || {};
  if (c.d.story.hanshaDeal) return { id: 'party', head: '反社の宴に出演', photo: '反社会的勢力の宴会に出ていた写真', news: '反社会的勢力の宴会に出演していた', other: LK.boss, sorry: '相手が何者か確かめもせず、宴会に出ました。\n本当に軽率でした' };
  if (kan.kumiTies) return { id: 'kumi', head: '暴力団事務所に出入り', photo: '暴力団の事務所に出入りする写真', news: '暴力団の事務所に出入りしていた', other: LK.chinpira2, sorry: '暴力団の事務所に出入りしていました。\n言い訳はしません' };
  return { id: 'meet', head: '反社の男と密会', photo: '反社会的勢力の人物と会っている写真', news: '反社会的勢力の人物と会っていた', other: LK.broker, sorry: '反社会的勢力の人物と会っていました。\n本当に軽率でした' };
}
// The 反社 story is out. The career consequence goes through the justice core's careerSanction (the
// agency ends the contract, TV drops the player; softer for one who told it first), and the case is
// settled as the core's own 週刊誌 round would settle it — without asking the same question twice.
async function hanshaExposed(g, c, S, { admit, src }) {
  if (!free(g)) return;
  if (admit) {
    S.core('press', { title: '記者会見', sub: '', banner: 'おわびの会見' });
    await narr(g, [`（「${src.sorry}」と、深く頭を下げた）`, '（フラッシュの光が、いつまでも止まなかった）']);
  } else {
    S.set('magazine', { title: MAG, sub: '発売', headline: `{familyname}${c.office ? '議員' : ''}\n${src.head}`, other: src.other, stamp: '発売' });
    await narr(g, '（記事が出た。…説明を求める声が、日に日に大きくなった）');
  }
  news(g, `【${MAG}】${whoIs(g, c)}が、${src.news}ことがわかった。`);
  sanction(g, 3, { crime: 'antisocial_ties', soft: !!admit, force: true });
  try {
    const j = g.jus();
    if (j.heat) delete j.heat.antisocial_ties;
    j.queue = (j.queue || []).filter((e) => !(e && e.crime === 'antisocial_ties' && e.type === 'weekly'));
  } catch (e) { console.error(e); }
  if (c.anyFam) famMsg(g, c.anyFam, admit ? '会見、見た{yo}。正直に話したんだ{ne}。\nつらいだろうけど、いちからやり直そう{ne}。' : '週刊誌のこと、本当な{no}？\n{you}の口から、ちゃんと聞かせて{ne}。');
}
// Did the hidden money come from party tickets (the politics core's secretLog)?
function secretFromParty(c) {
  const log = c.me && Array.isArray(c.me.secretLog) ? c.me.secretLog : [];
  return !log.length || log.some((e) => e && /パーティー/.test(String(e.source || '')));
}
// What the secretary would take to the prosecutors: 裏金, or the contractor's money (収賄・あっせん利得).
function naibuCrime(g, c) {
  if (c.secret > 0 && !caseOpen(g, 'slush_fund', true)) return 'slush_fund';
  if (!c.d.story.bribe || !c.heat) return null;
  for (const id of ['bribery_take', 'assen']) if (c.heat[id] && !caseOpen(g, id, true)) return id;
  return null;
}
// A politician at the center of a 反社 scandal decides whether to stay.
async function politicianResign(g, c, open, why) {
  const p = polOf(g);
  if (!p || !p.me || !p.me.office || !free(g)) return null;
  const S = open('office', { title: '議員事務所', sub: '後援会と党からの電話が鳴りやまない' });
  const k = await ask(g, WHO.secretary, ['先生、党本部から「進退を判断してほしい」と…。', '地元の後援会も、動揺しています。'], ['議員を辞職する', '離党して説明を続ける', '職にとどまる']);
  if (k === 0) {
    try { g.resignOffice(`${why}の責任をとって`); } catch (e) { console.error(e); }
    await narr(g, '（議員辞職願を出した。…けじめをつけるしかなかった）');
  } else if (k === 1) {
    try { if (p.me.party) g.leaveParty({ reason: 'scandal' }); } catch (e) { console.error(e); }
    await narr(g, '（党を離れ、無所属で説明を続けることにした）');
    polNudge(g, { rep: -4 });
  } else {
    await narr(g, '（「職責を果たすことで、おこたえしたい」…\n世間の目は、冷たかった）');
    polNudge(g, { rep: -10, local: -8 });
  }
  return ['resign', 'leave', 'stay'][k];
}
// The common choice of a 週刊誌 scoop about something legal but embarrassing (キャバクラ).
async function scoopChoice(g, c, S, o) {
  const st = g.state;
  const k = await ask(g, null, '（どうする…？）', ['会見で率直に謝る', '事実ではないと否定', '出版社を訴える', 'もみ消しを頼む']);
  if (k === 0) {
    S.core('press', { title: '記者会見', sub: '', banner: 'おわびの会見' });
    await narr(g, ['（「軽率でした。応援してくださる方を\nがっかりさせてしまい、申し訳ありません」）', '（正直に話したことで、騒ぎは数日でおさまった）']);
    sanction(g, 1, { soft: true, force: true });
    if (c.office) scandalPol(g, 'private', { name: `${o.label}の報道`, severity: 1 });
    return { pick: 'apologize' };
  }
  if (k === 1) {
    await narr(g, '（「事実ではありません」とコメントを出した…。\n記事は、写真つきで出た）');
    sanction(g, 1, { force: true });
    if (c.office) scandalPol(g, 'private', { name: `${o.label}の報道`, severity: 1 });
    if (o.truth) schedule(g, 'scoop_second', rint(6, 10), { label: o.label });
    return { pick: 'deny' };
  }
  if (k === 2) {
    await narr(g, '（弁護士を通じて、出版社を名誉毀損で訴えた）');
    money(g, 300000);
    sanction(g, 1, { force: true });
    if (c.office) scandalPol(g, 'private', { name: `${o.label}の報道`, severity: 2 });
    schedule(g, 'scoop_suit', rint(15, 25), { truth: o.truth });
    return { pick: 'sue' };
  }
  const cost = 1000000;
  await say(g, { name: '業界の裏に通じた男', look: LK.broker }, ['記事を止めたい？ 方法はあるよ。', `${fmtMoney(cost)}。出版社に顔のきく人を知ってる。`]);
  const k2 = await ask(g, null, '（裏の人間に頼めば、弱みをにぎられる…）', ['やっぱりやめる', '金を渡す']);
  if (k2 === 0 || st.money < cost) {
    if (k2 === 1) await narr(g, '（お金が足りない…）');
    await narr(g, '（記事は予定どおり出た。\n…正直に話しておけばよかった）');
    sanction(g, 1, { force: true });
    if (c.office) scandalPol(g, 'private', { name: `${o.label}の報道`, severity: 2 });
    return { pick: 'momikeshi_cancel' };
  }
  money(g, cost);
  await commit(g, 'antisocial_ties', { amount: cost, where: '都内の喫茶店' });
  if (roll(0.6)) await narr(g, '（記事は、出なかった。…今のところは）');
  else {
    await narr(g, '（記事は結局、そのまま出た。\nお金だけが、消えていった…）');
    sanction(g, 1, { force: true });
  }
  if (roll(0.5)) schedule(g, 'scoop_momikeshi', rint(20, 40), {});
  return { pick: 'momikeshi' };
}
for (const [id, E] of Object.entries(EV)) E.id = id;

// ======================================================================== running events
async function runEvent(g, id, opts = {}) {
  const E = EV[id];
  if (!E || !g.state) return null;
  const st = g.state, d = D(g);
  const rec = { day: st.day, id, picks: [], follow: !!opts.follow, stages: [] };
  if (!E.passive && !opts.noSlot) d.last = st.day;
  d.counts[id] = num(d.counts[id]) + 1;
  d.lastId[id] = st.day;
  const prev = CUR;
  CUR = rec;
  RUNNING++;
  try {
    const c = ctxOf(g);
    if (E.passive) rec.result = E.run(g, c, opts.data || {}) ?? null;
    else rec.result = (await E.run(g, c, opts.data || {}, (k, o) => makeStage(g, rec, k, o))) ?? null;
  } catch (e) {
    console.error(e);
    rec.error = String((e && e.message) || e);
  } finally {
    CUR = prev;
    RUNNING--;
    // the slot counts from the day the event ended (a stay in hospital or in custody moves it)
    if (!E.passive && !opts.noSlot && g.state === st) d.last = Math.max(num(d.last), num(st.day));
    for (const sc of rec.stages) g.pop(sc);
    delete rec.stages;
    d.log.push(rec);
    while (d.log.length > LOG_MAX) d.log.shift();
  }
  if (!E.passive && g.map && g.map.place && g.top === g.map) { try { g.save(true); } catch (e) { console.error(e); } }
  return rec;
}
function canStart(g) {
  const st = g.state;
  if (!st || !g.map || !g.map.place || RUNNING) return false;
  if (g.busy || g.top !== g.map || g.fade > 0) return false;
  if (g.map.player && g.map.player.moving) return false;
  if (!free(g) || NO_EVENT_PLACES.has(g.map.placeId)) return false;
  return !(D(g).hospUntil > st.day);
}
function whereOk(g, E, pd, how) {
  const d = D(g), st = g.state, pid = g.map.placeId, place = g.map.place;
  if (pd.anywhere) return true;
  const w = E.where || 'any';
  if (w === 'any') return !(E.noJikka && pid === 'jikka');
  if (w === 'town') return how === 'step' && place.kind === 'town' && d.townSteps >= num(pd.steps, 20);
  if (w === 'home_return') return how === 'script' && pid === homePlace(g) && d.awayDay === st.day;
  if (w === 'home') return how === 'script' && pid === homePlace(g);
  if (w && Array.isArray(w.places)) return w.places.includes(pid) && (how === 'script' || (place.kind === 'town' && d.townSteps >= num(pd.steps, 15)));
  return false;
}
function tryRun(g, how) {
  const d = D(g), pd = d.pending;
  if (!pd || !canStart(g)) return false;
  const E = EV[pd.id];
  if (!E) { d.pending = null; return false; }
  if (!whereOk(g, E, pd, how)) return false;
  d.pending = null;
  // what was true in the morning may not be any more (a case opened, a seat lost, a debt paid)
  let still = true;
  try { still = !E.ok || !!E.ok(g, ctxOf(g), pd.data || {}); } catch (e) { console.error(e); still = false; }
  if (!still) return false;
  g.run(() => runEvent(g, pd.id, { data: pd.data || {}, follow: pd.follow }));
  return true;
}
function setPending(g, id, o = {}) {
  const d = D(g);
  d.pending = { id, day: g.state.day, follow: !!o.follow, data: o.data || {}, tries: num(o.tries), steps: rint(12, 40) };
  d.townSteps = 0;
  return d.pending;
}
// The morning decision: a story follow-up that is due, else (after the gap, by chance) a new event.
function decide(g, opts = {}) {
  const st = g.state, d = D(g), day = st.day;
  if (d.pending && !opts.force) return d.pending;
  const c = ctxOf(g);
  const risk = riskOf(g, c);
  d.risk = risk;
  if (!opts.force && day - d.last < 2) return null;
  d.follow.sort((a, b) => a.day - b.day);
  for (let i = 0; i < d.follow.length; i++) {
    const f = d.follow[i];
    if (f.day > day) break;
    const E = EV[f.id];
    if (!E || E.passive) continue;
    let ok = true;
    try { ok = !E.ok || E.ok(g, c, f.data || {}); } catch (e) { console.error(e); ok = false; }
    d.follow.splice(i, 1);
    if (!ok) { i--; continue; }
    return setPending(g, f.id, { follow: true, data: f.data, tries: f.tries });
  }
  if (!opts.force && day - d.last < minGap(risk)) return null;
  if (!opts.force && !roll(dayChance(risk))) return null;
  const pool = [];
  const accBusy = accidentRecent(d, day);
  for (const [id, E] of Object.entries(EV)) {
    if (E.story || E.passive || E.moment) continue;
    if (opts.only && !opts.only.includes(id)) continue;
    if (!opts.ignoreCool && d.lastId[id] && day - d.lastId[id] < (E.cool || 30)) continue;
    if (!opts.ignoreCool && E.cat === 'accident' && accBusy) continue;
    let ok = false;
    try { ok = !E.ok || !!E.ok(g, c, {}); } catch (e) { console.error(e); }
    if (!ok) continue;
    const w = typeof E.weight === 'function' ? num(E.weight(g, c)) : num(E.weight, 1);
    if (w > 0) pool.push([id, w]);
  }
  if (!pool.length) return null;
  let r = rnd() * pool.reduce((a, [, w]) => a + w, 0);
  let id = pool[pool.length - 1][0];
  for (const [k, w] of pool) { r -= w; if (r <= 0) { id = k; break; } }
  // Plain misfortune (a car at the crossing, a fraud call, a stalker, a threat) has nothing to do with
  // the player's choices: it stays at the rate of the player's position. The extra chance a risky
  // life brings is for its own consequences (debts, scoops, offers, 反社).
  const pos = posRisk(c);
  if (!opts.force && EV[id].luck && risk > pos && !roll(dayChance(pos) / dayChance(risk))) return null;
  return setPending(g, id, {});
}
// News-only follow-ups arrive in the morning (they take no slot).
function passiveFollowups(g) {
  const d = D(g), day = g.state.day;
  for (let i = 0; i < d.follow.length; i++) {
    const f = d.follow[i];
    const E = EV[f.id];
    if (!E || !E.passive || f.day > day) continue;
    d.follow.splice(i--, 1);
    const rec = { day, id: f.id, picks: [], passive: true };
    try { rec.result = E.run(g, ctxOf(g), f.data || {}) ?? null; } catch (e) { console.error(e); rec.error = String(e); }
    d.lastId[f.id] = day;
    d.counts[f.id] = num(d.counts[f.id]) + 1;
    d.log.push(rec);
  }
  while (d.log.length > LOG_MAX) d.log.shift();
}
// SP（警護官）: assigned while the player is the PM or a minister.
function spCheck(g) {
  const d = D(g), c = ctxOf(g);
  if (c.minister && !d.sp) {
    d.sp = g.state.day;
    g.message({ from: '警視庁 警備部', kind: 'news', text: g.fmt(c.pm ? '総理大臣の就任にともない、警視庁の警護官（SP）が\n身辺の警護にあたります。' : '国務大臣の就任にともない、警視庁の警護官（SP）が\n身辺の警護にあたります。') });
    note(g, '（大臣になり、SP（警護官）がつくようになった）');
  } else if (!c.minister && d.sp) {
    d.sp = 0;
    note(g, '（大臣を退き、SPの警護がはずれた）');
  }
}
// Is there room for a dark event right now (moments)? Not twice a day, and some days apart.
function slotFree(g, gapDays = 3) {
  const d = D(g), day = g.state.day;
  return d.last !== day && day - d.last >= gapDays && !(d.hospUntil > day) && free(g);
}
function startMoment(g, id) {
  const E = EV[id], c = ctxOf(g), d = D(g);
  if (!E || (d.lastId[id] && c.day - d.lastId[id] < (E.cool || 30))) return false;
  if (E.cat === 'accident' && accidentRecent(d, c.day)) return false;
  if (E.ok && !E.ok(g, c, {})) return false;
  if (!canStart(g)) return false;
  g.run(() => runEvent(g, id, {}));
  return true;
}
function momentChecks(g) {
  const st = g.state, d = D(g), pid = g.map.placeId, place = g.map.place;
  const jobs = num(st.stats && st.stats.jobs);
  if (d.jobs < 0 || jobs < d.jobs) d.jobs = jobs;
  if (jobs > d.jobs) {
    d.jobs = jobs;
    if (place.kind !== 'town' && pid !== homePlace(g) && slotFree(g)) {
      const p = 0.02 * (st.life && st.life.stress >= 70 ? 1.5 : 1) * (st.stamina < st.maxStamina * 0.25 ? 1.5 : 1);
      if (roll(p) && startMoment(g, 'acc_stage')) return true;
    }
  }
  if (d.speech === st.day && d.speechSeen !== st.day) {
    d.speechSeen = st.day;
    const c = ctxOf(g);
    if (slotFree(g)) {
      const threat = d.threat && st.day - num(d.threat.day) <= 60;
      let p = 0.012 * (d.speechKind && d.speechKind !== '街頭演説' ? 0.5 : 1) * (c.pm ? 3 : c.minister ? 2 : 1) * (threat ? 3 : 1) * (threat && d.threat.ignored ? 2 : 1) * (c.guarded ? 0.5 : 1);
      if (roll(p) && startMoment(g, 'threat_attempt')) return true;
    }
  }
  return false;
}
// What the player passes through (for the risk and the scoops): place → the day last seen.
function observe(g) {
  const d = D(g), pid = g.map.placeId, day = g.state.day;
  if (!pid) return;
  d.seen[pid] = day;
  if (pid !== homePlace(g) && g.map.place && g.map.place.kind !== undefined) d.awayDay = day;
}

// ======================================================================== hooks into the game
const proto = Game.prototype;
const wrap = (name, make) => {
  const orig = proto[name];
  if (typeof orig !== 'function' || orig.__dark) return;
  const w = make(orig);
  w.__dark = true;
  proto[name] = w;
};
// When a script ends and the player is free again: note the place, check the moments, run a pending event.
wrap('afterScript', (orig) => function () {
  const r = orig.call(this);
  try {
    if (this.state && this.map && this.map.place && !RUNNING) {
      observe(this);
      if (!this.busy && !momentChecks(this) && !this.busy) tryRun(this, 'script');
    }
  } catch (e) { console.error(e); }
  return r;
});
// Steps in a town: street events (an accident, a crime seen) wait for the player to walk a little.
wrap('onWalkStep', (orig) => function () {
  const r = orig.call(this);
  try {
    if (this.state && this.map && this.map.place && !RUNNING) {
      const d = D(this);
      if (d.pending) {
        if (this.map.place.kind === 'town') d.townSteps++;
        const E = EV[d.pending.id];
        if (E && (E.where === 'town' || (E.where && E.where.places)) && !this._darkWait) waitFree(this, 40);
      }
    }
  } catch (e) { console.error(e); }
  return r;
});
function waitFree(g, tries) {
  g._darkWait = true;
  g.wait(16).then(() => {
    try {
      if (tryRun(g, 'step') || tries <= 0 || !D(g).pending || g.busy) { g._darkWait = false; return; }
      waitFree(g, tries - 1);
    } catch (e) { console.error(e); g._darkWait = false; }
  });
}
// A 街頭演説 (politics core) is a moment the player stands in front of a crowd.
wrap('campaign', (orig) => async function (action, opts) {
  const r = await orig.call(this, action, opts);
  try { if (r && r.ok && action === '街頭演説' && this.state) { const d = D(this); d.speech = this.state.day; d.speechKind = action; } } catch (e) { console.error(e); }
  return r;
});
// Outside an election, a politician also stands in front of people: 地元回り and 視察 (politics core activities).
wrap('activity', (orig) => function (kind, opts) {
  const r = orig.call(this, kind, opts);
  const mark = (res) => {
    try { if (res && res.ok && (kind === '地元回り' || kind === '視察') && this.state) { const d = D(this); d.speech = this.state.day; d.speechKind = kind; } } catch (e) { console.error(e); }
    return res;
  };
  return r && typeof r.then === 'function' ? r.then(mark) : mark(r);
});

onMorning((g) => {
  const st = g.state;
  if (!st || !st.flags) return;
  const d = D(g);
  if (d.hospUntil > st.day) return;
  if (d.pending && d.pending.day < st.day) {
    const pd = d.pending;
    d.pending = null;
    if (pd.follow && num(pd.tries) < 4) d.follow.push({ id: pd.id, day: st.day + rint(1, 3), data: pd.data, tries: num(pd.tries) + 1 });
  }
  d.townSteps = 0;
  if (!free(g)) return;
  try { spCheck(g); } catch (e) { console.error(e); }
  passiveFollowups(g);
  if (st.day < GRACE) return;
  decide(g);
});

// The justice core: an arrest clears what was waiting; 闇金 at the family's door; legal debts in arrears.
onJustice('arrested', (g, info) => {
  try {
    if (!g || !g.state) return;
    D(g).pending = null;
    // a 自首 (surrender): the case counts it before the prosecutors decide
    if (SURRENDER && info && info.crime === SURRENDER.crime) {
      const cs = (g.jus().cases || []).find((x) => x && x.id === info.caseId);
      if (cs) { cs.remorse = Math.max(num(cs.remorse), 1.5); cs.plea = 'admit'; cs.jishu = 'jishu'; }
    }
  } catch (e) { console.error(e); }
});
onJustice('harassment', (g, info) => {
  try {
    if (!g || !g.state || !info || num(info.level) < 3) return;
    const d = D(g), day = g.state.day;
    if (d.follow.some((f) => f.id === 'debt_yamikin_family') || (d.lastId.debt_yamikin_family && day - d.lastId.debt_yamikin_family < 10)) return;
    if (!famPick(family(g), ['parent', 'grand', 'older', 'younger'])) return;
    d.follow.push({ id: 'debt_yamikin_family', day: day + 1, data: {}, tries: 0 });
  } catch (e) { console.error(e); }
});
onJustice('loan_missed', (g, info) => {
  try {
    if (!g || !g.state || !info || !info.loan || info.loan.lender === 'yamikin' || num(info.missed) < 2) return;
    const d = D(g), day = g.state.day;
    if (d.follow.some((f) => f.id === 'debt_collect') || (d.lastId.debt_collect && day - d.lastId.debt_collect < 10)) return;
    d.follow.push({ id: 'debt_collect', day: day + rint(1, 3), data: {}, tries: 0 });
  } catch (e) { console.error(e); }
});
// The politics core: a new seat brings new "friends"; leaving office ends the SP and the stories.
onPolitics('elected', (g, info) => {
  try {
    if (!g || !g.state || !info || !info.office || info.office === 'party_leader') return;
    if (roll(0.5)) D(g).follow.push({ id: 'pol_offer', day: g.state.day + rint(6, 14), data: {}, tries: 0 });
  } catch (e) { console.error(e); }
});
// A serious money scandal of the player (裏金・収賄が表に出た) may bring a search of the office.
onPolitics('scandal', (g, info) => {
  try {
    if (!g || !g.state || !info || info.who !== 'player' || num(info.severity) < 4) return;
    const crime = info.kind === 'slush_fund' ? 'slush_fund' : info.kind === 'bribery' ? 'bribery_take' : null;
    if (!crime) return;
    const d = D(g), day = g.state.day;
    if (d.follow.some((f) => f.id === 'pol_tokuso') || (d.lastId.pol_tokuso && day - d.lastId.pol_tokuso < 60)) return;
    if (roll(0.5)) d.follow.push({ id: 'pol_tokuso', day: day + rint(4, 10), data: { crime, amount: num(info.amount) }, tries: 0 });
  } catch (e) { console.error(e); }
});
onPolitics('resign', (g, info) => {
  try {
    if (!g || !g.state || !info || info.who !== 'player' || !info.office) return;
    const d = D(g);
    d.follow = d.follow.filter((f) => !['pol_benbi', 'pol_offer'].includes(f.id));
  } catch (e) { console.error(e); }
});

// ======================================================================== API
export const DARK = {
  EVENTS: EV,
  get rng() { return RNG; },
  set rng(fn) { RNG = typeof fn === 'function' ? fn : Math.random; },
  state: (g) => D(g),
  ctx: (g) => ctxOf(g),
  risk: (g) => riskOf(g),
  gap: minGap,
  chance: dayChance,
  decide: (g, opts) => decide(g, opts),
  run: (g, id, opts = {}) => runEvent(g, id, opts),
  schedule: (g, id, inDays, data) => schedule(g, id, inDays, data),
  // run the pending event now, wherever the player is (tests / debug). Resolves with its record.
  async flush(g) {
    const d = D(g), pd = d.pending;
    if (!pd || !EV[pd.id]) return null;
    d.pending = null;
    return runEvent(g, pd.id, { data: pd.data || {}, follow: pd.follow });
  },
  passive: (g) => passiveFollowups(g),
  sp: (g) => spCheck(g),
};
if (typeof window !== 'undefined') window.__dark = DARK;
