// Tile registry and the built-in pixel-art tile set (all procedurally drawn).
//
// defineTile(id, {
//   solid: bool,          // blocks movement
//   obj: bool,            // transparent background, drawn on top of a floor tile
//   talkThrough: bool,    // you can talk to someone standing behind it (counters)
//   frames: n, speed: n,  // animation (speed = game frames per animation frame)
//   variants: n,          // random visual variants picked per map cell
//   draw(c, r, frame, variant)  // c = 16x16 canvas 2D ctx, r = seeded rng()
//   hd(c, r, frame, variant)    // optional: native 2x art, c = 32x32 canvas
// })                            // (without it the 16px art is Scale2x'd)
//
// Map cells can stack tiles with "+", e.g. "floor_wood+desk" or "wall_white+poster".
//
// HD art conventions (every built-in tile has an hd painter): 32x32 canvas,
// light from the top-left, 2-3 tones per material, 1px dark outlines on
// objects (outline(), tinted toward OUTLINE), dithering only for texture.
// Ground / floor / wall tiles tile seamlessly (use Rw / Pw to wrap).

import { TILE, mulberry32, shade } from './util.js';
import { scale2x } from './hdify.js';

export const TILES = {};
const cache = new Map();
const HD = TILE * 2;

export function defineTile(id, def) {
  TILES[id] = { solid: false, obj: false, frames: 1, speed: 20, variants: 1, ...def, id };
  for (const k of cache.keys()) if (k.startsWith(id + '|')) cache.delete(k);
}

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Tile canvases are tiny (16/32px), so Chrome keeps them in CPU memory anyway;
// willReadFrequently keeps outline() / scale2x readbacks cheap.
function tileCanvas(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = false;
  return [cv, c];
}

// 16x16 (1x) image of a tile. Content code may draw it directly in world units.
export function tileImage(id, frame = 0, variant = 0) {
  const key = id + '|' + frame + '|' + variant;
  let img = cache.get(key);
  if (img) return img;
  const def = TILES[id] || TILES.missing;
  const [cv, c] = tileCanvas(TILE);
  def.draw(c, mulberry32(strHash(id) + variant * 7919), frame, variant);
  cache.set(key, cv);
  return cv;
}

// 32x32 (2x) image of a tile, drawn by the map at TILE x TILE units.
// A tile with an `hd(c, r, frame, variant)` function is drawn natively on a
// 32x32 canvas (coordinates 0..31); otherwise its 16px art is Scale2x'd.
export function tileImageHD(id, frame = 0, variant = 0) {
  const key = id + '|' + frame + '|' + variant + '|hd';
  let img = cache.get(key);
  if (img) return img;
  const def = TILES[id] || TILES.missing;
  if (def.hd) {
    const [cv, c] = tileCanvas(HD);
    def.hd(c, mulberry32(strHash(id) + variant * 7919), frame, variant);
    img = cv;
  } else img = scale2x(tileImage(id, frame, variant));
  cache.set(key, img);
  return img;
}

// ---------------------------------------------------------------- helpers
// All helpers work on any canvas size (16px 1x art, 32px HD art, prop caches).
export const OUTLINE = '#22202a';
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
export const P = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
// Default speckle area: the whole tile (16x16, or 32x32 on an HD tile canvas).
const area = (c) => (c.canvas && c.canvas.width === HD && c.canvas.height === HD ? HD : TILE);
export function speckle(c, r, cols, n, x0 = 0, y0 = 0, w = area(c), h = area(c)) {
  for (let i = 0; i < n; i++) P(c, x0 + Math.floor(r() * w), y0 + Math.floor(r() * h), cols[Math.floor(r() * cols.length)]);
}
// Wrapping pixel / rect: what leaves one edge comes back on the opposite one,
// so textures drawn with them tile without seams.
export function Pw(c, x, y, col) {
  const W = c.canvas.width, H = c.canvas.height;
  P(c, ((x % W) + W) % W, ((y % H) + H) % H, col);
}
export function Rw(c, x, y, w, h, col) {
  const W = c.canvas.width, H = c.canvas.height;
  x = ((x % W) + W) % W; y = ((y % H) + H) % H;
  c.fillStyle = col;
  for (const ox of x + w > W ? [0, -W] : [0]) for (const oy of y + h > H ? [0, -H] : [0]) c.fillRect(x + ox, y + oy, w, h);
}
// Draw a pixel template: rows of chars, pal maps char -> color ('.' / missing = skip).
export function pix(c, rows, pal, ox = 0, oy = 0) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (col) P(c, ox + x, oy + y, col);
    }
  });
}
export function disc(c, cx, cy, rad, col) {
  for (let y = -rad; y <= rad; y++) {
    for (let x = -rad; x <= rad; x++) {
      if (x * x + y * y <= rad * rad + rad * 0.6) P(c, cx + x, cy + y, col);
    }
  }
}
export function shadowEllipse(c, cx, cy, rx, ry) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    c.fillRect(cx - w, cy + y, w * 2, 1);
  }
}
// Filled ellipse inside the box x..x+w-1, y..y+h-1 (any size, even or odd).
export function oval(c, x, y, w, h, col) {
  c.fillStyle = col;
  for (let j = 0; j < h; j++) {
    const dy = (j + 0.5 - h / 2) / (h / 2);
    const half = (w / 2) * Math.sqrt(Math.max(0, 1 - dy * dy));
    const a = Math.round(x + w / 2 - half), b = Math.round(x + w / 2 + half);
    if (b > a) c.fillRect(a, y + j, b - a, 1);
  }
}
// Ring between radii r0..r1 around (cx, cy) (pixel-centre test).
export function ring(c, cx, cy, r0, r1, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) {
    for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= r0 && d <= r1) c.fillRect(x, y, 1, 1);
    }
  }
}
// 1px Bresenham line.
export function line(c, x0, y0, x1, y1, col) {
  c.fillStyle = col;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// Box lit from the top-left: highlight on the top row / left column, shade on
// the bottom row / right column.
export function bevel(c, x, y, w, h, col, hi = shade(col, 0.25), lo = shade(col, -0.22)) {
  R(c, x, y, w, h, col);
  R(c, x, y, w, 1, hi); R(c, x, y, 1, h, hi);
  R(c, x, y + h - 1, w, 1, lo); R(c, x + w - 1, y + 1, 1, h - 1, lo);
}
// Recessed panel (shadow top-left, light bottom-right).
export function inset(c, x, y, w, h, col, hi = shade(col, 0.18), lo = shade(col, -0.2)) {
  R(c, x, y, w, h, col);
  R(c, x, y, w, 1, lo); R(c, x, y, 1, h, lo);
  R(c, x + 1, y + h - 1, w - 1, 1, hi); R(c, x + w - 1, y + 1, 1, h - 1, hi);
}
// Checkerboard dither of col over a rect (phase 0/1).
export function dither(c, x, y, w, h, col, phase = 0) {
  c.fillStyle = col;
  for (let j = 0; j < h; j++) for (let i = (j + phase) & 1; i < w; i += 2) c.fillRect(x + i, y + j, 1, 1);
}
// Short horizontal grain / scratch dashes inside a rect.
export function grain(c, r, x, y, w, h, col, n, len = 4) {
  for (let i = 0; i < n; i++) {
    const l = 2 + Math.floor(r() * len);
    R(c, x + Math.floor(r() * Math.max(1, w - l)), y + Math.floor(r() * h), l, 1, col);
  }
}

const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const OUT_RGB = hex(OUTLINE);
// Outline pass: every transparent pixel touching an opaque one (4-neighbours)
// becomes an outline pixel. The colour is OUTLINE tinted toward the pixel it
// outlines (tint 0 = pure OUTLINE), or `col` when given. Semi-transparent
// pixels (drop shadows) count as empty, so outlines sit on top of them.
export function outline(c, { col = null, tint = 0.22, alpha = 160 } = {}) {
  const W = c.canvas.width, H = c.canvas.height;
  const img = c.getImageData(0, 0, W, H), d = img.data, src = d.slice();
  const fixed = col ? hex(col) : null;
  const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] >= alpha;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] >= alpha) continue;
      let n = -1;
      if (solid(x, y - 1)) n = i - W * 4;
      else if (solid(x - 1, y)) n = i - 4;
      else if (solid(x + 1, y)) n = i + 4;
      else if (solid(x, y + 1)) n = i + W * 4;
      if (n < 0) continue;
      for (let k = 0; k < 3; k++) d[i + k] = fixed ? fixed[k] : Math.round(OUT_RGB[k] * (1 - tint) + src[n + k] * tint);
      d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
}
// Clumps of round shapes (foliage, cushions, hair...): lumps are [cx, cy, radius]
// listed back to front; each pixel is shaded by the normal of the front-most
// lump that covers it (light from the top-left), quantised into pal (dark ->
// light) with a 1px checker dither at the tone borders.
export function blobs(c, lumps, pal, { bias = 0, dither: dz = 0.06 } = {}) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, rr] of lumps) {
    x0 = Math.min(x0, Math.floor(cx - rr)); y0 = Math.min(y0, Math.floor(cy - rr));
    x1 = Math.max(x1, Math.ceil(cx + rr)); y1 = Math.max(y1, Math.ceil(cy + rr));
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hit = false, nx = 0, ny = 0;
      for (const [cx, cy, rr] of lumps) {
        const dx = (x + 0.5 - cx) / rr, dy = (y + 0.5 - cy) / rr;
        if (dx * dx + dy * dy <= 1) { hit = true; nx = dx; ny = dy; }
      }
      if (!hit) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = -0.5 * nx - 0.62 * ny + 0.6 * nz;
      const t = (l + 0.35) / 1.3 + bias + ((x + y) & 1 ? dz : -dz);
      P(c, x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(t * pal.length)))]);
    }
  }
}
// Tone ramp around a base colour: [darkest, dark, base, light, lightest].
export const ramp = (col, k = 1) => [shade(col, -0.42 * k), shade(col, -0.22 * k), col, shade(col, 0.2 * k), shade(col, 0.42 * k)];

// ---------------------------------------------------------------- fallback
defineTile('missing', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#ff00ff'); R(c, 0, 0, 8, 8, '#000'); R(c, 8, 8, 8, 8, '#000'); },
  hd(c) { R(c, 0, 0, 32, 32, '#ff00ff'); R(c, 0, 0, 16, 16, '#000'); R(c, 16, 16, 16, 16, '#000'); },
});
defineTile('void', { solid: true, draw(c) { R(c, 0, 0, 16, 16, '#000'); }, hd(c) { R(c, 0, 0, 32, 32, '#000'); } });
defineTile('black', { solid: true, draw(c) { R(c, 0, 0, 16, 16, '#0d0d12'); }, hd(c) { R(c, 0, 0, 32, 32, '#0d0d12'); } });

// ---------------------------------------------------------------- outdoor ground
const RND = (r, n) => Math.floor(r() * n);
// Grass texture: dither specks, dark "v" tufts and sunlit blades, all wrapping.
function grassHD(c, r, tufts = 16) {
  R(c, 0, 0, 32, 32, '#62b35b');
  for (let i = 0; i < 46; i++) Pw(c, RND(r, 32), RND(r, 32), i % 3 ? '#5aa954' : '#6bbb62');
  for (let i = 0; i < tufts; i++) {
    const x = RND(r, 32), y = RND(r, 32);
    Pw(c, x, y, '#4f9a4a'); Pw(c, x - 1, y - 1, '#4f9a4a'); Pw(c, x + 1, y - 1, '#55a34f'); Pw(c, x - 1, y - 2, '#5aa954');
  }
  for (let i = 0; i < tufts / 2; i++) {
    const x = RND(r, 32), y = RND(r, 32);
    Pw(c, x, y, '#79c76c'); Pw(c, x, y + 1, '#6bbb62'); Pw(c, x + 1, y - 1, i & 1 ? '#86d277' : '#79c76c');
  }
}
// 6x6 four-petal bloom: the v1 3x3 "plus" at 2x, lit from the top-left, with a
// yellow centre and a little ground shadow (centre at x-1..x, y-1..y).
const FLOWER = ['..LP..', '..PP..', 'LPhcPp', 'PPcdps', '..Pp..', '.gps..'];
function flowerHD(c, x, y, col) {
  pix(c, FLOWER, { L: shade(col, 0.45), P: col, p: shade(col, -0.14), s: shade(col, -0.28), h: '#fff6b8', c: '#ffe36e', d: '#e0b030', g: '#4f9a4a' }, x - 3, y - 3);
  P(c, x + 2, y + 2, '#4f9a4a');
}
defineTile('grass', {
  variants: 8,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#62b35b');
    speckle(c, r, ['#55a34f', '#4f9a4a'], 14);
    speckle(c, r, ['#79c76c', '#86d277'], 6);
    if (v === 3) { P(c, 5, 6, '#fff'); P(c, 4, 6, '#ffe36e'); P(c, 11, 11, '#fff'); }
    if (v === 4) { P(c, 4, 9, '#3f8a3a'); P(c, 5, 8, '#3f8a3a'); P(c, 5, 9, '#4f9a4a'); P(c, 11, 4, '#3f8a3a'); P(c, 12, 3, '#3f8a3a'); }
    if (v === 5) { P(c, 7, 7, '#a89a7a'); P(c, 8, 7, '#c8bc9c'); P(c, 8, 8, '#8a7e62'); }
    if (v === 6) { P(c, 3, 3, '#3f8a3a'); P(c, 4, 3, '#4f9a4a'); P(c, 3, 4, '#4f9a4a'); P(c, 10, 10, '#3f8a3a'); P(c, 11, 10, '#4f9a4a'); P(c, 10, 11, '#4f9a4a'); }
    if (v === 7) { R(c, 2, 9, 5, 4, '#7fb866'); P(c, 3, 9, '#9ad07c'); R(c, 9, 3, 4, 3, '#7fb866'); }
  },
  hd(c, r, f, v) {
    grassHD(c, r, 16);
    if (v === 4) for (const [x, y] of [[6, 20], [20, 8], [25, 24]]) { R(c, x, y, 1, 4, '#3f8a3a'); R(c, x + 1, y - 1, 1, 5, '#4f9a4a'); R(c, x + 2, y + 1, 1, 3, '#3f8a3a'); P(c, x + 1, y - 1, '#79c76c'); }
    if (v === 5) for (const [x, y] of [[9, 9], [22, 20], [14, 25]]) { Pw(c, x, y, '#c8bc9c'); Pw(c, x + 1, y, '#a89a7a'); Pw(c, x, y + 1, '#a89a7a'); Pw(c, x + 1, y + 1, '#8a7e62'); }
    if (v === 6) for (const [x, y] of [[8, 8], [21, 14], [11, 23]]) { for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]) Pw(c, x + dx, y + dy, (dx + dy) % 2 ? '#4f9a4a' : '#3f8a3a'); }
    if (v === 7) { R(c, 4, 18, 11, 8, '#7fb866'); R(c, 4, 18, 11, 1, '#9ad07c'); R(c, 18, 6, 9, 6, '#7fb866'); R(c, 18, 6, 9, 1, '#9ad07c'); }
    if (v === 3) {
      for (const [x, y] of [[10, 12], [22, 22]]) {
        P(c, x, y - 1, '#ffffff'); P(c, x - 1, y, '#ffffff'); P(c, x + 1, y, '#e8ecf2'); P(c, x, y + 1, '#e8ecf2'); P(c, x, y, '#ffe36e');
        P(c, x - 1, y + 2, '#4f9a4a');
      }
    }
  },
});
defineTile('flowers', {
  variants: 6,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#62b35b');
    speckle(c, r, ['#55a34f', '#4f9a4a'], 10);
    const FC = [['#ffd23f', '#ff8fb1'], ['#ff6f91', '#fff'], ['#b48aff', '#e6d4ff'], ['#6fb4ff', '#ffffff'], ['#ff5a4a', '#ffd23f'], ['#ffffff', '#ffd2e6']];
    const cols = FC[v % 6];
    for (const [x, y, i] of [[3, 3, 0], [11, 5, 1], [6, 10, 1], [12, 12, 0], [2, 13, 1]]) {
      const pc = cols[i];
      P(c, x, y - 1, pc); P(c, x - 1, y, pc); P(c, x + 1, y, pc); P(c, x, y + 1, pc); P(c, x, y, '#ffe36e');
    }
  },
  hd(c, r, f, v) {
    grassHD(c, r, 10);
    const cols = [['#ffd23f', '#ff8fb1'], ['#ff6f91', '#ffffff'], ['#b48aff', '#e6d4ff'], ['#6fb4ff', '#ffffff'], ['#ff5a4a', '#ffd23f'], ['#ffffff', '#ffd2e6']][v % 6];
    for (const [x, y, i] of [[7, 7, 0], [23, 11, 1], [13, 21, 1], [25, 25, 0], [5, 27, 1]]) flowerHD(c, x, y, cols[i]);
  },
});
// Dirt / sand: speckles plus small pebbles (light top-left, dark bottom-right).
function dirtHD(c, r, base, cols, peb, n = 70, pebbles = 9) {
  R(c, 0, 0, 32, 32, base);
  for (let i = 0; i < n; i++) Pw(c, RND(r, 32), RND(r, 32), cols[RND(r, cols.length)]);
  for (let i = 0; i < pebbles; i++) {
    const x = RND(r, 32), y = RND(r, 32);
    Pw(c, x, y, peb[0]); Pw(c, x + 1, y, peb[1]); Pw(c, x, y + 1, peb[1]); Pw(c, x + 1, y + 1, peb[2]); Pw(c, x + 2, y + 1, peb[3]);
  }
}
defineTile('path', {
  variants: 2,
  draw(c, r) { R(c, 0, 0, 16, 16, '#d9b77a'); speckle(c, r, ['#c9a66a', '#e6c88f', '#bf9b5f'], 18); },
  hd(c, r) { dirtHD(c, r, '#d9b77a', ['#cfac6f', '#e3c389', '#c9a66a', '#d4b276'], ['#f0d9a6', '#e6c88f', '#bf9b5f', '#cba972']); },
});
defineTile('sand', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#ecd9a0'); speckle(c, r, ['#e0c98a', '#f5e6b8'], 16); },
  hd(c, r) { dirtHD(c, r, '#ecd9a0', ['#e0c98a', '#f5e6b8', '#e6d194'], ['#fff3d0', '#f5e6b8', '#d6bd7e', '#e0c98a'], 80, 4); },
});
defineTile('sidewalk', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#cfd0d6');
    R(c, 0, 7, 16, 1, '#b5b6be'); R(c, 0, 15, 16, 1, '#b5b6be');
    R(c, 7, 0, 1, 7, '#b5b6be'); R(c, 15, 8, 1, 7, '#b5b6be');
    R(c, 0, 0, 16, 1, '#dcdde2');
    speckle(c, r, ['#c3c4ca'], 6);
  },
  // running-bond paving slabs 32x16 (two rows per tile, joints offset by half)
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#cfd0d6');
    speckle(c, r, ['#c6c7cd', '#d6d7dc'], 40);
    for (const [y0, jx] of [[0, 15], [16, 31]]) {
      R(c, 0, y0, 32, 1, '#dfe0e5');
      R(c, 0, y0 + 14, 32, 1, '#c4c5cb');
      Rw(c, jx + 1, y0, 1, 15, '#dadbe0');
      R(c, jx - 1, y0 + 1, 1, 14, '#c4c5cb');
      R(c, 0, y0 + 15, 32, 1, '#aeafb7');
      R(c, jx, y0, 1, 15, '#aeafb7');
    }
  },
});
defineTile('tactile', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#e8c43a');
    for (let y = 2; y < 16; y += 4) for (let x = 2; x < 16; x += 4) { R(c, x, y, 2, 2, '#f6dc6a'); P(c, x + 1, y + 1, '#c9a52a'); }
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#e8c43a');
    R(c, 0, 31, 32, 1, '#c9a52a'); R(c, 31, 0, 1, 31, '#c9a52a'); R(c, 0, 0, 31, 1, '#f0d258'); R(c, 0, 0, 1, 31, '#f0d258');
    for (let y = 3; y < 32; y += 8) for (let x = 3; x < 32; x += 8) pix(c, ['.ll.', 'lLmd', 'lmmd', '.dd.'], { l: '#f6dc6a', L: '#fff3b0', m: '#efd04e', d: '#c9a52a' }, x, y);
  },
});
defineTile('brick', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#8e4a37');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let x = -4; x < 16; x += 8) {
        R(c, x + off + 1, row * 4 + 1, 7, 3, '#b8644a');
        R(c, x + off + 1, row * 4 + 1, 7, 1, '#c97a5e');
      }
    }
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#8e4a37');
    for (let row = 0; row < 4; row++) {
      const y = row * 8, off = row % 2 ? 8 : 0;
      for (let x = off; x < off + 32; x += 16) {
        const col = ['#b8644a', '#b25f46', '#bd6a4f', '#ad5b43'][RND(r, 4)];
        Rw(c, x + 1, y + 1, 15, 7, col);
        Rw(c, x + 1, y + 1, 15, 1, '#c97a5e');
        Rw(c, x + 1, y + 2, 1, 5, shade(col, 0.08));
        Rw(c, x + 1, y + 6, 15, 1, shade(col, -0.12));
        Pw(c, x + 3 + RND(r, 10), y + 3 + RND(r, 3), shade(col, -0.08));
      }
    }
  },
});
defineTile('stone', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#a9adb7');
    R(c, 0, 0, 16, 1, '#8e929c'); R(c, 0, 8, 16, 1, '#8e929c'); R(c, 0, 0, 1, 16, '#8e929c'); R(c, 8, 0, 1, 16, '#8e929c');
    R(c, 1, 1, 7, 1, '#bcc0c9'); R(c, 9, 9, 7, 1, '#bcc0c9');
    speckle(c, r, ['#9a9ea8'], 6);
  },
  // 16x16 granite setts with a light top-left lip and a darker bottom-right
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#8e929c');
    for (const sy of [0, 16]) {
      for (const sx of [0, 16]) {
        const col = ['#a9adb7', '#a5a9b3', '#adb1bb'][RND(r, 3)];
        R(c, sx + 1, sy + 1, 15, 15, col);
        R(c, sx + 1, sy + 1, 15, 1, '#bfc3cc'); R(c, sx + 1, sy + 2, 1, 14, '#b7bbc4');
        R(c, sx + 2, sy + 15, 14, 1, '#999da7'); R(c, sx + 15, sy + 2, 1, 13, '#999da7');
        speckle(c, r, ['#9ea2ac', '#b3b7c0', '#a1a5af'], 9, sx + 2, sy + 2, 13, 13);
      }
    }
  },
});
function road(c, r) { R(c, 0, 0, 16, 16, '#4d5058'); speckle(c, r, ['#585b64', '#44474e'], 14); }
// Asphalt: fine speckle plus a few lit aggregate stones; wraps seamlessly.
function roadHD(c, r) {
  R(c, 0, 0, 32, 32, '#4d5058');
  speckle(c, r, ['#545760', '#464951', '#585b64', '#44474e'], 90);
  for (let i = 0; i < 7; i++) { const x = RND(r, 32), y = RND(r, 32); Pw(c, x, y, '#62656e'); Pw(c, x + 1, y + 1, '#3f4148'); }
}
// Road paint, slightly worn: base stripe, darker lower edge, a few road specks.
function paint(c, r, x, y, w, h, vertical = false) {
  R(c, x, y, w, h, '#e8e6d8');
  if (vertical) R(c, x + w - 1, y, 1, h, '#cfcdc0'); else R(c, x, y + h - 1, w, 1, '#cfcdc0');
  for (let i = 0; i < Math.max(2, (w * h) / 30); i++) P(c, x + RND(r, w), y + RND(r, h), i & 1 ? '#d8d6c8' : '#b9b8ae');
}
defineTile('road', { draw: road, hd: roadHD });
defineTile('road_line_h', { draw(c, r) { road(c, r); R(c, 2, 7, 10, 2, '#e8e6d8'); }, hd(c, r) { roadHD(c, r); paint(c, r, 4, 14, 20, 4); } });
defineTile('road_line_v', { draw(c, r) { road(c, r); R(c, 7, 2, 2, 10, '#e8e6d8'); }, hd(c, r) { roadHD(c, r); paint(c, r, 14, 4, 4, 20, true); } });
defineTile('road_edge_top', { draw(c, r) { road(c, r); R(c, 0, 0, 16, 1, '#e8e6d8'); }, hd(c, r) { roadHD(c, r); R(c, 0, 0, 32, 2, '#e8e6d8'); R(c, 0, 1, 32, 1, '#d4d2c5'); R(c, 0, 2, 32, 1, '#44474e'); } });
defineTile('road_edge_bottom', { draw(c, r) { road(c, r); R(c, 0, 15, 16, 1, '#e8e6d8'); }, hd(c, r) { roadHD(c, r); R(c, 0, 29, 32, 1, '#44474e'); R(c, 0, 30, 32, 2, '#e8e6d8'); R(c, 0, 31, 32, 1, '#d4d2c5'); } });
defineTile('crosswalk_h', {
  draw(c, r) { road(c, r); for (let y = 1; y < 16; y += 4) R(c, 1, y, 14, 2, '#ecebe4'); },
  hd(c, r) { roadHD(c, r); for (let y = 2; y < 32; y += 8) paint(c, r, 2, y, 28, 4); },
});
defineTile('crosswalk_v', {
  draw(c, r) { road(c, r); for (let x = 1; x < 16; x += 4) R(c, x, 1, 2, 14, '#ecebe4'); },
  hd(c, r) { roadHD(c, r); for (let x = 2; x < 32; x += 8) paint(c, r, x, 2, 4, 28, true); },
});
// Water: speckled body plus little wave arcs that drift right each frame.
function waterHD(c, r, f, base, cols, wave, rim, foam, step, spots) {
  R(c, 0, 0, 32, 32, base);
  for (let i = 0; i < 40; i++) Pw(c, RND(r, 32), RND(r, 32), cols[RND(r, cols.length)]);
  const o = f * step;
  for (const [x, y] of spots) {
    Rw(c, x + o + 1, y, 4, 1, wave);
    Pw(c, x + o, y + 1, rim); Pw(c, x + o + 5, y + 1, rim);
    Pw(c, x + o + 1, y, foam);
  }
}
// Wave-mark layouts per variant, so big stretches of water do not show the
// same marks in a grid every tile (the map hashes the variant per cell).
const WAVES = [[[2, 6], [18, 12], [8, 22], [24, 26]], [[10, 3], [26, 9], [3, 16], [16, 25]], [[22, 4], [6, 11], [20, 19], [11, 28]]];
const CANAL_WAVES = [[[4, 4], [20, 14], [10, 24]], [[14, 2], [2, 12], [24, 22]], [[26, 7], [12, 17], [4, 27]]];
defineTile('water', {
  solid: true, frames: 2, speed: 40, variants: 3,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#3d7fd1');
    speckle(c, r, ['#3674c2'], 10);
    const o = f * 4;
    for (const [x, y] of [[1, 3], [9, 6], [4, 11], [12, 13]]) R(c, (x + o) % 16, y, 3, 1, '#8cc2f5');
  },
  hd(c, r, f, v) { waterHD(c, r, f, '#3d7fd1', ['#3674c2', '#4486d6'], '#8cc2f5', '#5f9fe6', '#d4ebff', 8, WAVES[v]); },
});
defineTile('canal', {
  solid: true, frames: 2, speed: 45, variants: 3,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#2f5f96');
    speckle(c, r, ['#2a5688', '#36699f'], 12);
    const o = f * 5;
    for (const [x, y] of [[2, 2], [10, 7], [5, 12]]) R(c, (x + o) % 16, y, 4, 1, '#6f9fd4');
  },
  hd(c, r, f, v) { waterHD(c, r, f, '#2f5f96', ['#2a5688', '#36699f'], '#6f9fd4', '#4a7cb4', '#a8c8ec', 10, CANAL_WAVES[v]); },
});
// Wooden footbridge: planks across the walking direction, beams on both sides.
function bridgeHD(c, r) {
  R(c, 0, 0, 32, 32, '#b07a46');
  for (let y = 0; y < 32; y += 8) {
    R(c, 0, y, 32, 1, '#c48e58'); R(c, 0, y + 6, 32, 1, '#9c6a3a'); R(c, 0, y + 7, 32, 1, '#7a5030');
    P(c, 7, y + 3, '#6e4422'); P(c, 24, y + 3, '#6e4422');
  }
  grain(c, r, 0, 1, 32, 5, '#a3703f', 8, 5);
  // edge beams (kept slim so bridges several tiles wide still read as one deck)
  R(c, 0, 0, 1, 32, '#6e4422'); R(c, 1, 0, 2, 32, '#d8a46a'); R(c, 3, 0, 1, 32, '#7a5030');
  R(c, 29, 0, 1, 32, '#7a5030'); R(c, 30, 0, 1, 32, '#b07a46'); R(c, 31, 0, 1, 32, '#6e4422');
}
defineTile('bridge_v', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#b07a46');
    for (let y = 0; y < 16; y += 4) R(c, 2, y, 12, 1, '#8a5a30');
    R(c, 0, 0, 2, 16, '#6e4422'); R(c, 14, 0, 2, 16, '#6e4422');
    R(c, 1, 0, 1, 16, '#d8a46a'); R(c, 15, 0, 1, 16, '#8a5a30');
  },
  hd: bridgeHD,
});
defineTile('bridge_h', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#b07a46');
    for (let x = 0; x < 16; x += 4) R(c, x, 2, 1, 12, '#8a5a30');
    R(c, 0, 0, 16, 2, '#6e4422'); R(c, 0, 14, 16, 2, '#6e4422');
    R(c, 0, 1, 16, 1, '#d8a46a');
  },
  hd(c, r) {
    // the vertical bridge turned 90 degrees (planks run top-bottom)
    R(c, 0, 0, 32, 32, '#b07a46');
    for (let x = 0; x < 32; x += 8) {
      R(c, x, 0, 1, 32, '#c48e58'); R(c, x + 6, 0, 1, 32, '#9c6a3a'); R(c, x + 7, 0, 1, 32, '#7a5030');
      P(c, x + 3, 7, '#6e4422'); P(c, x + 3, 24, '#6e4422');
    }
    for (let i = 0; i < 8; i++) R(c, RND(r, 32), 2 + RND(r, 26), 1, 2 + RND(r, 4), '#a3703f');
    R(c, 0, 0, 32, 1, '#6e4422'); R(c, 0, 1, 32, 2, '#d8a46a'); R(c, 0, 3, 32, 1, '#7a5030');
    R(c, 0, 29, 32, 1, '#7a5030'); R(c, 0, 30, 32, 1, '#b07a46'); R(c, 0, 31, 32, 1, '#6e4422');
  },
});
defineTile('rail', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#8b8577'); speckle(c, r, ['#7a7466', '#9c968a'], 30);
    for (let x = 1; x < 16; x += 5) R(c, x, 2, 3, 12, '#6b4a2e');
    R(c, 0, 4, 16, 2, '#c0c4cc'); R(c, 0, 10, 16, 2, '#c0c4cc');
    R(c, 0, 5, 16, 1, '#7e828a'); R(c, 0, 11, 16, 1, '#7e828a');
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#8b8577');
    for (let i = 0; i < 70; i++) { const x = RND(r, 32), y = RND(r, 32); Pw(c, x, y, '#a29c90'); Pw(c, x + 1, y + 1, '#6f6a5d'); }
    speckle(c, r, ['#7a7466', '#9c968a'], 50);
    for (const x of [1, 9, 17, 25]) {
      R(c, x, 4, 6, 24, '#6b4a2e'); R(c, x, 4, 6, 1, '#86603e'); R(c, x, 5, 1, 22, '#7a5636');
      R(c, x + 5, 5, 1, 23, '#55391f'); R(c, x, 27, 6, 1, '#4a3019');
      for (const ry of [8, 20]) { R(c, x + 1, ry + 3, 4, 2, '#4a4e58'); R(c, x + 1, ry + 3, 4, 1, '#6d7380'); }
    }
    for (const ry of [8, 20]) {
      R(c, 0, ry + 4, 32, 1, 'rgba(0,0,0,0.3)');
      R(c, 0, ry, 32, 1, '#e8ebf0'); R(c, 0, ry + 1, 32, 1, '#c0c4cc'); R(c, 0, ry + 2, 32, 2, '#7e828a'); R(c, 0, ry + 3, 32, 1, '#686c74');
    }
  },
});
defineTile('platform', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#bdbfc6'); speckle(c, r, ['#b0b2b9'], 8);
    R(c, 0, 12, 16, 3, '#e8c43a'); for (let x = 1; x < 16; x += 3) P(c, x, 13, '#c9a52a');
    R(c, 0, 15, 16, 1, '#ffffff');
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#bdbfc6'); speckle(c, r, ['#b3b5bc', '#c6c8ce'], 30, 0, 0, 32, 23);
    R(c, 31, 0, 1, 23, '#aeb0b7'); R(c, 0, 0, 31, 1, '#c9cbd1');
    R(c, 0, 23, 32, 1, '#a4a6ad');
    R(c, 0, 24, 32, 6, '#e8c43a'); R(c, 0, 24, 32, 1, '#f3d867');
    for (let x = 1; x < 32; x += 4) { R(c, x, 26, 2, 2, '#c9a52a'); P(c, x, 26, '#f6dc6a'); }
    R(c, 0, 30, 32, 1, '#ffffff'); R(c, 0, 31, 32, 1, '#d5d9e0');
  },
});

// ---------------------------------------------------------------- outdoor objects
// Round tree canopy as clumps (centre + ring of bumps), shaded per clump.
const CANOPY = [
  [16, 5.5, 5.5], [9.5, 8, 5.5], [22.5, 8, 5.5],
  [16, 12.5, 9.5],
  // side lumps kept 3px in from the edges so rows of trees stay separate trees (as in v1)
  [7.5, 13.5, 4.6], [24.5, 13.5, 4.6],
  [10.5, 18.5, 5.2], [21.5, 18.5, 5.2], [16, 19.5, 5.5],
];
function trunkHD(c, x, y, h, col) {
  R(c, x, y, 5, h, col); R(c, x, y, 1, h, shade(col, 0.2)); R(c, x + 1, y, 1, h, shade(col, 0.08)); R(c, x + 4, y, 1, h, shade(col, -0.25));
  R(c, x - 1, y + h - 2, 7, 2, col); P(c, x - 1, y + h - 2, shade(col, 0.2)); P(c, x + 5, y + h - 2, shade(col, -0.25));
}
// R29: six kinds of tree (the variant is picked per map cell): two round broadleaves, a tall upright one (ケヤキ), a wide low crown, a pale young-leaf one, a conifer (スギ)
const TREE_PAL = [
  ['#1f441f', '#2d5a2b', '#3f8a3a', '#5fae4f', '#86cc6c'],
  ['#21502a', '#2f6b34', '#45944a', '#6cbc5c', '#93d67f'],
  ['#1c4a2c', '#2a6a3c', '#3c8c4c', '#58ac62', '#80cc88'],
  ['#2a5a1c', '#3e7a24', '#5a9c32', '#82bc48', '#aedc6a'],
  ['#4a6a1c', '#6a8c28', '#8cae3a', '#b0cc56', '#d2e47e'],
  ['#143a28', '#1f5236', '#2d6e46', '#438a58', '#62a874'],
  ['#6a2a14', '#9a4220', '#c4622c', '#e08a3c', '#f2b254'], // 6: autumn maple
  ['#7a5c0c', '#a8830f', '#d4aa1c', '#ecc83a', '#f8e272'], // 7: ginkgo yellow
  ['#1a3a2a', '#26503a', '#34684c', '#4a8462', '#68a07c'], // 8: dark evergreen
  ['#5a2a3a', '#843e56', '#aa5a74', '#cc7e98', '#e6a4b8'], // 9: purple-leaf plum
  ['#2a5a3a', '#3c7c50', '#52a068', '#76c488', '#a0e2b0'], // 10: cool blue-green
  ['#7a6a1c', '#a08e2a', '#c4b43e', '#dccc62', '#eee294'], // 11: dry yellow-green
];
defineTile('tree', {
  solid: true, obj: true, variants: 12,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 14, 6, 2);
    R(c, 7, 10, 3, 5, '#7a4f2a'); R(c, 7, 10, 1, 5, '#94653a');
    const pal = TREE_PAL[v % 12];
    if (v === 5) { for (let i = 0; i < 4; i++) R(c, 8 - 1 - i, 3 + i * 2, 2 + i * 2, 2, i % 2 ? pal[2] : pal[1]); P(c, 7, 2, pal[3]); return; }
    if (v === 8) { disc(c, 8, 6, 5, pal[0]); disc(c, 8, 6, 4, pal[1]); disc(c, 7, 4, 2, pal[3]); return; }
    if (v === 2) { disc(c, 8, 6, 4, pal[1]); R(c, 4, 3, 8, 8, pal[1]); disc(c, 8, 5, 4, pal[2]); P(c, 6, 3, pal[4]); return; }
    disc(c, 8, 6, 6, pal[1]); disc(c, 8, 6, 5, pal[2]);
    disc(c, 6, 4, 2, pal[3]); P(c, 10, 5, pal[3]); P(c, 11, 4, pal[3]); P(c, 5, 8, pal[3]);
  },
  hd(c, r, f, v) {
    const pal = TREE_PAL[v % 12];
    shadowEllipse(c, 16, 28, v === 3 ? 13 : 11, 3);
    if (v === 5) { // conifer: stacked skirts on a thin trunk
      trunkHD(c, 14, 22, 7, '#6a4426');
      const tiers = [[16, 3, 5], [16, 8, 7], [16, 14, 9], [16, 20, 11]];
      for (const [x, y, w] of tiers) blobs(c, [[x - w * 0.55, y + 5, w * 0.5], [x + w * 0.55, y + 5, w * 0.5], [x, y + 3, w * 0.62], [x, y + 6, w * 0.5]], pal, { bias: -0.04 });
      outline(c);
      return;
    }
    if (v === 8) { // dense dark evergreen, a rounder crown set low
      trunkHD(c, 14, 23, 6, '#5a3c22');
      blobs(c, [[16, 8, 6], [9, 14, 6], [23, 14, 6], [16, 14, 8], [11, 20, 6], [21, 20, 6], [16, 22, 6]], pal, { bias: -0.08 });
      outline(c);
      return;
    }
    if (v === 2) { // tall upright crown
      trunkHD(c, 14, 21, 8, '#6e4a2c');
      blobs(c, [[16, 5, 5], [16, 11, 6.5], [11, 14, 5], [21, 14, 5], [16, 17, 7.5], [12, 20, 4.5], [20, 20, 4.5]], pal, { bias: -0.06 });
      outline(c);
      for (let i = 0; i < 6; i++) { const x = 9 + RND(r, 14), y = 4 + RND(r, 16); P(c, x, y, pal[1]); P(c, x + 1, y - 1, pal[1]); }
      return;
    }
    if (v === 3) { // wide low crown
      trunkHD(c, 14, 22, 7, '#7a5232');
      blobs(c, [[16, 10, 7], [7, 15, 6], [25, 15, 6], [12, 12, 6], [20, 12, 6], [9, 20, 5.5], [23, 20, 5.5], [16, 19, 7]], pal, { bias: -0.06 });
      outline(c);
      for (let i = 0; i < 7; i++) { const x = 5 + RND(r, 22), y = 8 + RND(r, 12); P(c, x, y, pal[1]); P(c, x + 1, y - 1, pal[1]); }
      return;
    }
    trunkHD(c, 14, 20, 9, v === 4 ? '#8a6a44' : '#7a4f2a');
    blobs(c, CANOPY, pal, { bias: -0.06 });
    outline(c);
    for (let i = 0; i < 6; i++) { const x = 8 + RND(r, 16), y = 6 + RND(r, 12); P(c, x, y, pal[1]); P(c, x + 1, y - 1, pal[1]); }
  },
});
defineTile('sakura', {
  solid: true, obj: true, variants: 3,
  draw(c, r) {
    shadowEllipse(c, 8, 14, 6, 2);
    R(c, 7, 10, 3, 5, '#6e4428');
    disc(c, 8, 6, 6, '#d97aa0'); disc(c, 8, 6, 5, '#f2a7c3');
    disc(c, 6, 4, 2, '#ffd3e3'); speckle(c, r, ['#ffe8f0', '#e88fb2'], 10, 3, 1, 10, 9);
  },
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 28, 11, 3);
    trunkHD(c, 14, 20, 9, '#6e4428');
    const pal = [['#b8577f', '#d97aa0', '#f2a7c3', '#ffc6da', '#ffe3ee'], ['#c24a78', '#e0588c', '#f48cb4', '#ffb4d0', '#ffd8e8'], ['#c8aab4', '#e0c8d2', '#f2e2e8', '#fbf0f4', '#ffffff']][v % 3];
    blobs(c, CANOPY, pal);
    outline(c, { tint: 0.3 });
    speckle(c, r, ['#ffffff', '#ffe8f0', '#e88fb2'], 14, 7, 4, 18, 14);
    for (const [x, y] of [[4, 27], [26, 29], [21, 26], [9, 30]]) P(c, x, y, '#ffc6da');
  },
});
defineTile('bush', {
  solid: true, obj: true, variants: 3,
  draw(c) {
    shadowEllipse(c, 8, 13, 6, 2);
    disc(c, 8, 9, 5, '#2f6b34'); disc(c, 8, 9, 4, '#4a9a4a'); disc(c, 6, 7, 1, '#74c26a'); P(c, 10, 8, '#74c26a');
  },
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 26, 12, 3);
    const pal = v === 2 ? ['#2a5a1c', '#3e7a24', '#5a9c32', '#82bc48', '#aedc6a'] : ['#1f4a24', '#2f6b34', '#4a9a4a', '#74c26a', '#98d98a'];
    if (v === 1) blobs(c, [[16, 12, 6], [10, 17, 5.5], [22, 17, 5.5], [16, 20, 7]], pal, { bias: -0.1 }); // a taller, narrower shrub
    else blobs(c, [[11, 14, 5.5], [21, 14, 5.5], [16, 13, 6], [8, 20, 5], [24, 20, 5], [16, 19, 8]], pal, { bias: -0.1 });
    outline(c);
    if (v === 1) for (const [x, y] of [[12, 12], [19, 15], [15, 20], [9, 19], [22, 20]]) { P(c, x, y, '#ffffff'); P(c, x + 1, y, '#ffd3e3'); P(c, x, y + 1, '#f2a7c3'); } // flowering
  },
});
defineTile('hedge', {
  solid: true, variants: 4,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#2f6b34'); R(c, 0, 0, 16, 12, '#4a9a4a');
    speckle(c, r, ['#5fb35b', '#3f8a3a'], 30, 0, 0, 16, 12); R(c, 0, 0, 16, 1, '#74c26a');
  },
  // clipped hedge: leafy top face, darker front face, scalloped edge between
  hd(c, r, f, v) {
    // R29: 0 plain clipped hedge, 1 azalea (pink blossoms), 2 pale boxwood, 3 dark yew
    const H = [['#2f6b34', '#4a9a4a'], ['#2f6b34', '#4a9a4a'], ['#4a7a28', '#7aac3e'], ['#1f4a2a', '#2f6b3c']][v % 4];
    R(c, 0, 0, 32, 32, H[0]); R(c, 0, 0, 32, 24, H[1]);
    for (let i = 0; i < 26; i++) {
      const x = RND(r, 32), y = 1 + RND(r, 20);
      Pw(c, x, y, '#5fb35b'); Pw(c, x + 1, y, '#5fb35b'); Pw(c, x, y - 1, '#74c26a'); Pw(c, x + 1, y + 1, '#3f8a3a');
    }
    speckle(c, r, ['#3f8a3a', '#55a852'], 30, 0, 0, 32, 23);
    for (let x = 0; x < 32; x += 4) { R(c, x, 24, 4, 1, '#3f8a3a'); R(c, x + 1, 25, 2, 1, '#3f8a3a'); P(c, x + 3, 24, '#2f6b34'); }
    for (let i = 0; i < 18; i++) { const x = RND(r, 32), y = 26 + RND(r, 5); Pw(c, x, y, '#3a7d3e'); Pw(c, x + 1, y + 1, '#245428'); }
    R(c, 0, 31, 32, 1, '#22502a');
    R(c, 0, 0, 32, 1, '#86cc78'); dither(c, 0, 1, 32, 1, '#74c26a');
    if (v === 1) for (let i = 0; i < 16; i++) { const x = 1 + RND(r, 30), y = 2 + RND(r, 20); Pw(c, x, y, i % 3 ? '#f2a7c3' : '#ffffff'); Pw(c, x + 1, y, '#d97aa0'); }
  },
});
defineTile('fence', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 6, 16, 2, '#f2efe6'); R(c, 0, 11, 16, 2, '#f2efe6');
    for (const x of [1, 6, 11]) { R(c, x, 3, 3, 12, '#f8f6ef'); R(c, x + 2, 3, 1, 12, '#c9c4b5'); P(c, x + 1, 2, '#f8f6ef'); }
  },
  hd(c) {
    for (const y of [12, 22]) { R(c, 0, y, 32, 4, '#ebe7dc'); R(c, 0, y, 32, 1, '#ffffff'); R(c, 0, y + 3, 32, 1, '#c9c4b5'); }
    for (const x of [2, 13, 23]) {
      R(c, x, 6, 6, 24, '#f8f6ef'); R(c, x, 6, 1, 24, '#ffffff'); R(c, x + 4, 6, 2, 24, '#ddd8ca'); R(c, x + 5, 6, 1, 24, '#c9c4b5');
      R(c, x + 1, 5, 4, 1, '#f8f6ef'); R(c, x + 2, 4, 2, 1, '#ffffff');
      R(c, x, 29, 6, 1, '#c9c4b5');
      P(c, x + 2, 13, '#b5b0a2'); P(c, x + 2, 23, '#b5b0a2');
    }
    outline(c, { tint: 0.35 });
  },
});
defineTile('railing', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 5, 16, 2, '#9aa0aa'); R(c, 0, 5, 16, 1, '#d5d9e0');
    for (const x of [2, 10]) R(c, x, 5, 2, 10, '#7c828c');
    R(c, 0, 10, 16, 1, '#9aa0aa');
  },
  hd(c) {
    for (const x of [4, 20]) { R(c, x, 10, 4, 20, '#7c828c'); R(c, x, 10, 1, 20, '#b8bec8'); R(c, x + 3, 10, 1, 20, '#5e636c'); R(c, x - 1, 28, 6, 2, '#5e636c'); }
    R(c, 0, 20, 32, 2, '#9aa0aa'); R(c, 0, 20, 32, 1, '#c3c8d0');
    R(c, 0, 10, 32, 4, '#9aa0aa'); R(c, 0, 10, 32, 1, '#e8ebf0'); R(c, 0, 11, 32, 1, '#d5d9e0'); R(c, 0, 13, 32, 1, '#6d7380');
    outline(c);
  },
});
defineTile('lamp', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 3, 1);
    R(c, 7, 4, 2, 11, '#5a5f6b'); R(c, 7, 4, 1, 11, '#7d8391');
    R(c, 6, 14, 4, 2, '#4a4e58');
    R(c, 5, 1, 6, 3, '#3b3f48'); R(c, 6, 3, 4, 1, '#fff2a8'); R(c, 6, 2, 4, 1, '#ffe36e');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 6, 2);
    R(c, 14, 8, 4, 20, '#5a5f6b'); R(c, 14, 8, 1, 20, '#8d939f'); R(c, 15, 8, 1, 20, '#6b707c'); R(c, 17, 8, 1, 20, '#454953');
    R(c, 13, 18, 6, 1, '#454953');
    R(c, 12, 26, 8, 4, '#4a4e58'); R(c, 12, 26, 8, 1, '#6a6f7b'); R(c, 12, 27, 1, 3, '#5f6470'); R(c, 19, 27, 1, 3, '#3a3d45');
    R(c, 11, 29, 10, 2, '#3b3f48'); R(c, 11, 29, 10, 1, '#4a4e58');
    R(c, 10, 2, 12, 6, '#3b3f48'); R(c, 11, 2, 10, 1, '#5a5f6b'); R(c, 10, 3, 1, 4, '#4a4e58');
    R(c, 15, 0, 2, 2, '#3b3f48');
    R(c, 12, 5, 8, 3, '#ffe36e'); R(c, 12, 7, 8, 1, '#fff2a8'); R(c, 13, 5, 2, 1, '#fffbe0');
    R(c, 14, 8, 4, 1, '#2e3138');
    outline(c);
  },
});
defineTile('bench', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 7, 1);
    R(c, 1, 5, 14, 2, '#a86c3a'); R(c, 1, 8, 14, 3, '#c4884e'); R(c, 1, 8, 14, 1, '#dca26a');
    R(c, 2, 11, 2, 3, '#4a4e58'); R(c, 12, 11, 2, 3, '#4a4e58');
  },
  hd(c) {
    shadowEllipse(c, 16, 26, 14, 2);
    for (const x of [5, 25]) { R(c, x, 9, 2, 8, '#4a4e58'); P(c, x, 9, '#6a6f7b'); }
    for (const y of [9, 12]) { R(c, 2, y, 28, 2, '#a86c3a'); R(c, 2, y, 28, 1, '#c0804a'); }
    for (const y of [16, 18, 20]) { R(c, 2, y, 28, 2, '#c4884e'); R(c, 2, y, 28, 1, '#dca26a'); }
    R(c, 2, 21, 28, 1, '#a86c3a');
    for (const x of [4, 24]) { R(c, x, 22, 4, 5, '#4a4e58'); R(c, x, 22, 1, 5, '#6a6f7b'); R(c, x + 3, 22, 1, 5, '#3b3f48'); }
    outline(c);
  },
});
defineTile('vending', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    const body = v ? '#2f6fd0' : '#d63a3a';
    R(c, 2, 0, 12, 16, shade(body, -0.35)); R(c, 3, 0, 10, 15, body); R(c, 3, 0, 10, 1, shade(body, 0.3));
    R(c, 4, 2, 8, 6, '#e8f2ff');
    const cans = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff', '#ff9a3c', '#b388ff'];
    for (let i = 0; i < 4; i++) { R(c, 4 + i * 2, 3, 1, 2, cans[i]); R(c, 4 + i * 2, 6, 1, 2, cans[i + 2]); }
    R(c, 4, 9, 5, 2, '#20232a'); R(c, 10, 9, 2, 3, '#c0c4cc'); R(c, 4, 12, 8, 2, '#20232a');
  },
  hd(c, r, f, v) {
    const b = v ? '#2f6fd0' : '#d63a3a';
    R(c, 4, 1, 24, 31, shade(b, -0.35)); R(c, 6, 1, 21, 30, b);
    R(c, 6, 1, 21, 1, shade(b, 0.35)); R(c, 6, 2, 1, 29, shade(b, 0.18)); R(c, 26, 2, 1, 29, shade(b, -0.15));
    R(c, 4, 1, 2, 1, shade(b, -0.1));
    inset(c, 8, 4, 16, 13, '#e8f2ff', '#ffffff', '#b8c8dc');
    const cans = ['#ff5d6c', '#ffd23f', '#5ee07a', '#5fd7ff', '#ff9a3c', '#b388ff', '#ffffff', '#ff5d6c'];
    for (const [row, y] of [[0, 6], [1, 12]]) {
      for (let i = 0; i < 5; i++) {
        const col = cans[(i + row * 3) % cans.length];
        R(c, 10 + i * 3, y, 2, 4, col); P(c, 10 + i * 3, y, shade(col, 0.5)); P(c, 11 + i * 3, y + 3, shade(col, -0.25));
      }
      R(c, 9, y + 4, 14, 1, '#b8c4d4');
    }
    for (let i = 0; i < 5; i++) P(c, 10 + i * 3, 11, i === 2 ? '#ff5d6c' : '#5ee07a');
    R(c, 8, 19, 10, 4, '#20232a'); R(c, 9, 20, 4, 1, '#ff9a3c'); R(c, 14, 20, 3, 1, '#5ee07a');
    R(c, 20, 18, 4, 6, '#c0c4cc'); R(c, 20, 18, 4, 1, '#e4e7ec'); R(c, 21, 20, 2, 1, '#20232a'); R(c, 21, 22, 2, 1, '#5a5f6b');
    R(c, 8, 25, 16, 4, '#20232a'); R(c, 8, 25, 16, 1, shade(b, -0.45)); R(c, 9, 27, 14, 1, '#3b3f48');
    R(c, 6, 30, 21, 1, shade(b, -0.25));
    outline(c);
  },
});
defineTile('trash', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 4, 1);
    R(c, 4, 5, 8, 9, '#3a6fb0'); R(c, 4, 5, 2, 9, '#5a8fd0'); R(c, 3, 4, 10, 2, '#2a5a94'); R(c, 6, 4, 4, 1, '#20232a');
  },
  hd(c) {
    shadowEllipse(c, 16, 28, 9, 2);
    R(c, 8, 11, 16, 17, '#3a6fb0'); R(c, 8, 11, 3, 17, '#5a8fd0'); R(c, 9, 11, 1, 17, '#6c9edc'); R(c, 21, 11, 3, 17, '#2f5f9c');
    for (const x of [13, 17]) R(c, x, 13, 1, 13, '#335f9a');
    R(c, 12, 16, 8, 6, '#e8f2ff'); R(c, 14, 17, 4, 4, '#2f9a4a'); R(c, 15, 18, 2, 2, '#e8f2ff');
    R(c, 6, 8, 20, 4, '#2a5a94'); R(c, 6, 8, 20, 1, '#4a7ac0'); R(c, 6, 11, 20, 1, '#1f4a7c');
    R(c, 12, 8, 8, 2, '#20232a'); R(c, 12, 10, 8, 1, '#1f4a7c');
    R(c, 8, 27, 16, 1, '#2a5a94');
    outline(c);
  },
});
defineTile('mailbox', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 7, 11, 2, 4, '#7a1f1f');
    R(c, 4, 2, 8, 10, '#d62f2f'); R(c, 4, 2, 2, 10, '#ef5a5a'); R(c, 4, 1, 8, 2, '#b02020');
    R(c, 6, 4, 4, 1, '#20232a'); R(c, 6, 7, 4, 2, '#ffffff'); P(c, 7, 7, '#d62f2f');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 8, 2);
    R(c, 13, 23, 6, 7, '#7a1f1f'); R(c, 13, 23, 2, 7, '#9a2a2a');
    R(c, 8, 5, 16, 19, '#d62f2f'); R(c, 8, 5, 3, 19, '#ef5a5a'); R(c, 9, 5, 1, 19, '#ff7a7a'); R(c, 21, 5, 3, 19, '#b82525');
    R(c, 9, 2, 14, 4, '#b02020'); R(c, 8, 3, 16, 3, '#b02020'); R(c, 10, 2, 9, 1, '#d64040'); R(c, 9, 3, 2, 1, '#d64040');
    R(c, 8, 6, 16, 1, '#8e1a1a');
    R(c, 11, 9, 10, 2, '#20232a'); R(c, 11, 11, 10, 1, '#ef5a5a');
    R(c, 11, 14, 10, 7, '#ffffff'); R(c, 11, 20, 10, 1, '#d5d9e0');
    R(c, 13, 15, 6, 1, '#d62f2f'); R(c, 13, 17, 6, 1, '#d62f2f'); R(c, 15, 18, 2, 2, '#d62f2f');
    R(c, 8, 23, 16, 1, '#8e1a1a');
    outline(c);
  },
});
defineTile('planter', {
  solid: true, obj: true, variants: 3,
  draw(c, r) {
    R(c, 1, 8, 14, 7, '#8a5a33'); R(c, 1, 8, 14, 1, '#b07a46');
    disc(c, 5, 7, 3, '#3f8a3a'); disc(c, 11, 7, 3, '#3f8a3a');
    for (const [x, y, col] of [[4, 5, '#ff6f91'], [7, 7, '#ffd23f'], [11, 5, '#ff6f91'], [12, 8, '#fff']]) P(c, x, y, col);
  },
  hd(c, r, f, v) {
    const FL = [['#ff6f91', '#ffd23f', '#ff6f91', '#ffffff', '#ffd23f', '#ffffff'], ['#b48aff', '#e6d4ff', '#b48aff', '#6fb4ff', '#e6d4ff', '#ffffff'], ['#ff5a4a', '#ffd23f', '#ff8a3a', '#ffd23f', '#ff5a4a', '#ffffff']][v % 3];
    blobs(c, [[10, 12, 6], [22, 12, 6], [16, 14, 5], [6, 16, 4], [26, 16, 4]], ['#1f4a24', '#2f6b34', '#3f8a3a', '#5fae4f', '#86cc6c']);
    R(c, 2, 16, 28, 14, '#8a5a33'); R(c, 2, 16, 28, 2, '#b07a46'); R(c, 2, 16, 28, 1, '#c8925c'); R(c, 2, 18, 28, 1, '#6e4428');
    for (const x of [9, 16, 23]) R(c, x, 19, 1, 10, '#7a4e2c');
    R(c, 2, 19, 1, 10, '#9e6a3c'); R(c, 2, 29, 28, 1, '#5a3a20');
    for (const [x, y, col] of [[8, 9, FL[0]], [14, 13, FL[1]], [22, 9, FL[2]], [24, 14, FL[3]], [5, 14, FL[4]], [18, 8, FL[5]]]) {
      R(c, x, y, 2, 2, col); P(c, x, y, shade(col, 0.5)); P(c, x + 1, y + 1, shade(col, -0.2));
    }
    outline(c);
  },
});
defineTile('cone', {
  solid: true, obj: true,
  draw(c) {
    R(c, 4, 13, 8, 2, '#d0551f');
    for (let y = 4; y < 13; y++) { const w = 1 + Math.floor((y - 4) / 2); R(c, 8 - w, y, w * 2, 1, (y === 7 || y === 10) ? '#ffffff' : '#ff7a2f'); }
  },
  hd(c) {
    shadowEllipse(c, 16, 29, 10, 2);
    R(c, 6, 26, 20, 4, '#d0551f'); R(c, 6, 26, 20, 1, '#e8743a'); R(c, 6, 29, 20, 1, '#a8421a');
    for (let y = 7; y < 26; y++) {
      const w = 1 + Math.floor((y - 7) * 0.42);
      const band = (y >= 13 && y <= 15) || (y >= 19 && y <= 21);
      R(c, 16 - w, y, w * 2, 1, band ? '#f4f4f4' : '#ff7a2f');
      R(c, 16 - w, y, Math.max(1, Math.floor(w / 2)), 1, band ? '#ffffff' : '#ff9a5a');
      R(c, 16 + w - Math.max(1, Math.floor(w / 2)), y, Math.max(1, Math.floor(w / 2)), 1, band ? '#d5d9e0' : '#e0601f');
    }
    outline(c);
  },
});
const GLYPHS = [['######', '..##..', '######', '..##..'], ['#.##.#', '######', '#....#', '######'], ['..##..', '######', '.#..#.', '##..##'], ['######', '#.##.#', '######', '..##..']];
defineTile('nobori', {
  solid: true, obj: true, variants: 4,
  draw(c, r, f, v) {
    const col = ['#d62f2f', '#2f6fd0', '#e8b818', '#2f9a4a'][v];
    R(c, 3, 0, 1, 16, '#c0c4cc');
    R(c, 4, 1, 8, 13, col); R(c, 4, 1, 8, 1, shade(col, 0.4));
    for (let y = 3; y < 13; y += 3) R(c, 7, y, 2, 2, '#ffffff');
  },
  hd(c, r, f, v) {
    const col = ['#d62f2f', '#2f6fd0', '#e8b818', '#2f9a4a'][v];
    shadowEllipse(c, 8, 31, 4, 1);
    R(c, 6, 0, 2, 32, '#c0c4cc'); R(c, 6, 0, 1, 32, '#e4e7ec'); R(c, 8, 2, 16, 1, '#c0c4cc');
    R(c, 8, 3, 16, 24, col); R(c, 8, 3, 16, 2, shade(col, 0.4)); R(c, 8, 5, 1, 22, shade(col, 0.2)); R(c, 22, 5, 2, 22, shade(col, -0.18));
    for (let x = 8; x < 24; x += 4) { R(c, x, 27, 2, 1, col); P(c, x + 2, 26, shade(col, -0.18)); }
    GLYPHS.forEach((g, i) => pix(c, g, { '#': '#ffffff' }, 13, 6 + i * 5));
    R(c, 13, 26, 6, 1, shade(col, -0.25));
    outline(c);
  },
});
defineTile('sign_board', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 10, 2, 5, '#6e4428'); R(c, 11, 10, 2, 5, '#6e4428');
    R(c, 1, 2, 14, 9, '#6e4428'); R(c, 2, 3, 12, 7, '#d9b77a');
    R(c, 4, 5, 8, 1, '#8a5a33'); R(c, 4, 7, 6, 1, '#8a5a33');
  },
  hd(c, r) {
    shadowEllipse(c, 16, 30, 12, 2);
    for (const x of [6, 22]) { R(c, x, 20, 4, 10, '#6e4428'); R(c, x, 20, 1, 10, '#8a5a33'); R(c, x + 3, 20, 1, 10, '#523219'); }
    R(c, 2, 4, 28, 18, '#6e4428'); R(c, 2, 4, 28, 1, '#9b6a40'); R(c, 2, 5, 1, 16, '#8a5a33'); R(c, 2, 21, 28, 1, '#4f3018');
    inset(c, 5, 7, 22, 12, '#d9b77a', '#ead0a0', '#b8955a');
    grain(c, r, 6, 8, 20, 10, '#cfac6f', 5, 6);
    R(c, 8, 10, 16, 1, '#6e4428'); R(c, 8, 13, 12, 1, '#6e4428'); R(c, 8, 16, 14, 1, '#8a5a33');
    outline(c);
  },
});
defineTile('bicycle', {
  solid: true, obj: true,
  draw(c) {
    for (const cx of [4, 12]) { for (let a = 0; a < 16; a++) P(c, Math.round(cx + Math.cos(a / 16 * 6.283) * 3), Math.round(11 + Math.sin(a / 16 * 6.283) * 3), '#2a2d36'); }
    R(c, 4, 8, 8, 1, '#d62f2f'); R(c, 7, 6, 1, 5, '#d62f2f'); R(c, 6, 6, 3, 1, '#2a2d36'); R(c, 11, 6, 2, 1, '#2a2d36');
  },
  // a Japanese "mamachari": red frame, front basket, black tyres, silver spokes
  hd(c) {
    shadowEllipse(c, 16, 29, 14, 2);
    for (const cx of [8, 24]) {
      ring(c, cx, 22.5, 4.6, 6.6, '#2a2d36');
      ring(c, cx, 22.5, 4.6, 5.2, '#4a4e58');
      line(c, cx - 3, 22, cx + 3, 22, '#c0c4cc'); line(c, cx, 19, cx, 25, '#c0c4cc');
      line(c, cx - 2, 20, cx + 2, 24, '#9aa0aa'); line(c, cx + 2, 20, cx - 2, 24, '#9aa0aa');
      R(c, cx - 1, 21, 2, 2, '#e4e7ec');
    }
    const red = '#d62f2f', dk = '#9a1f1f';
    line(c, 8, 22, 13, 13, red); line(c, 9, 22, 14, 13, dk);
    line(c, 13, 13, 16, 22, red); line(c, 8, 22, 16, 22, red); line(c, 8, 23, 16, 23, dk);
    line(c, 14, 15, 22, 15, red); line(c, 14, 16, 22, 16, dk);
    line(c, 22, 13, 16, 22, red); line(c, 23, 13, 17, 22, dk);
    line(c, 22, 12, 24, 22, '#9aa0aa');
    ring(c, 16, 22.5, 0, 2, '#3b3f48');
    R(c, 10, 10, 6, 2, '#2a2d36'); R(c, 10, 10, 6, 1, '#4a4e58'); R(c, 12, 12, 1, 2, '#9aa0aa');
    R(c, 19, 10, 6, 1, '#2a2d36'); R(c, 18, 11, 2, 1, '#2a2d36');
    R(c, 23, 11, 7, 5, '#c0c4cc'); R(c, 24, 12, 5, 3, '#8d939e'); R(c, 23, 11, 7, 1, '#e4e7ec');
    for (let x = 24; x < 30; x += 2) R(c, x, 12, 1, 3, '#d5d9e0');
  },
});

// ---------------------------------------------------------------- indoor floors
function planks(c, r, base, seam, light, horizontal = true) {
  R(c, 0, 0, 16, 16, base);
  for (let i = 0; i < 4; i++) {
    if (horizontal) {
      R(c, 0, i * 4 + 3, 16, 1, seam);
      R(c, 0, i * 4, 16, 1, light);
      const jx = (i * 7 + 3) % 16;
      R(c, jx, i * 4, 1, 3, seam);
    } else {
      R(c, i * 4 + 3, 0, 1, 16, seam);
      R(c, i * 4, 0, 1, 16, light);
      const jy = (i * 7 + 3) % 16;
      R(c, i * 4, jy, 3, 1, seam);
    }
  }
  speckle(c, r, [shade(base, -0.06)], 6);
}
// 2x planks: four 8px boards per tile, each with a lit top edge, a dark seam,
// a staggered butt joint, per-board tone and fine grain streaks.
function planksHD(c, r, base, seam, light) {
  R(c, 0, 0, 32, 32, base);
  for (let i = 0; i < 4; i++) {
    const y = i * 8, tone = shade(base, [0, -0.04, 0.03, -0.02][(i + RND(r, 4)) % 4]);
    R(c, 0, y, 32, 7, tone);
    R(c, 0, y, 32, 1, light);
    grain(c, r, 0, y + 2, 32, 4, shade(tone, -0.07), 5, 7);
    grain(c, r, 0, y + 1, 32, 4, shade(tone, 0.05), 2, 5);
    R(c, 0, y + 6, 32, 1, shade(seam, 0.18));
    R(c, 0, y + 7, 32, 1, seam);
    const jx = (i * 14 + 6) % 32;
    R(c, jx, y, 1, 7, seam); R(c, jx + 1, y, 1, 7, shade(light, -0.02));
    P(c, (jx + 16) % 32, y + 3, shade(seam, -0.1));
  }
}
defineTile('floor_wood', { draw(c, r) { planks(c, r, '#c48a52', '#a06c3c', '#d29a62'); }, hd(c, r) { planksHD(c, r, '#c48a52', '#9a6638', '#d6a06a'); } });
defineTile('floor_wood_dark', { draw(c, r) { planks(c, r, '#8a5a33', '#6e4428', '#9b6a40'); }, hd(c, r) { planksHD(c, r, '#8a5a33', '#5e3a20', '#a06e44'); } });
defineTile('floor_stage', { draw(c, r) { planks(c, r, '#ddb06e', '#b88a4c', '#ecc488'); }, hd(c, r) { planksHD(c, r, '#ddb06e', '#b0844a', '#f0ca90'); } });
defineTile('floor_tile', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#c9ccd4');
    R(c, 0, 0, 8, 8, '#eceef2'); R(c, 8, 8, 8, 8, '#eceef2'); R(c, 8, 0, 8, 8, '#dfe2e8'); R(c, 0, 8, 8, 8, '#dfe2e8');
    R(c, 0, 0, 16, 1, '#c3c6ce'); R(c, 0, 0, 1, 16, '#c3c6ce');
  },
  hd(c) {
    for (const [x, y, col] of [[0, 0, '#eceef2'], [16, 16, '#eceef2'], [16, 0, '#dfe2e8'], [0, 16, '#dfe2e8']]) {
      R(c, x, y, 16, 16, col);
      R(c, x + 1, y + 1, 15, 1, shade(col, 0.4)); R(c, x + 1, y + 2, 1, 14, shade(col, 0.25));
      R(c, x + 2, y + 15, 14, 1, shade(col, -0.04)); R(c, x + 15, y + 2, 1, 13, shade(col, -0.04));
      P(c, x + 4, y + 4, '#ffffff'); P(c, x + 5, y + 3, '#ffffff');
    }
    R(c, 0, 0, 32, 1, '#c3c6ce'); R(c, 0, 0, 1, 32, '#c3c6ce'); R(c, 0, 16, 32, 1, '#cfd2d9'); R(c, 16, 0, 1, 32, '#cfd2d9');
  },
});
defineTile('floor_marble', {
  variants: 4,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#ecebe6');
    let x = Math.floor(r() * 16), y = 0;
    while (y < 16) { P(c, x, y, '#cfccc2'); x = (x + (r() < 0.5 ? 1 : -1) + 16) % 16; y++; }
    R(c, 0, 15, 16, 1, '#dad8d0'); R(c, 15, 0, 1, 16, '#dad8d0');
  },
  // polished slabs: soft speckle, one meandering vein (different per variant)
  // with a fainter branch, bevelled joints
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#ecebe6');
    speckle(c, r, ['#e5e3dd', '#f1f0eb'], 34);
    let x = 2 + Math.floor(r() * 28), dir = r() < 0.5 ? 1 : -1;
    const y0 = v & 1 ? 0 : 6, y1 = v & 2 ? 32 : 26;
    let bx = -1, by = 0;
    // a soft 2px band with a broken core reads as veining (a solid 1px dark
    // zig-zag reads as a crack)
    for (let y = y0; y < y1; y++) {
      P(c, x + dir, y, '#e4e1d9');
      P(c, x, y, r() < 0.65 ? '#dad7cd' : '#e1ded5');
      if (y === 14) { bx = x; by = y; }
      if (r() < 0.4) x += r() < 0.8 ? dir : -dir;
      if (x < 2 || x > 29) { dir = -dir; x += dir * 2; }
    }
    if (bx >= 0) for (let k = 1; k < 9; k++) P(c, bx - dir * k, by + k + (k >> 2), k & 1 ? '#e3e0d8' : '#e7e5de');
    R(c, 0, 0, 31, 1, '#f8f7f3'); R(c, 0, 1, 1, 30, '#f8f7f3');
    R(c, 0, 31, 32, 1, '#d4d1c8'); R(c, 31, 0, 1, 32, '#d4d1c8'); R(c, 1, 30, 30, 1, '#e3e1da');
  },
});
function carpet(base) {
  return (c, r) => {
    R(c, 0, 0, 16, 16, base);
    speckle(c, r, [shade(base, -0.1), shade(base, 0.08)], 20);
  };
}
// Woven carpet: a faint diagonal weave every 4px plus random fibre specks.
function carpetHD(base) {
  return (c, r) => {
    R(c, 0, 0, 32, 32, base);
    const d = shade(base, -0.07), l = shade(base, 0.06);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const k = (x + y * 2) % 8;
      if (k === 0) P(c, x, y, d); else if (k === 4 && (y & 1)) P(c, x, y, l);
    }
    speckle(c, r, [shade(base, -0.12), shade(base, 0.1)], 40);
  };
}
defineTile('floor_carpet_red', { draw: carpet('#b8343c'), hd: carpetHD('#b8343c') });
defineTile('floor_carpet_blue', { draw: carpet('#3a58a8'), hd: carpetHD('#3a58a8') });
defineTile('floor_carpet_purple', { draw: carpet('#6b4a9a'), hd: carpetHD('#6b4a9a') });
defineTile('floor_carpet_green', { draw: carpet('#3d8a5a'), hd: carpetHD('#3d8a5a') });
defineTile('floor_carpet_gray', { draw: carpet('#6d7280'), hd: carpetHD('#6d7280') });
defineTile('floor_carpet_beige', { draw: carpet('#c9b48e'), hd: carpetHD('#c9b48e') });
defineTile('floor_concrete', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#9a9ca2'); speckle(c, r, ['#8d8f95', '#a8aab0'], 24); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#9a9ca2');
    speckle(c, r, ['#8f9197', '#a5a7ad', '#93959b', '#a8aab0'], 110);
    for (let i = 0; i < 5; i++) { const x = RND(r, 32), y = RND(r, 32); Pw(c, x, y, '#84868c'); Pw(c, x + 1, y, '#b2b4ba'); }
  },
});
defineTile('floor_studio', {
  variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 14);
    if (v === 1) { R(c, 3, 7, 6, 2, '#e8c43a'); R(c, 5, 5, 2, 6, '#e8c43a'); }
  },
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#2e3038'); speckle(c, r, ['#34363f', '#292b32', '#31333b'], 60);
    if (v === 1) {
      // gaffer-tape "T" mark for the performers
      R(c, 6, 14, 12, 4, '#e8c43a'); R(c, 10, 10, 4, 12, '#e8c43a');
      R(c, 6, 14, 12, 1, '#f6dc6a'); R(c, 10, 10, 4, 1, '#f6dc6a'); R(c, 6, 17, 4, 1, '#b8981f'); R(c, 14, 17, 4, 1, '#b8981f'); R(c, 10, 21, 4, 1, '#b8981f');
    }
  },
});
defineTile('floor_black', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#18181c'); speckle(c, r, ['#202026'], 8); },
  hd(c, r) { R(c, 0, 0, 32, 32, '#18181c'); speckle(c, r, ['#202026', '#1c1c21'], 34); },
});
defineTile('floor_checker', {
  draw(c) { R(c, 0, 0, 16, 16, '#f2f2f2'); R(c, 0, 0, 8, 8, '#1e1e24'); R(c, 8, 8, 8, 8, '#1e1e24'); },
  hd(c) {
    for (const [x, y, col] of [[0, 0, '#1e1e24'], [16, 16, '#1e1e24'], [16, 0, '#f2f2f2'], [0, 16, '#f2f2f2']]) {
      R(c, x, y, 16, 16, col); R(c, x, y, 16, 1, shade(col, col === '#f2f2f2' ? 0.6 : 0.1)); R(c, x + 3, y + 3, 2, 1, shade(col, col === '#f2f2f2' ? 0.8 : 0.16));
    }
  },
});
defineTile('floor_tatami', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#c9c27a');
    for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#bdb56c');
    R(c, 0, 0, 16, 1, '#3d5a2a'); R(c, 0, 15, 16, 1, '#3d5a2a');
    speckle(c, r, ['#d4cd88'], 8);
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#c9c27a');
    for (let y = 3; y < 30; y += 2) R(c, 0, y, 32, 1, '#bfb86f');
    for (let y = 2; y < 30; y += 4) for (let x = (y & 4) ? 0 : 2; x < 32; x += 4) P(c, x, y, '#d2cb86');
    speckle(c, r, ['#d6cf8c', '#b8b068'], 16, 0, 2, 32, 28);
    R(c, 0, 0, 32, 2, '#3d5a2a'); R(c, 0, 0, 32, 1, '#557a3a'); R(c, 0, 30, 32, 2, '#3d5a2a'); R(c, 0, 31, 32, 1, '#2c4420');
    for (let x = 1; x < 32; x += 4) { P(c, x, 1, '#4a6c34'); P(c, x + 2, 30, '#4a6c34'); }
  },
});
defineTile('exit_mat', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a2a2a'); R(c, 1, 1, 14, 14, '#a83a3a');
    for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, '#c25050');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#7a2a2a'); R(c, 0, 0, 32, 1, '#8e3434');
    R(c, 2, 2, 28, 28, '#a83a3a');
    for (let y = 5; y < 29; y += 4) { R(c, 4, y, 24, 1, '#c25050'); R(c, 4, y + 1, 24, 1, '#922f2f'); }
    R(c, 2, 2, 28, 1, '#b84646'); R(c, 2, 29, 28, 1, '#8a2e2e');
  },
});
defineTile('stairs_up', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#9a9ca2');
    for (let i = 0; i < 4; i++) { R(c, 0, i * 4, 16, 3, shade('#c8cad0', -i * 0.08)); R(c, 0, i * 4 + 3, 16, 1, '#6d7078'); }
  },
  hd(c) {
    for (let i = 0; i < 4; i++) {
      const col = shade('#c8cad0', -i * 0.08), y = i * 8;
      R(c, 0, y, 32, 6, col); R(c, 0, y, 32, 1, shade(col, 0.45)); R(c, 0, y + 1, 32, 1, shade(col, 0.2));
      R(c, 0, y + 5, 32, 1, shade(col, -0.08)); R(c, 0, y + 6, 32, 1, '#8a8d95'); R(c, 0, y + 7, 32, 1, '#6d7078');
    }
  },
});
defineTile('stairs_down', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a4c54');
    for (let i = 0; i < 4; i++) { R(c, 0, i * 4, 16, 3, shade('#9a9ca2', -(3 - i) * 0.12)); R(c, 0, i * 4 + 3, 16, 1, '#2a2c32'); }
  },
  hd(c) {
    for (let i = 0; i < 4; i++) {
      const col = shade('#9a9ca2', -(3 - i) * 0.12), y = i * 8;
      R(c, 0, y, 32, 6, col); R(c, 0, y, 32, 1, shade(col, 0.35)); R(c, 0, y + 1, 32, 1, shade(col, 0.15));
      R(c, 0, y + 5, 32, 1, shade(col, -0.1)); R(c, 0, y + 6, 32, 2, '#2a2c32');
    }
  },
});

// ---------------------------------------------------------------- walls (themed)
export const WALL_THEMES = {
  white: '#e9e5dc', cream: '#efe2bf', blue: '#86aee0', navy: '#3d4f86', gray: '#a3a6ad',
  red: '#c25050', purple: '#9273bd', wood: '#a87449', dark: '#454559', orange: '#e9935a',
  green: '#86b882', pink: '#eeb0c3', black: '#26262e', yellow: '#ecd66a', brick: '#a85a42',
};
// Wall face (2x): lit top lip, theme texture (brick courses, wood boards or
// wallpaper with a picture rail) and a skirting board; tiles seamlessly.
function wallHD(c, r, name, col) {
  R(c, 0, 0, 32, 32, col);
  if (name === 'brick') {
    for (let row = 0; row < 3; row++) {
      const y = 2 + row * 8, off = row % 2 ? 8 : 0;
      for (let x = off; x < off + 32; x += 16) {
        const b = shade(col, [0, -0.05, 0.04, -0.02][RND(r, 4)]);
        Rw(c, x + 1, y, 15, 7, b); Rw(c, x + 1, y, 15, 1, shade(b, 0.15)); Rw(c, x + 1, y + 6, 15, 1, shade(b, -0.1));
        Pw(c, x + 3 + RND(r, 11), y + 2 + RND(r, 3), shade(b, -0.08));
      }
      R(c, 0, y + 7, 32, 1, shade(col, -0.3));
      for (let x = off; x < off + 32; x += 16) Rw(c, x, y, 1, 7, shade(col, -0.3));
    }
  } else if (name === 'wood') {
    for (let x = 0; x < 32; x += 8) {
      R(c, x, 2, 1, 24, shade(col, 0.1)); R(c, x + 6, 2, 1, 24, shade(col, -0.08)); R(c, x + 7, 2, 1, 24, shade(col, -0.22));
      for (let i = 0; i < 3; i++) R(c, x + 2 + RND(r, 4), 3 + RND(r, 18), 1, 3 + RND(r, 5), shade(col, -0.07));
    }
  } else {
    for (let x = 3; x < 32; x += 8) R(c, x, 10, 1, 16, shade(col, -0.035));
    R(c, 0, 8, 32, 1, shade(col, -0.1)); R(c, 0, 9, 32, 1, shade(col, 0.12));
  }
  // top: the front edge of the wall top above (v1 drew it on the wall-top tile,
  // which striped long wall-top runs), then the lit lip of the wall face
  R(c, 0, 0, 32, 1, shade(col, -0.22)); R(c, 0, 1, 32, 1, shade(col, 0.32));
  R(c, 0, 26, 32, 6, shade(col, -0.3));
  R(c, 0, 26, 32, 1, shade(col, -0.48)); R(c, 0, 27, 32, 1, shade(col, -0.18));
  R(c, 0, 31, 32, 1, shade(col, -0.42));
}
for (const [name, col] of Object.entries(WALL_THEMES)) {
  defineTile('wall_' + name, {
    solid: true,
    draw(c, r) {
      R(c, 0, 0, 16, 16, col);
      R(c, 0, 0, 16, 1, shade(col, 0.25));
      if (name === 'brick') {
        for (let row = 0; row < 3; row++) {
          const off = row % 2 ? 4 : 0;
          for (let x = -4; x < 16; x += 8) R(c, x + off, 1 + row * 4 + 3, 8, 1, shade(col, -0.25));
          for (let x = -4; x < 16; x += 8) R(c, x + off, 1 + row * 4, 1, 4, shade(col, -0.25));
        }
      } else if (name === 'wood') {
        for (let x = 3; x < 16; x += 4) R(c, x, 1, 1, 12, shade(col, -0.15));
      } else {
        R(c, 0, 4, 16, 1, shade(col, -0.05));
      }
      R(c, 0, 13, 16, 3, shade(col, -0.3));
      R(c, 0, 13, 16, 1, shade(col, -0.45));
    },
    hd(c, r) { wallHD(c, r, name, col); },
  });
  defineTile('walltop_' + name, {
    solid: true,
    draw(c) {
      const d = shade(col, -0.6);
      R(c, 0, 0, 16, 16, d);
      R(c, 0, 15, 16, 1, shade(col, -0.2));
      R(c, 0, 0, 16, 1, shade(d, 0.1));
    },
    // Flat top surface with no per-tile lip: wall tops are stacked in long runs
    // (room borders, thick walls), and any edge line drawn per tile shows as a
    // stripe every 16 units. The edge toward a wall face comes from the wall
    // tile's own lit top lip.
    hd(c) { R(c, 0, 0, 32, 32, shade(col, -0.6)); },
  });
}

// ---------------------------------------------------------------- wall decorations (obj overlays on walls)
function windowHD(c, glass, night) {
  R(c, 3, 3, 26, 21, '#f4f4f4'); R(c, 3, 3, 26, 1, '#ffffff'); R(c, 28, 4, 1, 20, '#c8c8c8');
  R(c, 5, 5, 22, 17, glass);
  if (!night) {
    R(c, 5, 5, 22, 3, shade(glass, 0.35));
    for (const [x, y] of [[7, 13], [8, 12], [9, 11], [10, 10], [11, 9]]) { P(c, x, y, '#e6f6ff'); P(c, x + 1, y, '#c8ecff'); }
    for (const [x, y] of [[19, 19], [20, 18], [21, 17], [22, 16]]) P(c, x, y, '#c8ecff');
    R(c, 5, 20, 22, 2, shade(glass, -0.1));
  } else {
    R(c, 5, 18, 22, 4, '#2a3468'); R(c, 7, 17, 4, 1, '#2a3468'); R(c, 18, 16, 6, 2, '#2a3468');
    P(c, 9, 7, '#ffffff'); P(c, 23, 11, '#ffe36e'); P(c, 13, 13, '#c8d4ff'); P(c, 20, 6, '#ffffff');
    P(c, 8, 19, '#ffe36e'); P(c, 20, 18, '#ffe36e'); P(c, 22, 19, '#ffe36e');
  }
  R(c, 15, 5, 2, 17, '#f4f4f4'); R(c, 16, 5, 1, 17, '#d8d8d8');
  R(c, 5, 13, 22, 2, '#f4f4f4'); R(c, 5, 14, 22, 1, '#d8d8d8');
  R(c, 2, 24, 28, 2, '#d8d8d8'); R(c, 2, 24, 28, 1, '#ffffff'); R(c, 2, 26, 28, 1, '#9a9a9a');
  outline(c);
}
defineTile('window', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 10, '#f4f4f4'); R(c, 3, 3, 10, 8, '#8fd0ff');
    R(c, 3, 3, 4, 2, '#c8ecff'); R(c, 8, 3, 1, 8, '#f4f4f4'); R(c, 3, 7, 10, 1, '#f4f4f4');
    R(c, 2, 12, 12, 1, '#b8b8b8');
  },
  hd(c) { windowHD(c, '#8fd0ff', false); },
});
defineTile('window_night', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 10, '#f4f4f4'); R(c, 3, 3, 10, 8, '#1d2650');
    P(c, 5, 4, '#fff'); P(c, 11, 6, '#ffe36e'); R(c, 8, 3, 1, 8, '#f4f4f4'); R(c, 3, 7, 10, 1, '#f4f4f4');
  },
  hd(c) { windowHD(c, '#1d2650', true); },
});
defineTile('poster', {
  solid: true, obj: true, variants: 4,
  draw(c, r, f, v) {
    const bg = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ff8a3d'][v];
    R(c, 4, 1, 8, 11, '#20232a'); R(c, 4, 1, 8, 10, bg);
    disc(c, 8, 5, 2, v % 2 ? '#ffffff' : '#d62f2f');
    R(c, 5, 8, 6, 1, '#20232a'); R(c, 5, 10, 4, 1, '#20232a');
  },
  // a show poster: performer silhouette, title lines, a sparkle
  hd(c, r, f, v) {
    const bg = ['#ffd23f', '#ff7eb6', '#5fd7ff', '#ff8a3d'][v];
    const fg = v % 2 ? '#ffffff' : '#d62f2f';
    R(c, 8, 2, 16, 21, bg); R(c, 8, 2, 16, 1, shade(bg, 0.4)); R(c, 23, 3, 1, 20, shade(bg, -0.15));
    R(c, 9, 3, 14, 2, shade(bg, -0.1));
    const fs = shade(fg, -0.2);
    oval(c, 13, 5, 6, 6, fg); P(c, 14, 6, shade(fg, v % 2 ? -0.05 : 0.35)); R(c, 17, 7, 1, 3, fs);
    R(c, 15, 11, 2, 1, fs);
    R(c, 12, 12, 8, 1, fg); R(c, 11, 13, 10, 4, fg); R(c, 19, 13, 2, 4, fs); R(c, 15, 13, 2, 3, shade(bg, 0.5));
    R(c, 11, 17, 10, 1, shade(bg, -0.25));
    R(c, 10, 18, 12, 1, '#20232a'); R(c, 10, 20, 8, 1, '#20232a');
    P(c, 21, 5, '#ffffff'); P(c, 20, 6, '#ffffff'); P(c, 22, 6, '#ffffff'); P(c, 21, 7, '#ffffff');
    R(c, 8, 23, 16, 1, '#20232a');
    outline(c);
  },
});
defineTile('poster_wide', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    const bg = ['#2f6fd0', '#d62f2f', '#2f9a4a'][v];
    R(c, 1, 2, 14, 9, '#ffffff'); R(c, 2, 3, 12, 7, bg);
    R(c, 3, 4, 3, 3, '#ffd23f'); R(c, 7, 4, 6, 1, '#fff'); R(c, 7, 6, 5, 1, '#fff'); R(c, 7, 8, 6, 1, '#fff');
  },
  hd(c, r, f, v) {
    const bg = ['#2f6fd0', '#d62f2f', '#2f9a4a'][v];
    R(c, 2, 4, 28, 18, '#ffffff'); R(c, 2, 21, 28, 1, '#d5d9e0');
    R(c, 4, 6, 24, 14, bg); R(c, 4, 6, 24, 1, shade(bg, -0.25)); R(c, 4, 19, 24, 1, shade(bg, 0.15));
    R(c, 6, 8, 6, 6, '#ffd23f'); R(c, 6, 8, 6, 1, '#ffe98a'); R(c, 11, 9, 1, 5, '#e0b020');
    P(c, 8, 10, '#d62f2f'); P(c, 9, 10, '#d62f2f'); P(c, 8, 11, '#d62f2f'); P(c, 9, 11, '#d62f2f');
    R(c, 14, 8, 12, 2, '#ffffff'); R(c, 14, 12, 10, 1, '#ffffff'); R(c, 14, 15, 12, 1, '#ffffff'); R(c, 6, 16, 6, 1, shade(bg, 0.5));
    outline(c);
  },
});
defineTile('clock', {
  solid: true, obj: true,
  draw(c) { disc(c, 8, 6, 4, '#20232a'); disc(c, 8, 6, 3, '#ffffff'); R(c, 8, 4, 1, 3, '#20232a'); R(c, 8, 6, 2, 1, '#d62f2f'); },
  hd(c) {
    oval(c, 7, 3, 18, 18, '#3b3f48'); oval(c, 8, 4, 16, 16, '#5a5f6b');
    oval(c, 9, 5, 14, 14, '#ffffff'); oval(c, 10, 6, 12, 12, '#f6f6f8');
    for (const [x, y] of [[15, 6], [16, 6], [21, 11], [21, 12], [15, 17], [16, 17], [10, 11], [10, 12]]) P(c, x, y, '#5a5f6b');
    R(c, 15, 8, 2, 4, '#20232a'); R(c, 16, 12, 4, 1, '#d62f2f'); R(c, 15, 11, 2, 2, '#20232a');
    P(c, 11, 8, '#ffffff');
    outline(c);
  },
});
defineTile('painting', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 9, '#c9a227'); R(c, 3, 3, 10, 7, '#8fd0ff');
    R(c, 3, 7, 10, 3, '#4a9a4a'); disc(c, 10, 5, 1, '#ffd23f'); R(c, 5, 5, 3, 2, '#ffffff');
  },
  hd(c) {
    bevel(c, 4, 4, 24, 18, '#c9a227', '#f0d060', '#8e7018');
    R(c, 5, 5, 22, 1, '#e8c43a');
    // the landscape is clipped to the picture so the hills never paint over the frame
    c.save(); c.beginPath(); c.rect(6, 6, 20, 14); c.clip();
    R(c, 6, 6, 20, 14, '#8fd0ff'); R(c, 6, 6, 20, 3, '#b8e2ff');
    oval(c, 3, 13, 15, 10, '#4a9a4a'); oval(c, 14, 14, 15, 9, '#3f8a3a');
    R(c, 6, 18, 20, 2, '#3f8a3a'); P(c, 9, 14, '#6cbc5c'); P(c, 10, 14, '#6cbc5c'); P(c, 19, 15, '#4a9a4a');
    oval(c, 19, 8, 4, 4, '#ffd23f'); P(c, 20, 8, '#fff6a8');
    R(c, 9, 10, 5, 2, '#ffffff'); R(c, 10, 9, 2, 1, '#ffffff');
    R(c, 6, 6, 20, 1, '#7fb8d8'); R(c, 6, 7, 1, 13, '#7fb8d8');
    c.restore();
    outline(c);
  },
});
defineTile('whiteboard', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 10, '#9aa0aa'); R(c, 2, 3, 12, 8, '#ffffff');
    R(c, 3, 4, 7, 1, '#2f6fd0'); R(c, 3, 6, 9, 1, '#20232a'); R(c, 3, 8, 5, 1, '#d62f2f'); R(c, 2, 11, 12, 1, '#6d7078');
  },
  hd(c) {
    bevel(c, 2, 4, 28, 19, '#b8bec8', '#e4e7ec', '#7d8391');
    R(c, 4, 6, 24, 15, '#ffffff'); R(c, 4, 6, 24, 1, '#e8ecf2'); R(c, 4, 7, 1, 14, '#eef1f5');
    R(c, 6, 8, 14, 1, '#2f6fd0'); R(c, 6, 9, 3, 1, '#2f6fd0');
    R(c, 6, 12, 18, 1, '#20232a'); R(c, 6, 14, 12, 1, '#20232a');
    R(c, 6, 17, 10, 1, '#d62f2f'); oval(c, 20, 15, 6, 5, '#d62f2f'); oval(c, 21, 16, 4, 3, '#ffffff');
    R(c, 4, 23, 24, 2, '#7d8391'); R(c, 4, 23, 24, 1, '#9aa0aa');
    R(c, 8, 22, 4, 1, '#2f6fd0'); R(c, 14, 22, 4, 1, '#d62f2f'); R(c, 20, 22, 3, 1, '#20232a');
    outline(c);
  },
});
defineTile('mirror', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 1, 14, 12, '#c9a227'); R(c, 3, 3, 10, 8, '#cfe8f5'); R(c, 4, 4, 3, 1, '#ffffff'); R(c, 4, 5, 1, 2, '#ffffff');
    for (const [x, y] of [[2, 2], [7, 1], [13, 2], [1, 7], [14, 7], [2, 12], [13, 12]]) R(c, x, y, 1, 1, '#fff6a8');
  },
  // dressing-room mirror ringed with bulbs
  hd(c) {
    bevel(c, 2, 2, 28, 24, '#c9a227', '#e8c43a', '#8e7018');
    R(c, 6, 6, 20, 16, '#cfe8f5'); R(c, 6, 6, 20, 1, '#a8c8da'); R(c, 6, 7, 1, 15, '#a8c8da');
    R(c, 8, 8, 6, 1, '#ffffff'); R(c, 8, 9, 1, 4, '#ffffff'); R(c, 10, 10, 1, 1, '#ffffff');
    for (const [x, y] of [[20, 18], [21, 17], [22, 16], [23, 15]]) P(c, x, y, '#eef8ff');
    for (const [x, y] of [[4, 4], [11, 3], [19, 3], [26, 4], [3, 11], [27, 11], [3, 18], [27, 18], [4, 23], [26, 23], [15, 23]]) {
      R(c, x - 1, y - 1, 3, 3, '#fff6a8'); P(c, x - 1, y - 1, '#ffffff'); P(c, x + 1, y + 1, '#e8c43a');
    }
    outline(c);
  },
});
// "ON AIR" in a 5px pixel font (the N is 4px wide so it does not read as H)
const ONAIR = [
  '###.#..#..###.#.##.',
  '#.#.##.#..#.#.#.#.#',
  '#.#.#.##..###.#.##.',
  '#.#.#..#..#.#.#.#.#',
  '###.#..#..#.#.#.#.#',
];
defineTile('onair', {
  solid: true, obj: true, frames: 2, speed: 40,
  draw(c, r, f) {
    R(c, 2, 4, 12, 6, '#20232a'); R(c, 3, 5, 10, 4, f ? '#ff2b3a' : '#7a1f1f');
    if (f) { R(c, 4, 6, 2, 2, '#ffd0d4'); R(c, 7, 6, 2, 2, '#ffd0d4'); R(c, 10, 6, 2, 2, '#ffd0d4'); }
  },
  hd(c, r, f) {
    R(c, 3, 7, 25, 13, '#20232a'); R(c, 3, 7, 25, 1, '#3b3f48');
    R(c, 5, 9, 21, 9, f ? '#ff2b3a' : '#6a1a1f'); R(c, 5, 9, 21, 1, f ? '#ff6670' : '#7a2229');
    pix(c, ONAIR, { '#': f ? '#ffe0e3' : '#9a3a42' }, 6, 11);
    R(c, 14, 4, 3, 3, '#3b3f48'); P(c, 14, 4, '#5a5f6b');
    outline(c);
  },
});
const RUNNER = ['....##..', '....##..', '..####..', '.#.##.#.', '...###..', '..#..#..', '.#....#.', '#.....#.'];
defineTile('exit_sign', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 7, '#1fa35a'); R(c, 3, 3, 10, 5, '#2fd07a');
    R(c, 5, 3, 2, 2, '#ffffff'); R(c, 5, 5, 3, 1, '#ffffff'); R(c, 4, 6, 2, 1, '#ffffff'); R(c, 7, 6, 1, 2, '#ffffff'); R(c, 10, 3, 2, 5, '#20232a');
  },
  hd(c) {
    R(c, 4, 4, 24, 14, '#1fa35a'); R(c, 6, 6, 20, 10, '#2fd07a'); R(c, 6, 6, 20, 1, '#6ee8a4');
    pix(c, RUNNER, { '#': '#ffffff' }, 8, 7);
    R(c, 19, 7, 5, 8, '#20232a'); R(c, 20, 8, 3, 6, '#1a6a3e'); P(c, 22, 11, '#2fd07a');
    outline(c);
  },
});
function screenArt(c, x, y, w, h, f) {
  const scr = [['#5fd7ff', '#ffd23f', '#ffffff'], ['#ff7eb6', '#5ee07a', '#ffe0ef'], ['#f4f4f4', '#ff8a3d', '#ffffff']][f];
  R(c, x, y, w, h, scr[0]);
  // faint scanlines on the picture background only (drawn first so they never
  // cut through the on-screen shape)
  for (let yy = y + 1; yy < y + h - 4; yy += 3) R(c, x, yy, w, 1, shade(scr[0], -0.05));
  R(c, x, y + h - 4, w, 4, shade(scr[0], -0.18)); R(c, x, y + h - 4, w, 1, shade(scr[0], -0.1));
  oval(c, x + 4 + f * 4, y + 3, 8, 8, shade(scr[1], -0.2)); oval(c, x + 4 + f * 4, y + 3, 7, 7, scr[1]);
  P(c, x + 6 + f * 4, y + 5, shade(scr[1], 0.5)); P(c, x + 7 + f * 4, y + 4, shade(scr[1], 0.5));
  R(c, x + 1, y + 1, 4, 1, scr[2]); R(c, x + 1, y + 2, 2, 1, scr[2]);
}
defineTile('tv_wall', {
  solid: true, obj: true, frames: 3, speed: 24,
  draw(c, r, f) {
    R(c, 1, 2, 14, 10, '#20232a');
    const scr = [['#5fd7ff', '#ffd23f'], ['#ff7eb6', '#5ee07a'], ['#ffffff', '#ff8a3d']][f];
    R(c, 2, 3, 12, 8, scr[0]); R(c, 4 + f * 2, 5, 4, 4, scr[1]);
    R(c, 6, 12, 4, 1, '#4a4e58');
  },
  hd(c, r, f) {
    R(c, 2, 4, 28, 20, '#20232a'); R(c, 2, 4, 28, 1, '#3b3f48');
    screenArt(c, 4, 6, 24, 16, f);
    R(c, 12, 24, 8, 2, '#4a4e58'); R(c, 12, 24, 8, 1, '#5f6470'); P(c, 27, 23, '#5ee07a');
    outline(c);
  },
});
defineTile('shelf_wall', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 5, 14, 1, '#6e4428'); R(c, 1, 11, 14, 1, '#6e4428');
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd'];
    for (let i = 0; i < 5; i++) { R(c, 2 + i * 3, 1, 2, 4, cols[i]); R(c, 2 + i * 3, 7, 2, 4, cols[4 - i]); }
  },
  hd(c) {
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd'];
    for (const [y, o] of [[2, 0], [14, 1]]) {
      for (let i = 0; i < 5; i++) {
        const col = cols[o ? 4 - i : i], x = 4 + i * 5 + (i > 2 ? 1 : 0), h = 8 - ((i + o) % 3);
        R(c, x, y + 8 - h, 4, h, col); R(c, x, y + 8 - h, 1, h, shade(col, 0.3)); R(c, x + 3, y + 8 - h, 1, h, shade(col, -0.25));
        R(c, x + 1, y + 10 - h, 2, 1, shade(col, 0.5));
      }
      R(c, 2, y + 8, 28, 2, '#8a5a33'); R(c, 2, y + 8, 28, 1, '#b07a46'); R(c, 2, y + 10, 28, 1, '#5a3a20');
      R(c, 5, y + 11, 2, 2, '#5a3a20'); R(c, 25, y + 11, 2, 2, '#5a3a20');
    }
    outline(c);
  },
});

// ---------------------------------------------------------------- doors
defineTile('door_wood', {
  draw(c) {
    R(c, 1, 0, 14, 16, '#5a3a20'); R(c, 2, 1, 12, 15, '#9b6638'); R(c, 3, 2, 10, 5, '#a8733f'); R(c, 3, 9, 10, 6, '#a8733f');
    R(c, 11, 8, 2, 2, '#ffd23f');
  },
  hd(c, r) {
    R(c, 2, 0, 28, 32, '#5a3a20'); R(c, 2, 0, 1, 32, '#3e2814'); R(c, 29, 0, 1, 32, '#3e2814'); R(c, 3, 0, 26, 1, '#6e4a2a');
    R(c, 4, 2, 24, 30, '#9b6638'); R(c, 4, 2, 24, 1, '#b07a46'); R(c, 4, 3, 1, 29, '#ad7642');
    inset(c, 6, 4, 20, 10, '#a8733f', '#bf8a52', '#7e5028');
    inset(c, 6, 18, 20, 12, '#a8733f', '#bf8a52', '#7e5028');
    grain(c, r, 8, 6, 16, 7, '#9b6638', 3, 6); grain(c, r, 8, 20, 16, 9, '#9b6638', 3, 6);
    R(c, 21, 15, 5, 2, '#c9a227'); R(c, 21, 15, 3, 1, '#ffe36e'); R(c, 22, 17, 2, 1, '#8e7018');
  },
});
defineTile('door_glass', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7d8391'); R(c, 1, 1, 7, 15, '#a8dcf5'); R(c, 8, 1, 7, 15, '#a8dcf5');
    R(c, 2, 2, 2, 6, '#e0f4ff'); R(c, 9, 2, 2, 6, '#e0f4ff'); R(c, 7, 1, 2, 15, '#5a5f6b');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#7d8391'); R(c, 0, 0, 32, 1, '#9aa0aa'); R(c, 0, 1, 1, 31, '#9aa0aa');
    for (const x of [2, 17]) {
      R(c, x, 2, 13, 30, '#a8dcf5'); R(c, x, 2, 13, 1, '#7fb8d8');
      for (let k = 0; k < 6; k++) { P(c, x + 2 + k, 12 - k, '#e0f4ff'); P(c, x + 3 + k, 12 - k, '#e0f4ff'); }
      for (let k = 0; k < 4; k++) P(c, x + 6 + k, 20 - k, '#d0eeff');
      R(c, x, 27, 13, 5, '#94cbe6');
    }
    R(c, 15, 2, 2, 30, '#5a5f6b'); R(c, 15, 2, 1, 30, '#6d7380');
    R(c, 12, 14, 1, 6, '#d5d9e0'); R(c, 19, 14, 1, 6, '#d5d9e0');
    R(c, 2, 16, 13, 1, '#7fb8d8'); R(c, 17, 16, 13, 1, '#7fb8d8');
  },
});
defineTile('door_metal', {
  draw(c) {
    R(c, 1, 0, 14, 16, '#3b3f48'); R(c, 2, 1, 12, 15, '#8d939e'); R(c, 2, 1, 12, 1, '#b8bec8');
    R(c, 4, 4, 8, 3, '#5a5f6b'); R(c, 11, 9, 2, 2, '#20232a');
  },
  hd(c) {
    R(c, 2, 0, 28, 32, '#3b3f48');
    R(c, 4, 2, 24, 30, '#8d939e'); R(c, 4, 2, 24, 1, '#b8bec8'); R(c, 4, 3, 1, 29, '#a3a9b3'); R(c, 27, 3, 1, 29, '#6d7380');
    inset(c, 8, 7, 16, 6, '#5a5f6b', '#9aa0aa', '#3b3f48'); R(c, 9, 8, 6, 1, '#7d8391');
    R(c, 20, 17, 5, 3, '#20232a'); R(c, 21, 17, 3, 1, '#4a4e58'); R(c, 6, 17, 14, 2, '#c0c4cc'); R(c, 6, 18, 14, 1, '#6d7380');
    for (const y of [4, 28]) { P(c, 6, y, '#6d7380'); P(c, 25, y, '#6d7380'); }
  },
});
defineTile('elevator', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a5f6b'); R(c, 1, 2, 14, 14, '#b8bec8'); R(c, 7, 2, 2, 14, '#7d8391');
    R(c, 6, 0, 4, 2, '#ffd23f');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#5a5f6b'); R(c, 0, 0, 32, 1, '#7d8391');
    R(c, 2, 4, 28, 28, '#b8bec8');
    for (const x of [2, 17]) { R(c, x, 4, 13, 1, '#d5d9e0'); R(c, x, 5, 1, 27, '#d5d9e0'); R(c, x + 5, 8, 1, 22, '#c8cdd5'); R(c, x + 9, 6, 1, 24, '#a3a9b3'); }
    R(c, 15, 4, 2, 28, '#7d8391'); R(c, 15, 4, 1, 28, '#6d7380');
    R(c, 11, 1, 10, 3, '#3b3f48'); R(c, 13, 1, 6, 2, '#ffd23f'); R(c, 13, 1, 6, 1, '#fff6a8');
  },
});
defineTile('shutter', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#8d939e'); for (let y = 1; y < 16; y += 2) R(c, 0, y, 16, 1, '#6d7380'); },
  hd(c) {
    R(c, 0, 0, 32, 32, '#8d939e');
    for (let y = 0; y < 32; y += 4) { R(c, 0, y, 32, 1, '#a8aeb8'); R(c, 0, y + 2, 32, 1, '#7d8391'); R(c, 0, y + 3, 32, 1, '#5e636d'); }
  },
});

// ---------------------------------------------------------------- furniture (obj)
// Counter body shared by counter / register: light top with a front lip, dark
// front with a recessed panel per tile (reads as cabinet doors when tiled).
function counterHD(c, top, front, edge, panel) {
  R(c, 0, 2, 32, 14, top); R(c, 0, 2, 32, 1, shade(top, 0.5)); R(c, 0, 3, 32, 1, shade(top, 0.25));
  R(c, 0, 8, 32, 1, shade(top, -0.03)); R(c, 0, 13, 32, 1, shade(top, 0.12)); R(c, 0, 14, 32, 2, shade(top, -0.12));
  R(c, 0, 16, 32, 16, front); R(c, 0, 16, 32, 2, edge); R(c, 0, 30, 32, 2, shade(front, -0.35));
  if (panel) inset(c, 4, 20, 24, 8, front, shade(front, 0.15), shade(front, -0.2));
}
defineTile('counter', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#e2cfa8'); R(c, 0, 1, 16, 1, '#f2e2c0');
    R(c, 0, 8, 16, 8, '#8f6a48'); R(c, 0, 8, 16, 1, '#6e4f34'); R(c, 0, 15, 16, 1, '#5a3f28');
    R(c, 3, 10, 10, 1, '#a07a56');
  },
  hd(c) { counterHD(c, '#e2cfa8', '#8f6a48', '#6e4f34', true); outline(c); },
});
defineTile('counter_white', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#f6f6f8'); R(c, 0, 1, 16, 1, '#ffffff');
    R(c, 0, 8, 16, 8, '#3f5fa8'); R(c, 0, 8, 16, 1, '#2c4683'); R(c, 0, 12, 16, 1, '#6d8bd0'); R(c, 0, 15, 16, 1, '#223566');
  },
  hd(c) {
    counterHD(c, '#f6f6f8', '#3f5fa8', '#2c4683', false);
    R(c, 0, 23, 32, 2, '#6d8bd0'); R(c, 0, 23, 32, 1, '#8aa4e0');
    outline(c);
  },
});
defineTile('register', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 1, 16, 7, '#e2cfa8'); R(c, 0, 8, 16, 8, '#8f6a48'); R(c, 0, 8, 16, 1, '#6e4f34');
    R(c, 3, 0, 9, 6, '#3b3f48'); R(c, 4, 1, 7, 2, '#5ee07a'); R(c, 4, 4, 7, 1, '#9aa0aa');
  },
  hd(c) {
    counterHD(c, '#e2cfa8', '#8f6a48', '#6e4f34', true);
    R(c, 6, 0, 18, 12, '#3b3f48'); R(c, 6, 0, 18, 1, '#5a5f6b'); R(c, 6, 1, 1, 11, '#4a4e58'); R(c, 6, 11, 18, 1, '#2a2d36');
    R(c, 8, 2, 14, 4, '#5ee07a'); R(c, 8, 2, 14, 1, '#9af0b0'); R(c, 15, 3, 1, 2, '#2f9a4a'); R(c, 17, 3, 1, 2, '#2f9a4a'); R(c, 19, 3, 2, 2, '#2f9a4a');
    for (let y = 7; y < 11; y += 2) for (let x = 8; x < 22; x += 3) R(c, x, y, 2, 1, x > 18 ? '#ff9a3c' : '#c0c4cc');
    R(c, 4, 12, 22, 3, '#2a2d36'); R(c, 4, 12, 22, 1, '#4a4e58');
    outline(c);
  },
});
function deskTop(c, r, y, h) {
  R(c, 0, y, 32, h, '#b98552'); R(c, 0, y, 32, 1, '#d6a06a'); R(c, 0, y + 1, 32, 1, '#c8935e');
  grain(c, r, 1, y + 2, 30, h - 3, '#ad7a48', 6, 8);
  R(c, 0, y + h, 32, 6, '#8a5a33'); R(c, 0, y + h, 32, 1, '#6e4428'); R(c, 0, y + h + 5, 32, 1, '#5a3a20');
  for (const x of [6, 22]) { R(c, x, y + h + 2, 4, 1, '#d6a06a'); P(c, x + 3, y + h + 2, '#b98552'); }
  for (const x of [2, 26]) { R(c, x, y + h + 6, 4, 4, '#5a3a20'); R(c, x, y + h + 6, 1, 4, '#6e4428'); }
}
defineTile('desk', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 2, 16, 8, '#b98552'); R(c, 0, 2, 16, 1, '#d6a06a'); R(c, 0, 10, 16, 3, '#8a5a33');
    R(c, 1, 13, 2, 2, '#5a3a20'); R(c, 13, 13, 2, 2, '#5a3a20');
    R(c, 3, 4, 5, 3, '#ffffff'); R(c, 4, 5, 3, 1, '#9aa0aa');
  },
  hd(c, r) {
    shadowEllipse(c, 16, 29, 15, 2);
    deskTop(c, r, 4, 16);
    R(c, 5, 8, 11, 7, '#ffffff'); R(c, 5, 14, 11, 1, '#d5d9e0'); R(c, 15, 9, 1, 6, '#e4e7ec');
    R(c, 7, 10, 7, 1, '#9aa0aa'); R(c, 7, 12, 5, 1, '#9aa0aa');
    line(c, 19, 13, 24, 9, '#2f6fd0'); P(c, 19, 13, '#20232a');
    R(c, 25, 7, 4, 5, '#ffffff'); R(c, 25, 7, 4, 1, '#ffd23f');
    outline(c);
  },
});
defineTile('desk_pc', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 4, 16, 6, '#b98552'); R(c, 0, 4, 16, 1, '#d6a06a'); R(c, 0, 10, 16, 3, '#8a5a33');
    R(c, 4, 0, 8, 6, '#20232a'); R(c, 5, 1, 6, 4, '#5fd7ff'); R(c, 6, 2, 2, 1, '#ffffff'); R(c, 7, 6, 2, 1, '#20232a');
    R(c, 4, 7, 8, 2, '#d5d9e0');
  },
  hd(c, r) {
    shadowEllipse(c, 16, 29, 15, 2);
    deskTop(c, r, 8, 12);
    R(c, 8, 0, 16, 12, '#20232a'); R(c, 8, 0, 16, 1, '#3b3f48');
    R(c, 10, 2, 12, 8, '#5fd7ff'); R(c, 10, 2, 12, 1, '#a8ecff'); R(c, 11, 4, 5, 1, '#ffffff'); R(c, 11, 6, 8, 1, '#2f8ab8'); R(c, 11, 8, 6, 1, '#2f8ab8');
    R(c, 14, 12, 4, 2, '#3b3f48');
    R(c, 8, 14, 16, 4, '#d5d9e0'); R(c, 8, 14, 16, 1, '#f0f2f5'); R(c, 8, 17, 16, 1, '#9aa0aa');
    for (let x = 9; x < 23; x += 2) P(c, x, 15, '#9aa0aa');
    R(c, 26, 14, 3, 4, '#d5d9e0'); P(c, 27, 14, '#ffffff');
    outline(c);
  },
});
defineTile('chair', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 4, 1);
    R(c, 4, 2, 8, 6, '#3b3f48'); R(c, 5, 3, 6, 4, '#5a5f6b');
    R(c, 4, 8, 8, 4, '#4a4e58'); R(c, 7, 12, 2, 2, '#20232a'); R(c, 5, 14, 6, 1, '#20232a');
  },
  hd(c) {
    shadowEllipse(c, 16, 29, 9, 2);
    R(c, 9, 4, 14, 12, '#3b3f48'); R(c, 8, 5, 16, 10, '#3b3f48');
    R(c, 10, 6, 12, 8, '#5a5f6b'); R(c, 10, 6, 12, 1, '#7d8391'); R(c, 10, 7, 1, 7, '#6b707c'); R(c, 21, 7, 1, 7, '#4a4e58');
    R(c, 8, 16, 16, 8, '#4a4e58'); R(c, 8, 16, 16, 2, '#6b707c'); R(c, 8, 23, 16, 1, '#2e3138');
    R(c, 14, 24, 4, 4, '#20232a'); R(c, 15, 24, 1, 4, '#4a4e58');
    R(c, 9, 28, 14, 2, '#20232a'); R(c, 9, 28, 14, 1, '#3b3f48');
    for (const x of [8, 15, 23]) R(c, x, 30, 2, 1, '#20232a');
    outline(c);
  },
});
defineTile('seat', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 8, '#9e1f2a'); R(c, 2, 3, 12, 6, '#c8323f'); R(c, 2, 3, 12, 1, '#e05462');
    R(c, 1, 10, 14, 4, '#7a1520'); R(c, 0, 4, 1, 10, '#3b2a20'); R(c, 15, 4, 1, 10, '#3b2a20');
  },
  // theatre seat: tufted back, folded seat cushion, wooden armrests
  hd(c) {
    R(c, 2, 4, 28, 16, '#9e1f2a'); R(c, 3, 3, 26, 1, '#9e1f2a');
    R(c, 4, 5, 24, 13, '#c8323f'); R(c, 4, 5, 24, 2, '#e05462'); R(c, 4, 7, 1, 11, '#d84452'); R(c, 27, 7, 1, 11, '#a82634');
    for (const x of [12, 20]) R(c, x, 8, 1, 9, '#a82634');
    R(c, 3, 20, 26, 8, '#7a1520'); R(c, 3, 20, 26, 2, '#9e1f2a'); R(c, 3, 27, 26, 1, '#5a0f18');
    for (const x of [0, 29]) { R(c, x, 8, 3, 21, '#3b2a20'); R(c, x, 8, 3, 1, '#5e4434'); R(c, x, 9, 1, 19, '#4e3828'); }
    outline(c);
  },
});
function sofa(col) {
  return (c) => {
    shadowEllipse(c, 8, 14, 8, 1);
    R(c, 0, 2, 16, 6, shade(col, -0.25)); R(c, 0, 2, 16, 1, shade(col, 0.1));
    R(c, 0, 7, 16, 6, col); R(c, 0, 7, 16, 1, shade(col, 0.25)); R(c, 7, 7, 1, 6, shade(col, -0.2));
    R(c, 0, 13, 16, 1, shade(col, -0.45));
  };
}
function sofaHD(col) {
  return (c) => {
    shadowEllipse(c, 16, 28, 16, 2);
    const back = shade(col, -0.25);
    R(c, 0, 4, 32, 12, back); R(c, 0, 4, 32, 1, shade(col, 0.15)); R(c, 0, 5, 32, 1, shade(col, 0));
    for (const x of [8, 24]) { P(c, x, 9, shade(col, -0.45)); P(c, x, 10, shade(back, 0.12)); }
    R(c, 0, 14, 32, 12, col); R(c, 0, 14, 32, 2, shade(col, 0.28)); R(c, 0, 16, 32, 1, shade(col, 0.12));
    R(c, 14, 14, 1, 12, shade(col, -0.22)); R(c, 15, 14, 1, 12, shade(col, 0.1));
    R(c, 0, 24, 32, 2, shade(col, -0.15));
    R(c, 0, 26, 32, 2, shade(col, -0.45));
    outline(c);
  };
}
defineTile('sofa', { solid: true, obj: true, draw: sofa('#c8323f'), hd: sofaHD('#c8323f') });
defineTile('sofa_blue', { solid: true, obj: true, draw: sofa('#3a58a8'), hd: sofaHD('#3a58a8') });
defineTile('sofa_beige', { solid: true, obj: true, draw: sofa('#c9b48e'), hd: sofaHD('#c9b48e') });
function tableHD(c, top, front, leg) {
  shadowEllipse(c, 16, 28, 13, 2);
  R(c, 2, 8, 28, 14, top); R(c, 2, 8, 28, 1, shade(top, 0.3)); R(c, 2, 9, 28, 1, shade(top, 0.12)); R(c, 2, 21, 28, 1, shade(top, -0.08));
  R(c, 2, 22, 28, 4, front); R(c, 2, 22, 28, 1, shade(front, -0.2));
  for (const x of [6, 22]) { R(c, x, 26, 4, 4, leg); R(c, x, 26, 1, 4, shade(leg, 0.2)); }
}
defineTile('table', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 1, 4, 14, 7, '#c48a52'); R(c, 1, 4, 14, 1, '#dca26a'); R(c, 1, 11, 14, 2, '#8a5a33');
    R(c, 3, 13, 2, 2, '#5a3a20'); R(c, 11, 13, 2, 2, '#5a3a20');
    R(c, 4, 6, 3, 3, '#ffffff'); R(c, 5, 7, 1, 1, '#8a5a33'); R(c, 10, 6, 3, 2, '#ffd23f');
  },
  hd(c, r) {
    tableHD(c, '#c48a52', '#8a5a33', '#5a3a20');
    grain(c, r, 3, 11, 26, 9, '#b47d48', 5, 8);
    oval(c, 5, 15, 13, 5, '#e4e7ec'); oval(c, 6, 16, 11, 3, '#f6f6f8');
    R(c, 8, 11, 7, 7, '#ffffff'); R(c, 14, 12, 1, 6, '#d5d9e0'); R(c, 8, 17, 7, 1, '#d5d9e0');
    R(c, 9, 11, 5, 2, '#6e4428'); P(c, 9, 11, '#8a5a33');
    R(c, 15, 13, 2, 1, '#ffffff'); R(c, 16, 13, 1, 3, '#ffffff'); R(c, 15, 15, 2, 1, '#e4e7ec');
    R(c, 19, 12, 7, 5, '#ffd23f'); R(c, 19, 12, 7, 1, '#ffe98a'); R(c, 19, 16, 7, 1, '#e0b020'); R(c, 22, 12, 1, 5, '#e0b020');
    outline(c);
  },
});
defineTile('table_white', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 1, 4, 14, 7, '#f6f6f8'); R(c, 1, 11, 14, 2, '#c3c6ce'); R(c, 3, 13, 2, 2, '#9aa0aa'); R(c, 11, 13, 2, 2, '#9aa0aa');
    R(c, 5, 6, 2, 3, '#5fd7ff'); R(c, 9, 6, 2, 3, '#ff7eb6');
  },
  hd(c) {
    tableHD(c, '#f6f6f8', '#c3c6ce', '#9aa0aa');
    for (const [x, col] of [[9, '#5fd7ff'], [18, '#ff7eb6']]) {
      R(c, x, 11, 4, 7, shade(col, 0.55)); R(c, x, 14, 4, 4, col); R(c, x, 11, 1, 7, '#ffffff'); R(c, x + 3, 14, 1, 4, shade(col, -0.2));
    }
    outline(c);
  },
});
defineTile('plant', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 5, 10, 6, 5, '#b8643a'); R(c, 5, 10, 6, 1, '#d8845a');
    disc(c, 8, 6, 4, '#2f6b34'); disc(c, 8, 6, 3, '#4a9a4a');
    P(c, 6, 4, '#74c26a'); P(c, 9, 3, '#74c26a'); P(c, 4, 7, '#2f6b34'); P(c, 12, 7, '#2f6b34');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 8, 2);
    const pal = ['#1f4a24', '#2f6b34', '#4a9a4a', '#74c26a', '#98d98a'];
    blobs(c, [[16, 7, 5], [10, 10, 4.5], [22, 10, 4.5], [16, 12, 6.5], [8, 15, 3.5], [24, 15, 3.5], [12, 16, 4], [20, 16, 4]], pal, { bias: -0.08 });
    R(c, 10, 20, 12, 10, '#b8643a'); R(c, 11, 29, 10, 1, '#8e4a28');
    R(c, 9, 20, 14, 3, '#c87048'); R(c, 9, 20, 14, 1, '#e0906a'); R(c, 10, 23, 12, 1, '#8e4a28');
    R(c, 11, 24, 2, 5, '#d0784c'); R(c, 20, 24, 2, 5, '#9a5230');
    outline(c);
  },
});
function booksRow(c, r, x0, x1, y, h, cols) {
  for (let x = x0; x < x1;) {
    const w = 2 + RND(r, 2), bh = h - RND(r, 3), col = cols[RND(r, cols.length)];
    if (x + w > x1) break;
    R(c, x, y + h - bh, w, bh, col); R(c, x, y + h - bh, 1, bh, shade(col, 0.3)); P(c, x + w - 1, y + h - bh, shade(col, -0.2));
    R(c, x, y + h - bh + 2, w, 1, shade(col, -0.25));
    x += w + (r() < 0.15 ? 1 : 0);
  }
}
defineTile('bookshelf', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428'); R(c, 1, 1, 14, 14, '#8a5a33');
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd', '#ff8a3d', '#ffffff'];
    for (let row = 0; row < 3; row++) {
      R(c, 1, 5 + row * 5, 14, 1, '#5a3a20');
      for (let i = 0; i < 6; i++) R(c, 2 + i * 2, 1 + row * 5 + (i % 2), 2, 4 - (i % 2), cols[(i + row * 2) % cols.length]);
    }
  },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#6e4428'); R(c, 0, 0, 32, 1, '#8a5a33'); R(c, 0, 1, 1, 31, '#7a4e2e'); R(c, 31, 1, 1, 31, '#4f3018');
    R(c, 2, 2, 28, 28, '#4a2c16');
    const cols = ['#d62f2f', '#2f6fd0', '#ffd23f', '#2f9a4a', '#9273bd', '#ff8a3d', '#f4f4f4', '#3a58a8'];
    for (let row = 0; row < 3; row++) {
      const y = 2 + row * 10;
      booksRow(c, r, 3, 29, y, 8, cols);
      R(c, 2, y + 8, 28, 2, '#8a5a33'); R(c, 2, y + 8, 28, 1, '#a87449');
    }
    R(c, 0, 30, 32, 2, '#5a3a20');
  },
});
defineTile('cabinet', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 16, '#7d8391'); R(c, 2, 1, 12, 14, '#a3a8b2');
    for (const y of [2, 7, 12]) { R(c, 2, y + 3, 12, 1, '#7d8391'); R(c, 6, y + 1, 4, 1, '#5a5f6b'); }
  },
  hd(c) {
    R(c, 2, 0, 28, 32, '#7d8391');
    for (const y of [1, 11, 21]) {
      bevel(c, 4, y, 24, 9, '#a3a8b2', '#c3c8d0', '#8a909a');
      R(c, 12, y + 3, 8, 2, '#5a5f6b'); R(c, 12, y + 3, 8, 1, '#3b3f48');
      R(c, 7, y + 2, 4, 3, '#e8ecf2'); R(c, 7, y + 4, 4, 1, '#c3c8d0');
    }
    R(c, 2, 31, 28, 1, '#5a5f6b');
    outline(c);
  },
});
defineTile('locker', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a6f8a'); R(c, 1, 1, 6, 15, '#7d95b5'); R(c, 9, 1, 6, 15, '#7d95b5');
    for (const x of [2, 10]) { R(c, x, 3, 4, 1, '#4a5a70'); R(c, x, 5, 4, 1, '#4a5a70'); R(c, x + 3, 9, 1, 2, '#20232a'); }
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#5a6f8a'); R(c, 0, 0, 32, 1, '#6e85a3');
    for (const x of [2, 18]) {
      bevel(c, x, 2, 12, 30, '#7d95b5', '#9ab0cc', '#64799a');
      for (let y = 5; y < 12; y += 2) R(c, x + 3, y, 6, 1, '#4a5a70');
      R(c, x + 8, 16, 2, 5, '#20232a'); P(c, x + 8, 16, '#4a4e58');
      R(c, x + 3, 25, 4, 2, '#e8ecf2');
    }
  },
});
defineTile('tv', {
  solid: true, obj: true, frames: 3, speed: 24,
  draw(c, r, f) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 2, 10, 12, 5, '#5a3a20'); R(c, 2, 10, 12, 1, '#8a5a33');
    R(c, 2, 1, 12, 9, '#20232a');
    const scr = ['#5fd7ff', '#ff7eb6', '#5ee07a'][f];
    R(c, 3, 2, 10, 7, scr); R(c, 4, 3, 3, 2, '#ffffff'); R(c, 8 - f, 5, 4, 3, '#ffd23f');
  },
  hd(c, r, f) {
    shadowEllipse(c, 16, 29, 13, 2);
    R(c, 4, 20, 24, 9, '#5a3a20'); R(c, 4, 20, 24, 2, '#8a5a33'); R(c, 4, 20, 24, 1, '#a87449');
    R(c, 15, 22, 1, 6, '#3e2814'); R(c, 12, 24, 2, 1, '#c9a227'); R(c, 18, 24, 2, 1, '#c9a227');
    R(c, 4, 2, 24, 18, '#20232a'); R(c, 4, 2, 24, 1, '#3b3f48');
    const scr = ['#5fd7ff', '#ff7eb6', '#5ee07a'][f];
    R(c, 6, 4, 20, 14, scr); R(c, 6, 14, 20, 4, shade(scr, -0.15));
    R(c, 8, 6, 6, 4, '#ffffff'); R(c, 8, 9, 6, 1, '#d5d9e0');
    R(c, 16 - f * 2, 10, 8, 6, '#ffd23f'); R(c, 16 - f * 2, 10, 8, 1, '#ffe98a');
    P(c, 7, 5, '#ffffff'); P(c, 24, 18, '#5ee07a');
    outline(c);
  },
});
defineTile('monitor', {
  solid: true, obj: true, frames: 4, speed: 16,
  draw(c, r, f) {
    R(c, 0, 0, 16, 14, '#20232a');
    const cols = ['#5fd7ff', '#5ee07a', '#ffd23f', '#ff7eb6'];
    for (let i = 0; i < 4; i++) R(c, 1 + (i % 2) * 7, 1 + Math.floor(i / 2) * 6, 6, 5, cols[(i + f) % 4]);
    R(c, 0, 14, 16, 2, '#3b3f48');
  },
  hd(c, r, f) {
    R(c, 0, 0, 32, 28, '#20232a'); R(c, 0, 0, 32, 1, '#3b3f48');
    const cols = ['#5fd7ff', '#5ee07a', '#ffd23f', '#ff7eb6'];
    for (let i = 0; i < 4; i++) {
      const x = 2 + (i % 2) * 15, y = 2 + Math.floor(i / 2) * 12, col = cols[(i + f) % 4];
      R(c, x, y, 13, 10, col); R(c, x, y + 7, 13, 3, shade(col, -0.18));
      R(c, x + 2, y + 2, 4, 3, shade(col, 0.6)); R(c, x + 7, y + 4, 4, 4, shade(col, -0.3)); P(c, x, y, shade(col, 0.7));
    }
    R(c, 0, 28, 32, 4, '#3b3f48'); R(c, 0, 28, 32, 1, '#5a5f6b');
    for (let x = 4; x < 32; x += 6) P(c, x, 30, (x / 6) & 1 ? '#5ee07a' : '#ff9a3c');
  },
});
defineTile('camera', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 8, 9, 1, 5, '#3b3f48'); R(c, 3, 13, 11, 1, '#3b3f48'); R(c, 4, 12, 2, 1, '#3b3f48'); R(c, 11, 12, 2, 1, '#3b3f48');
    R(c, 2, 2, 11, 7, '#20232a'); R(c, 3, 3, 9, 5, '#3b3f48'); R(c, 0, 3, 3, 5, '#4a4e58'); R(c, 0, 4, 2, 3, '#5fd7ff');
    R(c, 13, 3, 2, 3, '#ffd23f'); P(c, 11, 3, '#ff2b3a');
  },
  hd(c) {
    shadowEllipse(c, 16, 29, 12, 2);
    R(c, 15, 18, 3, 10, '#3b3f48'); line(c, 15, 22, 7, 28, '#3b3f48'); line(c, 17, 22, 25, 28, '#3b3f48'); line(c, 16, 22, 8, 28, '#5a5f6b'); line(c, 16, 22, 24, 28, '#5a5f6b');
    R(c, 12, 16, 9, 3, '#20232a');
    R(c, 4, 4, 22, 13, '#20232a'); R(c, 6, 6, 18, 9, '#3b3f48'); R(c, 6, 6, 18, 1, '#5a5f6b'); R(c, 8, 9, 10, 1, '#4a4e58'); R(c, 8, 11, 10, 1, '#4a4e58');
    R(c, 0, 6, 6, 9, '#4a4e58'); R(c, 0, 6, 6, 1, '#6b707c'); R(c, 0, 8, 4, 5, '#5fd7ff'); R(c, 0, 8, 2, 2, '#c8f2ff'); R(c, 3, 11, 1, 2, '#2f8ab8');
    R(c, 26, 6, 4, 6, '#ffd23f'); R(c, 26, 6, 4, 1, '#ffe98a'); R(c, 29, 7, 1, 5, '#c9a227');
    R(c, 21, 6, 2, 2, '#ff2b3a'); P(c, 21, 6, '#ff9aa0');
    R(c, 10, 2, 8, 2, '#3b3f48');
    outline(c);
  },
});
defineTile('mic', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 3, 1);
    R(c, 7, 4, 2, 11, '#9aa0aa'); R(c, 7, 4, 1, 11, '#d5d9e0'); R(c, 5, 14, 6, 1, '#3b3f48');
    R(c, 6, 0, 4, 5, '#3b3f48'); R(c, 6, 0, 4, 1, '#7d8391'); R(c, 7, 1, 1, 2, '#9aa0aa');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 7, 2);
    R(c, 15, 10, 3, 19, '#9aa0aa'); R(c, 15, 10, 1, 19, '#e4e7ec'); R(c, 17, 10, 1, 19, '#6d7380');
    R(c, 14, 16, 5, 2, '#5a5f6b');
    oval(c, 10, 28, 13, 3, '#3b3f48'); R(c, 12, 28, 9, 1, '#5a5f6b');
    R(c, 13, 7, 7, 4, '#20232a');
    oval(c, 12, 0, 9, 9, '#3b3f48');
    for (let y = 2; y < 8; y += 2) for (let x = 13 + (y & 2 ? 1 : 0); x < 20; x += 2) P(c, x, y, '#5a5f6b');
    R(c, 14, 1, 3, 1, '#9aa0aa'); P(c, 13, 2, '#7d8391');
    outline(c);
  },
});
defineTile('spotlight', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 7, 8, 2, 7, '#3b3f48'); R(c, 4, 14, 8, 1, '#3b3f48');
    R(c, 4, 1, 8, 7, '#20232a'); R(c, 5, 2, 6, 5, '#4a4e58'); R(c, 6, 3, 4, 3, '#fff6a8'); R(c, 7, 4, 2, 1, '#ffffff');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 8, 2);
    R(c, 15, 16, 3, 13, '#3b3f48'); R(c, 15, 16, 1, 13, '#5a5f6b');
    R(c, 8, 28, 16, 2, '#3b3f48'); R(c, 8, 28, 16, 1, '#5a5f6b');
    R(c, 6, 9, 2, 6, '#3b3f48'); R(c, 24, 9, 2, 6, '#3b3f48'); R(c, 6, 14, 20, 2, '#3b3f48');
    R(c, 8, 2, 16, 14, '#20232a'); R(c, 8, 2, 16, 1, '#3b3f48');
    oval(c, 10, 4, 12, 11, '#4a4e58'); oval(c, 11, 5, 10, 9, '#fff6a8'); oval(c, 13, 7, 6, 5, '#ffffff');
    P(c, 12, 6, '#ffffff'); R(c, 18, 11, 2, 1, '#ffe36e');
    for (const x of [9, 22]) R(c, x, 0, 1, 2, '#3b3f48');
    outline(c);
  },
});
defineTile('speaker', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 16, '#20232a'); R(c, 3, 1, 10, 14, '#2e3038');
    disc(c, 8, 4, 2, '#4a4e58'); P(c, 8, 4, '#20232a'); disc(c, 8, 10, 3, '#4a4e58'); disc(c, 8, 10, 1, '#20232a');
  },
  hd(c) {
    R(c, 4, 0, 24, 32, '#20232a'); R(c, 6, 2, 20, 28, '#2e3038'); R(c, 6, 2, 20, 1, '#3e414b'); R(c, 6, 3, 1, 27, '#363944');
    oval(c, 11, 4, 10, 10, '#4a4e58'); oval(c, 12, 5, 8, 8, '#3b3f48'); oval(c, 14, 7, 4, 4, '#20232a'); P(c, 13, 6, '#6b707c');
    oval(c, 9, 15, 14, 14, '#4a4e58'); oval(c, 10, 16, 12, 12, '#3b3f48'); oval(c, 12, 18, 8, 8, '#2e3038'); oval(c, 14, 20, 4, 4, '#20232a');
    P(c, 12, 17, '#6b707c'); P(c, 11, 18, '#5a5f6b');
    outline(c);
  },
});
defineTile('piano', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 10, '#16161a'); R(c, 1, 1, 14, 2, '#3b3f48');
    R(c, 0, 10, 16, 4, '#ffffff'); for (let x = 1; x < 16; x += 2) R(c, x, 10, 1, 2, '#16161a');
    R(c, 0, 14, 16, 2, '#16161a');
  },
  hd(c) {
    R(c, 0, 0, 32, 20, '#16161a'); R(c, 0, 0, 32, 1, '#3b3f48');
    R(c, 0, 2, 32, 4, '#2a2a30'); R(c, 0, 2, 32, 1, '#4a4a54'); R(c, 0, 17, 32, 3, '#0e0e12');
    R(c, 3, 8, 6, 1, '#3b3f48'); R(c, 22, 10, 5, 1, '#3b3f48');
    R(c, 0, 20, 32, 8, '#ffffff'); R(c, 0, 27, 32, 1, '#c3c6ce');
    for (let x = 3; x < 32; x += 4) R(c, x, 20, 1, 8, '#c3c6ce');
    for (const k of [0, 1, 3, 4, 5]) { R(c, k * 4 + 2, 20, 3, 5, '#16161a'); P(c, k * 4 + 2, 20, '#3b3f48'); }
    R(c, 0, 28, 32, 4, '#16161a'); R(c, 0, 28, 32, 1, '#2a2a30');
  },
});
defineTile('curtain', {
  solid: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#a51f2c');
    for (let x = v * 2; x < 16; x += 4) { R(c, x, 0, 1, 16, '#7a1520'); R(c, x + 2, 0, 1, 16, '#d0404e'); }
  },
  // velvet folds: dark crease, mid, lit ridge, every 8px. The folds run the
  // full height at the same columns in every variant, so curtains stacked in
  // columns (with variants hashed per cell) stay continuous; the variant only
  // adds a short wrinkle highlight inside one fold.
  hd(c, r, f, v) {
    const tones = ['#6a121c', '#7a1520', '#8f1a26', '#a51f2c', '#bb2d3a', '#d0404e', '#bb2d3a', '#a51f2c'];
    for (let x = 0; x < 32; x++) R(c, x, 0, 1, 32, tones[x % 8]);
    for (let x = 0; x < 32; x += 8) R(c, x + 5, 0, 1, 32, '#e05a66');
    if (v) { R(c, 11, 8, 1, 12, '#b82a37'); R(c, 27, 14, 1, 10, '#b82a37'); }
  },
});
defineTile('curtain_top', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a1520'); R(c, 0, 0, 16, 11, '#a51f2c');
    for (let x = 0; x < 16; x += 4) { R(c, x, 8, 4, 3, '#d0404e'); R(c, x + 1, 11, 2, 2, '#a51f2c'); }
    R(c, 0, 13, 16, 1, '#e8c43a'); for (let x = 0; x < 16; x += 2) P(c, x, 14, '#e8c43a');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#7a1520'); R(c, 0, 0, 32, 22, '#a51f2c');
    for (let x = 0; x < 32; x += 8) {
      R(c, x, 4, 1, 12, '#8f1a26'); R(c, x + 4, 4, 1, 10, '#bb2d3a');
      oval(c, x, 14, 8, 10, '#d0404e'); oval(c, x + 1, 14, 6, 7, '#e05a66'); R(c, x, 14, 8, 2, '#d0404e');
      R(c, x + 7, 16, 1, 6, '#8f1a26');
    }
    R(c, 0, 26, 32, 2, '#e8c43a'); R(c, 0, 26, 32, 1, '#fff0a0');
    for (let x = 0; x < 32; x += 2) { R(c, x, 28, 1, 3, '#e8c43a'); P(c, x, 30, '#c9a227'); }
  },
});
defineTile('rope', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 5, 3, 10, '#c9a227'); R(c, 1, 4, 3, 2, '#e8c43a'); R(c, 0, 14, 5, 2, '#a07f1a');
    for (let x = 4; x < 16; x++) P(c, x, 7 + Math.round(Math.sin((x - 4) / 12 * Math.PI) * 2), '#c8323f');
    for (let x = 4; x < 16; x++) P(c, x, 8 + Math.round(Math.sin((x - 4) / 12 * Math.PI) * 2), '#7a1520');
  },
  // brass stanchion and a sagging velvet rope toward the next post
  hd(c) {
    shadowEllipse(c, 5, 30, 5, 1);
    for (let x = 7; x < 32; x++) {
      const y = 14 + Math.round(Math.sin((x - 7) / 25 * Math.PI) * 4);
      P(c, x, y, '#e05462'); P(c, x, y + 1, '#c8323f'); P(c, x, y + 2, '#c8323f'); P(c, x, y + 3, '#7a1520');
    }
    R(c, 3, 10, 5, 19, '#c9a227'); R(c, 3, 10, 1, 19, '#fff0a0'); R(c, 4, 10, 1, 19, '#e8c43a'); R(c, 7, 10, 1, 19, '#8e7018');
    oval(c, 2, 6, 7, 6, '#e8c43a'); P(c, 4, 7, '#fff6c8'); P(c, 3, 8, '#fff0a0');
    oval(c, 0, 27, 11, 5, '#a07f1a'); R(c, 2, 28, 7, 1, '#c9a227');
    outline(c);
  },
});
function boxHD(c, x, y, w, h, base) {
  R(c, x, y, w, h, base);
  R(c, x, y, w, 5, shade(base, 0.18)); R(c, x, y + 5, w, 1, shade(base, -0.15)); R(c, x, y, w, 1, shade(base, 0.32));
  const mid = x + Math.floor(w / 2) - 1;
  R(c, mid, y, 3, h, '#e8c890'); R(c, mid, y, 3, 5, '#f2d8a8'); R(c, mid + 2, y + 5, 1, h - 5, '#d4b070');
  R(c, x, y + h - 1, w, 1, shade(base, -0.22)); R(c, x + w - 1, y + 6, 1, h - 6, shade(base, -0.12));
  P(c, x + 2, y + 8, shade(base, -0.1)); R(c, x + 2, y + h - 5, 4, 2, shade(base, -0.08));
}
defineTile('box', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 6, 1);
    R(c, 2, 4, 12, 10, '#c9955a'); R(c, 2, 4, 12, 3, '#ddb07a'); R(c, 7, 4, 2, 10, '#e8c890'); R(c, 2, 13, 12, 1, '#9b6c3c');
  },
  hd(c) { shadowEllipse(c, 16, 28, 13, 2); boxHD(c, 4, 8, 24, 20, '#c9955a'); outline(c); },
});
defineTile('boxes', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 6, 9, 9, '#c9955a'); R(c, 0, 6, 9, 2, '#ddb07a'); R(c, 4, 6, 1, 9, '#e8c890');
    R(c, 7, 1, 9, 14, '#b98552'); R(c, 7, 1, 9, 2, '#d6a06a'); R(c, 11, 1, 1, 14, '#e8c890');
  },
  hd(c) {
    shadowEllipse(c, 16, 29, 15, 2);
    boxHD(c, 14, 2, 18, 28, '#b98552');
    boxHD(c, 0, 12, 18, 18, '#c9955a');
    outline(c);
  },
});
defineTile('clothes_rack', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 1, 14, 1, '#9aa0aa'); R(c, 1, 1, 1, 14, '#9aa0aa'); R(c, 14, 1, 1, 14, '#9aa0aa'); R(c, 0, 14, 16, 1, '#5a5f6b');
    const cols = ['#d62f2f', '#ffd23f', '#2f6fd0', '#ff7eb6', '#2f9a4a'];
    for (let i = 0; i < 5; i++) { R(c, 2 + i * 2 + (i > 2 ? 1 : 0), 2, 2, 9, cols[i]); R(c, 2 + i * 2 + (i > 2 ? 1 : 0), 2, 2, 1, '#20232a'); }
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 15, 1);
    R(c, 2, 2, 28, 2, '#c0c4cc'); R(c, 2, 2, 28, 1, '#e4e7ec');
    for (const x of [2, 28]) { R(c, x, 2, 2, 27, '#9aa0aa'); R(c, x, 2, 1, 27, '#d5d9e0'); }
    R(c, 0, 28, 8, 2, '#5a5f6b'); R(c, 24, 28, 8, 2, '#5a5f6b');
    const cols = ['#d62f2f', '#ffd23f', '#2f6fd0', '#ff7eb6', '#2f9a4a'];
    for (let i = 0; i < 5; i++) {
      const x = 5 + i * 5, col = cols[i], len = 17 + (i % 2) * 3;
      line(c, x + 2, 3, x + 2, 4, '#5a5f6b'); R(c, x, 5, 5, 1, '#5a5f6b');
      R(c, x, 6, 5, len, col); R(c, x, 6, 1, len, shade(col, 0.3)); R(c, x + 4, 6, 1, len, shade(col, -0.28));
      R(c, x + 1, 6, 3, 2, shade(col, -0.15)); R(c, x, 5 + len, 5, 1, shade(col, -0.2));
    }
    outline(c);
  },
});
defineTile('makeup', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 3, 16, 7, '#f6f6f8'); R(c, 0, 10, 16, 4, '#d5d9e0'); R(c, 0, 14, 16, 1, '#9aa0aa');
    R(c, 3, 5, 2, 3, '#ff7eb6'); R(c, 7, 6, 3, 2, '#c9a227'); R(c, 12, 4, 2, 4, '#5fd7ff');
  },
  hd(c) {
    R(c, 0, 6, 32, 14, '#f6f6f8'); R(c, 0, 6, 32, 1, '#ffffff'); R(c, 0, 19, 32, 1, '#e4e7ec');
    R(c, 0, 20, 32, 8, '#d5d9e0'); R(c, 0, 20, 32, 1, '#b8bec8'); R(c, 0, 27, 32, 1, '#9aa0aa');
    R(c, 14, 22, 4, 1, '#9aa0aa');
    R(c, 5, 9, 3, 7, '#ff7eb6'); R(c, 5, 9, 3, 2, '#ffc0da'); R(c, 5, 13, 3, 3, '#c9a227'); P(c, 5, 9, '#ffe0ef');
    oval(c, 12, 11, 7, 5, '#c9a227'); oval(c, 13, 11, 5, 3, '#ffe36e'); P(c, 14, 11, '#fff6c8');
    R(c, 24, 8, 4, 8, '#5fd7ff'); R(c, 25, 7, 2, 1, '#3b3f48'); R(c, 24, 8, 1, 8, '#c8f2ff'); R(c, 27, 9, 1, 7, '#2f8ab8');
    R(c, 20, 13, 2, 3, '#20232a'); R(c, 20, 12, 2, 1, '#d62f2f');
    outline(c);
  },
});
defineTile('water_server', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 4, 1);
    R(c, 4, 6, 8, 9, '#f6f6f8'); R(c, 4, 6, 1, 9, '#d5d9e0'); R(c, 5, 0, 6, 6, '#8fd0ff'); R(c, 6, 1, 2, 4, '#c8ecff');
    P(c, 6, 9, '#2f6fd0'); P(c, 9, 9, '#d62f2f');
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 9, 2);
    R(c, 8, 12, 16, 18, '#f6f6f8'); R(c, 8, 12, 2, 18, '#ffffff'); R(c, 22, 12, 2, 18, '#d5d9e0'); R(c, 8, 12, 16, 1, '#d5d9e0');
    R(c, 10, 16, 12, 6, '#d5d9e0'); R(c, 10, 16, 12, 1, '#b8bec8');
    R(c, 12, 17, 2, 2, '#2f6fd0'); R(c, 18, 17, 2, 2, '#d62f2f');
    R(c, 11, 21, 10, 1, '#9aa0aa');
    R(c, 10, 2, 12, 10, '#8fd0ff'); R(c, 11, 1, 10, 1, '#8fd0ff'); R(c, 13, 0, 6, 1, '#6fb8e8');
    R(c, 12, 3, 3, 7, '#c8ecff'); R(c, 12, 3, 1, 7, '#ffffff'); R(c, 20, 3, 1, 8, '#5fa8d8');
    R(c, 10, 6, 12, 1, '#6fb8e8');
    R(c, 9, 29, 14, 1, '#b8bec8');
    outline(c);
  },
});
defineTile('bed_top', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 16, '#8a5a33'); R(c, 2, 2, 12, 14, '#f6f6f8'); R(c, 3, 3, 10, 5, '#ffffff'); R(c, 3, 8, 10, 1, '#d5d9e0');
    R(c, 2, 10, 12, 6, '#5f8fd8'); R(c, 2, 10, 12, 1, '#8fb4ee');
  },
  hd(c) {
    R(c, 2, 0, 28, 32, '#8a5a33'); R(c, 2, 0, 28, 1, '#a87449'); R(c, 2, 1, 28, 2, '#6e4428');
    R(c, 4, 3, 24, 29, '#f6f6f8');
    R(c, 6, 5, 20, 11, '#ffffff'); R(c, 7, 4, 18, 1, '#ffffff'); R(c, 6, 15, 20, 1, '#d5d9e0'); R(c, 25, 6, 1, 9, '#e4e7ec');
    R(c, 8, 10, 16, 1, '#eef0f4');
    R(c, 4, 20, 24, 12, '#5f8fd8'); R(c, 4, 20, 24, 2, '#8fb4ee'); R(c, 4, 22, 24, 1, '#7aa2e4'); R(c, 4, 22, 1, 10, '#6f9be0'); R(c, 27, 22, 1, 10, '#4a78c0');
    R(c, 4, 18, 24, 2, '#ffffff'); R(c, 4, 19, 24, 1, '#e4e7ec');
    outline(c);
  },
});
defineTile('bed_bottom', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 14, '#8a5a33'); R(c, 2, 0, 12, 12, '#5f8fd8'); R(c, 2, 4, 12, 1, '#4a78c0'); R(c, 2, 8, 12, 1, '#4a78c0');
    R(c, 1, 14, 14, 2, '#5a3a20');
  },
  hd(c) {
    R(c, 2, 0, 28, 28, '#8a5a33');
    R(c, 4, 0, 24, 24, '#5f8fd8'); R(c, 4, 0, 1, 24, '#6f9be0'); R(c, 27, 0, 1, 24, '#4a78c0');
    for (const y of [8, 16]) { R(c, 4, y, 24, 1, '#4a78c0'); R(c, 4, y + 1, 24, 1, '#7aa2e4'); }
    for (const x of [12, 20]) for (let y = 1; y < 24; y += 8) { P(c, x, y + 3, '#4a78c0'); }
    R(c, 4, 22, 24, 2, '#4a78c0');
    R(c, 2, 24, 28, 4, '#8a5a33'); R(c, 2, 24, 28, 1, '#a87449'); R(c, 2, 28, 28, 3, '#5a3a20'); R(c, 2, 28, 28, 1, '#6e4428');
    outline(c);
  },
});
defineTile('kitchen', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 2, 16, 14, '#d5d9e0'); R(c, 0, 2, 16, 6, '#f6f6f8'); R(c, 2, 3, 8, 4, '#9aa0aa'); R(c, 3, 4, 6, 2, '#c8ecff');
    R(c, 12, 3, 2, 3, '#3b3f48'); R(c, 1, 9, 14, 6, '#c3c6ce'); R(c, 7, 11, 2, 1, '#5a5f6b');
  },
  hd(c) {
    R(c, 0, 4, 32, 28, '#d5d9e0');
    R(c, 0, 4, 32, 12, '#f6f6f8'); R(c, 0, 4, 32, 1, '#ffffff'); R(c, 0, 15, 32, 1, '#c3c6ce');
    R(c, 3, 6, 17, 8, '#9aa0aa'); R(c, 4, 7, 15, 6, '#7d8391'); R(c, 5, 8, 13, 4, '#c8ecff'); R(c, 5, 8, 13, 1, '#a8d8f0'); P(c, 15, 10, '#ffffff');
    R(c, 23, 5, 4, 2, '#9aa0aa'); R(c, 24, 7, 2, 4, '#9aa0aa'); R(c, 18, 5, 6, 1, '#c0c4cc'); R(c, 18, 5, 1, 3, '#c0c4cc');
    oval(c, 23, 10, 6, 4, '#3b3f48'); oval(c, 24, 11, 4, 2, '#5a5f6b');
    R(c, 0, 16, 32, 2, '#b8bec8');
    for (const x of [2, 17]) { bevel(c, x, 18, 13, 12, '#c3c6ce', '#e4e7ec', '#9aa0aa'); R(c, x + 4, 21, 5, 1, '#5a5f6b'); }
    R(c, 0, 30, 32, 2, '#7d8391');
    outline(c);
  },
});
defineTile('fridge', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 16, '#c3c6ce'); R(c, 3, 0, 10, 15, '#f6f6f8'); R(c, 3, 6, 10, 1, '#c3c6ce'); R(c, 11, 2, 1, 3, '#9aa0aa'); R(c, 11, 8, 1, 4, '#9aa0aa');
  },
  hd(c) {
    R(c, 4, 1, 24, 31, '#c3c6ce');
    bevel(c, 6, 1, 21, 11, '#f6f6f8', '#ffffff', '#d5d9e0');
    bevel(c, 6, 13, 21, 17, '#f6f6f8', '#ffffff', '#d5d9e0');
    R(c, 6, 12, 21, 1, '#9aa0aa');
    R(c, 22, 4, 2, 6, '#9aa0aa'); R(c, 22, 4, 1, 6, '#d5d9e0'); R(c, 22, 15, 2, 8, '#9aa0aa'); R(c, 22, 15, 1, 8, '#d5d9e0');
    R(c, 9, 17, 4, 5, '#ffd23f'); R(c, 14, 18, 3, 3, '#ff7eb6');
    R(c, 6, 30, 21, 2, '#9aa0aa');
    outline(c);
  },
});
defineTile('table_low', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 7, 1);
    R(c, 0, 4, 16, 8, '#8a5a33'); R(c, 1, 5, 14, 6, '#b98552'); R(c, 1, 5, 14, 1, '#d6a06a');
    R(c, 4, 6, 3, 2, '#f4a640'); R(c, 9, 7, 2, 2, '#ffffff');
  },
  // low "chabudai" table with mandarins and a cup of tea
  hd(c, r) {
    shadowEllipse(c, 16, 26, 15, 2);
    R(c, 0, 8, 32, 16, '#8a5a33'); R(c, 0, 8, 32, 1, '#a87449');
    R(c, 2, 10, 28, 12, '#b98552'); R(c, 2, 10, 28, 1, '#d6a06a'); grain(c, r, 3, 12, 26, 9, '#ad7a48', 5, 7);
    R(c, 0, 22, 32, 2, '#6e4428'); R(c, 3, 24, 3, 2, '#5a3a20'); R(c, 26, 24, 3, 2, '#5a3a20');
    for (const [x, y] of [[5, 11], [11, 12], [7, 16]]) {
      oval(c, x, y, 5, 5, '#c8701a'); oval(c, x, y, 4, 4, '#f4a640'); P(c, x + 1, y + 1, '#ffd08a'); P(c, x + 2, y, '#5e9a3a');
    }
    R(c, 19, 13, 5, 5, '#ffffff'); R(c, 19, 13, 5, 1, '#d5d9e0'); R(c, 20, 14, 3, 1, '#8ab858'); R(c, 23, 14, 1, 4, '#d5d9e0');
    outline(c);
  },
});
const GOODS = [['#d62f2f', '#ffd23f', '#ff8a3d'], ['#2f9a4a', '#ffffff', '#5fd7ff'], ['#ff7eb6', '#9273bd', '#ffd23f']];
defineTile('shelf_goods', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#9aa0aa'); R(c, 1, 0, 14, 15, '#e8eaee');
    const sets = [['#d62f2f', '#ffd23f', '#ff8a3d'], ['#2f9a4a', '#ffffff', '#5fd7ff'], ['#ff7eb6', '#9273bd', '#ffd23f']][v];
    for (let row = 0; row < 3; row++) {
      R(c, 1, 4 + row * 5, 14, 1, '#7d8391');
      for (let i = 0; i < 4; i++) R(c, 2 + i * 3 + (row % 2), 1 + row * 5, 2, 3, sets[(i + row) % 3]);
    }
  },
  hd(c, r, f, v) {
    const sets = GOODS[v];
    R(c, 0, 0, 32, 32, '#9aa0aa'); R(c, 2, 0, 28, 30, '#e8eaee'); R(c, 2, 0, 28, 1, '#c3c8d0');
    for (let row = 0; row < 3; row++) {
      const y = 1 + row * 10;
      for (let i = 0; i < 5; i++) {
        const col = sets[(i + row) % 3], x = 3 + i * 5 + (row % 2), h = 6 + ((i + row) % 2);
        R(c, x, y + 7 - h, 4, h, col); R(c, x, y + 7 - h, 4, 1, shade(col, 0.4)); R(c, x + 3, y + 8 - h, 1, h - 1, shade(col, -0.22));
        R(c, x + 1, y + 9 - h, 2, 2, col === '#ffffff' ? '#d62f2f' : '#ffffff');
      }
      R(c, 2, y + 7, 28, 2, '#9aa0aa'); R(c, 2, y + 7, 28, 1, '#c3c8d0'); R(c, 6, y + 8, 4, 1, '#ffd23f');
    }
    R(c, 0, 30, 32, 2, '#7d8391');
  },
});
defineTile('fridge_drinks', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a5f6b'); R(c, 1, 1, 14, 14, '#bfe6ff');
    const cols = ['#d62f2f', '#2f9a4a', '#ffd23f', '#2f6fd0', '#ff8a3d'];
    for (let row = 0; row < 3; row++) { R(c, 1, 5 + row * 5, 14, 1, '#9aa0aa'); for (let i = 0; i < 5; i++) R(c, 2 + i * 3, 2 + row * 5, 2, 3, cols[(i + row) % 5]); }
    R(c, 7, 1, 1, 14, '#9aa0aa');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#5a5f6b'); R(c, 0, 0, 32, 1, '#7d8391');
    R(c, 2, 2, 28, 28, '#bfe6ff');
    const cols = ['#d62f2f', '#2f9a4a', '#ffd23f', '#2f6fd0', '#ff8a3d', '#f4f4f4'];
    for (let row = 0; row < 3; row++) {
      const y = 3 + row * 9;
      for (let i = 0; i < 9; i++) {
        const col = cols[(i + row * 2) % cols.length], x = 3 + i * 3;
        R(c, x, y + 1, 2, 6, col); P(c, x, y, shade(col, -0.3)); P(c, x, y + 2, shade(col, 0.45)); R(c, x, y + 4, 2, 1, '#ffffff');
      }
      R(c, 2, y + 7, 28, 1, '#9aa0aa'); R(c, 2, y + 8, 28, 1, '#d8f0ff');
    }
    for (const [x, y] of [[4, 4], [5, 3], [18, 14], [19, 13], [20, 12]]) P(c, x, y, '#ffffff');
    R(c, 15, 2, 2, 28, '#7d8391'); R(c, 15, 2, 1, 28, '#9aa0aa'); R(c, 12, 12, 1, 6, '#d5d9e0'); R(c, 19, 12, 1, 6, '#d5d9e0');
  },
});
defineTile('magazine', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 4, 16, 12, '#8a5a33');
    const cols = ['#ff7eb6', '#ffd23f', '#5fd7ff', '#d62f2f', '#5ee07a'];
    for (let i = 0; i < 5; i++) { R(c, 1 + i * 3, 1 + (i % 2), 3, 8, cols[i]); R(c, 1 + i * 3, 3 + (i % 2), 3, 1, '#ffffff'); }
  },
  hd(c) {
    R(c, 0, 8, 32, 24, '#8a5a33'); R(c, 0, 8, 32, 1, '#a87449'); R(c, 0, 20, 32, 2, '#6e4428'); R(c, 0, 30, 32, 2, '#5a3a20');
    const cols = ['#ff7eb6', '#ffd23f', '#5fd7ff', '#d62f2f', '#5ee07a'];
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 6, y = 2 + (i % 2) * 2, col = cols[i];
      R(c, x, y, 6, 16, col); R(c, x, y, 6, 1, shade(col, 0.4)); R(c, x + 5, y + 1, 1, 15, shade(col, -0.25));
      R(c, x + 1, y + 2, 4, 2, '#ffffff'); oval(c, x + 1, y + 6, 4, 5, shade(col, -0.3)); R(c, x + 1, y + 12, 3, 1, '#20232a');
    }
    outline(c);
  },
});
defineTile('trophy', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428'); R(c, 1, 1, 14, 14, '#2a1f18');
    for (const [x, y] of [[3, 2], [9, 2], [6, 9]]) { R(c, x, y, 4, 3, '#e8c43a'); R(c, x + 1, y + 3, 2, 1, '#c9a227'); R(c, x, y + 4, 4, 1, '#c9a227'); P(c, x, y, '#fff6a8'); }
    R(c, 1, 7, 14, 1, '#6e4428');
  },
  hd(c) {
    R(c, 0, 0, 32, 32, '#6e4428'); R(c, 0, 0, 32, 1, '#8a5a33'); R(c, 31, 1, 1, 31, '#4f3018');
    R(c, 2, 2, 28, 28, '#2a1f18'); R(c, 2, 2, 28, 1, '#3a2c22');
    for (const [x, y] of [[5, 3], [18, 3], [11, 17]]) {
      R(c, x, y, 9, 6, '#e8c43a'); R(c, x - 1, y, 1, 3, '#c9a227'); R(c, x + 9, y, 1, 3, '#c9a227');
      R(c, x + 1, y + 6, 7, 1, '#c9a227'); R(c, x + 3, y + 7, 3, 2, '#c9a227'); R(c, x + 2, y + 9, 5, 2, '#8e7018'); R(c, x + 2, y + 9, 5, 1, '#c9a227');
      R(c, x + 1, y + 1, 1, 4, '#fff6a8'); R(c, x + 7, y + 1, 1, 5, '#b8901a');
    }
    R(c, 2, 14, 28, 2, '#6e4428'); R(c, 2, 14, 28, 1, '#8a5a33');
    for (const [x, y] of [[26, 6], [7, 22]]) P(c, x, y, '#ffffff');
  },
});
defineTile('drum_set', {
  solid: true, obj: true,
  draw(c) {
    disc(c, 8, 10, 4, '#d62f2f'); disc(c, 8, 10, 3, '#f6f6f8');
    disc(c, 3, 6, 2, '#c9a227'); disc(c, 13, 6, 2, '#c9a227'); disc(c, 8, 4, 2, '#d62f2f'); P(c, 8, 4, '#f6f6f8');
  },
  hd(c) {
    shadowEllipse(c, 16, 29, 13, 2);
    for (const x of [5, 26]) { R(c, x, 12, 1, 16, '#9aa0aa'); line(c, x, 27, x - 3, 29, '#9aa0aa'); line(c, x, 27, x + 3, 29, '#9aa0aa'); }
    oval(c, 0, 9, 11, 5, '#c9a227'); oval(c, 1, 10, 9, 2, '#e8c43a'); P(c, 5, 11, '#8e7018');
    oval(c, 21, 9, 11, 5, '#c9a227'); oval(c, 22, 10, 9, 2, '#e8c43a'); P(c, 26, 11, '#8e7018');
    for (const x of [9, 17]) { R(c, x, 5, 6, 6, '#d62f2f'); R(c, x, 5, 6, 2, '#f6f6f8'); R(c, x, 7, 6, 1, '#c0c4cc'); R(c, x, 10, 6, 1, '#c0c4cc'); R(c, x, 8, 1, 2, '#ff5d6c'); }
    oval(c, 6, 11, 20, 19, '#c0c4cc'); oval(c, 7, 12, 18, 17, '#d62f2f'); oval(c, 9, 13, 14, 14, '#f6f6f8'); oval(c, 10, 14, 10, 8, '#ffffff');
    for (const [x, y] of [[15, 11], [6, 20], [25, 20], [8, 14], [23, 14], [8, 26], [23, 26]]) P(c, x, y, '#e4e7ec');
    R(c, 10, 19, 12, 3, '#d62f2f'); R(c, 11, 20, 10, 1, '#ffd23f');
    outline(c);
  },
});
defineTile('flower_stand', {
  solid: true, obj: true,
  draw(c) {
    R(c, 7, 9, 2, 7, '#6e4428'); R(c, 4, 15, 8, 1, '#6e4428');
    disc(c, 8, 5, 5, '#ff7eb6'); disc(c, 8, 5, 3, '#ffd3e3'); disc(c, 8, 5, 1, '#ffd23f');
    R(c, 6, 10, 4, 4, '#ffffff'); R(c, 7, 11, 2, 2, '#d62f2f');
  },
  // celebratory flower stand ("hanawa"): a ring of blooms on an easel
  hd(c, r) {
    shadowEllipse(c, 16, 30, 9, 1);
    line(c, 15, 18, 9, 30, '#6e4428'); line(c, 16, 18, 22, 30, '#6e4428'); R(c, 15, 18, 2, 12, '#8a5a33');
    ring(c, 16, 10, 5.5, 10.5, '#ff7eb6');
    blobs(c, [[16, 2, 3], [9, 4, 3], [23, 4, 3], [6, 10, 3], [26, 10, 3], [9, 16, 3], [23, 16, 3], [16, 18, 3]], ['#c8487e', '#ff7eb6', '#ff9cc8', '#ffd3e3']);
    ring(c, 16, 10, 3.5, 5.5, '#ffd3e3'); oval(c, 13, 7, 6, 6, '#ffd23f'); P(c, 14, 8, '#fff6a8');
    speckle(c, r, ['#ffffff', '#ffd23f'], 10, 6, 1, 20, 18);
    R(c, 12, 20, 8, 8, '#ffffff'); R(c, 12, 27, 8, 1, '#d5d9e0'); R(c, 14, 22, 4, 4, '#d62f2f'); R(c, 15, 23, 2, 2, '#ff6f7a');
    outline(c);
  },
});
defineTile('director_chair', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 2, 10, 4, '#20232a'); R(c, 4, 3, 8, 2, '#3b3f48');
    R(c, 3, 8, 10, 2, '#20232a'); R(c, 3, 2, 1, 13, '#c48a52'); R(c, 12, 2, 1, 13, '#c48a52');
    for (let i = 0; i < 5; i++) { P(c, 4 + i * 2, 10 + i, '#c48a52'); P(c, 11 - i * 2, 10 + i, '#c48a52'); }
  },
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    line(c, 8, 20, 23, 29, '#a87449'); line(c, 8, 21, 22, 29, '#c48a52'); line(c, 23, 20, 8, 29, '#a87449'); line(c, 23, 21, 9, 29, '#c48a52');
    for (const x of [6, 24]) { R(c, x, 3, 2, 27, '#c48a52'); R(c, x, 3, 1, 27, '#dca26a'); }
    R(c, 8, 4, 16, 8, '#20232a'); R(c, 8, 5, 16, 6, '#3b3f48'); R(c, 8, 5, 16, 1, '#4a4e58');
    R(c, 11, 7, 10, 2, '#ffffff'); R(c, 13, 7, 1, 2, '#3b3f48'); R(c, 17, 7, 1, 2, '#3b3f48');
    R(c, 6, 16, 20, 4, '#20232a'); R(c, 6, 16, 20, 1, '#4a4e58');
    R(c, 4, 14, 4, 2, '#c48a52'); R(c, 24, 14, 4, 2, '#c48a52');
    outline(c);
  },
});
defineTile('lightstand_back', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 2, 16, 2, '#3b3f48');
    for (const x of [1, 6, 11]) { R(c, x, 4, 4, 4, '#20232a'); R(c, x + 1, 7, 2, 1, '#fff6a8'); }
  },
  hd(c) {
    R(c, 0, 4, 32, 3, '#3b3f48'); R(c, 0, 4, 32, 1, '#5a5f6b');
    for (const x of [2, 12, 22]) {
      R(c, x + 3, 7, 2, 2, '#3b3f48');
      R(c, x, 9, 8, 7, '#20232a'); R(c, x, 9, 8, 1, '#3b3f48'); R(c, x + 1, 13, 6, 3, '#4a4e58');
      R(c, x + 1, 14, 6, 2, '#fff6a8'); R(c, x + 2, 15, 4, 1, '#ffffff');
    }
    outline(c);
  },
});
defineTile('green_screen', {
  solid: true,
  draw(c, r) { R(c, 0, 0, 16, 16, '#22b14c'); speckle(c, r, ['#1fa045'], 6); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#22b14c'); speckle(c, r, ['#1fa045', '#26b852'], 24);
    for (let x = 0; x < 32; x += 16) R(c, x + 9, 0, 1, 32, '#20a848');
  },
});
defineTile('set_wall', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    const col = ['#ffd23f', '#5fd7ff', '#ff7eb6'][v];
    R(c, 0, 0, 16, 16, col); for (let x = 0; x < 16; x += 4) R(c, x, 0, 2, 16, shade(col, 0.25));
    R(c, 0, 13, 16, 3, shade(col, -0.35));
  },
  hd(c, r, f, v) {
    const col = ['#ffd23f', '#5fd7ff', '#ff7eb6'][v];
    R(c, 0, 0, 32, 32, col);
    for (let x = 0; x < 32; x += 8) { R(c, x, 0, 4, 26, shade(col, 0.25)); R(c, x + 4, 0, 1, 26, shade(col, -0.06)); }
    R(c, 0, 0, 32, 1, shade(col, 0.45));
    R(c, 0, 26, 32, 6, shade(col, -0.35)); R(c, 0, 26, 32, 1, shade(col, -0.5)); R(c, 0, 27, 32, 1, shade(col, -0.2));
  },
});
defineTile('stage_edge', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#5a3a20'); R(c, 0, 0, 16, 3, '#ddb06e'); R(c, 0, 3, 16, 1, '#3a2512'); for (let x = 2; x < 16; x += 5) R(c, x, 7, 2, 2, '#fff6a8'); },
  hd(c) {
    R(c, 0, 0, 32, 32, '#5a3a20');
    R(c, 0, 0, 32, 6, '#ddb06e'); R(c, 0, 0, 32, 1, '#f0ca90'); R(c, 0, 5, 32, 1, '#b88a4c');
    R(c, 0, 6, 32, 2, '#3a2512');
    for (let x = 0; x < 32; x += 8) { R(c, x, 8, 1, 24, '#4a2e18'); R(c, x + 1, 8, 1, 24, '#6e4a2a'); }
    for (let x = 4; x < 32; x += 10) {
      R(c, x, 13, 5, 5, '#2a1a0e'); R(c, x + 1, 14, 3, 3, '#fff6a8'); P(c, x + 1, 14, '#ffffff');
    }
    R(c, 0, 30, 32, 2, '#3a2512');
  },
});
defineTile('kanban_takoyaki', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 1, 16, 12, '#20232a'); R(c, 1, 2, 14, 10, '#ff8a3d');
    disc(c, 5, 7, 3, '#8a4a20'); disc(c, 11, 7, 3, '#8a4a20'); P(c, 4, 6, '#5ee07a'); P(c, 10, 6, '#5ee07a'); R(c, 3, 5, 3, 1, '#ffd3a8'); R(c, 9, 5, 3, 1, '#ffd3a8');
  },
  hd(c) {
    R(c, 0, 2, 32, 24, '#20232a'); R(c, 2, 4, 28, 20, '#ff8a3d'); R(c, 2, 4, 28, 1, '#ffb070'); R(c, 2, 23, 28, 1, '#d86a20');
    for (const cx of [10, 22]) {
      blobs(c, [[cx, 14, 6]], ['#5a2e10', '#8a4a20', '#a8622e', '#c87a40']);
      R(c, cx - 4, 10, 7, 2, '#ffd3a8'); P(c, cx - 3, 12, '#ffd3a8'); P(c, cx + 2, 12, '#ffd3a8');
      R(c, cx - 3, 13, 5, 1, '#5a2e10');
      for (const [dx, dy] of [[-2, 9], [1, 10], [3, 9]]) P(c, cx + dx, dy, '#5ee07a');
      P(c, cx - 1, 15, '#d62f2f');
    }
    outline(c);
  },
});
defineTile('lantern', {
  solid: true, obj: true,
  draw(c) {
    R(c, 7, 0, 2, 3, '#20232a'); R(c, 4, 3, 8, 11, '#d62f2f'); R(c, 3, 5, 10, 7, '#d62f2f');
    R(c, 4, 3, 8, 1, '#20232a'); R(c, 4, 13, 8, 1, '#20232a'); R(c, 6, 6, 4, 4, '#20232a'); R(c, 7, 7, 2, 2, '#d62f2f');
    R(c, 3, 6, 1, 4, '#ff5d6c');
  },
  // red paper lantern ("chochin") with ribs, black caps and a round crest
  hd(c) {
    R(c, 15, 0, 2, 5, '#20232a');
    oval(c, 5, 5, 22, 24, '#d62f2f');
    for (let y = 9; y < 27; y += 3) R(c, 6, y, 20, 1, '#b02020');
    oval(c, 7, 7, 4, 18, '#ff5d6c'); R(c, 8, 9, 1, 14, '#ff8a94');
    R(c, 22, 9, 2, 16, '#a81c1c');
    R(c, 9, 4, 14, 3, '#20232a'); R(c, 10, 4, 12, 1, '#3b3f48'); R(c, 9, 27, 14, 3, '#20232a'); R(c, 10, 27, 12, 1, '#3b3f48');
    ring(c, 16, 17, 3.6, 6, '#20232a'); oval(c, 14, 15, 4, 4, '#20232a'); P(c, 12, 14, '#3b3f48');
    outline(c);
  },
});

// ---------------------------------------------------------------- R29: more variants for the street furniture and paving (each wraps the original drawing and adds the variant's own marks)
function moreVariants(id, n, extra) {
  const t = TILES[id];
  if (!t) return;
  const hd0 = t.hd, draw0 = t.draw;
  t.variants = n;
  if (hd0) t.hd = function (c, r, f, v) { hd0.call(this, c, r, f, v); try { extra(c, r, v || 0, true); } catch (e) { /* a mark must never break a tile */ } };
  if (draw0) t.draw = function (c, r, f, v) { draw0.call(this, c, r, f, v); };
  for (const k of cache.keys()) if (k.startsWith(id + '|')) cache.delete(k);
}
// sidewalk: 0 plain, 1 darker slabs, 2 a manhole cover, 3 a worn patch with a hairline crack, 4 tactile-free warm slabs
moreVariants('sidewalk', 5, (c, r, v) => {
  if (v === 1) { for (let i = 0; i < 40; i++) Pw(c, RND(r, 32), RND(r, 32), '#bfc0c7'); R(c, 0, 0, 32, 1, '#cbccd2'); }
  if (v === 2) { ring(c, 16, 16, 7, 8, '#7e828c'); disc(c, 16, 16, 6, '#9a9ea8'); for (const y of [12, 14, 16, 18, 20]) R(c, 11, y, 10, 1, '#80848e'); R(c, 15, 10, 2, 12, '#80848e'); }
  if (v === 3) { for (let i = 0; i < 9; i++) Pw(c, 6 + i * 2, 8 + ((i * 5) % 7), '#a9aab2'); Pw(c, 13, 12, '#a9aab2'); for (let i = 0; i < 30; i++) Pw(c, 4 + RND(r, 20), 18 + RND(r, 10), '#c0c1c8'); }
  if (v === 4) { for (let i = 0; i < 30; i++) Pw(c, RND(r, 32), RND(r, 32), '#d8d0c0'); R(c, 0, 0, 32, 32, 'rgba(214,190,150,0.14)'); }
});
// lamp: 0 as drawn, 1 green-painted post, 2 a white globe, 3 a classic bronze lantern
moreVariants('lamp', 4, (c, r, v) => {
  if (v === 1) { R(c, 14, 8, 4, 20, '#3f6a4a'); R(c, 14, 8, 1, 20, '#5f8a6a'); R(c, 17, 8, 1, 20, '#2c4c34'); R(c, 10, 2, 12, 6, '#2c4c34'); R(c, 11, 2, 10, 1, '#4a7656'); }
  if (v === 2) { disc(c, 16, 5, 6, '#e8e8ee'); disc(c, 16, 5, 5, '#fffdf0'); R(c, 13, 3, 3, 2, '#ffffff'); R(c, 14, 10, 4, 18, '#5a5f6b'); R(c, 14, 10, 1, 18, '#8d939f'); R(c, 12, 26, 8, 4, '#4a4e58'); }
  if (v === 3) { R(c, 14, 10, 4, 18, '#6a4a2a'); R(c, 14, 10, 1, 18, '#8a6a44'); R(c, 11, 3, 10, 7, '#6a4a2a'); R(c, 12, 4, 8, 5, '#ffe9a0'); R(c, 15, 4, 2, 5, '#fff7d0'); R(c, 10, 2, 12, 1, '#8a6a44'); R(c, 15, 0, 2, 2, '#6a4a2a'); R(c, 12, 26, 8, 4, '#5a3c22'); }
});
// bench: 0 wood, 1 green-painted slats, 2 pale slats, 3 stone-and-wood
moreVariants('bench', 4, (c, r, v) => {
  if (v === 1) { for (const y of [9, 12]) { R(c, 2, y, 28, 2, '#3f6a4a'); R(c, 2, y, 28, 1, '#5f8a6a'); } for (const y of [16, 18, 20]) { R(c, 2, y, 28, 2, '#4f8a5e'); R(c, 2, y, 28, 1, '#74ac84'); } }
  if (v === 2) { for (const y of [9, 12]) { R(c, 2, y, 28, 2, '#c8b898'); R(c, 2, y, 28, 1, '#e0d2b4'); } for (const y of [16, 18, 20]) { R(c, 2, y, 28, 2, '#dccaa6'); R(c, 2, y, 28, 1, '#f0e2c2'); } }
  if (v === 3) { for (const x of [4, 24]) { R(c, x, 22, 4, 5, '#a9adb7'); R(c, x, 22, 1, 5, '#c4c8d0'); R(c, x + 3, 22, 1, 5, '#8e929c'); } }
});
// stone paving: 0 granite setts, 1 darker, 2 mossy, 3 a pale joint pattern
moreVariants('stone', 4, (c, r, v) => {
  if (v === 1) R(c, 0, 0, 32, 32, 'rgba(40,44,56,0.18)');
  if (v === 2) { for (let i = 0; i < 22; i++) Pw(c, RND(r, 32), RND(r, 32), i % 3 ? '#6c8a58' : '#86a46e'); R(c, 0, 15, 32, 1, 'rgba(90,120,70,0.35)'); }
  if (v === 3) R(c, 0, 0, 32, 32, 'rgba(255,255,255,0.12)');
});
// the dirt path: 0 / 1 as before, 2 with wheel ruts, 3 with a scatter of leaves
moreVariants('path', 4, (c, r, v) => {
  if (v === 2) { R(c, 6, 0, 3, 32, 'rgba(120,90,50,0.22)'); R(c, 23, 0, 3, 32, 'rgba(120,90,50,0.22)'); }
  if (v === 3) for (const [x, y, col] of [[5, 6, '#c0782c'], [20, 12, '#d89a38'], [12, 22, '#a85a24'], [26, 26, '#d89a38'], [9, 14, '#8a6a30']]) { Pw(c, x, y, col); Pw(c, x + 1, y, col); Pw(c, x, y + 1, shade(col, -0.2)); }
});
