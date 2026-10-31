// スーパープロ野球ロード 3D — procedural textures drawn on canvases (no image files): the mowed grass, the infield dirt, the
// empty seats in the stands, the padded outfield wall, the sky, cap letters, uniform numbers, the scoreboard.
import * as THREE from '../vendor/three.module.min.js';

const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const tex = (c, rep = null) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
// a small seeded noise
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the grass in a checker of mowing (one tile = 2 x 2 stripes); repeat it over the field
export function grassTexture() {
  const [c, x] = cv(256, 256), r = rnd(7);
  const A = '#429f50', B = '#4baa59';
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? A : B; x.fillRect(i * 128, j * 128, 128, 128); }
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(20,60,25,0.10)' : 'rgba(160,230,150,0.08)'; x.fillRect(r() * 256, r() * 256, 1, 2); }
  return tex(c, [20, 20]);
}
export function dirtTexture() {
  const [c, x] = cv(256, 256), r = rnd(11);
  x.fillStyle = '#c4935c'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) { const v = r(); x.fillStyle = v < 0.33 ? 'rgba(120,80,40,0.18)' : v < 0.66 ? 'rgba(240,200,150,0.14)' : 'rgba(90,60,30,0.10)'; x.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
  return tex(c, [10, 10]);
}
// the stands: rows of empty seats (no crowd), a walkway every few rows
export function crowdTexture(c1 = '#1b3c8f', c2 = '#ffd23f', night = false) {
  const [c, x] = cv(1024, 256);
  x.fillStyle = night ? '#1c2030' : '#6a7080'; x.fillRect(0, 0, 1024, 256);
  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    if (row % 6 === 5) { x.fillStyle = night ? '#2a2e3c' : '#9298a4'; x.fillRect(0, y, 1024, 16); continue; } // a walkway
    x.fillStyle = night ? '#141824' : '#555b68'; x.fillRect(0, y + 12, 1024, 4); // the step
    for (let i = 0; i < 128; i++) {
      const px = i * 8 + 1;
      x.fillStyle = night ? '#24407a' : '#2f5aa8'; x.fillRect(px, y + 3, 6, 8); // the seat back
      x.fillStyle = night ? '#30528f' : '#4a74c0'; x.fillRect(px, y + 3, 6, 2);
    }
  }
  return tex(c, [3, 1]);
}
// the outfield wall: a plain padded fence (no ads)
export function adsTexture() {
  const [c, x] = cv(1024, 64);
  x.fillStyle = '#1f5a3c'; x.fillRect(0, 0, 1024, 64);
  for (let i = 0; i < 1024; i += 64) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(i, 0, 2, 64); x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(i + 2, 0, 2, 64); }
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, 0, 1024, 5);
  return tex(c, [4, 1]);
}
export function skyTexture(night = false) {
  const [c, x] = cv(16, 512);
  const g = x.createLinearGradient(0, 0, 0, 512);
  if (night) { g.addColorStop(0, '#02040e'); g.addColorStop(0.55, '#0c1638'); g.addColorStop(1, '#2a3a6a'); }
  else { g.addColorStop(0, '#2f7ad8'); g.addColorStop(0.55, '#7fbdf2'); g.addColorStop(1, '#d6ecfb'); }
  x.fillStyle = g; x.fillRect(0, 0, 16, 512);
  if (night) { const r = rnd(5); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * 16, r() * 220, 1, 1); } }
  return tex(c);
}
// the letters on a cap (team colours)
export function markTexture(mark, fg = '#ffffff', bg = null) {
  const [c, x] = cv(128, 128);
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, 128, 128); }
  x.fillStyle = fg; x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 3;
  x.font = `900 ${mark.length > 1 ? 62 : 92}px "Arial Black", "Helvetica", "Arial", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeText(mark, 64, 70); x.fillText(mark, 64, 70);
  return tex(c);
}
// the back of a jersey: the number in the club colour on white (or grey for the visitors)
export function jerseyTexture(num, c1, away = false, mark = '') {
  const [c, x] = cv(256, 256);
  x.fillStyle = away ? '#c9ced8' : '#f8f8fb'; x.fillRect(0, 0, 256, 256);
  // the front (left half of the texture): the mark; the back (right half): the number
  // the chest shows the mark and the back the number (the cylinder's seam is at the side)
  x.fillStyle = c1; x.font = `900 ${mark.length > 1 ? 40 : 54}px "Arial Black", "Helvetica", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(mark, 192, 104);
  x.font = '900 92px "Arial Black", "Helvetica", sans-serif'; x.lineWidth = 6; x.strokeStyle = '#ffffff';
  x.strokeText(String(num), 64, 128); x.fillText(String(num), 64, 128);
  return tex(c);
}
// the scoreboard: a canvas the game redraws (call .draw(fn) then .tex.needsUpdate = true)
export function scoreboardCanvas() {
  const [c, x] = cv(1024, 384);
  const t = tex(c);
  return { canvas: c, ctx: x, tex: t };
}
