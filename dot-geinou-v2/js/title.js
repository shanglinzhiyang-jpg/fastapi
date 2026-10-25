// Title screen and character creation (HD scenes: 640x360 screen pixels).
//
//   TitleScene   logo, a dusk skyline with searchlights, an outdoor stage and the
//                はじめから / つづきから menu (resolve('new' | 'continue'))
//   CreateScene  the character editor (new game: 見た目 → プロフィール → 家族 → かくにん)
//                and the closet (home.js: the look page only)
//
// The pixel-art backdrops are drawn once into offscreen canvases at 1 logical
// pixel per pixel and scaled up by the engine, so they stay crisp at any size.

import { askText } from './engine/textinput.js';
import { SW, SH, shade, mix, makeCanvas, hash2, mulberry32 } from './engine/util.js';
import { text, panel, cursor, COLORS, measure, wrap } from './engine/draw.js';
import { charSheetHD, drawFaceHD, LOOKS, HAIR, HAIR_STYLES, SKIN } from './engine/sprites.js';
import { audio } from './engine/audio.js';
import { drawLogo } from './engine/logos.js';
import { hasSave, saveSummary, lastSaveSlot, SAVE_SLOTS, storagePersistent } from './engine/state.js';
import {
  AGE_MIN, AGE_MAX, YEAR_DAYS, GENDERS, PREFECTURES, REGIONS, PERSONALITIES, ERAS, RELATIONS, CAUSES,
  ERA_ORDER, REGION_ORDER, PREF_ORDER, RELATION_ORDER, CAUSE_ORDER, PERSONALITY_ORDER,
  FAMILY_NAMES, GIVEN_NAMES, RELATIVE_NAMES, defaultFamily, newFamilyMember, canAddRelation, relationCount,
  personalityEffects, familyLook, sortFamily, fullName,
} from './engine/profile.js';

const LOGO_PARADE = ['yoshimoto', 'shinkigeki', 'bs_yoshimoto', 'shochiku', 'grape', 'nhk', 'toei', 'horipro', 'toho'];
const OUTLINE = '#22202a';

// ------------------------------------------------------------------ pixel helpers
function R(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Filled ellipse drawn as whole-pixel rows (no anti-aliasing).
function ellipse(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}

// A light beam from (bx, by) toward angle `a` (radians, screen space), drawn row by row.
function beam(ctx, bx, by, a, len, w0, k, col, alpha) {
  const dx = Math.cos(a), dy = Math.sin(a);
  if (dy > -0.05) return;
  const top = Math.max(0, Math.round(by + dy * len));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  for (let y = Math.round(by); y >= top; y--) {
    const u = (by - y) / -dy;
    const cx = bx + dx * u;
    const hw = w0 + u * k;
    const x0 = Math.round(cx - hw);
    ctx.fillRect(x0, y, Math.max(1, Math.round(cx + hw) - x0), 1);
  }
  ctx.globalAlpha = 1;
}

// 4-point sparkle, r = 1..3.
function sparkle(ctx, x, y, r, col) {
  R(ctx, x - r, y, r * 2 + 1, 1, col);
  R(ctx, x, y - r, 1, r * 2 + 1, col);
  if (r >= 3) R(ctx, x - 1, y - 1, 3, 3, col);
}

// Small pixel arrow (◀ / ▶), 5 x 9.
function arrow(ctx, x, y, dir, col) {
  for (let i = 0; i < 5; i++) {
    const h = 9 - i * 2;
    R(ctx, dir < 0 ? x + 4 - i : x + i, y + i, 1, h, col);
  }
}

// A colour chip: outline, fill, a light top row and a shaded bottom row.
function swatch(ctx, x, y, w, h, col) {
  R(ctx, x, y, w, h, OUTLINE);
  R(ctx, x + 1, y + 1, w - 2, h - 2, col);
  R(ctx, x + 1, y + 1, w - 2, 1, shade(col, 0.35));
  R(ctx, x + 1, y + h - 3, w - 2, 2, shade(col, -0.22));
}

// Ribbon banner with swallow-tail ends. cx = centre, y = top.
function ribbon(ctx, label, cx, y, opt = {}) {
  const size = opt.size || 16;
  const main = opt.color || '#d63a4a';
  const tw = Math.ceil(measure(ctx, label, size));
  const w = tw + 44, h = size + 10;
  const x = Math.round(cx - w / 2);
  const dark = shade(main, -0.32), darker = shade(main, -0.55);
  const TL = 30; // tail length
  for (const side of [-1, 1]) {
    const tx = side < 0 ? x - TL + 8 : x + w - 8;
    const ty = y + 7;
    const notch = (i) => Math.max(0, 8 - Math.round(Math.abs(i - (h - 1) / 2) * (16 / h)));
    for (let i = -1; i <= h; i++) {
      const n = notch(Math.max(0, Math.min(h - 1, i)));
      if (side < 0) R(ctx, tx + n - 1, ty + i, TL - n + 1, 1, OUTLINE);
      else R(ctx, tx, ty + i, TL - n + 1, 1, OUTLINE);
    }
    for (let i = 0; i < h; i++) {
      const n = notch(i);
      const col = i >= h - 3 ? darker : i === 0 ? main : dark;
      if (side < 0) R(ctx, tx + n, ty + i, TL - n, 1, col);
      else R(ctx, tx, ty + i, TL - n, 1, col);
    }
    // the fold where the tail tucks behind the band
    R(ctx, side < 0 ? x : x + w - 8, y + h, 8, 7, darker);
    R(ctx, side < 0 ? x : x + w - 8, y + h + 7, 8, 1, OUTLINE);
  }
  R(ctx, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  R(ctx, x, y, w, h, main);
  R(ctx, x, y, w, 1, shade(main, 0.35));
  R(ctx, x, y + 1, w, 1, shade(main, 0.15));
  R(ctx, x, y + h - 2, w, 2, dark);
  // stitched edges
  for (let i = x + 4; i < x + w - 4; i += 4) { R(ctx, i, y + 3, 2, 1, shade(main, 0.4)); R(ctx, i, y + h - 5, 2, 1, shade(main, 0.2)); }
  text(ctx, label, cx, y + 5, { size, align: 'center', color: '#ffffff', shadow: darker });
}

// The 「ライフスペシャル」 ribbon under the title logo: the red banner with a gold trim
// line and a twinkling gold star at each end of the band.
function specialRibbon(ctx, cx, y, t = 0) {
  const label = 'ライフスペシャル';
  const size = 16;
  const tw = Math.ceil(measure(ctx, label, size));
  // ribbon() makes the band tw + 44 wide: pad the label with spaces for the stars
  const padded = `　　${label}　　`;
  ribbon(ctx, padded, cx, y, { size, color: '#d63a4a' });
  const w = Math.ceil(measure(ctx, padded, size)) + 44, h = size + 10;
  const x = Math.round(cx - w / 2);
  // gold trim just inside the stitching
  R(ctx, x + 2, y + 1, w - 4, 1, '#ffd86a');
  R(ctx, x + 2, y + h - 2, w - 4, 1, '#c8902a');
  const tw2 = Math.round(tw / 2);
  for (const side of [-1, 1]) {
    const sx = Math.round(cx + side * (tw2 + 22));
    const lit = Math.floor((t + (side > 0 ? 20 : 0)) / 20) % 3 === 0;
    text(ctx, '★', sx, y + 5, { size, align: 'center', color: lit ? '#fff6c8' : '#ffd23f', shadow: '#7a1a22' });
    if (lit) sparkle(ctx, sx + 7, y + 4, 1, '#ffffff');
  }
}

// ------------------------------------------------------------------ the logo
// 「ドット芸能界&政治界」 lettering built from the pixel font: each part has its own fill
// ramp with banded shading, a white rim, a 3D extrusion and a dark outline. Sizes are
// multiples of the font's 16px grid so every stroke stays crisp. Built once the font is ready.
//   ドット (pink, 48px, on the baseline) 芸能界 (gold, 64px) ＆ (red, 64px) 政治界 (blue, 64px)
// (a part can also be a hand-drawn mask: { mask: ['.#.', …], cell } instead of s / size)
export const GAME_TITLE = 'ドット芸能界&政治界　ライフスペシャル';
const LOGO_SIZE = 64;
const LOGO_PARTS = [
  { s: 'ドット', ramp: 'pink', size: 48, dy: 8 },
  { s: '芸能界', ramp: 'gold', size: 64, gap: 2 },
  // the full-width ampersand at the kanji size, thin (no bold): its two loops stay open and
  // it reads as 「＆」 at a glance (the half-width 48px one filled in to a red blob). The
  // glyph's own side bearings give it room, so no extra gap
  { s: '＆', ramp: 'red', size: 64, gap: 0, bold: false },
  { s: '政治界', ramp: 'blue', size: 64, gap: 0 },
];
let LOGO = null;

function fontReady() {
  try { return !document.fonts || document.fonts.check(`${LOGO_SIZE}px "DotGothic16"`); } catch (e) { return true; }
}

// fill bands (top to bottom), bottom edge, gap colour, gap shadow; ext: the extrusion (near → far)
const RAMPS = {
  pink: ['#ffc8e2', '#ff8fc2', '#ff62a6', '#ea4890', '#b8306e', '#7a2a64', '#5a1c4c'],
  gold: ['#fff2a8', '#ffdb4c', '#ffb92e', '#f59a22', '#c8641a', '#8a3a1c', '#682812'],
  blue: ['#d6f4ff', '#8fd8ff', '#5ab4f4', '#3a8ae0', '#2456b0', '#1c2c72', '#141e54'],
  cream: ['#ffffff', '#fff6dc', '#ffe6a8', '#ffd27a', '#c89a3a', '#6a4a2a', '#4a321c'],
  red: ['#ffd6d0', '#ff8f86', '#f25a5a', '#d63a4a', '#a02434', '#6a1a2a', '#4a1220'],
};
const EXT_COL = {
  pink: ['#8a2a6e', '#6e1f5a', '#521845'],
  gold: ['#a8401e', '#862f16', '#62220f'],
  blue: ['#25418e', '#1c3170', '#132252'],
  cream: ['#8a6a3a', '#6e522c', '#4e3a20'],
  red: ['#8a1e2c', '#6e1624', '#50101a'],
};

export function buildLogo(parts = LOGO_PARTS) {
  const mx = makeCanvas(4, 4)[1];
  // a part may be a hand-drawn pixel mask (rows of '#' / '.', cell px per dot) instead of text
  const widths = parts.map((p) => (p.mask ? p.mask[0].length * (p.cell || 4) : Math.ceil(measure(mx, p.s, p.size))));
  const PAD = 12;
  const big = Math.max(...parts.map((p) => p.size || (p.mask ? p.mask.length * (p.cell || 4) : 0)));
  const xs = [];
  let cx = PAD;
  parts.forEach((p, i) => { if (i) cx += p.gap || 0; xs.push(cx); cx += widths[i]; });
  const W = cx + PAD;
  const H = big + PAD * 2 + 8;
  const tx = makeCanvas(W, H)[1];
  tx.textBaseline = 'top';
  tx.fillStyle = '#fff';
  parts.forEach((p, i) => {
    if (p.mask) {
      const c = p.cell || 4;
      const y0 = PAD + Math.round((big - p.mask.length * c) / 2) + (p.dy || 0);
      p.mask.forEach((row, r) => { for (let k = 0; k < row.length; k++) if (row[k] === '#') tx.fillRect(xs[i] + k * c, y0 + r * c, c, c); });
      return;
    }
    tx.font = `${p.size}px "DotGothic16", monospace`;
    // smaller parts sit on the optical centre line of the big ones
    tx.fillText(p.s, xs[i], PAD + Math.round((big - p.size) / 2) + (p.dy || 0));
  });
  // which part a column belongs to: split half way across each gap
  const bounds = parts.slice(1).map((p, i) => Math.round(xs[i + 1] - (p.gap || 0) / 2));
  const partAt = (x) => { let k = 0; while (k < bounds.length && x >= bounds[k]) k++; return k; };
  const src = tx.getImageData(0, 0, W, H).data;
  const N = W * H;
  const M = new Uint8Array(N);
  let top = H, bot = 0;
  for (let i = 0; i < N; i++) {
    if (src[i * 4 + 3] > 127) {
      M[i] = 1;
      const y = (i / W) | 0;
      if (y < top) top = y;
      if (y + 1 > bot) bot = y + 1;
    }
  }
  const at = (a, x, y) => (x >= 0 && y >= 0 && x < W && y < H ? a[y * W + x] : 0);
  // bold: thicken every stroke by one pixel to the right and down
  const boldAt = parts.map((p) => p.bold !== false);
  for (let y = H - 1; y > 0; y--) for (let x = W - 1; x > 0; x--) if (boldAt[partAt(x)] && !M[y * W + x] && (M[y * W + x - 1] === 1 || M[(y - 1) * W + x] === 1)) M[y * W + x] = 2;
  for (let i = 0; i < N; i++) if (M[i]) M[i] = 1;
  // rim: rounded 2px dilation
  const RIM = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (M[y * W + x]) { RIM[y * W + x] = 1; continue; }
    let on = 0;
    for (let dy = -2; dy <= 2 && !on; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= 3 && at(M, x + dx, y + dy)) { on = 1; break; }
    }
    RIM[y * W + x] = on;
  }
  // extrusion: the rim pushed down 1..6 px
  const EXD = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (RIM[y * W + x]) continue;
    for (let d = 1; d <= 6; d++) if (at(RIM, x, y - d)) { EXD[y * W + x] = d; break; }
  }
  // outer outline
  const OUT = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (RIM[k] || EXD[k]) continue;
    if (at(RIM, x - 1, y) || at(RIM, x + 1, y) || at(RIM, x, y - 1) || at(RIM, x, y + 1) || at(EXD, x - 1, y) || at(EXD, x + 1, y) || at(EXD, x, y - 1) || at(EXD, x, y + 1)) OUT[k] = 1;
  }
  // a rim pixel between two strokes (a counter / gap inside a glyph) is painted dark,
  // so the dense kanji keep their shape instead of melting into the white rim
  const near = (x, y, dx, dy) => { for (let d = 1; d <= 5; d++) if (at(M, x + dx * d, y + dy * d)) return true; return false; };
  const inner = (x, y) => (near(x, y, -1, 0) && near(x, y, 1, 0)) || (near(x, y, 0, -1) && near(x, y, 0, 1));
  const [lc, lx] = makeCanvas(W, H);
  const img = lx.createImageData(W, H);
  const d32 = new Uint32Array(img.data.buffer);
  const cache = {};
  const px = (hex) => {
    if (cache[hex]) return cache[hex];
    const n = parseInt(hex.slice(1), 16);
    return (cache[hex] = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0);
  };
  const gh = Math.max(1, bot - top + 1);
  const colRamp = [];
  for (let x = 0; x < W; x++) colRamp.push(parts[partAt(x)].ramp);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    const rk = colRamp[x];
    const ramp = RAMPS[rk];
    const ext = EXT_COL[rk];
    let col = null;
    if (M[k]) {
      const f = (y - top) / gh;
      col = ramp[f < 0.22 ? 0 : f < 0.5 ? 1 : f < 0.78 ? 2 : 3];
      if (!at(M, x, y - 1) && f < 0.6) col = '#ffffff';
      else if (!at(M, x, y + 1)) col = ramp[4];
      else if (!at(M, x + 1, y)) col = mix(col, ramp[4], 0.45);
    } else if (RIM[k]) {
      if (inner(x, y)) col = at(M, x, y - 1) || at(M, x, y - 2) ? ramp[6] : ramp[5];
      else {
        col = (y - top) / gh < 0.62 ? '#fffaf0' : '#f2d8d0';
        if (!at(RIM, x, y + 1)) col = '#d8b4b8';
      }
    } else if (EXD[k]) {
      col = EXD[k] <= 2 ? ext[0] : EXD[k] <= 4 ? ext[1] : ext[2];
    } else if (OUT[k]) col = '#1c0c22';
    if (col) d32[k] = px(col);
  }
  lx.putImageData(img, 0, 0);
  // white silhouette of the fill, for the shine sweep
  const [sc, sx] = makeCanvas(W, H);
  const simg = sx.createImageData(W, H);
  const s32 = new Uint32Array(simg.data.buffer);
  for (let k = 0; k < N; k++) if (M[k]) s32[k] = 0xffffffff;
  sx.putImageData(simg, 0, 0);
  const [bc, bx] = makeCanvas(W, H);
  return { cv: lc, shine: sc, tmp: bc, tctx: bx, w: W, h: H, top, bot };
}

function getLogo() {
  if (LOGO) return LOGO;
  if (!fontReady()) return null;
  try { LOGO = buildLogo(); } catch (e) { console.error(e); LOGO = null; }
  return LOGO;
}

// Draws the logo centred at cx with its top at y. t drives the shine sweep.
export function drawTitleLogo(ctx, cx, y, t = 0) {
  const L = getLogo();
  if (!L) {
    text(ctx, 'ドット芸能界&政治界', cx, y + 16, { size: 32, align: 'center', color: COLORS.accent, outline: '#3a1030' });
    return;
  }
  const x = Math.round(cx - L.w / 2);
  y = Math.round(y);
  ctx.drawImage(L.cv, x, y);
  // a diagonal shine sweeps over the letters every few seconds
  const period = 300, ph = t % period;
  if (ph < 60) {
    const pos = Math.round((ph / 60) * (L.w + 80)) - 40;
    const c = L.tctx;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, L.w, L.h);
    c.fillStyle = '#ffffff';
    for (let yy = 0; yy < L.h; yy++) {
      const x0 = pos - Math.round(yy * 0.6);
      c.fillRect(x0, yy, 7, 1);
      c.fillRect(x0 + 11, yy, 3, 1);
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(L.shine, 0, 0);
    c.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(L.tmp, x, y);
    ctx.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ backdrop
// Dusk sky (banded with a little ordered dither), moon, far skyline with a
// broadcast tower, near skyline with lit windows, and an outdoor stage in front.
const SKY = ['#100c2a', '#151034', '#1b133e', '#231748', '#2d1b52', '#3a1f5a', '#4a2361', '#5c2766', '#712c69', '#883268', '#a03c63', '#b84a5c', '#cc5c55', '#de724f', '#ea8a4c'];
const SKY_BAND = 19;
const HORIZON = SKY.length * SKY_BAND;
const STAGE_Y = 302; // top of the stage floor
const BAYER = [[0, 2], [3, 1]];

let BACK = null;

function buildBackdrop() {
  const rnd = mulberry32(20240611);
  // ---- sky + moon
  const [skyCv, s] = makeCanvas(SW, SH);
  for (let y = 0; y < SH; y++) {
    const i = Math.min(SKY.length - 1, Math.floor(y / SKY_BAND));
    const local = y - i * SKY_BAND;
    const next = SKY[Math.min(SKY.length - 1, i + 1)];
    // the last 3 rows of each band dither into the next colour (25 / 50 / 75 %)
    const k = i < SKY.length - 1 ? local - (SKY_BAND - 4) : 0;
    if (k <= 0) { R(s, 0, y, SW, 1, SKY[i]); continue; }
    R(s, 0, y, SW, 1, SKY[i]);
    s.fillStyle = next;
    for (let x = 0; x < SW; x++) if (BAYER[y & 1][x & 1] < k) s.fillRect(x, y, 1, 1);
  }
  // moon with a soft dithered halo
  const MX = 548, MY = 134; // low on the right, by the tower: clear of the wide title logo
  s.fillStyle = '#3e2a6a';
  for (let dy = -22; dy <= 22; dy++) for (let dx = -22; dx <= 22; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 15 && d <= 21 && ((dx + dy) & 1) === 0 && (d <= 18 || ((dx & 1) === 0 && (dy & 1) === 0))) s.fillRect(MX + dx, MY + dy, 1, 1);
  }
  ellipse(s, MX, MY, 14, 14, '#e8d49a');
  ellipse(s, MX - 1, MY - 1, 13, 13, '#fff1c4');
  ellipse(s, MX - 4, MY - 4, 6, 5, '#fffbe8');
  for (const [cx, cy, r] of [[MX + 4, MY - 2, 3], [MX - 3, MY + 5, 2], [MX + 6, MY + 6, 2], [MX - 7, MY - 1, 1]]) ellipse(s, cx, cy, r, r, '#ead7a2');

  // ---- city (transparent background)
  const [cityCv, c] = makeCanvas(SW, SH);
  const lights = [];
  const flicker = [];
  // far layer
  const FAR = '#3a2550', FAR_HI = '#5a3b72', FAR_WIN = '#b07a96';
  // broadcast tower (generic lattice tower) on the right
  const TX = 584, TTOP = 96, TBASE = 262;
  for (let y = TTOP + 18; y < TBASE; y++) {
    const f = (y - TTOP - 18) / (TBASE - TTOP - 18);
    const hw = Math.round(2 + f * f * 26 + f * 4);
    const band = Math.floor((y - TTOP) / 14) % 2;
    const leg = band ? '#a8506a' : '#c8a4b0';
    R(c, TX - hw - 1, y, 2, 1, '#2a1838');
    R(c, TX + hw, y, 2, 1, '#2a1838');
    R(c, TX - hw, y, 1, 1, leg);
    R(c, TX + hw - 1, y, 1, 1, shade(leg, -0.2));
    // lattice: diagonals inside
    const span = hw * 2 - 2;
    if (span > 4) {
      const p = (y * 2) % span;
      R(c, TX - hw + 1 + p, y, 1, 1, shade(leg, -0.3));
      R(c, TX + hw - 2 - p, y, 1, 1, shade(leg, -0.3));
    }
    if ((y - TTOP) % 14 === 0) R(c, TX - hw, y, hw * 2, 1, leg);
  }
  // decks + antenna
  R(c, TX - 12, 168, 24, 7, '#2a1838'); R(c, TX - 11, 169, 22, 5, '#c8a4b0'); R(c, TX - 11, 169, 22, 1, '#f0dce4'); R(c, TX - 11, 172, 22, 2, '#8a5070');
  for (let i = TX - 9; i < TX + 9; i += 3) R(c, i, 171, 2, 1, '#ffe08a');
  R(c, TX - 7, 136, 14, 5, '#2a1838'); R(c, TX - 6, 137, 12, 3, '#c8a4b0'); R(c, TX - 6, 137, 12, 1, '#f0dce4');
  R(c, TX - 1, TTOP, 2, 40, '#2a1838'); R(c, TX, TTOP + 2, 1, 36, '#c8a4b0');
  lights.push([TX, TTOP - 1, 'tower']);
  // far buildings
  for (let x = -8; x < SW + 8;) {
    const w = 22 + Math.floor(rnd() * 38);
    const top = 204 + Math.floor(rnd() * 46);
    R(c, x, top, w, SH - top, FAR);
    R(c, x, top, w, 1, FAR_HI);
    if (rnd() < 0.4) { const sw = Math.floor(w * 0.5); R(c, x + 4, top - 8, sw, 8, FAR); R(c, x + 4, top - 8, sw, 1, FAR_HI); }
    for (let wy = top + 5; wy < HORIZON; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (hash2(wx, wy, 3) < 0.16) R(c, wx, wy, 2, 2, FAR_WIN);
    x += w + Math.floor(rnd() * 4);
  }
  // near layer
  const BODY = ['#1d1836', '#221a3e', '#191430', '#261c42', '#1f1a3a'];
  for (let x = -6; x < SW + 6;) {
    const side = x < 150 || x > SW - 190;
    const w = 30 + Math.floor(rnd() * 44);
    const top = (side ? 212 : 232) + Math.floor(rnd() * 46);
    const col = BODY[Math.floor(rnd() * BODY.length)];
    const sh = shade(col, -0.3);
    R(c, x - 1, top - 1, w + 2, SH - top + 1, '#0c0a18');
    R(c, x, top, w, SH - top, col);
    R(c, x + w - 6, top, 6, SH - top, sh);
    R(c, x, top, w, 2, shade(col, 0.14));
    R(c, x, top, w - 6, 1, '#6a4a7c');
    R(c, x, top, 1, SH - top, mix(col, '#6a4a7c', 0.5));
    // windows
    for (let wy = top + 7; wy < STAGE_Y; wy += 8) {
      for (let wx = x + 4; wx <= x + w - 10; wx += 6) {
        const h = hash2(wx, wy, 11);
        const shadeSide = wx > x + w - 12;
        if (h < 0.42) {
          const warm = hash2(wx, wy, 5) < 0.85;
          const lit = warm ? '#ffc864' : '#8fdcff';
          R(c, wx, wy, 3, 4, shadeSide ? shade(lit, -0.35) : lit);
          R(c, wx, wy, 3, 1, shadeSide ? shade(lit, -0.2) : warm ? '#fff0c0' : '#d8f4ff');
          if (h < 0.03) flicker.push([wx, wy]);
        } else R(c, wx, wy, 3, 4, shade(col, -0.18));
      }
    }
    // rooftop details
    const r = rnd();
    if (r < 0.3) { // antenna with a red light
      const ax = x + 6 + Math.floor(rnd() * (w - 14));
      const ah = 10 + Math.floor(rnd() * 12);
      R(c, ax, top - ah, 1, ah, '#0c0a18');
      R(c, ax - 2, top - ah + 4, 5, 1, '#0c0a18');
      lights.push([ax, top - ah - 1, 'red']);
    } else if (r < 0.55) { // water tank
      const tx = x + 5 + Math.floor(rnd() * (w - 18));
      R(c, tx, top - 9, 10, 7, '#0c0a18');
      R(c, tx + 1, top - 8, 8, 5, '#3a3050');
      R(c, tx + 1, top - 8, 8, 1, '#6a5a80');
      R(c, tx + 1, top - 2, 1, 2, '#0c0a18'); R(c, tx + 8, top - 2, 1, 2, '#0c0a18');
    } else if (r < 0.75 && w > 40) { // rooftop billboard
      const bw = Math.min(w - 8, 34), bxx = x + 4;
      R(c, bxx, top - 18, bw, 13, '#0c0a18');
      R(c, bxx + 1, top - 17, bw - 2, 11, '#e85a8a');
      R(c, bxx + 1, top - 17, bw - 2, 1, '#ffa0c4');
      R(c, bxx + 4, top - 14, bw - 8, 2, '#fff0f6');
      R(c, bxx + 4, top - 10, Math.floor((bw - 8) * 0.6), 2, '#ffd0e2');
      R(c, bxx + 3, top - 5, 1, 5, '#0c0a18'); R(c, bxx + bw - 4, top - 5, 1, 5, '#0c0a18');
    }
    if (rnd() < 0.3 && w > 34) { // vertical neon sign on the facade
      const nx = x + w - 15, ny = top + 10, nh = 26;
      const nc = ['#ff5d8f', '#5fd7ff', '#ffd23f', '#9a7aff'][Math.floor(rnd() * 4)];
      R(c, nx - 1, ny - 1, 9, nh + 2, '#0c0a18');
      R(c, nx, ny, 7, nh, shade(nc, -0.35));
      for (let i = 0; i < 4; i++) { R(c, nx + 2, ny + 3 + i * 6, 3, 3, nc); R(c, nx + 3, ny + 3 + i * 6, 1, 1, '#ffffff'); }
    }
    x += w + Math.floor(rnd() * 3);
  }

  // ---- stage (on the same layer, in front of the city)
  const SY = STAGE_Y;
  R(c, 0, SY - 1, SW, 1, '#2a140c');
  for (let y = SY; y < SY + 18; y++) R(c, 0, y, SW, 1, y < SY + 9 ? '#b4743e' : '#a06534');
  R(c, 0, SY, SW, 1, '#e0a464');
  R(c, 0, SY + 1, SW, 1, '#c88a4e');
  R(c, 0, SY + 9, SW, 1, '#7a4824');
  for (let i = 0; i < SW; i += 46) { R(c, i, SY + 2, 1, 7, '#8a5428'); R(c, i + 23, SY + 10, 1, 8, '#7a4824'); }
  for (let i = 0; i < 90; i++) { const gx = Math.floor(hash2(i, 9, 2) * SW), gy = SY + 3 + Math.floor(hash2(i, 8, 2) * 14); R(c, gx, gy, 3 + (i % 4), 1, gy < SY + 9 ? '#a8693a' : '#94592c'); }
  // gold trim + front face
  R(c, 0, SY + 18, SW, 1, '#ffe27a');
  R(c, 0, SY + 19, SW, 2, '#c9a227');
  R(c, 0, SY + 21, SW, 1, '#6a5410');
  R(c, 0, SY + 22, SW, SH - SY - 22, '#3a1c22');
  for (let y = SY + 26; y < SH; y += 2) for (let x = (y / 2) % 2 ? 0 : 3; x < SW; x += 6) c.fillRect(x, y, 1, 1);
  c.fillStyle = '#44222a';
  for (let y = SY + 25; y < SH; y += 4) for (let x = ((y >> 2) & 1) * 3; x < SW; x += 6) c.fillRect(x, y, 2, 1);
  // footlight housings along the front edge
  for (let i = 24; i < SW; i += 48) {
    R(c, i - 7, SY + 12, 14, 7, '#1c1014');
    R(c, i - 6, SY + 13, 12, 5, '#3a3036');
    R(c, i - 6, SY + 13, 12, 1, '#6a5a60');
  }
  return { sky: skyCv, city: cityCv, lights, flicker };
}

function backdrop() {
  if (!BACK) BACK = buildBackdrop();
  return BACK;
}

// Stars, searchlights and blinking lights over the cached layers.
function drawBackdrop(ctx, t, { stage = true } = {}) {
  const B = backdrop();
  ctx.drawImage(B.sky, 0, 0);
  // stars (denser near the top, they fade into the dusk)
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(hash2(i, 1, 4) * SW);
    const y = Math.floor(hash2(i, 2, 4) ** 1.6 * 190);
    if (Math.hypot(x - 74, y - 58) < 24) continue;
    const ph = (i * 13 + Math.floor(t / 9)) % 23;
    if (ph === 0) continue;
    const dim = y > 120;
    if (i % 11 === 0) {
      const r = ph < 4 ? 2 : 1;
      sparkle(ctx, x, y, r, dim ? '#d8b0c8' : '#fff6c8');
    } else R(ctx, x, y, 1, 1, dim ? '#a07aa8' : i % 3 ? '#b8bcf0' : '#ffffff');
  }
  // searchlights sweeping from behind the buildings
  for (const [bx, sp, ph] of [[150, 0.011, 0], [470, 0.014, 2.1]]) {
    const a = -Math.PI / 2 + Math.sin(t * sp + ph) * 0.5;
    beam(ctx, bx, 290, a, 330, 4, 0.11, '#fff2c0', 0.07);
    beam(ctx, bx, 290, a, 330, 1.5, 0.04, '#fff2c0', 0.08);
  }
  ctx.drawImage(B.city, 0, 0);
  // aviation lights + a few windows switching on and off
  const blink = Math.floor(t / 40) % 2 === 0;
  for (const [x, y, kind] of B.lights) {
    if (kind === 'tower') { R(ctx, x - 1, y - 1, 3, 3, blink ? '#ff4a4a' : '#7a2030'); if (blink) R(ctx, x, y - 1, 1, 1, '#ffd0d0'); } else if (blink === (x % 2 === 0)) R(ctx, x - 1, y, 3, 2, '#ff5a5a');
  }
  for (const [x, y] of B.flicker) if (Math.floor((t + x * 7) / 150) % 3 === 0) R(ctx, x, y, 3, 4, '#2a2244');
  if (stage) {
    // footlights
    for (let i = 24, n = 0; i < SW; i += 48, n++) {
      const on = (Math.floor(t / 30) + n) % 6 !== 0;
      R(ctx, i - 4, STAGE_Y + 12, 8, 2, on ? '#fff6c8' : '#c9a24a');
      if (on) { R(ctx, i - 3, STAGE_Y + 11, 6, 1, '#fffbe8'); ctx.globalAlpha = 0.18; ellipse(ctx, i, STAGE_Y + 10, 12, 3, '#fff2b0'); ctx.globalAlpha = 1; }
    }
  }
}

// The title's dusk city and stage, dimmed (main.js: the base under the title-flow
// dialogs, e.g. the overwrite question).
export function drawTitleBackdrop(ctx, t = 0, dim = 0.45) {
  drawBackdrop(ctx, t);
  if (dim > 0) {
    ctx.fillStyle = `rgba(6,6,20,${dim})`;
    ctx.fillRect(0, 0, SW, SH);
  }
}

// A character drawn at an integer scale with its feet at (cx, feetY).
function drawFigure(ctx, look, cx, feetY, scale, dir = 'down', frame = 0) {
  const sheet = charSheetHD(look);
  const img = (sheet[dir] && (sheet[dir][frame] || sheet[dir][0])) || sheet.down[0];
  ctx.drawImage(img, Math.round(cx - 16 * scale), Math.round(feetY - 39 * scale), 32 * scale, 40 * scale);
}

// ------------------------------------------------------------------ title scene
const CAST = [
  { look: LOOKS.idol, x: 104, dance: true },
  { look: LOOKS.comedian, x: 536, dance: false },
];

// The cast's spotlights (beams from above and the pools on the floor) never move, so
// they are rasterised once into a transparent layer instead of row by row every frame.
// drawCastLight copies only the two strips that hold them.
let CAST_LIGHT = null;
function drawCastLight(ctx) {
  const cv = castLight();
  for (const m of CAST) {
    const x0 = Math.max(0, m.x - 84), x1 = Math.min(SW, m.x + 84);
    ctx.drawImage(cv, x0, 0, x1 - x0, SH, x0, 0, x1 - x0, SH);
  }
}
function castLight() {
  if (CAST_LIGHT) return CAST_LIGHT;
  const [cv, c] = makeCanvas(SW, SH);
  CAST.forEach((m, i) => {
    const sx = m.x + (i ? 70 : -70), sy = -10, fy = STAGE_Y + 8;
    const a = Math.atan2(sy - fy, sx - m.x);
    const len = Math.hypot(sx - m.x, sy - fy);
    beam(c, m.x, fy, a, len, 30, -0.075, '#fff2c0', 0.08);
    beam(c, m.x, fy, a, len, 18, -0.045, '#fff2c0', 0.07);
  });
  c.globalAlpha = 0.22;
  for (const m of CAST) {
    ellipse(c, m.x, STAGE_Y + 8, 40, 6, '#fff2b0');
    ellipse(c, m.x, STAGE_Y + 8, 26, 4, '#fff8d8');
  }
  c.globalAlpha = 1;
  CAST_LIGHT = cv;
  return cv;
}

// A soft contact shadow under a figure's feet (a pixel ellipse, not a flat bar).
function footShadow(ctx, cx, y, rx, ry, alpha) {
  ctx.globalAlpha = alpha;
  ellipse(ctx, cx, y, rx, ry, '#1c0a10');
  ctx.globalAlpha = 1;
}

export class TitleScene {
  constructor(g, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.hd = true;
    // read once: draw() runs every frame and the save is a large localStorage string
    // a browser that keeps no saves still offers つづきから: its list has 読み込み (file / text)
    this.hasSave = hasSave() || !storagePersistent();
    this.idx = this.hasSave ? 1 : 0;
    this.opaque = true;
    this.saveInfo = null;
    if (this.hasSave) {
      // the slot played last (つづきから then lists all three)
      const n = lastSaveSlot();
      const sm = saveSummary(n);
      if (sm) {
        const wd = ['月', '火', '水', '木', '金', '土', '日'][((sm.day - 1) % 7 + 7) % 7];
        let used = 0;
        for (let i = 1; i <= SAVE_SLOTS; i++) if (hasSave(i)) used++;
        this.saveInfo = `${used > 1 ? `スロット${n}：` : ''}${sm.name}・${sm.day}日目（${wd}）・★${sm.fame}`;
      }
    }
    audio.bgm('title'); // only remembered until the first tap/key unlocks audio
  }
  items() { return ['はじめから', 'つづきから']; }
  update(g) {
    this.t++;
    const inp = g.input;
    // the notice before a new game: A goes on to the character creator, B back to the menu
    if (this.notice) {
      this.notice.t++;
      if (this.notice.t > NOTICE_READY && inp.pressed('a')) { audio.sfx('ok'); g.pop(this); this.resolve('new'); }
      else if (this.notice.t > 3 && (inp.pressed('b') || inp.pressed('menu'))) { audio.sfx('cancel'); this.notice = null; }
      return;
    }
    if (inp.repeat('up') || inp.repeat('down')) { this.idx = 1 - this.idx; audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 20) {
      if (this.idx === 1 && !this.hasSave) { audio.sfx('buzz'); return; }
      audio.unlock();
      audio.sfx('ok');
      if (this.idx === 0 && !g.auto) { this.notice = { t: 0 }; return; }
      g.pop(this);
      this.resolve(this.idx === 0 ? 'new' : 'continue');
    }
  }
  draw(ctx) {
    const t = this.t;
    drawBackdrop(ctx, t);
    // the cast on the stage, each in a spotlight from above (cached layer)
    drawCastLight(ctx);
    CAST.forEach((c, i) => {
      footShadow(ctx, c.x, STAGE_Y + 8, 17, 2, 0.4);
      let dir = 'down', frame = 0, hop = 0;
      const k = Math.floor((t + i * 90) / 15);
      if (c.dance) {
        // a little step dance: left, right, hop
        const beat = k % 16;
        frame = beat < 8 ? [1, 0, 2, 0][beat % 4] : 0;
        hop = beat === 9 || beat === 13 ? 4 : 0;
        dir = beat >= 10 && beat < 12 ? 'right' : 'down';
      } else {
        const beat = k % 20;
        dir = beat < 6 ? 'down' : beat < 9 ? 'left' : beat < 16 ? 'down' : 'right';
        hop = beat === 17 ? 4 : 0;
        frame = beat >= 6 && beat < 9 ? [1, 2][beat % 2] : 0;
      }
      drawFigure(ctx, c.look, c.x, STAGE_Y + 8 - hop, 2, dir, frame);
    });

    // logo: drops in, then a shine sweeps across now and then
    const drop = t < 36 ? Math.round(-120 * (1 - t / 36) ** 2) + (t > 26 ? Math.round(Math.sin(((t - 26) / 10) * Math.PI) * -4) : 0) : 0;
    drawTitleLogo(ctx, SW / 2, 8 + drop, t);
    if (t > 30) {
      for (let i = 0; i < 4; i++) {
        const p = (t + i * 47) % 120;
        if (p > 24) continue;
        const r = p < 6 || p > 18 ? 1 : p < 10 || p > 14 ? 2 : 3;
        const sx = Math.round(SW / 2 - 240 + hash2(i, Math.floor((t + i * 47) / 120), 5) * 480);
        const sy = Math.round(20 + hash2(i, Math.floor((t + i * 47) / 120), 6) * 64);
        sparkle(ctx, sx, sy, r, '#ffffff');
      }
    }
    if (t > 20) specialRibbon(ctx, SW / 2, 104, t);

    // logo parade: the companies you can visit
    const n = LOGO_PARADE.length, SP = 80, BW = 66, BH = 38;
    for (let i = 0; i < n; i++) {
      const x = ((i * SP - Math.floor(t * 0.5)) % (n * SP) + n * SP) % (n * SP) - SP + 8;
      if (x > SW || x + BW < 0) continue;
      R(ctx, x + 2, 156 + 2, BW, BH, 'rgba(8,6,20,0.55)');
      drawLogo(ctx, LOGO_PARADE[i], x, 156, BW, BH, { board: true, pad: 3, frame: OUTLINE });
    }

    // menu
    const items = this.items();
    const save = this.hasSave;
    // the panel grows with the save line (long names, many days, a big ★)
    const infoW = this.saveInfo ? Math.ceil(measure(ctx, this.saveInfo, 12)) : 0;
    const pw = Math.min(SW - 32, Math.max(224, infoW + 32));
    const ph = this.saveInfo ? 86 : 70, px = Math.round((SW - pw) / 2), py = 208;
    const ix = Math.round(SW / 2 - 62); // the entries stay centred however wide the panel is
    panel(ctx, px, py, pw, ph);
    items.forEach((it, i) => {
      const dis = i === 1 && !save;
      const y = py + 12 + i * 26;
      const sel = i === this.idx;
      if (sel) R(ctx, px + 8, y - 3, pw - 16, 22, '#24306a');
      text(ctx, it, ix, y, { size: 16, color: dis ? COLORS.dim : sel ? COLORS.accent : '#ffffff' });
      if (sel) cursor(ctx, ix - 20, y + 4, t);
    });
    if (this.saveInfo) text(ctx, this.saveInfo, SW / 2, py + 64, { size: 12, align: 'center', color: this.idx === 1 ? COLORS.cyan : COLORS.dim, shadow: null });

    text(ctx, 'この物語はフィクションです。実在の企業・政党の名前とロゴは各権利者のものです（非公式ファンゲーム）', SW / 2, SH - 18, { size: 12, align: 'center', color: '#c8a8a0', shadow: '#1a0c10' });
    if (this.notice) drawNotice(ctx, this.notice.t);
  }
}

// ------------------------------------------------------------------ the card before a new game
// A short, neutral card after 「はじめから」 (part of the title flow): where the story goes and that choices have
// results. No lecture and no disclaimer here: the fiction notice is the one small line at the bottom of the title.
const NOTICE_TITLE = 'はじめる前に';
// frames before A goes on (half a second): a quick double tap on はじめから cannot skip the card
const NOTICE_READY = 30;
const NOTICE = [
  'テレビ局のスタジオから、永田町、夜のネオン街まで。\nあなたの人生が、ここから始まります。',
  '仕事も、恋も、政治も、裏の道も。\n選んだことには、それぞれの結果があります。',
  'お酒とタバコは、20歳から選べます。',
];
function drawNotice(ctx, t) {
  ctx.fillStyle = 'rgba(6,4,18,0.72)';
  ctx.fillRect(0, 0, SW, SH);
  const W = 600, TW = W - 60, SIZE = 16;
  const blocks = NOTICE.map((l) => wrap(ctx, l, TW, SIZE));
  const lines = blocks.reduce((a, b) => a + b.length, 0);
  // the card keeps inside the screen with every bullet (a little tighter when there are more lines)
  const LH = lines > 9 ? 20 : 21, GAP = lines > 9 ? 5 : 8;
  const H = 54 + lines * LH + (blocks.length - 1) * GAP + 34;
  const x = Math.round((SW - W) / 2), y = Math.round((SH - H) / 2) + 4;
  const k = Math.min(1, t / 8);
  const yy = y + Math.round((1 - k) * 10);
  ctx.globalAlpha = k;
  panel(ctx, x, yy, W, H);
  ribbon(ctx, NOTICE_TITLE, SW / 2, yy - 10, { size: 16, color: STEP_COLORS.profile });
  let ly = yy + 34;
  blocks.forEach((b, i) => {
    // a small diamond bullet
    const col = '#ffd23f';
    R(ctx, x + 20, ly + 7, 6, 6, shade(col, -0.4));
    R(ctx, x + 21, ly + 8, 4, 4, col);
    b.forEach((l, j) => text(ctx, l, x + 34, ly + j * LH, { size: SIZE, color: '#ffffff' }));
    ly += b.length * LH + GAP;
  });
  if (t > NOTICE_READY) text(ctx, 'A（Z・Enter）：つぎへ　B（X）：もどる', SW / 2, yy + H - 30, { size: 14, align: 'center', color: Math.floor(t / 30) % 2 === 0 ? COLORS.accent : '#c8b070' });
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ character creation
const NAMES = ['ドット', 'ピクセル', 'ハナコ', 'タロウ', 'ミライ', 'ゲイノー'];
const TOPS = ['#d64161', '#2f6fd0', '#2f9a4a', '#ffd23f', '#ff8a3d', '#8a5ac8', '#f2f2f2', '#2a2d36', '#ff7eb6', '#5fd7ff'];
const BOTTOMS = ['#3a4a7a', '#2a2d36', '#5a4a3a', '#f2f2f2', '#c0452f', '#2f9a4a', '#8a5ac8', '#e0c48a'];
const STYLES = HAIR_STYLES.filter((s) => !['helmet', 'mage'].includes(s));
const HAIRC = Object.keys(HAIR);
const SKINS = Object.keys(SKIN).filter((s) => s !== 'green');
const STYLE_NAMES = { short: 'ショート', long: 'ロング', bob: 'ボブ', spiky: 'ツンツン', twin: 'ツインテール', slick: 'オールバック', afro: 'アフロ', cap: 'キャップ', bald: 'スキンヘッド' };
const HAIRC_NAMES = { black: 'くろ', brown: 'ちゃいろ', blonde: 'きんいろ', red: 'あか', silver: 'ぎんいろ', pink: 'ピンク', blue: 'あお', green: 'みどり', purple: 'むらさき', orange: 'オレンジ', white: 'しろ' };
const SKIN_NAMES = { light: 'しろめ', fair: 'ふつう', tan: 'こむぎ', brown: 'ちゃいろ', dark: 'こいめ' };
const GLASSES = [false, true, 'sun'];
const GLASSES_NAMES = ['なし', 'メガネ', 'サングラス'];
const DIRS4 = ['down', 'left', 'up', 'right'];

// layout (screen pixels)
const LP = { x: 20, y: 50, w: 240, h: 278 }; // preview panel
const RP = { x: 272, y: 50, w: 348, h: 278 }; // option rows
const RH = 28; // row height
let STAGE_BG = null; // cached backdrop of the preview stage
const VAL_X = RP.x + 232; // centre of the value column

// The creator's preview stage (w x h, floor top at h - 40): a dark back wall, red side
// curtains, a scalloped valance with a gold fringe and a lamp, and wooden boards.
function buildPreviewStage(w, h) {
  const [cv, c] = makeCanvas(w, h);
  const sfy = h - 40;
  // back wall with a light dither
  R(c, 0, 0, w, sfy, '#0b1030');
  c.fillStyle = '#121a44';
  for (let y = 0; y < sfy; y += 2) for (let x = (y >> 1) & 1 ? 2 : 0; x < w; x += 4) c.fillRect(x, y, 1, 1);
  // floor: three rows of boards, lighter toward the front, staggered joints
  R(c, 0, sfy - 1, w, 1, '#1c0e10');
  const BOARD = ['#7e4a28', '#8e5630', '#9c6036', '#a86a3a'];
  for (let row = 0; row * 10 < 40; row++) {
    const y0 = sfy + row * 10, hh = Math.min(10, h - y0);
    const col = BOARD[Math.min(BOARD.length - 1, row)];
    R(c, 0, y0, w, hh, col);
    R(c, 0, y0, w, 1, shade(col, 0.22));
    R(c, 0, y0 + hh - 1, w, 1, shade(col, -0.35));
    for (let x = (row % 2) * 27 + 9; x < w; x += 54) R(c, x, y0 + 1, 1, hh - 2, shade(col, -0.35));
    for (let i = 0; i < 10; i++) {
      const gx = Math.floor(hash2(i, row, 31) * (w - 8)), gy = y0 + 3 + Math.floor(hash2(i, row, 32) * Math.max(1, hh - 5));
      R(c, gx, gy, 3 + (i % 3) * 2, 1, shade(col, -0.12));
    }
  }
  // side curtains: vertical folds in four tones, dark inner edge, a lighter hem
  const TONES = ['#5a0e1e', '#7a1626', '#9a2234', '#b8344a', '#9a2234', '#7a1626'];
  const CW = 18;
  for (let x = 0; x < CW; x++) {
    const tone = TONES[Math.floor(x / 3) % TONES.length];
    for (const sx of [x, w - 1 - x]) {
      R(c, sx, 0, 1, sfy + 3, tone);
      R(c, sx, sfy + 1, 1, 2, shade(tone, -0.3));
    }
  }
  R(c, CW, 0, 1, sfy + 3, '#2a0610');
  R(c, w - 1 - CW, 0, 1, sfy + 3, '#2a0610');
  // valance with scallops and a gold fringe
  R(c, 0, 0, w, 12, '#8a1a2c');
  R(c, 0, 0, w, 2, '#5a0e1e');
  R(c, 0, 4, w, 1, '#b02a3a');
  for (let x = 0; x < w; x++) {
    const u = ((x % 22) - 10.5) / 11;
    const d = Math.round(4 * Math.sqrt(Math.max(0, 1 - u * u)));
    if (d > 0) R(c, x, 12, 1, d, '#8a1a2c');
    R(c, x, 12 + d, 1, 1, '#c9a227');
    if (x % 2 === 0) R(c, x, 13 + d, 1, 1, '#8a6a1a');
  }
  // the lamp hanging under the valance
  const lx = Math.round(w / 2);
  R(c, lx - 1, 11, 2, 4, OUTLINE);
  R(c, lx - 6, 14, 12, 5, OUTLINE);
  R(c, lx - 5, 15, 10, 3, '#4a4858');
  R(c, lx - 5, 15, 10, 1, '#7a7890');
  R(c, lx - 4, 18, 8, 1, '#fff6c8');
  return cv;
}

// ------------------------------------------------------------------ new game pages
const STEPS = ['look', 'profile', 'family', 'confirm'];
const STEP_TITLES = { look: 'キャラクターをつくろう', profile: 'プロフィール', family: 'かぞく', confirm: 'これでいいかな？' };
const STEP_COLORS = { look: '#d63a4a', profile: '#2f6fd0', family: '#c0703a', confirm: '#2f9a4a' };
const GENDER_ORDER = ['m', 'f', 'x'];
const FAM_L = { x: 20, y: 50, w: 280, h: 278 }; // the family list
const FAM_R = { x: 312, y: 50, w: 308, h: 278 }; // the selected member

// Rows of label + value (◀ value ▶) or buttons, in the look page's style.
// rows: [{ label, value, kind: 'text' | 'cycle' | 'button', pos: [i, n], color, primary }]
function fieldRows(ctx, rows, { x, y, w, rh = 26, valX, sel, t, dim = false, labelX = 34 }) {
  rows.forEach((r, i) => {
    const ry = y + i * rh;
    const on = i === sel;
    if (r.kind === 'button') {
      const bw = w - 60, bx = x + 30, by = ry - 2;
      const main = on ? (r.primary ? COLORS.accent : '#9aa3c7') : dim ? '#1a2250' : '#24306a';
      R(ctx, bx - 1, by - 1, bw + 2, rh - 2, OUTLINE);
      R(ctx, bx, by, bw, rh - 4, main);
      R(ctx, bx, by, bw, 1, shade(main, 0.35));
      R(ctx, bx, by + rh - 6, bw, 2, shade(main, -0.25));
      text(ctx, r.label, x + w / 2, by + (rh - 4 - 16) / 2, { size: 16, align: 'center', color: on ? '#20232a' : dim ? COLORS.dim : '#ffffff', shadow: on ? null : undefined });
      if (on) cursor(ctx, bx + 12, by + (rh - 4) / 2 - 3, t, '#20232a');
      return;
    }
    if (on) {
      R(ctx, x + 8, ry - 4, w - 16, rh - 2, '#24306a');
      R(ctx, x + 8, ry - 4, 2, rh - 2, COLORS.accent);
      cursor(ctx, x + 18, ry + 4, t);
    }
    text(ctx, r.label, x + labelX, ry, { size: 16, color: on ? COLORS.accent : dim ? COLORS.dim : '#ffffff' });
    // the value, shrunk to fit between the label and the arrows
    const room = Math.min(valX - (x + labelX + measure(ctx, r.label, 16) + 26), x + w - 30 - valX) * 2;
    const vs = [16, 14, 12].find((z) => measure(ctx, r.value, z) <= room) || 12;
    const v = fitTo(ctx, r.value, room, vs);
    const vw = Math.ceil(measure(ctx, v, vs));
    text(ctx, v, valX, ry + (16 - vs) / 2, { size: vs, align: 'center', color: r.color || (on ? '#ffffff' : dim ? COLORS.dim : COLORS.cyan) });
    if (r.kind === 'text') {
      // a dotted "write here" line under a name
      const ul = Math.max(40, Math.ceil(vw / 2) + 3);
      for (let k = -ul; k < ul; k += 3) R(ctx, valX + k, ry + 19, 2, 1, on ? COLORS.accent : '#5a6ab8');
    }
    if (on) {
      const half = r.kind === 'text' ? Math.max(40, vw / 2) : vw / 2;
      const nudge = Math.floor(t / 12) % 2;
      arrow(ctx, Math.round(valX - half - 16 - nudge), ry + 4, -1, COLORS.accent);
      arrow(ctx, Math.round(valX + half + 11 + nudge), ry + 4, 1, COLORS.accent);
      if (r.pos) {
        const pos = `${r.pos[0]}/${r.pos[1]}`;
        if (valX + half + 24 + measure(ctx, pos, 12) <= x + w - 14) text(ctx, pos, x + w - 14, ry + 3, { size: 12, align: 'right', color: COLORS.dim, shadow: null });
      }
    }
  });
}

// A small box of explanation lines ([text, colour]), wrapped to the box (at most what fits).
function descBox(ctx, { x, y, w, h }, lines, size = 13) {
  R(ctx, x, y, w, h, '#0b1030');
  R(ctx, x, y, w, 1, '#3a4a8a');
  const lh = size + (size <= 12 ? 3 : 4);
  const out = [];
  for (const [l, c] of lines) for (const ln of wrap(ctx, l, w - 16, size)) out.push([ln, c]);
  out.slice(0, Math.floor((h - 6) / lh)).forEach(([l, c], i) => text(ctx, l, x + 8, y + 5 + i * lh, { size, color: c, shadow: null }));
}

// Cut a string to maxW with '…'.
function fitTo(ctx, s, maxW, size) {
  if (measure(ctx, s, size) <= maxW) return s;
  const ch = Array.from(s);
  while (ch.length > 1 && measure(ctx, ch.join('') + '…', size) > maxW) ch.pop();
  return ch.join('') + '…';
}

// Join items with ・ into at most maxLines lines of width w (the rest becomes ' ほか').
function wrapItems(ctx, items, w, size, maxLines) {
  const lines = [];
  let cur = '';
  for (let i = 0; i < items.length; i++) {
    const next = cur ? `${cur}・${items[i]}` : items[i];
    if (measure(ctx, next, size) <= w || !cur) { cur = next; continue; }
    lines.push(cur + '・');
    cur = items[i];
    if (lines.length === maxLines) { lines[maxLines - 1] = fitTo(ctx, lines[maxLines - 1].replace(/・$/, '') + ' ほか', w, size); return lines; }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

// A tiny 5x5 flower (for family members who have passed away: gentle, not sad).
function flower(ctx, x, y) {
  R(ctx, x + 1, y, 3, 1, '#f2d0e8'); R(ctx, x, y + 1, 5, 3, '#f2d0e8'); R(ctx, x + 1, y + 4, 3, 1, '#f2d0e8');
  R(ctx, x + 2, y + 2, 1, 1, '#ffd23f');
}
function arrowUp(ctx, x, y, t) {
  const o = Math.floor(t / 10) % 2;
  for (let i = 0; i < 4; i++) R(ctx, x + i, y - o + 3 - i, 7 - i * 2, 1, '#ffffff');
}
function downArrowSmall(ctx, x, y, t) {
  const o = Math.floor(t / 10) % 2;
  for (let i = 0; i < 4; i++) R(ctx, x + i, y + o + i, 7 - i * 2, 1, '#ffffff');
}

// opts (all optional): { look, name, closet, profile }
//   new game: new CreateScene(g, resolve)  -> resolve({ name, look, profile })
//             four pages: 見た目 → プロフィール（姓・名・性別・年齢・出身・性格・時代）→
//             家族 → かくにん (B goes back a page). name = the given name (state.name);
//             profile = the shape documented in engine/profile.js. Text goes through
//             askText (the in-game text box), never window.prompt.
//   closet:   new CreateScene(g, resolve, { look, name, closet: true })
//             starts from the given look, the name row is hidden (the name stays),
//             B or 「やめる」 cancels -> resolve(null), otherwise resolve({ name, look }).
export class CreateScene {
  constructor(g, resolve, opts = {}) {
    this.g = g;
    this.resolve = resolve;
    this.t = 0;
    this.row = 0;
    this.hd = true;
    this.opaque = true;
    this.closet = !!opts.closet;
    this.name = opts.name || NAMES[0];
    this.base = opts.look ? { ...opts.look } : null;
    // per-scene option lists: a look the editor cannot make (special colour etc.) is kept as an extra first entry
    this.lists = { style: STYLES.slice(), hairc: HAIRC.slice(), skin: SKINS.slice(), top: TOPS.slice(), bottom: BOTTOMS.slice(), glasses: GLASSES.slice() };
    this.v = { style: 0, hairc: 0, skin: 1, top: 0, bottom: 0, skirt: 0, glasses: 0 };
    if (this.base) this.fromLook(this.base);
    this.naming = null;
    this.flash = 0; // brief highlight on the preview after a change
    // new game: the profile pages (the closet only has the look page)
    this.step = 'look';
    const p0 = opts.profile || {};
    this.prof = {
      familyName: p0.familyName || FAMILY_NAMES[0], givenName: p0.givenName || GIVEN_NAMES.x[0], gender: p0.gender || 'x',
      age: p0.age || 20, hometown: p0.hometown || 'tokyo', personality: p0.personality || 'akarui', era: p0.era || 'reiwa',
    };
    this.family = Array.isArray(p0.family) ? p0.family.map((m) => ({ ...m })) : defaultFamily(this.prof.familyName);
    this.pRow = 0; // profile page row
    this.fIdx = 0; // family list row (members, then ＋ and つぎへ)
    this.fFocus = 'list'; // 'list' | 'edit' (the member's fields) | 'add' (choose a relation)
    this.fRow = 0; // field row in 'edit'
    this.addIdx = 0; // relation row in 'add'
    this.fTop = 0; // first visible family row
    this.cRow = 0; // confirm page: 0 = start, 1 = back
    this.stepT = 0;
  }
  // The name on the plate under the preview: the full name in a new game.
  plateName() { return this.closet ? this.name : `${this.prof.familyName} ${this.prof.givenName}`; }
  // Open the in-game text box; done(value) runs with a non-empty value.
  typeText(title, value, max, done) {
    audio.sfx('ok');
    this.naming = true;
    askText(this.g, { title, value, max }).then((v) => {
      this.naming = false;
      if (v) { done(v); this.flash = 10; }
    });
  }
  goStep(step) {
    this.step = step;
    this.stepT = 0;
    this.flash = 10;
  }
  fromLook(look) {
    const at = (key, val) => {
      const list = this.lists[key];
      let i = list.indexOf(val);
      if (i < 0) { list.unshift(val); i = 0; }
      return i;
    };
    // defaults match the sprite palette (sprites.js) so an incomplete look keeps its appearance
    this.v.style = at('style', look.hair || 'short');
    this.v.hairc = at('hairc', look.hairColor || 'black');
    this.v.skin = at('skin', look.skin || 'fair');
    this.v.top = at('top', look.top || '#d64161');
    this.v.bottom = at('bottom', look.bottom || '#3a4a7a');
    this.v.skirt = look.skirt ? 1 : 0;
    this.v.glasses = at('glasses', look.glasses || false);
    this.top0 = this.v.top; // the hat keeps its colour until the top changes
  }
  look() {
    const v = this.v;
    const L = this.lists;
    const look = {
      hair: L.style[v.style], hairColor: L.hairc[v.hairc], skin: L.skin[v.skin], top: L.top[v.top], bottom: L.bottom[v.bottom],
      skirt: v.skirt === 1, glasses: L.glasses[v.glasses],
      // closet: the hat keeps its colour (or the sprite default when the look had none) until the top changes
      hat: this.base && v.top === this.top0 ? this.base.hat : L.top[(v.top + 3) % L.top.length],
    };
    if (look.hat === undefined) delete look.hat;
    return this.base ? { ...this.base, ...look } : look;
  }
  // [label, value, key]; key = what ◀▶ changes ('name' / a key of this.v / 'done' / 'cancel')
  rows() {
    const v = this.v;
    const L = this.lists;
    const rows = [];
    rows.push(
      ['かみがた', STYLE_NAMES[L.style[v.style]] || 'いまの髪型', 'style'],
      ['かみのいろ', HAIRC_NAMES[L.hairc[v.hairc]] || 'いまの色', 'hairc'],
      ['はだのいろ', SKIN_NAMES[L.skin[v.skin]] || 'いまの色', 'skin'],
      ['トップス', '■', 'top'],
      ['ボトムス', '■', 'bottom'],
      ['スカート', v.skirt ? 'あり' : 'なし', 'skirt'],
      ['めがね', GLASSES_NAMES[GLASSES.indexOf(L.glasses[v.glasses])] || 'いまのメガネ', 'glasses'],
    );
    if (this.closet) rows.push(['これでOK！', '', 'done'], ['やめる', '', 'cancel']);
    else rows.push(['つぎへ（プロフィール）', '', 'done']);
    return rows;
  }
  change(d) {
    const v = this.v;
    const k = this.rows()[this.row][2];
    if (k === 'name') {
      const i = NAMES.indexOf(this.name);
      this.name = NAMES[((i < 0 ? 0 : i) + d + NAMES.length) % NAMES.length];
      audio.sfx('cursor');
      this.flash = 10;
      return;
    }
    if (!(k in v)) return;
    const len = k === 'skirt' ? 2 : this.lists[k].length;
    v[k] = (v[k] + d + len) % len;
    audio.sfx('cursor');
    this.flash = 10;
  }
  finish(result) {
    this.g.pop(this);
    this.resolve(result);
  }
  update(g) {
    this.t++;
    if (this.flash > 0) this.flash--;
    this.stepT++;
    if (this.naming) return; // name box open
    const inp = g.input;
    // headless autoplay (tests): the closet closes without changing anything
    if (this.closet && g.auto) { this.finish(null); return; }
    if (!this.closet && this.step !== 'look') {
      if (this.stepT < 4) return; // the press that turned the page is not reused
      if (this.step === 'profile') this.updateProfile(g, inp);
      else if (this.step === 'family') this.updateFamily(g, inp);
      else this.updateConfirm(g, inp);
      return;
    }
    const rows = this.rows();
    const n = rows.length;
    if (inp.repeat('up')) { this.row = (this.row + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.row = (this.row + 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('left')) this.change(-1);
    if (inp.repeat('right')) this.change(1);
    if (this.closet && inp.pressed('b') && this.t > 10) { audio.sfx('cancel'); this.finish(null); return; }
    if (inp.pressed('a') && this.t > 10) {
      const k = rows[this.row][2];
      if (k === 'name') {
        audio.sfx('ok');
        // in-game text box (window.prompt froze the loop and left touch input stuck on phones)
        this.naming = true;
        askText(g, { title: 'なまえを入力してください', value: this.name, max: 8 }).then((name) => {
          this.naming = false;
          if (name) this.name = name;
        });
      } else if (k === 'done') {
        audio.sfx('ok');
        if (this.closet) this.finish({ name: this.name, look: this.look() });
        else this.goStep('profile');
      } else if (k === 'cancel') {
        audio.sfx('cancel');
        this.finish(null);
      } else this.change(1);
    }
  }

  draw(ctx) {
    const t = this.t;
    const step = this.closet ? 'look' : this.step;
    const title = this.closet ? 'クローゼットで着がえよう' : STEP_TITLES[step];
    if (this.closet) {
      // no clothes hang behind the ribbon (its band + swallow tails), so it reads cleanly
      const half = Math.ceil(measure(ctx, title, 16) / 2) + 22 + 22 + 4;
      closetBg(ctx, t, SW / 2 - half, SW / 2 + half);
    } else {
      drawBackdrop(ctx, t + 500);
      ctx.fillStyle = 'rgba(6,6,20,0.42)';
      ctx.fillRect(0, 0, SW, SH);
    }
    ribbon(ctx, title, SW / 2, 12, { size: 16, color: this.closet ? '#8a5ac8' : STEP_COLORS[step] });
    if (!this.closet) this.drawSteps(ctx);
    const look = this.look();
    let help;
    if (step === 'look') {
      this.drawPreview(ctx, look);
      this.drawRows(ctx);
      const rows = this.rows();
      const k = rows[this.row][2];
      if (this.closet) help = k === 'done' ? 'Aで着がえる' : k === 'cancel' ? 'Aでやめる（もとのまま）' : '◀▶で変更　▲▼で項目えらび　Bでやめる';
      else help = k === 'name' ? 'A：なまえを入力　◀▶：候補から選ぶ' : k === 'done' ? 'Aでつぎへ（プロフィール）' : '◀▶で変更　▲▼で項目えらび';
    } else if (step === 'profile') {
      this.drawPreview(ctx, look);
      help = this.drawProfile(ctx);
    } else if (step === 'family') {
      help = this.drawFamily(ctx, look);
    } else {
      this.drawPreview(ctx, look);
      help = this.drawConfirm(ctx);
    }
    this.drawHelp(ctx, help);
  }

  drawHelp(ctx, help) {
    const hw = Math.ceil(measure(ctx, help, 14)) + 36;
    R(ctx, Math.round((SW - hw) / 2), 334, hw, 22, 'rgba(8,8,24,0.78)');
    R(ctx, Math.round((SW - hw) / 2), 334, hw, 1, this.closet ? '#c9a227' : '#5a6ab8');
    text(ctx, help, SW / 2, 338, { size: 14, align: 'center', color: '#d8dcf0', shadow: null });
  }

  // Four numbered steps at the top right (new game).
  drawSteps(ctx) {
    const i0 = STEPS.indexOf(this.step);
    const S = 22, GAP = 12, x0 = SW - 16 - STEPS.length * S - (STEPS.length - 1) * GAP, y = 15;
    STEPS.forEach((st, i) => {
      const x = x0 + i * (S + GAP);
      if (i > 0) R(ctx, x - GAP, y + S / 2 - 1, GAP, 2, i <= i0 ? COLORS.accent : '#4a4a6a');
      const col = i === i0 ? COLORS.accent : i < i0 ? '#5a6ab8' : '#1a1e3e';
      R(ctx, x - 1, y - 1, S + 2, S + 2, OUTLINE);
      R(ctx, x, y, S, S, col);
      R(ctx, x, y, S, 1, shade(col, 0.35));
      R(ctx, x, y + S - 2, S, 2, shade(col, -0.3));
      text(ctx, String(i + 1), x + S / 2, y + 3, { size: 14, align: 'center', color: i === i0 ? '#20232a' : i < i0 ? '#ffffff' : '#7a7ea8', shadow: null });
    });
  }

  // ---------------------------------------------------------------- page 2: プロフィール
  profRows() {
    const p = this.prof;
    const pos = (list, v) => [list.indexOf(v) + 1, list.length];
    return [
      { key: 'familyName', label: '姓', value: p.familyName, kind: 'text' },
      { key: 'givenName', label: '名', value: p.givenName, kind: 'text' },
      { key: 'gender', label: '性別', value: GENDERS[p.gender].name, kind: 'cycle', pos: pos(GENDER_ORDER, p.gender) },
      { key: 'age', label: '年齢', value: `${p.age}さい`, kind: 'cycle', pos: [p.age - AGE_MIN + 1, AGE_MAX - AGE_MIN + 1] },
      { key: 'hometown', label: '出身', value: PREFECTURES[p.hometown].name, kind: 'cycle', pos: pos(PREF_ORDER, p.hometown) },
      { key: 'personality', label: '性格', value: PERSONALITIES[p.personality].name, kind: 'cycle', pos: pos(PERSONALITY_ORDER, p.personality) },
      { key: 'era', label: '時代', value: ERAS[p.era].label, kind: 'cycle', pos: pos(ERA_ORDER, p.era) },
      { key: 'next', label: 'つぎへ（家族）', kind: 'button', primary: true },
    ];
  }
  setFamilyName(v) {
    const old = this.prof.familyName;
    this.prof.familyName = v;
    // family members who share the old family name take the new one
    for (const m of this.family) if (m.name.startsWith(old + ' ')) m.name = v + m.name.slice(old.length);
  }
  changeProfile(key, d) {
    const p = this.prof;
    const cyc = (list, v) => list[(list.indexOf(v) + d + list.length) % list.length];
    if (key === 'familyName') this.setFamilyName(cyc(FAMILY_NAMES, p.familyName) || FAMILY_NAMES[0]);
    else if (key === 'givenName') p.givenName = cyc(GIVEN_NAMES[p.gender], p.givenName) || GIVEN_NAMES[p.gender][0];
    else if (key === 'gender') p.gender = cyc(GENDER_ORDER, p.gender);
    else if (key === 'age') {
      const a = Math.min(AGE_MAX, Math.max(AGE_MIN, p.age + d));
      if (a === p.age) { audio.sfx('buzz'); return; }
      p.age = a;
    } else if (key === 'hometown') p.hometown = cyc(PREF_ORDER, p.hometown);
    else if (key === 'personality') p.personality = cyc(PERSONALITY_ORDER, p.personality);
    else if (key === 'era') p.era = cyc(ERA_ORDER, p.era);
    else return;
    audio.sfx('cursor');
    this.flash = 10;
  }
  // A on 出身: the first prefecture of the next region
  nextRegion() {
    const r = PREFECTURES[this.prof.hometown].region;
    const nr = REGION_ORDER[(REGION_ORDER.indexOf(r) + 1) % REGION_ORDER.length];
    this.prof.hometown = PREF_ORDER.find((id) => PREFECTURES[id].region === nr);
    audio.sfx('cursor');
    this.flash = 10;
  }
  updateProfile(g, inp) {
    const rows = this.profRows();
    const n = rows.length;
    if (inp.repeat('up')) { this.pRow = (this.pRow + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.pRow = (this.pRow + 1) % n; audio.sfx('cursor'); }
    const row = rows[this.pRow];
    if (inp.repeat('left')) this.changeProfile(row.key, -1);
    if (inp.repeat('right')) this.changeProfile(row.key, 1);
    if (inp.pressed('b')) { audio.sfx('cancel'); this.goStep('look'); return; }
    if (!inp.pressed('a')) return;
    const p = this.prof;
    if (row.key === 'familyName') this.typeText('姓（みょうじ）を入力してください', p.familyName, 6, (v) => this.setFamilyName(v));
    else if (row.key === 'givenName') this.typeText('名（なまえ）を入力してください', p.givenName, 8, (v) => { p.givenName = v; });
    else if (row.key === 'hometown') this.nextRegion();
    else if (row.key === 'next') { audio.sfx('ok'); this.goStep('family'); } else this.changeProfile(row.key, 1);
  }
  drawProfile(ctx) {
    const { x, y, w, h } = RP;
    panel(ctx, x, y, w, h);
    const rows = this.profRows();
    fieldRows(ctx, rows, { x, y: y + 10, w, rh: 25, valX: VAL_X, sel: this.pRow, t: this.t });
    // what the selected row means
    const row = rows[this.pRow];
    const p = this.prof;
    let lines;
    if (row.key === 'familyName' || row.key === 'givenName') lines = [['A：入力する　◀▶：候補から選ぶ', COLORS.accent], ['まわりの人からは「名」で呼ばれます。', COLORS.text], ['家族の名字も、いっしょに変わります。', COLORS.dim]];
    else if (row.key === 'gender') lines = [['家族からの呼ばれ方などが、少し変わります。', COLORS.text], ['（見た目は「見た目」のページで）', COLORS.dim]];
    else if (row.key === 'age') {
      // 1年＝YEAR_DAYS日; 20: alcohol / tobacco; 被選挙権 25 (参院・知事 30), the same in every era
      lines = [[`${AGE_MIN}〜${AGE_MAX}さい。${YEAR_DAYS}日で1年、誕生日がきます。`, COLORS.text], ['お酒・タバコは20さい、立候補は25さいから。', COLORS.text]];
      if (p.age < 25) lines.push([`（立候補まで あと${(25 - p.age) * YEAR_DAYS}日。参院・知事は30さい）`, COLORS.dim]);
      else if (p.age < 30) lines.push([`（参議院・知事は30さいから。あと${(30 - p.age) * YEAR_DAYS}日）`, COLORS.dim]);
      else lines.push(['（どの選挙にも立候補できます）', COLORS.dim]);
    }
    else if (row.key === 'hometown') {
      const reg = REGIONS[PREFECTURES[p.hometown].region];
      lines = [[`${reg.name}地方　A：次の地方へ`, COLORS.accent], [`ふるさとから、${reg.gift.name}が届くことも。`, COLORS.text], ['（家族がいれば）', COLORS.dim]];
    } else if (row.key === 'personality') lines = [[PERSONALITIES[p.personality].desc, COLORS.text], [personalityEffects(p.personality), COLORS.cyan]];
    else if (row.key === 'era') lines = [...ERAS[p.era].desc.split('\n').map((l) => [l, COLORS.text]), ['（政党・選挙・法律も、その時代のしくみに）', COLORS.dim]];
    else lines = [['つぎは家族の設定です。', COLORS.text], ['Bでひとつ前のページにもどれます。', COLORS.dim]];
    descBox(ctx, { x: x + 10, y: y + h - 70, w: w - 20, h: 60 }, lines);
    return row.key === 'next' ? 'Aでつぎへ　Bでもどる' : row.kind === 'text' ? 'A：入力　◀▶：候補　▲▼：項目　Bでもどる' : row.key === 'hometown' ? '◀▶：都道府県　A：次の地方　Bでもどる' : '◀▶で変更　▲▼で項目えらび　Bでもどる';
  }

  // ---------------------------------------------------------------- page 3: 家族
  famItems() {
    return [...this.family.map((m, i) => ({ kind: 'member', m, i })), { kind: 'add' }, { kind: 'next' }];
  }
  famFields(m) {
    const rows = [
      { key: 'name', label: 'なまえ', value: m.name, kind: 'text' },
      { key: 'alive', label: 'ようす', value: m.alive ? '元気' : '他界', kind: 'cycle', color: m.alive ? COLORS.good : '#c8b8e8' },
    ];
    if (!m.alive) rows.push({ key: 'cause', label: '死因', value: (CAUSES[m.cause] || CAUSES.secret).name, kind: 'cycle', pos: [CAUSE_ORDER.indexOf(m.cause) + 1, CAUSE_ORDER.length] });
    rows.push({ key: 'remove', label: 'この人をはずす', kind: 'button' }, { key: 'back', label: 'もどる', kind: 'button' });
    return rows;
  }
  changeMember(m, key, d) {
    if (key === 'name') {
      const fam = this.prof.familyName;
      const names = RELATIVE_NAMES[m.rel] || [];
      const given = m.name.startsWith(fam + ' ') ? m.name.slice(fam.length + 1) : '';
      const i = names.indexOf(given);
      m.name = `${fam} ${names[((i < 0 ? -1 : i) + d + names.length) % names.length]}`;
    } else if (key === 'alive') {
      m.alive = !m.alive;
      m.cause = m.alive ? null : (m.rel === 'grandfather' || m.rel === 'grandmother' ? 'age' : 'illness');
    } else if (key === 'cause') {
      const i = CAUSE_ORDER.indexOf(m.cause);
      m.cause = CAUSE_ORDER[((i < 0 ? 0 : i) + d + CAUSE_ORDER.length) % CAUSE_ORDER.length];
    } else return;
    audio.sfx('cursor');
    this.flash = 10;
  }
  updateFamily(g, inp) {
    const items = this.famItems();
    if (this.fFocus === 'add') {
      const n = RELATION_ORDER.length;
      if (inp.repeat('up')) { this.addIdx = (this.addIdx + n - 1) % n; audio.sfx('cursor'); }
      if (inp.repeat('down')) { this.addIdx = (this.addIdx + 1) % n; audio.sfx('cursor'); }
      if (inp.pressed('b')) { audio.sfx('cancel'); this.fFocus = 'list'; return; }
      if (inp.pressed('a')) {
        const rel = RELATION_ORDER[this.addIdx];
        if (!canAddRelation(this.family, rel)) { audio.sfx('buzz'); return; }
        audio.sfx('ok');
        const m = newFamilyMember(rel, this.prof.familyName, this.family);
        this.family = sortFamily([...this.family, m]);
        this.fIdx = this.family.indexOf(m);
        this.fFocus = 'edit';
        this.fRow = 0;
        this.flash = 10;
      }
      return;
    }
    if (this.fFocus === 'edit') {
      const m = this.family[this.fIdx];
      if (!m) { this.fFocus = 'list'; return; }
      const rows = this.famFields(m);
      const n = rows.length;
      this.fRow = Math.min(this.fRow, n - 1);
      if (inp.repeat('up')) { this.fRow = (this.fRow + n - 1) % n; audio.sfx('cursor'); }
      if (inp.repeat('down')) { this.fRow = (this.fRow + 1) % n; audio.sfx('cursor'); }
      const row = rows[this.fRow];
      if (inp.repeat('left')) this.changeMember(m, row.key, -1);
      if (inp.repeat('right')) this.changeMember(m, row.key, 1);
      if (inp.pressed('b')) { audio.sfx('cancel'); this.fFocus = 'list'; return; }
      if (!inp.pressed('a')) return;
      if (row.key === 'name') this.typeText(`${RELATIONS[m.rel].name}のなまえを入力してください`, m.name, 12, (v) => { m.name = v; });
      else if (row.key === 'remove') {
        audio.sfx('cancel');
        this.family.splice(this.fIdx, 1);
        this.fFocus = 'list';
        this.fIdx = Math.min(this.fIdx, this.famItems().length - 1);
      } else if (row.key === 'back') { audio.sfx('cancel'); this.fFocus = 'list'; } else this.changeMember(m, row.key, 1);
      return;
    }
    const n = items.length;
    this.fIdx = Math.min(this.fIdx, n - 1);
    if (inp.repeat('up')) { this.fIdx = (this.fIdx + n - 1) % n; audio.sfx('cursor'); }
    if (inp.repeat('down')) { this.fIdx = (this.fIdx + 1) % n; audio.sfx('cursor'); }
    if (inp.pressed('b')) { audio.sfx('cancel'); this.goStep('profile'); return; }
    if (!inp.pressed('a')) return;
    const it = items[this.fIdx];
    audio.sfx('ok');
    if (it.kind === 'member') { this.fFocus = 'edit'; this.fRow = 0; } else if (it.kind === 'add') {
      this.fFocus = 'add';
      const free = RELATION_ORDER.findIndex((r) => canAddRelation(this.family, r));
      this.addIdx = free < 0 ? 0 : free;
    } else this.goStep('confirm');
  }
  drawFamily(ctx, look) {
    const t = this.t;
    const items = this.famItems();
    // left: the list
    const L = FAM_L;
    panel(ctx, L.x, L.y, L.w, L.h);
    text(ctx, `家族　${this.family.length}人`, L.x + 16, L.y + 10, { size: 16, color: COLORS.cyan });
    text(ctx, `${this.prof.familyName}家`, L.x + L.w - 16, L.y + 12, { size: 13, align: 'right', color: COLORS.dim });
    R(ctx, L.x + 10, L.y + 32, L.w - 20, 1, '#3a4a8a');
    const RHF = 26, rowsVis = Math.floor((L.h - 46) / RHF);
    if (this.fIdx < this.fTop) this.fTop = this.fIdx;
    if (this.fIdx >= this.fTop + rowsVis) this.fTop = this.fIdx - rowsVis + 1;
    this.fTop = Math.max(0, Math.min(this.fTop, items.length - rowsVis));
    const listActive = this.fFocus === 'list';
    for (let k = 0; k < rowsVis && this.fTop + k < items.length; k++) {
      const i = this.fTop + k;
      const it = items[i];
      const ry = L.y + 40 + k * RHF;
      const sel = i === this.fIdx;
      if (it.kind === 'next') {
        const bw = L.w - 40, bx = L.x + 20, by = ry;
        const main = sel && listActive ? COLORS.accent : '#24306a';
        R(ctx, bx - 1, by - 1, bw + 2, RHF - 2, OUTLINE);
        R(ctx, bx, by, bw, RHF - 4, main);
        R(ctx, bx, by, bw, 1, shade(main, 0.35));
        text(ctx, 'つぎへ（かくにん）', L.x + L.w / 2, by + 3, { size: 16, align: 'center', color: sel && listActive ? '#20232a' : '#ffffff', shadow: sel && listActive ? null : undefined });
        if (sel && listActive) cursor(ctx, bx + 10, by + 7, t, '#20232a');
        continue;
      }
      if (sel) {
        R(ctx, L.x + 8, ry - 3, L.w - 16, RHF - 2, listActive ? '#24306a' : '#1a2250');
        R(ctx, L.x + 8, ry - 3, 2, RHF - 2, listActive ? COLORS.accent : '#5a6ab8');
      }
      if (sel && listActive) cursor(ctx, L.x + 16, ry + 5, t);
      if (it.kind === 'add') {
        const full = RELATION_ORDER.every((r) => !canAddRelation(this.family, r));
        text(ctx, '＋ 家族をふやす', L.x + 30, ry, { size: 16, color: full ? COLORS.dim : sel ? COLORS.accent : COLORS.cyan });
        continue;
      }
      const m = it.m;
      const rel = RELATIONS[m.rel].name;
      const cw = Math.ceil(measure(ctx, rel, 13)) + 10;
      const chip = m.alive ? '#5a6ab8' : '#6a5a7a';
      R(ctx, L.x + 30, ry + 1, cw, 17, chip);
      R(ctx, L.x + 30, ry + 1, cw, 1, shade(chip, 0.35));
      text(ctx, rel, L.x + 30 + cw / 2, ry + 3, { size: 13, align: 'center', color: '#ffffff', shadow: null });
      const st = m.alive ? '元気' : '他界';
      const sw = measure(ctx, st, 13);
      const nx = L.x + 36 + cw, maxW = L.x + L.w - 22 - sw - 8 - nx;
      const ns = [16, 14, 12].find((z) => measure(ctx, m.name, z) <= maxW) || 12;
      text(ctx, fitTo(ctx, m.name, maxW, ns), nx, ry + (16 - ns) / 2, { size: ns, color: sel ? COLORS.accent : COLORS.text });
      text(ctx, st, L.x + L.w - 18, ry + 2, { size: 13, align: 'right', color: m.alive ? COLORS.good : '#c8b8e8', shadow: null });
      if (!m.alive) flower(ctx, L.x + L.w - 26 - sw, ry + 5);
    }
    if (this.fTop > 0) arrowUp(ctx, L.x + L.w / 2 - 3, L.y + 36, t);
    if (this.fTop + rowsVis < items.length) downArrowSmall(ctx, L.x + L.w / 2 - 3, L.y + L.h - 10, t);

    // right: the selected member, the relation chooser, or a note
    const P = FAM_R;
    panel(ctx, P.x, P.y, P.w, P.h);
    const it = items[this.fIdx];
    const note = ['家族は、物語の背景になる設定です。', '亡くなった家族のことも、思い出として', 'やさしく語られるだけです。'];
    if (this.fFocus === 'add') {
      text(ctx, 'だれをふやす？', P.x + 16, P.y + 10, { size: 16, color: COLORS.cyan });
      RELATION_ORDER.forEach((r, i) => {
        const ry = P.y + 38 + i * 24;
        const ok = canAddRelation(this.family, r);
        const sel = i === this.addIdx;
        if (sel) { R(ctx, P.x + 8, ry - 3, P.w - 16, 22, '#24306a'); R(ctx, P.x + 8, ry - 3, 2, 22, COLORS.accent); cursor(ctx, P.x + 16, ry + 4, t); }
        text(ctx, `${RELATIONS[r].name}（${RELATIONS[r].call}）`, P.x + 30, ry, { size: 16, color: !ok ? COLORS.dim : sel ? COLORS.accent : COLORS.text });
        text(ctx, `${relationCount(this.family, r)}/${RELATIONS[r].max}`, P.x + P.w - 18, ry + 2, { size: 13, align: 'right', color: ok ? COLORS.dim : COLORS.bad, shadow: null });
      });
      return '▲▼でえらぶ　Aでふやす　Bでもどる';
    }
    if (it && it.kind === 'member') {
      const m = it.m;
      const edit = this.fFocus === 'edit';
      // a small portrait (a soft frame with a flower for someone who has passed away)
      R(ctx, P.x + 14, P.y + 14, 76, 60, m.alive ? '#0b1030' : '#2a2440');
      if (!m.alive) { R(ctx, P.x + 14, P.y + 14, 76, 2, '#c8b8e8'); R(ctx, P.x + 14, P.y + 72, 76, 2, '#c8b8e8'); }
      drawFaceHD(ctx, familyLook(m, look), P.x + 20, P.y + 20, 2);
      if (!m.alive) flower(ctx, P.x + 78, P.y + 60);
      text(ctx, `${RELATIONS[m.rel].name}（${RELATIONS[m.rel].call}）`, P.x + 102, P.y + 16, { size: 13, color: COLORS.dim });
      const ns = [16, 14, 12].find((z) => measure(ctx, m.name, z) <= P.w - 118) || 12;
      text(ctx, fitTo(ctx, m.name, P.w - 118, ns), P.x + 102, P.y + 36, { size: ns, color: COLORS.accent });
      text(ctx, m.alive ? '元気にしている' : `${(CAUSES[m.cause] || CAUSES.secret).text || ''}旅立った`, P.x + 102, P.y + 58, { size: 13, color: m.alive ? COLORS.good : '#c8b8e8' });
      fieldRows(ctx, this.famFields(m), { x: P.x, y: P.y + 88, w: P.w, rh: 25, valX: P.x + 206, sel: edit ? this.fRow : -1, t, dim: !edit, labelX: 30 });
      descBox(ctx, { x: P.x + 10, y: P.y + P.h - 62, w: P.w - 20, h: 56 }, note.map((l) => [l, COLORS.dim]), 12);
      if (!edit) return 'Aでこの人を編集　▲▼でえらぶ　Bでもどる';
      const k = this.famFields(m)[this.fRow].key;
      return k === 'name' ? 'A：入力　◀▶：候補　Bで一覧へ' : k === 'remove' ? 'Aでこの人をはずす　Bで一覧へ' : k === 'back' ? 'Aで一覧へもどる' : '◀▶で変更　▲▼で項目えらび　Bで一覧へ';
    }
    if (it && it.kind === 'add') {
      text(ctx, '家族をふやす', P.x + 16, P.y + 10, { size: 16, color: COLORS.cyan });
      const lines = [['父・母・祖父・祖母は1人ずつ、', COLORS.text], ['兄・姉・弟・妹は2人まで。', COLORS.text], ['家族がいると、電話や仕送り、', COLORS.text], ['帰省のおたのしみがあります。', COLORS.text]];
      lines.forEach(([l, c], i) => text(ctx, l, P.x + 18, P.y + 42 + i * 22, { size: 15, color: c }));
      descBox(ctx, { x: P.x + 10, y: P.y + P.h - 62, w: P.w - 20, h: 56 }, note.map((l) => [l, COLORS.dim]), 12);
      return 'Aでえらぶ　▲▼で項目えらび　Bでもどる';
    }
    // つぎへ: a short summary
    text(ctx, this.family.length ? 'この家族で上京します' : 'ひとりで上京します', P.x + 16, P.y + 10, { size: 16, color: COLORS.cyan });
    const alive = this.family.filter((m) => m.alive).length;
    const lines = this.family.length
      ? [[`いっしょに暮らしていた家族：${this.family.length}人`, COLORS.text], [`元気な家族：${alive}人`, COLORS.good], [alive ? 'ふるさとから、ときどき連絡が来るかも。' : '空から、そっと見守ってくれている。', COLORS.dim]]
      : [['家族のいない設定です。', COLORS.text], ['仲間たちが、新しい家族になるかも。', COLORS.dim]];
    lines.forEach(([l, c], i) => text(ctx, l, P.x + 18, P.y + 44 + i * 24, { size: 15, color: c }));
    descBox(ctx, { x: P.x + 10, y: P.y + P.h - 62, w: P.w - 20, h: 56 }, note.map((l) => [l, COLORS.dim]), 12);
    return 'Aでつぎへ　▲▼で項目えらび　Bでもどる';
  }

  // ---------------------------------------------------------------- page 4: かくにん
  profileResult() {
    return { ...this.prof, family: this.family.map((m) => ({ ...m })) };
  }
  updateConfirm(g, inp) {
    if (inp.repeat('up') || inp.repeat('down')) { this.cRow = 1 - this.cRow; audio.sfx('cursor'); }
    if (inp.pressed('b')) { audio.sfx('cancel'); this.goStep('family'); return; }
    if (!inp.pressed('a')) return;
    if (this.cRow === 1) { audio.sfx('cancel'); this.goStep('family'); return; }
    audio.sfx('ok');
    this.finish({ name: this.prof.givenName, look: this.look(), profile: this.profileResult() });
  }
  drawConfirm(ctx) {
    const { x, y, w, h } = RP;
    const t = this.t;
    panel(ctx, x, y, w, h);
    const p = this.prof;
    const pref = PREFECTURES[p.hometown];
    const rows = [
      ['氏名', `${p.familyName} ${p.givenName}`],
      ['性別', GENDERS[p.gender].name],
      ['年齢', `${p.age}さい`],
      ['出身', `${pref.name}（${REGIONS[pref.region].name}）`],
      ['性格', PERSONALITIES[p.personality].name],
      ['時代', ERAS[p.era].label],
    ];
    const LX = x + 20, VX = x + 86, VW = w - 106;
    // family on up to three lines (laid out first: the under-25 note goes where there is room)
    const fy = y + 12 + rows.length * 24;
    const fam = sortFamily(this.family).map((m) => `${RELATIONS[m.rel].name} ${m.name.startsWith(p.familyName + ' ') ? m.name.slice(p.familyName.length + 1) : m.name}${m.alive ? '' : '（他界）'}`);
    const flines = wrapItems(ctx, fam.length ? fam : ['なし（ひとりで上京）'], VW, 14, 3);
    const noteLine = p.age < 25 && fy + 1 + flines.length * 18 <= y + h - 86;
    rows.forEach(([k, v], i) => {
      const ry = y + 12 + i * 24;
      text(ctx, k, LX, ry, { size: 16, color: COLORS.cyan });
      const vs = [16, 14, 12].find((z) => measure(ctx, v, z) <= VW) || 12;
      text(ctx, fitTo(ctx, v, VW, vs), VX, ry + (16 - vs) / 2, { size: vs, color: COLORS.text });
      // under 25: a small dim note beside the age (the days are on a line above the buttons)
      if (k === '年齢' && p.age < 25 && !noteLine && measure(ctx, '（立候補は25さいから）', 12) <= VW - measure(ctx, v, vs) - 10) {
        text(ctx, '（立候補は25さいから）', VX + measure(ctx, v, vs) + 10, ry + 3, { size: 12, color: COLORS.dim });
      }
    });
    text(ctx, '家族', LX, fy, { size: 16, color: COLORS.cyan });
    flines.forEach((l, i) => text(ctx, l, VX, fy + 1 + i * 18, { size: 14, color: COLORS.text }));
    // under 25: how long until the first election (1年＝YEAR_DAYS日), when the family leaves room
    if (noteLine) {
      text(ctx, `選挙に立候補できるのは25さいから（あと${(25 - p.age) * YEAR_DAYS}日）`, LX, y + h - 86, { size: 13, color: COLORS.dim });
    }
    // buttons
    ['これでスタート！', 'もどる'].forEach((label, i) => {
      const bw = w - 60, bx = x + 30, by = y + h - 64 + i * 30;
      const sel = i === this.cRow;
      const main = sel ? (i === 0 ? COLORS.accent : '#9aa3c7') : '#24306a';
      R(ctx, bx - 1, by - 1, bw + 2, 26, OUTLINE);
      R(ctx, bx, by, bw, 24, main);
      R(ctx, bx, by, bw, 1, shade(main, 0.35));
      R(ctx, bx, by + 22, bw, 2, shade(main, -0.25));
      text(ctx, label, x + w / 2, by + 4, { size: 16, align: 'center', color: sel ? '#20232a' : '#ffffff', shadow: sel ? null : undefined });
      if (sel) cursor(ctx, bx + 12, by + 8, t, '#20232a');
    });
    return this.cRow === 0 ? 'Aでゲームスタート！　Bでもどる' : 'Aで家族のページへもどる';
  }

  // The big turning preview (3x) plus the four directions (1x).
  drawPreview(ctx, look) {
    const t = this.t;
    const { x, y, w, h } = LP;
    const dir = DIRS4[Math.floor(t / 50) % 4];
    const frame = [1, 0, 2, 0][Math.floor(t / 10) % 4];
    const cx = x + w / 2;
    const stage = { x: x + 10, y: y + 10, w: w - 20, h: 186 };
    if (this.closet) {
      panel(ctx, x, y, w, h, { bg: '#2a1f30', edge: '#e8d6a0' });
      // full-length mirror with a gold frame
      const mx = stage.x + 34, my = stage.y, mw = stage.w - 68, mh = stage.h;
      R(ctx, mx - 1, my - 1, mw + 2, mh + 2, OUTLINE);
      R(ctx, mx, my, mw, mh, '#c9a227');
      R(ctx, mx, my, mw, 1, '#ffe27a'); R(ctx, mx, my, 1, mh, '#ffe27a');
      R(ctx, mx + mw - 2, my, 2, mh, '#8a6a1a'); R(ctx, mx, my + mh - 2, mw, 2, '#8a6a1a');
      R(ctx, mx + 4, my + 4, mw - 8, mh - 8, '#6a5010');
      const gx = mx + 5, gy = my + 5, gw = mw - 10, gh = mh - 10;
      R(ctx, gx, gy, gw, gh, '#8fb8d8');
      R(ctx, gx, gy + gh - 34, gw, 34, '#7aa4c8');
      R(ctx, gx, gy + gh - 34, gw, 1, '#a8cce6');
      // diagonal glints
      ctx.fillStyle = '#bcdcf2';
      for (let i = 0; i < 46; i++) { ctx.fillRect(gx + 8 + i, gy + 52 - i, 6, 1); ctx.fillRect(gx + 20 + i, gy + 52 - i, 2, 1); }
      R(ctx, gx, gy, gw, 1, '#5a7a98');
      R(ctx, gx, gy, 1, gh, '#5a7a98');
      // crown ornament
      R(ctx, cx - 10, my - 5, 20, 5, OUTLINE); R(ctx, cx - 9, my - 4, 18, 4, '#c9a227'); R(ctx, cx - 9, my - 4, 18, 1, '#ffe27a');
      R(ctx, cx - 2, my - 8, 4, 4, OUTLINE); R(ctx, cx - 1, my - 7, 2, 2, '#ff7eb6');
      ctx.globalAlpha = 0.28;
      ellipse(ctx, cx, gy + gh - 12, 30, 4, '#2a4058');
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
      drawFigure(ctx, look, cx, gy + gh - 12, 3, dir, frame);
      ctx.restore();
    } else {
      panel(ctx, x, y, w, h);
      // a small stage with curtains and a spotlight (the static part is cached)
      if (!STAGE_BG) STAGE_BG = buildPreviewStage(stage.w, stage.h);
      ctx.drawImage(STAGE_BG, stage.x, stage.y);
      const fy = stage.y + stage.h - 40;
      ctx.save();
      ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
      // the beam rises from the pool on the floor to the lamp under the valance
      // (its foot drifts a little; the top stays on the lamp)
      const bx = cx + Math.round(Math.sin(t / 60) * 4), by = fy + 22, ly = stage.y + 18;
      const a = Math.atan2(ly - by, cx - bx), len = Math.hypot(cx - bx, ly - by);
      beam(ctx, bx, by, a, len, 44, -0.2, '#fff2c0', 0.08);
      beam(ctx, bx, by, a, len, 26, -0.12, '#fff6d8', 0.07);
      ctx.restore();
      ctx.globalAlpha = 0.22;
      ellipse(ctx, cx, fy + 22, 48, 7, '#ffd890');
      ellipse(ctx, cx, fy + 22, 32, 4, '#fff0c8');
      ctx.globalAlpha = 1;
      footShadow(ctx, cx, fy + 22, 24, 3, 0.45);
      drawFigure(ctx, look, cx, fy + 22, 3, dir, frame);
      // sparkle after a change
      if (this.flash > 0) {
        const r = this.flash > 6 ? 3 : this.flash > 3 ? 2 : 1;
        sparkle(ctx, cx + 40, fy - 96, r, '#ffffff');
        sparkle(ctx, cx - 44, fy - 60, Math.max(1, r - 1), '#fff6a8');
      }
    }
    // name plate
    const ny = y + 202;
    const plate = this.plateName();
    const ps = measure(ctx, plate, 16) + 32 <= w - 16 ? 16 : 14;
    const nw = Math.min(w - 16, Math.max(110, Math.ceil(measure(ctx, plate, ps)) + 32));
    R(ctx, cx - nw / 2 - 1, ny - 1, nw + 2, 26, OUTLINE);
    R(ctx, cx - nw / 2, ny, nw, 24, this.closet ? '#4a3420' : '#24306a');
    R(ctx, cx - nw / 2, ny, nw, 1, this.closet ? '#8a6a3a' : '#4a5aa8');
    text(ctx, plate, cx, ny + 4 + (16 - ps) / 2, { size: ps, align: 'center', color: COLORS.accent });
    // the four directions
    const sheet = charSheetHD(look);
    const tw = 44, tx0 = Math.round(cx - (tw * 4) / 2);
    DIRS4.forEach((d, i) => {
      const bx = tx0 + i * tw;
      const by = y + h - 50;
      const cur = d === dir;
      R(ctx, bx + 2, by, tw - 4, 44, cur ? (this.closet ? '#4a3420' : '#24306a') : (this.closet ? '#231a28' : '#0e1534'));
      if (cur) R(ctx, bx + 2, by + 42, tw - 4, 2, COLORS.accent);
      ctx.drawImage(sheet[d][0], bx + 6, by + 2, 32, 40);
    });
  }

  drawRows(ctx) {
    const { x, y, w, h } = RP;
    const t = this.t;
    panel(ctx, x, y, w, h, this.closet ? { bg: '#2a1f30', edge: '#e8d6a0' } : {});
    const rows = this.rows();
    // rows are centred vertically in the panel
    const y0 = y + Math.round((h - rows.length * RH) / 2) + 2;
    rows.forEach(([label, value, key], i) => {
      const ry = y0 + i * RH;
      const sel = i === this.row;
      if (key === 'done' || key === 'cancel') {
        const bw = w - 60, bx = x + 30, by = ry - 2;
        const main = sel ? (key === 'done' ? COLORS.accent : '#9aa3c7') : this.closet ? '#3e2e48' : '#24306a';
        R(ctx, bx - 1, by - 1, bw + 2, RH - 4 + 2, OUTLINE);
        R(ctx, bx, by, bw, RH - 4, main);
        R(ctx, bx, by, bw, 1, shade(main, 0.35));
        R(ctx, bx, by + RH - 6, bw, 2, shade(main, -0.25));
        text(ctx, label, x + w / 2, by + 3, { size: 16, align: 'center', color: sel ? '#20232a' : '#ffffff', shadow: sel ? null : undefined });
        if (sel) cursor(ctx, bx + 12, by + 7, t, '#20232a');
        return;
      }
      if (sel) {
        R(ctx, x + 8, ry - 4, w - 16, RH - 2, this.closet ? '#45304e' : '#24306a');
        R(ctx, x + 8, ry - 4, 2, RH - 2, COLORS.accent);
      }
      text(ctx, label, x + 34, ry, { size: 16, color: sel ? COLORS.accent : '#ffffff' });
      if (sel) cursor(ctx, x + 18, ry + 4, t);
      // value
      let half = 0;
      if (key === 'top' || key === 'bottom') {
        const col = this.lists[key][this.v[key]];
        swatch(ctx, VAL_X - 26, ry + 1, 52, 16, col);
        half = 26;
      } else if (key === 'name') {
        const nw = Math.ceil(measure(ctx, value, 16));
        text(ctx, value, VAL_X, ry, { size: 16, align: 'center', color: COLORS.accent });
        // a dotted "write here" line under the name (as wide as the name, at least 96 px)
        const ul = Math.max(48, Math.ceil(nw / 2) + 3);
        for (let i = -ul; i < ul; i += 3) R(ctx, VAL_X + i, ry + 19, 2, 1, sel ? COLORS.accent : '#5a6ab8');
        half = Math.max(48, nw / 2);
      } else {
        const chip = key === 'hairc' ? (HAIR[this.lists.hairc[this.v.hairc]] || null) : key === 'skin' ? (SKIN[this.lists.skin[this.v.skin]] || null) : null;
        const tw = Math.ceil(measure(ctx, value, 16));
        const full = tw + (chip ? 18 : 0);
        const lx = Math.round(VAL_X - full / 2);
        if (chip) swatch(ctx, lx, ry + 2, 14, 14, chip);
        text(ctx, value, lx + (chip ? 18 : 0), ry, { size: 16, color: sel ? '#ffffff' : COLORS.cyan });
        half = full / 2;
      }
      if (sel && (key in this.v || key === 'name')) {
        const nudge = Math.floor(t / 12) % 2;
        arrow(ctx, Math.round(VAL_X - half - 16 - nudge), ry + 4, -1, COLORS.accent);
        arrow(ctx, Math.round(VAL_X + half + 11 + nudge), ry + 4, 1, COLORS.accent);
        // where in the list we are (n / N)
        if (key !== 'name') {
          const len = key === 'skirt' ? 2 : this.lists[key].length;
          const pos = `${this.v[key] + 1}/${len}`;
          if (VAL_X + half + 24 + measure(ctx, pos, 12) <= x + w - 16) text(ctx, pos, x + w - 16, ry + 3, { size: 12, align: 'right', color: COLORS.dim, shadow: null });
        }
      }
    });
  }
}

// Closet backdrop: the inside of a wooden wardrobe with clothes on a brass rail.
let CLOSET = null;
// gapL..gapR: a stretch of the rail left empty (where the title ribbon hangs).
function closetBg(ctx, t, gapL = SW, gapR = SW) {
  if (!CLOSET) {
    const [cv, c] = makeCanvas(SW, SH);
    R(c, 0, 0, SW, SH, '#5a3a20');
    for (let x = 0; x < SW; x += 32) {
      R(c, x, 0, 31, SH, '#6e4428');
      R(c, x, 0, 1, SH, '#84542e');
      R(c, x + 30, 0, 1, SH, '#4a2e18');
      // wood grain
      for (let i = 0; i < 9; i++) {
        const gx = x + 4 + Math.floor(hash2(x, i, 1) * 22);
        const gy = Math.floor(hash2(x, i, 2) * SH);
        R(c, gx, gy, 1, 10 + Math.floor(hash2(x, i, 3) * 26), '#623c22');
      }
    }
    // shelf at the bottom with shoe boxes
    R(c, 0, SH - 30, SW, 30, '#4a2e18');
    R(c, 0, SH - 30, SW, 2, '#9a6a3a');
    R(c, 0, SH - 28, SW, 1, '#2e1c10');
    // rail
    R(c, 0, 5, SW, 4, OUTLINE);
    R(c, 0, 6, SW, 2, '#c9a227');
    R(c, 0, 6, SW, 1, '#ffe27a');
    CLOSET = cv;
  }
  ctx.drawImage(CLOSET, 0, 0);
  // hanging clothes (sway a little): T-shirts, and trousers every fourth hanger
  for (let i = 0; i < 22; i++) {
    const x0 = i * 30 + 4;
    if (x0 + 23 > gapL && x0 - 2 < gapR) continue; // tested unswayed, so none pops in and out
    const x = x0 + Math.round(Math.sin(t / 40 + i) * 1);
    R(ctx, x + 10, 8, 1, 4, '#d8d8e0');
    R(ctx, x + 3, 12, 15, 1, '#d8d8e0');
    R(ctx, x + 3, 12, 1, 1, '#9a9aa8'); R(ctx, x + 17, 12, 1, 1, '#9a9aa8');
    if (i % 4 === 3) drawHangingTrousers(ctx, x, BOTTOMS[(i >> 2) % BOTTOMS.length]);
    else drawHangingShirt(ctx, x, TOPS[i % TOPS.length]);
  }
}

// 21 x 23 T-shirt on a hanger at (x, 13): sleeves, body, collar, top-left light.
function drawHangingShirt(ctx, x, col) {
  const hi = shade(col, 0.35), sh = shade(col, -0.2), dk = shade(col, -0.4);
  R(ctx, x, 13, 21, 8, OUTLINE); // sleeves
  R(ctx, x + 3, 13, 15, 23, OUTLINE); // body
  R(ctx, x + 1, 14, 19, 6, col);
  R(ctx, x + 4, 14, 13, 21, col);
  R(ctx, x + 1, 14, 19, 1, hi);
  R(ctx, x + 1, 15, 1, 4, hi);
  R(ctx, x + 14, 15, 3, 20, sh); // right side in shade
  R(ctx, x + 17, 15, 3, 4, sh);
  R(ctx, x + 1, 19, 3, 1, dk); R(ctx, x + 17, 19, 3, 1, dk); // sleeve hems
  R(ctx, x + 4, 17, 1, 3, dk); R(ctx, x + 16, 17, 1, 3, dk); // armholes
  R(ctx, x + 8, 14, 5, 2, dk); R(ctx, x + 9, 16, 3, 1, dk); // collar
  R(ctx, x + 4, 33, 13, 1, sh); // hem
}

// 15 x 24 trousers folded over the hanger bar at (x + 3, 12).
function drawHangingTrousers(ctx, x, col) {
  const hi = shade(col, 0.35), sh = shade(col, -0.22), dk = shade(col, -0.45);
  R(ctx, x + 3, 13, 15, 23, OUTLINE);
  R(ctx, x + 4, 13, 13, 22, col);
  R(ctx, x + 4, 13, 13, 1, hi);
  R(ctx, x + 4, 16, 13, 1, dk); // waistband
  R(ctx, x + 13, 17, 3, 18, sh);
  R(ctx, x + 10, 22, 1, 14, OUTLINE); // the two legs
  R(ctx, x + 6, 18, 1, 16, shade(col, 0.15)); // crease
  R(ctx, x + 12, 23, 1, 11, shade(col, 0.1));
}

// ------------------------------------------------------------------ the era's opening card
// After the creator (new game): a few lines about the era over the dusk city (sepia for
// 昭和, a cool blue for 平成), then who you are. A shows everything / goes on.
//   new EraIntroScene(g, profile, resolve)
const ERA_TINT = { showa: 'rgba(130,86,34,0.38)', heisei: 'rgba(36,70,140,0.28)', reiwa: null };
export class EraIntroScene {
  constructor(g, profile, resolve) {
    this.g = g;
    this.resolve = resolve;
    this.hd = true;
    this.opaque = true;
    this.t = 0;
    const p = profile || {};
    const era = ERAS[p.era] || ERAS.reiwa;
    this.era = p.era in ERAS ? p.era : 'reiwa';
    const pref = PREFECTURES[p.hometown] || PREFECTURES.tokyo;
    this.lines = [...(era.intro || []), `${p.familyName || ''} ${p.givenName || ''}、${p.age || 20}さい。`.trim(), `${pref.name}から、めざせ！国民的スター！`];
    this.label = era.label;
  }
  get allShown() { return this.t >= (this.lines.length - 1) * LINE_GAP + 30; }
  update(g) {
    this.t++;
    if (g.auto) { this.done(); return; }
    if (g.input.pressed('a') || g.input.pressed('b')) {
      if (!this.allShown) { this.t = (this.lines.length - 1) * LINE_GAP + 30; return; }
      audio.sfx('ok');
      this.done();
    }
  }
  done() { this.g.pop(this); this.resolve(); }
  draw(ctx) {
    const t = this.t;
    drawTitleBackdrop(ctx, t + 900, 0.55);
    const tint = ERA_TINT[this.era];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, SW, SH); }
    ribbon(ctx, this.label, SW / 2, 30, { size: 16, color: STEP_COLORS.profile });
    const n = this.lines.length;
    const y0 = Math.round(SH / 2 - (n * 30) / 2) + 12;
    this.lines.forEach((l, i) => {
      const k = Math.max(0, Math.min(1, (t - i * LINE_GAP) / 30));
      if (k <= 0) return;
      ctx.globalAlpha = k;
      const last = i >= n - 2;
      text(ctx, l, SW / 2, y0 + i * 30 + Math.round((1 - k) * 6), { size: 16, align: 'center', color: last ? COLORS.accent : '#ffffff', shadow: '#0a0612' });
      ctx.globalAlpha = 1;
    });
    if (this.allShown && Math.floor(t / 30) % 2 === 0) text(ctx, 'Aでスタート', SW / 2, SH - 34, { size: 14, align: 'center', color: '#d8dcf0', shadow: '#0a0612' });
  }
}
const LINE_GAP = 50;
