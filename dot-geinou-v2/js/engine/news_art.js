// ニュース (R9-D): the pixel-art "photos" of the news (and of 世論の声 cards). Every picture is drawn once at 80x50 on an
// offscreen canvas and scaled (nearest) to where it is shown; the 新聞 eras get a halftone (網点) black-and-white print.
// No person is ever drawn recognisably (crowds are tiny silhouettes); the 元号 board shows only the two characters.
//   drawNewsImage(c, kind, x, y, w, h, { mono, seed, gengo, night })      kinds: KINDS below (unknown → 'city')
import { makeCanvas } from './util.js';
import { text } from './draw.js';

const BW = 80, BH = 50;
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function disc(c, cx, cy, r, col) { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } }
function tri(c, x0, y0, x1, y1, x2, y2, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.closePath(); c.fill(); }
function line(c, x0, y0, x1, y1, col) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) R(c, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1, 1, col); }
const rnd = (seed, i) => { let h = (seed * 2654435761 + i * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// ---- backgrounds
function sky(c, top = '#7ec4f0', bot = '#cfeafc') { for (let y = 0; y < BH; y++) R(c, 0, y, BW, 1, y < 30 ? (y < 12 ? top : y < 22 ? mid(top, bot) : bot) : bot); }
function mid(a, b) { const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round((v + B[i]) / 2).toString(16).padStart(2, '0')).join(''); }
function nightSky(c) { sky(c, '#141c3c', '#2c3a64'); for (let i = 0; i < 14; i++) R(c, (i * 37) % BW, (i * 13) % 24, 1, 1, '#e8eefc'); }
function ground(c, y, col = '#6ab04a', col2 = '#4f9036') { R(c, 0, y, BW, BH - y, col); for (let x = 0; x < BW; x += 6) R(c, x, y, 3, 1, col2); }
function sea(c, y, col = '#2f7ac0') { R(c, 0, y, BW, BH - y, col); for (let i = 0; i < 10; i++) R(c, (i * 17) % 76, y + 3 + ((i * 7) % (BH - y - 3)), 4, 1, '#7ab8e8'); }
function cloud(c, x, y, s = 1) { disc(c, x, y, 3 * s, '#ffffff'); disc(c, x + 4 * s, y - 1, 4 * s, '#ffffff'); disc(c, x + 8 * s, y, 3 * s, '#ffffff'); }
function skyline(c, y, col = '#6a7a94', win = '#f0e48a', seed = 1) {
  let x = 0, i = 0;
  while (x < BW) { const w = 6 + Math.floor(rnd(seed, i) * 8), h = 8 + Math.floor(rnd(seed, i + 50) * 18); R(c, x, y - h, w - 1, h, col); for (let yy = y - h + 2; yy < y - 2; yy += 3) for (let xx = x + 1; xx < x + w - 2; xx += 2) if (rnd(seed, xx * 7 + yy) > 0.45) R(c, xx, yy, 1, 1, win); x += w; i++; }
}
function people(c, x, y, n, seed = 3, cols = ['#2a2a3a', '#5a3a2a', '#3a4a6a', '#6a2a3a']) {
  for (let i = 0; i < n; i++) { const px = x + i * 4 + Math.floor(rnd(seed, i) * 2), col = cols[i % cols.length]; R(c, px, y - 5, 3, 5, col); R(c, px + 1, y - 7, 1, 2, '#e8c8a8'); R(c, px, y - 8, 3, 1, '#2a1a10'); }
}

// ---- objects
const KINDS = {
  train(c) { sky(c); cloud(c, 10, 9); ground(c, 38); R(c, 0, 35, BW, 2, '#8a7a6a'); for (let x = 0; x < BW; x += 5) R(c, x, 37, 2, 1, '#5a4a3a'); for (const x0 of [4, 28, 52]) { R(c, x0, 24, 23, 11, '#e0e4ea'); R(c, x0, 30, 23, 2, '#2f8a3a'); for (let k = 0; k < 4; k++) R(c, x0 + 2 + k * 5, 26, 3, 3, '#3a5a7a'); R(c, x0 + 3, 35, 3, 2, '#2a2a2a'); R(c, x0 + 17, 35, 3, 2, '#2a2a2a'); } },
  shinkansen(c) { sky(c, '#8ac8f0', '#e0f2fc'); cloud(c, 54, 8); R(c, 0, 34, BW, 4, '#b8b8c0'); for (let x = 2; x < BW; x += 14) R(c, x, 38, 3, 12, '#9a9aa4'); ground(c, 46); R(c, 8, 24, 66, 10, '#f4f6f8'); tri(c, 74, 24, 74, 34, 79, 34, '#f4f6f8'); R(c, 8, 30, 70, 2, '#2a5ac0'); for (let k = 0; k < 9; k++) R(c, 12 + k * 7, 26, 4, 2, '#2a3a5a'); R(c, 8, 33, 70, 1, '#9aa4b0'); },
  tunnel(c) { sky(c); tri(c, 10, 40, 40, 8, 74, 40, '#4f8a4a'); tri(c, 30, 40, 40, 14, 50, 40, '#5f9a5a'); ground(c, 40, '#7aa860', '#5a8a4a'); R(c, 32, 30, 16, 10, '#2a2a30'); disc(c, 40, 30, 8, '#2a2a30'); R(c, 31, 22, 18, 2, '#9a9a9a'); R(c, 0, 40, BW, 2, '#8a7a6a'); R(c, 4, 33, 24, 7, '#e0e4ea'); R(c, 4, 37, 24, 1, '#c03a3a'); },
  bridge(c) { sky(c, '#88c8f4', '#d8f0fc'); sea(c, 34); R(c, 0, 30, BW, 2, '#d8d8e0'); for (const tx of [18, 60]) { R(c, tx, 8, 3, 26, '#d84a3a'); R(c, tx - 1, 8, 5, 1, '#a83a2a'); } for (let x = 0; x <= 80; x++) { const y = x < 19 ? 9 + (19 - x) * 1.1 : x < 61 ? 9 + (1 - Math.pow((x - 40) / 21, 2)) * 18 : 9 + (x - 61) * 1.1; R(c, x, Math.min(29, y), 1, 1, '#5a5a6a'); if (x % 4 === 0) R(c, x, Math.min(29, y), 1, 30 - Math.min(29, y), '#9a9aa8'); } },
  tower(c) { sky(c, '#6ab4ec', '#d0ecfc'); skyline(c, 50, '#7a8aa4', '#e8e0a0', 5); for (let y = 4; y < 46; y++) { const w = 2 + Math.floor((y - 4) / 8); R(c, 40 - w / 2, y, w, 1, '#e8eef4'); } R(c, 36, 18, 8, 2, '#b8c4d0'); R(c, 37, 26, 6, 2, '#b8c4d0'); R(c, 39, 1, 2, 4, '#c8d0d8'); },
  fuji(c) { sky(c, '#5aa8e8', '#cfe8f8'); cloud(c, 8, 10); tri(c, 6, 46, 40, 10, 74, 46, '#4a5a8a'); tri(c, 30, 21, 40, 10, 50, 21, '#f8f8fc'); R(c, 34, 21, 12, 1, '#f8f8fc'); ground(c, 44, '#5a9a4a', '#4a8a3a'); },
  castle(c) { sky(c, '#7ac0f0', '#e0f0fc'); ground(c, 42); R(c, 18, 34, 44, 8, '#9a9488'); R(c, 24, 26, 32, 8, '#f4f2ea'); tri(c, 20, 27, 40, 19, 60, 27, '#4a4e5a'); R(c, 29, 16, 22, 4, '#f4f2ea'); tri(c, 26, 17, 40, 10, 54, 17, '#4a4e5a'); R(c, 34, 8, 12, 3, '#f4f2ea'); tri(c, 32, 9, 40, 4, 48, 9, '#4a4e5a'); for (let k = 0; k < 5; k++) R(c, 27 + k * 6, 29, 2, 2, '#3a3a4a'); },
  dome(c) { sky(c); ground(c, 40, '#8a8a90', '#7a7a80'); disc(c, 40, 40, 26, '#f0f2f4'); R(c, 10, 40, 60, 10, '#8a8a90'); for (let x = 16; x < 66; x += 6) line(c, x, 40, 40, 15, '#c8ccd4'); R(c, 14, 36, 52, 4, '#d0d4dc'); },
  plane(c) { sky(c, '#6ab0ec', '#d8f0fc'); sea(c, 36); R(c, 26, 38, 30, 4, '#c8c0a8'); R(c, 30, 36, 22, 2, '#e8e0c8'); R(c, 20, 14, 36, 5, '#f4f6f8'); tri(c, 56, 14, 56, 19, 62, 16, '#f4f6f8'); tri(c, 34, 16, 28, 26, 40, 16, '#d0d8e0'); tri(c, 22, 14, 18, 8, 26, 14, '#2a5ac0'); for (let k = 0; k < 6; k++) R(c, 30 + k * 4, 15, 2, 1, '#3a4a6a'); },
  quake(c, o) { sky(c, '#a8b0bc', '#d8dce0'); skyline(c, 40, '#8a8a94', '#c8c4b0', o.seed); ground(c, 40, '#8a7a6a', '#6a5a4a'); line(c, 6, 46, 20, 41, '#2a2016'); line(c, 20, 41, 34, 47, '#2a2016'); line(c, 34, 47, 52, 42, '#2a2016'); line(c, 52, 42, 74, 48, '#2a2016'); for (let i = 0; i < 8; i++) R(c, 6 + i * 9, 24 + (i % 3) * 3, 2, 1, '#5a5a5a'); R(c, 0, 0, BW, 2, '#c03a3a'); },
  tsunami(c) { sky(c, '#7a8a9a', '#b8c4cc'); sea(c, 30, '#2a5a8a'); for (let x = 0; x < BW; x++) { const h = 8 + Math.sin(x / 6) * 3; R(c, x, 30 - h, 1, h, '#3a6a9a'); R(c, x, 30 - h, 1, 2, '#e8f0f8'); } R(c, 0, 44, BW, 6, '#6a5a4a'); },
  typhoon(c) { R(c, 0, 0, BW, BH, '#0e2a4a'); for (let i = 0; i < 140; i++) { const a = i * 0.25, r = i * 0.17; R(c, 44 + Math.cos(a) * r * 1.3, 24 + Math.sin(a) * r * 0.8, 2, 2, i % 3 ? '#f0f4f8' : '#b8c8d8'); } disc(c, 44, 24, 2, '#0e2a4a'); R(c, 4, 34, 18, 12, '#3a7a3a'); R(c, 8, 30, 10, 6, '#3a7a3a'); },
  rain(c) { sky(c, '#6a7484', '#9aa4b0'); skyline(c, 44, '#5a6474', '#a8a080', 7); R(c, 0, 44, BW, 6, '#4a5260'); for (let i = 0; i < 40; i++) R(c, (i * 23) % BW, (i * 11) % 44, 1, 3, '#c8d4e4'); for (const [x, col] of [[18, '#d84a5a'], [40, '#3a8ad0'], [60, '#f0c040']]) { disc(c, x, 36, 6, col); R(c, x - 6, 36, 13, 6, '#4a5260'); R(c, x, 36, 1, 8, '#2a2a2a'); } },
  snow(c) { sky(c, '#9aa8bc', '#d8e0ec'); skyline(c, 40, '#8a94a8', '#f0e8b0', 9); R(c, 0, 40, BW, 10, '#f4f6fa'); for (let i = 0; i < 40; i++) R(c, (i * 29) % BW, (i * 13) % 40, 1, 1, '#ffffff'); },
  sun(c) { sky(c, '#48a0f0', '#c8e8fc'); disc(c, 60, 13, 7, '#ffd23a'); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; R(c, 60 + Math.cos(a) * 11, 13 + Math.sin(a) * 11, 2, 2, '#ffb02a'); } skyline(c, 44, '#8a9ab4', '#f8f0b0', 11); R(c, 0, 44, BW, 6, '#c8b088'); for (let x = 0; x < BW; x += 3) R(c, x, 41 + (x % 2), 1, 1, '#f8d8a8'); },
  sakura(c) { sky(c, '#88c4f0', '#e4f2fc'); ground(c, 40, '#8ac05a', '#6aa04a'); for (const x of [14, 40, 66]) { R(c, x - 1, 28, 3, 12, '#6a4a3a'); disc(c, x, 22, 10, '#f8c8d8'); disc(c, x - 4, 25, 6, '#f4b0c8'); disc(c, x + 5, 19, 5, '#fcdce8'); } people(c, 24, 46, 6, 4); },
  leaf(c) { sky(c, '#7ab8e8', '#e0eef8'); tri(c, 0, 42, 24, 14, 50, 42, '#7a8a6a'); for (const [x, col] of [[12, '#e0402a'], [30, '#f0a020'], [50, '#d83a2a'], [68, '#f0c040']]) { R(c, x - 1, 30, 3, 12, '#5a3a2a'); disc(c, x, 25, 8, col); } ground(c, 42, '#a08050', '#806040'); },
  shrine(c) { sky(c, '#7ac0ec', '#e0f0fc'); ground(c, 40, '#c8b890', '#b0a078'); R(c, 18, 12, 44, 3, '#d8402a'); R(c, 16, 10, 48, 2, '#2a2020'); R(c, 22, 18, 36, 2, '#d8402a'); R(c, 24, 12, 3, 28, '#d8402a'); R(c, 53, 12, 3, 28, '#d8402a'); R(c, 38, 15, 4, 3, '#2a2020'); people(c, 30, 46, 5, 6); },
  ceremony(c) { R(c, 0, 0, BW, BH, '#e8dcc0'); R(c, 0, 0, BW, 16, '#c8a878'); R(c, 20, 4, 40, 8, '#ffffff'); R(c, 22, 6, 36, 1, '#c03a3a'); R(c, 22, 9, 26, 1, '#5a5a5a'); R(c, 0, 16, BW, 2, '#8a6a4a'); for (let row = 0; row < 3; row++) people(c, 6 + row * 2, 32 + row * 8, 17, 20 + row, ['#2a2a3a', '#1a2a4a', '#3a2a2a', '#c04a6a']); },
  run(c) { sky(c, '#8ac8f4', '#e4f4fc'); R(c, 0, 34, BW, 16, '#5a5a62'); for (let x = 0; x < BW; x += 10) R(c, x, 41, 5, 1, '#f4f4f4'); people(c, 10, 40, 3, 7, ['#d83a3a', '#3a6ad8', '#2a9a5a']); people(c, 40, 42, 2, 8, ['#f0b020', '#7a3ab0']); R(c, 0, 30, BW, 4, '#8ab060'); people(c, 2, 34, 18, 9); },
  sumo(c) { R(c, 0, 0, BW, BH, '#3a2a20'); R(c, 16, 4, 48, 4, '#2a4a7a'); tri(c, 14, 6, 40, -2, 66, 6, '#5a3a20'); R(c, 18, 8, 2, 4, '#e8c060'); R(c, 60, 8, 2, 4, '#e8c060'); R(c, 8, 30, 64, 14, '#c8a870'); R(c, 16, 28, 48, 4, '#d8b880'); disc(c, 40, 30, 14, '#d8b880'); R(c, 20, 30, 40, 1, '#f4f0e0'); people(c, 4, 50, 18, 12, ['#5a4a3a', '#6a5a4a']); },
  shop(c) { sky(c); R(c, 0, 14, BW, 30, '#e8e0cc'); for (const [x, col] of [[2, '#d84a3a'], [28, '#3a8ad0'], [54, '#2a9a5a']]) { R(c, x, 14, 24, 6, col); for (let k = 0; k < 24; k += 4) R(c, x + k, 20, 2, 2, col); R(c, x + 3, 24, 18, 14, '#a8d8f0'); R(c, x + 3, 30, 18, 1, '#ffffff'); } R(c, 0, 44, BW, 6, '#b8b0a0'); people(c, 8, 48, 14, 13); },
  car(c) { sky(c); R(c, 0, 28, BW, 22, '#5a5a62'); R(c, 0, 38, BW, 1, '#f4f4f4'); for (let i = 0; i < 9; i++) { const x = i * 9 + (i % 2) * 2, y = i % 2 ? 40 : 30, col = ['#d84a3a', '#f4f4f4', '#3a6ad8', '#f0c040', '#2a2a2a'][i % 5]; R(c, x, y, 8, 5, col); R(c, x + 1, y - 2, 5, 2, '#a8d0e8'); R(c, x + 1, y + 5, 2, 1, '#1a1a1a'); R(c, x + 5, y + 5, 2, 1, '#1a1a1a'); } ground(c, 22, '#8ab060', '#6a9a4a'); R(c, 0, 26, BW, 2, '#9a9aa0'); },
  beach(c) { sky(c, '#3aa0f0', '#bce4fc'); disc(c, 66, 9, 5, '#ffe060'); sea(c, 24, '#2a8ad8'); R(c, 0, 36, BW, 14, '#f0dca0'); for (const [x, col] of [[16, '#f04a6a'], [50, '#3ab0f0']]) { tri(c, x - 8, 30, x, 24, x + 8, 30, col); R(c, x, 24, 1, 14, '#5a4a3a'); } people(c, 26, 46, 4, 14); },
  police(c, o) { (o.night ? nightSky : sky)(c); skyline(c, 36, o.night ? '#2a3450' : '#8a94a8', o.night ? '#e8d870' : '#e8e0b0', 15); R(c, 0, 36, BW, 14, '#5a5a62'); R(c, 14, 30, 40, 9, '#f4f4f4'); R(c, 14, 36, 40, 3, '#1a1a2a'); R(c, 20, 26, 26, 5, '#f4f4f4'); R(c, 22, 27, 9, 3, '#7aa8d0'); R(c, 34, 27, 9, 3, '#7aa8d0'); R(c, 30, 23, 6, 3, '#e83a3a'); R(c, 16, 39, 6, 3, '#1a1a1a'); R(c, 44, 39, 6, 3, '#1a1a1a'); disc(c, 33, 21, 4, 'rgba(255,80,80,0.5)'); R(c, 60, 24, 14, 12, '#f0f0f0'); R(c, 62, 26, 10, 1, '#c03a3a'); },
  court(c) { sky(c, '#9ab4cc', '#dce8f0'); R(c, 8, 16, 64, 30, '#d8d4c8'); tri(c, 6, 17, 40, 4, 74, 17, '#b8b4a8'); for (let x = 12; x < 70; x += 8) R(c, x, 19, 4, 25, '#f0ece0'); R(c, 0, 46, BW, 4, '#a8a498'); R(c, 39, 8, 2, 7, '#5a4a2a'); R(c, 33, 9, 14, 1, '#5a4a2a'); R(c, 32, 11, 4, 1, '#c8a040'); R(c, 44, 11, 4, 1, '#c8a040'); },
  ballot(c) { R(c, 0, 0, BW, BH, '#dfe6ee'); R(c, 0, 36, BW, 14, '#b8a888'); R(c, 24, 18, 32, 22, '#e8eef4'); R(c, 24, 18, 32, 2, '#9aa4b0'); R(c, 34, 16, 12, 2, '#2a2a3a'); R(c, 36, 8, 8, 10, '#ffffff'); R(c, 38, 10, 4, 1, '#c03a3a'); R(c, 38, 12, 4, 1, '#5a5a5a'); R(c, 30, 26, 20, 6, '#f4f6fa'); R(c, 32, 28, 16, 1, '#3a5aa0'); },
  crowd(c, o) { sky(c, '#88b4dc', '#d8e8f4'); skyline(c, 30, '#9aa4b8', '#e8e4c0', o.seed); R(c, 0, 30, BW, 20, '#8a8a90'); for (let row = 0; row < 3; row++) people(c, -2 + row * 2, 38 + row * 6, 21, 30 + row); for (const x of [8, 30, 54]) { R(c, x, 20, 14, 8, '#fff8e0'); R(c, x + 2, 22, 10, 1, '#c03a3a'); R(c, x + 2, 25, 8, 1, '#3a3a3a'); R(c, x + 6, 28, 1, 6, '#6a4a2a'); } },
  diet(c) { sky(c, '#7ab8ec', '#dcecf8'); ground(c, 42, '#7aa860', '#6a9850'); R(c, 6, 26, 68, 16, '#e8e2d2'); R(c, 30, 14, 20, 12, '#e8e2d2'); tri(c, 32, 14, 40, 4, 48, 14, '#d8d2c2'); R(c, 39, 2, 2, 3, '#b8b2a2'); for (let x = 9; x < 72; x += 4) R(c, x, 30, 2, 10, '#c8c2b2'); R(c, 6, 25, 68, 1, '#b8b2a2'); for (let x = 33; x < 48; x += 4) R(c, x, 17, 2, 7, '#c8c2b2'); },
  globe(c) { R(c, 0, 0, BW, BH, '#0e1830'); for (let i = 0; i < 20; i++) R(c, (i * 31) % BW, (i * 17) % BH, 1, 1, '#c8d0e8'); disc(c, 40, 25, 20, '#2a6ac8'); for (const [x, y, w, h] of [[26, 14, 10, 7], [44, 12, 12, 9], [30, 26, 8, 12], [50, 28, 7, 6], [38, 20, 5, 4]]) R(c, x, y, w, h, '#4aa05a'); R(c, 34, 6, 12, 2, '#f0f4f8'); },
  globeWar(c) { KINDS.globe(c); disc(c, 52, 24, 5, '#e8402a'); disc(c, 52, 24, 3, '#ffd040'); R(c, 0, 0, BW, 2, '#c03a3a'); R(c, 0, 48, BW, 2, '#c03a3a'); },
  city(c, o) { sky(c, '#7ab8ec', '#dcecf8'); cloud(c, 50, 8); skyline(c, 44, '#7a8aa4', '#f0e8a0', o.seed); R(c, 0, 44, BW, 6, '#8a8a90'); people(c, 4, 49, 18, o.seed + 1); },
  stadium(c) { sky(c, '#4a9ae8', '#c8e4fc'); R(c, 0, 14, BW, 14, '#9aa0aa'); for (let y = 15; y < 28; y += 2) for (let x = (y % 4); x < BW; x += 3) R(c, x, y, 1, 1, ['#d84a3a', '#f4f4f4', '#3a6ad8', '#f0c040'][(x + y) % 4]); R(c, 0, 28, BW, 22, '#3a9a4a'); for (let x = 0; x < BW; x += 8) R(c, x, 28, 4, 22, '#46a858'); R(c, 0, 38, BW, 1, '#f4f4f4'); for (const x of [10, 70]) { R(c, x, 2, 1, 12, '#b0b0b8'); R(c, x - 3, 1, 7, 3, '#f8f8e0'); } },
  baseball(c) { KINDS.stadium(c); tri(c, 40, 30, 60, 42, 20, 42, '#c89a68'); R(c, 39, 41, 3, 2, '#f4f4f4'); disc(c, 52, 22, 3, '#f8f8f8'); R(c, 51, 21, 1, 3, '#d83a3a'); },
  soccer(c) { KINDS.stadium(c); R(c, 30, 30, 20, 1, '#f4f4f4'); R(c, 30, 30, 1, 8, '#f4f4f4'); R(c, 49, 30, 1, 8, '#f4f4f4'); for (let y = 31; y < 38; y += 2) R(c, 31, y, 18, 1, '#d8dce0'); disc(c, 40, 44, 3, '#f8f8f8'); R(c, 39, 43, 2, 2, '#2a2a2a'); },
  rugby(c) { KINDS.stadium(c); R(c, 32, 22, 1, 20, '#f4f4f4'); R(c, 46, 22, 1, 20, '#f4f4f4'); R(c, 32, 34, 15, 1, '#f4f4f4'); R(c, 36, 42, 7, 4, '#8a4a2a'); R(c, 37, 41, 5, 1, '#8a4a2a'); R(c, 37, 46, 5, 1, '#8a4a2a'); },
  torch(c) { sky(c, '#1a2a5a', '#3a5a9a'); for (let i = 0; i < 12; i++) R(c, (i * 23) % BW, (i * 7) % 20, 1, 1, '#f0f0ff'); tri(c, 34, 30, 46, 30, 40, 48, '#c8c8d0'); R(c, 33, 28, 14, 3, '#e8c040'); disc(c, 40, 20, 7, '#f06a1a'); disc(c, 40, 22, 5, '#ffb02a'); tri(c, 34, 20, 40, 4, 46, 20, '#f06a1a'); disc(c, 40, 24, 3, '#fff0a0'); },
  trophy(c) { R(c, 0, 0, BW, BH, '#2a1a4a'); for (let i = 0; i < 30; i++) R(c, (i * 29) % BW, (i * 13) % BH, 2, 1, ['#ff5a7a', '#ffd23a', '#5ad0ff', '#7aff8a'][i % 4]); R(c, 28, 8, 24, 16, '#ffd23a'); disc(c, 40, 22, 12, '#ffd23a'); R(c, 24, 10, 4, 8, '#ffd23a'); R(c, 52, 10, 4, 8, '#ffd23a'); R(c, 37, 32, 6, 6, '#e8b020'); R(c, 32, 38, 16, 4, '#c89018'); R(c, 32, 10, 3, 10, '#fff4b0'); },
  mic(c) { R(c, 0, 0, BW, BH, '#5a1018'); for (let x = 0; x < BW; x += 6) R(c, x, 0, 3, 40, '#7a1a24'); tri(c, 30, 0, 50, 0, 64, 42, 'rgba(255,240,180,0.22)'); R(c, 0, 40, BW, 10, '#8a5a2a'); for (let x = 0; x < BW; x += 8) R(c, x, 40, 1, 10, '#6a4420'); R(c, 39, 22, 2, 18, '#c8c8d0'); R(c, 35, 39, 10, 2, '#9a9aa4'); R(c, 37, 14, 6, 9, '#3a3a44'); for (let y = 15; y < 22; y += 2) R(c, 38, y, 4, 1, '#8a8a94'); R(c, 36, 23, 8, 2, '#b8b8c4'); },
  trophyMic(c) { KINDS.mic(c); for (let i = 0; i < 26; i++) R(c, (i * 31) % BW, (i * 11) % 38, 2, 1, ['#ffd23a', '#ff7aa8', '#7ae0ff'][i % 3]); R(c, 54, 26, 12, 8, '#ffd23a'); disc(c, 60, 32, 6, '#ffd23a'); R(c, 58, 38, 4, 3, '#c89018'); },
  spotlight(c) { R(c, 0, 0, BW, BH, '#14102a'); tri(c, 16, 0, 2, 44, 34, 44, 'rgba(255,240,170,0.25)'); tri(c, 64, 0, 46, 44, 78, 44, 'rgba(170,220,255,0.25)'); R(c, 0, 40, BW, 10, '#3a2a5a'); for (let x = 2; x < BW; x += 7) R(c, x, 40, 3, 1, '#ffd23a'); disc(c, 40, 30, 8, 'rgba(255,255,255,0.18)'); for (let i = 0; i < 16; i++) R(c, (i * 37) % BW, (i * 7) % 30, 1, 1, '#ffffff'); R(c, 39, 26, 2, 14, '#c8c8d0'); R(c, 37, 22, 6, 5, '#3a3a44'); },
  tv(c) { R(c, 0, 0, BW, BH, '#d8c8a8'); R(c, 0, 38, BW, 12, '#8a6a4a'); R(c, 18, 6, 44, 32, '#3a3a3a'); R(c, 21, 9, 30, 24, '#5ab0e8'); R(c, 21, 25, 30, 8, '#5aa04a'); disc(c, 28, 15, 3, '#ffe060'); R(c, 54, 12, 5, 3, '#9a9a9a'); R(c, 54, 18, 5, 3, '#9a9a9a'); R(c, 24, 38, 4, 3, '#2a2a2a'); R(c, 52, 38, 4, 3, '#2a2a2a'); line(c, 34, 6, 28, 0, '#5a5a5a'); line(c, 46, 6, 52, 0, '#5a5a5a'); },
  pc(c) { R(c, 0, 0, BW, BH, '#2a2a3a'); for (let x = 0; x < BW; x += 10) R(c, x, 0, 6, 50, '#30304a'); R(c, 20, 6, 40, 28, '#d8d4c8'); R(c, 23, 9, 34, 20, '#2a6aa8'); R(c, 25, 11, 12, 8, '#e8e8e8'); R(c, 39, 21, 16, 6, '#f0d040'); R(c, 23, 27, 34, 2, '#c8c8c8'); R(c, 34, 34, 12, 3, '#b8b4a8'); R(c, 16, 38, 48, 8, '#d8d4c8'); for (let x = 18; x < 62; x += 3) R(c, x, 40, 2, 1, '#8a8a8a'); },
  keitai(c) { R(c, 0, 0, BW, BH, '#e8eef4'); R(c, 30, 2, 20, 46, '#5a6a8a'); R(c, 32, 4, 16, 18, '#a8d8f0'); R(c, 34, 6, 12, 2, '#3a6aa8'); R(c, 34, 10, 10, 1, '#5a5a5a'); R(c, 34, 13, 8, 1, '#5a5a5a'); R(c, 34, 16, 11, 1, '#5a5a5a'); for (let y = 26; y < 44; y += 4) for (let x = 33; x < 47; x += 5) R(c, x, y, 3, 2, '#d8dce8'); R(c, 47, 0, 2, 4, '#3a3a4a'); },
  yen(c) { R(c, 0, 0, BW, BH, '#e8e4d8'); for (const [x, y, col] of [[8, 8, '#c8b89a'], [14, 14, '#a8b8a0'], [20, 20, '#b8a8c0']]) { R(c, x, y, 50, 24, col); R(c, x + 2, y + 2, 46, 20, '#f4f0e4'); disc(c, x + 36, y + 12, 7, col); R(c, x + 5, y + 5, 14, 2, col); R(c, x + 5, y + 16, 10, 2, col); } },
  park(c) { sky(c, '#5aa8f0', '#d0ecfc'); ground(c, 40, '#8ac05a', '#6aa04a'); disc(c, 40, 24, 12, '#3a7ad8'); R(c, 30, 20, 8, 5, '#5ab05a'); R(c, 42, 26, 6, 4, '#5ab05a'); R(c, 26, 36, 28, 4, '#c8c8d0'); R(c, 6, 16, 10, 24, '#e8d8b0'); R(c, 64, 12, 10, 28, '#f0c8a0'); people(c, 10, 48, 15, 17); },
  expo(c) { sky(c, '#6ab4f0', '#d8eefc'); R(c, 0, 34, BW, 16, '#c8c0b0'); for (let x = 2; x < BW; x += 4) R(c, x, 30, 3, 4, '#c8a070'); R(c, 0, 29, BW, 2, '#a88050'); for (const [x, w, h, col] of [[6, 14, 12, '#e86a4a'], [24, 12, 18, '#4a9ad8'], [42, 16, 10, '#f0c040'], [62, 12, 14, '#6ac06a']]) { R(c, x, 34 - h + 10, w, h - 6, col); disc(c, x + w / 2, 34 - h + 10, w / 2 - 1, col); } people(c, 4, 48, 18, 18); },
  gengo(c, o) {
    R(c, 0, 0, BW, BH, '#5a6a88'); for (let x = 0; x < BW; x += 8) R(c, x, 0, 4, BH, '#62729a');
    R(c, 22, 2, 36, 46, '#c8b48a'); R(c, 24, 4, 32, 42, '#fbf8ee');
    // the two characters are written over the scaled picture by drawNewsImage (crisp at any size)
  },
  chartUp(c) { chart(c, true); },
  chartDown(c) { chart(c, false); },
};
function chart(c, up) {
  R(c, 0, 0, BW, BH, '#0e1a12'); for (let y = 6; y < BH; y += 8) R(c, 0, y, BW, 1, '#1e3a24'); for (let x = 6; x < BW; x += 10) R(c, x, 0, 1, BH, '#1e3a24');
  let y = up ? 40 : 10; const col = up ? '#ff5a5a' : '#5aa0ff';
  for (let x = 2; x < BW - 2; x += 3) { const ny = Math.max(4, Math.min(46, y + (up ? -1.1 : 1.1) + (Math.sin(x * 1.7) * 3))); line(c, x, y, x + 3, ny, col); R(c, x, Math.min(y, ny), 1, Math.abs(ny - y) + 1, col); y = ny; }
  tri(c, up ? 70 : 70, up ? 4 : 46, up ? 78 : 78, up ? 10 : 40, up ? 66 : 66, up ? 12 : 38, col);
}
export const IMAGE_KINDS = Object.keys(KINDS);

const CACHE = new Map();
function base(kind, o) {
  const k = `${kind}|${o.mono ? 1 : 0}|${o.seed | 0}|${o.gengo || ''}|${o.night ? 1 : 0}`;
  let cv = CACHE.get(k);
  if (cv) return cv;
  const [cnv, c] = makeCanvas(BW, BH);
  try { (KINDS[kind] || KINDS.city)(c, { seed: o.seed | 0, gengo: o.gengo, night: !!o.night }); } catch (e) { console.error(e); KINDS.city(c, { seed: 1 }); }
  if (o.mono) halftone(c);
  if (CACHE.size > 160) CACHE.clear();
  CACHE.set(k, cnv);
  return cnv;
}
// newspaper print: the luminance, stretched per picture, in five tones of ink on paper (the lightest mid tone as
// sparse 網点 dots), so a picture stays readable small
function halftone(c) {
  const im = c.getImageData(0, 0, BW, BH), d = im.data;
  const L = new Float32Array(BW * BH);
  let mn = 1, mx = 0;
  for (let i = 0; i < BW * BH; i++) { const l = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; L[i] = l; if (l < mn) mn = l; if (l > mx) mx = l; }
  const rg = Math.max(0.2, mx - mn);
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const i = y * BW + x, l = (L[i] - mn) / rg;
    let v;
    if (l >= 0.8) v = [238, 232, 216];
    else if (l >= 0.6) v = (x % 3 === 0 && y % 3 === 0) ? [120, 114, 104] : [238, 232, 216];
    else if (l >= 0.42) v = [190, 182, 164];
    else if (l >= 0.24) v = [118, 112, 102];
    else v = [34, 32, 32];
    d[i * 4] = v[0]; d[i * 4 + 1] = v[1]; d[i * 4 + 2] = v[2]; d[i * 4 + 3] = 255;
  }
  c.putImageData(im, 0, 0);
}
export function drawNewsImage(c, kind, x, y, w, h, o = {}) {
  const cv = base(kind, o);
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = w < BW * 0.9;
  // cover: keep the 8:5 ratio, crop the overflow
  const s = Math.max(w / BW, h / BH);
  const sw = w / s, sh = h / s;
  const ox = (BW - sw) / 2, oy = (BH - sh) / 2;
  c.drawImage(cv, ox, oy, sw, sh, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  c.imageSmoothingEnabled = sm;
  if (kind === 'gengo') {
    // the 元号 on the board, in the game's font at the shown size
    const g2 = Array.from(String(o.gengo || '平成'));
    const size = Math.max(10, Math.floor(17 * s / 2) * 2);
    const bx = x + (40 - ox) * s;
    g2.slice(0, 2).forEach((ch, i) => text(c, ch, Math.round(bx), Math.round(y + (6 + i * 19 - oy) * s), { size, color: '#141414', align: 'center', shadow: null }));
  }
}
