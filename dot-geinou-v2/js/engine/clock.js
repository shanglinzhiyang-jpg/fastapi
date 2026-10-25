// 日付・時計・時間帯・天気・朝昼夜 (owner: R7-C). API doc: test-output/api_clock.txt
//
// The game used to have days only (sleeping ends the day). Now every day also has a clock:
//   - you wake at about 7:00 (later after a late night; the 時計 app's alarm can wake you earlier), and everything you
//     do moves the clock: jobs by their length (a TV recording is longer than a 前説), lessons, auditions, minigames,
//     meals, baths, hobbies, hangouts, ネタ合わせ, the Diet, and travel by distance and means (walking a minute per
//     few steps, a bus across town, the 新幹線 to Osaka, the trip home to the 実家). Nothing is ever blocked by the
//     hour: shops, jobs, regular shows and contests keep their day schedules.
//   - after 24:00 every activity costs a little 体力 and ストレス (toasts, a one-time tip — never a forced scene);
//     going to bed sets the next morning: a short night means less 体力 and some stress.
//   - weather by season and region (東京 / 大阪 / the hometown): 梅雨, 台風, rare snow, summer storms, 猛暑 in 令和
//     (clock_weather.js). Small effects: stress and 体力 when walking in rain or heat, fewer tips for street
//     performances in rain, outdoor jobs harder (a 台風 cancels them, with a message), outdoor relaxing worth less in
//     bad weather; a forecast in the morning notes (only when it matters, at most one).
//   - town maps are tinted by the time of day (soft morning, orange evening, blue night with lit windows and street
//     lamps), darker under rain clouds, with rain / snow / typhoon particles (clock_fx.js). Interiors are unchanged.
//   - the HUD's middle panel: date, weather, time (rolling forward when time passes), temperature.
//   - phone apps 時計 (time, alarm, timer, stopwatch next to your ネタ's length) and 天気 (today + 7 days) for all
//     three devices (clock_apps.js).
//
// State: g.state.clock (lazy, repaired once per state object; old saves start at 7:00 of their current day).
// Engine hooks: Game.prototype methods are wrapped once (job, lesson, audition, minigame, goto, sleep, eat, bathe,
// relax, onWalkStep, owaraiPractice, owaraiLive, perform, netaRehearse, attendDiet, campaign, holdFundraiser) and
// PEOPLE_UI.hangout; MapScene.prototype.drawWorld is wrapped for the sky. ui.js calls g.drawClockHud (HUD), game.js
// calls g.morningToast (the morning toast), crime_app.js reads g.crimePhaseNow / g.advanceTo.

import { Game } from './game.js';
import { MapScene, PLACES, doorIndexFor } from './map.js';
import { onMorning, REGULARS, HANGOUTS, PEOPLE_UI, weekdayName } from './life.js';
import { eraOf, prefecture } from './profile.js';
import { COLORS } from './draw.js';
import * as W from './clock_weather.js';
import { drawSky, drawClockPanel, drawWeatherIcon, skyOverlay } from './clock_fx.js';
import { installClockApps } from './clock_apps.js';

// ======================================================================== constants
export const WAKE = 7 * 60; // the usual morning
const NAT_MIN = 7 * 60, NAT_MAX = 10 * 60 + 30; // waking up by yourself (8 hours after bedtime, within this)
export const LATE = 24 * 60; // after this: tired
export const MAX_MIN = 30 * 60 - 1; // 5:59 the next morning: the clock does not go further before you sleep
export const ALARMS = [300, 330, 360, 390, 420, 450, 480, 510, 540]; // 5:00 … 9:00
export const PHASE_LABEL = { early: '早朝', morning: '朝', noon: '昼', evening: '夕方', night: '夜', late: '深夜' };
const ERA_BASE = { showa: 1987, heisei_early: 1996, heisei: 2004, reiwa: 2026 };
// 東京 → 新大阪 → なんば, station concourse to concourse (rounded): ひかり 2:52 (1986-11), のぞみ 2:30 (1992-03), のぞみ
// about 2:27 now, plus about 25 minutes from 新大阪 to なんば.
const SHINKANSEN_MIN = { showa: 195, heisei_early: 175, heisei: 175, reiwa: 170 };
const WALK_STEPS_TOWN = 8, WALK_STEPS_INSIDE = 12; // tiles walked per game minute

const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const has = (g, k) => !!g && typeof g[k] === 'function';
const pad2 = (n) => String(n).padStart(2, '0');
export const hm = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; };
export const hmShort = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${pad2(m % 60)}`; };
// what passed, short (the HUD's tag): 25分, 1.5時間, 3時間
export const passedText = (min) => { const m = Math.round(min); if (m < 60) return `${m}分`; const h = Math.round(m / 30) / 2; return `${h}時間`; };
export const durText = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ''}` : `${m}分`; };
const eraIdOf = (g) => { const e = g && g.state && g.state.profile && g.state.profile.era; return ERA_BASE[e] ? e : 'reiwa'; };
export const devOf = (g) => { const e = eraIdOf(g); return e === 'reiwa' ? 'smart' : e === 'heisei' ? 'keitai' : 'techo'; };
let errOnce = {};
const logOnce = (k, e) => { if (!errOnce[k]) { errOnce[k] = 1; console.error(`[clock] ${k}`, e); } };

// ======================================================================== state
const READY = new WeakSet();
// g.state.clock, created / repaired once per state object; rolls over to the morning when the day changed.
export function clk(g) {
  const st = g && g.state;
  if (!st) return null;
  let c = st.clock;
  if (!isObj(c)) c = st.clock = {};
  if (!READY.has(c)) {
    const day = Math.max(1, Math.floor(num(st.day, 1)));
    c.v = 1;
    c.day = Math.max(1, Math.floor(num(c.day, day)));
    c.min = clamp(Math.round(num(c.min, WAKE)), 0, MAX_MIN);
    c.seed = Math.floor(num(c.seed, 0)) >>> 0 || (Math.floor(Math.random() * 2 ** 31) + 1);
    c.alarm = c.alarm == null ? null : ALARMS.includes(num(c.alarm, -1)) ? num(c.alarm) : null;
    c.bed = c.bed == null || !Number.isFinite(Number(c.bed)) ? null : clamp(Math.round(num(c.bed)), 0, MAX_MIN);
    c.bedDay = Math.floor(num(c.bedDay, 0));
    c.lateAcc = Math.max(0, num(c.lateAcc));
    c.steps = Math.max(0, Math.floor(num(c.steps)));
    c.wsteps = Math.max(0, Math.floor(num(c.wsteps)));
    c.wake = clamp(Math.round(num(c.wake, WAKE)), 0, 1439);
    c.lastSleep = isObj(c.lastSleep) ? { day: num(c.lastSleep.day), bed: c.lastSleep.bed == null ? null : num(c.lastSleep.bed), wake: num(c.lastSleep.wake, WAKE), hours: c.lastSleep.hours == null ? null : num(c.lastSleep.hours) } : null;
    c.sleepDay = Math.floor(num(c.sleepDay));
    c.warn = isObj(c.warn) ? Object.fromEntries(Object.entries(c.warn).filter(([, v]) => Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])) : {};
    c.fc = isObj(c.fc) ? { day: num(c.fc.day), kind: String(c.fc.kind || ''), tsuyu: Math.floor(num(c.fc.tsuyu)) } : { day: 0, kind: '', tsuyu: 0 };
    c.fares = Math.max(0, num(c.fares));
    c.log = Array.isArray(c.log) ? c.log.filter(isObj).slice(-30).map((l) => ({ day: num(l.day), from: num(l.from), to: num(l.to), add: num(l.add), why: String(l.why || '').slice(0, 24) })) : [];
    c.stats = isObj(c.stats) ? { late: Math.floor(num(c.stats.late)), allNight: Math.floor(num(c.stats.allNight)), sleepSum: num(c.stats.sleepSum), nights: Math.floor(num(c.stats.nights)) } : { late: 0, allNight: 0, sleepSum: 0, nights: 0 };
    READY.add(c);
  }
  if (c.day !== st.day) rollover(g, c);
  return c;
}
// The day changed (a night's sleep, or days that passed in custody / hospital): the clock is the new morning.
function rollover(g, c) {
  const st = g.state;
  let wake = c.alarm != null ? c.alarm : WAKE;
  let hours = null;
  const slept = c.bed != null && c.bedDay === c.day && st.day === c.day + 1;
  if (slept) {
    wake = wakeFor(c.bed, c.alarm);
    hours = Math.round(((wake + 1440 - c.bed) / 60) * 10) / 10;
    c.stats.nights++; c.stats.sleepSum += hours;
  }
  c.lastSleep = { day: st.day, bed: slept ? c.bed : null, wake, hours };
  c.day = st.day;
  c.min = wake;
  c.wake = wake;
  c.bed = null;
  c.lateAcc = 0;
  c.steps = 0;
  anim(g, null);
}
// When you wake after going to bed at `bed` (minutes of the day before; 24:00+ = after midnight).
export function wakeFor(bed, alarm) {
  const natural = clamp(bed + 480 - 1440, NAT_MIN, NAT_MAX);
  let w = alarm != null ? alarm : natural;
  w = Math.max(w, bed + 60 - 1440); // at least an hour of sleep
  return clamp(Math.round(w), 0, 12 * 60);
}
// Sleep → how much 体力 comes back and the stress a short night adds.
export function sleepEffect(hours) {
  if (hours == null || hours >= 7) return { f: 1, stress: 0 };
  if (hours >= 6) return { f: 0.95, stress: 0 };
  if (hours >= 5) return { f: 0.85, stress: 3 };
  if (hours >= 4) return { f: 0.75, stress: 5 };
  if (hours >= 3) return { f: 0.65, stress: 7 };
  return { f: 0.55, stress: 9 };
}

// ======================================================================== the calendar
const DATE_CACHE = new WeakMap();
// { year, month, k (0..9: the game day of the month), rday (real day: 1, 4, … 28), day } — the politics core's
// calendar when there is one (g.gameDate), else the plain one (April of the era's first year).
export function dateOf(g, day) {
  const st = g.state;
  const dd = Math.max(1, Math.floor(num(day, st.day)));
  let M = DATE_CACHE.get(st);
  if (!M) { M = new Map(); DATE_CACHE.set(st, M); }
  const ck = `${eraIdOf(g)}|${dd}`;
  const hit = M.get(ck);
  if (hit && hit.f > (g.frame || 0) - 600) return hit.d;
  let out = null;
  try {
    if (has(g, 'gameDate')) {
      const d = g.gameDate(dd);
      if (d && Number.isFinite(Number(d.year)) && Number.isFinite(Number(d.month))) {
        const k = Number.isFinite(Number(d.doy)) ? Number(d.doy) % 10 : num(d.dom, 1) > 10 ? Math.floor((num(d.dom, 1) - 1) / 3) : num(d.dom, 1) - 1;
        out = { year: Number(d.year), month: clamp(Number(d.month), 1, 12), k: clamp(k, 0, 9), day: dd };
      }
    }
  } catch (e) { logOnce('gameDate', e); }
  if (!out) {
    const n = dd - 1, idx = 3 + Math.floor(n / 10);
    out = { year: (ERA_BASE[eraIdOf(g)] || 2026) + Math.floor(idx / 12), month: (idx % 12) + 1, k: n % 10, day: dd };
  }
  out.rday = out.k * 3 + 1;
  if (M.size > 300) M.clear();
  M.set(ck, { d: out, f: g.frame || 0 });
  return out;
}
// 和暦 for a date (1989-01-08 平成, 2019-05-01 令和; 元年)
export function warekiOf(y, m, d = 1) {
  const v = y * 10000 + m * 100 + d;
  const n = (era, k) => `${era}${k === 1 ? '元' : k}年`;
  if (v >= 20190501) return n('令和', y - 2018);
  if (v >= 19890108) return n('平成', y - 1988);
  if (v >= 19261225) return n('昭和', y - 1925);
  return `${y}年`;
}
export function dateFull(g, day) {
  const d = dateOf(g, day);
  return `${d.year}年（${warekiOf(d.year, d.month, d.rday)}）${d.month}月${d.rday}日（${weekdayName(d.day)}）`;
}

// ======================================================================== the time of day
export function phaseOf(min, set = 1080) {
  if (min >= LATE) return min >= LATE + 240 ? 'early' : 'late';
  if (min < 240) return 'late';
  if (min < 420) return 'early';
  if (min < 660) return 'morning';
  if (min < 960) return 'noon';
  return min < clamp(set + 40, 1050, 1170) ? 'evening' : 'night';
}
// 'day' | 'night' | 'late' — the crime app's time choices
export function crimePhaseOf(min) { return min >= LATE ? (min < LATE + 300 ? 'late' : 'day') : min >= 17 * 60 ? 'night' : 'day'; }

// ======================================================================== where you are (the weather's region)
const REGION_CACHE = new Map();
export function regionOf(g, placeId = g.map && g.map.placeId) {
  if (!placeId) return 'tokyo';
  if (placeId === 'jikka') {
    const hid = g.state && g.state.profile && g.state.profile.hometown;
    return W.regionKey(prefecture(hid).region, hid);
  }
  let r = REGION_CACHE.get(placeId);
  if (r) return r;
  const town = townOf(placeId);
  r = town === 'namba' ? 'osaka' : 'tokyo';
  REGION_CACHE.set(placeId, r);
  return r;
}
function townOf(placeId) {
  const P = PLACES[placeId];
  if (P && P.kind === 'town') return placeId;
  try { const d = doorIndexFor(placeId); return d ? d.town : null; } catch (e) { return null; }
}

// ======================================================================== weather
const WX_CACHE = new WeakMap();
export function weatherOf(g, day, region = regionOf(g)) {
  const c = clk(g);
  const d = dateOf(g, day);
  let M = WX_CACHE.get(g.state);
  if (!M) { M = new Map(); WX_CACHE.set(g.state, M); }
  const key = `${c.seed}|${region}|${d.year}|${d.month}|${d.rday}`;
  let w = M.get(key);
  if (!w) {
    w = W.dayWeather({ seed: c.seed, year: d.year, month: d.month, rday: d.rday, region });
    w.date = d;
    if (M.size > 400) M.clear();
    M.set(key, w);
  }
  // tests / screenshots: g.__wxForce = 'rain' (any kind) overrides the weather everywhere
  if (g.__wxForce && W.KINDS.includes(g.__wxForce)) return { ...w, kind: g.__wxForce, base: 'cloudy', typhoon: g.__wxForce === 'typhoon' ? (w.typhoon || 9) : 0 };
  return w;
}
const yearOf = (g) => dateOf(g).year;
// The name of the weather (a few words by year: 雷雨 → ゲリラ豪雨 is a newer word, kept out of the label)
export function labelOf(kind, w) {
  if (kind === 'typhoon' && w && w.typhoon) return `台風${w.typhoon}号`;
  return W.KIND_LABEL[kind] || '晴れ';
}
// 注意報・警報 and heat notices for a day's weather (by year: 猛暑日 2007-, 高温注意情報 2011–2020, 熱中症警戒アラート 2021-,
// 特別警報 2013-08-30-, 顕著な大雨に関する情報（線状降水帯）2021-06-17-).
export function warningsOf(g, w, year = yearOf(g)) {
  const out = [];
  const k = w.kind;
  if (k === 'typhoon') {
    out.push('暴風警報', '大雨警報');
    if (year >= 2014 && W.rand(w.date && w.date.year, w.date && w.date.month, w.date && w.date.rday, 'sp') < 0.15) out.push('大雨特別警報');
  } else if (k === 'heavyrain') {
    out.push('大雨警報');
    if (year >= 2022 && W.rand(w.date && w.date.month, w.date && w.date.rday, 'lin') < 0.25) out.push('線状降水帯の情報');
  } else if (k === 'storm') out.push('雷注意報');
  else if (k === 'snow') out.push(w.region === 'tokyo' || w.region === 'osaka' ? '大雪注意報' : '大雪警報');
  if (w.hi >= 34 && year >= 2021) out.push('熱中症警戒アラート');
  else if (w.hi >= 35 && year >= 2011 && year <= 2020) out.push('高温注意情報');
  if (w.lo <= -1 && w.region !== 'hokkaido') out.push('低温注意報');
  return out;
}
export function heatWord(g, hi, year = yearOf(g)) {
  if (hi >= 35) return year >= 2007 ? '猛暑日' : '真夏日（35℃超え）';
  if (hi >= 30) return '真夏日';
  if (hi >= 25) return '夏日';
  return '';
}
export const heatIllness = (g) => (yearOf(g) >= 1995 ? '熱中症' : '日射病');

// ======================================================================== passing time
// The HUD rolls the clock forward (from → to) and shows what passed (+1:30) for a moment.
function anim(g, a) {
  if (!a) { g._clkAnim = null; return; }
  const prev = g._clkAnim;
  const f = g.frame || 0;
  const shownNow = prev ? animShown(g, prev) : a.from;
  g._clkAnim = { from: shownNow, to: a.to, f0: f, add: (prev && f - prev.f0 < 90 ? prev.add : 0) + a.add, tf0: f };
}
function animShown(g, a) {
  const t = clamp(((g.frame || 0) - a.f0) / 45, 0, 1);
  const e = 1 - (1 - t) * (1 - t);
  return Math.round(a.from + (a.to - a.from) * e);
}
// Let `min` minutes pass. o: { auto (from a wrapped activity), quiet (no HUD roll: walking) }.
export function pass(g, min, why = '', o = {}) {
  const c = clk(g);
  if (!c) return null;
  min = Math.round(num(min));
  if (!(min > 0)) return c.min;
  const before = c.min;
  const target = before + min;
  const after = Math.min(MAX_MIN, target);
  c.min = after;
  if (!o.auto) { g._clkExplicit = { f: g.frame || 0, why: String(why || ''), phone: !!(g.scenes && g.scenes.some((s) => s && s.isPhone)) }; }
  c.log.push({ day: c.day, from: before, to: after, add: min, why: String(why || '').slice(0, 24) });
  if (c.log.length > 30) c.log.splice(0, c.log.length - 30);
  if (!o.quiet && after > before) anim(g, { from: before, to: after, add: min });
  else if (g._clkAnim) g._clkAnim.to = after;
  const lateMin = Math.max(0, target - Math.max(before, LATE));
  if (lateMin > 0) lateCost(g, c, lateMin, before, target);
  return c.min;
}
// After midnight: every 30 minutes awake costs 体力 -1 and ストレス +1; warnings at 0:00, 2:00 and dawn.
function lateCost(g, c, lateMin, before, target) {
  const st = g.state;
  c.lateAcc += lateMin;
  let n = 0;
  while (c.lateAcc >= 30) { c.lateAcc -= 30; n++; }
  if (n) {
    st.stamina = Math.max(0, num(st.stamina) - n);
    try { g.addNeed('stress', n); } catch (e) { logOnce('addNeed', e); }
  }
  const warnOnce = (key, msg, color = COLORS.bad) => {
    if (c.warn[key] === c.day) return false;
    c.warn[key] = c.day;
    g.notify(msg, { color, life: 220 });
    return true;
  };
  if (before < LATE + 1 && target >= LATE) {
    if (warnOnce('late0', '0時を過ぎた…。夜ふかしは体力とストレスに響く')) {
      c.stats.late++;
      if (!c.warn.tipLate) {
        c.warn.tipLate = 1;
        (g.pendingTips || (g.pendingTips = [])).push('（深夜0時を過ぎると、動くたびに体力が少し減り、\nストレスがたまる。寝るのがおそいと、あしたの朝は\n目覚めがおそいか、アラームで起きても寝不足になる）');
      }
    }
  }
  if (target >= LATE + 120) warnOnce('late2', '深夜2時…。もう限界が近い。早く寝よう');
  if (target >= MAX_MIN) { if (warnOnce('allnight', '空が白んできた…（徹夜。もう寝ないと動けない）')) c.stats.allNight++; }
}
// Jump forward to a time of the same day (no going back). Returns the minutes that passed.
export function advanceTo(g, minute, why = '') {
  const c = clk(g);
  if (!c) return 0;
  const m = clamp(Math.round(num(minute)), 0, MAX_MIN);
  if (m <= c.min) return 0;
  const d = m - c.min;
  pass(g, d, why);
  return d;
}

// ======================================================================== activity lengths
const has0 = (g) => !(g.__clkDepth > 0);
// Runs an activity; when it was really done (done(result)) and no outer activity is timing it, the clock moves.
async function timed(g, minutes, fn, done, why) {
  g.__clkDepth = (g.__clkDepth || 0) + 1;
  let res;
  try { res = await fn(); } finally { g.__clkDepth--; }
  if (!g.__clkDepth && g.state) {
    try { if (done(res)) pass(g, typeof minutes === 'function' ? minutes(res) : minutes, why, { auto: true }); } catch (e) { logOnce('timed', e); }
  }
  return res;
}
// How long a job takes (def.minutes wins): by the kind of work its title / description tells, else by its 体力.
export function jobMinutes(def = {}) {
  if (Number.isFinite(Number(def.minutes))) return clamp(Math.round(Number(def.minutes)), 5, 720);
  const id = String(def.id || '');
  const t = `${def.title || ''} ${def.desc || ''}`;
  if (id.startsWith('regular_')) {
    const r = REGULARS[id.slice(8)];
    const m = r && r.medium;
    return m === 'radio' ? 150 : m === 'stage' ? 210 : m === 'event' ? 180 : m === 'web' ? 120 : 240;
  }
  if (id.startsWith('street_')) return 40;
  if (/前説/.test(t)) return 60;
  if (/エキストラ/.test(t)) return 300;
  if (/映画|ドラマ|撮影|ロケ|ミュージカル|公演|舞台|座長|時代劇|特撮|主演/.test(t)) return 300;
  if (/特番|総合司会|冠番組/.test(t)) return 300;
  if (/生放送|生中継|中継/.test(t)) return 180;
  if (/ラジオ/.test(t)) return 150;
  if (/収録|番組|バラエティ|司会|MC|クイズ|ひな壇/.test(t)) return 210;
  if (/営業|イベント|握手|サイン|ライブ/.test(t)) return 180;
  if (/CM|モデル|グラビア|雑誌|取材|インタビュー/.test(t)) return 150;
  return clamp(60 + num(def.stamina, 20) * 6, 60, 360);
}
const OUTDOOR_JOB = /ロケ|路上|屋外|野外|青空|海辺|ビーチ|中継/;
export const isOutdoorJob = (def = {}) => def.outdoor === true || (def.outdoor !== false && !String(def.id || '').startsWith('regular_') && OUTDOOR_JOB.test(`${def.title || ''}`));
const outdoorsNow = (g) => { const P = g.map && g.map.place; return !!(P && (P.kind === 'town' || P.outdoor || (g.map.room && g.map.room.def && g.map.room.def.outdoor))); };
function hangoutMinutes(spotId) {
  const s = HANGOUTS[spotId];
  if (!s) return 120;
  if (Number.isFinite(Number(s.minutes))) return Number(s.minutes);
  return num(s.price) <= 0 ? 60 : num(s.price) >= 3000 ? 150 : 120;
}

// ======================================================================== travel
// Minutes from one place to another (g.goto between places): walking pace inside a town (by the doors' distance;
// faster when the trip was a paid ride from the マップ app), a bus between Tokyo's towns (a few minutes when you
// walk across the town's edge), the 新幹線 between Tokyo and Osaka, the hometown trip by its distance.
let tripOf = null;
import('../world/family.js').then((m) => { tripOf = m.tripOf || null; }).catch(() => { /* family.js left out */ });
function pointOf(g, placeId, x, y) {
  const P = PLACES[placeId];
  if (P && P.kind === 'town') return { town: placeId, x: num(x, P.start && P.start.x), y: num(y, P.start && P.start.y) };
  try { const d = doorIndexFor(placeId); if (d) return { town: d.town, x: d.x, y: d.y }; } catch (e) { /* none */ }
  return null;
}
export function travelMinutes(g, from, to, o = {}) {
  if (!from || !to || from === to) return 0;
  const era = eraIdOf(g);
  if (to === 'jikka' || from === 'jikka') {
    const hid = g.state && g.state.profile && g.state.profile.hometown;
    let fare = 6000;
    try { if (tripOf) fare = num(tripOf(hid).fare, 6000); } catch (e) { /* default */ }
    return clamp(Math.round(fare / 40), 30, 330);
  }
  const A = o.fromPoint || pointOf(g, from), B = pointOf(g, to, o.x, o.y);
  if (!A || !B) return 20;
  const rA = A.town === 'namba' ? 'osaka' : 'tokyo', rB = B.town === 'namba' ? 'osaka' : 'tokyo';
  if (rA !== rB) return SHINKANSEN_MIN[era] || 175;
  if (A.town === B.town) {
    const tiles = Math.abs(A.x - B.x) + Math.abs(A.y - B.y);
    return Math.max(1, Math.round(o.paid ? 5 + tiles / 30 : tiles / WALK_STEPS_TOWN));
  }
  return o.edge ? 4 : 15;
}

// ======================================================================== the morning
function morningHook(g) {
  const c = clk(g);
  if (!c || c.sleepDay === g.state.day) return;
  c.sleepDay = g.state.day;
  const st = g.state;
  const notes = Array.isArray(g.morningNotes) ? g.morningNotes : null;
  const L = c.lastSleep;
  if (L && L.day === st.day && L.hours != null) {
    const ef = sleepEffect(L.hours);
    const bits = [];
    if (ef.f < 1) {
      const cap = Math.round(num(st.maxStamina, 100) * ef.f);
      if (st.stamina > cap) st.stamina = cap;
      if (ef.stress) { try { g.addNeed('stress', ef.stress); } catch (e) { logOnce('addNeed', e); } }
      bits.push(`寝不足だ…。${durText(Math.round(L.hours * 60))}しか眠れなかった。\n体力は${Math.round(ef.f * 100)}%まで${ef.stress ? `・ストレス +${ef.stress}` : ''}`);
    }
    if (L.wake >= 9 * 60 && c.alarm == null && L.bed != null && L.bed >= LATE) bits.push(`夜ふかしのせいで、起きたら${hmShort(L.wake)}だった…。`);
    if (bits.length && notes) notes.push(`（${bits.join('\n')}）`);
  }
  const fc = forecastNote(g, c);
  if (fc && notes) notes.push(fc);
}
// The morning's weather line, only when it matters (rain, snow, a typhoon, heat, frost, 梅雨入り / 明け), or every
// fifth morning; at most one a morning, and not for the second rainy day in a row.
function forecastNote(g, c) {
  const st = g.state;
  const region = regionOf(g);
  const w = weatherOf(g, st.day, region);
  const nx = weatherOf(g, st.day + 1, region);
  const year = w.date.year;
  const dev = devOf(g);
  const src = dev === 'smart' ? '天気アプリ' : dev === 'keitai' ? '天気予報サイト' : 'けさのテレビの天気予報';
  const lines = [];
  let notable = false;
  if (w.tsuyuIn && c.fc.tsuyu !== year * 10 + 1) { c.fc.tsuyu = year * 10 + 1; notable = true; lines.push(`${w.area}地方が梅雨入りしたとみられる、と気象台が発表した。`); }
  else if (w.tsuyuOut && c.fc.tsuyu !== year * 10 + 2) { c.fc.tsuyu = year * 10 + 2; notable = true; lines.push(`${w.area}地方の梅雨明けが発表された。夏本番だ！`); }
  const k = w.kind;
  const adv = {
    rain: 'かさを持って出かけよう。', heavyrain: '大雨に注意。外の仕事はたいへんかも。', snow: '雪で足もとがすべりやすい。気をつけて。',
    storm: '午後は急な雷雨に注意。', typhoon: `台風が接近。外のロケは中止になるかもしれない。`,
  }[k];
  const hot = w.hi >= 33, frost = w.lo <= 0;
  const repeatRain = (k === 'rain' && c.fc.kind === 'rain' && c.fc.day === st.day - 1);
  if (W.WET.has(k) && !repeatRain) notable = true;
  if (hot || frost || nx.kind === 'typhoon') notable = true;
  if (!notable && st.day - c.fc.day < 5) return null;
  const hw = heatWord(g, w.hi, year);
  lines.unshift(`${src}：${w.regionName}は${labelOf(k, w)}。最高${w.hi}℃・最低${w.lo}℃${hw && hot ? `（${hw}）` : ''}。`);
  if (adv && !repeatRain) lines.push(adv);
  if (hot) lines.push(`${heatIllness(g)}に注意。外を歩くと体力を使う。`);
  else if (frost) lines.push('冷えこみが厳しい朝だ。');
  if (nx.kind === 'typhoon' && k !== 'typhoon') lines.push('あしたは台風が近づく見こみ。');
  c.fc.day = st.day; c.fc.kind = k;
  return lines.slice(0, 3).join('\n');
}

// ======================================================================== the g.* API
const methods = {
  // { day, hour, minute, label 'HH:MM', phase, phaseLabel, minutes (0..1439), total (0..1799: 24:00+ = after
  //   midnight, the same game day), late, text '朝 07:30', alarm, wake }
  clock() {
    const c = clk(this);
    if (!c) return null;
    const m = c.min;
    const d = dateOf(this);
    const sun = W.sunTimes(regionOf(this), d.month, d.rday);
    const phase = phaseOf(m, sun.set);
    const label = hm(m);
    return { day: this.state.day, year: d.year, month: d.month, date: d.rday, hour: Math.floor(m / 60) % 24, minute: m % 60, label, phase, phaseLabel: PHASE_LABEL[phase], minutes: m % 1440, total: m, late: m >= LATE, text: `${PHASE_LABEL[phase]} ${label}`, alarm: c.alarm, wake: c.wake, sunrise: sun.rise, sunset: sun.set };
  },
  // Let time pass (other modules: an activity of their own). Returns g.clock().
  advanceTime(min, reason = '') { pass(this, min, reason); return this.clock(); },
  // Jump to a later time of the day (e.g. a job done at night); returns the minutes that passed.
  advanceTo(minute, reason = '') { return advanceTo(this, minute, reason); },
  // Today's (no day: now, with the current hour) or another day's weather where you are.
  // → { kind, dayKind, label, icon, temp, high, low, pop, pops [0-6,6-12,12-18,18-24], region, regionName, area,
  //     day, now, tsuyu, typhoon (number | 0), warnings [..] }
  weather(day, region) {
    const st = this.state;
    if (!st) return null;
    const c = clk(this);
    const dd = day == null ? st.day : Math.max(1, Math.floor(num(day, st.day)));
    const rg = region || regionOf(this);
    const w = weatherOf(this, dd, rg);
    const now = dd === st.day;
    const kind = now ? W.kindAt(w, c.min) : w.kind;
    return {
      kind, dayKind: w.kind, label: labelOf(kind, w), icon: W.KIND_ICON[kind], temp: now ? W.tempAt(w, c.min) : w.hi, high: w.hi, low: w.lo,
      pop: w.pop, pops: W.popBlocks(w), region: rg, regionName: w.regionName, area: w.area, day: dd, now, tsuyu: w.tsuyu, typhoon: w.typhoon,
      warnings: warningsOf(this, w), wet: W.WET.has(kind),
    };
  },
  // The forecast from today: n days (1..14) → [{ day, month, date (real day), weekday, kind, label, icon, high, low, pop, k }]
  forecast(n = 7, region) {
    const st = this.state;
    if (!st) return [];
    const c = clk(this);
    const rg = region || regionOf(this);
    const out = [];
    for (let i = 0; i < clamp(Math.round(num(n, 7)), 1, 14); i++) {
      const day = st.day + i;
      const a = weatherOf(this, day, rg);
      const d = a.date;
      const f = W.forecastOf({ seed: c.seed, year: d.year, month: d.month, rday: d.rday, region: rg }, a, i);
      out.push({ day, year: d.year, month: d.month, date: d.rday, weekday: weekdayName(day), kind: f.kind, label: labelOf(f.kind, f), icon: W.KIND_ICON[f.kind], high: f.hi, low: f.lo, pop: f.pop, k: i, typhoon: f.typhoon, typhoonSoon: !!f.typhoonSoon, region: rg, regionName: a.regionName });
    }
    return out;
  },
  // '2026年（令和8年）4月7日（水）' (the weekday is the game's: day 1 = 月曜, as the regular shows)
  dateFull(day) { return this.state ? dateFull(this, day) : ''; },
  dateShort(day) { const d = dateOf(this, day); return `${d.month}月${d.rday}日`; },
  // The alarm (minutes 300..540 or null = wake by yourself) and what tonight's sleep would be if you went to bed now.
  setAlarm(min) { const c = clk(this); if (!c) return null; c.alarm = min == null ? null : ALARMS.includes(Number(min)) ? Number(min) : c.alarm; return c.alarm; },
  sleepPlan() {
    const c = clk(this);
    if (!c) return null;
    const wake = wakeFor(c.min, c.alarm);
    const hours = Math.round(((wake + 1440 - c.min) / 60) * 10) / 10;
    return { bed: c.min, wake, hours, alarm: c.alarm, effect: sleepEffect(hours) };
  },
  crimePhaseNow() { const c = clk(this); return c ? crimePhaseOf(c.min) : 'night'; },
  clockLog() { const c = clk(this); return c ? c.log.slice() : []; },
  travelMinutes(from, to) { return travelMinutes(this, from, to); },
  // the HUD's middle panel (ui.js drawHud)
  drawClockHud(ctx, x, y, w, h) {
    const c = clk(this);
    if (!c) return;
    const a = this._clkAnim;
    const f = this.frame || 0;
    const m = a ? animShown(this, a) : c.min;
    if (a && f - a.f0 > 200) this._clkAnim = null;
    const d = dateOf(this);
    const region = regionOf(this);
    const wx = weatherOf(this, this.state.day, region);
    const kind = W.kindAt(wx, m);
    const sun = W.sunTimes(region, d.month, d.rday);
    const phase = phaseOf(m, sun.set);
    const mm = ((m % 1440) + 1440) % 1440;
    const night = mm < sun.rise || mm >= sun.set + 20;
    const tagA = a && a.add >= 10 ? clamp(1 - (f - a.tf0 - 90) / 40, 0, 1) : 0;
    drawClockPanel(ctx, x, y, w, h, {
      date: `${d.month}月${d.rday}日`, label: kind === 'typhoon' ? '台風' : W.KIND_LABEL[kind], kind, night, time: hm(m), phase: PHASE_LABEL[phase],
      temp: W.tempAt(wx, m), late: m >= LATE, tag: a && a.add >= 10 ? `+${passedText(a.add)}` : null, tagA,
    }, f);
  },
  drawWeatherIcon(ctx, kind, x, y, size = 16, night = false) { drawWeatherIcon(ctx, kind, x, y, size, night); },
  // the morning toast (game.js sleep): '12日目（水）の朝　07:00 起床・晴れ 18℃'
  morningToast() {
    const c = clk(this);
    const w = this.weather();
    return `${this.dayLabel()}の朝　${hm(c.min)} 起床・${w ? `${w.label} ${w.high}℃` : ''}`;
  },
};

// ======================================================================== engine hooks
function installHooks() {
  const P = Game && Game.prototype;
  if (!P || P.__clockHooks) return;
  P.__clockHooks = true;
  for (const k of Object.getOwnPropertyNames(methods)) Object.defineProperty(P, k, Object.getOwnPropertyDescriptor(methods, k));

  // --- jobs: by their length; weather: a typhoon cancels outdoor work, rain thins out a street performance's tips
  const job0 = P.job;
  P.job = async function jobClock(def) {
    const g = this;
    if (!def || !g.state || !has0(g)) return job0.call(this, def);
    let d = def;
    let wx = null;
    try { wx = g.weather(); } catch (e) { logOnce('weather', e); }
    const id = String(def.id || '');
    if (wx && wx.kind === 'typhoon' && isOutdoorJob(def)) {
      g.lastJobCancel = 'typhoon';
      await g.say([`台風${wx.typhoon ? `${wx.typhoon}号` : ''}の接近で、今日の「${def.title || 'お仕事'}」は中止になった…。`, '（屋外のお仕事は、天気が回復してからにしよう）'], { name: def.client, look: def.clientLook });
      return null;
    }
    g.lastJobCancel = null;
    if (wx && id.startsWith('street_') && (wx.wet || wx.kind === 'cloudy')) {
      const k = wx.kind === 'cloudy' ? 0.85 : wx.kind === 'rain' || wx.kind === 'storm' ? 0.4 : 0.2;
      d = { ...def, pay: Math.round(num(def.pay, 3000) * k), fame: Math.max(1, Math.round(num(def.fame, 10) * (k < 0.5 ? 0.5 : 1))) };
      if (k < 0.5) await g.say(wx.kind === 'snow' ? '雪の公園は、人がまばらだ…。\n投げ銭は、あまり期待できないかも。' : '雨で人通りが少ない…。\n投げ銭は、あまり期待できないかも。');
    }
    const res = await timed(g, jobMinutes(def), () => job0.call(this, d), (r) => !!r, 'job');
    if (res && wx && isOutdoorJob(def)) {
      if (wx.kind === 'heavyrain' || wx.kind === 'snow') { g.addNeed('stress', 3); g.notify(`${wx.kind === 'snow' ? '雪' : '大雨'}の中の仕事で、ぐったり…（ストレス +3）`, { color: '#ffffff', life: 180 }); }
      else if (wx.temp >= 33) { g.state.stamina = Math.max(0, g.state.stamina - 4); g.notify('炎天下の仕事で、へとへと…（体力 -4）', { color: '#ffffff', life: 180 }); }
    }
    return res;
  };
  const lesson0 = P.lesson;
  P.lesson = function lessonClock(def) { return timed(this, Number.isFinite(Number(def && def.minutes)) ? Number(def.minutes) : 90, () => lesson0.call(this, def), (r) => !!r, 'lesson'); };
  const aud0 = P.audition;
  P.audition = function auditionClock(def) { return timed(this, 120, () => aud0.call(this, def), () => ['passed', 'failed', 'transferDeclined'].includes(this.lastAudition), 'audition'); };
  const mg0 = P.minigame;
  P.minigame = function minigameClock(id, opts = {}) {
    if (!this.state || !has0(this)) return mg0.call(this, id, opts);
    return timed(this, Number.isFinite(Number(opts && opts.minutes)) ? Number(opts.minutes) : 20, () => mg0.call(this, id, opts), () => true, 'minigame');
  };
  // other activities when they exist (installed by modules loaded earlier): minutes, and when a result counts as done
  const ACTS = {
    owaraiPractice: [60, (r) => r !== null && r !== false],
    owaraiLive: [150, (r) => r !== null && r !== false],
    perform: [20, (r) => !!r],
    netaRehearse: [30, (r) => !!(r && r.ok)],
    campaign: [120, (r) => !!(r && r.ok)],
  };
  for (const [k, [min, ok]] of Object.entries(ACTS)) {
    const f0 = P[k];
    if (typeof f0 !== 'function') continue;
    P[k] = function (...a) { if (!this.state || !has0(this)) return f0.apply(this, a); return timed(this, min, () => f0.apply(this, a), ok, k); };
  }
  // sync political acts: the Diet's day, a fundraising party
  for (const [k, min] of [['attendDiet', 240], ['holdFundraiser', 180]]) {
    const f0 = P[k];
    if (typeof f0 !== 'function') continue;
    P[k] = function (...a) { const r = f0.apply(this, a); try { if (r && r.ok && this.state && has0(this)) pass(this, min, k, { auto: true }); } catch (e) { logOnce(k, e); } return r; };
  }
  // meals, baths, unwinding (only when no activity around them is being timed)
  const eat0 = P.eat;
  P.eat = function eatClock(n, opts) {
    const r = eat0.call(this, n, opts);
    try { if (this.ateLast && this.state && has0(this) && !(opts && opts.time === false)) { const h = num(n); pass(this, h >= 30 ? 30 : h >= 15 ? 20 : h >= 8 ? 10 : 5, 'meal', { auto: true }); } } catch (e) { logOnce('eat', e); }
    return r;
  };
  const bathe0 = P.bathe;
  P.bathe = function batheClock(n = 100, silent = false) {
    const r = bathe0.call(this, n, silent);
    try { if (this.state && has0(this)) pass(this, num(n, 100) >= 60 ? 30 : 10, 'bath', { auto: true }); } catch (e) { logOnce('bathe', e); }
    return r;
  };
  const relax0 = P.relax;
  P.relax = function relaxClock(def = {}) {
    let d = def || {};
    try {
      if (this.state && num(d.stress) > 0 && outdoorsNow(this)) {
        const wx = this.weather();
        const c = clk(this);
        if (wx && (wx.wet || wx.temp >= 34 || wx.temp <= 2)) {
          d = { ...d, stress: Math.max(1, Math.round(num(d.stress) * 0.6)) };
          if (c.warn.relaxBad !== this.state.day) { c.warn.relaxBad = this.state.day; this.notify(wx.wet ? 'この天気では、外ではあまり気が晴れない…' : wx.temp >= 34 ? '暑すぎて、外ではあまり休まらない…' : '寒くて、外ではあまり休まらない…', { color: '#ffffff', life: 160 }); }
        } else if (wx && wx.kind === 'sunny' && wx.temp >= 15 && wx.temp <= 27) d = { ...d, stress: num(d.stress) + 2 };
      }
    } catch (e) { logOnce('relaxWx', e); }
    const r = relax0.call(this, d);
    try { if (this.state && has0(this)) pass(this, clamp(10 + 2 * num(def && def.stress) + (num(def && def.clean) > 0 ? 15 : 0), 10, 60), 'relax', { auto: true }); } catch (e) { logOnce('relax', e); }
    return r;
  };
  // hangouts (phone.js's rich hangout replaced PEOPLE_UI.hangout on its load)
  if (PEOPLE_UI && typeof PEOPLE_UI.hangout === 'function' && !PEOPLE_UI.hangout.__clock) {
    const h0 = PEOPLE_UI.hangout;
    const h = function (g, id, spotId) { if (!g || !g.state || !has0(g)) return h0.call(this, g, id, spotId); return timed(g, hangoutMinutes(spotId), () => h0.call(this, g, id, spotId), (r) => r === true || (r && r.ok), 'hangout'); };
    h.__clock = true;
    PEOPLE_UI.hangout = h;
  }
  // walking: a minute per few tiles; weather while walking in town
  const walk0 = P.onWalkStep;
  P.onWalkStep = function walkClock(...a) {
    const r = walk0.apply(this, a);
    try { if (this.state) walkTick(this); } catch (e) { logOnce('walk', e); }
    return r;
  };
  // travel between places (added before the trip, so the arrival — and the place's own scenes — see the new time)
  const goto0 = P.goto;
  P.goto = async function gotoClock(placeId, roomId, x, y, dir, opts) {
    try {
      const from = this.map && this.map.placeId;
      if (this.state && from && placeId && from !== placeId && PLACES[placeId] && !(opts && opts.time === false)) {
        const p = this.map.player;
        let edge = false;
        try { const w = this.map.room && this.map.warpAt(p.x, p.y); edge = !!(w && w.place === placeId); } catch (e) { /* no warp */ }
        const c = clk(this);
        const ex = this._clkExplicit;
        // a module that already let the trip's time pass (its own travel app) just before: do not count it twice
        const already = ex && (this.frame || 0) - ex.f < 900 && (/移動|travel|trip|ride|電車|バス|タクシー|新幹線|徒歩/.test(ex.why) || (!ex.why && ex.phone));
        this._clkExplicit = null;
        let fares = 0;
        try { fares = num(this.state.phone && this.state.phone.apps && this.state.phone.apps.stats && this.state.phone.apps.stats.fares); } catch (e) { fares = 0; }
        const paid = fares > c.fares;
        c.fares = fares;
        const fromPoint = this.map.place && this.map.place.kind === 'town' ? { town: from, x: p.x, y: p.y } : null;
        if (!already) {
          const min = travelMinutes(this, from, placeId, { edge, paid, x, y, fromPoint });
          if (min > 0) pass(this, min, 'travel', { auto: true, quiet: min < 5 });
        }
      }
    } catch (e) { logOnce('goto', e); }
    return goto0.call(this, placeId, roomId, x, y, dir, opts);
  };
  // going to bed: remember the time, so the morning knows how long the night was
  const sleep0 = P.sleep;
  P.sleep = async function sleepClock(opts = {}) {
    try { const c = clk(this); if (c) { c.bed = c.min; c.bedDay = c.day; } } catch (e) { logOnce('sleep', e); }
    return sleep0.call(this, opts);
  };
}
function walkTick(g) {
  const c = clk(g);
  if (!c) return;
  const town = !!(g.map && g.map.place && g.map.place.kind === 'town');
  c.steps++;
  if (c.steps >= (town ? WALK_STEPS_TOWN : WALK_STEPS_INSIDE)) { c.steps = 0; pass(g, 1, 'walk', { auto: true, quiet: true }); }
  if (!outdoorsNow(g)) return;
  c.wsteps++;
  if (c.wsteps < 60) return;
  c.wsteps = 0;
  const wx = g.weather();
  if (!wx) return;
  const day = g.state.day;
  const once = (k, msg) => { if (c.warn[k] !== day) { c.warn[k] = day; g.notify(msg, { color: '#ffffff', life: 200 }); } };
  if (wx.wet) {
    g.addNeed('stress', wx.kind === 'rain' ? 1 : 2);
    once('walkWet', wx.kind === 'snow' ? '雪の中を歩くのは、なかなかたいへんだ…' : wx.kind === 'typhoon' ? '台風の風雨がすごい…。早く建物に入ろう' : '雨の中を歩くのは、気がめいる…');
  }
  const mm = c.min % 1440;
  if (wx.temp >= 33 && mm >= 9 * 60 && mm < 18 * 60) {
    g.state.stamina = Math.max(0, num(g.state.stamina) - 1);
    once('walkHot', `暑い…！${heatIllness(g)}に気をつけよう（外を歩くと体力を使う）`);
  }
}
// The sky over town maps (inside MapScene#drawWorld, in world units, before the HUD)
function installSky() {
  const MP = MapScene && MapScene.prototype;
  if (!MP || typeof MP.drawWorld !== 'function' || MP.drawWorld.__clock) return;
  const dw0 = MP.drawWorld;
  const f = function drawWorldClock(ctx, g) {
    const r = dw0.call(this, ctx, g);
    try { skyHook(this, ctx, g); } catch (e) { logOnce('sky', e); }
    return r;
  };
  f.__clock = true;
  MP.drawWorld = f;
}
function skyHook(map, ctx, g) {
  if (!g || !g.state || !map.place || !map.room) return;
  const P = map.place, def = map.room.def || {};
  if (!(P.kind === 'town' || P.outdoor || def.outdoor) || def.noSky || P.noSky || g.__noSky) return;
  const c = clk(g);
  const region = regionOf(g);
  const d = dateOf(g);
  const wx = weatherOf(g, g.state.day, region);
  const m = g._clkAnim ? animShown(g, g._clkAnim) : c.min;
  drawSky(ctx, map, g, { min: m, sun: W.sunTimes(region, d.month, d.rday), kind: W.kindAt(wx, m), nightOnly: P.id === 'kanraku' || !!P.alwaysNight });
}

installHooks();
installSky();
onMorning(morningHook);
installClockApps();

// for tests / other modules
export const CLOCK = { clk, pass, advanceTo, dateOf, dateFull, warekiOf, phaseOf, crimePhaseOf, regionOf, weatherOf, labelOf, warningsOf, travelMinutes, jobMinutes, wakeFor, sleepEffect, skyOverlay, hm, durText, W };
if (typeof window !== 'undefined') window.__clock = CLOCK;
