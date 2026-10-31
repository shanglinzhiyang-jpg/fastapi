// スーパープロ野球ロード — the club marks. By default an original emblem drawn from the club colours and cap letters (a ring,
// the letters, a ball's stitches). A player can load their own image for a club (Settings → 球団マークの画像): it is resized
// and kept only in this browser (localStorage), never in the game file.
import { teamOf } from './data.js';
import { roundRect } from './core.js';

const KEY = (id) => `spr_logo_${id}`;
const imgs = {};
// the image a player chose for a club (an <img>, once loaded), or null
export function logoOf(id) {
  if (id in imgs) return imgs[id] && imgs[id].complete && imgs[id].naturalWidth ? imgs[id] : null;
  imgs[id] = null;
  try { const d = localStorage.getItem(KEY(id)); if (d) { const im = new Image(); im.src = d; imgs[id] = im; } } catch (e) { /* no storage */ }
  return null;
}
// the club marks built into this copy of the game (assets/logos/logos.js → window.SPR_LOGOS, embedded by build.py)
const built = {};
function builtLogo(id) {
  const L = typeof window !== 'undefined' && window.SPR_LOGOS;
  if (!L || !L[id]) return null;
  if (!built[id]) { built[id] = new Image(); built[id].src = L[id]; }
  return built[id].complete && built[id].naturalWidth ? built[id] : null;
}
export function clearLogo(id) { try { localStorage.removeItem(KEY(id)); } catch (e) { /* ignore */ } imgs[id] = null; }
// read a picked file, shrink it to 192 px (keeping its shape), keep it for the club
export function saveLogoFile(id, file, done) {
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 192 / Math.max(im.width, im.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      const url = cv.toDataURL('image/png');
      try { localStorage.setItem(KEY(id), url); } catch (e) { /* too big or no storage: this session only */ }
      const keep = new Image(); keep.src = url; imgs[id] = keep;
      if (done) done(true);
    };
    im.onerror = () => done && done(false);
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}
// opening the file picker needs a real key press / tap, so the scene "arms" it and main.js opens it from the event itself
export const filePick = { armed: null, onPicked: null };
export function openPicker() {
  const id = filePick.armed; if (!id) return;
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) saveLogoFile(id, f, (ok) => filePick.onPicked && filePick.onPicked(id, ok)); };
  inp.click();
}

// draw the club mark centred at (x, y), `s` px across
export function drawEmblem(c, x, y, s, id) {
  const im = logoOf(id) || builtLogo(id);
  if (im) { const k = s / Math.max(im.naturalWidth, im.naturalHeight); c.drawImage(im, x - (im.naturalWidth * k) / 2, y - (im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); return; }
  const t = teamOf(id), r = s / 2;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = s * 0.08; c.shadowOffsetY = s * 0.03;
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.restore();
  c.fillStyle = t.c2 === '#ffffff' ? '#e8ecf4' : t.c2; c.beginPath(); c.arc(x, y, r * 0.92, 0, 7); c.fill();
  c.fillStyle = t.c1; c.beginPath(); c.arc(x, y, r * 0.8, 0, 7); c.fill();
  // a ball's stitches across the badge
  c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = s * 0.03;
  c.beginPath(); c.arc(x - r * 1.05, y, r * 0.75, -0.75, 0.75); c.stroke();
  c.beginPath(); c.arc(x + r * 1.05, y, r * 0.75, Math.PI - 0.75, Math.PI + 0.75); c.stroke();
  // the letters
  const fg = t.c2 === t.c1 ? '#ffffff' : t.c2 === '#1a1a1a' ? '#ffffff' : t.c2;
  c.font = `900 ${t.mark.length > 1 ? s * 0.36 : s * 0.5}px "Arial Black", "Helvetica", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = s * 0.05; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.strokeText(t.mark, x, y + s * 0.02);
  c.fillStyle = fg; c.fillText(t.mark, x, y + s * 0.02);
}
