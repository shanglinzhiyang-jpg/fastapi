// BSよしもと（東京エリア）— 地域の魅力とお笑いを発信するBSテレビ局
//
//   lobby   ロビー        受付・大きなロゴ看板・ご当地モニター・ニッポンご当地マップ・番組観覧の受付。
//                         ほっくり町のご当地キャラ「ほっくりん」と観光課の物産ブース。
//   studio  メインスタジオ  明るいセット・カメラ・観覧席。番組観覧／ご当地クイズ／生放送／特番はここで演じる。
//   sub     副調整室      モニターの壁とスイッチャー卓。ディレクター（ロケ・生放送）とプロデューサー（お仕事リスト・特番）。
//   hikae   控室          メイクさん・先輩アナのレッスン・差し入れ。
//
// お仕事の段階：
//   0 番組観覧（だれでも・1日1回・トーク+1）
//   1 ご当地クイズ番組の解答者（事務所所属 または ★30）quiz japan d2
//   2 地域密着ロケ番組のリポーター（★250）talk d3 topic local
//   3 生放送の情報番組MC（★1000）announce d4
//   4 特番の総合司会（★2000・1日1回）talk d5

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet, drawChar } from '../engine/sprites.js';
import { defineTile, tileImage, R, P, disc, shadowEllipse, pix } from '../engine/tiles.js';
import { registerItem, payText } from '../engine/state.js';
import { ACTIVITY } from '../engine/life.js';
import { text, panel } from '../engine/draw.js';
import { W, H, OPP, fmtMoney, pick, shuffle, makeCanvas } from '../engine/util.js';

const PID = 'bs_yoshimoto';
const T = (k) => `${PID}_${k}`;

// ------------------------------------------------------------------ palette
const RED = '#ff2600';
const REDD = '#c81e00';
const REDX = '#8a1500';
const REDL = '#ff6a48';
const REDP = '#ffd9cf';
const WHT = '#ffffff';
const OFF = '#f3f4f7';
const LG = '#e3e6eb';
const MG = '#c3c8d2';
const DG = '#7d8391';
const INK = '#20232a';
const GOLD = '#ffd23f';
const BULB = '#fff6a8';
const CYAN = '#5fd7ff';
const GRN = '#5ee07a';
const NAVY = '#2a3560';
// ほっくりん（さつまいも）の色
const IMO = '#a8386e';
const IMOD = '#7a2450';
const IMOL = '#d0679a';
const IMOO = '#4a1838';
const IMOF = '#ffe7a0';

const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

// ------------------------------------------------------------------ tiles
function wallU(c) {
  R(c, 0, 0, 16, 16, OFF);
  R(c, 0, 1, 16, 2, RED); R(c, 0, 3, 16, 1, REDD); R(c, 0, 4, 16, 1, LG);
  R(c, 15, 5, 1, 11, '#e8eaee');
}
function wallL(c) {
  R(c, 0, 0, 16, 16, OFF);
  R(c, 15, 0, 1, 12, '#e8eaee');
  R(c, 0, 12, 16, 4, MG); R(c, 0, 12, 16, 1, RED); R(c, 0, 15, 16, 1, DG);
}
defineTile(T('walltop'), {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#3a3d46'); R(c, 0, 0, 16, 1, '#4a4e58'); R(c, 0, 14, 16, 1, '#5a5f6b'); R(c, 0, 15, 16, 1, RED); },
});
defineTile(T('wall_u'), { solid: true, draw: wallU });
defineTile(T('wall'), { solid: true, draw: wallL });
// Red feature wall behind the reception (logo backdrop).
defineTile(T('feat_u'), {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, RED); R(c, 0, 1, 16, 1, REDL); R(c, 0, 3, 16, 1, REDD);
    R(c, 7, 4, 1, 12, REDD); R(c, 8, 4, 1, 12, '#ff4a20');
  },
});
defineTile(T('feat'), {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, RED); R(c, 7, 0, 1, 12, REDD); R(c, 8, 0, 1, 12, '#ff4a20');
    R(c, 0, 12, 16, 4, REDD); R(c, 0, 12, 16, 1, REDX);
  },
});
// Glossy light-gray stone floor.
defineTile(T('floor'), {
  variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#eef0f3'); R(c, 0, 0, 16, 1, '#dde0e6'); R(c, 0, 0, 1, 16, '#dde0e6');
    if (v === 0) { R(c, 3, 3, 3, 1, WHT); P(c, 3, 4, WHT); }
    if (v === 1) { R(c, 10, 11, 3, 1, '#f9fafb'); P(c, 12, 10, WHT); }
  },
});
// Entrance runway: white floor with a red inlay line on the outside.
function runway(side) {
  return (c) => {
    R(c, 0, 0, 16, 16, '#f7f8fa'); R(c, 0, 0, 16, 1, '#e6e8ec');
    if (side === 'l') { R(c, 1, 0, 2, 16, RED); R(c, 3, 0, 1, 16, REDP); R(c, 0, 0, 1, 16, '#dde0e6'); } else { R(c, 13, 0, 2, 16, RED); R(c, 12, 0, 1, 16, REDP); }
    R(c, side === 'l' ? 7 : 5, 6, 4, 1, WHT);
  };
}
defineTile(T('run_l'), { draw: runway('l') });
defineTile(T('run_r'), { draw: runway('r') });
defineTile(T('counter'), {
  solid: true, obj: true, talkThrough: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 1, 16, 6, WHT); R(c, 0, 6, 16, 1, LG);
    R(c, 0, 7, 16, 9, RED); R(c, 0, 7, 16, 1, REDD); R(c, 0, 10, 16, 2, WHT); R(c, 0, 15, 16, 1, REDX);
    if (v === 1) { R(c, 9, 0, 5, 4, INK); R(c, 10, 1, 3, 2, CYAN); R(c, 11, 4, 1, 2, DG); }
    if (v === 2) { R(c, 3, 3, 4, 3, '#fff6d0'); R(c, 4, 4, 2, 1, MG); disc(c, 11, 4, 1, GOLD); }
  },
});
// Heavy double doors to the studio (l / r leaf, upper / lower).
function sdoor(side, upper) {
  const L = side === 'l';
  return (c) => {
    if (upper) {
      wallU(c);
      R(c, 0, 8, 16, 8, '#4a4e58');
      if (L) R(c, 2, 9, 14, 7, '#9aa0aa'); else R(c, 0, 9, 14, 7, '#9aa0aa');
      if (L) R(c, 2, 9, 14, 1, '#c3c8d2'); else R(c, 0, 9, 14, 1, '#c3c8d2');
      R(c, L ? 5 : 2, 11, 9, 4, '#1d2650'); R(c, L ? 6 : 3, 12, 3, 1, '#4a6aa8');
      R(c, L ? 15 : 0, 8, 1, 8, '#2a2d36');
    } else {
      R(c, 0, 0, 16, 16, '#4a4e58');
      if (L) R(c, 2, 0, 14, 15, '#9aa0aa'); else R(c, 0, 0, 14, 15, '#9aa0aa');
      R(c, L ? 4 : 1, 4, 11, 2, '#d5d9e0'); R(c, L ? 4 : 1, 6, 11, 1, '#6d7380');
      if (L) R(c, 2, 11, 14, 3, '#7d8391'); else R(c, 0, 11, 14, 3, '#7d8391');
      R(c, L ? 15 : 0, 0, 1, 16, '#2a2d36');
      R(c, 0, 15, 16, 1, '#3b3f48');
    }
  };
}
defineTile(T('sdoor_ul'), { solid: true, draw: sdoor('l', true) });
defineTile(T('sdoor_ur'), { solid: true, draw: sdoor('r', true) });
defineTile(T('sdoor_l'), { draw: sdoor('l', false) });
defineTile(T('sdoor_r'), { draw: sdoor('r', false) });
// Wooden door with a "控室" plate.
defineTile(T('kdoor_u'), {
  solid: true,
  draw(c) {
    wallU(c);
    R(c, 2, 6, 12, 10, '#6e4428'); R(c, 3, 7, 10, 9, '#c48a52');
    R(c, 4, 8, 8, 4, WHT); R(c, 5, 9, 2, 2, INK); R(c, 8, 9, 3, 1, INK); R(c, 8, 10, 2, 1, INK);
  },
});
defineTile(T('kdoor'), {
  draw(c) {
    R(c, 0, 0, 16, 16, OFF);
    R(c, 2, 0, 12, 16, '#6e4428'); R(c, 3, 0, 10, 15, '#c48a52');
    R(c, 4, 2, 8, 4, '#b47a46'); R(c, 4, 8, 8, 5, '#b47a46'); R(c, 11, 6, 2, 2, GOLD); R(c, 2, 15, 12, 1, '#5a3a20');
  },
});
// White modern sofa with red cushions.
defineTile(T('sofa'), {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 8, 1);
    R(c, 0, 2, 16, 6, '#d9dce2'); R(c, 0, 2, 16, 1, WHT);
    R(c, 0, 7, 16, 6, WHT); R(c, 0, 12, 16, 1, MG);
    R(c, 2, 4, 5, 4, RED); R(c, 9, 4, 5, 4, RED); R(c, 2, 4, 5, 1, REDL); R(c, 9, 4, 5, 1, REDL);
    R(c, 1, 13, 2, 2, DG); R(c, 13, 13, 2, 2, DG);
  },
});
// ほっくり町の物産ブース（焼きいも・干しいもが並ぶ）
defineTile(T('booth'), {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 15, 8, 1);
    R(c, 0, 3, 16, 5, '#fff6e0'); R(c, 0, 3, 16, 1, WHT);
    for (let k = 0; k < 3; k++) {
      const x = 1 + k * 5;
      if (v === 0) { R(c, x, 4, 4, 2, IMO); P(c, x, 4, IMOL); P(c, x + 3, 5, IMOD); P(c, x + 1, 5, IMOF); } else { R(c, x, 4, 4, 2, '#e8c46a'); R(c, x, 4, 4, 1, '#f5dc90'); }
    }
    R(c, 0, 8, 16, 7, WHT); R(c, 0, 8, 16, 1, LG);
    R(c, 0, 10, 16, 3, IMO); R(c, 0, 10, 16, 1, IMOL);
    for (let x = 2; x < 16; x += 4) R(c, x, 11, 2, 1, WHT);
    R(c, 0, 14, 16, 1, MG);
  },
});
defineTile(T('nobori'), {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 0, 1, 16, '#c0c4cc');
    R(c, 4, 1, 8, 13, IMO); R(c, 4, 1, 8, 1, IMOL);
    R(c, 6, 3, 4, 1, WHT); R(c, 7, 4, 2, 3, WHT); R(c, 6, 8, 4, 1, IMOF); R(c, 6, 10, 4, 2, IMOF);
    R(c, 2, 14, 4, 2, '#5a5f6b');
  },
});
// "番組観覧 受付" stand sign.
defineTile(T('stand'), {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 7, 11, 2, 4, DG); R(c, 4, 14, 8, 1, DG);
    R(c, 2, 0, 12, 12, INK); R(c, 3, 1, 10, 10, WHT); R(c, 3, 1, 10, 3, RED);
    R(c, 5, 2, 6, 1, WHT); R(c, 4, 5, 8, 1, INK); R(c, 4, 7, 6, 1, INK); R(c, 4, 9, 7, 1, RED);
  },
});
// Studio: dark sound-proof walls.
function acoustic(c, h) {
  R(c, 0, 0, 16, 16, '#30333c');
  for (let y = 1; y < h; y += 4) for (let x = (y >> 2) % 2 ? 2 : 0; x < 16; x += 4) R(c, x, y, 2, 2, '#3c3f49');
}
defineTile(T('swall_u'), { solid: true, draw(c) { acoustic(c, 16); R(c, 0, 0, 16, 1, '#454956'); } });
defineTile(T('swall'), { solid: true, draw(c) { acoustic(c, 12); R(c, 0, 12, 16, 4, '#202228'); R(c, 0, 12, 16, 1, '#4a4e58'); } });
// Metal door to the control room (副調整室) with a small plate.
defineTile(T('cdoor_u'), {
  solid: true,
  draw(c) {
    acoustic(c, 16);
    R(c, 1, 2, 14, 4, WHT); R(c, 2, 3, 3, 2, INK); R(c, 6, 3, 3, 2, INK); R(c, 10, 3, 4, 2, INK);
    R(c, 1, 7, 14, 9, '#3b3f48'); R(c, 2, 8, 12, 8, '#8d939e'); R(c, 2, 8, 12, 1, '#b8bec8');
    R(c, 5, 10, 6, 4, '#1d2650'); P(c, 6, 11, CYAN);
  },
});
defineTile(T('cdoor'), {
  draw(c) {
    R(c, 0, 0, 16, 16, '#30333c');
    R(c, 1, 0, 14, 16, '#3b3f48'); R(c, 2, 0, 12, 15, '#8d939e');
    R(c, 11, 6, 2, 3, '#d5d9e0'); R(c, 2, 11, 12, 3, '#7d8391'); R(c, 1, 15, 14, 1, '#20232a');
  },
});
// Studio set backdrop: white panels framed in red, with a marquee header.
defineTile(T('set_u'), {
  solid: true, frames: 2, speed: 28, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, WHT);
    R(c, 0, 0, 16, 4, REDD); R(c, 0, 3, 16, 1, REDX);
    for (let x = 1; x < 16; x += 3) P(c, x, 1, (x + f) % 2 ? GOLD : BULB);
    R(c, 0, 4, 1, 12, RED); R(c, 15, 4, 1, 12, RED);
    R(c, 1, 5, 14, 11, v ? '#ffe9e3' : '#f7f8fa');
    if (v) { disc(c, 8, 11, 3, '#ffd2c6'); disc(c, 8, 11, 1, '#ffe9e3'); }
    R(c, 2, 6, 3, 1, WHT);
  },
});
defineTile(T('set'), {
  solid: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, WHT);
    R(c, 0, 0, 1, 12, RED); R(c, 15, 0, 1, 12, RED);
    R(c, 1, 0, 14, 12, v ? '#ffe9e3' : '#f7f8fa');
    R(c, 0, 12, 16, 4, RED); R(c, 0, 12, 16, 1, REDL); R(c, 0, 15, 16, 1, REDX);
    for (let x = 2; x < 16; x += 4) P(c, x, 13, BULB);
  },
});
defineTile(T('setfloor'), {
  variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#f7f8fa'); R(c, 0, 0, 16, 1, '#eaecf0'); R(c, 0, 0, 1, 16, '#eaecf0');
    if (v === 0) { R(c, 4, 9, 5, 1, WHT); R(c, 5, 10, 3, 1, WHT); }
    if (v === 1) R(c, 10, 4, 3, 1, WHT);
  },
});
// Front lip of the set (walkable step) with chaser lights.
defineTile(T('setedge'), {
  frames: 2, speed: 24,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#2e3038');
    R(c, 0, 0, 16, 4, '#f7f8fa');
    R(c, 0, 4, 16, 6, RED); R(c, 0, 4, 16, 1, REDL); R(c, 0, 9, 16, 1, REDX);
    for (let x = 1; x < 16; x += 3) P(c, x, 6, (Math.floor(x / 3) + f) % 2 ? BULB : '#ff9a7a');
    R(c, 0, 10, 16, 2, '#24262d');
  },
});
// MC desk (white top, red front) — you can talk to the MC behind it.
defineTile(T('mcdesk'), {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 15, 8, 1);
    R(c, 0, 2, 16, 5, WHT); R(c, 0, 6, 16, 1, LG);
    R(c, 0, 7, 16, 8, RED); R(c, 0, 7, 16, 1, REDD); R(c, 0, 10, 16, 1, REDL); R(c, 0, 14, 16, 1, REDX);
    if (v) { R(c, 3, 3, 4, 3, '#fff6d0'); R(c, 4, 4, 2, 1, MG); } else { R(c, 10, 0, 1, 4, DG); R(c, 9, 0, 3, 2, INK); R(c, 9, 4, 4, 2, '#fff6d0'); }
  },
});
// Quiz answer panel with a buzzer.
defineTile(T('panel'), {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 7, 1);
    R(c, 1, 4, 14, 3, LG); R(c, 1, 4, 14, 1, WHT);
    disc(c, 8, 4, 2, RED); P(c, 7, 3, REDL);
    R(c, 1, 7, 14, 8, NAVY); R(c, 1, 7, 14, 1, '#4a5a9a'); R(c, 1, 14, 14, 1, '#1a2244');
    R(c, 3, 9, 10, 4, WHT); R(c, 4, 10, 8, 1, INK);
    R(c, 6, 11, 4, 1, RED);
  },
});
// Studio pedestal camera seen from behind (it points at the set).
defineTile(T('cam'), {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 7, 1);
    R(c, 3, 13, 10, 2, '#3b3f48'); R(c, 2, 14, 2, 1, INK); R(c, 12, 14, 2, 1, INK); R(c, 7, 9, 2, 5, '#5a5f6b');
    R(c, 2, 1, 12, 8, '#3b3f48'); R(c, 3, 1, 10, 1, '#5a5f6b');
    R(c, 4, 2, 8, 5, INK); R(c, 5, 3, 6, 3, '#f7f8fa'); R(c, 5, 5, 6, 1, RED); P(c, 7, 4, '#f6c9a0'); P(c, 9, 4, '#f6c9a0');
    R(c, 0, 8, 4, 1, DG); R(c, 12, 8, 4, 1, DG); R(c, 6, 0, 4, 1, '#5a5f6b');
  },
});
// Audience bench seats seen from behind, on a dark riser.
defineTile(T('seat'), {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 11, 16, 5, '#3a3d46'); R(c, 0, 11, 16, 1, '#4a4e58');
    for (const x of [1, 9]) {
      R(c, x, 3, 6, 8, REDD); R(c, x, 3, 6, 1, REDL); R(c, x + 1, 4, 4, 5, RED);
      R(c, x, 10, 6, 1, REDX); R(c, x + 1, 11, 1, 3, DG); R(c, x + 4, 11, 1, 3, DG);
    }
  },
});
// Small screens used by the monitor wall.
const SCR = ['#5fd7ff', '#5ee07a', '#ffd23f', '#ff7eb6', '#f7f8fa', '#ff6a48'];
function tinyScreen(c, x, y, w, h, k, f) {
  R(c, x, y, w, h, '#0e0f13');
  const kind = (k + f) % 6;
  if (kind === 0) { for (let i = 0; i < w - 2; i++) R(c, x + 1 + i, y + 1, 1, h - 2, SCR[i % 6]); }
  else if (kind === 1) { R(c, x + 1, y + 1, w - 2, h - 2, '#8fd0ff'); R(c, x + 1, y + h - 3, w - 2, 2, '#4a9a4a'); P(c, x + 2, y + 2, GOLD); }
  else if (kind === 2) { R(c, x + 1, y + 1, w - 2, h - 2, '#f7f8fa'); R(c, x + 1, y + h - 2, w - 2, 1, RED); P(c, x + (w >> 1), y + 2, '#f6c9a0'); }
  else if (kind === 3) { R(c, x + 1, y + 1, w - 2, h - 2, '#1b2350'); P(c, x + 2, y + 2, '#ff4a3a'); P(c, x + w - 3, y + 3, BULB); }
  else if (kind === 4) { R(c, x + 1, y + 1, w - 2, h - 2, '#2f6fd0'); R(c, x + 1, y + h - 3, w - 2, 1, '#8fd0ff'); }
  else { R(c, x + 1, y + 1, w - 2, h - 2, '#3b3f48'); R(c, x + 2, y + 2, w - 4, 1, MG); }
}
defineTile(T('mon_u'), {
  solid: true, frames: 6, speed: 50, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#16171c'); R(c, 0, 0, 16, 1, '#2a2d36');
    tinyScreen(c, 1, 2, 7, 6, v, f); tinyScreen(c, 8, 2, 7, 6, v + 2, f);
    tinyScreen(c, 1, 9, 7, 6, v + 4, f); tinyScreen(c, 8, 9, 7, 6, v + 1, f);
  },
});
defineTile(T('mon'), {
  solid: true, frames: 6, speed: 50, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#16171c');
    tinyScreen(c, 1, 0, 7, 6, v + 3, f); tinyScreen(c, 8, 0, 7, 6, v + 5, f);
    R(c, 0, 7, 16, 5, '#22242a'); R(c, 2, 9, 3, 1, GRN); R(c, 7, 9, 2, 1, RED); R(c, 11, 9, 3, 1, MG);
    R(c, 0, 12, 16, 4, '#202228'); R(c, 0, 12, 16, 1, '#4a4e58');
  },
});
// Switcher / mixing console (talk to the staff over it).
defineTile(T('console'), {
  solid: true, obj: true, talkThrough: true, frames: 2, speed: 30, variants: 3,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 15, 8, 1);
    R(c, 0, 1, 16, 10, '#4a4e58'); R(c, 0, 1, 16, 1, '#6d7380'); R(c, 0, 10, 16, 1, '#2a2d36');
    R(c, 0, 11, 16, 4, '#3b3f48'); R(c, 0, 14, 16, 1, '#22242a');
    const lamp = ['#ff2b3a', GRN, GOLD, CYAN];
    if (v === 0) {
      for (let i = 0; i < 7; i++) { P(c, 1 + i * 2, 3, i === (f ? 2 : 4) ? lamp[0] : '#9aa0aa'); P(c, 1 + i * 2, 5, i === 3 ? lamp[1] : '#7d8391'); }
      R(c, 2, 7, 12, 2, '#2a2d36'); R(c, 3 + f * 4, 7, 2, 2, WHT);
    } else if (v === 1) {
      R(c, 3, 2, 10, 5, INK); R(c, 4, 3, 8, 3, f ? '#1d2650' : '#203a2a'); R(c, 5, 4, 2 + f * 3, 1, GRN);
      for (let i = 0; i < 4; i++) P(c, 3 + i * 3, 8, lamp[(i + f) % 4]);
    } else {
      for (let i = 0; i < 4; i++) { R(c, 2 + i * 4, 2, 1, 7, INK); R(c, 1 + i * 4, 3 + ((i + f) % 3) * 2, 3, 1, WHT); }
    }
  },
});
// Make-up mirror with bulbs (green room), 2 tiles tall.
function bulbsV(c, x, y0, y1) { for (let y = y0; y < y1; y += 3) P(c, x, y, BULB); }
defineTile(T('mir_u'), {
  solid: true,
  draw(c) {
    wallU(c);
    R(c, 1, 5, 14, 11, '#e8d9b8'); R(c, 2, 7, 12, 9, '#cfe8f5');
    for (let x = 2; x < 15; x += 3) P(c, x, 6, BULB);
    bulbsV(c, 1, 8, 16); bulbsV(c, 14, 8, 16);
    for (let i = 0; i < 4; i++) P(c, 4 + i, 13 - i, WHT);
  },
});
defineTile(T('mir'), {
  solid: true,
  draw(c) {
    wallL(c);
    R(c, 1, 0, 14, 11, '#e8d9b8'); R(c, 2, 0, 12, 9, '#cfe8f5');
    bulbsV(c, 1, 1, 10); bulbsV(c, 14, 1, 10);
    for (let x = 2; x < 15; x += 3) P(c, x, 10, BULB);
    for (let i = 0; i < 3; i++) P(c, 9 + i, 6 - i, WHT);
  },
});
// Wall monitor in the green room showing the studio feed.
defineTile(T('wtv'), {
  solid: true, obj: true, frames: 3, speed: 36,
  draw(c, r, f) {
    R(c, 1, 2, 14, 10, INK);
    R(c, 2, 3, 12, 8, '#f7f8fa'); R(c, 2, 9, 12, 2, RED);
    R(c, 4 + f, 5, 2, 3, NAVY); P(c, 4 + f, 4, '#f6c9a0');
    R(c, 9, 5, 2, 3, IMO); P(c, 9, 4, IMOF);
    if (f === 1) P(c, 12, 4, '#ff2b3a');
    R(c, 6, 12, 4, 1, '#4a4e58');
  },
});
defineTile(T('sfloor'), {
  variants: 8,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#2e3038');
    P(c, 3 + v, 5, '#34363f'); P(c, 11, 2 + v, '#292b32'); P(c, 7, 12, '#34363f');
    if (v === 1) { R(c, 6, 7, 4, 1, '#e8c43a'); R(c, 7, 6, 1, 3, '#e8c43a'); }
  },
});
defineTile(T('mat'), {
  draw(c) {
    R(c, 0, 0, 16, 16, REDX); R(c, 1, 1, 14, 14, '#d42a10');
    for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, '#ff5a3a');
  },
});

// ------------------------------------------------------------------ items
registerItem('bs_yoshimoto_imo', { name: 'ほっくり焼きいも', price: 300, desc: '体力が25回復する。\nほっくり町名物の、ほっくほくの焼きいも！', heal: 25 });
registerItem('bs_yoshimoto_hoshiimo', { name: 'ほっくり干しいも', price: 250, desc: '次の「トーク」のミニゲームが少しやさしくなる。\nかむほど味が出る、町の名物。', buff: 'talk' });
registerItem('bs_yoshimoto_kansha', { name: '特番の感謝状', price: 0, desc: 'BSよしもとの特番を大成功させた証。\n額に入れて飾りたい！' });

// ------------------------------------------------------------------ ほっくりん（ご当地キャラ）sprite
const IMO_BODY = [
  '........g..g........',
  '........gggg........',
  '.........gg.........',
  '.........GG.........',
  '......oooooooo......',
  '....oollllmmmmoo....',
  '...ollmmmmmmmmmMo...',
  '..olmmmmmmmmmmmmMo..',
  '..olmmmmmmmmmmmmMo..',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '.olmmmmmmmmmmmmmmMo.',
  '..olmmmmmmmmmmmmMo..',
  '..oMmmmmmmmmmmmmMo..',
  '...oMMmmmmmmmmMMo...',
  '....ooMMMMMMMMoo....',
];
const IMO_FACE = [
  '...ffffff...',
  '.ffffffffff.',
  'ffffffffffff',
  'fffeffffefff',
  'fffeffffefff',
  'fkkffrrffkkf',
  '.ffffffffff.',
  '...ffffff...',
];
const IMO_PAL = { o: IMOO, l: IMOL, m: IMO, M: IMOD, g: '#5ec466', G: '#3a8a3a', f: IMOF, e: INK, k: '#ff8fa0', r: '#c0392b' };
const mascotCache = new Map();
function mascotImg(dir, wave, step) {
  const key = `${dir}|${wave ? 1 : 0}|${step}`;
  let cv = mascotCache.get(key);
  if (cv) return cv;
  let c;
  [cv, c] = makeCanvas(20, 22);
  pix(c, IMO_BODY, IMO_PAL);
  if (dir !== 'up') {
    const dx = dir === 'left' ? -2 : dir === 'right' ? 2 : 0;
    pix(c, IMO_FACE, IMO_PAL, 4 + dx, 7);
  } else {
    R(c, 5, 8, 3, 1, IMOL); R(c, 4, 9, 1, 3, IMOL);
  }
  // たすき（ほっくり町）
  R(c, 3, 15, 14, 2, WHT);
  for (const x of [5, 8, 11, 14]) { P(c, x, 15, RED); P(c, x + 1, 16, RED); }
  // arms
  R(c, 0, 11, 2, 4, IMOO); R(c, 0, 12, 1, 2, IMO);
  if (wave) { R(c, 18, 6, 2, 5, IMOO); R(c, 19, 7, 1, 3, IMO); P(c, 18, 11, IMOO); } else { R(c, 18, 11, 2, 4, IMOO); R(c, 19, 12, 1, 2, IMO); }
  // feet
  const lf = step === 1 ? -1 : 0, rf = step === 2 ? -1 : 0;
  R(c, 5, 20 + lf, 4, 2, IMOO); R(c, 6, 20 + lf, 2, 1, IMOD);
  R(c, 11, 20 + rf, 4, 2, IMOO); R(c, 12, 20 + rf, 2, 1, IMOD);
  mascotCache.set(key, cv);
  return cv;
}
// e.sprite(ctx, x, y, g, e): x,y = screen position of the tile the mascot stands on.
function drawMascot(ctx, x, y, g, e) {
  if (e.fallen) {
    // lying on its side after a slapstick tumble (90° turns keep the pixels crisp)
    ctx.save();
    ctx.translate(Math.round(x) + 8, Math.round(y) + 7);
    ctx.rotate(e.fallen === 'left' ? -Math.PI / 2 : Math.PI / 2);
    ctx.drawImage(mascotImg('down', false, 0), -11, -10);
    ctx.restore();
    return;
  }
  const moving = !!e.moving;
  const step = moving ? [1, 0, 2, 0][Math.floor((e.anim || 0) / 8) % 4] : 0;
  const seed = (e.home ? e.home.x * 7 : 0);
  const bob = moving ? 0 : Math.floor((g.frame + seed) / 24) % 2;
  const wave = !moving && e.dir !== 'up' && Math.floor((g.frame + seed) / 45) % 3 === 0;
  ctx.drawImage(mascotImg(e.dir || 'down', wave, step), Math.round(x) - 2, Math.round(y) - 6 - bob);
}

// ------------------------------------------------------------------ little TV pictures (props)
// Draws a tiny program picture into (x, y, w, h). kind: mount sea fest field mascot set quiz live sp
function drawScene(ctx, x, y, w, h, kind, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const b = (xx, yy, ww, hh, col) => box(ctx, x + xx, y + yy, ww, hh, col);
  if (kind === 'mount') {
    b(0, 0, w, h, '#7cc8f8'); b(0, 0, w, 3, '#5ab6f0');
    b(w - 10, 3, 4, 4, '#ffe36e'); b(w - 11, 4, 6, 2, '#ffe36e');
    for (let i = 0; i < w; i++) {
      const hh = Math.max(0, Math.round(h * 0.75 - Math.abs(i - w * 0.42) * 0.9));
      b(i, h - hh, 1, hh, '#4a6aa8');
      if (hh > h * 0.55) b(i, h - hh, 1, 2, WHT);
    }
    b(0, h - 3, w, 3, '#5aa04a');
  } else if (kind === 'sea') {
    b(0, 0, w, h, '#a8dcf5'); b(0, Math.round(h * 0.45), w, h, '#2f6fd0');
    for (let k = 0; k < 3; k++) for (let i = -4; i < w; i += 8) b(i + ((t / 6 + k * 3) % 8), Math.round(h * 0.55) + k * 4, 4, 1, '#8fd0ff');
    const bx = ((t / 3) % (w + 14)) - 12;
    b(bx, Math.round(h * 0.45) - 2, 10, 3, WHT); b(bx + 1, Math.round(h * 0.45) + 1, 8, 1, '#3b3f48'); b(bx + 4, Math.round(h * 0.45) - 8, 1, 6, INK); b(bx + 5, Math.round(h * 0.45) - 7, 4, 4, '#ffe7a0');
  } else if (kind === 'fest') {
    b(0, 0, w, h, '#1b2350');
    const r = (t % 70) / 7;
    const fx = Math.round(w * 0.68), fy = Math.round(h * 0.32);
    for (let a = 0; a < 8; a++) b(fx + Math.round(Math.cos(a * 0.785) * r), fy + Math.round(Math.sin(a * 0.785) * r), 1, 1, a % 2 ? GOLD : '#ff7eb6');
    b(0, h - 10, w, 1, INK);
    for (let i = 0; i < 6; i++) { const lx = 2 + i * 7; b(lx, h - 9 + (i % 2), 4, 5, '#ff4a3a'); b(lx + 1, h - 8 + (i % 2), 2, 3, '#ffb27a'); }
    b(0, h - 3, w, 3, '#3a2a20');
  } else if (kind === 'field') {
    b(0, 0, w, h, '#bfe6ff');
    for (let k = 0; k < 5; k++) { b(0, 6 + k * 4, w, 4, k % 2 ? '#8acb6a' : '#74b85a'); b(0, 6 + k * 4, w, 1, '#a8dc84'); }
    b(Math.round(w * 0.3), 3, 1, 5, '#8a5a33'); b(Math.round(w * 0.3) - 2, 4, 5, 1, '#8a5a33'); b(Math.round(w * 0.3) - 1, 1, 3, 3, '#ffe0a0');
  } else if (kind === 'mascot') {
    b(0, 0, w, h, '#ffe9e3');
    for (let i = 0; i < w; i += 6) b(i, 0, 3, h, '#fff3ef');
    const img = mascotImg((Math.floor(t / 40) % 2) ? 'left' : 'down', Math.floor(t / 20) % 2 === 0, 0);
    ctx.drawImage(img, Math.round(x + w / 2 - 10), Math.round(y + h - 21 - (Math.floor(t / 14) % 2)));
  } else if (kind === 'set') {
    b(0, 0, w, h, '#f7f8fa'); b(0, 0, w, 3, REDD); b(0, h - 6, w, 6, RED);
    const cx = Math.round(w / 2);
    b(cx - 7, h - 13, 4, 7, NAVY); b(cx - 6, h - 16, 3, 3, '#f6c9a0');
    b(cx + 3, h - 13, 4, 7, WHT); b(cx + 4, h - 16, 3, 3, '#f6c9a0'); b(cx + 3, h - 7, 4, 1, RED);
    b(2, h - 5, 8, 1, WHT);
  } else if (kind === 'quiz') {
    b(0, 0, w, h, NAVY);
    for (let i = 0; i < w; i += 4) b(i, (i * 3 + Math.floor(t / 8)) % h, 1, 1, '#4a5a9a');
    text(ctx, '？', x + w / 2, y + h / 2 - 9, { size: 16, align: 'center', color: GOLD, shadow: '#1a2244' });
  } else if (kind === 'live') {
    b(0, 0, w, h, '#3a0f0a');
    b(0, 0, w, 2, RED); b(0, h - 2, w, 2, RED);
    if (Math.floor(t / 30) % 2 === 0) b(4, Math.round(h / 2) - 2, 4, 4, '#ff2b3a');
    text(ctx, 'LIVE', x + w / 2 + 3, y + h / 2 - 6, { size: 10, align: 'center', color: WHT, shadow: null });
  } else if (kind === 'sp') {
    b(0, 0, w, h, '#120f2e');
    for (let k = 0; k < 3; k++) {
      const r = ((t + k * 23) % 60) / 6;
      const fx = Math.round(w * (0.25 + k * 0.25)), fy = Math.round(h * (0.3 + (k % 2) * 0.2));
      for (let a = 0; a < 8; a++) b(fx + Math.round(Math.cos(a * 0.785) * r), fy + Math.round(Math.sin(a * 0.785) * r), 1, 1, [GOLD, '#ff7eb6', CYAN][k]);
    }
    b(0, h - 4, w, 4, RED);
  }
  ctx.restore();
}
function tvFrame(ctx, x, y, w, h) {
  box(ctx, x - 2, y - 2, w + 4, h + 4, '#16171c');
  box(ctx, x - 1, y - 1, w + 2, 1, '#3b3f48');
}

// ------------------------------------------------------------------ people
const WHO = {
  uketsuke: { name: '受付さん', look: { ...LOOKS.receptionist, top: RED, bottom: '#3b3f48' } },
  annai: { name: '番組案内係', look: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: RED, bottom: '#3b3f48' } },
  guard: { name: '警備員さん', look: LOOKS.guard },
  kanranAD: { name: '観覧受付のAD', look: { ...LOOKS.ad, top: RED, bottom: '#3b3f48' } },
  obaachan: { name: '観覧に来たおばあちゃん', look: LOOKS.oldwoman },
  mago: { name: 'おばあちゃんの孫', look: { ...LOOKS.kid, top: '#5fd7ff', bottom: '#2a3560' } },
  talent: { name: '若手タレント', look: { hair: 'spiky', hairColor: 'blonde', skin: 'light', top: '#5fd7ff', bottom: '#3a4a7a', jacket: true } },
  hokkurin: { name: 'ほっくりん', look: { hair: 'cap', hat: IMO, hairColor: IMO, skin: IMOF, top: IMO, bottom: IMO, shoes: IMOD } },
  amai: { name: 'ほっくり町の甘井さん', look: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: IMOD, jacket: true, tie: IMO } },
  fd: { name: 'フロアディレクター', look: { hair: 'cap', hat: RED, hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' } },
  mc: { name: '司会の陽向さん', look: { ...LOOKS.announcerM, hair: 'slick', hairColor: 'silver', tie: RED } },
  coh: { name: 'アシスタントの小春さん', look: { ...LOOKS.announcer, top: WHT, bottom: RED } },
  bijutsu: { name: '美術スタッフ', look: { ...LOOKS.staff, top: '#2f9a4a', hat: GOLD } },
  shoumei: { name: '照明さん', look: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#5a6f8a', bottom: '#3b3f48', glasses: true } },
  cameraman: { name: 'カメラマン', look: LOOKS.cameraman },
  jouren: { name: '常連の観覧客', look: { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' } },
  director: { name: 'ディレクター 熱田', look: { ...LOOKS.director, hat: RED } },
  producer: { name: 'プロデューサー', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#2e3140', jacket: true, glasses: true, tie: RED } },
  tk: { name: 'タイムキーパー', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#9273bd', bottom: '#2a2430', glasses: true } },
  td: { name: 'スイッチャー', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#3a4a7a', bottom: '#2a2d36' } },
  onsei: { name: '音声さん', look: { hair: 'afro', hairColor: 'black', skin: 'brown', top: '#2f9a4a', bottom: '#2a2d36' } },
  ad: { name: 'AD', look: LOOKS.ad },
  senpai: { name: '先輩アナ 澄川さん', look: { ...LOOKS.announcer, hair: 'long', hairColor: 'brown', top: '#f2f2f2', bottom: NAVY } },
  make: { name: 'メイクさん', look: LOOKS.makeup },
  geinin: { name: '若手芸人', look: LOOKS.comedian },
  stylist: { name: 'スタイリストさん', look: { hair: 'twin', hairColor: 'orange', skin: 'light', top: '#ff7eb6', bottom: '#2a2430', skirt: true } },
  sleepy: { name: 'お疲れのAD', look: { ...LOOKS.ad, hairColor: 'black', top: '#5a6f8a' } },
  idol: { name: 'アイドル', look: LOOKS.idol },
  geinin2: { name: 'ベテラン芸人', look: LOOKS.comedian2 },
  guest: { name: 'ゲスト', look: LOOKS.actress },
  aud: { name: 'お客さん', look: LOOKS.fan },
};

const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
// Talk wrapper that turns a seated / working NPC back to its post afterwards.
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
const lines = (who, list) => (g) => g.say(list, who);

// ------------------------------------------------------------------ minigame content
const LOKE_SCENES = [
  { prompt: '町の人「焼きいも、食べていって！」', answers: [{ text: 'あまーい！ほっくほく！', score: 100 }, { text: '…ふつうですね', score: 10 }, { text: 'カメラさんもどうぞ！', score: 60 }] },
  { prompt: 'ほっくりんが急におどりだした！', answers: [{ text: 'いっしょに踊ります！', score: 100 }, { text: '（見なかったことに）', score: 10 }, { text: 'キレがすごい！', score: 70 }] },
  { prompt: '一面の棚田。ここでひと言どうぞ！', answers: [{ text: '心が洗われますね…', score: 100 }, { text: '田んぼですね', score: 20 }, { text: 'ここで昼寝したい！', score: 60 }] },
  { prompt: 'おばあちゃん「若い人が来てうれしいねえ」', answers: [{ text: 'また会いに来ます！', score: 100 }, { text: '撮影中なので…', score: 10 }, { text: '若くないですよ〜', score: 50 }] },
  { prompt: '最後に、町の魅力をひと言！', answers: [{ text: 'ぜひ遊びに来て！', score: 100 }, { text: '…以上です', score: 10 }, { text: '焼きいも最高！', score: 70 }] },
];
const SP_SCENES = [
  { prompt: 'オープニング！会場はまだ少し緊張ぎみ…', answers: [{ text: 'みなさん、こんばんは！', score: 100 }, { text: 'えー…始めます', score: 20 }, { text: '（深々とおじぎ）', score: 40 }] },
  { prompt: '芸人「緊張で台本を家に忘れました！」', answers: [{ text: '全部アドリブで！', score: 100 }, { text: '取りに帰ってください', score: 30 }, { text: 'そうですか…', score: 10 }] },
  { prompt: '中継がつながらない！スタッフが大あわて', answers: [{ text: '先にクイズいきます！', score: 100 }, { text: '（無言で待つ）', score: 0 }, { text: 'どうしよう〜！', score: 30 }] },
  { prompt: 'ほっくりんがステージで転んだ！', answers: [{ text: 'ナイスリアクション！', score: 100 }, { text: '大丈夫ですか…？', score: 60 }, { text: '見なかったことに', score: 10 }] },
  { prompt: '視聴者からのお便りを紹介する時間！', answers: [{ text: '心をこめて読みます', score: 100 }, { text: 'あとで読みます', score: 20 }, { text: '字が読めません', score: 10 }] },
  { prompt: 'エンディングまで残り10秒！', answers: [{ text: '来年もお会いしましょう', score: 100 }, { text: 'えっ、もう？', score: 30 }, { text: '延長しましょう！', score: 20 }] },
];
const LESSON_SCENES = [
  { prompt: '先生「中継の第一声、どうする？」', answers: [{ text: '元気に場所を伝える', score: 100 }, { text: '小声でぼそっと', score: 10 }, { text: 'いきなり食べる', score: 40 }] },
  { prompt: '先生「食レポのコツは？」', answers: [{ text: '味を具体的に言う', score: 100 }, { text: '「おいしい」だけ', score: 30 }, { text: '無言でうなずく', score: 10 }] },
  { prompt: '先生「時間が押してる！どうする？」', answers: [{ text: '要点だけ伝える', score: 100 }, { text: 'ゆっくり話す', score: 20 }, { text: '気にしない', score: 10 }] },
];
const LIVE_WORDS = [
  { word: '山車', reading: 'だし', wrong: ['さんくるま', 'やまだし'], sentence: '秋祭りで、豪華な山車が町をめぐりました。' },
  { word: '神輿', reading: 'みこし', wrong: ['かみこし', 'じんよう'], sentence: '威勢のいいかけ声とともに、神輿が練り歩きます。' },
  { word: '棚田', reading: 'たなだ', wrong: ['ほうでん', 'たなた'], sentence: '山あいの棚田が、黄金色に輝いています。' },
  { word: '湯治', reading: 'とうじ', wrong: ['ゆじ', 'ゆうち'], sentence: '昔ながらの湯治場に、観光客が訪れています。' },
  { word: '漁火', reading: 'いさりび', wrong: ['りょうか', 'ぎょび'], sentence: '夜の海に、漁火が幻想的に浮かびました。' },
  { word: '囲炉裏', reading: 'いろり', wrong: ['いろうら', 'かこいろり'], sentence: '古民家の囲炉裏で、川魚を焼いていただきます。' },
  { word: '暖簾', reading: 'のれん', wrong: ['だんれん', 'なんれん'], sentence: '老舗の和菓子店が、新しい暖簾をかけました。' },
  { word: '提灯', reading: 'ちょうちん', wrong: ['ていとう', 'さげび'], sentence: '商店街に、たくさんの提灯がともりました。' },
  { word: '流鏑馬', reading: 'やぶさめ', wrong: ['りゅうてきば', 'ながれうま'], sentence: '神社の境内で、伝統の流鏑馬が奉納されました。' },
  { word: '法被', reading: 'はっぴ', wrong: ['ほうかぶ', 'のりかぶ'], sentence: 'そろいの法被を着た子どもたちが、元気に踊ります。' },
  { word: '蒲鉾', reading: 'かまぼこ', wrong: ['がまほこ', 'ほぼう'], sentence: '港町の名物、手作りの蒲鉾が人気です。' },
  { word: '旅籠', reading: 'はたご', wrong: ['りょろう', 'たびかご'], sentence: '江戸時代の旅籠を改装した宿が開業しました。' },
];

// ------------------------------------------------------------------ jobs
const JOBS = {
  quiz: {
    label: 'ご当地クイズの解答者', mode: 'quiz',
    info: '『ニッポンご当地クイズ』に解答者で出演！\n事務所所属か★30〜／体力-20',
    def: { id: 'bs_yoshimoto_quiz', title: 'ご当地クイズ番組の解答者', desc: '全国のご当地問題に答える人気番組！', stamina: 20, minigame: 'quiz', opts: { category: 'japan', difficulty: 2, show: 'ニッポンご当地クイズ' }, pay: 4500, fame: 18, skill: 'talk', gain: 2, requires: { anyOf: [{ agency: true }, { fame: 30 }] } },
  },
  loke: {
    label: 'ロケ番組のリポーター', mode: 'loke',
    info: '地方の町をたずねて魅力を伝えるロケ！\n★250〜／体力-25',
    def: { id: 'bs_yoshimoto_loke', title: '地域密着ロケ番組のリポーター', desc: 'ほっくり町の魅力を全国に伝えよう！', stamina: 25, minigame: 'talk', opts: { difficulty: 3, topic: 'local', scenes: LOKE_SCENES }, pay: 12000, fame: 45, skill: 'talk', gain: 3, requires: { fame: 250 } },
  },
  live: {
    label: '生放送の情報番組MC', mode: 'live',
    info: '朝の生放送でニュース原稿を読もう！\n★1000〜／体力-25',
    def: { id: 'bs_yoshimoto_live', title: '生放送の情報番組MC', desc: 'やり直しのきかない生放送！', stamina: 25, minigame: 'announce', opts: { difficulty: 4, words: LIVE_WORDS, set: 'morning', show: 'ニッポン元気ライブ' }, pay: 30000, fame: 110, skill: 'talk', gain: 3, requires: { fame: 1000 } },
  },
  special: {
    label: '特番の総合司会', mode: 'special',
    info: '秋の大型特番を総合司会で仕切る！\n★2000〜・1日1本／体力-30',
    def: { id: 'bs_yoshimoto_special', title: '特番の総合司会', desc: '全国をつなぐ大型特番の顔！', stamina: 30, minigame: 'talk', opts: { difficulty: 5, topic: '特番の総合司会', scenes: SP_SCENES }, pay: 65000, fame: 220, skill: 'talk', gain: 4, requires: { fame: 2000 } },
  },
};
const JOB_KEYS = ['quiz', 'loke', 'live', 'special'];

// Studio state while a show is staged (controls the extra NPCs, lamps and lights).
let show = null; // null | 'kanran' | 'quiz' | 'live' | 'special'
let onAir = false;
let party = false;
let ledOverride = null; // forces the right-hand studio screen (e.g. the 中継 picture)

// ------------------------------------------------------------------ helpers
const today = (g, k) => g.flag(k) === g.state.day;
function here(g) {
  const p = g.map.player;
  return { room: g.map.roomId, x: p.x, y: p.y, dir: p.dir };
}
function confirmText(def) {
  return `${def.desc}\n「${def.title}」\n${payText(def.pay)}／体力 -${def.stamina}・ストレス +${ACTIVITY.job.stress}`;
}
const quizOk = (g) => !!g.state.agency || g.state.fame >= 30;

function lockLabel(g, key) {
  const st = g.state;
  if (key === 'quiz') return quizOk(g) ? null : '所属か★30〜';
  if (key === 'special' && st.fame >= 2000 && today(g, 'bs_yoshimoto_sp_day')) return '本日終了';
  const r = JOBS[key].def.requires || {};
  if (r.fame && st.fame < r.fame) return `★${r.fame}〜`;
  return null;
}

// Returns true when the job can be offered now (and explains why not otherwise).
async function canDo(g, key, who) {
  if (key === 'quiz' && !quizOk(g)) {
    await g.say(['解答者さんは、事務所に所属している人か\n★30以上の人にお願いしているんです。', `（いまは★${g.state.fame}）\nまずは番組観覧で、テレビの空気に慣れてみてね！`], who);
    return false;
  }
  const need = (JOBS[key].def.requires || {}).fame || 0;
  if (g.state.fame < need) {
    const now = `（いまは★${g.state.fame}）`;
    const rough = who === WHO.director;
    const msg = {
      loke: rough ? [`ロケのリポーターは、★${need}からお願いしてるんだ。`, `${now}\nまずはクイズ番組で、カメラに慣れてこい！`] : [`ロケのリポーターは、★${need}からお願いしています。`, `${now}\nまずはクイズ番組で、カメラに慣れてくださいね。`],
      live: rough ? [`生放送のMCは、★${need}からだな。`, `${now}\nロケで場数を踏んでから、また来てくれ！`] : [`生放送のMCは、★${need}からお願いしています。`, `${now}\nロケで場数を踏んでから、ぜひ！`],
      special: [`特番の総合司会は、\n★${need}の人気者にお願いしています。`, `${now}\n生放送のMCで、腕を磨いてくださいね！`],
    }[key];
    await g.say(msg, who);
    return false;
  }
  const why = g.checkRequires(JOBS[key].def.requires);
  if (why) { await g.say(why); return false; }
  if (key === 'special' && today(g, 'bs_yoshimoto_sp_day')) {
    await g.say('今日の特番は、もう放送しましたよ。\n特番は1日1本まで！また明日お願いします！', who);
    return false;
  }
  // 活動自粛 / a TV ban (justice core), the campaign / a cabinet post (politics core), burnout /
  // starving: refuse before the bus ride or the studio intro (g.job would only refuse after it)
  const def = { ...JOBS[key].def };
  const ban = (typeof g.justiceRefusal === 'function' && g.justiceRefusal('job', def)) || (typeof g.politicsRefusal === 'function' && g.politicsRefusal('job', def)) || null;
  if (ban) { await g.say(ban); return false; }
  const tired = g.lifeRefusal();
  if (tired) { await g.say(tired); return false; }
  return true;
}

function hintFor(g, byProducer = false) {
  const st = g.state;
  if (!st.agency && st.fame < 30) {
    return [
      '番組観覧なら、だれでも無料で参加できます！\nロビーの観覧受付のADさんへどうぞ。',
      '事務所に所属するか★30になったら、\nご当地クイズ番組の解答者に出られますよ。',
      '事務所のオーディションは、おとなりの\nよしもと東京本部などで受けられます。\n街の事務所を回ってみてくださいね！',
    ];
  }
  if (st.fame < 250) return ['スタジオのフロアディレクターに声をかけて、\nクイズ番組の解答者に出てみよう！', '★250になったら、副調整室の\nディレクターがロケを任せてくれるかも。'];
  if (st.fame < 1000) return '副調整室のディレクターに頼んで、\nロケ番組で全国の魅力を伝えよう！\n★1000になったら、生放送のMCも夢じゃない！';
  if (st.fame < 2000) return '生放送の情報番組MCで、原稿読みの腕を磨こう！\n★2000になれば、特番の総合司会も夢じゃない！';
  if (byProducer) return ['特番の総合司会、いつでもお任せしたいです！\n「お仕事リスト」からどうぞ。', '国民的スター（★4000）まで、\nもうひと息ですよ！'];
  return '特番の総合司会は、副調整室の\nプロデューサーから、いつでも！\n国民的スター（★4000）まで、もうひと息！';
}

const AUD_IDS = ['bsy_jouren', 'bsy_aud1', 'bsy_aud2', 'bsy_aud3', 'bsy_aud4', 'bsy_aud5', 'bsy_aud6', 'bsy_aud7', 'bsy_aud8', 'bsy_aud9', 'bsy_aud10', 'bsy_aud11'];
async function crowd(g, kind, frames = 50) {
  await Promise.all(AUD_IDS.map((id, i) => g.emote(id, Array.isArray(kind) ? kind[i % kind.length] : kind, frames)));
}
async function crowdReact(g, res) {
  if (res.rank === 'S' || res.rank === 'A') {
    g.sfx('applause');
    await crowd(g, ['!', '♥', '♪']);
  } else if (res.rank === 'B') {
    g.sfx('applause');
    await crowd(g, '♪');
  } else {
    g.sfx('laugh');
    await crowd(g, ['w', '…']);
  }
}
async function countdown(g, who = WHO.fd) {
  await g.say('本番いきまーす！\n5秒前、4、3…', who);
  for (let k = 0; k < 2; k++) { g.sfx('snare'); await g.wait(260); }
  onAir = true;
  g.sfx('chime');
  await g.wait(200);
}

// ------------------------------------------------------------------ confetti & cards
const CONFETTI = [GOLD, RED, '#ff7eb6', CYAN, GRN, WHT];
function drawConfetti(ctx, frame, n = 70) {
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + (i % 5) * 0.22;
    const x = ((i * 53) % (W + 20)) - 10 + Math.sin((frame + i * 17) / 18) * 6;
    const y = ((frame * sp + i * 37) % (H + 20)) - 10;
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.fillRect(Math.round(x), Math.round(y), (Math.floor((frame + i * 7) / 8) % 2) ? 2 : 3, 2);
  }
}
function partyCard(g, title, sub) {
  return new Promise((resolve) => {
    const scene = {
      t: 0,
      update(gg) {
        scene.t++;
        if (gg.auto || scene.t > 260 || (scene.t > 40 && (gg.input.pressed('a') || gg.input.pressed('b')))) { gg.pop(scene); resolve(); }
      },
      draw(ctx, gg) {
        drawConfetti(ctx, gg.frame, 110);
        const k = Math.min(1, scene.t / 14);
        const h = Math.round(74 * k);
        panel(ctx, 36, 84 - h / 2, W - 72, Math.max(8, h), { bg: REDX, edge: GOLD });
        if (k >= 1) {
          text(ctx, title, W / 2, 56, { size: 24, align: 'center', color: GOLD, outline: '#3a0a04' });
          text(ctx, sub, W / 2, 94, { size: 12, align: 'center', color: WHT, shadow: '#3a0a04' });
        }
      },
    };
    g.push(scene);
  });
}

// ------------------------------------------------------------------ studio shows
async function toStudio(g, mode, spot) {
  const origin = here(g);
  show = mode;
  onAir = false;
  party = false;
  await g.fadeOut();
  await g.goto(PID, 'studio', spot.x, spot.y, spot.dir, { fade: false });
  await g.fadeIn();
  return origin;
}
async function backFrom(g, origin) {
  await g.fadeOut();
  ledOverride = null;
  show = null;
  onAir = false;
  party = false;
  await g.goto(PID, origin.room, origin.x, origin.y, origin.dir, { fade: false });
  await g.fadeIn();
}

const SPOT = {
  kanran: { x: 6, y: 10, dir: 'up' },
  quiz: { x: 14, y: 3, dir: 'down' },
  live: { x: 9, y: 3, dir: 'down' },
  special: { x: 9, y: 5, dir: 'down' },
};

async function introQuiz(g) {
  await g.say(['解答者のみなさん、スタンバイお願いしまーす！', 'ボタンの位置、確認しておいてくださいね！'], WHO.fd);
  await countdown(g);
  g.sfx('fanfare');
  await g.say(['全国のご当地を、クイズで旅しよう！\n『ニッポンご当地クイズ』！', '本日の解答者は、この3人！\nまんなかの席は{name}さんです！'], WHO.mc);
  g.sfx('applause');
  await Promise.all([g.emote('bsy_q1', '♪'), g.emote('bsy_q2', '!'), crowd(g, '♪', 40)]);
  await g.say('では、第1問！', WHO.mc);
}
async function outroQuiz(g, res) {
  const good = res.rank === 'S' || res.rank === 'A';
  if (good) {
    g.sfx('success');
    await g.say('お見事！本日のトップ解答者は\n{name}さんです！おめでとう！', WHO.mc);
    await Promise.all([g.emote('bsy_q1', '!'), g.emote('bsy_q2', '!')]);
    await g.say('くやし〜！ご当地のこと、くわしすぎ！', { name: 'となりの解答者', look: WHO.idol.look });
  } else if (res.rank === 'B') {
    await g.say('ナイスファイト！\nいい勝負でしたね〜！', WHO.mc);
  } else {
    g.sfx('laugh');
    await g.say('ドンマイ！次はご当地の名物を\nたっぷり予習してきてね〜！', WHO.mc);
  }
  await crowdReact(g, res);
  onAir = false;
  await g.say('はい、OKでーす！\n解答者のみなさん、おつかれさまでした！', WHO.fd);
}

async function introLive(g) {
  await g.say(['生放送、本番1分前でーす！', 'ここからはやり直しがききません。\n落ち着いていきましょう！'], WHO.fd);
  await g.say('{name}さん、深呼吸、深呼吸…。\nいっしょにがんばりましょうね！', WHO.coh);
  await countdown(g);
  await g.say(['おはようございます！\n『ニッポン元気ライブ』の時間です！', '今朝も、全国の元気な話題をお届けします。\nMCは{name}さんです！'], WHO.coh);
  await g.say('さっそくニュースです。\n読みのむずかしい言葉に気をつけて…！', WHO.coh);
}
async function outroLive(g, res) {
  const good = res.rank === 'S' || res.rank === 'A';
  await g.say(good ? 'すらすら読めましたね！\nさすが{name}さんです！' : res.rank === 'B' ? 'ばっちりでしたね！\n次は、中継のコーナーです！' : 'ちょっと噛んじゃいましたね…ドンマイ！\n…では、中継のコーナーです！', WHO.coh);
  await g.say('ほっくり町のほっくりんさ〜ん！', WHO.coh);
  ledOverride = 'mascot';
  g.sfx('chime');
  await g.say('大型ビジョンに、焼きいもをほおばる\nほっくりんが映った！');
  await g.say('ほっくほくだいも〜！\nけさのほっくり町は、快晴だいも〜！', WHO.hokkurin);
  g.sfx('laugh');
  await crowd(g, 'w', 40);
  ledOverride = null;
  await g.say('以上、『ニッポン元気ライブ』でした！\nまた明日の朝、お会いしましょう！', WHO.coh);
  onAir = false;
  await g.say('はい、CM入りました！…放送終了です！\nおつかれさまでしたー！', WHO.fd);
}

async function introSpecial(g) {
  g.placeNpc('bsy_coh', 8, 5, 'down');
  g.placeNpc('bsy_st_hok', 6, 4, 'down');
  await g.say(['特番、まもなく本番です！', '総合司会の{name}さん、センターへどうぞ！'], WHO.fd);
  await countdown(g);
  g.sfx('fanfare');
  g.shake(10, 1);
  await g.say(['BSよしもと、秋の大型特番！\n『全国ふるさと笑顔まつり』！', '総合司会は、もちろんこの方！\n{name}さんです！'], WHO.coh);
  g.sfx('applause');
  await Promise.all([crowd(g, ['♥', '!', '♪']), g.emote('bsy_st_hok', '♪'), g.emote('bsy_g_idol', '♥'), g.emote('bsy_g_geinin', '!')]);
  await g.say('全国のみなさんと、笑顔でつながる3時間！\n最後まで、よろしくお願いしまーす！', WHO.coh);
}
async function outroSpecial(g, res) {
  const good = res.rank === 'S' || res.rank === 'A';
  if (res.rank === 'C' || res.rank === 'D') {
    await g.say('ハプニングもありましたが…\nそれも特番の楽しさ！ありがとうございました！', WHO.coh);
    onAir = false;
    await g.say('はい、OKです！おつかれさまでした！\n…次はもっと盛り上げましょう！', WHO.fd);
    return;
  }
  await g.say('全国のみなさん、ありがとうございました！\nまた来年お会いしましょう〜！', WHO.coh);
  onAir = false;
  g.sfx('applause');
  await crowdReact(g, res);
  await g.say('はい、OKでーす！！\n特番、無事に終了でーす！！', WHO.fd);
  if (good) {
    party = true;
    g.sfx('fanfare');
    await partyCard(g, '大成功！！', g.fmt('総合司会 {name}'));
  }
  // the producer runs onto the set, the mascot hops over
  g.showNpc('bsy_pd_show', true);
  await Promise.all([g.walkNpcTo('bsy_pd_show', 10, 5, 2), g.walkNpcTo('bsy_st_hok', 7, 5, 1.5)]);
  await g.moveNpc('bsy_pd_show', 'face:left');
  await g.moveNpc('bsy_st_hok', 'face:right');
  g.facePlayer('right');
  await Promise.all([g.emote('bsy_pd_show', '!'), g.emote('bsy_st_hok', '♥')]);
  await g.say(good ? ['{name}さん、最高の特番でした！', '視聴者のみなさんから、もう感想が\nどんどん届いてますよ！'] : ['{name}さん、おつかれさまでした！', '長丁場の生特番、しっかり仕切ってくれましたね！'], WHO.producer);
  await g.say('ほっくり町のみんなも、\nテレビの前で大よろこびだいも〜！', WHO.hokkurin);
  if (!g.flag('bs_yoshimoto_sp_star')) {
    g.setFlag('bs_yoshimoto_sp_star');
    await g.say('これは、BSよしもとからの感謝のしるしです。\nこれからも、全国に笑顔を届けてください！', WHO.producer);
    g.sfx('fanfare');
    g.giveItem('bs_yoshimoto_kansha', 1, true);
    await g.say('「特番の感謝状」をもらった！');
  }
  g.facePlayer('down');
}

const INTRO = { quiz: introQuiz, live: introLive, special: introSpecial };
const OUTRO = { quiz: outroQuiz, live: outroLive, special: outroSpecial };

async function runStudioJob(g, key, who) {
  const st = g.state;
  const j = JOBS[key];
  if (!(await canDo(g, key, who))) return null;
  const i = await g.ask(confirmText(j.def), ['受ける', 'やめておく'], who);
  if (i !== 0) return null;
  if (st.stamina < j.def.stamina) {
    await g.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
    return null;
  }
  const origin = await toStudio(g, j.mode, SPOT[j.mode]);
  let res = null;
  try {
    await INTRO[key](g);
    res = await g.job({ ...j.def, confirm: false });
    if (res) {
      if (key === 'special') g.setFlag('bs_yoshimoto_sp_day', st.day);
      await OUTRO[key](g, res);
    }
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
  return res;
}

// ------------------------------------------------------------------ location shoot (ロケ)
function lokeScene(g) {
  const me = charSheet(g.state.look || {});
  const ama = charSheet(WHO.amai.look);
  const cam = charSheet(LOOKS.cameraman);
  const town = [LOOKS.oldwoman, LOOKS.oldman, LOOKS.kid, LOOKS.mom].map((l) => charSheet(l));
  return {
    opaque: true,
    update() {},
    draw(ctx, gg) {
      const t = gg.frame;
      // sky & mountains
      box(ctx, 0, 0, W, 96, '#8fd0ff'); box(ctx, 0, 0, W, 22, '#6fc0f5');
      for (let i = 0; i < 3; i++) { const cx = ((i * 120 + t / 5) % (W + 60)) - 30; box(ctx, cx, 14 + i * 8, 28, 6, WHT); box(ctx, cx + 6, 10 + i * 8, 14, 5, WHT); }
      for (let x = 0; x < W; x++) {
        const h1 = Math.round(40 + 14 * Math.sin(x / 41) + 7 * Math.sin(x / 17 + 1));
        box(ctx, x, 92 - h1, 1, h1, '#6a9ac8');
        const h2 = Math.round(22 + 9 * Math.sin(x / 29 + 2));
        box(ctx, x, 92 - h2, 1, h2, '#4f8a5a');
      }
      // terraced rice fields
      for (let k = 0; k < 4; k++) { box(ctx, 0, 88 + k * 8, W, 8, k % 2 ? '#9ad070' : '#86c260'); box(ctx, 0, 88 + k * 8, W, 1, '#c4e8a0'); }
      // ground & road
      box(ctx, 0, 120, W, 120, '#d9c79a'); box(ctx, 0, 120, W, 2, '#bfa878');
      for (let i = 0; i < 18; i++) box(ctx, (i * 41) % W, 128 + (i * 23) % 100, 2, 1, '#c8b488');
      // welcome sign
      box(ctx, 20, 96, 3, 30, '#8a5a33'); box(ctx, 104, 96, 3, 30, '#8a5a33');
      box(ctx, 4, 80, 120, 22, '#6e4428'); box(ctx, 6, 82, 116, 18, '#fff6e0');
      text(ctx, 'ようこそ ほっくり町へ', 64, 85, { size: 10, align: 'center', color: IMOD, shadow: null });
      // sweet-potato stall
      const sx = 214;
      box(ctx, sx, 84, 70, 6, '#d62f2f'); for (let k = 0; k < 7; k++) box(ctx, sx + k * 10, 90, 10, 4, k % 2 ? WHT : '#d62f2f');
      box(ctx, sx + 4, 94, 62, 30, '#8a5a33'); box(ctx, sx + 6, 96, 58, 10, '#3b2a20');
      for (let k = 0; k < 4; k++) { box(ctx, sx + 9 + k * 14, 98, 10, 5, IMO); box(ctx, sx + 9 + k * 14, 98, 10, 1, IMOL); }
      text(ctx, 'やきいも', sx + 35, 108, { size: 10, align: 'center', color: '#fff6a8', shadow: '#3a1a0a' });
      for (let k = 0; k < 3; k++) { const yy = 78 - ((t / 2 + k * 9) % 26); box(ctx, sx + 20 + k * 12 + Math.round(Math.sin((t + k * 30) / 12) * 2), yy, 3, 3, 'rgba(255,255,255,0.6)'); }
      // villagers
      drawChar(ctx, town[3], 'right', 0, 40, 124);
      drawChar(ctx, town[0], 'right', 0, 70, 120);
      drawChar(ctx, town[1], 'down', 0, 234, 128);
      drawChar(ctx, town[2], 'left', Math.floor(t / 20) % 2, 268, 136);
      // the crew: town official, reporter, mascot, camera
      drawChar(ctx, ama, 'right', 0, 104, 128);
      drawChar(ctx, me, 'down', 0, 128, 128);
      box(ctx, 140, 136, 2, 5, '#3b3f48'); box(ctx, 139, 133, 4, 4, INK);
      ctx.drawImage(mascotImg('down', Math.floor(t / 30) % 2 === 0, 0), 148, 122 - (Math.floor(t / 16) % 2));
      drawChar(ctx, cam, 'up', 0, 176, 148);
      box(ctx, 172, 140, 9, 7, '#3b3f48'); box(ctx, 170, 141, 3, 5, INK); box(ctx, 178, 139, 2, 1, '#ff2b3a');
    },
  };
}

async function runLoke(g, who) {
  const st = g.state;
  const j = JOBS.loke;
  if (!(await canDo(g, 'loke', who))) return null;
  const i = await g.ask(confirmText(j.def), ['受ける', 'やめておく'], who);
  if (i !== 0) return null;
  if (st.stamina < j.def.stamina) {
    await g.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。');
    return null;
  }
  await g.say('よし、ロケバスで出発だ！\n行き先は、ほっくり町！', WHO.director);
  await g.fadeOut();
  const bd = lokeScene(g);
  g.push(bd);
  await g.fadeIn();
  let res = null;
  try {
    g.sfx('chime');
    await g.say('ロケバスにゆられて、ほっくり町にやってきた！\n空気がおいしい！');
    await g.say(['ようこそ、ほっくり町へ！観光課の甘井です。', '町のいいところ、たっぷり紹介してくださいね！'], WHO.amai);
    await g.say('いらっしゃいだいも〜！\nほっくりんが案内するいも〜！', WHO.hokkurin);
    await g.say('はい、カメラ回りました！\nリポート、どうぞ！', WHO.director);
    res = await g.job({ ...j.def, confirm: false });
    if (res) {
      const good = res.rank === 'S' || res.rank === 'A';
      if (good) g.sfx('applause');
      await g.say(good ? 'カット！最高の画が撮れました！\n町の魅力、ばっちり伝わりますよ！' : res.rank === 'B' ? 'カット！いいロケでした！\nおつかれさまです！' : 'カット！…ま、まあ編集でなんとかします！\nまた来ましょう！', WHO.director);
      if (!g.flag('bs_yoshimoto_loke_gift')) {
        g.setFlag('bs_yoshimoto_loke_gift');
        await g.say('ありがとうございました！\nこれ、町のみんなからのお礼です！', WHO.amai);
        g.sfx('good');
        g.giveItem('bs_yoshimoto_hoshiimo', 2, true);
        await g.say('「ほっくり干しいも」を2つもらった！');
      } else {
        await g.say(good ? '放送が楽しみだいも〜！\nまた来てほしいいも〜！' : 'また遊びに来てほしいいも〜！', WHO.hokkurin);
      }
    }
  } catch (e) {
    console.error(e);
  }
  await g.fadeOut();
  g.pop(bd);
  await g.fadeIn();
  return res;
}

const runAny = (g, key, who) => (key === 'loke' ? runLoke(g, who) : runStudioJob(g, key, who));

// ------------------------------------------------------------------ 番組観覧 (tier 0, free, once a day)
const AUD_QUIZ = [
  { q: '日本でいちばん高い山は？', a: '富士山', w: ['北岳', '浅間山'] },
  { q: '日本でいちばん大きい湖は？', a: '琵琶湖', w: ['霞ヶ浦', '十和田湖'] },
  { q: 'りんごの生産量が日本一の県は？', a: '青森県', w: ['沖縄県', '高知県'] },
];

async function kanranMascot(g) {
  await g.say('今日のゲストは、ほっくり町から\nはるばる来てくれた、この方！', WHO.mc);
  g.sfx('drum');
  g.placeNpc('bsy_st_hok', 3, 3, 'right');
  g.showNpc('bsy_st_hok', true);
  await g.walkNpcTo('bsy_st_hok', 7, 3, 1.5);
  await g.moveNpc('bsy_st_hok', 'face:down');
  await g.say('ほっくりんだいも〜！\nみんな、よろしくいも〜！', WHO.hokkurin);
  await crowd(g, ['♥', '♪'], 40);
  await g.say('さっそく、ほっくり町に伝わる\n「ほっくり体操」をお願いします！', WHO.mc);
  for (const step of ['face:left', 'face:right', 'face:left', 'face:right']) {
    g.sfx('snare');
    await g.moveNpc('bsy_st_hok', step);
    await g.wait(180);
  }
  await g.moveNpc('bsy_st_hok', 'right left', 1.5);
  await g.emote('bsy_st_hok', '♪', 30);
  const hok = g.npc('bsy_st_hok');
  g.sfx('zukko');
  if (hok) hok.fallen = 'right';
  g.shake(12, 2);
  await g.emote('bsy_st_hok', '…', 40);
  await g.say('だ、大丈夫ですか！？', WHO.coh);
  if (hok) hok.fallen = false;
  g.sfx('hit');
  await g.emote('bsy_st_hok', '!', 30);
  await g.say('ほっくり町の坂道は、\nもっと急だいも〜！', WHO.hokkurin);
  g.sfx('laugh');
  await crowd(g, 'w', 50);
  await g.say('ほっくり町は、焼きいもと星空がじまん！\nみなさんも、ぜひ遊びに行ってくださいね！', WHO.mc);
}
async function kanranQuiz(g) {
  await g.say(['今日は、観覧席のみなさんにも\nご当地クイズです！', 'そこのあなた！…そう、{name}さん！'], WHO.mc);
  await g.emote('player', '!');
  const q = pick(AUD_QUIZ);
  const choices = shuffle([q.a, ...q.w]);
  const k = await g.ask(q.q, choices, { ...WHO.mc, cancel: choices.length - 1 });
  if (choices[k] === q.a) {
    g.sfx('success');
    await g.say('ピンポーン！大正解！\nみなさん、拍手〜！', WHO.mc);
    g.sfx('applause');
    await crowd(g, '!', 40);
  } else {
    g.sfx('buzz');
    await g.say(`ブッブー！正解は「${q.a}」でした〜！\nでも、ナイスチャレンジ！`, WHO.mc);
    g.sfx('laugh');
    await crowd(g, 'w', 40);
  }
}

async function kanranEvent(g, who) {
  const st = g.state;
  if (today(g, 'bs_yoshimoto_kanran_day')) {
    await g.say('今日の番組観覧は、もう終わっちゃいました。\nまた明日来てくださいね！', who);
    return;
  }
  const origin = await toStudio(g, 'kanran', SPOT.kanran);
  try {
    g.showNpc('bsy_st_hok', false); // waits in the wings until the MC calls it on
    g.setFlag('bs_yoshimoto_kanran_day', st.day);
    await g.say('観覧のみなさん、本日はようこそ！\n本番前に、拍手の練習をしまーす！', WHO.fd);
    await g.say('大きな拍手、お願いしまーす！\nせーの！');
    g.sfx('applause');
    await crowd(g, '♪', 40);
    await g.say('いいですね〜！\nその調子で、本番もお願いします！', WHO.fd);
    await countdown(g);
    await g.say(['始まりました！\n『ご当地ほっこりTV』！', '今日も全国の、ほっこりする話題を\nお届けしますよ〜！'], WHO.mc);
    if (pick([0, 1]) === 0) await kanranMascot(g);
    else await kanranQuiz(g);
    await g.say('それでは、また来週〜！', WHO.mc);
    g.sfx('applause');
    await crowd(g, ['♪', '♥'], 40);
    onAir = false;
    await g.say('はい、OKでーす！\n観覧のみなさん、ありがとうございました！', WHO.fd);
    g.addSkill('talk', 1, true);
    g.sfx('good');
    await g.say('プロのトークを間近で見て、\n話の「間」が少しわかった気がする！\n（トーク +1・1日1回）');
  } catch (e) {
    console.error(e);
  }
  await backFrom(g, origin);
}

// ------------------------------------------------------------------ lobby people
async function welcome(g) {
  g.setFlag('bs_yoshimoto_welcome');
  await g.wait(250);
  await g.emote('bsy_uketsuke', '!');
  const p0 = g.map.player;
  if (p0.x === 9 && p0.y === 11) await g.movePlayer('up up up up up up');
  await g.say('いらっしゃいませ！\nBSよしもとへ、ようこそ！', WHO.uketsuke);
  g.sfx('chime');
  await g.showLogo(PID, 'BSよしもと');
  await g.say([
    'BSよしもとは、全国の地域の魅力と\nお笑いを発信する、BSのテレビ局です。',
    '右手の扉の先がメインスタジオ。\n番組観覧なら、だれでも参加できますよ！',
  ], WHO.uketsuke);
  const p = g.map.player;
  g.sfx('good');
  await g.emote('bsy_hokkurin', '!');
  await g.walkNpcTo('bsy_hokkurin', p.x - 1, p.y, 1.5);
  const m = g.npc('bsy_hokkurin');
  if (m && m.x === p.x - 1 && m.y === p.y) { m.dir = 'right'; g.facePlayer('left'); }
  await g.say(['はじめましてだいも〜！', 'ほっくり町からPRに来た、\nご当地キャラの「ほっくりん」だいも！'], WHO.hokkurin);
  await g.emote('bsy_hokkurin', '♪');
  await g.say('ほっくり町のブースにも、\nあそびに来てほしいいも〜！', WHO.hokkurin);
  await g.walkNpcTo('bsy_hokkurin', 5, 10, 1.5);
  g.placeNpc('bsy_hokkurin', 5, 10, 'down');
  g.facePlayer('up');
}

async function uketsukeTalk(g) {
  const who = WHO.uketsuke;
  const i = await g.ask('BSよしもとへ、ようこそ！\nご用件をどうぞ♪', ['館内案内', 'BSよしもとって？', '次は何を？', 'またね'], who);
  if (i === 0) {
    await g.say([
      '右手の大きな扉がメインスタジオ。\n番組の収録や生放送をしています。',
      'スタジオの奥の扉は副調整室。\nディレクターとプロデューサーがいますよ。',
      '左手の木の扉は控室です。\nメイクさんや先輩アナがいますよ。',
    ], who);
  } else if (i === 1) {
    await g.say([
      'BSよしもとは、日本全国の地域の魅力を\n発信する、BSのテレビ局です。',
      'もちろん、お笑いもたっぷり！\n各地の人や名物を、楽しく紹介しています。',
      'おとなりの、よしもと東京本部の芸人さんたちも、\nよく遊びに来てくれるんですよ。',
    ], who);
  } else if (i === 2) {
    await g.say(hintFor(g), who);
  } else {
    await g.say('いってらっしゃいませ！', who);
  }
}

const PROGRAMS = [
  '『ご当地ほっこりTV』\n全国のほっこりする話題とゲストのトーク番組。\nスタジオで観覧できます！',
  '『ニッポンご当地クイズ』\n全国のご当地問題に、解答者が挑むクイズ番組です。',
  '『ふるさと ぶらり発見』\n地方の町をたずねて、魅力を伝えるロケ番組です。',
  '『ニッポン元気ライブ』\n朝の生放送の情報番組。\n全国の元気な話題をお届けします。',
];
async function annaiTalk(g) {
  const who = WHO.annai;
  const i = await g.ask('番組案内係です。\n気になる番組はありますか？', ['番組を聞く', '出演するには？', 'またね'], who);
  if (i === 0) {
    await g.say(PROGRAMS, who);
  } else if (i === 1) {
    await g.say(['お仕事の相談は、副調整室のプロデューサーへ。\nスタジオの奥の扉から入れます。', 'でも最初は、番組観覧で\nスタジオの空気を感じるのがおすすめですよ♪'], who);
  } else {
    await g.say('またどうぞ♪', who);
  }
}

async function kanranADTalk(g, e) {
  const who = WHO.kanranAD;
  if (today(g, 'bs_yoshimoto_kanran_day')) {
    await g.say(['観覧、ありがとうございました！', '番組観覧は1日1回なんです。\nまた明日も来てくださいね！'], who);
    return;
  }
  const i = await g.ask('番組観覧の受付でーす！\n『ご当地ほっこりTV』、観ていきます？\n（無料・1日1回）', ['観覧する', '内容を聞く', 'やめておく'], who);
  if (i === 0) {
    await g.say('ありがとうございまーす！\nではスタジオへご案内します！', who);
    await kanranEvent(g, who);
  } else if (i === 1) {
    await g.say(['観覧席から、番組の収録を間近で見られるんです！', 'プロのトークを見ると、勉強になりますよ。\n拍手の練習もあるので、よろしくです！'], who);
  } else {
    await g.say('またいつでもどうぞー！', who);
  }
  void e;
}

async function hokkurinTalk(g, e) {
  const who = WHO.hokkurin;
  const st = g.state;
  if (!g.flag('bs_yoshimoto_imo_got')) {
    g.setFlag('bs_yoshimoto_imo_got');
    await g.emote('bsy_hokkurin', '♥');
    await g.say(['ほっくりんだいも〜！', 'ほっくり町は、焼きいもと星空と温泉が\nじまんの町だいも！', 'おちかづきのしるしに、これあげるいも〜！'], who);
    g.sfx('good');
    g.giveItem('bs_yoshimoto_imo', 1, true);
    await g.say('「ほっくり焼きいも」をもらった！');
    return;
  }
  const i = await g.ask(st.fame >= 250 && !st.jobs.bs_yoshimoto_loke ? 'いつかほっくり町に、ロケに来てほしいいも〜！\n（副調整室のディレクターに頼んでみて！）' : 'ほっくりんだいも〜！\nなにしてあそぶいも？', ['ほっくり体操', '町のこと', 'クイズ！', 'またね'], who);
  if (i === 0) {
    const myDir = g.map.player.dir;
    await g.say('いっしょにやるいも！\nいち、に、さん、ほっくり！', who);
    for (const [m, p] of [['face:left', 'left'], ['face:right', 'right'], ['face:left', 'left'], ['face:right', 'right']]) {
      g.sfx('snare');
      await g.moveNpc('bsy_hokkurin', m);
      g.facePlayer(p);
      await g.wait(160);
    }
    // face each other again
    g.facePlayer(myDir);
    if (e) e.dir = OPP[myDir];
    await Promise.all([g.emote('bsy_hokkurin', '♪'), g.emote('player', '♪')]);
    if (!today(g, 'bs_yoshimoto_taiso_day')) {
      g.setFlag('bs_yoshimoto_taiso_day', st.day);
      g.heal(5);
      g.sfx('good');
      await g.say('体がぽかぽかしてきた！\n体力が5回復した。（1日1回）');
    } else {
      await g.say('ほっくほく〜！\nまた明日もやるいも〜！', who);
    }
  } else if (i === 1) {
    await g.say([
      'ほっくり町は、山のふもとの小さな町だいも。',
      '名物は、ほっくほくの焼きいも！\n秋になると、町じゅう甘い香りがするいも〜。',
      '夜は星がよく見えて、棚田と温泉もあるいも。\nいつか遊びに来てほしいいも！',
    ], who);
  } else if (i === 2) {
    const qs = [
      { q: 'ほっくり町の名物は\nなんだいも？', a: '焼きいも', w: ['たこ焼き', 'ラーメン'] },
      { q: 'ほっくりんの好きな言葉は\nなんだいも？', a: 'ほっくほく', w: ['カリカリ', 'ドロドロ'] },
    ];
    const q = pick(qs);
    const choices = shuffle([q.a, ...q.w]);
    const k = await g.ask(q.q, choices, { ...who, cancel: choices.length - 1 });
    if (choices[k] === q.a) {
      g.sfx('success');
      await g.emote('bsy_hokkurin', '♥');
      await g.say('せいかいだいも〜！\nほっくり町マスターだいも！', who);
    } else {
      g.sfx('buzz');
      await g.say(`ざんねん！せいかいは「${q.a}」だいも〜！`, who);
    }
  } else {
    await g.say('またねだいも〜！', who);
  }
}

async function amaiTalk(g) {
  const who = WHO.amai;
  const i = await g.ask('ほっくり町 観光課の甘井です！\n町の特産品、いかがですか？', ['買い物する', '町のこと', 'またね'], who);
  if (i === 0) {
    const bought = await g.shop(['bs_yoshimoto_imo', 'bs_yoshimoto_hoshiimo'], { title: 'ほっくり町 物産ブース', greeting: '焼きいもも干しいもも、町の自慢です！' });
    await g.say(bought ? 'ありがとうございます！\nほっくり町を、よろしくお願いします！' : 'またいつでも、のぞいてくださいね！', who);
  } else if (i === 1) {
    await g.say([
      'ほっくり町は、山あいの小さな町です。\n人口は少ないけれど、元気いっぱい！',
      'BSよしもとさんの番組で紹介してもらえるよう、\nほっくりんとPRに来ました。',
      g.state.fame >= 250 ? '人気者のあなたに、ロケに来てもらえたら…！\n副調整室のディレクターさんに、ぜひ！' : '有名になったら、ぜひロケに来てくださいね！\n★250くらいになったら、お声がかかるかも？',
    ], who);
  } else {
    await g.say('またお立ち寄りくださいね！', who);
  }
}

async function guardTalk(g) {
  const st = g.state;
  if (st.jobs.bs_yoshimoto_live) await g.say(['{name}さん！今朝の生放送、見ましたよ！', '…ここだけの話、家族みんなファンなんです。'], WHO.guard);
  else if (st.fame >= 1000) await g.say(['{name}さん！テレビでよく見てますよ！', '生放送のMCも、きっと似合いますよ。\n副調整室のディレクターに聞いてみては？'], WHO.guard);
  else if (st.agency) await g.say(['おつかれさまです！', 'スタジオは右手の扉からどうぞ。\n収録中は、ON AIRのランプが目印です。'], WHO.guard);
  else await g.say(['こんにちは！ロビーはどなたでも入れますよ。', '番組観覧なら、右のADさんが受付中です。'], WHO.guard);
}

async function talentTalk(g) {
  const st = g.state;
  if (st.fame >= 2000) {
    await g.say(['うわっ、本物の{name}さんだ…！', 'ぼくも、いつか特番の司会が\nできるくらいになりたいです！'], WHO.talent);
    return;
  }
  await g.say([
    'これから収録の待ち時間なんだ。',
    'ここの番組は、地方の町のいいところを\n紹介するのが多いんだよ。\n行ったことない町にくわしくなれるんだ。',
    st.agency || st.fame >= 30 ? 'クイズ番組の解答者、受けてみたら？\nスタジオのフロアディレクターさんが受付してるよ。' : '事務所に入るか、ちょっと名前が売れたら、\nクイズ番組の解答者に呼ばれるかもね！',
  ], WHO.talent);
}

// ------------------------------------------------------------------ studio people
async function fdTalk(g) {
  const who = WHO.fd;
  const i = await g.ask(quizOk(g) ? 'おつかれさまです！\nクイズ番組の解答者、空きありますよ！' : 'フロアディレクターです。\nスタジオの進行を仕切ってます！', ['クイズ解答者', 'スタジオって？', 'またね'], who);
  if (i === 0) {
    await runStudioJob(g, 'quiz', who);
  } else if (i === 1) {
    await g.say([
      '奥がセット、手前がカメラ、その後ろが観覧席。\n本番中はON AIRのランプが光ります！',
      'クイズの解答者は右の解答者席、\nMCはまんなかのデスク。\nいつか、あのデスクに座れるといいですね！',
      '番組の企画やお仕事の相談は、左奥の扉の先、\n副調整室のプロデューサーにどうぞ。',
    ], who);
  } else {
    await g.say('本番中はお静かにお願いしまーす！', who);
  }
}

async function mcTalk(g) {
  const st = g.state;
  if (st.fame >= 1000) {
    await g.say([
      st.jobs.bs_yoshimoto_live ? 'おお、{name}くん。\n生放送のMC、板についてきたね。' : 'おお、{name}くん。\nそろそろ生放送のMCもいけそうだね。',
      'MCのコツはね、主役はいつも出演者と視聴者。\nわたしたちは、その橋わたしなんだよ。',
    ], WHO.mc);
  } else {
    await g.say([
      '司会の陽向です。ただいまリハーサル中。',
      '台本どおりにいかないのが、\nテレビのおもしろいところでね。\nハプニングこそ、笑顔で受け止める！',
      '観覧席で、本番の空気を感じていってね。\nロビーのADさんが受付しているよ。',
    ], WHO.mc);
  }
}

// ------------------------------------------------------------------ control room people
async function directorTalk(g) {
  const who = WHO.director;
  const st = g.state;
  const greet = st.fame >= 1000 ? 'おう、{name}！\n今日はロケか？生放送か？' : st.fame >= 250 ? 'おっ、最近よく見る顔だな！\nロケ、行ってみるか？' : 'ディレクターの熱田だ。\n画づくりは、まかせとけ！';
  const i = await g.ask(greet, ['ロケ番組', '生放送MC', 'コツを聞く', 'またね'], who);
  if (i === 0) await runLoke(g, who);
  else if (i === 1) await runStudioJob(g, 'live', who);
  else if (i === 2) {
    await g.say([
      'ロケは、その町の人が主役だ。\n「おいしい」「きれい」を、自分の言葉で伝えろ！',
      '生放送はやり直しがきかない。\nむずかしい読みの言葉は、ふだんから練習しとけよ。',
      '控室の澄川アナのレッスンは、原稿読みにきくぞ。',
    ], who);
  } else {
    await g.say('いい画、撮ろうな！', who);
  }
}

async function jobBoard(g, who) {
  const items = JOB_KEYS.map((k) => {
    const lock = lockLabel(g, k);
    return { label: JOBS[k].label, right: lock || '目安' + fmtMoney(JOBS[k].def.pay), disabled: !!lock };
  });
  const k = await g.list({ title: 'お仕事リスト', items, x: 36, y: 30, w: 248, describe: (idx) => JOBS[JOB_KEYS[idx]] && JOBS[JOB_KEYS[idx]].info });
  if (k < 0 || !JOB_KEYS[k]) return;
  await runAny(g, JOB_KEYS[k], who);
}

async function producerTalk(g) {
  const who = WHO.producer;
  const st = g.state;
  if (!g.flag('bs_yoshimoto_pd_met')) {
    g.setFlag('bs_yoshimoto_pd_met');
    await g.say([
      'はじめまして、プロデューサーです。\n番組の企画と、キャスティングを担当しています。',
      'BSよしもとは、全国の地域とお笑いをつなぐ局。\n出演者さんの「伝える力」が何より大事なんです。',
      '{name}さんにできそうなお仕事は、\nこの「お仕事リスト」で確認してくださいね。',
    ], who);
  }
  const greet = st.fame >= 2000 ? '{name}さん！特番の総合司会、\nいつでもお願いしたいくらいです！'
    : st.fame >= 1000 ? (st.jobs.bs_yoshimoto_live ? '{name}さん、生放送の評判いいですよ！' : '{name}さんに、生放送のMCを\nお願いしたいと思っていたんです！')
      : st.fame >= 250 ? '{name}さん、ロケのお話が来ていますよ。' : 'いまの{name}さんにできるお仕事を\nいっしょに探しましょう。';
  const i = await g.ask(greet, ['お仕事リスト', '相談する', 'またね'], who);
  if (i === 0) await jobBoard(g, who);
  else if (i === 1) await g.say(hintFor(g, true), who);
  else await g.say('いい番組、いっしょに作りましょう！', who);
}

// ------------------------------------------------------------------ green room people
async function senpaiTalk(g) {
  const who = WHO.senpai;
  const st = g.state;
  const i = await g.ask('先輩アナの澄川です。\n本番前のメイク中だけど、レッスンならどうぞ。', ['原稿読み基礎', '中継トーク講座', 'コツを聞く', 'やめる'], who);
  if (i === 0) {
    await g.lesson({ title: '原稿読み・基礎レッスン', skill: 'talk', price: 3000, stamina: 12, gain: 4, minigame: 'announce', opts: { difficulty: 1, count: 5, set: 'news' }, teacher: who.name });
  } else if (i === 1) {
    if (st.fame < 250) {
      await g.say('中継トーク講座は、★250からの中級クラスよ。\nまずは原稿読みの基礎からね。', who);
      return;
    }
    await g.lesson({ title: '中継トーク講座', skill: 'talk', price: 6000, stamina: 15, gain: 5, minigame: 'talk', opts: { difficulty: 3, topic: 'local', scenes: LESSON_SCENES }, teacher: who.name });
  } else if (i === 2) {
    await g.say([
      '原稿は、まず全体を下読み。\n読めない漢字は、本番前に必ず調べること。',
      '中継では、最初のひと言で\n「どこにいるか」を伝えるの。\n見ている人が迷子にならないようにね。',
      'メイクさんにお願いすると、\n気持ちがシャキッとするわよ。',
    ], who);
  } else {
    await g.say('本番、がんばってね。', who);
  }
}

async function makeTalk(g) {
  const who = WHO.make;
  const st = g.state;
  if (st.buffs.talk) {
    await g.say('あら、今日はもうバッチリ決まってるわよ！\nその顔で、どんどんしゃべってきて！', who);
    return;
  }
  if (today(g, 'bs_yoshimoto_make_day')) {
    await g.say('メイク直しは1日1回まで！\nまた明日いらっしゃい♪', who);
    return;
  }
  const i = await g.ask('メイクさんよ。本番前にちょっと整えてく？\n（無料・1日1回）', ['お願いします', 'だいじょうぶ'], who);
  if (i !== 0) { await g.say('いつでもどうぞ♪', who); return; }
  g.setFlag('bs_yoshimoto_make_day', st.day);
  await g.fadeOut(10);
  g.sfx('shutter');
  await g.wait(300);
  await g.fadeIn(10);
  st.buffs.talk = true;
  g.sfx('good');
  await g.emote('player', '♪');
  await g.say(['はい、できあがり！\nいい顔になったわよ！', '（次の「トーク」のミニゲームが少しやさしくなる）'], who);
}

// ------------------------------------------------------------------ props
const signs = (list) => list.map(([x, y, t]) => ({ type: 'sign', x, y, text: t }));

// ニッポンご当地マップ (lobby wall)
const JP_ROWS = [
  '',
  '..............................##',
  '.............................#####..#',
  '.............................#######',
  '..............................######',
  '...............................####',
  '................................#',
  '.............................###',
  '............................####',
  '............................####',
  '...........................####',
  '...........................#####',
  '..........................######',
  '........................#######',
  '....................##########',
  '...............###########',
  '...........#############',
  '.......############.##',
  '......#####',
  '.....####...####',
  '.....#####..###',
  '......###',
  '',
  '.#',
];
let jpCanvas = null;
function jpMap() {
  if (jpCanvas) return jpCanvas;
  let c;
  [jpCanvas, c] = makeCanvas(40, 24);
  pix(c, JP_ROWS, { '#': '#f6f6f8' });
  return jpCanvas;
}
const JP_PINS = [[32, 3], [29, 9], [28, 14], [17, 16], [11, 19], [6, 20], [1, 23]];
const japanMap = {
  type: 'prop', x: 3, y: 1, w: 3, h: 2,
  text: ['「ニッポン ご当地マップ」', '番組でとりあげた町に、赤いピンが立っている。\n北から南まで、日本じゅうにピンがいっぱいだ！', 'ハートのピンは…「ほっくり町」！\n山あいの小さな町らしい。'],
  draw(ctx, sx, sy, g) {
    box(ctx, sx + 1, sy + 3, 46, 28, INK);
    box(ctx, sx + 2, sy + 4, 44, 26, '#2f6fd0');
    box(ctx, sx + 2, sy + 4, 44, 4, RED);
    box(ctx, sx + 4, sy + 5, 18, 1, WHT);
    ctx.drawImage(jpMap(), sx + 4, sy + 6);
    const on = Math.floor(g.frame / 18) % JP_PINS.length;
    JP_PINS.forEach(([px, py], i) => {
      box(ctx, sx + 4 + px, sy + 5 + py, 2, 2, i === on ? GOLD : RED);
    });
    // ほっくり町（heart pin）
    if (Math.floor(g.frame / 25) % 2 === 0) { box(ctx, sx + 26, sy + 19, 1, 1, '#ff7eb6'); box(ctx, sx + 28, sy + 19, 1, 1, '#ff7eb6'); box(ctx, sx + 26, sy + 20, 3, 1, '#ff7eb6'); box(ctx, sx + 27, sy + 21, 1, 1, '#ff7eb6'); }
  },
};

const LOBBY_REEL = ['mount', 'sea', 'mascot', 'fest', 'field'];
const PROGRAM_TEXT = {
  mount: 'モニターに、朝日にかがやく山々が映っている。\n「ふるさと ぶらり発見」のオープニングだ。',
  sea: 'モニターに、港町の漁船が映っている。\n「とれたての魚、いただきます！」…おいしそう。',
  mascot: 'モニターに、ほっくりんが映っている。\n「ほっくり町に来てほしいいも〜！」',
  fest: 'モニターでは、お祭りの中継をやっている。\nちょうちんの明かりと花火がきれいだ。',
  field: 'モニターに、一面の棚田が映っている。\n田んぼの緑がまぶしい…。',
};
const lobbyReel = (g) => LOBBY_REEL[Math.floor(g.frame / 150) % LOBBY_REEL.length];
const videoWall = {
  type: 'prop', x: 13.6, y: 1.15, w: 2.8, h: 1.7,
  talk: async (g) => { await g.say(PROGRAM_TEXT[lobbyReel(g)]); },
  draw(ctx, sx, sy, g) {
    const w = 41, h = 23;
    tvFrame(ctx, sx + 2, sy + 2, w, h);
    drawScene(ctx, sx + 2, sy + 2, w, h, lobbyReel(g), g.frame);
    box(ctx, sx + 2, sy + 2 + h - 4, w, 4, 'rgba(0,0,0,0.45)');
    box(ctx, sx + 4, sy + 2 + h - 3, 6, 2, RED); box(ctx, sx + 12, sy + 2 + h - 3, 16, 1, WHT);
  },
};
// ほっくりんの顔出しパネル (lobby)
const facePanel = {
  type: 'prop', x: 12, y: 8, w: 2, h: 1,
  talk: async (g) => {
    const i = await g.ask('ほっくりんの顔出しパネルだ。\n「ほっくり町へようこそ！」と書いてある。\n顔を出して、記念撮影する？', ['撮る！', 'やめておく']);
    if (i !== 0) return;
    await g.emote('player', '♪');
    g.sfx('shutter');
    g.shake(4, 1);
    await g.wait(200);
    await g.emote('bsy_hokkurin', '♥');
    await g.say('パシャッ！\nほっくりんになりきって、記念撮影！\n…なかなか似合っている！');
  },
  draw(ctx, sx, sy) {
    const cx = sx + 16, cy = sy - 3;
    box(ctx, sx + 5, sy + 6, 2, 9, '#8a5a33'); box(ctx, sx + 25, sy + 6, 2, 9, '#8a5a33');
    box(ctx, sx + 3, sy + 14, 26, 2, 'rgba(0,0,0,0.2)');
    box(ctx, sx + 1, sy - 17, 30, 25, RED); box(ctx, sx + 2, sy - 16, 28, 23, '#ffe9e3');
    for (let yy = -9; yy <= 9; yy++) {
      const hw = Math.round(10 * Math.sqrt(Math.max(0, 1 - (yy * yy) / 100)));
      box(ctx, cx - hw - 1, cy + yy, hw * 2 + 2, 1, IMOO);
    }
    for (let yy = -8; yy <= 8; yy++) {
      const hw = Math.round(9 * Math.sqrt(Math.max(0, 1 - (yy * yy) / 81)));
      box(ctx, cx - hw, cy + yy, hw * 2, 1, IMO);
    }
    box(ctx, cx - 6, cy - 6, 3, 1, IMOL);
    box(ctx, cx - 1, cy - 12, 2, 3, '#3a8a3a'); box(ctx, cx - 4, cy - 13, 3, 2, '#5ec466'); box(ctx, cx + 1, cy - 13, 3, 2, '#5ec466');
    box(ctx, cx - 4, cy - 5, 8, 6, '#3a2a30'); box(ctx, cx - 5, cy - 4, 10, 4, '#3a2a30');
    box(ctx, cx - 9, cy + 3, 18, 2, WHT); box(ctx, cx - 6, cy + 3, 1, 1, RED); box(ctx, cx - 1, cy + 4, 1, 1, RED); box(ctx, cx + 4, cy + 3, 1, 1, RED);
  },
};

// ON AIR lamp: lit in the lobby (there is always something on), or while a show is on in the studio.
const onAirLamp = (x, y, lit) => ({
  type: 'prop', x, y, w: 1, h: 1, solid: false,
  draw(ctx, sx, sy, g) {
    if (lit(g)) ctx.drawImage(tileImage('onair', Math.floor(g.frame / 40) % 2), Math.round(sx), Math.round(sy));
    else {
      box(ctx, sx + 2, sy + 4, 12, 6, INK); box(ctx, sx + 3, sy + 5, 10, 4, '#5a1f1f');
      box(ctx, sx + 4, sy + 6, 2, 2, '#7a3a3a'); box(ctx, sx + 7, sy + 6, 2, 2, '#7a3a3a'); box(ctx, sx + 10, sy + 6, 2, 2, '#7a3a3a');
    }
  },
});

// Studio LED screens on the set.
function ledKind(g, side) {
  if (side && ledOverride) return ledOverride;
  if (show === 'quiz') return 'quiz';
  if (show === 'live') return side ? 'mount' : 'live';
  if (show === 'special' || party) return 'sp';
  if (show === 'kanran') return side ? 'field' : 'mascot';
  const reel = side ? ['sea', 'field', 'mount', 'fest'] : ['mount', 'fest', 'sea', 'field'];
  return reel[Math.floor(g.frame / 180) % reel.length];
}
const ledScreen = (x, side) => ({
  type: 'prop', x, y: 1.15, w: 3.6, h: 1.6,
  text: side ? 'セットの大型ビジョンだ。\n番組にあわせて、映像が切りかわる。' : 'セットの大型ビジョンだ。\n全国の町の映像が流れている。',
  draw(ctx, sx, sy, g) {
    const w = 52, h = 22;
    tvFrame(ctx, sx + 3, sy + 2, w, h);
    drawScene(ctx, sx + 3, sy + 2, w, h, ledKind(g, side), g.frame + (side ? 60 : 0));
  },
});
// Red tally light on a camera while on air.
const tally = (x, y) => ({
  type: 'prop', x, y, w: 1, h: 1, solid: false, z: 1, cond: () => onAir,
  draw(ctx, sx, sy, g) { if (Math.floor(g.frame / 20) % 4) { box(ctx, sx + 7, sy - 1, 2, 2, '#ff2b3a'); box(ctx, sx + 6, sy - 2, 4, 1, 'rgba(255,43,58,0.35)'); } },
});
// Banner across the set edge during the special.
const spBanner = {
  type: 'prop', x: 3, y: 6, w: 14, h: 1, solid: false, cond: () => show === 'special' || party,
  draw(ctx, sx, sy) {
    box(ctx, sx, sy + 1, 224, 14, '#7a5a10');
    box(ctx, sx + 1, sy + 2, 222, 12, GOLD);
    box(ctx, sx + 3, sy + 3, 218, 10, REDD);
    text(ctx, '★ 秋の大型特番 全国ふるさと笑顔まつり ★', sx + 112, sy + 3, { size: 10, align: 'center', color: '#fff6a8', shadow: '#3a0a04' });
  },
};
// 3x5 pixel letters for monitor labels.
const GLYPH = {
  P: ['111', '101', '111', '100', '100'], G: ['111', '100', '101', '101', '111'], M: ['101', '111', '101', '101', '101'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '101', '111', '101'],
};
function tinyText(ctx, str, x, y, col) {
  [...str].forEach((ch, i) => (GLYPH[ch] || []).forEach((row, yy) => [...row].forEach((b, xx) => { if (b === '1') box(ctx, x + i * 4 + xx, y + yy, 1, 1, col); })));
}
// Control room PGM / PVW monitors.
// (PGM's hit box stops at tile 6 so tile 7 belongs to PVW only)
const bigMon = (x, label, col, kind) => ({
  type: 'prop', x, y: 1.1, w: label === 'PGM' ? 1.9 : 2.3, h: 1.7,
  text: label === 'PGM' ? '「PGM」のモニター。\nいま、まさに放送されている映像だ。' : '「PVW」のモニター。\n次に切りかえる映像を、ここで確認するらしい。',
  draw(ctx, sx, sy, g) {
    const w = 34, h = 21;
    box(ctx, sx + 1, sy + 1, w + 2, h + 7, '#0e0f13');
    box(ctx, sx + 1, sy + 1, w + 2, 1, col);
    drawScene(ctx, sx + 2, sy + 2, w, h, typeof kind === 'function' ? kind(g) : kind, g.frame);
    box(ctx, sx + 1, sy + h + 2, w + 2, 6, '#16171c');
    box(ctx, sx + 2, sy + h + 2, 15, 6, col);
    tinyText(ctx, label, sx + 4, sy + h + 2, WHT);
  },
});

// ------------------------------------------------------------------ place
registerPlace({
  id: PID,
  name: 'BSよしもと',
  kind: 'building',
  bgm: 'studio',
  start: { room: 'lobby', x: 9, y: 11, dir: 'up' },
  rooms: {
    // -------------------------------------------------------------- lobby
    lobby: {
      floor: T('floor'),
      bgm: 'office',
      tiles: [
        '####################',
        '#UKUUUULLLLLLUUUUSY#',
        '#=k====llllll====sy#',
        '#.....P......P.....#',
        '#......CCCCCC......#',
        '#........[]........#',
        '#.fff....[]....Z...#',
        '#.ttt....[]........#',
        '#........[]........#',
        '#........[]........#',
        '#nBB.....[].......P#',
        '#P.......[]........#',
        '#########MM#########',
      ],
      legend: {
        '#': T('walltop'), U: T('wall_u'), '=': T('wall'),
        K: T('kdoor_u'), k: T('kdoor'), L: T('feat_u'), l: T('feat'),
        S: T('sdoor_ul'), Y: T('sdoor_ur'), s: T('sdoor_l'), y: T('sdoor_r'),
        C: T('counter'), '[': T('run_l'), ']': T('run_r'),
        P: 'plant', f: T('sofa'), t: 'table_low', Z: T('stand'), B: T('booth'), n: T('nobori'),
      },
      warps: [
        { x: 9, y: 12, to: 'exit' }, { x: 10, y: 12, to: 'exit' },
        { x: 2, y: 2, room: 'hikae', tx: 6, ty: 8, dir: 'up' },
        { x: 17, y: 2, room: 'studio', tx: 9, ty: 12, dir: 'up' },
        { x: 18, y: 2, room: 'studio', tx: 10, ty: 12, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 7.2, y: 0.55, w: 5.6, h: 2.3, logo: PID, board: true, lights: true },
        japanMap,
        videoWall,
        facePanel,
        onAirLamp(17.5, 0.75, () => true),
        npc('bsy_uketsuke', 9, 3, 'down', WHO.uketsuke, { talk: uketsukeTalk }),
        npc('bsy_annai', 10, 3, 'down', WHO.annai, { talk: annaiTalk }),
        npc('bsy_kanran_ad', 16, 6, 'down', WHO.kanranAD, { talk: kanranADTalk }),
        npc('bsy_obaachan', 16, 8, 'up', WHO.obaachan, {
          text: ['孫といっしょに、番組観覧に来たのよ。', 'テレビの中の人を、\nこんなに近くで見られるなんてねえ。\n長生きはするもんだわ。'],
        }),
        npc('bsy_mago', 17, 8, 'up', WHO.mago, {
          text: ['ぼく、ほっくりんに会いに来たんだ！', 'あっちでおどってるよ！\nほっくりんと「ほっくり体操」すると、\n元気になるんだ！'],
        }),
        npc('bsy_hokkurin', 5, 10, 'down', WHO.hokkurin, { sprite: drawMascot, wander: 1, talk: hokkurinTalk }),
        npc('bsy_amai', 3, 9, 'down', WHO.amai, { talk: amaiTalk }),
        npc('bsy_guard', 12, 11, 'left', WHO.guard, { talk: guardTalk }),
        npc('bsy_talent', 4, 6, 'down', WHO.talent, { talk: talentTalk }),
        ...signs([
          [15, 6, '立て看板だ。\n「本日の番組観覧 受付中！　参加無料」'],
          [1, 10, 'ほっくり町ののぼりだ。\n「焼きいもの里 ほっくり町」と書いてある。'],
        ]),
      ],
      onEnter: async (g) => {
        if (!g.flag('bs_yoshimoto_welcome')) await welcome(g);
      },
    },

    // -------------------------------------------------------------- main studio
    studio: {
      floor: T('sfloor'),
      bgm: 'studio',
      tiles: [
        '####################',
        '#DUAAAAAAAAAAAAAAUU#',
        '#d=aaaaaaaaaaaaaa==#',
        '#.L,,,,,,,,,,,,,,L.#',
        '#..,ggg,MMMM,QQQ,..#',
        '#..,,,,,,,,,,,,,,..#',
        '#..eeeeeeeeeeeeee..#',
        '#..................#',
        '#...K....K.....K...#',
        '#..................#',
        '#..ssssss..ssssss..#',
        '#..ssssss..ssssss..#',
        '#..................#',
        '#########OO#########',
      ],
      legend: {
        '#': T('walltop'), U: T('swall_u'), '=': T('swall'),
        D: T('cdoor_u'), d: T('cdoor'), A: T('set_u'), a: T('set'),
        L: `${T('sfloor')}+spotlight`, ',': T('setfloor'), e: T('setedge'),
        g: `${T('setfloor')}+${T('sofa')}`, M: `${T('setfloor')}+${T('mcdesk')}`, Q: `${T('setfloor')}+${T('panel')}`,
        K: `${T('sfloor')}+${T('cam')}`, s: `${T('sfloor')}+${T('seat')}`, O: T('mat'),
      },
      warps: [
        { x: 9, y: 13, room: 'lobby', tx: 17, ty: 3, dir: 'down' },
        { x: 10, y: 13, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
        { x: 1, y: 2, room: 'sub', tx: 8, ty: 10, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 7.4, y: 0.9, w: 5.2, h: 2.05, logo: PID, board: true, lights: true, text: 'セットの真ん中に、\nBSよしもとのロゴがかがやいている。\nカメラに映る、番組の顔だ！' },
        ledScreen(3.3, 0), ledScreen(13.1, 1),
        onAirLamp(2, 1.4, () => onAir),
        tally(4, 8), tally(9, 8), tally(15, 8),
        spBanner,
        // regular crew
        npc('bsy_mc', 9, 3, 'down', WHO.mc, { talk: mcTalk, cond: () => show !== 'live' && show !== 'special' }),
        npc('bsy_fd', 17, 5, 'left', WHO.fd, { talk: fdTalk, cond: () => !show }),
        npc('bsy_bijutsu', 5, 5, 'up', WHO.bijutsu, {
          wander: 1, cond: () => !show,
          text: ['美術スタッフです。セットの仕上げ中！', 'このセット、全国の町をイメージして作ったんです。\n赤と白で、パッと明るく！', 'セットの柱は、何度も塗りなおしてるんですよ。\nカメラに映ると色が変わって見えるから。'],
        }),
        npc('bsy_shoumei', 2, 4, 'up', WHO.shoumei, {
          talk: posted('up', lines(WHO.shoumei, ['照明さんだよ。ライトの角度を調整中。', '出演者の顔が明るく映るように、\n光を何重にも当ててるんだ。', '本番中はすごくまぶしいから、\nまばたきしすぎないように気をつけて！'])),
        }),
        npc('bsy_cam3', 15, 9, 'up', WHO.cameraman, {
          talk: posted('up', lines(WHO.cameraman, ['カメラマンです。', '本番中は、カメラの上の赤いランプに注目！\nランプが光っているカメラが、いま放送中の画です。', 'そのカメラを見て話すと、\nテレビの前の人と目が合うんですよ。'])),
        }),
        npc('bsy_jouren', 3, 10, 'up', WHO.jouren, {
          talk: posted('up', lines(WHO.jouren, ['わたし、ここの観覧の常連なの！', '観覧はロビーで受付してるよ。\n拍手のタイミング、ばっちり教えてあげる！', '観覧のあとって、\nなんだかしゃべりたくなるんだよね〜。'])),
        }),
        // show crew & audience
        npc('bsy_fd2', 12, 7, 'up', WHO.fd, { cond: () => !!show, text: '本番中です…！\n（カンペを持って、出演者に合図を送っている）' }),
        npc('bsy_cam1', 4, 9, 'up', WHO.cameraman, { cond: () => !!show, text: '本番中です…！' }),
        npc('bsy_cam2', 9, 9, 'up', WHO.cameraman, { cond: () => !!show, text: '本番中です…！' }),
        npc('bsy_coh', 10, 3, 'down', WHO.coh, { cond: () => !!show, text: '本番、がんばりましょうね！' }),
        npc('bsy_st_hok', 3, 3, 'right', WHO.hokkurin, { sprite: drawMascot, cond: () => show === 'kanran' || show === 'special', text: 'ほっくほくだいも〜！' }),
        npc('bsy_q1', 13, 3, 'down', { name: '解答者', look: WHO.idol.look }, { cond: () => show === 'quiz' || show === 'special', text: '負けませんよ〜！' }),
        npc('bsy_q2', 15, 3, 'down', { name: '解答者', look: WHO.geinin2.look }, { cond: () => show === 'quiz' || show === 'special', text: 'ご当地のことなら、まかせとき！' }),
        npc('bsy_q3', 14, 3, 'down', { name: '解答者', look: WHO.guest.look }, { cond: () => show === 'special', text: '特番、楽しいですね！' }),
        npc('bsy_g_idol', 4, 4, 'down', WHO.idol, { cond: () => show === 'special', text: 'きゃー！特番、楽しい！' }),
        npc('bsy_g_geinin', 5, 4, 'down', WHO.geinin, { cond: () => show === 'special', text: '台本、どこやったっけ…' }),
        npc('bsy_pd_show', 17, 5, 'left', WHO.producer, { cond: () => show === 'special', hidden: true, text: '最高の特番でした！' }),
        npc('bsy_aud1', 4, 10, 'up', WHO.aud, { cond: () => !!show, text: 'ワクワク…！' }),
        npc('bsy_aud2', 8, 10, 'up', { name: 'お客さん', look: LOOKS.mom }, { cond: () => !!show, text: '楽しみねえ！' }),
        npc('bsy_aud3', 12, 10, 'up', { name: 'お客さん', look: LOOKS.tourist }, { cond: () => !!show, text: 'すごーい！' }),
        npc('bsy_aud4', 14, 10, 'up', { name: 'お客さん', look: LOOKS.oldman }, { cond: () => !!show, text: 'ほっほっほ。' }),
        npc('bsy_aud5', 16, 10, 'up', { name: 'お客さん', look: LOOKS.salaryman }, { cond: () => !!show, text: '有休とって来ました！' }),
        npc('bsy_aud6', 3, 11, 'up', { name: 'お客さん', look: LOOKS.kid }, { cond: () => !!show, text: 'わくわく！' }),
        npc('bsy_aud7', 5, 11, 'up', { name: 'お客さん', look: LOOKS.oldwoman }, { cond: () => !!show, text: 'あらまあ、明るいスタジオねえ。' }),
        npc('bsy_aud8', 7, 11, 'up', { name: 'お客さん', look: { ...LOOKS.fan, hairColor: 'brown', top: '#ffd23f' } }, { cond: () => !!show, text: 'がんばって〜！' }),
        npc('bsy_aud9', 11, 11, 'up', { name: 'お客さん', look: LOOKS.clerk }, { cond: () => !!show, text: '仕事の合間に来ました！' }),
        npc('bsy_aud10', 13, 11, 'up', { name: 'お客さん', look: LOOKS.mom }, { cond: () => !!show, text: 'テレビに映るかしら？' }),
        npc('bsy_aud11', 15, 11, 'up', { name: 'お客さん', look: LOOKS.chef }, { cond: () => !!show, text: 'いい番組になりそうだ。' }),
      ],
      events: [
        { x: 8, y: 4, on: 'action', cond: () => !show, run: async (g) => { await g.say('MCデスクだ。台本とマイクが置いてある。\nいつか、ここに座ってみたい…！'); } },
        { x: 10, y: 4, w: 2, on: 'action', cond: () => !show, run: async (g) => { await g.say('MCデスクだ。\n台本に赤ペンでびっしり書きこみがしてある。'); } },
        {
          x: 13, y: 4, w: 3, on: 'action', cond: () => !show,
          run: async (g) => {
            g.sfx('chime');
            await g.say('解答者席のボタンを押してみた。\nピンポーン♪');
            await g.say(quizOk(g) ? 'フロアディレクターに声をかければ、\nここでクイズに挑戦できる！' : '事務所に所属するか★30になったら、\nここに座れるらしい。');
          },
        },
        { x: 4, y: 4, w: 3, on: 'action', cond: () => !show, run: async (g) => { await g.say('ゲスト用のソファだ。\nふかふかで、座り心地がよさそう。'); } },
        { x: 4, y: 8, on: 'action', run: async (g) => { await g.say('大きなスタジオカメラだ。\nファインダーに、セットが映っている。'); } },
        { x: 9, y: 8, on: 'action', run: async (g) => { await g.say('センターのカメラだ。\nMCデスクを正面から映している。'); } },
        { x: 15, y: 8, on: 'action', run: async (g) => { await g.say('スタジオカメラだ。\n解答者席のほうを向いている。'); } },
        { x: 17, y: 3, on: 'action', run: async (g) => { await g.say('照明スタンドだ。\nまぶしい！'); } },
      ],
      drawOver: (ctx, g, cam) => {
        if (onAir) {
          // soft light beams on the set
          ctx.fillStyle = 'rgba(255,248,220,0.08)';
          for (const cx of [5, 10, 15]) {
            const x0 = cx * 16 - cam.x, y0 = 16 - cam.y;
            ctx.beginPath();
            ctx.moveTo(x0 - 6, y0); ctx.lineTo(x0 + 6, y0); ctx.lineTo(x0 + 34, y0 + 92); ctx.lineTo(x0 - 34, y0 + 92);
            ctx.closePath(); ctx.fill();
          }
        }
        if (party) drawConfetti(ctx, g.frame, 60);
      },
      onEnter: async (g) => {
        if (show || g.flag('bs_yoshimoto_studio_first')) return;
        g.setFlag('bs_yoshimoto_studio_first');
        await g.wait(200);
        await g.emote('bsy_fd', '!');
        await g.say([
          'おっ、見学の方ですね？\nここがBSよしもとのメインスタジオです！',
          '奥がセット、手前がカメラ、うしろが観覧席。\n本番中は、ON AIRのランプが光りますよ！',
          '事務所に所属しているか★30以上なら、\nクイズ番組の解答者もお願いできます。\n声をかけてくださいね！',
        ], WHO.fd);
      },
    },

    // -------------------------------------------------------------- control room
    sub: {
      floor: 'floor_carpet_gray',
      bgm: 'studio',
      tiles: [
        '##################',
        '#UMMMMMMMMMMMUUUU#',
        '#=mmmmmmmmmmm====#',
        '#................#',
        '#.KKKKKKKKKKKKKK.#',
        '#................#',
        '#................#',
        '#................#',
        '#.TT.......SSS...#',
        '#..........ttt...#',
        '#P..............P#',
        '########OO########',
      ],
      legend: {
        '#': T('walltop'), U: T('swall_u'), '=': T('swall'),
        M: T('mon_u'), m: T('mon'), K: T('console'),
        T: 'table_white', S: T('sofa'), t: 'table_low', P: 'plant', O: T('mat'),
      },
      warps: [
        { x: 8, y: 11, room: 'studio', tx: 1, ty: 3, dir: 'down' },
        { x: 9, y: 11, room: 'studio', tx: 1, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 13.7, y: 1.15, w: 3, h: 1.3, logo: PID, board: true, text: 'BSよしもとのロゴだ。\n副調整室にも、ちゃんと飾ってある。' },
        bigMon(5.1, 'PGM', '#ff2b3a', 'set'),
        bigMon(7.6, 'PVW', '#2fd07a', (g) => ['field', 'mount', 'sea', 'mascot'][Math.floor(g.frame / 200) % 4]),
        npc('bsy_tk', 3, 5, 'up', WHO.tk, {
          talk: posted('up', lines(WHO.tk, ['タイムキーパーです。\n番組の時間を、1秒単位で管理してます。', '「CMまであと30秒！」って\n声をかけるのが、わたしの仕事。', '生放送は、時間との戦いなんですよ〜。'])),
        }),
        npc('bsy_director', 7, 5, 'up', WHO.director, { talk: posted('up', directorTalk) }),
        npc('bsy_td', 10, 5, 'up', WHO.td, {
          talk: posted('up', lines(WHO.td, ['スイッチャーです。\nどのカメラの映像を放送するか、\nここで切りかえるんだ。', 'ディレクターの「3カメ！」の声で、ポチッとね。\nタイミングが命！'])),
        }),
        npc('bsy_onsei', 14, 5, 'up', WHO.onsei, {
          talk: posted('up', lines(WHO.onsei, ['音声さんだよ。マイクの音量を調整してる。', '笑い声が大きすぎても、小さすぎてもダメ。\nちょうどいい音を届けるのが腕の見せどころさ。'])),
        }),
        npc('bsy_producer', 10, 8, 'down', WHO.producer, { talk: producerTalk }),
        npc('bsy_ad', 3, 9, 'right', WHO.ad, {
          wander: 1,
          text: ['ADです！走りまわってます！', 'カンペ書いて、弁当配って、ゲストのお出迎え…\nテレビは、たくさんの人で作ってるんです！', 'お仕事の相談なら、プロデューサーへどうぞ！\nあっちのソファのそばにいますよ！'],
        }),
      ],
      events: [
        { x: 2, y: 2, w: 3, on: 'action', run: async (g) => { await g.say('モニターがずらりと並んでいる。\nカメラごとの映像が、ぜんぶ映っているらしい。'); } },
        { x: 10, y: 2, w: 3, on: 'action', run: async (g) => { await g.say('全国の町からの中継映像が映っている。\n海、山、お祭り…どれも楽しそうだ。'); } },
        { x: 2, y: 8, w: 2, on: 'action', run: async (g) => { await g.say('打ち合わせ用のテーブルだ。\n企画書が山のように積まれている。'); } },
        { x: 11, y: 9, w: 3, on: 'action', run: async (g) => { await g.say('テーブルの上に、出演者リストが置いてある。\n…あっ、{name}の名前もある！？'); } },
      ],
      onEnter: async (g) => {
        if (g.flag('bs_yoshimoto_sub_first')) return;
        g.setFlag('bs_yoshimoto_sub_first');
        await g.wait(200);
        await g.emote('bsy_tk', '!');
        await g.say('あっ、お客さん？\nここは副調整室、通称「サブ」です。\n番組の映像と音を、ここで仕上げてます！', WHO.tk);
        await g.say(['お仕事の相談なら、\nソファのそばのプロデューサーへ。', 'ロケや生放送は、\nまんなかのディレクターが担当です。'], WHO.tk);
      },
    },

    // -------------------------------------------------------------- green room
    hikae: {
      floor: 'floor_carpet_beige',
      bgm: 'office',
      tiles: [
        '##############',
        '#UMMMMUUUUUUU#',
        '#=mmmm==v====#',
        '#.VVVV......L#',
        '#...........R#',
        '#.......SSS..#',
        '#KKKK...ttt..#',
        '#KTTK........#',
        '#KKKK.......P#',
        '######OO######',
      ],
      legend: {
        '#': T('walltop'), U: T('wall_u'), '=': T('wall'),
        M: T('mir_u'), m: T('mir'), v: `${T('wall')}+${T('wtv')}`,
        V: 'makeup', L: 'locker', R: 'clothes_rack', S: T('sofa'), t: 'table_low',
        K: 'floor_tatami', T: 'floor_tatami+table_low', P: 'plant', O: T('mat'),
      },
      warps: [
        { x: 6, y: 9, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
        { x: 7, y: 9, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 9.2, y: 1.15, w: 3, h: 1.25, logo: PID, board: true, text: '控室にも、BSよしもとのロゴ。\n本番前に見ると、気合いが入る！' },
        npc('bsy_senpai', 3, 4, 'up', WHO.senpai, { talk: posted('up', senpaiTalk) }),
        npc('bsy_make', 4, 4, 'left', WHO.make, { talk: posted('left', makeTalk) }),
        npc('bsy_geinin', 1, 7, 'right', WHO.geinin, {
          talk: posted('right', lines(WHO.geinin, ['ロケ弁、うまっ！\n…あ、どうも。若手芸人っす。', 'BSよしもとのロケって、\n全国の名物が食べられるんすよ。\n役得っすね〜！', '★250くらいで、ロケに呼ばれるらしいっす。\nオレもはよ行きたい！'])),
        }),
        npc('bsy_stylist', 11, 4, 'right', WHO.stylist, {
          talk: posted('right', lines(WHO.stylist, ['スタイリストよ。衣装の準備はおまかせ！', 'ロケなら動きやすい服、生放送ならきちんと感。\n番組にあわせて衣装を選ぶのも大事なの。'])),
        }),
        npc('bsy_sleepy', 9, 5, 'down', WHO.sleepy, {
          person: 'yoruno',
          talk: async (g) => {
            await g.say('Zzz…むにゃ…カンペ…あと5枚…');
            await g.emote('bsy_sleepy', '!');
            await g.say(['はっ！寝てません！寝てませんよ！', '…昨日、特番の準備でちょっと夜ふかししちゃって。\nあ、テーブルの差し入れ、よかったらどうぞ。'], WHO.sleepy);
          },
        }),
      ],
      events: [
        {
          x: 8, y: 6, w: 3, on: 'action',
          run: async (g) => {
            if (today(g, 'bs_yoshimoto_snack_day')) { await g.say('差し入れのお菓子は、もう食べてしまった。\nまた明日のお楽しみ。'); return; }
            g.setFlag('bs_yoshimoto_snack_day', g.state.day);
            g.sfx('good');
            g.heal(10);
            await g.say('テーブルに、差し入れのお菓子が置いてある。\nひとつ、いただきます！\n体力が10回復した。（1日1回）');
          },
        },
        { x: 2, y: 7, w: 2, on: 'action', run: async (g) => { await g.say('ちゃぶ台の上に、ロケ弁とお茶。\n若手芸人さんのお昼ごはんらしい。'); } },
        {
          x: 8, y: 2, on: 'action',
          run: async (g) => { await g.say('モニターに、スタジオの様子が映っている。\n本番の進み具合が、ここで分かるらしい。'); },
        },
      ],
    },
  },
});
