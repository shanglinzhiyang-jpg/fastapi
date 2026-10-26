// 恋愛・結婚・家庭 (R12-L1) — the core: state, the people you may fall in love with, stages, the morning, hooks.
//
// A gentle life-sim layer: it never starts unless the player opens the phone app 「恋のはなし」 and says whom they have
// in mind (男性 / 女性 / どちらでも / いまは考えない). Nothing here is mandatory and nothing blocks the main game.
// Tasteful and era-accurate (昭和の見合い・職場恋愛 / 平成のポケベル・ケータイ / 令和のアプリ); never explicit.
//
// State: g.state.flags.rom  (lazy, repaired once per state object)
//   { v, pref: null|'m'|'f'|'any'|'off', rs (seeded rng), seq, c: { [pid]: REC }, lead: pid|null, taste: { tag: n },
//     inv: [invitations], q: [queued events], last: { day, msg, enc, date, … }, hist: [{ d, t }], album: [{ k, d, cap }],
//     home: { hn (household name), maiden, work, callMode, … }, kids: [{ id, n, g, b, ls, by }], preg, leave, tip }
//   REC = { id, g:'m'|'f', fam, giv, n, age, met (game day), jb, per, tags[3], val:{k,w}, dia, hm, ls (look seed), fp, bd (birthday
//           offset), via, st: 'know'|'close'|'dating'|'cohab'|'engaged'|'married'|'ex', since, dates, ld (last date), mo (mood 0..100),
//           lc (last contact), conf:{n,day}, att ('warm'|'worry'|'strict'), cast?:1 (a person of the cast: people.js) }
// Generated people are registered as PEOPLE ('rm1' …) like anybody else, so contacts / gifts / calls / messages just work.
//
// Other modules: romance_meet.js (出会い), romance_date.js (デート・告白), romance_wed.js (同棲・プロポーズ・結婚・離婚),
// romance_kids.js (妊娠・子ども), romance_scene.js + romance_art.js (HD scenes), romance_ui.js (the app, てちょう, アルバム).
// Messages: at most one romance message a morning (romMessage). Events that need a scene are queued (queueEvent) and run
// right after waking (runQueue), one a morning at most.

import { registerPerson, PEOPLE, onMorning, MORNING_HOOKS } from './life.js';
import { Game } from './game.js';
import { registerItem, ITEMS } from './state.js';
import { profileOf, ageOf, PREFECTURES, prefecture, regionOf, YEAR_DAYS } from './profile.js';
import { COLORS } from './draw.js';
import { clamp, mulberry32, fmtMoney } from './util.js';
import * as D from './romance_data.js';
import { smallTalk, seasonLine, MISS_YOU, COLD_TALK, callYou } from './romance_lines.js';

const num = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const flat = (s) => String(s).replace(/\n/g, '');
export { D };

// ---------------------------------------------------------------- the cast (people.js) who can be loved
// g: their gender; age; per: personality (romance_data PERS); tags; jb: job key; vari: how the story reads.
export const CAST = {
  haruto: { g: 'm', age: 22, per: 'yasashii', tags: ['book', 'quiet', 'indoor'], jb: 'gakusei' },
  chiyo: { g: 'f', age: 23, per: 'majime', tags: ['gourmet', 'quiet', 'book'], jb: 'geinou' },
  mio: { g: 'f', age: 27, per: 'ganbariya', tags: ['sports', 'talk', 'music'], jb: 'geinou' },
  kaori: { g: 'f', age: 25, per: 'genki', tags: ['music', 'outdoor', 'talk'], jb: 'artist' },
  momo: { g: 'f', age: 23, per: 'akarui', tags: ['warai', 'talk', 'outdoor'], jb: 'geinou' },
  takeru: { g: 'm', age: 24, per: 'ganbariya', tags: ['warai', 'sports', 'talk'], jb: 'geinou' },
  jiro: { g: 'm', age: 28, per: 'akarui', tags: ['warai', 'talk', 'gourmet'], jb: 'geinou' },
  asagiri: { g: 'f', age: 24, per: 'majime', tags: ['book', 'quiet', 'indoor'], jb: 'kaisha' },
  emikawa: { g: 'm', age: 30, per: 'shikkari', tags: ['warai', 'talk', 'gourmet'], jb: 'geinou' },
  korosuke: { g: 'm', age: 21, per: 'genki', tags: ['warai', 'sports', 'outdoor'], jb: 'geinou' },
};

// ---------------------------------------------------------------- state
const READY = new WeakSet();
const seedFor = (st) => {
  const p = st.profile || {};
  return (D.hashStr(`${p.familyName || ''}|${p.givenName || st.name || ''}|${p.hometown || ''}|${p.era || ''}`) ^ 0x9e3779b9) >>> 0;
};
export function rom(g) {
  const st = g && g.state;
  if (!st) return null;
  const fl = st.flags || (st.flags = {});
  let R = fl.rom;
  if (!isObj(R)) R = fl.rom = {};
  if (READY.has(R)) return R;
  R.v = 1;
  R.pref = ['m', 'f', 'any', 'off'].includes(R.pref) ? R.pref : null;
  R.rs = Number.isFinite(Number(R.rs)) && R.rs !== 0 ? Number(R.rs) >>> 0 : seedFor(st);
  R.seq = Math.max(0, Math.floor(num(R.seq)));
  if (!isObj(R.c)) R.c = {};
  for (const id of Object.keys(R.c)) {
    const r = R.c[id];
    if (!isObj(r) || !D.STAGES[r.st]) { delete R.c[id]; continue; }
    r.id = id;
    r.st = D.STAGES[r.st] ? r.st : 'know';
    r.dates = Math.max(0, Math.floor(num(r.dates)));
    r.mo = clamp(Math.round(num(r.mo, 50)), 0, 100);
    r.since = Math.max(1, Math.floor(num(r.since, st.day || 1)));
    r.met = Math.max(1, Math.floor(num(r.met, st.day || 1)));
    r.ld = Math.floor(num(r.ld, 0));
    r.lc = Math.floor(num(r.lc, r.met));
    r.age = clamp(Math.floor(num(r.age, 22)), 18, 90);
    if (!Array.isArray(r.tags)) r.tags = [];
    if (!isObj(r.val)) r.val = { k: 1, w: 1 };
    if (!D.PERS[r.per]) r.per = 'yasashii';
    if (r.g !== 'm' && r.g !== 'f') r.g = 'f';
  }
  if (R.lead && !R.c[R.lead]) R.lead = null;
  R.lead = R.lead || null;
  if (!isObj(R.taste)) R.taste = {};
  R.inv = Array.isArray(R.inv) ? R.inv.filter(isObj).slice(0, 8) : [];
  R.q = Array.isArray(R.q) ? R.q.filter(isObj).slice(0, 8) : [];
  R.last = isObj(R.last) ? R.last : {};
  R.hist = Array.isArray(R.hist) ? R.hist.filter(isObj).slice(-40) : [];
  R.album = Array.isArray(R.album) ? R.album.filter(isObj).slice(-30) : [];
  R.home = isObj(R.home) ? R.home : {};
  R.kids = Array.isArray(R.kids) ? R.kids.filter(isObj).slice(0, 8) : [];
  R.preg = isObj(R.preg) ? R.preg : null;
  R.leave = isObj(R.leave) ? R.leave : null;
  R.stat = isObj(R.stat) ? R.stat : {};
  READY.add(R);
  return R;
}
export const active = (g) => { const R = rom(g); return !!R && (R.pref === 'm' || R.pref === 'f' || R.pref === 'any'); };
// Was the track ever started (a partner, a family)? The family stays in the game even if the player later says "いまは考えない".
export const hasLife = (g) => { const R = rom(g); return !!R && (!!R.lead || R.kids.length > 0 || Object.values(R.c).some((r) => r.st === 'married')); };

export function addHist(g, text) {
  const R = rom(g);
  R.hist.push({ d: g.state.day, t: String(text).slice(0, 80) });
  if (R.hist.length > 40) R.hist.shift();
}
export function addAlbum(g, kind, cap, extra = {}) {
  const R = rom(g);
  R.album.push({ k: kind, d: g.state.day, cap: String(cap).slice(0, 40), ...extra });
  if (R.album.length > 30) R.album.shift();
}

// ---------------------------------------------------------------- looks
const LOOK_CACHE = new Map();
const TOP_M = ['#4a7ab8', '#6a8a4a', '#b85a4a', '#5a5a6a', '#d8a63a', '#7a5ab8', '#3a8a8a'];
const TOP_F = ['#e08a9a', '#f2c6d8', '#8ac0e8', '#b8a0d8', '#f0d070', '#7ac0a0', '#e0795a'];
export function recLook(rec, era) {
  if (rec.cast && PEOPLE[rec.id] && PEOPLE[rec.id].look) return PEOPLE[rec.id].look;
  const work = rec.st === 'know'; // a stranger you met through work looks like their work; people you go out with wear their own clothes
  const key = `${rec.id}|${rec.ls}|${work ? rec.jb : ''}|${rec.g}|${era}`;
  const hit = LOOK_CACHE.get(key);
  if (hit) return hit;
  const r = mulberry32((rec.ls || 1) >>> 0);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const f = rec.g === 'f';
  const modern = era === 'reiwa' || era === 'heisei';
  const look = {
    hair: f ? pick(['long', 'bob', 'long', 'bob', rec.age < 24 ? 'twin' : 'long']) : pick(['short', 'short', 'spiky', 'slick']),
    hairColor: pick(modern ? ['black', 'black', 'brown', 'brown', 'brown'] : ['black', 'black', 'black', 'brown']),
    skin: pick(['fair', 'fair', 'light', 'tan']),
    top: pick(f ? TOP_F : TOP_M),
    bottom: f ? pick(['#3a4a7a', '#5a4a6a', '#8a5a6a', '#3b3f48']) : pick(['#3a4a7a', '#3b3f48', '#5a4a3a']),
  };
  if (f && r() < 0.45) look.skirt = true;
  if (r() < 0.16) look.glasses = true;
  const job = work ? rec.jb : '';
  if (job === 'kaisha' || job === 'ginko' || job === 'koumuin') {
    if (f) Object.assign(look, { top: '#f2f2f2', bottom: '#2a3560', skirt: true, jacket: true });
    else Object.assign(look, { top: '#3b3f48', bottom: '#3b3f48', jacket: true, tie: pick(['#2f9a4a', '#c0452f', '#3a6fd8']) });
  } else if (job === 'kango' || job === 'kangoM') Object.assign(look, { top: '#f2f2f2', bottom: '#f2f2f2', hat: undefined });
  else if (job === 'hoiku') Object.assign(look, { top: '#7ac85a', bottom: '#3a4a7a' });
  else if (job === 'kyoshi') Object.assign(look, f ? { top: '#e8e0d0', bottom: '#4a4a5a', skirt: true, jacket: true } : { top: '#5a6a7a', bottom: '#3b3f48', jacket: true });
  else if (job === 'cook') Object.assign(look, { hair: 'cap', hat: '#f2f2f2', top: '#f2f2f2', bottom: '#3b3f48' });
  else if (job === 'tv') Object.assign(look, { hair: 'cap', hat: '#2a2d36', top: '#3b3f48', bottom: '#2a2d36' });
  else if (job === 'biyo') Object.assign(look, { top: '#1e1e26', bottom: '#1e1e26' });
  if (look.hat === undefined) delete look.hat;
  if (LOOK_CACHE.size > 200) LOOK_CACHE.delete(LOOK_CACHE.keys().next().value);
  LOOK_CACHE.set(key, look);
  return look;
}

// ---------------------------------------------------------------- children (looks and ages)
export const kidAge = (g, k) => (g.state.day - k.b) / YEAR_DAYS;
export const kidYears = (g, k) => Math.max(0, Math.floor(kidAge(g, k)));
export function kidLook(g, k) {
  const st = g.state;
  const a = kidAge(g, k);
    const base = { hair: k.g === 'f' ? (a < 8 ? 'twin' : 'long') : 'short', hairColor: (st.look && ['black', 'brown'].includes(st.look.hairColor)) ? st.look.hairColor : 'black', skin: (st.look && st.look.skin) || 'fair' };
  const tops = k.g === 'f' ? ['#ff7eb6', '#ffd23f', '#5fd7ff', '#b48cff'] : ['#ffd23f', '#5fd7ff', '#5ee07a', '#ff8a3d'];
  return { ...base, top: tops[(k.ls || 0) % tops.length], bottom: k.g === 'f' ? '#8a5ac8' : '#2f6fd0', skirt: k.g === 'f' && a < 12 };
}
export const kidScale = (g, k) => { const a = kidAge(g, k); return a < 1 ? 0 : a < 6 ? 0.55 : a < 12 ? 0.68 : a < 16 ? 0.85 : 1; };
export const kidsForScene = (g, n = 2) => rom(g).kids.slice(0, n).map((k) => ({ look: kidLook(g, k), k: kidScale(g, k) || 0.5, baby: kidAge(g, k) < 1 }));

// ---------------------------------------------------------------- names and words
export const recAge = (g, rec) => rec.age + Math.floor((g.state.day - rec.met) / YEAR_DAYS);
export const dayOfYear = (day) => ((day - 1) % YEAR_DAYS) + 1;
export function pgOf(g) { return profileOf(g.state); }
export function eraOf(g) { return D.eraKey(g.state); }
export const jobOf = (g, rec) => D.jobName(rec.jb, eraOf(g), rec.g);
export function shortName(rec) {
  if (rec.cast) return (PEOPLE[rec.id] && (PEOPLE[rec.id].short || PEOPLE[rec.id].name)) || rec.giv || '？';
  if (rec.st === 'know') return `${rec.fam}さん`;
  if (rec.st === 'close') return `${rec.giv}さん`;
  return rec.giv;
}
export const fullNameOf = (rec) => (rec.cast ? (PEOPLE[rec.id] ? PEOPLE[rec.id].name : rec.n) : rec.n);
// 恋人 / 婚約者 / 夫 / 妻 / パートナー
export function partnerWord(g, rec) {
  if (!rec) return 'パートナー';
  const pg = pgOf(g);
  const same = rec.g === pg.gender;
  if (rec.st === 'engaged') return '婚約者';
  if (rec.st === 'married') {
    if (same || pg.gender === 'x') return 'パートナー';
    return rec.g === 'm' ? '夫' : '妻';
  }
  if (rec.st === 'cohab') return same || pg.gender === 'x' ? 'パートナー' : '恋人';
  if (rec.st === 'dating') return '恋人';
  return D.STAGES[rec.st] ? D.STAGES[rec.st].name : '友だち';
}
export const sameSex = (g, rec) => !!rec && (rec.g === pgOf(g).gender);

// ---------------------------------------------------------------- the people (registration)
const REG = new Set();
let cacheState = null, cacheKey = '';
const GIFT_BY_TAG = {
  gourmet: ['cake', 'okashi', 'butaman'], book: ['book', 'manga'], music: ['cd'], quiet: ['tea', 'plushie'], indoor: ['tea', 'plushie'],
  outdoor: ['hanataba', 'tea'], nature: ['hanataba', 'tea'], warai: ['manga', 'cd'], sports: ['butaman', 'tea'], talk: ['accessory', 'cake'],
};
function giftTaste(rec) {
  const list = [];
  for (const t of rec.tags || []) for (const it of GIFT_BY_TAG[t] || []) if (!list.includes(it)) list.push(it);
  if (rec.st === 'dating' || rec.st === 'cohab' || rec.st === 'engaged' || rec.st === 'married') { if (!list.includes('accessory')) list.push('accessory'); }
  const dis = ['plushie', 'butaman', 'manga', 'cd'].find((x) => !list.includes(x)) || 'plushie';
  return { loves: list.slice(0, 1), likes: list.slice(1, 4), dislikes: [dis] };
}
function defFor(g, rec) {
  const era = eraOf(g);
  const T = giftTaste(rec);
  const married = rec.st === 'married';
  const f = (s) => g.fmt(D.sayLine(s, rec));
  return {
    name: rec.n, short: shortName(rec), look: recLook(rec, era), kind: married ? 'family' : 'local', family: married,
    where: whereOf(g, rec), profile: `${recAge(g, rec)}歳・${jobOf(g, rec)}。${D.PERS[rec.per].first}。`,
    likes: T.likes, loves: T.loves, dislikes: T.dislikes,
    dialect: rec.dia === 'kansai' ? 'kansai' : 'standard', rom: true, romance: true,
    messages: [], invites: [], events: [], noInvite: married ? true : undefined,
    greet: () => g.fmt(D.sayLine(['今日はどうしたの？', 'お、{name}。ちょうどよかった{yo}。', '{name}、来てくれたんだ。'][Math.floor(Math.random() * 3)], rec)),
    chats: [() => f('{name}と話せると、うれしい{yo}。')],
    giftLines: {
      love: [f('{item}！？ ほんとに？ ずっとほしかった{nda}！')],
      like: [f('{item}、うれしい{yo}。ありがとう{ne}。')],
      neutral: [f('ありがとう{ne}。気持ちがうれしい{yo}。')],
      dislike: [f('あ…ありがとう。{I}のこと、考えて選んでくれたんだ{ne}。')],
      repeat: [f('また？ありがとう{ne}。')],
    },
    inviteYes: f('いいね、行こう{yo}！'),
    thanks: f('今日はありがとう。楽しかった{yo}。'),
    declined: f('そっか、いそがしい{no}{ne}。また今度{ne}。'),
    again: f('ほかに何かある{no}？'),
  };
}
function whereOf(g, rec) {
  const viaTxt = { goukon: '合コンで会った', shokai: '友だちの紹介', omiai: 'お見合いで会った', party: 'パーティーで会った', konkatsu: '婚活パーティーで会った', machikon: '街コンで会った', app: 'アプリで知り合った', shokuba: '仕事で知り合った', aibou: '相方の友だち' }[rec.via] || '知り合い';
  return `${prefecture(rec.hm).name}出身（${viaTxt}）`;
}
export function registerRec(g, rec) {
  if (rec.cast) return;
  registerPerson(rec.id, defFor(g, rec));
  REG.add(rec.id);
}
// Registers the generated people of this save as PEOPLE (again when the save or a stage changes).
export function ensureRomance(g) {
  const st = g && g.state;
  if (!st || !st.flags) return null;
  const R = rom(g);
  const key = Object.values(R.c).map((r) => `${r.id}:${r.st}:${r.giv}:${r.wed ? 1 : 0}`).join(',');
  if (cacheState === st && cacheKey === key) return R;
  const ids = new Set(Object.values(R.c).filter((r) => !r.cast).map((r) => r.id));
  for (const id of [...REG]) if (!ids.has(id)) { delete PEOPLE[id]; REG.delete(id); }
  for (const id of ids) {
    registerRec(g, R.c[id]);
    if (!st.people) st.people = {};
    if (!st.people[id]) st.people[id] = { aff: 12, met: R.c[id].met, talkDay: 0, giftDay: 0, hangDay: 0, seen: {}, contact: true };
  }
  cacheState = st;
  cacheKey = key;
  return R;
}
export const recOf = (g, id) => { const R = rom(g); return R && R.c[id] ? R.c[id] : null; };
export const leadRec = (g) => { const R = rom(g); return R && R.lead && R.c[R.lead] ? R.c[R.lead] : null; };
export const spouseRec = (g) => { const R = rom(g); return Object.values(R.c).find((r) => r.st === 'married') || null; };
export const affOf = (g, rec) => g.aff(rec.id);

// ---------------------------------------------------------------- new people
const BIG = ['tokyo', 'kanagawa', 'saitama', 'chiba', 'osaka', 'osaka', 'hyogo', 'kyoto', 'aichi', 'fukuoka', 'hokkaido', 'miyagi', 'hiroshima', 'shizuoka', 'niigata'];
export function genName(g, R, gender, avoid) {
  const era = eraOf(g);
  const pool = D.GIVEN[era][gender];
  let name = null;
  for (let tries = 0; tries < 8; tries++) {
    const fam = D.rngPick(R, D.SURNAMES.filter((s) => s !== avoid));
    const giv = D.rngPick(R, pool);
    name = { fam, giv };
    if (!isRealName(`${fam}${giv}`)) break;
  }
  return name;
}
let CT = null;
if (typeof document !== 'undefined') import('./contests.js').then((m) => { CT = m; }).catch(() => { CT = null; });
const isRealName = (s) => { try { return !!(CT && CT.isRealNameLike && CT.isRealNameLike(s)); } catch (e) { return false; } };

// opts: { g, via, job, per, ageMin, ageMax, st, a0 (starting ♥), temp } → REC (registered and stored; with temp: a stranger
// at a party who is stored only by persistRec when you swap contacts)
export function makeCandidate(g, o = {}) {
  const R = rom(g), st = g.state, era = eraOf(g), pf = profileOf(st), pa = ageOf(st);
  const gender = o.g || (R.pref === 'm' ? 'm' : R.pref === 'f' ? 'f' : D.rngNext(R) < 0.5 ? 'm' : 'f');
  const lo = Math.max(18, o.ageMin ?? pa - 3), hi = Math.max(lo, o.ageMax ?? pa + 7);
  const age = lo + D.rngInt(R, hi - lo + 1);
  const hm = D.rngNext(R) < 0.22 ? pf.hometown : D.rngPick(R, BIG);
  const eraI = D.MODERN[era];
  const jobs = Object.keys(D.JOBS).filter((k) => {
    const j = D.JOBS[k];
    if (j.f && gender !== 'f') return false;
    if (j.m && gender !== 'm') return false;
    if (gender === 'f' && k === 'kangoM') return false;
    if (j.minEra && eraI < j.minEra) return false;
    if (j.youngOnly && age > 24) return false;
    if (o.via === 'shokuba' && !j.from) return false;
    return true;
  });
  const jb = o.job && D.JOBS[o.job] ? o.job : D.rngPick(R, jobs);
  const per = o.per || D.rngPick(R, D.PERS_ORDER);
  const tags = [];
  for (const t of D.rngShuffle(R, D.PERS[per].tags).slice(0, 2)) tags.push(t);
  while (tags.length < 3) { const t = D.rngPick(R, D.TAG_ORDER); if (!tags.includes(t)) tags.push(t); }
  const name = genName(g, R, gender, pf.familyName);
  const rec = {
    id: null, g: gender, fam: name.fam, giv: name.giv, n: `${name.fam} ${name.giv}`, age, met: st.day, jb, per, tags,
    val: { k: D.rngNext(R) < 0.12 ? 0 : D.rngNext(R) < 0.45 ? 1 : 2, w: D.rngNext(R) < 0.15 ? 0 : D.rngNext(R) < 0.5 ? 1 : 2 },
    dia: D.diaOfRegion(prefecture(hm).region), hm, ls: (D.rngNext(R) * 4294967295) >>> 0, fp: D.rngInt(R, 2),
    bd: 1 + D.rngInt(R, YEAR_DAYS), via: o.via || 'shokai', st: o.st || 'know', since: st.day, dates: 0, ld: 0, mo: 50, lc: st.day,
    att: D.rngNext(R) < 0.6 ? 'warm' : D.rngNext(R) < 0.75 ? 'worry' : 'strict',
  };
  if (o.temp) { rec.id = `tmp${D.rngInt(R, 1e6)}`; return rec; }
  return persistRec(g, rec, o.a0);
}
export function persistRec(g, rec, a0 = 12) {
  const R = rom(g), st = g.state;
  rec.id = `rm${++R.seq}`;
  rec.met = st.day; rec.lc = st.day; rec.since = st.day;
  R.c[rec.id] = rec;
  registerRec(g, rec);
  if (!st.people) st.people = {};
  st.people[rec.id] = { aff: a0, met: st.day, talkDay: 0, giftDay: 0, hangDay: 0, seen: {}, contact: true };
  cacheKey = '';
  prune(g);
  return rec;
}
// Keep the list lean: strangers nobody saw for 60 days go; at most 8 'know' people.
export function prune(g) {
  const R = rom(g), st = g.state;
  const know = Object.values(R.c).filter((r) => r.st === 'know' && !r.cast).sort((a, b) => a.lc - b.lc);
  for (const r of know) {
    if (st.day - r.lc > 60 || know.length > 8) { dropRec(g, r); know.splice(know.indexOf(r), 1); }
    if (know.length <= 8 && st.day - r.lc <= 60) break;
  }
}
export function dropRec(g, rec) {
  const R = rom(g);
  if (R.lead === rec.id) return;
  delete R.c[rec.id];
  if (!rec.cast) { delete PEOPLE[rec.id]; REG.delete(rec.id); if (g.state.people) delete g.state.people[rec.id]; }
  cacheKey = '';
}
// A person of the cast joins the track (kept as they are in people.js).
export function adoptCast(g, pid, stage) {
  const R = rom(g), st = g.state;
  if (R.c[pid]) return R.c[pid];
  const c = CAST[pid];
  if (!c || !PEOPLE[pid]) return null;
  const p = g.meet(pid);
  const nm = PEOPLE[pid].name.replace(/^.*?([^\s　]+)$/, '$1');
  const rec = {
    id: pid, cast: 1, g: c.g, fam: '', giv: PEOPLE[pid].short || nm, n: PEOPLE[pid].name, age: c.age, met: st.day, jb: c.jb, per: c.per, tags: c.tags.slice(), val: { k: 2, w: 1 },
    dia: PEOPLE[pid].dialect === 'kansai' ? 'kansai' : 'standard', hm: 'tokyo', ls: 1, fp: 0, bd: 1 + (D.hashStr(pid) % YEAR_DAYS), via: 'friend', st: stage || (p.aff >= 35 ? 'close' : 'know'),
    since: st.day, dates: 0, ld: 0, mo: 60, lc: st.day, att: 'warm',
  };
  R.c[pid] = rec;
  return rec;
}
// A friend (♥ 友だち+) who could be loved: cast people matching 気になる相手.
export function wantsGender(R, gender) { return R.pref === 'any' || R.pref === gender; }
export function castCandidates(g) {
  const R = rom(g), st = g.state;
  return Object.keys(CAST).filter((pid) => PEOPLE[pid] && st.people && st.people[pid] && g.aff(pid) >= 35 && wantsGender(R, CAST[pid].g) && !(R.c[pid] && (R.c[pid].st === 'ex')));
}
// Sync with the old 大切な人 (people.js): someone who became special is your 恋人 now (when the track is on).
export function syncLegacy(g) {
  const R = rom(g), st = g.state;
  if (!active(g) || R.lead) return;
  for (const pid of Object.keys(CAST)) {
    if (!(st.people && st.people[pid] && st.people[pid].special)) continue;
    if (!wantsGender(R, CAST[pid].g)) continue;
    const rec = adoptCast(g, pid, 'dating');
    if (!rec) continue;
    rec.dates = Math.max(rec.dates, 2);
    setStage(g, rec, 'dating', { quiet: true });
    addHist(g, `${shortName(rec)}と、恋人どうしになった`);
    return;
  }
}

// ---------------------------------------------------------------- stages
export function setStage(g, rec, stage, o = {}) {
  const R = rom(g), st = g.state;
  const prev = rec.st;
  rec.st = stage;
  rec.since = st.day;
  if (['dating', 'cohab', 'engaged', 'married'].includes(stage)) {
    R.lead = rec.id;
    if (typeof g.setSpecial === 'function') g.setSpecial(rec.id, { silent: true });
    else if (st.people[rec.id]) st.people[rec.id].special = true;
    rec.lc = st.day;
    if (prev === 'know' || prev === 'close') rec.mo = Math.max(rec.mo, 70);
  } else {
    if (R.lead === rec.id) R.lead = null;
    if (st.people[rec.id] && st.people[rec.id].special) { if (typeof g.setSpecial === 'function') g.setSpecial(null); else st.people[rec.id].special = false; }
  }
  cacheKey = '';
  if (!rec.cast) registerRec(g, rec);
  return rec;
}
export const isCouple = (rec) => !!rec && ['dating', 'cohab', 'engaged', 'married'].includes(rec.st);
export const daysTogether = (g, rec) => g.state.day - rec.since;

// ---------------------------------------------------------------- compatibility and the air between you
export function compatOf(g, rec) {
  const R = rom(g);
  return D.compat(pgOf(g).personality, rec, R.taste);
}
// 0..3 (how the confession would go): ♥, dates, compatibility
export function airOf(g, rec) {
  const a = affOf(g, rec);
  const c = compatOf(g, rec).v;
  const s = (a - 30) / 20 + Math.min(4, rec.dates) * 0.35 + (c - 1) * 0.4;
  return s >= 3 ? 3 : s >= 2 ? 2 : s >= 1 ? 1 : 0;
}
export const moodHearts = (rec) => clamp(Math.ceil(rec.mo / 20), 1, 5);

// ---------------------------------------------------------------- the player's own limits
// Why the player cannot go out with someone today (null = free).
export function blockReason(g) {
  try {
    const js = typeof g.justiceStatus === 'function' ? g.justiceStatus() : null;
    if (js && js.free === false) return 'いまは自由に出かけられない…';
  } catch (e) { /* no justice core */ }
  const R = rom(g);
  if (R && R.leave && g.state.day < R.leave.until && R.leave.kind === 'sanq') return null;
  return null;
}
// What the career asks of today (a reason to cancel a date) or null.
export function careerConflict(g) {
  const st = g.state;
  try {
    if (typeof g.regularsToday === 'function' && g.regularsToday().length) return '今日は番組の収録・本番がある';
    if (typeof g.contestToday === 'function') { const t = g.contestToday() || []; if (t.some((x) => x && x.kind === 'round')) return '今日は賞レースの日'; }
    if (typeof g.upcomingElections === 'function') {
      const ups = g.upcomingElections() || [];
      if (ups.some((e) => e && e.declared && num(e.day) === st.day)) return '今日は選挙の投票日';
      if (ups.some((e) => e && e.declared && st.day >= num(e.koji) && st.day < num(e.day))) return '選挙戦のまっさいちゅう';
    }
    if (typeof g.licenseStatus === 'function') {
      const ls = g.licenseStatus();
      const camp = ls && ls.school && ls.school.camp;
      if (camp && camp.arrived && !camp.end) return '免許合宿の最中';
    }
  } catch (e) { /* guarded */ }
  return null;
}

// ---------------------------------------------------------------- phone messages (at most one a morning)
export function romMessage(g, rec, text, o = {}) {
  const R = rom(g), st = g.state;
  if (!st.phone) return null;
  if (!o.force) {
    if (R.last.msg === st.day) return null;
    const today = (st.phone.inbox || []).filter((m) => m && m.day === st.day).length;
    if (today >= 3) return null; // the morning is busy enough (news and friends come too)
  }
  R.last.msg = st.day;
  const p = g.meet(rec.id);
  if (p) { p.msgDay = st.day; p.contact = true; }
  const def = PEOPLE[rec.id];
  const body = rec.st === 'know' ? text : D.sayLine(text, rec);
  return g.message({ from: def ? def.name : rec.n, person: rec.id, kind: o.kind || 'chat', rom: 1, ...(o.extra || {}), text: flat(g.fmt(body)) });
}

// ---------------------------------------------------------------- events and ticks (other modules register here)
const TICKS = [];
const EVENTS = {};
export function onRomTick(fn) { TICKS.push(fn); }
export function onRomEvent(kind, fn) { EVENTS[kind] = fn; }
export function queueEvent(g, kind, data = {}, key) {
  const R = rom(g);
  const k = key || kind;
  if (R.q.some((e) => (e.key || e.k) === k)) return false;
  if (R.q.length >= 8) return false;
  R.q.push({ k: kind, key: k, d: data, day: g.state.day });
  return true;
}
// Runs the queued events (one a morning; a birth may bring a second) — right after waking.
export async function runQueue(g) {
  const R = rom(g), st = g.state;
  if (!R || !R.q.length) return;
  if (g.top !== g.map || blockReason(g)) return;
  let ran = 0;
  for (let i = 0; i < R.q.length && ran < 1; i++) {
    const ev = R.q[i];
    const fn = EVENTS[ev.k];
    if (!fn) { R.q.splice(i--, 1); continue; }
    R.q.splice(i, 1);
    ran++;
    try { await fn(g, ev.d || {}, ev); } catch (e) { console.error('[romance] event', ev.k, e); }
    break;
  }
}

// ---------------------------------------------------------------- announcements: the press and the voices
let GOVT = null;
if (typeof document !== 'undefined') {
  import('./govt.js').then((m) => {
    GOVT = m;
    const K = (pro, con, neutral, reasons) => ({ pro, con, neutral, reasons });
    try {
      m.registerVoiceKind('p_marry', K(['{name}さん、ご結婚おめでとう！', 'お幸せに！ずっと応援してる', '家族を大切にしてほしい'], ['ちょっとショック…', '結婚しても、変わらず活躍してほしい'], ['へえ、結婚したんだ'], { pro: ['祝福', '応援'], con: ['ショック'], neutral: ['関心'] }));
      m.registerVoiceKind('p_baby', K(['{name}さん、赤ちゃんおめでとう！', 'いいパパ・ママになりそう', '家族が増えて、うれしいニュース'], ['仕事と子育て、両立がたいへんそう'], ['新しい家族、おめでとう'], { pro: ['祝福', '家族が増えた'], con: ['両立'], neutral: ['関心'] }));
      m.registerVoiceKind('p_rikon', K(['いろいろあったんだろう。そっとしておいてあげたい', 'これからも応援している'], ['家庭のことで世間を騒がせるのは…', '残念なニュース'], ['プライベートなことだから見守りたい'], { pro: ['そっとしておく', '応援'], con: ['残念'], neutral: ['見守る'] }));
      m.registerVoiceKind('p_koi', K(['お似合いのふたり！', '素敵な恋、応援してる'], ['ちょっと軽率では？', 'ファンとしては複雑'], ['恋愛は自由。見守りたい'], { pro: ['お似合い', '応援'], con: ['複雑'], neutral: ['恋愛は自由'] }));
    } catch (e) { console.error('[romance] voices', e); }
  }).catch(() => { GOVT = null; });
}
// kind: 'koi' (熱愛報道) | 'marry' | 'baby' | 'rikon'. Only for people the public knows (★ fame or an office).
export function announce(g, kind, text, o = {}) {
  const st = g.state;
  const pol = st.politics && st.politics.me && st.politics.me.office;
  const known = st.fame >= 300 || !!pol;
  if (!known) return false;
  const from = kind === 'koi' ? '週刊ドット' : 'ドット新聞 芸能';
  const tag = { koi: '【熱愛】', marry: '【結婚】', baby: '【出産】', rikon: '【離婚】' }[kind] || '';
  try { g.message({ from, kind: 'news', text: flat(g.fmt(`${tag}${text}`)) }); } catch (e) { console.error(e); }
  try {
    if (GOVT && typeof GOVT.addVoiceEvent === 'function') GOVT.addVoiceEvent(g, `p_${kind}`, o.label || { koi: '恋愛', marry: '結婚', baby: '出産', rikon: '離婚' }[kind], { target: 'player', n: 3, stances: kind === 'rikon' ? ['neutral', 'pro', 'con'] : ['pro', 'pro', 'neutral'], heat: kind === 'koi' ? 4 : 3 });
  } catch (e) { console.error(e); }
  // fame and the fans: a happy piece of news is a little good for a performer; the family of a politician is looked at
  const dFame = kind === 'koi' ? 4 : kind === 'marry' ? 8 : kind === 'baby' ? 6 : -4;
  g.addFame(Math.round(dFame * Math.min(2, Math.max(0.5, st.fame / 800))), true);
  try {
    if (pol && st.politics.me) {
      const me = st.politics.me;
      const d = kind === 'marry' ? 3 : kind === 'baby' ? 3 : kind === 'rikon' ? -3 : kind === 'koi' ? -1 : 0;
      me.reputation = clamp(num(me.reputation) + d, -100, 100);
    }
  } catch (e) { console.error(e); }
  return true;
}

// ---------------------------------------------------------------- items (small, romantic)
function regItems() {
  const items = {
    rom_flower: { name: '一輪の花', price: 500, desc: '小さな花が一輪。気持ちを伝えるのに、大げさはいらない。' },
    rom_charm: { name: 'おそろいのお守り', price: 1500, desc: '同じ柄のお守りを、ふたつ。' },
    rom_frame: { name: '写真立て', price: 1200, desc: 'ふたりの写真を飾るための、小さな写真立て。' },
    rom_choco: { name: '手づくりチョコ', price: 0, desc: '大切な人からもらった、手づくりのチョコ。\n食べると体力が少し回復する。', heal: 20, fill: 20 },
    rom_ring: { name: '婚約指輪', price: 0, key: true, desc: 'ふたりで選んだ、小さな指輪。' },
  };
  for (const [id, def] of Object.entries(items)) registerItem(id, { ...def, desc: def.desc + (def.heal || def.key ? '' : '\n（人に話しかけて「プレゼント」でわたそう）'), gift: !def.heal && !def.key });
}
regItems();

// ---------------------------------------------------------------- the morning
function introTip(g, R) {
  if (R.tip || R.pref !== null) return;
  const st = g.state;
  if (ageOf(st) < 18 || st.day < 6) return;
  R.tip = 1;
  const era = eraOf(g);
  const dev = D.DEVICE[era] === 'ポケベル' ? '手帳' : era === 'reiwa' ? 'スマホ' : era === 'heisei' ? 'ケータイ' : '手帳';
  const app = era === 'reiwa' || era === 'heisei' ? '恋のはなし' : 'ひとことメモ';
  (g.pendingTips || (g.pendingTips = [])).push(`（${dev}に「${app}」がある。恋愛や結婚、家族のこと…\n気が向いたら、のぞいてみよう。使わなくても、\nゲームには何も影響しない）`);
}
function monthNote(date) { return date ? `${date.month}月` : ''; }
function friendForIntro(g, R) {
  const st = g.state;
  const ids = g.friends(2).filter((id) => PEOPLE[id] && !PEOPLE[id].rom && !(R.c[id] && isCouple(R.c[id])));
  return ids.length ? ids[Math.floor(D.rngNext(R) * ids.length)] : null;
}
async function morning(g) {
  const st = g.state;
  const R = rom(g);
  if (!R || !st.profile) return;
  ensureRomance(g);
  if (R.last.day === st.day) return;
  R.last.day = st.day;
  introTip(g, R);
  if (!active(g) && !hasLife(g)) return;
  syncLegacy(g);
  const era = eraOf(g);
  const date = typeof g.gameDate === 'function' ? (() => { try { return g.gameDate(); } catch (e) { return null; } })() : null;
  const ctx = { msgs: [], notes: [], date, era, season: D.seasonOf(date) };
  const lead = leadRec(g);
  // moods drift when there is no contact
  if (lead && isCouple(lead) && lead.st !== 'married') {
    const gap = st.day - lead.lc;
    if (gap > 10 && st.day % 2 === 0) lead.mo = clamp(lead.mo - 1, 0, 100);
    if (gap > 20 && st.day % 2 === 1) lead.mo = clamp(lead.mo - 1, 0, 100);
  } else if (lead && lead.st === 'married') {
    const gap = st.day - lead.lc;
    if (gap > 14 && st.day % 3 === 0) lead.mo = clamp(lead.mo - 1, 0, 100);
    else if (gap <= 7 && st.day % 5 === 0) lead.mo = clamp(lead.mo + 1, 0, 100);
  }
  for (const fn of TICKS) {
    try { fn(g, R, ctx); } catch (e) { console.error('[romance] tick', e); }
  }
  // the one message of the morning: the best candidate
  ctx.msgs.sort((a, b) => (b.pri || 0) - (a.pri || 0));
  const m = ctx.msgs[0];
  if (m) romMessage(g, m.rec, m.text, { extra: m.extra, force: !!m.force, kind: m.kind });
  else if (lead) {
    // small talk: now and then
    const gap = st.day - lead.lc;
    const chance = lead.st === 'married' ? 0.3 : 0.4;
    const cold = lead.mo < 25;
    if (cold && D.rngNext(R) < 0.5) romMessage(g, lead, D.rngPick(R, COLD_TALK));
    else if (gap >= 8 && lead.st !== 'married' && D.rngNext(R) < 0.6) romMessage(g, lead, D.rngPick(R, MISS_YOU));
    else if (D.rngNext(R) < chance) romMessage(g, lead, smallTalk(g, lead, R, era));
  } else {
    // someone you got to know (♥) now and then writes
    const knowns = Object.values(R.c).filter((r) => (r.st === 'know' || r.st === 'close') && !r.cast && st.day - r.lc <= 40);
    if (knowns.length && D.rngNext(R) < 0.14) {
      const r = D.rngPick(R, knowns);
      romMessage(g, r, smallTalk(g, r, R, era));
    }
  }
  for (const n of ctx.notes) (g.morningNotes || (g.morningNotes = [])).push(n);
}
onMorning(async (g) => { try { await morning(g); } catch (e) { console.error('[romance] morning', e); } });

// Season messages from the one you love (they come as the top candidate of the morning).
onRomTick((g, R, ctx) => {
  const lead = leadRec(g);
  if (!lead || !isCouple(lead)) return;
  const st = g.state;
  const key = `${ctx.date ? ctx.date.year : 0}`;
  for (const s of ctx.season) {
    if (!['valentine', 'whiteday', 'xmas', 'hatsumode', 'tanabata', 'toshikoshi'].includes(s)) continue;
    const mk = `${s}${key}`;
    if (R.last[mk]) continue;
    R.last[mk] = st.day;
    for (const k of Object.keys(R.last)) if (/\d{4}$/.test(k) && !k.endsWith(key)) delete R.last[k];
    const line = seasonLine(s, lead, ctx.era, pgOf(g));
    if (!line) continue;
    ctx.msgs.push({ pri: 6, rec: lead, text: line, extra: undefined });
    if (s === 'valentine' && (lead.g === 'f' || ctx.era === 'reiwa' || ctx.era === 'heisei')) { g.giveItem('rom_choco', 1, true); ctx.notes.push('（手づくりのチョコレートが届いた！）'); }
    break;
  }
});

// ---------------------------------------------------------------- after waking: queued events
const origSleep = Game.prototype.sleep;
if (typeof origSleep === 'function' && !origSleep.__rom) {
  const w = async function (...a) {
    const r = await origSleep.apply(this, a);
    try { await runQueue(this); } catch (e) { console.error('[romance] runQueue', e); }
    return r;
  };
  w.__rom = true;
  Game.prototype.sleep = w;
}
// 産休・育休: the player's own leave from work (chosen by the player; ends on its day or when they go back)
const origLR = Game.prototype.lifeRefusal;
if (typeof origLR === 'function' && !origLR.__rom) {
  const w = function (...a) {
    try {
      const R = this.state && this.state.flags && this.state.flags.rom;
      if (R && R.leave && this.state.day < num(R.leave.until)) {
        const left = num(R.leave.until) - this.state.day;
        return [`いまは${R.leave.kind === 'ikukyu' ? '育休' : '産休'}の最中。お仕事は、おやすみしている。`, `（あと${left}日。スマホの「恋のはなし」→家族 から、仕事にもどることもできる）`];
      }
    } catch (e) { console.error(e); }
    return origLR.apply(this, a);
  };
  w.__rom = true;
  Game.prototype.lifeRefusal = w;
}

// ---------------------------------------------------------------- g.* API
Object.assign(Game.prototype, {
  romance() { return rom(this); },
  romanceLead() { return leadRec(this); },
  romanceActive() { return active(this); },
  // the credits / the finale card: 「家族　配偶者と子ども2人」 or '' (nothing when there is no family)
  romanceSummary() {
    const R = rom(this);
    if (!R) return '';
    const sp = spouseRec(this);
    const kids = R.kids.length;
    if (sp && kids) return `家族　${partnerWord(this, sp)}と子ども${kids}人`;
    if (sp) return `家族　${partnerWord(this, sp)}とふたり`;
    if (kids) return `家族　子ども${kids}人`;
    const l = leadRec(this);
    if (l && isCouple(l)) return `大切な人　${shortName(l)}`;
    return '';
  },
  // rows for てちょう きろく: [[label, value, tone]] (tone: 'pink' | 'good' | 'dim' | null)
  romanceRows() {
    const R = rom(this);
    if (!R || (!active(this) && !hasLife(this))) return [];
    const out = [];
    const l = leadRec(this);
    if (l && isCouple(l)) out.push([partnerWord(this, l), `${l.n}（${recAge(this, l)}歳・${jobOf(this, l)}）`, 'pink']);
    if (l && l.st === 'married') { const y = Math.floor((this.state.day - num(l.wedDay, l.since)) / YEAR_DAYS); out.push(['結婚', y < 1 ? '新婚' : `${y}年目`, null]); }
    const hn = R.home && R.home.hn;
    if (hn && l && l.st === 'married') out.push(['わが家の名字', hn + (R.home.maiden ? `（仕事では${R.home.maiden}）` : ''), null]);
    for (const k of R.kids) out.push(['子ども', `${k.n}（${Math.floor((this.state.day - k.b) / YEAR_DAYS)}歳）`, 'pink']);
    if (R.preg) out.push(['おなかの赤ちゃん', 'もうすぐ会える', 'pink']);
    return out;
  },
});

export { callYou, smallTalk };
