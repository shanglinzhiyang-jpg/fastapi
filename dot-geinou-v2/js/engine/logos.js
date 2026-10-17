// Company logos, shown as pixelated "dot" signboards.
//
//   drawLogo(ctx, 'nhk', x, y, w, h, { board: true })   // fit inside w x h logical px
//
// The source images live in assets/logos/. They are trademarks of their
// respective owners and are used here only as signboards in a fan game.

import { makeCanvas, display } from './util.js';

// mark: [sx, sy, sw, sh] = the symbol alone (no small wordmark). It is used when the
//   whole logo would be drawn shorter than markBelow px (default 56), where thin
//   lettering only turns into broken dots.
// tint: recolour the (single-colour) logo.
export const LOGOS = {
  yoshimoto: { file: 'yoshimoto.png', name: 'よしもと', bg: '#ffffff', mark: [13, 10, 228, 228] },
  shinkigeki: { file: 'shinkigeki.png', name: 'よしもと新喜劇', bg: '#fff6d0' },
  bs_yoshimoto: { file: 'bs_yoshimoto.png', name: 'BSよしもと', bg: '#ffffff' },
  shochiku: { file: 'shochiku.png', name: '松竹芸能', bg: '#d8101c' },
  grape: { file: 'grape.png', name: 'グレープカンパニー', bg: '#ffffff', mark: [39, 6, 222, 222], markBelow: 72 },
  nhk: { file: 'nhk.png', name: 'NHK', bg: '#ffffff', tint: '#2a2d36' },
  nhk_old: { file: 'nhk_old.png', name: 'NHK（昔のロゴ）', bg: '#ffffff' },
  toei: { file: 'toei.png', name: '東映', bg: '#ffffff' },
  horipro: { file: 'horipro.png', name: 'ホリプロ', bg: '#ffffff' },
  toho: { file: 'toho.png', name: '東宝', bg: '#ffffff', mark: [13, 0, 243, 242] },
};

const images = {};
const fitted = new Map();

export function loadLogos(base = 'assets/logos/') {
  return Promise.all(
    Object.entries(LOGOS).map(([id, meta]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images[id] = img; resolve(); };
      img.onerror = () => { console.warn('logo failed to load', id); resolve(); };
      img.src = base + meta.file;
    })),
  );
}

// Smoothly downsample (halving steps) then hard-threshold alpha: crisp dot look.
function pixelate(img, w, h, crop = null, tint = null) {
  let src = img, sw = img.width, sh = img.height;
  if (crop) {
    const [cv, c] = makeCanvas(crop[2], crop[3]);
    c.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, crop[2], crop[3]);
    src = cv; sw = crop[2]; sh = crop[3];
  }
  while (sw / 2 > w * 1.5 && sh / 2 > h * 1.5) {
    const [cv, c] = makeCanvas(Math.round(sw / 2), Math.round(sh / 2));
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(src, 0, 0, sw, sh, 0, 0, cv.width, cv.height);
    src = cv; sw = cv.width; sh = cv.height;
  }
  const [out, o] = makeCanvas(w, h);
  o.imageSmoothingEnabled = true;
  o.imageSmoothingQuality = 'high';
  o.drawImage(src, 0, 0, sw, sh, 0, 0, w, h);
  const data = o.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  o.putImageData(data, 0, 0);
  if (tint) {
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = tint;
    o.fillRect(0, 0, w, h);
    o.globalCompositeOperation = 'source-over';
  }
  return out;
}

// Returns a canvas of the logo fitted (aspect kept) inside maxW x maxH pixels.
// res: pixels per logical unit (the small mark is used below markBelow units).
export function logoCanvas(id, maxW, maxH, res = 1) {
  const img = images[id];
  if (!img) return null;
  const meta = LOGOS[id] || {};
  let crop = null;
  if (meta.mark && img.height * Math.min(maxW / img.width, maxH / img.height) < (meta.markBelow || 56) * res) crop = meta.mark;
  const cw = crop ? crop[2] : img.width, ch = crop ? crop[3] : img.height;
  const s = Math.min(maxW / cw, maxH / ch);
  const w = Math.max(1, Math.round(cw * s));
  const h = Math.max(1, Math.round(ch * s));
  const key = id + (crop ? '|mark|' : '|') + w + 'x' + h;
  let cv = fitted.get(key);
  if (!cv) {
    cv = pixelate(img, w, h, crop, meta.tint);
    fitted.set(key, cv);
  }
  return cv;
}

// Draw a logo centered inside the box (x, y, w, h).
// opt.board: draw a signboard (frame + background) behind it.
// The logo is pixelated at the current drawing scale (one logo pixel per logical
// screen pixel, so a 2x world gets 2x logo detail); opt.res overrides it.
export function drawLogo(ctx, id, x, y, w, h, opt = {}) {
  x = Math.round(x); y = Math.round(y);
  const meta = LOGOS[id] || {};
  const pad = opt.board ? (opt.pad ?? 2) : 0;
  if (opt.board) {
    ctx.fillStyle = opt.frame || '#2a2d36';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = opt.bg || meta.bg || '#ffffff';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (opt.lights) {
      ctx.fillStyle = '#fff6a8';
      for (let i = 2; i < w - 2; i += 4) { ctx.fillRect(x + i, y, 1, 1); ctx.fillRect(x + i, y + h - 1, 1, 1); }
    }
  }
  const res = opt.res || Math.max(1, Math.round(ctx.getTransform().a / (display.S || 1) * 2) / 2);
  const cv = logoCanvas(id, (w - pad * 2) * res, (h - pad * 2) * res, res);
  if (!cv) {
    // image missing: fall back to the company name
    ctx.fillStyle = '#20232a';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.name || id, x + w / 2, y + h / 2);
    return;
  }
  const dw = cv.width / res, dh = cv.height / res;
  ctx.drawImage(cv, Math.round((x + (w - dw) / 2) * res) / res, Math.round((y + (h - dh) / 2) * res) / res, dw, dh);
}
