// 生活の一枚絵 (R31) — little animated pictures for the 生活 screen (life_screen.js): what you just did (登校・出勤・勉強・部活・
// アルバイト・運動・家事・人間ドック・図書館・就活・サークル・趣味・ボランティア・孫・子どもとの時間・行事) and the pages of 生い立ち.
// Each painter draws a 320x112 picture (shown at 2x) with (c, t, X): t = frame count, X = { me (your look), kid (a child's look),
// friend, phase 'day'|'dusk'|'night', season '春'|'夏'|'秋'|'冬', year, club, stage }. The date scenes of romance_art(2).js are
// reused where they fit (cafe, karaoke, izakaya, park, home, hoikuen).
import { charSheetHD } from './sprites.js';
import { text } from './draw.js';
import { hash2 } from './util.js';
import { AW, AH, R, disc, oval, dither, stars, skyOf, cloud, tree, steam, window_, heart, SP, baby } from './romance_art.js';
import { ALL as ROM_ART } from './romance_art2.js';

const FRIEND = { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5fa8d0', bottom: '#3a4a6a' };
const COWORKER = { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#3a4256', bottom: '#2a3040', jacket: true, tie: '#c0452f' };
const DOCTOR = { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#f4f4f4', bottom: '#4a5a7a', glasses: true };
const TEACHER = { hair: 'bob', hairColor: 'black', skin: 'light', top: '#7a9a5a', bottom: '#3a3a4a', skirt: true };
const suit = (look) => ({ ...(look || {}), top: '#2a3048', bottom: '#2a3048', jacket: true, tie: '#3a6ab0' });
const child = (look) => ({ ...(look || {}), top: '#ff9a3d' });
const blossom = (c, x, y, r) => { disc(c, x, y, r, '#f6b8c8'); disc(c, x - r / 3, y - r / 3, r * 0.6, '#fcd6e0'); R(c, x - 1, y, 3, r + 8, '#7a5232'); };
const ground = (c, y, a, b) => { R(c, 0, y, AW, AH - y, a); for (let i = 0; i < 60; i++) R(c, Math.floor(hash2(i, 7, 3) * AW), y + 2 + Math.floor(hash2(i, 8, 3) * (AH - y - 4)), 2, 1, b); };
const sparkle = (c, t, x, y, col = '#fff6a8') => { const p = Math.floor(t / 6) % 4; if (p < 3) { R(c, x, y - p, 1, 1 + p * 2, col); R(c, x - p, y, 1 + p * 2, 1, col); } };
const label = (c, s, x, y, col = '#ffffff', size = 9) => text(c, s, x, y, { size, color: col, shadow: null, align: 'center' });
const treeBySeason = (c, X, x, y, r) => { if (X.season === '春') blossom(c, x, y, r); else if (X.season === '秋') tree(c, x, y, r, '#7a5232', '#d27a2c', '#f0a040'); else if (X.season === '冬') { R(c, x - 2, y - 6, 4, r + 12, '#6a4a2a'); for (let i = 0; i < 5; i++) R(c, x - 10 + i * 5, y - r + (i % 2) * 4, 1, 10, '#6a4a2a'); } else tree(c, x, y, r); };
const sky = (c, X, h, t) => { skyOf(c, X.phase, h); if (X.phase === 'night') stars(c, t, 26, h - 6); else if (X.phase === 'day') { cloud(c, ((t * 0.06) % 380) - 40, 8); cloud(c, ((t * 0.04 + 170) % 380) - 40, 20); } };
const snow = (c, X, t) => { if (X.season !== '冬') return; for (let i = 0; i < 30; i++) R(c, (i * 37 + t * 0.3) % AW, (i * 23 + t * 0.5) % AH, 1, 1, '#ffffff'); };

export const LIFE_ART = {
  // ---------------------------------------------------------------- 学校の門 (登校) / 大学のキャンパス
  school(c, t, X) {
    sky(c, X, 60, t);
    const uni = X.stage === 'uni';
    // the building
    const bx = uni ? 120 : 90, bw = uni ? 190 : 210;
    R(c, bx, 14, bw, 52, uni ? '#d8c8b0' : '#efe8da'); R(c, bx, 14, bw, 3, uni ? '#8a6a4a' : '#b8b0a0');
    for (let fl = 0; fl < 3; fl++) for (let i = 0; i < Math.floor(bw / 18); i++) R(c, bx + 6 + i * 18, 20 + fl * 14, 11, 8, X.phase === 'night' ? '#ffe08a' : '#8ac8e8');
    if (uni) { R(c, bx + bw / 2 - 12, 0, 24, 18, '#c8b49a'); disc(c, bx + bw / 2, 8, 6, '#f8f4ea'); R(c, bx + bw / 2, 4, 1, 4, '#3a3a44'); R(c, bx + bw / 2, 8, 3, 1, '#3a3a44'); }
    else { disc(c, bx + bw / 2, 10, 6, '#f8f4ea'); R(c, bx + bw / 2, 6, 1, 4, '#3a3a44'); R(c, bx + bw / 2, 10, 3, 1, '#3a3a44'); }
    ground(c, 66, X.season === '冬' ? '#e8eef4' : '#d8c49a', '#c8b48a');
    // the gate and the fence
    R(c, 30, 40, 8, 36, '#8a8a92'); R(c, 76, 40, 8, 36, '#8a8a92'); R(c, 28, 38, 12, 4, '#6a6a72'); R(c, 74, 38, 12, 4, '#6a6a72');
    R(c, 18, 52, 8, 16, '#f6f2e8'); R(c, 19, 53, 6, 14, '#ffffff'); for (let k = 0; k < 4; k++) R(c, 21, 55 + k * 3, 2, 2, '#3a3a44');
    for (let x = 86; x < AW; x += 12) { R(c, x, 58, 2, 16, '#9a9aa2'); } R(c, 86, 60, AW, 2, '#9a9aa2'); R(c, 86, 68, AW, 2, '#9a9aa2');
    treeBySeason(c, X, 300, 40, 16); treeBySeason(c, X, 12, 36, 12);
    // you walk in
    const x = 40 + ((t * 0.6) % 120);
    SP.walk(c, X.me, x, 64, 'right', t);
    if (!uni) SP.walk(c, FRIEND, x - 34, 66, 'right', t + 4);
    snow(c, X, t);
  },
  // ---------------------------------------------------------------- オフィス (出勤・残業)
  office(c, t, X) {
    const night = X.phase === 'night' || X.overtime;
    R(c, 0, 0, AW, 78, '#e4e8ec'); R(c, 0, 78, AW, 34, '#9aa4ae'); for (let x = 0; x < AW; x += 32) R(c, x, 78, 1, 34, '#8a949e');
    // the window and the city
    R(c, 8, 6, 140, 50, '#5a6470'); R(c, 10, 8, 136, 46, night ? '#141a3a' : '#a8d4f0');
    for (let i = 0; i < 9; i++) { const h = 12 + (i * 7) % 26; R(c, 12 + i * 15, 54 - h, 12, h, night ? '#2a3050' : '#7a8aa0'); if (night) for (let k = 0; k < 3; k++) if ((i + k + Math.floor(t / 50)) % 3) R(c, 14 + i * 15, 56 - h + k * 5, 2, 2, '#ffe08a'); }
    R(c, 77, 8, 2, 46, '#5a6470');
    R(c, 170, 10, 40, 30, '#f8f8f0'); for (let k = 0; k < 4; k++) R(c, 174, 14 + k * 6, 28 - (k % 2) * 8, 2, '#8a8a92'); // the board
    R(c, 230, 12, 70, 6, '#3a4256'); text(c, X.year >= 2020 ? 'テレワーク推進中' : X.year <= 1991 ? '目標 売上120%' : '今月の目標', 265, 13, { size: 8, color: '#ffffff', shadow: null, align: 'center' });
    // desks
    for (const [dx, who, dir] of [[60, COWORKER, 'right'], [190, X.me, 'left']]) {
      SP.seat(c, who, dx, 44, dir, 34);
      R(c, dx - 20, 74, 72, 6, '#c8ccd2'); R(c, dx - 20, 80, 72, 22, '#a8aeb6');
      if (X.year >= 1995) { R(c, dx + (dir === 'right' ? 26 : -18), 56, 22, 16, '#2a2a32'); R(c, dx + (dir === 'right' ? 28 : -16), 58, 18, 11, ['#5a8ad8', '#6ac08a', '#e0d070'][Math.floor((t + dx) / 30) % 3]); }
      else { for (let k = 0; k < 4; k++) R(c, dx + (dir === 'right' ? 30 : -14), 70 - k * 3, 16, 3, k % 2 ? '#f4f0e0' : '#e0dcc8'); R(c, dx + (dir === 'right' ? 18 : -2), 66, 10, 6, '#3a3a44'); }
    }
    if (X.year >= 1995) for (let i = 0; i < 3; i++) R(c, 182 + ((t * 2 + i * 9) % 30), 50, 1, 1, '#ffffff');
    if (night) { c.globalAlpha = 0.25; R(c, 0, 0, AW, AH, '#0a0e2a'); c.globalAlpha = 1; R(c, 168, 20, 60, 50, 'rgba(255,240,180,0.18)'); }
  },
  // ---------------------------------------------------------------- 勉強 (机とスタンド)
  study(c, t, X) {
    const night = X.phase !== 'day';
    R(c, 0, 0, AW, 80, night ? '#4a4a6a' : '#efe6d2'); R(c, 0, 80, AW, 32, '#b88a5a');
    window_(c, 200, 8, 80, 50, '#8a5a32', night ? '#141a3a' : '#bfe6f6'); if (night) { disc(c, 262, 22, 6, '#fff6c0'); stars(c, t, 5, 40); }
    // shelf
    R(c, 20, 10, 90, 40, '#8a5a32'); for (let s2 = 0; s2 < 2; s2++) { R(c, 22, 28 + s2 * 20, 86, 2, '#6a4020'); for (let i = 0; i < 9; i++) R(c, 24 + i * 9, 12 + s2 * 20 + (i % 3), 7, 16 - (i % 3), ['#c0392b', '#2f6fd0', '#3a8a4a', '#d8a030', '#8a5ac8'][(i + s2) % 5]); }
    // desk, lamp and you (from behind)
    R(c, 110, 70, 140, 8, '#a87449'); R(c, 110, 78, 6, 30, '#6e4428'); R(c, 244, 78, 6, 30, '#6e4428');
    R(c, 214, 40, 3, 30, '#3a3a44'); R(c, 204, 36, 22, 8, '#f2c06a');
    c.globalAlpha = night ? 0.35 : 0.15; oval(c, 200, 70, 50, 10, '#fff6c0'); c.globalAlpha = 1;
    R(c, 160, 64, 30, 6, '#ffffff'); R(c, 162, 64, 1, 6, '#c0c0c8'); R(c, 176, 66, 10, 1, '#3a3a44');
    SP.seat(c, X.me, 150, 36, 'up', 36);
    if (Math.floor(t / 20) % 3 === 0) label(c, 'カリカリ', 140, 30, night ? '#ffe9a8' : '#7a5a3a');
  },
  // ---------------------------------------------------------------- 部活: グラウンド / 音楽室・美術室
  club(c, t, X) {
    const sport = !['suisou', 'engeki', 'keion', 'bijutsu', 'housou'].includes(X.club);
    if (sport) {
      sky(c, X, 48, t);
      ground(c, 48, '#c8a870', '#b89860');
      R(c, 0, 48, AW, 4, '#5aa848');
      for (let x = 0; x < AW; x += 40) R(c, x, 80, 20, 1, '#ffffff');
      R(c, 270, 30, 3, 40, '#ffffff'); R(c, 310, 30, 3, 40, '#ffffff'); R(c, 270, 30, 43, 3, '#ffffff'); dither(c, 273, 33, 37, 37, '#e0e0e0');
      const bx = 60 + ((t * 1.4) % 200), by = 70 - Math.abs(Math.sin(t / 10)) * 18;
      disc(c, bx, by, 3, '#ffffff'); R(c, bx - 1, by - 1, 2, 2, '#3a3a44');
      SP.walk(c, X.me, 40 + ((t * 1.2) % 180), 50, 'right', t * 2);
      SP.walk(c, FRIEND, 100 + ((t * 1.2) % 160), 56, 'right', t * 2 + 6);
      label(c, 'ファイト！', 160, 18, '#ffffff', 10);
    } else {
      R(c, 0, 0, AW, 80, '#efe4cc'); R(c, 0, 80, AW, 32, '#b08a5a');
      R(c, 10, 8, 120, 40, '#3a5a46'); R(c, 12, 10, 116, 36, '#2f4a3a');
      for (let i = 0; i < 6; i++) { const n = (i + Math.floor(t / 12)) % 6; R(c, 20 + i * 18, 18 + (n % 3) * 6, 3, 3, '#ffffff'); R(c, 22 + i * 18, 12 + (n % 3) * 6, 1, 7, '#ffffff'); }
      if (X.club === 'bijutsu') { R(c, 200, 30, 4, 50, '#8a5a32'); R(c, 180, 28, 50, 36, '#f8f4ea'); disc(c, 205, 46, 10, '#e07a5a'); R(c, 190, 54, 30, 6, '#5aa848'); }
      else { R(c, 210, 50, 70, 26, '#2a2a32'); R(c, 212, 52, 66, 6, '#f8f8f8'); for (let k = 0; k < 10; k++) R(c, 213 + k * 6.5, 52, 2, 4, '#2a2a32'); }
      SP.stand(c, X.me, 140, 42, 'down', 1, Math.floor(t / 12) % 3);
      SP.stand(c, FRIEND, 100, 44, 'right', 1, 0);
      for (let i = 0; i < 3; i++) { const ph = (t + i * 20) % 60; c.globalAlpha = 1 - ph / 60; label(c, '♪', 160 + i * 12 + ph / 4, 40 - ph / 3, '#c0392b', 11); } c.globalAlpha = 1;
    }
  },
  // ---------------------------------------------------------------- アルバイト (お店のカウンター)
  parttime(c, t, X) {
    const konbini = X.year >= 1990;
    R(c, 0, 0, AW, 80, konbini ? '#f4f8fa' : '#f2e2c4'); R(c, 0, 80, AW, 32, konbini ? '#d8dce0' : '#c89a6a');
    for (let s2 = 0; s2 < 3; s2++) { R(c, 170, 14 + s2 * 18, 140, 2, '#9aa0a8'); for (let i = 0; i < 14; i++) R(c, 172 + i * 10, 4 + s2 * 18, 8, 10, ['#e04a4a', '#f0b030', '#3a9ad8', '#5ac06a', '#e0e0e0'][(i + s2 * 2) % 5]); }
    R(c, 0, 6, 150, 10, konbini ? '#3a9a5a' : '#8a5a32'); text(c, konbini ? 'いらっしゃいませ' : '喫茶 ドット', 75, 7, { size: 8, color: '#ffffff', shadow: null, align: 'center' });
    SP.seat(c, X.me, 60, 34, 'down', 40);
    R(c, 10, 74, 150, 8, '#c0c4c8'); R(c, 10, 82, 150, 26, konbini ? '#e8eaec' : '#8a5a32');
    if (konbini) { R(c, 110, 60, 30, 14, '#3a3a44'); R(c, 112, 62, 26, 8, '#6ac08a'); text(c, '¥', 120, 62, { size: 8, color: '#1a3a1a', shadow: null }); }
    else { steam(c, 120, 64, t, 2); R(c, 116, 66, 12, 8, '#ffffff'); }
    SP.stand(c, FRIEND, 140 + ((t * 0.4) % 20), 52, 'left', 1, 1 + (Math.floor(t / 10) % 2));
  },
  // ---------------------------------------------------------------- 運動 (川ぞいの道) / 散歩
  jog(c, t, X) {
    sky(c, X, 56, t);
    R(c, 0, 46, AW, 10, '#6aa858'); for (let i = 0; i < 10; i++) disc(c, 16 + i * 34, 46, 12, '#5a9a4a');
    ground(c, 56, '#7cc85a', '#5aa848');
    R(c, 0, 78, AW, 14, '#e2cf9a'); R(c, 0, 78, AW, 1, '#c8b47e');
    R(c, 0, 92, AW, 20, '#5a9ad8'); for (let i = 0; i < 8; i++) R(c, (i * 47 + t * 0.4) % AW, 96 + (i % 3) * 4, 10, 1, '#bfe0ff');
    treeBySeason(c, X, 60, 34, 14); treeBySeason(c, X, 250, 36, 16);
    const senior = X.stage === 'senior' || X.stage === 'middle';
    const sp = senior ? 0.5 : 1.3;
    SP.walk(c, X.me, (t * sp) % (AW + 40) - 30, 50, 'right', t * (senior ? 1 : 2));
    if (!senior) { const p = Math.floor(t / 8) % 2; R(c, ((t * sp) % (AW + 40)) - 34, 84 + p, 3, 1, '#ffffff'); }
    snow(c, X, t);
  },
  // ---------------------------------------------------------------- 家事 (洗たく物とそうじ機)
  housework(c, t, X) {
    R(c, 0, 0, AW, 80, '#efe6d2'); R(c, 0, 80, AW, 32, '#c89a6a'); for (let x = 0; x < AW; x += 40) R(c, x, 80, 1, 32, '#b08a5a');
    window_(c, 200, 8, 100, 56, '#8a5a32', X.phase === 'night' ? '#1a2150' : '#bfe6f6');
    R(c, 204, 22, 92, 1, '#5a5a62');
    for (let i = 0; i < 5; i++) { const sw = Math.sin(t / 20 + i) * 1.5; R(c, 208 + i * 18 + sw, 23, 12, 14 + (i % 2) * 6, ['#ffffff', '#ff9ab8', '#8ac8f0', '#ffe08a', '#b0e0a0'][i]); }
    SP.stand(c, X.me, 100 + Math.sin(t / 15) * 20, 44, 'right', 1, 1 + (Math.floor(t / 10) % 2));
    const vx = 140 + Math.sin(t / 15) * 20;
    R(c, vx, 74, 18, 8, '#e04a4a'); R(c, vx + 2, 82, 4, 4, '#3a3a44'); R(c, vx + 12, 82, 4, 4, '#3a3a44'); R(c, vx - 8, 60, 2, 16, '#9a9aa2');
    for (let i = 0; i < 3; i++) sparkle(c, t + i * 8, 40 + i * 30, 90 - i * 6);
    R(c, 20, 52, 50, 28, '#8a5a32'); R(c, 22, 54, 46, 24, '#a87449'); R(c, 30, 60, 10, 8, '#ffffff'); R(c, 46, 60, 14, 8, '#f0d070');
  },
  // ---------------------------------------------------------------- 病院・人間ドック
  clinic(c, t, X) {
    R(c, 0, 0, AW, 80, '#eef4f6'); R(c, 0, 80, AW, 32, '#c8d8dc'); for (let x = 0; x < AW; x += 24) R(c, x, 80, 1, 32, '#b8c8cc');
    R(c, 20, 12, 60, 40, '#ffffff'); R(c, 46, 20, 8, 24, '#e04a4a'); R(c, 38, 28, 24, 8, '#e04a4a');
    R(c, 210, 20, 90, 60, '#f8fbfc'); R(c, 214, 24, 82, 6, '#6ac0c8'); for (let k = 0; k < 5; k++) R(c, 218, 36 + k * 8, 60 - (k % 3) * 14, 2, '#9ab0b8');
    SP.seat(c, DOCTOR, 230, 46, 'left', 34);
    SP.seat(c, X.me, 150, 46, 'right', 34);
    R(c, 120, 80, 150, 4, '#a8b8c0');
    const beat = (Math.floor(t / 4) % 30);
    for (let x = 0; x < 60; x++) { const h = x === beat || x === beat + 1 ? 8 : x === beat + 2 ? -4 : 0; R(c, 120 + x, 96 - h, 1, 1, '#3ac08a'); }
    label(c, X.grade ? `判定 ${X.grade}` : '健康チェック', 150, 18, '#3a6a7a', 10);
  },
  // ---------------------------------------------------------------- 図書館 (卒論)
  library(c, t, X) {
    R(c, 0, 0, AW, 82, '#e8dcc4'); R(c, 0, 82, AW, 30, '#9a7450');
    for (let b = 0; b < 4; b++) { const bx = 6 + b * 80; R(c, bx, 6, 70, 70, '#7a5232'); for (let s2 = 0; s2 < 4; s2++) { R(c, bx + 2, 22 + s2 * 16, 66, 2, '#5a3a20'); for (let i = 0; i < 9; i++) R(c, bx + 3 + i * 7, 8 + s2 * 16 + (i % 2), 6, 14 - (i % 2), ['#8a2a2a', '#2a4a8a', '#3a6a3a', '#8a6a2a', '#5a3a6a'][(i + s2 + b) % 5]); } }
    R(c, 60, 78, 200, 6, '#b88a5a'); R(c, 70, 84, 4, 24, '#6e4428'); R(c, 246, 84, 4, 24, '#6e4428');
    SP.seat(c, X.me, 140, 44, 'down', 36);
    R(c, 130, 70, 34, 10, '#f8f4ea'); R(c, 147, 70, 1, 10, '#c0c0c8');
    if (X.year >= 1995) { R(c, 172, 66, 24, 14, '#3a3a44'); R(c, 174, 68, 20, 9, '#8ac8f0'); }
    label(c, `${X.pct != null ? X.pct : ''}${X.pct != null ? '%' : ''}`, 196, 50, '#5a3a20', 10);
  },
  // ---------------------------------------------------------------- 就活 (ビルの前、スーツ)
  shukatsu(c, t, X) {
    sky(c, X, 70, t);
    for (let i = 0; i < 6; i++) { const h = 50 + (i * 19) % 40, x = i * 56; R(c, x, 80 - h, 50, h, ['#9aa8b8', '#b8c4d0', '#8a98a8'][i % 3]); for (let fl = 0; fl < h / 10; fl++) for (let k = 0; k < 4; k++) R(c, x + 4 + k * 12, 84 - h + fl * 10, 8, 5, X.phase === 'night' ? '#ffe08a' : '#d8ecf8'); }
    R(c, 0, 80, AW, 32, '#a8a8b0'); for (let x = 0; x < AW; x += 20) R(c, x, 96, 10, 2, '#d8d8e0');
    SP.walk(c, suit(X.me), 60 + ((t * 0.7) % 200), 62, 'right', t);
    R(c, 70 + ((t * 0.7) % 200), 88, 12, 9, '#2a2a32');
    label(c, X.market || '', 160, 6, '#ffffff', 9);
  },
  // ---------------------------------------------------------------- 趣味の教室・ボランティア (縁側と盆栽 / 公園のそうじ)
  hobby(c, t, X) {
    sky(c, X, 50, t);
    R(c, 0, 50, AW, 62, '#c8a870');
    R(c, 0, 60, AW, 14, '#8a5a32'); R(c, 0, 60, AW, 2, '#a87449'); for (let x = 0; x < AW; x += 30) R(c, x, 62, 1, 12, '#6a4020'); // 縁側
    R(c, 0, 74, AW, 38, '#5a7a4a'); for (let i = 0; i < 40; i++) R(c, Math.floor(hash2(i, 2, 9) * AW), 76 + Math.floor(hash2(i, 3, 9) * 34), 2, 2, '#4a6a3a');
    R(c, 220, 42, 40, 18, '#7a4a3a'); R(c, 238, 30, 3, 12, '#5a3a20'); disc(c, 232, 30, 8, '#3a7a3a'); disc(c, 248, 28, 7, '#4a8a4a');
    SP.seat(c, X.me, 120, 26, 'right', 36);
    SP.seat(c, FRIEND, 176, 26, 'left', 36);
    steam(c, 160, 54, t, 2); R(c, 155, 56, 10, 6, '#ffffff');
    if (X.season === '秋') for (let i = 0; i < 6; i++) R(c, (i * 53 + t * 0.4) % AW, (i * 31 + t * 0.3) % 70, 3, 2, '#e08a3a');
  },
  volunteer(c, t, X) {
    sky(c, X, 56, t);
    ground(c, 56, '#7cc85a', '#5aa848');
    R(c, 0, 82, AW, 30, '#e2cf9a');
    treeBySeason(c, X, 40, 34, 14); treeBySeason(c, X, 290, 36, 16);
    SP.walk(c, X.me, 110 + Math.sin(t / 30) * 16, 54, 'right', t);
    SP.walk(c, FRIEND, 170 - Math.sin(t / 30) * 16, 56, 'left', t + 5);
    for (let i = 0; i < 3; i++) R(c, 140 + i * 6, 96, 4, 2, '#7a5a32');
    R(c, 220, 76, 16, 20, '#3a8ad8'); R(c, 220, 76, 16, 3, '#2a6ab8');
    label(c, '地域のみなさん、ありがとう', 160, 6, '#ffffff', 9);
  },
  // ---------------------------------------------------------------- 子どもと: 読み聞かせ / 宿題 / 応援 / 運動会 / 参観 / 発表会
  kid_read(c, t, X) {
    R(c, 0, 0, AW, 80, '#3a3a5a'); R(c, 0, 80, AW, 32, '#7a6a5a');
    window_(c, 220, 10, 70, 46, '#5a4a3a', '#141a3a'); disc(c, 270, 22, 6, '#fff6c0'); stars(c, t, 6, 50);
    R(c, 40, 70, 180, 30, '#f4f0f8'); R(c, 40, 70, 180, 4, '#d8d0e8'); R(c, 60, 62, 40, 10, '#ffffff');
    SP.seat(c, X.me, 130, 34, 'down', 40);
    if (X.kid) SP.kid(c, X.kid, 82, 52, 'down', 0.7); else baby(c, 74, 60);
    R(c, 120, 66, 26, 16, '#f8d070'); R(c, 132, 66, 2, 16, '#c0902a'); R(c, 122, 70, 8, 6, '#e05a5a');
    c.globalAlpha = 0.18; disc(c, 130, 60, 40, '#fff6c0'); c.globalAlpha = 1;
    if (Math.floor(t / 30) % 2) label(c, 'むかしむかし…', 160, 22, '#ffe9a8', 9);
  },
  kid_homework(c, t, X) {
    R(c, 0, 0, AW, 80, '#efe6d2'); R(c, 0, 80, AW, 32, '#b88a5a');
    window_(c, 20, 10, 74, 52, '#8a5a32', X.phase === 'night' ? '#1a2150' : '#bfe6f6');
    R(c, 90, 76, 150, 6, '#a87449'); R(c, 96, 82, 4, 26, '#6e4428'); R(c, 230, 82, 4, 26, '#6e4428');
    if (X.kid) SP.seat(c, X.kid, 130, 50, 'down', 30, 0.8);
    SP.seat(c, X.me, 180, 40, 'left', 36);
    R(c, 128, 70, 30, 8, '#ffffff'); for (let k = 0; k < 3; k++) R(c, 130, 72 + k * 2, 20 - k * 4, 1, '#3a3a44');
    if (Math.floor(t / 25) % 3 === 0) label(c, 'わかった！', 140, 34, '#c0392b', 10);
  },
  kid_field(c, t, X) {
    sky(c, X, 46, t);
    ground(c, 46, '#c8a870', '#b89860');
    for (let i = 0; i < 16; i++) { const fx = i * 20 + 4; R(c, fx, 8 + (i % 2) * 2, 12, 8, ['#e04a4a', '#3a9ad8', '#f0c030', '#5ac06a', '#ffffff'][i % 5]); } R(c, 0, 8, AW, 1, '#5a5a62');
    R(c, 0, 78, AW, 2, '#ffffff'); R(c, 0, 96, AW, 2, '#ffffff');
    if (X.kid) SP.walk(c, X.kid, (t * 1.6) % (AW + 30) - 20, 60, 'right', t * 2);
    SP.walk(c, FRIEND, ((t * 1.5) % (AW + 30)) - 50, 66, 'right', t * 2 + 4);
    SP.stand(c, X.me, 270, 40, 'left', 1, 0);
    for (let i = 0; i < 2; i++) heart(c, 262 + i * 14, 32 - ((t / 3 + i * 10) % 16), '#ff5d8f', 1);
    label(c, X.ev || 'がんばれー！', 160, 22, '#7a3a2a', 10);
  },
  kid_class(c, t, X) {
    R(c, 0, 0, AW, 82, '#efe4cc'); R(c, 0, 82, AW, 30, '#b08a5a');
    R(c, 70, 8, 180, 40, '#3a5a46'); R(c, 72, 10, 176, 36, '#2f4a3a'); text(c, 'わたしの家族', 160, 20, { size: 10, color: '#ffffff', shadow: null, align: 'center' });
    for (let i = 0; i < 4; i++) { R(c, 30 + i * 70, 76, 40, 6, '#c8a070'); }
    if (X.kid) SP.stand(c, X.kid, 150, 46, 'down', 0.75, 0);
    SP.seat(c, TEACHER, 250, 40, 'left', 36);
    SP.stand(c, X.me, 10, 34, 'right', 1, 0); SP.stand(c, FRIEND, 290, 34, 'left', 1, 0);
  },
  kid_stage(c, t, X) {
    R(c, 0, 0, AW, AH, '#1a1428');
    R(c, 40, 40, 240, 50, '#5a3a20'); R(c, 40, 40, 240, 3, '#8a6a40');
    c.globalAlpha = 0.25; oval(c, 160, 66, 60, 26, '#fff6c0'); c.globalAlpha = 1;
    R(c, 0, 0, 40, AH, '#8a1a2a'); R(c, 280, 0, 40, AH, '#8a1a2a'); for (let y = 0; y < AH; y += 8) { R(c, 36, y, 4, 4, '#6a0a1a'); R(c, 280, y + 4, 4, 4, '#6a0a1a'); }
    if (X.kid) SP.stand(c, X.kid, 150, 50, 'down', 0.8, Math.floor(t / 16) % 3);
    for (let i = 0; i < 9; i++) { disc(c, 50 + i * 26, 104, 8, '#2a2236'); }
    SP.seat(c, X.me, 210, 84, 'up', 24);
    for (let i = 0; i < 3; i++) { const ph = (t + i * 20) % 60; c.globalAlpha = 1 - ph / 60; label(c, '♪', 170 + i * 10 + ph / 3, 48 - ph / 2, '#ffe08a', 11); } c.globalAlpha = 1;
  },
  // ---------------------------------------------------------------- 孫と
  grandkid(c, t, X) {
    sky(c, X, 58, t);
    ground(c, 58, '#7cc85a', '#5aa848');
    R(c, 0, 92, AW, 20, '#e2cf9a');
    treeBySeason(c, X, 40, 34, 16);
    R(c, 220, 50, 4, 40, '#c0392b'); R(c, 260, 50, 4, 40, '#c0392b'); R(c, 216, 48, 52, 4, '#c0392b'); R(c, 238, 52, 1, 22, '#5a5a62'); R(c, 232, 74 + Math.sin(t / 12) * 2, 14, 3, '#8a5a32');
    SP.stand(c, X.me, 140, 52, 'right', 1, 0);
    if (X.kid) SP.walk(c, X.kid, 180 + Math.sin(t / 20) * 20, 70, 'left', t, 0.6);
    for (let i = 0; i < 2; i++) heart(c, 160 + i * 12, 44 - ((t / 3 + i * 9) % 14), '#ff5d8f', 1);
  },
  // ---------------------------------------------------------------- 生い立ち: 赤ちゃん / 小学校 / 中学校
  origin_baby(c, t, X) {
    R(c, 0, 0, AW, 80, '#fbeef2'); R(c, 0, 80, AW, 32, '#e0c8a8');
    window_(c, 220, 10, 70, 46, '#c8a8a8', '#d8f0fc'); cloud(c, 236, 22);
    for (let i = 0; i < 5; i++) { const sw = Math.sin(t / 25 + i) * 3; R(c, 120 + i * 16, 10, 1, 14 + sw, '#9a8aa0'); disc(c, 120 + i * 16, 26 + sw, 4, ['#ffb0c8', '#a8d8f8', '#fff0a0', '#b8e8b0', '#e0c0f8'][i]); }
    R(c, 100, 60, 120, 6, '#d8b890'); for (let x = 102; x < 218; x += 10) R(c, x, 40, 3, 22, '#e8ccaa'); R(c, 100, 38, 120, 4, '#d8b890');
    baby(c, 150, 50);
    for (let i = 0; i < 3; i++) heart(c, 140 + i * 18, 30 - ((t / 4 + i * 10) % 12), '#ff8aaa', 1);
  },
  origin_school(c, t, X) {
    LIFE_ART.school(c, t, { ...X, me: child(X.me), stage: 'elem' });
  },
  origin_mid(c, t, X) {
    LIFE_ART.school(c, t, { ...X, me: { ...(X.me || {}), top: '#1f2a44', bottom: '#1f2a44', jacket: true }, stage: 'mid' });
  },
};

// which picture goes with an action / a kid action / an inbox
export const ACT_ART = {
  school: 'school', work: 'office', overtime: 'office', study: 'study', club: 'club', circle: 'cafe', friends: 'karaoke', parttime: 'parttime',
  shukatsu: 'shukatsu', thesis: 'library', exercise: 'jog', housework: 'housework', checkup: 'clinic', hobby: 'hobby', volunteer: 'volunteer',
  grandkid: 'grandkid', jibunshi: 'study', leave: 'park',
};
export const KID_ART = { read: 'kid_read', play: 'park', homework: 'kid_homework', chores: 'kid_homework', study: 'kid_homework', talk: 'home', cheer: 'kid_field', callkid: 'home' };
export const INBOX_ART = { reunion: 'izakaya', bunkasai: 'club', kid_event: 'kid_field', teinen: 'office', care: 'home' };

// draw a picture by key; romance's scenes are used for the keys it has (they expect X.you: a friend / a partner)
export function drawLifeArt(c, key, t, X) {
  const p = LIFE_ART[key];
  if (p) { p(c, t, X); return true; }
  const q = ROM_ART[key];
  if (q) { q(c, t, { you: X.friend || FRIEND, me: X.me, kids: X.kid ? [{ look: X.kid, k: 0.62 }] : [], phase: X.phase === 'dusk' ? 'dusk' : X.phase === 'night' ? 'night' : 'day', wx: 'sunny', extra: {} }); return true; }
  return false;
}
export { AW as ART_W, AH as ART_H };
