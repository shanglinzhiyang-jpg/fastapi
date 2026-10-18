// NHK放送センター（東京エリア）
//
// 部屋：エントランスホール(lobby) / スタジオ棟の廊下(corridor) / ニューススタジオ(news) /
//       クイズスタジオ(quiz) / こども番組スタジオ(kids) / ドラマスタジオ(drama) /
//       放送の歴史ギャラリー(gallery) / NHKホール(hall) / 楽屋(backstage)
//
// できること（段階）：
//   ★0   スタジオ見学ツアー（1日1回・無料・トーク+1）、クイズ番組の一般予選、アナウンサー体験、
//        合唱リハーサル見学、楽屋の差し入れ弁当、売店、滑舌レッスン、殺陣の稽古
//   ★30 or 所属   こども番組の うたのおにいさん・おねえさん（rhythm d1 / 1レーン）
//   ★250  ニュース原稿読み（announce d3）、クイズ番組の解答者（quiz d3）
//   ★1000 朝の連続ドラマに出演（command acting d4）
//   ★2000 日曜夜の歴史ドラマで主演（command tate d5）
//   ★4000 年末の大型歌番組（大きな節目のお祝い。エンディングはなく、芸能人生はそのまま続く）。
//        その後は凱旋コンサートを何度でも。

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet, drawChar, charSheetHD } from '../engine/sprites.js';
import { defineTile, R as TR, P as TP, speckle, pix } from '../engine/tiles.js';
import { registerItem, FINALE_FAME, nextRank, rankName } from '../engine/state.js';
import { ACTIVITY } from '../engine/life.js';
import { registerSong } from '../engine/audio.js';
import { text, measure } from '../engine/draw.js';
import { drawLogo } from '../engine/logos.js';
import { programDesk, programsAt, eraKey } from '../world/programs.js';
import { W, H, SW, SH, shade, mix, hash2 } from '../engine/util.js';

// ====================================================================== shared state (not saved)
const TOUR = { on: false, stop: '' };
const SHOW = { on: false, phase: '', t0: 0 };

const today = (g, k) => g.flag(k) === g.state.day;
const markToday = (g, k) => g.setFlag(k, g.state.day);
const finalePending = (g) => !!g.flag('finaleInvited') && !g.flag('finaleDone');

// Fame reached the finale line while the engine's phone call has not happened yet.
function ensureInvite(g) {
  if (!g.flag('finaleInvited') && !g.flag('finaleDone') && g.state.fame >= FINALE_FAME) {
    g.setFlag('finaleInvited', true);
    return true;
  }
  return false;
}

// Rounded fillRect for entity drawing on the main canvas.
function F(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function disc(c, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) TP(c, cx + x, cy + y, col);
}
function shadow(c, cx, cy, rx) {
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(cx - rx, cy, rx * 2, 1);
  c.fillRect(cx - rx + 2, cy - 1, rx * 2 - 4, 1);
}

// ====================================================================== items & songs
registerItem('nhk_lokeben', { name: 'ロケ弁', price: 600, desc: 'テレビ局おなじみのお弁当。体力が45回復する。', heal: 45 });

registerSong('nhk_gala', {
  bpm: 132, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.045, notes: 'C5 . E5 . G5 . C6 . | B5 . G5 . E5 . G5 . | A5 . F5 . C5 . F5 . | G5 - - . . . . . | E5 . G5 . C6 . E6 . | D6 . B5 . G5 . B5 . | C6 . A5 . F5 . A5 . | C6 - - - . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | G2 . D3 . G2 . D3 . | F2 . C3 . F2 . C3 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.09, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});
registerSong('nhk_kids', {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'C5 . D5 . E5 . C5 . | E5 . F5 . G5 - - . | A5 . G5 . F5 . E5 . | D5 . E5 . C5 - - . | G4 . C5 . E5 . G5 . | A5 . G5 . E5 . C5 . | F5 . E5 . D5 . G4 . | C5 - - - . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'C3 . G3 . C3 . G3 . | C3 . G3 . E3 . G3 . | F2 . C3 . F2 . C3 . | G2 . D3 . C3 . G2 . | C3 . G3 . C3 . G3 . | F2 . C3 . A2 . C3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.06, notes: 'k . h . s . h . | k . h . s . h h' },
  ],
});

// ====================================================================== tiles
// --- walls / floors (cool white & NHK blue)
defineTile('nhk_walltop', { solid: true, draw(c) { TR(c, 0, 0, 16, 16, '#25314d'); TR(c, 0, 0, 16, 1, '#2f3d5e'); TR(c, 0, 15, 16, 1, '#6b7ca0'); } });
defineTile('nhk_wall_hi', { solid: true, draw(c) { TR(c, 0, 0, 16, 16, '#eef2f8'); TR(c, 0, 0, 16, 1, '#ffffff'); TR(c, 0, 8, 16, 1, '#e2e8f1'); } });
defineTile('nhk_wall', {
  solid: true,
  draw(c) {
    TR(c, 0, 0, 16, 16, '#eef2f8'); TR(c, 0, 0, 16, 1, '#ffffff'); TR(c, 0, 6, 16, 1, '#e2e8f1');
    TR(c, 0, 9, 16, 2, '#3a6fd8'); TR(c, 0, 11, 16, 2, '#e8edf5');
    TR(c, 0, 13, 16, 3, '#2a3f6e'); TR(c, 0, 13, 16, 1, '#1d2c50');
  },
});
defineTile('nhk_floor', {
  draw(c) {
    TR(c, 0, 0, 16, 16, '#e8edf4'); TR(c, 0, 0, 16, 1, '#d2dae6'); TR(c, 0, 0, 1, 16, '#d2dae6');
    TR(c, 3, 3, 4, 1, '#f8fafd'); TR(c, 3, 4, 1, 2, '#f8fafd');
  },
});
defineTile('nhk_runner', {
  draw(c, r) {
    TR(c, 0, 0, 16, 16, '#2a4a8a'); speckle(c, r, ['#24427c', '#33549a'], 18);
    TR(c, 0, 0, 16, 1, '#3a5ca0');
  },
});
defineTile('nhk_studio_floor', {
  variants: 16,
  draw(c, r, f, v) {
    TR(c, 0, 0, 16, 16, '#2e3038'); speckle(c, r, ['#34363f', '#292b32'], 14);
    TR(c, 0, 0, 16, 1, '#33353e');
    if (v === 0) { TR(c, 4, 7, 6, 1, '#e8c43a'); TR(c, 6, 5, 1, 5, '#e8c43a'); }
    if (v === 1) { TR(c, 3, 9, 4, 1, '#5fd7ff'); TR(c, 3, 9, 1, 3, '#5fd7ff'); }
  },
});
defineTile('nhk_mat', {
  draw(c) {
    TR(c, 0, 0, 16, 16, '#1d2c50'); TR(c, 1, 1, 14, 14, '#2f5fb8');
    for (let y = 3; y < 14; y += 3) TR(c, 2, y, 12, 1, '#4f86e0');
  },
});

// --- news studio
defineTile('nhk_news_wall', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    for (let y = 0; y < 16; y++) TR(c, 0, y, 16, 1, mix('#12285e', '#2b5cb8', y / 15));
    TR(c, 0, 3, 16, 1, '#5f8fe0');
    const sets = [
      [[0, 6, 3], [3, 9, 4], [7, 5, 3], [10, 11, 4], [14, 7, 2]],
      [[0, 10, 3], [3, 6, 3], [6, 12, 4], [10, 7, 3], [13, 9, 3]],
      [[0, 7, 4], [4, 11, 3], [7, 8, 2], [9, 6, 4], [13, 10, 3]],
    ][v];
    for (const [x, h, w] of sets) {
      TR(c, x, 16 - h, w, h, '#0c1c48');
      for (let yy = 16 - h + 2; yy < 15; yy += 2) for (let xx = x + 1; xx < x + w; xx += 2) if (r() < 0.5) TP(c, xx, yy, '#ffe9a8');
    }
    TR(c, 0, 15, 16, 1, '#0a1638');
  },
});
function newsDesk(part) {
  return (c) => {
    const x0 = part === 'l' ? 2 : 0;
    const x1 = part === 'r' ? 14 : 16;
    const w = x1 - x0;
    shadow(c, 8, 15, 8);
    TR(c, x0, 3, w, 4, '#dfe6f0'); TR(c, x0, 3, w, 1, '#ffffff');
    TR(c, x0, 7, w, 8, '#f4f6fa'); TR(c, x0, 7, w, 1, '#b8c2d4');
    TR(c, x0, 10, w, 2, '#2f6fd0'); TR(c, x0, 12, w, 1, '#8fb4ee');
    TR(c, x0, 14, w, 1, '#9aa6ba');
    if (part === 'l') TR(c, 1, 4, 1, 10, '#c3cbd8');
    if (part === 'r') TR(c, 14, 4, 1, 10, '#c3cbd8');
    if (part === 'p') {
      TR(c, 3, 4, 6, 2, '#ffffff'); TR(c, 4, 4, 4, 1, '#c3c6ce');
      TR(c, 11, 1, 1, 4, '#3b3f48'); TR(c, 10, 0, 3, 2, '#20232a');
    }
  };
}
for (const p of ['l', 'm', 'p', 'r']) defineTile('nhk_desk_' + p, { solid: true, obj: true, talkThrough: true, draw: newsDesk(p) });

function pedestalCam(c, prompter) {
  shadow(c, 8, 15, 6);
  TR(c, 3, 13, 10, 2, '#3b3f48'); TR(c, 4, 12, 8, 1, '#5a5f6b');
  TR(c, 7, 8, 2, 5, '#7d8391');
  TR(c, 3, 2, 10, 7, '#2e3038'); TR(c, 4, 3, 8, 5, '#454a56');
  TR(c, 5, 5, 6, 3, '#5fd7ff'); TR(c, 5, 5, 2, 1, '#c8f0ff');
  TR(c, 0, 6, 3, 1, '#9aa0aa'); TR(c, 13, 6, 3, 1, '#9aa0aa');
  if (prompter) {
    TR(c, 3, 0, 10, 3, '#20232a'); TR(c, 4, 0, 8, 2, '#8fd0ff'); TR(c, 5, 0, 5, 1, '#ffffff');
  } else {
    TR(c, 5, 0, 6, 3, '#1a1c22'); TR(c, 6, 0, 4, 1, '#3b3f48');
  }
  TP(c, 12, 3, '#ff2b3a');
}
defineTile('nhk_cam', { solid: true, obj: true, draw(c) { pedestalCam(c, false); } });
defineTile('nhk_prompter', { solid: true, obj: true, draw(c) { pedestalCam(c, true); } });
defineTile('nhk_subcon', {
  solid: true, obj: true, frames: 2, speed: 30,
  draw(c, r, f) {
    TR(c, 1, 2, 14, 10, '#c3cbd8'); TR(c, 2, 3, 12, 8, '#141b30');
    TR(c, 3, 4, 3, 2, '#5fd7ff'); TR(c, 7, 4, 3, 2, f ? '#5ee07a' : '#2f9a4a'); TR(c, 11, 4, 2, 2, '#ffd23f');
    TR(c, 4, 7, 2, 2, '#3a4668'); TR(c, 9, 7, 2, 2, '#3a4668');
    TR(c, 2, 9, 12, 2, '#2e3a5a');
    for (let x = 3; x < 14; x += 2) TP(c, x, 9, (x + f) % 4 ? '#ff5d6c' : '#5ee07a');
    TR(c, 2, 3, 3, 1, '#4a5578');
  },
});

// --- quiz studio
defineTile('nhk_lights', {
  solid: true, obj: true, frames: 4, speed: 12,
  draw(c, r, f) {
    TR(c, 0, 3, 16, 8, '#20232a'); TR(c, 0, 3, 16, 1, '#3b3f48');
    const cols = ['#ff5d6c', '#ffd23f', '#5fd7ff', '#5ee07a'];
    for (let i = 0; i < 4; i++) {
      const on = (i + f) % 4 === 0;
      TR(c, 1 + i * 4, 5, 2, 4, on ? '#ffffff' : cols[i]);
      if (on) { TP(c, i * 4, 6, cols[i]); TP(c, 3 + i * 4, 6, cols[i]); }
    }
  },
});
for (const [k, col] of [['r', '#e0443e'], ['b', '#2f6fd0'], ['y', '#e8b52a'], ['g', '#2f9a4a']]) {
  defineTile('nhk_booth_' + k, {
    solid: true, obj: true, talkThrough: true,
    draw(c) {
      shadow(c, 8, 15, 7);
      TR(c, 1, 4, 14, 3, '#e8ecf2'); TR(c, 1, 4, 14, 1, '#ffffff');
      TR(c, 1, 7, 14, 8, col); TR(c, 1, 7, 14, 1, shade(col, 0.35)); TR(c, 1, 14, 14, 1, shade(col, -0.4));
      TR(c, 4, 9, 8, 3, '#ffffff'); TR(c, 5, 10, 6, 1, '#9aa0aa');
      TR(c, 6, 2, 4, 3, '#b01e28'); TR(c, 6, 2, 4, 1, '#ff6b78');
    },
  });
}
defineTile('nhk_podium', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadow(c, 8, 15, 6);
    TR(c, 3, 5, 10, 10, '#1d2f5e'); TR(c, 3, 5, 10, 2, '#e8ecf2');
    TR(c, 5, 9, 6, 3, '#ffd23f'); TR(c, 6, 10, 4, 1, '#e8a52a');
    TR(c, 10, 1, 1, 5, '#9aa0aa'); TR(c, 9, 0, 3, 2, '#3b3f48');
  },
});
defineTile('nhk_quiz_floor', {
  variants: 4,
  draw(c, r, f, v) {
    TR(c, 0, 0, 16, 16, '#232a5c'); TR(c, 0, 0, 16, 1, '#2d3570'); TR(c, 0, 0, 1, 16, '#2d3570');
    if (v === 0) { TP(c, 8, 8, '#bfe6ff'); TP(c, 7, 8, '#5f7fd0'); TP(c, 9, 8, '#5f7fd0'); TP(c, 8, 7, '#5f7fd0'); TP(c, 8, 9, '#5f7fd0'); }
    if (v === 2) TP(c, 4, 11, '#5f7fd0');
  },
});

// --- kids studio
defineTile('nhk_kids_wall', {
  solid: true, variants: 3,
  draw(c, r, f, v) {
    TR(c, 0, 0, 16, 16, '#9ad8ff'); TR(c, 0, 0, 16, 4, '#86ccf8');
    if (v === 0) { TR(c, 3, 6, 9, 3, '#ffffff'); TR(c, 5, 5, 5, 1, '#ffffff'); }
    if (v === 1) { TR(c, 6, 3, 7, 2, '#ffffff'); TR(c, 8, 2, 3, 1, '#ffffff'); }
    if (v === 2) { TP(c, 4, 6, '#3b3f48'); TP(c, 5, 5, '#3b3f48'); TP(c, 6, 6, '#3b3f48'); TP(c, 7, 5, '#3b3f48'); TP(c, 8, 6, '#3b3f48'); }
    TR(c, 0, 12, 16, 4, '#6cc35a'); TR(c, 0, 12, 16, 1, '#8ad87a');
    for (let x = 1; x < 16; x += 4) TP(c, x, 11, '#6cc35a');
  },
});
defineTile('nhk_kids_mat', {
  variants: 4,
  draw(c, r, f, v) {
    const col = ['#ffd96a', '#ffb3cf', '#a8e2ff', '#b8eea0'][v];
    const d = shade(col, -0.12);
    TR(c, 0, 0, 16, 16, col); TR(c, 0, 0, 16, 1, d); TR(c, 0, 0, 1, 16, d);
    TR(c, 6, 1, 4, 2, d); TR(c, 1, 6, 2, 4, d);
  },
});
defineTile('nhk_kids_sun', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 15, 4);
    TR(c, 7, 11, 2, 4, '#a07a56'); TR(c, 4, 14, 8, 1, '#8a5a33');
    for (const [x, y] of [[8, 0], [8, 12], [1, 6], [15, 6], [3, 1], [13, 1], [3, 11], [13, 11]]) TR(c, x - 1, y - (y === 12 ? 1 : 0), 2, 2, '#ff9a3c');
    disc(c, 8, 6, 5, '#ff9a3c'); disc(c, 8, 6, 4, '#ffd23f');
    TP(c, 6, 5, '#20232a'); TP(c, 10, 5, '#20232a');
    TR(c, 6, 8, 5, 1, '#d6455a'); TP(c, 5, 7, '#ff9ab8'); TP(c, 11, 7, '#ff9ab8');
  },
});
defineTile('nhk_kids_tree', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 15, 5);
    TR(c, 7, 9, 2, 6, '#a0683a'); TR(c, 4, 14, 8, 1, '#8a5a33');
    disc(c, 8, 6, 6, '#3f9a4a'); disc(c, 8, 5, 5, '#5ec26a');
    TP(c, 5, 3, '#8ae09a'); TP(c, 6, 2, '#8ae09a');
    TP(c, 10, 6, '#ff5d6c'); TP(c, 6, 8, '#ff5d6c'); TP(c, 11, 3, '#ff5d6c');
  },
});

// --- drama studio (sets)
defineTile('nhk_shoji', {
  solid: true,
  draw(c) {
    TR(c, 0, 0, 16, 16, '#7a5532'); TR(c, 1, 1, 14, 11, '#f7f2e2');
    for (const x of [5, 10]) TR(c, x, 1, 1, 11, '#a8845a');
    for (const y of [4, 8]) TR(c, 1, y, 14, 1, '#a8845a');
    TR(c, 0, 12, 16, 4, '#5a3a20'); TR(c, 0, 12, 16, 1, '#8a6040');
  },
});
defineTile('nhk_fusuma', {
  solid: true, variants: 2,
  draw(c, r, f, v) {
    TR(c, 0, 0, 16, 16, '#5a3a18'); TR(c, 1, 1, 14, 14, '#e2bd56');
    speckle(c, r, ['#f0d27a', '#d4ac44'], 14, 1, 1, 14, 14);
    if (v === 0) {
      TR(c, 2, 9, 10, 1, '#5a3a20'); TR(c, 3, 7, 5, 2, '#2f6b34'); TR(c, 8, 6, 5, 3, '#2f6b34'); TR(c, 4, 6, 3, 1, '#4a9a4a');
    } else {
      TR(c, 2, 3, 7, 2, '#f6e2a0'); TR(c, 4, 10, 9, 1, '#5a3a20'); TR(c, 7, 8, 6, 2, '#2f6b34'); TR(c, 3, 9, 4, 2, '#2f6b34'); TR(c, 8, 7, 3, 1, '#4a9a4a');
    }
    TR(c, 12, 6, 2, 3, '#3b2a18');
  },
});
defineTile('nhk_setback', {
  solid: true,
  draw(c) {
    TR(c, 0, 0, 16, 16, '#c9a46a'); TR(c, 0, 0, 16, 1, '#ddb985');
    TR(c, 0, 7, 16, 1, '#a8844a'); TR(c, 7, 0, 1, 13, '#a8844a');
    for (let i = 0; i < 13; i++) TP(c, i + 2, 12 - i, '#8a6a3c');
    TR(c, 0, 13, 16, 3, '#5a3a20');
  },
});
defineTile('nhk_byobu', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 15, 8);
    for (let i = 0; i < 4; i++) {
      const y = 1 + (i % 2);
      TR(c, i * 4, y, 4, 13, i % 2 ? '#d9ae44' : '#ecc65a');
      TR(c, i * 4, y, 4, 1, '#5a3a18'); TR(c, i * 4, y + 12, 4, 1, '#5a3a18');
    }
    TR(c, 1, 4, 7, 2, '#f8e6a8'); TR(c, 9, 9, 6, 2, '#f8e6a8');
    TR(c, 3, 9, 5, 2, '#3f7a44'); TR(c, 10, 5, 4, 2, '#3f7a44');
  },
});
defineTile('nhk_andon', {
  solid: true, obj: true, frames: 2, speed: 18,
  draw(c, r, f) {
    shadow(c, 8, 15, 4);
    TR(c, 4, 13, 8, 2, '#3b2a18');
    TR(c, 4, 3, 8, 10, '#3b2a18'); TR(c, 5, 4, 6, 8, f ? '#fff1b8' : '#ffe48a');
    TR(c, 5, 8, 6, 1, '#c9a46a'); TR(c, 7, 4, 1, 8, '#e0c47a');
    TR(c, 6, 2, 4, 1, '#3b2a18');
  },
});
defineTile('nhk_katana', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 15, 6);
    TR(c, 2, 12, 12, 2, '#20232a'); TR(c, 3, 3, 2, 10, '#20232a'); TR(c, 11, 3, 2, 10, '#20232a');
    TR(c, 1, 5, 14, 2, '#2a2430'); TR(c, 1, 5, 4, 2, '#d8d0b8'); TR(c, 5, 4, 1, 4, '#c9a227');
    TR(c, 2, 9, 12, 2, '#2a2430'); TR(c, 2, 9, 3, 2, '#d8d0b8'); TR(c, 5, 8, 1, 4, '#c9a227');
  },
});
defineTile('nhk_chabudai', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 14, 7);
    disc(c, 8, 8, 6, '#6e4428'); disc(c, 8, 7, 6, '#9b6638'); disc(c, 8, 7, 5, '#b07a48');
    TR(c, 4, 5, 4, 3, '#3a6a5a'); TR(c, 4, 5, 4, 1, '#5a8a7a'); TP(c, 8, 6, '#3a6a5a');
    TR(c, 10, 7, 2, 2, '#f6f1e2'); TR(c, 7, 9, 2, 2, '#f6f1e2');
  },
});
defineTile('nhk_tansu', {
  solid: true, obj: true,
  draw(c) {
    TR(c, 1, 0, 14, 16, '#5a3a20'); TR(c, 2, 1, 12, 14, '#9b6638');
    for (const y of [1, 6, 11]) { TR(c, 2, y + 4, 12, 1, '#5a3a20'); TR(c, 4, y + 2, 2, 1, '#c9a227'); TR(c, 10, y + 2, 2, 1, '#c9a227'); }
  },
});

// --- history gallery
function pedestal(c) {
  shadow(c, 8, 15, 6);
  TR(c, 2, 10, 12, 6, '#d8dee8'); TR(c, 2, 10, 12, 1, '#ffffff'); TR(c, 2, 15, 12, 1, '#aab4c4');
}
defineTile('nhk_ex_radio', {
  solid: true, obj: true,
  draw(c) {
    pedestal(c);
    TR(c, 4, 2, 8, 8, '#7a4a28'); TR(c, 5, 1, 6, 1, '#7a4a28'); TR(c, 6, 0, 4, 1, '#7a4a28');
    TR(c, 5, 2, 6, 5, '#d8c08a'); for (let x = 6; x < 11; x += 2) TR(c, x, 2, 1, 5, '#9a7a4a');
    TP(c, 6, 8, '#ffd23f'); TP(c, 9, 8, '#ffd23f');
  },
});
defineTile('nhk_ex_tv', {
  solid: true, obj: true,
  draw(c) {
    pedestal(c);
    TR(c, 3, 1, 10, 9, '#6e4428'); TR(c, 3, 1, 10, 1, '#8a5a33');
    TR(c, 4, 2, 6, 6, '#8e9a94'); TR(c, 5, 3, 2, 1, '#c8d4cc'); TP(c, 4, 2, '#6e4428'); TP(c, 9, 2, '#6e4428'); TP(c, 4, 7, '#6e4428'); TP(c, 9, 7, '#6e4428');
    TP(c, 11, 3, '#d8c08a'); TP(c, 11, 6, '#d8c08a');
  },
});
defineTile('nhk_ex_mic', {
  solid: true, obj: true,
  draw(c) {
    pedestal(c);
    TR(c, 7, 6, 2, 4, '#9aa0aa'); TR(c, 5, 9, 6, 1, '#5a5f6b');
    TR(c, 5, 0, 6, 7, '#5a5f6b'); TR(c, 6, 1, 4, 5, '#c3c6ce');
    for (let y = 2; y < 6; y += 2) TR(c, 6, y, 4, 1, '#7d8391');
    TP(c, 5, 0, '#c9a227'); TP(c, 10, 0, '#c9a227');
  },
});
defineTile('nhk_showcase', {
  solid: true, obj: true,
  draw(c) {
    shadow(c, 8, 15, 7);
    TR(c, 1, 9, 14, 6, '#5a6f8a'); TR(c, 1, 9, 14, 1, '#7d95b5');
    TR(c, 1, 1, 14, 8, '#9aa6ba'); TR(c, 2, 2, 12, 7, '#d6ecf8');
    TR(c, 3, 5, 3, 4, '#c9a227'); TR(c, 4, 4, 1, 1, '#c9a227');
    TR(c, 8, 4, 4, 5, '#f6f1e2'); TR(c, 9, 5, 2, 1, '#3b3f48'); TR(c, 9, 7, 2, 1, '#3b3f48');
    TR(c, 3, 2, 3, 1, '#ffffff'); TP(c, 12, 3, '#ffffff');
  },
});
defineTile('nhk_panel', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    TR(c, 1, 1, 14, 11, '#ffffff'); TR(c, 1, 1, 14, 2, '#2f6fd0'); TR(c, 1, 12, 14, 1, '#aab4c4');
    const photo = ['#b89a6a', '#8e8e8e', '#6a8ab0'][v];
    TR(c, 2, 4, 5, 4, photo); TR(c, 3, 5, 2, 2, shade(photo, -0.3));
    for (let y = 4; y < 11; y += 2) TR(c, 8, y, y % 4 ? 5 : 6, 1, '#9aa0aa');
    TR(c, 2, 9, 5, 1, '#9aa0aa');
  },
});
defineTile('nhk_booth', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    shadow(c, 8, 15, 7);
    TR(c, 0, 5, 16, 5, '#e8ecf2'); TR(c, 0, 5, 16, 1, '#ffffff');
    TR(c, 0, 10, 16, 5, '#2f6fd0'); TR(c, 0, 10, 16, 1, '#1d4fa8');
    TR(c, 2, 1, 6, 5, '#20232a'); TR(c, 3, 2, 4, 3, '#5fd7ff');
    TR(c, 11, 2, 1, 4, '#9aa0aa'); TR(c, 10, 1, 3, 2, '#3b3f48');
  },
});

// --- NHKホール
defineTile('nhk_hallwall', {
  solid: true,
  draw(c) {
    TR(c, 0, 0, 16, 16, '#1f2748'); TR(c, 0, 0, 16, 1, '#2f3a66');
    TR(c, 7, 1, 2, 12, '#2c3660'); TP(c, 7, 2, '#c9a227'); TP(c, 8, 2, '#c9a227');
    TR(c, 0, 13, 16, 3, '#141a33'); TR(c, 0, 13, 16, 1, '#c9a227');
  },
});
defineTile('nhk_hallwall_hi', {
  solid: true,
  draw(c) {
    TR(c, 0, 0, 16, 16, '#1f2748'); TR(c, 0, 0, 16, 1, '#2f3a66');
    TR(c, 7, 0, 2, 16, '#2c3660'); TP(c, 7, 9, '#c9a227'); TP(c, 8, 9, '#c9a227');
    TR(c, 0, 4, 16, 1, '#c9a227'); TR(c, 0, 5, 16, 1, '#8a6f1a');
  },
});
defineTile('nhk_hallwalltop', { solid: true, draw(c) { TR(c, 0, 0, 16, 16, '#0f1328'); TR(c, 0, 15, 16, 1, '#3a4570'); } });

// ====================================================================== characters
const L = {
  recep: { ...LOOKS.receptionist, top: '#2f5fb8', bottom: '#1d2f5e' },
  recep2: { ...LOOKS.receptionist, hair: 'long', hairColor: 'black', top: '#2f5fb8', bottom: '#1d2f5e' },
  guide: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#3a6fd8', bottom: '#f2f2f2', skirt: true, jacket: true },
  clerk: { ...LOOKS.clerk, top: '#3a6fd8' },
  producer: { ...LOOKS.manager, tie: '#3a6fd8', top: '#2a3560', bottom: '#2a3560' },
  visitor: { ...LOOKS.salaryman, top: '#6d7280', tie: '#d62f2f' },
  kid: { ...LOOKS.kid, top: '#5ee07a', hair: 'cap', hat: '#2f6fd0' },
  fan: { ...LOOKS.fan, hairColor: 'brown', top: '#ff7eb6' },
  guard: LOOKS.guard,
  ad: { ...LOOKS.ad, top: '#3a6fd8' },
  actor: { ...LOOKS.actor, tie: '#2f9a4a' },
  anchorF: { ...LOOKS.announcer, top: '#ffffff', bottom: '#3a58a8' },
  anchorM: LOOKS.announcerM,
  veteran: { ...LOOKS.announcer, hairColor: 'silver', top: '#8a5ac8', bottom: '#2a2430', glasses: true },
  desk: { ...LOOKS.manager, glasses: false, top: '#5a6f8a', bottom: '#3b3f48', tie: '#ffd23f' },
  fd: { ...LOOKS.staff, hat: '#3a6fd8', top: '#2a2d36' },
  cameraman: LOOKS.cameraman,
  host: { ...LOOKS.actor, top: '#3a58a8', bottom: '#3a58a8', tie: '#ffd23f', hairColor: 'black' },
  hakase: { ...LOOKS.oldman, top: '#f2f2f2', bottom: '#5a4a3a' },
  queen: { ...LOOKS.actress, top: '#d62f2f', bottom: '#2a2430', hairColor: 'black' },
  geinin: { ...LOOKS.comedian2, top: '#ffd23f' },
  kidsDir: { hair: 'short', hairColor: 'brown', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a', glasses: true },
  pianist: { ...LOOKS.singer, top: '#ffb3d1', bottom: '#ffffff', hairColor: 'brown' },
  kidA: { ...LOOKS.kid, top: '#ff7eb6', hair: 'twin', hairColor: 'black', skirt: true, bottom: '#ffd23f' },
  kidB: { ...LOOKS.kid, top: '#5fd7ff' },
  kidC: { ...LOOKS.kid, top: '#ffd23f', hair: 'bob', hairColor: 'brown', bottom: '#2f9a4a' },
  dramaDir: { hair: 'short', hairColor: 'black', skin: 'fair', top: '#f2e8d0', bottom: '#5a4a3a', glasses: true },
  historyDir: LOOKS.director,
  heroine: { ...LOOKS.actress, top: '#f6d6a8', bottom: '#8a5a33', hair: 'bob' },
  tate: { ...LOOKS.samurai, top: '#20232a', bottom: '#20232a' },
  lord: { ...LOOKS.samurai, top: '#8a2a3a', bottom: '#d9ae44' },
  extra: { ...LOOKS.samurai, top: '#5a5f6b', bottom: '#3b3f48' },
  costume: { ...LOOKS.makeup, hairColor: 'brown', top: '#c0452f' },
  curator: { hair: 'short', hairColor: 'silver', skin: 'fair', top: '#5a4a3a', bottom: '#3b3f48', jacket: true, glasses: true, tie: '#3a6fd8' },
  oldman: LOOKS.oldman,
  mom: LOOKS.mom,
  boothStaff: { ...LOOKS.announcer, hair: 'long', hairColor: 'brown', top: '#f2f2f2', bottom: '#2f6fd0' },
  usher: { ...LOOKS.receptionist, top: '#a51f2c', bottom: '#2a2430' },
  stageMgr: { ...LOOKS.staff, hat: '#20232a', top: '#20232a', bottom: '#20232a' },
  choirA: { ...LOOKS.singer, top: '#f2f2f2', bottom: '#2a3560' },
  choirB: { ...LOOKS.announcerM, top: '#f2f2f2', bottom: '#2a3560', jacket: false, tie: '#2a3560' },
  conductor: { ...LOOKS.actor, hairColor: 'silver', tie: '#f2f2f2' },
  host1: { ...LOOKS.announcerM, top: '#1e1e26', bottom: '#1e1e26', tie: '#ffd23f' },
  host2: { ...LOOKS.announcer, top: '#ffd3e3', bottom: '#ff7eb6', hair: 'long' },
  makeupArtist: LOOKS.makeup,
};

const SP = {
  recep: { name: '受付さん', look: L.recep },
  guide: { name: 'ガイドさん', look: L.guide },
  producer: { name: 'プロデューサー', look: L.producer },
  ad: { name: 'AD', look: L.ad },
  stageMgr: { name: '舞台監督', look: L.stageMgr },
  makeup: { name: 'メイクさん', look: L.makeupArtist },
  host1: { name: '総合司会', look: L.host1 },
  host2: { name: '司会アナ', look: L.host2 },
  mascot: { name: 'ドットン' },
};
const as = (npc) => ({ name: npc.name, look: npc.look });

// Tour guide with a little blue flag.
function guideSprite(ctx, x, y, g, e) {
  x = Math.round(x); y = Math.round(y);
  const frame = e.moving ? [1, 0, 2, 0][Math.floor(e.anim / 8) % 4] : 0;
  const left = e.dir === 'left';
  const fx = x + (left ? 1 : 13);
  if (e.dir === 'up') { F(ctx, fx, y - 14, 1, 16, '#9aa0aa'); F(ctx, fx + 1, y - 14, 6, 4, '#3a6fd8'); }
  drawChar(ctx, charSheet(e.look), e.dir, frame, x, y);
  if (e.dir !== 'up') {
    F(ctx, fx, y - 14, 1, 16, '#9aa0aa');
    F(ctx, left ? fx - 6 : fx + 1, y - 14, 6, 4, '#3a6fd8');
    F(ctx, left ? fx - 4 : fx + 3, y - 13, 2, 2, '#ffffff');
  }
}

// ドットン: the (fictional) mascot of the kids' show — a round, sky-blue costume with an antenna.
const MASCOT_BODY = [
  '.......rr.......',
  '.......rr.......',
  '........a.......',
  '....oooooooo....',
  '...obbbbbbbbo...',
  '..obbbbbbbbbbo..',
  '.obbbbbbbbbbbbo.',
  null, null, null, null,
  'oobbbbbbbbbbbboo',
  'obbbwwwwwwwwbbbo',
  '.obbwwwwwwwwbbo.',
  '..obbwwwwwwbbo..',
  '...obbbbbbbbo...',
  '....offo.offo...',
  '....ooo..ooo....',
];
const MASCOT_FACE = {
  down: ['.obbweebbweebbo.', '.obbweebbweebbo.', '.obbbbbbbbbbbbo.', '.obpbbbmmbbbpbo.'],
  left: ['.obweebbweebbbo.', '.obweebbweebbbo.', '.obbbbbbbbbbbbo.', '.opbbbmmbbbpbbo.'],
  right: ['.obbbweebbweebo.', '.obbbweebbweebo.', '.obbbbbbbbbbbbo.', '.obbpbbbmmbbbpo.'],
  up: ['.obbbbbbbbbbbbo.', '.obbbbbbbbbbbbo.', '.obbbbbbbbbbbbo.', '.obbbbbbbbbbbbo.'],
};
const MASCOT_PAL = { o: '#22202a', b: '#62b6f2', w: '#ffffff', e: '#22202a', r: '#ff5d6c', a: '#5a5f6b', p: '#ff9ab8', m: '#d6455a', f: '#2f5fb8' };
const MASCOT_ROWS = {};
for (const [dir, face] of Object.entries(MASCOT_FACE)) {
  MASCOT_ROWS[dir] = MASCOT_BODY.map((row, i) => (row === null ? face[i - 7] : dir === 'up' ? row.replace(/w/g, 'b') : row));
}
function mascotSprite(ctx, x, y, g, e) {
  x = Math.round(x); y = Math.round(y);
  const bob = e.moving ? Math.floor(e.anim / 8) % 2 : Math.floor(g.frame / 30) % 2;
  pix(ctx, MASCOT_ROWS[e.dir] || MASCOT_ROWS.down, MASCOT_PAL, x, y - 2 - bob);
}

// ====================================================================== little helpers
function plate(x, y, label, w = 3) {
  return {
    type: 'prop', x, y, w, h: 1, solid: false,
    draw(ctx, sx, sy) {
      const tw = Math.ceil(measure(ctx, label, 10)) + 10;
      const px = Math.round(sx + (w * 16 - tw) / 2), py = sy + 3;
      F(ctx, px, py, tw, 13, '#1d2c50');
      F(ctx, px + 1, py + 1, tw - 2, 11, '#2f5fb8');
      text(ctx, label, px + tw / 2, py + 1, { size: 10, align: 'center', color: '#ffffff', shadow: null });
    },
  };
}

function flash(g, frames = 18) {
  return new Promise((resolve) => {
    const s = {
      t: 0,
      update(gg) { s.t++; if (s.t >= frames) { gg.pop(s); resolve(); } },
      draw(ctx) { ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - s.t / frames)})`; ctx.fillRect(0, 0, W, H); },
    };
    g.push(s);
  });
}

// NPC walks; the player follows one tile behind.
async function walkTogether(g, id, npcSteps, playerSteps, speed = 1) {
  const a = g.moveNpc(id, npcSteps, speed);
  await g.waitFrames(Math.round(16 / speed));
  const b = g.movePlayer(playerSteps, speed);
  await Promise.all([a, b]);
}

async function afterNhkJob(g) {
  if (!ensureInvite(g)) return;
  // Show the rank-up now so it does not pop up after the whole finale.
  if (g.pendingRankUp) {
    const r = g.pendingRankUp;
    g.pendingRankUp = null;
    g.sfx('fanfare');
    await g.say(`称号が「${r}」になった！\nもっともっと上を目指そう！`);
  }
  g.sfx('chime');
  await g.say(['{name}さーん！大変です！', '年末の大型歌番組のプロデューサーが、{name}さんに会いに来ています！'], SP.ad);
  await g.say('はじめまして、番組プロデューサーです！\nずっとお会いしたかったんです！', SP.producer);
  await finaleOffer(g, SP.producer);
}

async function nhkJob(g, def) {
  const res = await g.job(def);
  if (res) await afterNhkJob(g);
  return res;
}

// ====================================================================== content tables
const NHK_QUIZ = [
  { q: '日本でラジオ放送が始まったのは何年？', choices: ['1925年', '1953年', '1964年', '1989年'], answer: 0 },
  { q: '日本でテレビ放送が始まったのは何年？', choices: ['1925年', '1945年', '1953年', '1972年'], answer: 2 },
  { q: '本番中に光るランプの文字は？', choices: ['OPEN', 'ON AIR', 'EXIT', 'STOP'], answer: 1 },
  { q: 'テレビ業界で「AD」といえば？', choices: ['アートデザイナー', 'アナウンスデスク', 'アシスタントディレクター', 'オーディオドクター'], answer: 2 },
  { q: '出演者に指示を書いて見せる紙は？', choices: ['タイムカード', 'ポスター', '回覧板', 'カンペ'], answer: 3 },
  { q: '本番中に「巻いて！」の合図。意味は？', choices: ['ゆっくり話して', '急いで進めて', '歌いはじめて', 'のり巻きを食べて'], answer: 1 },
  { q: '予定より時間が遅れていることを業界用語で？', choices: ['押している', '引いている', '巻いている', '回っている'], answer: 0 },
  { q: 'カメラの前に原稿を映し出す装置は？', choices: ['スピーカー', 'ミキサー', 'プロンプター', 'レフ板'], answer: 2 },
];

const NEWS_WORDS = [
  { word: '遵守', reading: 'じゅんしゅ', wrong: ['そんしゅ', 'じゅんもり'] },
  { word: '市井', reading: 'しせい', wrong: ['いちい', 'しいど'] },
  { word: '出納', reading: 'すいとう', wrong: ['しゅつのう', 'でのう'] },
  { word: '漸次', reading: 'ぜんじ', wrong: ['ざんじ', 'せんじ'] },
  { word: '進捗', reading: 'しんちょく', wrong: ['しんしょう', 'しんぽ'] },
  { word: '脆弱', reading: 'ぜいじゃく', wrong: ['きじゃく', 'もろじゃく'] },
  { word: '暫定', reading: 'ざんてい', wrong: ['ぜんてい', 'さんじょう'] },
  { word: '月極', reading: 'つきぎめ', wrong: ['げっきょく', 'つききょく'] },
  { word: '生粋', reading: 'きっすい', wrong: ['なまいき', 'せいすい'] },
  { word: '行脚', reading: 'あんぎゃ', wrong: ['ぎょうきゃく', 'いきあし'] },
  { word: '完遂', reading: 'かんすい', wrong: ['かんつい', 'かんずい'] },
  { word: '雰囲気', reading: 'ふんいき', wrong: ['ふいんき', 'ふんいけ'] },
  { word: '傘下', reading: 'さんか', wrong: ['かさした', 'さんげ'] },
  { word: '奇しくも', reading: 'くしくも', wrong: ['きしくも', 'あやしくも'] },
  { word: '頒布', reading: 'はんぷ', wrong: ['ぶんぷ', 'ふんぷ'] },
  { word: '一入', reading: 'ひとしお', wrong: ['いちにゅう', 'ひといり'] },
  { word: '発端', reading: 'ほったん', wrong: ['はつたん', 'はったん'] },
  { word: '間髪を入れず', reading: 'かんはつをいれず', wrong: ['かんぱつをいれず', 'まがみをいれず'] },
];

const EASY_WORDS = [
  { word: '台風', reading: 'たいふう', wrong: ['だいふう', 'たいかぜ'] },
  { word: '交差点', reading: 'こうさてん', wrong: ['こうさてい', 'まじわりてん'] },
  { word: '最寄り', reading: 'もより', wrong: ['さいより', 'もっとより'] },
  { word: '手術', reading: 'しゅじゅつ', wrong: ['しゅじつ', 'てじゅつ'] },
  { word: '果物', reading: 'くだもの', wrong: ['かぶつ', 'はてもの'] },
  { word: '時計', reading: 'とけい', wrong: ['じけい', 'ときはかり'] },
];

// ====================================================================== tour (tier 0, daily, free)
const tourGuide = (room, x, y, dir) => ({
  type: 'npc', id: 'nhk_tourguide', x, y, dir, look: L.guide, sprite: guideSprite, name: 'ガイドさん',
  cond: () => TOUR.on && TOUR.stop === room,
  text: 'ツアーの途中です。はぐれないでくださいね♪',
});

async function startTour(g) {
  const s = SP.guide;
  if (today(g, 'nhk_tour_day')) {
    await g.say(['本日のツアーは終了しました。', 'また明日のご参加、お待ちしていますね♪'], s);
    return;
  }
  const i = await g.ask(['スタジオ見学ツアーへようこそ！', 'ニュースやドラマのスタジオを、わたしがご案内します。参加しますか？（無料）'], ['参加する', 'またこんど'], s);
  if (i !== 0) { await g.say('いつでもお声がけくださいね♪', s); return; }
  markToday(g, 'nhk_tour_day');
  TOUR.on = true;
  try {
    await tourScript(g);
  } finally {
    TOUR.on = false;
    TOUR.stop = '';
  }
}

// Fade out first, then switch which room's tour guide is visible (no pop-out before the fade).
async function tourGoto(g, stop, room, x, y, dir) {
  await g.fadeOut();
  TOUR.stop = stop;
  await g.goto('nhk', room, x, y, dir);
}

async function tourScript(g) {
  const s = SP.guide;
  await g.say('それでは出発しまーす！\nはぐれないでくださいね♪', s);
  await g.emote('nhk_guide', '♪');
  await g.moveNpc('nhk_guide', 'face:up');

  // --- 1. corridor
  await tourGoto(g, 'corridor', 'corridor', 5, 3, 'left');
  await g.say(['ここはスタジオがならぶ廊下です。', 'ドアの横の「ON AIR」ランプが光っていたら本番中。そーっと通ってくださいね。'], s);
  await walkTogether(g, 'nhk_tourguide', 'left left face:up', 'left left face:up');
  await g.say('まずはこちら、ニューススタジオへ！', s);

  // --- 2. news studio
  await tourGoto(g, 'news', 'news', 8, 9, 'up');
  await g.say(['ここがニューススタジオ！', '毎日のニュースは、ここから全国に届けられているんです。'], s);
  await g.emote('nhk_anchorF', '♪');
  await g.say('見学の方ですね。ようこそ！', { name: 'アナウンサー', look: L.anchorF });
  await walkTogether(g, 'nhk_tourguide', 'up face:up', 'face:up');
  await g.say(['カメラの前の透明な板、見えますか？', '「プロンプター」といって、ここに原稿が映るんです。だからカメラを見たまま読めるんですよ。'], s);
  await g.emote('player', '!');
  await g.say('次は、ドラマのスタジオへご案内します！', s);

  // --- 3. drama studio
  await tourGoto(g, 'drama', 'drama', 11, 8, 'up');
  await g.say(['こちらはドラマスタジオ。', '左は朝の連続ドラマの「昭和の茶の間」、右は日曜夜の歴史ドラマの「お城の大広間」のセットです！'], s);
  await walkTogether(g, 'nhk_tourguide', 'right right right face:up', 'right right right face:up');
  await g.emote('nhk_extra', '!');
  await g.say('せ、拙者を見学でござるか…？\n照れるでござる…。', { name: '侍エキストラ', look: L.extra });
  await g.say(['ふすまの絵も金の屏風も、ぜーんぶ美術スタッフさんの手作りなんですよ。', '最後は「放送の歴史ギャラリー」へ！'], s);

  // --- 4. gallery
  await tourGoto(g, 'gallery', 'gallery', 8, 4, 'up');
  await g.say(['日本でラジオ放送が始まったのは1925年。', 'テレビ放送が始まったのは1953年です。そこからずっと、放送の歴史は続いています。'], s);
  await g.say('そしてこちらが、昔のNHKのロゴ！', s);
  await g.showLogo('nhk_old', '昔のNHKのロゴ');
  await g.say('いまのロゴと見比べると、ずいぶん雰囲気が違いますね。', s);
  await g.showLogo('nhk', 'いまのNHKのロゴ');

  // --- 5. back to the lobby: commemorative photo
  await tourGoto(g, 'lobby', 'lobby', 10, 5, 'down');
  await g.moveNpc('nhk_guide', 'left left left left left down face:up', 1.2);
  await g.say('最後に、ロゴの前で記念撮影しましょう！\nはい、チーズ！', s);
  g.sfx('shutter');
  await flash(g);
  await g.emote('player', '♪');
  await g.say(['すてきな一枚が撮れました♪', '本日のツアーはここまで！ご参加ありがとうございました！'], s);
  g.addSkill('talk', 1, true);
  g.sfx('good');
  await g.say('テレビの話題にちょっとくわしくなった！\nトークが1上がった。');
  await g.say('お仕事に興味があったら、受付の「お仕事案内」で聞いてみてくださいね。', s);
  await g.moveNpc('nhk_guide', 'up right right right right right face:down', 1.2);
}

// ====================================================================== FINALE
async function finaleOffer(g, speaker = SP.producer, inHall = false) {
  const i = await g.ask(inHall ? [
    '{name}さんの出番は、年末の大型歌番組の大トリです！',
    '楽屋でメイクをしたら、すぐ本番。準備はいいですか？',
  ] : [
    '今年の年末の大型歌番組…その大トリを、{name}さんにお願いしたいんです！',
    '本番の舞台はNHKホール。すぐに向かえますか？',
  ], ['本番へ行く', 'まだ準備する'], speaker);
  if (i !== 0) {
    await g.say(['承知しました！準備ができたら声をかけてくださいね。', 'ロビーとホールで、スタッフ一同お待ちしています！'], speaker);
    return false;
  }
  await g.say(inHall ? 'よし、楽屋へご案内します！\n客席はもう満員ですよ！' : 'ありがとうございます！\nそれでは、NHKホールへご案内します！', speaker);
  await finaleFlow(g);
  return true;
}

async function producerApproach(g, fresh) {
  const s = SP.producer;
  const p = g.map.player;
  await g.emote('nhk_producer', '!');
  let walked = false;
  if (p.x === 9 && p.y === 12) {
    await g.moveNpc('nhk_producer', 'left left left down face:left', 1.6);
    g.facePlayer('right');
    walked = true;
  }
  if (fresh) await g.say(['あっ、{name}さん！ちょうどお電話しようと思っていたところです！', '番組プロデューサーです。お会いできて光栄です！'], s);
  else await g.say(['{name}さん！お待ちしておりました！', 'お電話した、番組プロデューサーです！'], s);
  const go = await g.ask(['今年の年末の大型歌番組…その大トリを、{name}さんにお願いしたいんです！', '本番の舞台はNHKホール。すぐに向かえますか？'], ['本番へ行く', 'まだ準備する'], s);
  if (go !== 0) {
    await g.say(['承知しました！準備ができたら、このロビーで声をかけてください。', '体力を回復しておくのがおすすめですよ！'], s);
    return;
  }
  await g.say('ありがとうございます！\nそれでは、ご案内します！', s);
  if (walked) await walkTogether(g, 'nhk_producer', 'up up up', 'right up up', 1.4);
  await finaleFlow(g);
}

const REACT = {
  S: { text: ['歌い終わった瞬間、会場は総立ち！', '鳴りやまない拍手と歓声…これぞ伝説のステージだ！'], host: '…すごい。こんなステージ、見たことがありません！', fame: 800, pay: 150000 },
  A: { text: ['歌い終わると、大きな拍手が会場をつつみこんだ！', '最高のステージだ！'], host: 'すばらしい歌声でした！会場がひとつになりましたね！', fame: 650, pay: 120000 },
  B: { text: ['心のこもった歌声に、会場からあたたかい拍手が送られた！'], host: 'あたたかい歌声、しっかり届きましたよ！', fame: 500, pay: 100000 },
  C: { text: ['緊張で、声が少しふるえてしまった…。', 'でも、客席のみんなが手拍子で支えてくれた！'], host: 'みなさんの手拍子もすてきでしたね！これぞ生放送です！', fame: 400, pay: 80000 },
  D: { text: ['歌詞が飛んでしまった…！', 'そのとき、客席から「がんばれー！」の大合唱がわき起こった！'], host: '会場のみなさんと一緒に作った、忘れられないステージになりました！', fame: 300, pay: 60000 },
};

async function finaleFlow(g) {
  await g.fadeOut();
  SHOW.on = true;
  SHOW.phase = 'backstage';
  try {
    // ---- 楽屋
    await g.goto('nhk', 'backstage', 5, 3, 'up');
    await g.say('（楽屋に通された。鏡の前に座ると、心臓がドキドキしてきた…）');
    await g.moveNpc('nhk_makeup', 'face:right');
    await g.emote('nhk_makeup', '♪');
    await g.say('いよいよですね！\nとびきりのメイク、仕上げちゃいます♪', SP.makeup);
    await g.fadeOut(12);
    g.sfx('good');
    await g.wait(500);
    await g.fadeIn(12);
    await g.say('はい、完成！テレビの向こうのみんなに、最高の笑顔を見せてあげて！', SP.makeup);
    g.facePlayer('down');
    await g.moveNpc('nhk_bs_ad', 'up up up left face:up', 1.6);
    await g.emote('nhk_bs_ad', '!');
    await g.say('まもなく本番でーす！\n{name}さん、スタンバイお願いしまーす！', SP.ad);
    await g.emote('player', '!');
    const calm = await g.ask('（いよいよ本番だ…！）', ['よし、いくぞ！', '深呼吸する']);
    if (calm === 1) await g.say('すー…はー…。\n…よし！');

    // ---- NHKホール：舞台袖から
    SHOW.phase = 'intro';
    await g.fadeOut(16);
    await g.goto('nhk', 'hall', 3, 5, 'right');
    g.bgm('nhk_gala');
    await g.wait(400);
    await g.say('（舞台袖から客席を見ると、ペンライトの光が波のように揺れている…！）');
    await g.emote('nhk_host1', '♪');
    await g.say(['さあ、今年の歌番組も、いよいよクライマックス！', '最後は、今年 日本中を笑顔にしてくれたこの方です！'], SP.host1);
    await g.say('{name}さんです！\nどうぞー！', SP.host2);
    g.sfx('applause');
    SHOW.phase = 'walk';
    await g.movePlayer('right right right right right right right', 1);
    g.facePlayer('down');
    g.sfx('applause');
    await g.wait(400);
    await g.emote('player', '!');
    const feel = await g.ask('{name}さん、いまのお気持ちは？', ['最高です！', '緊張してます…', 'おなかすいた'], SP.host1);
    if (feel === 0) await g.say('いい笑顔！客席のみなさんも最高の気分ですよ！', SP.host1);
    else if (feel === 1) await g.say('大丈夫！客席のペンライト、ぜーんぶ{name}さんの味方です！', SP.host2);
    else { g.sfx('laugh'); await g.say('あはは！終わったら楽屋にお弁当がありますからね！', SP.host1); }
    await g.say('それでは歌っていただきましょう。\nどうぞ！', SP.host2);

    // ---- 本番
    SHOW.phase = 'song';
    await g.fadeOut(20);
    const mg = g.minigame('rhythm', { difficulty: 5, lanes: 4, title: '年末の大型歌番組', song: 'ありがとう、ニッポン' });
    await g.fadeIn(10);
    const res = (await mg) || { rank: 'B', score: 60 };

    // ---- お祝い
    SHOW.phase = 'celebrate';
    SHOW.t0 = g.frame;
    g.bgm('nhk_gala');
    g.sfx('fanfare');
    const rank = REACT[res.rank] ? res.rank : 'B';
    const r = REACT[rank];
    await g.wait(600);
    g.sfx('applause');
    if (rank === 'S') g.shake(30, 2);
    await g.say(r.text);
    if (rank === 'C' || rank === 'D') {
      await g.emote('player', '…');
      g.sfx('applause');
      await g.emote('player', '♥');
    } else {
      await g.emote('player', rank === 'S' ? '!' : '♪');
    }
    await g.emote('nhk_host1', '!');
    await g.say(r.host, SP.host1);
    if (rank === 'S') {
      for (const d of ['right', 'down', 'up', 'left']) {
        await g.moveNpc('nhk_host1', 'face:' + d);
        await g.wait(220);
      }
      await g.emote('nhk_host1', '?', 30);
      g.sfx('laugh');
      await g.say('あっ…感動のあまり、台本がどこかへ行っちゃいました！', SP.host1);
    }
    await g.emote('nhk_host2', '♥');
    await g.say(['{name}さん、ありがとうございました！', 'まさに、国民的スターの誕生です！'], SP.host2);
    g.setFlag('finaleDone', true);
    g.addFame(r.fame, true);
    g.addMoney(r.pay, true);
    g.sfx('coin');
    await g.say(`出演料 ¥${r.pay.toLocaleString()}　知名度 +${r.fame}`);
    await g.say('（その夜、日本中が{name}の歌で笑顔になった――）');

    // ---- 節目のお祝い（エンディングはない：芸能人生はここからも続く）
    await g.fadeOut(40);
    SHOW.on = false;
    SHOW.phase = '';
    const card = milestoneCard(g);
    await g.fadeIn(20);
    await card;
  } finally {
    SHOW.on = false;
    SHOW.phase = '';
  }
  g.bgm('theater');
  await g.wait(300);
  await g.emote('nhk_producer2', '♪');
  await g.say(['{name}さん、本当にお疲れさまでした！', 'このNHKホールは、これからも{name}さんのステージです。またいつでも歌いに来てください！'], SP.producer);
  await g.say('来年の「ドット芸能大賞」も、{name}さんの話題で持ちきりになりますよ！\nこれからの活躍、楽しみにしています！', SP.producer);
  g.sfx('fanfare');
  await g.say(['国民的スターになった！', 'でも、芸能人生はまだまだ続く――。']);
  const nr = nextRank(g.state.fame);
  await g.say([
    nr ? `次の目標は、称号「${nr[1]}」（★${nr[0]}）！` : `いまの称号は「${rankName(g.state.fame)}」。ここからは、自分だけの記録をつくろう！`,
    'てちょうの「もくひょう」に、新しい「キャリアの目標」が増えた！\n冠番組、レギュラー番組、ファン100万人、ドット芸能大賞…まだまだ上をめざそう！',
  ]);
  g.save();
}

// The year-end show is a milestone, not the end: a short card with the numbers so far
// and the next goal, then the game goes on (A, or the autopilot, closes it).
const CARD_CONF = ['#ff5d8f', '#ffd23f', '#5fd7ff', '#5ee07a', '#ffffff', '#b48cff', '#ff8a3d'];
function milestoneCard(g) {
  return new Promise((resolve) => {
    const st = g.state;
    const fans = Math.max(0, Math.round(st.fans || 0));
    let friends = 0;
    try { friends = g.friends ? g.friends(2).length : 0; } catch (e) { friends = 0; }
    const nr = nextRank(st.fame);
    const stats = [
      `芸能生活 ${st.day}日目`,
      `こなしたお仕事 ${(st.stats && st.stats.jobs) || 0}回`,
      `知名度 ★${st.fame}`,
      fans ? `ファン ${fans.toLocaleString('ja-JP')}人` : null,
      friends ? `なかよしの仲間 ${friends}人` : null,
    ].filter(Boolean);
    let hd = null;
    try { hd = charSheetHD(st.look || {}); } catch (e) { hd = null; }
    const RR = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const alpha = (t, at) => Math.max(0, Math.min(1, (t - at) / 30));
    const CONT_T = 60 * 4; // 「まだまだ続く」 appears
    const scene = {
      milestone: true,
      opaque: true,
      hd: true,
      hidesHud: true,
      t: 0,
      update(gg) {
        scene.t++;
        if ((gg.auto && scene.t > 90) || (scene.t > CONT_T + 40 && gg.input.pressed('a'))) {
          gg.fade = 1;
          gg.pop(scene);
          gg.fadeIn(30);
          resolve();
        }
      },
      draw(ctx) {
        const t = scene.t;
        RR(ctx, 0, 0, SW, SH, '#141032');
        // stars and falling confetti (stateless: functions of time)
        for (let i = 0; i < 70; i++) {
          const x = Math.floor(hash2(i, 1, 4) * SW), y = Math.floor(hash2(i, 2, 4) * SH);
          if ((i + (t >> 4)) % 9) RR(ctx, x, y, 1, 1, i % 3 ? '#4a4a8a' : '#c8ccff');
        }
        for (let i = 0; i < 60; i++) {
          const sp = 0.6 + hash2(i, 3, 4) * 0.8;
          const y = ((t * sp + hash2(i, 4, 4) * 400) % (SH + 20)) - 10;
          const x = (hash2(i, 5, 4) * SW + Math.sin((t + i * 11) / 16) * 6 + SW) % SW;
          const flip = Math.floor((t + i * 5) / 8) % 2;
          RR(ctx, x, y, flip ? 4 : 2, flip ? 2 : 4, CARD_CONF[i % CARD_CONF.length]);
        }
        // the stage floor, a spotlight and its pool of light, the player hopping in it
        const cx = SW / 2;
        RR(ctx, 0, 296, SW, SH - 296, '#3a2418');
        RR(ctx, 0, 296, SW, 2, '#8a5a32');
        for (let x = 0; x < SW; x += 48) RR(ctx, x, 298, 1, SH - 298, '#2a1810');
        ctx.globalAlpha = 0.16;
        for (let y = 0; y < 300; y += 2) { const w = 30 + y * 0.35; RR(ctx, cx - w, y, w * 2, 2, '#fff2c0'); }
        ctx.globalAlpha = 0.22;
        for (let dy = -8; dy <= 8; dy++) { const w = Math.round(140 * Math.sqrt(1 - (dy / 9) ** 2)); RR(ctx, cx - w, 300 + dy, w * 2, 1, '#fff2c0'); }
        ctx.globalAlpha = 1;
        if (hd) {
          const hop = Math.floor(t / 20) % 4 === 1 ? 6 : 0;
          RR(ctx, cx - 22, 294, 44, 4, 'rgba(0,0,0,0.35)');
          const im = (hd.down || [])[0];
          if (im) ctx.drawImage(im, 0, 0, im.width, im.height, cx - 32, 214 - hop, 64, 80);
        }
        // the numbers so far
        ctx.globalAlpha = alpha(t, 0);
        text(ctx, '国民的スター誕生！', cx, 22, { size: 32, align: 'center', color: '#ffd23f', outline: '#3a1030' });
        text(ctx, st.name, cx, 66, { size: 18, align: 'center', color: '#ffffff', shadow: '#000000' });
        stats.forEach((l, i) => {
          ctx.globalAlpha = alpha(t, 30 + i * 18);
          const col = i % 2 ? 82 : -82;
          const row = Math.floor(i / 2);
          const x = stats.length % 2 && i === stats.length - 1 ? cx : cx + col;
          text(ctx, l, x, 98 + row * 22, { size: 14, align: 'center', color: '#e8e8ff', shadow: '#000000' });
        });
        // …and the road ahead
        ctx.globalAlpha = alpha(t, CONT_T);
        text(ctx, 'でも、芸能人生はまだまだ続く――', cx, 168, { size: 20, align: 'center', color: '#ff9ad0', shadow: '#000000' });
        if (nr) text(ctx, `次の目標：称号「${nr[1]}」（★${nr[0]}）`, cx, 196, { size: 14, align: 'center', color: '#5fd7ff', shadow: '#000000' });
        ctx.globalAlpha = 1;
        if (t > CONT_T + 40) {
          const blink = Math.floor(t / 30) % 2;
          RR(ctx, SW - 140, SH - 30, 128, 22, 'rgba(10,6,4,0.7)');
          text(ctx, 'Aでつづける', SW - 76, SH - 27, { size: 14, align: 'center', color: blink ? '#5fd7ff' : '#ffffff', shadow: null });
        }
      },
    };
    g.push(scene);
  });
}

// ---- hall drawing (crowd / lights / confetti)
const PEN = ['#ff7eb6', '#5fd7ff', '#ffd23f', '#5ee07a', '#ffffff', '#ff9a3c'];
const HAIRS = ['#2a2430', '#6b4226', '#2a2430', '#c8ccd4', '#3a2a20', '#e8c45a'];
const TOPS = ['#3a58a8', '#d64161', '#5a6f8a', '#2f9a4a', '#ffd23f', '#8a5ac8', '#f2f2f2'];

function forSeats(g, cam, fn) {
  const room = g.map.room;
  const x0 = Math.max(0, Math.floor(cam.x / 16)), x1 = Math.min(room.w - 1, Math.floor((cam.x + W) / 16));
  const y0 = Math.max(0, Math.floor(cam.y / 16)), y1 = Math.min(room.h - 1, Math.floor((cam.y + H) / 16));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cell = room.cells[y][x];
      if (cell[cell.length - 1] === 'seat') fn(x, y, x * 16 - cam.x, y * 16 - cam.y);
    }
  }
}

// The audience (drawn on the seats, under the entities).
function drawHallUnder(ctx, g, cam) {
  if (!SHOW.on) return;
  forSeats(g, cam, (x, y, sx, sy) => {
    const hair = HAIRS[Math.floor(hash2(x, y, 5) * HAIRS.length)];
    F(ctx, sx + 3, sy + 8, 10, 6, TOPS[Math.floor(hash2(x, y, 3) * TOPS.length)]);
    F(ctx, sx + 4, sy + 1, 8, 8, hair);
    F(ctx, sx + 5, sy, 6, 1, hair);
  });
}

// Penlights glow above the dimmed hall.
function drawPenlights(ctx, g, cam) {
  forSeats(g, cam, (x, y, sx, sy) => {
    const k = hash2(x, y, 3);
    const sw = Math.round(Math.sin(g.frame / 8 + k * 6.28) * 2);
    const lx = sx + (k > 0.5 ? 12 : 2) + sw, ly = sy - 5;
    const pen = PEN[Math.floor(hash2(x, y, 7) * PEN.length)];
    F(ctx, lx - 1, ly - 1, 4, 8, 'rgba(255,255,255,0.16)');
    F(ctx, lx, ly, 2, 6, pen);
    F(ctx, lx, ly + 6, 2, 2, '#3b3f48');
  });
}

function drawHallOver(ctx, g, cam) {
  if (!SHOW.on) return;
  if (SHOW.phase === 'celebrate') {
    drawPenlights(ctx, g, cam);
    const t = g.frame - SHOW.t0;
    for (let i = 0; i < 80; i++) {
      const s1 = hash2(i, 1, 9), s2 = hash2(i, 2, 9);
      const x = ((s1 * W + Math.sin((t + i * 13) / 18) * 8) % W + W) % W;
      const y = ((t * (0.5 + s2 * 0.9) + s1 * 400) % (H + 20)) - 10;
      F(ctx, x, y, (t + i) % 16 < 8 ? 3 : 1, 2, PEN[i % PEN.length]);
    }
    return;
  }
  // dim the hall, with spotlights on the player and the hosts
  const spots = [];
  const p = g.map.player;
  spots.push([p.px - cam.x + 8, p.py - cam.y + 8]);
  for (const id of ['nhk_host1', 'nhk_host2']) {
    const e = g.npc(id);
    if (e && g.map.visible(e)) spots.push([e.px - cam.x + 8, e.py - cam.y + 8]);
  }
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,28,0.55)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  // keep the LED screen bright (it sits on row 3, above the spotlights)
  ctx.rect(4 * 16 - cam.x + 2, 3 * 16 - cam.y - 9, 14 * 16 - 4, 25);
  for (const [x, y] of spots) {
    ctx.moveTo(x + 15, y + 2);
    ctx.ellipse(x, y + 2, 15, 13, 0, 0, Math.PI * 2);
  }
  ctx.fill('evenodd');
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y] of spots) {
    ctx.fillStyle = 'rgba(255,236,170,0.10)';
    ctx.beginPath();
    ctx.moveTo(x - 4, -10);
    ctx.lineTo(x + 4, -10);
    ctx.lineTo(x + 14, y + 8);
    ctx.lineTo(x - 14, y + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  drawPenlights(ctx, g, cam);
}

function ledScreen() {
  return {
    type: 'prop', id: 'nhk_screen', x: 4, y: 3, w: 14, h: 1, solid: true,
    text: '大きなLEDスクリーンだ。\n本番では、歌詞や映像が映し出される。',
    draw(ctx, sx, sy, g) {
      const x = sx + 4, y = sy - 7, w = 14 * 16 - 8, h = 21;
      F(ctx, sx + 24, sy + 12, 4, 4, '#2a2d36');
      F(ctx, sx + w - 20, sy + 12, 4, 4, '#2a2d36');
      F(ctx, x - 2, y - 2, w + 4, h + 4, '#0b0e1c');
      const cel = SHOW.on && SHOW.phase === 'celebrate';
      F(ctx, x, y, w, h, cel ? '#3a1a5a' : SHOW.on ? '#0d1a4a' : '#13285a');
      for (let yy = y; yy < y + h; yy += 2) F(ctx, x, yy, w, 1, 'rgba(255,255,255,0.05)');
      if (!SHOW.on) {
        drawLogo(ctx, 'nhk', x + 44, y + 2, 56, 17, { board: true });
        text(ctx, 'NHKホール', x + 140, y + 4, { size: 12, align: 'center', color: '#ffffff', shadow: null });
      } else if (cel) {
        for (let i = 0; i < 6; i++) {
          const k = (g.frame / 6 + i * 9) % 30;
          F(ctx, x + 10 + i * 36, y + 3 + (k % 14), 2, 2, PEN[i]);
        }
        text(ctx, '国民的スター誕生！', x + w / 2, y + 4, { size: 12, align: 'center', color: '#ffd23f', outline: '#20232a' });
      } else {
        text(ctx, '年末の大型歌番組', x + w / 2 - 34, y + 4, { size: 12, align: 'center', color: '#ffffff', shadow: null });
        text(ctx, g.state.name, x + w / 2 + 60, y + 5, { size: 10, align: 'center', color: '#ffd23f', shadow: null });
      }
    },
  };
}

// ====================================================================== activity scripts
async function jobGuide(g, npc) {
  const st = g.state;
  const s = as(npc);
  const lines = ['NHKでのお仕事をご案内しますね。', `いまの{name}さんの知名度は★${st.fame}ですね。`];
  lines.push('スタジオ見学ツアー、ギャラリーのアナウンサー体験、ホールのリハーサル見学は、1日1回無料ですよ。');
  lines.push('クイズスタジオの「一般参加の予選会」は、どなたでも参加できます！');
  if (st.agency || st.fame >= 30) lines.push('こども番組スタジオで、うたのおにいさん・おねえさん役をお願いできます♪');
  if (st.fame >= 250) lines.push('ニュースの原稿読みと、クイズ番組の解答者もお任せできますね。');
  if (st.fame >= 1000) lines.push('ドラマスタジオでは、朝の連続ドラマの出演者を探しているそうです。');
  if (st.fame >= 2000) lines.push('それから…なんと、日曜夜の歴史ドラマの主演のお話が来ています！');
  if (!st.agency && st.fame < 30) lines.push('★30になるか、どこかの事務所に所属すると、こども番組のお仕事ができますよ。');
  else if (st.fame < 250) lines.push(`★250になったら、ニュースやクイズ番組も紹介できます。（あと★${250 - st.fame}）`);
  else if (st.fame < 1000) lines.push(`★1000で、朝の連続ドラマへの出演も夢じゃありません！（あと★${1000 - st.fame}）`);
  else if (st.fame < 2000) lines.push(`★2000になったら、歴史ドラマの主演も…！（あと★${2000 - st.fame}）`);
  else if (finalePending(g)) lines.push('そして…年末の大型歌番組のプロデューサーが、入り口の近くで{name}さんをお待ちですよ！');
  else if (!g.flag('finaleDone')) lines.push(`★${FINALE_FAME}…国民的スターになれば、年末の大きな歌番組から、きっと声がかかりますよ！`);
  else lines.push('NHKホールの凱旋コンサートも、いつでもお待ちしています！');
  await g.say(lines, s);
}

async function kidsJob(g, npc) {
  const s = as(npc);
  if (!g.state.agency && g.state.fame < 30) {
    await g.say(['うたのおにいさん・おねえさん役は、知名度★30以上の方か、事務所に所属している方にお願いしているんです。', 'まずはクイズの予選会や路上ライブで、顔を売ってみては？'], s);
    return;
  }
  await g.say(['こども番組「ドットンとうたおう！」のディレクターです。', 'ドットンといっしょに歌って踊る、うたのおにいさん・おねえさんを探してるんですよ！'], s);
  const res = await g.job({
    id: 'nhk_kids_song', title: 'うたのおにいさん・おねえさん', desc: 'こども番組で歌って踊ろう！', client: npc.name, clientLook: npc.look,
    stamina: 20, minigame: 'rhythm', opts: { difficulty: 1, lanes: 1, song: 'ドットンとうたおう！' }, pay: 4500, fame: 15, skill: 'uta', gain: 2,
  });
  if (!res) return;
  g.sfx('laugh');
  await g.emote('nhk_mascot', '♪');
  await g.moveNpc('nhk_mascot', 'left right right left face:down');
  await g.emote('nhk_kidA', '♥');
  await g.say('またいっしょに うたおうね〜！', SP.mascot);
  await afterNhkJob(g);
}

async function newsJob(g, npc) {
  const s = as(npc);
  if (g.state.fame < 250) {
    await g.say(['夕方のニュースを担当しています。原稿読みをお願いするのは、知名度★250以上の方なんです。', 'スタジオの左にいるベテランアナの滑舌レッスンで、まずは準備を！'], s);
    return;
  }
  await g.say(['ちょうどいいところに！', '夕方のニュースの「街の話題」コーナー、読んでもらえませんか？難しい読みの漢字に気をつけて！'], s);
  await nhkJob(g, {
    id: 'nhk_news', title: 'ニュース原稿読み', desc: '漢字の読みまちがいに注意！', client: npc.name, clientLook: npc.look,
    stamina: 20, minigame: 'announce', opts: { set: 'news', difficulty: 3, words: NEWS_WORDS, count: 5 }, pay: 10000, fame: 40, skill: 'talk', gain: 3,
    requires: { fame: 250 },
  });
}

async function quizPanel(g, speaker) {
  if (g.state.fame < 250) {
    await g.say(['解答者として出ていただくには、知名度★250くらいは欲しいですねえ。', 'まずは「一般参加の予選会」で腕だめししてみては？右の方のADが受付中です！'], speaker);
    return;
  }
  const i = await g.ask(['おっ、{name}さん！今日のクイズ番組、解答者席がひとつ空いてるんです。', 'どちらの番組に出ます？'], ['雑学クイズ', 'テレビクイズ', 'やめておく'], speaker);
  if (i !== 0 && i !== 1) return;
  const cat = i === 0 ? 'general' : 'tv';
  await nhkJob(g, {
    id: 'nhk_quiz_' + cat, title: i === 0 ? '雑学クイズ番組の解答者' : 'テレビクイズ番組の解答者', client: speaker.name, clientLook: speaker.look,
    stamina: 25, minigame: 'quiz', opts: { difficulty: 3, category: cat, count: 5 }, pay: 12000, fame: 45, skill: 'talk', gain: 3,
    requires: { fame: 250 },
  });
}

async function morningDrama(g, npc) {
  const s = as(npc);
  if (g.state.fame < 1000) {
    await g.say(['朝の連続ドラマの演出をしています。', '毎朝、日本中の人が見てくれるドラマです。出演は知名度★1000以上の方にお願いしているんですよ。'], s);
    return;
  }
  await g.say(['{name}さん、いいところに！', 'ヒロインの幼なじみ役、ぜひ{name}さんにお願いしたいんです！'], s);
  await nhkJob(g, {
    id: 'nhk_morning_drama', title: '朝の連続ドラマに出演', desc: 'ヒロインの幼なじみ役！', client: npc.name, clientLook: npc.look,
    stamina: 25, minigame: 'command', opts: { difficulty: 4, theme: 'acting' }, pay: 30000, fame: 110, skill: 'engi', gain: 4,
    requires: { fame: 1000 },
  });
}

async function historyDrama(g, npc) {
  const s = as(npc);
  if (g.state.fame < 2000) {
    await g.say(['日曜夜の歴史ドラマの監督だ。', '主演は一年の顔。知名度★2000…「スター」と呼ばれるくらいの人にしか任せられないな。', 'セットにいる殺陣師さんの稽古で、腕を磨いておくといい。'], s);
    return;
  }
  // burnout / starving: refuse before the costume fitting (g.job would only refuse after it)
  const tired = g.lifeRefusal();
  if (tired) { await g.say(tired); return; }
  const i = await g.ask(['{name}さん…次の主演は、君しかいない！', `「日曜夜の歴史ドラマで主演」\nギャラ 目安¥70,000（出来で変動）／体力 -30・ストレス +${ACTIVITY.job.stress}`], ['引き受ける', 'やめておく'], s);
  if (i !== 0) return;
  if (g.state.stamina < 30) { await g.say('体力が足りない…。\n家で休むか、何か食べて回復しよう。'); return; }
  await g.fadeOut(12);
  g.sfx('drum');
  await g.wait(500);
  await g.fadeIn(12);
  await g.say('（衣装さんに着付けてもらい、凛々しい若武者の姿になった！）');
  await g.emote('nhk_tate', '!');
  await g.say('殺陣は呼吸が命。相手を信じて、思いきり斬り結べ！', { name: '殺陣師', look: L.tate });
  await g.say('シーン42、決戦の朝。\nよーい…', s);
  g.sfx('snare');
  await g.say('スタート！', s);
  await nhkJob(g, {
    id: 'nhk_history_drama', title: '日曜夜の歴史ドラマで主演', client: npc.name, clientLook: npc.look, confirm: false,
    stamina: 30, minigame: 'command', opts: { difficulty: 5, theme: 'tate' }, pay: 70000, fame: 250, skill: 'engi', gain: 5,
    requires: { fame: 2000 },
  });
}

async function announceBooth(g) {
  const s = { name: '体験コーナー', look: L.boothStaff };
  if (today(g, 'nhk_booth_day')) {
    await g.say(['アナウンサー体験は1日1回なんです。', 'また明日、チャレンジしに来てくださいね！'], s);
    return;
  }
  const i = await g.ask(['アナウンサー体験コーナーへようこそ！', 'ニュース原稿を読んでみませんか？（無料・1日1回）'], ['やってみる', 'やめておく'], s);
  if (i !== 0) return;
  markToday(g, 'nhk_booth_day');
  const res = await g.minigame('announce', { set: 'news', difficulty: 1, words: EASY_WORDS, count: 3, title: 'アナウンサー体験', skill: 'talk' });
  const good = res && (res.rank === 'S' || res.rank === 'A');
  g.addSkill('talk', good ? 2 : 1, true);
  g.sfx('good');
  await g.say(good ? 'すごい！本物のアナウンサーみたいでした！' : 'おつかれさまでした！はっきり読めていましたよ。', s);
  await g.say(`トークが${good ? 2 : 1}上がった！`);
}

async function watchRehearsal(g, npc) {
  const s = as(npc);
  if (finalePending(g)) {
    await g.say(['{name}さん！本番、楽しみにしています！', '準備ができたら、舞台監督に声をかけてくださいね。'], s);
    return;
  }
  if (g.flag('finaleDone')) {
    await g.say(['あの年末のステージ、客席の案内をしながら見ていました。', 'ペンライトの海…一生忘れません！'], s);
  }
  if (today(g, 'nhk_watch_day')) {
    await g.say('リハーサルの見学は1日1回なんです。\nまた明日どうぞ！', s);
    return;
  }
  const i = await g.ask(['ただいま合唱団の公開リハーサル中です。', '客席で見学していきますか？（無料）'], ['見学する', 'やめておく'], s);
  if (i !== 0) return;
  markToday(g, 'nhk_watch_day');
  await g.fadeOut(16);
  g.sfx('applause');
  await g.wait(700);
  await g.fadeIn(16);
  g.addSkill('uta', 1, true);
  g.sfx('good');
  await g.say(['美しいハーモニーに聞きほれた…！', '歌のコツが少しつかめた気がする。（歌+1）']);
}

// ====================================================================== place
const S_LOBBY = { x: 9, y: 12 };

registerPlace({
  id: 'nhk',
  name: 'NHK放送センター',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: S_LOBBY.x, y: S_LOBBY.y, dir: 'up' },
  legend: {
    '#': 'nhk_walltop',
    '=': 'nhk_wall',
    u: 'nhk_wall_hi',
    w: 'nhk_wall+window',
    p: 'nhk_wall+poster_wide',
    c: 'nhk_wall+clock',
    m: 'nhk_mat',
    P: 'plant',
  },
  rooms: {
    // ------------------------------------------------------------------ エントランスホール
    lobby: {
      floor: 'nhk_floor',
      tiles: [
        '####################',
        '#uuuuVVuuuuuuVVuuuu#',
        '#g====v======v====g#',
        '#..................#',
        '#P.....KKKKKK.....P#',
        '#........rr.....B..#',
        '#........rr........#',
        '#........rr........#',
        '#GG...SS.rr.SS.....#',
        '#..P..tt.rr.tt.....#',
        '#CCC.....rr........#',
        '#........rr........#',
        '#P.......rr.......P#',
        '#########MM#########',
      ],
      legend: {
        V: 'nhk_wall_hi+tv_wall', v: 'nhk_wall+tv_wall', K: 'counter_white', B: 'sign_board',
        G: 'shelf_goods', C: 'counter', t: 'table_white', S: 'sofa_blue', r: 'nhk_runner',
      },
      warps: [
        { x: 9, y: 13, to: 'exit' }, { x: 10, y: 13, to: 'exit' },
        { x: 1, y: 2, room: 'gallery', tx: 8, ty: 10, dir: 'up' },
        { x: 18, y: 2, room: 'corridor', tx: 2, ty: 5, dir: 'up' },
      ],
      entities: [
        {
          type: 'logo', x: 7.5, y: 1.1, w: 5, h: 1.8, logo: 'nhk',
          talk: async (g) => { await g.showLogo('nhk', 'NHK放送センター'); await g.say('大きなNHKのロゴだ。\nここから毎日、たくさんの番組が届けられている。'); },
        },
        plate(2, 2, 'ギャラリー', 4),
        plate(14, 2, 'スタジオ棟', 4),
        { type: 'sign', x: 16, y: 5, text: '「スタジオ見学ツアー 受付中！」\n1日1回・無料。ガイドさんに声をかけてね。' },
        {
          type: 'npc', id: 'nhk_recep', x: 9, y: 3, dir: 'down', look: L.recep, name: '受付さん',
          talk: async (g, npc) => {
            const s = as(npc);
            if (finalePending(g)) { await g.say(['{name}さん！プロデューサーがお待ちかねですよ。', '入り口の近くにいらっしゃいます！'], s); return; }
            if (g.flag('finaleDone')) { await g.say(['あっ、{name}さん！', '年末の歌番組、受付のみんなで見ていました。本当に感動しました…！'], s); return; }
            await g.say(['ようこそ、NHK放送センターへ！', '左のドアは「放送の歴史ギャラリー」、右のドアはスタジオ棟とNHKホールにつながっています。', 'お仕事のことは、となりの「お仕事案内」にどうぞ。'], s);
            // real programs of this era (programs.js): the reception takes appearance requests
            if (programsAt('nhk', eraKey(g.state)).length) {
              const i = await g.ask('番組への出演の相談もできますよ。', ['番組の相談をする', 'またこんど'], { ...s, cancel: 1 });
              if (i === 0) await programDesk(g, 'nhk', npc);
            }
          },
        },
        { type: 'npc', id: 'nhk_info', x: 11, y: 3, dir: 'down', look: L.recep2, name: 'お仕事案内', talk: jobGuide },
        {
          type: 'npc', id: 'nhk_guide', x: 15, y: 6, dir: 'down', look: L.guide, sprite: guideSprite, name: 'ガイドさん',
          talk: async (g) => startTour(g),
        },
        {
          type: 'npc', id: 'nhk_clerk', x: 2, y: 9, dir: 'down', look: L.clerk, name: '売店のお兄さん',
          talk: async (g, npc) => {
            await g.shop(['onigiri', 'drink', 'nhk_lokeben', 'nodoame', 'wadai', 'daihon'], { title: 'NHK 売店', greeting: 'いらっしゃいませ！ロケ弁が人気ですよ。' });
            await g.say('ありがとうございました！\nお仕事の前は、しっかり腹ごしらえを！', as(npc));
          },
        },
        {
          type: 'npc', id: 'nhk_visitor', x: 5, y: 3, dir: 'up', look: L.visitor, name: '見学のおじさん', fixedDir: true,
          text: ['モニターで今日の番組が流れてるんですよ。どれも面白そうだなあ。', '売店のロケ弁、ボリューム満点でおすすめですよ。'],
        },
        {
          type: 'npc', id: 'nhk_kid', x: 5, y: 10, dir: 'up', look: L.kid, name: '見学の子ども', wander: 1,
          text: ['テレビ局ってすごーい！', 'ガイドのおねえさんのツアーに行くと、ニュースのスタジオも見られるんだって！'],
        },
        {
          type: 'npc', id: 'nhk_producer', x: 13, y: 11, dir: 'left', look: L.producer, name: 'プロデューサー',
          cond: (g) => finalePending(g) && !SHOW.on,
          talk: async (g) => {
            await g.say('{name}さん！お待ちしておりました！', SP.producer);
            await finaleOffer(g, SP.producer);
          },
        },
        {
          type: 'npc', id: 'nhk_fan', x: 16, y: 11, dir: 'left', look: L.fan, name: 'ファンの子',
          cond: (g) => !!g.flag('finaleDone'),
          talk: async (g, npc) => {
            await g.emote('nhk_fan', '♥');
            await g.say(['きゃー！{name}さんだ！', '年末の歌番組、最高でした！サインください！'], as(npc));
            g.sfx('ok');
            await g.say('（色紙にサインをした）');
          },
        },
      ],
      events: [
        {
          x: 9, y: 11, w: 2, on: 'step', once: 'nhk_welcome',
          run: async (g) => {
            await g.emote('nhk_recep', '!');
            await g.say(['NHK放送センターへようこそ！', 'ご見学の方は、ガイドさんの「スタジオ見学ツアー」がおすすめですよ♪'], SP.recep);
          },
        },
      ],
      onEnter: async (g) => {
        if (TOUR.on || SHOW.on) return;
        const fresh = ensureInvite(g);
        if (!finalePending(g)) return;
        const p = g.map.player;
        const atStart = p.x === S_LOBBY.x && p.y === S_LOBBY.y;
        if (!fresh && (g.flag('nhk_finale_greeted') || !atStart)) return;
        g.setFlag('nhk_finale_greeted', true);
        await producerApproach(g, fresh);
      },
    },

    // ------------------------------------------------------------------ スタジオ棟の廊下
    corridor: {
      floor: 'floor_tile',
      tiles: [
        '########################',
        '#uuuuuuuuuuuuuuuuuuuuuu#',
        '#=DO=p=DO=p=DO=p=DO=gg=#',
        '#Q....................V#',
        '#......................#',
        '#....P....SS......P....#',
        '##mm####################',
      ],
      legend: { D: 'door_metal', O: 'nhk_wall+onair', g: 'door_glass', Q: 'water_server', V: 'vending', S: 'sofa_blue' },
      warps: [
        { x: 2, y: 6, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
        { x: 3, y: 6, room: 'lobby', tx: 18, ty: 3, dir: 'down' },
        { x: 2, y: 2, room: 'news', tx: 7, ty: 10, dir: 'up' },
        { x: 7, y: 2, room: 'quiz', tx: 8, ty: 10, dir: 'up' },
        { x: 12, y: 2, room: 'kids', tx: 7, ty: 9, dir: 'up' },
        { x: 17, y: 2, room: 'drama', tx: 10, ty: 12, dir: 'up' },
        { x: 20, y: 2, room: 'hall', tx: 10, ty: 19, dir: 'up' },
        { x: 21, y: 2, room: 'hall', tx: 11, ty: 19, dir: 'up' },
      ],
      entities: [
        plate(1, 1, 'ニュース'),
        plate(6, 1, 'クイズ'),
        plate(11, 1, 'こども'),
        plate(16, 1, 'ドラマ'),
        plate(19.5, 1, 'NHKホール', 3),
        tourGuide('corridor', 4, 3, 'right'),
        {
          type: 'npc', id: 'nhk_guard', x: 19, y: 3, dir: 'down', look: L.guard, name: '警備員さん',
          talk: async (g, npc) => {
            const s = as(npc);
            if (finalePending(g)) { await g.say(['{name}さん！ホールでみんなが出番を待っていますよ。', 'がんばってください！'], s); return; }
            if (g.flag('finaleDone')) { await g.say('あの日のステージ…警備しながら、泣いちゃいました。\nこれからも応援しています！', s); return; }
            await g.say(['お疲れさまです！この先はNHKホールです。', '年末には、日本中が注目する歌番組がここから生放送されるんです。', 'いつか{name}さんも、あの舞台に…なんてね！'], s);
          },
        },
        {
          type: 'npc', id: 'nhk_ad', x: 9, y: 4, dir: 'left', look: L.ad, name: 'AD', wander: 1,
          text: ['すみませーん、通りまーす！…あ、見学の方ですか？', 'ドアの横の「ON AIR」ランプが光ってたら本番中。静かにお願いしますね！', 'ちなみに奥から、ニュース・クイズ・こども番組・ドラマのスタジオです。'],
        },
        {
          type: 'npc', id: 'nhk_actor', x: 14, y: 4, dir: 'down', look: L.actor, name: '出演者さん', wander: 1,
          text: ['これからドラマの撮影なんです。セリフ、ちゃんと覚えたかな…。', '朝のドラマも歴史ドラマも、ドラマスタジオで撮ってるんですよ。'],
        },
      ],
    },

    // ------------------------------------------------------------------ ニューススタジオ
    news: {
      floor: 'nhk_studio_floor',
      bgm: 'studio',
      tiles: [
        '################',
        '#=O=NNNNNNNN=SS#',
        '#T.............#',
        '#T...lpnnpr....#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#Y.C..Q..Q..C.Y#',
        '#..............#',
        '#..............#',
        '#..............#',
        '#######mm#######',
      ],
      legend: {
        O: 'nhk_wall+onair', N: 'nhk_news_wall', S: 'nhk_wall+nhk_subcon', T: 'monitor', Y: 'spotlight',
        l: 'nhk_desk_l', p: 'nhk_desk_p', n: 'nhk_desk_m', r: 'nhk_desk_r', C: 'nhk_cam', Q: 'nhk_prompter',
      },
      warps: [
        { x: 7, y: 11, room: 'corridor', tx: 2, ty: 3, dir: 'down' },
        { x: 8, y: 11, room: 'corridor', tx: 2, ty: 3, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 6.5, y: 1.08, w: 3, h: 0.85, logo: 'nhk' },
        tourGuide('news', 7, 9, 'up'),
        { type: 'sign', x: 13, y: 1, text: 'ガラスの向こうは副調整室（サブ）。\nスタッフさんが映像や音声を切りかえている。' },
        { type: 'sign', x: 14, y: 1, text: 'ガラスの向こうは副調整室（サブ）。\nスタッフさんが映像や音声を切りかえている。' },
        {
          type: 'npc', id: 'nhk_anchorF', x: 6, y: 2, dir: 'down', look: L.anchorF, name: 'アナウンサー', person: 'asagiri',
          text: ['こんにちは！ニュースは、まっすぐカメラを見て、はっきり、ゆっくり読むのがコツです。', '難しい漢字の読み方は、毎日の積み重ねですね。'],
        },
        {
          type: 'npc', id: 'nhk_anchorM', x: 9, y: 2, dir: 'down', look: L.anchorM, name: 'アナウンサー',
          text: ['カメラの前の透明な板に、原稿が映っているんです。「プロンプター」っていうんですよ。', 'でも念のため、手元にも紙の原稿を置いています。'],
        },
        { type: 'npc', id: 'nhk_newsdesk', x: 13, y: 5, dir: 'left', look: L.desk, name: 'ニュースデスク', talk: newsJob },
        {
          type: 'npc', id: 'nhk_veteran', x: 2, y: 5, dir: 'right', look: L.veteran, name: 'ベテランアナ',
          talk: async (g, npc) => {
            const s = as(npc);
            await g.say(['アナウンサー歴は…ふふ、ナイショ。', 'ことばを正しく、聞きとりやすく届けるのが私たちの仕事です。'], s);
            const res = await g.lesson({ title: '滑舌レッスン', skill: 'talk', price: 3000, stamina: 12, gain: 4, minigame: 'announce', opts: { set: 'news', difficulty: 1, words: EASY_WORDS, count: 3 }, teacher: npc.name });
            if (!res) await g.say('「なまむぎ なまごめ なまたまご」…毎日の早口ことばも効きますよ。', s);
          },
        },
        {
          type: 'npc', id: 'nhk_fd', x: 11, y: 6, dir: 'left', look: L.fd, name: 'フロアディレクター',
          text: ['ぼくはフロアディレクター。スタジオでカンペを出したり、本番のキューを出したりします。', '手をぐるぐる回す「巻いて！」の合図は、急いで！という意味。覚えておくと役に立ちますよ。'],
        },
        {
          type: 'npc', id: 'nhk_cameraman', x: 3, y: 8, dir: 'up', look: L.cameraman, name: 'カメラマン',
          text: ['カメラは重いけど、なめらかに動かすのが腕の見せどころ！', 'カメラの上の赤いランプが光ってたら、そのカメラが今 映してるって合図なんだ。'],
        },
      ],
    },

    // ------------------------------------------------------------------ クイズスタジオ
    quiz: {
      floor: 'nhk_quiz_floor',
      bgm: 'studio',
      tiles: [
        '##################',
        '#=L=L========L=L=#',
        '#................#',
        '#.......1.2.3.4..#',
        '#..H.............#',
        '#................#',
        '#................#',
        '#..C......C....C.#',
        '#................#',
        '#.SSSSSS..SSSSSS.#',
        '#................#',
        '########mm########',
      ],
      legend: {
        L: 'nhk_wall+nhk_lights', 1: 'nhk_booth_r', 2: 'nhk_booth_b', 3: 'nhk_booth_y', 4: 'nhk_booth_g',
        H: 'nhk_podium', C: 'nhk_cam', S: 'seat',
      },
      warps: [
        { x: 8, y: 11, room: 'corridor', tx: 7, ty: 3, dir: 'down' },
        { x: 9, y: 11, room: 'corridor', tx: 7, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'prop', id: 'nhk_scoreboard', x: 5.5, y: 0.3, w: 7, h: 1.55, solid: true,
          talk: async (g) => {
            const n = (g.state.jobs.nhk_quiz_general || 0) + (g.state.jobs.nhk_quiz_tv || 0);
            await g.say(n ? `得点ボードだ。緑の席の得点は${n * 10}点…{name}の記録だ！` : '得点ボードだ。いまのトップは、黄色い席のクイズ女王さん！\n緑の席は…まだ空席だ。');
          },
          draw(ctx, sx, sy, g) {
            const w = 112, h = 25;
            F(ctx, sx, sy, w, h, '#14182c'); F(ctx, sx + 1, sy + 1, w - 2, h - 2, '#20263f');
            const n = (g.state.jobs.nhk_quiz_general || 0) + (g.state.jobs.nhk_quiz_tv || 0);
            const cols = [['#e0443e', '120'], ['#2f6fd0', '90'], ['#e8b52a', '150'], ['#2f9a4a', n ? String(n * 10) : '---']];
            cols.forEach(([col, sc], i) => {
              const x = sx + 4 + i * 27;
              F(ctx, x, sy + 3, 24, 4, col);
              F(ctx, x, sy + 8, 24, 14, '#0b0e1c');
              text(ctx, sc, x + 12, sy + 10, { size: 10, align: 'center', color: '#ffd23f', shadow: null });
            });
            for (let i = 0; i < 14; i++) if ((Math.floor(g.frame / 10) + i) % 3 === 0) F(ctx, sx + 4 + i * 8, sy, 2, 1, '#fff6a8');
          },
        },
        {
          type: 'npc', id: 'nhk_quizhost', x: 2, y: 4, dir: 'right', look: L.host, name: '司会者',
          talk: async (g, npc) => quizPanel(g, as(npc)),
        },
        {
          type: 'npc', id: 'nhk_hakase', x: 8, y: 2, dir: 'down', look: L.hakase, name: '物知り博士',
          text: ['今日のテーマは何かのう。どんな問題でもドンと来いじゃ！', 'クイズはな、知識だけじゃなく「ひらめき」も大事なんじゃよ。'],
        },
        {
          type: 'npc', id: 'nhk_queen', x: 12, y: 2, dir: 'down', look: L.queen, name: 'クイズ女王',
          text: ['早押しのコツ？問題文を最後まで…ふふ、それは秘密。', '黄色い席は、いつだって私の指定席よ。'],
        },
        {
          type: 'npc', id: 'nhk_geinin', x: 10, y: 2, dir: 'down', look: L.geinin, name: '若手芸人',
          text: ['ボケる場所を探してたら、問題が終わってもうたわ…。', 'クイズ番組はな、正解するだけやなくて、トークで盛り上げるのも大事なんやで！'],
        },
        {
          type: 'npc', id: 'nhk_quizad', x: 16, y: 5, dir: 'left', look: L.ad, name: 'AD',
          talk: async (g, npc) => {
            await g.say(['クイズ番組の「一般参加予選会」、受付中でーす！', 'どなたでも参加OK！放送やテレビにまつわる問題が出ますよ。'], as(npc));
            await nhkJob(g, {
              id: 'nhk_quiz_yosen', title: 'クイズ番組の一般予選', desc: '放送やテレビにまつわる問題が出ます！', client: npc.name, clientLook: npc.look,
              stamina: 15, minigame: 'quiz', opts: { difficulty: 1, questions: NHK_QUIZ, count: 3 }, pay: 1000, fame: 5, skill: 'talk', gain: 1,
            });
          },
        },
        {
          type: 'npc', id: 'nhk_qfan', x: 4, y: 9, dir: 'up', look: L.fan, name: '観覧のお客さん',
          text: ['クイズ番組の観覧、はじめて当たったの！', '解答者席にいつか知ってる人が座ったら、全力で応援しちゃう！'],
        },
        {
          type: 'npc', id: 'nhk_qgranny', x: 12, y: 9, dir: 'up', look: LOOKS.oldwoman, name: '観覧のおばあさん',
          text: ['孫がクイズ番組が大好きでねえ。今日はおみやげ話を持って帰るのよ。', '答えがわかっても、声に出しちゃダメなのが難しいわねえ。'],
        },
      ],
      events: [
        {
          x: 14, y: 3, on: 'action',
          run: async (g) => {
            await g.say('緑色の解答者席だ。いまは空いている。');
            if (g.state.fame >= 250) await quizPanel(g, { name: '司会者', look: L.host });
            else await g.say('（知名度が★250くらいになれば、ここに座れるかも…？）');
          },
        },
      ],
    },

    // ------------------------------------------------------------------ こども番組スタジオ
    kids: {
      floor: 'nhk_kids_mat',
      bgm: 'nhk_kids',
      tiles: [
        '################',
        '#KKKKKKKKKKKKKK#',
        '#.T....U.....T.#',
        '#..............#',
        '#Y.............#',
        '#..............#',
        '#..............#',
        '#,,,,,,,,,,,,,,#',
        '#,,,C,,,,,,C,,,#',
        '#,,,,,,,,,,,,,,#',
        '#######mm#######',
      ],
      legend: {
        '#': 'nhk_walltop', K: 'nhk_kids_wall', T: 'nhk_kids_tree', U: 'nhk_kids_sun', Y: 'piano',
        ',': 'nhk_studio_floor', C: 'nhk_studio_floor+nhk_cam',
      },
      warps: [
        { x: 7, y: 10, room: 'corridor', tx: 12, ty: 3, dir: 'down' },
        { x: 8, y: 10, room: 'corridor', tx: 12, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'nhk_mascot', x: 7, y: 3, dir: 'down', name: 'ドットン', sprite: mascotSprite, wander: 1,
          talk: async (g) => {
            await g.emote('nhk_mascot', '♪');
            await g.say(['ドットンだよ！みんなー、げんきー？', 'うたのおにいさん・おねえさんといっしょに、うたって おどろう！'], SP.mascot);
          },
        },
        { type: 'npc', id: 'nhk_kidsdir', x: 13, y: 7, dir: 'left', look: L.kidsDir, name: '番組ディレクター', talk: kidsJob },
        {
          type: 'npc', id: 'nhk_pianist', x: 2, y: 4, dir: 'down', look: L.pianist, name: 'ピアノのおねえさん',
          text: ['こんにちは〜♪', 'こどもたちの前で歌うときは、笑顔がいちばん大事。', 'リズムに合わせて、ボタンをポンッ！楽しく歌えば、自然と上手になりますよ。'],
        },
        { type: 'npc', id: 'nhk_kidA', x: 5, y: 6, dir: 'up', look: L.kidA, name: 'こども', text: ['ドットン だいすきー！', 'あのね、ドットンのおなかは、ふわふわなんだよ！'] },
        { type: 'npc', id: 'nhk_kidB', x: 8, y: 6, dir: 'up', look: L.kidB, name: 'こども', text: ['おにいさん、おねえさん、だあれ？', 'いっしょに うたってくれるの？やったー！'] },
        { type: 'npc', id: 'nhk_kidC', x: 10, y: 5, dir: 'left', look: L.kidC, name: 'こども', wander: 1, text: ['きょうは テレビに でるんだよ！', 'ママ、みててくれるかなあ。'] },
        { type: 'sign', x: 7, y: 2, text: 'ベニヤ板でできた、にこにこ顔のおひさまだ。\nこども番組らしい、あったかいセット！' },
      ],
    },

    // ------------------------------------------------------------------ ドラマスタジオ
    drama: {
      floor: 'nhk_studio_floor',
      bgm: 'studio',
      tiles: [
        '######################',
        '#=O================O=#',
        '#sssssssssbbfffffffff#',
        '#hvTTTTTTT..ATTZZZTKA#',
        '#TTTTcTTTT..TTTTTTTTT#',
        '#TTTTTTTTT..TTTTTTTTT#',
        '#eeeeeeeee..TTTTTTTTT#',
        '#....................#',
        '#L..................L#',
        '#...C...C......C...C.#',
        '#..........D.........#',
        '#R...................#',
        '#....................#',
        '##########mm##########',
      ],
      legend: {
        '#': 'walltop_dark', '=': 'wall_dark', O: 'wall_dark+onair',
        s: 'nhk_shoji', b: 'nhk_setback', f: 'nhk_fusuma', T: 'floor_tatami', e: 'floor_wood_dark',
        h: 'floor_tatami+nhk_tansu', v: 'floor_tatami+tv', c: 'floor_tatami+nhk_chabudai',
        A: 'floor_tatami+nhk_andon', Z: 'floor_tatami+nhk_byobu', K: 'floor_tatami+nhk_katana',
        L: 'spotlight', C: 'nhk_cam', D: 'director_chair', R: 'clothes_rack',
      },
      warps: [
        { x: 10, y: 13, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
        { x: 11, y: 13, room: 'corridor', tx: 17, ty: 3, dir: 'down' },
      ],
      entities: [
        tourGuide('drama', 12, 8, 'up'),
        { type: 'sign', x: 5, y: 4, text: 'ちゃぶ台に湯のみが並んでいる。\n昭和の茶の間そのものだ！' },
        { type: 'sign', x: 2, y: 3, text: '昔ながらのテレビだ。もちろん撮影用の小道具。\n画面には何も映っていない。' },
        { type: 'sign', x: 1, y: 3, text: '古いたんすだ。引き出しを開けると…中は空っぽ。\nセットだもんね。' },
        { type: 'sign', x: 15, y: 3, text: '金色の屏風だ。まぶしい…！\n殿さまが座る場所の後ろに立てられている。' },
        { type: 'sign', x: 17, y: 3, text: '金色の屏風だ。まぶしい…！\n殿さまが座る場所の後ろに立てられている。' },
        { type: 'sign', x: 19, y: 3, text: '刀掛けだ。もちろん撮影用の小道具で、刃はついていない。' },
        { type: 'sign', x: 12, y: 3, text: '行灯（あんどん）だ。中は安全な電球になっている。' },
        { type: 'sign', x: 11, y: 10, text: '監督のイスだ。背もたれに「監督」と書いてある。\n座るのはやめておこう…。' },
        {
          type: 'npc', id: 'nhk_heroine', x: 6, y: 4, dir: 'left', look: L.heroine, name: 'ヒロイン役の俳優さん',
          text: ['朝のドラマは、毎朝たくさんの人が見てくれるんです。', 'だから、元気と笑顔をいっぱい届けたくて。一緒に出られる日を楽しみにしてますね！'],
        },
        { type: 'npc', id: 'nhk_morningdir', x: 4, y: 8, dir: 'up', look: L.dramaDir, name: '演出家さん', talk: morningDrama },
        { type: 'npc', id: 'nhk_historydir', x: 17, y: 8, dir: 'up', look: L.historyDir, name: '監督', talk: historyDrama },
        {
          type: 'npc', id: 'nhk_tate', x: 14, y: 5, dir: 'down', look: L.tate, name: '殺陣師',
          talk: async (g, npc) => {
            const s = as(npc);
            await g.say(['殺陣師（たてし）だ。斬り合いの動きを考えて、役者に教えるのが仕事さ。', '殺陣は踊りと同じ。相手との呼吸が合えば、本物より本物らしく見える。'], s);
            const res = await g.lesson({ title: '殺陣の稽古', skill: 'engi', price: 5000, stamina: 15, gain: 5, minigame: 'command', opts: { difficulty: 2, theme: 'tate' }, teacher: npc.name });
            if (!res) await g.say('いつでも稽古をつけてやるぞ。\n歴史ドラマの主演を狙うなら、なおさらだ。', s);
          },
        },
        {
          type: 'npc', id: 'nhk_lord', x: 16, y: 4, dir: 'down', look: L.lord, name: '殿さま役の俳優さん',
          text: ['うむ、苦しゅうない。…あ、今のはセリフの練習です。', '歴史ドラマの衣装はとっても重いんですよ。でも、着るとシャキッとするんです。'],
        },
        {
          type: 'npc', id: 'nhk_extra', x: 18, y: 5, dir: 'left', look: L.extra, name: '侍エキストラ',
          text: ['拙者、斬られ役一筋でござる。', '上手に斬られるのも、立派な芸なのでござるよ。'],
        },
        {
          type: 'npc', id: 'nhk_costume', x: 2, y: 11, dir: 'up', look: L.costume, name: '衣装さん',
          text: ['着物やカツラは、時代に合わせてしっかり調べて用意しているんです。', '朝のドラマの衣装は昭和レトロ！かわいいでしょ？'],
        },
      ],
    },

    // ------------------------------------------------------------------ 放送の歴史ギャラリー
    gallery: {
      floor: 'floor_carpet_blue',
      tiles: [
        '##################',
        '#uuuuuuuuuuuuuuuu#',
        '#=aa==========aa=#',
        '#................#',
        '#................#',
        '#..R...T...M...X.#',
        '#................#',
        '#................#',
        '#.............BB.#',
        '#................#',
        '#................#',
        '########mm########',
      ],
      legend: {
        a: 'nhk_wall+nhk_panel', R: 'nhk_ex_radio', T: 'nhk_ex_tv', M: 'nhk_ex_mic', X: 'nhk_showcase', B: 'nhk_booth',
      },
      warps: [
        { x: 8, y: 11, room: 'lobby', tx: 1, ty: 3, dir: 'down' },
        { x: 9, y: 11, room: 'lobby', tx: 1, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'logo', x: 4.75, y: 1.15, w: 3.5, h: 1.7, logo: 'nhk_old',
          talk: async (g) => {
            await g.showLogo('nhk_old', '昔のNHKのロゴ');
            await g.say('丸いかたちが並んだ、昔のNHKのロゴだ。\nどこかなつかしい雰囲気がある。');
          },
        },
        {
          type: 'logo', x: 9.75, y: 1.15, w: 3.5, h: 1.7, logo: 'nhk',
          talk: async (g) => {
            await g.showLogo('nhk', 'いまのNHKのロゴ');
            await g.say('いまのNHKのロゴだ。\n昔のロゴと見比べると、ずいぶん印象が違う！');
          },
        },
        {
          type: 'prop', x: 8.25, y: 1.5, w: 1.5, h: 1, solid: false,
          draw(ctx, sx, sy) {
            F(ctx, sx + 4, sy + 6, 12, 4, '#2f5fb8');
            for (let i = 0; i < 6; i++) F(ctx, sx + 16 + i, sy + 2 + i, 1, 12 - i * 2, '#2f5fb8');
          },
        },
        tourGuide('gallery', 7, 4, 'right'),
        { type: 'sign', x: 3, y: 5, text: '【ラジオ】\n日本のラジオ放送は、1925年に始まりました。\nラジオを囲んだ時代の、なつかしいかたち。' },
        { type: 'sign', x: 7, y: 5, text: '【テレビ】\n日本のテレビ放送は、1953年に始まりました。\n当時のテレビは、とても貴重なものだったそうです。' },
        { type: 'sign', x: 11, y: 5, text: '【マイク】\n昔ながらのかたちをしたマイクの展示だ。\nこれで、どんな声が届けられたんだろう。' },
        { type: 'sign', x: 15, y: 5, text: '番組で使われた小道具や台本が並んでいる。\nどれも思い出がつまっていそうだ。' },
        { type: 'sign', x: 2, y: 2, text: '「放送のあゆみ」のパネル。\nラジオからテレビへ、白黒からカラーへ…放送の歴史が写真で紹介されている。' },
        { type: 'sign', x: 3, y: 2, text: '「放送のあゆみ」のパネル。\nラジオからテレビへ、白黒からカラーへ…放送の歴史が写真で紹介されている。' },
        { type: 'sign', x: 14, y: 2, text: '「番組づくりの裏側」のパネル。\nカメラ、照明、音声、美術…たくさんの人が一つの番組を作っている。' },
        { type: 'sign', x: 15, y: 2, text: '「番組づくりの裏側」のパネル。\nカメラ、照明、音声、美術…たくさんの人が一つの番組を作っている。' },
        {
          type: 'npc', id: 'nhk_curator', x: 9, y: 7, dir: 'down', look: L.curator, name: '学芸員さん',
          text: ['「放送の歴史ギャラリー」へようこそ。', '日本でラジオ放送が始まったのは1925年、テレビ放送が始まったのは1953年なんですよ。', '奥の壁には、昔のロゴといまのロゴを並べてあります。ぜひ見比べてみてください。'],
        },
        {
          type: 'npc', id: 'nhk_oldman', x: 3, y: 6, dir: 'up', look: L.oldman, name: 'おじいさん', fixedDir: true,
          text: ['わしが子どもの頃はのう、テレビのある家に、近所の子どもが集まったもんじゃ。', 'みんなで同じ番組を見て、同じところで笑う…テレビってのは、ええもんじゃのう。'],
        },
        { type: 'npc', id: 'nhk_mom', x: 6, y: 7, dir: 'up', look: L.mom, name: '見学のお母さん', text: ['この古いテレビ、画面が小さくてかわいいわね。', 'いまのテレビとくらべると、ずいぶん厚みがあるのねえ。'] },
        { type: 'npc', id: 'nhk_boothstaff', x: 15, y: 7, dir: 'down', look: L.boothStaff, name: '体験コーナー', talk: async (g) => announceBooth(g) },
      ],
      events: [{ x: 14, y: 8, on: 'action', run: async (g) => announceBooth(g) }],
    },

    // ------------------------------------------------------------------ NHKホール
    hall: {
      floor: 'floor_carpet_red',
      bgm: 'theater',
      tiles: [
        '######################',
        '#UUUUUUUUUUUUUUUUUUUU#',
        '#=dVVVVVVVVVVVVVVVV==#',
        '#C,,,,,,,,,,,,,,,,,,C#',
        '#C,,,,,,,,,,,,,,,,,,C#',
        '#C,,,,,,,,,,,,,,,,,,C#',
        '#C,,,,,,,,,,,,,,,,,,C#',
        '#C,,,,,,,,,,,,,,,,,,C#',
        '#CsEEEEEEEEEEEEEEEEsC#',
        '#....................#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#....................#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#.SSSSSSSS..SSSSSSSS.#',
        '#....................#',
        '#....................#',
        '##########mm##########',
      ],
      legend: {
        '#': 'nhk_hallwalltop', '=': 'nhk_hallwall', U: 'nhk_hallwall_hi', d: 'door_metal', V: 'curtain_top', C: 'curtain',
        ',': 'floor_stage', s: 'stairs_up', E: 'stage_edge', S: 'seat',
      },
      warps: [
        { x: 10, y: 20, room: 'corridor', tx: 20, ty: 3, dir: 'down' },
        { x: 11, y: 20, room: 'corridor', tx: 21, ty: 3, dir: 'down' },
        { x: 2, y: 2, room: 'backstage', tx: 6, ty: 7, dir: 'up' },
      ],
      get hideHud() { return SHOW.on; },
      drawUnder: drawHallUnder,
      drawOver: drawHallOver,
      entities: [
        ledScreen(),
        { type: 'npc', id: 'nhk_choir1', x: 6, y: 4, dir: 'down', look: L.choirA, name: '合唱団', cond: () => !SHOW.on, text: ['ラ〜ラ〜ラ〜♪', '本番に向けてリハーサル中です。客席の案内係さんに言えば、見学もできますよ。'] },
        { type: 'npc', id: 'nhk_choir2', x: 8, y: 4, dir: 'down', look: L.choirB, name: '合唱団', cond: () => !SHOW.on, text: ['大きなホールで歌うときは、いちばん後ろの席まで届けるつもりで歌うんだ。'] },
        { type: 'npc', id: 'nhk_choir3', x: 13, y: 4, dir: 'down', look: L.choirA, name: '合唱団', cond: () => !SHOW.on, text: ['ハーモニーは、まわりの声をよーく聞くのがコツなの。'] },
        { type: 'npc', id: 'nhk_choir4', x: 15, y: 4, dir: 'down', look: L.choirB, name: '合唱団', cond: () => !SHOW.on, text: ['年末になると、このホールはペンライトの光でいっぱいになるんだよ。'] },
        {
          type: 'npc', id: 'nhk_conductor', x: 10, y: 7, dir: 'up', look: L.conductor, name: '指揮者', cond: () => !SHOW.on,
          text: ['はい、もう一度サビから！…おや、見学の方ですか。', '歌は、心をこめれば必ず届きます。それは、どんなに大きな舞台でも同じです。'],
        },
        {
          type: 'npc', id: 'nhk_stagemgr', x: 18, y: 4, dir: 'down', look: L.stageMgr, name: '舞台監督', cond: () => !SHOW.on,
          talk: async (g, npc) => {
            const s = as(npc);
            if (finalePending(g)) { await finaleOffer(g, s, true); return; }
            if (g.flag('finaleDone')) {
              await g.say(['{name}さん！またこのステージで歌ってくれませんか？', 'あの年末の歌声が忘れられないって、凱旋コンサートのリクエストが殺到してるんです！'], s);
              await nhkJob(g, {
                id: 'nhk_encore', title: 'NHKホール 凱旋コンサート', desc: 'あの舞台に、もう一度！', client: npc.name, clientLook: npc.look,
                stamina: 30, minigame: 'rhythm', opts: { difficulty: 5, lanes: 4, song: 'ありがとう、ニッポン' }, pay: 70000, fame: 250, skill: 'uta', gain: 5,
                requires: { fame: 2000 },
              });
              return;
            }
            await g.say(['このステージのことなら、何でも聞いてください。', '年末には、ここから大きな歌番組が生放送されるんです。', 'その舞台に立てるのは、日本中に愛される「国民的スター」だけ…。いつか{name}さんも、ね！'], s);
          },
        },
        {
          type: 'npc', id: 'nhk_usher', x: 13, y: 19, dir: 'left', look: L.usher, name: '案内係さん', cond: () => !SHOW.on,
          talk: async (g, npc) => watchRehearsal(g, npc),
        },
        {
          type: 'npc', id: 'nhk_producer2', x: 12, y: 5, dir: 'left', look: L.producer, name: 'プロデューサー',
          cond: (g) => !!g.flag('finaleDone') && !SHOW.on,
          text: ['{name}さん、あの年末のステージは、放送の歴史に残りますよ。', 'このホールは、いつでも{name}さんのために空けておきます！'],
        },
        { type: 'npc', id: 'nhk_host1', x: 15, y: 5, dir: 'left', look: L.host1, name: '総合司会', cond: () => SHOW.on, text: 'まもなく本番です！' },
        { type: 'npc', id: 'nhk_host2', x: 16, y: 5, dir: 'left', look: L.host2, name: '司会アナ', cond: () => SHOW.on, text: 'まもなく本番です！' },
      ],
      onEnter: async (g) => {
        if (SHOW.on || TOUR.on) return;
        const fresh = ensureInvite(g);
        if (!finalePending(g)) return;
        if (!fresh && g.map.player.y < 18) return;
        await g.emote('nhk_stagemgr', '!');
        await g.say(['{name}さん！お待ちしていました！', '年末の大型歌番組、本番のステージはもう準備万端です！'], SP.stageMgr);
        await finaleOffer(g, SP.stageMgr, true);
      },
    },

    // ------------------------------------------------------------------ 楽屋
    backstage: {
      floor: 'floor_tatami',
      wall: 'cream',
      bgm: 'office',
      tiles: [
        '##############',
        '#=RR=RR==p=c=#',
        '#.kk.kk......#',
        '#............#',
        '#F......oo...#',
        '#............#',
        '#Q...........#',
        '#F........SS.#',
        '######mm######',
      ],
      legend: {
        '#': 'walltop_cream', '=': 'wall_cream', p: 'wall_cream+poster', c: 'wall_cream+clock', R: 'wall_cream+mirror',
        k: 'makeup', o: 'table_low', F: 'flower_stand', Q: 'clothes_rack', S: 'sofa_beige', m: 'nhk_mat',
      },
      warps: [
        { x: 6, y: 8, room: 'hall', tx: 2, ty: 3, dir: 'down' },
        { x: 7, y: 8, room: 'hall', tx: 2, ty: 3, dir: 'down' },
      ],
      entities: [
        {
          type: 'npc', id: 'nhk_makeup', x: 4, y: 3, dir: 'down', look: L.makeupArtist, name: 'メイクさん',
          text: ['本番前のメイクは、わたしにおまかせ！ここは出演者さんの楽屋です。', 'ライトの下だと顔色が飛んじゃうから、テレビのメイクはしっかりめが基本なの。'],
        },
        { type: 'npc', id: 'nhk_bs_ad', x: 6, y: 7, dir: 'up', look: L.ad, name: 'AD', cond: () => SHOW.on, text: 'まもなく本番でーす！' },
        {
          type: 'sign', x: 1, y: 4,
          talk: async (g) => {
            if (g.flag('finaleDone')) await g.say('「祝・{name}さん ご出演」\n…自分あてのスタンド花だ！胸がいっぱいになる。');
            else await g.say('「祝・ご出演」のスタンド花だ。\nいつか自分の名前が書かれた花が届くといいな。');
          },
        },
        { type: 'sign', x: 1, y: 7, text: '「祝・公演成功」のスタンド花だ。\nいい香りがする。' },
      ],
      events: [
        {
          x: 8, y: 4, w: 2, on: 'action',
          run: async (g) => {
            if (today(g, 'nhk_bento_day')) { await g.say('（差し入れのお弁当はもう食べた。\nまた明日のお楽しみだ）'); return; }
            const i = await g.ask('差し入れのお弁当だ。「出演者・見学者のみなさま ご自由にどうぞ」と書いてある。', ['いただきます', 'やめておく']);
            if (i !== 0) return;
            markToday(g, 'nhk_bento_day');
            g.heal(20);
            g.sfx('good');
            await g.say('ごちそうさまでした！\n体力が20回復した。');
          },
        },
      ],
    },
  },
});
