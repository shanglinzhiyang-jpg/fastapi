// フジテレビ（港エリア）— 海辺に建つ、近未来的な本社ビルのテレビ局
//
// 部屋：
//   lobby    エントランス   銀色の吹き抜け。受付（番組の出演依頼＝programDesk）・セキュリティゲート・
//                          丸いポッドチェアの待合・大型ビジョンとオンエアモニター・「フジテレビ」の看板
//   corridor スタジオ廊下  楽屋・バラエティスタジオ・球体ラウンジ行きのエレベーター
//   gakuya   楽屋          メイク台の鏡（身だしなみ）・畳でひと休み（体力・ストレス）
//   studio   バラエティスタジオ  コントの街並みセット・カメラ・観覧席
//   sphere   球体ラウンジ  丸い展望ラウンジ。ガラスの向こうに湾岸の街と海。望遠鏡とコーヒースタンド
//
// お仕事（すべて架空。実在の番組・出演者は出さない）：
//   段階0  コントの通行人役（スタジオのAD）        command acting d1
//   段階1  コント番組のツッコミ役（ディレクター）  tsukkomi d2   所属 または ★30
//   ほか   番組観覧（1日1回・無料・ストレス -10）、楽屋の鏡・畳、ラウンジの景色とコーヒー（各1日1回）
// 1回きりのイベント：はじめての入館、ゲートで入館証、はじめての球体ラウンジ

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, Pw, pix, oval, ring, line, bevel, outline, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, mix } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

const PID = 'fujitv';
const T = (k) => `${PID}_${k}`;

// ====================================================================== palette
const ORG = '#e8452c';
const ORGD = '#b8301c';
const ORGL = '#ff7a5c';
const ORGP = '#ffd9cf';
const SIL = '#d9dde3';
const SILL = '#eef1f4';
const SILD = '#a9afb9';
const STEEL = '#7d8591';
const GRAPH = '#2a2d34';
const WHT = '#ffffff';
const INK = '#22202a';
const SKY = '#8fd0f5';
const SEA = '#2f7fc8';

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
// legend entries for a big art: chars[row] = the characters used for that row in the room
function bigLegend(k, rows, base) {
  const out = {};
  rows.forEach((chars, y) => [...chars].forEach((ch, x) => { out[ch] = (base ? base[y] + '+' : '') + T(`${k}_${x}_${y}`); }));
  return out;
}
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

const ONAIR = [
  '###.#..#..###.#.##.',
  '#.#.##.#..#.#.#.#.#',
  '#.#.#.##..###.#.##.',
  '#.#.#..#..#.#.#.#.#',
  '###.#..#..#.#.#.#.#',
];

// ====================================================================== tiles
// --- walls: silver panels held by a lattice of steel beams
tile('walltop', { solid: true }, (c) => R(c, 0, 0, 32, 32, GRAPH));
function lattice(c) {
  R(c, 0, 0, 32, 32, SIL);
  R(c, 3, 3, 26, 11, SILL); R(c, 3, 18, 26, 11, SILL);
  R(c, 3, 3, 26, 1, WHT); R(c, 3, 18, 26, 1, WHT);
  R(c, 0, 0, 3, 32, STEEL); R(c, 29, 0, 3, 32, STEEL); R(c, 0, 0, 1, 32, '#9aa1ac'); R(c, 31, 0, 1, 32, '#5f6672');
  R(c, 0, 14, 32, 4, STEEL); R(c, 0, 14, 32, 1, '#9aa1ac'); R(c, 0, 17, 32, 1, '#5f6672');
  for (const [x, y] of [[1, 15], [30, 15]]) P(c, x, y, SILL);
}
function wallFace(c, lip) {
  R(c, 0, 0, 32, 32, SILL);
  R(c, 15, 0, 1, 26, '#e2e6ea'); R(c, 16, 0, 1, 26, WHT);
  if (lip) { R(c, 0, 0, 32, 1, SILD); R(c, 0, 1, 32, 1, WHT); }
  R(c, 0, 18, 32, 2, ORG); R(c, 0, 18, 32, 1, ORGL);
  R(c, 0, 26, 32, 6, '#4a4f58'); R(c, 0, 26, 32, 1, GRAPH); R(c, 0, 27, 32, 1, '#6a707b'); R(c, 0, 31, 32, 1, '#24272d');
}
tile('wall_u', { solid: true }, (c) => { lattice(c); R(c, 0, 0, 32, 1, '#5f6672'); });
tile('wall2', { solid: true }, (c) => wallFace(c, false));
tile('wall', { solid: true }, (c) => wallFace(c, true));

function metalFloor(c, r, v) {
  R(c, 0, 0, 32, 32, '#e4e7ec');
  for (let i = 0; i < 16; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#dde1e7' : '#eaedf1');
  R(c, 0, 0, 32, 1, '#cfd4db'); R(c, 0, 0, 1, 32, '#cfd4db');
  R(c, 16, 0, 1, 32, '#d8dce2'); R(c, 0, 16, 32, 1, '#d8dce2');
  if (v === 0) { R(c, 4, 4, 7, 1, WHT); R(c, 4, 5, 1, 3, WHT); }
  if (v === 2) { R(c, 21, 20, 6, 1, WHT); }
}
tile('floor', { variants: 4 }, (c, r, f, v) => metalFloor(c, r, v));
const ARROW = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'];
tile('lane', {}, (c, r) => {
  metalFloor(c, r, 1);
  R(c, 1, 0, 2, 32, '#c9cfd7'); R(c, 29, 0, 2, 32, '#c9cfd7');
  pix(c, ARROW, { '#': '#f5b3a4' }, 13, 12);
});
// entrance walkway: silver floor with an orange-red inlay on the outer side
function walkway(c, r, left) {
  metalFloor(c, r, 3);
  R(c, left ? 2 : 27, 0, 3, 32, ORG); R(c, left ? 5 : 26, 0, 1, 32, ORGP); R(c, left ? 1 : 30, 0, 1, 32, ORGD);
}
tile('walk_l', {}, (c, r) => walkway(c, r, true));
tile('walk_r', {}, (c, r) => walkway(c, r, false));

// --- lobby furniture
tile('counter', { solid: true, obj: true, talkThrough: true, variants: 3 }, (c, r, f, v) => {
  R(c, 0, 3, 32, 13, SILL); R(c, 0, 3, 32, 1, WHT); R(c, 0, 14, 32, 2, SILD);
  R(c, 0, 16, 32, 16, WHT); R(c, 0, 16, 32, 2, '#c3c9d1'); R(c, 0, 20, 32, 3, ORG); R(c, 0, 20, 32, 1, ORGL);
  R(c, 0, 28, 32, 2, '#c3c9d1'); R(c, 0, 30, 32, 2, STEEL);
  if (v === 1) {
    R(c, 17, 0, 12, 10, INK); R(c, 18, 1, 10, 7, '#7fd8ff'); R(c, 18, 1, 10, 1, '#c8f0ff'); R(c, 20, 4, 5, 1, '#3a8ab8');
    R(c, 21, 10, 4, 3, STEEL);
  }
  if (v === 2) { R(c, 4, 7, 10, 6, '#fff7e0'); R(c, 5, 8, 8, 1, SILD); R(c, 5, 10, 6, 1, SILD); oval(c, 19, 7, 7, 7, ORG); P(c, 21, 8, ORGP); }
  outline(c);
});
tile('gate', { solid: true, obj: true, frames: 2, speed: 40 }, (c, r, f) => {
  shadowEllipse(c, 16, 29, 9, 2);
  c.fillStyle = 'rgba(190,228,255,0.6)';
  c.fillRect(3, 13, 6, 9); c.fillRect(23, 13, 6, 9);
  R(c, 3, 13, 6, 1, '#f0faff'); R(c, 23, 13, 6, 1, '#f0faff');
  bevel(c, 9, 5, 14, 24, '#b9c0ca');
  R(c, 9, 5, 14, 6, SILL); R(c, 9, 5, 14, 1, WHT);
  R(c, 11, 6, 10, 4, '#3b3f48'); R(c, 12, 7, 8, 1, '#5a5f6b'); P(c, 19, 8, f ? '#5ee07a' : '#2f9a4a');
  R(c, 10, 13, 12, 1, ORG);
  R(c, 12, 16, 8, 4, INK); R(c, 13, 17, 6, 2, f ? '#5ee07a' : '#2f9a4a');
  R(c, 9, 25, 14, 4, STEEL); R(c, 9, 25, 14, 1, '#9aa1ac');
  outline(c);
});
tile('glass_v', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 5, 1);
  c.fillStyle = 'rgba(190,228,255,0.55)'; c.fillRect(13, 0, 6, 30);
  R(c, 14, 0, 1, 30, 'rgba(255,255,255,0.85)');
  R(c, 12, 28, 8, 3, '#9aa0aa'); R(c, 12, 28, 8, 1, '#c3c8d2');
  R(c, 18, 0, 1, 28, '#9fb8cc');
});
// egg-shaped pod chair (white shell, orange cushion)
tile('pod', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 11, 2);
  oval(c, 5, 2, 22, 26, '#c3c9d1'); oval(c, 6, 2, 20, 24, WHT);
  oval(c, 9, 7, 14, 16, '#e9edf1');
  oval(c, 10, 12, 12, 11, ORG); oval(c, 11, 12, 10, 6, ORGL);
  R(c, 13, 27, 6, 2, STEEL);
  P(c, 9, 5, WHT); P(c, 8, 7, WHT);
  outline(c);
});
tile('rtable', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 9, 2);
  R(c, 15, 16, 3, 12, STEEL); R(c, 11, 27, 11, 2, '#5f6672');
  oval(c, 5, 9, 22, 10, SILD); oval(c, 5, 8, 22, 9, WHT);
  R(c, 12, 9, 4, 5, ORGP); R(c, 12, 9, 4, 1, WHT); R(c, 18, 11, 4, 3, '#7a4a28'); R(c, 18, 11, 4, 1, '#a07050');
  outline(c);
});

// --- big video wall (3 x 2): comedy stage / the bay / station ident
function paintVision(c, f) {
  R(c, 0, 3, 96, 59, GRAPH); R(c, 0, 3, 96, 1, '#4a4f58'); R(c, 0, 61, 96, 1, '#16181c');
  const x0 = 4, y0 = 7, w = 88, h = 50;
  if (f === 0) {
    for (let y = 0; y < h; y++) R(c, x0, y0 + y, w, 1, mix('#3a1208', '#9a2a14', y / h));
    for (let x = 0; x < w; x += 6) { R(c, x0 + x, y0, 3, 34, '#c8321c'); R(c, x0 + x + 3, y0, 3, 34, '#a8240f'); }
    R(c, x0, y0, w, 4, '#ffd23f');
    for (let y = 0; y < 36; y++) { const half = 6 + y; R(c, x0 + 44 - half, y0 + 4 + y, half * 2, 1, 'rgba(255,240,180,0.18)'); }
    R(c, x0, y0 + 38, w, 12, '#6a3a20'); R(c, x0, y0 + 38, w, 1, '#a06a40');
    R(c, x0 + 43, y0 + 22, 2, 16, '#c3c9d1'); oval(c, x0 + 41, y0 + 18, 6, 6, '#5a5f6b'); R(c, x0 + 40, y0 + 37, 8, 2, '#5a5f6b');
    for (const [px, col] of [[26, '#5fd7ff'], [62, '#ffd23f']]) {
      oval(c, x0 + px - 5, y0 + 18, 10, 10, '#ffe0c4'); R(c, x0 + px - 5, y0 + 17, 10, 4, '#2a1a10');
      R(c, x0 + px - 7, y0 + 28, 14, 11, col); P(c, x0 + px - 2, y0 + 23, INK); P(c, x0 + px + 2, y0 + 23, INK); R(c, x0 + px - 1, y0 + 25, 3, 1, '#d6455a');
    }
  } else if (f === 1) {
    for (let y = 0; y < 26; y++) R(c, x0, y0 + y, w, 1, mix('#7fc8f2', '#e0f4ff', y / 26));
    for (const [bx, bh] of [[6, 10], [12, 16], [18, 8], [60, 14], [68, 20], [76, 11], [82, 15]]) R(c, x0 + bx, y0 + 26 - bh, 5, bh, '#9aa8bd');
    R(c, x0, y0 + 26, w, h - 26, SEA);
    for (let i = 0; i < 14; i++) R(c, x0 + ((i * 23) % 84), y0 + 29 + ((i * 7) % 18), 4, 1, '#7fc0f0');
    R(c, x0 + 20, y0 + 6, 2, 22, WHT); R(c, x0 + 58, y0 + 6, 2, 22, WHT);
    for (let x = 0; x <= 70; x++) { const yy = Math.round(7 + 9 * Math.pow((x - 40) / 40, 2)); P(c, x0 + 6 + x, y0 + Math.min(yy, 24), '#f2f4f8'); }
    R(c, x0, y0 + 24, w, 2, '#e4e7ec');
    R(c, x0 + 66, y0 + 34, 12, 4, WHT); R(c, x0 + 70, y0 + 31, 4, 3, ORG);
  } else {
    for (let y = 0; y < h; y++) R(c, x0, y0 + y, w, 1, mix(SILL, '#c3c9d1', y / h));
    ring(c, x0 + 44, y0 + 22, 12, 16, ORG); ring(c, x0 + 44, y0 + 22, 13, 14, ORGL);
    oval(c, x0 + 34, y0 + 12, 20, 20, '#c3c9d1'); oval(c, x0 + 35, y0 + 12, 16, 16, WHT);
    R(c, x0 + 24, y0 + 40, 41, 9, ORG);
    pix(c, ONAIR, { '#': WHT }, x0 + 35, y0 + 42);
  }
  R(c, x0 - 1, y0 - 1, w + 2, 1, '#1c1e22'); R(c, x0 - 1, y0 + h, w + 2, 1, '#4a4f58');
  R(c, 84, 58, 3, 2, '#ff2b3a'); R(c, 6, 58, 20, 1, '#5a5f6b');
  outline(c);
}
bigTiles('vision', 3, 2, { solid: true, obj: true, frames: 3, speed: 150 }, paintVision);

// --- studio
tile('sfloor', { variants: 16 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#2a2c31');
  for (let i = 0; i < 26; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#31343a' : '#25272c');
  R(c, 0, 0, 32, 1, '#33363c'); R(c, 0, 0, 1, 32, '#33363c');
  if (v === 0) { R(c, 8, 14, 12, 2, ORG); R(c, 13, 9, 2, 12, ORG); }
  if (v === 1) { R(c, 6, 18, 8, 2, '#e8c43a'); R(c, 6, 18, 2, 7, '#e8c43a'); }
});
tile('swall_u', { solid: true }, (c) => {
  R(c, 0, 0, 32, 32, '#3a3d45'); R(c, 0, 0, 32, 1, '#22252a');
  for (let y = 4; y < 32; y += 7) R(c, 0, y, 32, 1, '#33363d');
  R(c, 6, 0, 1, 32, '#454952'); R(c, 22, 0, 1, 32, '#454952');
});
tile('swall', { solid: true }, (c) => {
  R(c, 0, 0, 32, 32, '#3a3d45');
  for (let y = 4; y < 24; y += 7) R(c, 0, y, 32, 1, '#33363d');
  R(c, 6, 0, 1, 24, '#454952'); R(c, 22, 0, 1, 24, '#454952');
  R(c, 0, 22, 32, 2, ORG); R(c, 0, 24, 32, 8, '#22252a'); R(c, 0, 24, 32, 1, '#4a4f58');
});
// painted comedy-sketch backdrop: a little shopping street (8 x 2 tiles)
function paintKonto(c) {
  const W = 256, H = 64;
  for (let y = 0; y < 40; y++) R(c, 0, y, W, 1, mix('#8fd0f5', '#d8f0ff', y / 40));
  for (const [x, y, w] of [[20, 8, 26], [120, 5, 32], [200, 10, 22]]) { oval(c, x, y, w, 9, WHT); oval(c, x + 6, y - 4, w - 10, 9, WHT); }
  R(c, 0, 52, W, 12, '#b8a890'); R(c, 0, 52, W, 1, '#d8cab0'); for (let x = 0; x < W; x += 16) R(c, x, 53, 1, 11, '#a09078');
  // house (left)
  R(c, 8, 22, 64, 30, '#f2e6c8'); R(c, 8, 22, 64, 1, WHT);
  for (let i = 0; i < 12; i++) R(c, 4 + i, 22 - i, 72 - i * 2, 1, '#8a3a2a');
  R(c, 4, 22, 72, 2, '#6a2a1e');
  R(c, 16, 30, 16, 12, '#7fc8f2'); R(c, 16, 30, 16, 1, WHT); R(c, 23, 30, 2, 12, '#f2e6c8'); R(c, 16, 35, 16, 2, '#f2e6c8');
  R(c, 46, 32, 14, 20, '#8a5a33'); R(c, 47, 33, 12, 19, '#a8733f'); P(c, 56, 43, '#ffd23f');
  // shop (middle) with a noren and a sign board
  R(c, 92, 18, 72, 34, '#d8cbb0'); R(c, 92, 18, 72, 1, '#efe4cc');
  R(c, 96, 10, 64, 12, '#2a2d34'); R(c, 98, 12, 60, 8, '#f6f1e2');
  text(c, '食堂', 128, 11, { size: 9, align: 'center', color: '#2a2d34', shadow: null });
  R(c, 102, 26, 52, 12, ORG); R(c, 102, 26, 52, 1, ORGL); for (const x of [115, 128, 141]) R(c, x, 28, 1, 10, ORGD);
  R(c, 102, 38, 52, 14, '#5a3a28'); R(c, 104, 40, 48, 12, '#7fc8f2'); R(c, 127, 40, 2, 12, '#5a3a28');
  // little park (right): tree, fence
  R(c, 182, 44, 68, 2, '#8a6a4a'); for (let x = 184; x < 250; x += 8) R(c, x, 38, 2, 8, '#a8845a');
  R(c, 214, 30, 5, 22, '#7a4a28');
  oval(c, 196, 6, 40, 30, '#3f8a44'); oval(c, 200, 8, 32, 22, '#5ec26a'); P(c, 206, 12, '#8ae09a'); P(c, 210, 10, '#8ae09a');
  R(c, 0, 62, W, 2, '#6a5a48');
  outline(c);
}
bigTiles('konto', 8, 2, { solid: true }, paintKonto);

// --- the sphere lounge: panoramic view of the waterfront (12 x 2), its curved frame
function paintView(c, f) {
  const W = 384, H = 64;
  for (let y = 0; y < 40; y++) R(c, 0, y, W, 1, mix('#5fb4ec', '#cfeeff', y / 40));
  oval(c, 300, 6, 12, 12, '#fff6c8'); oval(c, 302, 8, 8, 8, WHT);
  for (const [x, y, w] of [[30, 8, 30], [140, 4, 40], [250, 12, 26], [350, 6, 24]]) { oval(c, x, y, w, 7, WHT); oval(c, x + 6, y - 3, w - 12, 7, '#f4fbff'); }
  // far city skyline
  const towers = [[4, 12], [12, 18], [20, 10], [30, 22], [40, 14], [64, 9], [210, 16], [220, 24], [232, 13], [240, 30], [252, 18], [262, 12], [330, 14], [340, 20], [352, 11], [366, 17], [376, 9]];
  for (const [x, h] of towers) {
    R(c, x, 40 - h, 9, h, '#9fb2c8'); R(c, x, 40 - h, 1, h, '#b8c8da');
    for (let yy = 40 - h + 2; yy < 39; yy += 3) for (let xx = x + 2; xx < x + 8; xx += 3) P(c, xx, yy, '#d8e4f0');
  }
  // ferris wheel
  ring(c, 196, 24, 12, 13, WHT); for (let a = 0; a < 8; a++) line(c, 196, 24, Math.round(196 + 12 * Math.cos(a * Math.PI / 4)), Math.round(24 + 12 * Math.sin(a * Math.PI / 4)), '#e4ecf4');
  for (let a = 0; a < 12; a++) P(c, Math.round(196 + 13 * Math.cos(a * Math.PI / 6)), Math.round(24 + 13 * Math.sin(a * Math.PI / 6)), a % 3 ? ORGL : '#5fd7ff');
  R(c, 193, 36, 2, 5, WHT); R(c, 198, 36, 2, 5, WHT);
  // sea
  R(c, 0, 40, W, 24, SEA); R(c, 0, 40, W, 1, '#7fc0f0');
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + f * 17) % W, y = 43 + ((i * 11) % 19);
    R(c, x, y, 3 + (i % 3), 1, i % 4 ? '#5fa8e6' : '#cfeeff');
  }
  // suspension bridge
  for (const tx of [70, 150]) { R(c, tx, 12, 4, 34, '#f2f4f8'); R(c, tx, 12, 1, 34, WHT); R(c, tx + 3, 12, 1, 34, '#c3c9d1'); R(c, tx - 1, 20, 6, 1, '#c3c9d1'); }
  for (let x = 20; x <= 200; x++) {
    let y;
    if (x < 72) y = 14 + Math.round(22 * Math.pow((72 - x) / 52, 1.6));
    else if (x <= 152) y = Math.round(14 + 14 * Math.pow((x - 112) / 40, 2));
    else y = 14 + Math.round(22 * Math.pow((x - 152) / 48, 1.6));
    P(c, x, Math.min(y, 38), '#f2f4f8');
    if (x % 6 === 0 && y < 38) R(c, x, y + 1, 1, 38 - y, 'rgba(242,244,248,0.6)');
  }
  R(c, 10, 38, 210, 3, '#e4e7ec'); R(c, 10, 38, 210, 1, WHT); R(c, 10, 41, 210, 1, '#9aa1ac');
  // boats
  R(c, 260, 50, 16, 4, WHT); R(c, 264, 47, 7, 3, ORG); R(c, 262, 54, 12, 1, '#1f5a98');
  R(c, 90, 56, 10, 3, WHT); R(c, 92, 54, 4, 2, '#3a6fd8');
  // gulls
  for (const [x, y] of [[120, 20], [128, 17], [310, 28]]) { P(c, x, y, WHT); P(c, x + 1, y - 1, WHT); P(c, x + 2, y, WHT); }
  // glass panels: curved mullions, brighter toward the middle of the sphere
  for (let x = 0; x <= W; x += 32) {
    const k = Math.abs(x - W / 2) / (W / 2);
    R(c, Math.min(x, W - 2), 0, 2, H, mix('#c9d0d9', '#7d8591', k));
  }
  R(c, 0, 30, W, 2, '#c9d0d9'); R(c, 0, 30, W, 1, WHT);
  R(c, 0, 0, W, 2, '#7d8591'); R(c, 0, 62, W, 2, '#5f6672');
  c.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 12; i++) c.fillRect(i * 32 + 6, 3, 3, 24);
}
bigTiles('view', 12, 2, { solid: true, frames: 2, speed: 50 }, paintView);
function sphereCorner(c, right, upper) {
  R(c, 0, 0, 32, 32, GRAPH);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const px = right ? 31 - x : x;
      const d = upper ? Math.hypot(32 - px, 32 - y) : 32 - px;
      if (d < 26) P(c, x, y, upper ? mix('#5fb4ec', '#9fd4f5', y / 32) : mix('#9fd4f5', SEA, y / 32 > 0.25 ? 1 : 0));
      else if (d < 31) P(c, x, y, d < 28 ? '#c9d0d9' : STEEL);
    }
  }
  if (!upper) { R(c, right ? 0 : 6, 30, 26, 2, '#5f6672'); R(c, right ? 0 : 6, 8, 26, 1, '#7fc0f0'); }
}
tile('corner_tl', { solid: true }, (c) => sphereCorner(c, false, true));
tile('corner_tr', { solid: true }, (c) => sphereCorner(c, true, true));
tile('side_l', { solid: true }, (c) => sphereCorner(c, false, false));
tile('side_r', { solid: true }, (c) => sphereCorner(c, true, false));
tile('lfloor', { variants: 4 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#5a5f6b');
  for (let i = 0; i < 36; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#626774' : '#525762');
  if (v === 0) { P(c, 9, 9, '#8a909c'); P(c, 24, 20, '#8a909c'); }
});
tile('scope', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 8, 2);
  R(c, 15, 14, 3, 14, STEEL); R(c, 15, 14, 1, 14, '#9aa1ac');
  R(c, 10, 26, 13, 3, '#5f6672'); R(c, 10, 26, 13, 1, STEEL);
  R(c, 8, 6, 18, 7, ORG); R(c, 8, 6, 18, 2, ORGL); R(c, 8, 12, 18, 1, ORGD);
  R(c, 5, 7, 4, 5, GRAPH); R(c, 25, 5, 4, 9, GRAPH); R(c, 26, 6, 2, 7, '#5fb4ec');
  R(c, 14, 13, 5, 2, '#5f6672');
  outline(c);
});

// ====================================================================== props
function textSign(x, y, w, h, label) {
  return {
    type: 'prop', x, y, w, h, solid: false,
    talk: async (g) => { await g.say('「フジテレビ」の大きな看板だ。\n銀色のパネルに、オレンジレッドのラインが光っている。'); },
    draw(ctx, sx, sy) {
      blit(ctx, baked('sign|' + label, w * 16, h * 16, (c) => {
        const W = w * 32, Hh = Math.round(h * 32);
        R(c, 2, 2, W - 4, Hh - 4, GRAPH); R(c, 4, 4, W - 8, Hh - 8, '#3a3e47'); R(c, 4, 4, W - 8, 1, '#5f6672');
        R(c, 6, Hh - 14, W - 12, 4, ORG); R(c, 6, Hh - 14, W - 12, 1, ORGL);
        ring(c, 22, Hh / 2 - 4, 7, 10, ORG); oval(c, 15, Hh / 2 - 11, 14, 14, SIL); oval(c, 16, Hh / 2 - 11, 10, 10, WHT);
        text(c, label, W / 2 + 10, 10, { size: 26, align: 'center', color: WHT, shadow: '#14161a' });
        outline(c);
      }), sx, sy);
    },
  };
}
function plate(x, y, label, w = 3) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      blit(ctx, baked('plate|' + label + '|' + w, w * 16, 13, (c) => {
        const W = w * 32;
        R(c, 0, 2, W, 22, GRAPH); R(c, 1, 3, W - 2, 20, '#4a4f58'); R(c, 1, 3, W - 2, 1, '#6a707b');
        R(c, 1, 20, W - 2, 3, ORG);
        text(c, label, W / 2, 5, { size: 14, align: 'center', color: WHT, shadow: '#14161a' });
        outline(c);
      }), sx, sy + 1);
    },
  };
}
// round rug in the middle of the sphere lounge (drawn under everyone)
function paintRug(c) {
  oval(c, 0, 0, 192, 96, '#4a4f58');
  oval(c, 4, 3, 184, 90, '#e8e2d8');
  oval(c, 14, 8, 164, 80, ORG);
  oval(c, 20, 11, 152, 74, '#f2ece2');
  oval(c, 60, 30, 72, 36, ORGP);
  oval(c, 72, 36, 48, 24, '#f2ece2');
}

// ====================================================================== characters
const L = {
  recep: { ...LOOKS.receptionist, top: ORG, bottom: '#3a3e47' },
  recep2: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: '#3a3e47', bottom: '#3a3e47', tie: ORG },
  guard: LOOKS.guard,
  ad: { ...LOOKS.ad, top: ORG },
  ad2: { ...LOOKS.ad, hair: 'cap', hat: GRAPH, hairColor: 'black', top: '#6a707b' },
  director: { ...LOOKS.director, hat: ORG },
  writer: { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: '#3b3f48', glasses: true },
  producer: { ...LOOKS.manager, tie: ORG, top: '#6a707b', bottom: '#6a707b' },
  makeup: { ...LOOKS.makeup, hairColor: 'black', top: '#4a4f58' },
  stylist: { hair: 'bob', hairColor: 'pink', skin: 'light', top: '#ffd23f', bottom: '#3b3f48', skirt: true },
  konto: { ...LOOKS.comedian2, top: '#5fd7ff', glasses: true },
  konto2: { ...LOOKS.comedian, hairColor: 'black', top: '#ff8a3d' },
  visitor: LOOKS.tourist,
  photo: { ...LOOKS.oldman, top: '#5a6f8a', hair: 'cap', hat: '#3b3f48' },
  designer: { hair: 'long', hairColor: 'blonde', skin: 'light', top: '#1e1e26', bottom: '#1e1e26', glasses: 'sun' },
  barista: { ...LOOKS.clerk, top: '#3a3e47', apron: ORG },
  lounge: { ...LOOKS.receptionist, top: '#3a3e47', bottom: '#3a3e47', tie: ORG },
  fan: { ...LOOKS.fan, top: ORGL },
  granny: LOOKS.oldwoman,
  kid: { ...LOOKS.kid, top: '#5fd7ff' },
  cameraman: LOOKS.cameraman,
};
const SP = {
  recep: { name: '受付さん', look: L.recep },
  guard: { name: '警備員さん', look: L.guard },
  lounge: { name: 'ラウンジのスタッフ', look: L.lounge },
};

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

async function tsukoninTalk(g, npc) {
  const s = as(npc);
  await g.say(['コントの通行人役、ひとり足りないんです！', '台本は「歩く」「振り返る」「おどろく」の3つだけ。…でも、これが案外むずかしいんですよ。'], s);
  const res = await g.job({
    id: 'fujitv_tsukonin', title: 'コントの通行人役', desc: '商店街のセットを、自然に歩いて通りすぎよう！', client: npc.name, clientLook: npc.look,
    stamina: 15, minigame: 'command', opts: { difficulty: 1, theme: 'acting' },
    pay: 1000, fame: 4, skill: 'engi', gain: 1,
  });
  if (res && (res.rank === 'S' || res.rank === 'A')) await g.say('今のおどろき方、最高でした！\n通行人なのに、ちょっと目立ちすぎちゃったかも…！', s);
  else if (res) await g.say('おつかれさまでした！\n通行人も、立派な出演者ですからね。', s);
}

async function tsukkomiTalk(g, npc) {
  const s = as(npc);
  await g.say(['コントのツッコミ役を探してるんだ。', 'ボケを最後まで聞いて、いちばんいいタイミングでビシッと。フリにつられちゃダメだよ。'], s);
  await g.job({
    id: 'fujitv_tsukkomi', title: 'コント番組のツッコミ役', desc: '商店街のコントで、ボケにビシッとツッコもう！', client: npc.name, clientLook: npc.look,
    stamina: 20, minigame: 'tsukkomi', opts: { difficulty: 2 },
    pay: 4500, fame: 18, skill: 'warai', gain: 2, requires: TIER1,
  });
}

async function kanran(g, npc) {
  const s = as(npc);
  if (today(g, 'fujitv_kanran_day')) { await g.say('今日の観覧はおしまいです。\nまた明日、笑いに来てくださいね！', s); return; }
  const i = await g.ask(['コント収録の観覧、まだお席あります！', '客席で見ていきませんか？（無料・1日1回）'], ['見ていく', 'またこんど'], s);
  if (i !== 0) { await g.say('いつでもどうぞ！', s); return; }
  markToday(g, 'fujitv_kanran_day');
  await g.fadeOut(16);
  g.sfx('laugh');
  await g.wait(500);
  g.sfx('laugh');
  await g.wait(400);
  g.sfx('applause');
  await g.wait(400);
  await g.fadeIn(16);
  g.relax({ stress: 10 });
  g.sfx('good');
  await g.say(['セットの食堂から、次々に変な客が出てくるコントだった！', 'おなかが痛くなるほど笑った。（ストレス -10）']);
}

async function mirror(g) {
  if (today(g, 'fujitv_mirror_day')) { await g.say('（髪も服も、もうバッチリ整っている）'); return; }
  const i = await g.ask('ライトつきの鏡だ。身だしなみを整える？', ['整える', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'fujitv_mirror_day');
  g.bathe(35, true);
  g.sfx('good');
  await g.say('前髪をととのえて、えりもピシッと直した。\nよし、どこから撮られても大丈夫！（身だしなみ +35・1日1回）');
}

async function rest(g) {
  if (today(g, 'fujitv_rest_day')) { await g.say('（もう十分休んだ。\nそろそろ動き出そう！）'); return; }
  const i = await g.ask('ここで、ちょっとひと休みする？', ['休む', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'fujitv_rest_day');
  await g.fadeOut(16);
  g.sfx('sleep');
  await g.wait(700);
  await g.fadeIn(16);
  g.relax({ stress: 8, stamina: 20 });
  await g.say('目を閉じて、深呼吸をくり返した。\n遠くで波の音が聞こえた…気がする。（体力 +20・ストレス -8・1日1回）');
}

async function viewWindow(g) {
  if (today(g, 'fujitv_view_day')) { await g.say('海と街がきらきらしている。\nいつまでも見ていられそうだ。'); return; }
  markToday(g, 'fujitv_view_day');
  await g.say(['ガラスの向こうに、湾岸の街が一望できる。', '白い吊り橋、行き交う船、遠くの観覧車…。']);
  g.relax({ stress: 12 });
  g.sfx('good');
  await g.say('ぼんやり景色をながめていたら、気持ちがすーっと軽くなった。\n（ストレス -12・1日1回）');
}

const SCOPE_VIEWS = [
  '望遠鏡をのぞいた。\n白い吊り橋の上を、車がおもちゃみたいに走っている。',
  '望遠鏡をのぞいた。\n遊覧船のデッキで、子どもが大きく手をふっている！',
  '望遠鏡をのぞいた。\n観覧車のてっぺんのゴンドラが、ゆっくり下りていく。',
  '望遠鏡をのぞいた。\nカモメが3羽、きれいに並んで飛んでいる。',
];

async function coffee(g, npc) {
  const s = as(npc);
  if (today(g, 'fujitv_coffee_day')) { await g.say('本日のサービスの一杯は、もうお出ししました。\nまたのお越しを！', s); return; }
  const i = await g.ask(['いらっしゃいませ。展望コーヒースタンドです。', '出演者の方には、景色つきの一杯をサービスしています。いかがですか？'], ['いただきます', 'またこんど'], s);
  if (i !== 0) return;
  markToday(g, 'fujitv_coffee_day');
  g.relax({ stress: 6, stamina: 5 });
  g.sfx('good');
  await g.say('海を見ながら、あたたかいコーヒーをひと口。\n…しみる。（体力 +5・ストレス -6・1日1回）');
}

// ====================================================================== place
registerPlace({
  id: PID,
  name: 'フジテレビ',
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
        '#uuuuuuuuuuuuuuABCu#',
        '#=gg==v======v=abc=#',
        '#....|.............#',
        '#....|.KKKKKK.....P#',
        '#ILILI...()........#',
        '#........()........#',
        '#........()..oo.oo.#',
        '#.Q......()..rr.rr.#',
        '#........()........#',
        '#P.......().......P#',
        '#########MM#########',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'),
        ...bigLegend('vision', ['ABC', 'abc'], [T('wall_u'), T('wall2')]),
        v: `${T('wall2')}+tv_wall`, g: 'door_glass', '|': T('glass_v'), K: T('counter'),
        I: T('gate'), L: T('lane'), '(': T('walk_l'), ')': T('walk_r'), o: T('pod'), r: T('rtable'), P: 'plant', Q: 'water_server',
      },
      warps: [
        ...exitWarps([9, 10], 11),
        { x: 2, y: 2, room: 'corridor', tx: 2, ty: 5, dir: 'up' },
        { x: 3, y: 2, room: 'corridor', tx: 3, ty: 5, dir: 'up' },
      ],
      entities: [
        textSign(7.5, 1.1, 5, 1.8, 'フジテレビ'),
        plate(1.5, 1, 'スタジオ', 3),
        {
          type: 'sign', x: 16, y: 2,
          talk: async (g) => { await g.say(['大型ビジョンだ。コント、海の空撮、局のマーク…と映像が切りかわっていく。', 'オレンジの光が、銀色のロビーによく映える。']); },
        },
        { type: 'sign', x: 6, y: 2, text: 'オンエアモニターだ。\nいま放送中の番組が、音を消して流れている。' },
        { type: 'sign', x: 13, y: 2, text: 'オンエアモニターだ。\n天気予報によると、湾岸は今日も晴れらしい。' },
        { type: 'npc', id: 'fuji_recep', x: 8, y: 3, dir: 'down', look: L.recep, name: '受付さん', talk: async (g, npc) => programDesk(g, PID, npc) },
        {
          type: 'npc', id: 'fuji_info', x: 11, y: 3, dir: 'down', look: L.recep2, name: 'ご案内',
          text: [
            'フジテレビへようこそ！ゲートの奥が、スタジオと楽屋のフロアです。',
            '廊下のつきあたりのエレベーターで、球体の展望ラウンジに上がれます。景色、すごいですよ！',
            'バラエティスタジオのADさんが、コントの通行人役を探していましたよ。',
          ],
        },
        {
          type: 'npc', id: 'fuji_guard', x: 5, y: 6, dir: 'down', look: L.guard, name: '警備員さん',
          text: ['ゲストの方は、ゲートをそのままお通りください。', '海風の強い日は、自動ドアがたまに勝手に開くんです。…幽霊じゃありませんよ。'],
        },
        {
          type: 'npc', id: 'fuji_visitor', x: 15, y: 9, dir: 'up', look: L.visitor, name: '観光客さん',
          text: ['あの丸い球体、近くで見るとほんとに大きい！', '展望ラウンジから海が見えるって聞いて、写真を撮りに来たんです。'],
        },
        {
          type: 'npc', id: 'fuji_stylist', x: 12, y: 8, dir: 'right', look: L.stylist, name: 'スタイリストさん', wander: 1,
          text: ['衣装、スーツケース3つ分。腕がパンパンです…！', 'オレンジのアクセントは、銀色のセットでも映えるからおすすめよ。'],
        },
        {
          type: 'npc', id: 'fuji_kid', x: 4, y: 9, dir: 'up', look: L.kid, name: '見学の子ども', wander: 1,
          text: ['ここ、宇宙船みたい！', 'あのイス、たまごみたいでかわいいね！'],
        },
      ],
      events: [
        {
          x: 9, y: 9, w: 2, on: 'step', once: 'fujitv_welcome',
          run: async (g) => {
            await g.emote('fuji_recep', '!');
            await g.say(['フジテレビへようこそ！', '番組の出演のご相談は、受付まで。スタジオへは左のゲートからどうぞ！'], SP.recep);
          },
        },
        {
          x: 2, y: 5, w: 3, on: 'step', once: 'fujitv_pass',
          run: async (g) => {
            await g.emote('fuji_guard', '!');
            await g.say(['あっ、はじめての方ですね。こちら、ゲスト用の入館証です。', 'なくすと再発行に30分かかるので、首からさげておいてくださいね。'], SP.guard);
            g.sfx('ok');
            await g.say('（オレンジのストラップの入館証を受け取った）');
          },
        },
      ],
    },

    // ------------------------------------------------------------------ スタジオ廊下
    corridor: {
      floor: T('floor'),
      tiles: [
        '########################',
        '#uuuuuuuuuuuuuuuuuuuuuu#',
        '#==d=p==ODD=p===EE==p==#',
        '#Q....................V#',
        '#......................#',
        '#....P....o.o.....P....#',
        '##MM####################',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'), p: `${T('wall2')}+poster`,
        d: 'door_wood', D: 'door_metal', O: `${T('wall2')}+onair`, E: 'elevator',
        Q: 'water_server', V: 'vending', o: T('pod'), P: 'plant', M: 'exit_mat',
      },
      warps: [
        { x: 2, y: 6, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
        { x: 3, y: 6, room: 'lobby', tx: 3, ty: 3, dir: 'down' },
        { x: 3, y: 2, room: 'gakuya', tx: 6, ty: 7, dir: 'up' },
        { x: 9, y: 2, room: 'studio', tx: 9, ty: 10, dir: 'up' },
        { x: 10, y: 2, room: 'studio', tx: 10, ty: 10, dir: 'up' },
        { x: 16, y: 2, room: 'sphere', tx: 7, ty: 9, dir: 'up' },
        { x: 17, y: 2, room: 'sphere', tx: 8, ty: 9, dir: 'up' },
      ],
      entities: [
        plate(2, 1, '楽屋', 3),
        plate(7.5, 1, 'バラエティ', 5),
        plate(15, 1, '球体ラウンジ', 5),
        {
          type: 'npc', id: 'fuji_ad', x: 7, y: 4, dir: 'right', look: L.ad2, name: 'AD', wander: 2,
          text: ['すみませーん、小道具通りまーす！ハリセン3本と、ゴムのニワトリ1羽でーす！', 'エレベーターで上がると、球体の展望ラウンジ。休憩のとっておきスポットです。'],
        },
        {
          type: 'npc', id: 'fuji_producer', x: 13, y: 3, dir: 'down', look: L.producer, name: 'プロデューサー',
          text: ['会議室の窓から海が見えるとね、企画がどんどん浮かぶんだ。…浮かびすぎて、まとまらないけど。', '笑いはチームプレー。演者もスタッフも、全員で一個のコントを作るんだよ。'],
        },
        {
          type: 'npc', id: 'fuji_konto2', x: 20, y: 4, dir: 'left', look: L.konto2, name: 'コント師さん',
          text: ['今日のコントの設定？「食堂に来た客が、全員宇宙人」。', '着ぐるみ、ちょっと暑いんだよなあ…。'],
        },
      ],
    },

    // ------------------------------------------------------------------ 楽屋
    gakuya: {
      floor: 'floor_wood',
      tiles: [
        '##############',
        '#c=p===MM=MM=#',
        '#L.....kk.kk.#',
        '#L...........#',
        '#...oo...ZZZZ#',
        '#........ZYYZ#',
        '#.SS.....ZZZZ#',
        '#R..........F#',
        '######mm######',
      ],
      legend: {
        '#': 'walltop_gray', '=': 'wall_gray', M: 'wall_gray+mirror', p: 'wall_gray+poster', c: 'wall_gray+clock',
        k: 'makeup', L: 'locker', Z: 'floor_tatami', Y: 'floor_tatami+table_low', o: 'table_low', S: 'sofa_beige',
        F: 'flower_stand', R: 'clothes_rack', m: 'exit_mat',
      },
      warps: [
        { x: 6, y: 8, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
        { x: 7, y: 8, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'fuji_makeup', x: 9, y: 3, dir: 'down', look: L.makeup, name: 'メイクさん',
          text: ['コントの前は、メイクもちょっと大げさに。遠くの客席からでも表情がわかるようにね。', '鏡はいつでも使っていいわよ。身だしなみが整うと、お仕事の評判もちがうんだから。'],
        },
        {
          type: 'npc', id: 'fuji_konto', x: 3, y: 5, dir: 'up', look: L.konto, name: 'コント師さん',
          text: ['台本のこのセリフ、「ちょっと待ってくださいよ〜」で合ってるかな…いや「待ってくださいよぉ」か…？', '語尾ひとつで笑いの量が変わる。コントって、奥が深いんだよ。'],
        },
        { type: 'sign', x: 12, y: 7, text: '「祝・ご出演」のスタンド花だ。\nオレンジのガーベラが元気いっぱいに咲いている。' },
        { type: 'sign', x: 3, y: 1, text: '楽屋のポスターだ。\n「海を見て、深呼吸。」…スタッフの手書きの標語らしい。' },
      ],
      events: [
        { x: 7, y: 2, w: 2, on: 'action', run: mirror },
        { x: 10, y: 2, w: 2, on: 'action', run: mirror },
        { x: 10, y: 5, w: 2, on: 'action', run: rest },
        { x: 2, y: 6, w: 2, on: 'action', run: rest },
        { x: 4, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('テーブルに、ゴムのニワトリが置いてある。\n…小道具さんの忘れ物かな？'); } },
      ],
    },

    // ------------------------------------------------------------------ バラエティスタジオ（コントの街並み）
    studio: {
      floor: T('sfloor'),
      bgm: 'studio',
      topPad: 24,
      tiles: [
        '####################',
        '#uuuuuABCDEFGHuuuuu#',
        '#=O===abcdefgh===O=#',
        '#....,,,,,,,,,,....#',
        '#....,J,,,,,,X,....#',
        '#....eeeeeeeeee....#',
        '#..................#',
        '#...C.....C....C...#',
        '#..................#',
        '#.SSSSSSS..SSSSSSS.#',
        '#..................#',
        '#########MM#########',
      ],
      legend: {
        '#': T('walltop'), u: T('swall_u'), '=': T('swall'), O: `${T('swall')}+onair`,
        ...bigLegend('konto', ['ABCDEFGH', 'abcdefgh']),
        ',': 'floor_stage', J: 'floor_stage+bench', X: 'floor_stage+lamp', e: 'stage_edge',
        C: 'camera', S: 'seat', M: 'exit_mat',
      },
      warps: [
        { x: 9, y: 11, room: 'corridor', tx: 9, ty: 3, dir: 'down' },
        { x: 10, y: 11, room: 'corridor', tx: 10, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'fuji_senpai', x: 8, y: 3, dir: 'down', look: L.konto, name: 'コント師の先輩',
          text: ['このセット、ぜんぶベニヤ板なんだぜ。食堂のドアも、開けたら壁。', 'コントの基本は「ふり・ボケ・ツッコミ」。この3つで、世界はだいたい笑える。'],
        },
        { type: 'npc', id: 'fuji_extra_ad', x: 3, y: 6, dir: 'right', look: L.ad, name: 'AD', talk: tsukoninTalk },
        { type: 'npc', id: 'fuji_dir', x: 17, y: 6, dir: 'left', look: L.director, name: 'ディレクター', talk: tsukkomiTalk },
        {
          type: 'npc', id: 'fuji_writer', x: 16, y: 3, dir: 'down', look: L.writer, name: '放送作家さん',
          text: ['ネタ帳？これで37冊目。ほとんど「おなかすいた」って書いてある。', '面白いコントは、まず設定がひと言で言えるんだ。「宇宙人だらけの食堂」みたいにね。'],
        },
        { type: 'npc', id: 'fuji_kanran', x: 18, y: 8, dir: 'left', look: L.ad2, name: '観覧係のAD', talk: kanran },
        { type: 'npc', id: 'fuji_fan', x: 5, y: 9, dir: 'up', look: L.fan, name: '観覧のお客さん', text: ['コントの収録って、同じ場面を何回もやるんだね！', 'でも、何回見ても笑っちゃう。プロってすごい！'] },
        { type: 'npc', id: 'fuji_granny', x: 14, y: 9, dir: 'up', look: L.granny, name: '観覧のおばあさん', text: ['あの食堂のセット、むかし近所にあったお店にそっくりでねえ。', 'なつかしくて、笑いながらちょっと泣いちゃったわ。'] },
        { type: 'npc', id: 'fuji_cam', x: 11, y: 7, dir: 'up', look: L.cameraman, name: 'カメラマン', text: ['コントは「引き」の画が大事。全身のおかしな動きを、ぜんぶ映したいからね。'] },
      ],
      events: [
        { x: 6, y: 4, on: 'action', run: async (g) => { await g.say('公園のベンチ…のセットだ。\n座ってみたら、ちゃんと座れた。ちょっと感動。'); } },
        { x: 13, y: 4, on: 'action', run: async (g) => { await g.say('街灯のセットだ。\nスイッチを押すと、ほんとうに明かりがついた！'); } },
      ],
    },

    // ------------------------------------------------------------------ 球体ラウンジ
    sphere: {
      floor: T('lfloor'),
      bgm: 'office',
      tiles: [
        '################',
        '#(ABCDEFGHIJKL)#',
        '#[abcdefghijkl]#',
        '#..............#',
        '#.T..........T.#',
        '#..............#',
        '#.oro......oro.#',
        '#..............#',
        '##..........KK##',
        '###..........###',
        '#######MM#######',
      ],
      legend: {
        '#': T('walltop'), '(': T('corner_tl'), ')': T('corner_tr'), '[': T('side_l'), ']': T('side_r'),
        ...bigLegend('view', ['ABCDEFGHIJKL', 'abcdefghijkl']),
        T: T('scope'), o: T('pod'), r: T('rtable'), K: T('counter'), M: 'exit_mat',
      },
      warps: [
        { x: 7, y: 10, room: 'corridor', tx: 16, ty: 3, dir: 'down' },
        { x: 8, y: 10, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
      ],
      drawUnder(ctx, g, cam) {
        blit(ctx, baked('rug', 96, 48, paintRug), 5 * 16 - cam.x, 4.75 * 16 - cam.y);
      },
      entities: [
        {
          type: 'npc', id: 'fuji_lounge', x: 7, y: 3, dir: 'down', look: L.lounge, name: 'ラウンジのスタッフ',
          text: ['ここは、出演者とスタッフのための展望ラウンジです。', 'ガラスが丸く外にふくらんでいるので、まるで空に浮かんでいるみたいでしょう？', '夕方になると、海がオレンジ色に染まって…それはもう、きれいなんですよ。'],
        },
        { type: 'npc', id: 'fuji_barista', x: 12, y: 7, dir: 'down', look: L.barista, name: 'コーヒースタンド', talk: coffee },
        {
          type: 'npc', id: 'fuji_photo', x: 4, y: 5, dir: 'up', look: L.photo, name: '写真好きのおじさん', fixedDir: true,
          text: ['この窓から、吊り橋と観覧車がいっしょに撮れるんじゃよ。', '朝と夕方で、海の色がまるでちがう。毎日来ても飽きんのう。'],
        },
        {
          type: 'npc', id: 'fuji_designer', x: 10, y: 4, dir: 'up', look: L.designer, name: 'デザイナーさん', fixedDir: true,
          text: ['番組のセットのデザインに行きづまったら、ここで海を見るの。', '丸い窓って、ふしぎと発想もまるくやわらかくなるのよね。'],
        },
        { type: 'sign', x: 2, y: 4, talk: async (g) => { await g.say(SCOPE_VIEWS[g.state.day % SCOPE_VIEWS.length]); } },
        { type: 'sign', x: 13, y: 4, talk: async (g) => { await g.say(SCOPE_VIEWS[(g.state.day + 2) % SCOPE_VIEWS.length]); } },
      ],
      events: [
        { x: 2, y: 2, w: 12, on: 'action', run: viewWindow },
        {
          x: 2, y: 8, w: 10, on: 'step', once: 'fujitv_sphere_intro',
          run: async (g) => {
            await g.emote('fuji_lounge', '!');
            await g.say(['ようこそ、球体ラウンジへ！', 'ここは建物の上にある、丸い展望ラウンジです。窓ぎわで、ゆっくり景色を楽しんでくださいね。'], SP.lounge);
            await g.emote('player', '!');
            await g.say('（ガラスの向こうに、海と街がどこまでも広がっている…！）');
          },
        },
      ],
    },
  },
});
