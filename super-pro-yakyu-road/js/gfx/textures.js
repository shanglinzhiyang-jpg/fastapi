// スーパープロ野球ロード 3D — procedural textures drawn on canvases (no image files): the mowed grass, the infield dirt, the
// crowd in the stands, the outfield ads (made-up sponsors), the sky, cap letters, uniform numbers, the scoreboard.
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
// the crowd: rows of little heads in many colours, with blocks of the clubs' colours
export function crowdTexture(c1 = '#1b3c8f', c2 = '#ffd23f', night = false) {
  const [c, x] = cv(1024, 256), r = rnd(23);
  x.fillStyle = night ? '#1a1e36' : '#5a6478'; x.fillRect(0, 0, 1024, 256);
  for (let row = 0; row < 16; row++) {
    x.fillStyle = night ? '#262a48' : '#6e7890'; x.fillRect(0, row * 16 + 12, 1024, 3);
    for (let i = 0; i < 128; i++) {
      const px = i * 8 + (row % 2) * 4, py = row * 16 + 3;
      const sec = Math.floor(i / 24) % 5;
      const col = sec === 1 ? c1 : sec === 3 ? c2 : ['#e85a5a', '#f4d03f', '#ffffff', '#5aa0ff', '#7ad07a', '#ff9ad0', '#2a2a36'][Math.floor(r() * 7)];
      if (r() < 0.08) continue;
      x.fillStyle = col; x.fillRect(px, py + 3, 6, 6);
      x.fillStyle = r() < 0.5 ? '#f2c8a0' : '#3a2a20'; x.fillRect(px + 1, py, 4, 4);
    }
  }
  return tex(c, [3, 1]);
}
const SPONSORS = [['ドットフーズ', '#e04a3a'], ['スター電機', '#2a6ad8'], ['ロード飲料', '#f0a020'], ['ドリーム保険', '#2aa86a'], ['ベース通信', '#8a4ad8'], ['ホームラン食堂', '#d83a8a'], ['青空銀行', '#1a8ac8'], ['フィールド建設', '#6a7a2a']];
export function adsTexture() {
  const [c, x] = cv(2048, 64);
  SPONSORS.forEach(([name, col], i) => {
    const w = 2048 / SPONSORS.length;
    x.fillStyle = col; x.fillRect(i * w, 0, w, 64);
    x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(i * w, 0, w, 6);
    x.fillStyle = '#ffffff'; x.font = 'bold 34px "Hiragino Sans", "Meiryo", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, i * w + w / 2, 34);
  });
  return tex(c, [2, 1]);
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
  x.fillStyle = fg; x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 8;
  x.font = `900 ${mark.length > 1 ? 66 : 92}px "Arial Black", "Hiragino Sans", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.strokeText(mark, 64, 70); x.fillText(mark, 64, 70);
  return tex(c);
}
// the back of a jersey: the number in the club colour on white (or grey for the visitors)
export function jerseyTexture(num, c1, away = false, mark = '') {
  const [c, x] = cv(256, 256);
  x.fillStyle = away ? '#c9ced8' : '#f8f8fb'; x.fillRect(0, 0, 256, 256);
  // pinstripes for a touch of detail
  x.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 256; i += 16) x.fillRect(i, 0, 2, 256);
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
