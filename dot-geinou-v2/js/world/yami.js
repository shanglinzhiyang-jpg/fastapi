// 現代日本の闇（yami）: the everyday dark side of modern Japan, around the player and the people they know —
// 過労・ブラック労働・パワハラ／セクハラ・芸能界の闇（契約の縛り・干される・噂）・失業（リストラ／派遣切り／早期退職）・
// 貧困（ネットカフェ・生活保護の窓口）・孤独死・介護・いじめ／不登校／ひきこもり・DV・誹謗中傷・カルト・闇バイト・
// 悪質商法と詐欺・薬物（友人の依存）. Realistic and unsentimental; no narrator preaching (in-world people react).
//
// ---------------------------------------------------------------- rules (non-negotiable)
// - Fictional people, companies and groups only (the problem group of govt.js RELIGIOUS_GROUPS is used for the
//   cult when that core is loaded; else a fictional name). Real incidents are never retold.
// - 自殺 only as statistics in the news; deaths of NPCs (過労死, 孤独死) happen off-screen, without detail.
//   Never a player action of self-harm. Sexual matters stay non-explicit (an unwanted hand on a shoulder, a
//   "second bar" invitation, a rumour); every person in such a scene is an adult. Drugs: a friend's
//   dependence in the abstract (no substance detail beyond its name, no method).
// - Every choice has consequences that follow from it (stress, money, ♥, fame, fans), and there are good
//   outcomes (a 労災 recognised, a friend back on stage, a neighbour found in time).
//
// ---------------------------------------------------------------- how events start (low rate)
// - onMorning (after darkside.js's own hook, which loads first): a due arc step first, else (after the gap,
//   by chance) a new event. A new event waits at least NEW_GAP days after the last yami event and SHARED_GAP
//   days after the last darkside event (DARK.state(g).last, read only); nothing is decided while darkside has
//   an event pending, so the two never fire on the same day. At most one arc runs at a time.
// - The chosen event waits in flags.yami.pending for its moment: 'town' (after some steps in a town),
//   'place' (a script ends in a building that is not home: a studio, an agency), 'home_return' (coming home),
//   'any' (when a script ends; arc steps that were missed twice). Unfired events are dropped the next
//   morning (arc steps are retried).
// - Passive steps (a phone message, a news story) arrive in the morning; at most ONE yami message per morning
//   (an arc message, else now and then a news story from the pool NEWS, era-gated).
// - The もしも regime path (dictatorship / war, regime.js): nothing starts (as in darkside).
//
// ---------------------------------------------------------------- API (export YAMI; window.__yami)
//   YAMI.EVENTS, YAMI.NEWS, YAMI.state(g), YAMI.ctx(g), YAMI.decide(g, { force, only }),
//   YAMI.run(g, id, { data }) (async; call inside g.run), YAMI.flush(g) (run the pending event now),
//   YAMI.schedule(g, id, inDays, data), YAMI.news(g, { force, id }), YAMI.rng (replaceable),
//   YAMI.hosare(g) (days left of 干される: career.js sends no new show offers meanwhile).
// State: g.state.flags.yami = { v, last, pending, follow[], log[], counts, lastId, arcs{ key: { step, who,
//   care, start, data, end, outcome } }, newsLast, newsSeen{}, msgDay, townSteps, awayDay, hosareUntil, story{} }
//
// Facts used (checked 2026-10, WebSearch):
//   過労死110番: 1988年6月に弁護士・医師らが開始（厚労省 過労死等防止対策白書）。過労死等防止対策推進法は2014年11月1日施行
//   パワハラ防止法（改正労働施策総合推進法）: 大企業2020年6月1日、中小企業2022年4月1日（rodo.co.jp 122212 ほか）
//   セクハラ: 均等法1997年改正で事業主の配慮義務（1999年4月施行）、2006年改正で措置義務（2007年4月施行）（mhlw.go.jp）
//   年越し派遣村: 2008年12月31日〜2009年1月5日、日比谷公園（約500人が入村）
//   ネットカフェ難民: 厚労省が2007年8月28日に「住居喪失不安定就労者」約5400人と推計（internet.watch 2007/08/28）
//   ワーキングプア: NHKスペシャル（2006年7月）から広まった語
//   配偶者暴力防止法: 2001年10月施行。2014年1月3日から同居する交際相手からの暴力にも準用（gender.go.jp, 大阪府資料）
//   侮辱罪: 2022年7月7日から1年以下の懲役・禁錮又は30万円以下の罰金を追加（時事）
//   自殺者: 1998年から3万人超が続き（〜2011年）、2025年は約1万9千人（1978年以降初めて2万人未満）、小中高生は過去最多
//     （2026年1月の暫定値: 全体19,097人・小中高生532人、秋田魁・nippon.com）
//   不当寄附勧誘防止法: 2022年12月10日成立、2023年1月5日施行（目黒区・堺市）
//   大麻: 改正法で2024年12月12日から「使用」も処罰（麻向法の麻薬に。7年以下）（時事）。検挙は20代が最多（秋田魁 2025）
//   危険ドラッグ: 2014年7月22日に「脱法ドラッグ」から呼称変更（愛知県衛生研究所）
//   ひきこもり: 内閣府 2023年3月公表、15〜64歳で約146万人と推計（三重県・山形県資料）
//   宙に浮いた年金記録 約5000万件（2007年）、ねんきん特別便 2007年12月〜（一橋大 高山）
//   老後2000万円: 金融審議会 市場WG報告書 2019年6月3日（Business Insider）
//   介護離職: 年間約10万人（総務省 就業構造基本調査 2012年、琉球新報）
//   公取委「人材と競争政策に関する検討会」報告書 2018年2月15日（芸能人の移籍制限も独禁法上の問題になりうる）
//   地上げ: 1986〜87年に都心の地価が急騰し、立ち退きを迫る地上げ屋のいやがらせが社会問題に（長谷工総研, weblio）
//   SNS型投資詐欺・ロマンス詐欺: 2024年に被害が急増（警察庁発表、impress watch）
//   匿名・流動型犯罪グループ（トクリュウ）: 警察庁の呼称（警察白書 令和6年版）
//   生活保護法: 申請があれば審査（7条 申請保護の原則）、決定は原則14日以内（24条）

import { Game } from '../engine/game.js';
import { SW, SH, clamp, fmtMoney } from '../engine/util.js';
import { text, measure, panel, COLORS } from '../engine/draw.js';
import { PLACES } from '../engine/map.js';
import { onMorning, PEOPLE, PEOPLE_UI, PHONE_APPS, isKansai } from '../engine/life.js';
import { ageOf, eraOf } from '../engine/profile.js';
import { charSheetHD, LOOKS } from '../engine/sprites.js';
import { AGENCIES } from '../engine/state.js';
import { ensureFamily, FAMILY } from './family.js';

// The government core (optional): the religious groups registry (the problem group plays the cult).
let GOVT = null;
import('../engine/govt.js').then((m) => { GOVT = m; }).catch(() => { GOVT = null; });

// ======================================================================== basics
let RNG = Math.random;
const rnd = () => RNG();
const roll = (p) => rnd() < p;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pickOne = (a) => a[Math.floor(rnd() * a.length)];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const flat = (s) => String(s).replace(/\n/g, '');

const GRACE = 8; // nothing in the first days of a new life
const NEW_GAP = 7; // days between a yami event and the next new one
const SHARED_GAP = 3; // days after a darkside event before a new yami event
const STEP_GAP = 2; // days after any yami event before the next arc step
const DAY_CHANCE = 0.25;
const NEWS_GAP = 6, NEWS_CHANCE = 0.4, NEWS_REPEAT = 150;
const LOG_MAX = 100;
const NO_EVENT_PLACES = new Set(['keisatsu', 'kensatsu', 'saibansho', 'keimusho', 'jikka']);
const PAPER = 'ドット新聞 社会部';
const GEINOU = 'ドット芸能ニュース';

// ======================================================================== state
function blank() {
  return { v: 1, last: 0, pending: null, follow: [], log: [], counts: {}, lastId: {}, arcs: {}, newsLast: 0, newsSeen: {}, msgDay: 0, townSteps: 0, awayDay: 0, hosareUntil: 0, story: {} };
}
function Y(g) {
  const st = g.state;
  const fl = st.flags || (st.flags = {});
  let d = fl.yami;
  if (!d || typeof d !== 'object' || Array.isArray(d)) d = fl.yami = blank();
  if (!d._ok) {
    const b = blank();
    for (const k of Object.keys(b)) if (d[k] === undefined) d[k] = b[k];
    for (const k of ['follow', 'log']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['counts', 'lastId', 'arcs', 'newsSeen', 'story']) if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {};
    d.follow = d.follow.filter((f) => f && typeof f === 'object' && EV[f.id]);
    if (d.pending && (typeof d.pending !== 'object' || !EV[d.pending.id])) d.pending = null;
    for (const k of ['last', 'newsLast', 'msgDay', 'townSteps', 'awayDay', 'hosareUntil']) d[k] = num(d[k]);
    for (const [k, a] of Object.entries(d.arcs)) if (!a || typeof a !== 'object') delete d.arcs[k]; else { a.care = num(a.care); a.step = num(a.step); if (!a.data || typeof a.data !== 'object') a.data = {}; }
    Object.defineProperty(d, '_ok', { value: true, enumerable: false, configurable: true });
  }
  return d;
}
function free(g) { try { return typeof g.isFree === 'function' ? g.isFree() : true; } catch (e) { return true; } }
function regimeQuiet(g) {
  try {
    const r = g && g.state && g.state.regime;
    if (!r || typeof r !== 'object') return false;
    return (r.id && r.id !== 'democracy') || !!(r.war && r.war.phase === 'war');
  } catch (e) { return false; }
}
// darkside.js's state, read only (its public API DARK.state; the flag itself when the module is missing)
function darkState(g) {
  try {
    const D = typeof window !== 'undefined' && window.__dark;
    if (D && typeof D.state === 'function') return D.state(g);
  } catch (e) { /* fall back */ }
  const d = g.state.flags && g.state.flags.darkside;
  return d && typeof d === 'object' ? d : null;
}
function office(g) {
  try { const p = typeof g.pol === 'function' ? g.pol() : null; return (p && p.me && p.me.office) || null; } catch (e) { return null; }
}
function homePlace(g) { try { const h = g.housing(); return (h && h.place) || 'home'; } catch (e) { return 'home'; } }
function family(g) { try { return ensureFamily(g) || []; } catch (e) { console.error(e); return []; } }
const famPick = (list, roles) => { for (const r of roles) { const m = list.find((M) => M && (M.role === r || M.rel === r)); if (m) return m; } return null; };
// The calendar (the politics core's when it is there; else the era's start year + game years).
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
function dateOf(g, day) {
  try {
    if (typeof g.gameDate === 'function') {
      const d = day == null ? g.gameDate() : g.gameDate(day);
      if (d && Number.isFinite(d.year)) return { year: d.year, month: clamp(Math.round(d.month || 1), 1, 12) };
    }
  } catch (e) { /* fall back */ }
  const st = g.state;
  const n = Math.max(0, ((day ?? st.day) || 1) - 1);
  const idx = 3 + Math.floor(n / 10);
  return { year: (ERA_BASE[(st.profile && st.profile.era) || 'reiwa'] ?? 2026) + Math.floor(idx / 12), month: (idx % 12) + 1 };
}
function wareki(year, month) {
  let s;
  if (year >= 2019 && !(year === 2019 && month < 5)) s = `令和${year - 2018 === 1 ? '元' : year - 2018}年`;
  else if (year >= 1989) s = `平成${year - 1988 === 1 ? '元' : year - 1988}年`;
  else s = `昭和${year - 1925}年`;
  return `${s}${month}月`;
}

function ctxOf(g) {
  const st = g.state, d = Y(g), day = st.day;
  const dt = dateOf(g);
  const fam = family(g);
  const h = (() => { try { return g.housing(); } catch (e) { return null; } })();
  return {
    g, st, d, day, year: dt.year, month: dt.month, ym: dt.year * 100 + dt.month, era: (st.profile && st.profile.era) || 'reiwa',
    fame: num(st.fame), fans: num(st.fans), money: num(st.money), age: ageOf(st),
    agency: st.agency && AGENCIES[st.agency] ? AGENCIES[st.agency] : null, office: office(g),
    home: homePlace(g), dotsou: !h || h.id === 'dotsou' || st.housing === 'dotsou', housingName: (h && h.name) || 'ドット荘',
    fam, parent: famPick(fam, ['father', 'mother']), father: famPick(fam, ['father']), grand: famPick(fam, ['grand']),
    grands: fam.filter((M) => M && M.role === 'grand'), sib: famPick(fam, ['older', 'younger']), elder: famPick(fam, ['grand', 'parent']),
    lateGrand: !!(fam.late && fam.late.some((M) => M && M.role === 'grand')),
    summer: dt.month >= 6 && dt.month <= 9, winter: dt.month === 12 || dt.month <= 2,
  };
}
// era words
const phoneWord = (c) => (c.year >= 2010 ? 'スマホ' : c.year >= 1997 ? 'ケータイ' : '電話');
const netAge = (c) => c.year >= 1999; // ネットの掲示板・ブログ・SNS
const hwWord = (c) => (c.year >= 1990 ? 'ハローワーク' : '職安');
const ymOf = (y, m) => y * 100 + m;

// ======================================================================== speakers
const LK = {
  clerk: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#e8eef4', bottom: '#4a5060', tie: '#4a5a7a', glasses: true },
  counselor: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#e8e2d4', bottom: '#5a6a7a', jacket: true, glasses: true },
  gondo: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: '#6a2a3a', bottom: '#2a2a30', jacket: true, tie: '#c8a24a', glasses: 'sun' },
  youngad: { ...LOOKS.ad, hairColor: 'brown', top: '#7a8a6a' },
  bucho: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#3a3a44', bottom: '#3a3a44', jacket: true, tie: '#9a2a2a', glasses: true },
  fujino: { hair: 'long', hairColor: 'black', skin: 'light', top: '#c8d8f0', bottom: '#4a5a8a', skirt: true },
  producer: { ...LOOKS.manager, top: '#4a4a5a', tie: '#2a6a8a' },
  costar1: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#e8a0b8', bottom: '#4a3a5a', skirt: true },
  costar2: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#3a6a5a', bottom: '#2a2a30' },
  shiraishi: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#f4f0e8', bottom: '#8a6a9a', skirt: true },
  shacho: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#2a2a34', bottom: '#2a2a34', jacket: true, tie: '#7a1a2a' },
  lawyer: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#1e1e26', bottom: '#1e1e26', jacket: true, tie: '#c9a227' },
  kijima: { ...LOOKS.oldman, top: '#7a7a6a', bottom: '#4a4a40' },
  kanri: { hair: 'cap', hat: '#3a4a6a', hairColor: 'silver', skin: 'tan', top: '#3a4a6a', bottom: '#3a4a6a' },
  doctor: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#f4f4f4', bottom: '#5a6478', jacket: true, glasses: true },
  police: { hair: 'cap', hat: '#1e2a50', hairColor: 'black', skin: 'fair', top: '#2a3a6a', bottom: '#1e2a50', tie: '#14182a' },
  kisha: { hair: 'cap', hat: '#5a4a3a', hairColor: 'brown', skin: 'tan', top: '#8a7a5a', bottom: '#4a4038' },
  cult: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#f0f0f0', bottom: '#3a4a6a', tie: '#5a8a6a' },
  cultLady: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#f2ece0', bottom: '#6a7a8a', skirt: true },
  jiage: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#d8d8d0', bottom: '#2a2a30', jacket: true, tie: '#7a2a8a', glasses: 'sun' },
  hayase: { ...LOOKS.ad, hairColor: 'brown', top: '#6a7a5a' },
  kazuki: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#5a7a9a', bottom: '#3a3a40' },
  saya: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#9a8ac8', bottom: '#4a4a6a', skirt: true },
  hiroki: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#4a4a40', bottom: '#2a2a30' },
  riku: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#5a8ac8', bottom: '#3a3a48' },
  kenta: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#6a6a72', bottom: '#3a3a44' },
  bossy: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#3a3a40', bottom: '#2a2a30', jacket: true, tie: '#3a5a8a' },
};
const W_ = {
  clerk: { name: '福祉課の職員', look: LK.clerk },
  counselor: { name: '相談員', look: LK.counselor },
  gondo: { name: '司会の権藤', look: LK.gondo },
  youngad: { name: '若手AD', look: LK.youngad },
  bucho: { name: 'スポンサーの部長', look: LK.bucho },
  fujino: { name: '新人女優の藤野さん', look: LK.fujino },
  producer: { name: 'プロデューサー', look: LK.producer },
  costar1: { name: '共演者の女性', look: LK.costar1 },
  costar2: { name: '共演者の男性', look: LK.costar2 },
  lawyer: { name: '弁護士', look: LK.lawyer },
  kijima: { name: 'となりの木島さん', look: LK.kijima },
  doctor: { name: '医師', look: LK.doctor },
  police: { name: '警察官', look: LK.police },
  kisha: { name: '週刊誌の記者', look: LK.kisha },
  jiage: { name: 'ドット不動産開発の男', look: LK.jiage },
};
// The landlady when the player lives at ドット荘 (people.js 'oya'), else the building's manager.
function landlord(g, c) {
  if (c.dotsou && PEOPLE.oya) return { name: PEOPLE.oya.name, look: PEOPLE.oya.look, id: 'oya' };
  return { name: '管理人さん', look: LK.kanri };
}
function managerOf(c) {
  if (c.agency) return { name: `${c.agency.name}のマネージャー`, look: LOOKS.manager };
  return { name: '知り合いのマネージャー', look: LOOKS.manager };
}

// ======================================================================== scenes (native HD backdrops)
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const disc = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2); c.fill(); };
function fig(c, look, x, y, dir = 'down', s = 2, frame = 0) {
  try {
    const sh = charSheetHD(look || {});
    const img = (sh[dir] && sh[dir][frame]) || sh.down[0];
    c.drawImage(img, Math.round(x), Math.round(y), 32 * s, 40 * s);
  } catch (e) { /* sprites optional */ }
}
const playerLook = (g) => (g.state && g.state.look) || LOOKS.player;
const FLOOR_Y = 168;
function wallFloor(c, wall, wallLo, floor, floorLine) {
  R(c, 0, 0, SW, FLOOR_Y, wall);
  R(c, 0, FLOOR_Y - 34, SW, 34, wallLo);
  R(c, 0, FLOOR_Y - 35, SW, 1, '#00000040');
  R(c, 0, FLOOR_Y, SW, SH - FLOOR_Y, floor);
  for (let y = FLOOR_Y + 14; y < SH; y += 18) R(c, 0, y, SW, 1, floorLine);
  for (let x = 0; x < SW; x += 64) R(c, x + ((x / 64) % 2 ? 32 : 0), FLOOR_Y, 1, SH - FLOOR_Y, floorLine);
}
function windowBox(c, x, y, w, h, sky = '#9ccbe8', frame = '#3a3e48') {
  R(c, x - 3, y - 3, w + 6, h + 6, frame);
  R(c, x, y, w, h, sky);
  R(c, x + w / 2 - 1, y, 2, h, frame);
  R(c, x, y + h / 2 - 1, w, 2, frame);
}
function nightCity(c, y, h) {
  const cols = ['#22243a', '#2a2a40', '#1e2032'];
  for (let i = 0; i < 7; i++) {
    const x = i * 96 - 10, top = y + (i % 3) * 12, bh = h - (i % 3) * 12;
    R(c, x, top, 88, bh, cols[i % 3]);
    for (let wy = top + 8; wy < y + h - 10; wy += 14) for (let wx = x + 8; wx < x + 80; wx += 16) R(c, wx, wy, 8, 7, (wx + wy) % 3 ? '#e8c860' : '#3a3a50');
  }
}
function desk(c, x, y, w, col = '#8a6a4a') { R(c, x, y, w, 10, col); R(c, x, y + 10, w, 4, '#00000030'); R(c, x + 6, y + 14, 6, 40, '#5a4a3a'); R(c, x + w - 12, y + 14, 6, 40, '#5a4a3a'); }
function monitor(c, x, y, on = true) { R(c, x, y, 46, 32, '#1e1e24'); R(c, x + 3, y + 3, 40, 26, on ? '#3a6aa8' : '#2a2a30'); R(c, x + 20, y + 32, 6, 6, '#1e1e24'); R(c, x + 12, y + 38, 22, 3, '#1e1e24'); }
function clock(c, x, y, h = 2) {
  disc(c, x, y, 16, '#f4f4f0'); c.strokeStyle = '#2a2a30'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 16, 0, Math.PI * 2); c.stroke();
  const a = ((h % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); c.stroke();
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 13); c.stroke();
}
function papers(c, x, y, n = 4) { for (let i = 0; i < n; i++) R(c, x + (i % 2) * 3, y - i * 4, 30, 4, i % 2 ? '#f4f4ee' : '#e4e4dc'); }
function label(c, s, x, y, size = 12, color = '#2a2a30') { text(c, s, x, y, { size, color, shadow: null }); }

const SCN = {
  // a production office at night: monitors, piles of tapes, the clock at 2
  office(c, t, g, o) {
    wallFloor(c, '#3a4058', '#323850', '#4a4a52', '#3e3e46');
    for (let i = 0; i < 4; i++) { R(c, 60 + i * 150, 6, 70, 6, '#e8f0ff'); c.globalAlpha = 0.08; R(c, 40 + i * 150, 12, 110, 150, '#e8f0ff'); c.globalAlpha = 1; }
    clock(c, 560, 60, o.hour ?? 2);
    R(c, 30, 40, 120, 90, '#2a2e40'); for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) R(c, 36 + k * 16, 46 + r * 20, 12, 16, ['#c83a3a', '#3a6aa8', '#e8c860', '#5a9a5a'][(r + k) % 4]);
    if (o.who) fig(c, o.who, 300, 96, 'down');
    desk(c, 190, 150, 300, '#6a5a4a');
    monitor(c, 218, 112); monitor(c, 380, 112, false);
    papers(c, 440, 148, 6);
    for (let i = 0; i < 3; i++) R(c, 274 + i * 10, 140, 6, 10, '#c8c8c0');
    if (o.sleep) { label(c, 'Z', 350, 112 - ((t >> 3) % 8), 12, '#d8dcf0'); label(c, 'z', 362, 102 - ((t >> 3) % 8), 12, '#d8dcf0'); }
    if (!o.noPlayer) fig(c, playerLook(g), 120, 168, 'right');
  },
  // a TV studio floor: lights, a set, cameras
  studio(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#1a1c26');
    for (let i = 0; i < 6; i++) { R(c, 40 + i * 100, 10, 30, 14, '#3a3c48'); c.globalAlpha = 0.1; R(c, 30 + i * 100, 24, 50, 150, '#fff6c8'); c.globalAlpha = 1; }
    R(c, 70, 48, 500, 120, '#3a5a8a'); R(c, 70, 48, 500, 6, '#5a7ab8'); R(c, 250, 70, 140, 40, '#f2c230'); label(c, 'ドット', 296, 80, 16, '#2a2a30');
    R(c, 0, 168, SW, SH - 168, '#2a2c36');
    for (let x = 0; x < SW; x += 48) R(c, x, 168, 1, SH - 168, '#3a3c46');
    R(c, 520, 150, 40, 30, '#3a3a40'); R(c, 528, 140, 24, 12, '#2a2a30'); R(c, 538, 180, 4, 40, '#3a3a40');
    if (o.left) fig(c, o.left, 200, 112, 'right');
    if (o.right) fig(c, o.right, 300, 112, 'left');
    if (o.papers) papers(c, 270, 196, 3);
    fig(c, playerLook(g), 80, 160, 'right');
  },
  // an izakaya after-party: low tables, mugs, a paper lantern
  izakaya(c, t, g, o) {
    wallFloor(c, '#c8a878', '#a88858', '#8a6a44', '#7a5a36');
    for (let x = 0; x < SW; x += 80) R(c, x, 0, 6, FLOOR_Y - 34, '#8a6a44');
    disc(c, 560, 80, 20, '#e83a2a'); R(c, 548, 66, 24, 4, '#2a2a2a'); R(c, 548, 92, 24, 4, '#2a2a2a'); label(c, '宴', 553, 73, 16, '#fff');
    R(c, 250, 40, 180, 40, '#f4ecd8'); label(c, '本日のおすすめ', 280, 52, 12, '#5a3a2a');
    if (o.a) fig(c, o.a, 240, 112, 'down');
    if (o.b) fig(c, o.b, 300, 112, 'down');
    R(c, 140, 176, 360, 30, '#6a4a2a'); R(c, 140, 176, 360, 4, '#8a6a44');
    for (let i = 0; i < 6; i++) { R(c, 160 + i * 56, 162, 14, 16, '#f2c230'); R(c, 160 + i * 56, 160, 14, 4, '#f8f4e8'); }
    fig(c, playerLook(g), 470, 110, 'left');
  },
  // a dressing room: mirrors with bulbs
  gakuya(c, t, g, o) {
    wallFloor(c, '#e8dcc8', '#d8c8b0', '#9a8a74', '#8a7a64');
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 190;
      R(c, x, 30, 130, 90, '#c8d8e8'); R(c, x + 4, 34, 122, 82, '#dce8f4');
      for (let k = 0; k < 6; k++) { disc(c, x + 10 + k * 22, 26, 4, '#fff6c8'); disc(c, x + 10 + k * 22, 124, 4, '#fff6c8'); }
      R(c, x - 6, 128, 142, 10, '#8a6a4a');
    }
    if (o.a) fig(c, o.a, 160, 110, 'right');
    if (o.b) fig(c, o.b, 230, 110, 'left');
    fig(c, playerLook(g), 450, 120, 'left');
  },
  // the agency's meeting room: a long table, a contract
  agency(c, t, g, o) {
    if (o.lounge) wallFloor(c, '#e8dcc4', '#c8b48c', '#8a3a3a', '#7a3232'); else wallFloor(c, '#e4e6ea', '#d0d4dc', '#b8b0a4', '#a8a094');
    windowBox(c, 420, 40, 170, 80, o.lounge ? '#7aa8d8' : '#a8d0ec');
    if (o.lounge) {
      for (let k = 0; k < 3; k++) { disc(c, 160 + k * 160, 12, 10, '#ffe8a8'); R(c, 159 + k * 160, 0, 2, 4, '#c8a44a'); }
      R(c, 40, 120, 24, 48, '#6a4a2a'); disc(c, 52, 104, 22, '#3a7a4a'); disc(c, 40, 116, 14, '#2f6a3e'); disc(c, 64, 116, 14, '#2f6a3e');
    } else { R(c, 40, 66, 140, 70, '#f4f4f0'); label(c, o.board || '', 60, 74, 12, '#3a3a4a'); for (let k = 0; k < 4; k++) R(c, 56, 96 + k * 10, 108, 3, '#c8ccd4'); }
    if (o.who) fig(c, o.who, 280, 92, 'down');
    if (o.who2) fig(c, o.who2, 200, 92, 'down');
    R(c, 120, 160, 400, 18, '#5a4a3a'); R(c, 120, 160, 400, 4, '#7a6a5a');
    R(c, 290, 150, 40, 12, '#f8f8f4'); R(c, 294, 153, 32, 2, '#9a9aa2'); R(c, 294, 157, 26, 2, '#9a9aa2');
    fig(c, playerLook(g), 290, 180, 'up');
  },
  // a park at night: a bench, a lamp, bags
  park(c, t, g, o) {
    R(c, 0, 0, SW, 140, '#141a30');
    for (let i = 0; i < 30; i++) R(c, (i * 97) % SW, (i * 53) % 110, 2, 2, '#c8d0f0');
    nightCity(c, 60, 80);
    R(c, 0, 140, SW, SH - 140, '#2a3a2a');
    for (let x = 0; x < SW; x += 24) R(c, x, 140, 12, 4, '#3a4a32');
    R(c, 470, 40, 6, 130, '#4a4a52'); disc(c, 473, 40, 12, '#fff2b0'); c.globalAlpha = 0.12; disc(c, 473, 150, 90, '#fff2b0'); c.globalAlpha = 1;
    R(c, 230, 170, 160, 10, '#7a5a3a'); R(c, 230, 150, 160, 8, '#7a5a3a'); R(c, 240, 180, 6, 20, '#3a3a3a'); R(c, 374, 180, 6, 20, '#3a3a3a');
    if (o.bags) { R(c, 400, 176, 26, 24, '#c8a46a'); R(c, 428, 170, 30, 30, '#8a7a9a'); }
    if (o.who) fig(c, o.who, 280, 108, 'down');
    fig(c, playerLook(g), 140, 150, 'right');
  },
  // a net café: rows of booths
  netcafe(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#20222c');
    R(c, 0, 0, SW, 30, '#14161e'); label(c, o.sign || 'インターネット・まんが喫茶', 300, 40, 12, '#ffd23f');
    for (let i = 0; i < 6; i++) {
      const x = 20 + i * 104;
      R(c, x, 50, 96, 130, '#3a3e4c'); R(c, x + 4, 54, 88, 122, '#2a2e3a');
      R(c, x + 30, 70, 36, 24, (i + (t >> 6)) % 3 ? '#3a6aa8' : '#2a4a78');
      R(c, x + 4, 140, 88, 4, '#4a4e5c');
    }
    R(c, 0, 180, SW, SH - 180, '#3a3a44');
    if (o.who) fig(c, o.who, 330, 110, 'left');
    fig(c, playerLook(g), 240, 150, 'right');
  },
  // the ward office's welfare counter
  madoguchi(c, t, g, o) {
    wallFloor(c, '#e8ece8', '#d4dad4', '#b8bcb0', '#a8aca0');
    R(c, 180, 20, 280, 26, '#2a5a8a'); label(c, o.sign || '福祉課　生活保護の相談', 200, 26, 12, '#ffffff');
    R(c, 40, 40, 90, 110, '#f4f4f0'); label(c, 'お知らせ', 56, 48, 12, '#3a3a4a'); for (let k = 0; k < 6; k++) R(c, 50, 70 + k * 12, 70, 3, '#c8ccd4');
    fig(c, o.clerk || LK.clerk, 290, 60, 'down');
    R(c, 150, 120, 340, 40, '#c8b89a'); R(c, 150, 120, 340, 5, '#e0d4bc');
    R(c, 300, 126, 34, 22, '#f8f8f4');
    R(c, 520, 120, 18, 60, '#8a8a92'); for (let k = 0; k < 3; k++) R(c, 540 + k * 26, 150, 22, 30, '#6a7a9a');
    if (o.who) fig(c, o.who, 330, 170, 'up');
    fig(c, playerLook(g), 250, 176, 'up');
  },
  // an apartment corridor: doors, mailboxes (piling papers)
  corridor(c, t, g, o) {
    R(c, 0, 0, SW, 120, o.night ? '#141a30' : '#9cc8ec');
    if (!o.night) R(c, 0, 80, SW, 40, '#c8e0f0');
    R(c, 0, 120, SW, 70, '#c8bca8'); R(c, 0, 120, SW, 6, '#a89c88');
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 150;
      R(c, x, 0, 110, 120, '#d8ccb8'); R(c, x + 20, 10, 50, 110, '#8a6a4a'); disc(c, x + 62, 66, 3, '#e8c860');
      R(c, x + 80, 40, 24, 30, '#9a9aa2'); label(c, `${101 + i}`, x + 82, 44, 12, '#2a2a30');
      if (o.pile && i === 2) for (let k = 0; k < 5; k++) R(c, x + 76 + (k % 2) * 3, 72 + k * 5, 30, 5, k % 2 ? '#f4f4ee' : '#dcdcd4');
    }
    R(c, 0, 190, SW, SH - 190, '#8a8478');
    for (let x = 0; x < SW; x += 40) R(c, x, 190, 1, SH - 190, '#7a7468');
    if (o.who) fig(c, o.who, o.whoX ?? 330, 130, 'left');
    if (o.who2) fig(c, o.who2, 420, 130, 'left');
    fig(c, playerLook(g), 220, 136, 'right');
  },
  // the player's room at night
  room(c, t, g, o) {
    wallFloor(c, o.dark ? '#3a3a4a' : '#e8dcc8', o.dark ? '#323240' : '#d8c8b0', o.dark ? '#5a4a3a' : '#a88a64', o.dark ? '#4a3a2a' : '#98785a');
    windowBox(c, 440, 46, 130, 80, o.dark ? '#141a30' : '#9ccbe8');
    if (o.curtain) { R(c, 434, 40, 142, 92, '#5a4a6a'); for (let x = 444; x < 572; x += 18) R(c, x, 40, 2, 92, '#4a3a5a'); }
    R(c, 60, 100, 120, 70, '#7a6a5a'); R(c, 70, 110, 100, 50, '#2a2a30');
    R(c, 240, 170, 140, 20, '#8a6a4a');
    if (o.food) for (let k = 0; k < 3; k++) { R(c, 260 + k * 30, 160, 20, 12, '#f4f4ee'); R(c, 262 + k * 30, 156, 16, 6, '#3a3a40'); }
    if (o.who) fig(c, o.who, o.whoX ?? 380, 118, 'left');
    fig(c, playerLook(g), o.pX ?? 230, 120, o.who ? 'right' : 'down');
  },
  // a quiet café, two seats
  cafe(c, t, g, o) {
    wallFloor(c, '#d8c4a4', '#c4ac88', '#7a5a3a', '#6a4a2a');
    windowBox(c, 60, 24, 200, 100, o.night ? '#1a2240' : '#a8d4f0', '#5a3a2a');
    R(c, 420, 30, 160, 70, '#3a2a20'); label(c, 'COFFEE', 460, 52, 16, '#f2d8a8');
    R(c, 250, 176, 140, 12, '#5a3a24'); R(c, 314, 188, 12, 40, '#3a2a1a');
    disc(c, 286, 172, 6, '#f4f4ee'); disc(c, 354, 172, 6, '#f4f4ee');
    if (o.who) fig(c, o.who, 360, 112, 'left');
    fig(c, playerLook(g), 216, 112, 'right');
  },
  // a letter on the desk
  letter(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#6a5a4a');
    for (let y = 0; y < SH; y += 22) R(c, 0, y, SW, 2, '#5a4a3a');
    c.save(); c.translate(320, 130); c.rotate(-0.04);
    R(c, -150, -100, 300, 210, '#f8f4e8'); R(c, -150, -100, 300, 4, '#e8e0cc');
    for (let k = 0; k < 9; k++) R(c, -130, -72 + k * 20, 260, 1, '#c8d8e8');
    const lines = o.lines || [];
    lines.forEach((s, i) => label(c, s, -126, -88 + i * 20, 12, '#3a3a5a'));
    c.restore();
    R(c, 500, 200, 90, 60, '#e8b8c8'); R(c, 500, 200, 90, 4, '#c898a8');
  },
  // the phone screen with replies piling up
  sns(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#2a2a34');
    const X = 170;
    R(c, X, 10, 240, 250, '#14141a'); R(c, X + 8, 18, 224, 234, '#f4f4f8');
    R(c, X + 8, 18, 224, 24, o.bar || '#3a8ad0'); label(c, g.fmt(o.app || 'ドッター'), X + 18, 22, 12, '#ffffff');
    label(c, `通知 ${o.count || '999+'}`, X + 152, 22, 12, '#ffffff');
    const rows = o.rows || [];
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const y = 50 + i * 34;
      R(c, X + 16, y, 22, 22, ['#8a8a92', '#a87a6a', '#6a8a7a', '#7a6aa8'][i % 4]);
      R(c, X + 44, y, 180, 28, '#e8e8ee');
      label(c, g.fmt(rows[i]), X + 48, y + 7, 12, '#3a3a48');
    }
    fig(c, playerLook(g), 50, 140, 'right');
  },
  // a weekly magazine on the table (pre-internet eras)
  magazine(c, t, g, o) {
    R(c, 0, 0, SW, SH, '#4a3a2e');
    for (let y = 0; y < SH; y += 22) R(c, 0, y, SW, 2, '#3e2e24');
    c.save(); c.translate(320, 120); c.rotate(0.03);
    R(c, -120, -100, 240, 200, '#f4f0e4'); R(c, -120, -100, 240, 34, '#c8202a');
    label(c, '週刊ドット', -100, -92, 16, '#ffffff');
    label(c, g.fmt(o.head || ''), -108, -50, 12, '#1a1a1a');
    label(c, g.fmt(o.head2 || ''), -108, -30, 12, '#1a1a1a');
    R(c, -108, 0, 90, 80, '#9a9aa2'); for (let k = 0; k < 6; k++) R(c, -10, 4 + k * 12, 110, 3, '#c8c8c0');
    c.restore();
  },
  // a busy street at night (recruiters, invitations)
  street(c, t, g, o) {
    R(c, 0, 0, SW, 130, '#141428');
    nightCity(c, 20, 110);
    for (let i = 0; i < 4; i++) { const on = ((t >> 4) + i) % 6 !== 0; R(c, 30 + i * 160, 60, 80, 22, on ? ['#ff5d8f', '#5fd7ff', '#ffd23f', '#5ee07a'][i] : '#3a3a48'); }
    R(c, 0, 130, SW, SH - 130, '#3a3a44');
    for (let x = 0; x < SW; x += 40) R(c, x, 130, 1, SH - 130, '#4a4a54');
    if (o.who) fig(c, o.who, 330, 140, 'left');
    fig(c, playerLook(g), 240, 146, 'right');
  },
  // a seminar hall with a banner
  hall(c, t, g, o) {
    wallFloor(c, '#f0ece4', '#e0d8cc', '#9a8e7e', '#8a7e6e');
    R(c, 170, 50, 300, 30, '#f8f8f4'); R(c, 170, 50, 300, 4, o.color || '#5a8a6a'); label(c, o.banner || '心をととのえる勉強会', 222, 58, 16, '#3a4a3a');
    fig(c, o.leader || LK.cult, 288, 70, 'down');
    R(c, 260, 120, 120, 40, '#c8bca8'); R(c, 260, 120, 120, 4, '#d8ccb8');
    const looks = [LOOKS.salaryman, LOOKS.mom, LOOKS.oldwoman, LOOKS.clerk, LOOKS.fan];
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) fig(c, looks[(r * 2 + k) % 5], 90 + k * 84 + r * 42, 162 + r * 40, 'up', 1.5);
    fig(c, playerLook(g), 470, 170, 'up');
  },
  // a hospital ward
  hospital(c, t, g, o) {
    wallFloor(c, '#eef2f2', '#d6dee0', '#cfd3cc', '#bfc3bc');
    windowBox(c, 440, 30, 140, 84, '#a8d4f0');
    R(c, 140, 150, 196, 56, '#f4f6f8'); R(c, 140, 150, 196, 6, '#ffffff');
    if (o.patient) fig(c, o.patient, 190, 86, 'down');
    R(c, 150, 158, 180, 46, '#a8c8e8'); R(c, 150, 158, 180, 4, '#c8e0f4');
    R(c, 372, 54, 3, 156, '#9aa0a8'); R(c, 364, 54, 20, 30, '#dceef8');
    if (o.who) fig(c, o.who, 420, 126, 'left');
    fig(c, playerLook(g), 60, 140, 'right');
  },
  // a phone call: the player on the left, the caller on the right
  phone(c, t, g, o) {
    R(c, 0, 0, SW / 2, SH, '#e8dcc8'); R(c, 0, FLOOR_Y, SW / 2, SH - FLOOR_Y, '#a88a64');
    R(c, SW / 2, 0, SW / 2, SH, o.rightBg || '#d8cca0'); R(c, SW / 2, FLOOR_Y, SW / 2, SH - FLOOR_Y, o.rightFloor || '#c8b878');
    for (let x = SW / 2; x < SW; x += 40) R(c, x, FLOOR_Y, 1, SH - FLOOR_Y, '#00000020');
    R(c, SW / 2 - 2, 0, 4, SH, '#1a1f38');
    fig(c, playerLook(g), 120, 110, 'right');
    R(c, 166, 132, 8, 14, '#2a2a30');
    if (o.who) { fig(c, o.who, 440, 110, 'left'); R(c, 446, 132, 8, 14, '#2a2a30'); }
    const pulse = (t >> 3) % 2;
    for (let i = 0; i < 3; i++) { R(c, 200 + i * 14, 120 - i * 6, 3, 10 + i * 12, pulse ? '#ffd23f' : '#c8a83a'); R(c, 420 - i * 14, 120 - i * 6, 3, 10 + i * 12, pulse ? '#ffd23f' : '#c8a83a'); }
    if (o.rightLabel) text(c, o.rightLabel, SW * 0.75, 214, { size: 12, align: 'center', color: '#3a2a1a', shadow: null });
  },
  // the outside of an old wooden apartment (地上げ)
  apart(c, t, g, o) {
    R(c, 0, 0, SW, 110, o.night ? '#141a30' : '#9cc8ec');
    for (let i = 0; i < 3; i++) R(c, 20 + i * 220, 10, 160, 100, '#8a8e9a');
    R(c, 0, 110, SW, 70, '#a8a49a'); for (let x = 0; x < SW; x += 32) for (let y = 110; y < 180; y += 16) R(c, x + ((y / 16) % 2 ? 16 : 0), y, 1, 16, '#8a867c'); for (let y = 126; y < 180; y += 16) R(c, 0, y, SW, 1, '#8a867c');
    R(c, 160, 40, 320, 140, '#b89a72'); R(c, 150, 30, 340, 14, '#5a4a3a');
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { R(c, 180 + k * 76, 56 + r * 60, 50, 40, '#d8ccb0'); R(c, 184 + k * 76, 60 + r * 60, 42, 32, o.night ? '#e8c860' : '#a8c8e0'); }
    R(c, 160, 110, 320, 6, '#5a4a3a');
    R(c, 0, 180, SW, SH - 180, '#9a9488');
    if (o.trash) for (let k = 0; k < 6; k++) R(c, 180 + k * 22, 184 + (k % 2) * 6, 18, 12, ['#6a6a6a', '#8a7a5a', '#4a5a4a'][k % 3]);
    if (o.car) { R(c, 10, 186, 130, 28, '#1a1a1e'); R(c, 32, 170, 76, 18, '#1a1a1e'); R(c, 40, 174, 26, 12, '#3a4458'); R(c, 72, 174, 28, 12, '#3a4458'); disc(c, 34, 214, 9, '#0a0a0c'); disc(c, 116, 214, 9, '#0a0a0c'); }
    if (o.who) fig(c, o.who, 150, 156, 'right');
    if (o.who2) fig(c, o.who2, 250, 156, 'left');
    fig(c, playerLook(g), 340, 160, 'left');
  },
};

class YamiScene {
  constructor(g, kind, opts = {}) { Object.assign(this, { g, kind, opts, t: 0, hd: true, opaque: true, hidesHud: true }); }
  update() { this.t++; }
  draw(ctx, g) {
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
      const d = dateOf(g);
      const lab = `${wareki(d.year, d.month)}　${g.dayLabel()}`;
      const w = measure(ctx, lab, 12) + 20;
      panel(ctx, SW - w - 8, 8, w, 26, { bg: '#1a1f38' });
      text(ctx, lab, SW - w + 2, 14, { size: 12, color: '#d8dcf0' });
    }
  }
}
function makeStage(g, rec, kind, opts = {}) {
  const sc = new YamiScene(g, kind, opts);
  const S = {
    sc,
    set(k, o = {}) { sc.kind = k; sc.opts = o; sc.t = 0; S.ensure(); return S; },
    ensure() { if (!g.scenes.includes(sc)) g.push(sc); return S; },
    hide() { g.pop(sc); return S; },
  };
  rec.stages.push(sc);
  g.push(sc);
  return S;
}

// ======================================================================== dialogue helpers
let CUR = null;
let RUNNING = 0;
const narr = (g, t) => g.say(t);
const say = (g, who, t) => g.say(t, who ? { name: who.name, look: who.look } : {});
async function ask(g, who, t, choices, opts = {}) {
  const i = await g.ask(t, choices, { ...(who ? { name: who.name, look: who.look } : {}), cancel: opts.cancel ?? choices.length - 1 });
  const k = Number.isInteger(i) && i >= 0 && i < choices.length ? i : opts.cancel ?? choices.length - 1;
  if (CUR) CUR.picks.push(choices[k]);
  return k;
}
// choices that may be missing: [[label, key, cond], …] → the key picked
async function askKeys(g, who, t, list, opts = {}) {
  const shown = list.filter((x) => x && x[2] !== false);
  const k = await ask(g, who, t, shown.map((x) => x[0]), { cancel: shown.length - 1, ...opts });
  return shown[k][1];
}
function news(g, t, from = PAPER) { g.message({ from, kind: 'news', text: flat(g.fmt(t)) }); }
const famFill = (s, M) => (M ? FAMILY.fill(s, M) : s);
const famWho = (M) => ({ name: M.call, look: M.look });
function famSay(g, M, lines) { return g.say([].concat(lines).map((l) => famFill(l, M)), famWho(M)); }
function famAsk(g, M, t, choices, opts) { return ask(g, famWho(M), [].concat(t).map((l) => famFill(l, M)), choices, opts); }
function famMsg(g, M, t) {
  if (!M) return;
  const def = PEOPLE[M.pid];
  g.message({ from: def ? def.name : M.call, person: def ? M.pid : undefined, family: M.pid, look: M.look, kind: 'chat', text: flat(g.fmt(famFill(t, M))) });
}
function aff(g, id, n) { try { if (id && PEOPLE[id]) g.addAff(id, n, true); } catch (e) { console.error(e); } }
function famAff(g, M, n) { if (M) aff(g, M.pid, n); }
function money(g, n) { const st = g.state; const t = Math.min(Math.max(0, Math.round(n)), st.money); st.money -= t; return t; }
function stress(g, n) { try { return g.addNeed('stress', n); } catch (e) { return 0; } }
function fame(g, n) { try { g.addFame(n, true); } catch (e) { console.error(e); } }
function fans(g, n) { try { g.addFans(n, true); } catch (e) { console.error(e); } }
function skill(g, k, n) { try { g.addSkill(k, n, true); } catch (e) { console.error(e); } }
function schedule(g, id, inDays, data = {}) { Y(g).follow.push({ id, day: g.state.day + Math.max(1, Math.round(inDays)), data, tries: 0 }); }

// ---------------------------------------------------------------- people of the arcs
// A cast member the player knows (♥1+), or the arc's own fictional person. who: { id?, name, short, look, k (Kansai) }
const FALLBACK = {
  karou: { name: 'ADの早瀬くん', short: '早瀬くん', look: LK.hayase, polite: true },
  hinkon: { name: '養成所の同期 カズキ', short: 'カズキ', look: LK.kazuki },
  dv: { name: '友だちの沙也', short: '沙也', look: LK.saya },
  shitsugyo: null,
};
function castWho(g, id, min = 15) {
  const P = PEOPLE[id];
  if (!P || !g.met(id) || g.aff(id) < min) return null;
  return { id, name: P.name, short: P.short || P.name, look: P.look, k: isKansai(P) };
}
function arcWho(g, key, a) {
  if (a && a.who && a.who !== 'fb' && a.who !== 'fam' && PEOPLE[a.who]) { const P = PEOPLE[a.who]; return { id: a.who, name: P.name, short: P.short || P.name, look: P.look, k: isKansai(P) }; }
  if (a && a.who === 'fam') { const M = family(g).find((x) => x.pid === a.data.pid); return M ? { id: M.pid, fam: M, name: M.call, short: M.call, look: M.look } : null; }
  return FALLBACK[key] ? { ...FALLBACK[key] } : null;
}
// a line in the person's voice: [standard, kansai]
const V = (w, std, kan) => (w && w.k && kan ? kan : std);
function wMsg(g, w, t) {
  if (!w) return;
  if (w.fam) return famMsg(g, w.fam, t);
  g.message({ from: w.name, person: w.id && PEOPLE[w.id] ? w.id : undefined, look: w.look, kind: 'chat', text: flat(g.fmt(t)) });
}
function arc(g, key) { return Y(g).arcs[key] || null; }
const arcActive = (a) => !!a && !a.end;
function activeArcs(g) { return Object.entries(Y(g).arcs).filter(([, a]) => arcActive(a)).map(([k]) => k); }
function startArc(g, key, who, data = {}) {
  const d = Y(g);
  d.arcs[key] = { step: 1, who, care: 0, start: g.state.day, data, end: 0, outcome: null };
  return d.arcs[key];
}
function endArc(g, key, outcome) { const a = arc(g, key); if (a) { a.end = g.state.day; a.outcome = outcome; } }

// ======================================================================== the events
// def: { name, cat, where: 'any'|'town'|'place'|'home_return', weight, cool, ok(g, c, data), story (arc step / follow-up
//        only), passive (morning message only), arc (the arc key a new event starts), run(g, c, data, open) }
const EV = {
  // ================================================================ 過重労働・過労死（arc）
  karou_1: {
    name: '過重労働（ADの徹夜）', cat: 'work', arc: 'karou', where: 'place', weight: 1, cool: 400,
    ok: (g, c) => !c.office && c.fame >= 30 && !arc(g, 'karou'),
    async run(g, c, data, open) {
      const yo = castWho(g, 'yoruno');
      const w = yo || { ...FALLBACK.karou };
      const a = startArc(g, 'karou', yo ? 'yoruno' : 'fb');
      const S = open('office', { title: '編集室', sub: '夜中の2時', who: w.look });
      await narr(g, `（収録のあと、忘れ物を取りに戻ると、\n${w.short}がまだ編集室に残っていた）`);
      await say(g, w, ['あ、{name}さん…。おつかれさまです。\nぼく、今日で4日、家に帰ってないんです。', c.year < 1999
        ? '残業代？ この業界じゃ、だれも気にしてませんよ。\n徹夜は勲章みたいなもんで。'
        : c.year < 2019 ? '編集は、下請けの制作会社の人たちと\nいっしょなんですけど…みんな、残業は\n「つけない」のが当たり前で。サービス残業です。'
          : '働き方改革で、夜10時には「帰る」ことに\nなってるんです。でも仕事は減らないから、\nみんな家やファミレスで続きをやってて。']);
      const k = await ask(g, null, '（目の下に、真っ黒なくまができている…）', ['休むように言う', '差し入れで励ます', '業界はそんなものだ']);
      if (k === 0) {
        await narr(g, '（「体を壊したら、夢も何もないよ」と伝えた）');
        await say(g, w, ['そう…ですよね。\n…明日、思いきって半休とってみます。']);
        a.care += 2; aff(g, w.id, 3);
      } else if (k === 1) {
        money(g, 300);
        await narr(g, '（自販機で、温かい飲み物を買ってきた）');
        await say(g, w, ['ありがとうございます…！\nこれで、朝までいけます！']);
        a.care += 1; aff(g, w.id, 2);
      } else {
        await say(g, w, ['ですよね。…弱音はいて、すみません。\nがんばります。']);
        aff(g, w.id, -1);
      }
      S.hide();
      schedule(g, 'karou_2', rint(5, 8));
      return { pick: ['rest', 'cheer', 'shrug'][k] };
    },
  },
  karou_2: {
    name: '過重労働（先輩が倒れる・連絡）', cat: 'work', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'karou')),
    run(g, c) {
      const a = arc(g, 'karou'), w = arcWho(g, 'karou', a);
      a.step = 2;
      wMsg(g, w, '夜中にすみません。いっしょに番組を作っている制作会社「ドット映像」の坂口さんが、編集室で倒れて、救急車で運ばれました。…まだ意識が戻らないそうです。');
      schedule(g, 'karou_3', rint(2, 3));
    },
  },
  karou_3: {
    name: '過重労働（過労死と労災）', cat: 'work', story: true, where: 'town',
    ok: (g) => arcActive(arc(g, 'karou')),
    async run(g, c, data, open) {
      const a = arc(g, 'karou'), w = arcWho(g, 'karou', a);
      a.step = 3;
      const S = open('cafe', { title: '駅前の喫茶店', sub: `${w.short}と`, who: w.look, night: true });
      await narr(g, `（${w.short}から「少しだけ、会えませんか」と連絡があった）`);
      await say(g, w, ['坂口さん、亡くなりました。\n…まだ32歳でした。', '先月は、ほとんど休みがなかったはずです。\nドット映像の社長は「本人の体調管理の問題」\nだって…。',
        `ご両親は、労災を申請したいそうです。\nでも、勤務の記録がなくて…。\n${c.year >= 1999 ? 'タイムカードは、早く押させられてたから。' : '残業の記録なんて、だれもつけてないから。'}`]);
      const k = await ask(g, null, '（どうする…？）', ['記録を残すよう話す', 'まず自分を守ってと言う', '黙ってうなずく']);
      if (k === 0) {
        await narr(g, [c.year >= 2000
          ? '（パソコンのログや、メールの時刻、\n家族へのメッセージも、働いた時間の\n記録になるらしい。そう伝えた）'
          : '（手帳のメモや、タクシーの領収書も、\n働いた時間の記録になるらしい。そう伝えた）',
        c.ym >= 198806 ? '（弁護士や医師がやっている「過労死110番」\nという電話相談があることも、話した）' : '（労働基準監督署に、相談できることも話した）']);
        await say(g, w, ['ぼく、坂口さんのご家族に伝えてみます。\n…ぼく自身のぶんも、メモをつけておきます。']);
        a.care += 2; a.data.evidence = true; aff(g, w.id, 3);
      } else if (k === 1) {
        await say(g, w, ['…ぼくも、このままじゃ坂口さんと同じだ。\n上に、休みのことを相談してみます。']);
        a.care += 1; aff(g, w.id, 2);
      } else {
        await narr(g, `（何と言えばいいのか、わからなかった。\n${w.short}は、黙って頭を下げて帰っていった）`);
        a.care -= 1;
      }
      stress(g, 8);
      news(g, '番組制作会社の男性スタッフ（32）が、勤務中に倒れて死亡した。直前の数か月は長時間の勤務が続いていたとみられ、遺族は労災の申請を検討している。');
      S.hide();
      schedule(g, 'karou_4', rint(12, 20));
      return { pick: ['evidence', 'selfcare', 'silent'][k] };
    },
  },
  karou_4: {
    name: '過重労働（その後）', cat: 'work', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'karou')),
    run(g, c) {
      const a = arc(g, 'karou'), w = arcWho(g, 'karou', a);
      a.step = 4;
      // 労災認定: the later the era, the better the odds (認定基準 2001: 月100時間 / 2〜6か月平均80時間); records matter
      const nintei = a.data.evidence && roll(c.year >= 2001 ? 0.8 : c.year >= 1995 ? 0.45 : 0.2);
      if (a.care >= 3) {
        wMsg(g, w, nintei ? '坂口さんの労災が、認められました。ご両親が、{name}さんにもお礼を伝えてほしいって。ぼくも、月に4日は必ず休むことにしました。' : '坂口さんの労災は…認められませんでした。「仕事が原因とは言えない」って。でもぼくは、休みをとるようにしています。坂口さんのぶんまで、長くこの仕事を続けたいから。');
        aff(g, w.id, 5); fame(g, 5); skill(g, 'talk', 1);
        if (c.year >= 2019 && !nintei) news(g, 'テレビの制作現場で、ADの勤務時間の上限を守るよう、局と制作会社が見直しを進めている。');
        endArc(g, 'karou', nintei ? 'rosai' : 'rest');
      } else if (a.care >= 1) {
        wMsg(g, w, nintei ? '坂口さんの労災、認められたそうです。…ぼくはまだ毎日終電ですけど、休みの日はちゃんと寝るようにしてます。' : '…ぼくは相変わらず毎日終電です。でも、休みの日だけは、ちゃんと寝るようにしてます。');
        endArc(g, 'karou', 'half');
      } else {
        wMsg(g, w, w.id ? 'ぼく、しばらく休職することになりました。朝、体が動かなくて…。また、連絡します。' : '会社、やめました。しばらく実家に帰ります。…いろいろ、ありがとうございました。');
        aff(g, w.id, -2);
        endArc(g, 'karou', 'burnout');
      }
      if (nintei) news(g, '番組制作会社のスタッフの死亡について、労働基準監督署が長時間労働による労災と認定した。');
    },
  },

  // ================================================================ パワハラ（現場）
  pawahara: {
    name: 'パワハラを目撃（収録現場）', cat: 'work', where: 'place', weight: 1, cool: 90,
    ok: (g, c) => !c.office && c.fame >= 50,
    async run(g, c, data, open) {
      const S = open('studio', { title: '収録スタジオ', sub: '収録の合間', left: LK.gondo, right: LK.youngad, papers: true });
      await narr(g, '（収録の合間。司会の権藤が、\n若いADをスタッフ全員の前で怒鳴りつけていた）');
      await say(g, W_.gondo, ['おまえ、何年この仕事やってんだ！\nカンペひとつ、まともに出せねえのか！', '…もういい。帰れ。\n明日から来なくていいぞ。']);
      await narr(g, '（台本が、床に叩きつけられた。\nだれも、何も言わない）');
      const k = await ask(g, null, '（どうする…？）', ['間に入る', 'あとでADに声をかける', '見て見ぬふり']);
      let res = 'none';
      if (k === 0) {
        await narr(g, '（「権藤さん、収録、再開しませんか」と、\nふたりの間に立った）');
        await say(g, W_.gondo, ['…なんだ、おまえ。\nまあいい。覚えとくぞ。']);
        stress(g, 6);
        res = 'stood';
        g.state.flags.yami.story.gondo = { day: c.day, stood: true };
        schedule(g, 'pawahara_after', rint(7, 14), { stood: true });
      } else if (k === 1) {
        S.set('studio', { title: '収録スタジオ', sub: '廊下で', right: LK.youngad });
        await say(g, W_.youngad, ['…すみません、気をつかわせて。', c.year >= 2001 ? 'あれ、完全にパワハラですよね。\nでも、言ったら干されるのはこっちなんで…。' : 'この業界じゃ、あれが「普通」なんです。\n…ぼくが、慣れるしかないんです。']);
        if (c.ym >= 202006) await narr(g, '（局には、ハラスメントの相談窓口があることを\n伝えた。ADは、小さくうなずいた）');
        stress(g, 2);
        res = 'after';
        schedule(g, 'pawahara_after', rint(7, 14), { stood: false, talked: true });
      } else {
        await narr(g, '（…自分も、何も言えなかった。\n収録は、何事もなかったように再開した）');
        stress(g, 4);
      }
      S.hide();
      return { pick: res };
    },
  },
  pawahara_after: {
    name: 'パワハラのその後', cat: 'work', story: true, passive: true,
    run(g, c, data) {
      if (data.stood) {
        // with a phone camera in every pocket (and the 2020 law), a recording comes out; before, the bully keeps the power
        if (c.year >= 2016 && roll(0.6)) {
          news(g, '司会者の権藤氏が、番組スタッフへの暴言が問題となり、番組を降板した。局は「ハラスメントは許されない」とコメントした。', GEINOU);
          g.message({ from: '若手AD', look: LK.youngad, kind: 'chat', text: flat(g.fmt('あのとき間に入ってくださって、ありがとうございました。スタッフのだれかが録音を局に出したそうです。ぼく、この仕事、続けられそうです。')) });
          fame(g, 10);
          return { out: 'down' };
        }
        fame(g, -15);
        g.message({ from: '若手AD', look: LK.youngad, kind: 'chat', text: flat(g.fmt('このあいだは、ありがとうございました。…{name}さん、権藤さんの番組のキャスティングから外されたみたいで。ぼくのせいです。すみません。')) });
        return { out: 'hosare' };
      }
      g.message({ from: '若手AD', look: LK.youngad, kind: 'chat', text: flat(g.fmt(roll(0.5) ? '先日はありがとうございました。ぼく、別の番組に移れることになりました。…あのとき声をかけてもらえて、救われました。' : 'このあいだは話を聞いてくださって、ありがとうございました。…ぼく、この業界をやめることにしました。いまは、少しほっとしています。')) });
      return { out: 'talked' };
    },
  },

  // ================================================================ セクハラ（打ち上げ）
  sekuhara: {
    name: 'セクハラを目撃（打ち上げ）', cat: 'work', where: 'place', weight: 0.9, cool: 100,
    ok: (g, c) => !c.office && c.fame >= 80,
    async run(g, c, data, open) {
      const S = open('izakaya', { title: 'ドラマの打ち上げ', sub: '居酒屋の座敷', a: LK.bucho, b: LK.fujino });
      await narr(g, '（スポンサーの部長が、新人女優の藤野さん（23）の\n肩に手を回して、離そうとしない）');
      await say(g, W_.bucho, ['このあと、ふたりで二軒目どう？\nきみの次の仕事、口をきいてあげてもいいよ。']);
      await narr(g, '（藤野さんは、笑顔をつくったまま固まっている。\nまわりは、見ないふりをしている）');
      const k = await ask(g, null, '（どうする…？）', ['藤野さんを呼び出す', 'プロデューサーに言う', '気づかないふり']);
      let out;
      if (k === 0) {
        await narr(g, '（「藤野さん、マネージャーさんが呼んでたよ」と\n声をかけて、店の外へ連れ出した）');
        await say(g, W_.fujino, ['…ありがとうございます。\nどうしていいか、わからなくて。', c.year >= 1989 ? 'これって、セクハラですよね。\n…でも、言ったら仕事がなくなるかもって。' : '…この世界って、こういうことも\n笑ってやり過ごさなきゃいけないんでしょうか。']);
        if (roll(0.35)) { fame(g, -10); out = 'helped_cost'; await narr(g, '（部長は、あからさまに不機嫌になった。\n…次の作品に、自分の名前は出ないかもしれない）'); } else out = 'helped';
        stress(g, 4);
        schedule(g, 'sekuhara_after', rint(6, 12), { helped: true });
      } else if (k === 1) {
        if (c.year >= 2007) {
          await say(g, W_.producer, ['…わかった。すぐ部長をタクシーに乗せる。\n局にも、きちんと報告を上げるよ。', '言ってくれて助かった。\n…ほんとうは、こっちが気づくべきだった。']);
          out = 'producer_ok';
          schedule(g, 'sekuhara_after', rint(6, 12), { helped: true });
        } else if (c.year >= 1999) {
          await say(g, W_.producer, ['あ、ああ…。わかった、席を替えさせるよ。\n…ただ、部長には大事なスポンサーなんだ。\nあまりおおごとにはしないでくれ。']);
          out = 'producer_half';
          schedule(g, 'sekuhara_after', rint(6, 12), { helped: true });
        } else {
          await say(g, W_.producer, ['部長のご機嫌をそこねるなよ。\nこの業界は、そういうもんだ。', '藤野も、子どもじゃないんだから。\n…おまえも、もう少し大人になれ。']);
          out = 'producer_no';
          stress(g, 6);
          schedule(g, 'sekuhara_after', rint(6, 12), { helped: false });
        }
      } else {
        await narr(g, '（見ないふりをした。\n…乾杯の声が、やけに大きく聞こえた）');
        stress(g, 5);
        out = 'ignored';
        schedule(g, 'sekuhara_after', rint(6, 12), { helped: false });
      }
      S.hide();
      return { pick: out };
    },
  },
  sekuhara_after: {
    name: 'セクハラのその後', cat: 'work', story: true, passive: true,
    run(g, c, data) {
      if (data.helped) {
        g.message({ from: W_.fujino.name, look: LK.fujino, kind: 'chat', text: flat(g.fmt('このあいだは、本当にありがとうございました。事務所にも話して、あの方との仕事は受けないことになりました。次の舞台、決まったんです。')) });
        return { out: 'ok' };
      }
      g.message({ from: '共演者の女性', look: LK.costar1, kind: 'chat', text: flat(g.fmt('藤野さん、事務所をやめたって。…打ち上げのあと、いろいろあったみたい。わたしも、何もできなかったな。')) });
      stress(g, 4);
      return { out: 'quit' };
    },
  },

  // ================================================================ 枕営業の噂（噂だけ）
  uwasa: {
    name: '芸能界の噂（枕営業の噂）', cat: 'work', where: 'place', weight: 0.8, cool: 120,
    ok: (g, c) => !c.office && c.fame >= 200,
    async run(g, c, data, open) {
      const S = open('gakuya', { title: '楽屋', sub: '本番前', a: LK.costar1, b: LK.costar2 });
      await say(g, W_.costar1, ['ねえ、知ってる？ 主役に大抜擢された\n新人の白石さん、プロデューサーと\n「特別な関係」なんだって。', 'じゃなきゃ、あんな新人が\nいきなり主役なんて、ありえないでしょ？']);
      await say(g, W_.costar2, ['枕ってやつ？\nこの業界、そういう話ばっかりだよな。']);
      const k = await ask(g, null, '（根拠のない噂だ…）', ['根拠あるの？と聞く', '話に乗る', '席を外す']);
      if (k === 0) {
        await say(g, W_.costar1, ['え…まあ、聞いた話だけど。']);
        await narr(g, '（話は、そこで途切れた）');
        schedule(g, 'uwasa_after', rint(8, 14), { pick: 'ask' });
      } else if (k === 1) {
        await narr(g, '（「たしかに、あやしいよね」と、話を合わせた。\n楽屋が、ひとしきり盛り上がった）');
        stress(g, -3);
        schedule(g, 'uwasa_after', rint(8, 14), { pick: 'join' });
      } else {
        await narr(g, '（何も言わずに、楽屋を出た）');
        schedule(g, 'uwasa_after', rint(8, 14), { pick: 'leave' });
      }
      S.hide();
      return { pick: ['ask', 'join', 'leave'][k] };
    },
  },
  uwasa_after: {
    name: '噂のその後', cat: 'work', story: true, passive: true,
    run(g, c, data) {
      const where = netAge(c) ? 'ネットの書きこみ' : '週刊誌の記事';
      if (data.pick !== 'join') news(g, `新人女優・白石さんの主演作が好評。オーディションでは、ほかの候補を大きく引き離していたという。`, GEINOU);
      if (data.pick === 'join') {
        news(g, `白石さんをめぐる根拠のない噂が${where}で広がり、所属事務所が「事実無根」と抗議した。`, GEINOU);
        if (roll(0.3)) {
          fame(g, -40); stress(g, 10);
          g.message({ from: '共演者の男性', look: LK.costar2, kind: 'chat', text: flat(g.fmt('白石さんの噂、楽屋で話してたの、だれかが記者にしゃべったらしい。{name}の名前も出てる。…気をつけたほうがいい。')) });
          return { out: 'traced' };
        }
        stress(g, 4);
        return { out: 'spread' };
      }
      if (data.pick === 'ask') fame(g, 3);
      return { out: 'ok' };
    },
  },

  // ================================================================ 芸能界の圧力・契約の縛り・干される（fictional agency）
  keiyaku: {
    name: '芸能界の圧力（共演NG・干される）', cat: 'work', where: 'place', weight: 0.8, cool: 300,
    ok: (g, c) => !c.office && c.fame >= 600 && !(c.d.hosareUntil > c.day),
    async run(g, c, data, open) {
      const st = g.state, d = Y(g);
      const sen = { name: 'ドットスター・プロの専務', look: LK.shacho };
      const S = open('agency', { title: 'ホテルのラウンジ', sub: '大手芸能プロの専務に呼ばれた', who: LK.shacho, lounge: true });
      await say(g, sen, ['来月の特番、あなたの共演者に\n藤堂さんが入っているそうですね。', '藤堂は、うちを勝手に辞めて独立した人間です。\n…共演は、ご遠慮いただけますよね？', '断るなら、うちのタレントは今後、\nあなたの出る番組には出しません。\n…局も、さぞ困るでしょうね。']);
      const k = await ask(g, null, '（どうする…？）', ['言うとおりにする', 'きっぱり断る', 'プロデューサーに相談']);
      let out;
      const hosare = (days) => { d.hosareUntil = Math.max(d.hosareUntil, st.day + days); fame(g, -30); stress(g, 10); };
      if (k === 0) {
        await narr(g, ['（「共演は、できません」と制作に伝えた）', '（数日後、藤堂さんの出演は「スケジュールの都合」で\nなくなった）']);
        stress(g, 6); out = 'complied';
        schedule(g, 'keiyaku_after', rint(6, 10), { kind: 'complied' });
      } else if (k === 1) {
        await narr(g, '（「だれと共演するかは、自分で決めます」\nと答えた）');
        await say(g, sen, ['…そうですか。\nでは、そのように。']);
        const odds = c.year >= 2019 ? 0.5 : 0.85;
        if (roll(odds)) {
          await narr(g, '（その週から、決まりかけていた仕事の話が、\nひとつ、またひとつと消えていった。\n…「干される」というやつだ）');
          hosare(c.year >= 2019 ? rint(10, 16) : rint(20, 30)); out = 'hosare';
        } else { await narr(g, '（…その後、とくに何も起きなかった。\n脅しだったのかもしれない）'); out = 'nothing'; }
        schedule(g, 'keiyaku_after', rint(12, 20), { kind: 'refused', hosare: out === 'hosare' });
      } else {
        S.set('agency', { title: 'テレビ局の会議室', sub: '番組のプロデューサーに相談', who: LK.producer, board: '特番 会議' });
        if (c.year >= 2019) {
          await say(g, W_.producer, ['うちは、そういう圧力には応じない方針です。\n藤堂さんにも、予定どおり出てもらいます。', '公正取引委員会も、独立したタレントを\n締め出すような圧力には、目を光らせてますから。']);
          out = 'producer_ok';
          schedule(g, 'keiyaku_after', rint(8, 14), { kind: 'producer_ok' });
        } else {
          await say(g, W_.producer, ['…すまない。うちも、あそこのタレントが\nいないと番組が回らないんだ。', '藤堂さんには、こっちから話しておく。\n…悪いな。']);
          stress(g, 6); out = 'producer_gave';
          schedule(g, 'keiyaku_after', rint(6, 10), { kind: 'complied' });
        }
      }
      S.hide();
      return { pick: out };
    },
  },
  keiyaku_after: {
    name: '芸能界の圧力（その後）', cat: 'work', story: true, passive: true,
    run(g, c, data) {
      const todo = { from: '俳優の藤堂', look: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#3a4a5a', bottom: '#2a2a30', jacket: true }, kind: 'chat' };
      if (data.kind === 'complied') {
        news(g, '俳優の藤堂さんが、出演予定だった特番を降板した。所属事務所から独立して以来、テレビの出演が減っているという。', GEINOU);
        stress(g, 3);
        return { out: 'dropped' };
      }
      g.message({ ...todo, text: flat(g.fmt('特番では、ありがとうございました。前の事務所を辞めるとき「2年間はこの芸名を使うな」と言われて、いまは本名で出ています。…それでも、呼んでくれる人がいるんだなって。')) });
      if (data.hosare) {
        g.message({ from: 'ほかの局のプロデューサー', look: LK.producer, kind: 'chat', text: flat(g.fmt('事務所の圧力の話、聞いたよ。うちの番組は、事務所じゃなくて人で選ぶ。…落ち着いたら、出てくれないか。')) });
        fame(g, 15);
      }
      return { out: data.hosare ? 'back' : 'thanks' };
    },
  },

  // ================================================================ 家族の失業（arc）
  shitsugyo_1: {
    name: '家族の失業（リストラ・派遣切り・早期退職）', cat: 'money', arc: 'shitsugyo', where: 'town', weight: 0.9, cool: 400,
    ok: (g, c) => !arc(g, 'shitsugyo') && c.year >= 1992 && ((c.ym >= 200810 && c.ym <= 201012 && !!c.sib) || !!c.parent || !!castWho(g, 'maruyama')),
    async run(g, c, data, open) {
      // which story: 2008-10 → a sibling's 派遣切り; else a parent's リストラ / 早期退職; else 丸山さん
      const haken = c.ym >= 200810 && c.ym <= 201012 && !!c.sib; // 派遣切り: from the autumn of 2008
      const M = haken ? c.sib : c.parent || null;
      const maru = !M ? castWho(g, 'maruyama') : null;
      const kind = haken ? 'haken' : c.year >= 2019 ? 'soki' : 'restra';
      const a = startArc(g, 'shitsugyo', M ? 'fam' : 'maruyama', { pid: M ? M.pid : null, kind });
      const S = open('phone', { title: M ? `${M.call}からの電話` : '丸山さんと', who: (M || maru).look, rightLabel: M ? M.call : '丸山さん', rightBg: '#c8c0a8' });
      if (M && haken) {
        await famSay(g, M, ['派遣の契約、今月いっぱいで切られた{nda}。\n工場、急に「減産」だって。', '寮も、月末までに出なきゃいけない{nda}。\n…次の仕事、ぜんぜんない{yo}。']);
      } else if (M) {
        await famSay(g, M, [kind === 'soki' ? 'じつは、会社で「早期退職」の募集があって{ne}。\n手をあげなかった人は、仕事のない部署に\n回されるらしい{nda}。' : 'じつは、会社から「リストラ」の話があった{nda}。\n辞めないなら、関連会社に出向{dap}って。', 'まだ、ほかの家族には言ってない{nda}。\n…心配かけたくなくて{ne}。']);
      } else {
        await say(g, maru, ['…今日は、ござるは無しで話させてください。', kind === 'soki' ? '会社で、45歳以上に「早期退職」の募集が出ました。\n手をあげない人は、新しくできた「キャリア室」に\n移されるそうです。…仕事のない部屋に。' : '会社で、リストラが始まりました。\n経理の仕事は、もう外に出すんだそうです。', '妻と娘には、まだ言えていません。']);
      }
      const k = await ask(g, null, '（どうする…？）', haken ? ['しばらくうちに来て', '生活費を送る', '実家に帰ったらと言う'] : ['いっしょに考える', 'お金を送る', '会社と戦えと言う']);
      const W = M ? { name: M.call, look: M.look } : maru;
      if (k === 0) {
        if (haken) {
          await narr(g, '（「仕事が決まるまで、うちにおいでよ」と伝えた）');
          stress(g, 4);
        } else {
          await narr(g, [`（退職金の上乗せ、次の仕事、${c.year >= 1992 ? '失業保険（雇用保険）、' : ''}年金のこと…\n話しながら、いっしょにノートにまとめた）`]);
        }
        a.care += 2;
      } else if (k === 1) {
        const amt = 30000;
        const paid = money(g, amt);
        await narr(g, paid >= amt ? `（${fmtMoney(amt)}を送った）` : '（送れるだけのお金を送った）');
        a.care += 1;
      } else if (haken) {
        await narr(g, '（「実家に帰って、ゆっくり探したら」と伝えた）');
        a.care += 0;
      } else {
        await narr(g, c.year >= 2006 ? '（「労働組合や、労働局の相談窓口に話してみたら」\nと伝えた）' : '（「労働組合に、相談してみたら」と伝えた）');
        a.care += 1;
      }
      if (M) { famAff(g, M, k === 2 && haken ? 0 : 2); await famSay(g, M, k === 1 ? 'そんなこと、しなくていい{nda}…。\n…ありがとう{ne}。' : '話したら、少し楽になった{yo}。'); } else { aff(g, 'maruyama', 2); await say(g, W, '…聞いてもらえて、よかったです。'); }
      if (haken && c.ym >= 200811 && c.ym <= 200912) news(g, '景気の急速な悪化で、製造業を中心に派遣社員の契約打ち切り、いわゆる「派遣切り」が相次いでいる。');
      S.hide();
      schedule(g, 'shitsugyo_2', rint(5, 9));
      return { pick: k, kind };
    },
  },
  shitsugyo_2: {
    name: '家族の失業（途中の連絡）', cat: 'money', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'shitsugyo')),
    run(g, c) {
      const a = arc(g, 'shitsugyo'), w = arcWho(g, 'shitsugyo', a) || castWho(g, 'maruyama');
      a.step = 2;
      const kind = a.data.kind;
      if (kind === 'haken') wMsg(g, w, a.care >= 2 ? `${hwWord(c)}、毎日かよっ{teru}。求人の窓口、すごい行列{da}。` : '寮を出た{yo}。今は友だちの部屋に置いてもらっ{teru}。…いつまでもは、いられない{ne}。');
      else if (w && w.fam) wMsg(g, w, a.care >= 2 ? `決めた{yo}。会社は辞める。退職金で少し食いつなぎながら、${hwWord(c)}に通う{yo}。` : 'じつは、まだ家族に言えてない{nda}。毎朝スーツで家を出て、図書館で時間をつぶし{teru}。…情けない{ne}。');
      else wMsg(g, w, a.care >= 2 ? '妻に、ぜんぶ話しました。「生きててくれればいい」と言われました。…次を探します。' : '毎朝スーツで家を出て、公園で時間をつぶしています。…まだ、家族に言えていません。');
      schedule(g, 'shitsugyo_3', rint(8, 14));
    },
  },
  shitsugyo_3: {
    name: '家族の失業（その後）', cat: 'money', story: true, where: 'town',
    ok: (g) => arcActive(arc(g, 'shitsugyo')),
    async run(g, c, data, open) {
      const a = arc(g, 'shitsugyo'), w = arcWho(g, 'shitsugyo', a) || castWho(g, 'maruyama');
      a.step = 3;
      const good = a.care >= 2 ? roll(0.8) : a.care >= 1 ? roll(0.5) : roll(0.25);
      const S = open('phone', { title: w.fam ? `${w.name}からの電話` : '丸山さんからの電話', who: w.look, rightLabel: w.short, rightBg: '#c8c0a8' });
      const kind = a.data.kind;
      if (w.fam) {
        const M = w.fam;
        if (good) await famSay(g, M, kind === 'haken' ? ['仕事、決まった{yo}！ 今度は、正社員の募集{da}。\n給料は前より安いけど…。', 'ちゃんと部屋も借りた{yo}。\n{you}がいてくれて、助かった{yo}。'] : ['次の仕事、決まった{yo}。警備の仕事{da}。\n給料は、前の半分くらい{dap}けど{ne}。', '家族にも、ぜんぶ話した{yo}。\nみんな「よかった」って。']);
        else await famSay(g, M, kind === 'haken' ? ['まだ、仕事は見つからない{nda}…。\n日雇いで、なんとかつない{deru}。'] : ['まだ、次の仕事は見つからない{nda}。\nこの年{dap}と、どこも門前払いで{ne}…。']);
        famAff(g, M, good ? 3 : 0);
      } else {
        if (good) await say(g, w, ['仕事、決まりました。小さな会社の経理です。\n給料は下がりますが、定時に帰れます。', '…これで、週末はずっと撮影所にいられるでござる！']);
        else await say(g, w, ['まだ、次は見つかりません。\n…でも、家族に話せたので、少し気が楽です。']);
        aff(g, 'maruyama', good ? 3 : 1);
      }
      let pick = good ? 'ok' : 'hard';
      if (!good) {
        const k = await ask(g, null, '（何かできることは…）', ['仕送りする', '励ます']);
        if (k === 0) { money(g, 20000); pick = 'send'; if (w.fam) famAff(g, w.fam, 2); }
        else await narr(g, '（「きっと見つかるよ」と伝えた）');
        stress(g, 5);
      }
      S.hide();
      endArc(g, 'shitsugyo', good ? 'job' : 'jobless');
      return { pick };
    },
  },

  // ================================================================ 貧困・ネットカフェ・生活保護の窓口（arc）
  hinkon_1: {
    name: '友だちの貧困（住まいを失う）', cat: 'money', arc: 'hinkon', where: 'town', weight: 1, cool: 400,
    ok: (g, c) => !arc(g, 'hinkon'),
    async run(g, c, data, open) {
      const ji = castWho(g, 'jiro');
      const w = ji || { ...FALLBACK.hinkon };
      const a = startArc(g, 'hinkon', ji ? 'jiro' : 'fb');
      const cafe = c.year >= 2001;
      const S = cafe ? open('netcafe', { title: '駅前の雑居ビル', sub: '夜の11時', who: w.look }) : open('park', { title: '夜の公園', sub: '夜の11時', who: w.look, bags: true });
      await narr(g, cafe ? `（夜の駅前で、大きなリュックを背負った\n${w.short}を見かけた。\nネットカフェのある雑居ビルに入っていく）` : `（夜の公園のベンチに、${w.short}が座っていた。\n足もとには、大きな紙袋がふたつ）`);
      await say(g, w, [V(w, 'あ…見られちゃったか。\nアパート、家賃をためて出されたんだ。', 'あ…見られてもうたか。\nアパート、家賃ためて出されてん。'),
        cafe ? V(w, 'バイトは日雇い。一日働いて、ナイトパックで寝て…\nその繰り返し。住所がないと、ちゃんとした\n仕事の面接も受けられなくてさ。', 'バイトは日雇いや。一日働いて、ナイトパックで寝て…\nその繰り返しや。住所がないと、ちゃんとした\n仕事の面接も受けられへん。')
          : V(w, '日雇いの仕事をしながら、サウナや\n終夜営業の喫茶店で寝てる。\n住所がないと、ちゃんとした仕事も決まらなくて。', '日雇いの仕事しながら、サウナや\n終夜営業の喫茶店で寝とる。\n住所がないと、ちゃんとした仕事も決まらんねん。')]);
      const key = await askKeys(g, null, '（どうする…？）', [
        ['役所の窓口へ行こう', 'madoguchi'], ['お金を貸す', 'lend'], ['大家さんに相談する', 'oya', c.dotsou && !!PEOPLE.oya], ['がんばれと言う', 'shrug'],
      ]);
      if (key === 'madoguchi') {
        await narr(g, '（「生活に困ったら、区役所に相談できる。\nいっしょに行こう」と伝えた）');
        await say(g, w, V(w, '…役所かあ。ひとりじゃ、行く気になれなかった。\nうん。行ってみる。', '…役所かあ。ひとりやったら、よう行かんかった。\nほな、行ってみよか。'));
        a.care += 2;
        schedule(g, 'hinkon_2', rint(1, 3), { go: true });
      } else if (key === 'lend') {
        const amt = 20000;
        const paid = money(g, amt);
        a.data.loan = paid;
        await narr(g, `（${fmtMoney(paid)}を貸した）`);
        await say(g, w, V(w, 'ごめん…。必ず返すから。', 'すまん…。必ず返すからな。'));
        a.care += 1;
        schedule(g, 'hinkon_2', rint(5, 8), { go: false });
      } else if (key === 'oya') {
        S.set('corridor', { title: 'ドット荘', sub: '大家さんの部屋の前', who: PEOPLE.oya.look, whoX: 330, who2: w.look });
        await say(g, { name: PEOPLE.oya.name, look: PEOPLE.oya.look }, ['うちの2階、ひとつ空いてるわよ。\n敷金なんていらないから、まず住むところを\n持ちなさい。お家賃は、仕事が決まってからでいいわ。']);
        await say(g, w, V(w, '…ほんとに、いいんですか。\nありがとうございます…！', '…ほんまに、ええんですか。\nおおきに…ほんま、おおきに…！'));
        aff(g, 'oya', 3);
        a.care += 3; a.data.room = true;
        schedule(g, 'hinkon_3', rint(10, 16));
      } else {
        await say(g, w, V(w, 'だよね。…なんとかするよ。', 'せやな…。なんとかするわ。'));
        schedule(g, 'hinkon_2', rint(5, 8), { go: false });
      }
      aff(g, w.id, key === 'shrug' ? 0 : 2);
      S.hide();
      return { pick: key };
    },
  },
  hinkon_2: {
    name: '生活保護の窓口', cat: 'money', story: true, where: 'town',
    ok: (g) => arcActive(arc(g, 'hinkon')),
    async run(g, c, data, open) {
      const a = arc(g, 'hinkon'), w = arcWho(g, 'hinkon', a);
      a.step = 2;
      if (!data.go) {
        // no visit: a message, and the story goes on as it was left
        wMsg(g, w, V(w, c.year >= 2001 ? 'ナイトパック、また値上がりした。…今週は、日雇いが2日しか入らなかった。' : '今週は、日雇いが2日しか入らなかった。…寒くなってきた。', c.year >= 2001 ? 'ナイトパック、また値上がりしよった。…今週は、日雇いが2日しか入らんかった。' : '今週は、日雇いが2日しか入らんかった。…寒うなってきたわ。'));
        schedule(g, 'hinkon_3', rint(8, 12));
        return { pick: 'msg' };
      }
      const S = open('madoguchi', { title: '区役所 福祉課', sub: `${w.short}といっしょに`, who: w.look });
      await narr(g, `（${w.short}といっしょに、区役所の福祉の窓口に来た）`);
      await say(g, W_.clerk, ['まだお若いですし、働けますよね？\nまずは、' + hwWord(c) + 'でお仕事を探してみては。', 'ご家族に、援助をお願いできませんか？\n…今日のところは、「ご相談」ということで。']);
      await narr(g, '（申請書を、なかなか出してもらえない…）');
      const k = await ask(g, null, `（${w.short}は、うつむいている…）`, ['申請書をくださいと言う', 'あきらめて帰る']);
      if (k === 0) {
        await narr(g, '（「生活保護の申請をします。申請書をください」と、\nはっきり伝えた）');
        await say(g, W_.clerk, ['…わかりました。こちらが申請書です。\n決定までは、原則14日以内です。', c.year >= 2015 ? 'それと、仕事と住まいの相談窓口も\nご案内しておきますね。' : '住まいのことも、担当のケースワーカーと\n相談していきましょう。']);
        await narr(g, '（帰り道、' + w.short + 'が小さく「ありがとう」と言った）');
        a.care += 2;
      } else {
        await say(g, w, V(w, 'もういいよ。…ああいう目で見られるの、\nきついんだ。', 'もうええわ。…ああいう目で見られるの、\nきついねん。'));
        a.care -= 1;
        stress(g, 4);
      }
      aff(g, w.id, 2);
      S.hide();
      schedule(g, 'hinkon_3', rint(10, 16));
      return { pick: k === 0 ? 'apply' : 'gave_up' };
    },
  },
  hinkon_3: {
    name: '友だちの貧困（その後）', cat: 'money', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'hinkon')),
    run(g, c) {
      const a = arc(g, 'hinkon'), w = arcWho(g, 'hinkon', a);
      a.step = 3;
      if (a.care >= 3) {
        wMsg(g, w, V(w, a.data.room ? 'ドット荘に引っ越して、住所ができた。バイトも決まって、来週ライブに出るよ。…見に来てね。' : '保護が決まって、小さい部屋を借りられた。住所ができたら、仕事もすぐ決まった。来週、ライブに出るよ。',
          a.data.room ? 'ドット荘に引っ越して、住所ができたで。バイトも決まって、来週ライブに出るんや。…見に来てや。' : '保護が決まって、小さい部屋借りれたで。住所ができたら、仕事もすぐ決まった。来週、ライブ出るで。'));
        if (a.data.loan) { g.addMoney(a.data.loan, true); }
        aff(g, w.id, 5); skill(g, 'warai', 1);
        endArc(g, 'hinkon', 'home');
      } else if (a.care >= 1) {
        wMsg(g, w, V(w, '日雇いの仕事、少しだけ増えた。まだネットカフェ暮らしだけど、ネタは書いてる。', '日雇い、ちょっとだけ増えたわ。まだ部屋はないけど、ネタは書いとるで。'));
        endArc(g, 'hinkon', 'half');
      } else {
        wMsg(g, w, V(w, '日雇いの現場で、腰を痛めちゃった。しばらく芸はお休み。…大丈夫、なんとかする。', '日雇いの現場で、腰いわしてもうた。しばらく芸はお休みや。…大丈夫、なんとかするわ。'));
        aff(g, w.id, -1);
        endArc(g, 'hinkon', 'worse');
      }
    },
  },

  // ================================================================ 孤独死（となりの部屋, arc）
  kodoku_1: {
    name: 'となりの部屋のお年寄り', cat: 'money', arc: 'kodoku', where: 'home_return', weight: 0.9, cool: 400,
    ok: (g, c) => !arc(g, 'kodoku'),
    async run(g, c, data, open) {
      const a = startArc(g, 'kodoku', 'fb');
      const S = open('corridor', { title: c.housingName, sub: '部屋の前の廊下', who: LK.kijima, night: true });
      await narr(g, '（部屋に戻ると、となりの木島さんが、\n郵便を手に、ドアの前でじっと立っていた）');
      await say(g, W_.kijima, ['ああ、すまんね。…年金の通知なんだが、\n字が小さくて、よく読めなくてね。', '女房に先立たれて、もう十年だ。\n…人と話したのは、何日ぶりかな。']);
      const L = landlord(g, c);
      const k = await ask(g, null, '（どうする…？）', ['いっしょに読む', `${L.id ? '大家さん' : '管理人さん'}に伝える`, '会釈して部屋へ']);
      if (k === 0) {
        await narr(g, '（いっしょに、通知を読んだ。\n…年金の額は、思っていたよりずっと少なかった）');
        await say(g, W_.kijima, ['ありがとう。\n…今度、お茶でも飲みに来なさい。']);
        a.care += 2; stress(g, -3);
      } else if (k === 1) {
        await say(g, L, ['教えてくれてありがとう。\nわたしも、ときどき声をかけるようにするわね。']);
        if (L.id) aff(g, L.id, 1);
        a.care += 1;
      } else {
        await narr(g, '（会釈をして、自分の部屋に入った）');
      }
      S.hide();
      schedule(g, 'kodoku_2', rint(6, 10));
      return { pick: ['read', 'landlord', 'bow'][k] };
    },
  },
  kodoku_2: {
    name: '郵便受けにたまった新聞（孤独死）', cat: 'money', story: true, where: 'home_return',
    ok: (g) => arcActive(arc(g, 'kodoku')),
    async run(g, c, data, open) {
      const a = arc(g, 'kodoku');
      a.step = 2;
      const L = landlord(g, c);
      const S = open('corridor', { title: c.housingName, sub: 'となりの部屋の前', pile: true });
      await narr(g, '（となりの木島さんの郵便受けに、\n新聞が何日分もたまっている…）');
      const k = await ask(g, null, '（そういえば、ここ数日、物音がしない）', ['ドアをノックする', `${L.id ? '大家さん' : '管理人さん'}に連絡`, '気にしないことにする']);
      if (k === 2) {
        await narr(g, '（気にしないことにした）');
        S.hide();
        schedule(g, 'kodoku_3', rint(2, 4), { found: 'late' });
        return { pick: 'ignore' };
      }
      if (k === 0) await narr(g, '（ノックしても、返事がない。\n…ドアの向こうで、テレビの音だけがしている）');
      S.set('corridor', { title: c.housingName, sub: 'となりの部屋の前', pile: true, who: L.look, whoX: 330 });
      await say(g, L, ['合鍵を持ってきたわ。\n…警察にも、連絡しておいたから。']);
      const alive = roll(0.45 + 0.2 * Math.min(2, a.care));
      if (alive) {
        await narr(g, ['（部屋の奥で、木島さんが倒れていた。\n…息はある！）', '（すぐに救急車を呼んだ）']);
        S.set('hospital', { title: 'ドット中央病院', sub: '数日後', patient: LK.kijima, who: LK.doctor });
        await say(g, W_.doctor, [c.summer ? '熱中症と脱水で、倒れていたようです。\nあと一日遅かったら、危なかったでしょう。' : '倒れて、起き上がれなくなっていたようです。\nあと一日遅かったら、危なかったでしょう。']);
        await say(g, W_.kijima, ['…まさか、こんなじいさんのために\n人が来てくれるとはね。', 'ありがとう。\n…もう少し、生きてみるよ。']);
        if (L.id) aff(g, L.id, 3);
        a.care += 2;
        S.hide();
        schedule(g, 'kodoku_3', rint(5, 8), { found: 'alive' });
        return { pick: k === 0 ? 'knock' : 'call', alive: true };
      }
      await narr(g, ['（警察と' + (L.id ? '大家さん' : '管理人さん') + 'が、部屋に入った）', '（木島さんは、もう亡くなっていた。\n…亡くなって、数日たっていたらしい）']);
      stress(g, 10);
      S.hide();
      schedule(g, 'kodoku_3', rint(3, 5), { found: 'dead' });
      return { pick: k === 0 ? 'knock' : 'call', alive: false };
    },
  },
  kodoku_3: {
    name: '孤独死のその後', cat: 'money', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'kodoku')),
    run(g, c, data) {
      const a = arc(g, 'kodoku');
      a.step = 3;
      const L = landlord(g, c);
      const from = L.id ? L.name : '管理人';
      const msg = (t) => g.message({ from, person: L.id && PEOPLE[L.id] ? L.id : undefined, look: L.look, kind: 'chat', text: flat(g.fmt(t)) });
      if (data.found === 'alive') {
        msg(c.year >= 2006 ? '木島さん、退院したわよ。地域包括支援センターの人が、週に一度ようすを見に来てくれることになったの。わたしも毎朝、声をかけるわね。' : '木島さん、退院したわよ。民生委員さんが、ときどきようすを見に来てくれることになったの。わたしも毎朝、声をかけるわね。');
        g.message({ from: '木島', look: LK.kijima, kind: 'chat', text: flat(g.fmt('先日は、ありがとう。字の大きい本を買ったよ。今度、お茶でも飲みに来なさい。')) });
        skill(g, 'talk', 1);
        endArc(g, 'kodoku', 'saved');
        return { out: 'saved' };
      }
      msg((data.found === 'late' ? 'となりの木島さんのこと、聞いた？ 部屋で亡くなっていたの。見つかったのは、何日もたってからだったって。' : '')
        + '木島さん、引き取る親族が見つからなくて、区が火葬することになったわ。部屋の片付けは、業者さんに頼んだの。…もっと声をかけていればって、思っちゃうわね。');
      news(g, c.year >= 1995 ? 'ひとり暮らしのお年寄りが、自宅で亡くなったまま何日も気づかれない「孤独死」が、都市部で相次いでいる。' : 'ひとり暮らしのお年寄りが、亡くなってから何日も気づかれない例が、都市部で増えている。');
      stress(g, 5);
      endArc(g, 'kodoku', 'died');
      return { out: 'died' };
    },
  },

  // ================================================================ DV（友だち, arc）
  dv_1: {
    name: '友だちのDV（気づく）', cat: 'society', arc: 'dv', where: 'town', weight: 0.9, cool: 400,
    ok: (g, c) => !arc(g, 'dv'),
    async run(g, c, data, open) {
      const ka = castWho(g, 'kaori');
      const w = ka || { ...FALLBACK.dv };
      const a = startArc(g, 'dv', ka ? 'kaori' : 'fb');
      const S = open('cafe', { title: '喫茶店', sub: `${w.short}と、ひさしぶりに`, who: w.look });
      const mobile = c.year >= 1997;
      await narr(g, [c.summer ? `（${w.short}と、ひさしぶりにお茶をした。\n暑い日なのに、長袖を着ている）` : `（${w.short}と、ひさしぶりにお茶をした。\nずっと、袖口を気にしている）`, mobile ? `（${phoneWord(c)}が鳴るたびに、\n${w.short}の肩がびくっとする）` : `（${w.short}は、何度も時計を見ている）`]);
      await say(g, w, [mobile ? '彼から。…どこにいるか、何時に帰るか、\nぜんぶ知らせないと、怒るの。' : '彼が決めた時間までに帰らないと、怒るの。\n…どこで、だれと会ってたかも、ぜんぶ聞かれる。', 'お給料も、彼が管理してて。\n…でも、わたしが悪いんだ。怒らせるから。']);
      const k = await ask(g, null, '（どうする…？）', ['あなたは悪くないと言う', '別れなよと言う', '深入りしない']);
      if (k === 0) {
        await narr(g, '（「悪いのは、手をあげたり、縛ったりするほうだよ」\nと伝えた）');
        await narr(g, c.year >= 2002 ? '（区役所や警察に、相談できる窓口があることも\n伝えた。メモを、そっと手渡した）' : '（女性の相談所や警察に、相談できることも伝えた。\nメモを、そっと手渡した）');
        await say(g, w, ['…ありがとう。\nこのメモ、見つからないところにしまっておく。']);
        a.care += 2; aff(g, w.id, 3);
      } else if (k === 1) {
        await say(g, w, ['…そんなに簡単じゃないよ。\n別れるなんて言ったら、何をされるか…。']);
        a.care += 1; aff(g, w.id, 1);
      } else {
        await narr(g, '（ふたりのことだから、と話を変えた。\n' + w.short + 'は、少しほっとしたように笑った）');
      }
      S.hide();
      schedule(g, 'dv_2', rint(4, 8));
      return { pick: ['support', 'leave_him', 'distance'][k] };
    },
  },
  dv_2: {
    name: '友だちのDV（夜の電話）', cat: 'society', story: true, where: 'home_return',
    ok: (g) => arcActive(arc(g, 'dv')),
    async run(g, c, data, open) {
      const a = arc(g, 'dv'), w = arcWho(g, 'dv', a);
      a.step = 2;
      const S = open('phone', { title: `${w.short}からの電話`, sub: '電話が鳴った', who: w.look, rightLabel: w.short, rightBg: '#2a2a3a', rightFloor: '#3a3a4a' });
      await narr(g, `（電話の向こうで、${w.short}が泣いていた）`);
      await say(g, w, ['ごめん、こんな時間に。\nケンカになって…何も持たずに、出てきちゃった。', '…家に、帰れない。\nどうしよう。']);
      const k = await ask(g, null, '（どうする…？）', ['迎えに行く', '警察に電話して', '今夜はうちに泊めて', '朝まで待ってと言う']);
      if (k === 0) {
        await narr(g, ['（タクシーで迎えに行った）', c.year >= 2002 ? '（次の日、いっしょに配偶者暴力相談支援センターへ。\n相談員が、身を寄せる場所を探してくれた）' : '（次の日、いっしょに女性の相談所へ。\n相談員が、しばらく身を寄せる場所を探してくれた）']);
        if (c.year < 2014 && c.year >= 2002) await say(g, W_.counselor, ['結婚していない相手だと、\nこの法律の「保護命令」は使えないんです。', 'でも、警察には相談できます。\nまずは、安全な場所に移りましょう。']);
        a.care += 2;
      } else if (k === 1) {
        if (c.year >= 2001) { await narr(g, '（' + w.short + 'が110番すると、すぐに警察官が来て、\n安全な場所まで送ってくれた）'); a.care += 2; }
        else { await narr(g, ['（' + w.short + 'が警察に電話した）', '（…「ふたりで、よく話し合ってください」\nと言われただけだった）']); a.care += 1; }
      } else if (k === 2) {
        await narr(g, c.year >= 1997 ? '（' + w.short + 'を部屋に泊めた。\n夜中、何度も' + phoneWord(c) + 'が震えていた）' : '（' + w.short + 'を部屋に泊めた。\n夜中まで眠れずに、窓の外を気にしていた）');
        stress(g, 6);
        a.care += 1;
      } else {
        await narr(g, '（「朝になったら、落ち着くよ」と伝えた。\n…電話は、そこで切れた）');
        a.care -= 1;
      }
      aff(g, w.id, k === 3 ? -1 : 3);
      S.hide();
      schedule(g, 'dv_3', rint(10, 18));
      return { pick: ['pickup', 'police', 'stay', 'wait'][k] };
    },
  },
  dv_3: {
    name: '友だちのDV（その後）', cat: 'society', story: true, passive: true,
    ok: (g) => arcActive(arc(g, 'dv')),
    run(g, c) {
      const a = arc(g, 'dv'), w = arcWho(g, 'dv', a);
      a.step = 3;
      if (a.care >= 3) {
        wMsg(g, w, w.id === 'kaori' ? '新しい部屋に引っ越したよ。彼とは、もう連絡をとってない。…それでね、次の公演のオーディション、受けることにしたの。ソロのパートがある役♪' : '新しい部屋に引っ越したよ。彼とは、もう連絡をとってない。仕事も見つけた。…あのとき、ありがとう。');
        aff(g, w.id, 5);
        endArc(g, 'dv', 'escaped');
      } else if (a.care >= 1) {
        wMsg(g, w, '…やっぱり、彼のところに戻ったの。「もうしない」って言うから。ごめんね、心配かけて。');
        endArc(g, 'dv', 'returned');
      } else {
        wMsg(g, w, w.id === 'kaori' ? '劇団、しばらく休むことにした。…また、連絡するね。' : '…しばらく、連絡できないと思う。ごめんね。');
        aff(g, w.id, -2);
        endArc(g, 'dv', 'lost');
      }
    },
  },

  // ================================================================ 誹謗中傷・炎上（player, arc）
  enjo_1: {
    name: '誹謗中傷・ネット炎上', cat: 'fame', arc: 'enjo', where: 'any', weight: 1, cool: 300,
    ok: (g, c) => !arc(g, 'enjo') && c.fame >= 300 && !c.office,
    async run(g, c, data, open) {
      const st = g.state;
      const a = startArc(g, 'enjo', 'self');
      const net = netAge(c);
      const sns = eraOf(st).sns;
      if (net) {
        const S = open('sns', { title: c.year >= 2010 ? sns : 'ネットの掲示板', sub: '通知が止まらない', app: c.year >= 2010 ? sns : '掲示板', rows: ['態度悪すぎ', '前から嫌いだった', '共演NGらしい', '消えてほしい', '（読むのもつらい言葉）'], count: c.year >= 2010 ? '999+' : '412' });
        await narr(g, [`（${c.year >= 2010 ? 'ドッター' : 'ネットの掲示板'}に、\n「{name}、収録で共演者を無視」という書きこみ。\nあっという間に広がっていた）`, '（収録で緊張して、黙っていただけなのに…）', '（読むのもつらい言葉が、何百件も並んでいる）']);
        const key = await askKeys(g, null, '（どうする…？）', [
          ['反論を書きこむ', 'reply'], ['しばらく見ない', 'away'], ['弁護士に相談する', 'lawyer'], ['事務所に任せる', 'agency', !!c.agency],
        ]);
        a.data.pick = key;
        if (key === 'reply') {
          await narr(g, '（「そんな事実はありません」と書きこんだ）');
          if (roll(0.35)) { await narr(g, '（ファンが「本当の{name}を知ってる」と\n次々に書きこみ、流れが変わった）'); fans(g, Math.round(c.fans * 0.01)); stress(g, 8); }
          else { await narr(g, '（「必死すぎ」「逆ギレ」…\n火に油を注いだだけだった）'); fame(g, -30); fans(g, -Math.round(c.fans * 0.02)); stress(g, 15); }
        } else if (key === 'away') {
          await narr(g, '（アプリを消した。\n…世界は、思っていたより静かだった）');
          stress(g, 6);
        } else if (key === 'lawyer') {
          const fee = 200000;
          if (st.money < fee) { await narr(g, '（弁護士に頼むお金が、足りない…）'); stress(g, 12); a.data.pick = 'nomoney'; }
          else {
            money(g, fee);
            S.set('agency', { title: '弁護士事務所', sub: '発信者の特定', who: LK.lawyer, board: '法律相談' });
            await say(g, W_.lawyer, [`（着手金 ${fmtMoney(fee)}）`, c.year >= 2002 ? 'ひどい書きこみは、記録を残しておいてください。\nサイトやプロバイダに、投稿した人の情報の開示を\n求めていきます。時間はかかりますが。' : 'ネットの書きこみは、相手を特定するのが\nとても難しい。…それでも、記録は残しましょう。']);
            stress(g, 4);
          }
        } else {
          await narr(g, '（事務所が「事実ではありません」と声明を出した。\n少しずつ、書きこみは減っていった）');
          stress(g, 6);
        }
        S.hide();
      } else {
        const S = open('magazine', { title: '週刊誌の記事', sub: '駅の売店で', head: '「{name}、楽屋で大暴れ」', head2: '共演者が涙の告白!?' });
        await narr(g, ['（週刊誌に、まったく身に覚えのない記事が出た）', '（その夜から、無言電話と、\n差出人のない手紙が届くようになった）']);
        const key = await askKeys(g, null, '（どうする…？）', [['出版社に抗議する', 'protest'], ['名誉毀損で訴える', 'sue'], ['相手にしない', 'away']]);
        a.data.pick = key;
        if (key === 'protest') { await narr(g, '（抗議文を送った。\n…次の号の隅に、小さな「おわび」が載った）'); stress(g, 6); }
        else if (key === 'sue') {
          const fee = 200000;
          if (st.money < fee) { await narr(g, '（裁判を起こすお金が、足りない…）'); stress(g, 12); a.data.pick = 'nomoney'; }
          else { money(g, fee); await say(g, W_.lawyer, [`（着手金 ${fmtMoney(fee)}）`, '名誉毀損の裁判は、何か月もかかります。\n…それでも、やりますか。もう、決めたんですね。']); stress(g, 8); }
        } else { await narr(g, '（相手にしないことにした。\n…それでも、電話が鳴るたびに、体がこわばる）'); stress(g, 10); }
        S.hide();
      }
      schedule(g, 'enjo_2', rint(10, 18));
      return { pick: a.data.pick };
    },
  },
  enjo_2: {
    name: '誹謗中傷のその後', cat: 'fame', story: true, where: 'home_return',
    ok: (g) => arcActive(arc(g, 'enjo')),
    async run(g, c, data, open) {
      const a = arc(g, 'enjo');
      a.step = 2;
      const pick = a.data.pick;
      const S = open('room', { title: '自宅', sub: 'その後' });
      let out = 'faded';
      if (pick === 'lawyer' || pick === 'sue') {
        S.set('agency', { title: '弁護士事務所', sub: 'その後', who: LK.lawyer, board: '法律相談' });
        if (netAge(c) && c.year < 2002) {
          await say(g, W_.lawyer, ['…残念ですが、書きこんだ人は特定できませんでした。\nこの時代のネットは、まだ手続きが追いついていない。']);
          out = 'unknown';
        } else {
          await say(g, W_.lawyer, [netAge(c) ? '書きこんだ人が、特定できました。\n都内の会社員でした。あなたのファンだったそうです。' : '出版社が、記事に裏づけがなかったことを認めました。', netAge(c) ? '「好きだったのに、裏切られた気がして」と。\n謝罪と、示談金の申し出が来ています。' : '和解金と、誌面での訂正の申し出が来ています。']);
          if (c.ym >= 202207 && netAge(c)) await say(g, W_.lawyer, ['示談しないなら、刑事告訴もできます。\n侮辱罪は、2022年に厳しくなりましたから。']);
          const k = await ask(g, null, '（どうする…？）', ['示談を受け入れる', 'あくまで責任を問う']);
          if (k === 0) { g.addMoney(300000, true); await narr(g, `（示談がまとまった。${fmtMoney(300000)}が振りこまれた）`); out = 'settled'; }
          else { await narr(g, '（裁判へ進むことにした。\n…終わるのは、まだ先になりそうだ）'); stress(g, 6); fame(g, 10); out = 'court'; }
        }
      } else {
        await narr(g, ['（あの騒ぎは、いつの間にか消えていた）', '（みんな、もう次のだれかを叩いている）']);
        if (pick === 'reply') stress(g, 4);
      }
      // a manager or a friend notices how the player is doing
      if (g.state.life && g.state.life.stress >= 60) {
        const m = c.agency ? managerOf(c) : { name: '昔からの友だち', look: LK.saya };
        S.set('agency', { title: c.agency ? c.agency.name : '喫茶店', who: m.look, board: 'お知らせ' });
        await say(g, m, c.agency ? ['顔色、よくないですよ。\n…カウンセリング、受けてみませんか。\n事務所で、費用は持ちますから。'] : ['顔色、よくないよ。\n…カウンセリング、受けてみたら？\n話を聞いてもらうだけでも、ちがうって。']);
        const k2 = await ask(g, null, '（どうする…？）', ['受けてみる', '大丈夫と答える']);
        if (k2 === 0) {
          if (!c.agency) money(g, 5000);
          await narr(g, '（話を聞いてもらうだけで、\n少し、肩の力が抜けた）'); stress(g, -25); out += '+care';
        } else await narr(g, '（「大丈夫です」と笑ってみせた）');
      }
      S.hide();
      endArc(g, 'enjo', out);
      return { out };
    },
  },

  // ================================================================ いじめ（ファンからの手紙）
  ijime: {
    name: 'いじめ（ファンからの手紙）', cat: 'society', where: 'home_return', weight: 1, cool: 200,
    ok: (g, c) => c.fans >= 1500,
    async run(g, c, data, open) {
      const S = open('letter', { lines: ['{name}さんへ', '中学2年です。', 'クラスで、ずっと無視されています。', '机に落書きされたり、物を隠されたり。', '{name}さんの番組を見てる時間だけ、', '笑えます。', '学校に行くのが、つらいです。'].map((s) => g.fmt(s)) });
      await narr(g, '（ファンレターの束の中に、\n便せん一枚だけの手紙があった）');
      const k = await ask(g, null, '（どうする…？）', ['返事を書く', '事務所に相談する', '読んで、しまっておく']);
      if (k === 0) {
        await narr(g, '（「つらいときは、学校を休んでもいい。\n話せる大人に、話してみて。\nわたしは、あなたの味方です」と書いた）');
        stress(g, 2);
        schedule(g, 'ijime_after', rint(12, 20), { wrote: true });
      } else if (k === 1) {
        const m = managerOf(c);
        await say(g, m, ['ファンの方の個人的なことには、\n事務所としては立ち入れなくて…。', 'サイン入りのカードを、送っておきますね。']);
        schedule(g, 'ijime_after', rint(12, 20), { wrote: false, card: true });
      } else {
        await narr(g, '（手紙を、引き出しにしまった）');
        stress(g, 3);
      }
      S.hide();
      return { pick: ['wrote', 'agency', 'kept'][k] };
    },
  },
  ijime_after: {
    name: 'いじめ（返事の返事）', cat: 'society', story: true, passive: true,
    run(g, c, data) {
      const t = data.wrote
        ? (c.year >= 2014 ? 'お返事、ありがとうございました。勇気を出して、保健室の先生に話しました。学校が、ちゃんと調べてくれることになりました。いまは別の教室に通っています。'
          : c.year >= 1998 ? 'お返事、ありがとうございました。親に話して、しばらく学校を休んでいます。いまは、フリースクールに通っています。また番組、見ます。'
            : 'お返事、ありがとうございました。親に話しました。登校拒否ってやつです。でも、図書館で勉強しています。また番組、見ます。')
        : 'カード、届きました。宝物にします。…学校は、まだつらいです。';
      g.message({ from: 'ファンの中学生', look: LOOKS.kid, kind: 'fan', text: flat(g.fmt(t)) });
      if (data.wrote) { fans(g, 20); stress(g, -6); }
      return { out: data.wrote ? 'helped' : 'card' };
    },
  },

  // ================================================================ 不登校（タマエちゃんの孫）
  futoko: {
    name: '不登校（知人の孫）', cat: 'society', where: 'town', weight: 0.6, cool: 300,
    ok: (g, c) => !!castWho(g, 'tamae'),
    async run(g, c, data, open) {
      const P = PEOPLE.tamae, w = { name: P.name, look: P.look, id: 'tamae' };
      const word = c.year >= 1998 ? '不登校' : '登校拒否';
      const S = open('cafe', { title: 'なんばの喫茶店', sub: 'タマエちゃんと', who: P.look });
      await say(g, w, ['なあ、ちょっと聞いてくれる？\n孫がな、学校行かれへんようになってん。', `朝になったら、おなかが痛い言うて。\nもう三か月や。…「${word}」いうやつや。`, '娘は「甘えや」言うて、怒鳴ってばっかりでな。\nうち、どないしたらええんやろ。']);
      const k = await ask(g, null, '（どうする…？）', ['無理させなくていい', '学校に行かせるべき', '孫に会いに行く']);
      if (k === 0) {
        await narr(g, '（「休むのも、ひとつの道だと思う。\n学校の外にも、学べる場所はあるよ」と伝えた）');
        await say(g, w, ['…そうか。そうやな。\nうちが味方にならな、あかんな。']);
        aff(g, 'tamae', 3);
        schedule(g, 'futoko_after', rint(12, 20), { good: true });
      } else if (k === 1) {
        await say(g, w, ['…せやろか。\nもういっぺん、娘と話してみるわ。']);
        schedule(g, 'futoko_after', rint(12, 20), { good: false });
      } else {
        await narr(g, '（タマエちゃんの家で、お孫さんと\nゲームの話をした。少しだけ、笑ってくれた）');
        aff(g, 'tamae', 4); stress(g, -4);
        schedule(g, 'futoko_after', rint(12, 20), { good: true, met: true });
      }
      S.hide();
      return { pick: ['rest', 'push', 'visit'][k] };
    },
  },
  futoko_after: {
    name: '不登校のその後', cat: 'society', story: true, passive: true,
    run(g, c, data) {
      const t = data.good ? (data.met ? '孫がな、「あの人、また来る？」言うとるで。フリースクールいうとこ、見学に行ってきたんや。' : '孫な、フリースクールいうとこに通いだしてん。毎日、楽しそうに話してくれるわ。おおきにな。') : '孫、無理に学校に行かせたら、部屋から出てこんようになってもうた…。うち、まちごうてたかもしれん。';
      g.message({ from: PEOPLE.tamae ? PEOPLE.tamae.name : 'タマエ', person: PEOPLE.tamae ? 'tamae' : undefined, kind: 'chat', text: flat(g.fmt(t)) });
      return { out: data.good ? 'ok' : 'worse' };
    },
  },

  // ================================================================ ひきこもり（家族・同級生）
  hikikomori: {
    name: 'ひきこもり（家族からの相談）', cat: 'society', where: 'any', weight: 0.6, cool: 400,
    ok: (g, c) => !!c.parent && c.year >= 1992,
    async run(g, c, data, open) {
      const M = c.parent;
      const sib = c.sib && c.sib.role === 'older' ? c.sib : null;
      const who = sib ? sib.call : '同級生の健太くん';
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call, rightBg: '#d0c8b0' });
      if (sib) await famSay(g, M, [`${who}、会社を辞めてから、\nずっと部屋から出てこない{nda}。もう一年{dap}。`, 'ごはんは、部屋の前に置いておく{nda}。\n…{me}たちも、どうしていいのか{ne}。']);
      else await famSay(g, M, [`${who}、覚え{teru}？\nもう何年も、家から出てない{nda}って。`, 'お母さんが、「{you}の番組だけは\n見てるみたい」って言っ{teru}{yo}。']);
      const k = await ask(g, null, '（どうする…？）', ['手紙を書く', '帰省したら会う', 'そっとしておく']);
      if (k === 0) {
        await narr(g, `（${who}に、短い手紙を書いた。\n説教はしない。最近見たおもしろいもののことだけ）`);
        famAff(g, M, 2);
        schedule(g, 'hikikomori_after', rint(14, 24), { good: true, who, sib: !!sib });
      } else if (k === 1) {
        await narr(g, '（「今度帰ったら、顔を見に行くよ」と伝えた）');
        famAff(g, M, 2);
        schedule(g, 'hikikomori_after', rint(14, 24), { good: roll(0.6), who, sib: !!sib });
      } else {
        await famSay(g, M, 'そう{dap}よ{ne}。…ありがとう、聞いてくれて。');
      }
      S.hide();
      return { pick: ['letter', 'visit', 'leave'][k] };
    },
  },
  hikikomori_after: {
    name: 'ひきこもり（小さな一歩）', cat: 'society', story: true, passive: true,
    run(g, c, data) {
      const M = c.parent;
      if (!M) return { out: 'none' };
      famMsg(g, M, data.good ? `${data.who}から、{you}に返事が来た{yo}。「ゲームの話なら、できる」って。…この前、いっしょに夜の散歩に行けた{nda}。` : `${data.who}は、まだ部屋から出てこない{nda}。…でも、ドアごしに「おはよう」は言ってくれる{yo}。`);
      if (c.year >= 2023 && roll(0.5)) news(g, '国の調査（2023年公表）では、15〜64歳で「ひきこもり」の状態にある人は、全国で約146万人と推計されている。');
      return { out: data.good ? 'step' : 'wait' };
    },
  },

  // ================================================================ カルト（勧誘・広告塔）
  cult_kanyu: {
    name: 'カルトの勧誘（勉強会）', cat: 'society', where: 'town', weight: 0.8, cool: 200,
    ok: (g, c) => !c.office,
    async run(g, c, data, open) {
      const st = g.state;
      const grp = cultName();
      const S = open('street', { title: '駅前', sub: '声をかけられた', who: LK.cultLady });
      const lady = { name: '笑顔の女性', look: LK.cultLady };
      await say(g, lady, ['すみません、少しだけいいですか？\n「自分を見つめなおす勉強会」をやっていて。', 'いま、悩みとか、ありません？\n…すごく、疲れた顔してますよ。']);
      const k = await ask(g, null, '（どうする…？）', ['断って立ち去る', '少しだけ行ってみる']);
      if (k === 0) { await narr(g, '（「けっこうです」と言って、その場を離れた）'); S.hide(); return { pick: 'refuse' }; }
      S.set('hall', { title: 'ビルの一室', sub: '勉強会', banner: '心をととのえる勉強会' });
      await say(g, { name: '講師', look: LK.cult }, ['あなたが苦しいのは、あなたのせいじゃない。\nご先祖の「因縁」が、まだ断ち切られていない\nからです。', c.year < 1995 ? 'この印鑑と壺には、因縁を断つ力があります。\n今日だけ、特別にお分けしましょう。' : c.year >= 2015 ? 'このご縁を形にするために、まずは「入会の献金」を。\n…みなさん、そうして救われてきたんです。' : '次の「特別講座」に進めば、因縁は断ち切れます。\n受講料は、救われるための「投資」ですよ。']);
      await narr(g, `（周りの人たちが、にこにこと見ている。\n…あとで知った。主催は「${grp}」だった）`);
      const amt = 100000;
      const k2 = await ask(g, null, '（どうする…？）', ['帰ります', '少しだけ払う', `入会する（${fmtMoney(amt)}）`]);
      let out = 'leave';
      if (k2 === 0) { await narr(g, '（席を立った。\n…その夜から、何度も電話がかかってきた）'); stress(g, 4); }
      else if (k2 === 1) { const p = money(g, 20000); await narr(g, `（断りきれず、${fmtMoney(p)}を払った）`); stress(g, 5); out = 'paid'; }
      else {
        const p = money(g, amt);
        await narr(g, `（${fmtMoney(p)}を払って、入会した。\n…不思議と、少し気持ちが軽くなった気がした）`);
        stress(g, -8); out = 'joined';
        schedule(g, 'cult_after', rint(8, 14), { paid: p });
      }
      S.hide();
      return { pick: out };
    },
  },
  cult_after: {
    name: 'カルト（献金の要求）', cat: 'society', story: true, where: 'any',
    async run(g, c, data, open) {
      const grp = cultName();
      const S = open('phone', { title: `「${grp}」の人からの電話`, who: LK.cultLady, rightLabel: '勉強会の人', rightBg: '#e8e4d8' });
      await say(g, { name: '勉強会の人', look: LK.cultLady }, ['次の「特別な祈り」に参加すれば、\nあなたのご家族も救われます。', `献金は、${fmtMoney(500000)}。\n…まさか、ご家族を見捨てるんですか？`]);
      const k = await ask(g, null, '（どうする…？）', ['消費生活センターへ', '払う', 'ことわる']);
      let out;
      if (k === 0) {
        await say(g, W_.counselor, ['不安をあおって、お金を出させる勧誘ですね。\nやめることは、いつでもできます。', c.year >= 2023 ? 'いまは、不当な寄附の勧誘を禁じる法律があって、\n取り消せる場合もあります。弁護士につなぎますね。' : '弁護士につなぎますね。\n払ったお金も、取り戻せる場合があります。']);
        const back = roll(c.year >= 2023 ? 0.7 : 0.4) ? Math.round(num(data.paid) * 0.8) : 0;
        if (back) { g.addMoney(back, true); await narr(g, `（弁護士を通して脱会し、\n${fmtMoney(back)}が戻ってきた）`); } else await narr(g, '（弁護士を通して脱会した。\nお金は、戻ってこなかった）');
        out = back ? 'back' : 'left';
      } else if (k === 1) {
        const p = money(g, 500000);
        await narr(g, `（${fmtMoney(p)}を振りこんだ。\n…次の電話は、もっと大きな額だった）`);
        stress(g, 12); out = 'paid';
      } else {
        await narr(g, '（「もう行きません」と伝えた。\n電話は、しばらく鳴りつづけた）');
        stress(g, 6); out = 'refused';
      }
      S.hide();
      return { pick: out };
    },
  },
  cult_koukoku: {
    name: 'カルトの広告塔（出演依頼）', cat: 'fame', where: 'any', weight: 0.6, cool: 300,
    ok: (g, c) => c.fame >= 1500 && !c.office,
    async run(g, c, data, open) {
      const grp = cultName();
      const m = managerOf(c);
      const fee = 2000000;
      const S = open('agency', { title: c.agency ? `${c.agency.name} 会議室` : '喫茶店', sub: '出演の依頼', who: m.look, board: 'スケジュール' });
      await say(g, m, [`「家族の絆フェスティバル」から、出演依頼です。\nギャラは${fmtMoney(fee)}。…破格です。`, '主催の「ひかりの家族会」は、調べたら\n' + `「${grp}」の関連団体でした。`, '出れば、教団の宣伝に使われるかもしれません。']);
      const k = await ask(g, null, '（どうする…？）', ['断る', '引き受ける']);
      let out = 'refuse';
      if (k === 1) {
        g.addMoney(fee, true);
        await narr(g, `（出演した。${fmtMoney(fee)}が振りこまれた。\n会場の大きなポスターに、自分の笑顔があった）`);
        out = 'accept';
        schedule(g, 'cult_koukoku_after', rint(10, 18), {});
      } else await narr(g, '（断った）');
      S.hide();
      return { pick: out };
    },
  },
  cult_koukoku_after: {
    name: 'カルトの広告塔（報道）', cat: 'fame', story: true, passive: true,
    run(g, c) {
      news(g, `人気タレントの{name}さんが、「${cultName()}」の関連団体のイベントに出演していたことがわかった。高額献金の被害者の弁護団は「広告塔に利用された」と批判している。`, GEINOU);
      fame(g, -150); fans(g, -Math.round(num(g.state.fans) * 0.05)); stress(g, 10);
      return { out: 'scandal' };
    },
  },

  // ================================================================ 闇バイト（ファンの若者）
  yamibaito: {
    name: '闇バイト（ファンの若者）', cat: 'society', where: 'any', weight: 0.8, cool: 250,
    ok: (g, c) => c.year >= 2019 && c.fans >= 1000,
    async run(g, c, data, open) {
      const riku = { name: 'ファンの大学生 リク', look: LK.riku };
      const S = open('sns', { title: 'メッセージ', sub: 'ファンからのDM', app: 'DM', bar: '#5a4a8a', count: '1', rows: ['{name}さん、たすけてください'].map((s) => g.fmt(s)) });
      await say(g, riku, ['いきなりすみません。いつも見てます。\n…ほかに相談できる人がいなくて。', 'SNSで「ホワイト案件・即日高収入」っていう\nバイトに応募したんです。身分証の写真を\n送ったら、急に「荷物を運べ」って…。', 'やめたいって言ったら、\n「実家の住所はわかってるぞ」って。']);
      const k = await ask(g, null, '（どうする…？）', ['すぐ警察へ行こう', 'お金で解決しよう', '関わらない']);
      let out;
      if (k === 0) {
        await narr(g, ['（「いますぐ警察に相談して。\nひとりで行けないなら、いっしょに行く」と返した）', c.year >= 2025 ? '（警察は、「応募してしまっても、抜けたい人は保護する」\nと呼びかけていた）' : '（警察は、脅された人と家族を守ると言っている）']);
        out = 'police';
        schedule(g, 'yamibaito_after', rint(5, 10), { safe: true });
      } else if (k === 1) {
        const p = money(g, 50000);
        await narr(g, `（「やめる代わりに」と言われた${fmtMoney(p)}を、\nリクに送った）`);
        await narr(g, '（…相手は、金を受け取ったあとも\n連絡をやめなかった）');
        stress(g, 6); out = 'paid';
        schedule(g, 'yamibaito_after', rint(5, 10), { safe: roll(0.4) });
      } else {
        await narr(g, '（返事をしなかった）');
        out = 'ignore';
        schedule(g, 'yamibaito_after', rint(5, 10), { safe: false });
      }
      S.hide();
      crimeAppTouch(g, 'yamibaito');
      return { pick: out };
    },
  },
  yamibaito_after: {
    name: '闇バイトのその後', cat: 'society', story: true, passive: true,
    run(g, c, data) {
      if (data.safe) {
        g.message({ from: 'ファンの大学生 リク', look: LK.riku, kind: 'fan', text: flat(g.fmt('警察に行きました。親にも全部話しました。家にも警察の人が見回りに来てくれています。…本当に、ありがとうございました。')) });
        news(g, 'SNSで集めた若者に特殊詐欺や強盗をさせていたグループの指示役とみられる男を、警察が逮捕した。');
        return { out: 'safe' };
      }
      news(g, '住宅への強盗事件で、SNSの「高額バイト」に応募した19歳の大学生ら3人が逮捕された。「脅されて、やめられなかった」と話しているという。');
      stress(g, 10);
      return { out: 'caught' };
    },
  },

  // ================================================================ 悪質商法・詐欺（家族の高齢者）
  sagi2: {
    name: '悪質商法・詐欺（家族の高齢者）', cat: 'money', where: 'any', weight: 0.7, cool: 250,
    ok: (g, c) => {
      if (!c.elder) return false;
      const ds = darkState(g);
      const recent = ds && ds.lastId && ['inc_sagi', 'inc_sagi_warn'].some((id) => ds.lastId[id] && c.day - num(ds.lastId[id]) < 60);
      return !recent;
    },
    async run(g, c, data, open) {
      const M = c.elder;
      const scheme = c.year <= 1990 ? 'genya' : c.year < 2004 ? 'houmon' : c.year < 2019 ? 'kanpu' : 'sns';
      const T = {
        genya: { lines: ['ねえ、聞いて{ne}。北海道の土地を買った{nda}。\n「新幹線が通るから、10倍になる」って。', '頭金を、もう払っちゃった{yo}。\n残りは来月{da}。'], amt: 500000, word: '原野商法' },
        houmon: { lines: ['きのう、布団の訪問販売の人が来て{ne}。\n「この布団で、腰がよくなる」って。', '一組、契約しちゃった{yo}。\n…ちょっと高かったかな。', '来週には、浄水器の人も来るって{yo}。'], amt: 400000, word: '訪問販売' },
        kanpu: { lines: ['市役所の人から電話があって{ne}。\n「医療費の払い戻しがあるから、ATMへ」って。', 'いま、ATMの前にいる{nda}。\n言われたとおりに、操作すればいいって。'], amt: 300000, word: '還付金詐欺' },
        sns: { lines: ['{you}、見て{ne}。SNSで、有名な投資家の先生と\n知り合った{nda}。毎日、利益が出{teru}{nda}。', 'もう、300万円入れた{yo}。\n「出金するには手数料が要る」って言われて{ne}。'], amt: 600000, word: 'SNS型投資詐欺' },
      }[scheme];
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call, rightBg: '#d8cca0' });
      await famSay(g, M, T.lines);
      const k = await ask(g, null, '（それは…！）', ['すぐ止める', '消費生活センターへ', '本人にまかせる']);
      let out;
      if (k === 0) {
        if (scheme === 'kanpu') { await narr(g, '（「それは詐欺だよ！ ATMでお金が戻ることはない！」\nと止めた。間に合った）'); out = 'stopped'; }
        else if (scheme === 'houmon') { await narr(g, '（「訪問販売は、8日以内ならクーリング・オフ\nできるよ」と伝えて、いっしょに書面を出した）'); out = 'cooling'; }
        else {
          const lost = Math.round(T.amt * 0.5);
          await narr(g, [`（「それは${T.word}だよ！」と止めた。\nこれ以上の支払いは、止められた）`, `（…でも、もう払ってしまったぶんは、\n戻ってこなかった。${fmtMoney(lost)}ほど）`]);
          out = 'half';
        }
        famAff(g, M, 3);
        await famSay(g, M, 'ごめん{ne}、{me}、すっかり信じちゃって…。\n{you}がいてくれて、よかった{yo}。');
      } else if (k === 1) {
        await say(g, W_.counselor, [`${T.word}のご相談、とても多いんです。\nまず、これ以上お金を払わないでください。`, scheme === 'sns' || scheme === 'kanpu' ? '警察にも、被害届を出しましょう。\nお金が戻るのは、むずかしいかもしれませんが。' : '契約の取り消しができるか、\nいっしょに確認していきましょう。']);
        famAff(g, M, 2);
        out = scheme === 'houmon' || scheme === 'genya' ? (roll(0.6) ? 'cancelled' : 'half') : 'reported';
      } else {
        await narr(g, '（「本人の自由だから」と、口をはさまなかった）');
        out = 'lost';
        stress(g, 4);
        schedule(g, 'sagi2_after', rint(6, 12), { word: T.word, pid: M.pid });
      }
      if (scheme === 'sns') news(g, '著名人になりすましたSNSの広告で投資に誘う「SNS型投資詐欺」の被害が、急増している。');
      S.hide();
      return { pick: out, scheme };
    },
  },
  sagi2_after: {
    name: '詐欺の被害（家族）', cat: 'money', story: true, passive: true,
    run(g, c, data) {
      const M = family(g).find((x) => x.pid === data.pid) || c.elder;
      if (!M) return { out: 'none' };
      famMsg(g, M, `ごめん{ne}。あれ、${data.word}だった{yo}。お金、ぜんぶなくなっちゃった。…{you}は気にしないで{ne}。`);
      famAff(g, M, -1); stress(g, 8);
      return { out: 'lost' };
    },
  },

  // ================================================================ 薬物（友人の依存）
  drug: {
    name: '薬物（先輩の依存）', cat: 'society', where: 'town', weight: 0.6, cool: 400,
    ok: (g, c) => !c.office,
    async run(g, c, data, open) {
      const w = { name: '養成所の先輩 ヒロキさん', short: 'ヒロキさん', look: LK.hiroki };
      const what = c.year >= 2011 && c.year <= 2015 ? (c.ym >= 201408 ? '危険ドラッグ' : '脱法ハーブ') : 'クスリ';
      const S = open('room', { title: 'ヒロキさんのアパート', sub: '昼でもカーテンが閉まっている', dark: true, curtain: true, who: w.look, whoX: 380, pX: 200 });
      await narr(g, `（ひさしぶりに会ったヒロキさんは、ひどくやせていた。\n手が、小さく震えている）`);
      await say(g, w, ['最近、眠れなくてさ。\nこれがないと、舞台に立てないんだよ。', `…${what}だよ。わかってる。\nやめようと思えば、いつでもやめられる。`]);
      const k = await ask(g, null, '（どうする…？）', ['病院につなごう', '警察に言う', '見なかったことに']);
      let out;
      if (k === 0) {
        await narr(g, ['（「やめられないのは、意志が弱いからじゃない。\n病気なんだよ。治療できる」と伝えた）', '（' + (c.year >= 2000 ? '依存症の専門外来' : '保健所の相談窓口') + 'に、いっしょに電話をかけた）']);
        out = 'treat';
        schedule(g, 'drug_after', rint(14, 24), { treat: true });
      } else if (k === 1) {
        await narr(g, '（警察に、通報した）');
        out = 'police';
        schedule(g, 'drug_after', rint(4, 8), { police: true });
      } else {
        await narr(g, '（何も言わずに、部屋を出た）');
        out = 'ignore';
        schedule(g, 'drug_after', rint(10, 18), {});
      }
      stress(g, 6);
      S.hide();
      return { pick: out };
    },
  },
  drug_after: {
    name: '薬物（その後）', cat: 'society', story: true, passive: true,
    run(g, c, data) {
      const from = { from: '養成所の先輩 ヒロキさん', look: LK.hiroki, kind: 'chat' };
      if (data.treat) {
        if (roll(0.7)) g.message({ ...from, text: '今日で、やめて90日。ミーティングで、同じように苦しんでる人たちに会えた。…まだ、毎日が勝負だけどな。' });
        else g.message({ ...from, text: '…一回、また手を出しちまった。でも、病院には正直に言った。もう一回、やりなおす。' });
        return { out: 'recovery' };
      }
      news(g, `都内の路上で、芸人の男（34）が${c.year >= 2010 ? '覚醒剤' : '覚せい剤'}を持っていた疑いで逮捕された。`);
      if (data.police) g.message({ ...from, text: '…おまえが通報したんだってな。最初は恨んだ。でも、ここで薬は抜けた。出たら、病院に通うつもりだ。' });
      stress(g, 6);
      return { out: data.police ? 'arrest_report' : 'arrest' };
    },
  },

  // ================================================================ 介護離職・老老介護（家族）
  kaigo: {
    name: '介護（介護離職・老老介護）', cat: 'money', where: 'any', weight: 0.7, cool: 400,
    ok: (g, c) => !!c.parent || c.grands.length >= 2,
    async run(g, c, data, open) {
      const roro = c.grands.length >= 2;
      const M = roro ? c.grands[0] : c.parent;
      const sick = roro ? (c.grands[1].call) : c.grand ? c.grand.call : c.lateGrand ? '親戚のおばさん' : '{you}のおばあちゃん';
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call, rightBg: '#d0c8b0' });
      if (roro) await famSay(g, M, [`${sick}の物忘れが、ひどくなって{ne}。\n夜中に、外に出ていこうとする{nda}。`, '{me}が見{teru}けど、もう体がもたない{yo}。\n…年寄りが年寄りを介護するって、こういうこと{da}。']);
      else await famSay(g, M, [`${sick}の認知症が、進んで{ne}。\n夜中に、外に出ていこうとする{nda}。`, '{me}、仕事を辞めて、介護しようかと\n思っ{teru}{nda}。']);
      const k = await ask(g, null, '（どうする…？）', roro ? ['介護サービスを調べる', 'お金を送る', '帰省して話し合う'] : ['仕事は辞めないでと言う', '介護サービスを調べる', 'お金を送る']);
      let out;
      const service = c.year >= 2000 ? '（介護保険で、ケアマネジャーに相談すれば、\nデイサービスやショートステイが使えるらしい。\n調べて、伝えた）' : '（役所に頼めば、ホームヘルパーや\n施設の短い泊まりが使える場合があるらしい。\n…ただ、空きは少ないという。調べて、伝えた）';
      if (!roro && k === 0) {
        await narr(g, ['（「辞めたら、お金も気持ちも追いつめられるよ。\n休みの制度もあるはずだから」と伝えた）', service]);
        out = 'keep_job';
      } else if ((roro && k === 0) || (!roro && k === 1)) {
        await narr(g, service);
        out = 'service';
      } else if ((roro && k === 1) || (!roro && k === 2)) {
        const p = money(g, 30000);
        await narr(g, `（${fmtMoney(p)}を送った）`);
        out = 'money';
      } else {
        await narr(g, '（「今度帰ったら、みんなで話そう」と伝えた）');
        out = 'talk';
      }
      famAff(g, M, 3);
      await famSay(g, M, '聞いてくれて、ありがとう{ne}。\n…ひとりで抱えてたから、少し楽になった{yo}。');
      stress(g, 5);
      S.hide();
      schedule(g, 'kaigo_after', rint(12, 20), { out, roro, pid: M.pid });
      return { pick: out };
    },
  },
  kaigo_after: {
    name: '介護のその後', cat: 'money', story: true, passive: true,
    run(g, c, data) {
      const M = family(g).find((x) => x.pid === data.pid);
      if (!M) return { out: 'none' };
      if (data.out === 'keep_job' || data.out === 'service') famMsg(g, M, c.year >= 2000 ? 'デイサービス、週に3回来てもらえることになった{yo}。仕事も続けられそう{da}。…夜はまだ大変{dap}けど{ne}。' : 'ヘルパーさんが、週に一度来てくれることになった{yo}。施設は、まだ空き待ち{da}。');
      else if (data.out === 'money') famMsg(g, M, '送ってくれたお金、おむつ代にさせてもらった{yo}。ありがとう{ne}。…正直、毎日へとへと{da}。');
      else famMsg(g, M, '{you}が帰ってくるの、待っ{teru}{yo}。みんなで話せたら、心強い{ne}。');
      if (c.year >= 2013 && roll(0.5)) news(g, '家族の介護のために仕事を辞める「介護離職」は、年間約10万人にのぼる。');
      return { out: data.out };
    },
  },

  // ================================================================ 年金不安（家族）
  nenkin: {
    name: '年金の不安（家族）', cat: 'money', where: 'any', weight: 0.5, cool: 400,
    ok: (g, c) => !!(c.parent || c.grand),
    async run(g, c, data, open) {
      const M = c.ym >= 200712 && c.year <= 2009 && c.grand ? c.grand : c.parent || c.grand;
      const S = open('phone', { title: `${M.call}からの電話`, who: M.look, rightLabel: M.call, rightBg: '#d8d0b8' });
      const lines = c.ym >= 200712 && c.year <= 2009
        ? ['「ねんきん特別便」っていうのが届いて{ne}。\n若いころ働いてた会社の記録が、抜けてる{nda}。', 'このままだと、もらえる年金が減るらしい{yo}。\n…ちゃんと払ってたのに{ne}。']
        : c.year >= 2019 ? ['テレビで、「老後に2000万円たりない」って\n話をまたやっ{teru}{yo}。', '{me}たちの年金だけじゃ、毎月赤字{dap}。\n貯金を取りくずして、なんとかやっ{teru}けど{ne}。']
          : c.year >= 1995 ? ['年金をもらえるのが、65歳からに\nなるらしい{yo}。', '{me}たち、あと何年働けばいい{no}かな。\n…{you}の世代は、もっと大変{dap}よ{ne}。']
            : [c.year === 1987 ? '年金っていうのは、ちゃんともらえるのかね。\n去年から、しくみが変わったらしい{yo}。' : '年金っていうのは、ちゃんともらえるのかね。\n…年寄りは、どんどん増える{nda}し。', '{me}たちは、まだいい{yo}。\n{you}たちの世代は、どうなる{no}かね。'];
      await famSay(g, M, lines);
      const k = await ask(g, null, '（どうする…？）', [c.ym >= 200712 && c.year <= 2009 ? '記録をいっしょに探す' : '家計をいっしょに見る', 'お金を送る', '大丈夫だよと言う']);
      let out;
      if (k === 0) {
        await narr(g, c.ym >= 200712 && c.year <= 2009 ? `（昔の給与明細や、会社の名前を思い出してもらい、\n${c.year >= 2010 ? '年金事務所' : '社会保険事務所'}に問い合わせることにした）` : '（電話で、毎月の出入りをいっしょに書き出した。\n…思っていたより、ずっと苦しい）');
        famAff(g, M, 3); out = 'help';
      } else if (k === 1) {
        const p = money(g, 20000);
        await narr(g, `（${fmtMoney(p)}を送った）`);
        famAff(g, M, 2); out = 'money';
      } else {
        await narr(g, '（「大丈夫だよ」と言った。\n…自分の老後のことは、考えないようにした）');
        out = 'reassure';
      }
      stress(g, 4);
      S.hide();
      return { pick: out };
    },
  },

  // ================================================================ 地上げ（昭和のバブル）
  jiage: {
    name: '地上げ屋（バブル期）', cat: 'money', where: 'home_return', weight: 1.2, cool: 300,
    ok: (g, c) => c.year >= 1986 && c.year <= 1990 && c.dotsou,
    async run(g, c, data, open) {
      const oya = PEOPLE.oya ? { name: PEOPLE.oya.name, look: PEOPLE.oya.look, id: 'oya' } : { name: '大家さん', look: LOOKS.oldwoman };
      const S = open('apart', { title: 'ドット荘の前', sub: '黒い車が止まっている', who: LK.jiage, who2: oya.look, car: true, trash: true });
      await narr(g, '（ドット荘の前に、ゴミがまき散らされていた。\n黒い車から降りてきた男が、大家さんと話している）');
      await say(g, W_.jiage, ['大家さん、そろそろ決めてくださいよ。\nこんな古いアパート、持っててもしかたないでしょう。', '住人のみなさんには、立ち退き料をはずみますよ。\n…夜道には、気をつけてくださいね。']);
      await say(g, oya, ['ここはね、亡くなった主人と建てたの。\n…売るつもりは、ありません。']);
      const k = await ask(g, null, '（どうする…？）', ['大家さんの味方をする', '立ち退き料の話を聞く', '関わらない']);
      let out;
      if (k === 0) {
        await narr(g, '（「いやがらせは、警察と弁護士に相談します」\nと、男の前に立った）');
        await say(g, W_.jiage, ['…ほう。威勢のいいのがいるね。\nまあ、今日のところは帰りますよ。']);
        aff(g, 'oya', 5); stress(g, 6); out = 'stand';
        schedule(g, 'jiage_after', rint(10, 18), { stand: true });
      } else if (k === 1) {
        const pay = 300000;
        await say(g, W_.jiage, [`あなたが出ていってくれるなら、${fmtMoney(pay)}。\n…それと、大家さんを説得してくれたら、\nもっと出しますよ。`]);
        const k2 = await ask(g, null, '（大家さんが、こちらを見ている…）', ['やっぱり断る', 'お金を受け取る']);
        if (k2 === 1) { g.addMoney(pay, true); aff(g, 'oya', -10); await narr(g, `（${fmtMoney(pay)}を受け取った。\n大家さんは、何も言わずに部屋に戻っていった）`); out = 'took'; }
        else { await narr(g, '（「やっぱり、けっこうです」と断った）'); aff(g, 'oya', 2); out = 'refused'; }
        schedule(g, 'jiage_after', rint(10, 18), { stand: false });
      } else {
        await narr(g, '（目を合わせないように、部屋に入った。\n…その夜、ドアを叩く音で何度も目が覚めた）');
        stress(g, 5); out = 'ignore';
        schedule(g, 'jiage_after', rint(10, 18), { stand: false });
      }
      S.hide();
      return { pick: out };
    },
  },
  jiage_after: {
    name: '地上げのその後', cat: 'money', story: true, passive: true,
    run(g, c, data) {
      news(g, '地価の高騰が続く都心で、古いアパートの住人に立ち退きを迫る「地上げ」をめぐるトラブルが相次いでいる。');
      if (PEOPLE.oya) g.message({ from: PEOPLE.oya.name, person: 'oya', kind: 'chat', text: flat(g.fmt(data.stand ? 'あの不動産屋さん、来なくなったわ。弁護士の先生にも入ってもらったの。…あのとき、前に立ってくれてありがとうね。' : 'あの不動産屋さん、まだ来るのよ。でも、わたしは売らないわ。ここは、みんなの家だもの。')) });
      return { out: data.stand ? 'gone' : 'still' };
    },
  },

  // ================================================================ 困窮（自分の暮らし）
  kyubo: {
    name: '生活の困窮（自分）', cat: 'money', where: 'home_return', weight: 2, cool: 40,
    ok: (g, c) => c.money < 1500 && ((g.state.rent && num(g.state.rent.debt) > 0) || g.state.life.hunger < 35),
    async run(g, c, data, open) {
      const st = g.state;
      const L = landlord(g, c);
      const S = open('room', { title: '自宅', sub: '財布の中は、小銭だけ', dark: true });
      await narr(g, `（財布には、${fmtMoney(st.money)}。\n冷蔵庫は、からっぽだ…）`);
      let out;
      if (L.id) {
        S.set('room', { title: '自宅', sub: 'ドアをノックする音', dark: true, who: L.look, whoX: 380, food: true });
        await say(g, L, ['作りすぎちゃったの。\nよかったら、もらってくれない？', 'お家賃のことは、あとでいいから。\nまず、ちゃんと食べなさい。']);
      } else {
        await narr(g, c.year >= 2002 ? '（区役所で相談すると、フードバンクの食料と、\n生活の相談窓口を教えてもらえた）' : '（区役所で相談すると、福祉の窓口を教えてもらえた。\n帰りに、知り合いの店がおにぎりを持たせてくれた）');
      }
      const k = await ask(g, null, '（どうする…？）', ['ありがたく受け取る', '意地を張って断る']);
      if (k === 0) {
        g.giveItem('onigiri', 3, true);
        await narr(g, L.id ? '（おにぎり×3をもらった。\n…あたたかかった）' : '（食べものを分けてもらった。おにぎり×3。\n…少しだけ、ほっとした）');
        if (L.id) aff(g, L.id, 2);
        stress(g, -5); out = 'took';
      } else {
        await narr(g, '（「大丈夫です」と、断ってしまった）');
        stress(g, 5); out = 'refused';
      }
      S.hide();
      return { pick: out };
    },
  },
};
for (const [id, E] of Object.entries(EV)) E.id = id;

// The cult: the problem group of the government core (fictional), else a fictional name.
function cultName() {
  try {
    const R = GOVT && GOVT.RELIGIOUS_GROUPS;
    if (R) { const p = Object.values(R).find((x) => x && x.problem && x.fictional); if (p && p.name) return p.name; }
  } catch (e) { /* fall back */ }
  return '蒼穹の泉';
}
// The crime app (another module, optional): when it exposes a way to show a recruitment listing, the
// 闇バイト post the fan answered shows up there too. Feature-detected only (no import of a file that may not exist).
function crimeAppTouch(g, kind) {
  try {
    const api = (typeof window !== 'undefined' && (window.__crimeApp || window.__crime_app)) || null;
    const fn = api && (api.addListing || api.addOffer || api.post);
    if (typeof fn === 'function') fn.call(api, g, { kind, crime: 'fraud_courier', from: 'yami', title: '【ホワイト案件】即日高収入・荷物の受け取り' });
  } catch (e) { console.error(e); }
}

// ======================================================================== news pool (era-gated)
// { id, when(c), text(c) } — at most one yami message a morning; each id once in NEWS_REPEAT days.
const NEWS = [
  { id: 'karoshi110', when: (c) => c.ym >= 198806 && c.year <= 1999, text: () => '弁護士や医師らが開く電話相談「過労死110番」に、働きざかりの夫を亡くした家族からの相談が相次いでいる。' },
  { id: 'karoshi_case', when: (c) => c.year >= 1988, text: () => '運送会社のドライバーの男性（44）が、勤務中に倒れて死亡。直前の1か月の残業は100時間を超えていたとみられ、遺族が労災を申請した。' },
  { id: 'karoshi_law', when: (c) => c.year >= 2016, text: (c) => `過労死等防止対策推進法の施行から${c.year - 2014}年。長時間労働で倒れる人は、いまも後を絶たない。` },
  { id: 'jogen', when: (c) => c.year >= 2020, text: () => '残業時間の上限規制（原則は月45時間・年360時間）が始まって数年。「仕事を家に持ち帰るだけになった」との声もある。' },
  { id: 'jisatsu_3man', when: (c) => c.year >= 1999 && c.year <= 2012, text: () => '昨年の全国の自殺者は、3万人を超えた。3万人を超える年は、1998年から続いている。' },
  { id: 'jisatsu_law', when: (c) => c.year >= 2007 && c.year <= 2012, text: () => '2006年に自殺対策基本法が施行され、国と自治体が対策を進めている。悩みを相談できる窓口も広がっている。' },
  { id: 'jisatsu_2025', when: (c) => c.year === 2026, text: () => '昨年の全国の自殺者は約1万9千人で、統計のある1978年以降で初めて2万人を下回った。一方、小中高生は500人を超え、過去最多となった。' },
  { id: 'netcafe', when: (c) => c.ym >= 200708 && c.year <= 2008, text: () => '住まいを失い、ネットカフェなどで寝泊まりしながら働く人が、全国で約5400人いると、厚生労働省が推計した。' },
  { id: 'hakenmura', when: (c) => c.ym >= 200901 && c.ym <= 200903, text: () => '年末年始に東京・日比谷公園に開かれた「年越し派遣村」には、職と住まいを失った人たち約500人が身を寄せた。' },
  { id: 'hakengiri', when: (c) => c.ym >= 200811 && c.ym <= 200912, text: () => '景気の急速な悪化で、製造業を中心に派遣社員の契約打ち切り、いわゆる「派遣切り」が相次いでいる。' },
  { id: 'working_poor', when: (c) => c.ym >= 200608, text: () => '働いても生活が苦しい「ワーキングプア」。非正規で働く人の多くが、年収200万円に届かないという。' },
  { id: 'restra', when: (c) => c.year >= 1993 && c.year <= 2003, text: () => '大手メーカーが、中高年の社員を対象に希望退職を募集。「リストラ」の波が広がっている。' },
  { id: 'hyogaki', when: (c) => c.year >= 1995 && c.year <= 2005, text: () => '企業が新卒の採用をしぼり込み、大学生の就職が厳しい。「就職氷河期」と呼ばれている。' },
  { id: 'jiage', when: (c) => c.year >= 1987 && c.year <= 1990, text: () => '地価の高騰が続く都心で、古いアパートの住人に立ち退きを迫る「地上げ」をめぐるトラブルが相次いでいる。' },
  { id: 'reikan', when: (c) => c.year >= 1987 && c.year <= 1995, text: () => '先祖の因縁などを持ち出して、高額な壺や印鑑を売りつける「霊感商法」の被害の相談が、消費生活センターに相次いでいる。' },
  { id: 'genya', when: (c) => c.year >= 1987 && c.year <= 1990, text: () => '「値上がり確実」とうたって、ほとんど価値のない土地を売りつける「原野商法」の被害が、お年寄りに広がっている。' },
  { id: 'kakuu', when: (c) => c.year >= 2004 && c.year <= 2007, text: () => '身に覚えのない料金を請求するハガキやメール、いわゆる「架空請求」の相談が急増している。' },
  { id: 'kifu', when: (c) => c.year >= 2024, text: (c) => `不当な寄附の勧誘を禁じる法律の施行から${c.year - 2023}年。高額献金の被害の相談は、いまも寄せられている。` },
  { id: 'yamibaito', when: (c) => c.year >= 2023, text: () => 'SNSで「高額バイト」とうたって集めた若者に、強盗や特殊詐欺をさせる事件が後を絶たない。' },
  { id: 'tokuryu', when: (c) => c.year >= 2024, text: () => '警察は、SNSで集まっては離れる犯罪グループを「匿名・流動型犯罪グループ（トクリュウ）」と呼び、取り締まりを強めている。' },
  { id: 'sns_toushi', when: (c) => c.year >= 2024, text: () => '著名人になりすましたSNSの広告で投資に誘う「SNS型投資詐欺」や、恋愛感情につけこむ「ロマンス詐欺」の被害が、急増している。' },
  { id: 'bujoku', when: (c) => c.ym >= 202208, text: () => 'ネットの誹謗中傷で、投稿者を特定して訴える人が増えている。侮辱罪は2022年に厳罰化された。' },
  { id: 'taima', when: (c) => c.year >= 2025, text: () => '2024年12月から、大麻を「使う」ことも罪になった。検挙される人の多くは、20代だという。' },
  { id: 'kiken_drug', when: (c) => c.ym >= 201408 && c.year <= 2016, text: () => '「脱法ドラッグ」から呼び名が改められた「危険ドラッグ」。吸った人が意識を失い、事故を起こす例が相次いでいる。' },
  { id: 'shinner', when: (c) => c.year <= 1995, text: () => '若者のシンナー遊びが、各地で問題になっている。補導された少年の中には、中学生もいるという。' },
  { id: 'kodoku', when: (c) => c.year >= 1995, text: () => '団地の一室で、ひとり暮らしの男性（70代）が亡くなっているのが見つかった。亡くなってから、数週間がたっていたとみられる。' },
  { id: 'kodoku_old', when: (c) => c.year < 1995, text: () => 'ひとり暮らしのお年寄りが、亡くなってから何日も気づかれない例が、都市部で増えている。' },
  { id: 'hikikomori', when: (c) => c.year >= 2023, text: () => '国の調査（2023年公表）では、15〜64歳で「ひきこもり」の状態にある人は、全国で約146万人と推計されている。' },
  { id: '8050', when: (c) => c.year >= 2019, text: () => '80代の親が、50代のひきこもりの子を支える「8050問題」。親が亡くなったあと、暮らしが立ちゆかなくなる例もある。' },
  { id: 'ijime', when: (c) => c.year >= 2014, text: () => 'いじめで心身に大きな被害が出た「重大事態」をめぐり、学校の調査のあり方を問う声が各地で上がっている。' },
  { id: 'tokokyohi', when: (c) => c.year <= 1997, text: () => '学校に行けない、行かない子どもの「登校拒否」が増えている。いじめが、きっかけになることも多いという。' },
  { id: 'futoko', when: (c) => c.year >= 2010, text: () => '不登校の小中学生が増えている。フリースクールなど、学校の外の学びの場も広がりつつある。' },
  { id: 'kaigo_rishoku', when: (c) => c.year >= 2013, text: () => '家族の介護のために仕事を辞める「介護離職」は、年間約10万人にのぼる。' },
  { id: 'roro', when: (c) => c.year >= 2005, text: () => '65歳以上の人が、65歳以上の家族を介護する「老老介護」が増えている。' },
  { id: 'nenkin_kiroku', when: (c) => c.ym >= 200706 && c.year <= 2009, text: () => '持ち主のわからない年金の記録が、約5000万件あることがわかった。国は、加入者に確認を求める「ねんきん特別便」を送っている。' },
  { id: 'nenkin_2000', when: (c) => c.year >= 2020, text: () => '「老後に2000万円が不足する」とした金融庁の審議会の報告書（2019年）から数年。老後のお金への不安は、いまも根強い。' },
  { id: 'dv', when: (c) => c.year >= 2002, text: () => '配偶者や交際相手からの暴力（DV）の相談が、後を絶たない。各地の相談支援センターや警察に、相談が寄せられている。' },
  { id: 'dv_old', when: (c) => c.year < 2001, text: () => '夫の暴力から逃れた女性と子どもを、一時的にかくまう民間の施設が、都市部で少しずつ広がっている。' },
  { id: 'sekuhara89', when: (c) => c.year >= 1989 && c.year <= 1990, text: () => '「セクシャル・ハラスメント」という言葉が、広く知られるようになった。職場での性的ないやがらせを問う裁判も始まっている。' },
  { id: 'pawahara_law', when: (c) => c.ym >= 202204, text: () => '職場のパワハラを防ぐ措置は、2022年4月から中小企業にも義務づけられている。それでも、相談の件数は高い水準が続いている。' },
  { id: 'geinou_kosei', when: (c) => c.year >= 2019, text: () => '公正取引委員会は、芸能事務所がタレントの移籍や独立を不当に妨げることは、独占禁止法上の問題になりうるとの考えを示している。' },
  { id: 'seiho', when: (c) => c.year >= 2017, text: () => '生活保護を受けている世帯の半分以上が、高齢者の世帯になった。年金だけでは暮らせない人が増えている。' },
];
function newsTick(g, opts = {}) {
  const d = Y(g), st = g.state, day = st.day;
  if (!opts.force && (d.msgDay === day || day - d.newsLast < NEWS_GAP || !roll(NEWS_CHANCE))) return null;
  const c = ctxOf(g);
  const pool = NEWS.filter((n) => (!opts.id || n.id === opts.id) && (opts.force || !(d.newsSeen[n.id] && day - d.newsSeen[n.id] < NEWS_REPEAT)) && (() => { try { return n.when(c); } catch (e) { return false; } })());
  if (!pool.length) return null;
  const n = pickOne(pool);
  d.newsSeen[n.id] = day;
  d.newsLast = day;
  d.msgDay = day;
  news(g, n.text(c));
  d.log.push({ day, id: 'news', news: n.id, passive: true });
  while (d.log.length > LOG_MAX) d.log.shift();
  return n.id;
}

// ======================================================================== running events
async function runEvent(g, id, opts = {}) {
  const E = EV[id];
  if (!E || !g.state) return null;
  const st = g.state, d = Y(g);
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
    if (!E.passive && !opts.noSlot && g.state === st) d.last = Math.max(num(d.last), num(st.day));
    for (const sc of rec.stages) g.pop(sc);
    delete rec.stages;
    d.log.push(rec);
    while (d.log.length > LOG_MAX) d.log.shift();
  }
  if (!E.passive && g.map && g.map.place && g.top === g.map) { try { g.save(true); } catch (e) { console.error(e); } }
  return rec;
}
// Work events happen at the studios, theaters and agencies (the companies' buildings); when none of them is
// registered (a module failed), any building that is not home will do.
const WORK_PLACES = ['yoshimoto', 'shinkigeki', 'bs_yoshimoto', 'shochiku', 'grape', 'nhk', 'toei', 'horipro', 'toho', 'ntv', 'tbs', 'tvasahi', 'fujitv', 'tvtokyo', 'osaka_tv'];
function workPlace(pid) {
  if (WORK_PLACES.includes(pid)) return true;
  return !WORK_PLACES.some((id) => PLACES[id]);
}
function canStart(g) {
  const st = g.state;
  if (!st || !g.map || !g.map.place || RUNNING) return false;
  if (g.busy || g.top !== g.map || g.fade > 0) return false;
  if (g.map.player && g.map.player.moving) return false;
  if (!free(g) || NO_EVENT_PLACES.has(g.map.placeId)) return false;
  if (regimeQuiet(g)) return false;
  const ds = darkState(g);
  if (ds && num(ds.hospUntil) > st.day) return false;
  return true;
}
function whereOk(g, E, pd, how) {
  const d = Y(g), st = g.state, pid = g.map.placeId, place = g.map.place;
  if (pd.anywhere) return true;
  let w = E.where || 'any';
  if (pd.follow && num(pd.tries) >= 2) w = 'any'; // an arc step missed twice: any moment will do
  const home = homePlace(g);
  // 'any': a call or a message that needs no place, once the day has begun (the player went out today);
  // an arc step that was missed twice takes the first free moment
  if (w === 'any') return how === 'script' && (d.awayDay === st.day || (pd.follow && num(pd.tries) >= 2));
  if (w === 'town') return how === 'step' && place.kind === 'town' && d.townSteps >= num(pd.steps, 20);
  if (w === 'home_return') return how === 'script' && pid === home && d.awayDay === st.day;
  if (w === 'place') return how === 'script' && pid !== home && place.kind !== 'town' && workPlace(pid);
  return false;
}
function tryRun(g, how) {
  const d = Y(g), pd = d.pending;
  if (!pd || !canStart(g)) return false;
  const E = EV[pd.id];
  if (!E) { d.pending = null; return false; }
  if (!whereOk(g, E, pd, how)) return false;
  // not on a day darkside already ran its event
  const ds = darkState(g);
  if (ds && num(ds.last) === g.state.day && !pd.follow) return false;
  d.pending = null;
  let still = true;
  try { still = !E.ok || !!E.ok(g, ctxOf(g), pd.data || {}); } catch (e) { console.error(e); still = false; }
  if (!still) return false;
  g.run(() => runEvent(g, pd.id, { data: pd.data || {}, follow: pd.follow }));
  return true;
}
function setPending(g, id, o = {}) {
  const d = Y(g);
  d.pending = { id, day: g.state.day, follow: !!o.follow, data: o.data || {}, tries: num(o.tries), steps: rint(15, 45) };
  d.townSteps = 0;
  return d.pending;
}
// The morning decision: a due arc step (passive steps are sent here), else a new event after the gap.
function decide(g, opts = {}) {
  const st = g.state, d = Y(g), day = st.day;
  if (d.pending && !opts.force) return d.pending;
  if (regimeQuiet(g) && !opts.force) return null;
  const ds = darkState(g);
  if (!opts.force && ds && ds.pending) return null; // darkside has today's slot
  const c = ctxOf(g);
  d.follow.sort((a, b) => a.day - b.day);
  const lastDark = ds ? num(ds.last) : 0;
  // story steps: at least STEP_GAP days after the last yami event and two days after a darkside one
  if (opts.force || (day - d.last >= STEP_GAP && day - lastDark >= 2)) {
    for (let i = 0; i < d.follow.length; i++) {
      const f = d.follow[i];
      if (f.day > day) break;
      const E = EV[f.id];
      if (!E || E.passive) continue;
      if (opts.only && !opts.only.includes(f.id)) continue;
      let ok = true;
      try { ok = !E.ok || E.ok(g, c, f.data || {}); } catch (e) { console.error(e); ok = false; }
      d.follow.splice(i, 1);
      if (!ok) { i--; continue; }
      return setPending(g, f.id, { follow: true, data: f.data, tries: f.tries });
    }
  }
  if (!opts.force) {
    if (day < GRACE || day - d.last < NEW_GAP || day - lastDark < SHARED_GAP) return null;
    if (d.follow.some((f) => EV[f.id] && !EV[f.id].passive)) return null; // a story is waiting for its step
    if (!roll(DAY_CHANCE)) return null;
  }
  const busyArc = activeArcs(g).length > 0;
  const pool = [];
  for (const [id, E] of Object.entries(EV)) {
    if (E.story || E.passive) continue;
    if (opts.only && !opts.only.includes(id)) continue;
    if (E.arc && busyArc && !opts.force) continue;
    if (!opts.ignoreCool && d.lastId[id] && day - d.lastId[id] < (E.cool || 60)) continue;
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
  return setPending(g, id, {});
}
// Passive steps (a message, a news story) that are due arrive in the morning; one a morning.
function passiveSteps(g) {
  const d = Y(g), day = g.state.day;
  if (d.msgDay === day) return null;
  d.follow.sort((a, b) => a.day - b.day);
  for (let i = 0; i < d.follow.length; i++) {
    const f = d.follow[i];
    const E = EV[f.id];
    if (!E || !E.passive || f.day > day) continue;
    d.follow.splice(i, 1);
    let ok = true;
    try { ok = !E.ok || E.ok(g, ctxOf(g), f.data || {}); } catch (e) { console.error(e); ok = false; }
    if (!ok) { i--; continue; }
    const rec = { day, id: f.id, picks: [], passive: true };
    try { rec.result = E.run(g, ctxOf(g), f.data || {}) ?? null; } catch (e) { console.error(e); rec.error = String(e); }
    d.lastId[f.id] = day;
    d.counts[f.id] = num(d.counts[f.id]) + 1;
    d.log.push(rec);
    while (d.log.length > LOG_MAX) d.log.shift();
    d.msgDay = day;
    return f.id;
  }
  return null;
}
function observe(g) {
  const d = Y(g), pid = g.map.placeId, day = g.state.day;
  if (!pid) return;
  if (pid !== homePlace(g) && g.map.place && g.map.place.kind !== undefined) d.awayDay = day;
}

// ======================================================================== hooks into the game
const proto = Game.prototype;
const wrap = (name, make) => {
  const orig = proto[name];
  if (typeof orig !== 'function' || orig.__yami) return;
  const w = make(orig);
  w.__yami = true;
  proto[name] = w;
};
wrap('afterScript', (orig) => function () {
  const r = orig.call(this);
  try {
    if (this.state && this.map && this.map.place && !RUNNING) {
      observe(this);
      if (!this.busy) tryRun(this, 'script');
    }
  } catch (e) { console.error(e); }
  return r;
});
wrap('onWalkStep', (orig) => function () {
  const r = orig.call(this);
  try {
    if (this.state && this.map && this.map.place && !RUNNING) {
      const d = Y(this);
      if (d.pending) {
        if (this.map.place.kind === 'town') d.townSteps++;
        const E = EV[d.pending.id];
        if (E && (E.where === 'town' || (d.pending.follow && num(d.pending.tries) >= 2)) && !this._yamiWait) waitFree(this, 40);
      }
    }
  } catch (e) { console.error(e); }
  return r;
});
function waitFree(g, tries) {
  g._yamiWait = true;
  g.wait(16).then(() => {
    try {
      if (tryRun(g, 'step') || tries <= 0 || !Y(g).pending || g.busy) { g._yamiWait = false; return; }
      waitFree(g, tries - 1);
    } catch (e) { console.error(e); g._yamiWait = false; }
  });
}

onMorning((g) => {
  const st = g.state;
  if (!st || !st.flags) return;
  const d = Y(g);
  if (d.pending && d.pending.day < st.day) {
    const pd = d.pending;
    d.pending = null;
    if (pd.follow && num(pd.tries) < 5) d.follow.push({ id: pd.id, day: st.day + rint(1, 2), data: pd.data, tries: num(pd.tries) + 1 });
  }
  d.townSteps = 0;
  if (d.hosareUntil && d.hosareUntil <= st.day) {
    d.hosareUntil = 0;
    (g.morningNotes || (g.morningNotes = [])).push('（しばらく止まっていた仕事の電話が、\nまた少しずつ鳴りはじめた）');
  }
  if (!free(g) || regimeQuiet(g)) return;
  passiveSteps(g);
  decide(g);
  newsTick(g);
});

// ======================================================================== the people of the arcs, on the map
// While an arc runs, the cast member greets the player in its mood and has a 「最近どう？」 entry (once a step).
const ARC_CAST = {
  karou: { id: 'yoruno', greet: 'あ、{name}さん…。すみません、ちょっと\nぼーっとしてて。…大丈夫です、起きてます。', talk: ['…じつは、まだあんまり眠れてなくて。', 'でも、{name}さんと話すと、\nちょっとだけ、ちゃんとしようって思えます。'] },
  hinkon: { id: 'jiro', greet: 'おう、{name}。…今日は、ネタの調子はぼちぼちや。', talk: ['…ほんまは、腹へってネタどころやないねん。', 'けど、おまえの顔見たら、\nもうちょっと踏んばろかって気になるわ。'] },
  dv: { id: 'kaori', greet: '{name}…。来てくれたんだ。\n…あ、ううん、なんでもないの。', talk: ['…このあいだのメモ、まだ持ってるよ。', '話を聞いてくれる人がいるって、\nそれだけで、ちょっと息ができる気がする。'] },
  shitsugyo: { id: 'maruyama', greet: '{name}どの…。\n…いや、今日はふつうに「こんにちは」です。', talk: ['…会社のことは、まだどうなるかわかりません。', 'でも、ここで刀を振っていると、\n自分がまだ自分でいられる気がするんです。'] },
};
function arcOfCast(g, id) {
  const d = Y(g);
  for (const [key, A] of Object.entries(ARC_CAST)) { const a = d.arcs[key]; if (A.id === id && arcActive(a) && a.who === id) return [key, a, A]; }
  return null;
}
try {
  const hooks = PEOPLE_UI.hooks || (PEOPLE_UI.hooks = {});
  if (!Array.isArray(hooks.greet)) hooks.greet = [];
  hooks.greet.push((g, id) => { try { const x = arcOfCast(g, id); return x ? g.fmt(x[2].greet) : null; } catch (e) { return null; } });
  if (!Array.isArray(PEOPLE_UI.extras)) PEOPLE_UI.extras = [];
  PEOPLE_UI.extras.push({
    id: 'yami_arc_talk', label: '最近どう？', order: 40, repeat: true,
    cond: (g, id) => { const x = arcOfCast(g, id); return !!x && x[1].talked !== x[1].step; },
    run: async (g, id) => {
      const x = arcOfCast(g, id);
      if (!x) return;
      const [, a, A] = x;
      const P = PEOPLE[id];
      a.talked = a.step;
      a.care += 1;
      await g.say(A.talk.map((s) => g.fmt(s)), { name: P.name, look: P.look });
      try { g.addAff(id, 2, true); g.addNeed('stress', -2); } catch (e) { console.error(e); }
    },
  });
} catch (e) { console.error('[yami] people hooks', e); }

// ======================================================================== API
export const YAMI = {
  EVENTS: EV,
  NEWS,
  get rng() { return RNG; },
  set rng(fn) { RNG = typeof fn === 'function' ? fn : Math.random; },
  state: (g) => Y(g),
  ctx: (g) => ctxOf(g),
  decide: (g, opts) => decide(g, opts),
  run: (g, id, opts = {}) => runEvent(g, id, opts),
  schedule: (g, id, inDays, data) => schedule(g, id, inDays, data),
  news: (g, opts) => newsTick(g, opts),
  passive: (g) => passiveSteps(g),
  hosare: (g) => Math.max(0, num(Y(g).hosareUntil) - g.state.day),
  async flush(g) {
    const d = Y(g), pd = d.pending;
    if (!pd || !EV[pd.id]) return null;
    d.pending = null;
    return runEvent(g, pd.id, { data: pd.data || {}, follow: pd.follow });
  },
};
if (typeof window !== 'undefined') window.__yami = YAMI;
