// テレビ東京（港エリア）— こぢんまりとして、あったかい雰囲気のテレビ局
//
// 部屋：
//   lobby    エントランス   受付（番組の出演依頼＝programDesk）・セキュリティゲート・待合のベンチ・
//                          大型ビジョンとオンエアモニター・「テレビ東京」の看板
//   corridor スタジオ廊下  楽屋・スタジオ・ロケ車ガレージへのドア
//   gakuya   楽屋          全部たたみの和室。メイク台の鏡（身だしなみ）・ちゃぶ台でひと休み（体力・ストレス）
//   studio   スタジオ      旅とグルメの情報番組のセット（たたみの茶の間・VTRモニター）と観覧席
//   garage   ロケ車ガレージ ロケ車・機材ラック・ホワイトボードのロケ予定。ロケのお仕事はここから
//
// お仕事（すべて架空。実在の番組・出演者は出さない）：
//   段階0  ロケのお手伝い（取材交渉・ガレージのAD）       talk d1（交渉の場面）
//   段階1  VTRのワイプ出演（スタジオのディレクター）      talk d2（VTRへのリアクション）  所属 または ★30
//   段階2  ご当地グルメロケのリポーター（ロケディレクター） talk d3 local                     ★250
//   ほか   番組観覧（1日1回・無料・ストレス -10）、楽屋の鏡・ちゃぶ台（各1日1回）
// 1回きりのイベント：はじめての入館、ゲートで入館証、ガレージで機材運びのお手伝い（おにぎり）

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, Pw, pix, oval, disc, line, bevel, outline, shadowEllipse } from '../engine/tiles.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, mix } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

const PID = 'tvtokyo';
const T = (k) => `${PID}_${k}`;

// ====================================================================== palette
const GRN = '#2fae5a';
const GRND = '#1f7a3e';
const GRNL = '#6fd68f';
const GRNP = '#d8f5e0';
const BLU = '#36a3e0';
const CREAM = '#fbf7ec';
const WOOD = '#c48a52';
const WOODD = '#8a5a33';
const WHT = '#ffffff';
const INK = '#22202a';
const DG = '#5a5f6b';

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
// --- walls & floors: cream walls with a green band and a wooden skirting
tile('walltop', { solid: true }, (c) => R(c, 0, 0, 32, 32, '#33402f'));
function wallFace(c, lip, band) {
  R(c, 0, 0, 32, 32, CREAM);
  for (let x = 3; x < 32; x += 8) R(c, x, 0, 1, 32, '#f4eedd');
  if (lip) { R(c, 0, 0, 32, 1, '#d8ccb0'); R(c, 0, 1, 32, 1, WHT); }
  if (band) {
    R(c, 0, 15, 32, 3, GRN); R(c, 0, 15, 32, 1, GRNL); R(c, 0, 18, 32, 1, GRND);
    R(c, 0, 25, 32, 7, WOOD); R(c, 0, 25, 32, 1, '#e0a870'); R(c, 0, 30, 32, 2, WOODD);
  }
}
tile('wall_u', { solid: true }, (c) => wallFace(c, true, false));
tile('wall2', { solid: true }, (c) => wallFace(c, false, true));
tile('wall', { solid: true }, (c) => wallFace(c, true, true));
// terrazzo floor with little green and blue chips
function terrazzo(c, r, v) {
  R(c, 0, 0, 32, 32, '#efece4');
  for (let i = 0; i < 30; i++) Pw(c, RND(r, 32), RND(r, 32), ['#d9d4c8', '#c8e8d2', '#cfe6f4', '#e2ded4'][i % 4]);
  R(c, 0, 0, 32, 1, '#dcd7cb'); R(c, 0, 0, 1, 32, '#dcd7cb');
  if (v === 0) { R(c, 5, 5, 5, 1, WHT); P(c, 5, 6, WHT); }
}
tile('floor', { variants: 4 }, (c, r, f, v) => terrazzo(c, r, v));
const ARROW = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..', '..###..'];
tile('lane', {}, (c, r) => {
  terrazzo(c, r, 1);
  R(c, 1, 0, 2, 32, '#d6d0c2'); R(c, 29, 0, 2, 32, '#d6d0c2');
  pix(c, ARROW, { '#': '#a8dcb8' }, 13, 12);
});
function runner(c, r, left) {
  R(c, 0, 0, 32, 32, GRN);
  for (let i = 0; i < 40; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#2aa052' : '#38b862');
  R(c, left ? 0 : 27, 0, 5, 32, GRND); R(c, left ? 5 : 26, 0, 1, 32, GRNL);
}
tile('run_l', {}, (c, r) => runner(c, r, true));
tile('run_r', {}, (c, r) => runner(c, r, false));

// --- lobby furniture
tile('counter', { solid: true, obj: true, talkThrough: true, variants: 3 }, (c, r, f, v) => {
  R(c, 0, 3, 32, 13, '#e0b884'); R(c, 0, 3, 32, 1, '#f2d4a8'); R(c, 0, 14, 32, 2, '#b88a58');
  for (let i = 0; i < 4; i++) R(c, RND(r, 24), 6 + RND(r, 7), 6, 1, '#d4aa74');
  R(c, 0, 16, 32, 16, GRN); R(c, 0, 16, 32, 2, GRND); R(c, 0, 19, 32, 1, GRNL);
  R(c, 4, 21, 24, 6, '#38b862'); R(c, 4, 21, 24, 1, GRND); R(c, 4, 26, 24, 1, GRNL);
  R(c, 0, 29, 32, 3, GRND);
  if (v === 1) { R(c, 17, 0, 12, 10, INK); R(c, 18, 1, 10, 7, '#7fd8ff'); R(c, 18, 1, 10, 1, '#c8f0ff'); R(c, 21, 10, 4, 3, DG); }
  if (v === 2) { R(c, 4, 7, 10, 6, '#fff7e0'); R(c, 5, 8, 8, 1, '#c3c9d1'); disc(c, 21, 9, 3, '#ff9a3c'); R(c, 21, 5, 1, 2, '#2f9a4a'); }
  outline(c);
});
tile('gate', { solid: true, obj: true, frames: 2, speed: 40 }, (c, r, f) => {
  shadowEllipse(c, 16, 29, 9, 2);
  c.fillStyle = 'rgba(190,228,255,0.6)';
  c.fillRect(3, 13, 6, 9); c.fillRect(23, 13, 6, 9);
  R(c, 3, 13, 6, 1, '#f0faff'); R(c, 23, 13, 6, 1, '#f0faff');
  bevel(c, 9, 5, 14, 24, '#c9ced8');
  R(c, 9, 5, 14, 6, '#eef1f5'); R(c, 9, 5, 14, 1, WHT);
  R(c, 11, 6, 10, 4, '#3b3f48'); R(c, 12, 7, 8, 1, DG); P(c, 19, 8, f ? '#5ee07a' : '#2f9a4a');
  R(c, 10, 13, 12, 1, GRN);
  R(c, 12, 16, 8, 4, INK); R(c, 13, 17, 6, 2, f ? '#5ee07a' : '#2f9a4a');
  R(c, 9, 25, 14, 4, '#8e94a0'); R(c, 9, 25, 14, 1, '#a9aeb8');
  outline(c);
});
tile('glass_v', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 30, 5, 1);
  c.fillStyle = 'rgba(190,228,255,0.55)'; c.fillRect(13, 0, 6, 30);
  R(c, 14, 0, 1, 30, 'rgba(255,255,255,0.85)');
  R(c, 12, 28, 8, 3, '#9aa0aa'); R(c, 12, 28, 8, 1, '#c3c8d2');
  R(c, 18, 0, 1, 28, '#9fb8cc');
});
// padded waiting bench (green seat, wooden frame)
tile('bench', { solid: true, obj: true, variants: 2 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 28, 16, 2);
  R(c, 0, 8, 32, 8, WOOD); R(c, 0, 8, 32, 1, '#e0a870'); R(c, 0, 15, 32, 1, WOODD);
  R(c, 0, 16, 32, 8, GRN); R(c, 0, 16, 32, 2, GRNL); R(c, 0, 23, 32, 1, GRND);
  if (v) R(c, 31, 16, 1, 8, GRND);
  R(c, 3, 24, 3, 5, WOODD); R(c, 26, 24, 3, 5, WOODD);
  outline(c);
});
// floor cushion (zabuton), walkable
tile('zabuton', { obj: true }, (c) => {
  shadowEllipse(c, 16, 26, 11, 2);
  R(c, 7, 12, 18, 13, '#5a3f8a'); R(c, 6, 13, 20, 11, '#5a3f8a');
  R(c, 7, 12, 18, 2, '#8a6ac0'); R(c, 6, 14, 1, 8, '#7a5ab0'); R(c, 7, 24, 18, 1, '#3f2a66');
  R(c, 10, 15, 12, 6, '#6a4f9e');
  P(c, 16, 18, '#f2e6c8'); P(c, 15, 18, '#c9b88e');
  for (const [x, y] of [[5, 12], [26, 12], [5, 24], [26, 24]]) P(c, x, y, '#e8c43a');
  outline(c);
});

// --- big video wall (3 x 2): bus-trip footage / a cheerful chart / station ident
function paintVision(c, f) {
  R(c, 0, 3, 96, 59, '#20262a'); R(c, 0, 3, 96, 1, '#3b4448'); R(c, 0, 61, 96, 1, '#101416');
  const x0 = 4, y0 = 7, w = 88, h = 50;
  if (f === 0) {
    for (let y = 0; y < 30; y++) R(c, x0, y0 + y, w, 1, mix('#8fd0f5', '#e8f6ff', y / 30));
    for (let x = 0; x < w; x++) { const m = 20 - Math.round(8 * Math.abs(Math.sin((x + 5) / 11))); R(c, x0 + x, y0 + m, 1, 30 - m, '#7ab86a'); }
    R(c, x0, y0 + 30, w, 20, '#9a9ca2'); R(c, x0, y0 + 39, w, 1, '#f2f2f2');
    for (let x = 4; x < w; x += 14) R(c, x0 + x, y0 + 39, 7, 1, '#9a9ca2');
    // the location bus
    R(c, x0 + 20, y0 + 18, 46, 18, WHT); R(c, x0 + 20, y0 + 18, 46, 1, '#f2f2f2');
    R(c, x0 + 20, y0 + 27, 46, 3, GRN); R(c, x0 + 24, y0 + 20, 36, 6, '#3a6fb8');
    for (let x = 30; x < 60; x += 8) R(c, x0 + x, y0 + 20, 1, 6, WHT);
    disc(c, x0 + 29, y0 + 36, 3, INK); disc(c, x0 + 57, y0 + 36, 3, INK);
    R(c, x0 + 2, y0 + 42, 30, 6, 'rgba(0,0,0,0.45)'); R(c, x0 + 4, y0 + 44, 22, 1, WHT);
  } else if (f === 1) {
    R(c, x0, y0, w, h, '#f6fbf7');
    for (let y = 8; y < h; y += 8) R(c, x0, y0 + y, w, 1, '#dcefe2');
    let py = 38;
    for (let x = 4; x < w - 4; x++) {
      const ny = Math.round(38 - x * 0.32 + 4 * Math.sin(x / 5));
      line(c, x0 + x - 1, y0 + py, x0 + x, y0 + ny, GRN); py = ny;
    }
    for (let i = 0; i < 6; i++) { const bh = 6 + i * 4; R(c, x0 + 8 + i * 12, y0 + h - 4 - bh, 7, bh, i % 2 ? '#a8dcb8' : '#cfe6f4'); }
    R(c, x0, y0, w, 7, GRN); R(c, x0 + 4, y0 + 3, 30, 1, WHT);
  } else {
    for (let y = 0; y < h; y++) R(c, x0, y0 + y, w, 1, mix('#e8f8ee', '#bfe9cd', y / h));
    disc(c, x0 + 44, y0 + 20, 13, GRN); disc(c, x0 + 44, y0 + 20, 9, '#e8f8ee'); disc(c, x0 + 44, y0 + 20, 5, BLU);
    R(c, x0 + 24, y0 + 38, 41, 9, GRN);
    pix(c, ONAIR, { '#': WHT }, x0 + 35, y0 + 40);
  }
  R(c, x0 - 1, y0 - 1, w + 2, 1, '#151a1c'); R(c, x0 - 1, y0 + h, w + 2, 1, '#3b4448');
  R(c, 84, 58, 3, 2, '#ff2b3a'); R(c, 6, 58, 20, 1, DG);
  outline(c);
}
bigTiles('vision', 3, 2, { solid: true, obj: true, frames: 3, speed: 150 }, paintVision);

// --- studio: wood-panelled walls and the travel & gourmet backdrop (6 x 2)
tile('sfloor', { variants: 16 }, (c, r, f, v) => {
  R(c, 0, 0, 32, 32, '#34322e');
  for (let i = 0; i < 26; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#3a3833' : '#2e2c29');
  R(c, 0, 0, 32, 1, '#3d3b36'); R(c, 0, 0, 1, 32, '#3d3b36');
  if (v === 0) { R(c, 8, 14, 12, 2, GRNL); R(c, 13, 9, 2, 12, GRNL); }
  if (v === 1) { R(c, 6, 18, 8, 2, '#e8c43a'); R(c, 6, 18, 2, 7, '#e8c43a'); }
});
function woodPanel(c, lower) {
  R(c, 0, 0, 32, 32, '#a8733f');
  for (let x = 0; x < 32; x += 8) { R(c, x, 0, 1, 32, '#c48a52'); R(c, x + 7, 0, 1, 32, '#7a4f2a'); }
  if (!lower) R(c, 0, 0, 32, 1, '#5a3a20');
  else { R(c, 0, 20, 32, 2, GRN); R(c, 0, 20, 32, 1, GRNL); R(c, 0, 26, 32, 6, '#4a3020'); R(c, 0, 26, 32, 1, '#2a1a10'); }
}
tile('swall_u', { solid: true }, (c) => woodPanel(c, false));
tile('swall', { solid: true }, (c) => woodPanel(c, true));
function paintTabi(c) {
  const W = 192, H = 64;
  R(c, 0, 0, W, H, '#4a3020');
  R(c, 3, 3, W - 6, H - 8, '#f6efdc'); R(c, 3, 3, W - 6, 1, WHT);
  // painted sea and islands with pins
  R(c, 6, 6, 120, 52, '#bfe3f5');
  for (const [x, y, w, h] of [[70, 10, 18, 10], [60, 20, 30, 12], [44, 30, 26, 10], [30, 38, 18, 9], [16, 44, 12, 8], [96, 6, 14, 8]]) oval(c, x, y, w, h, '#a8d898');
  for (const [x, y, col] of [[78, 14, '#e8452c'], [70, 26, GRN], [54, 34, BLU], [36, 42, '#ffd23f'], [100, 9, '#e8452c']]) { R(c, x, y - 5, 1, 5, DG); disc(c, x, y - 6, 2, col); }
  // title card
  R(c, 130, 8, 58, 24, GRN); R(c, 130, 8, 58, 2, GRNL); R(c, 132, 30, 54, 2, GRND);
  text(c, '旅とごはん', 159, 13, { size: 10, align: 'center', color: WHT, shadow: GRND });
  // food illustrations: rice bowl, dango, tea
  oval(c, 136, 40, 18, 12, WHT); oval(c, 138, 36, 14, 8, '#f6f1e2'); R(c, 136, 46, 18, 2, '#c83a3a');
  for (let i = 0; i < 3; i++) disc(c, 164 + i * 5, 42 - i * 2, 2, ['#ffb3cf', WHT, '#8ad87a'][i]); line(c, 162, 46, 174, 38, WOODD);
  R(c, 176, 40, 8, 10, '#5a8a5a'); R(c, 176, 40, 8, 2, '#8ac08a');
  outline(c);
}
bigTiles('tabi', 6, 2, { solid: true }, paintTabi);

// --- garage
tile('gwall_u', { solid: true }, (c) => {
  R(c, 0, 0, 32, 32, '#a3a6ad'); R(c, 0, 0, 32, 1, '#7d8088'); R(c, 0, 1, 32, 1, '#c3c6cc');
  R(c, 15, 2, 1, 30, '#92959c'); R(c, 16, 2, 1, 30, '#b4b7bd'); R(c, 0, 16, 32, 1, '#92959c');
  for (const [x, y] of [[4, 6], [27, 6], [4, 24], [27, 24]]) P(c, x, y, '#7d8088');
});
tile('pline', {}, (c, r) => {
  R(c, 0, 0, 32, 32, '#9a9ca2');
  for (let i = 0; i < 40; i++) Pw(c, RND(r, 32), RND(r, 32), i % 2 ? '#8d8f95' : '#a8aab0');
  R(c, 14, 0, 4, 32, '#e8c43a'); R(c, 14, 0, 1, 32, '#f6dc6a');
});
tile('rack', { solid: true, obj: true, variants: 3 }, (c, r, f, v) => {
  shadowEllipse(c, 16, 30, 14, 2);
  R(c, 2, 1, 2, 29, DG); R(c, 28, 1, 2, 29, DG);
  for (const y of [9, 19, 28]) { R(c, 2, y, 28, 2, '#7d8391'); R(c, 2, y, 28, 1, '#a9aeb8'); }
  const items = [
    [[5, 3, 10, 6, INK], [17, 4, 9, 5, '#c83a3a']],
    [[5, 12, 8, 7, '#3b3f48'], [15, 13, 11, 6, '#e8c43a']],
    [[5, 22, 9, 6, '#4a6ab8'], [16, 21, 10, 7, INK]],
  ];
  for (const row of items) for (const [x, y, w, h, col] of row) { R(c, x, y + (v % 2), w, h, col); R(c, x, y + (v % 2), w, 1, shade(col, 0.3)); }
  if (v === 1) { R(c, 18, 13, 3, 3, '#7fd8ff'); }
  if (v === 2) { oval(c, 6, 13, 8, 6, '#2a2d34'); P(c, 9, 15, '#7fd8ff'); }
  outline(c);
});
tile('cart', { solid: true, obj: true }, (c) => {
  shadowEllipse(c, 16, 29, 13, 2);
  R(c, 4, 12, 24, 3, '#9aa0aa'); R(c, 4, 22, 24, 3, '#9aa0aa'); R(c, 4, 12, 2, 13, DG); R(c, 26, 12, 2, 13, DG);
  R(c, 6, 4, 12, 8, INK); R(c, 6, 4, 12, 1, '#4a4e58'); R(c, 8, 6, 4, 3, '#5fd7ff');
  R(c, 19, 6, 7, 6, '#e8c43a'); R(c, 19, 6, 7, 1, '#f6dc6a');
  R(c, 7, 16, 18, 6, '#3b3f48'); R(c, 9, 18, 6, 2, '#c83a3a');
  disc(c, 7, 27, 2, INK); disc(c, 25, 27, 2, INK);
  outline(c);
});

// ====================================================================== props
function textSign(x, y, w, h, label) {
  return {
    type: 'prop', x, y, w, h, solid: false,
    talk: async (g) => { await g.say('「テレビ東京」の看板だ。\nあったかいクリーム色に、緑のラインがよく映えている。'); },
    draw(ctx, sx, sy) {
      blit(ctx, baked('sign|' + label, w * 16, h * 16, (c) => {
        const W = w * 32, Hh = Math.round(h * 32);
        R(c, 2, 2, W - 4, Hh - 4, GRND); R(c, 4, 4, W - 8, Hh - 8, WHT); R(c, 4, 4, W - 8, 1, GRNP);
        R(c, 8, Hh - 13, W - 16, 4, GRN); R(c, 8, Hh - 13, (W - 16) / 3, 4, BLU);
        text(c, label, W / 2, 10, { size: 24, align: 'center', color: '#1f3a2a', shadow: GRNP });
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
        R(c, 0, 2, W, 22, GRND); R(c, 1, 3, W - 2, 20, '#2f6a44'); R(c, 1, 3, W - 2, 1, '#4f8a64');
        R(c, 1, 20, W - 2, 3, GRNL);
        text(c, label, W / 2, 5, { size: 14, align: 'center', color: WHT, shadow: '#10301c' });
        outline(c);
      }), sx, sy + 1);
    },
  };
}
// The location van (side view, 5 x 3 tiles). LOKE = 「ロケ」 in a 2x pixel font.
const LOKE = [
  '#####....#....',
  '#...#....####.',
  '#...#...#..#..',
  '#...#......#..',
  '#...#.....#...',
  '#####....#....',
];
function paintVan(c) {
  shadowEllipse(c, 80, 89, 74, 4);
  // roof rack with cases and a ladder
  R(c, 22, 10, 120, 3, DG); for (let x = 26; x < 140; x += 12) R(c, x, 13, 2, 5, DG);
  R(c, 30, 2, 26, 8, INK); R(c, 30, 2, 26, 1, '#4a4e58'); R(c, 62, 4, 20, 6, '#e8c43a'); R(c, 62, 4, 20, 1, '#f6dc6a');
  R(c, 146, 12, 3, 52, '#9aa0aa'); for (let y = 16; y < 62; y += 6) R(c, 143, y, 8, 1, '#9aa0aa');
  // body with a slanted nose
  R(c, 8, 18, 140, 62, WHT); R(c, 8, 18, 140, 2, '#f2f4f8'); R(c, 8, 76, 140, 4, '#d5d9e0');
  for (let y = 18; y < 36; y++) c.clearRect(8, y, Math.round((36 - y) * 0.9), 1);
  for (let y = 18; y < 36; y++) P(c, 8 + Math.round((36 - y) * 0.9), y, '#e4e7ec');
  // windscreen and side windows
  for (let y = 23; y < 44; y++) R(c, 11 + Math.round(Math.max(0, 36 - y) * 0.9), y, 18, 1, mix('#2a4a78', '#5a8ac8', (y - 23) / 21));
  R(c, 34, 22, 28, 20, '#2a4a78'); R(c, 66, 22, 30, 20, '#2a4a78'); R(c, 100, 22, 40, 20, '#2a4a78');
  for (const x of [36, 68, 102]) { R(c, x, 24, 4, 14, '#7aa8e0'); R(c, x + 5, 24, 2, 8, '#7aa8e0'); }
  R(c, 64, 22, 2, 56, '#c3c9d1'); R(c, 98, 22, 2, 56, '#c3c9d1');
  // stripe and door
  R(c, 8, 50, 140, 7, GRN); R(c, 8, 50, 140, 2, GRNL); R(c, 8, 57, 140, 2, BLU);
  R(c, 92, 60, 3, 6, '#9aa0aa');
  // lights and bumpers
  R(c, 4, 58, 8, 6, '#ffe38a'); R(c, 4, 58, 8, 1, WHT); R(c, 144, 58, 5, 8, '#d62f2f');
  R(c, 2, 70, 16, 6, '#9aa0aa'); R(c, 140, 70, 12, 6, '#9aa0aa');
  // wheels
  for (const x of [34, 122]) { disc(c, x, 80, 10, INK); disc(c, x, 80, 5, '#9aa0aa'); disc(c, x, 80, 2, DG); R(c, x - 14, 68, 28, 2, '#c3c9d1'); }
  // the 「ロケ」 plate on the side
  R(c, 104, 58, 34, 15, GRND); R(c, 105, 59, 32, 13, WHT);
  LOKE.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') R(c, 108 + x * 2, 60 + y * 2, 2, 2, GRND); }));
  outline(c);
}

// ====================================================================== characters
const L = {
  recep: { ...LOOKS.receptionist, top: GRN, bottom: '#2f3a33' },
  recep2: { ...LOOKS.receptionist, hair: 'long', hairColor: 'brown', top: GRN, bottom: '#2f3a33' },
  guard: LOOKS.guard,
  ad: { ...LOOKS.ad, top: GRN },
  ad2: { ...LOOKS.ad, hair: 'cap', hat: GRND, hairColor: 'black', top: '#e8c43a' },
  director: { ...LOOKS.director, hat: GRN },
  lokeDir: { hair: 'cap', hat: '#e8c43a', hairColor: 'black', skin: 'tan', top: '#5a8a5a', bottom: '#5a4a3a', glasses: true, beard: true },
  driver: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#3a58a8', bottom: '#2a2d36', hat: '#2a3560' },
  producer: { ...LOOKS.manager, tie: GRN, top: '#4a5a4a', bottom: '#4a5a4a', glasses: false },
  makeup: { ...LOOKS.makeup, hairColor: 'brown', top: '#2f3a33' },
  traveler: { ...LOOKS.comedian, hair: 'cap', hat: '#ff8a3d', top: '#5fd7ff' },
  writer: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#e8c43a', bottom: '#5a4a3a', glasses: true },
  actor: { ...LOOKS.actor, top: '#5a6f8a', bottom: '#3b3f48', tie: GRN },
  cameraman: LOOKS.cameraman,
  salaryman: LOOKS.salaryman,
  fan: { ...LOOKS.fan, top: GRNL },
  granny: LOOKS.oldwoman,
  student: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a' },
  geinin: { ...LOOKS.comedian2, top: '#ff7eb6' },
};
const SP = {
  recep: { name: '受付さん', look: L.recep },
  guard: { name: '警備員さん', look: L.guard },
  ad: { name: 'AD', look: L.ad2 },
};

// ====================================================================== content tables
const KOSHO_SCENES = [
  { prompt: '大将「テレビ？うちは取材おことわりだよ！」', answers: [{ text: '「このお店の味を、全国に届けたいんです！」', score: 100 }, { text: '「そこをなんとか…」', score: 50 }, { text: '「じゃあ、いいです」', score: 0 }] },
  { prompt: 'おばあちゃん「映るのは恥ずかしいわぁ」', answers: [{ text: '「手元だけでも、すてきに撮りますよ」', score: 100 }, { text: '「メイクしましょうか？」', score: 60 }, { text: '「すぐ終わるんで」', score: 20 }] },
  { prompt: 'ロケ車が渋滞にはまった。ディレクターがそわそわ…', answers: [{ text: '「近道、地図で探します！」', score: 100 }, { text: '「のどあめ、どうぞ」', score: 60 }, { text: '（寝たふりをする）', score: 0 }] },
  { prompt: 'こども「なにしてるのー？」', answers: [{ text: '「テレビの撮影だよ。いっしょに手をふる？」', score: 100 }, { text: '「ナイショ」', score: 40 }, { text: '「あっち行ってて」', score: 0 }] },
  { prompt: '撮影が終わった。お店の人に、最後のひと言！', answers: [{ text: '「ご協力、ありがとうございました！」', score: 100 }, { text: '「また来ます、たぶん」', score: 40 }, { text: '（そのまま帰る）', score: 0 }] },
];
const WIPE_SCENES = [
  { prompt: 'VTR：職人さんが、30年使い続けた包丁を見せてくれた', answers: [{ text: '「うわぁ…ピカピカ！」（目を丸くする）', score: 100 }, { text: '「へえ」', score: 30 }, { text: '（あくびをかみころす）', score: 0 }] },
  { prompt: 'VTR：山あいの一軒宿。湯けむりの向こうに雪景色', answers: [{ text: '「はぁ〜…行きたい…」', score: 100 }, { text: '「寒そうですね」', score: 50 }, { text: '「虫、いそう」', score: 10 }] },
  { prompt: 'VTR：特大のかき揚げ丼が登場！', answers: [{ text: '「ちょ、大きすぎません！？」', score: 100 }, { text: '「おいしそう」', score: 60 }, { text: '（無表情）', score: 0 }] },
  { prompt: '司会「いまのVTR、どうでした？」', answers: [{ text: '「職人さんの手、かっこよかったです！」', score: 100 }, { text: '「よかったです」', score: 40 }, { text: '「見てませんでした」', score: 0 }] },
  { prompt: 'VTR：最後に、店主さんがにっこり笑った', answers: [{ text: '（思わず、もらい泣き）', score: 100 }, { text: '「いい笑顔！」', score: 80 }, { text: '「早く次いきましょう」', score: 0 }] },
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

async function koshoTalk(g, npc) {
  const s = as(npc);
  await g.say(['ロケのお手伝い、してくれる人を探してるんです！', 'お店に取材のお願いをしたり、道を聞いたり…。ロケは「お願い」の連続なんですよ。'], s);
  const res = await g.job({
    id: 'tvtokyo_kosho', title: 'ロケのお手伝い', desc: 'お店や町の人に、取材のお願いをしよう！', client: npc.name, clientLook: npc.look,
    stamina: 18, minigame: 'talk', opts: { difficulty: 1, topic: 'ロケのお手伝い', scenes: KOSHO_SCENES, set: 'local' },
    pay: 1000, fame: 4, skill: 'talk', gain: 1,
  });
  if (res && (res.rank === 'S' || res.rank === 'A')) await g.say('大将、最後は「また来いよ」って言ってくれましたね！\nロケの才能、ありますよ！', s);
  else if (res) await g.say('おつかれさまでした！\n断られても、めげずにお願い。それがロケの基本です！', s);
}

async function wipeTalk(g, npc) {
  const s = as(npc);
  await g.say(['VTRを見ている顔を、画面のすみの小さな窓…「ワイプ」で映すんだ。', '大げさすぎず、でも気持ちはまっすぐ。顔だけで伝える、意外と奥深い仕事だよ。'], s);
  await g.job({
    id: 'tvtokyo_wipe', title: 'VTRのワイプ出演', desc: 'ロケのVTRに、顔で全力リアクション！', client: npc.name, clientLook: npc.look,
    stamina: 15, minigame: 'talk', opts: { difficulty: 2, topic: 'VTRのワイプ', scenes: WIPE_SCENES, set: 'variety' },
    pay: 4000, fame: 15, skill: 'talk', gain: 2, requires: TIER1,
  });
}

async function lokeTalk(g, npc) {
  const s = as(npc);
  await g.say(['ご当地グルメのロケ番組、リポーターを探してるんだ。', 'ロケは段取りどおりにいかないのが当たり前。その「予定外」を楽しめる人がいいな。'], s);
  await g.job({
    id: 'tvtokyo_loke', title: 'ご当地グルメロケのリポーター', desc: 'ロケ車に乗って、町のおいしいものを食レポ！', client: npc.name, clientLook: npc.look,
    stamina: 25, minigame: 'talk', opts: { difficulty: 3, topic: 'local' },
    pay: 10000, fame: 40, skill: 'talk', gain: 3, requires: { fame: 250 },
  });
}

async function kanran(g, npc) {
  const s = as(npc);
  if (today(g, 'tvtokyo_kanran_day')) { await g.say('今日の観覧はおしまいです。\nまた明日、のんびり見に来てくださいね！', s); return; }
  const i = await g.ask(['旅とごはんの番組、観覧のお席あります！', '客席で見ていきませんか？（無料・1日1回）'], ['見ていく', 'またこんど'], s);
  if (i !== 0) { await g.say('いつでもどうぞ！', s); return; }
  markToday(g, 'tvtokyo_kanran_day');
  await g.fadeOut(16);
  g.sfx('laugh');
  await g.wait(600);
  g.sfx('applause');
  await g.wait(400);
  await g.fadeIn(16);
  g.relax({ stress: 10 });
  g.sfx('good');
  await g.say(['湯けむりの宿に、山盛りの定食…。', 'VTRを見ていたら、なんだか心がほっこりした。（ストレス -10）']);
}

async function mirror(g) {
  if (today(g, 'tvtokyo_mirror_day')) { await g.say('（髪も服も、もうバッチリ整っている）'); return; }
  const i = await g.ask('ライトつきの鏡だ。身だしなみを整える？', ['整える', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'tvtokyo_mirror_day');
  g.bathe(35, true);
  g.sfx('good');
  await g.say('寝ぐせをなおして、えりもピシッと直した。\nよし、いつでも本番いける！（身だしなみ +35・1日1回）');
}

async function rest(g) {
  if (today(g, 'tvtokyo_rest_day')) { await g.say('（もう十分休んだ。\nお茶も飲んだし、そろそろ行こう！）'); return; }
  const i = await g.ask('ちゃぶ台のそばで、ちょっとひと休みする？', ['休む', 'やめておく']);
  if (i !== 0) return;
  markToday(g, 'tvtokyo_rest_day');
  await g.fadeOut(16);
  g.sfx('sleep');
  await g.wait(700);
  await g.fadeIn(16);
  g.relax({ stress: 8, stamina: 20 });
  await g.say('座布団を枕に、たたみでごろん。\nほうじ茶のいい香りがする…。（体力 +20・ストレス -8・1日1回）');
}

// ====================================================================== place
registerPlace({
  id: PID,
  name: 'テレビ東京',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 7, y: 9, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------------ エントランス
    lobby: {
      floor: T('floor'),
      tiles: [
        '################',
        '#uABCuuuuuuuuuu#',
        '#=abc=======gg=#',
        '#..........|...#',
        '#P....KKKK.|...#',
        '#......()..ILI|#',
        '#......()......#',
        '#.SS..T()....P.#',
        '#.SS...()...Q..#',
        '#P.....()......#',
        '#######MM#######',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'),
        ...bigLegend('vision', ['ABC', 'abc'], [T('wall_u'), T('wall2')]),
        g: 'door_glass', '|': T('glass_v'), K: T('counter'), I: T('gate'), L: T('lane'),
        '(': T('run_l'), ')': T('run_r'), S: T('bench'), T: 'tv', P: 'plant', Q: 'water_server',
      },
      warps: [
        ...exitWarps([7, 8], 10),
        { x: 12, y: 2, room: 'corridor', tx: 2, ty: 5, dir: 'up' },
        { x: 13, y: 2, room: 'corridor', tx: 3, ty: 5, dir: 'up' },
      ],
      entities: [
        textSign(5.5, 1.1, 5, 1.8, 'テレビ東京'),
        {
          type: 'sign', x: 3, y: 2,
          talk: async (g) => { await g.say(['大型ビジョンだ。ロケ車の旅、元気なグラフ、そして緑の「ON AIR」。', '見ていると、なんだか旅に出たくなる。']); },
        },
        { type: 'sign', x: 6, y: 7, text: 'オンエアモニターだ。\nいま放送中の番組が流れている。音は小さめ。' },
        { type: 'npc', id: 'tx_recep', x: 7, y: 3, dir: 'down', look: L.recep, name: '受付さん', talk: async (g, npc) => programDesk(g, PID, npc) },
        {
          type: 'npc', id: 'tx_info', x: 9, y: 3, dir: 'down', look: L.recep2, name: 'ご案内',
          text: [
            'テレビ東京へようこそ！ゲートを入って廊下の右手に、楽屋とスタジオがあります。',
            'いちばん奥はロケ車のガレージ。ADさんがロケのお手伝いを探していましたよ。',
            '小さな局ですけど、そのぶんみんな顔見知り。迷ったら、だれにでも聞いてくださいね！',
          ],
        },
        {
          type: 'npc', id: 'tx_guard', x: 10, y: 6, dir: 'down', look: L.guard, name: '警備員さん',
          text: ['ゲストの方は、ゲートをそのままお通りください。', '休憩時間に、ロケのおみやげをもらうことがあるんです。昨日は干しいもでした。'],
        },
        {
          type: 'npc', id: 'tx_salaryman', x: 4, y: 8, dir: 'up', look: L.salaryman, name: 'スポンサーのおじさん', fixedDir: true,
          text: ['打ち合わせの前に、モニターで番組をチェック中です。', '旅の番組を見ていると、つい出張先で同じお店に行っちゃうんですよねえ。'],
        },
        {
          type: 'npc', id: 'tx_student', x: 11, y: 8, dir: 'left', look: L.student, name: '見学の学生さん', wander: 1,
          text: ['学校の課題で、テレビ局のレポートを書いてます！', 'ロケ車のガレージ、見せてもらえないかなあ…。'],
        },
      ],
      events: [
        {
          x: 7, y: 8, w: 2, on: 'step', once: 'tvtokyo_welcome',
          run: async (g) => {
            await g.emote('tx_recep', '!');
            await g.say(['テレビ東京へようこそ！', '番組の出演のご相談は、受付まで。スタジオへは右のゲートからどうぞ！'], SP.recep);
          },
        },
        {
          x: 12, y: 5, on: 'step', once: 'tvtokyo_pass',
          run: async (g) => {
            await g.emote('tx_guard', '!');
            await g.say(['はじめての方ですね！こちら、ゲスト用の入館証です。', 'あ、ついでにこれもどうぞ。ロケのおみやげの、ご当地あめです。'], SP.guard);
            g.sfx('ok');
            await g.say('（緑のストラップの入館証と、小さなあめ玉をもらった）');
          },
        },
      ],
    },

    // ------------------------------------------------------------------ スタジオ廊下
    corridor: {
      floor: T('floor'),
      tiles: [
        '##################',
        '#uuuuuuuuuuuuuuuu#',
        '#==d=p=ODD=p==HH=#',
        '#Q..............V#',
        '#................#',
        '#...P....SS...P..#',
        '##MM##############',
      ],
      legend: {
        '#': T('walltop'), u: T('wall_u'), '=': T('wall2'), p: `${T('wall2')}+poster`,
        d: 'door_wood', D: 'door_metal', H: 'door_metal', O: `${T('wall2')}+onair`,
        Q: 'water_server', V: 'vending', S: T('bench'), P: 'plant', M: 'exit_mat',
      },
      warps: [
        { x: 2, y: 6, room: 'lobby', tx: 12, ty: 3, dir: 'down' },
        { x: 3, y: 6, room: 'lobby', tx: 13, ty: 3, dir: 'down' },
        { x: 3, y: 2, room: 'gakuya', tx: 5, ty: 6, dir: 'up' },
        { x: 8, y: 2, room: 'studio', tx: 7, ty: 9, dir: 'up' },
        { x: 9, y: 2, room: 'studio', tx: 8, ty: 9, dir: 'up' },
        { x: 14, y: 2, room: 'garage', tx: 8, ty: 9, dir: 'up' },
        { x: 15, y: 2, room: 'garage', tx: 9, ty: 9, dir: 'up' },
      ],
      entities: [
        plate(2, 1, '楽屋', 3),
        plate(7, 1, 'スタジオ', 4),
        plate(13, 1, 'ガレージ', 4),
        {
          type: 'npc', id: 'tx_ad', x: 6, y: 4, dir: 'right', look: L.ad, name: 'AD', wander: 2,
          text: ['すみませーん、ロケのおみやげ通りまーす！', 'この局、廊下が短いから、みんなすぐ顔見知りになるんですよ。', 'ガレージのロケ車、今日も朝5時出発でした…。ねむい…。'],
        },
        {
          type: 'npc', id: 'tx_producer', x: 11, y: 3, dir: 'down', look: L.producer, name: 'プロデューサー',
          text: ['うちは「アイデアと足」で勝負だからね。いい企画は、だいたい現場で見つかる。', '予算？…そこは知恵と工夫と、ロケ弁のおかわりでカバーさ。'],
        },
      ],
    },

    // ------------------------------------------------------------------ 楽屋（和室）
    gakuya: {
      floor: 'floor_tatami',
      tiles: [
        '############',
        '#=MM=MM=p=c#',
        '#.kk.kk....#',
        '#...zz.....#',
        '#...YY...R.#',
        '#...zz....L#',
        '#F.......SS#',
        '#####mm#####',
      ],
      legend: {
        '#': 'walltop_green', '=': 'wall_green', M: 'wall_green+mirror', p: 'wall_green+poster', c: 'wall_green+clock',
        k: 'makeup', z: T('zabuton'), Y: 'table_low', R: 'clothes_rack', L: 'locker', F: 'flower_stand', S: T('bench'), m: 'exit_mat',
      },
      warps: [
        { x: 5, y: 7, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
        { x: 6, y: 7, room: 'corridor', tx: 3, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'tx_makeup', x: 8, y: 3, dir: 'left', look: L.makeup, name: 'メイクさん',
          text: ['ロケのメイクは、汗と風に負けないのが大事なの。', '鏡は自由に使ってね。身だしなみが整ってると、お仕事の評判もぐっと上がるわよ。'],
        },
        {
          type: 'npc', id: 'tx_traveler', x: 3, y: 5, dir: 'right', look: L.traveler, name: '旅ロケ帰りの芸人さん',
          text: ['ただいまー！3日間で、温泉5つと定食8つ。…ちょっと太ったかも。', 'ロケの醍醐味は、台本にない出会いやで。地元の人の話が、いちばんおもろいねん。'],
        },
        { type: 'sign', x: 1, y: 6, text: '「祝・ご出演」のスタンド花だ。\n黄色いひまわりが、和室を明るくしている。' },
        { type: 'sign', x: 8, y: 1, text: '楽屋のポスターだ。\n「忘れ物注意！ロケのおみやげは、出口の棚へ」' },
      ],
      events: [
        { x: 2, y: 2, w: 2, on: 'action', run: mirror },
        { x: 5, y: 2, w: 2, on: 'action', run: mirror },
        { x: 4, y: 4, w: 2, on: 'action', run: rest },
        { x: 9, y: 6, w: 2, on: 'action', run: rest },
      ],
    },

    // ------------------------------------------------------------------ スタジオ（旅とごはんのセット）
    studio: {
      floor: T('sfloor'),
      bgm: 'studio',
      tiles: [
        '################',
        '#uuuu012345uuuu#',
        '#=O==abcdfg==O=#',
        '#...zzzzzzzz...#',
        '#...ZZZYYZZZ...#',
        '#..............#',
        '#.V..........V.#',
        '#...C...C...C..#',
        '#..............#',
        '#.SSSSS..SSSSS.#',
        '#######mm#######',
      ],
      legend: {
        '#': T('walltop'), u: T('swall_u'), '=': T('swall'), O: `${T('swall')}+onair`,
        ...bigLegend('tabi', ['012345', 'abcdfg']),
        z: `floor_tatami+${T('zabuton')}`, Z: 'floor_tatami', Y: 'floor_tatami+table_low',
        V: 'monitor', C: 'camera', S: 'seat', m: 'exit_mat',
      },
      warps: [
        { x: 7, y: 10, room: 'corridor', tx: 8, ty: 3, dir: 'down' },
        { x: 8, y: 10, room: 'corridor', tx: 9, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'tx_guest1', x: 5, y: 3, dir: 'down', look: L.geinin, name: '旅好きの芸人さん',
          text: ['このセット、ほんまの茶の間みたいで落ち着くわあ。', 'VTR見とったら、おなか鳴ってもうた。マイク、拾ってへんかな…。'],
        },
        {
          type: 'npc', id: 'tx_guest2', x: 7, y: 3, dir: 'down', look: L.writer, name: 'グルメライターさん',
          text: ['おいしいお店を見つけるコツ？朝、地元の人が並んでいるお店ね。', '食レポは「どうおいしいか」を、自分の言葉で言うのが大事よ。'],
        },
        {
          type: 'npc', id: 'tx_guest3', x: 10, y: 3, dir: 'down', look: L.actor, name: 'ゲストの俳優さん',
          text: ['ドラマの宣伝で来たのに、気づいたら温泉の話ばかりしてました。', 'ここのスタジオ、なんだか実家に帰ってきたみたいなんですよね。'],
        },
        { type: 'npc', id: 'tx_dir', x: 13, y: 5, dir: 'left', look: L.director, name: 'ディレクター', talk: wipeTalk },
        { type: 'npc', id: 'tx_kanran', x: 14, y: 8, dir: 'left', look: L.ad, name: '観覧係のAD', talk: kanran },
        { type: 'npc', id: 'tx_fan', x: 3, y: 9, dir: 'up', look: L.fan, name: '観覧のお客さん', text: ['この番組、毎週見てるの！', 'VTRのお店、メモしてきたんだ。今度の休みに行ってみる！'] },
        { type: 'npc', id: 'tx_granny', x: 11, y: 9, dir: 'up', look: L.granny, name: '観覧のおばあさん', text: ['あの温泉宿、新婚旅行で行ったところなのよ。', 'テレビって、思い出までつれてきてくれるのねえ。'] },
      ],
      events: [
        { x: 7, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('ちゃぶ台の上に、湯のみとおせんべい。\nセットの小道具だけど、湯のみにはちゃんとお茶が入っている。'); } },
        { x: 2, y: 6, on: 'action', run: async (g) => { await g.say('VTR用のモニターだ。\nロケの映像を見ながら、スタジオのみんながリアクションするらしい。'); } },
        { x: 13, y: 6, on: 'action', run: async (g) => { await g.say('VTR用のモニターだ。\n画面のすみに、小さな「ワイプ」の窓が映っている。'); } },
      ],
    },

    // ------------------------------------------------------------------ ロケ車ガレージ
    garage: {
      floor: 'floor_concrete',
      bgm: 'office',
      tiles: [
        '##################',
        '#uuHHHHHuuuuuuuuu#',
        '#==hhhhh==bb=p===#',
        '#R.|.....|.......#',
        '#R.|.....|..BB...#',
        '#R.|.....|..BB.c.#',
        '#..|.....|.......#',
        '#...........K..L.#',
        '#.c.........K..L.#',
        '#................#',
        '########mm########',
      ],
      legend: {
        '#': 'walltop_gray', u: T('gwall_u'), '=': 'wall_gray', H: 'shutter', h: 'shutter', b: 'wall_gray+whiteboard', p: 'wall_gray+poster',
        R: T('rack'), '|': T('pline'), B: 'boxes', c: 'cone', K: T('cart'), L: 'locker', m: 'exit_mat',
      },
      warps: [
        { x: 8, y: 10, room: 'corridor', tx: 14, ty: 3, dir: 'down' },
        { x: 9, y: 10, room: 'corridor', tx: 15, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'prop', x: 4, y: 3, w: 5, h: 3, solid: true,
          talk: async (g) => { await g.say(['ロケ車だ。屋根の上には脚立と機材ケース。', '車内には、ロケ弁の空き箱と、使いこまれた地図帳が積んである。']); },
          draw(ctx, sx, sy) { blit(ctx, baked('van', 80, 48, paintVan), sx, sy - 2); },
        },
        {
          type: 'sign', x: 10, y: 2,
          talk: async (g) => { await g.say(['ホワイトボードに、今週のロケ予定がびっしり。', '「月：港町の朝市　水：山の一軒宿　金：商店街の名物コロッケ」…おなかがすいてきた。']); },
        },
        { type: 'sign', x: 11, y: 2, text: 'ホワイトボードのすみに、だれかのらくがき。\n「ロケ車の運転手さん、いつもありがとう！」' },
        { type: 'npc', id: 'tx_lokead', x: 14, y: 3, dir: 'down', look: L.ad2, name: 'ロケのAD', talk: koshoTalk },
        { type: 'npc', id: 'tx_lokedir', x: 11, y: 6, dir: 'left', look: L.lokeDir, name: 'ロケディレクター', talk: lokeTalk },
        {
          type: 'npc', id: 'tx_driver', x: 2, y: 6, dir: 'right', look: L.driver, name: 'ドライバーさん',
          text: ['ロケ車の運転は30年。日本中の道の駅のトイレの場所、だいたい覚えてるよ。', '出発は朝5時。遅れたら置いていく…なんて言いながら、いつも待っちゃうんだよなあ。'],
        },
        {
          type: 'npc', id: 'tx_lokecam', x: 14, y: 7, dir: 'left', look: L.cameraman, name: 'ロケのカメラマン',
          text: ['ロケのカメラは肩にかついで一日中。だから肩こりがすごいんだ。', 'いい画が撮れるのは、だいたい予定外の時。道に迷った先に名店がある、なんてね。'],
        },
      ],
      events: [
        { x: 1, y: 3, h: 3, on: 'action', run: async (g) => { await g.say('機材ラックだ。カメラ、マイク、バッテリー、雨ガッパ…。\nロケの必需品がきちんと並んでいる。'); } },
        { x: 12, y: 7, h: 2, on: 'action', run: async (g) => { await g.say('機材カートだ。ガムテープには「ロケ用・持ち出し禁止」の文字。'); } },
        {
          x: 6, y: 8, w: 6, on: 'step', once: 'tvtokyo_garage_intro',
          run: async (g) => {
            await g.emote('tx_lokead', '!');
            const i = await g.ask(['あっ、ちょうどよかった！', 'ロケ車に機材を積むの、手伝ってもらえませんか？出発まであと10分なんです！'], ['手伝う', 'ごめんね'], SP.ad);
            if (i !== 0) { await g.say('ですよねー！大丈夫です、気合いで運びます！', SP.ad); return; }
            await g.fadeOut(12);
            g.sfx('hit');
            await g.wait(300);
            g.sfx('hit');
            await g.wait(300);
            await g.fadeIn(12);
            await g.say(['助かりましたー！間に合いました！', 'これ、お礼です。ロケ弁の残り…じゃなくて、おにぎり！'], SP.ad);
            g.giveItem('onigiri', 1);
          },
        },
      ],
    },
  },
});
