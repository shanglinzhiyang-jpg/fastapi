// Procedural building facades for town maps — native 2x ("HD") pixel art.
//
// Building entity (in a town room's entities):
//   { type: 'building', x, y, w, h, place, door, kind, name, ...options }
// The footprint (w x h tiles) is solid except the door tile (x + door, y + h - 1),
// which is the entrance ('theater' and 'station' have three door tiles,
// door-1..door+1; `doors: [dx, ...]` overrides). Everything below only changes
// the LOOK: footprints and doors are read by map.js and never move.
//
// Drawing: each building is painted once into a cached canvas at 2 px per unit
// (one cache pixel = one screen pixel on the map), keyed by its look options, and
// blitted every frame; only animated bits (marquee bulbs, ON AIR lamp, neon,
// aviation lights, barber pole, bath smoke) and logos are drawn per frame.
// Changing an option at run time (e.g. b.sign = {...}) simply makes a new cache.
//
// KINDS (default kind: 'office')
//   office      corporate HQ: parapet, signboard, window grid, entrance canopy
//   hotel       like office, tiled wall, lit / curtained windows, entrance plants
//   tower       style 'glass' (default when `logo` is set): glass curtain-wall HQ
//               with a rooftop antenna; style 'residential' (default otherwise):
//               tall apartment tower with balconies, lit crown and lobby podium,
//               drawn `rise` tiles (default 4) taller than its footprint
//   theater     stepped crown with bulbs, lit signboard, chasing marquee, framed
//               posters, three curtain doors
//   studio      arched corrugated hangar, roller door, ON AIR lamp (onair: false)
//   house       2-storey wooden apartment (アパート): tiled roof, walkway with
//               railing, outside stairs
//   shop        convenience-store style: parapet, stripes, sign, glass front
//   small       little eatery: tiled eave, sign, counter window, noren, lanterns
//   bath        sento: tiled roof with karahafu gable, chimney with smoke, noren
//   station     tiled roof, clock tower, arched windows, three glass doors
//               (brick texture automatically when the wall colour is brick-red)
//   mansion     mid-rise apartment block (マンション): balconies with laundry,
//               futons and plants, crown (sign shown on it), lobby entrance
//   arcade      shop under a 商店街 arcade roof (glass vault + beam spanning the
//               full width, so neighbouring arcade shops join up), sign, awning
//   cafe        cornice, wooden signboard, striped awning, big wood-framed
//               windows, terrace table and A-frame menu board
//   restaurant  family restaurant: tiled mansard roof with the sign on it,
//               booth windows and a food-sample case by the door
//   gym         dark modern facade, accent stripe, glass front with machines
//   salon       beauty salon: cornice with gold line, arched windows with
//               mirrors, plants (pole: true adds a spinning barber pole)
//   aliases     konbini convenience supermarket karaoke ramen famires flower
//               florist cake bakery realestate furniture bookstore boutique
//               apartment hair beauty fitness coffee: one of the kinds above
//               with fitting defaults (see ALIASES; your options still win)
//   An unknown kind is drawn as 'office'.
//
// OPTIONS (all optional; every kind has sensible defaults)
//   wall, roof        main colours (roof = parapet / roof / cornice / crown)
//   glass             window glass colour
//   texture           wall texture: 'plain' 'concrete' 'stucco' 'tile' 'stone'
//                     'brick' 'siding' 'lap' 'wood'
//   sign              { text, bg, color, size } signboard (default text: name;
//                     mansion / residential tower only show a sign when given).
//                     Lettering is DotGothic16's exact dot bitmap scaled to 2x
//                     with a signage bold that keeps every counter open; size
//                     defaults to 16 on boards >= 26 units tall, 12 on >= 14, else
//                     10, and shrinks (12 -> 10 -> 8...) to fit the board's height
//                     and squeezes to its width
//   signBg, signColor default signboard background / lettering colour when
//                     `sign` gives none (signBg is also the board behind a logo)
//   logo              company logo on the signboard (see logos.js)
//   signW, signH      signboard size in units (corporate, theater, studio, shop...)
//   stripes           ['#c', ...] colour bands under the roof (shop, small, bath)
//   awning            '#c' or ['#c1', '#c2'] striped scalloped awning (shop,
//                     small, arcade, cafe, restaurant, salon)
//   display           what shows in shop windows: 'goods' 'produce' 'flowers'
//                     'cakes' 'food' 'booths' 'cafe' 'counter' 'books' 'clothes'
//                     'furniture' 'listings' (real estate) 'gym' 'mirrors'
//                     'karaoke' 'games' 'lattice' 'plain'. Default for shop /
//                     small / arcade: guessed from the name or sign text (ゲーム ->
//                     'games', 花 -> 'flowers'...), else 'goods' ('counter' for
//                     small); bath 'lattice'; cafe, restaurant, gym, salon have
//                     their own ('cafe', 'booths', 'gym', 'mirrors')
//   doorKind          'glass' 'wood' 'woodglass' 'noren' 'curtain' 'shutter' 'open'
//   noren             noren colour (doorKind 'noren')
//   canopy            entrance canopy colour (office, hotel, tower)
//   lanterns          true: red paper lanterns by the door (default for 'small')
//   plants            true: potted plants beside the door
//   neon              '#c' animated neon tube around the signboard (karaoke...)
//   accent            accent colour (gym stripe, salon cornice line, mansion panels)
//   balcony           balcony panel colour (mansion, residential tower)
//   rise              extra tiles drawn ABOVE the footprint (mansion, tower,
//                     office, hotel); the door row stays where it is
//   floorH            storey height in units (mansion 18, residential tower 10)
//   deco              arcade decorations: 'flags' (default) 'lanterns' 'sakura' 'none'
//   terrace           cafe terrace table (default true)
//   chimney           bath chimney (default true)
//   onair             studio ON AIR lamp (default true)
//   style             tower: 'glass' | 'residential'
//   decorate(ctx, px, py, t)  extra per-frame drawing on top (world units)

import { TILE, shade, mix, mulberry32, makeCanvas } from './util.js';
import { drawLogo, LOGOS } from './logos.js';
import { setFont } from './draw.js';

export const BUILDING_KINDS = ['office', 'hotel', 'tower', 'theater', 'studio', 'house', 'shop', 'small', 'bath', 'station',
  'mansion', 'arcade', 'cafe', 'restaurant', 'gym', 'salon'];

const OUT = '#22202a';
const S = 2;               // cache pixels per unit (= screen pixels per unit on the map)
const LIT = '#ffe9a0';
const q = (v) => Math.round(v * 2) / 2;

// ---------------------------------------------------------------- painter
// While a building is being cached, C is its context, set up so that one unit is
// 2 pixels and (0, 0) is the footprint's top-left: all coordinates are units and
// multiples of 0.5 (= one screen pixel).
let C = null;
let rnd = Math.random;

function R(x, y, w, h, col) { if (w > 0 && h > 0) { C.fillStyle = col; C.fillRect(x, y, w, h); } }
function P(x, y, col) { C.fillStyle = col; C.fillRect(x, y, 0.5, 0.5); }
const HL = (x, y, w, col) => R(x, y, w, 0.5, col);
const VL = (x, y, h, col) => R(x, y, 0.5, h, col);
const edge = (col, k = 0.55) => mix(col, OUT, k);

function dither(x, y, w, h, col, ph = 0) {
  C.fillStyle = col;
  for (let j = 0; j < h * 2; j++) for (let i = (j + ph) & 1; i < w * 2; i += 2) C.fillRect(x + i / 2, y + j / 2, 0.5, 0.5);
}
function speckle(x, y, w, h, cols, density) {
  const n = Math.round(w * h * 4 * density);
  for (let i = 0; i < n; i++) P(x + Math.floor(rnd() * w * 2) / 2, y + Math.floor(rnd() * h * 2) / 2, cols[Math.floor(rnd() * cols.length)]);
}
// Filled ellipse inside the box (x, y, w, h).
function oval(x, y, w, h, col) {
  C.fillStyle = col;
  for (let j = 0; j < h * 2; j++) {
    const dy = (j + 0.5 - h) / h;
    const half = (w / 2) * Math.sqrt(Math.max(0, 1 - dy * dy));
    const a = q(x + w / 2 - half), z = q(x + w / 2 + half);
    if (z > a) C.fillRect(a, y + j / 2, z - a, 0.5);
  }
}
// Round clumps (bushes, flowers) shaded from the top-left into pal (dark -> light).
function blob(lumps, pal) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, r] of lumps) { x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r); }
  x0 = Math.floor(x0 * 2) / 2; y0 = Math.floor(y0 * 2) / 2;
  for (let y = y0; y < y1; y += 0.5) {
    for (let x = x0; x < x1; x += 0.5) {
      let hit = false, nx = 0, ny = 0;
      for (const [cx, cy, r] of lumps) {
        const ddx = (x + 0.25 - cx) / r, ddy = (y + 0.25 - cy) / r;
        if (ddx * ddx + ddy * ddy <= 1) { hit = true; nx = ddx; ny = ddy; }
      }
      if (!hit) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = -0.5 * nx - 0.62 * ny + 0.6 * nz;
      const tt = (l + 0.35) / 1.3 + (((x + y) * 2) & 1 ? 0.06 : -0.06);
      P(x, y, pal[Math.max(0, Math.min(pal.length - 1, Math.floor(tt * pal.length)))]);
    }
  }
}
const ramp = (c) => [shade(c, -0.4), shade(c, -0.2), c, shade(c, 0.22)];

// Two diagonal glints ("//") across a pane, clipped to it.
function streaks(x, y, w, h, col, a = 0.42, b = 0.7) {
  const wp = Math.round(w * 2), hp = Math.round(h * 2);
  C.fillStyle = col;
  for (const [s, k] of [[Math.round(wp * a), 2], [Math.round(wp * b), 1]]) {
    for (let j = 0; j < hp; j++) {
      for (let i = 0; i < k; i++) {
        const xx = s - j + i;
        if (xx >= 0 && xx < wp) C.fillRect(x + xx / 2, y + j / 2, 0.5, 0.5);
      }
    }
  }
}

// 3x5 pixel font for tiny labels (room numbers, ON AIR, OPEN).
const MINI = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', Y: '101101010010010',
};
const miniW = (str) => str.length * 2 - 0.5;
function mini(str, x, y, col, ctx = null, ox = 0, oy = 0) {
  const c = ctx || C;
  c.fillStyle = col;
  for (let k = 0; k < str.length; k++) {
    const g = MINI[str[k]];
    if (!g) continue;
    for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(ox + x + k * 2 + (i % 3) * 0.5, oy + y + Math.floor(i / 3) * 0.5, 0.5, 0.5);
  }
}

// Crisp signboard lettering. DotGothic16 is drawn on a 16-dot em grid, but at
// small sizes the browser hints and anti-aliases it off that grid, so we render
// the label big (one font dot = DOT px), sample each dot's centre to get the
// font's exact dot bitmap, and scale that bitmap to the asked size per axis by
// area coverage (a pixel is ink when at least half of it is ink). At size 12
// (1.5 px per dot) every stroke comes out an even 2px and every counter / gap
// stays open (>= 1px) even in dense kanji like 駅 劇 舗; size 8 is the native
// 1:1 bitmap and 16 exact 2x2 dots. A squeeze to fit maxW is applied to the
// bitmap the same way (below 1x a pixel is ink when any of it is, so thin stems
// never vanish). Finally a signage bold widens strokes by 1px right and down
// wherever that keeps the gap behind them open.
const DOT = 8, BIGPX = 16 * DOT, BASE = Math.round(BIGPX * 1.05);
let gridOff = null;
function fontGrid() {
  if (gridOff) return gridOff;
  const n = BIGPX + 32;
  const [, c] = makeCanvas(n, BASE + 40);
  setFont(c, BIGPX);
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#000';
  c.fillText('口', DOT, BASE);
  const d = c.getImageData(0, 0, n, BASE + 40).data;
  let x0 = n, y0 = BASE + 40;
  for (let p = 0; p < n * (BASE + 40); p++) {
    if (d[p * 4 + 3] < 128) continue;
    const x = p % n, y = (p - x) / n;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
  }
  if (y0 > BASE) { x0 = 0; y0 = 0; }
  return (gridOff = [x0 % DOT, y0 % DOT]);
}
// dest index -> [src index, fraction of the dest pixel it covers, ...]
function coverAxis(n, f, dn) {
  const t = [];
  for (let X = 0; X < dn; X++) {
    const a = X / f, b = (X + 1) / f, l = [];
    for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++) {
      const wgt = (Math.min(b, i + 1) - Math.max(a, i)) * f;
      if (wgt > 1e-6) l.push(i, wgt);
    }
    t.push(l);
  }
  return t;
}
function scaleBits(src, sw, sh, fx, fy) {
  const w = Math.max(1, Math.round(sw * fx)), h = Math.max(1, Math.round(sh * fy));
  const ax = coverAxis(sw, fx, w), ay = coverAxis(sh, fy, h);
  const mid = new Uint8Array(w * sh);
  for (let y = 0; y < sh; y++) {
    for (let X = 0; X < w; X++) {
      const l = ax[X];
      let cov = 0;
      for (let k = 0; k < l.length; k += 2) if (src[y * sw + l[k]]) cov += l[k + 1];
      mid[y * w + X] = fx >= 1 ? cov >= 0.5 - 1e-6 : cov > 0;
    }
  }
  const out = new Uint8Array(w * h);
  for (let Y = 0; Y < h; Y++) {
    const l = ay[Y];
    for (let X = 0; X < w; X++) {
      let cov = 0;
      for (let k = 0; k < l.length; k += 2) if (mid[l[k] * w + X]) cov += l[k + 1];
      out[Y * w + X] = fy >= 1 ? cov >= 0.5 - 1e-6 : cov > 0;
    }
  }
  return { out, w, h };
}
// Signage bold that never closes a counter: a pixel right of (dx) / below (dy)
// ink becomes ink unless the pixel after it is ink too (it is a 1px gap).
function embolden(src, w, h, dx, dy) {
  const out = src.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (src[p] || x < dx || y < dy || !src[p - dy * w - dx]) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < w && ny < h && src[ny * w + nx]) continue;
      out[p] = 1;
    }
  }
  return out;
}
// Returns the mask canvas, the squeeze and the ink box in pixels.
function textMask(str, size, maxW) {
  const [px0, py0] = fontGrid();
  const [, m] = makeCanvas(2, 2);
  setFont(m, BIGPX);
  const bw = Math.ceil(m.measureText(str).width) + DOT * 3, bh = BASE + DOT * 6;
  const [, bc] = makeCanvas(bw, bh);
  setFont(bc, BIGPX);
  bc.textBaseline = 'alphabetic';
  bc.fillStyle = '#000';
  bc.fillText(str, DOT, BASE);
  const bd = bc.getImageData(0, 0, bw, bh).data;
  const sw = Math.floor((bw - px0) / DOT), sh = Math.floor((bh - py0) / DOT);
  const bits = new Uint8Array(sw * sh);
  let c0 = sw, c1 = -1;
  for (let j = 0; j < sh; j++) {
    const yy = py0 + j * DOT + (DOT >> 1);
    for (let i = 0; i < sw; i++) {
      if (bd[(yy * bw + px0 + i * DOT + (DOT >> 1)) * 4 + 3] >= 128) {
        bits[j * sw + i] = 1;
        if (i < c0) c0 = i;
        if (i > c1) c1 = i;
      }
    }
  }
  const tw = c1 >= c0 ? c1 - c0 + 1 : 1;   // ink width in dots
  const f = (size * S) / 16;
  const k = maxW && tw * f > maxW * S ? (maxW * S) / (tw * f) : 1;
  const sc = scaleBits(bits, sw, sh, f * k, f);
  const w = sc.w, h = sc.h;
  const out = embolden(embolden(sc.out, w, h, 1, 0), w, h, 0, 1);
  const [cv, c] = makeCanvas(w, h);
  const img = c.createImageData(w, h), d = img.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let p = 0; p < w * h; p++) {
    if (!out[p]) continue;
    d[p * 4 + 3] = 255;
    const px = p % w, py = (p - px) / w;
    if (px < x0) x0 = px; if (px > x1) x1 = px;
    if (py < y0) y0 = py; if (py > y1) y1 = py;
  }
  c.putImageData(img, 0, 0);
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  return { cv, k, ink: [x0, y0, x1 + 1, y1 + 1] };
}
// Largest legible mask for the box: the asked size if its ink fits maxH, else
// smaller (12 -> 10 -> 8 -> ...); a long label drops a size rather than being
// squeezed below 80% (squeezing thins the stems).
function fitText(str, size, maxW, maxH) {
  const sizes = [size];
  for (const s of [12, 10, 8, 7, 6, 5]) if (s < size) sizes.push(s);
  let m = null;
  for (const s of sizes) {
    m = textMask(str, s, maxW);
    const inkH = (m.ink[3] - m.ink[1]) / S;
    if (maxH && inkH > maxH) continue;
    if (m.k < 0.8 && s > 8 && s !== sizes[sizes.length - 1]) continue;
    return m;
  }
  return m;
}
function tinted(mask, col) {
  const [cv, c] = makeCanvas(mask.width, mask.height);
  c.drawImage(mask, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = col;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}
// Text whose INK is centred on (cx, cy), at most maxW x maxH units.
function crispText(str, cx, cy, size, col, maxW, maxH, shadowCol = null) {
  if (str == null || str === '') return;
  const { cv: m, ink } = fitText(String(str), size, maxW, maxH);
  const w = m.width / S, h = m.height / S;
  const x = q(cx - (ink[0] + ink[2]) / 2 / S), y = q(cy - (ink[1] + ink[3]) / 2 / S);
  if (shadowCol) C.drawImage(tinted(m, shadowCol), x + 0.5, y + 0.5, w, h);
  C.drawImage(tinted(m, col), x, y, w, h);
}

// Outline pass: every transparent pixel touching the building becomes a dark
// outline pixel (#22202a tinted toward what it outlines).
function outlinePass(cv, tint = 0.25) {
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const img = c.getImageData(0, 0, W, H), d = img.data, src = new Uint8ClampedArray(d);
  const o = [0x22, 0x20, 0x2a];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (src[i + 3] >= 200) continue;
      let n = -1;
      if (y > 0 && src[i - W * 4 + 3] >= 200) n = i - W * 4;
      else if (x > 0 && src[i - 1] >= 200) n = i - 4;
      else if (x < W - 1 && src[i + 7] >= 200) n = i + 4;
      else if (y < H - 1 && src[i + W * 4 + 3] >= 200) n = i + W * 4;
      if (n < 0) continue;
      for (let k = 0; k < 3; k++) d[i + k] = Math.round(o[k] * (1 - tint) + src[n + k] * tint);
      d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- materials
const isBrick = (hex) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r > g * 1.35 && r > b * 1.5 && r < 225 && r > 110;
};

function wallFill(x, y, w, h, col, tex = 'plain') {
  R(x, y, w, h, col);
  const dk = shade(col, -0.07), lt = shade(col, 0.07);
  if (tex === 'concrete') speckle(x, y, w, h, [dk, lt], 0.02);
  else if (tex === 'stucco') speckle(x, y, w, h, [dk, shade(col, -0.04), lt], 0.045);
  else if (tex === 'tile') {
    for (let yy = y + 3; yy < y + h; yy += 3) HL(x, yy, w, shade(col, -0.05));
    for (let r = 0, yy = y; yy < y + h; yy += 3, r++) {
      for (let xx = x + (r % 2 ? 3 : 6); xx < x + w; xx += 6) VL(xx, yy + 0.5, Math.min(2.5, y + h - yy - 0.5), shade(col, -0.05));
    }
  } else if (tex === 'stone') {
    for (let yy = y + 6; yy < y + h; yy += 6) { HL(x, yy, w, shade(col, -0.1)); HL(x, yy + 0.5, w, lt); }
    for (let r = 0, yy = y; yy < y + h; yy += 6, r++) {
      for (let xx = x + (r % 2 ? 6 : 12); xx < x + w; xx += 12) VL(xx, yy + 1, Math.min(5, y + h - yy - 1), shade(col, -0.1));
    }
  } else if (tex === 'brick') {
    const mortar = mix(col, '#efe6d8', 0.5);
    for (let r = 0, yy = y; yy < y + h; yy += 2, r++) {
      HL(x, yy, w, mortar);
      for (let xx = x - (r % 2 ? 2 : 0); xx < x + w; xx += 4) {
        const v = rnd(), a = Math.max(x, xx + 0.5), z = Math.min(x + w, xx + 4);
        const bh = Math.min(1.5, y + h - yy - 0.5);
        if (v < 0.2) R(a, yy + 0.5, z - a, bh, shade(col, -0.08));
        else if (v > 0.86) R(a, yy + 0.5, z - a, bh, shade(col, 0.07));
        if (xx >= x) VL(xx, yy + 0.5, bh, mortar);
      }
    }
  } else if (tex === 'siding') {
    for (let xx = x + 2; xx < x + w - 0.5; xx += 4) { VL(xx, y, h, lt); VL(xx + 0.5, y, h, shade(col, -0.1)); }
  } else if (tex === 'lap') {
    for (let yy = y + 3; yy < y + h; yy += 3) { HL(x, yy, w, shade(col, -0.12)); HL(x, yy + 0.5, w, lt); }
  } else if (tex === 'wood') {
    for (let xx = x + 3; xx < x + w; xx += 3) VL(xx, y, h, shade(col, -0.14));
    speckle(x, y, w, h, [shade(col, -0.08)], 0.03);
  }
}

function plinth(x, y, w, h, wall) {
  const c = mix(shade(wall, -0.3), '#8a8f99', 0.4);
  R(x, y, w, h, c);
  HL(x, y, w, shade(c, 0.28));
  speckle(x, y + 0.5, w, h - 0.5, [shade(c, -0.1), shade(c, 0.1)], 0.08);
}

// Flat-roof parapet band with coping, panel joints and its shadow on the wall.
function parapet(x, y, w, h, roof, wall) {
  R(x, y, w, h, roof);
  HL(x, y, w, shade(roof, 0.4));
  HL(x, y + 0.5, w, shade(roof, 0.2));
  R(x, y + h - 2, w, 2, shade(roof, -0.25));
  HL(x, y + h - 2, w, shade(roof, -0.12));
  for (let xx = x + 8; xx < x + w - 4; xx += 16) VL(xx, y + 1, h - 3, shade(roof, -0.1));
  HL(x, y + h, w, shade(wall, -0.24));
  HL(x, y + h + 0.5, w, shade(wall, -0.1));
}

function canopy(x, y, w, h, col, wall) {
  R(x + 1, y + h, w - 1, 1, shade(wall, -0.32));
  R(x, y, w, h, col);
  HL(x, y, w, shade(col, 0.42));
  HL(x, y + 0.5, w, shade(col, 0.2));
  R(x, y + h - 1.5, w, 1.5, shade(col, -0.3));
  HL(x, y + h - 1.5, w, shade(col, -0.14));
  for (let xx = x + 4; xx < x + w - 2; xx += 8) R(xx, y + h - 0.5, 1, 0.5, '#fff1b8');
}

// Striped (or plain) fabric awning with a scalloped valance and its shadow.
function awning(x, y, w, h, cols, wall) {
  const arr = Array.isArray(cols) ? cols : [cols, cols];
  const sw = 4;
  R(x + 1, y + h, w - 1, 1, shade(wall, -0.3));
  dither(x + 1, y + h + 1, w - 1, 0.5, shade(wall, -0.2));
  for (let i = 0, xx = x; xx < x + w; xx += sw, i++) {
    const c = arr[i % arr.length], ww = Math.min(sw, x + w - xx);
    R(xx, y, ww, h - 2, c);
    R(xx, y + q((h - 2) * 0.55), ww, h - 2 - q((h - 2) * 0.55), shade(c, -0.1));
    HL(xx, y, ww, shade(c, 0.35));
    // valance scallop
    R(xx, y + h - 2, ww, 1, shade(c, -0.14));
    R(xx + 0.5, y + h - 1, Math.max(0.5, ww - 1), 0.5, shade(c, -0.14));
    R(xx + 1, y + h - 0.5, Math.max(0.5, ww - 2), 0.5, shade(c, -0.24));
  }
  if (arr[0] === arr[1]) for (let xx = x + sw; xx < x + w; xx += sw) VL(xx, y + 0.5, h - 2.5, shade(arr[0], -0.18));
  HL(x, y - 0.5, w, edge(arr[0], 0.6));
}

function lantern(x, y, col = '#d62f2f') {
  VL(x + 1.5, y - 1.5, 1.5, '#3a2512');
  R(x + 0.5, y, 3, 0.5, '#20232a');
  R(x, y + 0.5, 4, 5, col);
  VL(x, y + 1, 4, shade(col, 0.25)); VL(x + 3.5, y + 1, 4, shade(col, -0.25));
  for (let yy = y + 1.5; yy < y + 5.5; yy += 1.5) HL(x, yy, 4, shade(col, -0.18));
  R(x + 1.5, y + 1.5, 1, 3, '#20232a');
  R(x + 0.5, y + 5.5, 3, 0.5, '#20232a');
  P(x + 1.5, y + 6, '#e0b032');
}

function pottedPlant(x, y, size = 6, leaf = '#3f9a4a') {
  // pot (bottom at y + size + 3)
  const pw = q(size * 0.7), px = q(x + (size - pw) / 2);
  R(px, y + size, pw, 3, '#b8653a');
  HL(px, y + size, pw, '#d88a5a');
  VL(px + pw - 0.5, y + size + 0.5, 2.5, '#8a4526');
  const r = size / 2;
  blob([[x + r - 0.5, y + r + 0.5, r * 0.75], [x + r + 0.6, y + r + 0.8, r * 0.7], [x + r, y + r, r * 0.8]], ramp(leaf));
}

// ---------------------------------------------------------------- glass
function glassPane(x, y, w, h, g, o = {}) {
  R(x, y, w, h, g);
  const lo = q(h * 0.56);
  R(x, y + lo, w, h - lo, shade(g, -0.08));
  HL(x, y, w, shade(g, -0.32));
  VL(x, y + 0.5, h - 0.5, shade(g, -0.16));
  if (o.curtain) {
    const cc = o.curtain;
    R(x + 0.5, y + 0.5, Math.min(2.5, w / 3), h - 0.5, cc);
    R(x + w - Math.min(2.5, w / 3), y + 0.5, Math.min(2.5, w / 3), h - 0.5, cc);
    VL(x + 1.5, y + 0.5, h - 0.5, shade(cc, -0.12));
    VL(x + w - 1.5, y + 0.5, h - 0.5, shade(cc, -0.12));
  }
  if (o.streaks !== false) streaks(x, y, w, h, shade(g, 0.48), o.a, o.b);
}

// A framed window: x, y, w, h is the glass; the frame sits around it.
function windowHD(x, y, w, h, o = {}) {
  const glass = o.lit ? LIT : (o.glass || '#8fd0ff');
  const frame = o.frame || '#f4f4f4';
  const wall = o.wall || frame;
  R(x - 1, y - 1, w + 2, h + 2, o.edge || edge(wall, 0.5));
  R(x - 0.5, y - 0.5, w + 1, h + 1, frame);
  HL(x - 0.5, y + h, w + 1, shade(frame, -0.2));
  VL(x + w, y - 0.5, h + 1, shade(frame, -0.12));
  glassPane(x, y, w, h, glass, o);
  if (o.lit) { R(x + 0.5, y + 0.5, w - 1, 1, '#fff6d0'); }
  if (o.mullion) {
    VL(q(x + w / 2) - 0.5, y, h, frame);
    VL(q(x + w / 2), y, h, shade(frame, -0.2));
  }
  if (o.sill !== false) {
    R(x - 1.5, y + h + 1, w + 3, 1, shade(frame, 0.12));
    HL(x - 1.5, y + h + 2, w + 3, shade(wall, -0.28));
  }
}

// ---------------------------------------------------------------- doors (16 x 16 units)
function doorHD(x, y, kind, d) {
  const b = d.b;
  if (kind === 'glass') {
    R(x, y, 16, 16, '#3b3f48');
    R(x + 0.5, y + 0.5, 15, 15.5, '#6a707c');
    HL(x + 0.5, y + 0.5, 15, '#a4aab4');
    VL(x + 0.5, y + 1, 15, '#868c97');
    R(x + 1, y + 1, 14, 1.5, '#474c56');
    P(x + 7.5, y + 1.5, '#8de08d');
    glassPane(x + 1.5, y + 3, 6, 12.5, '#a8dcf5', { a: 0.3, b: 0.62 });
    glassPane(x + 8.5, y + 3, 6, 12.5, '#a8dcf5', { a: 0.3, b: 0.62 });
    R(x + 7.5, y + 3, 1, 12.5, '#3b3f48');
    VL(x + 7.5, y + 3, 12.5, '#5a5f6b');
    VL(x + 6.5, y + 8, 3, '#eef2f6'); VL(x + 9, y + 8, 3, '#eef2f6');
    HL(x + 2, y + 10.5, 4.5, '#ffffff'); HL(x + 9.5, y + 10.5, 4.5, '#ffffff');
    HL(x + 0.5, y + 15.5, 15, '#a4aab4');
  } else if (kind === 'noren') {
    const nc = b.noren || '#2a3a7a';
    R(x, y, 16, 16, '#3a2512');
    VL(x + 0.5, y + 0.5, 15.5, '#6b4526');
    R(x + 1, y + 1, 14, 15, '#f6e7c8');
    for (let gx = x + 3.5; gx < x + 15; gx += 3) VL(gx, y + 7, 6.5, '#c9b48a');
    for (let gy = y + 8.5; gy < y + 13.5; gy += 2.5) HL(x + 1, gy, 14, '#c9b48a');
    R(x + 1, y + 13.5, 14, 2.5, '#7a5230');
    HL(x + 1, y + 13.5, 14, '#9b6a3e');
    VL(x + 8, y + 7, 9, '#7a5230');
    HL(x, y + 0.5, 16, '#20140a');
    R(x + 0.5, y + 1, 15, 6, nc);
    HL(x + 0.5, y + 1, 15, shade(nc, 0.32));
    // a sento's noren has a wide middle panel for its ゆ
    const bath = d.kind === 'bath';
    for (const sx of bath ? [4, 12] : [4, 8, 12]) { VL(x + sx, y + 2.5, 4.5, '#f6e7c8'); VL(x + sx - 0.5, y + 2.5, 4.5, shade(nc, -0.3)); }
    for (const [sx, w] of bath ? [[0.5, 3], [4.5, 7], [12.5, 3]] : [[0.5, 3], [4.5, 3], [8.5, 3], [12.5, 3]]) { HL(x + sx, y + 6.5, w, shade(nc, -0.28)); VL(x + sx + 1, y + 1.5, 4.5, shade(nc, 0.12)); }
    if (bath) {
      // white ゆ on the noren
      const yu = ['0001000', '1011110', '1001001', '1001001', '1011110', '0001000', '0110000'];
      yu.forEach((row, j) => { for (let i = 0; i < 7; i++) if (row[i] === '1') P(x + 6.5 + i * 0.5, y + 2 + j * 0.5, '#ffffff'); });
    } else {
      R(x + 7, y + 3, 2, 2, '#ffffff');
      P(x + 7, y + 3, shade(nc, 0.5)); P(x + 8.5, y + 4.5, shade(nc, 0.5));
    }
  } else if (kind === 'curtain') {
    R(x, y, 16, 16, '#3a2512');
    VL(x + 0.5, y + 0.5, 15.5, '#5a3a20');
    R(x + 1, y + 2, 14, 14, '#a51f2c');
    for (let i = 0; i < 14; i += 3) {
      VL(x + 1 + i, y + 3, 13, '#c8384a');
      R(x + 2.5 + i, y + 3, Math.min(1, 13.5 - i), 13, '#7a1520');
    }
    R(x + 1, y + 1, 14, 2, '#d9a441');
    HL(x + 1, y + 1, 14, '#f4d27a');
    for (let i = 0; i < 14; i += 2) P(x + 1.5 + i, y + 3, '#a8782a');
    HL(x + 1, y + 15.5, 14, '#5e1018');
  } else if (kind === 'shutter') {
    R(x, y, 16, 16, '#3b3f48');
    R(x + 0.5, y + 0.5, 15, 2, '#6a707c');
    HL(x + 0.5, y + 0.5, 15, '#9aa0aa');
    for (let yy = y + 2.5; yy < y + 16; yy += 2) {
      HL(x + 1, yy, 14, '#b4bac4');
      R(x + 1, yy + 0.5, 14, 1, '#8d939e');
      HL(x + 1, yy + 1.5, 14, '#6e747e');
    }
    R(x + 6, y + 14.5, 4, 1, '#4a4f58');
  } else if (kind === 'woodglass') {
    const fc = d.trim || '#7a4a2a';
    R(x + 1, y, 14, 16, shade(fc, -0.4));
    R(x + 1.5, y + 0.5, 13, 15.5, fc);
    VL(x + 1.5, y + 0.5, 15.5, shade(fc, 0.22));
    VL(x + 14, y + 0.5, 15.5, shade(fc, -0.2));
    R(x + 3, y + 2, 10, 9.5, shade(fc, -0.4));
    glassPane(x + 3.5, y + 2.5, 9, 8.5, '#bfe4f4', { a: 0.25, b: 0.55 });
    R(x + 3.5, y + 12.5, 9, 2, shade(fc, -0.15));
    HL(x + 3.5, y + 12.5, 9, shade(fc, -0.35));
    R(x + 12, y + 8.5, 1, 3, '#e0b032');
    P(x + 12, y + 8.5, '#fff2b0');
    // OPEN plate
    P(x + 6, y + 3, '#3a2512'); P(x + 10.5, y + 3, '#3a2512');
    R(x + 4, y + 3.5, 8.5, 4, '#2f5a3a');
    HL(x + 4, y + 3.5, 8.5, '#4a7a5a');
    mini('OPEN', x + 4.5, y + 4.5, '#fff6d8');
    HL(x + 1, y + 15.5, 14, shade(fc, -0.45));
  } else if (kind === 'open') {
    R(x, y, 16, 16, '#3b2c22');
    R(x + 0.5, y + 0.5, 15, 15.5, '#5a4636');
    for (const [yy, cols] of [[y + 4, ['#ff7a5a', '#ffd23f', '#7ad97a']], [y + 9, ['#ffb84a', '#d84a3a', '#a8e070']]]) {
      R(x + 1.5, yy + 2.5, 13, 1, '#8a6a4a');
      for (let i = 0; i < 6; i++) { const c = cols[i % 3]; R(x + 2 + i * 2, yy + 1, 1.5, 1.5, c); P(x + 2 + i * 2, yy + 1, shade(c, 0.4)); }
    }
    HL(x + 0.5, y + 15.5, 15, '#8a6a4a');
  } else {
    // wood
    R(x + 1, y, 14, 16, '#4a2f18');
    R(x + 1.5, y + 0.5, 13, 15.5, '#6b4526');
    R(x + 2, y + 1, 12, 15, '#9b6638');
    VL(x + 2, y + 1, 15, '#b57d4a');
    VL(x + 13.5, y + 1, 15, '#7d5028');
    for (const [py, ph] of [[3, 5], [9.5, 4.5]]) {
      R(x + 4, y + py, 8, ph, '#8a5a30');
      HL(x + 4, y + py, 8, '#6b4526'); VL(x + 4, y + py, ph, '#6b4526');
      HL(x + 4.5, y + py + ph - 0.5, 7.5, '#b57d4a'); VL(x + 11.5, y + py + 0.5, ph - 0.5, '#b57d4a');
    }
    R(x + 11, y + 8, 1.5, 1.5, '#e0b032');
    P(x + 11, y + 8, '#fff2b0');
    P(x + 12, y + 9, '#9a7414');
    HL(x + 1, y + 15.5, 14, '#5a3a20');
  }
}

function doorsOf(d) {
  const b = d.b;
  if (b.doors) return b.doors.map((v) => v * TILE);
  if (d.kind === 'theater' || d.kind === 'station') return [d.dx - TILE, d.dx, d.dx + TILE];
  return [d.dx];
}

// ---------------------------------------------------------------- signboards
function signBoard(d, x, y, w, h, o = {}) {
  const b = d.b;
  x = q(x); y = q(y); w = q(w); h = q(h);
  if (w < 4 || h < 4) return;
  const s = b.sign || { text: b.name || '' };
  const logo = b.logo;
  const bg = logo ? (b.signBg || (LOGOS[logo] && LOGOS[logo].bg) || '#ffffff') : (s.bg || b.signBg || o.bg || '#ffffff');
  const fr = o.frame || '#2a2d36';
  d.signRect = [x, y, w, h];
  if (o.shadow !== false) { R(x + 1, y + h, w, 1, shade(d.wall, -0.24)); R(x + w, y + 1, 1, h, shade(d.wall, -0.24)); }
  R(x, y, w, h, fr);
  R(x + 0.5, y + 0.5, w - 1, h - 1, shade(fr, 0.12));
  HL(x + 0.5, y + 0.5, w - 1, shade(fr, 0.45));
  VL(x + 0.5, y + 0.5, h - 1, shade(fr, 0.35));
  R(x + 1, y + 1, w - 2, h - 2, bg);
  HL(x + 1, y + 1, w - 2, shade(bg, -0.1));
  if (o.lights) {
    const bulb = (bx, by) => { R(bx, by, 1, 1, '#fff6a8'); P(bx, by, '#ffffff'); P(bx + 0.5, by + 0.5, '#e8c05a'); };
    for (let i = 2; i < w - 2; i += 4) { bulb(x + i, y); bulb(x + i, y + h - 1); }
    for (let j = 4; j < h - 3; j += 4) { bulb(x, y + j); bulb(x + w - 1, y + j); }
  }
  if (logo) {
    d.live.push((ctx, px, py) => drawLogo(ctx, logo, px + x + 2, py + y + 2, w - 4, h - 4, {}));
  } else {
    const size = s.size || (h >= 26 ? 16 : h >= 14 ? 12 : 10);
    // ink kept at least a pixel clear of the 1-unit frame
    crispText(s.text || '', x + w / 2, y + h / 2, size, s.color || b.signColor || o.color || '#20232a', w - 5, h - 3, shade(bg, -0.16));
  }
  if (b.neon) {
    const nc = b.neon;
    d.live.push((ctx, px, py, t) => {
      const on = (t >> 2) % 41 !== 0 && (t >> 2) % 43 !== 1;
      const c = on ? nc : shade(nc, -0.45);
      const X = px + x - 1.5, Y = py + y - 1.5, Wd = w + 3, Hd = h + 3;
      ctx.fillStyle = c;
      ctx.fillRect(X, Y, Wd, 0.5); ctx.fillRect(X, Y + Hd - 0.5, Wd, 0.5);
      ctx.fillRect(X, Y, 0.5, Hd); ctx.fillRect(X + Wd - 0.5, Y, 0.5, Hd);
      if (on) {
        ctx.fillStyle = '#ffffff';
        for (let i = ((t >> 3) % 6); i < Wd - 1; i += 6) ctx.fillRect(X + i, Y, 0.5, 0.5);
      }
    });
  }
}

// ---------------------------------------------------------------- shop windows
const GOODS = ['#ff6b6b', '#ffd23f', '#6fd06f', '#5fb2ff', '#ff9a3c', '#f4f4f4', '#c08ae0', '#ff8ac0'];
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function interior(type, x, y, w, h, glass) {
  const shelves = (back, line, colsFn, step = 4.5) => {
    R(x, y, w, h, back);
    HL(x, y + 0.5, w, '#ffffff');
    for (let yy = y + step; yy < y + h - 0.5; yy += step) {
      for (let xx = x + 0.5; xx < x + w - 1; xx += 1.5) {
        if (rnd() < 0.18) continue;
        const ph = rnd() < 0.5 ? 1.5 : 2;
        const c = colsFn();
        R(xx, yy - ph, 1, ph, c);
        P(xx, yy - ph, shade(c, 0.35));
      }
      HL(x, yy, w, line);
      HL(x, yy + 0.5, w, shade(line, -0.2));
    }
  };
  switch (type) {
    case 'goods': shelves('#eef3f6', '#b8bec8', () => pick(GOODS)); break;
    case 'books': shelves('#e9dcc4', '#8a6a4a', () => pick(['#a83a3a', '#2f6fd0', '#2f9a4a', '#e0b032', '#6a4a8a', '#f4f4f4', '#3a3f4a']), 4); break;
    case 'food': {
      R(x, y, w, h, '#fff6e6');
      for (let yy = y + 4; yy < y + h; yy += 4.5) {
        HL(x, yy, w, '#c9b08a');
        for (let xx = x + 0.5; xx + 3 <= x + w; xx += 3.5) {
          oval(xx, yy - 1.5, 3, 1.5, '#ffffff');
          const c = pick(['#e8a040', '#c8642a', '#7ac85a', '#d84a3a', '#f4d27a', '#8a5a33']);
          oval(xx + 0.5, yy - 2.5, 2, 1.5, c);
          P(xx + 1, yy - 2.5, shade(c, 0.4));
        }
      }
      break;
    }
    case 'booths': {
      R(x, y, w, h, '#f6e4bc');
      HL(x, y + 0.5, w, '#fff6dc');
      const wy2 = y + q(h * 0.58);
      R(x, wy2, w, y + h - wy2, '#c89a62');
      HL(x, wy2, w, '#e8c088');
      const py2 = y + q(h * 0.18);
      for (let xx = x + 3; xx + 5 <= x + w - 1; xx += 13) { R(xx, py2, 5, 4, '#8a5a33'); R(xx + 0.5, py2 + 0.5, 4, 3, pick(['#8fc0d8', '#f0c070', '#a8d890'])); HL(xx + 0.5, py2 + 2.5, 4, '#5a8a4a'); }
      const fb = y + h;
      for (let xx = x + 0.5; xx + 8.5 <= x + w; xx += 9) {
        const lx = xx + 4, ly = y + q(h * 0.36);
        VL(lx, y, ly - y, '#5a4636');
        R(lx - 1.5, ly, 3.5, 1.5, '#d9a441'); HL(lx - 1.5, ly, 3.5, '#f4d27a'); HL(lx - 1, ly + 1.5, 2.5, '#fff6c0');
        for (const k of [0, 1]) {
          if (rnd() < 0.75) {
            const hx = xx + (k ? 5 : 1.5);
            R(hx, fb - 11, 2, 2, pick(['#3a2a20', '#6b4a2e', '#20232a', '#c08a50', '#8a8f99']));
            HL(hx, fb - 9, 2, '#f0c8a0');
            R(hx - 0.5, fb - 8.5, 3, 2.5, pick(GOODS));
          }
        }
        R(xx, fb - 8, 1.5, 8, '#c0392b'); HL(xx, fb - 8, 1.5, '#e05a4a'); VL(xx + 1, fb - 7.5, 7.5, '#8a2a20');
        R(xx + 7, fb - 8, 1.5, 8, '#c0392b'); HL(xx + 7, fb - 8, 1.5, '#e05a4a'); VL(xx + 8, fb - 7.5, 7.5, '#8a2a20');
        R(xx + 2, fb - 5.5, 4.5, 1, '#f4f4f4'); HL(xx + 2, fb - 4.5, 4.5, '#b8bec8');
        P(xx + 3, fb - 6, '#ffffff'); P(xx + 5, fb - 6, '#e8a040');
        VL(xx + 4, fb - 4, 4, '#5a5f6b');
      }
      break;
    }
    case 'cafe': {
      R(x, y, w, h, '#f4dcb0');
      HL(x, y + 0.5, w, '#fff2d0');
      for (let xx = x + 2; xx < x + w - 1; xx += 7) { VL(xx + 0.5, y, 2, '#3a2a20'); R(xx - 0.5, y + 2, 2.5, 1, '#2f6b4f'); P(xx, y + 3, '#fff6c0'); }
      HL(x, y + 6, w, '#8a6a4a');
      for (let xx = x + 1; xx < x + w - 1; xx += 2) if (rnd() < 0.7) { R(xx, y + 4.5, 1, 1.5, '#ffffff'); P(xx + 0.5, y + 4.5, '#d9c8a8'); }
      R(x, y + h - 4, w, 4, '#8a5a33');
      HL(x, y + h - 4, w, '#b57d4a');
      HL(x, y + h - 3.5, w, '#6b4526');
      for (let xx = x + 2; xx < x + w - 1.5; xx += 5) if (rnd() < 0.6) { R(xx, y + h - 6, 1.5, 2, '#ffffff'); P(xx + 1, y + h - 5.5, '#d9c8a8'); }
      break;
    }
    case 'counter': {
      R(x, y, w, h, '#e2b878');
      R(x, y, w, 6.5, '#b8844a');
      for (let xx = x + 0.5; xx + 1.5 <= x + w; xx += 2.5) { R(xx, y + 1, 1.5, 4.5, '#fffaf0'); VL(xx + 0.5, y + 1.5, 3, '#4a3a2e'); HL(xx, y + 5, 1.5, '#d9c8a8'); }
      HL(x, y + 6.5, w, '#7a4a2a');
      const cy = y + h - 6;
      if (h > 20) {
        const sy = y + 6.5 + q((cy - 9 - y - 6.5) / 2);
        HL(x, sy + 2, w, '#7a4a2a');
        for (let xx = x + 0.5; xx + 2 <= x + w; xx += 3) { oval(xx, sy, 2.5, 2, '#ffffff'); HL(xx + 0.5, sy + 1.5, 1.5, '#c8642a'); }
      }
      if (w >= 9 && rnd() < 0.7) {
        const cx = q(x + w / 2 - 2);
        R(cx, cy - 4, 4, 4, '#f4f4f4');
        VL(cx + 3.5, cy - 4, 4, '#cfd4dc');
        HL(cx + 1.5, cy - 4, 1, '#f0c8a0');
        R(cx + 0.5, cy - 7.5, 3, 3.5, '#f0c8a0');
        VL(cx + 3, cy - 7, 3, '#d8a880');
        R(cx + 0.5, cy - 8.5, 3, 1.5, '#ffffff');
        HL(cx + 0.5, cy - 7.5, 3, '#2a3a7a');
        P(cx + 1, cy - 6.5, '#20232a'); P(cx + 2.5, cy - 6.5, '#20232a');
        HL(cx + 1.5, cy - 5.5, 1, '#c86a5a');
      }
      R(x, cy, w, 1.5, '#a87040');
      HL(x, cy, w, '#d8a868');
      R(x, cy + 1.5, w, h - (cy - y) - 1.5, '#6b4526');
      for (let xx = x + 1; xx < x + w - 1; xx += 4) VL(xx, cy + 2, h - (cy - y) - 2, '#5a3a20');
      if (w >= 9) { R(x + 1, cy - 1, 4, 1, '#3b3f48'); P(x + 1.5, cy - 1, '#c88a40'); P(x + 3, cy - 1, '#c88a40'); P(x + 4, cy - 1, '#c88a40'); }
      break;
    }
    case 'flowers': {
      R(x, y, w, h, '#dfeee0');
      for (let xx = x + 1; xx < x + w - 1; xx += 4) blob([[xx + 1.5, y + 3, 2]], ramp('#5aa85a'));
      const by = y + h - 5;
      for (let xx = x + 0.5; xx + 3 <= x + w; xx += 3.5) {
        const c = pick(['#ff6b8a', '#ffd23f', '#ff9a3c', '#f4f4f4', '#c08ae0', '#ff4f4f']);
        blob([[xx + 1.5, by - 1, 1.8]], ramp('#4a9a4a'));
        for (let k = 0; k < 4; k++) { const fx = xx + 0.5 + Math.floor(rnd() * 4) * 0.5, fy = by - 2.5 + Math.floor(rnd() * 4) * 0.5; R(fx, fy, 1, 1, c); P(fx, fy, shade(c, 0.45)); }
        R(xx, by + 0.5, 3, 3.5, '#9aa4b0'); HL(xx, by + 0.5, 3, '#d8dde5'); VL(xx + 2.5, by + 1, 3, '#6e7884');
      }
      break;
    }
    case 'cakes': {
      R(x, y, w, h, '#fff4f6');
      for (let xx = x + 1; xx + 3 < x + w; xx += 4) { R(xx, y + 2, 3, 2.5, pick(['#ff9ab8', '#ffd23f', '#9fd8f0'])); HL(xx, y + 2, 3, '#ffffff'); VL(xx + 1.5, y + 2, 2.5, '#d62f2f'); }
      HL(x, y + 5, w, '#e0c8cc');
      const cy = y + h - 7;
      R(x, cy, w, 7, '#f0f6fa');
      HL(x, cy, w, '#ffffff');
      for (let xx = x + 0.5; xx + 2.5 <= x + w; xx += 3) {
        const c = pick(['#fffaf0', '#6b3a20', '#ffd8e4', '#fff0b0']);
        R(xx, cy + 2, 2.5, 2, c); HL(xx, cy + 2, 2.5, shade(c, 0.3)); HL(xx, cy + 3.5, 2.5, shade(c, -0.15));
        P(xx + 1, cy + 1.5, '#e02a3a');
      }
      R(x, cy + 5, w, 2, '#c9b8bc');
      HL(x, cy + 5, w, '#e8dadd');
      break;
    }
    case 'produce': {
      R(x, y, w, h, '#4a3a2e');
      for (let yy = y + 3; yy < y + h - 8; yy += 4) { HL(x, yy, w, '#7a5a3e'); for (let xx = x + 0.5; xx < x + w - 1; xx += 2) if (rnd() < 0.7) { const c = pick(GOODS); R(xx, yy - 1.5, 1.5, 1.5, c); } }
      const cy = y + h - 7;
      for (let xx = x; xx < x + w - 0.5; xx += 5) {
        const ww = Math.min(4.5, x + w - xx);
        const c = pick(['#e8402a', '#ff9a2a', '#ffd23f', '#7ac85a', '#a83a8a', '#5aa83a']);
        for (let k = 0; k < ww - 0.5; k += 1.5) { R(xx + k, cy + 0.5, 1.5, 1.5, c); P(xx + k, cy + 0.5, shade(c, 0.45)); R(xx + k + 0.75 - 0.25, cy - 0.5, 1.5, 1.5, shade(c, 0.08)); }
        R(xx, cy + 2, ww, 4, '#b8864a'); HL(xx, cy + 2, ww, '#d9a86a'); HL(xx, cy + 4, ww, '#8a5a30');
        R(xx + 1, cy + 2.5, 2.5, 1.5, '#ffffff'); HL(xx + 1.5, cy + 3, 1.5, '#d62f2f');
      }
      R(x, y + h - 1, w, 1, '#3a2c22');
      break;
    }
    case 'clothes': {
      R(x, y, w, h, '#f6f0ea');
      HL(x, y + 2, w, '#9aa0aa');
      for (let xx = x + 0.5; xx + 2.5 <= x + w; xx += 3) { const c = pick(GOODS); R(xx, y + 2.5, 2.5, 5, c); R(xx + 0.5, y + 7.5, 1.5, 1, c); HL(xx, y + 2.5, 2.5, shade(c, 0.3)); VL(xx + 2, y + 3, 4.5, shade(c, -0.2)); }
      if (w > 10) { const mx = q(x + w - 5); R(mx + 1, y + h - 9, 3, 6, '#e0e4ea'); R(mx, y + h - 9, 5, 2, '#2f6fd0'); R(mx + 2, y + h - 3, 1, 3, '#8a6a4a'); }
      break;
    }
    case 'furniture': {
      R(x, y, w, h, '#efe6d6');
      const fy = y + h - 3.5;
      R(x, fy, w, 3.5, '#c9a878');
      HL(x, fy, w, '#a88458');
      for (let xx = x + 2; xx < x + w; xx += 4) VL(xx, fy + 0.5, 3, '#b8946a');
      if (w > 9) { R(x + 1.5, y + 2.5, 5.5, 4, '#6b4a2e'); R(x + 2, y + 3, 4.5, 3, '#8fc0d8'); HL(x + 2, y + 5, 4.5, '#5a9a5a'); HL(x + 2, y + 3, 4.5, '#c0e0f0'); }
      const sw = Math.min(14, w - 2), sx = q(x + Math.max(1, (w - sw) / 2 - (w > 18 ? 3 : 0)));
      oval(sx - 1, fy - 0.5, sw + 2, 1.5, '#d8c8a8');
      R(sx, fy - 7, sw, 3, '#c0603a'); HL(sx, fy - 7, sw, '#d8805a');
      R(sx, fy - 4, sw, 2.5, '#d07048'); HL(sx, fy - 4, sw, '#e89070');
      R(sx - 0.5, fy - 5.5, 1.5, 4, '#a84a2a'); R(sx + sw - 1, fy - 5.5, 1.5, 4, '#a84a2a');
      for (let k = sx + 1.5; k + 2.5 < sx + sw - 1; k += 4) { R(k, fy - 6.5, 2.5, 2, '#ffd23f'); HL(k, fy - 6.5, 2.5, '#fff0a0'); }
      VL(sx + 0.5, fy - 1.5, 1.5, '#5a3a20'); VL(sx + sw - 1, fy - 1.5, 1.5, '#5a3a20');
      if (w > 18) {
        const lx = q(x + w - 3);
        VL(lx, y + 4, fy - y - 4, '#3a2a20');
        R(lx - 1.5, y + 2, 3.5, 2.5, '#fff0b0'); HL(lx - 1.5, y + 2, 3.5, '#ffffff'); HL(lx - 1.5, y + 4, 3.5, '#d9b46a');
        HL(lx - 1, fy - 0.5, 2, '#3a2a20');
      }
      break;
    }
    case 'lattice': {
      R(x, y, w, h, '#e6ecef');
      dither(x, y, w, h, '#f4f8fa', 0);
      for (let xx = x + 1.5; xx < x + w - 0.5; xx += 2) { VL(xx, y, h, '#9a7a56'); VL(xx + 0.5, y, h, '#c8a87e'); }
      HL(x, y + q(h * 0.45), w, '#7a5a3a');
      break;
    }
    case 'listings': {
      R(x, y, w, h, shade(glass || '#a8dcf5', 0.25));
      for (let yy = y + 1; yy + 6 <= y + h - 1; yy += 7) {
        for (let xx = x + 1; xx + 5 <= x + w - 0.5; xx += 6) {
          R(xx, yy, 5, 6, '#ffffff');
          HL(xx, yy + 5.5, 5, '#c8ccd4');
          R(xx + 0.5, yy + 0.5, 4, 1, pick(['#2f6fd0', '#2f9a4a', '#ff8a3d']));
          R(xx + 1, yy + 2, 3, 2, '#e8ecf0');
          VL(xx + 1, yy + 2, 2, '#6a707c'); HL(xx + 1, yy + 2, 3, '#6a707c'); VL(xx + 2.5, yy + 2, 2, '#6a707c'); HL(xx + 1, yy + 3.5, 3, '#6a707c');
          HL(xx + 0.5, yy + 4.5, 2.5, '#d62f2f');
        }
      }
      break;
    }
    case 'gym': {
      R(x, y, w, h, '#d8e0e8');
      R(x, y, w, 4, '#eef3f8');
      HL(x, y + 4, w, '#b8c2cc');
      for (let xx = x + 1; xx + 6 <= x + w; xx += 7.5) {
        R(xx, y + h - 3, 6, 1.5, '#3a3f4a'); HL(xx, y + h - 3, 6, '#5a5f6b');
        VL(xx + 5, y + h - 8, 5, '#3a3f4a'); R(xx + 4, y + h - 8.5, 2, 1, '#5a5f6b');
        if (rnd() < 0.6) { R(xx + 2, y + h - 9, 1.5, 1.5, pick(['#3a2a20', '#6b4a2e', '#20232a'])); R(xx + 1.5, y + h - 7.5, 2.5, 3, pick(GOODS)); VL(xx + 2, y + h - 4.5, 1.5, '#20232a'); VL(xx + 3, y + h - 4.5, 1.5, '#20232a'); }
      }
      // dumbbell rack
      HL(x, y + 3.5, w, '#8d939e');
      for (let xx = x + 1, i = 0; xx + 3.5 <= x + w - 0.5; xx += 4.5, i++) {
        const pc = i % 3 === 2 ? '#b8343a' : '#2a2d36';
        HL(xx + 1, y + 2, 1.5, '#b4bac4');
        R(xx, y + 1.5, 1, 1.5, pc); R(xx + 2.5, y + 1.5, 1, 1.5, pc);
        P(xx, y + 1.5, shade(pc, 0.45)); P(xx + 2.5, y + 1.5, shade(pc, 0.45));
      }
      break;
    }
    case 'mirrors': {
      R(x, y, w, h, '#f8eef0');
      const my = y + q(Math.max(2, h * 0.16));
      const cy = y + h - 7;
      for (let xx = x + 1; xx + 5 <= x + w; xx += 6.5) {
        oval(xx, my, 5, 8, '#d9b46a');
        oval(xx + 0.5, my + 0.5, 4, 7, '#cfe8f4');
        VL(xx + 1.5, my + 2, 2.5, '#ffffff');
        HL(xx - 0.5, my + 9, 6, '#ffffff');
        HL(xx - 0.5, my + 9.5, 6, '#d8c8cc');
        P(xx + 0.5, my + 8.5, '#e7a4b8'); P(xx + 3.5, my + 8.5, '#9ad0e0');
        R(xx + 1, cy, 3, 3, '#3a2a30'); HL(xx + 1, cy, 3, '#6a5a60');
        R(xx + 0.5, cy + 3, 4, 1, '#4a3a40'); HL(xx + 0.5, cy + 3, 4, '#7a6a70');
        VL(xx + 2, cy + 4, 2, '#8d939e'); HL(xx + 1, cy + 6, 3, '#aab0ba');
      }
      if (w >= 12) {
        const sx = q(x + w - 4.5);
        R(sx, cy - 6, 2, 2, '#6b4a2e'); HL(sx, cy - 4, 2, '#f0c8a0');
        R(sx - 0.5, cy - 3.5, 3, 4, '#2a2d36'); R(sx, cy + 0.5, 0.5, 2.5, '#2a2d36'); R(sx + 1.5, cy + 0.5, 0.5, 2.5, '#2a2d36');
      }
      HL(x, y + h - 0.5, w, '#d8c8cc');
      break;
    }
    case 'karaoke': {
      R(x, y, w, h, '#2a1f3a');
      for (let k = 0; k < w * h / 8; k++) { const c = pick(['#ff7eb6', '#5fd7ff', '#ffd23f', '#9a7aff']); P(x + Math.floor(rnd() * w * 2) / 2, y + Math.floor(rnd() * (h - 4) * 2) / 2, c); }
      if (w > 6) { const mx = q(x + w / 2); oval(mx - 1.5, y + 1, 3, 3, '#d8dde5'); P(mx - 1, y + 1.5, '#ffffff'); VL(mx, y, 1, '#8d939e'); }
      R(x, y + h - 3, w, 3, '#3a2a4a');
      HL(x, y + h - 3, w, '#5a4a6a');
      break;
    }
    case 'games': {
      R(x, y, w, h, '#2a2d46');
      for (let xx = x + 0.5; xx + 5 <= x + w; xx += 6) {
        const c = pick(['#ff7eb6', '#5fd7ff', '#ffd23f']);
        R(xx, y + 2, 5, h - 3, c); R(xx + 0.5, y + 3, 4, h - 9, '#cfeaf4');
        for (let k = 0; k < 4; k++) { const pc = pick(GOODS); R(xx + 0.5 + k, y + h - 8, 1, 1, pc); }
        VL(xx + 2.5, y + 3, 2, '#8d939e'); R(xx + 2, y + 5, 1.5, 0.5, '#8d939e');
        HL(xx, y + 2, 5, shade(c, 0.4));
      }
      break;
    }
    default: R(x, y, w, h, glass || '#a8dcf5');
  }
  if (type !== 'plain' && type !== 'produce' && type !== 'listings' && type !== 'lattice' && glass) {
    C.globalAlpha = 0.22;
    R(x, y, w, h, glass);
    C.globalAlpha = 1;
  }
}

// Default window display from the shop's name / sign when no `display` is given
// (a game centre shows crane games, a bookshop shelves of books...).
const DISPLAY_HINTS = [
  [/ゲーム/, 'games'], [/カラオケ/, 'karaoke'], [/書店|本屋|古本/, 'books'], [/花/, 'flowers'],
  [/ケーキ|洋菓子|パティスリー|ベーカリー|パン/, 'cakes'], [/不動産/, 'listings'], [/家具|インテリア/, 'furniture'],
  [/服|ブティック|洋品|古着/, 'clothes'], [/八百屋|青果|果物|スーパー/, 'produce'], [/ジム|フィットネス/, 'gym'],
  [/美容|ヘア|サロン|理容|床屋/, 'mirrors'], [/カフェ|喫茶|珈琲|コーヒー/, 'cafe'], [/ラーメン|らーめん|うどん|そば|定食|食堂|居酒屋/, 'counter'],
  [/レストラン|ファミレス|洋食/, 'booths'],
];
function displayFor(b, fallback) {
  if (b.display) return b.display;
  const label = (b.name || '') + ' ' + ((b.sign && b.sign.text) || '');
  for (const [re, v] of DISPLAY_HINTS) if (re.test(label)) return v;
  return fallback;
}

// Display window with frame, interior, glass glints and optional mullions.
function displayWindow(x, y, w, h, o) {
  const wall = o.wall, frame = o.frame || '#f4f4f4';
  const glass = o.glass || '#a8dcf5';
  const type = o.display || 'plain';
  R(x - 1, y - 1, w + 2, h + 2, edge(wall, 0.55));
  R(x - 0.5, y - 0.5, w + 1, h + 1, frame);
  HL(x - 0.5, y - 0.5, w + 1, shade(frame, 0.3));
  HL(x - 0.5, y + h, w + 1, shade(frame, -0.22));
  VL(x + w, y - 0.5, h + 1, shade(frame, -0.14));
  if (o.arch) {
    interior(type, x, y, w, h, type === 'produce' ? null : glass);
    const r = Math.min(4, w / 2);
    for (let j = 0; j < r * 2; j++) {
      const yy = j / 2 + 0.25, cut = q(r - Math.sqrt(Math.max(0, r * r - (r - yy) * (r - yy))));
      if (cut > 0) { R(x, y + j / 2, cut, 0.5, frame); R(x + w - cut, y + j / 2, cut, 0.5, frame); }
    }
  } else interior(type, x, y, w, h, type === 'produce' ? null : glass);
  if (type !== 'produce') {
    HL(x, y, w, shade(glass, -0.3));
    streaks(x, y, w, h, 'rgba(255,255,255,0.55)', 0.3, 0.5);
  }
  for (const mx of o.mullions || []) {
    R(mx - 0.5, y, 1.5, h, frame);
    VL(mx + 0.5, y, h, shade(frame, -0.2));
  }
}

// The shopfront between y0 and the bottom: windows left/right of the door
// (each side at least 6 units wide), a transom over the door.
function shopFront(d, y0, o = {}) {
  const { W, H, dx } = d;
  const m = o.margin ?? 3;
  const yB = H - (o.base ?? 3);
  const segs = [];
  if (dx - 2 - m >= 6) segs.push([m, dx - 2]);
  if (W - m - (dx + 18) >= 6) segs.push([dx + 18, W - m]);
  if (yB - y0 < 5) segs.length = 0;   // no room above the plinth (tiny or sign-heavy facades)
  for (const [a, z] of segs) {
    const mull = [];
    if (z - a > 26) { const n = Math.round((z - a) / 18); for (let i = 1; i < n; i++) mull.push(q(a + ((z - a) * i) / n)); }
    displayWindow(a, y0, z - a, yB - y0, { ...o, wall: d.wall, mullions: mull });
  }
  if (d.dy - y0 > 5 && o.transom !== false) {
    windowHD(d.dx + 1, y0, 14, d.dy - y0 - 2.5, { glass: o.glass || '#a8dcf5', frame: o.frame || '#f4f4f4', wall: d.wall, sill: false });
  }
  if (o.base !== 0 && yB + 1 < H) plinth(0, yB + 1, W, H - yB - 1, d.wall);
  return segs;
}

// ---------------------------------------------------------------- rooftop bits
function acUnit(x, y) {
  R(x, y, 7, 4.5, '#c9ced6');
  HL(x, y, 7, '#e8ecf0');
  VL(x + 6.5, y + 0.5, 4, '#9aa0aa');
  oval(x + 0.5, y + 0.5, 3.5, 3.5, '#8d939e');
  oval(x + 1, y + 1, 2.5, 2.5, '#6e747e');
  P(x + 2, y + 2, '#b4bac4');
  for (let yy = y + 1; yy < y + 4; yy += 1) HL(x + 4.5, yy, 1.5, '#9aa0aa');
}
function roofBox(x, y, w, h, col) {
  R(x, y, w, h, col);
  HL(x, y, w, shade(col, 0.3));
  R(x + w - 2, y + 0.5, 2, h - 0.5, shade(col, -0.18));
}
function waterTank(x, y) {
  R(x, y + 1, 8, 6, '#d8dde5');
  oval(x, y, 8, 2.5, '#eef2f6');
  VL(x + 6.5, y + 1.5, 5.5, '#aab0ba');
  HL(x, y + 4, 8, '#b8bec8');
  R(x + 1, y + 7, 1, 2, '#8d939e'); R(x + 6, y + 7, 1, 2, '#8d939e');
}

// ---------------------------------------------------------------- corporate: office / hotel / glass tower
function windowGrid(x, y, w, h, o) {
  const cw = 10, ch = 9, gx = 4, gy = 5;
  const cols = Math.max(1, Math.floor((w + gx) / (cw + gx)));
  const rows = Math.max(1, Math.floor((h + gy) / (ch + gy)));
  const ox = x + Math.floor((w - (cols * (cw + gx) - gx)) / 2);
  const oy = y + Math.floor((h - (rows * (ch + gy) - gy)) / 2);
  if (o.bands) {
    for (let r = 0; r < rows - 1; r++) {
      const by = oy + r * (ch + gy) + ch + 2.5;
      R(2.5, by, o.W - 7, 1.5, shade(o.wall, 0.08));
      HL(2.5, by + 1.5, o.W - 7, shade(o.wall, -0.1));
    }
  }
  const curtains = ['#f2e6c8', '#e8d0d8', '#d0e0f0'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = ox + c * (cw + gx), wy = oy + r * (ch + gy);
      const lit = o.hotel && (r * 7 + c * 3) % 5 === 0;
      const curtain = o.hotel && !lit && (r + c * 2) % 3 === 1 ? curtains[(r + c) % 3] : null;
      windowHD(wx, wy, cw, ch, { glass: o.glass, frame: o.frame, wall: o.wall, lit, curtain, mullion: o.hotel });
    }
  }
}

function curtainWall(x, y, w, h, glass, wall) {
  // 6-unit glass strips on an 8-unit pitch, centred so both ends keep a margin
  const n = Math.max(1, Math.floor((w + 2) / 8));
  const x0 = x + q((w - (n * 8 - 2)) / 2);
  const strips = [];
  for (let i = 0; i < n; i++) strips.push(x0 + i * 8);
  for (const xx of strips) {
    R(xx - 0.5, y - 0.5, 7, h + 1, edge(wall, 0.4));
    R(xx, y, 6, h, glass);
    R(xx, y, 6, q(h * 0.3), shade(glass, 0.14));
    R(xx, y + q(h * 0.74), 6, h - q(h * 0.74), shade(glass, -0.1));
    for (let yy = y + 8; yy < y + h - 1; yy += 8) { HL(xx, yy, 6, shade(glass, -0.26)); HL(xx, yy + 0.5, 6, shade(glass, 0.18)); }
    HL(xx, y, 6, shade(glass, -0.36));
    R(xx + 1, y + 0.5, 1, h - 1, shade(glass, 0.38));
  }
  // one broad sheen across the whole facade, clipped to the glass
  const hp = Math.round(h * 2);
  for (const [c0, bw] of [[w * 0.55, 6], [w * 0.55 + 9, 2]]) {
    C.fillStyle = shade(glass, 0.3);
    for (let j = 0; j < hp; j++) {
      for (let k = 0; k < bw * 2; k++) {
        const gxx = Math.round(c0 * 2) - j + k;
        const ux = x + gxx / 2;
        if (strips.some((s) => ux >= s + 2 && ux < s + 6)) C.fillRect(ux, y + j / 2, 0.5, 0.5);
      }
    }
  }
}

function paintCorporate(d) {
  const { b, W, H, dx, dy, wall, roof, kind } = d;
  const top = d.top, FH = H - top;
  const glassTower = kind === 'tower';
  const roofH = glassTower ? 10 : 8;
  const glass = b.glass || (glassTower ? '#6fa8dc' : '#8fd0ff');
  // rooftop equipment (stands behind the parapet)
  if (W >= 96) roofBox(8, top - 6, 14, 7, shade(wall, -0.06));
  if (kind === 'hotel') waterTank(W - 22, top - 8);
  else if (W >= 64) { acUnit(W - 17, top - 4); if (W >= 112) acUnit(W - 26, top - 4); }
  wallFill(0, top, W, FH, wall, b.texture || (kind === 'hotel' ? 'tile' : 'concrete'));
  R(0, top + roofH, 2, FH - roofH, shade(wall, 0.12));
  VL(2, top + roofH, FH - roofH, shade(wall, -0.05));
  R(W - 4, top + roofH, 4, FH - roofH, shade(wall, -0.15));
  VL(W - 4, top + roofH, FH - roofH, shade(wall, -0.26));
  parapet(0, top, W, roofH, roof, wall);
  const signH = b.signH || (glassTower ? 24 : 18);
  const signW = Math.min(W - 12, b.signW || W - 16);
  const sx = (W - signW) / 2, sy = top + roofH + 3;
  const gy = sy + signH + 4, gh = FH - roofH - signH - 30;
  if (glassTower) curtainWall(6, gy, W - 12, gh, glass, wall);
  else if (gh > 4) windowGrid(6, gy, W - 12, gh, { glass, frame: shade(wall, 0.4), wall, hotel: kind === 'hotel', bands: kind === 'office', W });
  signBoard(d, sx, sy, signW, signH);
  // ground floor: stone-clad lobby band
  const lob = mix(wall, '#b4ada2', 0.22);
  wallFill(2, H - 18, W - 6, 18, lob, 'stone');
  HL(0, H - 18.5, W, shade(wall, 0.25));
  HL(0, H - 18, W, shade(lob, -0.18));
  plinth(0, H - 2.5, W, 2.5, wall);
  const r0 = Math.max(0, dx - 8), r1 = Math.min(W, dx + 24);
  R(r0, dy, r1 - r0, 16, shade(wall, -0.2));
  R(r0, dy, r1 - r0, 1.5, shade(wall, -0.34));
  VL(r0, dy, 16, shade(wall, -0.34));
  HL(r0, H - 0.5, r1 - r0, shade(wall, -0.4));
  for (const gx0 of [dx - 7, dx + 17]) if (gx0 >= 0 && gx0 + 6 <= W) windowHD(gx0, dy + 2, 6, 12, { glass, frame: '#6a707c', wall: shade(wall, -0.2), sill: false, a: 0.2, b: 0.5 });
  doorHD(dx, dy, b.doorKind || 'glass', d);
  const c0 = Math.max(-1, dx - 10), c1 = Math.min(W + 1, dx + 26);
  canopy(c0, dy - 6, c1 - c0, 5, b.canopy || shade(roof, -0.1), wall);
  if (kind === 'hotel' || b.plants) {
    if (dx - 15 >= 2) pottedPlant(dx - 15, dy + 4, 6);
    if (dx + 31 <= W - 4) pottedPlant(dx + 25, dy + 4, 6);
    d.plantsDone = true;
  }
  if (glassTower) {
    // rooftop antenna mast with a blinking aviation light
    const mx = q(W * 0.72);
    d.post.push(() => {
      VL(mx, top - 16, 16, '#9aa0aa'); VL(mx + 0.5, top - 16, 16, '#5a5f6b');
      for (let yy = top - 13; yy < top - 1; yy += 3) { HL(mx - 1.5, yy, 3.5, '#8d939e'); }
      R(mx - 1, top - 2, 2.5, 2, '#6a707c');
    });
    d.live.push((ctx, px, py, t) => {
      ctx.fillStyle = (t % 90) < 45 ? '#ff3b3b' : '#7a1f1f';
      ctx.fillRect(px + mx - 0.5, py + top - 17.5, 1.5, 1.5);
      if ((t % 90) < 45) { ctx.fillStyle = '#ffd0d0'; ctx.fillRect(px + mx - 0.5, py + top - 17.5, 0.5, 0.5); }
    });
  }
}

// ---------------------------------------------------------------- residential tower
function paintResTower(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  const top = d.top;
  const glass = b.glass || '#7fb3d9';
  const hasSign = !!(b.sign || b.logo);
  const crownH = hasSign ? Math.max(14, (b.signH || 12) + 5) : 10;
  const podH = 26, fl = b.floorH || 10;
  const sy0 = top + crownH, sy1 = H - podH;
  // shaft: corner columns + glass with balcony slabs
  wallFill(0, sy0, W, sy1 - sy0, wall, 'plain');
  R(0, sy0, 4, sy1 - sy0, shade(wall, 0.12));
  R(W - 6, sy0, 6, sy1 - sy0, shade(wall, -0.16));
  VL(W - 6, sy0, sy1 - sy0, shade(wall, -0.3));
  const gx0 = 4, gx1 = W - 6;
  const rows = Math.max(1, Math.floor((sy1 - sy0) / fl));
  const yStart = sy1 - rows * fl;
  if (yStart > sy0) R(gx0, sy0, gx1 - gx0, yStart - sy0, shade(wall, -0.05));
  const panel = b.balcony || mix(glass, '#e8f0f4', 0.55);
  for (let r = 0; r < rows; r++) {
    const y = yStart + r * fl;
    const tone = r < rows * 0.3 ? shade(glass, 0.14) : r > rows * 0.72 ? shade(glass, -0.1) : glass;
    R(gx0, y, gx1 - gx0, fl - 1.5, tone);
    HL(gx0, y, gx1 - gx0, shade(tone, -0.3));
    for (let xx = gx0 + 6; xx < gx1 - 1; xx += 6) VL(xx, y, fl - 1.5, shade(tone, -0.22));
    for (let xx = gx0 + 1; xx < gx1 - 2; xx += 6) {
      const v = rnd();
      if (v < 0.22) R(xx, y + 0.5, 1.5, fl - 4, pick(['#f2e6c8', '#e8d0d8', '#d8dde5']));
      else if (v > 0.93) R(xx + 0.5, y + 1, 4, fl - 5, LIT);
    }
    const ry = y + fl - 5;
    R(gx0, ry, gx1 - gx0, 3.5, panel);
    dither(gx0, ry + 1, gx1 - gx0, 2.5, shade(panel, 0.08), r & 1);
    HL(gx0, ry - 0.5, gx1 - gx0, '#ffffff');
    HL(gx0, ry, gx1 - gx0, shade(panel, -0.18));
    R(gx0 - 1, y + fl - 1.5, gx1 - gx0 + 2, 1.5, '#eef1f5');
    HL(gx0 - 1, y + fl - 1.5, gx1 - gx0 + 2, '#ffffff');
    HL(gx0 - 1, y + fl, gx1 - gx0 + 2, shade(tone, -0.4));
  }
  const nu = Math.max(2, Math.round((gx1 - gx0) / 14));
  for (let k = 1; k < nu; k++) {
    const fx = q(gx0 + ((gx1 - gx0) * k) / nu);
    R(fx - 0.5, yStart, 1.5, sy1 - yStart, shade(wall, 0.06));
    VL(fx + 1, yStart, sy1 - yStart, shade(wall, -0.25));
  }
  // sheen across the glass
  const hp = Math.round((sy1 - yStart) * 2);
  C.fillStyle = 'rgba(255,255,255,0.22)';
  for (let j = 0; j < hp; j++) {
    for (let k = 0; k < 14; k++) {
      const xx = Math.round((gx1 - gx0) * 1.1) - j + k;
      if (xx >= 0 && xx < (gx1 - gx0) * 2) C.fillRect(gx0 + xx / 2, yStart + j / 2, 0.5, 0.5);
    }
  }
  // crown
  R(3, top, W - 6, 4, shade(roof, 0.12));
  HL(3, top, W - 6, shade(roof, 0.45));
  R(0, top + 3.5, W, crownH - 3.5, roof);
  HL(0, top + 3.5, W, shade(roof, 0.35));
  R(W - 5, top + 4, 5, crownH - 4, shade(roof, -0.15));
  HL(0, top + crownH - 1, W, shade(roof, -0.3));
  for (let xx = 1; xx < W - 1; xx += 1.5) P(xx, top + crownH - 2.5, (xx * 2) % 3 ? '#bfe6ff' : shade(roof, 0.2));
  if (hasSign) {
    const sh = b.signH || 12, sw = Math.min(W - 10, b.signW || W - 14);
    signBoard(d, (W - sw) / 2, top + 4.5, sw, sh, { frame: shade(roof, -0.35), bg: shade(roof, -0.15), color: '#ffffff', shadow: false });
  }
  d.live.push((ctx, px, py, t) => {
    const on = (t % 100) < 50;
    ctx.fillStyle = on ? '#ff3b3b' : '#7a1f1f';
    ctx.fillRect(px + 3, py + top - 1.5, 1.5, 1.5);
    ctx.fillRect(px + W - 4.5, py + top - 1.5, 1.5, 1.5);
  });
  // podium / lobby
  const p0 = sy1;
  R(0, p0, W, 4, roof);
  HL(0, p0, W, shade(roof, 0.4));
  HL(0, p0 + 3.5, W, shade(roof, -0.3));
  wallFill(0, p0 + 4, W, podH - 4, mix(wall, '#9a958c', 0.35), 'stone');
  const ly = p0 + 7;
  if (dx - 3 >= 8) displayWindow(3, ly, dx - 6, H - 3 - ly, { wall, frame: '#5a5f6b', glass, display: 'plain', mullions: [] });
  if (W - 3 - (dx + 19) >= 6) displayWindow(dx + 19, ly, W - 3 - (dx + 19), H - 3 - ly, { wall, frame: '#5a5f6b', glass, display: 'plain', mullions: [] });
  plinth(0, H - 2, W, 2, wall);
  const e0 = Math.max(0, dx - 2), e1 = Math.min(W, dx + 18);
  R(e0, dy - 1, e1 - e0, 17, shade(wall, -0.35));
  doorHD(dx, dy, b.doorKind || 'glass', d);
  const k0 = Math.max(-1, dx - 8), k1 = Math.min(W + 1, dx + 24);
  canopy(k0, dy - 6, k1 - k0, 4, b.canopy || roof, wall);
  if (dx - 10 >= 1) pottedPlant(dx - 9, dy + 5, 5, '#3f8a4a');
  if (dx + 26 <= W) pottedPlant(dx + 20, dy + 5, 5, '#3f8a4a');
}

// ---------------------------------------------------------------- theater
function paintTheater(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 6, W, H - 6, wall, b.texture || 'stone');
  R(0, 10, 2, H - 10, shade(wall, 0.1));
  R(W - 3, 10, 3, H - 10, shade(wall, -0.14));
  // stepped crown with bulbs
  R(4, 0, W - 8, 8, roof);
  HL(4, 0, W - 8, shade(roof, 0.42));
  HL(4, 0.5, W - 8, shade(roof, 0.2));
  R(5.5, 1.5, W - 11, 4, shade(roof, -0.14));
  HL(5.5, 5, W - 11, shade(roof, 0.1));
  for (let x = 6; x < W - 6; x += 6) { R(x, 2, 2, 2, '#fff6a8'); P(x, 2, '#ffffff'); P(x + 1.5, 3.5, '#e0b04a'); }
  R(0, 6, W, 4, shade(roof, -0.2));
  HL(0, 6, W, shade(roof, 0.12));
  for (let x = 1; x < W - 1; x += 3) R(x, 8.5, 1.5, 1, shade(roof, -0.45));
  HL(0, 9.5, W, shade(roof, -0.4));
  HL(0, 10, W, shade(wall, -0.25));
  const signH = b.signH || 30, signW = Math.min(W - 10, b.signW || W - 14);
  signBoard(d, (W - signW) / 2, 12, signW, signH, { lights: true });
  // marquee (bulbs animated)
  const my = 12 + signH + 3;
  const marquee = my + 10 <= dy - 4;   // (only a very short theater has no room for it)
  if (marquee) {
    R(4, my, W - 8, 9, '#20232a');
    HL(4, my, W - 8, '#6a707c');
    HL(4.5, my + 1, W - 9, '#c9a040');
    HL(4.5, my + 7.5, W - 9, '#c9a040');
    HL(4, my + 8.5, W - 8, '#0e0f14');
    HL(4, my + 9, W - 8, shade(wall, -0.3));
    HL(4, my + 9.5, W - 8, shade(wall, -0.14));
    const bx = [];
    for (let x = 6; x < W - 6; x += 4) bx.push(x);
    d.live.push((ctx, px, py, t) => {
      for (const x of bx) {
        const on = Math.floor(t / 15 + x / 4) % 2;
        ctx.fillStyle = on ? '#fff6a8' : '#ff9a3c';
        ctx.fillRect(px + x, py + my + 3, 2, 2);
        ctx.fillStyle = on ? '#ffffff' : '#ffc07a';
        ctx.fillRect(px + x, py + my + 3, 0.5, 0.5);
        ctx.fillStyle = on ? '#e8c05a' : '#c8641a';
        ctx.fillRect(px + x + 1.5, py + my + 4.5, 0.5, 0.5);
      }
    });
  }
  // posters in brass cases
  const posterY = my + 14;
  const ph = Math.max(10, dy - posterY - 4);
  for (let x = 6, slot = 0; marquee && posterY + ph <= dy - 3 && x < W - 10; x += 18, slot++) {
    if (Math.abs(x + 6 - (dx + 8)) < 18) continue;
    const pc = ['#ffd23f', '#ff7eb6', '#5fd7ff'][(slot + (x >> 3)) % 3];
    R(x + 1, posterY + ph, 12, 1, shade(wall, -0.24));
    R(x, posterY, 12, ph, '#20232a');
    R(x + 0.5, posterY + 0.5, 11, ph - 1, '#c9a040');
    HL(x + 0.5, posterY + 0.5, 11, '#f0d27a');
    R(x + 1.5, posterY + 1.5, 9, ph - 3, pc);
    const art = Math.min(ph - 9, 18);
    if (art > 4) {
      R(x + 1.5, posterY + 1.5, 9, art, shade(pc, -0.12));
      oval(x + 2.5, posterY + 2.5, 7, Math.min(7, art - 1), shade(pc, 0.45));
      const fy = posterY + 1.5 + art;
      const sil = shade(pc, -0.6), fh = Math.min(9, art), top = fy - fh;
      oval(x + 5, top + 0.5, 2, 2, sil);
      R(x + 4.5, top + 2.5, 3, fh - 4, sil);
      R(x + 5, top + fh - 1.5, 0.5, 1.5, sil); R(x + 6.5, top + fh - 1.5, 0.5, 1.5, sil);
      P(x + 4, top + 2.5, sil); P(x + 3.5, top + 2, sil); P(x + 3, top + 1.5, sil);
      P(x + 7.5, top + 2.5, sil); P(x + 8, top + 2, sil); P(x + 8.5, top + 1.5, sil);
    }
    R(x + 3, posterY + ph - 6.5, 6, 2, '#ffffff');
    HL(x + 3.5, posterY + ph - 3.5, 5, shade(pc, -0.45));
    HL(x + 4, posterY + ph - 2.5, 4, shade(pc, -0.45));
    streaks(x + 1.5, posterY + 1.5, 9, ph - 3, 'rgba(255,255,255,0.45)', 0.5, 0.85);
  }
  plinth(0, H - 2.5, W, 2.5, wall);
  R(dx - 17, dy - 4.5, 50, 4.5, '#20232a');
  HL(dx - 17, dy - 4.5, 50, '#6a707c');
  HL(dx - 16.5, dy - 3, 49, '#c9a040');
  HL(dx - 16.5, dy - 1, 49, '#8a6a2a');
  for (const x of doorsOf(d)) doorHD(x, dy, b.doorKind || 'curtain', d);
}

// ---------------------------------------------------------------- studio
function paintStudio(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 13, W, H - 13, wall, b.texture || 'siding');
  R(W - 3, 14, 3, H - 14, shade(wall, -0.12));
  // arched corrugated roof
  for (let j = 0; j < 28; j++) {
    const i = j / 2;
    const inset = q(14 - Math.sqrt(14 * 14 - (14 - i) * (14 - i)));
    const tone = i < 4 ? shade(roof, 0.2) : i < 9 ? shade(roof, 0.07) : roof;
    const col = j % 6 === 0 ? shade(tone, 0.22) : j % 6 === 1 ? shade(tone, -0.1) : tone;
    R(inset, i, W - inset * 2, 0.5, col);
    P(inset, i, shade(roof, 0.3));
    P(W - inset - 0.5, i, shade(roof, -0.3));
  }
  R(0, 13, W, 1.5, shade(roof, -0.32));
  HL(0, 13, W, shade(roof, -0.15));
  HL(0, 14.5, W, shade(wall, -0.25));
  // drain pipe + vent
  if (W >= 120) {
    R(W - 8, 14.5, 1.5, H - 15, '#9aa0aa'); VL(W - 8, 14.5, H - 15, '#c4c9d0');
    for (let yy = 22; yy < H - 4; yy += 14) HL(W - 8.5, yy, 2.5, '#6e747e');
    const vx = W - 24;
    R(vx, 20, 10, 6, '#6e747e');
    for (let yy = 20.5; yy < 26; yy += 1.5) HL(vx + 0.5, yy, 9, '#aab0ba');
  }
  const signH = b.signH || 26, signW = Math.min(W - 12, b.signW || 64);
  // kick band along the bottom of the wall
  R(0, H - 7, W, 7, shade(wall, -0.12));
  HL(0, H - 7, W, shade(wall, 0.12));
  HL(0, H - 6.5, W, shade(wall, -0.22));
  // clerestory windows left of the sign
  const sx0 = (W - signW) / 2;
  for (let x = 6; x + 9 <= sx0 - 4; x += 13) windowHD(x, 21, 9, 4, { glass: '#a8c8dc', frame: shade(wall, 0.3), wall, sill: false, a: 0.2, b: 0.5 });
  signBoard(d, sx0, 18, signW, signH);
  // hangar roller door
  const hx = 8, hy = dy - 22;
  const lamp = (lx, ly) => {
    R(lx, ly, 1, 2, '#3b3f48');
    HL(lx, ly, 3, '#3b3f48');
    R(lx + 2, ly, 3, 1.5, '#2f5a3a');
    HL(lx + 2, ly, 3, '#4a7a5a');
    HL(lx + 2.5, ly + 1.5, 2, '#fff1b8');
  };
  if (hy - 6 > 18 + signH) { lamp(hx + 3, hy - 4); lamp(hx + 32, hy - 4); }
  R(hx, hy, 40, 38, '#3b3f48');
  R(hx + 0.5, hy + 0.5, 39, 1, '#6a707c');
  for (let y = hy + 2; y < H - 3; y += 3) {
    HL(hx + 1.5, y, 37, '#b4bac4');
    R(hx + 1.5, y + 0.5, 37, 1.5, '#8d939e');
    HL(hx + 1.5, y + 2, 37, '#6e747e');
  }
  for (let x = hx + 1.5; x < hx + 38.5; x += 2) { R(x, H - 3, 1, 1.5, '#ffd23f'); R(x + 1, H - 3, 1, 1.5, '#20232a'); }
  R(hx + 1.5, H - 1.5, 37, 1.5, '#4a4f58');
  R(hx + 17, H - 5, 6, 1, '#4a4f58');
  if (18 + signH + 2 < hy - 12) {
    const cx = hx + 20, cy = hy - 7;
    oval(cx - 5, cy - 5, 10, 10, '#20232a');
    oval(cx - 4.5, cy - 4.5, 9, 9, '#ffffff');
    crispText('1', cx, cy, 8, '#20232a', 8, 7);
  }
  // people door + ON AIR lamp
  canopy(dx - 2, dy - 4, 20, 3.5, '#3b3f48', wall);
  doorHD(dx, dy, b.doorKind || 'wood', d);
  if (b.onair !== false) {
    const lx = dx + 18, ly = dy - 10;
    R(lx, ly, 12, 6, '#20232a');
    HL(lx, ly, 12, '#5a5f6b');
    R(lx + 1, ly + 6, 12, 1, shade(wall, -0.25));
    d.live.push((ctx, px, py, t) => {
      const on = Math.floor(t / 40) % 2;
      ctx.fillStyle = on ? '#ff2b3a' : '#7a1f1f';
      ctx.fillRect(px + lx + 1, py + ly + 1, 10, 4);
      mini('ONAIR', 1.25, 0.75, on ? '#ffffff' : '#b85050', ctx, px + lx + 0.25, py + ly + 0.75);
      if (on) { ctx.fillStyle = '#ff8a8a'; ctx.fillRect(px + lx + 1, py + ly + 1, 10, 0.5); }
    });
  }
}

// ---------------------------------------------------------------- house (wooden apartment)
function paintHouse(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 8, W, H - 8, wall, b.texture || 'lap');
  R(W - 2, 10, 2, H - 10, shade(wall, -0.12));
  // tiled roof
  for (let j = 0; j < 20; j++) {
    const off = Math.floor(j / 3) * 0.5, y = j / 2;
    const eave = j >= 16;
    let col = eave ? shade(roof, -0.3) : roof;
    if (!eave && j % 4 === 0) col = shade(roof, 0.18);
    if (!eave && j % 4 === 3) col = shade(roof, -0.12);
    R(-2 + off, y, W + 4 - off * 2, 0.5, col);
    if (!eave && j % 4 !== 0) {
      for (let x = -2 + off + ((j >> 2) % 2 ? 1.5 : 0); x < W + 2 - off - 0.5; x += 3) P(x, y, shade(roof, -0.2));
    }
  }
  for (let x = 0; x < W; x += 4) R(x + 1, 8.5, 1, 1, shade(roof, -0.1));
  HL(0, 10, W, shade(wall, -0.3));
  const mid = Math.floor(H / 2);
  const hasSign = !!b.sign;
  // v1's 40-unit board, widened for a long name so it is not squeezed illegibly
  const label = hasSign ? String(b.sign.text ?? b.name ?? '') : '';
  let ems = 0;
  for (const ch of label) ems += ch.charCodeAt(0) > 0xff ? 1 : 0.5;
  const sw = Math.min(W - 8, Math.max(40, Math.ceil(ems * 10 + 8)));
  // 2F: doors (+ number plates) with narrow grilled kitchen windows, walkway with
  // railing; with a signboard the doors start below it, and when that leaves no
  // room (a 4-tile house) only the doors clear of the board are drawn, full height
  const top0 = Math.max(mid - 16, 12), topS = hasSign ? Math.max(top0, 25) : top0;
  let n = 1;
  for (let x = 6; x + 28 <= W - 2; x += 22, n++) {
    const dTop = mid - 2 - topS >= 9 || x < 4 + sw ? topS : top0, dH = mid - 2 - dTop;
    if (dH >= 9) {
      R(x, dTop, 16, dH, '#4a2f18');
      R(x + 1, dTop + 0.5, 14, dH - 0.5, '#6b4526');
      R(x + 1.5, dTop + 1, 13, dH - 1, '#9b6638');
      VL(x + 1.5, dTop + 1, dH - 1, '#b57d4a');
      R(x + 2.5, dTop + 1.5, 6.5, 3.5, '#e8ecf0'); HL(x + 2.5, dTop + 4.5, 6.5, '#9aa0aa'); mini('20' + n, x + 3, dTop + 2, '#20232a');
      R(x + 11.5, dTop + dH / 2, 1.5, 1.5, '#e0b032');
    }
    const last = x + 22 + 28 > W - 2;
    const wx = x + 17.5, ww = last ? Math.min(10, W - 3 - wx) : 3.5;
    if (ww >= 3) {
      windowHD(wx, mid - 14, ww, 7.5, { glass: '#bfe0f0', frame: '#d8dde5', wall, sill: false, streaks: false });
      for (let gx = wx + 1; gx < wx + ww; gx += 1.5) VL(gx, mid - 14, 7.5, '#9aa0aa');
    }
  }
  // walkway slab + railing
  const rail = '#c0c4cc';
  HL(0, mid - 9, W, shade(rail, 0.3));
  R(0, mid - 8.5, W, 1, rail);
  HL(0, mid - 7.5, W, shade(rail, -0.35));
  for (let x = 1; x < W; x += 2) VL(x, mid - 7.5, 5.5, '#8d939e');
  R(0, mid - 2, W, 3, shade(wall, -0.3));
  HL(0, mid - 2, W, shade(wall, -0.12));
  HL(0, mid + 0.5, W, shade(wall, -0.45));
  R(0, mid + 1, W, 1, rail);
  HL(0, mid + 1.5, W, shade(rail, -0.3));
  // 1F windows
  for (let x = 6; x < W - 10; x += 22) {
    if (Math.abs(x - dx) < 20) continue;
    const ww = Math.min(11, W - 4 - (x + 2.5));   // (v1's last window could poke past the wall)
    if (ww >= 6) windowHD(x + 2.5, dy + 2.5, ww, 8, { glass: '#8fd0ff', frame: '#f4f4f4', wall, mullion: ww >= 9, curtain: (x / 22) % 2 ? '#f2e6c8' : null });
  }
  // outside stairs + handrail
  const s0x = W - 14, s0y = mid + 2;
  for (let i = 0; i < 6; i++) {
    const sx = s0x + i, sy = s0y + i * 3;
    R(sx, sy + 2, 1.5, 3, '#7a808a');
    R(sx, sy, 10, 2, '#9aa0aa');
    HL(sx, sy, 10, '#c4c8d0');
    HL(sx, sy + 1.5, 10, '#6e747e');
  }
  VL(s0x + 0.5, s0y - 6, 6, '#5a5f6b');
  VL(s0x + 5.5, s0y + 10, 5, '#5a5f6b');
  for (let k = 0; k <= 32; k++) P(q(s0x + 0.5 + (k * 5) / 32), q(s0y - 6 + k * 0.5), '#5a5f6b');
  doorHD(dx, dy, b.doorKind || 'wood', d);
  if (hasSign) signBoard(d, 4, 12, sw, 12, { frame: '#5a3a20' });
}

// ---------------------------------------------------------------- shop / small / bath
function kawara(d, x0, y0, rows, overhang) {
  const { W, roof } = d;
  for (let j = 0; j < rows * 2; j++) {
    const y = y0 + j / 2;
    const off = q(overhang * (1 - j / (rows * 2 - 1)));   // ridge narrow, eave wide
    const x = x0 + off, w = W - x0 * 2 - off * 2;
    const k = j % 6;
    const col = k === 0 ? shade(roof, 0.22) : k === 5 ? shade(roof, -0.32) : roof;
    R(x, y, w, 0.5, col);
    if (k > 0 && k < 5) for (let xx = x + 1 + ((j / 6) % 2 ? 1 : 0); xx < x + w - 0.5; xx += 2) P(xx, y, shade(roof, k < 3 ? 0.12 : -0.16));
  }
}

function chimney(d) {
  const { W } = d;
  const cx = W - 10, top = -30;
  R(cx, top, 5, 34, '#b8b0a4');
  VL(cx, top, 34, '#d8d2c8');
  VL(cx + 4.5, top, 34, '#8a8478');
  for (let yy = top + 6; yy < 4; yy += 6) HL(cx, yy, 5, '#9a9488');
  R(cx - 0.5, top, 6, 2, '#5a5650');
  HL(cx - 0.5, top, 6, '#7a766e');
  d.live.push((ctx, px, py, t) => {
    for (let k = 0; k < 3; k++) {
      const ph = ((t + k * 60) % 180) / 180;
      const r = 1 + ph * 2.5;
      const sx = px + cx + 2.5 + Math.round(ph * 8 * 2) / 2 - r / 2, sy = py + top - 2 - Math.round(ph * 16 * 2) / 2;
      const X = Math.round(sx * 2) / 2, Y = Math.round((sy - r) * 2) / 2, w = Math.round(r * 4) / 2, h = Math.round(r * 2) / 2;
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(X - 0.5, Y + 0.5, w + 1, Math.max(0.5, h - 0.5));
      ctx.fillStyle = ph < 0.6 ? '#f6f6f8' : '#e6e8ee';
      ctx.fillRect(X, Y, w, h);
      ctx.fillRect(X - 0.5, Y + 0.5, w + 1, Math.max(0.5, h - 1));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(X + 0.5, Y, Math.max(0.5, w / 2 - 0.5), 0.5);
    }
  });
}

// Karahafu (cusped gable) over the bath's roof: a bell-curved tiled band with a
// white bargeboard, dark gable face and a gold ornament.
function karahafu(d) {
  const { W, roof } = d;
  const cx = W / 2, hw = 11;
  for (let x = -hw; x < hw; x += 0.5) {
    const u = Math.min(1, Math.abs(x + 0.25) / hw);
    let yt = -8 + 6.5 * (1 - Math.cos(Math.PI * u)) / 2;
    if (u > 0.9) yt -= (u - 0.9) * 8;
    yt = q(yt);
    R(cx + x, yt, 0.5, 2.5, roof);
    P(cx + x, yt, shade(roof, 0.35));
    P(cx + x, yt + 2, shade(roof, -0.3));
    if (((x + hw) * 2) % 4 === 1) P(cx + x, yt + 1, shade(roof, 0.15));
    R(cx + x, yt + 2.5, 0.5, 1, '#efe4cc');
    if (yt + 3.5 < 2) R(cx + x, yt + 3.5, 0.5, 2 - yt - 3.5, '#5a3a20');
  }
  for (let x = -6; x < 6; x += 2) VL(cx + x + 1, -3, 4.5, '#4a2f18');
  R(cx - 2, -4, 4, 2, '#d9a441');
  HL(cx - 2, -4, 4, '#fff2b0');
  P(cx - 0.5, -2.5, '#8a6a2a');
  R(cx - 1, -9.5, 2, 1.5, shade(roof, -0.25));
}

function paintShop(d) {
  const { b, W, H, dx, dy, wall, roof, kind } = d;
  const roofH = kind === 'small' ? 10 : 8;
  if (kind === 'bath' && b.chimney !== false && W >= 48) chimney(d);
  wallFill(0, 0, W, H, wall, b.texture || (kind === 'bath' || kind === 'small' ? 'stucco' : 'concrete'));
  R(W - 2, roofH, 2, H - roofH, shade(wall, -0.1));
  if (kind === 'bath') {
    kawara(d, -2, 0, 12, 5);
    karahafu(d);
    HL(0, 12, W, shade(wall, -0.3));
    R(0, 12, 2, H - 12, '#7a5230'); VL(1.5, 12, H - 12, '#5a3a20');
    R(W - 2, 12, 2, H - 12, '#6b4526');
  } else if (kind === 'small') {
    kawara(d, -2, 0, 5, 1.5);
    HL(-2, 4.5, W + 4, shade(roof, -0.38));
    // fascia in the roof colour (v1's 10-unit roof band) with rafter ends
    const fas = shade(roof, -0.1);
    R(0, 5, W, 5, fas);
    HL(0, 5, W, shade(fas, -0.4));
    HL(0, 5.5, W, shade(fas, -0.2));
    for (let x = 2; x < W; x += 4) { R(x, 6, 1, 1, shade(fas, -0.3)); P(x, 6, shade(fas, 0.2)); }
    HL(0, 7.5, W, shade(fas, 0.16));
    HL(0, 9.5, W, shade(fas, -0.3));
  } else {
    parapet(0, 0, W, roofH, roof, wall);
  }
  const stripeY = kind === 'bath' ? 12 : roofH;
  if (b.stripes) {
    b.stripes.forEach((c, i) => {
      R(0, stripeY + i * 3, W, 3, c);
      HL(0, stripeY + i * 3, W, shade(c, 0.28));
      HL(0, stripeY + i * 3 + 2.5, W, shade(c, -0.2));
    });
    HL(0, stripeY + b.stripes.length * 3, W, shade(wall, -0.2));
  }
  const sy = stripeY + (b.stripes ? b.stripes.length * 3 + 2 : 2);
  const signH = b.signH || 14;
  signBoard(d, 4, sy, W - 8, signH, kind === 'small' || kind === 'bath' ? { frame: '#3a2512' } : {});
  let wy = sy + signH + 4;
  if (b.awning) { awning(1.5, wy - 1.5, W - 3, 6, b.awning, wall); wy += 6.5; }
  const wh = dy - wy + 12;
  const display = kind === 'bath' ? (b.display || 'lattice') : displayFor(b, kind === 'small' ? 'counter' : 'goods');
  if (wh > 6) {
    // v1 window slots (14 wide every 16, skipping the door), merged into runs
    const slots = [];
    for (let x = 4; x <= W - 12; x += 16) {
      if (x + 16 > dx && x < dx + 16) continue;
      slots.push([x, Math.min(14, W - 4 - x)]);
    }
    const runs = [];
    for (const s of slots) {
      const r = runs[runs.length - 1];
      if (r && r.end + 2 === s[0]) { r.mull.push(r.end + 0.5); r.end = s[0] + s[1]; } else runs.push({ x: s[0], end: s[0] + s[1], mull: [] });
    }
    const frame = kind === 'small' || kind === 'bath' ? '#6b4526' : '#f4f4f4';
    for (const r of runs) displayWindow(r.x + 1, wy + 1, r.end - r.x - 2, wh - 2, { wall, frame, glass: '#a8dcf5', display, mullions: r.mull });
    plinth(0, wy + wh + 0.5, W, H - wy - wh - 0.5, wall);
  }
  for (const x of doorsOf(d)) doorHD(x, dy, b.doorKind || (kind === 'bath' || kind === 'small' ? 'noren' : 'glass'), d);
  if (b.lanterns ?? kind === 'small') { lantern(dx - 5, dy + 1.5, '#d62f2f'); if (dx + 21 <= W) lantern(dx + 17, dy + 1.5, '#d62f2f'); }
  d.lanternsDone = true;
}

// ---------------------------------------------------------------- station
function paintStation(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  const brick = isBrick(wall);
  const stone = '#ece6da';
  wallFill(0, 6, W, H - 6, wall, b.texture || (brick ? 'brick' : 'stone'));
  if (brick) {
    for (let y = 12; y < H - 3; y += 4) { const w = (y / 4) % 2 ? 4 : 2.5; R(0, y, w, 2, stone); HL(0, y + 1.5, w, '#c8c0b0'); R(W - w, y, w, 2, shade(stone, -0.08)); }
    R(0, 29.5, W, 1.5, stone); HL(0, 31, W, '#b8b0a0');
  }
  R(W - 2, 10, 2, H - 10, shade(wall, -0.12));
  // roof (slate shingles) + eave
  R(-2, 0, W + 4, 8, roof);
  HL(-2, 0, W + 4, shade(roof, 0.4));
  for (let r = 0; r < 4; r++) {
    const y = 0.5 + r * 2;
    HL(-2, y, W + 4, shade(roof, 0.16));
    for (let x = -2 + (r % 2 ? 1.5 : 0); x < W + 2; x += 3) VL(x, y + 0.5, 1.5, shade(roof, -0.22));
  }
  R(-2, 8, W + 4, 2, shade(roof, -0.3));
  for (let x = -1; x < W + 2; x += 2.5) P(x, 9, shade(roof, 0.1));
  HL(-2, 9.5, W + 4, shade(roof, -0.5));
  HL(0, 10, W, shade(wall, -0.3));
  // clock tower in front of the roof (v1: cx-7, -6, 14 x 14) with a small pyramid cap
  const cx = W / 2;
  for (let j = 0; j < 8; j++) { const hw = 1 + j * 0.5 + (j > 5 ? 1.5 : 0); R(cx - hw, -12 + j / 2, hw * 2, 0.5, j % 3 === 0 ? shade(roof, 0.25) : j > 5 ? shade(roof, -0.2) : roof); }
  R(cx - 0.5, -14, 1, 2, '#e0b032');
  P(cx - 0.5, -14, '#fff2b0');
  R(cx - 7, -8, 14, 16, roof);
  VL(cx - 7, -8, 16, shade(roof, 0.25));
  R(cx + 5, -8, 2, 16, shade(roof, -0.2));
  HL(cx - 7, 7.5, 14, shade(roof, -0.4));
  oval(cx - 5.5, -4.5, 11, 11, '#d9b24a');
  oval(cx - 4.5, -3.5, 9, 9, '#ffffff');
  HL(cx - 2, -3.5, 4, '#e8ecf0');
  for (const [tx, ty] of [[-0.5, -3], [-0.5, 4.5], [-4.5, 0.5], [3.5, 0.5]]) R(cx + tx, ty, 1, 0.5, '#5a5f6b');
  VL(cx - 0.5, -2, 3, '#20232a');
  VL(cx, -2, 3, '#20232a');
  R(cx, 0.5, 2.5, 1, '#20232a');
  P(cx - 0.5, 0.5, '#d62f2f');
  const signW = Math.min(W - 16, b.signW || 80);
  signBoard(d, cx - signW / 2, 12, signW, 16);
  // arched windows
  for (let x = 6; x < W - 10; x += 20) {
    const ah = H - 36, gw = 12;
    R(x, 32 + 7, 14, ah - 7, shade(wall, -0.25));
    oval(x, 32, 14, 14, shade(wall, -0.25));
    HL(x, H - 4.5, 14, shade(wall, -0.4));
    R(x + 1, 34 + 6, gw, H - 40 - 6, '#a8dcf5');
    oval(x + 1, 34, gw, 12, '#a8dcf5');
    R(x + 1, H - 15, gw, 9, shade('#a8dcf5', -0.08));
    VL(x + 7, 34, H - 40, shade(wall, -0.25));
    HL(x + 1, 41, gw, shade(wall, -0.25));
    HL(x + 1, 40.5, gw, '#e0f4ff');
    streaks(x + 1, 41.5, gw, H - 47.5, '#e0f4ff', 0.35, 0.6);
    if (brick) { R(x + 6, 31, 2, 2, stone); }
  }
  plinth(0, H - 3, W, 3, brick ? '#c8c0b0' : wall);
  // portal around the three doors
  const ds = doorsOf(d);
  const p0 = Math.min(...ds) - 1.5, p1 = Math.max(...ds) + 17.5;
  R(p0, dy - 3, p1 - p0, 3, brick ? stone : shade(wall, 0.12));
  HL(p0, dy - 3, p1 - p0, '#ffffff');
  HL(p0, dy - 0.5, p1 - p0, shade(wall, -0.35));
  R((p0 + p1) / 2 - 1.5, dy - 4, 3, 4, brick ? '#d8d0c0' : shade(wall, 0.2));
  for (const x of ds) doorHD(x, dy, b.doorKind || 'glass', d);
}

// ---------------------------------------------------------------- mansion
function paintMansion(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  const top = d.top;
  const glass = b.glass || '#9fcbe6';
  const panel = b.balcony || b.accent || '#cfe0ea';
  const hasSign = !!(b.sign || b.logo);
  const baseH = 20, floorH = b.floorH || 18;
  let crownH = hasSign ? (b.signH || 11) + 5 : 6;
  const avail = H - baseH - top - crownH;
  const n = Math.max(1, Math.floor(avail / floorH));
  crownH += Math.max(0, avail - n * floorH);
  // rooftop machine room
  if (W >= 64) roofBox(q(W * 0.62), top - 6, 14, 7, shade(wall, -0.05));
  wallFill(0, top, W, H - top, wall, b.texture || 'tile');
  R(0, top, 3, H - top, shade(wall, 0.12));
  R(W - 3, top, 3, H - top, shade(wall, -0.16));
  VL(W - 3, top, H - top, shade(wall, -0.3));
  parapet(0, top, W, crownH, roof, wall);
  if (hasSign) {
    const sh = b.signH || 11, sw = Math.min(W - 12, b.signW || W - 20);
    signBoard(d, (W - sw) / 2, top + 2, sw, sh, { shadow: false });
  }
  const nu = Math.max(1, Math.round((W - 6) / 30));
  const uw = (W - 6) / nu;
  const curtains = ['#f2e6c8', '#d8e4f0', '#f0d8dc', '#e0ecd8'];
  for (let f = 0; f < n; f++) {
    const y0 = top + crownH + f * floorH;
    R(3, y0, W - 6, floorH, shade(wall, -0.16));
    HL(3, y0 + 0.5, W - 6, shade(wall, -0.32));
    for (let u = 0; u < nu; u++) {
      const ux = q(3 + u * uw), ue = q(3 + (u + 1) * uw);
      const wx = ux + 2.5, ww = ue - ux - 5;
      windowHD(wx, y0 + 2.5, ww, floorH - 5, { glass, frame: '#d8dce2', wall: shade(wall, -0.16), sill: false, mullion: true, curtain: rnd() < 0.55 ? pick(curtains) : null });
      const item = rnd();
      if (item < 0.28) {
        HL(wx + 0.5, y0 + 4, ww - 1, '#9aa0aa');
        for (let xx = wx + 1.5; xx < wx + ww - 3; xx += 3 + Math.floor(rnd() * 3)) { const c = pick(['#ffffff', '#ff9ab8', '#7ac0f0', '#ffd23f', '#9ad08a']); R(xx, y0 + 4.5, 2.5, 5, c); HL(xx, y0 + 4.5, 2.5, shade(c, 0.3)); VL(xx + 2, y0 + 5, 4.5, shade(c, -0.15)); }
      } else if (item < 0.42) {
        blob([[ue - 5, y0 + floorH - 9, 2.5], [ue - 3.5, y0 + floorH - 9.5, 2]], ramp('#4a9a4a'));
      }
      d.unitFuton = d.unitFuton || [];
      if (item > 0.86) d.unitFuton.push([wx + 2, y0 + floorH - 9.5, Math.min(10, ww - 4)]);
      if (u > 0) { R(ux - 1, y0, 2, floorH - 2, shade(wall, 0.04)); VL(ux + 0.5, y0, floorH - 2, shade(wall, -0.25)); }
    }
    // balcony rail panel + slab
    const ry = y0 + floorH - 8.5;
    R(3, ry, W - 6, 6.5, panel);
    dither(3, ry + 1, W - 6, 5, shade(panel, 0.08), f & 1);
    HL(3, ry - 0.5, W - 6, '#f6f8fa');
    HL(3, ry, W - 6, shade(panel, -0.22));
    for (let u = 1; u < nu; u++) VL(q(3 + u * uw), ry, 6.5, shade(panel, -0.25));
    R(1.5, y0 + floorH - 2, W - 3, 2, shade(wall, 0.1));
    HL(1.5, y0 + floorH - 2, W - 3, shade(wall, 0.32));
    HL(1.5, y0 + floorH - 0.5, W - 3, shade(wall, -0.3));
  }
  for (const [fx, fy, fw] of d.unitFuton || []) {
    const c = pick(['#f08a9a', '#7ab0e0', '#f4d27a']);
    R(fx, fy, fw, 5, c);
    HL(fx, fy, fw, shade(c, 0.35));
    for (let xx = fx + 1; xx < fx + fw; xx += 2) VL(xx, fy + 1, 3.5, shade(c, -0.12));
    HL(fx, fy + 4.5, fw, shade(c, -0.3));
  }
  // ground floor: stone base, lobby entrance
  const gy = H - baseH;
  wallFill(0, gy, W, baseH, mix(wall, '#9a958c', 0.4), 'stone');
  HL(0, gy, W, shade(wall, -0.35));
  for (let x = 5; x + 12 <= W - 4; x += 20) {
    if (x + 12 > dx - 8 && x < dx + 24) continue;
    windowHD(x, gy + 5, 12, 6, { glass, frame: '#c8ccd2', wall: mix(wall, '#9a958c', 0.4) });
    for (let gx = x + 1.5; gx < x + 12; gx += 2) VL(gx, gy + 5, 6, '#8d939e');
  }
  const l0 = Math.max(0, dx - 6), l1 = Math.min(W, dx + 22);
  R(l0, dy - 2, l1 - l0, 18, shade(wall, -0.4));
  for (const gx0 of [dx - 5, dx + 17.5]) if (gx0 >= 1 && gx0 + 3.5 <= W - 1) windowHD(gx0, dy + 1, 3.5, 13, { glass, frame: '#6a707c', wall, sill: false, streaks: false });
  doorHD(dx, dy, b.doorKind || 'glass', d);
  const k0 = Math.max(-1, dx - 7), k1 = Math.min(W + 1, dx + 23);
  canopy(k0, dy - 6, k1 - k0, 3.5, b.canopy || roof, wall);
  if (dx + 22 <= W) { R(dx + 17.5, dy - 1.5, 4, 2, '#d9b24a'); HL(dx + 17.5, dy - 1.5, 4, '#fff2b0'); }
  plinth(0, H - 2, W, 2, wall);
  if (dx - 14 >= 1) blob([[4, H - 3, 2.5], [7, H - 3.5, 3], [dx - 10, H - 3, 2.5]], ramp('#3f8a4a'));
}

// ---------------------------------------------------------------- arcade (商店街)
function paintArcade(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  const ARH = 14;
  wallFill(0, 12, W, H - 12, wall, b.texture || 'stucco');
  R(0, 13, 2, H - 13, shade(wall, -0.08));
  R(W - 2, 13, 2, H - 13, shade(wall, -0.16));
  // glass vault + steel ribs (spans the whole width so neighbours join)
  const gl = '#d6e9f2';
  R(0, 0, W, 9, gl);
  HL(0, 0, W, '#f6fcff');
  R(0, 0.5, W, 2, '#e8f5fb');
  R(0, 6, W, 3, shade(gl, -0.1));
  HL(0, 4.5, W, shade(roof, 0.25));
  for (let x = 8; x < W; x += 8) { R(x - 0.5, 0, 1, 9, roof); VL(x - 0.5, 0, 9, shade(roof, 0.35)); }
  for (let x = 1; x < W - 1; x += 8) { P(x + 2, 1, '#ffffff'); P(x + 1.5, 1.5, '#ffffff'); }
  const beam = (x0, w) => {
    R(x0, 9, w, 4, roof);
    HL(x0, 9, w, shade(roof, 0.4));
    HL(x0, 9.5, w, shade(roof, 0.15));
    R(x0, 12, w, 1, shade(roof, -0.35));
  };
  beam(0, W);
  // The vault and beam run on through the side edges: each end is half of a
  // 2px truss rib painted over the outline (after the outline pass), so two
  // arcade shops side by side meet in one rib instead of a dark seam, whichever
  // is drawn first; at the end of a row the rib frames the vault.
  const truss = shade(roof, -0.2);
  R(0, 0, 0.5, 9, truss); R(W - 0.5, 0, 0.5, 9, truss);
  d.post.push(() => {
    R(-0.5, 0, 0.5, 9, truss); R(W, 0, 0.5, 9, truss);
    beam(-0.5, 0.5); beam(W, 0.5);
  });
  for (let x = 4; x < W; x += 8) R(x - 0.5, 12.5, 1, 0.5, '#fff1b8');
  const deco = b.deco || 'flags';
  if (deco === 'flags') {
    HL(0, 13, W, '#5a5f6b');
    const fc = ['#e8402a', '#ffd23f', '#2f6fd0', '#2f9a4a'];
    for (let i = 0, x = 0; x < W - 1; x += 4, i++) {
      const c = fc[i % 4];
      R(x + 0.5, 13.5, 3, 0.5, c); R(x + 1, 14, 2, 0.5, c); R(x + 1.5, 14.5, 1, 0.5, shade(c, -0.15));
    }
  } else if (deco === 'lanterns') {
    for (let x = 6; x + 4 <= W - 2; x += 16) lantern(x, 14, '#e8402a');
  } else if (deco === 'sakura') {
    for (let x = 0; x < W; x += 0.5) {
      const y = 13 + Math.round((Math.sin(x / 3) + 1) * 1.5) / 2;
      P(x, y, '#6b4a2e');
      if ((x * 2) % 3 === 0) P(x, y + 0.5, (x * 2) % 6 === 0 ? '#ffb7d0' : '#ff8ab8');
    }
  }
  const sh = b.signH || 12;
  signBoard(d, 3, ARH + 3, W - 6, sh);
  const ay = ARH + 3 + sh + 2.5;
  awning(1, ay, W - 2, 6, b.awning || ['#d84a3a', '#fff4e0'], wall);
  const display = displayFor(b, 'goods');
  shopFront(d, ay + 8.5, { display, glass: b.glass, frame: '#e8e4dc' });
  doorHD(dx, dy, b.doorKind || (display === 'produce' ? 'open' : 'glass'), d);
}

// ---------------------------------------------------------------- cafe
function paintCafe(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 0, W, H, wall, b.texture || 'brick');
  R(0, 0, W, 5, roof);
  HL(0, 0, W, shade(roof, 0.4));
  HL(0, 0.5, W, shade(roof, 0.18));
  R(0, 3.5, W, 1.5, shade(roof, -0.3));
  for (let x = 1; x < W - 1; x += 2.5) R(x, 5, 1, 1, shade(roof, -0.1));
  HL(0, 6, W, shade(wall, -0.25));
  const sh = b.signH || 12, sw = Math.min(W - 8, b.signW || W - 12);
  signBoard(d, (W - sw) / 2, 8, sw, sh, { frame: shade(roof, -0.25), bg: '#3a2c24', color: '#fff3dc' });
  const ay = 8 + sh + 2.5;
  awning(1.5, ay, W - 3, 7, b.awning || ['#2f6b4f', '#f4efe6'], wall);
  const segs = shopFront(d, ay + 9.5, { display: b.display || 'cafe', frame: shade(roof, 0.1), glass: '#cfe8f0' });
  d.trim = shade(roof, 0.15);
  doorHD(dx, dy, b.doorKind || 'woodglass', d);
  // A-frame menu board
  const mx = dx >= 10 ? dx - 6.5 : dx + 18;
  R(mx, dy + 6, 5, 7.5, '#6b4526');
  R(mx + 0.5, dy + 6.5, 4, 6, '#2a3a30');
  for (let yy = dy + 7.5; yy < dy + 12; yy += 1.5) HL(mx + 1, yy, 1 + ((yy * 2) % 3), '#e8f0e0');
  VL(mx + 0.5, dy + 13.5, 2, '#4a2f18'); VL(mx + 4, dy + 13.5, 2, '#4a2f18');
  // terrace table
  if (b.terrace !== false) {
    const seg = segs.sort((a, z) => (z[1] - z[0]) - (a[1] - a[0]))[0];
    if (seg && seg[1] - seg[0] >= 12) {
      const tx = q((seg[0] + seg[1]) / 2 - 3);
      R(tx - 2.5, H - 7, 1, 6, '#3a3f4a'); R(tx - 3.5, H - 9, 1, 3, '#3a3f4a');
      R(tx + 7.5, H - 7, 1, 6, '#3a3f4a'); R(tx + 8.5, H - 9, 1, 3, '#3a3f4a');
      oval(tx, H - 7.5, 6, 2, '#f4f4f4');
      HL(tx + 1, H - 7.5, 4, '#ffffff');
      VL(tx + 2.75 - 0.25, H - 5.5, 4.5, '#5a5f6b');
      R(tx + 1.5, H - 1, 3, 0.5, '#5a5f6b');
      R(tx + 1.5, H - 8.5, 1, 1, '#ffffff'); P(tx + 1.5, H - 8.5, '#8a5a33');
    }
  }
}

// ---------------------------------------------------------------- restaurant
function paintRestaurant(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 0, W, H, wall, b.texture || 'stucco');
  const RH = 14;
  for (let j = 0; j < RH * 2; j++) {
    const y = j / 2, off = q((RH - y) * 0.16);
    const k = j % 4;
    const col = k === 0 ? shade(roof, 0.2) : k === 3 ? shade(roof, -0.18) : roof;
    R(off - 1, y, W + 2 - off * 2, 0.5, col);
    if (k === 1 || k === 2) for (let x = off - 1 + ((j >> 2) % 2 ? 1.5 : 0); x < W + 1 - off; x += 3) P(x, y, shade(roof, -0.22));
  }
  R(-1.5, RH, W + 3, 1.5, shade(roof, -0.4));
  HL(-1.5, RH, W + 3, shade(roof, -0.2));
  HL(0, RH + 1.5, W, shade(wall, -0.3));
  const sh = b.signH || 11, sw = Math.min(W - 6, b.signW || W - 10);
  signBoard(d, (W - sw) / 2, 1.5, sw, sh, { frame: shade(roof, -0.45) });
  let y0 = RH + 4;
  if (b.awning) { awning(1.5, RH + 2, W - 3, 6, b.awning, wall); y0 += 6; }
  shopFront(d, y0, { display: b.display || 'booths', frame: '#f4f4f4', glass: '#cfe8f0' });
  doorHD(dx, dy, b.doorKind || 'glass', d);
  // food-sample case beside the door
  const cx = dx >= 15 ? dx - 13.5 : dx + 18;
  if (cx + 12 <= W) {
    R(cx, dy + 2, 12, 12, '#3b3f48');
    R(cx + 0.5, dy + 2.5, 11, 11, '#6a707c');
    interior('food', cx + 1, dy + 3, 10, 7.5, null);
    C.globalAlpha = 0.18; R(cx + 1, dy + 3, 10, 7.5, '#cfe8f0'); C.globalAlpha = 1;
    streaks(cx + 1, dy + 3, 10, 7.5, 'rgba(255,255,255,0.6)', 0.4, 0.7);
    R(cx + 1, dy + 11, 10, 2, '#4a4f58');
    HL(cx + 1, dy + 11, 10, '#8d939e');
  }
}

// ---------------------------------------------------------------- gym
function paintGym(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  const accent = b.accent || '#ff8a3d';
  wallFill(0, 0, W, H, wall, b.texture || 'concrete');
  R(0, 6, 2, H - 6, shade(wall, 0.1));
  R(W - 3, 6, 3, H - 6, shade(wall, -0.18));
  parapet(0, 0, W, 6, roof, wall);
  R(0, 6, W, 1.5, accent);
  HL(0, 6, W, shade(accent, 0.3));
  const sh = b.signH || 13;
  signBoard(d, 4, 10, W - 8, sh, { frame: '#16181d', bg: accent, color: '#ffffff' });
  shopFront(d, 10 + sh + 4, { display: b.display || 'gym', frame: '#16181d', glass: b.glass || '#9fc4dc', base: 2.5 });
  doorHD(dx, dy, b.doorKind || 'glass', d);
}

// ---------------------------------------------------------------- salon
function paintSalon(d) {
  const { b, W, H, dx, dy, wall, roof } = d;
  wallFill(0, 0, W, H, wall, b.texture || 'stucco');
  R(0, 0, W, 4, roof);
  HL(0, 0, W, shade(roof, 0.4));
  R(0, 3, W, 1, shade(roof, -0.25));
  HL(0, 4, W, b.accent || '#d9b46a');
  HL(0, 4.5, W, shade(wall, -0.2));
  const sh = b.signH || 11, sw = Math.min(W - 8, b.signW || W - 12);
  signBoard(d, (W - sw) / 2, 7, sw, sh, { frame: shade(roof, -0.3), color: shade(roof, -0.5) });
  let y0 = 7 + sh + 4;
  if (b.awning) { awning(1.5, y0 - 1.5, W - 3, 6, b.awning, wall); y0 += 6; }
  shopFront(d, y0, { display: b.display || 'mirrors', frame: '#ffffff', glass: '#d8eef6', arch: true, transom: false });
  d.trim = '#f4f4f4';
  doorHD(dx, dy, b.doorKind || 'woodglass', d);
  // barber pole right of the door (left when there is no room), plants elsewhere
  const lx = !b.pole ? null : dx + 21.5 <= W ? dx + 17.5 : dx >= 5 ? dx - 4.5 : null;
  if (dx >= 8 && !(lx != null && lx < dx)) pottedPlant(dx - 6.5, dy + 6, 5, '#4a9a5a');
  if (lx != null) {
    R(lx, dy - 6, 3, 1, '#c9ced6'); R(lx, dy + 6, 3, 1, '#c9ced6');
    HL(lx, dy - 6, 3, '#ffffff');
    d.live.push((ctx, px, py, t) => {
      const cols = ['#e8402a', '#ffffff', '#2f6fd0', '#ffffff'];
      const ph = Math.floor(t / 6) % 8;
      for (let j = 0; j < 22; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = cols[Math.floor(((j + i + ph) % 8) / 2)];
          ctx.fillRect(px + lx + 0.5 + i * 0.5, py + dy - 5 + j * 0.5, 0.5, 0.5);
        }
      }
    });
  }
  if (!(lx != null && lx > dx) && W - (dx + 16) >= 8) pottedPlant(dx + 17.5, dy + 6, 5, '#4a9a5a');
}

// ---------------------------------------------------------------- kind table
const KINDS = {
  office: { paint: paintCorporate, rise: true, mt: 10, wall: '#ebe7df', roof: '#6a707c' },
  hotel: { paint: paintCorporate, rise: true, mt: 12, wall: '#ece8f0', roof: '#3a4a7a' },
  tower: { paint: paintCorporate, rise: true, mt: 20, wall: '#e8ecf2', roof: '#8d9bb0' },
  residential: { paint: paintResTower, rise: true, mt: 4, wall: '#dfe4ea', roof: '#3a4a5e', defRise: 4 },
  theater: { paint: paintTheater, mt: 2, wall: '#f2e6cc', roof: '#b8282c' },
  studio: { paint: paintStudio, mt: 2, wall: '#d8d2c4', roof: '#7d8391' },
  house: { paint: paintHouse, mt: 2, wall: '#efe2bf', roof: '#8a5a33' },
  shop: { paint: paintShop, mt: 2, wall: '#f2efe8', roof: '#8a8f99' },
  small: { paint: paintShop, mt: 2, wall: '#f6e7c8', roof: '#8a5a33' },
  bath: { paint: paintShop, mt: 52, wall: '#f6e7c8', roof: '#3b4a6a' },
  station: { paint: paintStation, mt: 18, wall: '#d8d2c4', roof: '#4a5a70' },
  mansion: { paint: paintMansion, rise: true, mt: 8, wall: '#ece6dc', roof: '#8a8f99' },
  arcade: { paint: paintArcade, mt: 2, wall: '#f2ece0', roof: '#6b7a8f' },
  cafe: { paint: paintCafe, mt: 2, wall: '#efe3d0', roof: '#5b3a29' },
  restaurant: { paint: paintRestaurant, mt: 2, wall: '#fbf3e4', roof: '#c0392b' },
  gym: { paint: paintGym, mt: 2, wall: '#3a3f4a', roof: '#22262e' },
  salon: { paint: paintSalon, mt: 2, wall: '#f6eef0', roof: '#b88a9a' },
};

// Friendly aliases: a kind name that is really another kind with some defaults
// (the building's own options still win).
const ALIASES = {
  konbini: { kind: 'shop', stripes: ['#2f9a4a', '#ff8a3d', '#2f6fd0'], signColor: '#2f6fd0' },
  convenience: { kind: 'shop', stripes: ['#2f9a4a', '#ff8a3d', '#2f6fd0'], signColor: '#2f6fd0' },
  supermarket: { kind: 'shop', display: 'produce', awning: ['#d84a3a', '#ffffff'], signColor: '#d62f2f' },
  karaoke: { kind: 'shop', display: 'karaoke', wall: '#3a2a4a', roof: '#ff4f8b', neon: '#ff7eb6', signBg: '#20232a', signColor: '#ff7eb6' },
  ramen: { kind: 'restaurant', display: 'counter', doorKind: 'noren', lanterns: true, wall: '#f4e6cc', roof: '#3a2a20', signBg: '#d62f2f', signColor: '#ffffff' },
  famires: { kind: 'restaurant', signColor: '#c0392b' },
  flower: { kind: 'shop', display: 'flowers', awning: ['#2f9a4a', '#ffffff'], signColor: '#2f9a4a' },
  florist: { kind: 'shop', display: 'flowers', awning: ['#2f9a4a', '#ffffff'], signColor: '#2f9a4a' },
  cake: { kind: 'shop', display: 'cakes', awning: ['#ff9ab8', '#ffffff'], signBg: '#fff0f4', signColor: '#c04a6a' },
  bakery: { kind: 'shop', display: 'cakes', awning: ['#c8864a', '#fff4e0'], signBg: '#fff4e0', signColor: '#8a5a30' },
  realestate: { kind: 'shop', display: 'listings', roof: '#2f6fd0', signBg: '#2f6fd0', signColor: '#ffffff' },
  furniture: { kind: 'shop', display: 'furniture', awning: '#6b4a2e', roof: '#6b4a2e', signBg: '#6b4a2e', signColor: '#fff3e0' },
  bookstore: { kind: 'shop', display: 'books', signColor: '#2a3a7a' },
  boutique: { kind: 'shop', display: 'clothes', signBg: '#20232a', signColor: '#f4e6cc' },
  apartment: { kind: 'house' },
  hair: { kind: 'salon' },
  beauty: { kind: 'salon' },
  fitness: { kind: 'gym' },
  coffee: { kind: 'cafe' },
};
function resolve(b) {
  const a = ALIASES[b.kind];
  if (!a) return b;
  const r = { ...a };
  for (const k of Object.keys(b)) if (k !== 'kind' && b[k] !== undefined) r[k] = b[k];
  return r;
}

function specOf(b) {
  let k = KINDS[b.kind] ? b.kind : 'office';
  if (k === 'tower' && (b.style === 'residential' || (!b.style && !b.logo))) k = 'residential';
  return [k, KINDS[k]];
}

// ---------------------------------------------------------------- cache
const KEYS = ['kind', 'style', 'w', 'h', 'door', 'doors', 'wall', 'roof', 'glass', 'canopy', 'sign', 'signH', 'signW', 'signBg', 'logo', 'name',
  'signColor', 'stripes', 'doorKind', 'onair', 'rise', 'awning', 'display', 'lanterns', 'neon', 'pole', 'accent', 'balcony', 'texture', 'plants',
  'chimney', 'noren', 'deco', 'terrace', 'floorH'];
const CACHE = new Map();
let fontOK = false, fontCheckAt = -1e9;

function fontReady() {
  if (fontOK) return true;
  const now = performance.now();
  if (now - fontCheckAt < 500) return false;
  fontCheckAt = now;
  try { fontOK = !document.fonts || document.fonts.check('12px "DotGothic16"'); } catch (e) { fontOK = true; }
  if (fontOK) { CACHE.clear(); gridOff = null; }   // drop facades lettered with the fallback font
  return fontOK;
}

function keyOf(b) {
  let k = fontReady() ? 'F|' : 'f|';
  for (const n of KEYS) {
    const v = b[n];
    k += (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v) + '|';
  }
  return k;
}

function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function build(b0, key) {
  const b = resolve(b0);
  const [, spec] = specOf(b);
  const W = b.w * TILE, H = b.h * TILE;
  const wall = b.wall || spec.wall || '#d8d2c4';
  const d = {
    b, kind: b.kind && KINDS[b.kind] ? b.kind : 'office', W, H,
    dx: (b.door ?? Math.floor(b.w / 2)) * TILE, dy: H - TILE,
    wall, roof: b.roof || spec.roof || shade(wall, -0.35),
    live: [], post: [],
  };
  const rise = spec.rise ? (b.rise ?? spec.defRise ?? 0) : 0;
  d.top = -Math.max(0, rise) * TILE;
  const ML = 8, MB = 6, MT = spec.mt + Math.max(0, rise) * TILE;
  const [cv, c] = makeCanvas((W + ML * 2) * S, (H + MT + MB) * S);
  C = c;
  rnd = mulberry32(strHash(key));
  c.setTransform(S, 0, 0, S, ML * S, MT * S);
  try {
    spec.paint(d);
    // options every kind understands, for kinds that do not place them themselves
    if (b.lanterns && !d.lanternsDone) { if (d.dx >= 6) lantern(d.dx - 5, d.dy + 1.5); if (d.dx + 21 <= W) lantern(d.dx + 17, d.dy + 1.5); }
    if (b.plants && !d.plantsDone) { if (d.dx >= 8) pottedPlant(d.dx - 7, d.dy + 6, 5); if (d.dx + 23 <= W) pottedPlant(d.dx + 17.5, d.dy + 6, 5); }
    c.setTransform(1, 0, 0, 1, 0, 0);
    outlinePass(cv);
    c.setTransform(S, 0, 0, S, ML * S, MT * S);
    for (const f of d.post) f();
    c.globalCompositeOperation = 'destination-over';
    R(1.5, H - 1, W + 0.5, 2.5, 'rgba(0,0,0,0.24)');
    R(W, H - 6, 1.5, 5, 'rgba(0,0,0,0.16)');
    c.globalCompositeOperation = 'source-over';
  } catch (err) {
    console.error('building paint failed', b.kind, err);
  } finally {
    C = null;
  }
  return { cv, ml: ML, mt: MT, uw: W + ML * 2, uh: H + MT + MB, live: d.live };
}

function entryFor(b) {
  const key = keyOf(b);
  let e = CACHE.get(key);
  if (e) {
    CACHE.delete(key);   // least-recently-used order: a big town never evicts what is on screen
  } else {
    e = build(b, key);
    if (CACHE.size >= 128) CACHE.delete(CACHE.keys().next().value);
  }
  CACHE.set(key, e);
  return e;
}

// Draw a building with its footprint's top-left at (px, py) in world units.
export function drawBuilding(ctx, b, px, py, t = 0) {
  // skip buildings outside the canvas (in the current transform's units); a
  // generous box first, so a far-away building is not even cached yet
  const m = ctx.getTransform();
  const vx = -m.e / m.a, vy = -m.f / m.d, vw = ctx.canvas.width / m.a, vh = ctx.canvas.height / m.d;
  const reach = 64 + Math.max(4, b.rise ?? 0) * TILE;
  if (px + b.w * TILE + 16 < vx || px - 16 > vx + vw || py + b.h * TILE + 16 < vy || py - reach > vy + vh) {
    if (b.decorate) b.decorate(ctx, px, py, t);
    return;
  }
  const e = entryFor(b);
  const x0 = px - e.ml, y0 = py - e.mt;
  const visible = !(x0 > vx + vw || x0 + e.uw < vx || y0 > vy + vh || y0 + e.uh < vy);
  if (visible) {
    ctx.drawImage(e.cv, x0, y0, e.uw, e.uh);
    for (const f of e.live) f(ctx, px, py, t);
  }
  if (b.decorate) b.decorate(ctx, px, py, t);
}
