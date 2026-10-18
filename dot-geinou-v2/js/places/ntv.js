// 日本テレビ（港エリア）— バラエティでおなじみの民放テレビ局
//
//   lobby    エントランス   受付（番組出演の窓口 programDesk）・赤いロゴの壁・入館ゲート・待合ソファ・
//                           オンエア中のモニター・展示コーナー（昔のテレビカメラ／スタジオの模型／盾とトロフィー）
//   corridor スタジオフロア  エレベーター・楽屋（1は使用中、2が自分の楽屋）・バラエティスタジオ・会議室・社員食堂
//   gakuya   楽屋          ひと休み（体力・ストレス）・鏡（身だしなみ）・メイクさん・差し入れ
//   studio   バラエティスタジオ  セット・ひな壇・大型ビジョン・カメラ・観覧席・フロアディレクター
//   kaigi    会議室        企画会議（1回きり）・プロデューサー・構成作家
//   shokudo  社員食堂      食券機と食品サンプル。安くておなかいっぱい（g.eat）
//
// お仕事（番組の出演依頼は受付の programDesk。ここにあるのは局の小さなお仕事）：
//   ★0         番組観覧（無料・1日1回：お笑い +1・ストレス -8）／前説（tsukkomi d1）
//   所属 or ★30 ひな壇ゲスト（talk d2）
//
// 実在の番組名・出演者は出しません。スタッフはすべて架空の人物です。

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS } from '../engine/sprites.js';
import { defineTile, R, P, Rw, disc, oval, line, bevel, inset, dither, grain, outline, shadowEllipse, speckle, pix } from '../engine/tiles.js';
import { registerItem, payText } from '../engine/state.js';
import { ACTIVITY } from '../engine/life.js';
import { text, measure } from '../engine/draw.js';
import { shade, makeCanvas, fmtMoney } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

const PID = 'ntv';
const T = (k) => `${PID}_${k}`;

// ------------------------------------------------------------------ palette (日テレの赤)
const RED = '#e60020';
const REDD = '#b3001b';
const REDX = '#7a0012';
const REDL = '#ff4a5c';
const REDP = '#ffd5da';
const WHT = '#ffffff';
const OFF = '#f5f3ef';
const LG = '#e6e3dd';
const MG = '#c9c5bd';
const DG = '#86827a';
const INK = '#22202a';
const GOLD = '#ffd23f';
const GOLDD = '#c9a227';
const BULB = '#fff3b0';
const WOOD = '#b98552';
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

// ------------------------------------------------------------------ walls & floors
tile('walltop', { solid: true, hd(c) { R(c, 0, 0, 32, 32, '#2c2a30'); } });
// warm-white panelled wall, upper course (thin red line under the lip)
function wallUpper(c) {
  R(c, 0, 0, 32, 32, OFF);
  for (const x of [15, 31]) { R(c, x, 4, 1, 28, LG); R(c, (x + 1) % 32, 4, 1, 28, WHT); }
  R(c, 0, 0, 32, 1, shade(OFF, -0.3)); R(c, 0, 1, 32, 1, WHT);
  R(c, 0, 2, 32, 1, RED); R(c, 0, 3, 32, 1, REDD);
}
function wallLower(c) {
  R(c, 0, 0, 32, 32, OFF);
  for (const x of [15, 31]) { R(c, x, 0, 1, 17, LG); R(c, (x + 1) % 32, 0, 1, 17, WHT); }
  R(c, 0, 17, 32, 1, LG);
  R(c, 0, 18, 32, 4, RED); R(c, 0, 18, 32, 1, REDL); R(c, 0, 21, 32, 1, REDD);
  R(c, 0, 22, 32, 4, WHT); R(c, 0, 25, 32, 1, LG);
  R(c, 0, 26, 32, 6, '#5a5750'); R(c, 0, 26, 32, 1, '#3c3a35'); R(c, 0, 27, 32, 1, '#6e6a62'); R(c, 0, 31, 32, 1, '#3c3a35');
}
tile('wall_u', { solid: true, hd: wallUpper });
tile('wall', { solid: true, hd: wallLower });
// the red feature wall behind the reception (the logo hangs here)
function featPaint(lower) {
  return (c) => {
    R(c, 0, 0, 32, 32, RED);
    for (let x = 0; x < 32; x += 8) { R(c, x, 0, 1, 32, REDD); R(c, x + 1, 0, 1, 32, '#f0182f'); }
    if (!lower) { R(c, 0, 0, 32, 1, REDX); R(c, 0, 1, 32, 1, REDL); }
    else {
      R(c, 0, 24, 32, 2, REDD); R(c, 0, 26, 32, 6, REDX); R(c, 0, 26, 32, 1, '#5a000c'); R(c, 0, 27, 32, 1, '#9a0016');
    }
  };
}
tile('feat_u', { solid: true, hd: featPaint(false) });
tile('feat', { solid: true, hd: featPaint(true) });
// polished pale stone, 32px slabs
tile('floor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#eeebe5');
    speckle(c, r, ['#e8e4dd', '#f3f1ec', '#e5e1d9'], 40);
    R(c, 0, 0, 32, 1, '#dcd7ce'); R(c, 0, 0, 1, 32, '#dcd7ce'); R(c, 0, 1, 32, 1, '#f8f6f2');
    if (v === 0) { R(c, 6, 6, 6, 1, WHT); R(c, 6, 7, 1, 3, WHT); }
    if (v === 1) { line(c, 18, 24, 26, 16, '#f8f6f2'); }
  },
});
// red entrance runner (two halves with a white inlay on the outside)
function runner(side) {
  return (c, r) => {
    R(c, 0, 0, 32, 32, RED);
    speckle(c, r, [REDD, '#ef1a36', '#d4001d'], 70);
    const x = side === 'l' ? 2 : 28;
    R(c, x, 0, 2, 32, WHT); R(c, side === 'l' ? 0 : 30, 0, 2, 32, REDX);
    R(c, side === 'l' ? 4 : 27, 0, 1, 32, REDD);
  };
}
tile('run_l', { hd: runner('l') });
tile('run_r', { hd: runner('r') });
// glossy set floor with a faint grid; v1 = the performer's tape mark
tile('setfloor', {
  variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, '#f7eef0');
    R(c, 0, 0, 32, 1, '#ead7db'); R(c, 0, 16, 32, 1, '#efe0e3'); R(c, 0, 0, 1, 32, '#ead7db'); R(c, 16, 0, 1, 32, '#efe0e3');
    if (v === 0) { line(c, 4, 12, 12, 4, WHT); line(c, 5, 13, 13, 5, '#fbf6f7'); }
    if (v === 1) { R(c, 10, 15, 12, 3, RED); R(c, 15, 10, 3, 12, RED); R(c, 10, 15, 12, 1, REDL); }
    if (v === 2) { line(c, 20, 28, 28, 20, WHT); }
  },
});

// ------------------------------------------------------------------ lobby furniture
// reception counter: white top, red front with a white stripe
tile('counter', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  hd(c, r, f, v) {
    R(c, 0, 4, 32, 9, WHT); R(c, 0, 4, 32, 1, '#fafafa'); R(c, 0, 12, 32, 1, LG);
    R(c, 0, 13, 32, 17, RED); R(c, 0, 13, 32, 1, REDX); R(c, 0, 14, 32, 1, REDL);
    R(c, 0, 20, 32, 2, WHT); R(c, 0, 22, 32, 1, REDP);
    R(c, 0, 28, 32, 2, REDX);
    if (v === 1) { R(c, 18, 0, 10, 8, INK); R(c, 19, 1, 8, 6, '#3b3f48'); R(c, 22, 8, 2, 3, DG); R(c, 19, 10, 8, 1, DG); }
    if (v === 2) {
      R(c, 4, 6, 7, 5, REDP); R(c, 5, 7, 5, 1, RED); R(c, 5, 9, 4, 1, MG);
      oval(c, 20, 6, 6, 5, GOLD); R(c, 22, 5, 2, 1, GOLDD); P(c, 21, 7, '#fff6c8'); R(c, 19, 10, 8, 1, GOLDD);
    }
    outline(c);
  },
});
// security gate pedestal with a card reader; glass flaps reach into the lanes
tile('gate', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 8, 2);
    R(c, 0, 13, 9, 7, '#d6eef7'); R(c, 0, 13, 9, 1, WHT); R(c, 23, 13, 9, 7, '#d6eef7'); R(c, 23, 13, 9, 1, WHT);
    P(c, 2, 15, WHT); P(c, 26, 15, WHT);
    bevel(c, 9, 6, 14, 22, STEEL, '#eef0f3', '#9a9ea8');
    R(c, 10, 7, 12, 4, '#e2e4e8');
    R(c, 12, 8, 8, 2, INK); R(c, 13, 8, 2, 1, '#3cff7a');
    R(c, 10, 22, 12, 1, RED);
    outline(c);
  },
});
// low glass partition (east-west run)
tile('glass', {
  solid: true, obj: true,
  hd(c) {
    R(c, 1, 8, 30, 17, '#d6eef7'); R(c, 1, 8, 30, 1, WHT);
    line(c, 6, 22, 14, 11, WHT); line(c, 8, 22, 16, 11, '#eaf7fc');
    R(c, 0, 7, 32, 1, STEEL); R(c, 0, 24, 32, 4, STEEL); R(c, 0, 24, 32, 1, '#eef0f3'); R(c, 0, 27, 32, 1, '#9a9ea8');
    outline(c);
  },
});
// small screens: a variety set, a cooking corner, a landscape VTR
function screenPic(c, x, y, w, h, f) {
  if (f === 0) {
    for (let j = 0; j < h; j++) R(c, x, y + j, w, 1, j < h * 0.6 ? (j % 3 ? '#d4102c' : '#e8283f') : '#f6e7ea');
    for (let i = x + 1; i < x + w; i += 3) P(c, i, y + 1, BULB);
    for (const [px, col] of [[x + 5, '#5fd7ff'], [x + 10, GOLD], [x + 15, '#ffffff']]) {
      if (px + 2 >= x + w) continue;
      R(c, px, y + h - 7, 3, 4, col); oval(c, px, y + h - 10, 3, 3, '#f2c9a0');
    }
  } else if (f === 1) {
    R(c, x, y, w, h, '#ffe39a'); R(c, x, y + h - 4, w, 4, '#c08a55');
    oval(c, x + w / 2 - 5, y + h - 9, 10, 5, '#7d8391'); R(c, x + w / 2 - 5, y + h - 7, 10, 3, '#5a5f6b');
    for (const dx of [-3, 0, 3]) { P(c, x + w / 2 + dx, y + 2, WHT); P(c, x + w / 2 + dx + 1, y + 3, WHT); P(c, x + w / 2 + dx, y + 4, WHT); }
  } else {
    R(c, x, y, w, h, '#8fd0ff'); R(c, x, y, w, 3, '#b8e2ff');
    oval(c, x - 3, y + h - 6, w / 2 + 6, 9, '#4a9a4a'); oval(c, x + w / 2 - 2, y + h - 5, w / 2 + 6, 8, '#3f8a3a');
    oval(c, x + w - 7, y + 2, 4, 4, GOLD);
    R(c, x + 3, y + 4, 5, 1, WHT); R(c, x + 4, y + 3, 3, 1, WHT);
  }
}
tile('monitor', {
  solid: true, obj: true, frames: 3, speed: 50,
  hd(c, r, f) {
    R(c, 14, 2, 4, 3, '#3b3f48');
    R(c, 2, 5, 28, 19, INK); R(c, 2, 5, 28, 1, '#3b3f48');
    screenPic(c, 4, 7, 24, 15, f);
    R(c, 5, 8, 3, 2, RED);
    outline(c);
  },
});
// "開局からのあゆみ" timeline board
tile('panel', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 2, 4, 28, 20, WHT); R(c, 2, 4, 28, 3, RED); R(c, 2, 23, 28, 1, MG);
    const photos = v ? ['#9a9a9a', '#b89a6a', '#6a8ab0'] : ['#b89a6a', '#8e8e8e', '#d47a7a'];
    photos.forEach((col, i) => {
      const x = 4 + i * 9;
      R(c, x, 9, 7, 6, col); R(c, x + 1, 10, 3, 2, shade(col, 0.3)); R(c, x, 14, 7, 1, shade(col, -0.3));
      R(c, x, 17, 6, 1, '#9aa0aa'); R(c, x, 19, 4, 1, '#c3c6ce');
    });
    R(c, 4, 21, 24, 1, REDP); for (const x of [6, 15, 24]) P(c, x, 21, RED);
    outline(c);
  },
});
// glass showcase: a classic studio camera with a lens turret
tile('case', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 14, 2);
    bevel(c, 2, 19, 28, 10, WHT, WHT, MG); R(c, 2, 24, 28, 2, RED);
    R(c, 3, 2, 26, 17, '#dff1f8'); R(c, 3, 2, 26, 1, WHT); R(c, 3, 18, 26, 1, '#b8d4e0');
    // camera body
    R(c, 8, 7, 14, 9, '#3b3f48'); R(c, 8, 7, 14, 1, '#5a5f6b'); R(c, 9, 9, 6, 4, '#4a4e58');
    R(c, 21, 8, 3, 7, '#2a2d36');
    for (const [cx, cy] of [[26, 8], [26, 13]]) { disc(c, cx, cy, 2, '#2a2d36'); P(c, cx - 1, cy - 1, '#7d8391'); }
    R(c, 12, 4, 6, 3, '#2a2d36'); R(c, 13, 5, 2, 1, '#9aa0aa');
    R(c, 14, 16, 2, 3, '#5a5f6b');
    line(c, 5, 15, 9, 4, WHT); line(c, 6, 16, 10, 5, '#f0f9fc');
    outline(c);
  },
});
// trophies and a shield on a wooden shelf
tile('award', {
  solid: true, obj: true,
  hd(c, r) {
    shadowEllipse(c, 16, 30, 14, 2);
    R(c, 2, 2, 28, 28, '#8a5a33'); R(c, 4, 4, 24, 24, '#6e4428');
    grain(c, r, 4, 4, 24, 24, '#76492c', 6, 6);
    R(c, 4, 15, 24, 2, WOOD); R(c, 4, 15, 24, 1, '#d6a06a'); R(c, 4, 28, 24, 1, WOOD);
    // trophies (top shelf)
    for (const x of [7, 19]) {
      R(c, x, 6, 6, 4, GOLD); R(c, x, 6, 6, 1, '#fff2a0'); R(c, x + 5, 7, 1, 3, GOLDD);
      P(c, x - 1, 7, GOLD); P(c, x + 6, 7, GOLD); R(c, x + 2, 10, 2, 2, GOLDD); R(c, x + 1, 12, 4, 3, '#3b3f48');
    }
    // shield (bottom shelf)
    R(c, 7, 18, 9, 10, '#5a3a20'); R(c, 8, 19, 7, 8, '#9b6638'); R(c, 9, 20, 5, 3, GOLD); R(c, 9, 24, 5, 1, GOLDD);
    R(c, 19, 21, 6, 7, GOLD); R(c, 19, 21, 6, 1, '#fff2a0'); R(c, 21, 23, 2, 2, RED);
    outline(c);
  },
});
// miniature studio set under an acrylic cover
tile('diorama', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 14, 2);
    bevel(c, 2, 20, 28, 9, WHT, WHT, MG); R(c, 2, 26, 28, 1, RED);
    R(c, 4, 5, 24, 15, '#e8f5fa'); R(c, 4, 5, 24, 1, WHT);
    R(c, 6, 8, 20, 5, RED); for (let x = 7; x < 26; x += 3) P(c, x, 9, BULB);
    R(c, 6, 13, 20, 5, '#f7eef0');
    R(c, 13, 13, 6, 2, WHT); R(c, 13, 15, 6, 2, RED);
    for (const [x, col] of [[9, '#5fd7ff'], [22, GOLD]]) { R(c, x, 14, 2, 3, col); P(c, x, 13, '#f2c9a0'); P(c, x + 1, 13, '#f2c9a0'); }
    R(c, 15, 18, 2, 1, INK);
    line(c, 6, 18, 10, 6, WHT);
    outline(c);
  },
});
// floor indicator lamp above the elevators
tile('elevlamp', {
  solid: true, obj: true, frames: 2, speed: 60,
  hd(c, r, f) {
    R(c, 9, 16, 14, 11, INK); R(c, 10, 17, 12, 9, '#2a2d36');
    pix(c, ['..#..', '.###.', '#####'], { '#': f ? '#ff9a3c' : '#5a3a20' }, 11, 18);
    pix(c, ['#####', '.###.', '..#..'], { '#': f ? '#5a3a20' : '#ff9a3c' }, 11, 22);
    R(c, 18, 19, 3, 5, '#ff9a3c'); R(c, 19, 20, 1, 3, '#2a2d36');
    outline(c);
  },
});

// ------------------------------------------------------------------ doors
// dressing-room door with a red noren hanging in front
tile('gdoor', {
  hd(c) {
    R(c, 3, 0, 26, 32, '#5a3a20'); R(c, 5, 2, 22, 30, '#a8733f'); R(c, 5, 2, 22, 1, '#c08a55');
    R(c, 6, 18, 9, 11, '#9b6638'); R(c, 17, 18, 9, 11, '#9b6638');
    R(c, 23, 20, 2, 3, GOLD);
    R(c, 3, 1, 26, 2, '#3b2a18');
    R(c, 4, 3, 24, 15, RED); R(c, 4, 3, 24, 1, REDL); R(c, 4, 17, 24, 1, REDX);
    for (const x of [11, 20]) R(c, x, 8, 1, 10, REDX);
    R(c, 4, 13, 24, 2, WHT);
    disc(c, 16, 8, 2, WHT); P(c, 16, 8, RED);
  },
});
// heavy padded studio door (two leaves)
function sdoor(side) {
  const L = side === 'l';
  return (c) => {
    R(c, 0, 0, 32, 32, '#3b3a40');
    const x0 = L ? 3 : 0, w = 29;
    R(c, x0, 2, w, 30, '#76747c'); R(c, x0, 2, w, 1, '#9a98a0');
    for (let y = 6; y < 30; y += 6) for (let x = x0 + 3; x < x0 + w; x += 6) { P(c, x, y, '#5e5c64'); P(c, x + 1, y + 1, '#8a8890'); }
    R(c, L ? 14 : 4, 7, 12, 6, '#1d2650'); R(c, L ? 15 : 5, 8, 4, 1, '#4a6aa8');
    R(c, x0, 17, w, 2, RED);
    R(c, L ? 27 : 2, 20, 3, 8, STEEL); R(c, L ? 27 : 2, 20, 1, 8, WHT);
    R(c, L ? 31 : 0, 0, 1, 32, '#2a2930');
  };
}
tile('sdoor_l', { hd: sdoor('l') });
tile('sdoor_r', { hd: sdoor('r') });

// ------------------------------------------------------------------ studio
// set backdrop: red with light rays and a bulb line (upper), white & red bands (lower)
tile('set_u', {
  solid: true, variants: 2,
  hd(c, r, f, v) {
    for (let y = 0; y < 32; y++) R(c, 0, y, 32, 1, y < 10 ? '#9a0016' : y < 20 ? '#c00020' : RED);
    for (let x = v * 8; x < 32; x += 16) for (let y = 4; y < 32; y++) if ((x + y) % 2 === 0) P(c, x + ((y >> 2) % 3), y, '#f0384e');
    R(c, 0, 0, 32, 1, REDX);
    for (let x = 2; x < 32; x += 6) { R(c, x, 3, 2, 2, BULB); P(c, x, 3, WHT); }
    if (v === 1) { P(c, 22, 14, WHT); P(c, 21, 15, WHT); P(c, 23, 15, WHT); P(c, 22, 16, WHT); P(c, 22, 15, BULB); }
  },
});
tile('set', {
  solid: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 0, 0, 32, 32, WHT);
    for (let x = 0; x < 32; x += 16) { R(c, x + 15, 0, 1, 14, '#f0e4e6'); }
    // red chevrons
    for (let i = 0; i < 6; i++) { R(c, 4 + i + v * 16, 4 + i, 2, 1, RED); R(c, 15 - i + v * 16, 4 + i, 2, 1, RED); }
    R(c, 0, 14, 32, 1, LG);
    R(c, 0, 15, 32, 9, RED); R(c, 0, 15, 32, 1, REDL);
    for (let x = 2; x < 32; x += 6) { R(c, x, 18, 2, 2, BULB); P(c, x, 18, WHT); }
    R(c, 0, 24, 32, 8, '#3c1016'); R(c, 0, 24, 32, 1, REDX);
  },
});
// big LED vision: 4 x 2 tiles cut from one 128x64 picture, 3 animated scenes
const LED_CACHE = new Map();
function ledImage(f) {
  if (LED_CACHE.has(f)) return LED_CACHE.get(f);
  const [cv, c] = makeCanvas(128, 64);
  R(c, 0, 0, 128, 64, '#141418');
  const x0 = 4, y0 = 4, w = 120, h = 54;
  if (f === 0) {
    // sunburst + star
    R(c, x0, y0, w, h, RED);
    const cx = 64, cy = 31;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const a = Math.atan2(y - cy, x - cx);
      if (Math.floor((a + Math.PI) / (Math.PI / 10)) % 2 === 0) P(c, x, y, '#ff3a52');
    }
    const star = (sx, sy, s, col) => {
      for (let y = -s; y <= s; y++) for (let x = -s; x <= s; x++) {
        const ang = Math.atan2(y, x), d = Math.hypot(x, y);
        const rr = s * (0.55 + 0.45 * Math.cos(5 * (ang + Math.PI / 2)));
        if (d <= rr) P(c, sx + x, sy + y, col);
      }
    };
    star(cx, cy, 16, '#b8860b'); star(cx, cy - 1, 15, GOLD); star(cx - 2, cy - 3, 6, '#fff2a0');
    for (const [x, y] of [[18, 14], [104, 16], [26, 46], [100, 44], [44, 10], [86, 50]]) { P(c, x, y, WHT); P(c, x - 1, y, BULB); P(c, x + 1, y, BULB); P(c, x, y - 1, BULB); P(c, x, y + 1, BULB); }
  } else if (f === 1) {
    // confetti on pink with a big question mark
    R(c, x0, y0, w, h, '#ffb3c6');
    const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    const cols = [RED, GOLD, '#5fd7ff', '#5ee07a', WHT];
    for (let i = 0; i < 90; i++) R(c, x0 + Math.floor(rnd() * (w - 2)), y0 + Math.floor(rnd() * (h - 2)), 2, 2, cols[i % cols.length]);
    const Q = ['.#####.', '##...##', '.....##', '...###.', '...##..', '.......', '...##..'];
    pix(c, Q.map((row) => row.replace(/#/g, 'X')), { X: REDX }, 0, 0);
    for (let j = 0; j < Q.length; j++) for (let i = 0; i < Q[j].length; i++) if (Q[j][i] === '#') { R(c, 46 + i * 5, 12 + j * 5, 5, 5, WHT); R(c, 46 + i * 5, 16 + j * 5, 5, 1, MG); }
  } else {
    // sky, rainbow, clouds (a VTR)
    for (let y = y0; y < y0 + h; y++) R(c, x0, y, w, 1, y < 24 ? '#7ec8f7' : '#a6dcff');
    const bands = [RED, '#ff9a3c', GOLD, '#5ee07a', '#5fa8ff', '#9273bd'];
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const d = Math.hypot(x - 64, (y - 70) * 1.25);
      const k = Math.floor((d - 40) / 3);
      if (k >= 0 && k < bands.length) P(c, x, y, bands[bands.length - 1 - k]);
    }
    for (const [cx, cy] of [[22, 18], [100, 14], [80, 40]]) { oval(c, cx - 9, cy - 3, 18, 7, WHT); oval(c, cx - 4, cy - 6, 9, 7, WHT); R(c, cx - 8, cy + 3, 16, 1, '#dcefff'); }
    R(c, x0, y0 + h - 6, w, 6, '#4a9a4a'); R(c, x0, y0 + h - 6, w, 1, '#6cbc5c');
  }
  // bezel & stand line
  R(c, 0, 0, 128, 2, '#2a2a30'); R(c, 0, 62, 128, 2, '#0c0c10'); R(c, 0, 0, 2, 64, '#2a2a30'); R(c, 126, 0, 2, 64, '#0c0c10');
  for (let x = 6; x < 124; x += 4) P(c, x, 60, '#3a3a42');
  P(c, 120, 60, '#ff2b3a');
  LED_CACHE.set(f, cv);
  return cv;
}
for (let i = 0; i < 8; i++) {
  const col = i % 4, row = Math.floor(i / 4);
  tile('led' + i, {
    solid: true, frames: 3, speed: 90,
    hd(c, r, f) { c.drawImage(ledImage(f), -col * 32, -row * 32); },
  });
}
// ひな壇 (tiered guest benches): a = back (high), b = middle, c = front (low)
function hina(tier) {
  return (c) => {
    const top = [2, 6, 10][tier];
    const riser = [REDX, REDD, RED][tier];
    R(c, 0, top, 32, 32 - top, riser);
    R(c, 0, top, 32, 2, '#3c1016');
    // bench cushion (white) with a seam every 8px
    R(c, 0, top + 2, 32, 7, WHT); R(c, 0, top + 2, 32, 1, '#fafafa'); R(c, 0, top + 8, 32, 1, MG);
    for (let x = 7; x < 32; x += 8) R(c, x, top + 3, 1, 5, LG);
    R(c, 0, top + 9, 32, 1, shade(riser, -0.3));
    for (let x = 2; x < 32; x += 8) R(c, x, top + 12, 4, 1, shade(riser, 0.2));
    if (tier === 2) { R(c, 0, 29, 32, 3, 'rgba(0,0,0,0.25)'); }
  };
}
tile('hina_a', { solid: true, obj: true, hd: hina(0) });
tile('hina_b', { solid: true, obj: true, hd: hina(1) });
tile('hina_c', { solid: true, obj: true, hd: hina(2) });
// MC podium with a stand mic and the host's cue cards
tile('mcstand', {
  solid: true, obj: true, talkThrough: true,
  hd(c) {
    shadowEllipse(c, 16, 29, 11, 2);
    R(c, 5, 10, 22, 4, WHT); R(c, 5, 10, 22, 1, '#fafafa'); R(c, 5, 13, 22, 1, LG);
    R(c, 6, 14, 20, 14, RED); R(c, 6, 14, 20, 1, REDX); R(c, 6, 19, 20, 3, WHT); R(c, 6, 27, 20, 1, REDX);
    R(c, 9, 7, 7, 4, '#fdfdf6'); R(c, 10, 8, 4, 1, '#9aa0aa');
    R(c, 21, 3, 1, 8, '#7d8391'); oval(c, 19, 0, 5, 5, '#3b3f48'); P(c, 20, 1, '#7d8391');
    outline(c);
  },
});
// front edge of the set with an LED strip
tile('edge', {
  solid: true, obj: true, frames: 2, speed: 30,
  hd(c, r, f) {
    R(c, 0, 0, 32, 6, '#f7eef0'); R(c, 0, 5, 32, 1, '#ead7db');
    R(c, 0, 6, 32, 2, WHT); R(c, 0, 8, 32, 16, '#3a3840'); R(c, 0, 8, 32, 1, '#24222a');
    for (let x = 0; x < 32; x += 4) R(c, x + (f ? 2 : 0), 13, 2, 2, (x / 4 + f) % 2 ? REDL : RED);
    R(c, 0, 12, 32, 1, '#2a2830'); R(c, 0, 15, 32, 1, '#2a2830');
    R(c, 0, 23, 32, 1, '#24222a'); R(c, 0, 24, 32, 2, 'rgba(0,0,0,0.3)');
  },
});
// small steps up onto the set
tile('steps', {
  hd(c) {
    R(c, 0, 0, 32, 6, '#f7eef0');
    for (let i = 0; i < 3; i++) {
      const y = 6 + i * 6;
      R(c, 0, y, 32, 6, shade('#e8dde0', -i * 0.06)); R(c, 0, y, 32, 1, WHT); R(c, 0, y + 5, 32, 1, '#b8a8ad');
      R(c, 0, y + 1, 32, 1, i === 0 ? RED : '#e8dde0');
    }
    R(c, 0, 24, 32, 8, '#2e3038');
  },
});

// ------------------------------------------------------------------ meeting room
tile('kikaku', {
  solid: true, obj: true,
  hd(c, r) {
    bevel(c, 2, 3, 28, 21, WOOD, '#d6a06a', '#8a5a33');
    R(c, 4, 5, 24, 17, '#c8995e'); speckle(c, r, ['#b88a50', '#d4a86c'], 40, 4, 5, 24, 17);
    const notes = [[6, 7, GOLD], [13, 6, '#ff9ab8'], [20, 8, '#8fd0ff'], [7, 14, '#b8eea0'], [15, 13, GOLD], [21, 15, '#ff9ab8']];
    for (const [x, y, col] of notes) { R(c, x, y, 5, 5, col); R(c, x, y + 4, 5, 1, shade(col, -0.2)); R(c, x + 1, y + 2, 3, 1, shade(col, -0.35)); P(c, x + 2, y, RED); }
    line(c, 8, 9, 15, 15, RED);
    outline(c);
  },
});
// city & bay view through a big window
tile('window', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    R(c, 2, 3, 28, 22, '#e8e8ea'); R(c, 2, 3, 28, 1, WHT); R(c, 29, 4, 1, 21, '#b8b8bc');
    for (let y = 5; y < 23; y++) R(c, 4, y, 24, 1, y < 12 ? '#9cd4fa' : '#bfe4fb');
    const bld = v ? [[4, 9], [8, 6], [11, 10], [15, 4], [19, 8], [23, 11]] : [[4, 7], [7, 11], [12, 5], [17, 9], [21, 6], [25, 10]];
    for (const [x, h] of bld) { const w = 4; R(c, x, 19 - h, Math.min(w, 28 - x), h, '#8a9ab4'); for (let yy = 21 - h; yy < 18; yy += 2) P(c, x + 1, yy, '#e8f2ff'); }
    R(c, 4, 19, 24, 4, '#4a8ac8'); R(c, 4, 19, 24, 1, '#7ab0e0'); P(c, 9, 21, WHT); P(c, 20, 20, WHT);
    R(c, 15, 5, 2, 18, '#e8e8ea');
    R(c, 1, 25, 30, 2, '#c8c8cc'); R(c, 1, 25, 30, 1, WHT);
    outline(c);
  },
});

// ------------------------------------------------------------------ cafeteria
// 食券機 (meal-ticket machine)
tile('kenbaiki', {
  solid: true, obj: true,
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    bevel(c, 5, 1, 22, 28, '#f2efe8', WHT, '#bcb7ad');
    R(c, 6, 2, 20, 5, RED); for (let x = 8; x < 25; x += 3) P(c, x, 4, WHT);
    const cols = [GOLD, '#ff9a3c', '#8fd0ff', '#b8eea0', '#ff9ab8', WHT];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const col = cols[(i + j * 2) % cols.length]; R(c, 8 + i * 4, 9 + j * 4, 3, 3, col); P(c, 8 + i * 4, 11 + j * 4, shade(col, -0.3)); }
    R(c, 9, 22, 6, 2, INK); R(c, 18, 21, 4, 3, '#3b3f48'); P(c, 19, 22, '#3cff7a');
    R(c, 9, 26, 14, 2, '#3b3f48');
    outline(c);
  },
});
// food-sample showcase (two tiles)
function sample(side) {
  return (c) => {
    R(c, 0, 20, 32, 10, '#8a5a33'); R(c, 0, 20, 32, 1, '#d6a06a'); R(c, 0, 29, 32, 1, '#5a3a20');
    R(c, 0, 2, 32, 18, '#e8f5fa'); R(c, 0, 2, 32, 1, WHT); R(c, 0, 11, 32, 1, '#b8d4e0'); R(c, 0, 19, 32, 1, '#b8d4e0');
    if (side === 'l') {
      // curry rice
      oval(c, 2, 5, 12, 6, WHT); oval(c, 3, 6, 6, 4, '#fbf6e8'); oval(c, 7, 6, 6, 4, '#b06a1c'); P(c, 9, 7, '#ff9a3c'); P(c, 11, 8, '#5ee07a');
      // set meal on a tray
      R(c, 17, 4, 13, 7, '#8a5a33'); oval(c, 18, 5, 5, 4, WHT); oval(c, 24, 5, 5, 4, '#7a3a20'); R(c, 20, 9, 7, 1, '#ff9a3c');
      // fried chicken
      oval(c, 3, 13, 11, 5, WHT); oval(c, 4, 13, 4, 3, '#c07a2a'); oval(c, 8, 14, 4, 3, '#d08a34'); P(c, 12, 14, '#5ee07a');
      oval(c, 18, 13, 11, 5, WHT); oval(c, 20, 13, 7, 3, '#e8c43a'); R(c, 21, 14, 4, 1, RED);
    } else {
      // udon
      oval(c, 2, 4, 12, 7, '#5a3a20'); oval(c, 3, 5, 10, 4, '#e8c48a'); for (let x = 4; x < 12; x += 2) R(c, x, 6, 1, 2, WHT); P(c, 10, 5, '#5ee07a');
      // ramen
      oval(c, 18, 4, 12, 7, RED); oval(c, 19, 5, 10, 4, '#d8a050'); R(c, 21, 6, 3, 2, '#f6e7d0'); P(c, 26, 6, '#5ee07a');
      // onigiri set & salad
      R(c, 4, 13, 9, 5, WHT); R(c, 5, 14, 3, 3, '#20232a'); R(c, 9, 14, 3, 3, '#20232a'); P(c, 6, 13, WHT); P(c, 10, 13, WHT);
      oval(c, 18, 13, 11, 5, WHT); oval(c, 19, 13, 9, 4, '#5ec26a'); P(c, 22, 14, RED); P(c, 25, 15, RED);
    }
    for (const x of [4, 20]) { R(c, x, 11, 7, 2, WHT); R(c, x + 1, 11, 4, 1, RED); }
    if (side === 'l') R(c, 0, 2, 1, 28, '#5a3a20'); else R(c, 31, 2, 1, 28, '#5a3a20');
    outline(c);
  };
}
tile('sample_l', { solid: true, obj: true, hd: sample('l') });
tile('sample_r', { solid: true, obj: true, hd: sample('r') });
// menu board on the kitchen wall
tile('menu', {
  solid: true, obj: true, variants: 2,
  hd(c, r, f, v) {
    bevel(c, 2, 4, 28, 20, '#5a3a20', '#8a5a33', '#3b2a18');
    R(c, 4, 6, 24, 16, '#2a3a30');
    R(c, 4, 6, 24, 3, RED); for (let x = 6; x < 27; x += 4) P(c, x, 7, WHT);
    for (let i = 0; i < 4; i++) { R(c, 6, 11 + i * 3, 10 - (i + v) % 3 * 2, 1, '#f2efe8'); R(c, 21, 11 + i * 3, 5, 1, GOLD); }
    outline(c);
  },
});

// ------------------------------------------------------------------ items
registerItem('ntv_pass', { name: '日本テレビの入館証', price: 0, desc: '赤いストラップの入館証。\n首にかけると、ちょっと業界人の気分。' });
registerItem('ntv_kikakusho', { name: '手書きの企画書', price: 0, desc: '会議室でプロデューサーがほめてくれた企画書。\n「いつか本当に番組にしよう」の付せんつき。' });

// ------------------------------------------------------------------ people
const WHO = {
  uketsuke: { name: '受付の赤坂さん', look: { ...LOOKS.receptionist, top: RED, bottom: '#3b3f48' } },
  annai: { name: '案内係の白石さん', look: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: WHT, bottom: RED, jacket: true } },
  guard: { name: '警備員さん', look: LOOKS.guard },
  kanranAD: { name: '観覧係のAD', look: { ...LOOKS.ad, top: RED, bottom: '#3b3f48' } },
  mom: { name: '見学のお母さん', look: LOOKS.mom },
  kid: { name: '見学の男の子', look: { ...LOOKS.kid, top: RED } },
  waiting: { name: '待ち合わせの人', look: LOOKS.salaryman },
  manager: { name: 'マネージャーの真田さん', look: { ...LOOKS.manager, tie: RED } },
  ad: { name: 'ADの小嶋くん', look: { ...LOOKS.ad, hairColor: 'black', top: RED, bottom: '#3a4a7a' } },
  ad2: { name: '走るAD', look: { ...LOOKS.ad, top: '#ff8a3d' } },
  fd: { name: 'フロアディレクター', look: { hair: 'cap', hat: RED, hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' } },
  director: { name: 'ディレクターの剛田さん', look: { ...LOOKS.director, hat: '#2a2d36', top: RED } },
  producer: { name: 'プロデューサーの真壁さん', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: WHT, bottom: '#2e3140', jacket: true, glasses: true, tie: RED } },
  writer: { name: '構成作家の筆坂さん', look: { hair: 'afro', hairColor: 'brown', skin: 'fair', top: '#ffd23f', bottom: '#3b3f48', glasses: true } },
  mc: { name: '司会の芸人さん', look: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: RED, bottom: '#2a2d36', jacket: true, tie: GOLD } },
  guestA: { name: 'ゲストの芸人', look: LOOKS.comedian },
  guestB: { name: 'ゲストのアイドル', look: LOOKS.idol },
  guestC: { name: 'ゲストの俳優', look: LOOKS.actor },
  guestD: { name: 'ゲストのベテラン芸人', look: LOOKS.comedian2 },
  camera: { name: 'カメラマン', look: LOOKS.cameraman },
  light: { name: '照明さん', look: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#5a6f8a', bottom: '#3b3f48', glasses: true } },
  bijutsu: { name: '美術さん', look: { ...LOOKS.staff, top: '#2f9a4a', hat: GOLD } },
  make: { name: 'メイクの花村さん', look: LOOKS.makeup },
  wakate: { name: '若手芸人', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#5fd7ff', bottom: '#3a4a7a' } },
  obachan: { name: '食堂のおばちゃん', look: { ...LOOKS.chef, hair: 'bob', hat: WHT, hairColor: 'brown', skin: 'fair', apron: RED } },
  eater: { name: '昼休みのスタッフ', look: LOOKS.cameraman },
  eater2: { name: 'お昼の編集マン', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#3a4a7a', bottom: '#2a2d36', glasses: true } },
  aud: { name: 'お客さん', look: LOOKS.fan },
};
const say = (who) => ({ name: who.name, look: who.look });
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
// turn a seated / working NPC back to its post after talking
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
const lines = (who, list) => (g) => g.say(list, say(who));
const today = (g, k) => g.flag(k) === g.state.day;

// Name plates on the upper wall.
function plate(x, y, label, w = 2) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const tw = Math.ceil(measure(ctx, label, 8)) + 8;
      const px = Math.round(sx + (w * 16 - tw) / 2), py = Math.round(sy + 4);
      box(ctx, px, py, tw, 11, REDX);
      box(ctx, px + 0.5, py + 0.5, tw - 1, 10, RED);
      text(ctx, label, px + tw / 2, py + 1.5, { size: 8, align: 'center', color: WHT, shadow: null });
    },
  };
}
// ON AIR lamp that lights while a show is recorded (prop on the wall)
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
let show = null; // null | 'kanran' | 'maesetsu' | 'hina'
let onAir = false;

function here(g) {
  const p = g.map.player;
  return { room: g.map.roomId, x: p.x, y: p.y, dir: p.dir };
}
async function toStudio(g, mode, x, y, dir) {
  const origin = here(g);
  show = mode;
  onAir = false;
  await g.fadeOut();
  await g.goto(PID, 'studio', x, y, dir, { fade: false });
  await g.fadeIn();
  return origin;
}
async function backFrom(g, origin) {
  await g.fadeOut();
  show = null;
  onAir = false;
  await g.goto(PID, origin.room, origin.x, origin.y, origin.dir, { fade: false });
  await g.fadeIn();
}
const AUD = [
  ['ntv_aud1', 3, 10, LOOKS.fan], ['ntv_aud2', 4, 10, LOOKS.mom], ['ntv_aud3', 6, 10, LOOKS.salaryman], ['ntv_aud4', 7, 10, LOOKS.tourist],
  ['ntv_aud5', 8, 10, LOOKS.oldwoman], ['ntv_aud6', 13, 10, LOOKS.clerk], ['ntv_aud7', 15, 10, { ...LOOKS.fan, hairColor: 'brown', top: GOLD }],
  ['ntv_aud8', 17, 10, LOOKS.oldman], ['ntv_aud9', 4, 11, LOOKS.kid], ['ntv_aud10', 7, 11, LOOKS.mom], ['ntv_aud11', 14, 11, LOOKS.salaryman],
  ['ntv_aud12', 16, 11, { ...LOOKS.fan, top: REDL }], ['ntv_aud13', 5, 10, LOOKS.chef],
];
// the player takes seat (5,10) when watching, so that audience member stays home then
const audVisible = (id) => () => !!show && !(show === 'kanran' && id === 'ntv_aud13');
async function crowd(g, kind, frames = 45) {
  await Promise.all(AUD.filter(([id]) => audVisible(id)()).map(([id], i) => g.emote(id, Array.isArray(kind) ? kind[i % kind.length] : kind, frames)));
}
async function countdown(g) {
  await g.say('本番いきまーす！\n5秒前、4、3…', say(WHO.fd));
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
const MAESETSU_LINES = [
  { boke: 'みなさん、今日はどちらから来ましたか？', punch: false },
  { boke: 'ぼくは今朝、月から来ました！', punch: true, tsukkomi: '遠すぎるでしょ！' },
  { boke: '本番中は、大きな拍手をお願いします！', punch: false },
  { boke: 'では練習！…（ひとりで全力拍手）', punch: true, tsukkomi: 'お客さんにやってもらって！' },
  { boke: '笑い声も、番組の大事な主役です。', punch: false },
  { boke: 'ワッハッハ！…ぼくが一番ウケてますね！', punch: true, tsukkomi: '自分で笑ってどうするの！' },
  { boke: 'スマホの電源は、オフでお願いします。', punch: false },
  { boke: 'ついでに、ぼくのやる気もオフにします！', punch: true, tsukkomi: 'それはオンにして！' },
];
const HINA_SCENES = [
  { prompt: '司会「さあ、ひな壇のみなさん！今日も元気ですか〜！」', answers: [{ text: '元気すぎて朝4時起きです！', score: 100 }, { text: 'はい、元気です', score: 50 }, { text: '…ねむいです', score: 10 }] },
  { prompt: 'VTR明け。スタジオは大爆笑！ワイプの顔が映ってる！', answers: [{ text: '（手をたたいて大笑い）', score: 100 }, { text: '（静かにうなずく）', score: 40 }, { text: '（あくびがバレる）', score: 0 }] },
  { prompt: '芸人「{name}ちゃん、今日の服、気合い入ってるね〜」', answers: [{ text: 'デビュー以来の勝負服です！', score: 100 }, { text: 'ふつうの服ですよ', score: 30 }, { text: 'ほっといてください', score: 10 }] },
  { prompt: '司会「このスイーツ、ひと口どうぞ！」', answers: [{ text: 'うまっ！ほっぺが落ちました！', score: 100 }, { text: 'おいしいです', score: 50 }, { text: '甘いのは苦手で…', score: 10 }] },
  { prompt: '上の段の芸人が、ひな壇からずり落ちた！', answers: [{ text: '落ちるの早すぎ！', score: 100 }, { text: 'だいじょうぶですか…？', score: 60 }, { text: '（見なかったことに）', score: 0 }] },
  { prompt: '司会「最後に{name}さん、何か告知ある？」', answers: [{ text: '来週も、ここに座ってます！', score: 100 }, { text: 'とくにないです', score: 20 }, { text: '家の鍵、なくしました', score: 60 }] },
];
const JOBS = {
  maesetsu: {
    id: 'ntv_maesetsu', title: '前説（スタジオの盛り上げ係）', desc: '本番前に、ADとのかけあいで観覧席をあたためよう！', client: WHO.fd.name, clientLook: WHO.fd.look,
    stamina: 15, minigame: 'tsukkomi', opts: { difficulty: 1, lines: MAESETSU_LINES, rounds: 8, partner: WHO.ad.name, partnerLook: WHO.ad.look, dialect: 'std' },
    pay: 1200, fame: 6, skill: 'warai', gain: 2,
  },
  hina: {
    id: 'ntv_hinadan', title: 'バラエティ番組のひな壇ゲスト', desc: 'ひな壇から、リアクションとひと言で番組を盛り上げよう！', client: WHO.director.name, clientLook: WHO.director.look,
    stamina: 20, minigame: 'talk', opts: { difficulty: 2, topic: 'バラエティ番組のひな壇', set: 'variety', scenes: HINA_SCENES, show: 'ドット・バラエティ' },
    pay: 4500, fame: 18, skill: 'talk', gain: 2,
    requires: { anyOf: [{ agency: true }, { fame: 30 }], anyOfText: 'ひな壇ゲストは、事務所に所属しているか\n★30以上の人にお願いしているみたいだ。' },
  },
};
function confirmText(def) {
  return `${def.desc}\n「${def.title}」\n${payText(def.pay)}／体力 -${def.stamina}・ストレス +${ACTIVITY.job.stress}`;
}
// checks before staging (so we never walk on set just to be refused)
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
  const origin = await toStudio(g, 'maesetsu', 10, 7, 'down');
  try {
    g.placeNpc('ntv_show_ad', 11, 7, 'left');
    await g.say(['観覧のみなさん、こんにちはー！', '本番の前に、ちょっとだけおつきあいください！\n前説の{name}さんと、ADの小嶋です！'], say(WHO.fd));
    g.sfx('applause');
    await crowd(g, '♪', 30);
    await g.say('{name}さん、ぼくがボケるんで、\nいい感じにツッコんでください…！', say(WHO.ad));
    const res = await g.job({ ...def, confirm: false });
    if (res) {
      await crowdReact(g, res);
      const good = res.rank === 'S' || res.rank === 'A';
      await g.say(good ? '客席、あったまりましたね〜！\n今日の収録、いいのが撮れそうです！' : res.rank === 'B' ? 'ありがとうございました！\nいい空気になりましたよ！' : 'えー、緊張がほぐれた…かな？\n本番、がんばりましょう！', say(WHO.fd));
      if (!g.flag('ntv_maesetsu_first')) {
        g.setFlag('ntv_maesetsu_first');
        await g.say(['前説って、お客さんとの「最初の会話」なんですよ。', 'ここで笑ってもらえると、本番の笑い声も\nぜんぜん違うんです。また頼みます！'], say(WHO.fd));
      }
    }
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

async function hinaJob(g) {
  const def = JOBS.hina;
  if (!(await ready(g, def, WHO.director))) return;
  const origin = await toStudio(g, 'hina', 16, 4, 'down');
  try {
    await g.say(['ゲストのみなさん、スタンバイお願いしまーす！', '{name}さんは、ひな壇のまんなかへどうぞ！'], say(WHO.fd));
    await countdown(g);
    g.sfx('fanfare');
    await g.say(['さあ始まりました！\n今夜もスタジオは笑顔でいっぱいです！', 'ひな壇には、今週も豪華なゲストが\nそろってくれました〜！'], say(WHO.mc));
    g.sfx('applause');
    await Promise.all([crowd(g, '♪', 35), g.emote('ntv_show_g1', '!'), g.emote('ntv_show_g2', '♥')]);
    const res = await g.job({ ...def, confirm: false });
    if (res) {
      await crowdReact(g, res);
      const good = res.rank === 'S' || res.rank === 'A';
      await g.say(good ? '{name}さん、今日いちばん輝いてましたね！\nまたすぐ呼んじゃいます！' : res.rank === 'B' ? 'ナイスリアクション！\nまた遊びに来てくださいね〜！' : 'ドンマイ！ひな壇は「前のめり」が大事！\n次はもっとグイグイ来て！', say(WHO.mc));
      onAir = false;
      await g.say('はい、OKでーす！\nゲストのみなさん、おつかれさまでした！', say(WHO.fd));
    }
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

async function kanranShow(g) {
  const origin = await toStudio(g, 'kanran', 5, 10, 'up');
  try {
    g.setFlag('ntv_kanran_day', g.state.day);
    await g.say(['観覧のみなさん、本日はありがとうございます！', '本番の前に、拍手の練習をしまーす！\nせーの！'], say(WHO.fd));
    g.sfx('applause');
    await crowd(g, '♪', 35);
    await countdown(g);
    g.sfx('fanfare');
    await g.say('さあ始まりました！\n今夜もスタジオは笑顔でいっぱいです！', say(WHO.mc));
    g.sfx('applause');
    await Promise.all([crowd(g, ['♪', '!'], 35), g.emote('ntv_show_g1', '♪')]);
    await g.say('いや〜、さっきの楽屋でね、\nお弁当のフタにご飯つぶが全部ついてて…', say(WHO.guestA));
    await g.say('それ毎回言うてるやん！', say(WHO.guestD));
    g.sfx('laugh');
    await crowd(g, 'w', 40);
    await g.say('ここでVTRです！どうぞ！', say(WHO.mc));
    g.sfx('chime');
    await g.say('大型ビジョンに、ゲストの体当たりロケが映った。\nスタジオ中から笑い声が上がる！');
    g.sfx('laugh');
    g.shake(6, 1);
    await Promise.all([crowd(g, ['w', '!'], 40), g.emote('ntv_show_g3', '!'), g.emote('ntv_show_g2', 'w')]);
    await g.say('それではまた来週〜！', say(WHO.mc));
    g.sfx('applause');
    await crowd(g, ['♪', '♥'], 40);
    onAir = false;
    await g.say('はい、OKでーす！\n観覧のみなさん、ありがとうございました！', say(WHO.fd));
    g.addSkill('warai', 1, true);
    g.relax({ stress: 8 });
    g.sfx('good');
    await g.say('プロの「間」を、すぐ近くで見られた！\n思いきり笑って、気分もすっきり。\n（お笑い +1・ストレス -8・1日1回）');
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

// ------------------------------------------------------------------ lobby talk
async function uketsukeTalk(g, npc) {
  if (!g.flag('ntv_recep_met')) {
    g.setFlag('ntv_recep_met');
    await g.say(['ようこそ、日本テレビへ！', '番組への出演のご相談は、\nこちらの受付で承っております。'], say(WHO.uketsuke));
  }
  await programDesk(g, PID, npc);
  if (npc) npc.dir = 'down';
}
async function annaiTalk(g, npc) {
  const i = await g.ask('ご案内いたします。\nどちらをお探しですか？', ['スタジオ', '楽屋・食堂', '局のお仕事', 'だいじょうぶ'], say(WHO.annai));
  if (i === 0) {
    await g.say(['スタジオは、右のゲートを通って\nエレベーターで上の階へどうぞ。', 'バラエティのスタジオでは、毎日のように\n収録がありますよ。観覧も受付中です！'], say(WHO.annai));
  } else if (i === 1) {
    await g.say(['上の階に、出演者さんの楽屋と社員食堂があります。', '楽屋でひと休みすると、体もこころも軽くなりますよ。\n食堂は、安くておなかいっぱいになれます！'], say(WHO.annai));
  } else if (i === 2) {
    const st = g.state;
    if (!st.agency && st.fame < 30) {
      await g.say(['スタジオのフロアディレクターが、\n「前説」をやってくれる人を探していました。', 'だれでもOKですよ。\nまずは観覧で、スタジオの空気をつかむのも◎です！'], say(WHO.annai));
    } else {
      await g.say(['いまの{name}さんなら、スタジオのディレクターに\n「ひな壇ゲスト」をお願いできそうです！', '番組の出演依頼は、となりの受付へどうぞ。'], say(WHO.annai));
    }
  } else {
    await g.say('いってらっしゃいませ！', say(WHO.annai));
  }
  if (npc) npc.dir = 'down';
}
async function guardTalk(g) {
  if (!g.flag('ntv_pass')) {
    await g.say(['こんにちは！ゲストの方は、\nゲートの前で入館証をお渡ししますね。', 'どうぞ、右の通路から。'], say(WHO.guard));
    return;
  }
  await g.say(['入館証、首から下げてますね。ばっちりです！', '上の階の楽屋は、ひと休みにちょうどいいですよ。\n顔色が悪いタレントさんは、まず休ませるのが鉄則です。'], say(WHO.guard));
}
async function gatePass(g) {
  if (g.flag('ntv_pass')) return;
  g.setFlag('ntv_pass');
  g.sfx('chime');
  await g.emote('ntv_guard', '!');
  await g.say(['あっ、ちょっとお待ちを！', 'ゲートを通るには入館証が必要なんです。\nはい、どうぞ。'], say(WHO.guard));
  g.giveItem('ntv_pass', 1, true);
  g.sfx('ok');
  await g.say('「日本テレビの入館証」をもらった！\nピッ…ゲートが開いた。');
}
async function kanranADTalk(g, npc) {
  if (today(g, 'ntv_kanran_day')) {
    await g.say('今日の観覧は、もう終わっちゃいました！\nまた明日、お待ちしてます！', say(WHO.kanranAD));
    return;
  }
  const i = await g.ask(['バラエティ番組の観覧、受付中でーす！', '参加無料・1日1回。\nプロの笑いを、すぐ近くで見ていきませんか？'], ['観覧する', 'やめておく'], say(WHO.kanranAD));
  if (i !== 0) { await g.say('またいつでもどうぞ！\n笑うと、ストレスも吹き飛びますよ〜！', say(WHO.kanranAD)); if (npc) npc.dir = 'left'; return; }
  await g.say('ではスタジオへご案内しまーす！\n足元に気をつけて、ついてきてください！', say(WHO.kanranAD));
  await kanranShow(g);
}

// ------------------------------------------------------------------ studio talk
async function fdTalk(g, npc) {
  const i = await g.ask(['おつかれさまです！フロアディレクターです。', '本番前の前説、やってくれる人を探してたんです。\nだれでもOK！やってみます？'], ['前説をやる', 'スタジオのこと', 'またあとで'], say(WHO.fd));
  if (i === 0) await maesetsuJob(g);
  else if (i === 1) {
    await g.say(['奥がセット、右がひな壇、手前がカメラ。\nうしろの席が観覧のお客さんです。', 'カメラの上の赤いランプが光ってたら、\nそのカメラの映像がオンエア中ってこと！', 'ちなみに観覧の受付は、1階ロビーのADですよ。'], say(WHO.fd));
  } else await g.say('いつでも声かけてくださいね！', say(WHO.fd));
  if (npc) npc.dir = 'left';
}
async function directorTalk(g, npc) {
  const st = g.state;
  if (!st.agency && st.fame < 30) {
    await g.say(['ディレクターの剛田だ。', 'ひな壇のゲストは、事務所に入ってるか★30以上の\n人に頼んでる。まずは前説で場数を踏みな！', 'オーディションは、街の事務所で受けられるぞ。'], say(WHO.director));
    if (npc) npc.dir = 'down';
    return;
  }
  const i = await g.ask(['おっ、いい顔してるな。', 'ちょうどひな壇の席がひとつ空いてるんだ。\n座っていくか？'], ['ひな壇に出る', 'コツを聞く', 'またこんど'], say(WHO.director));
  if (i === 0) await hinaJob(g);
  else if (i === 1) {
    await g.say(['ひな壇のコツ？「前のめり」だよ。', 'VTRは本気で見て、本気で笑う。\nふられたら、短く・明るく・ちょっと意外に！', 'あと、寝不足と空腹は顔に出る。\n本番の前は、ちゃんと食って寝とけよ！'], say(WHO.director));
  } else await g.say('おう、いつでも来い！', say(WHO.director));
  if (npc) npc.dir = 'down';
}

// ------------------------------------------------------------------ dressing room
async function restSofa(g) {
  if (today(g, 'ntv_rest_day')) {
    await g.say('ソファでごろり…。\n今日はもう十分休んだ。そろそろ動こう！');
    return;
  }
  const i = await g.ask('楽屋のソファで、ひと休みする？\n（1日1回：体力 +15・ストレス -10）', ['休む', 'やめておく']);
  if (i !== 0) return;
  g.setFlag('ntv_rest_day', g.state.day);
  await g.fadeOut();
  g.sfx('sleep');
  await g.wait(500);
  g.heal(15);
  g.relax({ stress: 10 });
  await g.fadeIn();
  await g.say('目を閉じて、深呼吸…。\n体が少し軽くなった！\n（体力 +15・ストレス -10）');
}
async function mirror(g) {
  if (today(g, 'ntv_mirror_day')) {
    await g.say('鏡の中の自分と目が合った。\n…よし、今日もいい顔！');
    return;
  }
  g.setFlag('ntv_mirror_day', g.state.day);
  g.sfx('good');
  g.bathe(15, true);
  await g.say('電球つきの鏡の前で、髪と服をととのえた。\n（身だしなみ +15・1日1回）\nメイクさんにお願いすると、もっとピカピカに！');
}
async function makeTalk(g, npc) {
  const st = g.state;
  if (today(g, 'ntv_make_day')) {
    await g.say(['ばっちり決まってますよ！', '身だしなみが乱れたままだと、カメラ映りも\n人の印象もイマイチ。お風呂と美容院も大事にね！'], say(WHO.make));
    if (npc) npc.dir = 'left';
    return;
  }
  const i = await g.ask(['メイクの花村です。', '出番の前なら、パパッとととのえますよ。\nやっていきます？'], ['お願いします', 'だいじょうぶ'], say(WHO.make));
  if (i === 0) {
    g.setFlag('ntv_make_day', st.day);
    await g.fadeOut();
    g.sfx('shutter');
    await g.wait(350);
    g.bathe(35, true);
    await g.fadeIn();
    g.sfx('good');
    await g.say(['はい、できあがり！\nライトの下でもツヤツヤですよ。', '（身だしなみ +35・1日1回）'], say(WHO.make));
  } else {
    await g.say('身だしなみゲージが30を切ると、お仕事の評判が\nちょっと下がっちゃうから気をつけて！', say(WHO.make));
  }
  if (npc) npc.dir = 'left';
}
async function sashiire(g) {
  if (today(g, 'ntv_snack_day')) { await g.say('差し入れのかごは、もう空っぽだ。\nまた明日のお楽しみ。'); return; }
  if (!g.canEat()) { await g.say('差し入れのおまんじゅうがある。\n…でも、おなかいっぱいで入らない。'); return; }
  g.setFlag('ntv_snack_day', g.state.day);
  g.sfx('good');
  g.eat(10, { fill: 12 });
  await g.say('ちゃぶ台の上に、差し入れのおまんじゅう。\nひとつ、いただきます！\n（体力 +10・満腹 +12・1日1回）');
}

// ------------------------------------------------------------------ meeting room
async function kikakuMeeting(g) {
  await g.emote('ntv_producer', '!');
  await g.say(['おっ、ちょうどいいところに！\nいま新番組の企画会議をしてるんだ。', '若い人の意見が聞きたくてね。\n「こんな番組があったら見たい！」ってある？'], say(WHO.producer));
  const i = await g.ask('どんな企画を出そう？', ['街の銭湯めぐり', '芸人と料理対決', 'ペットの一日密着', 'とくにないです'], say(WHO.producer));
  if (i === 3) {
    await g.say(['ははは、正直でいいね！', 'でも「ない」と言わずに、なんでもいいから\n出してみるのが、この会議室のルールなんだ。'], say(WHO.producer));
    await g.say('（また今度、いいアイデアを持ってこよう…）');
    return;
  }
  const idea = ['街の銭湯めぐり', '芸人と料理対決', 'ペットの一日密着'][i];
  const reply = [
    ['銭湯か！湯船で本音トーク…いいね、ほっこりする。', 'お風呂上がりの牛乳まで撮りたいなあ。'],
    ['料理対決！包丁さばきでボケられたら最高だな。', '試食のリアクションも見どころになる。'],
    ['ペットの密着！視聴率の神様は、だいたい動物なんだよ。', 'ナレーションを{name}さんにお願いしようかな。'],
  ][i];
  await g.say(reply, say(WHO.producer));
  await g.say(`「${idea}」…メモメモ。\n作家としても、そのアイデアはアリです！`, say(WHO.writer));
  g.sfx('fanfare');
  g.addSkill('talk', 1, true);
  g.addFame(3, true);
  g.giveItem('ntv_kikakusho', 1, true);
  await g.say(['企画会議で、アイデアをほめられた！', '「手書きの企画書」をもらった。\n（トーク +1・知名度 +3）']);
  await g.say('いつか本当に番組にしよう。\nそのときは、{name}さんにも出てもらうからね！', say(WHO.producer));
}

// ------------------------------------------------------------------ cafeteria
const MENU = [
  { label: 'かけうどん', price: 250, heal: 15, fill: 30, text: 'ずずっ…。\nだしのきいた、やさしい味。' },
  { label: 'カレーライス', price: 400, heal: 28, fill: 50, text: '食堂のカレーは、なぜかいつもおいしい。\nスプーンが止まらない！' },
  { label: '日替わり定食', price: 500, heal: 34, fill: 58, stress: 3, text: '今日はしょうが焼き定食！\nごはん、おかわり自由です。' },
  { label: '特製オムライス', price: 550, heal: 36, fill: 60, stress: 5, text: 'ふわとろの卵に、ケチャップで赤いハート。\n食堂のおばちゃんの自信作！' },
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
  if (i < 0 || i >= MENU.length) { await g.say('はいよ、またおいで！\nおなかがすいたら、いつでもね。', say(who)); return; }
  const m = MENU[i];
  if (!g.canEat()) { await g.say('あらま、もうおなかいっぱいじゃないの！\nまた空いたらおいで。', say(who)); return; }
  if (!g.spend(m.price)) { await g.say('あら、お金が足りないみたいよ。', say(who)); return; }
  g.sfx('coin');
  await g.say(`はい、${m.label}おまち！`, say(who));
  g.sfx('good');
  g.eat(m.heal, { fill: m.fill });
  if (m.stress) g.relax({ stress: m.stress });
  await g.say(`${m.text}\n（体力 +${m.heal}・満腹 +${m.fill}${m.stress ? `・ストレス -${m.stress}` : ''}）`);
}
async function obachanTalk(g, npc) {
  const i = await g.ask(['いらっしゃい！社員食堂へようこそ。', 'タレントさんも見学の人も、だれでも食べていってね！'], ['食べる', 'おすすめは？', 'またね'], say(WHO.obachan));
  if (i === 0) await shokudo(g);
  else if (i === 1) {
    await g.say(['おすすめは特製オムライス！\nケチャップのハートは、おばちゃんの気持ちよ。', 'おなかがペコペコだと、お仕事に力が入らないでしょ。\n満腹ゲージ、ちゃんと見ときなさいね。'], say(WHO.obachan));
  } else await g.say('またおいで〜！', say(WHO.obachan));
  if (npc) npc.dir = 'down';
}

// ------------------------------------------------------------------ the place
registerPlace({
  id: PID,
  name: '日本テレビ',
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
      tiles: [
        '######################',
        '#UUUUUUULLLLLLUUUEUEU#',
        '#=hh=VV=llllll=V=e=e=#',
        '#C..D..P......PP.....#',
        '#A......KKKKKK.qG.G.G#',
        '#.........[].........#',
        '#.SSS.....[].........#',
        '#.ttt.....[].....B...#',
        '#.........[].........#',
        '#.........[]....SSS..#',
        '#.........[]....ttt..#',
        '#P.......F[]F.......P#',
        '##########MM##########',
      ],
      legend: {
        L: T('feat_u'), l: T('feat'), E: `${T('wall_u')}+${T('elevlamp')}`, e: 'elevator',
        h: `${T('wall')}+${T('panel')}`, V: `${T('wall')}+${T('monitor')}`,
        C: T('case'), D: T('diorama'), A: T('award'), K: T('counter'),
        q: T('glass'), G: T('gate'), '[': T('run_l'), ']': T('run_r'),
        S: 'sofa', t: 'table_low', B: 'sign_board', F: 'flower_stand',
      },
      warps: [
        ...exitWarps([10, 11], 12),
        { x: 17, y: 2, room: 'corridor', tx: 2, ty: 3, dir: 'down' },
        { x: 19, y: 2, room: 'corridor', tx: 4, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'logo', x: 8.3, y: 0.45, w: 5.4, h: 2.3, logo: PID, board: true, lights: true,
        },
        plate(16.5, 1, 'スタジオ・楽屋', 3),
        plate(1, 1, '開局からのあゆみ', 3),
        npc('ntv_recep', 10, 3, 'down', WHO.uketsuke, { talk: uketsukeTalk }),
        npc('ntv_annai', 11, 3, 'down', WHO.annai, { talk: annaiTalk }),
        npc('ntv_guard', 15, 5, 'down', WHO.guard, { talk: posted('down', guardTalk) }),
        npc('ntv_kanran_ad', 17, 7, 'left', WHO.kanranAD, { talk: kanranADTalk }),
        npc('ntv_mom', 5, 8, 'up', WHO.mom, {
          wander: 1,
          text: ['子どもが「テレビの中を見たい」って言うもので。', '1階のモニターで、いま放送中の番組が見られるのね。\nあの子、さっきから画面にくぎづけよ。'],
        }),
        npc('ntv_kid', 6, 3, 'up', WHO.kid, {
          talk: posted('up', lines(WHO.kid, ['このモニター、さっきから番組がどんどん変わるんだ！', 'ぼく、大きくなったらカメラマンになる！\n…いや、やっぱりAD！走るのはやいもん！'])),
        }),
        npc('ntv_waiting', 16, 9, 'down', WHO.waiting, {
          text: ['打ち合わせの相手を待ってるんです。', 'テレビ局って、待ち時間がけっこう長いんですよ。\n本と飲み物は、必須アイテムですね。'],
        }),
        npc('ntv_manager', 3, 9, 'right', WHO.manager, {
          wander: 1,
          text: ['担当タレントの付き添いでね。マネージャーの真田です。', 'タレントは体が資本。満腹・ストレス・身だしなみ、\n3つのゲージは毎朝チェックだよ。', 'お仕事を詰めこみすぎて燃え尽きたら、元も子もない。\n休みの日をつくるのも、立派な仕事のうち！'],
        }),
        { type: 'sign', x: 16, y: 7, text: '立て看板だ。\n「本日の番組観覧 受付中！参加無料」\n「観覧のお客様は、係のADにお声がけください」' },
        { type: 'sign', x: 1, y: 3, text: 'ガラスケースに、昔のスタジオカメラが飾ってある。\nレンズが3つ、くるっと回るしくみらしい。\n「テレビの黎明期を支えた一台」と書いてある。' },
        { type: 'sign', x: 4, y: 3, text: 'スタジオセットの模型だ。\n赤いセット、ひな壇、カメラまで…\n小さな出演者が、ちゃんと笑っている！' },
        { type: 'sign', x: 1, y: 4, text: '番組がもらった盾やトロフィーが並んでいる。\nたくさんのスタッフの努力のあかしだ。' },
        { type: 'sign', x: 2, y: 2, text: '「開局からのあゆみ」のパネルだ。\n白黒の写真から、カラーの写真へ…\nテレビの歴史が、ひと目でわかる。' },
        { type: 'sign', x: 3, y: 2, text: '「開局からのあゆみ」のパネルだ。\nスタジオの移りかわりの写真が並んでいる。' },
        { type: 'sign', x: 9, y: 11, text: '番組へのお祝いのスタンド花だ。\n「祝・新番組スタート」のふだがついている。' },
        { type: 'sign', x: 12, y: 11, text: 'スタンド花だ。\n赤と白の花で、局の色にそろえてある。' },
      ],
      events: [
        { x: 17, y: 4, on: 'step', cond: (g) => !g.flag('ntv_pass'), run: gatePass },
        { x: 19, y: 4, on: 'step', cond: (g) => !g.flag('ntv_pass'), run: gatePass },
        {
          x: 10, y: 10, w: 2, on: 'step', once: 'ntv_welcome',
          run: async (g) => {
            await g.emote('ntv_recep', '!');
            await g.say(['日本テレビへようこそ！', '番組出演のご相談は受付へ。\n観覧なら、右手のADにお声がけくださいね♪'], say(WHO.uketsuke));
          },
        },
      ],
    },

    // -------------------------------------------------------------- スタジオフロア（廊下）
    corridor: {
      floor: 'floor_tile',
      tiles: [
        '#######################',
        '#UUUUUUUUUUUUUUUUUUUUU#',
        '#=e=e=a==b=p=SsO=d=c=g#',
        '#Q.........V.......P..#',
        '#.....................#',
        '#P.......BB..........P#',
        '#######################',
      ],
      legend: {
        e: 'elevator', a: T('gdoor'), b: T('gdoor'), p: `${T('wall')}+poster`, S: T('sdoor_l'), s: T('sdoor_r'),
        O: `${T('wall')}+onair`, d: 'door_wood', c: `${T('wall')}+clock`, g: 'door_glass',
        Q: 'water_server', V: 'vending', B: 'sofa',
      },
      warps: [
        { x: 2, y: 2, room: 'lobby', tx: 17, ty: 3, dir: 'down' },
        { x: 4, y: 2, room: 'lobby', tx: 19, ty: 3, dir: 'down' },
        {
          x: 6, y: 2, room: 'gakuya', tx: 5, ty: 7, dir: 'up',
          check: async (g) => {
            await g.say('のれんの奥から、ドライヤーの音がする。\nドアの紙には「本日 使用中」。\n…ここは、ほかの出演者さんの楽屋みたいだ。');
            return false;
          },
        },
        { x: 9, y: 2, room: 'gakuya', tx: 5, ty: 7, dir: 'up' },
        { x: 13, y: 2, room: 'studio', tx: 10, ty: 12, dir: 'up' },
        { x: 14, y: 2, room: 'studio', tx: 11, ty: 12, dir: 'up' },
        { x: 17, y: 2, room: 'kaigi', tx: 6, ty: 8, dir: 'up' },
        { x: 21, y: 2, room: 'shokudo', tx: 7, ty: 9, dir: 'up' },
      ],
      entities: [
        plate(1.5, 1, 'エレベーター', 3),
        plate(5, 1, '楽屋1'),
        plate(8, 1, '楽屋2'),
        plate(12.5, 1, 'スタジオ', 3),
        plate(16, 1, '会議室'),
        plate(20, 1, '社員食堂', 2),
        npc('ntv_ad', 7, 4, 'right', WHO.ad, {
          talk: async (g, e) => {
            await g.say(['ADの小嶋です！走ってます！', 'カンペ書いて、弁当配って、出演者さんのお出迎え…\nテレビは、たくさんの人で作ってるんです！', '「楽屋2」は、今日は空いてますよ。\nひと休みにどうぞ！'], say(WHO.ad));
            if (e) e.dir = 'right';
          },
        }),
        npc('ntv_wakate', 19, 4, 'left', WHO.wakate, {
          wander: 1,
          text: ['（ぶつぶつ…）ネタの練習中っす。', '今日、はじめてのひな壇なんすよ。\nVTRのときの笑い方、10パターン練習してきました。', 'あ、食堂のオムライス、めっちゃうまいっすよ。\n本番前は、腹ごしらえが大事っす！'],
        }),
        npc('ntv_ad2', 12, 5, 'left', WHO.ad2, {
          wander: 2,
          text: ['すみませーん、通りまーす！', 'スタジオのドアの横、「ON AIR」のランプが\n光ってたら本番中！静かにお願いしますね！'],
        }),
      ],
      events: [
        {
          x: 12, y: 3, h: 3, on: 'step', once: 'ntv_kanpe',
          run: async (g) => {
            g.sfx('hit');
            await g.emote('ntv_ad', '!');
            await g.say('うわああっ！カンペの束がー！');
            await g.say('ADの小嶋くんが、廊下にカンペをぶちまけた！\n…いっしょに拾ってあげよう。');
            await g.fadeOut(8);
            g.sfx('cursor');
            await g.wait(300);
            await g.fadeIn(8);
            await g.say(['た、助かりました…！本番5分前だったんです！', 'これ、お礼です。楽屋に置いてあった雑誌。\nトークのネタになりますよ！'], say(WHO.ad));
            g.giveItem('wadai', 1, true);
            g.sfx('ok');
            await g.say('「話題の雑誌」をもらった！');
          },
        },
        { x: 9, y: 5, w: 2, on: 'action', run: async (g) => { await g.say('廊下のベンチだ。\n出番待ちの芸人さんが、よくここでネタを合わせている。'); } },
      ],
    },

    // -------------------------------------------------------------- 楽屋
    gakuya: {
      floor: 'floor_carpet_beige',
      tiles: [
        '############',
        '#UUUUUUUUUU#',
        '#=mm=mm=v==#',
        '#.kk.kk...L#',
        '#.........R#',
        '#tttt..SSS.#',
        '#tTTt......#',
        '#tttt.....P#',
        '#####MM#####',
      ],
      legend: {
        m: `${T('wall')}+mirror`, v: `${T('wall')}+${T('monitor')}`, k: 'makeup', L: 'locker', R: 'clothes_rack',
        t: 'floor_tatami', T: 'floor_tatami+table_low', S: 'sofa',
      },
      warps: [
        { x: 5, y: 8, room: 'corridor', tx: 9, ty: 3, dir: 'down' },
        { x: 6, y: 8, room: 'corridor', tx: 9, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('ntv_make', 4, 3, 'left', WHO.make, { talk: makeTalk }),
        { type: 'logo', x: 9.5, y: 1.2, w: 2, h: 1.02, logo: PID, board: true, text: '楽屋にも、日本テレビのロゴ。\n本番前に見ると、背すじがのびる。' },
      ],
      events: [
        { x: 2, y: 3, w: 2, on: 'action', run: mirror },
        { x: 5, y: 3, w: 2, on: 'action', run: mirror },
        { x: 7, y: 5, w: 3, on: 'action', run: restSofa },
        { x: 2, y: 6, w: 2, on: 'action', run: sashiire },
        { x: 8, y: 2, on: 'action', run: async (g) => { await g.say(onAir ? 'モニターに、スタジオの本番が映っている。\nみんな楽しそうだ！' : 'モニターに、スタジオの様子が映っている。\n美術さんが、セットの仕上げをしているみたい。'); } },
        { x: 10, y: 3, on: 'action', run: async (g) => { await g.say('ロッカーだ。\n「貴重品は自分で管理してください」の貼り紙。'); } },
        { x: 10, y: 4, on: 'action', run: async (g) => { await g.say('衣装がずらりと並んでいる。\n今日の衣装は…赤いジャケット！目立ちそう。'); } },
      ],
      onEnter: async (g) => {
        if (g.flag('ntv_gakuya_first')) return;
        g.setFlag('ntv_gakuya_first');
        await g.wait(200);
        await g.emote('ntv_make', '!');
        await g.say(['あら、出演者さん？いらっしゃい。', '楽屋は自由に使ってね。\nソファでひと休み、鏡で身だしなみ、\nちゃぶ台の差し入れもどうぞ！'], say(WHO.make));
      },
    },

    // -------------------------------------------------------------- バラエティスタジオ
    studio: {
      floor: 'floor_studio',
      bgm: 'studio',
      topPad: 24,
      tiles: [
        '######################',
        '#AAAAAAAA1234AAAAAAAA#',
        '#aaaaaaaa5678aaaaaaaa#',
        '#L,,,,,,,,,,,,HHHHH,L#',
        '#,,,m,,,,,,,,,IIIII,,#',
        '#,,,,,,,,,,,,,JJJJJ,,#',
        '#.eeeeeeesssseeeeeee.#',
        '#....................#',
        '#...K.....K.....K..D.#',
        '#....................#',
        '#..QQQQQQ....QQQQQQ..#',
        '#..QQQQQQ....QQQQQQ..#',
        '#....................#',
        '##########MM##########',
      ],
      legend: {
        A: T('set_u'), a: T('set'),
        1: T('led0'), 2: T('led1'), 3: T('led2'), 4: T('led3'), 5: T('led4'), 6: T('led5'), 7: T('led6'), 8: T('led7'),
        ',': T('setfloor'), L: `${T('setfloor')}+spotlight`, m: `${T('setfloor')}+${T('mcstand')}`,
        H: `${T('setfloor')}+${T('hina_a')}`, I: `${T('setfloor')}+${T('hina_b')}`, J: `${T('setfloor')}+${T('hina_c')}`,
        e: `floor_studio+${T('edge')}`, s: T('steps'),
        K: 'floor_studio+camera', D: 'floor_studio+director_chair', Q: 'floor_studio+seat',
      },
      warps: [
        { x: 10, y: 13, room: 'corridor', tx: 13, ty: 3, dir: 'down' },
        { x: 11, y: 13, room: 'corridor', tx: 14, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 2.2, y: 0.55, w: 3.2, h: 1.35, logo: PID, board: true, lights: true },
        onAirLamp(17.3, 0.6, () => !!onAir),
        // regular crew (when no show is running)
        npc('ntv_fd', 13, 7, 'left', WHO.fd, { talk: fdTalk, cond: () => !show }),
        npc('ntv_director', 19, 9, 'down', WHO.director, { talk: directorTalk, cond: () => !show }),
        npc('ntv_cam1', 10, 9, 'up', WHO.camera, {
          cond: () => !show,
          talk: posted('up', lines(WHO.camera, ['カメラマンです。', 'カメラの上の赤いランプ、「タリー」っていうんです。\n光ってるカメラの映像が、いま放送中！', 'そのカメラを見て話すと、テレビの前の人と\n目が合うんですよ。'])),
        }),
        npc('ntv_light', 1, 4, 'up', WHO.light, {
          cond: () => !show,
          talk: posted('up', lines(WHO.light, ['照明さんだよ。ライトの角度を調整中。', 'ひな壇の上の段は、光が当たりにくいんだ。\nだから上の段の人ほど、リアクションは大きめにね！'])),
        }),
        npc('ntv_bijutsu', 7, 5, 'down', WHO.bijutsu, {
          wander: 1, cond: () => !show,
          text: ['美術スタッフです。セットの仕上げ中！', 'このセット、電球を一個一個つけてるんですよ。\n切れてたら交換！地味だけど大事な仕事です。'],
        }),
        // show cast
        npc('ntv_show_fd', 12, 7, 'up', WHO.fd, { cond: () => !!show && show !== 'maesetsu', text: '本番中です…！\n（カンペで、出演者に合図を送っている）' }),
        npc('ntv_show_fd2', 13, 8, 'up', WHO.fd, { cond: () => show === 'maesetsu', text: 'いい感じですよ！' }),
        npc('ntv_show_ad', 11, 7, 'left', WHO.ad, { cond: () => show === 'maesetsu', text: 'よろしくお願いしまーす！' }),
        npc('ntv_show_mc', 4, 3, 'down', WHO.mc, { cond: () => show === 'kanran' || show === 'hina', text: '今日もよろしく！' }),
        npc('ntv_show_g1', 15, 3, 'down', WHO.guestA, { cond: () => show === 'kanran' || show === 'hina', text: 'ひな壇の上の段は、景色がええで〜。' }),
        npc('ntv_show_g2', 17, 4, 'down', WHO.guestB, { cond: () => show === 'kanran' || show === 'hina', text: 'がんばりましょうね！' }),
        npc('ntv_show_g3', 15, 5, 'down', WHO.guestC, { cond: () => show === 'kanran' || show === 'hina', text: 'バラエティは緊張します…。' }),
        npc('ntv_show_g4', 17, 3, 'down', WHO.guestD, { cond: () => show === 'kanran' || show === 'hina', text: '若いのに負けへんで！' }),
        npc('ntv_show_g5', 16, 4, 'down', WHO.wakate, { cond: () => show === 'kanran', text: '（VTRに全力で笑っている）' }),
        npc('ntv_show_cam1', 4, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        npc('ntv_show_cam2', 10, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        npc('ntv_show_cam3', 16, 9, 'up', WHO.camera, { cond: () => !!show, text: '本番中です…！' }),
        ...AUD.map(([id, x, y, look]) => npc(id, x, y, 'up', { name: WHO.aud.name, look }, { cond: audVisible(id), text: ['ワクワク…！', '楽しみ〜！', 'テレビに映るかな？'][x % 3] })),
      ],
      events: [
        { x: 4, y: 4, on: 'action', cond: () => !show, run: async (g) => { await g.say('司会者のスタンドだ。\n台本に、赤ペンでびっしり書きこみがしてある。'); } },
        { x: 14, y: 5, w: 5, on: 'action', cond: () => !show, run: async (g) => { await g.say('ひな壇だ。上の段ほど、ベテランが座るらしい。\nいつか、ここに座ってみたい…！'); } },
        { x: 9, y: 2, w: 4, on: 'action', run: async (g) => { await g.say('大型ビジョンだ。VTRやテロップが映し出される。\n本番中は、ここを見ながらリアクション！'); } },
        { x: 4, y: 8, on: 'action', run: async (g) => { await g.say('大きなスタジオカメラだ。\nファインダーに、セットが映っている。'); } },
        { x: 10, y: 8, on: 'action', run: async (g) => { await g.say('センターのカメラだ。\n司会者スタンドを正面から映している。'); } },
        { x: 16, y: 8, on: 'action', run: async (g) => { await g.say('スタジオカメラだ。\nひな壇のほうを向いている。'); } },
        { x: 19, y: 8, on: 'action', run: async (g) => { await g.say('ディレクターのいすだ。\n座ってみたいけど、怒られそうなのでやめておこう。'); } },
        { x: 3, y: 10, w: 6, h: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('観覧席だ。\n収録の日は、ここがお客さんでいっぱいになる。'); } },
        { x: 13, y: 10, w: 6, h: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('観覧席だ。\nいすの背に「拍手は大きく！」のシールが貼ってある。'); } },
      ],
      drawOver: (ctx, g, cam) => {
        if (!onAir) return;
        ctx.fillStyle = 'rgba(255,240,220,0.07)';
        for (const cx of [4, 11, 16]) {
          const x0 = cx * 16 + 8 - cam.x, y0 = 24 - cam.y;
          ctx.beginPath();
          ctx.moveTo(x0 - 5, y0); ctx.lineTo(x0 + 5, y0); ctx.lineTo(x0 + 30, y0 + 72); ctx.lineTo(x0 - 30, y0 + 72);
          ctx.closePath(); ctx.fill();
        }
      },
      onEnter: async (g) => {
        if (show || g.flag('ntv_studio_first')) return;
        g.setFlag('ntv_studio_first');
        await g.wait(200);
        await g.emote('ntv_fd', '!');
        await g.say(['おっ、見学ですか？\nここがバラエティのスタジオです！', '奥がセット、右がひな壇、手前が観覧席。\n本番中は、入口の「ON AIR」が光ります。', '前説をやってくれる人、いつでも募集中！\n声をかけてくださいね！'], say(WHO.fd));
      },
    },

    // -------------------------------------------------------------- 会議室
    kaigi: {
      floor: 'floor_carpet_gray',
      tiles: [
        '##############',
        '#UUUUUUUUUUUU#',
        '#=ww==KWK==ww#',
        '#P..........P#',
        '#...cccccc...#',
        '#...TTTTTT...#',
        '#...TTTTTT...#',
        '#...cccccc...#',
        '#P..........P#',
        '######MM######',
      ],
      legend: {
        w: `${T('wall')}+${T('window')}`, K: `${T('wall')}+${T('kikaku')}`, W: `${T('wall')}+whiteboard`,
        c: 'chair', T: 'table_white',
      },
      warps: [
        { x: 6, y: 9, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
        { x: 7, y: 9, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('ntv_producer', 3, 5, 'right', WHO.producer, {
          talk: async (g, e) => {
            if (!g.flag('ntv_kikaku')) { g.setFlag('ntv_kikaku'); await kikakuMeeting(g); if (e) e.dir = 'right'; return; }
            await g.say(['プロデューサーの真壁です。', '番組はね、「だれに見てほしいか」から考えるんだ。\nおじいちゃんか、小学生か、深夜の受験生か。', '出演のご相談は、1階の受付で受け付けてるよ。'], say(WHO.producer));
            if (e) e.dir = 'right';
          },
        }),
        npc('ntv_writer', 10, 5, 'left', WHO.writer, {
          talk: posted('left', lines(WHO.writer, ['構成作家の筆坂です。台本を書いてます。', '台本には「ここで笑い」って書いてあっても、\n本当に笑えるかは出演者さんしだい。', 'ネタ帳を持ってると、ふられたときに強いですよ。\nトークのネタは、日々の暮らしの中にあります！'])),
        }),
        npc('ntv_ad3', 8, 3, 'down', { name: 'ADの見習い', look: { ...LOOKS.ad, hair: 'bob', hairColor: 'black', top: REDL } }, {
          wander: 1,
          text: ['会議の資料をコピーしてきました！', '…あっ、1枚だけ逆さまに刷っちゃった。\nこれも「企画」ってことで、だめですか？'],
        }),
      ],
      events: [
        { x: 6, y: 2, on: 'action', run: async (g) => { await g.say('企画のアイデアを書いた付せんが、びっしり。\n「深夜」「動物」「ふるさと」「早口」…'); } },
        { x: 8, y: 2, on: 'action', run: async (g) => { await g.say('付せんボードだ。赤い糸で、アイデアどうしが\nつながれている。名探偵の部屋みたい。'); } },
        { x: 7, y: 2, on: 'action', run: async (g) => { await g.say('ホワイトボードに、収録の予定がぎっしり。\n「特番 打ち合わせ」の文字に、二重丸がついている。'); } },
        { x: 2, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('大きな窓から、ビルの街と海が見える。\nいい眺め…！'); } },
        { x: 11, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('窓の外を、ゆりかもめのような白い鳥が飛んでいった。'); } },
      ],
    },

    // -------------------------------------------------------------- 社員食堂
    shokudo: {
      floor: 'floor_wood',
      bgm: 'office',
      tiles: [
        '################',
        '#UUUUUUUUUUUUUU#',
        '#=nn====ww=ww==#',
        '#kk..kF........#',
        '#CCCCCC.XYZ....#',
        '#..............#',
        '#.hhh..hhh.hhh.#',
        '#.TTT..TTT.TTT.#',
        '#.hhh..hhh.hhh.#',
        '#P............P#',
        '#######MM#######',
      ],
      legend: {
        n: `${T('wall')}+${T('menu')}`, w: `${T('wall')}+${T('window')}`,
        k: 'kitchen', F: 'fridge_drinks', C: 'counter', X: T('kenbaiki'), Y: T('sample_l'), Z: T('sample_r'),
        h: 'chair', T: 'table',
      },
      warps: [
        { x: 7, y: 10, room: 'corridor', tx: 21, ty: 3, dir: 'down' },
        { x: 8, y: 10, room: 'corridor', tx: 21, ty: 3, dir: 'down' },
      ],
      entities: [
        npc('ntv_obachan', 3, 3, 'down', WHO.obachan, { talk: obachanTalk }),
        npc('ntv_eater', 8, 6, 'down', WHO.eater, {
          talk: posted('down', lines(WHO.eater, ['カメラマンの昼休みっす。カレー大盛り！', 'ロケの日は、食べられるときに食べとくのが鉄則。\nはらぺこだと、カメラもブレるんすよ。'])),
        }),
        npc('ntv_eater2', 12, 8, 'up', WHO.eater2, {
          talk: posted('up', lines(WHO.eater2, ['編集マンです。徹夜あけのうどん、しみる…。', '寝不足とストレスは、仕事の大敵。\nわかっちゃいるけど、締め切りがね…。', 'みなさんは、ちゃんとベッドで寝てくださいね。'])),
        }),
        npc('ntv_eater3', 3, 8, 'up', { name: 'お昼のアナウンサー', look: { ...LOOKS.announcer, top: WHT, bottom: RED } }, {
          talk: posted('up', lines({ name: 'お昼のアナウンサー', look: { ...LOOKS.announcer, top: WHT, bottom: RED } }, ['日替わり定食、今日はしょうが焼きです！', '原稿を読む前は、おなかいっぱいにしすぎないのがコツ。\n腹八分目が、いちばん声が出るんですよ。'])),
        }),
      ],
      events: [
        {
          x: 8, y: 4, on: 'action',
          run: async (g) => {
            await g.say('食券機だ。ボタンがずらりと並んでいる。');
            await shokudo(g);
          },
        },
        { x: 9, y: 4, w: 2, on: 'action', run: async (g) => { await g.say('食品サンプルのショーケースだ。\nカレー、定食、うどん、オムライス…\nどれもおいしそう！'); } },
        { x: 8, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('窓の外に、海と街が広がっている。\nお昼ごはんが、いつもよりおいしく感じる。'); } },
        { x: 11, y: 2, w: 2, on: 'action', run: async (g) => { await g.say('窓ぎわの席は、いつも取りあいらしい。'); } },
      ],
      onEnter: async (g) => {
        if (g.flag('ntv_shokudo_first')) return;
        g.setFlag('ntv_shokudo_first');
        await g.wait(200);
        await g.emote('ntv_obachan', '!');
        await g.say(['あら、はじめての顔ね！いらっしゃい。', '食券機かカウンターで注文してね。\n安くて、おなかいっぱいになるわよ〜！'], say(WHO.obachan));
      },
    },
  },
});
