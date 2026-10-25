// 世界情勢の画面の部品 (R9-E): the palette, text helpers without overflow, panels, gauges, pixel icons, chips, line charts
// and the stage bar, shared by world_ui.js, world_ui_map.js and world_ui_more.js.
import { clamp } from './util.js';
import { text, measure } from './draw.js';
import { audio } from './audio.js';

export const has = (g, k) => !!g && typeof g[k] === 'function';
export const safe = (fn, d = null) => { try { return fn(); } catch (e) { console.error(e); return d; } };
export const num = (v, d = 0) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
export const sfx = (k) => { try { audio.sfx(k); } catch (e) { /* no audio */ } };
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export const n0 = (n) => Math.max(0, Math.round(num(n))).toLocaleString('ja-JP');
export const K = {
  bg: '#07101c', head: '#0b1626', panel: '#0d1a2c', panel2: '#10223a', edge: '#21405e', edgeHi: '#4a86b8', text: '#e8f0f8', dim: '#93a8bc', faint: '#566c80',
  amber: '#ffb547', cyan: '#4fd2e8', good: '#57d98a', bad: '#ff6470', warn: '#ffcc4d', sel: '#173452', lock: '#c9a76a', sea: '#0c2640', sea2: '#0e2c48', land: '#4a5462', white: '#ffffff', danger: '#ff5468',
  blue: '#4f8fe8', violet: '#b48cff', ink: '#1a1206',
};
// ---------------------------------------------------------------- text (every string has a width: no overflow)
export function fit(c, s, w, size = 12) {
  s = String(s ?? '');
  if (w <= 0) return '';
  if (measure(c, s, size) <= w) return s;
  const a = Array.from(s);
  while (a.length > 1 && measure(c, a.join('') + '…', size) > w) a.pop();
  return a.join('') + '…';
}
export function T(c, s, x, y, size = 12, color = K.text, align = 'left', w = 0) { text(c, w > 0 ? fit(c, s, w, size) : String(s ?? ''), Math.round(x), Math.round(y), { size, color, align, shadow: null }); }
// Japanese line breaking: a number keeps its unit (「5,260人」「1.2兆円」「48%」), no closing mark starts a line.
const NO_START = new Set('、。，．・：；？！ー～…‥）」』】〕〉》’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ!?.,)]}%％'.split(''));
const NO_END = new Set('（「『【〔〈《‘“([{'.split(''));
const TOKEN = /[−\-＋+]?[0-9０-９]+(?:[.,][0-9]+)*(?:[／/][0-9]+)?(?:分の[0-9]+|[%％年月日歳人分万億兆円倍回本条号割棟件隻機台ドル]+)?|[A-Za-z0-9.,:%/+\-#'’]+|\s+|./gu;
export function jwrap(c, str, w, size = 12) {
  measure(c, '', size);
  const Wd = (s0) => c.measureText(s0).width;
  const out = [];
  for (const par of String(str ?? '').split('\n')) {
    const toks = par.match(TOKEN) || [];
    let line = '';
    for (const t of toks) {
      if (!line && /^\s+$/.test(t)) continue;
      if (Wd(line + t) <= w) { line += t; continue; }
      if (!line) { for (const ch of Array.from(t)) { if (line && Wd(line + ch) > w) { out.push(line); line = ''; } line += ch; } continue; }
      let carry = '';
      if (Array.from(t).length === 1 && NO_START.has(t)) { const a0 = Array.from(line); carry = a0.pop(); line = a0.join(''); }
      while (line.length > 1 && NO_END.has(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
      out.push(line);
      line = carry + (/^\s+$/.test(t) ? '' : t);
    }
    out.push(line);
  }
  return out;
}
export function para(c, s, x, y, w, size = 12, color = K.text, lh = 0, maxLines = 99) {
  const ls = jwrap(c, s, w, size);
  const step = lh || size + 4;
  const n = Math.min(ls.length, maxLines);
  for (let i = 0; i < n; i++) T(c, i === n - 1 && ls.length > n ? fit(c, ls[i] + '…', w, size) : ls[i], x, y + i * step, size, color);
  return n * step;
}
export function panel(c, x, y, w, h, title, opts = {}) {
  R(c, x, y, w, h, opts.bg || K.panel);
  R(c, x, y, w, 1, opts.accent || K.edge); R(c, x, y + h - 1, w, 1, K.edge); R(c, x, y, 1, h, K.edge); R(c, x + w - 1, y, 1, h, K.edge);
  if (title) {
    R(c, x + 1, y + 1, w - 2, 17, K.panel2);
    let tx = x + 6;
    if (opts.icon) { icon(c, opts.icon, x + 5, y + 4, 1, opts.accent || K.amber); tx += 12; }
    T(c, title, tx, y + 3, 12, opts.accent || K.amber, 'left', w - (tx - x) - 6 - (opts.right ? measure(c, opts.right, 10) + 8 : 0));
    if (opts.right) T(c, opts.right, x + w - 6, y + 4, 10, K.dim, 'right');
  }
}
// a small section header inside a panel: a coloured tick + the label
export function section(c, x, y, label, col = K.amber, w = 0) { R(c, x, y + 2, 3, 9, col); T(c, label, x + 7, y, 10, col, 'left', w ? w - 7 : 0); return 14; }
export const relColor = (v) => (v >= 60 ? '#3aa86a' : v >= 25 ? '#7cbc62' : v > -25 ? '#c4b46a' : v > -60 ? '#d07a46' : '#c63c3c');
export const relText = (v) => (v >= 60 ? '#57d98a' : v >= 25 ? '#9fdc7a' : v > -25 ? '#e2d38a' : v > -60 ? '#f09a62' : '#ff6470');
export function gauge(c, x, y, w, v, lo = -100, hi = 100, h = 6) {
  R(c, x, y, w, h, '#1a2a3a');
  const z = x + ((0 - lo) / (hi - lo)) * w;
  const p = x + ((clamp(v, lo, hi) - lo) / (hi - lo)) * w;
  R(c, Math.min(z, p), y, Math.max(1, Math.abs(p - z)), h, relColor(v));
  R(c, z, y - 1, 1, h + 2, K.dim);
}
export function bar(c, x, y, w, v, max, col, h = 6) { R(c, x, y, w, h, '#1a2a3a'); R(c, x, y, Math.max(0, Math.min(w, (num(v) / max) * w)), h, col); }
export function sparkline(c, x, y, w, h, vals, col) {
  if (!vals || vals.length < 2) return;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const rng = Math.max(1e-6, hi - lo);
  R(c, x, y + h, w, 1, K.edge);
  vals.forEach((v, i) => { const px = x + (i / (vals.length - 1)) * (w - 2); const py = y + h - 2 - ((v - lo) / rng) * (h - 4); R(c, px, py, 2, 2, col); });
}
// ▲ / ▼ with the change (good = up unless `downGood`)
export function trend(c, x, y, d, size = 10, downGood = false, align = 'left') {
  const v = Math.round(num(d));
  if (!v) { T(c, '→ 0', x, y, size, K.dim, align); return measure(c, '→ 0', size); }
  const up = v > 0;
  const good = downGood ? !up : up;
  const s = `${up ? '▲' : '▼'}${Math.abs(v)}`;
  T(c, s, x, y, size, good ? K.good : K.bad, align);
  return measure(c, s, size);
}
// ---------------------------------------------------------------- pixel icons (9x9; '#' = the colour, '+' = a lighter shade)
const ICON_BITS = {
  globe: ['..#####..', '.#.#.#.#.', '#..#.#..#', '#########', '#..#.#..#', '#########', '#..#.#..#', '.#.#.#.#.', '..#####..'],
  flag: ['##.......', '#######..', '#######..', '#######..', '#######..', '#........', '#........', '#........', '#........'],
  region: ['.###.....', '#####..##', '#####.###', '.###..###', '......##.', '.##......', '####..##.', '.##..####', '......##.'],
  hand: ['.........', '..##.##..', '.#######.', '#########', '####.####', '.#######.', '..#####..', '...###...', '.........'],
  money: ['..#####..', '.#######.', '##.###.##', '###.#.###', '##.....##', '####.####', '##.....##', '.###.###.', '..#####..'],
  shield: ['#########', '#########', '##.....##', '##.....##', '##.....##', '.##...##.', '.##...##.', '..##.##..', '...###...'],
  crisis: ['....#....', '...###...', '...#.#...', '..##.##..', '..##.##..', '.###.###.', '.#######.', '####.####', '#########'],
  chart: ['#........', '#.....##.', '#....#.#.', '#...#...#', '#.##.....', '##.......', '#........', '#........', '#########'],
  clock: ['..#####..', '.#..#..#.', '#...#...#', '#...#...#', '#...####.', '#.......#', '#.......#', '.#.....#.', '..#####..'],
  news: ['#########', '#.......#', '#.##.##.#', '#.......#', '#.##.##.#', '#.......#', '#.##.##.#', '#.......#', '#########'],
  war: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '.##...##.', '##.....##', '#.......#'],
  ban: ['..#####..', '.##...##.', '##...###.', '#...###.#', '#..###..#', '#.###...#', '.###...##', '.##...##.', '..#####..'],
  ally: ['.#######.', '#########', '##.###.##', '##.###.##', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  dispute: ['....#....', '...###...', '..#####..', '.#######.', '#########', '.#######.', '..#####..', '...###...', '....#....'],
  treaty: ['.#######.', '.#.....#.', '.#.###.#.', '.#.....#.', '.#.###.#.', '.#.....#.', '.#.##..#.', '.#.....#.', '.#######.'],
  oil: ['....#....', '...###...', '..#####..', '.#######.', '.#######.', '#########', '#########', '.#######.', '..#####..'],
  fire: ['....#....', '...##....', '..###.#..', '..#####..', '.######..', '.#######.', '####.###.', '.##...##.', '..#####..'],
  people: ['.##...##.', '####.####', '####.####', '.##...##.', '.........', '####.####', '#########', '#########', '#########'],
  star: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '##.....##'],
  lock: ['..#####..', '.##...##.', '.#.....#.', '.#.....#.', '#########', '####.####', '####.####', '#########', '#########'],
  up: ['....#....', '...###...', '..#####..', '.#######.', '#########', '...###...', '...###...', '...###...', '...###...'],
  info: ['..#####..', '.##...##.', '##..#..##', '#.......#', '#...#...#', '#...#...#', '##..#..##', '.##...##.', '..#####..'],
};
export const ICON_IDS = Object.keys(ICON_BITS);
export function icon(c, id, x, y, s = 1, col = K.amber) {
  const b = ICON_BITS[id];
  if (!b) return;
  c.fillStyle = col;
  for (let r = 0; r < b.length; r++) for (let q = 0; q < b[r].length; q++) if (b[r][q] === '#') c.fillRect(Math.round(x + q * s), Math.round(y + r * s), s, s);
}
// a status chip: [icon] label on a tinted pill; returns its width
export function chip(c, x, y, label, col, opts = {}) {
  const size = opts.size || 10;
  const iw = opts.icon ? 12 : 0;
  const w = Math.min(opts.max || 999, measure(c, label, size) + 10 + iw);
  const h = size + 5;
  R(c, x, y, w, h, opts.bg || 'rgba(255,255,255,0.07)');
  R(c, x, y, 2, h, col);
  if (opts.icon) icon(c, opts.icon, x + 5, y + Math.round((h - 9) / 2), 1, col);
  T(c, label, x + 6 + iw, y + 2, size, opts.text || col, 'left', w - 8 - iw);
  return w;
}
// chips in a row (wraps to a second row when `rows` > 1); returns the height used
export function chipRow(c, x, y, w, items, opts = {}) {
  let cx = x, cy = y;
  const h = (opts.size || 10) + 5;
  for (const it of items) {
    if (!it) continue;
    const size = opts.size || 10;
    const cw = Math.min(w, measure(c, it.label, size) + 10 + (it.icon ? 12 : 0));
    if (cx + cw > x + w) { if ((opts.rows || 1) <= 1 || cy + h + 3 > y + (opts.rows - 1) * (h + 3) + 1) break; cx = x; cy += h + 3; }
    chip(c, cx, cy, it.label, it.color || K.dim, { icon: it.icon, size, max: w });
    cx += cw + 4;
  }
  return cy - y + h;
}
// the stage bar of a crisis: 4 steps, the current one lit
export function stageBar(c, x, y, w, labels, idx, col = K.warn, size = 10) {
  const n = labels.length || 4;
  const sw = Math.floor((w - (n - 1) * 3) / n);
  for (let i = 0; i < n; i++) {
    const sx = x + i * (sw + 3);
    const on = i === idx, done = i < idx;
    R(c, sx, y, sw, size + 7, on ? col : done ? 'rgba(255,204,77,0.25)' : '#16283e');
    if (i < n - 1) { R(c, sx + sw, y + (size + 7) / 2 - 1, 3, 2, done || on ? col : K.edge); }
    T(c, labels[i], sx + sw / 2, y + 3, size, on ? K.ink : done ? K.text : K.faint, 'center', sw - 4);
  }
  return size + 7;
}
// ---------------------------------------------------------------- line chart
// series: [{ pts: [{ x, v, past }], color, label }]; opts: { lo, hi, xLo, xHi, size, zero, fmt, legend }
export function lineChart(c, x, y, w, h, series, opts = {}) {
  const size = opts.size || 10;
  const all = series.flatMap((s) => s.pts || []);
  R(c, x, y, w, h, '#0a1626');
  if (all.length < 1) { T(c, opts.empty || '記録がまだない', x + w / 2, y + h / 2 - 6, size, K.faint, 'center', w - 8); return; }
  let lo = opts.lo != null ? opts.lo : Math.min(...all.map((p) => p.v));
  let hi = opts.hi != null ? opts.hi : Math.max(...all.map((p) => p.v));
  if (opts.lo == null || opts.hi == null) { const pad = Math.max(1, (hi - lo) * 0.15); const st = hi - lo + 2 * pad > 40 ? 10 : 5; if (opts.lo == null) lo = Math.floor((lo - pad) / st) * st; if (opts.hi == null) hi = Math.ceil((hi + pad) / st) * st; }
  if (hi - lo < 1e-6) hi = lo + 1;
  let xLo = opts.xLo != null ? opts.xLo : Math.min(...all.map((p) => p.x));
  let xHi = opts.xHi != null ? opts.xHi : Math.max(...all.map((p) => p.x));
  if (xHi - xLo < 0.5) { xLo -= 0.25; xHi += 0.25; }
  const L = x + (opts.axisW != null ? opts.axisW : 30), B = y + h - size - 6, Tp = y + 4, Rr = x + w - 6;
  const px = (v) => L + ((v - xLo) / (xHi - xLo)) * (Rr - L);
  const py = (v) => B - ((clamp(v, lo, hi) - lo) / (hi - lo)) * (B - Tp);
  // grid + y labels
  const ticks = opts.ticks || [lo, (lo + hi) / 2, hi];
  for (const t of ticks) { const yy = Math.round(py(t)); R(c, L, yy, Rr - L, 1, 'rgba(120,160,200,0.14)'); if (opts.axisW !== 0) T(c, (opts.fmt || ((v) => `${Math.round(v)}`))(t), L - 4, yy - size / 2, size, K.faint, 'right'); }
  if (opts.zero && lo < 0 && hi > 0) R(c, L, Math.round(py(0)), Rr - L, 1, 'rgba(200,220,240,0.35)');
  // x labels: years
  const span = xHi - xLo;
  const step = span > 24 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1;
  for (let yv = Math.ceil(xLo / step) * step; yv <= xHi; yv += step) { const xx = Math.round(px(yv)); R(c, xx, B, 1, 3, K.faint); T(c, `${yv}`, xx, B + 3, size, K.faint, 'center'); }
  R(c, L, B, Rr - L, 1, K.edge);
  // the line where the game began (the past part is drawn dimmer)
  if (opts.startX != null && opts.startX > xLo && opts.startX < xHi) { const sx = Math.round(px(opts.startX)); for (let yy = Tp; yy < B; yy += 4) R(c, sx, yy, 1, 2, 'rgba(255,181,71,0.45)'); if (opts.startLabel) { const ls = Math.max(8, size - 2); const lw = measure(c, opts.startLabel, ls); if (sx + 3 + lw > Rr) T(c, opts.startLabel, sx - 3, Tp, ls, 'rgba(255,181,71,0.8)', 'right'); else T(c, opts.startLabel, sx + 3, Tp, ls, 'rgba(255,181,71,0.8)'); } }
  c.save();
  c.beginPath(); c.rect(L, Tp - 2, Rr - L + 2, B - Tp + 4); c.clip();
  for (const s of series) {
    const pts = (s.pts || []).slice().sort((a, b) => a.x - b.x);
    if (!pts.length) continue;
    c.lineWidth = opts.lineW || 2;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      c.strokeStyle = s.color;
      c.globalAlpha = a.past && b.past ? 0.45 : 1;
      c.beginPath(); c.moveTo(px(a.x), py(a.v)); c.lineTo(px(b.x), py(b.v)); c.stroke();
    }
    c.globalAlpha = 1;
    const e = pts[pts.length - 1];
    R(c, px(e.x) - 2, py(e.v) - 2, 5, 5, s.color);
  }
  c.restore();
  // legend
  if (opts.legend && series.length > 1) {
    let lx = L + 4;
    for (const s of series) { if (!s.label) continue; const lw = measure(c, s.label, size) + 16; if (lx + lw > Rr) break; R(c, lx, Tp + 3, 8, 3, s.color); T(c, s.label, lx + 11, Tp - 1, size, K.text); lx += lw; }
  }
}
// a tiny bar list: [{ label, v, color }] with the value at the right
export function barList(c, x, y, w, rows, max, opts = {}) {
  const size = opts.size || 10, rh = opts.rh || size + 6, lw = opts.labelW || 70;
  rows.forEach((r, i) => {
    const yy = y + i * rh;
    T(c, r.label, x, yy, size, K.text, 'left', lw - 4);
    bar(c, x + lw, yy + Math.round(size / 2) - 2, w - lw - 40, r.v, max, r.color || K.cyan, 5);
    T(c, r.text != null ? r.text : `${r.v}`, x + w, yy, size, r.color || K.dim, 'right');
  });
  return rows.length * rh;
}
