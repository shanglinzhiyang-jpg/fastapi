// Title screen and character creation (HD scenes: 640x360 screen pixels).
//
//   TitleScene   logo, a dusk skyline with searchlights, an outdoor stage and the
//                はじめから / つづきから menu (resolve('new' | 'continue'))
//   CreateScene  the character editor (new game) and the closet (home.js)
//
// The pixel-art backdrops are drawn once into offscreen canvases at 1 logical
// pixel per pixel and scaled up by the engine, so they stay crisp at any size.

import { SW, SH, shade, mix, makeCanvas, hash2, mulberry32 } from './engine/util.js';
import { text, panel, cursor, COLORS, measure } from './engine/draw.js';
import { charSheetHD, LOOKS, HAIR, HAIR_STYLES, SKIN } from './engine/sprites.js';
import { audio } from './engine/audio.js';
import { drawLogo } from './engine/logos.js';
import { hasSave, loadGame } from './engine/state.js';

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

// ------------------------------------------------------------------ the logo
// 「ドット芸能界」 lettering built from the pixel font: a two-colour fill with banded
// shading, a white rim, a 3D extrusion and a dark outline. Built once the font is ready.
const LOGO_SIZE = 64;
let LOGO = null;

function fontReady() {
  try { return !document.fonts || document.fonts.check(`${LOGO_SIZE}px "DotGothic16"`); } catch (e) { return true; }
}

// fill bands (top to bottom), bottom edge, gap colour, gap shadow
const RAMPS = {
  pink: ['#ffc8e2', '#ff8fc2', '#ff62a6', '#ea4890', '#b8306e', '#7a2a64', '#5a1c4c'],
  gold: ['#fff2a8', '#ffdb4c', '#ffb92e', '#f59a22', '#c8641a', '#8a3a1c', '#682812'],
};

function buildLogo() {
  const parts = [['ドット', 'pink'], ['芸能界', 'gold']];
  const mx = makeCanvas(4, 4)[1];
  const widths = parts.map(([s]) => Math.ceil(measure(mx, s, LOGO_SIZE)));
  const GAP = 10, PAD = 12;
  const W = widths[0] + GAP + widths[1] + PAD * 2;
  const H = LOGO_SIZE + PAD * 2 + 8;
  const tx = makeCanvas(W, H)[1];
  tx.font = `${LOGO_SIZE}px "DotGothic16", monospace`;
  tx.textBaseline = 'top';
  tx.fillStyle = '#fff';
  tx.fillText(parts[0][0], PAD, PAD);
  tx.fillText(parts[1][0], PAD + widths[0] + GAP, PAD);
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
  for (let y = H - 1; y > 0; y--) for (let x = W - 1; x > 0; x--) if (!M[y * W + x] && (M[y * W + x - 1] === 1 || M[(y - 1) * W + x] === 1)) M[y * W + x] = 2;
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
  const EXT = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (RIM[y * W + x]) continue;
    for (let d = 1; d <= 6; d++) if (at(RIM, x, y - d)) { EXT[y * W + x] = d; break; }
  }
  // outer outline
  const OUT = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (RIM[k] || EXT[k]) continue;
    if (at(RIM, x - 1, y) || at(RIM, x + 1, y) || at(RIM, x, y - 1) || at(RIM, x, y + 1) || at(EXT, x - 1, y) || at(EXT, x + 1, y) || at(EXT, x, y - 1) || at(EXT, x, y + 1)) OUT[k] = 1;
  }
  const split = PAD + widths[0] + GAP / 2;
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    const left = x < split;
    const ramp = RAMPS[left ? 'pink' : 'gold'];
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
    } else if (EXT[k]) {
      col = EXT[k] <= 2 ? (left ? '#8a2a6e' : '#a8401e') : EXT[k] <= 4 ? (left ? '#6e1f5a' : '#862f16') : (left ? '#521845' : '#62220f');
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
  return { cv: lc, shine: sc, tmp: bc, tctx: bx, w: W, h: H, top, bot, split };
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
    text(ctx, 'ドット芸能界', cx, y + 10, { size: 48, align: 'center', color: COLORS.accent, outline: '#3a1030' });
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
  const MX = 74, MY = 58;
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
    this.hasSave = hasSave();
    this.idx = this.hasSave ? 1 : 0;
    this.opaque = true;
    this.saveInfo = null;
    if (this.hasSave) {
      try {
        const d = loadGame();
        if (d && d.state) {
          const st = d.state;
          const wd = ['月', '火', '水', '木', '金', '土', '日'][(((st.day || 1) - 1) % 7 + 7) % 7];
          this.saveInfo = `${st.name || '？？？'}・${st.day || 1}日目（${wd}）・★${st.fame || 0}`;
        }
      } catch (e) { this.saveInfo = null; }
    }
    audio.bgm('title'); // only remembered until the first tap/key unlocks audio
  }
  items() { return ['はじめから', 'つづきから']; }
  update(g) {
    this.t++;
    const inp = g.input;
    if (inp.repeat('up') || inp.repeat('down')) { this.idx = 1 - this.idx; audio.sfx('cursor'); }
    if (inp.pressed('a') && this.t > 20) {
      if (this.idx === 1 && !hasSave()) { audio.sfx('buzz'); return; }
      audio.unlock();
      audio.sfx('ok');
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
    drawTitleLogo(ctx, SW / 2, 14 + drop, t);
    if (t > 30) {
      for (let i = 0; i < 4; i++) {
        const p = (t + i * 47) % 120;
        if (p > 24) continue;
        const r = p < 6 || p > 18 ? 1 : p < 10 || p > 14 ? 2 : 3;
        const sx = Math.round(SW / 2 - 180 + hash2(i, Math.floor((t + i * 47) / 120), 5) * 360);
        const sy = Math.round(22 + hash2(i, Math.floor((t + i * 47) / 120), 6) * 70);
        sparkle(ctx, sx, sy, r, '#ffffff');
      }
    }
    if (t > 20) ribbon(ctx, 'めざせ！国民的スター', SW / 2, 110, { size: 16 });

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

    text(ctx, '実在の企業名・ロゴは各社の商標です（非公式ファンゲーム）', SW / 2, SH - 18, { size: 12, align: 'center', color: '#c8a8a0', shadow: '#1a0c10' });
  }
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

// opts (all optional): { look, name, closet }
//   new game: new CreateScene(g, resolve)  -> resolve({ name, look })
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
    if (!this.closet) rows.push(['なまえ', this.name, 'name']);
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
    else rows.push(['これでけってい！', '', 'done']);
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
    const inp = g.input;
    // headless autoplay (tests): the closet closes without changing anything
    if (this.closet && g.auto) { this.finish(null); return; }
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
        let name = null;
        try { name = window.prompt('なまえを入力してください（8文字まで）', this.name); } catch (e) { name = null; }
        g.input.releaseAll();
        if (name && name.trim()) this.name = Array.from(name.trim()).slice(0, 8).join('');
      } else if (k === 'done') {
        audio.sfx('ok');
        this.finish({ name: this.name, look: this.look() });
      } else if (k === 'cancel') {
        audio.sfx('cancel');
        this.finish(null);
      } else this.change(1);
    }
  }

  draw(ctx) {
    const t = this.t;
    const title = this.closet ? 'クローゼットで着がえよう' : 'キャラクターをつくろう';
    if (this.closet) {
      // no clothes hang behind the ribbon (its band + swallow tails), so it reads cleanly
      const half = Math.ceil(measure(ctx, title, 16) / 2) + 22 + 22 + 4;
      closetBg(ctx, t, SW / 2 - half, SW / 2 + half);
    } else {
      drawBackdrop(ctx, t + 500);
      ctx.fillStyle = 'rgba(6,6,20,0.42)';
      ctx.fillRect(0, 0, SW, SH);
    }
    ribbon(ctx, title, SW / 2, 12, { size: 16, color: this.closet ? '#8a5ac8' : '#d63a4a' });
    const look = this.look();
    this.drawPreview(ctx, look);
    this.drawRows(ctx);

    const rows = this.rows();
    const k = rows[this.row][2];
    let help;
    if (this.closet) help = k === 'done' ? 'Aで着がえる' : k === 'cancel' ? 'Aでやめる（もとのまま）' : '◀▶で変更　▲▼で項目えらび　Bでやめる';
    else help = k === 'name' ? 'A：なまえを入力　◀▶：候補から選ぶ' : k === 'done' ? 'Aでゲームスタート！' : '◀▶で変更　▲▼で項目えらび';
    const hw = Math.ceil(measure(ctx, help, 14)) + 36;
    R(ctx, Math.round((SW - hw) / 2), 334, hw, 22, 'rgba(8,8,24,0.78)');
    R(ctx, Math.round((SW - hw) / 2), 334, hw, 1, this.closet ? '#c9a227' : '#5a6ab8');
    text(ctx, help, SW / 2, 338, { size: 14, align: 'center', color: '#d8dcf0', shadow: null });
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
    const nw = Math.max(110, Math.ceil(measure(ctx, this.name, 16)) + 32);
    R(ctx, cx - nw / 2 - 1, ny - 1, nw + 2, 26, OUTLINE);
    R(ctx, cx - nw / 2, ny, nw, 24, this.closet ? '#4a3420' : '#24306a');
    R(ctx, cx - nw / 2, ny, nw, 1, this.closet ? '#8a6a3a' : '#4a5aa8');
    text(ctx, this.name, cx, ny + 4, { size: 16, align: 'center', color: COLORS.accent });
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
