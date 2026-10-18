// TBSテレビ（港エリア）— ドラマとバラエティの民放テレビ局
//
//   lobby    エントランス   受付（番組出演の窓口 programDesk）・青いロゴの壁・入館ゲートとエレベーター・
//                           オンエア中のビデオウォール・待合ソファ・展示コーナー（撮影の小道具／昔のカメラ／トロフィー）
//   corridor スタジオフロア  スタジオ・楽屋（Aは使用中、Bが自分の楽屋）・リハーサル室・社員食堂
//   gakuya   楽屋          ひと休み（体力・ストレス）・鏡（身だしなみ）・メイクさん・差し入れ
//   studio   バラエティスタジオ  階段つきの登場口・ゲストのソファ・司会者デスク・サイドビジョン・カメラ・観覧席
//   reha     リハーサル室   鏡の壁とバミリ。読み合わせ（1回きり）・撮影リハの代役
//   shokudo  社員食堂      食券機と食品サンプル、丸テーブル。安くておなかいっぱい（g.eat）
//
// お仕事（番組の出演依頼は受付の programDesk。ここにあるのは局の小さなお仕事）：
//   ★0         番組観覧（無料・1日1回：トーク +1・ストレス -8）／前説（talk d1）／リハーサルの代役（command acting d1）
//   所属 or ★30 スタジオコントの脇役（command acting d2）
// 1回きり：入館証、読み合わせ、小道具さんの落とし物、食堂の新メニュー試食
//
// 実在の番組名・出演者は出しません。スタッフはすべて架空の人物です。

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, disc, oval, line, bevel, grain, outline, shadowEllipse, speckle, pix } from '../engine/tiles.js';
import { registerItem, payText } from '../engine/state.js';
import { ACTIVITY } from '../engine/life.js';
import { text, measure } from '../engine/draw.js';
import { shade, makeCanvas, fmtMoney } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

const PID = 'tbs';
const T = (k) => `${PID}_${k}`;

// ------------------------------------------------------------------ palette (TBSの青)
const BLU = '#0050ff';
const BLUD = '#0038c0';
const BLUX = '#0a1f5c';
const BLUL = '#4d86ff';
const BLUP = '#d6e3ff';
const CYAN = '#5fd7ff';
const WHT = '#ffffff';
const OFF = '#f2f5fa';
const LG = '#dfe5ee';
const MG = '#b9c2d0';
const DG = '#6f7a8c';
const INK = '#1c2030';
const GOLD = '#ffd23f';
const GOLDD = '#c9a227';
const WOOD = '#c89a62';
const STEEL = '#c9ccd2';

// ------------------------------------------------------------------ tile helpers
// Every tile here is painted natively at 32x32 (hd); the 16px draw() is the same art halved.
function tile(k, def) {
  const hd = def.hd;
  defineTile(T(k), {
    ...def,
    draw: def.draw || ((c, r, f, v) => {
      const [cv, cc] = makeCanvas(32, 32);
      hd(cc, r, f, v);
      c.imageSmoothingEnabled = false;
      c.drawImage(cv, 0, 0, 16, 16);
    }),
  });
}
const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
// one big picture cut into tiles (cols x rows), cached per animation frame
function bigTiles(prefix, cols, rows, frames, paint, extra = {}) {
  const cache = new Map();
  const img = (f) => {
    if (!cache.has(f)) { const [cv, c] = makeCanvas(cols * 32, rows * 32); paint(c, f); cache.set(f, cv); }
    return cache.get(f);
  };
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    tile(prefix + i, { solid: true, frames, speed: 90, ...extra, hd(c, r, f) { c.drawImage(img(f), -col * 32, -row * 32); } });
  }
}

// ------------------------------------------------------------------ walls & floors
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#1e2333'); } });
// cool white wall; upper course has a soft blue gradient band at the top
tile('wall_u', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, OFF);
    for (let y = 2; y < 10; y++) R(c, 0, y, 32, 1, y < 4 ? BLUD : y < 6 ? BLU : y < 8 ? BLUL : BLUP);
    R(c, 0, 0, 32, 1, shade(OFF, -0.35)); R(c, 0, 1, 32, 1, WHT);
    for (const x of [7, 23]) R(c, x, 10, 1, 22, '#e8edf5');
  },
});
tile('wall', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, OFF);
    for (const x of [7, 23]) R(c, x, 0, 1, 20, '#e8edf5');
    R(c, 0, 20, 32, 1, LG); R(c, 0, 21, 32, 2, BLU); R(c, 0, 21, 32, 1, BLUL);
    R(c, 0, 23, 32, 3, WHT);
    R(c, 0, 26, 32, 6, '#3a4256'); R(c, 0, 26, 32, 1, '#262c3c'); R(c, 0, 27, 32, 1, '#4c5570'); R(c, 0, 31, 32, 1, '#262c3c');
  },
});
// blue feature wall with glowing vertical slits
function featPaint(lower) {
  return (c) => {
    for (let y = 0; y < 32; y++) R(c, 0, y, 32, 1, lower ? (y < 24 ? BLU : BLUD) : BLU);
    for (const x of [5, 21]) { R(c, x, 0, 2, lower ? 24 : 32, '#3d7bff'); R(c, x, 0, 1, lower ? 24 : 32, '#9dbcff'); }
    if (!lower) { R(c, 0, 0, 32, 1, BLUX); R(c, 0, 1, 32, 1, BLUL); }
    else { R(c, 0, 24, 32, 2, BLUD); R(c, 0, 26, 32, 6, BLUX); R(c, 0, 26, 32, 1, '#06143d'); R(c, 0, 27, 32, 1, '#13307a'); }
  };
}
tile('feat_u', { solid: true, hd: featPaint(false) });
tile('feat', { solid: true, hd: featPaint(true) });
// dark polished granite with soft reflections
tile('floor', {
  variants: 4,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#3c4458');
    speckle(c, r, ['#363e51', '#434c62', '#4a5470', '#2f3647'], 90);
    R(c, 0, 0, 32, 1, '#2c3242'); R(c, 0, 0, 1, 32, '#2c3242'); R(c, 1, 1, 31, 1, '#4c5670');
    if (v === 0) { line(c, 6, 14, 14, 6, '#5a6684'); line(c, 7, 15, 15, 7, '#4e5874'); }
    if (v === 2) { line(c, 18, 28, 26, 20, '#56627e'); }
  },
});
// blue entrance carpet with a light-blue inlay
function runner(side) {
  return (c, r) => {
    R(c, 0, 0, 32, 32, BLUD);
    speckle(c, r, ['#0a3cb0', '#0046dc', '#0532a0'], 70);
    const x = side === 'l' ? 3 : 27;
    R(c, x, 0, 2, 32, CYAN); R(c, side === 'l' ? 0 : 29, 0, 3, 32, BLUX);
  };
}
tile('run_l', { hd: runner('l') });
tile('run_r', { hd: runner('r') });

// ------------------------------------------------------------------ lobby furniture
// reception counter: white top, navy front with a glowing blue line
tile('counter', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 4, 32, 8, WHT); R(c, 0, 11, 32, 1, LG);
    R(c, 0, 12, 32, 18, BLUX); R(c, 0, 12, 32, 1, '#06143d');
    R(c, 0, 19, 32, 2, CYAN); R(c, 0, 19, 32, 1, '#c8f2ff'); R(c, 0, 21, 32, 1, BLU);
    R(c, 0, 28, 32, 2, '#06143d');
    if (v === 1) { R(c, 19, 0, 9, 7, INK); R(c, 20, 1, 7, 5, '#2a3350'); R(c, 22, 7, 3, 3, DG); }
    if (v === 2) { R(c, 5, 6, 8, 4, BLUP); R(c, 6, 7, 6, 1, BLU); R(c, 20, 6, 6, 4, '#ffffff'); R(c, 21, 7, 4, 1, MG); R(c, 21, 8, 3, 1, MG); }
    outline(c);
  },
});
// tall glass-flap gate with a blue ring light
tile('gate', {
  solid: true, obj: true, frames: 2, speed: 45,
  hd(c, r, f) {
    shadowEllipse(c, 16, 29, 7, 2);
    R(c, 0, 8, 10, 13, '#cfe6ff'); R(c, 0, 8, 10, 1, WHT); R(c, 22, 8, 10, 13, '#cfe6ff'); R(c, 22, 8, 10, 1, WHT);
    line(c, 2, 18, 7, 10, WHT); line(c, 24, 18, 29, 10, WHT);
    bevel(c, 10, 4, 12, 24, '#e8ecf2', WHT, '#a9b2c0');
    oval(c, 12, 6, 8, 6, f ? CYAN : BLU); oval(c, 14, 8, 4, 2, INK);
    R(c, 11, 20, 10, 2, BLU);
    outline(c);
  },
});
tile('glass', {
  solid: true, obj: true,
  hd(c) {
    R(c, 1, 6, 30, 19, '#cfe6ff'); R(c, 1, 6, 30, 1, WHT);
    line(c, 6, 22, 14, 9, WHT); line(c, 9, 22, 17, 9, '#e6f1ff');
    R(c, 0, 5, 32, 1, STEEL); R(c, 0, 24, 32, 4, '#e8ecf2'); R(c, 0, 24, 32, 1, WHT); R(c, 0, 27, 32, 1, '#a9b2c0');
    outline(c);
  },
});
// white column with a blue light line
tile('pillar', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 9, 2);
    R(c, 8, 0, 16, 29, WHT); R(c, 8, 0, 3, 29, '#f7f9fc'); R(c, 20, 0, 4, 29, LG); R(c, 23, 0, 1, 29, MG);
    R(c, 14, 0, 3, 29, BLU); R(c, 14, 0, 1, 29, BLUL);
    R(c, 7, 27, 18, 3, MG); R(c, 7, 27, 18, 1, WHT);
    outline(c);
  },
});
// a video wall of nine small screens (4 x 2 tiles), each screen cycling its own picture
function miniScreen(c, x, y, w, h, k) {
  const pics = [
    () => { R(c, x, y, w, h, '#ffb3c6'); R(c, x + 2, y + h - 6, 4, 5, BLU); R(c, x + w - 7, y + h - 6, 4, 5, GOLD); oval(c, x + 2, y + h - 9, 4, 4, '#f2c9a0'); oval(c, x + w - 7, y + h - 9, 4, 4, '#f2c9a0'); },
    () => { R(c, x, y, w, h, '#8fd0ff'); oval(c, x - 2, y + h - 6, w / 2 + 4, 8, '#4a9a4a'); oval(c, x + w / 2 - 2, y + h - 5, w / 2 + 4, 8, '#3f8a3a'); oval(c, x + w - 6, y + 2, 4, 4, GOLD); },
    () => { R(c, x, y, w, h, BLUX); for (let i = 0; i < 4; i++) R(c, x + 2, y + 3 + i * 3, w - 4 - (i % 2) * 6, 1, i ? '#c8d4ff' : GOLD); },
    () => { R(c, x, y, w, h, '#ffe39a'); oval(c, x + w / 2 - 5, y + h - 8, 10, 5, '#7d8391'); R(c, x + w / 2 - 1, y + 2, 1, 3, WHT); R(c, x + w / 2 + 2, y + 3, 1, 3, WHT); },
    () => { R(c, x, y, w, h, '#2a2a3a'); for (let i = 0; i < 6; i++) P(c, x + 2 + i * 3, y + 3 + (i % 3), WHT); R(c, x, y + h - 5, w, 5, '#1a3a6a'); for (let i = 0; i < w; i += 3) P(c, x + i, y + h - 6, GOLD); },
    () => { R(c, x, y, w, h, BLU); R(c, x + 3, y + 3, w - 6, h - 6, WHT); R(c, x + 5, y + 5, 6, 1, BLU); R(c, x + 5, y + 8, w - 10, 1, MG); R(c, x + 5, y + 10, w - 12, 1, MG); },
  ];
  pics[k % pics.length]();
}
bigTiles('vwall', 4, 2, 3, (c, f) => {
  R(c, 0, 0, 128, 64, '#10131c');
  R(c, 0, 0, 128, 2, '#2a3044'); R(c, 0, 62, 128, 2, '#05070c');
  const sw = 40, sh = 18;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const x = 3 + i * (sw + 2), y = 4 + j * (sh + 2);
    miniScreen(c, x, y, sw, sh, (i * 2 + j * 3 + f * 5) % 6);
    R(c, x, y, sw, 1, 'rgba(255,255,255,0.18)');
  }
  P(c, 123, 60, '#ff2b3a');
});
// photo panel of memorable sets ("名場面")
tile('panel', {
  solid: true, obj: true,
  hd(c) {
    R(c, 2, 4, 28, 20, WHT); R(c, 2, 4, 28, 3, BLU); R(c, 2, 23, 28, 1, MG);
    const photos = [['#c8a070', '#6a4a30'], ['#7a8aa8', '#2a3350'], ['#d8b0b8', '#8a4a5a'], ['#a8c890', '#3a6a3a']];
    photos.forEach(([bg, fg], i) => {
      const x = 4 + (i % 2) * 13, y = 9 + Math.floor(i / 2) * 7;
      R(c, x, y, 11, 6, bg); R(c, x + 3, y + 2, 2, 4, fg); R(c, x + 6, y + 1, 2, 5, fg); P(c, x + 3, y + 1, '#f2c9a0'); P(c, x + 6, y, '#f2c9a0');
    });
    outline(c);
  },
});
// glass case of shooting props: a clapperboard, a script and a desk lamp
tile('props', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 14, 2);
    bevel(c, 2, 19, 28, 10, BLUX, '#1d3a8a', '#06143d'); R(c, 2, 23, 28, 1, CYAN);
    R(c, 3, 2, 26, 17, '#e3f0ff'); R(c, 3, 2, 26, 1, WHT); R(c, 3, 18, 26, 1, '#b8c8e0');
    // clapperboard
    R(c, 5, 10, 10, 7, INK); R(c, 6, 11, 8, 5, '#3a3f50'); R(c, 6, 12, 6, 1, WHT); R(c, 6, 14, 4, 1, WHT);
    for (let i = 0; i < 5; i++) R(c, 5 + i * 2, 7 + (i % 2), 2, 2, i % 2 ? WHT : INK);
    line(c, 5, 9, 15, 6, INK);
    // script
    R(c, 17, 12, 7, 5, '#f6f1e2'); R(c, 17, 12, 7, 1, BLU); R(c, 18, 14, 4, 1, MG);
    // lamp
    R(c, 25, 15, 3, 2, GOLDD); R(c, 26, 9, 1, 6, DG); oval(c, 24, 6, 5, 4, '#2f8a5a');
    line(c, 5, 16, 9, 4, WHT);
    outline(c);
  },
});
// an old studio camera on a wooden tripod (free-standing)
tile('oldcam', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 10, 2);
    line(c, 16, 18, 8, 29, '#8a5a33'); line(c, 16, 18, 24, 29, '#8a5a33'); line(c, 16, 18, 16, 29, '#6e4428'); line(c, 17, 18, 9, 29, '#a07040');
    R(c, 8, 6, 15, 12, '#4a4e58'); R(c, 8, 6, 15, 1, '#6a6e78'); R(c, 9, 8, 5, 5, '#3b3f48');
    R(c, 22, 8, 5, 7, '#2a2d36'); oval(c, 25, 9, 5, 5, '#1a1c22'); P(c, 26, 10, '#7d8391');
    oval(c, 9, 1, 7, 6, '#2a2d36'); oval(c, 15, 1, 7, 6, '#2a2d36'); P(c, 12, 3, '#7d8391'); P(c, 18, 3, '#7d8391');
    R(c, 4, 12, 4, 1, DG);
    outline(c);
  },
});
// white shelf with trophies and a crystal award
tile('award', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 14, 2);
    R(c, 2, 2, 28, 28, '#e8ecf2'); R(c, 4, 4, 24, 24, BLUX);
    R(c, 4, 15, 24, 2, WHT); R(c, 4, 28, 24, 1, WHT);
    for (const x of [6, 20]) {
      R(c, x, 6, 6, 4, GOLD); R(c, x, 6, 6, 1, '#fff2a0'); R(c, x + 5, 7, 1, 3, GOLDD);
      P(c, x - 1, 7, GOLD); P(c, x + 6, 7, GOLD); R(c, x + 2, 10, 2, 2, GOLDD); R(c, x + 1, 12, 4, 3, WHT);
    }
    R(c, 14, 6, 4, 9, '#bfe8ff'); R(c, 14, 6, 1, 9, WHT); R(c, 13, 13, 6, 2, '#9ad0f0');
    R(c, 7, 19, 8, 9, '#cfe6ff'); R(c, 8, 20, 2, 6, WHT); R(c, 6, 26, 10, 2, MG);
    R(c, 19, 20, 7, 8, GOLD); R(c, 19, 20, 7, 1, '#fff2a0'); R(c, 21, 22, 3, 3, BLU);
    outline(c);
  },
});
tile('elevlamp', {
  solid: true, obj: true, frames: 2, speed: 60,
  hd(c, r, f) {
    R(c, 9, 16, 14, 11, INK); R(c, 10, 17, 12, 9, '#202840');
    pix(c, ['..#..', '.###.', '#####'], { '#': f ? CYAN : '#1d3a6a' }, 11, 18);
    pix(c, ['#####', '.###.', '..#..'], { '#': f ? '#1d3a6a' : CYAN }, 11, 22);
    R(c, 18, 19, 3, 5, CYAN); R(c, 19, 20, 1, 3, '#202840');
    outline(c);
  },
});

// ------------------------------------------------------------------ doors
// dressing-room door with a blue noren
function gdoorPaint(c) {
  R(c, 3, 0, 26, 32, '#3a4256'); R(c, 5, 2, 22, 30, '#d8dde6'); R(c, 5, 2, 22, 1, WHT);
  R(c, 6, 19, 9, 10, '#c8ced9'); R(c, 17, 19, 9, 10, '#c8ced9');
  R(c, 23, 21, 2, 3, DG);
  R(c, 3, 1, 26, 2, '#262c3c');
  R(c, 4, 3, 24, 16, BLU); R(c, 4, 3, 24, 1, BLUL); R(c, 4, 18, 24, 1, BLUX);
  for (const x of [11, 20]) R(c, x, 7, 1, 12, BLUX);
  R(c, 4, 14, 24, 2, WHT); R(c, 4, 16, 24, 1, BLUP);
  disc(c, 16, 8, 2, WHT); P(c, 16, 8, BLU);
}
tile('gdoor', { hd: gdoorPaint });
tile('gdoor_lock', { solid: true, hd: gdoorPaint });
function sdoor(side) {
  const L = side === 'l';
  return (c) => {
    R(c, 0, 0, 32, 32, '#232838');
    const x0 = L ? 3 : 0, w = 29;
    R(c, x0, 2, w, 30, '#3d4766'); R(c, x0, 2, w, 1, '#56628a');
    for (let y = 5; y < 30; y += 4) R(c, x0 + 2, y, w - 4, 1, '#344060');
    R(c, L ? 13 : 5, 7, 13, 5, '#0d1430'); R(c, L ? 14 : 6, 8, 4, 1, '#4a6aa8');
    R(c, x0, 16, w, 2, BLU); R(c, x0, 16, w, 1, BLUL);
    R(c, L ? 27 : 2, 20, 3, 8, STEEL); R(c, L ? 27 : 2, 20, 1, 8, WHT);
    R(c, L ? 31 : 0, 0, 1, 32, '#151a28');
  };
}
tile('sdoor_l', { hd: sdoor('l') });
tile('sdoor_r', { hd: sdoor('r') });

// ------------------------------------------------------------------ studio
// set backdrop: deep blue with circle motifs and light dots (upper); white with blue rings (lower)
tile('set_u', {
  solid: true, variants: 2,
  hd(c, r, f, v) {
    for (let y = 0; y < 32; y++) R(c, 0, y, 32, 1, y < 12 ? '#06143d' : y < 22 ? BLUX : '#13307a');
    R(c, 0, 0, 32, 1, '#030a22');
    // a ring (v0) or a small ring and dot (v1), always whole inside the tile
    const ringAt = (cx, cy, r0, r1, col) => { for (let y = -r1; y <= r1; y++) for (let x = -r1; x <= r1; x++) { const d = Math.hypot(x, y); if (d <= r1 && d > r0) P(c, cx + x, cy + y, col); } };
    if (v === 0) { ringAt(16, 15, 5, 7.5, BLU); ringAt(16, 15, 5, 5.6, '#3d7bff'); }
    else { ringAt(9, 17, 2.5, 4, BLU); disc(c, 24, 11, 1, '#3d7bff'); }
    for (let x = 3; x < 32; x += 7) P(c, x, 5 + (x % 3), '#9dbcff');
    for (let x = 1; x < 32; x += 4) { R(c, x, 28, 2, 2, '#bfe0ff'); P(c, x, 28, WHT); }
  },
});
tile('set', {
  solid: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, WHT);
    R(c, 0, 0, 32, 2, '#bfe0ff');
    c.save(); c.beginPath(); c.rect(0, 2, 32, 14); c.clip();
    const cx = v ? 24 : 8;
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) { const d = Math.hypot(x, y); if (d <= 9 && d > 6) P(c, cx + x, 9 + y, BLUP); if (d <= 4) P(c, cx + x, 9 + y, '#e6eeff'); }
    c.restore();
    R(c, 0, 16, 32, 1, LG);
    R(c, 0, 17, 32, 7, BLU); R(c, 0, 17, 32, 1, BLUL);
    for (let x = 2; x < 32; x += 6) { R(c, x, 19, 2, 2, '#bfe0ff'); P(c, x, 19, WHT); }
    R(c, 0, 24, 32, 8, '#101830'); R(c, 0, 24, 32, 1, BLUX);
  },
});
// entrance arch in the set (2 tiles wide, 2 rows: upper u, lower)
function archPaint(c, side, upper) {
  const L = side === 'l';
  if (upper) {
    for (let y = 0; y < 32; y++) R(c, 0, y, 32, 1, y < 12 ? '#06143d' : BLUX);
    // the arch frame: a half circle spanning both tiles
    const cx = L ? 32 : 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - 34);
      if (d < 24) P(c, x, y, '#bfe0ff');
      if (d < 21) P(c, x, y, '#e8f3ff');
      if (d < 21 && y > 22) P(c, x, y, '#f7fbff');
    }
    for (let a = 0; a < 7; a++) { const ang = Math.PI * (L ? 0.55 + a * 0.065 : 0.45 - a * 0.065); P(c, Math.round(cx + Math.cos(ang) * 22.5) - (L ? 1 : 0), Math.round(34 - Math.sin(ang) * 22.5), WHT); }
  } else {
    R(c, 0, 0, 32, 32, '#f7fbff');
    if (L) { R(c, 0, 0, 11, 32, '#bfe0ff'); R(c, 0, 0, 8, 32, BLU); R(c, 2, 0, 1, 32, BLUL); }
    else { R(c, 21, 0, 11, 32, '#bfe0ff'); R(c, 24, 0, 8, 32, BLU); R(c, 29, 0, 1, 32, BLUL); }
    for (let y = 4; y < 30; y += 4) R(c, L ? 11 : 0, y, 21, 1, '#eef5ff');
    R(c, 0, 26, 32, 6, '#dfe9f7');
  }
}
tile('arch_ul', { solid: true, hd: (c) => archPaint(c, 'l', true) });
tile('arch_ur', { solid: true, hd: (c) => archPaint(c, 'r', true) });
tile('arch_l', { solid: true, hd: (c) => archPaint(c, 'l', false) });
tile('arch_r', { solid: true, hd: (c) => archPaint(c, 'r', false) });
// the staircase coming down from the arch
function stairPaint(side) {
  return (c) => {
    for (let i = 0; i < 4; i++) {
      const y = i * 8, col = i % 2 ? '#e8f0ff' : WHT;
      R(c, 0, y, 32, 8, col); R(c, 0, y, 32, 1, '#f9fbff'); R(c, 0, y + 6, 32, 1, BLUP); R(c, 0, y + 7, 32, 1, '#9ab4e0');
      for (let x = side === 'l' ? 2 : 6; x < 32; x += 8) P(c, x, y + 3, '#bfe0ff');
    }
    if (side === 'l') { R(c, 0, 0, 3, 32, BLU); R(c, 0, 0, 1, 32, BLUL); } else { R(c, 29, 0, 3, 32, BLU); R(c, 31, 0, 1, 32, BLUD); }
  };
}
tile('stair_l', { hd: stairPaint('l') });
tile('stair_r', { hd: stairPaint('r') });
// side vision screens: 3 x 2 tiles cut from one 96x64 picture
bigTiles('led', 3, 2, 3, (c, f) => {
  R(c, 0, 0, 96, 64, '#0c0e16');
  const x0 = 3, y0 = 3, w = 90, h = 56;
  if (f === 0) {
    for (let y = y0; y < y0 + h; y++) R(c, x0, y, w, 1, y < 30 ? '#0a2a8a' : BLU);
    for (let i = 0; i < 40; i++) { const x = x0 + ((i * 37) % w), y = y0 + ((i * 23) % h); P(c, x, y, i % 3 ? '#9dbcff' : WHT); }
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d <= 14 && d > 10) P(c, 48 + x, 31 + y, CYAN); if (d <= 6) P(c, 48 + x, 31 + y, WHT); }
  } else if (f === 1) {
    for (let y = y0; y < y0 + h; y++) R(c, x0, y, w, 1, y < 34 ? '#ffd6e0' : '#ffeef2');
    for (const [x, col] of [[20, BLU], [44, GOLD], [68, '#2f9a4a']]) {
      R(c, x, 30, 10, 18, col); R(c, x, 30, 10, 2, shade(col, 0.3)); oval(c, x + 1, 19, 8, 9, '#f2c9a0'); R(c, x + 1, 18, 8, 3, '#3b2a20');
      P(c, x + 3, 23, INK); P(c, x + 6, 23, INK); R(c, x + 3, 25, 4, 1, '#c0392b');
    }
    R(c, x0, y0 + h - 8, w, 8, WHT); R(c, x0 + 4, y0 + h - 6, 40, 2, BLU); R(c, x0 + 4, y0 + h - 3, 26, 1, MG);
  } else {
    for (let y = y0; y < y0 + h; y++) R(c, x0, y, w, 1, y < 26 ? '#ffb070' : y < 36 ? '#ff8a5a' : '#2a3a6a');
    oval(c, 40, 22, 16, 16, '#ffe08a');
    R(c, x0, 38, w, 21, '#1d2c5a'); for (let x = x0; x < x0 + w; x += 6) R(c, x, 40 + (x % 4), 4, 1, '#5a7ac0');
    for (const [x, hh] of [[6, 12], [14, 18], [70, 15], [80, 10]]) { R(c, x, 38 - hh, 6, hh, '#2a2f4a'); for (let y = 40 - hh; y < 37; y += 3) P(c, x + 2, y, GOLD); }
  }
  R(c, 0, 0, 96, 1, '#2a3044'); R(c, 0, 63, 96, 1, '#05070c');
  P(c, 90, 60, '#ff2b3a');
});
// glossy pale-blue set floor
tile('setfloor', {
  variants: 12,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#eef4fd');
    R(c, 0, 0, 32, 1, '#d7e3f5'); R(c, 0, 0, 1, 32, '#d7e3f5');
    for (let y = 4; y < 32; y += 8) for (let x = (y / 4) % 2 ? 4 : 0; x < 32; x += 8) P(c, x, y, '#dfe9f8');
    if (v === 1 || v === 7) { line(c, 4, 12, 12, 4, WHT); line(c, 5, 13, 13, 5, '#f6f9fe'); }
    if (v === 3) line(c, 20, 28, 28, 20, WHT);
  },
});
tile('setmark', {
  hd(c) {
    R(c, 0, 0, 32, 32, '#eef4fd'); R(c, 0, 0, 32, 1, '#d7e3f5'); R(c, 0, 0, 1, 32, '#d7e3f5');
    R(c, 9, 14, 14, 3, BLU); R(c, 14, 9, 3, 14, BLU); R(c, 9, 14, 14, 1, BLUL); R(c, 14, 9, 3, 1, BLUL);
  },
});
// studio floor (dark blue-gray) with a few scuffs
tile('sfloor', {
  variants: 24,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#2a3040'); speckle(c, r, ['#30364a', '#262b3a', '#2e3446'], 60);
    if (v === 5) { line(c, 5, 25, 25, 19, '#363d52'); }
  },
});
// guest sofa: white with blue cushions
tile('couch', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 29, 16, 2);
    R(c, 0, 5, 32, 11, '#e6ecf5'); R(c, 0, 5, 32, 1, WHT);
    R(c, 2, 7, 13, 8, BLU); R(c, 17, 7, 13, 8, v ? CYAN : BLU); R(c, 2, 7, 13, 1, BLUL); R(c, 17, 7, 13, 1, v ? '#b8f0ff' : BLUL);
    R(c, 0, 15, 32, 10, WHT); R(c, 0, 15, 32, 2, '#f7f9fc'); R(c, 15, 15, 2, 10, LG);
    R(c, 0, 24, 32, 3, MG); R(c, 0, 26, 32, 1, DG);
    outline(c);
  },
});
// host desk: blue front with a light strip, script and mic on top
tile('mcdesk', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 29, 16, 2);
    R(c, 0, 8, 32, 5, WHT); R(c, 0, 8, 32, 1, '#fafcff'); R(c, 0, 12, 32, 1, LG);
    R(c, 0, 13, 32, 15, BLU); R(c, 0, 13, 32, 1, BLUX); R(c, 0, 19, 32, 2, CYAN); R(c, 0, 19, 32, 1, '#c8f2ff'); R(c, 0, 27, 32, 1, BLUX);
    if (v === 0) { R(c, 6, 5, 9, 5, '#fdfdf6'); R(c, 7, 6, 6, 1, '#9aa0aa'); R(c, 7, 8, 4, 1, '#9aa0aa'); }
    else { R(c, 20, 2, 1, 8, '#7d8391'); oval(c, 18, 0, 5, 4, '#3b3f48'); R(c, 6, 6, 5, 4, GOLD); R(c, 7, 6, 3, 1, '#fff2a0'); }
    outline(c);
  },
});
tile('edge', {
  solid: true, obj: true, frames: 2, speed: 30,
  hd(c, r, f) {
    R(c, 0, 0, 32, 6, '#eef4fd'); R(c, 0, 5, 32, 1, '#d7e3f5');
    R(c, 0, 6, 32, 2, WHT); R(c, 0, 8, 32, 16, '#1c2234'); R(c, 0, 8, 32, 1, '#11151f');
    R(c, 0, 13, 32, 2, f ? CYAN : BLU); R(c, 0, 13, 32, 1, f ? '#c8f2ff' : BLUL);
    R(c, 0, 23, 32, 1, '#11151f'); R(c, 0, 24, 32, 2, 'rgba(0,0,0,0.3)');
  },
});
tile('steps', {
  hd(c) {
    R(c, 0, 0, 32, 6, '#eef4fd');
    for (let i = 0; i < 3; i++) {
      const y = 6 + i * 6;
      R(c, 0, y, 32, 6, shade('#dde6f3', -i * 0.06)); R(c, 0, y, 32, 1, WHT); R(c, 0, y + 5, 32, 1, '#9ab4e0');
      if (i === 0) R(c, 0, y + 1, 32, 1, BLU);
    }
    R(c, 0, 24, 32, 8, '#2a3040');
  },
});
// audience seat in TBS blue
tile('seat', {
  solid: true, obj: true,
  hd(c) {
    R(c, 3, 4, 26, 16, BLUD); R(c, 4, 3, 24, 1, BLUD);
    R(c, 5, 5, 22, 13, BLU); R(c, 5, 5, 22, 2, BLUL); R(c, 5, 7, 1, 11, '#2a6aff');
    R(c, 15, 8, 2, 9, BLUD);
    R(c, 3, 20, 26, 8, BLUX); R(c, 3, 20, 26, 2, BLUD); R(c, 3, 27, 26, 1, '#06143d');
    for (const x of [0, 29]) { R(c, x, 8, 3, 21, '#3a4256'); R(c, x, 8, 3, 1, '#5a6684'); }
    outline(c);
  },
});

// ------------------------------------------------------------------ rehearsal room
// mirror wall with a ballet barre
tile('mirror', {
  solid: true,
  hd(c) {
    R(c, 0, 0, 32, 32, '#cfe2ee');
    R(c, 0, 0, 32, 2, '#9aa6b8'); R(c, 0, 2, 32, 1, '#e8f3fa');
    line(c, 4, 18, 14, 4, '#eef8ff'); line(c, 6, 18, 16, 4, '#e2f0f8'); line(c, 22, 14, 28, 6, '#eef8ff');
    R(c, 0, 13, 32, 2, '#c8a46a'); R(c, 0, 13, 32, 1, '#e8c890'); R(c, 0, 15, 32, 1, '#8a6a3a');
    for (const x of [4, 20]) R(c, x, 15, 2, 4, '#9aa0aa');
    R(c, 0, 24, 32, 2, '#9aa6b8'); R(c, 0, 26, 32, 6, '#4a4e58'); R(c, 0, 26, 32, 1, '#2a2d36');
  },
});
// light wood floor with board seams
tile('rfloor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#d8b07a');
    for (let y = 0; y < 32; y += 8) { R(c, 0, y, 32, 1, '#b88a52'); R(c, (y * 3 + v * 7) % 32, y + 1, 1, 7, '#c89a62'); }
    grain(c, r, 0, 1, 32, 30, '#ccA06a', 8, 6);
    speckle(c, r, ['#e2bc88', '#c89a62'], 20);
  },
});
// バミリ: colored tape marks for actors' positions
tile('bami', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#d8b07a');
    for (let y = 0; y < 32; y += 8) R(c, 0, y, 32, 1, '#b88a52');
    const col = [BLU, '#ff5d6c', GOLD][v];
    R(c, 8, 15, 16, 3, col); R(c, 14, 9, 3, 15, col); R(c, 8, 15, 16, 1, shade(col, 0.3));
    R(c, 20, 20, 6, 2, WHT); P(c, 21, 20, col);
  },
});
tile('script', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 13, 2);
    R(c, 2, 8, 28, 13, '#f0f2f5'); R(c, 2, 8, 28, 1, WHT); R(c, 2, 20, 28, 1, '#c8ccd4');
    R(c, 2, 21, 28, 3, '#9aa0aa'); R(c, 4, 24, 2, 5, '#6a707c'); R(c, 26, 24, 2, 5, '#6a707c');
    R(c, 5, 10, 9, 8, '#f6f1e2'); R(c, 5, 10, 9, 1, BLU); R(c, 6, 13, 6, 1, MG); R(c, 6, 15, 5, 1, MG);
    R(c, 16, 11, 8, 6, '#f6f1e2'); R(c, 16, 11, 8, 1, '#ff5d6c'); line(c, 17, 16, 22, 13, '#ff5d6c');
    R(c, 25, 10, 2, 7, GOLD); P(c, 25, 10, WHT);
    outline(c);
  },
});

// ------------------------------------------------------------------ cafeteria
tile('kenbaiki', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    bevel(c, 5, 1, 22, 28, '#eef2f8', WHT, '#b0b8c6');
    R(c, 6, 2, 20, 5, BLU); for (let x = 8; x < 25; x += 3) P(c, x, 4, CYAN);
    const cols = [GOLD, '#ff9a3c', CYAN, '#b8eea0', '#ff9ab8', WHT];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const col = cols[(i * 2 + j) % cols.length]; R(c, 8 + i * 4, 9 + j * 4, 3, 3, col); P(c, 8 + i * 4, 11 + j * 4, shade(col, -0.3)); }
    R(c, 9, 22, 6, 2, INK); R(c, 18, 21, 4, 3, '#2a3350'); P(c, 19, 22, CYAN);
    R(c, 9, 26, 14, 2, '#2a3350');
    outline(c);
  },
});
function sample(side) {
  return (c) => {
    R(c, 0, 20, 32, 10, BLUX); R(c, 0, 20, 32, 1, '#1d3a8a'); R(c, 0, 29, 32, 1, '#06143d');
    R(c, 0, 2, 32, 18, '#e3f0ff'); R(c, 0, 2, 32, 1, WHT); R(c, 0, 11, 32, 1, '#b8c8e0'); R(c, 0, 19, 32, 1, '#b8c8e0');
    if (side === 'l') {
      // karaage set
      R(c, 2, 4, 13, 7, '#8a5a33'); oval(c, 3, 5, 5, 4, WHT); oval(c, 8, 5, 6, 4, '#c07a2a'); P(c, 10, 6, '#d89040'); P(c, 13, 7, '#5ee07a');
      // ramen
      oval(c, 18, 4, 12, 7, BLU); oval(c, 19, 5, 10, 4, '#c88a40'); R(c, 21, 6, 3, 2, '#f6e7d0'); oval(c, 25, 6, 3, 2, '#fff2c0'); P(c, 26, 6, GOLD);
      // grilled fish
      R(c, 2, 13, 13, 5, WHT); oval(c, 3, 14, 10, 3, '#b07a4a'); P(c, 4, 15, INK); R(c, 12, 14, 2, 2, GOLD);
      // soba
      R(c, 17, 13, 13, 5, '#3a2a1a'); for (let x = 18; x < 29; x += 2) R(c, x, 14, 1, 3, '#a89a7a');
    } else {
      // donburi
      oval(c, 2, 4, 12, 7, '#7a2a1a'); oval(c, 3, 5, 10, 4, '#e0a050'); R(c, 6, 5, 4, 1, '#fff2a0'); P(c, 9, 6, '#5ee07a');
      // pasta
      oval(c, 18, 4, 12, 7, WHT); oval(c, 20, 5, 8, 4, '#f0d080'); P(c, 23, 6, '#c0392b'); P(c, 25, 7, '#c0392b');
      // dessert & salad
      R(c, 5, 13, 6, 5, '#ffe0ec'); R(c, 5, 13, 6, 2, WHT); P(c, 8, 12, '#ff5d6c');
      oval(c, 18, 13, 11, 5, WHT); oval(c, 19, 13, 9, 4, '#5ec26a'); P(c, 22, 14, '#ff9a3c'); P(c, 25, 15, '#ff9a3c');
    }
    for (const x of [4, 20]) { R(c, x, 11, 7, 2, WHT); R(c, x + 1, 11, 4, 1, BLU); }
    if (side === 'l') R(c, 0, 2, 1, 28, '#06143d'); else R(c, 31, 2, 1, 28, '#06143d');
    outline(c);
  };
}
tile('sample_l', { solid: true, obj: true, hd: sample('l') });
tile('sample_r', { solid: true, obj: true, hd: sample('r') });
tile('menu', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    bevel(c, 2, 4, 28, 20, WHT, WHT, MG);
    R(c, 4, 6, 24, 4, BLU); for (let x = 6; x < 27; x += 4) P(c, x, 8, WHT);
    for (let i = 0; i < 4; i++) { R(c, 6, 12 + i * 3, 11 - (i + v) % 3 * 2, 1, '#3a4256'); R(c, 21, 12 + i * 3, 5, 1, '#ff5d6c'); }
    outline(c);
  },
});
// tree-lined street and low buildings outside the window
tile('window', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 2, 3, 28, 22, '#e8ecf2'); R(c, 2, 3, 28, 1, WHT); R(c, 29, 4, 1, 21, '#b0b8c6');
    for (let y = 5; y < 23; y++) R(c, 4, y, 24, 1, y < 13 ? '#a8d8fa' : '#c8e8fb');
    const bld = v ? [[4, 8], [9, 12], [20, 9]] : [[6, 10], [14, 7], [22, 12]];
    for (const [x, h] of bld) { R(c, x, 19 - h, 6, h, '#b8c0d8'); for (let yy = 21 - h; yy < 18; yy += 3) { P(c, x + 1, yy, '#e8f2ff'); P(c, x + 4, yy, '#e8f2ff'); } }
    for (const x of [5, 13, 21]) { oval(c, x, 13, 7, 7, '#4a9a4a'); oval(c, x + 1, 13, 4, 3, '#6cbc5c'); R(c, x + 3, 19, 1, 3, '#6e4428'); }
    R(c, 4, 21, 24, 2, '#9aa0aa');
    R(c, 15, 5, 2, 18, '#e8ecf2');
    R(c, 1, 25, 30, 2, '#c8ccd4'); R(c, 1, 25, 30, 1, WHT);
    outline(c);
  },
});
tile('rtable', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 11, 2);
    R(c, 14, 18, 4, 9, '#9aa0aa'); R(c, 14, 18, 1, 9, WHT); oval(c, 9, 25, 14, 4, '#7d8391');
    oval(c, 3, 8, 26, 12, '#e6ecf5'); oval(c, 3, 7, 26, 12, WHT); oval(c, 6, 9, 9, 4, '#f7f9fc');
    oval(c, 9, 10, 6, 4, '#e8eef6'); R(c, 18, 10, 3, 4, CYAN); R(c, 18, 10, 3, 1, WHT);
    outline(c);
  },
});
tile('stool', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 28, 7, 2);
    R(c, 15, 18, 2, 9, '#7d8391'); R(c, 11, 26, 10, 2, '#6a707c');
    oval(c, 9, 12, 14, 8, BLUD); oval(c, 9, 11, 14, 7, BLU); oval(c, 12, 12, 6, 3, BLUL);
    outline(c);
  },
});

// ------------------------------------------------------------------ items
registerItem('tbs_pass', { name: 'TBSの入館証', price: 0, desc: '青いストラップの入館証。\nゲートにかざすと、ピッと鳴る。' });
registerItem('tbs_watch', { name: '小道具の懐中時計', price: 0, desc: 'ドラマで使う懐中時計。\n本物みたいだけど、針は動かない。' });
registerItem('tbs_daihon', { name: '読み合わせの台本', price: 0, desc: 'リハーサル室でもらった練習用の台本。\n余白に、監督の赤ペンが入っている。' });

// ------------------------------------------------------------------ people
const WHO = {
  uketsuke: { name: '受付の青山さん', look: { ...LOOKS.receptionist, top: BLU, bottom: '#2a3560' } },
  annai: { name: '案内係の空野さん', look: { ...LOOKS.receptionist, hair: 'long', hairColor: 'brown', top: WHT, bottom: BLU, jacket: true } },
  guard: { name: '警備員さん', look: { ...LOOKS.guard, hat: BLUX, top: '#2a3a6a' } },
  kanranAD: { name: '観覧係のAD', look: { ...LOOKS.ad, top: BLU, bottom: '#3b3f48' } },
  student: { name: '見学の大学生', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#ff9ab8', bottom: '#3a4a7a', glasses: true } },
  fan: { name: 'ビジョンを見る人', look: { ...LOOKS.fan, top: CYAN } },
  waiting: { name: '打ち合わせ待ちの人', look: { ...LOOKS.salaryman, tie: BLU } },
  kogumi: { name: '小道具の中村さん', look: { hair: 'cap', hat: BLU, hairColor: 'black', skin: 'tan', top: '#5a6f8a', bottom: '#2a2d36', apron: '#8a5a33' } },
  ad: { name: 'ADの青木くん', look: { ...LOOKS.ad, hairColor: 'black', top: BLU } },
  actor: { name: '若手俳優', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#3a4a7a', bottom: '#2a2d36', jacket: true } },
  fd: { name: 'フロアディレクター', look: { hair: 'cap', hat: BLU, hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' } },
  director: { name: 'ディレクターの藍沢さん', look: { ...LOOKS.director, hat: BLUX, top: '#e8ecf2' } },
  kantoku: { name: '演出の碧川さん', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#2a2d36', bottom: '#2a2d36', jacket: true, glasses: true, beard: true } },
  joshu: { name: '演出補', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#f2f2f2', bottom: '#3a4a7a', glasses: true } },
  actress: { name: '稽古中の女優さん', look: { ...LOOKS.actress, bottom: BLU } },
  mc: { name: '司会のタレントさん', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: BLU, bottom: '#2a2d36', jacket: true, tie: WHT } },
  assist: { name: 'アシスタント', look: { ...LOOKS.announcer, top: WHT, bottom: BLU } },
  guestA: { name: 'ゲストの芸人', look: LOOKS.comedian },
  guestB: { name: 'ゲストのアイドル', look: { ...LOOKS.idol, top: CYAN } },
  guestC: { name: 'ゲストの女優', look: LOOKS.actress },
  guestD: { name: 'ゲストのベテラン俳優', look: { ...LOOKS.oldman, top: '#2a2d36', jacket: true } },
  konbi: { name: 'コントの相手役', look: { ...LOOKS.comedian2, top: BLU } },
  camera: { name: 'カメラマン', look: { ...LOOKS.cameraman, hat: BLU } },
  sound: { name: '音声さん', look: { hair: 'afro', hairColor: 'black', skin: 'brown', top: '#2f9a4a', bottom: '#2a2d36' } },
  make: { name: 'メイクの雪村さん', look: { ...LOOKS.makeup, hairColor: 'brown', top: '#2a3560' } },
  obachan: { name: '食堂のおばちゃん', look: { ...LOOKS.chef, hair: 'bob', hat: WHT, hairColor: 'brown', skin: 'fair', apron: BLU } },
  eater: { name: '昼休みの音声さん', look: { hair: 'afro', hairColor: 'black', skin: 'brown', top: '#2f9a4a', bottom: '#2a2d36' } },
  eater2: { name: 'ドラマのスタイリスト', look: { hair: 'twin', hairColor: 'orange', skin: 'light', top: '#ff7eb6', bottom: '#2a2430', skirt: true } },
  aud: { name: 'お客さん', look: LOOKS.fan },
};
const say = (who) => ({ name: who.name, look: who.look });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
const lines = (who, list) => (g) => g.say(list, say(who));
const today = (g, k) => g.flag(k) === g.state.day;
// A first-visit greeting from onEnter. It runs as its own script (the player still waits)
// so the room has finished loading before anyone speaks.
const greet = (g, fn) => { g.run(fn); };

function plate(x, y, label, w = 2) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const tw = Math.ceil(measure(ctx, label, 8)) + 8;
      const px = Math.round(sx + (w * 16 - tw) / 2), py = Math.round(sy + 4);
      box(ctx, px, py, tw, 11, BLUX);
      box(ctx, px + 0.5, py + 0.5, tw - 1, 10, BLU);
      text(ctx, label, px + tw / 2, py + 1.5, { size: 8, align: 'center', color: WHT, shadow: null });
    },
  };
}
function onAirLamp(x, y, isOn) {
  return {
    type: 'prop', x, y, w: 1.5, h: 0.6, solid: false,
    draw(ctx, sx, sy, g) {
      const on = isOn(g) && Math.floor(g.frame / 30) % 4 !== 3;
      box(ctx, sx, sy, 24, 9, INK);
      box(ctx, sx + 1, sy + 1, 22, 7, on ? '#ff2b3a' : '#5a1a1f');
      text(ctx, 'ON AIR', sx + 12, sy + 1, { size: 6, align: 'center', color: on ? '#ffe0e3' : '#9a3a42', shadow: null });
    },
  };
}

// ------------------------------------------------------------------ exits
// Back to the street. The station stands in the 港 town; until its building is placed
// there, the door leads to the pavement in front of NHK in Tokyo instead.
function streetSpot() {
  const nhk = doorIndexFor('nhk');
  if (nhk) return { town: nhk.town, room: nhk.room, x: nhk.x + 2, y: nhk.y + 1 };
  return { town: 'tokyo', room: undefined, x: undefined, y: undefined };
}
function exitWarps(xs, y) {
  const out = [];
  for (const x of xs) {
    out.push({ x, y, to: 'exit', cond: () => !!doorIndexFor(PID) });
    out.push({
      x, y, dir: 'down', cond: () => !doorIndexFor(PID),
      get place() { return streetSpot().town; },
      get room() { return streetSpot().room; },
      get tx() { return streetSpot().x; },
      get ty() { return streetSpot().y; },
    });
  }
  return out;
}

// ------------------------------------------------------------------ studio staging
let show = null; // null | 'kanran' | 'maesetsu' | 'konto'
let onAir = false;

function here(g) {
  const p = g.map.player;
  return { room: g.map.roomId, x: p.x, y: p.y, dir: p.dir };
}
async function toRoom(g, mode, room, x, y, dir) {
  const origin = here(g);
  show = mode;
  onAir = false;
  await g.fadeOut();
  await g.goto(PID, room, x, y, dir, { fade: false });
  // frame the whole set and the front rows of the audience while the show runs
  if (g.map.roomId === 'studio') g.map.camOverride = { x: 16, y: -4 };
  await g.fadeIn();
  return origin;
}
async function backFrom(g, origin) {
  await g.fadeOut();
  g.map.camOverride = null;
  show = null;
  onAir = false;
  await g.goto(PID, origin.room, origin.x, origin.y, origin.dir, { fade: false });
  await g.fadeIn();
}
const AUD = [
  ['tbs_aud1', 3, 10, LOOKS.fan], ['tbs_aud2', 4, 10, LOOKS.oldwoman], ['tbs_aud3', 6, 10, LOOKS.salaryman], ['tbs_aud4', 7, 10, LOOKS.mom],
  ['tbs_aud5', 8, 10, LOOKS.tourist], ['tbs_aud6', 13, 10, LOOKS.clerk], ['tbs_aud7', 14, 10, { ...LOOKS.fan, hairColor: 'brown', top: GOLD }],
  ['tbs_aud8', 16, 10, LOOKS.oldman], ['tbs_aud9', 18, 10, LOOKS.kid], ['tbs_aud10', 3, 11, LOOKS.mom], ['tbs_aud11', 6, 11, LOOKS.salaryman],
  ['tbs_aud12', 15, 11, { ...LOOKS.fan, top: BLUL }], ['tbs_aud13', 5, 10, LOOKS.chef], ['tbs_aud14', 17, 11, LOOKS.oldwoman],
];
const audVisible = (id) => () => !!show && show !== 'daiyaku' && !(show === 'kanran' && id === 'tbs_aud13');
async function crowd(g, kind, frames = 45) {
  await Promise.all(AUD.filter(([id]) => audVisible(id)()).map(([id], i) => g.emote(id, Array.isArray(kind) ? kind[i % kind.length] : kind, frames)));
}
async function countdown(g) {
  await g.say('本番まいりまーす！\n5秒前、4、3…', say(WHO.fd));
  for (let k = 0; k < 2; k++) { g.sfx('snare'); await g.wait(260); }
  onAir = true;
  g.sfx('chime');
  await g.wait(200);
}
async function crowdReact(g, res) {
  if (res.rank === 'S' || res.rank === 'A') { g.sfx('applause'); await crowd(g, ['!', '♥', '♪']); }
  else if (res.rank === 'B') { g.sfx('applause'); await crowd(g, '♪'); }
  else { g.sfx('laugh'); await crowd(g, ['w', '…']); }
}

// ------------------------------------------------------------------ jobs
const MAESETSU_SCENES = [
  { prompt: '本番前の観覧席。まだみんな、ちょっとかたい表情…', answers: [{ text: 'お隣の人とハイタッチ！', score: 100 }, { text: 'えー、始めます', score: 20 }, { text: '（ひたすら手をふる）', score: 50 }] },
  { prompt: 'お客さん「今日、誕生日なんです！」', answers: [{ text: 'みんなで拍手しましょう！', score: 100 }, { text: 'おめでとうございます', score: 60 }, { text: 'へえ、そうですか', score: 10 }] },
  { prompt: 'ADさんが「笑い声の練習を」とカンペを出した', answers: [{ text: 'せーの、ワッハッハ！', score: 100 }, { text: '笑ってください', score: 30 }, { text: 'わたし、笑いません', score: 0 }] },
  { prompt: '司会者の登場まで、あと30秒！', answers: [{ text: '最高の拍手で迎えよう！', score: 100 }, { text: 'そろそろですね', score: 40 }, { text: '…以上です', score: 10 }] },
];
const DAIYAKU_SCENES = [
  { title: 'カメラ位置の確認：主役の代わりに歩いて止まる', beats: 'KDWK' },
  { title: '照明テスト：窓辺で手紙を読むシーン', beats: 'TNKW' },
  { title: '段取り：ケンカのあと、仲直りするシーン', beats: 'ODNTW' },
];
const KONTO_SCENES = [
  { title: 'コント「新人ホテルマン」：お客さま登場！', beats: 'DWKT' },
  { title: 'まちがえて、社長室の花びんを割ってしまった！', beats: 'DNOWK' },
  { title: '大どんでん返し！じつは社長の息子だった！？', beats: 'DOTWKD' },
];
const JOBS = {
  maesetsu: {
    id: 'tbs_maesetsu', title: '前説（観覧席の盛り上げ係）', desc: '収録の前に、トークで観覧席をあたためよう！', client: WHO.fd.name, clientLook: WHO.fd.look,
    stamina: 15, minigame: 'talk', opts: { difficulty: 1, topic: '前説：観覧席をあたためよう', set: 'variety', scenes: MAESETSU_SCENES },
    pay: 1200, fame: 6, skill: 'talk', gain: 2,
  },
  daiyaku: {
    id: 'tbs_daiyaku', title: 'ドラマのリハーサルの代役', desc: '主役が来る前に、立ち位置と動きを代わりに演じよう！', client: WHO.kantoku.name, clientLook: WHO.kantoku.look,
    stamina: 15, minigame: 'command', opts: { difficulty: 1, theme: 'acting', scenes: DAIYAKU_SCENES },
    pay: 1000, fame: 4, skill: 'engi', gain: 2,
  },
  konto: {
    id: 'tbs_konto', title: 'スタジオコントの脇役', desc: 'バラエティのコントコーナーで、ベテランの相手役！', client: WHO.director.name, clientLook: WHO.director.look,
    stamina: 20, minigame: 'command', opts: { difficulty: 2, theme: 'acting', scenes: KONTO_SCENES },
    pay: 4500, fame: 18, skill: 'engi', gain: 2,
    requires: { anyOf: [{ agency: true }, { fame: 30 }], anyOfText: 'コントの脇役は、事務所に所属しているか\n★30以上の人にお願いしているみたいだ。' },
  },
};
function confirmText(def) {
  return `${def.desc}\n「${def.title}」\n${payText(def.pay)}／体力 -${def.stamina}・ストレス +${ACTIVITY.job.stress}`;
}
async function ready(g, def, who) {
  const why = g.checkRequires(def.requires) || g.lifeRefusal();
  if (why) { await g.say(why); return false; }
  const i = await g.ask(confirmText(def), ['受ける', 'やめておく'], say(who));
  if (i !== 0) return false;
  if (g.state.stamina < def.stamina) {
    await g.say('体力が足りない…。\n楽屋でひと休みするか、食堂で何か食べよう。');
    return false;
  }
  return true;
}

async function maesetsuJob(g) {
  const def = JOBS.maesetsu;
  if (!(await ready(g, def, WHO.fd))) return;
  const origin = await toRoom(g, 'maesetsu', 'studio', 10, 7, 'down');
  try {
    await g.say(['観覧のみなさん、お待たせしました！', '収録の前に、前説の{name}さんが\n盛り上げてくれまーす！'], say(WHO.fd));
    g.sfx('applause');
    await crowd(g, '♪', 30);
    const res = await g.job({ ...def, confirm: false });
    if (res) {
      await crowdReact(g, res);
      const good = res.rank === 'S' || res.rank === 'A';
      await g.say(good ? '最高の空気です！\nこのまま本番いけますね！' : res.rank === 'B' ? 'ありがとうございました！\nいい感じにあったまりました！' : 'おつかれさまでした！\n…本番は、司会の方におまかせしましょう！', say(WHO.fd));
      if (!g.flag('tbs_maesetsu_first')) {
        g.setFlag('tbs_maesetsu_first');
        await g.say(['前説のコツは「お客さんを主役にする」こと。', '話しかけて、拍手して、笑ってもらう。\nトークの力が、いちばん試される仕事なんです。'], say(WHO.fd));
      }
    }
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

async function kontoJob(g) {
  const def = JOBS.konto;
  if (!(await ready(g, def, WHO.director))) return;
  const origin = await toRoom(g, 'konto', 'studio', 8, 4, 'right');
  try {
    await g.say(['コントコーナー、スタンバイお願いします！', '{name}さんは新人ホテルマン役、\nこちらのベテランさんが社長役です！'], say(WHO.fd));
    await g.say('よろしく頼むよ。\n思いきりやってくれたら、ぜんぶ受け止めるから。', say(WHO.konbi));
    await countdown(g);
    g.sfx('fanfare');
    await g.say('続いてはコントのコーナー！\n「新人ホテルマン」、どうぞ！', say(WHO.mc));
    const res = await g.job({ ...def, confirm: false });
    if (res) {
      await crowdReact(g, res);
      const good = res.rank === 'S' || res.rank === 'A';
      await g.say(good ? 'いや〜、表情ひとつで笑わせるね！\nまたいっしょにやろう。' : res.rank === 'B' ? 'いいテンポだったよ。\n次はもっと大きく動いてごらん。' : 'ははは、かたかったね。\n大丈夫、コントは場数だよ！', say(WHO.konbi));
      onAir = false;
      await g.say('はい、OKでーす！\nコントコーナー、おつかれさまでした！', say(WHO.fd));
    }
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

async function daiyakuJob(g) {
  const def = JOBS.daiyaku;
  if (!(await ready(g, def, WHO.kantoku))) return;
  const origin = here(g);
  show = 'daiyaku';
  try {
    g.placePlayer(8, 5, 'down');
    await g.say(['では段取りいきます。\n{name}さん、バミリの上に立ってください。', 'カメラ位置と照明を決めるための代役です。\n表情も本番のつもりでお願いします！'], say(WHO.kantoku));
    const res = await g.job({ ...def, confirm: false });
    if (res) {
      const good = res.rank === 'S' || res.rank === 'A';
      await g.say(good ? '…いいね。代役なのに、思わず見入ってしまった。\nいつか本役で会いましょう。' : res.rank === 'B' ? 'ありがとう、段取りはばっちり決まりました。' : 'うん、立ち位置は決まった。ありがとう。\n表情は、もう少し練習かな。', say(WHO.kantoku));
    }
  } catch (e) {
    console.error(e);
  }
  show = null;
  g.placePlayer(origin.x, origin.y, origin.dir);
}

async function kanranShow(g) {
  const origin = await toRoom(g, 'kanran', 'studio', 5, 10, 'up');
  try {
    g.setFlag('tbs_kanran_day', g.state.day);
    await g.say(['観覧のみなさん、ようこそ！', '本番では、大きな拍手とリアクションを\nお願いしまーす！'], say(WHO.fd));
    g.sfx('applause');
    await crowd(g, '♪', 35);
    await countdown(g);
    g.sfx('fanfare');
    await g.say('こんばんは！今夜も始まりました！\nまずはこの方に、階段から登場してもらいましょう！', say(WHO.mc));
    g.showNpc('tbs_show_g2', true);
    g.placeNpc('tbs_show_g2', 10, 3, 'down');
    g.sfx('applause');
    await Promise.all([crowd(g, ['!', '♥'], 40), g.emote('tbs_show_g2', '♪')]);
    await g.say('みなさん、こんばんは〜！\n階段、緊張しました〜！', say(WHO.guestB));
    await g.walkNpcTo('tbs_show_g2', 15, 4);
    await g.say('今日のテーマは「最近、ちょっと得したこと」！\nトップバッターは…芸人さん！', say(WHO.mc));
    await g.say('こないだ自販機で当たりが出たんですよ！\n…で、もう1本出てきたのが、おしるこ。真夏に。', say(WHO.guestA));
    g.sfx('laugh');
    await crowd(g, 'w', 40);
    await g.say('得してないじゃないですか！', say(WHO.assist));
    g.sfx('laugh');
    await Promise.all([crowd(g, ['w', '!'], 40), g.emote('tbs_show_g4', 'w')]);
    await g.say('それではまた来週！おやすみなさい！', say(WHO.mc));
    g.sfx('applause');
    await crowd(g, ['♪', '♥'], 40);
    onAir = false;
    await g.say('はい、OKでーす！\n観覧のみなさん、ありがとうございました！', say(WHO.fd));
    g.addSkill('talk', 1, true);
    g.relax({ stress: 8 });
    g.sfx('good');
    await g.say('話のふり方、返し方…\nプロのトークの呼吸を、間近で見られた！\n（トーク +1・ストレス -8・1日1回）');
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

// ------------------------------------------------------------------ lobby talk
async function uketsukeTalk(g, npc) {
  if (!g.flag('tbs_recep_met')) {
    g.setFlag('tbs_recep_met');
    await g.say(['TBSテレビへようこそ。', '番組への出演のご相談は、\nこちらの受付で承っております。'], say(WHO.uketsuke));
  }
  await programDesk(g, PID, npc);
  if (npc) npc.dir = 'down';
}
async function annaiTalk(g, npc) {
  const i = await g.ask('ご案内いたします。\nどちらへ行かれますか？', ['スタジオ', 'リハーサル室', '楽屋・食堂', 'だいじょうぶ'], say(WHO.annai));
  if (i === 0) {
    await g.say(['まんなかのゲートを通って、\nエレベーターで上の階へどうぞ。', 'バラエティのスタジオには、階段つきの\n豪華なセットがあるんですよ。'], say(WHO.annai));
  } else if (i === 1) {
    await g.say(['リハーサル室は、上の階の右のほうです。', 'ドラマの段取りや読み合わせをしています。\n代役さんを探していることも多いですよ。'], say(WHO.annai));
  } else if (i === 2) {
    await g.say(['楽屋と社員食堂も、上の階にございます。', '楽屋で休むと、体もこころもひと息つけます。\n食堂のおばちゃんの唐揚げは、局の名物です！'], say(WHO.annai));
  } else await g.say('いってらっしゃいませ。', say(WHO.annai));
  if (npc) npc.dir = 'down';
}
async function guardTalk(g) {
  if (!g.flag('tbs_pass')) {
    await g.say(['こんにちは。ゲストの方ですね。', '入館証は、ゲートの前でお渡しします。\nまんなかのゲートへどうぞ。'], say(WHO.guard));
    return;
  }
  await g.say(['入館証、ばっちりですね。', '長い収録の日は、楽屋でこまめに休んでください。\nがんばりすぎて倒れちゃう人、たまにいるんです。'], say(WHO.guard));
}
async function gatePass(g) {
  if (g.flag('tbs_pass')) return;
  g.setFlag('tbs_pass');
  g.sfx('chime');
  await g.emote('tbs_guard', '!');
  await g.say(['お待ちください！', 'こちら、ゲスト用の入館証です。\n首から下げて、ゲートにかざしてくださいね。'], say(WHO.guard));
  g.giveItem('tbs_pass', 1, true);
  g.sfx('ok');
  await g.say('「TBSの入館証」をもらった！\nピッ…青いランプが光って、ゲートが開いた。');
}
async function kanranADTalk(g, npc) {
  if (today(g, 'tbs_kanran_day')) {
    await g.say('今日の観覧は終了しました！\nまた明日お待ちしてます！', say(WHO.kanranAD));
    return;
  }
  const i = await g.ask(['バラエティ番組の観覧、受付中です！', '参加無料・1日1回。\nトークの名人たちを、間近で見られますよ！'], ['観覧する', 'やめておく'], say(WHO.kanranAD));
  if (i !== 0) { await g.say('またどうぞ！\n笑って帰ると、よく眠れますよ〜。', say(WHO.kanranAD)); if (npc) npc.dir = 'left'; return; }
  await g.say('ではスタジオへご案内します！\nこちらへどうぞ！', say(WHO.kanranAD));
  await kanranShow(g);
}

// ------------------------------------------------------------------ studio talk
async function fdTalk(g, npc) {
  const i = await g.ask(['おつかれさまです！フロアディレクターです。', '今日の収録、前説をやってくれる人を探してます。\nだれでもOK！どうです？'], ['前説をやる', 'スタジオのこと', 'またあとで'], say(WHO.fd));
  if (i === 0) await maesetsuJob(g);
  else if (i === 1) {
    await g.say(['奥の階段は、ゲストの登場口。\n上から下りてくるだけで、主役になれるんです。', '両側のソファがゲスト席、まんなかが司会者デスク。\n手前のカメラの前が、観覧席ですよ。', '観覧の受付は、1階ロビーのADまで！'], say(WHO.fd));
  } else await g.say('いつでもどうぞ！', say(WHO.fd));
  if (npc) npc.dir = 'left';
}
async function directorTalk(g, npc) {
  const st = g.state;
  if (!st.agency && st.fame < 30) {
    await g.say(['ディレクターの藍沢です。', 'コントの脇役は、事務所に所属しているか\n★30以上の人にお願いしているんです。', 'まずは前説や、リハーサル室の代役で\n経験を積んでみてください！'], say(WHO.director));
    if (npc) npc.dir = 'down';
    return;
  }
  const i = await g.ask(['ちょうどよかった！', 'コントの相手役が、ひとり足りないんです。\nやってみませんか？'], ['コントに出る', 'コツを聞く', 'またこんど'], say(WHO.director));
  if (i === 0) await kontoJob(g);
  else if (i === 1) {
    await g.say(['コントは「本気でやる」ほど面白くなります。', '笑わせようとしなくていい。\nその役の人として、全力で困って、全力で驚く！', '演技のスキルが高いほど、コマンドが楽になりますよ。'], say(WHO.director));
  } else await g.say('はい、またぜひ！', say(WHO.director));
  if (npc) npc.dir = 'down';
}

// ------------------------------------------------------------------ dressing room
async function restSofa(g) {
  if (today(g, 'tbs_rest_day')) { await g.say('ソファにもたれて、ひと息…。\n今日はもう十分休んだ。'); return; }
  const i = await g.ask('楽屋のソファで、ひと休みする？\n（1日1回：体力 +15・ストレス -10）', ['休む', 'やめておく']);
  if (i !== 0) return;
  g.setFlag('tbs_rest_day', g.state.day);
  await g.fadeOut();
  g.sfx('sleep');
  await g.wait(500);
  g.heal(15);
  g.relax({ stress: 10 });
  await g.fadeIn();
  await g.say('アイマスクをして、少しだけ仮眠…。\nすっきりした！\n（体力 +15・ストレス -10）');
}
async function mirror(g) {
  if (today(g, 'tbs_mirror_day')) { await g.say('鏡の中の自分に、にっこり。\n…うん、いい感じ！'); return; }
  g.setFlag('tbs_mirror_day', g.state.day);
  g.sfx('good');
  g.bathe(15, true);
  await g.say('電球つきの鏡で、前髪と襟元をチェックした。\n（身だしなみ +15・1日1回）\nメイクさんにお願いすると、もっとピカピカに！');
}
async function makeTalk(g, npc) {
  if (today(g, 'tbs_make_day')) {
    await g.say(['うん、きれいに仕上がってます。', '身だしなみは、ひと晩寝るだけでも乱れるの。\n朝のシャワーと、ときどき美容院でね！'], say(WHO.make));
    if (npc) npc.dir = 'right';
    return;
  }
  const i = await g.ask(['メイクの雪村です。', 'ちょっと座って。\n照明に負けない顔に仕上げますよ。'], ['お願いします', 'だいじょうぶ'], say(WHO.make));
  if (i === 0) {
    g.setFlag('tbs_make_day', g.state.day);
    await g.fadeOut();
    g.sfx('shutter');
    await g.wait(350);
    g.bathe(35, true);
    await g.fadeIn();
    g.sfx('good');
    await g.say(['はい、完成！', '（身だしなみ +35・1日1回）'], say(WHO.make));
  } else {
    await g.say('身だしなみが乱れてると、人の好感度も\n上がりにくくなっちゃうの。気をつけてね。', say(WHO.make));
  }
  if (npc) npc.dir = 'right';
}
async function sashiire(g) {
  if (today(g, 'tbs_snack_day')) { await g.say('差し入れのかごは、もう空っぽだ。\nまた明日のお楽しみ。'); return; }
  if (!g.canEat()) { await g.say('差し入れのどら焼きがある。\n…でも、おなかいっぱいで入らない。'); return; }
  g.setFlag('tbs_snack_day', g.state.day);
  g.sfx('good');
  g.eat(10, { fill: 12 });
  await g.say('ちゃぶ台の上に、差し入れのどら焼き。\nひとつ、いただきます！\n（体力 +10・満腹 +12・1日1回）');
}

// ------------------------------------------------------------------ rehearsal room
async function kantokuTalk(g, npc) {
  if (!g.flag('tbs_yomiawase')) {
    g.setFlag('tbs_yomiawase');
    await g.emote('tbs_kantoku', '!');
    await g.say(['おや、新しい顔だね。演出の碧川です。', 'ちょうど読み合わせをしていたんだ。\nこのセリフ、ひとつ読んでみてくれないか。'], say(WHO.kantoku));
    await g.say('台本「……ずっと、言えなかったことがあるんだ」');
    const i = await g.ask('どう読もう？', ['小さな声で、ためらって', '明るく、元気いっぱいに', '早口で、さらっと'], say(WHO.kantoku));
    if (i === 0) {
      await g.say(['……うん。いいね。', 'セリフの前の「間」に、気持ちが入っていた。\nその感覚、大事にしなさい。'], say(WHO.kantoku));
    } else if (i === 1) {
      await g.say(['ははは、ずいぶん明るい告白だ！', 'でも、その思いきりのよさは武器になる。\n場面の気持ちを想像すると、もっとよくなるよ。'], say(WHO.kantoku));
    } else {
      await g.say(['速いなあ！気持ちが追いついてないぞ。', 'セリフは「急がない」。\n相手が受け取るのを待つのも芝居なんだ。'], say(WHO.kantoku));
    }
    g.addSkill('engi', 1, true);
    g.giveItem('tbs_daihon', 1, true);
    g.sfx('fanfare');
    await g.say('「読み合わせの台本」をもらった！\n（演技 +1）');
    if (npc) npc.dir = 'up';
    return;
  }
  const i = await g.ask(['いま、ドラマの段取りをしているんだ。', '主役が来る前に、立ち位置を決めたい。\n代役をお願いできるかな？'], ['代役をやる', '演技のコツ', 'またこんど'], say(WHO.kantoku));
  if (i === 0) await daiyakuJob(g);
  else if (i === 1) {
    await g.say(['演技は、まず「聞く」こと。', '相手のセリフをちゃんと聞けば、\n自然と顔が動く。それが芝居だよ。', '疲れていると、人の話は耳に入らない。\nよく食べて、よく眠りなさい。'], say(WHO.kantoku));
  } else await g.say('うん、またおいで。', say(WHO.kantoku));
  if (npc) npc.dir = 'up';
}

// 小道具さんの落とし物（corridor → reha → corridor）
async function kogumiTalk(g, npc) {
  const st = g.flag('tbs_watch_quest');
  if (!st) {
    g.setFlag('tbs_watch_quest', 'asked');
    await g.say(['うーん、困った困った…。', '小道具の中村です。ドラマで使う懐中時計が\nどこかに行っちゃって。', 'たぶんリハーサル室だと思うんだけど…\nもし見かけたら、教えてくれないかな？'], say(WHO.kogumi));
  } else if (st === 'asked') {
    await g.say('懐中時計、見つかりました？\nリハーサル室の机のあたりが、あやしいんだよなあ…', say(WHO.kogumi));
  } else if (st === 'found') {
    g.takeItem('tbs_watch', 1);
    g.setFlag('tbs_watch_quest', 'done');
    await g.emote('tbs_kogumi', '!');
    await g.say(['あーっ！それそれ！ありがとう！', 'これがないと、明日の撮影が止まるところでした。\nほんの気持ちだけど、受け取って！'], say(WHO.kogumi));
    g.addMoney(1000);
    g.sfx('coin');
    await g.say('お礼に¥1,000もらった！');
  } else {
    await g.say(['この前は助かったよ。', '小道具ってね、映っても気づかれないくらい\n自然なのが、いちばんの出来なんだ。'], say(WHO.kogumi));
  }
  if (npc) npc.dir = 'down';
}
async function findWatch(g) {
  if (g.flag('tbs_watch_quest') === 'asked') {
    g.setFlag('tbs_watch_quest', 'found');
    g.giveItem('tbs_watch', 1, true);
    g.sfx('ok');
    await g.say('台本の山の下に、金色の懐中時計がある！\n「小道具の懐中時計」を見つけた。\n廊下の小道具さんに届けよう。');
    return;
  }
  await g.say('机の上に、台本と赤ペンが散らばっている。\n付せんに「ここ、もっとためて」の文字。');
}

// ------------------------------------------------------------------ cafeteria
const MENU = [
  { label: 'かけそば', price: 280, heal: 16, fill: 32, text: 'つゆの香りがふわっ。\nさらっと食べられる。' },
  { label: 'しょうゆラーメン', price: 450, heal: 30, fill: 52, text: '昔ながらの、やさしいしょうゆ味。\nスープまで飲みほした！' },
  { label: '焼き魚定食', price: 520, heal: 33, fill: 56, stress: 3, text: '香ばしい焼き鮭に、みそ汁と小鉢。\n体にしみる…。' },
  { label: '名物 唐揚げ定食', price: 550, heal: 37, fill: 60, stress: 4, text: '外はカリッ、中はジュワッ。\n局の名物と言われるのも納得！' },
];
async function shokudo(g, who = WHO.obachan) {
  const st = g.state;
  const items = MENU.map((m) => ({ label: m.label, right: fmtMoney(m.price), disabled: st.money < m.price }));
  items.push({ label: 'やめておく' });
  const i = await g.list({
    title: '社員食堂 メニュー',
    items,
    describe: (k) => (k < MENU.length ? `体力 +${MENU[k].heal}・満腹 +${MENU[k].fill}${MENU[k].stress ? `・ストレス -${MENU[k].stress}` : ''}` : 'またあとで。'),
  });
  if (i < 0 || i >= MENU.length) { await g.say('はーい、またどうぞ！', say(who)); return; }
  const m = MENU[i];
  if (!g.canEat()) { await g.say('あら、もうおなかいっぱいでしょ。\n食べすぎは体に毒よ。', say(who)); return; }
  if (!g.spend(m.price)) { await g.say('あら、お金が足りないみたい。', say(who)); return; }
  g.sfx('coin');
  await g.say(`${m.label}、おまちどおさま！`, say(who));
  g.sfx('good');
  g.eat(m.heal, { fill: m.fill });
  if (m.stress) g.relax({ stress: m.stress });
  await g.say(`${m.text}\n（体力 +${m.heal}・満腹 +${m.fill}${m.stress ? `・ストレス -${m.stress}` : ''}）`);
}
async function obachanTalk(g, npc) {
  if (!g.flag('tbs_shisyoku')) {
    g.setFlag('tbs_shisyoku');
    await g.say(['あら、ちょうどいいところに！', '来週からの新メニュー「スタミナ丼」、\n試食してくれない？お代はいらないわよ！'], say(WHO.obachan));
    if (g.canEat()) {
      g.eat(30, { fill: 45 });
      g.relax({ stress: 5 });
      g.sfx('good');
      await g.say('甘辛いお肉が、ごはんの上にどっさり！\n元気が出る味だ。\n（体力 +30・満腹 +45・ストレス -5）');
      await g.say('どう？いけるでしょ！\nその顔が見たかったのよ〜。', say(WHO.obachan));
    } else {
      await g.say(['あら、おなかいっぱい？', 'じゃあ、においだけでもどうぞ。\n…ふふ、また食べに来てね。'], say(WHO.obachan));
    }
    if (npc) npc.dir = 'down';
    return;
  }
  const i = await g.ask(['いらっしゃい！社員食堂へようこそ。', '出演者さんも見学の人も、どうぞどうぞ！'], ['食べる', 'おすすめは？', 'またね'], say(WHO.obachan));
  if (i === 0) await shokudo(g);
  else if (i === 1) {
    await g.say(['なんといっても唐揚げ定食！', 'おなかがすいたまま寝ると、よく眠れないのよ。\n夜の前に、しっかり食べときなさい。'], say(WHO.obachan));
  } else await g.say('またおいで〜！', say(WHO.obachan));
  if (npc) npc.dir = 'down';
}

// ------------------------------------------------------------------ the place
registerPlace({
  id: PID,
  name: 'TBSテレビ',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 10, y: 11, dir: 'up' },
  legend: {
    '#': T('walltop'), U: T('wall_u'), '=': T('wall'),
    P: 'plant', M: 'exit_mat',
  },
  rooms: {
    // -------------------------------------------------------------- エントランス
    lobby: {
      floor: T('floor'),
      topPad: 24,
      tiles: [
        '######################',
        '#LLLLLLUUEUUEUU0123UU#',
        '#llllll==e==e==4567h=#',
        '#......I......I......#',
        '#KKKKKKI......I......#',
        '#......qG.GG.Gq......#',
        '#.........[].........#',
        '#P........[]......XZW#',
        '#.SSS.....[].........#',
        '#.ttt.....[]......B..#',
        '#.........[]..SSS....#',
        '#P........[]..ttt...P#',
        '##########MM##########',
      ],
      legend: {
        L: T('feat_u'), l: T('feat'), E: `${T('wall_u')}+${T('elevlamp')}`, e: 'elevator',
        0: T('vwall0'), 1: T('vwall1'), 2: T('vwall2'), 3: T('vwall3'), 4: T('vwall4'), 5: T('vwall5'), 6: T('vwall6'), 7: T('vwall7'),
        h: `${T('wall')}+${T('panel')}`, I: `${T('floor')}+${T('pillar')}`,
        K: T('counter'), q: T('glass'), G: T('gate'), '[': T('run_l'), ']': T('run_r'),
        X: T('props'), Z: T('oldcam'), W: T('award'),
        S: 'sofa_blue', t: 'table_low', B: 'sign_board',
      },
      warps: [
        ...exitWarps([10, 11], 12),
        { x: 9, y: 2, room: 'corridor', tx: 2, ty: 3, dir: 'down' },
        { x: 12, y: 2, room: 'corridor', tx: 4, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 1.4, y: 0.5, w: 5.2, h: 2.2, logo: PID, board: true, lights: true },
        npc('tbs_recep', 3, 3, 'down', WHO.uketsuke, { talk: uketsukeTalk }),
        npc('tbs_annai', 4, 3, 'down', WHO.annai, { talk: annaiTalk }),
        npc('tbs_guard', 15, 4, 'left', WHO.guard, { talk: posted('left', guardTalk) }),
        npc('tbs_kanran_ad', 19, 9, 'left', WHO.kanranAD, { talk: kanranADTalk }),
        npc('tbs_fan', 16, 3, 'up', WHO.fan, {
          talk: posted('up', lines(WHO.fan, ['ビジョン、ずっと見てられる〜！', '画面がいっぱいあって、いろんな番組が\nいっぺんに流れてるの。お祭りみたい！'])),
        }),
        npc('tbs_student', 6, 8, 'down', WHO.student, {
          wander: 1,
          text: ['大学で放送の勉強をしてて、見学に来ました！', 'ここって、ドラマの撮影もしてるんですよね。\n展示の小道具、本物みたいでドキドキします。'],
        }),
        npc('tbs_waiting', 3, 8, 'down', WHO.waiting, {
          text: ['打ち合わせの相手を待ってます。', 'テレビの仕事って、待ち時間との戦いなんですよ。\nだから、休めるときにしっかり休む！これ鉄則。'],
        }),
        { type: 'sign', x: 18, y: 9, text: '立て看板だ。\n「バラエティ番組 観覧受付中」\n「参加無料・お気軽に係のADまで」' },
        { type: 'sign', x: 18, y: 7, text: 'ドラマの撮影で使われた小道具の展示だ。\nカチンコ、台本、卓上ランプ…\n「どれも物語を支えた名脇役です」と書いてある。' },
        { type: 'sign', x: 19, y: 7, text: '木の三脚にのった、昔のテレビカメラだ。\nずっしり重そう。\n当時のカメラマンは力持ちだったにちがいない。' },
        { type: 'sign', x: 20, y: 7, text: '白い棚に、トロフィーやクリスタルの盾が並ぶ。\nたくさんの番組の、がんばりのあかしだ。' },
        { type: 'sign', x: 19, y: 2, text: '「名場面」のパネルだ。\nドラマの撮影風景の写真が並んでいる。\nスタッフも役者さんも、みんな真剣な顔だ。' },
      ],
      events: [
        { x: 9, y: 5, on: 'step', cond: (g) => !g.flag('tbs_pass'), run: gatePass },
        { x: 12, y: 5, on: 'step', cond: (g) => !g.flag('tbs_pass'), run: gatePass },
        { x: 15, y: 2, w: 4, on: 'action', run: async (g) => { await g.say('大きなビデオウォールだ。\nいま放送中の番組が、9つの画面に映っている。\nバラエティ、ドラマ、ニュース、天気…'); } },
        {
          x: 10, y: 10, w: 2, on: 'step', once: 'tbs_welcome',
          run: async (g) => {
            await g.emote('tbs_recep', '!');
            await g.say(['TBSテレビへようこそ。', '出演のご相談は、左の受付へ。\n番組観覧は、右手のADがご案内します。'], say(WHO.uketsuke));
          },
        },
      ],
    },

    // -------------------------------------------------------------- スタジオフロア（廊下）
    corridor: {
      floor: 'floor_carpet_gray',
      tiles: [
        '#######################',
        '#UUUUUUUUUUUUUUUUUUUUU#',
        '#=e=e=cSsO=a=b=pr=p=g=#',
        '#Q........V......P....#',
        '#.....................#',
        '#P....BB........BB...P#',
        '#######################',
      ],
      legend: {
        e: 'elevator', c: `${T('wall')}+clock`, S: T('sdoor_l'), s: T('sdoor_r'), O: `${T('wall')}+onair`,
        a: T('gdoor_lock'), b: T('gdoor'), p: `${T('wall')}+poster`, r: 'door_metal', g: 'door_glass',
        Q: 'water_server', V: 'vending', B: 'sofa_blue',
      },
      warps: [
        { x: 2, y: 2, room: 'lobby', tx: 9, ty: 3, dir: 'down' },
        { x: 4, y: 2, room: 'lobby', tx: 12, ty: 3, dir: 'down' },
        { x: 7, y: 2, room: 'studio', tx: 10, ty: 12, dir: 'up' },
        { x: 8, y: 2, room: 'studio', tx: 11, ty: 12, dir: 'up' },
        { x: 13, y: 2, room: 'gakuya', tx: 5, ty: 7, dir: 'up' },
        { x: 16, y: 2, room: 'reha', tx: 6, ty: 8, dir: 'up' },
        { x: 20, y: 2, room: 'shokudo', tx: 7, ty: 9, dir: 'up' },
      ],
      entities: [
        plate(1.5, 1, 'エレベーター', 3),
        plate(6.5, 1, 'スタジオ', 3),
        plate(10, 1, '楽屋A'),
        plate(12, 1, '楽屋B'),
        plate(15, 1, 'リハ室'),
        plate(19, 1, '社員食堂'),
        npc('tbs_kogumi', 14, 4, 'down', WHO.kogumi, { talk: kogumiTalk }),
        npc('tbs_ad', 5, 4, 'right', WHO.ad, {
          wander: 2,
          text: ['ADの青木です！今日も小走りです！', 'スタジオの前の「ON AIR」が光ってたら本番中。\n静かにお願いしますね！', '「楽屋B」は空いてますよ。\nメイクさんもいるので、どうぞ使ってください！'],
        }),
        npc('tbs_actor', 19, 4, 'left', WHO.actor, {
          wander: 1,
          text: ['（台本をぶつぶつ…）あ、すみません。', 'リハーサル室で段取りの最中なんです。\nセリフって、寝る前に読むと覚えやすいんですよ。', 'ストレスがたまると、セリフが頭に入らない…。\nだから休憩のときは、思いきり休みます！'],
        }),
      ],
      events: [
        { x: 11, y: 2, on: 'action', run: async (g) => { await g.say('青いのれんの奥から、発声練習が聞こえる。\nドアには「本日 使用中」の紙。\n…ここは、ほかの出演者さんの楽屋だ。'); } },
        { x: 6, y: 5, w: 2, on: 'action', run: async (g) => { await g.say('廊下のソファだ。\n出番待ちの人が、ここで台本を読んでいる。'); } },
        { x: 16, y: 5, w: 2, on: 'action', run: async (g) => { await g.say('廊下のソファだ。\n誰かの忘れたのど飴がひとつ…さわらないでおこう。'); } },
      ],
    },

    // -------------------------------------------------------------- 楽屋
    gakuya: {
      floor: 'floor_carpet_blue',
      tiles: [
        '############',
        '#UUUUUUUUUU#',
        '#==v=mm=mm=#',
        '#R...kk.kk.#',
        '#L.........#',
        '#.SSS..tttt#',
        '#.bbb..tTTt#',
        '#P.....tttt#',
        '#####MM#####',
      ],
      legend: {
        m: `${T('wall')}+mirror`, v: `${T('wall')}+tv_wall`, k: 'makeup', L: 'locker', R: 'clothes_rack',
        S: 'sofa_blue', b: 'table_low', t: 'floor_tatami', T: 'floor_tatami+table_low',
      },
      warps: [
        { x: 5, y: 8, room: 'corridor', tx: 13, ty: 3, dir: 'down' },
        { x: 6, y: 8, room: 'corridor', tx: 13, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('tbs_make', 7, 3, 'right', WHO.make, { talk: makeTalk }),
        { type: 'logo', x: 1.1, y: 1.2, w: 1.8, h: 1.02, logo: PID, board: true, text: '楽屋にも、TBSのロゴ。\n青い文字を見ると、気持ちがしゃんとする。' },
      ],
      events: [
        { x: 5, y: 3, w: 2, on: 'action', run: mirror },
        { x: 8, y: 3, w: 2, on: 'action', run: mirror },
        { x: 2, y: 5, w: 3, on: 'action', run: restSofa },
        { x: 2, y: 6, w: 3, on: 'action', run: async (g) => { await g.say('ローテーブルに、今日の進行表が置いてある。\n「収録 → 休憩 → 収録」…長い一日になりそうだ。'); } },
        { x: 8, y: 6, w: 2, on: 'action', run: sashiire },
        { x: 3, y: 2, on: 'action', run: async (g) => { await g.say(onAir ? 'モニターに、スタジオの本番が映っている。' : 'モニターに、いま放送中の番組が映っている。\n楽屋でも、番組の流れがわかるようになっている。'); } },
        { x: 1, y: 3, on: 'action', run: async (g) => { await g.say('衣装ラックだ。\n青いジャケットに「本番用」の札がついている。'); } },
        { x: 1, y: 4, on: 'action', run: async (g) => { await g.say('ロッカーだ。\n「貴重品は各自で管理を」の貼り紙。'); } },
      ],
      onEnter: (g) => {
        if (g.flag('tbs_gakuya_first')) return;
        g.setFlag('tbs_gakuya_first');
        greet(g, async () => {
          await g.wait(200);
          await g.emote('tbs_make', '!');
          await g.say(['いらっしゃい。楽屋B、今日は空いてますよ。', 'ソファで仮眠、鏡で身だしなみ、\n畳のちゃぶ台には差し入れもあります。\nごゆっくり！'], say(WHO.make));
        });
      },
    },

    // -------------------------------------------------------------- バラエティスタジオ
    studio: {
      floor: T('sfloor'),
      bgm: 'studio',
      topPad: 24,
      tiles: [
        '######################',
        '#AA012AAAADEAAAA012AA#',
        '#aa345aaaadfaaaa345aa#',
        '#L,,,,,,,,[],,,,,,,,L#',
        '#,cccc,,,,,,,,,,cccc,#',
        '#,,,,,,,,mMMm,,,,,,,,#',
        '#.eeeeeeesssseeeeeee.#',
        '#....................#',
        '#..K...K....K...K..R.#',
        '#....................#',
        '#..QQQQQQ....QQQQQQ..#',
        '#..QQQQQQ....QQQQQQ..#',
        '#....................#',
        '##########NN##########',
      ],
      legend: {
        A: T('set_u'), a: T('set'),
        0: T('led0'), 1: T('led1'), 2: T('led2'), 3: T('led3'), 4: T('led4'), 5: T('led5'),
        D: T('arch_ul'), E: T('arch_ur'), d: T('arch_l'), f: T('arch_r'), R: `${T('sfloor')}+director_chair`, e: `${T('sfloor')}+${T('edge')}`,
        '[': T('stair_l'), ']': T('stair_r'),
        ',': T('setfloor'), L: `${T('setfloor')}+spotlight`, c: `${T('setfloor')}+${T('couch')}`,
        m: `${T('setfloor')}+${T('mcdesk')}`, M: `${T('setfloor')}+${T('mcdesk')}`,
        s: T('steps'), K: `${T('sfloor')}+camera`, Q: `${T('sfloor')}+${T('seat')}`, N: 'exit_mat',
      },
      warps: [
        { x: 10, y: 13, room: 'corridor', tx: 7, ty: 3, dir: 'down' },
        { x: 11, y: 13, room: 'corridor', tx: 8, ty: 3, dir: 'down' },
      ],
      entities: [
        onAirLamp(13.6, 1.3, () => !!onAir),
        // regular crew
        npc('tbs_fd', 13, 7, 'left', WHO.fd, { talk: fdTalk, cond: () => !show }),
        npc('tbs_director', 19, 9, 'down', WHO.director, { talk: directorTalk, cond: () => !show }),
        npc('tbs_cam1', 7, 9, 'up', WHO.camera, {
          cond: () => !show,
          talk: posted('up', lines(WHO.camera, ['カメラマンです。', '階段から下りてくるゲストを、下からあおって撮る。\nそれだけで、ぐっとスターっぽく見えるんですよ。'])),
        }),
        npc('tbs_sound', 2, 7, 'right', WHO.sound, {
          cond: () => !show,
          talk: posted('right', lines(WHO.sound, ['音声さんだよ。', 'ピンマイクは、服にこすれるとガサガサ鳴る。\n本番中は、むやみに胸をたたかないでね。', '笑い声も大事な「音」。\n観覧のお客さんの声は、番組の宝物なんだ。'])),
        }),
        // show cast
        npc('tbs_show_fd', 12, 7, 'up', WHO.fd, { cond: () => show === 'kanran' || show === 'konto', text: '本番中です…！\n（カンペで合図を送っている）' }),
        npc('tbs_show_fd2', 13, 8, 'up', WHO.fd, { cond: () => show === 'maesetsu', text: 'いい感じですよ！' }),
        npc('tbs_show_mc', 10, 4, 'down', WHO.mc, { cond: () => show === 'kanran' || show === 'konto', text: '今日もよろしくお願いします！' }),
        npc('tbs_show_as', 11, 4, 'down', WHO.assist, { cond: () => show === 'kanran' || show === 'konto', text: 'がんばりましょうね！' }),
        npc('tbs_show_g1', 3, 4, 'down', WHO.guestA, { cond: () => show === 'kanran' || show === 'konto', text: '今日もしゃべるでー！' }),
        npc('tbs_show_g2', 10, 3, 'down', WHO.guestB, { cond: () => show === 'kanran', hidden: true, text: '階段、こわかった〜！' }),
        npc('tbs_show_g3', 4, 4, 'down', WHO.guestC, { cond: () => show === 'kanran' || show === 'konto', text: 'バラエティって楽しいですね。' }),
        npc('tbs_show_g4', 17, 4, 'down', WHO.guestD, { cond: () => show === 'kanran' || show === 'konto', text: 'わしも、まだまだ若いもんには負けんよ。' }),
        npc('tbs_show_konbi', 9, 4, 'left', WHO.konbi, { cond: () => show === 'konto', text: '思いきりおいで！' }),
        npc('tbs_show_cam1', 3, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        npc('tbs_show_cam2', 7, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        npc('tbs_show_cam3', 12, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        npc('tbs_show_cam4', 16, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        ...AUD.map(([id, x, y, look]) => npc(id, x, y, 'up', { name: WHO.aud.name, look }, { cond: audVisible(id), text: ['ドキドキ…！', '楽しみ〜！', '映るかな？'][x % 3] })),
      ],
      events: [
        { x: 10, y: 3, w: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('セットの階段だ。\nゲストはここから下りてきて登場する。\n一段一段、光が反射してキラキラしている！'); } },
        { x: 9, y: 5, w: 4, on: 'action', cond: () => !show, run: async (g) => { await g.say('司会者デスクだ。\n台本の表紙に「本番中は台本を見ない！」のメモ。'); } },
        { x: 2, y: 4, w: 4, on: 'action', cond: () => !show, run: async (g) => { await g.say('ゲスト用のソファだ。\n座り心地がよすぎて、本番中に眠くなりそう。'); } },
        { x: 16, y: 4, w: 4, on: 'action', cond: () => !show, run: async (g) => { await g.say('ゲスト用のソファだ。\n青いクッションが、局の色とおそろい。'); } },
        { x: 3, y: 1, w: 3, h: 2, on: 'action', run: async (g) => { await g.say('サイドビジョンだ。\n本番中は、ここにVTRや出演者の顔が大きく映る。'); } },
        { x: 16, y: 1, w: 3, h: 2, on: 'action', run: async (g) => { await g.say('サイドビジョンだ。\n夜景の映像が、ゆっくり流れている。'); } },
        { x: 3, y: 8, on: 'action', run: async (g) => { await g.say('スタジオカメラだ。\nゲスト席のほうを向いている。'); } },
        { x: 7, y: 8, on: 'action', run: async (g) => { await g.say('スタジオカメラだ。\nファインダーに、階段セットが映っている。'); } },
        { x: 12, y: 8, on: 'action', run: async (g) => { await g.say('センターのカメラだ。\n司会者デスクを正面から映している。'); } },
        { x: 16, y: 8, on: 'action', run: async (g) => { await g.say('スタジオカメラだ。\nレンズに「3」のシールが貼ってある。'); } },
        { x: 19, y: 8, on: 'action', run: async (g) => { await g.say('ディレクターのいすだ。\n背もたれに、青いタオルがかかっている。'); } },
        { x: 3, y: 10, w: 6, h: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('観覧席だ。\nふかふかの青いいす。'); } },
        { x: 13, y: 10, w: 6, h: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('観覧席だ。\n背もたれの裏に「拍手はおおきく！」のシール。'); } },
      ],
      drawOver: (ctx, g, cam) => {
        if (!onAir) return;
        ctx.fillStyle = 'rgba(200,225,255,0.08)';
        for (const cx of [4, 10.5, 17]) {
          const x0 = cx * 16 + 8 - cam.x, y0 = 24 - cam.y;
          ctx.beginPath();
          ctx.moveTo(x0 - 5, y0); ctx.lineTo(x0 + 5, y0); ctx.lineTo(x0 + 30, y0 + 72); ctx.lineTo(x0 - 30, y0 + 72);
          ctx.closePath(); ctx.fill();
        }
      },
      onEnter: (g) => {
        if (show || g.flag('tbs_studio_first')) return;
        g.setFlag('tbs_studio_first');
        greet(g, async () => {
          await g.wait(200);
          await g.emote('tbs_fd', '!');
          await g.say(['見学の方ですか？ようこそ！', '奥の階段が、ゲストの登場口。\n両側にゲスト席、まんなかに司会者デスクです。', '前説、いつでも募集中！\n声をかけてくださいね！'], say(WHO.fd));
        });
      },
    },

    // -------------------------------------------------------------- リハーサル室
    reha: {
      floor: T('rfloor'),
      tiles: [
        '##############',
        '#UUUUUcUUUUUU#',
        '#mmmmmmmmmmmm#',
        '#R..........B#',
        '#...+....+...#',
        '#.......+....#',
        '#.TTT....TTT.#',
        '#.hhh....hhh.#',
        '#P..........P#',
        '######MM######',
      ],
      legend: {
        c: `${T('wall_u')}+clock`, m: T('mirror'), '+': T('bami'), T: T('script'), h: 'chair', R: 'clothes_rack', B: 'boxes',
      },
      warps: [
        { x: 6, y: 9, room: 'corridor', tx: 16, ty: 3, dir: 'down' },
        { x: 7, y: 9, room: 'corridor', tx: 16, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('tbs_kantoku', 6, 7, 'up', WHO.kantoku, { talk: kantokuTalk }),
        npc('tbs_joshu', 8, 7, 'up', WHO.joshu, {
          talk: posted('up', lines(WHO.joshu, ['演出補です。床の色テープは「バミリ」っていうんです。', '役者さんが立つ場所の目印。\n色で、だれの立ち位置かを分けてるんですよ。', '代役さんは、主役と同じ位置・同じ動きで。\nカメラさんが、それを見てアングルを決めます。'])),
        }),
        npc('tbs_actress', 9, 4, 'up', WHO.actress, {
          wander: 1, cond: () => show !== 'daiyaku',
          text: ['（鏡に向かって、表情の練習中）', '泣くお芝居のときは、悲しいことを思い出すんじゃなくて、\nその役の人生を想像するの。', '…って、先輩の受け売りだけどね。ふふ。'],
        }),
      ],
      events: [
        { x: 2, y: 6, w: 3, on: 'action', run: findWatch },
        { x: 9, y: 6, w: 3, on: 'action', run: async (g) => { await g.say('机の上に、香盤表と台本が並んでいる。\nシーンごとに、出演者と時間がびっしり。'); } },
        { x: 1, y: 2, w: 12, on: 'action', run: async (g) => { await g.say('壁一面の鏡と、手すりのバー。\n自分の動きを確かめながら練習できる。'); } },
      ],
    },

    // -------------------------------------------------------------- 社員食堂
    shokudo: {
      floor: 'floor_tile',
      bgm: 'office',
      tiles: [
        '################',
        '#UUUUUUUUUUUUUU#',
        '#=ww=ww===nn===#',
        '#........Fk..kk#',
        '#....YZX.CCCCCC#',
        '#..............#',
        '#.sOs..sOs..sOs#',
        '#..............#',
        '#.sOs..sOs..sOs#',
        '#P............P#',
        '#######MM#######',
      ],
      legend: {
        w: `${T('wall')}+${T('window')}`, n: `${T('wall')}+${T('menu')}`,
        F: 'fridge_drinks', k: 'kitchen', C: 'counter_white', X: T('kenbaiki'), Y: T('sample_l'), Z: T('sample_r'),
        O: T('rtable'), s: T('stool'),
      },
      warps: [
        { x: 7, y: 10, room: 'corridor', tx: 20, ty: 3, dir: 'down' },
        { x: 8, y: 10, room: 'corridor', tx: 20, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('tbs_obachan', 12, 3, 'down', WHO.obachan, { talk: obachanTalk }),
        npc('tbs_eater', 9, 6, 'left', WHO.eater, {
          talk: posted('left', lines(WHO.eater, ['音声さんの昼休み。ラーメン、うまい！', '収録が長引くと、ごはんを食べそこねるんだ。\nおなかがペコペコだと、集中力が切れちゃう。'])),
        }),
        npc('tbs_eater2', 12, 8, 'right', WHO.eater2, {
          talk: posted('right', lines(WHO.eater2, ['スタイリストよ。今日は唐揚げ定食！', '衣装はね、清潔感がいちばん。\nしわしわの服は、コインランドリーでパリッと！'])),
        }),
        npc('tbs_eater3', 2, 8, 'right', { name: '休憩中のAD', look: { ...LOOKS.ad, top: BLUL } }, {
          talk: posted('right', lines({ name: '休憩中のAD', look: { ...LOOKS.ad, top: BLUL } }, ['5分で食べて、また走ります！', 'ADの必殺技は「立ったまま寝る」です。\n…みなさんは、ちゃんと横になって寝てくださいね。'])),
        }),
      ],
      events: [
        { x: 7, y: 4, on: 'action', run: async (g) => { await g.say('食券機だ。青いボタンがずらりと並んでいる。'); await shokudo(g); } },
        { x: 5, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('食品サンプルのショーケースだ。\n唐揚げ、ラーメン、焼き魚、どんぶり…\nおなかが鳴った。'); } },
        { x: 2, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('窓の外に、並木道と街並みが見える。\n緑がまぶしい。'); } },
        { x: 5, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('窓ぎわの席は、ひなたぼっこにぴったりだ。'); } },
      ],
      onEnter: (g) => {
        if (g.flag('tbs_shokudo_first')) return;
        g.setFlag('tbs_shokudo_first');
        greet(g, async () => {
          await g.wait(200);
          await g.emote('tbs_obachan', '!');
          await g.say(['いらっしゃい！はじめての顔ね。', '食券機か、カウンターのわたしに注文してね。\nちょっと話もあるのよ、こっちおいで！'], say(WHO.obachan));
        });
      },
    },
  },
});
