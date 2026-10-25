// 天気と気候 (owner: R7-C) — the weather model behind js/engine/clock.js. Pure (no DOM, no game state), so node can
// import it for tests. Everything is deterministic from (save seed, date, region): the same day always has the same
// weather, and a forecast seen on one day is stable for that day.
//
// The climate is era-neutral with randomness: monthly normals, a little warming by year (令和 summers are hotter: 猛暑),
// 梅雨 (June to mid-July), 台風 (mostly Aug–Oct), 雪 (rare in Tokyo / Osaka, Jan–Feb), 夕立・雷雨 in summer afternoons.
// Numbers are rounded normals (気象庁 1991–2020 平年値 for 東京 / 大阪: mean daily max / min, days with ≥ 1 mm rain;
// 梅雨入り・明けの平年日; sunrise / sunset at mid-month); points between them are interpolated.
//
// exports: KINDS, KIND_LABEL, KIND_ICON, REGIONS, regionKey(prefRegion, prefId), dayWeather(o), tempAt(w, minute),
//   kindAt(w, minute), popBlocks(w), forecastOf(o, k), sunTimes(region, month), tsuyuOf(o), typhoonNo(o), h32, rand

export const KINDS = ['sunny', 'cloudy', 'rain', 'heavyrain', 'snow', 'storm', 'typhoon'];
export const KIND_LABEL = { sunny: '晴れ', cloudy: 'くもり', rain: '雨', heavyrain: '大雨', snow: '雪', storm: '雷雨', typhoon: '台風' };
// glyphs that DotGothic16 has (☀ ☁ ☂ ☃); the HUD and the apps draw pixel icons instead (clock_fx.js drawWeatherIcon)
export const KIND_ICON = { sunny: '☀', cloudy: '☁', rain: '☂', heavyrain: '☂', snow: '☃', storm: '☂', typhoon: '☂' };
export const WET = new Set(['rain', 'heavyrain', 'snow', 'storm', 'typhoon']);

// ---------------------------------------------------------------- hashing
export function h32(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return h >>> 0;
}
export const rand = (...k) => h32(k.join('|')) / 4294967296;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round10 = (v) => clamp(Math.round(v / 10) * 10, 0, 100);

// ---------------------------------------------------------------- climate
// hi / lo: mean daily max / min (℃) by month; rain: share of days with ≥ 1 mm; snow: chance of a snowy day;
// rise / set: sunrise / sunset (minutes) at mid-month; tsuyu: normal [start, end] as [month, day];
// ty: how often typhoons hit compared with Tokyo.
const TOKYO = {
  name: '東京', area: '関東甲信',
  hi: [9.8, 10.9, 14.2, 19.4, 23.6, 26.1, 29.9, 31.3, 27.5, 22.0, 16.7, 12.0],
  lo: [1.2, 2.1, 5.0, 9.8, 14.6, 18.5, 22.4, 23.5, 20.3, 14.8, 8.8, 3.8],
  rain: [0.16, 0.21, 0.33, 0.33, 0.35, 0.43, 0.38, 0.28, 0.38, 0.34, 0.26, 0.17],
  snow: [0.06, 0.07, 0.015, 0, 0, 0, 0, 0, 0, 0, 0, 0.02],
  rise: [410, 390, 355, 315, 280, 265, 280, 305, 330, 355, 380, 405],
  set: [1010, 1040, 1065, 1090, 1115, 1138, 1135, 1105, 1065, 1025, 995, 990],
  tsuyu: [[6, 7], [7, 19]], ty: 1,
};
const shift = (a, d) => a.map((v) => Math.round((v + d) * 10) / 10);
const OSAKA = {
  name: '大阪', area: '近畿',
  hi: [9.7, 10.5, 14.1, 19.9, 24.9, 27.8, 31.8, 33.4, 29.4, 23.6, 17.6, 12.2],
  lo: [2.8, 3.0, 5.7, 10.4, 15.5, 19.9, 24.1, 25.3, 21.8, 15.9, 9.9, 5.0],
  rain: [0.18, 0.23, 0.33, 0.33, 0.34, 0.41, 0.34, 0.24, 0.33, 0.27, 0.21, 0.19],
  snow: [0.04, 0.04, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0.01],
  rise: TOKYO.rise.map((v) => v + 18), set: TOKYO.set.map((v) => v + 18),
  tsuyu: [[6, 6], [7, 19]], ty: 1.1,
};
// The 実家 (hometown) uses its region's climate: rough offsets from Tokyo / Osaka (flavour; no forecast screen claims
// exact numbers for them).
export const REGIONS = {
  tokyo: TOKYO,
  osaka: OSAKA,
  hokkaido: { ...TOKYO, name: '北海道', area: '北海道', hi: shift(TOKYO.hi, -7.5), lo: shift(TOKYO.lo, -8.5), rain: TOKYO.rain.map((v, i) => (i >= 5 && i <= 6 ? v * 0.7 : v)), snow: [0.7, 0.65, 0.4, 0.05, 0, 0, 0, 0, 0, 0, 0.15, 0.55], rise: TOKYO.rise.map((v, i) => v + [5, -5, -15, -25, -35, -40, -35, -25, -15, -5, 5, 10][i]), set: TOKYO.set.map((v, i) => v + [-15, -5, 5, 15, 25, 30, 30, 20, 10, 0, -10, -15][i]), tsuyu: null, ty: 0.3 },
  tohoku: { ...TOKYO, name: '東北', area: '東北', hi: shift(TOKYO.hi, -4), lo: shift(TOKYO.lo, -4.5), snow: [0.45, 0.4, 0.2, 0.02, 0, 0, 0, 0, 0, 0, 0.05, 0.3], tsuyu: [[6, 13], [7, 26]], ty: 0.5 },
  chubu: { ...TOKYO, name: '中部', area: '東海', hi: shift(TOKYO.hi, -0.8), lo: shift(TOKYO.lo, -1.5), snow: [0.12, 0.12, 0.03, 0, 0, 0, 0, 0, 0, 0, 0.01, 0.06], tsuyu: [[6, 6], [7, 19]], ty: 0.9 },
  chugoku: { ...OSAKA, name: '中国', area: '中国', hi: shift(OSAKA.hi, -0.3), lo: shift(OSAKA.lo, -0.8), snow: [0.06, 0.05, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0.02], rise: OSAKA.rise.map((v) => v + 12), set: OSAKA.set.map((v) => v + 12), tsuyu: [[6, 6], [7, 19]], ty: 1 },
  shikoku: { ...OSAKA, name: '四国', area: '四国', hi: shift(OSAKA.hi, 0.4), lo: shift(OSAKA.lo, 0.4), snow: [0.02, 0.02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01], rise: OSAKA.rise.map((v) => v + 10), set: OSAKA.set.map((v) => v + 10), tsuyu: [[6, 5], [7, 17]], ty: 1.3 },
  kyushu: { ...OSAKA, name: '九州', area: '九州北部', hi: shift(OSAKA.hi, 0.6), lo: shift(OSAKA.lo, 1), snow: [0.03, 0.03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01], rise: OSAKA.rise.map((v) => v + 25), set: OSAKA.set.map((v) => v + 25), tsuyu: [[6, 4], [7, 19]], ty: 1.4 },
  okinawa: { ...OSAKA, name: '沖縄', area: '沖縄', hi: [19.8, 20.2, 21.7, 24.1, 26.7, 29.4, 31.8, 31.5, 30.4, 27.9, 24.6, 21.2], lo: [14.9, 15.2, 16.6, 19.0, 21.8, 24.8, 26.6, 26.5, 25.5, 23.1, 20.1, 16.5], snow: new Array(12).fill(0), rise: TOKYO.rise.map((v) => v + 50), set: TOKYO.set.map((v) => v + 60), tsuyu: [[5, 10], [6, 21]], ty: 2 },
};
// profile.js region (+ prefecture) → climate key
export function regionKey(prefRegion, prefId) {
  if (prefId === 'okinawa') return 'okinawa';
  return { hokkaido: 'hokkaido', tohoku: 'tohoku', kanto: 'tokyo', chubu: 'chubu', kansai: 'osaka', chugoku: 'chugoku', shikoku: 'shikoku', kyushu: 'kyushu' }[prefRegion] || 'tokyo';
}
const climOf = (r) => REGIONS[r] || TOKYO;

// A monthly value at a real day of the month: interpolated between the mid-points of the months.
function monthly(arr, month, rday) {
  const f = (rday - 15) / 30;
  const i = month - 1;
  const j = f >= 0 ? (i + 1) % 12 : (i + 11) % 12;
  return arr[i] + (arr[j] - arr[i]) * Math.abs(f);
}
export function sunTimes(region, month, rday = 15) {
  const c = climOf(region);
  return { rise: Math.round(monthly(c.rise, month, rday)), set: Math.round(monthly(c.set, month, rday)) };
}

// warming: about +0.025 ℃ a year around the 1991–2020 normals' centre; 令和 summers a further +1 ℃ (猛暑)
function eraWarm(year, month) {
  const base = (year - 2005) * 0.025;
  const summer = year >= 2018 && month >= 6 && month <= 9 ? 1.0 : year >= 2010 && month >= 7 && month <= 8 ? 0.4 : 0;
  return base + summer;
}

// ---------------------------------------------------------------- 梅雨 / 台風
const md = (m, d) => m * 100 + d;
// The year's 梅雨 for the region: { start: [m, d], end: [m, d] } (±6 days around the normal), or null (北海道).
export function tsuyuOf(o) {
  const c = climOf(o.region);
  if (!c.tsuyu) return null;
  const j1 = Math.round((rand(o.seed, o.year, c.area, 'tsuyu1') - 0.5) * 12);
  const j2 = Math.round((rand(o.seed, o.year, c.area, 'tsuyu2') - 0.5) * 14);
  const mv = ([m, d], j) => { let dd = d + j, mm = m; if (dd < 1) { mm--; dd += 30; } if (dd > 30) { mm++; dd -= 30; } return [mm, dd]; };
  return { start: mv(c.tsuyu[0], j1), end: mv(c.tsuyu[1], j2) };
}
const inTsuyu = (o, t) => !!t && md(o.month, o.rday) >= md(...t.start) && md(o.month, o.rday) <= md(...t.end);
// Typhoons are national weather systems: whether one hits on a date does not depend on the city, only how likely
// a hit is there (REGIONS[].ty). Per game day (≈ 3 real days).
const TY_P = [0, 0, 0, 0, 0, 0.01, 0.025, 0.06, 0.08, 0.04, 0.005, 0];
function typhoonOn(o, month, rday) {
  const p = TY_P[month - 1] * climOf(o.region).ty;
  return p > 0 && rand(o.seed, o.year, month, rday, 'ty') < p;
}
function nextDate(month, rday) { return rday + 3 <= 28 ? [month, rday + 3] : [(month % 12) + 1, 1]; }
// The year's typhoon number for a typhoon day: counted from the typhoon days before it (about 25 form a year; the
// ones that reach Japan in late summer are usually numbered in the teens).
export function typhoonNo(o) {
  let n = 0;
  for (let m = 6; m <= o.month; m++) for (let d = 1; d <= 28; d += 3) { if (m === o.month && d >= o.rday) break; if (TY_P[m - 1] && rand(o.seed, o.year, m, d, 'ty') < TY_P[m - 1] * climOf(o.region).ty) n++; }
  return 4 + Math.floor(rand(o.seed, o.year, 'tybase') * 4) + n * 3 + (o.month - 6);
}

// ---------------------------------------------------------------- one day
// o: { seed, year, month (1..12), rday (real day of the month), region }
// → { kind (the day's), base (storm days: the weather outside the storm hours), hi, lo, pop, tsuyu (bool),
//     tsuyuIn / tsuyuOut (today is the announced start / end), typhoon (number) | 0, typhoonNext (bool),
//     region, regionName, area }
export function dayWeather(o) {
  const c = climOf(o.region);
  const m = o.month, r = (k) => rand(o.seed, o.year, m, o.rday, o.region, k);
  const ts = tsuyuOf(o);
  const tsuyu = inTsuyu(o, ts);
  let kind, base = null;
  let typhoon = 0;
  const tyNext = typhoonOn(o, ...nextDate(m, o.rday));
  if (typhoonOn(o, m, o.rday)) { kind = 'typhoon'; typhoon = typhoonNo(o); }
  else if (tyNext && r('tyn') < 0.7) kind = r('tyh') < 0.4 ? 'heavyrain' : 'rain'; // the front ahead of the typhoon
  else {
    const pRain = tsuyu ? 0.6 : c.rain[m - 1];
    const x = r('kind');
    if (x < pRain) {
      const pSnow = c.snow[m - 1] / Math.max(0.05, pRain);
      const heavy = tsuyu && m === 7 ? 0.3 : m === 9 ? 0.2 : m >= 6 && m <= 10 ? 0.14 : 0.06;
      kind = r('snow') < pSnow ? 'snow' : r('heavy') < heavy ? 'heavyrain' : 'rain';
    } else {
      const pCloud = tsuyu ? 0.75 : 0.42;
      kind = (x - pRain) / (1 - pRain) < pCloud ? 'cloudy' : 'sunny';
      // summer afternoons: 夕立・雷雨 (more often in recent years)
      const storm = [0, 0, 0, 0, 0.02, 0.04, 0.12, 0.15, 0.08, 0.02, 0, 0][m - 1] * (o.year >= 2008 ? 1.3 : 1);
      if (!tsuyu && r('storm') < storm) { base = kind; kind = 'storm'; }
    }
  }
  // temperatures
  const noise = (k, a) => (r(k + 1) + r(k + 2) + r(k + 3) - 1.5) * a;
  const warm = eraWarm(o.year, m);
  let hi = monthly(c.hi, m, o.rday) + warm + noise('hi', 2.6);
  let lo = monthly(c.lo, m, o.rday) + warm * 0.8 + noise('lo', 2);
  if (kind === 'rain' || kind === 'heavyrain' || kind === 'typhoon') { hi -= kind === 'typhoon' && m >= 8 ? 1 : 2.6; lo += 0.8; }
  else if (kind === 'cloudy') hi -= 1;
  else if (kind === 'sunny' && m >= 7 && m <= 8 && !tsuyu) hi += 0.8;
  if (kind === 'snow') { hi = Math.min(hi, 2 + r('sh') * 3); lo = Math.min(lo, -1 + r('sl') * 1.5); }
  hi = Math.round(hi); lo = Math.round(Math.min(lo, hi - 3));
  // a rainy forecast day in winter that is cold enough reads as rain mixed with snow (still 'rain' here)
  const pop = round10({ sunny: 5 + r('p') * 10, cloudy: 20 + r('p') * 20, rain: 70 + r('p') * 20, heavyrain: 90 + r('p') * 10, snow: 60 + r('p') * 30, storm: 40 + r('p') * 20, typhoon: 100 }[kind]);
  return {
    kind, base, hi, lo, pop, tsuyu, typhoon, typhoonNext: tyNext,
    tsuyuIn: !!ts && ts.start[0] === m && Math.abs(ts.start[1] - o.rday) < 2,
    tsuyuOut: !!ts && ts.end[0] === m && Math.abs(ts.end[1] - o.rday) < 2,
    region: o.region, regionName: c.name, area: c.area,
  };
}
// The weather at a time of day (minutes since midnight; 24:00+ is the same day's night): a storm day is sunny /
// cloudy outside 14:00–19:00.
export function kindAt(w, minute) {
  if (w.kind !== 'storm') return w.kind;
  const m = ((minute % 1440) + 1440) % 1440;
  return m >= 840 && m < 1140 ? 'storm' : w.base || 'cloudy';
}
// The temperature at a time of day: lowest at 5:00, highest at 14:00.
export function tempAt(w, minute) {
  let m = minute;
  if (m < 300) m += 1440;
  let t;
  if (m <= 840) t = w.lo + (w.hi - w.lo) * (1 - Math.cos((Math.PI * (m - 300)) / 540)) / 2;
  else t = w.hi - (w.hi - w.lo) * (1 - Math.cos((Math.PI * Math.min(900, m - 840)) / 900)) / 2;
  return Math.round(t);
}
// 降水確率 for 0–6, 6–12, 12–18, 18–24 時
export function popBlocks(w) {
  const p = w.pop;
  switch (w.kind) {
    case 'sunny': return [0, p, p, 0];
    case 'cloudy': return [Math.max(0, p - 10), p, p, Math.max(0, p - 10)];
    case 'storm': return [0, 10, Math.max(50, p), 30];
    case 'typhoon': return [90, 100, 100, 80];
    default: return [Math.max(0, p - 20), p, p, Math.max(0, p - 10)];
  }
}
// A forecast made k days ahead (k ≥ 1): sometimes a step off (more often the further ahead), temperatures ± k/2.
// `actual` is dayWeather() of that date; o is the same date context (for the hash).
export function forecastOf(o, actual, k) {
  if (k <= 0) return { ...actual, k: 0 };
  const r = (key) => rand(o.seed, o.year, o.month, o.rday, o.region, 'fc', k, key);
  let kind = actual.kind;
  if (r('miss') < Math.min(0.45, 0.07 * k)) {
    kind = { sunny: 'cloudy', cloudy: r('w') < 0.5 ? 'sunny' : 'rain', rain: 'cloudy', heavyrain: 'rain', snow: 'rain', storm: 'cloudy', typhoon: 'rain' }[kind] || kind;
  }
  if (actual.kind === 'typhoon' && k >= 4) kind = 'rain';
  const hi = actual.hi + Math.round((r('eh') - 0.5) * k);
  const lo = Math.min(hi - 3, actual.lo + Math.round((r('el') - 0.5) * k));
  const pop = kind === actual.kind ? actual.pop : round10({ sunny: 10, cloudy: 30, rain: 60, heavyrain: 80, snow: 60, storm: 40, typhoon: 90 }[kind] + (r('pp') - 0.5) * 20);
  return { ...actual, kind, hi, lo, pop, k, typhoon: kind === 'typhoon' ? actual.typhoon : 0, typhoonSoon: actual.kind === 'typhoon' && k <= 6 };
}
