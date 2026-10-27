// 統治・戦時の国内の場面の絵 (R17): new scene arts for the regime scenes of regime_rule.js (the palace, the parade, the cult of personality,
// a plot, the plan's factories) and war_home.js (the queue for rations). They are added to kiki.js's ARTS, drawn the same way: flat rectangles, far-off
// silhouettes, no face, no body, no violence (the same rules as the rest of the crisis scenes).

import { SW } from '../engine/util.js';
import { text } from '../engine/draw.js';
import { ARTS, ART_H, sky, skyline, figure, crowd } from './kiki.js';

const R = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// a long government building with columns; lit: the share of lit windows (0..1)
function hall(ctx, x, y, w, h, wall, lit, t) {
  R(ctx, x, y, w, h, wall);
  R(ctx, x - 8, y - 10, w + 16, 12, '#5a5048');
  R(ctx, x + w / 2 - 40, y - 34, 80, 26, wall); R(ctx, x + w / 2 - 46, y - 40, 92, 8, '#5a5048');
  for (let cx = x + 10; cx < x + w - 10; cx += 22) R(ctx, cx, y + 6, 8, h - 6, 'rgba(255,255,255,0.16)');
  for (let i = 0; i < 9; i++) {
    const wx = x + 18 + i * ((w - 40) / 8), on = ((i * 37 + Math.floor(t / 120)) % 10) / 10 < lit;
    R(ctx, wx, y + 22, 10, 14, on ? '#f0c878' : '#2a2a34');
    R(ctx, wx, y + 52, 10, 14, on ? '#f0c878' : '#2a2a34');
  }
  R(ctx, x + w / 2 - 14, y + h - 30, 28, 30, '#2a2018'); // the great door
}
function flag(ctx, x, y, t, col) {
  R(ctx, x, y, 3, 74, '#3a3036');
  for (let i = 0; i < 28; i++) R(ctx, x + 3 + i, y + 2 + Math.sin((i + t / 6) / 4) * 2, 1, 22, i % 7 < 1 ? '#f2ecdc' : col);
}

Object.assign(ARTS, {
  // the ruler's palace by day: the balcony with one far-off figure, flags, a small crowd below
  palace(ctx, t) {
    sky(ctx, '#6aa0d0', '#d6e4ee');
    skyline(ctx, 120, '#8a98ae', 12, 20, 60, 22);
    hall(ctx, 150, 80, 340, 130, '#d8ccb4', 0.5, t);
    R(ctx, 296, 140, 48, 5, '#a89c84'); figure(ctx, 320, 140, 1.6, '#2a2028', Math.floor(t / 40) % 2);
    flag(ctx, 110, 60, t, '#b02a2a'); flag(ctx, 500, 60, t, '#b02a2a');
    R(ctx, 0, 210, SW, ART_H - 210, '#b8ac98');
    crowd(ctx, 0, SW, 214, ART_H - 4, 41, t, ['#3a3040', '#4a4048', '#2a2630'], 0.18);
  },
  // the palace at night, one window lit (a hospital room's glow — nothing else is shown)
  palace_night(ctx, t) {
    sky(ctx, '#0a0e22', '#2a2e4a');
    for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) { // a crescent: a disc minus a disc shifted to the upper right
      if (dx * dx + dy * dy <= 196 && (dx - 7) * (dx - 7) + (dy + 5) * (dy + 5) > 169) R(ctx, 420 + dx, 70 + dy, 1, 1, '#e8e4cc');
    }
    for (let i = 0; i < 40; i++) R(ctx, (i * 97) % SW, (i * 53) % 110, 1, 1, '#c8d0e8');
    skyline(ctx, 130, '#14182a', 3, 20, 60, 24);
    hall(ctx, 150, 80, 340, 130, '#3a3a4a', 0.12, t);
    R(ctx, 316, 102, 10, 14, '#f4d898'); // the one lit window
    R(ctx, 0, 210, SW, ART_H - 210, '#14141c');
    flag(ctx, 110, 60, t, '#3a1a20'); flag(ctx, 500, 60, t, '#3a1a20');
  },
  // dawn at the gate of the government building: rows of far-off soldiers and trucks (no one is hurt)
  plot_dawn(ctx, t) {
    sky(ctx, '#2a2040', '#d08a5a', ART_H, 16);
    skyline(ctx, 120, '#2a2030', 61, 20, 70, 24);
    hall(ctx, 150, 90, 340, 120, '#4a4048', 0.3, t);
    R(ctx, 0, 210, SW, ART_H - 210, '#2a2428');
    for (let i = 0; i < 3; i++) { const x = 70 + i * 220; R(ctx, x, 214, 70, 22, '#3a4030'); R(ctx, x + 46, 206, 24, 14, '#3a4030'); R(ctx, x + 6, 234, 12, 8, '#14141a'); R(ctx, x + 50, 234, 12, 8, '#14141a'); }
    for (let r = 0; r < 3; r++) for (let x = 30 + r * 8; x < SW - 20; x += 22) figure(ctx, x, 246 + r * 4 - ((Math.floor(t / 40) + x) % 7 === 0 ? 1 : 0), 1.3, '#14160e');
    text(ctx, '夜明け前', 20, 16, { size: 12, color: '#e8d0b8' });
  },
  // a late meeting in a back room: a lamp, a map on the table, a few silhouettes (no faces)
  plot(ctx, t) {
    R(ctx, 0, 0, SW, ART_H, '#0a0a10');
    R(ctx, 120, 60, 400, 150, '#14121a'); R(ctx, 120, 60, 400, 4, '#2a2630');
    R(ctx, 190, 150, 260, 14, '#3a2a20'); R(ctx, 190, 164, 260, 4, '#241a14');
    R(ctx, 220, 138, 200, 12, '#d8ccb0'); for (let i = 0; i < 5; i++) R(ctx, 230 + i * 36, 140, 4, 4, i % 2 ? '#b02a2a' : '#2a4a8a');
    R(ctx, 314, 100, 12, 36, '#3a3a40'); R(ctx, 302, 94, 36, 10, '#f0c878');
    ctx.globalAlpha = 0.18 + 0.04 * Math.sin(t / 20); R(ctx, 240, 100, 160, 100, '#f0c878'); ctx.globalAlpha = 1;
    for (const [x, s] of [[170, 3], [250, 3.1], [390, 3.1], [470, 3]]) figure(ctx, x, 196, s, '#05050a');
  },
  // a review: ranks of far-off soldiers on a wide avenue, banners, a stand at the right
  parade(ctx, t) {
    sky(ctx, '#7a8aa0', '#c8cfd8');
    skyline(ctx, 110, '#6a7488', 9, 20, 70, 22);
    R(ctx, 0, 110, SW, ART_H - 110, '#8a8678');
    for (let x = 0; x < SW; x += 40) R(ctx, x, 214, 24, 3, '#a8a496');
    R(ctx, 470, 86, 150, 40, '#5a3a30'); R(ctx, 470, 80, 150, 8, '#8a2a2a');
    for (let i = 0; i < 6; i++) figure(ctx, 490 + i * 20, 122, 1.2, '#1a1214');
    for (let r = 0; r < 5; r++) {
      const y = 140 + r * 18, off = (t * 0.5) % 24;
      for (let c = 0; c < 18; c++) figure(ctx, 20 + c * 24 + off - 24, y + (Math.floor(t / 12 + c) % 2), 1.5 + r * 0.15, '#2a3020', 0);
    }
    for (let i = 0; i < 4; i++) flag(ctx, 70 + i * 140, 20, t + i * 9, '#a82a2a');
  },
  // the cult of personality: a giant portrait frame (no face is drawn: an empty oval and a collar), banners, a statue, the crowd waving
  portrait(ctx, t) {
    sky(ctx, '#8a6a50', '#e8c898');
    skyline(ctx, 130, '#7a6a5a', 5, 20, 60, 22);
    R(ctx, 190, 20, 260, 190, '#6a2a2a'); R(ctx, 198, 28, 244, 174, '#d8c8a8');
    R(ctx, 290, 50, 60, 80, '#c8b898'); R(ctx, 270, 130, 100, 60, '#3a3a48'); R(ctx, 316, 130, 8, 30, '#f0ece0');
    for (let i = 0; i < 2; i++) { const x = 40 + i * 530; R(ctx, x, 30, 60, 130, '#a82a2a'); text(ctx, '万歳', x + 30, 80, { size: 14, align: 'center', color: '#f2e8b0', shadow: null }); }
    R(ctx, 530, 140, 60, 14, '#4a4038'); R(ctx, 548, 80, 24, 60, '#2a2628'); R(ctx, 540, 66, 40, 16, '#2a2628');
    R(ctx, 0, 210, SW, ART_H - 210, '#b0a088');
    crowd(ctx, 0, SW, 214, ART_H - 4, 47, t, ['#3a2a2a', '#4a3a34', '#2a2024'], 0.4);
  },
  // the plan: factories with chimneys and smoke, a long line of rail cars
  factory(ctx, t) {
    sky(ctx, '#7a8ea4', '#c8d0d8');
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 124;
      R(ctx, x, 120, 100, 90, i % 2 ? '#6a6a72' : '#5a5a64'); R(ctx, x + 8, 100, 14, 24, '#4a4a52'); R(ctx, x + 70, 90, 12, 34, '#4a4a52');
      for (let k = 0; k < 3; k++) { const px = x + 76 + Math.sin((t + k * 40) / 30) * 6, py = 70 - k * 14 - ((t / 3 + k * 10) % 30) * 0.4; R(ctx, px, py, 18 + k * 4, 10, `rgba(80,80,88,${0.5 - k * 0.12})`); }
      for (let w = 0; w < 4; w++) R(ctx, x + 10 + w * 22, 140, 12, 10, '#e8d098');
    }
    R(ctx, 0, 210, SW, ART_H - 210, '#4a4640');
    R(ctx, 0, 226, SW, 4, '#2a2622');
    for (let i = 0; i < 6; i++) { const x = ((i * 120 + t * 0.6) % (SW + 120)) - 100; R(ctx, x, 214, 100, 12, '#6a3a2a'); R(ctx, x + 4, 226, 8, 4, '#14100e'); R(ctx, x + 84, 226, 8, 4, '#14100e'); }
  },
  // the war's home front: a queue in front of a shop, a poster on the wall (no one is hurt)
  ration(ctx, t) {
    sky(ctx, '#6a727e', '#a8aeb6');
    R(ctx, 0, 100, SW, ART_H - 100, '#7a766c');
    R(ctx, 60, 80, 220, 130, '#a89c80'); R(ctx, 60, 74, 220, 8, '#6a3a2a');
    R(ctx, 96, 120, 60, 90, '#3a2e26'); R(ctx, 168, 128, 90, 36, '#c8c4b0');
    text(ctx, '配給所', 170, 106, { size: 14, color: '#2a2018', shadow: null });
    R(ctx, 340, 64, 120, 80, '#d8cdb0'); text(ctx, '一致団結', 400, 92, { size: 14, align: 'center', color: '#8a2a2a', shadow: null });
    text(ctx, 'がまんして 勝つまでは', 400, 116, { size: 10, align: 'center', color: '#3a2a20', shadow: null });
    R(ctx, 0, 210, SW, ART_H - 210, '#5a564e');
    for (let i = 0; i < 16; i++) figure(ctx, 600 - i * 22, 232 + (i % 2) * 6, 2.2, i % 3 ? '#1c1a22' : '#2a2630', 0);
  },
});
