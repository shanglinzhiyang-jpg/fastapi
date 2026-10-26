// 歴史の列強 (設定): the switch (g.state.histPowers), the images (flags and leader portraits, used as they are) and the drawing helpers.
// The four countries themselves live in world_hist_data.js (spread into world.js COUNTRIES; exists() asks histOn). Old saves: no key = all off.
import { HIST, HIST_IDS } from './world_hist_data.js';

export { HIST, HIST_IDS };
export function histOn(g, id) {
  const p = g && g.state && g.state.histPowers;
  return !!(p && typeof p === 'object' && p[id]);
}
export const histList = (g) => HIST_IDS.map((id) => ({ ...HIST[id], on: histOn(g, id) }));
export const histAny = (g) => HIST_IDS.some((id) => histOn(g, id));
// the world cleanup is in world.js (setHistPower) because it needs W(g)
export function histSet(g, id, on) {
  if (!HIST[id] || !g || !g.state) return false;
  const p = (g.state.histPowers && typeof g.state.histPowers === 'object') ? g.state.histPowers : (g.state.histPowers = {});
  if (on) p[id] = 1; else delete p[id];
  return true;
}

// ---------------------------------------------------------------- images
const CACHE = {};
function srcOf(key) {
  const f = `${key}.jpg`;
  const A = typeof window !== 'undefined' && window.__DOT_ASSETS;
  return (A && A['hist_' + f]) || 'assets/hist/' + f;
}
// An HTMLImageElement once loaded (else null; the load starts now). Never throws.
export function histImg(key) {
  if (!key || typeof Image === 'undefined') return null;
  let e = CACHE[key];
  if (!e) {
    e = CACHE[key] = { img: new Image(), ok: false, fail: false };
    e.img.onload = () => { e.ok = true; };
    e.img.onerror = () => { e.fail = true; };
    try { e.img.src = srcOf(key); } catch (err) { e.fail = true; }
  }
  return e.ok ? e.img : null;
}
// Draw the image into a box. mode 'cover' crops (top-aligned, for portraits) / 'contain' keeps the whole flag. A thin frame.
export function drawHistImg(c, key, x, y, w, h, mode = 'contain', frame = '#0b1626') {
  const img = histImg(key);
  c.save();
  c.fillStyle = frame; c.fillRect(x - 1, y - 1, w + 2, h + 2);
  if (img && img.naturalWidth) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (mode === 'cover') {
      const s = Math.max(w / iw, h / ih);
      const sw = w / s, sh = h / s;
      c.drawImage(img, (iw - sw) / 2, 0, sw, sh, x, y, w, h);
    } else {
      const s = Math.min(w / iw, h / ih);
      const dw = iw * s, dh = ih * s;
      c.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
  } else { c.fillStyle = '#16263c'; c.fillRect(x, y, w, h); }
  c.restore();
}
