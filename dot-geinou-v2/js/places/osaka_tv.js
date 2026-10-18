// 大阪のテレビ局ふたつ（なんばエリアに建つ）— 'mbs'（MBS毎日放送）と 'ktv'（関西テレビ）。
// 実在の会社なので、ロゴの素材は使わず文字の看板だけ。番組の出演依頼は受付が programs.js の
// programDesk(g, 'mbs' | 'ktv', npc) に任せる（実在の番組はそちらで。ここでは番組を作らない）。
// スタッフ・芸人・観覧のお客さんはすべて架空の人物で、関西弁でしゃべる。
//
//   lobby   ロビー     受付（番組の出演依頼）・案内係・待合のソファ・オンエア中のモニター・大阪の写真パネル
//   gakuya  楽屋       ソファでひと休み（体力・ストレス）・鏡（身だしなみ）・差し入れのおせんべい（各1日1回）
//   studio  スタジオ   関西バラエティのにぎやかなセット・ひな壇・観覧席。前説／観覧の盛り上げ役／番組観覧（無料）
//   radio   ラジオブース（MBS）       ガラスの向こうの生放送ブース。お便り紹介のお仕事・難読地名クイズ
//   manzai  漫才スタジオ（関西テレビ） 金屏風とセンターマイクの若手漫才コンテスト。ネタ見せ・コンテスト観覧
//
// お仕事（段階）
//   0 前説（スタジオのFD）・観覧の盛り上げ役（スタジオの観覧係）・商店街ロケのお手伝い（ロビーのロケ班AD）
//   1 ラジオのお便り紹介（MBS・所属 または ★30）talk / radio
//   1 若手漫才コンテストのネタ見せ（関西テレビ・所属 または ★30）tsukkomi
//
// 出口：ロビー下のマット（to: 'exit'）。なんばの町にこの建物がまだ置かれていない時は、なんば駅の前へ。

import { registerPlace, doorIndexFor } from '../engine/map.js';
import { LOOKS, charSheetHD } from '../engine/sprites.js';
import { defineTile, tileImageHD, R, P, speckle, disc, oval, line, bevel, inset, outline, shadowEllipse, pix } from '../engine/tiles.js';
import { registerItem } from '../engine/state.js';
import { text } from '../engine/draw.js';
import { makeCanvas, shade, pick, shuffle } from '../engine/util.js';
import { programDesk } from '../world/programs.js';

// ================================================================== stations
const INK = '#20232a';
const WHT = '#ffffff';
const GOLD = '#ffd23f';
const ST = {
  mbs: {
    pid: 'mbs', name: 'MBS毎日放送', short: 'MBS', ch: '4',
    main: '#1f5fbf', dark: '#143f86', light: '#6aa2ec', pale: '#dce8fa',
    wall: '#eef1f6', floor: '#e3e7ee', sofa: '#2f6fd0', seat: '#2a5aa8', leaf: '#b98552',
    set: ['#ffd23f', '#5fd7ff', '#ff8a3d', '#7fe08a'], setFloor: '#fff3c4',
    special: 'radio', specialLabel: 'ラジオ',
  },
  ktv: {
    pid: 'ktv', name: '関西テレビ', short: '関西テレビ', ch: '8',
    main: '#e8731c', dark: '#a24c0c', light: '#ffa860', pale: '#ffe8d2',
    wall: '#f6f1ea', floor: '#ebe4d8', sofa: '#e0652a', seat: '#c4551c', leaf: '#a8743f',
    set: ['#ff6fae', '#ffd23f', '#5fd7ff', '#ff8a3d'], setFloor: '#ffe6f0',
    special: 'manzai', specialLabel: '漫才スタジオ',
  },
};

// 3x5 pixel digits for the channel badge on the monitors
const DIGIT = {
  4: ['#.#', '#.#', '###', '..#', '..#'],
  8: ['###', '#.#', '###', '#.#', '###'],
};

// ================================================================== shared tile art
function wallUpper(c, C) {
  R(c, 0, 0, 32, 32, C.wall);
  R(c, 0, 0, 32, 1, shade(C.wall, -0.22)); R(c, 0, 1, 32, 1, shade(C.wall, 0.3));
  R(c, 0, 6, 32, 3, C.main); R(c, 0, 6, 32, 1, C.light); R(c, 0, 9, 32, 1, C.dark);
  R(c, 0, 10, 32, 1, shade(C.wall, 0.12));
  for (const x of [7, 23]) { R(c, x, 11, 1, 21, shade(C.wall, -0.05)); R(c, x + 1, 11, 1, 21, shade(C.wall, 0.06)); }
}
// lip = true when the wall face stands alone under a wall top (no upper wall row above it)
function wallLower(c, C, lip) {
  R(c, 0, 0, 32, 32, C.wall);
  for (const x of [7, 23]) { R(c, x, 0, 1, 20, shade(C.wall, -0.05)); R(c, x + 1, 0, 1, 20, shade(C.wall, 0.06)); }
  if (lip) {
    R(c, 0, 0, 32, 1, shade(C.wall, -0.22)); R(c, 0, 1, 32, 1, shade(C.wall, 0.3));
    R(c, 0, 4, 32, 2, C.main); R(c, 0, 4, 32, 1, C.light);
  }
  R(c, 0, 19, 32, 2, C.main); R(c, 0, 19, 32, 1, C.light);
  R(c, 0, 21, 32, 5, shade(C.wall, -0.05));
  R(c, 0, 26, 32, 6, shade(C.dark, -0.1));
  R(c, 0, 26, 32, 1, shade(C.dark, -0.4)); R(c, 0, 27, 32, 1, shade(C.dark, 0.12));
  R(c, 0, 31, 32, 1, shade(C.dark, -0.45));
}
function floorArt(c, r, C, v) {
  const b = C.floor;
  R(c, 0, 0, 32, 32, b);
  speckle(c, r, [shade(b, -0.03), shade(b, 0.03)], 26);
  for (const o of [0, 16]) {
    R(c, 0, o, 32, 1, shade(b, -0.1)); R(c, o, 0, 1, 32, shade(b, -0.1));
    R(c, 1, o + 1, 31, 1, shade(b, 0.07)); R(c, o + 1, 1, 1, 31, shade(b, 0.05));
  }
  if (v === 0) { line(c, 4, 12, 10, 6, shade(b, 0.14)); line(c, 5, 12, 11, 6, shade(b, 0.09)); }
  if (v === 1) { line(c, 20, 28, 26, 22, shade(b, 0.14)); P(c, 27, 21, WHT); }
}
function runArt(c, r, C, side) {
  R(c, 0, 0, 32, 32, C.main);
  for (let i = 0; i < 40; i++) P(c, Math.floor(r() * 32), Math.floor(r() * 32), i % 2 ? shade(C.main, 0.08) : shade(C.main, -0.08));
  if (side === 'l') { R(c, 0, 0, 3, 32, GOLD); R(c, 3, 0, 1, 32, C.dark); R(c, 0, 0, 1, 32, shade(GOLD, -0.25)); } else { R(c, 29, 0, 3, 32, GOLD); R(c, 28, 0, 1, 32, C.dark); R(c, 31, 0, 1, 32, shade(GOLD, -0.25)); }
}
function counterArt(c, C, v) {
  R(c, 0, 2, 32, 14, '#f6f6f8'); R(c, 0, 2, 32, 1, WHT); R(c, 0, 3, 32, 1, '#fbfbfc');
  R(c, 0, 13, 32, 1, '#ffffff'); R(c, 0, 14, 32, 2, '#d5d9e0');
  R(c, 0, 16, 32, 16, C.main); R(c, 0, 16, 32, 2, C.dark);
  R(c, 0, 22, 32, 2, WHT); R(c, 0, 24, 32, 1, C.light);
  R(c, 0, 30, 32, 2, shade(C.main, -0.4));
  if (v === 1) { oval(c, 20, 6, 7, 5, '#c9a227'); oval(c, 21, 6, 5, 3, '#ffe36e'); R(c, 23, 5, 1, 1, '#8e7018'); }
  if (v === 2) { R(c, 5, 5, 8, 6, WHT); R(c, 6, 6, 6, 1, C.main); R(c, 6, 8, 4, 1, '#9aa0aa'); R(c, 9, 4, 8, 6, C.pale); R(c, 10, 5, 6, 1, C.dark); }
  outline(c);
}
function sofaArt(c, col) {
  shadowEllipse(c, 16, 28, 16, 2);
  const back = shade(col, -0.25);
  R(c, 0, 4, 32, 12, back); R(c, 0, 4, 32, 1, shade(col, 0.15)); R(c, 0, 5, 32, 1, col);
  for (const x of [8, 24]) { P(c, x, 9, shade(col, -0.45)); P(c, x, 10, shade(back, 0.12)); }
  R(c, 0, 14, 32, 12, col); R(c, 0, 14, 32, 2, shade(col, 0.28)); R(c, 0, 16, 32, 1, shade(col, 0.12));
  R(c, 14, 14, 1, 12, shade(col, -0.22)); R(c, 15, 14, 1, 12, shade(col, 0.1));
  R(c, 0, 24, 32, 2, shade(col, -0.15)); R(c, 0, 26, 32, 2, shade(col, -0.45));
  outline(c);
}
// the same sofa seen from behind (the backrest faces the camera)
function sofaBackArt(c, col) {
  shadowEllipse(c, 16, 28, 16, 2);
  R(c, 0, 5, 32, 8, shade(col, 0.1)); R(c, 0, 5, 32, 1, shade(col, 0.35));
  R(c, 14, 5, 1, 8, shade(col, -0.15));
  R(c, 0, 12, 32, 15, shade(col, -0.22)); R(c, 0, 12, 32, 2, shade(col, 0.05));
  for (const x of [8, 24]) { P(c, x, 18, shade(col, -0.45)); P(c, x, 19, shade(col, -0.05)); }
  R(c, 0, 25, 32, 2, shade(col, -0.45));
  outline(c);
}
// tiny program pictures on the lobby monitors: 0 = 大阪城と青空, 1 = 関西の天気予報, 2 = バラエティのスタジオ
function screenPic(c, C, f, x, y, w, h) {
  if (f === 0) {
    R(c, x, y, w, h, '#8fd2fa'); R(c, x, y, w, 4, '#6cbcf2'); R(c, x, y + h - 7, w, 7, '#bfe8ff');
    R(c, x + 2, y + 2, 5, 2, WHT); R(c, x + 3, y + 1, 3, 1, WHT);
    const cx = x + 12;
    R(c, cx - 5, y + h - 6, 11, 4, '#b9bcc6'); R(c, cx - 5, y + h - 6, 11, 1, '#dadce2');
    R(c, cx - 4, y + h - 9, 9, 3, '#f6f6f8'); R(c, cx - 6, y + h - 10, 13, 1, '#2f8a6a');
    R(c, cx - 3, y + h - 12, 7, 2, '#f6f6f8'); R(c, cx - 4, y + h - 13, 9, 1, '#2f8a6a');
    R(c, cx - 2, y + h - 15, 5, 2, '#f6f6f8'); R(c, cx - 3, y + h - 16, 7, 1, '#2f8a6a');
    P(c, cx - 3, y + h - 17, GOLD); P(c, cx + 3, y + h - 17, GOLD);
    R(c, x, y + h - 2, w, 2, '#4a9a4a');
  } else if (f === 1) {
    R(c, x, y, w, h, '#2f6fd0');
    oval(c, x + 3, y + 3, 15, 11, '#5aa04a'); oval(c, x + 9, y + 1, 10, 8, '#5aa04a'); R(c, x + 6, y + 12, 6, 3, '#5aa04a');
    oval(c, x + 4, y + 4, 4, 3, '#74b85a');
    disc(c, x + 8, y + 7, 2, GOLD); P(c, x + 8, y + 4, GOLD); P(c, x + 5, y + 7, GOLD); P(c, x + 11, y + 7, GOLD);
    R(c, x + 14, y + 4, 5, 2, WHT); R(c, x + 15, y + 3, 3, 1, WHT); R(c, x + 15, y + 6, 1, 2, '#9fd0ff'); R(c, x + 17, y + 6, 1, 2, '#9fd0ff');
    R(c, x, y + h - 4, w, 4, '#1d2650'); R(c, x + 2, y + h - 3, 6, 1, WHT); R(c, x + 10, y + h - 3, 4, 1, '#ff8a8a'); R(c, x + 16, y + h - 3, 4, 1, '#8ac8ff');
  } else {
    for (let i = 0; i < 4; i++) R(c, x + i * 6, y, 6, h, C.set[i]);
    R(c, x, y + h - 5, w, 5, shade(C.main, -0.1));
    for (const [px, col] of [[x + 5, '#ff7eb6'], [x + 11, C.main], [x + 17, '#5ee07a']]) {
      R(c, px - 1, y + h - 9, 3, 4, col); R(c, px - 1, y + h - 12, 3, 3, '#f6c9a0'); P(c, px - 1, y + h - 13, INK); P(c, px, y + h - 13, INK); P(c, px + 1, y + h - 13, INK);
    }
    for (const [lx, ly] of [[x + 2, y + 3], [x + 14, y + 2], [x + 20, y + 5]]) { P(c, lx, ly, WHT); P(c, lx + 1, ly + 1, WHT); P(c, lx + 2, ly, WHT); }
  }
}
function monitorArt(c, C, f) {
  R(c, 2, 3, 28, 21, '#16181d'); R(c, 2, 3, 28, 1, '#3b3f48'); R(c, 29, 4, 1, 20, '#0e0f12');
  screenPic(c, C, f, 4, 5, 24, 17);
  R(c, 21, 6, 6, 7, C.main); R(c, 21, 6, 6, 1, C.light);
  pix(c, DIGIT[C.ch], { '#': WHT }, 22, 7);
  R(c, 12, 24, 8, 2, '#4a4e58'); R(c, 12, 24, 8, 1, '#5f6470'); P(c, 27, 23, '#5ee07a');
  outline(c);
}
function photoArt(c, C, v) {
  shadowEllipse(c, 16, 30, 12, 2);
  R(c, 7, 22, 2, 8, '#5a3a20'); R(c, 23, 22, 2, 8, '#5a3a20'); R(c, 7, 22, 1, 8, '#7a5230');
  bevel(c, 2, 2, 28, 22, '#3a2416', '#5a3a20', '#24160c');
  const x = 4, y = 4, w = 24, h = 18;
  if (v === 0) {
    screenPic(c, C, 0, x, y, w, h);
  } else if (v === 1) {
    // lattice tower over the old town
    R(c, x, y, w, h, '#ffd9a0'); R(c, x, y, w, 5, '#ffc070'); R(c, x, y + 5, w, 3, '#ffcf8a');
    const cx = x + 12;
    for (let i = 0; i < 12; i++) { const hw = 1 + Math.floor(i / 3); R(c, cx - hw, y + 4 + i, hw * 2, 1, i % 3 === 0 ? '#5a5f6b' : '#7d8391'); }
    R(c, cx - 3, y + 2, 6, 2, '#5a5f6b'); R(c, cx - 1, y, 2, 2, '#9aa0aa'); P(c, cx, y, '#ff5d6c');
    R(c, cx - 2, y + 7, 4, 1, '#ffe36e');
    for (let i = 0; i < w; i += 5) R(c, x + i, y + h - 3 - (i % 3), 4, 3 + (i % 3), '#8a5a33');
    R(c, x, y + h - 1, w, 1, '#5a3a20');
  } else {
    // night river, neon signs on both banks and a little bridge
    R(c, x, y, w, h, '#1b2350');
    R(c, x, y + 10, w, h - 10, '#23306a');
    for (let k = 0; k < 3; k++) R(c, x + 2 + k * 8, y + 13 + (k % 2), 4, 1, '#5a6ad0');
    const neon = ['#ff5d6c', GOLD, '#5fd7ff', '#ff7eb6', '#5ee07a'];
    for (let i = 0; i < 5; i++) { R(c, x + 1 + i * 5, y + 2 + (i % 2) * 2, 3, 5, neon[i]); P(c, x + 2 + i * 5, y + 3 + (i % 2) * 2, WHT); R(c, x + 1 + i * 5, y + 14 + (i % 2), 3, 1, shade(neon[i], -0.3)); }
    R(c, x, y + 9, w, 1, '#3a2a20');
    R(c, x + 8, y + 8, 8, 1, '#c9a227'); P(c, x + 7, y + 9, '#c9a227'); P(c, x + 16, y + 9, '#c9a227');
  }
  outline(c);
}
// a seamless studio door, wooden (楽屋) or a heavy sound-proof one (ラジオ / 漫才スタジオ)
function doorUpper(c, C, metal) {
  wallUpper(c, C);
  const leaf = metal ? '#5a5f6b' : C.leaf;
  R(c, 3, 12, 26, 20, shade(C.dark, -0.25)); R(c, 3, 12, 26, 1, shade(C.dark, 0.15));
  R(c, 5, 14, 22, 18, leaf); R(c, 5, 14, 22, 1, shade(leaf, 0.3)); R(c, 5, 15, 1, 17, shade(leaf, 0.15)); R(c, 26, 15, 1, 17, shade(leaf, -0.25));
  if (metal) {
    R(c, 12, 18, 8, 7, '#1d2650'); R(c, 12, 18, 8, 1, '#0e1430'); R(c, 13, 19, 3, 1, '#4a6aa8'); R(c, 13, 20, 1, 2, '#4a6aa8');
    R(c, 5, 28, 22, 2, C.main);
  } else {
    R(c, 9, 18, 14, 8, '#9ccbe6'); R(c, 9, 18, 14, 1, shade(leaf, -0.3)); R(c, 10, 19, 4, 1, '#d8f0fb'); R(c, 10, 20, 1, 3, '#d8f0fb');
    R(c, 9, 28, 14, 1, shade(leaf, -0.18));
  }
}
function doorLower(c, C, metal) {
  wallLower(c, C, false);
  const leaf = metal ? '#5a5f6b' : C.leaf;
  R(c, 3, 0, 2, 30, shade(C.dark, -0.25)); R(c, 27, 0, 2, 30, shade(C.dark, -0.25)); R(c, 3, 0, 1, 30, shade(C.dark, 0.1));
  R(c, 5, 0, 22, 29, leaf); R(c, 5, 0, 1, 29, shade(leaf, 0.15)); R(c, 26, 0, 1, 29, shade(leaf, -0.25));
  if (metal) {
    R(c, 7, 10, 18, 3, '#9aa0aa'); R(c, 7, 10, 18, 1, '#d5d9e0'); R(c, 7, 12, 18, 1, '#6d7380');
    R(c, 5, 22, 22, 7, shade(leaf, -0.18)); R(c, 5, 22, 22, 1, shade(leaf, 0.1));
  } else {
    inset(c, 8, 3, 16, 14, leaf, shade(leaf, 0.12), shade(leaf, -0.2));
    R(c, 22, 15, 2, 5, GOLD); R(c, 22, 15, 1, 5, '#fff3a0');
    R(c, 5, 23, 22, 6, '#c3c8d2'); R(c, 5, 23, 22, 1, '#e4e7ec');
  }
  R(c, 3, 29, 26, 3, '#9aa0aa'); R(c, 3, 29, 26, 1, '#c3c8d2');
}
// studio double doors: side 'l' | 'r'
function sdoorUpper(c, C, side) {
  wallUpper(c, C);
  const L = side === 'l';
  R(c, 0, 11, 32, 21, '#3b3f48');
  const x0 = L ? 3 : 0;
  R(c, x0, 13, 29, 19, '#a3a8b2'); R(c, x0, 13, 29, 1, '#d5d9e0');
  R(c, L ? 31 : 0, 13, 1, 19, '#5a5f6b');
  disc(c, L ? 18 : 13, 22, 5, '#5a5f6b'); disc(c, L ? 18 : 13, 22, 4, '#1d2650'); P(c, L ? 16 : 11, 20, '#5a7ab8'); P(c, L ? 17 : 12, 19, '#5a7ab8');
  R(c, x0, 29, 29, 2, C.main);
}
function sdoorLower(c, C, side) {
  wallLower(c, C, false);
  const L = side === 'l';
  R(c, 0, 0, 32, 30, '#3b3f48');
  const x0 = L ? 3 : 0;
  R(c, x0, 0, 29, 29, '#a3a8b2');
  R(c, L ? 31 : 0, 0, 1, 29, '#5a5f6b');
  R(c, L ? 10 : 2, 9, 20, 3, '#d5d9e0'); R(c, L ? 10 : 2, 11, 20, 1, '#7d8391');
  R(c, x0, 21, 29, 8, '#8a909a'); R(c, x0, 21, 29, 1, '#b8bec8');
  R(c, 0, 29, 32, 3, '#6d7380'); R(c, 0, 29, 32, 1, '#9aa0aa');
}
function matArt(c, C) {
  R(c, 0, 0, 32, 32, shade(C.dark, -0.2)); R(c, 2, 2, 28, 28, C.main);
  for (let y = 6; y < 28; y += 5) { R(c, 4, y, 24, 2, C.light); R(c, 4, y + 2, 24, 1, C.dark); }
}
// ---- studio set
function setArt(c, C, f, lower) {
  for (let i = 0; i < 4; i++) {
    const col = C.set[i];
    R(c, i * 8, 0, 8, 32, col); R(c, i * 8, 0, 1, 32, shade(col, 0.3)); R(c, i * 8 + 7, 0, 1, 32, shade(col, -0.18));
  }
  const band = '#2a1a3a';
  const yb = lower ? 24 : 0;
  R(c, 0, yb, 32, lower ? 8 : 7, band); R(c, 0, lower ? 24 : 6, 32, 1, '#5a3a7a');
  for (let k = 0; k < 4; k++) {
    const lit = (k + f) % 2 === 0;
    const bx = k * 8 + 3, by = lower ? 27 : 2;
    R(c, bx, by, 3, 3, lit ? '#fff6a8' : '#8a6a3a');
    if (lit) { P(c, bx, by, WHT); P(c, bx + 1, by - 1, 'rgba(255,246,168,0.6)'); }
  }
  if (!lower) {
    // little star sparkles on the stripes
    for (const [sx, sy] of [[4, 14], [20, 22], [12, 26]]) { P(c, sx, sy, WHT); P(c, sx - 1, sy, shade(WHT, -0.1)); P(c, sx + 1, sy, shade(WHT, -0.1)); P(c, sx, sy - 1, shade(WHT, -0.1)); P(c, sx, sy + 1, shade(WHT, -0.1)); }
  } else {
    for (const [sx, sy] of [[28, 8], [10, 16]]) { P(c, sx, sy, WHT); P(c, sx - 1, sy, shade(WHT, -0.1)); P(c, sx + 1, sy, shade(WHT, -0.1)); P(c, sx, sy - 1, shade(WHT, -0.1)); P(c, sx, sy + 1, shade(WHT, -0.1)); }
  }
}
function setFloorArt(c, C) {
  const a = C.setFloor, b = WHT;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const col = (i + j) % 2 ? a : b;
    R(c, i * 16, j * 16, 16, 16, col);
    R(c, i * 16, j * 16, 16, 1, shade(col, -0.06)); R(c, i * 16, j * 16, 1, 16, shade(col, -0.06));
    line(c, i * 16 + 3, j * 16 + 9, i * 16 + 9, j * 16 + 3, shade(col, 0.4));
  }
}
function hinaArt(c, C, upper) {
  const top = upper ? 4 : 10;
  R(c, 0, top, 32, 7, C.light); R(c, 0, top, 32, 1, shade(C.light, 0.35)); R(c, 0, top + 6, 32, 1, shade(C.light, -0.15));
  R(c, 15, top + 1, 1, 5, shade(C.light, -0.2)); R(c, 31, top + 1, 1, 5, shade(C.light, -0.2));
  R(c, 0, top + 7, 32, 32 - top - 7, C.main); R(c, 0, top + 7, 32, 1, C.dark);
  R(c, 0, top + 11, 32, 2, GOLD); R(c, 0, top + 13, 32, 1, shade(GOLD, -0.3));
  for (const x of [7, 23]) { disc(c, x, top + 18, 1, '#fff6a8'); }
  R(c, 0, 30, 32, 2, shade(C.dark, -0.2));
}
function podiumArt(c, C) {
  shadowEllipse(c, 16, 30, 13, 2);
  R(c, 5, 12, 22, 18, C.main); R(c, 5, 12, 1, 18, C.light); R(c, 26, 12, 1, 18, C.dark);
  R(c, 3, 8, 26, 5, WHT); R(c, 3, 8, 26, 1, '#ffffff'); R(c, 3, 12, 26, 1, '#c3c8d2');
  // star on the front
  pix(c, ['..#..', '.###.', '#####', '.###.', '##.##'], { '#': GOLD }, 14, 18);
  R(c, 5, 27, 22, 3, C.dark);
  // gooseneck mic
  line(c, 9, 8, 7, 3, '#5a5f6b'); oval(c, 5, 0, 5, 4, INK); P(c, 6, 1, '#7d8391');
  R(c, 18, 9, 7, 2, '#f6f1e0'); R(c, 19, 9, 5, 1, '#c3c8d2');
  outline(c);
}
function setEdgeArt(c, C, f) {
  R(c, 0, 0, 32, 32, C.dark);
  R(c, 0, 0, 32, 5, WHT); R(c, 0, 0, 32, 1, '#ffffff'); R(c, 0, 4, 32, 1, '#d5d9e0');
  R(c, 0, 5, 32, 2, shade(C.dark, -0.4));
  for (let k = 0; k < 4; k++) {
    const col = C.set[(k + f) % 4];
    R(c, k * 8 + 2, 12, 4, 4, '#1a1020'); R(c, k * 8 + 3, 13, 2, 2, col); P(c, k * 8 + 3, 13, WHT);
  }
  R(c, 0, 20, 32, 2, C.main); R(c, 0, 20, 32, 1, C.light);
  R(c, 0, 30, 32, 2, shade(C.dark, -0.45));
}
// audience bench seat seen from behind; rows 12..31 also cover a seated person's lower body
function seatArt(c, C) {
  const col = C.seat;
  R(c, 4, 27, 3, 5, '#2a2d36'); R(c, 25, 27, 3, 5, '#2a2d36');
  R(c, 1, 11, 30, 17, shade(col, -0.1)); R(c, 1, 11, 30, 2, shade(col, 0.32)); R(c, 1, 13, 1, 14, shade(col, 0.15));
  R(c, 3, 14, 26, 10, col); R(c, 3, 14, 26, 1, shade(col, 0.15));
  R(c, 15, 14, 2, 10, shade(col, -0.25));
  R(c, 1, 26, 30, 2, shade(col, -0.4));
  R(c, 12, 18, 8, 3, '#e8e2d0'); R(c, 13, 19, 2, 1, INK); R(c, 17, 19, 2, 1, INK);
  outline(c);
}

function defineStationTiles(C) {
  const t = (k) => `${C.pid}_${k}`;
  defineTile(t('walltop'), {
    solid: true,
    draw(c) { R(c, 0, 0, 16, 16, shade(C.dark, -0.5)); },
    hd(c) { R(c, 0, 0, 32, 32, shade(C.dark, -0.5)); },
  });
  defineTile(t('wall_u'), {
    solid: true,
    draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 0, 3, 16, 2, C.main); R(c, 7, 6, 1, 10, shade(C.wall, -0.06)); },
    hd(c) { wallUpper(c, C); },
  });
  defineTile(t('wall_lo'), {
    solid: true,
    draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 0, 9, 16, 1, C.main); R(c, 0, 13, 16, 3, C.dark); },
    hd(c) { wallLower(c, C, false); },
  });
  defineTile(t('wall'), {
    solid: true,
    draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 0, 0, 16, 1, shade(C.wall, 0.3)); R(c, 0, 2, 16, 1, C.main); R(c, 0, 9, 16, 1, C.main); R(c, 0, 13, 16, 3, C.dark); },
    hd(c) { wallLower(c, C, true); },
  });
  defineTile(t('floor'), {
    variants: 3,
    draw(c, r, f, v) { R(c, 0, 0, 16, 16, C.floor); R(c, 0, 0, 16, 1, shade(C.floor, -0.08)); R(c, 0, 0, 1, 16, shade(C.floor, -0.08)); if (v === 0) R(c, 3, 4, 3, 1, WHT); },
    hd(c, r, f, v) { floorArt(c, r, C, v); },
  });
  for (const side of ['l', 'r']) {
    defineTile(t('run_' + side), {
      draw(c) { R(c, 0, 0, 16, 16, C.main); R(c, side === 'l' ? 0 : 14, 0, 2, 16, GOLD); },
      hd(c, r) { runArt(c, r, C, side); },
    });
  }
  defineTile(t('counter'), {
    solid: true, obj: true, talkThrough: true, variants: 3,
    draw(c) { R(c, 0, 1, 16, 7, '#f6f6f8'); R(c, 0, 8, 16, 8, C.main); R(c, 0, 11, 16, 1, WHT); },
    hd(c, r, f, v) { counterArt(c, C, v); },
  });
  defineTile(t('sofa'), {
    solid: true, obj: true,
    draw(c) { R(c, 0, 2, 16, 6, shade(C.sofa, -0.25)); R(c, 0, 7, 16, 6, C.sofa); },
    hd(c) { sofaArt(c, C.sofa); },
  });
  defineTile(t('sofa_up'), {
    solid: true, obj: true,
    draw(c) { R(c, 0, 3, 16, 5, C.sofa); R(c, 0, 7, 16, 6, shade(C.sofa, -0.25)); },
    hd(c) { sofaBackArt(c, C.sofa); },
  });
  defineTile(t('mon'), {
    solid: true, obj: true, frames: 3, speed: 70, variants: 3,
    draw(c, r, f, v) { R(c, 1, 2, 14, 10, INK); R(c, 2, 3, 12, 8, ['#8fd2fa', '#2f6fd0', C.set[0]][(f + v) % 3]); },
    hd(c, r, f, v) { monitorArt(c, C, (f + v) % 3); },
  });
  // dark studio floor; a gaffer-tape mark here and there
  defineTile(t('sfloor'), {
    variants: 9,
    draw(c, r) { R(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 14); },
    hd(c, r, f, v) {
      R(c, 0, 0, 32, 32, '#2e3038'); speckle(c, r, ['#34363f', '#292b32', '#31333b'], 60);
      if (v === 4) { R(c, 8, 15, 10, 3, C.light); R(c, 12, 11, 3, 11, C.light); R(c, 8, 15, 10, 1, shade(C.light, 0.3)); }
    },
  });
  defineTile(t('photo'), {
    solid: true, obj: true, variants: 3,
    draw(c) { R(c, 1, 1, 14, 11, '#3a2416'); R(c, 2, 2, 12, 9, '#8fd2fa'); R(c, 3, 11, 1, 4, '#5a3a20'); R(c, 12, 11, 1, 4, '#5a3a20'); },
    hd(c, r, f, v) { photoArt(c, C, v); },
  });
  defineTile(t('door_u'), { solid: true, draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 2, 6, 12, 10, C.leaf); }, hd(c) { doorUpper(c, C, false); } });
  defineTile(t('door'), { draw(c) { R(c, 0, 0, 16, 16, C.leaf); R(c, 11, 7, 1, 3, GOLD); }, hd(c) { doorLower(c, C, false); } });
  defineTile(t('mdoor_u'), { solid: true, draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 2, 6, 12, 10, '#5a5f6b'); }, hd(c) { doorUpper(c, C, true); } });
  defineTile(t('mdoor'), { draw(c) { R(c, 0, 0, 16, 16, '#5a5f6b'); R(c, 3, 5, 10, 1, '#9aa0aa'); }, hd(c) { doorLower(c, C, true); } });
  for (const side of ['l', 'r']) {
    defineTile(t('sdoor_u' + side), { solid: true, draw(c) { R(c, 0, 0, 16, 16, C.wall); R(c, 0, 6, 16, 10, '#a3a8b2'); }, hd(c) { sdoorUpper(c, C, side); } });
    defineTile(t('sdoor_' + side), { draw(c) { R(c, 0, 0, 16, 16, '#a3a8b2'); R(c, 0, 5, 16, 1, '#d5d9e0'); }, hd(c) { sdoorLower(c, C, side); } });
  }
  defineTile(t('mat'), {
    draw(c) { R(c, 0, 0, 16, 16, C.dark); R(c, 1, 1, 14, 14, C.main); for (let y = 3; y < 14; y += 3) R(c, 2, y, 12, 1, C.light); },
    hd(c) { matArt(c, C); },
  });
  defineTile(t('set_u'), {
    solid: true, frames: 2, speed: 30,
    draw(c, r, f) { for (let i = 0; i < 4; i++) R(c, i * 4, 0, 4, 16, C.set[i]); R(c, 0, 0, 16, 3, '#2a1a3a'); P(c, 2 + f * 4, 1, '#fff6a8'); },
    hd(c, r, f) { setArt(c, C, f, false); },
  });
  defineTile(t('set'), {
    solid: true, frames: 2, speed: 30,
    draw(c, r, f) { for (let i = 0; i < 4; i++) R(c, i * 4, 0, 4, 16, C.set[i]); R(c, 0, 12, 16, 4, '#2a1a3a'); P(c, 2 + f * 4, 14, '#fff6a8'); },
    hd(c, r, f) { setArt(c, C, f, true); },
  });
  defineTile(t('setfloor'), {
    draw(c) { R(c, 0, 0, 8, 8, WHT); R(c, 8, 0, 8, 8, C.setFloor); R(c, 0, 8, 8, 8, C.setFloor); R(c, 8, 8, 8, 8, WHT); },
    hd(c) { setFloorArt(c, C); },
  });
  defineTile(t('hina_u'), {
    solid: true, obj: true,
    draw(c) { R(c, 0, 2, 16, 4, C.light); R(c, 0, 6, 16, 10, C.main); R(c, 0, 8, 16, 1, GOLD); },
    hd(c) { hinaArt(c, C, true); },
  });
  defineTile(t('hina'), {
    solid: true, obj: true,
    draw(c) { R(c, 0, 5, 16, 4, C.light); R(c, 0, 9, 16, 7, C.main); R(c, 0, 11, 16, 1, GOLD); },
    hd(c) { hinaArt(c, C, false); },
  });
  defineTile(t('podium'), {
    solid: true, obj: true, talkThrough: true,
    draw(c) { R(c, 2, 4, 12, 3, WHT); R(c, 3, 7, 10, 8, C.main); P(c, 8, 10, GOLD); },
    hd(c) { podiumArt(c, C); },
  });
  defineTile(t('setedge'), {
    solid: true, frames: 2, speed: 24,
    draw(c, r, f) { R(c, 0, 0, 16, 16, C.dark); R(c, 0, 0, 16, 3, WHT); for (let k = 0; k < 4; k++) P(c, k * 4 + 1, 7, C.set[(k + f) % 4]); },
    hd(c, r, f) { setEdgeArt(c, C, f); },
  });
  defineTile(t('seat'), {
    solid: true, obj: true,
    draw(c) { R(c, 1, 5, 14, 9, C.seat); R(c, 1, 5, 14, 1, shade(C.seat, 0.3)); R(c, 2, 14, 2, 2, INK); R(c, 12, 14, 2, 2, INK); },
    hd(c) { seatArt(c, C); },
  });
}
defineStationTiles(ST.mbs);
defineStationTiles(ST.ktv);

// ================================================================== MBS: radio booth tiles
function foam(c, y0, y1) {
  for (let y = y0; y < y1; y += 8) {
    for (let x = 0; x < 32; x += 8) {
      R(c, x + 1, y + 1, 6, 6, '#4a5470'); R(c, x + 1, y + 1, 6, 1, '#5e6a88'); R(c, x + 1, y + 2, 1, 5, '#56617e');
      R(c, x + 6, y + 2, 1, 5, '#323a4c'); R(c, x + 2, y + 6, 5, 1, '#323a4c'); P(c, x + 3, y + 3, '#6a7694'); P(c, x + 4, y + 4, '#5e6a88');
    }
  }
}
defineTile('mbs_ac_u', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#3a4256'); for (let x = 0; x < 16; x += 4) R(c, x + 1, 3, 2, 12, '#4a5470'); },
  hd(c) { R(c, 0, 0, 32, 32, '#2e3546'); R(c, 0, 0, 32, 1, '#1e2430'); R(c, 0, 1, 32, 1, '#5a6480'); foam(c, 3, 32); },
});
defineTile('mbs_ac', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#3a4256'); R(c, 0, 12, 16, 4, '#1e2430'); },
  hd(c) {
    R(c, 0, 0, 32, 32, '#2e3546'); foam(c, -5, 24);
    R(c, 0, 24, 32, 8, '#1e2430'); R(c, 0, 24, 32, 1, '#5a6480'); R(c, 0, 25, 32, 1, ST.mbs.main);
  },
});
defineTile('mbs_carpet', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#2c3550'); speckle(c, r, ['#343e5c', '#262e46'], 14); },
  hd(c, r) { R(c, 0, 0, 32, 32, '#2c3550'); speckle(c, r, ['#343e5c', '#262e46', '#3a4566'], 70); },
});
// glass partition between the on-air booth and the control room
defineTile('mbs_glass', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 9, '#9fd0ea'); R(c, 0, 9, 16, 7, '#5a6070'); R(c, 0, 9, 16, 1, '#9aa0aa'); },
  hd(c) {
    R(c, 0, 0, 32, 20, '#9fd0ea');
    for (let i = 0; i < 3; i++) line(c, 6 + i * 3, 18, 18 + i * 3, 2, i === 1 ? '#e8f8ff' : '#c8eaf8');
    R(c, 0, 0, 32, 2, '#7d8391'); R(c, 0, 0, 32, 1, '#c3c8d2');
    R(c, 0, 0, 1, 20, '#7d8391'); R(c, 31, 0, 1, 20, '#5a5f6b');
    R(c, 0, 18, 32, 3, '#c3c8d2'); R(c, 0, 18, 32, 1, '#e4e7ec');
    R(c, 0, 21, 32, 11, '#4a505e'); R(c, 0, 21, 32, 1, '#2a2d36');
    for (const x of [8, 24]) R(c, x, 24, 1, 6, '#3b404c');
    R(c, 0, 30, 32, 2, '#2a2d36');
  },
});
// open doorway into the booth (walkable)
defineTile('mbs_bdoor', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#2c3550'); R(c, 0, 0, 2, 16, '#7d8391'); R(c, 14, 0, 2, 16, '#7d8391'); R(c, 0, 0, 16, 2, '#7d8391'); },
  hd(c, r) {
    R(c, 0, 0, 32, 32, '#2c3550'); speckle(c, r, ['#343e5c', '#262e46'], 40);
    R(c, 0, 0, 3, 32, '#7d8391'); R(c, 0, 0, 1, 32, '#c3c8d2'); R(c, 29, 0, 3, 32, '#5a5f6b'); R(c, 31, 0, 1, 32, '#3b3f48');
    R(c, 0, 0, 32, 3, '#9aa0aa'); R(c, 0, 0, 32, 1, '#c3c8d2');
    R(c, 3, 3, 26, 2, 'rgba(0,0,0,0.25)');
    R(c, 6, 26, 20, 4, '#3a4566'); R(c, 6, 26, 20, 1, '#4a5680');
  },
});
// the on-air desk with mic arms (talk across it to the DJ)
defineTile('mbs_rdesk', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c) { R(c, 0, 5, 16, 5, '#5a5f6b'); R(c, 0, 10, 16, 5, ST.mbs.dark); R(c, 4, 1, 2, 4, INK); },
  hd(c, r, f, v) {
    shadowEllipse(c, 16, 30, 16, 2);
    R(c, 0, 10, 32, 10, '#6d7380'); R(c, 0, 10, 32, 1, '#9aa0aa'); R(c, 0, 19, 32, 1, '#4a4e58');
    R(c, 0, 20, 32, 10, ST.mbs.dark); R(c, 0, 20, 32, 1, ST.mbs.main); R(c, 0, 24, 32, 1, ST.mbs.light);
    const mx = v ? 22 : 8;
    line(c, mx, 12, mx + (v ? -3 : 3), 5, '#2a2d36'); line(c, mx + 1, 12, mx + (v ? -2 : 4), 5, '#5a5f6b');
    oval(c, mx + (v ? -6 : 2), 0, 6, 6, INK); R(c, mx + (v ? -5 : 3), 1, 2, 1, '#7d8391'); R(c, mx + (v ? -5 : 3), 3, 4, 1, '#3b3f48');
    if (v) { R(c, 4, 12, 9, 6, WHT); R(c, 5, 13, 7, 1, '#9aa0aa'); R(c, 5, 15, 5, 1, '#9aa0aa'); }
    else { ring(c, 22, 15, 2, 3.6, INK); R(c, 18, 14, 2, 4, '#3b3f48'); R(c, 25, 14, 2, 4, '#3b3f48'); }
    outline(c);
  },
});
function ring(c, cx, cy, r0, r1, col) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - r1); y <= cy + r1; y++) for (let x = Math.floor(cx - r1); x <= cx + r1; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= r0 && d <= r1) c.fillRect(x, y, 1, 1);
  }
}
// mixing console with faders and level meters
defineTile('mbs_mixer', {
  solid: true, obj: true, frames: 2, speed: 18,
  draw(c, r, f) { R(c, 0, 4, 16, 10, '#2e3038'); for (let x = 2; x < 15; x += 3) R(c, x, 6 + ((x + f) % 3), 2, 2, '#d5d9e0'); },
  hd(c, r, f) {
    shadowEllipse(c, 16, 30, 16, 2);
    R(c, 0, 6, 32, 17, '#2e3038'); R(c, 0, 6, 32, 1, '#5a5f6b'); R(c, 0, 7, 32, 1, '#3b3f48');
    for (let x = 2; x < 31; x += 4) {
      const lv = 1 + ((x * 7 + f * 5) % 4);
      for (let k = 0; k < 4; k++) P(c, x, 9 + (3 - k), k < lv ? (k === 3 ? '#ff5d6c' : k === 2 ? GOLD : '#5ee07a') : '#15151a');
      R(c, x + 1, 13, 1, 8, '#15151a'); R(c, x, 15 + ((x + f) % 3) * 2, 3, 2, '#d5d9e0'); P(c, x, 15 + ((x + f) % 3) * 2, WHT);
    }
    R(c, 0, 23, 32, 6, '#1e1e24'); R(c, 0, 23, 32, 1, '#3b3f48'); R(c, 0, 28, 32, 1, '#101014');
    outline(c);
  },
});
// shelf of records and CDs (on the booth wall)
defineTile('mbs_rack', {
  solid: true, obj: true,
  draw(c) { R(c, 1, 1, 14, 12, '#5a3a20'); for (let x = 2; x < 14; x += 2) R(c, x, 2, 1, 5, ['#ff5d6c', GOLD, '#5fd7ff', WHT][x % 4]); },
  hd(c) {
    bevel(c, 2, 2, 28, 24, '#6e4a2a', '#8a5e36', '#4a2e18');
    for (const y of [4, 14]) {
      R(c, 4, y, 24, 9, '#2a1a10');
      const cols = ['#ff5d6c', GOLD, '#5fd7ff', '#f6f6f8', '#7fe08a', '#ff8a3d', '#b88ae8'];
      for (let x = 5, i = y; x < 27; x += 2, i++) { const h = 6 + (i % 3); R(c, x, y + 9 - h, 2, h, cols[i % cols.length]); R(c, x, y + 9 - h, 1, h, shade(cols[i % cols.length], 0.25)); }
      R(c, 4, y + 9, 24, 1, '#8a5e36');
    }
    outline(c);
  },
});
// box of listeners' postcards
defineTile('mbs_hagaki', {
  solid: true, obj: true,
  draw(c) { R(c, 3, 7, 10, 8, '#a87449'); R(c, 4, 4, 8, 4, WHT); },
  hd(c) {
    shadowEllipse(c, 16, 30, 11, 2);
    R(c, 6, 14, 20, 15, '#a87449'); R(c, 6, 14, 20, 1, '#c99a68'); R(c, 6, 15, 1, 14, '#c08a58'); R(c, 25, 15, 1, 14, '#7a5230');
    R(c, 8, 20, 16, 6, '#8a5e36'); R(c, 9, 22, 14, 1, '#5a3a20');
    for (const [x, y, col] of [[8, 9, '#ff7eb6'], [12, 7, '#5fd7ff'], [16, 10, GOLD], [10, 4, '#7fe08a']]) {
      R(c, x, y, 10, 6, '#fbf6ea'); R(c, x, y, 10, 1, WHT); R(c, x + 1, y + 2, 4, 1, col); R(c, x + 1, y + 4, 6, 1, '#9aa0aa');
    }
    outline(c);
  },
});

// ================================================================== 関西テレビ: manzai studio tiles
function velvet(c, y0, y1) {
  R(c, 0, y0, 32, y1 - y0, '#8e1420');
  for (let x = 0; x < 32; x += 8) { R(c, x + 1, y0, 2, y1 - y0, '#b8202e'); R(c, x + 3, y0, 1, y1 - y0, '#a01a26'); R(c, x + 6, y0, 2, y1 - y0, '#5e0c14'); }
}
defineTile('ktv_cw_u', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#8e1420'); R(c, 0, 0, 16, 3, '#c9a227'); for (let x = 0; x < 16; x += 4) R(c, x + 3, 3, 1, 13, '#5e0c14'); },
  hd(c) {
    velvet(c, 0, 32);
    R(c, 0, 0, 32, 1, '#5a0a10'); R(c, 0, 1, 32, 5, '#c9a227'); R(c, 0, 1, 32, 1, '#ffe36e');
    for (let x = 0; x < 32; x += 4) { R(c, x, 6, 3, 2, '#c9a227'); P(c, x + 1, 8, '#8e7018'); }
  },
});
defineTile('ktv_cw', {
  solid: true,
  draw(c) { R(c, 0, 0, 16, 16, '#8e1420'); for (let x = 0; x < 16; x += 4) R(c, x + 3, 0, 1, 13, '#5e0c14'); R(c, 0, 13, 16, 3, '#3a0a10'); },
  hd(c) { velvet(c, 0, 26); R(c, 0, 26, 32, 6, '#3a0a10'); R(c, 0, 26, 32, 1, '#24060a'); R(c, 0, 27, 32, 1, '#5e0c14'); },
});
// gold folding screen (kinbyobu): panels alternate light / dark so the folds read
function byobu(c, lower) {
  for (let i = 0; i < 2; i++) {
    const base = i ? '#d4ac2e' : '#ecc64a';
    R(c, i * 16, 0, 16, 32, base);
    for (let y = 0; y < 32; y += 8) R(c, i * 16, y, 16, 1, shade(base, -0.06));
    for (let x = 0; x < 16; x += 8) R(c, i * 16 + x, 0, 1, 32, shade(base, -0.05));
    R(c, i * 16, 0, 1, 32, shade(base, i ? -0.25 : 0.25));
  }
  if (!lower) {
    R(c, 0, 0, 32, 3, '#2a1a10'); R(c, 0, 0, 32, 1, '#4a3020'); R(c, 0, 3, 32, 1, '#8e7018');
    oval(c, 3, 9, 12, 5, '#f6dc7a'); oval(c, 6, 7, 8, 4, '#f6dc7a'); oval(c, 19, 17, 11, 4, '#f6dc7a');
  } else {
    oval(c, 8, 5, 14, 4, '#f6dc7a');
    R(c, 0, 26, 32, 6, '#2a1a10'); R(c, 0, 26, 32, 1, '#8e7018'); R(c, 0, 27, 32, 1, '#4a3020');
  }
}
defineTile('ktv_byobu_u', {
  solid: true,
  draw(c) { R(c, 0, 0, 8, 16, '#ecc64a'); R(c, 8, 0, 8, 16, '#d4ac2e'); R(c, 0, 0, 16, 2, '#2a1a10'); },
  hd(c) { byobu(c, false); },
});
defineTile('ktv_byobu', {
  solid: true,
  draw(c) { R(c, 0, 0, 8, 16, '#ecc64a'); R(c, 8, 0, 8, 16, '#d4ac2e'); R(c, 0, 13, 16, 3, '#2a1a10'); },
  hd(c) { byobu(c, true); },
});
// judges' table: white cloth, orange skirt, name cards / water / bell
defineTile('ktv_judge', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  draw(c) { R(c, 0, 3, 16, 5, '#f6f6f8'); R(c, 0, 8, 16, 8, ST.ktv.main); },
  hd(c, r, f, v) {
    R(c, 0, 6, 32, 10, '#f6f6f8'); R(c, 0, 6, 32, 1, WHT); R(c, 0, 15, 32, 1, '#d5d9e0');
    R(c, 0, 16, 32, 14, ST.ktv.main); R(c, 0, 16, 32, 2, ST.ktv.dark);
    for (let x = 3; x < 32; x += 6) { R(c, x, 18, 1, 12, shade(ST.ktv.main, -0.18)); R(c, x + 1, 18, 1, 12, ST.ktv.light); }
    R(c, 0, 30, 32, 2, shade(ST.ktv.dark, -0.3));
    if (v === 0) { R(c, 9, 4, 14, 8, WHT); R(c, 9, 4, 14, 1, '#e4e7ec'); R(c, 11, 6, 10, 2, '#d62f2f'); R(c, 12, 9, 8, 1, '#9aa0aa'); }
    if (v === 1) { R(c, 6, 3, 5, 9, '#cfe8f5'); R(c, 6, 3, 5, 1, WHT); R(c, 7, 6, 3, 5, '#8fd2fa'); oval(c, 18, 6, 9, 6, '#d62f2f'); oval(c, 20, 6, 4, 2, '#ff8a8a'); R(c, 17, 11, 11, 2, '#3b3f48'); }
    if (v === 2) { R(c, 6, 7, 12, 7, '#fbf6ea'); R(c, 7, 8, 8, 1, '#9aa0aa'); R(c, 7, 10, 6, 1, '#9aa0aa'); line(c, 20, 12, 26, 6, INK); P(c, 26, 6, '#d62f2f'); }
    outline(c);
  },
});

// ================================================================== items
registerItem('mbs_sticker', { name: 'ラジオの番組ステッカー', price: 0, desc: 'ラジオのお便り紹介で大成功した記念。\nスマホに貼ると、ちょっと自慢できる。' });
registerItem('ktv_tate', { name: '漫才コンテストの優勝盾', price: 0, desc: '関西テレビの若手漫才コンテストで優勝した証。\n金色にピカピカ光っている！' });
registerItem('osaka_tv_senbei', { name: '楽屋のたこせん', price: 0, desc: '楽屋の差し入れのたこせんべい。体力が10回復する。', heal: 10 });

// ================================================================== text signs (baked at 2x)
const baked = new Map();
function fontReady() {
  try { return !document.fonts || document.fonts.check('16px "DotGothic16"'); } catch (e) { return true; }
}
function signCanvas(key, w, h, paint) {
  let cv = baked.get(key);
  if (cv) return cv;
  const [c2, c] = makeCanvas(Math.round(w * 2), Math.round(h * 2));
  paint(c, c2.width, c2.height);
  if (fontReady()) baked.set(key, c2);
  return c2;
}
const bold = (c, s, x, y, o) => { text(c, s, x, y, { ...o, shadow: null }); text(c, s, x + 1, y, { ...o, shadow: null }); };
function sign(x, y, w, h, key, paint, extra = {}) {
  return {
    type: 'prop', x, y, w, h, solid: false, z: -400,
    draw(ctx, sx, sy) { ctx.drawImage(signCanvas(key, w * 16, h * 16, paint), Math.round(sx * 2) / 2, Math.round(sy * 2) / 2, w * 16, h * 16); },
    ...extra,
  };
}
// the big station name board on the lobby wall
function nameBoard(C, x, y, w, h) {
  return sign(x, y, w, h, `${C.pid}_board`, (c, W, H) => {
    R(c, 0, 0, W, H, shade(C.dark, -0.35));
    R(c, 2, 2, W - 4, H - 4, C.main);
    R(c, 2, 2, W - 4, 2, C.light); R(c, 2, H - 6, W - 4, 4, C.dark);
    for (let k = 0; k < 6; k++) R(c, 8 + k * 30, 8, 12, 1, shade(C.main, 0.12));
    if (C.pid === 'mbs') {
      bold(c, 'MBS', W / 2, 6, { size: 32, align: 'center', color: WHT });
      text(c, '毎日放送', W / 2 - 14, 40, { size: 16, align: 'center', color: '#fff6c8', shadow: null });
    } else {
      bold(c, '関西テレビ', W / 2 - 10, 10, { size: 28, align: 'center', color: WHT });
      text(c, '放送', W / 2 + 66, 22, { size: 12, align: 'left', color: '#fff6c8', shadow: null });
    }
    // channel badge
    const bx = C.pid === 'mbs' ? W / 2 + 34 : W - 26, by = C.pid === 'mbs' ? 38 : 40;
    R(c, bx - 1, by - 1, 22, 20, WHT); R(c, bx, by, 20, 18, C.dark);
    text(c, C.ch, bx + 10, by + 1, { size: 16, align: 'center', color: WHT, shadow: null });
  });
}
function plate(C, x, y, label, opts = {}) {
  const w = opts.w || 1.6, h = 0.55;
  return sign(x, y, w, h, `${C.pid}_plate_${label}`, (c, W, H) => {
    R(c, 0, 0, W, H, opts.edge || shade(C.dark, -0.3));
    R(c, 1, 1, W - 2, H - 2, opts.bg || WHT);
    R(c, 1, H - 3, W - 2, 2, opts.bg ? shade(opts.bg, -0.15) : C.pale);
    text(c, label, W / 2, 1, { size: 14, align: 'center', color: opts.color || C.dark, shadow: null });
  });
}
// round "笑" emblem over the variety set
function emblem(C, x, y) {
  return sign(x, y, 2, 2, `${C.pid}_emblem`, (c, W, H) => {
    const cx = W / 2, cy = H / 2;
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      for (let rr = 22; rr < 31; rr++) { const px = Math.round(cx + Math.cos(ang) * rr), py = Math.round(cy + Math.sin(ang) * rr); R(c, px - 1, py - 1, 2, 2, a % 2 ? GOLD : '#fff6a8'); }
    }
    disc(c, cx, cy, 22, '#2a1a3a'); disc(c, cx, cy, 20, '#d62f2f'); disc(c, cx - 3, cy - 4, 12, '#e84a4a');
    bold(c, '笑', cx, cy - 15, { size: 28, align: 'center', color: WHT });
  });
}
function banner(x, y, w, h, key, label, bg, fg) {
  return sign(x, y, w, h, key, (c, W, H) => {
    R(c, 0, 0, W, H, shade(bg, -0.4)); R(c, 2, 2, W - 4, H - 4, bg); R(c, 2, 2, W - 4, 2, shade(bg, 0.3));
    for (let k = 4; k < W - 4; k += 10) { P(c, k, 4, GOLD); P(c, k + 5, H - 5, GOLD); }
    bold(c, label, W / 2, Math.round(H / 2) - 8, { size: 16, align: 'center', color: fg });
  });
}

// ================================================================== people & helpers
const say = (g, who, t) => g.say(t, { name: who.name, look: who.look });
const ask = (g, who, t, ch, extra = {}) => g.ask(t, ch, { name: who.name, look: who.look, ...extra });
const today = (g, k) => g.flag(k) === g.state.day;
const markToday = (g, k) => g.setFlag(k, g.state.day);
const good = (r) => r && (r.rank === 'S' || r.rank === 'A');
const npc = (id, x, y, dir, who, extra = {}) => ({ type: 'npc', id, x, y, dir, look: who.look, name: who.name, ...extra });
// a working / seated NPC turns back to its post after talking
const posted = (dir, fn) => async (g, e) => { await fn(g, e); if (e) e.dir = dir; };
const lines = (who, list) => async (g) => say(g, who, typeof list === 'function' ? list(g) : list);
const signs = (list) => list.map(([x, y, t]) => ({ type: 'sign', x, y, text: t }));
const TIER1 = { anyOf: [{ agency: true }, { fame: 30 }], anyOfText: 'このお仕事は、事務所に所属しているか\n★30以上の人にお願いしているみたいだ。' };

// Audience member sitting in a bench seat, seen from behind; the seat back covers the legs.
function seated(ctx, x, y, g, e) {
  x = Math.round(x); y = Math.round(y);
  const img = charSheetHD(e.look || {}).up[0];
  ctx.drawImage(img, 0, 0, 32, 26, x, y - 3, 16, 13);
  const seat = e.seatTile;
  if (seat) ctx.drawImage(tileImageHD(seat), 0, 12, 32, 20, x, y + 6, 16, 10);
}

// Exit to town. If the town has no door for this building yet, go to the front of なんば駅.
const FALLBACK = { place: 'namba', room: 'main', tx: 22, ty: 30 };
function exitWarp(pid, x, y) {
  const w = { x, y, to: 'exit' };
  w.check = async () => {
    if (doorIndexFor(pid)) { w.to = 'exit'; delete w.place; delete w.room; }
    else Object.assign(w, { to: undefined, ...FALLBACK, dir: 'down' });
    return true;
  };
  return w;
}

let quiet = false; // no room banner while a cutscene reloads a room
const banner2 = (label) => async (g) => { if (!quiet) g.showBanner(label); };
const showState = { mbs: false, ktv: false, manzai: false };

function cast(C) {
  const m = C.main, d = C.dark;
  const mbs = C.pid === 'mbs';
  return {
    uketsuke: { name: '受付さん', look: { ...LOOKS.receptionist, top: m, bottom: '#2a2d36' } },
    annai: { name: '案内係さん', look: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: WHT, bottom: m, tie: m } },
    guard: { name: mbs ? '警備員の淀川さん' : '警備員の天満さん', look: { ...LOOKS.guard, hat: d } },
    loke: { name: mbs ? 'ロケ班ADの走井くん' : 'ロケ班ADの汗川さん', look: { ...LOOKS.ad, top: mbs ? '#ff8a3d' : '#3fae6a', hat: mbs ? undefined : '#2a2d36', hair: mbs ? 'spiky' : 'cap' } },
    obachan: { name: '観覧に来たおばちゃん', look: { ...LOOKS.mom, top: '#c84a8a', hairColor: 'purple' } },
    wakate: { name: mbs ? '若手ピン芸人 こてつ' : '若手コンビの片割れ', look: mbs ? { ...LOOKS.comedian, hair: 'short', hairColor: 'black', top: '#ffd23f', bottom: '#3a4a7a' } : { ...LOOKS.comedian, hair: 'afro', hairColor: 'brown', top: '#5fd7ff', bottom: '#d62f2f' } },
    kid: { name: mbs ? '社会見学の小学生' : 'お笑い好きの女子高生', look: mbs ? { ...LOOKS.kid, top: '#5ee07a' } : { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#2a3560', bottom: '#2a3560', skirt: true, tie: '#d62f2f' } },
    make: { name: 'メイクさん', look: { ...LOOKS.makeup } },
    tired: { name: mbs ? 'お疲れの放送作家' : '出番待ちの芸人さん', look: mbs ? { hair: 'short', hairColor: 'black', skin: 'fair', top: '#6a5a8a', bottom: '#3b3f48', glasses: true } : { ...LOOKS.comedian2, top: '#ff8a3d' } },
    fd: { name: 'フロアディレクター', look: { ...LOOKS.staff, hat: m, top: '#3b3f48' } },
    mc: { name: mbs ? '司会の福丸さん' : '司会のあかね姐さん', look: mbs ? { ...LOOKS.announcerM, hair: 'slick', hairColor: 'black', top: '#f2f2f2', tie: m, jacket: true } : { ...LOOKS.announcer, hair: 'long', hairColor: 'brown', top: '#ff6fae', bottom: '#2a2430' } },
    p1: { name: 'ひな壇芸人 てっちゃん', look: { ...LOOKS.comedian, hair: 'spiky', hairColor: 'orange', top: '#ffd23f' } },
    p2: { name: 'お天気キャスター みぞれさん', look: { ...LOOKS.announcer, hair: 'bob', hairColor: 'black', top: '#9fd0ea', bottom: '#2a3560' } },
    p3: { name: '新人アイドル ぴよ', look: { ...LOOKS.idol, top: '#ffe36e', hairColor: 'brown' } },
    p4: { name: '関西のおかん代表', look: { ...LOOKS.mom, top: '#ff8a3d', hairColor: 'black' } },
    p5: { name: 'ベテラン芸人 どんぐり師匠', look: { ...LOOKS.comedian2, top: '#7a4a9a' } },
    kanran: { name: '観覧係さん', look: { hair: 'bob', hairColor: 'brown', skin: 'fair', top: m, bottom: '#2a2d36', glasses: true } },
    cam: { name: 'カメラマン', look: { ...LOOKS.cameraman, hat: d } },
    aud: { name: 'お客さん', look: LOOKS.fan },
  };
}

// ================================================================== minigame content (all original)
const MAESETSU_SCENES = [
  { prompt: '客席はまだ少しかたい…。まずは第一声！', answers: [{ text: 'みなさん、こんにちはー！', score: 100 }, { text: '…えー、始めます', score: 20 }, { text: '静かにしてください', score: 0 }] },
  { prompt: 'お客さん「どっから来たん？」', answers: [{ text: 'ドット荘から来ました！', score: 100 }, { text: '言われへんとこからです', score: 50 }, { text: 'ないしょです', score: 10 }] },
  { prompt: '拍手の練習の時間。どう盛り上げる？', answers: [{ text: '世界一の拍手、お願いします！', score: 100 }, { text: 'ふつうでいいです', score: 20 }, { text: '（自分だけ拍手）', score: 40 }] },
  { prompt: 'おばちゃん「兄ちゃん（姉ちゃん）、アメちゃんいる？」', answers: [{ text: 'いただきます！もう家族やん！', score: 100 }, { text: '本番前なんで…', score: 20 }, { text: '3つください', score: 60 }] },
  { prompt: 'こども「なんか、おもろいことして！」', answers: [{ text: '全力ズッコケ、いきます！', score: 100 }, { text: 'あとでね〜', score: 20 }, { text: '…できません', score: 0 }] },
  { prompt: '本番まであと1分！最後のひと言！', answers: [{ text: '笑う準備、できてますかー！', score: 100 }, { text: 'では、さようなら', score: 10 }, { text: 'トイレは今のうちに', score: 50 }] },
];
const KANRAN_SCENES = [
  { prompt: '司会「さあ、今日のゲストはこの方！」', answers: [{ text: 'わーっ！（大きな拍手）', score: 100 }, { text: '（小さく拍手）', score: 40 }, { text: '（スマホを見る）', score: 0 }] },
  { prompt: '芸人がボケた。客席の反応は…？', answers: [{ text: 'あはははは！', score: 100 }, { text: '…ふふ', score: 40 }, { text: '（真顔）', score: 0 }] },
  { prompt: '司会「このお値段、なんと…半額！」', answers: [{ text: 'えぇ〜〜っ！', score: 100 }, { text: 'へえ', score: 20 }, { text: '高いなあ', score: 30 }] },
  { prompt: '司会「客席のみなさん、知ってました？」', answers: [{ text: 'しらんかったー！', score: 100 }, { text: '知ってました', score: 30 }, { text: '（無言）', score: 0 }] },
  { prompt: 'しんみりした話。客席は…', answers: [{ text: 'あぁ〜…（うなずく）', score: 100 }, { text: 'あはは！', score: 0 }, { text: '（あくび）', score: 10 }] },
  { prompt: '司会「最後に大きな拍手を！」', answers: [{ text: 'パチパチパチ！（全力）', score: 100 }, { text: 'パチ…', score: 30 }, { text: '（帰りじたく）', score: 0 }] },
];
const LOKE_SCENES = {
  mbs: [
    { prompt: '商店街に到着！まずはお店の人にあいさつ', answers: [{ text: '撮影でおじゃまします！', score: 100 }, { text: '…（無言で入る）', score: 0 }, { text: 'カメラ回ってます', score: 30 }] },
    { prompt: '八百屋さん「映るんやったら、ええ服着てくるわ！」', answers: [{ text: 'そのエプロンが一番です！', score: 100 }, { text: 'はよ着替えてください', score: 20 }, { text: '映らへんかもです', score: 30 }] },
    { prompt: '通行人の会社員が、カメラの前を横切りそう！', answers: [{ text: 'すみません、少しだけ…！', score: 100 }, { text: 'ちょっと！じゃま！', score: 0 }, { text: '（見送る）', score: 40 }] },
    { prompt: 'おばあちゃん「これ、持って帰り」コロッケをくれた', answers: [{ text: 'ありがとうございます！', score: 100 }, { text: 'いりません', score: 0 }, { text: 'みんなで分けます！', score: 80 }] },
    { prompt: '撮影おわり！最後にお店の人へ', answers: [{ text: 'ご協力、ほんまおおきに！', score: 100 }, { text: 'ほな', score: 20 }, { text: 'オンエアお楽しみに！', score: 80 }] },
  ],
  ktv: [
    { prompt: '下町の商店街でロケ！まずは町の人にあいさつ', answers: [{ text: 'おじゃまします！', score: 100 }, { text: '…どうも', score: 30 }, { text: 'どいてくださーい', score: 0 }] },
    { prompt: 'たこ焼き屋の大将「兄ちゃん、焼いてみるか？」', answers: [{ text: 'やらせてください！', score: 100 }, { text: '熱いのはちょっと…', score: 20 }, { text: '見てるだけで', score: 40 }] },
    { prompt: '自転車のおっちゃん「何の撮影なん？」', answers: [{ text: '町のええとこ探しです！', score: 100 }, { text: 'ひみつです', score: 20 }, { text: '知らんのです', score: 10 }] },
    { prompt: 'こどもが、カメラに向かってピースしてる', answers: [{ text: 'いっしょにピース！', score: 100 }, { text: 'あっち行ってな', score: 0 }, { text: '（気づかないふり）', score: 30 }] },
    { prompt: '撮影おわり！片づけのとき', answers: [{ text: 'ゴミも全部持って帰ります！', score: 100 }, { text: 'おつかれっしたー', score: 40 }, { text: '（先に帰る）', score: 0 }] },
  ],
};
const RADIO_SCENES = [
  { prompt: 'パーソナリティ「さあ、今日のお便りコーナーです！」', answers: [{ text: 'たくさん届いてますよ〜！', score: 100 }, { text: 'はい', score: 30 }, { text: '…えっと、紙どこ？', score: 10 }] },
  { prompt: 'お便り「通勤電車で毎朝聞いてます」', answers: [{ text: 'いってらっしゃい！', score: 100 }, { text: 'ありがとうございます', score: 60 }, { text: '寝過ごさんといてね', score: 70 }] },
  { prompt: 'お便り「うちの猫が、ラジオの前から動きません」', answers: [{ text: '猫ちゃんもリスナーや！', score: 100 }, { text: 'こたつ代わりですね', score: 70 }, { text: 'へえ', score: 10 }] },
  { prompt: 'パーソナリティ「{name}さん、最近ハマってるもんは？」', answers: [{ text: '串カツのソース研究です！', score: 100 }, { text: '特にないですね', score: 10 }, { text: '寝ることです', score: 40 }] },
  { prompt: 'お便り「テスト前やのに、ラジオ聞いてしまう」', answers: [{ text: '今日はここまで！勉強してな！', score: 100 }, { text: 'わかるわ〜', score: 50 }, { text: 'ずっと聞いて', score: 20 }] },
  { prompt: 'パーソナリティ「そろそろお時間です！」', answers: [{ text: 'お便り、待ってます！', score: 100 }, { text: 'え、もう？', score: 40 }, { text: '延長しましょう', score: 20 }] },
];
const furi = (boke) => ({ boke, punch: false });
const boke = (b, tsukkomi) => ({ boke: b, punch: true, tsukkomi });
const CONTEST_BITS = [
  [furi('ぼくな、大阪のことやったら何でも知ってるねん'), boke('大阪城は、ぼくのおじいちゃんが建てたんや', 'そんなわけあるかい！')],
  [furi('最近、早起きにハマってんねん'), boke('朝の4時に起きて、4時5分に二度寝や', '起きた意味ないやろ！')],
  [boke('たこ焼き、タコ抜きでって頼んだら、ただの丸い焼きが来たわ', '自分で頼んだんやないか！')],
  [furi('ぼく、電車で席をゆずってん'), boke('ゆずったら、そのまま次の駅で降りてもうた', '降りる駅ちゃうんかい！')],
  [boke('通天閣、ちょっと押したら動くと思うねん', '動くかい！')],
  [furi('この前、エスカレーターの立つ側を間違えてん'), boke('しゃあないから、ずっと逆立ちしとったわ', 'なんでそうなんねん！')],
  [furi('お好み焼き、上手にひっくり返せるようになってん'), boke('勢いあまって、天井に貼りついとる', '回収せえ！')],
];
const PLACE_QUIZ = [
  ['放出', 'はなてん', ['ほうしゅつ', 'はなで']],
  ['十三', 'じゅうそう', ['じゅうさん', 'とみ']],
  ['喜連瓜破', 'きれうりわり', ['きれんかやぶ', 'よろこびうりわ']],
  ['天下茶屋', 'てんがちゃや', ['てんかちゃや', 'あまのちゃや']],
  ['杭全', 'くまた', ['くいぜん', 'こうぜん']],
  ['柴島', 'くにじま', ['しばしま', 'さいじま']],
  ['道修町', 'どしょうまち', ['みちおさまち', 'どうしゅうちょう']],
  ['私市', 'きさいち', ['わたしいち', 'しいち']],
  ['住道', 'すみのどう', ['じゅうどう', 'すみみち']],
  ['枚方', 'ひらかた', ['まいかた', 'まいほう']],
];

function jobsFor(C) {
  const pid = C.pid;
  const W = cast(C);
  return {
    maesetsu: {
      id: `${pid}_maesetsu`, title: '収録前の前説', desc: '本番前の客席を、トークであっためよう！', client: 'フロアディレクター', clientLook: W.fd.look,
      stamina: 15, minigame: 'talk', pay: 1500, fame: 6, skill: 'talk', gain: 1,
      opts: { difficulty: 1, topic: '収録前の前説タイム', scenes: MAESETSU_SCENES },
    },
    kanran: {
      id: `${pid}_kanran`, title: '観覧の盛り上げ役', desc: '観覧席から、収録をいっしょに盛り上げよう！', client: '観覧係さん', clientLook: W.kanran.look,
      stamina: 10, minigame: 'talk', pay: 600, fame: 3, skill: 'warai', gain: 1,
      opts: { difficulty: 1, topic: '観覧席から盛り上げよう！', scenes: KANRAN_SCENES, mc: '司会', mcLook: W.mc.look },
    },
    loke: {
      id: `${pid}_loke`, title: '商店街ロケのお手伝い', desc: 'ロケ先の商店街で、撮影の協力をお願いしよう！', client: W.loke.name, clientLook: W.loke.look,
      stamina: 20, minigame: 'talk', pay: 1200, fame: 4, skill: 'talk', gain: 1,
      opts: { difficulty: 1, topic: '商店街ロケのお手伝い', scenes: LOKE_SCENES[pid] },
    },
  };
}
const RADIO_JOB = {
  id: 'mbs_radio', title: 'ラジオのお便り紹介', desc: 'ラジオの生放送で、リスナーのお便りを読もう！', client: 'ラジオのパーソナリティ',
  stamina: 20, minigame: 'talk', pay: 4000, fame: 15, skill: 'talk', gain: 2, requires: TIER1,
  opts: { difficulty: 2, set: 'radio', topic: 'ラジオの生放送', show: 'お便りコーナー', mc: 'パーソナリティ', scenes: RADIO_SCENES },
};
const CONTEST_JOB = {
  id: 'ktv_manzai', title: '若手漫才コンテストのネタ見せ', desc: '金屏風の前で、審査員に漫才を見てもらおう！', client: '舞台監督',
  stamina: 25, minigame: 'tsukkomi', pay: 4500, fame: 18, skill: 'warai', gain: 2, requires: TIER1,
  opts: { difficulty: 2, dialect: 'kansai' },
};

// ================================================================== LOBBY
function lobbyRoom(C) {
  const pid = C.pid, t = (k) => `${pid}_${k}`;
  const W = cast(C);
  const JOBS = jobsFor(C);
  const mbs = pid === 'mbs';
  const sp = mbs ? 'ラジオブース' : '漫才スタジオ';

  async function uketsukeTalk(g, npc) {
    const st = g.state;
    const hello = st.fame >= 1000 ? `{name}さん、おはようございます！\nいつもテレビで見てますよ〜。`
      : st.fame >= 250 ? `あっ、{name}さん！おはようございます。\n最近、局の中でもよう名前聞きますよ！`
        : `${C.name}へようこそ〜。\n今日はどないしはりました？`;
    const i = await ask(g, npc, hello, ['番組のお仕事', '館内のご案内', 'またにします']);
    if (i === 0) {
      await programDesk(g, pid, npc);
    } else if (i === 1) {
      await say(g, npc, [
        `左の木のドアが楽屋、右の大きいドアがスタジオ、\nいちばん右が${sp}です。`,
        '番組観覧や前説のお手伝いは、スタジオの中で\nスタッフに声かけてくださいね。',
        'ロケのお手伝いやったら、ロビーにおる\nロケ班のADが人を探してましたよ〜。',
      ]);
    } else {
      await say(g, npc, 'ほな、ごゆっくり〜。');
    }
    npc.dir = 'down';
  }

  async function annaiTalk(g, npc) {
    const i = await ask(g, npc, '館内のご案内です。どちらへ？', ['楽屋', 'スタジオ', mbs ? 'ラジオブース' : '漫才スタジオ', 'だいじょうぶ']);
    if (i === 0) await say(g, npc, ['楽屋は左奥の木のドアです。', 'ソファでひと休みしたり、鏡で身だしなみを\n整えたりできますよ。出番前にぜひ。']);
    else if (i === 1) await say(g, npc, ['スタジオは右の大きい両開きのドアです。', '関西のバラエティらしい、にぎやかなセットですよ。\n観覧もできます！']);
    else if (i === 2 && mbs) await say(g, npc, ['ラジオブースは、いちばん右の重たいドアです。', 'ガラスの向こうで生放送してはります。\nお静かにお願いしますね〜。']);
    else if (i === 2) await say(g, npc, ['漫才スタジオは、いちばん右の重たいドアです。', '今日は若手漫才コンテストの収録中！\n金屏風の前で、若手が腕をきそってます。']);
    else await say(g, npc, 'いってらっしゃいませ〜。');
    npc.dir = 'down';
  }

  async function guardTalk(g, npc) {
    if (g.state.fame >= 1000) return say(g, npc, ['おっ、売れっ子さんや！おつかれさんです！', '入り口の前でファンの子が待っとったで。\nあとで手ぇ振ったってや。']);
    return say(g, npc, mbs
      ? ['おつかれさん！入館証、首からさげといてや。', 'ワシはここで三十年、警備しとる。\n売れる子はな、だいたいあいさつがええねん。', '体力切れたら無理せんと、楽屋で休んでいき。']
      : ['おつかれさん！今日はお笑いの収録が多いで。', '若手の子らがな、廊下でずーっとネタ合わせしとる。\nワシ、もうネタ覚えてもうたわ。', 'ほんで、オチ言う前に笑てまうねん。あかんな〜。']);
  }

  async function lokeTalk(g, npc) {
    const i = await ask(g, npc, mbs
      ? ['ロケ班のADです！人手が足りひんくて…！', '商店街ロケのお手伝い、頼めません？']
      : ['ロケ班ADです、汗だくですんません！', '下町ロケのお手伝い、お願いできへん？'], ['手伝う', 'ロケのこと', 'またにします']);
    if (i === 0) {
      const r = await g.job(JOBS.loke);
      if (r) await say(g, npc, good(r) ? 'おおきに！町の人もめっちゃ協力してくれはったわ！' : 'おおきに！ロケは段取りが命やで。また頼むわ！');
    } else if (i === 1) {
      await say(g, npc, ['ロケはな、町の人のご協力でなりたってるんよ。', 'あいさつ、お礼、ゴミの持ち帰り。\nこれだけ守ったら、だいたい好かれるで。']);
    } else {
      await say(g, npc, 'ほな、また見かけたら声かけてな！');
    }
    npc.dir = 'left';
  }

  async function obachanTalk(g, npc) {
    if (!g.flag(`${pid}_ame`)) {
      g.setFlag(`${pid}_ame`);
      await say(g, npc, ['あら、あんたも観覧？ちゃうの？芸能人さん？', 'ほなこれ、アメちゃんあげるわ。のど大事にしいや！']);
      g.giveItem('nodoame');
      g.sfx('coin');
      await g.say('のどあめをもらった！');
      return;
    }
    if (g.state.fame >= 500) return say(g, npc, ['いや〜！あんた、テレビで見たで！', 'うちの近所のみんなに言いふらしとくわな！']);
    return say(g, npc, mbs
      ? ['観覧、ハガキ出して当たってん！', '生で見る芸人さんは、声の大きさがちゃうなあ。\nテレビの倍はうるさいで！（ほめてる）']
      : ['うちな、ここの観覧、もう十回目やねん。', '漫才はな、生で見るのがいちばんや。\n息づかいまで聞こえてくるんやで。']);
  }

  async function wakateTalk(g, npc) {
    if (g.state.fame >= 1000) return say(g, npc, ['うわっ、本物の{name}さんや…！', 'ぼくもいつか、ロビーで「本物や」って\n言われる芸人になります！']);
    return say(g, npc, mbs
      ? ['どうも、ピン芸人のこてつです。前説の出番待ちです。', '前説はな、お客さんの肩の力をぬいてもらう仕事や。\nスベっても、拍手だけはもらえるんよ。', 'それが、ちょっとだけさみしいねん…。']
      : ['相方がトイレから帰ってけえへんねん…。', '本番前にな、緊張でトイレ行く回数が\nどんどん増えていくタイプやねん。', 'ほんで、ぼくもそろそろ行きたなってきた。']);
  }

  async function kidTalk(g, npc) {
    if (mbs) return say(g, npc, ['社会見学で来てん！テレビ局って、広いなあ！', 'さっきな、ラジオのガラスの部屋のぞいたら\nおねえさんが手ぇ振ってくれてん！']);
    return say(g, npc, ['うち、将来漫才師になりたいねん。', '相方はまだおらんけど…\nツッコミの練習だけは毎日しとる！なんでやねん！']);
  }

  const screens = async (g) => g.say(mbs
    ? ['オンエア中のモニターだ。', '大阪城、天気予報、バラエティ…\n関西のいろんな景色がかわるがわる映っている。']
    : ['オンエア中のモニターだ。', '大阪の空、天気予報、お笑いのスタジオ…\n見ているだけで、ちょっと笑ってしまう。']);

  return {
    floor: t('floor'),
    bgm: 'osaka',
    topPad: 18,
    tiles: [
      '####################',
      '#UAUUUUUUUUUUUUSTUR#',
      mbs ? '#=a=mm=======mmst=r#' : '#=a=mm=======llst=r#',
      '#P...............P.#',
      '#......KKKKKK......#',
      '#........[]........#',
      '#.FFF....[]....HHH.#',
      '#.nnn....[]........#',
      '#.fff....[].......V#',
      '#........[]........#',
      '#P.......[]....Y..P#',
      '#........[]........#',
      '#########MM#########',
    ],
    legend: {
      '#': t('walltop'), U: t('wall_u'), '=': t('wall_lo'),
      A: t('door_u'), a: t('door'), S: t('sdoor_ul'), T: t('sdoor_ur'), s: t('sdoor_l'), t: t('sdoor_r'), R: t('mdoor_u'), r: t('mdoor'),
      m: `${t('wall_lo')}+${t('mon')}`, l: `${t('wall_lo')}+lantern`,
      K: t('counter'), '[': t('run_l'), ']': t('run_r'), M: t('mat'),
      F: t('sofa'), f: t('sofa_up'), n: 'table_low', H: t('photo'), V: 'vending', Y: 'flower_stand', P: 'plant',
    },
    warps: [
      exitWarp(pid, 9, 12), exitWarp(pid, 10, 12),
      { x: 2, y: 2, room: 'gakuya', tx: 6, ty: 7, dir: 'up' },
      { x: 15, y: 2, room: 'studio', tx: 9, ty: 12, dir: 'up' },
      { x: 16, y: 2, room: 'studio', tx: 10, ty: 12, dir: 'up' },
      { x: 18, y: 2, room: C.special, tx: mbs ? 7 : 9, ty: mbs ? 9 : 12, dir: 'up' },
    ],
    entities: [
      nameBoard(C, 7, 0.75, 6, 1.95),
      plate(C, 1.7, 1.05, '楽屋'),
      plate(C, 15.0, 1.05, 'スタジオ', { w: 2.0 }),
      plate(C, 17.75, 1.05, mbs ? 'ラジオ' : '漫才', { w: 1.5, bg: mbs ? '#2a2d36' : '#8e1420', color: WHT, edge: '#101014' }),
      npc(`${pid}_uketsuke`, 9, 3, 'down', W.uketsuke, { talk: uketsukeTalk }),
      npc(`${pid}_annai`, 10, 3, 'down', W.annai, { talk: annaiTalk }),
      npc(`${pid}_guard`, 12, 11, 'left', W.guard, { talk: posted('left', guardTalk) }),
      npc(`${pid}_loke`, 13, 8, 'left', W.loke, { talk: lokeTalk }),
      npc(`${pid}_obachan`, 4, 9, 'up', W.obachan, { talk: posted('up', obachanTalk) }),
      npc(`${pid}_wakate`, 6, 7, 'left', W.wakate, { talk: posted('left', wakateTalk) }),
      npc(`${pid}_kid`, 16, 7, 'up', W.kid, { talk: posted('up', kidTalk) }),
      ...signs([
        [15, 6, '大阪城の写真パネルだ。\n青空に、石垣とお城がくっきり映えている。'],
        [16, 6, 'レトロな展望タワーと、下町の写真パネルだ。\n夕焼けの色が、なんだかなつかしい。'],
        [17, 6, '夜の川と、きらきらのネオンの写真パネルだ。\n「食い倒れの街・大阪」と書いてある。'],
        [15, 10, `お祝いのスタンド花だ。\n「祝 ${mbs ? '新番組スタート' : '漫才コンテスト収録'}」の札がささっている。`],
      ]),
    ],
    events: [
      { x: 4, y: 2, w: 2, on: 'action', run: screens },
      { x: 13, y: 2, w: 2, on: 'action', run: mbs ? screens : async (g) => g.say('赤いちょうちんだ。\n「笑」の一文字が、でかでかと書いてある。') },
      { x: 7, y: 2, w: 2, on: 'action', run: async (g) => g.say(mbs ? `「MBS 毎日放送」の大きな看板だ。\nチャンネルは${C.ch}。テレビとラジオ、両方の放送局らしい。` : `「関西テレビ」の大きな看板だ。\nチャンネルは${C.ch}。地元では「カンテレ」と呼ばれて親しまれている。`) },
      { x: 2, y: 6, w: 3, on: 'action', run: async (g) => g.say('待合のソファだ。\n出演者や観覧のお客さんが、ここで呼ばれるのを待つ。') },
      { x: 2, y: 8, w: 3, on: 'action', run: async (g) => g.say('ソファのせもたれに、番組のステッカーが\nこっそり貼ってある。') },
      { x: 2, y: 7, w: 3, on: 'action', run: async (g) => g.say(mbs ? 'テーブルの上に、番組表のパンフレットが置いてある。\nテレビもラジオも、毎日いっぱいだ。' : 'テーブルの上に、お笑いライブのチラシが置いてある。\n若手の名前がずらりと並んでいる。') },
      {
        x: 18, y: 8, on: 'action',
        run: async (g) => { await g.shop(['drink', 'onigiri', 'takoyaki', 'wadai'], { title: '局の自販機', greeting: 'ピッ。（局の中にしては、ちょっと品ぞろえが大阪っぽい）' }); },
      },
    ],
    onEnter: async (g) => {
      if (g.flag(`${pid}_welcome`)) return;
      g.setFlag(`${pid}_welcome`);
      await g.wait(200);
      await g.emote(`${pid}_uketsuke`, '!');
      await say(g, W.uketsuke, mbs
        ? ['いらっしゃいませ！MBS毎日放送へようこそ〜。', 'テレビもラジオもやってる局やから、\n中はちょっとした迷路ですよ。', '番組のお仕事のご相談は、受付でどうぞ！']
        : ['いらっしゃいませ！関西テレビへようこそ〜。', '地元では「カンテレ」って呼ばれてますねん。\n今日はお笑いの収録が多い日ですよ。', '番組のお仕事のご相談は、受付でどうぞ！']);
    },
  };
}

// ================================================================== GAKUYA (dressing room)
function gakuyaRoom(C) {
  const pid = C.pid, t = (k) => `${pid}_${k}`;
  const W = cast(C);
  const mbs = pid === 'mbs';

  async function rest(g) {
    if (today(g, `${pid}_rest_day`)) { await g.say('ソファはふかふかだけど、今日はもう十分休んだ。\nまた明日にしよう。'); return; }
    const i = await g.ask('ふかふかのソファだ。ちょっとひと休みする？\n（1日1回）', ['ひと休みする', 'やめておく']);
    if (i !== 0) return;
    markToday(g, `${pid}_rest_day`);
    await g.fadeOut(12);
    g.sfx('sleep');
    await g.wait(500);
    g.relax({ stress: 10, stamina: 15 });
    await g.fadeIn(12);
    g.sfx('good');
    await g.say('楽屋のソファで、目をつぶって深呼吸した。\n体力が15回復して、ストレスが10へった。');
  }

  async function mirror(g) {
    if (today(g, `${pid}_mirror_day`)) { await g.say('鏡の中の自分と目が合った。\n今日はもう、ばっちり整えてある。'); return; }
    if (g.need('clean') >= 98) { await g.say('鏡の中の自分は、もうピカピカだ。\nこのまま本番に出られそう！'); return; }
    const i = await g.ask('電球に囲まれた楽屋の鏡だ。\n身だしなみを整える？（1日1回）', ['整える', 'やめておく']);
    if (i !== 0) return;
    markToday(g, `${pid}_mirror_day`);
    g.sfx('shutter');
    const d = g.bathe(25);
    await g.say(`髪をとかして、えりを直して、にっこり笑顔の練習！\n身だしなみが${Math.round(d)}上がった。`);
  }

  async function snack(g) {
    if (today(g, `${pid}_snack_day`)) { await g.say('差し入れのお菓子は、もう他の出演者さんの分だ。\nまた明日のお楽しみ。'); return; }
    markToday(g, `${pid}_snack_day`);
    g.giveItem('osaka_tv_senbei');
    g.sfx('coin');
    await g.say(['テーブルに差し入れのたこせんべいが山盛りだ。', '「ご自由にどうぞ」と書いてある。\n楽屋のたこせんを1枚もらった！（1日1回）']);
  }

  async function makeTalk(g, npc) {
    const c = g.need('clean');
    const tip = c < 30 ? 'ちょっと、髪ボッサボサやん！\n鏡の前で整えていき。それかお風呂入っておいで。'
      : c < 70 ? 'うーん、もうちょい整えたら、もっと映えるで。\n鏡の前、空いてるから使い。'
        : 'ええ感じやん！今日はライトにばっちり映えるわ。';
    await say(g, npc, ['メイクさんです〜。本番前の最終チェックしたげよか？', tip]);
    if (!g.flag(`${pid}_make_tip`)) {
      g.setFlag(`${pid}_make_tip`);
      await say(g, npc, '身だしなみが乱れてるとな、お仕事の評判も\nちょっと下がってまうねん。気ぃつけや〜。');
    }
  }

  async function tiredTalk(g, npc) {
    if (mbs) return say(g, npc, ['ふぁ〜…。放送作家です。台本、ゆうべ徹夜で書いてん。', 'おもろいセリフはな、だいたい夜中の3時に\n思いつくんや。そして朝見たら、おもんないんや。', '…せやから楽屋で寝かして。ソファ、半分あげるわ。']);
    return say(g, npc, ['出番待ちの芸人です。本番まで、あと2時間…。', '待ち時間はな、こうやってネタ帳見返すか、\nお弁当のおかずの順番を考えるかやねん。', '今日は、からあげを最後に残すと決めた！']);
  }

  return {
    floor: 'floor_carpet_beige',
    bgm: 'office',
    tiles: [
      '##############',
      '#=MMMM=pc====#',
      '#.VVVV....LLR#',
      '#............#',
      '#.KKKK..SSS..#',
      '#.KTTK..nnn..#',
      '#.KKKK.......#',
      '#P..........P#',
      '######OO######',
    ],
    legend: {
      '#': t('walltop'), '=': t('wall'), M: `${t('wall')}+mirror`, c: `${t('wall')}+clock`, p: `${t('wall')}+poster`,
      V: 'makeup', L: 'locker', R: 'clothes_rack', K: 'floor_tatami', T: 'floor_tatami+table_low',
      S: t('sofa'), n: 'table_low', P: 'plant', O: t('mat'),
    },
    warps: [
      { x: 6, y: 8, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
      { x: 7, y: 8, room: 'lobby', tx: 2, ty: 3, dir: 'down' },
    ],
    entities: [
      npc(`${pid}_make`, 6, 2, 'left', W.make, { talk: posted('left', makeTalk) }),
      npc(`${pid}_tired`, 2, 4, 'down', W.tired, { talk: posted('down', tiredTalk) }),
      ...signs([
        [10, 2, '出演者用のロッカーだ。\n「貴重品は自分で管理してね」と貼り紙がある。'],
        [11, 2, 'ロッカーの扉に、誰かのお守りがぶらさがっている。'],
        [12, 2, '衣装がずらりとかかっている。\nキラキラのジャケットに、なぜか着ぐるみも…。'],
      ]),
    ],
    events: [
      { x: 2, y: 2, w: 4, on: 'action', run: mirror },
      { x: 8, y: 4, w: 3, on: 'action', run: rest },
      { x: 8, y: 5, w: 3, on: 'action', run: snack },
      { x: 3, y: 5, w: 2, on: 'action', run: async (g) => g.say('ちゃぶ台に、湯のみと急須が置いてある。\n畳の上は、なんだか実家みたいで落ちつく。') },
      { x: 8, y: 1, on: 'action', run: async (g) => g.say('楽屋の時計だ。\n本番の時間が近づくと、みんなちらちら見ている。') },
      { x: 7, y: 1, on: 'action', run: async (g) => g.say(mbs ? '「笑顔でいこう！」と書かれたポスターだ。\nスタッフさんの手書きらしい。' : '「楽屋あいさつは元気よく！」と書かれたポスターだ。\n大きな字で、ちょっと迫力がある。') },
    ],
    onEnter: banner2(`${C.short}　楽屋`),
  };
}

// ================================================================== STUDIO (Kansai variety set)
const SHOW_BITS = {
  mbs: [
    ['mc', 'さあ始まりました！今日もスタジオは満員御礼や！'],
    ['p1', 'ぼく、きのう道でサイフ拾いましてん。'],
    ['mc', 'えらいやん！ちゃんと交番に届けたん？'],
    ['p1', '…中身、ぼくのレシートだけでしたわ。'],
    ['mc', '自分のサイフやないかい！', true],
    ['p3', 'わたし、大阪に来てから毎日アメちゃんもらうんです！'],
    ['p4', 'そらそうよ。おかんのカバンには、常に3袋入っとるで！'],
    ['mc', 'どんだけ配る気やねん！', true],
    ['mc', 'ほな今日はこのへんで！また来週〜！'],
  ],
  ktv: [
    ['mc', 'はーい、始まったで〜！客席のみんな、元気〜？'],
    ['p1', 'ぼく、ダイエットで毎日10キロ走ってますねん。'],
    ['mc', 'すごいやん！見直したわ。'],
    ['p1', '…自転車で。'],
    ['mc', 'それ、こいでるだけやん！', true],
    ['p2', '明日のお天気は、晴れ、ときどき…たこ焼き！'],
    ['mc', '降ってきたら熱いわ！', true],
    ['p5', 'わしの若いころはなあ…'],
    ['mc', '師匠、その話、今日3回目です！', true],
    ['mc', 'ほな、また来週も見てや〜！'],
  ],
};
const STUDIO_AUD = [
  // [id, x, y, look, name, line, alwaysVisible]
  ['a1', 4, 10, { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' }, 'お客さん', '今日のゲスト、だれやろ？楽しみやわ〜。', true],
  ['a2', 7, 10, LOOKS.salaryman, 'お客さん', '仕事、半休とって来てん。笑いにきたで！', true],
  ['a3', 12, 10, LOOKS.oldwoman, 'おばあちゃん', 'わたしはな、司会の人のファンなんよ。\n生で見ると、テレビよりずっと若う見えるわ〜。', true],
  ['a4', 16, 11, LOOKS.kid, 'こども', 'カメラの赤いランプがついてたら、\n映ってるんやって！', true],
  ['a5', 5, 11, LOOKS.mom, 'お客さん', 'わくわく…！', false],
  ['a6', 13, 11, LOOKS.tourist, 'お客さん', '大阪のテレビ、ノリがすごい！', false],
  ['a7', 15, 10, { ...LOOKS.fan, hairColor: 'black', top: '#ffd23f' }, 'お客さん', 'がんばれ〜！', false],
  ['a8', 8, 11, LOOKS.oldman, 'おじいちゃん', 'ほっほっほ。', false],
];

function studioRoom(C) {
  const pid = C.pid, t = (k) => `${pid}_${k}`;
  const W = cast(C);
  const JOBS = jobsFor(C);
  const mbs = pid === 'mbs';
  const id = (k) => `${pid}_${k}`;
  const seatTile = t('seat');
  // the KTV set is laid out mirrored (ひな壇 on the left, guest sofa on the right)
  const X = mbs ? { mc: 8, p: [12, 14, 16], guest: 3, hina: 12 } : { mc: 11, p: [3, 5, 7], guest: 14, hina: 3 };

  async function watch(g) {
    const p = g.map.player;
    const home = { x: p.x, y: p.y, dir: p.dir };
    await g.fadeOut();
    showState[pid] = true;
    quiet = true;
    await g.goto(pid, 'studio', 9, 12, 'up', { fade: false });
    quiet = false;
    g.map.camOverride = { x: 0, y: 6 };
    await g.fadeIn();
    g.sfx('applause');
    for (const [who, line, punch] of SHOW_BITS[pid]) {
      if (punch) { g.sfx('hit'); g.shake(5, 1); }
      await say(g, W[who], line);
      if (punch) {
        g.sfx('laugh');
        await Promise.all(STUDIO_AUD.map(([k]) => g.emote(id(k), 'w', 40)));
      }
    }
    g.sfx('applause');
    await Promise.all(STUDIO_AUD.map(([k]) => g.emote(id(k), '♥', 45)));
    await g.fadeOut();
    showState[pid] = false;
    g.map.camOverride = null;
    quiet = true;
    await g.goto(pid, 'studio', home.x, home.y, home.dir, { fade: false });
    quiet = false;
    await g.fadeIn();
    g.relax({ stress: 8 });
    g.addSkill('warai', 1, true);
    g.sfx('good');
    await g.say(`生の収録は迫力がちがう！いっぱい笑った。\nストレスが8へって、お笑いが1上がった。（${g.state.skills.warai}）`);
  }

  async function kanranTalk(g, npc) {
    const i = await ask(g, npc, ['観覧係です！今日も収録、ありますよ〜。', '客席から見ていきます？\n盛り上げ役のお手伝いも募集してます！'], ['番組を観覧する', '盛り上げ役のお仕事', 'またにします']);
    if (i === 0) {
      if (today(g, `${pid}_watch_day`)) { await say(g, npc, '今日の収録はもう終わりましたわ。\nまた明日、見に来てくださいね〜！'); return; }
      markToday(g, `${pid}_watch_day`);
      await say(g, npc, ['ほな、空いてる席へどうぞ！', '笑うとこは思いっきり笑てくださいね。\nほな、本番いきまーす！']);
      await watch(g);
    } else if (i === 1) {
      const r = await g.job(JOBS.kanran);
      if (r) await say(g, npc, good(r) ? 'さいこうの客席やった！司会の人も「今日の客、ええなあ」って！' : 'おおきに！リアクションは大きめでええんよ〜。');
    } else {
      await say(g, npc, 'ほな、またどうぞ〜。');
    }
    npc.dir = 'right';
  }

  async function fdTalk(g, npc) {
    const i = await ask(g, npc, mbs
      ? ['フロアディレクターや！本番前の前説、だれかおらんかな〜。', '…あ、キミ、しゃべれる？']
      : ['FDです！前説の子が来えへんねん…！', 'キミ、ちょっと客席あっためてくれへん？'], ['前説をやる', 'スタジオのこと', 'またにします']);
    if (i === 0) {
      const r = await g.job(JOBS.maesetsu);
      if (r) await say(g, npc, good(r) ? '客席、ぽっかぽかや！本番もこの空気でいけるわ。おおきに！' : 'おおきに！前説は場数や。またおいで！');
    } else if (i === 1) {
      await say(g, npc, [
        '奥がセット。右のひな壇に芸人さんやタレントさんが座って、\n真ん中の台で司会がしきるんや。',
        '関西のバラエティはな、とにかくテンポと声の大きさや。\n間があいたら、だれかがすぐボケる！',
        '観覧したいんやったら、客席のとこの観覧係に言うてな。',
      ]);
    } else {
      await say(g, npc, 'ほな、またな！本番中はお静かに頼むで〜。');
    }
    npc.dir = 'left';
  }

  const mcLines = mbs
    ? (g) => (g.state.fame >= 1000 ? ['おっ、{name}やないか！今度ひな壇に座ってや！', '関西のお客さんは正直やで。おもろかったら笑うし、\nおもんなかったら…顔に出る！'] : ['司会の福丸です。台本チェック中や。', 'ええか、関西のバラエティは「ツッコミ」が主役や。\nボケは拾ってナンボやで。', '前説がうまい子は、だいたい売れる。ほんまやで。'])
    : (g) => (g.state.fame >= 1000 ? ['あら〜！{name}ちゃんやん！売れっ子さんや！', 'うちの番組にもまた来てな。\n楽屋のたこせん、ぎょうさん用意しとくわ！'] : ['司会のあかねです〜。本番前は、のどのストレッチ！', 'しゃべりはな、相手の目ぇ見て、\n最後まで聞いてから返すんよ。', 'あとはな、笑顔！ほな、あ・え・い・う・え・お・あ・お！']);

  return {
    floor: t('sfloor'),
    bgm: 'studio',
    topPad: 34,
    tiles: [
      '####################',
      '#AAAAAAAAAAAAAAAAAA#',
      '#aaaaaaaaaaaaaaaaaa#',
      mbs ? '#L,ggg,,,,,,HHHHH,L#' : '#L,HHHHH,,,,,,ggg,L#',
      mbs ? '#.,,,,,,D,,,hhhhh,.#' : '#.,hhhhh,,,D,,,,,,.#',
      '#.,,,,,,,,,,,,,,,,.#',
      '#.eeeeeeeeeeeeeeee.#',
      '#..................#',
      '#...K.....K....K...#',
      '#..................#',
      '#..ssssss..ssssss..#',
      '#..ssssss..ssssss..#',
      '#..................#',
      '#########OO#########',
    ],
    legend: {
      '#': t('walltop'), A: t('set_u'), a: t('set'), ',': t('setfloor'),
      L: `${t('setfloor')}+spotlight`, g: `${t('setfloor')}+${t('sofa')}`,
      H: `${t('setfloor')}+${t('hina_u')}`, h: `${t('setfloor')}+${t('hina')}`, D: `${t('setfloor')}+${t('podium')}`,
      e: t('setedge'), K: `${t('sfloor')}+camera`, s: `${t('sfloor')}+${seatTile}`, O: t('mat'),
    },
    warps: [
      { x: 9, y: 13, room: 'lobby', tx: 15, ty: 3, dir: 'down' },
      { x: 10, y: 13, room: 'lobby', tx: 16, ty: 3, dir: 'down' },
    ],
    entities: [
      emblem(C, 9, 0.35),
      sign(1.8, 1.4, 6.2, 0.9, `${pid}_studio_banner`, (c, Wd, Hd) => {
        R(c, 0, 0, Wd, Hd, '#2a1a3a'); R(c, 2, 2, Wd - 4, Hd - 4, '#d62f2f'); R(c, 2, 2, Wd - 4, 2, '#ff6a6a');
        bold(c, mbs ? 'わいわい！関西ノリ全開！' : 'まいど！笑いの本場から！', Wd / 2, 7, { size: 14, align: 'center', color: '#fff6a8' });
      }),
      // regular cast & crew
      npc(id('mc'), X.mc, 3, 'down', W.mc, { talk: posted('down', lines(W.mc, mcLines)) }),
      npc(id('p1'), X.p[0], 4, 'down', W.p1, {
        talk: posted('down', lines(W.p1, mbs
          ? ['ひな壇芸人のてっちゃんです！', 'ひな壇はな、前に出るタイミングが勝負や。\n出遅れたら、ずっとうなずき係やで。']
          : ['てっちゃんや！ひな壇はな、座り方にもコツがあるねん。', '浅めに座っとくと、すぐ立ち上がってツッコめる。\nこれ、ほんまに大事やで。'])),
      }),
      npc(id('p2'), X.p[1], 4, 'down', W.p2, {
        talk: posted('down', lines(W.p2, ['お天気キャスターのみぞれです。', '関西の天気はな、山と海でけっこう変わるんよ。\n朝は傘、持っていき〜。'])),
      }),
      npc(id('p3'), X.p[2], 4, 'down', W.p3, {
        talk: posted('down', lines(W.p3, ['新人アイドルのぴよです！関西弁、勉強中です！', '「なんでやねん」の言い方、むずかしい〜。\nちょっと聞いてもらえます？…なんでやねん！'])),
      }),
      npc(id('p4'), X.p[0] + 1, 3, 'down', W.p4, { cond: () => showState[pid], text: 'アメちゃん、いる？' }),
      npc(id('p5'), X.p[1] + 1, 3, 'down', W.p5, { cond: () => showState[pid], text: 'わしの若いころはなあ…' }),
      npc(id('fd'), 17, 5, 'left', W.fd, { talk: fdTalk, cond: () => !showState[pid] }),
      npc(id('fd2'), 17, 7, 'up', W.fd, { cond: () => showState[pid], text: '本番中や…！（カンペを出している）' }),
      npc(id('cam'), 10, 9, 'up', W.cam, {
        talk: posted('up', lines(W.cam, ['カメラマンです。', '関西のバラエティはな、ボケた人とツッコんだ人を\n両方すばやく映さなあかん。首がもげそうや。'])),
      }),
      npc(id('kanran'), 2, 12, 'right', W.kanran, { talk: kanranTalk, cond: () => !showState[pid] }),
      ...STUDIO_AUD.map(([k, x, y, look, name, line, always]) => npc(id(k), x, y, 'up', { name, look }, {
        sprite: seated, seatTile, fixedDir: true,
        cond: always ? undefined : () => showState[pid],
        talk: async (g, e) => { await say(g, { name, look }, line); e.dir = 'up'; },
      })),
    ],
    events: [
      { x: 9, y: 2, w: 2, on: 'action', run: async (g) => g.say('セットの真ん中に、大きな「笑」のマークがかがやいている。\nまわりの電球がチカチカして、にぎやかだ！') },
      { x: X.guest, y: 3, w: 3, on: 'action', run: async (g) => g.say('ゲスト用のソファだ。\n座ったら最後、司会にいじられる席らしい。') },
      { x: X.hina, y: 3, w: 5, on: 'action', cond: () => !showState[pid], run: async (g) => g.say('ひな壇だ。上の段ほど、ベテランが座るらしい。\nいつか自分も、ここに座ってみたい…！') },
      { x: 4, y: 8, on: 'action', run: async (g) => g.say('大きなスタジオカメラだ。\nファインダーに、ひな壇が映っている。') },
      { x: 10, y: 8, on: 'action', run: async (g) => g.say('センターのカメラだ。\n司会の台を正面からねらっている。') },
      { x: 15, y: 8, on: 'action', run: async (g) => g.say('スタジオカメラだ。\n客席のリアクションを映す係らしい。') },
      { x: 1, y: 3, on: 'action', run: async (g) => g.say('照明スタンドだ。まぶしい！') },
      { x: 18, y: 3, on: 'action', run: async (g) => g.say('照明スタンドだ。セットの電球と合わせて、\nスタジオ全体がキラキラしている。') },
    ],
    drawOver(ctx, g, cam) {
      if (!showState[pid]) return;
      ctx.fillStyle = 'rgba(255,248,220,0.09)';
      for (const cx of [4, 10, 15]) {
        const x0 = cx * 16 - cam.x, y0 = 32 - cam.y;
        ctx.beginPath();
        ctx.moveTo(x0 - 6, y0); ctx.lineTo(x0 + 6, y0); ctx.lineTo(x0 + 30, y0 + 64); ctx.lineTo(x0 - 30, y0 + 64);
        ctx.closePath(); ctx.fill();
      }
    },
    onEnter: async (g) => {
      if (quiet) return;
      g.showBanner(`${C.short}　スタジオ`);
      if (g.flag(`${pid}_studio_first`)) return;
      g.setFlag(`${pid}_studio_first`);
      await g.wait(200);
      await g.emote(id('fd'), '!');
      await say(g, W.fd, [
        'おっ、見学の人？ここがメインスタジオや！',
        '奥がセットとひな壇、手前がカメラ、うしろが観覧席。\n前説のお手伝いやったら、ワシに声かけてな！',
      ]);
    },
  };
}

// ================================================================== MBS: RADIO BOOTH
const DJ = { name: 'パーソナリティの波野さん', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#ff8a3d', bottom: '#2a3560', glasses: true } };
const MIXER = { name: 'ミキサーの耳原さん', look: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#3b3f48', bottom: '#2a2d36' } };
const WRITER = { name: '放送作家の筆坂さん', look: { hair: 'cap', hat: ST.mbs.main, hairColor: 'black', skin: 'fair', top: '#f2f2f2', bottom: '#5a4a3a', glasses: true } };
const POSTCARDS = [
  'ラジオネーム「たこ焼きは主食」さん。\n「家族でお好み焼きを焼いたら、父だけ\nひっくり返すのに失敗して、天井に貼りつきました」',
  'ラジオネーム「淀川のカモ」さん。\n「通学の自転車で、毎朝この番組を聞いてます。\nたまに笑いすぎて、ふらふらします」',
  'ラジオネーム「ねこ店長」さん。\n「うちの猫は、ジングルが鳴ると\nラジオの前に座ります。たぶんファンです」',
  'ラジオネーム「串カツ二度づけ禁止」さん。\n「今日、会社でくしゃみしたら、\n部長に『おおきに』と言われました」',
];

function radioRoom() {
  const C = ST.mbs;
  async function djTalk(g, npc) {
    const i = await ask(g, npc, ['はーい、パーソナリティの波野です！今は曲の間やから、\nちょっとだけしゃべれるで。', 'なにか用？'], ['お便り紹介の仕事', '難読地名クイズ', 'ラジオのこと', 'またにします']);
    if (i === 0) {
      const r = await g.job({ ...RADIO_JOB, opts: { ...RADIO_JOB.opts, mcLook: DJ.look } });
      if (!r) return;
      if (good(r)) {
        await say(g, npc, 'さいこうやった！リスナーさんから\n「今の人だれ？」ってメールいっぱい来てるで！');
        if (!g.flag('mbs_sticker')) {
          g.setFlag('mbs_sticker');
          g.giveItem('mbs_sticker');
          g.sfx('coin');
          await say(g, npc, 'これ、記念にあげるわ。番組のステッカーや！');
        }
      } else {
        await say(g, npc, 'おつかれさん！ラジオは声だけやから、\n笑顔も声に乗せるんやで。');
      }
    } else if (i === 1) {
      await placeQuiz(g, npc);
    } else if (i === 2) {
      await say(g, npc, [
        'ラジオはな、テレビとちがって顔が見えへん。\nそのぶん、リスナーさんとの距離がめっちゃ近いんよ。',
        'お便りひとつで、知らん町の知らん人と\n友だちみたいになれる。ええやろ？',
        'お便り紹介のお仕事は、事務所に所属してるか\n★30くらいの人にお願いしてるわ。',
      ]);
    } else {
      await say(g, npc, 'ほな、曲あけるで〜。お静かに〜！');
    }
    npc.dir = 'down';
  }

  async function placeQuiz(g, npc) {
    if (today(g, 'mbs_quiz_day')) { await say(g, npc, '難読地名クイズは1日1回！また明日な〜。'); return; }
    markToday(g, 'mbs_quiz_day');
    await say(g, npc, ['ほな、大阪の難読地名クイズ！全部で3問や。', '大阪にはな、読まれへん地名がぎょうさんあるんよ。']);
    let ok = 0;
    for (const [word, reading, wrong] of shuffle(PLACE_QUIZ.slice()).slice(0, 3)) {
      const choices = shuffle([reading, ...wrong]);
      const k = await ask(g, npc, `「${word}」、なんて読む？`, choices);
      if (choices[k] === reading) { ok++; g.sfx('chime'); await say(g, npc, `ピンポーン！「${reading}」や！`); } else { g.sfx('buzz'); await say(g, npc, `ブッブー！正解は「${reading}」でした〜。`); }
    }
    if (ok >= 2) {
      g.addSkill('talk', 1, true);
      g.relax({ stress: 3 });
      g.sfx('good');
      await say(g, npc, `${ok}問正解！ようできました！`);
      await g.say(`地名の読みは、しゃべりの仕事の基本だ！\nトークが1上がった。（${g.state.skills.talk}）`);
    } else {
      await say(g, npc, `${ok}問正解か〜。大阪の地名、むずかしいやろ？\nまた明日、リベンジしにおいで！`);
    }
  }

  async function mixerTalk(g, npc) {
    return say(g, npc, [
      'ミキサーの耳原や。声と音楽の音量を、ここで合わせてる。',
      '笑い声は大きめ、ため息は小さめ。\nええ番組はな、聞こえ方まで気ぃつかってるんやで。',
      'ほら、メーターが動いてるやろ？\n波野さんがしゃべると、ぐいーんって上がるねん。',
    ]);
  }

  async function writerTalk(g, npc) {
    return say(g, npc, [
      '放送作家の筆坂です。番組の台本と、コーナーの企画を考えてます。',
      'ハガキはな、ぜんぶ読んでるで。\nおもろいのは、手が震えるくらいおもろい。',
      'そこの箱に、リスナーさんのハガキが入ってる。\n読んでみてもええよ。',
    ]);
  }

  return {
    floor: 'mbs_carpet',
    bgm: 'studio',
    tiles: [
      '################',
      '#UUUUUUUUUUUUUU#',
      '#=QQ===o====QQ=#',
      '#..............#',
      '#....DDDD......#',
      '#..............#',
      '#GGGGGGGGGGdGGG#',
      '#,,,,,,,,,,,,,,#',
      '#,XXXXX,,,SSS,,#',
      '#,,,,,,,,,,,,,H#',
      '#######OO#######',
    ],
    legend: {
      '#': 'mbs_walltop', U: 'mbs_ac_u', '=': 'mbs_ac', Q: 'mbs_ac+mbs_rack', o: 'mbs_ac+onair',
      D: 'mbs_rdesk', G: 'mbs_glass', d: 'mbs_bdoor', ',': 'floor_carpet_gray',
      X: 'floor_carpet_gray+mbs_mixer', S: 'floor_carpet_gray+mbs_sofa', H: 'floor_carpet_gray+mbs_hagaki', O: 'mbs_mat',
    },
    warps: [
      { x: 7, y: 10, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
      { x: 8, y: 10, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
    ],
    entities: [
      plate(C, 3.1, 6.05, 'ラジオブース', { w: 2.6, bg: '#2a2d36', color: '#ffd23f', edge: '#101014' }),
      npc('mbs_dj', 6, 3, 'down', DJ, { talk: djTalk }),
      npc('mbs_mixer', 3, 9, 'up', MIXER, { talk: posted('up', mixerTalk) }),
      npc('mbs_writer', 13, 7, 'left', WRITER, { talk: posted('left', writerTalk) }),
    ],
    events: [
      { x: 7, y: 2, on: 'action', run: async (g) => g.say('「ON AIR」のランプが赤く光っている。\nいま、この部屋の声が電波に乗っているんだ…！') },
      { x: 2, y: 2, w: 2, on: 'action', run: async (g) => g.say('レコードとCDがぎっしりの棚だ。\n昭和の歌謡曲から最新のヒット曲まで、なんでもある。') },
      { x: 12, y: 2, w: 2, on: 'action', run: async (g) => g.say('リクエスト曲用の棚だ。\n「今日かける曲」の付せんが、何枚も貼ってある。') },
      { x: 7, y: 4, w: 2, on: 'action', run: async (g) => g.say('ゲスト用のマイクだ。\nアームの先に、ふかふかの風よけがついている。') },
      { x: 1, y: 6, w: 10, on: 'action', run: async (g) => g.say('分厚いガラスの向こうが、生放送のブースだ。\n音がもれないように、壁もドアも二重になっている。') },
      { x: 12, y: 6, w: 3, on: 'action', run: async (g) => g.say('ガラス越しに、パーソナリティさんが\nこっちに小さく手を振ってくれた。') },
      { x: 2, y: 8, w: 5, on: 'action', run: async (g) => g.say('ミキサー卓だ。つまみとフェーダーが、ずらーっと並んでいる。\nさわったら、たぶん怒られる。') },
      { x: 10, y: 8, w: 3, on: 'action', run: async (g) => g.say('ゲストの待合ソファだ。\n本番前のゲストさんが、ここで深呼吸するらしい。') },
      {
        x: 14, y: 9, on: 'action',
        run: async (g) => {
          await g.say(['リスナーさんからのハガキが、箱いっぱいに入っている。', `1枚読んでみた。\n${pick(POSTCARDS)}`]);
          if (!today(g, 'mbs_hagaki_day')) { markToday(g, 'mbs_hagaki_day'); g.relax({ stress: 3 }); await g.say('くすっと笑ってしまった。\nストレスが少しへった。'); }
        },
      },
    ],
    onEnter: async (g) => {
      if (quiet) return;
      g.showBanner('MBS　ラジオブース');
      if (g.flag('mbs_radio_first')) return;
      g.setFlag('mbs_radio_first');
      await g.wait(200);
      await g.emote('mbs_writer', '!');
      await say(g, WRITER, ['しーっ…！ガラスの向こうは生放送中や。', 'こっちは「サブ」いうて、音を調整する部屋。\nパーソナリティさんとは、ブースの中で話せるで。', '右のドアから入れるけど、ON AIRのランプが\nついてる間は、そーっとな。']);
    },
  };
}

// ================================================================== 関西テレビ: MANZAI STAGE STUDIO
const KTV = {
  kantoku: { name: '舞台監督', look: { ...LOOKS.staff, hat: ST.ktv.main } },
  karashi: { name: '審査員長 からし師匠', look: { hair: 'bald', hairColor: 'silver', skin: 'tan', top: '#2a2430', bottom: '#2a2430', jacket: true, tie: '#d62f2f', glasses: true } },
  sakka: { name: '審査員の放送作家', look: { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#3a4a7a', bottom: '#2a2d36', glasses: true } },
  kyaku: { name: 'お客さん代表の審査員', look: { ...LOOKS.mom, top: '#5ec4a8', hairColor: 'brown' } },
  negi: { name: 'ねぎ太', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: '#5ee07a', bottom: '#2a3560' } },
  yaki: { name: 'やき男', look: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#ffd23f', bottom: '#2a3560', glasses: true } },
  partner: { name: '臨時の相方 まめ吉', look: { hair: 'afro', hairColor: 'brown', skin: 'tan', top: '#ff8a3d', bottom: '#2a2d36' } },
};
const SKITS = [
  [
    ['negi', 'どうもー！ねぎ焼きボーイズです！よろしくお願いしますー！'],
    ['negi', 'ぼくな、最近ランニング始めてん。'],
    ['yaki', 'ええやん。どこ走ってんの？'],
    ['negi', '家の中。廊下を3万往復や。'],
    ['yaki', '床ぬけるわ！もうええわ！', true],
  ],
  [
    ['negi', 'どうもー！ねぎ焼きボーイズです！よろしくお願いしますー！'],
    ['negi', 'こないだ、遊園地のジェットコースター乗ってん。'],
    ['yaki', 'こわかった？'],
    ['negi', '全然。ずーっと目ぇつぶってたから。'],
    ['yaki', 'ほな乗った意味ないやろ！', true],
    ['negi', 'そのあと観覧車で、3周ぐっすり寝たわ。'],
    ['yaki', '家で寝え！もうええわ！', true],
  ],
];
const KTV_AUD = [
  ['k1', 4, 10, { ...LOOKS.fan, hairColor: 'brown', top: '#ff6fae' }, 'お客さん', 'ねぎ焼きボーイズ、応援してんねん！', true],
  ['k2', 8, 10, LOOKS.salaryman, 'お客さん', '若手の漫才はな、荒けずりなとこがええねん。', true],
  ['k3', 12, 10, { hair: 'twin', hairColor: 'black', skin: 'light', top: '#2a3560', bottom: '#2a3560', skirt: true, tie: '#d62f2f' }, '学生さん', '学校帰りに来てん！今日はどこが勝つやろ？', true],
  ['k4', 15, 11, LOOKS.oldman, 'おじいちゃん', 'わしは六十年、漫才を見てきた。\n…最近の子も、ようやっとる。', true],
  ['k5', 5, 11, LOOKS.mom, 'お客さん', 'わくわくするわ〜！', false],
  ['k6', 11, 11, LOOKS.tourist, 'お客さん', 'これが本場の漫才…！', false],
  ['k7', 16, 10, LOOKS.kid, 'こども', 'がんばれ〜！', false],
];

function manzaiScript(bits, n) {
  const ln = [furi('どうもー！よろしくお願いしますー！'), ...shuffle(bits.slice()).slice(0, n).flat()];
  return { lines: ln, rounds: ln.length };
}

function manzaiRoom() {
  const C = ST.ktv;
  const seatTile = 'ktv_seat';
  const sayK = (g, k, t) => say(g, KTV[k], t);

  async function perform(g) {
    const p = g.map.player;
    const home = { x: p.x, y: p.y, dir: p.dir };
    await g.fadeOut();
    showState.manzai = true;
    quiet = true;
    await g.goto('ktv', 'manzai', 10, 12, 'up', { fade: false });
    quiet = false;
    g.map.camOverride = { x: 0, y: 6 };
    g.placeNpc('ktv_negi', 2, 4, 'right');
    g.placeNpc('ktv_yaki', 3, 4, 'right');
    await g.fadeIn();
    g.sfx('drum');
    await g.walkNpcTo('ktv_yaki', 10, 4, 1.6);
    await g.walkNpcTo('ktv_negi', 9, 4, 1.6);
    g.npc('ktv_negi').dir = 'down';
    g.npc('ktv_yaki').dir = 'down';
    g.sfx('applause');
    const skit = SKITS[g.state.day % SKITS.length];
    for (const [who, line, punch] of skit) {
      const yaki = g.npc('ktv_yaki');
      if (punch) { yaki.dir = 'left'; g.sfx('hit'); g.shake(6, 1); }
      await sayK(g, who, line);
      if (punch) {
        g.sfx('laugh');
        await Promise.all(KTV_AUD.map(([k]) => g.emote(`ktv_${k}`, 'w', 40)));
        yaki.dir = 'down';
      }
    }
    await g.say('ねぎ太・やき男「どうも、ありがとうございましたー！」');
    g.sfx('applause');
    await Promise.all(KTV_AUD.map(([k]) => g.emote(`ktv_${k}`, '♥', 45)));
    await sayK(g, 'karashi', ['うん、テンポがええ。ツッコミの声もよう通っとる。', 'ただな、ボケの前の「間」を、もう半拍ためてみ。\n…85点！']);
    await sayK(g, 'kyaku', 'うちは90点！やき男くんの声、好きやわ〜。');
    await g.fadeOut();
    showState.manzai = false;
    g.map.camOverride = null;
    quiet = true;
    await g.goto('ktv', 'manzai', home.x, home.y, home.dir, { fade: false });
    quiet = false;
    g.placeNpc('ktv_negi', 2, 4, 'right');
    g.placeNpc('ktv_yaki', 3, 4, 'left');
    await g.fadeIn();
    g.relax({ stress: 6 });
    g.addSkill('warai', 1, true);
    g.sfx('good');
    await g.say(`若手の真剣勝負を間近で見た！\nストレスが6へって、お笑いが1上がった。（${g.state.skills.warai}）`);
  }

  async function kantokuTalk(g, npc) {
    const i = await ask(g, npc, ['舞台監督や。今日は若手漫才コンテストの収録やで！', '飛び入りのネタ見せも受けつけとる。出てみるか？'], ['ネタ見せに出る', 'コンテストを観る', 'またにします']);
    if (i === 0) {
      const partner = g.state.partner ? { partner: '相方' } : { partner: KTV.partner.name, partnerLook: KTV.partner.look };
      if (!g.state.partner && !g.checkRequires(CONTEST_JOB.requires)) await sayK(g, 'kantoku', ['相方がおらんのか？ほな、こいつ貸したるわ。', 'うちのADのまめ吉や。ボケだけは一人前やで。']);
      const r = await g.job({ ...CONTEST_JOB, opts: { ...CONTEST_JOB.opts, ...partner, ...manzaiScript(CONTEST_BITS, 4) } });
      if (!r) return;
      if (r.rank === 'S') {
        g.sfx('fanfare');
        await sayK(g, 'karashi', ['…文句なしや。今日の一番は、キミらや！', '間もツッコミも、もう若手の域ちゃうで。']);
        if (!g.flag('ktv_champion')) {
          g.setFlag('ktv_champion');
          g.giveItem('ktv_tate');
          await g.say(['若手漫才コンテストで優勝した！', '漫才コンテストの優勝盾をもらった！']);
        }
      } else if (r.rank === 'A') {
        await sayK(g, 'karashi', 'ええ漫才やった。あとひと押しで優勝やったな。\nまた挑戦しにおいで。');
      } else if (r.rank === 'B') {
        await sayK(g, 'sakka', 'ネタの形はできてる。\nあとは、お客さんの顔を見る余裕やね。');
      } else {
        await sayK(g, 'kyaku', 'うちは好きやったで！\n…でも、ツッコミはもうちょい早よ入れてな！');
      }
    } else if (i === 1) {
      if (today(g, 'ktv_contest_day')) { await say(g, npc, '今日の収録はもう終わったで。\nまた明日も見においでや！'); return; }
      markToday(g, 'ktv_contest_day');
      await say(g, npc, 'ほな客席へどうぞ！次は、ねぎ焼きボーイズや！');
      await perform(g);
    } else {
      await say(g, npc, 'ほな、出番待ってるで〜！');
    }
    npc.dir = 'left';
  }

  return {
    floor: 'floor_carpet_red',
    bgm: 'theater',
    topPad: 34,
    tiles: [
      '####################',
      '#UUUBBBBBBBBBBBBUUU#',
      '#=l=bbbbbbbbbbbb=l=#',
      '#,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,#',
      '#,,,,,,,,,,,,,,,,,,#',
      '#.eeeeeeeeeeeeeeee.#',
      '#..................#',
      '#...JJJJJJJJJJJJ...#',
      '#..................#',
      '#..ssssss..ssssss..#',
      '#..ssssss..ssssss..#',
      '#..................#',
      '#########OO#########',
    ],
    legend: {
      '#': 'ktv_walltop', U: 'ktv_cw_u', '=': 'ktv_cw', l: 'ktv_cw+lantern', B: 'ktv_byobu_u', b: 'ktv_byobu',
      ',': 'floor_stage', e: 'stage_edge', J: 'floor_carpet_red+ktv_judge', s: `floor_carpet_red+${seatTile}`, O: 'ktv_mat',
    },
    warps: [
      { x: 9, y: 13, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
      { x: 10, y: 13, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
    ],
    entities: [
      banner(5, 0.25, 10, 0.95, 'ktv_contest_banner', '若手漫才コンテスト', '#d62f2f', WHT),
      {
        // center mic between the two performers (drawn, not solid)
        type: 'prop', x: 9.5, y: 4, w: 0.5, h: 1, solid: false, z: 2,
        draw(ctx, sx, sy) { ctx.drawImage(tileImageHD('mic'), Math.round(sx * 2) / 2, sy, 16, 16); },
      },
      {
        type: 'prop', x: 16, y: 3, w: 1, h: 1,
        text: 'めくり（出演者の名前の札）だ。\n「ねぎ焼きボーイズ」と書いてある。次の出番らしい。',
        draw(ctx, sx, sy) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx + 3, sy + 14, 10, 2);
          ctx.fillStyle = '#5a3a20'; ctx.fillRect(sx + 4, sy + 6, 1, 9); ctx.fillRect(sx + 11, sy + 6, 1, 9);
          ctx.fillStyle = '#3a2416'; ctx.fillRect(sx + 2, sy - 7, 12, 15);
          ctx.fillStyle = '#fbf6ea'; ctx.fillRect(sx + 3, sy - 6, 10, 13);
          ctx.fillStyle = '#20232a';
          for (let k = 0; k < 4; k++) { ctx.fillRect(sx + 6, sy - 4 + k * 3, 4, 1); ctx.fillRect(sx + 7, sy - 5 + k * 3, 1, 3); }
          ctx.fillStyle = '#d62f2f'; ctx.fillRect(sx + 3, sy - 6, 10, 1);
        },
      },
      npc('ktv_kantoku', 17, 4, 'left', KTV.kantoku, { talk: kantokuTalk }),
      npc('ktv_negi', 2, 4, 'right', KTV.negi, {
        talk: posted('right', lines(KTV.negi, (g) => [
          'ねぎ焼きボーイズのボケ、ねぎ太です！ネタ合わせ中です！',
          g.state.fame >= 250 ? 'えっ、{name}さんや…！ぼくらのネタ、\n見ていってください！' : '相方がな、ツッコミ強すぎて\nぼくのおでこ、毎日ちょっと赤いねん。',
        ])),
      }),
      npc('ktv_yaki', 3, 4, 'left', KTV.yaki, {
        talk: posted('left', lines(KTV.yaki, ['ツッコミのやき男です。', 'コンテストはな、4分で全部出しきらなあかん。\n最初の10秒で、お客さんの心つかむんや。'])),
      }),
      npc('ktv_karashi', 9, 9, 'up', KTV.karashi, {
        talk: posted('up', lines(KTV.karashi, (g) => (g.flag('ktv_champion')
          ? ['おう、優勝した子やないか。', '優勝はゴールやない、スタートや。\n次は、もっと大きい舞台で会おうな。']
          : ['審査員長のからしや。漫才ひとすじ五十年。', 'ええ漫才はな、ふたりの「会話」になっとる。\n台本を読んでるうちは、まだまだや。', '出てみたいんやったら、舞台そでの舞台監督に言い。']))),
      }),
      npc('ktv_sakka', 6, 9, 'up', KTV.sakka, {
        talk: posted('up', lines(KTV.sakka, ['審査員の放送作家です。', '僕はネタの「構成」を見てます。\nフリとオチがきれいにつながってると、点が高いですよ。'])),
      }),
      npc('ktv_kyaku', 13, 9, 'up', KTV.kyaku, {
        talk: posted('up', lines(KTV.kyaku, ['お客さん代表の審査員やで〜！', 'うちはな、むずかしいことはわからへん。\nおもろかったら100点！それだけや！'])),
      }),
      ...KTV_AUD.map(([k, x, y, look, name, line, always]) => npc(`ktv_${k}`, x, y, 'up', { name, look }, {
        sprite: seated, seatTile, fixedDir: true,
        cond: always ? undefined : () => showState.manzai,
        talk: async (g, e) => { await say(g, { name, look }, line); e.dir = 'up'; },
      })),
    ],
    events: [
      { x: 4, y: 2, w: 12, on: 'action', run: async (g) => g.say('ぴかぴかの金屏風だ。\nこの前に立つと、だれでも一人前の漫才師に見える。') },
      { x: 2, y: 2, on: 'action', run: async (g) => g.say('赤いちょうちんだ。\n客席から見ると、舞台がぱっと華やかになる。') },
      { x: 17, y: 2, on: 'action', run: async (g) => g.say('赤いちょうちんだ。\nよく見ると、ちいさく「笑」と書いてある。') },
      { x: 4, y: 8, w: 2, on: 'action', run: async (g) => g.say('審査員席の札だ。\n点数を書くボードと、赤ペンが置いてある。') },
      { x: 10, y: 8, w: 3, on: 'action', run: async (g) => g.say('審査員席のベルだ。\n「チーン」と鳴らすのは、たぶん特別な時だけ。') },
      { x: 14, y: 8, w: 2, on: 'action', run: async (g) => g.say('審査員席の水だ。\n審査も体力勝負らしい。') },
    ],
    onEnter: async (g) => {
      if (quiet) return;
      g.showBanner('関西テレビ　漫才スタジオ');
      if (g.flag('ktv_manzai_first')) return;
      g.setFlag('ktv_manzai_first');
      await g.wait(200);
      await g.emote('ktv_kantoku', '!');
      await sayK(g, 'kantoku', ['おっ、見学か？ここは漫才スタジオや。', '今日は若手漫才コンテストの収録中。\n金屏風の前で、センターマイク一本で勝負するんや。', '事務所に所属してるか★30くらいあったら、\n飛び入りのネタ見せもできるで。ワシに言うてな！']);
    },
  };
}

// ================================================================== places
for (const C of [ST.mbs, ST.ktv]) {
  registerPlace({
    id: C.pid,
    name: C.name,
    kind: 'building',
    bgm: 'studio',
    start: { room: 'lobby', x: 9, y: 11, dir: 'up' },
    rooms: {
      lobby: lobbyRoom(C),
      gakuya: gakuyaRoom(C),
      studio: studioRoom(C),
      ...(C.special === 'radio' ? { radio: radioRoom() } : { manzai: manzaiRoom() }),
    },
  });
}
