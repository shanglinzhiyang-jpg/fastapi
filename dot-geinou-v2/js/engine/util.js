// Shared constants and small helpers used across the engine.

// World coordinates are in "units": one tile is TILE = 16 units, as in v1, so all
// map content keeps working. The screen is SW x SH logical pixels; the world is
// drawn at UNIT logical pixels per unit, so the map viewport is VIEW_W x VIEW_H
// units. Tile and character art is 2x native (32px per tile), drawn at 16 units.
export const TILE = 16;
export const SW = 640;
export const SH = 360;
export const UNIT = 2;
export const VIEW_W = SW / UNIT; // 320
export const VIEW_H = SH / UNIT; // 180
// Legacy v1 screen space (320x240). Scenes without `hd: true` (minigames, older
// cutscenes) draw in it; the game shows it LEGACY_SCALE times larger, centred
// with LEGACY_X logical pixels of side bands.
export const W = 320;
export const H = 240;
export const LEGACY_SCALE = SH / H; // 1.5
export const LEGACY_X = (SW - W * LEGACY_SCALE) / 2; // 80
export const FPS = 60;
// Device pixels per logical pixel, set by Game.resize (code that pixelates at the
// current resolution reads it, e.g. drawLogo).
export const display = { S: 1 };

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Deterministic 0..1 hash of integer coordinates (for tile variants etc.).
export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

// shade('#808080', -0.3) darkens by 30%, +0.3 lightens toward white.
export function shade(hex, amt) {
  const [r, g, b] = parseHex(hex);
  if (amt < 0) return toHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

export function mix(a, b, t) {
  const A = parseHex(a), B = parseHex(b);
  return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

export const fmtMoney = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');

export const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
