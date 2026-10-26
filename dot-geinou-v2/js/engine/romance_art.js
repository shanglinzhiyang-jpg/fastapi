// 恋愛・結婚・家庭 (R12-L1) — pixel art for the HD date / ceremony scenes (romance_scene.js).
// Every painter draws a 320x112 illustration (shown at 2x) with (c, t, X): c = 2D context, t = frame count, X = {
//   me, you (looks), kids: [{ look, k (scale), baby }], phase: 'day'|'dusk'|'night', wx: 'sunny'|'rain'|'snow'|…, extra }.
// This file: the shared helpers and the date spots. romance_art2.js: ceremonies and family scenes.

import { charSheetHD } from './sprites.js';
import { text } from './draw.js';
import { shade, hash2 } from './util.js';

export const AW = 320, AH = 112;
export const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r + r * 0.6 - dy * dy)));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}
export function oval(c, cx, cy, rx, ry, col) {
  c.fillStyle = col;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)));
    if (w > 0) c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2, 1);
  }
}
export function bands(c, x, y, w, h, cols) {
  const bh = h / cols.length;
  cols.forEach((col, i) => R(c, x, y + i * bh, w, Math.ceil(bh) + 1, col));
}
export function dither(c, x, y, w, h, col, odd = 0) {
  c.fillStyle = col;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + odd) % 2; xx < w; xx += 2) c.fillRect(x + xx, y + yy, 1, 1);
}
export function stars(c, t, n = 40, h = 70) {
  for (let i = 0; i < n; i++) {
    if ((i * 7 + Math.floor(t / 14)) % 11 === 0) continue;
    R(c, Math.floor(hash2(i, 1, 21) * AW), Math.floor(hash2(i, 2, 21) * h), 1, 1, i % 4 ? '#c8ccff' : '#fff6a8');
  }
}
export function skyOf(c, phase, h = 72) {
  const S = {
    day: ['#7cc4f0', '#8fd0f6', '#a4dcfa', '#bfe8fb', '#d8f2fc'],
    dusk: ['#3a3a8a', '#6a4aa0', '#c8607a', '#ff8a5a', '#ffc070'],
    night: ['#0a0e2a', '#10163a', '#1a2150', '#262c64', '#343a78'],
  }[phase] || ['#7cc4f0', '#8fd0f6', '#a4dcfa', '#bfe8fb', '#d8f2fc'];
  bands(c, 0, 0, AW, h, S);
  for (let i = 1; i < S.length; i++) dither(c, 0, Math.round((i * h) / S.length) - 1, AW, 2, S[i], i);
}
export function cloud(c, x, y, col = '#ffffff') {
  x = Math.round(x);
  R(c, x + 3, y + 5, 30, 8, col); R(c, x + 8, y + 1, 14, 8, col); R(c, x + 17, y + 3, 11, 7, col);
}
export function tree(c, x, y, r, trunk = '#6a4a2a', leaf = '#2f7a3a', hi = '#4aa04a') {
  R(c, x - 2, y, 4, r + 6, trunk);
  disc(c, x, y - 2, r, leaf); disc(c, x - r / 3, y - r / 2, r * 0.6, hi);
}
export function lantern(c, x, y, s = 1) {
  R(c, x + 4 * s, y - 5, 2, 5, '#3a2010');
  R(c, x + 1 * s, y, 8 * s, 2, '#2a1a1a');
  R(c, x, y + 2, 10 * s, 10 * s, '#d6304a'); R(c, x + 2, y + 3, 2, 8 * s, '#ff7a7a');
  R(c, x, y + 5 * s, 10 * s, 1, '#a01a30'); R(c, x + 1 * s, y + 12 * s, 8 * s, 2, '#2a1a1a');
}
export function steam(c, x, y, t, n = 2) {
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.35 + i * 7) % 14;
    c.globalAlpha = Math.max(0, 0.8 - ph / 16);
    R(c, x + i * 4 + ((Math.floor(ph / 4) + i) % 2), y - ph, 1, 3, '#ffffff');
  }
  c.globalAlpha = 1;
}
export function window_(c, x, y, w, h, frame = '#6b4226', glass = '#bfe6f6') {
  R(c, x, y, w, h, frame); R(c, x + 2, y + 2, w - 4, h - 4, glass); R(c, x + w / 2 - 1, y + 2, 2, h - 4, frame); R(c, x + 2, y + h / 2 - 1, w - 4, 2, frame);
}
export function heart(c, x, y, col = '#ff5d8f', s = 1) {
  R(c, x + s, y, s * 2, s, col); R(c, x + s * 4, y, s * 2, s, col);
  R(c, x, y + s, s * 7, s * 2, col); R(c, x + s, y + s * 3, s * 5, s, col); R(c, x + s * 2, y + s * 4, s * 3, s, col); R(c, x + s * 3, y + s * 5, s, s, col);
}

// ---------------------------------------------------------------- people
const IMG = (look, dir = 'down', f = 0) => {
  const sh = charSheetHD(look || {});
  const l = sh[dir] || sh.down;
  return l[f] || l[0];
};
export const SP = {
  // standing, 32x40 (k = scale)
  stand(c, look, x, y, dir = 'down', k = 1, f = 0) { const im = IMG(look, dir, f); c.drawImage(im, 0, 0, im.width, im.height, Math.round(x), Math.round(y), Math.round(32 * k), Math.round(40 * k)); },
  // the top `rows` pixel rows only (behind a table / seat back)
  seat(c, look, x, y, dir = 'down', rows = 30, k = 1) { const im = IMG(look, dir); c.drawImage(im, 0, 0, im.width, (im.height * rows) / 40, Math.round(x), Math.round(y), Math.round(32 * k), Math.round(rows * k)); },
  walk(c, look, x, y, dir, t, k = 1) { SP.stand(c, look, x, y - (Math.floor(t / 8) % 2), dir, k, 1 + (Math.floor(t / 10) % 2)); },
  // a small person (a child): scale 0.6
  kid(c, look, x, y, dir = 'down', k = 0.62) { SP.stand(c, look, x, y, dir, k); },
};
// a baby in a blanket (x, y = top-left of a 14x12 bundle)
export function baby(c, x, y, blanket = '#fff0f4', skin = '#f6c9a0') {
  oval(c, x + 7, y + 8, 7, 4, blanket); R(c, x + 1, y + 7, 12, 1, shade(blanket, -0.12));
  disc(c, x + 7, y + 4, 4, skin); R(c, x + 5, y + 4, 1, 1, '#3a2a2a'); R(c, x + 9, y + 4, 1, 1, '#3a2a2a'); R(c, x + 6, y + 6, 2, 1, '#e8847a');
  R(c, x + 4, y + 1, 6, 2, '#3a2a2a');
}

// floor helper
const floor = (c, y, a, b, w = 16) => { R(c, 0, y, AW, AH - y, a); for (let yy = y; yy < AH; yy += 8) for (let x = ((yy - y) / 8) % 2 ? 0 : w / 2; x < AW; x += w) R(c, x, yy, w / 2, 8, b); };

// ================================================================== the painters
export const ART = {
  // ---------------------------------------------------------------- 喫茶店 / カフェ
  cafe(c, t, X) {
    R(c, 0, 0, AW, 70, '#f2e2c4'); R(c, 0, 70, AW, 42, '#c89a6a');
    for (let y = 72; y < AH; y += 8) for (let x = ((y - 72) / 8) % 2 ? 0 : 8; x < AW; x += 16) R(c, x, y, 8, 8, '#b88a5a');
    R(c, 0, 66, AW, 4, '#8a5a32');
    window_(c, 112, 8, 100, 52);
    skyOf(c, X.phase === 'night' ? 'night' : 'day', 0); // (no sky outside: the window shows a small street)
    R(c, 114, 10, 96, 48, X.phase === 'night' ? '#1a2150' : '#bfe6f6'); R(c, 161, 10, 2, 48, '#6b4226'); R(c, 114, 33, 96, 2, '#6b4226');
    disc(c, 130, 46, 8, '#4a9a4a'); R(c, 140, 40, 22, 18, '#e0d6c4'); for (let i = 0; i < 3; i++) R(c, 144 + i * 6, 44, 3, 4, X.phase === 'night' ? '#ffe08a' : '#8ac8e8');
    R(c, 168, 36, 30, 22, '#d8b890'); R(c, 172, 40, 8, 8, X.phase === 'night' ? '#ffe08a' : '#8ac8e8');
    for (const lx of [40, 280]) { R(c, lx, 0, 1, 14, '#3a3a44'); R(c, lx - 6, 14, 13, 3, '#2f6b5a'); R(c, lx - 7, 17, 15, 3, '#3f8a72'); R(c, lx - 2, 20, 5, 2, '#fff6a8'); }
    R(c, 8, 26, 44, 38, '#8a5a32'); R(c, 10, 28, 40, 34, '#2f3f36'); for (let i = 0; i < 5; i++) R(c, 14, 32 + i * 6, 10 + ((i * 7) % 18), 1, '#e8e8e8');
    R(c, 258, 44, 26, 22, '#c0603a'); for (const [dx, dy] of [[0, 0], [8, -8], [16, 2], [6, -14]]) disc(c, 262 + dx, 42 + dy, 7, '#4a9a4a');
    SP.seat(c, X.you, 92, 40, 'right', 34); SP.seat(c, X.me, 196, 40, 'left', 34);
    R(c, 70, 80, 180, 1, '#6a6a7a'); R(c, 70, 81, 180, 7, '#fbf8f0'); R(c, 70, 88, 180, 18, '#f0e4cc'); R(c, 70, 100, 180, 2, '#e8a0b0');
    R(c, 90, 106, 4, 6, '#3a3a44'); R(c, 226, 106, 4, 6, '#3a3a44');
    for (const [cx, col] of [[108, '#c08a5a'], [204, '#7a4a2a']]) { steam(c, cx + 3, 70, t + cx, 2); R(c, cx, 72, 12, 8, '#ffffff'); R(c, cx + 1, 72, 10, 2, col); R(c, cx + 12, 74, 3, 4, '#5a4a3a'); R(c, cx - 4, 80, 20, 1, '#8a8a9a'); }
    R(c, 150, 74, 20, 6, '#fff6e0'); R(c, 150, 76, 20, 1, '#f0c870'); R(c, 157, 70, 6, 4, '#e8384f');
  },
  // ---------------------------------------------------------------- 映画館 (from behind)
  eiga(c, t, X) {
    R(c, 0, 0, AW, AH, '#12101a');
    const hue = (Math.floor(t / 30) % 4);
    const scr = ['#5a8ad8', '#e0905a', '#6ac08a', '#c06ab8'][hue];
    R(c, 52, 6, 216, 56, '#24202e'); R(c, 56, 9, 208, 50, shade(scr, -0.35));
    for (let i = 0; i < 8; i++) R(c, 56, 9 + i * 6, 208, 3, shade(scr, -0.28 + (i % 2) * 0.05));
    disc(c, 220, 24, 8, shade(scr, 0.4)); R(c, 56, 44, 208, 15, shade(scr, -0.5)); for (let x = 56; x < 264; x += 18) R(c, x, 40 + ((x / 18) % 3) * 2, 12, 20, shade(scr, -0.55));
    c.globalAlpha = 0.18; R(c, 20, 62, 280, 50, scr); c.globalAlpha = 1;
    const rows = [[78, '#7a1a2a', '#a82a3a'], [92, '#6a1424', '#962436'], [106, '#5a101e', '#82202e']];
    for (const [y, a, b] of rows) {
      for (let x = 6; x < AW; x += 22) { R(c, x, y, 18, 12, a); R(c, x, y, 18, 3, b); R(c, x + 2, y + 3, 14, 9, a); }
    }
    SP.seat(c, X.you, 118, 72, 'up', 24); SP.seat(c, X.me, 166, 72, 'up', 24);
    R(c, 112, 90, 22, 6, '#7a1a2a'); R(c, 160, 90, 22, 6, '#7a1a2a');
    // popcorn
    R(c, 142, 92, 12, 12, '#e8e0d0'); for (let i = 0; i < 3; i++) R(c, 142 + i * 4, 92, 2, 12, '#d6304a'); for (let i = 0; i < 5; i++) disc(c, 144 + i * 2, 91 - (i % 2), 2, '#fff2b0');
    for (let i = 0; i < 6; i++) { const ph = (t * 0.2 + i * 17) % 100; R(c, 20 + i * 52, 70 + ph * 0.1, 1, 1, '#ffffff'); }
  },
  // ---------------------------------------------------------------- お笑いライブ
  live(c, t, X) {
    R(c, 0, 0, AW, AH, '#1a1226');
    R(c, 40, 6, 240, 58, '#2a1a3a'); R(c, 44, 10, 232, 50, '#5a2a5a');
    bands(c, 44, 10, 232, 50, ['#6a2a6a', '#5a2250', '#4a1a46', '#3a1238']);
    R(c, 40, 6, 24, 58, '#8a1a2c'); R(c, 256, 6, 24, 58, '#8a1a2c'); for (let x = 42; x < 64; x += 6) R(c, x, 6, 2, 58, '#6a1020'); for (let x = 258; x < 280; x += 6) R(c, x, 6, 2, 58, '#6a1020');
    R(c, 40, 4, 240, 5, '#b02a3a');
    R(c, 44, 58, 232, 6, '#c8903a'); R(c, 44, 58, 232, 1, '#e8b860');
    // spotlights
    c.globalAlpha = 0.16; for (let i = 0; i < 3; i++) { const sx = 110 + i * 50; c.fillStyle = ['#fff2c0', '#ffd0e0', '#c0e0ff'][i]; for (let y = 8; y < 60; y += 2) { const w = 5 + (y - 8) * 0.35; c.fillRect(sx - w, y, w * 2, 2); } } c.globalAlpha = 1;
    // two comedians on stage with a stand mic
    const hop = Math.floor(t / 14) % 2;
    SP.stand(c, { hair: 'spiky', hairColor: 'orange', skin: 'fair', top: '#ffd23f', bottom: '#d62f2f' }, 124, 22 - hop, 'down', 1);
    SP.stand(c, { hair: 'short', hairColor: 'black', skin: 'tan', top: '#2f6fd0', bottom: '#2a2d36', glasses: true }, 168, 22, 'down', 1);
    R(c, 158, 36, 2, 24, '#c8ccd4'); R(c, 156, 34, 6, 3, '#3a3a44');
    // the crowd
    for (let x = 4; x < AW; x += 20) { R(c, x, 82, 16, 30, '#241a30'); R(c, x + 1, 82, 14, 2, '#3a2a48'); disc(c, x + 8, 78, 5, '#2a2230'); }
    SP.seat(c, X.you, 112, 66, 'up', 28); SP.seat(c, X.me, 154, 66, 'up', 28);
    R(c, 100, 90, 80, 22, '#3a2a48'); R(c, 100, 90, 80, 2, '#5a4a68');
    const beat = Math.floor(t / 12) % 4;
    if (beat < 2) { text(c, 'ハハハ', 70 + beat * 4, 74 - beat * 3, { size: 10, color: '#ffe48a', shadow: null }); text(c, 'わはは', 218, 72 + beat * 2, { size: 10, color: '#ffb0d0', shadow: null }); }
  },
  // ---------------------------------------------------------------- 公園さんぽ
  park(c, t, X) {
    skyOf(c, X.phase, 58);
    if (X.phase === 'day') { cloud(c, ((t * 0.07) % 360) - 40, 8); cloud(c, ((t * 0.045 + 150) % 360) - 40, 18); }
    if (X.phase === 'night') stars(c, t, 30, 50);
    R(c, 0, 52, AW, 10, '#3f8a46'); for (let i = 0; i < 12; i++) { disc(c, 6 + i * 28, 52, 12 + (i % 3) * 3, '#3f8a46'); disc(c, 2 + i * 28, 48, 5, '#5aa85a'); }
    R(c, 0, 62, AW, 50, X.phase === 'night' ? '#2f5a38' : '#7cc85a');
    for (let i = 0; i < 70; i++) { const x = Math.floor(hash2(i, 3, 5) * AW), y = 64 + Math.floor(hash2(i, 4, 5) * 40); R(c, x, y, 1, 2, X.phase === 'night' ? '#3a6a44' : '#5aa848'); }
    R(c, 0, 92, AW, 20, X.phase === 'night' ? '#6a6a5a' : '#e2cf9a'); R(c, 0, 92, AW, 1, '#c8b47e');
    tree(c, 30, 30, 22, '#7a5232', '#2f7a3a', '#4a9a4a'); tree(c, 288, 34, 20, '#7a5232', '#2f7a3a', '#4a9a4a');
    // a pond
    oval(c, 232, 78, 36, 8, '#5a9ad8'); oval(c, 232, 77, 34, 6, '#8ac4f0'); for (let i = 0; i < 4; i++) R(c, 210 + i * 14 + ((Math.floor(t / 20) + i) % 3), 76 + (i % 2) * 3, 6, 1, '#d8f0ff');
    // lamp
    R(c, 70, 40, 3, 56, '#3a3a44'); R(c, 66, 36, 11, 5, '#3a3a44'); R(c, 68, 41, 7, 2, '#fff6a8');
    // the two walk along the path
    const x0 = 120 + Math.floor((Math.sin(t / 90) + 1) * 14);
    SP.walk(c, X.you, x0, 60, 'right', t); SP.walk(c, X.me, x0 + 36, 60, 'right', t + 5);
    if (X.kids && X.kids[0]) SP.kid(c, X.kids[0].look, x0 + 66, 80, 'right');
  },
  // ---------------------------------------------------------------- ごはん (定食屋・レストラン)
  gohan(c, t, X) {
    R(c, 0, 0, AW, 70, '#efe2c8'); R(c, 0, 70, AW, 42, '#caa878');
    R(c, 0, 66, AW, 4, '#6a4a2a');
    for (let x = 6; x < AW; x += 34) { R(c, x, 8, 28, 40, '#f6ecd2'); R(c, x + 2, 12, 24, 3, '#c0392b'); for (let k = 0; k < 4; k++) R(c, x + 4, 20 + k * 6, 20 - (k % 2) * 6, 2, '#3a2a1a'); }
    lantern(c, 150, 8, 1); lantern(c, 190, 8, 1);
    SP.seat(c, X.you, 84, 36, 'right', 34); SP.seat(c, X.me, 204, 36, 'left', 34);
    R(c, 62, 76, 196, 1, '#5a3a1a'); R(c, 62, 77, 196, 8, '#e8c48a'); R(c, 62, 77, 196, 1, '#f8e0b4'); R(c, 62, 85, 196, 21, '#9a6a3c'); R(c, 62, 85, 196, 1, '#6a4020');
    // dishes
    for (const [bx, bw] of [[98, 0], [198, 0]]) {
      steam(c, bx + 8, 66, t + bx, 3);
      R(c, bx, 70, 22, 8, '#e8e0d0'); R(c, bx + 1, 69, 20, 2, '#fff8e8'); R(c, bx + 2, 67, 18, 3, '#fff6e0');
      R(c, bx + 12, 68, 6, 2, '#c0392b');
    }
    R(c, 142, 70, 16, 8, '#c0392b'); R(c, 143, 69, 14, 2, '#e8c070'); R(c, 150, 68, 2, 2, '#5ec44a'); R(c, 132, 74, 6, 4, '#5a3a1a'); R(c, 164, 74, 8, 4, '#d8d8d0');
  },
  // ---------------------------------------------------------------- 居酒屋
  izakaya(c, t, X) {
    R(c, 0, 0, AW, AH, '#3a2418');
    for (let x = 0; x < AW; x += 12) R(c, x, 0, 1, 70, '#2c1a10');
    R(c, 0, 0, AW, 6, '#1e120a');
    // noren + chalkboard
    R(c, 20, 6, 70, 26, '#2f3f7a'); for (let k = 0; k < 4; k++) R(c, 36 + k * 16, 6, 1, 26, '#24305e'); text(c, '酒', 54, 10, { size: 16, color: '#ffffff', shadow: null });
    R(c, 232, 10, 56, 34, '#2a2a2e'); R(c, 234, 12, 52, 30, '#1e3a2a'); for (let k = 0; k < 4; k++) R(c, 238, 17 + k * 6, 30 - (k * 5) % 12, 1, '#e8e8d8');
    for (const lx of [110, 150, 190]) { lantern(c, lx, 8, 1); c.globalAlpha = 0.14; disc(c, lx + 5, 20, 22, '#ff9a3a'); c.globalAlpha = 1; }
    SP.seat(c, X.you, 96, 34, 'down', 34); SP.seat(c, X.me, 192, 34, 'down', 34);
    R(c, 0, 74, AW, 4, '#7a4a22'); R(c, 0, 78, AW, 34, '#5a3418'); R(c, 0, 74, AW, 1, '#b07a42');
    for (const mx of [118, 196]) { R(c, mx, 60, 10, 14, '#f4e6b0'); R(c, mx, 60, 10, 3, '#ffffff'); R(c, mx + 10, 63, 3, 8, '#e8e8e0'); }
    R(c, 150, 66, 28, 8, '#c8a060'); for (let k = 0; k < 4; k++) R(c, 152 + k * 6, 62, 1, 12, '#e8c080'); R(c, 150, 70, 28, 2, '#a07a40');
    steam(c, 160, 62, t, 2);
    R(c, 140, 82, 44, 14, '#6a3a1a'); R(c, 142, 84, 40, 10, '#c0392b');
  },
  // ---------------------------------------------------------------- カラオケ
  karaoke(c, t, X) {
    R(c, 0, 0, AW, AH, '#2a1a4a');
    for (let i = 0; i < 36; i++) { const x = Math.floor(hash2(i, 1, 7) * AW), y = Math.floor(hash2(i, 2, 7) * 76); R(c, x, y, 2, 2, ['#ff5db0', '#5fd7ff', '#ffd23f', '#5ee07a'][(Math.floor(t / 16) + i) % 4]); }
    const bl = Math.floor(t / 30) % 2;
    R(c, 0, 8, AW, 1, bl ? '#ff5db0' : '#c03a88'); R(c, 0, 78, AW, 1, bl ? '#5fd7ff' : '#3a9ac0');
    R(c, 100, 14, 120, 54, '#0a0a12'); R(c, 103, 17, 114, 48, '#20306a'); R(c, 103, 52, 114, 13, '#2a3a8a');
    const prog = (t * 0.8) % 100;
    for (let i = 0; i < 2; i++) { R(c, 112, 28 + i * 12, 96, 5, '#ffffff'); R(c, 112, 28 + i * 12, i === 0 ? prog : Math.max(0, prog - 80), 5, '#ff5db0'); }
    R(c, 20, 62, 70, 22, '#c0304a'); R(c, 20, 62, 70, 3, '#e05068'); R(c, 230, 62, 70, 22, '#c0304a'); R(c, 230, 62, 70, 3, '#e05068');
    R(c, 0, 84, AW, 28, '#1e1430'); R(c, 0, 84, AW, 1, '#3a2a5a');
    R(c, 110, 88, 100, 5, '#5a5a7a'); R(c, 114, 93, 3, 16, '#3a3a5a'); R(c, 203, 93, 3, 16, '#3a3a5a');
    for (const [gx, col] of [[130, '#ff9a3c'], [180, '#5ee07a']]) { R(c, gx, 78, 9, 10, '#e8f4f8'); R(c, gx + 1, 81, 7, 7, col); }
    const hop = Math.floor(t / 18) % 2;
    SP.stand(c, X.you, 130, 38 - hop, 'down'); // sings
    R(c, 150, 62 - hop, 2, 8, '#3a3a44'); R(c, 148, 60 - hop, 5, 3, '#c8ccd4');
    SP.seat(c, X.me, 232, 36, 'left', 34);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 13) % 40; c.globalAlpha = Math.max(0, 1 - ph / 40); text(c, '♪', 160 + i * 9 + (Math.floor(ph / 6) % 2), 56 - ph, { size: 12, color: i % 2 ? '#ffd23f' : '#ff5db0', shadow: null }); c.globalAlpha = 1; }
  },
  // ---------------------------------------------------------------- 水族館 (from behind)
  suizokukan(c, t, X) {
    R(c, 0, 0, AW, AH, '#06142e');
    bands(c, 0, 0, AW, 84, ['#0e3a7a', '#0b3070', '#082a62', '#062054']);
    // light rays
    c.globalAlpha = 0.1; for (let i = 0; i < 6; i++) { c.fillStyle = '#bfe6ff'; for (let y = 0; y < 80; y += 2) { const x = 20 + i * 54 + y * 0.3; c.fillRect(x, y, 8 + i, 2); } } c.globalAlpha = 1;
    // fish
    const fish = (x, y, col, dir) => { const s = dir; R(c, x, y, 8, 4, col); R(c, x + (s > 0 ? 8 : -3), y + 1, 3, 2, col); R(c, x + (s > 0 ? 6 : 1), y + 1, 1, 1, '#ffffff'); R(c, x + 2, y - 1, 3, 1, shade(col, -0.2)); };
    for (let i = 0; i < 9; i++) { const sp = 0.25 + (i % 3) * 0.12; const dir = i % 2 ? 1 : -1; const x = ((t * sp * dir + i * 53) % 360 + 360) % 360 - 20; fish(x, 14 + (i * 9) % 52, ['#ffd23f', '#ff8a3d', '#8ae0ff', '#f0f0ff', '#ff6a9a'][i % 5], dir); }
    for (let i = 0; i < 4; i++) { const px = 260 + i * 8, py = 76 - ((t * 0.5 + i * 19) % 70); disc(c, px, py, 1, '#bfe6ff'); }
    // a jellyfish
    const jy = 28 + Math.sin(t / 30) * 6;
    oval(c, 238, jy, 12, 8, 'rgba(255,200,240,0.7)'); oval(c, 238, jy, 8, 5, '#ffe0f6'); for (let k = 0; k < 5; k++) R(c, 230 + k * 4, jy + 6, 1, 10 + ((k + Math.floor(t / 10)) % 3), '#ffc0e8');
    R(c, 0, 84, AW, 28, '#05080f'); R(c, 0, 82, AW, 3, '#2a3a5a');
    SP.seat(c, X.you, 126, 56, 'up', 34); SP.seat(c, X.me, 164, 56, 'up', 34);
  },
  // ---------------------------------------------------------------- 観覧車
  kanransha(c, t, X) {
    const ph = X.phase === 'night' ? 'night' : 'dusk';
    skyOf(c, ph, 76);
    if (ph === 'night') stars(c, t, 36, 60);
    else disc(c, 252, 56, 14, '#ffe28a');
    R(c, 0, 76, AW, 36, ph === 'night' ? '#10204a' : '#2a4a7a'); for (let i = 0; i < 14; i++) R(c, ((i * 53 + t * 0.3) % 340) - 10, 80 + (i % 5) * 6, 14, 1, ph === 'night' ? '#6a8ad8' : '#8ac0f0');
    // the wheel
    const cx = 160, cy = 54, r = 44;
    for (let k = 0; k < 12; k++) {
      const a = ((k / 12) * Math.PI * 2) + t / 400;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      for (let s = 3; s < r; s += 4) R(c, cx + Math.cos(a) * s, cy + Math.sin(a) * s, 1, 1, '#d8dce6');
      R(c, x - 3, y - 1, 7, 6, ['#ff5d8f', '#ffd23f', '#5fd7ff', '#5ee07a'][k % 4]); R(c, x - 3, y - 1, 7, 1, '#ffffff');
    }
    for (let a = 0; a < 120; a++) { const aa = (a / 120) * Math.PI * 2; R(c, cx + Math.cos(aa) * r, cy + Math.sin(aa) * r, 1, 1, ph === 'night' && a % 3 === Math.floor(t / 8) % 3 ? '#fff6a8' : '#e8ecf4'); }
    disc(c, cx, cy, 4, '#8a8ea0');
    R(c, cx - 14, cy + 3, 3, 52, '#c0c4d0'); R(c, cx + 11, cy + 3, 3, 52, '#c0c4d0'); R(c, cx - 22, 104, 44, 4, '#9aa0b0');
    // the pier and the two
    R(c, 0, 94, AW, 18, ph === 'night' ? '#3a3a50' : '#8a7a8a'); R(c, 0, 94, AW, 1, '#c8c0d0');
    for (let x = 6; x < AW; x += 40) { R(c, x, 80, 2, 14, '#5a5a6a'); R(c, x - 2, 78, 6, 3, ph === 'night' ? '#fff6a8' : '#8a8a9a'); }
    SP.stand(c, X.you, 94, 64, 'right', 1); SP.stand(c, X.me, 128, 64, 'right', 1);
    if (X.hearts) { const hy = 48 - (t % 60) * 0.3; c.globalAlpha = 1 - (t % 60) / 60; heart(c, 118, hy, '#ff7eb6', 1); c.globalAlpha = 1; }
  },
  // ---------------------------------------------------------------- 夜景の展望台
  yakei(c, t, X) {
    R(c, 0, 0, AW, AH, '#06081c');
    bands(c, 0, 0, AW, 60, ['#080c26', '#0e1438', '#161e4a', '#222a5e']);
    stars(c, t, 40, 40);
    // city lights below the glass
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(hash2(i, 1, 33) * AW), y = 46 + Math.floor(hash2(i, 2, 33) * 46);
      if ((i + Math.floor(t / 20)) % 17 === 0) continue;
      R(c, x, y, i % 5 === 0 ? 2 : 1, 1, ['#ffe08a', '#fff6c8', '#ffb86a', '#8ad8ff'][i % 4]);
    }
    for (let x = 0; x < AW; x += 24) { R(c, x + 6, 62 - ((x * 7) % 20), 10, 40, 'rgba(10,14,40,0.55)'); }
    // a river of red tail-lights
    for (let i = 0; i < 20; i++) R(c, ((i * 17 + t * 0.6) % 330) - 5, 96 + (i % 3), 3, 1, '#ff4a4a');
    // the window frame
    R(c, 0, 0, AW, 5, '#1a1a24'); R(c, 0, 96, AW, 16, '#1a1a24'); R(c, 0, 96, AW, 2, '#3a3a50'); R(c, 0, 0, 6, AH, '#1a1a24'); R(c, AW - 6, 0, 6, AH, '#1a1a24'); R(c, 158, 0, 4, 96, '#1a1a24');
    R(c, 0, 90, AW, 3, '#4a4a60'); R(c, 0, 89, AW, 1, '#8a8aa0'); // the rail
    SP.seat(c, X.you, 96, 62, 'up', 34); SP.seat(c, X.me, 134, 62, 'up', 34);
    const tw = 26 + Math.sin(t / 40) * 2;
    R(c, 250, tw, 3, 60, '#c0392b'); R(c, 246, tw + 22, 11, 3, '#e8e8f0'); R(c, 249, tw - 3, 5, 3, '#ffffff'); // far tower (red lights blink)
    if (Math.floor(t / 30) % 2) R(c, 250, tw - 4, 3, 2, '#ff4a4a');
  },
  // ---------------------------------------------------------------- ドライブ (right-hand drive: the driver sits on the right)
  drive(c, t, X) {
    const ph = X.phase === 'night' ? 'night' : X.phase === 'dusk' ? 'dusk' : 'day';
    skyOf(c, ph, 58);
    if (ph === 'night') stars(c, t, 24, 40);
    else cloud(c, ((t * 0.08) % 360) - 30, 10);
    // far hills and the sea
    for (let i = 0; i < 5; i++) { oval(c, ((i * 90 - t * 0.12) % 420 + 420) % 420 - 40, 58, 70, 18, shade('#4a8a5a', ph === 'night' ? -0.6 : -0.1 * (i % 2))); }
    R(c, 0, 56, AW, 3, ph === 'night' ? '#10204a' : '#5a9ad8');
    R(c, 0, 59, AW, 53, ph === 'night' ? '#20242c' : '#6a6a74');
    // the road in perspective, passing posts
    c.fillStyle = ph === 'night' ? '#2a2e38' : '#7a7a86';
    for (let y = 59; y < 86; y++) { const k = (y - 59) / 27; c.fillRect(100 + (1 - k) * 60 - k * 100, y, 120 + k * 200, 1); }
    for (let i = 0; i < 6; i++) { const k = ((t * 0.02 + i / 6) % 1); const y = 59 + k * 27; const w = 1 + k * 4; R(c, 160 - w / 2, y, w, 1 + k * 3, '#f2f2f2'); }
    for (let i = 0; i < 6; i++) { const k = ((t * 0.02 + i / 6) % 1); const y = 59 + k * 27; R(c, 160 - 40 - k * 130, y - 10 * k, 2 + k * 3, 10 * k + 4, '#5a8a4a'); R(c, 160 + 40 + k * 130, y - 10 * k, 2 + k * 3, 10 * k + 4, '#5a8a4a'); }
    // the car
    R(c, 0, 82, AW, 30, '#1e1e26'); R(c, 0, 82, AW, 3, '#3a3a46'); R(c, 0, 98, AW, 14, '#2a2a34');
    R(c, 0, 0, 4, 86, '#1e1e26'); R(c, AW - 4, 0, 4, 86, '#1e1e26'); R(c, 0, 0, AW, 5, '#1e1e26'); R(c, 158, 0, 4, 12, '#2a2a34');
    SP.seat(c, X.you, 84, 54, 'up', 30); SP.seat(c, X.me, 196, 54, 'up', 30); // me: the driver (right seat)
    R(c, 176, 88, 46, 4, '#3a3a46'); disc(c, 200, 96, 18, '#2a2a34'); disc(c, 200, 96, 15, '#1e1e26'); R(c, 198, 92, 4, 8, '#5a5a66');
    R(c, 100, 90, 54, 3, '#4a4a56'); for (let i = 0; i < 3; i++) disc(c, 112 + i * 14, 92, 3, '#5a5a66');
    for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i * 13) % 40; c.globalAlpha = Math.max(0, 1 - p / 40); text(c, '♪', 150 + i * 8, 62 - p * 0.5, { size: 10, color: '#ffd23f', shadow: null }); c.globalAlpha = 1; }
  },
  // ---------------------------------------------------------------- おうちデート
  home(c, t, X) {
    const night = X.phase !== 'day';
    R(c, 0, 0, AW, 78, '#efe6d2'); R(c, 0, 78, AW, 34, '#b88a5a'); for (let x = 0; x < AW; x += 40) R(c, x, 78, 1, 34, '#a07a4a'); R(c, 0, 78, AW, 2, '#7a5a3a');
    window_(c, 20, 10, 74, 52, '#8a5a32', night ? '#1a2150' : '#bfe6f6'); if (night) { stars(c, t, 6, 50); R(c, 60, 14, 1, 1, '#fff6a8'); } else { cloud(c, 34, 18); }
    R(c, 14, 62, 86, 4, '#8a5a32');
    // TV with the glow
    R(c, 214, 18, 68, 44, '#24242c'); R(c, 217, 21, 62, 38, ['#5a8ad8', '#e0905a', '#6ac08a'][Math.floor(t / 40) % 3]); R(c, 217, 21, 62, 5, 'rgba(255,255,255,0.25)');
    R(c, 232, 62, 34, 6, '#3a3a44'); R(c, 200, 68, 96, 8, '#8a5a32');
    c.globalAlpha = 0.1; R(c, 100, 60, 190, 50, '#bfe0ff'); c.globalAlpha = 1;
    // plant & lamp
    R(c, 100, 38, 3, 40, '#3a3a44'); R(c, 94, 28, 16, 10, '#f2c06a'); R(c, 96, 30, 12, 6, '#fff0b0');
    R(c, 296, 56, 14, 22, '#c0603a'); for (const [dx, dy] of [[0, 0], [6, -8], [-4, -6]]) disc(c, 302 + dx, 52 + dy, 6, '#4a9a4a');
    // sofa
    R(c, 90, 56, 130, 26, '#7a4a6a'); R(c, 92, 58, 126, 18, '#9a6a8a'); R(c, 82, 66, 14, 24, '#6a3a5a'); R(c, 214, 66, 14, 24, '#6a3a5a'); R(c, 90, 80, 130, 8, '#6a3a5a');
    SP.seat(c, X.you, 116, 32, 'down', 40); SP.seat(c, X.me, 152, 32, 'down', 40);
    R(c, 96, 80, 118, 8, '#8a5a7a');
    // low table with tea
    R(c, 100, 96, 110, 4, '#a87449'); R(c, 100, 96, 110, 1, '#d6a06a'); R(c, 106, 100, 3, 10, '#6e4428'); R(c, 200, 100, 3, 10, '#6e4428');
    for (const [cx, col] of [[122, '#c08a5a'], [170, '#7a4a2a']]) { steam(c, cx + 3, 84, t + cx, 2); R(c, cx, 88, 10, 8, '#ffffff'); R(c, cx + 1, 88, 8, 2, col); }
    R(c, 142, 90, 16, 6, '#fff6e0'); R(c, 146, 87, 6, 3, '#e8384f');
  },
  // ---------------------------------------------------------------- 初詣
  jinja(c, t, X) {
    const night = X.phase === 'night';
    skyOf(c, night ? 'night' : 'day', 56); if (night) stars(c, t, 30, 46);
    R(c, 0, 56, AW, 56, night ? '#3a3a48' : '#c8bda0'); for (let i = 0; i < 60; i++) R(c, Math.floor(hash2(i, 5, 4) * AW), 60 + Math.floor(hash2(i, 6, 4) * 50), 2, 1, night ? '#4a4a58' : '#b0a688');
    // trees
    for (const x of [14, 48, 276, 306]) tree(c, x, 30, 20, '#4a3220', night ? '#1e3a28' : '#2a6a3a', night ? '#2a4a34' : '#3f8a4a');
    // torii
    R(c, 98, 14, 124, 7, '#c0392b'); R(c, 94, 12, 132, 4, '#2a1a1a'); R(c, 106, 24, 108, 4, '#c0392b');
    R(c, 112, 20, 8, 66, '#c0392b'); R(c, 200, 20, 8, 66, '#c0392b'); R(c, 110, 78, 12, 8, '#2a1a1a'); R(c, 198, 78, 12, 8, '#2a1a1a');
    R(c, 152, 28, 16, 12, '#2a1a1a'); R(c, 154, 30, 12, 8, '#e8c048');
    // lanterns on stands and stalls
    for (const x of [58, 244]) { R(c, x, 56, 4, 30, '#8a8a8a'); R(c, x - 4, 50, 12, 8, '#d8d8d0'); R(c, x - 2, 46, 8, 4, '#8a8a8a'); if (night) { c.globalAlpha = 0.25; disc(c, x + 2, 54, 14, '#ffd070'); c.globalAlpha = 1; } }
    for (let i = 0; i < 6; i++) lantern(c, 20 + i * 52, 70 + (i % 2) * 4, 1);
    // the crowd (silhouettes)
    for (let i = 0; i < 14; i++) { const x = (i * 23 + 5) % 300; if (x > 100 && x < 215) continue; R(c, x, 84 + (i % 3) * 3, 9, 18, ['#3a3a4a', '#5a3a3a', '#3a4a5a', '#6a5a3a'][i % 4]); disc(c, x + 4, 80 + (i % 3) * 3, 4, '#2a2230'); }
    const wy = 68;
    SP.walk(c, X.you, 128 + Math.floor((Math.sin(t / 100) + 1) * 8), wy, 'up', t); SP.walk(c, X.me, 164 + Math.floor((Math.sin(t / 100) + 1) * 8), wy, 'up', t + 7);
    if (X.wx === 'snow') for (let i = 0; i < 30; i++) R(c, (hash2(i, 1, 8) * AW + t * 0.3) % AW, (hash2(i, 2, 8) * AH + t * 0.6 + i * 7) % AH, 1, 1, '#ffffff');
  },
  // ---------------------------------------------------------------- お花見
  hanami(c, t, X) {
    skyOf(c, X.phase === 'night' ? 'night' : 'day', 60);
    if (X.phase === 'day') { cloud(c, ((t * 0.06) % 360) - 40, 6); cloud(c, ((t * 0.04 + 140) % 360) - 40, 16); }
    R(c, 0, 60, AW, 52, '#8ad060');
    for (let i = 0; i < 60; i++) R(c, Math.floor(hash2(i, 3, 6) * AW), 62 + Math.floor(hash2(i, 4, 6) * 48), 1, 2, '#6ab848');
    const sakura = (x, y, r) => { R(c, x - 3, y, 6, 50, '#6a4a3a'); for (const [dx, dy, rr, col] of [[0, 0, r, '#ffb8d0'], [-r * 0.6, r * 0.2, r * 0.7, '#ffc8dc'], [r * 0.6, r * 0.3, r * 0.7, '#ffa8c4'], [0, -r * 0.5, r * 0.6, '#ffd0e0']]) disc(c, x + dx, y + dy - 6, Math.round(rr), col); };
    sakura(40, 28, 28); sakura(260, 24, 32); sakura(150, 14, 26);
    // petals falling
    for (let i = 0; i < 26; i++) { const x = (hash2(i, 1, 9) * AW + t * 0.25 + Math.sin(t / 20 + i) * 6) % AW; const y = (hash2(i, 2, 9) * 130 + t * 0.5) % 120; R(c, x, y, 2, 1, i % 2 ? '#ffc0d8' : '#ffffff'); }
    if (X.banner) {
      // the school gate: a signboard between the parents, a path
      R(c, 0, 92, AW, 20, '#e2cf9a'); R(c, 0, 92, AW, 1, '#c8b47e');
      R(c, 104, 50, 112, 30, '#f2e8d0'); R(c, 104, 50, 112, 2, '#6a4a2a'); R(c, 104, 78, 112, 2, '#6a4a2a'); text(c, X.banner, 160, 58, { size: 14, color: '#3a2a1a', align: 'center', shadow: null });
      R(c, 110, 80, 3, 28, '#6a4a2a'); R(c, 207, 80, 3, 28, '#6a4a2a');
      SP.stand(c, X.you, 56, 56, 'down'); SP.stand(c, X.me, 232, 56, 'down');
    } else {
      // the picnic mat
      R(c, 90, 76, 140, 32, '#3a6ac8'); R(c, 90, 76, 140, 2, '#5a8ae0'); for (let x = 96; x < 230; x += 14) R(c, x, 80, 6, 24, '#4a7ad8');
      SP.seat(c, X.you, 112, 46, 'right', 34); SP.seat(c, X.me, 178, 46, 'left', 34);
      R(c, 146, 84, 30, 14, '#8a4a22'); R(c, 148, 86, 26, 10, '#f6ecd2'); R(c, 150, 88, 5, 5, '#e8384f'); R(c, 158, 88, 5, 5, '#f4d03a'); R(c, 166, 88, 5, 5, '#5ec44a');
      for (const [bx, col] of [[130, '#ffffff'], [200, '#ffffff']]) { R(c, bx, 90, 8, 10, col); R(c, bx, 90, 8, 2, '#e8c070'); }
    }
  },
  // ---------------------------------------------------------------- 花火大会
  hanabi(c, t, X) {
    R(c, 0, 0, AW, AH, '#05071a');
    bands(c, 0, 0, AW, 64, ['#050818', '#0a1030', '#10183e', '#1a2250']);
    stars(c, t, 26, 40);
    // the bursts
    for (let k = 0; k < 3; k++) {
      const cyc = 110, ph = (t + k * 37) % cyc;
      const cx = 70 + k * 90 + Math.floor((t + k * 37) / cyc) % 3 * 12, cy = 26 + ((k * 13) % 20);
      const col = ['#ff5d8f', '#ffd23f', '#5fd7ff', '#8aff9a'][(k + Math.floor((t + k * 37) / cyc)) % 4];
      if (ph < 14) { R(c, cx, 70 - ph * (70 - cy) / 14, 1, 4, '#fff6c8'); continue; }
      const p = ph - 14;
      if (p > 70) continue;
      const rr = Math.min(30, p * 0.7);
      c.globalAlpha = Math.max(0, 1 - p / 70);
      for (let a = 0; a < 24; a++) { const ang = (a / 24) * Math.PI * 2; R(c, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr + p * 0.12, 2, 2, col); if (rr > 12) R(c, cx + Math.cos(ang) * rr * 0.6, cy + Math.sin(ang) * rr * 0.6 + p * 0.1, 1, 1, '#ffffff'); }
      c.globalAlpha = 1;
      c.globalAlpha = Math.max(0, 0.15 - p / 500); disc(c, cx, cy, 40, col); c.globalAlpha = 1;
    }
    // the river and the bank
    R(c, 0, 66, AW, 18, '#0a1030'); for (let i = 0; i < 16; i++) R(c, ((i * 41 + t * 0.2) % 330) - 5, 68 + (i % 4) * 4, 12, 1, 'rgba(255,220,160,0.5)');
    R(c, 0, 84, AW, 28, '#1e2a1e'); R(c, 0, 84, AW, 2, '#3a4a30');
    for (let i = 0; i < 20; i++) { const x = (i * 17 + 4) % 310; if (x > 100 && x < 200) continue; R(c, x, 92 + (i % 3) * 3, 8, 14, ['#3a2a4a', '#4a2a2a', '#2a3a4a'][i % 3]); disc(c, x + 4, 88 + (i % 3) * 3, 4, '#1a1620'); }
    for (let i = 0; i < 8; i++) lantern(c, 6 + i * 44, 84, 1);
    SP.seat(c, X.you, 112, 74, 'up', 36, 1); SP.seat(c, X.me, 150, 74, 'up', 36, 1);
    R(c, 104, 104, 84, 8, '#c8b890');
  },
  // ---------------------------------------------------------------- イルミネーション
  illumi(c, t, X) {
    R(c, 0, 0, AW, AH, '#070a22'); bands(c, 0, 0, AW, 80, ['#070a22', '#0c1236', '#121a48', '#1a2458']);
    stars(c, t, 20, 40);
    R(c, 0, 84, AW, 28, '#cfd6e8'); R(c, 0, 84, AW, 2, '#eef2fa');
    // a great tree of lights
    const cx = 160;
    for (let i = 0; i < 40; i++) { const y = 10 + i * 1.7; const w = 3 + i * 0.95; c.fillStyle = '#0e3a2a'; c.fillRect(cx - w, y, w * 2, 2); }
    for (let i = 0; i < 90; i++) { const yy = 12 + hash2(i, 1, 41) * 68; const ww = 3 + (yy - 10) * 0.55; const xx = cx + (hash2(i, 2, 41) * 2 - 1) * ww; if ((i + Math.floor(t / 16)) % 4 === 0) continue; R(c, xx, yy, 2, 2, ['#fff6a8', '#ff7a9a', '#8ad8ff', '#ffffff'][i % 4]); }
    R(c, cx - 3, 80, 6, 6, '#5a3a1a'); R(c, cx - 3, 6, 6, 6, '#ffe28a'); c.globalAlpha = 0.25; disc(c, cx, 9, 16, '#fff6a8'); c.globalAlpha = 1;
    // arches of light on both sides
    for (const sx of [0, 1]) for (let i = 0; i < 6; i++) { const x = sx ? 230 + i * 14 : 6 + i * 14; R(c, x, 36, 2, 48, '#1a2a3a'); for (let k = 0; k < 8; k++) R(c, x, 38 + k * 6, 2, 2, (k + i + Math.floor(t / 14)) % 3 ? '#fff6a8' : '#8ad8ff'); }
    for (let i = 0; i < 60; i++) { const x = (hash2(i, 1, 51) * AW + Math.sin(t / 30 + i) * 4) % AW; const y = (hash2(i, 2, 51) * 130 + t * 0.4) % 112; R(c, x, y, 1, 1, '#ffffff'); }
    SP.walk(c, X.you, 112, 62, 'up', t); SP.walk(c, X.me, 150, 62, 'up', t + 6);
    if (X.hearts) { const hy = 52 - (t % 60) * 0.3; c.globalAlpha = 1 - (t % 60) / 60; heart(c, 136, hy, '#ff7eb6', 1); c.globalAlpha = 1; }
  },
};

export { floor as floorTiles };
