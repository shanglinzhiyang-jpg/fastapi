// 東宝：日比谷の劇場ロビー・ミュージカル劇場・怪獣映画スタジオ・試写室。
//
//   lobby      ロビー（チケット売り場・売店・ポスター・ロゴ）。奥の扉＝劇場、左の通路＝スタジオ、右の通路＝試写室
//   theater    劇場（ミュージカルの舞台・オーケストラピット・客席）
//   studio     怪獣映画スタジオ（ミニチュアの街のセット・怪獣スーツ・カメラ）
//   screening  試写室（スクリーンに短い「映画」を上映する）
//
// お仕事：tier0 映画のエキストラ / tier1 逃げまどう市民役（所属 or ★30）/
//         tier2 怪獣のスーツアクター・ミュージカルのアンサンブル（★250）/
//         tier3 ミュージカル主演（★1000）/ tier4 大作映画の主演（★2000・完成披露試写会つき）
// レッスン：ミュージカル歌唱（歌）/ 映画演技（演技）
// 登場人物・作品（大怪獣ガオドン、『星降る街のメロディ』）はすべて架空です。

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet } from '../engine/sprites.js';
import { defineTile, R, P, speckle } from '../engine/tiles.js';
import { registerItem } from '../engine/state.js';
import { audio, registerSong } from '../engine/audio.js';
import { drawLogo } from '../engine/logos.js';
import { text, COLORS } from '../engine/draw.js';
import { W, H, TILE, makeCanvas, shade, pick, clamp, hash2 } from '../engine/util.js';

// ---------------------------------------------------------------- palette
const NAVY = '#1f2c5c', NAVY_D = '#141c3d', NAVY_DD = '#0c1229', NAVY_L = '#34478c';
const GOLD = '#d9b44a', GOLD_L = '#f6df8a', GOLD_D = '#9a7524';
const CRIM = '#8e1b2c', CRIM_L = '#b8283c', CRIM_D = '#5c0f1c';
const IVORY = '#f2ebdc';

// Main-canvas helpers (rounded coordinates).
function F(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function discF(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
  }
}
// Tile-canvas helpers.
function disc(c, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) P(c, cx + x, cy + y, col);
}
function shadowT(c, cx, cy, rx, ry) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    c.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

// ---------------------------------------------------------------- items
registerItem('toho_popcorn', { name: 'ポップコーン', price: 400, heal: 30, desc: '劇場名物、できたての塩ポップコーン。体力が30回復する。' });
registerItem('toho_soda', { name: 'メロンソーダ', price: 250, heal: 20, desc: 'シュワっと爽快！体力が20回復する。' });
registerItem('toho_pamphlet', { name: '公演パンフ', price: 300, buff: 'uta', desc: 'ミュージカルのパンフレット。次の「歌」のミニゲームが少しやさしくなる。' });
registerItem('toho_sofubi', {
  name: '怪獣ソフビ', price: 1500, desc: '大怪獣ガオドンのソフビ人形。使うと…？',
  use: async (g) => {
    g.sfx('drum');
    await g.emote('player', '♪');
    await g.say(pick([
      '「ガオー！」\nソフビで怪獣ごっこをした。',
      '「ガオドン、しゅつどう！」\n…ひとりで盛り上がってしまった。',
      'ソフビのガオドンと目が合った。\nなんだか勇気がわいてきた！',
    ]));
    if (g.flag('toho_sofubi_day') !== g.state.day) {
      g.setFlag('toho_sofubi_day', g.state.day);
      g.heal(5);
      await g.say('元気が出て、体力が5回復した。\n（1日1回）');
    }
  },
});
registerItem('toho_clapper', {
  name: '記念のカチンコ', price: 0, desc: '完成披露試写会の記念品。「主演」の文字がまぶしい。',
  use: async (g) => {
    g.sfx('snare');
    await g.say('カチン！\n記念のカチンコには「主演 {name}」と\n書いてある。あの日の拍手を思い出す…。');
  },
});

// ---------------------------------------------------------------- music
registerSong('toho_lobby', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'triangle', vol: 0.09, notes: 'C5 - - - A4 - | F5 - - - E5 - | D5 - C5 - Bb4 - | A4 - - - - - | Bb4 - - - D5 - | G5 - - - F5 - | E5 - D5 - E5 - | F5 - - - - -' },
    { wave: 'square', vol: 0.018, notes: 'F3 A3 C4 A3 C4 A3 | F3 A3 C4 A3 C4 A3 | Bb2 D3 F3 D3 F3 D3 | F3 A3 C4 A3 C4 A3 | G2 Bb2 D3 Bb2 D3 Bb2 | C3 E3 G3 E3 G3 E3 | C3 E3 Bb3 E3 G3 E3 | F3 A3 C4 A3 F3 .' },
    { wave: 'triangle', vol: 0.1, notes: 'F2 - - . . . | F2 - - . . . | Bb1 - - . . . | F2 - - . . . | G1 - - . . . | C2 - - . . . | C2 - - . . . | F2 - - . . .' },
  ],
});
registerSong('toho_musical', {
  bpm: 120, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'G4 . C5 . E5 . G5 - | A5 - G5 . E5 . C5 . | D5 . F5 . A5 . G5 - | E5 - - - . . G4 . | C5 . E5 . G5 . C6 - | B5 - A5 . G5 . E5 . | F5 . A5 . G5 . D5 . | C5 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . E3 . G3 . | F2 . C3 . A2 . C3 . | D3 . A3 . F3 . A3 . | G2 . D3 . B2 . D3 . | C3 . G3 . E3 . G3 . | A2 . E3 . C3 . E3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.08, notes: 'k . h . s . h . | k . h k s . h .' },
  ],
});
registerSong('toho_kaiju', {
  bpm: 100, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'E4 - - - A4 - - - | G4 - F4 - E4 - - - | D4 - - - F4 - A4 - | G#4 - - - - - - - | E4 - - - A4 - C5 - | B4 - A4 - G4 - - - | F4 - E4 - D4 - F4 - | E4 - - - - - - -' },
    { wave: 'square', vol: 0.03, notes: 'A2 . . A2 . . C3 . | A2 . . A2 . . G2 . | F2 . . F2 . . G2 . | E2 . . E2 . E3 . .' },
    { wave: 'triangle', vol: 0.12, notes: 'A1 . . A1 . . C2 . | A1 . . A1 . . G1 . | F1 . . F1 . . G1 . | E1 . . E1 . E2 . .' },
    { wave: 'drum', vol: 0.1, notes: 'k . . k s . . . | k . . k s . k .' },
  ],
});

// ---------------------------------------------------------------- tiles: lobby
defineTile('toho_marble', {
  variants: 3,
  draw(c, r) {
    R(c, 0, 0, 16, 16, IVORY);
    let x = Math.floor(r() * 16);
    for (let y = 0; y < 16; y++) { if (r() < 0.75) P(c, x, y, '#e4d9c3'); x = (x + (r() < 0.5 ? 1 : -1) + 16) % 16; }
    R(c, 0, 15, 16, 1, '#d8cbad'); R(c, 15, 0, 1, 16, '#d8cbad');
    for (const [x0, y0, dx, dy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]]) {
      P(c, x0, y0, NAVY_L); P(c, x0 + dx, y0, NAVY_L); P(c, x0, y0 + dy, NAVY_L);
    }
  },
});
function runner(side) {
  return (c, r) => {
    R(c, 0, 0, 16, 16, CRIM);
    speckle(c, r, [shade(CRIM, -0.12), shade(CRIM, 0.1)], 18);
    if (side === 'l') { R(c, 0, 0, 3, 16, GOLD_D); R(c, 1, 0, 1, 16, GOLD); R(c, 4, 0, 1, 16, GOLD_D); }
    else { R(c, 13, 0, 3, 16, GOLD_D); R(c, 14, 0, 1, 16, GOLD); R(c, 11, 0, 1, 16, GOLD_D); }
    const mx = side === 'l' ? 15 : 0, nx = side === 'l' ? 14 : 1;
    for (const y of [3, 11]) { P(c, mx, y - 1, GOLD); P(c, mx, y, GOLD_L); P(c, mx, y + 1, GOLD); P(c, nx, y, GOLD); }
  };
}
defineTile('toho_runner_l', { draw: runner('l') });
defineTile('toho_runner_r', { draw: runner('r') });
defineTile('toho_wall_hi', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, NAVY);
    R(c, 0, 0, 16, 1, GOLD_L); R(c, 0, 1, 16, 1, GOLD); R(c, 0, 2, 16, 1, GOLD_D); R(c, 0, 3, 16, 1, NAVY_DD);
    for (const x of [4, 12]) {
      const y = 9;
      P(c, x, y - 2, NAVY_L); R(c, x - 1, y - 1, 3, 1, NAVY_L); R(c, x - 2, y, 5, 1, NAVY_L); R(c, x - 1, y + 1, 3, 1, NAVY_L); P(c, x, y + 2, NAVY_L);
      P(c, x, y, GOLD_D);
    }
  },
});
defineTile('toho_wall_lo', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, NAVY);
    R(c, 0, 2, 16, 1, GOLD_D); R(c, 0, 3, 16, 1, GOLD); R(c, 0, 4, 16, 1, GOLD_D);
    R(c, 1, 6, 14, 6, NAVY_D); R(c, 2, 7, 12, 4, NAVY); R(c, 1, 6, 14, 1, NAVY_L);
    R(c, 0, 13, 16, 3, NAVY_DD); R(c, 0, 13, 16, 1, GOLD_D);
  },
});
function doorHi(side) {
  return (c) => {
    const L = side === 'l';
    R(c, 0, 0, 16, 16, CRIM);
    R(c, 0, 0, 16, 2, GOLD); R(c, 0, 0, 16, 1, GOLD_L);
    R(c, L ? 0 : 14, 0, 2, 16, GOLD); R(c, L ? 0 : 15, 0, 1, 16, GOLD_D);
    const x0 = L ? 2 : 0;
    // transom window (lit)
    R(c, x0 + 1, 3, 13, 5, GOLD_D); R(c, x0 + 2, 4, 11, 3, '#ffe9a8'); R(c, x0 + 2, 4, 11, 1, '#fff6d0');
    for (let x = x0 + 5; x < x0 + 13; x += 4) R(c, x, 4, 1, 3, GOLD_D);
    // tufted leather
    for (const y of [10, 14]) for (const x of [x0 + 3, x0 + 7, x0 + 11]) P(c, x, y, GOLD_L);
    R(c, L ? 15 : 0, 2, 1, 14, CRIM_D);
  };
}
function doorLo(side) {
  return (c) => {
    const L = side === 'l';
    R(c, 0, 0, 16, 16, CRIM);
    R(c, L ? 0 : 14, 0, 2, 16, GOLD); R(c, L ? 0 : 15, 0, 1, 16, GOLD_D);
    const x0 = L ? 2 : 0;
    for (const y of [2, 6]) for (const x of [x0 + 3, x0 + 7, x0 + 11]) P(c, x, y, GOLD_L);
    R(c, L ? 12 : 2, 3, 2, 6, GOLD); R(c, L ? 12 : 2, 3, 2, 1, GOLD_L);
    R(c, x0, 12, 14, 4, GOLD_D); R(c, x0, 12, 14, 1, GOLD);
    R(c, L ? 15 : 0, 0, 1, 16, CRIM_D);
  };
}
defineTile('toho_door_hi_l', { solid: true, draw: doorHi('l') });
defineTile('toho_door_hi_r', { solid: true, draw: doorHi('r') });
defineTile('toho_door_lo_l', { draw: doorLo('l') });
defineTile('toho_door_lo_r', { draw: doorLo('r') });
function passage(side, frame, frameL) {
  return (c) => {
    const L = side === 'l';
    R(c, 0, 0, 16, 16, '#0b0e22');
    for (let i = 0; i < 10; i++) R(c, L ? 15 - i : i, 2, 1, 12, shade('#3e4470', -i * 0.09));
    R(c, 0, 0, 16, 2, frame); R(c, 0, 14, 16, 2, frame);
    R(c, 0, 1, 16, 1, frameL); R(c, 0, 14, 16, 1, frameL);
    R(c, L ? 15 : 0, 2, 1, 12, frameL);
  };
}
defineTile('toho_passage_l', { draw: passage('l', GOLD_D, GOLD) });
defineTile('toho_passage_r', { draw: passage('r', GOLD_D, GOLD) });
defineTile('toho_passage_studio', { draw: passage('r', '#3b3f48', '#7d8391') });
function counter(extra) {
  return (c) => {
    R(c, 0, 1, 16, 6, IVORY); R(c, 0, 1, 16, 1, '#ffffff'); R(c, 0, 6, 16, 1, '#ddd1b8');
    R(c, 0, 7, 16, 1, GOLD);
    R(c, 0, 8, 16, 7, NAVY); R(c, 2, 9, 12, 4, NAVY_D); R(c, 3, 10, 10, 2, NAVY);
    R(c, 0, 14, 16, 1, GOLD_D); R(c, 0, 15, 16, 1, NAVY_DD);
    if (extra) extra(c);
  };
}
defineTile('toho_counter', { solid: true, obj: true, talkThrough: true, draw: counter() });
defineTile('toho_counter_tix', {
  solid: true, obj: true, talkThrough: true,
  draw: counter((c) => {
    R(c, 2, 2, 5, 3, '#fff6d8'); R(c, 2, 3, 5, 1, CRIM_L); R(c, 3, 1, 5, 3, '#fffbe8'); R(c, 3, 2, 5, 1, CRIM_L);
    R(c, 11, 3, 3, 2, GOLD); P(c, 12, 2, GOLD_L); R(c, 10, 5, 5, 1, GOLD_D);
  }),
});
defineTile('toho_counter_reg', {
  solid: true, obj: true, talkThrough: true,
  draw: counter((c) => {
    R(c, 4, 0, 8, 6, '#3b3f48'); R(c, 5, 1, 6, 2, '#5ee07a'); R(c, 5, 4, 6, 1, '#9aa0aa');
  }),
});
defineTile('toho_popcorn', {
  solid: true, obj: true, frames: 2, speed: 18,
  draw(c, r, f) {
    shadowT(c, 8, 15, 6, 1);
    R(c, 2, 11, 12, 4, CRIM); R(c, 2, 11, 12, 1, CRIM_L); R(c, 3, 15, 2, 1, '#20232a'); R(c, 11, 15, 2, 1, '#20232a');
    R(c, 2, 2, 12, 9, '#3b2a20'); R(c, 3, 3, 10, 7, '#fff8e0');
    for (let i = 0; i < 18; i++) P(c, 3 + ((i * 7) % 10), 6 + ((i * 3) % 4), i % 3 ? '#ffe9a8' : '#ffffff');
    R(c, 3, 9, 10, 1, '#f6d26a');
    const pops = f ? [[5, 4], [10, 3], [8, 5]] : [[7, 3], [4, 5], [11, 5]];
    for (const [x, y] of pops) { P(c, x, y, '#ffffff'); P(c, x + 1, y, '#ffe9a8'); }
    R(c, 1, 0, 14, 2, CRIM_L); R(c, 1, 0, 14, 1, GOLD);
  },
});
defineTile('toho_soda', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 6, 1);
    R(c, 2, 1, 12, 14, '#c3c6ce'); R(c, 3, 1, 10, 13, '#e8eaee'); R(c, 3, 1, 10, 1, '#ffffff');
    R(c, 4, 2, 8, 4, '#5ee07a'); R(c, 5, 3, 6, 2, '#a8f0b8');
    for (const x of [4, 7, 10]) { R(c, x, 7, 2, 2, '#5a5f6b'); }
    R(c, 3, 11, 10, 2, '#9aa0aa'); R(c, 5, 10, 2, 2, '#ffffff'); R(c, 9, 10, 2, 2, '#ffffff');
  },
});
defineTile('toho_sofa', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 14, 8, 1);
    R(c, 0, 2, 16, 6, NAVY_D); R(c, 0, 2, 16, 1, GOLD);
    R(c, 0, 7, 16, 6, NAVY); R(c, 0, 7, 16, 1, NAVY_L); R(c, 7, 7, 1, 6, NAVY_D);
    R(c, 0, 13, 16, 1, NAVY_DD); P(c, 1, 14, GOLD); P(c, 14, 14, GOLD);
  },
});
function signpost(dir) {
  return (c) => {
    shadowT(c, 8, 15, 4, 1);
    R(c, 7, 7, 2, 8, GOLD_D); R(c, 5, 14, 6, 2, GOLD_D);
    R(c, 1, 1, 14, 7, GOLD); R(c, 2, 2, 12, 5, NAVY);
    R(c, 4, 4, 8, 1, GOLD_L);
    if (dir === 'l') { P(c, 5, 3, GOLD_L); P(c, 5, 5, GOLD_L); P(c, 6, 2, GOLD_L); P(c, 6, 6, GOLD_L); }
    else { P(c, 10, 3, GOLD_L); P(c, 10, 5, GOLD_L); P(c, 9, 2, GOLD_L); P(c, 9, 6, GOLD_L); }
  };
}
defineTile('toho_signpost_l', { solid: true, obj: true, draw: signpost('l') });
defineTile('toho_signpost_r', { solid: true, obj: true, draw: signpost('r') });

// ---------------------------------------------------------------- tiles: theater
defineTile('toho_carpet', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#7a1626');
    speckle(c, r, ['#6a1220', '#8a1c2e'], 22);
    P(c, 4, 4, '#a0763a'); P(c, 12, 12, '#a0763a');
  },
});
defineTile('toho_backdrop', {
  solid: true, variants: 4,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 5, '#1b2150'); R(c, 0, 5, 16, 4, '#262a66'); R(c, 0, 9, 16, 7, '#34307a');
    speckle(c, r, ['#fff6c8', '#ffffff'], 4, 0, 0, 16, 8);
    if (v === 1) { disc(c, 9, 4, 2, '#fff2b0'); P(c, 8, 3, '#ffffff'); }
    let x = 0;
    while (x < 16) {
      const w = 3 + Math.floor(r() * 4), top = 9 + Math.floor(r() * 4);
      R(c, x, top, w, 16 - top, '#171a3e');
      if (r() < 0.6) { R(c, x + 1, top - 2, 1, 2, '#171a3e'); }
      for (let y = top + 2; y < 15; y += 3) if (r() < 0.6) P(c, x + 1 + Math.floor(r() * Math.max(1, w - 2)), y, '#ffd86a');
      x += w;
    }
    R(c, 0, 15, 16, 1, '#5a3a20');
  },
});
defineTile('toho_stairs', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#6e4428');
    for (let i = 0; i < 4; i++) { R(c, 1, i * 4, 14, 3, shade('#ddb06e', -i * 0.1)); R(c, 1, i * 4 + 3, 14, 1, '#5a3a20'); }
    R(c, 0, 0, 1, 16, GOLD_D); R(c, 15, 0, 1, 16, GOLD_D);
  },
});
defineTile('toho_pit', { draw(c, r) { R(c, 0, 0, 16, 16, '#1a1824'); speckle(c, r, ['#221f2e', '#15141c'], 16); } });
defineTile('toho_pit_rail', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    R(c, 0, 3, 16, 2, GOLD); R(c, 0, 3, 16, 1, GOLD_L);
    R(c, 0, 5, 16, 10, NAVY); R(c, 0, 5, 16, 1, NAVY_L);
    for (const x of [3, 11]) P(c, x, 9, GOLD);
    R(c, 0, 14, 16, 1, GOLD_D); R(c, 0, 15, 16, 1, NAVY_DD);
  },
});
defineTile('toho_pit_side', {
  solid: true, obj: true,
  draw(c) {
    R(c, 5, 0, 6, 16, NAVY); R(c, 5, 0, 6, 1, GOLD); R(c, 6, 0, 1, 16, NAVY_L);
    R(c, 7, 0, 2, 16, GOLD); R(c, 7, 0, 1, 16, GOLD_L);
  },
});
defineTile('toho_stand', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 4, 1);
    R(c, 7, 8, 2, 7, '#3b3f48'); R(c, 4, 14, 8, 1, '#3b3f48');
    R(c, 2, 2, 12, 7, '#20232a'); R(c, 3, 2, 10, 6, '#f6f2e6');
    for (const y of [3, 5, 7]) R(c, 4, y, 8, 1, '#9aa0aa');
    P(c, 5, 4, '#20232a'); P(c, 8, 4, '#20232a'); P(c, 10, 6, '#20232a'); P(c, 6, 6, '#20232a');
    R(c, 6, 0, 4, 2, '#fff6a8');
  },
});
defineTile('toho_timpani', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 14, 7, 2);
    R(c, 2, 6, 12, 7, '#b8733a'); R(c, 3, 12, 10, 2, '#8a5228'); R(c, 2, 6, 3, 6, '#d8955a');
    disc(c, 8, 5, 5, '#f2e6c4'); disc(c, 8, 5, 3, '#e8dab4');
    P(c, 2, 5, '#c0c4cc'); P(c, 13, 5, '#c0c4cc');
  },
});
defineTile('toho_lamp', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 4, 1);
    R(c, 7, 5, 2, 10, '#20232a'); R(c, 5, 14, 6, 2, '#20232a');
    R(c, 5, 1, 6, 5, '#20232a'); R(c, 6, 2, 4, 3, '#ffe36e'); R(c, 7, 2, 2, 1, '#ffffff'); R(c, 6, 0, 4, 1, '#20232a');
  },
});

// ---------------------------------------------------------------- tiles: studio
defineTile('toho_sky_hi', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 5, '#5aa2e6'); R(c, 0, 5, 16, 6, '#68aeec'); R(c, 0, 11, 16, 5, '#78bcf1');
    const cloud = (x, y) => { R(c, x - 3, y, 8, 2, '#ffffff'); R(c, x - 1, y - 1, 4, 1, '#ffffff'); R(c, x - 4, y + 2, 10, 1, '#e3f1fb'); };
    if (v === 0) cloud(6, 6);
    if (v === 1) cloud(10, 10);
    R(c, 0, 0, 16, 1, '#4a8fd6');
  },
});
defineTile('toho_sky_lo', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 6, '#8ccaf5'); R(c, 0, 6, 16, 5, '#a2d6f8'); R(c, 0, 11, 16, 5, '#bfe4fb');
    const peak = [5, -1, 11][v];
    for (let x = 0; x < 16; x++) {
      const h = v === 1 ? 3 + Math.round(Math.sin(((x + 2) / 18) * Math.PI) * 2) : Math.max(2, 7 - Math.abs(x - peak));
      R(c, x, 15 - h, 1, h, '#93b4d4');
      if (v !== 1 && h >= 6) P(c, x, 15 - h, '#f4f8fc');
    }
    R(c, 0, 14, 16, 1, '#7f9bb8'); R(c, 0, 15, 16, 1, '#5a6f8a');
  },
});
defineTile('toho_swall_hi', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#2b2d36'); R(c, 0, 0, 16, 1, '#4a4d5c');
    for (const x of [1, 9]) { R(c, x, 3, 6, 12, '#33363f'); R(c, x, 3, 6, 1, '#3d404b'); }
  },
});
defineTile('toho_swall_lo', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, '#2b2d36');
    for (const x of [1, 9]) { R(c, x, 0, 6, 10, '#33363f'); }
    R(c, 0, 11, 16, 1, '#15161c');
    R(c, 0, 13, 16, 3, '#1a1b22'); R(c, 0, 13, 16, 1, '#4a4d5c');
  },
});
defineTile('toho_mini_ground', { draw(c, r) { R(c, 0, 0, 16, 16, '#8b9480'); speckle(c, r, ['#7f8874', '#97a08c'], 14); } });
defineTile('toho_mini_road', {
  variants: 3,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#5b5e68');
    R(c, 0, 0, 16, 2, '#a9adb7'); R(c, 0, 14, 16, 2, '#a9adb7'); R(c, 0, 2, 16, 1, '#7d818b'); R(c, 0, 13, 16, 1, '#4a4d55');
    for (let x = 1; x < 16; x += 6) R(c, x, 7, 3, 1, '#f0efe6');
    if (v === 1) { R(c, 3, 4, 4, 2, '#d62f2f'); R(c, 4, 4, 2, 1, '#ffb0b0'); }
    if (v === 2) { R(c, 9, 10, 4, 2, '#ffd23f'); R(c, 10, 10, 2, 1, '#fff2a8'); }
  },
});
defineTile('toho_mini_road_v', {
  variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#5b5e68');
    R(c, 0, 0, 2, 16, '#a9adb7'); R(c, 14, 0, 2, 16, '#a9adb7'); R(c, 2, 0, 1, 16, '#7d818b'); R(c, 13, 0, 1, 16, '#4a4d55');
    for (let y = 1; y < 16; y += 6) R(c, 7, y, 1, 3, '#f0efe6');
    if (v === 1) { R(c, 4, 9, 2, 4, '#2f6fd0'); R(c, 4, 10, 2, 1, '#bfe6ff'); }
  },
});
defineTile('toho_mini_cross', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#5b5e68');
    for (let x = 3; x < 13; x += 3) { R(c, x, 0, 2, 3, '#f0efe6'); R(c, x, 13, 2, 3, '#f0efe6'); }
    for (let y = 3; y < 13; y += 3) { R(c, 0, y, 3, 2, '#f0efe6'); R(c, 13, y, 3, 2, '#f0efe6'); }
  },
});
defineTile('toho_mini_bldg', {
  solid: true, obj: true, variants: 4,
  draw(c, r, f, v) {
    const s = [
      { roof: '#c9ccd4', face: '#9aa0aa', win: '#dff2ff', top: 1 },
      { roof: '#efe2bf', face: '#d6c49a', win: '#fff6c8', top: 5 },
      { roof: '#8fb4d6', face: '#4f7fb0', win: '#bfe6ff', top: 0 },
      { roof: '#d08a6a', face: '#a85a42', win: '#ffe9a8', top: 4 },
    ][v];
    const x0 = 2, w = 12;
    shadowT(c, 8, 15, 7, 1);
    R(c, x0, s.top, w, 4, s.roof); R(c, x0, s.top, w, 1, shade(s.roof, 0.35));
    R(c, x0, s.top + 4, w, 15 - s.top - 4, s.face);
    for (let y = s.top + 6; y < 14; y += 3) for (let x = x0 + 2; x < x0 + w - 2; x += 3) R(c, x, y, 2, 2, s.win);
    R(c, x0 + w - 1, s.top + 4, 1, 11 - s.top, shade(s.face, -0.25));
    R(c, x0, 14, w, 1, shade(s.face, -0.45));
    if (v === 0) R(c, 4, s.top + 1, 3, 2, '#7d8391');
    if (v === 3) R(c, 9, s.top + 1, 2, 2, '#6d7380');
  },
});
defineTile('toho_mini_house', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    const house = (x, y, roof) => {
      shadowT(c, x + 3, y + 8, 4, 1);
      R(c, x, y + 3, 7, 5, '#f4f1e6'); R(c, x + 6, y + 3, 1, 5, '#cfc9b6');
      R(c, x - 1, y, 9, 3, roof); R(c, x, y - 1, 7, 1, roof); R(c, x - 1, y, 9, 1, shade(roof, 0.3));
      P(c, x + 1, y + 4, '#5fa8e6'); P(c, x + 4, y + 4, '#5fa8e6'); R(c, x + 2, y + 6, 1, 2, '#8a5a33');
    };
    house(2, 2, v ? '#2f6fd0' : '#d62f2f');
    house(8, 8, v ? '#2f9a4a' : '#e8873a');
  },
});
defineTile('toho_mini_tower', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 6, 1);
    for (let y = 1; y < 16; y++) {
      const hw = 1 + Math.floor(y / 3);
      R(c, 8 - hw, y, hw * 2, 1, Math.floor(y / 3) % 2 ? '#ffffff' : '#e8452f');
    }
    for (let y = 5; y < 15; y += 3) { P(c, 7, y, '#8b9480'); P(c, 8, y, '#8b9480'); }
    R(c, 5, 6, 6, 2, '#c9ccd4'); R(c, 5, 6, 6, 1, '#ffffff');
    R(c, 7, 0, 2, 1, '#e8452f');
  },
});
defineTile('toho_mini_trees', {
  solid: true, obj: true,
  draw(c) {
    for (const [x, y] of [[4, 5], [11, 4], [7, 10], [12, 11]]) {
      shadowT(c, x, y + 3, 3, 1);
      disc(c, x, y, 3, '#2f6b34'); disc(c, x, y, 2, '#4a9a4a'); P(c, x - 1, y - 1, '#74c26a');
    }
  },
});
defineTile('toho_mini_sea', {
  solid: true, frames: 2, speed: 30,
  draw(c, r, f) {
    R(c, 0, 0, 16, 16, '#2f6fb8');
    speckle(c, r, ['#2a64a8', '#3779c4'], 14);
    const o = f * 3;
    for (const [x, y] of [[1, 3], [8, 6], [4, 10], [11, 13]]) R(c, (x + o) % 14, y, 3, 1, '#9cc8f2');
  },
});
defineTile('toho_set_edge', {
  solid: true, talkThrough: true,
  draw(c) {
    R(c, 0, 0, 16, 3, '#8b9480'); R(c, 0, 3, 16, 1, '#5a6050');
    R(c, 0, 4, 16, 12, '#1e1f26'); R(c, 0, 4, 16, 1, '#3a3c46');
    R(c, 2, 9, 4, 1, '#e8c43a'); R(c, 11, 12, 3, 1, '#e8c43a');
  },
});
defineTile('toho_set_side', {
  solid: true,
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 10);
    R(c, 0, 0, 3, 16, '#8b9480'); R(c, 3, 0, 1, 16, '#5a6050'); R(c, 4, 0, 3, 16, '#1e1f26');
  },
});
defineTile('toho_film_cam', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 14, 6, 1);
    for (let i = 0; i < 6; i++) { P(c, 8 - i, 9 + i, '#5a5f6b'); P(c, 8 + i, 9 + i, '#5a5f6b'); P(c, 8, 9 + i, '#5a5f6b'); }
    R(c, 4, 4, 8, 6, '#20232a'); R(c, 5, 5, 6, 4, '#3b3f48');
    R(c, 6, 0, 4, 4, '#20232a'); P(c, 7, 0, '#5fd7ff'); P(c, 8, 0, '#5fd7ff');
    disc(c, 4, 5, 2, '#2b2d36'); P(c, 4, 5, '#9aa0aa');
    disc(c, 12, 5, 2, '#2b2d36'); P(c, 12, 5, '#9aa0aa');
    P(c, 10, 8, '#ff2b3a');
  },
});
defineTile('toho_kaiju_head', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 4, 1);
    R(c, 7, 10, 2, 5, '#5a5f6b'); R(c, 4, 14, 8, 2, '#3b3f48');
    disc(c, 8, 6, 5, '#356f40'); disc(c, 8, 6, 4, '#4e9a5a');
    R(c, 5, 4, 2, 2, '#fff8d0'); P(c, 6, 5, '#1d1d26'); R(c, 9, 4, 2, 2, '#fff8d0'); P(c, 9, 5, '#1d1d26');
    P(c, 8, 7, '#f2e6c4'); R(c, 6, 9, 4, 1, '#7a1f2a');
    for (const x of [5, 8, 11]) { P(c, x, 1, '#f08a2c'); P(c, x, 0, '#ffc25a'); }
  },
});
defineTile('toho_workbench', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 14, 7, 1);
    R(c, 0, 6, 16, 6, '#b98552'); R(c, 0, 6, 16, 1, '#d6a06a'); R(c, 0, 12, 16, 1, '#8a5a33');
    R(c, 1, 13, 2, 2, '#5a3a20'); R(c, 13, 13, 2, 2, '#5a3a20');
    R(c, 2, 1, 4, 7, '#9aa0aa'); R(c, 2, 1, 4, 1, '#c9ccd4'); P(c, 3, 3, '#dff2ff'); P(c, 4, 5, '#dff2ff');
    R(c, 7, 4, 3, 3, '#d6c49a'); R(c, 7, 3, 3, 1, '#d62f2f');
    disc(c, 12, 8, 1, '#2f6fd0'); disc(c, 14, 9, 1, '#e8452f'); R(c, 11, 4, 1, 4, '#c48a52');
  },
});
defineTile('toho_windfan', {
  solid: true, obj: true, frames: 2, speed: 6,
  draw(c, r, f) {
    shadowT(c, 8, 15, 5, 1);
    R(c, 6, 11, 4, 4, '#3b3f48'); R(c, 3, 14, 10, 2, '#3b3f48');
    disc(c, 8, 6, 6, '#20232a'); disc(c, 8, 6, 5, '#5a5f6b');
    if (f) { R(c, 4, 6, 9, 1, '#c0c4cc'); R(c, 8, 2, 1, 9, '#c0c4cc'); }
    else { for (let i = -3; i <= 3; i++) { P(c, 8 + i, 6 + i, '#c0c4cc'); P(c, 8 + i, 6 - i, '#c0c4cc'); } }
    disc(c, 8, 6, 1, '#20232a');
  },
});

// ---------------------------------------------------------------- tiles: screening room
defineTile('toho_carpet_navy', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#18214a');
    speckle(c, r, ['#141c40', '#1e2854'], 18);
    P(c, 8, 8, '#8a6e30'); P(c, 0, 0, '#8a6e30');
  },
});
defineTile('toho_stage_dark', { solid: true, draw(c, r) { R(c, 0, 0, 16, 16, '#0b0c14'); speckle(c, r, ['#11121c'], 6); } });
defineTile('toho_recliner', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 14, 8, 1);
    R(c, 1, 2, 14, 6, '#2a3a7a'); R(c, 1, 2, 14, 1, '#4a5aa0');
    R(c, 0, 7, 16, 7, NAVY); R(c, 2, 8, 12, 1, NAVY_L);
    R(c, 0, 6, 2, 8, NAVY_D); R(c, 14, 6, 2, 8, NAVY_D);
    P(c, 1, 6, GOLD); P(c, 14, 6, GOLD);
    R(c, 0, 14, 16, 1, NAVY_DD);
  },
});
defineTile('toho_projector', {
  solid: true, obj: true,
  draw(c) {
    shadowT(c, 8, 15, 5, 1);
    R(c, 6, 10, 4, 5, '#3b3f48'); R(c, 4, 14, 8, 2, '#3b3f48');
    R(c, 3, 5, 10, 6, '#5a5f6b'); R(c, 3, 5, 10, 1, '#7d8391');
    R(c, 6, 1, 4, 4, '#20232a'); R(c, 7, 1, 2, 1, '#fff6a8');
    disc(c, 4, 4, 2, '#20232a'); P(c, 4, 4, '#9aa0aa');
    disc(c, 12, 4, 2, '#20232a'); P(c, 12, 4, '#9aa0aa');
  },
});

// ---------------------------------------------------------------- kaiju sprite (大怪獣ガオドン)
const KPAL = {
  o: '#1d2b22', g: '#4e9a5a', G: '#357046', l: '#7cc786', b: '#e3e6a6', B: '#c2c483',
  p: '#f08a2c', P: '#ffc25a', e: '#fff8d0', k: '#1d1d26', h: '#f2e6c4', m: '#7a1f2a', t: '#ffffff', c: '#f2e6c4',
};
const K_DOWN = [
  '.....pp.pp.pp.....',
  '....oPPoPPoPPo....',
  '...oggggggggggo...',
  '..oglgggggggggGo..',
  '..ogeeeggggeeeGo..',
  '..ogekeggggekeGo..',
  '..oggggghhggggGo..',
  '..oGggmmmmmmggGo..',
  '...oGgmtmmtmgGo...',
  '....oGGGGGGGGo....',
  '...oggbbbbbbggo...',
  '..ogggbbbbbbgggo..',
  '.ocggbbbbbbbbggco.',
  '.ocGgBBBBBBBBgGco.',
  '..oogbbbbbbbbgoo..',
  '...ogbbbbbbbbgo...',
  '...ogBBBBBBBBgo...',
  '..ogggbbbbbbgggo..',
  '..ogggggggggggGo..',
  '..oGggGo..oGggGo..',
  '..oGGGGo..oGGGGo..',
  '..occcco..occcco..',
  '..oooooo..oooooo..',
];
const K_DOWN_WALK = [
  '..oGggGo..oGggGo..',
  '..oGGGGo..occcco..',
  '..occcco..oooooo..',
  '..oooooo..........',
];
const K_UP = [
  '.....pp.pp.pp.....',
  '....oPPoPPoPPo....',
  '...oggggggggggo...',
  '..oglgggggggggGo..',
  '..ogggggggggggGo..',
  '..ogggggppggggGo..',
  '..ogggggPPggggGo..',
  '..oGggggppggggGo..',
  '...oGgggPPgggGo...',
  '....oGGGppGGGo....',
  '...oggggPPggggo...',
  '..ogggggppgggggo..',
  '.ocgggggPPgggggco.',
  '.ocGggggppggggGco.',
  '..ooggggPPggggoo..',
  '...oggggppggggo...',
  '...oggggPPggggo...',
  '..oggggggggggggo..',
  '..oGggggggggggGo..',
  '..oGggGoggoGggGo..',
  '..oGGGGoggoGGGGo..',
  '..occccoGGocccco..',
  '..oooooooooooooo..',
];
const K_LEFT = [
  '.........pp.........',
  '......oooPPp........',
  '.....ogglgggo.p.....',
  '....ogggggggGoPp....',
  '...ogeeggggggGoPp...',
  '..hogekggggggGGop...',
  '.hhgggggggggggGoPp..',
  '..ommtgggggggggGop..',
  '...ommmgggggggggoPp.',
  '....oGGgggggggggGop.',
  '.....obbgggggggggoPp',
  '....ocbbbggggggggGop',
  '....ocBBBggggggggGo.',
  '.....obbbgggggggggo.',
  '.....oBBBggggggggggo',
  '......obbgggggggggGo',
  '......oBBgggGoggggGo',
  '.......oggggGo.oGGGo',
  '.......oGGGGo...ooo.',
  '......occcco........',
  '......oooooo........',
];
function tplCanvas(rows, flip = false) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const [cv, c] = makeCanvas(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = KPAL[row[x]];
      if (col) { c.fillStyle = col; c.fillRect(flip ? w - 1 - x : x, y, 1, 1); }
    }
  });
  return cv;
}
let KIMG = null;
function kaijuImg(dir, frame = 0) {
  if (!KIMG) {
    const left = tplCanvas(K_LEFT), right = tplCanvas(K_LEFT, true), up = tplCanvas(K_UP);
    KIMG = {
      down: [tplCanvas(K_DOWN), tplCanvas(K_DOWN.slice(0, 19).concat(K_DOWN_WALK))],
      up: [up, up], left: [left, left], right: [right, right],
    };
  }
  const set = KIMG[dir] || KIMG.down;
  return set[frame ? 1 : 0];
}

const LK = {
  ticket: { hair: 'bob', hairColor: 'black', skin: 'light', top: NAVY, bottom: NAVY, skirt: true, jacket: true, tie: GOLD },
  snack: { hair: 'cap', hat: CRIM_L, hairColor: 'brown', skin: 'light', top: CRIM_L, bottom: NAVY },
  usher: { hair: 'cap', hat: NAVY, hairColor: 'black', skin: 'fair', top: NAVY, bottom: NAVY_D, jacket: true, tie: GOLD },
  guard: { ...LOOKS.guard },
  fan: { ...LOOKS.fan, top: '#5ee07a' },
  kid: { ...LOOKS.kid, hair: 'cap', hat: '#4e9a5a' },
  madam: { ...LOOKS.oldwoman, top: CRIM_L },
  stageDir: { hair: 'long', hairColor: 'black', skin: 'fair', top: '#20232a', bottom: '#20232a', glasses: true, jacket: true, tie: GOLD },
  conductor: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#16161a', bottom: '#16161a', jacket: true, tie: '#ffffff' },
  vocal: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#9273bd', bottom: '#2a2430', skirt: true, glasses: true },
  lead: { hair: 'slick', hairColor: 'brown', skin: 'fair', top: '#f2f2f2', bottom: NAVY, jacket: true, tie: CRIM_L },
  ensemble: { hair: 'long', hairColor: 'blonde', skin: 'light', top: '#ff7eb6', bottom: '#ff7eb6', skirt: true },
  dancer: { hair: 'spiky', hairColor: 'black', skin: 'tan', top: '#5fd7ff', bottom: '#20232a' },
  violin: { hair: 'long', hairColor: 'black', skin: 'light', top: '#16161a', bottom: '#16161a', skirt: true },
  audience: { ...LOOKS.oldman },
  sfxDir: { ...LOOKS.director, hat: NAVY },
  ad: { ...LOOKS.ad },
  cameraman: { ...LOOKS.cameraman },
  art: { ...LOOKS.staff, hat: CRIM_L, top: '#c48a52' },
  light: { ...LOOKS.staff, hat: '#e8c43a', top: '#3b3f48' },
  extra: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ffd23f', bottom: '#3a4a7a', skirt: true },
  suit: { hair: 'short', hairColor: 'black', skin: 'tan', top: '#4e9a5a', bottom: '#4e9a5a' },
  kaiju: { ...LOOKS.kaiju },
  projectionist: { hair: 'cap', hat: '#20232a', hairColor: 'silver', skin: 'fair', top: '#5a4a3a', bottom: '#3b3f48', glasses: true },
  producer: { ...LOOKS.manager, top: NAVY, bottom: NAVY, tie: GOLD },
  coach: { hair: 'short', hairColor: 'silver', skin: 'tan', top: '#8a6a4a', bottom: '#3b3f48', beard: true },
  critic: { hair: 'bob', hairColor: 'black', skin: 'fair', top: '#3d8a5a', bottom: '#3b3f48', glasses: true },
  mc: { ...LOOKS.announcer },
  reporter: { ...LOOKS.cameraman, hat: CRIM_L },
};

function drawKaijuNpc(ctx, x, y, g, e) {
  const fr = e.moving ? Math.floor(e.anim / 10) % 2 : 0;
  F(ctx, x + 1, y + 13, 14, 3, 'rgba(0,0,0,0.25)');
  const img = kaijuImg(e.unmasked ? 'down' : e.dir, e.unmasked ? 0 : fr);
  const bx = Math.round(x + 8 - img.width / 2), by = Math.round(y + 16 - img.height - (fr ? 1 : 0));
  if (!e.unmasked) { ctx.drawImage(img, bx, by); return; }
  // head off: suit body + the actor's own (sweaty) head
  ctx.drawImage(img, 0, 10, img.width, img.height - 10, bx, by + 10, img.width, img.height - 10);
  ctx.drawImage(charSheet(LK.suit).down[0], 0, 0, 16, 11, Math.round(x), by - 1, 16, 11);
  F(ctx, x + 3, by + 9, 10, 2, '#ffffff');
  if (Math.floor(g.frame / 20) % 2) { F(ctx, x + 14, by + 2, 1, 2, '#8fd0ff'); F(ctx, x + 1, by + 4, 1, 2, '#8fd0ff'); }
}

// ---------------------------------------------------------------- props
function goldFrames(list) {
  return (ctx, g, cam) => {
    for (const [x, y, w, h] of list) {
      const px = Math.round(x * TILE - cam.x) - 2, py = Math.round(y * TILE - cam.y) - 2;
      F(ctx, px, py, w * TILE + 4, h * TILE + 4, GOLD_D);
      F(ctx, px + 1, py + 1, w * TILE + 2, h * TILE + 2, GOLD);
      F(ctx, px + 1, py + 1, w * TILE + 2, 1, GOLD_L);
    }
  };
}

function popcornIcon(ctx, x, y) {
  F(ctx, x + 1, y + 3, 6, 6, '#ffffff');
  for (let i = 0; i < 3; i++) F(ctx, x + 1 + i * 2, y + 3, 1, 6, CRIM_L);
  F(ctx, x, y, 8, 3, '#ffe9a8'); F(ctx, x + 1, y - 1, 2, 1, '#ffffff'); F(ctx, x + 5, y - 1, 2, 1, '#ffffff');
}
function sodaIcon(ctx, x, y) {
  F(ctx, x + 1, y + 1, 6, 8, '#5ee07a'); F(ctx, x + 1, y + 1, 6, 1, '#ffffff'); F(ctx, x + 4, y - 2, 1, 3, '#ff7eb6');
}

function boardProp(x, kind) {
  return {
    type: 'prop', x, y: 1, w: 3, h: 2,
    draw(ctx, sx, sy, g) {
      F(ctx, sx + 1, sy + 3, 46, 26, GOLD_D);
      F(ctx, sx + 2, sy + 4, 44, 24, NAVY_DD);
      F(ctx, sx + 2, sy + 4, 44, 1, GOLD);
      const label = kind === 'ticket' ? 'チケット' : '売店';
      text(ctx, label, sx + 24, sy + 5, { size: 10, align: 'center', color: GOLD_L, shadow: null });
      if (kind === 'ticket') {
        for (let i = 0; i < 3; i++) {
          F(ctx, sx + 6, sy + 18 + i * 3, 22, 1, '#8a96c8');
          F(ctx, sx + 32, sy + 18 + i * 3, 10, 1, (Math.floor(g.frame / 40) + i) % 3 === 0 ? '#ffd23f' : '#5ee07a');
        }
      } else {
        popcornIcon(ctx, sx + 8, sy + 18);
        sodaIcon(ctx, sx + 20, sy + 17);
        ctx.drawImage(kaijuImg('down', 0), 0, 0, 18, 10, sx + 30, sy + 17, 18, 10);
      }
    },
  };
}

function posterProp(x, kind, txt) {
  return {
    type: 'prop', x, y: 1, w: 1, h: 2, text: txt,
    draw(ctx, sx, sy, g) {
      F(ctx, sx + 1, sy + 2, 14, 28, GOLD_D);
      F(ctx, sx + 2, sy + 3, 12, 26, GOLD);
      if (kind === 'kaiju') {
        F(ctx, sx + 3, sy + 4, 10, 24, '#14204a');
        F(ctx, sx + 3, sy + 4, 10, 5, CRIM_L); F(ctx, sx + 4, sy + 6, 8, 1, '#ffffff');
        F(ctx, sx + 6, sy + 10, 1, 1, '#f08a2c'); F(ctx, sx + 8, sy + 10, 1, 1, '#f08a2c');
        F(ctx, sx + 5, sy + 11, 6, 5, '#4e9a5a'); F(ctx, sx + 4, sy + 15, 8, 8, '#4e9a5a');
        F(ctx, sx + 6, sy + 16, 4, 6, '#e3e6a6');
        F(ctx, sx + 6, sy + 12, 1, 1, '#ffe36e'); F(ctx, sx + 9, sy + 12, 1, 1, '#ffe36e');
        F(ctx, sx + 3, sy + 21, 2, 7, '#0a1028'); F(ctx, sx + 11, sy + 19, 2, 9, '#0a1028');
        F(ctx, sx + 4, sy + 26, 8, 1, GOLD_L);
      } else {
        F(ctx, sx + 3, sy + 4, 10, 24, CRIM);
        F(ctx, sx + 3, sy + 4, 10, 4, GOLD_L); F(ctx, sx + 4, sy + 5, 8, 1, CRIM_D);
        const tw = Math.floor(g.frame / 30) % 2;
        F(ctx, sx + 4 + tw * 6, sy + 10, 1, 1, '#ffffff'); F(ctx, sx + 10 - tw * 5, sy + 13, 1, 1, '#fff6a8');
        F(ctx, sx + 7, sy + 12, 2, 2, '#ffffff');
        F(ctx, sx + 7, sy + 14, 2, 6, '#ffffff');
        F(ctx, sx + 5, sy + 13, 2, 1, '#ffffff'); F(ctx, sx + 4, sy + 12, 1, 1, '#ffffff');
        F(ctx, sx + 9, sy + 15, 2, 1, '#ffffff'); F(ctx, sx + 11, sy + 14, 1, 1, '#ffffff');
        F(ctx, sx + 6, sy + 20, 4, 2, '#ff7eb6'); F(ctx, sx + 6, sy + 22, 1, 3, '#ffffff'); F(ctx, sx + 9, sy + 22, 1, 3, '#ffffff');
        F(ctx, sx + 4, sy + 26, 8, 1, GOLD_L);
      }
    },
  };
}

const standee = {
  type: 'prop', x: 4, y: 6, w: 1, h: 1,
  text: '大怪獣ガオドンの等身大パネル！\n…にしては、だいぶ小さい。',
  draw(ctx, sx, sy) {
    F(ctx, sx + 2, sy + 13, 12, 3, 'rgba(0,0,0,0.22)');
    F(ctx, sx + 6, sy + 6, 4, 9, '#a07a50');
    ctx.drawImage(kaijuImg('down', 0), Math.round(sx - 1), Math.round(sy - 9));
    F(ctx, sx + 1, sy + 11, 14, 5, GOLD_D); F(ctx, sx + 2, sy + 12, 12, 3, NAVY);
    F(ctx, sx + 4, sy + 13, 8, 1, GOLD_L);
  },
};

// Screening-room screen (12 x 4 tiles at x=2, y=1). The movie draws into its inner rect.
const SCREEN = { x: 2, y: 1, w: 12, h: 4, ix: 6, iy: 4, iw: 180, ih: 54 };
const PROJ = { x: 7, y: 10 };
const screenProp = {
  type: 'prop', x: SCREEN.x, y: SCREEN.y, w: SCREEN.w, h: SCREEN.h,
  text: '大きなスクリーンだ。\n映写技師さんに頼むと、\n新作映画の試写を見せてもらえる。',
  draw(ctx, sx, sy) {
    const w = SCREEN.w * TILE;
    F(ctx, sx, sy + 1, w, 63, '#07080e');
    F(ctx, sx, sy + 1, w, 1, GOLD_D);
    F(ctx, sx + SCREEN.ix, sy + SCREEN.iy, SCREEN.iw, SCREEN.ih, '#d9d7d0');
    F(ctx, sx + SCREEN.ix, sy + SCREEN.iy, SCREEN.iw, 1, '#efede6');
    for (let i = 1; i < 6; i++) F(ctx, sx + SCREEN.ix + i * 30, sy + SCREEN.iy, 1, SCREEN.ih, '#d0cec6');
    ctx.globalAlpha = 0.3;
    drawLogo(ctx, 'toho', sx + SCREEN.ix, sy + SCREEN.iy + 4, SCREEN.iw, SCREEN.ih - 8, {});
    ctx.globalAlpha = 1;
    F(ctx, sx, sy + 59, w, 5, '#15161f'); F(ctx, sx, sy + 59, w, 1, GOLD_D);
  },
};

// ---------------------------------------------------------------- shared FX state
const fx = { spot: 0, spotTarget: 0, spotX: 9.5, spotY: 3.8, flash: 0 };
function resetFx() { fx.spot = 0; fx.spotTarget = 0; fx.flash = 0; }

function drawSpotlight(ctx, g, cam) {
  fx.spot += (fx.spotTarget - fx.spot) * 0.12;
  if (fx.spot < 0.02) { fx.spot = fx.spotTarget ? fx.spot : 0; return; }
  const a = fx.spot * 0.78;
  const cx = Math.round(fx.spotX * TILE - cam.x), cy = Math.round(fx.spotY * TILE - cam.y), rx = 64, ry = 30;
  for (let y = 0; y < H; y += 2) {
    const dy = (y + 1 - cy) / ry;
    ctx.fillStyle = `rgba(4,6,18,${a})`;
    if (Math.abs(dy) >= 1) { ctx.fillRect(0, y, W, 2); continue; }
    const hw = Math.round((rx * Math.sqrt(1 - dy * dy)) / 2) * 2;
    ctx.fillRect(0, y, Math.max(0, cx - hw), 2);
    ctx.fillRect(cx + hw, y, Math.max(0, W - cx - hw), 2);
    ctx.fillStyle = `rgba(255,240,180,${0.1 * fx.spot})`;
    ctx.fillRect(cx - hw, y, hw * 2, 2);
  }
}
function drawFlash(ctx) {
  if (fx.flash > 0.02) {
    ctx.fillStyle = `rgba(255,255,255,${fx.flash * 0.7})`;
    ctx.fillRect(0, 0, W, H);
    fx.flash *= 0.82;
  } else fx.flash = 0;
}

// ---------------------------------------------------------------- helper scenes
// Full-screen caption card (A to continue).
function card(g, lines, frames = 200) {
  return new Promise((resolve) => {
    const sc = {
      opaque: true, t: 0,
      update(gg) {
        sc.t++;
        if (gg.auto || sc.t >= frames || (sc.t > 25 && gg.input.pressed('a'))) { gg.pop(sc); resolve(); }
      },
      draw(ctx) {
        F(ctx, 0, 0, W, H, '#05060d');
        const y0 = Math.round(H / 2 - lines.length * 9);
        lines.forEach((l, i) => text(ctx, g.fmt(l), W / 2, y0 + i * 18, { align: 'center', color: i === 0 ? GOLD_L : '#ffffff' }));
      },
    };
    g.push(sc);
  });
}

// The musical seen from the audience (used when you buy a ticket).
function drawShow(ctx, t, sheets) {
  F(ctx, 0, 0, W, H, '#07080f');
  F(ctx, 24, 18, 272, 150, '#1b2150');
  for (let i = 0; i < 30; i++) {
    if ((t + i * 11) % 50 < 38) F(ctx, 30 + Math.floor(hash2(i, 4, 1) * 260), 36 + Math.floor(hash2(i, 5, 1) * 60), 1, 1, '#fff6c8');
  }
  discF(ctx, 230, 50, 9, '#fff2b0');
  for (let x = 24; x < 296; x += 18) {
    const h = 20 + Math.floor(hash2(x, 3, 2) * 26);
    F(ctx, x, 130 - h, 16, h, '#171a3e');
    for (let y = 134 - h; y < 126; y += 6) if (hash2(x, y, 9) > 0.5) F(ctx, x + 4, y, 2, 2, '#ffd86a');
  }
  F(ctx, 24, 128, 272, 30, '#ddb06e');
  for (let y = 132; y < 158; y += 6) F(ctx, 24, y, 272, 1, '#c49a5c');
  F(ctx, 24, 158, 272, 8, '#5a3a20');
  for (let x = 30; x < 296; x += 12) F(ctx, x, 160, 4, 2, Math.floor(t / 12 + x / 12) % 2 ? '#fff6a8' : '#ff9a3c');
  // spotlights
  ctx.fillStyle = 'rgba(255,245,200,0.10)';
  for (const [cx, ph] of [[110, 0], [210, 2]]) {
    const sw = Math.sin(t / 40 + ph) * 30;
    ctx.beginPath(); ctx.moveTo(cx - 4, 18); ctx.lineTo(cx + 4, 18); ctx.lineTo(cx + sw + 34, 150); ctx.lineTo(cx + sw - 34, 150); ctx.closePath(); ctx.fill();
  }
  // performers (2x)
  const xs = [96, 144, 192];
  sheets.forEach((sh, i) => {
    const beat = Math.floor(t / 15);
    const jump = (beat + i) % 4 === 0 ? 4 : 0;
    const dir = Math.floor(t / 90) % 2 && i !== 1 ? (i === 0 ? 'right' : 'left') : 'down';
    const frame = beat % 2 ? 1 : 2;
    ctx.drawImage((sh[dir] || sh.down)[frame] || sh.down[0], xs[i], 110 - jump, 32, 40);
  });
  // notes
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.8 + i * 40) % 120;
    text(ctx, '♪', 70 + i * 46, 104 - k * 0.6, { size: 12, color: ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a', '#ffffff'][i], shadow: null });
  }
  // curtains & proscenium
  F(ctx, 24, 18, 26, 148, '#a51f2c'); F(ctx, 270, 18, 26, 148, '#a51f2c');
  for (let x = 0; x < 26; x += 6) { F(ctx, 24 + x, 18, 2, 148, '#7a1520'); F(ctx, 270 + x, 18, 2, 148, '#7a1520'); }
  F(ctx, 24, 18, 272, 14, '#7a1520'); F(ctx, 24, 30, 272, 2, GOLD);
  F(ctx, 18, 12, 284, 6, GOLD_D); F(ctx, 18, 12, 6, 156, GOLD_D); F(ctx, 296, 12, 6, 156, GOLD_D);
  // audience
  for (let x = 4; x < W; x += 14) {
    const bob = Math.floor(t / 20 + x) % 7 === 0 ? 1 : 0;
    F(ctx, x + 2, 186 - bob, 10, 9, '#141625'); F(ctx, x, 194, 14, 20, '#141625');
  }
  text(ctx, 'ミュージカル『星降る街のメロディ』', W / 2, 220, { size: 12, align: 'center', color: GOLD_L });
}
function stageShow(g, frames = 330) {
  return new Promise((resolve) => {
    const sheets = [charSheet(LK.ensemble), charSheet(LK.lead), charSheet(LK.dancer)];
    const sc = {
      opaque: true, t: 0,
      update(gg) {
        sc.t++;
        if (sc.t === 1) gg.bgm('toho_musical');
        if (gg.auto || sc.t >= frames || (sc.t > 40 && gg.input.pressed('a'))) { gg.pop(sc); resolve(); }
      },
      draw(ctx) { drawShow(ctx, sc.t, sheets); },
    };
    g.push(sc);
  });
}

// ---------------------------------------------------------------- the movie (drawn into the screen)
const MOVIE_LEN = 760;
const MOVIE_CUTS = [0, 90, 180, 330, 480, 640, MOVIE_LEN];
const MOVIE_SFX = { 2: 'chime', 182: 'drum', 212: 'drum', 242: 'drum', 290: 'buzz', 335: 'whistle', 392: 'hit', 410: 'hit', 545: 'good', 565: 'good', 600: 'snare', 618: 'hit', 636: 'snare', 650: 'success' };

function nightSky(ctx, X, Y, MW, MH, t, n = 18) {
  F(ctx, X, Y, MW, MH, '#151b40');
  F(ctx, X, Y + 24, MW, MH - 24, '#1d2350');
  for (let i = 0; i < n; i++) {
    if ((t + i * 7) % 40 < 30) F(ctx, X + Math.floor(hash2(i, 1, 2) * MW), Y + Math.floor(hash2(i, 2, 2) * 30), 1, 1, '#fff6c8');
  }
}
function mvLogo(ctx, X, Y, MW, MH) {
  F(ctx, X, Y, MW, MH, '#ffffff');
  drawLogo(ctx, 'toho', X, Y + 3, MW, MH - 6, {});
}
function mvTitle(ctx, X, Y, MW, MH, t) {
  nightSky(ctx, X, Y, MW, MH, t, 26);
  const sh = t < 24 ? Math.round((hash2(t, 0, 4) - 0.5) * 4) : 0;
  text(ctx, '大怪獣ガオドン', X + MW / 2 + sh, Y + 10 + sh, { size: 16, align: 'center', color: '#ff9a3c', outline: '#3a0a10' });
  if (t > 30) text(ctx, '〜港町にやってきた巨人〜', X + MW / 2, Y + 36, { size: 10, align: 'center', color: GOLD_L, shadow: null });
}
function mvSea(ctx, X, Y, MW, MH, t) {
  F(ctx, X, Y, MW, MH, '#1a2150'); F(ctx, X, Y + 18, MW, 12, '#232a62'); F(ctx, X, Y + 30, MW, 10, '#2d3474');
  discF(ctx, X + 152, Y + 10, 5, '#fff2b0'); F(ctx, X + 150, Y + 9, 2, 2, '#e8dc98');
  for (const [bx, bh] of [[96, 16], [106, 24], [118, 13], [128, 21], [140, 28], [152, 15], [162, 23], [172, 18]]) {
    F(ctx, X + bx, Y + 40 - bh, 10, bh, '#0d1230');
    for (let y = Y + 42 - bh; y < Y + 38; y += 4) if (hash2(bx, y, 1) > 0.45) F(ctx, X + bx + 3, y, 2, 1, '#ffe9a8');
  }
  const waterY = Y + 40;
  const rise = clamp((t - 15) / 70, 0, 1);
  const kx = X + 26, ky = waterY + 6 - Math.round(rise * 34);
  ctx.drawImage(kaijuImg('down', 0), kx, ky, 36, 46);
  if (t > 95) {
    const on = t % 20 < 14;
    if (on) { F(ctx, kx + 9, ky + 9, 4, 3, '#fff36a'); F(ctx, kx + 23, ky + 9, 4, 3, '#fff36a'); }
  }
  F(ctx, X, waterY, MW, MH - 40, '#1b3a78');
  for (let i = 0; i < 9; i++) F(ctx, X + ((i * 23 + t) % MW), waterY + 3 + (i % 3) * 4, 6, 1, '#5f8fd4');
  if (rise > 0 && rise < 1) for (let i = 0; i < 5; i++) F(ctx, kx + 4 + i * 7, waterY - 1 - ((t + i * 5) % 6), 2, 2, '#bfe6ff');
  if (t > 110) {
    const s = t % 6 < 3 ? 1 : 0;
    text(ctx, 'ガオーン！', X + 70 + s, Y + 12, { size: 12, color: '#ffd23f', outline: '#3a0a10' });
  }
}
function mvPerson(ctx, x, y, i, t, trip) {
  const col = ['#ff7eb6', '#5fd7ff', '#ffd23f', '#5ee07a', '#ffffff', '#ff9a3c'][i % 6];
  if (trip) {
    F(ctx, x, y + 5, 7, 2, col); F(ctx, x - 2, y + 5, 2, 2, '#ffe0c4');
    text(ctx, '!', x + 2, y - 8, { size: 10, color: '#ffffff', shadow: null });
    return;
  }
  F(ctx, x, y, 2, 2, '#ffe0c4');
  F(ctx, x, y + 2, 2, 3, col);
  const leg = Math.floor(t / 4 + i) % 2;
  F(ctx, x - (leg ? 1 : 0), y + 5, 1, 2, '#20232a'); F(ctx, x + 1 + (leg ? 1 : 0), y + 5, 1, 2, '#20232a');
  F(ctx, x - 1, y + 2 + (leg ? 0 : 1), 1, 1, '#ffe0c4');
}
function mvCity(ctx, X, Y, MW, MH, t) {
  F(ctx, X, Y, MW, MH, '#151b40');
  ctx.fillStyle = 'rgba(255,250,210,0.12)';
  for (const [bx, ph] of [[40, 0], [140, 2]]) {
    const sw = Math.sin(t / 25 + ph) * 50;
    ctx.beginPath(); ctx.moveTo(X + bx - 2, Y + MH); ctx.lineTo(X + bx + sw - 9, Y - 4); ctx.lineTo(X + bx + sw + 9, Y - 4); ctx.lineTo(X + bx + 2, Y + MH); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 12; i++) {
    const bh = 16 + Math.floor(hash2(i, 3, 3) * 16);
    F(ctx, X + i * 16, Y + MH - 6 - bh, 14, bh, '#22284e');
    for (let y = Y + MH - 4 - bh; y < Y + MH - 10; y += 4) if (hash2(i, y, 5) > 0.5) F(ctx, X + i * 16 + 4, y, 2, 1, '#8a8a5a');
  }
  const kx = X + MW + 4 - Math.min(t, 110) * 0.9;
  const bob = Math.floor(t / 10) % 2;
  ctx.drawImage(kaijuImg('left', 0), Math.round(kx), Y + MH - 46 - bob, 40, 42);
  for (let i = 0; i < 9; i++) {
    const bh = 8 + Math.floor(hash2(i, 7, 3) * 7);
    const bx = X + i * 22 - 4;
    F(ctx, bx, Y + MH - 6 - bh, 18, bh, '#2e3566');
    for (let x = bx + 3; x < bx + 16; x += 5) F(ctx, x, Y + MH - 4 - bh, 2, 2, '#ffe9a8');
  }
  F(ctx, X, Y + MH - 6, MW, 6, '#3a3d46');
  for (let x = (t * 2) % 16; x < MW; x += 16) F(ctx, X + MW - x, Y + MH - 3, 6, 1, '#d8d8c8');
  for (let i = 0; i < 6; i++) {
    const px = X + MW - ((t * 1.6 + i * 34) % (MW + 30));
    mvPerson(ctx, px, Y + MH - 13, i, t, i === 2 && t > 60 && t < 88);
  }
  if (t < 60) text(ctx, 'にげろ〜！', X + 8, Y + 4, { size: 10, color: '#ffffff', outline: '#000000' });
  if (t > 112) text(ctx, '？', Math.round(kx) + 8, Y + 1, { size: 10, color: '#ffd23f', outline: '#000000' });
}
function mvHero(ctx, X, Y, MW, MH, t, opt) {
  nightSky(ctx, X, Y, MW, MH, t, 20);
  F(ctx, X, Y + 34, 56, MH - 34, '#2a2f55'); F(ctx, X, Y + 34, 56, 1, '#4a5290');
  for (let x = X + 6; x < X + 50; x += 8) F(ctx, x, Y + 40, 3, 3, '#ffe9a8');
  const sheet = charSheet(opt.look || {});
  const wave = t > 10 && Math.floor(t / 12) % 2;
  ctx.drawImage(sheet.right[wave ? 1 : 0], X + 30, Y + 14);
  const sway = t > 70 ? Math.round(Math.sin(t / 8) * 3) : 0;
  ctx.drawImage(kaijuImg('down', 0), X + 116 + sway, Y + MH - 44, 36, 46);
  if (t > 15) {
    for (let i = 0; i < 4; i++) {
      const k = ((t - 15) * 1.2 + i * 18) % 72;
      text(ctx, '♪', X + 46 + k, Y + 16 - Math.sin(k / 10) * 6, { size: 10, color: ['#ffd23f', '#ff7eb6', '#5fd7ff', '#5ee07a'][i], shadow: null });
    }
  }
  if (t > 40 && t < 70) text(ctx, '？', X + 140, Y + 2, { size: 10, color: '#ffffff', outline: '#000000' });
  if (t >= 70) text(ctx, '♥', X + 150 + sway, Y + 4 - ((t - 70) % 30) / 6, { size: 10, color: '#ff7eb6', outline: '#000000' });
  for (let i = 0; i < 3; i++) {
    const ft = t - 88 - i * 18;
    if (ft < 0) continue;
    const age = ft % 54;
    const cx = X + 66 + i * 34, cy = Y + 10 + (i % 2) * 8;
    const rad = Math.min(13, age * 0.6);
    const col = ['#ff7eb6', '#ffd23f', '#5fd7ff'][i];
    if (age < 40) for (let a = 0; a < 12; a++) { const ang = (a / 12) * Math.PI * 2; F(ctx, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.8, 1, 1, col); }
  }
}
function mvEnd(ctx, X, Y, MW, MH, t, opt) {
  F(ctx, X, Y, MW, MH, '#000000');
  text(ctx, '完', X + MW / 2, Y + 4, { size: 24, align: 'center', color: '#ffffff', shadow: null });
  const credit = opt.premiere ? `主演　${opt.name}` : '（試写用フィルム）';
  if (t > 20) text(ctx, credit, X + MW / 2, Y + 36, { size: 10, align: 'center', color: GOLD_L, shadow: null });
}
function movieFrame(ctx, X, Y, MW, MH, t, opt) {
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, MW, MH); ctx.clip();
  if (t < 90) mvLogo(ctx, X, Y, MW, MH);
  else if (t < 180) mvTitle(ctx, X, Y, MW, MH, t - 90);
  else if (t < 330) mvSea(ctx, X, Y, MW, MH, t - 180);
  else if (t < 480) mvCity(ctx, X, Y, MW, MH, t - 330);
  else if (t < 640) mvHero(ctx, X, Y, MW, MH, t - 480, opt);
  else mvEnd(ctx, X, Y, MW, MH, t - 640, opt);
  for (let i = 0; i < 4; i++) {
    F(ctx, X + Math.floor(hash2(t, i, 3) * MW), Y + Math.floor(hash2(i, t, 5) * MH), 1, 1, i % 2 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)');
  }
  if (t % 47 < 4) F(ctx, X + Math.floor(hash2(t >> 2, 9, 1) * MW), Y, 1, MH, 'rgba(255,255,255,0.22)');
  F(ctx, X, Y, MW, MH, `rgba(0,0,0,${(0.03 + hash2(t, 1, 1) * 0.05).toFixed(3)})`);
  let d = 99;
  for (const c of MOVIE_CUTS) d = Math.min(d, Math.abs(t - c));
  if (d < 8) F(ctx, X, Y, MW, MH, `rgba(0,0,0,${((8 - d) / 8).toFixed(3)})`);
  ctx.restore();
}

// Plays the film on the screening-room screen. Lights go down, the projector beam turns on.
function playMovie(g, opt = {}) {
  const o = { premiere: !!opt.premiere, name: g.state.name, look: opt.premiere ? g.state.look || LOOKS.player : LK.lead };
  g.bgm('toho_kaiju');
  return new Promise((resolve) => {
    const sc = {
      t: 0,
      update(gg) {
        sc.t++;
        if (MOVIE_SFX[sc.t]) gg.sfx(MOVIE_SFX[sc.t]);
        const done = gg.auto ? sc.t > 2 : sc.t >= MOVIE_LEN || (sc.t > 45 && (gg.input.pressed('a') || gg.input.pressed('b')));
        if (done) {
          gg.pop(sc);
          gg.bgm(gg.map.room.def.bgm || gg.map.place.bgm);
          resolve();
        }
      },
      draw(ctx, gg) {
        const cam = gg.map.cam;
        const sx = SCREEN.x * TILE - cam.x + SCREEN.ix, sy = SCREEN.y * TILE - cam.y + SCREEN.iy, sw = SCREEN.iw, sh = SCREEN.ih;
        const t = sc.t;
        const a = Math.min(1, t / 20) * (t > MOVIE_LEN - 20 ? Math.max(0, (MOVIE_LEN - t) / 20) : 1);
        ctx.fillStyle = `rgba(2,3,10,${(0.8 * a).toFixed(3)})`;
        ctx.fillRect(0, 0, W, sy); ctx.fillRect(0, sy + sh, W, H - sy - sh);
        ctx.fillRect(0, sy, sx, sh); ctx.fillRect(sx + sw, sy, W - sx - sw, sh);
        const px = PROJ.x * TILE + 8 - cam.x, py = PROJ.y * TILE + 1 - cam.y;
        ctx.fillStyle = `rgba(255,248,220,${(0.08 * a).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(sx + 4, sy + sh); ctx.lineTo(sx + sw - 4, sy + sh); ctx.lineTo(px + 2, py); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const k = ((t * 0.7 + i * 23) % 100) / 100;
          F(ctx, px + (sx + sw / 2 - px) * k + Math.sin(t / 15 + i) * 8, py + (sy + sh - py) * k, 1, 1, 'rgba(255,250,220,0.5)');
        }
        movieFrame(ctx, sx, sy, sw, sh, t, o);
        if (t > 45 && !gg.auto) text(ctx, 'Aでスキップ', W - 8, H - 16, { size: 10, align: 'right', color: COLORS.dim });
      },
    };
    g.push(sc);
  });
}

// ---------------------------------------------------------------- jobs
const JOBS = {
  extra: { id: 'toho_extra', title: '映画のエキストラ', desc: '通行人の役で映画に出演！', client: '助監督', stamina: 15, minigame: 'command', opts: { theme: 'acting', difficulty: 1, rounds: 3 }, pay: 1000, fame: 5, skill: 'engi', gain: 1 },
  citizen: { id: 'toho_citizen', title: '怪獣から逃げまどう市民役', desc: '怪獣に追いかけられる市民の役！', client: '特撮監督', stamina: 20, minigame: 'command', opts: { theme: 'acting', difficulty: 2, rounds: 4 }, pay: 4000, fame: 15, skill: 'engi', gain: 2 },
  suit: { id: 'toho_suit', title: '怪獣のスーツアクター', desc: '怪獣スーツでミニチュアの街を歩く！', client: '特撮監督', stamina: 25, minigame: 'command', opts: { theme: 'kaiju', difficulty: 3, rounds: 5 }, pay: 12000, fame: 45, skill: 'engi', gain: 3, requires: { fame: 250 } },
  ensemble: { id: 'toho_ensemble', title: 'ミュージカルのアンサンブル', desc: '歌って踊って、舞台をいろどる！', client: '演出家', stamina: 25, minigame: 'rhythm', opts: { difficulty: 3, lanes: 2, bpm: 120, length: 48, song: 'toho_musical' }, pay: 10000, fame: 40, skill: 'uta', gain: 3, requires: { fame: 250 } },
  lead: { id: 'toho_musical_lead', title: 'ミュージカル主演', desc: '劇場の真ん中で歌い上げる主役！', client: '演出家', stamina: 30, minigame: 'rhythm', opts: { difficulty: 4, lanes: 4, bpm: 120, length: 64, song: 'toho_musical' }, pay: 30000, fame: 120, skill: 'uta', gain: 4, requires: { fame: 1000 } },
  movie: { id: 'toho_movie_lead', title: '大作映画の主演', desc: '東宝の大作映画で、主役に大抜擢！', client: 'プロデューサー', stamina: 30, minigame: 'command', opts: { theme: 'acting', difficulty: 5, rounds: 6 }, pay: 65000, fame: 220, skill: 'engi', gain: 5, requires: { fame: 2000 } },
};

const sp = (npc) => ({ name: npc.name, look: npc.look });

function resetNpc(g, id) {
  const e = g.npc(id);
  if (!e) return;
  e.path = []; e.pathDone = null; e.moving = false; e.waitT = 0;
  e.x = e.home.x; e.y = e.home.y; e.px = e.x * TILE; e.py = e.y * TILE;
  e.dir = e.def.dir || 'down';
}
function faceNpc(g, id, dir) { const e = g.npc(id); if (e) e.dir = dir; }

async function tier1Ok(g) {
  if (g.state.agency || g.state.fame >= 30) return true;
  await g.say(`このお仕事は、事務所に所属しているか\n知名度★30以上の人にお願いしているんだ。\n（いまは★${g.state.fame}）`);
  await g.say('まずは助監督さんのところで\nエキストラから始めてみよう！');
  return false;
}

// ---------------------------------------------------------------- lobby scripts
async function welcome(g) {
  await g.say('ふかふかのじゅうたんに、金色のかざり。\nここが東宝の劇場ロビーだ！');
  await g.showLogo('toho', '東宝 ― 映画と演劇の殿堂');
  await g.say(['奥の劇場ではミュージカル、\nスタジオでは怪獣映画の撮影…\nワクワクする場所だ！', 'まずはチケット係さんに\n館内の案内を聞いてみよう。']);
}

async function watchShow(g) {
  await g.fadeOut(16);
  const show = stageShow(g);
  await g.fadeIn(16);
  await show;
  g.sfx('applause');
  await g.fadeOut(10);
  g.bgm(g.map.room.def.bgm || g.map.place.bgm);
  await g.fadeIn(10);
  g.addSkill('uta', 1, true);
  g.addSkill('engi', 1, true);
  g.heal(10);
  await g.say('すばらしい舞台だった…！\n歌が1、演技が1上がった。\n感動で体力も少し回復した！');
}

async function ticketTalk(g, npc) {
  const i = await g.ask('いらっしゃいませ。東宝へようこそ！\nご用件をどうぞ。', ['観劇する', '館内の案内', 'やめておく'], sp(npc));
  if (i === 0) {
    if (g.flag('toho_watch_day') === g.state.day) {
      await g.say('本日の公演は、もうご覧いただきましたね。\nまた明日のお越しをお待ちしております！', sp(npc));
      return;
    }
    const j = await g.ask('ただいまミュージカル\n『星降る街のメロディ』上演中です。\nチケットは¥1,500になります。', ['買う', 'やめておく'], sp(npc));
    if (j !== 0) return;
    if (!g.spend(1500)) { await g.say('お金が足りないようですね…。\nまたのお越しをお待ちしています。', sp(npc)); return; }
    g.sfx('coin');
    g.setFlag('toho_watch_day', g.state.day);
    await g.say('ありがとうございます！\nまもなく開演です。どうぞごゆっくり。', sp(npc));
    await watchShow(g);
  } else if (i === 1) {
    await g.say([
      '奥の大きな扉が劇場です。\nミュージカルのお仕事や\n歌のレッスンがありますよ。',
      '左の通路は撮影スタジオ。\n怪獣映画の撮影中で、\nエキストラを募集しています。',
      '右の通路は試写室です。\n映画の試写や演技のレッスン、\nプロデューサーもいますよ。',
      '売店のポップコーンも、ぜひどうぞ！',
    ], sp(npc));
  } else {
    await g.say('ごゆっくりどうぞ。', sp(npc));
  }
}

async function snackTalk(g, npc) {
  const n = await g.shop(['toho_popcorn', 'toho_soda', 'toho_pamphlet', 'toho_sofubi'], { title: '東宝 売店', greeting: 'できたてのポップコーンはいかが？' });
  await g.say(n ? 'ありがとうございました！\n上映中・上演中はお静かにどうぞ♪' : 'またどうぞ〜！\nポップコーンの香り、いいでしょ？', sp(npc));
}

async function kidTalk(g, npc) {
  if (g.hasItem('toho_sofubi')) {
    await g.emote('toho_kid', '♥');
    await g.say('あっ！ガオドンのソフビだ！\nいいなあ〜！おそろいだね！', sp(npc));
    return;
  }
  await g.say(['ガオドンってね、こわい顔してるけど\nほんとはやさしいんだよ！', '売店でソフビ人形を売ってるんだ。\nほしいなあ…。'], sp(npc));
}

async function madamTalk(g, npc) {
  await g.say('ミュージカルはいいわよ〜。\n歌とお芝居とダンスの総合芸術ね。', sp(npc));
  if (g.state.fame < 250) await g.say('舞台に立ちたいなら、まずは歌を磨くこと。\n劇場の歌唱指導の先生がおすすめよ。', sp(npc));
  else if (g.state.fame < 1000) await g.say('主演を張るなら★1000は必要ね。\nそれまではアンサンブルで\n舞台の経験を積むといいわ。', sp(npc));
  else await g.say('あら、あなた最近よく見るわね。\n今度の主演、楽しみにしてるわ！', sp(npc));
}

async function usherTalk(g, npc) {
  await g.say('こちらは劇場の入口です。\nリハーサル中は、\n静かに見学してくださいね。', sp(npc));
  if (g.state.fame < 250) await g.say('舞台のお仕事は★250くらいから。\nまずは歌のレッスンで\n実力をつけるといいですよ。', sp(npc));
  else await g.say('演出家の先生が、\n新しい出演者を探していましたよ！', sp(npc));
}

// ---------------------------------------------------------------- theater scripts
async function rehearsal(g) {
  fx.spotX = 9.5; fx.spotY = 3.9; fx.spotTarget = 1;
  try {
    g.bgm('toho_musical');
    await g.emote('toho_conductor', '♪');
    await g.say('（指揮棒がふられ、\nオーケストラの演奏が始まった！）');
    await Promise.all([g.moveNpc('toho_lead', 'left left', 0.8), g.moveNpc('toho_ensemble', 'right right', 0.8), g.moveNpc('toho_dancer', 'left left', 0.8)]);
    faceNpc(g, 'toho_lead', 'down'); faceNpc(g, 'toho_ensemble', 'down'); faceNpc(g, 'toho_dancer', 'down');
    await Promise.all([g.emote('toho_lead', '♪'), g.emote('toho_ensemble', '♪'), g.emote('toho_dancer', '♪')]);
    await g.say('♪ 星が降る 街かどで〜\n　 きみと 夢を うたおう〜', { name: '主演俳優', look: LK.lead });
    await Promise.all([g.moveNpc('toho_lead', 'right right', 0.8), g.moveNpc('toho_ensemble', 'left left', 0.8), g.moveNpc('toho_dancer', 'right right', 0.8)]);
    faceNpc(g, 'toho_lead', 'down'); faceNpc(g, 'toho_ensemble', 'down'); faceNpc(g, 'toho_dancer', 'down');
    g.sfx('applause');
    await Promise.all([g.emote('toho_audience', '!'), g.emote('player', '♥')]);
  } finally {
    for (const id of ['toho_lead', 'toho_ensemble', 'toho_dancer']) resetNpc(g, id);
    fx.spotTarget = 0;
    g.bgm('theater');
  }
  if (g.flag('toho_rehearsal_day') !== g.state.day) {
    g.setFlag('toho_rehearsal_day', g.state.day);
    g.addSkill('uta', 1, true);
    g.sfx('good');
    await g.say('プロの歌声を間近で聴いた！\n歌が1上がった。（1日1回）');
  } else {
    await g.say('何度見ても、心がおどる…！');
  }
}

async function conductorTalk(g, npc) {
  const i = await g.ask('指揮者です。オーケストラピットから\n舞台を支えています。\nリハーサル、見学していきますか？', ['見学する', 'また今度'], sp(npc));
  if (i !== 0) { await g.say('音楽は、舞台の心臓です。\nまたいつでもどうぞ。', sp(npc)); return; }
  await g.say('では…静かに。\nワン、ツー、スリー…！', sp(npc));
  await rehearsal(g);
}

async function curtainCall(g) {
  await g.fadeOut(16);
  await g.goto('toho', 'theater', 9, 4, 'down', { fade: false });
  fx.spotX = 9.5; fx.spotY = 4.2; fx.spotTarget = 1; fx.spot = 1;
  await g.fadeIn(16);
  g.sfx('applause');
  await g.say('ブラボー！！\n客席から、割れんばかりの拍手！');
  await Promise.all([g.emote('player', '♪'), g.emote('toho_lead', '♥'), g.emote('toho_ensemble', '♥'), g.emote('toho_audience', '!')]);
  g.sfx('applause');
  await g.say('カーテンコールで、深々とおじぎをした。\n…主役って、最高だ！');
  await g.fadeOut(16);
  fx.spotTarget = 0; fx.spot = 0;
  await g.goto('toho', 'theater', 9, 10, 'up', { fade: false });
  await g.fadeIn(16);
}

async function stageDirTalk(g, npc) {
  const i = await g.ask('演出家だ。歌に芝居にダンス…\nミュージカルは総合芸術だよ。\n出演したいのかい？', ['アンサンブル', '主演に挑戦', '話を聞く', 'やめておく'], sp(npc));
  if (i === 0) {
    const r = await g.job(JOBS.ensemble);
    if (r) await g.say('SA'.includes(r.rank) ? 'ブラボー！\n君の歌声、客席の奥まで届いていたよ！' : 'おつかれさま！\n次はもっと声を響かせよう。', sp(npc));
  } else if (i === 1) {
    const r = await g.job(JOBS.lead);
    if (r) {
      await curtainCall(g);
      await g.say('最高の舞台だった！\n君こそ、この劇場の主役だ！', sp(npc));
    }
  } else if (i === 2) {
    await g.say([
      'アンサンブルは★250から、\n主演は★1000から任せている。',
      '歌の力が足りないと思ったら、\nピットにいる歌唱指導の先生に\nレッスンをお願いするといい。',
      '指揮者に頼めば、リハーサルも\n見学できるよ。プロの舞台を見るのも\n大事な勉強だ。',
    ], sp(npc));
  } else {
    await g.say('舞台はいつでも、\n新しい才能を待っているよ。', sp(npc));
  }
}

async function vocalTalk(g, npc) {
  await g.say('歌唱指導の担当よ。\nミュージカルの歌はセリフと同じ。\n気持ちを込めて歌うの！', sp(npc));
  const r = await g.lesson({
    title: 'ミュージカル歌唱', skill: 'uta', price: 4000, stamina: 12, gain: 4,
    minigame: 'rhythm', opts: { difficulty: 1, lanes: 1, bpm: 120, length: 24, song: 'toho_musical' }, teacher: npc.name,
  });
  if (r) await g.say('いい声が出てきたわね！\nその調子よ♪', sp(npc));
}

// ---------------------------------------------------------------- studio scripts
const KAIJU = { name: '怪獣ガオドン', look: LK.kaiju };
const SUIT = { name: 'スーツアクター', look: LK.suit };
const SFXDIR = { name: '特撮監督', look: LK.sfxDir };
const AD = { name: '助監督', look: LK.ad };

async function stomp(g, dirs) {
  for (const d of dirs.split(' ')) {
    await g.moveNpc('toho_kaiju', d, 0.5);
    g.shake(8, 2);
    g.sfx('drum');
  }
}

async function studioIntro(g) {
  await g.emote('player', '!');
  await g.say('「本番いきまーす！」\nスタジオに大きな声がひびいた。');
  await g.say('あっ、ちょうど本番です！\nそこで見ていてくださいね！', AD);
  g.facePlayer('left');
  await g.say('よーい……スタート！', SFXDIR);
  g.sfx('snare');
  try {
    await stomp(g, 'up up up');
    await stomp(g, 'left left left');
    faceNpc(g, 'toho_kaiju', 'down');
    g.shake(30, 3);
    g.sfx('buzz');
    await g.say('ガオオオオーン！！', KAIJU);
    await stomp(g, 'right right right right right right');
    faceNpc(g, 'toho_kaiju', 'down');
    await g.emote('toho_kaiju', '…');
    await g.say('ハ……ハ……\nハックショーーン！！', KAIJU);
    g.shake(24, 4);
    g.sfx('zukko');
    await g.emote('toho_sfxdir', '!');
    await g.say('カーーット！！', SFXDIR);
    await g.say('……今のくしゃみ、\nかわいくて最高だ！採用！！', SFXDIR);
    g.sfx('laugh');
    await stomp(g, 'left left left');
    await stomp(g, 'down down down');
  } finally {
    resetNpc(g, 'toho_kaiju');
  }
  const k = g.npc('toho_kaiju');
  if (k) k.unmasked = true;
  g.sfx('cursor');
  await g.say('ふう〜、中は暑い！\nほこりで鼻がムズムズしちゃって…。', SUIT);
  if (k) k.unmasked = false;
  await g.say('これが特撮の撮影です！\nエキストラはどなたでも参加OK。\n声をかけてくださいね！', AD);
}

async function kaijuTalk(g) {
  const k = g.npc('toho_kaiju');
  await g.say('ガオー！', KAIJU);
  if (k) k.unmasked = true;
  g.sfx('cursor');
  await g.say('ふう〜、ちょっと休憩。\n中はサウナみたいに暑いんですよ。', SUIT);
  if (g.state.fame < 250) await g.say('スーツアクターのお仕事は★250から。\n重たいけど、やりがいがありますよ！', SUIT);
  else await g.say('怪獣は、ゆっくり大きく動くのがコツ。\n監督に声をかければ、\nこのスーツ、着られますよ！', SUIT);
  if (k) k.unmasked = false;
  await g.say('よし、休憩おわり！\nガオーー！', KAIJU);
}

async function adTalk(g, npc) {
  const i = await g.ask('おつかれさまです！助監督です！\nいまエキストラを大募集中なんです！', ['エキストラ', '撮影の流れ', 'やめておく'], sp(npc));
  if (i === 0) {
    const r = await g.job(JOBS.extra);
    if (r) await g.say('おつかれさまでした！\nスクリーンのすみっこに映るかも？', sp(npc));
  } else if (i === 1) {
    await g.say([
      'お芝居のお仕事は、\nコマンド入力のミニゲームです。',
      '表示されたとおりに、\nタイミングよく入力してください！',
      '経験を積んだら、特撮監督に\nもっと大きな役をもらえますよ！',
    ], sp(npc));
  } else {
    await g.say('撮影中は足元のケーブルに\n気をつけてくださいね！', sp(npc));
  }
}

async function sfxDirTalk(g, npc) {
  const i = await g.ask('特撮監督だ！ミニチュアの街と怪獣で、\n夢みたいな画をつくるのが仕事さ。', ['逃げまどう市民役', 'スーツアクター', '特撮の話', 'やめておく'], sp(npc));
  if (i === 0) {
    if (!(await tier1Ok(g))) return;
    const r = await g.job(JOBS.citizen);
    if (r) await g.say('いい逃げっぷりだった！\n画面のすみまで本気だったぞ！', sp(npc));
  } else if (i === 1) {
    const r = await g.job(JOBS.suit);
    if (r) {
      g.shake(16, 2);
      g.sfx('drum');
      await g.say('撮影終了！スーツをぬぐと、\n汗びっしょりだ…！');
      await g.say('ナイス怪獣！\nその一歩一歩に、街がふるえていたぞ！', sp(npc));
    }
  } else if (i === 2) {
    await g.say([
      'ミニチュアの街は、美術スタッフが\nひとつひとつ手作りしているんだ。',
      '大事なのは、怪獣を\n「大きく」見せること。\nカメラの位置がキモなんだよ。',
      '市民役は★30か事務所所属、\nスーツアクターは★250から頼んでいる。',
    ], sp(npc));
  } else {
    await g.say('いい画が撮れたら、\n試写室で見られるぞ！', sp(npc));
  }
}

// ---------------------------------------------------------------- screening-room scripts
async function projTalk(g, npc) {
  const i = await g.ask('映写技師です。新作『大怪獣ガオドン』の\n試写用フィルム、回しましょうか？', ['見る', 'やめておく'], sp(npc));
  if (i !== 0) { await g.say('いつでもどうぞ。\nフィルムの準備はできていますよ。', sp(npc)); return; }
  await g.say('では、上映を始めます。\n…カラカラカラカラ…', sp(npc));
  g.facePlayer('up');
  await playMovie(g, {});
  if (g.flag('toho_preview_day') !== g.state.day) {
    g.setFlag('toho_preview_day', g.state.day);
    g.addSkill('engi', 1, true);
    g.sfx('good');
    await g.say('いい映画だった…！\n映像のお芝居を研究できた。\n演技が1上がった！（1日1回）');
  } else {
    await g.say('何度見ても、いい映画だ…。\nガオドン、かわいい。');
  }
}

async function coachTalk(g, npc) {
  await g.say('演技コーチだ。映画の芝居は、\n目線ひとつ、呼吸ひとつが\nスクリーンに大きく映るんだよ。', sp(npc));
  const r = await g.lesson({
    title: '映画演技', skill: 'engi', price: 4000, stamina: 12, gain: 4,
    minigame: 'command', opts: { theme: 'acting', difficulty: 1, rounds: 3 }, teacher: npc.name,
  });
  if (r) await g.say('うん、目に力が出てきた！\nカメラは正直だからね。', sp(npc));
}

const MC = { name: '司会', look: LK.mc };

async function premiere(g) {
  const first = !g.flag('toho_premiere_done');
  await g.fadeOut(20);
  const c = card(g, ['――そして数か月後。', '', '映画がついに完成！', '完成披露試写会の日がやってきた！']);
  await g.fadeIn(12);
  await c;
  await g.fadeOut(12);
  g.setFlag('toho_premiere_now', true);
  try {
    await g.goto('toho', 'screening', 7, 5, 'down', { fade: false });
    g.bgm('toho_lobby');
    await g.fadeIn(20);
    g.showBanner('完成披露試写会');
    g.sfx('applause');
    g.sfx('shutter');
    fx.flash = 1;
    await Promise.all([g.emote('toho_pfan1', '♥'), g.emote('toho_pfan2', '!'), g.emote('toho_preporter', '!'), g.emote('toho_pfan3', '♥')]);
    await g.say('本日はお集まりいただき、\nありがとうございます！', MC);
    await g.say('それでは主演の{name}さん、\nひとことお願いします！', MC);
    g.sfx('shutter');
    fx.flash = 1;
    const i = await g.ask('（なんて挨拶しよう？）', ['みなさんのおかげです', 'ガオーー！', '……（緊張）']);
    if (i === 0) {
      await g.say('スタッフのみなさん、共演者のみなさん、\nそして見に来てくれたみなさんの\nおかげです！ありがとうございます！', { name: g.state.name, look: g.state.look });
      g.sfx('applause');
      await Promise.all([g.emote('toho_pfan1', '♥'), g.emote('toho_pfan3', '♥')]);
    } else if (i === 1) {
      g.shake(16, 2);
      await g.say('ガオーーーー！！', { name: g.state.name, look: g.state.look });
      g.sfx('laugh');
      await g.say('会場は大爆笑！\n怪獣映画らしい、最高のあいさつだ！');
    } else {
      await g.emote('player', '…');
      await g.say('……………。', { name: g.state.name, look: g.state.look });
      g.sfx('applause');
      await g.say('「がんばれー！」\nあたたかい声援が飛んできた！');
    }
    await g.say('それでは、本編の上映です！\nどうぞお楽しみください！', MC);
    g.facePlayer('up');
    await playMovie(g, { premiere: true });
    g.facePlayer('down');
    g.sfx('applause');
    fx.flash = 1;
    await Promise.all([g.emote('toho_pfan1', '♥'), g.emote('toho_pfan2', '♥'), g.emote('toho_pfan3', '♥'), g.emote('toho_preporter2', '!')]);
    await g.say('会場から、割れんばかりの拍手！\nこの映画、大ヒット間違いなしだ！');
    g.addFame(30);
    if (first) {
      g.setFlag('toho_premiere_done', true);
      g.giveItem('toho_clapper');
      await g.say('記念のカチンコをもらった！\n（もちものから見られるよ）');
    }
    await g.fadeOut(20);
  } finally {
    g.setFlag('toho_premiere_now', false);
    fx.flash = 0;
  }
  await g.goto('toho', 'screening', 11, 5, 'right', { fade: false });
  await g.fadeIn(20);
}

async function producerTalk(g, npc) {
  const f = g.state.fame;
  if (f < 2000) {
    await g.say('プロデューサーだ。\n次の大作映画の主演を探していてね。', sp(npc));
    const tip = f < 30
      ? ['まずはスタジオで\nエキストラから始めるといい。', 'どんなスターも、\n最初は通行人の役だったんだ。']
      : f < 250
        ? ['逃げまどう市民役なら、\n特撮監督が使ってくれるはずだ。', '★250を超えたら、\nスーツアクターや舞台にも挑戦だ！']
        : f < 1000
          ? ['スーツアクターにアンサンブル…\nいい経験を積んでいるね。', '★1000になったら、\n劇場の主演も夢じゃないぞ。']
          : ['劇場の主演、見たよ！\nいい顔をしていた。', 'スターの仲間入りをしたら、\nぜひ私の映画の主演を\nお願いしたい。'];
    await g.say(tip, sp(npc));
    await g.say(`（大作映画の主演には★2000が必要だ。\nいまは★${f}）`);
    return;
  }
  const i = await g.ask('待っていたよ、{name}くん！\n大作映画の主演、\n引き受けてくれないか？', ['主演を引き受ける', '話を聞く', 'やめておく'], sp(npc));
  if (i === 1) {
    await g.say([
      '港町にやってきた大怪獣と、\nひとりの若者が心を通わせる物語さ。',
      '主人公は、怪獣に歌を聴かせて\n街を救うんだ。\n…君にぴったりだろう？',
      '撮影が終わったら、\nここで完成披露試写会を開くよ！',
    ], sp(npc));
    return;
  }
  if (i !== 0) { await g.say('いつでも待っているよ。', sp(npc)); return; }
  const r = await g.job(JOBS.movie);
  if (!r) return;
  await g.say('クランクアップ、おめでとう！\nさあ…次は完成披露試写会だ！', sp(npc));
  await premiere(g);
  await g.say('最高の初日だったね！\n…次回作も、ぜひ君でいきたい！', sp(npc));
}

// ---------------------------------------------------------------- the place
registerPlace({
  id: 'toho',
  name: '東宝',
  kind: 'building',
  bgm: 'toho_lobby',
  start: { room: 'lobby', x: 9, y: 10, dir: 'up' },
  rooms: {
    // ---------------------------------------------------------- ロビー
    lobby: {
      floor: 'toho_marble',
      wall: 'navy',
      bgm: 'toho_lobby',
      tiles: [
        '####################',
        '#UUUUUUUU[]UUUUUUUU#',
        '#LLLLLLLL{}LLLLLLLL#',
        '#P...P...rR...PJ.OP#',
        '#.KkK....rR....SsS.#',
        '#........rR........#',
        '#........rR........#',
        '<........rR........>',
        '#a.......rR.......b#',
        '#.FF.....rR.....FF.#',
        '#P.......rR.......P#',
        '#########MM#########',
      ],
      legend: {
        U: 'toho_wall_hi', L: 'toho_wall_lo',
        '[': 'toho_door_hi_l', ']': 'toho_door_hi_r', '{': 'toho_door_lo_l', '}': 'toho_door_lo_r',
        '<': 'toho_passage_l', '>': 'toho_passage_r',
        r: 'toho_runner_l', R: 'toho_runner_r',
        P: 'plant', K: 'toho_counter', k: 'toho_counter_tix', S: 'toho_counter', s: 'toho_counter_reg',
        O: 'toho_popcorn', J: 'toho_soda', F: 'toho_sofa',
        a: 'toho_signpost_l', b: 'toho_signpost_r',
      },
      warps: [
        { x: 9, y: 11, to: 'exit' },
        { x: 10, y: 11, to: 'exit' },
        { x: 9, y: 2, room: 'theater', tx: 9, ty: 13, dir: 'up' },
        { x: 10, y: 2, room: 'theater', tx: 10, ty: 13, dir: 'up' },
        { x: 0, y: 7, room: 'studio', tx: 18, ty: 11, dir: 'left' },
        { x: 19, y: 7, room: 'screening', tx: 1, ty: 7, dir: 'right' },
      ],
      entities: [
        boardProp(2, 'ticket'),
        boardProp(15, 'snack'),
        posterProp(6, 'kaiju', 'ポスター『大怪獣ガオドン』\n「港町に、やさしい巨人がやってくる！」\n近日公開！'),
        posterProp(13, 'musical', 'ポスター：ミュージカル\n『星降る街のメロディ』\n好評上演中！'),
        { type: 'logo', x: 7, y: 1.1, w: 2, h: 1.8, logo: 'toho', lights: true, text: '東宝のロゴマークだ。\n金色の額縁が、まぶしく光っている！' },
        { type: 'logo', x: 11, y: 1.1, w: 2, h: 1.8, logo: 'toho', lights: true, text: '東宝のロゴマークだ。\n映画も演劇も、このマークから始まる！' },
        standee,
        { type: 'sign', x: 1, y: 8, text: '← 撮影スタジオ（関係者通路）\nただいまエキストラ募集中！' },
        { type: 'sign', x: 18, y: 8, text: '試写室 →\n新作映画の試写をやっています。' },
        { type: 'npc', id: 'toho_ticket', x: 3, y: 3, dir: 'down', look: LK.ticket, name: 'チケット係', talk: ticketTalk },
        { type: 'npc', id: 'toho_snack', x: 16, y: 3, dir: 'down', look: LK.snack, name: '売店スタッフ', talk: snackTalk },
        { type: 'npc', id: 'toho_usher', x: 11, y: 3, dir: 'down', look: LK.usher, name: '案内係', talk: usherTalk },
        {
          type: 'npc', id: 'toho_guard', x: 1, y: 6, dir: 'right', look: LK.guard, name: '警備員',
          text: ['左の通路の先は撮影スタジオです。\nふだんは関係者以外立入禁止ですが…', 'いまはエキストラ募集中！\nどなたでもどうぞ。\n助監督さんに声をかけてくださいね。'],
        },
        {
          type: 'npc', id: 'toho_fan', x: 13, y: 6, dir: 'down', look: LK.fan, name: '映画ファン', wander: 2,
          text: ['新作の怪獣映画、楽しみすぎる！\n…まだ公開前なんだけどね。', '右の通路の試写室で、\nちょっとだけ見せてもらえるんだって！'],
        },
        { type: 'npc', id: 'toho_kid', x: 4, y: 7, dir: 'up', look: LK.kid, name: '男の子', talk: kidTalk },
        { type: 'npc', id: 'toho_madam', x: 4, y: 9, dir: 'left', look: LK.madam, name: '観劇好きのマダム', talk: madamTalk },
      ],
      events: [
        { x: 1, y: 8, w: 18, h: 2, on: 'step', once: 'toho_welcome', run: welcome },
      ],
      drawUnder: goldFrames([[7, 1.1, 2, 1.8], [11, 1.1, 2, 1.8]]),
      onEnter: () => { resetFx(); },
    },

    // ---------------------------------------------------------- 劇場
    theater: {
      floor: 'toho_carpet',
      wall: 'navy',
      bgm: 'theater',
      tiles: [
        '####################',
        '#TTTTTTTTTTTTTTTTTT#',
        '#CBBBBBBBBBBBBBBBBC#',
        '#Cl______________lC#',
        '#C________________C#',
        '#EHEEEEEEEEEEEEEEHE#',
        '#...IYNoNooNoNVI...#',
        '#...IooooooooooI...#',
        '#...RRRRRRRRRRRR...#',
        '#..................#',
        '#..SSSSSS..SSSSSS..#',
        '#..SSSSSS..SSSSSS..#',
        '#..SSSSSS..SSSSSS..#',
        '#..................#',
        '#########MM#########',
      ],
      legend: {
        T: 'curtain_top', C: 'curtain', B: 'toho_backdrop', _: 'floor_stage', l: 'floor_stage+toho_lamp',
        E: 'stage_edge', H: 'toho_stairs',
        o: 'toho_pit', Y: 'toho_pit+piano', N: 'toho_pit+toho_stand', V: 'toho_pit+toho_timpani',
        I: 'toho_pit_side', R: 'toho_pit_rail', S: 'seat', M: 'exit_mat',
      },
      warps: [
        { x: 9, y: 14, room: 'lobby', tx: 9, ty: 3, dir: 'down' },
        { x: 10, y: 14, room: 'lobby', tx: 10, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 9, y: 1.15, w: 2, h: 1.7, logo: 'toho', text: '舞台の上に、東宝のマークが輝いている。\nここは夢の劇場だ！' },
        { type: 'npc', id: 'toho_stagedir', x: 9, y: 9, dir: 'up', look: LK.stageDir, name: '演出家', talk: stageDirTalk },
        { type: 'npc', id: 'toho_conductor', x: 10, y: 7, dir: 'up', look: LK.conductor, name: '指揮者', talk: conductorTalk },
        { type: 'npc', id: 'toho_vocal', x: 5, y: 7, dir: 'up', look: LK.vocal, name: '歌唱指導の先生', talk: vocalTalk },
        {
          type: 'npc', id: 'toho_violin', x: 13, y: 7, dir: 'up', look: LK.violin, name: 'バイオリン奏者',
          text: ['♪〜（バイオリンの音合わせをしている）', 'ピットの中からは舞台が見えないけど、\n指揮者の先生を見ていれば\nだいじょうぶなんです。'],
        },
        {
          type: 'npc', id: 'toho_lead', x: 9, y: 3, dir: 'down', look: LK.lead, name: '主演俳優',
          text: ['やあ、舞台の上へようこそ。\nここから見る客席は格別だろう？', 'リズムに乗るコツは、\n音をよく聴いて、体で感じること！'],
        },
        {
          type: 'npc', id: 'toho_ensemble', x: 6, y: 4, dir: 'down', look: LK.ensemble, name: 'アンサンブル',
          text: ['アンサンブルは、みんなで\n舞台をいろどる大切な役なの。', '★250を超えたら、\n客席にいる演出家の先生に\n声をかけてみて！'],
        },
        {
          type: 'npc', id: 'toho_dancer', x: 13, y: 4, dir: 'down', look: LK.dancer, name: 'ダンサー',
          text: ['ワン、ツー、スリー、フォー！\n…よし、今日もキレてる！', '体力がないと、ダンスはもたないよ。\n売店のポップコーンで\nエネルギー補給だ！'],
        },
        {
          type: 'npc', id: 'toho_audience', x: 2, y: 11, dir: 'up', look: LK.audience, name: '常連のおじいさん',
          text: ['リハーサルを見るのが\nわしの楽しみでな。', '指揮者の先生に頼むと、\n見学させてもらえるぞい。'],
        },
      ],
      drawUnder: goldFrames([[9, 1.15, 2, 1.7]]),
      drawOver: drawSpotlight,
      onEnter: () => { resetFx(); },
    },

    // ---------------------------------------------------------- 怪獣映画スタジオ
    studio: {
      floor: 'floor_studio',
      wall: 'dark',
      bgm: 'toho_kaiju',
      tiles: [
        '####################',
        '#KKKKKKKKKKKKKUUUUU#',
        '#kkkkkkkkkkkkkOLLLL#',
        '#BBBtBB|BBBBBe.mmHX#',
        '#hThBhB|BhTBhe.....#',
        '#------+-----e...W.#',
        '#BhBThB|hBhBTe..b..#',
        '#~~~hBh|BTBhBe.....#',
        '#~~~~~h|BhBBhe.....#',
        '#EEEEEEEEEEEEE.....#',
        '#Z..C.....C.Z.F....#',
        '#.......Q..........>',
        '#..................#',
        '#..................#',
        '####################',
      ],
      legend: {
        K: 'toho_sky_hi', k: 'toho_sky_lo', U: 'toho_swall_hi', L: 'toho_swall_lo',
        '-': 'toho_mini_road', '|': 'toho_mini_road_v', '+': 'toho_mini_cross',
        B: 'toho_mini_ground+toho_mini_bldg', h: 'toho_mini_ground+toho_mini_house', T: 'toho_mini_ground+toho_mini_trees',
        t: 'toho_mini_ground+toho_mini_tower', '~': 'toho_mini_sea',
        E: 'toho_set_edge', e: 'toho_set_side',
        C: 'toho_film_cam', Q: 'director_chair', Z: 'spotlight', F: 'toho_windfan', m: 'monitor',
        O: 'toho_swall_lo+onair', H: 'toho_kaiju_head', W: 'toho_workbench', X: 'clothes_rack', b: 'boxes', '>': 'toho_passage_studio',
      },
      warps: [{ x: 19, y: 11, room: 'lobby', tx: 1, ty: 7, dir: 'right' }],
      entities: [
        { type: 'sign', x: 17, y: 3, text: '予備の怪獣の頭だ。\n…目が合った気がする。' },
        { type: 'sign', x: 14, y: 2, text: '赤い「本番中」ランプだ。\n光っているときは、息をひそめよう。' },
        { type: 'sign', x: 2, y: 8, text: 'ミニチュアの港。\n水を張ったプールに、小さな波が立っている。' },
        { type: 'npc', id: 'toho_kaiju', x: 7, y: 8, dir: 'down', look: LK.kaiju, name: '怪獣ガオドン', sprite: drawKaijuNpc, talk: kaijuTalk },
        { type: 'npc', id: 'toho_sfxdir', x: 9, y: 11, dir: 'up', look: LK.sfxDir, name: '特撮監督', talk: sfxDirTalk },
        { type: 'npc', id: 'toho_ad', x: 16, y: 12, dir: 'left', look: LK.ad, name: '助監督', talk: adTalk },
        {
          type: 'npc', id: 'toho_cameraman', x: 4, y: 11, dir: 'up', look: LK.cameraman, name: 'カメラマン',
          text: ['カメラを低〜く構えると、\n小さな街もビルの谷間みたいに\n見えるんだ。', '試写室でフィルムを見ると、\n本物の街にしか見えないよ！'],
        },
        {
          type: 'npc', id: 'toho_art', x: 17, y: 4, dir: 'down', look: LK.art, name: '美術スタッフ',
          text: ['この街は、ぜんぶ手作りなんだ。\n窓のひとつひとつまで\nこだわってるよ。', 'ビルの屋上の小さな看板まで\n描きこんであるんだ。\nよーく見てごらん。'],
        },
        {
          type: 'npc', id: 'toho_light', x: 12, y: 11, dir: 'up', look: LK.light, name: '照明スタッフ',
          text: ['ライトの当て方ひとつで、\n怪獣はこわくも、かわいくも\n見えるんだよ。'],
        },
        {
          type: 'npc', id: 'toho_extra', x: 14, y: 13, dir: 'up', look: LK.extra, name: '新人エキストラ', wander: 2,
          text: ['わたしもエキストラから始めたの！\n通行人の役でも、全力で歩くのよ！', 'お仕事のあとは、\nロビーのポップコーンでひと休み♪'],
        },
      ],
      events: [
        { x: 17, y: 10, h: 4, on: 'step', once: 'toho_studio_intro', run: studioIntro },
      ],
      onEnter: () => { resetFx(); },
    },

    // ---------------------------------------------------------- 試写室
    screening: {
      floor: 'toho_carpet_navy',
      wall: 'navy',
      bgm: 'night',
      tiles: [
        '################',
        '#==============#',
        '#ZXXXXXXXXXXXXZ#',
        '#.XXXXXXXXXXXX.#',
        '#.XXXXXXXXXXXX.#',
        '#..............#',
        '#.QQQQQ..QQQQQ.#',
        '<..............#',
        '#.QQQQQ..QQQQQ.#',
        '#..............#',
        '#P.....J......P#',
        '################',
      ],
      legend: {
        '=': 'toho_wall_lo', X: 'toho_stage_dark', Z: 'speaker', Q: 'toho_recliner', J: 'toho_projector',
        '<': 'toho_passage_l', P: 'plant',
      },
      warps: [{ x: 0, y: 7, room: 'lobby', tx: 18, ty: 7, dir: 'left' }],
      entities: [
        screenProp,
        { type: 'sign', x: 7, y: 10, text: '35ミリの映写機だ。\nフィルムのリールが、カラカラと回る。' },
        { type: 'npc', id: 'toho_proj', x: 8, y: 10, dir: 'up', look: LK.projectionist, name: '映写技師', talk: projTalk },
        { type: 'npc', id: 'toho_producer', x: 12, y: 5, dir: 'down', look: LK.producer, name: 'プロデューサー', talk: producerTalk },
        { type: 'npc', id: 'toho_coach', x: 3, y: 5, dir: 'down', look: LK.coach, name: '演技コーチ', talk: coachTalk },
        {
          type: 'npc', id: 'toho_critic', x: 14, y: 9, dir: 'left', look: LK.critic, name: '映画評論家',
          text: ['怪獣映画は、日本が世界に誇る\n大切な文化だと思っているよ。', '演技の幅を広げたいなら、\n東映の撮影所で時代劇に挑戦するのも\nいいね。殺陣は奥が深い！'],
        },
        // 完成披露試写会の間だけ現れる人たち
        { type: 'npc', id: 'toho_mc', x: 9, y: 5, dir: 'down', look: LK.mc, name: '司会', cond: (g) => !!g.flag('toho_premiere_now'), text: '本日はおめでとうございます！' },
        { type: 'npc', id: 'toho_pfan1', x: 2, y: 7, dir: 'up', look: LOOKS.fan, name: 'ファン', cond: (g) => !!g.flag('toho_premiere_now'), text: 'キャー！こっち向いてー！' },
        { type: 'npc', id: 'toho_pfan2', x: 5, y: 7, dir: 'up', look: LOOKS.idol, name: 'ファン', cond: (g) => !!g.flag('toho_premiere_now'), text: '主演、おめでとう！' },
        { type: 'npc', id: 'toho_preporter', x: 11, y: 7, dir: 'up', look: LK.reporter, name: '記者', cond: (g) => !!g.flag('toho_premiere_now'), text: '一枚おねがいします！' },
        { type: 'npc', id: 'toho_pfan3', x: 13, y: 7, dir: 'up', look: LOOKS.mom, name: 'ファン', cond: (g) => !!g.flag('toho_premiere_now'), text: '家族みんなで見に来ました！' },
        { type: 'npc', id: 'toho_preporter2', x: 7, y: 9, dir: 'up', look: LOOKS.cameraman, name: 'カメラマン', cond: (g) => !!g.flag('toho_premiere_now'), text: 'いい笑顔、いただきました！' },
      ],
      drawOver: (ctx) => drawFlash(ctx),
      onEnter: () => { resetFx(); },
    },
  },
});
