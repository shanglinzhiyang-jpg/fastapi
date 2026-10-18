// テレビ朝日（港エリア）— ピンクがトレードマークのテレビ局
//
// 部屋：
//   lobby    エントランス   受付（番組の出演依頼＝programDesk）・セキュリティゲート・待合スペース・
//                          大型ビジョンとオンエアモニター・大きなロゴ
//   corridor スタジオ廊下  楽屋・スタジオA（クイズ）・トークスタジオへのドア、上の階へのエレベーター
//   gakuya   楽屋          メイク台の鏡（身だしなみ）・畳でひと休み（体力・ストレス）・メイクさん
//   studio   スタジオA     クイズのセット（解答席・司会台・大型ビジョン）と観覧席
//   talk     トークスタジオ 長〜いひな壇のベンチがある、大きなトーク番組のセット
//
// お仕事（すべて架空。実在の番組・出演者は出さない）：
//   段階0  前説（トークスタジオのAD）           talk d1（前説の場面）
//   段階1  クイズ番組の解答者（スタジオA）       quiz d2   所属 または ★30
//   段階1  トーク番組のひな壇ゲスト（トーク）    talk d2   所属 または ★30
//   ほか   番組観覧（1日1回・無料・ストレス -10）、楽屋の鏡・畳（1日1回）
// 1回きりのイベント：はじめての入館（受付のあいさつ）、ゲートで入館証、
//                    トークスタジオで「前説の人が来ない！」

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, Rw, Pw, pix, oval, line, bevel, outline, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, mix } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

const PID = 'tvasahi';
const T = (k) => `${PID}_${k}`;

// ====================================================================== palette
const PK = '#ec0f7c';
const PKD = '#b30a5d';
const PKX = '#7a063f';
const PKL = '#ff5ea8';
const PKP = '#ffd3e7';
const WHT = '#ffffff';
const OFF = '#f7f3f5';
const LG = '#e6dfe3';
const MG = '#c9c0c6';
const DG = '#857b84';
const INK = '#22202a';
const PLUM = '#3d2a36';

const today = (g, k) => g.flag(k) === g.state.day;
const markToday = (g, k) => g.setFlag(k, g.state.day);
const as = (npc) => ({ name: npc.name, look: npc.look });
const RND = (r, n) => Math.floor(r() * n);

// ====================================================================== tile helpers
// A tile defined by its native 32x32 painter; the 16px art is the same picture sampled down.
function tile(k, opt, hd) {
  defineTile(T(k), {
    ...opt,
    hd,
    draw(c, r, f, v) {
      const [cv, cc] = makeCanvas(32, 32);
      hd(cc, r, f, v);
      c.drawImage(cv, 0, 0, 16, 16);
    },
  });
}
// Multi-tile art: paint(c, frame) draws one (w*32)x(h*32) picture, cut into tiles
// T(`${k}_${x}_${y}`). Outlines are drawn on the whole picture, so there are no seams.
const BIG = new Map();
function bigArt(k, w, h, f, paint) {
  const key = k + '|' + f;
  let cv = BIG.get(key);
  if (!cv) {
    let c;
    [cv, c] = makeCanvas(w * 32, h * 32);
    paint(c, f);
    BIG.set(key, cv);
  }
  return cv;
}
function bigTiles(k, w, h, opt, paint) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      tile(`${k}_${x}_${y}`, opt, (c, r, f) => c.drawImage(bigArt(k, w, h, f || 0, paint), x * 32, y * 32, 32, 32, 0, 0, 32, 32));
    }
  }
}
// Static 2x picture for props: drawn at (sx, sy) with size w x h units.
const BAKED = new Map();
function baked(key, w, h, paint) {
  let cv = BAKED.get(key);
  if (!cv) {
    let c;
    [cv, c] = makeCanvas(w * 2, h * 2);
    paint(c);
    BAKED.set(key, cv);
  }
  return cv;
}
const blit = (ctx, cv, x, y) => ctx.drawImage(cv, Math.round(x * 2) / 2, Math.round(y * 2) / 2, cv.width / 2, cv.height / 2);

// "ON AIR" in a 5px pixel font
const ONAIR = [
  '###.#..#..###.#.##.',
  '#.#.##.#..#.#.#.#.#',
  '#.#.#.##..###.#.##.',
  '#.#.#..#..#.#.#.#.#',
  '###.#..#..#.#.#.#.#',
];
const QMARK = ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'];

// ====================================================================== tiles
// --- walls & floors
tile('walltop', { solid: true }, (c) => R(c, 0, 0, 32, 32, PLUM));
function wallFace(c, lip, band) {
  R(c, 0, 0, 32, 32, OFF);
  R(c, 15, 0, 1, 32, '#ece5e9'); R(c, 16, 0, 1, 32, '#fdfbfc'); R(c, 31, 0, 1, 32, '#e4dce1');
  if (lip) { R(c, 0, 0, 32, 1, MG); R(c, 0, 1, 32, 1, WHT); }
  if (band) {
    R(c, 0, 13, 32, 3, PK); R(c, 0, 13, 32, 1, PKL); R(c, 0, 16, 32, 1, PKD);
    R(c, 0, 26, 32, 6, '#5a4652'); R(c, 0, 26, 32, 1, '#33242e'); R(c, 0, 27, 32, 1, '#7a6470'); R(c, 0, 31, 32, 1, '#2c1f28');
  }
}
tile('wall_u', { solid: true }, (c) => wallFace(c, true, false));
tile('wall2', { solid: true }, (c) => wallFace(c, false, true));
tile('wall', { solid: true }, (c) => wallFace(c, true, true));

function marble(c, r, v) {
  R(c, 0, 0, 32, 32, '#f5f0f3');
  for (let i = 0; i < 3; i++) {
    let x = RND(r, 32), y = RND(r, 32);
    for (let k = 0; k < 10; k++) { Pw(c, x, y, k % 3 ? '#ece3e8' : '#e6dbe1'); x += 1; y += RND(r, 3) - 1; }
  }
  R(c, 0, 0, 32, 1, '#e4d9df'); R(c, 0, 0, 1, 32, '#e4d9df');
  if (v === 0) { R(c, 5, 5, 6, 1, WHT); R(c, 5, 6, 1, 3, WHT); }
  if (v === 2) { R(c, 20, 21, 5, 1, WHT); P(c, 24, 20, WHT); }
}
tile('floor', { variants: 4 }, (c, r, f, v) => marble(c, r, v));
// gate lane: floor with guide lines and an arrow toward the studios
const ARROW = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'];
tile('lane', {}, (c, r) => {
  marble(c, r, 1);
  R(c, 1, 0, 2, 32, '#e1d6dc'); R(c, 29, 0, 2, 32, '#e1d6dc');
  pix(c, ARROW, { '#': '#f3b9d3' }, 13, 12);
});
function runner(c, r, left) {
  R(c, 0, 0, 32, 32, PK);
  for (let i = 0; i < 40; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#e00a74' : '#f3268a');
  const e = left ? 0 : 27;
  R(c, e, 0, 5, 32, PKD); R(c, left ? 5 : 26, 0, 1, 32, PKL);
  R(c, left ? 1 : 29, 0, 1, 32, '#d1a33a');
}
tile('run_l', {}, (c, r) => runner(c, r, true));
tile('run_r', {}, (c, r) => runner(c, r, false));

// --- lobby furniture
tile('counter', { solid: true, obj: true, talkThrough: true, variants: 3 }, (c, r, f, v) => {
  R(c, 0, 3, 32, 13, WHT); R(c, 0, 4, 32, 1, '#f3edf0'); R(c, 0, 13, 32, 1, '#f6f1f4'); R(c, 0, 14, 32, 2, '#ddd3d9');
  R(c, 0, 16, 32, 16, PK); R(c, 0, 16, 32, 2, PKD); R(c, 0, 19, 32, 1, PKL);
  R(c, 0, 23, 32, 2, PKP); R(c, 0, 28, 32, 2, PKD); R(c, 0, 30, 32, 2, PKX);
  if (v === 1) {
    R(c, 17, 0, 12, 10, INK); R(c, 18, 1, 10, 7, '#7fd8ff'); R(c, 18, 1, 10, 1, '#c8f0ff'); R(c, 20, 4, 5, 1, '#3a8ab8');
    R(c, 21, 10, 4, 3, DG);
  }
  if (v === 2) {
    R(c, 4, 7, 10, 6, '#fff7e0'); R(c, 5, 8, 8, 1, MG); R(c, 5, 10, 6, 1, MG);
    oval(c, 19, 8, 7, 5, '#e8c43a'); R(c, 21, 7, 3, 1, '#fff6a8'); R(c, 19, 12, 7, 1, '#b08a1a');
  }
  outline(c);
});
tile('gate', { solid: true, obj: true, frames: 2, speed: 40 }, (c, r, f) => {
  shadowEllipse(c, 16, 29, 9, 2);
  c.fillStyle = 'rgba(190,228,255,0.6)';
  c.fillRect(3, 13, 6, 9); c.fillRect(23, 13, 6, 9);
  R(c, 3, 13, 6, 1, '#f0faff'); R(c, 23, 13, 6, 1, '#f0faff');
  bevel(c, 9, 5, 14, 24, '#c9ced8');
  R(c, 9, 5, 14, 6, '#eef1f5'); R(c, 9, 5, 14, 1, WHT);
  R(c, 11, 6, 10, 4, '#3b3f48'); R(c, 12, 7, 8, 1, '#5a5f6b'); P(c, 19, 8, f ? '#5ee07a' : '#2f9a4a');
  R(c, 10, 13, 12, 1, PK);
  R(c, 12, 16, 8, 4, INK); R(c, 13, 17, 6, 2, f ? '#5ee07a' : '#2f9a4a');
  R(c, 9, 25, 14, 4, '#8e94a0'); R(c, 9, 25, 14, 1, '#a9aeb8');
  outline(c);
});
// N-S glass partition (seen edge-on): a slim glass pane with steel caps
tile('glass_v', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 5, 1);
  c.fillStyle = 'rgba(190,228,255,0.55)'; c.fillRect(13, 0, 6, 30);
  R(c, 14, 0, 1, 30, 'rgba(255,255,255,0.85)');
  R(c, 12, 28, 8, 3, '#9aa0aa'); R(c, 12, 28, 8, 1, '#c3c8d2');
  R(c, 18, 0, 1, 28, '#9fb8cc');
});
function sofaPaint(c, col) {
  shadowEllipse(c, 16, 28, 16, 2);
  const back = shade(col, -0.22);
  R(c, 0, 4, 32, 12, back); R(c, 0, 4, 32, 1, shade(col, 0.2)); R(c, 0, 5, 32, 1, shade(col, 0.05));
  for (const x of [8, 24]) { P(c, x, 9, shade(col, -0.45)); P(c, x, 10, shade(back, 0.15)); }
  R(c, 0, 14, 32, 12, col); R(c, 0, 14, 32, 2, shade(col, 0.3)); R(c, 0, 16, 32, 1, shade(col, 0.12));
  R(c, 15, 14, 1, 12, shade(col, -0.2)); R(c, 16, 14, 1, 12, shade(col, 0.12));
  R(c, 0, 24, 32, 2, shade(col, -0.15)); R(c, 0, 26, 32, 2, shade(col, -0.45));
  outline(c);
}
tile('sofa', { solid: true, obj: true }, (c) => sofaPaint(c, '#f07aae'));

// --- the big video wall (3 x 2 tiles, 3 programmes in turn)
function paintVision(c, f) {
  R(c, 0, 3, 96, 59, '#1a1420'); R(c, 0, 3, 96, 1, '#3b2f3a'); R(c, 0, 61, 96, 1, '#0e0a12');
  const x0 = 4, y0 = 7, w = 88, h = 50;
  if (f === 0) {
    // variety studio: pink set, lights and three guests
    for (let y = 0; y < h; y++) R(c, x0, y0 + y, w, 1, mix('#5a0c36', '#ff6fae', y / h));
    for (let i = 0; i < 6; i++) { R(c, x0 + 6 + i * 15, y0 + 2, 3, 3, '#fff6a8'); line(c, x0 + 7 + i * 15, y0 + 5, x0 + 2 + i * 17, y0 + 32, 'rgba(255,246,168,0.35)'); }
    R(c, x0, y0 + 36, w, 14, '#f4e6ee'); R(c, x0, y0 + 36, w, 1, WHT);
    for (const [px, col] of [[22, '#ffd23f'], [44, '#5fd7ff'], [66, '#5ee07a']]) {
      oval(c, x0 + px - 5, y0 + 18, 10, 10, '#ffe0c4'); R(c, x0 + px - 5, y0 + 17, 10, 4, '#3b2a20');
      R(c, x0 + px - 7, y0 + 28, 14, 10, col); R(c, x0 + px - 7, y0 + 28, 14, 1, shade(col, 0.4));
      P(c, x0 + px - 2, y0 + 23, INK); P(c, x0 + px + 2, y0 + 23, INK);
      R(c, x0 + px - 1, y0 + 25, 3, 1, '#d6455a');
    }
    R(c, x0 + 4, y0 + 40, 40, 7, PK); R(c, x0 + 6, y0 + 42, 36, 1, WHT); R(c, x0 + 6, y0 + 44, 24, 1, PKP);
  } else if (f === 1) {
    // location footage: mountains, a river and a lunch box
    for (let y = 0; y < 26; y++) R(c, x0, y0 + y, w, 1, mix('#7fd0ff', '#d8f2ff', y / 26));
    oval(c, x0 + 66, y0 + 5, 12, 12, '#fff2a0');
    for (let x = 0; x < w; x++) {
      const m1 = 22 - Math.round(10 * Math.abs(Math.sin((x + 8) / 14)));
      const m2 = 30 - Math.round(7 * Math.abs(Math.sin((x + 30) / 9)));
      R(c, x0 + x, y0 + m1, 1, 30 - m1, '#4f8a5a');
      R(c, x0 + x, y0 + m2, 1, h - m2, '#6cbf5f');
    }
    for (let y = 30; y < h; y++) R(c, x0 + 30 + Math.round((y - 30) * 0.8), y0 + y, 10 + (y - 30), 1, '#5fb0f0');
    R(c, x0 + 58, y0 + 34, 24, 12, '#c9332b'); R(c, x0 + 60, y0 + 36, 20, 8, '#f6f1e2');
    oval(c, x0 + 62, y0 + 37, 6, 5, '#ff9a3c'); R(c, x0 + 70, y0 + 37, 8, 3, '#5ec26a'); R(c, x0 + 70, y0 + 41, 8, 2, '#f0c040');
    R(c, x0 + 2, y0 + 41, 30, 7, 'rgba(0,0,0,0.5)'); R(c, x0 + 4, y0 + 43, 22, 1, WHT); R(c, x0 + 4, y0 + 45, 14, 1, PKP);
  } else {
    // station ident: pink waves and ON AIR
    for (let y = 0; y < h; y++) R(c, x0, y0 + y, w, 1, mix('#ffffff', '#ffd3e7', y / h));
    for (let k = 0; k < 3; k++) {
      for (let x = 0; x < w; x++) {
        const y = 30 + k * 6 + Math.round(4 * Math.sin((x + k * 9) / 8));
        R(c, x0 + x, y0 + y, 1, h - y, [PKL, PK, PKD][k]);
      }
    }
    R(c, x0 + 24, y0 + 9, 41, 13, PK); R(c, x0 + 24, y0 + 9, 41, 1, PKL);
    pix(c, ONAIR, { '#': WHT }, x0 + 35, y0 + 13);
    P(c, x0 + 28, y0 + 15, WHT); P(c, x0 + 60, y0 + 15, WHT);
  }
  // bezel & live dot
  R(c, x0 - 1, y0 - 1, w + 2, 1, '#2c2430'); R(c, x0 - 1, y0 + h, w + 2, 1, '#4a3f4a');
  R(c, 84, 58, 3, 2, '#ff2b3a'); R(c, 6, 58, 20, 1, '#5a4f5a');
  outline(c);
}
bigTiles('vision', 3, 2, { solid: true, obj: true, frames: 3, speed: 150 }, paintVision);

// --- studio floor & sets
tile('sfloor', { variants: 16 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2c2631');
  for (let i = 0; i < 26; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#332c39' : '#28222c');
  R(c, 0, 0, 32, 1, '#352e3b'); R(c, 0, 0, 1, 32, '#352e3b');
  if (v === 0) { R(c, 8, 14, 12, 2, '#e8c43a'); R(c, 13, 9, 2, 12, '#e8c43a'); }
  if (v === 1) { R(c, 6, 18, 8, 2, PKL); R(c, 6, 18, 2, 7, PKL); }
  if (v === 2) R(c, 22, 6, 2, 2, '#4a4252');
});
function setWall(c, f, upper) {
  for (let y = 0; y < 32; y++) R(c, 0, y, 32, 1, upper ? mix('#3a0f2a', '#8a1456', y / 31) : mix('#8a1456', '#c21a6e', y / 31));
  for (const x of [7, 23]) { R(c, x - 1, 0, 1, 32, '#b4286e'); R(c, x, 0, 2, 32, '#ff7ab8'); R(c, x + 2, 0, 1, 32, '#b4286e'); }
  if (upper) {
    R(c, 0, 0, 32, 1, '#22091a');
    for (let i = 0; i < 4; i++) { const on = (i + f) % 2 === 0; R(c, 2 + i * 8, 4, 3, 3, on ? '#fff6a8' : '#a0587a'); if (on) P(c, 3 + i * 8, 4, WHT); }
  } else {
    R(c, 0, 18, 32, 2, '#ffd0e4'); R(c, 0, 20, 32, 1, '#a0105a');
    R(c, 0, 26, 32, 6, '#2a1020'); R(c, 0, 26, 32, 1, PKL); R(c, 0, 31, 32, 1, '#180812');
  }
}
tile('set_u', { solid: true, frames: 2, speed: 30 }, (c, r, f) => setWall(c, f, true));
tile('set', { solid: true }, (c) => setWall(c, 0, false));
function qWall(c, v, lower) {
  R(c, 0, 0, 32, 32, WHT);
  for (let k = -32; k < 64; k += 12) for (let i = 0; i < 6; i++) Rw(c, k + i, 31 - i * 6, 6, 6, '#ffe3ef');
  R(c, 0, 0, 32, 1, MG);
  if (!lower && v === 0) { R(c, 9, 6, 15, 17, PK); R(c, 9, 6, 15, 1, PKL); pix(c, QMARK, { '#': WHT }, 14, 10); }
  if (lower) {
    R(c, 0, 14, 32, 2, PK);
    R(c, 0, 26, 32, 6, '#5a4652'); R(c, 0, 26, 32, 1, '#33242e'); R(c, 0, 27, 32, 1, '#7a6470');
  }
}
tile('qwall_u', { solid: true, variants: 3 }, (c, r, f, v) => qWall(c, v, false));
tile('qwall', { solid: true }, (c) => qWall(c, 1, true));
tile('booth', { solid: true, obj: true, talkThrough: true, frames: 2, speed: 36 }, (c, r, f) => {
  shadowEllipse(c, 16, 29, 14, 2);
  R(c, 2, 9, 28, 6, '#f6f1f4'); R(c, 2, 9, 28, 1, WHT); R(c, 2, 14, 28, 1, LG);
  R(c, 2, 15, 28, 14, PK); R(c, 2, 15, 28, 2, PKL); R(c, 2, 27, 28, 2, PKD);
  R(c, 8, 18, 16, 7, WHT); R(c, 9, 19, 14, 5, '#ffeef6'); R(c, 11, 21, 10, 1, PKD);
  R(c, 13, 2, 6, 7, f ? '#ff2b6a' : '#9a1040'); R(c, 13, 2, 6, 2, f ? '#ffb0c8' : '#c83a6a');
  outline(c);
});
tile('podium', { solid: true, obj: true, talkThrough: true }, (c) => {
  shadowEllipse(c, 16, 29, 10, 2);
  R(c, 7, 9, 18, 4, WHT); R(c, 7, 13, 18, 16, PLUM); R(c, 7, 13, 18, 1, '#5a4652');
  R(c, 10, 17, 12, 6, PK); R(c, 11, 18, 10, 1, PKL);
  R(c, 20, 2, 1, 8, '#9aa0aa'); R(c, 19, 1, 3, 3, INK);
  outline(c);
});

// --- talk studio: the long bench, the riser and the host desk
function benchPaint(c, part, v) {
  const x0 = part === 'l' ? 3 : 0, x1 = part === 'r' ? 29 : 32, w = x1 - x0;
  shadowEllipse(c, 16, 30, 16, 1);
  R(c, x0, 3, w, 14, '#d81b72'); R(c, x0, 3, w, 2, '#ff7ab8'); R(c, x0, 5, w, 1, '#f0408e'); R(c, x0, 15, w, 2, '#a01058');
  for (let x = x0 + 4; x < x1 - 2; x += 8) { P(c, x, 9, '#8a0c48'); P(c, x + 1, 9, '#ff9ac8'); P(c, x + 4, 12, '#8a0c48'); }
  R(c, x0, 17, w, 7, PKL); R(c, x0, 17, w, 1, '#ffc2dc'); R(c, x0, 23, w, 1, '#c2307a');
  R(c, x0, 24, w, 5, '#f4f0f2'); R(c, x0, 24, w, 1, WHT); R(c, x0, 26, w, 1, PKL); R(c, x0, 28, w, 1, MG);
  if (part === 'm' && v === 1) { R(c, 31, 3, 1, 14, '#a01058'); R(c, 31, 17, 1, 7, '#c2307a'); }
  if (part === 'l') { R(c, 0, 9, 5, 17, '#b0105c'); R(c, 0, 9, 5, 2, '#ff7ab8'); R(c, 0, 25, 5, 1, '#7a063f'); }
  if (part === 'r') { R(c, 27, 9, 5, 17, '#b0105c'); R(c, 27, 9, 5, 2, '#ff7ab8'); R(c, 27, 25, 5, 1, '#7a063f'); }
  outline(c);
}
tile('bench_l', { solid: true, obj: true }, (c) => benchPaint(c, 'l', 0));
tile('bench_m', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => benchPaint(c, 'm', v));
tile('bench_r', { solid: true, obj: true }, (c) => benchPaint(c, 'r', 0));
tile('riser', { variants: 2 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#efe9ed');
  for (let i = 0; i < 14; i++) Pw(c, RND(r, 32), RND(r, 25), '#e6dee3');
  R(c, 0, 0, 1, 25, '#e2d9df');
  R(c, 0, 25, 32, 7, '#d4cad0'); R(c, 0, 25, 32, 1, WHT); R(c, 0, 28, 32, 1, v ? PK : PKL); R(c, 0, 31, 32, 1, '#a89aa3');
});
function paintHostDesk(c) {
  shadowEllipse(c, 32, 29, 30, 2);
  oval(c, 2, 6, 60, 14, '#f8f4f6'); oval(c, 4, 7, 56, 10, WHT);
  R(c, 3, 13, 58, 15, PK); R(c, 3, 13, 58, 2, PKL); R(c, 3, 26, 58, 2, PKD);
  R(c, 10, 18, 44, 4, PKP); R(c, 10, 18, 44, 1, WHT);
  R(c, 14, 6, 9, 5, '#fff7e0'); R(c, 15, 7, 7, 1, MG); R(c, 44, 1, 1, 8, '#9aa0aa'); R(c, 43, 0, 3, 3, INK);
  outline(c);
}
bigTiles('hdesk', 2, 1, { solid: true, obj: true, talkThrough: true }, paintHostDesk);
// noren curtain hanging in the 楽屋 door
tile('noren', { obj: true }, (c) => {
  R(c, 2, 1, 28, 2, '#5a3a20'); R(c, 2, 1, 28, 1, '#8a6040');
  R(c, 3, 3, 26, 15, PK); R(c, 3, 3, 26, 1, PKL); R(c, 3, 17, 26, 1, PKD);
  R(c, 11, 4, 1, 14, PKX); R(c, 20, 4, 1, 14, PKX);
  oval(c, 13, 6, 6, 6, WHT); oval(c, 14, 7, 4, 4, PK);
  outline(c);
});

// ====================================================================== props
// Name plate above a door (w tiles wide, drawn in the wall face row).
function plate(x, y, label, w = 3) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      blit(ctx, baked('plate|' + label + '|' + w, w * 16, 13, (c) => {
        const W = w * 32;
        R(c, 0, 2, W, 22, PLUM); R(c, 1, 3, W - 2, 20, '#5a3d4e'); R(c, 1, 3, W - 2, 1, '#7a5a6c');
        R(c, 1, 20, W - 2, 3, PK);
        text(c, label, W / 2, 5, { size: 14, align: 'center', color: WHT, shadow: '#22101a' });
        outline(c);
      }), sx, sy + 1);
    },
  };
}
// The talk studio's big neon sign (on the set wall).
function talkSign(x, y) {
  const w = 6, h = 1.6;
  const paint = (on) => (c) => {
    const W = w * 32, Hh = Math.round(h * 32);
    R(c, 2, 2, W - 4, Hh - 4, '#22091a'); R(c, 3, 3, W - 6, Hh - 6, '#3a0f2a');
    R(c, 3, 3, W - 6, 1, '#5a1a42');
    for (let i = 0; i < 16; i++) {
      const bx = 8 + i * ((W - 18) / 15);
      R(c, Math.round(bx), 6, 3, 3, (i % 2 === 0) === on ? '#fff6a8' : '#8a4a6a');
      R(c, Math.round(bx), Hh - 9, 3, 3, (i % 2 === 1) === on ? '#fff6a8' : '#8a4a6a');
    }
    text(c, 'TALK STUDIO', W / 2, 14, { size: 20, align: 'center', color: on ? '#ffb8da' : PKL, outline: PKX });
    outline(c);
  };
  return {
    type: 'prop', x, y, w, h: 2, solid: false,
    draw(ctx, sx, sy, g) {
      const on = Math.floor(g.frame / 30) % 2 === 0;
      blit(ctx, baked('talksign|' + on, w * 16, h * 16, paint(on)), sx, sy);
    },
  };
}

// ====================================================================== characters
const L = {
  recep: { ...LOOKS.receptionist, top: PK, bottom: '#3b2733' },
  recep2: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: PK, bottom: '#3b2733' },
  guard: LOOKS.guard,
  ad: { ...LOOKS.ad, top: '#ff6fae' },
  ad2: { ...LOOKS.ad, hair: 'cap', hat: PLUM, hairColor: 'black', top: '#5a6f8a' },
  director: { ...LOOKS.director, hat: PK },
  fd: { ...LOOKS.staff, hat: PK, top: '#2a2d36' },
  producer: { ...LOOKS.manager, tie: PK, top: '#3d2a36', bottom: '#3d2a36' },
  makeup: { ...LOOKS.makeup, hairColor: 'brown', top: '#3b2733' },
  manager: { ...LOOKS.salaryman, top: '#5a4652', bottom: '#3b2733', tie: '#ff6fae' },
  caterer: { ...LOOKS.chef, top: WHT, bottom: '#5a4652' },
  geinin: { ...LOOKS.comedian, top: '#ffd23f', bottom: '#2a3560' },
  model: { ...LOOKS.idol, hair: 'long', hairColor: 'brown', top: '#f2f2f2', bottom: '#2a2430' },
  veteran: { ...LOOKS.actor, hairColor: 'silver', tie: PK },
  idol: { ...LOOKS.idol, top: '#ff9ac8' },
  student: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#3a58a8', bottom: '#2a2d36', glasses: true },
  housewife: { ...LOOKS.mom, top: '#5ec26a' },
  oldman: { ...LOOKS.oldman, top: '#c0452f' },
  cameraman: LOOKS.cameraman,
  fan: LOOKS.fan,
  granny: LOOKS.oldwoman,
  kid: { ...LOOKS.kid, top: '#ff7eb6' },
  stand: { ...LOOKS.ad, hair: 'short', hairColor: 'black', top: '#3d2a36', tie: PK, jacket: true },
};
const SP = {
  recep: { name: '受付さん', look: L.recep },
  guard: { name: '警備員さん', look: L.guard },
  ad: { name: 'AD', look: L.ad },
  makeup: { name: 'メイクさん', look: L.makeup },
};

// ====================================================================== content tables
const MAESETSU_SCENES = [
  { prompt: '収録30分前。客席は、まだ少しかたい空気だ…', answers: [{ text: '「みなさん、今日はどちらから？」', score: 100 }, { text: '「えー、本日は晴天なり」', score: 40 }, { text: '（無言で腕を組む）', score: 0 }] },
  { prompt: 'ディレクター「拍手の練習、お願いしまーす！」', answers: [{ text: '「せーの！…最高！もう一回！」', score: 100 }, { text: '「てきとうに叩いてください」', score: 30 }, { text: '（自分だけ拍手する）', score: 10 }] },
  { prompt: 'おばあちゃん「わたし、テレビに映るかしら？」', answers: [{ text: '「バッチリです！笑顔でお願いします」', score: 100 }, { text: '「後頭部なら、たぶん…」', score: 50 }, { text: '「映らないです」', score: 0 }] },
  { prompt: 'こども「ねえ、本番まだー？」', answers: [{ text: '「あと5分！その元気、とっといてね」', score: 100 }, { text: '「まだだよ」', score: 40 }, { text: '「静かにしなさい」', score: 0 }] },
  { prompt: '本番10秒前。最後のひと言は？', answers: [{ text: '「最高の笑い声、お願いします！」', score: 100 }, { text: '「えっと…がんばります」', score: 40 }, { text: '「寝ないでくださいね」', score: 30 }] },
];
const QUIZ = [
  { q: 'テレビ局で「巻き」といえば？', choices: ['予定より早く進める', 'お弁当ののり巻き', 'ケーブルを片づける', '衣装を着がえる'], answer: 0 },
  { q: '本番前にお客さんをあたためるのは？', choices: ['前説', '後説', '中説', '横説'], answer: 0 },
  { q: '出演者に指示を見せる紙は？', choices: ['カンペ', 'カンパ', 'カンプ', 'カンポ'], answer: 0 },
  { q: '番組の「ひな壇」とは？', choices: ['ゲストが並ぶ段々の席', 'ひな人形の売り場', '照明の足場', '楽屋の二段ベッド'], answer: 0 },
  { q: '収録がおしているとき、スケジュールは？', choices: ['遅れている', '早まっている', '中止になった', '順調そのもの'], answer: 0 },
];

// ====================================================================== flows
// Exit: back to the building's door in town. Until the building is placed in a town
// (no door yet), walk out of the home door instead so the player is never stuck.
async function leave(g) {
  if (doorIndexFor(PID)) return true;
  const home = doorIndexFor('home');
  if (!home) return true;
  await g.goto(home.town, home.room, home.x, home.y - 1, 'up');
  g.save(true);
  return false; // the map then takes one step "back" (down): out of the door
}
const exitWarps = (xs, y) => xs.map((x) => ({ x, y, to: 'exit', check: leave }));

const TIER1 = { anyOf: [{ agency: true }, { fame: 30 }], anyOfText: '事務所に所属するか、★30になると呼んでもらえます。' };

async function maesetsuJob(g, npc, confirm = true) {
  return g.job({
    confirm,
    id: 'tvasahi_maesetsu', title: 'トーク番組の前説', desc: '本番前の客席をあたためよう！', client: npc.name, clientLook: npc.look,
    stamina: 15, minigame: 'talk', opts: { difficulty: 1, topic: '前説', scenes: MAESETSU_SCENES, set: 'variety' },
    pay: 1200, fame: 5, skill: 'talk', gain: 1,
  });
}

async function maesetsuTalk(g, npc) {
  const s = as(npc);
  await g.say(['AD歴2年、前説の段取りならおまかせです！', '前説っていうのは、本番前にお客さんの拍手や笑いをあたためるお仕事。だれでも大歓迎ですよ！'], s);
  const res = await maesetsuJob(g, npc);
  if (res && (res.rank === 'S' || res.rank === 'A')) await g.say('客席、あったまりまくりです！\n本番の笑い声、いつもの1.5倍でしたよ！', s);
  else if (res) await g.say('おつかれさまでした！\n前説は回数をこなすほど、うまくなりますよ。', s);
}

async function hinadanTalk(g, npc) {
  const s = as(npc);
  await g.say(['ひな壇のゲストは、リアクションが命！', '前のめりで、0.5秒で返す。それができればあなたも立派な「ひな壇の住人」です。'], s);
  await g.job({
    id: 'tvasahi_hinadan', title: 'トーク番組のひな壇ゲスト', desc: '長いベンチから、話をどんどん広げよう！', client: npc.name, clientLook: npc.look,
    stamina: 20, minigame: 'talk', opts: { difficulty: 2, topic: 'variety', show: 'TALK STUDIO' },
    pay: 4500, fame: 18, skill: 'talk', gain: 2, requires: TIER1,
  });
}

async function quizTalk(g, npc) {
  const s = as(npc);
  await g.say(['クイズ番組の解答者、ひと枠空いてるんだよね。', 'テレビの裏側から一般常識まで、はば広く出るよ。'], s);
  await g.job({
    id: 'tvasahi_quiz', title: 'クイズ番組の解答者', desc: 'ピンクの解答席で、早押しに挑戦！', client: npc.name, clientLook: npc.look,
    stamina: 18, minigame: 'quiz', opts: { difficulty: 2, category: 'general', questions: QUIZ, count: 6, show: 'クイズ収録' },
    pay: 4000, fame: 15, skill: 'talk', gain: 2, requires: TIER1,
  });
}

async function kanran(g, npc) {
  const s = as(npc);
  if (today(g, 'tvasahi_kanran_day')) {
    await g.say('今日の観覧はもう終わっちゃいました。\nまた明日、遊びに来てくださいね！', s);
    return;
  }
  const i = await g.ask(['番組観覧のお客さん、まだ募集してます！', '客席で収録を見ていきませんか？（無料・1日1回）'], ['見ていく', 'またこんど'], s);
  if (i !== 0) { await g.say('いつでもどうぞ！', s); return; }
  markToday(g, 'tvasahi_kanran_day');
  await g.fadeOut(16);
  g.sfx('laugh');
  await g.wait(600);
  g.sfx('applause');
  await g.wait(500);
  await g.fadeIn(16);
  g.relax({ stress: 10 });
  g.sfx('good');
  await g.say(['お客さんといっしょに、思いきり笑った！', 'プロの間の取り方、すごかったなあ…。（ストレス -10）']);
}

async function mirror(g) {
  if (today(g, 'tvasahi_mirror_day')) { await g.say('（髪も服も、もうバッチリ整っている）'); return; }
  const i = await g.ask('ライトつきの鏡だ。身だしなみを整える？', ['整える', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'tvasahi_mirror_day');
  g.bathe(35, true);
  g.sfx('good');
  await g.say('髪をとかして、服のしわものばした。\n鏡の中の自分が、ちょっとシャキッとした！（身だしなみ +35・1日1回）');
}

async function rest(g) {
  if (today(g, 'tvasahi_rest_day')) { await g.say('（もう十分休んだ。\nそろそろお仕事に行こう！）'); return; }
  const i = await g.ask('ここで、ちょっとひと休みする？', ['休む', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'tvasahi_rest_day');
  await g.fadeOut(16);
  g.sfx('sleep');
  await g.wait(700);
  await g.fadeIn(16);
  g.relax({ stress: 8, stamina: 20 });
  await g.say('ふう…と肩の力をぬいて、目を閉じた。\n楽屋って、どうしてこんなに落ち着くんだろう。（体力 +20・ストレス -8・1日1回）');
}

// ====================================================================== place
registerPlace({
  id: PID,
  name: 'テレビ朝日',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 9, y: 10, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------------ エントランス
    lobby: {
      floor: T('floor'),
      topPad: 24,
      tiles: [
        '####################',
        '#uABCuuuuuuuuuuuuuu#',
        '#=abc=v======v==gg=#',
        '#.............|....#',
        '#P.....KKKKKK.|....#',
        '#........()...ILILI#',
        '#........()........#',
        '#.SS.SS..()......Q.#',
        '#.tt.tt..()........#',
        '#........()......P.#',
        '#P.......()........#',
        '#########MM#########',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'),
        A: `${T('wall_u')}+${T('vision_0_0')}`, B: `${T('wall_u')}+${T('vision_1_0')}`, C: `${T('wall_u')}+${T('vision_2_0')}`,
        a: `${T('wall2')}+${T('vision_0_1')}`, b: `${T('wall2')}+${T('vision_1_1')}`, c: `${T('wall2')}+${T('vision_2_1')}`,
        v: `${T('wall2')}+tv_wall`, g: 'door_glass', '|': T('glass_v'), K: T('counter'),
        I: T('gate'), L: T('lane'), '(': T('run_l'), ')': T('run_r'), S: T('sofa'), t: 'table_white', P: 'plant', Q: 'water_server',
      },
      warps: [
        ...exitWarps([9, 10], 11),
        { x: 16, y: 2, room: 'corridor', tx: 2, ty: 5, dir: 'up' },
        { x: 17, y: 2, room: 'corridor', tx: 3, ty: 5, dir: 'up' },
      ],
      entities: [
        {
          type: 'logo', x: 7.5, y: 1.1, w: 5, h: 1.8, logo: PID,
          talk: async (g) => { await g.showLogo(PID, 'テレビ朝日'); await g.say('ピンクのロゴが、ロビーで明るく光っている。'); },
        },
        plate(15.5, 1, 'スタジオ', 3),
        {
          type: 'sign', x: 3, y: 2,
          talk: async (g) => { await g.say(['大型ビジョンだ。番組の映像が次々に流れていく。', 'バラエティ、ロケ、そしてピンクの「ON AIR」…見ているだけで楽しい！']); },
        },
        { type: 'sign', x: 6, y: 2, text: 'オンエアモニターだ。\nいま放送中の番組が映っている。' },
        { type: 'sign', x: 13, y: 2, text: 'オンエアモニターだ。\nとなりの局の番組も、ちゃんとチェックしているらしい。' },
        { type: 'npc', id: 'tva_recep', x: 8, y: 3, dir: 'down', look: L.recep, name: '受付さん', talk: async (g, npc) => programDesk(g, PID, npc) },
        {
          type: 'npc', id: 'tva_info', x: 11, y: 3, dir: 'down', look: L.recep2, name: 'ご案内',
          text: [
            'テレビ朝日へようこそ！ゲートの奥がスタジオ、楽屋はその手前の廊下です。',
            'トークスタジオのADさんが、前説のお手伝いを探していましたよ。だれでも大歓迎だそうです！',
            'スタジオAのクイズや、ひな壇のゲストは、事務所に所属するか★30くらいから声がかかるみたいです。',
          ],
        },
        {
          type: 'npc', id: 'tva_guard', x: 14, y: 6, dir: 'down', look: L.guard, name: '警備員さん',
          text: ['ゲストの方は、ゲートをそのままお通りください。', '毎日たくさんの人が出入りするので、顔と名前を覚えるのが特技になりました。', '…あ、さっき通った方、サングラスで変装してたけど、たぶん有名な人ですね。'],
        },
        {
          type: 'npc', id: 'tva_manager', x: 4, y: 8, dir: 'up', look: L.manager, name: 'マネージャーさん', fixedDir: true,
          text: ['うちのタレント、まだメイク中でして…。', '待ち時間にモニターで他局の番組を見るのも、マネージャーの大事な仕事なんです。', 'スケジュール帳は分刻み。手帳がもう、真っ黒です。'],
        },
        {
          type: 'npc', id: 'tva_caterer', x: 17, y: 8, dir: 'left', look: L.caterer, name: 'お弁当屋さん',
          text: ['ロケ弁、50個お届けにあがりました！', 'テレビ局の人って、みんな食べるのが早いんですよ。本番が始まる前に、パパッとね。'],
        },
        {
          type: 'npc', id: 'tva_kid', x: 12, y: 9, dir: 'up', look: L.kid, name: '見学の子ども', wander: 1,
          text: ['ピンクのロゴ、かわいいね！', 'テレビの人って、ほんとにここで働いてるんだー！'],
        },
      ],
      events: [
        {
          x: 9, y: 9, w: 2, on: 'step', once: 'tvasahi_welcome',
          run: async (g) => {
            await g.emote('tva_recep', '!');
            await g.say(['テレビ朝日へようこそ！', '番組の出演のご相談は、わたしたち受付まで。スタジオへはゲートの奥からどうぞ！'], SP.recep);
          },
        },
        {
          x: 15, y: 5, w: 3, on: 'step', once: 'tvasahi_pass',
          run: async (g) => {
            await g.emote('tva_guard', '!');
            await g.say(['あ、ちょっとお待ちください！はじめての方ですね。', 'こちら、ゲスト用の入館証です。首からさげておいてください。'], SP.guard);
            g.sfx('ok');
            await g.say('（ピンクのストラップの入館証を受け取った）');
            await g.say('はい、どうぞ！\n楽屋もスタジオも、この先です。いってらっしゃい！', SP.guard);
          },
        },
      ],
    },

    // ------------------------------------------------------------------ スタジオ廊下
    corridor: {
      floor: 'floor_tile',
      tiles: [
        '########################',
        '#uuuuuuuuuuuuuuuuuuuuuu#',
        '#==d=p==ODD=p==ODD==EE=#',
        '#Q....................V#',
        '#......................#',
        '#....P....SS......P....#',
        '##MM####################',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'), p: `${T('wall2')}+poster`,
        d: `door_wood+${T('noren')}`, D: 'door_metal', O: `${T('wall2')}+onair`, E: `${T('wall2')}+elevator`,
        Q: 'water_server', V: 'vending', S: T('sofa'), P: 'plant',
      },
      warps: [
        { x: 2, y: 6, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
        { x: 3, y: 6, room: 'lobby', tx: 17, ty: 3, dir: 'down' },
        { x: 3, y: 2, room: 'gakuya', tx: 6, ty: 7, dir: 'up' },
        { x: 9, y: 2, room: 'studio', tx: 8, ty: 10, dir: 'up' },
        { x: 10, y: 2, room: 'studio', tx: 9, ty: 10, dir: 'up' },
        { x: 16, y: 2, room: 'talk', tx: 10, ty: 12, dir: 'up' },
        { x: 17, y: 2, room: 'talk', tx: 11, ty: 12, dir: 'up' },
      ],
      entities: [
        plate(2, 1, '楽屋', 3),
        plate(8, 1, 'スタジオA', 4),
        plate(15, 1, 'トーク', 4),
        {
          type: 'sign', x: 20, y: 2,
          talk: async (g) => { await g.say(['エレベーターだ。「上の階：報道フロア・関係者以外立入禁止」', '…ニュースの現場は、また別の緊張感がありそうだ。']); },
        },
        { type: 'sign', x: 21, y: 2, text: 'エレベーターだ。\nボタンの横に「急いでいる時ほど、階段で」と手書きのメモ。' },
        {
          type: 'npc', id: 'tva_ad', x: 7, y: 4, dir: 'right', look: L.ad2, name: 'AD', wander: 2,
          text: ['すみませーん、通りまーす！台本、通りまーす！', 'ADの三大必需品は、ガムテープ・ペン・ストップウォッチです。あと、元気！', 'トークスタジオの「長いベンチ」、もう見ました？あそこに座れたら一人前ですよ。'],
        },
        {
          type: 'npc', id: 'tva_producer', x: 13, y: 3, dir: 'down', look: L.producer, name: 'プロデューサー',
          text: ['企画会議、3時間やって決まったのは「お弁当の発注数」だけ…。', '番組はね、チームで作るもの。カメラ、照明、音声、美術…だれが欠けても放送できないんだ。', 'いい表情の新人さんだね。名前、覚えておくよ。'],
        },
        {
          type: 'npc', id: 'tva_camera', x: 19, y: 4, dir: 'left', look: L.cameraman, name: 'カメラマン',
          text: ['ひな壇は人数が多いから、カメラはだれが話してもすぐ映せるように準備してるんだ。', 'リアクションが大きい人は、つい撮りたくなっちゃうんだよなあ。'],
        },
      ],
    },

    // ------------------------------------------------------------------ 楽屋
    gakuya: {
      floor: 'floor_wood',
      tiles: [
        '##############',
        '#=MM=MM===p=c#',
        '#.kk.kk.....L#',
        '#...........L#',
        '#ZZZZ...oo...#',
        '#ZYYZ........#',
        '#ZZZZ.....SS.#',
        '#F..........R#',
        '######mm######',
      ],
      legend: {
        '#': 'walltop_pink', '=': 'wall_pink', M: 'wall_pink+mirror', p: 'wall_pink+poster', c: 'wall_pink+clock',
        k: 'makeup', L: 'locker', Z: 'floor_tatami', Y: 'floor_tatami+table_low', o: 'table_low', S: T('sofa'),
        F: 'flower_stand', R: 'clothes_rack', m: 'exit_mat',
      },
      warps: [
        { x: 6, y: 8, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
        { x: 7, y: 8, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'tva_makeup', x: 4, y: 3, dir: 'down', look: L.makeup, name: 'メイクさん',
          talk: async (g, npc) => {
            const s = as(npc);
            await g.say(['テレビのライトは強いから、メイクはちょっとしっかりめが基本なの。', '鏡の前で身だしなみを整えておくと、お仕事の評判も上がるわよ。'], s);
            if (!today(g, 'tvasahi_mirror_day')) await g.say('鏡はいつでも使ってね。ブラシとスプレーも置いてあるから。', s);
          },
        },
        {
          type: 'npc', id: 'tva_sleepy', x: 9, y: 6, dir: 'down', look: L.geinin, name: '若手芸人さん',
          talk: async (g) => {
            await g.say('Zzz…むにゃ…ひな壇…いちばん前の…はじっこ…');
            await g.emote('tva_sleepy', '!');
            await g.say(['はっ！寝てない！寝てないっす！', '収録が3本続くと、楽屋の畳が天国に見えるんすよ。…先輩も、休める時に休んどいてくださいね。'], { name: '若手芸人さん', look: L.geinin });
          },
        },
        { type: 'sign', x: 1, y: 7, text: '「祝・ご出演」のスタンド花だ。\nピンクのガーベラが、楽屋をぱっと明るくしている。' },
        { type: 'sign', x: 10, y: 1, text: '楽屋の注意書きだ。\n「本番15分前には、スタジオ前にお集まりください」' },
      ],
      events: [
        { x: 2, y: 2, w: 2, on: 'action', run: mirror },
        { x: 5, y: 2, w: 2, on: 'action', run: mirror },
        { x: 2, y: 5, w: 2, on: 'action', run: rest },
        { x: 10, y: 6, w: 2, on: 'action', run: rest },
        { x: 8, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('テーブルに台本が置いてある。\n表紙には「台本の持ち出し禁止」の大きなハンコ。'); } },
      ],
    },

    // ------------------------------------------------------------------ スタジオA（クイズ）
    studio: {
      floor: T('sfloor'),
      topPad: 24,
      bgm: 'studio',
      tiles: [
        '###################',
        '#qqqqqqqXYZqqqqqqq#',
        '#QOQQQQQxyzQQQQQOQ#',
        '#.................#',
        '#..H..B.B.B.B.....#',
        '#.................#',
        '#.................#',
        '#..C.....C.....C..#',
        '#.................#',
        '#.SSSSSS...SSSSSS.#',
        '#.................#',
        '########MM#########',
      ],
      legend: {
        '#': T('walltop'), q: T('qwall_u'), Q: T('qwall'), O: `${T('qwall')}+onair`,
        X: `${T('qwall_u')}+${T('vision_0_0')}`, Y: `${T('qwall_u')}+${T('vision_1_0')}`, Z: `${T('qwall_u')}+${T('vision_2_0')}`,
        x: `${T('qwall')}+${T('vision_0_1')}`, y: `${T('qwall')}+${T('vision_1_1')}`, z: `${T('qwall')}+${T('vision_2_1')}`,
        B: T('booth'), C: 'camera', H: T('podium'), S: 'seat', M: 'exit_mat',
      },
      warps: [
        { x: 8, y: 11, room: 'corridor', tx: 9, ty: 3, dir: 'down' },
        { x: 9, y: 11, room: 'corridor', tx: 10, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'sign', x: 9, y: 2, text: '大型ビジョンに、クイズの問題が映し出されるらしい。\nいまは番組の映像が流れている。' },
        {
          type: 'npc', id: 'tva_mcstand', x: 3, y: 3, dir: 'down', look: L.stand, name: '代役のADさん',
          text: ['（司会台で、司会者の代役をしている）「さあ、第1問！…」', 'リハーサルでは、ぼくが司会の代わり。本番の司会者さんは、もっとずーっとカッコいいです。'],
        },
        {
          type: 'npc', id: 'tva_student', x: 6, y: 3, dir: 'down', look: L.student, name: 'クイズ研究会の大学生',
          text: ['問題文は、最後まで聞かずに押す。…で、よく間違えます。', '早押しボタンは、親指より人差し指派です。'],
        },
        {
          type: 'npc', id: 'tva_housewife', x: 8, y: 3, dir: 'down', look: L.housewife, name: 'ものしり主婦',
          text: ['スーパーの特売日なら、全部頭に入ってますよ！', 'クイズのコツ？知らない問題でも、笑顔で答えることね。'],
        },
        {
          type: 'npc', id: 'tva_oldman', x: 10, y: 3, dir: 'down', look: L.oldman, name: '物知りおじいさん',
          text: ['わしゃ、昭和の問題なら負けんぞい。', '孫が見とるでのう。今日はかっこいいところを見せねばならん。'],
        },
        { type: 'npc', id: 'tva_quizdir', x: 15, y: 5, dir: 'left', look: L.director, name: 'ディレクター', talk: quizTalk },
        { type: 'npc', id: 'tva_kanran', x: 17, y: 8, dir: 'left', look: L.ad, name: '観覧係のAD', talk: kanran },
        { type: 'npc', id: 'tva_fan', x: 4, y: 9, dir: 'up', look: L.fan, name: '観覧のお客さん', text: ['観覧の抽選、やっと当たったの！', 'ピンクの解答席…いつか知ってる人が座ったら、全力で応援しちゃう！'] },
        { type: 'npc', id: 'tva_granny', x: 13, y: 9, dir: 'up', look: L.granny, name: '観覧のおばあさん', text: ['答えがわかっても、声に出しちゃダメなのが難しいのよねえ。', 'さっきの問題、わたし正解してたのよ。心の中で。'] },
      ],
      events: [
        {
          x: 12, y: 4, on: 'action',
          run: async (g) => {
            await g.say('ピンクの解答席だ。いまは空いている。');
            if (g.checkRequires(TIER1)) await g.say('（事務所に所属するか、★30くらいになれば、ここに座れるかも…？）');
            else await quizTalk(g, { name: 'ディレクター', look: L.director });
          },
        },
        { x: 3, y: 4, on: 'action', run: async (g) => { await g.say('司会台だ。マイクと台本、それに「巻いて！」と書かれたメモが貼ってある。'); } },
      ],
    },

    // ------------------------------------------------------------------ トークスタジオ（長いベンチ）
    talk: {
      floor: T('sfloor'),
      topPad: 24,
      bgm: 'studio',
      tiles: [
        '######################',
        '#vvvvvvvvvvvvvvvvvvvv#',
        '#VOVVVVVVVVVVVVVVVVOV#',
        '#....[----------]....#',
        '#....^^^^^^^^^^^^....#',
        '#.KJ.................#',
        '#....................#',
        '#....................#',
        '#Y..................Y#',
        '#...C.....C.....C....#',
        '#....................#',
        '#.SSSSSSS....SSSSSSS.#',
        '#.SSSSSSS....SSSSSSS.#',
        '##########MM##########',
      ],
      legend: {
        '#': T('walltop'), v: T('set_u'), V: T('set'), O: `${T('set')}+onair`,
        '[': T('bench_l'), '-': T('bench_m'), ']': T('bench_r'), '^': T('riser'),
        K: T('hdesk_0_0'), J: T('hdesk_1_0'), Y: 'spotlight', C: 'camera', S: 'seat', M: 'exit_mat',
      },
      warps: [
        { x: 10, y: 13, room: 'corridor', tx: 16, ty: 3, dir: 'down' },
        { x: 11, y: 13, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
      ],
      entities: [
        talkSign(8, 0.75),
        { type: 'npc', id: 'tva_g1', x: 6, y: 3, dir: 'down', look: L.geinin, name: 'ひな壇の芸人さん', text: ['ひな壇はな、前のめりが基本や！背もたれは飾りやで。', 'はじっこの席は、ツッコミのチャンスが多い「おいしい席」なんや。'] },
        { type: 'npc', id: 'tva_g2', x: 8, y: 3, dir: 'down', look: L.model, name: 'モデルさん', text: ['このベンチ、長すぎて端の人の声が聞こえないの。', 'だから、みんな身ぶり手ぶりが大きくなるのよね。'] },
        { type: 'npc', id: 'tva_g3', x: 11, y: 3, dir: 'down', look: L.veteran, name: 'ベテラン俳優さん', text: ['ドラマとちがって、トークは台本どおりにいかない。そこが楽しい。', '若いころは、ひな壇で一言もしゃべれずに帰ったものだよ。'] },
        { type: 'npc', id: 'tva_g4', x: 14, y: 3, dir: 'down', look: L.idol, name: 'アイドルの子', text: ['リアクションの練習、毎朝鏡の前でしてます！', '「えーっ！？」の言い方だけで、10種類あるんですよ♪'] },
        {
          type: 'npc', id: 'tva_mcad', x: 2, y: 4, dir: 'down', look: L.stand, name: '代役のADさん',
          text: ['（司会者席で台本をめくっている）本番の司会者さんが来るまで、ぼくが代役です。', 'この席から見ると、ベンチが端から端までずらーっと見えるんですよ。壮観です！'],
        },
        { type: 'npc', id: 'tva_maesetsu', x: 10, y: 7, dir: 'down', look: L.ad, name: '前説係のAD', talk: maesetsuTalk },
        { type: 'npc', id: 'tva_fd', x: 18, y: 5, dir: 'left', look: L.fd, name: 'フロアディレクター', talk: hinadanTalk },
        { type: 'npc', id: 'tva_tfan', x: 14, y: 11, dir: 'up', look: L.fan, name: '観覧のお客さん', text: ['前説の人、さっきまで緊張してたのに、今は客席の人気者！', 'ここから見ると、ベンチがほんとに長いの。何人座れるんだろう…。'] },
      ],
      events: [
        {
          // one-time: the warm-up act is stuck in traffic
          x: 9, y: 11, w: 4, on: 'step', once: 'tvasahi_talk_intro',
          run: async (g) => {
            await g.emote('tva_maesetsu', '!');
            await g.say(['あっ、そこのあなた！ちょっといいですか！？', '前説の人が渋滞で来られなくなっちゃって…本番まであと30分なんです！'], { name: '前説係のAD', look: L.ad });
            const i = await g.ask('お客さんをあたためるだけでいいんです！\n前説、お願いできませんか…！？', ['まかせて！', 'ごめんなさい'], { name: '前説係のAD', look: L.ad });
            if (i !== 0) {
              await g.say('で、ですよね…。気が変わったら、いつでも声をかけてください！', { name: '前説係のAD', look: L.ad });
              return;
            }
            const res = await maesetsuJob(g, { name: '前説係のAD', look: L.ad }, false);
            if (res) await g.say('助かりましたー！！\nまた前説、お願いしてもいいですか？いつでも待ってます！', { name: '前説係のAD', look: L.ad });
          },
        },
        { x: 2, y: 5, w: 2, on: 'action', run: async (g) => { await g.say('司会者席だ。台本と、ペンと、のどあめが置いてある。\n本番では、ここから話が回っていく。'); } },
        {
          x: 5, y: 4, w: 12, on: 'action',
          run: async (g) => { await g.say(['ピンクの長〜いベンチだ。はしからはしまで、何人座れるんだろう？', 'うしろの背もたれには、ちょっと前のめりになった跡がついている…。']); },
        },
      ],
    },
  },
});
