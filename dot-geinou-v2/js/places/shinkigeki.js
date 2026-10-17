// よしもと新喜劇 劇場（なんばエリア）
//
//   lobby     ロビー          チケット売り場（毎日の公演を観劇）・グッズ売り場・顔ハメ看板・楽屋口・劇場ホールの扉
//   hall      劇場ホール      赤い幕と金の飾りの大劇場。舞台には「うどん まんぷく亭」のセット。
//   backstage 楽屋・舞台袖    舞台監督（お仕事・オーディション）・受け身の師匠（レッスン）・座長と一座のみなさん
//
// 進め方
//   だれでも : 公演を観る（¥1,000・1日1回・お笑い+1）、通行人役のエキストラ、ズッコケ（受け身）レッスン、
//              新喜劇 座員オーディション（よしもと所属になれる）
//   所属 or ★100 : 新喜劇にちょい役で出演
//   ★250 / ★1000 （よしもと所属）: 準レギュラー / 座長公演の重要な役
//   ★2000（よしもと所属）: 座長に抜擢！（1日1回。初めて成功すると座長就任の式典）
//
// 舞台のお仕事は、どこで引き受けても劇場ホールの舞台に移動して演じ、終わると元の場所に戻る。
// ギャグはすべてオリジナル。登場人物はすべて架空。

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet, drawFace } from '../engine/sprites.js';
import { defineTile, R, P, disc, shadowEllipse } from '../engine/tiles.js';
import { registerItem, payText } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text, panel } from '../engine/draw.js';
import { W, H, fmtMoney, pick } from '../engine/util.js';

const PID = 'shinkigeki';
const AG = 'yoshimoto';

// ------------------------------------------------------------------ palette
const RED = '#c8202c';
const RED_D = '#8a1420';
const RED_X = '#5e0c14';
const RED_L = '#e8505a';
const GOLD = '#f2c230';
const GOLD_D = '#b8861a';
const GOLD_L = '#ffe58a';
const CREAM = '#fff3da';
const CREAM_D = '#ead8b4';
const WOOD = '#9b6638';
const WOOD_D = '#5a3a20';
const WOOD_L = '#c48a52';
const INK = '#20232a';
const SKIN = '#f6c9a0';

// rect helper for entity draw() (screen ctx, whole pixels)
const box = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// ------------------------------------------------------------------ tiles: walls
function wallT(c) { // cornice row of a tall wall
  R(c, 0, 0, 16, 16, CREAM);
  R(c, 0, 0, 16, 5, RED); R(c, 0, 0, 16, 1, RED_L); R(c, 0, 4, 16, 1, RED_D);
  R(c, 0, 5, 16, 1, GOLD); R(c, 0, 6, 16, 1, GOLD_D);
  for (let x = 1; x < 16; x += 4) R(c, x, 7, 2, 2, CREAM_D);
  P(c, 4, 12, '#f2e0bc'); P(c, 12, 12, '#f2e0bc');
}
function wallU(c) { // plain wallpaper
  R(c, 0, 0, 16, 16, CREAM);
  for (let x = 3; x < 16; x += 8) R(c, x, 0, 1, 16, '#f6e6c4');
  P(c, 7, 4, '#ecd4a8'); P(c, 15, 12, '#ecd4a8'); P(c, 7, 12, '#f8ead0');
}
function wallL(c) { // lower wall: gold chair rail + red wainscot
  R(c, 0, 0, 16, 16, CREAM);
  for (let x = 3; x < 16; x += 8) R(c, x, 0, 1, 6, '#f6e6c4');
  R(c, 0, 6, 16, 2, GOLD); R(c, 0, 6, 16, 1, GOLD_L); R(c, 0, 8, 16, 1, GOLD_D);
  R(c, 0, 9, 16, 7, RED); R(c, 1, 10, 14, 4, '#b41c28'); R(c, 1, 10, 14, 1, RED_D);
  R(c, 0, 15, 16, 1, RED_X);
}
defineTile('shinkigeki_walltop', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#3e1218'); R(c, 0, 0, 16, 1, '#52202a'); R(c, 0, 15, 16, 1, '#a0303a'); },
});
defineTile('shinkigeki_wall_t', { solid: true, draw: wallT });
defineTile('shinkigeki_wall_u', { solid: true, draw: wallU });
defineTile('shinkigeki_wall', { solid: true, draw: wallL });
// backstage: plain dark walls
defineTile('shinkigeki_dwall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#3a3442'); R(c, 0, 0, 16, 1, '#4a4454');
    R(c, 5, 0, 1, 12, '#332e3a'); R(c, 12, 0, 1, 12, '#332e3a');
    R(c, 0, 12, 16, 4, '#1e1a24'); R(c, 0, 12, 16, 1, '#141018');
  },
});

// Red velvet feature wall (logo backdrop), 3 rows.
function velvet(c) {
  R(c, 0, 0, 16, 16, RED);
  for (let x = 1; x < 16; x += 4) R(c, x, 0, 1, 16, '#b41c28');
  for (let y = 0; y < 16; y += 8) {
    for (let x = 0; x < 16; x += 8) {
      P(c, x + 4, y + 4, GOLD); P(c, x + 3, y + 4, GOLD_D); P(c, x + 5, y + 4, GOLD_D); P(c, x + 4, y + 3, GOLD_D); P(c, x + 4, y + 5, GOLD_D);
    }
  }
}
defineTile('shinkigeki_feat_t', {
  solid: true,
  draw(c) { velvet(c); R(c, 0, 0, 16, 4, GOLD_D); R(c, 0, 1, 16, 2, GOLD); R(c, 0, 1, 16, 1, GOLD_L); R(c, 0, 4, 16, 1, RED_X); },
});
defineTile('shinkigeki_feat', { solid: true, draw: velvet });
defineTile('shinkigeki_feat_b', {
  solid: true,
  draw(c) { velvet(c); R(c, 0, 12, 16, 4, GOLD_D); R(c, 0, 12, 16, 1, GOLD_L); R(c, 0, 13, 16, 1, GOLD); R(c, 0, 15, 16, 1, RED_X); },
});

// Two tall show posters (top half sits on wall_u, bottom half on the lower wall).
defineTile('shinkigeki_posterA_t', { // a washtub drops on the lead
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 14, INK); R(c, 3, 3, 10, 13, '#ffd23f');
    R(c, 3, 3, 10, 3, RED); R(c, 4, 4, 2, 1, '#ffffff'); R(c, 7, 4, 2, 1, '#ffffff'); R(c, 10, 4, 2, 1, '#ffffff');
    R(c, 5, 9, 6, 2, '#c8ccd4'); R(c, 4, 10, 8, 1, '#9aa0aa'); R(c, 6, 9, 4, 1, '#eef0f4');
    P(c, 4, 8, '#ffffff'); P(c, 11, 8, '#ffffff'); P(c, 5, 7, '#ffffff'); P(c, 10, 7, '#ffffff');
    disc(c, 8, 14, 2, SKIN); R(c, 6, 12, 5, 1, '#2a2430');
  },
});
defineTile('shinkigeki_posterA', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 13, INK); R(c, 3, 0, 10, 12, '#ffd23f');
    R(c, 7, 0, 3, 4, '#e8873a'); R(c, 6, 1, 1, 2, '#e8873a'); R(c, 10, 1, 1, 2, '#e8873a'); R(c, 8, 1, 1, 3, RED);
    R(c, 7, 4, 1, 2, '#3b3f48'); R(c, 9, 4, 1, 2, '#3b3f48');
    P(c, 4, 2, RED); P(c, 4, 3, RED); P(c, 4, 5, RED); P(c, 12, 2, RED); P(c, 12, 3, RED); P(c, 12, 5, RED);
    R(c, 3, 7, 10, 4, RED); R(c, 4, 8, 3, 1, '#ffffff'); R(c, 8, 8, 4, 1, '#ffffff'); R(c, 5, 9, 6, 1, GOLD_L);
  },
});
defineTile('shinkigeki_posterB_t', { // the troupe leader's big grin
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 2, 12, 14, GOLD_D); R(c, 3, 3, 10, 13, RED);
    disc(c, 8, 11, 4, '#e0a878');
    R(c, 4, 6, 9, 2, '#2a2430'); R(c, 4, 8, 1, 2, '#2a2430'); R(c, 12, 8, 1, 2, '#2a2430');
    P(c, 6, 10, INK); P(c, 10, 10, INK); R(c, 6, 13, 5, 1, INK); P(c, 5, 12, INK); P(c, 11, 12, INK);
    P(c, 4, 4, GOLD_L); P(c, 12, 4, GOLD_L);
  },
});
defineTile('shinkigeki_posterB', {
  solid: true, obj: true,
  draw(c) {
    R(c, 2, 0, 12, 13, GOLD_D); R(c, 3, 0, 10, 12, RED);
    R(c, 4, 0, 9, 4, '#e8873a'); R(c, 8, 0, 1, 4, RED_X); R(c, 6, 0, 1, 3, '#ffffff'); R(c, 10, 0, 1, 3, '#ffffff');
    R(c, 4, 6, 9, 1, GOLD); R(c, 5, 8, 7, 1, GOLD); R(c, 6, 10, 5, 1, '#ffffff');
  },
});

// Theater double doors (lower halves are walkable warps).
function tdoor(side, upper) {
  const L = side === 'l';
  return (c) => {
    if (upper) {
      wallU(c);
      R(c, 0, 3, 16, 3, GOLD_D); R(c, 0, 3, 16, 1, GOLD_L); R(c, 0, 4, 16, 1, GOLD);
      R(c, L ? 1 : 0, 6, 15, 10, RED_X); R(c, L ? 2 : 0, 7, 14, 9, RED);
      disc(c, L ? 9 : 6, 11, 2, '#ffe9a8'); P(c, L ? 8 : 5, 10, '#ffffff');
      R(c, L ? 15 : 0, 7, 1, 9, '#3a0a10');
    } else {
      wallL(c);
      R(c, L ? 1 : 0, 0, 15, 16, RED_X); R(c, L ? 2 : 0, 0, 14, 15, RED);
      for (let y = 2; y < 15; y += 4) for (let x = L ? 4 : 2; x < (L ? 15 : 13); x += 4) P(c, x, y, GOLD);
      R(c, L ? 12 : 3, 4, 1, 6, GOLD_L);
      R(c, L ? 15 : 0, 0, 1, 15, '#3a0a10');
      R(c, 0, 15, 16, 1, '#3a0a10');
    }
  };
}
defineTile('shinkigeki_tdoor_ul', { solid: true, draw: tdoor('l', true) });
defineTile('shinkigeki_tdoor_ur', { solid: true, draw: tdoor('r', true) });
defineTile('shinkigeki_tdoor_l', { draw: tdoor('l', false) });
defineTile('shinkigeki_tdoor_r', { draw: tdoor('r', false) });
// Staff door (楽屋口).
defineTile('shinkigeki_sdoor_u', {
  solid: true,
  draw(c) {
    wallU(c);
    R(c, 2, 4, 12, 12, WOOD_D); R(c, 3, 5, 10, 11, WOOD);
    R(c, 5, 8, 6, 3, '#ffffff'); R(c, 6, 9, 4, 1, INK);
  },
});
defineTile('shinkigeki_sdoor', {
  draw(c) {
    wallL(c);
    R(c, 2, 0, 12, 16, WOOD_D); R(c, 3, 0, 10, 15, WOOD);
    R(c, 4, 2, 8, 4, '#a8743f'); R(c, 4, 8, 8, 5, '#a8743f');
    R(c, 11, 6, 2, 2, GOLD); R(c, 2, 15, 12, 1, '#3a2414');
  },
});

// ------------------------------------------------------------------ tiles: lobby furniture & floors
defineTile('shinkigeki_floor', {
  variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, v ? '#f3e3c3' : '#efdcb8');
    R(c, 0, 0, 16, 1, '#dcc49a'); R(c, 0, 0, 1, 16, '#dcc49a');
    P(c, 4, 4, '#fbf0dc'); P(c, 5, 4, '#fbf0dc'); P(c, 4, 5, '#fbf0dc');
    P(c, 11, 11, '#e2cca2');
  },
});
function runner(side) {
  return (c) => {
    R(c, 0, 0, 16, 16, RED);
    for (let y = 2; y < 16; y += 8) { P(c, side === 'l' ? 12 : 3, y + 2, GOLD); P(c, side === 'l' ? 12 : 3, y + 3, GOLD_D); }
    if (side === 'l') { R(c, 0, 0, 2, 16, GOLD); R(c, 2, 0, 1, 16, RED_D); } else { R(c, 14, 0, 2, 16, GOLD); R(c, 13, 0, 1, 16, RED_D); }
  };
}
defineTile('shinkigeki_runner_l', { draw: runner('l') });
defineTile('shinkigeki_runner_r', { draw: runner('r') });
defineTile('shinkigeki_counter', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 1, 16, 6, CREAM); R(c, 0, 1, 16, 1, '#ffffff'); R(c, 0, 7, 16, 1, CREAM_D);
    R(c, 0, 8, 16, 8, RED); R(c, 0, 8, 16, 1, GOLD); R(c, 0, 9, 16, 1, GOLD_D); R(c, 0, 15, 16, 1, RED_X);
    P(c, 8, 11, GOLD); P(c, 7, 12, GOLD); P(c, 9, 12, GOLD); P(c, 8, 13, GOLD);
    if (v) { R(c, 3, 3, 4, 2, '#ffd23f'); R(c, 3, 3, 4, 1, '#fff6c0'); R(c, 9, 2, 4, 3, '#ffffff'); R(c, 10, 3, 2, 1, RED); }
    else { R(c, 5, 3, 6, 3, '#ffffff'); R(c, 6, 4, 4, 1, '#9aa0aa'); P(c, 12, 3, RED); }
  },
});
defineTile('shinkigeki_goods', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WOOD_D); R(c, 1, 1, 14, 14, '#fff3e0');
    R(c, 1, 5, 14, 1, WOOD_D); R(c, 1, 10, 14, 1, WOOD_D);
    // fans (uchiwa)
    disc(c, 4, 3, 1, RED); disc(c, 8, 3, 1, GOLD); disc(c, 12, 3, 1, RED); P(c, 4, 4, WOOD_D); P(c, 8, 4, WOOD_D); P(c, 12, 4, WOOD_D);
    // manju boxes
    R(c, 2, 7, 5, 3, RED); R(c, 3, 8, 3, 1, GOLD_L); R(c, 9, 7, 5, 3, '#fff6c0'); R(c, 10, 8, 3, 1, RED);
    // folded towels
    R(c, 2, 12, 3, 2, '#5fd7ff'); R(c, 6, 12, 3, 2, RED); R(c, 10, 12, 4, 2, GOLD);
  },
});
defineTile('shinkigeki_bench', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 14, 14, 2, 'rgba(0,0,0,0.2)');
    R(c, 0, 3, 16, 5, RED_L); R(c, 0, 3, 16, 1, '#ff8a90');
    R(c, 0, 7, 16, 6, RED); R(c, 0, 7, 16, 1, GOLD); R(c, 0, 12, 16, 1, RED_D);
    R(c, 2, 13, 2, 2, '#3b2a20'); R(c, 12, 13, 2, 2, '#3b2a20');
  },
});
defineTile('shinkigeki_nobori', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    const bg = v ? GOLD : RED;
    const fg = v ? RED : '#ffffff';
    shadowEllipse(c, 6, 15, 4, 1);
    R(c, 3, 0, 1, 16, '#9aa0aa'); R(c, 3, 0, 10, 1, '#9aa0aa');
    R(c, 4, 1, 8, 13, bg); R(c, 11, 1, 1, 13, v ? GOLD_D : RED_D);
    for (let y = 3; y < 13; y += 3) { R(c, 6, y, 4, 1, fg); R(c, 7, y + 1, 2, 1, fg); }
  },
});
defineTile('shinkigeki_mat', {
  draw(c) {
    R(c, 0, 0, 16, 16, RED_X); R(c, 1, 1, 14, 14, RED);
    R(c, 2, 2, 12, 12, RED_D); R(c, 3, 3, 10, 10, RED);
    P(c, 8, 7, GOLD); P(c, 7, 8, GOLD); P(c, 9, 8, GOLD); P(c, 8, 9, GOLD);
  },
});

// ------------------------------------------------------------------ tiles: hall
defineTile('shinkigeki_carpet', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#5a1a24');
    P(c, 4, 4, '#6e2430'); P(c, 12, 12, '#6e2430'); P(c, 12, 4, '#4a1420'); P(c, 4, 12, '#4a1420');
  },
});
// Stage set: the front of the noodle shop "まんぷく亭".
defineTile('shinkigeki_set_roof', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#3b4250');
    for (let x = 0; x < 16; x += 4) { R(c, x, 0, 1, 10, '#2c323e'); R(c, x + 1, 7, 2, 3, '#5a6475'); P(c, x + 2, 8, '#77829a'); }
    R(c, 0, 10, 16, 1, '#22262e');
    R(c, 0, 11, 16, 3, WOOD); R(c, 0, 11, 16, 1, WOOD_L); R(c, 0, 14, 16, 2, WOOD_D);
  },
});
function setPlaster(c, pillar) {
  R(c, 0, 0, 16, 16, '#efdcb2');
  P(c, 5, 3, '#e0c898'); P(c, 11, 7, '#e0c898'); P(c, 7, 10, '#e0c898');
  R(c, 0, 12, 16, 4, '#8a5a2a'); R(c, 0, 12, 16, 1, '#a8743a');
  for (let x = 2; x < 16; x += 5) R(c, x, 13, 1, 3, '#6b4226');
  if (pillar) { R(c, 0, 0, 3, 16, WOOD); R(c, 1, 0, 1, 16, WOOD_L); R(c, 2, 0, 1, 16, WOOD_D); }
}
defineTile('shinkigeki_set_wall', { solid: true, draw: (c) => setPlaster(c, true) });
defineTile('shinkigeki_set_window', {
  solid: true,
  draw(c) {
    setPlaster(c, false);
    R(c, 1, 1, 14, 10, WOOD_D); R(c, 2, 2, 12, 8, '#2a3550'); R(c, 2, 2, 12, 2, '#39507a');
    for (let x = 3; x < 14; x += 2) R(c, x, 2, 1, 8, WOOD);
    R(c, 2, 5, 12, 1, WOOD);
  },
});
defineTile('shinkigeki_set_menu', {
  solid: true,
  draw(c) {
    setPlaster(c, false);
    R(c, 1, 1, 14, 10, WOOD_D);
    for (let i = 0; i < 4; i++) {
      const x = 2 + i * 3 + (i > 1 ? 1 : 0);
      R(c, x, 2, 2, 8, '#fff8e8');
      R(c, x, 3, 1, 3, INK); P(c, x + 1, 4, INK); P(c, x, 8, RED);
    }
  },
});
function setDoor(side) {
  const L = side === 'l';
  return (c) => {
    R(c, 0, 0, 16, 16, WOOD_D);
    R(c, L ? 2 : 0, 1, 14, 15, '#c8dcec');
    for (let x = L ? 5 : 3; x < 16; x += 4) R(c, x, 1, 1, 15, WOOD);
    R(c, L ? 2 : 0, 8, 14, 1, WOOD);
    R(c, L ? 2 : 0, 14, 14, 2, WOOD_D);
    // noren (indigo shop curtain) with a white circle split across the two tiles
    R(c, L ? 1 : 0, 0, 15, 8, '#2a3a7a'); R(c, L ? 1 : 0, 0, 15, 1, '#1a2450');
    R(c, L ? 15 : 0, 2, 1, 6, '#1a2450');
    if (L) { R(c, 13, 3, 3, 1, '#ffffff'); R(c, 12, 4, 1, 2, '#ffffff'); R(c, 13, 6, 3, 1, '#ffffff'); R(c, 5, 2, 1, 6, '#1a2450'); }
    else { R(c, 0, 3, 3, 1, '#ffffff'); R(c, 3, 4, 1, 2, '#ffffff'); R(c, 0, 6, 3, 1, '#ffffff'); R(c, 10, 2, 1, 6, '#1a2450'); }
  };
}
defineTile('shinkigeki_set_door_l', { solid: true, draw: setDoor('l') });
defineTile('shinkigeki_set_door_r', { solid: true, draw: setDoor('r') });
// Gap in the curtains at stage right that leads to the wings (walkable warp).
defineTile('shinkigeki_wing', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#16121a');
    R(c, 0, 0, 16, 5, '#a51f2c');
    for (let x = 1; x < 16; x += 4) { R(c, x, 0, 1, 5, '#7a1520'); R(c, x + 2, 0, 1, 5, '#d0404e'); }
    for (let x = 0; x < 16; x += 4) { R(c, x, 5, 4, 2, '#a51f2c'); R(c, x + 1, 7, 2, 1, '#7a1520'); }
    R(c, 0, 12, 16, 4, '#2a2024'); R(c, 0, 12, 16, 1, '#3a2c30');
    R(c, 2, 9, 12, 1, '#2a2430');
  },
});

// ------------------------------------------------------------------ tiles: backstage
defineTile('shinkigeki_bsdoor_u', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#3a3442'); R(c, 0, 0, 16, 1, '#4a4454');
    R(c, 2, 1, 12, 5, '#ffffff'); R(c, 3, 2, 10, 3, RED); R(c, 5, 3, 6, 1, '#ffffff');
    R(c, 1, 8, 14, 8, '#0c0a10'); R(c, 1, 8, 14, 2, '#7a1520'); for (let x = 1; x < 15; x += 3) P(c, x + 1, 10, '#a51f2c');
  },
});
defineTile('shinkigeki_bsdoor', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#3a3442');
    R(c, 1, 0, 14, 16, '#0c0a10');
    R(c, 1, 0, 2, 16, '#7a1520'); R(c, 13, 0, 2, 16, '#7a1520');
    R(c, 3, 13, 10, 3, '#2a2024'); P(c, 6, 14, GOLD_D); P(c, 10, 14, GOLD_D);
  },
});
// Stage monitor: the troupe on the little screen falls over every few seconds.
defineTile('shinkigeki_monitor', {
  solid: true, obj: true, frames: 4, speed: 24,
  draw(c, r, f) {
    R(c, 1, 2, 14, 10, INK);
    R(c, 2, 3, 12, 7, '#3b4250'); R(c, 2, 8, 12, 2, '#ddb06e');
    const down = f === 3;
    const cols = ['#c0452f', '#e8873a', '#ff7eb6'];
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 4;
      if (down && i !== 1) { R(c, x, 8, 3, 1, cols[i]); P(c, x + (i === 0 ? -1 : 3), 8, SKIN); }
      else { P(c, x + 1, 5, SKIN); R(c, x, 6, 3, 2, cols[i]); }
    }
    if (down) { P(c, 3, 4, '#ffffff'); P(c, 12, 4, '#ffffff'); }
    R(c, 6, 12, 4, 1, '#4a4e58');
  },
});
defineTile('shinkigeki_cuelight', {
  solid: true, obj: true, frames: 2, speed: 50,
  draw(c, r, f) {
    R(c, 3, 3, 10, 9, '#20232a'); R(c, 4, 4, 8, 7, '#2e3038');
    disc(c, 6, 6, 1, f ? '#5ee07a' : '#1f5a2a'); disc(c, 10, 6, 1, f ? '#5a1a1a' : '#ff2b3a');
    R(c, 5, 9, 6, 1, '#9aa0aa');
  },
});
defineTile('shinkigeki_callboard', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 2, 14, 10, WOOD_D); R(c, 2, 3, 12, 8, '#c8955a');
    R(c, 3, 4, 5, 6, '#ffffff'); R(c, 4, 5, 3, 1, INK); R(c, 4, 7, 3, 1, INK); R(c, 4, 8, 2, 1, RED);
    R(c, 9, 4, 4, 4, '#fff6a8'); R(c, 10, 5, 2, 1, INK); P(c, 5, 4, RED); P(c, 11, 4, '#2f6fd0');
  },
});
// Dressing-room vanity mirror with light bulbs (2 tiles tall: top on the cornice row).
function bulbs(c, xs, y) { for (const x of xs) { P(c, x, y, '#fff6a8'); P(c, x + 1, y, '#ffe27a'); } }
defineTile('shinkigeki_vanity_u', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 9, 14, 7, '#8a5a2a'); R(c, 3, 11, 10, 5, '#cfe8f5');
    bulbs(c, [2, 6, 10], 10); P(c, 4, 12, '#ffffff'); P(c, 5, 13, '#ffffff');
  },
});
defineTile('shinkigeki_vanity', {
  solid: true, obj: true,
  draw(c) {
    R(c, 1, 0, 14, 12, '#8a5a2a'); R(c, 3, 0, 10, 10, '#cfe8f5');
    for (let y = 2; y < 10; y += 3) { P(c, 1, y, '#fff6a8'); P(c, 14, y, '#fff6a8'); }
    P(c, 6, 1, '#ffffff'); P(c, 7, 2, '#ffffff'); P(c, 10, 5, '#eaf6ff'); P(c, 11, 4, '#eaf6ff');
    R(c, 1, 11, 14, 1, '#5a3a1a');
  },
});
defineTile('shinkigeki_dresser', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 1, 16, 6, '#f6f0e6'); R(c, 0, 1, 16, 1, '#ffffff');
    R(c, 0, 7, 16, 6, '#c48a52'); R(c, 0, 7, 16, 1, '#8a5a2a'); R(c, 7, 8, 2, 4, '#8a5a2a'); P(c, 4, 10, GOLD); P(c, 11, 10, GOLD);
    R(c, 2, 2, 2, 3, RED); R(c, 5, 3, 3, 2, '#ff9aa8'); R(c, 10, 2, 1, 3, INK); R(c, 12, 3, 2, 2, '#5fd7ff');
  },
});
defineTile('shinkigeki_blackcurtain', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#1c1a22');
    for (let x = 1; x < 16; x += 4) { R(c, x, 0, 1, 16, '#0e0c12'); R(c, x + 2, 0, 1, 16, '#2c2834'); }
    R(c, 0, 15, 16, 1, '#0a080c');
  },
});
// Prop shelf: washtubs, paper fans, pots...
defineTile('shinkigeki_props', {
  solid: true, obj: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#4a3a2a'); R(c, 1, 1, 14, 14, '#2a2024');
    R(c, 1, 7, 14, 1, '#6b5038'); R(c, 1, 14, 14, 1, '#6b5038');
    R(c, 2, 4, 7, 3, '#c8ccd4'); R(c, 1, 5, 9, 1, '#9aa0aa'); R(c, 3, 4, 5, 1, '#eef0f4');
    R(c, 11, 2, 3, 5, '#ffffff'); P(c, 12, 3, '#c8ccd4'); P(c, 12, 5, '#c8ccd4');
    R(c, 2, 10, 5, 4, '#3b3f48'); R(c, 3, 9, 3, 1, '#5a5f6b');
    R(c, 9, 11, 5, 3, '#ffd23f'); R(c, 10, 10, 3, 1, RED);
  },
});
// Blue gym mat for fall practice (walkable).
defineTile('shinkigeki_pmat', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#2a5aa8'); R(c, 1, 1, 14, 14, '#3a6fd0');
    R(c, 0, 7, 16, 1, '#2a5aa8'); R(c, 7, 0, 1, 16, '#2a5aa8');
    P(c, 3, 3, '#5a8ae0'); P(c, 11, 11, '#5a8ae0');
  },
});
function chabudai(side) {
  const L = side === 'l';
  return (c) => {
    shadowEllipse(c, L ? 15 : 0, 13, 12, 2);
    R(c, L ? 3 : 0, 4, L ? 13 : 13, 7, '#8a5a33');
    R(c, L ? 2 : 0, 5, L ? 14 : 14, 5, '#b98552');
    R(c, L ? 4 : 0, 4, L ? 12 : 12, 1, '#d6a06a');
    R(c, L ? 4 : 2, 11, 2, 3, '#5a3a20');
    if (L) { R(c, 6, 6, 3, 3, '#ffffff'); R(c, 7, 6, 1, 1, '#5ee07a'); R(c, 11, 6, 3, 2, '#d0a050'); }
    else { R(c, 3, 6, 3, 3, '#ffffff'); P(c, 4, 6, '#5ee07a'); R(c, 7, 5, 4, 4, '#3b6b4a'); R(c, 8, 4, 2, 1, '#3b6b4a'); }
  };
}
defineTile('shinkigeki_chabudai_l', { solid: true, obj: true, talkThrough: true, draw: chabudai('l') });
defineTile('shinkigeki_chabudai_r', { solid: true, obj: true, talkThrough: true, draw: chabudai('r') });

// ------------------------------------------------------------------ items & music
registerItem('shinkigeki_manju', { name: 'ズッコケまんじゅう', price: 300, desc: '体力が25回復する。ころんと丸い劇場名物。', heal: 25 });
registerItem('shinkigeki_tenugui', { name: '一座の手ぬぐい', price: 300, desc: '次の「お笑い」のミニゲームが少しやさしくなる。', buff: 'warai' });
registerItem('shinkigeki_photo', { name: '顔ハメ記念写真', price: 0, desc: '劇場の顔ハメ看板で撮った一枚。いい笑顔！' });
registerItem('shinkigeki_happi', { name: '座長の法被', price: 0, desc: '新喜劇の座長のしるし。背中に金の刺しゅうが光る。' });

// Original bouncy theme for the hall and the shows.
registerSong('shinkigeki_theme', {
  bpm: 160, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'F5 . A5 . C6 . A5 . | Bb5 . G5 . E5 . C5 . | D5 . F5 . A5 . F5 . | G5 - - . C5 . . . | F5 . A5 . C6 . D6 . | C6 . A5 . F5 . A5 . | G5 . Bb5 . A5 . G5 . | F5 - - . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | C3 . G2 . C3 . E3 . | F2 . C3 . F2 . C3 . | F2 . A2 . C3 . A2 . | C3 . G2 . C3 . E3 . | F2 . C3 . F2 . . .' },
    { wave: 'drum', vol: 0.09, notes: 'k . h s k . h s | k h h s k . s s' },
  ],
});

// ------------------------------------------------------------------ people
// The troupe looks the same as in the zukko minigame (same stage family).
const WHO = {
  ticket: { name: 'チケット係さん', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: RED, bottom: '#3a1a1a', skirt: true, jacket: true, tie: GOLD } },
  annai: { name: '案内係さん', look: { hair: 'long', hairColor: 'black', skin: 'light', top: RED, bottom: '#3a1a1a', skirt: true, jacket: true } },
  goods: { name: 'グッズ売り場の店員', look: { hair: 'twin', hairColor: 'brown', skin: 'fair', top: GOLD, bottom: '#5a3a20', skirt: true } },
  guard: { name: '楽屋番のおっちゃん', look: { ...LOOKS.guard, hat: RED_X, top: '#5e2a2a', bottom: '#3a1a1a' } },
  mogiri: { name: 'もぎりのお兄さん', look: { hair: 'short', hairColor: 'black', skin: 'fair', top: RED, bottom: INK, jacket: true, tie: GOLD } },
  fan: { name: '新喜劇ファン', look: { ...LOOKS.fan, top: '#ff7eb6' } },
  joren: { name: '常連のおっちゃん', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#d0a040', bottom: '#4a3a2a', glasses: true } },
  kid: { name: 'ズッコケ少年', look: { ...LOOKS.kid, hair: 'spiky', top: RED, bottom: '#2f6fd0' } },
  kyaku1: { name: '常連のおばあちゃん', look: LOOKS.oldwoman },
  kyaku2: { name: '修学旅行生', look: { ...LOOKS.kid, top: '#2a3560', bottom: '#2a3560' } },
  kyaku3: { name: '旅行中のお客さん', look: LOOKS.tourist },
  shoumei: { name: '照明さん', look: { ...LOOKS.staff, hat: GOLD } },
  sakka: { name: '台本作家', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#5a6f8a', bottom: '#3b3f48', glasses: true, beard: true } },
  moji: { name: '若手座員 もじ丸', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#2f6fd0' } },
  zacho: { name: '座長 茶谷どん平', look: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#e8873a', bottom: '#3b3f48', jacket: true, tie: '#d62f2f' } },
  okami: { name: 'おかみ役 さち代', look: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: '#c0452f', bottom: '#f2f2f2', skirt: true } },
  genji: { name: '源じい役 源三', look: { ...LOOKS.oldman, top: '#6b7f4a' } },
  madonna: { name: 'マドンナ役 ゆり子', look: { hair: 'long', hairColor: 'black', skin: 'light', top: '#ff7eb6', bottom: '#f2f2f2', skirt: true } },
  butai: { name: '舞台監督', look: { ...LOOKS.staff, top: INK, hat: RED } },
  sensei: { name: '受け身の師匠 転田', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#2f6fd0', bottom: '#2f6fd0', shoes: '#f2f2f2' } },
  koro: { name: '若手座員 ころ助', look: { hair: 'short', hairColor: 'brown', skin: 'fair', top: GOLD, bottom: '#3b3f48' } },
  obachan: { name: '楽屋のおばちゃん', look: { ...LOOKS.mom, top: '#9273bd', hairColor: 'purple' } },
  ana: { name: '場内アナウンス' },
  troupe: { name: '一座のみなさん' },
};
const AUD = [
  LOOKS.fan, LOOKS.mom, LOOKS.oldman, LOOKS.salaryman, LOOKS.kid, { ...LOOKS.fan, hairColor: 'brown', top: '#ff9a3c' },
  LOOKS.tourist, { ...LOOKS.mom, top: '#5fd7ff' }, { ...LOOKS.salaryman, tie: RED }, LOOKS.oldwoman, { ...LOOKS.kid, top: '#ff7eb6', hair: 'twin', skirt: true }, LOOKS.clerk,
];

// ------------------------------------------------------------------ sprites (seated / lying)
const sheetOf = (g, e) => (e === g.map.player ? charSheet(g.state.look || {}) : (e.sheet || charSheet(e.look || {})));

// Someone sitting in a theater seat / on a bench, seen from behind (or turned towards you).
function seatedSprite(back, hi) {
  return (ctx, x, y, g, e) => {
    x = Math.round(x); y = Math.round(y);
    const sh = sheetOf(g, e);
    const img = (sh[e.dir] || sh.down)[0];
    ctx.drawImage(img, 0, 0, 16, 13, x, y - 1, 16, 13);
    if (e.dir === 'up') {
      box(ctx, x + 1, y + 5, 14, 6, back); box(ctx, x + 1, y + 5, 14, 1, hi);
      box(ctx, x, y + 6, 1, 8, '#3b2a20'); box(ctx, x + 15, y + 6, 1, 8, '#3b2a20');
    } else {
      box(ctx, x + 2, y + 10, 12, 3, hi); box(ctx, x + 2, y + 12, 12, 1, back);
    }
  };
}
const seated = seatedSprite('#9e1f2a', '#e05462');
const benchSeated = seatedSprite(RED, '#ff8a90');
// Sitting on a cushion on the tatami.
function zabuton(ctx, x, y, g, e) {
  x = Math.round(x); y = Math.round(y);
  const sh = sheetOf(g, e);
  box(ctx, x + 1, y + 9, 14, 6, '#6b3a8a'); box(ctx, x + 1, y + 9, 14, 1, '#8a5ab0'); box(ctx, x + 2, y + 14, 12, 1, '#4a2460');
  ctx.drawImage((sh[e.dir] || sh.down)[0], 0, 0, 16, 15, x, y - 1, 16, 15);
}

// The famous all-together fall: rotate the standing sprite onto its side.
function fall(g, id, side = 1) {
  const e = id === 'player' ? g.map.player : g.npc(id);
  if (!e || e.skFall) return;
  e.skFall = { prev: e.sprite || null, t0: g.frame, side };
  e.sprite = (ctx, x, y, gg, ent) => {
    const f = ent.skFall;
    if (!f) return;
    const dt = gg.frame - f.t0;
    const k = Math.min(1, dt / 5);
    const img = sheetOf(gg, ent).down[0];
    ctx.save();
    ctx.translate(Math.round(x) + 8, Math.round(y) + 9);
    ctx.rotate(f.side * k * Math.PI / 2);
    ctx.drawImage(img, -8, -10);
    ctx.restore();
    if (k >= 1 && dt < 16) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(x) - 3 - (dt >> 2), Math.round(y) + 13, 2, 1);
      ctx.fillRect(Math.round(x) + 17 + (dt >> 2), Math.round(y) + 13, 2, 1);
    }
  };
}
function getUp(g, id) {
  const e = id === 'player' ? g.map.player : g.npc(id);
  if (!e || !e.skFall) return;
  e.sprite = e.skFall.prev;
  e.skFall = null;
}
function clearPlayerFx(g) {
  const p = g.map.player;
  p.skFall = null;
  p.sprite = null;
  p.hidden = false;
}

async function drumroll(g, n = 8) {
  for (let k = 0; k < n; k++) { g.sfx('snare'); await g.wait(70); }
}

// Everybody (but the one who told the gag) falls over together.
async function zukkoAll(g, leadId, ids, withPlayer = false, extraEmotes = []) {
  const lead = leadId ? g.npc(leadId) : null;
  const lx = lead ? lead.x : 10;
  g.sfx('zukko');
  g.shake(14, 3);
  const fell = [];
  for (const id of ids) {
    const e = g.npc(id);
    if (!e || !g.map.visible(e) || id === leadId) continue;
    fall(g, id, e.x < lx ? -1 : 1);
    fell.push(id);
  }
  if (withPlayer) { fall(g, 'player', g.map.player.x < lx ? -1 : 1); fell.push('player'); }
  await g.wait(260);
  g.sfx('laugh');
  await Promise.all([
    ...(lead ? [g.emote(leadId, '?', 50)] : []),
    ...extraEmotes.map((id, i) => g.emote(id, i % 2 ? 'w' : '!', 50)),
  ]);
  await g.wait(250);
  for (const id of fell) getUp(g, id);
}

// ------------------------------------------------------------------ zukko minigame content (all original)
const FAKES = [
  { setup: 'ほな、ここで一発いくで！', cue: '…やっぱり、やめとくわ。' },
  { setup: 'みんな、よう聞いてや！', cue: '…お茶、おかわりあるで。' },
  { setup: 'とっておきの話があるねん。', cue: '…また今度、話すわ。' },
  { setup: 'ちょっと、そこの人！', cue: '…いえ、なんでもないです。' },
];
const GAGS_EXTRA = [
  { setup: '商店街のみなさん、聞いてや！', cue: '…今日も、ええ天気や！' },
  { setup: 'このコロッケ、揚げたてやで！', cue: '…きのうのな！' },
  { setup: '迷子の子を見つけたで！', cue: '…よう見たら、ワシの孫や！' },
  { setup: '急いでるんや、そこ通して！', cue: '…あ、今日は休みやった！' },
  { setup: 'あの人、有名人ちゃうか？', cue: '…ポスターに話しかけとった！' },
  { setup: 'お兄さん、財布落としたで！', cue: '…ワシのやったわ！' },
];
const GAGS_CHOTTO = [
  { setup: '毎度！ 出前、届けに来ました！', cue: '…お店、まちがえました！' },
  { setup: 'このうどん、ダシが自慢やねん。', cue: '…ダシ、入れ忘れたわ！' },
  { setup: '店長、お客さんが来はったで！', cue: '…あ、ワシの母ちゃんや！' },
  { setup: '大変や！ 冷蔵庫が空っぽや！', cue: '…電源、入ってへんかった！' },
  { setup: 'お会計、千円になります。', cue: '…ほな、おつり二千円！' },
  { setup: 'うちの看板娘を紹介するで！', cue: '…今年で九十歳や！' },
  { setup: '新メニューの味見、たのむわ！', cue: '…ワシが全部食べてもうた！' },
];
const GAGS_JUN = [
  { setup: 'みんな静かに！ 大事な発表や！', cue: '…今日の晩ごはん、カレーや！' },
  { setup: 'ワシ、この家を出ていくで！', cue: '…夕方には帰るけどな！' },
  { setup: '探してたメガネ、どこや〜？', cue: '…頭の上にのっとった！' },
  { setup: '大事な書類、届けに来たで！', cue: '…中身、白紙やった！' },
  { setup: '今日こそ告白するんや…！', cue: '…あ、相手の名前忘れた！' },
  { setup: '見てくれ、この筋肉！', cue: '…セーターの重ね着や！' },
  { setup: '泥棒や！ 捕まえてくれ！', cue: '…あ、ワシの影やった！' },
];
const GAGS_KEY = [
  { setup: '十年ぶりやな、兄さん…！', cue: '…あ、きのうも会うたわ！' },
  { setup: '泣かせる話をしたるわ…。', cue: '…タマネギ切っとっただけや！' },
  { setup: 'もう、だれも信じられへん！', cue: '…天気予報以外はな！' },
  { setup: '覚悟はできてる。さあ斬れ！', cue: '…やっぱり、ちょっと待って！' },
  { setup: 'この店の秘伝のタレや…！', cue: '…スーパーの特売品や！' },
  { setup: '親方、ついに完成しました！', cue: '…設計図が！' },
  { setup: 'この手紙、最後まで読んでや…。', cue: '…裏に、買い物メモ書いてある！' },
  { setup: '真犯人は、この中におる！', cue: '…ワシの夢の中にな！' },
];
const GAGS_ZACHO = [
  { setup: 'ワシが、この店を継ぐ！', cue: '…あさってから！' },
  { setup: 'ほな、最後にひと言だけ…。', cue: '…ひと言って、何文字までや？' },
  { setup: '一座のみんな、ありがとう…！', cue: '…ほな、解散！' },
  { setup: 'これが、ワシの本気や！', cue: '…本気出したら、腰いわした！' },
  { setup: 'この幕が下りても、笑いは続く！', cue: '…あかん、幕のひもが絡まった！' },
  { setup: 'さあ、いよいよフィナーレや！', cue: '…フィナーレって、何やったっけ？' },
  { setup: 'ワシの夢はな、世界一の…', cue: '…昼寝名人や！' },
  { setup: '今日は大事な記念日なんや！', cue: '…このおでんの、三日目記念日や！' },
  { setup: 'みんな、ワシについてこい！', cue: '…あ、出口どっちやったっけ？' },
];

// ------------------------------------------------------------------ jobs
const JOBS = [
  {
    key: 'extra', label: '通行人役のエキストラ', mode: 'extra',
    info: '舞台を横切る通行人の役。\nだれでもOK／体力-15',
    def: { id: 'shinkigeki_extra', title: '通行人役のエキストラ', desc: 'ギャグのオチで、みんなとズッコケよう！', client: '舞台監督', stamina: 15, minigame: 'zukko', opts: { difficulty: 1, gags: GAGS_EXTRA, fakes: FAKES }, pay: 1000, fame: 5, skill: 'warai', gain: 2 },
  },
  {
    key: 'chotto', label: 'ちょい役で出演', mode: 'chotto',
    info: 'セリフのある小さな役で出演！\nよしもと所属 か ★100〜／体力-20',
    // "yoshimoto OR ★100": blockReason() says it in the stage manager's words; requires.anyOf keeps g.job in agreement
    def: { id: 'shinkigeki_chotto', title: '新喜劇にちょい役で出演', desc: '出前持ちの役や。セリフもあるで！', client: '舞台監督', stamina: 20, minigame: 'zukko', opts: { difficulty: 2, gags: GAGS_CHOTTO, fakes: FAKES }, pay: 4500, fame: 15, skill: 'warai', gain: 2, requires: { anyOf: [{ agency: AG }, { fame: 100 }] } },
  },
  {
    key: 'jun', label: '準レギュラー出演', mode: 'jun',
    info: '一座の準レギュラーとして出演！\nよしもと所属・★250〜／体力-25',
    def: { id: 'shinkigeki_jun', title: '新喜劇 準レギュラー', desc: '一座の顔として舞台をもり上げよう！', client: '舞台監督', stamina: 25, minigame: 'zukko', opts: { difficulty: 3, gags: GAGS_JUN, fakes: FAKES }, pay: 11000, fame: 40, skill: 'warai', gain: 3, requires: { agency: AG, fame: 250 } },
  },
  {
    key: 'key', label: '座長公演の重要な役', mode: 'key',
    info: '物語のカギをにぎる大事な役！\nよしもと所属・★1000〜／体力-25',
    def: { id: 'shinkigeki_key', title: '座長公演の重要な役', desc: '物語のカギをにぎる大事な役や！', client: '座長', stamina: 25, minigame: 'zukko', opts: { difficulty: 4, gags: GAGS_KEY, fakes: FAKES }, pay: 30000, fame: 110, skill: 'warai', gain: 3, requires: { agency: AG, fame: 1000 } },
  },
  {
    key: 'zacho', label: '座長に抜擢！', mode: 'zacho',
    info: '座長として舞台の真ん中に立つ！\nよしもと所属・★2000〜（1日1回）',
    def: { id: 'shinkigeki_zacho', title: '座長に抜擢！', desc: '今日の主役は、あんたや！', client: '座長', stamina: 30, minigame: 'zukko', opts: { difficulty: 5, gags: GAGS_ZACHO, fakes: FAKES }, pay: 65000, fame: 220, skill: 'warai', gain: 4, requires: { agency: AG, fame: 2000 } },
  },
];
const job = (key) => JOBS.find((j) => j.key === key);

// ------------------------------------------------------------------ state while a show is staged in the hall
let show = null;     // null | 'watch' | 'extra' | 'chotto' | 'jun' | 'key' | 'zacho'
let party = false;   //座長就任の式典
let curtainK = 0;    // 0 = open, 1 = closed
let lights = false;  // house lights down, stage lit
let spot = null;     // { until } 照明さん's spotlight on the player
let flashUntil = 0;  // photo flash in the lobby
let kaohame = false; // player's face in the photo board

// ------------------------------------------------------------------ helpers
const member = (g) => g.state.agency === AG;
const today = (g, k) => g.flag(k) === g.state.day;
const canChotto = (g) => member(g) || g.state.fame >= 100;
function here(g) {
  const p = g.map.player;
  return { room: g.map.roomId, x: p.x, y: p.y, dir: p.dir };
}
const faceNpc = (g, id, dir) => { const e = g.npc(id); if (e) e.dir = dir; };
function dirTo(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
// Walk an NPC next to the player (closest free tile) and face each other.
async function approach(g, id, speed = 1.5) {
  const e = g.npc(id);
  const p = g.map.player;
  if (!e) return;
  if (Math.abs(p.x - e.x) + Math.abs(p.y - e.y) > 1) {
    const spot2 = [[0, -1], [1, 0], [-1, 0], [0, 1]]
      .map(([dx, dy]) => [p.x + dx, p.y + dy])
      .filter(([x, y]) => !g.map.blocked(x, y, e) && !g.map.warpAt(x, y))
      .sort((a, b) => (Math.abs(a[0] - e.x) + Math.abs(a[1] - e.y)) - (Math.abs(b[0] - e.x) + Math.abs(b[1] - e.y)))[0];
    if (spot2) await g.walkNpcTo(id, spot2[0], spot2[1], speed);
  }
  g.facePlayer(dirTo(p.x, p.y, e.x, e.y));
  e.dir = dirTo(e.x, e.y, p.x, p.y);
}

// inside = said by someone in the backstage (no need to point at the stage door)
function hintFor(g, inside = false) {
  const st = g.state;
  if (!st.agency) {
    return [
      inside ? 'まずは「通行人役のエキストラ」からやな。\n舞台監督に言うたら、すぐ出られるで。' : 'まずは「通行人役のエキストラ」からやな。\n楽屋口から入って、舞台監督に声をかけてみ。',
      'よしもとに入りたいなら、\n舞台監督が「座員オーディション」も\nやってるで！',
    ];
  }
  if (!member(g)) {
    return st.fame < 100
      ? 'よその事務所の人も大歓迎や！\nエキストラで顔を売って★100になったら、\nちょい役で出られるで。'
      : 'ちょい役なら、いつでも出てや！\n準レギュラーから上は、\nよしもと所属の座員だけなんや。';
  }
  if (st.fame < 250) return 'ちょい役で場数を踏もう！\n★250になったら、準レギュラーの声がかかるで。';
  if (st.fame < 1000) return '準レギュラーで大活躍やな！\n★1000になったら、座長公演の大事な役をまかせたい。';
  if (st.fame < 2000) return '★2000になったら…座長に抜擢されるかもしれへんで！';
  if (!g.flag('shinkigeki_zacho')) return inside ? 'いよいよ座長に抜擢のチャンスや！\nお仕事の「座長に抜擢！」で、主役に挑戦や！' : 'いよいよ座長に抜擢のチャンスや！\n楽屋の座長か舞台監督に声をかけてみ！';
  return '座長、おつかれさまです！\n国民的スターまで、あと少しや！';
}

// The same advice in the front-of-house staff's polite words.
function politeHint(g) {
  const st = g.state;
  if (!st.agency) return ['舞台に立ってみたい方は、\n楽屋口の奥の舞台監督へどうぞ！\nエキストラなら、どなたでも出られます。', 'よしもとの「座員オーディション」も、\n舞台監督が受け付けていますよ♪'];
  if (!member(g)) return st.fame < 100 ? 'エキストラで経験を積んで★100になると、\n「ちょい役」で出演できるそうですよ！' : '「ちょい役」なら出演できますよ！\n準レギュラーから上は、\nよしもと所属の方だけなんです。';
  if (st.fame < 250) return 'ちょい役でたくさん出演して、\n★250を目指しましょう！\n準レギュラーのお声がかかりますよ♪';
  if (st.fame < 1000) return '準レギュラーとして大活躍ですね！\n★1000になると、座長公演の\n大事な役が回ってきますよ。';
  if (st.fame < 2000) return '★2000になったら…座長に抜擢されるかもしれません！\n楽しみにしていますね♪';
  if (!g.flag('shinkigeki_zacho')) return '座長に抜擢のチャンスです！\n楽屋の座長か舞台監督に、声をかけてみてください！';
  return '座長、いつもありがとうございます！\n国民的スターまで、あと少しですね♪';
}

function blockReason(g, j) {
  if (j.key === 'chotto' && !canChotto(g)) {
    return 'ちょい役は、よしもと所属の人か\n★100以上の人にお願いしてるんや。\nまずはエキストラで顔を売ろか！';
  }
  if (j.key === 'zacho' && today(g, 'shinkigeki_zacho_day')) return '今日の座長公演は、もう幕が下りたで。\nまた明日な！';
  // the engine's reasons are narration ("…のようだ。"); here the stage manager / troupe leader says them
  const r = j.def.requires || {};
  if (r.agency && g.state.agency !== r.agency) {
    const next = !g.state.agency ? '「座員オーディション」に受かって、\n一座の仲間になってや！'
      : canChotto(g) ? 'ちょい役なら、いつでも出てや！' : 'まずはエキストラで、顔を売ろか！';
    return ['この役は、よしもと所属の座員に\nお願いしてるんや。', next];
  }
  if (r.fame && g.state.fame < r.fame) return `この役は★${r.fame}からやな。（いまは★${g.state.fame}）\nもうちょい顔を売ってからや！`;
  return g.checkRequires(j.def.requires);
}
function lockLabel(g, j) {
  if (j.key === 'chotto') return canChotto(g) ? null : 'よしもとか★100';
  if (j.key === 'zacho' && today(g, 'shinkigeki_zacho_day')) return '本日終了';
  const r = j.def.requires || {};
  if (r.agency && g.state.agency !== r.agency) return 'よしもと所属';
  if (r.fame && g.state.fame < r.fame) return `★${r.fame}〜`;
  return null;
}
const confirmText = (def) => `${def.desc}\n「${def.title}」\n${payText(def.pay)}／体力 -${def.stamina}`;

// ------------------------------------------------------------------ confetti & celebration card
const CONFETTI = [GOLD, RED, '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff'];
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
        const h = Math.round(78 * k);
        panel(ctx, 36, 86 - h / 2, W - 72, Math.max(8, h), { bg: RED_X, edge: GOLD });
        if (k >= 1) {
          text(ctx, title, W / 2, 56, { size: 24, align: 'center', color: GOLD_L, outline: '#3a0a10' });
          text(ctx, sub, W / 2, 96, { size: 12, align: 'center', color: '#ffffff', shadow: '#3a0a10' });
        }
      },
    };
    g.push(scene);
  });
}

// ------------------------------------------------------------------ hall: show staging
const CAST = { zacho: 'sk_h_zacho', okami: 'sk_h_okami', genji: 'sk_h_genji', madonna: 'sk_h_madonna' };
const CAST_IDS = Object.values(CAST);
const AUD_SEATS = [[3, 8], [6, 8], [12, 8], [16, 8], [2, 10], [7, 10], [12, 10], [16, 10], [5, 12], [11, 12], [3, 14], [14, 14]];
const AUD_IDS = AUD_SEATS.map((_, i) => `sk_aud${i + 1}`);
const CROWD = ['sk_kyaku1', 'sk_kyaku2', 'sk_kyaku3', ...AUD_IDS];

async function moveCurtain(g, to, frames = 36) {
  const from = curtainK;
  if (to > from) g.sfx('drum');
  for (let i = 1; i <= frames; i++) {
    curtainK = from + (to - from) * (i / frames);
    await g.waitFrames(1);
  }
  curtainK = to;
}

async function crowdEmote(g, kinds, frames = 50) {
  const ids = CROWD.filter((id) => { const e = g.npc(id); return e && g.map.visible(e); });
  await Promise.all(ids.map((id, i) => g.emote(id, kinds[i % kinds.length], frames)));
}

async function crowdReact(g, res) {
  if (res.rank === 'S' || res.rank === 'A') {
    g.sfx('laugh');
    await crowdEmote(g, ['w', '!', '♥'], 60);
    g.sfx('applause');
  } else if (res.rank === 'B') {
    g.sfx('applause');
    await crowdEmote(g, ['♪', 'w'], 50);
  } else {
    await crowdEmote(g, ['…', '?'], 50);
  }
}

// Mini-script helpers used by the watch-a-show sketches.
function kit(g) {
  const idOf = (w) => CAST[w];
  return {
    say: (w, t) => g.say(t, WHO[w]),
    walk: (w, x, y, sp = 1) => g.walkNpcTo(idOf(w), x, y, sp),
    face: (w, dir) => faceNpc(g, idOf(w), dir),
    emote: (w, k, f = 40) => g.emote(idOf(w), k, f),
    enter: (w, x, y, dir) => { g.placeNpc(idOf(w), x, y, dir); g.showNpc(idOf(w), true); },
    hide: (w) => g.showNpc(idOf(w), false),
    all: (k, f = 40) => Promise.all(CAST_IDS.filter((id) => { const e = g.npc(id); return e && g.map.visible(e); }).map((id) => g.emote(id, k, f))),
    drum: () => drumroll(g),
    // the punch line from the troupe leader, then everyone (the player too, in the seats) falls over
    gag: async (line) => {
      await g.say(line, WHO.zacho);
      await zukkoAll(g, CAST.zacho, CAST_IDS, true, CROWD.slice(0, 6));
    },
  };
}

// Three original sketches. The day picks which one is on.
const SKETCHES = [
  {
    title: 'まんぷく亭の看板メニュー',
    place: { okami: [7, 4, 'down'], genji: [12, 4, 'down'] },
    run: async (g, S) => {
      await S.say('okami', 'いらっしゃい！\n…なんや、源じいかいな。');
      S.face('genji', 'left');
      await S.say('genji', '今日はな、とびきりのお客さんを\n連れてきたんや！');
      S.enter('madonna', 18, 5, 'left');
      await S.walk('madonna', 14, 5);
      S.face('madonna', 'left');
      await S.emote('okami', '!');
      await S.say('madonna', 'はじめまして。\nこちらに伝説の料理人がいると聞いて…。');
      await S.say('okami', '伝説の料理人…？\nどん平さーん！ お客さんやでー！');
      g.sfx('door');
      S.enter('zacho', 9, 3, 'down');
      await S.walk('zacho', 9, 4);
      S.face('zacho', 'down');
      await S.emote('zacho', '♪');
      await S.say('zacho', '呼んだかいな？\nワシがこの店の料理長、どん平や！');
      await S.say('madonna', 'まあ素敵！ 自慢の看板メニューを、ぜひひと口…！');
      await S.say('zacho', 'よっしゃ、まかしとき！\nうちの看板メニューはな…');
      await S.drum();
      await S.gag('…となりの店から、\n出前でとってるんや！');
      await S.say('okami', '自分で作らんかい！！');
      await S.say('zacho', 'えへへ…。\nほな、出前の電話かけてくるわ！');
    },
  },
  {
    title: '宝くじ大さわぎ',
    place: { okami: [6, 4, 'down'], madonna: [14, 4, 'down'] },
    run: async (g, S) => {
      await S.say('okami', '今日もお客さん、来はらへんなあ…。');
      S.enter('genji', 18, 5, 'left');
      await S.walk('genji', 10, 5, 2);
      await S.all('!');
      await S.say('genji', 'た、た、大変やーー！\n宝くじが当たったかもしれへん！');
      g.sfx('door');
      S.enter('zacho', 9, 3, 'down');
      await S.walk('zacho', 9, 4);
      await S.say('zacho', 'なんやて！？\nどれどれ、ワシが見たろ。');
      S.face('zacho', 'right');
      await S.drum();
      await S.say('zacho', '…おお！ 当たっとる！\n一等や！！');
      await S.all('♥');
      await S.say('madonna', 'すごい！ おめでとうございます！');
      await S.say('genji', 'うれしいなあ！\nで、どん平。いくら当たったんや？');
      await S.gag('…去年のくじや！\n引きかえ期限、とっくに過ぎとる！');
      await S.say('genji', 'ぬか喜びさせんといてーな！');
      await S.say('okami', 'まあまあ。夢見られたぶん、\nお得やったやないの。');
    },
  },
  {
    title: 'どん平のお見合い大作戦',
    place: { zacho: [9, 4, 'down'], okami: [7, 4, 'down'], genji: [11, 4, 'down'] },
    run: async (g, S) => {
      S.face('okami', 'right');
      await S.say('okami', 'どん平さん、今日はいよいよお見合いやで！\nしっかりしいや！');
      await S.emote('zacho', '…');
      await S.say('zacho', 'ま、まかしとき！\n練習もばっちりや！');
      await S.say('genji', 'ほんまかいな…。');
      S.enter('madonna', 18, 5, 'left');
      await S.walk('madonna', 13, 5);
      S.face('madonna', 'left');
      await S.say('madonna', 'はじめまして。ゆり子と申します。');
      await S.emote('zacho', '♥');
      S.face('zacho', 'right');
      await S.say('zacho', 'は、は、はじめまして！\nご、ご趣味は？');
      await S.say('madonna', 'お料理です。\nどん平さんのご趣味は？');
      await S.say('zacho', 'ワシの趣味はな…');
      await S.drum();
      await S.gag('…お見合いの練習や！！');
      await S.say('okami', '本番で言うことちゃうやろ！');
      await S.say('madonna', 'ふふっ。\nおもしろい方ですね！');
      await S.emote('zacho', '♥');
    },
  },
];
const sketchOfDay = (g) => SKETCHES[g.state.day % SKETCHES.length];

// Put the troupe (and the extra audience) where a show starts.
function arrangeStage(g, layout) {
  for (const w of Object.keys(CAST)) {
    const at = layout[w];
    if (at) { g.placeNpc(CAST[w], at[0], at[1], at[2]); g.showNpc(CAST[w], true); } else g.showNpc(CAST[w], false);
  }
}

// While a show is on, frame the stage (and the front rows) below the HUD.
function stageCam(g, on) {
  g.map.camOverride = on ? { x: 0, y: -26 } : null;
  g.map.updateCamera(true);
}

async function returnTo(g, origin) {
  await g.fadeOut();
  show = null; party = false; curtainK = 0; lights = false; spot = null;
  clearPlayerFx(g);
  stageCam(g, false);
  await g.goto(PID, origin.room, origin.x, origin.y, origin.dir, { fade: false });
  await g.fadeIn();
}

// ------------------------------------------------------------------ watch a show (ticket counter)
async function watchShow(g, who) {
  const st = g.state;
  const sk = sketchOfDay(g);
  if (today(g, 'shinkigeki_watch_day')) {
    await g.say(['本日の公演は、もうご覧になりましたね！', '明日はまた別のお話ですよ。\nぜひまた来てくださいね♪'], who);
    return;
  }
  const i = await g.ask(`本日の公演は『${sk.title}』！\nチケットは1枚 ${fmtMoney(1000)}です。\nご覧になりますか？`, ['観る！', 'やめておく'], who);
  if (i !== 0) { await g.say('またお待ちしてますね！', who); return; }
  if (!g.spend(1000)) { await g.say('あら…お金が足りないみたいです。\nまたお越しくださいね。', who); return; }
  g.sfx('coin');
  g.setFlag('shinkigeki_watch_day', st.day);
  await g.say('ありがとうございます！\nまもなく開演です。ホールへどうぞ〜！', who);
  const origin = here(g);
  show = 'watch';
  try {
    await g.fadeOut();
    await g.goto(PID, 'hall', 8, 8, 'up', { fade: false });
    g.map.player.sprite = seated;
    stageCam(g, true);
    arrangeStage(g, sk.place);
    curtainK = 1;
    lights = true;
    await g.fadeIn();
    await g.say('ただいまより、よしもと新喜劇を開演いたします。\nごゆっくりお楽しみください。', WHO.ana);
    g.sfx('applause');
    await moveCurtain(g, 0);
    await g.wait(200);
    await sk.run(g, kit(g));
    // curtain call
    const onStage = CAST_IDS.map((id) => g.npc(id)).filter((e) => e && g.map.visible(e)).sort((a, b) => a.x - b.x);
    await Promise.all(onStage.map((e, k) => g.walkNpcTo(e.id, 6 + k * 2 + (onStage.length < 4 ? 1 : 0), 5)));
    for (const e of onStage) e.dir = 'down';
    await g.say('本日は、ありがとうございましたーー！', WHO.troupe);
    g.sfx('applause');
    await crowdEmote(g, ['♪', '♥', '!'], 60);
    await moveCurtain(g, 1);
    await g.wait(300);
  } catch (e) {
    console.error(e);
  }
  await returnTo(g, origin);
  g.addSkill('warai', 1, true);
  g.sfx('good');
  await g.say(['おもしろかった！\n思わず客席でズッコケてしまった…。', '本物のズッコケの「間」を学んだ！\n（お笑い +1・観劇は1日1回）']);
}

// ------------------------------------------------------------------ stage jobs
const INTRO = {
  extra: [['zacho', '通行人役、よろしく頼むで！\nギャグのオチでは、\nみんなといっしょにズッコケるんや！']],
  chotto: [['zacho', '今日は出前持ちの役やな。\n肩の力ぬいて、楽しんでいこ！'], ['okami', 'セリフ、とちっても大丈夫。\nうちらがフォローしたるからね！']],
  jun: [['zacho', 'おっ、準レギュラーの{name}！\n今日も頼りにしてるで！']],
  key: [['zacho', '今日の座長公演は、{name}の役が話のカギや。'], ['madonna', 'いっしょに最高の舞台にしましょうね！']],
  zacho: [['zacho', '今日の主役は{name}、あんたや。'], ['zacho', 'ワシは袖から見とるで。\n思いっきりやってこい！']],
};

async function runStageJob(g, j, who) {
  const st = g.state;
  const def = j.def;
  const why = blockReason(g, j);
  if (why) { await g.say(why, who); return null; }
  const i = await g.ask(confirmText(def), ['受ける', 'やめておく'], who || { name: def.client });
  if (i !== 0) return null;
  if (st.stamina < def.stamina) {
    await g.say('体力が足りない…。\nホテルで休むか、何か食べて回復しよう。');
    return null;
  }
  const origin = here(g);
  let res = null;
  show = j.mode;
  try {
    await g.fadeOut();
    const zachoMode = j.key === 'zacho';
    await g.goto(PID, 'hall', zachoMode ? 9 : 11, 4, 'down', { fade: false });
    stageCam(g, true);
    arrangeStage(g, zachoMode
      ? { zacho: [11, 4, 'left'], okami: [6, 4, 'down'], genji: [13, 4, 'down'], madonna: [15, 4, 'down'] }
      : { zacho: [8, 4, 'down'], okami: [5, 4, 'down'], genji: [13, 4, 'down'], madonna: [15, 4, 'down'] });
    curtainK = 1;
    lights = true;
    await g.fadeIn();
    await moveCurtain(g, 0);
    g.sfx('applause');
    for (const [w, t] of INTRO[j.mode]) await g.say(t, WHO[w]);
    if (zachoMode) {
      g.setFlag('shinkigeki_zacho_day', st.day);
      await g.walkNpcTo(CAST.zacho, 18, 5, 1.5);
      g.showNpc(CAST.zacho, false);
      await g.emote('player', '!');
    }
    res = await g.job({ ...def, confirm: false });
    if (res) {
      await crowdReact(g, res);
      const good = res.rank === 'S' || res.rank === 'A';
      const bad = res.rank === 'C' || res.rank === 'D';
      if (zachoMode) {
        if (!bad && !g.flag('shinkigeki_zacho')) await ceremony(g);
        else await zachoAfter(g, good, bad);
      } else {
        await g.say(good ? 'ドッカンドッカンや！\nあんたのズッコケ、天下一品やで！' : bad ? 'ま、こんな日もあるわ。\n転田師匠の受け身レッスンで、また磨こな！' : 'ええ感じやったで！\nおつかれさん！', WHO.zacho);
      }
    }
  } catch (e) {
    console.error(e);
  }
  await returnTo(g, origin);
  return res;
}

async function zachoAfter(g, good, bad) {
  g.placeNpc(CAST.zacho, 18, 5, 'left');
  g.showNpc(CAST.zacho, true);
  await g.walkNpcTo(CAST.zacho, 11, 4, 1.5);
  faceNpc(g, CAST.zacho, 'left');
  if (bad) {
    await g.say(['…まだまだ、これからや。', 'お客さんの顔、よう見とき。\nまた明日、挑戦しに来い！'], WHO.zacho);
  } else {
    await g.emote(CAST.zacho, '♥');
    await g.say(good ? '大入り満員、笑いの渦や！\nさすがは座長やで！' : 'ええ座長公演やった！\nお客さんも大満足や！', WHO.zacho);
  }
}

// 座長就任の式典: the first time the player carries a show as the lead.
async function ceremony(g) {
  const Z = CAST.zacho;
  g.sfx('applause');
  g.placeNpc(Z, 18, 5, 'left');
  g.showNpc(Z, true);
  await g.walkNpcTo(Z, 10, 4, 1.5);
  faceNpc(g, Z, 'left');
  g.facePlayer('right');
  await g.say(['…{name}。ええ舞台やった。', 'お客さんの笑い声、袖までビリビリ響いとったで。'], WHO.zacho);
  await g.emote(Z, '!');
  await g.say('よっしゃ、決めた！\n今日から{name}も、新喜劇の「座長」や！', WHO.zacho);
  g.sfx('fanfare');
  party = true;
  g.shake(16, 2);
  await Promise.all([g.emote(CAST.okami, '!'), g.emote(CAST.genji, '!'), g.emote(CAST.madonna, '!'), g.emote('player', '!')]);
  // the rest of the company rushes in from the wings
  for (const [id, x] of [['sk_h_koro', 14], ['sk_h_butai', 16]]) {
    g.placeNpc(id, 18, 5, 'left');
    g.showNpc(id, true);
    await g.walkNpcTo(id, x, 5, 2);
    faceNpc(g, id, 'up');
  }
  await partyCard(g, '座長 就任！！', g.fmt('よしもと新喜劇 座長 {name}'));
  g.sfx('applause');
  await g.say('これは座長のしるし、金の刺しゅうの法被や。\nそれと…一座からのお祝いや！', WHO.zacho);
  g.setFlag('shinkigeki_zacho', true); // set before the rewards so they can never be paid twice
  g.sfx('coin');
  g.giveItem('shinkigeki_happi', 1, true);
  g.addMoney(50000, true);
  await g.say(`座長の法被と、お祝いの金一封\n${fmtMoney(50000)}を受け取った！`);
  await g.say('おめでとう、新座長！\nこれからもよろしゅうな！', WHO.okami);
  await g.say('わしの目に狂いはなかったで…。\nうう、年とると涙もろなるわ。', WHO.genji);
  await g.say('おめでとうございます！\n次の公演、楽しみにしてますね！', WHO.madonna);
  await g.say('ぼ、ぼくもいつか座長に…！', WHO.koro);
  await g.say(['ほな、新座長のごあいさつや！', 'みなさん、ご注目〜！'], WHO.zacho);
  await g.emote('player', '…', 40);
  await g.say('{name}は大きく息を吸いこんで…');
  await g.wait(200);
  await g.say('…あ、もう閉館の時間や。\n今日はここまで！', WHO.zacho);
  await zukkoAll(g, Z, [CAST.okami, CAST.genji, CAST.madonna, 'sk_h_koro', 'sk_h_butai'], true, CROWD.slice(0, 8));
  await g.say('なんでやねーん！！', WHO.troupe);
  g.sfx('applause');
  g.sfx('fanfare');
  await g.say('{name}は「新喜劇の座長」になった！\n国民的スターへ、また一歩近づいた！');
}

// ------------------------------------------------------------------ backstage: troupe leader, stage manager, lessons
async function zachoFirst(g) {
  g.setFlag('shinkigeki_zacho_met');
  const Z = 'sk_zacho';
  const z = g.npc(Z);
  if (!z) return;
  await g.wait(250);
  await g.emote(Z, '!');
  await g.say('おっ、見かけん顔やな。\n見学の人かいな？', WHO.zacho);
  z.sprite = null;
  await approach(g, Z);
  await g.say([
    'ワシは、この一座の座長。\n茶谷（ちゃたに）どん平や。',
    '新喜劇はな、ギャグのオチで\nみんなそろってズッコケるのが\nお約束なんや。',
    'ちょっと見とき。\n…みんな、いくでー！',
  ], WHO.zacho);
  for (const id of ['sk_madonna', 'sk_okami', 'sk_genji']) faceNpc(g, id, 'down');
  await g.say('ワシ、きのうな…\n道で百万円ひろうてん！', WHO.zacho);
  await Promise.all(['sk_madonna', 'sk_okami', 'sk_genji', 'sk_koro', 'sk_obachan'].map((id) => g.emote(id, '!', 40)));
  await drumroll(g, 6);
  await g.say('…と思ったら、\n子ども銀行のお札やった！', WHO.zacho);
  await zukkoAll(g, Z, ['sk_madonna', 'sk_okami', 'sk_genji', 'sk_koro', 'sk_obachan', 'sk_butai', 'sk_sensei'], true);
  await g.say(['な？ これが新喜劇の「ズッコケ」や！', 'ズッコケは、タイミングと受け身が命。\n舞台袖の転田師匠が、受け身を教えてくれるで。', 'お仕事がほしいなら、舞台監督に声かけや。\nエキストラなら、だれでも出られるで！'], WHO.zacho);
  await g.walkNpcTo(Z, 13, 8, 1.5);
  g.placeNpc(Z, 13, 8, 'down');
  z.sprite = zabuton;
}

async function zachoTalk(g) {
  const st = g.state;
  const who = WHO.zacho;
  if (!g.flag('shinkigeki_zacho_met')) { await zachoFirst(g); return; }
  let greet;
  if (g.flag('shinkigeki_zacho')) greet = 'おう、座長！\n今日も一座を引っぱってや！';
  else if (member(g) && st.fame >= 2000) greet = '{name}、ちょっと話があるんや。\n…座長公演の主役、やってみいひんか？';
  else if (member(g) && st.fame >= 1000) greet = '{name}、次の座長公演で\n大事な役をまかせたいんや。';
  else greet = pick(['おう、{name}！ 茶でも飲んでいき！', 'ええ顔になってきたな、{name}！']);
  const i = await g.ask(greet, ['お仕事の話', '心得を聞く', 'またね'], who);
  if (i === 0) {
    if (member(g) && st.fame >= 2000) await runStageJob(g, job('zacho'), who);
    else if (member(g) && st.fame >= 1000) await runStageJob(g, job('key'), who);
    else await g.say(hintFor(g, true), who);
  } else if (i === 1) {
    await g.say(pick([
      ['ズッコケは、ギャグを最後まで聞いてから。', '早よ転んだら「フライング」や。\nオチの「間」を、体で覚えるんやで。'],
      ['ギャグに見せかけて、何も起こらへん時もある。', 'そん時は、グッとガマンや。\nひとりだけ転んだら、恥ずかしいで〜。'],
      ['新喜劇は、お客さんと一座がひとつになる芝居や。', 'ズッコケは「みんなでそろって」が\nいちばん気持ちええんや。'],
    ]), who);
  } else {
    await g.say('ほな、またな！\n笑顔で帰りや〜！', who);
  }
}

async function jobBoard(g, who) {
  const items = JOBS.map((j) => {
    const lock = lockLabel(g, j);
    return { label: j.label, right: lock || '目安' + fmtMoney(j.def.pay), disabled: !!lock };
  });
  const k = await g.list({ title: '新喜劇 お仕事リスト', items, x: 34, y: 24, w: 252, describe: (idx) => JOBS[idx] && JOBS[idx].info });
  if (k < 0 || !JOBS[k]) return;
  await runStageJob(g, JOBS[k], who);
}

async function auditionHere(g, who) {
  const st = g.state;
  const before = st.stats.minigames;
  const ok = await g.audition({ agency: AG, title: '新喜劇 座員オーディション', minigame: 'zukko', opts: { difficulty: 2 }, pass: 55, client: who.name, clientLook: who.look });
  if (ok && g.lastAudition === 'passed') {
    g.sfx('applause');
    await g.say(['合格や！ あんたのズッコケ、ほんまもんや！', 'ようこそ、よしもとへ！\nこれからは、ちょい役でもどんどん出てや！'], who);
  } else if (!ok && g.lastAudition === 'failed' && st.stats.minigames > before) {
    await g.say('うーん、惜しい！\n転田師匠の受け身レッスンで練習して、また来てや。', who);
  }
}

async function butaiTalk(g) {
  const who = WHO.butai;
  const choices = member(g) ? ['お仕事', '相談する', 'またね'] : ['お仕事', 'オーディション', '相談する', 'またね'];
  const i = await g.ask(g.state.fame >= 1000 ? '人気者が来たな！\n今日はどの舞台に立つ？' : '舞台監督や。出番がほしいんか？\nエキストラなら、だれでも大歓迎やで！', choices, who);
  const pickd = choices[i];
  if (pickd === 'お仕事') await jobBoard(g, who);
  else if (pickd === 'オーディション') {
    await g.say(['よしもとの「座員オーディション」や。', 'オチの「ドーン！」でズッコケる！\n「シーン…」の時はガマンや。\n合格したら、よしもと所属やで！'], who);
    await auditionHere(g, who);
  } else if (pickd === '相談する') await g.say(hintFor(g, true), who);
  else await g.say('出番がほしなったら、いつでも言うてや。', who);
}

async function senseiTalk(g) {
  const who = WHO.sensei;
  const i = await g.ask('受け身ひとすじ四十年、転田（ころびた）や。\nズッコケのレッスン、受けていくか？', ['レッスン', 'お手本を見る', 'コツを聞く', 'やめる'], who);
  if (i === 0) {
    await g.lesson({ title: 'ズッコケ（受け身）レッスン', skill: 'warai', price: 2500, stamina: 12, gain: 4, minigame: 'zukko', opts: { difficulty: 1 }, teacher: who.name });
  } else if (i === 1) {
    await g.say('よう見ときや…。\nワシの話、聞いてくれるか？', who);
    await g.wait(250);
    await g.say('…やっぱり、言うの忘れたわ！', who);
    g.sfx('zukko');
    g.shake(8, 2);
    fall(g, 'sk_sensei', -1);
    await g.wait(700);
    getUp(g, 'sk_sensei');
    await g.say(['…と、こうや。', 'あごを引いて、背中から、ころん。\nこれで、どこも痛くない。'], who);
  } else if (i === 2) {
    await g.say([
      'オチのセリフが終わって、ひと呼吸の「間」。\nそこで、ドーン！や。',
      '「シーン…」となったら、転んだらあかん。\n耳をすませて、空気を読むんや。',
      'お笑いのスキルが上がると、\nタイミングもつかみやすなる。\n毎日コツコツやで。',
    ], who);
  } else {
    await g.say('転んでも、また起き上がる。\nそれが芸人や！', who);
  }
}

async function koroTalk(g) {
  const who = WHO.koro;
  if (g.flag('shinkigeki_zacho')) {
    await g.say(['座長！ おつかれさまです！', 'ぼくも座長みたいに、お客さんを\nドッカンドッカン笑わせたいです！'], who);
    return;
  }
  await g.say([
    '若手座員のころ助です！\n毎日、ここで転ぶ練習してます！',
    member(g) ? '同じよしもとの仲間ですね！\nいつか同じ舞台に立ちましょう！' : 'エキストラなら、だれでも舞台に立てるんですよ。\n舞台監督さんに言ってみてください！',
  ], who);
}

async function obachanTalk(g) {
  const who = WHO.obachan;
  if (today(g, 'shinkigeki_tea_day')) {
    await g.say(['お茶はもう飲んだやろ？', '飲みすぎたら、本番中にトイレ行きたなるで〜！'], who);
    return;
  }
  const i = await g.ask('おつかれさん！\n熱いお茶、一杯どないや？', ['いただきます', 'だいじょうぶ'], who);
  if (i !== 0) { await g.say('遠慮せんでええのに〜。\nほな、またおいで！', who); return; }
  g.setFlag('shinkigeki_tea_day', g.state.day);
  g.sfx('good');
  g.heal(15);
  await g.say(['はい、どうぞ。\nおせんべいも、つけとくわね。', 'ほっとひと息…。\n体力が15回復した！（1日1回）'], who);
}

async function castTalk(g, who, lines) { await g.say(lines(g), who); }

// ------------------------------------------------------------------ lobby
async function welcome(g) {
  g.setFlag('shinkigeki_welcome');
  await g.wait(250);
  await g.emote('sk_annai', '!');
  await g.say('いらっしゃいませ！\nよしもと新喜劇の劇場へようこそ！', WHO.annai);
  g.sfx('chime');
  await g.showLogo('shinkigeki', 'よしもと新喜劇');
  await g.say([
    'ここでは毎日、よしもと新喜劇を上演しています！',
    '下町のお店や家族が舞台の、\n笑いあり涙ありのお芝居。\nギャグのあとは、みんなでズッコケるのがお約束！',
    'チケットはこちらの受付で。\n右の赤い扉が劇場ホール、\n左の扉は楽屋口です！',
  ], WHO.annai);
}

async function annaiTalk(g) {
  const who = WHO.annai;
  const i = await g.ask('ご案内いたします♪', ['館内案内', '新喜劇って？', '次は何を？', 'またね'], who);
  if (i === 0) {
    await g.say([
      '右の赤い扉は、劇場ホール。\n開演前の客席は、見学自由ですよ。',
      '左の扉は楽屋口。舞台監督や座長、\n一座のみなさんがいます。\nお仕事やレッスンは、そちらで！',
      '左手のグッズ売り場では、\n劇場名物のおまんじゅうも売っています♪',
    ], who);
  } else if (i === 1) {
    await g.say([
      'よしもと新喜劇は、ここ大阪・なんばで\n上演している喜劇です。',
      'お店や家族のドタバタを描いた、\n笑いあり涙ありのお芝居なんですよ。',
      'ギャグのオチで、出演者がそろってズッコケる！\nそれが新喜劇のお約束です♪',
    ], who);
  } else if (i === 2) {
    await g.say(politeHint(g), who);
  } else {
    await g.say('ごゆっくりどうぞ♪', who);
  }
}

async function ticketTalk(g) { await watchShow(g, WHO.ticket); }

async function goodsTalk(g) {
  const who = WHO.goods;
  await g.say('いらっしゃいませ〜！\n劇場名物「ズッコケまんじゅう」、焼きたてですよ！', who);
  await g.shop(['shinkigeki_manju', 'shinkigeki_tenugui', 'takoyaki', 'drink'], { title: '新喜劇グッズ売り場', greeting: 'いらっしゃいませ〜！' });
  await g.say('ありがとうございました〜！\n手ぬぐいは、舞台の前にどうぞ♪', who);
}

async function guardTalk(g) {
  const who = WHO.guard;
  if (g.flag('shinkigeki_zacho')) {
    await g.say(['座長、おはようございます！', '…いや、もう昼すぎか。\n劇場の世界では、いつでも\n「おはようございます」なんや！'], who);
  } else if (member(g)) {
    await g.say(['おっ、よしもとの座員さんやな。\nおはようございます！', '楽屋は、その扉の奥や。\n今日も、ええズッコケ見せてや！'], who);
  } else {
    await g.say(['ワシは楽屋番。\n楽屋口の番をしとるんや。', '見学なら、静かにな。\n座長も舞台監督も、気さくな人やで。'], who);
  }
}

async function mogiriTalk(g) {
  const who = WHO.mogiri;
  if (today(g, 'shinkigeki_watch_day')) {
    await g.say('今日の公演、楽しんでもらえました？\nまたのお越しを、お待ちしてます！', who);
    return;
  }
  await g.say([
    'こちら劇場ホールの入口です。\n開演前の客席は、見学自由ですよ。',
    '公演をご覧になるなら、\nまずは真ん中の受付でチケットを！\n¥1,000です。',
  ], who);
}

async function fanTalk(g) {
  const who = WHO.fan;
  const st = g.state;
  if (st.fame >= 500 && !today(g, 'shinkigeki_fan_day')) {
    await g.emote('sk_fan', '♥');
    const i = await g.ask('あっ！ {name}さんですよね！？\nサインください！', ['いいよ！', 'ごめんね'], who);
    if (i === 0) {
      g.setFlag('shinkigeki_fan_day', st.day);
      g.sfx('good');
      g.addFame(2);
      await g.say('やったー！ 家宝にします！\nズッコケるとこ、また見に来ますね！', who);
    } else {
      await g.say('あっ、お急ぎですよね…！\nこれからも応援してます！', who);
    }
    return;
  }
  await g.say([
    'わたし、新喜劇が大好きで、毎週かよってるんです！',
    'いちばん好きなのは、\nみんながそろってズッコケる瞬間！\nあの「ドーン！」がたまらないの。',
    st.fame >= 500 ? '{name}さんのサイン、\n今日はもうもらっちゃった♪' : 'あなたも舞台に立つの？\nもし有名になったら、サインちょうだいね！',
  ], who);
}

async function jorenTalk(g) {
  const who = WHO.joren;
  await g.say(pick([
    ['わしは子どものころから、新喜劇を見て育ったんや。', '週末の昼に、家族みんなでテレビの前で笑うてな…。\nええ思い出や。'],
    ['新喜劇のええとこはな、笑うて、\nちょっとホロッとして、\n最後はスカッとするとこや。', '人情があるんや、人情が。'],
    ['ここのまんじゅう、食べたか？\n体力回復にもってこいやで。', 'わしは毎回、三つ買うて帰るんや。'],
  ]), who);
}

async function kidTalk(g) {
  const who = WHO.kid;
  const i = await g.ask('ぼく、ズッコケの練習してるねん！\n見てて、見てて！', ['見る', 'また今度'], who);
  if (i !== 0) { await g.say('ちぇ〜。\nほな、ひとりで練習しとくわ。', who); return; }
  await g.say('「ワシな、きのう…\nカレーに、ラーメン入れてん！」', who);
  await g.say('…それ、カレーラーメンや！', who);
  g.sfx('zukko');
  fall(g, 'sk_kid', 1);
  await g.wait(600);
  getUp(g, 'sk_kid');
  await g.emote('sk_kid', '♪');
  await g.say(['どや！ …ちょっと痛かったけど。', '大きなったら、ぜったい新喜劇に入るんや！'], who);
}

async function photoBoard(g) {
  const i = await g.ask('顔ハメ看板だ。\n座長の衣装に顔をはめて、\n記念撮影できるらしい。', ['撮る！', 'やめる']);
  if (i !== 0) return;
  const p = g.map.player;
  await g.fadeOut(8);
  p.hidden = true;
  kaohame = true;
  await g.fadeIn(8);
  await g.say('はい、チーズ！', WHO.annai);
  g.sfx('shutter');
  flashUntil = g.frame + 10;
  await g.wait(400);
  await g.fadeOut(8);
  kaohame = false;
  p.hidden = false;
  await g.fadeIn(8);
  if (!g.hasItem('shinkigeki_photo')) {
    g.giveItem('shinkigeki_photo', 1, true);
    await g.say('いい笑顔で撮れた！\n「顔ハメ記念写真」を手に入れた！');
  } else {
    await g.say('いい笑顔で撮れた！\n…新喜劇の座長にも負けてない？');
  }
}

// ------------------------------------------------------------------ hall NPCs
async function shoumeiTalk(g) {
  const who = WHO.shoumei;
  const i = await g.ask('照明さんや。舞台の明かりは全部ワシの担当。\nちょっと照らしてみよか？', ['お願い！', 'またね'], who);
  if (i !== 0) { await g.say('本番中は、まぶしいくらいがちょうどええんや。', who); return; }
  // The player stands by the back wall here, so the line goes in the top window
  // (the bottom one would hide the spotlight); the light stays on until it is read.
  spot = { until: Infinity };
  g.sfx('chime');
  await g.emote('player', '♪', 60);
  await g.say('ほら、スターの誕生や！\nこの明かりの真ん中に立つ日が、楽しみやな。', { ...who, top: true });
  spot = null;
}

async function sakkaTalk(g) {
  const who = WHO.sakka;
  await g.say(pick([
    ['ぼくは新喜劇の台本を書いてる。', 'オチは「みんなが油断した瞬間」に\n置くのがコツ。\nだから、ズッコケも油断は禁物！'],
    ['舞台のセットは、うどん屋「まんぷく亭」。', '座長は、あの店ののれんから登場するんだ。\nお客さんが待ってましたって顔になるんだよ。'],
    ['「シーン…」のフリは、わざと入れてるんだ。', 'ひとりだけズッコケると、\nそれはそれで笑いになるんだけどね！'],
  ]), who);
}

async function mojiTalk(g) {
  const who = WHO.moji;
  await g.say([
    '若手座員のもじ丸です！\n開演前に、舞台で立ち位置の確認中です。',
    member(g) && g.state.fame >= 250 ? '{name}さんと同じ舞台、緊張します…！' : '舞台の右の幕のすき間から、\n楽屋の舞台袖に行けるんですよ。',
  ], who);
}

// ------------------------------------------------------------------ props
// Hanging sign on the stage set.
const setSign = {
  type: 'prop', x: 3, y: 2, w: 4, h: 1, solid: false,
  draw(ctx, sx, sy) {
    box(ctx, sx + 6, sy - 2, 1, 4, '#3a2414'); box(ctx, sx + 57, sy - 2, 1, 4, '#3a2414');
    box(ctx, sx + 2, sy + 1, 60, 13, '#3a2414');
    box(ctx, sx + 3, sy + 2, 58, 11, '#e8c890');
    text(ctx, 'まんぷく亭', sx + 32, sy + 2, { size: 10, align: 'center', color: '#3a2414', shadow: null });
  },
};
// Small labelled plates on the lobby walls.
function plate(x, y, w, label, { bg = RED, fg = '#ffffff', edge = GOLD } = {}) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const pw = w * 16 - 4;
      box(ctx, sx + 2, sy + 3, pw, 12, edge);
      box(ctx, sx + 3, sy + 4, pw - 2, 10, bg);
      text(ctx, label, sx + 2 + pw / 2, sy + 4, { size: 10, align: 'center', color: fg, shadow: null });
    },
  };
}
// 顔ハメ看板: the troupe leader's costume with a hole for your face.
const kaohameBoard = {
  type: 'prop', x: 16, y: 7, w: 2, h: 2,
  talk: photoBoard,
  draw(ctx, sx, sy, g) {
    box(ctx, sx + 4, sy + 28, 24, 3, 'rgba(0,0,0,0.25)');
    box(ctx, sx + 6, sy + 22, 2, 8, WOOD_D); box(ctx, sx + 24, sy + 22, 2, 8, WOOD_D);
    box(ctx, sx + 1, sy - 6, 30, 30, WOOD_D);
    box(ctx, sx + 2, sy - 5, 28, 28, '#fff3c0');
    // painted costume
    box(ctx, sx + 8, sy + 6, 16, 16, '#e8873a'); box(ctx, sx + 15, sy + 6, 2, 12, '#d62f2f'); box(ctx, sx + 12, sy + 6, 2, 6, '#ffffff'); box(ctx, sx + 18, sy + 6, 2, 6, '#ffffff');
    box(ctx, sx + 4, sy + 8, 4, 10, '#e8873a'); box(ctx, sx + 24, sy + 8, 4, 10, '#e8873a');
    box(ctx, sx + 3, sy + 17, 4, 3, '#e0a878'); box(ctx, sx + 25, sy + 17, 4, 3, '#e0a878');
    // painted hair around the hole
    box(ctx, sx + 9, sy - 4, 14, 4, '#2a2430');
    // the face hole (or the player's face during the photo)
    if (kaohame) {
      box(ctx, sx + 10, sy - 1, 12, 8, '#2a2430');
      ctx.save();
      ctx.beginPath(); ctx.rect(sx + 10, sy - 1, 12, 8); ctx.clip();
      drawFace(ctx, g.state.look || LOOKS.player, sx + 8, sy - 4, 1);
      ctx.restore();
    } else {
      box(ctx, sx + 10, sy - 1, 12, 8, '#2a1a10'); box(ctx, sx + 11, sy, 10, 6, '#3a2418');
    }
    // stars and a speech burst
    box(ctx, sx + 3, sy - 3, 2, 2, GOLD); box(ctx, sx + 27, sy - 1, 2, 2, GOLD); box(ctx, sx + 26, sy + 2, 1, 1, RED);
  },
};
// Stage curtain that opens / closes (drawn over the stage).
const stageCurtain = {
  type: 'prop', x: 1, y: 2, w: 18, h: 4, z: 40, solid: false,
  cond: () => curtainK > 0.001,
  draw(ctx, sx, sy) {
    const full = 18 * 16;
    const half = full / 2;
    const top = sy + 4;
    const h = 4 * 16 - 4;
    const w = Math.round(half * curtainK);
    const panelAt = (x0, wid, leftSide) => {
      box(ctx, x0, top, wid, h, '#a51f2c');
      for (let x = 0; x < wid; x += 6) {
        const xx = leftSide ? x0 + x : x0 + wid - x - 6;
        box(ctx, xx + 1, top, 1, h, '#7a1520'); box(ctx, xx + 4, top, 1, h, '#d0404e');
      }
      box(ctx, x0, top + h - 4, wid, 2, '#e8c43a');
      for (let x = 0; x < wid; x += 2) box(ctx, x0 + x, top + h - 2, 1, 2, '#e8c43a');
      box(ctx, leftSide ? x0 + wid - 1 : x0, top, 1, h, '#5e0c14');
    };
    if (w > 0) { panelAt(sx, w, true); panelAt(sx + full - w, w, false); }
  },
};

// Pixel ellipse (for light pools).
function pool(ctx, cx, cy, rx, ry, col) {
  ctx.fillStyle = col;
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2, 1);
  }
}
// Dark overlay with a round hole (spotlight).
function darkWithHole(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let y = 0; y < H; y++) {
    const dy = y - cy;
    if (Math.abs(dy) >= r) { ctx.fillRect(0, y, W, 1); continue; }
    const hw = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(0, y, Math.max(0, Math.round(cx - hw)), 1);
    ctx.fillRect(Math.round(cx + hw), y, W, 1);
  }
}

function hallDrawOver(ctx, g, cam) {
  if (lights) {
    const edge = 6 * 16 - cam.y;
    ctx.fillStyle = 'rgba(10,4,24,0.5)';
    ctx.fillRect(0, edge, W, H - edge);
    // beams from the lighting rig and pools on the stage floor
    const floorY = 5 * 16 - cam.y;
    for (const bx of [5, 10, 15]) {
      const cx = bx * 16 - cam.x;
      for (let y = 0; y < floorY; y += 2) {
        const k = y / floorY;
        const hw = 3 + k * 20;
        ctx.fillStyle = 'rgba(255,246,200,0.05)';
        ctx.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 2);
      }
      pool(ctx, cx, floorY + 4, 26, 8, 'rgba(255,240,170,0.13)');
    }
  }
  if (spot && g.frame < spot.until) {
    const p = g.map.player;
    darkWithHole(ctx, p.px + 8 - cam.x, p.py + 6 - cam.y, 22, 'rgba(6,4,16,0.6)');
    pool(ctx, p.px + 8 - cam.x, p.py + 14 - cam.y, 14, 4, 'rgba(255,246,200,0.25)');
  }
  if (party) drawConfetti(ctx, g.frame, 70);
}

const signs = (list) => list.map(([x, y, t]) => ({ type: 'sign', x, y, text: t }));
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });

// ------------------------------------------------------------------ place
registerPlace({
  id: PID,
  name: 'よしもと新喜劇 劇場',
  kind: 'building',
  bgm: 'osaka',
  start: { room: 'lobby', x: 9, y: 11, dir: 'up' },
  rooms: {
    // -------------------------------------------------------------- lobby
    lobby: {
      floor: 'shinkigeki_floor',
      tiles: [
        '####################',
        '#AAAAAAEEEEEEAAAAAA#',
        '#UVUQUUFFFFFFUWUTYU#',
        '#=v=q==ffffff=w=ty=#',
        '#GGG..P......P....X#',
        '#..P...CCCCCC......#',
        '#RRR.....[]........#',
        '#........[]........#',
        '#........[]........#',
        '#...bbb..[]..bbb...#',
        '#........[]........#',
        '#Z....N..[]..N....Z#',
        '#########MM#########',
      ],
      legend: {
        '#': 'shinkigeki_walltop', A: 'shinkigeki_wall_t', U: 'shinkigeki_wall_u', '=': 'shinkigeki_wall',
        E: 'shinkigeki_feat_t', F: 'shinkigeki_feat', f: 'shinkigeki_feat_b',
        V: 'shinkigeki_wall_u+shinkigeki_posterA_t', v: 'shinkigeki_wall+shinkigeki_posterA',
        W: 'shinkigeki_wall_u+shinkigeki_posterB_t', w: 'shinkigeki_wall+shinkigeki_posterB',
        Q: 'shinkigeki_sdoor_u', q: 'shinkigeki_sdoor',
        T: 'shinkigeki_tdoor_ul', Y: 'shinkigeki_tdoor_ur', t: 'shinkigeki_tdoor_l', y: 'shinkigeki_tdoor_r',
        '[': 'shinkigeki_runner_l', ']': 'shinkigeki_runner_r',
        C: 'shinkigeki_counter', G: 'shinkigeki_goods', R: 'register', P: 'plant', X: 'vending',
        b: 'shinkigeki_bench', N: 'shinkigeki_nobori', Z: 'flower_stand',
      },
      warps: [
        { x: 9, y: 12, to: 'exit' }, { x: 10, y: 12, to: 'exit' },
        {
          x: 4, y: 3, room: 'backstage', tx: 15, ty: 11, dir: 'up',
          check: async (g) => {
            if (!g.flag('shinkigeki_gakuya_ok')) {
              g.setFlag('shinkigeki_gakuya_ok');
              await g.emote('sk_guard', '!');
              await g.say(['おっと、ここから先は楽屋やで。', '…見学かいな？ ええで、ええで。\n静かにな！'], WHO.guard);
            }
            return true;
          },
        },
        { x: 16, y: 3, room: 'hall', tx: 9, ty: 15, dir: 'up' },
        { x: 17, y: 3, room: 'hall', tx: 10, ty: 15, dir: 'up' },
      ],
      entities: [
        { type: 'logo', x: 7.4, y: 0.55, w: 5.2, h: 3.1, logo: 'shinkigeki', board: true, lights: true },
        plate(1, 1, 2.25, 'グッズ'),
        plate(3.375, 1, 2.25, '楽屋口', { bg: '#3a2414', edge: WOOD_L }),
        plate(15.125, 1, 3.75, '劇場ホール'),
        kaohameBoard,
        npc('sk_ticket', 8, 4, 'down', WHO.ticket, { talk: ticketTalk }),
        npc('sk_annai', 11, 4, 'down', WHO.annai, { talk: annaiTalk }),
        npc('sk_goods', 2, 5, 'down', WHO.goods, { talk: goodsTalk }),
        npc('sk_guard', 5, 4, 'down', WHO.guard, { talk: guardTalk }),
        npc('sk_mogiri', 15, 4, 'down', WHO.mogiri, { talk: mogiriTalk }),
        npc('sk_fan', 3, 10, 'right', WHO.fan, { talk: fanTalk, wander: 1 }),
        npc('sk_joren', 14, 9, 'up', WHO.joren, { talk: async (g, e) => { await jorenTalk(g); e.dir = 'up'; }, sprite: benchSeated }),
        npc('sk_kid', 7, 10, 'down', WHO.kid, { talk: kidTalk, wander: 1 }),
        ...signs([
          [14, 3, 'ポスターだ。座長がニカッと笑っている。\n「よしもと新喜劇　本日も公演中！」'],
        ]),
      ],
      events: [
        ...[7, 12].map((x) => ({
          x, y: 5, on: 'action',
          run: async (g) => { await g.say(['受付の上で、よしもと新喜劇のロゴ看板が輝いている。', '金色の電球がピカピカ光って、\n見ているだけでワクワクする！']); },
        })),
      ],
      drawOver: (ctx, g) => {
        if (g.frame < flashUntil) { ctx.fillStyle = `rgba(255,255,255,${(flashUntil - g.frame) / 10})`; ctx.fillRect(0, 0, W, H); }
      },
      onEnter: async (g) => {
        if (!g.flag('shinkigeki_welcome')) await welcome(g);
      },
    },

    // -------------------------------------------------------------- hall
    hall: {
      floor: 'shinkigeki_carpet',
      bgm: 'shinkigeki_theme',
      tiles: [
        '####################',
        '#TTTTTTTTTTTTTTTTTT#',
        '#cRRRRRRRRRRRRRRRRc#',
        '#cKWWKmmKDdKmmKWWKc#',
        '#c,,,,,,,,,,,,,,,,c#',
        '#c,,,,,,,,,,,,,,,,o#',
        '#E^EEEEEEEEEEEEEE^E#',
        '#..................#',
        '#.sssssss..sssssss.#',
        '#..................#',
        '#.sssssss..sssssss.#',
        '#..................#',
        '#.sssssss..sssssss.#',
        '#..................#',
        '#.sssssss..sssssss.#',
        '#L................L#',
        '#########OO#########',
      ],
      legend: {
        '#': 'shinkigeki_walltop', T: 'curtain_top', c: 'curtain', ',': 'floor_stage',
        R: 'shinkigeki_set_roof', K: 'shinkigeki_set_wall', W: 'shinkigeki_set_window', m: 'shinkigeki_set_menu',
        D: 'shinkigeki_set_door_l', d: 'shinkigeki_set_door_r', o: 'shinkigeki_wing',
        E: 'stage_edge', '^': 'stairs_up', s: 'seat', L: 'spotlight', O: 'shinkigeki_mat',
      },
      warps: [
        { x: 9, y: 16, room: 'lobby', tx: 16, ty: 4, dir: 'down' },
        { x: 10, y: 16, room: 'lobby', tx: 17, ty: 4, dir: 'down' },
        { x: 18, y: 5, room: 'backstage', tx: 2, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 7.75, y: 0.05, w: 4.5, h: 2.45, logo: 'shinkigeki', board: true, lights: true },
        setSign,
        stageCurtain,
        npc('sk_kyaku1', 4, 10, 'up', WHO.kyaku1, {
          sprite: seated,
          talk: async (g, e) => {
            await g.say(['あたしゃ、ここの常連でね。\nもう何十年も通っとるんよ。', '幕が開いて、座長がのれんから出てくると…\nああ、今日も来てよかったって思うんよ。'], WHO.kyaku1);
            e.dir = 'up';
          },
        }),
        npc('sk_kyaku2', 13, 8, 'up', WHO.kyaku2, {
          sprite: seated,
          talk: async (g, e) => {
            await g.say(['修学旅行で来ました！\n生の新喜劇、はじめてなんです！', 'みんなでいっしょにズッコケるとこ、\n早く見たいなあ！'], WHO.kyaku2);
            e.dir = 'up';
          },
        }),
        npc('sk_kyaku3', 15, 12, 'up', WHO.kyaku3, {
          sprite: seated,
          talk: async (g, e) => {
            await g.say(['Hello! 言葉がわからなくても、\nズッコケは世界共通で笑えるね！', 'Everyone falls down together…\nアメージング！'], WHO.kyaku3);
            e.dir = 'up';
          },
        }),
        npc('sk_shoumei', 17, 15, 'up', WHO.shoumei, { talk: shoumeiTalk }),
        npc('sk_sakka', 10, 7, 'up', WHO.sakka, { talk: sakkaTalk, cond: () => !show && !party }),
        npc('sk_moji', 12, 4, 'down', WHO.moji, { talk: mojiTalk, wander: 1, cond: () => !show && !party }),
        // the troupe (only while a show is on)
        npc('sk_h_zacho', 9, 4, 'down', WHO.zacho, { cond: () => !!show, text: 'さあ、開演や！' }),
        npc('sk_h_okami', 6, 4, 'down', WHO.okami, { cond: () => !!show, text: 'いらっしゃい！' }),
        npc('sk_h_genji', 13, 4, 'down', WHO.genji, { cond: () => !!show, text: 'ええ舞台にしよな。' }),
        npc('sk_h_madonna', 15, 4, 'down', WHO.madonna, { cond: () => !!show, text: 'がんばりましょう！' }),
        npc('sk_h_koro', 14, 5, 'up', WHO.koro, { cond: () => party, hidden: true, text: 'おめでとうございます！' }),
        npc('sk_h_butai', 16, 5, 'up', WHO.butai, { cond: () => party, hidden: true, text: 'おめでとさん！' }),
        // the full house
        ...AUD_SEATS.map(([x, y], i) => npc(AUD_IDS[i], x, y, 'up', { name: 'お客さん', look: AUD[i % AUD.length] }, { sprite: seated, cond: () => !!show, text: 'ワクワク…！' })),
        ...signs([
          [1, 15, 'スポットライトだ。\n本番中は、ここから舞台を照らすらしい。'],
        ]),
      ],
      events: [
        {
          x: 9, y: 3, w: 2, on: 'action',
          run: async (g) => {
            await g.say(['うどん屋「まんぷく亭」のセットの入口だ。\n藍色ののれんがかかっている。', '本番では、ここから座長が登場するらしい…！']);
          },
        },
      ],
      drawOver: hallDrawOver,
      topPad: 26, // on the stage the camera can rise so the HUD does not hide the valance and the set sign
      onEnter: async (g) => {
        if (!show && !party && !g.flag('shinkigeki_hall_first')) {
          g.setFlag('shinkigeki_hall_first');
          await g.wait(200);
          await g.say('わあ…！ 赤い幕に、金色の飾り。\nここが新喜劇の劇場ホールだ！');
          await g.emote('sk_sakka', '!');
          await g.say(['おや、見学の人かな？', '公演を観るなら、ロビーの受付でチケットを買ってね。\n毎日ちがうお話をやってるよ。'], WHO.sakka);
        }
      },
    },

    // -------------------------------------------------------------- backstage
    backstage: {
      floor: 'floor_wood',
      bgm: 'theater',
      tiles: [
        '####################',
        '#hOhhhhhhUVUUVUUVUC#',
        '#hohnqhbh=v==v==v==#',
        '#,,,,,,,|.d..d..d..#',
        '#k,,,,,,|..........#',
        '#,,,,,,,,..........#',
        '#k,,,,,,|..rr..rr..#',
        '#,,,,,,,|..........#',
        '#,,,,,,,,..TTTTTT..#',
        '#XXX,,,,|..TTtjTT..#',
        '#XXX,,,,|..TTTTTT.P#',
        '#,,,,,,,,..........#',
        '###############MM###',
      ],
      legend: {
        '#': 'shinkigeki_walltop', h: 'shinkigeki_dwall', U: 'shinkigeki_wall_t', '=': 'shinkigeki_wall',
        O: 'shinkigeki_bsdoor_u', o: 'shinkigeki_bsdoor',
        n: 'shinkigeki_dwall+shinkigeki_monitor', q: 'shinkigeki_dwall+shinkigeki_cuelight', b: 'shinkigeki_dwall+shinkigeki_callboard',
        V: 'shinkigeki_wall_t+shinkigeki_vanity_u', v: 'shinkigeki_wall+shinkigeki_vanity', C: 'shinkigeki_wall_t+clock',
        ',': 'floor_wood_dark', '|': 'shinkigeki_blackcurtain', k: 'floor_wood_dark+shinkigeki_props', X: 'shinkigeki_pmat',
        d: 'shinkigeki_dresser', r: 'clothes_rack', T: 'floor_tatami',
        t: 'floor_tatami+shinkigeki_chabudai_l', j: 'floor_tatami+shinkigeki_chabudai_r', P: 'plant', M: 'shinkigeki_mat',
      },
      warps: [
        { x: 15, y: 12, room: 'lobby', tx: 4, ty: 4, dir: 'down' },
        { x: 16, y: 12, room: 'lobby', tx: 4, ty: 4, dir: 'down' },
        { x: 2, y: 2, room: 'hall', tx: 17, ty: 5, dir: 'left' },
      ],
      entities: [
        { type: 'logo', x: 11.1, y: 1.2, w: 1.8, h: 1.45, logo: 'shinkigeki', board: true, text: '新喜劇のロゴのポスターだ。\n一座のみんなの、誇りのしるしらしい。' },
        npc('sk_butai', 5, 3, 'down', WHO.butai, { talk: butaiTalk }),
        npc('sk_sensei', 2, 8, 'down', WHO.sensei, { talk: senseiTalk }),
        npc('sk_koro', 5, 7, 'down', WHO.koro, { talk: koroTalk, wander: 2, person: 'korosuke' }),
        npc('sk_madonna', 10, 4, 'up', WHO.madonna, {
          talk: (g) => castTalk(g, WHO.madonna, (gg) => [
            'マドンナ役のゆり子です。\n本番前のメイク中なの。',
            'ギャグに見せかけて「シーン…」となる時は、\nズッコケたらダメよ。ガマンが大事！',
            member(gg) && gg.state.fame >= 1000 ? '次の座長公演、いっしょに出られるといいわね♪' : '舞台に立ってみたいなら、\n舞台監督さんに声をかけてみて。',
          ]),
        }),
        npc('sk_okami', 13, 4, 'up', WHO.okami, {
          talk: (g) => castTalk(g, WHO.okami, (gg) => [
            'おかみ役のさち代や。\n舞台では、ツッコミもうちの担当やで。',
            '座長がボケたら、みんなでズッコケて、\nうちが「なんでやねん！」。\nこれで一丁あがりや！',
            gg.state.agency === AG ? '同じよしもとの仲間やな。\nいっしょに舞台、もり上げよな！' : 'グッズ売り場の手ぬぐいを使うと、\nズッコケのキレが良うなるで。',
          ]),
        }),
        npc('sk_genji', 16, 4, 'up', WHO.genji, {
          talk: (g) => castTalk(g, WHO.genji, () => [
            '源じい役の源三や。\nこの一座で、いちばん長う転んできた男や。',
            'ズッコケのコツはな…\nセリフを最後まで、よう聞くことや。',
            '早よ転んだら、ただの「おっちょこちょい」や。\nふぉっふぉっふぉ。',
          ]),
        }),
        npc('sk_zacho', 13, 8, 'down', WHO.zacho, { talk: zachoTalk, sprite: zabuton }),
        npc('sk_obachan', 15, 9, 'left', WHO.obachan, { talk: obachanTalk }),
      ],
      events: [
        { x: 4, y: 2, w: 2, on: 'action', run: async (g) => { await g.say(['舞台のようすが映るモニターだ。', '…あっ、画面の中で一座がそろってズッコケた！']); } },
        { x: 7, y: 2, on: 'action', run: async (g) => { await g.say(['今日の出番表が貼ってある。', member(g) ? '「通行人…{name}」の文字も！\n…いつか、いちばん上に名前を書かれたい！' : '一座のみなさんの名前がずらり。\nいつかここに、自分の名前も…！']); } },
        { x: 1, y: 4, on: 'action', run: async (g) => { await g.say('小道具の棚だ。\nたらい、ハリセン、おなべのふた…。\nどれも、笑いのための大事な道具だ。'); } },
        { x: 1, y: 6, on: 'action', run: async (g) => { await g.say('小道具の棚だ。\n「座長用・特大たらい」と書いた札がある…。'); } },
        { x: 10, y: 3, on: 'action', run: async (g) => { await g.say('電球つきの鏡台だ。\nドーラン、つけまつげ、ほお紅…。\n舞台の顔は、ここで作られる！'); } },
        { x: 11, y: 6, w: 2, on: 'action', run: async (g) => { await g.say('衣装がずらり。割ぽう着、はっぴ、着物…。\nどれも、ちょっと年季が入っている。'); } },
        { x: 15, y: 6, w: 2, on: 'action', run: async (g) => { await g.say('出前持ちの衣装や、警察官の制服もある。\n新喜劇には、いろんな人が登場するんだ。'); } },
      ],
      onEnter: async (g) => {
        if (!show && !party && !g.flag('shinkigeki_zacho_met')) await zachoFirst(g);
      },
    },
  },
});
