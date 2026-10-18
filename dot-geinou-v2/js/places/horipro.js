// ホリプロ（東京）: ロビー / 事務所 / レッスンスタジオ（1F） / オーディション会場（2F）.
//
// - ロビー: 受付・案内係（最初の来訪でロゴ紹介）、架空タレントのポスター、スカウトマン、
//   受験者、見学の親子、先輩女優、警備員。エレベーターで2Fのオーディション会場へ。
// - 事務所: マネージャー（所属タレント向け: 雑誌モデル・CM / 歌番組 / ドラマ / 相談）、
//   制作プロデューサー（ミュージカル主演★1000 / 全国コンサートツアー★2000+所属 → 完走のお祝い）、
//   ファッション誌編集者（雑誌モデル・CM: 所属 or ★30）、TV局プロデューサー（歌番組・ドラマ★250）、
//   CM制作スタッフ（CMのエキストラ: 誰でも）、事務スタッフ（所属タレントに1日1回差し入れ）
// - レッスンスタジオ: ボイトレ（歌）、演技レッスン、ダンスレッスン（歌+演技）、研修生の通し稽古見学（1日1回 歌+1）
// - オーディション会場: 審査員3人＋進行係。歌部門（rhythm 2レーン）/ 演技部門（command acting）。
//   ステージに上がる前後に審査員のリアクション演出、合格するとマネージャーが駆けつける。
//   所属して★1000以上なら1日1回ゲスト審査員。
//
// All ids / flags are prefixed with "horipro_". Every character is fictional.

import { registerPlace } from '../engine/map.js';
import { LOOKS, charSheet, drawChar } from '../engine/sprites.js';
import { defineTile, R, P, speckle, disc, shadowEllipse } from '../engine/tiles.js';
import { registerItem } from '../engine/state.js';
import { registerSong } from '../engine/audio.js';
import { text, measure } from '../engine/draw.js';
import { W, H, TILE, shade, hash2, pick, makeCanvas } from '../engine/util.js';

const PID = 'horipro';

// ====================================================================== palette
const WALL = '#faf8f2';
const SEAM = '#efebe2';
const INK = '#2a2d36';
const ST = { g: '#3f8f3a', y: '#f2c21b', p: '#6b2f8e', k: '#ec8cae', r: '#d8382b', b: '#4b8fd8' };
const RAINBOW = [ST.g, ST.y, ST.p, ST.k, ST.r];

// The five coloured strokes of a hand-drawn star (a nod to the logo's motif).
const RAYS = [[-135, ST.g], [-48, ST.y], [10, ST.p], [76, ST.k], [128, ST.r]];
function rays(c, cx, cy, len, from = 1) {
  for (const [a, col] of RAYS) {
    const rad = (a * Math.PI) / 180;
    for (let i = from; i <= len; i++) P(c, Math.round(cx + Math.cos(rad) * i), Math.round(cy + Math.sin(rad) * i), col);
  }
}
function sparkle4(c, x, y, col) { P(c, x, y, col); P(c, x - 1, y, col); P(c, x + 1, y, col); P(c, x, y - 1, col); P(c, x, y + 1, col); }

// ====================================================================== tiles
// ---- white walls with a colourful mosaic band
defineTile('horipro_wall_hi', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WALL);
    R(c, 0, 0, 16, 1, '#ffffff'); R(c, 0, 1, 16, 1, '#eeeae0');
    R(c, 15, 2, 1, 14, SEAM); R(c, 0, 9, 16, 1, SEAM);
  },
});
defineTile('horipro_wall', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WALL);
    R(c, 15, 0, 1, 7, SEAM);
    for (let x = 0; x < 16; x++) R(c, x, 7, 1, 2, RAINBOW[Math.min(4, Math.floor(x / 3.2))]);
    R(c, 0, 9, 16, 1, '#e6e1d6');
    R(c, 0, 13, 16, 3, '#5b5e6a'); R(c, 0, 13, 16, 1, '#3e414b');
  },
});
defineTile('horipro_wall_star', {
  solid: true, obj: true,
  draw(c) {
    for (const [a, col] of RAYS) {
      const rad = (a * Math.PI) / 180;
      for (let i = 2; i <= 6; i++) {
        const x = Math.round(8 + Math.cos(rad) * i), y = Math.round(8 + Math.sin(rad) * i);
        P(c, x, y, col); if (i < 6) P(c, x + (Math.abs(Math.sin(rad)) > 0.7 ? 1 : 0), y + (Math.abs(Math.sin(rad)) > 0.7 ? 0 : 1), col);
      }
    }
    for (const [x, y] of [[2, 3], [14, 2], [14, 13], [2, 14]]) P(c, x, y, ST.b);
  },
});
defineTile('horipro_elev_ind', {
  solid: true, obj: true,
  draw(c) {
    R(c, 3, 8, 10, 7, INK); R(c, 4, 9, 8, 5, '#121420');
    // ▲ and "2"
    P(c, 6, 10, '#ff9a3c'); R(c, 5, 11, 3, 1, '#ff9a3c'); R(c, 4, 12, 5, 1, '#ff9a3c');
    R(c, 9, 10, 2, 1, '#ff9a3c'); P(c, 10, 11, '#ff9a3c'); P(c, 9, 12, '#ff9a3c'); R(c, 9, 13, 2, 1, '#ff9a3c');
  },
});

// ---- posters of fictional talents (2 tiles tall: hi on the upper wall, lo on the wall face)
const TALENTS = [
  { bg: '#ffd6e6', hair: '#6b4226', style: 'long', skin: '#ffe0c4', top: '#ffffff', accent: ST.k, star: ST.y },
  { bg: '#d3ecff', hair: '#2a2430', style: 'short', skin: '#f6c9a0', top: '#2e3140', accent: ST.b, star: ST.y },
  { bg: '#fff1b8', hair: '#c0452f', style: 'bob', skin: '#ffe0c4', top: ST.g, accent: ST.p, star: ST.p },
];
function talentPoster(c, oy, s) {
  c.save();
  c.translate(0, -oy);
  R(c, 2, 4, 12, 23, INK); R(c, 3, 5, 10, 21, s.bg);
  R(c, 3, 5, 10, 1, shade(s.bg, 0.3));
  // body & head
  R(c, 4, 18, 8, 7, s.top); R(c, 3, 20, 10, 5, s.top); R(c, 7, 18, 2, 2, s.skin);
  disc(c, 8, 13, 3, s.skin);
  if (s.style === 'long') { R(c, 4, 9, 8, 3, s.hair); R(c, 4, 11, 2, 8, s.hair); R(c, 10, 11, 2, 8, s.hair); }
  else if (s.style === 'bob') { R(c, 4, 9, 8, 3, s.hair); R(c, 4, 11, 2, 5, s.hair); R(c, 10, 11, 2, 5, s.hair); }
  else { R(c, 5, 9, 6, 3, s.hair); P(c, 4, 11, s.hair); P(c, 11, 11, s.hair); P(c, 6, 9, shade(s.hair, 0.3)); }
  P(c, 7, 13, INK); P(c, 9, 13, INK); P(c, 8, 15, '#d0604e');
  sparkle4(c, 11, 7, s.star);
  // name strip
  R(c, 3, 22, 10, 4, '#ffffff'); R(c, 4, 23, 6, 1, INK); R(c, 4, 24, 4, 1, s.accent);
  c.restore();
}
TALENTS.forEach((s, i) => {
  defineTile(`horipro_tp${i + 1}_hi`, { solid: true, obj: true, draw(c) { talentPoster(c, 0, s); } });
  defineTile(`horipro_tp${i + 1}_lo`, { solid: true, obj: true, draw(c) { talentPoster(c, 16, s); } });
});

// ---- stage posters: musical (1) and concert tour (2)
function stagePoster(c, oy, kind) {
  c.save();
  c.translate(0, -oy);
  R(c, 2, 4, 12, 23, '#c9a227'); R(c, 3, 5, 10, 21, kind === 1 ? '#1d2246' : '#5a2a7e');
  if (kind === 1) {
    R(c, 3, 5, 2, 15, '#a51f2c'); R(c, 11, 5, 2, 15, '#a51f2c'); R(c, 3, 5, 10, 2, '#7a1520');
    c.fillStyle = 'rgba(255,246,190,0.35)';
    for (let i = 0; i < 9; i++) c.fillRect(8 - Math.floor(i / 3), 8 + i, 1 + Math.floor(i / 3) * 2, 1);
    R(c, 7, 13, 2, 2, '#ffe0c4'); R(c, 6, 15, 4, 4, '#ffffff'); R(c, 5, 19, 6, 1, '#ddb06e');
    sparkle4(c, 6, 9, '#fff6a8'); P(c, 10, 11, '#fff6a8');
  } else {
    for (let i = 0; i < 5; i++) { c.fillStyle = RAINBOW[i]; c.fillRect(4 + i * 2, 7, 1, 8 - (i % 2) * 2); }
    R(c, 4, 15, 8, 2, '#ffd23f');
    for (let x = 3; x < 13; x += 2) { R(c, x, 18, 1, 2, '#20232a'); P(c, x, 17, RAINBOW[x % 5]); }
    sparkle4(c, 10, 9, '#ffffff');
  }
  R(c, 3, 21, 10, 5, '#ffffff'); R(c, 4, 22, 8, 1, kind === 1 ? '#a51f2c' : ST.p); R(c, 4, 24, 5, 1, INK);
  c.restore();
}
for (const k of [1, 2]) {
  defineTile(`horipro_sp${k}_hi`, { solid: true, obj: true, draw(c) { stagePoster(c, 0, k); } });
  defineTile(`horipro_sp${k}_lo`, { solid: true, obj: true, draw(c) { stagePoster(c, 16, k); } });
}

// ---- lobby
defineTile('horipro_floor', {
  variants: 2,
  draw(c, r, f, v) {
    R(c, 0, 0, 16, 16, '#f3f0e8');
    R(c, 0, 0, 8, 8, '#eeeae1'); R(c, 8, 8, 8, 8, '#eeeae1');
    R(c, 0, 0, 16, 1, '#e0dbcf'); R(c, 0, 0, 1, 16, '#e0dbcf');
    speckle(c, r, ['#e7e2d7', '#f8f6f0'], 6);
    if (v) P(c, 12, 4, '#fff');
  },
});
function runner(c, r, side) {
  R(c, 0, 0, 16, 16, '#5c2c80');
  speckle(c, r, ['#55287a', '#64338a'], 14);
  const ex = side === 'l' ? 1 : 13;
  R(c, ex, 0, 2, 16, '#f2c21b'); R(c, side === 'l' ? 3 : 12, 0, 1, 16, '#7a4aa0');
  if (side === 'l') R(c, 0, 0, 1, 16, '#e0dbcf');
}
defineTile('horipro_runner_l', { draw(c, r) { runner(c, r, 'l'); } });
defineTile('horipro_runner_r', { draw(c, r) { runner(c, r, 'r'); } });

function counterBase(c) {
  R(c, 0, 2, 16, 6, '#ffffff'); R(c, 0, 7, 16, 1, '#dcd7cb');
  R(c, 0, 8, 16, 7, '#f4f1ea'); R(c, 0, 8, 16, 1, '#e3ded2');
  for (let x = 0; x < 16; x++) P(c, x, 13, RAINBOW[Math.min(4, Math.floor(x / 3.2))]);
  R(c, 0, 15, 16, 1, '#9a958a');
}
defineTile('horipro_counter', { solid: true, obj: true, talkThrough: true, draw(c) { counterBase(c); } });
defineTile('horipro_counter_l', {
  solid: true, obj: true, talkThrough: true,
  draw(c) { counterBase(c); rays(c, 16, 10, 5, 1); R(c, 5, 4, 4, 2, '#fff6d8'); R(c, 6, 3, 2, 1, ST.k); },
});
defineTile('horipro_counter_r', {
  solid: true, obj: true, talkThrough: true,
  draw(c) { counterBase(c); rays(c, 0, 10, 5, 1); P(c, 0, 10, '#ffffff'); R(c, 9, 3, 5, 3, '#ffffff'); R(c, 9, 3, 5, 1, '#c3c6ce'); R(c, 10, 4, 3, 1, ST.b); },
});

function sofaDraw(col) {
  return (c) => {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 2, 2, 12, 7, shade(col, -0.18)); R(c, 2, 2, 12, 1, shade(col, 0.15));
    R(c, 1, 8, 14, 5, col); R(c, 1, 8, 14, 1, shade(col, 0.3));
    R(c, 0, 6, 2, 7, shade(col, -0.08)); R(c, 14, 6, 2, 7, shade(col, -0.08));
    R(c, 0, 6, 2, 1, shade(col, 0.25)); R(c, 14, 6, 2, 1, shade(col, 0.25));
    R(c, 2, 13, 1, 2, INK); R(c, 13, 13, 1, 2, INK);
  };
}
defineTile('horipro_sofa_y', { solid: true, obj: true, draw: sofaDraw('#f2c21b') });
defineTile('horipro_sofa_g', { solid: true, obj: true, draw: sofaDraw('#4f9e4a') });
defineTile('horipro_sofa_k', { solid: true, obj: true, draw: sofaDraw('#ec8cae') });
defineTile('horipro_glass_table', {
  solid: true, obj: true, variants: 3,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 13, 7, 2);
    R(c, 1, 5, 14, 6, '#cfe9f3'); R(c, 1, 5, 14, 1, '#ffffff'); R(c, 1, 10, 14, 1, '#9fc5d3');
    R(c, 2, 11, 1, 3, '#9aa0aa'); R(c, 13, 11, 1, 3, '#9aa0aa');
    if (v === 0) { R(c, 3, 6, 5, 3, ST.k); R(c, 4, 7, 2, 1, '#ffffff'); }
    if (v === 1) { R(c, 8, 6, 4, 4, '#ffffff'); R(c, 9, 7, 2, 2, '#a0602a'); R(c, 12, 7, 1, 2, '#ffffff'); }
    if (v === 2) { R(c, 4, 6, 6, 3, ST.y); R(c, 5, 7, 3, 1, INK); }
  },
});
defineTile('horipro_magrack', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 7, 1);
    R(c, 1, 1, 14, 14, '#b88d5e'); R(c, 2, 2, 12, 12, '#8a6440');
    const covers = [ST.k, ST.b, ST.y, ST.g, '#ffffff', ST.r];
    for (let i = 0; i < 6; i++) {
      const x = 2 + (i % 3) * 4, y = 2 + Math.floor(i / 3) * 6;
      R(c, x, y, 4, 5, covers[i]); R(c, x + 1, y + 1, 2, 2, '#ffe0c4'); P(c, x + 1, y + 1, INK); R(c, x, y + 4, 4, 1, shade(covers[i], -0.2));
    }
    R(c, 1, 7, 14, 1, '#6e4a2a'); R(c, 1, 13, 14, 2, '#6e4a2a');
  },
});
defineTile('horipro_awards', {
  solid: true, obj: true, variants: 2,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 15, 8, 1);
    R(c, 0, 0, 16, 15, '#c9cdd6'); R(c, 1, 1, 14, 13, '#dff1f8');
    R(c, 1, 7, 14, 1, '#c9cdd6');
    if (v === 0) {
      R(c, 3, 2, 3, 3, '#e8c43a'); R(c, 4, 5, 1, 1, '#c9a227'); R(c, 3, 6, 3, 1, '#c9a227'); P(c, 3, 2, '#fff6a8');
      R(c, 9, 2, 5, 4, '#ffffff'); R(c, 10, 3, 3, 2, ST.k);
      disc(c, 5, 10, 2, '#e8c43a'); R(c, 4, 13, 3, 1, '#c9a227'); R(c, 9, 9, 4, 4, '#c0c4cc'); P(c, 10, 10, '#ffffff');
    } else {
      R(c, 2, 3, 4, 4, '#ffffff'); R(c, 3, 4, 2, 2, ST.b);
      R(c, 9, 1, 2, 5, '#e8c43a'); R(c, 8, 1, 4, 2, '#e8c43a'); R(c, 9, 6, 2, 1, '#c9a227');
      R(c, 3, 9, 4, 4, '#e8c43a'); P(c, 4, 9, '#fff6a8'); R(c, 10, 10, 3, 3, ST.p); P(c, 11, 10, '#ffffff');
    }
    R(c, 1, 1, 1, 13, '#ffffff');
  },
});
defineTile('horipro_aframe', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 6, 1);
    R(c, 3, 13, 1, 3, '#6e4428'); R(c, 12, 13, 1, 3, '#6e4428');
    R(c, 2, 1, 12, 13, INK); R(c, 3, 2, 10, 11, '#ffffff');
    rays(c, 8, 5, 3, 1);
    R(c, 4, 9, 8, 1, ST.p); R(c, 4, 11, 6, 1, '#9aa0aa');
  },
});

// ---- office
defineTile('horipro_ofloor', {
  draw(c, r) {
    R(c, 0, 0, 16, 16, '#d8dbe3');
    R(c, 0, 0, 16, 1, '#c9cdd6'); R(c, 0, 0, 1, 16, '#c9cdd6');
    speckle(c, r, ['#cfd2da', '#e0e3ea'], 14);
  },
});
function deskBase(c) {
  shadowEllipse(c, 8, 14, 7, 1);
  R(c, 0, 4, 16, 6, '#ffffff'); R(c, 0, 9, 16, 1, '#d7d3ca');
  R(c, 0, 10, 16, 3, '#bdb8ac'); R(c, 0, 10, 16, 1, '#a8a397');
  R(c, 1, 13, 1, 2, '#7d8391'); R(c, 14, 13, 1, 2, '#7d8391');
}
defineTile('horipro_desk_pc', {
  solid: true, obj: true, talkThrough: true,
  draw(c) {
    deskBase(c);
    R(c, 4, 0, 8, 6, INK); R(c, 5, 1, 6, 4, '#7fd0ff'); R(c, 6, 2, 2, 1, '#ffffff'); R(c, 7, 6, 2, 1, INK);
    R(c, 4, 7, 8, 1, '#c3c6ce');
  },
});
defineTile('horipro_desk_papers', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    deskBase(c);
    R(c, 2, 5, 6, 3, '#ffffff'); R(c, 2, 4, 6, 1, '#eeeeee'); R(c, 3, 6, 4, 1, '#9aa0aa');
    if (v) { disc(c, 12, 6, 1, ST.r); P(c, 12, 6, '#ffffff'); R(c, 10, 3, 2, 3, ST.y); }
    else { R(c, 10, 4, 4, 3, ST.g); R(c, 10, 4, 4, 1, shade(ST.g, 0.3)); P(c, 13, 7, INK); }
  },
});
defineTile('horipro_easel', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 15, 5, 1);
    R(c, 3, 9, 1, 7, '#8a5a33'); R(c, 12, 9, 1, 7, '#8a5a33'); R(c, 7, 9, 2, 6, '#6e4428');
    R(c, 1, 0, 14, 11, INK); R(c, 2, 1, 12, 9, '#ffffff');
    const cols = ['#bfe6ff', '#ffe0c4', '#d9f2c8', '#ffd6e6'];
    for (let i = 0; i < 4; i++) { const x = 3 + (i % 2) * 5, y = 2 + Math.floor(i / 2) * 4; R(c, x, y, 4, 3, cols[i]); P(c, x + 1, y + 1, INK); }
    R(c, 1, 11, 14, 1, '#8a5a33');
  },
});

// ---- lesson studio
defineTile('horipro_maple', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#ead0a4');
    for (let y = 3; y < 16; y += 4) R(c, 0, y, 16, 1, '#d8b986');
    for (let row = 0; row < 4; row++) R(c, (row * 7 + 3) % 16, row * 4, 1, 3, '#d8b986');
    R(c, 2, 1, 3, 1, '#f3dcb5');
  },
});
defineTile('horipro_mirror_hi', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WALL); R(c, 0, 0, 16, 1, '#ffffff');
    R(c, 0, 3, 16, 13, '#a7adb8'); R(c, 0, 4, 16, 12, '#d4ecf6');
    for (let i = 0; i < 5; i++) { P(c, 9 + i, 13 - i * 2, '#f2fbff'); P(c, 10 + i, 13 - i * 2, '#f2fbff'); }
    R(c, 2, 6, 1, 3, '#eaf7fd');
  },
});
defineTile('horipro_mirror_lo', {
  solid: true,
  draw(c) {
    R(c, 0, 0, 16, 16, WALL);
    R(c, 0, 0, 16, 10, '#d4ecf6'); R(c, 0, 10, 16, 1, '#a7adb8');
    for (let i = 0; i < 4; i++) { P(c, 3 + i, 8 - i * 2, '#f2fbff'); P(c, 4 + i, 8 - i * 2, '#f2fbff'); }
    // ballet barre in front of the mirror
    R(c, 0, 6, 16, 2, '#c48a52'); R(c, 0, 6, 16, 1, '#e0aa70');
    R(c, 7, 8, 2, 3, '#8a9099');
    R(c, 0, 13, 16, 3, '#5b5e6a'); R(c, 0, 13, 16, 1, '#3e414b');
  },
});
defineTile('horipro_bags', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 1, 7, 8, 7, ST.b); R(c, 1, 7, 8, 1, shade(ST.b, 0.3)); R(c, 3, 5, 4, 2, INK);
    R(c, 9, 9, 6, 5, ST.k); R(c, 9, 9, 6, 1, shade(ST.k, 0.3));
    R(c, 11, 3, 2, 6, '#bfe6ff'); R(c, 11, 2, 2, 1, '#ffffff'); R(c, 11, 5, 2, 2, ST.y);
  },
});
defineTile('horipro_bench', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 13, 8, 1);
    R(c, 0, 6, 16, 4, '#ffffff'); R(c, 0, 6, 16, 1, '#ffffff'); R(c, 0, 9, 16, 1, '#c9cdd6');
    R(c, 1, 10, 2, 4, '#7d8391'); R(c, 13, 10, 2, 4, '#7d8391');
    R(c, 4, 4, 5, 3, '#ffffff'); R(c, 4, 4, 5, 1, ST.g);
  },
});
defineTile('horipro_script_table', {
  solid: true, obj: true, talkThrough: true, variants: 2,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 14, 7, 1);
    R(c, 0, 5, 16, 6, '#c48a52'); R(c, 0, 5, 16, 1, '#dca26a'); R(c, 0, 10, 16, 2, '#8a5a33');
    R(c, 1, 12, 2, 3, '#5a3a20'); R(c, 13, 12, 2, 3, '#5a3a20');
    R(c, 3 + v * 4, 6, 5, 4, '#ffffff'); R(c, 4 + v * 4, 7, 3, 1, '#9aa0aa'); R(c, 4 + v * 4, 8, 2, 1, '#9aa0aa');
    if (!v) { R(c, 11, 6, 2, 3, ST.r); } else { disc(c, 4, 7, 1, '#ffffff'); P(c, 4, 7, '#a0602a'); }
  },
});
defineTile('horipro_folding_chair', {
  solid: true, obj: true,
  draw(c) {
    shadowEllipse(c, 8, 14, 4, 1);
    R(c, 4, 2, 8, 5, '#e05462'); R(c, 4, 2, 8, 1, '#ff7f8c');
    R(c, 4, 8, 8, 3, '#c8323f'); R(c, 4, 7, 1, 8, '#9aa0aa'); R(c, 11, 7, 1, 8, '#9aa0aa');
  },
});

// ---- audition hall
function backdrop(c, r, lo) {
  R(c, 0, 0, 16, 16, '#1d2246');
  R(c, 0, lo ? 0 : 8, 16, 8, '#20264f');
  for (let i = 0; i < 3; i++) P(c, Math.floor(r() * 16), Math.floor(r() * 16), '#8f9ad8');
  if (r() < 0.45) sparkle4(c, 3 + Math.floor(r() * 10), 3 + Math.floor(r() * 10), '#fff6a8');
  if (lo) { R(c, 0, 14, 16, 2, '#141834'); R(c, 0, 14, 16, 1, '#2c3366'); }
}
defineTile('horipro_backdrop_hi', { solid: true, variants: 4, draw(c, r) { backdrop(c, r, false); } });
defineTile('horipro_backdrop_lo', { solid: true, variants: 4, draw(c, r) { backdrop(c, r, true); } });
defineTile('horipro_hallfloor', {
  draw(c, r) { R(c, 0, 0, 16, 16, '#3b3654'); speckle(c, r, ['#363150', '#433d5e'], 18); },
});
defineTile('horipro_steps', {
  draw(c) {
    R(c, 0, 0, 16, 16, '#7a5232');
    for (let i = 0; i < 4; i++) { R(c, 1, i * 4, 14, 3, shade('#ddb06e', -i * 0.08)); R(c, 1, i * 4 + 3, 14, 1, '#5a3a20'); }
    R(c, 0, 0, 1, 16, '#3a2512'); R(c, 15, 0, 1, 16, '#3a2512');
  },
});
defineTile('horipro_judge_table', {
  solid: true, obj: true, talkThrough: true, variants: 3,
  draw(c, r, f, v) {
    shadowEllipse(c, 8, 14, 8, 1);
    R(c, 0, 4, 16, 5, '#ffffff'); R(c, 0, 4, 16, 1, '#ffffff'); R(c, 0, 8, 16, 1, '#e3ded2');
    R(c, 0, 9, 16, 5, ST.p); R(c, 0, 9, 16, 1, shade(ST.p, -0.3)); R(c, 0, 12, 16, 1, ST.y);
    if (v === 0) { R(c, 2, 5, 5, 3, '#f2f2f2'); R(c, 3, 6, 3, 1, '#9aa0aa'); R(c, 10, 2, 2, 5, '#bfe6ff'); R(c, 10, 2, 2, 1, '#ffffff'); }
    if (v === 1) { R(c, 4, 1, 8, 5, INK); R(c, 5, 2, 6, 3, '#7fd0ff'); R(c, 2, 6, 3, 1, '#9aa0aa'); }
    if (v === 2) { R(c, 3, 5, 4, 3, '#ffffff'); R(c, 9, 5, 5, 2, '#f2f2f2'); P(c, 6, 3, ST.r); R(c, 6, 4, 1, 3, INK); }
  },
});

// ====================================================================== items & music
registerItem('horipro_star_pin', {
  name: '星のピンバッジ', price: 0,
  desc: '所属記念のカラフルな星。何度でも使える！1日1回、次の「歌」か「演技」が少しやさしくなる。',
  use: async (g) => {
    if (g.flag('horipro_pin_day') === g.state.day) { await g.say('今日はもう、星に願いをかけた。\nまた明日も使えるぞ。'); return; }
    const i = await g.ask('星のピンバッジを胸につけた。\nどっちの力を借りる？', ['歌', '演技', 'やめておく']);
    if (i > 1) return;
    const sk = i === 0 ? 'uta' : 'engi';
    if (g.state.buffs[sk]) { await g.say('もう気合いは十分だ！\n効果はミニゲームで使うまで続く。'); return; }
    g.setFlag('horipro_pin_day', g.state.day);
    g.state.buffs[sk] = true;
    g.sfx('good');
    await g.say(`胸の星がキラリと光った！\n次の「${sk === 'uta' ? '歌' : '演技'}」のミニゲームが\n少しやさしくなる。`);
  },
});
registerItem('horipro_lemon', { name: 'はちみつレモン', price: 300, desc: 'のどにやさしい差し入れ。体力が20回復する。', heal: 20 });
registerItem('horipro_pamphlet', {
  name: '公演パンフレット', price: 0,
  desc: 'ミュージカル主演公演のパンフレット。表紙には自分の姿が…！',
  use: async (g) => { g.sfx('chime'); await g.say(['パンフレットをめくった。', '主演 {name}――\n何度見ても、胸が高鳴る。']); },
});
registerItem('horipro_tour_photo', {
  name: 'ツアー記念写真', price: 0,
  desc: '全国コンサートツアー完走の記念写真。1日1回ながめると、体力が10回復する。',
  use: async (g) => {
    if (g.flag('horipro_photo_day') === g.state.day) { await g.say('スタッフみんなの笑顔がまぶしい。\n（今日はもう元気をもらった）'); return; }
    if (g.state.stamina >= g.state.maxStamina) { await g.say('体力は満タンだ。\n写真は大事にしまっておこう。'); return; }
    g.setFlag('horipro_photo_day', g.state.day);
    g.heal(10);
    g.sfx('good');
    await g.say('ツアーの記念写真をながめた。\n…元気が出てきた！体力が10回復した。');
  },
});

registerSong('horipro_lobby', {
  bpm: 112, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.04, notes: 'E5 . G5 . A5 . G5 E5 | D5 . E5 . C5 - . . | F5 . A5 . C6 . A5 F5 | G5 - - . . . . . | E5 . G5 . A5 . C6 A5 | G5 . E5 . D5 . C5 D5 | E5 . D5 . C5 . A4 . | C5 - - . . . . .' },
    { wave: 'triangle', vol: 0.12, notes: 'C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C3 . G3 . C3 . G3 . | A2 . E3 . A2 . E3 . | F2 . C3 . G2 . D3 . | C3 . G3 . C3 . . .' },
    { wave: 'drum', vol: 0.07, notes: 'k . h . s . h . | k . h k s . h h' },
  ],
});
registerSong('horipro_audition', {
  bpm: 92, step: 0.5,
  tracks: [
    { wave: 'square', vol: 0.035, notes: 'A4 . . C5 E5 . D5 . | C5 . . B4 A4 - . . | F4 . . A4 C5 . B4 . | G#4 - - . . . . . | A4 . . C5 E5 . G5 . | F5 . . E5 D5 - . . | C5 . B4 . A4 . G#4 . | A4 - - . . . . .' },
    { wave: 'triangle', vol: 0.11, notes: 'A2 . A2 . A2 . A2 . | F2 . F2 . F2 . F2 . | D2 . D2 . D2 . D2 . | E2 . E2 . E2 . E2 .' },
    { wave: 'drum', vol: 0.06, notes: 'k . . . s . . h | k . h . s . . .' },
  ],
});

// ====================================================================== characters
const C = {
  // lobby
  uketsuke: { name: '受付さん', look: { ...LOOKS.receptionist, top: ST.p, bottom: '#2a2430' } },
  annai: { name: '案内係', look: { hair: 'short', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: '#3b3f48', tie: ST.y } },
  scout: { name: 'スカウトマン', look: { hair: 'slick', hairColor: 'black', skin: 'tan', top: '#2a2d36', bottom: '#2a2d36', jacket: true, glasses: 'sun', tie: ST.r } },
  yume: { name: '受験者のユメさん', look: { hair: 'long', hairColor: 'black', skin: 'light', top: ST.k, bottom: '#3a4a7a', skirt: true } },
  mom: { name: '見学のお母さん', look: { ...LOOKS.mom } },
  kid: { name: '見学のこども', look: { ...LOOKS.kid, top: ST.y } },
  mio: { name: '先輩女優 虹谷ミオ', look: { hair: 'bob', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: ST.p, skirt: true, jacket: true } },
  guard: { name: '警備員さん', look: { ...LOOKS.guard } },
  // office
  manager: { name: 'マネージャー七瀬', look: { ...LOOKS.manager, tie: ST.y } },
  seisaku: { name: '制作プロデューサー', look: { hair: 'long', hairColor: 'black', skin: 'fair', top: ST.p, bottom: '#2a2430', jacket: true, glasses: true } },
  jimu: { name: '事務の小春さん', look: { hair: 'bob', hairColor: 'black', skin: 'light', top: '#ffd6e6', bottom: '#5a4a6a', skirt: true } },
  henshu: { name: 'ファッション誌編集者', look: { hair: 'twin', hairColor: 'blonde', skin: 'light', top: '#20232a', bottom: '#d8382b', skirt: true, glasses: 'sun' } },
  tvp: { name: 'TV局プロデューサー', look: { hair: 'cap', hat: '#20232a', hairColor: 'black', skin: 'fair', top: '#ff8a3d', bottom: '#3a4a7a', glasses: true } },
  cm: { name: 'CM制作スタッフ', look: { ...LOOKS.staff, hat: ST.g, top: '#5a6f8a' } },
  // studio
  vocal: { name: 'ボイトレの音羽先生', look: { hair: 'long', hairColor: 'brown', skin: 'light', top: '#4b8fd8', bottom: '#2a3560', skirt: true } },
  acting: { name: '演技講師の舞岡先生', look: { hair: 'slick', hairColor: 'silver', skin: 'tan', top: '#20232a', bottom: '#20232a', beard: true } },
  dance: { name: 'ダンス講師のリズ先生', look: { hair: 'cap', hat: ST.r, hairColor: 'black', skin: 'brown', top: ST.y, bottom: '#20232a' } },
  ken1: { name: '研修生ひなた', look: { hair: 'twin', hairColor: 'brown', skin: 'light', top: '#ffffff', bottom: ST.k } },
  ken2: { name: '研修生ソウ', look: { hair: 'spiky', hairColor: 'black', skin: 'fair', top: ST.g, bottom: '#20232a' } },
  ken3: { name: '研修生くるみ', look: { hair: 'bob', hairColor: 'orange', skin: 'light', top: ST.b, bottom: '#20232a' } },
  // audition hall
  judge1: { name: '審査委員長', look: { hair: 'slick', hairColor: 'silver', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, tie: ST.p, glasses: true } },
  judge2: { name: '音楽の審査員', look: { hair: 'long', hairColor: 'purple', skin: 'light', top: '#ffffff', bottom: '#20232a', jacket: true, glasses: 'sun' } },
  judge3: { name: '演出家の審査員', look: { hair: 'afro', hairColor: 'black', skin: 'tan', top: '#20232a', bottom: '#5a4a3a', beard: true } },
  ad: { name: '進行係', look: { ...LOOKS.ad, top: ST.y } },
  rival: { name: '受験者のタクミくん', look: { hair: 'spiky', hairColor: 'brown', skin: 'fair', top: '#ffffff', bottom: '#3a4a7a' } },
  hana: { name: '受験者のハナさん', look: { hair: 'twin', hairColor: 'black', skin: 'light', top: ST.y, bottom: '#3a4a7a', skirt: true } },
  hmgr: { name: 'マネージャー七瀬', look: { ...LOOKS.manager, tie: ST.y } },
};

const say = (g, who, t) => g.say(t, { name: C[who].name, look: C[who].look });
const ask = (g, who, t, choices, opts = {}) => g.ask(t, choices, { name: C[who].name, look: C[who].look, ...opts });
function npc(id, x, y, dir, extra = {}) {
  return { type: 'npc', id, x, y, dir, name: C[id].name, look: C[id].look, ...extra };
}
function face(g, id, dir) { const e = g.npc(id); if (e) e.dir = dir; }

const isMember = (g) => g.state.agency === PID;
const today = (g, k) => g.flag(k) === g.state.day;
const markToday = (g, k) => g.setFlag(k, g.state.day);
const lockLabel = (g, label, fame) => (g.state.fame < fame ? `${label}★${fame}` : label);
const good = (res) => res && ['S', 'A', 'B'].includes(res.rank);

// ====================================================================== activities
const JOBS = {
  extra: {
    id: 'horipro_cm_extra', title: 'CMのエキストラ',
    desc: '飲みもののCMの通行人役！', stamina: 15,
    minigame: 'command', opts: { theme: 'acting', difficulty: 1 },
    pay: 1000, fame: 5, skill: 'engi', gain: 1,
  },
  model: {
    id: 'horipro_model_cm', title: '雑誌モデル・CM撮影',
    desc: '雑誌の撮影から、そのままCM撮り！', stamina: 20,
    minigame: 'command', opts: { theme: 'dance', difficulty: 2 },
    pay: 4500, fame: 18, skill: 'engi', gain: 2,
  },
  utaban: {
    id: 'horipro_utaban', title: '歌番組に新人歌手として出演',
    desc: '生放送の歌番組でデビュー曲を披露！', stamina: 25,
    minigame: 'rhythm', opts: { difficulty: 3, lanes: 4, song: 'はじめましてのメロディ' },
    pay: 12000, fame: 45, skill: 'uta', gain: 3, requires: { fame: 250 },
  },
  drama: {
    id: 'horipro_drama_waki', title: 'ドラマの脇役',
    desc: '連続ドラマで主人公の親友役！', stamina: 25,
    minigame: 'command', opts: { theme: 'acting', difficulty: 3 },
    pay: 11000, fame: 40, skill: 'engi', gain: 3, requires: { fame: 250 },
  },
  musical: {
    id: 'horipro_musical_lead', title: 'ミュージカル主演',
    desc: '大劇場のミュージカルで主役に！', stamina: 30,
    minigame: 'rhythm', opts: { difficulty: 4, lanes: 4, song: '星降る劇場' },
    pay: 32000, fame: 120, skill: 'uta', gain: 4, requires: { fame: 1000 },
  },
  tour: {
    id: 'horipro_concert_tour', title: '全国コンサートツアー',
    desc: '全国のホールをまわる大ツアー！', stamina: 30,
    minigame: 'rhythm', opts: { difficulty: 5, lanes: 4, song: 'ありがとうのアンコール' },
    pay: 70000, fame: 250, skill: 'uta', gain: 5, requires: { agency: PID, fame: 2000 },
  },
};
// "ホリプロ所属 or ★30": members skip the fame requirement.
function jobFor(g, key, who) {
  const def = { ...JOBS[key], client: C[who].name, clientLook: C[who].look };
  if (key === 'model') def.requires = isMember(g) ? null : { fame: 30 };
  return def;
}

const DEPTS = [
  {
    key: 'uta', name: '歌部門', title: 'オーディション（歌部門）', piece: '課題曲「にじいろの扉」',
    minigame: 'rhythm', opts: { difficulty: 2, lanes: 2, song: 'にじいろの扉' },
  },
  {
    key: 'engi', name: '演技部門', title: 'オーディション（演技部門）', piece: '課題のひとり芝居',
    minigame: 'command', opts: { theme: 'acting', difficulty: 2 },
  },
];

const LESSONS = {
  vocal: {
    title: 'ボイストレーニング', skill: 'uta', price: 3000, stamina: 12, gain: 4,
    minigame: 'rhythm', opts: { difficulty: 1, lanes: 1, song: 'ドレミの階段' },
  },
  vocalAdv: {
    title: 'ボイトレ 上級', skill: 'uta', price: 7000, stamina: 15, gain: 6,
    minigame: 'rhythm', opts: { difficulty: 3, lanes: 2, song: 'ドレミの階段' },
  },
  acting: {
    title: '演技レッスン', skill: 'engi', price: 3000, stamina: 12, gain: 4,
    minigame: 'command', opts: { theme: 'acting', difficulty: 1 },
  },
  actingAdv: {
    title: '演技 上級', skill: 'engi', price: 7000, stamina: 15, gain: 6,
    minigame: 'command', opts: { theme: 'acting', difficulty: 3 },
  },
  dance: {
    title: 'ダンスレッスン', skill: 'uta', price: 4000, stamina: 15, gain: 3,
    minigame: 'command', opts: { theme: 'dance', difficulty: 1 },
  },
  danceAdv: {
    title: 'ダンス 上級', skill: 'uta', price: 7000, stamina: 15, gain: 5,
    minigame: 'command', opts: { theme: 'dance', difficulty: 3 },
  },
};

// ====================================================================== effects
const fx = { spot: null, card: 0, confetti: 0, banner: '', bannerT: 0 };
function resetFx() { fx.spot = null; fx.card = 0; fx.confetti = 0; fx.banner = ''; fx.bannerT = 0; }

let spotLayer = null;
function drawSpot(ctx, g, cam) {
  if (!fx.spot) return;
  const p = fx.spot === 'player' ? g.map.player : g.npc(fx.spot);
  if (!p) return;
  const cx = Math.round(p.px - cam.x + 8);
  const cy = Math.round(p.py - cam.y + 14);
  if (!spotLayer) spotLayer = makeCanvas(W, H);
  const [cv, c] = spotLayer;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(6,8,26,0.62)';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.moveTo(cx - 7, 0); c.lineTo(cx + 7, 0); c.lineTo(cx + 19, cy); c.lineTo(cx - 19, cy);
  c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,1)';
  c.beginPath(); c.ellipse(cx, cy, 19, 7, 0, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = 'source-over';
  ctx.drawImage(cv, 0, 0);
  ctx.fillStyle = 'rgba(255,240,170,0.16)';
  ctx.beginPath(); ctx.ellipse(cx, cy, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
}

// "合格" card held up by the chief judge
function drawCard(ctx, g, cam) {
  if (!fx.card) return;
  const e = g.npc('judge1');
  if (!e) return;
  const t = g.frame - fx.card;
  const lift = Math.max(0, 10 - t);
  const x = Math.round(e.px - cam.x - 8);
  const y = Math.round(e.py - cam.y - 34 + lift);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(x + 15, y + 18, 2, 12);
  ctx.fillStyle = INK; ctx.fillRect(x, y, 32, 20);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 30, 18);
  ctx.fillStyle = '#d62f2f'; ctx.fillRect(x + 1, y + 1, 30, 2); ctx.fillRect(x + 1, y + 17, 30, 2);
  text(ctx, '合格', x + 16, y + 4, { size: 12, align: 'center', color: '#d62f2f', shadow: null });
  if (Math.floor(t / 8) % 2) {
    ctx.fillStyle = '#fff6a8';
    ctx.fillRect(x - 3, y + 2, 1, 3); ctx.fillRect(x - 4, y + 3, 3, 1);
    ctx.fillRect(x + 34, y + 12, 1, 3); ctx.fillRect(x + 33, y + 13, 3, 1);
  }
}

function drawConfetti(ctx, g) {
  if (!fx.confetti) return;
  const t = g.frame - fx.confetti;
  const cols = [...RAINBOW, ST.b, '#ffffff'];
  for (let i = 0; i < 90; i++) {
    const r1 = hash2(i, 1, 23), r2 = hash2(i, 2, 23), r3 = hash2(i, 3, 23);
    const x = Math.round(r1 * W + Math.sin((t + i * 17) / 12) * 5);
    let y = -12 - r2 * 220 + t * (0.7 + r3 * 0.9);
    if (y > H + 4) y = ((y + 12) % (H + 16)) - 12;
    ctx.fillStyle = cols[i % cols.length];
    if ((Math.floor(t / 7) + i) % 2) ctx.fillRect(x, Math.round(y), 2, 2);
    else ctx.fillRect(x, Math.round(y), 1, 3);
  }
}

function drawBannerFx(ctx, g) {
  if (!fx.banner) return;
  const t = g.frame - fx.bannerT;
  const drop = Math.min(0, -40 + t * 3);
  const w = measure(ctx, fx.banner, 12) + 48;
  const x = Math.round(W / 2 - w / 2);
  const y = 44 + drop;
  ctx.fillStyle = '#e8e0c8';
  ctx.fillRect(x + 6, 0, 1, y); ctx.fillRect(x + w - 7, 0, 1, y);
  ctx.fillStyle = '#a51f2c'; ctx.fillRect(x, y, w, 20);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 2, w - 4, 16);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = RAINBOW[i]; ctx.fillRect(x + 2 + i * 3, y + 2, 3, 16); ctx.fillRect(x + w - 17 + i * 3, y + 2, 3, 16); }
  text(ctx, fx.banner, W / 2, y + 4, { size: 12, align: 'center', color: '#a51f2c', shadow: null });
}

// a white name plate with a coloured underline (door signs)
function plate(ctx, cx, y, label, col = ST.p) {
  const w = Math.max(16, measure(ctx, label, 10) + 8);
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = INK; ctx.fillRect(x, y, w, 14);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, w - 2, 12);
  ctx.fillStyle = col; ctx.fillRect(x + 1, y + 11, w - 2, 2);
  text(ctx, label, Math.round(cx), y + 1, { size: 10, align: 'center', color: INK, shadow: null });
}
// a life-size cardboard standee of a (fictional) talent
function standee(x, y, look, bg, lines) {
  let sheet = null;
  return {
    type: 'prop', x, y, w: 1, h: 1, text: lines,
    draw(ctx, sx, sy) {
      if (!sheet) sheet = charSheet(look);
      const X = Math.round(sx), Y = Math.round(sy);
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(X + 1, Y + 14, 14, 2);
      ctx.fillStyle = '#8a5a33'; ctx.fillRect(X + 4, Y + 13, 8, 2);
      ctx.fillStyle = INK; ctx.fillRect(X, Y - 14, 16, 28);
      ctx.fillStyle = bg; ctx.fillRect(X + 1, Y - 13, 14, 26);
      ctx.fillStyle = shade(bg, -0.12);
      for (let i = 0; i < 5; i++) ctx.fillRect(X + 1 + i * 3, Y - 13 + (i % 2) * 4, 1, 6);
      drawChar(ctx, sheet, 'down', 0, X, Y - 8);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(X + 1, Y + 8, 14, 5);
      ctx.fillStyle = ST.r; ctx.fillRect(X + 2, Y + 9, 8, 1);
      ctx.fillStyle = INK; ctx.fillRect(X + 2, Y + 11, 11, 1);
      ctx.fillStyle = '#fff6a8'; ctx.fillRect(X + 12, Y - 11, 1, 3); ctx.fillRect(X + 11, Y - 10, 3, 1);
    },
  };
}
function signProp(x, y, label, col, dy = 2) {
  return { type: 'prop', x, y, w: 1, h: 1, draw(ctx, sx, sy) { plate(ctx, sx + 8, sy + dy, label, col); } };
}

// ====================================================================== lobby
async function greetLobby(g) {
  if (g.flag('horipro_greet')) return;
  g.setFlag('horipro_greet');
  await g.wait(250);
  g.sfx('chime');
  await g.emote('uketsuke', '!');
  await say(g, 'uketsuke', 'いらっしゃいませ！\nホリプロへようこそ！');
  await g.showLogo('horipro', 'ホリプロ');
  await g.say(['色とりどりの星のロゴが、\nロビーの正面で輝いている。', '俳優、歌手、タレント…\nたくさんの人が所属する芸能事務所だ。']);
  await say(g, 'uketsuke', 'ご用の方は、受付までどうぞ！');
}

async function talkUketsuke(g) {
  const member = isMember(g);
  const i = await ask(g, 'uketsuke', member ? 'おつかれさまです、{name}さん！\n今日はどちらへ？' : 'ホリプロへようこそ！\nどんなご用件でしょう？', ['オーディション', 'レッスン', 'お仕事', 'なんでもない']);
  if (i === 0) {
    if (member) await say(g, 'uketsuke', ['もう所属タレントじゃないですか！', '2階の会場では、今日も後輩たちが\nがんばってますよ。']);
    else await say(g, 'uketsuke', ['新人オーディションは2階の会場で、\nいつでも受けられます！', '右奥のエレベーターからどうぞ。\n歌部門と演技部門がありますよ。']);
  } else if (i === 1) {
    await say(g, 'uketsuke', ['右のガラスドアの先が\nレッスンスタジオです。', 'ボイトレ、演技、ダンス。\n所属タレントはレッスン料が割引です！']);
  } else if (i === 2) {
    if (member) await say(g, 'uketsuke', 'マネージャーの七瀬が、\n左のドアの先の事務所でお待ちです！');
    else await say(g, 'uketsuke', ['左のドアの先が事務所です。', 'CMのエキストラなら、\nどなたでも参加できるみたいですよ！']);
  } else {
    await say(g, 'uketsuke', 'ごゆっくりどうぞ！');
  }
}

function lobbyHint(g) {
  const st = g.state;
  if (isMember(g)) {
    if (st.fame < 250) return '所属タレントさんは、事務所のマネージャーに\nお仕事をもらえますよ。';
    if (st.fame < 1000) return '最近、テレビでよくお見かけします！\n★1000でミュージカルの主演ですって！';
    if (st.fame < 2000) {
      return g.flag('horipro_musical_done')
        ? 'ミュージカル、見に行きました！\n★2000になれば全国ツアーですって！'
        : '制作プロデューサーさんが、\nミュージカルの主役を探してましたよ！';
    }
    return g.flag('horipro_tour_done')
      ? '全国ツアー完走、おめでとうございます！\n次は国民的スターですね！'
      : '★2000のスターなら、全国ツアーです！\n事務所の制作プロデューサーさんへ！';
  }
  if (st.fame >= 1000) return '事務所の制作プロデューサーさんが、\nミュージカルの主役を探してましたよ！';
  if (st.agency) return 'よその事務所の方でも、オーディションは\n受けられます。合格したら移籍の相談に。';
  if (st.fame < 30) return 'まずはスタジオでレッスンを受けて、\n2階のオーディションに挑戦しては？';
  if (st.fame < 250) return '知名度が★30をこえたら、事務所の\n雑誌編集者さんに声をかけてみて！';
  return '★250あれば、TV局のプロデューサーさんが\n歌番組やドラマに呼んでくれるかも！';
}

async function talkAnnai(g) {
  const i = await ask(g, 'annai', '館内のご案内をしています。\n何をお知りになりたいですか？', ['ホリプロって？', 'おすすめは？', 'だいじょうぶ']);
  if (i === 0) {
    await g.showLogo('horipro', 'ホリプロ');
    await say(g, 'annai', [
      '手描きのようなカラフルな星が、\nホリプロのロゴなんですよ。',
      'ホリプロには、俳優さんや歌手、\nタレントさんがたくさん所属しています。',
      'ミュージカルなどの舞台づくりにも、\n力を入れているんですよ。',
      '新しい才能を探すオーディションも、\nずっと大切にしているんです。',
    ]);
  } else if (i === 1) {
    await say(g, 'annai', lobbyHint(g));
  } else {
    await say(g, 'annai', 'いってらっしゃいませ！');
  }
}

async function talkScout(g) {
  const st = g.state;
  if (isMember(g)) {
    if (st.fame >= 2000) await say(g, 'scout', ['いまやキミを知らない人はいない！', '…ボクがスカウトしたってことに、\nしてもいいかな？']);
    else await say(g, 'scout', ['やっぱりボクの目に狂いはなかった！', '次は、まだ誰も知らない原石を探しに\n街へ出かけるとするよ。']);
    return;
  }
  if (st.agency) {
    await say(g, 'scout', ['おや、{agency}のタレントさんか。', 'うちのオーディションに受かったら、\n移籍の相談もできるよ。ふふふ。']);
    return;
  }
  await g.emote('scout', '!');
  await say(g, 'scout', [
    '…キミ、いい目をしてるね！\nスターの原石ってやつだ。',
    '2階の新人オーディション、受けてみなよ。\n歌でも演技でも、得意なほうでね！',
  ]);
}

async function talkYume(g) {
  if (isMember(g)) {
    if (!g.flag('horipro_yume_cheer')) {
      g.setFlag('horipro_yume_cheer');
      await g.emote('yume', '!');
      await say(g, 'yume', ['えっ、合格したの！？\nすごい、おめでとう！', 'わたしも次こそ受かってみせる！\nそのときは、よろしくね。']);
    } else {
      await say(g, 'yume', pick([
        ['ボイトレの音羽先生、厳しいけど優しいの。', '「のどは楽器」って、いつも言ってるよ。'],
        ['テレビで見たよ！', '同じロビーで緊張してたなんて、\nうそみたい！'],
      ]));
    }
    return;
  }
  await say(g, 'yume', [
    'き、緊張する…！\nあなたもオーディション？',
    'わたしは歌部門。流れてくる音符に合わせて\n← → を押すんだって。',
    '演技部門は、出てきた動きを\nあわてず正確に演じるのがコツらしいよ！',
  ]);
}

async function talkMom(g) {
  await say(g, 'mom', [
    'この子が「スターになる！」って\n聞かなくて…見学に来たんです。',
    'ここのミュージカル、家族で見に行って\nすっかり夢中になっちゃって。',
  ]);
}

async function talkKid(g) {
  const st = g.state;
  if (st.fame >= 1000) {
    await g.emote('kid', '!');
    await say(g, 'kid', ['あっ！テレビで見たことある！', 'サインちょうだい！\n…やったー！宝物にする！']);
    await g.emote('kid', '♥');
    return;
  }
  await say(g, 'kid', ['ぼく、大きくなったら\nミュージカルに出るんだ！', '歌もダンスも、毎日練習してるよ！\nきみも、スターをめざしてるの？']);
}

async function talkMio(g) {
  const st = g.state;
  if (st.fame >= 2000) {
    await say(g, 'mio', ['もう立派なスターね。', '今度、舞台で共演しましょう。\n…負けないわよ？']);
  } else if (st.fame >= 1000) {
    await say(g, 'mio', [
      g.flag('horipro_musical_done') ? 'ミュージカルの主演、おめでとう！' : 'そろそろ、ミュージカルの主演ね。\n制作プロデューサーさんに会ってみて。',
      '歌もお芝居も、全部さらけ出すの。\n客席はちゃんと受け止めてくれるわ。',
    ]);
  } else if (st.fame >= 250) {
    await say(g, 'mio', ['最近、テレビでよく見かけるわ。\nいい表情してたじゃない！', 'ドラマの脇役は物語のささえ。\n主役を光らせる芝居を研究してみて。']);
  } else if (g.heartLevel('mio') >= 1) {
    // she knows you (people.js): no "新人さん？" to a friend
    await say(g, 'mio', ['{name}、また来たのね。', 'お芝居はね、セリフより「聞く」ことが大事。\n…これ、前にも言ったかしら？']);
  } else {
    await say(g, 'mio', [
      'あなた、新人さん？\nわたしもオーディションから始まったの。',
      'お芝居はね、セリフより「聞く」ことが大事。\n相手の言葉に、心で反応するのよ。',
    ]);
  }
}

async function talkGuard(g) {
  if (g.state.fame >= 1000) {
    await say(g, 'guard', 'おつかれさまです！\n…あとでサイン、いいですか？');
    return;
  }
  await say(g, 'guard', pick([
    ['関係者以外は…', 'あ、オーディションの方ですね！\nどうぞ、がんばって！'],
    ['毎日いろんな人が夢を持ってここへ来ます。', 'その背中を見送るのが、\nわたしのひそかな楽しみなんです。'],
  ]));
}

// ====================================================================== office
function advice(g) {
  const st = g.state;
  const tips = [];
  if (st.fame < 250) tips.push('いまは雑誌やCMで、顔を覚えてもらう時期です。\n★250になったら歌番組やドラマも！');
  else if (st.fame < 1000) tips.push('歌番組もドラマも好評です！\n★1000になれば、ミュージカルの主演も。');
  else if (st.fame < 2000) {
    tips.push(g.flag('horipro_musical_done')
      ? '主演、さすがでした！\n★2000になったら…全国コンサートツアーです！'
      : 'ミュージカルの主演の話が来てます！\n奥の制作プロデューサーさんへどうぞ！');
  } else if (!g.flag('horipro_tour_done')) tips.push('いよいよ全国コンサートツアーです！\n制作プロデューサーさんと相談を！');
  else tips.push('ツアー完走、本当にすごかった！\n★4000、国民的スターまであと少し！');
  if (st.skills.uta < 30) tips.push('スタジオの音羽先生のボイトレで、\n歌をみがくのもおすすめです。');
  else if (st.skills.engi < 30) tips.push('スタジオの舞岡先生の演技レッスンも、\nきっと役に立ちますよ。');
  tips.push('大事な本番の前は、星のピンバッジを\nつけていくのを忘れずに！');
  return tips;
}

async function talkManager(g) {
  if (!isMember(g)) {
    await say(g, 'manager', [
      'マネージャーの七瀬です。\n所属タレントのお仕事を担当しています。',
      'オーディションは2階の会場で。\n合格したら、一緒にがんばりましょう！',
      '所属していなくても、編集者さんや\nTV局の方がお仕事をくれるかもしれません。',
    ]);
    return;
  }
  if (!g.flag('horipro_welcomed')) {
    g.setFlag('horipro_welcomed');
    await g.emote('manager', '!');
    await say(g, 'manager', ['{name}さん！今日から担当する、\nマネージャーの七瀬です！', 'これ、所属記念のピンバッジです。\n大事な本番の前につけてくださいね！']);
    if (!g.hasItem('horipro_star_pin')) g.giveItem('horipro_star_pin');
  }
  const choices = ['雑誌モデル・CM', lockLabel(g, '歌番組', 250), lockLabel(g, 'ドラマ', 250), '相談する', 'やめておく'];
  const i = await ask(g, 'manager', 'おつかれさまです、{name}さん！\nどのお仕事にしましょう？', choices);
  if (i === 0) {
    const res = await g.job(jobFor(g, 'model', 'manager'));
    if (res) await say(g, 'manager', good(res) ? '編集部から「表紙もいける」って！\nこの調子です！' : 'おつかれさまでした！\nポーズは鏡の前で練習しましょう。');
  } else if (i === 1) {
    const res = await g.job(jobFor(g, 'utaban', 'manager'));
    if (res) await say(g, 'manager', good(res) ? '放送後、問い合わせの電話が\n鳴りっぱなしですよ！' : '生放送は緊張しますよね。\n次はもっと楽しんでいきましょう！');
  } else if (i === 2) {
    const res = await g.job(jobFor(g, 'drama', 'manager'));
    if (res) await say(g, 'manager', good(res) ? '監督が「次も呼びたい」って！\nさすがです！' : 'ドンマイです。\n演技レッスンで役作りをみがきましょう。');
  } else if (i === 3) {
    await say(g, 'manager', advice(g));
  } else {
    await say(g, 'manager', '了解です！\nいつでも声をかけてくださいね。');
  }
}

async function tourCelebration(g, first) {
  await g.fadeOut();
  g.placePlayer(8, 10, 'up');
  const spots = { manager: [7, 8, 'down'], seisaku: [9, 8, 'down'], jimu: [6, 9, 'right'], henshu: [10, 9, 'left'], cm: [5, 10, 'right'], tvp: [11, 10, 'left'] };
  for (const [id, [x, y, d]] of Object.entries(spots)) g.placeNpc(id, x, y, d);
  g.notify('ツアー最終日の夜、事務所にて…', { color: '#fff' });
  await g.fadeIn();
  await say(g, 'manager', 'みなさん、主役が帰ってきましたよ！\nせーの…！');
  fx.banner = '祝 全国ツアー完走！';
  fx.bannerT = g.frame;
  fx.confetti = g.frame;
  g.sfx('fanfare');
  g.shake(8, 1);
  await g.wait(400);
  for (const id of Object.keys(spots)) g.emote(id, pick(['!', '♪', '♥']));
  await g.say('一同「ツアー完走、おめでとう！！」');
  g.sfx('applause');
  await say(g, 'seisaku', ['全公演、満員御礼！', '最終日のアンコール、客席がペンライトで\n七色に光っていたね。']);
  await say(g, 'jimu', 'ファンの方からのお手紙が、\n段ボールで届いてますよ！');
  await say(g, 'manager', ['{name}さん、本当におつかれさまでした！', 'オーディションの日から、ずっと見てきました。\n…立派になりましたね。']);
  await g.emote('player', '♥');
  if (first) {
    await say(g, 'seisaku', 'これは、スタッフ全員で撮った\nツアーの記念写真。受け取って！');
    g.giveItem('horipro_tour_photo');
    g.sfx('success');
    await g.say('「ツアー記念写真」をもらった！\nもちもの（メニュー）からながめられる。');
  }
  await say(g, 'manager', 'さあ、次はいよいよ…\n国民的スターですよ！');
  await g.fadeOut();
  resetFx();
  await g.goto(PID, 'office', 8, 10, 'up');
}

async function talkSeisaku(g) {
  const choices = [lockLabel(g, 'ミュージカル', 1000), lockLabel(g, '全国ツアー', 2000), '舞台のこと', 'やめておく'];
  const i = await ask(g, 'seisaku', ['制作プロデューサーです。\nミュージカルやコンサートを作っています。', 'ちょうど、主役を探しているところなの。'], choices);
  if (i === 0) {
    if (g.state.fame >= 1000) await say(g, 'seisaku', '大劇場の新作ミュージカル。\n主役は、あなたしかいない！');
    const res = await g.job(jobFor(g, 'musical', 'seisaku'));
    if (!res) return;
    if (good(res) && !g.flag('horipro_musical_done')) {
      g.setFlag('horipro_musical_done');
      g.sfx('applause');
      await g.say(['幕が下りても、拍手が鳴りやまない…！', 'カーテンコールは、なんと5回も続いた！']);
      await say(g, 'seisaku', '初日、大成功！\n記念に、公演パンフレットをどうぞ。');
      g.giveItem('horipro_pamphlet');
    } else {
      await say(g, 'seisaku', good(res) ? '今日も満員のお客さんが、\nスタンディングオベーションだったわ！' : 'うん、悪くなかった。\n千秋楽までに、もっと良くなるはず！');
    }
  } else if (i === 1) {
    if (g.state.fame >= 2000 && isMember(g)) await say(g, 'seisaku', '北から南まで、全国のホールを押さえたわ。\n準備はいい？');
    const res = await g.job(jobFor(g, 'tour', 'seisaku'));
    if (!res) return;
    const first = !g.flag('horipro_tour_done');
    // the first completed tour is always celebrated; later ones when they go well
    if (first || good(res)) {
      g.setFlag('horipro_tour_done');
      await tourCelebration(g, first);
    } else {
      await say(g, 'seisaku', ['おつかれさま。\nくやしい公演もあったわね。', 'でも、どの会場のお客さんも\nあたたかかった。次はもっと！']);
    }
  } else if (i === 2) {
    await say(g, 'seisaku', [
      'ミュージカルは、歌とお芝居とダンス、\n全部がそろってはじめて輝くの。',
      '★1000になったら、主演の相談をしましょう。\nスタジオで歌をきたえておいてね！',
      '全国ツアーは、ホリプロ所属の\n★2000以上のスターにお願いしているわ。',
    ]);
  } else {
    await say(g, 'seisaku', 'いい舞台は、いい準備から。\nまたいつでもどうぞ。');
  }
}

async function talkHenshu(g) {
  const member = isMember(g);
  if (!member && g.state.fame < 30) {
    await say(g, 'henshu', [
      'ファッション誌の編集をしてるの。\n今日は撮影の打ち合わせよ。',
      'モデルは、ホリプロの所属タレントか、\n★30くらい名前が知られた人に頼んでるの。',
    ]);
    return;
  }
  await say(g, 'henshu', member ? 'あら、{name}さん！\n次の号のモデル、お願いできる？' : 'あなた、最近よく見かけるわね。\n次の号のモデル、やってみない？');
  const res = await g.job(jobFor(g, 'model', 'henshu'));
  if (res) await say(g, 'henshu', good(res) ? '最高の一枚が撮れたわ！\nCMのほうも評判いいわよ。' : 'おつかれさま！\n次はもっとカメラを意識してみて。');
}

async function talkTvp(g) {
  if (g.state.fame < 250) {
    await say(g, 'tvp', [
      'テレビ局のプロデューサーです。\n新人さんを探しに来たんだ。',
      '歌番組やドラマに出てもらうには、\n★250くらいの知名度がほしいなあ。',
    ]);
    return;
  }
  const i = await ask(g, 'tvp', 'おっ、{name}さん！\nちょうど出演枠が空いてるんだ。', ['歌番組', 'ドラマ', 'またこんど']);
  if (i === 0) {
    const res = await g.job(jobFor(g, 'utaban', 'tvp'));
    if (res) await say(g, 'tvp', good(res) ? '視聴者のメッセージがすごい数だよ！\nまた来てね！' : 'おつかれさま！\n緊張も、最初はみんな同じさ。');
  } else if (i === 1) {
    const res = await g.job(jobFor(g, 'drama', 'tvp'));
    if (res) await say(g, 'tvp', good(res) ? 'あの泣きのシーン、現場が静まり返ったよ。\n最高だった！' : 'いい経験になったね。\n次の役も考えておくよ！');
  } else {
    await say(g, 'tvp', 'また声をかけるよ！');
  }
}

async function talkCm(g) {
  await say(g, 'cm', ['CMの撮影スタッフです！', '飲みもののCMで、通行人役の\nエキストラを探してるんですよ。']);
  const res = await g.job(jobFor(g, 'extra', 'cm'));
  if (res) await say(g, 'cm', good(res) ? '自然な歩き方、バッチリでした！\nオンエアで探してみてくださいね。' : 'おつかれさまでした！\nまたお願いしますね。');
  else await say(g, 'cm', 'またいつでも声をかけてくださいね！');
}

async function talkJimu(g) {
  if (isMember(g) && !today(g, 'horipro_sashiire_day')) {
    markToday(g, 'horipro_sashiire_day');
    await say(g, 'jimu', ['{name}さん、おつかれさまです！', 'ファンの方から差し入れが届いてますよ。\nのどにいいんですって！']);
    g.giveItem('horipro_lemon');
    return;
  }
  if (isMember(g)) {
    await say(g, 'jimu', pick([
      ['差し入れは1日1回、お渡ししてますよ。', 'ファンレターも、ちゃんと全部\nとってありますからね！'],
      ['スケジュール帳、もうびっしりです！', '体力がなくなったら、\n無理せず休んでくださいね。'],
    ]));
    return;
  }
  await say(g, 'jimu', pick([
    ['ファンレターの仕分け中です。', '所属タレントさんには、毎日\n差し入れをお渡ししてるんですよ。'],
    ['ホワイトボード、見ました？', '撮影、収録、舞台のけいこ…\n今月も予定がびっしりなんです。'],
  ]));
}

async function scheduleBoard(g) {
  const lines = ['ホワイトボードに予定がびっしり書かれている。', '「雑誌撮影」「歌番組リハ」\n「ドラマ読み合わせ」「舞台けいこ」…'];
  if (isMember(g)) lines.push(g.flag('horipro_tour_done') ? `すみっこに「祝！${g.state.name} ツアー完走」\nの文字。…じーんとくる。` : `すみっこに「${g.state.name}、ファイト！」\nと書いてある。うれしい！`);
  else lines.push('「新人オーディション 随時開催中！」\nの文字も見える。');
  await g.say(lines);
}

// ====================================================================== studio
async function lessonMenu(g, who, base, adv, after) {
  const member = isMember(g);
  const off = member ? 1000 : 0;
  const skill = g.state.skills[base.skill];
  const choices = skill >= 40 ? ['レッスン', '上級レッスン', 'やめておく'] : ['レッスン', 'やめておく'];
  const intro = [].concat(after.intro, member ? ['所属タレントは、レッスン料が\n¥1,000引きですよ。'] : []);
  const i = await ask(g, who, intro, choices);
  let res = null;
  if (choices[i] === 'レッスン') res = await g.lesson({ ...base, price: base.price - off, teacher: C[who].name });
  else if (choices[i] === '上級レッスン') res = await g.lesson({ ...adv, price: adv.price - off, teacher: C[who].name });
  else { await say(g, who, 'またいつでもどうぞ。'); return; }
  if (!res) return;
  if (after.bonus) await after.bonus(g);
  await say(g, who, member ? after.member : after.newbie);
}

const TEACH = {
  vocal: {
    intro: ['ボイトレ担当の音羽です。', 'のどは楽器。おなかから声を出して、\nリズムにぴったり乗せましょう！'],
    member: 'いい声！歌番組でも、\nその声を届けてね。',
    newbie: 'いい声！その調子なら\nオーディションの歌部門もいけるわ。',
  },
  acting: {
    intro: ['演技講師の舞岡だ。', '芝居は、型をおぼえて、\nそれから心を入れる。始めよう。'],
    member: '……うむ。役が生きてきた。\nドラマの現場でも、その感覚を忘れるな。',
    newbie: '……うむ。悪くない。\n演技部門のオーディションで試してみろ。',
  },
  dance: {
    intro: ['ダンス講師のリズよ！', '歌って踊れて、表情もつける！\n全身で表現するわよー！'],
    member: 'ナイスダンス！\nステージ映えするわよ！',
    newbie: 'ナイスダンス！\n事務所に入ったら、ステージで見せてね！',
    bonus: async (g) => {
      g.addSkill('engi', 1, true);
      await g.say(`表現力もついた！\n演技が1上がった！（${g.state.skills.engi}）`);
    },
  },
};

async function talkVocal(g) { await lessonMenu(g, 'vocal', LESSONS.vocal, LESSONS.vocalAdv, TEACH.vocal); }
async function talkActing(g) { await lessonMenu(g, 'acting', LESSONS.acting, LESSONS.actingAdv, TEACH.acting); }
async function talkDance(g) { await lessonMenu(g, 'dance', LESSONS.dance, LESSONS.danceAdv, TEACH.dance); }

const TRAINEES = ['ken1', 'ken2', 'ken3'];
const TRAINEE_HOME = { ken1: [8, 6], ken2: [10, 6], ken3: [12, 6] };

// ひなた's friendship (people.js): no self-introduction to a friend; her unit debut is her ♥4 event.
const hinataFriend = (g) => g.heartLevel('hinata') >= 1;
const unitDebuted = (g) => { const p = g.person('hinata'); return !!(p && p.seen && p.seen[4]); };

async function watchRehearsal(g, who) {
  const intro = {
    ken1: !hinataFriend(g) ? ['研修生のひなたです！', 'いまからフォーメーションの\n通し稽古なんです。']
      : unitDebuted(g) ? ['{name}さん！来てくれたんですね！', 'デビュー曲の通し稽古なんです。\n見ていってください！']
        : ['{name}さん！来てくれたんですね！', 'いまから通し稽古なんです。\n見ていってください！'],
    ken2: ['研修生のソウっす！', 'これから3人で通し稽古。\nよかったら見てってください！'],
    ken3: ['研修生のくるみです。', '通し稽古、ちょっと緊張するけど…\n見ててくれますか？'],
  }[who];
  const i = await ask(g, who, intro, ['見学する', 'やめておく']);
  if (i !== 0) { await say(g, who, 'またいつでも見に来てください！'); return; }
  await g.fadeOut();
  g.placePlayer(10, 9, 'up');
  for (const id of TRAINEES) g.placeNpc(id, ...TRAINEE_HOME[id], 'up');
  g.placeNpc('dance', 10, 3, 'down');
  await g.fadeIn();
  await say(g, 'dance', 'はい、いくよー！\n5、6、7、8！');
  g.sfx('snare');
  const all = (steps, sp = 1.6) => Promise.all(TRAINEES.map((id) => g.moveNpc(id, steps, sp)));
  await all('left');
  g.sfx('snare');
  await all('right right');
  g.sfx('snare');
  await all('left');
  await all('face:left wait face:down wait face:right wait face:up wait');
  g.sfx('drum');
  await all('down');
  await all('up');
  await all('face:down');
  g.sfx('success');
  await Promise.all(TRAINEES.map((id) => g.emote(id, '♪', 40)));
  g.sfx('applause');
  await g.emote('dance', '!');
  await say(g, 'dance', 'うん、そろってきた！\nラストのポーズ、もっと大きく！');
  await say(g, 'ken2', unitDebuted(g) ? '{name}さん、どうでした？\nデビューしても、稽古は毎日っす！' : '{name}さん、どうでした？\nオレたちも早くデビューしたいっす！');
  if (!today(g, 'horipro_watch_day')) {
    markToday(g, 'horipro_watch_day');
    g.addSkill('uta', 1, true);
    g.sfx('good');
    await g.say(`ステージでの「見せ方」を学んだ！\n歌が1上がった。（${g.state.skills.uta}）`);
  } else {
    await g.say('3人の通し稽古を楽しんだ！\n（見学で学べるのは1日1回までのようだ）');
  }
  for (const id of TRAINEES) g.placeNpc(id, ...TRAINEE_HOME[id], 'up');
}

// ====================================================================== audition hall
const JUDGES = { judge1: [9, 10], judge2: [7, 10], judge3: [11, 10] };
function seatJudges(g) { for (const [id, [x, y]] of Object.entries(JUDGES)) g.placeNpc(id, x, y, 'up'); }

async function resetHall(g, x = 9, y = 8, dir = 'up') {
  await g.fadeOut();
  resetFx();
  await g.goto(PID, 'hall', x, y, dir);
}

async function stageEntrance(g, D) {
  await say(g, 'ad', `${D.name}ですね！\nでは、ステージへどうぞ！`);
  await g.fadeOut();
  seatJudges(g);
  g.placeNpc('ad', 3, 7, 'up');
  g.placePlayer(2, 5, 'right');
  fx.spot = 'player';
  await g.fadeIn();
  g.sfx('snare');
  await g.movePlayer('right right right right right right right face:down', 1.2);
  g.sfx('chime');
  await Promise.all(Object.keys(JUDGES).map((id) => g.emote(id, '!', 30)));
  await say(g, 'judge1', ['エントリーナンバー28番、\n{name}さんですね。', `${D.name}では、\n${D.piece}をお願いします。`]);
  await say(g, 'judge2', D.key === 'uta' ? 'リラックスして。\n楽しんで歌ってね！' : '肩の力をぬいて。\nあなたらしく、どうぞ！');
  await g.emote('judge3', '…');
  await say(g, 'judge3', '……（じっと見ている）');
}

async function passedReaction(g, D) {
  fx.confetti = g.frame;
  g.sfx('applause');
  await Promise.all([g.emote('judge1', '!'), g.emote('judge2', '♥'), g.emote('judge3', '♪')]);
  fx.card = g.frame;
  g.sfx('good');
  await say(g, 'judge1', ['おめでとうございます！\n文句なしの合格です！', 'あなたのような人を、\nずっと待っていました。']);
  await say(g, 'judge2', D.key === 'uta' ? 'のびやかな声だったわ。\nもっと聴きたくなっちゃった！' : 'セリフがなくても、\n気持ちがちゃんと伝わってきたわ！');
  await say(g, 'judge3', D.key === 'engi' ? '……いい芝居だった。\n舞台で会うのが楽しみだ。' : '……いい表情で歌っていた。\n次は芝居も見せてほしい。');
  await g.emote('player', '♥');
  await say(g, 'judge1', g.flag('horipro_welcomed') ? 'さっそく、担当マネージャーを\n呼んできましょう！' : 'さっそく、担当マネージャーを\nご紹介しましょう！');
  // the manager rushes in from the lobby
  await g.fadeOut();
  fx.spot = null;
  fx.card = 0;
  g.placePlayer(9, 7, 'down');
  g.showNpc('hmgr', true);
  g.placeNpc('hmgr', 9, 12, 'up');
  await g.fadeIn();
  g.sfx('door');
  await say(g, 'hmgr', 'はぁ、はぁ…\nま、間に合った！');
  await g.walkNpcTo('hmgr', 9, 8, 1.5);
  face(g, 'hmgr', 'up');
  await g.emote('hmgr', '!');
  const rejoin = !!g.flag('horipro_welcomed');
  await say(g, 'hmgr', rejoin
    ? ['{name}さん、おかえりなさい！\nまた担当させてもらいますね！', '歌もお芝居もバラエティも、\nどんどん挑戦していきましょう！']
    : [
      'はじめまして！今日から{name}さんを担当する、\nマネージャーの七瀬です！',
      '歌もお芝居もバラエティも、\nどんどん挑戦していきましょう！',
      'これ、所属記念のピンバッジです。\n大事な本番の前につけてくださいね！',
    ]);
  if (!g.hasItem('horipro_star_pin')) {
    if (rejoin) await say(g, 'hmgr', '所属記念のピンバッジ、\nもう一度お渡ししておきますね！');
    g.giveItem('horipro_star_pin');
    g.sfx('success');
    await g.say('「星のピンバッジ」をもらった！\nもちもの（メニュー）から使える。');
  }
  await say(g, 'hmgr', 'お仕事の相談は、1階の事務所で！\nレッスンもしっかり受けてくださいね。');
  g.setFlag('horipro_welcomed');
}

async function failedReaction(g, D) {
  face(g, 'judge2', 'right');
  face(g, 'judge3', 'left');
  await Promise.all([g.emote('judge2', '…'), g.emote('judge3', '…'), g.emote('judge1', '…')]);
  face(g, 'judge2', 'up');
  face(g, 'judge3', 'up');
  await say(g, 'judge1', ['ありがとうございました。\n今回は、ご縁がありませんでした。', 'でも、光るものは\nたしかにありましたよ。']);
  if (D.key === 'uta') await say(g, 'judge2', ['リズムに合わせるのは、\n練習で必ずうまくなるわ。', '1階のスタジオで、\nボイトレを受けてみて！']);
  else await say(g, 'judge3', ['……動きを、あわてず正確に。', '1階のスタジオの演技レッスンを\nすすめる。']);
  await say(g, 'judge1', 'また挑戦してくれるのを、\n待っていますね！');
}

async function auditionDesk(g, who) {
  const st = g.state;
  const choices = ['歌部門', '演技部門', 'くわしく', 'やめておく'];
  const i = await ask(g, who, who === 'ad'
    ? ['新人オーディション会場へようこそ！', '歌部門と演技部門、\nどちらで受けますか？']
    : ['審査委員長です。\n受けに来てくれたのですね。', 'どちらの部門で挑戦しますか？'], choices);
  if (i === 2) {
    await say(g, who, [
      '歌部門は課題曲。流れてくる音符に合わせて\n← → を押してください。',
      '演技部門はひとり芝居。表示された動きを\nあわてず正確に演じてください。',
      'どちらも55点以上で合格です！\n自信がなければ1階のスタジオでレッスンを。',
    ]);
    if (st.agency) await say(g, who, 'よその事務所の方は、合格したら\n移籍の相談になりますからね。');
    return;
  }
  if (i > 1) { await say(g, who, '準備ができたら、\nいつでも声をかけてくださいね！'); return; }
  if (st.stamina < 15) {
    await say(g, who, ['あれ、顔色が悪いですよ？', '体力が足りないみたいです。\n休んで万全にしてから来てくださいね！']);
    return;
  }
  // burnout / starving: refuse before walking on stage
  const tired = g.lifeRefusal();
  if (tired) { await g.say(tired); return; }
  const D = DEPTS[i];
  await stageEntrance(g, D);
  await g.audition({ agency: PID, title: D.title, minigame: D.minigame, opts: D.opts, skill: D.key, pass: 55, stamina: 15 });
  const r = g.lastAudition;
  if (r === 'passed') {
    await passedReaction(g, D);
  } else if (r === 'failed') {
    await failedReaction(g, D);
  } else if (r === 'transferDeclined') {
    await say(g, 'judge1', ['…そうですか。残念です。', `でも、すばらしい${D.name}の審査でした。\nいつでも待っていますよ。`]);
  } else {
    await say(g, 'judge1', 'では、準備ができたら\nまたいらしてください。');
  }
  await resetHall(g);
}

async function guestJudge(g) {
  const i = await ask(g, 'judge1', ['{name}さん、いいところに！', '今日はゲスト審査員として、\n一緒に見てもらえませんか？'], ['引き受ける', 'またこんど']);
  if (i !== 0) { await say(g, 'judge1', 'そうですか。\nまたお願いしますね！'); return; }
  await g.fadeOut();
  seatJudges(g);
  g.placePlayer(13, 10, 'up');
  g.placeNpc('rival', 2, 5, 'right');
  fx.spot = 'rival';
  await g.fadeIn();
  await say(g, 'judge1', 'では次の方、どうぞ！');
  await g.moveNpc('rival', 'right right right right right right right face:down', 1.2);
  await say(g, 'rival', 'エントリーナンバー31番！\nタクミです！歌います！');
  g.sfx('drum');
  await g.emote('rival', '♪', 40);
  g.sfx('good');
  await g.emote('rival', '♪', 40);
  g.sfx('applause');
  await say(g, 'judge1', 'ありがとうございました。\n{name}さん、ひとことお願いします！');
  const c = await g.ask('どんな言葉をかけよう？', ['声がよく出てた！', 'もっと楽しんで！', 'ダンスも見たい！']);
  const replies = [
    'ありがとうございます！\n毎日、発声練習してきました！',
    'は、はい！\n…次は笑顔で歌ってみます！',
    'ダンスですか！？\nスタジオで、がんばって練習します！',
  ];
  await g.emote('rival', '!');
  await say(g, 'rival', replies[c] || replies[0]);
  await say(g, 'judge2', 'さすが先輩、いいアドバイスね。\n…あの子、きっと伸びるわよ。');
  markToday(g, 'horipro_guest_day');
  g.addSkill('talk', 2, true);
  g.addFame(5, true);
  g.sfx('good');
  await g.say(`ゲスト審査員をつとめた！\nトーク +2　知名度 +5（★${g.state.fame}）`);
  await resetHall(g, 13, 8, 'down');
}

async function talkAd(g) {
  if (isMember(g)) {
    await say(g, 'ad', g.state.fame >= 1000 && !today(g, 'horipro_guest_day')
      ? ['あっ、{name}さん！', '委員長が、ゲスト審査員を\nお願いしたいそうですよ！']
      : ['あっ、{name}さん！おつかれさまです！', '今日も新人オーディション開催中です。\n後輩たちの応援、よろしくお願いします！']);
    return;
  }
  await auditionDesk(g, 'ad');
}

async function talkJudge1(g) {
  const st = g.state;
  if (!isMember(g)) { await auditionDesk(g, 'judge1'); return; }
  if (st.fame >= 1000 && !today(g, 'horipro_guest_day')) { await guestJudge(g); return; }
  if (st.fame >= 1000) { await say(g, 'judge1', '今日の審査、ありがとうございました。\nまたお願いしますね。'); return; }
  await say(g, 'judge1', ['あの日のオーディション、\nよく覚えていますよ。', '★1000をこえたら、ゲスト審査員を\nお願いしようかしら。楽しみです。']);
}

async function talkJudge2(g) {
  if (isMember(g)) {
    let lines = ['歌は毎日の積み重ね。', 'ボイトレの音羽先生は、\nわたしの昔からの友だちなの。'];
    if (g.flag('horipro_musical_done')) lines = ['ミュージカル、客席で見ていたわ。', 'あの歌声、まだ耳に残ってる。\n次の舞台も楽しみにしてるわね。'];
    else if (g.state.skills.uta >= 50) lines = ['最近の歌、すごくいいわね。', '★1000になったら、ミュージカルの\n主演も夢じゃないわよ。'];
    await say(g, 'judge2', lines);
    return;
  }
  await say(g, 'judge2', [
    '音楽の審査を担当しているわ。',
    '歌部門は、← → でリズムに乗るの。\nぴったり合うほど高得点よ。',
    '受付は、進行係の子にどうぞ。',
  ]);
}

async function talkJudge3(g) {
  if (isMember(g)) {
    await say(g, 'judge3', g.state.skills.engi >= 50 ? '……いい役者になった。\nいつか、わたしの舞台に。' : '……芝居は、一生勉強だ。');
    return;
  }
  await say(g, 'judge3', ['……演出家だ。', '演技部門は、表示された動きを\n正確に、テンポよく。それだけだ。', '……受付は、あっちだ。']);
}

async function talkRival(g) {
  if (isMember(g)) {
    await say(g, 'rival', ['先輩！…って呼んでいいですか？', 'オレも絶対、合格してみせます！']);
    return;
  }
  await say(g, 'rival', ['オレは演技部門で受けるんだ！', '舞岡先生のレッスンで、\n毎日きたえてきたからな！', '…でも、足のふるえが止まらない。']);
}

async function talkHana(g) {
  if (isMember(g)) {
    await say(g, 'hana', 'あの合格の瞬間、見てました！\nわたしもあんなふうになりたい！');
    return;
  }
  await say(g, 'hana', ['ふんふーん♪…あ、ごめんなさい！', '課題曲を口ずさんでたの。\n「にじいろの扉」、いい曲だよね！']);
}

// ====================================================================== place
const BACKDROP_TEXT = (ctx, g, cam) => {
  const ox = -cam.x, oy = -cam.y;
  const gold = '#ffd23f';
  text(ctx, 'ホリプロ', 82 + ox, 2 * TILE + 5 + oy, { size: 10, align: 'center', color: '#ffffff' });
  text(ctx, '新人オーディション', 82 + ox, 2 * TILE + 17 + oy, { size: 10, align: 'center', color: gold });
  text(ctx, '歌部門', 222 + ox, 2 * TILE + 5 + oy, { size: 10, align: 'center', color: ST.k });
  text(ctx, '演技部門', 222 + ox, 2 * TILE + 17 + oy, { size: 10, align: 'center', color: '#7fd0ff' });
};

registerPlace({
  id: PID,
  name: 'ホリプロ',
  kind: 'building',
  bgm: 'office',
  start: { room: 'lobby', x: 9, y: 12, dir: 'up' },
  rooms: {
    // ------------------------------------------------------------ ロビー
    lobby: {
      floor: 'horipro_floor',
      wall: 'white',
      bgm: 'horipro_lobby',
      tiles: [
        '####################',
        '#UUUUUUUUUUUUUUUUUU#',
        '#UUUAUBUUUUUUCUUUiU#',
        '#=d=a=b======c=g=e=#',
        '#P.....P....P.....h#',
        '#.......KLRK.......#',
        '#........[]........#',
        '#.123....[]....QQv.#',
        '#Zttt....[]........#',
        '#........[]........#',
        '#........[]........#',
        '#........[]........#',
        '#P.......[].......P#',
        '#########MM#########',
      ],
      legend: {
        U: 'horipro_wall_hi', '=': 'horipro_wall',
        A: 'horipro_wall_hi+horipro_tp1_hi', a: 'horipro_wall+horipro_tp1_lo',
        B: 'horipro_wall_hi+horipro_tp2_hi', b: 'horipro_wall+horipro_tp2_lo',
        C: 'horipro_wall_hi+horipro_tp3_hi', c: 'horipro_wall+horipro_tp3_lo',
        i: 'horipro_wall_hi+horipro_elev_ind', e: 'elevator', d: 'door_wood', g: 'door_glass',
        P: 'plant', h: 'horipro_aframe',
        K: 'horipro_counter', L: 'horipro_counter_l', R: 'horipro_counter_r',
        '[': 'horipro_runner_l', ']': 'horipro_runner_r',
        1: 'horipro_sofa_y', 2: 'horipro_sofa_g', 3: 'horipro_sofa_k', t: 'horipro_glass_table',
        Z: 'horipro_magrack', Q: 'horipro_awards', v: 'water_server',
      },
      warps: [
        { x: 9, y: 13, to: 'exit' },
        { x: 10, y: 13, to: 'exit' },
        { x: 2, y: 3, room: 'office', tx: 8, ty: 11, dir: 'up' },
        { x: 15, y: 3, room: 'studio', tx: 9, ty: 11, dir: 'up' },
        { x: 17, y: 3, room: 'hall', tx: 9, ty: 12, dir: 'up', sfx: 'chime' },
      ],
      entities: [
        { type: 'logo', x: 8.5, y: 1.1, w: 3, h: 2.65, logo: 'horipro', lights: true },
        signProp(2, 2, '事務所', ST.g),
        signProp(15, 2, 'スタジオ', ST.b),
        signProp(17, 1, '会場', ST.r, 2),
        standee(4, 11, { hair: 'twin', hairColor: 'pink', skin: 'light', top: '#ffffff', bottom: ST.k, skirt: true }, '#ffe3ef',
          ['新人歌手の等身大パネルだ。', '「デビュー曲、好評発売中！」\nマイクを持って、元気いっぱいの笑顔。']),
        standee(16, 11, { hair: 'slick', hairColor: 'black', skin: 'fair', top: '#2e3140', bottom: '#2e3140', jacket: true, tie: ST.b }, '#dcefff',
          ['若手俳優の等身大パネルだ。', '「日曜夜の歴史ドラマ、出演決定！」\nりりしい表情がかっこいい。']),
        npc('uketsuke', 9, 4, 'down', { talk: talkUketsuke }),
        npc('annai', 10, 4, 'down', { talk: talkAnnai }),
        npc('scout', 13, 9, 'left', { wander: 1, talk: talkScout }),
        npc('yume', 16, 5, 'up', { talk: talkYume }),
        npc('mom', 5, 8, 'left', { talk: talkMom }),
        npc('kid', 6, 9, 'up', { wander: 1, talk: talkKid }),
        npc('mio', 14, 11, 'left', { talk: talkMio, person: 'mio' }),
        npc('guard', 8, 12, 'down', { talk: talkGuard }),
      ],
      events: [
        { x: 4, y: 3, on: 'action', run: (g) => g.say(['ポスターの女優さんが、やさしくほほえんでいる。', '「春の新ドラマ、主演決定！」\n…いつか自分も！']) },
        { x: 6, y: 3, on: 'action', run: (g) => g.say(['若手俳優のポスターだ。', '「初主演映画、公開中！」\nキリッとした表情がかっこいい。']) },
        { x: 13, y: 3, on: 'action', run: (g) => g.say(['新人歌手のデビューポスターだ。', '「1stシングル、発売中！」\n明るい笑顔がまぶしい。']) },
        { x: 15, y: 7, w: 2, h: 1, on: 'action', run: (g) => g.say(['ガラスのショーケースだ。', 'トロフィーや記念の盾、\n舞台の写真が飾られている。']) },
        { x: 1, y: 8, on: 'action', run: (g) => g.say('マガジンラックだ。\nどの表紙もタレントの笑顔でいっぱい！') },
        { x: 2, y: 7, w: 3, h: 1, on: 'action', run: (g) => g.say('黄・緑・ピンクのソファ。\nロゴの星みたいにカラフルだ。') },
        { x: 2, y: 8, w: 3, h: 1, on: 'action', run: (g) => g.say('ガラスのテーブルに、\n舞台のチラシが並んでいる。') },
        {
          x: 18, y: 4, on: 'action',
          run: (g) => g.say(['立て看板だ。', '「新人オーディション 本日も開催中！\n会場：2F（エレベーターへ）」']),
        },
      ],
      onEnter: greetLobby,
    },

    // ------------------------------------------------------------ 事務所
    office: {
      floor: 'horipro_ofloor',
      wall: 'white',
      bgm: 'office',
      tiles: [
        '##################',
        '#UUUUcUUUUUUUXYUA#',
        '#=WW=w=====w=xy==#',
        '#bb.....v......CC#',
        '#................#',
        '#.DED.......DED..#',
        '#................#',
        '#......DEED......#',
        '#................#',
        '#................#',
        '#.123.......Z....#',
        '#Pttt..........P.#',
        '########MM########',
      ],
      legend: {
        U: 'horipro_wall_hi', '=': 'horipro_wall',
        c: 'horipro_wall_hi+clock', A: 'horipro_wall_hi+horipro_wall_star',
        W: 'horipro_wall+whiteboard', w: 'horipro_wall+window',
        X: 'horipro_wall_hi+horipro_sp1_hi', x: 'horipro_wall+horipro_sp1_lo',
        Y: 'horipro_wall_hi+horipro_sp2_hi', y: 'horipro_wall+horipro_sp2_lo',
        b: 'bookshelf', C: 'cabinet', v: 'water_server', P: 'plant',
        D: 'horipro_desk_papers', E: 'horipro_desk_pc',
        1: 'horipro_sofa_y', 2: 'horipro_sofa_g', 3: 'horipro_sofa_k', t: 'horipro_glass_table',
        Z: 'horipro_easel',
      },
      warps: [
        { x: 8, y: 12, room: 'lobby', tx: 2, ty: 4, dir: 'down' },
        { x: 9, y: 12, room: 'lobby', tx: 2, ty: 4, dir: 'down' },
      ],
      entities: [
        { type: 'logo', x: 8, y: 1, w: 2, h: 2, logo: 'horipro' },
        npc('manager', 3, 4, 'down', { talk: talkManager }),
        npc('seisaku', 13, 4, 'down', { talk: talkSeisaku }),
        npc('jimu', 8, 6, 'down', { talk: talkJimu }),
        npc('henshu', 5, 10, 'left', { talk: talkHenshu }),
        npc('tvp', 15, 7, 'left', { talk: talkTvp }),
        npc('cm', 13, 10, 'down', { talk: talkCm }),
      ],
      events: [
        { x: 2, y: 2, w: 2, h: 1, on: 'action', run: scheduleBoard },
        { x: 13, y: 2, on: 'action', run: (g) => g.say(['新作ミュージカルのポスターだ。', '赤いカーテンの真ん中に、\nスポットライトを浴びた主役が立っている。']) },
        { x: 14, y: 2, on: 'action', run: (g) => g.say(['コンサートツアーのポスターだ。', '七色のライトに、\nペンライトの光の海…！']) },
        { x: 15, y: 3, w: 2, h: 1, on: 'action', run: (g) => g.say('キャビネットだ。台本や企画書が\nぎっしりつまっている。') },
        { x: 2, y: 10, w: 3, h: 1, on: 'action', run: (g) => g.say('打ち合わせ用のカラフルなソファだ。') },
        { x: 2, y: 11, w: 3, h: 1, on: 'action', run: (g) => g.say('テーブルの上に、雑誌の見本と\nコーヒーが置いてある。') },
        { x: 12, y: 10, on: 'action', run: (g) => g.say(['CMの絵コンテだ。', '「通行人、ふり返ってニッコリ」\n…なるほど。']) },
      ],
      drawOver(ctx, g) { drawConfetti(ctx, g); drawBannerFx(ctx, g); },
    },

    // ------------------------------------------------------------ レッスンスタジオ
    studio: {
      floor: 'horipro_maple',
      wall: 'white',
      bgm: 'studio',
      tiles: [
        '####################',
        '#UUUUmmmmmmmmmmmUcU#',
        '#=WW=nnnnnnnnnnn=w=#',
        '#s...............LL#',
        '#...i.i...........b#',
        '#..................#',
        '#..................#',
        '#..................#',
        '#BB............h.h.#',
        '#..............TTT.#',
        '#..................#',
        '#P................P#',
        '#########MM#########',
      ],
      legend: {
        U: 'horipro_wall_hi', '=': 'horipro_wall',
        c: 'horipro_wall_hi+clock', W: 'horipro_wall+whiteboard', w: 'horipro_wall+window',
        m: 'horipro_mirror_hi', n: 'horipro_mirror_lo',
        s: 'speaker', i: 'mic', L: 'locker', b: 'horipro_bags', P: 'plant',
        B: 'horipro_bench', h: 'horipro_folding_chair', T: 'horipro_script_table',
      },
      warps: [
        { x: 9, y: 12, room: 'lobby', tx: 15, ty: 4, dir: 'down' },
        { x: 10, y: 12, room: 'lobby', tx: 15, ty: 4, dir: 'down' },
      ],
      entities: [
        {
          type: 'prop', x: 1, y: 4, w: 2, h: 2,
          text: ['グランドピアノだ。ポロン♪', 'ボイトレのときは、\n音羽先生がここで伴奏してくれる。'],
          draw: drawPiano,
        },
        npc('vocal', 3, 5, 'down', { talk: talkVocal }),
        npc('dance', 10, 3, 'down', { talk: talkDance }),
        npc('acting', 16, 8, 'down', { talk: talkActing }),
        npc('ken1', 8, 6, 'up', { talk: (g) => watchRehearsal(g, 'ken1'), person: 'hinata' }),
        npc('ken2', 10, 6, 'up', { talk: (g) => watchRehearsal(g, 'ken2') }),
        npc('ken3', 12, 6, 'up', { talk: (g) => watchRehearsal(g, 'ken3') }),
      ],
      events: [
        { x: 2, y: 2, w: 2, h: 1, on: 'action', run: (g) => g.say(['レッスンの予定表だ。', '「ボイトレ」「演技」「ダンス」\n毎日びっしり埋まっている。']) },
        { x: 5, y: 2, w: 11, h: 1, on: 'action', run: (g) => g.say('壁一面の大きな鏡と、バーだ。\n自分の動きをチェックできる。') },
        { x: 1, y: 8, w: 2, h: 1, on: 'action', run: (g) => g.say('ベンチだ。タオルと楽譜が\n置きっぱなしになっている。') },
        { x: 15, y: 9, w: 3, h: 1, on: 'action', run: (g) => g.say(['台本が置いてある。', '「…それでも、わたしは歌いたいの！」\nセリフに赤ペンがびっしり。']) },
        { x: 18, y: 4, on: 'action', run: (g) => g.say('研修生たちのバッグと水筒だ。\nみんな、がんばってるんだなあ。') },
      ],
    },

    // ------------------------------------------------------------ オーディション会場（2F）
    hall: {
      floor: 'horipro_hallfloor',
      wall: 'dark',
      bgm: 'horipro_audition',
      tiles: [
        '###################',
        '#VVVVVVVVVVVVVVVVV#',
        '#KbbbbbbbbbbbbbbbK#',
        '#KBBBBBBBBBBBBBBBK#',
        '#KsssssssssssssssK#',
        '#KsssssssssssssssK#',
        '#EtEEEEEEEEEEEEEtE#',
        '#l...............l#',
        '#.................#',
        '#.....JJJJJJJ.....#',
        '#.................#',
        '#.................#',
        '#.hhh.........hhh.#',
        '#########M#########',
      ],
      legend: {
        V: 'curtain_top', K: 'curtain', b: 'horipro_backdrop_hi', B: 'horipro_backdrop_lo',
        s: 'floor_stage', E: 'stage_edge', t: 'horipro_steps', l: 'spotlight',
        J: 'horipro_judge_table', h: 'horipro_folding_chair',
      },
      warps: [
        { x: 9, y: 13, room: 'lobby', tx: 17, ty: 4, dir: 'down', sfx: 'chime' },
      ],
      entities: [
        { type: 'logo', x: 8.25, y: 2.1, w: 2.5, h: 1.8, logo: 'horipro', lights: true },
        npc('judge1', 9, 10, 'up', { talk: talkJudge1 }),
        npc('judge2', 7, 10, 'up', { talk: talkJudge2 }),
        npc('judge3', 11, 10, 'up', { talk: talkJudge3 }),
        npc('ad', 7, 12, 'down', { talk: talkAd }),
        npc('rival', 3, 11, 'up', { talk: talkRival }),
        npc('hana', 15, 11, 'left', { talk: talkHana }),
        npc('hmgr', 9, 12, 'up', { hidden: true, text: 'よろしくお願いします！' }),
      ],
      events: [
        { x: 2, y: 12, w: 3, h: 1, on: 'action', run: (g) => g.say('受験者用のパイプイスだ。\n番号札が置いてある。') },
        { x: 14, y: 12, w: 3, h: 1, on: 'action', run: (g) => g.say('パイプイスに、誰かの楽譜が\n置き忘れてある。') },
      ],
      drawUnder: BACKDROP_TEXT,
      drawOver(ctx, g, cam) { drawSpot(ctx, g, cam); drawCard(ctx, g, cam); drawConfetti(ctx, g); },
    },
  },
});

// ---------------------------------------------------------------- grand piano prop (2x2 tiles)
function drawPiano(ctx, sx, sy) {
  const x = Math.round(sx), y = Math.round(sy);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x + 2, y + 29, 28, 2);
  ctx.fillRect(x + 4, y + 31, 24, 1);
  // raised lid
  ctx.fillStyle = '#26262c';
  ctx.beginPath(); ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 27, y + 8); ctx.lineTo(x + 22, y - 4); ctx.lineTo(x + 9, y + 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b3f48'; ctx.fillRect(x + 10, y + 2, 10, 1);
  // body
  ctx.fillStyle = '#16161a';
  ctx.fillRect(x + 2, y + 8, 28, 15);
  ctx.fillRect(x + 4, y + 6, 22, 2);
  ctx.fillStyle = '#34343c'; ctx.fillRect(x + 4, y + 10, 22, 1);
  ctx.fillStyle = '#c9a227'; ctx.fillRect(x + 6, y + 14, 20, 1);
  // keyboard
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 22, 28, 5);
  ctx.fillStyle = '#16161a';
  for (let k = 0; k < 13; k++) if (k % 7 !== 2 && k % 7 !== 6) ctx.fillRect(x + 4 + k * 2, y + 22, 1, 3);
  ctx.fillStyle = '#d5d9e0'; ctx.fillRect(x + 2, y + 26, 28, 1);
  ctx.fillStyle = '#16161a'; ctx.fillRect(x + 2, y + 27, 28, 2);
  // legs
  ctx.fillRect(x + 3, y + 29, 2, 2); ctx.fillRect(x + 27, y + 29, 2, 2);
  // score
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 12, y + 17, 8, 4);
  ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x + 13, y + 18, 6, 1); ctx.fillRect(x + 13, y + 20, 4, 1);
}

