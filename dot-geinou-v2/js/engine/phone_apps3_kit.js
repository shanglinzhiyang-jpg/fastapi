// Shared pieces of the third set of phone apps (phone_apps3*.js, owner R7-G): the saved state
// (g.state.phone.apps3, repaired once per state object), the game calendar, a reload-proof random
// source, the time of day / weather when the clock module is there (feature-detected), and small
// drawing helpers. API doc: test-output/api_apps3.txt.

import { clamp, display } from './util.js';
import { measure, wrap } from './draw.js';
import { audio } from './audio.js';
import { rrect, box, phoneText as T, fitText, PC } from './phone.js';
import { devOf, eraId, gameDate } from './phone_apps.js';

export { devOf, eraId };
export const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const arr = (v) => (Array.isArray(v) ? v : []);
export const str = (v, n = 200) => Array.from(typeof v === 'string' || typeof v === 'number' ? String(v) : '').slice(0, n).join('');
export const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
export function art(c, x, y, rows, pal, s = 1) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const col = pal[rows[j][i]]; if (col) R(c, x + i * s, y + j * s, s, s, col); }
}
export const commas = (n) => Math.round(n).toLocaleString('ja-JP');
// an amount the player picks in the era's shown yen → internal yen (util.js eraPrice is the other way)
export const toInternal = (shown) => Math.round(shown / (display.priceRate || 1));
export const pct = (v, d = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
export const mmss = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ''}` : `${m}分`; };

// ======================================================================== calendar
// 1 game year = 120 days, 1 month = 10 days, from April of the era's first year (phone_apps.js gameDate).
export function dateOf(g, day) {
  const dd = Math.max(1, Math.floor(day ?? num(g.state && g.state.day, 1)));
  const d = gameDate(g, dd);
  return { year: d.year, month: d.month, dom: ((dd - 1) % 10) + 1 };
}
export const ymOf = (g, day) => { const d = dateOf(g, day); return d.year * 100 + d.month; };
// the game day as a point in real time (years): 2026.25 = the start of April 2026
export function realT(g, day) { const d = dateOf(g, day); return d.year + (d.month - 1) / 12 + (d.dom - 1) / 120; }
export const yearOf = (g, day) => dateOf(g, day).year;
export const isTecho = (g) => devOf(g) === 'techo';

// ======================================================================== random (reload-proof)
export function h32(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return h >>> 0;
}
// a number in [0, 1) fixed by the save's seed and the keys (same day → same draw after a reload)
export const rnd = (g, ...keys) => h32(`${s3(g).seed}:${keys.join(':')}`) / 4294967296;
export function gaussR(g, ...keys) {
  const u = Math.max(1e-9, rnd(g, ...keys, 'u')), v = rnd(g, ...keys, 'v');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ======================================================================== state
// g.state.phone.apps3 = { v, seed, <part>: {...} }. Each app module registers its part with
// definePart(name, repair(raw, day, g) → clean object); s3(g) repairs all parts once per state object.
const PARTS = {};
export function definePart(name, repair) { PARTS[name] = repair; }
const READY = new WeakSet();
export function s3(g) {
  const st = g.state;
  if (!isObj(st.phone)) st.phone = { inbox: [], nextId: 1, lastPost: 0, posts: 0 };
  let s = st.phone.apps3;
  if (!isObj(s)) s = st.phone.apps3 = {};
  if (READY.has(s)) {
    for (const [k, fn] of Object.entries(PARTS)) if (!isObj(s[k])) s[k] = fn({}, Math.max(1, num(st.day, 1)), g) || {};
    return s;
  }
  READY.add(s);
  s.v = 1;
  if (!Number.isFinite(Number(s.seed)) || !s.seed) s.seed = (Math.floor(Math.random() * 2147483646) + 1);
  s.seed = Math.floor(num(s.seed, 1));
  const day = Math.max(1, num(st.day, 1));
  for (const [k, fn] of Object.entries(PARTS)) {
    try { s[k] = fn(isObj(s[k]) ? s[k] : {}, day, g) || {}; } catch (e) { console.error(e); s[k] = fn({}, day, g) || {}; }
  }
  return s;
}
export const part = (g, name) => s3(g)[name];

// ======================================================================== clock / weather (R7-C's clock.js, when present)
// g.clock() may return minutes since midnight, 'HH:MM', or { hour|h, minute|m|min } / { minutes } / { time }.
export function clockNow(g) {
  if (!has(g, 'clock')) return null;
  let c = null;
  try { c = g.clock(); } catch (e) { console.error(e); return null; }
  let min = null;
  const fromStr = (s) => { const m = /(\d{1,2})[:：時](\d{2})/.exec(String(s)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  if (typeof c === 'number' && Number.isFinite(c)) min = c;
  else if (typeof c === 'string') min = fromStr(c);
  else if (isObj(c)) {
    if (Number.isFinite(Number(c.minutes))) min = Number(c.minutes);
    else if (Number.isFinite(Number(c.min)) && c.hour == null && c.h == null) min = Number(c.min);
    else if (c.hour != null || c.h != null) min = num(c.hour ?? c.h) * 60 + num(c.minute ?? c.m ?? c.min);
    else if (c.time || c.label) min = fromStr(c.time || c.label);
  }
  if (!Number.isFinite(min)) return null;
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  return { min, h, m, label: `${h}:${String(m).padStart(2, '0')}`, raw: c };
}
export const clockLabel = (min) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };
// Let time pass when the clock module offers a way (the first of these names that exists).
export function passMinutes(g, min) {
  if (!(min > 0)) return false;
  for (const k of ['advanceClock', 'passTime', 'addMinutes', 'advanceTime', 'clockAdvance', 'spendTime']) {
    if (has(g, k)) { try { g[k](Math.round(min)); return true; } catch (e) { console.error(e); return false; } }
  }
  return false;
}
// → { id: 'sunny'|'cloudy'|'rain'|'storm'|'snow'|'typhoon', label } or null (no weather module)
export function weatherNow(g) {
  if (!has(g, 'weather')) return null;
  let w = null;
  try { w = g.weather(); } catch (e) { console.error(e); return null; }
  if (!w) return null;
  const s = typeof w === 'string' ? w : [w.id, w.kind, w.type, w.name, w.label].filter(Boolean).join(' ');
  const id = /typhoon|台風/.test(s) ? 'typhoon' : /snow|雪/.test(s) ? 'snow' : /storm|heavy|大雨|嵐|雷/.test(s) ? 'storm'
    : /rain|雨/.test(s) ? 'rain' : /cloud|くもり|曇/.test(s) ? 'cloudy' : 'sunny';
  const label = (isObj(w) && (w.label || w.name)) || { typhoon: '台風', snow: '雪', storm: '大雨', rain: '雨', cloudy: 'くもり', sunny: '晴れ' }[id];
  return { id, label: String(label) };
}
export const badWeather = (w) => !!w && (w.id === 'typhoon' || w.id === 'storm' || w.id === 'snow');

// ======================================================================== small UI bits
export function bar(c, x, y, w, h, frac, col, back = '#e4ddcc') {
  R(c, x, y, w, h, back);
  const fw = Math.round(w * clamp(frac, 0, 1));
  if (fw > 0) R(c, x, y, fw, h, col);
}
// a line chart of values (null = gap) in the box; returns { min, max }
export function lineChart(c, x, y, w, h, vals, col, opt = {}) {
  const v = vals.filter((n) => Number.isFinite(n));
  if (!v.length) return null;
  let min = Math.min(...v), max = Math.max(...v);
  if (max - min < 1e-9) { max += 1; min -= 1; }
  const pad = (max - min) * 0.08;
  min -= pad; max += pad;
  R(c, x, y, w, h, opt.bg || '#fbf8ee');
  for (let i = 1; i < 4; i++) R(c, x, y + Math.round((h * i) / 4), w, 1, opt.grid || '#ece4d2');
  if (Number.isFinite(opt.base)) { const by = y + h - ((opt.base - min) / (max - min)) * h; if (by > y && by < y + h) for (let i = 0; i < w; i += 4) R(c, x + i, by, 2, 1, '#b8ac94'); }
  const n = vals.length;
  let px = null, py = null;
  for (let i = 0; i < n; i++) {
    const val = vals[i];
    if (!Number.isFinite(val)) { px = null; continue; }
    const cx = x + (n === 1 ? w / 2 : (i * (w - 1)) / (n - 1));
    const cy = y + h - 1 - ((val - min) / (max - min)) * (h - 2);
    if (px != null) {
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(cx - px), Math.abs(cy - py))));
      for (let k = 0; k <= steps; k++) R(c, px + ((cx - px) * k) / steps, py + ((cy - py) * k) / steps, 2, 2, col);
    } else R(c, cx, cy, 2, 2, col);
    px = cx; py = cy;
  }
  return { min, max };
}
// a few lines of wrapped text; returns the y after it
export function para(c, s, x, y, w, size = 12, col = PC.text, maxLines = 99, lh = size + 4) {
  const lines = wrap(c, String(s), w, size).slice(0, maxLines);
  lines.forEach((l, i) => T(c, l, x, y + i * lh, size, col));
  return y + lines.length * lh;
}
// a chip (coloured tag); returns its width
export function chip(c, s, x, y, col, size = 12) {
  const w = Math.max(24, Math.ceil(measure(c, s, size)) + 8);
  rrect(c, x, y, w, size + 4, 4, col);
  T(c, s, x + w / 2, y + 2, size, '#ffffff', 'center');
  return w;
}
// buttons in a row at the bottom of an area: [{ label, col }], sel index → rects (for tap)
export function buttons(c, a, labels, sel, col, y0 = null) {
  const n = labels.length;
  const gap = 6, bw = Math.floor((a.w - 16 - gap * (n - 1)) / n);
  const y = y0 ?? a.y + a.h - 30;
  const rects = [];
  labels.forEach((lb, i) => {
    const x = a.x + 8 + i * (bw + gap);
    const on = i === sel;
    box(c, x, y, bw, 24, 5, on ? col : '#ffffff', on ? '#2a2a3a' : '#b8b0a0', { lo: on ? '#00000033' : '#e4ddcc' });
    T(c, fitText(c, lb, bw - 6, 12), x + bw / 2, y + 5, 12, on ? '#ffffff' : PC.text, 'center');
    rects.push({ x, y, w: bw, h: 24 });
  });
  return rects;
}
export const hit = (r, x, y) => !!r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
export const sfx = (n) => audio.sfx(n);
export { T, fitText, PC, rrect, box, measure, wrap, clamp };
