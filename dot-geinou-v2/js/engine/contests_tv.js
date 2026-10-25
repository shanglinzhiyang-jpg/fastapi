// 賞レース — the broadcast graphics package (owner: D1). Pure drawing helpers for contest_ui.js: the TV look of the 賞レース
// screens by era — 昭和 a ブラウン管 / analogue broadcast (blue telop bands, scanlines, rounded vignette), 平成 2000s variety telop
// (red→orange bands, thick outlined yellow telop, starbursts), 令和 modern broadcast graphics (black / red / gold gradients, thin rules,
// light sweeps). Everything is original styling (no real programme logos). Static layers are cached canvases; the animated parts
// (spotlight beams, sheen, ticker, sparkles, confetti, LIVE pulse) are a handful of shapes per frame (well under 1 ms).

import { SW, SH, clamp, shade, makeCanvas } from './util.js';
import { text, measure } from './draw.js';

export const tvEra = (year) => (year < 1989 ? 'showa' : year < 2019 ? 'heisei' : 'reiwa');
export const TV = {
  showa: {
    era: 'showa', bg0: '#101a3c', bg1: '#05060e', band0: '#2a52b8', band1: '#0c1a5a', accent: '#ffe14a', accent2: '#ff5a3c', rule: '#8fb0ff',
    tab0: '#16255a', tab1: '#0a1030', tabOn0: '#ffe680', tabOn1: '#e0a820', ink: '#0c1230', row0: '#121a38', row1: '#0e1530', sel0: '#2a3c80', sel1: '#1a2658',
    live: '生放送', liveCol: '#d82020', telop: '#fff36a', telopLine: '#14206a', tickerHead: 'ニュース', tickerCol: '#2a52b8', tickerBg: '#0a0f26', beam: 'rgba(255,240,200,', crt: true,
  },
  heisei: {
    era: 'heisei', bg0: '#3a0c40', bg1: '#0c0414', band0: '#ff4a1e', band1: '#ffb21a', accent: '#fff23a', accent2: '#ff3c8c', rule: '#ffe08a',
    tab0: '#4a1450', tab1: '#200826', tabOn0: '#fff36a', tabOn1: '#ff9a1a', ink: '#2a0a10', row0: '#24102c', row1: '#1c0c24', sel0: '#6a2060', sel1: '#3a1040',
    live: '生放送', liveCol: '#ff1f4f', telop: '#fff23a', telopLine: '#c0104a', tickerHead: '速報', tickerCol: '#e8142e', tickerBg: '#14061a', beam: 'rgba(255,230,120,', crt: false,
  },
  reiwa: {
    era: 'reiwa', bg0: '#22070b', bg1: '#040405', band0: '#c8141f', band1: '#2a0306', accent: '#ffd23f', accent2: '#ff3b3b', rule: '#ffd23f',
    tab0: '#2a1013', tab1: '#0e0607', tabOn0: '#ffe27a', tabOn1: '#d6a018', ink: '#160406', row0: '#170a0c', row1: '#120809', sel0: '#4a1a10', sel1: '#2a0c08',
    live: 'LIVE', liveCol: '#ff2424', telop: '#ffffff', telopLine: '#000000', tickerHead: '速報', tickerCol: '#d0101c', tickerBg: '#0a0506', beam: 'rgba(255,236,190,', crt: false,
  },
};
export const tvStyle = (year) => TV[tvEra(year)];

// ---------------------------------------------------------------- text
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const FIT = new Map();
function fitStr(c, s, w, size) {
  s = String(s ?? '');
  if (!w) return s;
  const key = `${size}|${Math.round(w)}|${s}`;
  const hit = FIT.get(key);
  if (hit !== undefined) return hit;
  let out = s;
  if (measure(c, s, size) > w) {
    const a = Array.from(s);
    let lo = 1, hi = a.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(c, a.slice(0, mid).join('') + '…', size) <= w) lo = mid; else hi = mid - 1; }
    out = a.slice(0, lo).join('') + '…';
  }
  FIT.set(key, out);
  if (FIT.size > 400) FIT.delete(FIT.keys().next().value);
  return out;
}
// outlined telop text (fit to w); returns the drawn width
export function telop(c, s, x, y, size, col, line, align = 'left', w = 0) {
  const str = fitStr(c, s, w, size);
  text(c, str, Math.round(x), Math.round(y), { size, color: col, align, outline: line });
  return measure(c, str, size);
}

// ---------------------------------------------------------------- cached static layers
const cache = new Map();
function cached(key, w, h, paint) {
  let cv = cache.get(key);
  if (cv) return cv;
  if (typeof document === 'undefined') return null;
  const [canvas, x] = makeCanvas(w, h);
  paint(x, w, h);
  cache.set(key, canvas);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return canvas;
}
// the studio backdrop of the whole screen
export function backdrop(c, st, x = 0, y = 0, w = SW, h = SH) {
  const cv = cached(`bg|${st.era}|${w}|${h}`, w, h, (k, W, H) => {
    const gr = k.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, st.bg0); gr.addColorStop(1, st.bg1);
    k.fillStyle = gr; k.fillRect(0, 0, W, H);
    const rg = k.createRadialGradient(W / 2, H * 0.15, 10, W / 2, H * 0.15, W * 0.7);
    rg.addColorStop(0, 'rgba(255,255,255,0.10)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    k.fillStyle = rg; k.fillRect(0, 0, W, H);
    if (st.era === 'reiwa') { k.fillStyle = 'rgba(255,210,63,0.035)'; for (let i = -H; i < W; i += 14) { k.beginPath(); k.moveTo(i, H); k.lineTo(i + H, 0); k.lineTo(i + H + 2, 0); k.lineTo(i + 2, H); k.fill(); } }
    else if (st.era === 'heisei') {
      // a starburst behind everything (variety-show look)
      k.save(); k.translate(W / 2, H * 0.55);
      for (let i = 0; i < 24; i++) { k.rotate((Math.PI * 2) / 24); k.fillStyle = i % 2 ? 'rgba(255,200,60,0.05)' : 'rgba(255,80,150,0.04)'; k.beginPath(); k.moveTo(0, 0); k.lineTo(W, -36); k.lineTo(W, 36); k.fill(); }
      k.restore();
    } else { k.fillStyle = 'rgba(140,170,255,0.05)'; for (let yy = 0; yy < H; yy += 24) k.fillRect(0, yy, W, 1); }
  });
  if (cv) c.drawImage(cv, x, y);
  else R(c, x, y, w, h, st.bg1);
}
// 昭和: scanlines + the rounded, darkened corners of a ブラウン管
export function crt(c, st, t = 0) {
  if (!st.crt) return;
  const cv = cached('crt', SW, SH, (k, W, H) => {
    k.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < H; y += 2) k.fillRect(0, y, W, 1);
    const rg = k.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.55)');
    k.fillStyle = rg; k.fillRect(0, 0, W, H);
    // rounded tube corners
    k.fillStyle = '#000000';
    const r = 18;
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      k.beginPath(); k.moveTo(cx, cy); k.lineTo(cx + sx * r, cy); k.quadraticCurveTo(cx, cy, cx, cy + sy * r); k.closePath(); k.fill();
    }
  });
  if (cv) c.drawImage(cv, 0, 0);
  // the slow roll bar of an analogue picture
  const y = ((t * 0.7) % (SH + 40)) - 40;
  R(c, 0, y, SW, 22, 'rgba(255,255,255,0.025)');
}

// ---------------------------------------------------------------- bands, sheen, beams
export function band(c, x, y, w, h, c0, c1, opts = {}) {
  const gr = c.createLinearGradient(x, y, opts.vertical ? x : x + w, opts.vertical ? y + h : y);
  gr.addColorStop(0, c0); gr.addColorStop(1, c1);
  c.fillStyle = gr;
  if (opts.slant) { c.beginPath(); c.moveTo(x + opts.slant, y); c.lineTo(x + w, y); c.lineTo(x + w - opts.slant, y + h); c.lineTo(x, y + h); c.closePath(); c.fill(); }
  else c.fillRect(x, y, w, h);
  if (opts.gloss !== false) R(c, x + (opts.slant || 0) / 2, y + 1, w - (opts.slant || 0), Math.max(1, Math.floor(h * 0.42)), 'rgba(255,255,255,0.16)');
}
// a light sweeping across a rect every `period` frames
export function sheen(c, t, x, y, w, h, period = 180, slant = 0) {
  const p = (t % period) / period;
  if (p > 0.45) return;
  const sx = x - 60 + (w + 120) * (p / 0.45);
  c.save();
  c.beginPath();
  if (slant) { c.moveTo(x + slant, y); c.lineTo(x + w, y); c.lineTo(x + w - slant, y + h); c.lineTo(x, y + h); c.closePath(); } else c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = 'rgba(255,255,255,0.28)';
  c.beginPath(); c.moveTo(sx, y + h); c.lineTo(sx + 18, y); c.lineTo(sx + 40, y); c.lineTo(sx + 22, y + h); c.closePath(); c.fill();
  c.restore();
}
// two spotlights sweeping from the top corners of a rect (+ a slow central glow)
export function beams(c, t, st, x, y, w, h, strength = 1) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const len = h * 1.25;
  for (const [ox, ph, dir] of [[x + w * 0.12, 0, 1], [x + w * 0.88, 2.1, -1]]) {
    const a = dir * (0.32 + 0.28 * Math.sin(t * 0.017 + ph));
    const tx = ox + Math.sin(a) * len, ty = y + Math.cos(a) * len;
    const nx = Math.cos(a) * 46, ny = -Math.sin(a) * 46;
    c.fillStyle = `${st.beam}${(0.06 * strength).toFixed(3)})`;
    c.beginPath(); c.moveTo(ox - 3, y); c.lineTo(tx - nx, ty - ny); c.lineTo(tx + nx, ty + ny); c.lineTo(ox + 3, y); c.closePath(); c.fill();
    c.fillStyle = `${st.beam}${(0.05 * strength).toFixed(3)})`;
    c.beginPath(); c.moveTo(ox - 1, y); c.lineTo(tx - nx * 0.4, ty - ny * 0.4); c.lineTo(tx + nx * 0.4, ty + ny * 0.4); c.lineTo(ox + 1, y); c.closePath(); c.fill();
  }
  c.restore();
}

// ---------------------------------------------------------------- badges and chips
// LIVE / 生放送 badge with a pulsing dot; right edge at x when align 'right'. Returns its width.
export function liveBadge(c, x, y, st, t, word = st.live, align = 'left', h = 16) {
  const size = h >= 16 ? 10 : 9;
  const w = Math.ceil(measure(c, word, size)) + 22;
  const x0 = align === 'right' ? x - w : x;
  R(c, x0, y, w, h, st.liveCol);
  R(c, x0, y, w, 1, 'rgba(255,255,255,0.45)');
  const on = Math.floor(t / 20) % 2 === 0;
  c.fillStyle = on ? '#ffffff' : 'rgba(255,255,255,0.35)';
  c.beginPath(); c.arc(x0 + 8, y + h / 2, 3, 0, Math.PI * 2); c.fill();
  text(c, word, x0 + 15, y + Math.round((h - size) / 2) - 1, { size, color: '#ffffff', shadow: null });
  return w;
}
// 「M-1決勝まで あと 12 日」: a countdown plate, right-aligned at x. Returns its width.
export function countdown(c, x, y, st, label, days, t, h = 18) {
  const lw = Math.ceil(measure(c, label, 10));
  const ds = String(days);
  const dw = Math.ceil(measure(c, ds, 14)) + 10;
  const aw = Math.ceil(measure(c, 'あと', 10));
  const w = lw + aw + dw + 34;
  const x0 = x - w;
  band(c, x0, y, w, h, shade(st.band1, -0.3), st.tab1, { gloss: false });
  R(c, x0, y, w, 1, st.rule);
  text(c, label, x0 + 6, y + 4, { size: 10, color: '#ffffff', shadow: null });
  text(c, 'あと', x0 + 10 + lw, y + 4, { size: 10, color: st.accent, shadow: null });
  // the number plate (a flip-clock look)
  const nx = x0 + lw + aw + 14;
  R(c, nx, y + 1, dw, h - 2, '#000000'); R(c, nx, y + Math.floor(h / 2), dw, 1, 'rgba(255,255,255,0.18)');
  text(c, ds, nx + dw / 2, y + 2, { size: 14, color: st.accent, align: 'center', shadow: null });
  text(c, '日', nx + dw + 2, y + 4, { size: 10, color: st.accent, shadow: null });
  return w + 12;
}

// ---------------------------------------------------------------- sparkles / confetti
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export function sparkles(c, t, x, y, w, h, n = 8, seed = 1, col = '#fff6c0') {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.05 + hash(seed * 31 + i) * 6.28);
    const s = Math.max(0, Math.sin(ph)) * 3.2;
    if (s < 0.6) continue;
    const px = Math.round(x + hash(seed * 17 + i * 7) * w), py = Math.round(y + hash(seed * 13 + i * 11) * h);
    c.fillRect(px - Math.round(s), py, Math.round(s) * 2 + 1, 1);
    c.fillRect(px, py - Math.round(s), 1, Math.round(s) * 2 + 1);
  }
}
const CONF = ['#ffd23f', '#ff4a6a', '#5fd7ff', '#7fe08a', '#ffffff', '#ff9a3c', '#c49cff'];
export function confetti(c, t, x, y, w, h, n = 40, seed = 7) {
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hash(seed + i * 3) * 0.9;
    const py = y + ((hash(seed + i * 5) * h + t * sp) % h);
    const px = x + hash(seed + i * 9) * w + Math.sin(t * 0.05 + i) * 6;
    const flip = Math.abs(Math.sin(t * 0.08 + i)) * 4 + 1;
    R(c, px, py, flip, 3, CONF[i % CONF.length]);
  }
}

// ---------------------------------------------------------------- ticker
// The 速報 ticker: a head block + scrolling text, clipped to the bar. Returns nothing.
export function ticker(c, t, st, x, y, w, h, str, head = st.tickerHead) {
  R(c, x, y, w, h, st.tickerBg);
  R(c, x, y, w, 1, st.rule);
  const hw = Math.ceil(measure(c, head, 12)) + 18;
  band(c, x, y + 1, hw, h - 1, shade(st.tickerCol, 0.15), shade(st.tickerCol, -0.25), { vertical: true });
  // the head pulses (never blinks out, so it always reads)
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.12);
  R(c, x, y + 1, hw, 2, `rgba(255,255,255,${(0.25 + 0.5 * pulse).toFixed(2)})`);
  text(c, head, x + hw / 2, y + Math.round((h - 12) / 2), { size: 12, color: '#ffffff', align: 'center', shadow: null });
  const tw = measure(c, str, 10) + 90;
  const off = (t * 0.7) % Math.max(1, tw);
  c.save(); c.beginPath(); c.rect(x + hw + 2, y + 1, w - hw - 2, h - 1); c.clip();
  const ty = y + Math.round((h - 10) / 2);
  text(c, str, x + hw + 10 - off, ty, { size: 10, color: '#ffffff', shadow: null });
  text(c, str, x + hw + 10 - off + tw, ty, { size: 10, color: '#ffffff', shadow: null });
  c.restore();
}

// ---------------------------------------------------------------- the 賞レース logo (original type treatment)
// A slanted, outlined 「賞レース」 with a gold underline; era colours. Returns its width.
export function logo(c, x, y, st, t, size = 18) {
  const s = '賞レース';
  c.save();
  c.translate(x, y);
  c.transform(1, 0, -0.18, 1, 0, 0);
  const w = measure(c, s, size);
  if (st.era === 'reiwa') { text(c, s, 1, 1, { size, color: '#000000', shadow: null }); text(c, s, 0, 0, { size, color: '#ffffff', shadow: null }); }
  else text(c, s, 0, 0, { size, color: st.telop, outline: st.telopLine });
  R(c, 0, size + 1, w, 2, st.accent);
  c.restore();
  sparkles(c, t, x, y - 2, w + 6, size + 4, 3, 5);
  return w + 6;
}

// ---------------------------------------------------------------- ranking bars (TV board)
// one bar row sliding in (k = 0..1): place badge, name, value; the bar length is `frac` of w
export function rankBar(c, x, y, w, h, st, o) {
  const k = clamp(o.k ?? 1, 0, 1);
  if (k <= 0) return;
  const off = Math.round((1 - k) * (w * 0.6));
  c.save();
  c.globalAlpha = k;
  const x0 = x - off;
  const top = o.place === 1;
  band(c, x0, y, w, h, o.me ? shade(st.accent, -0.15) : top ? shade(st.band0, 0.1) : st.tab0, o.me ? shade(st.accent, -0.55) : top ? st.band1 : st.tab1, { slant: 8 });
  const bw = Math.round((w - 140) * clamp(o.frac ?? 0, 0, 1) * k);
  if (bw > 0) R(c, x0 + 96, y + h - 5, bw, 3, o.me ? '#ffffff' : top ? st.accent : st.rule);
  const pc = o.me ? st.ink : top ? st.accent : '#ffffff';
  text(c, String(o.badge ?? ''), x0 + 34, y + Math.round((h - 14) / 2) - 1, { size: 14, color: pc, align: 'center', shadow: null });
  const tc = o.me ? st.ink : '#ffffff';
  text(c, fitStr(c, o.name, w - 210, 12), x0 + 64, y + Math.round((h - 12) / 2) - 1, { size: 12, color: tc, shadow: null });
  if (o.value) text(c, fitStr(c, o.value, 130, 12), x0 + w - 14, y + Math.round((h - 12) / 2) - 1, { size: 12, color: o.me ? st.ink : top ? st.accent : '#ffffff', align: 'right', shadow: null });
  c.restore();
}
export const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
